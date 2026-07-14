/**
 * plugins/owner/owner-autocierre.js
 * Comando: .autocierre
 *
 * SOLO PARA OWNERS. Cierra automáticamente los grupos (solo admins
 * pueden escribir) y los vuelve a abrir a las horas que configures
 * (por defecto 12:30 PM cierre / 7:00 AM apertura, hora Colombia).
 * Cada grupo se activa/desactiva por separado desde un menú de botones.
 *
 * Uso:
 * .autocierre                     → menú para activar/desactivar el
 *                                    auto-cierre en cada grupo
 * .autocierre estado              → lista grupos activos + horas configuradas
 * .autocierre hora cierre HH:MM   → cambia la hora de cierre
 * .autocierre hora apertura HH:MM → cambia la hora de apertura
 *
 * IMPORTANTE:
 * Este plugin asume que el socket de conexión de Baileys está
 * disponible en `global.conn` (así lo exponen la mayoría de estos
 * forks de bot). Si tu framework usa otro nombre de variable global
 * para el socket, cambia la línea marcada más abajo con 🔧.
 *
 * También asume que `global.db.data.chats[jid]` existe como objeto
 * de configuración por grupo (patrón típico en estos bots para cosas
 * como antilink, welcome, etc). Si tu bot no tiene esa estructura,
 * créala o dime cómo guardas configuración por grupo y lo ajusto.
 */

import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'

const ZONA_HORARIA = 'America/Bogota'
const HORA_CIERRE_DEFAULT = { hora: 12, minuto: 30 }
const HORA_APERTURA_DEFAULT = { hora: 7, minuto: 0 }
const INTERVALO_CHEQUEO_MS = 30 * 1000 // revisa cada 30 segundos

function obtenerHorasConfiguradas() {
  if (!global.db.data.settings) global.db.data.settings = {}
  const s = global.db.data.settings
  return {
    cierre: s.autocierreHoraCierre || HORA_CIERRE_DEFAULT,
    apertura: s.autocierreHoraApertura || HORA_APERTURA_DEFAULT
  }
}

function formatearHora({ hora, minuto }) {
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

// Parsea "HH:MM" a { hora, minuto }, o null si no es válido
function parsearHora(texto) {
  const match = (texto || '').trim().match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null
  return { hora: Number(match[1]), minuto: Number(match[2]) }
}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function unwrapMessage(message) {
  if (!message) return message
  if (message.ephemeralMessage) return unwrapMessage(message.ephemeralMessage.message)
  if (message.viewOnceMessage) return unwrapMessage(message.viewOnceMessage.message)
  if (message.viewOnceMessageV2) return unwrapMessage(message.viewOnceMessageV2.message)
  return message
}

function extractSelectedId(content) {
  const msg = unwrapMessage(content.message)
  const interactive = msg?.interactiveResponseMessage
  if (!interactive) return null
  try {
    const params = JSON.parse(interactive.nativeFlowResponseMessage.paramsJson)
    return params.id || null
  } catch {
    return null
  }
}

function obtenerHoraColombia() {
  const partes = new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())

  const obtener = tipo => partes.find(p => p.type === tipo)?.value
  return {
    hora: Number(obtener('hour')),
    minuto: Number(obtener('minute')),
    fecha: `${obtener('year')}-${obtener('month')}-${obtener('day')}` // para no repetir la acción el mismo minuto/día
  }
}

function chatConfig(jid) {
  if (!global.db.data.chats[jid]) global.db.data.chats[jid] = {}
  return global.db.data.chats[jid]
}

// Misma verificación que usan los comandos .close / .open
async function esBotAdmin(conn, jid) {
  try {
    const metadata = await conn.groupMetadata(jid)
    const botNumber = conn.user.id.split(':')[0]
    const participant = metadata.participants.find(
      p => p.id === conn.user.jid || p.id.startsWith(botNumber)
    )
    return participant?.admin === 'admin' || participant?.admin === 'superadmin'
  } catch {
    return false
  }
}

async function cerrarGrupo(conn, jid, horas) {
  const botAdmin = await esBotAdmin(conn, jid)
  if (!botAdmin) {
    console.warn('[autocierre] Salté el cierre de', jid, '— el bot no es admin ahí.')
    try {
      await conn.sendMessage(jid, {
        text: decorar('⚠️ No pude cerrar el grupo automáticamente: la bot necesita ser admin.')
      })
    } catch {}
    return
  }

  try {
    await conn.groupSettingUpdate(jid, 'announcement') // solo admins pueden escribir
    await conn.sendMessage(jid, {
      text: decorar(`Grupo cerrado automáticamente (${formatearHora(horas.cierre)}), solo admins hablan hasta las ${formatearHora(horas.apertura)}.`)
    })
  } catch (e) {
    console.error('[autocierre] ERROR cerrando grupo', jid, e)
  }
}

