import fs from 'fs'
import path from 'path'

let handler = async (m, { conn }) => {
  let who = m.sender
  let lotoPath = path.join(process.cwd(), 'loteria.json')
  let loteria

  if (fs.existsSync(lotoPath)) {
    loteria = JSON.parse(fs.readFileSync(lotoPath, 'utf8'))
  } else {
    return conn.sendMessage(m.chat, {
      text: '🎫 「 HINATA LOTERÍA 」 🎫\n\n💫 » No hay lotería activa\n\n> #loteria comprar <cantidad>\n> 200 boletos | 1000 💎 c/u'
    }, { quoted: m })
  }

  let vendidos = Object.values(loteria.boletos).reduce((a, b) => a + b, 0)
  let misBoletos = loteria.boletos[who] || 0
  let probabilidad = misBoletos > 0 ? ((misBoletos / 200) * 100).toFixed(2) : 0
  let estado = loteria.activa ? '✅ Abierta' : '❌ Cerrada'

  let texto = '🎫 「 HINATA LOTERÍA 」 🎫\n\n'
  texto += '📊 » Estado: ' + estado + '\n'
  texto += '🎟️ » Boletos: ' + vendidos + '/200\n'
  texto += '💰 » Premio: ' + loteria.totalRecaudado + ' 💎\n'
  texto += '💎 » Precio: 1000 💎 por boleto\n\n'
  texto += '👤 » Tus boletos: ' + misBoletos + '\n'
  texto += '📊 » Tu probabilidad: ' + probabilidad + '%\n\n'
  texto += '> #loteria comprar <cantidad>\n> #rankloteria'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['infoloteria']
handler.tags = ['rpg']
handler.command = /^(infoloteria|infoloto)$/i
handler.desc = 'Información de la lotería'

export default handler