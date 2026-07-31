import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { listarSubbots, eliminarSubbot } from '../../lib/subbots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 🔤 Fuente opcional: si tienes una .ttf propia, colócala en lib/fonts/ y se registra sola.
try {
  const fontPath = path.join(__dirname, '..', '..', 'lib', 'fonts', 'Inter-Bold.ttf')
  if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, 'Sans')
} catch {}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 🍃 Hoja vectorial (sin emoji/fuente), la misma que en listsubbots
function drawLeaf(ctx, x, y, size, angleDeg = 0, color = '#3fae56') {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((angleDeg * Math.PI) / 180)

  ctx.beginPath()
  ctx.moveTo(0, size)
  ctx.bezierCurveTo(size * 0.9, size * 0.6, size * 0.9, -size * 0.6, 0, -size)
  ctx.bezierCurveTo(-size * 0.9, -size * 0.6, -size * 0.9, size * 0.6, 0, size)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(0, size * 0.85)
  ctx.lineTo(0, -size * 0.85)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = Math.max(1, size * 0.05)
  ctx.stroke()

  ctx.restore()
}

function glowText(ctx, text, x, y, { color = '#7CFC9A', glow = 10, font = 'bold 22px Sans' } = {}) {
  ctx.font = font
  ctx.shadowColor = color
  ctx.shadowBlur = glow
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.shadowBlur = 0
}

// 🌿 Carta de confirmación (éxito o error) al eliminar un subbot
function createDelSubbotCard({ botName = 'SAITAMA-BOT', exito = true, id = '', numero = '', owner = '', motivo = '' }) {
  const width = 900
  const height = 420

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const colorPrincipal = exito ? '#3fae56' : '#e05252'
  const colorGlow = exito ? '#7CFC9A' : '#ff8f8f'

  // 🌑 Fondo negro con degradado verde oscuro
  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#04120a')
  bg.addColorStop(0.5, '#07190f')
  bg.addColorStop(1, '#0b2416')
  ctx.fillStyle = bg
  drawRoundedRect(ctx, 0, 0, width, height, 24)
  ctx.fill()

  // rejilla sutil
  ctx.strokeStyle = 'rgba(63, 174, 86, 0.06)'
  ctx.lineWidth = 1
  for (let gx = 0; gx < width; gx += 45) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke()
  }
  for (let gy = 0; gy < height; gy += 45) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke()
  }

  // hojitas decorativas
  drawLeaf(ctx, 850, 40, 22, 20, '#3fae56')
  drawLeaf(ctx, 870, 70, 16, -35, '#2e8b46')
  drawLeaf(ctx, 40, height - 40, 20, -150, '#3fae56')
  drawLeaf(ctx, 65, height - 60, 14, 200, '#2e8b46')

  // 🏷️ Badge del bot
  ctx.shadowColor = '#3fae56'
  ctx.shadowBlur = 14
  ctx.fillStyle = '#2e8b46'
  drawRoundedRect(ctx, 40, 36, 210, 34, 17)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#04120a'
  ctx.font = 'bold 16px Sans'
  ctx.fillText(botName, 58, 59)

  ctx.fillStyle = '#5f9c78'
  ctx.font = '14px Sans'
  ctx.fillText(`Reporte generado por ${botName}`, width - 300, 55)

  // Encabezado estilo caja
  glowText(ctx, '╭─⪼ ELIMINAR SUBBOT', 40, 108, { color: '#7CFC9A', glow: 12, font: 'bold 26px Sans' })
  ctx.shadowBlur = 0
  ctx.fillStyle = '#5f9c78'
  ctx.font = '15px Sans'
  ctx.fillText('│', 40, 136)
  ctx.fillText('Resultado de la operacion', 64, 136)
  ctx.fillText('╰───────────────⬣', 40, 164)

  // Caja de estado (éxito/error)
  const boxY = 200
  const boxH = exito ? 130 : 100
  ctx.fillStyle = '#0b2416'
  drawRoundedRect(ctx, 40, boxY, width - 80, boxH, 14)
  ctx.fill()
  ctx.strokeStyle = colorPrincipal + '80'
  ctx.lineWidth = 1.5
  drawRoundedRect(ctx, 40, boxY, width - 80, boxH, 14)
  ctx.stroke()

  ctx.fillStyle = '#5f9c78'
  ctx.font = '14px Sans'
  ctx.fillText('ESTADO', 64, boxY + 28)

  glowText(ctx, exito ? 'ELIMINADO CORRECTAMENTE' : 'NO SE PUDO ELIMINAR', 64, boxY + 62, {
    color: colorGlow,
    glow: 12,
    font: 'bold 24px Sans'
  })

  if (exito) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px Sans'
    ctx.fillText(`ID: ${id}   ·   Numero: ${numero}   ·   Owner: ${owner}`, 64, boxY + 96)
  } else if (motivo) {
    ctx.fillStyle = '#c98f8f'
    ctx.font = '14px Sans'
    ctx.fillText(motivo, 64, boxY + 88)
  }

  return canvas.toBuffer('image/png')
}

