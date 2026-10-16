/**
 * Inner Space — prototype server (V3.5.1 — no fake AI; health + model test; honest error logging)
 * - Serves inner-space.html and static files from ../ (the folder above /server)
 * - POST /api/orchestrate → the ONE decision-maker for every conversational turn.
 *   The API key lives only in the environment; the browser never sees it.
 * Node 18+, no dependencies.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIRROR_SYSTEM, buildMirrorMessage, validateMirror, validateRevise, validateDeeper, cleanPiece, cleanPieces, DECISION_SYSTEM, buildDecisionMessage, validateDecisionRoom, validateRetest, cleanMapItems } from "./mirror.js";
import { WARRIOR_SYSTEM, buildWarriorMessage, validateTrain, validateMove, validateWarriorTalk, cleanHistory as cleanWarriorHistory, MEDICAL, CAUTION_REPLY } from "./guides.js";
import { deepSystem, buildDeepMessage, validateDeepSession, METHODS, LENGTHS } from "./deep-session.js";
import { translateMany, TR_LANGS } from "./translate.js";
import { TALK_SYSTEM, buildTalkMessage, validateTalk } from "./talk.js";
import { SHADOW_SYSTEM, buildShadowMessage, validateShadow } from "./shadow.js";
import { synthesizeVoice, voiceConfigured, voiceInfo, listVoices, voiceUsage, saveVoiceChoice, clearVoiceCache, PROFILE_NAMES, resolveNamedVoice } from "./voice.js";
import { ORCHESTRATOR_SYSTEM, buildOrchestratorMessage, buildMeaningfulContext, resolveSafety, normalizeText, SAFETY_FALLBACK, validateDecision, cleanHistory } from "./orchestrator.js";
import { SHIFT_SYSTEM, SHIFT_KINDS, buildShiftMessage, validateShift } from "./shift.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname, process.env.STATIC_ROOT || "..");
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.REFLECTION_MODEL || "claude-sonnet-5-5";
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
const UPSTREAM_TIMEOUT_MS = Number(process.env.REFLECTION_TIMEOUT_MS || 30000);   // development: 30s — a slow answer is not a failure

const MAX_TEXT = 4000;
const FEELINGS = new Set(["I feel lost","I need clarity","I need confidence","I need to let something go","I’m overwhelmed","I want to understand myself better","I’m exploring spirituality","Something else"]);
const MODES = new Set(["guide","talk","shift"]);

http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/orchestrate") return await handleOrchestrate(req, res);
    if (req.method === "POST" && req.url === "/api/safety") return await handleSafety(req, res);
    if (req.method === "POST" && req.url === "/api/shift") return await handleShift(req, res);
    if (req.method === "POST" && req.url === "/api/mirror") return await handleMirror(req, res);
    if (req.method === "POST" && req.url === "/api/guide/warrior") return await handleWarrior(req, res);
    if (req.method === "POST" && req.url === "/api/deep-session") return await handleDeepSession(req, res);
    if (req.method === "POST" && req.url === "/api/talk") return await handleTalk(req, res);
    if (req.method === "POST" && req.url === "/api/shadow") return await handleShadow(req, res);
    if (req.method === "POST" && req.url === "/api/translate") return await handleTranslate(req, res);
    if (req.method === "POST" && req.url === "/api/voice") return await handleVoice(req, res);
    if (req.method === "GET" && req.url === "/api/voice/status") return await handleVoiceStatus(res);
    if (req.method === "POST" && req.url === "/api/voice/select") return await handleVoiceSelect(req, res);
    if (req.method === "POST" && req.url === "/api/voice/clear-cache") { if (!studioLocal(req)) return send(res, 403, { error: "Local only" }); return send(res, 200, { cleared: clearVoiceCache() }); }
    if (req.method === "POST" && req.url.startsWith("/api/studio/save")) return await handleStudioSave(req, res);
    if (req.method === "GET" && req.url === "/api/studio/list") return handleStudioList(res);
    if (req.method === "POST" && req.url.startsWith("/api/studio/delete")) return handleStudioDelete(req, res);
    if (req.method === "GET" && req.url === "/api/health") return send(res, 200, { server: "ok", apiKeyConfigured: !!API_KEY, voiceConfigured: voiceConfigured(), voice: voiceInfo(), model: MODEL, timeoutMs: UPSTREAM_TIMEOUT_MS });
    if (req.method === "POST" && req.url === "/api/test-model") return await handleTestModel(res);
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
    return send(res, 405, { error: "Method not allowed" });
  } catch (err) { console.error(err); return send(res, 500, { error: "Server error" }); }
}).listen(PORT, () => {
  console.log(`Inner Space → http://localhost:${PORT}`);
  console.log(API_KEY ? `Model: ${MODEL}` : "WARNING: ANTHROPIC_API_KEY not set — /api/orchestrate returns 503 and the page uses its local fallback.");
  resolveNamedVoice().then(r => {
    if (r.status === "no-key") return console.log("Voice: device voice (no ElevenLabs key)");
    if (r.status === "chosen" || r.status === "kept" || r.status === "default") return console.log(`Voice: ElevenLabs · ${r.name}`);
    if (r.status === "not-found") return console.log(`Voice: could not find "${r.name}" in your ElevenLabs voices. You have: ${r.available.join(", ") || "none"}.\n       Run SET-VOICE.bat and type one of those names.`);
    console.log(`Voice: ElevenLabs problem — ${r.reason}. Check the key with SET-VOICE.bat.`);
  }).catch(() => {});
});

/* ---------------- /api/safety + /api/shift ---------------- */
async function handleSafety(req, res) {
  const body = await readJson(req, 16 * 1024);
  if (!body) return send(res, 400, { error: "Invalid JSON" });
  const text = normalizeText(clip(body.text));
  if (!text) return send(res, 400, { error: "text is required" });
  const previousSafety = ["none","check","urgent","crisis"].includes(body.safetyState) ? body.safetyState : "none";
  const safety = resolveSafety(previousSafety, text);
  return send(res, 200, { safety, reply: safety === "none" ? null : SAFETY_FALLBACK[safety], source: "server-safety" });
}

