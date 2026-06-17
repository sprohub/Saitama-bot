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

const DELIRIUS_API = 'https://api.delirius.store'
const OWNERS = ['573225814649', '573225396540']

let xvideosEnabled = false

const MAX_VIDEO_BYTES = 2000 * 1024 * 1024
const VIDEO_AS_DOCUMENT_THRESHOLD = 80 * 1024 * 1024
const REQUEST_TIMEOUT = 180000

function safeFileName(name) {
  return String(name || 'xvideo').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').trim().slice(0, 70) || 'xvideo'
}

function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) } catch (e) {}
}

async function downloadVideo(downloadUrl, outputPath) {
  const response = await axios.get(downloadUrl, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0' },
    validateStatus: () => true
  })

  if (response.status >= 400) throw new Error(`HTTP Error: ${response.status}`)

  let downloaded = 0
  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > MAX_VIDEO_BYTES) response.data.destroy(new Error('Video demasiado grande'))
  })

  try {
    await pipeline(response.data, fs.createWriteStream(outputPath))
  } catch (e) {
    deleteFileSafe(outputPath)
    throw e
  }

  const size = fs.statSync(outputPath).size
  if (size < 50000) throw new Error('Video inválido o vacío')
  return size
}

async function normalizeForWhatsApp(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', inputPath,
      '-vf', 'scale=640:trunc(ow/a/2)*2',
      '-c:v', 'libx264', '-b:v', '700k', '-preset', 'fast',
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart', '-loglevel', 'error',
      outputPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    ff.on('error', reject)
    ff.on('close', code => code === 0 ? resolve() : reject(new Error('FFmpeg error')))
  })
}

async function sendXVideo(conn, m, videoUrl, title) {
  const res = await fetch(`\( {DELIRIUS_API}/download/xvideos?url= \){encodeURIComponent(videoUrl)}`)
  const json = await res.json()

  if (!json.status || !json.data?.download) throw new Error('API no devolvió enlace')

  const finalTitle = safeFileName(json.data.title || title)
  const rawFile = path.join(TEMP_DIR, `xv_${Date.now()}.mp4`)
  const finalFile = path.join(TEMP_DIR, `xv_final_${Date.now()}.mp4`)

  try {
    await downloadVideo(json.data.download, rawFile)
    const fileSize = fs.statSync(rawFile).size
    const fileName = finalTitle + '.mp4'

    const options = {
      mimetype: 'video/mp4',
      fileName,
      caption: `🔞 ${finalTitle}`
    }

    if (fileSize > VIDEO_AS_DOCUMENT_THRESHOLD) {
      await conn.sendMessage(m.chat, { document: { url: `file://${rawFile}` }, ...options }, { quoted: m })
    } else {
      try {
        await conn.sendMessage(m.chat, { video: { url: `file://${rawFile}` }, ...options }, { quoted: m })
      } catch (e) {
        await normalizeForWhatsApp(rawFile, finalFile)
        const toSend = fs.existsSync(finalFile) ? finalFile : rawFile
        await conn.sendMessage(m.chat, { video: { url: `file://${toSend}` }, ...options }, { quoted: m })
      }
    }
  } finally {
    setTimeout(() => {
      deleteFileSafe(rawFile)
      deleteFileSafe(finalFile)
    }, 15000)
  }
  return finalTitle
}

// ==================== MAIN HANDLER ====================

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const sender = m.sender.split('@')[0]

  if (command.toLowerCase() === 'xvideo') {
    if (!OWNERS.includes(sender)) return conn.sendMessage(m.chat, { text: '❌ Solo owners.' }, { quoted: m })

    const arg = text?.trim().toLowerCase()
    if (arg === 'on') {
      xvideosEnabled = true
      return conn.sendMessage(m.chat, { text: '✅ .xvideos activado' }, { quoted: m })
    }
    if (arg === 'off') {
      xvideosEnabled = false
      return conn.sendMessage(m.chat, { text: '✅ .xvideos desactivado' }, { quoted: m })
    }
    return conn.sendMessage(m.chat, { text: 'Uso: .xvideo on / .xvideo off' }, { quoted: m })
  }

  if (!xvideosEnabled) {
    return conn.sendMessage(m.chat, { text: '❌ Comando .xvideos desactivado.' }, { quoted: m })
  }

  const input = text?.trim()
  if (!input) {
    return conn.sendMessage(m.chat, { text: `🔞 Uso: ${usedPrefix}xvideos <busqueda>\nEj: .xvideos rubias` }, { quoted: m })
  }

  await m.react('🔍')

  try {
    // ←←←←← ESTA ES LA LÍNEA CRÍTICA
    const res = await fetch(`\( {DELIRIUS_API}/search/xvideos?query= \){encodeURIComponent(input)}&page=0`)
    const data = await res.json()

    if (!data.status || !data.data?.length) throw new Error('No se encontraron resultados')

    const rows = data.data.slice(0, 8).map(v => ({
      title: String(v.title || 'Sin título').slice(0, 55),
      description: `${v.duration || '?'} • ${v.views || ''}`,
      id: `xvsel\~\( {Buffer.from(v.url).toString('base64')}\~ \){Buffer.from(String(v.title || 'video')).toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: { text: `🔞 *XVIDEOS*\n\n🔎 ${input}\n📋 ${rows.length} resultados` },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🔥 Selecciona video',
            sections: [{ title: 'Resultados', rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('✅')

  } catch (e) {
    console.error(e)
    await m.react('❌')
    conn.sendMessage(m.chat, { text: `❌ ${e.message || 'Error'}` }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  if (m.isBaileys || !xvideosEnabled) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId
  } catch { return false }

  if (!id?.startsWith('xvsel\~')) return false

  const parts = id.split('\~')
  if (parts.length < 3) return true

  let videoUrl, title
  try {
    videoUrl = Buffer.from(parts[1], 'base64').toString()
    title = Buffer.from(parts[2], 'base64').toString()
  } catch {
    return conn.sendMessage(m.chat, { text: '❌ Error procesando' }, { quoted: m })
  }

  await m.react('⏳')
  await conn.sendMessage(m.chat, { text: `🔞 Descargando...\n${title}` }, { quoted: m })

  try {
    const finalTitle = await sendXVideo(conn, m, videoUrl, title)
    await conn.sendMessage(m.chat, { text: `✅ Listo!\n🔞 ${finalTitle}` }, { quoted: m })
    await m.react('✅')
  } catch (e) {
    console.error('[XVIDEOS ERROR]', e)
    await m.react('❌')
    await conn.sendMessage(m.chat, { text: `❌ ${e.message || 'Error al descargar'}` }, { quoted: m })
  }
  return true
}

handler.help = ['xvideos']
handler.tags = ['nsfw']
handler.command = /^(xvideos?|xvideo)$/i

export default handler