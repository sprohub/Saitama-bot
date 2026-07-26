import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { createCanvas } from '@napi-rs/canvas'

const run = (cmd) => new Promise((resolve, reject) =>
  exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) =>
    err ? reject(Object.assign(err, { stdout, stderr })) : resolve(stdout.trim())
  )
)

function isOwner(m) {
  const number = m.sender?.split('@')[0]
  const owners = (global.owner || []).map(([num]) => num.replace(/[^0-9]/g, ''))
  return m.fromMe || owners.includes(number)
}

// ═══════════════════════════════════════════
//  1) ESCANEO DE SINTAXIS DE TODOS LOS PLUGINS
// ═══════════════════════════════════════════
function listarArchivosJs(dir, acc = []) {
  let entradas = []
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entrada of entradas) {
    const ruta = path.join(dir, entrada.name)
    if (entrada.isDirectory()) {
      listarArchivosJs(ruta, acc)
    } else if (entrada.isFile() && entrada.name.endsWith('.js')) {
      acc.push(ruta)
    }
  }
  return acc
}

async function verificarSintaxis(archivo) {
  try {
    await run(`node --check "${archivo}"`)
    return { archivo, ok: true }
  } catch (e) {
    const mensaje = (e.stderr || e.message || '').toString()
    // Toma solo la primera línea útil del error (evita volcar el stack completo)
    const primeraLinea = mensaje.split('\n').find(l => l.trim().length > 0) || mensaje
    return { archivo, ok: false, error: primeraLinea.trim().slice(0, 160) }
  }
}

async function escanearPlugins(directorioBase = './plugins') {
  const archivos = listarArchivosJs(directorioBase)
  const resultados = await Promise.all(archivos.map(verificarSintaxis))
  const errores = resultados.filter(r => !r.ok)
  const ok = resultados.filter(r => r.ok)
  return { total: resultados.length, ok, errores }
}

// ═══════════════════════════════════════════
//  2) ÚLTIMOS ERRORES REALES DEL PROCESO (vía PM2)
// ═══════════════════════════════════════════
async function obtenerErroresPM2(nombreProceso, cantidadLineas = 40) {
  let lista
  try {
    const salida = await run('pm2 jlist')
    lista = JSON.parse(salida)
  } catch {
    return { disponible: false, motivo: 'PM2 no disponible o sin procesos corriendo' }
  }

  if (!lista.length) return { disponible: false, motivo: 'No hay procesos de PM2 activos' }

  const proceso = nombreProceso
    ? lista.find(p => p.name === nombreProceso)
    : lista[0]

  if (!proceso) return { disponible: false, motivo: `No se encontró el proceso "${nombreProceso}"` }

  const logPath = proceso.pm2_env?.pm_err_log_path
  if (!logPath || !fs.existsSync(logPath)) {
    return { disponible: false, motivo: 'No se encontró el archivo de log de errores' }
  }

  const contenido = fs.readFileSync(logPath, 'utf8')
  const lineas = contenido.split('\n').filter(l => l.trim().length > 0)
  const ultimas = lineas.slice(-cantidadLineas)

  // Colapsa líneas idénticas consecutivas para no mostrar spam repetido
  const colapsadas = []
  for (const linea of ultimas) {
    const anterior = colapsadas[colapsadas.length - 1]
    if (anterior && anterior.texto === linea) {
      anterior.veces++
    } else {
      colapsadas.push({ texto: linea, veces: 1 })
    }
  }

  return { disponible: true, appName: proceso.name, lineas: colapsadas }
}

// ═══════════════════════════════════════════
//  DISEÑO — estilo TERMINAL / DIAGNÓSTICO (rojo sobre negro)
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

function lineasScan(ctx, W, H, color) {
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = color
  for (let y = 0; y < H; y += 4) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.restore()
}

function barraAscii(ctx, x, y, w, porcentaje, colorLleno) {
  const totalSegmentos = 30
  const segmentosLlenos = Math.round(totalSegmentos * Math.min(1, Math.max(0, porcentaje)))
  const segW = w / totalSegmentos
  for (let i = 0; i < totalSegmentos; i++) {
    ctx.fillStyle = i < segmentosLlenos ? colorLleno : 'rgba(255,90,90,0.12)'
    ctx.fillRect(x + i * segW, y, segW - 2, 22)
  }
}

function recortarTexto(ctx, texto, maxAncho) {
  let t = texto
  while (ctx.measureText(t).width > maxAncho && t.length > 3) {
    t = t.slice(0, -2)
  }
  return t === texto ? t : t + '…'
}

