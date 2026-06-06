let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [], diamantes: 0 }
    user = global.db.data.users[who]
  }

  if (!args[0]) {
    return conn.sendMessage(m.chat, {
      text: '💎 「 HINATA VENDER 」 💎\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Vende tus personajes\n\n> #vender <nombre>\n> #vender all\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  if (!user.inventory || user.inventory.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '💎 「 HINATA VENDER 」 💎\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » No tienes personajes\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  if (args[0].toLowerCase() === 'all') {
    let total = user.inventory.length
    let ganancia = total * 2
    user.diamantes = (user.diamantes || 0) + ganancia
    user.inventory = []

    return conn.sendMessage(m.chat, {
      text: '💎 「 HINATA VENDER 」 💎\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Vendiste todo\n📦 » ' + total + ' personajes\n💰 » +' + ganancia + ' diamantes\n💎 » Total: ' + user.diamantes + '\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  let nombre = args.join(' ').toLowerCase()
  let index = user.inventory.findIndex(item => item.toLowerCase() === nombre)

  if (index === -1) {
    return conn.sendMessage(m.chat, {
      text: '💎 「 HINATA VENDER 」 💎\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » No tienes ese personaje\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
    }, { quoted: m })
  }

  let personaje = user.inventory[index]
  user.inventory.splice(index, 1)

  let gachaPath = path.join(process.cwd(), 'gacha.json')
  let characters = fs.existsSync(gachaPath) ? JSON.parse(fs.readFileSync(gachaPath, 'utf8')) : []
  let charData = characters.find(c => c.name.toLowerCase() === nombre)

  let precio = 2
  if (charData) {
    if (charData.rarity === 'SSR') precio = 10
    else if (charData.rarity === 'SR') precio = 5
    else precio = 2
  }

  user.diamantes = (user.diamantes || 0) + precio

  await conn.sendMessage(m.chat, {
    text: '💎 「 HINATA VENDER 」 💎\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Vendiste ' + personaje + '\n💰 » +' + precio + ' diamantes\n💎 » Total: ' + user.diamantes + '\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
  }, { quoted: m })
}

handler.help = ['vender']
handler.tags = ['gacha']
handler.command = /^(vender|sell)$/i
handler.desc = 'Vende personajes por diamantes'

export default handler