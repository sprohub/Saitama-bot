import fetch from 'node-fetch'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

const execPromise = promisify(exec)

/**
 * Descarga un video/gif desde una URL y lo re-codifica a un mp4
 * compatible con WhatsApp (h264 + faststart, sin audio problemático).
 * Sirve para "arreglar" gifs con formato dañado o no soportado.
 *
 * @param {string} url - URL del video/gif original
 * @returns {Promise<Buffer>} - Buffer del mp4 ya reparado
 */
export async function fixGifFromUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Descarga falló: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  return fixGifFromBuffer(buffer)
}

/**
 * Igual que fixGifFromUrl pero recibe un buffer directamente
 * (útil si ya descargaste el archivo, ej. quoted.download()).
 *
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function fixGifFromBuffer(buffer) {
  const id = randomBytes(4).toString('hex')
  const tempIn = path.join(tmpdir(), `gifin_${id}`)
  const tempOut = path.join(tmpdir(), `gifout_${id}.mp4`)

  try {
    fs.writeFileSync(tempIn, buffer)

    // -movflags +faststart -> compatible con reproducción tipo gif en WA
    // -pix_fmt yuv420p     -> evita errores de color en algunos players
    // -an                  -> quita audio (los "gif" no deben llevar audio)
    // scale trunc(...)     -> asegura dimensiones pares (requisito de h264)
    await execPromise(
      `ffmpeg -y -i "${tempIn}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=20" ` +
      `-c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "${tempOut}"`
    )

    return fs.readFileSync(tempOut)
  } finally {
    if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn)
    if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut)
  }
}
