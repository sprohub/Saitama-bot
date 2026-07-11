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
      console.log('[promote] error parseando paramsJson:', e)
    }
  }
  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId
  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId
  return null
}

// 🔎 Busca en qué grupos el bot es admin, el objetivo es miembro,
// y quien ejecuta el comando también es admin (o dueño del bot) ahí.
async function buscarGruposDisponibles(conn, targetJid, actorJid, isROwner) {
  const groups = await conn.groupFetchAllParticipating()
  const lista = Object.values(groups)
  const disponibles = []

  for (const g of lista) {
    const participants = g.participants || []
    const botP = participants.find(p => p.id === conn.user.jid)
    const targetP = participants.find(p => p.id === targetJid)
    const actorP = participants.find(p => p.id === actorJid)

    const botEsAdmin = !!botP?.admin
    const actorEsAdmin = !!actorP?.admin || isROwner

    if (botEsAdmin && actorEsAdmin && targetP) {
      disponibles.push({
        id: g.id,
        subject: g.subject,
        yaEsAdmin: !!targetP.admin
      })
    }
  }

  return disponibles
}

function extraerNumero(texto) {
  const limpio = (texto || '').replace(/[^0-9]/g, '')
  return limpio.length >= 8 ? `${limpio}@s.whatsapp.net` : null
}

const handler = async (m, { conn, text, isROwner }) => {
  let who = (m.mentionedJid && m.mentionedJid[0])
    || (m.quoted ? m.quoted.sender : null)
    || extraerNumero(text)

  if (!who) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Menciona, responde, o escribe\n` +
        `│ el número de quien quieres ascender.\n` +
        `│ Ejemplo: *.promote @usuario*\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  const disponibles = await buscarGruposDisponibles(conn, who, m.sender, isROwner)

  if (!disponibles.length) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 No encontré grupos donde @${who.split('@')[0]}\n` +
        `│ esté presente y donde tú y el bot\n` +
        `│ sean administradores.\n` +
        `╰───────────────⬣`,
      mentions: [who]
    }, { quoted: m })
  }

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 👤 Objetivo: @${who.split('@')[0]}\n` +
    `│ 📋 Grupos disponibles: ${disponibles.length}\n` +
    `│ 🍃 Toca el botón para elegir el grupo\n` +
    `╰───────────────⬣`

  const rows = disponibles.map(g => ({
    title: `🌿 ${g.subject.length > 24 ? g.subject.slice(0, 24) + '…' : g.subject}`,
    description: g.yaEsAdmin ? '🍃 Ya es admin en este grupo' : '🍃 Toca para hacerlo admin aquí',
    id: `promote_grupo~${g.id}~${who}`
  }))

  const sections = [{ title: `「 🌿 SELECCIONA GRUPO 」· ${disponibles.length}`, rows: rows.slice(0, 10) }]

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌴 SAITAMA-BOT 🌴', subtitle: '🌿 Ascender a administrador', hasMediaAttachment: false },
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
    console.log('[promote] error mostrando menú:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo mostrar el menú de grupos.\n╰───────────────⬣`
    }, { quoted: m })
  }
}

// Al elegir un grupo del menú, se ejecuta el ascenso ahí
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id || !id.startsWith('promote_grupo~')) return false

  const parts = id.split('~')
  const groupId = parts[1]
  const targetJid = parts[2]

  try {
    await conn.groupParticipantsUpdate(groupId, [targetJid], 'promote')

    let subject = groupId
    try {
      const meta = await conn.groupMetadata(groupId)
      subject = meta.subject
    } catch {}

    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ @${targetJid.split('@')[0]} ahora es admin\n` +
        `│ 🏠 en: *${subject}*\n` +
        `╰───────────────⬣`,
      mentions: [targetJid]
    }, { quoted: m })
  } catch (e) {
    console.log('[promote] error al ascender:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo dar admin en ese grupo.\n╰───────────────⬣`
    }, { quoted: m })
  }

  return true
}

handler.help = ['promote <@usuario>']
handler.tags = ['group']
handler.command = /^(promote|promover|daradmin)$/i
handler.desc = 'Da administrador a alguien, eligiendo el grupo desde un menú'

export default handler