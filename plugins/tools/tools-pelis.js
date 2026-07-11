import fetch from 'node-fetch'
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from '@whiskeysockets/baileys'

const DELIRIUS_API = 'https://api.delirius.store'

// ──────────────────────────────────────────────
//  PELÍCULAS EN TENDENCIA (estáticas por ahora,
//  puedes reemplazar por un endpoint /trending)
// ──────────────────────────────────────────────
const TRENDING_MOVIES = [
  { title: 'Inside Out 2',        year: 2024, image: 'https://image.tmdb.org/t/p/original/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg', vote: '7.6' },
  { title: 'Deadpool & Wolverine', year: 2024, image: 'https://image.tmdb.org/t/p/original/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg', vote: '7.8' },
  { title: 'Alien: Romulus',       year: 2024, image: 'https://image.tmdb.org/t/p/original/b33nnKl1GSFbao4l3fZDDqsMx0F.jpg', vote: '7.2' },
  { title: 'Twisters',             year: 2024, image: 'https://image.tmdb.org/t/p/original/pjnD08FlMAIXsfOLKQbvmO0f0MD.jpg', vote: '7.0' },
  { title: 'Longlegs',             year: 2024, image: 'https://image.tmdb.org/t/p/original/mGVrXeIjyYzVnFMCoWyCbcNqdT8.jpg', vote: '6.5' },
]

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────
function strellas(v) {
  const n = Math.round(parseFloat(v || 0) / 2)
  return '⭐'.repeat(Math.min(n, 5)) || '☆'
}

function formatMovie(movie, index) {
  return (
    `${index + 1}. 🎬 *${movie.title}* (${movie.original_language?.toUpperCase() || 'N/A'})\n` +
    `   📅 ${movie.release_date || 'Sin fecha'}\n` +
    `   ⭐ ${movie.vote_average?.toFixed(1) || '?'} / 10\n` +
    `   📝 ${(movie.overview || 'Sin descripción').slice(0, 80)}...`
  )
}

