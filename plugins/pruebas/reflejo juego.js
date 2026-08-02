import { createCanvas } from '@napi-rs/canvas'

global.__reaccion = global.__reaccion || {}

const TIEMPO_LOBBY_MS = 15000
const DELAY_MIN_MS = 3000
const DELAY_MAX_MS = 8000
const PUNTOS_POR_VICTORIA = 5

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
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

// Cronómetro dibujado a mano (sin emoji): círculo + botón arriba + manecilla
function dibujarCronometro(ctx, cx, cy, r, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = r * 0.09
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx - r * 0.18, cy - r * 1.18)
  ctx.lineTo(cx + r * 0.18, cy - r * 1.18)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + r * 0.5, cy - r * 0.5)
  ctx.stroke()

  ctx.restore()
}

function evaluarVelocidad(ms) {
  if (ms < 200) return { label: 'REFLEJOS DE RAYO', color: '#4ade80' }
  if (ms < 350) return { label: 'MUY RAPIDO', color: '#a3e635' }
  if (ms < 600) return { label: 'BUENO', color: '#ffd23f' }
  if (ms < 900) return { label: 'NORMAL', color: '#ff9a3f' }
  return { label: 'LENTO', color: '#ff4d4d' }
}

/**
 * datos = { nombre, tiempoMs }
 */
function generarImagenResultado(datos) {
  const W = 850
  const H = 650
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#ffd23f'
  const verde = '#4ade80'

  const gradFondo = ctx.createLinearGradient(0, 0, W, H)
  gradFondo.addColorStop(0, '#060d16')
  gradFondo.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = gradFondo
  ctx.fillRect(0, 0, W, H)

  circuloDesenfocado(ctx, W - 90, 60, 200, 'rgba(74,222,128,ALPHA)', '0.12')
  circuloDesenfocado(ctx, 60, H - 70, 200, 'rgba(255,210,63,ALPHA)', '0.10')

  const padding = 32
  ctx.save()
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 36)
  ctx.clip()
  ctx.fillStyle = 'rgba(8,14,22,0.45)'
  ctx.fillRect(padding, padding, W - padding * 2, H - padding * 2)
  ctx.restore()

  ctx.strokeStyle = 'rgba(74,222,128,0.2)'
  ctx.lineWidth = 2
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 36)
  ctx.stroke()

  const marginX = 64

  ctx.font = 'bold 20px sans-serif'
  const badgeTexto = 'CARRERA DE REACCION'
  const badgeAncho = ctx.measureText(badgeTexto).width + 42
  ctx.fillStyle = verde
  roundRect(ctx, marginX, 60, badgeAncho, 40, 20)
  ctx.fill()
  ctx.fillStyle = '#04170a'
  ctx.textAlign = 'left'
  ctx.fillText(badgeTexto, marginX + 21, 86)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('SAITAMA-BOT', W - marginX, 86)

  dibujarCronometro(ctx, W - marginX - 60, 200, 46, amarillo)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText('Ganador', marginX, 200)

  let nombreCorto = datos.nombre.length > 18 ? datos.nombre.slice(0, 18) + '...' : datos.nombre
  ctx.fillStyle = amarillo
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText(nombreCorto, marginX, 242)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 90px sans-serif'
  ctx.fillText(`${datos.tiempoMs}`, marginX, 350)
  ctx.font = 'bold 30px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('milisegundos', marginX, 385)

  const barY = 440
  const barX = marginX
  const barW = W - marginX * 2
  const barH = 26

  const gradBarra = ctx.createLinearGradient(barX, 0, barX + barW, 0)
  gradBarra.addColorStop(0, '#4ade80')
  gradBarra.addColorStop(0.4, '#a3e635')
  gradBarra.addColorStop(0.65, '#ffd23f')
  gradBarra.addColorStop(0.85, '#ff9a3f')
  gradBarra.addColorStop(1, '#ff4d4d')

  roundRect(ctx, barX, barY, barW, barH, barH / 2)
  ctx.fillStyle = gradBarra
  ctx.fill()

  const clamped = Math.min(1200, Math.max(150, datos.tiempoMs))
  const posX = barX + ((clamped - 150) / (1200 - 150)) * barW

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(posX, barY - 14)
  ctx.lineTo(posX - 12, barY - 34)
  ctx.lineTo(posX + 12, barY - 34)
  ctx.closePath()
  ctx.fill()

  ctx.font = '16px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillText('Rapido', barX, barY + barH + 26)
  ctx.textAlign = 'right'
  ctx.fillText('Lento', barX + barW, barY + barH + 26)
  ctx.textAlign = 'left'

  const evaluacion = evaluarVelocidad(datos.tiempoMs)
  ctx.font = 'bold 26px sans-serif'
  const evalAncho = ctx.measureText(evaluacion.label).width + 44
  ctx.fillStyle = evaluacion.color
  roundRect(ctx, (W - evalAncho) / 2, barY + 60, evalAncho, 50, 25)
  ctx.fill()
  ctx.fillStyle = '#0a0a0a'
  ctx.textAlign = 'center'
  ctx.fillText(evaluacion.label, W / 2, barY + 93)
  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

function limpiarJuego(chatId) {
  const game = global.__reaccion[chatId]
  if (game) {
    clearTimeout(game.timeoutLobby)
    clearTimeout(game.timeoutSenal)
  }
  delete global.__reaccion[chatId]
}

