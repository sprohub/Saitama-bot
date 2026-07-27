import { createCanvas } from '@napi-rs/canvas'

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
]

const PUNTOS_POR_VICTORIA = 5

global.__ticTacToe = global.__ticTacToe || {}

function checkWinner(board) {
  for (let [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return { symbol: board[a], line: [a, b, c] }
  }
  return null
}

function checkDraw(board) {
  return board.every(c => c !== null)
}

function jugadaBot(board, botSymbol, humanSymbol) {
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      let copy = [...board]; copy[i] = botSymbol
      if (checkWinner(copy)?.symbol === botSymbol) return i
    }
  }
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      let copy = [...board]; copy[i] = humanSymbol
      if (checkWinner(copy)?.symbol === humanSymbol) return i
    }
  }
  if (board[4] === null) return 4
  let esquinas = [0, 2, 6, 8].filter(i => board[i] === null)
  if (esquinas.length) return esquinas[Math.floor(Math.random() * esquinas.length)]
  let libres = board.map((c, i) => c === null ? i : null).filter(i => i !== null)
  return libres[Math.floor(Math.random() * libres.length)]
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function circuloDesenfocado(ctx, x, y, r, color, alpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, color.replace('ALPHA', alpha))
  grad.addColorStop(1, color.replace('ALPHA', '0'))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function generarImagenTablero(datos) {
  const W = 900
  const H = 1100
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#ffd23f'
  const amarilloClaro = '#ffe98a'
  const rojo = '#ff4d4d'

  const gradFondo = ctx.createLinearGradient(0, 0, W, H)
  gradFondo.addColorStop(0, '#060d16')
  gradFondo.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = gradFondo
  ctx.fillRect(0, 0, W, H)

  circuloDesenfocado(ctx, W - 100, 60, 220, 'rgba(255,210,63,ALPHA)', '0.12')
  circuloDesenfocado(ctx, 60, H - 80, 220, 'rgba(255,77,77,ALPHA)', '0.10')

  const padding = 36
  ctx.save()
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 40)
  ctx.clip()
  ctx.fillStyle = 'rgba(8,14,22,0.45)'
  ctx.fillRect(padding, padding, W - padding * 2, H - padding * 2)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,210,63,0.15)'
  ctx.lineWidth = 2
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 40)
  ctx.stroke()

  const marginX = 70

  ctx.font = 'bold 22px sans-serif'
  const badgeTexto = '🎮 3 EN RAYA'
  const badgeAncho = ctx.measureText(badgeTexto).width + 46
  ctx.fillStyle = amarillo
  roundRect(ctx, marginX, 68, badgeAncho, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#1a1200'
  ctx.textAlign = 'left'
  ctx.fillText(badgeTexto, marginX + 23, 96)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '20px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('SAITAMA-BOT', W - marginX, 96)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 54px sans-serif'
  ctx.fillText('Tablero de Juego', marginX, 170)

  const cardY = 200
  const cardH = 90
  const cardW = (W - marginX * 2 - 30) / 2
  const card1X = marginX
  const card2X = marginX + cardW + 30

  const turnoEsX = datos.turno === 'X'
  const activo1 = !datos.ganador && !datos.empate && turnoEsX
  const activo2 = !datos.ganador && !datos.empate && !turnoEsX

  ctx.fillStyle = activo1 ? 'rgba(255,77,77,0.18)' : 'rgba(255,255,255,0.05)'
  roundRect(ctx, card1X, cardY, cardW, cardH, 20)
  ctx.fill()
  if (activo1) { ctx.strokeStyle = rojo; ctx.lineWidth = 2; roundRect(ctx, card1X, cardY, cardW, cardH, 20); ctx.stroke() }

  ctx.fillStyle = rojo
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('❌', card1X + 24, cardY + 40)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  let nombreX = datos.nombreX.length > 16 ? datos.nombreX.slice(0, 16) + '…' : datos.nombreX
  ctx.fillText(nombreX, card1X + 70, cardY + 38)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '16px sans-serif'
  ctx.fillText(activo1 ? 'Turno actual' : 'Esperando', card1X + 24, cardY + 68)

  ctx.fillStyle = activo2 ? 'rgba(255,210,63,0.18)' : 'rgba(255,255,255,0.05)'
  roundRect(ctx, card2X, cardY, cardW, cardH, 20)
  ctx.fill()
  if (activo2) { ctx.strokeStyle = amarillo; ctx.lineWidth = 2; roundRect(ctx, card2X, cardY, cardW, cardH, 20); ctx.stroke() }

  ctx.fillStyle = amarillo
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('⭕', card2X + 24, cardY + 40)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  let nombreO = datos.nombreO.length > 16 ? datos.nombreO.slice(0, 16) + '…' : datos.nombreO
  ctx.fillText(nombreO, card2X + 70, cardY + 38)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '16px sans-serif'
  ctx.fillText(activo2 ? 'Turno actual' : 'Esperando', card2X + 24, cardY + 68)

  const boardSize = 640
  const boardX = (W - boardSize) / 2
  const boardY = 330
  const cellGap = 16
  const cellSize = (boardSize - cellGap * 2) / 3

  const lineaGanadora = datos.ganador?.line || []

  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    const x = boardX + col * (cellSize + cellGap)
    const y = boardY + row * (cellSize + cellGap)
    const valor = datos.board[i]
    const esGanadora = lineaGanadora.includes(i)

    ctx.fillStyle = esGanadora ? 'rgba(255,210,63,0.22)' : 'rgba(255,255,255,0.06)'
    roundRect(ctx, x, y, cellSize, cellSize, 24)
    ctx.fill()

    if (esGanadora) {
      ctx.strokeStyle = amarillo
      ctx.lineWidth = 3
      roundRect(ctx, x, y, cellSize, cellSize, 24)
      ctx.stroke()
    }

    const cx = x + cellSize / 2
    const cy = y + cellSize / 2

    if (valor === 'X') {
      ctx.strokeStyle = rojo
      ctx.lineWidth = 16
      ctx.lineCap = 'round'
      const off = cellSize * 0.26
      ctx.beginPath()
      ctx.moveTo(cx - off, cy - off)
      ctx.lineTo(cx + off, cy + off)
      ctx.moveTo(cx + off, cy - off)
      ctx.lineTo(cx - off, cy + off)
      ctx.stroke()
    } else if (valor === 'O') {
      ctx.strokeStyle = amarillo
      ctx.lineWidth = 16
      ctx.beginPath()
      ctx.arc(cx, cy, cellSize * 0.28, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = 'bold 40px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), cx, cy)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
  }

  const footerY = boardY + boardSize + 40
  let footerTexto, footerColor

  if (datos.ganador) {
    footerColor = datos.ganador.symbol === 'X' ? rojo : amarillo
    footerTexto = `🏆 Ganó ${datos.ganador.symbol === 'X' ? nombreX : nombreO}`
  } else if (datos.empate) {
    footerColor = 'rgba(255,255,255,0.3)'
    footerTexto = '🤝 ¡Empate!'
  } else {
    footerColor = turnoEsX ? rojo : amarillo
    footerTexto = `🍃 Turno de ${turnoEsX ? nombreX : nombreO}`
  }

  ctx.font = 'bold 22px sans-serif'
  const footerAncho = ctx.measureText(footerTexto).width + 50
  ctx.fillStyle = footerColor
  roundRect(ctx, (W - footerAncho) / 2, footerY, footerAncho, 50, 25)
  ctx.fill()
  ctx.fillStyle = '#0a0a0a'
  ctx.textAlign = 'center'
  ctx.fillText(footerTexto, W / 2, footerY + 32)
  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

// 🏷️ Obtiene el nombre real del usuario (contacto/perfil de WhatsApp),
// usando conn.getName si tu bot lo tiene, con respaldo al número.
async function obtenerNombre(conn, jid, esBot) {
  if (esBot) return 'Bot 🤖'
  try {
    if (typeof conn.getName === 'function') {
      let nombre = await conn.getName(jid)
      if (nombre && nombre.trim()) return nombre.trim()
    }
  } catch {}
  return jid.split('@')[0]
}

function encontrarParticipante(participants, jid) {
  if (!jid) return null
  return participants.find(p => p.id === jid || p.phoneNumber === jid || p.jid === jid) || null
}

function esMismaPersona(participants, jidReferencia, jidRemitente) {
  if (jidReferencia === 'bot') return false
  if (jidReferencia === jidRemitente) return true

  const pRef = encontrarParticipante(participants, jidReferencia)
  const pSender = encontrarParticipante(participants, jidRemitente)

  if (pRef && pSender && pRef.id === pSender.id) return true
  if (pRef?.phoneNumber && pSender?.phoneNumber && pRef.phoneNumber === pSender.phoneNumber) return true
  if (pRef?.jid && pSender?.jid && pRef.jid === pSender.jid) return true

  return false
}

async function limpiarImagenes(conn, chat, game, dejarUltima) {
  if (!game.imageKeys?.length) return
  const keys = dejarUltima ? game.imageKeys.slice(0, -1) : game.imageKeys
  for (const key of keys) {
    try { await conn.sendMessage(chat, { delete: key }) } catch {}
  }
}

// 💎 Otorga puntos al ganador (si no es el bot) y guarda estadísticas
function otorgarPuntos(ganadorJid) {
  if (!ganadorJid || ganadorJid === 'bot') return
  if (!global.db.data.users[ganadorJid]) {
    global.db.data.users[ganadorJid] = { exp: 0, level: 0 }
  }
  let user = global.db.data.users[ganadorJid]
  user.tresRayaPuntos = (user.tresRayaPuntos || 0) + PUNTOS_POR_VICTORIA
  user.tresRayaVictorias = (user.tresRayaVictorias || 0) + 1
  global.markDatabaseModified()
}

async function enviarTablero(conn, m, game, chatId) {
  let resultado = checkWinner(game.board)
  let empate = !resultado && checkDraw(game.board)

  let nombreX = await obtenerNombre(conn, game.players.X, false)
  let nombreO = await obtenerNombre(conn, game.players.O, game.vsBot)

  let datos = {
    board: game.board,
    nombreX,
    nombreO,
    turno: game.turn,
    ganador: resultado,
    empate
  }

  let buffer = generarImagenTablero(datos)
  let mentions = [game.players.X, game.players.O].filter(j => j !== 'bot')

  let caption
  if (resultado) {
    let ganadorJid = resultado.symbol === 'X' ? game.players.X : game.players.O
    let ganadorNombre = resultado.symbol === 'X' ? nombreX : nombreO
    otorgarPuntos(ganadorJid)
    caption = `🏆 ¡Ganó ${ganadorNombre}! +${PUNTOS_POR_VICTORIA} puntos`
  } else if (empate) {
    caption = `🤝 ¡Empate! Nadie suma puntos`
  } else {
    caption = `🎮 3 en raya`
  }

  let enviado = await conn.sendMessage(m.chat, { image: buffer, caption, mentions }, { quoted: m })

  game.imageKeys = game.imageKeys || []
  if (enviado?.key) game.imageKeys.push(enviado.key)

  if (resultado || empate) {
    // Se borran todas las imágenes intermedias, dejando solo la del resultado final
    // (aplica igual tanto en modo vs usuario como vs bot)
    await limpiarImagenes(conn, m.chat, game, true)
    delete global.__ticTacToe[chatId]
    return true
  }
  return false
}

let handler = async (m, { conn, text }) => {
  let chatId = m.chat
  let game = global.__ticTacToe[chatId]
  let input = (text || '').trim().toLowerCase()

  let participants = []
  if (m.isGroup) {
    try {
      let meta = await conn.groupMetadata(m.chat)
      participants = meta?.participants || []
    } catch {}
  }

  if (!input) {
    if (game) return enviarTablero(conn, m, game, chatId)
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🎮 3 EN RAYA\n│\n` +
        `│ 🍃 .3raya @usuario — retar a alguien\n` +
        `│ 🍃 .3raya bot — jugar contra el bot\n` +
        `│ 🍃 .3raya <1-9> — hacer un movimiento\n` +
        `│ 🍃 .3raya rendirse — abandonar\n` +
        `│ 🍃 .top3raya — ver el ranking\n╰───────────────⬣`
    }, { quoted: m })
  }

  if (input === 'rendirse' || input === 'salir') {
    if (!game) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No hay partida activa en este chat\n╰───────────────⬣' }, { quoted: m })

    let esJugadorX = esMismaPersona(participants, game.players.X, m.sender)
    let esJugadorO = !game.vsBot && esMismaPersona(participants, game.players.O, m.sender)

    if (!esJugadorX && !esJugadorO) {
      return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No eres parte de esta partida\n╰───────────────⬣' }, { quoted: m })
    }

    let ganadorJid = esJugadorX ? game.players.O : game.players.X
    let ganadorNombre = await obtenerNombre(conn, ganadorJid, ganadorJid === 'bot')
    otorgarPuntos(ganadorJid)
    await limpiarImagenes(conn, m.chat, game, false)
    delete global.__ticTacToe[chatId]
    let mentions = [m.sender, ganadorJid].filter(j => j !== 'bot')
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🏳️ @${m.sender.split('@')[0]} se rindió\n│ 🏆 Ganador: ${ganadorNombre} (+${PUNTOS_POR_VICTORIA} puntos)\n╰───────────────⬣`,
      mentions
    }, { quoted: m })
  }

  let mentioned = m.mentionedJid && m.mentionedJid[0]
  if (mentioned || input === 'bot') {
    if (game) {
      return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Ya hay una partida activa en este chat\n│ 🍃 Usa .3raya rendirse para cancelarla\n╰───────────────⬣' }, { quoted: m })
    }

    let vsBot = input === 'bot'
    if (!vsBot && esMismaPersona(participants, mentioned, m.sender)) {
      return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No puedes retarte a ti mismo\n╰───────────────⬣' }, { quoted: m })
    }

    global.__ticTacToe[chatId] = {
      board: Array(9).fill(null),
      turn: 'X',
      players: { X: m.sender, O: vsBot ? 'bot' : mentioned },
      vsBot,
      imageKeys: [],
      createdAt: Date.now()
    }

    return enviarTablero(conn, m, global.__ticTacToe[chatId], chatId)
  }

  let pos = parseInt(input)
  if (isNaN(pos) || pos < 1 || pos > 9) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Comando inválido\n│ 🍃 Usa: .3raya <1-9>\n╰───────────────⬣' }, { quoted: m })
  }

  if (!game) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No hay partida activa\n│ 🍃 Usa .3raya @usuario o .3raya bot\n╰───────────────⬣' }, { quoted: m })
  }

  let esJugadorX = esMismaPersona(participants, game.players.X, m.sender)
  let esJugadorO = !game.vsBot && esMismaPersona(participants, game.players.O, m.sender)

  if (!esJugadorX && !esJugadorO) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No eres parte de esta partida\n╰───────────────⬣' }, { quoted: m })
  }

  let simboloJugador = esJugadorX ? 'X' : 'O'
  if (game.turn !== simboloJugador) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No es tu turno\n╰───────────────⬣' }, { quoted: m })
  }

  let idx = pos - 1
  if (game.board[idx] !== null) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Esa casilla ya está ocupada\n╰───────────────⬣' }, { quoted: m })
  }

  game.board[idx] = simboloJugador
  game.turn = game.turn === 'X' ? 'O' : 'X'

  let terminado = await enviarTablero(conn, m, game, chatId)
  if (terminado) return

  if (game.vsBot && game.turn === 'O') {
    let botIdx = jugadaBot(game.board, 'O', 'X')
    game.board[botIdx] = 'O'
    game.turn = 'X'
    await enviarTablero(conn, m, game, chatId)
  }
}

handler.help = ['3raya <1-9>']
handler.tags = ['game']
handler.command = /^(3raya|triqui|gato|tresenraya)$/i
handler.group = true
handler.desc = 'Juega 3 en raya contra otro usuario o contra el bot, con tablero visual'

export default handler