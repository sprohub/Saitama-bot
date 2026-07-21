import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 👉 Gifs del menú, se elige uno al azar en cada ejecución
const menuGifPaths = [
  path.join(__dirname, '..', '..', 'lib', 'menu2.mp4'),
  path.join(__dirname, '..', '..', 'lib', 'menu2(1).mp4')
]

function getRandomGifPath() {
  return menuGifPaths[Math.floor(Math.random() * menuGifPaths.length)]
}

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

const cmdIcon = '🍃'
// ⚠️ WhatsApp limita a 10 FILAS TOTALES por mensaje interactivo (no 10 por
// sección). Por eso paginamos: 9 comandos/categorías reales + 1 fila de
// "más" cuando hace falta, en vez de repartir en varias secciones de 10.
const PAGE_SIZE = 9

// Divide un array en páginas de máximo `tamano` elementos
function paginar(arr, tamano) {
  const resultado = []
  for (let i = 0; i < arr.length; i += tamano) {
    resultado.push(arr.slice(i, i + tamano))
  }
  return resultado
}

function getHelp() {
  return Object.values(global.plugins)
    .filter(p => !p.disabled)
    .map(p => ({
      help: Array.isArray(p.help) ? p.help : [p.help],
      tags: Array.isArray(p.tags) ? p.tags : [p.tags],
      prefix: 'customPrefix' in p,
      desc: p.desc || ''
    }))
}

const CANAL_URL = 'https://whatsapp.com/channel/0029VbDIRNeEQIalr0dmwQ05'

function buildBodyText({ totalreg, totalcmd, uptime, user, tagSeleccionada }) {
  let titulo = tagSeleccionada
    ? tags[tagSeleccionada].split(' ').slice(1).join(' ')
    : 'MENÚ PRINCIPAL'

  return (
    `╭─⪼ 🌿 *${titulo}*\n` +
    `│ 👤 @${user}\n` +
    `│ 📦 ${totalcmd} cmds · 🐒 ${totalreg} users · ⏱️ ${uptime}\n` +
    `│ 📢 Canal: ${CANAL_URL}\n` +
    `╰───────────────⬣`
  )
}

// 📂 Nivel 1: lista de categorías, paginada (máx. 10 filas totales por mensaje)
function buildCategorySections(help, page = 0) {
  const todasLasFilas = Object.keys(tags)
    .filter(tag => help.some(menu => menu.tags?.includes(tag)))
    .map(tag => {
      const count = help.filter(menu => menu.tags?.includes(tag)).length
      return {
        title: tags[tag],
        description: `${count} comando${count === 1 ? '' : 's'}`,
        id: `menu_cat~${tag}`
      }
    })

  if (todasLasFilas.length <= 10) {
    return [{ title: 'CATEGORÍAS', rows: todasLasFilas }]
  }

  const paginas = paginar(todasLasFilas, PAGE_SIZE)
  const rows = [...paginas[page]]
  const hayMas = page + 1 < paginas.length

  if (hayMas) {
    rows.push({
      title: '▶️ Más categorías',
      description: `Página ${page + 2} de ${paginas.length}`,
      id: `menu_catpage~${page + 1}`
    })
  }

  return [{
    title: `CATEGORÍAS · ${page + 1}/${paginas.length}`,
    rows
  }]
}

// 📜 Nivel 2: comandos de una categoría específica, paginados
function buildCommandSections(help, usedPrefix, tagSeleccionada, page = 0) {
  const cmdsFiltrados = help.filter(menu => menu.tags?.includes(tagSeleccionada))
  if (!cmdsFiltrados.length) return []

  const todasLasFilas = cmdsFiltrados.flatMap(menu =>
    menu.help.map(h => {
      const cmdFinal = menu.prefix ? h : `${usedPrefix}${h}`
      return {
        title: `${cmdIcon} ${cmdFinal}`,
        description: menu.desc ? menu.desc.slice(0, 68) : '',
        id: `menu_cmd~${tagSeleccionada}~${cmdFinal}`
      }
    })
  )

  if (todasLasFilas.length <= 10) {
    return [{ title: tags[tagSeleccionada], rows: todasLasFilas }]
  }

  const paginas = paginar(todasLasFilas, PAGE_SIZE)
  const rows = [...paginas[page]]
  const hayMas = page + 1 < paginas.length

  if (hayMas) {
    rows.push({
      title: '▶️ Más comandos',
      description: `Página ${page + 2} de ${paginas.length}`,
      id: `menu_page~${tagSeleccionada}~${page + 1}`
    })
  }

  return [{
    title: `${tags[tagSeleccionada]} · ${page + 1}/${paginas.length}`,
    rows
  }]
}

