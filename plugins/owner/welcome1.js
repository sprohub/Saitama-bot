import fs from 'fs'
import path from 'path'
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

const settingsPath = path.resolve('./json/settings.json')
const FILAS_POR_SECCION = 10 // límite de WhatsApp por sección en un single_select

function isOwner(m) {
  const number = m.sender?.split('@')[0]
  const owners = (global.owner || []).map(([num]) => num.replace(/[^0-9]/g, ''))
  return m.fromMe || owners.includes(number)
}

// === UTILS JSON (mismo formato que tu archivo on/off original) ===
function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2))
    }
    return JSON.parse(fs.readFileSync(settingsPath))
  } catch {
    return {}
  }
}

function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}

function getChatConfig(botNumber, chatId) {
  let settings = readSettings()
  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = {
      antilink: false,
      welcome: false,
      antiarabe: false,
      modoadmin: false,
      reglas: false
    }
    saveSettings(settings)
  }
  return settings
}

function getWelcome(botNumber, chatId) {
  const settings = getChatConfig(botNumber, chatId)
  return !!settings[botNumber][chatId].welcome
}

function setWelcome(botNumber, chatId, enable) {
  const settings = getChatConfig(botNumber, chatId)
  settings[botNumber][chatId].welcome = enable
  saveSettings(settings)
}

// === TODOS los grupos donde está el bot, sin importar si es admin ===
async function gruposDelBot(conn) {
  const chats = await conn.groupFetchAllParticipating()
  return Object.values(chats)
}

// === Cuenta en cuántos de esos grupos el welcome está activo ===
function contarGruposActivos(botNumber, grupos) {
  return grupos.filter((g) => getWelcome(botNumber, g.id)).length
}

// === Anti-duplicados: evita procesar el mismo evento de entrada/salida dos veces ===
// (Solo funciona si ESTE es el ÚNICO archivo que escucha estos eventos.
//  Si tienes otra copia de este plugin en otra ruta, bórrala primero.)
const eventosProcesados = new Map()
const VENTANA_DEDUPE_MS = 10 * 1000

function yaSeProceso(id) {
  if (!id) return false
  const ahora = Date.now()
  for (const [key, ts] of eventosProcesados) {
    if (ahora - ts > VENTANA_DEDUPE_MS) eventosProcesados.delete(key)
  }
  if (eventosProcesados.has(id)) return true
  eventosProcesados.set(id, ahora)
  return false
}

