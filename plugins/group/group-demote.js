let handler = async (m, { conn, isOwner, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo para grupos\n╰───────────────⬣' }, { quoted: m })
  if (!isOwner) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el owner puede usar este comando\n╰───────────────⬣' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 La bot necesita ser admin\n╰───────────────⬣' }, { quoted: m })

  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  if (!who) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Menciona o responde a quien quitar admin\n╰───────────────⬣' }, { quoted: m })

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'demote')
    await conn.sendMessage(m.chat, { 
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 @' + who.split('@')[0] + ' ya no es admin\n╰───────────────⬣',
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Error al quitar admin\n╰───────────────⬣' }, { quoted: m })
  }
}

handler.help = ['demote']
handler.tags = ['group']
handler.command = /^(demote|degradar|quitaradmin)$/i
handler.desc = 'Quita administrador'
handler.owner = true
handler.botAdmin = true

export default handler