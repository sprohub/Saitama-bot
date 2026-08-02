import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'
import fetch from 'node-fetch'
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const settingsPath = path.resolve('./json/settings.json')
const FILAS_POR_SECCION = 10 // límite de WhatsApp por sección en un single_select

// 👉 Nombres de los 3 fondos aleatorios (deben estar dentro de la carpeta lib/ del proyecto)
const NOMBRES_FONDOS = ['welcome (1).jpg', 'welcome (2).jpg', 'welcome (3).jpg']
// 👉 Imagen que se usa cuando el usuario no tiene foto de perfil pública
const NOMBRE_SIN_PERFIL = 'sinperfil.jpg'

// 🎨 Paleta de la plantilla nueva "cupón" (inspirada en las 3 imágenes que
// mandaste: crema, lavanda, verde menta, con acentos cálidos oscuros)
const PALETAS_CUPON = [
  { fondo: '#f3e6c8', panel: '#fffaf0', acento: '#b3392c', texto: '#3a2c1a', textoSuave: '#8a7458' },
  { fondo: '#c9b8dd', panel: '#f6f1fb', acento: '#4b2e73', texto: '#2c1f3d', textoSuave: '#6d5a87' },
  { fondo: '#c3dab0', panel: '#f4f9ee', acento: '#3f5e2e', texto: '#233a1a', textoSuave: '#6c8a5b' }
]

// ═══════════════════════════════════════════
//  RESOLUCIÓN ROBUSTA DE RUTAS lib/
// ═══════════════════════════════════════════
const BASES_POSIBLES = [
  path.join(__dirname, '..'),
  path.join(__dirname, '..', '..'),
  path.join(__dirname, '..', '..', '..'),
  process.cwd()
]

function normalizarNombre(s) {
  return s.toLowerCase().replace(/[\s()_-]/g, '')
}

function resolverArchivoLib(nombreArchivo) {
  for (const base of BASES_POSIBLES) {
    const candidato = path.join(base, 'lib', nombreArchivo)
    if (fs.existsSync(candidato)) return candidato
  }
  const objetivo = normalizarNombre(nombreArchivo)
  for (const base of BASES_POSIBLES) {
    const dirLib = path.join(base, 'lib')
    try {
      if (fs.existsSync(dirLib)) {
        const archivos = fs.readdirSync(dirLib)
        const encontrado = archivos.find((a) => normalizarNombre(a) === objetivo)
        if (encontrado) return path.join(dirLib, encontrado)
      }
    } catch {}
  }
  console.log('[welcome][DEBUG] no se encontró', nombreArchivo, '— rutas probadas:', BASES_POSIBLES.map((b) => path.join(b, 'lib')))
  return null
}

function elegirFondoAleatorio() {
  const nombre = NOMBRES_FONDOS[Math.floor(Math.random() * NOMBRES_FONDOS.length)]
  return resolverArchivoLib(nombre)
}

function isOwner(m) {
  const number = m.sender?.split('@')[0]
  const owners = (global.owner || []).map(([num]) => num.replace(/[^0-9]/g, ''))
  return m.fromMe || owners.includes(number)
}

// === UTILS JSON (mismo formato que tu archivo on/off original) ===
function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2))
    return JSON.parse(fs.readFileSync(settingsPath))
  } catch {
    return {}
  }
}
function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}
function getChatConfig(botNumber, chatId) {
  let settings = readSettings()
  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = { antilink: false, welcome: false, antiarabe: false, modoadmin: false, reglas: false }
    saveSettings(settings)
  }
  return settings
}
function getWelcome(botNumber, chatId) {
  return !!getChatConfig(botNumber, chatId)[botNumber][chatId].welcome
}
function setWelcome(botNumber, chatId, enable) {
  const settings = getChatConfig(botNumber, chatId)
  settings[botNumber][chatId].welcome = enable
  saveSettings(settings)
}
async function gruposDelBot(conn) {
  const chats = await conn.groupFetchAllParticipating()
  return Object.values(chats)
}
function contarGruposActivos(botNumber, grupos) {
  return grupos.filter((g) => getWelcome(botNumber, g.id)).length
}

