let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender

  let pp
  try {
    pp = await conn.profilePictureUrl(who, 'image')
  } catch {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA PP 」 ˚ʚ♡ɞ˚\n\n💫 » No tiene foto de perfil'
    }, { quoted: m })
  }

  let name = '@' + who.split('@')[0]

  let texto = '𖣔 「 HINATA PP 」 ˚ʚ♡ɞ˚\n\n'
  texto += '📸 » ' + name + '\n'
  texto += '> Foto de perfil robada 😈'

  await conn.sendMessage(m.chat, {
    image: { url: pp },
    caption: texto,
    mentions: [who]
  }, { quoted: m })
}

handler.help = ['pp']
handler.tags = ['diversion']
handler.command = /^(pp|foto|avatar)$/i
handler.desc = 'Roba la foto de perfil'

export default handler