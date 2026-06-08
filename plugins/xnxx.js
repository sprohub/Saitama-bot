import axios from "axios";
import fs from "fs";
import path from "path";
import { reply } from "../../utils.js";

const DB_PATH = path.resolve("./data/nsfw_groups.json");

// Categorías disponibles de nekobot
const CATEGORIES = {
  "4k":          ["4k"],
  "ass":         ["cola", "culo"],
  "boobs":       ["pechos", "tetas"],
  "pgif":        ["gif"],
  "lesbian":     ["lesbiana"],
  "hentai":      ["hentai"],
  "blowjob":     ["bj"],
  "feet":        ["pies"],
  "thigh":       ["muslos"],
  "ahegao":      ["ahegao"],
  "anal":        ["anal"],
};

// Mapa inverso alias -> categoría real
const ALIAS_MAP = {};
for (const [cat, aliases] of Object.entries(CATEGORIES)) {
  ALIAS_MAP[cat] = cat;
  for (const alias of aliases) {
    ALIAS_MAP[alias] = cat;
  }
}

function buildMenu() {
  const lines = ["🔞 *Categorías NSFW disponibles*\n"];
  for (const [cat, aliases] of Object.entries(CATEGORIES)) {
    const aliasStr = aliases.length > 0 ? `  _(${aliases.join(", ")})_` : "";
    lines.push(`▸ *${cat}*${aliasStr}`);
  }
  lines.push("\n📌 *Uso:* .nsfw <categoría o alias>");
  lines.push("📌 *Ejemplo:* .nsfw hentai | .nsfw pies");
  lines.push("\n⚙️ *Admins:*");
  lines.push("▸ .nsfw on — activar NSFW en el grupo");
  lines.push("▸ .nsfw off — desactivar NSFW en el grupo");
  return lines.join("\n");
}

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ groups: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function isNsfwEnabled(jid) {
  const db = loadDB();
  return db.groups?.[jid]?.nsfw === true;
}

function setNsfw(jid, state) {
  const db = loadDB();
  if (!db.groups[jid]) db.groups[jid] = {};
  db.groups[jid].nsfw = state;
  saveDB(db);
}

export default {
  name: "ns",
  run: async (sock, msg, args, jid) => {
    try {
      const input = (args[0] || "").toLowerCase();

      // --- Menú ---
      if (!input || input === "menu" || input === "ayuda" || input === "help") {
        if (!isNsfwEnabled(jid)) {
          return reply(
            sock,
            jid,
            "🚫 El contenido NSFW está desactivado en este grupo.\n\nUn admin puede activarlo con *.nsfw on*",
            msg
          );
        }
        return reply(sock, jid, buildMenu(), msg);
      }

      // --- Control de activación (solo admins) ---
      if (input === "on" || input === "off") {
      const sender = msg.key.participant || msg.key.remoteJid;
      const senderNum = sender.split("@")[0].split(":")[0].trim();

      // Owner del bot por número Y por LID
      const BOT_OWNER_NUM = "573223090406";
      const BOT_OWNER_LID = "204148502954022"; // tu LID que sale en los logs

      const isBotOwner = senderNum === BOT_OWNER_NUM || senderNum === BOT_OWNER_LID;

      if (isBotOwner) {
        const state = input === "on";
        setNsfw(jid, state);
        return reply(
          sock,
          jid,
          state ? "✅ NSFW activado en este grupo." : "🚫 NSFW desactivado en este grupo.",
          msg
        );
      }

      // Verificar admin/owner del grupo
      const groupMeta = await sock.groupMetadata(jid);
      const ownerNum = (groupMeta.owner || "").split("@")[0].split(":")[0].trim();
      const isOwner = ownerNum === senderNum;

      const isAdmin = groupMeta.participants.some((p) => {
        if (!p.admin) return false;
        const pNum = (p.id || "").split("@")[0].split(":")[0].trim();
        const pPhone = (p.phoneNumber || "").replace(/\D/g, "");
        return pNum === senderNum || pPhone === senderNum;
      });

      if (!isAdmin && !isOwner) {
        return reply(sock, jid, "❌ Solo los admins o el owner del grupo pueden activar/desactivar el NSFW.", msg);
      }

      const state = input === "on";
      setNsfw(jid, state);

      return reply(
        sock,
        jid,
        state ? "✅ NSFW activado en este grupo." : "🚫 NSFW desactivado en este grupo.",
        msg
      );
    }

      // --- Verificar si NSFW está activado ---
      if (!isNsfwEnabled(jid)) {
        return reply(
          sock,
          jid,
          "🚫 El contenido NSFW está desactivado en este grupo.\n\nUn admin puede activarlo con *.nsfw on*",
          msg
        );
      }

      // --- Resolver alias -> categoría ---
      const categoria = ALIAS_MAP[input];

      if (!categoria) {
        return reply(
          sock,
          jid,
          `❌ Categoría *"${input}"* no encontrada.\nEscribe *.nsfw menu* para ver todas las opciones.`,
          msg
        );
      }

      // --- Obtener imagen ---
      const { data } = await axios.get(
        `https://nekobot.xyz/api/image?type=${categoria}`
      );

      if (!data?.message) {
        return reply(sock, jid, "❌ No pude obtener imagen, intenta de nuevo.", msg);
      }

      await sock.sendMessage(
        jid,
        {
          image: { url: data.message },
          caption: `🔞 *${categoria.toUpperCase()}*`
        },
        { quoted: msg }
      );
    } catch (e) {
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};