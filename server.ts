import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import { Telegraf, Markup, Context } from "telegraf";
import Database from "better-sqlite3";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const PORT = 3000;
const db = new Database("bot_database.db");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_ID = process.env.ADMIN_ID || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- DATABASE SETUP ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id TEXT UNIQUE,
    username TEXT,
    first_name TEXT,
    state TEXT DEFAULT 'START',
    uid_1xbet TEXT,
    screenshot_reg_url TEXT,
    screenshot_dep_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS bot_config (
    step_id TEXT PRIMARY KEY,
    message TEXT,
    media_url TEXT,
    delay_ms INTEGER,
    btn_text TEXT,
    btn_url TEXT,
    is_enabled INTEGER DEFAULT 1
  );
`);

// Migration for existing databases
try {
  db.prepare("ALTER TABLE bot_config ADD COLUMN is_enabled INTEGER DEFAULT 1").run();
} catch (e) {
  // Column already exists
}

// Initial system prompt
const defaultPrompt = "Tu es Marc, un assistant expert en stratégies de jeux (notamment Apple of Fortune). Ton ton est amical, professionnel et encourageant. Tu parles comme un humain réel. Ton objectif est d'aider l'utilisateur à gagner en utilisant le bot VIP.";
const existingPrompt = db.prepare("SELECT value FROM settings WHERE key = 'system_prompt'").get();
if (!existingPrompt) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("system_prompt", defaultPrompt);
}

// --- BOT TELEGRAM ---
const bot = new Telegraf(BOT_TOKEN);

// Helper function to download and save photo
async function savePhoto(ctx: Context, fileId: string): Promise<string> {
  const link = await ctx.telegram.getFileLink(fileId);
  const response = await axios({
    url: link.href,
    method: 'GET',
    responseType: 'arraybuffer'
  });
  const fileName = `${Date.now()}_${fileId.slice(-10)}.jpg`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  fs.writeFileSync(filePath, response.data);
  return `/uploads/${fileName}`;
}

async function sendToAdmin(photoSource: string, caption: string, userId: string, step: 'REG' | 'DEP') {
  if (!ADMIN_ID) {
    console.warn("⚠️ [ADMIN] ADMIN_ID non configuré. Impossible d'envoyer la preuve.");
    return;
  }
  
  try {
    await bot.telegram.sendPhoto(ADMIN_ID, photoSource, {
      caption: `📸 Nouvelle preuve (${step})\nID User: ${userId}\n${caption}`,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Accepter", `accept_${step}_${userId}`),
          Markup.button.callback("❌ Rejeter", `reject_${step}_${userId}`)
        ]
      ])
    });
    console.log(`[ADMIN] Preuve ${step} envoyée à l'admin ${ADMIN_ID} pour l'user ${userId}`);
  } catch (err: any) {
    console.error(`[ADMIN] Erreur lors de l'envoi de la photo à l'admin:`, err.message);
    // Fallback: envoyer au moins le texte si la photo échoue
    try {
      await bot.telegram.sendMessage(ADMIN_ID, `⚠️ Échec envoi photo pour l'user ${userId} (${step}).\n${caption}\n\nL'image a été sauvegardée localement.`);
    } catch (e) {}
  }
}

// Initialization of dynamic steps
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function safeReplyWithVideo(ctx: Context, userId: string, mediaUrl: string, options: any) {
  if (!mediaUrl) return;

  try {
    // Attempt to send as a video (works for file_ids and direct .mp4 links)
    if (ctx) {
      await ctx.replyWithVideo(mediaUrl, options);
    } else {
      await bot.telegram.sendVideo(userId, mediaUrl, options);
    }
  } catch (err: any) {
    console.error(`[Telegram] Video failure (${mediaUrl}):`, err.message);
    
    // Fallback if the URL is not a direct video (like a t.me link)
    const caption = options.caption || "";
    const replyMarkup = options.reply_markup;
    const isClean = !caption || caption.trim() === "";
    
    // If user wants it clean (no caption), we just send the info link or the button
    const message = isClean 
      ? `🎥 Regarder la vidéo : ${mediaUrl}` 
      : `${caption}\n\n🎥 Regarder la vidéo : ${mediaUrl}`;
    
    if (ctx) {
      await ctx.reply(message, { reply_markup: replyMarkup });
    } else {
      await bot.telegram.sendMessage(userId, message, { reply_markup: replyMarkup });
    }
  }
}

// --- LOG VIDEO FILE_ID FOR ADMIN ---
bot.on("video", (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId === ADMIN_ID) {
    const fileId = ctx.message.video.file_id;
    ctx.reply(`✅ Vidéo reçue !\n\nVoici le **file_id** à copier-coller dans votre dashboard (Média URL) pour qu'elle s'affiche directement :\n\n\`${fileId}\``);
    console.log(`[ADMIN] New Video File ID: ${fileId}`);
  }
});

