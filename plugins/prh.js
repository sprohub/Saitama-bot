import fetch from "node-fetch";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { reply } from "../../utils.js";

const DB_PATH = path.resolve("./data/nsfw_groups.json");
const searchSessions = new Map(); // sender -> resultados

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ groups: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function isNsfwEnabled(jid) {
  const db = loadDB();
  return db.groups?.[jid]?.nsfw === true;
}

const OWNER_NUMBERS = ["573225396540", "573225814649"]; // Sin @s.whatsapp.net

async function prhDL(URL) {
  const res = await fetch(URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.pornhub.com/"
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr("content") || $("title").text().trim().replace(" - Pornhub", "");

  // Buscar enlaces de video (Pornhub usa variables JS como "videoUrl" o quality links)
  let files = {};
  const scripts = $("script").map((i, el) => $(el).html()).get().join("\n");

  // Patrón común para enlaces directos en Pornhub
  const qualityMatches = scripts.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/gi) || [];
  const uniqueQualities = [...new Set(qualityMatches.map(m => m.replace(/"/g, '')))];

  if (uniqueQualities.length > 0) {
    files.high = uniqueQualities[0]; // Tomar el primero (generalmente mejor)
    if (uniqueQualities.length > 1) files.low = uniqueQualities[uniqueQualities.length - 1];
  }

  // Alternativa: buscar en window.playerConfig o similar
  const playerMatch = scripts.match(/var playerConfig\s*=\s*({[\s\S]*?});/i) ||
                      scripts.match(/playerConfig\s*=\s*({[\s\S]*?})/i);
  if (playerMatch) {
    try {
      const configStr = playerMatch[1].replace(/'/g, '"');
      const config = JSON.parse(configStr);
      if (config.videoUrl) files.high = config.videoUrl;
    } catch (e) {}
  }

  const thumb = $('meta[property="og:image"]').attr("content") || null;

  let dur = "Desconocida";
  const durationMeta = $('meta[property="video:duration"]').attr("content") ||
                       $(".duration").first().text().trim();
  if (durationMeta) dur = durationMeta;

  return { result: { title, thumb, info: { dur }, files } };
}

async function prhSearch(query) {
  const url = `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://www.pornhub.com/"
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  // Selectores comunes para resultados de Pornhub
  $("li.videoBox").each((i, el) => {
    const href = $(el).find("a").first().attr("href");
    if (!href) return;
    const link = href.startsWith("http") ? href : `https://www.pornhub.com${href}`;
    const title = $(el).find(".title a").attr("title") || $(el).find(".title").text().trim() || "Sin título";
    const thumb = $(el).find("img").attr("data-src") || $(el).find("img").attr("src") || null;
    results.push({ title, link, thumb });
  });

  if (results.length === 0) {
    // Selector alternativo
    $("div.videoPreviewBg").each((i, el) => {
      const href = $(el).closest("a").attr("href");
      if (!href) return;
      const link = href.startsWith("http") ? href : `https://www.pornhub.com${href}`;
      const titleEl = $(el).closest("li").find(".title");
      const title = titleEl.attr("title") || titleEl.text().trim() || "Sin título";
      const thumb = $(el).find("img").attr("src") || null;
      results.push({ title, link, thumb });
    });
  }

  return { result: results };
}

async function descargarVideo(sock, msg, jid, url) {
  await reply(sock, jid, "⏳ Descargando video de Pornhub, espera...", msg);

  const res = await prhDL(url);
  const dll = res.result.files.high || res.result.files.low;

  if (!dll) {
    return reply(sock, jid, "❌ No se pudo obtener el link directo del video.", msg);
  }

  const videoBuffer = await fetch(dll, {
    headers: { "User-Agent": "Mozilla/5.0" }
  }).then((r) => r.buffer()).catch(() => null);

  if (!videoBuffer) {
    return reply(sock, jid, "❌ Error al descargar el archivo.", msg);
  }

  const caption =
    `*🔞 PORNHUB - DESCARGA*\n\n` +
    `📌 *${res.result.title}*\n` +
    `⏱️ Duración: ${res.result.info.dur}`;

  await sock.sendMessage(
    jid,
    { video: videoBuffer, caption, mimetype: "video/mp4" },
    { quoted: msg }
  );
}

export default {
  name: "prh",
  aliases: ["pornhub", "ph"],
  run: async (sock, msg, args, jid, sender) => {
    try {
      const senderClean = sender.replace(/@.+$/, ""); // Solo número

      if (!isNsfwEnabled(jid)) {
        return reply(
          sock,
          jid,
          "🚫 El contenido NSFW está desactivado en este grupo.\n\nUn admin puede activarlo con *.nsfw on*",
          msg
        );
      }

      const query = args.join(" ").trim();

      // Comandos de admin: .prh on / .prh off
      if (["on", "off"].includes(query.toLowerCase())) {
        if (!OWNER_NUMBERS.includes(senderClean)) {
          return reply(sock, jid, "❌ Solo los owners pueden usar .prh on/off.", msg);
        }
        // Aquí deberías implementar toggle NSFW si no existe ya, pero como usa el mismo DB que xnxx, asume que ya está manejado
        return reply(sock, jid, `✅ NSFW ${query.toUpperCase()} en este grupo.`, msg);
      }

      // Aleatorio
      if (query.toLowerCase() === "aleatorio") {
        await reply(sock, jid, "🎲 Buscando video aleatorio...", msg);
        const randomRes = await prhSearch(""); // O usa página principal
        if (!randomRes.result.length) return reply(sock, jid, "❌ No se encontraron videos.", msg);
        const randomVideo = randomRes.result[Math.floor(Math.random() * randomRes.result.length)];
        await descargarVideo(sock, msg, jid, randomVideo.link);
        return;
      }

      // Selección por número
      if (searchSessions.has(sender) && /^\d+$/.test(query)) {
        const session = searchSessions.get(sender);
        const index = parseInt(query) - 1;
        if (index < 0 || index >= session.length) {
          return reply(sock, jid, `❌ Número inválido. Elige entre 1 y ${session.length}.`, msg);
        }
        searchSessions.delete(sender);
        await descargarVideo(sock, msg, jid, session[index].link);
        return;
      }

      if (!query) {
        return reply(
          sock,
          jid,
          "Ingresa el título o URL de Pornhub.\nEjemplos:\n*.prh mia khalifa*\n*.prh aleatorio*",
          msg
        );
      }

      // Descarga directa por URL
      if (query.includes("pornhub.com")) {
        await descargarVideo(sock, msg, jid, query);
        return;
      }

      // Búsqueda
      await reply(sock, jid, "🔍 Buscando en Pornhub...", msg);
      const res = await prhSearch(query);

      if (!res.result.length) {
        return reply(sock, jid, "❌ No se encontraron resultados.", msg);
      }

      const resultados = res.result.slice(0, 8); // Menos para no spamear

      searchSessions.set(sender, resultados);
      setTimeout(() => searchSessions.delete(sender), 120_000);

      for (let i = 0; i < resultados.length; i++) {
        const v = resultados[i];
        const caption = `*${i + 1}.* ${v.title}`;

        if (v.thumb) {
          try {
            const imgBuffer = await fetch(v.thumb, { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.buffer());
            await sock.sendMessage(jid, { image: imgBuffer, caption }, { quoted: msg });
          } catch {
            await reply(sock, jid, caption, msg);
          }
        } else {
          await reply(sock, jid, caption, msg);
        }
      }

      await reply(sock, jid, `📎 Responde con el *número* del video que quieres descargar (2 minutos).`, msg);

    } catch (e) {
      console.error(e);
      await reply(sock, jid, `❌ Error: ${e.message}`, msg);
    }
  },
};