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
      console.log('[resetlink] error parseando paramsJson:', e)
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

// 🔎 Solo verificamos que el bot sea admin en el grupo.
// El permiso de quien ejecuta ya lo garantiza handler.owner = true.
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

const handler = async (m, { conn }) => {
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

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🔗 Resetear link de invitación\n` +
    `│ 📋 Grupos disponibles: ${disponibles.length}\n` +
    `│ 🍃 Toca el botón para elegir el grupo\n` +
    `╰───────────────⬣`

  const rows = disponibles.map(g => ({
    title: `🌿 ${g.subject.length > 24 ? g.subject.slice(0, 24) + '…' : g.subject}`,
    description: '🍃 Toca para resetear su link',
    id: `resetlink_grupo~${g.id}`
  }))

  const sections = [{ title: `「 🌿 SELECCIONA GRUPO 」· ${disponibles.length}`, rows: rows.slice(0, 10) }]

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌴 SAITAMA-BOT 🌴', subtitle: '🌿 Resetear link de grupo', hasMediaAttachment: false },
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
    console.log('[resetlink] error mostrando menú:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo mostrar el menú de grupos.\n╰───────────────⬣`
    }, { quoted: m })
  }
}

// 🔒 Al tocar el botón, primero verificamos que sea owner
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id || !id.startsWith('resetlink_grupo~')) return false

  const permitido = m.fromMe || await esOwner(conn, m.sender)
  if (!permitido) {
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ Solo el owner puede usar este botón.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  const groupId = id.replace('resetlink_grupo~', '')

  try {
    let pp
    try {
      pp = await conn.profilePictureUrl(groupId, 'image')
    } catch {
      pp = 'https://files.catbox.moe/5tegkb.png'
    }

    await conn.groupRevokeInvite(groupId)
    const code = await conn.groupInviteCode(groupId)
    const link = `https://chat.whatsapp.com/${code}`

    let subject = groupId
    try {
      const meta = await conn.groupMetadata(groupId)
      subject = meta.subject
    } catch {}

    await conn.sendMessage(m.chat, {
      image: { url: pp },
      caption:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ Link reseteado en:\n` +
        `│ 🏠 *${subject}*\n` +
        `│ 🔗 ${link}\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  } catch (e) {
    console.log('[resetlink] error al resetear:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo resetear el link de ese grupo.\n╰───────────────⬣`
    }, { quoted: m })
  }

  return true
}

handler.help = ['resetlink']
handler.tags = ['owner']
handler.command = /^(resetlink|revoke|nuevolink)$/i
handler.desc = 'Resetea el link de invitación de un grupo (solo owners), eligiéndolo desde un menú'
handler.owner = true

export default handler