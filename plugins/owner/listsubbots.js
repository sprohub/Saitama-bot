import { listarSubbots } from '../../lib/subbots.js';

const handler = async (m, { conn, isROwner }) => {
  const todos = listarSubbots();

  if (!isROwner) {
    const propios = todos.filter(s => s.owner === m.sender);
    if (propios.length === 0) {
      return conn.sendMessage(m.chat, { text: 'No tienes subbots creados.' }, { quoted: m });
    }
    const texto = propios.map((s, i) => `${i + 1}. ID: ${s.id} | Numero: ${s.numero}`).join('\n');
    return conn.sendMessage(m.chat, { text: `📋 Tus subbots:\n\n${texto}` }, { quoted: m });
  }

  if (todos.length === 0) {
    return conn.sendMessage(m.chat, { text: 'No hay subbots creados.' }, { quoted: m });
  }

  const texto = todos.map((s, i) => `${i + 1}. ID: ${s.id} | Numero: ${s.numero} | Owner: ${s.owner.split('@')[0]}`).join('\n');
  return conn.sendMessage(m.chat, { text: `👑 Todos los subbots:\n\n${texto}` }, { quoted: m });
};

handler.help = ['listsubbots'];
handler.tags = ['owner'];
handler.command = /^(listsubbots|misbots)$/i;

export default handler;
