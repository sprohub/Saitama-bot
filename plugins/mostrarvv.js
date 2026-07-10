import fs from "fs";
import path from "path";
import {
  downloadMediaMessage,
  normalizeMessageContent,
} from "@whiskeysockets/baileys";

const TEMP_DIR = "./temp_apk"; // usa la misma carpeta temporal que ya usas en termux.js

function getQuotedInfo(m) {
  const ctx = m?.message?.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage || !ctx?.stanzaId || !ctx?.participant) return null;

  return {
    quotedMessage: ctx.quotedMessage,
    key: {
      remoteJid: m.key.remoteJid,
      fromMe: false,
      id: ctx.stanzaId,
      participant: ctx.participant,
    },
  };
}

function findMedia(message) {
  if (!message) return null;
  if (message.imageMessage) return { type: "image", message };
  if (message.videoMessage) return { type: "video", message };
  return null;
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

let handler = async (m, { conn }) => {
  const quotedInfo = getQuotedInfo(m);

  if (!quotedInfo) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Responde a una foto o video de *ver una sola vez* con *.vv*" },
      { quoted: m }
    );
  }

  const normalized = normalizeMessageContent(quotedInfo.quotedMessage);
  const media = findMedia(normalized);

  if (!media) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ No detecté imagen o video válido en el mensaje respondido. Intenta respondiendo directamente al archivo de una sola vez." },
      { quoted: m }
    );
  }

  let tempFile = null;

  try {
    await conn.sendMessage(m.chat, { text: "👀 Recuperando archivo de ver una sola vez..." }, { quoted: m });

    const fakeMsg = {
      key: quotedInfo.key,
      message: normalized,
    };

    const buffer = await downloadMediaMessage(
      fakeMsg,
      "buffer",
      {},
      {
        logger: undefined,
        reuploadRequest: conn.updateMediaMessage,
      }
    );

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1000) {
      throw new Error("No pude descargar el archivo multimedia.");
    }

    if (media.type === "image") {
      await conn.sendMessage(
        m.chat,
        {
          image: buffer,
          caption: "✅ Imagen recuperada de ver una sola vez",
        },
        { quoted: m }
      );
      return;
    }

    await fs.promises.mkdir(TEMP_DIR, { recursive: true });
    tempFile = path.join(TEMP_DIR, `vv_${Date.now()}.mp4`);
    fs.writeFileSync(tempFile, buffer);

    try {
      await conn.sendMessage(
        m.chat,
        {
          video: { url: tempFile },
          mimetype: "video/mp4",
          caption: "✅ Video recuperado de ver una sola vez",
        },
        { quoted: m }
      );
    } catch {
      await conn.sendMessage(
        m.chat,
        {
          document: { url: tempFile },
          mimetype: "video/mp4",
          fileName: `viewonce_${Date.now()}.mp4`,
          caption: "✅ Video recuperado de ver una sola vez",
        },
        { quoted: m }
      );
    }
  } catch (error) {
    await conn.sendMessage(
      m.chat,
      { text: `❌ ${error?.message || "No pude recuperar el archivo de ver una sola vez."}` },
      { quoted: m }
    );
  } finally {
    deleteFileSafe(tempFile);
  }
};

handler.help = ['vv'];
handler.tags = ['tools'];
handler.command = /^(vv|ver|viewonce|revelar)$/i;

export default handler;