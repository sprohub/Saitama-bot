import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { sticker } from '../lib/sticker.js'

let handler = async (m, { conn, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''

  const isImage = /image/.test(mime)
  const isVideo = /video/.test(mime)

  if (!isImage && !isVideo) {
    return m.reply(`❌ Responde a una imagen o video con *${usedPrefix}${command}*`)
  }

  await m.reply('⏳ Creando sticker...')

  const mediaMsg = quoted.msg || quoted
  const buffer = await quoted.download()

  const stickerBuffer = await sticker(buffer, {
    packname: '⛓️🩸 DENJI BOT 🩸⛓️',
    author: '🩸 © JM 🩸',
    categories: ['🩸', '⛓️']
  })

  await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
}

handler.command = /^s(ticker|tikera?|anim(ado)?)?$/i

export default handler
