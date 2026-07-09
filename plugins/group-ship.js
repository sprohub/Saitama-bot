let handler = async (m, { conn }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '⚔️ 「 SAITAMA SHIP 」 ⚔️\n\n💫 » Solo para grupos' }, { quoted: m })

  let user1 = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : null
  let user2 = m.mentionedJid && m.mentionedJid[1] ? m.mentionedJid[1] : null

  if (!user1 || !user2) {
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 SAITAMA SHIP 」 ⚔️\n\n💫 » Menciona a dos personas\n\n> #ship @user1 @user2'
    }, { quoted: m })
  }

  if (user1 === user2) {
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 SAITAMA SHIP 」 ⚔️\n\n💫 » No se puede ship a la misma persona\n🤡 » Eso es narcisismo'
    }, { quoted: m })
  }

  let name1 = '@' + user1.split('@')[0]
  let name2 = '@' + user2.split('@')[0]

  let porcentaje = Math.floor(Math.random() * 101)

  let emoji, frase, extra, imagen

  if (porcentaje >= 90) {
    emoji = '💘'
    frase = 'Almas gemelas'
    extra = '¡Un golpe de amor de un solo puñetazo! Se casan mañana 💒'
    imagen = 'https://i.ibb.co/CKrTJVnd/90-100-Almas-gemelas.png'
  } else if (porcentaje >= 70) {
    emoji = '💖'
    frase = 'Amor fuerte'
    extra = 'Hay mucha química entre ustedes, denle una oportunidad 💕'
    imagen = 'https://i.ibb.co/7HXx28X/70-89-Amorfuerte.png'
  } else if (porcentaje >= 50) {
    emoji = '💗'
    frase = 'Posible romance'
    extra = 'Podría funcionar si se conocen mejor 🌸'
    imagen = 'https://i.ibb.co/JWBXBxLR/50-69-Posibleromance.png'
  } else if (porcentaje >= 30) {
    emoji = '💛'
    frase = 'Amistad'
    extra = 'Mejor como amigos, no arruinen la amistad 🤝'
    imagen = 'https://i.ibb.co/Cp6Gw0rF/30-49-Amistad.png'
  } else if (porcentaje >= 10) {
    emoji = '💔'
    frase = 'Difícil'
    extra = 'No hay química, mejor busca en otro lado 🥀'
    imagen = 'https://i.ibb.co/twnZvWsg/5fe9f416-9fdc-4e8f-b0bd-9719d9286073.png'
  } else {
    emoji = '🖤'
    frase = 'Imposible'
    extra = 'Ni Saitama con un puñetazo arregla esto, huye de ahí 🏃'
    imagen = 'https://i.ibb.co/6RCxbYq4/0-9-Imposible.png'
  }

  let barra = ''
  let completado = Math.floor(porcentaje / 10)
  for (let i = 0; i < 10; i++) {
    barra += i < completado ? '❤️' : '🖤'
  }

  let texto = '╭─⪼ ⚔️ 「 SAITAMA SHIP 」 ⚔️\n│\n'
  texto += '├ ' + name1 + ' + ' + name2 + '\n│\n'
  texto += '├ ' + emoji + ' » ' + porcentaje + '%\n'
  texto += '├ 📊 » ' + barra + '\n'
  texto += '├ 💫 » ' + frase + '\n'
  texto += '├ 📝 » ' + extra + '\n'
  texto += '╰───────────────⬣'

  await conn.sendMessage(m.chat, {
    image: { url: imagen },
    caption: texto,
    mentions: [user1, user2]
  }, { quoted: m })
}

handler.help = ['ship']
handler.tags = ['diversion']
handler.command = /^(ship|amor|love|match)$/i
handler.desc = 'Calcula el amor entre dos personas'
handler.group = true

export default handler