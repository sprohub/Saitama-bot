import { exec } from 'child_process'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const BANNER = 'https://i.ibb.co/jkhp8BZD/wof.jpg'

// ── Helpers de comandos/texto (sin cambios) ──────────────────────────────
const run = (cmd) => new Promise((resolve, reject) =>
  exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) =>
    err ? reject(err) : resolve(stdout.trim())
  )
)

const react = (conn, m, emoji) =>
  conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })

const marco = (titulo, body) =>
`╭━━⬣ ✦ *SAITAMA BOT* ✦
│
│  ${titulo}
│
${body}
╰━━━━━━━━━━━━━━━━━━━━━━⬣`

const parseGitOutput = (stdout) => {
  const creados    = (stdout.match(/create mode \d+ (.+)/g) || []).map(c => c.split(' ').pop())
  const eliminados = (stdout.match(/delete mode \d+ (.+)/g) || []).map(c => c.split(' ').pop())
  const changedMatch = stdout.match(/(\d+) files? changed/)
  const summary      = stdout.match(/\d+ files? changed, \d+ insertions?\(\+\), \d+ deletions?\(-\)/)
  const summaryNums  = summary ? summary[0].match(/\d+/g) : null

  return {
    creados,
    eliminados,
    archivosModificados: changedMatch ? changedMatch[1] : null,
    lineasAgregadas:     summaryNums  ? summaryNums[1]  : null,
    lineasEliminadas:    summaryNums  ? summaryNums[2]  : null
  }
}

const buildList = (title, items) => {
  if (!items.length) return ''
  return `│  ${title}\n` + items.map(f => `│   ⫸ ${f}`).join('\n') + '\n│\n'
}

// ═══════════════════════════════════════════
//  PLANTILLA VISUAL — tarjeta de actualización (estilo Saitama Power)
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

async function cargarImagenSegura(fuente) {
  try {
    if (!fuente) return null
    return await loadImage(fuente)
  } catch {
    return null
  }
}

// Pseudo-blur: reduce y agranda la imagen varias veces (rápido, sin dependencias nativas)
function dibujarFondoDesenfocado(ctx, img, W, H) {
  const off = createCanvas(W, H)
  const octx = off.getContext('2d')
  const escala = Math.max(W / img.width, H / img.height)
  const iw = img.width * escala
  const ih = img.height * escala
  octx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih)

  let src = off
  for (const factor of [0.5, 0.25, 0.12]) {
    const sw = Math.max(1, Math.round(W * factor))
    const sh = Math.max(1, Math.round(H * factor))
    const small = createCanvas(sw, sh)
    const sctx = small.getContext('2d')
    sctx.imageSmoothingEnabled = true
    sctx.drawImage(src, 0, 0, sw, sh)

    const back = createCanvas(W, H)
    const bctx = back.getContext('2d')
    bctx.imageSmoothingEnabled = true
    bctx.drawImage(small, 0, 0, W, H)
    src = back
  }
  ctx.drawImage(src, 0, 0, W, H)
}

// Pequeño "commit graph": dos nodos unidos por una línea, con los hashes antes/después
function dibujarCommitGraph(ctx, x, y, w, hashAntes, hashDespues, amarillo) {
  const puntoR = 10
  const x1 = x
  const x2 = x + w

  ctx.strokeStyle = 'rgba(255,210,63,0.4)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()

  // Nodo anterior (hueco)
  ctx.beginPath()
  ctx.arc(x1, y, puntoR, 0, Math.PI * 2)
  ctx.fillStyle = '#0d1b2a'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Nodo nuevo (relleno, con glow)
  ctx.save()
  ctx.shadowColor = amarillo
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(x2, y, puntoR + 1, 0, Math.PI * 2)
  ctx.fillStyle = amarillo
  ctx.fill()
  ctx.restore()

  ctx.font = '18px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.textAlign = 'left'
  ctx.fillText(hashAntes, x1, y - 20)
  ctx.textAlign = 'right'
  ctx.fillStyle = amarillo
  ctx.fillText(hashDespues, x2, y - 20)
}

