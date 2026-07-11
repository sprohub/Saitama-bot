let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA DEMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA DEMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo administradores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA DEMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ La bot necesita ser admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '👥 「 HINATA DEMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Menciona o responde a quien quitar admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'demote')
    await conn.sendMessage(m.chat, { 
      text: '👥 「 HINATA DEMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n✅ » @' + who.split('@')[0] + ' ya no es admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '👥 「 HINATA DEMOTE 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Error al quitar admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  }
}

handler.help = ['demote']
handler.tags = ['group']
handler.command = /^(demote|degradar|quitaradmin)$/i
handler.desc = 'Quita administrador'
handler.admin = true
handler.botAdmin = true

export default handler