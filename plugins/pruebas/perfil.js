/**
 * plugins/tools/perfil.js
 * Comando: .perfil
 *
 * Perfil de usuario con foto, nombre, descripción editable, 5
 * plantillas visuales distintas (cada una recoloreable entre 30
 * colores), y fondo personalizado opcional.
 *
 * Uso:
 * .perfil                    → muestra tu tarjeta de perfil
 * .perfil desc <texto>       → cambia tu descripción
 * .perfil plantilla          → menú de botones para elegir plantilla
 * .perfil color              → menú de botones para elegir color
 * .perfil fondo (citando imagen) → pone esa imagen como fondo
 * .perfil fondo off          → quita el fondo personalizado
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { generarTarjetaPerfil, COLORES, PLANTILLAS } from '../../lib/profileCard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONDOS_DIR = path.join(__dirname, '..', '..', 'storage', 'perfiles', 'fondos')
const FILAS_POR_SECCION = 10

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
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

function getPerfil(m) {
  const user = global.db.data.users[m.sender]
  if (!user.perfilConfig) {
    user.perfilConfig = { descripcion: '', plantilla: 'clasico', color: 'azul' }
  }
  return user.perfilConfig
}

function rutaFondo(numero) {
  return path.join(FONDOS_DIR, `${numero}.jpg`)
}

async function mostrarPerfil(m, conn) {
  const perfil = getPerfil(m)
  const numero = m.sender.split('@')[0]

  let fotoUrl
  try {
    fotoUrl = await conn.profilePictureUrl(m.sender, 'image')
  } catch {
    return conn.sendMessage(m.chat, {
      text: decorar('No tienes foto de perfil en WhatsApp, ponte una primero.')
    }, { quoted: m })
  }

  const fondoPath = rutaFondo(numero)
  const tieneFondo = fs.existsSync(fondoPath)

  try {
    const tarjeta = await generarTarjetaPerfil({
      fotoUrl,
      fondoBuffer: tieneFondo ? fs.readFileSync(fondoPath) : null,
      nombre: conn.getName ? conn.getName(m.sender) : numero,
      descripcion: perfil.descripcion,
      plantilla: perfil.plantilla,
      color: perfil.color
    })

    await conn.sendMessage(m.chat, {
      image: tarjeta,
      caption: decorar(`Plantilla: ${perfil.plantilla} · Color: ${perfil.color}`)
    }, { quoted: m })
  } catch (e) {
    console.error('[perfil] ERROR generando tarjeta:', e)
    await conn.sendMessage(m.chat, { text: decorar('❌ No se pudo generar tu tarjeta de perfil.') }, { quoted: m })
  }
}

const handler = async (m, { conn, text, command }) => {
  if (!global.db.data.users[m.sender]) global.db.data.users[m.sender] = {}
  const sub = (text || '').trim()
  const subLower = sub.toLowerCase()

  // --- .perfil desc <texto> ---
  if (subLower.startsWith('desc')) {
    const nuevaDesc = sub.slice(4).trim()
    if (!nuevaDesc) {
      return conn.sendMessage(m.chat, { text: decorar('Escribe tu descripción.\nEjemplo: .perfil desc Amante del anime y el café ☕') }, { quoted: m })
    }
    const perfil = getPerfil(m)
    perfil.descripcion = nuevaDesc.slice(0, 150)
    return conn.sendMessage(m.chat, { text: decorar('✅ Descripción actualizada.') }, { quoted: m })
  }

  // --- .perfil fondo off ---
  if (subLower === 'fondo off' || subLower === 'fondooff') {
    const numero = m.sender.split('@')[0]
    const fondoPath = rutaFondo(numero)
    if (fs.existsSync(fondoPath)) fs.unlinkSync(fondoPath)
    return conn.sendMessage(m.chat, { text: decorar('✅ Fondo personalizado quitado.') }, { quoted: m })
  }

  // --- .perfil fondo (citando imagen) ---
  if (subLower === 'fondo') {
    if (!m.quoted || typeof m.quoted.download !== 'function') {
      return conn.sendMessage(m.chat, { text: decorar('Cita una imagen junto con .perfil fondo para usarla de fondo.') }, { quoted: m })
    }
    try {
      const buffer = await m.quoted.download()
      fs.mkdirSync(FONDOS_DIR, { recursive: true })
      fs.writeFileSync(rutaFondo(m.sender.split('@')[0]), buffer)
      return conn.sendMessage(m.chat, { text: decorar('✅ Fondo actualizado. Usa .perfil para verlo.') }, { quoted: m })
    } catch (e) {
      console.error('[perfil] ERROR guardando fondo:', e)
      return conn.sendMessage(m.chat, { text: decorar('❌ No se pudo guardar el fondo.') }, { quoted: m })
    }
  }

  // --- .perfil plantilla → menú de botones ---
  if (subLower === 'plantilla') {
    const rows = PLANTILLAS.map(p => ({
      title: p.nombre,
      description: 'Toca para usar esta plantilla',
      id: `perfil_plantilla|${p.key}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: proto.Message.InteractiveMessage.Header.create({
        title: '🌿 SAITAMA-BOT · Plantillas',
        subtitle: 'Elige el estilo de tu perfil',
        hasMediaAttachment: false
      }),
      body: proto.Message.InteractiveMessage.Body.create({ text: decorar('Toca una plantilla 👇') }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🎨 Elegir', sections: [{ title: '5 plantillas', rows }] }) }]
      })
    })

    const waMsg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { interactiveMessage } } }, { quoted: m, userJid: conn.user.jid })
    await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
    return
  }

  // --- .perfil color → menú de botones (30 colores, en secciones de 10) ---
  if (subLower === 'color') {
    const sections = []
    for (let i = 0; i < COLORES.length; i += FILAS_POR_SECCION) {
      const chunk = COLORES.slice(i, i + FILAS_POR_SECCION)
      sections.push({
        title: `Colores ${i + 1}-${i + chunk.length}`,
        rows: chunk.map(c => ({
          title: c.nombre,
          description: c.hex,
          id: `perfil_color|${c.nombre}`
        }))
      })
    }

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: proto.Message.InteractiveMessage.Header.create({
        title: '🌿 SAITAMA-BOT · Colores',
        subtitle: `${COLORES.length} colores disponibles`,
        hasMediaAttachment: false
      }),
      body: proto.Message.InteractiveMessage.Body.create({ text: decorar('Toca un color 👇') }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🎨 Elegir', sections }) }]
      })
    })

    const waMsg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { interactiveMessage } } }, { quoted: m, userJid: conn.user.jid })
    await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
    return
  }

  // --- .perfil (sin argumentos) → mostrar la tarjeta ---
  await mostrarPerfil(m, conn)
}

handler.command = ['perfil']
handler.help = ['perfil', 'perfil desc <texto>', 'perfil plantilla', 'perfil color', 'perfil fondo']
handler.tags = ['tools']

handler.before = async (m, { conn }) => {
  const selectedId = extractSelectedId(m)
  if (!selectedId) return false

  if (!global.db.data.users[m.sender]) global.db.data.users[m.sender] = {}
  const perfil = getPerfil(m)

  if (selectedId.startsWith('perfil_plantilla|')) {
    const plantilla = selectedId.split('|')[1]
    perfil.plantilla = plantilla
    await conn.sendMessage(m.chat, { text: decorar(`✅ Plantilla cambiada a "${plantilla}". Usa .perfil para verla.`) }, { quoted: m })
    return true
  }

  if (selectedId.startsWith('perfil_color|')) {
    const color = selectedId.split('|')[1]
    perfil.color = color
    await conn.sendMessage(m.chat, { text: decorar(`✅ Color cambiado a "${color}". Usa .perfil para verlo.`) }, { quoted: m })
    return true
  }

  return false
}

export default handler