const initialSteps = [
  { id: 'welcome', msg: "Salut {name} ! 👋\n\nC'est super d'accueillir de nouveaux membres dans mon équipe ! Tu rejoins une communauté de personnes fortes et prometteuses 💪\nSi t'es prêt·e à utiliser mon hackbot et profiter des faille dit juste « je veux gagner » d'accord ? 🚀", delay: 0 },
  { id: 'welcome_video', msg: "Regarde ça ! 🔥", media: "https://t.me/mm25video/2", delay: 3000, btn_text: "Rejoindre le canal 🔓", btn_url: "https://cut.solkah.org/vipdm" },
  { id: 'ask_interest', msg: "T'es interesser par rebot apple of fortune ??", delay: 4000 },
  { id: 'show_proofs', msg: "Super je te presente notre bot alors", delay: 0 },
  { id: 'proof_1', msg: "🎥 Preuve 1", media: "https://t.me/mm25video/5", delay: 500 },
  { id: 'proof_2', msg: "🎥 Preuve 2", media: "https://t.me/mm25video/4", delay: 500 },
  { id: 'proof_3', msg: "🎥 Preuve 3", media: "https://t.me/mm25video/3", delay: 500 },
  { id: 'ask_agreement', msg: "Comme vous voiyer dans les video le bot predit les position apple of fortune donc si t'es prete je t'envoie les etape a suivre pour que tu puiisse toi ausi gagner t'es d'accord ??", delay: 2000 },
  { id: 'instructions', msg: "Voici les etape a suivre avant que je te donne le bot :\n\nCreer un nouveau compte 1xbet ou melbet avec le code promo FSRAFA c'est obligatoire pour que le bot puiise reconnaire ton compte", delay: 0 },
  { id: 'reg_btn', msg: "Bref une fois que ton compte creer tu m'envoie la capture de ton id pour que je puisse ajouter dans le program j'ai mis en bas le bouton pour s'inscrire directement", delay: 2000, btn_text: "S'inscrire 🚀", btn_url: "https://cut.solkah.org/fsrafasub" }
];

for (const s of initialSteps) {
  db.prepare("INSERT OR IGNORE INTO bot_config (step_id, message, media_url, delay_ms, btn_text, btn_url, is_enabled) VALUES (?, ?, ?, ?, ?, ?, 1)").run(
    s.id, s.msg, s.media || null, s.delay, s.btn_text || null, s.btn_url || null
  );
}

// Helper to get step config
function getStep(id: string): any {
  return db.prepare("SELECT * FROM bot_config WHERE step_id = ?").get(id);
}

// Update startFunnel to use dynamic steps and target DM
async function startFunnel(userId: string, user: any) {
  const welcome = getStep('welcome');
  const welcomeVideo = getStep('welcome_video');
  const askInterest = getStep('ask_interest');

  if (welcome && welcome.is_enabled) {
    const welcomeMsg = welcome.message.replace("{name}", user.first_name || "l'ami");
    await bot.telegram.sendMessage(userId, welcomeMsg);
  }
  
  if (welcomeVideo && welcomeVideo.is_enabled) {
    if (welcomeVideo.delay_ms) await delay(welcomeVideo.delay_ms);
    await safeReplyWithVideo(null as any, userId, welcomeVideo.media_url, {
      caption: welcomeVideo.message,
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url(welcomeVideo.btn_text, welcomeVideo.btn_url)]
      ]).reply_markup
    });
  }

  if (askInterest && askInterest.is_enabled) {
    if (askInterest.delay_ms) await delay(askInterest.delay_ms);
    await bot.telegram.sendMessage(userId, askInterest.message);
  }
  db.prepare("UPDATE users SET state = 'WAITING_INTEREST' WHERE telegram_id = ?").run(user.telegram_id);
}

// In bot.on("message") - Onboarding Funnel Logic