// ═══════════════════════════════════════════
//  ANTI-DUPLICADOS
// ═══════════════════════════════════════════
const eventosProcesados = new Map()
const VENTANA_DEDUPE_MS = 20 * 1000
function yaSeProceso(id) {
  if (!id) return false
  const ahora = Date.now()
  for (const [key, ts] of eventosProcesados) {
    if (ahora - ts > VENTANA_DEDUPE_MS) eventosProcesados.delete(key)
  }
  if (eventosProcesados.has(id)) return true
  eventosProcesados.set(id, ahora)
  return false
}

// === Helpers de menú interactivo ===
function unwrapMessage(message) {
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find((w) => msg[w])
    if (!key) break
    msg = msg[key].message
    guard++
  }
  return msg
}
function extractSelectedId(content) {
  const nativeFlow = content?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (nativeFlow?.paramsJson) {
    try {
      const data = JSON.parse(nativeFlow.paramsJson)
      return data.id || data.selectedId || data.selectedRowId || null
    } catch {}
  }
  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId
  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId
  return null
}

// ═══════════════════════════════════════════
//  RESOLUCIÓN DE @lid → número de teléfono real
// ═══════════════════════════════════════════
async function resolverJidReal(conn, jid) {
  if (!jid) return { jidReal: jid, resuelto: false }
  if (!jid.endsWith('@lid')) return { jidReal: jid, resuelto: true }
  try {
    const mapeo = conn.signalRepository?.lidMapping
    if (mapeo?.getPNForLID) {
      const real = await mapeo.getPNForLID(jid)
      if (real) return { jidReal: real, resuelto: true }
    }
  } catch {}
  try {
    const contacto = conn.store?.contacts?.[jid] || conn.contacts?.[jid]
    if (contacto?.jid && contacto.jid !== jid) return { jidReal: contacto.jid, resuelto: true }
  } catch {}
  return { jidReal: jid, resuelto: false }
}
function obtenerNombreVisible(conn, jidReal, resuelto) {
  try {
    const contacto = conn.store?.contacts?.[jidReal] || conn.contacts?.[jidReal]
    if (contacto?.notify) return contacto.notify
    if (contacto?.name) return contacto.name
  } catch {}
  if (!resuelto) return 'Miembro'
  return '+' + jidReal.split('@')[0]
}

