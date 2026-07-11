let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { exp: 0, level: 0, diamantes: 0, attack: 10, defense: 5, health: 100, maxHealth: 100, mana: 50, maxMana: 50 }
    user = global.db.data.users[who]
  }

  let expNecesaria = (user.level + 1) * 100

  if ((user.exp || 0) < expNecesaria) {
    let falta = expNecesaria - (user.exp || 0)
    return conn.sendMessage(m.chat, {
      text: '⚔️ 「 HINATA LEVELUP 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n📊 » Nivel actual: ' + (user.level || 0) + '\n✨ » Exp: ' + (user.exp || 0) + '/' + expNecesaria + '\n📉 » Te faltan ' + falta + ' exp\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> Usa #work, #fish, #crime para ganar exp'
    }, { quoted: m })
  }

  user.exp -= expNecesaria
  user.level = (user.level || 0) + 1
  user.attack = (user.attack || 10) + 3
  user.defense = (user.defense || 5) + 2
  user.maxHealth = (user.maxHealth || 100) + 10
  user.health = user.maxHealth
  user.maxMana = (user.maxMana || 50) + 5
  user.mana = user.maxMana

  let texto = '⚔️ 「 HINATA LEVELUP 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '🎉 » ¡SUBISTE DE NIVEL!\n\n'
  texto += '⭐ » Nivel: ' + (user.level - 1) + ' → ' + user.level + '\n'
  texto += '⚡ » Ataque: +3\n'
  texto += '🛡️ » Defensa: +2\n'
  texto += '❤️ » Vida máxima: +10\n'
  texto += '💙 » Mana máxima: +5\n\n'
  texto += '📊 » Próximo nivel: ' + (user.level * 100) + ' exp\n'
  texto += '✨ » Exp restante: ' + (user.exp || 0) + '\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['levelup']
handler.tags = ['rpg']
handler.command = /^(levelup|subirnivel|nivelup)$/i
handler.desc = 'Sube de nivel usando tu experiencia'

export default handler