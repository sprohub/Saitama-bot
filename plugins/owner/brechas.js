/**
 * plugins/tools/brechas.js
 * Comando: .brechas <email>
 *
 * Consulta la API GRATUITA de XposedOrNot (sin API key) para ver si un
 * correo aparece en filtraciones de datos conocidas. Pensado como
 * herramienta DEFENSIVA: cada usuario revisa su propio correo, no el
 * de terceros.
 *
 * No requiere configuración adicional. API: https://xposedornot.com/api_doc
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

// Guarda temporalmente los resultados de cada consulta para poder
// mostrar el detalle al presionar un botón. Expira a los 5 minutos.
global.__brechasPending = global.__brechasPending || {}

function limpiarPendientesVencidos() {
  const ahora = Date.now()
  for (const key of Object.keys(global.__brechasPending)) {
    if (ahora - global.__brechasPending[key].timestamp > 5 * 60 * 1000) {
      delete global.__brechasPending[key]
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

async function consultarBrechas(email) {
  // 1) Lista rápida de nombres de brechas para ese email
  const url = `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`
  const res = await fetch(url, { headers: { 'user-agent': 'SAITAMA-BOT' } })

  if (res.status === 404) return [] // sin filtraciones
  if (res.status === 429) throw new Error('RATE_LIMIT')
  if (!res.ok) throw new Error('ERROR_XON_' + res.status)

  const data = await res.json()
  const nombres = data?.breaches?.[0] || [] // ej: ["Adobe","Canva",...]
  if (!nombres.length) return []

  // 2) Detalle de todas las brechas conocidas, para sacar fecha/descr/dominio
  let detalles = {}
  try {
    const resAnaliticas = await fetch('https://api.xposedornot.com/v1/breaches', {
      headers: { 'user-agent': 'SAITAMA-BOT' }
    })
    if (resAnaliticas.ok) {
      const json = await resAnaliticas.json()
      for (const b of json.exposedBreaches || []) {
        detalles[b.breach] = b
      }
    }
  } catch {
    // si falla el detalle, seguimos solo con los nombres
  }

  return nombres.map(nombre => {
    const d = detalles[nombre] || {}
    return {
      Title: d.breach || nombre,
      Domain: d.domain || 'N/A',
      BreachDate: d.xposed_date || 'Desconocida',
      PwnCount: d.xposed_records || null,
      DataClasses: d.exposed_data ? d.exposed_data.split(';') : [],
      Description: d.details || ''
    }
  })
}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

const handler = async function (m, { conn, args, command }) {
  limpiarPendientesVencidos()

  const email = (args[0] || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Uso correcto:\n.${command} tucorreo@ejemplo.com\n\n💡 Revisa tu *propio* correo — esta herramienta es para tu seguridad personal.`)
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, { text: decorar('🔎 Consultando filtraciones, un momento...') }, { quoted: m })

  let brechas
  try {
    brechas = await consultarBrechas(email)
  } catch (e) {
    let msg = '❌ Ocurrió un error consultando la base de datos.'
    if (e.message === 'RATE_LIMIT') msg = '⏳ Demasiadas consultas. Intenta de nuevo en un momento.'
    return conn.sendMessage(m.chat, { text: decorar(msg) }, { quoted: m })
  }

  if (brechas.length === 0) {
    return conn.sendMessage(m.chat, {
      text: decorar(`✅ Buenas noticias.\n*${email}* no aparece en ninguna filtración conocida.`)
    }, { quoted: m })
  }

  // Guarda el detalle para cuando presionen un botón
  const sessionId = `brechas_${m.sender}_${Date.now()}`
  global.__brechasPending[sessionId] = {
    email,
    sender: m.sender,
    breaches: brechas,
    timestamp: Date.now()
  }

  const rows = brechas.map((b, i) => ({
    title: b.Title,
    description: `📅 ${b.BreachDate}${b.PwnCount ? ' · ' + Number(b.PwnCount).toLocaleString() + ' cuentas' : ''}`,
    id: `brechas_ver|${sessionId}|${i}`
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT · Brechas encontradas',
      subtitle: `${brechas.length} filtración(es) para ${email}`,
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: decorar(`Se encontraron *${brechas.length}* filtración(es) para *${email}*.\n\nToca una para ver el detalle 👇`)
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '📋 Ver filtraciones',
          sections: [{ title: 'Resultados', rows }]
        })
      }]
    })
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: {
      message: { interactiveMessage }
    }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['brechas', 'breach', 'pwned']
handler.help = ['brechas <email>']
handler.tags = ['tools']

// Se ejecuta para CUALQUIERA que toque el botón — hay que validar
// manualmente que sea la misma persona que hizo la consulta original.
handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId || !selectedId.startsWith('brechas_ver|')) return false

  const [, sessionId, indexStr] = selectedId.split('|')
  const session = global.__brechasPending[sessionId]

  if (!session) {
    await conn.sendMessage(m.chat, { text: decorar('⌛ Esta consulta expiró. Vuelve a ejecutar el comando.') }, { quoted: m })
    return true
  }

  // Seguridad: solo quien pidió la consulta puede ver el detalle
  if (m.sender !== session.sender) {
    await conn.sendMessage(m.chat, { text: decorar('❌ Solo quien hizo la consulta puede ver este detalle.') }, { quoted: m })
    return true
  }

  const b = session.breaches[parseInt(indexStr, 10)]
  if (!b) return true

  const descripcionCorta = (b.Description || '')
    .replace(/<[^>]+>/g, '')
    .slice(0, 300)

  const detalle = [
    `*${b.Title}*`,
    `🌐 Dominio: ${b.Domain}`,
    `📅 Fecha de la brecha: ${b.BreachDate}`,
    b.PwnCount ? `👥 Cuentas afectadas: ${Number(b.PwnCount).toLocaleString()}` : null,
    b.DataClasses.length ? `📦 Datos expuestos: ${b.DataClasses.join(', ')}` : null,
    descripcionCorta ? `\n${descripcionCorta}${descripcionCorta.length >= 300 ? '...' : ''}` : null
  ].filter(Boolean).join('\n')

  await conn.sendMessage(m.chat, { text: decorar(detalle) }, { quoted: m })
  return true
}

export default handler
