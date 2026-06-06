import speed from 'performance-now'

let handler = async (m, { conn }) => {
  let start = speed()
  await conn.sendMessage(m.chat, { text: '⏳ » Hinata está midiendo su chakra...' }, { quoted: m })
  let end = speed()

  let vel = (end - start).toFixed(3)

  let emoji, frase, color
  let chakra = Math.floor(Math.random() * 100)

  if (vel < 80) {
    emoji = '⚡'
    frase = '¡Byakugan activado! Hinata está en modo bestia'
    color = '#00FF00'
  } else if (vel < 200) {
    emoji = '🌸'
    frase = 'Hinata está entrenando con Neji, va muy bien'
    color = '#7FFF00'
  } else if (vel < 400) {
    emoji = '🍥'
    frase = 'Hinata está comiendo ramen con Naruto, velocidad normal'
    color = '#FFD700'
  } else if (vel < 700) {
    emoji = '😤'
    frase = 'Hinata tropezó en el camino ninja, va lento'
    color = '#FF8C00'
  } else {
    emoji = '💤'
    frase = 'Hinata se desmayó... Kiba la está llevando al hospital'
    color = '#FF0000'
  }

  let texto = emoji + ' 「 HINATA PING 」 ' + emoji + '\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += frase + '\n\n'
  texto += '📊 Velocidad: ' + vel + ' ms\n'
  texto += '💙 Chakra: ' + chakra + '%\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['ping']
handler.tags = ['info']
handler.command = /^(ping|velocidad|speed)$/i
handler.desc = 'Mide la velocidad de Hinata'

export default handler