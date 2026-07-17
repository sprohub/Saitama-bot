console.clear()
console.log('👊⚡ SAITAMA BOT ⚡👊')

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
  gradient: ['#ffd700', '#ff8c00', '#ff8c00'],
  background: 'Black',
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: '0',
  env: 'node'
})

console.log('\x1b[36m%s\x1b[0m', '═'.repeat(60))
console.log('\x1b[33m%s\x1b[0m', '   👊 SAITAMA BOT - Modo Serio Activado 👊')
console.log('\x1b[36m%s\x1b[0m', '═'.repeat(60))

cfonts.say('BRAYANRK & SPROHUB', {
  font: 'console',
  align: 'center',
  gradient: ['#ffe259', '#ffa751', '#ffa751'],
  env: 'node'
})

console.log('\x1b[32m%s\x1b[0m', '\n「Un golpe. Un héroe. Serius Mode ON.」')
console.log('\x1b[36m%s\x1b[0m', '═'.repeat(60) + '\n')

let isWorking = false
let restartCount = 0

async function launch(scripts) {
  if (isWorking) return
  isWorking = true
  restartCount++

  for (const script of scripts) {
    const args = [join(__dirname, script), ...process.argv.slice(2)]

    console.log('\x1b[35m%s\x1b[0m', `👊 Despertando a Saitama - Intento #${restartCount}`)
    console.log('\x1b[33m%s\x1b[0m', '🌿 Entrenando 100 flexiones, 100 sentadillas, 10km... 🌿\n')

    setupMaster({
      exec: args[0],
      args: args.slice(1),
    })

    let child = fork()

    child.on('exit', (code) => {
      console.log('\x1b[31m%s\x1b[0m', `\n⚠️ Saitama se ha desmayado (Código: ${code})`)

      if (code === 0) {
        console.log('\x1b[32m%s\x1b[0m', '✅ SAITAMA BOT se ha dormido tranquilamente')
        return
      }

      isWorking = false

      console.log('\x1b[33m%s\x1b[0m', '🔄 Saitama está recuperando fuerzas...')
      console.log('\x1b[36m%s\x1b[0m', '👊 ¡Un solo golpe y vuelve al combate! 👊\n')

      setTimeout(() => {
        launch(scripts)
      }, 1000)

      watchFile(args[0], () => {
        unwatchFile(args[0])
        console.log('\x1b[35m%s\x1b[0m', '🔄 ¡Actualización detectada! Saitama se transforma...')
        launch(scripts)
      })
    })

    child.on('message', (msg) => {
      if (msg === 'ready') {
        console.log('\x1b[32m%s\x1b[0m', '✨ SAITAMA BOT ESTÁ LISTO ✨')
        console.log('\x1b[33m%s\x1b[0m', '👊 Modo Serio completamente activado 👊\n')
      }
    })
  }
}

console.log('\x1b[36m%s\x1b[0m', '👊 Invocando a Saitama... 👊\n')

launch(['main.js'])

setTimeout(() => {
  console.log('\x1b[35m%s\x1b[0m', `
╔════════════════════════════════════╗
║      ¡SAITAMA BOT HA DESPERTADO!     ║
║         👊 MODO SERIO ON 👊          ║
╚════════════════════════════════════╝
  `)
}, 2000)

process.on('uncaughtException', (err) => {
  console.log('\x1b[31m%s\x1b[0m', '💥 ¡El poder se descontroló! 💥')
  console.log('\x1b[33m%s\x1b[0m', '🔄 Saitama está respirando hondo...')
  console.error(err)
})

process.on('unhandledRejection', (err) => {
  console.log('\x1b[31m%s\x1b[0m', '⚡ ¡Un golpe fallido! ⚡')
  console.log('\x1b[33m%s\x1b[0m', '🔄 Saitama está recalculando su golpe...')
  console.error(err)
})