async function handleShift(req, res) {
  const body = await readJson(req, 32 * 1024);
  if (!body) return send(res, 400, { error: "Invalid JSON" });
  const kind = typeof body.kind === "string" && SHIFT_KINDS.has(body.kind) ? body.kind : null;
  if (!kind) return send(res, 400, { error: "Unsupported shift kind" });

  const previousSafety = ["none","check","urgent","crisis"].includes(body.safetyState) ? body.safetyState : "none";
  const safetyText = normalizeText([body.task, body.progress, body.blocker, body.text, body.answer].filter(v => typeof v === "string").join(" \n "));
  if (safetyText) {
    const safety = resolveSafety(previousSafety, safetyText);
    if (safety !== "none") return plainSafety(res, kind, safety);
  }
  if (!modelGate(res)) return;

  const clean = {
    kind,
    lang: ["en","ar","es","hy"].includes(body.lang) ? body.lang : "en",
    task: clip(body.task), progress: clip(body.progress), blocker: clip(body.blocker),
    text: clip(body.text), answer: clip(body.answer), subtype: typeof body.subtype === "string" ? body.subtype.slice(0, 32) : "unknown",
  };
  const r = await askModel({ system: SHIFT_SYSTEM, user: buildShiftMessage(kind, clean), maxTokens: kind === "focus_target" ? 260 : 220 });
  if (r.error) return send(res, r.status, { error: "Shift unavailable", reason: r.reason });
  const out = validateShift(kind, parseJsonLoose(r.text), clean);
  if (!out) {
    console.error(`[shift] unusable ${kind}: ${sanitize(r.text).slice(0, 160)}`);
    return send(res, 502, { error: "Shift unavailable", reason: `The model did not return a usable ${kind}.` });
  }
  console.log(`[shift] ${kind}`);
  return send(res, 200, Object.assign({ kind, safety: "none", source: "model" }, out));
}

