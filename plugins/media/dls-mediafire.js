import fetch from 'node-fetch'

let handler = async (m, { conn, text }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA MEDIAFIRE*
│
│ 🍃 » Descarga archivos de MediaFire
│
│ 📝 » ${'#mediafire <link>'}
│ 📝 » ${'#mf <link>'}
│
╰───────────────⬣`
    }, { quoted: m })
  }

  if (!text.includes('mediafire.com')) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA MEDIAFIRE*
│
│ 🍃 » Solo se aceptan links de MediaFire
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    let apiUrl = `https://api.delirius.store/download/mediafire?url=${encodeURIComponent(text)}`
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.data?.link) {
      throw new Error('No se pudo obtener el archivo')
    }

    let { filename, size, uploaded, extension, link } = json.data

    let texto = `╭─⪼ 🌿 *SAITAMA MEDIAFIRE*
│
│ 📁 » ${filename}
│ 📦 » Tamaño: ${size}
│ 📅 » Subido: ${uploaded}
│ 📄 » Formato: .${extension}
│
│ 🍃 » Enviando archivo...
│
╰───────────────⬣`

    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })

    let fileRes = await fetch(link)
    let fileBuffer = await fileRes.buffer()

    let mimetype = 'application/octet-stream'
    if (extension === 'apk') mimetype = 'application/vnd.android.package-archive'
    else if (extension === 'zip' || extension === '7z' || extension === 'rar') mimetype = 'application/zip'

    await conn.sendMessage(m.chat, {
      document: fileBuffer,
      fileName: filename,
      mimetype: mimetype
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.log(e)
    await m.react('❌')
    conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA MEDIAFIRE*
│
│ ❌ » Error al descargar
│ 🔁 » Verifica el link e intenta de nuevo
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['mediafire']
handler.tags = ['downloader']
handler.command = /^(mediafire|mf)$/i
handler.desc = 'Descarga archivos de MediaFire'

export default handler
