import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import { readdirSync } from 'fs'
import { createRequire } from 'module'
import chalk from 'chalk'
import pino from 'pino'
import NodeCache from 'node-cache'
import { Low, JSONFile } from 'lowdb'
import lodash from 'lodash'
import yargs from 'yargs'
import QRCode from 'qrcode'

import './config.js'
import { eliminarSubbot } from './lib/subbots.js'
import {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { makeWASocket, protoType, serialize } from './lib/simple.js'
import { BAILEYS_VERSION } from './utils/_version.js'

const SUBBOT_ID = process.argv[2]
const NUMERO_PARA_CODIGO = process.argv[3] || null

if (!SUBBOT_ID) {
  console.error('Falta el ID del subbot. Uso: node subbot.js <id> [numero]')
  process.exit(1)
}

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? (/file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL) : pathToFileURL(pathURL).toString()
}
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true))
}
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir)
}

const __dirname = global.__dirname(import.meta.url)

global.opts = new Object(yargs(process.argv.slice(4)).exitProcess(false).parse())
global.prefix = new RegExp('^[' + (opts['prefix'] || 'z/#$%.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

global.db = new Low(new JSONFile(path.join(__dirname, 'storage/databases/database.json')))
global.isDatabaseModified = false
global.markDatabaseModified = () => { global.isDatabaseModified = true }
global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise(resolve =>
      setInterval(async function () {
        if (!global.db.READ) {
          clearInterval(this)
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
        }
      }, 1000)
    )
  }
  if (global.db.data !== null) return
  global.db.READ = true
  await global.db.read().catch(console.error)
  global.db.READ = null
  global.db.data = {
    users: {}, chats: {}, stats: {}, msgs: {}, sticker: {}, settings: {},
    ...(global.db.data || {})
  }
  global.db.chain = lodash.chain(global.db.data)
  const originalSet = global.db.chain.set.bind(global.db.chain)
  global.db.chain.set = (...args) => {
    const result = originalSet(...args)
    global.markDatabaseModified()
    return result
  }
}

protoType()
serialize()

await global.loadDatabase()

const CARPETA_SUBBOT = path.join(__dirname, 'subbots', SUBBOT_ID)
const CARPETA_SESION = path.join(CARPETA_SUBBOT, 'session')
const RUTA_STATUS = path.join(CARPETA_SUBBOT, 'status.json')

if (!fs.existsSync(CARPETA_SESION)) fs.mkdirSync(CARPETA_SESION, { recursive: true })

function escribirStatus(datos) {
  try {
    fs.writeFileSync(RUTA_STATUS, JSON.stringify({ ...datos, actualizado: Date.now() }, null, 2))
  } catch (err) {
    console.error(`[subbot ${SUBBOT_ID}] No se pudo escribir status.json:`, err.message)
  }
}

escribirStatus({ estado: 'iniciando' })

const pluginFolder = path.join(__dirname, 'plugins')
const pluginFilter = (filename) => /\.js$/.test(filename)
global.plugins = {}

function walkPluginFiles(dir, base = dir) {
  let results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(walkPluginFiles(fullPath, base))
    } else if (pluginFilter(entry.name)) {
      const relPath = path.relative(base, fullPath).split(path.sep).join('/')
      results.push({ relPath, fullPath })
    }
  }
  return results
}

async function cargarPlugins() {
  let loaded = 0
  for (const { relPath, fullPath } of walkPluginFiles(pluginFolder)) {
    try {
      const file = global.__filename(fullPath)
      const module = await import(file)
      global.plugins[relPath] = module.default || module
      loaded++
    } catch (e) {
      console.error(`[subbot ${SUBBOT_ID}] Error al cargar el plugin '${relPath}':`, e.message)
      delete global.plugins[relPath]
    }
  }
  console.log(chalk.green(`[subbot ${SUBBOT_ID}] ${loaded} plugins cargados`))
}

await cargarPlugins()

const handlerModule = await import('./handler.js')
const handler = handlerModule.handler

const necesitaVincular = !!NUMERO_PARA_CODIGO
const esModoQR = NUMERO_PARA_CODIGO === 'qr'

let sock = null
let stateRef = null
let saveCredsRef = null
let timeoutConexion = null
let timeoutCodigo = null
let pidiendoCodigo = false
let reconectando = false
let finalizado = false
let conectado = false

function normalizarNumero(numero) {
  return String(numero || '').replace(/\D/g, '')
}

async function limpiarSocketActual() {
  if (!sock) return
  try { sock.ev.removeAllListeners('messages.upsert') } catch {}
  try { sock.ev.removeAllListeners('creds.update') } catch {}
  try { sock.ev.removeAllListeners('connection.update') } catch {}
  try { sock.ws?.close() } catch {}
  sock = null
}

function limpiarTimers() {
  if (timeoutConexion) {
    clearTimeout(timeoutConexion)
    timeoutConexion = null
  }
  if (timeoutCodigo) {
    clearTimeout(timeoutCodigo)
    timeoutCodigo = null
  }
}

async function finalizarSubbot(estado, extra = {}) {
  if (finalizado) return
  finalizado = true
  limpiarTimers()

  try {
    escribirStatus({ estado, ...extra })
  } catch {}

  try {
    await limpiarSocketActual()
  } catch {}

  setTimeout(() => {
    try {
      eliminarSubbot(SUBBOT_ID)
    } catch (e) {
      console.error(`[subbot ${SUBBOT_ID}] Error al eliminar subbot:`, e.message)
    } finally {
      process.exit(0)
    }
  }, 500)
}

