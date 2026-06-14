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

const DELIRIUS_API = 'https://api.delirius.store'
const OWNERS = ['573225396540@s.whatsapp.net', '573225814649@s.whatsapp.net']
const MAX_RESULTS = 10

const _processing = new Set()

function safeFileName(name) {
  return String(name || 'media')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'media'
}

function deleteFileSafe(fp) {
  try { 
    if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) 
  } catch (e) {}
}

async function downloadVideo(downloadUrl, outputPath) {
  const response = await axios.get(downloadUrl, {
    responseType: 'stream',
    timeout: 180000, // 3 minutos
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Referer': 'https://www.xnxx.com/'
    },
    validateStatus: () => true,
    maxRedirects: 10,
  })

  if (response.status >= 400) {
    throw new Error(`Error al descargar: ${response.status}`)
  }

  let downloaded = 0
  const maxSize = 1500 * 1024 * 1024 // 1.5 GB

  response.data.on('data', chunk => {
    downloaded += chunk.length
    if (downloaded > maxSize) {
      response.data.destroy(new Error('Video demasiado grande'))
    }
  })

  try {
    await pipeline(response.data, fs.createWriteStream(outputPath))
  } catch (e) {
    deleteFileSafe(outputPath)
    throw e
  }

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 500000) {
    deleteFileSafe(outputPath)
    throw new Error('Video inválido o muy pequeño')
  }

  return { size: fs.statSync(outputPath).size }
}

