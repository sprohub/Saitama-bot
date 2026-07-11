let handler = async (m, { conn, isAdmin, isBotAdmin, text }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA SETNAME 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA SETNAME 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo administradores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA SETNAME 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ La bot necesita ser admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!text) return conn.sendMessage(m.chat, { text: '👥 「 HINATA SETNAME 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Escribe el nuevo nombre\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  await conn.groupUpdateSubject(m.chat, text)
  await conn.sendMessage(m.chat, { text: '👥 「 HINATA SETNAME 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n✅ » Nombre actualizado\n📛 » ' + text + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
}

handler.help = ['setname']
handler.tags = ['group']
handler.command = /^(setname|setnombre|nombregrupo)$/i
handler.desc = 'Cambia el nombre del grupo'
handler.admin = true
handler.botAdmin = true

export default handler