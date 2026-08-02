import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const updatesPath = path.join(__dirname, '..', '..', 'lib', 'updates.json')

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function leerUpdates() {
  try {
    if (!fs.existsSync(updatesPath)) fs.writeFileSync(updatesPath, '[]')
    return JSON.parse(fs.readFileSync(updatesPath, 'utf8'))
  } catch (e) {
    console.error('[api] error leyendo updates.json:', e)
    return []
  }
}

function guardarUpdates(lista) {
  fs.writeFileSync(updatesPath, JSON.stringify(lista, null, 2))
}

// 📦 Extrae la lista de plugins cargados en el bot (misma fuente que usa .menu)
function obtenerListaPlugins() {
  return Object.entries(global.plugins || {})
    .filter(([, p]) => p && !p.disabled)
    .map(([archivo, p]) => ({
      archivo,
      comando: p.command instanceof RegExp
        ? p.command.source
        : Array.isArray(p.command)
          ? p.command.map(c => (c instanceof RegExp ? c.source : c))
          : p.command,
      help: Array.isArray(p.help) ? p.help : [p.help],
      tags: Array.isArray(p.tags) ? p.tags : [p.tags],
      descripcion: p.desc || '',
      soloOwner: !!p.owner,
      soloAdmin: !!p.admin,
      soloGrupo: !!p.group
    }))
}

function iniciarServidor(puerto) {
  if (global.__apiServer) return global.__apiServer

  const app = express()

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    next()
  })

  app.get('/', (req, res) => {
    res.json({
      bot: 'SAITAMA-BOT',
      estado: 'activo',
      endpoints: ['/plugins', '/updates'],
      totalPlugins: obtenerListaPlugins().length,
      totalUpdates: leerUpdates().length
    })
  })

  app.get('/plugins', (req, res) => {
    const lista = obtenerListaPlugins()
    res.json({ total: lista.length, plugins: lista })
  })

  app.get('/updates', (req, res) => {
    res.json({ updates: leerUpdates() })
  })

  const server = app.listen(puerto, () => {
    console.log(`[api] Servidor de API corriendo en el puerto ${puerto}`)
  })

  global.__apiServer = server
  global.__apiPort = puerto
  return server
}

function detenerServidor() {
  if (global.__apiServer) {
    global.__apiServer.close()
    global.__apiServer = null
    global.__apiPort = null
  }
}

let handler = async (m, { conn, text, isOwner }) => {
  if (!isOwner) {
    return conn.sendMessage(m.chat, { text: decorar('Solo el owner puede usar este comando') }, { quoted: m })
  }

  const args = (text || '').trim().split(/\s+/).filter(Boolean)
  const sub = (args[0] || '').toLowerCase()

  if (sub === 'start') {
    if (global.__apiServer) {
      return conn.sendMessage(m.chat, {
        text: decorar(`La API ya está corriendo en el puerto ${global.__apiPort}`)
      }, { quoted: m })
    }
    const puerto = parseInt(args[1]) || 3001
    try {
      iniciarServidor(puerto)
      return conn.sendMessage(m.chat, {
        text: decorar(
          `API iniciada en el puerto ${puerto}\n\n` +
          `Endpoints:\n` +
          `/plugins\n` +
          `/updates\n\n` +
          `Ejemplo: http://TU_IP:${puerto}/plugins`
        )
      }, { quoted: m })
    } catch (e) {
      return conn.sendMessage(m.chat, { text: decorar('Error al iniciar la API: ' + e.message) }, { quoted: m })
    }
  }

  if (sub === 'stop') {
    if (!global.__apiServer) {
      return conn.sendMessage(m.chat, { text: decorar('La API no está corriendo') }, { quoted: m })
    }
    detenerServidor()
    return conn.sendMessage(m.chat, { text: decorar('API detenida') }, { quoted: m })
  }

  if (sub === 'addupdate') {
    const resto = text.slice(text.toLowerCase().indexOf('addupdate') + 'addupdate'.length).trim()
    const [version, ...descParts] = resto.split('|')
    const descripcion = descParts.join('|').trim()

    if (!version?.trim() || !descripcion) {
      return conn.sendMessage(m.chat, {
        text: decorar('Uso: .api addupdate <version> | <descripción>\nEjemplo: .api addupdate 1.3.0 | Se agregó el comando ppt')
      }, { quoted: m })
    }

    const lista = leerUpdates()
    lista.unshift({
      version: version.trim(),
      descripcion,
      fecha: new Date().toISOString()
    })
    guardarUpdates(lista)

    return conn.sendMessage(m.chat, {
      text: decorar(`Actualización agregada\n\n${version.trim()}\n${descripcion}`)
    }, { quoted: m })
  }

  if (sub === 'updates') {
    const lista = leerUpdates().slice(0, 10)
    if (!lista.length) {
      return conn.sendMessage(m.chat, { text: decorar('No hay actualizaciones registradas todavía') }, { quoted: m })
    }
    let texto = 'Últimas actualizaciones\n\n'
    for (const u of lista) {
      texto += `${u.version} — ${u.descripcion}\n`
    }
    return conn.sendMessage(m.chat, { text: decorar(texto.trim()) }, { quoted: m })
  }

  // Estado por defecto
  const corriendo = !!global.__apiServer
  return conn.sendMessage(m.chat, {
    text: decorar(
      `Estado: ${corriendo ? 'Corriendo' : 'Detenida'}\n` +
      (corriendo
        ? `Puerto: ${global.__apiPort}\nPlugins expuestos: ${obtenerListaPlugins().length}\nActualizaciones: ${leerUpdates().length}`
        : 'Usa .api start para iniciarla') +
      `\n\nComandos:\n` +
      `.api start <puerto>\n` +
      `.api stop\n` +
      `.api updates\n` +
      `.api addupdate <version> | <descripción>`
    )
  }, { quoted: m })
}

handler.help = ['api <start/stop/updates>']
handler.tags = ['owner']
handler.command = /^(api|apistatus)$/i
handler.desc = 'Levanta una API HTTP que expone la lista de plugins y las actualizaciones del bot'
handler.owner = true

export default handler
