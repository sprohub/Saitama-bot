import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, triviaWins: 0 }
    user = global.db.data.users[who]
  }

  if (global.triviaUsers && global.triviaUsers[who]) {
    return conn.sendMessage(m.chat, { text: '🎮 「 HINATA TRIVIA 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n⏳ » Ya tienes una trivia activa\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  }

  let preguntas = [
    { pregunta: '¿Cuál es la capital de Francia?', opciones: ['Madrid', 'París', 'Londres', 'Roma'], respuesta: 1 },
    { pregunta: '¿Cuántos planetas tiene el sistema solar?', opciones: ['7', '8', '9', '10'], respuesta: 1 },
    { pregunta: '¿Quién pintó la Mona Lisa?', opciones: ['Van Gogh', 'Picasso', 'Da Vinci', 'Miguel Ángel'], respuesta: 2 },
    { pregunta: '¿Cuál es el océano más grande?', opciones: ['Atlántico', 'Índico', 'Ártico', 'Pacífico'], respuesta: 3 },
    { pregunta: '¿En qué año llegó el hombre a la luna?', opciones: ['1965', '1969', '1971', '1975'], respuesta: 1 },
    { pregunta: '¿Cuál es el animal más rápido del mundo?', opciones: ['Guepardo', 'Halcón peregrino', 'Tiburón', 'Águila'], respuesta: 1 },
    { pregunta: '¿Qué país tiene forma de bota?', opciones: ['España', 'México', 'Italia', 'Chile'], respuesta: 2 },
    { pregunta: '¿Cuántos corazones tiene un pulpo?', opciones: ['1', '2', '3', '4'], respuesta: 2 },
    { pregunta: '¿Cuál es el elemento más abundante en el universo?', opciones: ['Oxígeno', 'Carbono', 'Hidrógeno', 'Helio'], respuesta: 2 },
    { pregunta: '¿Quién escribió "Cien años de soledad"?', opciones: ['Vargas Llosa', 'García Márquez', 'Pablo Neruda', 'Julio Cortázar'], respuesta: 1 },
    { pregunta: '¿Cuál es el hueso más largo del cuerpo?', opciones: ['Tibia', 'Fémur', 'Húmero', 'Costilla'], respuesta: 1 },
    { pregunta: '¿En qué país está la Torre Eiffel?', opciones: ['Italia', 'España', 'Francia', 'Alemania'], respuesta: 2 },
    { pregunta: '¿Qué gas respiran las plantas?', opciones: ['Oxígeno', 'Nitrógeno', 'CO2', 'Hidrógeno'], respuesta: 2 },
    { pregunta: '¿Cuál es el río más largo del mundo?', opciones: ['Nilo', 'Amazonas', 'Mississippi', 'Yangtsé'], respuesta: 1 },
    { pregunta: '¿Qué deporte practica Messi?', opciones: ['Tenis', 'Baloncesto', 'Fútbol', 'Béisbol'], respuesta: 2 },
    { pregunta: '¿Cuántos lados tiene un hexágono?', opciones: ['5', '6', '7', '8'], respuesta: 1 },
    { pregunta: '¿Qué animal es el rey de la selva?', opciones: ['Tigre', 'León', 'Elefante', 'Gorila'], respuesta: 1 },
    { pregunta: '¿Cuál es el país más grande del mundo?', opciones: ['China', 'USA', 'Canadá', 'Rusia'], respuesta: 3 },
    { pregunta: '¿Qué vitamina produce el sol?', opciones: ['A', 'C', 'D', 'E'], respuesta: 2 },
    { pregunta: '¿Quién creó Microsoft?', opciones: ['Steve Jobs', 'Bill Gates', 'Mark Zuckerberg', 'Elon Musk'], respuesta: 1 },
    { pregunta: '¿Cuántos días tiene un año bisiesto?', opciones: ['364', '365', '366', '367'], respuesta: 2 },
    { pregunta: '¿Qué órgano bombea la sangre?', opciones: ['Pulmón', 'Cerebro', 'Corazón', 'Hígado'], respuesta: 2 },
    { pregunta: '¿Cuál es el metal más caro?', opciones: ['Oro', 'Platino', 'Rodio', 'Plata'], respuesta: 2 },
    { pregunta: '¿En qué continente está Egipto?', opciones: ['Asia', 'Europa', 'África', 'Oceanía'], respuesta: 2 },
    { pregunta: '¿Qué significa WiFi?', opciones: ['Wireless Fidelity', 'Wireless Fiber', 'Wide Frequency', 'Wireless Finder'], respuesta: 0 },
    { pregunta: '¿Cuál es la montaña más alta?', opciones: ['K2', 'Everest', 'Kilimanjaro', 'Aconcagua'], respuesta: 1 },
    { pregunta: '¿Qué año empezó la WWII?', opciones: ['1937', '1938', '1939', '1940'], respuesta: 2 },
    { pregunta: '¿Cuántos huesos tiene un adulto?', opciones: ['186', '196', '206', '216'], respuesta: 2 },
    { pregunta: '¿Qué país inventó la pizza?', opciones: ['Francia', 'España', 'Italia', 'Grecia'], respuesta: 2 },
    { pregunta: '¿Cuál es el idioma más hablado?', opciones: ['Inglés', 'Español', 'Chino mandarín', 'Hindi'], respuesta: 2 },
    { pregunta: '¿Qué planeta es el más cercano al sol?', opciones: ['Venus', 'Tierra', 'Mercurio', 'Marte'], respuesta: 2 },
    { pregunta: '¿Cuántas patas tiene una araña?', opciones: ['6', '8', '10', '12'], respuesta: 1 },
    { pregunta: '¿Qué país ganó el Mundial 2022?', opciones: ['Francia', 'Brasil', 'Argentina', 'Alemania'], respuesta: 2 },
    { pregunta: '¿Cuál es el símbolo del oro?', opciones: ['Ag', 'Au', 'Fe', 'Cu'], respuesta: 1 },
    { pregunta: '¿Qué animal pone los huevos más grandes?', opciones: ['Gallina', 'Avestruz', 'Pato', 'Pavo'], respuesta: 1 },
    { pregunta: '¿Cuál es la velocidad de la luz?', opciones: ['300 mil km/s', '150 mil km/s', '500 mil km/s', '200 mil km/s'], respuesta: 0 },
    { pregunta: '¿Qué fruta tiene potasio?', opciones: ['Manzana', 'Banana', 'Naranja', 'Uva'], respuesta: 1 },
    { pregunta: '¿Quién pintó la Capilla Sixtina?', opciones: ['Da Vinci', 'Rafael', 'Miguel Ángel', 'Donatello'], respuesta: 2 },
    { pregunta: '¿Cuál es el país más pequeño?', opciones: ['Mónaco', 'Vaticano', 'San Marino', 'Malta'], respuesta: 1 },
    { pregunta: '¿Qué instrumento mide terremotos?', opciones: ['Termómetro', 'Barómetro', 'Sismógrafo', 'Cronómetro'], respuesta: 2 },
    { pregunta: '¿Cuántos minutos tiene un día?', opciones: ['1440', '1340', '1540', '1240'], respuesta: 0 },
    { pregunta: '¿Qué animal es el más grande del mundo?', opciones: ['Elefante', 'Ballena azul', 'Tiburón ballena', 'Jirafa'], respuesta: 1 },
    { pregunta: '¿Cuál es el color de la esperanza?', opciones: ['Rojo', 'Azul', 'Verde', 'Amarillo'], respuesta: 2 },
    { pregunta: '¿Qué país tiene más habitantes?', opciones: ['India', 'China', 'USA', 'Indonesia'], respuesta: 0 },
    { pregunta: '¿Cómo se llama el miedo a las alturas?', opciones: ['Claustrofobia', 'Agorafobia', 'Acrofobia', 'Aracnofobia'], respuesta: 2 },
    { pregunta: '¿Cuántos litros de sangre tiene un adulto?', opciones: ['3-4', '5-6', '7-8', '9-10'], respuesta: 1 },
    { pregunta: '¿Qué planeta tiene anillos?', opciones: ['Marte', 'Júpiter', 'Saturno', 'Urano'], respuesta: 2 },
    { pregunta: '¿Quién descubrió América?', opciones: ['Magallanes', 'Colón', 'Vespucio', 'Cortés'], respuesta: 1 },
    { pregunta: '¿Cuál es el metal líquido?', opciones: ['Plomo', 'Mercurio', 'Estaño', 'Zinc'], respuesta: 1 },
    { pregunta: '¿Qué significa ADN?', opciones: ['Ácido Desoxirribonucleico', 'Ácido Dinitrogenado', 'Amino Desoxirribosa', 'Ácido Nucleico'], respuesta: 0 }
  ]

  let trivia = preguntas[Math.floor(Math.random() * preguntas.length)]

  if (!global.triviaUsers) global.triviaUsers = {}
  global.triviaUsers[who] = {
    respuesta: trivia.respuesta,
    tiempo: Date.now() + 30000
  }

  let rows = trivia.opciones.map((op, i) => ({
    header: ['A', 'B', 'C', 'D'][i],
    title: op,
    description: 'Opción ' + ['A', 'B', 'C', 'D'][i],
    id: 'trivia_' + i
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: '🎮 HINATA TRIVIA 🎮', subtitle: 'Responde correctamente | 🏆 2 💎', hasMediaAttachment: false },
    body: { text: '🎮 「 HINATA TRIVIA 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❓ » ' + trivia.pregunta + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> ⏰ 30 segundos' },
    footer: { text: '⫏⫏ HINATA GAMES ✿' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '📝 OPCIONES',
          sections: [{ title: '❓ ' + trivia.pregunta.substring(0, 30), rows }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  setTimeout(() => {
    if (global.triviaUsers && global.triviaUsers[who]) {
      delete global.triviaUsers[who]
      conn.sendMessage(m.chat, { text: '🎮 「 HINATA TRIVIA 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n⏰ » ¡Se acabó el tiempo!\n📝 » Era: ' + ['A', 'B', 'C', 'D'][trivia.respuesta] + '. ' + trivia.opciones[trivia.respuesta] + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
    }
  }, 30000)
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('trivia_')) return false

    let who = m.sender
    if (!global.triviaUsers || !global.triviaUsers[who]) return false

    let trivia = global.triviaUsers[who]
    let respuesta = parseInt(id.replace('trivia_', ''))
    delete global.triviaUsers[who]

    if (respuesta === trivia.respuesta) {
      let user = global.db.data.users[who]
      if (!user) global.db.data.users[who] = { diamantes: 0, exp: 0, triviaWins: 0 }
      user = global.db.data.users[who]
      user.diamantes = (user.diamantes || 0) + 2
      user.exp = (user.exp || 0) + 15
      user.triviaWins = (user.triviaWins || 0) + 1

      await conn.sendMessage(m.chat, { text: '🎮 「 HINATA TRIVIA 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🏆 » ¡CORRECTO!\n💎 » +2 diamantes\n✨ » +15 exp\n🏅 » Total wins: ' + user.triviaWins + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, { text: '🎮 「 HINATA TRIVIA 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❌ » Incorrecto\n📝 » Era: ' + ['A', 'B', 'C', 'D'][trivia.respuesta] + '. ' + ['A', 'B', 'C', 'D'][trivia.respuesta] + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
    }
    return true
  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['trivia']
handler.tags = ['game']
handler.command = /^(trivia|pregunta)$/i
handler.desc = 'Trivia | 🏆 2 💎'

export default handler