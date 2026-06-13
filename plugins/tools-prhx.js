// === FIX RCANAL ERROR ===
if (typeof rcanal === 'undefined') global.rcanal = false
// ========================

import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from '@whiskeysockets/baileys'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const OWNERS = ['573225396540', '573225814649']

function isOwner(sender) {
  const number = sender.replace(/@s.whatsapp.net$/, '')
  return OWNERS.includes(number) || (global.owner && global.owner.includes(number))
}

let handler = async (m, { conn, text, usedPrefix, command, isOwner: isBotOwner }) => {
  const chatId = m.chat
  if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {}
  if (global.db.data.chats[chatId].prhx === undefined) global.db.data.chats[chatId].prhx = false

  const isEnabled = global.db.data.chats[chatId].prhx
  const input = text?.trim()

  if (input === 'on' || input === 'off') {
    if (!isOwner(m.sender) && !isBotOwner) {
      return conn.sendMessage(m.chat, {
        text: `╭━━⬣ *SAITAMA PERMISOS* ⬣━━╮\n\n❌ Solo los owners pueden usar este comando.\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      }, { quoted: m })
    }

    const newState = input === 'on'
    global.db.data.chats[chatId].prhx = newState

    return conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA PRHX* ⬣━━╮\n\n✅ Comando *.prhx* ${newState ? '✅ ACTIVADO' : '❌ DESACTIVADO'} en este grupo.\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  if (!isEnabled) {
    return conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA PRHX* ⬣━━╮\n\n❌ El comando está desactivado en este grupo.\nUsa \`.prhx on\` para activarlo.\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  if (!input) {
    return conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA PRHX* ⬣━━╮\n\n🔍 Uso: \( {usedPrefix} \){command} <texto>\nEj: \( {usedPrefix} \){command} Rusas\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  await m.react('🔍')

  try {
    const res = await fetch(`https://api.delirius.store/search/xnxxsearch?query=${encodeURIComponent(input)}`)
    const data = await res.json()

    if (!data.status || !data.data?.length) throw new Error('No se encontraron resultados')

    const resultados = data.data.slice(0, 8)
    const rows = resultados.map(v => ({
      title: String(v.title || 'Sin título').slice(0, 50),
      description: `⏱️ ${v.duration || '?'} | 👁️ ${Number(v.views || 0).toLocaleString()}`,
      id: `prhxdl\~${Buffer.from(v.url).toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: 'SAITAMA BOT - XNXX', subtitle: input },
      body: { text: `╭━━⬣ *RESULTADOS XNXX* ⬣━━╮\n\n🔍 Búsqueda: *${input}*\n📋 ${resultados.length} resultados\n\nElige uno:\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣` },
      footer: { text: '⫏ SAITAMA BOT ⫐' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '📥 DESCARGAR',
            sections: [{ title: 'Resultados encontrados', rows }]
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

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId
  } catch { return false }

  if (!id?.startsWith('prhxdl\~')) return false

  const urlB64 = id.split('\~')[1]
  let videoUrl
  try {
    videoUrl = Buffer.from(urlB64, 'base64').toString()
  } catch {
    return conn.sendMessage(m.chat, { text: '❌ Error al procesar enlace.' }, { quoted: m })
  }

  await m.react('⏳')
  await conn.sendMessage(m.chat, { text: `📥 Descargando video...` }, { quoted: m })

  try {
    const res = await fetch(`https://api.delirius.store/download/xnxxdl?url=${encodeURIComponent(videoUrl)}`)
    const json = await res.json()

    if (!json.status || !json.data?.download) throw new Error('No se obtuvo enlace')

    const downloadUrl = json.data.download.high || json.data.download.low
    if (!downloadUrl) throw new Error('No hay enlace disponible')

    const title = json.data.title ? json.data.title.slice(0, 80) : 'xnxx_video'
    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`

    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl },
      mimetype: 'video/mp4',
      fileName: fileName,
      caption: `✅ *Descarga completada*\n\n🎬 ${json.data.title || 'Video'}`
    }, { quoted: m })

    await m.react('✅')
  } catch (e) {
    console.error('[PRHX ERROR]', e)
    await m.react('❌')
    conn.sendMessage(m.chat, { text: '❌ Error al descargar el video.' }, { quoted: m })
  }

  return true
}

handler.help = ['prhx']
handler.tags = ['nsfw', 'downloader']
handler.command = /^(prhx)$/i
handler.group = true

export default handler