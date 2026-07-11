let handler = async (m, { conn, text }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '𖣔 」 ˚ʚ♡ɞ˚\n\n💫 » Solo para grupos' }, { quoted: m })

  let target
  let mensaje

  if (m.mentionedJid && m.mentionedJid[0]) {
    target = m.mentionedJid[0]
    mensaje = text.replace(/@\d+/g, '').trim()
  } else if (m.quoted) {
    target = m.quoted.sender
    mensaje = m.quoted.text || m.quoted.caption || ''
  } else if (text) {
    mensaje = text
    target = null
  } else {
    return conn.sendMessage(m.chat, { 
      text: '𖣔 」 ˚ʚ♡ɞ˚\n\n💫 » Escribe un mensaje o responde a alguien\n\n> #tag hola\n> #tag @usuario mensaje' 
    }, { quoted: m })
  }

  let texto = ''

  if (target && mensaje) {
    texto += '📢 @' + target.split('@')[0] + ' ' + mensaje
  } else if (target && !mensaje) {
    texto += '📢 @' + target.split('@')[0] + ' te están llamando'
  } else if (!target && mensaje) {
    texto += mensaje
  }

  let mentions = target ? [target] : []

  await conn.sendMessage(m.chat, { text: texto, mentions }, { quoted: m })
}

handler.help = ['tag']
handler.tags = ['group']
handler.command = /^(tag)$/i
handler.desc = 'Envía mensaje'
handler.group = true

export default handler