/**
 * Genera la tarjeta de actualización.
 * datos.estado: 'actualizado' | 'al_dia'
 */
async function generarImagenUpdate(datos) {
  const W = 1200
  const H = 700
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#ffd23f'
  const amarilloClaro = '#ffe98a'

  // ── Fondo: banner desenfocado + degradado oscuro encima ──
  const banner = await cargarImagenSegura(BANNER)
  if (banner) {
    dibujarFondoDesenfocado(ctx, banner, W, H)
    ctx.fillStyle = 'rgba(6,13,22,0.78)'
    ctx.fillRect(0, 0, W, H)
  } else {
    const gradFondo = ctx.createLinearGradient(0, 0, W, H)
    gradFondo.addColorStop(0, '#060d16')
    gradFondo.addColorStop(1, '#0d1b2a')
    ctx.fillStyle = gradFondo
    ctx.fillRect(0, 0, W, H)
  }

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
  const badgeTexto = datos.estado === 'al_dia' ? '✅ AL DÍA' : '⚡ SAITAMA POWER'
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
  ctx.fillText(`Rama ${datos.rama}`, W - marginX, 96)

  // ── Título ──
  ctx.textAlign = 'left'
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText('SAITAMA-BOT', marginX, 158)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 52px sans-serif'
  ctx.fillText(
    datos.estado === 'al_dia' ? 'Ya estás al día' : 'Bot Actualizado',
    marginX, 218
  )

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '22px sans-serif'
  ctx.fillText(
    recortarTexto(ctx, `"${datos.commitMsg || 'sin descripción'}"`, W - marginX * 2),
    marginX, 254
  )

  // ── Commit graph (antes -> después) ──
  dibujarCommitGraph(ctx, marginX, 300, W - marginX * 2, datos.hashAntes, datos.hashDespues, amarillo)

  if (datos.estado === 'al_dia') {
    // ── Vista simplificada: una sola tarjeta con info general ──
    const cardY = 360
    const cardH = 210
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, marginX, cardY, W - marginX * 2, cardH, 22)
    ctx.fill()

    ctx.fillStyle = amarilloClaro
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('VERSIÓN ACTUAL', marginX + 34, cardY + 46)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText(datos.versionAntes, marginX + 34, cardY + 100)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '20px sans-serif'
    ctx.fillText(`Último commit: ${datos.ultimoCommitCuando}`, marginX + 34, cardY + 140)
    ctx.fillText('No hay cambios nuevos en el repositorio remoto', marginX + 34, cardY + 168)
  } else {
    // ── Dos tarjetas grandes: VERSIÓN / ARCHIVOS ──
    const cardY = 360
    const cardH = 150
    const cardW = (W - marginX * 2 - 30) / 2
    const card1X = marginX
    const card2X = marginX + cardW + 30

    // Card versión
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, card1X, cardY, cardW, cardH, 22)
    ctx.fill()
    ctx.fillStyle = amarilloClaro
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('VERSIÓN', card1X + 34, cardY + 42)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 34px sans-serif'
    ctx.fillText(`${datos.versionAntes} → ${datos.versionDespues}`, card1X + 34, cardY + 92)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '18px sans-serif'
    ctx.fillText(`Hace ${datos.ultimoCommitCuando}`, card1X + 34, cardY + cardH - 20)

    // Card archivos
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, card2X, cardY, cardW, cardH, 22)
    ctx.fill()
    ctx.fillStyle = amarilloClaro
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('ARCHIVOS', card2X + 34, cardY + 42)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 34px sans-serif'
    const totalArchivos = datos.archivosModificados || '0'
    ctx.fillText(`${totalArchivos} modificado(s)`, card2X + 34, cardY + 92)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '18px sans-serif'
    ctx.fillText(
      `${datos.creados.length} nuevos · ${datos.eliminados.length} eliminados`,
      card2X + 34, cardY + cardH - 20
    )

    // ── Fila inferior: LÍNEAS AGREGADAS / ELIMINADAS con barra comparativa ──
    const filaY = cardY + cardH + 30
    const filaH = 130
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, marginX, filaY, W - marginX * 2, filaH, 22)
    ctx.fill()

    ctx.fillStyle = amarilloClaro
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('CAMBIOS EN EL CÓDIGO', marginX + 34, filaY + 40)

    const agregadas = parseInt(datos.lineasAgregadas || '0', 10)
    const eliminadas = parseInt(datos.lineasEliminadas || '0', 10)
    const totalLineas = agregadas + eliminadas || 1
    const porcAgregadas = agregadas / totalLineas

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px sans-serif'
    ctx.fillText(`+${agregadas}`, marginX + 34, filaY + 82)
    ctx.fillStyle = '#ff6b6b'
    ctx.fillText(`  -${eliminadas}`, marginX + 34 + ctx.measureText(`+${agregadas}`).width, filaY + 82)

    barraProgreso(ctx, marginX + 34, filaY + 96, W - marginX * 2 - 68, 12, porcAgregadas, '#ffd23f', '#4ade80')
  }

  return canvas.toBuffer('image/png')
}

