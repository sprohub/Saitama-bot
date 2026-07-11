let cooldownsCazar = {}

let imagenes = {
  'Oso pardo': 'https://i.ibb.co/BMFqbcQ/Oso-pardo.jpg',
  'Conejo': 'https://i.ibb.co/3ypNQz4P/Conejo.jpg',
  'Dragón salvaje': 'https://i.ibb.co/TMhBg5Bs/Drag-n-salvaje.jpg',
  'Ciervo': 'https://i.ibb.co/8DszczSQ/Ciervo.jpg'
}

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
    let textoCooldown = '╭─⪼ *SAITAMA-BOT*\n'
    textoCooldown += '│\n'
    textoCooldown += '│ » Espera ' + minutos + 'm ' + segundos + 's\n'
    textoCooldown += '╰───────────────⬣'
    return conn.sendMessage(m.chat, { text: textoCooldown }, { quoted: m })
  }

  let random = Math.random()
  let animal, emoji, diamantes, exp, rareza

  if (random < 0.05) {
    animal = 'Dragón salvaje'
    emoji = '🐉'
    diamantes = Math.floor(Math.random() * 11) + 10
    exp = Math.floor(Math.random() * 31) + 20
    rareza = 'Legendario'
  } else if (random < 0.20) {
    animal = 'Oso pardo'
    emoji = '🐻'
    diamantes = Math.floor(Math.random() * 6) + 5
    exp = Math.floor(Math.random() * 21) + 10
    rareza = 'Épico'
  } else if (random < 0.50) {
    animal = 'Ciervo'
    emoji = '🦌'
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 11) + 5
    rareza = 'Normal'
  } else {
    animal = 'Conejo'
    emoji = '🐰'
    diamantes = Math.floor(Math.random() * 2) + 1
    exp = Math.floor(Math.random() * 6) + 3
    rareza = 'Común'
  }

  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + exp
  cooldownsCazar[who] = now + 300000

  let texto = '╭─⪼ *SAITAMA-BOT*\n'
  texto += '│\n'
  texto += '│ ' + emoji + ' » ' + rareza + '\n'
  texto += '│ » Cazaste un ' + animal + '\n'
  texto += '│ » +' + diamantes + ' diamantes\n'
  texto += '│ » +' + exp + ' exp\n'
  texto += '│ » Total: ' + user.diamantes + '\n'
  texto += '╰───────────────⬣'

  let imagenUrl = imagenes[animal]

  await conn.sendMessage(m.chat, {
    image: { url: imagenUrl },
    caption: texto
  }, { quoted: m })
}

handler.help = ['cazar']
handler.tags = ['rpg']
handler.command = /^(cazar|hunt)$/i
handler.desc = 'Caza animales para ganar diamantes y exp'

export default handler
