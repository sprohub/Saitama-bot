let handler = async (m, { conn, args, participants }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA TOP 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  if (!args[0]) {
    return conn.sendMessage(m.chat, {
      text: '👥 「 HINATA TOP 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n📋 » Usa: #top <categoría>\n\n> #top therians\n> #top gamers\n> #top otakus\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    }, { quoted: m })
  }

  let categoria = args.join(' ')
  let mencionados = participants.sort(() => Math.random() - 0.5).slice(0, 5)
  let mentions = mencionados.map(p => p.id)

  let texto = '👥 「 TOP ' + categoria.toUpperCase() + ' 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  for (let i = 0; i < mencionados.length; i++) {
    texto += '🏅 » @' + mencionados[i].id.split('@')[0] + '\n'
  }
  texto += '\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n> Top 5 ' + categoria

  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
}

handler.help = ['top']
handler.tags = ['group']
handler.command = /^(top)$/i
handler.desc = 'Top 5 random del grupo'
handler.group = true

export default handler