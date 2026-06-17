/**
 * ╭━━⬣ SAITAMA-BOT ⚡ ━━━━━━━━━━━━━━━━━⬣
 * │  Plugin: Rule34
 * │  Comandos:
 * │   .rule34 on       → activa en el grupo actual
 * │   .rule34 off      → desactiva en el grupo actual
 * │   .rule34          → imagen aleatoria (si está activo)
 * │   .rule34 add <url>→ agrega una imagen a la lista (solo owner)
 * │   .rule34 list     → ver cuántas imágenes hay
 * ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ─── Rutas ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const IMAGES_PATH = join(__dirname, 'rule34_images.json')
const STATE_PATH  = join(__dirname, 'rule34_state.json')

// ─── Helpers de persistencia ──────────────────────────────────────────────────

/** Lee la lista de imágenes desde disco */
function loadImages() {
  if (!existsSync(IMAGES_PATH)) {
    // Si no existe el archivo, cargamos las imágenes del plugin original
    const defaultImages = [
      "https://img2.rule34.us/thumbnails/3e/01/thumbnail_3e01548ad9e74921325e90bfaad8d6cd.jpg",
      "https://img2.rule34.us/thumbnails/80/14/thumbnail_80146a6325a1602f3e9e1a24c5a322d4.jpg",
      "https://img2.rule34.us/thumbnails/29/49/thumbnail_2949fbeb431437d9d210dfb13fc2624e.jpg",
      "https://img2.rule34.us/thumbnails/e5/f1/thumbnail_e5f1dc47aed2ab8a2455596e115d5b18.jpg",
      "https://img2.rule34.us/thumbnails/2d/f4/thumbnail_2df44cc78eb33cb700a8b70de30b8422.jpg",
      "https://img2.rule34.us/thumbnails/67/02/thumbnail_67028ef6ee302f751d7ecf0a7f0f46d5.jpg",
      "https://img2.rule34.us/thumbnails/a9/96/thumbnail_a99660e2f8867a681143768739a968ad.jpg",
      "https://img2.rule34.us/thumbnails/c3/6f/thumbnail_c36f839642b2c00ec9ba0a1604b338e2.jpg",
      "https://img2.rule34.us/thumbnails/6c/d1/thumbnail_6cd15b32c2e385090639e6e792bbe671.jpg",
      "https://img2.rule34.us/thumbnails/d5/ad/thumbnail_d5ad60f4fefa2950c915c01fa631c2b8.jpg",
      "https://img2.rule34.us/thumbnails/07/05/thumbnail_0705f2364081caf1a3ff77f9a9f2025c.jpg",
      "https://img2.rule34.us/thumbnails/e2/a1/thumbnail_e2a1476de5b53b6f9b9b4c213e56a419.jpg",
      "https://img2.rule34.us/thumbnails/ee/bc/thumbnail_eebc49270a5fac36f8572c7fbadc9ac8.jpg",
      "https://img2.rule34.us/thumbnails/8d/ec/thumbnail_8decad08e7231f450279e1f8bec3a504.jpg",
      "https://img2.rule34.us/thumbnails/0d/7c/thumbnail_0d7ccc334bd98267048621a0bd1af0ce.jpg",
      "https://img2.rule34.us/thumbnails/8b/91/thumbnail_8b91d63833184f3bb3c46056036e55ac.jpg",
      "https://img2.rule34.us/thumbnails/ab/4a/thumbnail_ab4ae0e5b1d8b4df92466a09f66e788d.jpg",
      "https://img2.rule34.us/thumbnails/f7/ff/thumbnail_f7ffaa835af290232cc9244091b6a5f2.jpg",
      "https://img2.rule34.us/thumbnails/95/51/thumbnail_9551194bc3ce073d51b33d253edecd64.jpg",
      "https://img2.rule34.us/thumbnails/bd/38/thumbnail_bd38c56e352157a2e104e2317b2f0488.jpg",
      "https://img2.rule34.us/thumbnails/6c/a7/thumbnail_6ca762717ee60b93183af57000ed9f87.jpg"
    ]
    saveImages(defaultImages)
    return defaultImages
  }
  try {
    return JSON.parse(readFileSync(IMAGES_PATH, 'utf8'))
  } catch {
    return []
  }
}

/** Guarda la lista de imágenes en disco */
function saveImages(images) {
  writeFileSync(IMAGES_PATH, JSON.stringify(images, null, 2), 'utf8')
}

/** Lee el estado (grupos activos) desde disco */
function loadState() {
  if (!existsSync(STATE_PATH)) return {}
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

/** Guarda el estado (grupos activos) en disco */
function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}

/** Retorna una imagen aleatoria de la lista */
function randomImage(images) {
  return images[Math.floor(Math.random() * images.length)]
}

/** Valida si una URL es una imagen válida */
function isValidImageUrl(url) {
  return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)
}

// ─── Handler principal ────────────────────────────────────────────────────────

