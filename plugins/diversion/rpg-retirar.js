let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0 }
    user = global.db.data.users[who]
  }

  if (!args[0]) return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA RET 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> #ret 100 | #ret all' }, { quoted: m })

  let cantidad = args[0].toLowerCase() === 'all' ? (user.bank || 0) : parseInt(args[0])
  if (isNaN(cantidad) || cantidad <= 0) return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA RET 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if ((user.bank || 0) < cantidad) return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA RET 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » No tienes tanto\n🏦 » Banco: ' + (user.bank || 0) + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  user.bank -= cantidad
  user.diamantes = (user.diamantes || 0) + cantidad

  await conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA RET 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n✅ » Retiraste ' + cantidad + ' 💎\n🏦 » Banco: ' + user.bank + ' 💎\n💰 » Cartera: ' + user.diamantes + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
}

handler.help = ['retirar']
handler.tags = ['rpg']
handler.command = /^(ret|retirar)$/i
handler.desc = 'Retira diamantes del banco'

export default handler