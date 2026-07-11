import { addSticker } from '../../lib/stickerpack.js'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

function convertToWebp(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(512-iw)/2:(512-ih)/2:color=#00000000",
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-compression_level', '6',
      '-q:v', '80',
      outputPath
    ]

    const proc = spawn('ffmpeg', args)
    let stderr = ''
    proc.stderr.on('data', d => (stderr += d.toString()))
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg salió con código ${code}: ${stderr}`))
    })
    proc.on('error', reject)
  })
}

const handler = async (m, { conn, text }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = quoted.mimetype || quoted.msg?.mimetype || ''
  const name = (text || '').trim().toLowerCase()

  if (!name) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes poner un nombre para el sticker.\n` +
      `│ Ejemplo: *.stsubir goku*\n` +
      `│ (citando una imagen o sticker)\n` +
      `╰───────────────⬣`
    )
  }

  if (!/image\/(jpe?g|png)|webp/i.test(mime)) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes citar una *imagen* o *sticker*\n` +
      `│ junto con *.stsubir ${name}*.\n` +
      `╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🍃 Guardando sticker *${name}*...\n` +
    `╰───────────────⬣`
  )

  const tmpIn = path.join(os.tmpdir(), `st_in_${Date.now()}.${/png/i.test(mime) ? 'png' : /webp/i.test(mime) ? 'webp' : 'jpg'}`)
  const tmpOut = path.join(os.tmpdir(), `st_out_${Date.now()}.webp`)

  try {
    const buffer = await quoted.download()
    if (!buffer || !buffer.length) throw new Error('Buffer vacío')

    fs.writeFileSync(tmpIn, buffer)
    await convertToWebp(tmpIn, tmpOut)

    const webpBuffer = fs.readFileSync(tmpOut)
    addSticker(name, webpBuffer, { owner: m.sender, chat: m.chat })

    await conn.sendMessage(m.chat, {
      text:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ Sticker guardado como *${name}*\n` +
        `│ 🍃 Usa *.stlist* para verlo\n` +
        `╰───────────────⬣`
    }, { quoted: m })
  } catch (e) {
    console.log('[stsubir] error:', e)
    await m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ ❌ Error al guardar el sticker.\n` +
      `╰───────────────⬣`
    )
  } finally {
    try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn) } catch {}
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut) } catch {}
  }
}

handler.command = ['stsubir']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['stsubir <nombre>']
handler.desc = 'Sube un sticker al pack (cita una imagen o sticker)'
handler.owner = true

export default handler