/* ---------------- /api/orchestrate ---------------- */
async function handleOrchestrate(req, res) {
  const body = await readJson(req, 64 * 1024);
  if (!body) return send(res, 400, { error: "Invalid JSON" });
  const latestUserMessage = normalizeText(clip(body.latestUserMessage));
  if (!latestUserMessage) return send(res, 400, { error: "latestUserMessage is required" });
  const previousSafety = ["none","check","urgent","crisis"].includes(body.safetyState) ? body.safetyState : "none";
  const reflectionResponse = ["yes","partly","not_really"].includes(body.reflectionResponse) ? body.reflectionResponse : null;
  const reflectionAge = Number.isFinite(body.reflectionAge) ? body.reflectionAge : null;
  const guide = ["female", "male"].includes(body.guide) ? body.guide : "female";   // presentation only; never separate state
  const mode = MODES.has(body.mode) ? body.mode : null;
  const feeling = FEELINGS.has(body.feeling) ? body.feeling : null;
  const history = cleanHistory(body.history, latestUserMessage);
  const currentUnderstanding = clip(body.currentUnderstanding) || null;
  const confirmedReflection = clip(body.confirmedReflection) || null;
  const activePractice = body.activePractice && typeof body.activePractice === "object" && typeof body.activePractice.id === "string"
    ? { id: body.activePractice.id.slice(0, 60), completed: !!body.activePractice.completed, turnsSinceCompleted: Number.isFinite(body.activePractice.turnsSinceCompleted) ? body.activePractice.turnsSinceCompleted : null, answers: Array.isArray(body.activePractice.answers) ? body.activePractice.answers.filter(a => typeof a === "string").map(a => a.slice(0, 300)).slice(0, 6) : [] }
    : null;

  // 1. Safety first — before any psychology. Deterministic escalation after a "check".
  const safetyFlag = resolveSafety(previousSafety, latestUserMessage);
  if (safetyFlag === "urgent" || (safetyFlag === "crisis" && previousSafety === "check")) {
    console.log(`[orchestrate] safety escalation ${previousSafety} → ${safetyFlag} (deterministic)`);
    return send(res, 200, deterministicSafety(safetyFlag));
  }
  // 2. Meaningful context — not concatenation.
  const meaningful = buildMeaningfulContext(history);

  if (!API_KEY) {
    if (safetyFlag !== "none") return send(res, 200, deterministicSafety(safetyFlag));
    console.error("[anthropic] FAILED: ANTHROPIC_API_KEY not configured (server/.env)");
    return send(res, 503, { error: "Orchestrator not configured", reason: "ANTHROPIC_API_KEY is not configured (server/.env)" });
  }
  // 3. One model call.
  const r = await askModel({ system: ORCHESTRATOR_SYSTEM, user: buildOrchestratorMessage({ mode, feeling, history, meaningful, latestUserMessage, currentUnderstanding, confirmedReflection, reflectionAge, activePractice, reflectionResponse, safetyFlag, guide }), maxTokens: 900 });
  if (r.error) {
    if (safetyFlag !== "none") return send(res, 200, deterministicSafety(safetyFlag));   // deterministic safety is the ONLY thing allowed to answer without the model
    return send(res, r.status, { error: "Orchestrator unavailable", reason: r.reason });
  }
  // 4. Validate.
  const decision = validateDecision(parseJsonLoose(r.text), safetyFlag);
  if (!decision) {
    console.error("orchestrate: unusable model output:", r.text.slice(0, 300));
    if (safetyFlag !== "none") return send(res, 200, deterministicSafety(safetyFlag));
    return send(res, 502, { error: "Orchestrator returned invalid JSON" });
  }
  // Deterministic guarantees on top of the model's answer:
  if (reflectionResponse === "partly" || reflectionResponse === "not_really") decision.clearUnderstanding = true;
  console.log(`[orchestrate] ${decision.action}${decision.safety !== "none" ? " safety=" + decision.safety : ""}${decision.practice ? " practice=" + decision.practice.id : ""}`);
  // Echo the context as it stands AFTER this message, for inspection (the model itself received the latest message separately).
  const echoed = buildMeaningfulContext([...history, { role: "user", text: latestUserMessage }]).filter(m => !m.superseded).map(m => m.text);
  return send(res, 200, { ...decision, meaningfulContext: echoed, source: "api", model: MODEL });
}

/* Development: prove the configured model actually answers. Never returns the key. */
/* ---------------- /api/mirror (V4 prototype) ----------------
   Same safety gate as the conversation, then one model call that must return strict JSON.
   The conversation orchestrator is not involved. */
