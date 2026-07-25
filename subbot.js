// subbot.js
//
// Proceso INDEPENDIENTE para un solo subbot (portado del sistema de
// ALEPANDA-BOT, adaptado a este bot). Cada subbot corre con su propio
// PM2, separado del proceso principal y de los demas subbots.
//
// Uso: node subbot.js <id> [numero]
//   <id>     carpeta dentro de subbots/<id>/ (sesion + status.json)
//   [numero] solo se pasa quien crea el subbot por primera vez, para
//            pedir el codigo de vinculacion. En reconexiones (ya
//            vinculado) no hace falta.
//
// Importa './config.js' y carga los plugins exactamente igual que
// main.js, para que el subbot responda a los mismos comandos que el
// bot principal.

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import { readdirSync } from 'fs';
import { createRequire } from 'module';
import chalk from 'chalk';
import pino from 'pino';
import NodeCache from 'node-cache';
import yargs from 'yargs';
import { Low, JSONFile } from 'lowdb';
import lodash from 'lodash';

import './config.js';
import {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason
} from '@whiskeysockets/baileys';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { BAILEYS_VERSION } from './utils/_version.js';

const SUBBOT_ID = process.argv[2];
const NUMERO_PARA_CODIGO = process.argv[3] || null;

if (!SUBBOT_ID) {
  console.error('Falta el ID del subbot. Uso: node subbot.js <id> [numero]');
  process.exit(1);
}

// --- Mismos globals que usa main.js (los plugins dependen de ellos) ---
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? (/file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL) : pathToFileURL(pathURL).toString();
};
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
};
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, apiPath = '/', query = {}, apikeyqueryname) =>
  (name in global.APIs ? global.APIs[name] : name) +
  apiPath +
  (query || apikeyqueryname
    ? '?' +
      new URLSearchParams(
        Object.entries({
          ...query,
          ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys?.[name in global.APIs ? global.APIs[name] : name] } : {})
        })
      )
    : '');

global.timestamp = { start: new Date() };

const __dirname = global.__dirname(import.meta.url);

global.opts = new Object(yargs(process.argv.slice(4)).exitProcess(false).parse());
global.prefix = new RegExp('^[' + (opts['prefix'] || '‎z/#$%.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']');

// Comparte la MISMA base de datos que el bot principal (mismos usuarios,
// economia, etc, en vez de tener una copia aislada por subbot).
global.db = new Low(new JSONFile(path.join(__dirname, 'storage/databases/database.json')));
global.isDatabaseModified = false;
global.markDatabaseModified = () => { global.isDatabaseModified = true; };
global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise(resolve =>
      setInterval(async function () {
        if (!global.db.READ) {
          clearInterval(this);
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
        }
      }, 1000)
    );
  }
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read().catch(console.error);
  global.db.READ = null;
  global.db.data = {
    users: {}, chats: {}, stats: {}, msgs: {}, sticker: {}, settings: {},
    ...(global.db.data || {})
  };
  global.db.chain = lodash.chain(global.db.data);
  const originalSet = global.db.chain.set.bind(global.db.chain);
  global.db.chain.set = (...args) => {
    const result = originalSet(...args);
    global.markDatabaseModified();
    return result;
  };
};

protoType();
serialize();

await global.loadDatabase();

const CARPETA_SUBBOT = path.join(__dirname, 'subbots', SUBBOT_ID);
const CARPETA_SESION = path.join(CARPETA_SUBBOT, 'session');
const RUTA_STATUS = path.join(CARPETA_SUBBOT, 'status.json');

if (!fs.existsSync(CARPETA_SESION)) fs.mkdirSync(CARPETA_SESION, { recursive: true });

function escribirStatus(datos) {
  try {
    fs.writeFileSync(RUTA_STATUS, JSON.stringify({ ...datos, actualizado: Date.now() }, null, 2));
  } catch (err) {
    console.error(`[subbot ${SUBBOT_ID}] No se pudo escribir status.json:`, err.message);
  }
}

escribirStatus({ estado: 'iniciando' });

// --- Carga de plugins, igual que main.js (recursivo, incluye subcarpetas) ---
const pluginFolder = path.join(__dirname, 'plugins');
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

