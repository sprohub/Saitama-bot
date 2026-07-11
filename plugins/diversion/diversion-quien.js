let handler = async (m, { conn, text, participants }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '🎲 「 HINATA QUIÉN 」 🎲\n\n💫 » Solo para grupos' }, { quoted: m })

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: '🎲 「 HINATA QUIÉN 」 🎲\n\n💫 » La bot elige quién es...\n\n> #quien <descripción>\n> #quien es el más guapo\n> #quien es prostituta\n> #quien se comió la comida'
    }, { quoted: m })
  }

  let elegido = participants[Math.floor(Math.random() * participants.length)]
  let name = '@' + elegido.id.split('@')[0]

  let respuestas = [
    '🎲 La bot ha hablado...\n\n' + name + ' es ' + text,
    '🔮 El destino dice que...\n\n' + name + ' es ' + text,
    '🎯 Sin duda alguna...\n\n' + name + ' es ' + text,
    '💀 No hay debate...\n\n' + name + ' es ' + text,
    '👑 Por unanimidad...\n\n' + name + ' es ' + text,
    '📊 Las estadísticas confirman...\n\n' + name + ' es ' + text
  ]

  let texto = '🎲 「 HINATA QUIÉN 」 🎲\n\n' + respuestas[Math.floor(Math.random() * respuestas.length)]

  await conn.sendMessage(m.chat, { text: texto, mentions: [elegido.id] }, { quoted: m })
}

handler.help = ['quien']
handler.tags = ['diversion']
handler.command = /^(quien|quién)$/i
handler.desc = 'La bot elige quién es...'
handler.group = true

export default handler