/**
 * plugins/tools/hojadevida.js
 * Comando: .cv
 *
 * Genera una hoja de vida (CV) en PDF con diseño de DOS COLUMNAS
 * (sidebar de color + contenido) a partir de datos que el usuario
 * escribe en formato "Campo: valor". Deja elegir plantilla con
 * botones y produce el PDF con pdf-lib (misma librería que .mgpdf).
 *
 * Uso:
 * .cv (opcionalmente citando una FOTO para la sidebar)
 * Nombre: Juan Pérez
 * Cargo: Desarrollador Backend
 * Ciudad: Bogotá
 * Telefono: +57 300 1234567
 * Email: juan@correo.com
 * Linkedin: linkedin.com/in/juanperez
 * Perfil: Breve resumen profesional en 2-3 líneas...
 * Experiencia: Empresa A - Cargo (2021-2023): logro uno | logro dos; Empresa B - Cargo (2023-actual): logro uno
 * Educacion: Universidad X - Ingeniería (2016-2021); Instituto Y - Curso (2015)
 * Habilidades: JavaScript, Node.js, MongoDB, Liderazgo
 * Idiomas: Español: Nativo; Inglés: C1; Portugués: B1
 * Cursos: Curso de Excel Avanzado - Udemy (2020)
 * Premios: Reconocimiento a la Eficiencia - Empresa X (2022)
 * Info: Disponibilidad inmediata para viajar
 *
 * Notas:
 * - "Experiencia" y "Educacion": varias entradas separadas por ";".
 *   Dentro de una entrada de Experiencia, los logros/bullets van
 *   separados por "|".
 * - "Idiomas": pares "Idioma: Nivel" separados por ";". Nivel acepta
 *   Nativo, C2, C1, B2, B1, A2, A1 (o cualquier texto libre, en ese
 *   caso se dibuja una barra al 60% por defecto).
 * - Si citas una imagen (foto) junto con .cv, se usa en la sidebar.
 *   Se descarga con `m.quoted.download()`; si tu fork de Baileys usa
 *   otro helper para descargar multimedia citada (como el que ya
 *   usan `.mgpdf` o `.stsubir` en este bot), ajusta esa única línea.
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fileTypeFromBuffer } from 'file-type'
import fs from 'fs'
import path from 'path'

global.__cvPending = global.__cvPending || {}

function limpiarPendientesVencidos() {
  const ahora = Date.now()
  for (const key of Object.keys(global.__cvPending)) {
    if (ahora - global.__cvPending[key].timestamp > 5 * 60 * 1000) {
      delete global.__cvPending[key]
    }
  }
}

function unwrapMessage(message) {
  if (!message) return message
  if (message.ephemeralMessage) return unwrapMessage(message.ephemeralMessage.message)
  if (message.viewOnceMessage) return unwrapMessage(message.viewOnceMessage.message)
  if (message.viewOnceMessageV2) return unwrapMessage(message.viewOnceMessageV2.message)
  return message
}

function extractSelectedId(content) {
  const msg = unwrapMessage(content.message)
  const interactive = msg?.interactiveResponseMessage
  if (!interactive) return null
  try {
    const params = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson)
    return params.id || null
  } catch {
    return null
  }
}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

// Parsea "Campo: valor" línea por línea (case-insensitive, admite tildes)
function parsearCampos(texto) {
  const campos = {}
  const lineas = texto.split('\n')
  let campoActual = null
  for (let linea of lineas) {
    const match = linea.match(/^\s*([A-Za-zÁÉÍÓÚáéíóúñÑ ]+)\s*:\s*(.*)$/)
    if (match) {
      campoActual = match[1].trim().toLowerCase()
      campos[campoActual] = match[2].trim()
    } else if (campoActual && linea.trim()) {
      // continuación de la línea anterior
      campos[campoActual] += ' ' + linea.trim()
    }
  }
  return campos
}

function splitLimpio(texto, separador) {
  return (texto || '')
    .split(separador)
    .map(s => s.trim())
    .filter(Boolean)
}

function normalizarDatos(campos) {
  const experiencia = splitLimpio(campos['experiencia'], ';').map(entrada => {
    const [cabecera, resto] = entrada.split(':')
    return {
      cabecera: (cabecera || '').trim(),
      bullets: resto ? splitLimpio(resto, '|') : []
    }
  })

  const idiomas = splitLimpio(campos['idiomas'], ';').map(par => {
    const [nombre, nivel] = par.split(':')
    return { nombre: (nombre || '').trim(), nivel: (nivel || '').trim() }
  }).filter(i => i.nombre)

  return {
    nombre: campos['nombre'] || 'Sin nombre',
    cargo: campos['cargo'] || '',
    telefono: campos['telefono'] || campos['teléfono'] || '',
    email: campos['email'] || campos['correo'] || '',
    ciudad: campos['ciudad'] || '',
    direccion: campos['direccion'] || campos['dirección'] || '',
    linkedin: campos['linkedin'] || '',
    perfil: campos['perfil'] || campos['resumen'] || campos['declaracion'] || campos['declaración'] || '',
    experiencia,
    educacion: splitLimpio(campos['educacion'] || campos['educación'], ';'),
    habilidades: splitLimpio(campos['habilidades'], ','),
    idiomas,
    cursos: splitLimpio(campos['cursos'], ';'),
    premios: splitLimpio(campos['premios'] || campos['logros'], ';'),
    infoAdicional: campos['info'] || campos['información'] || campos['informacion adicional'] || ''
  }
}

// Envuelve texto a un ancho máximo en puntos, usando la fuente dada
function envolverTexto(texto, font, size, maxWidth) {
  const palabras = String(texto).split(' ')
  const lineas = []
  let actual = ''
  for (const palabra of palabras) {
    const prueba = actual ? actual + ' ' + palabra : palabra
    if (font.widthOfTextAtSize(prueba, size) > maxWidth && actual) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = prueba
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

function nivelToPercent(nivel) {
  const n = (nivel || '').toLowerCase()
  if (n.includes('nativ')) return 1
  if (n.includes('c2')) return 0.95
  if (n.includes('c1')) return 0.8
  if (n.includes('b2')) return 0.65
  if (n.includes('b1')) return 0.5
  if (n.includes('a2')) return 0.35
  if (n.includes('a1')) return 0.2
  return 0.6
}

// Paletas por plantilla: color de la sidebar (y acentos) + tono claro para líneas
const PLANTILLAS = {
  clasico: { accento: rgb(0.09, 0.15, 0.32), suave: rgb(0.85, 0.87, 0.93) },
  moderno: { accento: rgb(0.05, 0.32, 0.20), suave: rgb(0.83, 0.92, 0.86) },
  minimalista: { accento: rgb(0.18, 0.18, 0.18), suave: rgb(0.88, 0.88, 0.88) }
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const SIDEBAR_W = 190
const MARGEN = 26

async function generarPDF(datos, plantilla, fotoBuffer) {
  const pdf = await PDFDocument.create()
  const paleta = PLANTILLAS[plantilla] || PLANTILLAS.clasico

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique)

  let fotoImg = null
  if (fotoBuffer) {
    try {
      const tipo = await fileTypeFromBuffer(fotoBuffer)
      if (tipo?.mime === 'image/png') fotoImg = await pdf.embedPng(fotoBuffer)
      else if (tipo?.mime === 'image/jpeg') fotoImg = await pdf.embedJpg(fotoBuffer)
    } catch {
      fotoImg = null
    }
  }

  let page = null
  let yR = 0 // cursor columna derecha (contenido)
  let yL = 0 // cursor columna izquierda (sidebar)
  const contentX = SIDEBAR_W + MARGEN
  const contentW = PAGE_W - SIDEBAR_W - MARGEN * 2
  const sideX = 20
  const sideW = SIDEBAR_W - 40

  function nuevaPagina() {
    page = pdf.addPage([PAGE_W, PAGE_H])
    page.drawRectangle({ x: 0, y: 0, width: SIDEBAR_W, height: PAGE_H, color: paleta.accento })
    yR = PAGE_H - MARGEN
    yL = PAGE_H - MARGEN
  }

  function saltoDerechaSiHaceFalta(alto) {
    if (yR - alto < MARGEN) nuevaPagina()
  }

  nuevaPagina()

  // ---------- SIDEBAR ----------
  if (fotoImg) {
    const tam = sideW
    const escala = tam / Math.max(fotoImg.width, fotoImg.height)
    const w = fotoImg.width * escala
    const h = fotoImg.height * escala
    page.drawImage(fotoImg, { x: sideX + (sideW - w) / 2, y: yL - h, width: w, height: h })
    yL -= h + 20
  } else {
    yL -= 10
  }

  function tituloSidebar(texto) {
    page.drawText(texto.toUpperCase(), { x: sideX, y: yL, size: 12, font: fontBold, color: rgb(1, 1, 1) })
    yL -= 6
    page.drawLine({ start: { x: sideX, y: yL }, end: { x: sideX + sideW, y: yL }, thickness: 0.75, color: rgb(1, 1, 1) })
    yL -= 14
  }

  function lineaSidebar(texto, size = 9.5) {
    const lineas = envolverTexto(texto, fontRegular, size, sideW)
    for (const l of lineas) {
      page.drawText(l, { x: sideX, y: yL, size, font: fontRegular, color: rgb(1, 1, 1) })
      yL -= size + 4
    }
  }

  function bulletSidebar(texto, size = 9.5) {
    const lineas = envolverTexto(texto, fontRegular, size, sideW - 10)
    lineas.forEach((l, i) => {
      const prefijo = i === 0 ? '•' : ' '
      page.drawText(prefijo, { x: sideX, y: yL, size, font: fontRegular, color: rgb(1, 1, 1) })
      page.drawText(l, { x: sideX + 10, y: yL, size, font: fontRegular, color: rgb(1, 1, 1) })
      yL -= size + 4
    })
  }

  const contacto = [
    datos.ciudad && ['Ciudad', datos.ciudad],
    datos.telefono && ['Teléfono', datos.telefono],
    datos.email && ['Email', datos.email],
    datos.linkedin && ['LinkedIn', datos.linkedin],
    datos.direccion && ['Dirección', datos.direccion]
  ].filter(Boolean)

  if (contacto.length) {
    tituloSidebar('Contacto')
    contacto.forEach(([, valor]) => { lineaSidebar(valor); yL -= 2 })
    yL -= 10
  }

  if (datos.habilidades.length) {
    tituloSidebar('Habilidades')
    datos.habilidades.forEach(h => bulletSidebar(h))
    yL -= 10
  }

  if (datos.idiomas.length) {
    tituloSidebar('Idiomas')
    datos.idiomas.forEach(({ nombre, nivel }) => {
      lineaSidebar(nivel ? `${nombre} — ${nivel}` : nombre)
      const pct = nivelToPercent(nivel)
      const barW = sideW
      page.drawRectangle({ x: sideX, y: yL - 2, width: barW, height: 5, color: rgb(1, 1, 1), opacity: 0.25 })
      page.drawRectangle({ x: sideX, y: yL - 2, width: barW * pct, height: 5, color: rgb(1, 1, 1) })
      yL -= 14
    })
  }

  // ---------- COLUMNA PRINCIPAL ----------
  function titulo(texto, size = 24) {
    saltoDerechaSiHaceFalta(size + 10)
    page.drawText(texto, { x: contentX, y: yR, size, font: fontBold, color: rgb(0.12, 0.12, 0.12) })
    yR -= size + 6
  }

  function subtitulo(texto, size = 12) {
    saltoDerechaSiHaceFalta(size + 6)
    page.drawText(texto, { x: contentX, y: yR, size, font: fontItalic, color: paleta.accento })
    yR -= size + 14
  }

  function seccion(texto) {
    saltoDerechaSiHaceFalta(30)
    page.drawText(texto.toUpperCase(), { x: contentX, y: yR, size: 13, font: fontBold, color: paleta.accento })
    yR -= 4
    page.drawLine({ start: { x: contentX, y: yR - 4 }, end: { x: contentX + contentW, y: yR - 4 }, thickness: 1.25, color: paleta.accento })
    yR -= 20
  }

  function parrafo(texto, size = 10.5) {
    const lineas = envolverTexto(texto, fontRegular, size, contentW)
    for (const linea of lineas) {
      saltoDerechaSiHaceFalta(size + 4)
      page.drawText(linea, { x: contentX, y: yR, size, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
      yR -= size + 5
    }
    yR -= 6
  }

  function itemConViñeta(texto, size = 10.5) {
    const lineas = envolverTexto(texto, fontRegular, size, contentW - 14)
    lineas.forEach((linea, i) => {
      saltoDerechaSiHaceFalta(size + 4)
      const prefijo = i === 0 ? '•' : ' '
      page.drawText(prefijo, { x: contentX, y: yR, size, font: fontRegular, color: paleta.accento })
      page.drawText(linea, { x: contentX + 14, y: yR, size, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
      yR -= size + 4
    })
    yR -= 3
  }

  function entradaConTitulo(texto, size = 10.5) {
    const lineas = envolverTexto(texto, fontBold, size, contentW)
    lineas.forEach(linea => {
      saltoDerechaSiHaceFalta(size + 4)
      page.drawText(linea, { x: contentX, y: yR, size, font: fontBold, color: rgb(0.15, 0.15, 0.15) })
      yR -= size + 4
    })
  }

  // --- Encabezado ---
  titulo(datos.nombre)
  if (datos.cargo) subtitulo(datos.cargo)
  else yR -= 6

  // --- Perfil ---
  if (datos.perfil) {
    seccion('Perfil profesional')
    parrafo(datos.perfil)
  }

  // --- Experiencia ---
  if (datos.experiencia.length) {
    seccion('Experiencia laboral')
    datos.experiencia.forEach(({ cabecera, bullets }) => {
      if (cabecera) entradaConTitulo(cabecera)
      bullets.forEach(b => itemConViñeta(b))
      yR -= 6
    })
  }

  // --- Educación ---
  if (datos.educacion.length) {
    seccion('Educación')
    datos.educacion.forEach(edu => itemConViñeta(edu))
  }

  // --- Cursos ---
  if (datos.cursos.length) {
    seccion('Cursos')
    datos.cursos.forEach(c => itemConViñeta(c))
  }

  // --- Premios y logros ---
  if (datos.premios.length) {
    seccion('Premios y logros')
    datos.premios.forEach(p => itemConViñeta(p))
  }

  // --- Información adicional ---
  if (datos.infoAdicional) {
    seccion('Información adicional')
    parrafo(datos.infoAdicional)
  }

  return pdf.save()
}

const handler = async function (m, { conn, text, command }) {
  limpiarPendientesVencidos()

  if (!text || !text.includes(':')) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        `Uso:\n.${command} (puedes citar una foto para la sidebar)\nNombre: Juan Pérez\nCargo: Desarrollador Backend\nCiudad: Bogotá\nTelefono: +57 300 1234567\nEmail: juan@correo.com\nLinkedin: linkedin.com/in/juanperez\nPerfil: Breve resumen profesional...\nExperiencia: Empresa A - Cargo (2021-2023): logro uno | logro dos; Empresa B - Cargo: logro\nEducacion: Universidad X - Carrera (2016-2021)\nHabilidades: JavaScript, Node.js, Liderazgo\nIdiomas: Español: Nativo; Inglés: C1\nCursos: Curso de Excel - Udemy (2020)\nPremios: Reconocimiento X (2022)\nInfo: Disponibilidad inmediata\n\n💡 Varias experiencias/educaciones/cursos van separados con ";". Los logros dentro de una experiencia van separados con "|".`
      )
    }, { quoted: m })
  }

  const campos = parsearCampos(text)
  const datos = normalizarDatos(campos)

  // Foto opcional: si el usuario citó una imagen junto con .cv
  let fotoBuffer = null
  if (m.quoted && typeof m.quoted.download === 'function') {
    try {
      fotoBuffer = await m.quoted.download()
    } catch {
      fotoBuffer = null
    }
  }

  const sessionId = `cv_${m.sender}_${Date.now()}`
  global.__cvPending[sessionId] = {
    datos,
    sender: m.sender,
    timestamp: Date.now(),
    foto: fotoBuffer ? fotoBuffer.toString('base64') : null
  }

  const rows = [
    { title: '📄 Clásico', description: 'Sidebar azul, estilo profesional', id: `cv_gen|${sessionId}|clasico` },
    { title: '🌿 Moderno', description: 'Sidebar verde, estilo actual', id: `cv_gen|${sessionId}|moderno` },
    { title: '⚪ Minimalista', description: 'Sidebar gris oscuro, limpio', id: `cv_gen|${sessionId}|minimalista` }
  ]

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT · Generar CV',
      subtitle: `Datos listos para ${datos.nombre}`,
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: decorar('Elige una plantilla para tu hoja de vida 👇')
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎨 Elegir plantilla',
          sections: [{ title: 'Plantillas disponibles', rows }]
        })
      }]
    })
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { interactiveMessage } }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['cv', 'hojadevida', 'resume']
handler.help = ['cv (con campos Nombre/Cargo/Email/etc., citando foto opcional)']
handler.tags = ['tools']

handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId || !selectedId.startsWith('cv_gen|')) return false

  const [, sessionId, plantilla] = selectedId.split('|')
  const session = global.__cvPending[sessionId]

  if (!session) {
    await conn.sendMessage(m.chat, { text: decorar('⌛ Esta sesión expiró. Vuelve a ejecutar .cv con tus datos.') }, { quoted: m })
    return true
  }

  if (m.sender !== session.sender) {
    await conn.sendMessage(m.chat, { text: decorar('❌ Solo quien generó esta hoja de vida puede elegir la plantilla.') }, { quoted: m })
    return true
  }

  await conn.sendMessage(m.chat, { text: decorar('🛠️ Generando tu hoja de vida en PDF...') }, { quoted: m })

  try {
    const fotoBuffer = session.foto ? Buffer.from(session.foto, 'base64') : null
    const pdfBytes = await generarPDF(session.datos, plantilla, fotoBuffer)
    const nombreArchivo = `hoja-de-vida-${session.datos.nombre.replace(/\s+/g, '_').toLowerCase()}.pdf`
    const rutaTmp = path.join('tmp', nombreArchivo)
    fs.mkdirSync('tmp', { recursive: true })
    fs.writeFileSync(rutaTmp, pdfBytes)

    await conn.sendMessage(m.chat, {
      document: fs.readFileSync(rutaTmp),
      fileName: nombreArchivo,
      mimetype: 'application/pdf',
      caption: decorar(`✅ Hoja de vida generada (plantilla: ${plantilla}).`)
    }, { quoted: m })

    fs.unlinkSync(rutaTmp)
    delete global.__cvPending[sessionId]
  } catch (e) {
    console.error(e)
    await conn.sendMessage(m.chat, { text: decorar('❌ Ocurrió un error generando el PDF.') }, { quoted: m })
  }

  return true
}

export default handler
