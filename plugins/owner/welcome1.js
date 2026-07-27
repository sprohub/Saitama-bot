import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const settingsPath = path.resolve('./json/settings.json')
const FILAS_POR_SECCION = 10 // límite de WhatsApp por sección en un single_select

// 👉 Nombres de los 3 fondos aleatorios (deben estar dentro de la carpeta lib/ del proyecto)
const NOMBRES_FONDOS = ['welcome (1).jpg', 'welcome (2).jpg', 'welcome (3).jpg']
// 👉 Imagen que se usa cuando el usuario no tiene foto de perfil pública
const NOMBRE_SIN_PERFIL = 'sinperfil.jpg'

// ═══════════════════════════════════════════
//  RESOLUCIÓN ROBUSTA DE RUTAS lib/
// ═══════════════════════════════════════════
// Antes se asumía que lib/ estaba SIEMPRE un nivel arriba de este archivo
// (path.join(__dirname, '..', 'lib')). Si este handler vive más profundo
// (p.ej. plugins/group/welcome.js) esa ruta no coincide con la carpeta lib/
// real del proyecto y la imagen falla en silencio (fondo negro de respaldo).
// Ahora se prueban varias profundidades posibles + cwd, y si el nombre no
// coincide exacto (mayúsculas/espacios) se busca igual dentro de esas carpetas.
const BASES_POSIBLES = [
  path.join(__dirname, '..'),
  path.join(__dirname, '..', '..'),
  path.join(__dirname, '..', '..', '..'),
  process.cwd()
]

function normalizarNombre(s) {
  return s.toLowerCase().replace(/[\s()_-]/g, '')
}

function resolverArchivoLib(nombreArchivo) {
  // 1) Coincidencia exacta en alguna de las carpetas candidatas
  for (const base of BASES_POSIBLES) {
    const candidato = path.join(base, 'lib', nombreArchivo)
    if (fs.existsSync(candidato)) return candidato
  }
  // 2) Coincidencia flexible (ignora mayúsculas, espacios, guiones, paréntesis)
  const objetivo = normalizarNombre(nombreArchivo)
  for (const base of BASES_POSIBLES) {
    const dirLib = path.join(base, 'lib')
    try {
      if (fs.existsSync(dirLib)) {
        const archivos = fs.readdirSync(dirLib)
        const encontrado = archivos.find((a) => normalizarNombre(a) === objetivo)
        if (encontrado) return path.join(dirLib, encontrado)
      }
    } catch {}
  }
  // 3) No se encontró en ninguna ruta: log de diagnóstico con todas las rutas probadas
  console.log(
    '[welcome][DEBUG] no se encontró',
    nombreArchivo,
    '— rutas probadas:',
    BASES_POSIBLES.map((b) => path.join(b, 'lib'))
  )
  return null
}

