import { addSticker } from '../../lib/stickerpack.js'
import { sticker, webpBufferIsAnimated } from '../../lib/sticker.js'

const handler = async (m, { conn, text }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = quoted.mimetype || quoted.msg?.mimetype || ''
  const name = (text || '').trim().toLowerCase()

  if (!name) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes poner un nombre para el sticker.\n` +
      `│ Ejemplo: *.stsubir goku*\n` +
      `│ (citando una imagen, video, gif o sticker)\n` +
      `╰───────────────⬣`
    )
  }

  const soportado = /image\/(jpe?g|png|webp|gif)|video\/(mp4|3gpp|quicktime)/i.test(mime)
  if (!soportado) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes citar una *imagen*, *video*, *gif*\n` +
      `│ o *sticker* junto con *.stsubir ${name}*.\n` +
      `╰───────────────⬣`
    )
  }

  const esVideo = /video/i.test(mime) || /gif/i.test(mime)

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🍃 Guardando sticker *${name}*...\n` +
    `│ ${esVideo ? '⏳ Los animados tardan un poco más' : ''}\n` +
    `╰───────────────⬣`
  )

  try {
    const buffer = await quoted.download()
    if (!buffer || !buffer.length) throw new Error('Buffer vacío')

    const webpBuffer = await sticker(buffer, {
      packname: 'SAITAMA-BOT',
      author: m.pushName || 'SAITAMA'
    })

    const animated = esVideo || webpBufferIsAnimated(buffer)

    addSticker(name, webpBuffer, { owner: m.sender, chat: m.chat, animated })

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
      `│ ❌ ${e.message || 'Error al guardar el sticker.'}\n` +
      `╰───────────────⬣`
    )
  }
}

handler.command = ['stsubir']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['stsubir <nombre>']
handler.desc = 'Sube un sticker (imagen/video/gif/sticker) al pack'
handler.owner = true

export default handler