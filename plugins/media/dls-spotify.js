import axios from 'axios'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import http from 'http'
import https from 'https'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'
import Jimp from 'jimp'

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const DL_API_URL = 'https://api.evogb.org/dl/spotify'
const SEARCH_API_URL = 'https://api.evogb.org/search/spotify'
const EVOGB_KEY = process.env.EVOGB_KEY || 'DravenMJ'

const API_TIMEOUT = 30_000
const REQUEST_TIMEOUT = 5 * 60 * 1000
const MAX_AUDIO_BYTES = 60 * 1024 * 1024 // 60MB
const MIN_AUDIO_BYTES = 10 * 1024

const DELETE_RETRIES = 4
const DELETE_RETRY_DELAY_MS = 120

const HTTP_AGENT = new http.Agent({ keepAlive: true, maxSockets: 40, maxFreeSockets: 20 })
const HTTPS_AGENT = new https.Agent({ keepAlive: true, maxSockets: 40, maxFreeSockets: 20 })

// ---------------------------------------------------------------------------
// DECORACIÓN (equivalente local a wrap/item, ya que tu bot no tiene _deco.js)
// ---------------------------------------------------------------------------
function wrap(titulo, items) {
  return `╭─⪼ 🌿 *SAITAMA-BOT · ${titulo}*\n${items.map(i => `│ 🍃 ${i}`).join('\n')}\n╰───────────────⬣`
}
function item(texto) { return texto }

// ---------------------------------------------------------------------------
// CACHE PERSISTENTE (data/spotify_cache/*.mp3 + data/spotify_cache.json)
// ---------------------------------------------------------------------------
const CACHE_DIR = path.join(process.cwd(), 'data', 'spotify_cache')
const CACHE_INDEX_FILE = path.join(process.cwd(), 'data', 'spotify_cache.json')
const CACHE_TTL_MS = Number(process.env.SPOTIFY_CACHE_TTL_HOURS || 720) * 60 * 60 * 1000
let cacheWriteQueue = Promise.resolve()

// ---------------------------------------------------------------------------
// CACHE DE BUSQUEDAS POR TEXTO (data/spotify_search_cache.json)
// Evita llamar a la API /search/spotify de nuevo si ya se busco ese mismo
// texto antes, saltando directo al cache de audio.
// ---------------------------------------------------------------------------
const SEARCH_CACHE_FILE = path.join(process.cwd(), 'data', 'spotify_search_cache.json')
const SEARCH_CACHE_TTL_MS = CACHE_TTL_MS
let searchCacheWriteQueue = Promise.resolve()

async function ensureCacheDir() {
  await fsp.mkdir(CACHE_DIR, { recursive: true })
}

async function ensureCacheIndexFile() {
  await fsp.mkdir(path.dirname(CACHE_INDEX_FILE), { recursive: true })
  try {
    await fsp.access(CACHE_INDEX_FILE)
  } catch {
    await fsp.writeFile(CACHE_INDEX_FILE, '{}', 'utf8')
  }
}

