import fs from 'fs'
import path from 'path'

let handler = async (m, { conn }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA GACHA FULL 」 ˚ʚ♡ɞ˚\n\n💫 » Solo los creadores'
    }, { quoted: m })
  }

  let gachaPath = path.join(process.cwd(), 'gacha.json')

  if (!fs.existsSync(gachaPath)) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA GACHA FULL 」 ˚ʚ♡ɞ˚\n\n💫 » No hay gacha.json'
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
      text: '𖣔 「 HINATA GACHA FULL 」 ˚ʚ♡ɞ˚\n\n💫 » Ya tienes toda la colección\n📊 » ' + user.inventory.length + ' personajes'
    }, { quoted: m })
  }

  let texto = '𖣔 「 HINATA GACHA FULL 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🌟 » Colección completada\n\n'
  texto += '📦 » +' + agregados + ' personajes nuevos\n'
  texto += '🎒 » Total: ' + user.inventory.length + '/' + characters.length + ' personajes\n\n'
  texto += '> Eres el dueño de la gacha'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['gachafull']
handler.tags = ['owner']
handler.command = /^(gachafull|fullgacha|todagacha)$/i
handler.desc = 'Obtén toda la colección de gacha'
handler.owner = true

export default handler