let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0, bank: 0 }
    user = global.db.data.users[who]
  }

  let target = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : null
  let cantidad = target ? parseInt(args[1]) : parseInt(args[0])

  if (!target || isNaN(cantidad) || cantidad <= 0) {
    return conn.sendMessage(m.chat, {
      text: '💸 「 HINATA PAY 」 💸\n\n💫 » Transfiere diamantes\n\n> #pay @usuario <cantidad>'
    }, { quoted: m })
  }

  if (target === who) {
    return conn.sendMessage(m.chat, {
      text: '💸 「 HINATA PAY 」 💸\n\n💫 » No te puedes pagar a ti mismo'
    }, { quoted: m })
  }

  let misDiamantes = user.diamantes || user.diamond || 0

  if (misDiamantes < cantidad) {
    return conn.sendMessage(m.chat, {
      text: '💸 「 HINATA PAY 」 💸\n\n💫 » No tienes suficientes diamantes\n💰 » Tienes: ' + misDiamantes + ' 💎'
    }, { quoted: m })
  }

  if (user.diamantes !== undefined) {
    user.diamantes = misDiamantes - cantidad
  } else {
    user.diamond = misDiamantes - cantidad
  }

  let targetUser = global.db.data.users[target]
  if (!targetUser) {
    global.db.data.users[target] = { diamantes: 0, diamond: 0 }
    targetUser = global.db.data.users[target]
  }

  if (targetUser.diamantes !== undefined) {
    targetUser.diamantes = (targetUser.diamantes || 0) + cantidad
  } else {
    targetUser.diamond = (targetUser.diamond || 0) + cantidad
  }

  let miTotal = user.diamantes || user.diamond || 0
  let suTotal = targetUser.diamantes || targetUser.diamond || 0

  let texto = '💸 「 HINATA PAY 」 💸\n\n'
  texto += '✅ » Transferencia exitosa\n\n'
  texto += '📤 » @' + who.split('@')[0] + '\n'
  texto += '📥 » @' + target.split('@')[0] + '\n'
  texto += '💎 » ' + cantidad + ' diamantes\n\n'
  texto += '💰 Tu saldo: ' + miTotal + ' 💎'

  await conn.sendMessage(m.chat, { text: texto, mentions: [who, target] }, { quoted: m })
}

handler.help = ['pay']
handler.tags = ['rpg']
handler.command = /^(pay|pagar|transferir)$/i
handler.desc = 'Transfiere diamantes a otro usuario'

export default handler