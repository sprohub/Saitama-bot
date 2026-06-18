import fs from 'fs'
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import * as ws from 'ws';
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, watch, mkdirSync, rmSync } from 'fs';
import yargs from 'yargs';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { tmpdir } from 'os';
import { format } from 'util';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { Low, JSONFile } from 'lowdb';
import lodash from 'lodash';
import readline from 'readline';
import NodeCache from 'node-cache';
import qrcode from 'qrcode-terminal';
import { spawn } from 'child_process';
import { setInterval } from 'timers';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';
process.env.TMPDIR = path.join(process.cwd(), 'tmp');

if (!fs.existsSync(process.env.TMPDIR)) {
  fs.mkdirSync(process.env.TMPDIR, { recursive: true });
  console.log(chalk.green('✅ Directorio temporal creado'));
}

import './config.js';
import { createRequire } from 'module';

const { proto } = (await import('@whiskeysockets/baileys')).default;
const {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} = await import('@whiskeysockets/baileys');

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

protoType();
serialize();

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
};
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) =>
  (name in global.APIs ? global.APIs[name] : name) +
  path +
  (query || apikeyqueryname
    ? '?' +
      new URLSearchParams(
        Object.entries({
          ...query,
          ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}),
        })
      )
    : '');

global.timestamp = { start: new Date() };

const __dirname = global.__dirname(import.meta.url);

console.log(chalk.bold.cyan('\n' + '═'.repeat(60)));
console.log(chalk.bold.yellow('   𑁍 HINATA BOT - BYAKUGAN ACTIVADO 𑁍'));
console.log(chalk.bold.cyan('═'.repeat(60)));
console.log(chalk.magenta('   「No me rendiré, porque quiero ser fuerte como Naruto-kun」'));
console.log(chalk.bold.cyan('═'.repeat(60) + '\n'));

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp(
  '^[' +
    (opts['prefix'] || '‎z/#$%.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') +
    ']'
);

global.db = new Low(new JSONFile(`storage/databases/database.json`));

global.isDatabaseModified = false;
global.markDatabaseModified = () => {
  global.isDatabaseModified = true;
};

global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ)
    return new Promise((resolve) =>
      setInterval(async function () {
        if (!global.db.READ) {
          clearInterval(this);
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
        }
      }, 1 * 1000)
    );
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read().catch(console.error);
  global.db.READ = null;
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {}),
  };
  global.db.chain = lodash.chain(global.db.data);

  const originalSet = global.db.chain.set.bind(global.db.chain);
  global.db.chain.set = (...args) => {
    const result = originalSet(...args);
    global.markDatabaseModified();
    return result;
  };
};

global.authFile = `sessions`;
const { state, saveCreds } = await useMultiFileAuthState(global.authFile);

const { version } = await fetchLatestBaileysVersion();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

const logger = pino({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
}).child({ class: 'client' });
logger.level = 'fatal';

const connectionOptions = {
  version: version,
  logger,
  printQRInTerminal: false,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),
  },
  browser: Browsers.ubuntu('Chrome'),
  markOnlineOnclientect: false,
  generateHighQualityLinkPreview: true,
  syncFullHistory: true,
  retryRequestDelayMs: 10,
  transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
  maxMsgRetryCount: 15,
  appStateMacVerification: {
    patch: false,
    snapshot: false,
  },
  getMessage: async (key) => {
    const jid = jidNormalizedUser(key.remoteJid);
    return '';
  },
};

global.conn = makeWASocket(connectionOptions);
global.conns = global.conns || [];

let handler;
try {
  const handlerModule = await import('./handler.js');
  handler = handlerModule.handler;
  console.log(chalk.green('✅ Handler cargado correctamente'));
} catch (e) {
  console.error(chalk.red('[ERROR] No se pudo cargar el handler principal:'), e);
  process.exit(1);
}

