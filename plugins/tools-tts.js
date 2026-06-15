import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'

// ⚠️ NO escribas tu API key en esta línea ni en ninguna otra de este archivo.
// La key se configura como variable de entorno FISH_AUDIO_API_KEY en Render
// (panel del servicio -> Environment -> Add Environment Variable).
const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY
const MAX_LENGTH = 500

const box = (title, body) => `╭───────────────⬣
│  ${title}
╰───────────────⬣
${body}`

const handler = async (m, { conn, usedPrefix, command }) => {
  if (!FISH_API_KEY) {
    return conn.sendMessage(m.chat, {
      text: box('⚠️ TTS no configurado', `
│ Falta configurar FISH_AUDIO_API_KEY
│ en las variables de entorno del bot.
╰───────────────⬣`)
    }, { quoted: m })
  }

  let raw = m.text?.slice((usedPrefix + command).length).trim()

  // .tts lista -> muestra 5 voces disponibles
  if (raw && /^lista$/i.test(raw)) {
    try {
      const res = await fetch('https://api.fish.audio/model?page_size=5&sort_by=score', {
        headers: { Authorization: `Bearer ${FISH_API_KEY}` }
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const items = (data.items || []).slice(0, 5)

      if (!items.length) {
        return conn.sendMessage(m.chat, {
          text: box('🎙️ Voces TTS', `\n│ No se encontraron voces disponibles.\n╰───────────────⬣`)
        }, { quoted: m })
      }

      const lines = items.map((v, i) => `│ ${i + 1}. ${v.title || 'Sin nombre'}\n│    id: ${v._id}`).join('\n│\n')

      return conn.sendMessage(m.chat, {
        text: box('🎙️ Voces disponibles (Top 5)', `
│
${lines}
│
│ ❀ Uso: ${usedPrefix}${command} <id>: <texto>
╰───────────────⬣`)
      }, { quoted: m })
    } catch (e) {
      console.error(e)
      return conn.sendMessage(m.chat, {
        text: box('❌ Error', `\n│ No se pudo obtener la lista de voces.\n╰───────────────⬣`)
      }, { quoted: m })
    }
  }

  if (!raw) {
    return conn.sendMessage(m.chat, {
      text: box('🎙️ TTS - Texto a Voz', `
│ Convierte texto en audio con Fish Audio.
│
│ ❀ Uso: ${usedPrefix}${command} <texto>
│ ❀ Con voz: ${usedPrefix}${command} <id_voz>: <texto>
│ ❀ Ver voces: ${usedPrefix}${command} lista
╰───────────────⬣`)
    }, { quoted: m })
  }

  // Detecta "id_voz: texto"
  let voiceId = null
  let text = raw
  const voiceMatch = raw.match(/^([A-Za-z0-9_-]{8,}):\s*(.+)$/s)
  if (voiceMatch) {
    voiceId = voiceMatch[1]
    text = voiceMatch[2].trim()
  }

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: box('⚠️ Falta el texto', `\n│ Indica el texto a convertir después del id de voz.\n╰───────────────⬣`)
    }, { quoted: m })
  }

  if (text.length > MAX_LENGTH) {
    return conn.sendMessage(m.chat, {
      text: box('⚠️ Texto muy largo', `
│ El texto supera el límite de ${MAX_LENGTH} caracteres.
│ Tu texto tiene ${text.length} caracteres.
╰───────────────⬣`)
    }, { quoted: m })
  }

  let mp3Path = null

  try {
    const payload = {
      text,
      format: 'mp3',
      mp3_bitrate: 128,
      normalize: true
    }
    if (voiceId) payload.reference_id = voiceId

    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errText}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    const audioData = Buffer.from(arrayBuffer)

    const tmpDir = os.tmpdir()
    mp3Path = path.join(tmpDir, `tts_${m.sender.split('@')[0]}_${Date.now()}.mp3`)
    fs.writeFileSync(mp3Path, audioData)

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
│ Verifica el id de voz o intenta de nuevo.
╰───────────────⬣`)
    }, { quoted: m })
  } finally {
    if (mp3Path && fs.existsSync(mp3Path)) {
      try { fs.unlinkSync(mp3Path) } catch { }
    }
  }
}

handler.help = ['tts <texto>', 'tts <id_voz>: <texto>', 'tts lista']
handler.tags = ['tools']
handler.command = ['tts', 'voz']
handler.desc = '🎙️ Convierte texto en audio con Fish Audio 🌸'

export default handler
