/**
 * plugins/tools/canvaej.js
 * Comando: .canvaej
 *
 * Renderiza una plantilla JSON tipo "Canva design spec" (rectángulos,
 * elipses, texto) a una imagen. Uso genérico para cualquier plantilla
 * que tú definas — no está atado a ningún diseño específico.
 *
 * Uso:
 * .canvaej {"width":800,"height":600,"elements":[...]}
 *   → pega el JSON directo después del comando
 *
 * .canvaej (citando un archivo .json)
 *   → usa el JSON del archivo citado
 *
 * Requiere ffmpeg instalado para convertir a PNG. Si no está
 * disponible o falla la conversión, manda el SVG directo como
 * documento (se abre en cualquier navegador).
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { renderizarASvg } from '../../lib/canvaRender.js'

const execAsync = promisify(exec)

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

async function obtenerJsonEntrada(m, text) {
  // 1) Si citó un archivo .json
  if (m.quoted && typeof m.quoted.download === 'function') {
    try {
      const buffer = await m.quoted.download()
      return buffer.toString('utf-8')
    } catch {
      return null
    }
  }
  // 2) Si viene el JSON pegado como texto
  if (text && text.trim()) return text.trim()
  return null
}

async function svgAPng(svgTexto) {
  const tmpDir = os.tmpdir()
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const svgPath = path.join(tmpDir, `${id}.svg`)
  const pngPath = path.join(tmpDir, `${id}.png`)

  fs.writeFileSync(svgPath, svgTexto)

  try {
    await execAsync(`ffmpeg -y -i "${svgPath}" "${pngPath}"`)
    const buffer = fs.readFileSync(pngPath)
    return buffer
  } finally {
    try { fs.unlinkSync(svgPath) } catch {}
    try { fs.unlinkSync(pngPath) } catch {}
  }
}

const handler = async (m, { conn, text, command }) => {
  const jsonTexto = await obtenerJsonEntrada(m, text)

  if (!jsonTexto) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        `Uso:\n.${command} {"width":800,"height":600,"elements":[...]}\n\n` +
        `O cita un archivo .json con la plantilla usando .${command}\n\n` +
        `Soporta elementos: RECTANGLE, ELLIPSE, TEXT (ICON/IMAGE salen como marcador gris)`
      )
    }, { quoted: m })
  }

  let diseño
  try {
    diseño = JSON.parse(jsonTexto)
  } catch (e) {
    return conn.sendMessage(m.chat, {
      text: decorar('❌ El JSON no es válido. Revisa el formato.')
    }, { quoted: m })
  }

  let svg
  try {
    svg = renderizarASvg(diseño)
  } catch (e) {
    console.error('[canvaej] ERROR renderizando SVG:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo renderizar la plantilla.')
    }, { quoted: m })
  }

  try {
    const png = await svgAPng(svg)
    await conn.sendMessage(m.chat, {
      image: png,
      caption: decorar('✅ Plantilla renderizada')
    }, { quoted: m })
  } catch (e) {
    console.warn('[canvaej] No se pudo convertir a PNG, mandando SVG:', e.message)
    await conn.sendMessage(m.chat, {
      document: Buffer.from(svg, 'utf-8'),
      fileName: 'plantilla.svg',
      mimetype: 'image/svg+xml',
      caption: decorar('⚠️ No se pudo convertir a PNG (revisa que ffmpeg esté instalado). Aquí está el SVG, ábrelo en un navegador.')
    }, { quoted: m })
  }
}

handler.command = ['canvaej']
handler.help = ['canvaej (renderiza una plantilla JSON a imagen)']
handler.tags = ['tools']

export default handler
