let cooldownsCazar = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsCazar[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA CAZAR 」 ˚ʚ♡ɞ˚\n\n💫 » Espera ' + minutos + 'm ' + segundos + 's'
    }, { quoted: m })
  }

  let random = Math.random()
  let animal, emoji, diamantes, exp, rareza

  if (random < 0.05) {
    animal = 'Dragón salvaje'
    emoji = '🐉'
    diamantes = Math.floor(Math.random() * 11) + 10
    exp = Math.floor(Math.random() * 31) + 20
    rareza = '🌟 Legendario'
  } else if (random < 0.20) {
    animal = 'Oso pardo'
    emoji = '🐻'
    diamantes = Math.floor(Math.random() * 6) + 5
    exp = Math.floor(Math.random() * 21) + 10
    rareza = '⭐ Épico'
  } else if (random < 0.50) {
    animal = 'Ciervo'
    emoji = '🦌'
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 11) + 5
    rareza = '✨ Normal'
  } else {
    animal = 'Conejo'
    emoji = '🐰'
    diamantes = Math.floor(Math.random() * 2) + 1
    exp = Math.floor(Math.random() * 6) + 3
    rareza = '🔹 Común'
  }

  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + exp
  cooldownsCazar[who] = now + 300000

  let texto = '𖣔 「 HINATA CAZAR 」 ˚ʚ♡ɞ˚\n\n'
  texto += emoji + ' » ' + rareza + '\n'
  texto += '🎯 » Cazaste un ' + animal + '\n'
  texto += '💎 » +' + diamantes + ' diamantes\n'
  texto += '✨ » +' + exp + ' exp\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['cazar']
handler.tags = ['rpg']
handler.command = /^(cazar|hunt)$/i
handler.desc = 'Caza animales para ganar diamantes y exp'

export default handler