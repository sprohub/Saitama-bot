import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import fetch from 'node-fetch'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

// ⚠️ Este es el endpoint NO OFICIAL de Google Speech API v2 (el que usa
// internamente el proyecto "google-speech-v2" y librerías como
// python's SpeechRecognition). Es gratis y sin registro, pero:
//   - No es una API pública documentada ni soportada por Google.
//   - Tiene límites de uso poco claros y puede fallar o dejar de
//     funcionar sin aviso.
//   - La key de abajo es la misma "key pública" que usa Chromium y que
//     comparten decenas de proyectos open-source (no es una key robada,
//     es la que trae el navegador Chrome de fábrica para su función de
//     dictado por voz).
const GOOGLE_STT_KEY = 'AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw'
const GOOGLE_STT_URL = 'https://www.google.com/speech-api/v2/recognize'

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

// La API de Google requiere audio FLAC mono a 16kHz
async function convertToFlac(inputPath, outPath) {
  await runFfmpeg(['-y', '-i', inputPath, '-ac', '1', '-ar', '16000', outPath])
}

async function transcribeFlac(flacBuffer, lang = 'es-ES') {
  const url = `${GOOGLE_STT_URL}?output=json&lang=${lang}&key=${GOOGLE_STT_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/x-flac; rate=16000' },
    body: flacBuffer
  })

  const raw = await res.text()
  if (!raw.trim()) throw new Error('La API no devolvió resultados (audio poco claro o silencio)')

  // La respuesta viene como varias líneas JSON; la que trae el resultado
  // real suele ser la última no vacía
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const json = JSON.parse(lines[i])
      const transcript = json?.result?.[0]?.alternative?.[0]?.transcript
      if (transcript) return transcript
    } catch {}
  }
  throw new Error('No se pudo interpretar la respuesta de la API')
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const quoted = m.quoted ? m.quoted : m
  const mime = (quoted.msg || quoted).mimetype || ''
  const isAudio = /audio/.test(mime)

  if (!isAudio) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA SPEECH TO TEXT*
│
│ 🍃 » Transcribe una nota de voz a texto
│
│ 📝 » Cita una nota de voz y escribe ${usedPrefix}${command}
│ 📝 » Opcional: ${usedPrefix}${command} en (para inglés)
│
│ ⚠️ » Usa una API gratuita no oficial, puede
│ ⚠️ » fallar con audios largos o con ruido
│
╰───────────────⬣`
    }, { quoted: m })
  }

  // Idioma opcional: .speechtotext en / .speechtotext es
  const langMap = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR' }
  const lang = langMap[text?.trim().toLowerCase()] || 'es-ES'

  await m.react('🎙️')

  const oggPath = path.join(TEMP_DIR, `stt_in_${Date.now()}.ogg`)
  const flacPath = path.join(TEMP_DIR, `stt_out_${Date.now()}.flac`)

  try {
    const buffer = await quoted.download()
    fs.writeFileSync(oggPath, buffer)

    await convertToFlac(oggPath, flacPath)
    const flacBuffer = fs.readFileSync(flacPath)

    const transcript = await transcribeFlac(flacBuffer, lang)

    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA SPEECH TO TEXT*
│
│ 🎙️ » ${transcript}
│
╰───────────────⬣`
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[SPEECHTOTEXT ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA SPEECH TO TEXT*
│
│ ❌ » No se pudo transcribir el audio
│ 🔁 » Intenta con una nota más corta y clara
│
╰───────────────⬣`
    }, { quoted: m })
  } finally {
    deleteFileSafe(oggPath)
    deleteFileSafe(flacPath)
  }
}

handler.help = ['speechtotext', 'speechtotext <es|en|pt|fr>']
handler.tags = ['tools']
handler.command = /^(speechtotext|stt|transcribir)$/i
handler.desc = 'Transcribe una nota de voz citada a texto'

export default handler
