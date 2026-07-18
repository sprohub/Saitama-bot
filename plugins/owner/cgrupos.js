// === COMANDO grupos / .grupos / /grupos / #grupos / @grupos ===
//
// 🔒 Tres niveles de acceso:
// - OWNER REAL: ve solo los grupos cuya licencia ÉL generó con
//   .codegrupo — no ve los grupos vendidos por otros owners.
// - OWNER LOCAL (cliente con licencia canjeada en su grupo): solo ve
//   la info de SU PROPIO grupo.
// - Cualquier otra persona: sin acceso.

import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'
import { esOwnerLocal, licenciasDeOwner } from '../../lib/licencias.js'

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

  // ── Owner LOCAL: solo su propio grupo ──
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

  // ── Owner REAL: solo los grupos cuya licencia ÉL generó ──
  const misLicencias = licenciasDeOwner(m.sender)

  if (!misLicencias.length) {
    return m.reply(decorar('Todavía no tienes ningún grupo con licencia generada por ti.'))
  }

  const groupsInfo = []
  for (const lic of misLicencias) {
    let subject = lic.groupId
    let members = 0
    try {
      const metadata = await conn.groupMetadata(lic.groupId)
      subject = metadata.subject
      members = metadata.participants.length
    } catch {
      continue // el bot ya no está en ese grupo, se omite
    }

    let link = null
    try {
      const code = await conn.groupInviteCode(lic.groupId)
      link = `https://chat.whatsapp.com/${code}`
    } catch {
      // el bot no es admin en ese grupo, no puede sacar el link
    }

    groupsInfo.push({ subject, members, link })
  }

  if (!groupsInfo.length) {
    return m.reply(decorar('Todavía no tienes ningún grupo con licencia generada por ti.'))
  }

  const bodyText = decorar(
    `📋 Tus grupos con licencia: ${groupsInfo.length}\n` +
    `🍃 Toca el botón para ver el listado`
  )

  const rows = groupsInfo.map((g) => ({
    title: `🌿 ${g.subject.length > 24 ? g.subject.slice(0, 24) + '…' : g.subject}`,
    description: `🍃 ${g.members} miembros ${g.link ? '• link disponible' : '• sin link (no admin)'}`,
    id: `grupo_link~${g.link || 'no_disponible'}`
  }))

  const sections = [
    {
      title: `「 🌿 TUS GRUPOS 」· ${groupsInfo.length}`,
      rows: rows.slice(0, 10) // límite de WhatsApp por sección
    }
  ]

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌴 SAITAMA-BOT 🌴',
        subtitle: `🌿 ${groupsInfo.length} grupos tuyos`,
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
