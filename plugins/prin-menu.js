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
  main: '⭐ Principal',
  group: '👥 Grupos',
  tools: '🛠️ Tools',
  rpg: '⚔️ RPG',
  game: '🎮 Game',
  gacha: '🎰 Gacha',
  diversion: '🎪 Diversión',
  anime: '🌸 Anime',
  serbot: '🤖 SerBot',
  owner: '👑 Owner',
  downloader: '📥 Downloader',
  info: 'ℹ️ Info'
}

const bannerCategory = {
  main: 'https://i.ibb.co/TB7cZfFG/SAITAMAmenu.jpg',
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

// Texto principal del body (se muestra encima del botón de lista)
function buildBodyText({ totalreg, totalcmd, uptime, user, tagSeleccionada }) {
  let titulo = tagSeleccionada
    ? `SAITAMA BOT ➳ ${tags[tagSeleccionada].split(' ').slice(1).join(' ')}`
    : 'SAITAMA BOT'

  return (
    `╭━━━━━━━━━━━━━━━⬣\n` +
    `🌸 ✦ *${titulo}* ✦ 🌸\n` +
    `⬣━━━━━━━━━━━━━━━╯\n\n` +
    `🍀 👥 Usuarios: *${totalreg}*\n` +
    `⚡ 📦 Comandos: *${totalcmd}*\n` +
    `🚀 ⏱️ Uptime: *${uptime}*\n` +
    `💮 👤 Usuario: @${user}\n\n` +
    `╭───────────────⬣\n` +
    `│ 🦆 *¡Hola!* Elige una categoría\n` +
    `│ 🌸 y explora todos los comandos\n` +
    `╰───────────────⬣\n\n` +
    `> ⚡ Toca el botón de abajo ⬇️`
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
      menu.help.map(h => ({
        header: tags[tag],
        title: menu.prefix ? h : `${usedPrefix}${h}`,
        description: menu.desc ? menu.desc.slice(0, 72) : 'Sin descripción',
        id: `menu_cmd~${tag}~${menu.prefix ? h : `${usedPrefix}${h}`}`
      }))
    )

    sections.push({
      title: `${tags[tag]} (${cmdsFiltrados.length})`,
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
        text: `🦆 *Ups...* No se encontraron comandos para esa categoría. 🌸`
      }, { quoted: m })
    }

    const bodyText = buildBodyText({ totalreg, totalcmd, uptime, user: userTag, tagSeleccionada })

    const subtitleText = tagSeleccionada
      ? `🌸 Categoría: ${tags[tagSeleccionada]} 💮`
      : `⚡ ${totalcmd} comandos • 🍀 ${totalreg} usuarios`

    // Botón principal: si hay una sola categoría, su sección; si es menú general, todas
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: 'SAITAMA BOT',
        subtitle: subtitleText,
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text: bodyText
      },
      footer: {
        text: '🌸 SAITAMA BOT 🍀 ⚡ v1.0'
      },
      nativeFlowMessage: {
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🚀 VER MENÚ COMPLETO',
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

// Responder cuando el usuario selecciona un comando del menú
handler.before = async (m, { conn, usedPrefix }) => {
  if (m.isBaileys) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId || null
  } catch { return false }

  if (!id || !id.startsWith('menu_cmd~')) return false

  const parts = id.split('~')
  // parts[0] = 'menu_cmd', parts[1] = tag, parts[2] = cmd
  const tag = parts[1] || ''
  const cmd = parts[2] || ''

  await conn.sendMessage(m.chat, {
    text: `╭━━━━━━━━━━━━━━━⬣\n🌸 ${tags[tag] || '📌'} • *${cmd}*\n⬣━━━━━━━━━━━━━━━╯\n\n⚡ Usa *${cmd}* para ejecutar este comando.\n💮 ¡Buena suerte! 🍀`
  }, { quoted: m })

  return true
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|menú|help)(rpg|group|diversion|game|gacha|serbot|owner|downloader|info|main|tools|anime)?$/i
handler.register = false
handler.desc = 'Muestra el menú'

export default handler
