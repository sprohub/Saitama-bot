/**
 * plugins/tools/stickerbt.js
 * Comando: .stickerbt
 *
 * Busca packs de stickers en Sticker.ly (vía API de delirius.store)
 * por palabra clave, muestra hasta 10 resultados en un menú de
 * botones, y al elegir uno descarga y envía sus stickers (hasta 10),
 * renombrando el "pack name" de cada uno a SAITAMA-PACK.
 *
 * Uso:
 * .stickerbt my melody
 * .stickerbt meme
 *
 * APIs usadas (verificadas en vivo, respuesta confirmada):
 * - Búsqueda: https://api.delirius.store/search/stickerly?query=<texto>
 *   → { status, data: [ { name, author, url, sticker_count, preview, ... } ] }
 * - Descarga: https://api.delirius.store/download/stickerly?url=<url_del_pack>
 *   → { status, data: { name, stickers: ["https://...png", ...] } }
 *
 * Los stickers de esta API llegan en .png, así que se convierten a
 * .webp con ffmpeg antes de enviarlos (WhatsApp solo acepta webp
 * para stickers).
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import fetch from 'node-fetch'
import webpmux from 'node-webpmux'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

const SEARCH_URL = 'https://api.delirius.online/search/stickerly'
const DOWNLOAD_URL = 'https://api.delirius.online/download/stickerly'
const MAX_STICKERS = 10
const MAX_RESULTADOS = 10
const PACK_NAME = 'SAITAMA-PACK'
const AUTHOR_NAME = 'SAITAMA-BOT'

global.__stickerbtPending = global.__stickerbtPending || {}

function limpiarPendientesVencidos() {
  const ahora = Date.now()
  for (const key of Object.keys(global.__stickerbtPending)) {
    if (ahora - global.__stickerbtPending[key].timestamp > 5 * 60 * 1000) {
      delete global.__stickerbtPending[key]
    }
  }
}

function unwrapMessage(message) {
  if (!message) return message
  if (message.ephemeralMessage) return unwrapMessage(message.ephemeralMessage.message)
  if (message.viewOnceMessage) return unwrapMessage(message.viewOnceMessage.message)
  if (message.viewOnceMessageV2) return unwrapMessage(message.viewOnceMessageV2.message)
  return message
}

function extractSelectedId(content) {
  const msg = unwrapMessage(content.message)
  const interactive = msg?.interactiveResponseMessage
  if (!interactive) return null
  try {
    const params = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson)
    return params.id || null
  } catch {
    return null
  }
}

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
    return fs.readFileSync(outputPath)
  } finally {
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

async function enviarStickersDelPack(conn, m, packUrl) {
  let stickerUrls = []
  try {
    stickerUrls = await descargarPack(packUrl)
  } catch (e) {
    console.error('[stickerbt] ERROR descargando el pack:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo descargar el pack elegido.')
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

const handler = async function (m, { conn, text, command }) {
  limpiarPendientesVencidos()

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

  const resultados = packs.slice(0, MAX_RESULTADOS)
  const sessionId = `stbt_${m.sender}_${Date.now()}`

  global.__stickerbtPending[sessionId] = {
    resultados,
    sender: m.sender,
    timestamp: Date.now()
  }

  const rows = resultados.map((pack, i) => ({
    title: (pack.name || 'Sin nombre').trim().slice(0, 60),
    description: `${pack.author || 'desconocido'} · ${pack.sticker_count ?? '?'} stickers${pack.isAnimated ? ' · animado' : ''}`,
    id: `stbt_dl|${sessionId}|${i}`
  }))

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT · Buscar Stickers',
      subtitle: `Resultados para "${keyword}"`,
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: decorar('Elige un pack para recibir sus stickers 👇')
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🎀 Elegir pack',
          sections: [{ title: `${rows.length} packs encontrados`, rows }]
        })
      }]
    })
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { interactiveMessage } }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['stickerbt', 'stickerbuscar', 'stbt']
handler.help = ['stickerbt <palabra> (busca en Sticker.ly y envía hasta 10 stickers como SAITAMA-PACK)']
handler.tags = ['tools']

handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId || !selectedId.startsWith('stbt_dl|')) return false

  const [, sessionId, indexStr] = selectedId.split('|')
  const session = global.__stickerbtPending[sessionId]

  if (!session) {
    await conn.sendMessage(m.chat, { text: decorar('⌛ Esta sesión expiró. Vuelve a usar .stickerbt.') }, { quoted: m })
    return true
  }

  if (m.sender !== session.sender) {
    await conn.sendMessage(m.chat, { text: decorar('❌ Solo quien hizo la búsqueda puede elegir el pack.') }, { quoted: m })
    return true
  }

  const pack = session.resultados[Number(indexStr)]
  if (!pack) {
    await conn.sendMessage(m.chat, { text: decorar('❌ No encontré ese resultado, intenta buscar de nuevo.') }, { quoted: m })
    return true
  }

  await conn.sendMessage(m.chat, {
    text: decorar(`🛠️ Descargando "${pack.name?.trim() || 'pack'}"...`)
  }, { quoted: m })

  await enviarStickersDelPack(conn, m, pack.url)

  delete global.__stickerbtPending[sessionId]
  return true
}

export default handler
