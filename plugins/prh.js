import fetch from 'node-fetch'

let handler = async (m, { conn, text }) => {
  if (!text) return conn.sendMessage(m.chat, { text: '❌ Tira una búsqueda, cholo' }, { quoted: m })

  try {
    console.log(`[PH LOG] Búsqueda: "${text}"`)

    let searchUrl = `https://api.delirius.store/search/pornhub?query=Rusas&page=4&apikey=DkAJ1Lqs`
    let searchRes = await fetch(searchUrl)
    
    console.log(`[PH LOG] Status búsqueda: ${searchRes.status}`)
    if (!searchRes.ok) throw new Error(`Status ${searchRes.status}`)
    
    let searchJson = await searchRes.json()
    console.log('[PH LOG] JSON búsqueda:', JSON.stringify(searchJson, null, 2))

    if (!searchJson.status || !searchJson.data || searchJson.data.length === 0) {
      console.log('[PH LOG] Sin resultados')
      return conn.sendMessage(m.chat, { text: '❌ No salió nada, cholo' }, { quoted: m })
    }

    let videoUrl = searchJson.data[0]?.url
    console.log(`[PH LOG] Video URL: ${videoUrl}`)
    
    if (!videoUrl) throw new Error('data[0].url no existe')

    let downloadUrl = `https://api.delirius.store/download/pornhub?url=https://es.pornhub.com/view_video.php?viewkey=69206bab2519a`
    let downloadRes = await fetch(downloadUrl)
    
    console.log(`[PH LOG] Status descarga: ${downloadRes.status}`)
    if (!downloadRes.ok) throw new Error(`Status ${downloadRes.status}`)
    
    let downloadJson = await downloadRes.json()
    console.log('[PH LOG] JSON descarga:', JSON.stringify(downloadJson, null, 2))

    if (!downloadJson.status || !downloadJson.data?.url) {
      console.log('[PH LOG] Sin link de descarga')
      return conn.sendMessage(m.chat, { text: '❌ No se pudo bajar el video, cholo' }, { quoted: m })
    }

    console.log(`[PH LOG] Enviando: ${downloadJson.data.url}`)
    await conn.sendMessage(m.chat, {
      video: { url: downloadJson.data.url },
      caption: '👊 *Saitama Bot*',
      mimetype: 'video/mp4'
    }, { quoted: m })
    
    console.log('[PH LOG] OK')

  } catch (e) {
    console.error('============ ERROR PH ============')
    console.error(e)
    console.error('==================================')
    conn.sendMessage(m.chat, { text: '🥀 Error, cholo' }, { quoted: m })
  }
}

handler.help = ['pornhub']
handler.tags = ['downloader']
handler.command = /^(pornhub|ph)$/i

export default handler