// ──────────────────────────────────────────────
//  MENÚ INTERACTIVO   →   .mpelis
// ──────────────────────────────────────────────
async function mostrarMenuPelis(conn, m, usedPrefix) {
  let media = null
  try {
    media = await prepareWAMessageMedia(
      { image: { url: 'https://image.tmdb.org/t/p/original/wwrvjmcgkDyB2RbCbIVLXZf82pl.jpg' } },
      { upload: conn.waUploadToServer }
    )
  } catch {}

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: {
      title: 'SAITAMA BOT - PELÍCULAS',
      subtitle: '🎬 Busca y descubre películas',
      hasMediaAttachment: !!media,
      imageMessage: media?.imageMessage
    },
    body: {
      text:
        `╭━━⬣ *🎬 SAITAMA MOVIES* ⬣━━╮\n\n` +
        `🍿 » *Bienvenido al módulo de películas*\n\n` +
        `╭─────────────────────╮\n` +
        `│ 🔍 *Buscar película*\n` +
        `│ » ${usedPrefix}pelis <nombre>\n` +
        `│\n` +
        `│ 📋 *Top 5 tendencias*\n` +
        `│ » ${usedPrefix}pelis list\n` +
        `│\n` +
        `│ 📖 *Este menú*\n` +
        `│ » ${usedPrefix}mpelis\n` +
        `╰─────────────────────╯\n\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    },
    footer: { text: '⫏ SAITAMA BOT ' },
    nativeFlowMessage: {
      buttons: [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '🎬 PELÍCULAS',
            sections: [
              {
                title: '¿Qué deseas hacer?',
                rows: [
                  {
                    header: '🔍 BUSCAR',
                    title: 'Buscar una película',
                    description: `Usa: ${usedPrefix}pelis <nombre>`,
                    id: 'pelis_info_buscar'
                  },
                  {
                    header: '📋 TENDENCIAS',
                    title: 'Ver Top 5 en tendencia',
                    description: `Usa: ${usedPrefix}pelis list`,
                    id: 'pelis_info_list'
                  }
                ]
              }
            ]
          })
        }
      ]
    }
  })

  const msg = generateWAMessageFromContent(
    m.chat,
    { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
    { quoted: m }
  )
  return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

// ──────────────────────────────────────────────
//  HANDLER PRINCIPAL
// ──────────────────────────────────────────────
let handler = async (m, { conn, text, usedPrefix, command }) => {
  const input = text?.trim()

  // ── .mpelis  (menú sin argumentos desde el alias)
  if (/^mpelis$/i.test(command)) {
    return mostrarMenuPelis(conn, m, usedPrefix)
  }

  // ── .pelis  (sin argumento → también menú)
  if (!input) {
    return mostrarMenuPelis(conn, m, usedPrefix)
  }

  // ── .pelis list  →  Top 5 tendencias con imágenes
  if (input.toLowerCase() === 'list') {
    await m.react('🍿')

    const header =
      `╭━━⬣ *🎬 TOP 5 TENDENCIAS* ⬣━━╮\n\n` +
      `🌟 » Las películas más populares ahora\n\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━⬣`

    await conn.sendMessage(m.chat, { text: header }, { quoted: m })

    for (let i = 0; i < TRENDING_MOVIES.length; i++) {
      const p = TRENDING_MOVIES[i]
      const caption =
        `╭━━⬣ *#${i + 1} TENDENCIA* ⬣━━╮\n\n` +
        `🎬 *${p.title}*\n` +
        `📅 ${p.year}\n` +
        `⭐ ${p.vote} / 10  ${strellas(p.vote)}\n\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━⬣`

      try {
        await conn.sendMessage(
          m.chat,
          { image: { url: p.image }, caption },
          { quoted: m }
        )
      } catch {
        await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
      }

      // pequeña pausa para no saturar
      await new Promise(r => setTimeout(r, 600))
    }

    await m.react('✅')
    return
  }

  // ── .pelis <query>  →  Buscar película
  await m.react('🔍')

  try {
    const res = await fetch(`${DELIRIUS_API}/search/movie?query=${encodeURIComponent(input)}`)
    const json = await res.json()

    if (!json.status || !json.data?.length) {
      await m.react('❌')
      return conn.sendMessage(
        m.chat,
        { text: `╭━━⬣ *SAITAMA MOVIES* ⬣━━╮\n\n❌ » No se encontraron resultados para:\n🔍 *${input}*\n\n> Intenta con otro nombre\n\n╰━━━━━━━━━━━━━━━━━━━━━━⬣` },
        { quoted: m }
      )
    }

    const resultados = json.data.slice(0, 10)

    // Miniatura de la primera película
    let media = null
    if (resultados[0]?.image) {
      try {
        media = await prepareWAMessageMedia(
          { image: { url: resultados[0].image } },
          { upload: conn.waUploadToServer }
        )
      } catch {}
    }

    // Filas para el selector interactivo
    const rows = resultados.map((p, i) => ({
      header: `${p.release_date?.slice(0, 4) || '????'} · ⭐${p.vote_average?.toFixed(1) || '?'}`,
      title: String(p.title || p.original_title || 'Sin título').slice(0, 35),
      description: String(p.overview || 'Sin descripción').slice(0, 60) + '...',
      id: `pelis_detail~${p.id}~${Buffer.from(p.title || '').toString('base64')}~${Buffer.from(p.image || '').toString('base64')}`
    }))

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: {
        title: 'SAITAMA BOT - PELÍCULAS',
        subtitle: `Resultados: ${input}`,
        hasMediaAttachment: !!media,
        imageMessage: media?.imageMessage
      },
      body: {
        text:
          `╭━━⬣ *🔍 RESULTADOS* ⬣━━╮\n\n` +
          `🎬\n\n` +
          `💫 » Búsqueda: *${input}*\n` +
          `📋 ${resultados.length} película(s) encontrada(s)\n\n` +
          `> Selecciona una para ver detalles\n\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━⬣`
      },
      footer: { text: '⫏⫏ SAITAMA BOT ' },
      nativeFlowMessage: {
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '🎬 RESULTADOS',
              sections: [
                {
                  title: `📋 ${input.toUpperCase().slice(0, 24)}`,
                  rows
                }
              ]
            })
          }
        ]
      }
    })

    const msg = generateWAMessageFromContent(
      m.chat,
      { viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } } },
      { quoted: m }
    )
    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    await m.react('✅')

  } catch (e) {
    await m.react('❌')
    conn.sendMessage(m.chat, { text: `❌ ${e.message}` }, { quoted: m })
  }
}

