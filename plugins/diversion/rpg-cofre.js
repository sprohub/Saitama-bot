let cooldownsCofre = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsCofre[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA COFRE 」 ˚ʚ♡ɞ˚\n\n💫 » Espera ' + minutos + 'm'
    }, { quoted: m })
  }

  let random = Math.random()
  let tipo, emoji, diamantes, exp

  if (random < 0.10) {
    tipo = 'Cofre de Diamante'
    emoji = '💎'
    diamantes = Math.floor(Math.random() * 31) + 20
    exp = Math.floor(Math.random() * 51) + 50
  } else if (random < 0.35) {
    tipo = 'Cofre de Oro'
    emoji = '🟡'
    diamantes = Math.floor(Math.random() * 16) + 10
    exp = Math.floor(Math.random() * 31) + 20
  } else if (random < 0.70) {
    tipo = 'Cofre de Plata'
    emoji = '⚪'
    diamantes = Math.floor(Math.random() * 8) + 5
    exp = Math.floor(Math.random() * 16) + 10
  } else {
    tipo = 'Cofre de Madera'
    emoji = '🟤'
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 11) + 5
  }

  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + exp
  cooldownsCofre[who] = now + 3600000

  let texto = '𖣔 「 HINATA COFRE 」 ˚ʚ♡ɞ˚\n\n'
  texto += emoji + ' » ' + tipo + '\n'
  texto += '💎 » +' + diamantes + ' diamantes\n'
  texto += '✨ » +' + exp + ' exp\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['cofre']
handler.tags = ['rpg']
handler.command = /^(cofre|chest|tesoro)$/i
handler.desc = 'Abre un cofre misterioso'

export default handler