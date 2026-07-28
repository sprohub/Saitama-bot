import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import { spawn } from 'child_process'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const REQUEST_TIMEOUT = 120000
const MAX_VIDEO_BYTES = 1500 * 1024 * 1024
const VIDEO_AS_DOCUMENT_THRESHOLD = 70 * 1024 * 1024

const DVYER_API = 'https://dv-yer-api.online'
const DVYER_APIKEY = 'dvyer356363943798'
const VIDEO_QUALITY = '360p'
const SEARCH_LIMIT = 5

const _processing = new Set()

function safeFileName(name) {
  return String(name || 'media').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'media'
}
function isHttpUrl(v) { return /^https?:\/\//i.test(String(v || '')) }
function extractYouTubeUrl(text) {
  const m = String(text || '').match(/https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i)
  return m ? m[0].trim() : ''
}
function normalizeMp4Name(name) {
  const clean = safeFileName(String(name || 'video').replace(/\.mp4$/i, ''))
  return `${clean || 'video'}.mp4`
}
function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) } catch {}
}
function parseContentDisposition(h) {
  const t = String(h || '')
  const u = t.match(/filename\*=UTF-8''([^;]+)/i)
  if (u?.[1]) { try { return decodeURIComponent(u[1]).replace(/["']/g, '').trim() } catch {} }
  const n = t.match(/filename="?([^"]+)"?/i)
  return n?.[1]?.trim() || ''
}
async function readStreamToText(stream) {
  return new Promise((res, rej) => {
    let d = ''
    stream.on('data', c => (d += c.toString()))
    stream.on('end', () => res(d))
    stream.on('error', rej)
  })
}
function formatDuration(totalSeconds) {
  const s = Number(totalSeconds) || 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function buildDvyerDownloadUrl(endpoint, videoUrl) {
  return `${DVYER_API}/${endpoint}?mode=link&url=${encodeURIComponent(videoUrl)}&apikey=${DVYER_APIKEY}`
}
function buildDvyerSearchUrl(query, limit = SEARCH_LIMIT) {
  return `${DVYER_API}/ytsearch?q=${encodeURIComponent(query)}&limit=${limit}&apikey=${DVYER_APIKEY}`
}
function extraerDownloadUrl(json) {
  return json?.download_url || json?.download_url_full || json?.url || json?.stream_url || json?.stream_url_full || null
}

// 🔓 Desenvuelve el mensaje si viene envuelto en ephemeral/viewOnce/etc,
// que es lo que pasa seguido en grupos y evitaba que se detectara el clic del botón.
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

async function downloadVideo(downloadUrl, outputPath) {
  const response = await axios.get(downloadUrl, {
    responseType: 'stream', timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
    validateStatus: () => true, maxRedirects: 10,
  })
  if (response.status >= 400) {
    const err = await readStreamToText(response.data).catch(() => '')
    throw new Error(err || 'Error al descargar el video')
  }
  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES) response.data.destroy(new Error('Video demasiado grande'))
  })
  try { await pipeline(response.data, fs.createWriteStream(outputPath)) }
  catch (e) { deleteFileSafe(outputPath); throw e }
  if (!fs.existsSync(outputPath)) throw new Error('No se pudo guardar el video')
  const size = fs.statSync(outputPath).size
  if (!size || size < 150000) { deleteFileSafe(outputPath); throw new Error('Video inválido o vacío') }
  const fromHeader = parseContentDisposition(response.headers?.['content-disposition'])
  return { size, fileName: normalizeMp4Name(fromHeader || 'video.mp4') }
}

async function normalizeForWhatsApp(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', inputPath,
      '-vf', 'scale=640:trunc(ow/a/2)*2',
      '-c:v', 'libx264', '-b:v', '800k', '-preset', 'fast',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-loglevel', 'error',
      outputPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    ff.on('error', reject)
    ff.on('close', code => { if (code === 0) resolve(true); else reject(new Error('ffmpeg error')) })
  })
}

