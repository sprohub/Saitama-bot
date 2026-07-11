import fs from 'fs'
import path from 'path'
import { join } from 'path'
import { xpRange } from '../../lib/levelling.js'
import { getReglasText } from './reglas.js'

const settingsPath = path.resolve('./json/settings.json')
const defaultImage = 'https://files.catbox.moe/avx0u1.jpg'

// === DUEÑOS DEL BOT ===
// Solo estos números (o el propio bot) pueden activar/desactivar welcome y reglas
const OWNERS = ['573225396540', '573225814649']

function isOwner(m) {
  const number = m.sender?.split('@')[0]
  return m.fromMe || OWNERS.includes(number)
}

// === UTILS JSON ===
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

// === COMANDO ON/OFF ===
const handler = async (m, { conn, command, args, isAdmin }) => {

  const type = (args[0] || '').toLowerCase()
  const enable = command === 'on'
  const validTypes = ['antilink', 'welcome', 'antiarabe', 'modoadmin', 'reglas']
  if (!validTypes.includes(type)) {
    return m.reply(
      `*_🟢 ON:_*\n\n_.on antilink_\n_.on welcome_\n_.on antiarabe_\n_.on modoadmin_\n_.on reglas_\n\n\n*_🔴 OFF:_*\n\n_.off antilink_\n_.off welcome_\n_.off antiarabe_\n_.off modoadmin_\n_.off reglas_`
    )
  }

  // 🔐 welcome y reglas solo los puede tocar el dueño del bot
  if ((type === 'welcome' || type === 'reglas') && !isOwner(m)) {
    return m.reply('❌ Solo el dueño del bot puede activar o desactivar esto.')
  }

  const botNumber = conn.user?.jid || 'bot'
  let settings = getChatConfig(botNumber, m.chat)
  settings[botNumber][m.chat][type] = enable
  saveSettings(settings)

  return m.reply(`✅ ${type} ${enable ? 'activado' : 'desactivado'}.`)
}

handler.command = ['on', 'off']
handler.group = true
handler.admin = true
handler.tags = ['group']
handler.help = ['on welcome', 'off welcome', 'on reglas', 'off reglas']

// === MIDDLEWARE ===
handler.before = async (m, { conn }) => {
  if (!m.isGroup) return
  const botNumber = conn.user?.jid || 'bot'
  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  // 🔒 MODO ADMIN
  if (chat.modoadmin) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    if (!isUserAdmin && !m.fromMe) return
  }

  // 🚫 ANTIARABE
  if (chat.antiarabe && m.messageStubType === 27) {
    const newJid = m.messageStubParameters?.[0]
    if (newJid) {
      const number = newJid.split('@')[0]
      const arabicPrefixes = ['212', '20', '971', '965', '966', '974', '973', '962']
      if (arabicPrefixes.some(prefix => number.startsWith(prefix))) {
        await conn.sendMessage(m.chat, { text: `Este usuario ${newJid} será expulsado. [ Anti Arabe Activado ]` })
        await conn.groupParticipantsUpdate(m.chat, [newJid], 'remove')
        return true
      }
    }
  }

  // 🔗 ANTILINK
  const linkRegex = /chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i
  const linkRegex1 = /whatsapp\.com\/channel\/[0-9A-Za-z]{20,24}/i
  if (chat.antilink) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const isUserAdmin = groupMetadata.participants.find(p => p.id === m.sender)?.admin
    const text = m?.text || ''

    if (!isUserAdmin && (linkRegex.test(text) || linkRegex1.test(text))) {
      const userTag = `@${m.sender.split('@')[0]}`

      try {
        const ownGroupLink = `https://chat.whatsapp.com/${await conn.groupInviteCode(m.chat)}`
        if (text.includes(ownGroupLink)) return
      } catch {}

      await conn.sendMessage(m.chat, { text: `🚫 Hey ${userTag}, no se permiten links aquí.`, mentions: [m.sender] }, { quoted: m })
      await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
      return true
    }
  }

  // 👋 BIENVENIDA / DESPEDIDA / REGLAS
  if ((chat.welcome || chat.reglas) && [27, 28, 32].includes(m.messageStubType)) {
    const groupMetadata = await conn.groupMetadata(m.chat)
    const groupSize = groupMetadata.participants.length
    const userId = m.messageStubParameters?.[0] || m.sender
    const userMention = '@' + userId.split('@')[0]
    let profilePic
    try {
      profilePic = await conn.profilePictureUrl(m.chat, 'image')
    } catch {
      profilePic = 'https://files.catbox.moe/r60c8l.jpg'
    }

    // ✅ ENTRA AL GRUPO
    if (m.messageStubType === 27) {
      if (chat.welcome) {
        let texto
        if (chat.sWelcome) {
          texto = chat.sWelcome
            .replace(/@user/g, userMention)
            .replace(/@group/g, groupMetadata.subject)
            .replace(/@members/g, groupSize)
        } else {
          texto = `╭━━⬣ *SAITAMA* ⬣\n`
          texto += `┃\n`
          texto += `┃ 👊 *¡BIENVENIDO!*\n`
          texto += `┃\n`
          texto += `┃ 👤 ${userMention}\n`
          texto += `┃ 🏠 *Grupo:* ${groupMetadata.subject}\n`
          texto += `┃ 👥 *Miembros:* ${groupSize}\n`
          texto += `┃\n`
          texto += `┃ 「Un nuevo discípulo...」\n`
          texto += `┃ Se ha unido al dojo.\n`
          texto += `┃ Entrena duro 💪\n`
          texto += `┃\n`
          texto += `╰━━━━━━━━━━━━━━━━━━━━━━⬣ *SAITAMA*`
        }

        await conn.sendMessage(m.chat, {
          image: { url: profilePic },
          caption: texto,
          mentions: [userId]
        })
      }

      // 📋 Reglas: independiente de welcome (toggle propio: chat.reglas)
      if (chat.reglas) {
        const reglasTexto = getReglasText(botNumber, m.chat, groupMetadata.subject)
        await conn.sendMessage(m.chat, {
          text: reglasTexto,
          mentions: [userId]
        })
      }
    }

    // ❌ SALE DEL GRUPO
    if ([28, 32].includes(m.messageStubType) && chat.welcome) {
      let texto
      if (chat.sBye) {
        texto = chat.sBye
          .replace(/@user/g, userMention)
          .replace(/@group/g, groupMetadata.subject)
          .replace(/@members/g, groupSize)
      } else {
        texto = `╭━━⬣ *SAITAMA* ⬣\n`
        texto += `┃\n`
        texto += `┃ 💨 *¡HASTA LUEGO!*\n`
        texto += `┃\n`
        texto += `┃ 👤 ${userMention}\n`
        texto += `┃ 🏠 *Grupo:* ${groupMetadata.subject}\n`
        texto += `┃ 👥 *Miembros restantes:* ${groupSize}\n`
        texto += `┃\n`
        texto += `┃ 「Ni siquiera lo sentí...」\n`
        texto += `┃ Un miembro ha abandonado\n`
        texto += `┃ el dojo. Buena suerte 👊\n`
        texto += `┃\n`
        texto += `╰━━━━━━━━━━━━━━━━━━━━━━⬣ *SAITAMA*`
      }

      await conn.sendMessage(m.chat, {
        image: { url: profilePic },
        caption: texto,
        mentions: [userId]
      })
    }
  }
}

export default handler
