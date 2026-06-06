let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { health: 100, maxHealth: 100, diamantes: 0 }
    user = global.db.data.users[who]
  }

  if ((user.diamantes || 0) < 1) {
    return conn.sendMessage(m.chat, {
      text: '🏥 「 HINATA CURAR 」 🏥\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Necesitas 1 💎 para curarte\n💰 » Tienes: ' + (user.diamantes || 0) + ' 💎\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  if (user.health === (user.maxHealth || 100)) {
    return conn.sendMessage(m.chat, {
      text: '🏥 「 HINATA CURAR 」 🏥\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Ya tienes toda la vida\n❤️ » ' + user.health + '/' + (user.maxHealth || 100) + '\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  user.diamantes -= 1
  user.health = user.maxHealth || 100

  let texto = '🏥 「 HINATA CURAR 」 🏥\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n'
  texto += '💫 » Te has curado completamente\n\n'
  texto += '💎 » -1 diamante\n'
  texto += '❤️ » Vida: ' + user.health + '/' + (user.maxHealth || 100) + '\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '✦•┈๑⋅⋯ ⋯⋅๑┈•✦'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['curar']
handler.tags = ['rpg']
handler.command = /^(curar|heal|cura|sanar)$/i
handler.desc = 'Cura toda tu vida por 1 💎'

export default handler