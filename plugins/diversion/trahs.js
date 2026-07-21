import fetch from 'node-fetch'
import FormData from 'form-data'

const API_URL = 'https://api.delirius.store/canvas/trash'

// Sube un buffer a catbox.moe y devuelve la URL pública directa.
// catbox.moe requiere multipart/form-data real (no un buffer crudo),
// por eso usamos el paquete 'form-data'.
async function uploadToCatbox(buffer) {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', buffer, { filename: 'image.jpg' })

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  })

  const resultText = (await res.text()).trim()

  if (!res.ok || !resultText.startsWith('http')) {
    throw new Error('catbox.moe no devolvió una URL válida: ' + resultText.slice(0, 200))
  }

  return resultText
}

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
    // a catbox.moe para obtener una URL pública que la API pueda leer.
    if (!imageUrl) {
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

    let resultBuffer
    try {
      const apiUrl = `${API_URL}?url=${encodeURIComponent(imageUrl)}`
      const res = await fetch(apiUrl)
      if (!res.ok) throw new Error(`código ${res.status}`)
      resultBuffer = await res.buffer()
      if (!resultBuffer.length) throw new Error('respuesta vacía')
    } catch (e) {
      throw new Error('Fallo al llamar la API trash: ' + e.message)
    }

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
    // Log detallado en consola para depurar sin exponer el error crudo al usuario
    console.error('[TRASH ERROR]', e.message)
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
