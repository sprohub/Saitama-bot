import net from 'net'
import { createCanvas } from '@napi-rs/canvas'

const IP_DEFAULT = '51.89.43.221'
const PUERTO_DEFAULT = 25781
const TIMEOUT_MS = 5000

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

// 🔌 Intenta abrir una conexión TCP al puerto del servidor.
// Es lo único que se puede verificar de forma confiable en un server de
// Terraria vanilla: si el puerto responde o no, y cuánto tarda en responder.
function verificarServidor(ip, puerto, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve) => {
    const inicio = Date.now()
    const socket = new net.Socket()
    let resuelto = false

    const finalizar = (online) => {
      if (resuelto) return
      resuelto = true
      const latencia = Date.now() - inicio
      socket.destroy()
      resolve({ online, latenciaMs: online ? latencia : null })
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finalizar(true))
    socket.once('timeout', () => finalizar(false))
    socket.once('error', () => finalizar(false))

    socket.connect(puerto, ip)
  })
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

/**
 * datos = { ip, puerto, online, latenciaMs, verificadoEn }
 */
function generarImagenServidor(datos) {
  const W = 850
  const H = 620
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const verde = '#4ade80'
  const rojo = '#ff4d4d'
  const colorEstado = datos.online ? verde : rojo

  const gradFondo = ctx.createLinearGradient(0, 0, W, H)
  gradFondo.addColorStop(0, '#060d16')
  gradFondo.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = gradFondo
  ctx.fillRect(0, 0, W, H)

  circuloDesenfocado(ctx, W - 90, 60, 200,
    datos.online ? 'rgba(74,222,128,ALPHA)' : 'rgba(255,77,77,ALPHA)', '0.14')
  circuloDesenfocado(ctx, 60, H - 70, 180, 'rgba(255,210,63,ALPHA)', '0.08')

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
  const badgeTexto = 'TERRARIA SERVER'
  const badgeAncho = ctx.measureText(badgeTexto).width + 42
  ctx.fillStyle = verde
  roundRect(ctx, marginX, 58, badgeAncho, 40, 20)
  ctx.fill()
  ctx.fillStyle = '#04170a'
  ctx.textAlign = 'left'
  ctx.fillText(badgeTexto, marginX + 21, 84)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('SAITAMA-BOT', W - marginX, 84)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText(`${datos.ip}`, marginX, 168)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '24px sans-serif'
  ctx.fillText(`Puerto ${datos.puerto}`, marginX, 202)

  // ── Indicador de estado grande ──
  const estadoY = 250
  const estadoH = 130

  ctx.fillStyle = datos.online ? 'rgba(74,222,128,0.12)' : 'rgba(255,77,77,0.12)'
  roundRect(ctx, marginX, estadoY, W - marginX * 2, estadoH, 24)
  ctx.fill()
  ctx.strokeStyle = colorEstado
  ctx.lineWidth = 2
  roundRect(ctx, marginX, estadoY, W - marginX * 2, estadoH, 24)
  ctx.stroke()

  // Punto de estado
  const puntoX = marginX + 44
  const puntoY = estadoY + estadoH / 2
  ctx.fillStyle = colorEstado
  ctx.beginPath()
  ctx.arc(puntoX, puntoY, 16, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = colorEstado
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(datos.online ? 'EN LINEA' : 'SIN CONEXION', puntoX + 40, puntoY + 14)

  // ── Latencia (solo si está online) ──
  const infoY = estadoY + estadoH + 40
  if (datos.online) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '20px sans-serif'
    ctx.fillText('LATENCIA', marginX, infoY)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 34px sans-serif'
    ctx.fillText(`${datos.latenciaMs} ms`, marginX, infoY + 42)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '20px sans-serif'
    ctx.fillText('El servidor no respondio a tiempo', marginX, infoY)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '16px sans-serif'
  ctx.fillText(`Verificado: ${datos.verificadoEn}`, marginX, H - 50)

  return canvas.toBuffer('image/png')
}

function parseIpPuerto(texto) {
  const m = String(texto || '').trim().match(/^([\d.]+|[\w.-]+):(\d+)$/)
  if (!m) return null
  return { ip: m[1], puerto: parseInt(m[2]) }
}

let handler = async (m, { conn, text }) => {
  let ip = IP_DEFAULT
  let puerto = PUERTO_DEFAULT

  const entrada = (text || '').trim()
  if (entrada) {
    const parsed = parseIpPuerto(entrada)
    if (!parsed) {
      return conn.sendMessage(m.chat, {
        text: decorar('Formato inválido\nUsa: .terraria <ip:puerto>\nEjemplo: .terraria 51.89.43.221:25781')
      }, { quoted: m })
    }
    ip = parsed.ip
    puerto = parsed.puerto
  }

  await conn.sendMessage(m.chat, { text: decorar('Verificando servidor...') }, { quoted: m })

  const resultado = await verificarServidor(ip, puerto)

  const datos = {
    ip,
    puerto,
    online: resultado.online,
    latenciaMs: resultado.latenciaMs,
    verificadoEn: new Date().toLocaleString('es-CO', { hour12: false })
  }

  const buffer = generarImagenServidor(datos)

  await conn.sendMessage(m.chat, {
    image: buffer,
    caption: decorar(
      resultado.online
        ? `Servidor en línea (${resultado.latenciaMs} ms)`
        : 'Servidor sin conexión'
    ) + '\n\nNota: al ser un servidor vanilla, no es posible mostrar jugadores conectados ni otros datos internos, solo si el puerto responde.'
  }, { quoted: m })
}

handler.help = ['terraria <ip:puerto>']
handler.tags = ['tools']
handler.command = /^(terraria|tserver|serverterraria)$/i
handler.desc = 'Verifica si un servidor de Terraria está en línea (vanilla, sin datos de jugadores)'

export default handler
