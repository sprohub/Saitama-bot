import { fixGifFromBuffer } from '../../lib/gifFix.js'

let handler = async (m, { conn }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''
  const isVideo = /video/.test(mime)

  if (!isVideo) {
    return conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ 🎬 *¿Cómo convertir video a GIF?*
│
│ 1. Cita un video corto
│ 2. Escribe el comando y envía ✅
│
│ ⚠️ _Recomendado: videos de menos de 10 segundos_
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, {
    text: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ ⏳ _Convirtiendo video a GIF..._
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
  }, { quoted: m })

  try {
    const buffer = await quoted.download()

    // fixGifFromBuffer re-codifica el video a un mp4/gif-playback
    // compatible con WhatsApp, incluso si el original viene dañado
    // o con un formato/codec no soportado.
    const gifBuffer = await fixGifFromBuffer(buffer)

    await conn.sendMessage(m.chat, {
      video: gifBuffer,
      gifPlayback: true,
      caption: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ ✅ _GIF creado con éxito_
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ ❌ _Ocurrió un error al convertir el video_
│ 🔁 Intenta con un video más corto
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  }
}

handler.help = ['togif', 'tovideo2gif']
handler.tags = ['tools']
handler.command = /^to?gif$/i

export default handler
