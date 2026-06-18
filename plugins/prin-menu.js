import fs from 'fs'
import path, { join } from 'path'
import fetch from 'node-fetch'
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   ESTÉTICA EMO/DARK MENU SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const defaultMenu = {
  before: `
✦ ────────────────────── ✦
  　　𝕾𝖆𝖎𝖙𝖆𝖒𝖆 𝕭𝖔𝖙
✦ ────────────────────── ✦

　🖤 *𝘕𝘢𝘥𝘪𝘦 𝘱𝘶𝘦𝘥𝘦 𝘤𝘰𝘯𝘵𝘪𝘨𝘰...*
　　　　　　　*𝘯𝘪 𝘵ú.*

╔══════════════════════╗
║  👤  @%user
║  👥  Usuarios  ›  %totalreg
║  📦  Comandos  ›  %totalcmd
║  ⏱️  Uptime    ›  %uptime
╚══════════════════════╝

%readmore`,

  header: `
┌─────────────────────┐
  %category  ·  %count cmds
└─────────────────────┘`,

  body: `
  ▸ %cmd`,

  desc: `
    ↳ *%desc*`,

  sectionEnd: `
  ─ · ─ · ─ · ─ · ─ · ─`,

  footer: '',

  after: `

✦ ────────────────────── ✦
　　　*𝕾𝔸𝕀𝕿𝔸𝕄𝔸-𝔹𝕆𝕋*
✦ ────────────────────── ✦
　　𝘙𝘦𝘱𝘰𝘳𝘵𝘢 𝘦𝘳𝘳𝘰𝘳𝘦𝘴 𝘢𝘭 𝘥𝘦𝘷
`
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

    let bannerFinal = tagSeleccionada ? bannerCategory[tagSeleccionada] : bannerCategory.main

    let textoMenu = defaultMenu.before
      .replace(/%totalreg/g, Object.keys(global.db.data.users).length)
      .replace(/%totalcmd/g, Object.keys(global.plugins).length)
      .replace(/%uptime/g, Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's')
      .replace(/%user/g, who.split('@')[0])

    if (tagSeleccionada) {
      textoMenu = textoMenu.replace('𝕾𝖆𝖎𝖙𝖆𝖒𝖆 𝕭𝖔𝖙', '𝕾𝖆𝖎𝖙𝖆𝖒𝖆 𝕭𝖔𝖙  ·  ' + tags[tagSeleccionada])
    }

    for (let tag of Object.keys(tags)) {
      if (tagSeleccionada && tag !== tagSeleccionada) continue

      const cmdsFiltrados = help.filter(menu => menu.tags?.includes(tag))

      const cmds = cmdsFiltrados
        .map(menu => menu.help.map(h =>
          defaultMenu.body.replace(/%cmd/g, menu.prefix ? h : `${_p}${h}`) +
          (menu.desc ? defaultMenu.desc.replace(/%desc/g, menu.desc) : '')
        ).join('')).join('')

      if (cmds) {
        let count = cmdsFiltrados.length
        textoMenu += defaultMenu.header
          .replace(/%category/g, tags[tag])
          .replace(/%count/g, count)
        textoMenu += cmds
        textoMenu += defaultMenu.sectionEnd
      }
    }

    textoMenu += defaultMenu.after

    const replace = { readmore: readMore }
    let texto = textoMenu
    for (let key of Object.keys(replace)) {
      texto = texto.replace(new RegExp(`%${key}`, 'g'), replace[key])
    }

    await conn.sendMessage(m.chat, {
      image: { url: bannerFinal },
      caption: texto.trim(),
      mentions: [who]
    }, { quoted: m })

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: `❌ Error:\n${e}` }, { quoted: m })
  }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|menú|help)(rpg|group|diversion|game|gacha|serbot|owner|downloader|info|main|tools)?$/i
handler.register = false
handler.desc = 'Muestra el menú'

export default handler

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)