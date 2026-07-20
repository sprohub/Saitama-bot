// === COMANDO grupos / .grupos / /grupos / #grupos / @grupos ===
//
// 🔒 Solo el owner real puede usar este comando.
// Muestra todos los grupos donde está el bot, con miembros y link
// (si el bot es admin en ese grupo).

import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function esOwnerReal(m) {
  const numero = m.sender?.split('@')[0]
  return m.fromMe || (global.owner || []).some(([num]) => num.replace(/[^0-9]/g, '') === numero)
}

const handler = async (m, { conn }) => {
  if (!esOwnerReal(m)) {
    return m.reply(decorar('Solo el owner puede usar este comando.'))
  }

  const allGroups = await conn.groupFetchAllParticipating().catch(() => ({}))
  const groupIds = Object.keys(allGroups)

  if (!groupIds.length) {
    return m.reply(decorar('El bot no está en ningún grupo.'))
  }

  const groupsInfo = []
  for (const id of groupIds) {
    const metadata = allGroups[id]
    let link = null
    try {
      const code = await conn.groupInviteCode(id)
      link = `https://chat.whatsapp.com/${code}`
    } catch {
      // el bot no es admin en ese grupo, no puede sacar el link
    }

    groupsInfo.push({
      id,
      subject: metadata.subject,
      members: metadata.participants.length,
      link
    })
  }

  const bodyText = decorar(
    `📋 Grupos del bot: ${groupsInfo.length}\n` +
    `🍃 Toca el botón para ver el listado`
  )

  const rows = groupsInfo.map((g) => ({
    title: `🌿 ${g.subject.length > 24 ? g.subject.slice(0, 24) + '…' : g.subject}`,
    description: `🍃 ${g.members} miembros ${g.link ? '• link disponible' : '• sin link (no admin)'}`,
    id: `grupo_link~${g.link || 'no_disponible'}`
  }))

  // WhatsApp permite máximo 10 filas por sección, se dividen en chunks de 10
  const sections = []
  for (let i = 0; i < rows.length; i += 10) {
    sections.push({
      title: `「 🌿 GRUPOS DEL BOT 」· ${i + 1}-${Math.min(i + 10, rows.length)}`,
      rows: rows.slice(i, i + 10)
    })
  }

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
handler.tags = ['owner']
handler.help = ['grupos']

export default handler
