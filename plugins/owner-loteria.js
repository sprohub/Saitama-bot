import fs from 'fs'
import path from 'path'

let handler = async (m, { conn }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, { text: '🎫 」\n\n💫 » Solo creadores' }, { quoted: m })
  }

  let lotoPath = path.join(process.cwd(), 'loteria.json')
  let loteria

  if (fs.existsSync(lotoPath)) {
    loteria = JSON.parse(fs.readFileSync(lotoPath, 'utf8'))
  } else {
    return conn.sendMessage(m.chat, { text: '🎫 」\n\n💫 » No hay lotería activa' }, { quoted: m })
  }

  if (!loteria.activa) {
    return conn.sendMessage(m.chat, { text: '🎫 」\n\n💫 » Ya sorteada\n\n> #resetloteria' }, { quoted: m })
  }

  let participantes = []
  for (let [id, cantidad] of Object.entries(loteria.boletos)) {
    for (let i = 0; i < cantidad; i++) {
      participantes.push(id)
    }
  }

  if (participantes.length === 0) {
    return conn.sendMessage(m.chat, { text: '🎫 」\n\n💫 » Sin boletos' }, { quoted: m })
  }

  let ganador = participantes[Math.floor(Math.random() * participantes.length)]
  let premio = loteria.totalRecaudado
  let winnerUser = global.db.data.users[ganador]
  if (!winnerUser) {
    global.db.data.users[ganador] = { diamantes: 0 }
    winnerUser = global.db.data.users[ganador]
  }

  if (winnerUser.diamantes !== undefined) {
    winnerUser.diamantes = (winnerUser.diamantes || 0) + premio
  } else {
    winnerUser.diamond = (winnerUser.diamond || 0) + premio
  }

  let boletosGanador = loteria.boletos[ganador] || 0
  let prob = ((boletosGanador / 200) * 100).toFixed(2)

  let texto = '🎫 「 LOTERÍA SORTEADA 」 🎫\n\n'
  texto += '🏆 » @' + ganador.split('@')[0] + '\n'
  texto += '🎟️ » ' + boletosGanador + ' boletos | 📊 ' + prob + '%\n'
  texto += '💰 » +' + premio + ' 💎\n\n'
  texto += '> ¡Felicidades!'

  loteria.activa = false
  fs.writeFileSync(lotoPath, JSON.stringify(loteria, null, 2))

  await conn.sendMessage(m.chat, { text: texto, mentions: [ganador] }, { quoted: m })
}

handler.help = ['sortearloteria']
handler.tags = ['owner']
handler.command = /^(sortearloteria|sortearloto)$/i
handler.desc = 'Sortear lotería'
handler.owner = true

export default handler