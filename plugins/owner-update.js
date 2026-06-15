import { exec } from 'child_process'

const BANNER = 'https://i.ibb.co/jkhp8BZD/wof.jpg'

const parseGitOutput = (stdout) => {
  const creados = (stdout.match(/create mode \d+ (.+)/g) || []).map(c => c.split(' ').pop())
  const eliminados = (stdout.match(/delete mode \d+ (.+)/g) || []).map(c => c.split(' ').pop())

  const changedMatch = stdout.match(/(\d+) files? changed/)
  const summary = stdout.match(/\d+ files? changed, \d+ insertions?\(\+\), \d+ deletions?\(-\)/)
  const summaryNums = summary ? summary[0].match(/\d+/g) : null

  return {
    creados,
    eliminados,
    archivosModificados: changedMatch ? changedMatch[1] : null,
    lineasAgregadas: summaryNums ? summaryNums[1] : null,
    lineasEliminadas: summaryNums ? summaryNums[2] : null
  }
}

const buildList = (title, items) => {
  if (!items.length) return ''
  return `\n│ ${title}\n` + items.map(f => `│   ❀ ${f}`).join('\n') + '\n'
}

const handler = async (m, { conn }) => {
  const who = m.sender

  await conn.sendMessage(m.chat, { text: '⏳ Buscando actualizaciones para SAITAMA BOT★...' }, { quoted: m })

  exec('git pull', { maxBuffer: 1024 * 1024 * 10 }, async (err, stdout) => {
    if (err) {
      const error = err.message
      const errorReplies = {
        'not a git repository': '❌ No es un repositorio git\n\n> Clona el bot con git clone',
        'Could not resolve host': '❌ Sin conexión a internet\n\n> Verifica tu conexión',
        'Merge conflict': '⚠️ Conflicto de fusión detectado\n\n> Usa #exec git stash && git pull --force',
        'Please commit': '⚠️ Tienes cambios locales sin guardar\n\n> Usa #exec git stash && git pull'
      }

      const match = Object.keys(errorReplies).find(key => error.includes(key))
      const texto = match ? errorReplies[match] : `❌ Error inesperado:\n${error}`

      return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
    }

    if (stdout.includes('Already up to date')) {
      return conn.sendMessage(m.chat, {
        image: { url: BANNER },
        caption: `╭───────────────⬣
│  ✦ *SAITAMA BOT* ✦
╰───────────────⬣

✨ Saitama ya está en su mejor versión
> No hay actualizaciones pendientes

> Solicitado por @${who.split('@')[0]}

╰───────────────⬣`,
        mentions: [who]
      }, { quoted: m })
    }

    const { creados, eliminados, archivosModificados, lineasAgregadas, lineasEliminadas } = parseGitOutput(stdout)

    let texto = `╭───────────────⬣
│  ✦ *SAITAMA BOT ACTUALIZADA* ✦
│   Saitama está full, se ha renovado
╰───────────────⬣`

    let body = ''
    body += buildList('✨ Nuevos archivos:', creados)
    body += buildList('🗑️ Archivos eliminados:', eliminados)

    if (archivosModificados) {
      body += `\n│ 📝 Archivos modificados:\n│   ❀ ${archivosModificados} archivo(s)\n`
    }

    if (lineasAgregadas !== null) {
      body += `\n│ 📊 Resumen:\n│   ❀ +${lineasAgregadas} línea(s) agregada(s)\n│   ❀ -${lineasEliminadas} línea(s) eliminada(s)\n`
    }

    if (body) texto += '\n│' + body + '╰───────────────⬣\n'

    texto += `\n> Actualizado por @${who.split('@')[0]}`

    await conn.sendMessage(m.chat, {
      image: { url: BANNER },
      caption: texto,
      mentions: [who]
    }, { quoted: m })
  })
}

handler.help = ['update']
handler.tags = ['owner']
handler.command = /^(update|actualizar)$/i
handler.desc = 'Actualiza saitama-bot a la última versión'
handler.owner = true

export default handler
