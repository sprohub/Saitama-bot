let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender

  let name = '@' + who.split('@')[0]

  let pp
  try {
    pp = await conn.profilePictureUrl(who, 'image')
  } catch {
    let texto = '╭━━⬣ *SAITAMA* ⬣\n'
    texto += '┃\n'
    texto += '┃ 💫 *SIN FOTO DE PERFIL*\n'
    texto += '┃\n'
    texto += '┃ 👤 ' + name + '\n'
    texto += '┃ ❌ No tiene foto pública\n'
    texto += '┃\n'
    texto += '┃ 「Ni siquiera eso pude golpear...」\n'
    texto += '┃\n'
    texto += '╰━━━━━━━━━━━━━━━━━━━━━━⬣ *SAITAMA*'

    return conn.sendMessage(m.chat, {
      text: texto,
      mentions: [who]
    }, { quoted: m })
  }

  let texto = '╭━━⬣ *SAITAMA* ⬣\n'
  texto += '┃\n'
  texto += '┃ 📸 *FOTO ROBADA*\n'
  texto += '┃\n'
  texto += '┃ 👤 ' + name + '\n'
  texto += '┃ 😈 Objetivo capturado\n'
  texto += '┃\n'
  texto += '┃ 「Un golpe. Una foto.」\n'
  texto += '┃\n'
  texto += '╰━━━━━━━━━━━━━━━━━━━━━━⬣ *SAITAMA*'

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
