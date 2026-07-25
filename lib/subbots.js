// lib/subbots.js
//
// Sistema de subbots por PROCESO SEPARADO (PM2), portado desde ALEPANDA-BOT.
// Reemplaza al sistema anterior de "jadibot" que corria todos los subbots
// dentro del mismo proceso (lib/serbot-connect.js, ya no se usa para crear
// subbots nuevos -- ver nota en main.js).
//
// Cada subbot es su propio proceso de PM2, con su propia sesion de WhatsApp
// (carpeta subbots/<id>/session) y su propio status.json para que los
// comandos (.serbot, .addsubbot, etc) puedan consultar como va sin bloquear.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PROYECTO = path.join(__dirname, '..');
const CARPETA_SUBBOTS = path.join(RAIZ_PROYECTO, 'subbots');
const RUTA_REGISTRO = path.join(CARPETA_SUBBOTS, 'registro.json');
const RUTA_SUBBOT_JS = path.join(RAIZ_PROYECTO, 'subbot.js');

function asegurarCarpeta() {
  if (!fs.existsSync(CARPETA_SUBBOTS)) fs.mkdirSync(CARPETA_SUBBOTS, { recursive: true });
}

export function leerRegistro() {
  asegurarCarpeta();
  if (!fs.existsSync(RUTA_REGISTRO)) {
    const inicial = { subbots: {} };
    fs.writeFileSync(RUTA_REGISTRO, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  try {
    return JSON.parse(fs.readFileSync(RUTA_REGISTRO, 'utf-8'));
  } catch {
    return { subbots: {} };
  }
}

export function guardarRegistro(registro) {
  asegurarCarpeta();
  fs.writeFileSync(RUTA_REGISTRO, JSON.stringify(registro, null, 2));
}

// ID unico: hora en base36 + 3 caracteres random, para evitar choques si
// llegan varias peticiones casi al mismo tiempo (con solo Date.now() se
// podian repetir IDs bajo carga).
function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function contarSubbotsDe(creadoPor) {
  const registro = leerRegistro();
  return Object.values(registro.subbots).filter(s => s.creadoPor === creadoPor).length;
}

export function leerStatus(id) {
  const ruta = path.join(CARPETA_SUBBOTS, id, 'status.json');
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch {
    return null;
  }
}

function pm2(args) {
  return new Promise((resolve, reject) => {
    execFile('pm2', args, { cwd: RAIZ_PROYECTO }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

// Crea un subbot nuevo: registra la entrada, y levanta el proceso de PM2
// que se encarga de conectarse y pedir el codigo de vinculacion.
export async function crearSubbotCompleto(numero, creadoPor) {
  asegurarCarpeta();

  const id = nuevoId();
  const nombreProceso = `subbot-${id}`;
  const carpeta = path.join(CARPETA_SUBBOTS, id);
  fs.mkdirSync(carpeta, { recursive: true });

  const registro = leerRegistro();
  registro.subbots[id] = {
    numero,
    creadoPor,
    nombreProceso,
    creado: Date.now(),
    estado: 'iniciando'
  };
  guardarRegistro(registro);

  await pm2(['start', RUTA_SUBBOT_JS, '--name', nombreProceso, '--', id, numero]);

  return { id, nombreProceso };
}

export async function detenerProcesoSubbot(nombreProceso) {
  try {
    await pm2(['delete', nombreProceso]);
  } catch (err) {
    // Si el proceso ya no existe en pm2, no pasa nada -- seguimos con la limpieza de archivos.
    console.error(`No se pudo detener el proceso ${nombreProceso} en PM2 (puede que ya no exista):`, err.message);
  }
}

export function buscarSubbotsPorNumero(numero) {
  const registro = leerRegistro();
  const numeroLimpio = String(numero || '').replace(/[^0-9]/g, '');
  if (!numeroLimpio) return [];
  return Object.entries(registro.subbots).filter(
    ([, info]) => String(info.numero || '').replace(/[^0-9]/g, '') === numeroLimpio
  );
}

export function eliminarSubbot(id) {
  const carpeta = path.join(CARPETA_SUBBOTS, id);
  if (fs.existsSync(carpeta)) fs.rmSync(carpeta, { recursive: true, force: true });
  const registro = leerRegistro();
  delete registro.subbots[id];
  guardarRegistro(registro);
}

export { CARPETA_SUBBOTS };
