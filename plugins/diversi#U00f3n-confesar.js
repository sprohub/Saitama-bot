let handler = async (m, { conn, text }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '🤫 」 ˚ʚ♡ɞ˚\n\n💫 » Solo para grupos' }, { quoted: m })

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: '🤫 「 HINATA CONFESAR 」 🤫\n\n💫 » Envía una confesión anónima\n\n> #confesar <texto>\n> #confesar Me gusta alguien del grupo pero no me atrevo a decirle'
    }, { quoted: m })
  }

  let texto = '🤫 「 HINATA CONFESAR 」 🤫\n\n'
  texto += '💬 » Alguien confesó:\n\n'
  texto += '"' + text + '"\n\n'
  texto += '> Confesión anónima'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['confesar']
handler.tags = ['diversion']
handler.command = /^(confesar|confesion|anonimo)$/i
handler.desc = 'Envía una confesión anónima al grupo'
handler.group = true

export default handler