import axios from "axios";
import fs from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import path from "path";
import { pipeline } from "stream/promises";

// ─── Configuración de carpeta temporal ────────────────────────────────────────
const TEMP_DIR = "./temp_apk"; // Asegúrate de tener esta carpeta creada

let handler = async (m, { conn, isOwner, isAdmin }) => {
  // Solo permitir a owner o admins
  if (!isOwner && !isAdmin) {
    return conn.sendMessage(m.chat, { text: "❌ Solo admins pueden usar este comando." }, { quoted: m });
  }

  await conn.sendMessage(m.chat, { text: "⏳ *Descargando APK de Termux...*" }, { quoted: m });

  await fs.mkdir(TEMP_DIR, { recursive: true });
  const apkPath = path.join(TEMP_DIR, `termux_${Date.now()}.apk`);

  try {
    // 1. Obtener la URL del último release de Termux en GitHub
    const releaseData = await axios.get("https://api.github.com/repos/termux/termux-app/releases/latest");

    // 2. Buscar el asset que contenga 'universal.apk'
    const asset = releaseData.data.assets.find(a => a.name.includes("universal.apk"));

    if (!asset) {
      throw new Error("No encontré el archivo universal.apk en el último release.");
    }

    // 3. Descargar el APK
    const response = await axios.get(asset.browser_download_url, {
      responseType: "stream",
      timeout: 120000,
    });

    await pipeline(response.data, createWriteStream(apkPath));

    // 4. Enviar el archivo
    await conn.sendMessage(m.chat, {
      document: await fs.readFile(apkPath),
      fileName: "Termux_Oficial.apk",
      mimetype: "application/vnd.android.package-archive",
      caption: `📦 *Termux APK*\n\nVersión: ${releaseData.data.tag_name}\nFuente: GitHub Oficial`,
    }, { quoted: m });

  } catch (e) {
    console.error("[TERMUX ERROR]", e);
    await conn.sendMessage(m.chat, { text: "❌ Error al obtener el APK oficial. Intenta de nuevo más tarde." }, { quoted: m });
  } finally {
    // Limpiar archivo temporal
    if (existsSync(apkPath)) await fs.unlink(apkPath);
  }
};

handler.help = ['termux'];
handler.tags = ['tools']; // aparecerá en la categoría "🛠️ Tools" del menú
handler.command = /^termux$/i;

export default handler;
