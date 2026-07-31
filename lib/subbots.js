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

// 🔎 Consulta a PM2 si un proceso con ese nombre existe realmente (no solo confía en el registry.json)
function existeEnPM2(nombreProceso) {
  try {
    const salida = execSync('pm2 jlist', { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
    const lista = JSON.parse(salida)
    return lista.some(p => p.name === nombreProceso)
  } catch (e) {
    console.error('[subbots] No se pudo consultar "pm2 jlist":', e.message)
    return null // null = no se pudo verificar (pm2 no disponible, etc.)
  }
}

function normalizarNumero(numero) {
  return String(numero || '').replace(/\D/g, '')
}

// 🔎 Busca un subbot por ID exacto o por número de teléfono (con o sin +, espacios, etc.)
// Devuelve { id, data } o null si no se encuentra.
function buscarSubbotPorIdONumero(identificador) {
  const reg = leerRegistro()

  if (reg[identificador]) {
    return { id: identificador, data: reg[identificador] }
  }

  const numeroBuscado = normalizarNumero(identificador)
  if (numeroBuscado) {
    const entrada = Object.entries(reg).find(([, data]) => normalizarNumero(data.numero) === numeroBuscado)
    if (entrada) return { id: entrada[0], data: entrada[1] }
  }

  return null
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

  const subbotScript = path.join(__dirname, '..', 'subbot.js')

  try {
    execSync(`pm2 start "${subbotScript}" --name "${nombreProceso}" -- "${id}" "${numero}"`, {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (e) {
    // 🧹 Rollback: si pm2 no pudo arrancar el proceso, no dejamos basura ni registro fantasma
    console.error(`[subbots] Error al iniciar el proceso PM2 para ${id}:`, e.stderr?.toString() || e.message)
    try { fs.rmSync(carpetaSubbot, { recursive: true, force: true }) } catch {}
    throw new Error('No se pudo iniciar el proceso del subbot (ver logs del servidor).')
  }

  // Solo se registra el subbot si el proceso arrancó de verdad
  const reg = leerRegistro()
  reg[id] = { owner: remitente, numero, creado: Date.now(), nombreProceso }
  guardarRegistro(reg)

  return { id, nombreProceso }
}

/**
 * Elimina un subbot: mata el proceso en PM2, borra su carpeta de sesión
 * y lo quita del registro. Acepta el ID del subbot O su número de teléfono
 * (con o sin +, espacios, etc. — se normaliza automáticamente).
 *
 * @param {string} identificador - ID del subbot (ej. "ms1a2b3c4d") o número de teléfono
 * @returns {{ ok: boolean, procesoEliminado: boolean, carpetaEliminada: boolean, motivo?: string, id?: string }}
 */
export function eliminarSubbot(identificador) {
  const encontrado = buscarSubbotPorIdONumero(identificador)

  if (!encontrado) {
    return { ok: false, procesoEliminado: false, carpetaEliminada: false, motivo: 'No existe ningún subbot con ese ID o número.' }
  }

  const { id, data } = encontrado
  const reg = leerRegistro()

  let procesoEliminado = false
  let motivoProceso = null

  try {
    execSync(`pm2 delete "${data.nombreProceso}"`, { stdio: ['ignore', 'pipe', 'pipe'] })
    procesoEliminado = true
  } catch (e) {
    motivoProceso = e.stderr?.toString()?.trim() || e.message
    console.error(`[subbots] No se pudo eliminar el proceso PM2 "${data.nombreProceso}":`, motivoProceso)

    // Puede que el proceso ya no exista en PM2 (se cayó solo antes). Lo confirmamos
    // antes de decidir si esto es un error real o un falso positivo.
    const sigueExistiendo = existeEnPM2(data.nombreProceso)
    if (sigueExistiendo === false) {
      // Ya no está en PM2 -> no era un fallo real, solo estaba desincronizado
      procesoEliminado = true
      motivoProceso = null
    }
  }

  const carpetaSubbot = path.join(BASE_DIR, id)
  let carpetaEliminada = true
  try {
    if (fs.existsSync(carpetaSubbot)) fs.rmSync(carpetaSubbot, { recursive: true, force: true })
  } catch (e) {
    carpetaEliminada = false
    console.error(`[subbots] No se pudo borrar la carpeta de sesión de ${id}:`, e.message)
  }

  delete reg[id]
  guardarRegistro(reg)

  return {
    ok: procesoEliminado && carpetaEliminada,
    procesoEliminado,
    carpetaEliminada,
    motivo: motivoProceso || (carpetaEliminada ? undefined : 'No se pudo borrar la carpeta de sesión.'),
    id
  }
}

/**
 * Revive los subbots que estén en el registro pero cuyo proceso PM2 ya no exista
 * (por ejemplo después de actualizar/reiniciar el bot principal, o si el servidor
 * se reinició). No pide vincular de nuevo: la carpeta de sesión ya tiene las
 * credenciales guardadas, así que subbot.js reconecta directo con WhatsApp.
 *
 * Llama a esta función una sola vez al arrancar el bot principal (por ejemplo
 * desde main.js, justo después de cargar la base de datos).
 *
 * @returns {{ revividos: string[], fallidos: { id: string, motivo: string }[] }}
 */
export function revivirSubbots() {
  const reg = leerRegistro()
  const revividos = []
  const fallidos = []

  const subbotScript = path.join(__dirname, '..', 'subbot.js')

  for (const [id, data] of Object.entries(reg)) {
    const yaExiste = existeEnPM2(data.nombreProceso)

    // null = no se pudo consultar pm2 (ver log); true = ya está corriendo, no tocar
    if (yaExiste !== false) continue

    const carpetaSubbot = path.join(BASE_DIR, id)
    if (!fs.existsSync(carpetaSubbot)) {
      fallidos.push({ id, motivo: 'La carpeta de sesión ya no existe, no se puede revivir.' })
      continue
    }

    try {
      execSync(`pm2 start "${subbotScript}" --name "${data.nombreProceso}" -- "${id}" "${data.numero}"`, {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe']
      })
      revividos.push(id)
    } catch (e) {
      const motivo = e.stderr?.toString()?.trim() || e.message
      console.error(`[subbots] No se pudo revivir el subbot ${id}:`, motivo)
      fallidos.push({ id, motivo })
    }
  }

  if (revividos.length) console.log(`[subbots] Subbots revividos tras el reinicio: ${revividos.join(', ')}`)
  if (fallidos.length) console.warn(`[subbots] Subbots que no se pudieron revivir: ${fallidos.map(f => f.id).join(', ')}`)

  return { revividos, fallidos }
}
