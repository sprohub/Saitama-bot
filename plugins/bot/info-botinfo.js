
import os from 'os'
import { execSync } from 'child_process'
import { createCanvas } from '@napi-rs/canvas'

// ═══════════════════════════════════════════
//  TARJETA VISUAL "SAITAMA BOTINFO"
//  100% dibujada por código (gradientes, starburst
//  cómic, líneas de velocidad) — NO usa imágenes de lib/.
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

// Estrella tipo "impacto de cómic" (POW/BOOM) para el fondo del título
function pathStarBurst(ctx, cx, cy, puntas, rExterior, rInterior, rotacionInicial = 0) {
  ctx.beginPath()
  let rot = rotacionInicial
  const paso = Math.PI / puntas
  ctx.moveTo(cx + Math.cos(rot) * rExterior, cy + Math.sin(rot) * rExterior)
  for (let i = 0; i < puntas; i++) {
    rot += paso
    ctx.lineTo(cx + Math.cos(rot) * rInterior, cy + Math.sin(rot) * rInterior)
    rot += paso
    ctx.lineTo(cx + Math.cos(rot) * rExterior, cy + Math.sin(rot) * rExterior)
  }
  ctx.closePath()
}

// Líneas de velocidad radiales detrás del logo (efecto de impacto/cómic)
function dibujarLineasVelocidad(ctx, cx, cy, W, H) {
  const total = 56
  for (let i = 0; i < total; i++) {
    const angulo = (Math.PI * 2 * i) / total
    const rInicio = 260
    const rFin = Math.max(W, H) * 0.85
    const grosor = i % 2 === 0 ? 3 : 1.4
    const alpha = i % 3 === 0 ? 0.10 : 0.05
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angulo)
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`
    ctx.lineWidth = grosor
    ctx.beginPath()
    ctx.moveTo(rInicio, 0)
    ctx.lineTo(rFin, 0)
    ctx.stroke()
    ctx.restore()
  }
}

function dibujarTextoConTrazo(ctx, texto, x, y, fontFill, fontStroke, strokeWidth) {
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = fontStroke
  ctx.strokeText(texto, x, y)
  ctx.fillStyle = fontFill
  ctx.fillText(texto, x, y)
}

function formatFechaHora(fecha) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const d = fecha.getDate().toString().padStart(2, '0')
  const mes = meses[fecha.getMonth()]
  const hh = fecha.getHours().toString().padStart(2, '0')
  const mm = fecha.getMinutes().toString().padStart(2, '0')
  return `${d} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${fecha.getFullYear()} — ${hh}:${mm}`
}

/**
 * Genera la tarjeta "SAITAMA BOTINFO".
 * stats: { usuarios, grupos, comandos, uptimeTexto, ram, disco, cpu, sistema, node }
 */
async function generarImagenBotInfo(stats) {
  const W = 1080
  const H = 1350
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#ffd23f'
  const rojo = '#e8352e'
  const negro = '#08080b'
  const blanco = '#ffffff'
  const gris = '#9aa3af'
  const cx = W / 2

  // ── 1) Fondo base oscuro ──
  ctx.fillStyle = negro
  ctx.fillRect(0, 0, W, H)

  // ── 2) Resplandor radial superior (rojo→amarillo→transparente) ──
  const glow = ctx.createRadialGradient(cx, 340, 0, cx, 340, 780)
  glow.addColorStop(0, 'rgba(232,53,46,0.35)')
  glow.addColorStop(0.45, 'rgba(255,210,63,0.16)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ── 3) Líneas de velocidad (efecto cómic detrás del logo) ──
  dibujarLineasVelocidad(ctx, cx, 340, W, H)

  // ── 4) Starburst grande detrás del título ──
  ctx.save()
  const burstGrad = ctx.createRadialGradient(cx, 340, 20, cx, 340, 300)
  burstGrad.addColorStop(0, 'rgba(255,210,63,0.9)')
  burstGrad.addColorStop(0.6, 'rgba(232,53,46,0.55)')
  burstGrad.addColorStop(1, 'rgba(232,53,46,0)')
  ctx.fillStyle = burstGrad
  pathStarBurst(ctx, cx, 340, 14, 300, 205, Math.PI / 10)
  ctx.fill()
  ctx.restore()

  // ── 5) Sello circular tipo "puño" (anillo doble) ──
  ctx.beginPath()
  ctx.arc(cx, 340, 150, 0, Math.PI * 2)
  ctx.strokeStyle = amarillo
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, 340, 168, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,210,63,0.35)'
  ctx.lineWidth = 3
  ctx.stroke()

  // ── 6) Emoji/ícono central grande dentro del sello ──
  ctx.textAlign = 'center'
  ctx.font = '150px sans-serif'
  ctx.fillText('👊', cx, 395)

  // ── 7) Título "SAITAMA BOT" con trazo cómic ──
  ctx.textAlign = 'center'
  ctx.font = '900 92px sans-serif'
  dibujarTextoConTrazo(ctx, 'SAITAMA', cx, 645, amarillo, negro, 10)
  ctx.font = '900 92px sans-serif'
  dibujarTextoConTrazo(ctx, 'BOT', cx, 735, rojo, blanco, 6)

  // ── 8) Subtítulo ──
  ctx.font = 'bold 26px sans-serif'
  ctx.fillStyle = gris
  ctx.fillText('P A N E L   D E   E S T A D Í S T I C A S', cx, 785)

  // ── 9) Línea divisoria degradada ──
  const lineaGrad = ctx.createLinearGradient(90, 0, W - 90, 0)
  lineaGrad.addColorStop(0, 'rgba(232,53,46,0)')
  lineaGrad.addColorStop(0.5, amarillo)
  lineaGrad.addColorStop(1, 'rgba(232,53,46,0)')
  ctx.strokeStyle = lineaGrad
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(90, 820)
  ctx.lineTo(W - 90, 820)
  ctx.stroke()

  // ── 10) Cuadrícula de tarjetas de estadísticas (2 columnas x 4 filas) ──
  const tarjetas = [
    { icono: '👤', label: 'USUARIOS', valor: String(stats.usuarios) },
    { icono: '👥', label: 'GRUPOS', valor: String(stats.grupos) },
    { icono: '⚡', label: 'COMANDOS', valor: String(stats.comandos) },
    { icono: '⏱️', label: 'ACTIVIDAD', valor: stats.uptimeTexto },
    { icono: '💾', label: 'RAM', valor: `${stats.ram} MB` },
    { icono: '💿', label: 'DISCO', valor: stats.disco },
    { icono: '🖥️', label: 'CPU', valor: stats.cpu },
    { icono: '💻', label: 'SISTEMA', valor: `${stats.sistema} · ${stats.node}` }
  ]

  const margen = 90
  const gap = 24
  const cols = 2
  const cardW = (W - margen * 2 - gap * (cols - 1)) / cols
  const cardH = 118
  let startY = 862

  tarjetas.forEach((t, i) => {
    const col = i % cols
    const fila = Math.floor(i / cols)
    const x = margen + col * (cardW + gap)
    const y = startY + fila * (cardH + gap)

    // Fondo tipo "glass"
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, x, y, cardW, cardH, 22)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, cardW, cardH, 22)
    ctx.stroke()

    // Barra de acento lateral
    ctx.fillStyle = i % 2 === 0 ? amarillo : rojo
    roundRect(ctx, x, y, 8, cardH, 4)
    ctx.fill()

    // Ícono
    ctx.textAlign = 'left'
    ctx.font = '46px sans-serif'
    ctx.fillText(t.icono, x + 30, y + cardH / 2 + 16)

    // Label + valor
    ctx.font = 'bold 17px sans-serif'
    ctx.fillStyle = gris
    ctx.fillText(t.label, x + 100, y + 44)

    ctx.font = 'bold 30px sans-serif'
    ctx.fillStyle = blanco
    let valorTexto = t.valor
    // recorta si es muy largo para no salirse de la tarjeta
    const maxAncho = cardW - 120
    while (ctx.measureText(valorTexto).width > maxAncho && valorTexto.length > 3) {
      valorTexto = valorTexto.slice(0, -1)
    }
    if (valorTexto !== t.valor) valorTexto = valorTexto.slice(0, -1) + '…'
    ctx.fillText(valorTexto, x + 100, y + 84)
  })

  // ── 11) Pie de página ──
  const footerY = startY + 4 * (cardH + gap) + 20
  ctx.textAlign = 'center'
  ctx.font = 'italic 20px sans-serif'
  ctx.fillStyle = gris
  ctx.fillText(formatFechaHora(new Date()), cx, footerY)

  ctx.font = '900 30px sans-serif'
  dibujarTextoConTrazo(ctx, 'SAITAMA BOT ✿', cx, footerY + 46, amarillo, negro, 4)

  return canvas.toBuffer('image/png')
}

// ═══════════════════════════════════════════
//  HANDLER — .botinfo / .stats / .estado
// ═══════════════════════════════════════════
let handler = async (m, { conn }) => {
  let totalUsers = Object.keys(global.db?.data?.users || {}).length

  let totalGroups = Object.keys(global.db?.data?.chats || {})
    .filter(id => id.endsWith('@g.us')).length

  let totalCmds = Object.keys(global.plugins || {}).length

  let uptime = process.uptime()
  let dias = Math.floor(uptime / 86400)
  let horas = Math.floor((uptime % 86400) / 3600)
  let minutos = Math.floor((uptime % 3600) / 60)
  let uptimeTexto = `${dias}d ${horas}h ${minutos}m`

  let ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2)

  let cpu = 'Desconocida'
  try {
    cpu = os.cpus()?.[0]?.model || 'Desconocida'
  } catch {}

  let sistema = os.platform()
  let node = process.version

  let disk = 'N/A'
  try {
    let diskInfo = execSync('df -h / | tail -1').toString().trim()
    let diskParts = diskInfo.split(/\s+/)

    if (diskParts.length >= 5) {
      disk = `${diskParts[2]} / ${diskParts[1]} (${diskParts[4]})`
    }
  } catch {}

  const textoPlano = `╭━━⬣ 「 SAITAMA BOTINFO 」
┃ 👤 Usuarios: ${totalUsers}
┃ 👥 Grupos: ${totalGroups}
┃ ⚡ Comandos: ${totalCmds}
┃ ⏱️ Activa: ${uptimeTexto}
┃ 💾 RAM: ${ram} MB
┃ 💿 Disco: ${disk}
┃ 🖥️ CPU: ${cpu}
┃ 💻 Sistema: ${sistema}
┃ 📦 Node: ${node}
╰━━━━━━━━━━━━━━━━━━━━━⬣
⫏ SAITAMA BOT ✿`

  try {
    const imagenBuffer = await generarImagenBotInfo({
      usuarios: totalUsers,
      grupos: totalGroups,
      comandos: totalCmds,
      uptimeTexto,
      ram,
      disco: disk,
      cpu,
      sistema,
      node
    })

    await conn.sendMessage(
      m.chat,
      {
        image: imagenBuffer,
        caption: '⫏ *SAITAMA BOT* ✿ — estadísticas del sistema'
      },
      { quoted: m }
    )
  } catch (e) {
    console.log('[botinfo] error generando imagen, se envía solo texto:', e)
    await conn.sendMessage(m.chat, { text: textoPlano }, { quoted: m })
  }
}

handler.help = ['botinfo']
handler.tags = ['info']
handler.command = /^(botinfo|stats|estado)$/i
handler.desc = 'Estadísticas del bot'

export default handler
