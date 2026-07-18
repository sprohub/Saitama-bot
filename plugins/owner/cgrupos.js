// === COMANDO grupos / .grupos / /grupos / #grupos / @grupos ===
//
// 🔒 Dos niveles de acceso:
// - OWNER REAL (tú): ve la lista COMPLETA de todos los grupos donde
//   está el bot, con botones, igual que antes.
// - OWNER LOCAL (cliente que canjeó licencia en su grupo): solo ve
//   la info de SU PROPIO grupo — nunca la lista de los demás.
// - Cualquier otra persona: sin acceso.

import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'
import { esOwnerLocal } from '../../lib/licencias.js'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function esOwnerReal(m) {
  const numero = m.sender?.split('@')[0]
  return m.fromMe || (global.owner || []).some(([num]) => num.replace(/[^0-9]/g, '') === numero)
}

const handler = async (m, { conn }) => {
  const ownerReal = esOwnerReal(m)
  const ownerLocal = m.isGroup && esOwnerLocal(m.chat, m.sender.split('@')[0])

  if (!ownerReal && !ownerLocal) {
    return m.reply(decorar('Solo el owner puede usar este comando.'))
  }

  // ── Owner LOCAL: solo su propio grupo, sin lista de los demás ──
  if (!ownerReal && ownerLocal) {
    const metadata = await conn.groupMetadata(m.chat)
    let link = null
    try {
      const code = await conn.groupInviteCode(m.chat)
      link = `https://chat.whatsapp.com/${code}`
    } catch {
      // el bot no es admin en este grupo, no puede sacar el link
    }

    return conn.sendMessage(m.chat, {
      text: decorar(
        `🏠 ${metadata.subject}\n` +
        `👥 Miembros: ${metadata.participants.length}\n` +
        `🔗 ${link || 'No disponible (el bot no es admin aquí)'}`
      )
    }, { quoted: m })
  }

  // ── Owner REAL: lista completa de todos los grupos, con botones ──
  const groups = await conn.groupFetchAllParticipating()
  const groupList = Object.values(groups)

  if (groupList.length === 0) {
    return m.reply(decorar('El bot no está en ningún grupo todavía.'))
  }

  const groupsInfo = []
  for (const group of groupList) {
    let link = null
    try {
      const code = await conn.groupInviteCode(group.id)
      link = `https://chat.whatsapp.com/${code}`
    } catch {
      // el bot no es admin en ese grupo, no puede sacar el link
    }
    groupsInfo.push({
      subject: group.subject,
      members: group.participants.length,
      link
    })
  }

  const bodyText = decorar(
    `📋 Grupos donde estoy: ${groupsInfo.length}\n` +
    `🍃 Toca el botón para ver el listado`
  )

  const rows = groupsInfo.map((g) => ({
    title: `🌿 ${g.subject.length > 24 ? g.subject.slice(0, 24) + '…' : g.subject}`,
    description: `🍃 ${g.members} miembros ${g.link ? '• link disponible' : '• sin link (no admin)'}`,
    id: `grupo_link~${g.link || 'no_disponible'}`
  }))

  const sections = [
    {
      title: `「 🌿 GRUPOS 」· ${groupsInfo.length}`,
      rows: rows.slice(0, 10) // límite de WhatsApp por sección
    }
  ]

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌴 SAITAMA-BOT 🌴',
        subtitle: `🌿 ${groupsInfo.length} grupos`,
        hasMediaAttachment: false
      },
      body: { text: bodyText },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🌿 VER GRUPO',
              sections
            })
          }
        ]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.log(e)
    const listText = groupsInfo
      .map((g) =>
        `╭─⪼ 🌿 *${g.subject}*\n` +
        `│ 🍃 Miembros: ${g.members}\n` +
        `│ 🔗 ${g.link || 'No disponible (no soy admin)'}\n` +
        `╰───────────────⬣`
      )
      .join('\n\n')
    await conn.sendMessage(m.chat, { text: listText }, { quoted: m })
  }
}

// Al seleccionar un grupo del menú, se envía el link (solo owner real llega aquí)
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false
  if (!esOwnerReal(m)) return false

  const content = m.message?.interactiveResponseMessage
    ? m.message
    : (m.message?.viewOnceMessage?.message?.interactiveResponseMessage
        ? m.message.viewOnceMessage.message
        : null)

  if (!content?.interactiveResponseMessage) return false

  const nativeFlow = content.interactiveResponseMessage.nativeFlowResponseMessage
  if (!nativeFlow?.paramsJson) return false

  let id = null
  try {
    const data = JSON.parse(nativeFlow.paramsJson)
    id = data.id || data.selectedId || data.selectedRowId
  } catch (e) {
    console.log('[grupos] error parseando paramsJson:', e)
    return false
  }

  if (!id || !id.startsWith('grupo_link~')) return false

  const link = id.replace('grupo_link~', '')

  await conn.sendMessage(m.chat, {
    text: link === 'no_disponible'
      ? decorar('No disponible, el bot no es admin en ese grupo.')
      : decorar(`🔗 ${link}`)
  }, { quoted: m })

  return true
}

handler.command = ['grupos']
handler.customPrefix = /^[.\/#@]?/i
handler.tags = ['group']
handler.help = ['grupos']

export default handler
