import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import WebP from 'node-webpmux'

const STICKER_PACK_NAME   = 'SAITAMA-BOT'
const STICKER_PACK_AUTHOR = 'Sprohub'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const CANVAS_SIZE   = 640
const FRAME_DURATION = 0.9   // segundos que dura cada texto en el modo animado
const MAX_FRAMES    = 8      // límite de textos permitidos con "anímate"

// ── Fuentes candidatas para texto normal, en orden de preferencia.
// 1) Puedes forzar una con la variable de entorno BRAT_FONT_PATH
// 2) Si subes una fuente propia al repo, ponla en plugins/assets/brat-font.ttf
// 3) Si no, se intenta con fuentes comunes que suelen venir con Termux/fontconfig
const FONT_CANDIDATES = [
  process.env.BRAT_FONT_PATH,
  path.join(process.cwd(), 'plugins', 'assets', 'brat-font.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
  '/data/data/com.termux/files/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/system/fonts/Roboto-Bold.ttf',
  '/system/fonts/RobotoCondensed-Bold.ttf'
].filter(Boolean)

// ── Fuentes candidatas con soporte de emoji (glifos monocromo, compatibles
// con drawtext/fontcolor, a diferencia de las fuentes de emoji a color que
// ffmpeg no puede pintar con fontcolor). Symbola y Noto Emoji cubren texto
// latino básico + emojis en un solo archivo, así que sirven como fuente
// única cuando el texto trae emojis.
const EMOJI_FONT_CANDIDATES = [
  process.env.BRAT_EMOJI_FONT_PATH,
  path.join(process.cwd(), 'plugins', 'assets', 'brat-emoji-font.ttf'),
  '/usr/share/fonts/truetype/ancient-scripts/Symbola.ttf',
  '/usr/share/fonts/truetype/symbola/Symbola.ttf',
  '/data/data/com.termux/files/usr/share/fonts/TTF/Symbola.ttf',
  '/usr/share/fonts/truetype/noto/NotoEmoji-Regular.ttf',
  '/system/fonts/NotoColorEmoji.ttf'
].filter(Boolean)

// Rango aproximado de emojis/pictográficos + variation selectors + ZWJ
const EMOJI_REGEX = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\uFE0F\u200D]/u

function hasEmoji(text) {
  return EMOJI_REGEX.test(text)
}

function findFont(candidates) {
  for (const f of candidates) {
    try { if (fs.existsSync(f)) return f } catch {}
  }
  return null
}

function deleteFileSafe(fp) {
  try { if (fp && fs.existsSync(fp)) fs.unlinkSync(fp) } catch {}
}

// Escapa un valor para usarlo dentro de un filtro de ffmpeg (drawtext=...)
function escapeFilterValue(v) {
  return String(v).replace(/\\/g, '\\\\\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    ff.stderr.on('data', d => { stderr += d.toString() })
    ff.on('error', reject)
    ff.on('close', code => {
      if (code === 0) resolve(true)
      else reject(new Error('ffmpeg falló: ' + stderr.slice(-400)))
    })
  })
}

// Envuelve el texto en líneas y calcula un tamaño de fuente que quepa en el lienzo.
// Es un cálculo aproximado (sin medir texto real), pero funciona bien para frases cortas/medias.
function wrapAndFit(rawText) {
  const text = String(rawText || '').trim()
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return { lines: ['brat'], fontSize: 90 }

  const maxFont = 140
  const minFont = 26
  const usableWidth = CANVAS_SIZE * 0.82
  const usableHeight = CANVAS_SIZE * 0.82
  const CHAR_WIDTH_FACTOR = 0.56 // ancho aprox de un caracter respecto al fontsize (fuente condensada bold)

  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 4) {
    const maxCharsPerLine = Math.max(1, Math.floor(usableWidth / (fontSize * CHAR_WIDTH_FACTOR)))
    const lines = []
    let current = ''
    for (const w of words) {
      const candidate = current ? current + ' ' + w : w
      if (candidate.length > maxCharsPerLine && current) {
        lines.push(current)
        current = w
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)

    const lineHeight = fontSize * 1.15
    const totalHeight = lineHeight * lines.length
    const widestLine = Math.max(...lines.map(l => l.length))
    const estimatedWidth = widestLine * fontSize * CHAR_WIDTH_FACTOR

    if (totalHeight <= usableHeight && estimatedWidth <= usableWidth) {
      return { lines, fontSize: Math.round(fontSize) }
    }
  }
  // fallback si nada calzó (texto gigante): usa el tamaño mínimo igual
  const maxCharsPerLine = Math.max(1, Math.floor(usableWidth / (minFont * CHAR_WIDTH_FACTOR)))
  const lines = []
  let current = ''
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w
    if (candidate.length > maxCharsPerLine && current) { lines.push(current); current = w }
    else current = candidate
  }
  if (current) lines.push(current)
  return { lines, fontSize: minFont }
}

