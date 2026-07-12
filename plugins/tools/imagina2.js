// plugins/tools/imagina2.js — .imagina2 <descripción>
// Genera 4 variaciones de una imagen con IA (Pollinations.ai, sin API key)
// y las envía unidas en una sola grilla 2x2.

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import fetch from 'node-fetch'

const execAsync = promisify(exec)

async function descargarImagen(prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Pollinations respondió ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function armarGrilla(buffers) {
  const tmp = os.tmpdir()
  const ids = buffers.map(() => Date.now() + '_' + Math.random().toString(36).slice(2))
  const rutas = ids.map((id) => path.join(tmp, `imagina2_${id}.jpg`))
  const salida = path.join(tmp, `imagina2_grid_${Date.now()}.jpg`)

  buffers.forEach((buf, i) => fs.writeFileSync(rutas[i], buf))

  const inputs = rutas.map((r) => `-i "${r}"`).join(' ')
  const filtro =
    '[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[out]'

  await execAsync(`ffmpeg -y ${inputs} -filter_complex "${filtro}" -map "[out]" "${salida}"`)

  const resultado = fs.readFileSync(salida)
  rutas.forEach((r) => fs.existsSync(r) && fs.unlinkSync(r))
  fs.existsSync(salida) && fs.unlinkSync(salida)

  return resultado
}

const handler = async (m, { conn, text }) => {
  const prompt = (text || '').trim()

  if (!prompt) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Escribe una descripción.\n` +
      `│ Ejemplo: *.imagina2 un gato astronauta en la luna*\n` +
      `╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🍃 Generando 4 variaciones con IA...\n` +
    `│ ⏳ Espera un momento\n` +
    `╰───────────────⬣`
  )

  try {
    const seeds = Array.from({ length: 4 }, () => Math.floor(Math.random() * 1000000))
    const buffers = await Promise.all(seeds.map((seed) => descargarImagen(prompt, seed)))
    const grilla = await armarGrilla(buffers)

    await conn.sendMessage(
      m.chat,
      {
        image: grilla,
        caption: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🎨 ${prompt}\n╰───────────────⬣`
      },
      { quoted: m }
    )
  } catch (e) {
    console.log('[imagina2] error:', e)
    await m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo generar la imagen. Intenta de nuevo.\n╰───────────────⬣`
    )
  }
}

handler.command = ['imagina2']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['imagina2 <descripción>']
handler.desc = 'Genera 4 variaciones de una imagen con IA en una grilla'

export default handler
