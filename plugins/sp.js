import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

// =============================================
//   CONFIGURACIÓN — edita solo esta sección
// =============================================
const OWNER       = '573225396540'
const API_BASE    = 'https://api.delirius.store'         // Cambia aquí tu API base
const SEARCH_PATH = '/search/ytsearch'                   // Ruta de búsqueda
const API_KEY     = ''                                   // Pon tu apikey si la necesitas
const MAX_RESULTS = 5                                    // Máximo de resultados
// =============================================

function buildSearchUrl(query) {
  const params = new URLSearchParams({ q: query })
  if (API_KEY) params.set('apikey', API_KEY)
  return `${API_BASE}${SEARCH_PATH}?${params}`
}

let handler = async (m, { conn, text }) => {
  const sender = m.sender.replace(/[^0-9]/g, '').replace(/@.+/, '')
  const isOwner = sender === OWNER
  const arg = text?.trim() || ''
  const argLower = arg.toLowerCase()

  // .sp on / .sp off por grupo
  if (argLower === 'on') {
    if (!isOwner) return conn.sendMessage(m.chat, { text: '❌ Solo el dueño puede activar este comando.' }, { quoted: m })
    global.db.data.chats = global.db.data.chats || {}
    global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
    global.db.data.chats[m.chat].spEnabled = true
    return conn.sendMessage(m.chat, { text: '✅ Comando `.sp` *activado* en este grupo.' }, { quoted: m })
  }

  if (argLower === 'off') {
    if (!isOwner) return conn.sendMessage(m.chat, { text: '❌ Solo el dueño puede desactivar este comando.' }, { quoted: m })
    global.db.data.chats = global.db.data.chats || {}
    global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
    global.db.data.chats[m.chat].spEnabled = false
    return conn.sendMessage(m.chat, { text: '🔴 Comando `.sp` *desactivado* en este grupo.' }, { quoted: m })
  }

  // Verificar estado por grupo
  const spEnabled = global.db.data.chats?.[m.chat]?.spEnabled ?? false
  if (!spEnabled) {
    return conn.sendMessage(m.chat, {
      text: `🎬 「 SP 」\n\n⛔ *Este comando es solo para admins*\n\n> Contacta al dueño del bot para más información.`
    }, { quoted: m })
  }

  // Sin texto — mostrar ayuda
  if (!arg) {
    return conn.sendMessage(m.chat, {
      text: `🎬 「 SP — BUSCADOR 」\n\n> Uso: *.sp <nombre del video>*\n> Ejemplo: *.sp Naruto Opening 1*\n\n> Para video aleatorio: *.sp aleatorio*`
    }, { quoted: m })
  }

  await m.react('🔍')

  try {
    // Video aleatorio
    if (argLower === 'aleatorio') {
      const temas = ['musica', 'funny moments', 'anime', 'gaming', 'viral']
      const query = temas[Math.floor(Math.random() * temas.length)]
      const res  = await fetch(buildSearchUrl(query))
      const data = await res.json()
      if (!data.status || !data.data?.length) throw new Error('No se encontraron resultados.')

      const videos = data.data
      const video  = videos[Math.floor(Math.random() * videos.length)]

      let media = null
      if (video.thumbnail) {
        try { media = await prepareWAMessageMedia({ image: { url: video.thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
      }

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: {
          title: 'SP BOT — ALEATORIO',
          subtitle: String(video.title || '').slice(0, 60),
          hasMediaAttachment: !!media,
          imageMessage: media?.imageMessage
        },
        body: {
          text: `🎲 「 VIDEO ALEATORIO 」\n\n🎬 *${String(video.title || '').slice(0, 60)}*\n👤 ${video.author?.name || 'Desconocido'}\n⏱️ ${video.duration || '?'}\n👁️ ${Number(video.views || 0).toLocaleString()} vistas\n\n🔗 ${video.url}`
        },
        footer: { text: '⫏ SP BOT' },
        nativeFlowMessage: { buttons: [] }
      })

      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
      }, { quoted: m })
      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
      return await m.react('✅')
    }

    // Búsqueda normal
    const res  = await fetch(buildSearchUrl(arg))
    const data = await res.json()
    if (!data.status || !data.data?.length) throw new Error('No se encontraron resultados.')

    const resultados = data.data.slice(0, MAX_RESULTS)

    let media = null
    if (resultados[0]?.thumbnail) {
      try { media = await prepareWAMessageMedia({ image: { url: resultados[0].thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
    }

    const rows = resultados.map((v, i) => ({
      header: String(v.author?.name || 'Desconocido').slice(0, 20),
      title: String(v.title || '').slice(0, 35),
      description: `⏱️ ${v.duration || '?'} | 👁️ ${Number(v.views || 0).toLocaleString()}`,
      id: `spsel~${Buffer.from(v.url).toString('base64')}~${Buffer.from(String(v.title || 'video')).toString('base64')}~${Buffer.from(v.thumbnail || '').toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: 'SP BOT — BÚSQUEDA',
        subtitle: `Resultados: ${arg}`.slice(0, 60),
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text: `🔍 「 RESULTADOS 」\n\n💫 » Búsqueda: *${arg}*\n📋 ${resultados.length} videos encontrados\n\n> Elige el que quieras ver`
      },
      footer: { text: '⫏ SP BOT' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎬 VIDEOS',
            sections: [{
              title: arg.toUpperCase().slice(0, 24),
              rows
            }]
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
    await m.react('❌')
    const rawMsg = String(e?.message || '').toLowerCase()
    const humanMsg = rawMsg.includes('aborted') || rawMsg.includes('fetch')
      ? '😂 Despacio viejo, ¿eres Flash?\n⏳ Espera un momento e intenta de nuevo.'
      : rawMsg.includes('502') || rawMsg.includes('503')
      ? '⚠️ El servidor está saturado.\n🔁 Intenta más tarde.'
      : `❌ Algo salió mal, intenta de nuevo.`
    await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
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

  if (!id || !id.startsWith('spsel~')) return false

  const parts = id.split('~')
  if (parts.length < 3) return true

  let url = '', title = '', thumbnail = ''
  try {
    url       = Buffer.from(parts[1], 'base64').toString()
    title     = Buffer.from(parts[2], 'base64').toString()
    thumbnail = parts[3] ? Buffer.from(parts[3], 'base64').toString() : ''
  } catch {
    await conn.sendMessage(m.chat, { text: '❌ Error al procesar la selección.' }, { quoted: m })
    return true
  }

  let media = null
  if (thumbnail) {
    try { media = await prepareWAMessageMedia({ image: { url: thumbnail } }, { upload: conn.waUploadToServer }) } catch {}
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: {
      title: 'SP BOT',
      subtitle: String(title).slice(0, 60),
      hasMediaAttachment: !!media,
      imageMessage: media?.imageMessage
    },
    body: {
      text: `🎬 「 VIDEO SELECCIONADO 」\n\n*${String(title).slice(0, 100)}*\n\n🔗 ${url}`
    },
    footer: { text: '⫏ SP BOT' },
    nativeFlowMessage: { buttons: [] }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  return true
}

handler.help    = ['sp']
handler.tags    = ['search']
handler.command = /^(sp)$/i
handler.desc    = 'Busca videos en YouTube'

export default handler
