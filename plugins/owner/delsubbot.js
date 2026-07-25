import { leerRegistro, buscarSubbotsPorNumero, detenerProcesoSubbot, eliminarSubbot } from '../../lib/subbots.js';

const handler = async (m, { conn, args, usedPrefix }) => {
  const entrada = (args[0] || '').trim();
  const registro = leerRegistro();

  if (!entrada) {
    return conn.sendMessage(m.chat, {
      text: `Uso: ${usedPrefix}delsubbot <id o numero>\nEj: ${usedPrefix}delsubbot 573001234567\nUsa ${usedPrefix}listsubbots para ver los disponibles.`
    }, { quoted: m });
  }

  let id = registro.subbots[entrada] ? entrada : null;

  if (!id) {
    const coincidencias = buscarSubbotsPorNumero(entrada);
    if (coincidencias.length === 1) {
      id = coincidencias[0][0];
    } else if (coincidencias.length > 1) {
      const lista = coincidencias.map(([subId, info]) => `▸ ${subId} (${info.numero})`).join('\n');
      return conn.sendMessage(m.chat, {
        text: `Ese numero tiene *${coincidencias.length}* subbots asociados, especifica el ID:\n${lista}`
      }, { quoted: m });
    }
  }

  if (!id || !registro.subbots[id]) {
    return conn.sendMessage(m.chat, {
      text: `No encontre ningun subbot con ese ID o numero.\nUsa ${usedPrefix}listsubbots para ver los disponibles.`
    }, { quoted: m });
  }

  const info = registro.subbots[id];
  await detenerProcesoSubbot(info.nombreProceso);
  eliminarSubbot(id);

  await conn.sendMessage(m.chat, {
    text: `🗑️ Subbot *${id}* (${info.numero}) eliminado (proceso detenido y sesion borrada). Los demas subbots y el bot principal no fueron afectados.`
  }, { quoted: m });
};

handler.help = ['delsubbot <id o numero>'];
handler.tags = ['owner'];
handler.command = /^delsubbot$/i;
handler.owner = true;

export default handler;
