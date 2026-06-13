global.lastSymbols = global.lastSymbols || {}

let handler = async (m, { conn, text, command }) => {
  let data = global.lastSymbols[m.sender]

  if (!data) {
    return conn.sendMessage(m.chat, { text: `⚠️ Primero usa *.symbols <nombre>* para generar la lista.` }, { quoted: m })
  }

  let num = parseInt(text)

  if (!text || isNaN(num) || num < 1 || num > data.symbols.length) {
    return conn.sendMessage(m.chat, { text: `✦ Ingresa un número válido del 1 al ${data.symbols.length}.\nEjemplo: *${command} 5*` }, { quoted: m })
  }

  let elegido = data.symbols[num - 1]
  let resultado = `${elegido} ${data.name}`

  let texto = '╭━━⬣ ✦ TU SÍMBOLO ✦\n┃\n'
  texto += `┃ ${resultado}\n┃\n`
  texto += '╰━━━━━━━━━━━━━━━━━━━━━━⬣ SAITAMA'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['locatesimb <número>']
handler.tags = ['tools']
handler.command = /^(locatesimb|locatesymbol)$/i

export default handler