let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : m.sender
  let name = '@' + who.split('@')[0]
  let porcentaje = Math.floor(Math.random() * 101)

  let emoji, frase, extra, imagen

  if (porcentaje >= 90) {
    emoji = '🏳️‍🌈'
    frase = 'Reina del Pride'
    extra = 'Arcoíris total, dueñ@ del desfile del orgullo'
    imagen = 'https://i.ibb.co/N6zgDnKk/usted-es-un-marica-supremo.png'
  } else if (porcentaje >= 70) {
    emoji = '🌈'
    frase = 'Arcoíris brillante'
    extra = 'Se te nota hasta en la forma de caminar'
    imagen = 'https://i.ibb.co/QsnHyxH/Reina-del-Pride.png'
  } else if (porcentaje >= 50) {
    emoji = '💅'
    frase = 'Bicurios@'
    extra = 'Un día te gustan ellos, otro día ellas, otro día tú mismo'
    imagen = 'https://i.ibb.co/DgRFxpB5/Bicurios.png'
  } else if (porcentaje >= 30) {
    emoji = '🤔'
    frase = 'En duda'
    extra = 'Ni tú mismo sabes qué te gusta, pero todo bien'
    imagen = 'https://i.ibb.co/DgRFxpB5/Bicurios.png'
  } else if (porcentaje >= 10) {
    emoji = '💪'
    frase = 'Casi hetero'
    extra = 'Muy macho pecho peludo pero con gustos finos'
    imagen = 'https://i.ibb.co/mVRJQytq/Casi-hetero.png'
  } else {
    emoji = '🦅'
    frase = 'Hetero supremo'
    extra = 'Te gusta el pollo asado, el fútbol y la cerveza'
    imagen = 'https://i.ibb.co/Ndm9r3yh/Heterosupremo.png'
  }

  let barra = ''
  let completado = Math.floor(porcentaje / 10)
  for (let i = 0; i < 10; i++) {
    barra += i < completado ? '🏳️‍🌈' : '⬛'
  }

  let texto = `╭─⪼ *SAITAMA HETEROMETRO*\n`
  texto += `│ 🎯 » ${name}\n`
  texto += `│ ${emoji} » ${porcentaje}%\n`
  texto += `│ 📊 » ${barra}\n`
  texto += `│ 💫 » ${frase}\n`
  texto += `│ 📝 » ${extra}\n`
  texto += `╰───────────────⬣`

  await conn.sendMessage(m.chat, { image: { url: imagen }, caption: texto, mentions: [who] }, { quoted: m })
}

handler.help = ['cuantohetero']
handler.tags = ['diversion']
handler.command = /^(cuantohetero|heterometro)$/i
handler.desc = 'Mide qué tan hetero eres'

export default handler
