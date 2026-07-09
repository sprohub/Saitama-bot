import axios from 'axios'
import fs from 'fs'
import path from 'path'

// ⚠️ CONFIGURA AQUÍ
const CHANNEL_ID = 'UCnczRUnaWOLBq9SEjDQ-aXg' // <-- tu Channel ID
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

async function obtenerUltimoVideo() {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
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
  // Miniatura en alta resolución (maxresdefault); si no existe, YouTube sirve la de menor calidad automáticamente
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`

  return { videoId, titulo, link, thumbnail }
}

async function revisarCanal(conn) {
  try {
    const ultimo = await obtenerUltimoVideo()
    if (!ultimo) return

    const idGuardado = leerUltimoId()

    // Primera vez que corre: solo guarda, no envía (evita spam de "video viejo")
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
          await new Promise(r => setTimeout(r, 1500)) // pausa para no floodear/banear
        } catch (e) {
          console.log('Error enviando a', jid, e)
        }
      }
    }
  } catch (e) {
    console.log('Error revisando canal de YouTube:', e.message)
  }
}

// Se activa cuando el plugin es cargado. "global.conn" debe existir ya
// en tu bot al momento de cargar plugins (así funciona en la mayoría de forks).
if (global.conn) {
  setInterval(() => revisarCanal(global.conn), INTERVALO_MINUTOS * 60 * 1000)
}

// Handler "dummy" por si tu loader exige que cada plugin tenga comando
let handler = async () => {}
handler.command = /^(ultimovideo)$/i
handler.help = ['ultimovideo']
handler.tags = ['diversion']
handler.desc = 'Fuerza revisión del canal de YouTube y muestra el último video'

// Sobreescribimos el handler para que el comando manual sí funcione
handler = async (m, { conn }) => {
  const video = await obtenerUltimoVideo()
  if (!video) return m.reply('No se pudo obtener el último video.')
  let texto = `╭─⪼ *🎬 ÚLTIMO VIDEO*\n`
  texto += `│ 📌 » ${video.titulo}\n`
  texto += `│ 🔗 » ${video.link}\n`
  texto += `╰───────────────⬣`
  await conn.sendMessage(m.chat, { image: { url: video.thumbnail }, caption: texto }, { quoted: m })
}
handler.command = /^(ultimovideo)$/i
handler.help = ['ultimovideo']
handler.tags = ['diversion']

export default handler
