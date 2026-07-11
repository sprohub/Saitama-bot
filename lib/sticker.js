import { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))
const tmp = path.join(__dirname, '../tmp')
if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })

const MAX_INPUT_SIZE = 50 * 1024 * 1024

function run(cmd, timeoutMs = 60000) {
  return execAsync(cmd, { maxBuffer: 1024 * 1024 * 50, timeout: timeoutMs })
}

let stickerQueue = Promise.resolve()
function queueTask(fn) {
  const result = stickerQueue.then(fn, fn)
  stickerQueue = result.then(() => {}, () => {})
  return result
}

// 🔎 Detecta si un webp es animado buscando el chunk 'ANIM' en su cabecera RIFF.
// No usamos ffmpeg/ffprobe para esto porque su decodificador nativo de webp
// no soporta animación y falla al intentar leerlo.
function webpBufferIsAnimated(buffer) {
  return buffer.includes(Buffer.from('ANIM'))
}

async function addExif(webpSticker, packname, author, categories = ['']) {
  try {
    const img = new webp.Image()
    const json = {
      'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
      'sticker-pack-name': packname || 'SAITAMA BOT',
      'sticker-pack-publisher': author || 'SAITAMA',
      'emojis': categories
    }
    const exifAttr = Buffer.from([
      0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,
      0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,
      0x00,0x00,0x16,0x00,0x00,0x00
    ])
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8')
    const exif = Buffer.concat([exifAttr, jsonBuffer])
    exif.writeUIntLE(jsonBuffer.length, 14, 4)
    await img.load(webpSticker)
    img.exif = exif
    return await img.save(null)
  } catch (e) {
    console.error('[addExif error]', e.message)
    return webpSticker
  }
}

const scaleFilter = `scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,format=rgba`

async function stickerEstaticoRaw(buffer, packname, author) {
  const type = await fileTypeFromBuffer(buffer)
  if (!type || type.ext === 'bin') throw new Error('Tipo de archivo no soportado')

  const base = Date.now()
  const tmpIn  = path.join(tmp, `s_${base}.${type.ext}`)
  const tmpOut = path.join(tmp, `s_${base}_out.webp`)

  try {
    await fs.promises.writeFile(tmpIn, buffer)

    await run([
      'ffmpeg -y -nostdin -threads 3',
      `-i "${tmpIn}"`,
      '-vcodec libwebp',
      `-vf "${scaleFilter}"`,
      '-pix_fmt yuva420p',
      '-qscale:v 80',
      '-preset picture',
      `"${tmpOut}"`
    ].join(' '), 30000)

    const buf = await fs.promises.readFile(tmpOut)
    if (!buf || buf.length < 100) throw new Error('Webp estático inválido')
    return buf
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {})
    fs.promises.unlink(tmpOut).catch(() => {})
  }
}

