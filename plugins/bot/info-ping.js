import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import speed from 'performance-now'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 👉 Imagen local del banner (colócala en lib/saitama-ping.jpg)
const bannerImagePath = path.join(__dirname, '..', '..', 'lib', 'saitama-ping.jpg')

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

let handler = async (m, { conn }) => {
  const inicio = speed()
  await conn.sendMessage(m.chat, { text: '⏳ Midiendo velocidad de respuesta...' }, { quoted: m })
  const fin = speed()

  const latenciaMs = (fin - inicio).toFixed(2)

  const memoria = process.memoryUsage()
  const usoRAM = formatearMB(memoria.rss)
  const ramLibre = formatearMB(os.freemem())
  const ramTotal = formatearMB(os.totalmem())
  const uptimeProceso = formatearTiempo(process.uptime())
  const uptimeSistema = formatearTiempo(os.uptime())
  const cargaCpu = os.loadavg()[0].toFixed(2) // promedio de carga últimos 1 min (Linux/Android)
  const nucleos = os.cpus().length

  let texto = '「 🌿 SAITAMA-BOT · PING 」\n'
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n\n'
  texto += `⚡ Latencia: ${latenciaMs} ms\n`
  texto += `🕐 Uptime del bot: ${uptimeProceso}\n`
  texto += `🖥️ Uptime del sistema: ${uptimeSistema}\n\n`
  texto += `💾 RAM en uso (proceso): ${usoRAM}\n`
  texto += `💽 RAM libre: ${ramLibre} / ${ramTotal}\n`
  texto += `⚙️ Carga CPU (1 min): ${cargaCpu} · ${nucleos} núcleos\n`
  texto += `🧩 Node.js: ${process.version}\n`
  texto += `🌐 Plataforma: ${os.platform()} (${os.arch()})\n\n`
  texto += '▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'

  let imagenBanner
  try {
    imagenBanner = fs.readFileSync(bannerImagePath)
  } catch (e) {
    console.error('[ping] No se encontró la imagen en', bannerImagePath, e)
  }

  if (imagenBanner) {
    await conn.sendMessage(m.chat, {
      image: imagenBanner,
      caption: texto
    }, { quoted: m })
  } else {
    // Si no se encuentra la imagen, se envía solo el texto para no romper el comando
    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
  }
}

handler.help = ['ping']
handler.tags = ['info']
handler.command = /^(ping|velocidad|speed)$/i
handler.desc = 'Muestra latencia y estadísticas del sistema'

export default handler
