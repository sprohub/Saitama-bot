import fetch from 'node-fetch'

let handler = async (m, { conn, text }) => {
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: '📸 「 HINATA INSTAGRAM 」 📸\n\n💫 » Descarga videos de Instagram\n\n> #ig <link>\n> #instagram <link>'
    }, { quoted: m })
  }

  if (!text.includes('instagram.com')) {
    return conn.sendMessage(m.chat, {
      text: '📸 「 HINATA INSTAGRAM 」 📸\n\n💫 » Solo links de Instagram'
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    let apiUrl = `https://api.delirius.store/download/instagram?url=${encodeURIComponent(text)}`
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.data?.length) {
      throw new Error('No se pudo descargar')
    }

    for (let item of json.data) {
      if (item.type === 'video') {
        await conn.sendMessage(m.chat, {
          video: { url: item.url },
          caption: '📸 「 HINATA INSTAGRAM 」 📸\n\n💫 » Descarga completada'
        }, { quoted: m })
      } else if (item.type === 'image') {
        await conn.sendMessage(m.chat, {
          image: { url: item.url },
          caption: '📸 「 HINATA INSTAGRAM 」 📸\n\n💫 » Descarga completada'
        }, { quoted: m })
      }
    }

    await m.react('✅')

  } catch (e) {
    console.log(e)
    await m.react('❌')
    conn.sendMessage(m.chat, { text: '❌ Error al descargar' }, { quoted: m })
  }
}

handler.help = ['instagram']
handler.tags = ['downloader']
handler.command = /^(instagram|ig|insta)$/i
handler.desc = 'Descarga videos e imágenes de Instagram'

export default handler