let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA PROMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA PROMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo administradores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA PROMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ La bot necesita ser admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '👥 「 HINATA PROMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Menciona o responde a quien dar admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'promote')
    await conn.sendMessage(m.chat, { 
      text: '👥 「 HINATA PROMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n✅ » @' + who.split('@')[0] + ' ahora es admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '👥 「 HINATA PROMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Error al dar admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  }
}

handler.help = ['promote']
handler.tags = ['group']
handler.command = /^(promote|promover|daradmin)$/i
handler.desc = 'Da administrador'
handler.admin = true
handler.botAdmin = true

export default handler