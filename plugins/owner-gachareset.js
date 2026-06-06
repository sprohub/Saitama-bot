let handler = async (m, { conn }) => {
  let who = m.sender
  let owners = ['59177474230@s.whatsapp.net', '573223090406@s.whatsapp.net']

  if (!owners.includes(who)) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA RESET GACHA 」 ˚ʚ♡ɞ˚\n\n💫 » Solo los creadores'
    }, { quoted: m })
  }

  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { inventory: [] }
    user = global.db.data.users[who]
  }

  if (!user.inventory || user.inventory.length === 0) {
    return conn.sendMessage(m.chat, {
      text: '𖣔 「 HINATA RESET GACHA 」 ˚ʚ♡ɞ˚\n\n💫 » No tienes personajes'
    }, { quoted: m })
  }

  let tenia = user.inventory.length
  user.inventory = []

  let texto = '𖣔 「 HINATA RESET GACHA 」 ˚ʚ♡ɞ˚\n\n'
  texto += '🗑️ » Colección vaciada\n\n'
  texto += '📦 » -' + tenia + ' personajes\n'
  texto += '🎒 » Total: 0 personajes\n\n'
  texto += '> Empieza de nuevo con #rw'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['resetgacha']
handler.tags = ['owner']
handler.command = /^(resetgacha|cleargacha)$/i
handler.desc = 'Vacía tu colección de gacha'
handler.owner = true

export default handler