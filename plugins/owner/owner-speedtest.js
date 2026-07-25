import { performance } from 'perf_hooks'
import { createCanvas } from '@napi-rs/canvas'

// ═══════════════════════════════════════════
//  MOTOR DE MEDICIÓN — infraestructura de speed.cloudflare.com
//  (sin necesidad de API Key, mismos endpoints que usa cloudflare speed test)
// ═══════════════════════════════════════════
const CF_META = 'https://speed.cloudflare.com/meta'
const CF_DOWN = 'https://speed.cloudflare.com/__down'
const CF_UP = 'https://speed.cloudflare.com/__up'

async function obtenerMeta() {
  try {
    const res = await fetch(CF_META, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function medirPing(muestras = 5) {
  const tiempos = []
  for (let i = 0; i < muestras; i++) {
    const inicio = performance.now()
    try {
      await fetch(`${CF_DOWN}?bytes=0`, { cache: 'no-store' })
      tiempos.push(performance.now() - inicio)
    } catch {
      // ignora muestras fallidas
    }
  }
  if (!tiempos.length) return { ping: 0, best: 0, jitter: 0, muestras: 0 }
  const best = Math.min(...tiempos)
  const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length
  const jitter = Math.max(...tiempos) - Math.min(...tiempos)
  return { ping: promedio, best, jitter, muestras: tiempos.length }
}

async function medirDescarga(bytes = 15_000_000) {
  const inicio = performance.now()
  const res = await fetch(`${CF_DOWN}?bytes=${bytes}`, { cache: 'no-store' })
  const buffer = await res.arrayBuffer()
  const segundos = (performance.now() - inicio) / 1000
  if (segundos <= 0) return 0
  return (buffer.byteLength * 8) / segundos / 1_000_000 // Mbps
}

async function medirSubida(bytes = 5_000_000) {
  const datos = new Uint8Array(bytes)
  const inicio = performance.now()
  await fetch(CF_UP, { method: 'POST', body: datos })
  const segundos = (performance.now() - inicio) / 1000
  if (segundos <= 0) return 0
  return (bytes * 8) / segundos / 1_000_000 // Mbps
}

function clasificarCalidad(mbpsDescarga) {
  if (mbpsDescarga >= 300) return 'EXCELENTE'
  if (mbpsDescarga >= 100) return 'MUY BUENA'
  if (mbpsDescarga >= 25) return 'BUENA'
  if (mbpsDescarga >= 5) return 'REGULAR'
  return 'LENTA'
}

// ═══════════════════════════════════════════
//  DISEÑO DE LA TARJETA — mismo estilo "Saitama Power"
// ═══════════════════════════════════════════
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

function barraProgreso(ctx, x, y, w, h, porcentaje, colorInicio, colorFin) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, x, y, w, h, h / 2)
  ctx.fill()

  const anchoRelleno = Math.max(h, w * Math.min(1, Math.max(0, porcentaje)))
  const grad = ctx.createLinearGradient(x, 0, x + anchoRelleno, 0)
  grad.addColorStop(0, colorInicio)
  grad.addColorStop(1, colorFin)
  ctx.fillStyle = grad
  roundRect(ctx, x, y, anchoRelleno, h, h / 2)
  ctx.fill()
}

function recortarTexto(ctx, texto, maxAncho) {
  let t = texto
  while (ctx.measureText(t).width > maxAncho && t.length > 3) {
    t = t.slice(0, -2)
  }
  return t === texto ? t : t + '…'
}

async function generarImagenSpeedtest({ descarga, subida, ping, jitter, muestras, meta, duracionSeg }) {
  const W = 1200
  const H = 700
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#ffd23f'
  const amarilloClaro = '#ffe98a'

  // ── Fondo con degradado y blobs (mismo estilo de los otros plugins) ──
  const gradFondo = ctx.createLinearGradient(0, 0, W, H)
  gradFondo.addColorStop(0, '#060d16')
  gradFondo.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = gradFondo
  ctx.fillRect(0, 0, W, H)

  circuloDesenfocado(ctx, W - 120, 60, 260, 'rgba(255,210,63,ALPHA)', '0.12')
  circuloDesenfocado(ctx, W - 60, H - 40, 220, 'rgba(255,77,77,ALPHA)', '0.10')
  circuloDesenfocado(ctx, 40, H - 60, 180, 'rgba(255,210,63,ALPHA)', '0.06')

  // ── Tarjeta contenedora ──
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

  // ── Badge ──
  ctx.font = 'bold 22px sans-serif'
  const badgeTexto = '⚡ SAITAMA POWER'
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
  ctx.fillText('Un golpe, una conexión medida', W - marginX, 96)

  // ── Título ──
  ctx.textAlign = 'left'
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText('SAITAMA-BOT', marginX, 158)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 54px sans-serif'
  ctx.fillText('Internet Speed Report', marginX, 218)

  const calidad = clasificarCalidad(descarga)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '24px sans-serif'
  ctx.fillText(
    `Calidad ${calidad} · Duración ${duracionSeg.toFixed(1)}s`,
    marginX,
    256
  )

  // ── Dos tarjetas grandes: DOWNLOAD / UPLOAD ──
  const cardY = 300
  const cardH = 150
  const cardW = (W - marginX * 2 - 30) / 2
  const card1X = marginX
  const card2X = marginX + cardW + 30

  // Card Download
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRect(ctx, card1X, cardY, cardW, cardH, 22)
  ctx.fill()
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('DOWNLOAD', card1X + 34, cardY + 42)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(`${descarga.toFixed(2)} Mbps`, card1X + 34, cardY + 96)
  const porcDescarga = Math.min(1, descarga / 500) // referencia visual: 500 Mbps = barra llena
  barraProgreso(ctx, card1X + 34, cardY + 116, cardW - 68, 12, porcDescarga, '#ffd23f', '#ff9a3f')
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.fillText('Host Cloudflare', card1X + 34, cardY + cardH - 16)

  // Card Upload
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRect(ctx, card2X, cardY, cardW, cardH, 22)
  ctx.fill()
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('UPLOAD', card2X + 34, cardY + 42)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(`${subida.toFixed(2)} Mbps`, card2X + 34, cardY + 96)
  const porcSubida = Math.min(1, subida / 200) // referencia visual: 200 Mbps = barra llena
  barraProgreso(ctx, card2X + 34, cardY + 116, cardW - 68, 12, porcSubida, '#ff4d4d', '#ffd23f')
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.fillText('Host Cloudflare', card2X + 34, cardY + cardH - 16)

  // ── Fila inferior: PING / JITTER / NETWORK ──
  const fila2Y = cardY + cardH + 30
  const fila2H = 150
  const gap = 30
  const card3W = (W - marginX * 2 - gap * 2) / 3

  const ciudad = meta?.city || 'Desconocida'
  const region = meta?.region || ''
  const nodo = meta?.colo || '???'

  const tarjetas = [
    { titulo: 'PING', valor: `${ping.best.toFixed(0)} ms`, sub: `Promedio ${ping.ping.toFixed(0)} ms` },
    { titulo: 'JITTER', valor: `${ping.jitter.toFixed(0)} ms`, sub: `Muestras ${ping.muestras}` },
    { titulo: 'NETWORK', valor: `${ciudad}${region ? ', ' + region : ''}`, sub: `Nodo ${nodo} · Sin exponer IP pública ni ISP` }
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
    ctx.font = 'bold 30px sans-serif'
    ctx.fillText(recortarTexto(ctx, t.valor, card3W - 56), x + 28, fila2Y + 84)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '16px sans-serif'
    ctx.fillText(recortarTexto(ctx, t.sub, card3W - 56), x + 28, fila2Y + 116)
  })

  return canvas.toBuffer('image/png')
}

