const OWNERS = ['573225396540', '573225814649']

let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  const sender = m.sender.split('@')[0]

  if (!OWNERS.includes(sender)) {
    return conn.sendMessage(m.chat, {
      text: '╭━━⬣ *SAITAMA SETPHOTO* ⬣━━╮\n\n❥ No tienes permiso para usar este comando\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  if (!m.isGroup) {
    return conn.sendMessage(m.chat, {
      text: '╭━━⬣ *SAITAMA SETPHOTO* ⬣━━╮\n\n❥ Solo para grupos\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  if (!isAdmin) {
    return conn.sendMessage(m.chat, {
      text: '╭━━⬣ *SAITAMA SETPHOTO* ⬣━━╮\n\n❥ Solo administradores\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  if (!isBotAdmin) {
    return conn.sendMessage(m.chat, {
      text: '╭━━⬣ *SAITAMA SETPHOTO* ⬣━━╮\n\n❥ La bot necesita ser admin\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  let q = m.quoted ? m.quoted : m
  let mime = (q.msg || q).mimetype || ''
  if (!/image/.test(mime)) {
    return conn.sendMessage(m.chat, {
      text: '╭━━⬣ *SAITAMA SETPHOTO* ⬣━━╮\n\n❥ Responde a una imagen\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  let img = await q.download()
  await conn.updateProfilePicture(m.chat, img)
  await conn.sendMessage(m.chat, {
    text: '╭━━⬣ *SAITAMA SETPHOTO* ⬣━━╮\n\n✅ » Foto del grupo actualizada\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
  }, { quoted: m })
}

handler.help = ['setphoto']
handler.tags = ['group']
handler.command = /^(setphoto|setfoto|fotogrupo)$/i
handler.admin = true
handler.botAdmin = true
handler.desc = 'Cambia la foto del grupo'

export default handler