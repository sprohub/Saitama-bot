import { Readable } from 'stream'
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
      console.log('[setphoto] error parseando paramsJson:', e)
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

// 🔎 Solo owners pueden usar este comando, así que solo verificamos
// que el bot sea admin en cada grupo.
async function buscarGruposDisponibles(conn) {
  const groups = await conn.groupFetchAllParticipating()
  const lista = Object.values(groups)
  const disponibles = []

  const botJid = conn.user.jid
  const botLid = await getLidFromJid(botJid, conn)

  for (const g of lista) {
    const participants = g.participants || []
    const botP = participants.find(p => coincideParticipante(p, botJid, botLid))
    const botEsAdmin = !!botP?.admin

    if (botEsAdmin) {
      disponibles.push({ id: g.id, subject: g.subject })
    }
  }

  return disponibles
}

// 📦 Guardamos temporalmente la imagen descargada, indexada por el sender,
// para poder aplicarla luego cuando elija el grupo en el botón.
global.__setphotoPending = global.__setphotoPending || {}

const handler = async (m, { conn }) => {
  const q = m.quoted ? m.quoted : m
  const mime = (q.msg || q).mimetype || ''

  if (!/image/.test(mime)) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Responde a una imagen junto con\n` +
        `│ el comando *.setphoto*.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  const disponibles = await buscarGruposDisponibles(conn)

  if (!disponibles.length) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 No encontré grupos donde el bot\n` +
        `│ sea administrador.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  try {
    const img = await q.download()
    if (!img || !Buffer.isBuffer(img)) {
      throw new Error('No se pudo descargar la imagen correctamente')
    }

    // Guardamos la imagen en memoria, ligada al sender, con expiración de 5 min
    global.__setphotoPending[m.sender] = { buffer: img, date: Date.now() }
    setTimeout(() => { delete global.__setphotoPending[m.sender] }, 5 * 60 * 1000)

    const bodyText =
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🖼️ Nueva foto de grupo\n` +
      `│ 📋 Grupos disponibles: ${disponibles.length}\n` +
      `│ 🍃 Toca el botón para elegir el grupo\n` +
      `╰───────────────⬣`

    const rows = disponibles.map(g => ({
      title: `🌿 ${g.subject.length > 24 ? g.subject.slice(0, 24) + '…' : g.subject}`,
      description: '🍃 Toca para actualizar la foto aquí',
      id: `setphoto_grupo~${g.id}~${m.sender}`
    }))

    const sections = [{ title: `「 🌿 SELECCIONA GRUPO 」· ${disponibles.length}`, rows: rows.slice(0, 10) }]

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌴 SAITAMA-BOT 🌴', subtitle: '🌿 Cambiar foto de grupo', hasMediaAttachment: false },
      body: { text: bodyText },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🌿 VER GRUPOS', sections }) }]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.log('[setphoto] error preparando menú:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ ${e.message || 'Error al procesar la imagen.'}\n╰───────────────⬣`
    }, { quoted: m })
  }
}

// 🔒 Al tocar el botón, primero verificamos que sea owner
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id || !id.startsWith('setphoto_grupo~')) return false

  const permitido = m.fromMe || await esOwner(conn, m.sender)
  if (!permitido) {
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ Solo el owner puede usar este botón.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  const parts = id.split('~')
  const groupId = parts[1]
  const senderOriginal = parts[2]

  const pending = global.__setphotoPending?.[senderOriginal]

  if (!pending) {
    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 La imagen expiró, vuelve a usar\n` +
        `│ *.setphoto* respondiendo a la foto.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  try {
    await conn.updateProfilePicture(groupId, { stream: Readable.from(pending.buffer) })
    delete global.__setphotoPending[senderOriginal]

    let subject = groupId
    try {
      const meta = await conn.groupMetadata(groupId)
      subject = meta.subject
    } catch {}

    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ Foto actualizada en:\n` +
        `│ 🏠 *${subject}*\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  } catch (e) {
    console.log('[setphoto] error al actualizar foto:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo actualizar la foto de ese grupo.\n╰───────────────⬣`
    }, { quoted: m })
  }

  return true
}

handler.help = ['setphoto']
handler.tags = ['owner']
handler.command = /^(setphoto|setfoto|fotogrupo)$/i
handler.desc = 'Cambia la foto de un grupo (solo owners), eligiéndolo desde un menú'
handler.owner = true

export default handler