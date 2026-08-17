import fetch from 'node-fetch'
import axios from 'axios'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const SAITAMA_IMG = 'https://i.ibb.co/TB7cZfFG/SAITAMAmenu.jpg'
const DELIRIUS_API = 'https://api.delirius.store' // 👈 dominio correcto (antes decía .online, no existe)
const REQUEST_TIMEOUT = 60000

const _processing = new Set()

function caja(lineas) {
  return (
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    lineas.map(l => `│ ${l}`).join('\n') +
    `\n╰───────────────⬣`
  )
}

// 📥 Descarga el video a buffer en vez de mandar la URL directa (más confiable,
// evita que WhatsApp falle al leer el CDN de TikTok directamente)
async function descargarBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  return Buffer.from(res.data)
}

async function enviarVideo(conn, m, videoUrl, datos, tituloFallback = '') {
  const buffer = await descargarBuffer(videoUrl)

  await conn.sendMessage(m.chat, {
    video: buffer,
    caption: caja([
      '✅ Descarga completada',
      '',
      `🎬 ${datos.title || tituloFallback}`,
      `👤 ${datos.author?.nickname || ''}`,
      `⏱️ ${datos.duration || ''}s`
    ])
  }, { quoted: m })
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const msgKey = `tiktok_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 15000)

  if (!text) {
    let media
    try {
      media = await prepareWAMessageMedia({ image: { url: SAITAMA_IMG } }, { upload: conn.waUploadToServer })
    } catch {}

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌿 SAITAMA-BOT — TikTok',
        subtitle: 'Busca y descarga videos',
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text: caja([
          '🍃 Busca videos en TikTok',
          '',
          `🌱 Uso: ${usedPrefix}${command} <búsqueda>`,
          `🌱 Ejemplo: ${usedPrefix}${command} Chaewon`
        ])
      },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '📖 Ver cómo buscar',
              id: 'ttinfo'
            })
          }
        ]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return
  }

  let query = text.trim()
  let isDirectLink = query.includes('tiktok.com') || query.includes('vm.tiktok.com')

  if (isDirectLink) {
    await m.react('⏳')

    try {
      let downloadUrl = `${DELIRIUS_API}/download/tiktok?url=${encodeURIComponent(query)}`
      let res = await fetch(downloadUrl)
      let json = await res.json()

      if (!json.status || !json.data?.meta?.media?.[0]?.org) {
        throw new Error('No se pudo descargar')
      }

      await enviarVideo(conn, m, json.data.meta.media[0].org, json.data)
      await m.react('✅')

    } catch (e) {
      console.error('[tiktok] Error en descarga por link:', e)
      await m.react('❌')
      conn.sendMessage(m.chat, {
        text: caja(['❌ Error al descargar', e.message ? `Motivo: ${e.message}` : ''].filter(Boolean))
      }, { quoted: m })
    }
    return
  }

  await m.react('🔍')

  try {
    let searchUrl = `${DELIRIUS_API}/search/tiktoksearch?query=${encodeURIComponent(query)}`
    let searchRes = await fetch(searchUrl)
    let searchData = await searchRes.json()

    if (!searchData.status || !searchData.meta?.length) {
      throw new Error('No se encontraron resultados')
    }

    let resultados = searchData.meta.slice(0, 10)
    let media
    try {
      media = await prepareWAMessageMedia({ image: { url: SAITAMA_IMG } }, { upload: conn.waUploadToServer })
    } catch {}

    let rows = resultados.map((video, i) => ({
      header: '🎬 ' + (video.author?.nickname || video.author?.username || 'Desconocido'),
      title: video.title?.substring(0, 35) || 'Sin título',
      description: '⏱️ ' + (video.duration || '?') + 's | ❤️ ' + (video.like?.toLocaleString() || '?'),
      id: 'ttdl_' + i + '_' + Buffer.from(video.url).toString('base64') + '_' + Buffer.from(video.title?.substring(0, 30) || '').toString('base64')
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌿 SAITAMA-BOT — TikTok',
        subtitle: 'Selecciona un video',
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text: caja([
          `🔍 Búsqueda: ${query}`,
          '',
          '🍃 Elige un video para descargar'
        ])
      },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎬 RESULTADOS',
            sections: [{ title: '📋 ' + query.toUpperCase(), rows }]
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('✅')

  } catch (e) {
    console.error('[tiktok] Error en búsqueda:', e)
    await m.react('❌')
    conn.sendMessage(m.chat, {
      text: caja(['❌ No se encontraron resultados', e.message ? `Motivo: ${e.message}` : ''].filter(Boolean))
    }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId || null
  } catch { return false }

  if (!id) return false

  if (id === 'ttinfo') {
    await conn.sendMessage(m.chat, {
      text: caja(['Escribe así:', '.tiktok Chaewon', '', 'O pega un link directo de TikTok.'])
    }, { quoted: m })
    return true
  }

  if (!id.startsWith('ttdl_')) return false

  const msgKey = `ttdl_${m.id || m.key?.id}`
  if (_processing.has(msgKey)) return true
  _processing.add(msgKey)
  setTimeout(() => _processing.delete(msgKey), 30000)

  try {
    let parts = id.split('_')
    let urlBase64 = parts[2]
    let titleBase64 = parts[3]
    let videoUrl = Buffer.from(urlBase64, 'base64').toString()
    let titulo = Buffer.from(titleBase64 || '', 'base64').toString()

    await m.react('⏳')
    await conn.sendMessage(m.chat, {
      text: caja(['⏳ Descargando...'])
    }, { quoted: m })

    let downloadUrl = `${DELIRIUS_API}/download/tiktok?url=${encodeURIComponent(videoUrl)}`
    let res = await fetch(downloadUrl)
    let json = await res.json()

    if (!json.status || !json.data?.meta?.media?.[0]?.org) {
      throw new Error('No se pudo descargar')
    }

    await enviarVideo(conn, m, json.data.meta.media[0].org, json.data, titulo)
    await m.react('✅')
    return true

  } catch (e) {
    console.error('[tiktok] Error al procesar selección:', e)
    await conn.sendMessage(m.chat, {
      text: caja([`❌ ${e.message}`])
    }, { quoted: m })
    await m.react('❌')
    return true
  }
}

handler.help = ['tiktok']
handler.tags = ['downloader']
handler.command = /^(tiktok|tt)$/i
handler.desc = 'Busca y descarga videos de TikTok'

export default handler