const MIRROR_KINDS = new Set(["mirror", "revise", "deeper", "update", "decision", "retest"]);
async function handleMirror(req, res) {
  const body = await readJson(req, 64 * 1024);
  if (!body) return send(res, 400, { error: "Invalid JSON" });
  const kind = MIRROR_KINDS.has(body.kind) ? body.kind : "mirror";
  const situation = normalizeText(clip(body.situation));
  if (!situation) return send(res, 400, { error: "situation is required" });
  const previousSafety = ["none","check","urgent","crisis"].includes(body.safetyState) ? body.safetyState : "none";
  const correction = normalizeText(clip(body.correction)), answer = normalizeText(clip(body.answer)), question = clip(body.question);
  const piece = kind === "mirror" || kind === "decision" || kind === "retest" ? null : cleanPiece(body.piece);
  const pieces = cleanPieces(body.pieces);
  if (kind !== "mirror" && kind !== "decision" && kind !== "retest" && !piece) return send(res, 400, { error: "piece is required" });
  if (kind === "revise" && !correction) return send(res, 400, { error: "correction is required" });
  if (kind === "update" && !answer) return send(res, 400, { error: "answer is required" });

  // V4.1 Decision Room shares this endpoint: same safety gate, its own prompt.
  const optionA = clip(body.optionA).slice(0, 60), optionB = clip(body.optionB).slice(0, 60);
  if ((kind === "decision" || kind === "retest") && !(optionA && optionB)) return send(res, 400, { error: "optionA and optionB are required" });
  if (kind === "retest" && !correction) return send(res, 400, { error: "correction is required" });
  const mapItems = cleanMapItems(body.mapItems);
  // 1. Safety first — the newest free text decides; a flagged moment never becomes a mirror.
  const fresh = kind === "mirror" ? situation : kind === "revise" || kind === "retest" ? correction : kind === "update" ? answer : "";
  const safetyFlag = fresh ? resolveSafety(previousSafety, fresh) : previousSafety === "check" ? "none" : previousSafety;
  if (safetyFlag !== "none") { console.log(`[mirror] safety ${previousSafety} → ${safetyFlag} (deterministic, no mirror)`); return send(res, 200, { kind, safety: safetyFlag, reply: SAFETY_FALLBACK[safetyFlag], source: "server-safety" }); }
  if (!API_KEY) { console.error("[anthropic] FAILED: ANTHROPIC_API_KEY not configured (server/.env)"); return send(res, 503, { error: "Mirror not configured", reason: "ANTHROPIC_API_KEY is not configured (server/.env)" }); }

  // 2. One model call; strict validation; never a made-up mirror.
  const decisionKind = kind === "decision" || kind === "retest";
  const r = await askModel(decisionKind
    ? { system: DECISION_SYSTEM, user: buildDecisionMessage({ kind, situation, pieces, confirmed: cleanPieces(body.confirmed), optionA, optionB, mapItems, previousTest: clip(body.previousTest), correction, decisionQuestion: clip(body.decisionQuestion).slice(0, 160) }), maxTokens: 1100 }
    : { system: MIRROR_SYSTEM, user: buildMirrorMessage({ kind, situation, piece, pieces, correction, question, answer }), maxTokens: 900 });
  if (r.error) return send(res, r.status, { error: "Mirror unavailable", reason: r.reason });
  const raw = parseJsonLoose(r.text);
  const out = kind === "mirror" ? validateMirror(raw) : kind === "update" ? validateMirror(raw, { min: 2 }) : kind === "revise" ? validateRevise(raw, piece) : kind === "deeper" ? validateDeeper(raw)
    : kind === "decision" ? validateDecisionRoom(raw, { optionA, optionB, mapIds: mapItems.map(m => m.id) }) : validateRetest(raw);
  if (!out) { console.error(`[mirror] model returned an unusable ${kind} response: ${sanitize(r.text).slice(0, 200)}`); return send(res, 502, { error: "Mirror unavailable", reason: `The model did not return a usable ${kind} (invalid or ungrounded JSON).` }); }
  console.log(`[mirror] ${kind}${out.pieces ? " pieces=" + out.pieces.length : ""}`);
  return send(res, 200, Object.assign({ kind, safety: "none", source: "model" }, out));
}

/* ---------------- V5 ---------------- */
const MEMORY_MAX = 3;
function cleanMemory(arr) { return (Array.isArray(arr) ? arr : []).slice(0, MEMORY_MAX).map(m => m && typeof m === "object" ? { text: clip(m.text).slice(0, 320) } : null).filter(m => m && m.text); }
function plainSafety(res, kind, level) { console.log(`[${kind}] safety → ${level} (deterministic, plain)`); return send(res, 200, { kind, safety: level, reply: SAFETY_FALLBACK[level], source: "server-safety" }); }
function modelGate(res) { if (!API_KEY) { console.error("[anthropic] FAILED: ANTHROPIC_API_KEY not configured (server/.env)"); send(res, 503, { error: "Not configured", reason: "ANTHROPIC_API_KEY is not configured (server/.env)" }); return false; } return true; }

/* POST /api/guide/warrior — kind: train | move | talk */
const WARRIOR_KINDS = new Set(["train", "move", "talk"]), EQUIPMENT = new Set(["NO EQUIPMENT", "GYM", "OUTSIDE"]), MINUTES = new Set([5, 10, 20]);
async function handleWarrior(req, res) {
  const body = await readJson(req, 64 * 1024); if (!body) return send(res, 400, { error: "Invalid JSON" });
  const kind = WARRIOR_KINDS.has(body.kind) ? body.kind : "talk";
  const latest = normalizeText(clip(body.latest)), memory = normalizeText(clip(body.memory)).slice(0, 600);
  const previousSafety = ["none","check","urgent","crisis"].includes(body.safetyState) ? body.safetyState : "none";
  const equipment = EQUIPMENT.has(body.equipment) ? body.equipment : "NO EQUIPMENT", minutes = MINUTES.has(Number(body.minutes)) ? Number(body.minutes) : 10;
  if (kind === "talk" && !latest) return send(res, 400, { error: "latest is required" });
  const fresh = kind === "talk" ? latest : memory;
  const safetyFlag = fresh ? resolveSafety(previousSafety, fresh) : previousSafety === "check" ? "none" : previousSafety;
  if (safetyFlag !== "none") return plainSafety(res, kind, safetyFlag);   // the persona is dropped; plain words only
  if (fresh && MEDICAL.test(fresh)) { console.log(`[warrior] medical caution (deterministic)`); return send(res, 200, { kind, safety: "none", caution: true, reply: CAUTION_REPLY, source: "server-caution" }); }
  if (!modelGate(res)) return;
  const r = await askModel({ system: WARRIOR_SYSTEM, user: buildWarriorMessage({ kind, equipment, minutes, history: cleanWarriorHistory(body.history), latest, memory, context: body.context, training: body.training }), maxTokens: kind === "train" ? 1400 : 600 });
  if (r.error) return send(res, r.status, { error: "The Warrior is unavailable", reason: r.reason });
  const raw = parseJsonLoose(r.text);
  const out = kind === "train" ? validateTrain(raw, minutes) : kind === "move" ? validateMove(raw) : validateWarriorTalk(raw);
  if (!out) { console.error(`[warrior] unusable ${kind} response: ${sanitize(r.text).slice(0, 160)}`); return send(res, 502, { error: "The Warrior is unavailable", reason: `The model did not return a usable ${kind}.` }); }
  console.log(`[warrior] ${kind}`); return send(res, 200, Object.assign({ kind, safety: "none", source: "model" }, out));
}

