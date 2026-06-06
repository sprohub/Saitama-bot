import fs from 'fs'
import path from 'path'

let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0 }
    user = global.db.data.users[who]
  }

  let lotoPath = path.join(process.cwd(), 'loteria.json')
  let loteria

  if (fs.existsSync(lotoPath)) {
    loteria = JSON.parse(fs.readFileSync(lotoPath, 'utf8'))
  } else {
    loteria = { boletos: {}, totalRecaudado: 0, activa: true }
    fs.writeFileSync(lotoPath, JSON.stringify(loteria, null, 2))
  }

  if (!args[0]) {
    let vendidos = Object.values(loteria.boletos).reduce((a, b) => a + b, 0)
    let misBoletos = loteria.boletos[who] || 0
    let probabilidad = misBoletos > 0 ? ((misBoletos / 200) * 100).toFixed(2) : 0

    let texto = '🎫 「 HINATA LOTERÍA 」 🎫\n\n'
    texto += '💫 » ' + vendidos + '/200 boletos vendidos\n'
    texto += '💰 » Premio: ' + loteria.totalRecaudado + ' 💎\n'
    texto += '🎟️ » Tus boletos: ' + misBoletos + '\n'
    texto += '📊 » Probabilidad: ' + probabilidad + '%\n\n'
    texto += '> #loteria comprar <cantidad>\n> 1000 💎 por boleto'

    return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }

  if (args[0] === 'comprar') {
    if (!loteria.activa) {
      return conn.sendMessage(m.chat, { text: '🎫 」\n\n💫 » Lotería cerrada' }, { quoted: m })
    }

    let cantidad = parseInt(args[1]) || 1
    if (cantidad < 1) cantidad = 1

    let total = cantidad * 1000
    let misDiamantes = user.diamantes || user.diamond || 0

    if (misDiamantes < total) {
      return conn.sendMessage(m.chat, {
        text: '🎫 」\n\n💫 » Necesitas ' + total + ' 💎\n💰 » Tienes: ' + misDiamantes
      }, { quoted: m })
    }

    let vendidos = Object.values(loteria.boletos).reduce((a, b) => a + b, 0)
    if (vendidos + cantidad > 200) {
      cantidad = 200 - vendidos
      total = cantidad * 1000
      if (cantidad <= 0) return conn.sendMessage(m.chat, { text: '🎫 」\n\n💫 » Boletos agotados' }, { quoted: m })
    }

    if (user.diamantes !== undefined) user.diamantes = misDiamantes - total
    else user.diamond = misDiamantes - total

    loteria.totalRecaudado += total
    if (!loteria.boletos[who]) loteria.boletos[who] = 0
    loteria.boletos[who] += cantidad

    fs.writeFileSync(lotoPath, JSON.stringify(loteria, null, 2))

    vendidos = Object.values(loteria.boletos).reduce((a, b) => a + b, 0)
    let misBoletos = loteria.boletos[who]
    let probabilidad = ((misBoletos / 200) * 100).toFixed(2)

    let texto = '🎫 」\n\n✅ » +' + cantidad + ' boletos\n💎 » -' + total + ' diamantes\n🎟️ » Tus boletos: ' + misBoletos + '\n📊 » Probabilidad: ' + probabilidad + '%\n💰 » Premio: ' + loteria.totalRecaudado + ' 💎'

    return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['loteria']
handler.tags = ['rpg']
handler.command = /^(loteria|loto)$/i
handler.desc = 'Compra boletos de lotería'

export default handler