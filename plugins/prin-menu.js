import fs from 'fs'
import path, { join } from 'path'
import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'
import { xpRange } from '../lib/levelling.js'

const tags = {
  main: '🌿 Principal',
  group: '🐒 Grupos',
  tools: '🛠️ Tools',
  rpg: '🐆 RPG',
  game: '🎮 Game',
  gacha: '🎰 Gacha',
  diversion: '🦜 Diversión',
  anime: '🍃 Anime',
  serbot: '🐍 SerBot',
  owner: '👑 Owner',
  downloader: '📥 Downloader',
  info: 'ℹ️ Info'
}

const bannerCategory = {
  main: 'https://i.ibb.co/8DsHnhn9/8f759145-d6d9-4980-8b65-bc5a27d63c00.png',
  group: 'https://i.ibb.co/C38P3Wqg/ultra.jpg',
  tools: 'https://i.ibb.co/jkhp8BZD/wof.jpg',
  rpg: 'https://i.ibb.co/V040CGfq/enojado.jpg',
  game: 'https://i.ibb.co/jkhp8BZD/wof.jpg',
  gacha: 'https://i.ibb.co/DPHT5V5Y/caminata.jpg',
  serbot: 'https://i.ibb.co/j94w01QV/mascota.jpg',
  owner: 'https://i.ibb.co/V040CGfq/enojado.jpg',
  downloader: 'https://i.ibb.co/C38P3Wqg/ultra.jpg',
  info: 'https://i.ibb.co/jkhp8BZD/wof.jpg',
  diversion: 'https://i.ibb.co/j94w01QV/mascota.jpg',
  anime: 'https://i.ibb.co/DPHT5V5Y/caminata.jpg'
}

// Icono genérico por comando
const cmdIcon = '🍃'

// Texto principal del body — tema selva, limpio y ordenado
function buildBodyText({ totalreg, totalcmd, uptime, user, tagSeleccionada }) {
  let titulo = tagSeleccionada
    ? tags[tagSeleccionada].split(' ').slice(1).join(' ')
    : 'MENÚ PRINCIPAL'

  return (
    `╭─🌴・・・・・・・・・・・╮\n` +
    `│ 🐾 *${titulo}*\n` +
    `│ 👤 @${user}\n` +
    `│ 📦 ${totalcmd} cmds  🐒 ${totalreg} users\n` +
    `│ ⏱️ ${uptime}\n` +
    `╰・・・・・・・・・・・🌴─╯\n` +
    `🍃 Toca el botón para ver comandos 🍃`
  )
}

// Construye las secciones para el single_select según la categoría
function buildSections(help, usedPrefix, tagSeleccionada) {
  const sections = []

  for (let tag of Object.keys(tags)) {
    if (tagSeleccionada && tag !== tagSeleccionada) continue

    const cmdsFiltrados = help.filter(menu => menu.tags?.includes(tag))
    if (!cmdsFiltrados.length) continue

    const rows = cmdsFiltrados.flatMap(menu =>
      menu.help.map(h => {
        const cmdFinal = menu.prefix ? h : `${usedPrefix}${h}`
        return {
          title: `${cmdIcon} ${cmdFinal}`,
          description: menu.desc ? `🐆 ${menu.desc.slice(0, 68)}` : '🐆 Sin descripción',
          id: `menu_cmd~${tag}~${cmdFinal}`
        }
      })
    )

    sections.push({
      title: `「 ${tags[tag]} 」· ${cmdsFiltrados.length}`,
      rows: rows.slice(0, 10) // WhatsApp permite max 10 rows por sección
    })
  }

  return sections
}

