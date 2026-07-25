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

// === Anti-duplicados: evita procesar el mismo evento de entrada/salida dos veces ===
const eventosProcesados = new Map()
const VENTANA_DEDUPE_MS = 10 * 1000

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
      if (real) {
        console.log('[welcome][DEBUG] LID resuelto vía signalRepository:', jid, '->', real)
        return { jidReal: real, resuelto: true }
      }
    }
  } catch (e) {
    console.log('[welcome][DEBUG] fallo resolviendo LID vía signalRepository:', e?.message)
  }

  try {
    const contacto = conn.store?.contacts?.[jid] || conn.contacts?.[jid]
    if (contacto?.jid && contacto.jid !== jid) {
      console.log('[welcome][DEBUG] LID resuelto vía store.contacts:', jid, '->', contacto.jid)
      return { jidReal: contacto.jid, resuelto: true }
    }
  } catch {}

  console.log('[welcome][DEBUG] no se pudo resolver el LID, se usa tal cual:', jid)
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
//  GENERADOR DE IMAGEN — estilo NEON AZUL/NEGRO
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

// Pseudo-blur: reduce y agranda la imagen varias veces
function dibujarFondoDesenfocado(ctx, img, W, H) {
  const off = createCanvas(W, H)
  const octx = off.getContext('2d')

  const escala = Math.max(W / img.width, H / img.height)
  const iw = img.width * escala
  const ih = img.height * escala
  const ix = (W - iw) / 2
  const iy = (H - ih) / 2
  octx.drawImage(img, ix, iy, iw, ih)

  let src = off
  const pasos = [0.5, 0.25, 0.12]
  for (const factor of pasos) {
    const sw = Math.max(1, Math.round(W * factor))
    const sh = Math.max(1, Math.round(H * factor))
    const small = createCanvas(sw, sh)
    const sctx = small.getContext('2d')
    sctx.imageSmoothingEnabled = true
    sctx.drawImage(src, 0, 0, sw, sh)

    const back = createCanvas(W, H)
    const bctx = back.getContext('2d')
    bctx.imageSmoothingEnabled = true
    bctx.drawImage(small, 0, 0, W, H)
    src = back
  }

  ctx.drawImage(src, 0, 0, W, H)
}

function formatFecha(fecha) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const d = fecha.getDate().toString().padStart(2, '0')
  const mes = meses[fecha.getMonth()]
  const anio = fecha.getFullYear()
  return `${d} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${anio}`
}

function formatHora(fecha) {
  const h = fecha.getHours().toString().padStart(2, '0')
  const min = fecha.getMinutes().toString().padStart(2, '0')
  return `${h}:${min}`
}

