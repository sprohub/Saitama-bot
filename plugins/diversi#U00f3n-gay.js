let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender
  let name = '@' + who.split('@')[0]
  let porcentaje = Math.floor(Math.random() * 101)

  let emoji, frase, extra

  if (porcentaje >= 90) {
    emoji = '🏳️‍🌈'
    frase = 'Reina del Pride'
    extra = 'Arcoíris total, dueñ@ del desfile del orgullo'
  } else if (porcentaje >= 70) {
    emoji = '🌈'
    frase = 'Arcoíris brillante'
    extra = 'Se te nota hasta en la forma de caminar'
  } else if (porcentaje >= 50) {
    emoji = '💅'
    frase = 'Bicurios@'
    extra = 'Un día te gustan ellos, otro día ellas, otro día tú mismo'
  } else if (porcentaje >= 30) {
    emoji = '🤔'
    frase = 'En duda'
    extra = 'Ni tú mismo sabes qué te gusta, pero todo bien'
  } else if (porcentaje >= 10) {
    emoji = '💪'
    frase = 'Casi hetero'
    extra = 'Muy macho pecho peludo pero con gustos finos'
  } else {
    emoji = '🦅'
    frase = 'Hetero supremo'
    extra = 'Te gusta el pollo asado, el fútbol y la cerveza'
  }

  let barra = ''
  let completado = Math.floor(porcentaje / 10)
  for (let i = 0; i < 10; i++) {
    barra += i < completado ? '🏳️‍🌈' : '⬛'
  }

  let texto = '𖣔 「 HINATA GAYMETRO 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🎯 » ' + name + '\n\n'
  texto += emoji + ' » ' + porcentaje + '%\n'
  texto += '📊 » ' + barra + '\n'
  texto += '💫 » ' + frase + '\n'
  texto += '📝 » ' + extra

  await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })
}

handler.help = ['gay']
handler.tags = ['diversion']
handler.command = /^(gay|gaymetro|lgbt)$/i
handler.desc = 'Mide qué tan gay eres'

export default handler