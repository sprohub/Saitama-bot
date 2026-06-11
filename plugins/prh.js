import fetch from 'node-fetch'

// Base de datos temporal para estados por chat
const pornhubStates = new Map()

let handler = async (m, { conn, text, command, usedPrefix }) => {
  // Sistema de activación/desactivación
  if (text === 'on' || text === 'off') {
    const chatId = m.chat
    if (text === 'on') {
      pornhubStates.set(chatId, true)
      return conn.sendMessage(m.chat, { 
        text: '✅ *PornHub activado* en este chat\nUsa *.prh texto* para buscar\n*.prh aleatorio* para video random\n*.prh off* para desactivar' 
      }, { quoted: m })
    } else {
      pornhubStates.delete(chatId)
      return conn.sendMessage(m.chat, { 
        text: '❌ *PornHub desactivado* en este chat' 
      }, { quoted: m })
    }
  }

  // Verificar si está activado en este chat
  if (!pornhubStates.has(m.chat)) {
    return conn.sendMessage(m.chat, { 
      text: `⚠️ El comando está desactivado\nUsa *${usedPrefix}prh on* para activar` 
    }, { quoted: m })
  }

  // Comando aleatorio
  if (text === 'aleatorio') {
    try {
      // Categorías comunes para búsqueda aleatoria
      const categories = ['teen', 'milf', 'anal', 'blowjob', 'creampie', 'hardcore', 'lesbian', 'latina']
      const randomCategory = categories[Math.floor(Math.random() * categories.length)]
      text = randomCategory
    } catch (e) {
      return conn.sendMessage(m.chat, { text: '❌ Error generando búsqueda aleatoria' }, { quoted: m })
    }
  }

  // Si no hay texto después de on/off/aleatorio
  if (!text) {
    return conn.sendMessage(m.chat, { 
      text: `📌 *Uso correcto:*\n• *${usedPrefix}prh on* - Activar en este chat\n• *${usedPrefix}prh off* - Desactivar\n• *${usedPrefix}prh texto* - Buscar videos\n• *${usedPrefix}prh aleatorio* - Video random` 
    }, { quoted: m })
  }

  // Procesar búsqueda
  try {
    let searchUrl = `https://api.delirius.store/search/pornhub?query=${encodeURIComponent(text)}&page=1&apikey=DkAJ1Lqs`
    let searchRes = await fetch(searchUrl)
    let searchJson = await searchRes.json()

    if (!searchJson.status || !searchJson.data || searchJson.data.length === 0) {
      return conn.sendMessage(m.chat, { text: '❌ No encontré videos con esa búsqueda' }, { quoted: m })
    }

    // Para búsqueda aleatoria, seleccionar video random de los resultados
    const videoIndex = Math.floor(Math.random() * searchJson.data.length)
    let videoUrl = searchJson.data[videoIndex].url
    
    let downloadUrl = `https://api.delirius.store/download/pornhub?url=${videoUrl}`
    let downloadRes = await fetch(downloadUrl)
    let downloadJson = await downloadRes.json()

    if (!downloadJson.status || !downloadJson.data?.url) {
      return conn.sendMessage(m.chat, { text: '❌ Error al descargar el video' }, { quoted: m })
    }

    await conn.sendMessage(m.chat, {
      video: { url: downloadJson.data.url },
      caption: `🔞 *PornHub*\n📝 Búsqueda: ${text}\n🎬 *Saitama Bot*`,
      gifPlayback: false
    }, { quoted: m })

  } catch (e) {
    console.error(e)
    conn.sendMessage(m.chat, { text: '❌ Error en la búsqueda' }, { quoted: m })
  }
}

// Configuración del comando
handler.help = ['pornhub']
handler.tags = ['downloader', 'nsfw']
handler.command = /^(prh|pornhub|ph)$/i
handler.desc = 'Sistema de descarga PornHub'
handler.group = true
handler.admin = false

export default handler