// ── Handler ───────────────────────────────────────────
const handler = async (m, { conn }) => {
  const who = m.sender

  await react(conn, m, '⏳')

  await conn.sendMessage(m.chat, {
    text: marco('⏳ _Iniciando actualización..._',
`│  ⫸ Verificando repositorio
│     ↳ _Espera un momento..._`)
  }, { quoted: m })

  try {
    // ── 1. Info ANTES del pull ─────────────────────────
    let hashAntes, versionAntes, ultimoCommitCuando, rama

    try {
      hashAntes          = await run('git rev-parse --short HEAD')
      versionAntes       = await run('git describe --tags --abbrev=0 2>/dev/null || echo "sin-tag"')
      ultimoCommitCuando = await run('git log -1 --pretty=%cr')
      rama               = await run('git branch --show-current')
    } catch {
      hashAntes          = 'unknown'
      versionAntes       = 'sin-tag'
      ultimoCommitCuando = 'desconocido'
      rama               = 'main'
    }

    // ── 2. Verificar conflictos ────────────────────────
    const statusOutput    = await run('git status --porcelain')
    const tieneConflictos = statusOutput
      .split('\n')
      .some(l => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('DD'))

    if (tieneConflictos) {
      await react(conn, m, '⚠️')

      const archivos = statusOutput
        .split('\n')
        .filter(l => l.startsWith('UU') || l.startsWith('AA'))
        .map(l => `│   ⫸ ${l.slice(3)}`)
        .join('\n')

      return conn.sendMessage(m.chat, {
        text: marco('⚠️ _Conflictos detectados_',
`│  ⫸ Pull cancelado por seguridad
│     ↳ _Resuelve los conflictos primero_
│
${archivos}
│
│  ⫸ Solución
│     ↳ _git checkout -- . && git pull_`)
      }, { quoted: m })
    }

    // ── 3. Auto stash si hay cambios locales ───────────
    const hayLocales = statusOutput.trim().length > 0
    if (hayLocales) await run('git stash')

    // ── 4. Git pull ────────────────────────────────────
    const stdout = await run('git pull')

    if (hayLocales) {
      try { await run('git stash pop') } catch { /* ignorar */ }
    }

    // ── 5. Ya estaba al día ────────────────────────────
    if (stdout.includes('Already up to date')) {
      await react(conn, m, '✅')

      const imagenBuffer = await generarImagenUpdate({
        estado: 'al_dia',
        rama,
        versionAntes,
        hashAntes,
        hashDespues: hashAntes,
        ultimoCommitCuando,
        commitMsg: null
      })

      return conn.sendMessage(m.chat, {
        image: imagenBuffer,
        caption: marco('✅ _Sin cambios_',
`│  ⫸ El bot ya está al día
│
│  ⫸ Rama     — ${rama}
│  ⫸ Versión  — ${versionAntes} _(${hashAntes})_
│  ⫸ Último   — _${ultimoCommitCuando}_
│
│  👤 @${who.split('@')[0]}`),
        mentions: [who]
      }, { quoted: m })
    }

    // ── 6. Actualización exitosa ───────────────────────
    await react(conn, m, '✅')

    let hashDespues, versionDespues, commitMsg
    try {
      hashDespues    = await run('git rev-parse --short HEAD')
      versionDespues = await run('git describe --tags --abbrev=0 2>/dev/null || echo "sin-tag"')
      commitMsg      = await run('git log -1 --pretty=%s')
    } catch {
      hashDespues    = 'unknown'
      versionDespues = 'sin-tag'
      commitMsg      = 'sin descripción'
    }

    const { creados, eliminados, archivosModificados, lineasAgregadas, lineasEliminadas } = parseGitOutput(stdout)

    let body = ''
    body += `│  ⫸ Rama     — ${rama}\n`
    body += `│  ⫸ Versión  — ${versionAntes} → *${versionDespues}*\n`
    body += `│  ⫸ Commit   — ${hashAntes} → *${hashDespues}*\n`
    body += `│  ⫸ Hace     — _${ultimoCommitCuando}_\n`
    body += `│  ⫸ Cambio   — _${commitMsg}_\n│\n`

    body += buildList('✨ Nuevos:', creados)
    body += buildList('🗑️ Eliminados:', eliminados)

    if (archivosModificados) {
      body += `│  📝 Modificados — ${archivosModificados} archivo(s)\n│\n`
    }

    if (lineasAgregadas !== null) {
      body += `│  📊 Resumen\n│   ⫸ +${lineasAgregadas} agregadas\n│   ⫸ -${lineasEliminadas} eliminadas\n│\n`
    }

    body += `│  👤 @${who.split('@')[0]}`

    const imagenBuffer = await generarImagenUpdate({
      estado: 'actualizado',
      rama,
      versionAntes,
      versionDespues,
      hashAntes,
      hashDespues,
      ultimoCommitCuando,
      commitMsg,
      creados,
      eliminados,
      archivosModificados,
      lineasAgregadas,
      lineasEliminadas
    })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: marco('🚀 _Actualización completada_', body),
      mentions: [who]
    }, { quoted: m })

    // ── 7. Aviso de reinicio manual (sin cambios) ───────
    // NOTA: se quitó el process.exit(0) automático.
    // El bot corre con "node main.js" sin gestor de procesos (PM2, etc),
    // así que matar el proceso aquí apagaba el bot por completo
    // sin que nada lo volviera a levantar.
    // Los archivos ya están actualizados en disco gracias al git pull.
    // Para aplicar los cambios en memoria, reinicia manualmente:
    //   Ctrl + C   →   node main.js
    await conn.sendMessage(m.chat, {
      text: marco('⚠️ _Reinicio manual requerido_',
`│  ⫸ Los archivos ya se actualizaron
│     ↳ _git pull aplicado con éxito_
│
│  ⫸ Para cargar los cambios
│     ↳ _Detén el bot (Ctrl + C)_
│     ↳ _y vuelve a iniciarlo_`)
    }, { quoted: m })

  } catch (err) {
    await react(conn, m, '❌')

    const error = err.message || String(err)
    const errorReplies = {
      'not a git repository':   '│  ⫸ No es un repositorio git\n│     ↳ _Clona el bot con git clone_',
      'Could not resolve host': '│  ⫸ Sin conexión a internet\n│     ↳ _Verifica tu red_',
      'Merge conflict':         '│  ⫸ Conflicto de fusión\n│     ↳ _git stash && git pull --force_',
      'Please commit':          '│  ⫸ Cambios locales sin guardar\n│     ↳ _git stash && git pull_'
    }

    const match  = Object.keys(errorReplies).find(k => error.includes(k))
    const detalle = match
      ? errorReplies[match]
      : `│  ⫸ Error inesperado\n│     ↳ _${error.slice(0, 200)}_`

    return conn.sendMessage(m.chat, {
      text: marco('❌ _Update fallido_', detalle)
    }, { quoted: m })
  }
}

handler.help = ['update', 'up']
handler.tags = ['owner']
handler.command = /^(update|actualizar|up)$/i
handler.desc = 'Actualiza saitama-bot a la última versión'
handler.owner = true

export default handler