/* POST /api/deep-session — one concern → one structured narration */
async function handleDeepSession(req, res) {
  const body = await readJson(req, 64 * 1024); if (!body) return send(res, 400, { error: "Invalid JSON" });
  const concern = normalizeText(clip(body.concern)); if (!concern) return send(res, 400, { error: "concern is required" });
  const previousSafety = ["none","check","urgent","crisis"].includes(body.safetyState) ? body.safetyState : "none";
  const safetyFlag = resolveSafety(previousSafety, concern); if (safetyFlag !== "none") return plainSafety(res, "deep", safetyFlag);
  if (!modelGate(res)) return;
  const method = METHODS.includes(body.method) ? body.method : "story"; const minutes = LENGTHS.includes(Number(body.minutes)) ? Number(body.minutes) : 10;
  const minWords = Number(process.env.DEEP_SESSION_MIN_WORDS || (minutes >= 60 ? 1400 : minutes >= 15 ? 1000 : 700));
  let out = null, lastReason = "";
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    const r = await askModel({ system: deepSystem(method, minutes), user: buildDeepMessage({ concern, memory: cleanMemory(body.memory) }) + (attempt ? "\nIMPORTANT: your previous draft echoed a known teacher's phrasing or named one. Write every line fresh, in plain words of your own." : ""), maxTokens: 9000 });
    if (r.error) return send(res, r.status, { error: "Deep Session unavailable", reason: r.reason });
    const v = validateDeepSession(parseJsonLoose(r.text), { minWords, minutes });
    if (v && v.borrowed) { lastReason = "borrowed phrasing"; console.warn(`[deep] ${method}/${minutes}: borrowed phrasing — rewriting`); continue; }
    if (!v) { lastReason = "unusable"; console.error(`[deep] unusable session: ${sanitize(r.text).slice(0, 160)}`); continue; }
    out = v;
  }
  if (!out) return send(res, 502, { error: "Deep Session unavailable", reason: lastReason === "borrowed phrasing" ? "The session leaned on someone else's words twice; try again." : "The model did not return a usable session." });
  console.log(`[deep] ${method} · ${minutes} min · ${out.sections.length} sections, ~${out.words} words, ~${out.estimatedMinutes} min`); return send(res, 200, Object.assign({ kind: "deep", safety: "none", source: "model", method, minutes }, out));
}

/* POST /api/talk — the Orb, with the Mirror underneath */
async function handleTalk(req, res) {
  const body = await readJson(req, 64 * 1024); if (!body) return send(res, 400, { error: "Invalid JSON" });
  const latest = normalizeText(clip(body.latest)); if (!latest) return send(res, 400, { error: "latest is required" });
  const previousSafety = ["none","check","urgent","crisis"].includes(body.safetyState) ? body.safetyState : "none";
  const safetyFlag = resolveSafety(previousSafety, latest); if (safetyFlag !== "none") return plainSafety(res, "talk", safetyFlag);
  if (!modelGate(res)) return;
  const notes = (Array.isArray(body.notes) ? body.notes : []).filter(x => typeof x === "string").map(x => x.trim().slice(0, 160)).filter(Boolean).slice(0, 30);
  const mode = ["listen", "think", "straight"].includes(body.mode) ? body.mode : "think";
  const hour = Number.isInteger(body.hour) && body.hour >= 0 && body.hour < 24 ? body.hour : undefined;
  const lang = typeof body.lang === "string" ? body.lang.slice(0, 2) : "";
  const mood = ["storm", "heavy", "still", "clear", "radiant"].includes(body.mood) ? body.mood : "";
  const r = await askModel({ system: TALK_SYSTEM, user: buildTalkMessage({ history: cleanTalkHistory(body.history), latest, memory: cleanMemory(body.memory), notes, mode, hour, lang, mood }), maxTokens: 900 });
  if (r.error) return send(res, r.status, { error: "Inner Space is unavailable", reason: r.reason });
  const out = validateTalk(parseJsonLoose(r.text));
  if (!out) { console.error(`[talk] unusable reply: ${sanitize(r.text).slice(0, 160)}`); return send(res, 502, { error: "Inner Space is unavailable", reason: "The model did not return a usable reply." }); }
  console.log(`[talk] mode=${mode} door=${out.door} remember=${!!out.remember} decision=${out.decision.detected}`); return send(res, 200, Object.assign({ kind: "talk", safety: "none", source: "model" }, out));
}