function otorgarPuntos(jid) {
  if (!global.db.data.users[jid]) global.db.data.users[jid] = { exp: 0, level: 0 }
  const user = global.db.data.users[jid]
  user.reaccionPuntos = (user.reaccionPuntos || 0) + PUNTOS_POR_VICTORIA
  user.reaccionVictorias = (user.reaccionVictorias || 0) + 1
  global.markDatabaseModified()
}

async function iniciarSenal(conn, chatId) {
  const game = global.__reaccion[chatId]
  if (!game) return

  game.estado = 'esperando_senal'

  const delay = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)

  game.timeoutSenal = setTimeout(async () => {
    const g = global.__reaccion[chatId]
    if (!g) return
    g.estado = 'activa'
    g.horaSenal = Date.now()

    await conn.sendMessage(chatId, {
      text: decorar('¡YA!\nEscribe .reaccion ya lo más rápido que puedas')
    })
  }, delay)
}

let handler = async (m, { conn, text }) => {
  const chatId = m.chat
  const input = (text || '').trim().toLowerCase()
  let game = global.__reaccion[chatId]

  if (!input) {
    if (game) {
      return conn.sendMessage(m.chat, {
        text: decorar(`Ya hay una carrera en curso (${game.estado})\nJugadores: ${game.jugadores.length}`)
      }, { quoted: m })
    }

    global.__reaccion[chatId] = {
      estado: 'lobby',
      jugadores: [m.sender],
      descalificados: [],
      horaSenal: null,
      timeoutLobby: null,
      timeoutSenal: null,
      creadoPor: m.sender
    }
    game = global.__reaccion[chatId]

    game.timeoutLobby = setTimeout(() => {
      const g = global.__reaccion[chatId]
      if (!g || g.estado !== 'lobby') return
      conn.sendMessage(chatId, {
        text: decorar(`Lobby cerrado, ${g.jugadores.length} jugador(es) listos\nPreparando la señal...`)
      })
      iniciarSenal(conn, chatId)
    }, TIEMPO_LOBBY_MS)

    return conn.sendMessage(m.chat, {
      text: decorar(
        'Carrera de reacción iniciada\n\n' +
        `Tienes ${TIEMPO_LOBBY_MS / 1000} segundos para unirte\n` +
        'Escribe .reaccion unirse\n\n' +
        'Cuando aparezca "¡YA!" escribe .reaccion ya lo más rápido posible\n' +
        'Si escribes antes de tiempo, quedas descalificado'
      ),
      mentions: [m.sender]
    }, { quoted: m })
  }

  if (input === 'cancelar') {
    if (!game) return conn.sendMessage(m.chat, { text: decorar('No hay ninguna carrera activa') }, { quoted: m })
    limpiarJuego(chatId)
    return conn.sendMessage(m.chat, { text: decorar('Carrera cancelada') }, { quoted: m })
  }

  if (input === 'unirse') {
    if (!game) return conn.sendMessage(m.chat, { text: decorar('No hay ninguna carrera abierta\nUsa .reaccion para empezar una') }, { quoted: m })
    if (game.estado !== 'lobby') return conn.sendMessage(m.chat, { text: decorar('La carrera ya empezó, espera a la próxima') }, { quoted: m })
    if (game.jugadores.includes(m.sender)) return conn.sendMessage(m.chat, { text: decorar('Ya estás en esta carrera') }, { quoted: m })

    game.jugadores.push(m.sender)
    return conn.sendMessage(m.chat, {
      text: decorar(`@${m.sender.split('@')[0]} se unió a la carrera\nJugadores: ${game.jugadores.length}`),
      mentions: [m.sender]
    }, { quoted: m })
  }

  if (input === 'ya') {
    if (!game) return // sin partida, ignorar en silencio para no ensuciar el chat

    if (!game.jugadores.includes(m.sender)) return // no es jugador, ignorar

    if (game.estado === 'lobby' || game.estado === 'esperando_senal') {
      // Salida en falso
      if (game.descalificados.includes(m.sender)) return
      game.descalificados.push(m.sender)
      game.jugadores = game.jugadores.filter(j => j !== m.sender)
      await conn.sendMessage(m.chat, {
        text: decorar(`@${m.sender.split('@')[0]} salió antes de tiempo\nDescalificado`),
        mentions: [m.sender]
      }, { quoted: m })

      if (game.jugadores.length === 0) {
        limpiarJuego(chatId)
        await conn.sendMessage(m.chat, { text: decorar('Todos se descalificaron, carrera cancelada') })
      }
      return
    }

    if (game.estado === 'activa') {
      const tiempoMs = Date.now() - game.horaSenal
      limpiarJuego(chatId)
      otorgarPuntos(m.sender)

      const nombre = '@' + m.sender.split('@')[0]
      const buffer = generarImagenResultado({ nombre, tiempoMs })

      return conn.sendMessage(m.chat, {
        image: buffer,
        caption: decorar(`¡Ganó ${nombre}! (+${PUNTOS_POR_VICTORIA} puntos)`),
        mentions: [m.sender]
      }, { quoted: m })
    }

    if (game.estado === 'terminada') return
  }
}

handler.help = ['reaccion']
handler.tags = ['game']
handler.command = /^(reaccion|carrera|reflejos)$/i
handler.desc = 'Carrera de reacción: el bot manda YA en un momento random y gana quien escriba primero'

export default handler