function elegirFondoAleatorio() {
  const nombre = NOMBRES_FONDOS[Math.floor(Math.random() * NOMBRES_FONDOS.length)]
  return resolverArchivoLib(nombre)
}

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
//  TARJETA VISUAL — nueva plantilla "póster"
//  Fondo a pantalla completa (aleatorio de lib/),
//  foto de perfil circular grande con anillo,
//  cinta diagonal de estado y panel inferior "glass".
// ═══════════════════════════════════════════
async function cargarImagenSegura(fuente) {
  try {
    if (!fuente) return null
    return await loadImage(fuente)
  } catch (e) {
    console.log('[welcome][DEBUG] fallo cargando imagen:', fuente, '->', e?.message)
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

function dibujarFondoCover(ctx, img, W, H) {
  const escala = Math.max(W / img.width, H / img.height)
  const w = img.width * escala
  const h = img.height * escala
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
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
 * Genera la tarjeta de bienvenida/despedida — plantilla "póster".
 * - Fondo: pantalla completa, aleatorio entre welcome (1/2/3).jpg
 * - Foto de perfil del usuario (o sinperfil.jpg si no tiene) en círculo grande
 * - Cinta diagonal de estado en la esquina superior izquierda
 * - Nombre con respaldo sólido (siempre legible) y panel inferior sólido
 *   con grupo, miembros, fecha/hora y mensaje
 */
async function generarImagenEvento({ tipo, numero, userPicUrl, groupName, miembros, mensaje }) {
  const W = 1080
  const H = 1350
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const esBienvenida = tipo === 'bienvenida'
  const texto = '#ffffff'
  const gris = '#c9d1d9'
  // Colores desaturados (menos "neón") para que no compitan con la foto de fondo
  const verde = '#6fae7c'
  const rojo = '#c9695f'
  const colorAcento = esBienvenida ? verde : rojo

  // ── 1) Fondo aleatorio a pantalla completa ──
  const rutaFondo = elegirFondoAleatorio()
  const imgFondo = await cargarImagenSegura(rutaFondo)
  if (imgFondo) {
    dibujarFondoCover(ctx, imgFondo, W, H)
  } else {
    ctx.fillStyle = '#111418'
    ctx.fillRect(0, 0, W, H)
  }

  // ── 2) Degradado oscuro: fuerte abajo (panel), leve arriba (legibilidad) ──
  const gradTop = ctx.createLinearGradient(0, 0, 0, H * 0.4)
  gradTop.addColorStop(0, 'rgba(0,0,0,0.55)')
  gradTop.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradTop
  ctx.fillRect(0, 0, W, H * 0.4)

  const gradBottom = ctx.createLinearGradient(0, H * 0.45, 0, H)
  gradBottom.addColorStop(0, 'rgba(0,0,0,0)')
  gradBottom.addColorStop(1, 'rgba(0,0,0,0.88)')
  ctx.fillStyle = gradBottom
  ctx.fillRect(0, H * 0.45, W, H * 0.55)

  const centerX = W / 2

  // ── 3) Cinta diagonal de estado (esquina superior izquierda) ──
  ctx.save()
  ctx.translate(0, 0)
  ctx.rotate(-Math.PI / 4)
  ctx.fillStyle = colorAcento
  ctx.fillRect(-140, 70, 480, 64)
  ctx.restore()
  ctx.fillStyle = '#0b0b0b'
  ctx.font = 'bold 30px sans-serif'
  ctx.textAlign = 'center'
  ctx.save()
  ctx.translate(150, 150)
  ctx.rotate(-Math.PI / 4)
  ctx.fillText(esBienvenida ? 'NUEVO MIEMBRO' : 'SE HA IDO', 0, 10)
  ctx.restore()

  // ── 4) Marca del bot arriba a la derecha ──
  ctx.textAlign = 'right'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(' SAITAMA-BOT', W - 50, 70)

  // ── 5) Foto de perfil del usuario en círculo grande, con anillo ──
  const circR = 175
  const circY = 430
  let imgUser = await cargarImagenSegura(userPicUrl)
  if (!imgUser) {
    imgUser = await cargarImagenSegura(resolverArchivoLib(NOMBRE_SIN_PERFIL))
  }

  // Sombra suave detrás del círculo
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 40
  ctx.beginPath()
  ctx.arc(centerX, circY, circR + 10, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()

  // Anillo doble (blanco fino + color de acento)
  ctx.beginPath()
  ctx.arc(centerX, circY, circR + 14, 0, Math.PI * 2)
  ctx.fillStyle = colorAcento
  ctx.fill()
  ctx.beginPath()
  ctx.arc(centerX, circY, circR + 6, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
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
    ctx.fillStyle = '#181c22'
    ctx.fillRect(centerX - circR, circY - circR, circR * 2, circR * 2)
    ctx.fillStyle = gris
    ctx.font = 'bold 120px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('?', centerX, circY + 42)
  }
  ctx.restore()

  // ── 6) Fondo sólido detrás del nombre — garantiza legibilidad
  //       aunque la foto de fondo sea muy cargada/contrastada ──
  ctx.save()
  ctx.font = 'bold 46px sans-serif'
  const anchoNombre = ctx.measureText(numero).width
  ctx.font = 'bold 26px sans-serif'
  const textoEstado = esBienvenida ? '¡SE UNIÓ AL GRUPO!' : 'HA SALIDO DEL GRUPO'
  const anchoEstado = ctx.measureText(textoEstado).width
  const anchoCaja = Math.min(W - 120, Math.max(anchoNombre, anchoEstado) + 90)
  const cajaX = centerX - anchoCaja / 2
  const cajaY = circY + circR + 40
  const cajaH = 130
  ctx.fillStyle = 'rgba(6,7,9,0.6)'
  roundRect(ctx, cajaX, cajaY, anchoCaja, cajaH, 26)
  ctx.fill()
  ctx.restore()

  // ── 7) Nombre / número, sobre el respaldo sólido ──
  ctx.textAlign = 'center'
  ctx.fillStyle = texto
  ctx.font = 'bold 46px sans-serif'
  ctx.fillText(numero, centerX, circY + circR + 90)

  ctx.fillStyle = colorAcento
  ctx.font = 'bold 26px sans-serif'
  ctx.fillText(textoEstado, centerX, circY + circR + 130)

  // ── 8) Panel inferior SÓLIDO con datos del grupo
  //       (antes era "glass" muy transparente; con fotos de fondo
  //       fuertes casi no se leía nada encima) ──
  const cardX = 60
  const cardW = W - cardX * 2
  const cardH = 380
  const cardY = H - cardH - 60

  ctx.fillStyle = 'rgba(9,10,13,0.86)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 32)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 32)
  ctx.stroke()

  let y = cardY + 56
  ctx.textAlign = 'center'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillStyle = gris
  ctx.fillText('GRUPO', centerX, y)
  y += 38
  ctx.font = 'bold 32px sans-serif'
  ctx.fillStyle = texto
  const nombreGrupo = groupName.length > 28 ? groupName.slice(0, 28) + '…' : groupName
  ctx.fillText(nombreGrupo, centerX, y)
  y += 44

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.moveTo(cardX + 40, y)
  ctx.lineTo(cardX + cardW - 40, y)
  ctx.stroke()
  y += 48

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
    ctx.font = 'bold 26px sans-serif'
    ctx.fillStyle = texto
    ctx.fillText(col.valor, cx, y + 34)
  })
  y += 72

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.beginPath()
  ctx.moveTo(cardX + 40, y)
  ctx.lineTo(cardX + cardW - 40, y)
  ctx.stroke()
  y += 40

  const frase = mensaje || (esBienvenida
    ? 'Un nuevo miembro se une a la comunidad. ¡Bienvenido/a!'
    : 'Gracias por haber sido parte de esta familia.')

  ctx.font = 'italic 21px sans-serif'
  ctx.fillStyle = gris
  const maxAncho = cardW - 90
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
  lineas.slice(0, 2).forEach((l, i) => {
    ctx.fillText(l, centerX, y + i * 28)
  })

  return canvas.toBuffer('image/png')
}

// ═══════════════════════════════════════════
//  .testwelcome — vista previa sin necesidad de que alguien
//  entre/salga de verdad. Usa los datos del propio invocador.
// ═══════════════════════════════════════════
async function ejecutarTestWelcome(m, conn, textoArg) {
  if (!isOwner(m)) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo el dueño del bot puede usar este comando.\n╰───────────────⬣`
    )
  }
  if (!m.isGroup) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Este comando solo funciona dentro de un grupo.\n╰───────────────⬣`
    )
  }

  // Argumento opcional: .testwelcome bye / despedida → previsualiza la despedida
  const arg = (textoArg || '').trim().toLowerCase()
  const esDespedida = ['bye', 'despedida', 'salida', 'adios', 'adiós'].includes(arg)

  const botNumber = conn.user?.jid || conn.user.id
  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const groupSize = groupMetadata.participants.length

  const { jidReal, resuelto } = await resolverJidReal(conn, m.sender)
  const userNumero = obtenerNombreVisible(conn, jidReal, resuelto)

  let userPicUrl
  try {
    userPicUrl = await conn.profilePictureUrl(jidReal, 'image')
  } catch {
    userPicUrl = null
  }

  const mensajePersonalizado = esDespedida ? chat.sBye : chat.sWelcome
  const mensajeFinal = mensajePersonalizado
    ? mensajePersonalizado
        .replace(/@user/g, resuelto ? `@${userNumero.replace('+', '')}` : userNumero)
        .replace(/@group/g, groupMetadata.subject)
        .replace(/@members/g, groupSize)
    : null

  try {
    const imagenBuffer = await generarImagenEvento({
      tipo: esDespedida ? 'despedida' : 'bienvenida',
      numero: userNumero,
      userPicUrl,
      groupName: groupMetadata.subject,
      miembros: groupSize,
      mensaje: mensajeFinal
    })

    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: `🧪 *Vista previa* (${esDespedida ? 'despedida' : 'bienvenida'}) — esto no es un evento real, solo una prueba de la plantilla.`
    }, { quoted: m })
  } catch (e) {
    console.log('[testwelcome] error generando imagen de prueba:', e)
    await m.reply(`╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo generar la tarjeta de prueba.\n╰───────────────⬣`)
  }
}

// ───────────────────────────────────────────
// Comando .welcome — abre el menú de botones
// Comando .testwelcome — envía una tarjeta de prueba con tus propios datos
// ───────────────────────────────────────────
const handler = async (m, { conn, command, text }) => {
  if (command === 'testwelcome') {
    return await ejecutarTestWelcome(m, conn, text)
  }

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

handler.command = ['welcome', 'testwelcome']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['group']
handler.help = ['welcome', 'testwelcome']
handler.desc = 'Menú para activar/desactivar la bienvenida, y .testwelcome para previsualizarla'

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

  if (m._welcomeHandled) return false
  m._welcomeHandled = true

  const participante = m.messageStubParameters?.[0] || m.sender

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