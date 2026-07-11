let handler = async (m, { conn, isAdmin, participants }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA TAGALL 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '👥 「 HINATA TAGALL 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo administradores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let texto = '👥 「 HINATA TAGALL 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  for (let p of participants) {
    texto += '❥ » @' + p.id.split('@')[0] + '\n'
  }
  texto += '\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  await conn.sendMessage(m.chat, { text: texto, mentions: participants.map(p => p.id) }, { quoted: m })
}

handler.help = ['tagall']
handler.tags = ['group']
handler.command = /^(tagall|todos|all)$/i
handler.desc = 'Menciona a todos'
handler.admin = true

export default handler