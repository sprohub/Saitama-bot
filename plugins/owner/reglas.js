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
handler.customPrefix = /^[.\/#@]/i
handler.group = true
handler.tags = ['group']
handler.help = ['reglas']

export default handler
