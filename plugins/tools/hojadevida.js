/**
 * plugins/tools/hojadevida.js
 * Comando: .cv
 *
 * Genera una hoja de vida (CV) en PDF a partir de datos que el usuario
 * escribe en formato "Campo: valor". Deja elegir plantilla con botones
 * y produce el PDF con pdf-lib (misma librería que .mgpdf).
 *
 * Uso:
 * .cv
 * Nombre: Juan Pérez
 * Cargo: Desarrollador Backend
 * Telefono: +57 300 1234567
 * Email: juan@correo.com
 * Ciudad: Bogotá
 * Resumen: Breve resumen profesional en 2-3 líneas...
 * Experiencia: Empresa A - Cargo (2021-2023): logros...; Empresa B - Cargo (2023-actual): logros...
 * Educacion: Universidad X - Ingeniería (2016-2021)
 * Habilidades: JavaScript, Node.js, MongoDB, Liderazgo
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
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

function normalizarDatos(campos) {
  return {
    nombre: campos['nombre'] || 'Sin nombre',
    cargo: campos['cargo'] || '',
    telefono: campos['telefono'] || campos['teléfono'] || '',
    email: campos['email'] || campos['correo'] || '',
    ciudad: campos['ciudad'] || '',
    resumen: campos['resumen'] || '',
    experiencia: (campos['experiencia'] || '').split(';').map(s => s.trim()).filter(Boolean),
    educacion: (campos['educacion'] || campos['educación'] || '').split(';').map(s => s.trim()).filter(Boolean),
    habilidades: (campos['habilidades'] || '').split(',').map(s => s.trim()).filter(Boolean)
  }
}

// Envuelve texto a un ancho máximo en puntos, usando la fuente dada
function envolverTexto(texto, font, size, maxWidth) {
  const palabras = texto.split(' ')
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

const COLORES = {
  clasico: rgb(0.15, 0.15, 0.15),
  moderno: rgb(0.05, 0.4, 0.25),   // verde, a tono con el bot
  minimalista: rgb(0.3, 0.3, 0.3)
}

async function generarPDF(datos, plantilla) {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const colorAcento = COLORES[plantilla] || COLORES.clasico

  const margen = 50
  let y = height - margen
  const maxWidth = width - margen * 2

  function nuevaLineaSiHaceFalta(alturaNecesaria) {
    if (y - alturaNecesaria < margen) {
      page = pdf.addPage([595.28, 841.89])
      y = height - margen
    }
  }

  function titulo(texto, size = 22) {
    nuevaLineaSiHaceFalta(size + 10)
    page.drawText(texto, { x: margen, y, size, font: fontBold, color: colorAcento })
    y -= size + 8
  }

  function subtitulo(texto, size = 11) {
    nuevaLineaSiHaceFalta(size + 6)
    page.drawText(texto, { x: margen, y, size, font: fontRegular, color: rgb(0.35, 0.35, 0.35) })
    y -= size + 10
  }

  function seccion(texto) {
    nuevaLineaSiHaceFalta(30)
    y -= 6
    page.drawText(texto.toUpperCase(), { x: margen, y, size: 13, font: fontBold, color: colorAcento })
    y -= 4
    page.drawLine({ start: { x: margen, y: y - 2 }, end: { x: width - margen, y: y - 2 }, thickness: 1, color: colorAcento })
    y -= 16
  }

  function parrafo(texto, size = 10.5) {
    const lineas = envolverTexto(texto, fontRegular, size, maxWidth)
    for (const linea of lineas) {
      nuevaLineaSiHaceFalta(size + 4)
      page.drawText(linea, { x: margen, y, size, font: fontRegular, color: rgb(0.15, 0.15, 0.15) })
      y -= size + 5
    }
    y -= 4
  }

  function itemConViñeta(texto, size = 10.5) {
    const lineas = envolverTexto(texto, fontRegular, size, maxWidth - 14)
    lineas.forEach((linea, i) => {
      nuevaLineaSiHaceFalta(size + 4)
      const prefijo = i === 0 ? '•' : ' '
      page.drawText(prefijo, { x: margen, y, size, font: fontRegular, color: colorAcento })
      page.drawText(linea, { x: margen + 14, y, size, font: fontRegular, color: rgb(0.15, 0.15, 0.15) })
      y -= size + 4
    })
    y -= 4
  }

  // --- Encabezado ---
  titulo(datos.nombre, 24)
  const lineaContacto = [datos.cargo, datos.ciudad, datos.telefono, datos.email].filter(Boolean).join('   ·   ')
  if (lineaContacto) subtitulo(lineaContacto)
  y -= 6

  // --- Resumen ---
  if (datos.resumen) {
    seccion('Perfil profesional')
    parrafo(datos.resumen)
  }

  // --- Experiencia ---
  if (datos.experiencia.length) {
    seccion('Experiencia laboral')
    datos.experiencia.forEach(exp => itemConViñeta(exp))
  }

  // --- Educación ---
  if (datos.educacion.length) {
    seccion('Educación')
    datos.educacion.forEach(edu => itemConViñeta(edu))
  }

  // --- Habilidades ---
  if (datos.habilidades.length) {
    seccion('Habilidades')
    parrafo(datos.habilidades.join('  •  '))
  }

  return pdf.save()
}

const handler = async function (m, { conn, text, command }) {
  limpiarPendientesVencidos()

  if (!text || !text.includes(':')) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        `Uso:\n.${command}\nNombre: Juan Pérez\nCargo: Desarrollador Backend\nTelefono: +57 300 1234567\nEmail: juan@correo.com\nCiudad: Bogotá\nResumen: Breve resumen profesional...\nExperiencia: Empresa A - Cargo (2021-2023): logros...; Empresa B - Cargo: logros...\nEducacion: Universidad X - Carrera (2016-2021)\nHabilidades: JavaScript, Node.js, Liderazgo\n\n💡 Separa varias experiencias/estudios con ";"`
      )
    }, { quoted: m })
  }

  const campos = parsearCampos(text)
  const datos = normalizarDatos(campos)

  const sessionId = `cv_${m.sender}_${Date.now()}`
  global.__cvPending[sessionId] = { datos, sender: m.sender, timestamp: Date.now() }

  const rows = [
    { title: '📄 Clásico', description: 'Estilo formal, tinta negra', id: `cv_gen|${sessionId}|clasico` },
    { title: '🌿 Moderno', description: 'Acentos en verde, estilo actual', id: `cv_gen|${sessionId}|moderno` },
    { title: '⚪ Minimalista', description: 'Limpio, gris neutro', id: `cv_gen|${sessionId}|minimalista` }
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
handler.help = ['cv (con campos Nombre/Cargo/Email/etc.)']
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
    const pdfBytes = await generarPDF(session.datos, plantilla)
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
