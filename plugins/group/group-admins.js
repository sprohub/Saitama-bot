let handler = async (m, { conn, participants, groupMetadata }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo para grupos\n╰───────────────⬣' }, { quoted: m })

  let admins = participants.filter(p => p.admin)

  let texto = `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Administradores del grupo\n│\n`

  for (let admin of admins) {
    let rol = admin.admin === 'superadmin' ? '👑 Creador' : '🛡️ Admin'
    texto += `│ ${rol} » @${admin.id.split('@')[0]}\n`
  }

  texto += `╰───────────────⬣`

  let mentions = admins.map(a => a.id)

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