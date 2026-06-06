let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory2: [] }
    user = global.db.data.users[who]
  }

  if (!user.inventory2 || user.inventory2.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA INVENTARIO 2 」 ˚ʚ♡ɞ˚\n\n💫 » Tu inventario está vacío\n\n> Usa #rw2 para conseguir personajes'
    }, { quoted: m })
  }

  let items = {}
  for (let item of user.inventory2) {
    items[item] = (items[item] || 0) + 1
  }

  let texto = '𖣔 「 HINATA INVENTARIO 2 」 ˚ʚ♡ɞ˚\n\n'

  for (let [name, count] of Object.entries(items)) {
    texto += '  ✦ ' + name + '\n     📦 x' + count + '\n\n'
  }

  texto += '> Total: ' + user.inventory2.length + ' personajes'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['inventario2']
handler.tags = ['gacha']
handler.command = /^(inventario2|inv2)$/i
handler.desc = 'Muestra tu inventario de gacha 2'

export default handler