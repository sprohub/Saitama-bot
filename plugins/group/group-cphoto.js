// plugins/owner/cphoto.js — .cphoto / /cphoto / #cphoto / @cphoto (owner)
// Cambia la foto de perfil DEL BOT o de UN GRUPO, a partir de una imagen citada.
// Flujo: citas una imagen + .cphoto -> aparece menú (Foto del Bot / lista de Grupos)
//        -> al elegir, se aplica automáticamente (la imagen se recorta/ajusta sola).

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
// getLidFromJid autocontenido (evita depender de un export que no exista en lib/simple.js).
// Si tu proyecto ya tiene esta función en otro archivo, puedes borrar esto e importarla de ahí.
async function getLidFromJid(jid, conn) {
  try {
    const lid = await conn.signalRepository?.lidMapping?.getLIDForPN?.(jid)
    return lid || null
  } catch {
    return null
  }
}

const execAsync = promisify(exec)

// ───────────────────────────────────────────
// Almacenamiento temporal de la imagen pendiente (expira a los 5 min)
// ───────────────────────────────────────────
if (!global.__cphotoPending) global.__cphotoPending = {}

function guardarPendiente(senderId, buffer) {
  if (global.__cphotoPending[senderId]?.timeout) {
    clearTimeout(global.__cphotoPending[senderId].timeout)
  }
  const timeout = setTimeout(() => {
    delete global.__cphotoPending[senderId]
  }, 5 * 60 * 1000)
  global.__cphotoPending[senderId] = { buffer, timeout }
}

// ───────────────────────────────────────────
// Hace la imagen "compatible" con foto de perfil de WhatsApp:
// recorte cuadrado centrado + 640x640 + jpg optimizado
// ───────────────────────────────────────────
async function toProfileImage(buffer) {
  const tmpIn = path.join(os.tmpdir(), `cphoto_in_${Date.now()}.jpg`)
  const tmpOut = path.join(os.tmpdir(), `cphoto_out_${Date.now()}.jpg`)
  fs.writeFileSync(tmpIn, buffer)
  try {
    await execAsync(
      `ffmpeg -y -i "${tmpIn}" -vf "crop='min(iw,ih)':'min(iw,ih)',scale=640:640" -q:v 4 "${tmpOut}"`
    )
    return fs.readFileSync(tmpOut)
  } finally {
    if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn)
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut)
  }
}

// ───────────────────────────────────────────
// Utilidades del menú interactivo (mismo patrón que grupos.js / setphoto.js)
// ───────────────────────────────────────────
function unwrapMessage(message) {
  if (!message) return message
  if (message.ephemeralMessage) return unwrapMessage(message.ephemeralMessage.message)
  if (message.viewOnceMessage) return unwrapMessage(message.viewOnceMessage.message)
  if (message.viewOnceMessageV2) return unwrapMessage(message.viewOnceMessageV2.message)
  if (message.documentWithCaptionMessage) return unwrapMessage(message.documentWithCaptionMessage.message)
  return message
}

function extractSelectedId(content) {
  try {
    const interactive = content?.interactiveResponseMessage
    if (!interactive) return null
    const params = JSON.parse(interactive.nativeFlowResponseMessage?.paramsJson || '{}')
    return params.id || null
  } catch {
    return null
  }
}

async function esOwner(conn, senderJid) {
  if (!global.owner || !Array.isArray(global.owner)) return false
  const senderLid = await getLidFromJid(senderJid, conn)
  const numeros = global.owner.map(([number]) => (number || '').replace(/[^0-9]/g, ''))
  return numeros.some((num) => senderJid.includes(num) || (senderLid && senderLid.includes(num)))
}

// ───────────────────────────────────────────
// Comando principal
// ───────────────────────────────────────────
const handler = async (m, { conn, text }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''

  if (!mime.startsWith('image/')) {
    return conn.sendMessage(
      m.chat,
      { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Debes citar una *imagen* junto con el comando .cphoto\n╰───────────────⬣' },
      { quoted: m }
    )
  }

  const buffer = await quoted.download()
  const imagenLista = await toProfileImage(buffer)
  guardarPendiente(m.sender, imagenLista)

  // Lista de grupos donde está el bot
  const chats = await conn.groupFetchAllParticipating()
  const grupos = Object.values(chats)

  const rowsGrupos = grupos.map((g) => ({
    title: g.subject,
    description: `${g.participants.length} miembros`,
    id: `cphoto|group|${g.id}`
  }))

  const sections = [
    {
      title: '⚙️ Opciones',
      rows: [
        { title: '🤖 Foto del Bot', description: 'Actualizar la foto de perfil del bot', id: 'cphoto|bot' }
      ]
    }
  ]

  if (rowsGrupos.length) {
    sections.push({ title: '🌿 Grupos', rows: rowsGrupos })
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT — Cambiar Foto',
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: '│ 🍃 Selecciona a quién le quieres cambiar la foto de perfil:'
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🌿 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: 'Ver opciones',
            sections
          })
        }
      ]
    })
  })

  const msg = generateWAMessageFromContent(
    m.chat,
    { viewOnceMessage: { message: { interactiveMessage } } },
    { quoted: m, userJid: conn.user.id }
  )

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

handler.command = ['cphoto']
handler.customPrefix = /^[.\/#@]/
handler.owner = true

// ───────────────────────────────────────────
// handler.before — procesa el botón (seguridad manual, owner-only)
// ───────────────────────────────────────────
handler.before = async function (m, { conn }) {
  const message = unwrapMessage(m.message)
  const selectedId = extractSelectedId(message)
  if (!selectedId || !selectedId.startsWith('cphoto|')) return false

  const permitido = m.fromMe || (await esOwner(conn, m.sender))
  if (!permitido) {
    await conn.sendMessage(m.chat, { text: '❌ Solo el owner puede usar este botón.' }, { quoted: m })
    return true
  }

  const pendiente = global.__cphotoPending[m.sender]
  if (!pendiente) {
    await conn.sendMessage(
      m.chat,
      { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 La imagen expiró, vuelve a enviar .cphoto citando la foto.\n╰───────────────⬣' },
      { quoted: m }
    )
    return true
  }

  const partes = selectedId.split('|') // ['cphoto', 'bot']  ó  ['cphoto', 'group', '123@g.us']
  const destino = partes[1] === 'bot' ? conn.user.id : partes[2]
  const nombreDestino = partes[1] === 'bot' ? 'del Bot' : 'del Grupo'

  try {
    await conn.updateProfilePicture(destino, pendiente.buffer)
    clearTimeout(pendiente.timeout)
    delete global.__cphotoPending[m.sender]

    await conn.sendMessage(
      m.chat,
      {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ¡Foto de perfil ${nombreDestino} actualizada con éxito!\n╰───────────────⬣`
      },
      { quoted: m }
    )
  } catch (err) {
    await conn.sendMessage(
      m.chat,
      { text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Error al actualizar la foto: ${err.message}\n╰───────────────⬣` },
      { quoted: m }
    )
  }

  return true
}

export default handler