/* POST /api/translate — { lang, items:[...] } → { items:[...] } : computed sentences into the app's language, cached on disk */
async function handleTranslate(req, res) {
  const body = await readJson(req, 64 * 1024); if (!body) return send(res, 400, { error: "Invalid JSON" });
  const lang = TR_LANGS.includes(body.lang) ? body.lang : null; if (!lang) return send(res, 400, { error: "lang must be one of " + TR_LANGS.join(", ") });
  const items = (Array.isArray(body.items) ? body.items : []).filter(x => typeof x === "string").map(x => x.trim().slice(0, 1200)).filter(Boolean).slice(0, 80);
  if (!items.length) return send(res, 400, { error: "items required" });
  if (items.reduce((n, x) => n + x.length, 0) > 16000) return send(res, 400, { error: "too much text in one call" });
  if (!modelGate(res)) return;
  const r = await translateMany(lang, items, askModel);
  if (r.error) return send(res, r.status || 502, { error: "Translation unavailable", reason: r.error });
  if (r.fresh) console.log(`[translate] ${lang}: ${r.fresh} new of ${items.length}`); return send(res, 200, { lang, items: r.items });
}
/* POST /api/voice — { text, profile } → audio/mpeg, or 503 when no provider is configured (the browser falls back) */
async function handleVoice(req, res) {
  const body = await readJson(req, 64 * 1024); if (!body) return send(res, 400, { error: "Invalid JSON" });
  const text = clip(body.text).slice(0, 2500); if (!text) return send(res, 400, { error: "text is required" });
  /* a preview of another voice (dev panel) is allowed only from this computer, and is never cached */
  const preview = typeof body.voiceId === "string" && /^[A-Za-z0-9]{8,40}$/.test(body.voiceId) && studioLocal(req) ? body.voiceId : null;
  const v = await synthesizeVoice(text, typeof body.profile === "string" ? body.profile : "orb", preview ? { voiceId: preview, noCache: true } : {});
  if (v.unavailable) return send(res, 503, { error: "voice-unavailable", reason: v.reason });
  if (v.error) { console.error(`[voice] FAILED ${v.reason}`); return send(res, v.status, { error: "voice-failed", reason: v.reason }); }
  if (!v.cached) console.log(`[voice] generated ${text.length} chars (${body.profile || "orb"})`);
  res.writeHead(200, { "content-type": v.mime, "content-length": v.audio.length, "cache-control": "no-store", "x-voice-cached": v.cached ? "1" : "0" }); res.end(v.audio);
}
/* GET /api/voice/status — provider, chosen voice, this month's characters, the voices on the account */
async function handleVoiceStatus(res) {
  const info = voiceInfo(); if (!info.configured) return send(res, 200, { configured: false, reason: "ELEVENLABS_API_KEY is not configured (server/.env)" });
  const [usage, voices] = await Promise.all([voiceUsage(), listVoices()]);
  return send(res, 200, Object.assign(info, { usage, voices: voices.voices || [], voicesError: voices.reason || null, profileNames: PROFILE_NAMES }));
}
/* POST /api/voice/select — { voiceId, name, profile:'all'|<profile> } → saved in server/voice-config.json. From this computer only. */
async function handleVoiceSelect(req, res) {
  if (!studioLocal(req)) return send(res, 403, { error: "Local only" });
  const body = await readJson(req, 8 * 1024); if (!body || typeof body.voiceId !== "string" || !/^[A-Za-z0-9]{8,40}$/.test(body.voiceId)) return send(res, 400, { error: "voiceId required" });
  const profile = typeof body.profile === "string" && (body.profile === "all" || PROFILE_NAMES.includes(body.profile)) ? body.profile : "all";
  const c = saveVoiceChoice(body.voiceId, profile, String(body.name || "").slice(0, 60)); console.log(`[voice] chosen ${body.name || body.voiceId} for ${profile}`); return send(res, 200, { ok: true, config: c });
}

async function handleTestModel(res) {
  if (!API_KEY) return send(res, 503, { ok: false, model: MODEL, reason: "ANTHROPIC_API_KEY is not configured (server/.env)" });
  const r = await askModel({ system: "You are a connectivity check. Follow the instruction exactly.", user: "Reply with exactly INNER_SPACE_MODEL_OK", maxTokens: 20 });
  if (r.error) return send(res, 502, { ok: false, model: MODEL, reason: r.reason });
  const reply = (r.text || "").trim();
  return send(res, 200, { ok: reply.includes("INNER_SPACE_MODEL_OK"), model: MODEL, reply });
}

