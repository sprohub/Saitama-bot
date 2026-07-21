import fetch from 'node-fetch'
import FormData from 'form-data'

const API_URL = 'https://api.delirius.store/canvas/phub'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function uploadToCatbox(buffer) {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', buffer, { filename: 'image.jpg' })

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    headers: { ...form.getHeaders(), 'User-Agent': UA }
  })

  const resultText = (await res.text()).trim()
  if (!res.ok || !resultText.startsWith('http')) {
    throw new Error('catbox.moe: ' + resultText.slice(0, 150))
  }
  return resultText
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : null
  const mime = quoted ? (quoted.msg || quoted).mimetype || '' : ''
  const hasQuotedImage = /image/.test(mime)

  const raw = text?.trim() || ''
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean)

  let imageUrl, username, phrase

  if (hasQuotedImage) {
    // Citando imagen: solo se necesitan usuario y texto
    ;[username, phrase] = parts
  } else {
    // Sin cita: se necesita link, usuario y texto
    ;[imageUrl, username, phrase] = parts
  }

  const isValid = hasQuotedImage
    ? (username && phrase)
    : (imageUrl && /^https?:\/\//i.test(imageUrl) && username && phrase)

  if (!isValid) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA PHUB*
│
│ 🍃 » Genera una miniatura estilo PHub
│
│ 📝 » Citando una imagen:
│ ${usedPrefix}${command} <usuario> | <texto>
│
│ 📝 » Con link directo:
│ ${usedPrefix}${command} <link> | <usuario> | <texto>
│
│ 📝 » Ejemplo:
│ ${usedPrefix}${command} delirius | Bienvenido a la API
│
│ ⚠️ » Los datos van separados por " | "
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    if (hasQuotedImage) {
      let buffer
      try {
        buffer = await quoted.download()
      } catch (e) {
        throw new Error('No se pudo descargar la imagen citada: ' + e.message)
      }

      try {
        imageUrl = await uploadToCatbox(buffer)
      } catch (e) {
        throw new Error('Fallo al subir la imagen: ' + e.message)
      }
    }

    const apiUrl = `${API_URL}?image=${encodeURIComponent(imageUrl)}&username=${encodeURIComponent(username)}&text=${encodeURIComponent(phrase)}`
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
│ 🔁 » Verifica los datos e intenta de nuevo
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['phub <usuario> | <texto>', 'phub <link> | <usuario> | <texto>']
handler.tags = ['tools']
handler.command = /^(phub)$/i
handler.desc = 'Genera una miniatura estilo PHub (citando imagen o por link)'

export default handler
