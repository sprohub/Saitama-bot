import fetch from 'node-fetch'

const API_URL = 'https://api.delirius.store/canvas/trash'

let handler = async (m, { conn, text }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''
  const isImage = /image/.test(mime)

  let imageUrl = null

  // Prioridad: URL escrita en el texto
  if (text && /^https?:\/\//i.test(text.trim())) {
    imageUrl = text.trim()
  }

  if (!imageUrl && !isImage) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA TRASH*
│
│ 🍃 » Convierte una imagen en basura 🗑️
│
│ 📝 » Cita una imagen y envía el comando
│ 📝 » O usa: #trash <url>
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    // Si no vino URL directa, descargamos la imagen citada y la subimos
    // a un host temporal para poder pasarle una URL a la API.
    if (!imageUrl) {
      const buffer = await quoted.download()
      const uploadRes = await fetch('https://telegra.ph/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer
      })
      const uploadJson = await uploadRes.json()
      if (!Array.isArray(uploadJson) || !uploadJson[0]?.src) {
        throw new Error('No se pudo subir la imagen para procesarla')
      }
      imageUrl = 'https://telegra.ph' + uploadJson[0].src
    }

    const apiUrl = `${API_URL}?url=${encodeURIComponent(imageUrl)}`
    const res = await fetch(apiUrl)
    if (!res.ok) throw new Error(`La API respondió ${res.status}`)

    const resultBuffer = await res.buffer()
    if (!resultBuffer.length) throw new Error('La API devolvió una imagen vacía')

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
    console.log(e)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA TRASH*
│
│ ❌ » Error al procesar la imagen
│ 🔁 » Intenta con otra imagen o link
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['trash <url>']
handler.tags = ['tools']
handler.command = /^(trash|basura)$/i
handler.desc = 'Aplica el filtro trash a una imagen'

export default handler