async function readCacheIndex() {
  await ensureCacheIndexFile()
  try {
    const raw = await fsp.readFile(CACHE_INDEX_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeCacheIndex(data) {
  cacheWriteQueue = cacheWriteQueue
    .then(async () => {
      await ensureCacheIndexFile()
      await fsp.writeFile(CACHE_INDEX_FILE, JSON.stringify(data, null, 2), 'utf8')
    })
    .catch((err) => {
      console.error('SPOTIFY CACHE INDEX WRITE ERROR:', err?.message || err)
    })
  return cacheWriteQueue
}

// ---------------------------------------------------------------------------
// helpers del cache de busquedas
// ---------------------------------------------------------------------------
function normalizeSearchQuery(query = '') {
  return String(query || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

async function ensureSearchCacheFile() {
  await fsp.mkdir(path.dirname(SEARCH_CACHE_FILE), { recursive: true })
  try {
    await fsp.access(SEARCH_CACHE_FILE)
  } catch {
    await fsp.writeFile(SEARCH_CACHE_FILE, '{}', 'utf8')
  }
}

async function readSearchCacheIndex() {
  await ensureSearchCacheFile()
  try {
    const raw = await fsp.readFile(SEARCH_CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeSearchCacheIndex(data) {
  searchCacheWriteQueue = searchCacheWriteQueue
    .then(async () => {
      await ensureSearchCacheFile()
      await fsp.writeFile(SEARCH_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8')
    })
    .catch((err) => {
      console.error('SPOTIFY SEARCH CACHE WRITE ERROR:', err?.message || err)
    })
  return searchCacheWriteQueue
}

async function getCachedSearchUrl(query) {
  const key = normalizeSearchQuery(query)
  if (!key) return ''
  const index = await readSearchCacheIndex()
  const entry = index[key]
  if (!entry) return ''
  if (!entry.expiresAt || Date.now() >= entry.expiresAt) {
    delete index[key]
    writeSearchCacheIndex(index).catch(() => {})
    return ''
  }
  return entry.url || ''
}

async function setCachedSearchUrl(query, url) {
  const key = normalizeSearchQuery(query)
  if (!key || !url) return
  const index = await readSearchCacheIndex()
  index[key] = { url, cachedAt: Date.now(), expiresAt: Date.now() + SEARCH_CACHE_TTL_MS }
  await writeSearchCacheIndex(index)
}

function extractTrackId(spotifyUrl = '') {
  const match = String(spotifyUrl || '').match(/\/(track|album|playlist)\/([A-Za-z0-9]+)/)
  return match ? `${match[1]}-${match[2]}` : ''
}

async function getCachedTrack(spotifyUrl) {
  const trackId = extractTrackId(spotifyUrl)
  if (!trackId) return null

  const index = await readCacheIndex()
  const entry = index[trackId]
  if (!entry) return null

  if (!entry.expiresAt || Date.now() >= entry.expiresAt) {
    delete index[trackId]
    writeCacheIndex(index).catch(() => {})
    return null
  }

  const exists = await fsp.access(entry.filePath).then(() => true).catch(() => false)
  if (!exists) {
    delete index[trackId]
    writeCacheIndex(index).catch(() => {})
    return null
  }

  return entry
}

async function setCachedTrack(spotifyUrl, entry) {
  const trackId = extractTrackId(spotifyUrl)
  if (!trackId || !entry?.filePath) return

  const index = await readCacheIndex()
  index[trackId] = {
    trackId,
    filePath: entry.filePath,
    fileName: entry.fileName,
    name: entry.name || '',
    artist: entry.artist || '',
    album: entry.album || '',
    duration: entry.duration || '',
    year: entry.year || '',
    image: entry.image || '',
    // guardamos el jpeg ya procesado en base64 para no volver a
    // descargar ni re-comprimir la portada en cada entrega desde cache.
    jpegThumbnailBase64: entry.jpegThumbnailBase64 || '',
    contentType: entry.contentType || 'audio/mpeg',
    size: Number(entry.size || 0),
    cachedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  await writeCacheIndex(index)
}

async function pruneExpiredCache() {
  try {
    await ensureCacheDir()
    const index = await readCacheIndex()
    const now = Date.now()
    let changed = false

    for (const key of Object.keys(index)) {
      const entry = index[key]
      if (!entry?.expiresAt || now >= entry.expiresAt) {
        if (entry?.filePath) await deleteFileSafe(entry.filePath)
        delete index[key]
        changed = true
      }
    }

    if (changed) await writeCacheIndex(index)
  } catch (err) {
    console.error('SPOTIFY CACHE PRUNE ERROR:', err?.message || err)
  }
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function humanBytes(bytes = 0) {
  const size = Number(bytes || 0)
  if (!Number.isFinite(size) || size <= 0) return 'N/D'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

function safeFileName(name) {
  return (
    String(name || 'spotify-audio')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/[^\w .()[\]-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'spotify-audio'
  )
}

function normalizeMp3Name(name) {
  const parsed = path.parse(String(name || '').trim())
  const base = safeFileName(parsed.name || name || 'spotify-audio')
  return `${base || 'spotify-audio'}.mp3`
}

function isSpotifyUrl(text = '') {
  return /open\.spotify\.com\/(track|album|playlist)\//i.test(String(text || ''))
}

function extractSpotifyUrl(text) {
  const match = String(text || '').match(/https?:\/\/(?:open\.)?spotify\.com\/[^\s]+/i)
  return match ? match[0].trim() : ''
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(1, Number(ms || 0))))
}

async function deleteFileSafe(filePath) {
  const target = String(filePath || '').trim()
  if (!target) return true

  for (let attempt = 0; attempt <= DELETE_RETRIES; attempt += 1) {
    try {
      await fsp.unlink(target)
      return true
    } catch (error) {
      const code = String(error?.code || '').toUpperCase()
      if (code === 'ENOENT') return true
      const retryable = code === 'EBUSY' || code === 'EPERM' || code === 'EACCES'
      if (retryable && attempt < DELETE_RETRIES) {
        await waitMs(DELETE_RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      return false
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// BUSQUEDA (api.evogb.org/search/spotify)
// ---------------------------------------------------------------------------
async function searchFirstTrackUrl(query) {
  const response = await axios.get(SEARCH_API_URL, {
    timeout: API_TIMEOUT,
    params: { query, key: EVOGB_KEY },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145 Safari/537.36',
      Accept: 'application/json',
    },
    httpAgent: HTTP_AGENT,
    httpsAgent: HTTPS_AGENT,
    validateStatus: () => true,
  })

  if (response.status >= 400 || !response.data?.status) {
    throw new Error(response.data?.error || response.data?.message || `HTTP ${response.status}`)
  }

  const list = Array.isArray(response.data?.result) ? response.data.result : []
  const first = list.find((track) => track?.link)
  if (!first) throw new Error('No encontre resultados en Spotify para esa busqueda.')

  return cleanText(first.link)
}

// resuelve la url de spotify usando primero el cache de busquedas;
// solo llama a la API si no hay nada guardado para ese texto.
async function resolveSpotifyUrl(input) {
  const directUrl = extractSpotifyUrl(input)
  if (directUrl && isSpotifyUrl(directUrl)) return directUrl

  const cachedUrl = await getCachedSearchUrl(input)
  if (cachedUrl) return cachedUrl

  const foundUrl = await searchFirstTrackUrl(input)
  setCachedSearchUrl(input, foundUrl).catch(() => {})
  return foundUrl
}

// ---------------------------------------------------------------------------
// LLAMADA A LA API EVOGB (metadata + link de descarga)
// ---------------------------------------------------------------------------
async function fetchSpotifyData(spotifyUrl) {
  const response = await axios.get(DL_API_URL, {
    timeout: API_TIMEOUT,
    params: { url: spotifyUrl, key: EVOGB_KEY },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145 Safari/537.36',
      Accept: 'application/json',
    },
    httpAgent: HTTP_AGENT,
    httpsAgent: HTTPS_AGENT,
    validateStatus: () => true,
  })

  if (response.status >= 400 || !response.data?.status || !response.data?.data) {
    const apiError = response.data?.error || response.data?.message || `HTTP ${response.status}`
    throw new Error(apiError)
  }

  const data = response.data.data
  if (!data.url) throw new Error('La API no devolvio un enlace de audio.')

  return {
    name: cleanText(data.name || 'Spotify'),
    artist: cleanText(data.artist || ''),
    album: cleanText(data.album || ''),
    duration: cleanText(data.duration || ''),
    year: data.year || '',
    image: cleanText(data.image || ''),
    imageHD: cleanText(data.imageHD || ''),
    remoteUrl: data.url,
  }
}

// ---------------------------------------------------------------------------
// DESCARGA DE AUDIO DIRECTO A LA CARPETA DE CACHE
// ---------------------------------------------------------------------------
async function downloadToCache(remoteUrl, trackId, fallbackName, maxAudioBytes = MAX_AUDIO_BYTES) {
  await ensureCacheDir()
  const outputPath = path.join(CACHE_DIR, `${trackId || randomUUID()}.mp3`)

  const response = await axios.get(remoteUrl, {
    responseType: 'stream',
    timeout: REQUEST_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145 Safari/537.36',
      Accept: '*/*',
    },
    httpAgent: HTTP_AGENT,
    httpsAgent: HTTPS_AGENT,
    maxRedirects: 5,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true,
  })

  if (response.status >= 400) {
    throw new Error(`El servidor de audio respondio con estado ${response.status}`)
  }

  const contentLength = Number(response.headers?.['content-length'] || 0)
  if (contentLength > maxAudioBytes) {
    throw new Error(`El audio pesa ${humanBytes(contentLength)} y supera el limite permitido (${humanBytes(maxAudioBytes)}).`)
  }

  let downloaded = 0
  response.data.on('data', (chunk) => {
    downloaded += chunk.length
    if (downloaded > maxAudioBytes) {
      response.data.destroy(new Error('El audio es demasiado grande para enviarlo por WhatsApp.'))
    }
  })

  try {
    await pipeline(response.data, fs.createWriteStream(outputPath))
  } catch (error) {
    await deleteFileSafe(outputPath)
    throw error
  }

  const stat = await fsp.stat(outputPath).catch(() => null)
  if (!stat?.size || stat.size < MIN_AUDIO_BYTES) {
    await deleteFileSafe(outputPath)
    throw new Error('El archivo de audio descargado es invalido.')
  }

  return {
    filePath: outputPath,
    fileName: normalizeMp3Name(fallbackName),
    size: stat.size,
    contentType: response.headers?.['content-type'] || 'audio/mpeg',
  }
}

async function getBuffer(url = '', timeout = 12_000) {
  const target = cleanText(url)
  if (!target || !/^https?:\/\//i.test(target)) return null
  try {
    const response = await axios.get(target, {
      responseType: 'arraybuffer', timeout, httpAgent: HTTP_AGENT, httpsAgent: HTTPS_AGENT, maxRedirects: 4, validateStatus: () => true,
    })
    if (Number(response.status || 0) >= 400) return null
    return Buffer.from(response.data)
  } catch {
    return null
  }
}

// 🔧 ADAPTADO: usaba sharp, que no corre en arm7/32-bit (tu Termux).
// Reemplazado por Jimp, que ya usas en otros plugins y sí funciona ahí.
async function buildJpegThumbnail(sourceBuffer) {
  if (!sourceBuffer?.length) return null
  try {
    const imagen = await Jimp.read(sourceBuffer)
    imagen.cover(320, 320).quality(75)
    return await imagen.getBufferAsync(Jimp.MIME_JPEG)
  } catch (error) {
    console.error('SPOTIFY THUMBNAIL ERROR:', error?.message || error)
    return null
  }
}

// ---------------------------------------------------------------------------
// UI / MENSAJES
// ---------------------------------------------------------------------------
function buildUsageMessage() {
  return wrap('SPOTIFY', [
    item('Uso: .spotify <cancion o enlace de spotify>'),
    item('Ejemplo busqueda: .spotify ghostemane squeeze'),
    item('Ejemplo enlace: .spotify https://open.spotify.com/track/...'),
    item('Como documento con portada: .spotify ghostemane squeeze'),
    item('Como audio reproducible: .spau ghostemane squeeze / .spvoz ghostemane squeeze'),
  ])
}

function buildErrorMessage(errorText) {
  const text = String(errorText || 'No se pudo preparar el audio.').replace(/\n/g, '\n\u{1D101} ')
  return wrap('SPOTIFY', [item(`❌ ${text}`)])
}

async function sendLocalAudio(conn, m, data) {
  const audioBuffer = await fsp.readFile(data.filePath)
  const contentType = 'audio/mpeg'

  // si ya viene un jpeg procesado (desde cache), lo usamos directo
  // en vez de descargar la portada y volver a comprimirla.
  const jpegThumbnail = data.jpegThumbnail || await buildJpegThumbnail(data.thumbBuffer)

  const title = data.artist ? `${data.name} - ${data.artist}` : data.name

  const caption = wrap('SPOTIFY', [
    item(`🎧 ${title}`),
    ...(data.album ? [item(`💿 Album: ${data.album}`)] : []),
    item(`${data.duration ? `⏱️ ${data.duration} • ` : ''}🎵 MP3${data.size ? ` • ${humanBytes(data.size)}` : ''}`),
    ...(data.year ? [item(`📅 Año: ${data.year}`)] : []),
  ])

  await conn.sendMessage(
    m.chat,
    {
      document: audioBuffer,
      mimetype: contentType,
      fileName: data.fileName,
      jpegThumbnail,
      caption,
    },
    { quoted: m }
  )

  return jpegThumbnail
}

// ---------------------------------------------------------------------------
// ENVIO COMO AUDIO REPRODUCIBLE (spau / spvoz)
// No lleva caption ni portada porque WhatsApp no lo soporta en type "audio".
// ---------------------------------------------------------------------------
async function sendLocalAudioAsVoice(conn, m, data) {
  const audioBuffer = await fsp.readFile(data.filePath)
  await conn.sendMessage(
    m.chat,
    {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      fileName: data.fileName,
      ptt: false,
    },
    { quoted: m }
  )
}

// ---------------------------------------------------------------------------
// COMANDO
// ---------------------------------------------------------------------------
const handler = async (m, { conn, text, command }) => {
  try {
    pruneExpiredCache().catch(() => {})

    const input = String(text || '').trim()
    if (!input) {
      await conn.sendMessage(m.chat, { text: buildUsageMessage() }, { quoted: m })
      return
    }

    // segun el alias usado, decidimos si se manda como documento o como audio.
    const sendAsVoice = command === 'spau' || command === 'spvoz'

    await m.react('⏳')

    // resolveSpotifyUrl usa el cache de busquedas antes de llamar
    // a la API, asi que un texto repetido no vuelve a golpear /search.
    const spotifyUrl = await resolveSpotifyUrl(input)

    const cached = await getCachedTrack(spotifyUrl)
    if (cached) {
      if (sendAsVoice) {
        await sendLocalAudioAsVoice(conn, m, {
          filePath: cached.filePath,
          fileName: cached.fileName,
        })
      } else {
        // si ya hay jpeg en cache, se usa directo (sin red, sin reprocesar).
        let jpegThumbnail = null
        if (cached.jpegThumbnailBase64) {
          jpegThumbnail = Buffer.from(cached.jpegThumbnailBase64, 'base64')
        }
        const thumbBuffer = jpegThumbnail ? null : await getBuffer(cached.image)
        const usedJpeg = await sendLocalAudio(conn, m, {
          filePath: cached.filePath,
          fileName: cached.fileName,
          contentType: cached.contentType,
          size: cached.size,
          name: cached.name,
          artist: cached.artist,
          album: cached.album,
          duration: cached.duration,
          year: cached.year,
          jpegThumbnail,
          thumbBuffer,
        })
        // Si el cache aun no tenia jpeg guardado, lo guardamos ahora para
        // que la proxima entrega desde cache sea instantanea.
        if (!cached.jpegThumbnailBase64 && usedJpeg) {
          setCachedTrack(spotifyUrl, {
            ...cached,
            jpegThumbnailBase64: usedJpeg.toString('base64'),
          }).catch(() => {})
        }
      }
      await m.react('✅')
      return
    }

    const trackId = extractTrackId(spotifyUrl)
    const trackData = await fetchSpotifyData(spotifyUrl)
    const preferredName = trackData.artist ? `${trackData.name} - ${trackData.artist}` : trackData.name

    const downloaded = await downloadToCache(trackData.remoteUrl, trackId, preferredName, MAX_AUDIO_BYTES)

    let jpegThumbnailBase64 = ''

    if (sendAsVoice) {
      await sendLocalAudioAsVoice(conn, m, downloaded)
    } else {
      // usamos "image" (scdn.co, estable) primero; "imageHD" (token temporal) queda como respaldo
      const thumbBuffer = await getBuffer(trackData.image || trackData.imageHD)

      const usedJpeg = await sendLocalAudio(conn, m, {
        ...downloaded,
        name: trackData.name,
        artist: trackData.artist,
        album: trackData.album,
        duration: trackData.duration,
        year: trackData.year,
        thumbBuffer,
      })
      if (usedJpeg) jpegThumbnailBase64 = usedJpeg.toString('base64')
    }

    await setCachedTrack(spotifyUrl, {
      filePath: downloaded.filePath,
      fileName: downloaded.fileName,
      contentType: downloaded.contentType,
      size: downloaded.size,
      name: trackData.name,
      artist: trackData.artist,
      album: trackData.album,
      duration: trackData.duration,
      year: trackData.year,
      // guardamos "image" (estable) en el índice de cache, no el token temporal
      image: trackData.image || trackData.imageHD,
      jpegThumbnailBase64,
    })

    await m.react('✅')
  } catch (error) {
    console.error('SPOTIFY ERROR:', error?.message || error)
    await m.react('❌')
    await conn.sendMessage(m.chat, { text: buildErrorMessage(String(error?.message || error)) }, { quoted: m })
  }
}

handler.command = ['spotify', 'spotifysearch', 'sp', 'spoti', 'spau', 'spvoz']
handler.help = ['spotify <cancion o link>']
handler.tags = ['downloader']
handler.desc = 'Busca o descarga audio de Spotify (evogb, con cache local). .spotify = documento con portada | .spau / .spvoz = audio reproducible'

export default handler