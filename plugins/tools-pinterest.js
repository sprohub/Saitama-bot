import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const REQUEST_TIMEOUT = 90000          // ⚡ Reducido de 120s a 90s
const MAX_FILE_BYTES  = 500 * 1024 * 1024
const DELIRIUS_API    = 'https://api.delirius.store'
const HD_TIMEOUT      = 4000           // ⚡ Máximo 4s esperando HD por imagen

const _processing = new Set()

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isHttpUrl(v)      { return /^https?:\/\//i.test(String(v || '')) }
function isPinterestUrl(v) { return /pinterest\.(com|es|co\.uk|fr|de|jp)|pin\.it/i.test(String(v || '')) }
function deleteFileSafe(fp){ try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) } catch {} }

// ─── Descarga de archivo a disco ─────────────────────────────────────────────
async function downloadFile(url, outputPath) {
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
    validateStatus: () => true,
    maxRedirects: 10,
  })
  if (response.status >= 400) throw new Error('Error al descargar el archivo')
  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_FILE_BYTES) response.data.destroy(new Error('Archivo demasiado grande'))
  })
  try { await pipeline(response.data, fs.createWriteStream(outputPath)) }
  catch (e) { deleteFileSafe(outputPath); throw e }
  const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
  if (size < 1000) { deleteFileSafe(outputPath); throw new Error('Archivo inválido o vacío') }
  return size
}

// ─── API Pinterest (con timeout corto) ───────────────────────────────────────
async function getPinterestData(pinUrl, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res  = await fetch(`${DELIRIUS_API}/download/pinterestdl?url=${encodeURIComponent(pinUrl)}`, { signal: controller.signal })
    const json = await res.json()
    if (!json.status) throw new Error(json.message || 'No se pudo obtener el pin')
    return json.data || json
  } finally {
    clearTimeout(timer)
  }
}

// ─── Enviar imagen ────────────────────────────────────────────────────────────
async function sendPinterestImage(conn, m, imageUrl, caption) {
  await conn.sendMessage(m.chat, { image: { url: imageUrl }, caption }, { quoted: m })
}

// ─── Enviar video ─────────────────────────────────────────────────────────────
async function sendPinterestVideo(conn, m, videoUrl, caption) {
  const tmpFile = path.join(TEMP_DIR, `pin_${Date.now()}.mp4`)
  try {
    const size = await downloadFile(videoUrl, tmpFile)
    const buf  = fs.readFileSync(tmpFile)
    if (size > 70 * 1024 * 1024) {
      await conn.sendMessage(m.chat, { document: buf, mimetype: 'video/mp4', fileName: 'pinterest_video.mp4', caption }, { quoted: m })
    } else {
      try {
        await conn.sendMessage(m.chat, { video: buf, mimetype: 'video/mp4', caption }, { quoted: m })
      } catch {
        await conn.sendMessage(m.chat, { document: buf, mimetype: 'video/mp4', fileName: 'pinterest_video.mp4', caption }, { quoted: m })
      }
    }
  } finally {
    deleteFileSafe(tmpFile)
  }
}

// ─── Búsqueda en Pinterest ────────────────────────────────────────────────────
async function searchPinterest(query) {
  const res  = await fetch(`${DELIRIUS_API}/search/pinterestv2?text=${encodeURIComponent(query)}`, { timeout: REQUEST_TIMEOUT })
  const json = await res.json()
  if (!json.status || !json.data?.length) throw new Error('No se encontraron resultados en Pinterest')
  return json.data.slice(0, 10)
}

// ─── Resolver URL HD con timeout corto (no bloquea si tarda) ─────────────────
async function resolveHdUrl(r, fallback) {
  const pinUrl = r.pin || r.pinUrl || r.link || r.url || null
  if (pinUrl && isPinterestUrl(pinUrl)) {
    try {
      const data = await getPinterestData(pinUrl, HD_TIMEOUT)
      return data.image || data.imageUrl || data.image_url || fallback
    } catch {}
  }
  return fallback
}

