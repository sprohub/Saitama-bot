let handler = async (m, { conn, isAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA DELETE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA DELETE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo administradores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!m.quoted) return conn.sendMessage(m.chat, { text: '👥 「 HINATA DELETE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Responde al mensaje a borrar\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.quoted.id || m.quoted.key?.id, participant: m.quoted.sender || m.quoted.key?.participant }})
}

handler.help = ['delete']
handler.tags = ['group']
handler.command = /^(delete|del|borrar)$/i
handler.desc = 'Borra un mensaje'
handler.admin = true

export default handler