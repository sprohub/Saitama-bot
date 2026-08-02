import fetch from 'node-fetch'
import JSZip from 'jszip'

// 🔎 Analiza cualquier link de GitHub y determina qué tipo es:
// repo completo, carpeta (tree) o archivo único (blob)
function parseGithubUrl(rawUrl) {
  let url
  try { url = new URL(rawUrl) } catch { return null }
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return null

  // Separamos por "/" y decodificamos cada segmento (por si vienen con %2F, %20, etc.)
  let partes = url.pathname.split('/').filter(Boolean).map(p => decodeURIComponent(p))
  // Si algún segmento trae un "/" codificado dentro (ej. database%2Fcharacters.json), lo separamos también
  partes = partes.flatMap(p => p.split('/')).filter(Boolean)

  if (partes.length < 2) return null

  const owner = partes[0]
  const repo = partes[1].replace(/\.git$/i, '')

  if (partes.length === 2) {
    return { owner, repo, type: 'repo' }
  }

  const tipo = partes[2] // 'tree' o 'blob'
  const branch = partes[3]
  const rutaArchivo = partes.slice(4).join('/')

  if (!branch) return null

  if (tipo === 'blob') {
    if (!rutaArchivo) return null
    return { owner, repo, type: 'blob', branch, rutaArchivo }
  }
  if (tipo === 'tree') {
    if (!rutaArchivo) return { owner, repo, type: 'repo', branch }
    return { owner, repo, type: 'tree', branch, rutaArchivo }
  }
  return null
}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function codificarRuta(ruta) {
  return ruta.split('/').map(encodeURIComponent).join('/')
}

async function obtenerBranchPorDefecto(owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { 'User-Agent': 'SaitamaBot' }
  })
  if (!res.ok) throw new Error('Repositorio no encontrado, es privado, o el link es inválido')
  const json = await res.json()
  return json.default_branch || 'main'
}

async function descargarRepoZip(owner, repo, branch) {
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${encodeURIComponent(branch)}.zip`
  const res = await fetch(zipUrl)
  if (!res.ok) throw new Error(`No se pudo descargar el repositorio (código ${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

async function descargarArchivoUnico(owner, repo, branch, rutaArchivo) {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${codificarRuta(rutaArchivo)}`
  const res = await fetch(rawUrl)
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (código ${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

// 📁 Recorre una carpeta del repo con la API de GitHub y arma un .zip en memoria
async function descargarCarpetaZip(owner, repo, branch, carpetaBase) {
  const zip = new JSZip()

  async function recorrer(rutaActual) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${codificarRuta(rutaActual)}?ref=${encodeURIComponent(branch)}`
    const res = await fetch(apiUrl, { headers: { 'User-Agent': 'SaitamaBot' } })
    if (!res.ok) throw new Error(`No se pudo leer la carpeta (código ${res.status})`)
    const items = await res.json()
    if (!Array.isArray(items)) throw new Error('Esa ruta no es una carpeta válida')

    for (const item of items) {
      const rutaRelativa = item.path.slice(carpetaBase.length).replace(/^\//, '') || item.name

      if (item.type === 'dir') {
        await recorrer(item.path)
      } else if (item.type === 'file' && item.download_url) {
        const fileRes = await fetch(item.download_url)
        if (!fileRes.ok) continue
        const buf = Buffer.from(await fileRes.arrayBuffer())
        zip.file(rutaRelativa, buf)
      }
    }
  }

  await recorrer(carpetaBase)
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const raw = text?.trim()

  if (!raw || !/^https?:\/\/(www\.)?github\.com\//i.test(raw)) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        'Descarga cualquier repositorio, carpeta o archivo de GitHub\n\n' +
        `Uso: ${usedPrefix}${command} <link de GitHub>\n\n` +
        'Ejemplos:\n' +
        `${usedPrefix}${command} https://github.com/usuario/repo\n` +
        `${usedPrefix}${command} https://github.com/usuario/repo/tree/main/carpeta\n` +
        `${usedPrefix}${command} https://github.com/usuario/repo/blob/main/archivo.json`
      )
    }, { quoted: m })
  }

  const info = parseGithubUrl(raw)
  if (!info) {
    return conn.sendMessage(m.chat, {
      text: decorar('Ese link de GitHub no es válido o no es compatible')
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    if (info.type === 'blob') {
      // 📄 Archivo único: se manda directo, sin comprimir
      await conn.sendMessage(m.chat, {
        text: decorar(`Descargando archivo...\n${info.rutaArchivo}`)
      }, { quoted: m })

      const buffer = await descargarArchivoUnico(info.owner, info.repo, info.branch, info.rutaArchivo)
      const nombreArchivo = info.rutaArchivo.split('/').pop()

      await conn.sendMessage(m.chat, {
        document: buffer,
        fileName: nombreArchivo,
        mimetype: 'application/octet-stream'
      }, { quoted: m })

    } else if (info.type === 'tree') {
      // 📁 Carpeta específica: se recorre y se comprime en un .zip
      await conn.sendMessage(m.chat, {
        text: decorar(`Descargando carpeta...\n${info.rutaArchivo}\nEsto puede tardar si tiene muchos archivos`)
      }, { quoted: m })

      const zipBuffer = await descargarCarpetaZip(info.owner, info.repo, info.branch, info.rutaArchivo)
      const nombreCarpeta = info.rutaArchivo.split('/').filter(Boolean).pop() || info.repo

      await conn.sendMessage(m.chat, {
        document: zipBuffer,
        fileName: `${nombreCarpeta}.zip`,
        mimetype: 'application/zip'
      }, { quoted: m })

    } else {
      // 📦 Repositorio completo
      const branch = info.branch || await obtenerBranchPorDefecto(info.owner, info.repo)

      await conn.sendMessage(m.chat, {
        text: decorar(`Descargando repositorio completo...\n${info.owner}/${info.repo} (${branch})`)
      }, { quoted: m })

      const zipBuffer = await descargarRepoZip(info.owner, info.repo, branch)

      await conn.sendMessage(m.chat, {
        document: zipBuffer,
        fileName: `${info.owner}-${info.repo}.zip`,
        mimetype: 'application/zip'
      }, { quoted: m })
    }

    await m.react('✅')

  } catch (e) {
    console.error('[GITCLONE ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: decorar(`Error: ${e.message}`)
    }, { quoted: m })
  }
}

handler.help = ['gitclone <url>']
handler.tags = ['tools', 'downloader']
handler.command = /^(gitclone|githubdl|ghclone)$/i
handler.desc = 'Descarga un repositorio, carpeta o archivo de GitHub'

export default handler
