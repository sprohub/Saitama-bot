import { exec } from 'child_process'
import fetch from 'node-fetch'

let handler = async (m, { conn, text }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, {
      text: '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n🌸 Solo los creadores pueden usar este comando\n\n> Solicitado por @' + who.split('@')[0],
      mentions: [who]
    }, { quoted: m })
  }

  if (!text) {
    await conn.sendMessage(m.chat, { text: '⏳ Obteniendo lista de plugins del repositorio...' }, { quoted: m })

    try {
      let apiUrl = 'https://api.github.com/repos/ElvigilanteDv/Hinata-Bot/contents/plugins'
      let res = await fetch(apiUrl)
      let files = await res.json()

      if (!Array.isArray(files)) {
        return conn.sendMessage(m.chat, { text: '❌ No se pudo obtener la lista de plugins' }, { quoted: m })
      }

      let jsFiles = files.filter(f => f.name.endsWith('.js')).map(f => f.name.replace('.js', ''))

      let texto = '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA GETPLUGIN ㅤ֢ㅤׄㅤׅ\n\n'
      texto += '📥 Descarga plugins del repositorio\n\n'
      texto += '📋 *Plugins disponibles (' + jsFiles.length + '):*\n\n'

      for (let plugin of jsFiles) {
        texto += '❀ ' + plugin + '\n'
      }

      texto += '\n> #getplugin <nombre>\n> Solicitado por @' + who.split('@')[0]

      await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })

    } catch (e) {
      await conn.sendMessage(m.chat, { text: '❌ Error al obtener la lista' }, { quoted: m })
    }
    return
  }

  let pluginName = text.toLowerCase().replace('.js', '')
  let rawUrl = `https://raw.githubusercontent.com/ElvigilanteDv/Hinata-Bot/main/plugins/${pluginName}.js`

  await conn.sendMessage(m.chat, { text: '⏳ Descargando *' + pluginName + '.js*...' }, { quoted: m })

  exec(`curl -o plugins/${pluginName}.js ${rawUrl}`, async (err, stdout, stderr) => {
    if (err) {
      await conn.sendMessage(m.chat, {
        text: '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA GETPLUGIN ㅤ֢ㅤׄㅤׅ\n\n🌸 No se encontró *' + pluginName + '.js*\n\n> Verifica el nombre con #getplugin\n> Solicitado por @' + who.split('@')[0],
        mentions: [who]
      }, { quoted: m })
      return
    }

    await conn.sendMessage(m.chat, {
      text: '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA GETPLUGIN ㅤ֢ㅤׄㅤׅ\n\n✨ Plugin descargado correctamente\n\n📦 *' + pluginName + '.js*\n📂 plugins/\n\n> Hinata lo cargará automáticamente\n> Solicitado por @' + who.split('@')[0],
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