/**
 * lib/serbot-connect.js
 *
 * Lógica de conexión de UN sub-bot, compartida por:
 * - main.js (reconecta sub-bots ya vinculados al iniciar el bot)
 * - plugins/serbot/serbot.js (crea un sub-bot nuevo con .qr / .code)
 *
 * Antes esta lógica estaba duplicada en los dos archivos por separado
 * (con pequeñas diferencias entre ellos). Este módulo la unifica.
 */

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import pino from 'pino'
import NodeCache from 'node-cache'
import qrcode from 'qrcode'
import { Boom } from '@hapi/boom'
import {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { makeWASocket } from './simple.js'

const rtx = `
*_Saitama-Bot_*

➮ *_VINCULACION POR QR_*
✰ Pasos para vincularte:
✰ 1. Abre WhatsApp en tu telefono
✰ 2. Pulsa Mas opciones → Dispositivos vinculados
✰ 3. Presiona Vincular un dispositivo
✰ 4. Escanea el codigo QR que se mostrara aqui
`.trim()

const rtx2 = `
*_Saitama-Bot_*

➮ *_VINCULACION POR CODIGO DE 8 DIGITOS_*
✰ Pasos para vincularte:
✰ 1. Abre WhatsApp en tu telefono
✰ 2. Pulsa Mas opciones → Dispositivos vinculados
✰ 3. Presiona Vincular un dispositivo
✰ 4. Selecciona Con numero e introduce el codigo mostrado
`.trim()

if (!(global.conns instanceof Array)) global.conns = []

const logger = pino({ level: 'fatal' })

/**
 * Conecta (o reconecta) un sub-bot a partir de su carpeta de sesión.
 *
 * @param {string} botPath - carpeta con (o donde irán) las credenciales
 * @param {object} [opciones]
 * @param {object} [opciones.m] - mensaje que disparó el comando (solo en vinculación NUEVA)
 * @param {object} [opciones.conn] - conexión del bot principal (solo en vinculación NUEVA)
 * @param {string[]} [opciones.args] - argumentos del comando (para detectar --code)
 * @param {string} [opciones.version] - versión de WhatsApp Web a usar (fetchLatestBaileysVersion)
 * @param {object} [opciones.handlerRef] - referencia al handler principal para bind (mismo que usa main.js)
 * @returns {Promise<import('@whiskeysockets/baileys').WASocket>}
 */
export async function conectarSubBot(botPath, opciones = {}) {
  const { m, conn, args = [], version, handlerRef } = opciones
  const esVinculacionNueva = !!(m && conn)

  const mcode = args[0] && /(--code|code)/.test(args[0].trim())
    ? true
    : args[1] && /(--code|code)/.test(args[1].trim())
      ? true
      : false

  if (!fs.existsSync(botPath)) {
    fs.mkdirSync(botPath, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(botPath)

  // Si es una reconexión (no vinculación nueva) y no hay credenciales
  // registradas todavía, no tiene sentido intentar conectar.
  if (!esVinculacionNueva && !state.creds.registered) {
    console.warn(chalk.yellow(`⚠️ [SAITAMA] Sub-bot en ${path.basename(botPath)} no está registrado, se omite.`))
    return null
  }

  const connectionOptions = {
    version,
    logger,
    printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    msgRetryCache: new NodeCache(),
    browser: mcode ? ['Ubuntu', 'Chrome', '110.0.5585.95'] : Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: true,
    syncFullHistory: true,
    retryRequestDelayMs: 10,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
    maxMsgRetryCount: 15,
    appStateMacVerification: { patch: false, snapshot: false },
    getMessage: async () => ''
  }

  let sock = makeWASocket(connectionOptions)
  sock.isInit = false
  let isInit = true
  let txtQR, txtCode, codeBot

  function quitarDeConns() {
    try { sock.ws.close() } catch {}
    sock.ev.removeAllListeners()
    global.conns = global.conns.filter(c => c !== sock)
  }

  async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin, qr } = update
    if (isNewLogin) sock.isInit = false

    // --- Mostrar QR o pedir código (solo en vinculación nueva) ---
    if (qr && esVinculacionNueva) {
      if (!mcode) {
        txtQR = await conn.sendMessage(m.chat, {
          image: await qrcode.toBuffer(qr, { scale: 8 }),
          caption: rtx
        }, { quoted: m })
        if (txtQR?.key) setTimeout(() => conn.sendMessage(m.sender, { delete: txtQR.key }), 30000)
      } else {
        let secret = await sock.requestPairingCode(m.sender.split('@')[0])
        secret = secret.match(/.{1,4}/g)?.join('') || secret

        txtCode = await conn.sendMessage(m.chat, { text: rtx2 }, { quoted: m })
        codeBot = await m.reply(secret)
        console.log(chalk.cyan(`[serbot] Código de emparejamiento: ${secret}`))

        if (txtCode?.key) setTimeout(() => conn.sendMessage(m.sender, { delete: txtCode.key }), 30000)
        if (codeBot?.key) setTimeout(() => conn.sendMessage(m.sender, { delete: codeBot.key }), 30000)
      }
      return
    }

    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode

    if (connection === 'close') {
      const nombre = path.basename(botPath)
      console.error(chalk.red(`💥 [SAITAMA] Sub-bot caído en ${nombre}. Razón: ${reason}`))

      if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 405 || reason === 403) {
        console.log(chalk.red(`❌ [SAITAMA] Desconexión permanente (+${nombre}). Borrando datos.`))
        quitarDeConns()
        try {
          fs.rmSync(botPath, { recursive: true, force: true })
          console.log(chalk.green(`✅ [SAITAMA] Sub-bot eliminado: ${botPath}`))
        } catch (e) {
          console.error(chalk.red(`❌ [ERROR] No se pudo eliminar ${botPath}: ${e}`))
        }
      } else if ([428, 408, 500, 515].includes(reason)) {
        console.log(chalk.magentaBright(`[serbot] (+${nombre}) reconectando...`))
        await recargar(true)
      } else if (reason === 440) {
        console.log(chalk.magentaBright(`[serbot] (+${nombre}) sesión reemplazada por otro dispositivo.`))
      }
    }

    if (connection === 'open') {
      const nombre = path.basename(botPath)
      console.log(chalk.bold.cyanBright(`\n❒⸺⸺⸺⸺【• SUB-BOT •】⸺⸺⸺⸺❒\n│\n│ 🟢 (+${nombre}) conectado exitosamente.\n│\n❒⸺⸺⸺【• CONECTADO •】⸺⸺⸺❒`))
      sock.isInit = true
      if (!global.conns.includes(sock)) global.conns.push(sock)
      await seguirCanales(sock)
    }
  }

  // Revisa cada minuto si el socket sigue vivo; si no, lo limpia
  setInterval(() => {
    if (!sock.user) quitarDeConns()
  }, 60000)

  async function recargar(reiniciarConexion) {
    if (reiniciarConexion) {
      try { sock.ws.close() } catch {}
      sock.ev.removeAllListeners()
      sock = makeWASocket(connectionOptions)
      isInit = true
    }
    if (!isInit) {
      sock.ev.off('messages.upsert', sock.handler)
      sock.ev.off('connection.update', sock.connectionUpdate)
      sock.ev.off('creds.update', sock.credsUpdate)
    }

    if (handlerRef) {
      sock.handler = handlerRef.bind(sock)
      sock.ev.on('messages.upsert', sock.handler)
    }
    sock.connectionUpdate = connectionUpdate.bind(sock)
    sock.credsUpdate = saveCreds.bind(sock, true)
    sock.ev.on('connection.update', sock.connectionUpdate)
    sock.ev.on('creds.update', sock.credsUpdate)
    isInit = false
  }

  await recargar(false)
  return sock
}

async function seguirCanales(conn) {
  if (!global.ch) return
  for (const channelId of Object.values(global.ch)) {
    await conn.newsletterFollow(channelId).catch(() => {})
  }
}