let handler = async (m, { conn, args, isOwner, isAdmin }) => {
  const chat  = m.chat          // JID del grupo o privado
  const sub   = (args[0] || '').toLowerCase()

  const images = loadImages()
  const state  = loadState()

  // ── .rule34 on ──────────────────────────────────────────────────────────────
  if (sub === 'on') {
    if (!isOwner && !isAdmin) {
      return conn.sendMessage(chat, {
        text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ Solo admins o el owner\n│ pueden activar esto.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    state[chat] = true
    saveState(state)

    return conn.sendMessage(chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        '│ ✅ *Rule34 ACTIVADO* en este grupo.\n' +
        '│\n' +
        '│ Usa *.rule34* para ver una imagen.\n' +
        '│ Usa *.rule34 off* para desactivar.\n' +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  // ── .rule34 off ─────────────────────────────────────────────────────────────
  if (sub === 'off') {
    if (!isOwner && !isAdmin) {
      return conn.sendMessage(chat, {
        text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ Solo admins o el owner\n│ pueden desactivar esto.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    state[chat] = false
    saveState(state)

    return conn.sendMessage(chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        '│ 🔴 *Rule34 DESACTIVADO* en este grupo.\n' +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  // ── .rule34 add <url> ────────────────────────────────────────────────────────
  if (sub === 'add') {
    if (!isOwner) {
      return conn.sendMessage(chat, {
        text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ Solo el *owner* puede\n│ agregar imágenes.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    const url = args[1]

    if (!url || !isValidImageUrl(url)) {
      return conn.sendMessage(chat, {
        text:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          '│ ⚠️ URL inválida o faltante.\n' +
          '│\n' +
          '│ *Uso correcto:*\n' +
          '│ .rule34 add https://imagen.jpg\n' +
          '│\n' +
          '│ _Solo se aceptan .jpg .jpeg\n' +
          '│  .png .gif .webp_\n' +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    if (images.includes(url)) {
      return conn.sendMessage(chat, {
        text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ⚠️ Esa imagen ya está\n│ en la lista.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    images.push(url)
    saveImages(images)

    return conn.sendMessage(chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        `│ ✅ Imagen agregada correctamente.\n` +
        `│ 📦 Total: *${images.length}* imágenes\n` +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  // ── .rule34 list ─────────────────────────────────────────────────────────────
  if (sub === 'list') {
    return conn.sendMessage(chat, {
      text:
        '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
        '│\n' +
        `│ 📦 Imágenes en lista: *${images.length}*\n` +
        `│ 🔴/✅ Estado aquí: *${state[chat] ? 'ACTIVO' : 'INACTIVO'}*\n` +
        '│\n' +
        '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
    }, { quoted: m })
  }

  // ── .rule34 (imagen aleatoria) ───────────────────────────────────────────────
  if (sub === '') {
    // Verificar si está activado en este grupo
    if (!state[chat]) {
      return conn.sendMessage(chat, {
        text:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          '│ 🔴 Rule34 está *desactivado*\n' +
          '│ en este grupo.\n' +
          '│\n' +
          '│ Un admin puede activarlo con:\n' +
          '│ *.rule34 on*\n' +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    if (images.length === 0) {
      return conn.sendMessage(chat, {
        text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ⚠️ No hay imágenes en la lista.\n│ Agrega con *.rule34 add <url>*\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    await m.react('⏳')

    try {
      const imgUrl = randomImage(images)

      await conn.sendMessage(chat, {
        image: { url: imgUrl },
        caption:
          '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
          '│\n' +
          '│ 🔞 *Rule34*\n' +
          `│ 📦 Pool: ${images.length} imágenes\n` +
          '│\n' +
          '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })

      await m.react('✅')

    } catch (e) {
      console.error('[rule34]', e)
      await m.react('❌')
      await conn.sendMessage(chat, {
        text: '╭━━⬣ *SAITAMA-BOT* ⚡\n│\n│ ❌ Error al cargar la imagen.\n│ Intenta de nuevo.\n│\n╰━━━━━━━━━━━━━━━━━━━━━━⬣'
      }, { quoted: m })
    }

    return
  }

  // ── Subcomando desconocido ───────────────────────────────────────────────────
  return conn.sendMessage(chat, {
    text:
      '╭━━⬣ *SAITAMA-BOT* ⚡\n' +
      '│\n' +
      '│ 📋 *Comandos Rule34:*\n' +
      '│\n' +
      '│ *.rule34*           → imagen aleatoria\n' +
      '│ *.rule34 on*        → activar en grupo\n' +
      '│ *.rule34 off*       → desactivar en grupo\n' +
      '│ *.rule34 add <url>* → agregar imagen\n' +
      '│ *.rule34 list*      → ver total\n' +
      '│\n' +
      '│ ⚠️ _on/off requiere ser admin_\n' +
      '│ ⚠️ _add requiere ser owner_\n' +
      '│\n' +
      '╰━━━━━━━━━━━━━━━━━━━━━━⬣'
  }, { quoted: m })
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
handler.help    = ['rule34', 'rule34 on', 'rule34 off', 'rule34 add <url>']
handler.tags    = ['nsfw']
handler.command = /^(rule34)$/i
handler.desc    = 'Imágenes Rule34 por grupo — SAITAMA-BOT'

export default handler
