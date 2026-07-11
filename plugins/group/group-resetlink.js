let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '❀ HINATA RESETLINK ❀\n\nSolo para grupos' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '❀ HINATA RESETLINK ❀\n\nSolo administradores' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '❀ HINATA RESETLINK ❀\n\nLa bot necesita ser admin' }, { quoted: m })

  await conn.sendMessage(m.chat, { text: '⏳ Reseteando link...' }, { quoted: m })

  try {
    let pp
    try { pp = await conn.profilePictureUrl(m.chat, 'image') } catch { pp = 'https://files.catbox.moe/5tegkb.png' }

    await conn.groupRevokeInvite(m.chat)
    let code = await conn.groupInviteCode(m.chat)
    let link = 'https://chat.whatsapp.com/' + code

    await conn.sendMessage(m.chat, {
      image: { url: pp },
      caption: '❀ HINATA RESETLINK ❀\n\nLink reseteado correctamente\n\n' + link
    }, { quoted: m })

  } catch (e) {
    await conn.sendMessage(m.chat, { text: '❀ HINATA RESETLINK ❀\n\nNo se pudo resetear el link' }, { quoted: m })
  }
}

handler.help = ['resetlink']
handler.tags = ['group']
handler.command = /^(resetlink|revoke|nuevolink)$/i
handler.desc = 'Resetea el link del grupo'
handler.admin = true
handler.botAdmin = true

export default handler