async function abrirGrupo(conn, jid, horas) {
  const botAdmin = await esBotAdmin(conn, jid)
  if (!botAdmin) {
    console.warn('[autocierre] Salté la apertura de', jid, '— el bot no es admin ahí.')
    try {
      await conn.sendMessage(jid, {
        text: decorar('⚠️ No pude abrir el grupo automáticamente: la bot necesita ser admin.')
      })
    } catch {}
    return
  }

  try {
    await conn.groupSettingUpdate(jid, 'not_announcement') // todos pueden escribir de nuevo
    await conn.sendMessage(jid, {
      text: decorar(`Grupo abierto automáticamente (${formatearHora(horas.apertura)}), todos pueden hablar.`)
    })
  } catch (e) {
    console.error('[autocierre] ERROR abriendo grupo', jid, e)
  }
}

async function revisarHorario() {
  // 🔧 Si tu bot expone el socket con otro nombre (no global.conn), cámbialo aquí
  const conn = global.conn
  if (!conn) return

  const horas = obtenerHorasConfiguradas()
  const { hora, minuto, fecha } = obtenerHoraColombia()

  const esHoraCierre = hora === horas.cierre.hora && minuto === horas.cierre.minuto
  const esHoraApertura = hora === horas.apertura.hora && minuto === horas.apertura.minuto
  if (!esHoraCierre && !esHoraApertura) return

  const marcaAccion = esHoraCierre ? `cierre_${fecha}` : `apertura_${fecha}`
  if (global.db.data.settings?.autocierreUltimaAccion === marcaAccion) return // ya se ejecutó hoy

  global.db.data.settings.autocierreUltimaAccion = marcaAccion

  const chats = global.db.data.chats || {}
  const gruposActivos = Object.keys(chats).filter(jid => jid.endsWith('@g.us') && chats[jid]?.autocierre)

  for (const jid of gruposActivos) {
    if (esHoraCierre) await cerrarGrupo(conn, jid, horas)
    else await abrirGrupo(conn, jid, horas)
    await new Promise(res => setTimeout(res, 800)) // pausa entre grupos para no saturar
  }
}

// Arranca el scheduler una sola vez, aunque el archivo se recargue
if (!global.__autocierreSchedulerActivo) {
  global.__autocierreSchedulerActivo = true
  setInterval(() => {
    revisarHorario().catch(e => console.error('[autocierre] ERROR en revisarHorario:', e))
  }, INTERVALO_CHEQUEO_MS)
  console.log('[autocierre] Scheduler iniciado (usa .autocierre hora para configurar los horarios)')
}

