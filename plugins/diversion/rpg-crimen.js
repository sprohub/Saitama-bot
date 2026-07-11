let cooldownsCrime = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsCrime[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA CRIMEN 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n⏳ » Escondido de la policía\n🕐 » ' + minutos + 'm ' + segundos + 's\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let random = Math.random()
  let diamantes, exp, tipo

  if (random < 0.20) {
    diamantes = Math.floor(Math.random() * 11) + 10
    exp = Math.floor(Math.random() * 30) + 20
    tipo = ['🏦 Te infiltraste en el banco central. Abriste la bóveda y vaciaste tres cajas de seguridad.', '💎 Robaste una joyería haciéndote pasar por cliente VIP. Guardaste todo en un maletín falso.', '🚛 Asaltaste un camión blindado con una grúa modificada. El botín era enorme.', '🎰 Hackeaste el sistema de un casino. Modificaste los pagos a tu favor.', '🖼️ Robaste una galería de arte durante la inauguración. Nadie notó los espacios vacíos.']
  } else if (random < 0.45) {
    diamantes = Math.floor(Math.random() * 6) + 3
    exp = Math.floor(Math.random() * 20) + 10
    tipo = ['🥷 Entraste a una casa por la ventana. Encontraste dinero bajo la cómoda.', '🛒 Llenaste dos carritos en el súper y los vendiste en el mercado negro.', '📱 Robaste celulares en el metro. Los vendiste por partes.', '🔑 Con una llave maestra entraste a tres habitaciones de hotel.', '🏍️ Robaste una moto del estacionamiento. La vendiste por piezas.']
  } else if (random < 0.65) {
    diamantes = Math.floor(Math.random() * 4) + 1
    exp = Math.floor(Math.random() * 15) + 5
    tipo = ['🪙 Le quitaste la cartera a un borracho dormido. Tenía algunos billetes.', '🍫 Te robaste chocolates caros y los vendiste afuera de la escuela.', '🌂 Robaste paraguas de un restaurante elegante en día lluvioso.', '📚 Vendiste fotocopias piratas de libros universitarios.', '🪙 Vaciaste el monedero de propinas de una cafetería.']
  } else {
    diamantes = -(Math.floor(Math.random() * 8) + 3)
    exp = Math.floor(Math.random() * 5) + 1
    tipo = ['🚔 La policía te atrapó. Pasaste la noche en el calabozo.', '📸 Las cámaras te identificaron. Tuviste que pagar fianza.', '🕵️ Un cómplice era policía encubierto. Multa por tentativa.', '🐕 Un pitbull te agarró el pantalón. Pagaste daños al jardín.', '🧓 La viejita era ex marine. Te inmovilizó hasta que llegó la policía.']
  }

  let mensaje = tipo[Math.floor(Math.random() * tipo.length)]
  user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  user.exp = (user.exp || 0) + exp
  cooldownsCrime[who] = now + 180000

  let texto = '⚔️ 「 HINATA CRIMEN 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '📋 » ' + mensaje + '\n'
  texto += '💎 » Diamantes: ' + (diamantes > 0 ? '+' : '') + diamantes + '\n'
  texto += '✨ » Experiencia: +' + exp + '\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ⏳ 3 minutos'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['crimen']
handler.tags = ['rpg']
handler.command = /^(crime|crimen|robar)$/i
handler.desc = 'Comete un crimen para ganar diamantes y exp'

export default handler