import fetch from 'node-fetch'

const API_URL = 'https://api.delirius.store/canvas/trash'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const raw = text?.trim()

  if (!raw || !/^https?:\/\//i.test(raw)) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA TRASH*
│
│ 🍃 » Convierte una imagen en basura 🗑️
│
│ 📝 » Uso: ${usedPrefix}${command} <link de imagen>
│ 📝 » Ejemplo: ${usedPrefix}${command} https://telegra.ph/file/xxxxx.jpg
│
│ ⚠️ » Debe ser un link directo a la imagen
│ ⚠️ » (no funciona citando una foto del chat)
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    const apiUrl = `${API_URL}?url=${encodeURIComponent(raw)}`
    const res = await fetch(apiUrl)
    if (!res.ok) throw new Error(`código ${res.status}`)

    const resultBuffer = await res.buffer()
    if (!resultBuffer.length) throw new Error('respuesta vacía')

    await conn.sendMessage(m.chat, {
      image: resultBuffer,
      caption: `╭─⪼ 🌿 *SAITAMA TRASH*
│
│ ✅ » Imagen procesada
│
╰───────────────⬣`
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[TRASH ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA TRASH*
│
│ ❌ » Error al procesar la imagen
│ 🔁 » Verifica que el link sea válido
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['trash <link>']
handler.tags = ['tools']
handler.command = /^(trash|basura)$/i
handler.desc = 'Aplica el filtro trash a una imagen (solo por link)'

export default handler
