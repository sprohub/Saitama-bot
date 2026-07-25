import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { createCanvas } from '@napi-rs/canvas'

// ═══════════════════════════════════════════
//  CONFIGURACIÓN
// ═══════════════════════════════════════════
// Necesitas una API Key de OpenAI (Whisper) para transcribir.
// Configúrala en una de estas dos formas:
//   1) global.APIKeys = { openai: 'sk-...' }  (en tu config/settings del bot)
//   2) variable de entorno OPENAI_API_KEY
function obtenerApiKey() {
  return global.APIKeys?.openai || process.env.OPENAI_API_KEY || null
}

// ═══════════════════════════════════════════
//  DESCARGA DEL AUDIO
// ═══════════════════════════════════════════
async function obtenerBufferAudio(m) {
  const objetivo = m.quoted || m

  // La mayoría de forks de Baileys traen un helper .download() en el mensaje
  if (typeof objetivo.download === 'function') {
    return await objetivo.download()
  }

  // Fallback: descarga nativa de Baileys usando el audioMessage crudo
  const audioMsg =
    objetivo.message?.audioMessage ||
    m.message?.audioMessage ||
    m.msg?.audioMessage

  if (!audioMsg) {
    throw new Error('No se encontró un audio válido para transcribir')
  }

  const stream = await downloadContentFromMessage(audioMsg, 'audio')
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

// ═══════════════════════════════════════════
//  TRANSCRIPCIÓN (OpenAI Whisper)
// ═══════════════════════════════════════════
async function transcribirAudio(buffer) {
  const apiKey = obtenerApiKey()
  if (!apiKey) {
    throw new Error('Falta configurar la API Key de OpenAI (global.APIKeys.openai o OPENAI_API_KEY)')
  }

  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'audio.ogg')
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json') // trae idioma y duración además del texto

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  })

  if (!res.ok) {
    const errTexto = await res.text().catch(() => '')
    throw new Error(`Error API Whisper (${res.status}): ${errTexto}`)
  }

  return await res.json() // { text, language, duration, segments... }
}

// ═══════════════════════════════════════════
//  DISEÑO DE LA TARJETA — mismo estilo "Saitama Power"
// ═══════════════════════════════════════════
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function circuloDesenfocado(ctx, x, y, r, color, alpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, color.replace('ALPHA', alpha))
  grad.addColorStop(1, color.replace('ALPHA', '0'))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function barraProgreso(ctx, x, y, w, h, porcentaje, colorInicio, colorFin) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, x, y, w, h, h / 2)
  ctx.fill()

  const anchoRelleno = Math.max(h, w * Math.min(1, Math.max(0, porcentaje)))
  const grad = ctx.createLinearGradient(x, 0, x + anchoRelleno, 0)
  grad.addColorStop(0, colorInicio)
  grad.addColorStop(1, colorFin)
  ctx.fillStyle = grad
  roundRect(ctx, x, y, anchoRelleno, h, h / 2)
  ctx.fill()
}

