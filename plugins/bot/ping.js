import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import speed from 'performance-now'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templatePath = path.join(__dirname, '..', 'lib', 'ping-template.jpg')

function formatearTiempo(segundos) {
  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor((segundos % 86400) / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const segs = Math.floor(segundos % 60)
  const partes = []
  if (dias) partes.push(`${dias}d`)
  if (horas) partes.push(`${horas}h`)
  if (minutos) partes.push(`${minutos}m`)
  partes.push(`${segs}s`)
  return partes.join(' ')
}

function formatearMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
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

// Círculo decorativo difuminado (estética "blob" como en la referencia)
function circuloDesenfocado(ctx, x, y, r, color, alpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, color.replace('ALPHA', alpha))
  grad.addColorStop(1, color.replace('ALPHA', '0'))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function barraProgreso(ctx, x, y, w, h, porcentaje, colorInicio, colorFin) {
  // Fondo de la barra
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, x, y, w, h, h / 2)
  ctx.fill()

  // Relleno
  const anchoRelleno = Math.max(h, w * Math.min(1, Math.max(0, porcentaje)))
  const grad = ctx.createLinearGradient(x, 0, x + anchoRelleno, 0)
  grad.addColorStop(0, colorInicio)
  grad.addColorStop(1, colorFin)
  ctx.fillStyle = grad
  roundRect(ctx, x, y, anchoRelleno, h, h / 2)
  ctx.fill()
}

/**
 * Genera la imagen del reporte de ping, estilo "Saitama Power Report".
 */
async function generarImagenPing(datos) {
  const W = 1200
  const H = 700
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Paleta estilo Saitama: fondo azul/negro oscuro + acentos amarillo/rojo
  const amarillo = '#ffd23f'
  const amarilloClaro = '#ffe98a'
  const rojo = '#ff4d4d'
  const azulOscuro = '#0a1622'

  // ── Fondo con degradado y "blobs" difuminados ──
  const gradFondo = ctx.createLinearGradient(0, 0, W, H)
  gradFondo.addColorStop(0, '#060d16')
  gradFondo.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = gradFondo
  ctx.fillRect(0, 0, W, H)

  circuloDesenfocado(ctx, W - 120, 60, 260, 'rgba(255,210,63,ALPHA)', '0.12')
  circuloDesenfocado(ctx, W - 60, H - 40, 220, 'rgba(255,77,77,ALPHA)', '0.10')
  circuloDesenfocado(ctx, 40, H - 60, 180, 'rgba(255,210,63,ALPHA)', '0.06')

  // ── Tarjeta contenedora con borde redondeado (efecto "vidrio") ──
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

  // ── Badge "SAITAMA POWER" ──
  ctx.font = 'bold 22px sans-serif'
  const badgeTexto = '⚡ SAITAMA POWER'
  const badgeAncho = ctx.measureText(badgeTexto).width + 46
  ctx.fillStyle = amarillo
  roundRect(ctx, marginX, 68, badgeAncho, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#1a1200'
  ctx.textAlign = 'left'
  ctx.fillText(badgeTexto, marginX + 23, 96)

  // "Powered by" arriba a la derecha
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '20px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Un golpe, un diagnóstico', W - marginX, 96)

  // ── Título ──
  ctx.textAlign = 'left'
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText('SAITAMA-BOT', marginX, 158)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 58px sans-serif'
  ctx.fillText('Reporte de Ping', marginX, 220)

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '24px sans-serif'
  ctx.fillText(
    `Latencia ${datos.calidad} · ${datos.nucleos} núcleos · Uptime ${datos.uptimeProceso}`,
    marginX,
    258
  )

  // ── Dos tarjetas grandes: LATENCIA / RAM ──
  const cardY = 300
  const cardH = 150
  const cardW = (W - marginX * 2 - 30) / 2
  const card1X = marginX
  const card2X = marginX + cardW + 30

  // Card Latencia
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRect(ctx, card1X, cardY, cardW, cardH, 22)
  ctx.fill()
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('LATENCIA', card1X + 34, cardY + 42)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(`${datos.latenciaMs} ms`, card1X + 34, cardY + 96)
  const porcLatencia = Math.max(0.08, 1 - Math.min(datos.latenciaMsNum, 500) / 500)
  barraProgreso(ctx, card1X + 34, cardY + 116, cardW - 68, 12, porcLatencia, '#ffd23f', '#ff9a3f')
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.fillText('Tiempo de respuesta', card1X + 34, cardY + cardH - 16)

  // Card RAM
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRect(ctx, card2X, cardY, cardW, cardH, 22)
  ctx.fill()
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('RAM EN USO', card2X + 34, cardY + 42)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(datos.usoRAM, card2X + 34, cardY + 96)
  barraProgreso(ctx, card2X + 34, cardY + 116, cardW - 68, 12, datos.porcentajeRAM, '#ff4d4d', '#ffd23f')
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.fillText(`Libre: ${datos.ramLibre} / ${datos.ramTotal}`, card2X + 34, cardY + cardH - 16)

  // ── Fila inferior: 3 tarjetas pequeñas ──
  const fila2Y = cardY + cardH + 30
  const fila2H = 150
  const gap = 30
  const card3W = (W - marginX * 2 - gap * 2) / 3

  const tarjetas = [
    {
      titulo: 'CPU',
      valor: `${datos.cargaCpu}`,
      sub: `${datos.nucleos} núcleos activos`
    },
    {
      titulo: 'UPTIME SISTEMA',
      valor: datos.uptimeSistema,
      sub: `Bot activo: ${datos.uptimeProceso}`
    },
    {
      titulo: 'PLATAFORMA',
      valor: datos.nodeVersion,
      sub: datos.plataforma
    }
  ]

  tarjetas.forEach((t, i) => {
    const x = marginX + i * (card3W + gap)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, x, fila2Y, card3W, fila2H, 22)
    ctx.fill()

    ctx.fillStyle = amarilloClaro
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(t.titulo, x + 28, fila2Y + 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px sans-serif'
    // Recorta el texto si es muy largo para no desbordar la tarjeta
    let valorTxt = t.valor
    while (ctx.measureText(valorTxt).width > card3W - 56 && valorTxt.length > 3) {
      valorTxt = valorTxt.slice(0, -2)
    }
    if (valorTxt !== t.valor) valorTxt += '…'
    ctx.fillText(valorTxt, x + 28, fila2Y + 86)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '17px sans-serif'
    let subTxt = t.sub
    while (ctx.measureText(subTxt).width > card3W - 56 && subTxt.length > 3) {
      subTxt = subTxt.slice(0, -2)
    }
    if (subTxt !== t.sub) subTxt += '…'
    ctx.fillText(subTxt, x + 28, fila2Y + 118)
  })

  return canvas.toBuffer('image/png')
}