// === Helpers de menú interactivo ===
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
// Comando .welcome — abre el menú de botones
// ───────────────────────────────────────────
const handler = async (m, { conn }) => {
  if (!isOwner(m)) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar este comando.\n╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Cargando grupos...\n╰───────────────⬣`
  )

  const botNumber = conn.user?.jid || conn.user.id
  const grupos = await gruposDelBot(conn)
  const activosCount = contarGruposActivos(botNumber, grupos)

  const sections = []

  if (m.isGroup) {
    const enAqui = getWelcome(botNumber, m.chat)
    sections.push({
      title: '⚙️ Este grupo',
      rows: [{
        title: enAqui ? '🔴 Desactivar aquí' : '🟢 Activar aquí',
        description: `Estado actual: ${enAqui ? 'Activado ✅' : 'Desactivado ❌'}`,
        id: `welcome|${enAqui ? 'off' : 'on'}|${m.chat}`
      }]
    })
  }

  sections.push({
    title: '🌐 Todos los grupos',
    rows: [
      { title: '🟢 Activar en todos', description: `${grupos.length} grupos donde está el bot`, id: 'welcome|on|all' },
      { title: '🔴 Desactivar en todos', description: `${grupos.length} grupos donde está el bot`, id: 'welcome|off|all' }
    ]
  })

  for (let i = 0; i < grupos.length; i += FILAS_POR_SECCION) {
    const chunk = grupos.slice(i, i + FILAS_POR_SECCION)
    const desde = i + 1
    const hasta = i + chunk.length

    sections.push({
      title: `📋 Grupos ${desde}-${hasta}`,
      rows: chunk.map((g) => {
        const estado = getWelcome(botNumber, g.id)
        return {
          title: `🌿 ${g.subject}`,
          description: `${estado ? 'Activado ✅' : 'Desactivado ❌'} — toca para alternar`,
          id: `welcome|toggle|${g.id}`
        }
      })
    })
  }

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 👋 Menú de Bienvenida\n` +
    `│ 🍃 El bot está en ${grupos.length} grupo(s)\n` +
    `│ 🍃 Welcome activo en ${activosCount} de ${grupos.length}\n` +
    `│ 🍃 Toca una opción para activar/desactivar\n` +
    `╰───────────────⬣`

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌿 SAITAMA-BOT — Welcome', subtitle: `Activo en ${activosCount}/${grupos.length} grupos`, hasMediaAttachment: false },
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
    console.log('[welcome] error mostrando menú:', e)
    await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo mostrar el menú.\n╰───────────────⬣`)
  }
}

handler.command = ['welcome']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['group']
handler.help = ['welcome']
handler.desc = 'Menú para activar/desactivar la bienvenida por grupo o en todos'

// ───────────────────────────────────────────
// handler.before — botones del menú + envío real de bienvenida/despedida
// ───────────────────────────────────────────
handler.before = async (m, { conn }) => {
  const botNumber = conn.user?.jid || conn.user.id

  // ── 1) Botones del menú .welcome ──
  const content = unwrapMessage(m.message)
  const id = content ? extractSelectedId(content) : null

  if (id && id.startsWith('welcome|')) {
    if (!isOwner(m)) {
      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar esto.\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    const [, accion, destino] = id.split('|')

    if (destino === 'all') {
      const grupos = await gruposDelBot(conn)
      grupos.forEach((g) => setWelcome(botNumber, g.id, accion === 'on'))

      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${accion === 'on' ? 'activada ✅' : 'desactivada ❌'} en ${grupos.length} grupo(s).\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    if (accion === 'toggle') {
      const actual = getWelcome(botNumber, destino)
      setWelcome(botNumber, destino, !actual)

      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${!actual ? 'activada ✅' : 'desactivada ❌'} en ese grupo.\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    setWelcome(botNumber, destino, accion === 'on')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${accion === 'on' ? 'activada ✅' : 'desactivada ❌'} en este grupo.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  // ── 2) Envío real de bienvenida / despedida ──
  if (!m.isGroup) return false
  if (!getWelcome(botNumber, m.chat)) return false
  if (![27, 28, 32].includes(m.messageStubType)) return false

  const idEvento = m.key?.id || `${m.chat}_${m.messageStubType}_${m.messageStubParameters?.[0] || m.sender}`
  if (yaSeProceso(idEvento)) return false

  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const groupSize = groupMetadata.participants.length
  const userId = m.messageStubParameters?.[0] || m.sender
  const userMention = '@' + userId.split('@')[0]

  let profilePic
  try {
    profilePic = await conn.profilePictureUrl(m.chat, 'image')
  } catch {
    profilePic = null
  }

  // ✅ ENTRA AL GRUPO
  if (m.messageStubType === 27) {
    let texto
    if (chat.sWelcome) {
      texto = chat.sWelcome
        .replace(/@user/g, userMention)
        .replace(/@group/g, groupMetadata.subject)
        .replace(/@members/g, groupSize)
    } else {
      texto =
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 👋 ¡Bienvenido/a!\n` +
        `│\n` +
        `│ 👤 ${userMention}\n` +
        `│ 🏠 Grupo: ${groupMetadata.subject}\n` +
        `│ 👥 Miembros: ${groupSize}\n` +
        `│\n` +
        `│ 🍃 Un nuevo discípulo se une al dojo.\n` +
        `│ 💪 Entrena duro.\n` +
        `╰───────────────⬣`
    }

    if (profilePic) {
      await conn.sendMessage(m.chat, { image: { url: profilePic }, caption: texto, mentions: [userId] })
    } else {
      await conn.sendMessage(m.chat, { text: texto, mentions: [userId] })
    }
  }

  // ❌ SALE DEL GRUPO
  if ([28, 32].includes(m.messageStubType)) {
    let texto
    if (chat.sBye) {
      texto = chat.sBye
        .replace(/@user/g, userMention)
        .replace(/@group/g, groupMetadata.subject)
        .replace(/@members/g, groupSize)
    } else {
      texto =
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 💨 ¡Hasta luego!\n` +
        `│\n` +
        `│ 👤 ${userMention}\n` +
        `│ 🏠 Grupo: ${groupMetadata.subject}\n` +
        `│ 👥 Miembros restantes: ${groupSize}\n` +
        `│\n` +
        `│ 🍃 Un miembro abandonó el dojo.\n` +
        `╰───────────────⬣`
    }

    // 🔧 FIX: antes mandaba { image: { url: profilePic } } SIEMPRE, incluso
    // si profilePic era null → eso era lo que crasheaba Baileys.
    if (profilePic) {
      await conn.sendMessage(m.chat, { image: { url: profilePic }, caption: texto, mentions: [userId] })
    } else {
      await conn.sendMessage(m.chat, { text: texto, mentions: [userId] })
    }
  }

  return false
}

export default handler