async function reconnectSubBot(botPath) {
  console.log(chalk.yellow(`𑁍 [HINATA BOT] Despertando sub-bot: ${path.basename(botPath)}`));
  try {
    const { state: subBotState, saveCreds: saveSubBotCreds } = await useMultiFileAuthState(botPath);

    if (!subBotState.creds.registered) {
      console.warn(chalk.yellow(`⚠️ [HINATA BOT] Sub-bot en ${path.basename(botPath)} no está registrado`));
      return;
    }

    const subBotConn = makeWASocket({
      version: version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: subBotState.creds,
        keys: makeCacheableSignalKeyStore(subBotState.keys, logger),
      },
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnclientect: false,
      generateHighQualityLinkPreview: true,
      syncFullHistory: true,
      retryRequestDelayMs: 10,
      transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
      maxMsgRetryCount: 15,
      appStateMacVerification: {
        patch: false,
        snapshot: false,
      },
      getMessage: async (key) => '',
    });

    subBotConn.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        console.log(chalk.green(`✨ [HINATA BOT] Sub-bot despertado: ${path.basename(botPath)}`));
        const yaExiste = global.conns.some(c => c.user?.jid === subBotConn.user?.jid);
        if (!yaExiste) {
          global.conns.push(subBotConn);
          console.log(chalk.green(`𑁍 [HINATA BOT] Sub-bot fusionado: ${subBotConn.user?.jid}`));
        }
      } else if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.error(chalk.red(`💥 [HINATA BOT] Sub-bot caído en ${path.basename(botPath)}. Razón: ${reason}`));

        if (reason === DisconnectReason.loggedOut || reason === 401) {
          console.log(chalk.red(`❌ [HINATA BOT] Desconexión permanente. Eliminando ${path.basename(botPath)}.`));
          global.conns = global.conns.filter(conn => conn.user?.jid !== subBotConn.user?.jid);
          try {
            rmSync(botPath, { recursive: true, force: true });
            console.log(chalk.green(`✅ [HINATA BOT] Sub-bot eliminado: ${botPath}`));
          } catch (e) {
            console.error(chalk.red(`❌ [ERROR] No se pudo eliminar ${botPath}: ${e}`));
          }
        }
      }
    });

    subBotConn.ev.on('creds.update', saveSubBotCreds);
    subBotConn.handler = handler.bind(subBotConn);
    subBotConn.ev.on('messages.upsert', subBotConn.handler);
    console.log(chalk.blue(`𑁍 [HINATA BOT] Manejador asignado a: ${path.basename(botPath)}`));

    if (!global.subBots) {
      global.subBots = {};
    }
    global.subBots[path.basename(botPath)] = subBotConn;

  } catch (e) {
    console.error(chalk.red(`💥 [ERROR] Error al despertar sub-bot en ${path.basename(botPath)}:`), e);
  }
}

async function startSubBots() {
  const rutaJadiBot = join(__dirname, './JadiBots');

  if (!existsSync(rutaJadiBot)) {
    mkdirSync(rutaJadiBot, { recursive: true });
    console.log(chalk.bold.cyan(`📁 [HINATA BOT] Carpeta de sub-bots creada: ${rutaJadiBot}`));
  } else {
    console.log(chalk.bold.cyan(`📁 [HINATA BOT] Carpeta de sub-bots detectada: ${rutaJadiBot}`));
  }

  const readRutaJadiBot = readdirSync(rutaJadiBot);
  if (readRutaJadiBot.length > 0) {
    const credsFile = 'creds.json';
    console.log(chalk.magenta(`𑁍 [HINATA BOT] Buscando sub-bots... Total: ${readRutaJadiBot.length}`));

    for (const subBotDir of readRutaJadiBot) {
      const botPath = join(rutaJadiBot, subBotDir);
      if (statSync(botPath).isDirectory()) {
        const readBotPath = readdirSync(botPath);
        if (readBotPath.includes(credsFile)) {
          console.log(chalk.magenta(`𑁍 [HINATA BOT] Sub-bot detectado en ${subBotDir}. Despertando...`));
          await reconnectSubBot(botPath);
        } else {
          console.log(chalk.yellow(`⚠️ [HINATA BOT] Sub-bot latente en ${subBotDir} (sin creds.json)`));
        }
      }
    }
    console.log(chalk.magenta(`✅ [HINATA BOT] Proceso de sub-bots completado.`));
  } else {
    console.log(chalk.gray(`🌙 [HINATA BOT] No hay sub-bots para despertar.`));
  }
}

