let handler = async (m, { conn, isOwner }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo para grupos\n╰───────────────⬣' }, { quoted: m })
  if (!isOwner) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el owner puede usar este comando\n╰───────────────⬣' }, { quoted: m })
  if (!m.quoted) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Responde al mensaje a borrar\n╰───────────────⬣' }, { quoted: m })

  await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.quoted.id || m.quoted.key?.id, participant: m.quoted.sender || m.quoted.key?.participant }})
}

handler.help = ['delete']
handler.tags = ['group']
handler.command = /^(delete|del|borrar)$/i
handler.desc = 'Borra un mensaje'
handler.owner = true

export default handler