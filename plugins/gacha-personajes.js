import fs from 'fs'
import path from 'path'

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [] }
    user = global.db.data.users[who]
  }

  let gachaPath = path.join(process.cwd(), 'gacha.json')

  if (!fs.existsSync(gachaPath)) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA COLECCIÓN 」 ˚ʚ♡ɞ˚\n\n💫 » No hay personajes disponibles'
    }, { quoted: m })
  }

  let characters = JSON.parse(fs.readFileSync(gachaPath, 'utf8'))
  let inventory = user.inventory || []

  let obtenidos = []
  let noObtenidos = []

  for (let char of characters) {
    let count = inventory.filter(item => item === char.name).length
    if (count > 0) {
      obtenidos.push({ ...char, count })
    } else {
      noObtenidos.push(char)
    }
  }

  let total = characters.length
  let tengo = obtenidos.length
  let porcentaje = Math.floor((tengo / total) * 100)

  let barra = ''
  let completado = Math.floor(porcentaje / 10)
  for (let i = 0; i < 10; i++) {
    barra += i < completado ? '🟣' : '⚫'
  }

  let rarityEmojis = { 'SSR': '🌟', 'SR': '⭐', 'R': '✨' }

  let texto = '𖣔 「 HINATA COLECCIÓN 」 ˚ʚ♡ɞ˚\n\n'
  texto += '📊 » ' + tengo + '/' + total + ' (' + porcentaje + '%)\n'
  texto += '📈 » ' + barra + '\n\n'

  texto += '✅ *OBTENIDOS* (' + tengo + ')\n'
  for (let char of obtenidos) {
    texto += rarityEmojis[char.rarity] + ' » ' + char.name
    if (char.count > 1) texto += ' x' + char.count
    texto += '\n'
  }

  texto += '\n❌ *NO OBTENIDOS* (' + noObtenidos.length + ')\n'
  for (let char of noObtenidos) {
    texto += rarityEmojis[char.rarity] + ' » ' + char.name + '\n'
  }

  texto += '\n> Sigue tirando #rw para completar'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['personajes']
handler.tags = ['gacha']
handler.command = /^(coleccion|album|personajes)$/i
handler.desc = 'Muestra tu colección de personajes'

export default handler