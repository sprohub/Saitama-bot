import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const changelogPath = path.join(__dirname, 'changelog.json')

// ═══════════════════════════════════════════
//  PANEL WEB DEL BOT
//  - /api/comandos       → lista de plugins cargados (global.plugins)
//  - /api/estado         → usuarios, grupos, comandos, uptime (igual que .botinfo)
//  - /api/actualizaciones → lee panel-web/changelog.json (lo editas tú)
// ═══════════════════════════════════════════

function listarComandos() {
  const plugins = global.plugins || {}

  return Object.entries(plugins)
    .map(([archivo, handler]) => {
      const comandos = Array.isArray(handler.command)
        ? handler.command
        : handler.command instanceof RegExp
          ? [handler.command.toString()]
          : handler.command
            ? [String(handler.command)]
            : []

      return {
        archivo,
        comandos,
        ayuda: Array.isArray(handler.help) ? handler.help : handler.help ? [handler.help] : [],
        tags: Array.isArray(handler.tags) ? handler.tags : handler.tags ? [handler.tags] : ['sin-categoria'],
        descripcion: handler.desc || ''
      }
    })
    .sort((a, b) => a.archivo.localeCompare(b.archivo))
}

function obtenerEstado() {
  const totalUsuarios = Object.keys(global.db?.data?.users || {}).length
  const totalGrupos = Object.keys(global.db?.data?.chats || {}).filter((id) => id.endsWith('@g.us')).length
  const totalComandos = Object.keys(global.plugins || {}).length

  const uptime = process.uptime()
  const dias = Math.floor(uptime / 86400)
  const horas = Math.floor((uptime % 86400) / 3600)
  const minutos = Math.floor((uptime % 3600) / 60)

  return {
    usuarios: totalUsuarios,
    grupos: totalGrupos,
    comandos: totalComandos,
    uptimeTexto: `${dias}d ${horas}h ${minutos}m`
  }
}

function leerChangelog() {
  try {
    if (!fs.existsSync(changelogPath)) return []
    const data = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'))
    if (!Array.isArray(data)) return []
    // Más reciente primero
    return data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  } catch (e) {
    console.log('[panel-web] error leyendo changelog.json:', e?.message)
    return []
  }
}

/**
 * Arranca el panel web. Llama a esto UNA VEZ desde tu archivo
 * principal (el que ya carga los plugins), por ejemplo:
 *
 *   import { iniciarPanelWeb } from './panel-web/server.js'
 *   iniciarPanelWeb(3000)
 */
export function iniciarPanelWeb(puerto = 3000) {
  const app = express()

  app.use(express.static(path.join(__dirname, 'public')))

  app.get('/api/comandos', (req, res) => {
    try {
      const comandos = listarComandos()
      res.json({ total: comandos.length, actualizado: new Date().toISOString(), comandos })
    } catch (e) {
      res.status(500).json({ error: 'No se pudo leer los plugins', detalle: e?.message })
    }
  })

  app.get('/api/estado', (req, res) => {
    try {
      res.json({ actualizado: new Date().toISOString(), ...obtenerEstado() })
    } catch (e) {
      res.status(500).json({ error: 'No se pudo leer el estado', detalle: e?.message })
    }
  })

  app.get('/api/actualizaciones', (req, res) => {
    res.json({ actualizaciones: leerChangelog() })
  })

  app.listen(puerto, () => {
    console.log(`[panel-web] Disponible en http://localhost:${puerto}`)
  })

  return app
}

export default iniciarPanelWeb