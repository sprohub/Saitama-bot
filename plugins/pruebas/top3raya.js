let handler = async (m, { conn }) => {
  let usuarios = Object.entries(global.db.data.users)
    .filter(([jid, u]) => (u.tresRayaPuntos || 0) > 0)
    .sort((a, b) => (b[1].tresRayaPuntos || 0) - (a[1].tresRayaPuntos || 0))
    .slice(0, 10)

  if (!usuarios.length) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Todavía nadie tiene puntos de 3 en raya\n│ 🍃 Juega con .3raya @usuario o .3raya bot\n╰───────────────⬣'
    }, { quoted: m })
  }

  const medallas = ['🥇', '🥈', '🥉']

  let texto = `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🏆 TOP 3 EN RAYA\n│\n`
  let mentions = []

  for (let i = 0; i < usuarios.length; i++) {
    let [jid, u] = usuarios[i]
    let posicion = medallas[i] || `${i + 1}.`
    let nombre = '@' + jid.split('@')[0]
    let puntos = u.tresRayaPuntos || 0
    let victorias = u.tresRayaVictorias || 0

    texto += `│ ${posicion} ${nombre} — ${puntos} pts (${victorias} 🏆)\n`
    mentions.push(jid)
  }

  texto += `╰───────────────⬣`

  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
}

handler.help = ['top3raya']
handler.tags = ['game']
handler.command = /^(top3raya|ranking3raya|topgato)$/i
handler.desc = 'Muestra el ranking de puntos de 3 en raya'

export default handler