import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import { spawn } from 'child_process'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const DELIRIUS_API = 'https://api.delirius.store'
const OWNERS = ['573225814649', '573225396540'].map(num => num + '@s.whatsapp.net')
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
      '-y',
      '-i', inputPath,
      '-vf', 'scale=640:trunc(ow/a/2)*2',
      '-c:v', 'libx264',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-b:v', '700k',
      '-maxrate', '1000k',
      '-bufsize', '2000k',
      '-preset', 'fast',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-ar', '44100',
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-threads', '2',
      '-loglevel', 'error',
      outputPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    
    let stderr = ''
    ff.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    
    ff.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`))
    })
    
    ff.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath)
        if (stats.size > 10000) {
          resolve()
        } else {
          reject(new Error('Archivo de salida demasiado pequeño o vacío'))
        }
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`))
      }
    })
  })
}

async function sendXVideo(conn, m, videoUrl, title) {
  const downloadUrl = `${DELIRIUS_API}/download/xvideos?url=${encodeURIComponent(videoUrl)}`
  const res = await fetch(downloadUrl)
  const json = await res.json()

  if (!json.status || !json.data?.download) throw new Error('API no devolvió enlace de video')

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

    // Si el video es muy grande, enviar como documento
    if (fileSize > VIDEO_AS_DOCUMENT_THRESHOLD) {
      await conn.sendMessage(m.chat, { 
        document: { url: `file://${rawFile}` }, 
        ...options 
      }, { quoted: m })
    } else {
      // Intentar enviar como video
      try {
        await conn.sendMessage(m.chat, { 
          video: { url: `file://${rawFile}` }, 
          ...options 
        }, { quoted: m })
      } catch (sendError) {
        console.log('Error al enviar video crudo, normalizando...', sendError.message)
        
        // Normalizar el video para WhatsApp
        try {
          await normalizeForWhatsApp(rawFile, finalFile)
          
          // Verificar que el archivo normalizado existe y tiene tamaño adecuado
          if (fs.existsSync(finalFile) && fs.statSync(finalFile).size > 10000) {
            await conn.sendMessage(m.chat, { 
              video: { url: `file://${finalFile}` }, 
              ...options 
            }, { quoted: m })
          } else {
            throw new Error('Archivo normalizado no válido')
          }
        } catch (normError) {
          console.log('Error en normalización, enviando como documento:', normError.message)
          // Si falla la normalización, enviar el original como documento
          await conn.sendMessage(m.chat, { 
            document: { url: `file://${rawFile}` }, 
            ...options 
          }, { quoted: m })
        }
      }
    }
  } catch (error) {
    console.error('[SENDXVIDEO ERROR]', error)
    throw error
  } finally {
    // Limpiar archivos temporales después de 15 segundos
    setTimeout(() => {
      deleteFileSafe(rawFile)
      deleteFileSafe(finalFile)
    }, 15000)
  }
  
  return finalTitle
}

// ==================== HANDLER PRINCIPAL ====================

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const sender = m.sender

  // Comando para activar/desactivar (solo owners)
  if (command.toLowerCase() === 'xvideo') {
    if (!OWNERS.includes(sender)) {
      return conn.sendMessage(m.chat, { text: '❌ Solo los owners pueden activar/desactivar este comando.' }, { quoted: m })
    }

    const arg = text?.trim().toLowerCase()
    if (arg === 'on') {
      xvideosEnabled = true
      return conn.sendMessage(m.chat, { text: '✅ Comando .xvideos activado' }, { quoted: m })
    }
    if (arg === 'off') {
      xvideosEnabled = false
      return conn.sendMessage(m.chat, { text: '✅ Comando .xvideos desactivado' }, { quoted: m })
    }
    return conn.sendMessage(m.chat, { text: 'Uso: .xvideo on\n.xvideo off' }, { quoted: m })
  }

  // Comando principal de búsqueda
  if (command.toLowerCase() === 'xvideos') {
    if (!xvideosEnabled) {
      return conn.sendMessage(m.chat, { text: '❌ El comando `.xvideos` está desactivado.' }, { quoted: m })
    }

    const input = text?.trim()
    if (!input) {
      return conn.sendMessage(m.chat, { text: `🔞 Uso: ${usedPrefix}xvideos <busqueda>\nEjemplo: .xvideos rubias tetonas` }, { quoted: m })
    }

    await m.react('🔍')

    try {
      const searchUrl = `${DELIRIUS_API}/search/xvideos?query=${encodeURIComponent(input)}&page=0`
      const res = await fetch(searchUrl)
      const data = await res.json()

      if (!data.status || !data.data?.length) throw new Error('No se encontraron resultados')

      const rows = data.data.slice(0, 8).map(v => ({
        title: String(v.title || 'Sin título').slice(0, 55),
        description: `${v.duration || '?'} • ${v.views || ''}`,
        id: `xvsel~${Buffer.from(v.url).toString('base64')}~${Buffer.from(String(v.title || 'video')).toString('base64')}`
      }))

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        body: { text: `🔞 *XVIDEOS SEARCH*\n\n🔎 ${input}\n📋 ${rows.length} resultados` },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🔥 Selecciona un video',
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
      conn.sendMessage(m.chat, { text: `❌ ${e.message || 'Error en la búsqueda'}` }, { quoted: m })
    }
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

  if (!id?.startsWith('xvsel~')) return false

  const parts = id.split('~')
  if (parts.length < 3) return true

  let videoUrl, title
  try {
    videoUrl = Buffer.from(parts[1], 'base64').toString()
    title = Buffer.from(parts[2], 'base64').toString()
  } catch {
    return conn.sendMessage(m.chat, { text: '❌ Error al procesar' }, { quoted: m })
  }

  await m.react('⏳')
  await conn.sendMessage(m.chat, { text: `🔞 Descargando...\n📹 ${title}` }, { quoted: m })

  try {
    const finalTitle = await sendXVideo(conn, m, videoUrl, title)
    await conn.sendMessage(m.chat, { text: `✅ Descarga completada\n🔞 ${finalTitle}` }, { quoted: m })
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