// Dibuja una línea de "circuito" decorativa (estética tech/neon)
function dibujarCircuitos(ctx, W, H, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.18
  ctx.lineWidth = 2
  const seed = 7
  let x = 40
  for (let i = 0; i < 14; i++) {
    const y = 60 + ((i * 53 + seed * 17) % (H - 120))
    const largo = 60 + ((i * 37) % 180)
    const horizontal = i % 2 === 0
    ctx.beginPath()
    if (horizontal) {
      ctx.moveTo(x + (i * 40) % (W - 200), y)
      ctx.lineTo(x + (i * 40) % (W - 200) + largo, y)
    } else {
      ctx.moveTo(W - 40 - (i * 25) % 150, y)
      ctx.lineTo(W - 40 - (i * 25) % 150, y + largo)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// Texto con efecto neón (glow)
function textoNeon(ctx, texto, x, y, colorGlow, colorTexto, blur = 18) {
  ctx.save()
  ctx.shadowColor = colorGlow
  ctx.shadowBlur = blur
  ctx.fillStyle = colorTexto
  ctx.fillText(texto, x, y)
  ctx.shadowBlur = blur * 0.6
  ctx.fillText(texto, x, y)
  ctx.restore()
}

/**
 * Genera la imagen de bienvenida/despedida — estilo NEON AZUL/NEGRO.
 * tipo: 'bienvenida' | 'despedida'
 */
async function generarImagenEvento({ tipo, numero, userPicUrl, groupPicUrl, groupName, miembros, mensaje }) {
  const W = 1200
  const H = 800
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const esBienvenida = tipo === 'bienvenida'

  // Paleta neón
  const cianNeon = '#00eaff'
  const azulNeon = '#0077ff'
  const azulClaro = '#8fd9ff'
  const blanco = '#ffffff'

  // ── Fondo: negro puro + foto del grupo desenfocada y teñida de azul ──
  ctx.fillStyle = '#050810'
  ctx.fillRect(0, 0, W, H)

  const imgGrupo = await cargarImagenSegura(groupPicUrl)
  if (imgGrupo) {
    dibujarFondoDesenfocado(ctx, imgGrupo, W, H)
    // Tinte azul/negro encima de la foto para que combine con el estilo neón
    ctx.fillStyle = 'rgba(3,6,15,0.72)'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,100,255,0.10)'
    ctx.fillRect(0, 0, W, H)
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#020409')
    grad.addColorStop(0.5, '#04101f')
    grad.addColorStop(1, '#000000')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }

  // Circuitos decorativos
  dibujarCircuitos(ctx, W, H, cianNeon)

  // Línea de degradado neón en el borde superior
  const lineaTop = ctx.createLinearGradient(0, 0, W, 0)
  lineaTop.addColorStop(0, 'rgba(0,234,255,0)')
  lineaTop.addColorStop(0.5, 'rgba(0,234,255,0.9)')
  lineaTop.addColorStop(1, 'rgba(0,234,255,0)')
  ctx.fillStyle = lineaTop
  ctx.fillRect(0, 0, W, 4)

  // ── Título (nombre del grupo) arriba a la izquierda, con glow ──
  ctx.textAlign = 'left'
  ctx.font = 'bold 44px sans-serif'
  const tituloGrupo = groupName.length > 22 ? groupName.slice(0, 22) + '…' : groupName
  textoNeon(ctx, tituloGrupo, 60, 90, cianNeon, blanco, 20)

  // ── Tarjeta principal ──
  const cardX = 60
  const cardY = 150
  const cardW = 680
  const cardH = 630

  ctx.save()
  ctx.fillStyle = 'rgba(3,8,18,0.75)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 26)
  ctx.fill()

  // Borde neón con glow
  ctx.shadowColor = azulNeon
  ctx.shadowBlur = 22
  ctx.strokeStyle = cianNeon
  ctx.lineWidth = 2.5
  roundRect(ctx, cardX, cardY, cardW, cardH, 26)
  ctx.stroke()
  ctx.restore()

  const centerX = cardX + cardW / 2
  ctx.textAlign = 'center'

  // Encabezado
  ctx.font = 'bold 26px sans-serif'
  textoNeon(ctx, esBienvenida ? '¡BIENVENIDO/A!' : 'HASTA PRONTO', centerX, cardY + 60, cianNeon, azulClaro, 14)

  // Número / etiqueta del usuario
  ctx.font = 'bold 44px sans-serif'
  textoNeon(ctx, numero, centerX, cardY + 125, cianNeon, blanco, 16)

  // Subtítulo
  ctx.fillStyle = '#a9c9e0'
  ctx.font = '24px sans-serif'
  ctx.shadowBlur = 0
  ctx.fillText(esBienvenida ? 'Se unió al grupo' : 'Ha salido del grupo', centerX, cardY + 165)

  // Línea divisoria neón
  const divisoria = ctx.createLinearGradient(cardX + 40, 0, cardX + cardW - 40, 0)
  divisoria.addColorStop(0, 'rgba(0,234,255,0)')
  divisoria.addColorStop(0.5, 'rgba(0,234,255,0.6)')
  divisoria.addColorStop(1, 'rgba(0,234,255,0)')
  ctx.strokeStyle = divisoria
  ctx.beginPath()
  ctx.moveTo(cardX + 40, cardY + 205)
  ctx.lineTo(cardX + cardW - 40, cardY + 205)
  ctx.stroke()

  // Grupo
  ctx.fillStyle = cianNeon
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('GRUPO', centerX, cardY + 260)
  ctx.fillStyle = blanco
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText(tituloGrupo, centerX, cardY + 300)

  // Columnas: MIEMBROS / FECHA / HORA
  const ahora = new Date()
  const columnas = [
    { label: 'MIEMBROS', valor: String(miembros) },
    { label: 'FECHA', valor: formatFecha(ahora) },
    { label: 'HORA', valor: formatHora(ahora) }
  ]
  const colY = cardY + 380
  const colAncho = cardW / 3
  columnas.forEach((col, i) => {
    const cx = cardX + colAncho * i + colAncho / 2
    ctx.fillStyle = cianNeon
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(col.label, cx, colY)
    ctx.fillStyle = blanco
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText(col.valor, cx, colY + 36)
  })

  // Caja de frase
  const quoteY = cardY + cardH - 130
  const quoteH = 95
  ctx.fillStyle = 'rgba(0,150,255,0.07)'
  roundRect(ctx, cardX + 30, quoteY, cardW - 60, quoteH, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,234,255,0.35)'
  ctx.lineWidth = 1.5
  roundRect(ctx, cardX + 30, quoteY, cardW - 60, quoteH, 14)
  ctx.stroke()

  ctx.fillStyle = '#d8ecff'
  ctx.font = 'italic 20px sans-serif'
  const frase = mensaje || (esBienvenida
    ? 'Conectado a la red. Bienvenido al sistema.'
    : 'Conexión finalizada. La red siempre te recordará.')

  const palabras = frase.split(' ')
  let linea = ''
  const lineasFinal = []
  const maxAncho = cardW - 100
  for (const palabra of palabras) {
    const prueba = linea ? linea + ' ' + palabra : palabra
    if (ctx.measureText(prueba).width > maxAncho && linea) {
      lineasFinal.push(linea)
      linea = palabra
    } else {
      linea = prueba
    }
  }
  if (linea) lineasFinal.push(linea)
  const lineaAltura = 26
  const inicioY = quoteY + quoteH / 2 - ((lineasFinal.length - 1) * lineaAltura) / 2 + 6
  lineasFinal.slice(0, 3).forEach((l, i) => {
    ctx.fillText(l, centerX, inicioY + i * lineaAltura)
  })

  // ── Foto de perfil del usuario (círculo neón a la derecha) ──
  const imgUser = await cargarImagenSegura(userPicUrl)
  const circR = 240
  const circX = W - 340
  const circY = H / 2 - 20

  ctx.save()
  ctx.beginPath()
  ctx.arc(circX, circY, circR, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (imgUser) {
    const escala = Math.max((circR * 2) / imgUser.width, (circR * 2) / imgUser.height)
    const iw = imgUser.width * escala
    const ih = imgUser.height * escala
    ctx.drawImage(imgUser, circX - iw / 2, circY - ih / 2, iw, ih)
  } else {
    const gradCirc = ctx.createLinearGradient(circX - circR, circY - circR, circX + circR, circY + circR)
    gradCirc.addColorStop(0, '#041018')
    gradCirc.addColorStop(1, '#0a1f33')
    ctx.fillStyle = gradCirc
    ctx.fillRect(circX - circR, circY - circR, circR * 2, circR * 2)
  }
  ctx.restore()

  // Doble anillo neón
  ctx.save()
  ctx.shadowColor = cianNeon
  ctx.shadowBlur = 30
  ctx.beginPath()
  ctx.arc(circX, circY, circR, 0, Math.PI * 2)
  ctx.lineWidth = 6
  ctx.strokeStyle = cianNeon
  ctx.stroke()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(circX, circY, circR + 12, 0, Math.PI * 2)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(0,234,255,0.35)'
  ctx.stroke()

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

  const idEvento = m.key?.id || `${m.chat}_${m.messageStubType}_${m.messageStubParameters?.[0] || m.sender}`
  if (yaSeProceso(idEvento)) return false

  const settings = getChatConfig(botNumber, m.chat)
  const chat = settings[botNumber][m.chat]

  const groupMetadata = await conn.groupMetadata(m.chat)
  const groupSize = groupMetadata.participants.length
  const userIdOriginal = m.messageStubParameters?.[0] || m.sender

  console.