function clasificarCalidad(ms) {
  if (ms < 80) return 'MUY BUENA'
  if (ms < 200) return 'BUENA'
  if (ms < 500) return 'REGULAR'
  return 'LENTA'
}

let handler = async (m, { conn }) => {
  const inicio = speed()
  await conn.sendMessage(m.chat, { text: '⏳ Midiendo velocidad de respuesta...' }, { quoted: m })
  const fin = speed()
  const latenciaMsNum = fin - inicio
  const latenciaMs = latenciaMsNum.toFixed(2)

  const memoria = process.memoryUsage()
  const ramTotalBytes = os.totalmem()
  const ramLibreBytes = os.freemem()
  const ramUsoProceso = memoria.rss

  const datos = {
    latenciaMs,
    latenciaMsNum,
    calidad: clasificarCalidad(latenciaMsNum),
    usoRAM: formatearMB(ramUsoProceso),
    ramLibre: formatearMB(ramLibreBytes),
    ramTotal: formatearMB(ramTotalBytes),
    porcentajeRAM: Math.min(1, ramUsoProceso / ramTotalBytes) || 0.05,
    uptimeProceso: formatearTiempo(process.uptime()),
    uptimeSistema: formatearTiempo(os.uptime()),
    cargaCpu: os.loadavg()[0].toFixed(2),
    nucleos: os.cpus().length,
    nodeVersion: process.version,
    plataforma: `${os.platform()} (${os.arch()})`
  }

  try {
    const imagenBuffer = await generarImagenPing(datos)
    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: '「 ⚡ SAITAMA-BOT · PING 」\nUn golpe. Un diagnóstico completo.'
    }, { quoted: m })
  } catch (e) {
    console.error('[ping] Error generando imagen:', e)
    let texto = '「 🌿 SAITAMA-BOT · PING 」\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
    texto += `⚡ Latencia: ${datos.latenciaMs} ms\n`
    texto += `🕐 Uptime del bot: ${datos.uptimeProceso}\n`
    texto += `🖥️ Uptime del sistema: ${datos.uptimeSistema}\n\n`
    texto += `💾 RAM en uso (proceso): ${datos.usoRAM}\n`
    texto += `💽 RAM libre: ${datos.ramLibre} / ${datos.ramTotal}\n`
    texto += `⚙️ Carga CPU (1 min): ${datos.cargaCpu} · ${datos.nucleos} núcleos\n`
    texto += `🧩 Node.js: ${datos.nodeVersion}\n`
    texto += `🌐 Plataforma: ${datos.plataforma}\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`
    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['ping']
handler.tags = ['info']
handler.command = /^(ping|velocidad|speed)$/i
handler.desc = 'Muestra latencia y estadísticas del sistema en una imagen generada'

export default handler
