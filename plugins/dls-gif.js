import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let handler = async (m, { conn, text }) => {
  if (!text) {
    let sections = [{
      title: '🔍 BUSCAR GIF',
      rows: [
        { header: '🔥 ACCIÓN', title: 'Goku', description: 'GIFs de Goku', id: 'tenor_Goku' },
        { header: '😂 MEMES', title: 'Meme', description: 'GIFs de memes', id: 'tenor_Meme' },
        { header: '🌸 ANIME', title: 'Naruto', description: 'GIFs de Naruto', id: 'tenor_Naruto' },
        { header: '😎 COOL', title: 'Luffy', description: 'GIFs de Luffy', id: 'tenor_Luffy' },
        { header: '💀 RANDOM', title: 'Dance', description: 'GIFs de baile', id: 'tenor_Dance' }
      ]
    }]

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🔍 HINATA TENOR 🔍', subtitle: 'Busca GIFs animados', hasMediaAttachment: false },
      body: { text: '🔍 「 HINATA TENOR 」 🔍\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Busca GIFs en Tenor\n📝 » Elige o escribe: #tenor <búsqueda>\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' },
      footer: { text: '⫏⫏ HINATA BOT ✿' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🔍 BÚSQUEDAS RÁPIDAS',
            sections: sections
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
    let apiUrl = `https://api.alyacore.xyz/search/tenor?query=${encodeURIComponent(text)}&key=api-9R960`
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.medias || json.medias.length === 0) {
      await m.react('❌')
      return conn.sendMessage(m.chat, {
        text: '🔍 「 HINATA TENOR 」 🔍\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Sin resultados\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
      }, { quoted: m })
    }

    let random = json.medias[Math.floor(Math.random() * json.medias.length)]

    if (random.type === 'video') {
      await conn.sendMessage(m.chat, {
        video: { url: random.data.url },
        caption: '🔍 「 HINATA TENOR 」 🔍\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » ' + text + '\n🎬 » ' + json.results + ' resultados\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
        gifPlayback: true
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        image: { url: random.data.url },
        caption: '🔍 「 HINATA TENOR 」 🔍\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » ' + text + '\n📷 » ' + json.results + ' resultados\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
      }, { quoted: m })
    }

    await m.react('✅')

  } catch (e) {
    console.log(e)
    await m.react('❌')
    conn.sendMessage(m.chat, { text: '❌ Error al buscar' }, { quoted: m })
  }
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id || !id.startsWith('tenor_')) return false

    let query = id.replace('tenor_', '')
    let apiUrl = `https://api.alyacore.xyz/search/tenor?query=${encodeURIComponent(query)}&key=api-9R960`
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.medias || json.medias.length === 0) {
      return conn.sendMessage(m.chat, { text: '❌ Sin resultados' }, { quoted: m })
    }

    let random = json.medias[Math.floor(Math.random() * json.medias.length)]

    if (random.type === 'video') {
      await conn.sendMessage(m.chat, {
        video: { url: random.data.url },
        caption: '🔍 「 HINATA TENOR 」 🔍\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » ' + query + '\n🎬 » ' + json.results + ' resultados\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
        gifPlayback: true
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        image: { url: random.data.url },
        caption: '🔍 「 HINATA TENOR 」 🔍\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » ' + query + '\n📷 » ' + json.results + ' resultados\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦'
      }, { quoted: m })
    }

    return true

  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['tenor']
handler.tags = ['downloader']
handler.command = /^(tenor|gif|stickerfinder)$/i
handler.desc = 'Busca GIFs en Tenor con botones'

export default handler