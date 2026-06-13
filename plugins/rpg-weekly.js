let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, lastWeekly: 0 }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let last = user.lastWeekly || 0
  let diff = now - last
  let cooldown = 604800000

  if (diff < cooldown) {
    let restante = cooldown - diff
    let dias = Math.floor(restante / 86400000)
    let horas = Math.floor((restante % 86400000) / 3600000)
    return conn.sendMessage(m.chat, {
      text: `╭━━⬣『 SAITAMA WEEKLY 』⬣
┃
┃ 👊 » Ya reclamaste tu recompensa
┃ ⏳ » Vuelve en ${dias}d ${horas}h
┃
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  user.diamantes = (user.diamantes || 0) + 500
  user.lastWeekly = now

  let texto = `╭━━⬣『 SAITAMA WEEKLY 』⬣
┃
┃ 🎁 » Recompensa semanal reclamada
┃ 💎 » +500 diamantes obtenidos
┃ 💰 » Total: ${user.diamantes} 💎
┃
┃ > Vuelve en 7 días
╰━━━━━━━━━━━━━━━━━━━━━━⬣`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['weekly']
handler.tags = ['rpg']
handler.command = /^(weekly|semanal|don)$/i
handler.desc = 'Recompensa semanal de 500 💎'

export default handler