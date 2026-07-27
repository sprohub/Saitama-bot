global.__botSentMessages = global.__botSentMessages || {}

function esOwner(conn, senderJid) {
  if (!global.owner || !Array.isArray(global.owner)) return false
  const numeros = global.owner.map(([number]) => (number || '').replace(/[^0-9]/g, ''))
  return numeros.some(num => senderJid.includes(num))
}

// 🩹 Parchea conn.sendMessage UNA sola vez por conexión, para ir
// guardando en memoria los mensajes que el propio bot envía en cada chat.
function patchConn(conn) {
  if (conn.__vaciarPatched) return
  conn.__vaciarPatched = true

  const originalSend = conn.sendMessage.bind(conn)

  conn.sendMessage = async (jid, content, options) => {
    const result = await originalSend(jid, content, options)
    try {
      if (result?.key && jid) {
        global.__botSentMessages[jid] = global.__botSentMessages[jid] || []
        global.__botSentMessages[jid].push({ key: result.key, date: Date.now() })
        if (global.__botSentMessages[jid].length > 300) {
          global.__botSentMessages[jid].shift()
        }
      }
    } catch {}
    return result
  }
}

let handler = async (m, { conn, text }) => {
  patchConn(conn)

  if (!(m.fromMe || esOwner(conn, m.sender))) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el owner puede usar este comando\n╰───────────────⬣'
    }, { quoted: m })
  }

  const historial = global.__botSentMessages[m.chat] || []

  if (!historial.length) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No hay mensajes del bot registrados en este chat\n╰───────────────⬣'
    }, { quoted: m })
  }

  let cantidad
  if (!text || text.trim().toLowerCase() === 'todo') {
    cantidad = historial.length
  } else {
    cantidad = parseInt(text.trim())
    if (isNaN(cantidad) || cantidad <= 0) {
      return conn.sendMessage(m.chat, {
        text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Cantidad inválida\n│ 🍃 Usa: .vaciarchat 20\n│ 🍃 Usa: .vaciarchat todo\n╰───────────────⬣'
      }, { quoted: m })
    }
    cantidad = Math.min(cantidad, historial.length)
  }

  const aBorrar = historial.splice(historial.length - cantidad, cantidad)

  let borrados = 0
  for (const item of aBorrar) {
    try {
      await conn.sendMessage(m.chat, { delete: item.key })
      borrados++
    } catch (e) {
      // Si un mensaje ya fue borrado antes o expiró, seguimos con los demás
    }
    await new Promise(r => setTimeout(r, 300)) // pequeña pausa para no saturar
  }

  await conn.sendMessage(m.chat, {
    text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Chat vaciado\n│ 🍃 ${borrados}/${aBorrar.length} mensajes borrados\n╰───────────────⬣`
  })
}

handler.help = ['vaciarchat <cantidad>']
handler.tags = ['owner']
handler.command = /^(vaciarchat|clearchat|limpiarchat)$/i
handler.owner = true

export default handler