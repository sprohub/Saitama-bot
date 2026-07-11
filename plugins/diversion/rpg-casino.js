let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let colores = ['red', 'blue', 'black']
  let emojis = { red: '🔴', blue: '🔵', black: '⚫' }

  if (!args[0] || !colores.includes(args[0].toLowerCase()) || !args[1]) {
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA CASINO 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🎯 » Apuesta a un color\n🔴 » Red = x2\n🔵 » Blue = x3\n⚫ » Black = x5\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> #casino red 10'
    }, { quoted: m })
  }

  let color = args[0].toLowerCase()
  let apuesta = parseInt(args[1])

  if (isNaN(apuesta) || apuesta <= 0) {
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA CASINO 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Cantidad inválida\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  if ((user.diamantes || 0) < apuesta) {
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA CASINO 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » No tienes tantos diamantes\n💎 » Tienes: ' + (user.diamantes || 0) + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let resultado = colores[Math.floor(Math.random() * colores.length)]
  let gano = resultado === color
  let multiplicador = color === 'red' ? 2 : color === 'blue' ? 3 : 5
  let ganancia = gano ? apuesta * multiplicador : 0

  user.diamantes = (user.diamantes || 0) - apuesta + ganancia
  user.exp = (user.exp || 0) + Math.floor(Math.random() * 10) + 5

  let texto = '⚔️ 「 HINATA CASINO 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '🎯 » Apuesta: ' + apuesta + ' 💎\n'
  texto += '🎨 » Color: ' + emojis[color] + ' ' + color.toUpperCase() + '\n'
  texto += '📊 » Multiplicador: x' + multiplicador + '\n\n'
  texto += '🎲 » Salió: ' + emojis[resultado] + ' ' + resultado.toUpperCase() + '!\n\n'

  if (gano) {
    texto += '🏆 » ¡GANASTE!\n💎 » +' + ganancia + ' diamantes\n'
  } else {
    texto += '💀 » PERDISTE\n💎 » -' + apuesta + ' diamantes\n'
  }
  texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['casino']
handler.tags = ['rpg']
handler.command = /^(casino|apostar|bet)$/i
handler.desc = 'Apuesta en el casino'

export default handler