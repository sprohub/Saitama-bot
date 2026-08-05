import fetch from 'node-fetch'

const API_URL = 'https://api.delirius.online/download/mega'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const raw = text?.trim()

  if (!raw || !/^https?:\/\/(www\.)?mega\.nz\//i.test(raw)) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA MEGA*
│
│ 🍃 » Descarga archivos de Mega.nz
│
│ 📝 » Uso: ${usedPrefix}${command} <link>
│ 📝 » Ejemplo:
│ ${usedPrefix}${command} https://mega.nz/file/xxxxx
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    // Esta API usa POST con el link en el body JSON (a diferencia de las
    // demás de Delirius, que usan GET con ?url=)
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: raw })
    })

    if (!res.ok) throw new Error(`La API respondió ${res.status}`)
    const json = await res.json()

    if (!json.status && json.status !== undefined) {
      throw new Error('La API marcó status: false → ' + JSON.stringify(json).slice(0, 200))
    }

    const data = json.data || json
    // La API puede devolver el link de descarga bajo distintos nombres
    // según la versión; probamos los más comunes.
    const downloadLink = data.download || data.link || data.url
    const filename = data.filename || data.name || 'archivo_mega'
    const size = data.size || data.filesize || 'Desconocido'

    if (!downloadLink) {
      console.error('[MEGA RAW RESPONSE]', JSON.stringify(json))
      throw new Error('No se encontró el link de descarga en la respuesta de la API')
    }

    const texto = `╭─⪼ 🌿 *SAITAMA MEGA*
│
│ 📁 » ${filename}
│ 📦 » Tamaño: ${size}
│
│ 🍃 » Enviando archivo...
│
╰───────────────⬣`

    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })

    const fileRes = await fetch(downloadLink)
    if (!fileRes.ok) throw new Error(`No se pudo descargar el archivo (código ${fileRes.status})`)
    const fileBuffer = await fileRes.buffer()

    await conn.sendMessage(m.chat, {
      document: fileBuffer,
      fileName: filename,
      mimetype: 'application/octet-stream'
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[MEGA ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA MEGA*
│
│ ❌ » Error al descargar el archivo
│ 🔁 » Verifica el link e intenta de nuevo
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['mega <url>']
handler.tags = ['tools', 'downloader']
handler.command = /^(mega|meganz)$/i
handler.desc = 'Descarga archivos de Mega.nz'

export default handler
