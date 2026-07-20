import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

const execPromise = promisify(exec)

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

  const waitMsg = await conn.sendMessage(m.chat, {
    text: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ ⏳ _Convirtiendo video a GIF..._
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
  }, { quoted: m })

  const tempIn = path.join(tmpdir(), `vid_${Date.now()}.mp4`)
  const tempOut = path.join(tmpdir(), `gif_${Date.now()}.gif`)

  try {
    const buffer = await quoted.download()
    fs.writeFileSync(tempIn, buffer)

    // Genera paleta de colores para mejor calidad, luego convierte a gif
    await execPromise(
      `ffmpeg -i "${tempIn}" -vf "fps=15,scale=320:-1:flags=lanczos" -y "${tempOut}"`
    )

    const gifBuffer = fs.readFileSync(tempOut)

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
    console.error(e)
    await conn.sendMessage(m.chat, {
      text: `╭━━⬣ *SAITAMA-BOT* ⚡
│
│ ❌ _Ocurrió un error al convertir el video_
│ 🔁 Intenta con un video más corto
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
  } finally {
    // Limpieza de archivos temporales
    if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn)
    if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut)
  }
}

handler.help = ['togif', 'tovideo2gif']
handler.tags = ['tools']
handler.command = /^to?gif$/i

export default handler