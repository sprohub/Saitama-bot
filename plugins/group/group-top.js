const handler = async (m, { conn, args, participants }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Este comando solo funciona en grupos.\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  if (!args[0]) {
    return conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Usa: *.top <categoría>*\n` +
        `│\n` +
        `│ Ejemplos:\n` +
        `│ • .top therians\n` +
        `│ • .top gamers\n` +
        `│ • .top otakus\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  }

  const categoria = args.join(' ')
  const mencionados = [...participants].sort(() => Math.random() - 0.5).slice(0, 5)
  const mentions = mencionados.map(p => p.id)

  const medallas = ['🥇', '🥈', '🥉', '🏅', '🏅']

  let texto =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🏆 TOP ${categoria.toUpperCase()}\n` +
    `╰───────────────⬣\n\n`

  mencionados.forEach((p, i) => {
    texto += `${medallas[i] || '🍃'} » @${p.id.split('@')[0]}\n`
  })

  texto += `\n╭───────────────⬣\n│ 🍃 Top 5 aleatorio: ${categoria}\n╰───────────────⬣`

  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
}

handler.help = ['top <categoría>']
handler.tags = ['group']
handler.command = /^(top)$/i
handler.desc = 'Muestra un top 5 aleatorio del grupo por categoría'
handler.group = true

export default handler