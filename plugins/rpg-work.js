let cooldownsWork = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsWork[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA WORK 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n⏳ » Descansando...\n🕐 » ' + minutos + 'm ' + segundos + 's\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let random = Math.random()
  let diamantes = 1
  let exp = Math.floor(Math.random() * 20) + 5
  let rareza = '⭐'

  if (random < 0.15) {
    diamantes = 2
    rareza = '🌟🌟'
  } else if (random < 0.05) {
    diamantes = 3
    rareza = '🌟🌟🌟'
  }

  let trabajos = [
    '💻 Programaste una app y te pagaron',
    '🍳 Cocinaste en un restaurante',
    '📦 Repartiste paquetes por la ciudad',
    '🎤 Cantaste en la calle y te dieron propina',
    '🏗️ Trabajaste en construcción',
    '📞 Vendiste seguros por teléfono',
    '🎨 Vendiste un dibujo en la plaza',
    '📚 Diste clases particulares'
  ]

  let perdidas = [
    { texto: '💔 Te estafaron con un trabajo falso', diamantes: -1 },
    { texto: '🎰 Apostaste tu pago y perdiste', diamantes: -1 },
    { texto: '🦝 Te robaron el dinero del día', diamantes: -1 }
  ]

  let esPerdida = random < 0.10
  let trabajo
  let cambio

  if (esPerdida) {
    trabajo = perdidas[Math.floor(Math.random() * perdidas.length)]
    cambio = trabajo.diamantes
  } else {
    trabajo = { texto: trabajos[Math.floor(Math.random() * trabajos.length)] }
    cambio = diamantes
  }

  user.diamantes = Math.max(0, (user.diamantes || 0) + cambio)
  user.exp = (user.exp || 0) + exp
  cooldownsWork[who] = now + 120000

  let texto = '⚔️ 「 HINATA WORK 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '📋 » ' + trabajo.texto + '\n'
  texto += '💎 » Diamantes: ' + (cambio > 0 ? '+' : '') + cambio + ' ' + rareza + '\n'
  texto += '✨ » Experiencia: +' + exp + '\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ⏳ 2 minutos'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['work']
handler.tags = ['rpg']
handler.command = /^(work|trabajar|chamba)$/i
handler.desc = 'Trabaja para ganar diamantes y exp'

export default handler