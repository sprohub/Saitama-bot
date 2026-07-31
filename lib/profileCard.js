/**
 * lib/profileCard.js
 *
 * Genera la tarjeta de perfil de usuario: foto, nombre, descripción,
 * con 5 estilos de plantilla distintos, cada uno recoloreable entre
 * 30 colores, y fondo personalizable (imagen propia o color sólido).
 * Usa SVG + ffmpeg (sin dependencias nativas, funciona en arm7).
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'

const execAsync = promisify(exec)

const ANCHO = 1000
const ALTO = 560

export const COLORES = [
  { nombre: 'rojo', hex: '#e63946' }, { nombre: 'coral', hex: '#ff6f61' },
  { nombre: 'naranja', hex: '#f4a261' }, { nombre: 'mostaza', hex: '#e9c46a' },
  { nombre: 'amarillo', hex: '#ffd60a' }, { nombre: 'lima', hex: '#b5e48c' },
  { nombre: 'verde', hex: '#2a9d8f' }, { nombre: 'esmeralda', hex: '#40916c' },
  { nombre: 'menta', hex: '#74c69d' }, { nombre: 'turquesa', hex: '#43aa8b' },
  { nombre: 'cian', hex: '#48cae4' }, { nombre: 'azul', hex: '#457b9d' },
  { nombre: 'celeste', hex: '#219ebc' }, { nombre: 'marino', hex: '#1d3557' },
  { nombre: 'indigo', hex: '#3a0ca3' }, { nombre: 'morado', hex: '#7209b7' },
  { nombre: 'violeta', hex: '#9d4edd' }, { nombre: 'lavanda', hex: '#c8b6ff' },
  { nombre: 'rosa', hex: '#ff70a6' }, { nombre: 'fucsia', hex: '#d90480' },
  { nombre: 'magenta', hex: '#c9184a' }, { nombre: 'vino', hex: '#800f2f' },
  { nombre: 'terracota', hex: '#bc6c25' }, { nombre: 'cafe', hex: '#6f4518' },
  { nombre: 'gris', hex: '#6c757d' }, { nombre: 'grafito', hex: '#495057' },
  { nombre: 'negro', hex: '#212529' }, { nombre: 'blanco', hex: '#f1faee' },
  { nombre: 'dorado', hex: '#ffb703' }, { nombre: 'plateado', hex: '#adb5bd' }
]

export const PLANTILLAS = [
  { key: 'clasico', nombre: '🎖️ Clásico' },
  { key: 'moderno', nombre: '🌆 Moderno' },
  { key: 'minimal', nombre: '⚪ Minimal' },
  { key: 'diagonal', nombre: '📐 Diagonal' },
  { key: 'neon', nombre: '💡 Neón' }
]

function obtenerColor(nombreOClave) {
  return COLORES.find(c => c.nombre === nombreOClave)?.hex || '#457b9d'
}

function escaparXML(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function recortar(t, max) {
  const s = String(t || '')
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// Envuelve texto largo en varias líneas (para la descripción)
function envolver(texto, maxCaracteresPorLinea, maxLineas) {
  const palabras = String(texto || '').split(' ')
  const lineas = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p
    if (prueba.length > maxCaracteresPorLinea) {
      lineas.push(actual)
      actual = p
      if (lineas.length >= maxLineas) break
    } else {
      actual = prueba
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual)
  return lineas
}

async function urlABase64(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`No se pudo descargar la imagen (status ${resp.status})`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  const mime = resp.headers.get('content-type') || 'image/jpeg'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

function bufferABase64(buffer, mime = 'image/jpeg') {
  return `data:${mime};base64,${buffer.toString('base64')}`
}

// --- Plantilla 1: Clásico — centrado, medallón, marco ---
function plantillaClasico({ color, fotoB64, fondoB64, nombre, lineasDesc }) {
  const cx = ANCHO / 2
  const cy = 210
  const r = 110
  return `
  <rect width="${ANCHO}" height="${ALTO}" fill="${fondoB64 ? 'url(#fondoImg)' : color}" />
  ${fondoB64 ? `<rect width="${ANCHO}" height="${ALTO}" fill="black" opacity="0.35"/>` : ''}
  <circle cx="${cx}" cy="${cy}" r="${r + 14}" fill="none" stroke="white" stroke-width="6" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#foto)" />
  <text x="${cx}" y="${cy + r + 60}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="42" fill="white">${escaparXML(nombre)}</text>
  ${lineasDesc.map((l, i) => `<text x="${cx}" y="${cy + r + 105 + i * 32}" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white" opacity="0.85">${escaparXML(l)}</text>`).join('\n  ')}
  `
}

// --- Plantilla 2: Moderno — panel lateral de color, foto y texto separados ---
function plantillaModerno({ color, fotoB64, fondoB64, nombre, lineasDesc }) {
  const panelW = 340
  const cx = panelW / 2
  const cy = ALTO / 2
  const r = 120
  return `
  <rect width="${ANCHO}" height="${ALTO}" fill="${fondoB64 ? 'url(#fondoImg)' : '#1c1c22'}" />
  ${fondoB64 ? `<rect width="${ANCHO}" height="${ALTO}" fill="black" opacity="0.4"/>` : ''}
  <rect x="0" y="0" width="${panelW}" height="${ALTO}" fill="${color}" opacity="0.95" />
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#foto)" />
  <text x="${panelW + 60}" y="230" font-family="sans-serif" font-weight="800" font-size="48" fill="${color}">${escaparXML(nombre)}</text>
  ${lineasDesc.map((l, i) => `<text x="${panelW + 60}" y="${280 + i * 34}" font-family="sans-serif" font-size="24" fill="white" opacity="0.9">${escaparXML(l)}</text>`).join('\n  ')}
  `
}

// --- Plantilla 3: Minimal — mucho espacio en blanco, tipografía limpia ---
function plantillaMinimal({ color, fotoB64, fondoB64, nombre, lineasDesc }) {
  const cx = 150
  const cy = 150
  const r = 80
  return `
  <rect width="${ANCHO}" height="${ALTO}" fill="${fondoB64 ? 'url(#fondoImg)' : '#f5f5f5'}" />
  ${fondoB64 ? `<rect width="${ANCHO}" height="${ALTO}" fill="white" opacity="0.55"/>` : ''}
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#foto)" />
  <rect x="80" y="270" width="${ANCHO - 160}" height="4" fill="${color}" />
  <text x="80" y="330" font-family="sans-serif" font-weight="700" font-size="46" fill="#222">${escaparXML(nombre)}</text>
  ${lineasDesc.map((l, i) => `<text x="80" y="${380 + i * 32}" font-family="sans-serif" font-size="24" fill="#555">${escaparXML(l)}</text>`).join('\n  ')}
  `
}

// --- Plantilla 4: Diagonal — franja de color en diagonal ---
function plantillaDiagonal({ color, fotoB64, fondoB64, nombre, lineasDesc }) {
  const cx = 230
  const cy = 230
  const r = 110
  return `
  <rect width="${ANCHO}" height="${ALTO}" fill="${fondoB64 ? 'url(#fondoImg)' : '#15151a'}" />
  ${fondoB64 ? `<rect width="${ANCHO}" height="${ALTO}" fill="black" opacity="0.4"/>` : ''}
  <polygon points="0,0 620,0 380,${ALTO} 0,${ALTO}" fill="${color}" opacity="0.9" />
  <circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="white" opacity="0.9" />
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#foto)" />
  <text x="${cx}" y="${cy + r + 60}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="38" fill="white">${escaparXML(nombre)}</text>
  ${lineasDesc.map((l, i) => `<text x="700" y="${220 + i * 34}" font-family="sans-serif" font-size="24" fill="white" opacity="0.9">${escaparXML(l)}</text>`).join('\n  ')}
  `
}

// --- Plantilla 5: Neón — fondo oscuro, resplandor de color alrededor ---
function plantillaNeon({ color, fotoB64, fondoB64, nombre, lineasDesc }) {
  const cx = ANCHO / 2
  const cy = 200
  const r = 110
  return `
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="${fondoB64 ? 'url(#fondoImg)' : '#0a0a0f'}" />
  ${fondoB64 ? `<rect width="${ANCHO}" height="${ALTO}" fill="black" opacity="0.55"/>` : ''}
  <circle cx="${cx}" cy="${cy}" r="${r + 12}" fill="none" stroke="${color}" stroke-width="6" filter="url(#glow)" />
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#foto)" />
  <text x="${cx}" y="${cy + r + 65}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="42" fill="${color}" filter="url(#glow)">${escaparXML(nombre)}</text>
  ${lineasDesc.map((l, i) => `<text x="${cx}" y="${cy + r + 110 + i * 32}" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white" opacity="0.85">${escaparXML(l)}</text>`).join('\n  ')}
  `
}

const RENDERERS = {
  clasico: plantillaClasico,
  moderno: plantillaModerno,
  minimal: plantillaMinimal,
  diagonal: plantillaDiagonal,
  neon: plantillaNeon
}

/**
 * @param {object} datos
 * @param {string} datos.fotoUrl - URL de la foto de perfil (o buffer via fotoBuffer)
 * @param {Buffer} [datos.fotoBuffer] - alternativa si ya tienes el buffer
 * @param {string} [datos.fondoUrl] - URL de fondo personalizado (opcional)
 * @param {Buffer} [datos.fondoBuffer] - alternativa si ya tienes el buffer del fondo
 * @param {string} datos.nombre
 * @param {string} [datos.descripcion]
 * @param {string} [datos.plantilla] - clasico|moderno|minimal|diagonal|neon
 * @param {string} [datos.color] - nombre de color de la lista COLORES
 * @returns {Promise<Buffer>}
 */
