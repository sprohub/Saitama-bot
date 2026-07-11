import QRCode from 'qrcode'
import FormData from 'form-data'
import fetch from 'node-fetch'

// Sube el archivo a catbox.moe y devuelve el link público
async function subirACatbox(buffer, filename) {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', buffer, { filename })

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  })

  const text = await res.text()
  if (!text.startsWith('https://')) {
    throw new Error('catbox.moe no devolvió un link válido: ' + text)
  }
  return text.trim()
}

function extensionPorMime(mime = '') {
  if (/apk/i.test(mime)) return 'apk'
  if (/pdf/i.test(mime)) return 'pdf'
  if (/mp4/i.test(mime)) return 'mp4'
  if (/mpeg|mp3/i.test(mime)) return 'mp3'
  if (/ogg/i.test(mime)) return 'ogg'
  if (/png/i.test(mime)) return 'png'
  if (/jpe?g/i.test(mime)) return 'jpg'
  if (/webp/i.test(mime)) return 'webp'
  return 'bin'
}

const handler = async (m, { conn, text }) => {
  const quoted = m.quoted ? m.quoted : null
  const tieneArchivo = quoted && (quoted.mimetype || quoted.msg?.mimetype)
  const contenidoTexto = (text || '').trim()

  if (!tieneArchivo && !contenidoTexto) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Uso:\n` +
      `│ • *.cqr <texto o link>*\n` +
      `│ • *.cqr* citando un archivo (apk, audio,\n` +
      `│   video, imagen, documento, etc.)\n` +
      `╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🍃 Generando código QR...\n` +
    `╰───────────────⬣`
  )

  try {
    let contenidoQR
    let caption

    if (tieneArchivo) {
      const mime = quoted.mimetype || quoted.msg?.mimetype || ''
      const buffer = await quoted.download()
      if (!buffer || !buffer.length) throw new Error('No se pudo descargar el archivo')

      const ext = extensionPorMime(mime)
      const filename = `saitama_${Date.now()}.${ext}`

      const link = await subirACatbox(buffer, filename)
      contenidoQR = link
      caption =
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ QR generado para tu archivo\n` +
        `│ 🔗 ${link}\n` +
        `╰───────────────⬣`
    } else {
      contenidoQR = contenidoTexto
      caption =
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ QR generado para tu texto\n` +
        `╰───────────────⬣`
    }

    const qrBuffer = await QRCode.toBuffer(contenidoQR, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#1a5c1a', light: '#ffffff' }
    })

    await conn.sendMessage(m.chat, {
      image: qrBuffer,
      caption
    }, { quoted: m })

  } catch (e) {
    console.log('[cqr] error:', e)
    await m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ ❌ ${e.message || 'Error al generar el QR.'}\n` +
      `╰───────────────⬣`
    )
  }
}

handler.command = ['cqr']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['cqr <texto/archivo>']
handler.desc = 'Crea un código QR de un texto, link o archivo (apk, audio, video, etc.)'

export default handler