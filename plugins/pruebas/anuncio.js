import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const libDir = path.join(__dirname, '..', '..', 'lib')

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function chatConfig(chatId) {
  if (!global.db.data.chats) global.db.data.chats = {}
  if (!global.db.data.chats[chatId]) global.db.data.chats[chatId] = {}
  const cfg = global.db.data.chats[chatId]
  if (!Array.isArray(cfg.anuncios)) cfg.anuncios = []
  return cfg
}

global.__anunciosTimers = global.__anunciosTimers || {}
global.__anuncioWizard = global.__anuncioWizard || {}

const WIZARD_TTL_MS = 3 * 60 * 1000

function claveWizard(chatId, sender) {
  return `${chatId}:${sender}`
}

function parseIntervalo(str) {
  const m = String(str || '').trim().match(/^(\d+)\s*(m|min|minutos?|h|horas?|d|dias?)$/i)
  if (!m) return null
  const cantidad = parseInt(m[1])
  if (!cantidad || cantidad <= 0) return null
  const unidad = m[2].toLowerCase()

  let ms, etiqueta
  if (unidad.startsWith('m')) { ms = cantidad * 60 * 1000; etiqueta = `${cantidad}m` }
  else if (unidad.startsWith('h')) { ms = cantidad * 60 * 60 * 1000; etiqueta = `${cantidad}h` }
  else { ms = cantidad * 24 * 60 * 60 * 1000; etiqueta = `${cantidad}d` }

  if (ms < 60000) return null
  return { ms, etiqueta }
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

function obtenerFondoAleatorio() {
  const candidatos = ['welcome (1).png', 'welcome (2).png', 'welcome (3).png']
  const existentes = candidatos.filter(f => fs.existsSync(path.join(libDir, f)))
  if (!existentes.length) return null
  return path.join(libDir, existentes[Math.floor(Math.random() * existentes.length)])
}

function dibujarCover(ctx, img, W, H) {
  const escala = Math.max(W / img.width, H / img.height)
  const w = img.width * escala
  const h = img.height * escala
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
}

function ajustarTextoMultilinea(ctx, texto, maxAncho, maxLineas) {
  const palabras = texto.split(/\s+/)
  const lineas = []
  let actual = ''
  for (const palabra of palabras) {
    const prueba = actual ? actual + ' ' + palabra : palabra
    if (ctx.measureText(prueba).width > maxAncho && actual) {
      lineas.push(actual)
      actual = palabra
      if (lineas.length === maxLineas - 1) break
    } else {
      actual = prueba
    }
  }
  if (actual) lineas.push(actual)
  if (lineas.length > maxLineas) lineas.length = maxLineas
  return lineas
}

// Genera la plantilla: fondo aleatorio de lib/, foto citada centrada y enmarcada,
// mensaje debajo. Se usa SOLO cuando el anuncio tiene imagen.
async function generarPlantillaAnuncio(imagenBuffer, mensaje) {
  const W = 900
  const H = 1150
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const verde = '#4ade80'

  const gradBase = ctx.createLinearGradient(0, 0, W, H)
  gradBase.addColorStop(0, '#071a0e')
  gradBase.addColorStop(1, '#0d2416')
  ctx.fillStyle = gradBase
  ctx.fillRect(0, 0, W, H)

  const fondoPath = obtenerFondoAleatorio()
  if (fondoPath) {
    try {
      const fondo = await loadImage(fondoPath)
      dibujarCover(ctx, fondo, W, H)
    } catch (e) {
      console.error('[anuncios] no se pudo cargar el fondo:', e)
    }
  }

  ctx.fillStyle = 'rgba(4,10,6,0.55)'
  ctx.fillRect(0, 0, W, H)

  const padding = 30
  ctx.strokeStyle = 'rgba(74,222,128,0.35)'
  ctx.lineWidth = 3
  roundRect(ctx, padding, padding, W - padding * 2, H - padding * 2, 36)
  ctx.stroke()

  const marginX = 70

  ctx.font = 'bold 20px sans-serif'
  const badge = 'ANUNCIO'
  const badgeAncho = ctx.measureText(badge).width + 44
  ctx.fillStyle = verde
  roundRect(ctx, marginX, 60, badgeAncho, 42, 21)
  ctx.fill()
  ctx.fillStyle = '#04170a'
  ctx.textAlign = 'left'
  ctx.fillText(badge, marginX + 22, 87)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '18px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('SAITAMA-BOT', W - marginX, 87)
  ctx.textAlign = 'left'

  const fotoSize = 620
  const fotoX = (W - fotoSize) / 2
  const fotoY = 140

  try {
    const foto = await loadImage(imagenBuffer)
    const fotoCanvas = createCanvas(fotoSize, fotoSize)
    const fctx = fotoCanvas.getContext('2d')
    dibujarCover(fctx, foto, fotoSize, fotoSize)

    ctx.save()
    roundRect(ctx, fotoX, fotoY, fotoSize, fotoSize, 26)
    ctx.clip()
    ctx.drawImage(fotoCanvas, fotoX, fotoY)
    ctx.restore()
  } catch (e) {
    console.error('[anuncios] error cargando imagen citada:', e)
    ctx.fillStyle = '#0a0a0a'
    roundRect(ctx, fotoX, fotoY, fotoSize, fotoSize, 26)
    ctx.fill()
  }

  ctx.strokeStyle = verde
  ctx.lineWidth = 3
  roundRect(ctx, fotoX, fotoY, fotoSize, fotoSize, 26)
  ctx.stroke()

  ctx.font = 'bold 30px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  const lineas = ajustarTextoMultilinea(ctx, mensaje || '', W - marginX * 2, 3)
  let ty = fotoY + fotoSize + 66
  for (const linea of lineas) {
    ctx.fillText(linea, W / 2, ty)
    ty += 40
  }
  ctx.textAlign = 'left'

  return canvas.toBuffer('image/jpeg', { quality: 0.92 })
}

async function enviarAnuncio(conn, chatId, anuncio, esPrueba = false) {
  try {
    if (anuncio.imagen) {
      const buffer = Buffer.from(anuncio.imagen, 'base64')
      const plantilla = await generarPlantillaAnuncio(buffer, anuncio.mensaje)
      await conn.sendMessage(chatId, {
        image: plantilla,
        caption: esPrueba ? decorar('Vista previa de prueba') : undefined
      })
    } else {
      await conn.sendMessage(chatId, { text: decorar(anuncio.mensaje || 'Anuncio') })
    }
    if (!esPrueba) {
      anuncio.vecesEnviado = (anuncio.vecesEnviado || 0) + 1
      anuncio.ultimoEnvio = Date.now()
      global.markDatabaseModified()
    }
  } catch (e) {
    console.error('[anuncios] error enviando anuncio:', e)
  }
}

function detenerTimer(id) {
  if (global.__anunciosTimers[id]) {
    clearInterval(global.__anunciosTimers[id])
    delete global.__anunciosTimers[id]
  }
}

function programarAnuncio(conn, chatId, anuncio) {
  detenerTimer(anuncio.id)
  if (!anuncio.activo) return
  global.__anunciosTimers[anuncio.id] = setInterval(() => {
    enviarAnuncio(conn, chatId, anuncio)
  }, anuncio.intervaloMs)
}

function rehidratarTodos(conn) {
  if (!global.db?.data?.chats) return
  for (const chatId of Object.keys(global.db.data.chats)) {
    const cfg = global.db.data.chats[chatId]
    if (!Array.isArray(cfg.anuncios)) continue
    for (const anuncio of cfg.anuncios) {
      if (anuncio.activo && !global.__anunciosTimers[anuncio.id]) {
        programarAnuncio(conn, chatId, anuncio)
      }
    }
  }
}

function intentarRehidratar(reintentos = 10) {
  if (global.conn && global.db?.data) {
    rehidratarTodos(global.conn)
  } else if (reintentos > 0) {
    setTimeout(() => intentarRehidratar(reintentos - 1), 3000)
  }
}
intentarRehidratar()

function contarAnuncios(soloEsteChat, chatId) {
  if (!global.db?.data?.chats) return { total: 0, activos: 0 }
  let total = 0, activos = 0
  const chats = soloEsteChat ? [chatId] : Object.keys(global.db.data.chats)
  for (const c of chats) {
    const cfg = global.db.data.chats[c]
    if (!cfg?.anuncios) continue
    total += cfg.anuncios.length
    activos += cfg.anuncios.filter(a => a.activo).length
  }
  return { total, activos }
}

function crearAnuncioObjeto({ intervalo, mensaje, imagenBase64, creadoPor }) {
  return {
    id: crypto.randomBytes(3).toString('hex'),
    mensaje,
    imagen: imagenBase64,
    intervaloMs: intervalo.ms,
    intervaloTexto: intervalo.etiqueta,
    creadoPor,
    creadoEn: Date.now(),
    activo: true,
    vecesEnviado: 0
  }
}

async function obtenerGruposDelBot(conn) {
  try {
    const grupos = await conn.groupFetchAllParticipating()
    return Object.values(grupos).map(g => ({ id: g.id, subject: g.subject, miembros: g.participants?.length || 0 }))
  } catch (e) {
    console.error('[anuncios] error obteniendo grupos:', e)
    return []
  }
}

function unwrapMessage(message) {
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find(w => msg[w])
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
      const id = data.id || data.selectedId || data.selectedRowId
      if (id) return id
    } catch {}
  }
  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId
  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId
  return null
}

