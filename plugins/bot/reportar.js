/**
 * plugins/tools/reportar.js
 * Comando: .reportar / .report
 *
 * Cualquier usuario puede reportar un problema, bug, o a otro
 * usuario. El reporte llega directo al privado del número configurado.
 *
 * Uso:
 * .reportar <descripción del problema>
 * .reportar (citando un mensaje) <descripción>  → incluye ese mensaje en el reporte
 */

const NUMERO_REPORTES = '573225396540@s.whatsapp.net'
const COOLDOWN_MS = 60 * 1000 // 1 minuto entre reportes por usuario, para evitar spam

global.__reportarCooldown = global.__reportarCooldown || {}

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

const handler = async (m, { conn, text, command }) => {
  const descripcion = (text || '').trim()

  if (!descripcion) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Uso:\n.${command} <descripción del problema>\n\nEjemplo:\n.${command} El comando .play no está funcionando\n\nTambién puedes citar un mensaje junto con tu reporte para incluirlo.`)
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
    await conn.sendMessage(NUMERO_REPORTES, { text: decorar(textoReporte) })

    // Si citó un mensaje, se lo reenvía aparte para dar contexto completo
    if (m.quoted) {
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
handler.help = ['reportar <descripción> (envía un reporte al owner)']
handler.tags = ['tools']

export default handler
