let handler = async (m, { conn }) => {
  let who = m.sender

  let esOwner = () => {
    if (!global.owner || !Array.isArray(global.owner)) return false
    let numeros = global.owner.map(([number]) => (number || '').replace(/[^0-9]/g, ''))
    return numeros.some(num => who.includes(num))
  }

  if (!m.fromMe && !esOwner()) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo los creadores pueden usar esto\n╰───────────────⬣'
    }, { quoted: m })
  }

  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [] }
    user = global.db.data.users[who]
  }

  if (!user.inventory || user.inventory.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No tienes personajes\n╰───────────────⬣'
    }, { quoted: m })
  }

  let tenia = user.inventory.length
  user.inventory = []
  global.markDatabaseModified()

  let texto = '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Colección vaciada\n│ 🍃 -' + tenia + ' personajes\n│ 🍃 Total: 0 personajes\n│ 🍃 Empieza de nuevo con .rw\n╰───────────────⬣'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['resetgacha']
handler.tags = ['owner']
handler.command = /^(resetgacha|cleargacha)$/i
handler.desc = 'Vacía tu colección de gacha'
handler.owner = true

export default handler