let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA KICK 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA KICK 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ La bot necesita ser admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA KICK 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo administradores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '👥 「 HINATA KICK 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Menciona o responde a quien expulsar\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let metadata = await conn.groupMetadata(m.chat)
  let isOwner = metadata.participants.some(p => p.id === who && p.admin === 'superadmin')

  if (isOwner) {
    return conn.sendMessage(m.chat, { 
      text: '👥 「 HINATA KICK 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ No se puede expulsar al creador\n👑 » @' + who.split('@')[0] + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔',
      mentions: [who]
    }, { quoted: m })
  }

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'remove')
    await conn.sendMessage(m.chat, { 
      text: '👥 「 HINATA KICK 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n✅ » @' + who.split('@')[0] + ' expulsado\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '👥 「 HINATA KICK 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Error al expulsar\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  }
}

handler.help = ['kick']
handler.tags = ['group']
handler.command = /^(kick|echar|expulsar)$/i
handler.desc = 'Expulsa a un miembro'
handler.admin = true
handler.botAdmin = true

export default handler