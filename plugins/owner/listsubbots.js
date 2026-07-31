import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { listarSubbots } from '../../lib/subbots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 🔤 Fuente opcional: si tienes una .ttf propia, colócala en lib/fonts/ y se registra sola.
try {
  const fontPath = path.join(__dirname, '..', '..', 'lib', 'fonts', 'Inter-Bold.ttf')
  if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, 'Sans')
} catch {}

const ROW_HEIGHT = 64
const MAX_ROWS_PER_CARD = 14 // límite de filas por imagen para no hacerla gigante

function clamp(v, min, max) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 🍃 Dibuja una hoja vectorial (nada de emoji/fuente) usando curvas bezier
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

  // vena central de la hoja
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

// 🌿 Genera la carta con la lista de subbots (paginada si hay muchos)
function createSubbotsCard({ botName = 'SAITAMA-BOT', titulo = 'SUBBOTS', subbots = [], pagina = 1, totalPaginas = 1, esOwner = false }) {
  const width = 900
  const filas = subbots.length
  const headerH = 210
  const footerH = 70
  const bodyH = Math.max(1, filas) * ROW_HEIGHT + 30
  const height = headerH + bodyH + footerH

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

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

  // hojitas decorativas en las esquinas
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

  // Encabezado estilo caja (unicode, no emoji)
  glowText(ctx, '╭─⪼ ' + titulo, 40, 108, { color: '#7CFC9A', glow: 12, font: 'bold 26px Sans' })
  ctx.shadowBlur = 0
  ctx.fillStyle = '#5f9c78'
  ctx.font = '15px Sans'
  ctx.fillText('│', 40, 136)
  ctx.fillText(
    esOwner ? `Listado global · ${filas} subbot${filas === 1 ? '' : 's'}` : `Tus subbots · ${filas} registrado${filas === 1 ? '' : 's'}`,
    64, 136
  )
  ctx.fillText('╰───────────────⬣', 40, 164)

  if (totalPaginas > 1) {
    ctx.fillStyle = '#5f9c78'
    ctx.font = '13px Sans'
    ctx.fillText(`Página ${pagina}/${totalPaginas}`, width - 160, 164)
  }

  // 📋 Filas de subbots
  let y = headerH
  if (filas === 0) {
    ctx.fillStyle = '#0b2416'
    drawRoundedRect(ctx, 40, y, width - 80, ROW_HEIGHT, 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(63, 174, 86, 0.35)'
    ctx.lineWidth = 1.5
    drawRoundedRect(ctx, 40, y, width - 80, ROW_HEIGHT, 14)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px Sans'
    ctx.fillText('No hay subbots para mostrar.', 64, y + 38)
  } else {
    subbots.forEach((s, i) => {
      const rowY = y + i * ROW_HEIGHT
      ctx.fillStyle = '#0b2416'
      drawRoundedRect(ctx, 40, rowY, width - 80, ROW_HEIGHT - 10, 14)
      ctx.fill()
      ctx.strokeStyle = 'rgba(63, 174, 86, 0.3)'
      ctx.lineWidth = 1.2
      drawRoundedRect(ctx, 40, rowY, width - 80, ROW_HEIGHT - 10, 14)
      ctx.stroke()

      ctx.fillStyle = '#5f9c78'
      ctx.font = '13px Sans'
      ctx.fillText(`#${s.indice}`, 60, rowY + 22)

      glowText(ctx, `ID: ${s.id}`, 60, rowY + 42, { color: '#7CFC9A', glow: 6, font: 'bold 18px Sans' })

      ctx.fillStyle = '#ffffff'
      ctx.font = '15px Sans'
      ctx.fillText(`Numero: ${s.numero}`, 340, rowY + 42)

      if (esOwner) {
        ctx.fillStyle = '#5f9c78'
        ctx.font = '14px Sans'
        ctx.fillText(`Owner: ${s.owner}`, 620, rowY + 42)
      }
    })
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

const handler = async (m, { conn, isROwner }) => {
  try {
    const todos = listarSubbots()

    const fuente = isROwner
      ? todos
      : todos.filter(s => s.owner === m.sender)

    if (!isROwner && fuente.length === 0) {
      return conn.sendMessage(m.chat, {
        text: wrap('SUBBOTS', ['No tienes subbots creados.'])
      }, { quoted: m })
    }
    if (isROwner && fuente.length === 0) {
      return conn.sendMessage(m.chat, {
        text: wrap('SUBBOTS', ['No hay subbots creados.'])
      }, { quoted: m })
    }

    const datos = fuente.map((s, i) => ({
      indice: i + 1,
      id: s.id,
      numero: s.numero,
      owner: s.owner?.split('@')[0] || 'N/D'
    }))

    const totalPaginas = Math.max(1, Math.ceil(datos.length / MAX_ROWS_PER_CARD))

    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
      const inicio = (pagina - 1) * MAX_ROWS_PER_CARD
      const bloque = datos.slice(inicio, inicio + MAX_ROWS_PER_CARD)

      let image = null
      try {
        image = createSubbotsCard({
          botName: 'SAITAMA-BOT',
          titulo: isROwner ? 'TODOS LOS SUBBOTS' : 'TUS SUBBOTS',
          subbots: bloque,
          pagina,
          totalPaginas,
          esOwner: isROwner
        })
      } catch (e) {
        console.error('[listsubbots] error generando la carta (canvas):', e)
      }

      const caption = wrap(
        isROwner ? 'TODOS LOS SUBBOTS' : 'TUS SUBBOTS',
        totalPaginas > 1 ? [`Página ${pagina}/${totalPaginas}`] : [`${datos.length} subbot${datos.length === 1 ? '' : 's'} encontrados`]
      )

      if (image) {
        await conn.sendMessage(m.chat, { image, caption }, { quoted: m })
      } else {
        const texto = bloque.map(s =>
          isROwner
            ? `${s.indice}. ID: ${s.id} | Numero: ${s.numero} | Owner: ${s.owner}`
            : `${s.indice}. ID: ${s.id} | Numero: ${s.numero}`
        ).join('\n')
        await conn.sendMessage(m.chat, { text: `${caption}\n\n${texto}` }, { quoted: m })
      }
    }
  } catch (err) {
    console.error('[listsubbots] ERROR GENERAL:', err)
    await conn.sendMessage(m.chat, {
      text: wrap('SUBBOTS', [`Error al listar subbots: ${err?.message || err}`])
    }, { quoted: m })
  }
}

handler.help = ['listsubbots']
handler.tags = ['owner']
handler.command = /^(listsubbots|misbots)$/i

export default handler
