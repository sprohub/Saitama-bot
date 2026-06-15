import fs from 'fs'
import path from 'path'
import os from 'os'

const FISH_API_KEY = '0dcca82cdddc49c98853fa288b6ff7ec'
const MAX_LENGTH = 200

// Voces de ejemplo de Fish Audio (reemplaza los IDs con los reales de tu cuenta)
const VOICES = {
  '1': { id: 'voice_id_1', name: 'Energética Femenina (ES)' },
  '2': { id: 'voice_id_2', name: 'Profunda Masculina (ES)' },
  '3': { id: 'voice_id_3', name: 'Narrador Calmado (EN)' },
  '4': { id: 'voice_id_4', name: 'Anime Femenina (JA)' },
  '5': { id: 'voice_id_5', name: 'Casual Juvenil (EN)' }
}

const LANGS = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  ja: '日本語'
}

const box = (title, body) => `╭───────────────⬣
│  ${title}
╰───────────────⬣
${body}`

const handler = async (m, { conn, usedPrefix, command, args, text: rawText }) => {
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
      .map(([k, v]) => `│ ${k} - ${v}`)
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
  let voiceId = null
  const voiceMatch = text.match(/^voz:(\d)\s*(.+)$/is)
  if (voiceMatch && VOICES[voiceMatch[1]]) {
    voiceId = VOICES[voiceMatch[1]].id
    text = voiceMatch[2].trim()
  }

  // Detectar idioma: "en: hello world"
  let lang = 'es'
  const langMatch = text.match(/^([a-z]{2}):\s*(.+)$/is)
  if (langMatch && LANGS[langMatch[1].toLowerCase()]) {
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
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId || undefined,
        format: 'mp3',
        language: lang
      })
    })

    if (!response.ok) {
      throw new Error(`Fish API error: ${response.status} ${await response.text()}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    const tmpDir = os.tmpdir()
    mp3Path = path.join(tmpDir, `tts_${m.sender.split('@')[0]}_${Date.now()}.mp3`)
    fs.writeFileSync(mp3Path, buffer)

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
handler.desc = '🎙️ Convierte texto en audio reproducible en WhatsApp usando Fish Audio 🌸'

export default handler