function formatearDuracion(segundos) {
  const s = Math.round(segundos || 0)
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}:${rest.toString().padStart(2, '0')}`
}

function nombreIdioma(codigo) {
  const mapa = {
    es: 'Español', en: 'Inglés', pt: 'Portugués', fr: 'Francés',
    de: 'Alemán', it: 'Italiano', ja: 'Japonés', ko: 'Coreano',
    zh: 'Chino', ru: 'Ruso', ar: 'Árabe'
  }
  return mapa[codigo] || (codigo ? codigo.toUpperCase() : 'Desconocido')
}

async function generarImagenTranscripcion({ texto, idioma, duracion }) {
  const W = 1200
  const H = 700
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const amarillo = '#ffd23f'
  const amarilloClaro = '#ffe98a'

  // ── Fondo con degradado y blobs (idéntico al de ping.js) ──
  const gradFondo = ctx.createLinearGradient(0, 0, W, H)
  gradFondo.addColorStop(0, '#060d16')
  gradFondo.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = gradFondo
  ctx.fillRect(0, 0, W, H)

  circuloDesenfocado(ctx, W - 120, 60, 260, 'rgba(255,210,63,ALPHA)', '0.12')
  circuloDesenfocado(ctx, W - 60, H - 40, 220, 'rgba(255,77,77,ALPHA)', '0.10')
  circuloDesenfocado(ctx, 40, H - 60, 180, 'rgba(255,210,63,ALPHA)', '0.06')

  // ── Tarjeta contenedora ──
  const padding = 36
  ctx.save()
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 40)
  ctx.clip()
  ctx.fillStyle = 'rgba(8,14,22,0.45)'
  ctx.fillRect(padding, padding, W - padding * 2, H - padding * 2)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,210,63,0.15)'
  ctx.lineWidth = 2
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 40)
  ctx.stroke()

  const marginX = 70

  // ── Badge ──
  ctx.font = 'bold 22px sans-serif'
  const badgeTexto = '⚡ SAITAMA POWER'
  const badgeAncho = ctx.measureText(badgeTexto).width + 46
  ctx.fillStyle = amarillo
  roundRect(ctx, marginX, 68, badgeAncho, 44, 22)
  ctx.fill()
  ctx.fillStyle = '#1a1200'
  ctx.textAlign = 'left'
  ctx.fillText(badgeTexto, marginX + 23, 96)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '20px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Un golpe, una transcripción', W - marginX, 96)

  // ── Título ──
  ctx.textAlign = 'left'
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText('SAITAMA-BOT', marginX, 158)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 54px sans-serif'
  ctx.fillText('Speech to Text', marginX, 218)

  const palabras = texto.trim().split(/\s+/).filter(Boolean)
  const numPalabras = palabras.length
  const numCaracteres = texto.length

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '24px sans-serif'
  ctx.fillText(
    `Idioma ${nombreIdioma(idioma)} · ${numPalabras} palabras · ${formatearDuracion(duracion)} min`,
    marginX,
    256
  )

  // ── Dos tarjetas grandes: DURACIÓN / PALABRAS ──
  const cardY = 300
  const cardH = 150
  const cardW = (W - marginX * 2 - 30) / 2
  const card1X = marginX
  const card2X = marginX + cardW + 30

  // Card Duración
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRect(ctx, card1X, cardY, cardW, cardH, 22)
  ctx.fill()
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('DURACIÓN', card1X + 34, cardY + 42)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(formatearDuracion(duracion), card1X + 34, cardY + 96)
  const porcDuracion = Math.min(1, (duracion || 0) / 180) // referencia visual: 3 min = barra llena
  barraProgreso(ctx, card1X + 34, cardY + 116, cardW - 68, 12, porcDuracion, '#ffd23f', '#ff9a3f')
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.fillText('Minutos:segundos', card1X + 34, cardY + cardH - 16)

  // Card Palabras
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRect(ctx, card2X, cardY, cardW, cardH, 22)
  ctx.fill()
  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('PALABRAS', card2X + 34, cardY + 42)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(String(numPalabras), card2X + 34, cardY + 96)
  const porcPalabras = Math.min(1, numPalabras / 150) // referencia visual: 150 palabras = barra llena
  barraProgreso(ctx, card2X + 34, cardY + 116, cardW - 68, 12, porcPalabras, '#ff4d4d', '#ffd23f')
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.fillText(`${numCaracteres} caracteres`, card2X + 34, cardY + cardH - 16)

  // ── Tarjeta de vista previa del texto ──
  const previewY = cardY + cardH + 30
  const previewH = 150
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundRect(ctx, marginX, previewY, W - marginX * 2, previewH, 22)
  ctx.fill()

  ctx.fillStyle = amarilloClaro
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText('VISTA PREVIA', marginX + 28, previewY + 34)

  ctx.fillStyle = '#e8e8e8'
  ctx.font = '22px sans-serif'
  const maxAncho = W - marginX * 2 - 56
  const extracto = texto.length > 260 ? texto.slice(0, 260) + '…' : texto

  const palabrasExtracto = extracto.split(' ')
  let linea = ''
  const lineas = []
  for (const palabra of palabrasExtracto) {
    const prueba = linea ? linea + ' ' + palabra : palabra
    if (ctx.measureText(prueba).width > maxAncho && linea) {
      lineas.push(linea)
      linea = palabra
    } else {
      linea = prueba
    }
  }
  if (linea) lineas.push(linea)

  lineas.slice(0, 4).forEach((l, i) => {
    ctx.fillText(l, marginX + 28, previewY + 70 + i * 30)
  })
  if (lineas.length > 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = 'italic 18px sans-serif'
    ctx.fillText('(texto completo enviado abajo)', marginX + 28, previewY + previewH - 14)
  }

  return canvas.toBuffer('image/png')
}

// ───────────────────────────────────────────
// Comando .speechtotext / .stt / .transcribir
// ───────────────────────────────────────────
let handler = async (m, { conn }) => {
  const tieneAudio =
    (m.quoted && m.quoted.mtype === 'audioMessage') ||
    m.mtype === 'audioMessage'

  if (!tieneAudio) {
    return m.reply(
      '「 ⚡ SAITAMA-BOT 」\n' +
      'Responde a una nota de voz (o envíala junto con el comando) para transcribirla.'
    )
  }

  await m.reply('⏳ Transcribiendo audio, un segundo...')

  try {
    const buffer = await obtenerBufferAudio(m)
    const resultado = await transcribirAudio(buffer)

    const imagenBuffer = await generarImagenTranscripcion({
      texto: resultado.text || '(sin texto detectado)',
      idioma: resultado.language,
      duracion: resultado.duration
    })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: '「 ⚡ SAITAMA-BOT · SPEECH TO TEXT 」'
    }, { quoted: m })

    // Envía el texto completo aparte, por si es muy largo para caber en la imagen/caption
    const textoCompleto = resultado.text || '(sin texto detectado)'
    const CHUNK = 3500
    for (let i = 0; i < textoCompleto.length; i += CHUNK) {
      await conn.sendMessage(m.chat, {
        text: textoCompleto.slice(i, i + CHUNK)
      }, { quoted: m })
    }
  } catch (e) {
    console.error('[speechtotext] Error:', e)
    await m.reply(
      '「 ⚡ SAITAMA-BOT 」\n❌ No se pudo transcribir el audio.\n' +
      `Detalle: ${e.message}`
    )
  }
}

handler.help = ['speechtotext', 'stt', 'transcribir']
handler.tags = ['tools']
handler.command = /^(speechtotext|stt|transcribir)$/i

export default handler
