import fs from 'fs'
import path, { join } from 'path'
import fetch from 'node-fetch'
import { xpRange } from '../lib/levelling.js'

const tags = {
  main: '⭐ ρяιη¢ιραℓ',
  group: '👥 ɢяυρσѕ',
  rpg: '⚔️ яρg',
  game: '🎮 gαмє',
  gacha: '🎰 gα¢нα',
  diversion: '🎪 ∂ινєяѕιση',
  anime: '🌸 αηιмє',
  serbot: '🤖 ѕєявσт',
  owner: '👑 σωηєя',
  downloader: '📥 ∂σωηℓσα∂єя',
  info: 'ℹ️ ιηƒσ'
}

const bannerCategory = {
  main: 'https://files.catbox.moe/r60c8l.jpg',
  group: 'https://files.catbox.moe/3tlaq0.png',
  rpg: 'https://files.catbox.moe/e858ul.png',
  game: 'https://i.ibb.co/r2wQ4gBD/play.png',
  gacha: 'https://files.catbox.moe/rlnc3s.png',
  serbot: 'https://files.catbox.moe/r60c8l.jpg',
  owner: 'https://files.catbox.moe/52nm0t.png',
  downloader: 'https://files.catbox.moe/ow6st7.png',
  info: 'https://files.catbox.moe/42tsa2.png',
  diversion: 'https://files.catbox.moe/2t7d69.png',
  anime: 'https://files.catbox.moe/2t7d69.png'
}

const defaultMenu = {
  before: `
࿇ ══━━━✥◈✥━━━══ ࿇
    𝕳𝖎𝖓𝖆𝖙𝖆 𝕭𝖔𝖙
࿇ ══━━━✥◈✥━━━══ ࿇
 ✦%totalreg ᴜꜱᴇʀꜱ ✦ %totalcmd ᴄᴍᴅꜱ ✦

> ⏱️ %uptime activa
> 👤 Solicitado por @%user

%readmore
`,
  header: '\n𖣔 %category ˚ʚ♡ɞ˚ (%count cmd)\n',
  body: '❧ %cmd',
  desc: '\n> ↆ %desc',
  footer: '',
  after: `

࿇ ══━━━✥◈✥━━━══ ࿇
ᵉˡ ᵛⁱᵍⁱˡᵃⁿᵗᵉ ✦ ᵇʳᵃʸᵃⁿʳᵏ
࿇ ══━━━✥◈✥━━━══ ࿇`
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

    let bannerFinal = tagSeleccionada ? bannerCategory[tagSeleccionada] : 'https://files.catbox.moe/c14iz0.png'

    let textoMenu = defaultMenu.before
      .replace(/%totalreg/g, Object.keys(global.db.data.users).length)
      .replace(/%totalcmd/g, Object.keys(global.plugins).length)
      .replace(/%uptime/g, Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's')
      .replace(/%user/g, who.split('@')[0])

    if (tagSeleccionada) {
      textoMenu = textoMenu.replace('𝕳𝖎𝖓𝖆𝖙𝖆 𝕭𝖔𝖙', '𝕳𝖎𝖓𝖆𝖙𝖆 𝕭𝖔𝖙 ✦ ' + tags[tagSeleccionada].replace(/[⭐👥⚔️🎮🎰🤖👑📥ℹ️]/g, '').trim())
    }

    for (let tag of Object.keys(tags)) {
      if (tagSeleccionada && tag !== tagSeleccionada) continue

      const cmdsFiltrados = help.filter(menu => menu.tags?.includes(tag))
      
      const cmds = cmdsFiltrados
        .map(menu => menu.help.map(h => 
          defaultMenu.body.replace(/%cmd/g, menu.prefix ? h : `${_p}${h}`) + 
          (menu.desc ? defaultMenu.desc.replace(/%desc/g, menu.desc) : '')
        ).join('\n')).join('\n')

      if (cmds) {
        let count = cmdsFiltrados.length
        textoMenu += defaultMenu.header.replace(/%category/g, tags[tag]).replace(/%count/g, count)
        textoMenu += cmds + '\n'
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
handler.command = /^(menu|menú|help)(rpg|group|diversion|game|gacha|serbot|owner|downloader|info|main)?$/i
handler.register = false
handler.desc = 'Muestra el menú'

export default handler

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)
