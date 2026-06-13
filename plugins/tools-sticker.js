import { spawn } from 'child_process'
import webp from 'node-webpmux'
import crypto from 'crypto'

async function toWebp(buffer, isVideo = false) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-i', 'pipe:0',
      '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15',
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-qscale', '50',
      '-loop', '0',
      '-preset', 'default',
      '-vsync', '0',
    ]
    if (!isVideo) args.push('-an')   // sin audio en imágenes
    args.push('-f', 'webp', 'pipe:1')

    const ff = spawn('ffmpeg', args)
    let bufs = []
    ff.stdout.on('data', d => bufs.push(d))
    ff.on('close', code => {
      if (code !== 0) return reject(new Error('ffmpeg error ' + code))
      resolve(Buffer.concat(bufs))
    })
    ff.on('error', reject)
    ff.stdin.write(buffer)
    ff.stdin.end()
  })
}

async function addExif(webpBuf, packname, author) {
  const img = new webp.Image()
  const id = crypto.randomBytes(32).toString('hex')
  const json = {
    'sticker-pack-id': id,
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    'emojis': ['⚡']
  }
  const exifAttr = Buffer.from([
    0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,
    0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,
    0x00,0x00,0x16,0x00,0x00,0x00
  ])
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  const exif = Buffer.concat([exifAttr, jsonBuf])
  exif.writeUIntLE(jsonBuf.length, 14, 4)
  await img.load(webpBuf)
  img.exif = exif
  return await img.save(null)
}

let handler = async (m, { conn }) => {
  let isMedia = m.msg?.mimetype
  let isQuotedMedia = m.quoted?.msg?.mimetype

  if (!isMedia && !isQuotedMedia) {
    return conn.sendMessage(m.chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        '│ 📸 *¿Cómo crear un sticker?*\n' +
        '│\n' +
        '│ *Modo 1 — Imagen con caption:*\n' +
        '│  1. Selecciona una imagen\n' +
        '│  2. En el caption escribe *.crs*\n' +
        '│  3. Envía ✅\n' +
        '│\n' +
        '│ *Modo 2 — Citar imagen/video/gif:*\n' +
        '│  1. Cita cualquier imagen o video\n' +
        '│  2. Escribe *.crs* y envía ✅\n' +
        '│\n' +
        '│ ⚠️ _Imágenes, videos y GIFs_\n' +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    let media
    let mime = ''

    if (isQuotedMedia) {
      mime = m.quoted.msg.mimetype
      media = await conn.downloadM(
        m.quoted.mediaMessage[m.quoted.mediaType],
        m.quoted.mediaType.replace(/message/i, '')
      )
    } else {
      mime = m.msg.mimetype
      media = await conn.downloadM(
        m.mediaMessage[m.mediaType],
        m.mediaType.replace(/message/i, '')
      )
    }

    const isVideo = /video/.test(mime)
    let webpBuf = await toWebp(media, isVideo)
    webpBuf = await addExif(webpBuf, 'SAITAMA-BOT', 'by SPROH')

    await conn.sendMessage(m.chat, { sticker: webpBuf }, { quoted: m })
    await m.react('✅')

  } catch (e) {
    console.error('[tools-sticker]', e)
    await m.react('❌')
    conn.sendMessage(m.chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        '│ ❌ Error al crear el sticker.\n' +
        '│ _Envía una imagen o video válido._\n' +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }
}

handler.help = ['crs']
handler.tags = ['tools']
handler.command = /^(crs)$/i
handler.desc = 'Convierte imagen/video/gif en sticker — SAITAMA-BOT'

export default handler
