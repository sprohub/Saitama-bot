let handler = async (m, { conn }) => {
  let users = global.db.data.users
  let sorted = Object.entries(users)
    .filter(([id, u]) => u.inventory && u.inventory.length > 0)
    .sort((a, b) => (b[1].inventory?.length || 0) - (a[1].inventory?.length || 0))
    .slice(0, 10)

  let mentions = sorted.map(([id]) => id)

  if (!sorted.length) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA RANK GACHA 」 ˚ʚ♡ɞ˚\n\n💫 » Nadie tiene personajes aún\n\n> Usa #rw para conseguir'
    }, { quoted: m })
  }

  let texto = '𖣔 「 HINATA RANK GACHA 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🏆 » Top 10 coleccionistas\n\n'
  let medallas = ['🥇', '🥈', '🥉', '4│', '5│', '6│', '7│', '8│', '9│', '🔟']

  for (let i = 0; i < sorted.length; i++) {
    let [id, u] = sorted[i]
    texto += medallas[i] + ' » @' + id.split('@')[0] + '\n'
    texto += '   🎒 ' + u.inventory.length + ' personajes\n\n'
  }

  let who = m.sender
  let myPos = sorted.findIndex(([id]) => id === who)
  let myCount = users[who]?.inventory?.length || 0
  texto += '🎯 » Tu posición: #' + (myPos + 1 || '?') + ' | 🎒 ' + myCount + ' personajes'

  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
}

handler.help = ['rankgacha']
handler.tags = ['gacha']
handler.command = /^(rankgacha|topgacha)$/i
handler.desc = 'Ranking de coleccionistas'

export default handler