let handler = async (m, { conn }) => {
  let total = Object.keys(global.plugins).length
  let categorias = {}
  
  for (let plugin of Object.values(global.plugins)) {
    if (!plugin.tags) continue
    let tags = Array.isArray(plugin.tags) ? plugin.tags : [plugin.tags]
    for (let tag of tags) {
      if (!categorias[tag]) categorias[tag] = 0
      categorias[tag]++
    }
  }

  let texto = '📊 「 HINATA TOTALCMD 」 📊\n\n'
  texto += '⚡ » Total: ' + total + ' comandos\n\n'
  texto += '📋 » Por categoría:\n\n'
  
  let emojis = {
    main: '⭐', group: '👥', rpg: '⚔️', game: '🎮', gacha: '🎰',
    diversion: '🎪', anime: '🌸', serbot: '🤖', owner: '👑',
    downloader: '📥', info: 'ℹ️', sticker: '🌟'
  }

  for (let [cat, count] of Object.entries(categorias)) {
    let emoji = emojis[cat] || '📌'
    texto += emoji + ' » ' + cat + ': ' + count + ' comandos\n'
  }

  texto += '\n> Usa #menu para ver todos'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['totalcmd']
handler.tags = ['info']
handler.command = /^(totalcmd|totalcomandos|comandos)$/i
handler.desc = 'Muestra el total de comandos'

export default handler