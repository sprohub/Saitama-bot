import fs from 'fs'
import path from 'path'
import axios from 'axios'

const MAX_VIDEOS_TO_SHOW = 10

function safeFileName(name) {
  return (
    String(name || 'video')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'video'
  )
}

function extractTextFromMessage(message) {
  return (
    message?.text ||
    message?.caption ||
    message?.body ||
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    ''
  )
}

function resolveUserInput(m, text) {
  const quoted = m.quoted || m.msg?.contextInfo?.quotedMessage || null
  const quotedText = extractTextFromMessage(quoted)
  return String(text || '').trim() || quotedText || ''
}

function formatViews(views) {
  if (!views) return 'N/A'
  return views.toString()
}

function formatDuration(duration) {
  if (!duration) return 'N/A'
  return duration.toString()
}

function formatVideoList(videos, startIndex = 0, limit = MAX_VIDEOS_TO_SHOW) {
  let list = ''
  const endIndex = Math.min(startIndex + limit, videos.length)
  
  for (let i = startIndex; i < endIndex; i++) {
    const video = videos[i]
    const index = i + 1
    list += `*${index}.* ${safeFileName(video.title)}\n`
    list += `   👁️ ${formatViews(video.views)} vistas | ⏱️ ${formatDuration(video.duration)}\n`
    list += `   👤 ${video.user}\n\n`
  }
  
  return list
}

async function sendVideoList(conn, chat, quoted, videos, page = 0) {
  const startIndex = page * MAX_VIDEOS_TO_SHOW
  const totalPages = Math.ceil(videos.length / MAX_VIDEOS_TO_SHOW)
  const currentPage = page + 1
  
  let caption = '⛓️ DENJI BOT ⛓️\n\n'
  caption += '⚡ *LISTA DE VIDEOS*\n\n'
  caption += formatVideoList(videos, startIndex)
  
  if (totalPages > 1) {
    caption += `📄 Página ${currentPage} de ${totalPages}\n`
    caption += `🔍 Usa .video <número> para ver detalles del video\n`
    if (currentPage < totalPages) {
      caption += `➡️ Usa .videos ${currentPage + 1} para siguiente página\n`
    }
    if (currentPage > 1) {
      caption += `⬅️ Usa .videos ${currentPage - 1} para página anterior\n`
    }
  } else {
    caption += `🔍 Usa .video <número> para ver detalles del video\n`
  }
  
  caption += '\n> A la orden, soy Denji ⛓️'
  
  await conn.sendMessage(chat, {
    text: caption
  }, { quoted })
}

async function sendVideoDetails(conn, chat, quoted, video) {
  let caption = '⛓️ DENJI BOT ⛓️\n\n'
  caption += '⚡ *DETALLES DEL VIDEO*\n\n'
  caption += `🎬 *Título:* ${safeFileName(video.title)}\n`
  caption += `👤 *Usuario:* ${video.user}\n`
  caption += `👁️ *Vistas:* ${formatViews(video.views)}\n`
  caption += `⏱️ *Duración:* ${formatDuration(video.duration)}\n`
  caption += `🔗 *Enlace:* ${video.url}\n\n`
  caption += '> A la orden, soy Denji ⛓️'
  
  if (video.image) {
    await conn.sendMessage(chat, {
      image: { url: video.image },
      caption: caption
    }, { quoted })
  } else {
    await conn.sendMessage(chat, {
      text: caption
    }, { quoted })
  }
}

let handler = async (m, { conn, text }) => {
  const userInput = resolveUserInput(m, text)
  
  // Cargar los datos de videos desde un archivo o usar los datos proporcionados
  let videosData = null
  
  try {
    // Si tienes un archivo JSON con los datos, puedes cargarlo así:
    // videosData = JSON.parse(fs.readFileSync('./videos.json', 'utf8'))
    
    // O usar los datos proporcionados directamente:
    videosData = {
      "creator": "Delirius (神志不清)",
      "status": true,
      "data": [
        // Aquí irían todos los videos del JSON que proporcionaste
        // Por brevedad, solo incluyo un ejemplo
        {
          "title": "RUSIAN BABE GETS ANAL GANGBANG DOUBLE PENETRATION  ROSSAVAXX",
          "views": "1.3M",
          "duration": "15:25",
          "rating": "",
          "user": "Brady Bud",
          "profile_url": "https://es.pornhub.com/pornstar/brady-bud",
          "url": "https://es.pornhub.com/view_video.php?viewkey=68dc4483909cb",
          "image": "https://pix-fl.phncdn.com/c6371/videos/202509/30/24491475/original_24491475.mp4/plain/ex:1:no/bg:0:0:0/rs:fit:320:180/vts:769?hdnea=st=1781153366~exp=1781239766~hdl=-1~hmac=324e6503b32127c4d1cdbb9f3905b3acfd4e8b52"
        }
        // ... resto de los videos
      ]
    }
  } catch (error) {
    console.error('Error al cargar los datos de videos:', error)
    return conn.sendMessage(m.chat, {
      text: '⛓️ DENJI BOT ⛓️\n\n💀 Error al cargar los datos de videos'
    }, { quoted: m })
  }
  
  if (!videosData || !videosData.data || videosData.data.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '⛓️ DENJI BOT ⛓️\n\n💀 No hay videos disponibles'
    }, { quoted: m })
  }
  
  const videos = videosData.data
  
  // Comando para mostrar la lista de videos
  if (m.command === 'videos' || m.command === 'list') {
    const pageNumber = parseInt(userInput) || 1
    const page = pageNumber > 0 ? pageNumber - 1 : 0
    
    if (page * MAX_VIDEOS_TO_SHOW >= videos.length) {
      return conn.sendMessage(m.chat, {
        text: '⛓️ DENJI BOT ⛓️\n\n💀 Página no encontrada'
      }, { quoted: m })
    }
    
    return await sendVideoList(conn, m.chat, m, videos, page)
  }
  
  // Comando para mostrar detalles de un video específico
  if (m.command === 'video' || m.command === 'detail') {
    const videoNumber = parseInt(userInput)
    
    if (isNaN(videoNumber) || videoNumber < 1 || videoNumber > videos.length) {
      return conn.sendMessage(m.chat, {
        text: '⛓️ DENJI BOT ⛓️\n\n💀 Número de video no válido\n\n⚡ *USO CORRECTO*\n🔗 .video <número>\n\n> Elige un número del 1 al ' + videos.length
      }, { quoted: m })
    }
    
    const video = videos[videoNumber - 1]
    return await sendVideoDetails(conn, m.chat, m, video)
  }
  
  // Comando para buscar videos por título
  if (m.command === 'search') {
    const searchTerm = userInput.toLowerCase().trim()
    
    if (!searchTerm) {
      return conn.sendMessage(m.chat, {
        text: '⛓️ DENJI BOT ⛓️\n\n💀 Debes proporcionar un término de búsqueda\n\n⚡ *USO CORRECTO*\n🔗 .search <término>\n\n> A la orden, soy Denji ⛓️'
      }, { quoted: m })
    }
    
    const filteredVideos = videos.filter(video => 
      video.title.toLowerCase().includes(searchTerm)
    )
    
    if (filteredVideos.length === 0) {
      return conn.sendMessage(m.chat, {
        text: `⛓️ DENJI BOT ⛓️\n\n💀 No se encontraron videos con "\${searchTerm}"`
      }, { quoted: m