// Detect Join Requests
bot.on("chat_join_request", async (ctx) => {
  const userId = ctx.chatJoinRequest.from.id.toString();
  const firstName = ctx.chatJoinRequest.from.first_name || "Ami";
  const username = ctx.chatJoinRequest.from.username || "";

  console.log(`[Join Request] Nouvel utilisateur détecté: ${firstName} (${userId})`);

  // Wait 10 seconds as requested
  await delay(10000);

  let user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(userId) as any;
  if (!user) {
    db.prepare("INSERT INTO users (telegram_id, first_name, username, state) VALUES (?, ?, ?, 'START')").run(userId, firstName, username);
    user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(userId);
  }

  try {
    await startFunnel(userId, user);
  } catch (err: any) {
    console.error(`[Join Request] Erreur DM:`, err.message);
  }
});

// Update /start command
bot.command("start", async (ctx) => {
  const userId = ctx.from.id.toString();
  db.prepare("INSERT OR IGNORE INTO users (telegram_id, username, first_name, state) VALUES (?, ?, ?, ?)").run(
    userId,
    ctx.from.username || "",
    ctx.from.first_name,
    "START"
  );
  const user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(userId);
  await startFunnel(userId, user);
});

// Helper for AI responses
async function getAIResponse(user: any, userText: string) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.trim() === "" || OPENROUTER_API_KEY === "YOUR_API_KEY") {
    console.error("⚠️ [AI] OPENROUTER_API_KEY ou GEMINI_API_KEY est manquant.");
    return "Désolé, l'IA n'est pas configurée (Clé API manquante dans l'environnement).";
  }

  const historyEntries = db.prepare("SELECT role, content FROM messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 10").all(user.telegram_id).reverse() as { role: string; content: string }[];
  const systemPromptQuery = db.prepare("SELECT value FROM settings WHERE key = 'system_prompt'").get() as { value: string };
  const systemPrompt = systemPromptQuery.value;
  
  // Build a context string based on user state
  let context = `\n[ACTION REQUISE]: `;
  if (user.state === "WAITING_INTEREST") context += "L'utilisateur doit dire 'je veux gagner' pour continuer. Ne donne aucune instruction avant cela.";
  if (user.state === "WAITING_STEPS_AGREEMENT") context += "L'utilisateur doit accepter de suivre les étapes (inscription + dépôt). Ne passe pas à la suite avant son accord.";
  if (user.state === "REG_SCREENSHOT_PENDING" || user.state === "REG_WAITING_ADMIN") context += "L'utilisateur doit envoyer sa capture d'inscription code FSRAFA. Aide-le UNIQUEMENT sur l'inscription.";
  if (user.state === "DEP_SCREENSHOT_PENDING" || user.state === "DEP_WAITING_ADMIN") context += "L'utilisateur doit faire son dépôt (3000f min) et envoyer la capture. Aide-le UNIQUEMENT sur le dépôt.";
  if (user.is_active) context = "\n[ACCÈS VIP]: L'utilisateur est membre. Tu peux parler de stratégies de jeu.";

  const systemInstruction = `${systemPrompt}
${context}

CONSIGNES STRICTES:
1. RÉPONSE TRÈS COURTE: Maximum 20-30 mots (1 à 2 phrases courtes).
2. RESTE DANS LE CONTEXTE: Si l'utilisateur pose une question hors sujet ou sur une étape future, ramène-le gentiment à l'action requise ci-dessus.
3. TON: Direct, motivant, comme un pote expert. Pas de blabla inutile.`;

  try {
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      model: "google/gemma-4-31b-it",
      messages: [
        { role: "system", content: systemInstruction },
        ...historyEntries.map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: "user", content: userText }
      ]
    }, {
      headers: { 
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.APP_URL || "https://google.com",
        "X-Title": "Telegram Bot Marc"
      }
    });

    return response.data.choices[0].message.content || "Je n'ai pas pu générer de réponse.";
  } catch (err: any) {
    console.error("AI Error:", err.message);
    if (err.response?.data) console.error("Details:", JSON.stringify(err.response.data));
    return "Je rencontre un petit souci technique passager. Repose ta question dans un instant !";
  }
}

