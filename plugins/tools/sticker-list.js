import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys'
import { listStickers, getSticker } from '../../lib/stickerpack.js'
import { addExif } from '../../lib/sticker.js'
import fs from 'fs'

const MAX_STICKERS = 100
const FILAS_POR_SECCION = 10 // límite de WhatsApp por sección en un single_select

function unwrapMessage(message) {
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']
  let msg = message
  let guard = 0
  while (msg && guard < 5) {
    const key = wrappers.find(w => msg[w])
    if (!key) break
    msg = msg[key].message
    guard++
  }
  return msg
}

function extractSelectedId(content) {
  const nativeFlow = content?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (nativeFlow?.paramsJson) {
    try {
      const data = JSON.parse(nativeFlow.paramsJson)
      const id = data.id || data.selectedId || data.selectedRowId
      if (id) return id
    } catch (e) {
      console.log('[stlist] error parseando paramsJson:', e)
    }
  }
  const listReply = content?.listResponseMessage?.singleSelectReply
  if (listReply?.selectedRowId) return listReply.selectedRowId
  const btnReply = content?.buttonsResponseMessage
  if (btnReply?.selectedButtonId) return btnReply.selectedButtonId
  return null
}

// Divide los stickers en varias secciones de máximo 10 filas cada una
function construirSecciones(stickers) {
  const limitados = stickers.slice(0, MAX_STICKERS)
  const secciones = []

  for (let i = 0; i < limitados.length; i += FILAS_POR_SECCION) {
    const chunk = limitados.slice(i, i + FILAS_POR_SECCION)
    const desde = i + 1
    const hasta = i + chunk.length

    secciones.push({
      title: `「 🌿 STICKERS ${desde}-${hasta} 」`,
      rows: chunk.map(s => ({
        title: `🌿 ${s.name}`,
        description: `🍃 Subido ${new Date(s.date).toLocaleDateString()}`,
        id: `sticker_send~${s.name}`
      }))
    })
  }

  return secciones
}

const handler = async (m, { conn }) => {
  const stickers = listStickers()

  if (!stickers.length) {
    return m.reply(
      `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
      `│ 🍃 Aún no hay stickers guardados.\n` +
      `│ Usa *.stsubir <nombre>* citando uno.\n` +
      `╰───────────────⬣`
    )
  }

  const bodyText =
    `╭─⪼ 🌿 *SAITAMA-BOT*\n` +
    `│ 📦 Stickers guardados: ${stickers.length}\n` +
    `│ 🍃 Toca el botón para ver el pack\n` +
    `╰───────────────⬣`

  const sections = construirSecciones(stickers)

  try {
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '🌴 SAITAMA-BOT 🌴', subtitle: `🌿 ${stickers.length} stickers`, hasMediaAttachment: false },
      body: { text: bodyText },
      footer: { text: '🍃 SAITAMA-BOT 🌿' },
      nativeFlowMessage: {
        buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '🌿 VER STICKERS', sections }) }]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
  } catch (e) {
    console.log('[stlist] error:', e)
    const listText = stickers.map(s => `╭─⪼ 🌿 *${s.name}*\n╰───────────────⬣`).join('\n\n')
    await conn.sendMessage(m.chat, { text: listText }, { quoted: m })
  }
}

// Al seleccionar un sticker del menú, se le renombra el pack a "saitama-pack" y se envía
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const content = unwrapMessage(m.message)
  if (!content) return false

  const id = extractSelectedId(content)
  if (!id || !id.startsWith('sticker_send~')) return false

  const name = id.replace('sticker_send~', '')
  const sticker = getSticker(name)

  if (!sticker || !fs.existsSync(sticker.file)) {
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ 🍃 El sticker *${name}* ya no existe.\n╰───────────────⬣`
    }, { quoted: m })
    return true
  }

  try {
    const rawBuffer = fs.readFileSync(sticker.file)
    const renamedBuffer = await addExif(rawBuffer, 'saitama-pack', 'SAITAMA-BOT', [''])

    await conn.sendMessage(m.chat, { sticker: renamedBuffer }, { quoted: m })
  } catch (e) {
    console.log('[stlist] error enviando sticker:', e)
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA-BOT*\n│ ❌ No se pudo enviar el sticker.\n╰───────────────⬣`
    }, { quoted: m })
  }

  return true
}

handler.command = ['stlist']
handler.customPrefix = /^[.\/#@]/i
handler.tags = ['tools']
handler.help = ['stlist']
handler.desc = 'Muestra el pack de stickers guardados'

export default handler