const handler = async function (m, { conn, text, command }) {
  const textoCompleto = (text || '').trim()
  const sub = textoCompleto.toLowerCase()

  // --- Configurar horas: .autocierre hora cierre 12:30 / .autocierre hora apertura 07:00 ---
  if (sub.startsWith('hora')) {
    const partes = textoCompleto.split(/\s+/) // ["hora", "cierre", "12:30"]
    const tipo = (partes[1] || '').toLowerCase()
    const horaTexto = partes[2]

    if (!['cierre', 'apertura'].includes(tipo) || !horaTexto) {
      const horas = obtenerHorasConfiguradas()
      return conn.sendMessage(m.chat, {
        text: decorar(
          `Uso:\n.${command} hora cierre HH:MM\n.${command} hora apertura HH:MM\n\n` +
          `Ejemplo:\n.${command} hora cierre 12:30\n.${command} hora apertura 07:00\n\n` +
          `⏱️ Configuración actual:\n🔒 Cierre: ${formatearHora(horas.cierre)}\n🔓 Apertura: ${formatearHora(horas.apertura)}`
        )
      }, { quoted: m })
    }

    const horaParseada = parsearHora(horaTexto)
    if (!horaParseada) {
      return conn.sendMessage(m.chat, {
        text: decorar('❌ Formato de hora inválido. Usa HH:MM en formato 24 horas (ej: 12:30 o 07:00).')
      }, { quoted: m })
    }

    if (!global.db.data.settings) global.db.data.settings = {}
    if (tipo === 'cierre') global.db.data.settings.autocierreHoraCierre = horaParseada
    else global.db.data.settings.autocierreHoraApertura = horaParseada

    const horasActualizadas = obtenerHorasConfiguradas()
    return conn.sendMessage(m.chat, {
      text: decorar(
        `✅ Hora de ${tipo} actualizada a ${formatearHora(horaParseada)} (hora Colombia).\n\n` +
        `⏱️ Configuración actual:\n🔒 Cierre: ${formatearHora(horasActualizadas.cierre)}\n🔓 Apertura: ${formatearHora(horasActualizadas.apertura)}`
      )
    }, { quoted: m })
  }

  // --- Ver estado actual ---
  if (sub === 'estado') {
    const horas = obtenerHorasConfiguradas()
    const chats = global.db.data.chats || {}
    const activos = Object.keys(chats).filter(jid => jid.endsWith('@g.us') && chats[jid]?.autocierre)

    if (!activos.length) {
      return conn.sendMessage(m.chat, {
        text: decorar(`No hay ningún grupo con auto-cierre activo.\n\n⏱️ Horas configuradas:\n🔒 Cierre: ${formatearHora(horas.cierre)}\n🔓 Apertura: ${formatearHora(horas.apertura)}`)
      }, { quoted: m })
    }

    const nombres = await Promise.all(activos.map(async jid => {
      try {
        const meta = await conn.groupMetadata(jid)
        return `• ${meta.subject}`
      } catch {
        return `• ${jid}`
      }
    }))

    return conn.sendMessage(m.chat, {
      text: decorar(
        `Grupos con auto-cierre activo (${activos.length}):\n\n${nombres.join('\n')}\n\n` +
        `⏱️ Horas configuradas:\n🔒 Cierre: ${formatearHora(horas.cierre)}\n🔓 Apertura: ${formatearHora(horas.apertura)}`
      )
    }, { quoted: m })
  }

  // --- Menú para activar/desactivar por grupo ---
  let gruposBot
  try {
    gruposBot = await conn.groupFetchAllParticipating()
  } catch (e) {
    console.error('[autocierre] ERROR obteniendo grupos:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo obtener la lista de grupos.')
    }, { quoted: m })
  }

  const jids = Object.keys(gruposBot)
  if (!jids.length) {
    return conn.sendMessage(m.chat, {
      text: decorar('El bot no está en ningún grupo todavía.')
    }, { quoted: m })
  }

  const rows = jids.slice(0, 50).map(jid => {
    const nombre = gruposBot[jid]?.subject || jid
    const activo = !!chatConfig(jid).autocierre
    return {
      title: `${activo ? '🟢' : '⚪'} ${nombre}`.slice(0, 60),
      description: activo ? 'Auto-cierre ACTIVADO · toca para desactivar' : 'Auto-cierre desactivado · toca para activar',
      id: `autocierre_toggle|${jid}`
    }
  })

  const horasMenu = obtenerHorasConfiguradas()
  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: proto.Message.InteractiveMessage.Header.create({
      title: '🌿 SAITAMA-BOT · Auto-cierre de Grupos',
      subtitle: `Cierra ${formatearHora(horasMenu.cierre)} · Abre ${formatearHora(horasMenu.apertura)} (hora Colombia)`,
      hasMediaAttachment: false
    }),
    body: proto.Message.InteractiveMessage.Body.create({
      text: decorar('Toca un grupo para activar o desactivar su auto-cierre 👇')
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: '🍃 SAITAMA-BOT' }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '🔒 Elegir grupo',
          sections: [{ title: `${rows.length} grupos`, rows }]
        })
      }]
    })
  })

  const waMsg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { interactiveMessage } }
  }, { quoted: m, userJid: conn.user.jid })

  await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id })
}

handler.command = ['autocierre', 'cierregrupos']
handler.help = ['autocierre (activa/desactiva el cierre automático por grupo, horas configurables)']
handler.tags = ['owner']
handler.owner = true // solo owners pueden usar este comando
handler.rowner = true // y solo el/los owner(es) reales del bot

handler.before = async function (m, { conn }) {
  const selectedId = extractSelectedId(m)
  if (!selectedId || !selectedId.startsWith('autocierre_toggle|')) return false

  const isROwner = [...global.owner.map(([number]) => number)]
    .map(v => v.replace(/[^0-9]/g, '') + (m.sender.includes('@lid') ? '@lid' : '@s.whatsapp.net'))
    .includes(m.sender)

  if (!isROwner) {
    await conn.sendMessage(m.chat, { text: decorar('❌ Solo el owner puede usar esta opción.') }, { quoted: m })
    return true
  }

  const [, jid] = selectedId.split('|')
  const config = chatConfig(jid)
  config.autocierre = !config.autocierre

  let nombreGrupo = jid
  try {
    nombreGrupo = (await conn.groupMetadata(jid)).subject
  } catch {}

  const horasToggle = obtenerHorasConfiguradas()
  await conn.sendMessage(m.chat, {
    text: decorar(
      config.autocierre
        ? `🟢 Auto-cierre ACTIVADO para "${nombreGrupo}".\nSe cerrará a las ${formatearHora(horasToggle.cierre)} y se abrirá a las ${formatearHora(horasToggle.apertura)} (hora Colombia).`
        : `⚪ Auto-cierre DESACTIVADO para "${nombreGrupo}".`
    )
  }, { quoted: m })

  return true
}

export default handler
