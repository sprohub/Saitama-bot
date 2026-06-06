let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [] }
    user = global.db.data.users[who]
  }

  let target = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : null

  if (!target || !args[1]) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA REGALAR 」 ˚ʚ♡ɞ˚\n\n💫 » Regala un personaje\n\n> #regalar @usuario <personaje>'
    }, { quoted: m })
  }

  if (target === who) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA REGALAR 」 ˚ʚ♡ɞ˚\n\n💫 » No te puedes regalar a ti mismo'
    }, { quoted: m })
  }

  let personaje = args.slice(1).join(' ')

  if (!user.inventory || user.inventory.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA REGALAR 」 ˚ʚ♡ɞ˚\n\n💫 » No tienes personajes'
    }, { quoted: m })
  }

  let index = user.inventory.findIndex(item => item.toLowerCase() === personaje.toLowerCase())

  if (index === -1) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA REGALAR 」 ˚ʚ♡ɞ˚\n\n💫 » No tienes ese personaje\n📝 » ' + personaje
    }, { quoted: m })
  }

  let regalo = user.inventory[index]
  user.inventory.splice(index, 1)

  let targetUser = global.db.data.users[target]
  if (!targetUser) {
    global.db.data.users[target] = { inventory: [] }
    targetUser = global.db.data.users[target]
  }
  if (!targetUser.inventory) targetUser.inventory = []
  targetUser.inventory.push(regalo)

  let texto = '𖣔 「 HINATA REGALAR 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🎁 » Personaje regalado\n\n'
  texto += '📤 » De: @' + who.split('@')[0] + '\n'
  texto += '📥 » Para: @' + target.split('@')[0] + '\n'
  texto += '✨ » ' + regalo + '\n\n'
  texto += '> ¡Disfruta tu nuevo personaje!'

  await conn.sendMessage(m.chat, { text: texto, mentions: [who, target] }, { quoted: m })
}

handler.help = ['regalar']
handler.tags = ['gacha']
handler.command = /^(regalar|give)$/i
handler.desc = 'Regala un personaje a otro usuario'

export default handler