function deterministicSafety(level) {
  return { action: "safety", reply: SAFETY_FALLBACK[level], enoughContext: false, understanding: null, clearUnderstanding: false, reflection: null, practice: null, safety: level, source: "server-safety" };
}

/** The only place that talks to the model. Sonnet 5: no sampling params, thinking off.
    Failures are logged plainly (status, type, sanitized message, timeout) and returned as a reason — never hidden. */
function sanitize(msg) { return String(msg || "").replace(/sk-ant-[A-Za-z0-9_\-]+/g, "sk-ant-***").replace(/x-api-key[^,}]*/gi, "x-api-key: ***").slice(0, 400); }
/* How "thinking off" is spelled differs by model: newer models want {type:"between_tools"}, older ones
   {type:"disabled"}. Try the current spelling first; if the API rejects it, switch once and remember. */
let THINKING_OFF = (process.env.THINKING_OFF || "between_tools");
async function askModel({ system, user, maxTokens }, retried = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const started = Date.now();
  try {
    const upstream = await fetch(`${BASE_URL}/v1/messages`, {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, thinking: { type: THINKING_OFF }, system, messages: [{ role: "user", content: user }] }),
    });
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      let type = "http_error", message = body;
      try { const j = JSON.parse(body); type = (j.error && j.error.type) || type; message = (j.error && j.error.message) || message; } catch {}
      if (!retried && upstream.status === 400 && /thinking/i.test(message)) {
        const want = (message.match(/"type":\s*"([a-z_]+)"\s*instead/i) || [])[1];
        THINKING_OFF = want || (THINKING_OFF === "disabled" ? "between_tools" : "disabled");
        console.log(`[anthropic] switching thinking-off setting to "${THINKING_OFF}" for ${MODEL} and retrying`);
        clearTimeout(timer); return askModel({ system, user, maxTokens }, true);
      }
      const reason = `Anthropic API ${upstream.status} (${type}): ${sanitize(message)}`;
      console.error(`[anthropic] FAILED status=${upstream.status} type=${type} model=${MODEL} after ${Date.now() - started}ms — ${sanitize(message)}`);
      return { error: true, status: 502, reason };
    }
    const data = await upstream.json();
    return { text: (data.content || []).filter(b => b.type === "text").map(b => b.text).join(" ") };
  } catch (err) {
    const timeout = err.name === "AbortError";
    const reason = timeout ? `Timeout: no answer from ${MODEL} within ${UPSTREAM_TIMEOUT_MS}ms` : `Network/error (${err.name}): ${sanitize(err.message)}`;
    console.error(`[anthropic] FAILED ${timeout ? "TIMEOUT" : "type=" + err.name} model=${MODEL} after ${Date.now() - started}ms — ${sanitize(err.message)}`);
    return { error: true, status: timeout ? 504 : 502, reason };
  } finally { clearTimeout(timer); }
}

