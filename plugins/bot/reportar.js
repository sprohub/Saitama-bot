/**
 * plugins/tools/reportar.js
 * Comando: .reportar / .report
 *
 * Cualquier usuario puede reportar un problema, bug, o a otro
 * usuario. El reporte llega directo al privado del número configurado.
 *
 * Uso:
 * .reportar <descripción del problema>
 * .reportar (citando un mensaje) <descripción>       → incluye ese mensaje en el reporte
 * .reportar <descripción> (mandado como caption de una imagen) → incluye la imagen
 * .reportar (citando una imagen) <descripción>       → incluye esa imagen
 */

const NUMERO_REPORTES = '573225396540@s.whatsapp.net'
const COOLDOWN_MS = 60 * 1000 // 1 minuto entre reportes por usuario, para evitar spam

global.__reportarCooldown = global.__reportarCooldown || {}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function esImagen(msg) {
  return msg?.mtype === 'imageMessage' || !!msg?.msg?.mimetype?.startsWith?.('image/')
}

const handler = async (m, { conn, text, command }) => {
  const descripcion = (text || '').trim()

  // La imagen puede venir en el propio mensaje (.reportar como caption)
  // o en el mensaje citado (citando una imagen ya existente)
  const origenImagen = esImagen(m) ? m : (m.quoted && esImagen(m.quoted) ? m.quoted : null)

  if (!descripcion) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Uso:\n.${command} <descripción del problema>\n\nEjemplo:\n.${command} El comando .play no está funcionando\n\nTambién puedes citar un mensaje o una imagen, o mandar la imagen con el comando como descripción, para incluirla en el reporte.`)
    }, { quoted: m })
  }

  const ahora = Date.now()
  const ultimoReporte = global.__reportarCooldown[m.sender] || 0
  if (ahora - ultimoReporte < COOLDOWN_MS) {
    const restante = Math.ceil((COOLDOWN_MS - (ahora - ultimoReporte)) / 1000)
    return conn.sendMessage(m.chat, {
      text: decorar(`Espera ${restante}s antes de mandar otro reporte.`)
    }, { quoted: m })
  }

  const numeroReportante = m.sender.split('@')[0]
  let nombreGrupo = null
  if (m.isGroup) {
    try {
      nombreGrupo = (await conn.groupMetadata(m.chat)).subject
    } catch {}
  }

  let textoReporte =
    `🚨 NUEVO REPORTE\n\n` +
    `👤 De: +${numeroReportante}\n` +
    (nombreGrupo ? `🏠 Grupo: ${nombreGrupo}\n` : `💬 Chat privado\n`) +
    `\n📝 Descripción:\n${descripcion}`

  try {
    if (origenImagen) {
      try {
        const buffer = await origenImagen.download()
        await conn.sendMessage(NUMERO_REPORTES, {
          image: buffer,
          caption: decorar(textoReporte)
        })
      } catch (e) {
        console.error('[reportar] ERROR descargando/enviando imagen, se manda solo el texto:', e)
        await conn.sendMessage(NUMERO_REPORTES, { text: decorar(textoReporte) })
      }
    } else {
      await conn.sendMessage(NUMERO_REPORTES, { text: decorar(textoReporte) })
    }

    // Si citó un mensaje que NO era la imagen ya adjunta, se reenvía aparte para dar contexto completo
    if (m.quoted && m.quoted !== origenImagen) {
      try {
        await conn.sendMessage(NUMERO_REPORTES, { forward: m.quoted })
      } catch (e) {
        console.error('[reportar] No se pudo reenviar el mensaje citado:', e)
      }
    }

    global.__reportarCooldown[m.sender] = ahora

    return conn.sendMessage(m.chat, {
      text: decorar('✅ Tu reporte fue enviado. Gracias por avisar.')
    }, { quoted: m })
  } catch (e) {
    console.error('[reportar] ERROR enviando reporte:', e)
    return conn.sendMessage(m.chat, {
      text: decorar('❌ No se pudo enviar el reporte. Intenta más tarde.')
    }, { quoted: m })
  }
}

handler.command = ['reportar', 'report']
handler.help = ['reportar <descripción> (envía un reporte al owner, con imagen opcional)']
handler.tags = ['tools']

export default handler
