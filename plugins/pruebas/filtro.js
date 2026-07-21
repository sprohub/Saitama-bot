import fetch from 'node-fetch'
import FormData from 'form-data'

const API_URL = 'https://api.evogb.org/generate/filters'

// 🔑 Tu API key de Evogb. Mejor práctica: muévela a una variable de
// entorno (process.env.EVOGB_APIKEY) en vez de dejarla hardcodeada aquí.
const EVOGB_APIKEY = 'evogb-8ZSpGAql'

// Como no tenemos la doc exacta, probamos varios nombres de parámetro/campo
// comunes (español e inglés) hasta que la API deje de quejarse.
const URL_PARAM_NAMES = ['url', 'link', 'imagen', 'imageUrl', 'image']
const FILE_FIELD_NAMES = ['archivo', 'file', 'imagen', 'image', 'photo']

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

async function tryByFile(buffer) {
  const errors = []
  for (const field of FILE_FIELD_NAMES) {
    const form = new FormData()
    form.append(field, buffer, { filename: 'image.jpg' })
    form.append('apikey', EVOGB_APIKEY)

    const res = await fetch(`${API_URL}?apikey=${EVOGB_APIKEY}`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    })
    if (isImageResponse(res)) {
      console.log('[FILTERS] Campo de archivo correcto:', field)
      return res
    }
    const rawText = await res.text()
    console.error(`[FILTERS TRY file-field="${field}"]`, res.status, rawText.slice(0, 200))
    errors.push(`${field}: ${rawText.slice(0, 100)}`)
  }
  throw new Error('Ningún nombre de campo de archivo funcionó:\n' + errors.join('\n'))
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
    let res

    if (hasUrl) {
      res = await tryByUrl(raw)
    } else {
      const buffer = await quoted.download()
      res = await tryByFile(buffer)
    }

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
