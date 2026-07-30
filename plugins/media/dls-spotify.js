import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const DVYER_API = 'https://dv-yer-api.online'
const DVYER_APIKEY = 'dvyer356363943798'
const SEARCH_LIMIT = 10

const _processing = new Set()

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function buildSearchUrl(query, limit = SEARCH_LIMIT) {
  return `${DVYER_API}/spotifysearch?q=${encodeURIComponent(query)}&limit=${limit}&lang=es18&apikey=${DVYER_APIKEY}`
}

function buildDownloadUrl(query, pick) {
  return `${DVYER_API}/spotify?q=${encodeURIComponent(query)}&mode=link&pick=${pick}&limit=${SEARCH_LIMIT}&apikey=${DVYER_APIKEY}`
}

// La API puede nombrar los campos distinto según la versión; probamos varias opciones
function campo(obj, ...nombres) {
  for (const n of nombres) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== '') return obj[n]
  }
  return null
}

function isHttpUrl(v) { return /^https?:\/\//i.test(String(v || '')) }
function extractSpotifyUrl(text) {
  const m = String(text || '').match(/https?:\/\/(?:open\.)?spotify\.(?:com|link)\/[^\s]+/i)
  return m ? m[0].trim() : ''
}

function formatDuration(segundos) {
  const s = Number(segundos) || 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// 🔓 Desenvuelve el mensaje si viene envuelto en ephemeral/viewOnce/etc
function unwrapMessage(message) {
  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage'
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

function extractSelectedId(content) {
  const nativeFlow = content?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (nativeFlow?.paramsJson) {
    try {
      const data = JSON.parse(nativeFlow.paramsJson)
      const id = data.id || data.selectedId || data.selectedRowId
      if (id) return id
    } catch (e) {
      console.log('[spotify] error parseando nativeFlow.paramsJson:', e, nativeFlow.paramsJson)
    }
  }

  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId

  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId

  return null
}

// 🍃 Construye una tarjeta del carrusel: portada + info + botón de descarga integrado
async function construirTarjeta(conn, track, queryOriginal, pick) {
  const titulo = campo(track, 'title', 'name', 'track') || 'Desconocido'
  const artista = campo(track, 'artist', 'artists', 'author') || ''
  const duracion = campo(track, 'duration_seconds', 'duration', 'duration_ms')
  const duracionSeg = campo(track, 'duration_ms') ? duracion / 1000 : duracion
  const portada = campo(track, 'image', 'thumbnail', 'cover', 'album_image')

  let media = null
  if (portada) {
    try { media = await prepareWAMessageMedia({ image: { url: portada } }, { upload: conn.waUploadToServer }) } catch {}
  }

  const queryB64 = Buffer.from(queryOriginal).toString('base64')
  const tituloB64 = Buffer.from(String(titulo)).toString('base64')

  return {
    header: {
      title: '',
      hasMediaAttachment: !!media,
      imageMessage: media?.imageMessage
    },
    body: {
      text: decorar(
        `🎵 ${String(titulo).slice(0, 55)}\n` +
        `👤 ${artista}` +
        (duracionSeg ? `\n⏱️ ${formatDuration(duracionSeg)}` : '')
      )
    },
    nativeFlowMessage: {
      buttons: [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬇️ Descargar', id: `spdl~${pick}~${queryB64}~${tituloB64}` }) }
      ]
    }
  }
}

async function enviarCarrusel(conn, m, resultados, queryOriginal, bodyText) {
  const cards = []
  for (let i = 0; i < resultados.length; i++) {
    cards.push(await construirTarjeta(conn, resultados[i], queryOriginal, i + 1))
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    body: { text: bodyText },
    footer: { text: '🍃 SAITAMA-BOT' },
    header: { title: '', hasMediaAttachment: false },
    carouselMessage: { cards }
  })

  const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `sp_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  if (!text?.trim()) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Busca música en Spotify\n\n${usedPrefix}${command} <nombre o link>\nEjemplo: ${usedPrefix}${command} Bad Bunny`)
    }, { quoted: m })
  }

  const input = text.trim()

  if (isHttpUrl(input) && !extractSpotifyUrl(input)) {
    return conn.sendMessage(m.chat, {
      text: decorar('Envía un link válido de Spotify, o el nombre de la canción.')
    }, { quoted: m })
  }

  const consulta = extractSpotifyUrl(input) || input

  await m.react('🔍')

  try {
    const res = await fetch(buildSearchUrl(consulta))
    const data = await res.json()

    const resultados = campo(data, 'results', 'data', 'tracks')
    if (!data.ok && !data.status) throw new Error(data?.message || data?.error || 'No se encontraron resultados')
    if (!resultados?.length) throw new Error('No se encontraron resultados')

    await enviarCarrusel(conn, m, resultados.slice(0, SEARCH_LIMIT), consulta, decorar(`Resultados para: ${input}`))
    await m.react('✅')
  } catch (e) {
    console.error('[spotify] ERROR buscando:', e)
    await m.react('❌')
    conn.sendMessage(m.chat, { text: decorar(e.message || 'No se encontraron resultados') }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id || !id.startsWith('spdl~')) return false

  const msgKey = `spdl_before_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  const parts = id.split('~')
  if (parts.length < 4) {
    await conn.sendMessage(m.chat, { text: decorar('❌ Error al procesar la selección') }, { quoted: m })
    return true
  }

  const pick = parts[1]
  let queryOriginal, titulo
  try {
    queryOriginal = Buffer.from(parts[2], 'base64').toString()
    titulo = Buffer.from(parts[3], 'base64').toString()
  } catch {
    await conn.sendMessage(m.chat, { text: decorar('❌ Error al procesar la selección') }, { quoted: m })
    return true
  }

  await m.react('⏳')
  await conn.sendMessage(m.chat, { text: decorar('Descargando...') }, { quoted: m })

  try {
    const res = await fetch(buildDownloadUrl(queryOriginal, pick))
    const json = await res.json()

    if (!json.ok && !json.status) throw new Error(json?.message || json?.error || 'No se pudo descargar')

    const downloadUrl = campo(json, 'download_url', 'download_url_full', 'url', 'link', 'stream_url')
    if (!downloadUrl) throw new Error('La API no devolvió un link de descarga válido')

    const tituloFinal = campo(json, 'title') || titulo
    const autor = campo(json, 'artist', 'author', 'artists') || ''
    const portada = campo(json, 'image', 'thumbnail', 'cover')

    await conn.sendMessage(m.chat, {
      audio: { url: downloadUrl },
      mimetype: 'audio/mpeg',
      fileName: `${tituloFinal}.mp3`
    }, { quoted: m })

    if (portada) {
      await conn.sendMessage(m.chat, {
        image: { url: portada },
        caption: decorar(`Descarga completada\n\n🎧 ${tituloFinal}\n👤 ${autor}`)
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        text: decorar(`Descarga completada\n\n🎧 ${tituloFinal}\n👤 ${autor}`)
      }, { quoted: m })
    }

    await m.react('✅')
  } catch (e) {
    console.error('[spotify] ERROR descargando:', e)
    await m.react('❌')
    await conn.sendMessage(m.chat, { text: decorar(`Error: ${e.message}`) }, { quoted: m })
  }

  return true
}

handler.help = ['spotify']
handler.tags = ['downloader']
handler.command = /^(spotify|sp)$/i
handler.desc = 'Busca y descarga música de Spotify'

export default handler
