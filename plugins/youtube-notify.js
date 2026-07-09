import axios from 'axios'
import fs from 'fs'
import path from 'path'

// ⚠️ CONFIGURA AQUÍ
const CHANNEL_ID = 'UCnczRUnaWOLBq9SEjDQ-aXg' // <-- tu Channel ID por defecto
const INTERVALO_MINUTOS = 5 // cada cuánto revisa si hay video nuevo

const DB_PATH = path.join(process.cwd(), 'lastVideoId.json')

function leerUltimoId() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')).lastId
  } catch {
    return null
  }
}

function guardarUltimoId(id) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ lastId: id }, null, 2))
}

// 🔎 Resuelve un @handle o nombre de usuario a su Channel ID (UC...)
// scrapeando el HTML público del canal (no requiere API key).
async function resolverChannelId(handleOrName) {
  let handle = handleOrName.trim()
  if (!handle) return null
  handle = handle.replace(/^@/, '')

  // Probamos primero como @handle moderno, luego como /c/ o /user/ legacy
  const urls = [
    `https://www.youtube.com/@${handle}`,
    `https://www.youtube.com/c/${handle}`,
    `https://www.youtube.com/user/${handle}`,
  ]

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })

      // Buscamos "channelId":"UCxxxxxxxx" en el HTML/JSON embebido
      const match = data.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)
      if (match) return match[1]

      // Fallback: <link rel="canonical" href=".../channel/UCxxxx">
      const canonical = data.match(/channel\/(UC[a-zA-Z0-9_-]{22})/)
      if (canonical) return canonical[1]
    } catch {
      // sigue probando con la siguiente URL
      continue
    }
  }

  return null
}

async function obtenerUltimoVideo(channelId = CHANNEL_ID) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  const { data } = await axios.get(url)

  const idMatch = data.match(/<yt:videoId>(.*?)<\/yt:videoId>/)
  const titleMatch = data.match(/<title>(.*?)<\/title>/g) // el [1] es el primer video (el [0] es el título del canal)
  const thumbMatch = data.match(/<media:thumbnail url="(.*?)"/)

  if (!idMatch) return null

  const videoId = idMatch[1]
  const titulo = titleMatch && titleMatch[1]
    ? titleMatch[1].replace(/<\/?title>/g, '')
    : 'Nuevo video'
  const link = `https://www.youtube.com/watch?v=${videoId}`
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

  return { videoId, titulo, link, thumbnail }
}

async function revisarCanal(conn) {
  try {
    const ultimo = await obtenerUltimoVideo(CHANNEL_ID)
    if (!ultimo) return

    const idGuardado = leerUltimoId()

    if (idGuardado === null) {
      guardarUltimoId(ultimo.videoId)
      return
    }

    if (ultimo.videoId !== idGuardado) {
      guardarUltimoId(ultimo.videoId)

      let texto = `╭─⪼ *🔔 NUEVO VIDEO*\n`
      texto += `│ 🎬 » ${ultimo.titulo}\n`
      texto += `│ 🔗 » ${ultimo.link}\n`
      texto += `╰───────────────⬣`

      const chats = Object.keys(conn.chats || {}).filter(jid => jid.endsWith('@g.us'))

      for (const jid of chats) {
        try {
          await conn.sendMessage(jid, { image: { url: ultimo.thumbnail }, caption: texto })
          await new Promise(r => setTimeout(r, 1500))
        } catch (e) {
          console.log('Error enviando a', jid, e)
        }
      }
    }
  } catch (e) {
    console.log('Error revisando canal de YouTube:', e.message)
  }
}

if (global.conn) {
  setInterval(() => revisarCanal(global.conn), INTERVALO_MINUTOS * 60 * 1000)
}

// 📌 Handler: .ultimovideo  → usa el canal por defecto (CHANNEL_ID)
//    .ultimovideo @canal → resuelve el handle y muestra su último video
let handler = async (m, { conn, text }) => {
  let channelId = CHANNEL_ID
  let etiquetaCanal = ''

  if (text && text.trim()) {
    await m.reply('🔎 Buscando canal, un momento...')
    const resuelto = await resolverChannelId(text)
    if (!resuelto) {
      return m.reply('❌ No pude encontrar ese canal. Verifica el @nombre e intenta de nuevo.')
    }
    channelId = resuelto
    etiquetaCanal = text.trim()
  }

  const video = await obtenerUltimoVideo(channelId)
  if (!video) return m.reply('No se pudo obtener el último video.')

  let texto = `╭─⪼ *🎬 ÚLTIMO VIDEO*\n`
  if (etiquetaCanal) texto += `│ 📺 » ${etiquetaCanal}\n`
  texto += `│ 📌 » ${video.titulo}\n`
  texto += `│ 🔗 » ${video.link}\n`
  texto += `╰───────────────⬣`

  await conn.sendMessage(m.chat, { image: { url: video.thumbnail }, caption: texto }, { quoted: m })
}
handler.command = /^(ultimovideo)$/i
handler.help = ['ultimovideo [@canal]']
handler.tags = ['diversion']
handler.desc = 'Muestra el último video del canal configurado, o de @canal si se especifica'

export default handler