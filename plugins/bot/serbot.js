// Crea un subbot propio: cada quien vincula su numero y ese numero
// corre como su propio proceso de PM2, aislado del bot principal.
import { crearSubbotCompleto, contarSubbotsDe, leerStatus } from '../../lib/subbots.js';

const LIMITE_POR_PERSONA = 10;

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const handler = async (m, { conn, args, usedPrefix }) => {
  const remitente = m.sender;
  const numeroPropio = remitente.replace(/[^0-9]/g, '');
  const modoQR = (args[0] || '').toLowerCase() === 'qr';
  const numero = modoQR ? 'qr' : (args[0] || numeroPropio).replace(/[^0-9]/g, '');

  if (!numero) {
    return conn.sendMessage(m.chat, {
      text: `No se pudo detectar ningun numero. Uso: ${usedPrefix}serbot [numero con codigo de pais, sin +]\nEj: ${usedPrefix}serbot 5215512345678\n\nO ${usedPrefix}serbot qr para vincular con QR.\n\nO simplemente ${usedPrefix}serbot solo, para usar tu propio numero (${numeroPropio}).`
    }, { quoted: m });
  }

  const existentes = contarSubbotsDe(remitente);
  if (existentes >= LIMITE_POR_PERSONA) {
    return conn.sendMessage(m.chat, {
      text: `⚠️ Ya tienes ${existentes} subbot(s) creado(s). El limite es ${LIMITE_POR_PERSONA} por persona.`
    }, { quoted: m });
  }

  await conn.sendMessage(m.chat, {
    text: '🪄 Creando tu subbot y solicitando codigo de vinculacion, espera unos segundos...'
  }, { quoted: m });

  try {
    const { id, nombreProceso } = await crearSubbotCompleto(numero, remitente);

    let status = null;
    for (let intento = 0; intento < 20; intento++) {
      await esperar(2000);
      status = leerStatus(id);
      if (status?.codigo || status?.estado === 'error') break;
    }

    if (!status || (!status.codigo && !status.qrPath && status.estado !== 'error')) {
      return conn.sendMessage(m.chat, {
        text: `⚠️ No se pudo generar el codigo/QR a tiempo. Revisa con:\npm2 logs ${nombreProceso}\n\nO vuelve a intentar con ${usedPrefix}serbot ${numero}`
      }, { quoted: m });
    }

    if (status.estado === 'error') {
      return conn.sendMessage(m.chat, { text: `❌ Error al crear el subbot: ${status.error || 'error desconocido'}` }, { quoted: m });
    }

    if (status.qrPath) {
      await conn.sendMessage(m.chat, {
        image: { url: status.qrPath },
        caption: `✅ Tu subbot fue creado (ID: *${id}*)\n\nEscanea este QR desde WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo.`
      }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, {
        text: `✅ Tu subbot fue creado (ID: *${id}*)\n\nVe a WhatsApp del numero ${numero} → Ajustes → Dispositivos vinculados → Vincular con numero de telefono, y cuando te pida el codigo, copia y pega el siguiente mensaje (dentro de los proximos minutos):`
      }, { quoted: m });
      await conn.sendMessage(m.chat, { text: status.codigo });
    }

    await conn.sendMessage(m.chat, {
      text: 'Una vez vinculado, ese numero quedara corriendo como su propio subbot, con los mismos comandos que este bot.'
    }, { quoted: m });
  } catch (err) {
    console.error('[serbot] Error:', err);
    await conn.sendMessage(m.chat, { text: '❌ Ocurrio un error al crear tu subbot. Intenta de nuevo en un momento.' }, { quoted: m });
  }
};

handler.help = ['serbot [numero]'];
handler.tags = ['bot'];
handler.command = /^(serbot|subbot|crearsubbot)$/i;

export default handler;
