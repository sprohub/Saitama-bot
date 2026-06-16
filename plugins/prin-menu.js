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

    // Detectar categoría en el comando (ej: .menutools)
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

    // ── MENÚ PRINCIPAL CON LISTA INTERACTIVA ──
    const captionPrincipal = `╭━━⬣
│  ✦ *SAITAMA BOT* ✦
╰━━━━━━━━━━━━━━━━━━━━━━⬣
│
│  👥 Usuarios: ${totalUsers}
│  📦 Comandos: ${totalCmds}
│  ⏱️ Uptime: ${uptime}
│  👤 Usuario: @${userNum}
│
╭━━━━━━━━━━━━━━━━━━━━━━⬣
│  ⚡ SAITAMA BOT
╰━━⬣`

    // Construir secciones de la lista
    const sections = [{
      title: '📂 CATEGORÍAS',
      rows: Object.entries(tags).map(([key, label]) => {
        const count = help.filter(p => p.tags?.includes(key)).length
        return {
          title: label,
          description: `${count} comando${count !== 1 ? 's' : ''} — Usa ${_p}menu${key}`,
          id: `menu_${key}`
        }
      }).filter(r => {
        // Ocultar categorías vacías
        const key = r.id.replace('menu_', '')
        return help.filter(p => p.tags?.includes(key)).length > 0
      })
    }]

    await conn.sendMessage(m.chat, {
      image: { url: bannerCategory.main },
      caption: captionPrincipal,
      mentions: [who]
    }, { quoted: m })

    // Enviar lista interactiva
    await conn.sendMessage(m.chat, {
      text: `${readMore}Selecciona una categoría para ver sus comandos:`,
      footer: '⚡ SAITAMA BOT',
      title: '✦ MENÚ PRINCIPAL ✦',
      buttonText: '📂 Ver Categorías',
      sections
    }, { quoted: m })

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