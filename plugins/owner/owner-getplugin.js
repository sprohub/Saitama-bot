import { execFile } from 'child_process'
import fetch from 'node-fetch'
import path from 'path'

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
      // Árbol completo del repo (recursivo) para llegar a las subcarpetas
      let apiUrl = 'https://api.github.com/repos/sprohub/Saitama-bot/git/trees/main?recursive=1'
      let res = await fetch(apiUrl)
      let data = await res.json()

      if (!data.tree || !Array.isArray(data.tree)) {
        return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No se pudo obtener la lista de plugins\n╰───────────────⬣' }, { quoted: m })
      }

      let jsFiles = data.tree
        .filter(f => f.type === 'blob' && f.path.startsWith('plugins/') && f.path.endsWith('.js'))
        .map(f => f.path.replace(/^plugins\//, '').replace(/\.js$/, ''))

      let texto = '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Descarga plugins del repositorio\n│ 🍃 Plugins disponibles (' + jsFiles.length + '):\n│\n'

      for (let plugin of jsFiles) {
        texto += '│ ❀ ' + plugin + '\n'
      }

      texto += '│\n│ 🍃 Usa: #getplugin <carpeta/nombre>\n│ 🍃 Solicitado por @' + who.split('@')[0] + '\n╰───────────────⬣'

      await conn.sendMessage(m.chat, { text: texto, mentions: [who] }, { quoted: m })

    } catch (e) {
      await conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Error al obtener la lista\n╰───────────────⬣' }, { quoted: m })
    }
    return
  }

  let pluginName = text.toLowerCase().replace(/\.js$/, '').trim().replace(/^\/+/, '')

  // Solo letras, números, - y _ por segmento, separados por /. Sin ".." posible (no se permite el punto).
  if (!/^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/.test(pluginName)) {
    return conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Nombre de plugin inválido\n╰───────────────⬣' }, { quoted: m })
  }

  let destino = path.join('plugins', pluginName + '.js')
  let carpetaDestino = path.dirname(destino)
  let rawUrl = `https://raw.githubusercontent.com/sprohub/Saitama-bot/main/plugins/${pluginName}.js`

  await conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Descargando ' + pluginName + '.js...\n╰───────────────⬣' }, { quoted: m })

  execFile('mkdir', ['-p', carpetaDestino], (mkdirErr) => {
    if (mkdirErr) {
      conn.sendMessage(m.chat, { text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Error al crear la carpeta destino\n╰───────────────⬣' }, { quoted: m })
      return
    }

    execFile('curl', ['-f', '-o', destino, rawUrl], async (err) => {
      if (err) {
        await conn.sendMessage(m.chat, {
          text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 No se encontró ' + pluginName + '.js\n│ 🍃 Verifica el nombre con #getplugin\n│ 🍃 Solicitado por @' + who.split('@')[0] + '\n╰───────────────⬣',
          mentions: [who]
        }, { quoted: m })
        return
      }

      await conn.sendMessage(m.chat, {
        text: '╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Plugin descargado correctamente\n│ 🍃 ' + destino + '\n│ 🍃 Se cargará automáticamente\n│ 🍃 Solicitado por @' + who.split('@')[0] + '\n╰───────────────⬣',
        mentions: [who]
      }, { quoted: m })
    })
  })
}

handler.help = ['getplugin']
handler.tags = ['owner']
handler.command = /^(getplugin|get|plugin)$/i
handler.desc = 'Descarga plugins del repositorio oficial'
handler.owner = true

export default handler