// plugins/group/linkgrupos.js
// .linkgrupos → abre menú de botones (activar/desactivar aquí, en todos, o por grupo)
// Detecta links de OTROS grupos/canales de WhatsApp (chat.whatsapp.com, whatsapp.com/channel).
// Si un usuario (no admin, no owner) supera 3 links en total, es expulsado.

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

const GROUP_LINK_REGEX = /(https?:\/\/)?(chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)\S+/gi
const LIMITE = 3 // "más de 3" => al llegar al 4to se banea
const FILAS_POR_SECCION = 10 // límite de WhatsApp por sección en un single_select

// ───────────────────────────────────────────
// Owner check (mismo patrón usado en cphoto.js / antilink.js)
// ───────────────────────────────────────────
async function getLidFromJid(jid, conn) {
  try {
    const lid = await conn.signalRepository?.lidMapping?.getLIDForPN?.(jid)
    return lid || null
  } catch {
    return null
  }
}

async function esOwner(conn, senderJid, m) {
  if (m?.fromMe) return true
  if (!global.owner || !Array.isArray(global.owner)) return false
  const senderLid = await getLidFromJid(senderJid, conn)
  const numeros = global.owner.map(([number]) => (number || '').replace(/[^0-9]/g, ''))
  return numeros.some((num) => senderJid.includes(num) || (senderLid && senderLid.includes(num)))
}

// ───────────────────────────────────────────
// Estado guardado en global.db.data.chats[jid].linkgrupos
// ───────────────────────────────────────────
function getEstado(chatId) {
  return !!global.db.data.chats[chatId]?.linkgrupos
}

function setEstado(chatId, enable) {
  global.db.data.chats[chatId] = global.db.data.chats[chatId] || {}
  global.db.data.chats[chatId].linkgrupos = enable
  if (!enable) global.db.data.chats[chatId].linkgruposCounter = {}
}

// ───────────────────────────────────────────
// Detecta en qué grupos el bot es admin
// ───────────────────────────────────────────
async function gruposDondeSoyAdmin(conn) {
  const chats = await conn.groupFetchAllParticipating()
  const grupos = Object.values(chats)
  const botNumber = (conn.user?.id || '').split(':')[0].split('@')[0]

  return grupos.filter((g) => {
    const yo = g.participants.find((p) => p.id.split('@')[0].split(':')[0] === botNumber)
    return !!yo?.admin
  })
}

// ───────────────────────────────────────────
// Helpers de menú interactivo (mismo patrón que welcome.js / stlist.js)
// ───────────────────────────────────────────
function unwrapMessage(message) {
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find((w) => msg[w])
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
      return data.id || data.selectedId || data.selectedRowId || null
    } catch {}
  }
  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId
  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId
  return null
}

// ───────────────────────────────────────────
// Comando .linkgrupos — abre el menú de botones
// ───────────────────────────────────────────
const handler = async (m, { conn }) => {
  const permitido = await esOwner(conn, m.sender, m)
  if (!permitido) {
    return m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el owner puede usar este comando.\n╰───────────────⬣`)
  }

  await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Cargando grupos donde soy admin...\n╰───────────────⬣`)

  const gruposAdmin = await gruposDondeSoyAdmin(conn)
  const sections = []

  if (m.isGroup) {
    const enAqui = getEstado(m.chat)
    sections.push({
      title: '⚙️ Este grupo',
      rows: [{
        title: enAqui ? '🔴 Desactivar aquí' : '🟢 Activar aquí',
        description: `Estado actual: ${enAqui ? 'Activado ✅' : 'Desactivado ❌'}`,
        id: `linkgrupos|${enAqui ? 'off' : 'on'}|${m.chat}`
      }]
    })
  }

  sections.push({
    title: '🌐 Todos los grupos',
    rows: [
      { title: '🟢 Activar en todos', description: `${gruposAdmin.length} grupos donde soy admin`, id: 'linkgrupos|on|all' },
      { title: '🔴 Desactivar en todos', description: `${gruposAdmin.length} grupos donde soy admin`, id: 'linkgrupos|off|all' }
    ]
  })

  for (let i = 0; i < gruposAdmin.length; i += FILAS_POR_SECCION) {
    const chunk = gruposAdmin.slice(i, i + FILAS_POR_SECCION)
    const desde = i + 1
    const hasta = i + chunk.length

    sections.push({
      title: `📋 Grupos ${desde}-${hasta}`,
      rows: chunk.map((g) => {
        const estado = getEstado(g.id)
        return {
          title: `🌿 ${g.subject}`,
          description: `${estado ? 'Activado ✅' : 'Desactivado ❌'} — toca para alternar`,
          id: `linkgrupos|toggle|${g.id}`
        }
      })
    })
  }

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🔗 Menú Linkgrupos\n` +
    `│ 🍃 Soy admin en ${gruposAdmin.length} grupo(s)\n` +
    `│ 🍃 Bloquea links de otros grupos/canales\n` +
    `╰───────────────⬣`

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌿 SAITAMA-BOT — Linkgrupos', subtitle: 'Bloqueo de links por grupo', hasMediaAttachment: false },
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
    console.log('[linkgrupos] error mostrando menú:', e)
    await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo mostrar el menú.\n╰───────────────⬣`)
  }
}

