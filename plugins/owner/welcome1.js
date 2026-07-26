import fs from 'fs'
import path from 'path'
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const settingsPath = path.resolve('./json/settings.json')
const FILAS_POR_SECCION = 10 // límite de WhatsApp por sección en un single_select

function isOwner(m) {
  const number = m.sender?.split('@')[0]
  const owners = (global.owner || []).map(([num]) => num.replace(/[^0-9]/g, ''))
  return m.fromMe || owners.includes(number)
}

// === UTILS JSON (mismo formato que tu archivo on/off original) ===
function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2))
    }
    return JSON.parse(fs.readFileSync(settingsPath))
  } catch {
    return {}
  }
}

function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}

function getChatConfig(botNumber, chatId) {
  let settings = readSettings()
  if (!settings[botNumber]) settings[botNumber] = {}
  if (!settings[botNumber][chatId]) {
    settings[botNumber][chatId] = {
      antilink: false,
      welcome: false,
      antiarabe: false,
      modoadmin: false,
      reglas: false
    }
    saveSettings(settings)
  }
  return settings
}

function getWelcome(botNumber, chatId) {
  const settings = getChatConfig(botNumber, chatId)
  return !!settings[botNumber][chatId].welcome
}

function setWelcome(botNumber, chatId, enable) {
  const settings = getChatConfig(botNumber, chatId)
  settings[botNumber][chatId].welcome = enable
  saveSettings(settings)
}

// === TODOS los grupos donde está el bot, sin importar si es admin ===
async function gruposDelBot(conn) {
  const chats = await conn.groupFetchAllParticipating()
  return Object.values(chats)
}

// === Cuenta en cuántos de esos grupos el welcome está activo ===
function contarGruposActivos(botNumber, grupos) {
  return grupos.filter((g) => getWelcome(botNumber, g.id)).length
}

// ═══════════════════════════════════════════
//  ANTI-DUPLICADOS — reforzado
// ═══════════════════════════════════════════
// Antes se usaba m.key?.id cuando existía, pero WhatsApp a veces entrega
// el MISMO evento de entrada/salida a través de dos rutas distintas con
// key.id diferente (o sin key.id) — eso hacía que el dedupe fallara y
// se mandaran 2 bienvenidas/despedidas. Ahora SIEMPRE se usa la llave
// compuesta (chat + tipo de evento + participante), nunca el key.id.
const eventosProcesados = new Map()
const VENTANA_DEDUPE_MS = 20 * 1000

function yaSeProceso(id) {
  if (!id) return false
  const ahora = Date.now()
  for (const [key, ts] of eventosProcesados) {
    if (ahora - ts > VENTANA_DEDUPE_MS) eventosProcesados.delete(key)
  }
  if (eventosProcesados.has(id)) return true
  eventosProcesados.set(id, ahora)
  return false
}

// === Helpers de menú interactivo ===
function unwrapMessage(message) {
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find((w) => msg[w])
    if (!key) break
    msg = msg[key].message
    guard++
  }
  return msg
}

function extractSelectedId(content) {
  const nativeFlow = content?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (nativeFlow?.paramsJson) {
    try {
      const data = JSON.parse(nativeFlow.paramsJson)
      return data.id || data.selectedId || data.selectedRowId || null
    } catch {}
  }
  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId
  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId
  return null
}

// ═══════════════════════════════════════════
//  RESOLUCIÓN DE @lid → número de teléfono real
// ═══════════════════════════════════════════
async function resolverJidReal(conn, jid) {
  if (!jid) return { jidReal: jid, resuelto: false }
  if (!jid.endsWith('@lid')) return { jidReal: jid, resuelto: true }

  try {
    const mapeo = conn.signalRepository?.lidMapping
    if (mapeo?.getPNForLID) {
      const real = await mapeo.getPNForLID(jid)
      if (real) return { jidReal: real, resuelto: true }
    }
  } catch {}

  try {
    const contacto = conn.store?.contacts?.[jid] || conn.contacts?.[jid]
    if (contacto?.jid && contacto.jid !== jid) {
      return { jidReal: contacto.jid, resuelto: true }
    }
  } catch {}

  return { jidReal: jid, resuelto: false }
}

function obtenerNombreVisible(conn, jidReal, resuelto) {
  try {
    const contacto = conn.store?.contacts?.[jidReal] || conn.contacts?.[jidReal]
    if (contacto?.notify) return contacto.notify
    if (contacto?.name) return contacto.name
  } catch {}
  if (!resuelto) return 'Miembro'
  return '+' + jidReal.split('@')[0]
}

