let handler = async (m, { conn }) => {
  let texto = '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA OWNER ㅤ֢ㅤׄㅤׅ\n\n'
  
  texto += '👑 » *EL VIGILANTE*\n'
  texto += '   📱 » +591 77474230\n'
  texto += '   💎 » Desarrollador Principal\n'
  texto += '   🇭🇳 » Hola soy de Honduras, creador de HINATA BOT. Me apasiona la tecnología y el anime. Hinata es mi waifu favorita y por eso creamos esta bot con temática de ella. Si tienes sugerencias o problemas, no dudes en contactarnos.\n'
  texto += '   🐙 » https://github.com/ElvigilanteDv\n\n'
  
  texto += '👑 » *BRAYANRK*\n'
  texto += '   📱 » +57 3223090406\n'
  texto += '   💎 » Desarrollador Principal\n'
  texto += '   🇨🇴 » Estudiante de Ingeniería de Software, aprendiendo cada día sobre programación, desarrollo y nuevas tecnologías. Creador de HINATA BOT.\n'
  texto += '   🐙 » https://github.com/BrayanRK\n\n'
  
  texto += '🌸 » *GRUPO OFICIAL*\n'
  texto += '   💬 » Únete a nuestra comunidad\n'
  texto += '   📲 » https://chat.whatsapp.com/TU_LINK\n\n'
  
  texto += '📦 » *REPOSITORIO*\n'
  texto += '   🐙 » https://github.com/ElvigilanteDv/Hinata-Bot\n\n'
  
  texto += '⫏⫏ HINATA BOT ✿\n\n'
  texto += '> Contáctanos si tienes dudas ♡'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = /^(owner|creador|creadores|devs)$/i
handler.desc = 'Info de los creadores'

export default handler