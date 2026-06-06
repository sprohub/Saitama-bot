let handler = async (m, { conn }) => {
  let texto = '❀ HINATA INFO GACHA ❀\n\n'
  texto += 'La gacha de Hinata te permite coleccionar personajes de anime.\n\n'
  texto += 'COMANDOS:\n\n'
  texto += '❀ rw - Tira gacha 1 (personajes con rarezas SSR/SR/R)\n'
  texto += '❀ claim - Reclama tu último personaje de #rw\n'
  texto += '❀ rw2 - Tira gacha 2 (personajes de anime real)\n'
  texto += '❀ inventario - Ver colección 1\n'
  texto += '❀ inventario2 - Ver colección 2\n'
  texto += '❀ coleccion - Progreso completo\n'
  texto += '❀ vender - Vende personajes por 💎\n'
  texto += '❀ mercado - Compra y vende entre usuarios\n'
  texto += '❀ regalar - Regala personajes\n\n'
  texto += 'RAREZAS:\n'
  texto += '❀ SSR (2%) - Los más poderosos\n'
  texto += '❀ SR (13%) - Fuertes\n'
  texto += '❀ R (85%) - Comunes\n\n'
  texto += 'PRECIOS DE VENTA:\n'
  texto += '❀ SSR: 10 💎 | SR: 5 💎 | R: 2 💎\n\n'
  texto += '> Usa #suertegacha para eventos especiales'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['infogacha']
handler.tags = ['info']
handler.command = /^(infogacha|gachainfo)$/i
handler.desc = 'Guía del sistema gacha'

export default handler