let cooldownsMine = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsMine[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '⛏️ 「 HINATA MINE 」 ⛏️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Pico descansando\n⏳ » ' + minutos + 'm ' + segundos + 's\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  let random = Math.random()
  let diamantes, exp, rareza, mensaje

  if (random < 0.05) {
    diamantes = Math.floor(Math.random() * 11) + 10
    exp = Math.floor(Math.random() * 30) + 20
    rareza = '💎 Diamante'
    mensaje = [
      '💎 ¡Encontraste una veta de diamantes puros! Los extrajiste con cuidado.',
      '💎 El pico golpeó una roca y apareció un diamante enorme. ¡Increíble!',
      '💎 Excavaste profundo y encontraste un cofre con diamantes en bruto.',
      '💎 La mina se iluminó. Era un diamante legendario incrustado en la pared.'
    ]
  } else if (random < 0.15) {
    diamantes = Math.floor(Math.random() * 6) + 4
    exp = Math.floor(Math.random() * 20) + 10
    rareza = '🟡 Oro'
    mensaje = [
      '🟡 Encontraste una veta de oro. La picaste con cuidado.',
      '🟡 El río subterráneo trajo pepitas de oro. Las recogiste una por una.',
      '🟡 Oro puro entre las rocas. Buen hallazgo.',
      '🟡 Una veta dorada brillaba en la oscuridad de la mina.'
    ]
  } else if (random < 0.35) {
    diamantes = Math.floor(Math.random() * 4) + 2
    exp = Math.floor(Math.random() * 15) + 5
    rareza = '🔘 Hierro'
    mensaje = [
      '🔘 Encontraste hierro de buena calidad. Lo vendiste al herrero.',
      '🔘 Mineral de hierro abundante. Algo es algo.',
      '🔘 Una veta de hierro sólida. Buen trabajo.',
      '🔘 Hierro forjable. El herrero te lo compró.'
    ]
  } else {
    diamantes = Math.floor(Math.random() * 2) + 1
    exp = Math.floor(Math.random() * 10) + 3
    rareza = '🪨 Piedra'
    mensaje = [
      '🪨 Solo encontraste piedras comunes. Al menos sirven para construir.',
      '🪨 El pico se desafiló un poco. Piedras y más piedras.',
      '🪨 Rocas sin valor aparente. Las vendiste para relleno.',
      '🪨 Una cueva llena de piedras. Nada especial.'
    ]
  }

  user.diamantes = (user.diamantes || 0) + diamantes
  user.exp = (user.exp || 0) + exp
  cooldownsMine[who] = now + 300000

  let texto = '⛏️ 「 HINATA MINE 」 ⛏️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n'
  texto += '  💫 ' + rareza + '\n'
  texto += '  ✦ ' + mensaje[Math.floor(Math.random() * mensaje.length)] + '\n\n'
  texto += '  💎 +' + diamantes + ' diamantes\n'
  texto += '  ✨ +' + exp + ' experiencia\n'
  texto += '  💰 Total: ' + user.diamantes + ' 💎\n\n'
  texto += '✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n> ⏳ 5 minutos | #minar'

  await conn.sendMessage(m.chat, {
    image: { url: 'https://files.catbox.moe/iw3z4l.jpeg' },
    caption: texto
  }, { quoted: m })
}

handler.help = ['minar']
handler.tags = ['rpg']
handler.command = /^(minar|mine|mineria)$/i
handler.desc = 'Mina para ganar diamantes y exp'

export default handler