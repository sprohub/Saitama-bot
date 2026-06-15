import gtts from 'node-gtts'
import fs from 'fs'
import path from 'path'
import os from 'os'

const VALID_LANGS = ['es', 'en', 'pt', 'fr', 'it', 'de', 'ja', 'ko', 'ru']
const MAX_LENGTH = 200

const box = (title, body) => `╭───────────────⬣
│  ${title}
╰───────────────⬣
${body}`

const handler = async (m, { conn, usedPrefix, command }) => {
  let text = m.text?.slice((usedPrefix + command).length).trim()

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: box('🎙️ TTS - Texto a Voz', `
│ Ingresa un texto para convertir a voz.
│
│ ❀ Uso: ${usedPrefix}${command} <texto>
│ ❀ Idioma: ${usedPrefix}${command} en: <texto>
│
│ Idiomas disponibles:
│ ${VALID_LANGS.join(', ')}
╰───────────────⬣`)
    }, { quoted: m })
  }

  // Detecta prefijo de idioma tipo "en: hello world"
  let lang = 'es'
  const langMatch = text.match(/^([a-z]{2}):\s*(.+)$/is)
  if (langMatch && VALID_LANGS.includes(langMatch[1].toLowerCase())) {
    lang = langMatch[1].toLowerCase()
    text = langMatch[2].trim()
  }

  if (text.length > MAX_LENGTH) {
    return conn.sendMessage(m.chat, {
      text: box('⚠️ Texto muy largo', `
│ El texto supera el límite de ${MAX_LENGTH} caracteres.
│ Tu texto tiene ${text.length} caracteres.
│
│ Por favor envía un texto más corto.
╰───────────────⬣`)
    }, { quoted: m })
  }

  let mp3Path = null

  try {
    const tts = gtts(lang)
    const tmpDir = os.tmpdir()
    mp3Path = path.join(tmpDir, `tts_${m.sender.split('@')[0]}_${Date.now()}.mp3`)

    await new Promise((resolve, reject) => {
      tts.save(mp3Path, text, (err) => err ? reject(err) : resolve())
    })

    const audioData = fs.readFileSync(mp3Path)
    await conn.sendMessage(
      m.chat,
      { audio: audioData, mimetype: 'audio/mpeg', ptt: false },
      { quoted: m }
    )
  } catch (e) {
    console.error(e)
    await conn.sendMessage(m.chat, {
      text: box('❌ Error', `
│ Ocurrió un error al generar la voz.
│ Verifica el idioma o intenta de nuevo.
╰───────────────⬣`)
    }, { quoted: m })
  } finally {
    if (mp3Path && fs.existsSync(mp3Path)) {
      try { fs.unlinkSync(mp3Path) } catch { }
    }
  }
}

handler.help = ['tts <texto>', 'tts en: <texto>']
handler.tags = ['tools']
handler.command = ['tts', 'voz']
handler.desc = '🎙️ Convierte texto en audio reproducible en WhatsApp 🌸'

export default handler
