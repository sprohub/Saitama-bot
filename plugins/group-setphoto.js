let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 SAITAMA SETPHOTO 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isAdmin) return conn.sendMessage(m.chat, { text: '👥 「 SAITAMA SETPHOTO 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Solo administradores\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  if (!isBotAdmin) return conn.sendMessage(m.chat, { text: '👥 「 SAITAMA SETPHOTO 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ La bot necesita ser admin\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let q = m.quoted ? m.quoted : m
  let mime = (q.msg || q).mimetype || ''
  if (!/image/.test(mime)) return conn.sendMessage(m.chat, { text: '👥 「 SAITAMA SETPHOTO 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Responde a una imagen\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })

  let img = await q.download()
  await conn.updateProfilePicture(m.chat, img)
  await conn.sendMessage(m.chat, { text: '👥 「 SAITAMA SETPHOTO 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n✅ » Foto del grupo actualizada\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
}

handler.help = ['setphoto']
handler.tags = ['group']
handler.command = /^(setphoto|setfoto|fotogrupo)$/i
handler.desc = 'Cambia la foto del grupo'
handler.admin = true
handler.botAdmin = true

export default handler