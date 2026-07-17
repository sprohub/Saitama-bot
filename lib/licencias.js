/**
 * lib/licencias.js
 *
 * Sistema de licencias por grupo. Un grupo solo puede usar el bot si
 * alguien canjeó ahí un código válido, generado previamente por el
 * owner para un número de teléfono específico.
 *
 * Flujo:
 * 1) Owner genera un código para un número: .codegrupo <numero>
 *    (elige duración con botones: infinito, 1 semana, 1 mes, etc.)
 * 2) El owner le da ese código a la persona (fuera del bot, por su cuenta)
 * 3) Esa persona agrega el bot a su grupo y corre: .canjear <codigo>
 *    — SOLO funciona si quien lo corre es el mismo número para el
 *    que se generó el código.
 * 4) El grupo queda autorizado hasta que expire (o para siempre, si
 *    la duración elegida fue "infinito").
 *
 * Almacenamiento (usa tu global.db ya existente):
 * - global.db.data.settings.codigosLicencia[codigo] = {
 *     numero, duracionMs, creadoPor, creadoEn, usado
 *   }
 * - global.db.data.chats[groupId].licencia = {
 *     codigo, numero, expiraEn, activo
 *   }
 */

const CARACTERES_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin O/0/I/1 para evitar confusión visual

export const LIMITE_CANJES_OWNER = 30
export const LIMITE_CANJES_USUARIO = 1

export const DURACIONES = {
  infinito: { label: '♾️ Infinito (Owner)', ms: null },
  semana: { label: '📅 1 semana', ms: 7 * 24 * 60 * 60 * 1000 },
  mes: { label: '📅 1 mes', ms: 30 * 24 * 60 * 60 * 1000 },
  tresmeses: { label: '📅 3 meses', ms: 90 * 24 * 60 * 60 * 1000 },
  seismeses: { label: '📅 6 meses', ms: 180 * 24 * 60 * 60 * 1000 },
  año: { label: '📅 1 año', ms: 365 * 24 * 60 * 60 * 1000 }
}

function ensureStorage() {
  if (!global.db.data.settings) global.db.data.settings = {}
  if (!global.db.data.settings.codigosLicencia) global.db.data.settings.codigosLicencia = {}
  if (!global.db.data.settings.canjesPorNumero) global.db.data.settings.canjesPorNumero = {}
  if (!global.db.data.chats) global.db.data.chats = {}
}

function generarStringCodigo(largo = 8) {
  let out = ''
  for (let i = 0; i < largo; i++) {
    out += CARACTERES_CODIGO[Math.floor(Math.random() * CARACTERES_CODIGO.length)]
  }
  return out
}

function normalizarNumero(numero) {
  return (numero || '').replace(/[^0-9]/g, '')
}

/** ¿Este número está en global.owner? */
export function esNumeroOwner(numero) {
  const numeroLimpio = normalizarNumero(numero)
  return (global.owner || []).some(([num]) => normalizarNumero(num) === numeroLimpio)
}

/**
 * Genera un código nuevo, único, para un número específico.
 * @returns {string} el código generado
 */
export function generarCodigo(numero, duracionKey, creadoPor) {
  ensureStorage()
  const numeroLimpio = normalizarNumero(numero)
  const duracion = DURACIONES[duracionKey]
  if (!duracion) throw new Error(`Duración inválida: ${duracionKey}`)

  let codigo
  do {
    codigo = generarStringCodigo()
  } while (global.db.data.settings.codigosLicencia[codigo]) // evita colisiones

  global.db.data.settings.codigosLicencia[codigo] = {
    numero: numeroLimpio,
    duracionMs: duracion.ms,
    duracionKey,
    creadoPor,
    creadoEn: Date.now(),
    usado: false
  }

  return codigo
}

/**
 * Intenta canjear un código dentro de un grupo.
 * @returns {{ok: true} | {ok: false, motivo: string}}
 */
export function canjearCodigo(codigo, numeroQueCanjea, groupId) {
  ensureStorage()
  const entrada = global.db.data.settings.codigosLicencia[codigo]

  if (!entrada) return { ok: false, motivo: 'Ese código no existe.' }
  if (entrada.usado) return { ok: false, motivo: 'Ese código ya fue canjeado.' }

  const numeroLimpio = normalizarNumero(numeroQueCanjea)
  if (entrada.numero !== numeroLimpio) {
    return { ok: false, motivo: 'Ese código no te pertenece.' }
  }

  const yaCanjeados = global.db.data.settings.canjesPorNumero[numeroLimpio] || 0
  const limite = esNumeroOwner(numeroLimpio) ? LIMITE_CANJES_OWNER : LIMITE_CANJES_USUARIO

  if (yaCanjeados >= limite) {
    return {
      ok: false,
      motivo: `Ya alcanzaste tu límite de canjes (${limite}). No puedes canjear más códigos.`
    }
  }

  entrada.usado = true
  global.db.data.settings.canjesPorNumero[numeroLimpio] = yaCanjeados + 1

  if (!global.db.data.chats[groupId]) global.db.data.chats[groupId] = {}
  global.db.data.chats[groupId].licencia = {
    codigo,
    numero: numeroLimpio,
    expiraEn: entrada.duracionMs ? Date.now() + entrada.duracionMs : null,
    activo: true
  }

  return { ok: true }
}

/**
 * Revisa si un grupo tiene una licencia activa (y no vencida).
 * Si venció, la marca como inactiva automáticamente.
 */
export function grupoAutorizado(groupId) {
  ensureStorage()
  const licencia = global.db.data.chats[groupId]?.licencia
  if (!licencia || !licencia.activo) return false

  if (licencia.expiraEn && Date.now() > licencia.expiraEn) {
    licencia.activo = false
    return false
  }

  return true
}

/** Info legible de la licencia de un grupo (para comandos de estado) */
export function infoLicenciaGrupo(groupId) {
  ensureStorage()
  const licencia = global.db.data.chats[groupId]?.licencia
  if (!licencia) return null
  return {
    ...licencia,
    expiraTexto: licencia.expiraEn ? new Date(licencia.expiraEn).toLocaleString('es-CO') : 'Nunca (infinito)'
  }
}

/** Revoca manualmente la licencia de un grupo (por si el owner quiere quitarla) */
export function revocarLicencia(groupId) {
  ensureStorage()
  if (global.db.data.chats[groupId]?.licencia) {
    global.db.data.chats[groupId].licencia.activo = false
  }
}

/**
 * Lista todos los grupos que tienen (o tuvieron) una licencia canjeada.
 * @returns {Array<{groupId, numero, codigo, expiraEn, activo}>}
 */
export function listarLicencias() {
  ensureStorage()
  const resultado = []
  for (const [groupId, chat] of Object.entries(global.db.data.chats)) {
    if (chat?.licencia) {
      resultado.push({ groupId, ...chat.licencia })
    }
  }
  return resultado
}
