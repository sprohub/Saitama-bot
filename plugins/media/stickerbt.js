/**
 * plugins/tools/stickerbt.js
 * Comando: .stickerbt
 *
 * Busca packs de stickers en Sticker.ly (vía API de delirius.store)
 * por palabra clave, descarga el primer pack encontrado y envía hasta
 * 10 stickers, renombrando el "pack name" de cada uno a SAITAMA-PACK.
 *
 * Uso:
 * .stickerbt my melody
 * .stickerbt meme
 *
 * APIs usadas (verificadas en vivo, respuesta confirmada):
 * - Búsqueda: https://api.delirius.store/search/stickerly?query=<texto>
 *   → { status, data: [ { name, author, url, ... } ] }
 * - Descarga: https://api.delirius.store/download/stickerly?url=<url_del_pack>
 *   → { status, data: { name, stickers: ["https://...png", ...] } }
 *
 * Los stickers de esta API llegan en .png, así que se convierten a
 * .webp con ffmpeg antes de enviarlos (WhatsApp solo acepta webp
 * para stickers). Se usa ffmpeg en vez de sharp/jimp porque es más
 * estable en Termux/Android y probablemente ya está instalado si el
 * bot tiene otros comandos de audio/video.
 */

import fetch from 'node-fetch'
import webpmux from 'node-webpmux'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

const SEARCH_URL = 'https://api.delirius.store/search/stickerly'
const DOWNLOAD_URL = 'https://api.delirius.store/download/stickerly'
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
  if (!data?.status) throw new Error('La API de búsqueda devolvió status false')
  return data.data || []
}

async function descargarPack(packUrl) {
  const url = `${DOWNLOAD_URL}?url=${encodeURIComponent(packUrl)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Descarga respondió estado ${resp.status}`)
  const data = await resp.json()
  if (!data?.status) throw new Error('La API de descarga devolvió status false')
  return data.data?.stickers || []
}

async function descargarBuffer(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`No se pudo descargar: ${url}`)
  const arrayBuffer = await resp.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Convierte un buffer de imagen (png/jpg) a webp usando ffmpeg
async function convertirAWebp(bufferImagen) {
  const tmpDir = os.tmpdir()
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const inputPath = path.join(tmpDir, `${id}_in.png`)
  const outputPath = path.join(tmpDir, `${id}_out.webp`)

  fs.writeFileSync(inputPath, bufferImagen)

  try {
    await execAsync(
      `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -lossless 0 -q:v 75 -preset picture -an -vsync 0 "${outputPath}"`
    )
    const bufferWebp = fs.readFileSync(outputPath)
    return bufferWebp
  } finally {
    // Limpieza de temporales, sin importar si falló o no
    try { fs.unlinkSync(inputPath) } catch {}
    try { fs.unlinkSync(outputPath) } catch {}
  }
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
      text: decorar(`Uso:\n.${command} <palabra>\n\nEjemplo:\n.${command} my melody`)
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

  let stickerUrls = []
  try {
    stickerUrls = await descargarPack(primerPack.url)
  } catch (e) {
    console.error('[stickerbt] ERROR descargando el pack:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo descargar el pack encontrado.')
    }, { quoted: m })
  }

  if (!stickerUrls.length) {
    return conn.sendMessage(m.chat, {
      text: decorar('😕 El pack no tiene stickers disponibles.')
    }, { quoted: m })
  }

  let enviados = 0
  for (const url of stickerUrls.slice(0, MAX_STICKERS)) {
    try {
      const bufferOriginal = await descargarBuffer(url)
      const bufferWebp = await convertirAWebp(bufferOriginal)
      const bufferFinal = await renombrarPack(bufferWebp, PACK_NAME, AUTHOR_NAME)
      await conn.sendMessage(m.chat, { sticker: bufferFinal }, { quoted: m })
      enviados++
      await new Promise(res => setTimeout(res, 400))
    } catch (e) {
      console.error('[stickerbt] ERROR procesando sticker:', url, e)
    }
  }

  if (enviados === 0) {
    await conn.sendMessage(m.chat, {
      text: decorar('❌ Encontré el pack pero ningún sticker se pudo enviar. Revisa que ffmpeg esté instalado.')
    }, { quoted: m })
  }
}

handler.command = ['stickerbt', 'stickerbuscar', 'stbt']
handler.help = ['stickerbt <palabra> (busca en Sticker.ly y envía hasta 10 stickers como SAITAMA-PACK)']
handler.tags = ['tools']

export default handler
