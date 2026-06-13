import fetch from 'node-fetch'

const API_KEY = 'dwk-cuzK1R2F-27YqMWbO'
const IMG = 'https://i.ibb.co/TB7cZfFG/SAITAMAmenu.jpg'

let handler = async (m, { conn, text }) => {
  if (!text) return conn.sendMessage(m.chat, {
    image: { url: IMG },
    caption: `╭━━⬣ GENERADOR DE QRCM ⬣\n┃\n┃ ❌ No escribiste ningún texto\n┃\n┃ 📌 Ejemplo:\n┃ *.qrcm https://google.com*\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
  }, { quoted: m })

  await conn.sendMessage(m.chat, {
    image: { url: IMG },
    caption: `╭━━⬣ GENERADOR DE QRCM ⬣\n┃\n┃ ⏳ Generando tu código QR...\n┃ 📝 Texto: ${text}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
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
        caption: `╭━━⬣ GENERADOR DE QRCM ⬣\n┃\n┃ ✅ ¡QRCM Generado!\n┃ 📝 Texto: ${text}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
      }, { quoted: m })
    }

    // Si devuelve JSON con URL
    let json = await res.json()

    let imgUrl = json?.url || json?.data?.url || json?.result?.url || json?.image_url
    if (imgUrl) {
      let imgRes = await fetch(imgUrl)
      let buffer = Buffer.from(await imgRes.arrayBuffer())
      return await conn.sendMessage(m.chat, {
        image: buffer,
        caption: `╭━━⬣ GENERADOR DE QRCM ⬣\n┃\n┃ ✅ ¡QRCM Generado!\n┃ 📝 Texto: ${text}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
      }, { quoted: m })
    }

    // Si devuelve base64
    let imgBase64 = json?.image || json?.data?.image || json?.result?.image
    if (imgBase64) {
      let buffer = Buffer.from(imgBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      return await conn.sendMessage(m.chat, {
        image: buffer,
        caption: `╭━━⬣ GENERADOR DE QRCM ⬣\n┃\n┃ ✅ ¡QRCM Generado!\n┃ 📝 Texto: ${text}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
      }, { quoted: m })
    }

    conn.sendMessage(m.chat, {
      text: `╭━━⬣ GENERADOR DE QRCM ⬣\n┃\n┃ ❌ Respuesta inesperada de la API\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
    }, { quoted: m })

  } catch (e) {
    console.log('[QRCM ERROR]', e)
    conn.sendMessage(m.chat, {
      text: `╭━━⬣ GENERADOR DE QRCM ⬣\n┃\n┃ ❌ Error al conectar con la API\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA`
    }, { quoted: m })
  }
}

handler.help = ['qrcm <texto>']
handler.tags = ['tools']
handler.command = /^(qrcm)$/i
handler.desc = 'Genera un código QRCM con el texto que escribas'

export default handler
