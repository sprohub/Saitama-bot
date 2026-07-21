import axios from 'axios'
import fetch from 'node-fetch'
import FormData from 'form-data'

const API_URL = 'https://api.evogb.org/generate/filters'

// 🔑 Mejor práctica: mover esto a una variable de entorno
// (process.env.EVOGB_KEY) en vez de dejarla hardcodeada.
const API_KEY = 'evogb-8ZSpGAql'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ── Alias en español → valor real que espera la API (filterType) ──
const FILTER_ALIASES = {
  blur: 'blur',
  desenfoque: 'blur',
  pixel: 'pixelate',
  pixelado: 'pixelate',
  wave: 'wave',
  ondas: 'wave',
  glitch: 'glitch',
  sticker: 'sticker',
  gay: 'gay',
  arcoiris: 'gay',
  gris: 'greyscale',
  grises: 'greyscale',
  grayscale: 'greyscale',
  greyscale: 'greyscale',
  invertir: 'invert',
  invert: 'invert',
  sepia: 'sepia'
}

const FILTER_LIST = [...new Set(Object.values(FILTER_ALIASES))].join(', ')

// ── Subida de la imagen a un host público ──
// El código de referencia usa imgbb (uploadBufferToImgbb). Como no
// tenemos una API key de imgbb, usamos catbox.moe con la misma firma
// de función para que el resto del código quede idéntico al original.
// Si consigues una key de imgbb, solo hay que reemplazar el cuerpo de
// esta función por la llamada a https://api.imgbb.com/1/upload.
async function uploadBufferToImgbb(buffer) {
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
    throw new Error('Fallo al subir la imagen: ' + resultText.slice(0, 150))
  }
  return resultText
}

// ── Llamada a la API (method: url, filterType + parámetros numéricos) ──
// Idéntica a la del código de referencia.
async function generateFilteredImage({ imageUrl, filterType, level }) {
  const response = await axios.get(API_URL, {
    params: {
      method: 'url',
      url: imageUrl,
      filterType,
      level,
      pixelSize: level,
      amplitude: level,
      frequency: level,
      intensity: level,
      borderSize: level,
      key: API_KEY
    },
    timeout: 60000,
    responseType: 'arraybuffer',
    validateStatus: () => true
  })

  const contentType = (response.headers['content-type'] || '').toLowerCase()

  if (response.status >= 400) {
    let errMsg = `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(Buffer.from(response.data).toString('utf8'))
      errMsg = parsed?.message || parsed?.error || parsed?.detail || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  // Caso 1: la API devuelve la imagen binaria directa
  if (contentType.includes('image/') || contentType.includes('octet-stream')) {
    return Buffer.from(response.data)
  }

  // Caso 2: la API devuelve JSON con una URL a la imagen generada
  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(Buffer.from(response.data).toString('utf8'))
    const resultUrl = parsed?.url || parsed?.data?.url || parsed?.result
    if (!resultUrl) throw new Error('La API respondió JSON sin URL de imagen (formato inesperado).')

    const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 60000 })
    return Buffer.from(imgRes.data)
  }

  // Tipo de respuesta desconocido: devolvemos igual el buffer crudo por si acaso
  return Buffer.from(response.data)
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''
  const isImage = /image/.test(mime)

  const args = text?.trim().split(/\s+/).filter(Boolean) || []
  const filterArg = (args[0] || '').toLowerCase()
  const filterType = FILTER_ALIASES[filterArg]

  if (!filterType || !isImage) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA FILTERS*
│
│ 🍃 » Aplica un filtro a una imagen
│
│ 📝 » Cita una imagen y escribe:
│ ${usedPrefix}${command} <filtro> [nivel]
│
│ 📝 » Ejemplo:
│ ${usedPrefix}${command} sepia
│ ${usedPrefix}${command} pixel 20
│
│ 🎨 » Filtros disponibles:
│ ${FILTER_LIST}
│
╰───────────────⬣`
    }, { quoted: m })
  }

  const levelArg = args[1]
  const level = /^\d+$/.test(levelArg) ? parseInt(levelArg, 10) : 10

  await m.react('🎨')

  try {
    const buffer = await quoted.download()
    const imageUrl = await uploadBufferToImgbb(buffer)
    const resultBuffer = await generateFilteredImage({ imageUrl, filterType, level })

    await conn.sendMessage(m.chat, {
      image: resultBuffer,
      caption: `╭─⪼ 🌿 *SAITAMA FILTERS*
│
│ ✅ » Filtro "${filterType}" aplicado
│
╰───────────────⬣`
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[FILTERS ERROR]', filterType, e.message)
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

handler.help = ['filters <filtro> [nivel]']
handler.tags = ['tools']
handler.command = /^(filters|filtro|imgfilter)$/i
handler.desc = 'Aplica un filtro a una imagen citada (blur, pixel, wave, glitch, sticker, gay, grises, invertir, sepia)'

export default handler
