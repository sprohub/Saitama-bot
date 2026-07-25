import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE_DIR = path.join(__dirname, '..', 'subbots')
const REGISTRY_PATH = path.join(BASE_DIR, 'registry.json')

if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true })
if (!fs.existsSync(REGISTRY_PATH)) fs.writeFileSync(REGISTRY_PATH, JSON.stringify({}, null, 2))

function leerRegistro() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function guardarRegistro(data) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2))
}

export function contarSubbotsDe(remitente) {
  const reg = leerRegistro()
  return Object.values(reg).filter(v => v.owner === remitente).length
}

export function listarSubbots() {
  const reg = leerRegistro()
  return Object.entries(reg).map(([id, data]) => ({ id, ...data }))
}

export function leerStatus(id) {
  const rutaStatus = path.join(BASE_DIR, id, 'status.json')
  try {
    return JSON.parse(fs.readFileSync(rutaStatus, 'utf-8'))
  } catch {
    return null
  }
}

export async function crearSubbotCompleto(numero, remitente) {
  const id = 'ms' + Math.random().toString(36).substring(2, 10)
  const nombreProceso = `subbot-${id}`
  const carpetaSubbot = path.join(BASE_DIR, id)
  fs.mkdirSync(carpetaSubbot, { recursive: true })

  const reg = leerRegistro()
  reg[id] = { owner: remitente, numero, creado: Date.now(), nombreProceso }
  guardarRegistro(reg)

  const subbotScript = path.join(__dirname, '..', 'subbot.js')
  execSync(`pm2 start "${subbotScript}" --name "${nombreProceso}" -- "${id}" "${numero}"`, { cwd: path.join(__dirname, '..') })

  return { id, nombreProceso }
}

export function eliminarSubbot(id) {
  const reg = leerRegistro()
  const data = reg[id]
  if (!data) return false

  try {
    execSync(`pm2 delete "${data.nombreProceso}"`)
  } catch {}

  const carpetaSubbot = path.join(BASE_DIR, id)
  if (fs.existsSync(carpetaSubbot)) fs.rmSync(carpetaSubbot, { recursive: true, force: true })

  delete reg[id]
  guardarRegistro(reg)
  return true
}
