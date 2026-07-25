import os from 'os'
import { execSync } from 'child_process'
import { createCanvas } from '@napi-rs/canvas'

// ═══════════════════════════════════════════
//  RECOLECCIÓN DE DATOS DEL SERVIDOR
// ═══════════════════════════════════════════
function obtenerDisco() {
  try {
    // Funciona en Linux/Termux. En otros sistemas cae al catch.
    const salida = execSync('df -k /', { encoding: 'utf8' })
    const lineas = salida.trim().split('\n')
    const partes = lineas[lineas.length - 1].trim().split(/\s+/)
    const totalKB = parseInt(partes[1], 10)
    const usadoKB = parseInt(partes[2], 10)
    const libreKB = parseInt(partes[3], 10)
    const porcentaje = totalKB ? usadoKB / totalKB : 0
    return {
      total: (totalKB / 1024 / 1024).toFixed(1) + ' GB',
      usado: (usadoKB / 1024 / 1024).toFixed(1) + ' GB',
      libre: (libreKB / 1024 / 1024).toFixed(1) + ' GB',
      porcentaje
    }
  } catch {
    return null
  }
}

function formatearTiempo(segundos) {
  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor((segundos % 86400) / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const partes = []
  if (dias) partes.push(`${dias}d`)
  if (horas) partes.push(`${horas}h`)
  partes.push(`${minutos}m`)
  return partes.join(' ')
}

function formatearGB(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

// ═══════════════════════════════════════════
//  DISEÑO — estilo TERMINAL / HACKER (verde sobre negro)
//  Distinto al estilo "Saitama Power" (amarillo/blobs) usado en ping y speedtest.
// ═══════════════════════════════════════════
function dibujarEsquinasHUD(ctx, x, y, w, h, tam, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  const esquinas = [
    [x, y, 1, 1], [x + w, y, -1, 1],
    [x, y + h, 1, -1], [x + w, y + h, -1, -1]
  ]
  for (const [cx, cy, dx, dy] of esquinas) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + tam * dy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + tam * dx, cy)
    ctx.stroke()
  }
}

function barraAscii(ctx, x, y, w, porcentaje, colorLleno) {
  const totalSegmentos = 30
  const segmentosLlenos = Math.round(totalSegmentos * Math.min(1, Math.max(0, porcentaje)))
  const segW = w / totalSegmentos

  for (let i = 0; i < totalSegmentos; i++) {
    ctx.fillStyle = i < segmentosLlenos ? colorLleno : 'rgba(0,255,140,0.12)'
    ctx.fillRect(x + i * segW, y, segW - 2, 22)
  }
}

function lineasScan(ctx, W, H) {
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = '#00ff9c'
  for (let y = 0; y < H; y += 4) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.restore()
}