async function sendAudio(conn, m, videoUrl, title) {
  const res = await fetch(buildDvyerDownloadUrl('ytmp3', videoUrl))
  const json = await res.json()
  if (!json.ok) throw new Error(json?.message || json?.error || 'No se pudo obtener el audio.')
  const downloadUrl = extraerDownloadUrl(json)
  if (!downloadUrl) throw new Error('La API no devolvió un link de descarga válido.')

  const finalTitle = safeFileName(json.title || title)
  try {
    await conn.sendMessage(m.chat, {
      audio: { url: downloadUrl }, mimetype: json.mime_type || 'audio/mpeg', fileName: (json.filename || finalTitle + '.mp3')
    }, { quoted: m })
  } catch {
    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl }, mimetype: json.mime_type || 'audio/mpeg', fileName: (json.filename || finalTitle + '.mp3')
    }, { quoted: m })
  }
  return finalTitle
}

async function sendVideo(conn, m, videoUrl, title) {
  const res = await fetch(buildDvyerDownloadUrl('ytmp4', videoUrl))
  const json = await res.json()
  if (!json.ok) throw new Error(json?.message || json?.error || 'No se pudo obtener el video.')
  const downloadUrl = extraerDownloadUrl(json)
  if (!downloadUrl) throw new Error('La API no devolvió un link de descarga válido.')

  const finalTitle = safeFileName(json.title || title)
  const rawFile = path.join(TEMP_DIR, `yt_${Date.now()}.mp4`)
  const finalFile = path.join(TEMP_DIR, `yt_final_${Date.now()}.mp4`)
  try {
    const videoInfo = await downloadVideo(downloadUrl, rawFile)
    const finalName = normalizeMp4Name(json.filename || videoInfo.fileName || finalTitle)
    if (videoInfo.size > VIDEO_AS_DOCUMENT_THRESHOLD) {
      await conn.sendMessage(m.chat, {
        document: fs.readFileSync(rawFile), mimetype: 'video/mp4',
        fileName: finalName, caption: `╭─⪼ 🌿\n│ 🎬 ${finalTitle}\n╰───────────────⬣`
      }, { quoted: m })
    } else {
      try {
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(rawFile), mimetype: 'video/mp4',
          fileName: finalName, caption: `╭─⪼ 🌿\n│ 🎬 ${finalTitle}\n╰───────────────⬣`
        }, { quoted: m })
      } catch {
        await normalizeForWhatsApp(rawFile, finalFile)
        const filePath = fs.existsSync(finalFile) ? finalFile : rawFile
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(filePath), mimetype: 'video/mp4',
          fileName: finalName, caption: `╭─⪼ 🌿\n│ 🎬 ${finalTitle}\n╰───────────────⬣`
        }, { quoted: m })
      }
    }
  } finally {
    deleteFileSafe(rawFile)
    deleteFileSafe(finalFile)
  }
  return finalTitle
}

