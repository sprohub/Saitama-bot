import fetch from 'node-fetch'
import FormData from 'form-data'

const API_URL = 'https://api.evogb.org/generate/filters'

// 🔑 Tu API key de Evogb. Mejor práctica: muévela a una variable de
// entorno (process.env.EVOGB_APIKEY) en vez de dejarla hardcodeada aquí.
const EVOGB_APIKEY = 'evogb-8ZSpGAql'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Como no tenemos la doc exacta, probamos varios nombres de parámetro
// comunes (español e inglés) hasta que la API deje de quejarse.
const URL_PARAM_NAMES = ['url', 'link', 'imagen', 'imageUrl', 'image']

function isImageResponse(res) {
  const ct = res.headers.get('content-type') || ''
  return res.ok && !ct.includes('application/json') && !ct.includes('text/html')
}

async function tryByUrl(imageUrl) {
  const errors = []
  for (const param of URL_PARAM_NAMES) {
    const apiUrl = `${API_URL}?${param}=${encodeURIComponent(imageUrl)}&apikey=${EVOGB_APIKEY}`
    const res = await fetch(apiUrl)
    if (isImageResponse(res)) {
      console.log('[FILTERS] Parámetro de URL correcto:', param)
      return res
    }
    const rawText = await res.text()
    console.error(`[FILTERS TRY url-param="${param}"]`, res.status, rawText.slice(0, 200))
    errors.push(`${param}: ${rawText.slice(0, 100)}`)
  }
  throw new Error('Ningún nombre de parámetro de URL funcionó:\n' + errors.join('\n'))
}

// Subimos la imagen citada a catbox.moe (ya probado y funcional en el
// plugin trash.js) para conseguir un link público, y así evitamos el
// upload directo a Evogb que está dando problemas.
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
    let imageUrl = raw

    if (!hasUrl) {
      const buffer = await quoted.download()
      imageUrl = await uploadToCatbox(buffer)
    }

    const res = await tryByUrl(imageUrl)

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
