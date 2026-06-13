let handler = async (m, { conn }) => {
  let texto = `╭━━⬣ 「 SAITAMA OWNER 」

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
┃ 📱 +1 000 0000000
┃ 💎 Colaborador / Desarrollador
┃ 🐙 https://github.com/sprohub

👑 *SAMU COLOMBIA*
┃ 📱 +57 000 0000000
┃ 💎 Colaborador / Desarrollador
┃ 🇨🇴 Colaborador desde Colombia, apoyando en el desarrollo y mantenimiento del bot.
┃ 🐙 https://github.com/samucolombia

🌸 *GRUPO OFICIAL*
┃ 💬 Únete a nuestra comunidad
┃ 📲 https://chat.whatsapp.com/TU_LINK

📦 *REPOSITORIO*
┃ 🐙 https://github.com/ElvigilanteDv/Saitama-Bot

🌐 *API*
┃ 🔗 https://elvigilante-api.onrender.com

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