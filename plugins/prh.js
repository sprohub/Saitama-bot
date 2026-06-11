import fetch from 'node-fetch'

// Base de datos temporal para estados por chat
const pornhubStates = new Map()

let handler = async (m, { conn, text, command, usedPrefix }) => {
  // Sistema de activación/desactivación
  if (text === 'on' || text === 'off') {
    const chatId = m.chat
    if (text === 'on') {
      pornhubStates.set(chatId, true)
      return conn.sendMessage(m.chat, { 
        text: '✅ *PornHub activado* en este chat\nUsa *.prh texto* para buscar\n*.prh aleatorio* para video random\n*.prh off* para desactivar' 
      }, { quoted: m })
    } else {
      pornhubStates.delete(chatId)
      return conn.sendMessage(m.chat, { 
        text: '❌ *PornHub desactivado* en este chat' 
      }, { quoted: m })
    }
  }

  // Verificar si está activado en este chat
  if (!pornhubStates.has(m.chat)) {
    return conn.sendMessage(m.chat, { 
      text: `⚠️ El comando está desactivado\nUsa *${usedPrefix}prh on* para activar` 
    }, { quoted: m })
  }

  // Comando aleatorio
  if (text === 'aleatorio') {
    try {
      // Categorías comunes para búsqueda aleatoria
      const categories = ['teen', 'milf', 'anal', 'blowjob', 'creampie', 'hardcore', 'lesbian', 'latina']
      const randomCategory = categories[Math.floor(Math.random() * categories.length)]
      text = randomCategory
    } catch (e) {
      return conn.sendMessage(m.chat, { text: '❌ Error generando búsqueda aleatoria' }, { quoted: m })
    }
  }

  // Si no hay texto después de on/off/aleatorio
  if (!text) {
    return conn.sendMessage(m.chat, { 
      text: `📌 *Uso correcto:*\n• *${usedPrefix}prh on* - Activar en este chat\n• *${usedPrefix}prh off