async function generarImagenServidor(datos) {
  const W = 1100
  const H = 750
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const verde = '#00ff9c'
  const verdeClaro = '#a8ffdc'
  const ambar = '#ffcc66'
  const rojo = '#ff5f56'

  // Fondo negro puro + textura de "scanlines"
  ctx.fillStyle = '#020403'
  ctx.fillRect(0, 0, W, H)
  lineasScan(ctx, W, H)

  // Resplandor sutil verde en el fondo (vignette invertido)
  const glow = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W)
  glow.addColorStop(0, 'rgba(0,255,156,0.05)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const pad = 50

  // Marco HUD con esquinas tipo "target lock"
  ctx.strokeStyle = 'rgba(0,255,156,0.4)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2)
  dibujarEsquinasHUD(ctx, pad, pad, W - pad * 2, H - pad * 2, 34, verde)

  const marginX = pad + 40

  // Barra de título tipo terminal (los tres puntos rojo/ámbar/verde)
  const puntoY = pad + 42
  ;[rojo, ambar, verde].forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(marginX + i * 26, puntoY, 8, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.font = '20px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.textAlign = 'right'
  ctx.fillText('saitama@server: status --live', W - marginX, puntoY + 6)

  // Prompt principal
  ctx.textAlign = 'left'
  ctx.font = 'bold 30px monospace'
  ctx.fillStyle = verde
  ctx.fillText('root@saitama-bot', marginX, pad + 100)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(':~$', marginX + ctx.measureText('root@saitama-bot').width + 10, pad + 100)

  ctx.font = 'bold 46px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('> SERVER STATUS', marginX, pad + 150)

  ctx.font = '20px monospace'
  ctx.fillStyle = 'rgba(0,255,156,0.6)'
  ctx.fillText(`[ok] proceso activo · uptime ${datos.uptimeProceso}`, marginX, pad + 180)

  // Línea divisoria estilo terminal
  ctx.strokeStyle = 'rgba(0,255,156,0.25)'
  ctx.beginPath()
  ctx.moveTo(marginX, pad + 205)
  ctx.lineTo(W - marginX, pad + 205)
  ctx.stroke()

  // ── Bloque de datos tipo "key: value" ──
  let y = pad + 250
  const lineaAltura = 42
  const filas = [
    ['OS', `${datos.plataforma}`],
    ['CPU', datos.cpuModelo],
    ['NÚCLEOS', `${datos.nucleos}`],
    ['LOAD AVG (1m)', datos.cargaCpu],
    ['NODE.JS', datos.nodeVersion],
    ['UPTIME SISTEMA', datos.uptimeSistema]
  ]

  ctx.font = '22px monospace'
  filas.forEach(([label, valor]) => {
    ctx.fillStyle = verdeClaro
    ctx.fillText(`${label}`.padEnd(16, ' '), marginX, y)
    ctx.fillStyle = '#ffffff'
    const offsetX = marginX + ctx.measureText(''.padEnd(16, ' ')).width + 40
    ctx.fillText(valor, offsetX, y)
    y += lineaAltura
  })

  // ── Barra RAM ──
  y += 12
  ctx.font = 'bold 22px monospace'
  ctx.fillStyle = verde
  ctx.fillText(`RAM  ${datos.ramUsoGB} / ${datos.ramTotalGB}`, marginX, y)
  y += 16
  barraAscii(ctx, marginX, y, W - marginX * 2, datos.porcentajeRAM, verde)
  ctx.font = '18px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText(`${(datos.porcentajeRAM * 100).toFixed(0)}% en uso`, marginX, y + 44)

  // ── Barra DISCO (si se pudo leer) ──
  y += 80
  if (datos.disco) {
    ctx.font = 'bold 22px monospace'
    ctx.fillStyle = ambar
    ctx.fillText(`DISCO ${datos.disco.usado} / ${datos.disco.total}`, marginX, y)
    y += 16
    barraAscii(ctx, marginX, y, W - marginX * 2, datos.disco.porcentaje, ambar)
    ctx.font = '18px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText(`${(datos.disco.porcentaje * 100).toFixed(0)}% usado · ${datos.disco.libre} libres`, marginX, y + 44)
  } else {
    ctx.font = '18px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('DISCO: no disponible en este sistema', marginX, y)
  }

  // Cursor parpadeante decorativo al final
  ctx.fillStyle = verde
  ctx.fillRect(marginX, H - pad - 46, 14, 26)

  ctx.font = '18px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.textAlign = 'right'
  ctx.fillText('SAITAMA-BOT // SERVER MONITOR', W - marginX, H - pad - 26)

  return canvas.toBuffer('image/png')
}

// ───────────────────────────────────────────
// Comando .serverd
// ───────────────────────────────────────────
let handler = async (m, { conn }) => {
  const memoria = process.memoryUsage()
  const ramTotalBytes = os.totalmem()
  const ramLibreBytes = os.freemem()
  const ramUsoBytes = ramTotalBytes - ramLibreBytes

  const datos = {
    plataforma: `${os.platform()} ${os.release()} (${os.arch()})`,
    cpuModelo: os.cpus()[0]?.model?.trim() || 'Desconocido',
    nucleos: os.cpus().length,
    cargaCpu: os.loadavg()[0].toFixed(2),
    nodeVersion: process.version,
    uptimeSistema: formatearTiempo(os.uptime()),
    uptimeProceso: formatearTiempo(process.uptime()),
    ramTotalGB: formatearGB(ramTotalBytes),
    ramUsoGB: formatearGB(ramUsoBytes),
    porcentajeRAM: ramTotalBytes ? ramUsoBytes / ramTotalBytes : 0,
    disco: obtenerDisco()
  }

  try {
    const imagenBuffer = await generarImagenServidor(datos)
    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: '「 🖥️ SAITAMA-BOT · SERVER STATUS 」'
    }, { quoted: m })
  } catch (e) {
    console.error('[serverd] Error generando imagen:', e)
    let texto = '「 🖥️ SAITAMA-BOT · SERVER STATUS 」\n\n'
    texto += `💻 OS: ${datos.plataforma}\n`
    texto += `🧠 CPU: ${datos.cpuModelo} (${datos.nucleos} núcleos)\n`
    texto += `📊 Carga: ${datos.cargaCpu}\n`
    texto += `💾 RAM: ${datos.ramUsoGB} / ${datos.ramTotalGB}\n`
    if (datos.disco) texto += `💿 Disco: ${datos.disco.usado} / ${datos.disco.total}\n`
    texto += `🧩 Node.js: ${datos.nodeVersion}\n`
    texto += `⏱️ Uptime sistema: ${datos.uptimeSistema}\n`
    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['serverd']
handler.tags = ['info']
handler.command = /^(serverd|server|status)$/i
handler.desc = 'Muestra el estado del servidor en una tarjeta estilo terminal'

export default handler