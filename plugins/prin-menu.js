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

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)

let handler = async (m, { conn, usedPrefix: _p, command }) => {
  try {
    const who = m.sender
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

    // Detectar categoría
    let tagSeleccionada = null
    if (command.startsWith('menu') && command.length > 4) {
      const tagBuscada = command.replace('menu', '').toLowerCase()
      for (const key of Object.keys(tags)) {
        if (key.toLowerCase() === tagBuscada) {
          tagSeleccionada = key
          break
        }
      }
    }

    const totalUsers = Object.keys(global.db.data.users).length
    const totalCmds = Object.keys(global.plugins).length
    const uptime = Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's'
    const userNum = who.split('@')[0]

    // ── MENÚ DE CATEGORÍA ESPECÍFICA ──
    if (tagSeleccionada) {
      const cmdsFiltrados = help.filter(p => p.tags?.includes(tagSeleccionada))

      let texto = `╭━━⬣
│  ${tags[tagSeleccionada]} — SAITAMA BOT
╰━━━━━━━━━━━━━━━━━━━━━━⬣
│
│  👤 Usuario: @${userNum}
│  📦 Comandos: ${cmdsFiltrados.length}
│
╭━━━━━━━━━━━━━━━━━━━━━━⬣
│  COMANDOS
╰━━━━━━━━━━━━━━━━━━━━━━⬣\n`

      for (const p of cmdsFiltrados) {
        for (const h of p.help) {
          texto += `│ ➳ ${p.prefix ? h : `${_p}${h}`}\n`
          if (p.desc) texto += `│    ↳ _${p.desc}_\n`
        }
      }

      texto += `╭━━━━━━━━━━━━━━━━━━━━━━⬣
│  ⚡ SAITAMA BOT
╰━━⬣`

      return await conn.sendMessage(m.chat, {
        image: { url: bannerCategory[tagSeleccionada] },
        caption: texto.trim(),
        mentions: [who]
      }, { quoted: m })
    }

    // ── MENÚ PRINCIPAL CON BOTONES ──
    const totalUsers2 = Object.keys(global.db.data.users).length
    const caption = `╭━━⬣
│  ✦ *SAITAMA BOT* ✦
╰━━━━━━━━━━━━━━━━━━━━━━⬣
│
│  👥 Usuarios: ${totalUsers2}
│  📦 Comandos: ${totalCmds}
│  ⏱️ Uptime: ${uptime}
│  👤 Usuario: @${userNum}
│
╭━━━━━━━━━━━━━━━━━━━━━━⬣
│  ⚡ SAITAMA BOT
╰━━⬣`

    // Máximo 3 botones por mensaje en Baileys
    // Dividimos las categorías en grupos de 3
    const categoryEntries = Object.entries(tags).filter(([key]) => {
      return help.filter(p => p.tags?.includes(key)).length > 0
    })

    const chunks = []
    for (let i = 0; i < categoryEntries.length; i += 3) {
      chunks.push(categoryEntries.slice(i, i + 3))
    }

    // Primer mensaje: imagen + caption
    await conn.sendMessage(m.chat, {
      image: { url: bannerCategory.main },
      caption,
      mentions: [who]
    }, { quoted: m })

    // Mensajes con botones (grupos de 3)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const buttons = chunk.map(([key, label]) => {
        const count = help.filter(p => p.tags?.includes(key)).length
        return {
          buttonId: `${_p}menu${key}`,
          buttonText: {
            displayText: `${label} (${count})`
          },
          type: 1
        }
      })

      await conn.sendMessage(m.chat, {
        text: i === 0
          ? '📂 *Selecciona una categoría:*'
          : '📂 *Más categorías:*',
        footer: '⚡ SAITAMA BOT',
        buttons,
        headerType: 1
      }, { quoted: m })
    }

  } catch (e) {
    console.error('[MENU ERROR]', e)
    await conn.sendMessage(m.chat, { text: `❌ Error en menú:\n${e.message}` }, { quoted: m })
  }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|menú|help)(rpg|group|diversion|game|gacha|serbot|owner|downloader|info|main|tools|anime)?$/i
handler.register = false
handler.desc = 'Muestra el menú principal'

export default handler

const more2 = String.fromCharCode(8206)