function iniciarTemporizadorConexion() {
  limpiarTimers()
  timeoutConexion = setTimeout(() => {
    if (!conectado && !finalizado) {
      console.log(`[subbot ${SUBBOT_ID}] No conectó en 90 segundos. Eliminando subbot...`)
      finalizarSubbot('expirado', { error: 'Tiempo de conexión agotado' })
    }
  }, 90000)
}

function iniciarTemporizadorCodigo() {
  if (timeoutCodigo) clearTimeout(timeoutCodigo)
  timeoutCodigo = setTimeout(() => {
    if (!conectado && !finalizado) {
      console.log(`[subbot ${SUBBOT_ID}] El código expiró o no se vinculó a tiempo. Eliminando subbot...`)
      finalizarSubbot('expirado', { error: 'Código expirado o no utilizado a tiempo' })
    }
  }, 90000)
}

async function pedirCodigoDeVinculacion() {
  if (pidiendoCodigo || finalizado || !sock || !stateRef) return
  pidiendoCodigo = true

  const numero = normalizarNumero(NUMERO_PARA_CODIGO)
  if (!numero || esModoQR) {
    pidiendoCodigo = false
    return
  }

  let codigo = null
  let ultimoError = null

  for (let intento = 1; intento <= 3 && !codigo && !finalizado; intento++) {
    try {
      if (intento === 1) {
        await new Promise(resolve => setTimeout(resolve, 4000))
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000 * intento))
      }

      if (!sock || stateRef.creds.registered) break
      codigo = await sock.requestPairingCode(numero)
    } catch (err) {
      ultimoError = err
      console.error(`[subbot ${SUBBOT_ID}] Intento ${intento} de pedir código falló:`, err?.message || err)
    }
  }

  pidiendoCodigo = false

  if (finalizado || stateRef.creds.registered) return

  if (!codigo) {
    return finalizarSubbot('expirado', {
      error: ultimoError?.message || 'No se pudo obtener el código después de varios intentos'
    })
  }

  escribirStatus({ estado: 'esperando_codigo', codigo })
  iniciarTemporizadorCodigo()
  console.log(`[subbot ${SUBBOT_ID}] Código de vinculación: ${codigo}`)
}

async function iniciarSubbot() {
  if (finalizado || reconectando) return
  reconectando = true
  conectado = false

  await limpiarSocketActual()

  const { state, saveCreds } = await useMultiFileAuthState(CARPETA_SESION)
  stateRef = state
  saveCredsRef = saveCreds

  const logger = pino({ level: 'fatal' })

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    version: BAILEYS_VERSION,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    msgRetryCache: new NodeCache()
  })

  sock.handler = handler.bind(sock)
  sock.ev.on('messages.upsert', sock.handler)
  sock.ev.on('creds.update', saveCredsRef)

  iniciarTemporizadorConexion()
  reconectando = false

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (finalizado) return

    if (necesitaVincular && esModoQR && qr) {
      try {
        const rutaQR = path.join(CARPETA_SUBBOT, 'qr.png')
        await QRCode.toFile(rutaQR, qr, { width: 400 })
        escribirStatus({ estado: 'esperando_qr', qrPath: rutaQR })
        iniciarTemporizadorCodigo()
        console.log(`[subbot ${SUBBOT_ID}] QR generado.`)
      } catch (err) {
        return finalizarSubbot('error', { error: 'No se pudo generar el QR: ' + err.message })
      }
    }

    if (
      necesitaVincular &&
      !esModoQR &&
      !state.creds.registered &&
      (connection === 'connecting' || !!qr)
    ) {
      pedirCodigoDeVinculacion().catch(err => {
        console.error(`[subbot ${SUBBOT_ID}] Error al pedir código:`, err?.message || err)
      })
    }

    if (connection === 'open') {
      conectado = true
      limpiarTimers()
      escribirStatus({
        estado: 'conectado',
        numero: sock.user?.id?.split(':')[0] || null
      })
      console.log(`[subbot ${SUBBOT_ID}] Conectado correctamente.`)
      return
    }

    if (connection === 'close') {
      const codigoError =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.output?.payload?.statusCode

      if (codigoError === DisconnectReason.loggedOut) {
        console.log(`[subbot ${SUBBOT_ID}] Sesión cerrada (logout). Eliminando subbot...`)
        return finalizarSubbot('desconectado', { error: 'Sesión cerrada por WhatsApp' })
      }

      if (codigoError === DisconnectReason.restartRequired) {
        console.log(`[subbot ${SUBBOT_ID}] Reinicio requerido. Recreando socket...`)
        escribirStatus({ estado: 'reconectando', motivo: 'restartRequired' })
        return iniciarSubbot()
      }

      console.log(`[subbot ${SUBBOT_ID}] Conexión cerrada (${codigoError || 'sin código'}). Reintentando...`)
      escribirStatus({ estado: 'reconectando', motivo: codigoError || 'close' })

      setTimeout(() => {
        if (!finalizado) iniciarSubbot().catch(console.error)
      }, 3000)

      return
    }
  })
}

iniciarSubbot().catch(err => {
  console.error(`[subbot ${SUBBOT_ID}] Error fatal al iniciar:`, err)
  escribirStatus({ estado: 'error', error: err.message })
  process.exit(1)
})

process.on('uncaughtException', async (err) => {
  console.error(`[subbot ${SUBBOT_ID}] Error no capturado:`, err)
  await finalizarSubbot('error', { error: err?.message || String(err) })
})

process.on('unhandledRejection', async (err) => {
  console.error(`[subbot ${SUBBOT_ID}] Promesa rechazada sin capturar:`, err)
  await finalizarSubbot('error', { error: err?.message || String(err) })
})

process.on('SIGINT', async () => {
  await finalizarSubbot('detenido', { error: 'Proceso interrumpido' })
})

process.on('SIGTERM', async () => {
  await finalizarSubbot('detenido', { error: 'Proceso terminado' })
})
