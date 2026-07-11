import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let handler = async (m, { conn, args }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, diamond: 0 }
    user = global.db.data.users[who]
  }

  if (!args[0] || !args[1]) {
    let sections = [{
      title: '✊ ELIGE TU JUGADA',
      rows: [
        { header: '🪨', title: 'Piedra', description: 'Gana a tijera | Apuesta 💎', id: 'ppt_piedra_' + (parseInt(args[0]) || 10) },
        { header: '📄', title: 'Papel', description: 'Gana a piedra | Apuesta 💎', id: 'ppt_papel_' + (parseInt(args[0]) || 10) },
        { header: '✂️', title: 'Tijera', description: 'Gana a papel | Apuesta 💎', id: 'ppt_tijera_' + (parseInt(args[0]) || 10) }
      ]
    }]

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '✊ HINATA PPT ✊', subtitle: 'Piedra, Papel o Tijera | x2', hasMediaAttachment: false },
      body: { text: '✊ 「 HINATA PPT 」 ✊\n\n💫 » Elige tu jugada\n\n> #ppt <jugada> <apuesta>\n> #ppt piedra 10' },
      footer: { text: '⫏⫏ HINATA GAMES ✿' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎮 JUGAR AHORA',
            sections: sections
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return
  }

  let jugada = args[0].toLowerCase()
  let apuesta = parseInt(args[1])

  if (!['piedra', 'papel', 'tijera'].includes(jugada)) {
    return conn.sendMessage(m.chat, {
      text: '✊ 「 HINATA PPT 」 ✊\n\n💫 » Jugada inválida\n\n> piedra | papel | tijera'
    }, { quoted: m })
  }

  if (isNaN(apuesta) || apuesta <= 0) {
    return conn.sendMessage(m.chat, {
      text: '✊ 「 HINATA PPT 」 ✊\n\n💫 » Apuesta inválida\n\n> #ppt piedra 10'
    }, { quoted: m })
  }

  let misDiamantes = user.diamantes || user.diamond || 0
  if (misDiamantes < apuesta) {
    return conn.sendMessage(m.chat, {
      text: '✊ 「 HINATA PPT 」 ✊\n\n💫 » No tienes tantos 💎\n💰 » Tienes: ' + misDiamantes
    }, { quoted: m })
  }

  let opciones = ['piedra', 'papel', 'tijera']
  let botJugada = opciones[Math.floor(Math.random() * opciones.length)]

  let resultado
  if (jugada === botJugada) {
    resultado = 'empate'
  } else if (
    (jugada === 'piedra' && botJugada === 'tijera') ||
    (jugada === 'papel' && botJugada === 'piedra') ||
    (jugada === 'tijera' && botJugada === 'papel')
  ) {
    resultado = 'ganaste'
  } else {
    resultado = 'perdiste'
  }

  let emojis = { piedra: '🪨', papel: '📄', tijera: '✂️' }

  if (resultado === 'ganaste') {
    if (user.diamantes !== undefined) {
      user.diamantes = misDiamantes + apuesta
    } else {
      user.diamond = misDiamantes + apuesta
    }
  } else if (resultado === 'perdiste') {
    if (user.diamantes !== undefined) {
      user.diamantes = misDiamantes - apuesta
    } else {
      user.diamond = misDiamantes - apuesta
    }
  }

  let total = user.diamantes || user.diamond || 0

  let texto = '✊ 「 HINATA PPT 」 ✊\n\n'
  texto += '👤 » Tú: ' + emojis[jugada] + '\n'
  texto += '🤖 » La bot: ' + emojis[botJugada] + '\n\n'

  if (resultado === 'ganaste') {
    texto += '🏆 » ¡GANASTE!\n💎 » +' + apuesta + ' diamantes\n'
  } else if (resultado === 'perdiste') {
    texto += '💀 » PERDISTE\n💎 » -' + apuesta + ' diamantes\n'
  } else {
    texto += '🤝 » EMPATE\n💎 » Recuperas tus ' + apuesta + ' 💎\n'
  }

  texto += '💰 » Total: ' + total + ' 💎'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('ppt_')) return false

    let parts = id.split('_')
    let jugada = parts[1]
    let apuesta = parseInt(parts[2])

    let who = m.sender
    let user = global.db.data.users[who]
    if (!user) {
      global.db.data.users[who] = { diamantes: 0, diamond: 0 }
      user = global.db.data.users[who]
    }

    let misDiamantes = user.diamantes || user.diamond || 0
    if (misDiamantes < apuesta) {
      await conn.sendMessage(m.chat, {
        text: '✊ 「 HINATA PPT 」 ✊\n\n💫 » No tienes tantos 💎\n💰 » Tienes: ' + misDiamantes
      }, { quoted: m })
      return true
    }

    let opciones = ['piedra', 'papel', 'tijera']
    let botJugada = opciones[Math.floor(Math.random() * opciones.length)]

    let resultado
    if (jugada === botJugada) {
      resultado = 'empate'
    } else if (
      (jugada === 'piedra' && botJugada === 'tijera') ||
      (jugada === 'papel' && botJugada === 'piedra') ||
      (jugada === 'tijera' && botJugada === 'papel')
    ) {
      resultado = 'ganaste'
    } else {
      resultado = 'perdiste'
    }

    let emojis = { piedra: '🪨', papel: '📄', tijera: '✂️' }

    if (resultado === 'ganaste') {
      if (user.diamantes !== undefined) {
        user.diamantes = misDiamantes + apuesta
      } else {
        user.diamond = misDiamantes + apuesta
      }
    } else if (resultado === 'perdiste') {
      if (user.diamantes !== undefined) {
        user.diamantes = misDiamantes - apuesta
      } else {
        user.diamond = misDiamantes - apuesta
      }
    }

    let total = user.diamantes || user.diamond || 0

    let texto = '✊ 「 HINATA PPT 」 ✊\n\n'
    texto += '👤 » Tú: ' + emojis[jugada] + '\n'
    texto += '🤖 » La bot: ' + emojis[botJugada] + '\n\n'

    if (resultado === 'ganaste') {
      texto += '🏆 » ¡GANASTE!\n💎 » +' + apuesta + ' diamantes\n'
    } else if (resultado === 'perdiste') {
      texto += '💀 » PERDISTE\n💎 » -' + apuesta + ' diamantes\n'
    } else {
      texto += '🤝 » EMPATE\n💎 » Recuperas tus ' + apuesta + ' 💎\n'
    }

    texto += '💰 » Total: ' + total + ' 💎'

    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
    return true

  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['ppt']
handler.tags = ['game']
handler.command = /^(ppt|piedrapapeltijera)$/i
handler.desc = 'Piedra, papel o tijera x2'

export default handler