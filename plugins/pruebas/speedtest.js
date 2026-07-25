import { createSpeedtestCard } from '../../lib/speedtest-card.js'

const TEST_HOST = 'https://speed.cloudflare.com'
const TRACE_HOST = 'https://1.1.1.1/cdn-cgi/trace'
const IPWHO_HOST = 'https://ipwho.is/'

const PING_SAMPLES = 3
const DEFAULT_DOWNLOAD_BYTES = 16_000_000
const DEFAULT_UPLOAD_BYTES = 4_000_000
const REQUEST_TIMEOUT_MS = 45_000
const TRACE_TIMEOUT_MS = 8_000
const NETWORK_TIMEOUT_MS = 10_000

const CF_HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  accept: '*/*',
  'cache-control': 'no-cache',
  origin: TEST_HOST,
  referer: `${TEST_HOST}/`,
}

const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  accept: '*/*',
  'cache-control': 'no-cache',
}

const DOWNLOAD_FALLBACKS = [
  { name: 'Cloudflare', buildUrl: (b) => `${TEST_HOST}/__down?bytes=${b}&r=${Date.now()}`, headers: CF_HEADERS },
  { name: 'Hetzner',   url: 'https://speed.hetzner.de/100MB.bin',          headers: DEFAULT_HEADERS, supportsRange: true },
  { name: 'OVH',       url: 'https://proof.ovh.net/files/100Mb.dat',       headers: DEFAULT_HEADERS, supportsRange: true },
  { name: 'Cachefly',  url: 'https://cachefly.cachefly.net/100mb.test',    headers: DEFAULT_HEADERS, supportsRange: true },
]

const UPLOAD_FALLBACKS = [
  { name: 'Cloudflare', buildUrl: () => `${TEST_HOST}/__up?r=${Date.now()}`, headers: CF_HEADERS },
  { name: 'Postman',    url: 'https://postman-echo.com/post',               headers: DEFAULT_HEADERS },
  { name: 'Httpbin',    url: 'https://httpbin.org/post',                    headers: DEFAULT_HEADERS },
]

let activeSpeedtest = null

function average(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

function stdDev(arr) {
  if (!arr.length) return 0
  const avg = average(arr)
  return Math.sqrt(average(arr.map((v) => (v - avg) ** 2)))
}

function clamp(v, min, max) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}

function formatMs(v) {
  return `${Number(v || 0).toFixed(0)} ms`
}

function formatMbps(bytes, ms) {
  const mbps = ((Number(bytes) * 8) / (Math.max(1, Number(ms)) / 1000)) / 1_000_000
  return `${mbps.toFixed(2)} Mbps`
}

function parseMbps(label = '') {
  const m = String(label).match(/([\d.]+)\s*Mbps/i)
  const v = m ? Number(m[1]) : 0
  return Number.isFinite(v) ? v : 0
}

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim()
  if (!text || text === 'null' || text === 'undefined') return fallback
  return text
}

function pickText(...values) {
  for (const value of values) {
    const text = cleanText(value)
    if (text) return text
  }
  return ''
}

function formatAsn(value) {
  const text = cleanText(value)
  if (!text) return ''
  if (/^AS/i.test(text)) return text.toUpperCase()
  if (/^\d+$/.test(text)) return `AS${text}`
  return text
}

function joinParts(parts, separator = ', ') {
  return parts.filter(Boolean).join(separator)
}

async function timedFetch(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = process.hrtime.bigint()
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { res, t0 }
  } finally {
    clearTimeout(timer)
  }
}

async function drainLimited(res, limit) {
  if (!res?.body?.getReader) {
    const buf = await res.arrayBuffer()
    return Math.min(buf.byteLength, limit || Infinity)
  }
  const reader = res.body.getReader()
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value?.byteLength || 0
    if (limit && total >= limit) { try { await reader.cancel() } catch {}; break }
  }
  return total
}

function parseTracePayload(text = '') {
  const payload = {}
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (key) payload[key] = value
  }
  return payload
}

