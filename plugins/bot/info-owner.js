import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 👉 Imagen local del banner (colócala en lib/ownerinfo.jpg)
const bannerImagePath = path.join(__dirname, '..', '..', 'lib', 'ownerinfo.jpg')

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

  let imagenBanner
  try {
    imagenBanner = fs.readFileSync(bannerImagePath)
  } catch (e) {
    console.error('[owner] No se encontró la imagen en', bannerImagePath, e)
  }

  if (imagenBanner) {
    await conn.sendMessage(m.chat, {
      image: imagenBanner,
      caption: texto
    }, { quoted: m })
  } else {
    // Si no se encuentra la imagen, se envía solo el texto para no romper el comando
    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = /^(owner|creador|creadores|devs)$/i
handler.desc = 'Info de los creadores'

export default handler
