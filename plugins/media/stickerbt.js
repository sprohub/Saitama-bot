/**
 * plugins/tools/stickerbt.js
 * Comando: .stickerbt
 *
 * Busca stickers en GIPHY (API oficial, documentada y estable) por
 * palabra clave y envía hasta 10 resultados como stickers de
 * WhatsApp, renombrando el pack de cada uno a SAITAMA-PACK.
 *
 * Uso:
 * .stickerbt meme
 * .stickerbt gato
 * .stickerbt naruto
 *
 * CONFIGURACIÓN REQUERIDA:
 * Consigue tu propia API key gratis en https://developers.giphy.com/dashboard/
 * y reemplaza GIPHY_API_KEY abajo. La key de ejemplo que trae este
 * archivo es la key pública de pruebas de GIPHY (documentada en su
 * propia web) y tiene límite de peticiones muy bajo — no la dejes
 * puesta en producción.
 *
 * Doc oficial del endpoint: https://developers.giphy.com/docs/api/endpoint#search-stickers
 */

import fetch from 'node-fetch'
import webpmux from 'node-webpmux'

const GIPHY_API_KEY = 'dc6zaTOxFJmzC' // 👈 reemplaza por tu key real
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/stickers/search'
const MAX_STICKERS = 10
const PACK_NAME = 'SAITAMA-PACK'
const AUTHOR_NAME = 'SAITAMA-BOT'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

async function buscarStickers(query, limite) {
  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    q: query,
    limit: String(limite),
    rating: 'pg-13',
    lang: 'es'
  })

  const resp = await fetch(`${GIPHY_SEARCH_URL}?${params.toString()}`)
  if (!resp.ok) {
    throw new Error(`GIPHY respondió con estado ${resp.status}`)
  }

  const data = await resp.json()
  const items = data?.data || []

  // Cada item trae images.original.webp — documentado y estable
  return items
    .map(item => item?.images?.original?.webp)
    .filter(Boolean)
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
      text: decorar(`Uso:\n.${command} <palabra>\n\nEjemplo:\n.${command} meme`)
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, {
    text: decorar(`🔎 Buscando stickers de "${keyword}"...`)
  }, { quoted: m })

  let urls = []
  try {
    urls = await buscarStickers(keyword, MAX_STICKERS)
  } catch (e) {
    console.error('[stickerbt] ERROR buscando en GIPHY:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo conectar con GIPHY. Revisa tu API key o intenta más tarde.')
    }, { quoted: m })
  }

  if (!urls.length) {
    return conn.sendMessage(m.chat, {
      text: decorar(`😕 No encontré stickers para "${keyword}". Prueba con otra palabra.`)
    }, { quoted: m })
  }

  let enviados = 0
  for (const url of urls) {
    try {
      const bufferOriginal = await descargarBuffer(url)
      const bufferRenombrado = await renombrarPack(bufferOriginal, PACK_NAME, AUTHOR_NAME)
      await conn.sendMessage(m.chat, { sticker: bufferRenombrado }, { quoted: m })
      enviados++
      await new Promise(res => setTimeout(res, 400))
    } catch (e) {
      console.error('[stickerbt] ERROR procesando sticker:', url, e)
    }
  }

  if (enviados === 0) {
    await conn.sendMessage(m.chat, {
      text: decorar('❌ Encontré resultados pero ninguno se pudo enviar como sticker.')
    }, { quoted: m })
  }
}

handler.command = ['stickerbt', 'stickerbuscar', 'stbt']
handler.help = ['stickerbt <palabra> (busca en GIPHY y envía hasta 10 stickers como SAITAMA-PACK)']
handler.tags = ['tools']

export default handler
