import { createCanvas } from '@napi-rs/canvas'

const OPCIONES = {
  piedra: { label: 'PIEDRA', vence: 'tijera' },
  papel: { label: 'PAPEL', vence: 'piedra' },
  tijera: { label: 'TIJERA', vence: 'papel' }
}
const ALIAS = {
  piedra: 'piedra', roca: 'piedra', 1: 'piedra',
  papel: 'papel', 2: 'papel',
  tijera: 'tijera', tijeras: 'tijera', 3: 'tijera'
}

global.__ppt = global.__ppt || {}

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

// ── Iconos dibujados a mano (sin emojis) ──

// Mezcla un color hex con blanco para generar un tono claro (para el brillo/gradiente)
function aclararColor(hex, cantidad) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const nr = Math.round(r + (255 - r) * cantidad)
  const ng = Math.round(g + (255 - g) * cantidad)
  const nb = Math.round(b + (255 - b) * cantidad)
  return `rgb(${nr},${ng},${nb})`
}

// 🪨 Roca: polígono irregular (no un círculo perfecto) con sombreado radial
function dibujarPiedra(ctx, cx, cy, r, color) {
  ctx.save()
  ctx.translate(cx, cy)

  const puntos = 10
  const variacion = [1, 0.86, 1.08, 0.92, 1.12, 0.88, 1.05, 0.95, 1.1, 0.9]
  ctx.beginPath()
  for (let i = 0; i < puntos; i++) {
    const angulo = (Math.PI * 2 * i) / puntos
    const radio = r * variacion[i]
    const x = Math.cos(angulo) * radio
    const y = Math.sin(angulo) * radio * 0.9 // achatada verticalmente, más "roca" que "pelota"
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()

  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.3)
  grad.addColorStop(0, aclararColor(color, 0.35))
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.fill()

  // un par de "grietas" sutiles para textura de piedra
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-r * 0.2, -r * 0.1)
  ctx.lineTo(r * 0.15, r * 0.25)
  ctx.moveTo(r * 0.1, -r * 0.35)
  ctx.lineTo(r * 0.3, -r * 0.05)
  ctx.stroke()

  ctx.restore()
}

// 📄 Papel: hoja rectangular con la esquina superior derecha doblada + líneas de "texto"
function dibujarPapel(ctx, cx, cy, size, color) {
  const w = size * 0.72
  const h = size
  const doblez = size * 0.2

  ctx.save()
  ctx.translate(cx - w / 2, cy - h / 2)

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(w - doblez, 0)
  ctx.lineTo(w, doblez)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // sombra del doblez de la esquina
  ctx.beginPath()
  ctx.moveTo(w - doblez, 0)
  ctx.lineTo(w, doblez)
  ctx.lineTo(w - doblez, doblez)
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fill()

  // líneas simulando texto
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = size * 0.03
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const y = h * 0.42 + i * (h * 0.12)
    const anchoLinea = i === 3 ? w * 0.5 : w * 0.7
    ctx.beginPath()
    ctx.moveTo(w * 0.14, y)
    ctx.lineTo(w * 0.14 + anchoLinea, y)
    ctx.stroke()
  }

  ctx.restore()
}