async function sendPrhxVideo(conn, m, videoUrl, title) {
  const res = await fetch(`\( {DELIRIUS_API}/download/xnxxdl?url= \){encodeURIComponent(videoUrl)}`)
  const json = await res.json()

  if (!json.status || !json.data?.download) {
    throw new Error('No se pudo obtener el enlace de descarga del video')
  }

  // ✅ Corrección principal: nueva estructura del API
  const downloadData = json.data.download
  const downloadUrl = downloadData.high || downloadData.low || downloadData.url

  if (!downloadUrl) {
    throw new Error('No hay enlace de video disponible')
  }

  const finalTitle = safeFileName(json.data.title || title || 'prhx_video')
  const rawFile = path.join(TEMP_DIR, `prhx_${Date.now()}.mp4`)
  
  try {
    await downloadVideo(downloadUrl, rawFile)
    const finalName = `${finalTitle}.mp4`
    
    await conn.sendMessage(m.chat, {
      document: { url: rawFile }, // Mejor usar url en lugar de leer todo en memoria
      mimetype: 'video/mp4',
      fileName: finalName,
      caption: `🔞 ${finalTitle}\n💎 Descargado vía Delirius API`
    }, { quoted: m })
  } finally {
    deleteFileSafe(rawFile)
  }
  return finalTitle
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner, isAdmin }) => {
  const msgKey = `prhx_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  if (!global.db.data.chats) global.db.data.chats = {}
  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {}
  let chatSettings = global.db.data.chats[m.chat]

  const input = text?.trim()

  // Toggle on/off
  if (input?.toLowerCase() === 'on' || input?.toLowerCase() === 'off') {
    const isAuthorized = OWNERS.includes(m.sender) || (m.isGroup && (isOwner || isAdmin))
    if (!isAuthorized) {
      return conn.sendMessage(m.chat, { text: '❌ Solo owners o admins pueden activar/desactivar.' }, { quoted: m })
    }
    
    chatSettings.prhxEnabled = input.toLowerCase() === 'on'
    await conn.sendMessage(m.chat, { 
      text: `╭━━⬣ *SAITAMA PRHX* ⬣━━╮\n\n🔞 Modo PRHX ${chatSettings.prhxEnabled ? '✅ ACTIVADO' : '❌ DESACTIVADO'}\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣` 
    }, { quoted: m })
    return
  }

  // Check if enabled
  if (m.isGroup && !chatSettings.prhxEnabled) {
    return conn.sendMessage(m.chat, { 
      text: `╭━━⬣ *SAITAMA PRHX* ⬣━━╮\n\n❌ PRHX está desactivado en este grupo.\nUsa .prhx on (solo owners/admins)\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣` 
    }, { quoted: m })
  }

  if (!input) {
    return conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA PRHX* ⬣━━╮\n\n🔞 » Buscador de contenido adulto\n\n> \( {usedPrefix} \){command} <texto>\n> Ejemplo: \( {usedPrefix} \){command} Rusas\n\n> Usa .prhx on / off para activar en grupo\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  await m.react('🔍')

  try {
    const res = await fetch(`\( {DELIRIUS_API}/search/xnxxsearch?query= \){encodeURIComponent(input)}`)
    const data = await res.json()

    if (!data.status || !data.data?.length) {
      throw new Error('No se encontraron resultados')
    }

    const resultados = data.data.slice(0, MAX_RESULTS)
    let media = null

    if (resultados[0]?.thumbnail || resultados[0]?.image) {
      try {
        media = await prepareWAMessageMedia({ 
          image: { url: resultados[0].thumbnail || resultados[0].image } 
        }, { upload: conn.waUploadToServer })
      } catch {}
    }

    const rows = resultados.map((v, i) => ({
      header: String(v.duration || '00:00'),
      title: String(v.title || 'Sin título').slice(0, 60),
      description: `👁️ ${Number(v.views || 0).toLocaleString()} • ${v.duration || ''}`,
      id: `prhxsel\~\( {Buffer.from(v.url || '').toString('base64')}\~ \){Buffer.from(String(v.title || 'video')).toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { 
        title: '🔞 SAITAMA PRHX',
        subtitle: `Búsqueda: ${input}`,
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: { 
        text: `╭━━⬣ *RESULTADOS PRHX* ⬣━━╮\n\n🔞 Búsqueda: *${input}*\n📋 ${resultados.length} resultados encontrados\n\nSelecciona un video para descargar:\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣` 
      },
      footer: { text: 'SAITAMA BOT - NSFW 🔞' },
      nativeFlowMessage: { 
        buttons: [{ 
          name: 'single_select', 
          buttonParamsJson: JSON.stringify({ 
            title: 'Seleccionar Video',
            sections: [{ 
              title: `Resultados para: ${input}`,
              rows 
            }] 
          }) 
        }] 
      }
    })

    const msg = generateWAMessageFromContent(m.chat, { 
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } 
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('✅')

  } catch (e) {
    await m.react('❌')
    conn.sendMessage(m.chat, { text: `❌ ${e.message || 'Error en la búsqueda'}` }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  const msgKey = `prhx_before_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId
  } catch { return false }

  if (!id || !id.startsWith('prhxsel\~')) return false

  const parts = id.split('\~')
  if (parts.length < 3) return true

  const urlB64 = parts[1]
  const titleB64 = parts[2]

  let videoUrl, title
  try {
    videoUrl = Buffer.from(urlB64, 'base64').toString()
    title = Buffer.from(titleB64, 'base64').toString()
  } catch {
    await conn.sendMessage(m.chat, { text: '❌ Error al procesar selección.' }, { quoted: m })
    return true
  }

  await m.react('⏳')
  await conn.sendMessage(m.chat, {
    text: `🔞 *Descargando...*\n📹 ${title}\n⏳ Por favor espera...`
  }, { quoted: m })

  try {
    const finalTitle = await sendPrhxVideo(conn, m, videoUrl, title)
    await conn.sendMessage(m.chat, {
      text: `✅ *Descarga completada*\n🔞 ${finalTitle}`
    }, { quoted: m })
    await m.react('✅')
  } catch (e) {
    console.error('[PRHX ERROR]', e)
    await m.react('❌')
    await conn.sendMessage(m.chat, { 
      text: `❌ ${e.message || 'Error al descargar el video'}\nInténtalo más tarde.` 
    }, { quoted: m })
  }
  return true
}

handler.help = ['prhx']
handler.tags = ['downloader', 'nsfw']
handler.command = /^(prhx)$/i
handler.desc = 'Buscador y descargador de videos adultos PRHX 🔞'

export default handler