const owners = [
  {
    name: 'EL VIGILANTE',
    phone: '+591 77474230',
    role: '💎 Desarrollador Principal',
    extra: '🇭🇳 Creador de SAITAMA BOT. Apasionado por la tecnología y el anime.',
    github: 'https://github.com/ElvigilanteDv'
  },
  {
    name: 'BRAYANRK',
    phone: '+57 3223090406',
    role: '💎 Desarrollador Principal',
    extra: '🇨🇴 Estudiante de Ingeniería de Software.',
    github: 'https://github.com/BrayanRK'
  },
  {
    name: 'SPROHUB',
    phone: '+57 3225396540',
    role: '🛠️ Colaborador / Desarrollador',
    extra: null,
    github: 'https://github.com/sprohub'
  }
]

const links = {
  api: 'https://elvigilante-api.onrender.com',
  apiGroup: 'https://chat.whatsapp.com/K11rQWn1S8X2XLRUuLoeau',
  groupOficial: 'https://chat.whatsapp.com/EEppolIlNjGDZrmNyDERRr',
  groupSaitama: 'https://chat.whatsapp.com/GrnEybt0lVO9PbWfEf88AQ',
  repo: 'https://github.com/ElvigilanteDv/Saitama-Bot'
}

let handler = async (m, { conn }) => {
  const ownersText = owners.map(o => {
    let block = `╭─⪼ 👑 *${o.name}*\n│ 📱 ${o.phone}\n│ ${o.role}`
    if (o.extra) block += `\n│ ${o.extra}`
    block += `\n│ 🐙 ${o.github}\n╰───────────────⬣`
    return block
  }).join('\n\n')

  let texto = `╭───────────────⬣
│  ✦ *SAITAMA BOT* ✦
│   Créditos y Soporte
╰───────────────⬣

╭─⪼ 🌐 *API*
│ 🔗 ${links.api}
│ 💬 Grupo: ${links.apiGroup}
╰───────────────⬣

${ownersText}

╭─⪼ 🌸 *COMUNIDAD*
│ 💬 Grupo oficial: ${links.groupOficial}
│ 🧪 Pruebas y novedades: ${links.groupSaitama}
╰───────────────⬣

╭─⪼ 📦 *REPOSITORIO*
│ 🐙 ${links.repo}
╰───────────────⬣

> ⫏⫏ SAITAMA BOT ✿
> Contáctanos si tienes dudas ♡`

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = /^(owner|creador|creadores|devs)$/i
handler.desc = 'Info de los creadores'

export default handler
