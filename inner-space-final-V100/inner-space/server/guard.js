/**
 * Inner Space — GUARD: what keeps a public server from running up the owner's bills.
 *
 * Everyone shares one Claude key and one ElevenLabs key, so every visitor gets a fair share and no more:
 *  - AI (Talk, Mirror, Shift, Shadow, Deep Session, Warrior, Origin, translate): per person per hour and per day.
 *  - Voice: only NEW lines cost money (every line is kept on disk and replayed free forever), so each person has a
 *    daily allowance of new characters. Lines already made never count.
 *  - Whole server: a daily ceiling for both, so a crowd (or an attack) can never cost more than you chose.
 * "A person" is their IP address (behind Render's proxy: the first address in X-Forwarded-For).
 * Counters live in memory and reset every UTC day; a restart resets them too, which only ever errs on the generous side.
 * Every number is an environment variable, so you can change them in Render without touching code.
 */
const num = (k, d) => { const v = parseInt(process.env[k] || "", 10); return Number.isFinite(v) && v >= 0 ? v : d; };
export const LIMITS = {
  aiPerHour: () => num("LIMIT_AI_PER_HOUR", 30),
  aiPerDay: () => num("LIMIT_AI_PER_DAY", 120),
  aiServerPerDay: () => num("LIMIT_AI_SERVER_PER_DAY", 3000),
  voiceCharsPerDay: () => num("LIMIT_VOICE_CHARS_PER_DAY", 15000),
  voiceServerCharsPerDay: () => num("LIMIT_VOICE_SERVER_CHARS_PER_DAY", 200000)
};

export function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = xf || req.socket.remoteAddress || "?";
  return ip.replace(/^::ffff:/, "");
}

let day = "", people = new Map(), server = { ai: 0, voice: 0 };
function roll() { const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; people = new Map(); server = { ai: 0, voice: 0 }; } }
function who(ip) { roll(); let p = people.get(ip); if (!p) { p = { ai: [], aiDay: 0, voice: 0 }; people.set(ip, p); if (people.size > 50000) people.clear(); } return p; }

/** one AI request: true if allowed (and counted), or a reason */
export function takeAi(ip) {
  const p = who(ip); const now = Date.now(); p.ai = p.ai.filter(t => now - t < 3600e3);
  if (server.ai >= LIMITS.aiServerPerDay()) return { ok: false, why: "server-day" };
  if (p.aiDay >= LIMITS.aiPerDay()) return { ok: false, why: "day" };
  if (p.ai.length >= LIMITS.aiPerHour()) return { ok: false, why: "hour" };
  p.ai.push(now); p.aiDay++; server.ai++; return { ok: true };
}
/** may this person spend n NEW voice characters? (does not count them) */
export function canVoice(ip, n) {
  const p = who(ip);
  if (server.voice + n > LIMITS.voiceServerCharsPerDay()) return { ok: false, why: "server-day" };
  if (p.voice + n > LIMITS.voiceCharsPerDay()) return { ok: false, why: "day" };
  return { ok: true };
}
export function spendVoice(ip, n) { const p = who(ip); p.voice += n; server.voice += n; }
export function guardInfo() { roll(); return { day, people: people.size, ai: server.ai, voiceChars: server.voice, limits: Object.fromEntries(Object.entries(LIMITS).map(([k, f]) => [k, f()])) }; }

/** the owner's routes (voice list, account usage, model test): only from the PC itself, or with ADMIN_TOKEN */
export function isAdmin(req, local) {
  if (local) return true;
  const t = (process.env.ADMIN_TOKEN || "").trim();
  return !!t && t.length >= 16 && String(req.headers["x-admin-token"] || "") === t;
}
