import { downloadMediaMessage, normalizeMessageContent } from "@whiskeysockets/baileys";

function deleteFileSafe() {} // no usamos archivo temporal para imagen/video, se envía por buffer

let handler = async (m, { conn }) => {
  // 1. Verificar que hay un mensaje citado
  const quoted = m.quoted ? m.quoted : m;
  const mtype = quoted.mtype || quoted.type || "";

  const isMedia =
    mtype === "imageMessage" ||
    mtype === "videoMessage" ||
    quoted.msg?.mimetype;

  if (!m.quoted || !isMedia) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Responde a una foto o video de *ver una sola vez* con *.vv*" },
      { quoted: m }
    );
  }

  try {
    await conn.sendMessage(m.chat, { text: "👀 Recuperando archivo de ver una sola vez..." }, { quoted: m });

    let buffer;

    // 2. Intento A: método propio del framework (m.quoted.download())
    if (typeof quoted.download === "function") {
      buffer = await quoted.download();
    }

    // 3. Intento B (fallback): descarga cruda vía Baileys si no hay .download()
    if (!buffer) {
      const ctx = m.message?.extendedTextMessage?.contextInfo;
      if (!ctx?.quotedMessage || !ctx?.stanzaId || !ctx?.participant) {
        throw new Error("No pude leer el mensaje citado.");
      }

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

      buffer = await downloadMediaMessage(
        fakeMsg,
        "buffer",
        {},
        { logger: undefined, reuploadRequest: conn.updateMediaMessage }
      );
    }

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1000) {
      throw new Error("No pude descargar el archivo multimedia.");
    }

    // 4. Enviar según el tipo
    if (mtype === "imageMessage") {
      await conn.sendMessage(
        m.chat,
        { image: buffer, caption: "✅ Imagen recuperada de ver una sola vez" },
        { quoted: m }
      );
    } else {
      await conn.sendMessage(
        m.chat,
        { video: buffer, mimetype: "video/mp4", caption: "✅ Video recuperado de ver una sola vez" },
        { quoted: m }
      );
    }
  } catch (e) {
    console.error("[VV ERROR]", e);
    await conn.sendMessage(
      m.chat,
      { text: `❌ ${e?.message || "No pude recuperar el archivo de ver una sola vez."}` },
      { quoted: m }
    );
  }
};

handler.help = ['vv'];
handler.tags = ['tools'];
handler.command = /^(vv|ver|viewonce|revelar)$/i;

export default handler;