// ═══════════════════════════════════════════
//  TARJETA VISUAL — diseño limpio con foto de perfil del usuario
// ═══════════════════════════════════════════
async function cargarImagenSegura(fuente) {
  try {
    if (!fuente) return null
    return await loadImage(fuente)
  } catch {
    return null
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function chip(ctx, texto, centerX, y, colorFondo, colorTexto) {
  ctx.font = 'bold 24px sans-serif'
  const ancho = ctx.measureText(texto).width + 48
  const x = centerX - ancho / 2
  ctx.fillStyle = colorFondo
  roundRect(ctx, x, y, ancho, 48, 24)
  ctx.fill()
  ctx.fillStyle = colorTexto
  ctx.textAlign = 'center'
  ctx.fillText(texto, centerX, y + 32)
}

function formatFecha(fecha) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const d = fecha.getDate().toString().padStart(2, '0')
  const mes = meses[fecha.getMonth()]
  return `${d} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${fecha.getFullYear()}`
}

function formatHora(fecha) {
  return `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`
}

/**
 * Genera la tarjeta de bienvenida/despedida con la FOTO DE PERFIL DEL USUARIO
 * (no la del grupo) como elemento central.
 */
async function generarImagenEvento({ tipo, numero, userPicUrl, groupName, miembros, mensaje }) {
  const W = 900
  const H = 1000
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const esBienvenida = tipo === 'bienvenida'

  const fondo = '#111418'
  const panel = '#181c22'
  const texto = '#f2f4f7'
  const gris = '#8b95a1'
  const verde = '#3ddc84'
  const rojo = '#ff5c5c'
  const colorAcento = esBienvenida ? verde : rojo
  const colorAcentoSuave = esBienvenida ? 'rgba(61,220,132,0.14)' : 'rgba(255,92,92,0.14)'

  // Fondo plano
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, W, H)

  const centerX = W / 2

  // ── Pastilla (badge) superior ──
  chip(ctx, esBienvenida ? '👋 BIENVENIDO/A' : '👋 HASTA PRONTO', centerX, 60, colorAcentoSuave, colorAcento)

  // ── Foto de perfil del USUARIO, centrada, en círculo ──
  const circR = 130
  const circY = 260
  const imgUser = await cargarImagenSegura(userPicUrl)

  // Anillo de color detrás del círculo
  ctx.beginPath()
  ctx.arc(centerX, circY, circR + 8, 0, Math.PI * 2)
  ctx.fillStyle = colorAcento
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, circY, circR, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (imgUser) {
    const escala = Math.max((circR * 2) / imgUser.width, (circR * 2) / imgUser.height)
    const iw = imgUser.width * escala
    const ih = imgUser.height * escala
    ctx.drawImage(imgUser, centerX - iw / 2, circY - ih / 2, iw, ih)
  } else {
    ctx.fillStyle = panel
    ctx.fillRect(centerX - circR, circY - circR, circR * 2, circR * 2)
    ctx.fillStyle = gris
    ctx.font = 'bold 90px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('?', centerX, circY + 32)
  }
  ctx.restore()

  // ── Nombre / número ──
  ctx.textAlign = 'center'
  ctx.fillStyle = texto
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(numero, centerX, circY + circR + 70)

  ctx.fillStyle = gris
  ctx.font = '22px sans-serif'
  ctx.fillText(esBienvenida ? 'se unió al grupo' : 'ha salido del grupo', centerX, circY + circR + 104)

  // ── Tarjeta inferior con detalles ──
  const cardY = circY + circR + 140
  const cardH = H - cardY - 40
  const cardX = 50
  const cardW = W - cardX * 2

  ctx.fillStyle = panel
  roundRect(ctx, cardX, cardY, cardW, cardH, 24)
  ctx.fill()

  let y = cardY + 50
  ctx.font = 'bold 18px sans-serif'
  ctx.fillStyle = gris
  ctx.fillText('GRUPO', centerX, y)
  y += 34
  ctx.font = 'bold 28px sans-serif'
  ctx.fillStyle = texto
  const nombreGrupo = groupName.length > 26 ? groupName.slice(0, 26) + '…' : groupName
  ctx.fillText(nombreGrupo, centerX, y)
  y += 50

  // Línea divisoria
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(cardX + 30, y)
  ctx.lineTo(cardX + cardW - 30, y)
  ctx.stroke()
  y += 46

  // Fila MIEMBROS / FECHA / HORA
  const ahora = new Date()
  const columnas = [
    { label: 'MIEMBROS', valor: String(miembros) },
    { label: 'FECHA', valor: formatFecha(ahora) },
    { label: 'HORA', valor: formatHora(ahora) }
  ]
  const colAncho = cardW / 3
  columnas.forEach((col, i) => {
    const cx = cardX + colAncho * i + colAncho / 2
    ctx.font = 'bold 16px sans-serif'
    ctx.fillStyle = gris
    ctx.fillText(col.label, cx, y)
    ctx.font = 'bold 22px sans-serif'
    ctx.fillStyle = texto
    ctx.fillText(col.valor, cx, y + 30)
  })
  y += 66

  // Frase / mensaje
  const frase = mensaje || (esBienvenida
    ? 'Un nuevo miembro se une a la comunidad. ¡Bienvenido!'
    : 'Gracias por haber sido parte de esta familia.')

  ctx.font = 'italic 19px sans-serif'
  ctx.fillStyle = gris
  const maxAncho = cardW - 70
  const palabras = frase.split(' ')
  let linea = ''
  const lineas = []
  for (const palabra of palabras) {
    const prueba = linea ? linea + ' ' + palabra : palabra
    if (ctx.measureText(prueba).width > maxAncho && linea) {
      lineas.push(linea)
      linea = palabra
    } else {
      linea = prueba
    }
  }
  if (linea) lineas.push(linea)
  lineas.slice(0, 3).forEach((l, i) => {
    ctx.fillText(l, centerX, y + i * 26)
  })

  return canvas.toBuffer('image/png')
}

