import axios from 'axios'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { spawn } from 'child_process'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

// ⚠️ CONFIGURA AQUÍ
const CHANNEL_ID = 'UCnczRUnaWOLBq9SEjDQ-aXg' // <-- tu Channel ID por defecto
const INTERVALO_MINUTOS = 5 // cada cuánto revisa si hay video nuevo

const DB_PATH = path.join(process.cwd(), 'lastVideoId.json')

// ---------- Config de descarga (igual que play.js) ----------
const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const REQUEST_TIMEOUT = 120000
const MAX_VIDEO_BYTES = 1500 * 1024 * 1024
const VIDEO_AS_DOCUMENT_THRESHOLD = 70 * 1024 * 1024
const DELIRIUS_API = 'https://api.delirius.store'
const VIDEO_QUALITY = '360p'

const _processing = new Set()

function leerUltimoId() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')).lastId
  } catch {
    return null
  }
}

function guardarUltimoId(id) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ lastId: id }, null, 2))
}

// ---------- Helpers de archivos (de play.js) ----------
function safeFileName(name) {
  return String(name || 'media').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'media'
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
  const res = await fetch(`${DELIRIUS_API}/download/ytmp3?url=${encodeURIComponent(videoUrl)}`)
  const json = await res.json()
  if (!json.status || !json.data?.download) throw new Error('No se pudo obtener el audio.')
  const finalTitle = safeFileName(json.data.title || title)
  try {
    await conn.sendMessage(m.chat, {
      audio: { url: json.data.download }, mimetype: 'audio/mpeg', fileName: finalTitle + '.mp3'
    }, { quoted: m })
  } catch {
    await conn.sendMessage(m.chat, {
      document: { url: json.data.download }, mimetype: 'audio/mpeg', fileName: finalTitle + '.mp3'
    }, { quoted: m })
  }
  if (json.data.image) {
    await conn.sendMessage(m.chat, {
      image: { url: json.data.image },
      caption: `🎵 ${finalTitle}\n👤 ${json.data.author || ''}`
    }, { quoted: m })
  }
  return finalTitle
}

async function sendVideo(conn, m, videoUrl, title) {
  const res = await fetch(`${DELIRIUS_API}/download/ytmp4?url=${encodeURIComponent(videoUrl)}&format=${VIDEO_QUALITY}`)
  const json = await res.json()
  if (!json.status || !json.data?.download) throw new Error('No se pudo obtener el video.')
  const finalTitle = safeFileName(json.data.title || title)
  const rawFile = path.join(TEMP_DIR, `yt_${Date.now()}.mp4`)
  const finalFile = path.join(TEMP_DIR, `yt_final_${Date.now()}.mp4`)
  try {
    const videoInfo = await downloadVideo(json.data.download, rawFile)
    const finalName = normalizeMp4Name(videoInfo.fileName || finalTitle)
    if (videoInfo.size > VIDEO_AS_DOCUMENT_THRESHOLD) {
      await conn.sendMessage(m.chat, {
        document: fs.readFileSync(rawFile), mimetype: 'video/mp4',
        fileName: finalName, caption: `🎬 ${finalTitle}`
      }, { quoted: m })
    } else {
      try {
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(rawFile), mimetype: 'video/mp4',
          fileName: finalName, caption: `🎬 ${finalTitle}`
        }, { quoted: m })
      } catch {
        await normalizeForWhatsApp(rawFile, finalFile)
        const filePath = fs.existsSync(finalFile) ? finalFile : rawFile
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(filePath), mimetype: 'video/mp4',
          fileName: finalName, caption: `🎬 ${finalTitle}`
        }, { quoted: m })
      }
    }
  } finally {
    deleteFileSafe(rawFile)
    deleteFileSafe(finalFile)
  }
  return finalTitle
}

// 🔎 Resuelve un @handle o nombre de usuario a su Channel ID (UC...)
// scrapeando el HTML público del canal (no requiere API key).
async function resolverChannelId(handleOrName) {
  let handle = handleOrName.trim()
  if (!handle) return null
  handle = handle.replace(/^@/, '')

  const urls = [
    `https://www.youtube.com/@${handle}`,
    `https://www.youtube.com/c/${handle}`,
    `https://www.youtube.com/user/${handle}`,
  ]

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })

      const match = data.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)
      if (match) return match[1]

      const canonical = data.match(/channel\/(UC[a-zA-Z0-9_-]{22})/)
      if (canonical) return canonical[1]
    } catch {
      continue
    }
  }

  return null
}

async function obtenerUltimoVideo(channelId = CHANNEL_ID) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const { data } = await axios.get(url)

  const idMatch = data.match(/<yt:videoId>(.*?)<\/yt:videoId>/)
  const titleMatch = data.match(/<title>(.*?)<\/title>/g)
  const thumbMatch = data.match(/<media:thumbnail url="(.*?)"/)

  if (!idMatch) return null

  const videoId = idMatch[1]
  const titulo = titleMatch && titleMatch[1]
    ? titleMatch[1].replace(/<\/?title>/g, '')
    : 'Nuevo video'
  const link = `https://www.youtube.com/watch?v=${videoId}`
  const thumbnail = thumbMatch ? thumbMatch[1] : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

  return { videoId, titulo, link, thumbnail }
}

