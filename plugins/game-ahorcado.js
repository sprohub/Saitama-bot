import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let juegos = {}

let handler = async (m, { conn }) => {
  let who = m.sender

  if (juegos[who]) {
    await mostrarTablero(conn, m, who)
    return
  }

  let palabras = [
    'hinata', 'naruto', 'sakura', 'kakashi', 'sasuke', 'itachi', 'jiraiya', 'tsunade',
    'sharingan', 'byakugan', 'rasengan', 'chidori', 'akatsuki', 'konoha', 'hokage',
    'goku', 'vegeta', 'piccolo', 'gohan', 'freezer', 'cell', 'buu', 'broly',
    'luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky',
    'tanjiro', 'nezuko', 'zenitsu', 'inosuke', 'giyu', 'shinobu', 'rengoku',
    'gojo', 'yuji', 'megumi', 'nobara', 'sukuna', 'geto', 'toji'
  ]

  let palabra = palabras[Math.floor(Math.random() * palabras.length)]
  let oculta = '_ '.repeat(palabra.length).trim()

  juegos[who] = {
    palabra: palabra,
    oculta: oculta,
    intentos: 6,
    usadas: []
  }

  await mostrarTablero(conn, m, who)
}

async function mostrarTablero(conn, m, who) {
  let juego = juegos[who]
  if (!juego) return

  let muñecos = [
    '   ┌─────┐\n   │     \n   │     \n   │     \n   │     \n  ─┴─────',
    '   ┌─────┐\n   │     O\n   │     \n   │     \n   │     \n  ─┴─────',
    '   ┌─────┐\n   │     O\n   │     │\n   │     \n   │     \n  ─┴─────',
    '   ┌─────┐\n   │     O\n   │    ─│\n   │     \n   │     \n  ─┴─────',
    '   ┌─────┐\n   │     O\n   │    ─┼─\n   │     \n   │     \n  ─┴─────',
    '   ┌─────┐\n   │     O\n   │    ─┼─\n   │    ╱ \n   │     \n  ─┴─────',
    '   ┌─────┐\n   │     O\n   │    ─┼─\n   │    ╱╲\n   │     \n  ─┴─────'
  ]
  let idx = 6 - juego.intentos

  let todasLetras = 'abcdefghijklmnopqrstuvwxyz'.split('')
  let rows = todasLetras.map(l => ({
    header: juego.usadas.includes(l) ? '❌' : '✅',
    title: l.toUpperCase(),
    description: juego.usadas.includes(l) ? 'Ya usada' : 'Disponible',
    id: 'ah_' + l
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: '🎮 HINATA GAMES 🎮', subtitle: 'Ahorcado | 🏆 3 💎', hasMediaAttachment: false },
    body: { text: '🎮 「 HINATA AHORCADO 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🎯 » Vidas: ' + juego.intentos + '/6\n📝 » Palabra: ' + juego.oculta + '\n🔤 » Usadas: ' + (juego.usadas.length ? juego.usadas.join(', ') : 'Ninguna') + '\n\n' + muñecos[idx] + '\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> Toca una letra' },
    footer: { text: '⫏⫏ HINATA GAMES ✿' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🔤 ABECEDARIO',
          sections: [{ title: '📝 Todas las letras', rows }]
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('ah_')) return false

    let who = m.sender
    if (!juegos[who]) return false

    let juego = juegos[who]
    let letra = id.replace('ah_', '')

    if (juego.usadas.includes(letra)) {
      await conn.sendMessage(m.chat, { text: '⚠️ Ya usaste ' + letra.toUpperCase() + '. Prueba otra.' }, { quoted: m })
      await mostrarTablero(conn, m, who)
      return true
    }

    juego.usadas.push(letra)

    if (juego.palabra.includes(letra)) {
      let oculta = ''
      for (let l of juego.palabra) {
        oculta += juego.usadas.includes(l) ? l + ' ' : '_ '
      }
      juego.oculta = oculta.trim()

      if (!juego.oculta.includes('_')) {
        let user = global.db.data.users[who]
        if (!user) global.db.data.users[who] = { diamantes: 0 }
        user = global.db.data.users[who]
        user.diamantes = (user.diamantes || 0) + 3
        delete juegos[who]
        await conn.sendMessage(m.chat, { text: '🎮 「 HINATA AHORCADO 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n🏆 » ¡GANASTE!\n📝 » Palabra: ' + juego.palabra.toUpperCase() + '\n💎 » +3 diamantes\n💰 » Total: ' + user.diamantes + ' 💎\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
        return true
      }

      await mostrarTablero(conn, m, who)
      return true
    } else {
      juego.intentos--

      if (juego.intentos <= 0) {
        delete juegos[who]
        await conn.sendMessage(m.chat, { text: '🎮 「 HINATA AHORCADO 」 🎮\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n💀 » PERDISTE\n📝 » Era: ' + juego.palabra.toUpperCase() + '\n😵 » Fuiste ahorcado\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
        return true
      }

      await mostrarTablero(conn, m, who)
      return true
    }
  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['ahorcado']
handler.tags = ['game']
handler.command = /^(ahorcado|ahorcado)$/i
handler.desc = 'Juego de ahorcado | 🏆 3 💎'

export default handler