async function enviarMenu(conn, m) {
  const card = {
    header: { title: '', hasMediaAttachment: false },
    body: { text: decorar('¿Qué deseas hacer?') },
    nativeFlowMessage: {
      buttons: [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Crear anuncio', id: 'anuncio_menu~crear' }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Ver lista', id: 'anuncio_menu~lista' }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Contar anuncios', id: 'anuncio_menu~contar' }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Gestionar (pausar/eliminar)', id: 'anuncio_menu~pausar' }) }
      ]
    }
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    body: { text: decorar('Sistema de anuncios programados\n\nElige una opción, o escribe directamente:\n.anuncio crear <intervalo> | <mensaje>') },
    footer: { text: '🍃 SAITAMA-BOT' },
    header: { title: '', hasMediaAttachment: false },
    carouselMessage: { cards: [card] }
  })

  const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

async function mostrarLista(conn, chatId, quoted) {
  const cfg = chatConfig(chatId)
  if (!cfg.anuncios.length) {
    return conn.sendMessage(chatId, { text: decorar('No hay anuncios programados en este grupo') }, quoted ? { quoted } : {})
  }
  let texto = `Anuncios de este grupo (${cfg.anuncios.length})\n\n`
  for (const a of cfg.anuncios) {
    texto += `ID: ${a.id} — ${a.activo ? 'Activo' : 'Pausado'}\n`
    texto += `Cada ${a.intervaloTexto} | Enviado ${a.vecesEnviado || 0} veces${a.imagen ? ' | Con imagen' : ''}\n`
    texto += `"${a.mensaje.slice(0, 40)}${a.mensaje.length > 40 ? '...' : ''}"\n\n`
  }
  return conn.sendMessage(chatId, { text: decorar(texto.trim()) }, quoted ? { quoted } : {})
}