export async function generarTarjetaPerfil({ fotoUrl, fotoBuffer, fondoUrl, fondoBuffer, nombre, descripcion, plantilla, color }) {
  const tmpDir = os.tmpdir()
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const svgPath = path.join(tmpDir, `${id}.svg`)
  const pngPath = path.join(tmpDir, `${id}.png`)

  try {
    const fotoB64 = fotoBuffer ? bufferABase64(fotoBuffer) : await urlABase64(fotoUrl)
    const fondoB64 = fondoBuffer ? bufferABase64(fondoBuffer) : (fondoUrl ? await urlABase64(fondoUrl) : null)

    const colorHex = obtenerColor(color)
    const render = RENDERERS[plantilla] || RENDERERS.clasico
    const lineasDesc = envolver(descripcion || 'Sin descripción', 42, 3)

    const cuerpo = render({ color: colorHex, fotoB64, fondoB64, nombre: recortar(nombre, 26), lineasDesc })

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    ${fondoB64 ? `<pattern id="fondoImg" patternUnits="userSpaceOnUse" width="${ANCHO}" height="${ALTO}"><image href="${fondoB64}" x="0" y="0" width="${ANCHO}" height="${ALTO}" preserveAspectRatio="xMidYMid slice"/></pattern>` : ''}
    <pattern id="foto" patternUnits="objectBoundingBox" width="1" height="1">
      <image href="${fotoB64}" x="0" y="0" width="240" height="240" preserveAspectRatio="xMidYMid slice"/>
    </pattern>
  </defs>
  ${cuerpo}
</svg>`.trim()

    fs.writeFileSync(svgPath, svg)
    await execAsync(`ffmpeg -y -i "${svgPath}" "${pngPath}"`)

    return fs.readFileSync(pngPath)
  } finally {
    try { fs.unlinkSync(svgPath) } catch {}
    try { fs.unlinkSync(pngPath) } catch {}
  }
}
