import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import speed from 'performance-now'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templatePath = path.join(__dirname, '..', 'lib', 'ping-template.jpg')

function formatearTiempo(segundos) {
  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor((segundos % 86400) / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const segs = Math.floor(segundos % 60)
  const partes = []
  if (dias) partes.push(`${dias}d`)
  if (horas) partes.push(`${horas}h`)
  if (minutos) partes.push(`${minutos}m`)
  partes.push(`${segs}s`)
  return partes.join(' ')
}

function formatearMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function generarImagenPing(datos) {
  const width = 900
  const height = 500
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Fondo: plantilla si existe, si no, degradado
  try {
    const bg = await loadImage(templatePath)
    ctx.drawImage(bg, 0, 0, width, height)
  } catch {
    const grad = ctx.createLinearGradient(0, 0, width, height)
    grad.addColorStop(0, '#0f2027')
    grad.addColorStop(1, '#2c5364')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }

  // Capa oscura para legibilidad
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 34px sans-serif'
  ctx.fillText('SAITAMA-BOT · PING', 40, 60)

  ctx.font = '24px sans-serif'
  const lineas = [
    `Latencia: ${datos.latenciaMs} ms`,
    `Uptime bot: ${datos.uptimeProceso}`,
    `Uptime sistema: ${datos.uptimeSistema}`,
    `RAM proceso: ${datos.usoRAM}`,
    `RAM libre: ${datos.ramLibre} / ${datos.ramTotal}`,
    `CPU (1m): ${datos.cargaCpu} · ${datos.nucleos} núcleos`,
    `Node.js: ${datos.nodeVersion}`,
    `Plataforma: ${datos.plataforma}`
  ]

  let y = 130
  for (const linea of lineas) {
    ctx.fillText(linea, 40, y)
    y += 45
  }

  return canvas.toBuffer('image/png')
}

let handler = async (m, { conn }) => {
  const inicio = speed()
  await conn.sendMessage(m.chat, { text: '⏳ Midiendo velocidad de respuesta...' }, { quoted: m })
  const fin = speed()
  const latenciaMs = (fin - inicio).toFixed(2)

  const memoria = process.memoryUsage()
  const datos = {
    latenciaMs,
    usoRAM: formatearMB(memoria.rss),
    ramLibre: formatearMB(os.freemem()),
    ramTotal: formatearMB(os.totalmem()),
    uptimeProceso: formatearTiempo(process.uptime()),
    uptimeSistema: formatearTiempo(os.uptime()),
    cargaCpu: os.loadavg()[0].toFixed(2),
    nucleos: os.cpus().length,
    nodeVersion: process.version,
    plataforma: `${os.platform()} (${os.arch()})`
  }

  try {
    const imagenBuffer = await generarImagenPing(datos)
    await conn.sendMessage(m.chat, {
      image: imagenBuffer,
      caption: '「 🌿 SAITAMA-BOT · PING 」\n⚡ Estadísticas generadas en tiempo real'
    }, { quoted: m })
  } catch (e) {
    console.error('[ping] Error generando imagen:', e)
    let texto = '「 🌿 SAITAMA-BOT · PING 」\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
    texto += `⚡ Latencia: ${datos.latenciaMs} ms\n`
    texto += `🕐 Uptime del bot: ${datos.uptimeProceso}\n`
    texto += `🖥️ Uptime del sistema: ${datos.uptimeSistema}\n\n`
    texto += `💾 RAM en uso (proceso): ${datos.usoRAM}\n`
    texto += `💽 RAM libre: ${datos.ramLibre} / ${datos.ramTotal}\n`
    texto += `⚙️ Carga CPU (1 min): ${datos.cargaCpu} · ${datos.nucleos} núcleos\n`
    texto += `🧩 Node.js: ${datos.nodeVersion}\n`
    texto += `🌐 Plataforma: ${datos.plataforma}\n\n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔`
    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['ping']
handler.tags = ['info']
handler.command = /^(ping|velocidad|speed)$/i
handler.desc = 'Muestra latencia y estadísticas del sistema en una imagen generada'

export default handler