// ═══════════════════════════════════════════
//  IMÁGENES → base64 (para incrustar en el SVG)
// ═══════════════════════════════════════════
async function archivoABase64(rutaLocal) {
  if (!rutaLocal || !fs.existsSync(rutaLocal)) return null
  try {
    const buffer = fs.readFileSync(rutaLocal)
    const ext = path.extname(rutaLocal).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (e) {
    console.log('[welcome][DEBUG] fallo leyendo imagen local:', rutaLocal, '->', e?.message)
    return null
  }
}
async function urlABase64(url) {
  if (!url) return null
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const buffer = Buffer.from(await resp.arrayBuffer())
    const mime = resp.headers.get('content-type') || 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (e) {
    console.log('[welcome][DEBUG] fallo descargando imagen:', url, '->', e?.message)
    return null
  }
}

function escaparXML(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Envuelve texto en líneas por cantidad de caracteres (aprox., sin medir fuente real)
function envolver(texto, maxCaracteres, maxLineas) {
  const palabras = String(texto || '').split(' ')
  const lineas = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p
    if (prueba.length > maxCaracteres) {
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

function formatFecha(fecha) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const d = fecha.getDate().toString().padStart(2, '0')
  const mes = meses[fecha.getMonth()]
  return `${d} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${fecha.getFullYear()}`
}
function formatHora(fecha) {
  return `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`
}

// Convierte un SVG (string) a buffer PNG usando ffmpeg
async function svgAPng(svgTexto) {
  const tmpDir = os.tmpdir()
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const svgPath = path.join(tmpDir, `${id}.svg`)
  const pngPath = path.join(tmpDir, `${id}.png`)
  fs.writeFileSync(svgPath, svgTexto)
  try {
    await execAsync(`ffmpeg -y -i "${svgPath}" "${pngPath}"`)
    return fs.readFileSync(pngPath)
  } finally {
    try { fs.unlinkSync(svgPath) } catch {}
    try { fs.unlinkSync(pngPath) } catch {}
  }
}

// ═══════════════════════════════════════════
//  PLANTILLA 1 — "Póster" (foto de fondo, cinta diagonal, panel inferior)
// ═══════════════════════════════════════════
async function construirSvgPoster({ tipo, numero, userPicUrl, groupName, miembros, mensaje }) {
  const W = 1080, H = 1350
  const esBienvenida = tipo === 'bienvenida'
  const colorAcento = esBienvenida ? '#6fae7c' : '#c9695f'
  const gris = '#c9d1d9'
  const centerX = W / 2

  const rutaFondo = elegirFondoAleatorio()
  const fondoB64 = await archivoABase64(rutaFondo)

  let fotoB64 = await urlABase64(userPicUrl)
  if (!fotoB64) fotoB64 = await archivoABase64(resolverArchivoLib(NOMBRE_SIN_PERFIL))

  const circR = 175
  const circY = 430

  const textoEstado = esBienvenida ? '¡SE UNIÓ AL GRUPO!' : 'HA SALIDO DEL GRUPO'
  const anchoCaja = Math.min(W - 120, Math.max(numero.length * 26, textoEstado.length * 15) + 90)
  const cajaX = centerX - anchoCaja / 2
  const cajaY = circY + circR + 40
  const cajaH = 130

  const cardX = 60, cardW = W - cardX * 2, cardH = 380, cardY = H - cardH - 60
  const nombreGrupo = groupName.length > 28 ? groupName.slice(0, 28) + '…' : groupName

  const ahora = new Date()
  const columnas = [
    { label: 'MIEMBROS', valor: String(miembros) },
    { label: 'FECHA', valor: formatFecha(ahora) },
    { label: 'HORA', valor: formatHora(ahora) }
  ]
  const colAncho = cardW / 3

  const frase = mensaje || (esBienvenida ? 'Un nuevo miembro se une a la comunidad. ¡Bienvenido/a!' : 'Gracias por haber sido parte de esta familia.')
  const lineasFrase = envolver(frase, 46, 2)

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="clipFoto"><circle cx="${centerX}" cy="${circY}" r="${circR}" /></clipPath>
    <linearGradient id="gradTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="black" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gradBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.88"/>
    </linearGradient>
  </defs>

  <!-- Fondo -->
  ${fondoB64
    ? `<image href="${fondoB64}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${W}" height="${H}" fill="#111418"/>`}
  <rect x="0" y="0" width="${W}" height="${H * 0.4}" fill="url(#gradTop)" />
  <rect x="0" y="${H * 0.45}" width="${W}" height="${H * 0.55}" fill="url(#gradBottom)" />

  <!-- Cinta diagonal -->
  <g transform="rotate(-45 150 150)">
    <rect x="-140" y="70" width="480" height="64" fill="${colorAcento}" />
    <text x="150" y="160" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="30" fill="#0b0b0b">${esBienvenida ? 'NUEVO MIEMBRO' : 'SE HA IDO'}</text>
  </g>

  <!-- Marca -->
  <text x="${W - 50}" y="70" text-anchor="end" font-family="sans-serif" font-weight="bold" font-size="22" fill="rgba(255,255,255,0.85)">SAITAMA-BOT</text>

  <!-- Foto circular con anillo -->
  <circle cx="${centerX}" cy="${circY}" r="${circR + 14}" fill="${colorAcento}" />
  <circle cx="${centerX}" cy="${circY}" r="${circR + 6}" fill="#ffffff" />
  ${fotoB64
    ? `<image href="${fotoB64}" x="${centerX - circR}" y="${circY - circR}" width="${circR * 2}" height="${circR * 2}" clip-path="url(#clipFoto)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${centerX}" cy="${circY}" r="${circR}" fill="#181c22"/><text x="${centerX}" y="${circY + 42}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="120" fill="${gris}">?</text>`}

  <!-- Respaldo del nombre -->
  <rect x="${cajaX}" y="${cajaY}" width="${anchoCaja}" height="${cajaH}" rx="26" fill="rgba(6,7,9,0.6)" />
  <text x="${centerX}" y="${circY + circR + 90}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="46" fill="#ffffff">${escaparXML(numero)}</text>
  <text x="${centerX}" y="${circY + circR + 130}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="26" fill="${colorAcento}">${textoEstado}</text>

  <!-- Panel inferior -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="32" fill="rgba(9,10,13,0.86)" stroke="rgba(255,255,255,0.10)" stroke-width="2" />
  <text x="${centerX}" y="${cardY + 56}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="18" fill="${gris}">GRUPO</text>
  <text x="${centerX}" y="${cardY + 94}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="32" fill="#ffffff">${escaparXML(nombreGrupo)}</text>
  <line x1="${cardX + 40}" y1="${cardY + 138}" x2="${cardX + cardW - 40}" y2="${cardY + 138}" stroke="rgba(255,255,255,0.15)" />

  ${columnas.map((col, i) => {
    const cx = cardX + colAncho * i + colAncho / 2
    const y = cardY + 186
    return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="${gris}">${col.label}</text>
    <text x="${cx}" y="${y + 34}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="26" fill="#ffffff">${escaparXML(col.valor)}</text>`
  }).join('\n  ')}

  <line x1="${cardX + 40}" y1="${cardY + 258}" x2="${cardX + cardW - 40}" y2="${cardY + 258}" stroke="rgba(255,255,255,0.15)" />
  ${lineasFrase.map((l, i) => `<text x="${centerX}" y="${cardY + 298 + i * 28}" text-anchor="middle" font-family="sans-serif" font-style="italic" font-size="21" fill="${gris}">${escaparXML(l)}</text>`).join('\n  ')}
</svg>`.trim()
}

// ═══════════════════════════════════════════
//  PLANTILLA 2 — "Cupón" (paleta pastel + tarjeta tipo ticket)
//  Inspirada en las 3 imágenes: crema/lavanda/verde con acentos cálidos
// ═══════════════════════════════════════════
async function construirSvgCupon({ tipo, numero, userPicUrl, groupName, miembros, mensaje }) {
  const W = 1080, H = 1350
  const esBienvenida = tipo === 'bienvenida'
  const paleta = PALETAS_CUPON[Math.floor(Math.random() * PALETAS_CUPON.length)]
  const centerX = W / 2

  let fotoB64 = await urlABase64(userPicUrl)
  if (!fotoB64) fotoB64 = await archivoABase64(resolverArchivoLib(NOMBRE_SIN_PERFIL))

  const circR = 165
  const circY = 300

  const cardX = 90, cardW = W - cardX * 2, cardY = 560, cardH = 620
  const nombreGrupo = groupName.length > 26 ? groupName.slice(0, 26) + '…' : groupName
  const textoEstado = esBienvenida ? '¡Bienvenido/a al grupo!' : 'Hasta luego 👋'

  const ahora = new Date()
  const frase = mensaje || (esBienvenida ? 'Un nuevo miembro se une a la comunidad.' : 'Gracias por haber sido parte de esta familia.')
  const lineasFrase = envolver(frase, 40, 2)

  // "dientes" de recorte tipo cupón en el borde superior/inferior de la tarjeta
  const dientesArriba = []
  const dientesAbajo = []
  const pasoDiente = 30
  for (let x = cardX; x <= cardX + cardW; x += pasoDiente) {
    dientesArriba.push(`<circle cx="${x}" cy="${cardY}" r="10" fill="${paleta.fondo}" />`)
    dientesAbajo.push(`<circle cx="${x}" cy="${cardY + cardH}" r="10" fill="${paleta.fondo}" />`)
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="clipFoto"><circle cx="${centerX}" cy="${circY}" r="${circR}" /></clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="${paleta.fondo}" />

  <!-- Marca -->
  <text x="${W - 50}" y="70" text-anchor="end" font-family="sans-serif" font-weight="bold" font-size="22" fill="${paleta.textoSuave}">SAITAMA-BOT</text>

  <!-- Etiqueta de estado, arriba -->
  <rect x="${centerX - 190}" y="90" width="380" height="60" rx="30" fill="${paleta.acento}" />
  <text x="${centerX}" y="130" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="26" fill="#ffffff">${escaparXML(esBienvenida ? 'NUEVO MIEMBRO' : 'SE HA IDO')}</text>

  <!-- Foto circular -->
  <circle cx="${centerX}" cy="${circY}" r="${circR + 12}" fill="${paleta.panel}" />
  <circle cx="${centerX}" cy="${circY}" r="${circR + 6}" fill="${paleta.acento}" />
  ${fotoB64
    ? `<image href="${fotoB64}" x="${centerX - circR}" y="${circY - circR}" width="${circR * 2}" height="${circR * 2}" clip-path="url(#clipFoto)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${centerX}" cy="${circY}" r="${circR}" fill="${paleta.panel}"/><text x="${centerX}" y="${circY + 34}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="100" fill="${paleta.textoSuave}">?</text>`}

  <text x="${centerX}" y="${circY + circR + 55}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="42" fill="${paleta.texto}">${escaparXML(numero)}</text>
  <text x="${centerX}" y="${circY + circR + 95}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="24" fill="${paleta.acento}">${escaparXML(textoEstado)}</text>

  <!-- Tarjeta tipo "cupón/ticket" -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="18" fill="${paleta.panel}" stroke="${paleta.acento}" stroke-width="3" stroke-dasharray="10 8" />
  ${dientesArriba.join('\n  ')}
  ${dientesAbajo.join('\n  ')}

  <text x="${centerX}" y="${cardY + 70}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="18" fill="${paleta.textoSuave}">GRUPO</text>
  <text x="${centerX}" y="${cardY + 112}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="34" fill="${paleta.texto}">${escaparXML(nombreGrupo)}</text>

  <line x1="${cardX + 50}" y1="${cardY + 160}" x2="${cardX + cardW - 50}" y2="${cardY + 160}" stroke="${paleta.acento}" stroke-width="2" stroke-dasharray="6 6" />

  <text x="${cardX + cardW * 0.2}" y="${cardY + 220}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="${paleta.textoSuave}">MIEMBROS</text>
  <text x="${cardX + cardW * 0.2}" y="${cardY + 258}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="30" fill="${paleta.texto}">${escaparXML(String(miembros))}</text>

  <text x="${cardX + cardW * 0.5}" y="${cardY + 220}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="${paleta.textoSuave}">FECHA</text>
  <text x="${cardX + cardW * 0.5}" y="${cardY + 258}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="24" fill="${paleta.texto}">${escaparXML(formatFecha(ahora))}</text>

  <text x="${cardX + cardW * 0.8}" y="${cardY + 220}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="${paleta.textoSuave}">HORA</text>
  <text x="${cardX + cardW * 0.8}" y="${cardY + 258}" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="30" fill="${paleta.texto}">${escaparXML(formatHora(ahora))}</text>

  <line x1="${cardX + 50}" y1="${cardY + 300}" x2="${cardX + cardW - 50}" y2="${cardY + 300}" stroke="${paleta.acento}" stroke-width="2" stroke-dasharray="6 6" />

  ${lineasFrase.map((l, i) => `<text x="${centerX}" y="${cardY + 350 + i * 34}" text-anchor="middle" font-family="sans-serif" font-style="italic" font-size="24" fill="${paleta.textoSuave}">${escaparXML(l)}</text>`).join('\n  ')}

  <!-- código de barras decorativo, como en las imágenes de referencia -->
  ${Array.from({ length: 40 }).map((_, i) => {
    const bw = 2 + (i % 3)
    const bx = cardX + 60 + i * 9
    if (bx > cardX + cardW - 60) return ''
    return `<rect x="${bx}" y="${cardY + cardH - 70}" width="${bw}" height="40" fill="${paleta.texto}" opacity="0.7" />`
  }).join('\n  ')}
</svg>`.trim()
}

/**
 * Genera la imagen del evento (bienvenida/despedida), alternando al azar
 * entre la plantilla "póster" (foto de fondo) y la nueva "cupón" (pastel).
 */
async function generarImagenEvento(datos) {
  const usarCupon = Math.random() < 0.5
  const svg = usarCupon ? await construirSvgCupon(datos) : await construirSvgPoster(datos)
  return svgAPng(svg)
}

// ═══════════════════════════════════════════
//  .testwelcome — vista previa
// ═══════════════════════════════════════════
async function ejecutarTestWelcome(m, conn, textoArg) {
  if (!isOwner(m)) {
    return m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar este comando.\n╰───────────────⬣`)
  }
  if (!m.isGroup) {
    return m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Este comando solo funciona dentro de un grupo.\n╰───────────────⬣`)
  }

  const arg = (textoArg || '').trim().toLowerCase()
  const esDespedida = ['bye', 'despedida', 'salida', 'adios', 'adiós'].includes(arg)

  const botNumber = conn.user?.jid || conn.user.id
  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const groupSize = groupMetadata.participants.length

  const { jidReal, resuelto } = await resolverJidReal(conn, m.sender)
  const userNumero = obtenerNombreVisible(conn, jidReal, resuelto)

  let userPicUrl
  try {
    userPicUrl = await conn.profilePictureUrl(jidReal, 'image')
  } catch {
    userPicUrl = null
  }

  const mensajePersonalizado = esDespedida ? chat.sBye : chat.sWelcome
  const mensajeFinal = mensajePersonalizado
    ? mensajePersonalizado
        .replace(/@user/g, resuelto ? `@${userNumero.replace('+', '')}` : userNumero)
        .replace(/@group/g, groupMetadata.subject)
        .replace(/@members/g, groupSize)
    : null

  try {
    const imagenBuffer = await generarImagenEvento({
      tipo: esDespedida ? 'despedida' : 'bienvenida',
      numero: userNumero,
      userPicUrl,
      groupName: groupMetadata.subject,
      miembros: groupSize,
      mensaje: mensajeFinal
    })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: `🧪 *Vista previa* (${esDespedida ? 'despedida' : 'bienvenida'}) — esto no es un evento real, solo una prueba de la plantilla.`
    }, { quoted: m })
  } catch (e) {
    console.log('[testwelcome] error generando imagen de prueba:', e)
    await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo generar la tarjeta de prueba.\n╰───────────────⬣`)
  }
}