// ──────────────────────────────────────────────
//  HANDLER.BEFORE  →  Respuestas a botones
// ──────────────────────────────────────────────
handler.before = async (m, { conn }) => {
  if (m.isBaileys) return false

  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  let id
  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    id = data.id || data.selectedId || data.selectedRowId || null
  } catch { return false }

  if (!id) return false

  // Info de cómo buscar
  if (id === 'pelis_info_buscar') {
    await conn.sendMessage(m.chat, {
      text: '🔍 Escribe el nombre así:\n> .pelis Avengers\n> .pelis Interstellar'
    }, { quoted: m })
    return true
  }

  // Info de cómo ver lista
  if (id === 'pelis_info_list') {
    await conn.sendMessage(m.chat, {
      text: '📋 Escribe:\n> .pelis list\n\npara ver el Top 5 en tendencia 🍿'
    }, { quoted: m })
    return true
  }

  // Detalle de película seleccionada
  if (id.startsWith('pelis_detail~')) {
    const parts = id.split('~')
    if (parts.length < 4) return true

    const movieId  = parts[1]
    let title  = ''
    let imgUrl = ''
    try { title  = Buffer.from(parts[2], 'base64').toString() } catch {}
    try { imgUrl = Buffer.from(parts[3], 'base64').toString() } catch {}

    await m.react('🎬')

    // Volvemos a buscar el título para obtener todos los datos frescos
    try {
      const res = await fetch(`${DELIRIUS_API}/search/movie?query=${encodeURIComponent(title)}`)
      const json = await res.json()
      const movie = json.data?.find(p => String(p.id) === String(movieId)) || json.data?.[0]

      if (!movie) throw new Error('No se encontró la película')

      const estrellas = strellas(movie.vote_average)
      const caption =
        `╭━━⬣ *🎬 DETALLE* ⬣━━╮\n\n` +
        `🎥 *${movie.title}*\n` +
        (movie.original_title !== movie.title ? `🗣️ ${movie.original_title}\n` : '') +
        `\n` +
        `📅 *Fecha:* ${movie.release_date || 'N/A'}\n` +
        `🌍 *Idioma:* ${movie.original_language?.toUpperCase() || 'N/A'}\n` +
        `⭐ *Puntuación:* ${movie.vote_average?.toFixed(1) || '?'} / 10  ${estrellas}\n` +
        `🗳️ *Votos:* ${Number(movie.vote_count || 0).toLocaleString()}\n` +
        `\n` +
        `📝 *Sinopsis:*\n${movie.overview || 'Sin descripción disponible.'}\n` +
        `\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━⬣`

      const finalImg = movie.image || imgUrl
      if (finalImg) {
        try {
          await conn.sendMessage(m.chat, { image: { url: finalImg }, caption }, { quoted: m })
        } catch {
          await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
        }
      } else {
        await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
      }

    } catch (e) {
      await conn.sendMessage(m.chat, { text: `❌ Error al obtener detalles: ${e.message}` }, { quoted: m })
    }

    await m.react('✅')
    return true
  }

  return false
}

// ──────────────────────────────────────────────
//  METADATOS DEL PLUGIN
// ──────────────────────────────────────────────
handler.help    = ['pelis', 'mpelis']
handler.tags    = ['entretenimiento']
handler.command = /^(pelis|mpelis)$/i
handler.desc    = '🎬 Busca películas y ve tendencias'

export default handler
