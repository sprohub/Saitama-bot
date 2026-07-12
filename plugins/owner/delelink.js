// plugins/group/antilink.js
// .on delelink / .off delelink  → solo owner puede activarlo/desactivarlo
// (también funciona con /, @ y # como prefijo)
// Si un usuario (que NO sea admin ni owner) manda más de 3 links en un mismo
// mensaje, se elimina el mensaje y se expulsa automáticamente del grupo.

// ───────────────────────────────────────────
// Regex para detectar links (http/https, www., wa.me, chat.whatsapp.com, etc.)
// ───────────────────────────────────────────
const LINK_REGEX = /(https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)\S+/gi
const LIMITE_LINKS = 3 // "más de 3" => 4 o más dispara el ban

// ───────────────────────────────────────────
// Utilidad: saber si el sender es owner (mismo patrón usado en cphoto.js)
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
// Comando .on delelink / .off delelink
// ───────────────────────────────────────────
const handler = async (m, { conn, text, command, isOwner }) => {
  // Este plugin solo responde si el argumento es "delelink".
  // Así no choca con otros .on / .off de otras funciones (welcome, antifake, etc).
  const arg = (text || '').trim().toLowerCase()
  if (arg !== 'delelink') return

  if (!m.isGroup) {
    return conn.sendMessage(
      m.chat,
      { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Este comando solo funciona dentro de un grupo.\n╰───────────────⬣' },
      { quoted: m }
    )
  }

  const permitido = isOwner || (await esOwner(conn, m.sender, m))
  if (!permitido) {
    return conn.sendMessage(
      m.chat,
      { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el *owner* puede activar o desactivar el delelink.\n╰───────────────⬣' },
      { quoted: m }
    )
  }

  const activar = command.toLowerCase() === 'on'

  global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
  global.db.data.chats[m.chat].delelink = activar
  if (!activar) global.db.data.chats[m.chat].delelinkCounter = {}

  await conn.sendMessage(
    m.chat,
    {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Delelink ${activar ? 'activado ✅' : 'desactivado ❌'} en este grupo.\n╰───────────────⬣`
    },
    { quoted: m }
  )
}

handler.command = ['on', 'off']
handler.customPrefix = /^[.\/#@]/
handler.group = true

// ───────────────────────────────────────────
// handler.before — corre en cada mensaje del grupo, revisa si trae links
// ───────────────────────────────────────────
handler.before = async function (m, { conn }) {
  if (!m.isGroup || !m.text) return false

  const chatData = (global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {})
  if (!chatData.delelink) return false

  const matches = m.text.match(LINK_REGEX)
  if (!matches || matches.length === 0) return false

  // No aplica a owners
  if (await esOwner(conn, m.sender, m)) return false

  // No aplica a admins del grupo
  const groupMetadata = await conn.groupMetadata(m.chat)
  const participante = groupMetadata.participants.find((p) => p.id === m.sender)
  if (participante?.admin) return false

  // Verifica que el bot sea admin para poder borrar/expulsar
  const botNumber = conn.user.id.split(':')[0].split('@')[0]
  const botParticipante = groupMetadata.participants.find((p) => p.id.split('@')[0] === botNumber)
  if (!botParticipante?.admin) {
    await conn.sendMessage(
      m.chat,
      {
        text:
          '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Se detectó un link pero no soy *admin*, no puedo actuar.\n╰───────────────⬣'
      },
      { quoted: m }
    )
    return true
  }

  // Borra el mensaje con link siempre que delelink esté activo
  try {
    await conn.sendMessage(m.chat, { delete: m.key })
  } catch {}

  // Contador acumulado por usuario dentro del grupo (persistente en la db)
  chatData.delelinkCounter = chatData.delelinkCounter || {}
  chatData.delelinkCounter[m.sender] = (chatData.delelinkCounter[m.sender] || 0) + matches.length

  const strikes = chatData.delelinkCounter[m.sender]

  if (strikes > LIMITE_LINKS) {
    try {
      await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
    } catch {}

    delete chatData.delelinkCounter[m.sender]

    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT — Delelink*\n` +
        `│ 🍃 @${m.sender.split('@')[0]} fue expulsado por superar el límite de ${LIMITE_LINKS} links.\n` +
        `╰───────────────⬣`,
      mentions: [m.sender]
    })
  } else {
    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT — Delelink*\n` +
        `│ 🍃 @${m.sender.split('@')[0]}, no envíes links. (${strikes}/${LIMITE_LINKS})\n` +
        `╰───────────────⬣`,
      mentions: [m.sender]
    })
  }

  return true
}

export default handler
