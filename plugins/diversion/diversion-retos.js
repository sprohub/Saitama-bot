let retos = [
  '🧘 Haz 10 flexiones ahora mismo',
  '🎤 Canta el coro de tu canción favorita en audio',
  '💃 Baila 30 segundos y graba un video',
  '🤪 Imita a un animal por 15 segundos',
  '📸 Toma una selfie con cara tonta y envíala',
  '🗣️ Di un trabalenguas sin equivocarte',
  '😂 Cuenta un chiste malo',
  '🦶 Agarra algo con los pies y muéstralo',
  '🍽️ Come algo sin usar las manos',
  '🎨 Dibuja a la bot en 1 minuto y envía foto',
  '📝 Escribe un poema de 4 líneas sobre alguien del grupo',
  '🎭 Haz una mímica sin sonido por 20 segundos',
  '🪞 Di "te amo" mirándote al espejo',
  '📞 Llama a alguien y dile "te extraño"',
  '🕺 Camina como robot por 10 segundos',
  '👅 Toca tu nariz con la lengua',
  '🖐️ Di el abecedario al revés',
  '🙃 Párate de cabeza (o intenta)',
  '🎵 Graba un audio cantando con voz de pato',
  '🤳 Video llamada a alguien y dile "eres hermos@"'
]

let handler = async (m, { conn }) => {
  let reto = retos[Math.floor(Math.random() * retos.length)]

  let texto = '🎯 「 HINATA RETO 」 🎯\n\n'
  texto += '💫 » Reto aleatorio\n\n'
  texto += reto + '\n\n'
  texto += '> Cumple el reto o paga 5 💎 de castigo'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['reto']
handler.tags = ['diversion']
handler.command = /^(reto|challenge)$/i
handler.desc = 'Reto aleatorio'
handler.group = true

export default handler