bot.on("message", async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  let user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(ctx.from.id.toString()) as any;
  
  if (!user) {
    db.prepare("INSERT OR IGNORE INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)").run(
      ctx.from.id.toString(),
      ctx.from.username || "",
      ctx.from.first_name
    );
    user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(ctx.from.id.toString());
  }

  const text = (ctx.message as any).text;
  const lowText = text?.toLowerCase();
  const isPhoto = !!(ctx.message as any).photo;

  if (text) {
    db.prepare("INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)").run(user.telegram_id, 'user', text);
  }

  // Keywords for progression
  const positiveKws = ["oui", "ok", "d'accord", "je veux gagner", "interesser", "intéressé", "c'est bon", "go", "pret", "prêt"];
  const isPositive = lowText && positiveKws.some(kw => lowText.includes(kw));

  // --- AUTOMATED FLOW LOGIC (Priority to keywords) ---

  // Step 1: Interest -> Show Proofs
  if (user.state === 'WAITING_INTEREST' && isPositive) {
    const stepShow = getStep('show_proofs');
    const p1 = getStep('proof_1');
    const p2 = getStep('proof_2');
    const p3 = getStep('proof_3');
    const askAgree = getStep('ask_agreement');

    if (stepShow && stepShow.is_enabled) await ctx.reply(stepShow.message);
    
    if (p1 && p1.is_enabled && p1.media_url) await safeReplyWithVideo(ctx, user.telegram_id, p1.media_url, { caption: p1.message });
    if (p2 && p2.is_enabled && p2.media_url) await safeReplyWithVideo(ctx, user.telegram_id, p2.media_url, { caption: p2.message });
    if (p3 && p3.is_enabled && p3.media_url) await safeReplyWithVideo(ctx, user.telegram_id, p3.media_url, { caption: p3.message });
    
    if (askAgree && askAgree.is_enabled) {
      if (askAgree.delay_ms) await delay(askAgree.delay_ms);
      await ctx.reply(askAgree.message);
    }
    db.prepare("UPDATE users SET state = 'WAITING_STEPS_AGREEMENT' WHERE telegram_id = ?").run(user.telegram_id);
    return;
  }

  // Step 2: Agreement -> Instructions
  if (user.state === 'WAITING_STEPS_AGREEMENT' && isPositive) {
    const inst = getStep('instructions');
    const rBtn = getStep('reg_btn');
    
    if (inst && inst.is_enabled) await ctx.reply(inst.message);
    
    if (rBtn && rBtn.is_enabled) {
      if (rBtn.delay_ms) await delay(rBtn.delay_ms);
      const msg = await ctx.reply(rBtn.message, Markup.inlineKeyboard([[Markup.button.url(rBtn.btn_text, rBtn.btn_url)]]));
      try { await ctx.telegram.pinChatMessage(ctx.chat.id, msg.message_id); } catch(e) {}
    }
    
    db.prepare("UPDATE users SET state = 'REG_SCREENSHOT_PENDING' WHERE telegram_id = ?").run(user.telegram_id);
    return;
  }

  // Handle Photos (Screenshot uploads)
  if (isPhoto) {
    if (user.state === 'REG_SCREENSHOT_PENDING' || user.state === 'REG_WAITING_ADMIN') {
      const photoArr = (ctx.message as any).photo;
      const fileId = photoArr[photoArr.length - 1].file_id;
      const localUrl = await savePhoto(ctx, fileId);
      db.prepare("UPDATE users SET screenshot_reg_url = ?, state = 'REG_WAITING_ADMIN' WHERE telegram_id = ?").run(localUrl, user.telegram_id);
      await ctx.reply("Merci, je vérifie ton inscription et je reviens vers toi très vite ! ⏳");
      await sendToAdmin(fileId, `Vérification ID`, user.telegram_id, 'REG');
      return;
    }
    if (user.state === 'DEP_SCREENSHOT_PENDING' || user.state === 'DEP_WAITING_ADMIN') {
      const photoArr = (ctx.message as any).photo;
      const fileId = photoArr[photoArr.length - 1].file_id;
      const localUrl = await savePhoto(ctx, fileId);
      db.prepare("UPDATE users SET screenshot_dep_url = ?, state = 'DEP_WAITING_ADMIN' WHERE telegram_id = ?").run(localUrl, user.telegram_id);
      await ctx.reply("Merci, un administrateur valide ton dépôt... ⏳");
      await sendToAdmin(fileId, `Vérification Dépôt`, user.telegram_id, 'DEP');
      return;
    }
  }

  // --- AI FALLBACK (Contextual questions) ---
  if (text) {
    const aiText = await getAIResponse(user, text);
    await ctx.reply(aiText);
    db.prepare("INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)").run(user.telegram_id, 'assistant', aiText);
  }
});


