/**
 * plugins/group/group-kick.js
 * Comandos: .kick / .ban / .unban / .baneados
 *
 * .kick <mención o responder>   → expulsa del grupo (solo admins)
 * .ban <mención o responder>    → expulsa Y agrega a la lista de
 *                                  baneados de ese grupo (solo admins)
 * .unban <mención, responder, o número>
 *                                → quita de la lista de baneados
 * .baneados                     → lista quién está baneado en el grupo
 *
 * Si alguien baneado intenta volver a entrar, el bot lo expulsa
 * automáticamente (requiere que el bot sea admin).
 */

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function getChatConfig(chatId) {
  if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {}
  const chat = global.db.data.chats[chatId]
  if (!Array.isArray(chat.baneados)) chat.baneados = []
  return chat
}

// Saca el JID objetivo: mención, o el sender del mensaje citado
function obtenerObjetivo(m) {
  if (m.mentionedJid && m.mentionedJid[0]) return m.mentionedJid[0]
  if (m.quoted && m.quoted.sender) return m.quoted.sender
  return null
}

const handler = async (m, { conn, command, text, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, { text: decorar('Esto solo funciona dentro de un grupo.') }, { quoted: m })
  }
  if (!isAdmin) {
    return conn.sendMessage(m.chat, { text: decorar('Solo un admin puede usar este comando.') }, { quoted: m })
  }
  if (!isBotAdmin) {
    return conn.sendMessage(m.chat, { text: decorar('La bot necesita ser admin para poder hacer esto.') }, { quoted: m })
  }

  const chat = getChatConfig(m.chat)

  // --- .baneados: solo listar, no necesita objetivo ---
  if (command === 'baneados') {
    if (!chat.baneados.length) {
      return conn.sendMessage(m.chat, { text: decorar('No hay nadie baneado en este grupo.') }, { quoted: m })
    }
    const lista = chat.baneados.map((n, i) => `${i + 1}. +${n}`).join('\n')
    return conn.sendMessage(m.chat, { text: decorar(`Baneados en este grupo (${chat.baneados.length}):\n\n${lista}`) }, { quoted: m })
  }

  // --- .unban acepta también un número escrito directo ---
  let objetivo = obtenerObjetivo(m)
  if (!objetivo && command === 'unban' && text?.trim()) {
    const numero = text.trim().replace(/[^0-9]/g, '')
    if (numero) objetivo = `${numero}@s.whatsapp.net`
  }

  if (!objetivo) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Menciona a alguien o responde su mensaje.\nEjemplo: .${command} @usuario`)
    }, { quoted: m })
  }

  const numeroObjetivo = objetivo.split('@')[0]

  if (objetivo === conn.user.jid.split(':')[0] + '@s.whatsapp.net' || objetivo === conn.user.jid) {
    return conn.sendMessage(m.chat, { text: decorar('No puedo expulsarme a mí misma 😅') }, { quoted: m })
  }

  // --- .unban ---
  if (command === 'unban') {
    const idx = chat.baneados.indexOf(numeroObjetivo)
    if (idx === -1) {
      return conn.sendMessage(m.chat, { text: decorar(`+${numeroObjetivo} no está baneado en este grupo.`) }, { quoted: m })
    }
    chat.baneados.splice(idx, 1)
    return conn.sendMessage(m.chat, { text: decorar(`✅ +${numeroObjetivo} fue desbaneado. Ya puede volver a entrar.`) }, { quoted: m })
  }

  // --- .kick / .ban: expulsar ---
  try {
    await conn.groupParticipantsUpdate(m.chat, [objetivo], 'remove')
  } catch (e) {
    console.error('[kick] ERROR expulsando:', e)
    return conn.sendMessage(m.chat, { text: decorar('❌ No se pudo expulsar. Revisa que siga en el grupo.') }, { quoted: m })
  }

  if (command === 'ban') {
    if (!chat.baneados.includes(numeroObjetivo)) chat.baneados.push(numeroObjetivo)
    return conn.sendMessage(m.chat, {
      text: decorar(`🔨 +${numeroObjetivo} fue expulsado y baneado.\nSi intenta volver a entrar, se le expulsará automáticamente.`)
    }, { quoted: m })
  }

  return conn.sendMessage(m.chat, { text: decorar(`👢 +${numeroObjetivo} fue expulsado del grupo.`) }, { quoted: m })
}

handler.command = ['kick', 'ban', 'unban', 'baneados']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['group']
handler.help = ['kick @usuario', 'ban @usuario', 'unban @usuario', 'baneados']
handler.group = true

// --- Auto-expulsión al reingresar si está baneado ---
if (!global.__antiBanListenerActivo) {
  global.__antiBanListenerActivo = true

  const registrarListener = () => {
    if (!global.conn?.ev) return setTimeout(registrarListener, 3000)

    global.conn.ev.on('group-participants.update', async (update) => {
      const { id, participants, action } = update
      if (action !== 'add') return

      const chat = global.db.data.chats?.[id]
      if (!chat?.baneados?.length) return

      for (const participante of participants) {
        const numero = participante.split('@')[0]
        if (chat.baneados.includes(numero)) {
          try {
            await global.conn.groupParticipantsUpdate(id, [participante], 'remove')
            await global.conn.sendMessage(id, {
              text: decorar(`🚫 +${numero} está baneado de este grupo. Se expulsó automáticamente.`)
            })
          } catch (e) {
            console.error('[kick] ERROR auto-expulsando baneado:', e)
          }
        }
      }
    })
  }

  registrarListener()
}

export default handler
