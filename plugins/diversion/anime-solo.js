import fetch from 'node-fetch'

let handler = async (m, { conn }) => {
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.sender
  let name = '@' + who.split('@')[0]

  try {
    let apiUrl = 'https://api.delirius.store/reactions/solo'
    let res = await fetch(apiUrl)
    let json = await res.json()

    if (!json.status || !json.data?.url) {
      return conn.sendMessage(m.chat, { text: '❌ No se pudo obtener la reacción' }, { quoted: m })
    }

    await conn.sendMessage(m.chat, {
      video: { url: json.data.url },
      caption: name + ' está solo 🥵',
      gifPlayback: true,
      mentions: [who]
    }, { quoted: m })

  } catch (e) {
    console.log(e)
    conn.sendMessage(m.chat, { text: '❌ Error' }, { quoted: m })
  }
}

handler.help = ['solo']
handler.tags = ['anime']
handler.command = /^(solo|alone)$/i
handler.desc = '@usuario está solo'

export default handler