import fetch from 'node-fetch'

let handler = async (m, { conn, text }) => {
  if (!text) return conn.sendMessage(m.chat, { text: '❌ Tira una búsqueda, cholo' }, { quoted: m })

  try {
    let searchUrl = `https://api.delirius.store/search/pornhub?query=${encodeURIComponent(text)}&page=1&apikey=DkAJ1Lqs`
    let searchRes = await fetch(searchUrl)
    let searchJson = await searchRes.json()

    if (!searchJson.status || !searchJson.data || searchJson.data.length === 0) {
      return conn.sendMessage(m.chat, { text: '❌ No salió nada, cholo' }, { quoted: m })
    }

    let videoUrl = searchJson.data[0].url
    let downloadUrl = `https://api.delirius.store/download/pornhub?url=${videoUrl}`
    let downloadRes = await fetch(downloadUrl)
    let downloadJson = await downloadRes.json()

    if (!downloadJson.status || !downloadJson.data?.url) {
      return conn.sendMessage(m.chat, { text: '❌ No se pudo bajar el video, cholo' }, { quoted: m })
    }

    await conn.sendMessage(m.chat, {
      video: { url: downloadJson.data.url },
      caption: '👊 *Saitama Bot*',
      gifPlayback: false
    }, { quoted: m })

  } catch (e) {
    conn.sendMessage(m.chat, { text: '❌ Error, cholo' }, { quoted: m })
  }
}

handler.help = ['pornhub']
handler.tags = ['downloader']
handler.command = /^(pornhub|ph)$/i
handler.desc = 'Baja videos de PH'

export default handler