
import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const API = 'https://dv-yer-api.online'
const APIKEY = 'dvyer356363943798'
const SEARCH_LIMIT = 10

const _processing = new Set()

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*
│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}
╰───────────────⬣`
}

function safeText(t, max = 55) {
  return String(t || '').trim().slice(0, max)
}

function buildSpotifySearch(q) {
  return `${API}/spotifysearch?q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}&lang=es18&apikey=${APIKEY}`
}

function buildSpotifyDownload(query) {
  return `${API}/spotify?q=${encodeURIComponent(query)}&mode=link&pick=1&limit=10&apikey=${APIKEY}`
}

// 🔓 Desenvuelve mensajes ephemeral/viewOnce
function unwrapMessage(message) {
  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension'
  ]
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find(w => msg[w])
    if (!key) break
    msg = msg[key].message
    guard++
  }
  return msg
}

// 🔎 Extrae ID de botones/carrusel
function extractSelectedId(content) {
  const nativeFlow = content?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (nativeFlow?.paramsJson) {
    try {
      const data = JSON.parse(nativeFlow.paramsJson)
      return data.id || data.selectedId || data.selectedRowId || null
    } catch {}
  }

  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId

  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId

  const templateReply = content?.templateButtonReplyMessage
  if (templateReply?.selectedId) return templateReply.selectedId

  return null
}

// 🎵 Construye una tarjeta del carrusel
async function construirTarjetaSpotify(conn, track) {
  let media = null

  if (track.image) {
    try {
      media = await prepareWAMessageMedia(
        { image: { url: track.image } },
        { upload: conn.waUploadToServer }
      )
    } catch {}
  }

  const query = `${track.title} ${track.artist || ''}`.trim()
  const q64 = Buffer.from(query).toString('base64')

  return {
    header: {
      title: '',
      hasMediaAttachment: !!media,
      imageMessage: media?.imageMessage
    },
    body: {
      text:
        `╭─⪼ 🌿
│ 🎵 ${safeText(track.title)}
│ 👤 ${safeText(track.artist || 'Desconocido', 40)}
│ ⏱️ ${track.duration || '?'}
╰───────────────⬣`
    },
    nativeFlowMessage: {
      buttons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🎧 Audio',
            id: `spdl~${q64}`
          })
        }
      ]
    }
  }
}

// 🎠 Envía carrusel
async function enviarCarrusel(conn, m, resultados, bodyText) {
  const cards = []

  for (const track of resultados) {
    cards.push(await construirTarjetaSpotify(conn, track))
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    body: { text: bodyText },
    footer: { text: '🌿 SAITAMA-BOT' },
    header: { title: '', hasMediaAttachment: false },
    carouselMessage: { cards }
  })

  const msg = generateWAMessageFromContent(
    m.chat,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {},
          interactiveMessage
        }
      }
    },
    { quoted: m }
  )

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

// 🎵 Comando principal
let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `main_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        `Busca música en Spotify

Usa: ${usedPrefix}${command} <nombre>

Ejemplo:
${usedPrefix}${command} bad bunny`
      )
    }, { quoted: m })
  }

  await m.react('🔍')

  try {
    const res = await fetch(buildSpotifySearch(text))
    const data = await res.json()

    const resultados = data.results || data.data || data.result || []

    if (!Array.isArray(resultados) || !resultados.length) {
      throw new Error('No se encontraron resultados')
    }

    await enviarCarrusel(
      conn,
      m,
      resultados.slice(0, SEARCH_LIMIT),
      `╭─⪼ 🌿
│ 🍃 Resultados para: ${text}
╰───────────────⬣`
    )

    await m.react('✅')

  } catch (e) {
    console.log('[SPOTIFY SEARCH ERROR]', e)
    await m.react('❌')

    await conn.sendMessage(m.chat, {
      text: decorar('No se encontraron resultados')
    }, { quoted: m })
  }
}

// ⬇️ Manejo de botones del carrusel
handler.before = async (m, { conn }) => {
  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id || !id.startsWith('spdl~')) return false

  const msgKey = `before_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true

  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  let query

  try {
    query = Buffer.from(id.split('~')[1], 'base64').toString()
  } catch {
    await conn.sendMessage(m.chat, {
      text: decorar('Error al procesar la selección')
    }, { quoted: m })
    return true
  }

  await m.react('⏳')

  await conn.sendMessage(m.chat, {
    text: decorar('Descargando...')
  }, { quoted: m })

  try {
    const res = await fetch(buildSpotifyDownload(query))
    const json = await res.json()

    if (!json.ok && !json.download_url && !json.url) {
      throw new Error(json.message || json.error || 'No se pudo descargar')
    }

    const audioUrl =
      json.download_url ||
      json.url ||
      json.stream_url

    if (!audioUrl) {
      throw new Error('La API no devolvió un enlace válido')
    }

    const titulo = json.title || query
    const artista = json.artist || 'Desconocido'
    const portada = json.thumbnail || json.image || null

    // 🎧 Enviar audio
    await conn.sendMessage(m.chat, {
      audio: { url: audioUrl },
      mimetype: 'audio/mpeg',
      fileName: `${titulo}.mp3`
    }, { quoted: m })

    // 🖼️ Enviar portada + info
    if (portada) {
      await conn.sendMessage(m.chat, {
        image: { url: portada },
        caption: decorar(
          `Descarga completada

🎵 » ${titulo}
👤 » ${artista}`
        )
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        text: decorar(
          `Descarga completada

🎵 » ${titulo}
👤 » ${artista}`
        )
      }, { quoted: m })
    }

    await m.react('✅')

  } catch (e) {
    console.log('[SPOTIFY DOWNLOAD ERROR]', e)

    await m.react('❌')

    await conn.sendMessage(m.chat, {
      text: decorar(`Error: ${e.message}`)
    }, { quoted: m })
  }

  return true
}

handler.help = ['spotify', 'sp']
handler.tags = ['downloader']
handler.command = /^(spotify|sp)$/i
handler.desc = 'Busca y descarga música de Spotify'

export default handler