let handler = async (m, { conn, text, isOwner, command }) => {
  if (!isOwner) {
    return conn.sendMessage(m.chat, { text: decorar('Solo el owner puede usar este comando') }, { quoted: m })
  }

  if (!m.isGroup) {
    return conn.sendMessage(m.chat, { text: decorar('Este comando es para grupos') }, { quoted: m })
  }

  // ── .testanuncio <id> — envía de inmediato una vista previa, sin esperar el intervalo ──
  if (command === 'testanuncio') {
    const idPrueba = (text || '').trim()
    const cfgPrueba = chatConfig(m.chat)

    if (!idPrueba) {
      return conn.sendMessage(m.chat, {
        text: decorar('Uso: .testanuncio <id>\nUsa .anuncio lista para ver los IDs disponibles')
      }, { quoted: m })
    }

    const anuncioPrueba = cfgPrueba.anuncios.find(a => a.id === idPrueba)
    if (!anuncioPrueba) {
      return conn.sendMessage(m.chat, { text: decorar('No encontré un anuncio con ese ID') }, { quoted: m })
    }

    await conn.sendMessage(m.chat, { text: decorar('Enviando vista previa...') }, { quoted: m })
    await enviarAnuncio(conn, m.chat, anuncioPrueba, true)
    return
  }

  const args = (text || '').trim()
  const partes = args.split(' ')
  const sub = (partes[0] || '').toLowerCase()
  const resto = partes.slice(1).join(' ')

  if (!sub) {
    return enviarMenu(conn, m)
  }

  const cfg = m.isGroup ? chatConfig(m.chat) : null

  if (sub === 'crear') {
    const [intervaloRaw, ...msgParts] = resto.split('|')
    const mensaje = msgParts.join('|').trim()
    const intervalo = parseIntervalo(intervaloRaw)

    if (!intervalo || !mensaje) {
      return conn.sendMessage(m.chat, {
        text: decorar(
          'Uso: .anuncio crear <intervalo> | <mensaje>\n\n' +
          'Ejemplo: .anuncio crear 3h | Recuerda las reglas\n' +
          'Unidades: m, h, d\n' +
          'Responde a una imagen para adjuntarla'
        )
      }, { quoted: m })
    }

    let imagenBase64 = null
    if (m.quoted && /image/.test(m.quoted.mimetype || '')) {
      try { imagenBase64 = (await m.quoted.download()).toString('base64') } catch {}
    }

    const anuncio = crearAnuncioObjeto({ intervalo, mensaje, imagenBase64, creadoPor: m.sender })
    cfg.anuncios.push(anuncio)
    global.markDatabaseModified()
    programarAnuncio(conn, m.chat, anuncio)

    return conn.sendMessage(m.chat, {
      text: decorar(`Anuncio creado\nID: ${anuncio.id}\nCada: ${intervalo.etiqueta}${imagenBase64 ? '\nCon imagen adjunta' : ''}`)
    }, { quoted: m })
  }

  if (sub === 'grupos') {
    const grupos = await obtenerGruposDelBot(conn)
    if (!grupos.length) {
      return conn.sendMessage(m.chat, { text: decorar('No encontré grupos donde esté el bot') }, { quoted: m })
    }
    let texto = `El bot está en ${grupos.length} grupo${grupos.length === 1 ? '' : 's'}\n\n`
    grupos.forEach((g, i) => {
      texto += `${i + 1}. ${g.subject} (${g.miembros} miembros)\n`
    })
    return conn.sendMessage(m.chat, { text: decorar(texto.trim()) }, { quoted: m })
  }

  if (sub === 'lista' || sub === 'ver') return mostrarLista(conn, m.chat, m)

  if (sub === 'contar') {
    const local = contarAnuncios(true, m.chat)
    const global_ = contarAnuncios(false)
    return conn.sendMessage(m.chat, {
      text: decorar(`Anuncios en este grupo\nTotal: ${local.total}\nActivos: ${local.activos}\n\nEn todo el bot\nTotal: ${global_.total}\nActivos: ${global_.activos}`)
    }, { quoted: m })
  }

  if (sub === 'eliminar' || sub === 'borrar') {
    const id = resto.trim()
    const idx = cfg.anuncios.findIndex(a => a.id === id)
    if (idx === -1) return conn.sendMessage(m.chat, { text: decorar('No encontré un anuncio con ese ID\nUsa .anuncio lista') }, { quoted: m })
    detenerTimer(cfg.anuncios[idx].id)
    cfg.anuncios.splice(idx, 1)
    global.markDatabaseModified()
    return conn.sendMessage(m.chat, { text: decorar('Anuncio eliminado') }, { quoted: m })
  }

  if (sub === 'pausar' || sub === 'reanudar') {
    const id = resto.trim()
    const anuncio = cfg.anuncios.find(a => a.id === id)
    if (!anuncio) return conn.sendMessage(m.chat, { text: decorar('No encontré un anuncio con ese ID\nUsa .anuncio lista') }, { quoted: m })
    anuncio.activo = (sub === 'reanudar')
    global.markDatabaseModified()
    if (anuncio.activo) programarAnuncio(conn, m.chat, anuncio)
    else detenerTimer(anuncio.id)
    return conn.sendMessage(m.chat, { text: decorar(`Anuncio ${anuncio.id} ${anuncio.activo ? 'reanudado' : 'pausado'}`) }, { quoted: m })
  }

  return enviarMenu(conn, m)
}

