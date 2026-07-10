import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { sticker } from '../lib/sticker.js'

let handler = async (m, { conn, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''

  const isImage = /image/.test(mime)
  const isVideo = /video/.test(mime)

  // Si no hay imagen ni video, mostramos el menú de ayuda decorado
  if (!isImage && !isVideo) {
    return conn.sendMessage(m.chat, {
      image: { url: 'https://i.ibb.co/DDYYkBjy/3975511c-8f9b-48e3-89da-7b9d537425bd.png' },
      caption: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ 📸 *¿Cómo crear un sticker?*
│
│ *Modo 1 — Imagen con caption:*
│  1. Selecciona una imagen
│  2. En el caption escribe *${usedPrefix}${command}*
│  3. Envía ✅
│
│ *Modo 2 — Citar imagen:*
│  1. Cita cualquier imagen o video
│  2. Escribe *${usedPrefix}${command}* y envía ✅
│
│ ⚠️ _Solo imágenes, gif o videos cortos_
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  const waitMsg = await conn.sendMessage(m.chat, {
    text: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ ⏳ _Creando tu sticker..._
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
  }, { quoted: m })

  try {
    const buffer = await quoted.download()

    const stickerBuffer = await sticker(buffer, {
      packname: 'SAITAMA BOT',
      author: 'SAITAMA',
      categories: ['🩸', '⛓️']
    })

    await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ ❌ _Ocurrió un error al crear el sticker_
│ 🔁 Intenta con otra imagen o video
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }
}

handler.help = ['sticker', 'stiker', 's']
handler.tags = ['tools']
handler.command = /^s(ticker|tikera?|anim(ado)?)?$/i

export default handler
