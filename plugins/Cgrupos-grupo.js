// === COMANDO .cgrupos / /cgrupos / #cgrupos / @cgrupos ===
// Muestra todos los grupos donde está el bot, con su link de invitación
// en un botón. Solo lo pueden usar los dueños del bot (info sensible).

const OWNERS = ['573225396540', '573225814649']

function isOwner(m) {
  const number = m.sender?.split('@')[0]
  return m.fromMe || OWNERS.includes(number)
}

const handler = async (m, { conn }) => {
  if (!isOwner(m)) {
    return m.reply('❌ Solo el dueño del bot puede usar este comando.')
  }

  const groups = await conn.groupFetchAllParticipating()
  const groupList = Object.values(groups)

  if (groupList.length === 0) {
    return m.reply('El bot no está en ningún grupo todavía.')
  }

  await conn.sendMessage(m.chat, {
    text: `📋 *Grupos donde estoy* (${groupList.length})`
  }, { quoted: m })

  for (const group of groupList) {
    let link = null
    try {
      const code = await conn.groupInviteCode(group.id)
      link = `https://chat.whatsapp.com/${code}`
    } catch {
      // el bot no es admin en ese grupo, no puede sacar el link
    }

    const caption =
      `👥 *${group.subject}*\n` +
      `🆔 ${group.id}\n` +
      `👤 Miembros: ${group.participants.length}\n` +
      `🔗 ${link || 'No disponible (el bot no es admin ahí)'}`

    if (link) {
      try {
        // Botón nativo tipo "cta_url" (abre el link directo).
        // Este formato aplica en la mayoría de forks de Baileys que soportan
        // interactiveButtons. Si tu framework no lo soporta, ajusta el nombre
        // de la propiedad o revisa la documentación de tu conn.sendMessage.
        await conn.sendMessage(m.chat, {
          text: caption,
          footer: 'Toca el botón para abrir el grupo',
          interactiveButtons: [
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: '🔗 Abrir grupo',
                url: link,
                merchant_url: link
              })
            }
          ]
        }, { quoted: m })
        continue
      } catch {
        // Si el botón falla, cae al mensaje de texto normal de abajo
      }
    }

    await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
  }
}

handler.command = ['cgrupos']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['owner']
handler.help = ['cgrupos']

export default handler
