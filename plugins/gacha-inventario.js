let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [] }
    user = global.db.data.users[who]
  }

  if (!user.inventory || user.inventory.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '🎒 「 HINATA INVENTARIO 」 🎒\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Tu inventario está vacío\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n> Usa #rw para conseguir personajes'
    }, { quoted: m })
  }

  let items = {}
  for (let item of user.inventory) {
    items[item] = (items[item] || 0) + 1
  }

  let texto = '🎒 「 HINATA INVENTARIO 」 🎒\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n'

  let i = 1
  for (let [name, count] of Object.entries(items)) {
    texto += '  ✦ ' + name + '\n'
    texto += '     📦 x' + count + '\n\n'
    i++
  }

  texto += '✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n> Total: ' + user.inventory.length + ' personajes'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['inventario']
handler.tags = ['gacha']
handler.command = /^(inventario|inv|items)$/i
handler.desc = 'Muestra tu inventario de personajes'

export default handler