bot.action(/^accept_(REG|DEP)_(.+)$/, async (ctx) => {
  const [, type, userId] = ctx.match;
  if (type === 'REG') {
    db.prepare("UPDATE users SET state = 'DEP_SCREENSHOT_PENDING' WHERE telegram_id = ?").run(userId);
    await bot.telegram.sendMessage(userId, "c'est bon maintenant fait ton premiere depot pour activer ton compte mais minimum 3000f ou 5$ et envoie la capture");
  } else {
    db.prepare("UPDATE users SET state = 'ACTIVE', is_active = 1 WHERE telegram_id = ?").run(userId);
    await bot.telegram.sendMessage(userId, "bro tout est ok voici le lien du bot m.solkah.org");
  }
  await ctx.editMessageCaption(`✅ Validé par admin\nID: ${userId}`);
  await ctx.answerCbQuery("Action validée");
});

bot.action(/^reject_(REG|DEP)_(.+)$/, async (ctx) => {
  const [, type, userId] = ctx.match;
  
  // Réinitialiser l'état pour permettre de renvoyer une photo
  const newState = type === 'REG' ? 'REG_SCREENSHOT_PENDING' : 'DEP_SCREENSHOT_PENDING';
  db.prepare("UPDATE users SET state = ? WHERE telegram_id = ?").run(newState, userId);

  await bot.telegram.sendMessage(userId, "❌ La vérification a échoué. Assure-toi d'avoir utilisé le code promo FSRAFA et que la capture est bien lisible. Tu peux renvoyer la capture dès maintenant.");
  await ctx.editMessageCaption(`❌ Rejeté par admin\nID: ${userId}`);
  await ctx.answerCbQuery("Action rejetée");
});

// Global Bot Error Handler
bot.catch((err: any, ctx) => {
  console.error(`[Telegram Error] Update ${ctx.update.update_id} caused error:`, err);
});

// --- EXPRESS SERVER ---
const app = express();
app.use(express.json());
app.use(cors());

// Serve uploads statically
app.use("/uploads", express.static(UPLOADS_DIR));

// Admin authentication
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: "Mot de passe erroné" });
  }
});

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "No token" });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
};

app.get("/api/admin/stats", authMiddleware, (req, res) => {
  const stats = {
    total: db.prepare("SELECT count(*) as count FROM users").get() as any,
    active: db.prepare("SELECT count(*) as count FROM users WHERE is_active = 1").get() as any,
    pending: db.prepare("SELECT count(*) as count FROM users WHERE state LIKE '%WAITING%'").get() as any
  };
  res.json({
    total: stats.total.count,
    active: stats.active.count,
    pending: stats.pending.count
  });
});

app.get("/api/admin/users", authMiddleware, (req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  res.json(users);
});

app.post("/api/admin/settings", authMiddleware, (req, res) => {
  const { prompt } = req.body;
  db.prepare("UPDATE settings SET value = ? WHERE key = 'system_prompt'").run(prompt);
  res.json({ success: true });
});

app.get("/api/admin/settings", authMiddleware, (req, res) => {
  const prompt = db.prepare("SELECT value FROM settings WHERE key = 'system_prompt'").get();
  res.json(prompt);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", bot_token: !!BOT_TOKEN, admin_id: !!ADMIN_ID });
});

app.delete("/api/admin/users/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM users WHERE telegram_id = ?").run(id);
  res.json({ success: true });
});

app.get("/api/admin/bot-config", authMiddleware, (req, res) => {
  const configs = db.prepare("SELECT * FROM bot_config").all();
  res.json(configs);
});

app.post("/api/admin/bot-config", authMiddleware, (req, res) => {
  const { step_id, message, media_url, delay_ms, btn_text, btn_url, is_enabled } = req.body;
  db.prepare(`
    UPDATE bot_config 
    SET message = ?, media_url = ?, delay_ms = ?, btn_text = ?, btn_url = ?, is_enabled = ?
    WHERE step_id = ?
  `).run(message, media_url, delay_ms, btn_text, btn_url, is_enabled, step_id);
  res.json({ success: true });
});

// Start bot
if (BOT_TOKEN) {
  bot.launch()
    .then(() => console.log("Bot running"))
    .catch(err => {
      console.error("Bot launch failed:", err);
      if (err.message.includes('401')) {
        console.error("Invalid Telegram Bot Token. Please check your credentials.");
      }
    });
} else {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Bot functionalitty is disabled.");
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Admin Panel running on port ${PORT}`);
  });
}

startServer();
