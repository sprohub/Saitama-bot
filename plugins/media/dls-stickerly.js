/**
 * plugins/tools/stickerbt.js
 * Comando: .stickerbt
 *
 * Busca stickers en Stickerly por palabra clave y envía los primeros
 * 10 resultados directamente como stickers de WhatsApp.
 *
 * Uso:
 * .stickerbt meme
 * .stickerbt naruto
 * .stickerbt gato
 *
 * Usa la API pública de búsqueda de Stickerly (api.sticker.ly).
 * No requiere API key, pero al ser una API no oficial puede cambiar
 * o dejar de responder en cualquier momento — si eso pasa, revisa si
 * cambió la URL o el formato de respuesta.
 */

import fetch from 'node-fetch'

const STICKERLY_SEARCH_URL = 'https://api.sticker.ly/v4/stickerPack/search'
const MAX_STICKERS = 10

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

// Busca packs por palabra clave y devuelve una lista plana de URLs de stickers (.webp)
async function buscarStickers(keyword, limite) {
  const params = new URLSearchParams({
    keyword,
    limit: '10', // límite de PACKS a revisar, no de stickers individuales
    cursor: '',
    countryCode: 'US'
  })

  const resp = await fetch(`${STICKERLY_SEARCH_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'Stickerly/3.6.1 (Android)',
      'Accept': 'application/json'
    }
  })

  if (!resp.ok) {
    throw new Error(`Stickerly respondió con estado ${resp.status}`)
  }

  const data = await resp.json()
  const packs = data?.result?.stickerPacks || data?.stickerPacks || []

  if (!packs.length) return []

  const stickerUrls = []
  for (const pack of packs) {
    const stickers = pack.stickers || []
    for (const st of stickers) {
      // El campo exacto puede variar; probamos los más comunes
      const url = st.imageFile?.thumbnail || st.imageFile?.original || st.uri || st.stickerUrl
      if (url) stickerUrls.push(url)
      if (stickerUrls.length >= limite) return stickerUrls
    }
  }

  return stickerUrls
}

async function descargarBuffer(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`No se pudo descargar: ${url}`)
  const arrayBuffer = await resp.arrayBuffer()
  return Buffer.from(arrayBuffer)
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
    console.error('[stickerbt] ERROR buscando en Stickerly:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo conectar con Stickerly. Intenta de nuevo más tarde.')
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
      const buffer = await descargarBuffer(url)
      await conn.sendMessage(m.chat, { sticker: buffer }, { quoted: m })
      enviados++
      // Pequeña pausa para no saturar el envío
      await new Promise(res => setTimeout(res, 400))
    } catch (e) {
      console.error('[stickerbt] ERROR descargando/enviando sticker:', url, e)
      // Si uno falla, seguimos con los demás
    }
  }

  if (enviados === 0) {
    await conn.sendMessage(m.chat, {
      text: decorar('❌ Encontré resultados pero ninguno se pudo enviar. Intenta de nuevo.')
    }, { quoted: m })
  }
}

handler.command = ['stickerbt', 'stickerbuscar', 'stbt']
handler.help = ['stickerbt <palabra> (envía hasta 10 stickers relacionados)']
handler.tags = ['tools']

export default handler
