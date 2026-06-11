import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const DELIRIUS_API = 'https://api.delirius.store'

let handler = async (m, { conn, usedPrefix, command }) => {
  // Verificar usuario en la base de datos
  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }
    user = global.db.data.users[m.sender]
  }

  function getDiamantes(user) { return user?.diamantes ?? user?.diamond ?? 0 }
  function restarDiamante(user) {
    if (user.diamantes !== undefined) user.diamantes = (user.diamantes || 0) - 1
    else user.diamond = (user.diamond || 0) - 1
  }
  function devolverDiamante(user, anterior) {
    if (user.diamantes !== undefined) user.diamantes = anterior
    else user.diamond = anterior
  }

  const diamantes = getDiamantes(user)

  // Sin diamantes suficientes
  if (diamantes < 1) {
    return conn.sendMessage(m.chat, {
      text: `🔞 「 NST 」\n\n💫 » No tienes suficientes diamantes\n💎 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para ganar`
    }, { quoted: m })
  }

  await m.react('⏳')
  restarDiamante(user)
  const restantes = getDiamantes(user)

  try {
    const res = await fetch(`${DELIRIUS_API}/nsfw/girls`)
    const json = await res.json()

    if (!json.status || !json.image) throw new Error('No se pudo obtener la imagen.')

    await conn.sendMessage(m.chat, {
      image: { url: json.image },
      caption: `🔞 「 NST 」\n\n💎 » Diamantes restantes: ${restantes}`
    }, { quoted: m })

    await m.react('✅')
  } catch (e) {
    devolverDiamante(user, diamantes)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `❌ ${e.message || 'Error al obtener la imagen.'}\n💎 Diamante devuelto.`
    }, { quoted: m })
  }
}

handler.help    = ['nst']
handler.tags    = ['nsfw']
handler.command = /^(nst)$/i
handler.desc    = 'Envía una imagen NSFW de chicas 💎1'

export default handler
