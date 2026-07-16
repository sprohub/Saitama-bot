/**
 * plugins/serbot/serbot.js
 * Comandos: .qr / .code
 *
 * Wrapper delgado: valida el comando y la carpeta de sesión, y delega
 * toda la conexión real a lib/serbot-connect.js (compartida con la
 * reconexión automática de main.js al iniciar el bot).
 */

import fs from 'fs'
import path from 'path'
import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { conectarSubBot } from '../../lib/serbot-connect.js'

const JADI_BOT_DIR = 'JadiBots'

let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!global.db.data.users[m.sender]) global.db.data.users[m.sender] = {}
  const userData = global.db.data.users[m.sender]

  const subBotsActivos = (global.conns || []).filter(c => c.user && c.ws?.socket && c.ws.socket.readyState !== 3)
  if (subBotsActivos.length >= 30) {
    return m.reply(`*_Saitama-Bot_*\n\n➮ *_SIN ESPACIO_*\n✰ No hay espacios para Sub-Bots disponibles`)
  }

  let who = m.mentionedJid?.[0] || (m.fromMe ? conn.user.jid : m.sender)
  let id = who.split('@')[0]
  let pathSubBot = path.join(`./${JADI_BOT_DIR}/`, id)

  if (!fs.existsSync(pathSubBot)) {
    fs.mkdirSync(pathSubBot, { recursive: true })
  } else if (!args[0]) {
    // 🧹 Sin creds en base64 = vinculación nueva. Limpia cualquier
    // sesión vieja/inválida para forzar un QR o código fresco.
    const credsPath = path.join(pathSubBot, 'creds.json')
    if (fs.existsSync(credsPath)) {
      fs.rmSync(pathSubBot, { recursive: true, force: true })
      fs.mkdirSync(pathSubBot, { recursive: true })
    }
  }

  // Restaurar sesión desde credenciales en base64 (uso avanzado: .code <base64>)
  if (args[0]) {
    try {
      const credsPath = path.join(pathSubBot, 'creds.json')
      const credsJson = JSON.parse(Buffer.from(args[0], 'base64').toString('utf-8'))
      fs.writeFileSync(credsPath, JSON.stringify(credsJson, null, '\t'))
    } catch {
      return conn.reply(m.chat, `*_Saitama-Bot_*\n\n➮ *_ERROR_*\n✰ Uso correcto: ${usedPrefix + command} code`, m)
    }
  }

  const { version } = await fetchLatestBaileysVersion()

  conectarSubBot(pathSubBot, { m, conn, args, version }).catch(e => {
    console.error('[serbot] ERROR conectando sub-bot:', e)
    m.reply('❌ Ocurrió un error creando el sub-bot. Revisa la consola.')
  })

  userData.Subs = Date.now()
}

handler.help = ['qr', 'code']
handler.tags = ['serbot']
handler.command = ['qr', 'code']
handler.desc = 'ser sub-bot'

export default handler
