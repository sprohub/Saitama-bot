import fs from 'fs'
import path from 'path'

let mercado = {}

let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, inventory: [] }
    user = global.db.data.users[who]
  }

  if (!args[0]) {
    if (Object.keys(mercado).length === 0) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » No hay personajes en venta\n\n> #mercado vender <personaje> <precio>\n> #mercado comprar <numero>\n> #mercado ver'
      }, { quoted: m })
    }

    let texto = '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » Personajes en venta:\n\n'
    let id = 1
    for (let [key, item] of Object.entries(mercado)) {
      texto += '📦 #' + id + ' » ' + item.name + '\n'
      texto += '   👤 @' + item.seller.split('@')[0] + '\n'
      texto += '   💎 Precio: ' + item.price + '\n\n'
      id++
    }
    texto += '> #mercado comprar <id>'

    let mentions = Object.values(mercado).map(item => item.seller)
    return conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
  }

  if (args[0] === 'ver') {
    if (Object.keys(mercado).length === 0) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » No hay personajes en venta'
      }, { quoted: m })
    }

    let texto = '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » Personajes en venta:\n\n'
    let id = 1
    for (let [key, item] of Object.entries(mercado)) {
      texto += '📦 #' + id + ' » ' + item.name + '\n'
      texto += '   👤 @' + item.seller.split('@')[0] + '\n'
      texto += '   💎 Precio: ' + item.price + '\n\n'
      id++
    }
    texto += '> #mercado comprar <id>'

    let mentions = Object.values(mercado).map(item => item.seller)
    return conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
  }

  if (args[0] === 'vender') {
    let personaje = args.slice(1, -1).join(' ')
    let precio = parseInt(args[args.length - 1])

    if (!personaje || isNaN(precio) || precio <= 0) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » #mercado vender <personaje> <precio>'
      }, { quoted: m })
    }

    if (!user.inventory || user.inventory.length === 0) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » No tienes personajes'
      }, { quoted: m })
    }

    let index = user.inventory.findIndex(item => item.toLowerCase() === personaje.toLowerCase())
    if (index === -1) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » No tienes ese personaje'
      }, { quoted: m })
    }

    let item = user.inventory[index]
    user.inventory.splice(index, 1)

    let key = who + '_' + Date.now()
    mercado[key] = {
      name: item,
      seller: who,
      price: precio
    }

    return conn.sendMessage(m.chat, {
      text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » Personaje en venta\n\n📦 » ' + item + '\n💎 » Precio: ' + precio + '\n👤 » @' + who.split('@')[0],
      mentions: [who]
    }, { quoted: m })
  }

  if (args[0] === 'comprar') {
    let id = parseInt(args[1])
    if (isNaN(id) || id <= 0) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » ID inválido\n\n> #mercado comprar <id>'
      }, { quoted: m })
    }

    let keys = Object.keys(mercado)
    if (id > keys.length) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » No existe ese ID'
      }, { quoted: m })
    }

    let key = keys[id - 1]
    let item = mercado[key]

    if (item.seller === who) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » No puedes comprar tu propio personaje'
      }, { quoted: m })
    }

    if ((user.diamantes || user.diamond || 0) < item.price) {
      return conn.sendMessage(m.chat, {
        text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » No tienes suficientes 💎\n💰 » Tienes: ' + (user.diamantes || user.diamond || 0)
      }, { quoted: m })
    }

    if (user.diamantes !== undefined) {
      user.diamantes -= item.price
    } else {
      user.diamond -= item.price
    }

    let seller = global.db.data.users[item.seller]
    if (!seller) {
      global.db.data.users[item.seller] = { diamantes: 0 }
      seller = global.db.data.users[item.seller]
    }
    if (seller.diamantes !== undefined) {
      seller.diamantes = (seller.diamantes || 0) + item.price
    } else {
      seller.diamond = (seller.diamond || 0) + item.price
    }

    if (!user.inventory) user.inventory = []
    user.inventory.push(item.name)

    delete mercado[key]

    return conn.sendMessage(m.chat, {
      text: '🏪 「 HINATA MERCADO 」 🏪\n\n💫 » ¡Compra exitosa!\n\n📦 » ' + item.name + '\n💎 » Pagaste: ' + item.price + '\n📤 » De: @' + item.seller.split('@')[0] + '\n📥 » Para: @' + who.split('@')[0],
      mentions: [item.seller, who]
    }, { quoted: m })
  }
}

handler.help = ['mercado']
handler.tags = ['gacha']
handler.command = /^(mercado|market)$/i
handler.desc = 'Compra y vende personajes'

export default handler