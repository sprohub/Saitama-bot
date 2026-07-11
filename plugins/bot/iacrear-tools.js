const GEMINI_KEY = 'AQ.Ab8RN6Kv5tEIY4qUUuUePI5y60EeZwKyPwrxMLGs4cSYNw5CAA'
const GEMINI_MODEL = 'gemini-2.5-flash-image'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`

let handler = async (m, { conn, text }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ \n│ ✳️ Uso: .iacrear <descripción>\n│ Ejemplo: .iacrear un lobo bajo la luna, estilo anime\n╰───────────────⬣'
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, {
    text: '╭─⪼ \n│ 🎨 Generando imagen con IA...\n│ Espera un momento\n╰───────────────⬣'
  }, { quoted: m })

  try {
    const body = {
      contents: [
        { parts: [{ text }] }
      ]
    }

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[IACREAR ERROR]', JSON.stringify(data))
      return conn.sendMessage(m.chat, {
        text: '╭─⪼ \n│ ❌ Error al generar la imagen\n│ Intenta con otro prompt\n╰───────────────⬣'
      }, { quoted: m })
    }

    const parts = data?.candidates?.[0]?.content?.parts || []
    const imgPart = parts.find(p => p.inlineData)

    if (!imgPart) {
      console.error('[IACREAR SIN IMAGEN]', JSON.stringify(data))
      return conn.sendMessage(m.chat, {
        text: '╭─⪼ \n│ ❌ No se pudo generar la imagen\n│ Intenta con otra descripción\n╰───────────────⬣'
      }, { quoted: m })
    }

    const buffer = Buffer.from(imgPart.inlineData.data, 'base64')

    const caption = '╭─⪼ \n│ 🖼️ Imagen generada\n│ 📝 ' + text + '\n╰───────────────⬣'

    await conn.sendMessage(m.chat, {
      image: buffer,
      caption
    }, { quoted: m })

  } catch (e) {
    console.error('[IACREAR ERROR]', e.message)
    await conn.sendMessage(m.chat, {
      text: '╭─⪼ \n│ ❌ Algo salió mal generando la imagen\n╰───────────────⬣'
    }, { quoted: m })
  }
}

handler.help = ['iacrear <texto>']
handler.tags = ['ia']
handler.command = /^(iacrear)$/i
handler.desc = 'Genera una imagen con IA (Gemini) a partir de un texto'

export default handler
