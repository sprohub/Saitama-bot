import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEOS_DIR = path.join(__dirname, '..', '..', 'lib', 'videos')
const FILAS_POR_SECCION = 10
const EXTENSIONES_VALIDAS = ['.mp4', '.mkv', '.mov', '.webm']

global.__adpPending = global.__adpPending || {}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function unwrapMessage(message) {
  if (!message) return message
  if (message.ephemeralMessage) return unwrapMessage(message.ephemeralMessage.message)
  if (message.viewOnceMessage) return unwrapMessage(message.viewOnceMessage.message)
  if (message.viewOnceMessageV2) return unwrapMessage(message.viewOnceMessageV2.message)
  return message
}

function extractSelectedId(content) {
  const msg = unwrapMessage(content.message)
  const interactive = msg?.interactiveResponseMessage
  if (!interactive) return null
  try {
    const params = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson)
    return params.id || null
  } catch {
    return null
  }
}

function listarVideos() {
  if (!fs.existsSync(VIDEOS_DIR)) return []
  return fs.readdirSync(VIDEOS_DIR)
    .filter(f => EXTENSIONES_VALIDAS.includes(path.extname(f).toLowerCase()))
    .sort()
}

function getChatConfig(chatId) {
  if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {}
  return global.db.data.chats[chatId]
}

const handler = async (m, { conn, text, isAdmin }) => {
  const sub = (text || '').trim().toLowerCase()
  const chat = getChatConfig(m.chat)

  // --- Activar / desactivar (solo admins, solo dentro de grupo) ---
  if (sub === 'on' || sub === 'off') {
    if (!m.isGroup) {
      return conn.sendMessage(m.chat, { text: decorar('Esto solo se puede activar dentro de un grupo.') }, { quoted: m })
    }
    if (!isAdmin) {
      return conn.sendMessage(m.chat, { text: decorar('Solo un admin puede activar/desactivar esto.') }, { quoted: m })
    }

    chat.adpActivo = sub === 'on'

    return conn.sendMessage(m.chat, {
      text: decorar(sub === 'on' ? '🟢 Menú de videos activado en este grupo.' : '⚪ Menú de videos desactivado en este grupo.')
    }, { quoted: m })
  }

  // --- Mostrar el menú ---
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, { text: decorar('Esto solo funciona dentro de un grupo.') }, { quoted: m })
  }
  if (!chat.adpActivo) {
    return conn.sendMessage(m.chat, { text: decorar('El menú de videos está desactivado en este grupo. Un admin puede activarlo con .adp on') }, { quoted: m })
  }

  const videos = listarVideos()
  if (!videos.length) {
    return conn.sendMessage(m.chat, { text: decorar('No hay videos disponibles todavía.') }, { quoted: m })
  }

  const sessionId = `adp_${m.chat}_${Date.now()}`
  global.__adpPending[sessionId] = { videos, chat: m.chat, timestamp: Date.now() }

  const sections = []
  for (let i = 0; i < videos.length; i += FILAS_POR_SECCION) {
    const chunk = videos.slice(i, i + FILAS_POR_SECCION)
    const desde = i + 1
    const hasta = i + chunk.length

    sections.push({
      title: `📹 Videos 🥵 ${desde}-${hasta}`,
      rows: chunk.map((archivo, idx) => ({
        title: `🎬 ${path.parse(archivo).name}`.slice(0, 60),
        description: 'Toca para recibir este video',
        id: `adp_video|${sessionId}|${i + idx}`
      }))
    })
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT · Videos',
      subtitle: `${videos.length} disponibles`,
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: decorar('Elige un video para recibirlo 🥵👇')
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎬 Elegir video',
          sections
        })
      }]
    })
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { interactiveMessage } }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['adp']
handler.help = ['adp on/off (activa el menú por grupo) · adp (muestra el menú)']
handler.tags = ['group']
handler.customPrefix = /^[.\/#@]/i

handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId || !selectedId.startsWith('adp_video|')) return false

  const [, sessionId, indexStr] = selectedId.split('|')
  const session = global.__adpPending[sessionId]

  if (!session) {
    await conn.sendMessage(m.chat, { text: decorar('⌛ Este menú expiró. Vuelve a usar .adp.') }, { quoted: m })
    return true
  }

  const chat = getChatConfig(session.chat)
  if (!chat.adpActivo) {
    await conn.sendMessage(m.chat, { text: decorar('El menú de videos se desactivó en este grupo.') }, { quoted: m })
    return true
  }

  const archivo = session.videos[Number(indexStr)]
  if (!archivo) {
    await conn.sendMessage(m.chat, { text: decorar('❌ No encontré ese video.') }, { quoted: m })
    return true
  }

  const rutaCompleta = path.join(VIDEOS_DIR, archivo)
  if (!fs.existsSync(rutaCompleta)) {
    await conn.sendMessage(m.chat, { text: decorar('❌ El archivo ya no está disponible.') }, { quoted: m })
    return true
  }

  try {
    await conn.sendMessage(m.chat, {
      video: fs.readFileSync(rutaCompleta),
      mimetype: 'video/mp4',
      caption: decorar(path.parse(archivo).name)
    }, { quoted: m })
  } catch (e) {
    console.error('[adp] ERROR enviando video:', e)
    await conn.sendMessage(m.chat, { text: decorar('❌ No se pudo enviar el video.') }, { quoted: m })
  }

  return true
}

export default handler