await startSubBots();

async function handleLogin() {
  if (conn.authState.creds.registered) {
    console.log(chalk.green('✅ [HINATA BOT] Ya registrada.'));
    return;
  }

  let loginMethod = await question(
    chalk.green(`\n` +
    `╔════════════════════════════════════╗\n` +
    `║     𑁍 HINATA BOT MODE 𑁍          ║\n` +
    `╠════════════════════════════════════╣\n` +
    `║ ¿Cómo deseas activar el Byakugan?  ║\n` +
    `║                                    ║\n` +
    `║ 📱 Escribe "code" para código      ║\n` +
    `║    de emparejamiento               ║\n` +
    `║                                    ║\n` +
    `║ 🔳 Presiona Enter para QR          ║\n` +
    `╚════════════════════════════════════╝\n` +
    `\n` +
    `> `
  ));

  loginMethod = loginMethod.toLowerCase().trim();

  if (loginMethod === 'code') {
    let phoneNumber = await question(chalk.cyan('📱 Ingresa el número de WhatsApp (con código país, ej: 51910227479):\n> '));
    phoneNumber = phoneNumber.replace(/\D/g, '');

    if (phoneNumber.startsWith('52') && phoneNumber.length === 12) {
      phoneNumber = `521${phoneNumber.slice(2)}`;
    } else if (phoneNumber.startsWith('52') && phoneNumber.length === 10) {
      phoneNumber = `521${phoneNumber}`;
    } else if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.replace(/^0/, '');
    }

    if (typeof conn.requestPairingCode === 'function') {
      try {
        if (conn.ws.readyState === ws.OPEN) {
          console.log(chalk.yellow('𑁍 Generando código de emparejamiento...'));
          let code = await conn.requestPairingCode(phoneNumber);
          code = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log(chalk.bold.green('\n════════════════════════════════════'));
          console.log(chalk.bold.yellow(`   🔐 CÓDIGO DE EMPAREJAMIENTO:`));
          console.log(chalk.bold.cyan(`      ${code}`));
          console.log(chalk.bold.green('════════════════════════════════════\n'));
        } else {
          console.log(chalk.red('❌ La conexión principal no está abierta. Intenta nuevamente.'));
        }
      } catch (e) {
        console.log(chalk.red('❌ Error al solicitar código de emparejamiento:'), e.message || e);
      }
    } else {
      console.log(chalk.red('❌ Tu versión de Baileys no soporta emparejamiento por código.'));
    }
  } else {
    console.log(chalk.yellow('🔳 Generando código QR, escanéalo con tu WhatsApp...\n'));
    conn.ev.on('connection.update', ({ qr }) => {
      if (qr) {
        console.log(chalk.green('📱 ESCANEA ESTE CÓDIGO QR:'));
        qrcode.generate(qr, { small: true });
        console.log(chalk.yellow('\n⏳ Esperando escaneo...\n'));
      }
    });
  }
}

await handleLogin();

conn.isInit = false;
conn.well = false;

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data && global.isDatabaseModified) {
        await global.db.write();
        global.isDatabaseModified = false;
        console.log(chalk.gray('💾 [HINATA BOT] Base de datos guardada'));
      }
      if (opts['autocleartmp']) {
        const tmp = [tmpdir(), 'tmp', 'serbot'];
        tmp.forEach((filename) => {
          spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']);
        });
      }
    }, 30 * 1000);
  }
}

function clearTmp() {
  const tmp = [join(__dirname, './tmp')];
  const filename = [];
  tmp.forEach((dirname) => readdirSync(dirname).forEach((file) => filename.push(join(dirname, file))));
  return filename.map((file) => {
    const stats = statSync(file);
    if (stats.isFile() && Date.now() - stats.mtimeMs >= 1000 * 60 * 1) return unlinkSync(file);
    return false;
  });
}

