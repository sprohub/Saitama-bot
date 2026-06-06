let handler = async (m, { conn }) => {
  let texto = '❀ HINATA INFO RPG ❀\n\n'
  texto += 'El sistema RPG de Hinata te permite vivir una aventura ninja completa.\n\n'
  texto += 'COMANDOS DISPONIBLES:\n\n'
  texto += '❀ work, work2 - Trabaja para ganar 💎\n'
  texto += '❀ daily - Recompensa diaria\n'
  texto += '❀ weekly - 500 💎 cada 7 días\n'
  texto += '❀ monthly - 3000 💎 cada 30 días\n'
  texto += '❀ fish - Pesca para ganar 💎\n'
  texto += '❀ crime - Comete crímenes\n'
  texto += '❀ cazar - Caza animales\n'
  texto += '❀ minar - Extrae minerales\n'
  texto += '❀ cofre - Abre cofre cada hora\n'
  texto += '❀ aventura - Explora mazmorras\n'
  texto += '❀ slut - Trabaja en las calles\n'
  texto += '❀ casino - Apuesta colores\n'
  texto += '❀ ruleta - Ruleta x2, x10\n'
  texto += '❀ steal - Roba a otros usuarios\n'
  texto += '❀ pelear - Batalla contra bestias y bosses\n'
  texto += '❀ curar - Cura tu vida por 1 💎\n'
  texto += '❀ levelup - Sube de nivel\n'
  texto += '❀ clase - Cambia de clase\n'
  texto += '❀ perfil - Tus estadísticas completas\n'
  texto += '❀ banco, dep, ret - Maneja tu banco\n'
  texto += '❀ pay - Transfiere 💎 a otros\n'
  texto += '❀ top - Ranking global\n'
  texto += '❀ weekly - Ranking semanal\n'
  texto += '❀ monthly - Ranking mensual\n\n'
  texto += 'CONSEJOS:\n'
  texto += '❀ Guarda tus 💎 en el banco para protegerlos de robos\n'
  texto += '❀ Sube de nivel para desbloquear mejores clases\n'
  texto += '❀ Usa curar antes de pelear contra bosses fuertes\n\n'
  texto += '> Usa #menu para ver todos los comandos'

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['inforpg']
handler.tags = ['info']
handler.command = /^(inforpg|rpginfo|guia)$/i
handler.desc = 'Guía del sistema RPG'

export default handler