// ───────────────────────────────────────────
// Comando .welcome — abre el menú de botones
// Comando .testwelcome — envía una tarjeta de prueba con tus propios datos
// ───────────────────────────────────────────
const handler = async (m, { conn, command, text }) => {
  if (command === 'testwelcome') {
    return await ejecutarTestWelcome(m, conn, text)
  }

  if (!isOwner(m)) {
    return m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar este comando.\n╰───────────────⬣`)
  }

  await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Cargando grupos...\n╰───────────────⬣`)

  const botNumber = conn.user?.jid || conn.user.id
  const grupos = await gruposDelBot(conn)
  const activosCount = contarGruposActivos(botNumber, grupos)

  const sections = []

  if (m.isGroup) {
    const enAqui = getWelcome(botNumber, m.chat)
    sections.push({
      title: '⚙️ Este grupo',
      rows: [{
        title: enAqui ? '🔴 Desactivar aquí' : '🟢 Activar aquí',
        description: `Estado actual: ${enAqui ? 'Activado ✅' : 'Desactivado ❌'}`,
        id: `welcome|${enAqui ? 'off' : 'on'}|${m.chat}`
      }]
    })
  }

  sections.push({
    title: '🌐 Todos los grupos',
    rows: [
      { title: '🟢 Activar en todos', description: `${grupos.length} grupos donde está el bot`, id: 'welcome|on|all' },
      { title: '🔴 Desactivar en todos', description: `${grupos.length} grupos donde está el bot`, id: 'welcome|off|all' }
    ]
  })

  for (let i = 0; i < grupos.length; i += FILAS_POR_SECCION) {
    const chunk = grupos.slice(i, i + FILAS_POR_SECCION)
    const desde = i + 1
    const hasta = i + chunk.length
    sections.push({
      title: `📋 Grupos ${desde}-${hasta}`,
      rows: chunk.map((g) => {
        const estado = getWelcome(botNumber, g.id)
        return {
          title: `🌿 ${g.subject}`,
          description: `${estado ? 'Activado ✅' : 'Desactivado ❌'} — toca para alternar`,
          id: `welcome|toggle|${g.id}`
        }
      })
    })
  }

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 👋 Menú de Bienvenida\n` +
    `│ 🍃 El bot está en ${grupos.length} grupo(s)\n` +
    `│ 🍃 Welcome activo en ${activosCount} de ${grupos.length}\n` +
    `│ 🍃 Toca una opción para activar/desactivar\n` +
    `╰───────────────⬣`

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌿 SAITAMA-BOT — Welcome', subtitle: `Activo en ${activosCount}/${grupos.length} grupos`, hasMediaAttachment: false },
      body: { text: bodyText },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🌿 VER OPCIONES', sections }) }]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.log('[welcome] error mostrando menú:', e)
    await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo mostrar el menú.\n╰───────────────⬣`)
  }
}