setInterval(() => {
  if (global.stopped === 'close' || !conn || !conn.user) return;
  clearTmp();
  console.log(chalk.gray('🧹 [HINATA BOT] Limpieza temporal completada'));
}, 180000);

if (typeof global.gc === 'function') {
  setInterval(() => {
    console.log(chalk.gray(`🧠 [HINATA BOT] Optimizando chakra...`));
    global.gc();
  }, 180000);
} else {
  console.log(chalk.yellow(`⚠️ [HINATA BOT] Para optimizar memoria, ejecuta con --expose-gc`));
}

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin } = update;
  global.stopped = connection;

  if (isNewLogin) {
    conn.isInit = true;
    console.log(chalk.green('✅ [HINATA BOT] Nuevo login detectado'));
  }

  const code =
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.output?.payload?.statusCode;

  if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
    await global.reloadHandler(true).catch(console.error);
    global.timestamp.connect = new Date();
  }

  if (global.db.data == null) await loadDatabase();

  if (connection === 'open') {
    console.log(chalk.bold.green('\n════════════════════════════════════'));
    console.log(chalk.bold.yellow('   𑁍 HINATA BOT HA DESPERTADO 𑁍'));
    console.log(chalk.bold.cyan(`   👤 Usuario: ${conn.user?.name || 'Hinata'}`));
    console.log(chalk.bold.cyan(`   📱 Número: ${conn.user?.id?.split(':')[0] || 'Desconocido'}`));
    console.log(chalk.bold.green('════════════════════════════════════\n'));
  }

  const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

  if (reason === 405) {
    if (existsSync('./sessions/creds.json')) unlinkSync('./sessions/creds.json');
    console.log(chalk.bold.redBright(`⚠️ Conexión reemplazada, reiniciando...`));
    process.send('reset');
  }

  if (connection === 'close') {
    switch (reason) {
      case DisconnectReason.badSession:
        conn.logger.error(`❌ Sesión incorrecta, elimina la carpeta ${global.authFile}`);
        break;
      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        conn.logger.warn(`⚠️ Conexión perdida, reconectando...`);
        await global.reloadHandler(true).catch(console.error);
        break;
      case DisconnectReason.connectionReplaced:
        conn.logger.error(`⚠️ Conexión reemplazada, se abrió otra sesión`);
        break;
      case DisconnectReason.loggedOut:
        conn.logger.error(`❌ Sesión cerrada, elimina la carpeta ${global.authFile}`);
        break;
      case DisconnectReason.restartRequired:
        conn.logger.info(`🔄 Reinicio necesario`);
        await global.reloadHandler(true).catch(console.error);
        break;
      default:
        conn.logger.warn(`❓ Desconexión desconocida: ${reason || ''}`);
        await global.reloadHandler(true).catch(console.error);
        break;
    }
  }
}

process.on('uncaughtException', (err) => {
  console.error(chalk.red('💥 [HINATA BOT] Error no capturado:'), err);
});

let isInit = true;

global.reloadHandler = async function (restartConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Handler && Handler.handler) handler = Handler.handler;
  } catch (e) {
    console.error(`[ERROR] Fallo al cargar handler.js: ${e}`);
  }

  if (restartConn) {
    try {
      if (global.conn.ws) global.conn.ws.close();
    } catch {}
    global.conn.ev.removeAllListeners();
    global.conn = makeWASocket(connectionOptions);
    isInit = true;
  }

  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler);
    conn.ev.off('connection.update', conn.connectionUpdate);
    conn.ev.off('creds.update', conn.credsUpdate);
  }

  conn.handler = handler.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn, true);

  conn.ev.on('messages.upsert', conn.handler);
  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);

  isInit = false;
  return true;
};

