import { listarSubbots, eliminarSubbot } from '../../lib/subbots.js';

const handler = async (m, { conn, args, isROwner, usedPrefix }) => {
  const id = (args[0] || '').trim();

  if (!id) {
    return conn.sendMessage(m.chat, {
      text: `Uso: ${usedPrefix}delsubbot <id>\n\nUsa ${usedPrefix}listsubbots para ver los IDs disponibles.`
    }, { quoted: m });
  }

  const todos = listarSubbots();
  const subbot = todos.find(s => s.id === id);

  if (!subbot) {
    return conn.sendMessage(m.chat, { text: `No se encontro ningun subbot con el ID: ${id}` }, { quoted: m });
  }

  if (!isROwner && subbot.owner !== m.sender) {
    return conn.sendMessage(m.chat, { text: 'Ese subbot no te pertenece.' }, { quoted: m });
  }

  const ok = eliminarSubbot(id);

  if (ok) {
    return conn.sendMessage(m.chat, { text: `✅ Subbot ${id} eliminado correctamente.` }, { quoted: m });
  } else {
    return conn.sendMessage(m.chat, { text: `❌ No se pudo eliminar el subbot ${id}.` }, { quoted: m });
  }
};

handler.help = ['delsubbot <id>'];
handler.tags = ['owner'];
handler.command = /^(delsubbot|eliminarsubbot)$/i;

export default handler;