let handler = async (m, { conn, isOwner, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo para grupos\n╰───────────────⬣' }, { quoted: m })
  if (!isOwner) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el owner puede usar este comando\n╰───────────────⬣' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 La bot necesita ser admin\n╰───────────────⬣' }, { quoted: m })

  await conn.groupSettingUpdate(m.chat, 'announcement')
  await conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Grupo cerrado, solo admins hablan\n╰───────────────⬣' }, { quoted: m })
}

handler.help = ['close']
handler.tags = ['group']
handler.command = /^(close|cerrar)$/i
handler.desc = 'Cierra el grupo'
handler.owner = true
handler.botAdmin = true

export default handler