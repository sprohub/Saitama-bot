import fetch from 'node-fetch'

let handler = async (m, { conn, text, command }) => {
  if (!text) return conn.sendMessage(m.chat, { text: `✦ Ingresa un nombre.\nEjemplo: *${command} Saitama*` }, { quoted: m })

  try {
    let res = await fetch(`https://api.delirius.store/tools/symbols?query=${encodeURIComponent(text)}`)
    let json = await res.json()

    if (!json.status || !json.data || !json.data.symbols || json.data.symbols.length === 0) {
      return conn.sendMessage(m.chat, { text: '⚠️ No se encontraron resultados.' }, { quoted: m })
    }

    let symbols = json.data.symbols
    let total = symbols.length

    let texto = '╭━━⬣ ✦ AESTHETIC SYMBOLS ✦\n┃\n'
    texto += `┃ 🔎 » ${text}\n`
    texto += `┃ 📦 » ${total} resultados\n┃\n`

    symbols.slice(0, 30).forEach((s, i) => {
      texto += `┃ ${i + 1}. ${s} ${text}\n`
    })

    texto += '┃\n╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA'

    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  } catch (e) {
    console.log(e)
    await conn.sendMessage(m.chat, { text: '❌ Error al conectar con la API.' }, { quoted: m })
  }
}

handler.help = ['nicksymbol <nombre>']
handler.tags = ['tools']
handler.command = /^(nicksymbol|symbols|aesthetic)$/i

export default handler