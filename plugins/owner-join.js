let linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})( [0-9]{1,3})?/i

let handler = async (m, { conn, text }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, {
      text: '🔗 「 HINATA JOIN 」 🔗\n\n💫 » Solo los creadores bb'
    }, { quoted: m })
  }

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: '🔗 「 HINATA JOIN 」 🔗\n\n💫 » Ingresa el enlace del Grupo bb\n\n> #join https://chat.whatsapp.com/XXXXX'
    }, { quoted: m })
  }

  try {
    let [_, code] = text.match(linkRegex) || []
    if (!code) {
      return conn.sendMessage(m.chat, {
        text: '🔗 「 HINATA JOIN 」 🔗\n\n🐢 » Enlace inválido bb'
      }, { quoted: m })
    }
    await conn.groupAcceptInvite(code)
    await conn.sendMessage(m.chat, {
      text: '🔗 「 HINATA JOIN 」 🔗\n\n🍭 » La bot se unió correctamente al Grupo bb'
    }, { quoted: m })
  } catch {
    await conn.sendMessage(m.chat, {
      text: '🔗 「 HINATA JOIN 」 🔗\n\n✘ » Ocurrió un error bb'
    }, { quoted: m })
  }
}

handler.help = ['join']
handler.tags = ['owner']
handler.command = /^(join|entrar)$/i
handler.desc = 'Une la bot a un grupo bb'
handler.rowner = true

export default handler