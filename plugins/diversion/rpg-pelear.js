import {
  generateWAMessageFromContent,
  proto
} from '@whiskeysockets/baileys'

let peleas = {}

let handler = async (m, { conn }) => {
  let who = m.sender
  let user = global.db.data.users[who]
  if (!user) {
    global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, health: 100, maxHealth: 100, attack: 10, defense: 5 }
    user = global.db.data.users[who]
  }

  if (peleas[who]) {
    let pelea = peleas[who]

    let sections = [{
      title: '⚔️ ACCIONES DE COMBATE',
      rows: [
        { header: '⚔️ ATACAR', title: 'Golpear al enemigo', description: 'Daño: ' + Math.floor((user.attack || 10) * 0.3) + '-' + (user.attack || 10) + ' ⚔️', id: 'acc_atacar' },
        { header: '🏃 HUIR', title: 'Escapar del combate', description: 'Pierdes la pelea', id: 'acc_huir' }
      ]
    }]

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: { title: '⚔️ HINATA BATTLE ⚔️', subtitle: pelea.oponente.name, hasMediaAttachment: false },
      body: { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n👹 » ' + pelea.oponente.name + '\n❤️ » Vida: ' + pelea.saludOponente + '/' + pelea.oponente.health + '\n⚔️ » Ataque: ' + pelea.oponente.attack + '\n\n👤 » Tú\n❤️ » Vida: ' + pelea.saludUsuario + '/' + (user.maxHealth || 100) + '\n⚔️ » Ataque: ' + (user.attack || 10) + '\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' },
      footer: { text: '⫏⫏ HINATA BATTLE ✿' },
      nativeFlowMessage: {
        buttons: [{
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: '⚔️ ACCIONES',
            sections: sections
          })
        }]
      }
    })

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
    return
  }

  let sections = [{
    title: '⚔️ ELIGE TU OPONENTE',
    rows: [
      { header: '🐺 BESTIA', title: 'Enemigos normales', description: 'Nivel 0+ | 5-35 💎', id: 'fight_bestia' },
      { header: '👹 BOSS', title: 'Jefes poderosos', description: 'Nivel 5+ | 50 💎', id: 'fight_boss' },
      { header: '💀 FINAL BOSS', title: 'Dios de la Destrucción', description: 'Nivel 10+ | 100 💎', id: 'fight_finalboss' }
    ]
  }]

  const interactiveMessage = proto.Message.InteractiveMessage.create({
    header: { title: '⚔️ HINATA BATTLE ⚔️', subtitle: 'Elige tu oponente', hasMediaAttachment: false },
    body: { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Elige contra quién pelear\n\n👤 » Tu fuerza: ' + (user.attack || 10) + ' ⚔️\n❤️ » Tu vida: ' + (user.health || 100) + '/' + (user.maxHealth || 100) + '\n⭐ » Tu nivel: ' + (user.level || 0) + '\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' },
    footer: { text: '⫏⫏ HINATA BATTLE ✿' },
    nativeFlowMessage: {
      buttons: [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: '⚔️ OPONENTES',
          sections: sections
        })
      }]
    }
  })

  const msg = generateWAMessageFromContent(m.chat, {
    viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
  }, { quoted: m })

  await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}

