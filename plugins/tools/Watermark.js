import { createCanvas, loadImage } from '@napi-rs/canvas'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

async function aplicarWatermark(bufferOriginal, texto) {
  const img = await loadImage(bufferOriginal)
  const W = img.width
  const H = img.height

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Imagen base
  ctx.drawImage(img, 0, 0, W, H)

  // Tamaño de fuente proporcional al tamaño de la imagen
  const fontSize = Math.max(18, Math.round(Math.min(W, H) / 14))
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textBaseline = 'middle'

  const anchoTexto = ctx.measureText(texto).width
  const pasoX = anchoTexto + fontSize * 3
  const pasoY = fontSize * 5

  ctx.save()
  // Rotamos el "lienzo" de marcas de agua en diagonal, estilo banco de imágenes
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 8)
  ctx.translate(-W / 2, -H / 2)

  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = Math.max(1, fontSize / 16)

  // Cubrimos de sobra por la rotación, para que no queden huecos en las esquinas
  const margen = Math.max(W, H) * 0.4
  for (let y = -margen; y < H + margen; y += pasoY) {
    for (let x = -margen; x < W + margen; x += pasoX) {
      ctx.strokeText(texto, x, y)
      ctx.fillText(texto, x, y)
    }
  }
  ctx.restore()

  return canvas.toBuffer('image/jpeg', { quality: 0.92 })
}

let handler = async (m, { conn, text }) => {
  const mediaMsg = m.quoted && /image/.test(m.quoted.mimetype || '') ? m.quoted
    : /image/.test(m.mimetype || '') ? m
    : null

  const marca = (text || '').trim()

  if (!mediaMsg) {
    return conn.sendMessage(m.chat, {
      text: decorar(
        'Aplica una marca de agua a una imagen\n\n' +
        'Uso: responde a una imagen con .watermark <texto>\n' +
        'Ejemplo: .watermark SAITAMA-BOT'
      )
    }, { quoted: m })
  }

  if (!marca) {
    return conn.sendMessage(m.chat, {
      text: decorar('Escribe el texto de la marca de agua\nEjemplo: .watermark SAITAMA-BOT')
    }, { quoted: m })
  }

  await conn.sendMessage(m.chat, { text: decorar('Aplicando marca de agua...') }, { quoted: m })

  try {
    const buffer = await mediaMsg.download()
    const resultado = await aplicarWatermark(buffer, marca)

    await conn.sendMessage(m.chat, {
      image: resultado,
      caption: decorar(`Marca de agua aplicada\n"${marca}"`)
    }, { quoted: m })
  } catch (e) {
    console.error('[watermark] error:', e)
    await conn.sendMessage(m.chat, {
      text: decorar('No se pudo procesar esa imagen')
    }, { quoted: m })
  }
}

handler.help = ['watermark <texto>']
handler.tags = ['tools']
handler.command = /^(watermark|marcadeagua)$/i
handler.desc = 'Aplica una marca de agua de texto repetida sobre una imagen'

export default handler
