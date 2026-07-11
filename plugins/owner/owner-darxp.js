let handler = async (m, { conn, args }) => {
  let who = m.sender

  let esOwner = () => {
    if (!global.owner || !Array.isArray(global.owner)) return false
    let numeros = global.owner.map(([number]) => (number || '').replace(/[^0-9]/g, ''))
    return numeros.some(num => who.includes(num))
  }

  if (!m.fromMe && !esOwner()) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo los creadores pueden usar esto\n╰───────────────⬣'
    }, { quoted: m })
  }

  let target = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : who
  let cantidad = target === who ? parseInt(args[0]) : parseInt(args[1])

  if (isNaN(cantidad) || cantidad <= 0) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Cantidad inválida\n│ 🍃 Usa: .darxp 500\n│ 🍃 Usa: .darxp @usuario 500\n╰───────────────⬣'
    }, { quoted: m })
  }

  let user = global.db.data.users[target]
  if (!user) {
    global.db.data.users[target] = { exp: 0, level: 0 }
    user = global.db.data.users[target]
  }

  user.exp = (user.exp || 0) + cantidad
  global.markDatabaseModified()

  let texto = '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Experiencia entregada\n│ 🍃 Usuario: @' + target.split('@')[0] + '\n│ 🍃 +' + cantidad + ' exp\n│ 🍃 Total: ' + user.exp + ' exp\n│ 🍃 Nivel: ' + (user.level || 0) + '\n╰───────────────⬣'

  await conn.sendMessage(m.chat, { text: texto, mentions: [target] }, { quoted: m })
}

handler.help = ['darxp']
handler.tags = ['owner']
handler.command = /^(darxp|givexp|addexp)$/i
handler.desc = 'Da experiencia a un usuario'
handler.owner = true

export default handler