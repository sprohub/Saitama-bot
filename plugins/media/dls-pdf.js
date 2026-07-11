// === COMANDO mgpdf / .mgpdf / /mgpdf / @mgpdf / #mgpdf ===
// Convierte una imagen (citada o enviada con el comando) en un archivo PDF.

import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import os from 'os'

async function getMediaBuffer(message, type) {
  const stream = await downloadContentFromMessage(message, type)
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

const handler = async (m, { conn }) => {
  // Buscamos la imagen: primero en el mensaje citado, luego en el mensaje actual
  const quoted = m.quoted ? m.quoted : m
  const mime = quoted.mimetype || quoted.msg?.mimetype || ''

  if (!/image\/(jpe?g|png)/i.test(mime)) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Debes enviar o citar una *imagen* (jpg o png)\n` +
      `│ junto con el comando *mgpdf*.\n` +
      `╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 🍃 Convirtiendo imagen a PDF, un momento...\n` +
    `╰───────────────⬣`
  )

  try {
    // Descargamos la imagen
    const imageMessage = quoted.msg || quoted
    const buffer = await getMediaBuffer(imageMessage, 'image')

    // Creamos el PDF
    const pdfDoc = await PDFDocument.create()

    let embeddedImage
    if (/png/i.test(mime)) {
      embeddedImage = await pdfDoc.embedPng(buffer)
    } else {
      embeddedImage = await pdfDoc.embedJpg(buffer)
    }

    const { width, height } = embeddedImage
    const pagina = pdfDoc.addPage([width, height])
    pagina.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width,
      height
    })

    const pdfBytes = await pdfDoc.save()

    // Guardamos temporalmente para enviarlo
    const tempPath = path.join(os.tmpdir(), `mgpdf_${Date.now()}.pdf`)
    fs.writeFileSync(tempPath, pdfBytes)

    await conn.sendMessage(m.chat, {
      document: fs.readFileSync(tempPath),
      mimetype: 'application/pdf',
      fileName: 'SAITAMA-BOT.pdf',
      caption:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ 🍃 Imagen convertida a PDF ✅\n` +
        `╰───────────────⬣`
    }, { quoted: m })

    fs.unlinkSync(tempPath)
  } catch (e) {
    console.log('[mgpdf] error:', e)
    await m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ ❌ Ocurrió un error al convertir la imagen.\n` +
      `╰───────────────⬣`
    )
  }
}

handler.command = ['mgpdf']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['mgpdf']

export default handler