function wrap(title, lines) {
  return (
    `╭─⪼ 🌿 *${title}*\n` +
    lines.map(l => `│ ${l}`).join('\n') +
    `\n╰───────────────⬣`
  )
}

async function enviarCarta(conn, m, opciones, textoFallback) {
  let image = null
  try {
    image = createDelSubbotCard(opciones)
  } catch (e) {
    console.error('[delsubbot] error generando la carta (canvas):', e)
  }

  if (image) {
    await conn.sendMessage(m.chat, { image, caption: wrap('SUBBOTS', [textoFallback]) }, { quoted: m })
  } else {
    await conn.sendMessage(m.chat, { text: wrap('SUBBOTS', [textoFallback]) }, { quoted: m })
  }
}

const handler = async (m, { conn, args, isROwner, usedPrefix }) => {
  try {
    const id = (args[0] || '').trim()

    if (!id) {
      return conn.sendMessage(m.chat, {
        text: wrap('SUBBOTS', [
          `Uso: ${usedPrefix}delsubbot <id>`,
          `Usa ${usedPrefix}listsubbots para ver los IDs disponibles.`
        ])
      }, { quoted: m })
    }

    const todos = listarSubbots()
    const subbot = todos.find(s => s.id === id)

    if (!subbot) {
      return enviarCarta(
        conn, m,
        { botName: 'SAITAMA-BOT', exito: false, motivo: `No se encontro ningun subbot con el ID: ${id}` },
        `No se encontro ningun subbot con el ID: ${id}`
      )
    }

    if (!isROwner && subbot.owner !== m.sender) {
      return enviarCarta(
        conn, m,
        { botName: 'SAITAMA-BOT', exito: false, motivo: 'Ese subbot no te pertenece.' },
        'Ese subbot no te pertenece.'
      )
    }

    const ok = eliminarSubbot(id)

    if (ok) {
      return enviarCarta(
        conn, m,
        {
          botName: 'SAITAMA-BOT',
          exito: true,
          id: subbot.id,
          numero: subbot.numero,
          owner: subbot.owner?.split('@')[0] || 'N/D'
        },
        `Subbot ${id} eliminado correctamente.`
      )
    } else {
      return enviarCarta(
        conn, m,
        { botName: 'SAITAMA-BOT', exito: false, motivo: `No se pudo eliminar el subbot ${id}.` },
        `No se pudo eliminar el subbot ${id}.`
      )
    }
  } catch (err) {
    console.error('[delsubbot] ERROR GENERAL:', err)
    await conn.sendMessage(m.chat, {
      text: wrap('SUBBOTS', [`Error al eliminar subbot: ${err?.message || err}`])
    }, { quoted: m })
  }
}

handler.help = ['delsubbot <id>']
handler.tags = ['owner']
handler.command = /^(delsubbot|eliminarsubbot)$/i

export default handler
