/**
 * Inner Space — VOICE: server-side text-to-speech. The key lives only in .env.
 * synthesizeVoice(text, profile, { voiceId }) → { audio: Buffer, mime, cached } | { unavailable: true, reason } | { error, status, reason }
 * Provider: ElevenLabs when ELEVENLABS_API_KEY is set. Otherwise the browser falls back to its device voice.
 *
 * Every generated line is cached on disk (server/cache/voice/<hash>.mp3), so a line is billed ONCE and then free forever.
 * The chosen voice is saved in server/voice-config.json by the dev panel ("Use this voice"), or set in .env.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "cache", "voice");
const CONFIG_FILE = path.join(__dirname, "voice-config.json");

const KEY = () => process.env.ELEVENLABS_API_KEY || "";
const BASE = () => (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/$/, "");
const MODEL = () => process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";   // ElevenLabs' stock "Rachel", so a fresh key works out of the box

/* ---- the chosen voice(s): voice-config.json > .env > default ---- */
let CONFIG = null;
function config() { if (CONFIG) return CONFIG; try { CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch { CONFIG = {}; } if (!CONFIG.profiles) CONFIG.profiles = {}; return CONFIG; }
export function saveVoiceChoice(voiceId, profile = "all", name = "") {
  const c = config(); if (profile === "all") { c.voiceId = voiceId; c.voiceName = name; c.profiles = {}; } else c.profiles[profile] = { voiceId, name };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); return c;
}
const ENV_PROFILE = { orb: "ELEVENLABS_VOICE_ORB", warrior: "ELEVENLABS_VOICE_WARRIOR", "deep-session": "ELEVENLABS_VOICE_DEEP", "deep-2": "ELEVENLABS_VOICE_DEEP2", shadow: "ELEVENLABS_VOICE_SHADOW", adept: "ELEVENLABS_VOICE_ADEPT", night: "ELEVENLABS_VOICE_NIGHT", talk: "ELEVENLABS_VOICE_TALK" };
export const PROFILE_NAMES = Object.keys(ENV_PROFILE);
export function voiceFor(profile) {
  const c = config(); const p = PROFILE_NAMES.includes(profile) ? profile : "orb";
  return (c.profiles[p] && c.profiles[p].voiceId) || (p !== "deep-2" ? c.voiceId : null) || process.env[ENV_PROFILE[p]] || (p !== "deep-2" ? process.env.ELEVENLABS_VOICE_ID : null) || (p !== "deep-2" ? DEFAULT_VOICE : voiceFor("deep-session"));
}
export function secondVoice() { const c = config(); const p = c.profiles["deep-2"]; if (p && p.voiceId) return { id: p.voiceId, name: p.name || "Second voice" }; if (process.env.ELEVENLABS_VOICE_DEEP2) return { id: process.env.ELEVENLABS_VOICE_DEEP2, name: "Second voice" }; return null; }
export function voiceInfo() { const c = config(); return { configured: !!KEY(), model: MODEL(), voiceId: KEY() ? voiceFor("orb") : null, voiceName: c.voiceName || (c.voiceId ? "" : "Rachel (default)"), second: KEY() ? secondVoice() : null, profiles: c.profiles, cached: cacheCount() }; }

/* calm, steady settings — a guide, not a presenter */
const SETTINGS = {
  orb: { stability: 0.55, similarity_boost: 0.8, style: 0.2 }, warrior: { stability: 0.6, similarity_boost: 0.85, style: 0.35 },
  "deep-session": { stability: 0.78, similarity_boost: 0.8, style: 0.08, speed: 0.90 }, "deep-2": { stability: 0.75, similarity_boost: 0.8, style: 0.15 }, shadow: { stability: 0.8, similarity_boost: 0.8, style: 0.1 },
  adept: { stability: 0.7, similarity_boost: 0.8, style: 0.15 }, night: { stability: 0.85, similarity_boost: 0.8, style: 0.05 }, talk: { stability: 0.5, similarity_boost: 0.8, style: 0.3 }
};