async function renderFrame(text, outPath, textFontPath, emojiFontPath) {
  // El texto "brat" clásico va en minúsculas; si detectamos emoji preferimos
  // no forzar lowercase agresivo sobre símbolos, pero sí sobre las letras.
  const normalized = String(text || '')
  const useEmojiFont = hasEmoji(normalized) && emojiFontPath
  const fontPath = useEmojiFont ? emojiFontPath : textFontPath
  const displayText = useEmojiFont ? normalized.trim() : normalized.toLowerCase()

  const { lines, fontSize } = wrapAndFit(displayText)
  const txtPath = outPath.replace(/\.png$/, '.txt')
  fs.writeFileSync(txtPath, lines.join('\n'), 'utf8')

  const drawtext = [
    `fontfile='${escapeFilterValue(fontPath)}'`,
    `textfile='${escapeFilterValue(txtPath)}'`,
    `fontcolor=black`,
    `fontsize=${fontSize}`,
    `line_spacing=${Math.round(fontSize * 0.12)}`,
    `x=(w-text_w)/2`,
    `y=(h-text_h)/2`
  ].join(':')

  const args = [
    '-y',
    '-f', 'lavfi', '-i', `color=size=${CANVAS_SIZE}x${CANVAS_SIZE}:color=white`,
    '-vf', `drawtext=${drawtext}`,
    '-frames:v', '1',
    outPath
  ]
  try {
    await runFfmpeg(args)
  } finally {
    deleteFileSafe(txtPath)
  }
}

async function writeExif(webpBuffer, packname, author) {
  const img = new WebP.Image()
  await img.load(webpBuffer)

  const json = {
    'sticker-pack-id': `saitama-bot-${Date.now()}`,
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    emojis: ['🎨']
  }
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8')
  const exif = Buffer.concat([exifAttr, jsonBuffer])
  exif.writeUIntLE(jsonBuffer.length, 14, 4)

  img.exif = exif
  return img.save(null)
}

// Convierte un único frame PNG en un sticker webp estático (512x512)
async function buildStaticSticker(framePath, outPath) {
  const args = [
    '-y',
    '-i', framePath,
    '-vf', 'scale=512:512:flags=lanczos,format=rgba',
    '-c:v', 'libwebp',
    '-lossless', '0',
    '-quality', '90',
    outPath
  ]
  await runFfmpeg(args)
}

