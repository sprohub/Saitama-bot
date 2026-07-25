// Igual que .serbot pero sin limite, solo para el owner del bot.
import { leerStatus, crearSubbotCompleto } from '../../lib/subbots.js';

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const handler = async (m, { conn, args, usedPrefix }) => {
  const numero = (args[0] || '').replace(/[^0-9]/g, '');
  if (!numero) {
    return conn.sendMessage(m.chat, {
      text: `Uso: ${usedPrefix}addsubbot <numero con codigo de pais, sin +>\nEj: ${usedPrefix}addsubbot 5215512345678`
    }, { quoted: m });
  }

  await conn.sendMessage(m.chat, {
    text: '🪄 Creando el subbot y solicitando codigo de vinculacion, espera unos segundos...'
  }, { quoted: m });

  const remitente = m.sender;

  try {
    const { id, nombreProceso } = await crearSubbotCompleto(numero, remitente);

    let status = null;
    for (let intento = 0; intento < 15; intento++) {
      await esperar(2000);
      status = leerStatus(id);
      if (status?.codigo || status?.estado === 'error') break;
    }

    if (!status || (!status.codigo && status.estado !== 'error')) {
      return conn.sendMessage(m.chat, {
        text: `⚠️ El subbot se creo (ID: ${id}) pero no respondio a tiempo. Revisa con:\npm2 logs ${nombreProceso}`
      }, { quoted: m });
    }

    if (status.estado === 'error') {
      return conn.sendMessage(m.chat, { text: `❌ Error al crear el subbot: ${status.error}` }, { quoted: m });
    }

    await conn.sendMessage(m.chat, {
      text: `✅ Subbot creado (ID: *${id}*)\n\n📱 Numero: ${numero}\n\nVe a WhatsApp del numero ${numero} → Ajustes → Dispositivos vinculados → Vincular con numero de telefono, y cuando te pida el codigo, copia y pega el siguiente mensaje (dentro de los proximos minutos):`
    }, { quoted: m });

    await conn.sendMessage(m.chat, { text: status.codigo });

    await conn.sendMessage(m.chat, {
      text: `Usa ${usedPrefix}listsubbots para revisar el estado.`
    }, { quoted: m });
  } catch (err) {
    console.error('[addsubbot] Error:', err);
    await conn.sendMessage(m.chat, { text: '❌ Ocurrio un error al crear el subbot.' }, { quoted: m });
  }
};

handler.help = ['addsubbot <numero>'];
handler.tags = ['owner'];
handler.command = /^addsubbot$/i;
handler.owner = true;

export default handler;
