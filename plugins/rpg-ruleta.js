let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, bank: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  if (!args[0]) {
    return conn.sendMessage(m.chat, {
      text: '🎡 「 HINATA RULETA 」 🎡\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Apuesta y gira la ruleta\n\n🎯 » #ruleta <cantidad> <color>\n🔴 » Red = x2\n⚫ » Black = x2\n🟢 » Green = x10\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n> #ruleta 10 red'
    }, { quoted: m })
  }

  let apuesta = parseInt(args[0])
  let color = args[1]?.toLowerCase()

  if (isNaN(apuesta) || apuesta <= 0) {
    return conn.sendMessage(m.chat, {
      text: '🎡 「 HINATA RULETA 」 🎡\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Cantidad inválida\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  if (!color || !['red', 'black', 'green'].includes(color)) {
    return conn.sendMessage(m.chat, {
      text: '🎡 「 HINATA RULETA 」 🎡\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Elige un color\n🔴 red | ⚫ black | 🟢 green\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  let misDiamantes = user.diamantes || user.diamond || 0
  if (misDiamantes < apuesta) {
    return conn.sendMessage(m.chat, {
      text: '🎡 「 HINATA RULETA 」 🎡\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » No tienes tantos diamantes\n💰 » Tienes: ' + misDiamantes + ' 💎\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  let resultado
  let random = Math.random()

  if (color === 'green') {
    resultado = random < 0.05 ? 'green' : random < 0.525 ? 'red' : 'black'
  } else {
    resultado = random < 0.05 ? 'green' : random < 0.525 ? 'red' : 'black'
  }

  let gano = resultado === color
  let multiplicador = color === 'green' ? 10 : 2
  let ganancia = gano ? apuesta * multiplicador : 0

  if (user.diamantes !== undefined) {
    user.diamantes = misDiamantes - apuesta + ganancia
  } else {
    user.diamond = misDiamantes - apuesta + ganancia
  }

  let emojis = { red: '🔴', black: '⚫', green: '🟢' }

  let texto = '🎡 「 HINATA RULETA 」 🎡\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n'
  texto += '💫 » Apostaste ' + apuesta + ' 💎 a ' + emojis[color] + '\n'
  texto += '🎡 » Girando... ¡Salió ' + emojis[resultado] + ' ' + resultado.toUpperCase() + '!\n\n'

  if (gano) {
    texto += '🏆 » ¡GANASTE!\n'
    texto += '💎 » +' + ganancia + ' diamantes\n'
  } else {
    texto += '💀 » PERDISTE\n'
    texto += '💎 » -' + apuesta + ' diamantes\n'
  }

  let total = user.diamantes || user.diamond || 0
  texto += '💰 » Total: ' + total + ' 💎\n\n'
  texto += '✦•┈๑⋅⋯ ⋯⋅๑┈•✦'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['ruleta']
handler.tags = ['rpg']
handler.command = /^(ruleta|roulette)$/i
handler.desc = 'Apuesta en la ruleta'

export default handler