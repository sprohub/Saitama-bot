import { leerRegistro, leerStatus } from '../../lib/subbots.js';

const handler = async (m, { conn }) => {
  const registro = leerRegistro();
  const entradas = Object.entries(registro.subbots);

  if (!entradas.length) {
    return conn.sendMessage(m.chat, { text: 'No hay subbots creados todavia.' }, { quoted: m });
  }

  let texto = `🤖 *SUBBOTS (${entradas.length})*\n\n`;
  for (const [id, info] of entradas) {
    const status = leerStatus(id);
    const estado = status?.estado || info.estado || 'desconocido';
    texto += `▸ *${id}* — ${info.numero}\n   Estado: ${estado}\n   Proceso: ${info.nombreProceso}\n\n`;
  }

  await conn.sendMessage(m.chat, { text: texto.trim() }, { quoted: m });
};

handler.help = ['listsubbots'];
handler.tags = ['owner'];
handler.command = /^listsubbots$/i;
handler.owner = true;

export default handler;
