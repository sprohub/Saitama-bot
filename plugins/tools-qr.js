import fetch from 'node-fetch'

const API_KEY = 'dwk-cuzK1R2F-27YqMWbO'

let handler = async (m, { conn, text }) => {
  if (!text) return conn.sendMessage(m.chat, {
    text: '❌ Escribe el texto que quieres convertir en QR\n\nEjemplo: *.qr https://google.com*'
  }, { quoted: m })

  await conn.sendMessage(m.chat, {
    text: '⏳ Generando código QR...'
  }, { quoted: m })

  try {
    let url = `https://elvigilante-api.onrender.com/api/tools/qr?apiKey=${API_KEY}&text=${encodeURIComponent(text)}`
    let res = await fetch(url)
    let contentType = res.headers.get('content-type') || ''

    // La API devuelve la imagen directo (png/jpeg)
    if (contentType.includes('image')) {
      let buffer = Buffer.from(await res.arrayBuffer())
      return await conn.sendMessage(m.chat, {
        image: buffer,
        caption: `✅ *QR Generado*\n📝 ${text}`
      }, { quoted: m })
    }

    // Si devuelve JSON
    let json = await res.json()

    let imgUrl = json?.url || json?.data?.url || json?.result?.url || json?.image_url
    if (imgUrl) {
      let imgRes = await fetch(imgUrl)
      let buffer = Buffer.from(await imgRes.arrayBuffer())
      return await conn.sendMessage(m.chat, {
        image: buffer,
        caption: `✅ *QR Generado*\n📝 ${text}`
      }, { quoted: m })
    }

    let imgBase64 = json?.image || json?.data?.image || json?.result?.image
    if (imgBase64) {
      let buffer = Buffer.from(imgBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      return await conn.sendMessage(m.chat, {
        image: buffer,
        caption: `✅ *QR Generado*\n📝 ${text}`
      }, { quoted: m })
    }

    conn.sendMessage(m.chat, {
      text: `❌ Respuesta inesperada:\n${JSON.stringify(json, null, 2)}`
    }, { quoted: m })

  } catch (e) {
    console.log('[QR ERROR]', e)
    conn.sendMessage(m.chat, {
      text: '❌ Error al conectar con la API'
    }, { quoted: m })
  }
}

handler.help = ['qrcm <texto>']
handler.tags = ['tools']
handler.command = /^(qrcm)$/i
handler.desc = 'Genera un código QR con el texto que escribas'

export default handler
