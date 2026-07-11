import ws from 'ws'

let handler = async (m, { conn }) => {
  let uniqueUsers = new Map()

  if (!global.conns || !Array.isArray(global.conns)) global.conns = []

  const now = Date.now()

  for (const connSub of global.conns) {
    if (connSub.user && connSub.ws?.readyState !== ws.CLOSED) {
      const jid = connSub.user.jid
      const numero = jid?.split('@')[0]

      let nombre = connSub.user.name
      if (!nombre && typeof conn.getName === 'function') {
        try {
          nombre = await conn.getName(jid)
        } catch {
          nombre = `Usuario ${numero}`
        }
      }

      const connectedAt = connSub.connectedAt || now
      const uptimeSub = clockString(now - connectedAt)

      uniqueUsers.set(jid, {
        nombre: nombre || `Usuario ${numero}`,
        uptime: uptimeSub,
        numero
      })
    }
  }

  const uptimeTotal = clockString(process.uptime() * 1000)
  const totalUsers = uniqueUsers.size

  let txt = `╭━━━〔 🌸 SUBBOTS HINATA 🌸 〕━━⬣\n`
  txt += `┃ 🤖 Bot activo: ${uptimeTotal}\n`
  txt += `┃ 👥 Subbots conectados: ${totalUsers}\n`
  txt += `╰━━━━━━━━━━━━━━━━⬣\n`

  if (totalUsers > 0) {
    txt += `\n📋 LISTA DE SUBBOTS ACTIVOS\n\n`

    let i = 1
    for (const [jid, { nombre, uptime, numero }] of uniqueUsers) {
      txt += `┌─⊷ ${i++}\n`
      txt += `│ 🌸 Nombre: ${nombre}\n`
      txt += `│ ⏱️ Tiempo activo: ${uptime}\n`
      txt += `│ 👑 wa.me/${numero}\n`
      txt += `└──────────────⊷\n\n`
    }
  } else {
    txt += `\n❌ No hay subbots conectados actualmente.`
  }

  await conn.reply(m.chat, txt.trim(), m)
}

handler.command = ['listjadibot', 'bots']
handler.help = ['bots']
handler.tags = ['serbot']
handler.register = false

export default handler

function clockString(ms) {
  const d = Math.floor(ms / 86400000)
  const h = Math.floor(ms / 3600000) % 24
  const m = Math.floor(ms / 60000) % 60
  const s = Math.floor(ms / 1000) % 60

  return `${d}d ${h}h ${m}m ${s}s`
}