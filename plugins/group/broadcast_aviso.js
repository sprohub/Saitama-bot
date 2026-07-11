import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

function unwrapMessage(message) {
  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage'
  ]
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find(w => msg[w])
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
      const id = data.id || data.selectedId || data.selectedRowId
      if (id) return id
    } catch (e) {
      console.log('[broadcast] error parseando paramsJson:', e)
    }
  }
  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId
  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId
  return null
}

async function getLidFromJid(id, conn) {
  if (id.endsWith('@lid')) return id
  const res = await conn.onWhatsApp(id).catch(() => [])
  return res[0]?.lid || null
}

function coincideParticipante(p, jid, lid) {
  return p.id === jid || (lid && p.id === lid)
}

// 🔒 Verifica si quien tocó el botón es owner del bot (usa global.owner de config.js)
async function esOwner(conn, senderJid) {
  if (!global.owner || !Array.isArray(global.owner)) return false
  const senderLid = await getLidFromJid(senderJid, conn)
  const numeros = global.owner.map(([number]) => (number || '').replace(/[^0-9]/g, ''))
  return numeros.some(num => senderJid.includes(num) || (senderLid && senderLid.includes(num)))
}

// 🔎 Trae todos los grupos donde el bot es admin (para poder enviar sin restricción)
async function buscarGruposDisponibles(conn) {
  const groups = await conn.groupFetchAllParticipating()
  const lista = Object.values(groups)
  const disponibles = []

  const botJid = conn.user.jid
  const botLid = await getLidFromJid(botJid, conn)

  for (const g of lista) {
    const participants = g.participants || []
    const botP = participants.find(p => coincideParticipante(p, botJid, botLid))
    disponibles.push({ id: g.id, subject: g.subject, botEsAdmin: !!botP?.admin })
  }

  return disponibles
}

// 📦 Guardamos temporalmente el texto del aviso, ligado al sender
global.__broadcastPending = global.__broadcastPending || {}

const handler = async (m, { conn, text }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Escribe el mensaje que quieres\n` +
        `│ enviar a todos los grupos.\n` +
        `│ Ejemplo: *.broadcast Hola a todos!*\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  const grupos = await buscarGruposDisponibles(conn)

  if (!grupos.length) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 El bot no está en ningún grupo.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  // Guardamos el mensaje pendiente, expira en 5 minutos
  global.__broadcastPending[m.sender] = { text, date: Date.now() }
  setTimeout(() => { delete global.__broadcastPending[m.sender] }, 5 * 60 * 1000)

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 📢 Vista previa del aviso:\n` +
    `│ "${text.length > 100 ? text.slice(0, 100) + '…' : text}"\n` +
    `│\n` +
    `│ 📋 Se enviará a: ${grupos.length} grupos\n` +
    `│ 🍃 Toca el botón para confirmar\n` +
    `╰───────────────⬣`

  const rows = [
    {
      title: '🌿 CONFIRMAR Y ENVIAR',
      description: `🍃 Se enviará a ${grupos.length} grupos`,
      id: `broadcast_confirmar~${m.sender}`
    },
    {
      title: '🍂 CANCELAR',
      description: '🍃 No se enviará nada',
      id: `broadcast_cancelar~${m.sender}`
    }
  ]

  const sections = [{ title: '「 🌿 CONFIRMACIÓN 」', rows }]

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌴 SAITAMA-BOT 🌴', subtitle: '🌿 Enviar aviso a todos los grupos', hasMediaAttachment: false },
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
    console.log('[broadcast] error mostrando confirmación:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo mostrar la confirmación.\n╰───────────────⬣`
    }, { quoted: m })
  }
}

// Al tocar un botón, primero verificamos que quien lo toca sea owner
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id) return false

  const esBotonDeEsteComando = id.startsWith('broadcast_cancelar~') || id.startsWith('broadcast_confirmar~')
  if (!esBotonDeEsteComando) return false

  // 🔒 Solo owners pueden confirmar o cancelar, sin importar quién pidió el aviso
  const permitido = m.fromMe || await esOwner(conn, m.sender)
  if (!permitido) {
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ Solo el owner puede usar este botón.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  if (id.startsWith('broadcast_cancelar~')) {
    const senderOriginal = id.replace('broadcast_cancelar~', '')
    delete global.__broadcastPending?.[senderOriginal]
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Envío cancelado.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  // broadcast_confirmar~
  const senderOriginal = id.replace('broadcast_confirmar~', '')
  const pending = global.__broadcastPending?.[senderOriginal]

  if (!pending) {
    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 El aviso expiró, vuelve a usar\n` +
        `│ *.broadcast <mensaje>*.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  const grupos = await buscarGruposDisponibles(conn)
  let enviados = 0
  let fallidos = 0

  const captionFinal =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 📢 *AVISO*\n` +
    `│\n` +
    `│ ${pending.text}\n` +
    `╰───────────────⬣`

  await conn.sendMessage(m.chat, {
    text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Enviando a ${grupos.length} grupos...\n╰───────────────⬣`
  }, { quoted: m })

  for (const g of grupos) {
    try {
      await conn.sendMessage(g.id, { text: captionFinal })
      enviados++
      await new Promise(res => setTimeout(res, 1500)) // pausa para evitar baneo por flood
    } catch (e) {
      console.log(`[broadcast] error enviando a ${g.id}:`, e.message)
      fallidos++
    }
  }

  delete global.__broadcastPending[senderOriginal]

  await conn.sendMessage(m.chat, {
    text:
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ ✅ Aviso enviado\n` +
      `│ 📬 Entregado: ${enviados}\n` +
      `│ ❌ Fallidos: ${fallidos}\n` +
      `╰───────────────⬣`
  }, { quoted: m })

  return true
}

handler.help = ['broadcast <mensaje>']
handler.tags = ['owner']
handler.command = /^(broadcast|aviso|avisartodos)$/i
handler.desc = 'Envía un aviso a todos los grupos donde está el bot (solo owners)'
handler.owner = true

export default handler