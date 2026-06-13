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
    let json = await res.json()

    if (!json || json.error) {
      return conn.sendMessage(m.chat, {
        text: '❌ No se pudo generar el QR, intenta más tarde'
      }, { quoted: m })
    }

    // Si la API devuelve una imagen en base64
    if (json.image || json.data?.image || json.result?.image) {
      let imgBase64 = json.image || json.data?.image || json.result?.image
      let buffer = Buffer.from(imgBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      return await conn.sendMessage(m.chat, {
        image: buffer,
        caption: `✅ *QR generado*\n📝 Texto: ${text}`
      }, { quoted: m })
    }

    // Si la API devuelve una URL de imagen
    if (json.url || json.data?.url || json.result?.url) {
      let imgUrl = json.url || json.data?.url || json.result?.url
      return await conn.sendMessage(m.chat, {
        image: { url: imgUrl },
        caption: `✅ *QR generado*\n📝 Texto: ${text}`
      }, { quoted: m })
    }

    // Si no se reconoce la respuesta
    conn.sendMessage(m.chat, {
      text: `❌ Respuesta inesperada de la API:\n${JSON.stringify(json, null, 2)}`
    }, { quoted: m })

  } catch (e) {
    console.log('[QR ERROR]', e)
    conn.sendMessage(m.chat, {
      text: '❌ Error al conectar con la API'
    }, { quoted: m })
  }
}

handler.help = ['qr <texto>']
handler.tags = ['tools']
handler.command = /^(qr|codigoqr|generarqr)$/i
handler.desc = 'Genera un código QR con el texto que escribas'

export default handler
