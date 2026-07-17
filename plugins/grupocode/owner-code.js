/**
 * plugins/owner/owner-codegrupo.js
 * Comando: .codegrupo <numero>
 *
 * SOLO PARA OWNERS. Genera un código de licencia único para un
 * número de teléfono específico. Ese código solo se puede canjear
 * (con .canjear) desde ESE número, dentro del grupo que quieras
 * autorizar.
 *
 * Uso:
 * .codegrupo 573001234567
 * → Muestra un menú de botones para elegir la duración de la licencia
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { generarCodigo, DURACIONES } from '../../lib/licencias.js'

global.__codegrupoPending = global.__codegrupoPending || {}

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

const handler = async function (m, { conn, text, command }) {
  const numero = (text || '').trim().replace(/[^0-9]/g, '')

  if (!numero || numero.length < 8) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Uso:\n.${command} <numero>\n\nEjemplo:\n.${command} 573001234567`)
    }, { quoted: m })
  }

  const sessionId = `codegrupo_${m.sender}_${Date.now()}`
  global.__codegrupoPending[sessionId] = {
    numero,
    sender: m.sender,
    timestamp: Date.now()
  }

  const rows = Object.entries(DURACIONES).map(([key, { label }]) => ({
    title: label,
    description: key === 'infinito' ? 'Licencia permanente' : `Vence en ${label.replace('📅 ', '')}`,
    id: `codegrupo_gen|${sessionId}|${key}`
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT · Generar Código',
      subtitle: `Para el número ${numero}`,
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: decorar('Elige la duración de la licencia 👇')
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '⏱️ Elegir duración',
          sections: [{ title: 'Duraciones disponibles', rows }]
        })
      }]
    })
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { interactiveMessage } }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['codegrupo']
handler.help = ['codegrupo <numero> (genera un código de licencia para ese número)']
handler.tags = ['owner']
handler.owner = true
handler.rowner = true

handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId || !selectedId.startsWith('codegrupo_gen|')) return false

  const isROwner = [...global.owner.map(([number]) => number)]
    .map(v => v.replace(/[^0-9]/g, '') + (m.sender.includes('@lid') ? '@lid' : '@s.whatsapp.net'))
    .includes(m.sender)

  if (!isROwner) {
    await conn.sendMessage(m.chat, { text: decorar('❌ Solo el owner puede usar esto.') }, { quoted: m })
    return true
  }

  const [, sessionId, duracionKey] = selectedId.split('|')
  const session = global.__codegrupoPending[sessionId]

  if (!session) {
    await conn.sendMessage(m.chat, { text: decorar('⌛ Esta sesión expiró. Vuelve a usar .codegrupo.') }, { quoted: m })
    return true
  }

  try {
    const codigo = generarCodigo(session.numero, duracionKey, m.sender)
    const duracionLabel = DURACIONES[duracionKey].label

    await conn.sendMessage(m.chat, {
      text: decorar(
        `✅ Código generado\n\n` +
        `📱 Número: ${session.numero}\n` +
        `⏱️ Duración: ${duracionLabel}\n` +
        `🔑 Código: *${codigo}*\n\n` +
        `Dale este código a esa persona. Solo podrá canjearlo desde ese número, dentro del grupo que quiera activar, con:\n.canjear ${codigo}`
      )
    }, { quoted: m })
  } catch (e) {
    console.error('[codegrupo] ERROR generando código:', e)
    await conn.sendMessage(m.chat, { text: decorar('❌ No se pudo generar el código.') }, { quoted: m })
  }

  delete global.__codegrupoPending[sessionId]
  return true
}

export default handler
