import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌿 SAITAMA-BOT · Spotify',
        subtitle: 'Busca y descarga música',
        hasMediaAttachment: false
      },
      body: {
        text: decorar(`Busca música en Spotify\n\n${usedPrefix}${command} <nombre>\nEjemplo: ${usedPrefix}${command} Twice`)
      },
      footer: { text: '🍃 SAITAMA-BOT' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎵 Spotify',
            sections: [{
              title: '🔍 Buscar',
              rows: [{
                header: '🎧 Música',
                title: 'Buscar canción',
                description: 'Ejemplo: Twice',
                id: 'sp '
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

  await m.react('🔍')

  try {
    let searchUrl = `https://api.delirius.store/search/spotify?q=${encodeURIComponent(text)}&limit=10`
    let searchRes = await fetch(searchUrl)
    let searchData = await searchRes.json()

    if (!searchData.status || !searchData.data?.length) {
      throw new Error('No se encontraron resultados')
    }

    let resultados = searchData.data.slice(0, 10)
    let primeraImagen = resultados[0].image || ''

    let media = null
    if (primeraImagen) {
      media = await prepareWAMessageMedia({ image: { url: primeraImagen } }, { upload: conn.waUploadToServer })
    }

    let rows = resultados.map((track, i) => ({
      header: '🎵 ' + (track.artist || 'Desconocido'),
      title: track.title.substring(0, 35),
      description: '💿 ' + (track.album || '') + ' | ⏱️ ' + (track.duration || '?'),
      id: 'spotdl_' + i + '_' + Buffer.from(track.url).toString('base64') + '_' + Buffer.from(track.title).toString('base64')
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: '🌿 SAITAMA-BOT · Spotify',
        subtitle: 'Selecciona una canción',
        hasMediaAttachment: !!media,
        imageMessage: media ? media.imageMessage : undefined
      },
      body: {
        text: decorar(`Búsqueda: ${text}\n\nElige una canción de la lista`)
      },
      footer: { text: '🍃 SAITAMA-BOT' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎵 Resultados',
            sections: [{ title: `📋 ${text.toUpperCase()}`, rows }]
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
    conn.sendMessage(m.chat, { text: decorar('No se encontraron resultados.') }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('spotdl_')) return false

    let parts = id.split('_')
    let urlBase64 = parts[2]
    let titleBase64 = parts[3]
    let spotifyUrl = Buffer.from(urlBase64, 'base64').toString()
    let titulo = Buffer.from(titleBase64, 'base64').toString()

    await m.react('⏳')
    await conn.sendMessage(m.chat, { text: decorar('Descargando...') }, { quoted: m })

    let downloadUrl = `https://api.delirius.store/download/spotifydl?url=${encodeURIComponent(spotifyUrl)}`
    let res = await fetch(downloadUrl)
    let json = await res.json()

    if (!json.status || !json.data?.download) {
      throw new Error('No se pudo descargar la canción')
    }

    await conn.sendMessage(m.chat, {
      audio: { url: json.data.download },
      mimetype: 'audio/mpeg',
      fileName: (json.data.title || titulo) + '.mp3'
    }, { quoted: m })

    if (json.data.image) {
      await conn.sendMessage(m.chat, {
        image: { url: json.data.image },
        caption: decorar(`Descarga completada\n\n🎧 ${json.data.title || titulo}\n👤 ${json.data.author || ''}`)
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        text: decorar(`Descarga completada\n\n🎧 ${json.data.title || titulo}\n👤 ${json.data.author || ''}`)
      }, { quoted: m })
    }

    await m.react('✅')
    return true

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: decorar(`Error: ${e.message}`) }, { quoted: m })
    await m.react('❌')
    return true
  }
}

handler.help = ['spotify']
handler.tags = ['downloader']
handler.command = /^(spotify|sp)$/i
handler.desc = 'Busca y descarga música de Spotify'

export default handler
