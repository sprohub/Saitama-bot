import fs from 'fs'
import path from 'path'

const settingsPath = path.resolve('./json/settings.json')

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

// === COMANDO .setreglas <texto> (solo admins) ===
const handler = async (m, { conn, text, isAdmin }) => {
  if (!isAdmin) return m.reply('❌ Solo un admin puede cambiar las reglas.')
  if (!text) return m.reply('✏️ Escribe el texto de las reglas. Usa @group para el nombre del grupo.')

  const botNumber = conn.user?.jid || 'bot'
  const settings = getChatConfig(botNumber, m.chat)
  settings[botNumber][m.chat].sReglas = text
  saveSettings(settings)

  return m.reply('✅ Reglas actualizadas correctamente.')
}

handler.command = ['setreglas']
handler.customPrefix = /^[.\/#@]/i
handler.group = true
handler.admin = true
handler.tags = ['group']
handler.help = ['setreglas <texto>']

export default handler
