console.clear()

import { join, dirname } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { setupMaster, fork } from 'cluster'
import { watchFile, unwatchFile } from 'fs'
import cfonts from 'cfonts'
import chalk from 'chalk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(__dirname)

// 🌿 Decoración tradicional (la misma que usan los plugins), en verde
function decorarConsola(texto) {
  const cuerpo = texto.split('\n').map(l => `│ ${l}`).join('\n')
  return chalk.green(`╭─⪼ \n${cuerpo}\n╰───────────────⬣`)
}

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

console.log(decorarConsola('🌿 SAITAMA BOT\n🍃 Modo Serio Activado'))

cfonts.say('BRAYANRK & SPROHUB', {
  font: 'console',
  align: 'center',
  gradient: ['#ffe259', '#ffa751', '#ffa751'],
  env: 'node'
})

console.log(decorarConsola('「Un golpe. Un héroe. Serius Mode ON.」'))

let isWorking = false
let restartCount = 0

async function launch(scripts) {
  if (isWorking) return
  isWorking = true
  restartCount++

  for (const script of scripts) {
    const args = [join(__dirname, script), ...process.argv.slice(2)]

    console.log(decorarConsola(`🌿 Despertando a Saitama - Intento #${restartCount}\n🍃 Entrenando 100 flexiones, 100 sentadillas, 10km...`))

    setupMaster({
      exec: args[0],
      args: args.slice(1),
    })

    let child = fork()

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(decorarConsola('✅ SAITAMA BOT se ha dormido tranquilamente'))
        return
      }

      console.log(decorarConsola(`⚠️ Saitama se ha desmayado (Código: ${code})`))

      isWorking = false

      console.log(decorarConsola('🔄 Saitama está recuperando fuerzas...\n👊 ¡Un solo golpe y vuelve al combate!'))

      setTimeout(() => {
        launch(scripts)
      }, 1000)

      watchFile(args[0], () => {
        unwatchFile(args[0])
        console.log(decorarConsola('🔄 ¡Actualización detectada! Saitama se transforma...'))
        launch(scripts)
      })
    })

    child.on('message', (msg) => {
      if (msg === 'ready') {
        console.log(decorarConsola('✨ SAITAMA BOT ESTÁ LISTO ✨\n👊 Modo Serio completamente activado'))
      }
    })
  }
}

console.log(decorarConsola('👊 Invocando a Saitama...'))

launch(['main.js'])

setTimeout(() => {
  console.log(decorarConsola('¡SAITAMA BOT HA DESPERTADO!\n👊 MODO SERIO ON 👊'))
}, 2000)

process.on('uncaughtException', (err) => {
  console.log(decorarConsola('💥 ¡El poder se descontroló!\n🔄 Saitama está respirando hondo...'))
  console.error(err)
})

process.on('unhandledRejection', (err) => {
  console.log(decorarConsola('⚡ ¡Un golpe fallido!\n🔄 Saitama está recalculando su golpe...'))
  console.error(err)
})
