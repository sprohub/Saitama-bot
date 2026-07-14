import { downloadMediaMessage, normalizeMessageContent } from "@whiskeysockets/baileys";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// === Solución para __dirname en ESM ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta de tu imagen
const bannerImagePath = path.join(__dirname, '..', '..', 'lib', 'mostrarmg.png');

// Cargar la imagen como buffer
let bannerBuffer = null;
if (fs.existsSync(bannerImagePath)) {
  bannerBuffer = fs.readFileSync(bannerImagePath);
  console.log(`[✅] Banner cargado: mostrarmg.png`);
} else {
  console.warn(`[⚠️] No se encontró la imagen en: ${bannerImagePath}`);
}

let handler = async (m, { conn }) => {
  const quoted = m.quoted ? m.quoted : m;
  const mtype = quoted.mtype || quoted.type || "";

  const isMedia = mtype === "imageMessage" || 
                  mtype === "videoMessage" || 
                  quoted.msg?.mimetype;

  if (!m.quoted || !isMedia) {
    return conn.sendMessage(m.chat, {
      text: `╭─⪼ 🌿 *SAITAMA BOT* 🌿
│
│ ❌ Responde a una foto o video
│ de *ver una sola vez* citándolo
│ con *.mostrar* o *.mst*
│
╰───────────────⬣`
    }, { quoted: m });
  }

  try {
    // Enviar banner con tu imagen local
    await conn.sendMessage(m.chat, {
      image: bannerBuffer || { url: "https://i.imgur.com/8QJ8Z.png" }, // fallback
      caption: `╭─⪼ 🌱 *SAITAMA BOT* 🌱
│
│ 👀 Intentando revelar el
│ contenido de ver una sola vez...
│
│ 🍃 Espera un momento
│
╰───────────────⬣`
    }, { quoted: m });

    // === Descargar el contenido de "ver una sola vez" ===
    let buffer = null;

    if (typeof quoted.download === "function") {
      buffer = await quoted.download();
    }

    if (!buffer) {
      const ctx = m.message?.extendedTextMessage?.contextInfo;
      if (ctx?.quotedMessage) {
        const normalized = normalizeMessageContent(ctx.quotedMessage);
        const fakeMsg = {
          key: {
            remoteJid: m.chat,
            fromMe: false,
            id: ctx.stanzaId,
            participant: ctx.participant,
          },
          message: normalized,
        };
        buffer = await downloadMediaMessage(fakeMsg, "buffer", {}, {
          logger: undefined,
          reuploadRequest: conn.updateMediaMessage
        });
      }
    }

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1000) {
      throw new Error("No pude descargar el archivo multimedia.");
    }

    const successCaption = `╭─⪼ 🌿 *SAITAMA BOT* 🌿
│
│ ✅ Contenido revelado con éxito
│
│ 🍃 Ver una sola vez → superado
│
╰───────────────⬣`;

    if (mtype === "imageMessage") {
      await conn.sendMessage(m.chat, { image: buffer, caption: successCaption }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { 
        video: buffer, 
        mimetype: "video/mp4", 
        caption: successCaption 
      }, { quoted: m });
    }

  } catch (e) {
    console.error("[MOSTRAR ERROR]", e);
    await conn.sendMessage(m.chat, {
      text: `╭─⪼ 🍂 *SAITAMA BOT* 🍂
│
│ ❌ No pude recuperar el contenido
│
│ 🌱 ${e?.message || "Intenta de nuevo."}
│
╰───────────────⬣`
    }, { quoted: m });
  }
};

handler.help = ['mostrar', 'mst'];
handler.tags = ['tools'];
handler.command = /^(mostrar|mst)$/i;

export default handler;