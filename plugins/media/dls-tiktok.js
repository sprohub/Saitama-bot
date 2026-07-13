import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const SAITAMA_IMG = 'https://i.ibb.co/TB7cZfFG/SAITAMAmenu.jpg'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    let media = await prepareWAMessageMedia({ image: { url: SAITAMA_IMG } }, { upload: conn.waUploadToServer })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌿 SAITAMA-BOT — TikTok',
        subtitle: 'Busca y descarga videos',
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      },
      body: {
        text:
          `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
          `│ 🍃 Busca videos en TikTok\n` +
          `│\n` +
          `│ 🌱 Uso: ${usedPrefix}${command} <búsqueda>\n` +
          `│ 🌱 Ejemplo: ${usedPrefix}${command} Chaewon\n` +
          `╰───────────────⬣`
      },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎵 TIKTOK',
            sections: [{
              title: '🔍 BUSCAR',
              rows: [{
                header: '🎬 VIDEO',
                title: 'Buscar video',
                description: 'Ejemplo: Chaewon',
                id: 'tt '
              }]
            }]
          })
        }]
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
      let downloadUrl = `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(query)}`
      let res = await fetch(downloadUrl)
      let json = await res.json()

      if (!json.status || !json.data?.meta?.media?.[0]?.org) {
        throw new Error('No se pudo descargar')
      }

      let videoUrl = json.data.meta.media[0].org

      await conn.sendMessage(m.chat, {
        video: { url: videoUrl },
        caption:
          `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
          `│ ✅ Descarga completada\n` +
          `│\n` +
          `│ 🎬 ${json.data.title || ''}\n` +
          `│ 👤 ${json.data.author?.nickname || ''}\n` +
          `│ ⏱️ ${json.data.duration || ''}s\n` +
          `╰───────────────⬣`
      }, { quoted: m })

      await m.react('✅')

    } catch (e) {
      console.log(e)
      await m.react('❌')
      conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ Error al descargar\n╰───────────────⬣`
      }, { quoted: m })
    }
    return
  }

  await m.react('🔍')

  try {
    let searchUrl = `https://api.delirius.store/search/tiktoksearch?query=${encodeURIComponent(query)}`
    let searchRes = await fetch(searchUrl)
    let searchData = await searchRes.json()

    if (!searchData.status || !searchData.meta?.length) {
      throw new Error('No se encontraron resultados')
    }

    let resultados = searchData.meta.slice(0, 10)
    let media = await prepareWAMessageMedia({ image: { url: SAITAMA_IMG } }, { upload: conn.waUploadToServer })

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
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      },
      body: {
        text:
          `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
          `│ 🔍 Búsqueda: ${query}\n` +
          `│\n` +
          `│ 🍃 Elige un video para descargar\n` +
          `╰───────────────⬣`
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

  } catch (e) {
    console.log(e)
    await m.react('❌')
    conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se encontraron resultados\n╰───────────────⬣`
    }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('ttdl_')) return false

    let parts = id.split('_')
    let urlBase64 = parts[2]
    let titleBase64 = parts[3]
    let videoUrl = Buffer.from(urlBase64, 'base64').toString()
    let titulo = Buffer.from(titleBase64, 'base64').toString()

    await m.react('⏳')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ⏳ Descargando...\n╰───────────────⬣`
    }, { quoted: m })

    let downloadUrl = `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(videoUrl)}`
    let res = await fetch(downloadUrl)
    let json = await res.json()

    if (!json.status || !json.data?.meta?.media?.[0]?.org) {
      throw new Error('No se pudo descargar')
    }

    let videoDownloadUrl = json.data.meta.media[0].org

    await conn.sendMessage(m.chat, {
      video: { url: videoDownloadUrl },
      caption:
        `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
        `│ ✅ Descarga completada\n` +
        `│\n` +
        `│ 🎬 ${json.data.title || titulo}\n` +
        `│ 👤 ${json.data.author?.nickname || ''}\n` +
        `│ ⏱️ ${json.data.duration || ''}s\n` +
        `╰───────────────⬣`
    }, { quoted: m })

    await m.react('✅')
    return true

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ ${e.message}\n╰───────────────⬣`
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