handler.command = ['welcome', 'testwelcome']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['group']
handler.help = ['welcome', 'testwelcome']
handler.desc = 'Menú para activar/desactivar la bienvenida, y .testwelcome para previsualizarla'

// ───────────────────────────────────────────
// handler.before — botones del menú + envío real de bienvenida/despedida
// ───────────────────────────────────────────
handler.before = async (m, { conn }) => {
  const botNumber = conn.user?.jid || conn.user.id

  // ── 1) Botones del menú .welcome ──
  const content = unwrapMessage(m.message)
  const id = content ? extractSelectedId(content) : null

  if (id && id.startsWith('welcome|')) {
    if (!isOwner(m)) {
      await conn.sendMessage(m.chat, { text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar esto.\n╰───────────────⬣` }, { quoted: m })
      return true
    }

    const [, accion, destino] = id.split('|')

    if (destino === 'all') {
      const grupos = await gruposDelBot(conn)
      grupos.forEach((g) => setWelcome(botNumber, g.id, accion === 'on'))
      await conn.sendMessage(m.chat, { text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${accion === 'on' ? 'activada ✅' : 'desactivada ❌'} en ${grupos.length} grupo(s).\n╰───────────────⬣` }, { quoted: m })
      return true
    }

    if (accion === 'toggle') {
      const actual = getWelcome(botNumber, destino)
      setWelcome(botNumber, destino, !actual)
      await conn.sendMessage(m.chat, { text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${!actual ? 'activada ✅' : 'desactivada ❌'} en ese grupo.\n╰───────────────⬣` }, { quoted: m })
      return true
    }

    setWelcome(botNumber, destino, accion === 'on')
    await conn.sendMessage(m.chat, { text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${accion === 'on' ? 'activada ✅' : 'desactivada ❌'} en este grupo.\n╰───────────────⬣` }, { quoted: m })
    return true
  }

  // ── 2) Envío real de bienvenida / despedida ──
  if (!m.isGroup) return false
  if (!getWelcome(botNumber, m.chat)) return false
  if (![27, 28, 32].includes(m.messageStubType)) return false

  if (m._welcomeHandled) return false
  m._welcomeHandled = true

  const participante = m.messageStubParameters?.[0] || m.sender
  const idEvento = `${m.chat}_${m.messageStubType}_${participante}`
  if (yaSeProceso(idEvento)) return false

  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const groupSize = groupMetadata.participants.length

  const { jidReal, resuelto } = await resolverJidReal(conn, participante)
  const userId = jidReal
  const userNumero = obtenerNombreVisible(conn, jidReal, resuelto)

  let userPicUrl
  try {
    userPicUrl = await conn.profilePictureUrl(userId, 'image')
  } catch {
    userPicUrl = null
  }

  const esEntrada = m.messageStubType === 27
  const mensajePersonalizado = esEntrada ? chat.sWelcome : chat.sBye
  const mensajeFinal = mensajePersonalizado
    ? mensajePersonalizado
        .replace(/@user/g, resuelto ? `@${userNumero.replace('+', '')}` : userNumero)
        .replace(/@group/g, groupMetadata.subject)
        .replace(/@members/g, groupSize)
    : null

  const etiquetaUsuario = resuelto ? `@${userNumero.replace('+', '')}` : userNumero
  const mentionsArray = resuelto ? [userId] : []

  try {
    const imagenBuffer = await generarImagenEvento({
      tipo: esEntrada ? 'bienvenida' : 'despedida',
      numero: userNumero,
      userPicUrl,
      groupName: groupMetadata.subject,
      miembros: groupSize,
      mensaje: mensajeFinal
    })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: esEntrada ? `🌿 ${etiquetaUsuario} se unió al grupo.` : `🍃 ${etiquetaUsuario} salió del grupo.`,
      mentions: mentionsArray
    })
  } catch (e) {
    console.log('[welcome] error generando imagen, se envía solo texto:', e)
    const texto = esEntrada
      ? `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 👋 ¡Bienvenido/a!\n│\n│ 👤 ${etiquetaUsuario}\n│ 🏠 Grupo: ${groupMetadata.subject}\n│ 👥 Miembros: ${groupSize}\n╰───────────────⬣`
      : `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 💨 ¡Hasta luego!\n│\n│ 👤 ${etiquetaUsuario}\n│ 🏠 Grupo: ${groupMetadata.subject}\n│ 👥 Miembros restantes: ${groupSize}\n╰───────────────⬣`
    await conn.sendMessage(m.chat, { text: texto, mentions: mentionsArray })
  }

  return false
}

export default handler