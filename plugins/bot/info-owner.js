const owners = [
  {
    name: 'BRAYANRK',
    phone: '+57 3223090406',
    role: '🌿 Desarrollador Principal',
    extra: '🇨🇴 Estudiante de Ingeniería de Software.',
    github: 'https://github.com/BrayanRK'
  },
  {
    name: 'SPROHUB',
    phone: '+57 3225396540',
    role: '🍃 Colaborador / Desarrollador',
    extra: null,
    github: null
  }
]

const links = {
  groupOficial: 'https://chat.whatsapp.com/J0sxzJySsV5D2xd410vPzS',
  groupSaitama: 'https://chat.whatsapp.com/GrnEybt0lVO9PbWfEf88AQ'
}

// 👉 Pon aquí tu imagen: puede ser una URL pública o una ruta local
const bannerImage = 'https://i.ibb.co/ZRLmQwRG/2140482e-e443-4829-b97b-2e1af92faa14.jpg'

let handler = async (m, { conn }) => {
  const ownersText = owners.map(o => {
    let block = `╭─⪼ 🌱 *${o.name}*\n│ 📱 ${o.phone}\n│ ${o.role}`
    if (o.extra) block += `\n│ ${o.extra}`
    if (o.github) block += `\n│ 🔗 ${o.github}`
    block += `\n╰───────────────⬣`
    return block
  }).join('\n\n')

  let texto = `╭───────────────⬣
│  🌿 *SAITAMA BOT* 🌿
│   Créditos y Soporte
╰───────────────⬣

${ownersText}

╭─⪼ 🍀 *COMUNIDAD*
│ 🍃Grupo Mitsuri: ${links.groupOficial}
│ ☘️ Grupo Saitama: ${links.groupSaitama}
╰───────────────⬣

> 🌱 SAITAMA BOT
> Contáctanos si tienes dudas`

  await conn.sendMessage(m.chat, {
    image: { url: bannerImage },
    caption: texto
  }, { quoted: m })
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = /^(owner|creador|creadores|devs)$/i
handler.desc = 'Info de los creadores'

export default handler