function walkPluginFiles(dir, base = dir) {
  let results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkPluginFiles(fullPath, base));
    } else if (pluginFilter(entry.name)) {
      const relPath = path.relative(base, fullPath).split(path.sep).join('/');
      results.push({ relPath, fullPath });
    }
  }
  return results;
}

async function cargarPlugins() {
  let loaded = 0;
  for (const { relPath, fullPath } of walkPluginFiles(pluginFolder)) {
    try {
      const file = global.__filename(fullPath);
      const module = await import(file);
      global.plugins[relPath] = module.default || module;
      loaded++;
    } catch (e) {
      console.error(`[subbot ${SUBBOT_ID}] Error al cargar el plugin '${relPath}':`, e.message);
      delete global.plugins[relPath];
    }
  }
  console.log(chalk.green(`[subbot ${SUBBOT_ID}] ${loaded} plugins cargados`));
}

await cargarPlugins();

const handlerModule = await import('./handler.js');
const handler = handlerModule.handler;

// --- Conexion del subbot ---
const necesitaVincular = !!NUMERO_PARA_CODIGO;

async function iniciarSubbot() {
  const { state, saveCreds } = await useMultiFileAuthState(CARPETA_SESION);
  const logger = pino({ level: 'fatal' });

  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    version: BAILEYS_VERSION,
    printQRInTerminal: false,
    logger,
    // Nombre de navegador RECONOCIDO por WhatsApp (uno inventado causa
    // "Connection Closed" al pedir el codigo -- ya nos paso antes).
    browser: Browsers.ubuntu('Chrome'),
    msgRetryCache: new NodeCache(),
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    retryRequestDelayMs: 10,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
    maxMsgRetryCount: 15,
    appStateMacVerification: { patch: false, snapshot: false },
    getMessage: async () => ''
  });

  let pidiendoCodigo = false;

  async function pedirCodigoDeVinculacion() {
    if (pidiendoCodigo || !necesitaVincular || state.creds.registered) return;
    pidiendoCodigo = true;

    let codigo = null;
    let ultimoError = null;

    for (let intento = 1; intento <= 5 && !codigo; intento++) {
      try {
        if (intento > 1) await new Promise(resolve => setTimeout(resolve, 3000 * intento));
        codigo = await sock.requestPairingCode(NUMERO_PARA_CODIGO.trim());
      } catch (err) {
        ultimoError = err;
        console.error(`[subbot ${SUBBOT_ID}] Intento ${intento} de pedir codigo fallo:`, err?.message || err);
      }
    }

    pidiendoCodigo = false;

    if (!codigo) {
      escribirStatus({ estado: 'error', error: ultimoError?.message || 'No se pudo obtener el codigo despues de varios intentos' });
      return;
    }

    escribirStatus({ estado: 'esperando_codigo', codigo });
    console.log(`[subbot ${SUBBOT_ID}] Codigo de vinculacion: ${codigo}`);
  }

  sock.handler = handler.bind(sock);
  sock.ev.on('messages.upsert', sock.handler);
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (necesitaVincular && (connection === 'connecting' || qr)) {
      pedirCodigoDeVinculacion();
    }

    if (connection === 'open') {
      escribirStatus({ estado: 'conectado', numero: sock.user?.id?.split(':')[0] || null });
      console.log(`[subbot ${SUBBOT_ID}] Conectado correctamente.`);
    }

    if (connection === 'close') {
      const codigoError = lastDisconnect?.error?.output?.statusCode;
      const desconectadoPermanente = codigoError === DisconnectReason.loggedOut;

      if (desconectadoPermanente) {
        escribirStatus({ estado: 'desconectado' });
        console.log(`[subbot ${SUBBOT_ID}] Sesion cerrada (logout). No se reintenta automaticamente.`);
      } else {
        escribirStatus({ estado: 'reconectando' });
        iniciarSubbot();
      }
    }
  });
}

iniciarSubbot().catch(err => {
  console.error(`[subbot ${SUBBOT_ID}] Error fatal al iniciar:`, err);
  escribirStatus({ estado: 'error', error: err.message });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(`[subbot ${SUBBOT_ID}] Error no capturado:`, err);
});
process.on('unhandledRejection', (err) => {
  console.error(`[subbot ${SUBBOT_ID}] Promesa rechazada sin capturar:`, err);
});