// ---------- Selector de formato (botones, igual que play.js) ----------
// Prefijo "uvdl~" (ultimo-video-download) para no chocar con los ids "ytdl~" de play.js
async function _mostrarSelectorFormato(conn, m, video, etiquetaCanal) {
  const urlB64 = Buffer.from(video.link).toString('base64')
  const titleB64 = Buffer.from(video.titulo || 'video').toString('base64')

  let media = null
  if (video.thumbnail) {
    try { media = await prepareWAMessageMedia({ image: { url: video.thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
  }

  const subtitulo = etiquetaCanal ? etiquetaCanal : video.titulo
  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: '🔔 ÚLTIMO VIDEO', subtitle: String(subtitulo || '').slice(0, 60), hasMediaAttachment: !!media, imageMessage: media?.imageMessage },
    body: { text: `╭─⪼ *🎬 ÚLTIMO VIDEO*\n│ 📌 » ${video.titulo}\n│ 🔗 » ${video.link}\n╰───────────────⬣\n\n> ¿Cómo deseas descargarlo?\n> ✅ ¡Completamente gratis!` },
    footer: { text: '⫏⫏ SAITAMA BOT ✿' },
    nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '📥 FORMATO', sections: [{ title: '¿Qué deseas descargar?', rows: [
      { header: '🎵 AUDIO', title: 'Descargar música (MP3)', description: '🎧 Alta calidad | ✅ Gratis', id: `uvdl~audio~${urlB64}~${titleB64}` },
      { header: '🎬 VIDEO', title: 'Descargar video (MP4)', description: `📹 ${VIDEO_QUALITY} | ✅ Gratis`, id: `uvdl~video~${urlB64}~${titleB64}` }
    ] }] }) }] }
  })
  const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

async function revisarCanal(conn) {
  try {
    const ultimo = await obtenerUltimoVideo(CHANNEL_ID)
    if (!ultimo) return

    const idGuardado = leerUltimoId()

    if (idGuardado === null) {
      guardarUltimoId(ultimo.videoId)
      return
    }

    if (ultimo.videoId !== idGuardado) {
      guardarUltimoId(ultimo.videoId)

      const chats = Object.keys(conn.chats || {}).filter(jid => jid.endsWith('@g.us'))

      for (const jid of chats) {
        try {
          const fakeM = { chat: jid }
          await _mostrarSelectorFormato(conn, fakeM, ultimo, '')
          await new Promise(r => setTimeout(r, 1500))
        } catch (e) {
          console.log('Error enviando a', jid, e)
        }
      }
    }
  } catch (e) {
    console.log('Error revisando canal de YouTube:', e.message)
  }
}

if (global.conn) {
  setInterval(() => revisarCanal(global.conn), INTERVALO_MINUTOS * 60 * 1000)
}

// 📌 Handler: .ultimovideo  → usa el canal por defecto (CHANNEL_ID)
//    .ultimovideo @canal → resuelve el handle y muestra su último video
let handler = async (m, { conn, text }) => {
  let channelId = CHANNEL_ID
  let etiquetaCanal = ''

  if (text && text.trim()) {
    await m.reply('🔎 Buscando canal, un momento...')
    const resuelto = await resolverChannelId(text)
    if (!resuelto) {
      return m.reply('❌ No pude encontrar ese canal. Verifica el @nombre e intenta de nuevo.')
    }
    channelId = resuelto
    etiquetaCanal = text.trim()
  }

  const video = await obtenerUltimoVideo(channelId)
  if (!video) return m.reply('No se pudo obtener el último video.')

  await _mostrarSelectorFormato(conn, m, video, etiquetaCanal)
}
handler.command = /^(ultimovideo)$/i
handler.help = ['ultimovideo [@canal]']
handler.tags = ['diversion']
handler.desc = 'Muestra el último video del canal configurado (o de @canal) con botones para descargar audio/video'

// ---------- Captura de los botones (igual patrón que play.js) ----------
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId || null
  } catch { return false }

  if (!id || !id.startsWith('uvdl~')) return false

  const msgKey = `uvdl_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  const parts = id.split('~')
  if (parts.length < 4) {
    await conn.sendMessage(m.chat, { text: '❌ Error al procesar la selección.' }, { quoted: m })
    return true
  }
  const tipo = parts[1]
  const urlB64 = parts[2]
  const titleB64 = parts[3]

  let videoUrl, title
  try {
    videoUrl = Buffer.from(urlB64, 'base64').toString()
    title = Buffer.from(titleB64, 'base64').toString()
  } catch {
    await conn.sendMessage(m.chat, { text: '❌ Error al procesar la selección.' }, { quoted: m })
    return true
  }

  await m.react('⏳')
  await conn.sendMessage(m.chat, {
    text: tipo === 'audio'
      ? `🎵 *Descargando audio...*\n🎧 ${title}\n⏳ Espera un momento...`
      : `🎬 *Descargando video...*\n📹 ${title} (${VIDEO_QUALITY})\n⏳ Espera un momento...`
  }, { quoted: m })

  try {
    let finalTitle
    if (tipo === 'audio') finalTitle = await sendAudio(conn, m, videoUrl, title)
    else finalTitle = await sendVideo(conn, m, videoUrl, title)

    await conn.sendMessage(m.chat, {
      text: `✅ *Descarga completada*\n\n${tipo === 'audio' ? '🎵' : '🎬'} » ${finalTitle || title}`
    }, { quoted: m })
    await m.react('✅')
  } catch (e) {
    console.error('[ULTIMOVIDEO ERROR]', e.message)
    await m.react('❌')
    const rawMsg = String(e?.message || '').toLowerCase()
    const humanMsg = (rawMsg.includes('502') || rawMsg.includes('503') || rawMsg.includes('bad gateway'))
      ? '⚠️ El servidor está saturado.\n🔁 Intenta más tarde.'
      : `❌ ${e.message || 'Error al descargar.'}`
    await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
  }
  return true
}

export default handler
