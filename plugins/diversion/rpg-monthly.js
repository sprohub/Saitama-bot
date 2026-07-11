let cooldownsMonthly = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, lastMonthly: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let last = user.lastMonthly || 0
  let diff = now - last
  let cooldown = 2592000000

  if (diff < cooldown) {
    let restante = cooldown - diff
    let dias = Math.floor(restante / 86400000)
    let horas = Math.floor((restante % 86400000) / 3600000)
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA MONTHLY 」 ˚ʚ♡ɞ˚\n\n💫 » Ya reclamaste\n⏳ » Vuelve en ' + dias + 'd ' + horas + 'h'
    }, { quoted: m })
  }

  user.diamantes = (user.diamantes || 0) + 3000
  user.lastMonthly = now

  let texto = '𖣔 「 HINATA MONTHLY 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🎁 » Recompensa mensual\n'
  texto += '💎 » +3000 diamantes\n'
  texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
  texto += '> Vuelve en 30 días'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['monthly']
handler.tags = ['rpg']
handler.command = /^(monthly|mensual|don2)$/i
handler.desc = 'Recompensa mensual de 3000 💎'

export default handler