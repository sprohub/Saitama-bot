let handler = async (m, { conn }) => {
  let datos = [
    'No te extrañan, solo se aburren y te recuerdan 🥀',
    'No es que esté ocupado, es que no quiere responderte 📱',
    'Te quiere pero no lo suficiente como para estar contigo 💔',
    'No eres tú, soy yo... pero en realidad sí eres tú 🤡',
    'Si te ghostearon, no fue un error, fue una decisión 👻',
    'No te valora, solo te tiene de backup por si la otra no funciona 📋',
    'Te dice "te amo" pero también se lo dice a otros 3 más 💀',
    'No es que no quiera una relación, es que no la quiere CONTIGO 🗿',
    'Si te busca solo cuando está mal, eres su psicólogo gratis 🛋️',
    'Eras la opción, nunca la prioridad 🥈',
    'Te cambió por alguien que ni la mitad de lo que tú dabas 💀',
    'No era amor, era costumbre de tener a alguien ahí 🤷',
    'Te dejó en visto pero subió una historia segundos después 📸',
    'No te mereces migajas, mereces el pan completo 🍞',
    'Si te cela pero no te valora, no es amor, es ego 🎭',
    'Volvió porque la otra persona no le hizo caso, no porque te extrañe 🔄',
    'Te quiere tener, pero no te quiere querer 🎮',
    'Eres el "bueno" pero no el "suficiente" para él/ella 🥲',
    'No estabas compitiendo, pero perdiste igual 🏳️',
    'Te prometió la luna y no te dio ni un buenos días 🌙',
    'Si te dice "no estoy listo para una relación" y a la semana ya tiene otra 🤡',
    'Eras la persona correcta en el momento equivocado... según ellos ⏰',
    'Te pidió tiempo y se lo diste... a otra persona 💀',
    'No era tu momento, era tu turno en la fila 🎢',
    'Te habla solo cuando necesita atención, no cuando te necesita 💬',
    'No te enamoraste de la persona, te enamoraste del potencial ✨',
    'Si te hace llorar más de lo que te hace sonreír, ahí no es 🚩',
    'Te dijo "nadie te va a querer como yo"... y ojalá así sea 🙏',
    'No es amor, es dependencia emocional con pasos extra 🧠',
    'Eras su "te quiero" pero no su "te elijo" 💔',
    'Te dejó en visto y te vio la historia, jerarquía clarísima 📊',
    'Si duele, no es amor, es ansiedad con mariposas 🦋',
    'Te escribe a las 3 AM pero a las 3 PM ni te conoce 🕒',
    'No te quiere, solo no quiere estar solo 🧍',
    'Eres el plan B que nunca falla 📝',
    'Te dijo "eres diferente" y luego te trató igual que a los demás 🎭',
    'Te pidió espacio y se fue a orbitar a otra 🚀',
    'No te bloquea para tenerte de espectador de su nueva vida 🍿',
    'Te usa de terapia pero no te paga la sesión 💸',
    'Eres especial... como todos los demás en su lista 📋',
    'Te quiere lo suficiente para no soltarte pero no para amarte 🔗',
    'Si te busca solo en sus vacíos, eres relleno emocional 🕳️',
    'Te dejó de hablar y ni cuenta te diste porque siempre fuiste tú quien escribía 📝',
    'No te quiso, solo le gustó cómo lo querías 🪞'
  ]

  let dato = datos[Math.floor(Math.random() * datos.length)]

  let texto = '💀 「 HINATA FACTO 」 💀\n\n'
  texto += dato + '\n\n'
  texto += '> Facto del día'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['facto']
handler.tags = ['diversion']
handler.command = /^(facto|fact|datoamor|realidad)$/i
handler.desc = 'Factos de desamor y ego'

export default handler