let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0 }
    user = global.db.data.users[who]
  }

  let texto = '⚔️ 「 HINATA BANK 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '💰 » Cartera: ' + (user.diamantes || 0) + ' 💎\n'
  texto += '🏦 » Banco: ' + (user.bank || 0) + ' 💎\n'
  texto += '💎 » Total: ' + ((user.diamantes || 0) + (user.bank || 0)) + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n> #dep <cantidad> | #dep all\n> #ret <cantidad> | #ret all'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['banco']
handler.tags = ['rpg']
handler.command = /^(banco|bank|saldo)$/i
handler.desc = 'Muestra tu saldo del banco'

export default handler