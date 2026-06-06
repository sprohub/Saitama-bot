let cooldownsSlut = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsSlut[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA SLUT 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n⏳ » Descansando...\n🕐 » ' + minutos + 'm ' + segundos + 's\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let random = Math.random()
  let diamantes, personas, exp, tipo

  if (random < 0.04) {
    personas = Math.floor(Math.random() * 6) + 5
    diamantes = personas * 2
    exp = Math.floor(Math.random() * 30) + 20
    tipo = ['💎 Fuiste a la zona exclusiva con tu mejor outfit. Un magnate, su guardaespaldas y un jeque te llenaron de propinas.', '🛥️ Un yate de lujo atracó y terminaste en la fiesta privada con actores y cantantes. Champán y billetes.', '⚽ Te contrataron para una despedida de soltero de un futbolista famoso. Todos te pagaron con billetes nuevos.', '🏢 Un congreso de empresarios te contrató como masajista. Todos te dieron propina y tarjetas de contacto.']
  } else if (random < 0.15) {
    personas = Math.floor(Math.random() * 4) + 4
    diamantes = Math.floor(personas * 1.5)
    exp = Math.floor(Math.random() * 20) + 10
    tipo = ['👔 Un grupo de oficinistas celebrando un ascenso. Luego un señor en un mercedes. Buena noche.', '🚗 La convención de vendedores estaba en el hotel. Terminaste con el gerente y dos vendedores estrella.', '🪖 La base militar estaba de celebración. Un sargento, dos cabos y tres soldados. Te pagaron entre todos.', '🏗️ El equipo de construcción celebró el fin de obra. Arquitecto, ingeniero y tres albañiles con dinero fresco.']
  } else if (random < 0.35) {
    personas = Math.floor(Math.random() * 3) + 3
    diamantes = personas
    exp = Math.floor(Math.random() * 15) + 5
    tipo = ['🕺 Fuiste a la discoteca con falda corta. Tres borrachos te invitaron a su mesa VIP.', '🚛 Te paraste en la gasolinera. Tres camioneros y un viajero perdido. Dinero rápido.', '🚕 La plaza de taxistas de noche. Tres taxistas y un vendedor de tacos. Cena incluida.', '🍺 El bar de mala muerte estaba lleno. Un poeta borracho, dos músicos y un panadero.']
  } else if (random < 0.60) {
    personas = Math.floor(Math.random() * 2) + 1
    diamantes = Math.floor(personas * 0.5) || 1
    exp = Math.floor(Math.random() * 10) + 3
    tipo = ['😴 Un solo cliente que se quedó dormido a los cinco minutos. Tuviste que despertarlo para cobrar.', '🪙 Un cliente regateó media hora. Pagó con monedas sueltas que contó una por una.', '🌧️ Llovió toda la noche. Solo un borracho te pidió direcciones y te dio las monedas que traía.']
  } else {
    personas = 0
    diamantes = -(Math.floor(Math.random() * 8) + 3)
    exp = Math.floor(Math.random() * 5) + 1
    tipo = ['🚔 La policía hizo una redada. Te llevaron detenida. Multa por escándalo público.', '💊 Un cliente te contagió una infección. Tuviste que comprar antibióticos caros.', '🏥 Un cliente fue muy brusco y terminaste en urgencias. Puntos de sutura y calmantes.', '🔪 Un grupo te contrató pero era una trampa. Te encerraron y te robaron todo.', '👊 Un tipo resultó ser psicópata. Te golpeó y te dejó en un motel. Despertaste en el hospital.', '🤰 Después de varias semanas de náuseas fuiste al médico. Ahora tienes que comprar vitaminas prenatales.']
  }

  let mensaje = tipo[Math.floor(Math.random() * tipo.length)]
  user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  user.exp = (user.exp || 0) + exp
  cooldownsSlut[who] = now + 240000

  let texto = '⚔️ 「 HINATA SLUT 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '📋 » ' + mensaje + '\n'
  if (personas > 0) texto += '👥 » Clientes: ' + personas + '\n'
  texto += '💎 » Diamantes: ' + (diamantes > 0 ? '+' : '') + diamantes + '\n'
  texto += '✨ » Experiencia: +' + exp + '\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ⏳ 4 minutos'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['slut']
handler.tags = ['rpg']
handler.command = /^(slut|prostituta|escort)$/i
handler.desc = 'Trabaja en las calles'

export default handler