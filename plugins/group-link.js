let handler = async (m, { conn }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '╭━━⬣ 「 SAITAMA LINK 」\n┃ 💫 Solo para grupos\n╰━━━━━━━━━━━━━━━━━━━━━━⬣' }, { quoted: m })

  let code = await conn.groupInviteCode(m.chat)
  let link = 'https://chat.whatsapp.com/' + code

  let texto = `╭━━⬣ 「 SAITAMA LINK 」\n┃ 🔗 Enlace del grupo\n┃ 📋 ${link}\n╰━━━━━━━━━━━━━━━━━━━━━━⬣\n⫏⫏ SAITAMA BOT ✿\n> Comparte con cuidado`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['link']
handler.tags = ['group']
handler.command = /^(link|enlace|invite)$/i
handler.desc = 'Obtén el enlace del grupo'
handler.group = true
handler.botAdmin = true

export default handler