/**
 * lib/spotifyCard.js
 *
 * Genera la tarjeta visual estilo "disco de vinilo" para el resultado
 * de Spotify: disco con surcos, brazo/aguja, portada recortada en
 * círculo, título y artista, e iconos de reproducción — usando SVG
 * (sin dependencias nativas) + ffmpeg para rasterizar a PNG. Esto
 * funciona en arm7/32-bit, a diferencia de canvas nativo.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'

const execAsync = promisify(exec)

const ANCHO = 1200
const ALTO = 540

// Paleta fija tipo "vino/magenta oscuro" (la del diseño de referencia)
const PALETA = {
  fondo1: '#2b0a10',
  fondo2: '#3d0f1a',
  disco: '#3a0f18',
  discoOscuro: '#2a0a10',
  acento: '#f0a8d8',
  acentoSuave: '#c98aa8',
  brazo: '#f2e9ee'
}

function escaparXML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function recortarTexto(texto, maxCaracteres) {
  const t = String(texto || '')
  return t.length > maxCaracteres ? t.slice(0, maxCaracteres - 1) + '…' : t
}

// Descarga la portada y la mete como base64 dentro del propio SVG
// (así no depende de que ffmpeg pueda bajar URLs externas al rasterizar).
async function imagenABase64(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`No se pudo descargar la portada (status ${resp.status})`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  const mime = resp.headers.get('content-type') || 'image/jpeg'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

function construirSvg({ portadaBase64, titulo, artista }) {
  const cxDisco = 300
  const cyDisco = ALTO / 2
  const rDisco = 260
  const rPortada = 150

  const surcos = []
  for (let r = 70; r < rDisco - 10; r += 16) {
    surcos.push(`<circle cx="${cxDisco}" cy="${cyDisco}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1.5" />`)
  }

  const tituloEsc = escaparXML(recortarTexto(titulo, 34))
  const artistaEsc = escaparXML(recortarTexto(artista, 40))

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PALETA.fondo1}"/>
      <stop offset="100%" stop-color="${PALETA.fondo2}"/>
    </linearGradient>
    <clipPath id="clipPortada">
      <circle cx="${cxDisco}" cy="${cyDisco}" r="${rPortada}" />
    </clipPath>
  </defs>

  <rect x="0" y="0" width="${ANCHO}" height="${ALTO}" fill="url(#bg)" />

  <!-- Disco -->
  <circle cx="${cxDisco}" cy="${cyDisco}" r="${rDisco}" fill="${PALETA.disco}" />
  ${surcos.join('\n  ')}

  <!-- Portada recortada en círculo -->
  <image href="${portadaBase64}" x="${cxDisco - rPortada}" y="${cyDisco - rPortada}" width="${rPortada * 2}" height="${rPortada * 2}" clip-path="url(#clipPortada)" preserveAspectRatio="xMidYMid slice" />

  <!-- Agujero central -->
  <circle cx="${cxDisco}" cy="${cyDisco}" r="8" fill="${PALETA.discoOscuro}" />

  <!-- Brazo / aguja -->
  <circle cx="${cxDisco + rDisco - 40}" cy="${cyDisco - rDisco + 70}" r="20" fill="${PALETA.brazo}" opacity="0.95" />
  <line x1="${cxDisco + rDisco - 40}" y1="${cyDisco - rDisco + 85}" x2="${cxDisco + 60}" y2="${cyDisco - 60}" stroke="${PALETA.brazo}" stroke-width="6" stroke-linecap="round" opacity="0.95" />
  <circle cx="${cxDisco + 60}" cy="${cyDisco - 60}" r="10" fill="${PALETA.brazo}" opacity="0.95" />

  <!-- Título y artista -->
  <text x="640" y="120" font-family="sans-serif" font-weight="800" font-size="52" fill="${PALETA.acento}">${tituloEsc}</text>
  <text x="640" y="165" font-family="sans-serif" font-weight="400" font-size="26" fill="${PALETA.acentoSuave}">${artistaEsc}</text>

  <!-- Corazón (contorno) -->
  <path d="M 660 480 C 640 460, 610 465, 610 490 C 610 510, 640 530, 660 550 C 680 530, 710 510, 710 490 C 710 465, 680 460, 660 480 Z"
        fill="none" stroke="${PALETA.acentoSuave}" stroke-width="5" opacity="0.8" />

  <!-- Controles de reproducción -->
  <g fill="${PALETA.acento}" opacity="0.9">
    <!-- retroceder -->
    <path d="M 990 490 L 950 515 L 990 540 Z" />
    <path d="M 1035 490 L 995 515 L 1035 540 Z" />
    <!-- pausa -->
    <rect x="1090" y="490" width="14" height="50" rx="3" />
    <rect x="1115" y="490" width="14" height="50" rx="3" />
    <!-- avanzar -->
    <path d="M 1175 490 L 1215 515 L 1175 540 Z" />
    <path d="M 1130 490 L 1170 515 L 1130 540 Z" />
  </g>
</svg>`.trim()
}

/**
 * Genera la tarjeta como buffer PNG.
 * @param {object} datos
 * @param {string} datos.imagenUrl - URL de la portada
 * @param {string} datos.titulo
 * @param {string} datos.artista
 * @returns {Promise<Buffer>}
 */
export async function generarTarjetaSpotify({ imagenUrl, titulo, artista }) {
  const tmpDir = os.tmpdir()
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const svgPath = path.join(tmpDir, `${id}.svg`)
  const pngPath = path.join(tmpDir, `${id}.png`)

  try {
    const portadaBase64 = await imagenABase64(imagenUrl)
    const svg = construirSvg({ portadaBase64, titulo: titulo || 'Desconocido', artista: artista || '' })

    fs.writeFileSync(svgPath, svg)
    await execAsync(`ffmpeg -y -i "${svgPath}" "${pngPath}"`)

    return fs.readFileSync(pngPath)
  } finally {
    try { fs.unlinkSync(svgPath) } catch {}
    try { fs.unlinkSync(pngPath) } catch {}
  }
}
