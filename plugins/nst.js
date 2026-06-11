import fetch from 'node-fetch'

const DELIRIUS_API = 'https://api.delirius.store'

let handler = async (m, { conn }) => {
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

    // La API devuelve imagen binaria directamente
    if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
      imageBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      // Intentar como JSON por si cambian la API
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
    await conn.sendMessage(m.chat, {
      text: `❌ ${e.message || 'Error al obtener la imagen.'}\n💎 Diamante devuelto.`
    }, { quoted: m })
  }
}

handler.help    = ['nst']
handler.tags    = ['nsfw']
handler.command = /^(nst)$/i
handler.desc    = 'Envía una imagen NSFW de chicas 💎1'

export default handler
