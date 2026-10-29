let handler = async (m, { conn, args }) => {
  if (!m.isGroup) {
    return conn.sendMessage(m.chat, {
      text: '*SAITAMA BOT*\n\nEste comando solo funciona en grupos'
    }, { quoted: m })
  }

  let groupMetadata = await conn.groupMetadata(m.chat)
  let participants = groupMetadata.participants || []
  let user = participants.find(p => p.id === m.sender)
  let isAdmin = user?.admin === 'admin' || user?.admin === 'superadmin'

  if (!isAdmin) {
    return conn.sendMessage(m.chat, {
      text: '*SAITAMA BOT*\n\nSolo los administradores del grupo pueden usar esto'
    }, { quoted: m })
  }

  if (!args[0] || !args[1] || !args[2]) {
    return conn.sendMessage(m.chat, {
      text: '*SAITAMA SPAM*\n\nEnvía mensajes a un número\n\n> #spam <número> <veces> <mensaje>\n> #spam 59177474230 5 Hola'
    }, { quoted: m })
  }

  let numero = args[0].replace(/\D/g, '')
  let veces = parseInt(args[1])
  if (isNaN(veces) || veces <= 0 || veces > 1000) {
    return conn.sendMessage(m.chat, {
      text: '*SAITAMA BOT*\n\nCantidad inválida (1-1000)'
    }, { quoted: m })
  }

  let mensaje = args.slice(2).join(' ')

  await conn.sendMessage(m.chat, { text: 'Enviando ' + veces + ' mensajes a ' + numero + '...' }, { quoted: m })

  let jid = numero + '@s.whatsapp.net'
  let enviados = 0
  let fallidos = 0

  for (let i = 0; i < veces; i++) {
    try {
      await conn.sendMessage(jid, { text: mensaje })
      enviados++
    } catch {
      fallidos++
    }
  }

  await conn.sendMessage(m.chat, {
    text: '*SAITAMA SPAM*\n\nEnvío completado\n\nNúmero: ' + numero + '\nEnviados: ' + enviados + '\nFallidos: ' + fallidos + '\n\nSolicitado por @' + m.sender.split('@')[0],
    mentions: [m.sender]
  }, { quoted: m })
}

handler.help = ['spam']
handler.tags = ['group']
handler.command = /^(spam|enviar)$/i
handler.desc = 'Envía spam a un número (solo admins)'
handler.group = true
handler.admin = true

export default handler