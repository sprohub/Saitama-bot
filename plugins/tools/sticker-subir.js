import sharp from 'sharp'
import { addSticker } from '../../lib/stickerpack.js'

const handler = async (m, { conn, text }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = quoted.mimetype || quoted.msg?.mimetype || ''
  const name = (text || '').trim().toLowerCase()

  if (!name) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes poner un nombre para el sticker.\n` +
      `│ Ejemplo: *.stsubir goku*\n` +
      `│ (citando una imagen o sticker)\n` +
      `╰───────────────⬣`
    )
  }

  if (!/image\/(jpe?g|png)|webp/i.test(mime)) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes citar una *imagen* o *sticker*\n` +
      `│ junto con *.stsubir ${name}*.\n` +
      `╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🍃 Guardando sticker *${name}*...\n` +
    `╰───────────────⬣`
  )

  try {
    const buffer = await quoted.download()
    if (!buffer || !buffer.length) throw new Error('Buffer vacío')

    let webpBuffer
    if (/webp/i.test(mime)) {
      webpBuffer = buffer
    } else {
      webpBuffer = await sharp(buffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp()
        .toBuffer()
    }

    addSticker(name, webpBuffer, { owner: m.sender, chat: m.chat })

    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ Sticker guardado como *${name}*\n` +
        `│ 🍃 Usa *.stlist* para verlo\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  } catch (e) {
    console.log('[stsubir] error:', e)
    await m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ ❌ Error al guardar el sticker.\n` +
      `╰───────────────⬣`
    )
  }
}

handler.command = ['stsubir']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['stsubir <nombre>']
handler.desc = 'Sube un sticker al pack (cita una imagen o sticker)'

export default handler