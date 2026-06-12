import fs from 'fs'
import path, { join } from 'path'
import fetch from 'node-fetch'
import { xpRange } from '../lib/levelling.js'

const tags = {
  main: '⭐ principal➣',
  group: '👥 grupos➣',
  rpg: '⚔️ rpg➣',
  game: '🎮 game➣',
  gacha: '🎰 gacha➣',
  diversion: '🎪 divercion➣',
  anime: '🌸 anime➣',
  serbot: '🤖 serbot➣',
  owner: '👑 owner➣',
  downloader: '📥 downloader➣',
  info: 'ℹ️ info➣'
}

const bannerCategory = {
  main: 'https://i.ibb.co/ksyfSMhm/images.jpg',
  group: 'https://i.ibb.co/R4PjYXDs/mar.jpg',
  rpg: 'https://i.ibb.co/7xW3Lfy3/paramo.jpg',
  game: 'https://i.ibb.co/ksyfSMhm/images.jpg',
  gacha: 'https://i.ibb.co/ksyfSMhm/images.jpg',
  serbot: 'https://i.ibb.co/ksyfSMhm/images.jpg',
  owner: 'https://i.ibb.co/7xW3Lfy3/paramo.jpg',
  downloader: 'https://i.ibb.co/R4PjYXDs/mar.jpg',
  info: 'https://i.ibb.co/7xW3Lfy3/paramo.jpg',
  diversion: 'https://i.ibb.co/ksyfSMhm/images.jpg',
  anime: 'https://i.ibb.co/ksyfSMhm/images.jpg'
}

const defaultMenu = {
  before: `
╔════════════════╗
THORFINN-BOT
╚════════════════╝
〖 %totalreg ᴜꜱᴇʀꜱ 〗 %totalcmd ᴄᴍᴅꜱ ➣

> ⏱️ %uptime activa
> 👤 Solicitado por @%user

%readmore
`,
  header: '\n➣ %category ➣ (%count cmd)\n',
  body: '➣ %cmd',
  desc: '\n> ↆ %desc',
  footer: '',
  after: `

╔═════════════════╗
   samu★ ➣THOFINN
╚═════════════════╝`
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

    let bannerFinal = tagSeleccionada ? bannerCategory[tagSeleccionada] : 'https://i.ibb.co/ksyfSMhm/images.jpg'

    let textoMenu = defaultMenu.before
      .replace(/%totalreg/g, Object.keys(global.db.data.users).length)
      .replace(/%totalcmd/g, Object.keys(global.plugins).length)
      .replace(/%uptime/g, Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's')
      .replace(/%user/g, who.split('@')[0])

    if (tagSeleccionada) {
      textoMenu = textoMenu.replace('saitamabot', 'saitamabot ➣ ' + tags[tagSeleccionada].replace(/[⭐👥⚔️🎮🎰🤖👑📥ℹ️]/g, '').trim())
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
