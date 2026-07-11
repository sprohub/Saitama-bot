let cooldownsFish = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsFish[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA FISH 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n⏳ » Caña descansando\n🕐 » ' + minutos + 'm ' + segundos + 's\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let random = Math.random()
  let diamantes, rareza, tipo

  if (random < 0.05) {
    diamantes = 5
    rareza = '🌟 Legendaria'
    tipo = ['🐋 Pesaste una ballena azul. Los biólogos te pagaron por liberarla.', '🦈 Un tiburón blanco mordió tu anzuelo. Lo vendiste al acuario.', '👑 Encontraste un cofre hundido con joyas y monedas de oro.', '🐙 Un pulpo gigante salió de la cueva. Restaurante de lujo te lo compró.', '🎣 Pesaste un pez espada de dos metros. Los chefs hicieron fila.']
  } else if (random < 0.15) {
    diamantes = 4
    rareza = '💫 Épica'
    tipo = ['🐟 Atún rojo de 200 kilos. Sushi premium para todo el restaurante.', '🦞 Langosta enorme entre las rocas. Batiste el récord local.', '🎣 Salmón real saltando como arcoíris. Lo vendiste carísimo.', '🐠 Peces loro de colores vibrantes. La tienda de acuarios te pagó doble.', '🦑 Calamar gigante con potera luminosa en la noche.']
  } else if (random < 0.30) {
    diamantes = 3
    rareza = '✨ Excelente'
    tipo = ['🐠 Pez dorado enorme en el estanque. El dueño de la tienda te recompensó.', '🦀 Tres cangrejos gordos en el manglar. El restaurante los necesitaba.', '🐟 Trucha arcoíris del lago de montaña. Un gourmet te pagó extra.', '🐡 Bagre enorme con tripas de pollo. Lo vendiste fresco.', '🦐 Camarones grandes con la red. Buen precio en el mercado.']
  } else if (random < 0.50) {
    diamantes = 2
    rareza = '👍 Buena'
    tipo = ['🐟 Lubina de buen tamaño. Ideal para la cena.', '🦀 Cangrejos en la trampa. El restaurante te dio buen dinero.', '🎣 Carpa grande con maíz dulce. La vendiste al vecino.', '🐡 Mero escondido entre las rocas. Buen ejemplar.', '🐟 Mojarra grande. Algo es algo.']
  } else {
    diamantes = 1
    rareza = '👌 Regular'
    tipo = ['🐟 Sardina diminuta. Al menos sirve para carnada.', '🦐 Un camarón solitario. Algo sacaste.', '🐚 Concha bonita que un turista te compró.', '🪱 Mojarra pequeña. Te la comiste asada.', '👢 Una bota vieja con un diamante pegado en la suela.']
  }

  let mensaje = tipo[Math.floor(Math.random() * tipo.length)]
  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + Math.floor(Math.random() * 15) + 5
  cooldownsFish[who] = now + 120000

  let texto = '⚔️ 「 HINATA FISH 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '🏆 » ' + rareza + '\n'
  texto += '📋 » ' + mensaje + '\n'
  texto += '💎 » +' + diamantes + ' diamantes\n'
  texto += '✨ » +' + (Math.floor(Math.random() * 15) + 5) + ' exp\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ⏳ 2 minutos'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['fish']
handler.tags = ['rpg']
handler.command = /^(fish|pescar|pesca)$/i
handler.desc = 'Pesca para ganar diamantes y exp'

export default handler