const handler = async (m, { conn, isBotAdmin }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Este comando solo funciona en grupos.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  if (!isBotAdmin) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 El bot necesita ser administrador\n` +
        `│ del grupo para poder expulsar.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  const who = (m.mentionedJid && m.mentionedJid[0]) || (m.quoted ? m.quoted.sender : null)

  if (!who) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Menciona o responde a quien\n` +
        `│ quieres expulsar.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  const metadata = await conn.groupMetadata(m.chat)
  const esSuperAdmin = metadata.participants.some(p => p.id === who && p.admin === 'superadmin')

  if (esSuperAdmin) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 No se puede expulsar al creador\n` +
        `│ 👑 @${who.split('@')[0]}\n` +
        `╰───────────────⬣`,
      mentions: [who]
    }, { quoted: m })
  }

  try {
    await conn.groupParticipantsUpdate(m.chat, [who], 'remove')
    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ @${who.split('@')[0]} fue expulsado\n` +
        `╰───────────────⬣`,
      mentions: [who]
    }, { quoted: m })
  } catch (e) {
    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ❌ Error al expulsar.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['kick <@usuario>']
handler.tags = ['owner']
handler.command = /^(kick|echar|expulsar)$/i
handler.desc = 'Expulsa a un miembro del grupo (solo owners)'
handler.owner = true
handler.botAdmin = true

export default handler