const pluginFolder = global.__dirname(join(__dirname, './plugins/index'));
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function filesInit() {
  console.log(chalk.blue('📂 [HINATA BOT] Cargando plugins...'));
  let loaded = 0;
  for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      const file = global.__filename(join(pluginFolder, filename));
      const module = await import(file);
      global.plugins[filename] = module.default || module;
      loaded++;
    } catch (e) {
      conn.logger.error(`Error al cargar el plugin '${filename}': ${e}`);
      delete global.plugins[filename];
    }
  }
  console.log(chalk.green(`✅ [HINATA BOT] ${loaded} plugins cargados correctamente`));
}

await filesInit();

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true);
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(`🔄 Plugin actualizado - '${filename}'`);
      else {
        conn.logger.warn(`🗑️ Plugin eliminado - '${filename}'`);
        return delete global.plugins[filename];
      }
    } else conn.logger.info(`✨ Nuevo plugin - '${filename}'`);

    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    });
    if (err) conn.logger.error(`❌ Error de sintaxis en '${filename}':\n${format(err)}`);
    else {
      try {
        const module = await import(`${global.__filename(dir)}?update=${Date.now()}`);
        global.plugins[filename] = module.default || module;
      } catch (e) {
        conn.logger.error(`❌ Error al cargar plugin '${filename}':\n${format(e)}`);
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
      }
    }
  }
};
Object.freeze(global.reload);

watch(pluginFolder, global.reload);
await global.reloadHandler();

console.log(chalk.bold.magenta('\n' + '⭐'.repeat(30)));
console.log(chalk.bold.yellow('   𑁍 HINATA BOT - BYAKUGAN COMPLETO 𑁍'));
console.log(chalk.bold.cyan('   「La bot está lista para ayudar」'));
console.log(chalk.bold.magenta('⭐'.repeat(30) + '\n'));

conn.ev.on('group-participants.update', async (update) => {
  const { id, participants, action } = update
  let chat = global.db.data.chats[id]
  if (!chat || chat.welcome !== true) return

  let metadata = await conn.groupMetadata(id)
  let pp
  try {
    pp = await conn.profilePictureUrl(id, 'image')
  } catch {
    pp = 'https://files.catbox.moe/r60c8l.jpg'
  }

  for (let user of participants) {
    if (action === 'add') {
      let texto
      if (chat.sWelcome) {
        texto = chat.sWelcome
          .replace(/@user/g, '@' + user.split('@')[0])
          .replace(/@group/g, metadata.subject)
          .replace(/@members/g, metadata.participants.length)
      } else {
        texto = '⛩️ 「 HINATA BOT 」 ⛩️\n\n'
        texto += '桜 » *BIENVENID@*\n'
        texto += '風 » @' + user.split('@')[0] + '\n'
        texto += '花 » ' + metadata.subject + '\n'
        texto += '桜 » Miembros: ' + metadata.participants.length + '\n\n'
        texto += '✧･ﾟ: *✧･ﾟ:* *:･ﾟ✧*:･ﾟ✧\n\n'
        texto += '> Gracias por unirte ♡'
      }

      await conn.sendMessage(id, {
        image: { url: pp },
        caption: texto,
        mentions: [user]
      })
    } else if (action === 'remove') {
      let texto
      if (chat.sBye) {
        texto = chat.sBye
          .replace(/@user/g, '@' + user.split('@')[0])
          .replace(/@group/g, metadata.subject)
          .replace(/@members/g, metadata.participants.length)
      } else {
        texto = '⛩️ 「 HINATA BOT 」 ⛩️\n\n'
        texto += '桜 » *ADIOS*\n'
        texto += '風 » @' + user.split('@')[0] + '\n'
        texto += '花 » ' + metadata.subject + '\n'
        texto += '桜 » Miembros: ' + metadata.participants.length + '\n\n'
        texto += '✧･ﾟ: *✧･ﾟ:* *:･ﾟ✧*:･ﾟ✧'
      }

      await conn.sendMessage(id, {
        image: { url: pp },
        caption: texto,
        mentions: [user]
      })
    }
  }
})