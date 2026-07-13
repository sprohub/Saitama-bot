/**
 * plugins/tools/stickerbt.js
 * Comando: .stickerbt
 *
 * Busca packs de stickers en stickers.wiki (vía API de delirius.store)
 * por palabra clave, descarga el primer pack encontrado y envía hasta
 * 10 stickers, renombrando el "pack name" de cada uno a SAITAMA-PACK.
 *
 * Uso:
 * .stickerbt itzy
 * .stickerbt meme
 *
 * APIs usadas:
 * - Búsqueda:  https://api.delirius.store/search/stickerwiki?query=<texto>
 * - Descarga:  https://api.delirius.store/download/stickerwiki?url=<url_del_pack>
 *
 * Nota: son APIs públicas no oficiales de terceros. Si dejan de
 * responder o cambian el formato de la respuesta, revisa con un
 * console.log(JSON.stringify(data)) qué estructura están devolviendo
 * ahora y ajusta los accesos a campos marcados abajo.
 */

import fetch from 'node-fetch'
import webpmux from 'node-webpmux'

const SEARCH_URL = 'https://api.delirius.store/search/stickerwiki'
const DOWNLOAD_URL = 'https://api.delirius.store/download/stickerwiki'
const MAX_STICKERS = 10
const PACK_NAME = 'SAITAMA-PACK'
const AUTHOR_NAME = 'SAITAMA-BOT'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

async function buscarPacks(query) {
  const url = `${SEARCH_URL}?query=${encodeURIComponent(query)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Búsqueda respondió estado ${resp.status}`)
  const data = await resp.json()
  // Ajusta este acceso si la API cambia la forma de la respuesta
  const resultados = data?.data || data?.result || data?.results || []
  return resultados
}

async function descargarPack(packUrl) {
  const url = `${DOWNLOAD_URL}?url=${encodeURIComponent(packUrl)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Descarga respondió estado ${resp.status}`)
  const data = await resp.json()
  // Ajusta este acceso si la API cambia la forma de la respuesta
  const stickers = data?.data?.stickers || data?.data?.images || data?.result?.stickers || data?.stickers || []
  return stickers
}

async function descargarBuffer(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`No se pudo descargar: ${url}`)
  const arrayBuffer = await resp.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Escribe el nombre de pack / autor en el EXIF del webp
async function renombrarPack(bufferWebp, packname, author) {
  const img = new webpmux.Image()
  await img.load(bufferWebp)

  const exif = {
    'sticker-pack-id': `saitama-${Date.now()}`,
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    'emojis': ['🌿']
  }

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const jsonBuffer = Buffer.from(JSON.stringify(exif), 'utf8')
  const exifData = Buffer.concat([exifAttr, jsonBuffer])
  exifData.writeUIntLE(jsonBuffer.length, 14, 4)

  img.exif = exifData
  return img.save(null)
}

const handler = async function (m, { conn, text, command }) {
  const keyword = (text || '').trim()

  if (!keyword) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Uso:\n.${command} <palabra>\n\nEjemplo:\n.${command} itzy`)
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, {
    text: decorar(`🔎 Buscando packs de "${keyword}"...`)
  }, { quoted: m })

  let packs = []
  try {
    packs = await buscarPacks(keyword)
  } catch (e) {
    console.error('[stickerbt] ERROR buscando packs:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo conectar con la API de búsqueda. Intenta más tarde.')
    }, { quoted: m })
  }

  if (!packs.length) {
    return conn.sendMessage(m.chat, {
      text: decorar(`😕 No encontré packs para "${keyword}". Prueba con otra palabra.`)
    }, { quoted: m })
  }

  const primerPack = packs[0]
  const packUrl = primerPack.url || primerPack.link || primerPack.href

  if (!packUrl) {
    console.error('[stickerbt] El resultado no trae URL de pack:', primerPack)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ Encontré resultados pero no pude obtener el link del pack.')
    }, { quoted: m })
  }

  let stickers = []
  try {
    stickers = await descargarPack(packUrl)
  } catch (e) {
    console.error('[stickerbt] ERROR descargando el pack:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo descargar el pack encontrado.')
    }, { quoted: m })
  }

  if (!stickers.length) {
    return conn.sendMessage(m.chat, {
      text: decorar('😕 El pack no tiene stickers disponibles.')
    }, { quoted: m })
  }

  let enviados = 0
  for (const st of stickers.slice(0, MAX_STICKERS)) {
    const stickerUrl = typeof st === 'string' ? st : (st.url || st.image || st.src)
    if (!stickerUrl) continue

    try {
      const bufferOriginal = await descargarBuffer(stickerUrl)
      const bufferRenombrado = await renombrarPack(bufferOriginal, PACK_NAME, AUTHOR_NAME)
      await conn.sendMessage(m.chat, { sticker: bufferRenombrado }, { quoted: m })
      enviados++
      await new Promise(res => setTimeout(res, 400))
    } catch (e) {
      console.error('[stickerbt] ERROR procesando sticker:', stickerUrl, e)
    }
  }

  if (enviados === 0) {
    await conn.sendMessage(m.chat, {
      text: decorar('❌ Encontré el pack pero ningún sticker se pudo enviar.')
    }, { quoted: m })
  }
}

handler.command = ['stickerbt', 'stickerbuscar', 'stbt']
handler.help = ['stickerbt <palabra> (busca un pack y envía hasta 10 stickers como SAITAMA-PACK)']
handler.tags = ['tools']

export default handler
