let handler = async (m, { conn }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, {
    text: '╭━━⬣ 「 SAITAMA LINK 」\n┃\n┃  💫 Solo funciona en grupos\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣\n         SAITAMA'
  }, { quoted: m })

  let code = await conn.groupInviteCode(m.chat)
  let link = 'https://chat.whatsapp.com/' + code

  let texto = '╭━━⬣ 「 SAITAMA LINK 」 ˚ʚ♡ɞ˚\n'
  texto += '┃\n'
  texto += '┃  🔗 Enlace del grupo\n'
  texto += '┃\n'
  texto += '┃  📋 ' + link + '\n'
  texto += '┃\n'
  texto += '╰━━⬣ / ╰━━━━━━━━━━━━━━━━━━━━━━⬣\n'
  texto += '         SAITAMA\n\n'
  texto += '> Comparte con cuidado'

  // Intentar mandar con foto del grupo
  try {
    let groupMeta = await conn.groupMetadata(m.chat)
    let ppUrl = await conn.profilePictureUrl(m.chat, 'image').catch(() => null)

    if (ppUrl) {
      await conn.sendMessage(m.chat, {
        image: { url: ppUrl },
        caption: texto
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
    }
  } catch {
    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['link']
handler.tags = ['group']
handler.command = /^(link|enlace|invite)$/i
handler.desc = 'Obtén el enlace del grupo'
handler.group = true
handler.botAdmin = true

export default handler
