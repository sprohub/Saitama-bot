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

const REQUEST_TIMEOUT = 120000
const MAX_FILE_BYTES  = 500 * 1024 * 1024
const DELIRIUS_API    = 'https://api.delirius.store'

const _processing = new Set()

function safeFileName(name) {
  return String(name || 'media').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'media'
}
function isHttpUrl(v) { return /^https?:\/\//i.test(String(v || '')) }
function isPinterestUrl(v) { return /pinterest\.(com|es|co\.uk|fr|de|jp)|pin\.it/i.test(String(v || '')) }
function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) } catch {}
}

async function downloadFile(url, outputPath) {
  const response = await axios.get(url, {
    responseType: 'stream', timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
    validateStatus: () => true, maxRedirects: 10,
  })
  if (response.status >= 400) throw new Error('Error al descargar el archivo de Pinterest')
  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_FILE_BYTES) response.data.destroy(new Error('Archivo demasiado grande'))
  })
  try { await pipeline(response.data, fs.createWriteStream(outputPath)) }
  catch (e) { deleteFileSafe(outputPath); throw e }
  if (!fs.existsSync(outputPath)) throw new Error('No se pudo guardar el archivo')
  const size = fs.statSync(outputPath).size
  if (!size || size < 1000) { deleteFileSafe(outputPath); throw new Error('Archivo inválido o vacío') }
  return size
}

// ─── Consultar API de Pinterest ─────────────────────────────────────────────
async function getPinterestData(pinUrl) {
  const apiUrl = `${DELIRIUS_API}/download/pinterestdl?url=${encodeURIComponent(pinUrl)}`
  const res = await fetch(apiUrl, { timeout: REQUEST_TIMEOUT })
  const json = await res.json()
  if (!json.status) throw new Error(json.message || 'No se pudo obtener el pin')
  const data = json.data || json
  return data
}

// ─── Enviar imagen ───────────────────────────────────────────────────────────
async function sendPinterestImage(conn, m, imageUrl, caption) {
  await conn.sendMessage(m.chat, {
    image: { url: imageUrl },
    caption: caption
  }, { quoted: m })
}

// ─── Enviar video ────────────────────────────────────────────────────────────
async function sendPinterestVideo(conn, m, videoUrl, caption) {
  const tmpFile = path.join(TEMP_DIR, `pin_${Date.now()}.mp4`)
  try {
    await downloadFile(videoUrl, tmpFile)
    const size = fs.statSync(tmpFile).size

    if (size > 70 * 1024 * 1024) {
      await conn.sendMessage(m.chat, {
        document: fs.readFileSync(tmpFile),
        mimetype: 'video/mp4',
        fileName: 'pinterest_video.mp4',
        caption
      }, { quoted: m })
    } else {
      try {
        await conn.sendMessage(m.chat, {
          video: fs.readFileSync(tmpFile),
          mimetype: 'video/mp4',
          caption
        }, { quoted: m })
      } catch {
        await conn.sendMessage(m.chat, {
          document: fs.readFileSync(tmpFile),
          mimetype: 'video/mp4',
          fileName: 'pinterest_video.mp4',
          caption
        }, { quoted: m })
      }
    }
  } finally {
    deleteFileSafe(tmpFile)
  }
}

// ─── Buscar en Pinterest ─────────────────────────────────────────────────────
async function searchPinterest(query) {
  const res = await fetch(`${DELIRIUS_API}/search/pinterestv2?text=${encodeURIComponent(query)}`, { timeout: REQUEST_TIMEOUT })
  const json = await res.json()
  if (!json.status || !json.data?.length) throw new Error('No se encontraron resultados en Pinterest')
  return json.data.slice(0, 10)
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────────────────
let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `pts_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  const input = text?.trim()

  // Sin argumento → menú
  if (!input) {
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

  // Es un link de Pinterest → descargar directo (gratis)
  if (isHttpUrl(input)) {
    if (!isPinterestUrl(input)) {
      return conn.sendMessage(m.chat, { text: '❌ Envía un link válido de Pinterest.\n> Ejemplo: https://pin.it/xxx' }, { quoted: m })
    }

    await m.react('⏳')
    await conn.sendMessage(m.chat, { text: '📌 *Obteniendo pin...*\n⏳ Espera un momento...' }, { quoted: m })

    try {
      const data = await getPinterestData(input)

      const videoUrl = data.video || data.videoUrl || data.video_url || null
      const imageUrl = data.image || data.imageUrl || data.image_url || data.thumbnail || null
      const title    = data.title || data.description || ''

      const caption = title ? `💬 ${String(title).slice(0, 100)}` : ''

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

  // ─── Es texto → buscar y enviar 5 imágenes una por una (gratis) ──────────
  await m.react('🔍')
  await conn.sendMessage(m.chat, { text: `🔍 *Buscando:* ${input}\n⏳ Enviando imágenes...` }, { quoted: m })

  try {
    const resultados = await searchPinterest(input)

    const validos = resultados
      .filter(r => {
        const imgUrl = r.image || r.imageUrl || r.image_url || r.thumbnail || r.url
        const isVideo = !!(r.video || r.videoUrl || r.video_url)
        return imgUrl && !isVideo
      })
      .slice(0, 5)

    if (!validos.length) throw new Error('No se encontraron imágenes válidas')

    let enviadas = 0
    let errores  = 0
    const total = validos.length

    for (let i = 0; i < validos.length; i++) {
      const r      = validos[i]
      const imgUrl = r.image || r.imageUrl || r.image_url || r.thumbnail || r.url
      const pinUrl = r.pin   || r.pinUrl   || r.link      || r.url       || imgUrl

      // Intentar obtener HD desde el pin original
      let finalUrl = imgUrl
      if (pinUrl && isPinterestUrl(pinUrl)) {
        try {
          const data = await getPinterestData(pinUrl)
          finalUrl = data.image || data.imageUrl || data.image_url || imgUrl
        } catch {}
      }

      // Caption solo con el contador
      const caption = `[${i + 1}/${total}]`

      try {
        await sendPinterestImage(conn, m, finalUrl, caption)
        enviadas++
      } catch (e) {
        errores++
        console.error(`[PINTEREST] Error imagen ${i + 1}:`, e.message)
      }

      if (i < validos.length - 1) await new Promise(res => setTimeout(res, 800))
    }

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

// ─── HANDLER BEFORE (botón de info del menú) ─────────────────────────────────
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
    await conn.sendMessage(m.chat, { text: '🔍 Escribe el tema así:\n> .pts paisajes anime\n> .pts aesthetic wallpapers' }, { quoted: m })
    return true
  }

  return false
}

handler.help    = ['pts', 'pinterest']
handler.tags    = ['tools']
handler.command = /^(pts|pinterest|pin)$/i
handler.desc    = 'Descarga imágenes y videos de Pinterest'

export default handler