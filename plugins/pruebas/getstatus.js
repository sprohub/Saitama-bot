// 📦 Caché en memoria de los últimos estados vistos, por número.
// Solo guarda estados que pasen por el bot MIENTRAS está conectado.
global.__statusCache = global.__statusCache || {}

const VIGENCIA_MS = 24 * 60 * 60 * 1000 // igual que WhatsApp: 24h

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function normalizarJid(input) {
  let numero = String(input || '').replace(/[^0-9]/g, '')
  if (!numero) return null
  return numero + '@s.whatsapp.net'
}

function limpiarCacheVencida() {
  const ahora = Date.now()
  for (const jid of Object.keys(global.__statusCache)) {
    if (ahora - global.__statusCache[jid].fecha > VIGENCIA_MS) {
      delete global.__statusCache[jid]
    }
  }
}

// 🎯 Captura CUALQUIER estado que pase por el bot (chat status@broadcast) y lo guarda en caché
let handler = async (m, { conn, text, args }) => {
  const entrada = (args && args[0]) || text?.trim()

  if (!entrada) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        'Obtiene el último estado guardado de un número\n\n' +
        'Uso: .getstatus <número>\n' +
        'Ejemplo: .getstatus 573001234567\n\n' +
        'Nota: solo funciona con estados publicados mientras el bot está conectado, y de números que permitan ver su estado'
      )
    }, { quoted: m })
  }

  const jid = normalizarJid(entrada)
  if (!jid) {
    return conn.sendMessage(m.chat, { text: decorar('Número inválido') }, { quoted: m })
  }

  limpiarCacheVencida()
  const estado = global.__statusCache[jid]

  if (!estado) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        'No tengo ningún estado guardado de ese número\n' +
        'Debe subir un estado nuevo mientras el bot esté encendido para poder capturarlo'
      )
    }, { quoted: m })
  }

  const nombreCorto = jid.split('@')[0]
  const antiguedadMin = Math.floor((Date.now() - estado.fecha) / 60000)

  try {
    if (estado.tipo === 'imagen') {
      await conn.sendMessage(m.chat, {
        image: estado.buffer,
        caption: decorar(`Estado de @${nombreCorto}\nCapturado hace ${antiguedadMin} min${estado.caption ? '\n\n' + estado.caption : ''}`),
        mentions: [jid]
      }, { quoted: m })
    } else if (estado.tipo === 'video') {
      await conn.sendMessage(m.chat, {
        video: estado.buffer,
        caption: decorar(`Estado de @${nombreCorto}\nCapturado hace ${antiguedadMin} min${estado.caption ? '\n\n' + estado.caption : ''}`),
        mentions: [jid]
      }, { quoted: m })
    } else if (estado.tipo === 'audio') {
      await conn.sendMessage(m.chat, {
        audio: estado.buffer,
        mimetype: 'audio/mp4',
        ptt: false
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        text: decorar(`Estado de @${nombreCorto}\nCapturado hace ${antiguedadMin} min\n\n${estado.texto || ''}`),
        mentions: [jid]
      }, { quoted: m })
    }
  } catch (e) {
    console.error('[getstatus] error enviando estado guardado:', e)
    await conn.sendMessage(m.chat, { text: decorar('Error al enviar el estado guardado') }, { quoted: m })
  }
}

// 🕵️ Se ejecuta con CADA mensaje que llega al bot; filtramos solo los que vienen del broadcast de estados
handler.before = async (m, { conn }) => {
  if (m.chat !== 'status@broadcast') return false
  if (!m.message || !m.sender) return false

  try {
    const msg = m.message
    let entrada = null

    if (msg.imageMessage) {
      entrada = {
        tipo: 'imagen',
        buffer: await m.download(),
        caption: msg.imageMessage.caption || '',
        fecha: Date.now()
      }
    } else if (msg.videoMessage) {
      entrada = {
        tipo: 'video',
        buffer: await m.download(),
        caption: msg.videoMessage.caption || '',
        fecha: Date.now()
      }
    } else if (msg.audioMessage) {
      entrada = {
        tipo: 'audio',
        buffer: await m.download(),
        fecha: Date.now()
      }
    } else if (msg.extendedTextMessage?.text || msg.conversation) {
      entrada = {
        tipo: 'texto',
        texto: msg.extendedTextMessage?.text || msg.conversation || '',
        fecha: Date.now()
      }
    }

    if (entrada) {
      global.__statusCache[m.sender] = entrada
    }
  } catch (e) {
    console.error('[getstatus] error guardando estado en caché:', e)
  }

  // Nunca "consumimos" el mensaje, para no interferir con otros plugins ni con el comportamiento normal
  return false
}

handler.help = ['getstatus <número>']
handler.tags = ['tools']
handler.command = /^(getstatus|estado|verestado|vstatus)$/i
handler.desc = 'Obtiene el último estado guardado de un número (capturado mientras el bot está en línea)'

export default handler
