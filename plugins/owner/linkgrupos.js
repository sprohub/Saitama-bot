// plugins/group/linkgrupos.js
// .on linkgrupos / .off linkgrupos → solo owner
// Detecta links de OTROS grupos/canales de WhatsApp (chat.whatsapp.com, whatsapp.com/channel).
// Si un usuario (no admin, no owner) supera 3 links en total, es expulsado.

const GROUP_LINK_REGEX = /(https?:\/\/)?(chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)\S+/gi
const LIMITE = 3 // "más de 3" => al llegar al 4to se banea

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
// Comando .on linkgrupos / .off linkgrupos
// ───────────────────────────────────────────
const handler = async (m, { conn, text, command, isOwner }) => {
  const arg = (text || '').trim().toLowerCase()
  if (arg !== 'linkgrupos') return

  if (!m.isGroup) {
    return m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Este comando solo funciona dentro de un grupo.\n╰───────────────⬣`)
  }

  const permitido = isOwner || (await esOwner(conn, m.sender, m))
  if (!permitido) {
    return m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el *owner* puede activar o desactivar esto.\n╰───────────────⬣`)
  }

  const activar = command.toLowerCase() === 'on'

  global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
  global.db.data.chats[m.chat].linkgrupos = activar
  if (!activar) global.db.data.chats[m.chat].linkgruposCounter = {}

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Detección de links de grupos/canales ${activar ? 'activada ✅' : 'desactivada ❌'}.\n╰───────────────⬣`
  )
}

handler.command = ['on', 'off']
handler.customPrefix = /^[.\/#@]/
handler.group = true

// ───────────────────────────────────────────
// handler.before — vigila cada mensaje del grupo
// ───────────────────────────────────────────
handler.before = async function (m, { conn }) {
  if (!m.isGroup || !m.text) return false

  const chatData = (global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {})
  if (!chatData.linkgrupos) return false

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

  chatData.linkgruposCounter = chatData.linkgruposCounter || {}
  chatData.linkgruposCounter[m.sender] = (chatData.linkgruposCounter[m.sender] || 0) + 1
  const strikes = chatData.linkgruposCounter[m.sender]

  if (strikes > LIMITE) {
    try {
      await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
    } catch {}

    delete chatData.linkgruposCounter[m.sender]

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