async function fetchCloudflareTrace() {
  try {
    const { res } = await timedFetch(`${TRACE_HOST}?r=${Date.now()}`, { headers: DEFAULT_HEADERS }, TRACE_TIMEOUT_MS)
    const text = await res.text()
    return parseTracePayload(text)
  } catch {
    return null
  }
}

async function fetchIpWhoProfile() {
  try {
    const { res } = await timedFetch(IPWHO_HOST, { headers: { ...DEFAULT_HEADERS, accept: 'application/json' } }, NETWORK_TIMEOUT_MS)
    const raw = await res.text()
    return raw.trim() ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function fetchNetworkIdentity() {
  const [traceResult, ipwhoResult] = await Promise.allSettled([
    fetchCloudflareTrace(),
    fetchIpWhoProfile(),
  ])

  const trace = traceResult.status === 'fulfilled' ? traceResult.value : null
  const ipwho = ipwhoResult.status === 'fulfilled' ? ipwhoResult.value : null

  const countryCode = pickText(trace?.loc, ipwho?.country_code)
  const country = pickText(ipwho?.country, countryCode)
  const city = pickText(ipwho?.city)
  const region = pickText(ipwho?.region)
  const asn = pickText(formatAsn(ipwho?.connection?.asn), formatAsn(trace?.asn))
  const colo = pickText(trace?.colo)
  const location = joinParts([city, region, country || countryCode])

  return { location, asn, colo }
}

async function measurePing() {
  const samples = []
  for (let i = 0; i < PING_SAMPLES; i++) {
    try {
      const { res, t0 } = await timedFetch(`${TEST_HOST}/__down?bytes=1&r=${Date.now()}-${i}`, { headers: CF_HEADERS })
      await drainLimited(res, 8192)
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6)
    } catch {
      try {
        const { res, t0 } = await timedFetch(`${TRACE_HOST}?r=${Date.now()}-${i}`, { headers: DEFAULT_HEADERS }, 8000)
        await drainLimited(res, 8192)
        samples.push(Number(process.hrtime.bigint() - t0) / 1e6)
      } catch {}
    }
  }
  return {
    samples,
    averageMs: average(samples),
    bestMs: samples.length ? Math.min(...samples) : 0,
    jitterMs: stdDev(samples),
  }
}

async function measureDownload(bytesWanted) {
  for (const p of DOWNLOAD_FALLBACKS) {
    try {
      const url = p.buildUrl ? p.buildUrl(bytesWanted) : p.url
      const headers = p.supportsRange ? { ...p.headers, range: `bytes=0-${bytesWanted - 1}` } : p.headers
      const { res, t0 } = await timedFetch(url, { headers })
      const bytes = await drainLimited(res, bytesWanted)
      const ms = Number(process.hrtime.bigint() - t0) / 1e6
      return { ok: true, provider: p.name, bytes, ms, speedLabel: formatMbps(bytes, ms) }
    } catch (e) {}
  }
  return { ok: false, provider: '?', bytes: 0, ms: 0, speedLabel: '0.00 Mbps' }
}

async function measureUpload(bytesWanted) {
  const size = clamp(bytesWanted, 500_000, 4_000_000)
  const payload = Buffer.alloc(size, 97)
  for (const p of UPLOAD_FALLBACKS) {
    try {
      const url = p.buildUrl ? p.buildUrl() : p.url
      const headers = { ...p.headers, 'content-type': 'application/octet-stream', 'content-length': String(size) }
      const { res, t0 } = await timedFetch(url, { method: 'POST', headers, body: payload })
      await res.text()
      const ms = Number(process.hrtime.bigint() - t0) / 1e6
      return { ok: true, provider: p.name, bytes: size, ms, speedLabel: formatMbps(size, ms) }
    } catch {}
  }
  return { ok: false, provider: '?', bytes: size, ms: 0, speedLabel: '0.00 Mbps' }
}

async function runSpeedtest(downloadBytes, uploadBytes) {
  const t0 = Date.now()
  const [ping, download, upload, network] = await Promise.all([
    measurePing(),
    measureDownload(downloadBytes),
    measureUpload(uploadBytes),
    fetchNetworkIdentity(),
  ])
  return { startedAt: t0, finishedAt: Date.now(), ping, download, upload, network }
}

function classifyConnection(downloadMbps, uploadMbps, pingMs, jitterMs) {
  if (downloadMbps >= 100 && uploadMbps >= 25 && pingMs <= 35 && jitterMs <= 12) {
    return 'EXCELENTE'
  }
  if (downloadMbps >= 50 && uploadMbps >= 10) {
    return 'MUY BUENA'
  }
  if (downloadMbps >= 15 && uploadMbps >= 5 && pingMs <= 120) {
    return 'ESTABLE'
  }
  return 'LIMITADA'
}

function resolveMode(args = []) {
  const m = String(args[0] || '').toLowerCase()
  if (['full', 'pro', 'completo'].includes(m))
    return { label: 'COMPLETO', dl: 40_000_000, ul: 12_000_000 }
  if (['lite', 'rapido', 'fast'].includes(m))
    return { label: 'RÁPIDO', dl: 8_000_000, ul: 2_000_000 }
  return { label: 'NORMAL', dl: DEFAULT_DOWNLOAD_BYTES, ul: DEFAULT_UPLOAD_BYTES }
}

function wrap(title, lines) {
  return (
    `╭─⪼ ⚡ *${title}*\n` +
    lines.map(l => `│ ${l}`).join('\n') +
    `\n╰───────────────⬣`
  )
}

let handler = async (m, { conn, args }) => {
  if (activeSpeedtest) {
    return conn.sendMessage(m.chat, {
      text: wrap('SPEEDTEST', ['Ya hay un speedtest en progreso, espera a que termine.'])
    }, { quoted: m })
  }

  const { label, dl, ul } = resolveMode(args)
  await m.react('⚡')

  await conn.sendMessage(m.chat, {
    text: wrap('SPEEDTEST', [
      `*Modo:* ${label}`,
      'Midiendo conexión, espera un momento...'
    ])
  }, { quoted: m })

  try {
    activeSpeedtest = runSpeedtest(dl, ul)
    const result = await activeSpeedtest

    const downloadMbps = parseMbps(result.download.speedLabel)
    const uploadMbps = parseMbps(result.upload.speedLabel)
    const pingMs = result.ping.averageMs
    const jitterMs = result.ping.jitterMs
    const statusLabel = classifyConnection(downloadMbps, uploadMbps, pingMs, jitterMs)
    const network = result.network || {}

    const image = createSpeedtestCard({
      botName: 'SAITAMA-BOT',
      modeLabel: label,
      statusLabel,
      downloadMbps,
      uploadMbps,
      pingMs,
      jitterMs,
      colo: network.colo,
      location: network.location,
      asn: network.asn,
    })

    const caption = wrap('SPEEDTEST', [
      `*Modo:* ${label}`,
      `*Calidad:* ${statusLabel}`,
      `*Zona:* ${network.location || 'No detectada'}`,
      `*Nodo:* ${network.colo || 'No detectado'}`,
      `*Mejor ping:* ${formatMs(result.ping.bestMs)}`,
      'IP oculta por privacidad 🔒'
    ])

    await conn.sendMessage(m.chat, { image, caption }, { quoted: m })
    await m.react('✅')
  } catch (err) {
    await conn.sendMessage(m.chat, {
      text: wrap('SPEEDTEST', [`*Error en speedtest:* ${err?.message || err}`])
    }, { quoted: m })
    await m.react('❌')
  } finally {
    activeSpeedtest = null
  }
}

handler.help = ['speedtest', 'speed', 'internet']
handler.tags = ['tools']
handler.command = /^(speedtest|speed|internet)$/i
handler.desc = 'Mide ping, descarga y subida del internet del bot'

export default handler