function parseJsonLoose(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
function clip(v) { return typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : ""; }

/* ---------------- static + helpers ---------------- */
const TYPES = { ".webmanifest": "application/manifest+json", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webm": "video/webm", ".mp4": "video/mp4", ".json": "application/json", ".svg": "image/svg+xml", ".mp3": "audio/mpeg" };
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]); if (urlPath === "/") urlPath = "/inner-space.html";
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}server${path.sep}`)) { res.writeHead(404); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    const media = /^(video|audio)\//.test(type);
    const range = media && req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range) {   // media needs byte ranges: seeking, duration, mobile playback
      let start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : st.size - 1;
      if (!range[1] && range[2]) { start = Math.max(0, st.size - Number(range[2])); end = st.size - 1; }
      if (start >= st.size || end >= st.size || start > end) { res.writeHead(416, { "content-range": `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${st.size}`, "accept-ranges": "bytes", "cache-control": media ? "public, max-age=3600" : "no-cache" });
      if (req.method === "HEAD") return res.end(); return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign({ "content-type": type, "content-length": st.size, "cache-control": media ? "public, max-age=3600" : "no-cache" }, media ? { "accept-ranges": "bytes" } : {}));
    if (req.method === "HEAD") return res.end(); fs.createReadStream(file).pipe(res);
  });
}
function readJson(req, limit) {
  return new Promise(resolve => { let buf = ""; let over = false;
    req.on("data", c => { buf += c; if (buf.length > limit) { over = true; req.destroy(); } });
    req.on("end", () => { if (over) return resolve(null); try { resolve(JSON.parse(buf || "{}")); } catch { resolve(null); } });
    req.on("error", () => resolve(null)); });
}
function send(res, status, obj) { const body = JSON.stringify(obj); res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" }); res.end(body); }
function loadDotEnv(file) { if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } }

/* ---------------- /api/studio — record the Voice's sounds straight into assets/guides/voice ----------------
   Local only: the browser posts the raw recording, the server writes it next to the app. Names are a
   strict whitelist pattern (v_<id>_<kind>), so nothing can be written anywhere else. */
const STUDIO_DIR = path.join(ROOT, "assets", "guides", "voice");
const STUDIO_NAME = /^v_[a-z0-9_]{1,24}_(say|sound|place)$|^v_line_[a-z]{1,12}$/;
const STUDIO_EXT = { "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/mpeg": ".mp3", "audio/wav": ".wav" };
function studioLocal(req) { const a = req.socket.remoteAddress || ""; return /^(::1|127\.|::ffff:127\.)/.test(a); }
async function handleStudioSave(req, res) {
  if (!studioLocal(req)) return send(res, 403, { error: "Record on the PC itself (localhost)" });
  const u = new URL(req.url, "http://x"); const name = u.searchParams.get("name") || ""; const type = (req.headers["content-type"] || "").split(";")[0].trim();
  if (!STUDIO_NAME.test(name)) return send(res, 400, { error: "Bad name" });
  const ext = STUDIO_EXT[type]; if (!ext) return send(res, 415, { error: "Unsupported audio type " + type });
  const chunks = []; let size = 0; let over = false;
  await new Promise(r => { req.on("data", c => { size += c.length; if (size > 8 * 1024 * 1024) { over = true; req.destroy(); } else chunks.push(c); }); req.on("end", r); req.on("error", r); req.on("close", r); });
  if (over) return send(res, 413, { error: "Too large" });
  fs.mkdirSync(STUDIO_DIR, { recursive: true });
  for (const e of Object.values(STUDIO_EXT)) { const old = path.join(STUDIO_DIR, name + e); if (fs.existsSync(old)) fs.unlinkSync(old); }
  fs.writeFileSync(path.join(STUDIO_DIR, name + ext), Buffer.concat(chunks));
  console.log("[studio] saved", name + ext, Math.round(size / 1024) + " KB");
  return send(res, 200, { ok: true, file: name + ext, bytes: size });
}
function handleStudioList(res) {
  let files = []; try { files = fs.readdirSync(STUDIO_DIR).filter(f => /^v_.*\.(webm|ogg|m4a|mp3|wav)$/.test(f)); } catch {}
  return send(res, 200, { files });
}
function handleStudioDelete(req, res) {
  if (!studioLocal(req)) return send(res, 403, { error: "Local only" });
  const name = new URL(req.url, "http://x").searchParams.get("name") || ""; if (!STUDIO_NAME.test(name)) return send(res, 400, { error: "Bad name" });
  let n = 0; for (const e of Object.values(STUDIO_EXT)) { const f = path.join(STUDIO_DIR, name + e); if (fs.existsSync(f)) { fs.unlinkSync(f); n++; } }
  return send(res, 200, { ok: true, removed: n });
}

/* POST /api/shadow — one question back, from their own words. Safety first; the page has its own hand-written bank when this fails. */
async function handleShadow(req, res) {
  const body = await readJson(req, 32 * 1024); if (!body) return send(res, 400, { error: "Invalid JSON" });
  const all = normalizeText(clip([body.what, body.x, ...(Array.isArray(body.traits) ? body.traits : [])].filter(x => typeof x === "string").join(" \n ")));
  if (!all) return send(res, 400, { error: "Nothing to ask about" });
  const safetyFlag = resolveSafety("none", all); if (safetyFlag !== "none") return plainSafety(res, "shadow", safetyFlag);
  if (!modelGate(res)) return;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await askModel({ system: SHADOW_SYSTEM, user: buildShadowMessage(body), maxTokens: 160 });
    if (r.error) return send(res, r.status, { error: "Inner Space is unavailable", reason: r.reason });
    const out = validateShadow(parseJsonLoose(r.text));
    if (out) { console.log("[shadow] question ok"); return send(res, 200, Object.assign({ kind: "shadow", safety: "none", source: "model" }, out)); }
    console.error(`[shadow] unusable (attempt ${attempt + 1}): ${sanitize(r.text).slice(0, 160)}`);
  }
  return send(res, 502, { error: "Inner Space is unavailable", reason: "The model did not return a usable question." });
}

/* Talk keeps a longer, multi-line history than the Warrior: 16 turns, each up to 1200 characters */
function cleanTalkHistory(h) {
  return (Array.isArray(h) ? h : []).filter(t => t && (t.role === "user" || t.role === "orb" || t.role === "assistant") && typeof t.text === "string")
    .slice(-16).map(t => ({ role: t.role === "user" ? "user" : "orb", text: t.text.trim().slice(0, 1200) })).filter(t => t.text);
}
