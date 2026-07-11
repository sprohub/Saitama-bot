let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let texto = '⚔️ 「 HINATA WALLET 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💰 » Cartera: ' + (user.diamantes || 0) + ' 💎\n'
  texto += '🏦 » Banco: ' + (user.bank || 0) + ' 💎\n'
  texto += '💎 » Total: ' + ((user.diamantes || 0) + (user.bank || 0)) + ' 💎\n'
  texto += '⭐ » Nivel: ' + (user.level || 0) + '\n'
  texto += '✨ » Experiencia: ' + (user.exp || 0) + '\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n> #dep | #ret | #dep all | #ret all'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['wallet']
handler.tags = ['rpg']
handler.command = /^(diamantes|wallet|cartera|dinero|bal|balance)$/i
handler.desc = 'Muestra tus diamantes'

export default handler