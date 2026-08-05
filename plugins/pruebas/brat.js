import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import WebP from 'node-webpmux'

const STICKER_PACK_NAME   = 'SAITAMA-BOT'
const STICKER_PACK_AUTHOR = 'Sprohub'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const API_BASE = 'https://api.delirius.online/canvas'

// Endpoints disponibles:
//   brat       -> imagen estática "brat" clásico
//   bratanime  -> imagen estática estilo anime
//   bratvideo  -> video/gif animado estilo "brat"
const ENDPOINTS = {
  normal: `${API_BASE}/brat`,
  anime:  `${API_BASE}/bratanime`,
  video:  `${API_BASE}/bratvideo`
}

function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) } catch {}
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    ff.stderr.on('data', d => { stderr += d.toString() })
    ff.on('error', reject)
    ff.on('close', code => {
      if (code === 0) resolve(true)
      else reject(new Error('ffmpeg falló: ' + stderr.slice(-400)))
    })
  })
}

async function fetchMediaBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`La API respondió ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (!buffer.length) throw new Error('La API devolvió un archivo vacío')
  return buffer
}

// Convierte una imagen (png/jpg) en sticker webp estático 512x512
async function imageToStaticSticker(inputPath, outPath) {
  const args = [
    '-y',
    '-i', inputPath,
    '-vf', 'scale=512:512:flags=lanczos,format=rgba',
    '-c:v', 'libwebp',
    '-lossless', '0',
    '-quality', '90',
    outPath
  ]
  await runFfmpeg(args)
}

// Convierte un video/gif en sticker webp animado 512x512
async function videoToAnimatedSticker(inputPath, outPath) {
  const args = [
    '-y',
    '-i', inputPath,
    '-vf', 'fps=12,scale=512:512:flags=lanczos,format=rgba',
    '-loop', '0',
    '-preset', 'default',
    '-an', '-vsync', '0',
    '-c:v', 'libwebp',
    outPath
  ]
  await runFfmpeg(args)
}

async function writeExif(webpBuffer, packname, author) {
  const img = new WebP.Image()
  await img.load(webpBuffer)

  const json = {
    'sticker-pack-id': `saitama-bot-${Date.now()}`,
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    emojis: ['🎨']
  }
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8')
  const exif = Buffer.concat([exifAttr, jsonBuffer])
  exif.writeUIntLE(jsonBuffer.length, 14, 4)

  img.exif = exif
  return img.save(null)
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const raw = text?.trim()
  if (!raw) {
    return conn.sendMessage(m.chat, {
      text: `🟢 *BRAT GENERATOR*\n\n> ${usedPrefix}${command} <texto>\n> Ejemplo: ${usedPrefix}${command} hola mundo\n\n🍃 Estilo anime:\n> ${usedPrefix}${command} hola mundo anime\n\n🎬 Animado:\n> ${usedPrefix}${command} hola mundo video`
    }, { quoted: m })
  }

  // Detecta el modo según palabras clave al final del texto
  let mode = 'normal'
  let cleanInput = raw
  if (/\b(anime)\b/i.test(raw)) {
    mode = 'anime'
    cleanInput = raw.replace(/\b(anime)\b/i, '').trim()
  } else if (/\b(video|an[ií]mate|animado)\b/i.test(raw)) {
    mode = 'video'
    cleanInput = raw.replace(/\b(video|an[ií]mate|animado)\b/i, '').trim()
  }

  if (!cleanInput) {
    return conn.sendMessage(m.chat, {
      text: `❌ Escribe un texto antes de la palabra clave.\n> Ejemplo: ${usedPrefix}${command} hola mundo ${mode === 'anime' ? 'anime' : 'video'}`
    }, { quoted: m })
  }

  await m.react('🎨')

  const apiUrl = `${ENDPOINTS[mode]}?text=${encodeURIComponent(cleanInput)}`
  const isVideoMode = mode === 'video'

  const inputPath = path.join(TEMP_DIR, `brat_in_${Date.now()}.${isVideoMode ? 'mp4' : 'png'}`)
  const stickerPath = path.join(TEMP_DIR, `brat_out_${Date.now()}.webp`)

  try {
    const mediaBuffer = await fetchMediaBuffer(apiUrl)
    fs.writeFileSync(inputPath, mediaBuffer)

    if (isVideoMode) {
      await videoToAnimatedSticker(inputPath, stickerPath)
    } else {
      await imageToStaticSticker(inputPath, stickerPath)
    }

    const rawSticker = fs.readFileSync(stickerPath)
    const finalSticker = await writeExif(rawSticker, STICKER_PACK_NAME, STICKER_PACK_AUTHOR)

    await conn.sendMessage(m.chat, { sticker: finalSticker }, { quoted: m })
    await m.react('✅')
  } catch (e) {
    console.error('[BRAT ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `❌ No se pudo generar el sticker.\n${e.message}`
    }, { quoted: m })
  } finally {
    deleteFileSafe(inputPath)
    deleteFileSafe(stickerPath)
  }
}

handler.help    = ['brat <texto>', 'brat <texto> anime', 'brat <texto> video']
handler.tags    = ['tools', 'sticker']
handler.command = /^(brat)$/i
handler.desc    = 'Genera un sticker "brat" (clásico, anime o animado) usando la API de Delirius'

export default handler