let handler = async (m, { conn, usedPrefix: _p, command }) => {
  try {
    let who = m.sender
    let user = global.db.data.users[who]
    if (!user) {
      user = { exp: 0, level: 0 }
      global.db.data.users[who] = user
    }

    const help = Object.values(global.plugins)
      .filter(p => !p.disabled)
      .map(p => ({
        help: Array.isArray(p.help) ? p.help : [p.help],
        tags: Array.isArray(p.tags) ? p.tags : [p.tags],
        prefix: 'customPrefix' in p,
        desc: p.desc || ''
      }))

    // Detectar subcategoría (ej: menudownloader, menurpg...)
    let tagSeleccionada = null
    if (command.startsWith('menu') && command.length > 4) {
      let tagBuscada = command.replace('menu', '').toLowerCase()
      for (let key of Object.keys(tags)) {
        if (key.toLowerCase() === tagBuscada) {
          tagSeleccionada = key
          break
        }
      }
    }

    const bannerUrl = tagSeleccionada ? bannerCategory[tagSeleccionada] : bannerCategory.main

    const totalreg = Object.keys(global.db.data.users).length
    const totalcmd = Object.keys(global.plugins).length
    const uptime = Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's'
    const userTag = who.split('@')[0]

    // Preparar imagen del header
    let media = null
    try {
      media = await prepareWAMessageMedia(
        { image: { url: bannerUrl } },
        { upload: conn.waUploadToServer }
      )
    } catch {}

    // Construir secciones del menú
    const sections = buildSections(help, _p, tagSeleccionada)

    // Si no hay secciones (categoría vacía)
    if (!sections.length) {
      return conn.sendMessage(m.chat, {
        text:
          `╭─🌴・・・・・・・╮\n` +
          `│ 🐒 *Ups...*\n` +
          `│ 🍃 No se encontraron comandos.\n` +
          `╰・・・・・・・🌴─╯`
      }, { quoted: m })
    }

    const bodyText = buildBodyText({ totalreg, totalcmd, uptime, user: userTag, tagSeleccionada })

    const subtitleText = tagSeleccionada
      ? tags[tagSeleccionada]
      : `🌿 ${totalcmd} cmds • 🐒 ${totalreg} users`

    // Botón principal: si hay una sola categoría, su sección; si es menú general, todas
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌴 SAITAMA BOT 🌴',
        subtitle: subtitleText,
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text: bodyText
      },
      footer: {
        text: '🐆 SAITAMA BOT • v1.0 🌿'
      },
      nativeFlowMessage: {
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🌿 VER MENÚ',
              sections
            })
          }
        ]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage
          }
        }
      },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: `❌ Error:\n${e}` }, { quoted: m })
  }
}

// Quita wrappers (ephemeral / viewOnce / etc) para llegar al contenido real del mensaje
function unwrapMessage(message) {
  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage'
  ]
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find(w => msg[w])
    if (!key) break
    msg = msg[key].message
    guard++
  }
  return msg
}

// Extrae el id seleccionado sin importar el formato exacto de respuesta que mande WhatsApp
function extractSelectedId(content) {
  const nativeFlow = content?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (nativeFlow?.paramsJson) {
    try {
      const data = JSON.parse(nativeFlow.paramsJson)
      const id = data.id || data.selectedId || data.selectedRowId
      if (id) return id
    } catch (e) {
      console.log('[menu] error parseando nativeFlow.paramsJson:', e, nativeFlow.paramsJson)
    }
  }

  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId

  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId

  return null
}

// Al seleccionar un comando del menú, solo se envía el texto ".comando" al chat
handler.before = async (m, { conn, usedPrefix }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id) return false

  if (!id.startsWith('menu_cmd~')) return false

  const parts = id.split('~')
  const cmd = parts[2] || ''

  console.log('[menu] comando seleccionado:', cmd)

  if (cmd) {
    try {
      await conn.sendMessage(m.chat, { text: cmd }, { quoted: m })
    } catch (e) {
      console.log('[menu] error enviando comando seleccionado:', e)
    }
  }

  return true
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|menú|help)(rpg|group|diversion|game|gacha|serbot|owner|downloader|info|main|tools|anime)?$/i
handler.register = false
handler.desc = 'Muestra el menú'

export default handler