// ───────────────────────────────────────────
// Comando .welcome — abre el menú de botones
// ───────────────────────────────────────────
const handler = async (m, { conn }) => {
  if (!isOwner(m)) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar este comando.\n╰───────────────⬣`
    )
  }

  await m.reply(
    `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Cargando grupos...\n╰───────────────⬣`
  )

  const botNumber = conn.user?.jid || conn.user.id
  const grupos = await gruposDelBot(conn)
  const activosCount = contarGruposActivos(botNumber, grupos)

  const sections = []

  if (m.isGroup) {
    const enAqui = getWelcome(botNumber, m.chat)
    sections.push({
      title: '⚙️ Este grupo',
      rows: [{
        title: enAqui ? '🔴 Desactivar aquí' : '🟢 Activar aquí',
        description: `Estado actual: ${enAqui ? 'Activado ✅' : 'Desactivado ❌'}`,
        id: `welcome|${enAqui ? 'off' : 'on'}|${m.chat}`
      }]
    })
  }

  sections.push({
    title: '🌐 Todos los grupos',
    rows: [
      { title: '🟢 Activar en todos', description: `${grupos.length} grupos donde está el bot`, id: 'welcome|on|all' },
      { title: '🔴 Desactivar en todos', description: `${grupos.length} grupos donde está el bot`, id: 'welcome|off|all' }
    ]
  })

  for (let i = 0; i < grupos.length; i += FILAS_POR_SECCION) {
    const chunk = grupos.slice(i, i + FILAS_POR_SECCION)
    const desde = i + 1
    const hasta = i + chunk.length

    sections.push({
      title: `📋 Grupos ${desde}-${hasta}`,
      rows: chunk.map((g) => {
        const estado = getWelcome(botNumber, g.id)
        return {
          title: `🌿 ${g.subject}`,
          description: `${estado ? 'Activado ✅' : 'Desactivado ❌'} — toca para alternar`,
          id: `welcome|toggle|${g.id}`
        }
      })
    })
  }

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 👋 Menú de Bienvenida\n` +
    `│ 🍃 El bot está en ${grupos.length} grupo(s)\n` +
    `│ 🍃 Welcome activo en ${activosCount} de ${grupos.length}\n` +
    `│ 🍃 Toca una opción para activar/desactivar\n` +
    `╰───────────────⬣`

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌿 SAITAMA-BOT — Welcome', subtitle: `Activo en ${activosCount}/${grupos.length} grupos`, hasMediaAttachment: false },
      body: { text: bodyText },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🌿 VER OPCIONES', sections }) }]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.log('[welcome] error mostrando menú:', e)
    await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo mostrar el menú.\n╰───────────────⬣`)
  }
}

handler.command = ['welcome']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['group']
handler.help = ['welcome']
handler.desc = 'Menú para activar/desactivar la bienvenida por grupo o en todos'

// ───────────────────────────────────────────
// handler.before — botones del menú + envío real de bienvenida/despedida
// ───────────────────────────────────────────
handler.before = async (m, { conn }) => {
  const botNumber = conn.user?.jid || conn.user.id

  // ── 1) Botones del menú .welcome ──
  const content = unwrapMessage(m.message)
  const id = content ? extractSelectedId(content) : null

  if (id && id.startsWith('welcome|')) {
    if (!isOwner(m)) {
      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar esto.\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    const [, accion, destino] = id.split('|')

    if (destino === 'all') {
      const grupos = await gruposDelBot(conn)
      grupos.forEach((g) => setWelcome(botNumber, g.id, accion === 'on'))

      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${accion === 'on' ? 'activada ✅' : 'desactivada ❌'} en ${grupos.length} grupo(s).\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    if (accion === 'toggle') {
      const actual = getWelcome(botNumber, destino)
      setWelcome(botNumber, destino, !actual)

      await conn.sendMessage(m.chat, {
        text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${!actual ? 'activada ✅' : 'desactivada ❌'} en ese grupo.\n╰───────────────⬣`
      }, { quoted: m })
      return true
    }

    setWelcome(botNumber, destino, accion === 'on')
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Bienvenida ${accion === 'on' ? 'activada ✅' : 'desactivada ❌'} en este grupo.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  // ── 2) Envío real de bienvenida / despedida ──
  if (!m.isGroup) return false
  if (!getWelcome(botNumber, m.chat)) return false
  if (![27, 28, 32].includes(m.messageStubType)) return false

  // 🛡️ Guardia extra: si por lo que sea este mismo objeto "m" pasa dos
  // veces por este código en el mismo tick (algunos dispatchers lo hacen),
  // esto lo corta de inmediato sin depender del Map de abajo.
  if (m._welcomeHandled) return false
  m._welcomeHandled = true

  const participante = m.messageStubParameters?.[0] || m.sender

  // 🔧 FIX anti-duplicados: YA NO se usa m.key?.id (podía venir distinto
  // o ausente entre las dos formas en que WhatsApp entrega este evento).
  // Ahora la llave es siempre chat + tipo de evento + participante.
  const idEvento = `${m.chat}_${m.messageStubType}_${participante}`
  if (yaSeProceso(idEvento)) return false

  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const groupSize = groupMetadata.participants.length

  const { jidReal, resuelto } = await resolverJidReal(conn, participante)
  const userId = jidReal
  const userNumero = obtenerNombreVisible(conn, jidReal, resuelto)

  let userPicUrl
  try {
    userPicUrl = await conn.profilePictureUrl(userId, 'image')
  } catch {
    userPicUrl = null
  }

  const esEntrada = m.messageStubType === 27
  const mensajePersonalizado = esEntrada ? chat.sWelcome : chat.sBye
  const mensajeFinal = mensajePersonalizado
    ? mensajePersonalizado
        .replace(/@user/g, resuelto ? `@${userNumero.replace('+', '')}` : userNumero)
        .replace(/@group/g, groupMetadata.subject)
        .replace(/@members/g, groupSize)
    : null

  const etiquetaUsuario = resuelto ? `@${userNumero.replace('+', '')}` : userNumero
  const mentionsArray = resuelto ? [userId] : []

  try {
    const imagenBuffer = await generarImagenEvento({
      tipo: esEntrada ? 'bienvenida' : 'despedida',
      numero: userNumero,
      userPicUrl,
      groupName: groupMetadata.subject,
      miembros: groupSize,
      mensaje: mensajeFinal
    })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: esEntrada
        ? `🌿 ${etiquetaUsuario} se unió al grupo.`
        : `🍃 ${etiquetaUsuario} salió del grupo.`,
      mentions: mentionsArray
    })
  } catch (e) {
    console.log('[welcome] error generando imagen, se envía solo texto:', e)
    const texto = esEntrada
      ? `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 👋 ¡Bienvenido/a!\n│\n│ 👤 ${etiquetaUsuario}\n│ 🏠 Grupo: ${groupMetadata.subject}\n│ 👥 Miembros: ${groupSize}\n╰───────────────⬣`
      : `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 💨 ¡Hasta luego!\n│\n│ 👤 ${etiquetaUsuario}\n│ 🏠 Grupo: ${groupMetadata.subject}\n│ 👥 Miembros restantes: ${groupSize}\n╰───────────────⬣`
    await conn.sendMessage(m.chat, { text: texto, mentions: mentionsArray })
  }

  return false
}

export default handler
