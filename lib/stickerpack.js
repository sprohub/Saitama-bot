import fs from 'fs'
import path from 'path'

const baseDir = path.join(process.cwd(), 'storage', 'stickers')
const filesDir = path.join(baseDir, 'files')
const dataPath = path.join(baseDir, 'data.json')

function ensureDirs() {
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true })
  if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2))
}

export function readPack() {
  ensureDirs()
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  } catch {
    return {}
  }
}

export function writePack(data) {
  ensureDirs()
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
}

export function stickerFilePath(name) {
  return path.join(filesDir, `${name}.webp`)
}

export function addSticker(name, buffer, meta = {}) {
  ensureDirs()
  const data = readPack()
  const filePath = stickerFilePath(name)
  fs.writeFileSync(filePath, buffer)
  data[name] = { file: filePath, ...meta, date: Date.now() }
  writePack(data)
  return data[name]
}

export function removeSticker(name) {
  const data = readPack()
  if (!data[name]) return false
  try {
    if (fs.existsSync(data[name].file)) fs.unlinkSync(data[name].file)
  } catch {}
  delete data[name]
  writePack(data)
  return true
}

export function getSticker(name) {
  const data = readPack()
  return data[name] || null
}

export function listStickers() {
  const data = readPack()
  return Object.entries(data).map(([name, meta]) => ({ name, ...meta }))
}