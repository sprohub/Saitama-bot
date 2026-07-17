/**
 * plugins/group/group-canjear.js
 * Comando: .canjear <codigo>
 *
 * Cualquiera puede correr este comando (no requiere ser admin), pero
 * SOLO funciona si el código fue generado para el número de quien lo
 * está usando. Al canjearlo con éxito, el grupo actual queda
 * autorizado según la duración elegida al generar el código.
 */

import { canjearCodigo, infoLicenciaGrupo } from '../../lib/licencias.js'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

const handler = async function (m, { conn, text, command }) {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, {
      text: decorar('Este comando solo funciona dentro de un grupo.')
    }, { quoted: m })
  }

  const codigo = (text || '').trim().toUpperCase()
  if (!codigo) {
    return conn.sendMessage(m.chat, {
      text: decorar(`Uso:\n.${command} <codigo>\n\nEjemplo:\n.${command} AB3D9F2K`)
    }, { quoted: m })
  }

  const numeroQueCanjea = m.sender.split('@')[0]
  const resultado = canjearCodigo(codigo, numeroQueCanjea, m.chat)

  if (!resultado.ok) {
    return conn.sendMessage(m.chat, {
      text: decorar(`❌ ${resultado.motivo}`)
    }, { quoted: m })
  }

  const info = infoLicenciaGrupo(m.chat)
  await conn.sendMessage(m.chat, {
    text: decorar(
      `✅ ¡Grupo autorizado!\n\n` +
      `🔑 Código: ${codigo}\n` +
      `⏱️ Vence: ${info.expiraTexto}\n\n` +
      `Ya puedes usar todos los comandos del bot aquí.`
    )
  }, { quoted: m })
}

handler.command = ['canjear', 'activarlicencia']
handler.help = ['canjear <codigo> (activa la licencia del grupo)']
handler.tags = ['group']
handler.register = false

export default handler