// 🧱 Construye el mensaje interactivo completo (usado tanto por el handler principal como por los botones de categoría/paginación)
async function buildMenuInteractive(m, conn, { usedPrefix, tagSeleccionada, page = 0 }) {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    user = { exp: 0, level: 0 }
    global.db.data.users[who] = user
  }

  const help = getHelp()

  const totalreg = Object.keys(global.db.data.users).length
  const totalcmd = Object.keys(global.plugins).length
  const uptime = Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's'
  const userTag = who.split('@')[0]

  let media = null
  try {
    const gifBuffer = fs.readFileSync(getRandomGifPath())
    media = await prepareWAMessageMedia(
      { video: gifBuffer, gifPlayback: true },
      { upload: conn.waUploadToServer }
    )
  } catch (e) {
    console.error('[menu] No se pudo cargar el gif del menú', e)
  }

  const sections = tagSeleccionada
    ? buildCommandSections(help, usedPrefix, tagSeleccionada, page)
    : buildCategorySections(help, page)

  if (!sections.length || sections.every(s => !s.rows.length)) return null

  const bodyText = buildBodyText({ totalreg, totalcmd, uptime, user: userTag, tagSeleccionada })

  const subtitleText = tagSeleccionada ? tags[tagSeleccionada] : `${totalcmd} cmds`

  const buttonTitle = tagSeleccionada ? 'VER COMANDOS' : 'VER CATEGORÍAS'

  return proto.Message.InteractiveMessage.create({
    header: {
      title: 'SAITAMA BOT',
      subtitle: subtitleText,
      hasMediaAttachment: !!media,
      videoMessage: media?.videoMessage
    },
    body: { text: bodyText },
    nativeFlowMessage: {
      buttons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({ title: buttonTitle, sections })
        },
        {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '📢 Canal Oficial',
            url: CANAL_URL,
            merchant_url: CANAL_URL
          })
        }
      ]
    }
  })
}

let handler = async (m, { conn, usedPrefix: _p, command }) => {
  try {
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

    const interactiveMessage = await buildMenuInteractive(m, conn, { usedPrefix: _p, tagSeleccionada })

    if (!interactiveMessage) {
      return conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA BOT*\n│ 🍃 No se encontraron comandos.\n╰───────────────⬣`
      }, { quoted: m })
    }

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
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

function detectSuffix(jid) {
  return jid.includes('@lid') ? '@lid' : '@s.whatsapp.net'
}

async function getLidFromJid(id, conn) {
  if (id.endsWith('@lid')) return id
  const res = await conn.onWhatsApp(id).catch(() => [])
  return res[0]?.lid || id
}

handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id) return false

  // 📂 Tocaron "más categorías" → mostrar la siguiente página de categorías
  if (id.startsWith('menu_catpage~')) {
    const page = parseInt(id.split('~')[1], 10) || 0
    const usedPrefix = (global.prefix instanceof RegExp ? '.' : global.prefix) || '.'
    const interactiveMessage = await buildMenuInteractive(m, conn, { usedPrefix, tagSeleccionada: null, page })

    if (!interactiveMessage) return true

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return true
  }

  // 📂 Tocaron una categoría → mostrar submenú con sus comandos
  if (id.startsWith('menu_cat~')) {
    const tag = id.split('~')[1]
    if (!tag || !tags[tag]) return false

    const usedPrefix = (global.prefix instanceof RegExp ? '.' : global.prefix) || '.'
    const interactiveMessage = await buildMenuInteractive(m, conn, { usedPrefix, tagSeleccionada: tag })

    if (!interactiveMessage) {
      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA BOT*\n│ 🍃 Esa categoría no tiene comandos.\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return true
  }

  // 📜 Tocaron "más comandos" dentro de una categoría → siguiente página
  if (id.startsWith('menu_page~')) {
    const [, tag, pageStr] = id.split('~')
    if (!tag || !tags[tag]) return false
    const page = parseInt(pageStr, 10) || 0

    const usedPrefix = (global.prefix instanceof RegExp ? '.' : global.prefix) || '.'
    const interactiveMessage = await buildMenuInteractive(m, conn, { usedPrefix, tagSeleccionada: tag, page })

    if (!interactiveMessage) return true

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return true
  }

  // ▶️ Tocaron un comando → ejecutarlo
  if (!id.startsWith('menu_cmd~')) return false

  const parts = id.split('~')
  const cmdFinal = parts[2] || ''
  if (!cmdFinal) return false

  const prefixMatch = cmdFinal.match(global.prefix) || cmdFinal.match(/^[.\/#@]/)
  const usedPrefix = prefixMatch ? prefixMatch[0] : ''
  const noPrefix = cmdFinal.replace(usedPrefix, '').trim()
  const [command, ...args] = noPrefix.split(' ').filter(Boolean)
  const text = args.join(' ')
  const cmdLower = (command || '').toLowerCase()

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
