import { exec } from 'child_process'

const BANNER = 'https://i.ibb.co/jkhp8BZD/wof.jpg'

// ── Helpers ──────────────────────────────────────────
const run = (cmd) => new Promise((resolve, reject) =>
  exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) =>
    err ? reject(err) : resolve(stdout.trim())
  )
)

const react = (conn, m, emoji) =>
  conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })

const marco = (titulo, body) =>
`╭━━⬣ ✦ *SAITAMA BOT* ✦
│
│  ${titulo}
│
${body}
╰━━━━━━━━━━━━━━━━━━━━━━⬣`

const parseGitOutput = (stdout) => {
  const creados    = (stdout.match(/create mode \d+ (.+)/g) || []).map(c => c.split(' ').pop())
  const eliminados = (stdout.match(/delete mode \d+ (.+)/g) || []).map(c => c.split(' ').pop())
  const changedMatch = stdout.match(/(\d+) files? changed/)
  const summary      = stdout.match(/\d+ files? changed, \d+ insertions?\(\+\), \d+ deletions?\(-\)/)
  const summaryNums  = summary ? summary[0].match(/\d+/g) : null

  return {
    creados,
    eliminados,
    archivosModificados: changedMatch ? changedMatch[1] : null,
    lineasAgregadas:     summaryNums  ? summaryNums[1]  : null,
    lineasEliminadas:    summaryNums  ? summaryNums[2]  : null
  }
}

const buildList = (title, items) => {
  if (!items.length) return ''
  return `│  ${title}\n` + items.map(f => `│   ⫸ ${f}`).join('\n') + '\n│\n'
}