// ───────────────────────────────────────────
// Comando .speedtest
// ───────────────────────────────────────────
let handler = async (m, { conn }) => {
  await m.reply('⏳ Midiendo velocidad de tu conexión, esto puede tardar unos segundos...')

  const inicioTotal = performance.now()

  try {
    const meta = await obtenerMeta()
    const ping = await medirPing(5)
    const [descarga, subida] = await Promise.all([
      medirDescarga(15_000_000),
      medirSubida(5_000_000)
    ])

    const duracionSeg = (performance.now() - inicioTotal) / 1000

    const imagenBuffer = await generarImagenSpeedtest({
      descarga,
      subida,
      ping,
      jitter: ping.jitter,
      muestras: ping.muestras,
      meta,
      duracionSeg
    })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: '「 ⚡ SAITAMA-BOT · SPEEDTEST 」'
    }, { quoted: m })
  } catch (e) {
    console.error('[speedtest] Error:', e)
    await m.reply(
      '「 ⚡ SAITAMA-BOT 」\n❌ No se pudo medir la velocidad.\n' +
      `Detalle: ${e.message}`
    )
  }
}

handler.help = ['speedtest']
handler.tags = ['tools']
handler.command = /^(speedtest|velocidadnet|testvelocidad)$/i

export default handler
