import fs from 'fs'
import path from 'path'

let cooldownsRw = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0, exp: 0, level: 0, inventory: [] }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsRw[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA RW 」 ˚ʚ♡ɞ˚\n\n💫 » Espera ' + minutos + 'm ' + segundos + 's\n\n> Usa #claim para reclamar tu último personaje'
    }, { quoted: m })
  }

  let gachaPath = path.join(process.cwd(), 'gacha.json')

  if (!fs.existsSync(gachaPath)) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA RW 」 ˚ʚ♡ɞ˚\n\n💫 » No hay personajes'
    }, { quoted: m })
  }

  let characters = JSON.parse(fs.readFileSync(gachaPath, 'utf8'))

  if (!user.inventory) user.inventory = []

  let probSSR = global.suerteGacha?.activa ? global.suerteGacha.probSSR : 0.02
  let probSR = global.suerteGacha?.activa ? global.suerteGacha.probSR : 0.15

  let random = Math.random()
  let rarity

  if (random < probSSR) {
    rarity = 'SSR'
  } else if (random < probSSR + probSR) {
    rarity = 'SR'
  } else {
    rarity = 'R'
  }

  let pool = characters.filter(c => c.rarity === rarity)
  if (pool.length === 0) pool = characters

  let char = pool[Math.floor(Math.random() * pool.length)]

  if (!global.lastRoll) global.lastRoll = {}
  global.lastRoll[who] = char
  cooldownsRw[who] = now + 300000

  let rarityEmojis = { 'SSR': '🌟', 'SR': '⭐', 'R': '✨' }

  let texto = '𖣔 「 HINATA RW 」 ˚ʚ♡ɞ˚\n\n'
  texto += '  💫 Personaje obtenido\n\n'
  texto += '  ✦ ' + char.name + ' ✦\n'
  texto += '  ' + rarityEmojis[rarity] + ' Rareza: ' + rarity + '\n'
  texto += '  ⚔️ ' + char.attack + ' | 🛡️ ' + char.defense + ' | ❤️ ' + char.health + '\n\n'
  texto += '> Usa #claim para guardarlo\n> ⏳ 5 minutos | #rw'

  await conn.sendMessage(m.chat, {
    image: { url: char.image },
    caption: texto
  }, { quoted: m })
}

handler.help = ['rw']
handler.tags = ['gacha']
handler.command = /^(rw|roll|gacha)$/i
handler.desc = 'Tira de la gacha'

export default handler