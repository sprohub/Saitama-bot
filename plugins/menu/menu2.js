import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 👉 GIF del menú (colócalo en lib/menu2.mp4)
const menuGifPath = path.join(__dirname, '..', '..', 'lib', 'menu2.mp4')

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

function getHelp() {
  return Object.values(global.plugins)
    .filter(p => !p.disabled)
    .map(p => ({
      help: Array.isArray(p.help) ? p.help : [p.help],
      tags: Array.isArray(p.tags) ? p.tags : [p.tags],
      prefix: 'customPrefix' in p
    }))
}

// 📜 Construye el menú en texto plano, compacto y sin descripciones
// (las descripciones alargan cada línea y rompen el wrap en móvil)
function buildPlainTextMenu({ help, usedPrefix, totalreg, totalcmd, uptime, userTag }) {
  let texto =
    `🌴 *MENÚ PRINCIPAL*\n` +
    `👤 @${userTag}\n` +
    `📦 ${totalcmd} cmds · 🐒 ${totalreg} users · ⏱️ ${uptime}\n`

  for (let tag of Object.keys(tags)) {
    const cmdsFiltrados = help.filter(menu => menu.tags?.includes(tag))
    if (!cmdsFiltrados.length) continue

    const comandos = cmdsFiltrados
      .flatMap(menu => menu.help.map(h => menu.prefix ? h : `${usedPrefix}${h}`))
      .join('  ')

    texto += `\n*${tags[tag]}*\n${comandos}\n`
  }

  texto += `\n_Escribe cualquier comando directamente_`
  return texto
}

let handler = async (m, { conn, usedPrefix }) => {
  try {
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

    const texto = buildPlainTextMenu({ help, usedPrefix, totalreg, totalcmd, uptime, userTag })

    try {
      const gifBuffer = fs.readFileSync(menuGifPath)
      await conn.sendMessage(m.chat, {
        video: gifBuffer,
        gifPlayback: true,
        caption: texto,
        mentions: [who]
      }, { quoted: m })
    } catch (e) {
      console.error('[menu] No se encontró el gif en', menuGifPath, e)
      await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })
    }

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: `❌ Error:\n${e}` }, { quoted: m })
  }
}

handler.help = ['menu2']
handler.tags = ['main']
handler.command = /^(menu2)$/i
handler.register = false
handler.desc = 'Menú para iPhone'

export default handler
