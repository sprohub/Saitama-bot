import fetch from 'node-fetch'
import axios from 'axios'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const SAITAMA_IMG = 'https://i.ibb.co/TB7cZfFG/SAITAMAmenu.jpg'
const DELIRIUS_API = 'https://api.delirius.online'
const REQUEST_TIMEOUT = 60000
const MAX_BYTES = 300 * 1024 * 1024 // 300MB límite de seguridad

const _processing = new Set()

function caja(lineas) {
  return (
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    lineas.map(l => `│ ${l}`).join('\n') +
    `\n╰───────────────⬣`
  )
}

async function descargarBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0' },
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES
  })
  return Buffer.from(res.data)
}

/**
 * 🧩 Cada "adaptador" sabe:
 * - detectar si un link le pertenece (regex)
 * - pedirle a Delirius los datos de descarga
 * - devolver { videoUrl, imageUrl, audioUrl, titulo, autor } (los que aplique)
 *
 * ⚠️ Los endpoints de instagram/facebook/twitter/capcut/pinterest están escritos
 * siguiendo el MISMO patrón que ya usas para tiktok/yt — pero no los probé en vivo
 * contra el servidor real. Si alguno da error, dime cuál y ajustamos solo esa función.
 */
const adaptadores = [
  {
    nombre: 'TikTok',
    test: url => /tiktok\.com|vm\.tiktok\.com/i.test(url),
    obtener: async (url) => {
      const res = await fetch(`${DELIRIUS_API}/download/tiktok?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!json.status || !json.data?.meta?.media?.[0]?.org) throw new Error('No se pudo obtener el video de TikTok')
      return {
        videoUrl: json.data.meta.media[0].org,
        titulo: json.data.title,
        autor: json.data.author?.nickname
      }
    }
  },
  {
    nombre: 'YouTube',
    test: url => /youtube\.com|youtu\.be/i.test(url),
    obtener: async (url, formato) => {
      const endpoint = formato === 'mp3' ? 'ytmp3' : 'ytmp4'
      const res = await fetch(`${DELIRIUS_API}/download/${endpoint}?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!json.status || !json.data?.download) throw new Error('No se pudo obtener el contenido de YouTube')
      return {
        videoUrl: formato === 'mp3' ? null : json.data.download,
        audioUrl: formato === 'mp3' ? json.data.download : null,
        titulo: json.data.title,
        autor: json.data.author
      }
    }
  },
  {
    nombre: 'Instagram',
    test: url => /instagram\.com/i.test(url),
    obtener: async (url) => {
      const res = await fetch(`${DELIRIUS_API}/download/instagram?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!json.status || !json.data?.length) throw new Error('No se pudo obtener el contenido de Instagram')
      // suele devolver un array de medios (posts con varias fotos/videos)
      const primero = json.data[0]
      return {
        videoUrl: /video|mp4/i.test(primero.url || primero.type || '') ? (primero.url || primero.download) : null,
        imageUrl: !/video|mp4/i.test(primero.url || primero.type || '') ? (primero.url || primero.download) : null,
        titulo: json.data.title || ''
      }
    }
  },
  {
    nombre: 'Facebook',
    test: url => /facebook\.com|fb\.watch/i.test(url),
    obtener: async (url) => {
      const res = await fetch(`${DELIRIUS_API}/download/facebook?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!json.status || !json.data?.length) throw new Error('No se pudo obtener el video de Facebook')
      // suele devolver varias calidades, tomamos la de mejor resolución (normalmente la primera es HD)
      const mejor = json.data[0]
      return { videoUrl: mejor.url || mejor.download }
    }
  },
  {
    nombre: 'Twitter/X',
    test: url => /twitter\.com|x\.com/i.test(url),
    obtener: async (url) => {
      const res = await fetch(`${DELIRIUS_API}/download/twitter?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!json.status || !json.data?.url?.length) throw new Error('No se pudo obtener el video de Twitter/X')
      const mejor = json.data.url[json.data.url.length - 1] // suele venir de menor a mayor calidad
      return { videoUrl: mejor.url || mejor.download, titulo: json.data.title }
    }
  },
  {
    nombre: 'Pinterest',
    test: url => /pinterest\.com|pin\.it/i.test(url),
    obtener: async (url) => {
      const res = await fetch(`${DELIRIUS_API}/download/pinterest?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!json.status || !json.data) throw new Error('No se pudo obtener el contenido de Pinterest')
      return {
        videoUrl: json.data.video || null,
        imageUrl: json.data.image || json.data.download || null
      }
    }
  },
  {
    nombre: 'CapCut',
    test: url => /capcut\.com/i.test(url),
    obtener: async (url) => {
      const res = await fetch(`${DELIRIUS_API}/download/capcut?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      if (!json.status || !json.data?.download) throw new Error('No se pudo obtener el video de CapCut')
      return { videoUrl: json.data.download, titulo: json.data.title }
    }
  }
]

function detectarAdaptador(url) {
  return adaptadores.find(a => a.test(url)) || null
}

async function enviarResultado(conn, m, resultado, tituloFallback = '') {
  if (resultado.audioUrl) {
    const buffer = await descargarBuffer(resultado.audioUrl)
    await conn.sendMessage(m.chat, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      fileName: `${(resultado.titulo || tituloFallback || 'audio').slice(0, 60)}.mp3`
    }, { quoted: m })
    return
  }

  if (resultado.videoUrl) {
    const buffer = await descargarBuffer(resultado.videoUrl)
    await conn.sendMessage(m.chat, {
      video: buffer,
      caption: caja([
        '✅ Descarga completada',
        resultado.titulo ? `🎬 ${resultado.titulo}` : null,
        resultado.autor ? `👤 ${resultado.autor}` : null
      ].filter(Boolean))
    }, { quoted: m })
    return
  }

  if (resultado.imageUrl) {
    const buffer = await descargarBuffer(resultado.imageUrl)
    await conn.sendMessage(m.chat, {
      image: buffer,
      caption: caja(['✅ Descarga completada', resultado.titulo ? `🖼️ ${resultado.titulo}` : null].filter(Boolean))
    }, { quoted: m })
    return
  }

  throw new Error('El resultado no trajo ningún archivo descargable.')
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `dl_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 20000)

  const partes = text?.trim().split(/\s+/) || []
  const url = partes.find(p => /^https?:\/\//i.test(p))
  const formato = partes.find(p => /^(mp3|mp4|audio|video)$/i.test(p))?.toLowerCase()

  if (!url) {
    let media
    try {
      media = await prepareWAMessageMedia({ image: { url: SAITAMA_IMG } }, { upload: conn.waUploadToServer })
    } catch {}

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌿 SAITAMA-BOT — Descargas',
        subtitle: 'Descarga de cualquier plataforma soportada',
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text: caja([
          '🍃 Pega un link y lo descargo automáticamente',
          '',
          `🌱 Uso: ${usedPrefix}${command} <link>`,
          `🌱 Con formato: ${usedPrefix}${command} <link> mp3`,
          '',
          '📦 Soportado: TikTok, YouTube, Instagram, Facebook, Twitter/X, Pinterest, CapCut'
        ])
      },
      footer: { text: '🍃 SAITAMA-BOT 🌿' }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return
  }

  const adaptador = detectarAdaptador(url)

  if (!adaptador) {
    return conn.sendMessage(m.chat, {
      text: caja([
        '❌ No reconozco esa plataforma todavía.',
        'Soportado: TikTok, YouTube, Instagram, Facebook, Twitter/X, Pinterest, CapCut'
      ])
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    const resultado = await adaptador.obtener(url, formato)
    await enviarResultado(conn, m, resultado)
    await m.react('✅')
  } catch (e) {
    console.error(`[dl] Error con ${adaptador.nombre}:`, e)
    await m.react('❌')
    await conn.sendMessage(m.chat, {
      text: caja([
        `❌ Error al descargar de ${adaptador.nombre}`,
        `Motivo: ${e.message}`
      ])
    }, { quoted: m })
  }
}

handler.help = ['dl <link>', 'descargar <link> [mp3|mp4]']
handler.tags = ['downloader']
handler.command = /^(dl|descargar|download|save)$/i
handler.desc = 'Descarga video/audio/imagen desde cualquier link soportado (TikTok, YouTube, Instagram, Facebook, Twitter/X, Pinterest, CapCut)'

export default handler
