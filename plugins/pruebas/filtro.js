import fetch from 'node-fetch'
import FormData from 'form-data'

const API_URL = 'https://api.evogb.org/generate/filters'

// 🔑 Tu API key de Evogb. Mejor práctica: muévela a una variable de
// entorno (process.env.EVOGB_APIKEY) en vez de dejarla hardcodeada aquí.
const EVOGB_APIKEY = 'evogb-8ZSpGAql'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''
  const isImage = /image/.test(mime)

  const raw = text?.trim()
  const hasUrl = raw && /^https?:\/\//i.test(raw)

  if (!hasUrl && !isImage) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA FILTERS*
│
│ 🍃 » Aplica un filtro a una imagen
│
│ 📝 » Cita una imagen y envía el comando
│ 📝 » O usa: ${usedPrefix}${command} <link de imagen>
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    let res

    if (hasUrl) {
      // Modo 1: URL directa por query string
      const apiUrl = `${API_URL}?url=${encodeURIComponent(raw)}&apikey=${EVOGB_APIKEY}`
      res = await fetch(apiUrl)
    } else {
      // Modo 2: subir el archivo directo con multipart/form-data.
      // Mando la apikey tanto en el query string como en el form,
      // por si la API la espera en uno u otro lugar.
      const buffer = await quoted.download()
      const form = new FormData()
      form.append('file', buffer, { filename: 'image.jpg' })
      form.append('apikey', EVOGB_APIKEY)

      res = await fetch(`${API_URL}?apikey=${EVOGB_APIKEY}`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
      })
    }

    const contentType = res.headers.get('content-type') || ''

    // Si la API responde con JSON en vez de imagen, es que hubo un error
    // (falta de parámetro, key inválida, etc.)
    if (contentType.includes('application/json') || contentType.includes('text/html')) {
      const rawText = await res.text()
      console.error('[FILTERS RAW RESPONSE]', res.status, rawText.slice(0, 500))
      let message = rawText
      try { message = JSON.parse(rawText).message || rawText } catch {}
      throw new Error(message.slice(0, 200))
    }

    if (!res.ok) throw new Error(`código ${res.status}`)

    const resultBuffer = await res.buffer()
    if (!resultBuffer.length) throw new Error('respuesta vacía')

    await conn.sendMessage(m.chat, {
      image: resultBuffer,
      caption: `╭─⪼ 🌿 *SAITAMA FILTERS*
│
│ ✅ » Filtro aplicado
│
╰───────────────⬣`
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[FILTERS ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA FILTERS*
│
│ ❌ » Error al aplicar el filtro
│ 🔁 » ${e.message}
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['filters', 'filters <url>']
handler.tags = ['tools']
handler.command = /^(filters|filtro)$/i
handler.desc = 'Aplica un filtro a una imagen (citada o por link)'

export default handler
