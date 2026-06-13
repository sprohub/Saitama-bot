let handler = async (m, { conn }) => {
  let texto = `╭━━⬣ 「 SAITAMA OWNER 」

🌐 *API*
┃ 🔗 https://elvigilante-api.onrender.com

👑 *EL VIGILANTE*
┃ 📱 +591 77474230
┃ 💎 Desarrollador Principal
┃ 🇭🇳 Hola soy de Honduras, creador de SAITAMA BOT. Me apasiona la tecnología y el anime. Si tienes sugerencias o problemas, no dudes en contactarnos.
┃ 🐙 https://github.com/ElvigilanteDv

👑 *BRAYANRK*
┃ 📱 +57 3223090406
┃ 💎 Desarrollador Principal
┃ 🇨🇴 Estudiante de Ingeniería de Software, aprendiendo cada día sobre programación, desarrollo y nuevas tecnologías.
┃ 🐙 https://github.com/BrayanRK

👑 *SPROHUB*
┃ 📱 +57 3225396540
┃ 💎 Colaborador / Desarrollador
┃ 🐙 https://github.com/sprohub

🌸 *GRUPO OFICIAL*
┃ 💬 Únete a nuestra comunidad
┃ 📲 https://chat.whatsapp.com/TU_LINK

📦 *REPOSITORIO*
┃ 🐙 https://github.com/ElvigilanteDv/Saitama-Bot

╰━━━━━━━━━━━━━━━━━━━━━━⬣
⫏⫏ SAITAMA BOT ✿
> Contáctanos si tienes dudas ♡`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = /^(owner|creador|creadores|devs)$/i
handler.desc = 'Info de los creadores'

export default handler