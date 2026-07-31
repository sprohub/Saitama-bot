import fs from 'fs'
import { crearSubbotCompleto, contarSubbotsDe, leerStatus } from '../../lib/subbots.js'

const LIMITE_POR_USUARIO = 3 // ajusta si quieres permitir más subbots por persona
const TIMEOUT_MS = 90_000    // debe calzar con el timeout que ya tiene subbot.js
const INTERVALO_POLL_MS = 1500

const rtxQR = `
*_Saitama-Bot_*

➮ *_VINCULACION POR QR_*
✰ Pasos para vincularte:
✰ 1. Abre WhatsApp en tu telefono
✰ 2. Pulsa Mas opciones → Dispositivos vinculados
✰ 3. Presiona Vincular un dispositivo
✰ 4. Escanea el codigo QR que se mostrara aqui
`.trim()

const rtxCode = `
*_Saitama-Bot_*

➮ *_VINCULACION POR CODIGO DE 8 DIGITOS_*
✰ Pasos para vincularte:
✰ 1. Abre WhatsApp en tu telefono
✰ 2. Pulsa Mas opciones → Dispositivos vinculados
✰ 3. Presiona Vincular un dispositivo
✰ 4. Selecciona Con numero e introduce el codigo mostrado
`.trim()

function normalizarNumero(numero) {
  return String(numero || '').replace(/\D/g, '')
}

// 🔁 Espera a que subbot.js escriba el status.json con el QR o el código,
// o hasta que conecte / falle / se agote el tiempo.
function esperarEstado(id, { onCodigo, onQR } = {}) {
  return new Promise((resolve) => {
    let avisado = false
    const inicio = Date.now()

    const intervalo = setInterval(() => {
      const status = leerStatus(id)

      if (status?.estado === 'esperando_codigo' && status.codigo && !avisado) {
        avisado = true
        onCodigo?.(status.codigo)
      }

      if (status?.estado === 'esperando_qr' && status.qrPath && !avisado) {
        avisado = true
        onQR?.(status.qrPath)
      }

      if (status?.estado === 'conectado') {
        clearInterval(intervalo)
        resolve({ ok: true, status })
        return
      }

      if (status?.estado === 'error' || status?.estado === 'expirado' || status?.estado === 'desconectado') {
        clearInterval(intervalo)
        resolve({ ok: false, status })
        return
      }

      if (Date.now() - inicio > TIMEOUT_MS) {
        clearInterval(intervalo)
        resolve({ ok: false, status: status || { estado: 'timeout' } })
      }
    }, INTERVALO_POLL_MS)
  })
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const quierePorCodigo = args[0] && /^(--code|code)$/i.test(args[0].trim())
  const numeroArg = args.find(a => /^\+?\d{6,15}$/.test(a.trim()))

  const yaTiene = contarSubbotsDe(m.sender)
  if (yaTiene >= LIMITE_POR_USUARIO) {
    return conn.sendMessage(m.chat, {
      text: `Ya tienes ${yaTiene} subbot(s) activos. Elimina alguno con ${usedPrefix}delsubbot <id> antes de crear otro.`
    }, { quoted: m })
  }

  // Si no piden código explícito y no dieron número -> modo QR
  const modoQR = !quierePorCodigo && !numeroArg
  const numeroParaProceso = modoQR ? 'qr' : normalizarNumero(numeroArg || m.sender.split('@')[0])

  await conn.sendMessage(m.chat, {
    text: `⏳ Creando subbot, esto puede tardar unos segundos...`
  }, { quoted: m })

  let creado
  try {
    creado = await crearSubbotCompleto(numeroParaProceso, m.sender)
  } catch (e) {
    return conn.sendMessage(m.chat, {
      text: `❌ No se pudo crear el subbot: ${e.message}`
    }, { quoted: m })
  }

  const { id } = creado

  let mensajeQR, mensajeCodigoTexto, mensajeCodigo

  const resultado = await esperarEstado(id, {
    onCodigo: async (codigo) => {
      mensajeCodigoTexto = await conn.sendMessage(m.chat, { text: rtxCode }, { quoted: m })
      mensajeCodigo = await conn.sendMessage(m.chat, { text: codigo }, { quoted: m })
      if (mensajeCodigoTexto?.key) setTimeout(() => conn.sendMessage(m.chat, { delete: mensajeCodigoTexto.key }), 30000)
      if (mensajeCodigo?.key) setTimeout(() => conn.sendMessage(m.chat, { delete: mensajeCodigo.key }), 30000)
    },
    onQR: async (qrPath) => {
      try {
        const buffer = fs.readFileSync(qrPath)
        mensajeQR = await conn.sendMessage(m.chat, { image: buffer, caption: rtxQR }, { quoted: m })
        if (mensajeQR?.key) setTimeout(() => conn.sendMessage(m.chat, { delete: mensajeQR.key }), 30000)
      } catch (e) {
        console.error(`[${command}] No se pudo leer el QR en ${qrPath}:`, e.message)
      }
    }
  })

  if (resultado.ok) {
    await conn.sendMessage(m.chat, {
      text: `✅ Subbot *${id}* conectado exitosamente.\nUsa ${usedPrefix}listsubbots para verlo, o ${usedPrefix}delsubbot ${id} para eliminarlo.`
    }, { quoted: m })
  } else {
    const motivo = resultado.status?.error || resultado.status?.estado || 'desconocido'
    await conn.sendMessage(m.chat, {
      text: `❌ El subbot *${id}* no pudo vincularse (motivo: ${motivo}). Puedes intentar de nuevo.`
    }, { quoted: m })
  }
}

handler.help = ['serbot', 'serbot <numero>', 'serbot --code']
handler.tags = ['serbot']
handler.command = /^(serbot)$/i

export default handler
