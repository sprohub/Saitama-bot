import { sticker, addExif } from '../lib/sticker.js'

let handler = async (m, { conn }) => {
  let isMedia = m.msg?.mimetype
  let isQuotedMedia = m.quoted?.msg?.mimetype

  if (!isMedia && !isQuotedMedia) {
    return conn.sendMessage(m.chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* \n' +
        '│\n' +
        '│ 📸 *¿Cómo crear un sticker?*\n' +
        '│\n' +
        '│ *Modo 1 — Imagen con caption:*\n' +
        '│  1. Selecciona una imagen\n' +
        '│  2. En el caption escribe *.crs*\n' +
        '│  3. Envía ✅\n' +
        '│\n' +
        '│ *Modo 2 — Citar imagen:*\n' +
        '│  1. Cita cualquier imagen\n' +
        '│  2. Escribe *.crs* y envía ✅\n' +
        '│\n' +
        '│ ⚠️ _Solo imágenes o videos_\n' +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    let media
    if (isQuotedMedia) {
      media = await conn.downloadM(
        m.quoted.mediaMessage[m.quoted.mediaType],
        m.quoted.mediaType.replace(/message/i, '')
      )
    } else {
      media = await conn.downloadM(
        m.mediaMessage[m.mediaType],
        m.mediaType.replace(/message/i, '')
      )
    }

    const packname = 'SAITAMA-BOT'
    const author = 'by SPROH'

    let webpBuffer = await sticker(media, null, packname, author)

    if (!Buffer.isBuffer(webpBuffer)) webpBuffer = Buffer.from(webpBuffer)

    try { webpBuffer = await addExif(webpBuffer, packname, author) } catch (_) {}

    await conn.sendMessage(m.chat, { sticker: webpBuffer }, { quoted: m })
    await m.react('✅')

  } catch (e) {
    console.error('[tools-sticker]', e)
    await m.react('❌')
    conn.sendMessage(m.chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        '│ ❌ Error al crear el sticker.\n' +
        '│ _Envía una imagen válida._\n' +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }
}

handler.help = ['crs']
handler.tags = ['tools']
handler.command = /^(crs)$/i
handler.desc = 'Convierte una imagen en sticker — SAITAMA-BOT'

export default handler
