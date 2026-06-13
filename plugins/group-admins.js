let handler = async (m, { conn, participants, groupMetadata }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '𖣔 」 ˚ʚ♡ɞ˚\n\n💫 » Solo para grupos' }, { quoted: m })

  let admins = participants.filter(p => p.admin)
  let owner = groupMetadata.owner

  let texto = `╭━━⬣ 「 SAITAMA ADMINS 」\n\n`
  texto += `┃ 👑 Creador » @${owner.split('@')[0]}\n`

  for (let admin of admins) {
    let rol = admin.admin === 'superadmin' ? '👑 Creador' : '🛡️ Admin'
    texto += `┃ ${rol} » @${admin.id.split('@')[0]}\n`
  }

  texto += `\n╰━━━━━━━━━━━━━━━━━━━━━━⬣\n⫏⫏ SAITAMA BOT ✿`

  let mentions = admins.map(a => a.id)
  mentions.push(owner)

  await conn.sendMessage(m.chat, {
    image: { url: 'https://i.ibb.co/j94w01QV/mascota.jpg' },
    caption: texto,
    mentions
  }, { quoted: m })
}

handler.help = ['admins']
handler.tags = ['group']
handler.command = /^(admins|administradores|staff)$/i
handler.desc = 'Lista de administradores del grupo'
handler.group = true

export default handler