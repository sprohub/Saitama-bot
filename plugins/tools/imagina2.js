// plugins/tools/imagina2.js — .imagina2 <descripción>
// Genera una imagen con IA (Pollinations.ai, sin API key) y la envía al chat.

import fetch from 'node-fetch'

async function descargarImagen(prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true&model=turbo`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000) // 45s máximo

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`Pollinations respondió ${res.status}`)

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!buffer.length) throw new Error('La imagen llegó vacía')

    return buffer
  } catch (e) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Pollinations tardó demasiado (más de 45s)')
    throw e
  }
}

const handler = async (m, { conn, text }) => {
  const prompt = (text || '').trim()

  if (!prompt) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Escribe una descripción.\n` +
      `│ Ejemplo: *.imagina2 un gato astronauta en la luna*\n` +
      `╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🍃 Generando imagen con IA...\n` +
    `│ ⏳ Espera un momento\n` +
    `╰───────────────⬣`
  )

  try {
    const seed = Math.floor(Math.random() * 1000000)
    const imagen = await descargarImagen(prompt, seed)

    await conn.sendMessage(
      m.chat,
      {
        image: imagen,
        caption: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🎨 ${prompt}\n╰───────────────⬣`
      },
      { quoted: m }
    )
  } catch (e) {
    console.log('[imagina2] error:', e)
    await m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ ${e.message || 'No se pudo generar la imagen.'}\n╰───────────────⬣`
    )
  }
}

handler.command = ['imagina2']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['imagina2 <descripción>']
handler.desc = 'Genera una imagen con IA'

export default handler
