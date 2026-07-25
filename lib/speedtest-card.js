import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 🔤 Si tienes una fuente .ttf propia, colócala en lib/fonts/ y regístrala aquí.
// Si no registras ninguna, @napi-rs/canvas usa la fuente por defecto del sistema.
try {
  const fontPath = path.join(__dirname, '..', '..', 'lib', 'fonts', 'Inter-Bold.ttf')
  if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, 'Sans')
} catch {}

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

// 💠 Texto con resplandor neón
function neonText(ctx, text, x, y, { color = '#00e5ff', glow = 14, font = 'bold 22px Sans' } = {}) {
  ctx.font = font
  ctx.shadowColor = color
  ctx.shadowBlur = glow
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.shadowBlur = 0
}

function statBox(ctx, { x, y, w, h, label, value, unit, barColor, barPct }) {
  ctx.shadowBlur = 0
  ctx.fillStyle = '#0b0f1a'
  drawRoundedRect(ctx, x, y, w, h, 14)
  ctx.fill()

  ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)'
  ctx.lineWidth = 1.5
  drawRoundedRect(ctx, x, y, w, h, 14)
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.fillStyle = '#5fb8e0'
  ctx.font = '14px Sans'
  ctx.fillText(label, x + 24, y + 32)

  neonText(ctx, `${value}${unit ? ' ' + unit : ''}`, x + 24, y + 70, {
    color: '#00e5ff',
    glow: 10,
    font: 'bold 28px Sans'
  })

  if (barColor) {
    const barY = y + h - 26
    const barW = w - 48

    ctx.shadowBlur = 0
    ctx.fillStyle = '#132033'
    drawRoundedRect(ctx, x + 24, barY, barW, 6, 3)
    ctx.fill()

    ctx.shadowColor = barColor
    ctx.shadowBlur = 10
    ctx.fillStyle = barColor
    drawRoundedRect(ctx, x + 24, barY, barW * clamp(barPct, 0, 1), 6, 3)
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

export function createSpeedtestCard({
  botName = 'SAITAMA-BOT',
  modeLabel = 'NORMAL',
  statusLabel = 'ESTABLE',
  downloadMbps = 0,
  uploadMbps = 0,
  pingMs = 0,
  jitterMs = 0,
  colo = '',
  location = '',
  asn = '',
}) {
  const width = 900
  const height = 600
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // 🌌 Fondo negro con degradado azul oscuro
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, '#02040a')
  bgGradient.addColorStop(0.5, '#050b18')
  bgGradient.addColorStop(1, '#0a1428')
  ctx.fillStyle = bgGradient
  drawRoundedRect(ctx, 0, 0, width, height, 24)
  ctx.fill()

  // ✨ Rejilla sutil estilo grid neón
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.05)'
  ctx.lineWidth = 1
  for (let gx = 0; gx < width; gx += 45) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, height)
    ctx.stroke()
  }
  for (let gy = 0; gy < height; gy += 45) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(width, gy)
    ctx.stroke()
  }

  // 🏷️ Badge del bot
  ctx.shadowColor = '#00e5ff'
  ctx.shadowBlur = 16
  ctx.fillStyle = '#00b8d4'
  drawRoundedRect(ctx, 40, 36, 190, 34, 17)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#020410'
  ctx.font = 'bold 16px Sans'
  ctx.fillText(`⚡ ${botName}`, 58, 59)

  ctx.shadowBlur = 0
  ctx.fillStyle = '#4d6b8a'
  ctx.font = '14px Sans'
  ctx.fillText(`Reporte generado por ${botName}`, width - 300, 55)

  neonText(ctx, 'NEON SPEED CHECK', 40, 100, { color: '#00e5ff', glow: 12, font: 'bold 15px Sans' })
  neonText(ctx, 'Reporte de Velocidad', 40, 142, { color: '#ffffff', glow: 6, font: 'bold 32px Sans' })

  ctx.shadowBlur = 0
  ctx.fillStyle = '#5fb8e0'
  ctx.font = '15px Sans'
  ctx.fillText(`Modo ${modeLabel} · Calidad ${statusLabel}`, 40, 168)

  const dlPct = clamp(downloadMbps / 300, 0, 1)
  const ulPct = clamp(uploadMbps / 150, 0, 1)

  statBox(ctx, {
    x: 40, y: 200, w: 400, h: 130,
    label: 'DESCARGA',
    value: downloadMbps.toFixed(2),
    unit: 'Mbps',
    barColor: '#00e5ff',
    barPct: dlPct,
  })

  statBox(ctx, {
    x: 460, y: 200, w: 400, h: 130,
    label: 'SUBIDA',
    value: uploadMbps.toFixed(2),
    unit: 'Mbps',
    barColor: '#2979ff',
    barPct: ulPct,
  })

  statBox(ctx, {
    x: 40, y: 350, w: 260, h: 110,
    label: 'PING',
    value: pingMs.toFixed(0),
    unit: 'ms',
  })

  statBox(ctx, {
    x: 320, y: 350, w: 260, h: 110,
    label: 'JITTER',
    value: jitterMs.toFixed(0),
    unit: 'ms',
  })

  statBox(ctx, {
    x: 600, y: 350, w: 260, h: 110,
    label: 'NODO',
    value: colo || 'N/D',
    unit: '',
  })

  ctx.shadowBlur = 0
  ctx.fillStyle = '#0b0f1a'
  drawRoundedRect(ctx, 40, 480, 820, 90, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)'
  ctx.lineWidth = 1.5
  drawRoundedRect(ctx, 40, 480, 820, 90, 14)
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.fillStyle = '#5fb8e0'
  ctx.font = '14px Sans'
  ctx.fillText('ZONA DETECTADA', 64, 512)

  neonText(ctx, location || 'No detectada', 64, 545, { color: '#00e5ff', glow: 8, font: 'bold 22px Sans' })

  ctx.shadowBlur = 0
  ctx.fillStyle = '#4d6b8a'
  ctx.font = '13px Sans'
  ctx.fillText(`ASN: ${asn || 'No detectado'} — IP oculta por privacidad`, 64, 562)

  return canvas.toBuffer('image/png')
}
