import fetch from 'node-fetch'

const DELIRIUS_API = 'https://api.delirius.store'
const OWNER = '573225396540,573225814649'

let handler = async (m, { conn, text }) => {
  const sender = m.sender.replace(/[^0-9]/g, '').replace(/@.+/, '')
  const isOwner = sender === OWNER
  const arg = text?.trim().toLowerCase() || ''

  // .nst on / .nst off por grupo
  if (arg === 'on') {
    if (!isOwner) return conn.sendMessage(m.chat, { text: '❌ Solo el dueño puede activar este comando.' }, { quoted: m })
    global.db.data.chats = global.db.data.chats || {}
    global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
    global.db.data.chats[m.chat].nstEnabled = true
    return conn.sendMessage(m.chat, { text: '✅ Comando `.nst` *activado* en este grupo.\nLos usuarios ya pueden usarlo.' }, { quoted: m })
  }

  if (arg === 'off') {
    if (!isOwner) return conn.sendMessage(m.chat, { text: '❌ Solo el dueño puede desactivar este comando.' }, { quoted: m })
    global.db.data.chats = global.db.data.chats || {}
    global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
    global.db.data.chats[m.chat].nstEnabled = false
    return conn.sendMessage(m.chat, { text: '🔴 Comando `.nst` *desactivado* en este grupo.' }, { quoted: m })
  }

  // Verificar estado por grupo
  const nstEnabled = global.db.data.chats?.[m.chat]?.nstEnabled ?? false
  if (!nstEnabled) {
    return conn.sendMessage(m.chat, {
      text: `🔞 「 NST SAITAMA 」\n\n⛔ *ESTE COMANDO ESTA DESACTIVADO POR EL ADMIN*\n\n> Contacta al dueño del bot.`
    }, { quoted: m })
  }

  await m.react('⏳')

  try {
    const res = await fetch(`${DELIRIUS_API}/nsfw/girls`)
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') || ''
    let imageBuffer

    if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
      imageBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      const json = await res.json()
      if (!json.status || !json.image) throw new Error('No se pudo obtener la imagen.')
      const imgRes = await fetch(json.image)
      imageBuffer = Buffer.from(await imgRes.arrayBuffer())
    }

    if (!imageBuffer || imageBuffer.length < 1000) throw new Error('Imagen inválida o vacía.')

    await conn.sendMessage(m.chat, {
      image: imageBuffer,
      caption: `🔞 「 NST 」`
    }, { quoted: m })

    await m.react('✅')
  } catch (e) {
    await m.react('❌')
    const rawMsg = String(e?.message || '').toLowerCase()
    const humanMsg = rawMsg.includes('aborted') || rawMsg.includes('fetch')
      ? '😂 Despacio viejo, ¿eres Flash?\n⏳ Espera un momento e intenta de nuevo.'
      : rawMsg.includes('502') || rawMsg.includes('503') || rawMsg.includes('bad gateway')
      ? '⚠️ El servidor está saturado.\n🔁 Intenta más tarde.'
      : '❌ Algo salió mal, intenta de nuevo.'
    await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
  }
}

handler.help    = ['nst']
handler.tags    = ['nsfw']
handler.command = /^(nst)$/i
handler.desc    = 'Envía una imagen NSFW de chicas'

export default handler
