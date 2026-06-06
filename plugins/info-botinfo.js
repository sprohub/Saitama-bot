import os from 'os'
import { execSync } from 'child_process'

let handler = async (m, { conn }) => {
  let totalUsers = Object.keys(global.db.data.users).length
  let totalGroups = Object.keys(global.db.data.chats).filter(id => id.endsWith('@g.us')).length
  let totalCmds = Object.keys(global.plugins).length
  let uptime = process.uptime()
  let dias = Math.floor(uptime / 86400)
  let horas = Math.floor((uptime % 86400) / 3600)
  let minutos = Math.floor((uptime % 3600) / 60)
  let ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
  let cpu = os.cpus()[0].model
  let sistema = os.platform()
  let node = process.version

  let disk
  try {
    let diskInfo = execSync('df -h / | tail -1').toString()
    let diskParts = diskInfo.split(/\s+/)
    disk = diskParts[2] + ' / ' + diskParts[1] + ' (' + diskParts[4] + ')'
  } catch {
    disk = 'N/A'
  }

  let texto = '🤖 「 HINATA BOTINFO 」 🤖\n\n'
  texto += '👤 » *Usuarios:* ' + totalUsers + '\n'
  texto += '👥 » *Grupos:* ' + totalGroups + '\n'
  texto += '⚡ » *Comandos:* ' + totalCmds + '\n'
  texto += '⏱️ » *Activa:* ' + dias + 'd ' + horas + 'h ' + minutos + 'm\n'
  texto += '💾 » *RAM:* ' + ram + ' MB\n'
  texto += '💿 » *Disco:* ' + disk + '\n'
  texto += '🖥️ » *CPU:* ' + cpu + '\n'
  texto += '💻 » *Sistema:* ' + sistema + '\n'
  texto += '📦 » *Node:* ' + node + '\n\n'
  texto += '⫏⫏ HINATA BOT ✿'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['botinfo']
handler.tags = ['info']
handler.command = /^(botinfo|stats|estado)$/i
handler.desc = 'Estadísticas de la bot'

export default handler