async function generarImagenErrores({ scan, pm2Info }) {
  const W = 1150
  const H = 800
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const rojo = '#ff4d4d'
  const rojoClaro = '#ffb3b3'
  const verde = '#4ade80'
  const ambar = '#ffcc66'

  ctx.fillStyle = '#040202'
  ctx.fillRect(0, 0, W, H)
  lineasScan(ctx, W, H, rojo)

  const glow = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W)
  glow.addColorStop(0, 'rgba(255,77,77,0.05)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const pad = 50
  ctx.strokeStyle = 'rgba(255,77,77,0.4)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2)
  dibujarEsquinasHUD(ctx, pad, pad, W - pad * 2, H - pad * 2, 34, rojo)

  const marginX = pad + 40

  // Barra de título terminal
  const puntoY = pad + 42
  ;['#ff5f56', '#ffcc66', '#4ade80'].forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(marginX + i * 26, puntoY, 8, 0, Math.PI * 2)
    ctx.fill()
  })

  ctx.font = '20px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.textAlign = 'right'
  ctx.fillText('saitama@server: diagnostics --scan', W - marginX, puntoY + 6)

  ctx.textAlign = 'left'
  ctx.font = 'bold 30px monospace'
  ctx.fillStyle = rojo
  ctx.fillText('root@saitama-bot', marginX, pad + 100)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText(':~$', marginX + ctx.measureText('root@saitama-bot').width + 10, pad + 100)

  ctx.font = 'bold 44px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('> ERROR REPORT', marginX, pad + 150)

  const hayErroresSintaxis = scan.errores.length > 0
  ctx.font = '20px monospace'
  ctx.fillStyle = hayErroresSintaxis ? rojoClaro : verde
  ctx.fillText(
    hayErroresSintaxis
      ? `[!] ${scan.errores.length} plugin(s) con errores de sintaxis`
      : '[ok] todos los plugins pasan la verificación',
    marginX, pad + 180
  )

  ctx.strokeStyle = 'rgba(255,77,77,0.25)'
  ctx.beginPath()
  ctx.moveTo(marginX, pad + 205)
  ctx.lineTo(W - marginX, pad + 205)
  ctx.stroke()

  // ── Barra de salud de plugins ──
  let y = pad + 245
  const porcentajeOk = scan.total ? scan.ok.length / scan.total : 1
  ctx.font = 'bold 22px monospace'
  ctx.fillStyle = verde
  ctx.fillText(`PLUGINS OK  ${scan.ok.length} / ${scan.total}`, marginX, y)
  y += 16
  barraAscii(ctx, marginX, y, W - marginX * 2, porcentajeOk, hayErroresSintaxis ? ambar : verde)
  y += 50

  // ── Lista de plugins con error de sintaxis ──
  ctx.font = 'bold 20px monospace'
  ctx.fillStyle = rojo
  ctx.fillText('ARCHIVOS CON ERROR:', marginX, y)
  y += 32

  ctx.font = '17px monospace'
  if (scan.errores.length) {
    scan.errores.slice(0, 4).forEach(e => {
      ctx.fillStyle = rojoClaro
      const nombre = path.basename(e.archivo)
      ctx.fillText(`✗ ${nombre}`, marginX, y)
      y += 24
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(recortarTexto(ctx, `  ${e.error}`, W - marginX * 2), marginX, y)
      y += 30
    })
    if (scan.errores.length > 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fillText(`  (+${scan.errores.length - 4} más — revisa el log completo)`, marginX, y)
      y += 30
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('  (ninguno)', marginX, y)
    y += 30
  }

  y += 10
  ctx.strokeStyle = 'rgba(255,77,77,0.25)'
  ctx.beginPath()
  ctx.moveTo(marginX, y)
  ctx.lineTo(W - marginX, y)
  ctx.stroke()
  y += 36

  // ── Últimos errores reales del proceso (PM2) ──
  ctx.font = 'bold 20px monospace'
  ctx.fillStyle = ambar
  ctx.fillText(
    pm2Info.disponible ? `LOG DE ERRORES — ${pm2Info.appName}` : 'LOG DE ERRORES',
    marginX, y
  )
  y += 30

  ctx.font = '16px monospace'
  if (pm2Info.disponible && pm2Info.lineas.length) {
    const maxLineasMostrar = 6
    pm2Info.lineas.slice(-maxLineasMostrar).forEach(l => {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      const sufijo = l.veces > 1 ? `  (x${l.veces})` : ''
      ctx.fillText(recortarTexto(ctx, l.texto + sufijo, W - marginX * 2), marginX, y)
      y += 24
    })
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText(`  (${pm2Info.motivo || 'sin datos disponibles'})`, marginX, y)
    y += 24
  }

  ctx.fillStyle = rojo
  ctx.fillRect(marginX, H - pad - 46, 14, 26)
  ctx.font = '18px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.textAlign = 'right'
  ctx.fillText('SAITAMA-BOT // ERROR DIAGNOSTICS', W - marginX, H - pad - 26)

  return canvas.toBuffer('image/png')
}

// ───────────────────────────────────────────
// Comando .errores [nombreProcesoPM2]
// ───────────────────────────────────────────
let handler = async (m, { conn, text }) => {
  if (!isOwner(m)) {
    return m.reply('╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar este comando.\n╰───────────────⬣')
  }

  await m.reply('⏳ Escaneando plugins y revisando el log de errores...')

  try {
    const nombreProceso = text?.trim() || null
    const [scan, pm2Info] = await Promise.all([
      escanearPlugins('./plugins'),
      obtenerErroresPM2(nombreProceso)
    ])

    const imagenBuffer = await generarImagenErrores({ scan, pm2Info })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: '「 🩺 SAITAMA-BOT · ERROR REPORT 」'
    }, { quoted: m })
  } catch (e) {
    console.error('[errores] Error generando el reporte:', e)
    await m.reply(`❌ No se pudo generar el reporte de errores.\nDetalle: ${e.message}`)
  }
}

handler.help = ['errores [proceso]']
handler.tags = ['owner']
handler.command = /^(errores|errors|checkplugins)$/i
handler.desc = 'Escanea plugins con errores de sintaxis y muestra el log real de errores del bot (PM2)'
handler.owner = true

export default handler
