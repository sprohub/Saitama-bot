/**
 * plugins/owner/owner-listalicencias.js
 * Comando: .listalicencias
 *
 * SOLO PARA OWNERS. Muestra todos los grupos que tienen (o tuvieron)
 * una licencia canjeada: número del comprador, grupo, estado y
 * fecha de vencimiento.
 */

import { listarLicencias } from '../../lib/licencias.js'

function decorar(texto) {
  return `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 ${texto.split('\n').join('\n│ 🍃 ')}\n╰───────────────⬣`
}

function esOwner(m) {
  const numero = m.sender?.split('@')[0]
  return m.fromMe || (global.owner || []).some(([num]) => num.replace(/[^0-9]/g, '') === numero)
}

const handler = async function (m, { conn }) {
  if (!esOwner(m)) {
    return conn.sendMessage(m.chat, {
      text: decorar('Solo el owner puede usar este comando.')
    }, { quoted: m })
  }

  const licencias = listarLicencias()

  if (!licencias.length) {
    return conn.sendMessage(m.chat, {
      text: decorar('Todavía no hay ninguna licencia canjeada.')
    }, { quoted: m })
  }

  const lineas = await Promise.all(licencias.map(async (lic, i) => {
    let nombreGrupo = lic.groupId
    try {
      nombreGrupo = (await conn.groupMetadata(lic.groupId)).subject
    } catch {}

    const estado = lic.activo
      ? (lic.expiraEn && Date.now() > lic.expiraEn ? '🔴 Vencida' : '🟢 Activa')
      : '⚪ Revocada'

    const vence = lic.expiraEn ? new Date(lic.expiraEn).toLocaleDateString('es-CO') : 'Nunca (infinito)'

    return (
      `${i + 1}. ${estado}\n` +
      `   📱 +${lic.numero}\n` +
      `   🏠 ${nombreGrupo}\n` +
      `   🔑 ${lic.codigo}\n` +
      `   ⏱️ Vence: ${vence}`
    )
  }))

  await conn.sendMessage(m.chat, {
    text: decorar(`Licencias canjeadas (${licencias.length}):\n\n${lineas.join('\n\n')}`)
  }, { quoted: m })
}

handler.command = ['listalicencias', 'compradores']
handler.help = ['listalicencias (lista compradores, sus números y grupos)']
handler.tags = ['owner']
handler.owner = true
handler.rowner = true

export default handler