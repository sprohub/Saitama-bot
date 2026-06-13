import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const SAITAMA_IMG = 'https://i.ibb.co/TB7cZfFG/SAITAMAmenu.jpg'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0 }
    user = global.db.data.users[who]
  }

  if (!text) {
    let media = await prepareWAMessageMedia({ image: { url: SAITAMA_IMG } }, { upload: conn.waUploadToServer })

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: 'SAITAMA BOT - TIKTOK',
        subtitle: 'Busca y descarga videos',
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      },
      body: {
        text: `╭━━⬣『 SAITAMA TIKTOK 』⬣
┃
┃ 🎵 » Busca videos en TikTok
┃
┃ 📌 » ${usedPrefix}${command} <búsqueda>
┃ 📌 » ${usedPrefix}${command} Chaewon
┃ 💎 » Cuesta 1 diamante por descarga
┃
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      },
      footer: { text: '⚡ SAITAMA BOT ⚡' },
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
                description: '💎 1 diamante | Ejemplo: Chaewon',
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

  if ((user.diamantes || user.diamond || 0) < 1) {
    return conn.sendMessage(m.chat, {
      text: `╭━━⬣『 SAITAMA TIKTOK 』⬣
┃
┃ 💔 » Sin diamantes suficientes
┃
┃ 💎 Necesitas: 1 diamante
┃ 💰 Tienes: ${user.diamantes || user.diamond || 0} 💎
┃
┃ > Usa #work para ganar
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
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

      if (user.diamantes !== undefined) {
        user.diamantes = (user.diamantes || 0) - 1
      } else {
        user.diamond = (user.diamond || 0) - 1
      }

      let videoUrl = json.data.meta.media[0].org
      let total = user.diamantes !== undefined ? user.diamantes : (user.diamond || 0)

      await conn.sendMessage(m.chat, {
        video: { url: videoUrl },
        caption: `╭━━⬣『 SAITAMA TIKTOK 』⬣
┃
┃ ✅ » Descarga completada
┃
┃ 🎬 » ${json.data.title || ''}
┃ 👤 » ${json.data.author?.nickname || ''}
┃ ⏱️ » ${json.data.duration || ''}s
┃ 💎 » Restantes: ${total}
┃
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      }, { quoted: m })

      await m.react('✅')

    } catch (e) {
      console.log(e)
      await m.react('❌')
      conn.sendMessage(m.chat, { text: `╭━━⬣『 SAITAMA TIKTOK 』⬣\n┃\n┃ ❌ » Error al descargar\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣` }, { quoted: m })
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
        title: 'SAITAMA BOT - TIKTOK',
        subtitle: 'Selecciona un video',
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      },
      body: {
        text: `╭━━⬣『 SAITAMA TIKTOK 』⬣
┃
┃ 🔍 » Búsqueda: ${query}
┃
┃ > Elige un video
┃ > 💎 1 diamante al descargar
┃
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      },
      footer: { text: '⚡ SAITAMA BOT ⚡' },
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
    conn.sendMessage(m.chat, { text: `╭━━⬣『 SAITAMA TIKTOK 』⬣\n┃\n┃ ❌ » No se encontraron resultados\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣` }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('ttdl_')) return false

    let who = m.sender
    let user = global.db.data.users[who]
    if (!user) {
      global.db.data.users[who] = { diamantes: 0, diamond: 0 }
      user = global.db.data.users[who]
    }

    let misDiamantes = user.diamantes || user.diamond || 0
    if (misDiamantes < 1) {
      await conn.sendMessage(m.chat, {
        text: `╭━━⬣『 SAITAMA TIKTOK 』⬣\n┃\n┃ 💔 » No tienes 1 diamante\n┃\n┃ > Usa #work para ganar\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      }, { quoted: m })
      return true
    }

    let parts = id.split('_')
    let urlBase64 = parts[2]
    let titleBase64 = parts[3]
    let videoUrl = Buffer.from(urlBase64, 'base64').toString()
    let titulo = Buffer.from(titleBase64, 'base64').toString()

    if (user.diamantes !== undefined) {
      user.diamantes = misDiamantes - 1
    } else {
      user.diamond = misDiamantes - 1
    }

    await m.react('⏳')
    await conn.sendMessage(m.chat, {
      text: `╭━━⬣『 SAITAMA TIKTOK 』⬣\n┃\n┃ ⏳ » Descargando...\n┃ 💎 » -1 diamante\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })

    let downloadUrl = `https://api.delirius.store/download/tiktok?url=${encodeURIComponent(videoUrl)}`
    let res = await fetch(downloadUrl)
    let json = await res.json()

    if (!json.status || !json.data?.meta?.media?.[0]?.org) {
      if (user.diamantes !== undefined) {
        user.diamantes = misDiamantes
      } else {
        user.diamond = misDiamantes
      }
      throw new Error('No se pudo descargar, diamantes devueltos')
    }

    let total = user.diamantes !== undefined ? user.diamantes : (user.diamond || 0)
    let videoDownloadUrl = json.data.meta.media[0].org

    await conn.sendMessage(m.chat, {
      video: { url: videoDownloadUrl },
      caption: `╭━━⬣『 SAITAMA TIKTOK 』⬣
┃
┃ ✅ » Descarga completada
┃
┃ 🎬 » ${json.data.title || titulo}
┃ 👤 » ${json.data.author?.nickname || ''}
┃ ⏱️ » ${json.data.duration || ''}s
┃ 💎 » Restantes: ${total}
┃
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })

    await m.react('✅')
    return true

  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, {
      text: `╭━━⬣『 SAITAMA TIKTOK 』⬣\n┃\n┃ ❌ » ${e.message}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })
    await m.react('❌')
    return true
  }
}

handler.help = ['tiktok']
handler.tags = ['downloader']
handler.command = /^(tiktok|tt)$/i
handler.desc = 'Busca y descarga videos de TikTok 💎1'

export default handler