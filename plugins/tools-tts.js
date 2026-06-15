import fs from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'

const execAsync = promisify(exec)

const MAX_LENGTH = 200

const box = (title, body) => `╭━━⬣
│  ${title}
╰━━━━━━━━━━━━━━━━━━━━━━⬣
${body}
╭━━━━━━━━━━━━━━━━━━━━━━⬣
│  ⚡ SAITAMA BOT
╰━━⬣`

async function getTTS(text) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=es&client=tw-ob`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

const handler = async (m, { conn, usedPrefix, command }) => {
  const text = m.text?.slice((usedPrefix + command).length).trim()

  if (!text) {
    return conn.sendMessage(m.chat, {
      text: box('🎙️ TTS — Texto a Voz', `│
│  Convierte texto en audio de voz.
│
│  ❀ Uso: ${usedPrefix}${command} <texto>
│  ❀ Máximo ${MAX_LENGTH} caracteres
│`)
    }, { quoted: m })
  }

  if (text.length > MAX_LENGTH) {
    return conn.sendMessage(m.chat, {
      text: box('⚠️ Texto muy largo', `│
│  Límite: ${MAX_LENGTH} caracteres
│  Tu texto: ${text.length} caracteres
│
│  Por favor envía un texto más corto.
│`)
    }, { quoted: m })
  }

  await m.react('🎙️')

  const tmpDir = os.tmpdir()
  const rawPath = path.join(tmpDir, `tts_${Date.now()}.mp3`)
  const finalPath = path.join(tmpDir, `tts_final_${Date.now()}.mp3`)

  try {
    const res = await getTTS(text)
    await pipeline(res.body, fs.createWriteStream(rawPath))

    if (!fs.existsSync(rawPath) || fs.statSync(rawPath).size < 100) {
      throw new Error('Audio inválido o vacío')
    }

    await execAsync(`ffmpeg -y -i "${rawPath}" -af "asetrate=44100*0.75,aresample=44100,atempo=1.15,bass=g=10,volume=1.5" "${finalPath}"`)

    const audioData = fs.readFileSync(finalPath)

    await conn.sendMessage(m.chat, {
      audio: audioData,
      mimetype: 'audio/mpeg',
      ptt: false
    }, { quoted: m })

    await m.react('✅')

  } catch (e) {
    console.error('[TTS ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: box('❌ Error', `│
│  No se pudo generar el audio.
│  ${e.message}
│`)
    }, { quoted: m })
  } finally {
    try { fs.unlinkSync(rawPath) } catch {}
    try { fs.unlinkSync(finalPath) } catch {}
  }
}

handler.help = ['tts2 <texto>']
handler.tags = ['tools']
handler.command = /^(tts2|voz2)$/i
handler.desc = '🎙️ Convierte texto a voz usando Google TTS'

export default handler