// 🍃 Construye una tarjeta del carrusel: imagen + texto mínimo + botones de audio/video integrados
async function construirTarjeta(conn, v) {
  let media = null
  if (v.thumbnail) {
    try { media = await prepareWAMessageMedia({ image: { url: v.thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
  }

  const tituloCorto = String(v.title || 'Video').slice(0, 55)
  const urlB64 = Buffer.from(v.url).toString('base64')
  const titleB64 = Buffer.from(String(v.title || 'video')).toString('base64')

  return {
    header: {
      title: '',
      hasMediaAttachment: !!media,
      imageMessage: media?.imageMessage
    },
    body: {
      text: `╭─⪼ 🌿\n│ 🎬 ${tituloCorto}\n│ ⏱️ ${formatDuration(v.duration_seconds)}\n╰───────────────⬣`
    },
    nativeFlowMessage: {
      buttons: [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎵 Audio', id: `ytdl~audio~${urlB64}~${titleB64}` }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🎬 Video', id: `ytdl~video~${urlB64}~${titleB64}` }) }
      ]
    }
  }
}

// 🍃 Envía el carrusel (uno o varios resultados) con botones integrados en cada tarjeta
async function enviarCarrusel(conn, m, resultados, bodyText) {
  const cards = []
  for (const v of resultados) {
    cards.push(await construirTarjeta(conn, v))
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    body: { text: bodyText },
    footer: { text: '🌿 SAITAMA-BOT' },
    header: { title: '', hasMediaAttachment: false },
    carouselMessage: { cards }
  })

  const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `main_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  const input = text?.trim()

  if (!input) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿\n` +
        `│ 🎬 Descarga música y video de YouTube\n` +
        `│ 🍃 Usa: ${usedPrefix}${command} <nombre o link>\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  if (isHttpUrl(input) && !extractYouTubeUrl(input)) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿\n│ 🍃 Envía un link válido de YouTube\n╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('🔍')

  if (extractYouTubeUrl(input)) {
    const videoUrl = extractYouTubeUrl(input)
    try {
      await enviarCarrusel(conn, m, [{ url: videoUrl, title: 'Video', duration_seconds: 0, thumbnail: null }],
        `╭─⪼ 🌿\n│ 🍃 Elige cómo descargarlo\n╰───────────────⬣`)
      await m.react('✅')
    } catch (e) {
      await m.react('❌')
      conn.sendMessage(m.chat, { text: `╭─⪼ 🌿\n│ ❌ ${e.message}\n╰───────────────⬣` }, { quoted: m })
    }
    return
  }

  try {
    const res = await fetch(buildDvyerSearchUrl(input, SEARCH_LIMIT))
    const data = await res.json()
    if (!data.ok || !data.results?.length) throw new Error('No se encontraron resultados')

    const resultados = data.results.slice(0, SEARCH_LIMIT)
    await enviarCarrusel(conn, m, resultados, `╭─⪼ 🌿\n│ 🍃 Resultados para: ${input}\n╰───────────────⬣`)
    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    conn.sendMessage(m.chat, { text: `╭─⪼ 🌿\n│ ❌ ${e.message}\n╰───────────────⬣` }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const nativeFlow = content?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  const msgKey = `before_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId || null
  } catch { return false }

  if (!id) return false

  if (id.startsWith('ytdl~')) {
    const parts = id.split('~')
    if (parts.length < 4) {
      await conn.sendMessage(m.chat, { text: `╭─⪼ 🌿\n│ ❌ Error al procesar la selección\n╰───────────────⬣` }, { quoted: m })
      return true
    }
    const tipo     = parts[1]
    const urlB64   = parts[2]
    const titleB64 = parts[3]

    let videoUrl, title
    try {
      videoUrl = Buffer.from(urlB64, 'base64').toString()
      title    = Buffer.from(titleB64, 'base64').toString()
    } catch {
      await conn.sendMessage(m.chat, { text: `╭─⪼ 🌿\n│ ❌ Error al procesar la selección\n╰───────────────⬣` }, { quoted: m })
      return true
    }

    await m.react('⏳')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿\n│ ${tipo === 'audio' ? '🎵' : '🎬'} Descargando...\n╰───────────────⬣`
    }, { quoted: m })

    try {
      let finalTitle
      if (tipo === 'audio') finalTitle = await sendAudio(conn, m, videoUrl, title)
      else finalTitle = await sendVideo(conn, m, videoUrl, title)

      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿\n│ ✅ Descarga completada\n│ ${tipo === 'audio' ? '🎵' : '🎬'} ${finalTitle || title}\n╰───────────────⬣`
      }, { quoted: m })
      await m.react('✅')
    } catch (e) {
      console.error('[YT ERROR]', e.message)
      await m.react('❌')
      const rawMsg = String(e?.message || '').toLowerCase()
      const humanMsg = (rawMsg.includes('502') || rawMsg.includes('503') || rawMsg.includes('bad gateway'))
        ? `╭─⪼ 🌿\n│ ⚠️ El servidor está saturado, intenta más tarde\n╰───────────────⬣`
        : `╭─⪼ 🌿\n│ ❌ ${e.message || 'Error al descargar'}\n╰───────────────⬣`
      await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
    }
    return true
  }

  return false
}

handler.help    = ['yt', 'play', 'video']
handler.tags    = ['downloader']
handler.command = /^(yt|ytmp3|ytmp4|video|mp3|song|play|musica|cancion|youtube)$/i
handler.desc    = 'Descarga audio o video de YouTube gratis'

export default handler
