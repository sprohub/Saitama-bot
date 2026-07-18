// === COMANDO grupos / .grupos / /grupos / #grupos / @grupos ===
// Muestra los grupos donde está el bot en un menú interactivo (botón),
// igual de estilo que el menú principal.
//
// 🔒 SOLO PARA OWNERS. Este comando expone el link de invitación de
// CADA grupo donde está el bot — incluidos los grupos de clientes que
// pagaron por su licencia. Dejarlo abierto a cualquiera permitiría
// que un cliente vea/entre al grupo de otro, o que cualquier persona
// se una a cualquier grupo sin permiso.

import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

function esOwner(m) {
  const numero = m.sender?.split('@')[0]
  return m.fromMe || (global.owner || []).some(([num]) => num.replace(/[^0-9]/g, '') === numero)
}

const handler = async (m, { conn }) => {
  if (!esOwner(m)) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Solo el owner puede usar este comando.\n` +
      `╰───────────────⬣`
    )
  }

  const groups = await conn.groupFetchAllParticipating()
  const groupList = Object.values(groups)

  if (groupList.length === 0) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ El bot no está en ningún grupo todavía.\n` +
      `╰───────────────⬣`
    )
  }

  // Recolectamos el link de cada grupo
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

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 📋 Grupos donde estoy: ${groupsInfo.length}\n` +
    `│ 🍃 Toca el botón para ver el listado\n` +
    `╰───────────────⬣`

  // Construimos las filas del listado (una por grupo)
  const rows = groupsInfo.map((g, i) => ({
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
      body: {
        text: bodyText
      },
      footer: {
        text: '🍃 SAITAMA-BOT 🌿'
      },
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
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage
          }
        }
      },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.log(e)
    // Fallback si no se pueden renderizar botones: enviar solo texto
    const listText = groupsInfo
      .map((g, i) =>
        `╭─⪼ 🌿 *${g.subject}*\n` +
        `│ 🍃 Miembros: ${g.members}\n` +
        `│ 🔗 ${g.link || 'No disponible (no soy admin)'}\n` +
        `╰───────────────⬣`
      )
      .join('\n\n')
    await conn.sendMessage(m.chat, { text: listText }, { quoted: m })
  }
}

// Al seleccionar un grupo del menú, se envía el link a ese chat
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false
  if (!esOwner(m)) return false

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
      ? `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No disponible, el bot no es admin en ese grupo.\n╰───────────────⬣`
      : `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🔗 ${link}\n╰───────────────⬣`
  }, { quoted: m })

  return true
}

handler.command = ['grupos']
handler.customPrefix = /^[.\/#@]?/i
handler.tags = ['owner']
handler.owner = true
handler.rowner = true
handler.help = ['grupos']

export default handler