// ── Handler ───────────────────────────────────────────
const handler = async (m, { conn }) => {
  const who = m.sender

  await react(conn, m, '⏳')

  await conn.sendMessage(m.chat, {
    text: marco('⏳ _Iniciando actualización..._',
`│  ⫸ Verificando repositorio
│     ↳ _Espera un momento..._`)
  }, { quoted: m })

  try {
    // ── 1. Info ANTES del pull ─────────────────────────
    let hashAntes, versionAntes, ultimoCommitCuando, rama

    try {
      hashAntes          = await run('git rev-parse --short HEAD')
      versionAntes       = await run('git describe --tags --abbrev=0 2>/dev/null || echo "sin-tag"')
      ultimoCommitCuando = await run('git log -1 --pretty=%cr')
      rama               = await run('git branch --show-current')
    } catch {
      hashAntes          = 'unknown'
      versionAntes       = 'sin-tag'
      ultimoCommitCuando = 'desconocido'
      rama               = 'main'
    }

    // ── 2. Verificar conflictos ────────────────────────
    const statusOutput    = await run('git status --porcelain')
    const tieneConflictos = statusOutput
      .split('\n')
      .some(l => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('DD'))

    if (tieneConflictos) {
      await react(conn, m, '⚠️')

      const archivos = statusOutput
        .split('\n')
        .filter(l => l.startsWith('UU') || l.startsWith('AA'))
        .map(l => `│   ⫸ ${l.slice(3)}`)
        .join('\n')

      return conn.sendMessage(m.chat, {
        text: marco('⚠️ _Conflictos detectados_',
`│  ⫸ Pull cancelado por seguridad
│     ↳ _Resuelve los conflictos primero_
│
${archivos}
│
│  ⫸ Solución
│     ↳ _git checkout -- . && git pull_`)
      }, { quoted: m })
    }

    // ── 3. Auto stash si hay cambios locales ───────────
    const hayLocales = statusOutput.trim().length > 0
    if (hayLocales) await run('git stash')

    // ── 4. Git pull ────────────────────────────────────
    const stdout = await run('git pull')

    if (hayLocales) {
      try { await run('git stash pop') } catch { /* ignorar */ }
    }

    // ── 5. Ya estaba al día ────────────────────────────
    if (stdout.includes('Already up to date')) {
      await react(conn, m, '✅')

      return conn.sendMessage(m.chat, {
        image: { url: BANNER },
        caption: marco('✅ _Sin cambios_',
`│  ⫸ El bot ya está al día
│
│  ⫸ Rama     — ${rama}
│  ⫸ Versión  — ${versionAntes} _(${hashAntes})_
│  ⫸ Último   — _${ultimoCommitCuando}_
│
│  👤 @${who.split('@')[0]}`),
        mentions: [who]
      }, { quoted: m })
    }

    // ── 6. Actualización exitosa ───────────────────────
    await react(conn, m, '✅')

    let hashDespues, versionDespues, commitMsg
    try {
      hashDespues    = await run('git rev-parse --short HEAD')
      versionDespues = await run('git describe --tags --abbrev=0 2>/dev/null || echo "sin-tag"')
      commitMsg      = await run('git log -1 --pretty=%s')
    } catch {
      hashDespues    = 'unknown'
      versionDespues = 'sin-tag'
      commitMsg      = 'sin descripción'
    }

    const { creados, eliminados, archivosModificados, lineasAgregadas, lineasEliminadas } = parseGitOutput(stdout)

    let body = ''
    body += `│  ⫸ Rama     — ${rama}\n`
    body += `│  ⫸ Versión  — ${versionAntes} → *${versionDespues}*\n`
    body += `│  ⫸ Commit   — ${hashAntes} → *${hashDespues}*\n`
    body += `│  ⫸ Hace     — _${ultimoCommitCuando}_\n`
    body += `│  ⫸ Cambio   — _${commitMsg}_\n│\n`

    body += buildList('✨ Nuevos:', creados)
    body += buildList('🗑️ Eliminados:', eliminados)

    if (archivosModificados) {
      body += `│  📝 Modificados — ${archivosModificados} archivo(s)\n│\n`
    }

    if (lineasAgregadas !== null) {
      body += `│  📊 Resumen\n│   ⫸ +${lineasAgregadas} agregadas\n│   ⫸ -${lineasEliminadas} eliminadas\n│\n`
    }

    body += `│  👤 @${who.split('@')[0]}`

    await conn.sendMessage(m.chat, {
      image: { url: BANNER },
      caption: marco('🚀 _Actualización completada_', body),
      mentions: [who]
    }, { quoted: m })

    // ── 7. Reinicio ────────────────────────────────────
    await conn.sendMessage(m.chat, {
      text:
`╭━━⬣ ✦ *SAITAMA BOT* ✦
│
│  🔄 _Reiniciando..._
│     ↳ _Vuelvo en unos segundos_
│
╰━━━━━━━━━━━━━━━━━━━━━━⬣`
    }, { quoted: m })

    setTimeout(() => process.exit(0), 3000)

  } catch (err) {
    await react(conn, m, '❌')

    const error = err.message || String(err)
    const errorReplies = {
      'not a git repository':   '│  ⫸ No es un repositorio git\n│     ↳ _Clona el bot con git clone_',
      'Could not resolve host': '│  ⫸ Sin conexión a internet\n│     ↳ _Verifica tu red_',
      'Merge conflict':         '│  ⫸ Conflicto de fusión\n│     ↳ _git stash && git pull --force_',
      'Please commit':          '│  ⫸ Cambios locales sin guardar\n│     ↳ _git stash && git pull_'
    }

    const match  = Object.keys(errorReplies).find(k => error.includes(k))
    const detalle = match
      ? errorReplies[match]
      : `│  ⫸ Error inesperado\n│     ↳ _${error.slice(0, 200)}_`

    return conn.sendMessage(m.chat, {
      text: marco('❌ _Update fallido_', detalle)
    }, { quoted: m })
  }
}

handler.help = ['update', 'up']
handler.tags = ['owner']
handler.command = /^(update|actualizar|up)$/i
handler.desc = 'Actualiza saitama-bot a la última versión'
handler.owner = true

export default handler