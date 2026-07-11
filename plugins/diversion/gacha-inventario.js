import fetch from 'node-fetch'

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [] }
    user = global.db.data.users[who]
  }

  if (!user.inventory || user.inventory.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '╭━━⬣ 「 SAITAMA INVENTARIO 」 🎒\n┃\n┃  💫 Tu inventario está vacío\n┃\n┃  💡 Usa #rw para conseguir\n┃     personajes\n╰━━━━━━━━━━━━━━━━━━━━━━⬣\n         SAITAMA'
    }, { quoted: m })
  }

  let items = {}
  for (let item of user.inventory) {
    items[item] = (items[item] || 0) + 1
  }

  let texto = '╭━━⬣ 「 SAITAMA INVENTARIO 」 🎒\n'
  texto += '┃\n'

  for (let [name, count] of Object.entries(items)) {
    texto += '┃  ✦ ' + name + '\n'
    texto += '┃     📦 x' + count + '\n'
    texto += '┃\n'
  }

  texto += '╰━━⬣ / ╰━━━━━━━━━━━━━━━━━━━━━━⬣\n'
  texto += '         SAITAMA\n\n'
  texto += '> Total: ' + user.inventory.length + ' personajes'

  try {
    let res = await fetch('https://i.ibb.co/G44ZsZF7/6b4e11c0-db53-486c-b014-2e616033406b.jpg')
    let buf = Buffer.from(await res.arrayBuffer())
    await conn.sendMessage(m.chat, {
      image: buf,
      caption: texto
    }, { quoted: m })
  } catch {
    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['inventario']
handler.tags = ['gacha']
handler.command = /^(inventario|inv|items)$/i
handler.desc = 'Muestra tu inventario de personajes'

export default handler
