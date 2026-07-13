// lib/prepararImagen.js
import sharp from 'sharp'

/**
 * Normaliza cualquier buffer de imagen a un JPEG válido para pdf-lib.
 * Soluciona errores como "SOI not found in JPEG", que ocurren cuando
 * el JPEG es progresivo, viene en CMYK, tiene EXIF raro, o el buffer
 * llegó incompleto/corrupto desde la descarga de WhatsApp.
 *
 * Acepta jpg, png, webp, etc. como entrada; siempre devuelve un
 * JPEG "limpio" en la salida (o null si la imagen es inválida).
 */
export async function prepararImagenParaPDF(buffer) {
  try {
    return await sharp(buffer)
      .rotate() // respeta la orientación EXIF antes de aplanar
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer()
  } catch (e) {
    console.error('[prepararImagen] No se pudo procesar la imagen:', e)
    return null
  }
}