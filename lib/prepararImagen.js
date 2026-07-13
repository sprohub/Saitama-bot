// lib/prepararImagen.js
import Jimp from 'jimp'

/**
 * Normaliza cualquier buffer de imagen a un JPEG válido para pdf-lib.
 * Soluciona errores como "SOI not found in JPEG", que ocurren cuando
 * el JPEG es progresivo, viene en CMYK, tiene EXIF raro, o el buffer
 * llegó incompleto/corrupto desde la descarga de WhatsApp.
 *
 * Usa Jimp (JavaScript puro, sin binarios nativos) en vez de sharp,
 * porque sharp suele fallar en Termux/Android (android-arm) al no
 * encontrar libvips precompilado para esa arquitectura.
 *
 * Acepta jpg, png, bmp, etc. como entrada; siempre devuelve un
 * JPEG "limpio" en la salida (o null si la imagen es inválida).
 */
export async function prepararImagenParaPDF(buffer) {
  try {
    const imagen = await Jimp.read(buffer)
    imagen.quality(90)
    return await imagen.getBufferAsync(Jimp.MIME_JPEG)
  } catch (e) {
    console.error('[prepararImagen] No se pudo procesar la imagen:', e)
    return null
  }
}