handler.command = ['linkgrupos']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['group']
handler.help = ['linkgrupos']
handler.desc = 'Menú para activar/desactivar el bloqueo de links de otros grupos/canales'

// ───────────────────────────────────────────
// handler.before — botones del menú + detección real de links
// ───────────────────────────────────────────
handler.before = async function (m, { conn }) {
  // ── 1) Botones del menú .linkgrupos ──
  const content = unwrapMessage(m.message)
  const id = content ? extractSelectedId(content) : null

  if (id && id.startsWith('linkgrupos|')) {
    const permitido = await esOwner(conn, m.sender, m)
    if (!permitido) {
      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el owner puede usar esto.\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    const [, accion, destino] = id.split('|')

    if (destino === 'all') {
      const gruposAdmin = await gruposDondeSoyAdmin(conn)
      gruposAdmin.forEach((g) => setEstado(g.id, accion === 'on'))

      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Linkgrupos ${accion === 'on' ? 'activado ✅' : 'desactivado ❌'} en ${gruposAdmin.length} grupo(s).\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    if (accion === 'toggle') {
      const actual = getEstado(destino)
      setEstado(destino, !actual)

      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Linkgrupos ${!actual ? 'activado ✅' : 'desactivado ❌'} en ese grupo.\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    setEstado(destino, accion === 'on')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Linkgrupos ${accion === 'on' ? 'activado ✅' : 'desactivado ❌'} en este grupo.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  // ── 2) Detección real de links de grupo/canal ──
  if (!m.isGroup || !m.text) return false
  if (!getEstado(m.chat)) return false

  const esLink = GROUP_LINK_REGEX.test(m.text)
  GROUP_LINK_REGEX.lastIndex = 0
  if (!esLink) return false

  if (await esOwner(conn, m.sender, m)) return false

  const groupMetadata = await conn.groupMetadata(m.chat)
  const participante = groupMetadata.participants.find((p) => p.id === m.sender)
  if (participante?.admin) return false

  // No cuenta el link de invitación del propio grupo
  try {
    const codigoPropio = await conn.groupInviteCode(m.chat)
    if (m.text.includes(codigoPropio)) return false
  } catch {}

  const botNumber = conn.user.id.split(':')[0].split('@')[0]
  const botParticipante = groupMetadata.participants.find((p) => p.id.split('@')[0] === botNumber)
  if (!botParticipante?.admin) {
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Detecté un link de grupo/canal pero no soy *admin*, no puedo actuar.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  try {
    await conn.sendMessage(m.chat, { delete: m.key })
  } catch {}

  global.db.data.chats[m.chat].linkgruposCounter = global.db.data.chats[m.chat].linkgruposCounter || {}
  global.db.data.chats[m.chat].linkgruposCounter[m.sender] = (global.db.data.chats[m.chat].linkgruposCounter[m.sender] || 0) + 1
  const strikes = global.db.data.chats[m.chat].linkgruposCounter[m.sender]

  if (strikes > LIMITE) {
    try {
      await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
    } catch {}

    delete global.db.data.chats[m.chat].linkgruposCounter[m.sender]

    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Linkgrupos ${strikes}/${LIMITE}\n│ 🍃 @${m.sender.split('@')[0]} fue expulsado por enviar links de otros grupos/canales.\n╰───────────────⬣`,
      mentions: [m.sender]
    })
  } else {
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Linkgrupos ${strikes}/${LIMITE}\n│ 🍃 @${m.sender.split('@')[0]}, no envíes links de otros grupos/canales.\n╰───────────────⬣`,
      mentions: [m.sender]
    })
  }

  return true
}

export default handler
