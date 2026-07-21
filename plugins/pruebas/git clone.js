import fetch from 'node-fetch'

const API_URL = 'https://api.delirius.store/download/gitclone'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const raw = text?.trim()

  if (!raw || !/^https?:\/\/(www\.)?github\.com\//i.test(raw)) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA GITCLONE*
│
│ 🍃 » Descarga un repositorio de GitHub
│
│ 📝 » Uso: ${usedPrefix}${command} <link del repo>
│ 📝 » Ejemplo:
│ ${usedPrefix}${command} https://github.com/usuario/repo
│
╰───────────────⬣`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    const apiUrl = `${API_URL}?url=${encodeURIComponent(raw)}`
    const res = await fetch(apiUrl)
    const json = await res.json()

    if (!json.status || !json.data?.download) {
      throw new Error('No se pudo obtener el repositorio')
    }

    const { full_name, description, language, created, updated, size, download, stargazers, forks } = json.data

    const texto = `╭─⪼ 🌿 *SAITAMA GITCLONE*
│
│ 📦 » ${full_name}
│ 📝 » ${description || 'Sin descripción'}
│ 💻 » Lenguaje: ${language}
│ 📅 » Creado: ${created}
│ 🔄 » Actualizado: ${updated}
│ 📁 » Tamaño: ${size}
│ ⭐ » Stars: ${stargazers}  🍴 Forks: ${forks}
│
│ 🍃 » Enviando .zip...
│
╰───────────────⬣`

    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })

    const fileRes = await fetch(download)
    if (!fileRes.ok) throw new Error(`No se pudo descargar el .zip (código ${fileRes.status})`)
    const fileBuffer = await fileRes.buffer()

    await conn.sendMessage(m.chat, {
      document: fileBuffer,
      fileName: `${full_name.replace('/', '-')}.zip`,
      mimetype: 'application/zip'
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[GITCLONE ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA GITCLONE*
│
│ ❌ » Error al descargar el repositorio
│ 🔁 » Verifica el link e intenta de nuevo
│
╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.help = ['gitclone <url>']
handler.tags = ['tools', 'downloader']
handler.command = /^(gitclone|githubdl|ghclone)$/i
handler.desc = 'Descarga un repositorio de GitHub como .zip'

export default handler
