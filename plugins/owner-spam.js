let handler = async (m, { conn, args }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, {
      text: '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n🌸 Solo los creadores pueden usar esto'
    }, { quoted: m })
  }

  if (!args[0] || !args[1] || !args[2]) {
    return conn.sendMessage(m.chat, {
      text: '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA SPAM ㅤ֢ㅤׄㅤׅ\n\n📨 Envía mensajes a un número\n\n> #spam <número> <veces> <mensaje>\n> #spam 59177474230 5 Hola'
    }, { quoted: m })
  }

  let numero = args[0].replace(/\D/g, '')
  let veces = parseInt(args[1])
  if (isNaN(veces) || veces <= 0 || veces > 1000) {
    return conn.sendMessage(m.chat, {
      text: '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA BOT ㅤ֢ㅤׄㅤׅ\n\n🌸 Veces inválida (1-1000)'
    }, { quoted: m })
  }

  let mensaje = args.slice(2).join(' ')

  await conn.sendMessage(m.chat, { text: '⏳ Enviando ' + veces + ' mensajes a ' + numero + '...' }, { quoted: m })

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
    text: '𑁍ࠬܓ ⁾ ㅤׄㅤׅㅤׄ HINATA SPAM ㅤ֢ㅤׄㅤׅ\n\n✅ Envío completado\n\n📱 Número: ' + numero + '\n📨 Enviados: ' + enviados + '\n❌ Fallidos: ' + fallidos + '\n\n> Solicitado por @' + who.split('@')[0],
    mentions: [who]
  }, { quoted: m })
}

handler.help = ['spam']
handler.tags = ['owner']
handler.command = /^(spam|enviar)$/i
handler.desc = 'Envía spam a un número'
handler.owner = true

export default handler