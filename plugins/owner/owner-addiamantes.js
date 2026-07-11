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
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Cantidad inválida\n│ 🍃 Usa: .dardiamantes 100\n│ 🍃 Usa: .dardiamantes @usuario 100\n╰───────────────⬣'
    }, { quoted: m })
  }

  let user = global.db.data.users[target]
  if (!user) {
    global.db.data.users[target] = { diamantes: 0, bank: 0, exp: 0, level: 0 }
    user = global.db.data.users[target]
  }

  user.diamantes = (user.diamantes || 0) + cantidad
  global.markDatabaseModified()

  await conn.sendMessage(m.chat, {
    text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Diamantes entregados\n│ 🍃 Usuario: @' + target.split('@')[0] + '\n│ 🍃 +' + cantidad + ' 💎\n│ 🍃 Total: ' + user.diamantes + ' 💎\n╰───────────────⬣',
    mentions: [target]
  }, { quoted: m })
}

handler.help = ['dardiamantes']
handler.tags = ['owner']
handler.command = /^(dardiamantes|dardinero|adddiamantes)$/i
handler.desc = 'Da diamantes a un usuario'
handler.owner = true

export default handler