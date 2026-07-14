/**
 * plugins/tools/nequi-transferir.js
 * Comando: .nequi
 *
 * PLANTILLA de transferencias Nequi. Pide número, nombre y monto en
 * formato "Campo: valor", muestra una confirmación con botones, y al
 * confirmar llama a `ejecutarTransferenciaNequi()` — ahí es donde
 * conectas tu integración real con Nequi (API, RPA, lo que uses).
 *
 * Uso:
 * .nequi
 * Numero: 3001234567
 * Nombre: Juan Pérez
 * Monto: 50000
 *
 * IMPORTANTE — esto es solo el flujo de conversación (recolección de
 * datos + confirmación). NO mueve dinero por sí solo. La función
 * ejecutarTransferenciaNequi() está marcada con TODO y debes
 * reemplazarla por tu propia lógica de conexión con Nequi.
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

global.__nequiPending = global.__nequiPending || {}

const TIEMPO_EXPIRACION_MS = 5 * 60 * 1000

function limpiarPendientesVencidos() {
  const ahora = Date.now()
  for (const key of Object.keys(global.__nequiPending)) {
    if (ahora - global.__nequiPending[key].timestamp > TIEMPO_EXPIRACION_MS) {
      delete global.__nequiPending[key]
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

// Parsea "Campo: valor" línea por línea
function parsearCampos(texto) {
  const campos = {}
  const lineas = texto.split('\n')
  for (const linea of lineas) {
    const match = linea.match(/^\s*([A-Za-zÁÉÍÓÚáéíóúñÑ ]+)\s*:\s*(.*)$/)
    if (match) {
      campos[match[1].trim().toLowerCase()] = match[2].trim()
    }
  }
  return campos
}

function formatearMonto(numero) {
  return new Intl.NumberFormat('es-CO').format(numero)
}

// Valida y normaliza un número de celular colombiano (10 dígitos, empieza en 3)
function normalizarNumero(valor) {
  const soloDigitos = (valor || '').replace(/[^0-9]/g, '')
  if (!/^3\d{9}$/.test(soloDigitos)) return null
  return soloDigitos
}

/**
 * 🔌 AQUÍ CONECTAS TU NEQUI 🔌
 *
 * Reemplaza este cuerpo por tu integración real (API oficial de
 * Nequi, un agregador de pagos, o el método que estés usando).
 *
 * Debe devolver un objeto:
 *   { exito: true,  referencia: 'ABC123' }
 *   { exito: false, error: 'mensaje del motivo del fallo' }
 */
async function ejecutarTransferenciaNequi({ numero, nombre, monto, sender }) {
  // TODO: reemplazar con la llamada real a tu API/servicio de Nequi.
  // Ejemplo orientativo (descomenta y ajusta cuando tengas tu API):
  //
  // const resp = await fetch('https://tu-api-nequi.com/transferir', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer TU_TOKEN' },
  //   body: JSON.stringify({ numero, nombre, monto })
  // })
  // const data = await resp.json()
  // if (!resp.ok || !data.exito) {
  //   return { exito: false, error: data.error || 'La API de Nequi rechazó la transferencia' }
  // }
  // return { exito: true, referencia: data.referencia }

  throw new Error(
    'ejecutarTransferenciaNequi() todavía no está conectada a Nequi. ' +
    'Edita esta función en nequi-transferir.js con tu integración real.'
  )
}

