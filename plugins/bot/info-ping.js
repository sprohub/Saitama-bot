import speed from 'performance-now'

let handler = async (m, { conn }) => {
  let start = speed()
  await conn.sendMessage(m.chat, { text: '⏳ » Saitama está midiendo su golpe...' }, { quoted: m })
  let end = speed()

  let vel = (end - start).toFixed(3)

  let emoji, frase, color
  let poder = Math.floor(Math.random() * 100)

  if (vel < 80) {
    emoji = '👊'
    frase = '¡Un solo golpe! Saitama acaba con todo en un instante'
    color = '#FFFF00'
  } else if (vel < 200) {
    emoji = '🦸'
    frase = 'Saitama entrenando: 100 flexiones, 100 sentadillas, 10km'
    color = '#FFD700'
  } else if (vel < 400) {
    emoji = '🛒'
    frase = 'Saitama está de compras esperando las ofertas, velocidad normal'
    color = '#FFA500'
  } else if (vel < 700) {
    emoji = '😑'
    frase = 'Saitama está aburrido, ningún rival lo hace ir más rápido'
    color = '#FF8C00'
  } else {
    emoji = '💤'
    frase = 'Saitama se quedó dormido esperando una pelea decente'
    color = '#FF0000'
  }

  let texto = emoji + ' 「 SAITAMA PING 」 ' + emoji + '\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += frase + '\n\n'
  texto += '📊 Velocidad: ' + vel + ' ms\n'
  texto += '👊 Poder: ' + poder + '%\n\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  await conn.sendMessage(m.chat, {
    image: { url: 'https://i.ibb.co/ZzmGwWRp/70a442b4-e75b-409c-9c6d-6994713f5726.png' },
    caption: texto
  }, { quoted: m })
}

handler.help = ['ping']
handler.tags = ['info']
handler.command = /^(ping|velocidad|speed)$/i
handler.desc = 'Mide la velocidad de Saitama'

export default handler