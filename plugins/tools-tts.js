import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import fs from 'fs'
import path from 'path'
import os from 'os'

const MAX_LENGTH = 200

// 5 voces de muestra (puedes agregar más)
const VOICES = {
  '1': { id: 'es-ES-ElviraNeural', name: 'Elvira (Español, Femenina)' },
  '2': { id: 'es-MX-DaliaNeural', name: 'Dalia (Español MX, Femenina)' },
  '3': { id: 'en-US-AriaNeural', name: 'Aria (Inglés, Femenina)' },
  '4': { id: 'en-US-GuyNeural', name: 'Guy (Inglés, Masculino)' },
  '5': { id: 'ja-JP-NanamiNeural', name: 'Nanami (Japonés, Femenina)' }
}

// 5 idiomas con voz por defecto
const LANGS = {
  es: { name: 'Español', voice: 'es-ES-ElviraNeural' },
  en: { name: 'English', voice: 'en-US-AriaNeural' },
  pt: { name: 'Português', voice: 'pt-BR-FranciscaNeural' },
  fr: { name: 'Français', voice: 'fr-FR-DeniseNeural' },
  ja: { name: '日本語', voice: 'ja-JP-NanamiNeural' }
}

const DEFAULT_VOICE = 'es-ES-ElviraNeural'

const box = (title, body) => `╭───────────────⬣
│  ${title}
╰───────────────⬣
${body}`

const handler = async (m, { conn, usedPrefix, command, text: rawText }) => {
  let text = rawText?.trim()

  // .tts lista -> mostrar voces
  if (text?.toLowerCase() === 'lista') {
    const list = Object.entries(VOICES)
      .map(([k, v]) => `│ ${k}. ${v.name}`)
      .join('\n')
    return conn.sendMessage(m.chat, {
      text: box('🎙️ Voces Disponibles', `
│ Usa: ${usedPrefix}${command} voz:<número> <texto>
│
${list}
╰───────────────⬣`)
    }, { quoted: m })
  }

  // .tts idioma -> mostrar idiomas
  if (text?.toLowerCase() === 'idioma') {
    const list = Object.entries(LANGS)
      .map(([k, v]) => `│ ${k} - ${v.name}`)
      .join('\n')
    return conn.sendMessage(m.chat, {
      text: box('🌐 Idiomas Disponibles', `
│ Usa: ${usedPrefix}${command} <idioma>:<texto>
│
${list}
╰───────────────⬣`)
    }, { quoted: m })
  }

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: box('🎙️ TTS - Texto a Voz', `
│ Ingresa un texto para convertir a voz.
│
│ ❀ Uso: ${usedPrefix}${command} <texto>
│ ❀ Idioma: ${usedPrefix}${command} <idioma>:<texto>
│ ❀ Voz: ${usedPrefix}${command} voz:<número> <texto>
│ ❀ Lista de voces: ${usedPrefix}${command} lista
│ ❀ Lista de idiomas: ${usedPrefix}${command} idioma
╰───────────────⬣`)
    }, { quoted: m })
  }

  // Detectar voz: "voz:1 hola mundo"
  let voice = DEFAULT_VOICE
  const voiceMatch = text.match(/^voz:(\d)\s*(.+)$/is)
  if (voiceMatch && VOICES[voiceMatch[1]]) {
    voice = VOICES[voiceMatch[1]].id
    text = voiceMatch[2].trim()
  } else {
    // Detectar idioma: "en: hello world"
    const langMatch = text.match(/^([a-z]{2}):\s*(.+)$/is)
    if (langMatch && LANGS[langMatch[1].toLowerCase()]) {
      voice = LANGS[langMatch[1].toLowerCase()].voice
      text = langMatch[2].trim()
    }
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
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)

    const tmpDir = os.tmpdir()
    mp3Path = path.join(tmpDir, `tts_${m.sender.split('@')[0]}_${Date.now()}.mp3`)

    const { audioStream } = await tts.toStream(text)
    const chunks = []
    for await (const chunk of audioStream) {
      chunks.push(chunk)
    }
    fs.writeFileSync(mp3Path, Buffer.concat(chunks))

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
│ Verifica el idioma, la voz o intenta de nuevo.
╰───────────────⬣`)
    }, { quoted: m })
  } finally {
    if (mp3Path && fs.existsSync(mp3Path)) {
      try { fs.unlinkSync(mp3Path) } catch { }
    }
  }
}

handler.help = ['tts <texto>', 'tts idioma:<texto>', 'tts voz:<número> <texto>', 'tts lista', 'tts idioma']
handler.tags = ['tools']
handler.command = ['tts', 'voz']
handler.desc = '🎙️ Convierte texto en audio reproducible en WhatsApp usando Edge TTS (gratis) 🌸'

export default handler