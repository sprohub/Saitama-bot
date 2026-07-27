import os from 'os'
import { execSync } from 'child_process'
import { createCanvas } from '@napi-rs/canvas'

// ═══════════════════════════════════════════
//  TARJETA VISUAL "SAITAMA BOTINFO"
//  Diseño minimalista y serio: 100% dibujado por código
//  (sin emojis — el motor de canvas no trae fuente de
//  emoji y salían como cuadros — y sin imágenes de lib/).
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

function formatFechaHora(fecha) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const d = fecha.getDate().toString().padStart(2, '0')
  const mes = meses[fecha.getMonth()]
  const hh = fecha.getHours().toString().padStart(2, '0')
  const mm = fecha.getMinutes().toString().padStart(2, '0')
  return `${d} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${fecha.getFullYear()} · ${hh}:${mm}`
}

// Inserta espacio entre letras para un efecto "tracking" en textos cortos
function espaciar(texto, sep = '  ') {
  return texto.split('').join(sep)
}

/**
 * Genera la tarjeta "SAITAMA BOTINFO" — versión minimalista.
 * stats: { usuarios, grupos, comandos, uptimeTexto, ram, disco, cpu, sistema, node }
 */
async function generarImagenBotInfo(stats) {
  const W = 1080
  const H = 1400
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#f4c430'
  const rojo = '#d92c27'
  const fondo = '#0b0c0f'
  const panel = 'rgba(255,255,255,0.035)'
  const borde = 'rgba(255,255,255,0.08)'
  const separador = 'rgba(255,255,255,0.07)'
  const blanco = '#f5f6f8'
  const gris = '#7d8590'
  const cx = W / 2

  // ── 1) Fondo plano, sin texturas ni ruido ──
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, W, H)

  // Resplandor muy sutil detrás del emblema (discreto, no un "burst")
  const glow = ctx.createRadialGradient(cx, 195, 0, cx, 195, 260)
  glow.addColorStop(0, 'rgba(217,44,39,0.16)')
  glow.addColorStop(1, 'rgba(217,44,39,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ── 2) Emblema circular minimalista con monograma "S" ──
  const rAnillo = 78
  const emblemaGrad = ctx.createLinearGradient(cx - rAnillo, 195 - rAnillo, cx + rAnillo, 195 + rAnillo)
  emblemaGrad.addColorStop(0, amarillo)
  emblemaGrad.addColorStop(1, rojo)

  ctx.beginPath()
  ctx.arc(cx, 195, rAnillo, 0, Math.PI * 2)
  ctx.strokeStyle = emblemaGrad
  ctx.lineWidth = 5
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.font = '900 78px sans-serif'
  ctx.fillStyle = amarillo
  ctx.fillText('S', cx, 195 + 28)

  // ── 3) Título centrado, una línea, colores planos ──
  ctx.font = '900 64px sans-serif'
  ctx.textAlign = 'center'
  const tituloY = 370
  const anchoSaitama = ctx.measureText('SAITAMA').width
  ctx.font = '900 64px sans-serif'
  const anchoBot = ctx.measureText(' BOT').width
  const totalAncho = anchoSaitama + anchoBot
  let tx = cx - totalAncho / 2

  ctx.textAlign = 'left'
  ctx.fillStyle = amarillo
  ctx.fillText('SAITAMA', tx, tituloY)
  tx += anchoSaitama
  ctx.fillStyle = rojo
  ctx.fillText(' BOT', tx, tituloY)

  // ── 4) Subtítulo pequeño, espaciado, serio ──
  ctx.textAlign = 'center'
  ctx.font = '600 18px sans-serif'
  ctx.fillStyle = gris
  ctx.fillText(espaciar('PANEL DE ESTADÍSTICAS'), cx, tituloY + 46)

  // ── 5) Línea divisoria corta y centrada ──
  const anchoLinea = 220
  const lineaGrad = ctx.createLinearGradient(cx - anchoLinea / 2, 0, cx + anchoLinea / 2, 0)
  lineaGrad.addColorStop(0, 'rgba(244,196,48,0)')
  lineaGrad.addColorStop(0.5, amarillo)
  lineaGrad.addColorStop(1, 'rgba(217,44,39,0)')
  ctx.strokeStyle = lineaGrad
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - anchoLinea / 2, tituloY + 80)
  ctx.lineTo(cx + anchoLinea / 2, tituloY + 80)
  ctx.stroke()

  // ── 6) Panel único con lista de estadísticas (sin íconos, sin emojis) ──
  const filas = [
    { label: 'USUARIOS', valor: String(stats.usuarios) },
    { label: 'GRUPOS', valor: String(stats.grupos) },
    { label: 'COMANDOS', valor: String(stats.comandos) },
    { label: 'ACTIVIDAD', valor: stats.uptimeTexto },
    { label: 'RAM', valor: `${stats.ram} MB` },
    { label: 'DISCO', valor: stats.disco },
    { label: 'CPU', valor: stats.cpu },
    { label: 'SISTEMA', valor: `${stats.sistema} · ${stats.node}` }
  ]

  const panelW = 860
  const panelX = (W - panelW) / 2
  const filaH = 78
  const paddingV = 30
  const panelH = filas.length * filaH + paddingV * 2
  const panelY = tituloY + 120

  ctx.fillStyle = panel
  roundRect(ctx, panelX, panelY, panelW, panelH, 26)
  ctx.fill()
  ctx.strokeStyle = borde
  ctx.lineWidth = 1.5
  roundRect(ctx, panelX, panelY, panelW, panelH, 26)
  ctx.stroke()

  const innerX = panelX + 44
  const innerRight = panelX + panelW - 44

  filas.forEach((f, i) => {
    const y = panelY + paddingV + i * filaH
    const yTextoBase = y + filaH / 2 + 8

    // Punto de acento minimalista (alterna amarillo/rojo)
    ctx.beginPath()
    ctx.arc(innerX, yTextoBase - 7, 5, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 === 0 ? amarillo : rojo
    ctx.fill()

    // Label
    ctx.textAlign = 'left'
    ctx.font = '600 19px sans-serif'
    ctx.fillStyle = gris
    ctx.fillText(espaciar(f.label, ' '), innerX + 22, yTextoBase)

    // Valor, alineado a la derecha
    ctx.textAlign = 'right'
    ctx.font = 'bold 27px sans-serif'
    ctx.fillStyle = blanco
    let valorTexto = f.valor
    const maxAncho = panelW - 280
    while (ctx.measureText(valorTexto).width > maxAncho && valorTexto.length > 3) {
      valorTexto = valorTexto.slice(0, -1)
    }
    if (valorTexto !== f.valor) valorTexto = valorTexto.slice(0, -1) + '…'
    ctx.fillText(valorTexto, innerRight, yTextoBase)

    // Separador (excepto en la última fila)
    if (i < filas.length - 1) {
      ctx.strokeStyle = separador
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(innerX, y + filaH)
      ctx.lineTo(innerRight, y + filaH)
      ctx.stroke()
    }
  })

  // ── 7) Pie de página, discreto y centrado ──
  const footerY = panelY + panelH + 60
  ctx.textAlign = 'center'
  ctx.font = '400 17px sans-serif'
  ctx.fillStyle = gris
  ctx.fillText(formatFechaHora(new Date()), cx, footerY)

  ctx.font = '700 20px sans-serif'
  ctx.fillStyle = amarillo
  ctx.fillText('SAITAMA BOT', cx, footerY + 34)

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
