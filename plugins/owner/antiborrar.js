import { proto } from '@whiskeysockets/baileys'

global.__antideleteCache = global.__antideleteCache || {}
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 horas

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function chatConfig(chatId) {
  if (!global.db.data.chats) global.db.data.chats = {}
  if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {}
  return global.db.data.chats[chatId]
}

function claveCache(chatId, msgId) {
  return `${chatId}:${msgId}`
}

function limpiarCacheVencida() {
  const ahora = Date.now()
  for (const key of Object.keys(global.__antideleteCache)) {
    if (ahora - global.__antideleteCache[key].fecha > CACHE_TTL_MS) delete global.__antideleteCache[key]
  }
}

// 💾 Guarda en memoria el contenido del mensaje apenas llega, por si luego lo borran
async function guardarEnCache(m) {
  const msg = m.message
  if (!msg) return
  const id = m.key?.id || m.id
  if (!id) return

  let entrada = null
  try {
    if (msg.conversation || msg.extendedTextMessage?.text) {
      entrada = { tipo: 'texto', texto: msg.conversation || msg.extendedTextMessage.text }
    } else if (msg.imageMessage) {
      entrada = { tipo: 'imagen', buffer: await m.download(), caption: msg.imageMessage.caption || '' }
    } else if (msg.videoMessage) {
      entrada = { tipo: 'video', buffer: await m.download(), caption: msg.videoMessage.caption || '' }
    } else if (msg.stickerMessage) {
      entrada = { tipo: 'sticker', buffer: await m.download() }
    } else if (msg.audioMessage) {
      entrada = { tipo: 'audio', buffer: await m.download(), ptt: !!msg.audioMessage.ptt }
    } else if (msg.documentMessage) {
      entrada = {
        tipo: 'documento',
        buffer: await m.download(),
        fileName: msg.documentMessage.fileName || 'archivo',
        mimetype: msg.documentMessage.mimetype
      }
    } else {
      return
    }
  } catch (e) {
    console.error('[antidelete] error guardando en caché:', e)
    return
  }

  entrada.sender = m.sender
  entrada.fecha = Date.now()
  global.__antideleteCache[claveCache(m.chat, id)] = entrada
}

// ♻️ Reenvía el mensaje guardado cuando detectamos que fue borrado
async function reenviarBorrado(conn, chatId, entrada, borradoPor) {
  const nombreOriginal = '@' + entrada.sender.split('@')[0]
  const esOtroQuienBorro = borradoPor && borradoPor !== entrada.sender
  const nombreBorro = esOtroQuienBorro ? '@' + borradoPor.split('@')[0] : null

  const mentions = [entrada.sender]
  if (esOtroQuienBorro) mentions.push(borradoPor)

  let encabezado = `Mensaje eliminado\nAutor: ${nombreOriginal}`
  if (nombreBorro) encabezado += `\nBorrado por: ${nombreBorro}`

  try {
    if (entrada.tipo === 'texto') {
      await conn.sendMessage(chatId, { text: decorar(`${encabezado}\n\n${entrada.texto}`), mentions })
    } else if (entrada.tipo === 'imagen') {
      await conn.sendMessage(chatId, {
        image: entrada.buffer,
        caption: decorar(encabezado + (entrada.caption ? '\n\n' + entrada.caption : '')),
        mentions
      })
    } else if (entrada.tipo === 'video') {
      await conn.sendMessage(chatId, {
        video: entrada.buffer,
        caption: decorar(encabezado + (entrada.caption ? '\n\n' + entrada.caption : '')),
        mentions
      })
    } else if (entrada.tipo === 'sticker') {
      await conn.sendMessage(chatId, { text: decorar(encabezado), mentions })
      await conn.sendMessage(chatId, { sticker: entrada.buffer })
    } else if (entrada.tipo === 'audio') {
      await conn.sendMessage(chatId, { text: decorar(encabezado), mentions })
      await conn.sendMessage(chatId, { audio: entrada.buffer, mimetype: 'audio/mp4', ptt: entrada.ptt })
    } else if (entrada.tipo === 'documento') {
      await conn.sendMessage(chatId, { text: decorar(encabezado), mentions })
      await conn.sendMessage(chatId, { document: entrada.buffer, fileName: entrada.fileName, mimetype: entrada.mimetype })
    }
  } catch (e) {
    console.error('[antidelete] error reenviando:', e)
  }
}

let handler = async (m, { conn, text, isAdmin }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, { text: decorar('Solo para grupos') }, { quoted: m })
  }
  if (!isAdmin) {
    return conn.sendMessage(m.chat, { text: decorar('Solo administradores') }, { quoted: m })
  }

  const input = (text || '').trim().toLowerCase()
  const cfg = chatConfig(m.chat)

  if (input === 'on') {
    cfg.antidelete = true
    global.markDatabaseModified()
    return conn.sendMessage(m.chat, {
      text: decorar('Antidelete activado\nLos mensajes borrados se reenviarán aquí, sin importar quién los borre')
    }, { quoted: m })
  }

  if (input === 'off') {
    cfg.antidelete = false
    global.markDatabaseModified()
    return conn.sendMessage(m.chat, { text: decorar('Antidelete desactivado') }, { quoted: m })
  }

  return conn.sendMessage(m.chat, {
    text: decorar(`Estado actual: ${cfg.antidelete ? 'Activado' : 'Desactivado'}\n\nUsa:\n.antidelete on\n.antidelete off`)
  }, { quoted: m })
}

// 🕵️ Corre con CADA mensaje que pasa por el bot: guarda contenido nuevo,
// y detecta cuándo un mensaje anterior fue borrado (por su autor o por un admin)
handler.before = async (m, { conn }) => {
  limpiarCacheVencida()

  const msg = m.message
  if (!msg || !m.isGroup) return false

  const cfg = chatConfig(m.chat)

  // Un "protocolMessage" tipo REVOKE es lo que WhatsApp manda cuando alguien borra
  // un mensaje para todos, sin importar si fue el propio autor o un admin del grupo
  if (msg.protocolMessage?.type === proto.Message.ProtocolMessage.Type.REVOKE) {
    const keyOriginal = msg.protocolMessage.key
    if (!keyOriginal?.id || !cfg.antidelete) return false

    const clave = claveCache(m.chat, keyOriginal.id)
    const entrada = global.__antideleteCache[clave]
    if (!entrada) return false

    const borradoPor = m.sender
    await reenviarBorrado(conn, m.chat, entrada, borradoPor)
    delete global.__antideleteCache[clave]
    return false
  }

  if (cfg.antidelete) {
    await guardarEnCache(m)
  }

  return false
}

handler.help = ['antidelete <on/off>']
handler.tags = ['group']
handler.command = /^(antidelete|antieliminar)$/i
handler.desc = 'Reenvía los mensajes que sean borrados en el grupo, sea el autor o un admin quien los borre'

export default handler
