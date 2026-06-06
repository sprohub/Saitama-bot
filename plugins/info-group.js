let handler = async (m, { conn }) => {
  let texto = '❀ HINATA INFO GROUP ❀\n\n'
  texto += 'Comandos para administrar tu grupo con Hinata.\n\n'
  texto += 'COMANDOS:\n\n'
  texto += '❀ antilink - Activa/desactiva eliminación de enlaces\n'
  texto += '❀ close/ open - Cierra/abre el grupo\n'
  texto += '❀ delete - Borra mensajes\n'
  texto += '❀ demote - Quita admin\n'
  texto += '❀ infogrupo - Información del grupo\n'
  texto += '❀ kick - Expulsa miembros (protege al creador)\n'
  texto += '❀ promote - Da admin\n'
  texto += '❀ resetlink - Resetea link de invitación\n'
  texto += '❀ setdesc - Cambia descripción\n'
  texto += '❀ setname - Cambia nombre\n'
  texto += '❀ setphoto - Cambia foto\n'
  texto += '❀ setwelcome - Personaliza bienvenida\n'
  texto += '❀ tagall - Menciona a todos\n'
  texto += '❀ top - Top 5 random\n'
  texto += '❀ welcome - Activa/desactiva bienvenida\n'
  texto += '❀ admins - Lista de administradores\n'
  texto += '❀ confesar - Confesión anónima\n'
  texto += '❀ link - Obtén enlace del grupo\n\n'
  texto += '> La bot debe ser admin para la mayoría de comandos'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['infogroup']
handler.tags = ['info']
handler.command = /^(infogroup|groupinfo)$/i
handler.desc = 'Guía de comandos de grupo'

export default handler