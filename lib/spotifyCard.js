/**
 * lib/spotifyCard.js
 *
 * Genera una tarjeta visual estilo "disco de vinilo" para los
 * resultados de Spotify, con la portada del álbum, título, artista,
 * y una paleta de color pastel-oscuro que se adapta automáticamente
 * al color dominante de la portada.
 *
 * Usa @napi-rs/canvas (tiene binario precompilado para android-arm64,
 * a diferencia de sharp/node-canvas clásico, que no lo tienen).
 */

import { createCanvas, loadImage } from '@napi-rs/canvas'

const ANCHO = 1000
const ALTO = 460

// 🎨 10 paletas pastel oscuras — cada una: [fondo1, fondo2, acento, textoSecundario]
const PALETAS = [
  { nombre: 'ciruela',   fondo: ['#241623', '#3a2440'], acento: '#e6a4b4', texto: '#b9a2b8' },
  { nombre: 'bosque',    fondo: ['#16231d', '#233d2f'], acento: '#a8d5ba', texto: '#9db6a8' },
  { nombre: 'oceano',    fondo: ['#141d2b', '#1f3350'], acento: '#8fc1e3', texto: '#93a8bd' },
  { nombre: 'vino',      fondo: ['#241417', '#3d1f26'], acento: '#e08c9b', texto: '#b89197' },
  { nombre: 'mostaza',   fondo: ['#231d13', '#3d331f'], acento: '#e8c27a', texto: '#b8ab8f' },
  { nombre: 'lavanda',   fondo: ['#1e1a2b', '#302a49'], acento: '#c4aee3', texto: '#a89dbd' },
  { nombre: 'terracota', fondo: ['#241813', '#402a1f'], acento: '#e3a077', texto: '#bd9b8f' },
  { nombre: 'menta',     fondo: ['#131f1e', '#1f3936'], acento: '#8fe0cf', texto: '#8fb8b0' },
  { nombre: 'coral',     fondo: ['#251617', '#402124'], acento: '#f0968f', texto: '#c09b98' },
  { nombre: 'grafito',   fondo: ['#1a1a1e', '#2c2c33'], acento: '#b8b8c4', texto: '#96969e' }
]

// Elige la paleta más cercana al color dominante de la portada
function elegirPaleta(r, g, b) {
  // Convertimos el color dominante a "matiz" (hue) aproximado para comparar
  const hue = rgbAHue(r, g, b)
  const huesDePaleta = PALETAS.map(p => rgbAHue(...hexARgb(p.acento)))

  let mejorIndice = 0
  let mejorDistancia = Infinity
  huesDePaleta.forEach((h, i) => {
    let dist = Math.abs(h - hue)
    dist = Math.min(dist, 360 - dist) // distancia circular
    if (dist < mejorDistancia) {
      mejorDistancia = dist
      mejorIndice = i
    }
  })
  return PALETAS[mejorIndice]
}

function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbAHue(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0
  const d = max - min
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return h
}

// Calcula el color promedio de una imagen ya cargada en canvas
function colorPromedio(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h)
  let r = 0, g = 0, b = 0, total = 0
  const paso = 8 // muestreamos cada 8 píxeles para que sea rápido
  for (let i = 0; i < data.length; i += 4 * paso) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]
    total++
  }
  return [r / total, g / total, b / total]
}

function dibujarRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function recortarTexto(ctx, texto, maxAncho) {
  if (ctx.measureText(texto).width <= maxAncho) return texto
  let recortado = texto
  while (ctx.measureText(recortado + '…').width > maxAncho && recortado.length > 0) {
    recortado = recortado.slice(0, -1)
  }
  return recortado + '…'
}

/**
 * Genera la tarjeta como buffer PNG.
 * @param {object} datos
 * @param {string} datos.imagenUrl - URL de la portada del álbum
 * @param {string} datos.titulo
 * @param {string} datos.artista
 * @param {string} [datos.album]
 * @param {string} [datos.duracion] - ej: "3:24"
 * @returns {Promise<Buffer>}
 */
