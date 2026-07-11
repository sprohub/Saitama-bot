import fs from 'fs'
import path from 'path'

let handler = async (m, { conn }) => {
  let lotoPath = path.join(process.cwd(), 'loteria.json')
  let loteria

  if (fs.existsSync(lotoPath)) {
    loteria = JSON.parse(fs.readFileSync(lotoPath, 'utf8'))
  } else {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ *SAITAMA-BOT*\n│ RANK LOTERÍA\n╰───────────────⬣\n\n» No hay lotería activa'
    }, { quoted: m })
  }

  let sorted = Object.entries(loteria.boletos).sort((a, b) => b[1] - a[1]).slice(0, 10)

  if (sorted.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ *SAITAMA-BOT*\n│ RANK LOTERÍA\n╰───────────────⬣\n\n» Sin boletos vendidos'
    }, { quoted: m })
  }

  let vendidos = Object.values(loteria.boletos).reduce((a, b) => a + b, 0)
  let texto = '╭─⪼ *SAITAMA-BOT*\n│ RANK LOTERÍA\n╰───────────────⬣\n\n'
  texto += '» ' + vendidos + '/200 boletos | Premio: ' + loteria.totalRecaudado + '\n\n'

  let puestos = ['1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°']

  for (let i = 0; i < sorted.length; i++) {
    let [id, cantidad] = sorted[i]
    let prob = ((cantidad / 200) * 100).toFixed(2)
    texto += puestos[i] + ' » @' + id.split('@')[0] + '\n   Boletos: ' + cantidad + ' | Prob: ' + prob + '%\n\n'
  }

  let mentions = sorted.map(([id]) => id)
  await conn.sendMessage(m.chat, {
    image: { url: 'https://i.ibb.co/QFQqmtLt/rankloteria-js.png' },
    caption: texto,
    mentions
  }, { quoted: m })
}

handler.help = ['rankloteria']
handler.tags = ['rpg']
handler.command = /^(rankloteria|rankloto)$/i
handler.desc = 'Ranking de lotería'

export default handler