// ✂️ Tijera: dos aros (mangos) + dos hojas cruzadas hacia una punta, forma reconocible
function dibujarTijera(ctx, cx, cy, size, color) {
  ctx.save()
  ctx.translate(cx, cy)

  const anilloR = size * 0.16
  const anilloGrosor = size * 0.075
  const separacionAnillos = size * 0.24
  const anilloY = size * 0.32
  const puntaY = -size * 0.48

  ctx.strokeStyle = color
  ctx.lineWidth = anilloGrosor
  ctx.lineCap = 'round'

  // Aros (mangos)
  ctx.beginPath()
  ctx.arc(-separacionAnillos, anilloY, anilloR, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(separacionAnillos, anilloY, anilloR, 0, Math.PI * 2)
  ctx.stroke()

  // Hojas: cada una va desde su aro hasta cruzar y terminar en punta del lado opuesto
  ctx.fillStyle = color
  function hoja(origenX) {
    ctx.beginPath()
    ctx.moveTo(origenX, anilloY - anilloR * 0.3)
    ctx.lineTo(origenX * 0.15, size * 0.02)
    ctx.lineTo(-origenX * 0.06, puntaY)
    ctx.lineTo(origenX * 0.08, size * 0.02)
    ctx.closePath()
    ctx.fill()
  }
  hoja(-separacionAnillos)
  hoja(separacionAnillos)

  // Pivote central
  ctx.fillStyle = aclararColor(color, 0.4)
  ctx.beginPath()
  ctx.arc(0, size * 0.02, size * 0.045, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function dibujarInterrogacion(ctx, cx, cy, color) {
  ctx.fillStyle = color
  ctx.font = 'bold 140px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('?', cx, cy + 45)
  ctx.textAlign = 'left'
}
function dibujarIcono(ctx, opcion, cx, cy, color) {
  if (opcion === 'piedra') dibujarPiedra(ctx, cx, cy, 78, color)
  else if (opcion === 'papel') dibujarPapel(ctx, cx, cy, 150, color)
  else if (opcion === 'tijera') dibujarTijera(ctx, cx, cy, 130, color)
  else dibujarInterrogacion(ctx, cx, cy, color)
}

/**
 * datos = { nombreX, nombreO, eleccionX, eleccionO, ganador: 'X'|'O'|'empate'|null, revelado }
 */
function generarImagenPPT(datos) {
  const W = 900
  const H = 750
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#ffd23f'
  const amarilloClaro = '#ffe98a'
  const rojo = '#ff4d4d'
  const blancoSuave = 'rgba(255,255,255,0.85)'

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

  // Badge (sin emoji)
  ctx.font = 'bold 22px sans-serif'
  const badgeTexto = 'PIEDRA · PAPEL · TIJERA'
  const badgeAncho = ctx.measureText(badgeTexto).width + 46
  ctx.fillStyle = amarillo
  roundRect(ctx, marginX, 68, badgeAncho, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#1a1200'
  ctx.textAlign = 'left'
  ctx.fillText(badgeTexto, marginX + 23, 96)

  ctx.fillStyle = blancoSuave
  ctx.font = '20px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('SAITAMA-BOT', W - marginX, 96)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 50px sans-serif'
  ctx.fillText('Que empiece el duelo', marginX, 168)

  const boxY = 220
  const boxH = 340
  const boxW = (W - marginX * 2 - 40) / 2
  const box1X = marginX
  const box2X = marginX + boxW + 40

  const hayGanador = !!datos.ganador && datos.ganador !== 'empate'
  const ganoX = hayGanador && datos.ganador === 'X'
  const ganoO = hayGanador && datos.ganador === 'O'

  function dibujarCaja(x, nombre, eleccion, esGanador) {
    ctx.fillStyle = esGanador ? 'rgba(255,210,63,0.14)' : 'rgba(255,255,255,0.05)'
    roundRect(ctx, x, boxY, boxW, boxH, 26)
    ctx.fill()
    if (esGanador) {
      ctx.strokeStyle = amarillo
      ctx.lineWidth = 3
      roundRect(ctx, x, boxY, boxW, boxH, 26)
      ctx.stroke()
    }

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    let nombreCorto = nombre.length > 16 ? nombre.slice(0, 16) + '...' : nombre
    ctx.fillText(nombreCorto, x + boxW / 2, boxY + 46)

    const cx = x + boxW / 2
    const cy = boxY + boxH / 2 + 20
    const mostrarEleccion = datos.revelado && eleccion
    dibujarIcono(ctx, mostrarEleccion ? eleccion : null, cx, cy, esGanador ? amarillo : '#e8e8e8')

    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    let estado = datos.revelado
      ? (esGanador ? 'GANADOR' : (datos.ganador === 'empate' ? 'EMPATE' : 'PERDIO'))
      : (eleccion ? 'YA ELIGIO' : 'ESPERANDO...')
    ctx.fillText(estado, x + boxW / 2, boxY + boxH - 24)

    ctx.textAlign = 'left'
  }

  dibujarCaja(box1X, datos.nombreX, datos.eleccionX, ganoX)
  dibujarCaja(box2X, datos.nombreO, datos.eleccionO, ganoO)

  ctx.fillStyle = rojo
  ctx.font = 'bold 30px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('VS', W / 2, boxY + boxH / 2 + 12)
  ctx.textAlign = 'left'

  const footerY = boxY + boxH + 40
  let footerTexto, footerColor

  if (datos.ganador === 'empate') {
    footerColor = 'rgba(255,255,255,0.3)'
    footerTexto = 'EMPATE - Nadie gana esta ronda'
  } else if (datos.ganador === 'X' || datos.ganador === 'O') {
    let nombreGanador = datos.ganador === 'X' ? datos.nombreX : datos.nombreO
    let eleccionGanadora = datos.ganador === 'X' ? datos.eleccionX : datos.eleccionO
    footerColor = amarillo
    footerTexto = `GANO ${nombreGanador.replace('@', '').toUpperCase()} CON ${OPCIONES[eleccionGanadora]?.label}`
  } else {
    footerColor = amarillo
    footerTexto = 'ESPERANDO QUE AMBOS ELIJAN...'
  }

  ctx.font = 'bold 20px sans-serif'
  const footerAncho = Math.min(ctx.measureText(footerTexto).width + 50, W - marginX * 2)
  ctx.fillStyle = footerColor
  roundRect(ctx, (W - footerAncho) / 2, footerY, footerAncho, 50, 25)
  ctx.fill()
  ctx.fillStyle = '#0a0a0a'
  ctx.textAlign = 'center'
  ctx.fillText(footerTexto, W / 2, footerY + 32, footerAncho - 20)
  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

function nombreDe(jid, esBot) {
  if (esBot) return 'Bot'
  return '@' + jid.split('@')[0]
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

function determinarGanador(eleccionX, eleccionO) {
  if (eleccionX === eleccionO) return 'empate'
  if (OPCIONES[eleccionX].vence === eleccionO) return 'X'
  return 'O'
}

async function limpiarImagenes(conn, chat, game, dejarUltima) {
  if (!game.imageKeys?.length) return
  const keys = dejarUltima ? game.imageKeys.slice(0, -1) : game.imageKeys
  for (const key of keys) {
    try { await conn.sendMessage(chat, { delete: key }) } catch {}
  }
}

async function enviarEstado(conn, m, game, chatId) {
  let ganador = null
  let revelado = false

  if (game.eleccionX && game.eleccionO) {
    ganador = determinarGanador(game.eleccionX, game.eleccionO)
    revelado = true
  }

  let datos = {
    nombreX: nombreDe(game.players.X, false),
    nombreO: nombreDe(game.players.O, game.vsBot),
    eleccionX: game.eleccionX,
    eleccionO: game.eleccionO,
    ganador,
    revelado
  }

  let buffer = generarImagenPPT(datos)
  let mentions = [game.players.X, game.players.O].filter(j => j !== 'bot')

  let caption = revelado
    ? (ganador === 'empate' ? 'Empate' : `Gano ${ganador === 'X' ? datos.nombreX : datos.nombreO}`)
    : 'Piedra, papel o tijera'

  let enviado = await conn.sendMessage(m.chat, { image: buffer, caption, mentions }, { quoted: m })

  game.imageKeys = game.imageKeys || []
  if (enviado?.key) game.imageKeys.push(enviado.key)

  if (revelado) {
    if (ganador !== 'empate') {
      let ganadorJid = ganador === 'X' ? game.players.X : game.players.O
      if (ganadorJid !== 'bot') {
        if (!global.db.data.users[ganadorJid]) global.db.data.users[ganadorJid] = { exp: 0, level: 0 }
        let user = global.db.data.users[ganadorJid]
        user.pptPuntos = (user.pptPuntos || 0) + 5
        user.pptVictorias = (user.pptVictorias || 0) + 1
        global.markDatabaseModified()
      }
    }
    await limpiarImagenes(conn, m.chat, game, true)
    delete global.__ppt[chatId]
    return true
  }
  return false
}

let handler = async (m, { conn, text }) => {
  let chatId = m.chat
  let game = global.__ppt[chatId]
  let input = (text || '').trim().toLowerCase()

  let participants = []
  if (m.isGroup) {
    try {
      let meta = await conn.groupMetadata(m.chat)
      participants = meta?.participants || []
    } catch {}
  }

  if (!input) {
    if (game) return enviarEstado(conn, m, game, chatId)
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 PIEDRA, PAPEL O TIJERA\n│\n` +
        `│ 🍃 .ppt @usuario — retar a alguien\n` +
        `│ 🍃 .ppt bot — jugar contra el bot\n` +
        `│ 🍃 .ppt piedra / papel / tijera — elegir\n` +
        `│ 🍃 .ppt rendirse — abandonar\n╰───────────────⬣`
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
    if (ganadorJid !== 'bot') {
      if (!global.db.data.users[ganadorJid]) global.db.data.users[ganadorJid] = { exp: 0, level: 0 }
      global.db.data.users[ganadorJid].pptPuntos = (global.db.data.users[ganadorJid].pptPuntos || 0) + 5
      global.markDatabaseModified()
    }
    await limpiarImagenes(conn, m.chat, game, false)
    delete global.__ppt[chatId]
    let mentions = [m.sender, ganadorJid].filter(j => j !== 'bot')
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🏳️ @${m.sender.split('@')[0]} se rindió\n│ 🍃 Ganador: ${ganadorJid === 'bot' ? 'Bot' : '@' + ganadorJid.split('@')[0]} (+5 puntos)\n╰───────────────⬣`,
      mentions
    }, { quoted: m })
  }

  let mentioned = m.mentionedJid && m.mentionedJid[0]
  if (mentioned || input === 'bot') {
    if (game) {
      return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Ya hay una partida activa en este chat\n│ 🍃 Usa .ppt rendirse para cancelarla\n╰───────────────⬣' }, { quoted: m })
    }

    let vsBot = input === 'bot'
    if (!vsBot && esMismaPersona(participants, mentioned, m.sender)) {
      return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No puedes retarte a ti mismo\n╰───────────────⬣' }, { quoted: m })
    }

    global.__ppt[chatId] = {
      players: { X: m.sender, O: vsBot ? 'bot' : mentioned },
      eleccionX: null,
      eleccionO: null,
      vsBot,
      imageKeys: [],
      createdAt: Date.now()
    }

    return enviarEstado(conn, m, global.__ppt[chatId], chatId)
  }

  let eleccion = ALIAS[input]
  if (!eleccion) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Opción inválida\n│ 🍃 Usa: piedra, papel o tijera\n╰───────────────⬣' }, { quoted: m })
  }

  if (!game) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No hay partida activa\n│ 🍃 Usa .ppt @usuario o .ppt bot\n╰───────────────⬣' }, { quoted: m })
  }

  let esJugadorX = esMismaPersona(participants, game.players.X, m.sender)
  let esJugadorO = !game.vsBot && esMismaPersona(participants, game.players.O, m.sender)

  if (!esJugadorX && !esJugadorO) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No eres parte de esta partida\n╰───────────────⬣' }, { quoted: m })
  }

  if (esJugadorX) {
    if (game.eleccionX) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Ya elegiste, espera a tu rival\n╰───────────────⬣' }, { quoted: m })
    game.eleccionX = eleccion
  } else {
    if (game.eleccionO) return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Ya elegiste, espera a tu rival\n╰───────────────⬣' }, { quoted: m })
    game.eleccionO = eleccion
  }

  if (game.vsBot && game.eleccionX && !game.eleccionO) {
    const opciones = ['piedra', 'papel', 'tijera']
    game.eleccionO = opciones[Math.floor(Math.random() * 3)]
  }

  await enviarEstado(conn, m, game, chatId)
}

handler.help = ['ppt <piedra/papel/tijera>']
handler.tags = ['game']
handler.command = /^(ppt|piedrapapeltijera|piedrapapelotijera|jkp|rps)$/i
handler.desc = 'Juega piedra, papel o tijera contra otro usuario o contra el bot'

export default handler
