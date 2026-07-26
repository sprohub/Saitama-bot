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
//  DISEÑO — dashboard limpio (fondo plano, sin efectos recargados)
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

function barraPlana(ctx, x, y, w, h, porcentaje, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, x, y, w, h, h / 2)
  ctx.fill()

  const ancho = Math.max(h, w * Math.min(1, Math.max(0, porcentaje)))
  ctx.fillStyle = color
  roundRect(ctx, x, y, ancho, h, h / 2)
  ctx.fill()
}

function recortarTexto(ctx, texto, maxAncho) {
  let t = texto
  while (ctx.measureText(t).width > maxAncho && t.length > 3) {
    t = t.slice(0, -2)
  }
  return t === texto ? t : t + '…'
}

function chip(ctx, x, y, texto, colorFondo, colorTexto) {
  ctx.font = 'bold 20px sans-serif'
  const ancho = ctx.measureText(texto).width + 36
  ctx.fillStyle = colorFondo
  roundRect(ctx, x, y, ancho, 40, 20)
  ctx.fill()
  ctx.fillStyle = colorTexto
  ctx.textAlign = 'left'
  ctx.fillText(texto, x + 18, y + 27)
  return ancho
}

/**
 * Genera la tarjeta de reporte de errores, con altura dinámica
 * para poder mostrar TODOS los archivos que fallan (sin recortar la lista).
 */
async function generarImagenErrores({ scan, pm2Info }) {
  const W = 1000
  const marginX = 60

  const fondo = '#111418'
  const panel = '#181c22'
  const texto = '#f2f4f7'
  const gris = '#8b95a1'
  const rojo = '#ff5c5c'
  const rojoSuave = 'rgba(255,92,92,0.12)'
  const verde = '#3ddc84'
  const verdeSuave = 'rgba(61,220,132,0.12)'
  const ambar = '#ffb454'

  const lineasLog = pm2Info.disponible ? pm2Info.lineas.slice(-8) : []

  // ── Altura dinámica según cuántos errores/lineas hay que mostrar ──
  let H = 340 // cabecera + stats + barra
  H += 50 // título sección archivos
  if (scan.errores.length === 0) {
    H += 60
  } else {
    H += scan.errores.length * 78
  }
  H += 60 // título sección log
  H += lineasLog.length ? lineasLog.length * 26 + 20 : 50
  H += 70 // footer

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Fondo plano
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, W, H)

  let y = 60

  // ── Encabezado ──
  ctx.textAlign = 'left'
  ctx.fillStyle = gris
  ctx.font = '20px sans-serif'
  ctx.fillText('SAITAMA-BOT', marginX, y)
  y += 42

  ctx.fillStyle = texto
  ctx.font = 'bold 42px sans-serif'
  ctx.fillText('Reporte de errores', marginX, y)
  y += 50

  // ── Chips de resumen ──
  let x = marginX
  x += chip(ctx, x, y, `${scan.total} plugins`, panel, texto) + 14
  x += chip(ctx, x, y, `${scan.ok.length} ok`, verdeSuave, verde) + 14
  chip(ctx, x, y, `${scan.errores.length} con error`, scan.errores.length ? rojoSuave : panel, scan.errores.length ? rojo : gris)
  y += 70

  // ── Barra de salud ──
  const porcentajeOk = scan.total ? scan.ok.length / scan.total : 1
  barraPlana(ctx, marginX, y, W - marginX * 2, 10, porcentajeOk, scan.errores.length ? ambar : verde)
  y += 46

  // ── Línea divisoria ──
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(marginX, y)
  ctx.lineTo(W - marginX, y)
  ctx.stroke()
  y += 44

  // ── Sección: archivos con error (TODOS, sin recortar la lista) ──
  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = texto
  ctx.fillText('Archivos con error', marginX, y)
  y += 36

  if (scan.errores.length === 0) {
    ctx.font = '20px sans-serif'
    ctx.fillStyle = verde
    ctx.fillText('✓ Ningún plugin tiene errores de sintaxis', marginX, y)
    y += 40
  } else {
    for (const e of scan.errores) {
      // Tarjeta individual por archivo
      const alturaFila = 66
      ctx.fillStyle = panel
      roundRect(ctx, marginX, y - 28, W - marginX * 2, alturaFila, 14)
      ctx.fill()

      // Punto rojo indicador
      ctx.fillStyle = rojo
      ctx.beginPath()
      ctx.arc(marginX + 26, y - 2, 6, 0, Math.PI * 2)
      ctx.fill()

      ctx.font = 'bold 20px sans-serif'
      ctx.fillStyle = texto
      ctx.fillText(path.basename(e.archivo), marginX + 48, y - 4)

      ctx.font = '16px monospace'
      ctx.fillStyle = gris
      ctx.fillText(recortarTexto(ctx, e.error, W - marginX * 2 - 60), marginX + 48, y + 22)

      y += alturaFila + 12
    }
  }

  y += 20

  // ── Línea divisoria ──
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(marginX, y)
  ctx.lineTo(W - marginX, y)
  ctx.stroke()
  y += 44

  // ── Sección: últimos errores reales del proceso (PM2) ──
  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = texto
  ctx.fillText(
    pm2Info.disponible ? `Log de errores — ${pm2Info.appName}` : 'Log de errores',
    marginX, y
  )
  y += 34

  if (lineasLog.length) {
    ctx.font = '15px monospace'
    for (const l of lineasLog) {
      ctx.fillStyle = gris
      const sufijo = l.veces > 1 ? `  ×${l.veces}` : ''
      ctx.fillText(recortarTexto(ctx, l.texto + sufijo, W - marginX * 2), marginX, y)
      y += 26
    }
  } else {
    ctx.font = '17px sans-serif'
    ctx.fillStyle = gris
    ctx.fillText(pm2Info.motivo || 'Sin datos disponibles', marginX, y)
    y += 30
  }

  // ── Footer ──
  ctx.font = '15px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.textAlign = 'right'
  ctx.fillText('Saitama-Bot · Error Report', W - marginX, H - 34)

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
