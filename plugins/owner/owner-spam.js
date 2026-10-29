let handler = async (m, { conn, args }) => {
  if (!args[0] || !args[1] || !args[2]) {
    return conn.sendMessage(m.chat, {
      text: `╭───〔 *SAITAMA SPAM* 〕───╮
│
│  *Comando:*
│  #spam <número> <veces> <mensaje>
│
│  *Ejemplo:*
│  #spam 59177474230 5 Hola
│
│  *Detalles:*
│  • Número sin + ni espacios
│  • Veces: entre 1 y 1000
│  • Mensaje: lo que quieras enviar
│
│  *Disponible para todos*
╰────────────────────╯`
    }, { quoted: m })
  }

  let numero = args[0].replace(/\D/g, '')
  let veces = parseInt(args[1])

  if (isNaN(veces) || veces <= 0 || veces > 1000) {
    return conn.sendMessage(m.chat, {
      text: `╭───〔 *SAITAMA BOT* 〕───╮
│
│  Cantidad inválida
│  Solo se permiten de 1 a 1000
│
╰────────────────────╯`
    }, { quoted: m })
  }

  let mensaje = args.slice(2).join(' ')

  await conn.sendMessage(m.chat, {
    text: `╭───〔 *ENVIANDO...* 〕───╮
│
│  Destino: ${numero}
│  Mensajes: ${veces}
│
│  Espera un momento...
╰────────────────────╯`
  }, { quoted: m })

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
    text: `╭───〔 *SAITAMA SPAM* 〕───╮
│
│  *Envío completado*
│
│  Número: ${numero}
│  Enviados: ${enviados}
│  Fallidos: ${fallidos}
│
│  Solicitado por @${m.sender.split('@')[0]}
╰────────────────────╯`,
    mentions: [m.sender]
  }, { quoted: m })
}

handler.help = ['spam']
handler.tags = ['tools']
handler.command = /^(spam|enviar)$/i
handler.desc = 'Envía spam a un número (disponible para todos)'

export default handler