handler.before = async (m, { conn }) => {
  const nativeFlow = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (!nativeFlow) return false

  try {
    const data = JSON.parse(nativeFlow.paramsJson || '{}')
    const id = data.id || data.selectedId || data.selectedRowId || null
    if (!id) return false

    let who = m.sender
    let user = global.db.data.users[who]
    if (!user) {
      global.db.data.users[who] = { diamantes: 0, exp: 0, level: 0, health: 100, maxHealth: 100, attack: 10, defense: 5 }
      user = global.db.data.users[who]
    }

    if (id.startsWith('fight_')) {
      if (peleas[who]) {
        return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Ya estás en combate\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' }, { quoted: m })
      }

      let tipo = id.replace('fight_', '')
      let oponente

      let bestias = [
        { name: 'Lobo salvaje', attack: 12, health: 40, recompensa: 5, exp: 20 },
        { name: 'Bandido', attack: 15, health: 50, recompensa: 8, exp: 30 },
        { name: 'Ninja renegado', attack: 18, health: 60, recompensa: 10, exp: 40 },
        { name: 'Samurái caído', attack: 20, health: 70, recompensa: 15, exp: 50 },
        { name: 'Oni menor', attack: 22, health: 80, recompensa: 20, exp: 60 }
      ]

      let bosses = [
        { name: 'Orochimaru', attack: 30, health: 150, recompensa: 50, exp: 100 },
        { name: 'Pain', attack: 35, health: 180, recompensa: 50, exp: 120 },
        { name: 'Madara', attack: 40, health: 200, recompensa: 50, exp: 150 },
        { name: 'Kaguya', attack: 45, health: 250, recompensa: 50, exp: 180 },
        { name: 'Freezer', attack: 38, health: 200, recompensa: 50, exp: 140 }
      ]

      if (tipo === 'bestia') {
        oponente = bestias[Math.floor(Math.random() * bestias.length)]
      } else if (tipo === 'boss') {
        if ((user.level || 0) < 5) {
          return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Necesitas nivel 5 para BOSS\n⭐ » Tu nivel: ' + (user.level || 0) + '\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' }, { quoted: m })
        }
        oponente = bosses[Math.floor(Math.random() * bosses.length)]
      } else if (tipo === 'finalboss') {
        if ((user.level || 0) < 10) {
          return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » Necesitas nivel 10 para FINAL BOSS\n⭐ » Tu nivel: ' + (user.level || 0) + '\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' }, { quoted: m })
        }
        oponente = { name: 'DIOS DE LA DESTRUCCIÓN', attack: 60, health: 500, recompensa: 100, exp: 500 }
      }

      peleas[who] = {
        oponente: oponente,
        saludOponente: oponente.health,
        saludUsuario: user.health || 100
      }

      let sections = [{
        title: '⚔️ ACCIONES DE COMBATE',
        rows: [
          { header: '⚔️ ATACAR', title: 'Golpear al enemigo', description: 'Daño: ' + Math.floor((user.attack || 10) * 0.3) + '-' + (user.attack || 10) + ' ⚔️', id: 'acc_atacar' },
          { header: '🏃 HUIR', title: 'Escapar del combate', description: 'Pierdes la pelea', id: 'acc_huir' }
        ]
      }]

      const interactiveMessage = proto.Message.InteractiveMessage.create({
        header: { title: '⚔️ HINATA BATTLE ⚔️', subtitle: oponente.name, hasMediaAttachment: false },
        body: { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n💫 » ¡' + oponente.name + ' aparece!\n\n👹 » ' + oponente.name + '\n❤️ » Vida: ' + oponente.health + '/' + oponente.health + '\n⚔️ » Ataque: ' + oponente.attack + '\n\n👤 » Tú\n❤️ » Vida: ' + (user.health || 100) + '/' + (user.maxHealth || 100) + '\n⚔️ » Ataque: ' + (user.attack || 10) + '\n\n🏆 » Recompensa: ' + oponente.recompensa + ' 💎 | ' + oponente.exp + ' exp\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' },
        footer: { text: '⫏⫏ HINATA BATTLE ✿' },
        nativeFlowMessage: {
          buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: '⚔️ ACCIONES',
              sections: sections
            })
          }]
        }
      })

      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
      }, { quoted: m })

      await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
      return true
    }

    if (id.startsWith('acc_')) {
      let accion = id.replace('acc_', '')
      let pelea = peleas[who]
      if (!pelea) return true

      if (accion === 'huir') {
        user.health = pelea.saludUsuario
        delete peleas[who]
        return conn.sendMessage(m.chat, { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n🏃 » Huiste del combate\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' }, { quoted: m })
      }

      if (accion === 'atacar') {
        let ataqueMin = Math.floor((user.attack || 10) * 0.3)
        let ataqueMax = user.attack || 10
        let danoUsuario = Math.floor(Math.random() * (ataqueMax - ataqueMin + 1)) + ataqueMin

        let opAtaqueMin = Math.floor(pelea.oponente.attack * 0.3)
        let opAtaqueMax = pelea.oponente.attack
        let danoOponente = Math.floor(Math.random() * (opAtaqueMax - opAtaqueMin + 1)) + opAtaqueMin

        pelea.saludOponente -= danoUsuario

        if (pelea.saludOponente <= 0) {
          let op = pelea.oponente
          user.diamantes = (user.diamantes || 0) + op.recompensa
          user.exp = (user.exp || 0) + op.exp
          user.health = pelea.saludUsuario
          delete peleas[who]

          let texto = '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n'
          texto += '🏆 » ¡VENCISTE!\n\n'
          texto += '💀 » ' + op.name + ' derrotado\n'
          texto += '💎 » +' + op.recompensa + ' diamantes\n'
          texto += '✨ » +' + op.exp + ' experiencia\n'
          texto += '💰 » Total: ' + user.diamantes + ' 💎\n\n'
          texto += '✦•┈๑⋅⋯ ⋯⋅๑┈•✦'

          return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
        }

        pelea.saludUsuario -= danoOponente

        if (pelea.saludUsuario <= 0) {
          let op = pelea.oponente
          user.health = Math.max(1, Math.floor((user.maxHealth || 100) * 0.3))
          delete peleas[who]

          let texto = '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n'
          texto += '💀 » ¡FUISTE DERROTADO!\n\n'
          texto += '👹 » ' + op.name + ' te venció\n'
          texto += '❤️ » Vida restante: ' + user.health + '\n\n'
          texto += '✦•┈๑⋅⋯ ⋯⋅๑┈•✦'

          return conn.sendMessage(m.chat, { text: texto }, { quoted: m })
        }

        user.health = pelea.saludUsuario

        let sections = [{
          title: '⚔️ ACCIONES DE COMBATE',
          rows: [
            { header: '⚔️ ATACAR', title: 'Golpear de nuevo', description: 'Daño: ' + Math.floor((user.attack || 10) * 0.3) + '-' + (user.attack || 10) + ' ⚔️', id: 'acc_atacar' },
            { header: '🏃 HUIR', title: 'Escapar del combate', description: 'Pierdes la pelea', id: 'acc_huir' }
          ]
        }]

        const interactiveMessage = proto.Message.InteractiveMessage.create({
          header: { title: '⚔️ HINATA BATTLE ⚔️', subtitle: pelea.oponente.name, hasMediaAttachment: false },
          body: { text: '⚔️ 「 HINATA BATTLE 」 ⚔️\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦\n\n⚡ » Tu golpe: -' + danoUsuario + ' ❤️\n💥 » Su golpe: -' + danoOponente + ' ❤️\n\n👹 » ' + pelea.oponente.name + ': ' + pelea.saludOponente + '/' + pelea.oponente.health + ' ❤️\n👤 » Tú: ' + pelea.saludUsuario + '/' + (user.maxHealth || 100) + ' ❤️\n\n✦•┈๑⋅⋯ ⋯⋅๑┈•✦' },
          footer: { text: '⫏⫏ HINATA BATTLE ✿' },
          nativeFlowMessage: {
            buttons: [{
              name: 'single_select',
              buttonParamsJson: JSON.stringify({
                title: '⚔️ ACCIONES',
                sections: sections
              })
            }]
          }
        })

        const msg = generateWAMessageFromContent(m.chat, {
          viewOnceMessage: { message: { messageContextInfo: {}, interactiveMessage } }
        }, { quoted: m })

        await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
        return true
      }
    }

    return false

  } catch (e) {
    console.log(e)
    return false
  }
}

handler.help = ['pelear']
handler.tags = ['rpg']
handler.command = /^(pelear|battle|fight)$/i
handler.desc = 'Pelea con botones contra bestias y bosses'

export default handler