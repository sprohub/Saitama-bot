let cooldownsWork2 = {}

let handler = async (m, { conn, text }) => {
  let who = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsWork2[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: `𖣔 「 HINATA WORK 2 」 ˚ʚ♡ɞ˚\n\n💫 » Espera ${minutos}m ${segundos}s`
    }, { quoted: m })
  }

  let random = Math.random()
  let diamantes, exp, escena, emoji

  if (random < 0.03) {
    diamantes = Math.floor(Math.random() * 51) + 30
    exp = Math.floor(Math.random() * 101) + 50
    emoji = '🌟'
    escena = [
      'Salvaste a un empresario de un asalto en el metro. Te dio las llaves de su coche y un sobre con fajos de billetes. Llegaste a casa en un Porsche.',
      'Encontraste una memoria USB tirada en la calle. Resultó ser la billetera fría de un hacker retirado. Transferiste todo a tu cuenta antes de que se dieran cuenta.',
      'Participaste en un concurso de talentos por aburrimiento. Cantaste tan mal que te volviste viral. Los patrocinadores te llenaron de dinero por meme.'
    ]
  } else if (random < 0.10) {
    diamantes = Math.floor(Math.random() * 21) + 15
    exp = Math.floor(Math.random() * 51) + 30
    emoji = '⭐'
    escena = [
      'Te contrataron para un trabajo de medio tiempo en una empresa de tecnología. El jefe era tan incompetente que te ascendió a los 3 días.',
      'Vendiste fotos de tus pies en internet. No preguntes cómo, pero pagaron bien. Muy bien.',
      'Un streamer famoso te donó dinero por error. Le escribiste para devolvérselo y te dijo "quédatelo, me sobra".'
    ]
  } else if (random < 0.25) {
    diamantes = Math.floor(Math.random() * 11) + 5
    exp = Math.floor(Math.random() * 31) + 15
    emoji = '✨'
    escena = [
      'Paseaste perros por el barrio. Una señora te dio propina extra porque su perro se enamoró de ti.',
      'Repartiste volantes disfrazado de pollo. Hacía calor pero pagaron en efectivo y te regalaron una cena.',
      'Vendiste limonada en la esquina. Un señor te pagó con un billete grande y te dijo "quédese el cambio".'
    ]
  } else if (random < 0.50) {
    diamantes = Math.floor(Math.random() * 5) + 2
    exp = Math.floor(Math.random() * 16) + 5
    emoji = '👍'
    escena = [
      'Lavaste coches en la calle con una esponja vieja. Ganaste poco pero te dio para un café y un pan.',
      'Recogiste latas y las vendiste al centro de reciclaje. El señor te dio un billete arrugado y una palmada en la espalda.',
      'Ayudaste a un vecino a mover muebles. Te dio las gracias y un billete que tenía doblado en el bolsillo.'
    ]
  } else if (random < 0.75) {
    diamantes = Math.floor(Math.random() * 3) + 1
    exp = Math.floor(Math.random() * 8) + 3
    emoji = '👌'
    escena = [
      'Pediste dinero en la calle con un cartel honesto: "quiero comprar un café". Alguien te dio monedas sueltas.',
      'Vendiste chicles en el semáforo. La mayoría te ignoraba pero una abuelita te compró dos.',
      'Buscaste monedas entre los cojines del sofá. Encontraste algunas y un chicle viejo.'
    ]
  } else if (random < 0.90) {
    diamantes = -Math.floor(Math.random() * 4) - 1
    exp = Math.floor(Math.random() * 4) + 1
    emoji = '💀'
    escena = [
      'Te estafaron con una "inversión mágica". El tipo desapareció con tu dinero y te bloqueó de todos lados.',
      'Prestaste dinero a un amigo que "te pagaba mañana". Mañana nunca llegó y ahora te evade en el supermercado.',
      'Se te cayó la billetera en el bus. Cuando te diste cuenta ya alguien se había comprado zapatos nuevos con tu dinero.'
    ]
  } else {
    diamantes = -Math.floor(Math.random() * 8) - 3
    exp = Math.floor(Math.random() * 3) + 1
    emoji = '☠️'
    escena = [
      'Te metiste a un negocio piramidal. Perdiste todo y ahora tienes 300 perfumes que no puedes vender.',
      'Un falso inversionista te prometió el cielo. Firmaste sin leer y ahora debes hasta el aire que respiras.',
      'Apostaste todo al rojo. Salió negro. Salió verde. Salió todo menos rojo. Hasta el croupier te miró con lástima.'
    ]
  }

  let mensaje = escena[Math.floor(Math.random() * escena.length)]

  if (user.diamantes !== undefined) {
    user.diamantes = Math.max(0, (user.diamantes || 0) + diamantes)
  } else {
    user.diamond = Math.max(0, (user.diamond || 0) + diamantes)
  }
  user.exp = (user.exp || 0) + exp
  cooldownsWork2[who] = now + 120000

  let total = user.diamantes !== undefined ? user.diamantes : (user.diamond || 0)
  let name = '@' + who.split('@')[0]

  let texto = `𖣔 「 HINATA WORK 2 」 ˚ʚ♡ɞ˚\n\n`
  texto += `${emoji} » ${name}\n`
  texto += `📋 ${mensaje}\n`
  texto += `💎 ${diamantes > 0 ? '+' : ''}${diamantes} diamantes\n`
  texto += `✨ +${exp} exp\n`
  texto += `💰 Total: ${total} 💎`

  await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })
}

handler.help = ['work2']
handler.tags = ['rpg']
handler.command = /^(work2|trabajar2|chamba2)$/i
handler.desc = 'Trabaja con muchas formas de ganar y perder'

export default handler