handler.before = async (m, { conn }) => {
  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (id && id.startsWith('anuncio_menu~')) {
    const accion = id.split('~')[1]

    if (accion === 'crear') {
      global.__anuncioWizard[claveWizard(m.chat, m.sender)] = { paso: 'intervalo', actualizado: Date.now() }
      await conn.sendMessage(m.chat, {
        text: decorar('Vamos a crear un anuncio\n\n¿Cada cuánto se debe repetir?\nEjemplos: 30m, 3h, 1d\n\nEscribe "cancelar" para salir')
      }, { quoted: m })
      return true
    }
    if (accion === 'lista') { await mostrarLista(conn, m.chat, m); return true }
    if (accion === 'contar') {
      const local = contarAnuncios(true, m.chat)
      await conn.sendMessage(m.chat, { text: decorar(`Anuncios en este grupo\nTotal: ${local.total}\nActivos: ${local.activos}`) }, { quoted: m })
      return true
    }
    if (accion === 'pausar' || accion === 'eliminar') {
      await mostrarLista(conn, m.chat, m)
      await conn.sendMessage(m.chat, {
        text: decorar(`Copia el ID que quieras y escribe:\n.anuncio pausar <id>\n.anuncio reanudar <id>\n.anuncio eliminar <id>`)
      }, { quoted: m })
      return true
    }
    return true
  }

  const clave = claveWizard(m.chat, m.sender)
  const estado = global.__anuncioWizard[clave]
  if (!estado) return false

  if (Date.now() - estado.actualizado > WIZARD_TTL_MS) {
    delete global.__anuncioWizard[clave]
    return false
  }

  const texto = (content.conversation || content.extendedTextMessage?.text || '').trim()

  if (texto.toLowerCase() === 'cancelar') {
    delete global.__anuncioWizard[clave]
    await conn.sendMessage(m.chat, { text: decorar('Creación cancelada') }, { quoted: m })
    return true
  }

  if (estado.paso === 'intervalo') {
    const intervalo = parseIntervalo(texto)
    if (!intervalo) {
      await conn.sendMessage(m.chat, { text: decorar('No entendí ese intervalo\nEjemplos válidos: 30m, 3h, 1d') }, { quoted: m })
      return true
    }
    estado.intervalo = intervalo
    estado.paso = 'mensaje'
    estado.actualizado = Date.now()
    await conn.sendMessage(m.chat, { text: decorar('Perfecto\n\nAhora escribe el mensaje del anuncio') }, { quoted: m })
    return true
  }

  if (estado.paso === 'mensaje') {
    if (!texto) {
      await conn.sendMessage(m.chat, { text: decorar('Escribe el texto del anuncio') }, { quoted: m })
      return true
    }
    estado.mensaje = texto
    estado.paso = 'imagen'
    estado.actualizado = Date.now()
    await conn.sendMessage(m.chat, {
      text: decorar('¿Quieres agregarle una imagen?\nEnvía la foto ahora, o escribe "no" para continuar sin imagen')
    }, { quoted: m })
    return true
  }

  if (estado.paso === 'imagen') {
    if (content.imageMessage) {
      let imagenBase64 = null
      try { imagenBase64 = (await m.download()).toString('base64') } catch {}
      estado.imagenBase64 = imagenBase64
      estado.paso = 'grupos'
      estado.actualizado = Date.now()
      await pedirGrupos(conn, m)
      return true
    }

    if (texto.toLowerCase() === 'no') {
      estado.imagenBase64 = null
      estado.paso = 'grupos'
      estado.actualizado = Date.now()
      await pedirGrupos(conn, m)
      return true
    }

    await conn.sendMessage(m.chat, { text: decorar('Envía una foto, o escribe "no" para continuar sin imagen') }, { quoted: m })
    return true
  }

  if (estado.paso === 'grupos_manual') {
    const grupos = await obtenerGruposDelBot(conn)
    const seleccion = texto.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 1 && n <= grupos.length)

    if (!seleccion.length) {
      await conn.sendMessage(m.chat, { text: decorar('No entendí esa selección\nEscribe los números separados por coma, ej: 1,3,5') }, { quoted: m })
      return true
    }

    const idsElegidos = [...new Set(seleccion)].map(n => grupos[n - 1].id)
    delete global.__anuncioWizard[clave]
    await finalizarCreacion(conn, m, estado, idsElegidos)
    return true
estado.paso = 'grupos'
      estado.actualizado = Date.now()
      await pedirGrupos(conn, m)
      return true
    }

    if (texto.toLowerCase() === 'no') {
      estado.imagenBase64 = null
      estado.paso = 'grupos'
      estado.actualizado = Date.now()
      await pedirGrupos(conn, m)
      return true
    }

    await conn.sendMessage(m.chat, { text: decorar('Envía una foto, o escribe "no" para continuar sin imagen') }, { quoted: m })
    return true
  }

  if (estado.paso === 'grupos_manual') {
    const grupos = await obtenerGruposDelBot(conn)
    const seleccion = texto.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 1 && n <= grupos.length)

    if (!seleccion.length) {
      await conn.sendMessage(m.chat, { text: decorar('No entendí esa selección\nEscribe los números separados por coma, ej: 1,3,5') }, { quoted: m })
      return true
    }

    const idsElegidos = [...new Set(seleccion)].map(n => grupos[n - 1].id)
    delete global.__anuncioWizard[clave]
    await finalizarCreacion(conn, m, estado, idsElegidos)
    return true
  }

  // ── Botones de selección de grupos (paso final del asistente) ──
  if (id && id.startsWith('anuncio_grupos~')) {
    const accionGrupo = id.split('~')[1]
    const clave2 = claveWizard(m.chat, m.sender)
    const estado2 = global.__anuncioWizard[clave2]

    if (!estado2 || estado2.paso !== 'grupos') {
      await conn.sendMessage(m.chat, { text: decorar('Esa selección ya expiró, empieza de nuevo con .anuncio') }, { quoted: m })
      return true
    }

    if (accionGrupo === 'todos') {
      const grupos = await obtenerGruposDelBot(conn)
      delete global.__anuncioWizard[clave2]
      await finalizarCreacion(conn, m, estado2, grupos.map(g => g.id))
      return true
    }

    if (accionGrupo === 'actual') {
      delete global.__anuncioWizard[clave2]
      await finalizarCreacion(conn, m, estado2, [m.chat])
      return true
    }

    if (accionGrupo === 'manual') {
      const grupos = await obtenerGruposDelBot(conn)
      if (!grupos.length) {
        delete global.__anuncioWizard[clave2]
        await conn.sendMessage(m.chat, { text: decorar('No encontré grupos donde esté el bot') }, { quoted: m })
        return true
      }
      let listaTexto = 'Escribe los números separados por coma\nEjemplo: 1,3,5\n\n'
      grupos.forEach((g, i) => {
        listaTexto += `${i + 1}. ${g.subject} (${g.miembros} miembros)\n`
      })
      estado2.paso = 'grupos_manual'
      estado2.actualizado = Date.now()
      await conn.sendMessage(m.chat, { text: decorar(listaTexto.trim()) }, { quoted: m })
      return true
    }

    return true
  }

  return false
}

