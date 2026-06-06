let handler = async (m, { conn, args }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, {
      text: '✨ 「 HINATA DAR XP 」 ✨\n\n💫 » Solo los creadores pueden usar esto'
    }, { quoted: m })
  }

  let target = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : who
  let cantidad = target === who ? parseInt(args[0]) : parseInt(args[1])

  if (isNaN(cantidad) || cantidad <= 0) {
    return conn.sendMessage(m.chat, {
      text: '✨ 「 HINATA DAR XP 」 ✨\n\n💫 » Cantidad inválida\n\n> #darxp 500\n> #darxp @usuario 500'
    }, { quoted: m })
  }

  let user = global.db.data.users[target]
  if (!user) {
    global.db.data.users[target] = { exp: 0, level: 0 }
    user = global.db.data.users[target]
  }

  user.exp = (user.exp || 0) + cantidad

  let texto = '✨ 「 HINATA DAR XP 」 ✨\n\n'
  texto += '✅ » Experiencia entregada\n\n'
  texto += '👤 » @' + target.split('@')[0] + '\n'
  texto += '✨ » +' + cantidad + ' exp\n'
  texto += '📊 » Total: ' + user.exp + ' exp\n'
  texto += '⭐ » Nivel: ' + (user.level || 0)

  await conn.sendMessage(m.chat, { text: texto, mentions: [target] }, { quoted: m })
}

handler.help = ['darxp']
handler.tags = ['owner']
handler.command = /^(darxp|givexp|addexp)$/i
handler.desc = 'Da experiencia a un usuario'
handler.owner = true

export default handler