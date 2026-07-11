import { Jimp } from 'jimp'
import QrCodeReader from 'qrcode-reader'
import fetch from 'node-fetch'

const API_KEY = 'Edward3bW2HWqQ'
const BASE_URL = 'https://dv-edward.onrender.com/api/tools/qr'
const IMG = 'https://i.ibb.co/cqqj2T4/011b3cca-2c95-4911-bb55-27a0686c7544.jpg'

function detectarTipo(contenido) {
  if (/^https?:\/\//i.test(contenido)) return '🌐 Enlace / Web'
  if (/^WIFI:/i.test(contenido)) return '📶 Red WiFi'
  if (/^BEGIN:VCARD/i.test(contenido)) return '👤 Contacto (vCard)'
  if (/^mailto:/i.test(contenido)) return '📧 Correo'
  if (/^tel:/i.test(contenido)) return '📞 Teléfono'
  if (/\.pdf(\?|$)/i.test(contenido)) return '📄 Documento PDF'
  return '📝 Texto'
}

let handler = async (m, { conn }) => {
  let mediaMsg = m.quoted && /image/.test(m.quoted.mimetype || '') ? m.quoted
    : /image/.test(m.mimetype || '') ? m
    : null

  if (!mediaMsg) {
    return conn.sendMessage(m.chat, {
      image: { url: IMG },
      caption: `╭━━⬣ LECTOR DE QR ⬣\n┃\n┃ ❌ Envía o responde a una imagen con un QR\n┃\n┃ 📌 Ejemplo:\n┃ *.leerqr* (respondiendo a la imagen)\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, {
    image: { url: IMG },
    caption: `╭━━⬣ LECTOR DE QR ⬣\n┃\n┃ ⏳ Leyendo el código QR...\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
  }, { quoted: m })

  try {
    let buffer = await mediaMsg.download()
    let image = await Jimp.read(buffer)

    let contenido = await new Promise((resolve, reject) => {
      let qr = new QrCodeReader()
      qr.callback = (err, value) => {
        if (err || !value) return reject(err || new Error('No se detectó ningún QR'))
        resolve(value.result)
      }
      qr.decode(image.bitmap)
    })

    let tipo = detectarTipo(contenido)

    let url = `${BASE_URL}?apiKey=${API_KEY}&text=${encodeURIComponent(contenido)}`
    let res = await fetch(url)
    let contentType = res.headers.get('content-type') || ''

    let qrBuffer
    if (contentType.includes('image')) {
      qrBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      let json = await res.json()
      let imgUrl = json?.url || json?.data?.url || json?.result?.url || json?.image_url
      let imgBase64 = json?.image || json?.data?.image || json?.result?.image
      if (imgUrl) {
        let imgRes = await fetch(imgUrl)
        qrBuffer = Buffer.from(await imgRes.arrayBuffer())
      } else if (imgBase64) {
        qrBuffer = Buffer.from(imgBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      }
    }

    let caption = `╭━━⬣ LECTOR DE QR ⬣\n┃\n┃ ✅ ¡QR Leído!\n┃ ${tipo}\n┃ 📝 Contenido:\n┃ ${contenido}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`

    if (qrBuffer) {
      await conn.sendMessage(m.chat, { image: qrBuffer, caption }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, { image: { url: IMG }, caption }, { quoted: m })
    }

  } catch (e) {
    console.log('[LEERQR ERROR]', e)
    await conn.sendMessage(m.chat, {
      image: { url: IMG },
      caption: `╭━━⬣ LECTOR DE QR ⬣\n┃\n┃ ❌ No se pudo leer el QR de esa imagen\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
    }, { quoted: m })
  }
}

handler.help = ['leerqr']
handler.tags = ['tools']
handler.command = /^(leerqr|readqr|scanqr)$/i
handler.customPrefix = /^[/@#.]/i
handler.desc = 'Lee un código QR desde una imagen y muestra su contenido'

export default handler
