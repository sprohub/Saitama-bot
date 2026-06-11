import fetch from 'node-fetch'

const DELIRIUS_API = 'https://api.delirius.store'
const OWNER = '573225396540'

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
      text: `🔞 「 NST 」\n\n⛔ *Este comando es solo para admins*\n\n> Contacta al dueño del bot para más información.`
    }, { quoted: m })
  }

  // Verificar usuario en la base de datos
  let user = global.db.data.users[m.sender]
  if (!user) {
    global.db.data.users[m.sender] = { diamantes: 0, diamond: 0 }
    user = global.db.data.users[m.sender]
  }

  function getDiamantes(u) { return u?.diamantes ?? u?.diamond ?? 0 }
  function restarDiamante(u) {
    if (u.diamantes !== undefined) u.diamantes = (u.diamantes || 0) - 1
    else u.diamond = (u.diamond || 0) - 1
  }
  function devolverDiamante(u, anterior) {
    if (u.diamantes !== undefined) u.diamantes = anterior
    else u.diamond = anterior
  }

  const diamantes = getDiamantes(user)

  if (diamantes < 1) {
    return conn.sendMessage(m.chat, {
      text: `🔞 「 NST 」\n\n💫 » No tienes suficientes diamantes\n💎 Necesitas: 1 | Tienes: ${diamantes}\n\n> Usa #work para ganar`
    }, { quoted: m })
  }

  await m.react('⏳')
  restarDiamante(user)
  const restantes = getDiamantes(user)

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
      caption: `🔞 「 NST 」\n\n💎 » Diamantes restantes: ${restantes}`
    }, { quoted: m })

    await m.react('✅')
  } catch (e) {
    devolverDiamante(user, diamantes)
    await m.react('❌')
    const rawMsg = String(e?.message || '').toLowerCase()
    const humanMsg = rawMsg.includes('aborted') || rawMsg.includes('fetch')
      ? '😂 Despacio viejo, ¿eres Flash?\n⏳ Espera un momento e intenta de nuevo.\n💎 Diamante devuelto.'
      : rawMsg.includes('502') || rawMsg.includes('503') || rawMsg.includes('bad gateway')
      ? '⚠️ El servidor está saturado.\n🔁 Intenta más tarde.\n💎 Diamante devuelto.'
      : '❌ Algo salió mal, intenta de nuevo.\n💎 Diamante devuelto.'
    await conn.sendMessage(m.chat, { text: humanMsg }, { quoted: m })
  }
}

handler.help    = ['nst']
handler.tags    = ['nsfw']
handler.command = /^(nst)$/i
handler.desc    = 'Envía una imagen NSFW de chicas 💎1'

export default handler
