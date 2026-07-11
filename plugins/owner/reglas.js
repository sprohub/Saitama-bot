import fs from 'fs'
import path from 'path'

const settingsPath = path.resolve('./json/settings.json')

// === UTILS JSON (mismos que en on-off.js) ===
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
      modoadmin: false
    }
    saveSettings(settings)
  }
  return settings
}

// Texto de reglas por defecto (o el personalizado con .setreglas)
export function getReglasText(botNumber, chatId, groupName = 'el grupo') {
  const settings = getChatConfig(botNumber, chatId)
  const chat = settings[botNumber][chatId]

  if (chat.sReglas) {
    return chat.sReglas
      .replace(/@group/g, groupName)
  }

  return `📋 *REGLAS DE ${groupName.toUpperCase()}*\n\n` +
    `1️⃣ Respeta a todos los miembros, sin insultos ni discriminación.\n` +
    `2️⃣ Prohibido el spam y la publicidad no autorizada.\n` +
    `3️⃣ Nada de contenido explícito, violento o ilegal.\n` +
    `4️⃣ No se permiten links de otros grupos/canales (antilink activo).\n` +
    `5️⃣ Mantén las conversaciones dentro del tema del grupo.\n` +
    `6️⃣ Usa *.menu* para ver los comandos disponibles.\n\n` +
    `_El incumplimiento puede resultar en advertencia o expulsión._`
}

// === COMANDO .reglas / #reglas / @reglas ===
const handler = async (m, { conn }) => {
  const botNumber = conn.user?.jid || 'bot'
  const groupName = m.isGroup
    ? (await conn.groupMetadata(m.chat)).subject
    : 'el chat'

  const texto = getReglasText(botNumber, m.chat, groupName)
  return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.command = ['reglas']
// Permite que el comando responda con . / # @ además del prefijo global,
// por si tu framework no incluye esos símbolos en el prefijo por defecto.
handler.customPrefix = /^[.\/#@]/i
handler.group = true
handler.tags = ['group']
handler.help = ['reglas']

export default handler

// === COMANDO OPCIONAL: .setreglas <texto> (solo admins) ===
export const setHandler = async (m, { conn, text, isAdmin }) => {
  if (!isAdmin) return m.reply('❌ Solo un admin puede cambiar las reglas.')
  if (!text) return m.reply('✏️ Escribe el texto de las reglas. Usa @group para el nombre del grupo.')

  const botNumber = conn.user?.jid || 'bot'
  const settings = getChatConfig(botNumber, m.chat)
  settings[botNumber][m.chat].sReglas = text
  saveSettings(settings)

  return m.reply('✅ Reglas actualizadas correctamente.')
}

setHandler.command = ['setreglas']
setHandler.customPrefix = /^[.\/#@]/i
setHandler.group = true
setHandler.admin = true
setHandler.tags = ['group']
setHandler.help = ['setreglas <texto>']