/* ---- the cache ---- */
function cacheCount() { try { return fs.readdirSync(CACHE_DIR).filter(f => f.endsWith(".mp3")).length; } catch { return 0; } }
function cachePath(voiceId, text, profile) { const settingsVersion = profile === "deep-session" ? "meditate-speed-090-v1" : "base"; const h = crypto.createHash("sha1").update(`${voiceId}|${MODEL()}|${profile}|${settingsVersion}|${text}`).digest("hex"); return path.join(CACHE_DIR, h + ".mp3"); }
export function clearVoiceCache() { let n = 0; try { for (const f of fs.readdirSync(CACHE_DIR)) if (f.endsWith(".mp3")) { fs.unlinkSync(path.join(CACHE_DIR, f)); n++; } } catch {} return n; }

export function voiceConfigured() { return !!KEY(); }

export async function synthesizeVoice(text, profile = "orb", { timeoutMs = 45000, voiceId = null, noCache = false } = {}) {
  if (!KEY()) return { unavailable: true, reason: "ELEVENLABS_API_KEY is not configured (server/.env)" };
  const p = PROFILE_NAMES.includes(profile) ? profile : "orb";
  const vid = voiceId || voiceFor(p);
  const file = cachePath(vid, text, p);
  if (!noCache) { try { const audio = fs.readFileSync(file); return { audio, mime: "audio/mpeg", cached: true }; } catch {} }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE()}/v1/text-to-speech/${vid}?output_format=mp3_44100_128`, {
      method: "POST", signal: controller.signal,
      headers: { "xi-api-key": KEY(), "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL(), voice_settings: SETTINGS[p] })
    });
    if (!r.ok) { const body = await r.text().catch(() => ""); return { error: true, status: 502, reason: `ElevenLabs ${r.status}: ${body.replace(/xi-api-key[^,}]*/gi, "***").slice(0, 200)}` }; }
    const audio = Buffer.from(await r.arrayBuffer());
    if (!noCache) { try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(file, audio); } catch {} }
    return { audio, mime: "audio/mpeg", cached: false };
  } catch (err) { return { error: true, status: err.name === "AbortError" ? 504 : 502, reason: err.name === "AbortError" ? "Timeout: no audio from ElevenLabs" : `Network/error (${err.name})` }; }
  finally { clearTimeout(timer); }
}

/* ---- the account: its voices and how many characters are left this month ---- */
async function xi(pathname) {
  const r = await fetch(`${BASE()}${pathname}`, { headers: { "xi-api-key": KEY() }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) { const body = await r.text().catch(() => ""); throw new Error(`ElevenLabs ${r.status}: ${body.slice(0, 160)}`); }
  return r.json();
}
let VOICES = { at: 0, list: null };
export async function listVoices() {
  if (!KEY()) return { unavailable: true, reason: "ELEVENLABS_API_KEY is not configured (server/.env)" };
  if (VOICES.list && Date.now() - VOICES.at < 120000) return { voices: VOICES.list };
  try { const j = await xi("/v1/voices"); const list = (j.voices || []).map(v => ({ id: v.voice_id, name: v.name, category: v.category || "", labels: v.labels || {}, preview: v.preview_url || "" })); VOICES = { at: Date.now(), list }; return { voices: list }; }
  catch (err) { return { error: true, reason: err.message }; }
}
export async function voiceUsage() {
  if (!KEY()) return { unavailable: true };
  try { const j = await xi("/v1/user/subscription"); return { tier: j.tier, used: j.character_count, limit: j.character_limit, resetsAt: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : null }; }
  catch (err) { return { error: true, reason: err.message }; }
}

/* ---- the easy way: ELEVENLABS_VOICE_NAME=<name in My Voices> in .env → found and chosen at start-up.
   Applied once per name, so a later choice in the DEV panel is kept until the name in .env changes. ---- */
export async function resolveNamedVoice() {
  const name = (process.env.ELEVENLABS_VOICE_NAME || "").trim(); if (!KEY()) return { status: "no-key" };
  if (!name) { const c = config(); return { status: "default", name: c.voiceName || "Rachel (default)" }; }
  const c = config(); if (c.envName && c.envName.toLowerCase() === name.toLowerCase()) return { status: "kept", name: c.voiceName };
  const r = await listVoices(); if (!r.voices) return { status: "error", reason: r.reason };
  const low = name.toLowerCase(); const v = r.voices.find(x => x.name.toLowerCase() === low) || r.voices.find(x => x.name.toLowerCase().includes(low));
  if (!v) return { status: "not-found", name, available: r.voices.map(x => x.name) };
  saveVoiceChoice(v.id, "all", v.name); CONFIG.envName = name; fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2)); return { status: "chosen", name: v.name };
}
