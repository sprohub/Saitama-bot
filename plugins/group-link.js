let handler = async (m, { conn }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '𖣔 「 HINATA LINK 」 ˚ʚ♡ɞ˚\n\n💫 » Solo para grupos' }, { quoted: m })

  let code = await conn.groupInviteCode(m.chat)
  let link = 'https://chat.whatsapp.com/' + code

  let texto = '𖣔 「 HINATA LINK 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🔗 » Enlace del grupo\n'
  texto += '📋 » ' + link + '\n\n'
  texto += '> Comparte con cuidado'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['link']
handler.tags = ['group']
handler.command = /^(link|enlace|invite)$/i
handler.desc = 'Obtén el enlace del grupo'
handler.group = true
handler.botAdmin = true

export default handler