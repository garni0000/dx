import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import { Telegraf, Markup, Context } from "telegraf";
import mongoose from "mongoose";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/telegram_bot";
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

// --- MONGODB SETUP ---
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const UserSchema = new mongoose.Schema({
  telegram_id: { type: String, unique: true, required: true },
  username: String,
  first_name: String,
  state: { type: String, default: 'START' },
  uid_1xbet: String,
  screenshot_reg_url: String,
  screenshot_dep_url: String,
  created_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: false }
});

const MessageSchema = new mongoose.Schema({
  user_id: String,
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const SettingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: String
});

const BotConfigSchema = new mongoose.Schema({
  step_id: { type: String, unique: true },
  message: String,
  media_url: String,
  delay_ms: Number,
  btn_text: String,
  btn_url: String,
  is_enabled: { type: Boolean, default: true }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);
const Setting = mongoose.model('Setting', SettingSchema);
const BotConfig = mongoose.model('BotConfig', BotConfigSchema);

// Initial system prompt
async function initDb() {
  const defaultPrompt = "Tu es Marc, un assistant expert en stratégies de jeux (notamment Apple of Fortune). Ton ton est amical, professionnel et encourageant. Tu parles comme un humain réel. Ton objectif est d'aider l'utilisateur à gagner en utilisant le bot VIP.";
  const existing = await Setting.findOne({ key: 'system_prompt' });
  if (!existing) {
    await Setting.create({ key: 'system_prompt', value: defaultPrompt });
  }

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
    const exists = await BotConfig.findOne({ step_id: s.id });
    if (!exists) {
      await BotConfig.create({
        step_id: s.id,
        message: s.msg,
        media_url: s.media || null,
        delay_ms: s.delay,
        btn_text: s.btn_text || null,
        btn_url: s.btn_url || null,
        is_enabled: true
      });
    }
  }
}
initDb();