// 📢 Pregunta en qué grupos publicar: "todos" o "elegir manualmente", con botones planos
async function pedirGrupos(conn, m) {
  const card = {
    header: { title: '', hasMediaAttachment: false },
    body: { text: decorar('¿En qué grupos se debe publicar este anuncio?') },
    nativeFlowMessage: {
      buttons: [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Todos los grupos', id: 'anuncio_grupos~todos' }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Solo este grupo', id: 'anuncio_grupos~actual' }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Elegir manualmente', id: 'anuncio_grupos~manual' }) }
      ]
    }
  }

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    body: { text: decorar('Último paso') },
    footer: { text: '🍃 SAITAMA-BOT' },
    header: { title: '', hasMediaAttachment: false },
    carouselMessage: { cards: [card] }
  })
  const msg = generateWAMessageFromContent(m.chat, { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } }, { quoted: m })
  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

// ✅ Crea el anuncio (una copia independiente) en cada grupo elegido y lo programa
async function finalizarCreacion(conn, m, estado, gruposIds) {
  if (!gruposIds.length) {
    await conn.sendMessage(m.chat, { text: decorar('No se seleccionó ningún grupo, se canceló la creación') }, { quoted: m })
    return
  }

  const creados = []
  for (const chatId of gruposIds) {
    const anuncio = crearAnuncioObjeto({
      intervalo: estado.intervalo,
      mensaje: estado.mensaje,
      imagenBase64: estado.imagenBase64,
      creadoPor: m.sender
    })
    const cfg = chatConfig(chatId)
    cfg.anuncios.push(anuncio)
    programarAnuncio(conn, chatId, anuncio)
    creados.push({ chatId, id: anuncio.id })
  }
  global.markDatabaseModified()

  let resumen = `Anuncio creado en ${creados.length} grupo${creados.length === 1 ? '' : 's'}\n\n`
  for (const c of creados) {
    resumen += `ID ${c.id}\n`
  }
  await conn.sendMessage(m.chat, { text: decorar(resumen.trim()) }, { quoted: m })
}

handler.help = ['anuncio <crear/lista/grupos/contar/pausar/eliminar>', 'testanuncio <id>']
handler.tags = ['group']
handler.command = /^(anuncio|anuncios|programar|testanuncio)$/i
handler.desc = 'Sistema de anuncios programados para grupos, con menú guiado, plantilla visual y modo de prueba'
handler.owner = true

export default handler