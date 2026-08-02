import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const libDir = path.join(__dirname, '..', '..', 'lib')

const PROPIETARIOS = [
  {
    nombre: 'SPROH-SAMU',
    rol: 'Colaborador / Desarrollador',
    links: [
      { texto: 'Canal de WhatsApp', url: 'https://whatsapp.com/channel/0029VbDIRNeEQIalr0dmwQ05' },
      { texto: 'TikTok', url: 'https://vm.tiktok.com/ZS9hhXA9M6JM2-olrMh/' },
      { texto: 'GitHub', url: 'https://github.com/sprohub' }
    ]
  },
  {
    nombre: 'BRAYAN-DRAVEN',
    rol: 'Desarrollador Principal',
    links: [
      { texto: 'Grupo de WhatsApp', url: 'https://chat.whatsapp.com/KfcoB5sCdpP9jmgGTsTbkq' }
    ]
  }
]

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 🍃 Busca al azar uno de los fondos disponibles en lib/ (welcome (1).png, (2).png, (3).png)
function obtenerFondoAleatorio() {
  const candidatos = ['welcome (1).png', 'welcome (2).png', 'welcome (3).png']
  const existentes = candidatos.filter(f => fs.existsSync(path.join(libDir, f)))
  if (!existentes.length) return null
  const elegido = existentes[Math.floor(Math.random() * existentes.length)]
  return path.join(libDir, elegido)
}

// Dibuja una imagen cubriendo todo el canvas (estilo "cover", recorta sobrante)
function dibujarFondoCover(ctx, img, W, H) {
  const escala = Math.max(W / img.width, H / img.height)
  const w = img.width * escala
  const h = img.height * escala
  const x = (W - w) / 2
  const y = (H - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

async function generarImagenCreditos() {
  const W = 900
  const H = 1150
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const verde = '#4ade80'
  const verdeClaro = '#bbf7d0'
  const oscuro = '#06120a'

  // Fondo base por si no hay imagen disponible
  const gradBase = ctx.createLinearGradient(0, 0, W, H)
  gradBase.addColorStop(0, '#071a0e')
  gradBase.addColorStop(1, '#0d2416')
  ctx.fillStyle = gradBase
  ctx.fillRect(0, 0, W, H)

  const fondoPath = obtenerFondoAleatorio()
  if (fondoPath) {
    try {
      const img = await loadImage(fondoPath)
      dibujarFondoCover(ctx, img, W, H)
    } catch (e) {
      console.error('[owner] No se pudo cargar el fondo:', e)
    }
  }

  // Overlay oscuro para que el texto sea legible sobre la imagen
  const overlay = ctx.createLinearGradient(0, 0, 0, H)
  overlay.addColorStop(0, 'rgba(4,10,6,0.55)')
  overlay.addColorStop(0.45, 'rgba(4,10,6,0.55)')
  overlay.addColorStop(1, 'rgba(3,8,5,0.92)')
  ctx.fillStyle = overlay
  ctx.fillRect(0, 0, W, H)

  // Marco redondeado
  const padding = 30
  ctx.strokeStyle = 'rgba(74,222,128,0.35)'
  ctx.lineWidth = 3
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 36)
  ctx.stroke()

  const marginX = 74

  // Badge
  ctx.font = 'bold 20px sans-serif'
  const badgeTexto = 'SAITAMA-BOT'
  const badgeAncho = ctx.measureText(badgeTexto).width + 44
  ctx.fillStyle = verde
  roundRect(ctx, marginX, 66, badgeAncho, 42, 21)
  ctx.fill()
  ctx.fillStyle = '#04170a'
  ctx.textAlign = 'left'
  ctx.fillText(badgeTexto, marginX + 22, 93)

  // Título
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText('Creditos', marginX, 175)
  ctx.fillStyle = verdeClaro
  ctx.font = '22px sans-serif'
  ctx.fillText('Equipo detras del bot', marginX, 208)

  // ── Bloques de cada propietario ──
  let y = 280
  for (const p of PROPIETARIOS) {
    const boxH = 90 + p.links.length * 34
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, marginX, y, W - marginX * 2, boxH, 22)
    ctx.fill()
    ctx.strokeStyle = 'rgba(74,222,128,0.25)'
    ctx.lineWidth = 1.5
    roundRect(ctx, marginX, y, W - marginX * 2, boxH, 22)
    ctx.stroke()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText(p.nombre, marginX + 28, y + 44)

    ctx.fillStyle = verdeClaro
    ctx.font = '18px sans-serif'
    ctx.fillText(p.rol, marginX + 28, y + 72)

    let ly = y + 104
    ctx.font = '17px sans-serif'
    for (const link of p.links) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fillText('- ' + link.texto, marginX + 28, ly)
      ly += 30
    }

    y += boxH + 26
  }

  // Footer inferior
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '16px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Toca los botones para abrir cada enlace', W / 2, H - 60)
  ctx.textAlign = 'left'

  return canvas.toBuffer('image/png')
}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

let handler = async (m, { conn }) => {
  let cuerpoTexto = 'Equipo detrás del bot\n\n'
  for (const p of PROPIETARIOS) {
    cuerpoTexto += `${p.nombre} — ${p.rol}\n`
  }
  cuerpoTexto += '\nToca los botones para abrir cada enlace'
  cuerpoTexto = cuerpoTexto.trim()

  let imagenBuffer
  try {
    imagenBuffer = await generarImagenCreditos()
  } catch (e) {
    console.error('[owner] Error generando imagen:', e)
  }

  // Un botón cta_url por cada link (abre el enlace directo al tocarlo)
  const botones = []
  for (const p of PROPIETARIOS) {
    for (const link of p.links) {
      botones.push({
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: link.texto,
          url: link.url,
          merchant_url: link.url
        })
      })
    }
  }

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '',
        hasMediaAttachment: !!imagenBuffer,
        imageMessage: imagenBuffer ? { url: undefined } : undefined
      },
      body: { text: decorar(cuerpoTexto) },
      footer: { text: '🍃 SAITAMA-BOT' },
      nativeFlowMessage: { buttons: botones }
    })

    if (imagenBuffer) {
      // Cuando hay imagen local (buffer), se sube primero para poder adjuntarla al header
      const { prepareWAMessageMedia } = await import('@whiskeysockets/baileys')
      const media = await prepareWAMessageMedia({ image: imagenBuffer }, { upload: conn.waUploadToServer })
      interactiveMessage.header.imageMessage = media.imageMessage
    }

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.error('[owner] Error enviando mensaje interactivo:', e)
    // Respaldo: si algo falla con los botones, se manda igual el texto con los links
    if (imagenBuffer) {
      await conn.sendMessage(m.chat, { image: imagenBuffer, caption: decorar(cuerpoTexto) }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, { text: decorar(cuerpoTexto) }, { quoted: m })
    }
  }
}

handler.help = ['owner']
handler.tags = ['info']
handler.command = /^(owner|creador|creadores|devs)$/i
handler.desc = 'Info de los creadores y enlaces oficiales'

export default handler