// --- BOT TELEGRAM ---
const bot = new Telegraf(BOT_TOKEN);

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
  if (!ADMIN_ID) return;
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
  } catch (err: any) {
    console.error(`[ADMIN] Send photo error:`, err.message);
    try { await bot.telegram.sendMessage(ADMIN_ID, `⚠️ Échec envoi photo user ${userId} (${step}).\n${caption}`); } catch (e) {}
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function safeReplyWithVideo(ctx: Context, userId: string, mediaUrl: string, options: any) {
  if (!mediaUrl) return;
  try {
    if (ctx) await ctx.replyWithVideo(mediaUrl, options);
    else await bot.telegram.sendVideo(userId, mediaUrl, options);
  } catch (err: any) {
    console.error(`[Telegram] Video failure (${mediaUrl}):`, err.message);
    const caption = options.caption || "";
    const msg = caption ? `${caption}\n\n🎥 Regarder la vidéo : ${mediaUrl}` : `🎥 Regarder la vidéo : ${mediaUrl}`;
    if (ctx) await ctx.reply(msg, { reply_markup: options.reply_markup });
    else await bot.telegram.sendMessage(userId, msg, { reply_markup: options.reply_markup });
  }
}

bot.on("video", (ctx) => {
  if (ctx.from.id.toString() === ADMIN_ID) {
    const fileId = ctx.message.video.file_id;
    ctx.reply(`✅ Vidéo reçue !\n\nFile ID:\n\n\`${fileId}\``);
  }
});

async function startFunnel(userId: string, user: any) {
  const welcome = await BotConfig.findOne({ step_id: 'welcome' });
  const welcomeVideo = await BotConfig.findOne({ step_id: 'welcome_video' });
  const askInterest = await BotConfig.findOne({ step_id: 'ask_interest' });

  if (welcome && welcome.is_enabled) {
    await bot.telegram.sendMessage(userId, welcome.message.replace("{name}", user.first_name || "l'ami"));
  }
  if (welcomeVideo && welcomeVideo.is_enabled) {
    if (welcomeVideo.delay_ms) await delay(welcomeVideo.delay_ms);
    await safeReplyWithVideo(null as any, userId, welcomeVideo.media_url!, {
      caption: welcomeVideo.message,
      reply_markup: Markup.inlineKeyboard([[Markup.button.url(welcomeVideo.btn_text!, welcomeVideo.btn_url!)]]).reply_markup
    });
  }
  if (askInterest && askInterest.is_enabled) {
    if (askInterest.delay_ms) await delay(askInterest.delay_ms);
    await bot.telegram.sendMessage(userId, askInterest.message!);
  }
  await User.updateOne({ telegram_id: userId }, { state: 'WAITING_INTEREST' });
}

// Join Request
bot.on("chat_join_request", async (ctx) => {
  const userId = ctx.chatJoinRequest.from.id.toString();
  await delay(10000);
  let user = await User.findOne({ telegram_id: userId });
  if (!user) {
    user = await User.create({
      telegram_id: userId,
      first_name: ctx.chatJoinRequest.from.first_name,
      username: ctx.chatJoinRequest.from.username,
      state: 'START'
    });
  }
  await startFunnel(userId, user);
});

bot.command("start", async (ctx) => {
  const userId = ctx.from.id.toString();
  let user = await User.findOne({ telegram_id: userId });
  if (!user) {
    user = await User.create({
      telegram_id: userId,
      first_name: ctx.from.first_name,
      username: ctx.from.username,
      state: 'START'
    });
  }
  await startFunnel(userId, user);
});

async function getAIResponse(user: any, userText: string) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes("YOUR_")) return "IA non configurée.";
  
  const history = await Message.find({ user_id: user.telegram_id }).sort({ timestamp: -1 }).limit(10);
  const historyEntries = history.reverse();
  const sysSetting = await Setting.findOne({ key: 'system_prompt' });
  const systemPrompt = sysSetting?.value || "";

  let context = `\n[ACTION REQUISE]: `;
  if (user.state === "WAITING_INTEREST") context += "Doit dire 'je veux gagner'.";
  else if (user.state === "WAITING_STEPS_AGREEMENT") context += "Doit accepter les étapes.";
  else if (user.state.includes("REG")) context += "Doit envoyer capture inscription FSRAFA.";
  else if (user.state.includes("DEP")) context += "Doit envoyer capture depot.";
  else if (user.is_active) context = "\n[ACCÈS VIP].";

  try {
    const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      model: "google/gemma-2-9b-it",
      messages: [
        { role: "system", content: `${systemPrompt}${context}\n\nCOURT (20 mots max). Direct.` },
        ...historyEntries.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: userText }
      ]
    }, { headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}` } });
    return res.data.choices[0].message.content;
  } catch { return "Service indisponible."; }
}

bot.on("message", async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  const userId = ctx.from.id.toString();
  let user = await User.findOne({ telegram_id: userId });
  if (!user) user = await User.create({ telegram_id: userId, first_name: ctx.from.first_name, username: ctx.from.username });

  const text = (ctx.message as any).text;
  const isPhoto = !!(ctx.message as any).photo;

  if (text) await Message.create({ user_id: userId, role: 'user', content: text });

  const lowText = text?.toLowerCase() || "";
  const positiveKws = ["oui", "ok", "d'accord", "je veux gagner", "interesser", "go", "pret"];
  const isPositive = positiveKws.some(kw => lowText.includes(kw));

  if (user.state === 'WAITING_INTEREST' && isPositive) {
    const steps = await BotConfig.find({ step_id: { $in: ['show_proofs', 'proof_1', 'proof_2', 'proof_3', 'ask_agreement'] } });
    const getS = (id: string) => steps.find(s => s.step_id === id);
    
    const show = getS('show_proofs');
    if (show?.is_enabled) await ctx.reply(show.message!);
    
    for (const pId of ['proof_1', 'proof_2', 'proof_3']) {
      const p = getS(pId);
      if (p?.is_enabled && p.media_url) await safeReplyWithVideo(ctx, userId, p.media_url, { caption: p.message });
    }
    const agree = getS('ask_agreement');
    if (agree?.is_enabled) {
      if (agree.delay_ms) await delay(agree.delay_ms);
      await ctx.reply(agree.message!);
    }
    await User.updateOne({ telegram_id: userId }, { state: 'WAITING_STEPS_AGREEMENT' });
    return;
  }

  if (user.state === 'WAITING_STEPS_AGREEMENT' && isPositive) {
    const inst = await BotConfig.findOne({ step_id: 'instructions' });
    const rBtn = await BotConfig.findOne({ step_id: 'reg_btn' });
    if (inst?.is_enabled) await ctx.reply(inst.message!);
    if (rBtn?.is_enabled) {
      if (rBtn.delay_ms) await delay(rBtn.delay_ms);
      const msg = await ctx.reply(rBtn.message!, Markup.inlineKeyboard([[Markup.button.url(rBtn.btn_text!, rBtn.btn_url!)]]));
      try { await ctx.telegram.pinChatMessage(ctx.chat.id, msg.message_id); } catch(e) {}
    }
    await User.updateOne({ telegram_id: userId }, { state: 'REG_SCREENSHOT_PENDING' });
    return;
  }

  if (isPhoto) {
    const photoArr = (ctx.message as any).photo;
    const fileId = photoArr[photoArr.length - 1].file_id;
    const localUrl = await savePhoto(ctx, fileId);
    if (user.state.includes('REG')) {
      await User.updateOne({ telegram_id: userId }, { screenshot_reg_url: localUrl, state: 'REG_WAITING_ADMIN' });
      await ctx.reply("Vérification en cours... ⏳");
      await sendToAdmin(fileId, `Vérification ID`, userId, 'REG');
    } else if (user.state.includes('DEP')) {
      await User.updateOne({ telegram_id: userId }, { screenshot_dep_url: localUrl, state: 'DEP_WAITING_ADMIN' });
      await ctx.reply("Validation dépôt en cours... ⏳");
      await sendToAdmin(fileId, `Vérification Dépôt`, userId, 'DEP');
    }
    return;
  }

  if (text) {
    const aiText = await getAIResponse(user, text);
    await ctx.reply(aiText);
    await Message.create({ user_id: userId, role: 'assistant', content: aiText });
  }
});

bot.action(/^accept_(REG|DEP)_(.+)$/, async (ctx) => {
  const [, type, userId] = ctx.match;
  if (type === 'REG') {
    await User.updateOne({ telegram_id: userId }, { state: 'DEP_SCREENSHOT_PENDING' });
    await bot.telegram.sendMessage(userId, "c'est bon maintenant fait ton premiere depot (min 3000f) et envoie la capture");
  } else {
    await User.updateOne({ telegram_id: userId }, { state: 'ACTIVE', is_active: true });
    await bot.telegram.sendMessage(userId, "bro tout est ok voici le lien du bot m.solkah.org");
  }
  await ctx.editMessageCaption(`✅ Validé\nID: ${userId}`);
  await ctx.answerCbQuery("Validé");
});

bot.action(/^reject_(REG|DEP)_(.+)$/, async (ctx) => {
  const [, type, userId] = ctx.match;
  const newState = type === 'REG' ? 'REG_SCREENSHOT_PENDING' : 'DEP_SCREENSHOT_PENDING';
  await User.updateOne({ telegram_id: userId }, { state: newState });
  await bot.telegram.sendMessage(userId, "❌ Rejeté. Utilise le code promo FSRAFA et renvoie une capture lisible.");
  await ctx.editMessageCaption(`❌ Rejeté\nID: ${userId}`);
  await ctx.answerCbQuery("Rejeté");
});

bot.catch(err => console.error("[Bot Error]", err));

// --- EXPRESS SERVER ---
const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(UPLOADS_DIR));

app.post("/api/admin/login", (req, res) => {
  if (bcrypt.compareSync(req.body.password, ADMIN_PASSWORD_HASH)) {
    res.json({ token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' }) });
  } else res.status(401).json({ error: "Erreur" });
});

const authMiddleware = (req: any, res: any, next: any) => {
  try {
    jwt.verify(req.headers.authorization?.split(" ")[1] || "", JWT_SECRET);
    next();
  } catch { res.status(403).json({ error: "Invalid" }); }
};

app.get("/api/admin/stats", authMiddleware, async (req, res) => {
  const total = await User.countDocuments();
  const active = await User.countDocuments({ is_active: true });
  const pending = await User.countDocuments({ state: /WAITING/ });
  res.json({ total, active, pending });
});

app.get("/api/admin/users", authMiddleware, async (req, res) => {
  res.json(await User.find().sort({ created_at: -1 }));
});

app.post("/api/admin/settings", authMiddleware, async (req, res) => {
  await Setting.updateOne({ key: 'system_prompt' }, { value: req.body.prompt }, { upsert: true });
  res.json({ success: true });
});

app.get("/api/admin/settings", authMiddleware, async (req, res) => {
  res.json(await Setting.findOne({ key: 'system_prompt' }));
});

app.delete("/api/admin/users/:id", authMiddleware, async (req, res) => {
  await User.deleteOne({ telegram_id: req.params.id });
  res.json({ success: true });
});

app.get("/api/admin/bot-config", authMiddleware, async (req, res) => {
  res.json(await BotConfig.find());
});

app.post("/api/admin/bot-config", authMiddleware, async (req, res) => {
  const { step_id, ...updates } = req.body;
  await BotConfig.updateOne({ step_id }, { $set: updates }, { upsert: true });
  res.json({ success: true });
});

app.get("/keep-alive", (req, res) => res.status(200).send("I'm alive! 🚀"));

app.post("/api/admin/broadcast", authMiddleware, async (req, res) => {
  const { type, content, media_url, btn_text, btn_url } = req.body;
  const users = await User.find({}, 'telegram_id');
  
  if (!users.length) return res.status(400).json({ error: "Aucun utilisateur trouvé" });

  let successCount = 0;
  let failCount = 0;

  const extra = btn_text && btn_url 
    ? Markup.inlineKeyboard([[Markup.button.url(btn_text, btn_url)]])
    : undefined;

  for (const user of users) {
    try {
      if (type === 'text') {
        await bot.telegram.sendMessage(user.telegram_id, content || "", extra);
      } else if (type === 'photo') {
        await bot.telegram.sendPhoto(user.telegram_id, media_url, { caption: content, ...extra });
      } else if (type === 'video') {
        await bot.telegram.sendVideo(user.telegram_id, media_url, { caption: content, ...extra });
      } else if (type === 'audio') {
        await bot.telegram.sendVoice(user.telegram_id, media_url, { caption: content, ...extra });
      }
      successCount++;
    } catch (err) {
      console.error(`[Broadcast] Error for user ${user.telegram_id}:`, err);
      failCount++;
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 50));
  }

  res.json({ success: true, successCount, failCount });
});

app.get("/api/health", (req, res) => res.json({ status: "ok", bot: !!BOT_TOKEN }));

if (BOT_TOKEN) bot.launch().then(() => console.log("Bot running")).catch(e => console.error("Bot fail", e));

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server port ${PORT}`));
}
startServer();
