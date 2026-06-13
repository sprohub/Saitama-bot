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

function getDiamantes(user) { return user?.diamantes ?? user?.diamond ?? 0 }
function restarDiamante(user) {
  if (user.diamantes !== undefined) user.diamantes = (user.diamantes || 0) - 1
  else user.diamond = (user.diamond || 0) - 1
}
function devolverDiamante(user, anterior) {
  if (user.diamantes !== undefined) user.diamantes = anterior
  else user.diamond = anterior
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

  // La API puede devolver los datos en distintos niveles
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
        // fallback: enviar como documento si falla como video
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
  const res = await fetch(`${DELIRIUS_API}/search/pinterest?q=${encodeURIComponent(query)}`, { timeout: REQUEST_TIMEOUT })
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

  let user = global.db.data.users[m.sender]
  if (!user) { global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }; user = global.db.data.users[m.sender] }

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
        text: `╭━━⬣ *SAITAMA PINTEREST* ⬣━━╮\n\n📌 🖼️ 🎬\n\n💫 » Descarga imágenes y videos de Pinterest\n\n> *Por link:*\n> ${usedPrefix}${command} https://pin.it/xxx\n\n> *Por búsqueda:*\n> ${usedPrefix}${command} paisajes anime\n\n> 💎 Cuesta 1 diamante por descarga\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
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

  // Es un link de Pinterest → descargar directo
  if (isHttpUrl(input)) {
    if (!isPinterestUrl(input)) {
      return conn.sendMessage(m.chat, { text: '❌ Envía un link válido de Pinterest.\n> Ejemplo: https://pin.it/xxx' }, { quoted: m })
    }

    const diamantes = getDiamantes(user)
    if (diamantes < 1) {
      return conn.sendMessage(m.chat, {
        text: `╭━━⬣ *SAITAMA PINTEREST* ⬣━━╮\n\n💫 » No tienes suficientes diamantes\n💎 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para ganar\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      }, { quoted: m })
    }

    restarDiamante(user)
    const restantes = getDiamantes(user)

    await m.react('⏳')
    await conn.sendMessage(m.chat, { text: '📌 *Obteniendo pin...*\n⏳ Espera un momento...' }, { quoted: m })

    try {
      const data = await getPinterestData(input)

      // Detectar si es video o imagen
      const videoUrl = data.video || data.videoUrl || data.video_url || null
      const imageUrl = data.image || data.imageUrl || data.image_url || data.thumbnail || null
      const title    = data.title || data.description || 'Pinterest'

      const caption = `📌 *Pinterest*\n${title ? `💬 ${String(title).slice(0, 100)}` : ''}\n💎 Diamantes restantes: ${restantes}`

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
      devolverDiamante(user, getDiamantes(user) + 1)
      await m.react('❌')
      await conn.sendMessage(m.chat, { text: `❌ ${e.message || 'Error al descargar.'}\n💎 Diamante devuelto.` }, { quoted: m })
    }
    return
  }

  // Es texto → buscar en Pinterest
  const diamantes = getDiamantes(user)
  if (diamantes < 1) {
    return conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA PINTEREST* ⬣━━╮\n\n💫 » No tienes suficientes diamantes\n💎 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para ganar\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  await m.react('🔍')

  try {
    const resultados = await searchPinterest(input)

    // Filtrar resultados que tengan imagen
    const validos = resultados.filter(r => r.image || r.imageUrl || r.image_url || r.thumbnail || r.url)

    if (!validos.length) throw new Error('No se encontraron resultados con imagen')

    let media = null
    const primerImg = validos[0]?.image || validos[0]?.imageUrl || validos[0]?.thumbnail || validos[0]?.url
    if (primerImg) {
      try { media = await prepareWAMessageMedia({ image: { url: primerImg } }, { upload: conn.waUploadToServer }) } catch {}
    }

    const rows = validos.slice(0, 8).map((r, i) => {
      const imgUrl   = r.image || r.imageUrl || r.image_url || r.thumbnail || r.url || ''
      const pinUrl   = r.pin || r.pinUrl || r.link || r.url || imgUrl
      const isVideo  = !!(r.video || r.videoUrl || r.video_url)
      const desc     = String(r.title || r.description || `Resultado ${i + 1}`).slice(0, 40)
      const id = `ptsdl~${Buffer.from(pinUrl).toString('base64')}~${Buffer.from(imgUrl).toString('base64')}~${isVideo ? '1' : '0'}`

      return {
        header: isVideo ? '🎬 VIDEO' : '🖼️ IMAGEN',
        title: desc,
        description: isVideo ? '📹 Contiene video' : '🖼️ Imagen',
        id
      }
    })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: 'SAITAMA BOT - PINTEREST',
        subtitle: `Resultados: ${input}`,
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text: `╭━━⬣ *RESULTADOS PINTEREST* ⬣━━╮\n\n📌\n\n💫 » Búsqueda: *${input}*\n📋 ${rows.length} resultados encontrados\n\n> Elige el que deseas descargar\n> 💎 1 diamante\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      },
      footer: { text: '⫏⫏ SAITAMA BOT ' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '📌 RESULTADOS',
            sections: [{ title: `📋 ${input.toUpperCase().slice(0, 24)}`, rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    await conn.sendMessage(m.chat, { text: `❌ ${e.message}` }, { quoted: m })
  }
}

// ─── HANDLER BEFORE (respuesta a botones) ───────────────────────────────────
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

  // Botón de info
  if (id === 'ptsinfo') {
    await conn.sendMessage(m.chat, { text: '🔍 Escribe el tema así:\n> .pts paisajes anime\n> .pts aesthetic wallpapers' }, { quoted: m })
    return true
  }

  // Selección de resultado
  if (id.startsWith('ptsdl~')) {
    const parts = id.split('~')
    if (parts.length < 4) {
      await conn.sendMessage(m.chat, { text: '❌ Error al procesar la selección.' }, { quoted: m })
      return true
    }

    const pinB64   = parts[1]
    const imgB64   = parts[2]
    const isVideo  = parts[3] === '1'

    let pinUrl, imgUrl
    try {
      pinUrl = Buffer.from(pinB64, 'base64').toString()
      imgUrl = Buffer.from(imgB64, 'base64').toString()
    } catch {
      await conn.sendMessage(m.chat, { text: '❌ Error al procesar la selección.' }, { quoted: m })
      return true
    }

    let user = global.db.data.users[m.sender]
    if (!user) { global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }; user = global.db.data.users[m.sender] }

    const diamantes = getDiamantes(user)
    if (diamantes < 1) {
      await conn.sendMessage(m.chat, {
        text: `╭━━⬣ *SAITAMA PINTEREST* ⬣━━╮\n\n💫 » No tienes suficientes diamantes\n💎 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para ganar\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      }, { quoted: m })
      return true
    }

    restarDiamante(user)
    const restantes = getDiamantes(user)

    await m.react('⏳')
    await conn.sendMessage(m.chat, {
      text: isVideo
        ? `🎬 *Descargando video de Pinterest...*\n💎 -1 diamante | ⏳ Espera...`
        : `🖼️ *Descargando imagen de Pinterest...*\n💎 -1 diamante | ⏳ Espera...`
    }, { quoted: m })

    const caption = `📌 *Pinterest*\n💎 Diamantes restantes: ${restantes}`

    try {
      if (isVideo && pinUrl) {
        // Intentar obtener el video real del pin
        try {
          const data = await getPinterestData(pinUrl)
          const videoUrl = data.video || data.videoUrl || data.video_url || null
          if (videoUrl) {
            await sendPinterestVideo(conn, m, videoUrl, caption)
          } else {
            // fallback: enviar imagen si no hay video
            const fallbackImg = data.image || data.imageUrl || imgUrl
            await sendPinterestImage(conn, m, fallbackImg, caption)
          }
        } catch {
          // fallback directo con la imagen del resultado
          await sendPinterestImage(conn, m, imgUrl, caption)
        }
      } else {
        // Es imagen: intentar obtener mejor resolución desde pin
        if (pinUrl && isPinterestUrl(pinUrl)) {
          try {
            const data = await getPinterestData(pinUrl)
            const hdImg = data.image || data.imageUrl || data.image_url || imgUrl
            await sendPinterestImage(conn, m, hdImg, caption)
          } catch {
            await sendPinterestImage(conn, m, imgUrl, caption)
          }
        } else {
          await sendPinterestImage(conn, m, imgUrl, caption)
        }
      }

      await m.react('✅')
    } catch (e) {
      devolverDiamante(user, diamantes)
      await m.react('❌')
      console.error('[PINTEREST ERROR]', e.message)
      await conn.sendMessage(m.chat, { text: `❌ ${e.message || 'Error al descargar.'}\n💎 Diamante devuelto.` }, { quoted: m })
    }

    return true
  }

  return false
}

handler.help    = ['pts', 'pinterest']
handler.tags    = ['downloader']
handler.command = /^(pts|pinterest|pin)$/i
handler.desc    = 'Descarga imágenes y videos de Pinterest 💎1'

export default handler