// ─── Menú interactivo ─────────────────────────────────────────────────────────
async function sendMenu(conn, m, usedPrefix, command) {
  let media = null
  try {
    media = await prepareWAMessageMedia(
      { image: { url: 'https://i.ibb.co/jkhp8BZD/wof.jpg' } },
      { upload: conn.waUploadToServer }
    )
  } catch {}

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: {
      title: 'SAITAMA BOT - PINTEREST',
      subtitle: 'Descarga imágenes y videos',
      hasMediaAttachment: !!media,
      imageMessage: media?.imageMessage
    },
    body: {
      text: `╭━━⬣ *SAITAMA PINTEREST* ⬣━━╮\n\n📌 🖼️ 🎬\n\n💫 » Descarga imágenes y videos de Pinterest\n\n> *Por link:*\n> ${usedPrefix}${command} https://pin.it/xxx\n\n> *Por búsqueda:*\n> ${usedPrefix}${command} paisajes anime\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    },
    footer: { text: '⫏ SAITAMA BOT ' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '📌 PINTEREST',
          sections: [{
            title: '¿Qué deseas hacer?',
            rows: [{ header: '🔍 BUSCAR', title: 'Buscar imagen en Pinterest', description: 'Escribe el tema después del comando', id: 'ptsinfo' }]
          }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(
    m.chat,
    { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
    { quoted: m }
  )
  return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `pts_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  const input = text?.trim()

  // Sin argumento → menú
  if (!input) return sendMenu(conn, m, usedPrefix, command)

  // ─── Link de Pinterest → descargar ────────────────────────────────────────
  if (isHttpUrl(input)) {
    if (!isPinterestUrl(input)) {
      return conn.sendMessage(m.chat, { text: '❌ Envía un link válido de Pinterest.\n> Ejemplo: https://pin.it/xxx' }, { quoted: m })
    }

    await m.react('⏳')

    try {
      const data     = await getPinterestData(input)
      const videoUrl = data.video || data.videoUrl || data.video_url || null
      const imageUrl = data.image || data.imageUrl || data.image_url || data.thumbnail || null
      const caption  = data.title || data.description ? `💬 ${String(data.title || data.description).slice(0, 100)}` : ''

      if (videoUrl) {
        await conn.sendMessage(m.chat, { text: '🎬 *Descargando video...*' }, { quoted: m })
        await sendPinterestVideo(conn, m, videoUrl, caption)
      } else if (imageUrl) {
        await sendPinterestImage(conn, m, imageUrl, caption)
      } else {
        throw new Error('No se encontró contenido descargable en este pin')
      }

      await m.react('✅')
    } catch (e) {
      await m.react('❌')
      await conn.sendMessage(m.chat, { text: `❌ ${e.message || 'Error al descargar.'}` }, { quoted: m })
    }
    return
  }

  // ─── Texto → buscar y enviar imágenes en paralelo ⚡ ───────────────────────
  await m.react('🔍')
  await conn.sendMessage(m.chat, { text: `🔍 *Buscando:* ${input}\n⏳ Un momento...` }, { quoted: m })

  try {
    const resultados = await searchPinterest(input)

    // Filtrar solo imágenes (sin videos), tomar 5
    const validos = resultados
      .filter(r => {
        const imgUrl  = r.image || r.imageUrl || r.image_url || r.thumbnail || r.url
        const isVideo = !!(r.video || r.videoUrl || r.video_url)
        return imgUrl && !isVideo
      })
      .slice(0, 5)

    if (!validos.length) throw new Error('No se encontraron imágenes válidas')

    const total = validos.length

    // ⚡ Resolver todas las URLs HD en paralelo (con timeout corto por cada una)
    const urls = await Promise.all(
      validos.map(r => {
        const fallback = r.image || r.imageUrl || r.image_url || r.thumbnail || r.url
        return resolveHdUrl(r, fallback)
      })
    )

    // ⚡ Enviar todas las imágenes en paralelo
    const envios = await Promise.allSettled(
      urls.map((finalUrl, i) =>
        sendPinterestImage(conn, m, finalUrl, `[${i + 1}/${total}]`)
      )
    )

    const enviadas = envios.filter(r => r.status === 'fulfilled').length
    const errores  = envios.filter(r => r.status === 'rejected').length

    if (enviadas === 0) throw new Error('No se pudo enviar ninguna imagen')

    await m.react('✅')
    await conn.sendMessage(m.chat, {
      text: `✅ *Listo!* ${enviadas}/${total} imágenes enviadas${errores ? ` (${errores} fallaron)` : ''}`
    }, { quoted: m })

  } catch (e) {
    await m.react('❌')
    await conn.sendMessage(m.chat, { text: `❌ ${e.message}` }, { quoted: m })
  }
}

// ─── HANDLER BEFORE (botón de menú) ──────────────────────────────────────────
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  const msgKey = `ptsbef_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId || null
  } catch { return false }

  if (!id) return false

  if (id === 'ptsinfo') {
    await conn.sendMessage(m.chat, {
      text: '🔍 Escribe el tema así:\n> .pts paisajes anime\n> .pts aesthetic wallpapers'
    }, { quoted: m })
    return true
  }

  return false
}

handler.help    = ['pts', 'pinterest']
handler.tags    = ['tools']
handler.command = /^(pts|pinterest|pin)$/i
handler.desc    = 'Descarga imágenes y videos de Pinterest'

export default handler
