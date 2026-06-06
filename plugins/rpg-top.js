let handler = async (m, { conn }) => {
  let who = m.sender
  let users = global.db.data.users
  let sorted = Object.entries(users)
    .filter(([id, user]) => (user.diamantes || 0) + (user.bank || 0) > 0)
    .sort((a, b) => ((b[1].diamantes || 0) + (b[1].bank || 0)) - ((a[1].diamantes || 0) + (a[1].bank || 0)))
    .slice(0, 10)

  let mentions = sorted.map(([id]) => id)

  if (!sorted.length) return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA TOP 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n📭 » Aún no hay jugadores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let texto = '⚔️ 「 HINATA TOP GLOBAL 」 ⚔️\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  let medallas = ['🥇', '🥈', '🥉', '4│', '5│', '6│', '7│', '8│', '9│', '🔟']

  for (let i = 0; i < sorted.length; i++) {
    let [id, u] = sorted[i]
    let total = (u.diamantes || 0) + (u.bank || 0)
    texto += medallas[i] + ' » @' + id.split('@')[0] + '\n   💎 ' + total + ' | 💰 ' + (u.diamantes || 0) + ' | 🏦 ' + (u.bank || 0) + '\n\n'
  }

  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n'

  let allSorted = Object.entries(users).filter(([id, user]) => (user.diamantes || 0) + (user.bank || 0) > 0).sort((a, b) => ((b[1].diamantes || 0) + (b[1].bank || 0)) - ((a[1].diamantes || 0) + (a[1].bank || 0)))
  let myPosition = allSorted.findIndex(([id]) => id === who)
  let myUser = users[who]
  let myTotal = (myUser?.diamantes || 0) + (myUser?.bank || 0)
  texto += '\n🎯 » Tu posición: #' + (myPosition + 1 || '?') + ' | 💎 ' + myTotal + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
}

handler.help = ['rank']
handler.tags = ['rpg']
handler.command = /^(toprank|topglobal|rank)$/i
handler.desc = 'Top global de diamantes'

export default handler