async function stickerAnimadoRaw(buffer, packname, author) {
  const type = await fileTypeFromBuffer(buffer)
  if (!type || type.ext === 'bin') throw new Error('Tipo de archivo no soportado')

  const base = Date.now()
  const tmpIn  = path.join(tmp, `a_${base}.${type.ext}`)
  const tmpCut = path.join(tmp, `a_${base}_cut.${type.ext}`)
  const tmpOut = path.join(tmp, `a_${base}_out.webp`)

  try {
    await fs.promises.writeFile(tmpIn, buffer)

    const dur = 6

    let cutSource = tmpIn
    try {
      await run(
        `ffmpeg -y -nostdin -threads 3 -i "${tmpIn}" -t ${dur} -c copy -avoid_negative_ts make_zero "${tmpCut}"`,
        30000
      )
      const cutBuf = await fs.promises.readFile(tmpCut).catch(() => null)
      if (cutBuf && cutBuf.length >= 100) cutSource = tmpCut
    } catch (e) {
      console.error('[stickerAnimado] recorte rápido falló, probando recodificado:', e.message)
      try {
        await run(
          `ffmpeg -y -nostdin -threads 3 -i "${tmpIn}" -t ${dur} -an "${tmpCut}"`,
          60000
        )
        const cutBuf = await fs.promises.readFile(tmpCut).catch(() => null)
        if (cutBuf && cutBuf.length >= 100) cutSource = tmpCut
      } catch (e2) {
        console.error('[stickerAnimado] recorte recodificado también falló, uso original:', e2.message)
      }
    }

    const fps = 15

    const buildCmd = (fpsVal, qscale, compression, outPath) => [
      'ffmpeg -y -nostdin -threads 3',
      `-i "${cutSource}"`,
      `-t ${dur}`,
      '-an',
      '-vcodec libwebp',
      '-loop 0',
      `-vf "${scaleFilter},fps=${fpsVal}"`,
      '-pix_fmt yuva420p',
      `-qscale:v ${qscale}`,
      `-compression_level ${compression}`,
      '-preset default',
      `"${outPath}"`
    ].join(' ')

    const attempts = [
      { fps, q: 75, c: 5 },
      { fps, q: 60, c: 6 },
      { fps: 12, q: 55, c: 6 },
      { fps: 10, q: 45, c: 6 },
    ]

    let buf = null
    for (let i = 0; i < attempts.length; i++) {
      const { fps: fpsVal, q, c } = attempts[i]
      const out = i === 0 ? tmpOut : path.join(tmp, `a_${base}_v${i}.webp`)
      try {
        await run(buildCmd(fpsVal, q, c, out), 120000)
        const candidate = await fs.promises.readFile(out)
        if (candidate.length >= 100) {
          buf = candidate
          if (buf.length <= 500 * 1024) {
            if (out !== tmpOut) fs.promises.unlink(out).catch(() => {})
            break
          }
        }
      } catch (e) {
        console.error(`[stickerAnimado] intento ${i} falló:`, e.message)
      } finally {
        if (out !== tmpOut) fs.promises.unlink(out).catch(() => {})
      }
    }

    if (!buf) throw new Error([
      '╭━━⬣',
      '┃ No pude convertir ese video en sticker.',
      '┃ Intenta con uno más corto o liviano.',
      '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    ].join('\n'))
    return buf
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {})
    fs.promises.unlink(tmpCut).catch(() => {})
    fs.promises.unlink(tmpOut).catch(() => {})
  }
}

function stickerEstatico(buffer, packname, author) {
  return queueTask(() => stickerEstaticoRaw(buffer, packname, author))
}

function stickerAnimado(buffer, packname, author) {
  return queueTask(() => stickerAnimadoRaw(buffer, packname, author))
}

async function sticker(buffer, opts = {}) {
  if (!buffer || !buffer.length) throw new Error('Buffer vacío')
  if (buffer.length > MAX_INPUT_SIZE) throw new Error([
    '╭━━⬣',
    '┃ Ese archivo está muy pesado (máx 50MB).',
    '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
  ].join('\n'))

  const packname   = opts.packname   || global.packname || 'SAITAMA BOT'
  const author     = opts.author     || global.author   || 'SAITAMA'
  const categories = opts.categories || ['']

  const type = await fileTypeFromBuffer(buffer) || {}

  // 🩹 Si el archivo ya es un webp (sticker existente, animado o estático),
  // NO lo pasamos por ffmpeg: su decodificador nativo no soporta webp animado
  // y falla. En vez de eso, solo le refrescamos el EXIF y lo devolvemos tal cual.
  if (type.ext === 'webp') {
    return addExif(buffer, packname, author, categories)
  }

  const isAnimated = /video/i.test(type.mime) || type.mime === 'image/gif'

  const raw = isAnimated
    ? await stickerAnimado(buffer, packname, author)
    : await stickerEstatico(buffer, packname, author)

  return addExif(raw, packname, author, categories)
}

export { sticker, stickerAnimado, stickerEstatico, addExif, webpBufferIsAnimated }