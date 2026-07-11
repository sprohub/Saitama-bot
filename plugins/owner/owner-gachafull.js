import fs from 'fs'
import path from 'path'

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

  let gachaPath = path.join(process.cwd(), 'gacha.json')

  if (!fs.existsSync(gachaPath)) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No se encontró gacha.json\n╰───────────────⬣'
    }, { quoted: m })
  }

  let characters = JSON.parse(fs.readFileSync(gachaPath, 'utf8'))
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [] }
    user = global.db.data.users[who]
  }
  if (!user.inventory) user.inventory = []

  let agregados = 0
  for (let char of characters) {
    if (!user.inventory.includes(char.name)) {
      user.inventory.push(char.name)
      agregados++
    }
  }

  if (agregados === 0) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Ya tienes toda la colección\n│ 🍃 ' + user.inventory.length + ' personajes\n╰───────────────⬣'
    }, { quoted: m })
  }

  global.markDatabaseModified()

  let texto = '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Colección completada\n│ 🍃 +' + agregados + ' personajes nuevos\n│ 🍃 Total: ' + user.inventory.length + '/' + characters.length + ' personajes\n╰───────────────⬣'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['gachafull']
handler.tags = ['owner']
handler.command = /^(gachafull|fullgacha|todagacha)$/i
handler.desc = 'Obtén toda la colección de gacha'
handler.owner = true

export default handler