import fs from 'fs'
import path, { join } from 'path'
import fetch from 'node-fetch'
import { xpRange } from '../lib/levelling.js'

const tags = {
  main: '⭐ principal➣',
  group: '👥 grupos➣',
  tools: '🛠️ tools➣',
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

    // Detectar tag específica desde el comando (ej: .menurpg)
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

    const totalUsers = Object.keys(global.db.data.users).length
    const totalCmds = Object.keys(global.plugins).length
    const uptime = Math.floor(process.uptime() / 60) + 'm ' + Math.floor(process.uptime() % 60) + 's'
    const userName = who.split('@')[0]

    // ── Texto del cuerpo del mensaje ──
    const bodyText = `╭━━⬣ *SAITAMA-BOT* ⬣━━╮

〖 ${totalUsers} ᴜꜱᴇʀꜱ 〗 ${totalCmds} ᴄᴍᴅꜱ ➣

> ⏱️ ${uptime} activa
> 👤 Solicitado por @${userName}

╰━━━━━━━━━━━━━━━━━━━━━━⬣`

    // ── Construir secciones para el list ──
    // Si hay tag seleccionada → solo esa sección
    // Si no → una sección por cada categoría
    let listSections = []

    if (tagSeleccionada) {
      // Menú de categoría específica
      const cmdsFiltrados = help.filter(menu => menu.tags?.includes(tagSeleccionada))
      const rows = cmdsFiltrados.flatMap(menu =>
        menu.help.map(h => ({
          title: menu.prefix ? h : `${_p}${h}`,
          description: menu.desc || '',
          rowId: menu.prefix ? h : `${_p}${h}`
        }))
      )
      if (rows.length > 0) {
        listSections.push({ title: tags[tagSeleccionada], rows })
      }
    } else {
      // Menú general → una sección por categoría
      for (let tag of Object.keys(tags)) {
        const cmdsFiltrados = help.filter(menu => menu.tags?.includes(tag))
        const rows = cmdsFiltrados.flatMap(menu =>
          menu.help.map(h => ({
            title: menu.prefix ? h : `${_p}${h}`,
            description: menu.desc || '',
            rowId: menu.prefix ? h : `${_p}${h}`
          }))
        )
        if (rows.length > 0) {
          listSections.push({ title: tags[tag], rows })
        }
      }
    }

    const title = tagSeleccionada
      ? `SAITAMA ➣ ${tags[tagSeleccionada].replace(/[⭐👥⚔️🎮🎰🤖👑📥ℹ️🎪🌸🛠️]/g, '').trim()}`
      : '✦ SAITAMA-BOT ✦'

    const footer = 'samu★ ➣ SAITAMA-BOT'
    const buttonText = '📋 Ver Menú'

    // Usar sendListB que está en simple.js (imagen + botón lista)
    await conn.sendListB(
      m.chat,
      title,
      bodyText,
      buttonText,
      bannerFinal,
      listSections,
      m,
      { mentions: [who] }
    )

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: `❌ Error en menú:\n${e}` }, { quoted: m })
  }
}

handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|menú|help)(rpg|group|diversion|game|gacha|serbot|owner|downloader|info|main|tools|anime)?$/i
handler.register = false
handler.desc = 'Muestra el menú'

export default handler
