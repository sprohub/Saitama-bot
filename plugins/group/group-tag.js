const handler = async (m, { conn, isAdmin, participants }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Este comando solo funciona en grupos.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  if (!isAdmin) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Solo los administradores del grupo\n` +
        `│ pueden usar este comando.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  let texto =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 📢 Mencionando a todos\n` +
    `│ 👥 Miembros: ${participants.length}\n` +
    `╰───────────────⬣\n\n`

  for (const p of participants) {
    texto += `🍃 » @${p.id.split('@')[0]}\n`
  }

  texto += `\n╭───────────────⬣\n│ 🌿 SAITAMA-BOT\n╰───────────────⬣`

  await conn.sendMessage(m.chat, {
    text: texto,
    mentions: participants.map(p => p.id)
  }, { quoted: m })
}

handler.help = ['tagall']
handler.tags = ['group']
handler.command = /^(tagall|todos|all)$/i
handler.desc = 'Menciona a todos los miembros del grupo (solo admins)'
handler.admin = true

export default handler