let handler = async (m, { conn }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '👥 「 HINATA GROUP 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Este comando es solo para grupos\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  
  try {
    let metadata = await conn.groupMetadata(m.chat)
    let pp = await conn.profilePictureUrl(m.chat, 'image').catch(() => 'https://files.catbox.moe/qyjtab.jpeg')
    
    let texto = '👥 「 HINATA INFO GROUP 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
    texto += '📛 » *Nombre:* ' + metadata.subject + '\n'
    texto += '🆔 » *ID:* ' + metadata.id + '\n'
    texto += '👑 » *Creador:* ' + (metadata.owner ? '@' + metadata.owner.split('@')[0] : 'Desconocido') + '\n'
    texto += '📅 » *Creado:* ' + new Date(metadata.creation * 1000).toLocaleString() + '\n'
    texto += '📝 » *Descripción:* ' + (metadata.desc || 'Sin descripción') + '\n'
    texto += '👥 » *Miembros:* ' + metadata.participants.length + '\n'
    texto += '🛡️ » *Administradores:* ' + metadata.participants.filter(p => p.admin).length + '\n'
    texto += '🔒 » *Solo admins editan:* ' + (metadata.restrict ? 'Sí' : 'No') + '\n'
    texto += '🔇 » *Solo admins hablan:* ' + (metadata.announce ? 'Sí' : 'No') + '\n\n'
    texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'
    
    await conn.sendMessage(m.chat, {
      image: { url: pp },
      caption: texto,
      mentions: metadata.owner ? [metadata.owner] : []
    }, { quoted: m })
    
  } catch (e) {
    await conn.sendMessage(m.chat, { text: '👥 「 HINATA GROUP 」 👥\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n❥ Error al obtener la información\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔' }, { quoted: m })
  }
}

handler.help = ['infogrupo']
handler.tags = ['group']
handler.command = /^(infogrupo|groupinfo|gcinfo|grupoinfo)$/i
handler.desc = 'Información del grupo'
handler.group = true

export default handler