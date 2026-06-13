import os from 'os'
import { execSync } from 'child_process'

let handler = async (m, { conn }) => {
  let totalUsers = Object.keys(global.db?.data?.users || {}).length

  let totalGroups = Object.keys(global.db?.data?.chats || {})
    .filter(id => id.endsWith('@g.us')).length

  let totalCmds = Object.keys(global.plugins || {}).length

  let uptime = process.uptime()
  let dias = Math.floor(uptime / 86400)
  let horas = Math.floor((uptime % 86400) / 3600)
  let minutos = Math.floor((uptime % 3600) / 60)

  let ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(2)

  let cpu = 'Desconocida'
  try {
    cpu = os.cpus()?.[0]?.model || 'Desconocida'
  } catch {}

  let sistema = os.platform()
  let node = process.version

  let disk = 'N/A'
  try {
    let diskInfo = execSync('df -h / | tail -1').toString().trim()
    let diskParts = diskInfo.split(/\s+/)

    if (diskParts.length >= 5) {
      disk = `${diskParts[2]} / ${diskParts[1]} (${diskParts[4]})`
    }
  } catch {}

  let texto = `🤖 「 SAITAMA BOTINFO 」 🤖

👤 » *Usuarios:* ${totalUsers}
👥 » *Grupos:* ${totalGroups}
⚡ » *Comandos:* ${totalCmds}
⏱️ » *Activa:* ${dias}d ${horas}h ${minutos}m
💾 » *RAM:* ${ram} MB
💿 » *Disco:* ${disk}
🖥️ » *CPU:* ${cpu}
💻 » *Sistema:* ${sistema}
📦 » *Node:* ${node}

⫏⫏ HINATA BOT ✿`

  await conn.sendMessage(
    m.chat,
    { text: texto },
    { quoted: m }
  )
}

handler.help = ['botinfo']
handler.tags = ['info']
handler.command = /^(botinfo|stats|estado)$/i
handler.desc = 'Estadísticas del bot'

export default handler