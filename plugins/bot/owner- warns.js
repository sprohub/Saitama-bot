import fs from 'fs'
import path from 'path'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const warnsPath = path.resolve('./json/warns.json')
const MAX_WARNS = 3

// ═══════════════════════════════════════════
//  PERMISOS
// ═══════════════════════════════════════════
function isOwner(m) {
  const number = m.sender?.split('@')[0]
  const owners = (global.owner || []).map(([num]) => num.replace(/[^0-9]/g, ''))
  return m.fromMe || owners.includes(number)
}

async function isAdmin(conn, chat, sender) {
  try {
    const metadata = await conn.groupMetadata(chat)
    const participante = metadata.participants.find(p => p.id === sender)
    return !!participante?.admin
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════
//  ALMACENAMIENTO
// ═══════════════════════════════════════════
function leerWarns() {
  try {
    if (!fs.existsSync(warnsPath)) {
      fs.mkdirSync(path.dirname(warnsPath), { recursive: true })
      fs.writeFileSync(warnsPath, JSON.stringify({}, null, 2))
    }
    return JSON.parse(fs.readFileSync(warnsPath))
  } catch {
    return {}
  }
}

function guardarWarns(data) {
  fs.writeFileSync(warnsPath, JSON.stringify(data, null, 2))
}

function obtenerRegistro(botNumber, chatId, userId) {
  const data = leerWarns()
  const registro = data?.[botNumber]?.[chatId]?.[userId]
  return registro || { count: 0, razones: [] }
}

function agregarWarn(botNumber, chatId, userId, razon) {
  const data = leerWarns()
  if (!data[botNumber]) data[botNumber] = {}
  if (!data[botNumber][chatId]) data[botNumber][chatId] = {}
  if (!data[botNumber][chatId][userId]) data[botNumber][chatId][userId] = { count: 0, razones: [] }

  data[botNumber][chatId][userId].count += 1
  data[botNumber][chatId][userId].razones.push(razon || 'Sin razón especificada')

  guardarWarns(data)
  return data[botNumber][chatId][userId]
}

function quitarWarn(botNumber, chatId, userId) {
  const data = leerWarns()
  const registro = data?.[botNumber]?.[chatId]?.[userId]
  if (!registro || registro.count <= 0) return { count: 0, razones: [] }

  registro.count -= 1
  registro.razones.pop()
  guardarWarns(data)
  return registro
}

function resetWarn(botNumber, chatId, userId) {
  const data = leerWarns()
  if (data?.[botNumber]?.[chatId]?.[userId]) {
    data[botNumber][chatId][userId] = { count: 0, razones: [] }
    guardarWarns(data)
  }
  return { count: 0, razones: [] }
}

// ═══════════════════════════════════════════
//  TARJETA — vidrio "agrietado" por cada advertencia (temática Saitama)
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

// Dibuja grietas de vidrio proporcionales a la cantidad de warns.
// La idea: cada advertencia es "un golpe" que agrieta más el cristal.
function dibujarGrietas(ctx, centerX, centerY, radio, nivel, seedBase) {
  // nivel: 0 (sin grietas) a 1 (vidrio roto por completo)
  if (nivel <= 0) return
  const numGrietas = Math.round(4 + nivel * 10)
  ctx.save()
  ctx.beginPath()
  ctx.arc(centerX, centerY, radio, 0, Math.PI * 2)
  ctx.clip()

  ctx.strokeStyle = `rgba(255,255,255,${0.5 + nivel * 0.3})`
  ctx.lineWidth = 1.5

  let seed = seedBase
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  for (let i = 0; i < numGrietas; i++) {
    const ang = rand() * Math.PI * 2
    const largo = radio * (0.3 + rand() * 0.7 * nivel)
    let x = centerX
    let y = centerY
    ctx.beginPath()
    ctx.moveTo(x, y)
    const segmentos = 3 + Math.floor(rand() * 3)
    for (let s = 0; s < segmentos; s++) {
      const desvio = (rand() - 0.5) * 0.8
      x += Math.cos(ang + desvio) * (largo / segmentos)
      y += Math.sin(ang + desvio) * (largo / segmentos)
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// Fila de "puños" (pips) representando warns usados vs disponibles
function dibujarPuños(ctx, centerX, y, usados, total, colorLleno, colorVacio) {
  const radio = 16
  const espacio = 46
  const inicioX = centerX - ((total - 1) * espacio) / 2

  for (let i = 0; i < total; i++) {
    const x = inicioX + i * espacio
    const lleno = i < usados
    ctx.beginPath()
    ctx.arc(x, y, radio, 0, Math.PI * 2)
    ctx.fillStyle = lleno ? colorLleno : 'rgba(255,255,255,0.06)'
    ctx.fill()
    if (!lleno) {
      ctx.strokeStyle = colorVacio
      ctx.lineWidth = 2
      ctx.stroke()
    }
    // Pequeño brillo tipo "nudillo"
    if (lleno) {
      ctx.beginPath()
      ctx.arc(x - 5, y - 5, 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fill()
    }
  }
}

function formatFecha(fecha) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const d = fecha.getDate().toString().padStart(2, '0')
  const mes = meses[fecha.getMonth()]
  return `${d} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${fecha.getFullYear()}`
}

function recortarTexto(ctx, texto, maxAncho) {
  let t = texto
  while (ctx.measureText(t).width > maxAncho && t.length > 3) {
    t = t.slice(0, -2)
  }
  return t === texto ? t : t + '…'
}

/**
 * Genera la tarjeta de advertencias.
 * estado: 'normal' | 'expulsado'
 */
async function generarImagenWarns({ estado, numero, userPicUrl, groupName, count, max, razones }) {
  const W = 900
  const H = 1050
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const fondo = '#111418'
  const panel = '#181c22'
  const texto = '#f2f4f7'
  const gris = '#8b95a1'
  const amarillo = '#ffd23f'
  const rojo = '#ff5c5c'

  const expulsado = estado === 'expulsado'
  const nivel = Math.min(1, count / max)
  const colorAcento = expulsado ? rojo : amarillo
  const colorAcentoSuave = expulsado ? 'rgba(255,92,92,0.14)' : 'rgba(255,210,63,0.14)'

  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, W, H)

  const centerX = W / 2

  // ── Pastilla superior ──
  chip(
    ctx,
    expulsado ? '👊 EXPULSADO' : '⚠️ ADVERTENCIA',
    centerX, 60,
    colorAcentoSuave, colorAcento
  )

  // ── Foto de perfil con grietas según el nivel de warns ──
  const circR = 130
  const circY = 260
  const imgUser = await cargarImagenSegura(userPicUrl)

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
  // Oscurece un poco si está cerca del límite/expulsado
  if (nivel > 0) {
    ctx.fillStyle = `rgba(0,0,0,${nivel * 0.35})`
    ctx.fillRect(centerX - circR, circY - circR, circR * 2, circR * 2)
  }
  ctx.restore()

  dibujarGrietas(ctx, centerX, circY, circR, nivel, numero.length * 17 + count * 31)

  // Borde del círculo
  ctx.beginPath()
  ctx.arc(centerX, circY, circR, 0, Math.PI * 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = colorAcento
  ctx.stroke()

  // ── Nombre / número ──
  ctx.textAlign = 'center'
  ctx.fillStyle = texto
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(numero, centerX, circY + circR + 66)

  ctx.fillStyle = gris
  ctx.font = '22px sans-serif'
  ctx.fillText(
    expulsado ? 'Expulsado del grupo' : `${count} de ${max} advertencias`,
    centerX, circY + circR + 100
  )

  // ── Fila de "puños" (pips de advertencia) ──
  dibujarPuños(ctx, centerX, circY + circR + 150, count, max, colorAcento, 'rgba(255,255,255,0.2)')

  // ── Tarjeta inferior ──
  const cardY = circY + circR + 195
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
  y += 46

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(cardX + 30, y)
  ctx.lineTo(cardX + cardW - 30, y)
  ctx.stroke()
  y += 40

  // Últimas razones
  ctx.font = 'bold 18px sans-serif'
  ctx.fillStyle = colorAcento
  ctx.fillText('MOTIVOS RECIENTES', centerX, y)
  y += 34

  ctx.font = '18px sans-serif'
  const ultimasRazones = razones.slice(-3).reverse()
  if (ultimasRazones.length === 0) {
    ctx.fillStyle = gris
    ctx.fillText('Sin motivos registrados', centerX, y)
    y += 28
  } else {
    ultimasRazones.forEach((r, i) => {
      ctx.fillStyle = texto
      ctx.fillText(recortarTexto(ctx, `${i + 1}. ${r}`, cardW - 80), centerX, y)
      y += 28
    })
  }

  y += 16
  ctx.font = 'italic 18px sans-serif'
  ctx.fillStyle = gris
  const frase = expulsado
    ? '"Un golpe fue suficiente para acabar con esto."'
    : count === max - 1
      ? '"Un golpe más... y todo habrá terminado."'
      : '"Cada golpe deja una marca. Ten cuidado."'
  ctx.fillText(frase, centerX, y)

  return canvas.toBuffer('image/png')
}

// ═══════════════════════════════════════════
//  COMANDOS
// ═══════════════════════════════════════════
function extraerObjetivo(m) {
  return (m.mentionedJid && m.mentionedJid[0]) || (m.quoted && m.quoted.sender) || null
}

function extraerRazon(text, tieneMencion) {
  // Si el comando fue ".warn @user razon", quita la mención del texto
  let limpio = text || ''
  if (tieneMencion) limpio = limpio.replace(/@\d+/, '').trim()
  return limpio || null
}

let handler = async (m, { conn, text }) => {
  const botNumber = conn.user?.jid || conn.user.id
  const comando = m.body?.split(' ')[0]?.slice(1)?.toLowerCase()

  if (!m.isGroup) {
    return m.reply('Este comando solo funciona dentro de un grupo.')
  }

  const objetivo = extraerObjetivo(m)

  // ── .warns [@user] — consultar advertencias ──
  if (comando === 'warns') {
    const destino = objetivo || m.sender
    const registro = obtenerRegistro(botNumber, m.chat, destino)
    const groupMetadata = await conn.groupMetadata(m.chat)

    let userPicUrl
    try {
      userPicUrl = await conn.profilePictureUrl(destino, 'image')
    } catch {
      userPicUrl = null
    }

    const imagenBuffer = await generarImagenWarns({
      estado: 'normal',
      numero: '+' + destino.split('@')[0],
      userPicUrl,
      groupName: groupMetadata.subject,
      count: registro.count,
      max: MAX_WARNS,
      razones: registro.razones
    })

    return conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: `👊 Advertencias de @${destino.split('@')[0]}`,
      mentions: [destino]
    }, { quoted: m })
  }

  // ── A partir de aquí, solo admins/owner ──
  const puedeModerar = isOwner(m) || await isAdmin(conn, m.chat, m.sender)
  if (!puedeModerar) {
    return m.reply('╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 Solo administradores pueden usar esto.\n╰───────────────⬣')
  }

  if (!objetivo) {
    return m.reply('Menciona o responde al mensaje del usuario que quieres advertir.\nEj: `.warn @usuario Spam en el grupo`')
  }

  // ── .warn @user [razón] ──
  if (comando === 'warn') {
    const razon = extraerRazon(text, !!(m.mentionedJid && m.mentionedJid[0]))
    const registro = agregarWarn(botNumber, m.chat, objetivo, razon)
    const groupMetadata = await conn.groupMetadata(m.chat)

    let userPicUrl
    try {
      userPicUrl = await conn.profilePictureUrl(objetivo, 'image')
    } catch {
      userPicUrl = null
    }

    const alcanzoLimite = registro.count >= MAX_WARNS
    let expulsadoOk = false

    if (alcanzoLimite) {
      try {
        await conn.groupParticipantsUpdate(m.chat, [objetivo], 'remove')
        expulsadoOk = true
      } catch (e) {
        console.log('[warns] no se pudo expulsar (¿el bot es admin?):', e?.message)
      }
      resetWarn(botNumber, m.chat, objetivo)
    }

    const imagenBuffer = await generarImagenWarns({
      estado: expulsadoOk ? 'expulsado' : 'normal',
      numero: '+' + objetivo.split('@')[0],
      userPicUrl,
      groupName: groupMetadata.subject,
      count: expulsadoOk ? MAX_WARNS : registro.count,
      max: MAX_WARNS,
      razones: registro.razones
    })

    return conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: expulsadoOk
        ? `👊 @${objetivo.split('@')[0]} alcanzó el límite de advertencias y fue expulsado.`
        : `⚠️ @${objetivo.split('@')[0]} recibió una advertencia (${registro.count}/${MAX_WARNS}).`,
      mentions: [objetivo]
    }, { quoted: m })
  }

  // ── .unwarn @user ──
  if (comando === 'unwarn') {
    const registro = quitarWarn(botNumber, m.chat, objetivo)
    return m.reply(`🩹 Se quitó una advertencia a @${objetivo.split('@')[0]} (ahora tiene ${registro.count}/${MAX_WARNS}).`, null, { mentions: [objetivo] })
  }

  // ── .resetwarns @user ──
  if (comando === 'resetwarns') {
    resetWarn(botNumber, m.chat, objetivo)
    return m.reply(`✅ Advertencias de @${objetivo.split('@')[0]} reiniciadas a 0.`, null, { mentions: [objetivo] })
  }
}

handler.help = ['warn', 'warns', 'unwarn', 'resetwarns']
handler.tags = ['group']
handler.command = /^(warn|warns|unwarn|resetwarns)$/i

export default handler
