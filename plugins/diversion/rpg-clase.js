let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, class: 'Novato', attack: 10, defense: 5, health: 100, maxHealth: 100 }
    user = global.db.data.users[who]
  }

  if (!args[0]) {
    let clase = user.class || 'Novato'
    let clases = ['Novato', 'Guerrero', 'Mago', 'Asesino', 'Paladín', 'Arquero', 'Druida', 'Berserker', 'Nigromante', 'Samurái']
    let reqs = {
      'Novato': 'Nivel 0 | Gratis',
      'Guerrero': 'Nivel 5 | 50 💎',
      'Mago': 'Nivel 5 | 50 💎',
      'Asesino': 'Nivel 10 | 100 💎',
      'Paladín': 'Nivel 10 | 100 💎',
      'Arquero': 'Nivel 15 | 200 💎',
      'Druida': 'Nivel 15 | 200 💎',
      'Berserker': 'Nivel 20 | 500 💎',
      'Nigromante': 'Nivel 20 | 500 💎',
      'Samurái': 'Nivel 25 | 1000 💎'
    }

    let texto = '𖣔 「 HINATA CLASES 」 ˚ʚ♡ɞ˚\n\n'
    texto += '🎖️ » Tu clase: ' + clase + '\n\n'
    texto += '📋 » Clases disponibles:\n\n'

    for (let c of clases) {
      let emoji = c === clase ? '✅' : '⬜'
      texto += emoji + ' » ' + c + '\n'
      texto += '   📜 » ' + reqs[c] + '\n\n'
    }

    texto += '> #clase <nombre> para cambiar'

    return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }

  let claseElegida = args.join(' ')
  let clases = {
    'novato': { nivel: 0, costo: 0, attack: 10, defense: 5, health: 100, maxHealth: 100 },
    'guerrero': { nivel: 5, costo: 50, attack: 25, defense: 20, health: 150, maxHealth: 150 },
    'mago': { nivel: 5, costo: 50, attack: 35, defense: 10, health: 100, maxHealth: 100 },
    'asesino': { nivel: 10, costo: 100, attack: 40, defense: 15, health: 120, maxHealth: 120 },
    'paladín': { nivel: 10, costo: 100, attack: 20, defense: 35, health: 180, maxHealth: 180 },
    'arquero': { nivel: 15, costo: 200, attack: 45, defense: 20, health: 130, maxHealth: 130 },
    'druida': { nivel: 15, costo: 200, attack: 30, defense: 25, health: 160, maxHealth: 160 },
    'berserker': { nivel: 20, costo: 500, attack: 60, defense: 10, health: 200, maxHealth: 200 },
    'nigromante': { nivel: 20, costo: 500, attack: 55, defense: 30, health: 150, maxHealth: 150 },
    'samurái': { nivel: 25, costo: 1000, attack: 70, defense: 40, health: 220, maxHealth: 220 }
  }

  let claseData = clases[claseElegida.toLowerCase()]
  if (!claseData) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA CLASES 」 ˚ʚ♡ɞ˚\n\n💫 » Clase no válida\n\n> Usa #clase para ver la lista'
    }, { quoted: m })
  }

  if (user.class === claseElegida) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA CLASES 」 ˚ʚ♡ɞ˚\n\n💫 » Ya eres ' + claseElegida
    }, { quoted: m })
  }

  if ((user.level || 0) < claseData.nivel) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA CLASES 」 ˚ʚ♡ɞ˚\n\n💫 » Necesitas nivel ' + claseData.nivel + '\n⭐ » Tu nivel: ' + (user.level || 0)
    }, { quoted: m })
  }

  if ((user.diamantes || 0) < claseData.costo) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA CLASES 」 ˚ʚ♡ɞ˚\n\n💫 » Necesitas ' + claseData.costo + ' 💎\n💰 » Tienes: ' + (user.diamantes || 0)
    }, { quoted: m })
  }

  user.diamantes -= claseData.costo
  user.class = claseElegida
  user.attack = claseData.attack
  user.defense = claseData.defense
  user.health = claseData.maxHealth
  user.maxHealth = claseData.maxHealth

  let texto = '𖣔 「 HINATA CLASES 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🎉 » ¡Clase cambiada!\n\n'
  texto += '🎖️ » Nueva clase: ' + claseElegida + '\n'
  texto += '⚔️ » Ataque: ' + claseData.attack + '\n'
  texto += '🛡️ » Defensa: ' + claseData.defense + '\n'
  texto += '❤️ » Vida: ' + claseData.maxHealth + '\n'
  texto += '💎 » -' + claseData.costo + ' diamantes\n\n'
  texto += '> Tu nivel se mantiene'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['clase']
handler.tags = ['rpg']
handler.command = /^(clase|clases)$/i
handler.desc = 'Cambia tu clase RPG'

export default handler