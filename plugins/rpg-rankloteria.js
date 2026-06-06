import fs from 'fs'
import path from 'path'

let handler = async (m, { conn }) => {
  let lotoPath = path.join(process.cwd(), 'loteria.json')
  let loteria

  if (fs.existsSync(lotoPath)) {
    loteria = JSON.parse(fs.readFileSync(lotoPath, 'utf8'))
  } else {
    return conn.sendMessage(m.chat, { text: '🎫 」\n\n💫 » No hay lotería activa' }, { quoted: m })
  }

  let sorted = Object.entries(loteria.boletos).sort((a, b) => b[1] - a[1]).slice(0, 10)

  if (sorted.length === 0) {
    return conn.sendMessage(m.chat, { text: '🎫 「 RANK LOTERÍA 」 🎫\n\n💫 » Sin boletos vendidos' }, { quoted: m })
  }

  let vendidos = Object.values(loteria.boletos).reduce((a, b) => a + b, 0)
  let texto = '🎫 「 RANK LOTERÍA 」 🎫\n\n💫 » ' + vendidos + '/200 | 💰 ' + loteria.totalRecaudado + ' 💎\n\n'
  let medallas = ['🥇', '🥈', '🥉', '4│', '5│', '6│', '7│', '8│', '9│', '🔟']

  for (let i = 0; i < sorted.length; i++) {
    let [id, cantidad] = sorted[i]
    let prob = ((cantidad / 200) * 100).toFixed(2)
    texto += medallas[i] + ' » @' + id.split('@')[0] + '\n   🎟️ ' + cantidad + ' | 📊 ' + prob + '%\n\n'
  }

  let mentions = sorted.map(([id]) => id)
  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
}

handler.help = ['rankloteria']
handler.tags = ['rpg']
handler.command = /^(rankloteria|rankloto)$/i
handler.desc = 'Ranking de lotería'

export default handler