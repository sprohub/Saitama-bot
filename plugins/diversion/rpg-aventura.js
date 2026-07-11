let cooldownsAventura = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsAventura[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA AVENTURA 」 ˚ʚ♡ɞ˚\n\n💫 » Espera ' + minutos + 'm ' + segundos + 's'
    }, { quoted: m })
  }

  let random = Math.random()
  let lugar, emoji, diamantes, exp

  if (random < 0.10) {
    lugar = 'Palacio del Rey Demonio'
    emoji = '👹'
    diamantes = Math.floor(Math.random() * 26) + 15
    exp = Math.floor(Math.random() * 51) + 30
  } else if (random < 0.30) {
    lugar = 'Mazmorra Oscura'
    emoji = '🕳️'
    diamantes = Math.floor(Math.random() * 16) + 10
    exp = Math.floor(Math.random() * 31) + 20
  } else if (random < 0.60) {
    lugar = 'Bosque Encantado'
    emoji = '🌲'
    diamantes = Math.floor(Math.random() * 8) + 5
    exp = Math.floor(Math.random() * 16) + 10
  } else if (random < 0.85) {
    lugar = 'Cueva de Goblins'
    emoji = '👺'
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 11) + 5
  } else {
    lugar = 'Trampa en el camino'
    emoji = '💀'
    diamantes = -Math.floor(Math.random() * 4) - 1
    exp = Math.floor(Math.random() * 6) + 2
  }

  user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  user.exp = (user.exp || 0) + exp
  cooldownsAventura[who] = now + 600000

  let texto = '𖣔 「 HINATA AVENTURA 」 ˚ʚ♡ɞ˚\n\n'
  texto += emoji + ' » ' + lugar + '\n'
  texto += '💎 » ' + (diamantes > 0 ? '+' : '') + diamantes + ' diamantes\n'
  texto += '✨ » +' + exp + ' exp\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['aventura']
handler.tags = ['rpg']
handler.command = /^(aventura|aventure|explorar)$/i
handler.desc = 'Explora en busca de tesoros'

export default handler