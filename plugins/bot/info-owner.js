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
  groupOficial: 'https://chat.whatsapp.com/EEppolIlNjGDZrmNyDERRr',
  groupSaitama: 'https://chat.whatsapp.com/GrnEybt0lVO9PbWfEf88AQ'
}

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
│ 💬 Grupo oficial: ${links.groupOficial}
│ 🧪 Pruebas y novedades: ${links.groupSaitama}
╰───────────────⬣

> 🌱 SAITAMA BOT
> Contáctanos si tienes dudas`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = /^(owner|creador|creadores|devs)$/i
handler.desc = 'Info de los creadores'

export default handler