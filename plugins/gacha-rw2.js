import fetch from 'node-fetch'

let cooldownsRw2 = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0, inventory2: [] }
    user = global.db.data.users[who]
  }

  let now = Date.now()
  let cd = cooldownsRw2[who] || 0
  let tiempoRestante = Math.ceil((cd - now) / 1000)

  if (now < cd) {
    let minutos = Math.floor(tiempoRestante / 60)
    let segundos = tiempoRestante % 60
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA GACHA 2 」 ˚ʚ♡ɞ˚\n\n💫 » Espera ' + minutos + 'm ' + segundos + 's'
    }, { quoted: m })
  }

  if (!user.inventory2) user.inventory2 = []

  try {
    let apiUrl = 'https://api.delirius.store/anime/gacha'
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.data) {
      return conn.sendMessage(m.chat, { text: '❌ No se pudo obtener personaje' }, { quoted: m })
    }

    let char = json.data
    user.inventory2.push(char.name)
    cooldownsRw2[who] = now + 300000

    let texto = '𖣔 「 HINATA GACHA 2 」 ˚ʚ♡ɞ˚\n\n'
    texto += '  💫 Personaje obtenido\n\n'
    texto += '  ✦ ' + char.name + ' ✦\n'
    texto += '  🎬 Anime: ' + (char.anime || 'Desconocido') + '\n'
    texto += '  👤 Género: ' + (char.gender || 'N/A') + '\n'
    texto += '  🎒 Guardado en inventario 2\n\n'
    texto += '> ⏳ 5 minutos | #rw2'

    await conn.sendMessage(m.chat, {
      image: { url: char.image },
      caption: texto
    }, { quoted: m })

  } catch (e) {
    console.log(e)
    conn.sendMessage(m.chat, { text: '❌ Error' }, { quoted: m })
  }
}

handler.help = ['rw2']
handler.tags = ['gacha']
handler.command = /^(rw2|roll2|gacha2)$/i
handler.desc = 'Gacha de anime 2'

export default handler