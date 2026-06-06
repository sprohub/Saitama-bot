let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = {
      exp: 0, level: 0, diamantes: 0, bank: 0,
      health: 100, maxHealth: 100, attack: 10, defense: 5,
      mana: 50, maxMana: 50, class: 'Novato', inventory: [],
      equipment: { weapon: null, armor: null, accessory: null }
    }
    user = global.db.data.users[who]
  }

  let name = await conn.getName(who)
  let pp = await conn.profilePictureUrl(who, 'image').catch(() => 'https://i.ibb.co/cSCf8VWv/perfil.png')

  let texto = '⚔️ 「 HINATA PERFIL 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += '👤 » *' + name + '*\n'
  texto += '🎖️ » Clase: ' + (user.class || 'Novato') + '\n'
  texto += '⭐ » Nivel: ' + (user.level || 0) + '\n'
  texto += '✨ » Experiencia: ' + (user.exp || 0) + '\n\n'
  texto += '❤️ » Vida: ' + (user.health || 100) + '/' + (user.maxHealth || 100) + '\n'
  texto += '💙 » Mana: ' + (user.mana || 50) + '/' + (user.maxMana || 50) + '\n'
  texto += '⚡ » Ataque: ' + (user.attack || 10) + '\n'
  texto += '🛡️ » Defensa: ' + (user.defense || 5) + '\n\n'
  texto += '💎 » Diamantes: ' + (user.diamantes || 0) + '\n'
  texto += '🏦 » Banco: ' + (user.bank || 0) + ' 💎\n\n'
  texto += '🎒 » Inventario: ' + (user.inventory?.length || 0) + ' items\n'
  texto += '🗡️ » Arma: ' + (user.equipment?.weapon || 'Ninguna') + '\n'
  texto += '🛡️ » Armadura: ' + (user.equipment?.armor || 'Ninguna') + '\n'
  texto += '💍 » Accesorio: ' + (user.equipment?.accessory || 'Ninguno') + '\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  await conn.sendMessage(m.chat, {
    image: { url: pp },
    caption: texto,
    mentions: [who]
  }, { quoted: m })
}

handler.help = ['perfil']
handler.tags = ['rpg']
handler.command = /^(perfil|profile|stats|status)$/i
handler.desc = 'Muestra tu perfil RPG'

export default handler
