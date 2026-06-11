import fetch from 'node-fetch'

// Base de datos temporal para estados por chat
const pornhubStates = new Map()

// Números autorizados (solo ellos pueden on/off)
const allowedOwners = [
  '573225396540@s.whatsapp.net',
  '573225814649@s.whatsapp.net'
]

let handler = async (m, { conn, text, command, usedPrefix }) => {
  
  if (text === 'on' || text === 'off') {
    if (!allowedOwners.includes(m.sender)) {
      return conn.sendMessage(m.chat, { 
        text: '❌ *Solo los propietarios pueden activar/desactivar este comando.*' 
      }, { quoted: m })
    }

    const chatId = m.chat
    if (text === 'on') {
      pornhubStates.set(chatId, true)
      return conn.sendMessage(m.chat, { 
        text: '✅ *PornHub activado* en este chat\nUsa *.prh texto* para buscar\n*.prh aleatorio* para video random' 
      }, { quoted: m })
    } else {
      pornhubStates.delete(chatId)
      return conn.sendMessage(m.chat, { 
        text: '❌ *PornHub desactivado* en este chat' 
      }, { quoted: m })
    }
  }

  if (!pornhubStates.has(m.chat)) {
    return conn.sendMessage(m.chat, { 
      text: `⚠️ Comando desactivado\nUsa *${usedPrefix}prh on* para activar` 
    }, { quoted: m })
  }

  if (text === 'aleatorio') {
    const categories = ['teen', 'milf', 'anal', 'blowjob', 'creampie', 'hardcore', 'lesbian', 'latina', 'ebony']
    text = categories[Math.floor(Math.random() * categories.length)]
  }

  if (!text) {
    return conn.sendMessage(m.chat, { 
      text: `📌 *Uso:*\n\( {usedPrefix}prh on\n \){usedPrefix}prh off\n\( {usedPrefix}prh [texto]\n \){usedPrefix}prh aleatorio` 
    }, { quoted: m })
  }

  try {
    // 1. Búsqueda
    const searchUrl = `https://api.delirius.store/search/pornhub?query=${encodeURIComponent(text)}&page=1&apikey=DkAJ1Lqs`
    const searchRes = await fetch(searchUrl)
    const searchJson = await searchRes.json()

    if (!searchJson.status || !searchJson.data?.length) {
      return conn.sendMessage(m.chat, { text: '❌ No se encontraron videos' }, { quoted: m })
    }

    // 2. Tomar un video aleatorio
    const randomVideo = searchJson.data[Math.floor(Math.random() * searchJson.data.length)]
    const videoPageUrl = randomVideo.url

    // 3. Descarga (API que mencionaste)
    const downloadUrl = `https://api.delirius.store/download/pornhub?url=${encodeURIComponent(videoPageUrl)}`
    
    const downloadRes = await fetch(downloadUrl)
    const downloadJson = await downloadRes.json()

    if (!downloadJson.status || !downloadJson.data?.url) {
      console.error('Download API error:', downloadJson)
      return conn.sendMessage(m.chat, { 
        text: '❌ La API de descarga falló. Inténtalo de nuevo.' 
      }, { quoted: m })
    }

    // 4. Enviar video
    await conn.sendMessage(m.chat, {
      video: { url: downloadJson.data.url },
      caption: `🔞 *PornHub* | Saitama Bot\n🔎 Búsqueda: ${text}\n📌 Título: ${randomVideo.title || 'Sin título'}`,
      gifPlayback: false
    }, { quoted: m })

  } catch (e) {
    console.error(e)
    conn.sendMessage(m.chat, { text: '❌ Error al procesar la solicitud' }, { quoted: m })
  }
}

handler.help = ['pornhub']
handler.tags = ['downloader', 'nsfw']
handler.command = /^(prh|pornhub|ph)$/i
handler.group = true

export default handler