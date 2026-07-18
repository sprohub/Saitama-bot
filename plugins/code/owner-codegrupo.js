/**
 * plugins/owner/owner-codegrupo.js
 * Comando: .codegrupo <numero>
 *
 * Ahora es un comando DOBLE, según quién lo use:
 *
 * ── Si lo usa un OWNER ──
 * <numero> = número del CLIENTE al que le vas a generar el código.
 * Elige duración con botones → se genera el código real de una vez
 * (igual que antes).
 *
 * ── Si lo usa cualquier otra persona ──
 * <numero> = número del OWNER al que le quiere comprar la licencia.
 * Elige duración con botones → NO se genera ningún código todavía.
 * En vez de eso:
 *   1) Se le muestra al comprador el número de ese owner para que lo
 *      contacte y pague
 *   2) Al owner le llega un mensaje PRIVADO avisándole que alguien
 *      quiere comprar, con el número del comprador y la duración que
 *      quiere
 *   3) El owner cobra por fuera del bot, y cuando quiera generar el
 *      código real usa .codegrupo <numero-del-comprador> él mismo
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { generarCodigo, DURACIONES, esNumeroOwner } from '../../lib/licencias.js'

global.__codegrupoPending = global.__codegrupoPending || {}
global.__compraPending = global.__compraPending || {}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function esOwner(m) {
  const numero = m.sender?.split('@')[0]
  return m.fromMe || (global.owner || []).some(([num]) => num.replace(/[^0-9]/g, '') === numero)
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

function construirMenuDuracion({ titulo, subtitulo, cuerpo, idPrefix }) {
  const rows = Object.entries(DURACIONES)
    .filter(([key]) => idPrefix.startsWith('codegrupo_gen') || key !== 'infinito') // los compradores normales no ven "infinito"
    .map(([key, { label }]) => ({
      title: label,
      description: key === 'infinito' ? 'Licencia permanente' : `Vence en ${label.replace('📅 ', '')}`,
      id: `${idPrefix}|${key}`
    }))

  return proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: titulo,
      subtitle: subtitulo,
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({ text: decorar(cuerpo) }),
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
}

const handler = async function (m, { conn, text, command }) {
  const numero = (text || '').trim().replace(/[^0-9]/g, '')

  if (!numero || numero.length < 8) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Uso:\n.${command} <numero>\n\nEjemplo:\n.${command} 573001234567`)
    }, { quoted: m })
  }

  // ── Camino 1: lo usa un OWNER → genera código real para un cliente ──
  if (esOwner(m)) {
    const sessionId = `codegrupo_${m.sender}_${Date.now()}`
    global.__codegrupoPending[sessionId] = { numero, sender: m.sender, timestamp: Date.now() }

    const interactiveMessage = construirMenuDuracion({
      titulo: '🌿 SAITAMA-BOT · Generar Código',
      subtitulo: `Para el número ${numero}`,
      cuerpo: 'Elige la duración de la licencia 👇',
      idPrefix: `codegrupo_gen|${sessionId}`
    })

    const waMsg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { interactiveMessage } }
    }, { quoted: m, userJid: conn.user.jid })

    await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
    return
  }

  // ── Camino 2: lo usa un comprador → solicitud de compra ──
  if (!esNumeroOwner(numero)) {
    return conn.sendMessage(m.chat, {
      text: decorar('❌ Ese número no corresponde a ningún vendedor válido.')
    }, { quoted: m })
  }

  const sessionId = `compra_${m.sender}_${Date.now()}`
  global.__compraPending[sessionId] = {
    numeroOwner: numero,
    compradorJid: m.sender,
    compradorChat: m.chat,
    timestamp: Date.now()
  }

  const interactiveMessage = construirMenuDuracion({
    titulo: '🌿 SAITAMA-BOT · Comprar Licencia',
    subtitulo: `Vendedor: ${numero}`,
    cuerpo: '¿Por cuánto tiempo quieres la licencia para tu grupo? 👇',
    idPrefix: `compra_sel|${sessionId}`
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { interactiveMessage } }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['codegrupo']
handler.help = ['codegrupo <numero> (owner: genera código · usuario: solicita comprar)']
handler.tags = ['group']
handler.register = false

handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId) return false

  // --- Owner seleccionó duración → generar código real ---
  if (selectedId.startsWith('codegrupo_gen|')) {
    const [, sessionId, duracionKey] = selectedId.split('|')
    const session = global.__codegrupoPending[sessionId]

    if (!session) {
      await conn.sendMessage(m.chat, { text: decorar('⌛ Esta sesión expiró. Vuelve a usar .codegrupo.') }, { quoted: m })
      return true
    }
    if (!esOwner(m)) {
      await conn.sendMessage(m.chat, { text: decorar('❌ Solo el owner puede usar esto.') }, { quoted: m })
      return true
    }

    try {
      const codigo = await generarCodigo(session.numero, duracionKey, m.sender)
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

  // --- Comprador seleccionó duración → avisar al owner + mostrar contacto ---
  if (selectedId.startsWith('compra_sel|')) {
    const [, sessionId, duracionKey] = selectedId.split('|')
    const session = global.__compraPending[sessionId]

    if (!session) {
      await conn.sendMessage(m.chat, { text: decorar('⌛ Esta solicitud expiró. Vuelve a usar .codegrupo.') }, { quoted: m })
      return true
    }

    const duracionLabel = DURACIONES[duracionKey]?.label || duracionKey
    const compradorNumero = session.compradorJid.split('@')[0]
    const ownerJidDestino = `${session.numeroOwner}@s.whatsapp.net`

    // Avisar al owner por privado
    try {
      await conn.sendMessage(ownerJidDestino, {
        text: decorar(
          `🔔 Alguien quiere comprar una licencia\n\n` +
          `📱 Comprador: +${compradorNumero}\n` +
          `⏱️ Duración pedida: ${duracionLabel}\n\n` +
          `Cóntactalo para cobrar. Cuando quieras darle su código, usa:\n.codegrupo ${compradorNumero}`
        )
      })
    } catch (e) {
      console.error('[codegrupo] ERROR notificando al owner:', e)
    }

    // Mostrarle al comprador el contacto del owner
    await conn.sendMessage(session.compradorChat, {
      text: decorar(
        `📩 Solicitud enviada\n\n` +
        `⏱️ Duración pedida: ${duracionLabel}\n\n` +
        `Contacta a +${session.numeroOwner} (https://wa.me/${session.numeroOwner}) para pagar y recibir tu código.\n\n` +
        `Cuando te lo den, actívalo con:\n.canjear <codigo>`
      )
    }, { quoted: m })

    delete global.__compraPending[sessionId]
    return true
  }

  return false
}

export default handler
