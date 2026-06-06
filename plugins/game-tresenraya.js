import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let juegos = {}

let handler = async (m, { conn, usedPrefix }) => {
  let who = m.sender

  if (juegos[who]) {
    return conn.sendMessage(m.chat, {
      text: '🎮 「 HINATA 3 EN RAYA 」 🎮\n\n💫 » Ya tienes un juego activo\n> Termina tu partida actual'
    }, { quoted: m })
  }

  let tablero = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  let turno = 'X'

  juegos[who] = {
    tablero: tablero,
    turno: turno
  }

  await mostrarTablero(conn, m, who)
}

async function mostrarTablero(conn, m, who) {
  let juego = juegos[who]
  if (!juego) return

  let t = juego.tablero
  let tableroTexto = `
${t[0]} │ ${t[1]} │ ${t[2]}
──┼───┼──
${t[3]} │ ${t[4]} │ ${t[5]}
──┼───┼──
${t[6]} │ ${t[7]} │ ${t[8]}
`

  let ocupadas = t.filter(c => c === 'X' || c === 'O')
  let disponibles = t.filter(c => c !== 'X' && c !== 'O')

  if (ocupadas.length === 9 || verificarGanador(t)) {
    let ganador = verificarGanador(t)
    delete juegos[who]

    let user = global.db.data.users[who]
    let texto

    if (ganador === 'X') {
      if (!user) global.db.data.users[who] = { diamantes: 0 }
      user = global.db.data.users[who]
      user.diamantes = (user.diamantes || 0) + 5
      texto = '🎮 「 HINATA 3 EN RAYA 」 🎮\n\n' + tableroTexto + '\n\n🏆 » ¡GANASTE!\n💎 » +5 diamantes\n💰 » Total: ' + user.diamantes + ' 💎'
    } else if (ganador === 'O') {
      texto = '🎮 「 HINATA 3 EN RAYA 」 🎮\n\n' + tableroTexto + '\n\n💀 » La bot te ganó\n😵 » Mejor suerte la próxima'
    } else {
      texto = '🎮 「 HINATA 3 EN RAYA 」 🎮\n\n' + tableroTexto + '\n\n🤝 » ¡Empate!'
    }

    return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }

  let rows = disponibles.map(pos => ({
    header: '',
    title: 'Casilla ' + pos,
    description: 'Colocar aquí',
    id: 'ttt_' + (parseInt(pos) - 1)
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: '🎮 HINATA 3 EN RAYA 🎮', subtitle: 'Tú: ❌ | Bot: ⭕', hasMediaAttachment: false },
    body: { text: '🎮 「 HINATA 3 EN RAYA 」 🎮\n\n' + tableroTexto + '\n> Elige una casilla\n> 🏆 Premio: 5 💎' },
    footer: { text: '⫏⫏ HINATA GAMES ✿' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎯 CASILLAS DISPONIBLES',
          sections: [{ title: '📝 Elige dónde colocar', rows }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

function verificarGanador(t) {
  let lineas = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ]

  for (let linea of lineas) {
    let [a, b, c] = linea
    if (t[a] === t[b] && t[b] === t[c]) {
      return t[a]
    }
  }
  return null
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('ttt_')) return false

    let who = m.sender
    if (!juegos[who]) return false

    let juego = juegos[who]
    let pos = parseInt(id.replace('ttt_', ''))

    if (juego.tablero[pos] === 'X' || juego.tablero[pos] === 'O') return true

    juego.tablero[pos] = 'X'

    if (!verificarGanador(juego.tablero)) {
      let disponibles = juego.tablero
        .map((v, i) => v !== 'X' && v !== 'O' ? i : null)
        .filter(v => v !== null)

      if (disponibles.length > 0) {
        let mejor = disponibles.find(p => {
          let copia = [...juego.tablero]
          copia[p] = 'O'
          return verificarGanador(copia) === 'O'
        })

        if (mejor === undefined || mejor === null) {
          mejor = disponibles.find(p => {
            let copia = [...juego.tablero]
            copia[p] = 'X'
            return verificarGanador(copia) === 'X'
          })
        }

        if (mejor === undefined || mejor === null) {
          mejor = disponibles[Math.floor(Math.random() * disponibles.length)]
        }

        juego.tablero[mejor] = 'O'
      }
    }

    await mostrarTablero(conn, m, who)
    return true

  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['tictactoe']
handler.tags = ['game']
handler.command = /^(tictactoe|ttt|3enraya|tresenraya)$/i
handler.desc = '3 en raya contra la bot | 🏆 5 💎'

export default handler