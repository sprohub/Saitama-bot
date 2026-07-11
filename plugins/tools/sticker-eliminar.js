import { getSticker, removeSticker } from '../../lib/stickerpack.js'

const handler = async (m, { conn, text }) => {
  const name = (text || '').trim().toLowerCase()

  if (!name) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes indicar el nombre del sticker.\n` +
      `│ Ejemplo: *.steliminar goku*\n` +
      `╰───────────────⬣`
    )
  }

  const sticker = getSticker(name)

  if (!sticker) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 No existe un sticker llamado *${name}*.\n` +
      `╰───────────────⬣`
    )
  }

  removeSticker(name)

  await conn.sendMessage(m.chat, {
    text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ✅ Sticker *${name}* eliminado.\n╰───────────────⬣`
  }, { quoted: m })
}

handler.command = ['steliminar']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['steliminar <nombre>']
handler.desc = 'Elimina un sticker del pack por su nombre'
handler.owner = true

export default handler