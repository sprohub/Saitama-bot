import fs from 'fs'
import path, { join } from 'path'
import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'
import { xpRange } from '../../lib/levelling.js'

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

const cmdIcon = '🍃'

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
      rows: rows.slice(0, 10)
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

    let media = null
    try {
      media = await prepareWAMessageMedia(
        { image: { url: bannerUrl } },
        { upload: conn.waUploadToServer }
      )
    } catch {}

    const sections = buildSections(help, _p, tagSeleccionada)

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

// 🔎 Detecta si el sender usa @lid o @s.whatsapp.net, igual que handler.js
function detectSuffix(jid) {
  return jid.includes('@lid') ? '@lid' : '@s.whatsapp.net'
}

async function getLidFromJid(id, conn) {
  if (id.endsWith('@lid')) return id
  const res = await conn.onWhatsApp(id).catch(() => [])
  return res[0]?.lid || id
}

// 🚀 Ejecuta el plugin directamente, sin depender de re-enviar el texto
// (evita el filtro de IDs tipo BAE5/NJX/B24E que descarta el eco del bot)
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id || !id.startsWith('menu_cmd~')) return false

  const parts = id.split('~')
  const cmdFinal = parts[2] || ''
  if (!cmdFinal) return false

  // Determinamos el prefijo usado y separamos comando/args
  const prefixMatch = cmdFinal.match(global.prefix) || cmdFinal.match(/^[.\/#@]/)
  const usedPrefix = prefixMatch ? prefixMatch[0] : ''
  const noPrefix = cmdFinal.replace(usedPrefix, '').trim()
  const [command, ...args] = noPrefix.split(' ').filter(Boolean)
  const text = args.join(' ')
  const cmdLower = (command || '').toLowerCase()

  // Buscamos el plugin cuyo .command coincida (misma lógica que handler.js)
  let matchedName = null
  let plugin = null
  for (const name in global.plugins) {
    const p = global.plugins[name]
    if (!p || p.disabled) continue
    const isAccept = p.command instanceof RegExp
      ? p.command.test(cmdLower)
      : Array.isArray(p.command)
        ? p.command.some(c => c instanceof RegExp ? c.test(cmdLower) : c === cmdLower)
        : typeof p.command === 'string'
          ? p.command === cmdLower
          : false
    if (isAccept) {
      matchedName = name
      plugin = p
      break
    }
  }

  if (!plugin) {
    console.log('[menu] no se encontró plugin para:', cmdLower)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA BOT*\n│ 🍃 No se encontró el comando *${cmdLower}*.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  // Recreamos el mismo contexto de permisos que arma handler.js
  const detectwhat = detectSuffix(m.sender)
  const isROwner = [...global.owner.map(([number]) => number)]
    .map(v => v.replace(/[^0-9]/g, '') + detectwhat)
    .includes(m.sender)
  const isOwner = isROwner || m.fromMe
  const isMods = isROwner || global.mods.map(v => v.replace(/[^0-9]/g, '') + detectwhat).includes(m.sender)
  const _user = global.db.data.users[m.sender] || {}
  const isPrems = isROwner || global.prems.map(v => v.replace(/[^0-9]/g, '') + detectwhat).includes(m.sender) || _user.premium == true

  const senderLid = await getLidFromJid(m.sender, conn)
  const botLid = await getLidFromJid(conn.user.jid, conn)
  const groupMetadata = m.isGroup ? (await conn.groupMetadata(m.chat).catch(() => null)) : {}
  const participants = m.isGroup ? (groupMetadata?.participants || []) : []
  const userP = participants.find(p => p.id === senderLid || p.id === m.sender) || {}
  const botP = participants.find(p => p.id === botLid || p.id === conn.user.jid) || {}
  const isRAdmin = userP?.admin === 'superadmin'
  const isAdmin = isRAdmin || userP?.admin === 'admin'
  const isBotAdmin = !!botP?.admin

  const fail = plugin.fail || global.dfail

  // Verificamos permisos, igual que handler.js
  if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) return fail('owner', m, conn, usedPrefix, cmdLower), true
  if (plugin.rowner && !isROwner) return fail('rowner', m, conn, usedPrefix, cmdLower), true
  if (plugin.owner && !isOwner) return fail('owner', m, conn, usedPrefix, cmdLower), true
  if (plugin.mods && !isMods) return fail('mods', m, conn, usedPrefix, cmdLower), true
  if (plugin.premium && !isPrems) return fail('premium', m, conn, usedPrefix, cmdLower), true
  if (plugin.group && !m.isGroup) return fail('group', m, conn, usedPrefix, cmdLower), true
  if (plugin.botAdmin && !isBotAdmin) return fail('botAdmin', m, conn, usedPrefix, cmdLower), true
  if (plugin.admin && !isAdmin) return fail('admin', m, conn, usedPrefix, cmdLower), true
  if (plugin.private && m.isGroup) return fail('private', m, conn, usedPrefix, cmdLower), true
  if (plugin.register == true && _user.registered == false) return fail('unreg', m, conn, usedPrefix, cmdLower), true

  const extra = {
    usedPrefix,
    noPrefix,
    _args: args,
    args,
    command: cmdLower,
    text,
    conn,
    participants,
    groupMetadata,
    user: userP,
    bot: botP,
    isROwner,
    isOwner,
    isRAdmin,
    isAdmin,
    isBotAdmin,
    isPrems
  }

  try {
    await plugin.call(conn, m, extra)
  } catch (e) {
    console.log('[menu] error ejecutando comando seleccionado:', e)
    await conn.sendMessage(m.chat, { text: `❌ Error al ejecutar *${cmdLower}*.` }, { quoted: m })
  }

  return true
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|menú|help)(rpg|group|diversion|game|gacha|serbot|owner|downloader|info|main|tools|anime)?$/i
handler.register = false
handler.desc = 'Muestra el menú'

export default handler