console.clear()
console.log('⚡💥 SAITAMA BOT 💥⚡')

import { join, dirname } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { setupMaster, fork } from 'cluster'
import { watchFile, unwatchFile } from 'fs'
import cfonts from 'cfonts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(__dirname)

cfonts.say('SAITAMA BOT', {
  font: 'block',
  align: 'center',
  gradient: ['#FFD700', '#FFA500', '#FF4500'],
  background: 'Black',
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: '0',
  env: 'node'
})

console.log('\x1b[33m%s\x1b[0m', '═'.repeat(60))
console.log('\x1b[33m%s\x1b[0m', '   ⚡ SAITAMA BOT - UN GOLPE. UN COMANDO. ⚡')
console.log('\x1b[33m%s\x1b[0m', '═'.repeat(60))

cfonts.say('ELVIGILANTE & SPROH', {
  font: 'console',
  align: 'center',
  gradient: ['#FFD700', '#FFA500', '#FFA500'],
  env: 'node'
})

console.log('\x1b[33m%s\x1b[0m', '\n"⚡ Me volví poderoso porque entrené duro. Tú también puedes. ⚡"')
console.log('\x1b[33m%s\x1b[0m', '═'.repeat(60) + '\n')

let isWorking = false
let restartCount = 0

async function launch(scripts) {
  if (isWorking) return
  isWorking = true
  restartCount++

  for (const script of scripts) {
    const args = [join(__dirname, script), ...process.argv.slice(2)]

    console.log('\x1b[33m%s\x1b[0m', `⚡ Despertando a Saitama - Intento #${restartCount}`)
    console.log('\x1b[33m%s\x1b[0m', '💪 Cargando poder... un golpe bastará.\n')

    setupMaster({
      exec: args[0],
      args: args.slice(1),
    })

    let child = fork()

    child.on('exit', (code) => {
      console.log('\x1b[31m%s\x1b[0m', `\n⚠️  Saitama se ha aburrido (Código: ${code})`)

      if (code === 0) {
        console.log('\x1b[33m%s\x1b[0m', '✅ SAITAMA BOT se ha ido a dormir tranquilamente')
        return
      }

      isWorking = false

      console.log('\x1b[33m%s\x1b[0m', '🔄 Saitama está calentando con sus 100 flexiones...')
      console.log('\x1b[33m%s\x1b[0m', '⚡ ¡El puño más fuerte se está recargando!\n')

      setTimeout(() => {
        launch(scripts)
      }, 1000)

      watchFile(args[0], () => {
        unwatchFile(args[0])
        console.log('\x1b[33m%s\x1b[0m', '🔄 ¡Actualización detectada! Saitama se pone la capa...')
        launch(scripts)
      })
    })

    child.on('message', (msg) => {
      if (msg === 'ready') {
        console.log('\x1b[33m%s\x1b[0m', '✨ SAITAMA BOT ESTÁ LISTO ✨')
        console.log('\x1b[33m%s\x1b[0m', '⚡ Puño Serio completamente cargado ⚡\n')
      }
    })
  }
}

console.log('\x1b[33m%s\x1b[0m', '⚡ Invocando a Saitama... ⚡\n')

launch(['main.js'])

setTimeout(() => {
  console.log('\x1b[33m%s\x1b[0m', `
╔════════════════════════════════════╗
║     ¡SAITAMA BOT HA DESPERTADO!    ║
║      ⚡  UN GOLPE. UN COMANDO. ⚡   ║
╚════════════════════════════════════╝
  `)
}, 2000)

process.on('uncaughtException', (err) => {
  console.log('\x1b[31m%s\x1b[0m', '💥 ¡El puño rompió algo que no debía! 💥')
  console.log('\x1b[33m%s\x1b[0m', '🔄 Saitama está mirando el techo con cara de aburrido...')
  console.error(err)
})

process.on('unhandledRejection', (err) => {
  console.log('\x1b[31m%s\x1b[0m', '⚡ ¡Saitama detectó una anomalía en el universo! ⚡')
  console.log('\x1b[33m%s\x1b[0m', '🔄 Saitama la está resolviendo de un solo golpe...')
  console.error(err)
})