export async function generarTarjetaSpotify({ imagenUrl, titulo, artista, album, duracion }) {
  const canvas = createCanvas(ANCHO, ALTO)
  const ctx = canvas.getContext('2d')

  const portada = await loadImage(imagenUrl)

  // Color dominante de la portada (para elegir paleta)
  const muestreo = createCanvas(64, 64)
  const mctx = muestreo.getContext('2d')
  mctx.drawImage(portada, 0, 0, 64, 64)
  const [r, g, b] = colorPromedio(mctx, 64, 64)
  const paleta = elegirPaleta(r, g, b)

  // --- Fondo con degradado ---
  const grad = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  grad.addColorStop(0, paleta.fondo[0])
  grad.addColorStop(1, paleta.fondo[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, ANCHO, ALTO)

  // --- Disco de vinilo (círculo grande, semi-oculto a la izquierda) ---
  const cxVinilo = 230
  const cyVinilo = ALTO / 2
  const rVinilo = 210

  ctx.save()
  ctx.beginPath()
  ctx.arc(cxVinilo, cyVinilo, rVinilo, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fill()

  // Surcos del vinilo
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  for (let radio = 60; radio < rVinilo; radio += 14) {
    ctx.beginPath()
    ctx.arc(cxVinilo, cyVinilo, radio, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  // Portada en el centro del vinilo
  const rPortada = 118
  ctx.save()
  ctx.beginPath()
  ctx.arc(cxVinilo, cyVinilo, rPortada, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(portada, cxVinilo - rPortada, cyVinilo - rPortada, rPortada * 2, rPortada * 2)
  ctx.restore()

  // Agujero central
  ctx.beginPath()
  ctx.arc(cxVinilo, cyVinilo, 14, 0, Math.PI * 2)
  ctx.fillStyle = paleta.fondo[0]
  ctx.fill()

  // --- Textos (título, artista, álbum/duración) ---
  const xTexto = 470
  const maxAnchoTexto = ANCHO - xTexto - 60

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = paleta.acento
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(recortarTexto(ctx, titulo, maxAnchoTexto), xTexto, 170)

  ctx.fillStyle = paleta.texto
  ctx.font = '30px sans-serif'
  ctx.fillText(recortarTexto(ctx, artista, maxAnchoTexto), xTexto, 215)

  if (album || duracion) {
    ctx.font = '22px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    const linea = [album, duracion].filter(Boolean).join('  •  ')
    ctx.fillText(recortarTexto(ctx, linea, maxAnchoTexto), xTexto, 255)
  }

  // --- Barra de progreso decorativa ---
  const yBarra = 340
  dibujarRedondeado(ctx, xTexto, yBarra, maxAnchoTexto, 6, 3)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fill()
  dibujarRedondeado(ctx, xTexto, yBarra, maxAnchoTexto * 0.35, 6, 3)
  ctx.fillStyle = paleta.acento
  ctx.fill()

  // --- Íconos de control (decorativos) ---
  const yIconos = 400
  ctx.fillStyle = paleta.acento
  dibujarIconoPausa(ctx, xTexto + maxAnchoTexto / 2, yIconos)
  dibujarTrianguloAtras(ctx, xTexto + maxAnchoTexto / 2 - 70, yIconos)
  dibujarTrianguloAdelante(ctx, xTexto + maxAnchoTexto / 2 + 70, yIconos)

  // --- Marca del bot, discreta ---
  ctx.font = '18px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillText('🌿 SAITAMA-BOT', xTexto, ALTO - 30)

  return canvas.toBuffer('image/png')
}

function dibujarIconoPausa(ctx, cx, cy) {
  ctx.fillRect(cx - 14, cy - 14, 9, 28)
  ctx.fillRect(cx + 5, cy - 14, 9, 28)
}

function dibujarTrianguloAtras(ctx, cx, cy) {
  ctx.beginPath()
  ctx.moveTo(cx + 12, cy - 14)
  ctx.lineTo(cx - 12, cy)
  ctx.lineTo(cx + 12, cy + 14)
  ctx.closePath()
  ctx.fill()
}

function dibujarTrianguloAdelante(ctx, cx, cy) {
  ctx.beginPath()
  ctx.moveTo(cx - 12, cy - 14)
  ctx.lineTo(cx + 12, cy)
  ctx.lineTo(cx - 12, cy + 14)
  ctx.closePath()
  ctx.fill()
}
