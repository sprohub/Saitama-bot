import { execFile } from 'child_process'
import fetch from 'node-fetch'

let handler = async (m, { conn, text }) => {
  let who = m.sender

  let esOwner = () => {
    if (!global.owner || !Array.isArray(global.owner)) return false
    let numeros = global.owner.map(([number]) => (number || '').replace(/[^0-9]/g, ''))
    return numeros.some(num => who.includes(num))
  }

  if (!m.fromMe && !esOwner()) {
    return conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo los creadores pueden usar este comando\n│ 🍃 Solicitado por @' + who.split('@')[0] + '\n╰───────────────⬣',
      mentions: [who]
    }, { quoted: m })
  }

  if (!text) {
    await conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Obteniendo lista de plugins del repositorio...\n╰───────────────⬣' }, { quoted: m })

    try {
      let apiUrl = 'https://api.github.com/repos/sprohub/Saitama-bot/contents/plugins'
      let res = await fetch(apiUrl)
      let files = await res.json()

      if (!Array.isArray(files)) {
        return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No se pudo obtener la lista de plugins\n╰───────────────⬣' }, { quoted: m })
      }

      let jsFiles = files.filter(f => f.name.endsWith('.js')).map(f => f.name.replace('.js', ''))

      let texto = '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Descarga plugins del repositorio\n│ 🍃 Plugins disponibles (' + jsFiles.length + '):\n│\n'

      for (let plugin of jsFiles) {
        texto += '│ ❀ ' + plugin + '\n'
      }

      texto += '│\n│ 🍃 Usa: #getplugin <nombre>\n│ 🍃 Solicitado por @' + who.split('@')[0] + '\n╰───────────────⬣'

      await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })

    } catch (e) {
      await conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Error al obtener la lista\n╰───────────────⬣' }, { quoted: m })
    }
    return
  }

  let pluginName = text.toLowerCase().replace('.js', '').trim()

  if (!/^[a-z0-9_-]+$/.test(pluginName)) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Nombre de plugin inválido\n╰───────────────⬣' }, { quoted: m })
  }

  let rawUrl = `https://raw.githubusercontent.com/sprohub/Saitama-bot/main/plugins/${pluginName}.js`

  await conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Descargando ' + pluginName + '.js...\n╰───────────────⬣' }, { quoted: m })

  execFile('curl', ['-f', '-o', `plugins/${pluginName}.js`, rawUrl], async (err, stdout, stderr) => {
    if (err) {
      await conn.sendMessage(m.chat, {
        text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No se encontró ' + pluginName + '.js\n│ 🍃 Verifica el nombre con #getplugin\n│ 🍃 Solicitado por @' + who.split('@')[0] + '\n╰───────────────⬣',
        mentions: [who]
      }, { quoted: m })
      return
    }

    await conn.sendMessage(m.chat, {
      text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Plugin descargado correctamente\n│ 🍃 ' + pluginName + '.js → plugins/\n│ 🍃 Se cargará automáticamente\n│ 🍃 Solicitado por @' + who.split('@')[0] + '\n╰───────────────⬣',
      mentions: [who]
    }, { quoted: m })
  })
}

handler.help = ['getplugin']
handler.tags = ['owner']
handler.command = /^(getplugin|get|plugin)$/i
handler.desc = 'Descarga plugins del repositorio oficial'
handler.owner = true

export default handler