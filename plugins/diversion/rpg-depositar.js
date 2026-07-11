let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0 }
    user = global.db.data.users[who]
  }

  if (!args[0]) return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA DEP 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> #dep 100 | #dep all' }, { quoted: m })

  let cantidad = args[0].toLowerCase() === 'all' ? (user.diamantes || 0) : parseInt(args[0])
  if (isNaN(cantidad) || cantidad <= 0) return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA DEP 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if ((user.diamantes || 0) < cantidad) return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA DEP 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » No tienes tanto\n💰 » Cartera: ' + (user.diamantes || 0) + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  user.diamantes -= cantidad
  user.bank = (user.bank || 0) + cantidad

  await conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA DEP 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n✅ » Depositaste ' + cantidad + ' 💎\n🏦 » Banco: ' + user.bank + ' 💎\n💰 » Cartera: ' + user.diamantes + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
}

handler.help = ['depositar']
handler.tags = ['rpg']
handler.command = /^(dep|depositar)$/i
handler.desc = 'Deposita diamantes al banco'

export default handler