async function buildAnimatedSticker(frames, outPath) {
  const listPath = outPath.replace(/\.webp$/, '_list.txt')
  const lines = []
  for (const f of frames) {
    lines.push(`file '${f.replace(/'/g, "'\\''")}'`)
    lines.push(`duration ${FRAME_DURATION}`)
  }
  // el demuxer concat necesita repetir el último archivo sin duration
  lines.push(`file '${frames[frames.length - 1].replace(/'/g, "'\\''")}'`)
  fs.writeFileSync(listPath, lines.join('\n'), 'utf8')

  const args = [
    '-y',
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', `fps=12,scale=512:512:flags=lanczos,format=rgba`,
    '-loop', '0',
    '-preset', 'default',
    '-an', '-vsync', '0',
    '-c:v', 'libwebp',
    outPath
  ]
  try {
    await runFfmpeg(args)
  } finally {
    deleteFileSafe(listPath)
  }
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const fontPath = findFont(FONT_CANDIDATES)
  if (!fontPath) {
    return conn.sendMessage(m.chat, {
      text: `❌ No encontré ninguna fuente .ttf para generar el brat.\n\n> Corre en Termux: fc-list | grep -i bold\n> Y pon la ruta en la variable BRAT_FONT_PATH, o sube una fuente a plugins/assets/brat-font.ttf`
    }, { quoted: m })
  }
  // Fuente para emojis (opcional). Si no existe ninguna, simplemente los
  // emojis se saltan/renderizan como tofu con la fuente normal.
  const emojiFontPath = findFont(EMOJI_FONT_CANDIDATES)

  const raw = text?.trim()
  if (!raw) {
    return conn.sendMessage(m.chat, {
      text: `🟢 *BRAT GENERATOR*\n\n> ${usedPrefix}${command} <texto>\n> Ejemplo: ${usedPrefix}${command} hola mundo 😭\n\n💫 Modo animado (varios textos):\n> ${usedPrefix}${command} texto1|texto2|texto3 anímate`
    }, { quoted: m })
  }

  const isAnimated = /an[ií]mate/i.test(raw)
  const cleanInput = raw.replace(/an[ií]mate/i, '').trim()

  await m.react('🎨')

  // ── MODO ANIMADO ──
  if (isAnimated) {
    const phrases = cleanInput.split('|').map(s => s.trim()).filter(Boolean).slice(0, MAX_FRAMES)
    if (phrases.length < 2) {
      await m.react('❌')
      return conn.sendMessage(m.chat, {
        text: `❌ Para animar necesitas al menos 2 textos separados por "|".\n\n> Ejemplo: ${usedPrefix}${command} hola|mundo|brat anímate`
      }, { quoted: m })
    }

    const frameFiles = []
    const stickerPath = path.join(TEMP_DIR, `brat_${Date.now()}.webp`)
    try {
      for (let i = 0; i < phrases.length; i++) {
        const framePath = path.join(TEMP_DIR, `brat_frame_${Date.now()}_${i}.png`)
        await renderFrame(phrases[i], framePath, fontPath, emojiFontPath)
        frameFiles.push(framePath)
      }
      await buildAnimatedSticker(frameFiles, stickerPath)
      const rawSticker = fs.readFileSync(stickerPath)
      const finalSticker = await writeExif(rawSticker, STICKER_PACK_NAME, STICKER_PACK_AUTHOR)
      await conn.sendMessage(m.chat, { sticker: finalSticker }, { quoted: m })
      await m.react('✅')
    } catch (e) {
      console.error('[BRAT ANIM ERROR]', e.message)
      await m.react('❌')
      await conn.sendMessage(m.chat, { text: `❌ No se pudo generar la animación.\n${e.message}` }, { quoted: m })
    } finally {
      frameFiles.forEach(deleteFileSafe)
      deleteFileSafe(stickerPath)
    }
    return
  }

  // ── MODO ESTÁTICO ── (ahora genera sticker, igual que el modo animado)
  const framePath = path.join(TEMP_DIR, `brat_${Date.now()}.png`)
  const stickerPath = path.join(TEMP_DIR, `brat_static_${Date.now()}.webp`)
  try {
    await renderFrame(cleanInput, framePath, fontPath, emojiFontPath)
    await buildStaticSticker(framePath, stickerPath)
    const rawSticker = fs.readFileSync(stickerPath)
    const finalSticker = await writeExif(rawSticker, STICKER_PACK_NAME, STICKER_PACK_AUTHOR)
    await conn.sendMessage(m.chat, { sticker: finalSticker }, { quoted: m })
    await m.react('✅')
  } catch (e) {
    console.error('[BRAT ERROR]', e.message)
    await m.react('❌')
    await conn.sendMessage(m.chat, { text: `❌ No se pudo generar el sticker.\n${e.message}` }, { quoted: m })
  } finally {
    deleteFileSafe(framePath)
    deleteFileSafe(stickerPath)
  }
}

handler.help    = ['brat <texto>', 'brat texto1|texto2 anímate']
handler.tags    = ['tools', 'sticker']
handler.command = /^(brat)$/i
handler.desc    = 'Genera un sticker (estático o animado) estilo "brat" con fondo blanco, incluye emojis'

export default handler