const handler = async function (m, { conn, text, command }) {
  limpiarPendientesVencidos()

  if (!text || !text.includes(':')) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        `Uso:\n.${command}\nNumero: 3001234567\nNombre: Juan Pérez\nMonto: 50000`
      )
    }, { quoted: m })
  }

  const campos = parsearCampos(text)
  const numeroCrudo = campos['numero'] || campos['número'] || campos['celular']
  const nombre = campos['nombre'] || ''
  const montoCrudo = campos['monto'] || campos['valor'] || campos['cantidad']

  const numero = normalizarNumero(numeroCrudo)
  const monto = Number((montoCrudo || '').replace(/[^0-9]/g, ''))

  if (!numero) {
    return conn.sendMessage(m.chat, {
      text: decorar('❌ El número no es válido. Debe ser un celular colombiano de 10 dígitos (ej: 3001234567).')
    }, { quoted: m })
  }

  if (!nombre) {
    return conn.sendMessage(m.chat, {
      text: decorar('❌ Falta el campo Nombre.')
    }, { quoted: m })
  }

  if (!monto || monto <= 0) {
    return conn.sendMessage(m.chat, {
      text: decorar('❌ El monto no es válido. Escribe solo números (ej: Monto: 50000).')
    }, { quoted: m })
  }

  const sessionId = `nequi_${m.sender}_${Date.now()}`
  global.__nequiPending[sessionId] = {
    numero,
    nombre,
    monto,
    sender: m.sender,
    timestamp: Date.now()
  }

  const rows = [
    { title: '✅ Confirmar transferencia', description: 'Se enviará el dinero ahora', id: `nequi_conf|${sessionId}|si` },
    { title: '❌ Cancelar', description: 'No se hará ningún envío', id: `nequi_conf|${sessionId}|no` }
  ]

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT · Transferencia Nequi',
      subtitle: 'Revisa los datos antes de confirmar',
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: decorar(
        `Vas a transferir:\n\n` +
        `👤 Nombre: ${nombre}\n` +
        `📱 Número: ${numero}\n` +
        `💰 Monto: $${formatearMonto(monto)}\n\n` +
        `¿Confirmas el envío?`
      )
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '💸 Confirmar',
          sections: [{ title: 'Transferencia Nequi', rows }]
        })
      }]
    })
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { interactiveMessage } }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['nequi', 'transferir']
handler.help = ['nequi (con Numero/Nombre/Monto, pide confirmación antes de enviar)']
handler.tags = ['tools']

handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId || !selectedId.startsWith('nequi_conf|')) return false

  const [, sessionId, respuesta] = selectedId.split('|')
  const session = global.__nequiPending[sessionId]

  if (!session) {
    await conn.sendMessage(m.chat, { text: decorar('⌛ Esta transferencia expiró. Vuelve a usar .nequi.') }, { quoted: m })
    return true
  }

  if (m.sender !== session.sender) {
    await conn.sendMessage(m.chat, { text: decorar('❌ Solo quien inició la transferencia puede confirmarla.') }, { quoted: m })
    return true
  }

  if (respuesta === 'no') {
    delete global.__nequiPending[sessionId]
    await conn.sendMessage(m.chat, { text: decorar('🚫 Transferencia cancelada.') }, { quoted: m })
    return true
  }

  await conn.sendMessage(m.chat, { text: decorar('⏳ Procesando transferencia...') }, { quoted: m })

  try {
    const resultado = await ejecutarTransferenciaNequi({
      numero: session.numero,
      nombre: session.nombre,
      monto: session.monto,
      sender: session.sender
    })

    if (resultado?.exito) {
      await conn.sendMessage(m.chat, {
        text: decorar(
          `✅ Transferencia enviada\n\n` +
          `👤 ${session.nombre}\n` +
          `📱 ${session.numero}\n` +
          `💰 $${formatearMonto(session.monto)}\n` +
          (resultado.referencia ? `🔖 Referencia: ${resultado.referencia}` : '')
        )
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        text: decorar(`❌ No se pudo completar la transferencia.\n${resultado?.error || 'Error desconocido.'}`)
      }, { quoted: m })
    }
  } catch (e) {
    console.error('[nequi] ERROR ejecutando transferencia:', e)
    await conn.sendMessage(m.chat, {
      text: decorar(`❌ ${e.message}`)
    }, { quoted: m })
  }

  delete global.__nequiPending[sessionId]
  return true
}

export default handler
