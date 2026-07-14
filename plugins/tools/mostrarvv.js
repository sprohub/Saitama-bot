import { downloadMediaMessage, normalizeMessageContent } from "@whiskeysockets/baileys";
// 👉 Imagen local del banner (colócala en lib/mostrarmg.png)
const bannerImagePath = path.join(__dirname, '..', '..', 'lib', 'mostrarmg.png')

let handler = async (m, { conn }) => {
  const quoted = m.quoted ? m.quoted : m;
  const mtype = quoted.mtype || quoted.type || "";

  const isMedia =
    mtype === "imageMessage" ||
    mtype === "videoMessage" ||
    quoted.msg?.mimetype;

  if (!m.quoted || !isMedia) {
    return conn.sendMessage(
      m.chat,
      {
        text:
`╭─⪼ 🌿 *SAITAMA BOT* 🌿
│
│ ❌ Responde a una foto o video
│ de *ver una sola vez* citándolo
│ con *.mostrar* o *.mst*
│
╰───────────────⬣`,
      },
      { quoted: m }
    );
  }

  try {
    await conn.sendMessage(
      m.chat,
      {
        image: { url: SAITAMA_REVEAL_IMG },
        caption:
`╭─⪼ 🌱 *SAITAMA BOT* 🌱
│
│ 👀 Intentando revelar el
│ contenido de ver una sola vez...
│
│ 🍃 Espera un momento
│
╰───────────────⬣`,
      },
      { quoted: m }
    );

    let buffer;

    if (typeof quoted.download === "function") {
      buffer = await quoted.download();
    }

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

    const caption =
`╭─⪼ 🌿 *SAITAMA BOT* 🌿
│
│ ✅ Contenido revelado
│ con éxito
│
│ 🍃 Ver una sola vez → superado
│
╰───────────────⬣`;

    if (mtype === "imageMessage") {
      await conn.sendMessage(
        m.chat,
        { image: buffer, caption },
        { quoted: m }
      );
    } else {
      await conn.sendMessage(
        m.chat,
        { video: buffer, mimetype: "video/mp4", caption },
        { quoted: m }
      );
    }
  } catch (e) {
    console.error("[MOSTRAR ERROR]", e);
    await conn.sendMessage(
      m.chat,
      {
        text:
`╭─⪼ 🍂 *SAITAMA BOT* 🍂
│
│ ❌ No pude recuperar el
│ contenido de ver una sola vez
│
│ 🌱 ${e?.message || "Intenta de nuevo más tarde."}
│
╰───────────────⬣`,
      },
      { quoted: m }
    );
  }
};

handler.help = ['mostrar', 'mst'];
handler.tags = ['tools'];
handler.command = /^(mostrar|mst)$/i;

export default handler;