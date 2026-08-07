import fetch from 'node-fetch'

const API_URL = 'https://api.delirius.online/canvas/phub'

// Imagen de perfil fija (siempre la misma, sin pedir foto ni link)
const FIXED_IMAGE = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const raw = text?.trim() || ''
  const [username, phrase] = raw.split('|').map(s => s.trim())

  if (!username || !phrase) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA PHUB*
│
│ 🍃 » Genera una miniatura estilo PHub
│
│ 📝 » Uso:
│ ${usedPrefix}${command} <usuario> | <texto>
│
│ 📝 » Ejemplo:
│ ${usedPrefix}${command} delirius | Bienvenido a la API
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    const apiUrl = `${API_URL}?image=${encodeURIComponent(FIXED_IMAGE)}&username=${encodeURIComponent(username)}&text=${encodeURIComponent(phrase)}`
    const res = await fetch(apiUrl)
    if (!res.ok) throw new Error(`código ${res.status}`)

    const resultBuffer = await res.buffer()
    if (!resultBuffer.length) throw new Error('respuesta vacía')

    await conn.sendMessage(m.chat, {
      image: resultBuffer,
      caption: `╭─⪼ 🌿 *SAITAMA PHUB*
│
│ ✅ » Imagen generada
│
╰───────────────⬣`
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[PHUB ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA PHUB*
│
│ ❌ » Error al generar la imagen
│ 🔁 » Intenta de nuevo
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['phub <usuario> | <texto>']
handler.tags = ['diversion']
handler.command = /^(phub)$/i
handler.desc = 'Genera una miniatura estilo PHub con usuario y texto'

export default handler
