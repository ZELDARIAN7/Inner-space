/**
 * Inner Space — V5 GUIDES: THE WARRIOR
 * One persona, three kinds: train (structured session) · move (live activation steps) · talk (scoped conversation).
 * Strict JSON, validated. Safety and medical caution are decided deterministically before the model.
 */
const s = (v, n) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, n) : "";

export const WARRIOR_SYSTEM = `You are THE WARRIOR — an AI Guide in Inner Space, represented by an original mythic monkey-warrior archetype: ancient, disciplined, weathered, calm under pressure. You are not Sun Wukong, not a god, not a character from any film or game, and you never claim supernatural powers. You are a trainer of will and body.

VOICE: short lines. Grounded. Strong. Sometimes challenging, never abusive, never humiliating, never a macho parody, never fake-ancient English. No "I understand how you feel", no "here are five tips", no "it sounds like you're experiencing", no bullet lists, no emojis. A metaphor now and then ("Motivation is weather. Training is what you do when the sky changes."), never a string of quotes. You move people toward one physical action.

SCOPE: discipline, persistence, courage, training mindset, getting unstuck physically, keeping commitments, facing discomfort, practical self-discipline. Money, relationships, medicine, trivia, mysticism: not your room — redirect in your own words, briefly, then ask what they are avoiding or what the next physical step is. Vary the redirect; never repeat the same sentence.

SAFETY: no diagnosing, no treating pain or injury, no medical claims, no extreme protocols, no fasting/cutting advice, nothing for pregnancy, heart symptoms, fainting or acute pain — if those come up, say plainly to stop and get real help, and offer only rest or a walk.

WHAT YOU KNOW ABOUT THEM: sometimes a CONTEXT block lists facts they recorded in the app — their battle, their current move, today's word, their training, today's seals, their last test numbers, the hour. Use at most one fact, only when it sharpens the reply ("You gave your word this morning: the walk. Is it done?"). Never recite the list, never invent anything that is not in it, never shame them for what is missing. Late at night, lean toward rest and tomorrow's first move.

TRAINING IDENTITY (when given): FOUNDATION = learn the patterns, modest reps · CONTROL = slower tempo, pauses · PRESSURE = a little more volume · MOBILITY = range and ease · RECOVERY / RETURN = easier on purpose · TEST = one short benchmark round. LEVEL "starting" = the easier variations (wall or knee push-ups, squats to a chair, shorter holds). Avoid the exercises listed under AVOID when you can.

OUTPUT: strict JSON only, no prose around it.
- TRAIN → {"title":"2–4 words","opening":"one Warrior line ≤ 18 words","duration":<minutes as given>,"rounds":[{"name":"Wake|Work|Finish or similar","durationSeconds":<int>,"moves":[{"name":"...","reps":"10" or "30 s" or "45 s each side","instruction":"one safe cue ≤ 20 words"}]}],"closing":"one line ≤ 14 words"}
  Rules: bodyweight-only when NO EQUIPMENT; simple gym moves when GYM (bodyweight, dumbbells, a bar); walking/running/hills/steps when OUTSIDE. 5 min → 1 round of 3–4 moves; 10 min → 2 rounds; 20 min → 3 rounds. Total round seconds ≈ duration × 60. Every move common, low-skill, safe for an average adult. Always include a warm-up move first. Reps modest.
- MOVE → {"steps":[{"line":"one short command or acknowledgement ≤ 12 words","wait":"confirm" | <seconds 2–20>}]} — 8 to 12 steps. Start with "Stand up." (wait confirm). Alternate commands (wait confirm) and short acknowledgements (wait 2–4 seconds). Small moves only: stand, breathe, roll shoulders, ten slow squats, walk to the window, twenty seconds of anything. Last step is a one-line send-off (wait 4). Total 2–5 minutes.
- TALK → {"reply":"≤ 45 words, 1–3 short sentences, ends with one direct question or one direct instruction","push":"move"|"train"|null,"options":["≤ 8 words","≤ 8 words"] or [],"commitment":"the concrete action THEY just said they will do, in their own words, ≤ 12 words — or null","strategy":"SHRINK"|"FACE"|"PLAN"|"MOVE"|"REST"|"REFRAME"}
  push = "move" when they are stuck/lazy/sitting/no energy and a two-minute activation would help now; "train" when they want a session; else null.
  options = two short answers they could tap when your question identifies the obstacle (e.g. "I don't know where to start" / "I know — I don't stick to it"); otherwise []. Never more than two. Often none.
  commitment = only when their latest message names a specific action they intend to take ("I'll send the email after lunch" → "Send the email after lunch"). Never invent one, never a goal or a feeling — an action. Otherwise null.
  strategy = SHRINK (make the step smaller) · FACE (name what they avoid) · PLAN (when and where) · MOVE (a physical action now) · REST (recovery is the move) · REFRAME (same energy, new meaning).`;

export function buildWarriorMessage({ kind, equipment, minutes, history, latest, memory, context, training }) {
  const C = contextLines(cleanWarriorContext(context)), TR = trainingLines(training);
  if (kind === "train") return `KIND: TRAIN\nEQUIPMENT: ${equipment}\nTIME: ${minutes} minutes\n${TR}${memory ? `WHAT THEY SAID ABOUT THEMSELVES THIS SESSION: """${memory}"""\n` : ""}Return the TRAIN JSON.`;
  if (kind === "move") return `KIND: MOVE\n${memory ? `WHAT THEY SAID: """${memory}"""\n` : "They don't want to train. They need to start."}\nReturn the MOVE JSON.`;
  const hist = (history || []).map(t => `${t.role === "user" ? "THEM" : "WARRIOR"}: ${t.text}`).join("\n");
  return `KIND: TALK\n${C}${hist ? `SO FAR:\n${hist}\n` : ""}THEM (latest): """${latest}"""\n\nReturn the TALK JSON.`;
}

/* Medical / injury caution — deterministic, before any persona behaviour. */
export const MEDICAL = /\b(injur|hurt my (back|knee|shoulder|neck|ankle|wrist|hip)|torn|sprain|fracture|broken (arm|leg|bone|foot|hand)|surgery|pregnan|heart (condition|problem|attack|pain)|chest pain|palpitation|faint(ed|ing)?|dizzy|black(ed)? out|asthma attack|can'?t breathe|doctor said|physio|herniat|severe pain|sharp pain|blood pressure|diabet|concussion|stitches)/i;
export const CAUTION_REPLY = "Not with me, not today. Anything injured, medical, or making you dizzy or short of breath belongs with a doctor or physio first, not a training session. If it's mild and cleared, walk. If it's not, stop and get it checked.";

const FORBIDDEN = /\b(i understand how you feel|here are (five|5|three|3) tips|it sounds like you'?re experiencing|as an ai)\b/i;
export function validateTrain(o, minutes) {
  if (!o || !Array.isArray(o.rounds) || !o.rounds.length) return null;
  const rounds = o.rounds.slice(0, 4).map(r => ({ name: s(r && r.name, 24) || "Round", durationSeconds: Math.min(1200, Math.max(30, Number(r && r.durationSeconds) || 120)),
    moves: (Array.isArray(r && r.moves) ? r.moves : []).slice(0, 6).map(m => ({ name: s(m && m.name, 40), reps: s(m && m.reps, 24) || "30 s", instruction: s(m && m.instruction, 140) })).filter(m => m.name) })).filter(r => r.moves.length);
  if (!rounds.length) return null;
  const out = { title: s(o.title, 30) || "Wake the Body", opening: s(o.opening, 140) || "Begin.", duration: Number(minutes) || 10, rounds, closing: s(o.closing, 120) || "Done. Same time tomorrow." };
  if (FORBIDDEN.test([out.opening, out.closing].join(" "))) return null;
  return out;
}
export function validateMove(o) {
  if (!o || !Array.isArray(o.steps)) return null;
  const steps = o.steps.slice(0, 14).map(st => ({ line: s(st && st.line, 90), wait: st && st.wait === "confirm" ? "confirm" : Math.min(20, Math.max(2, Number(st && st.wait) || 3)) })).filter(st => st.line);
  if (steps.length < 5) return null; if (steps[0].wait !== "confirm") steps[0].wait = "confirm";
  return { steps };
}
export function validateWarriorTalk(o) {
  const reply = s(o && o.reply, 320); if (!reply || FORBIDDEN.test(reply)) return null;
  if (reply.split(/\s+/).length > 70) return null;   // the Warrior does not write articles
  const options = (Array.isArray(o.options) ? o.options : []).map(x => s(x, 48)).filter(Boolean).slice(0, 2);
  let commitment = s(o && o.commitment, 90); if (!commitment || /^null$/i.test(commitment) || commitment.split(/\s+/).length > 16) commitment = null;
  const strategy = STRATEGIES.includes(String(o && o.strategy || "").toUpperCase()) ? String(o.strategy).toUpperCase() : "MOVE";
  return { reply, push: o.push === "move" || o.push === "train" ? o.push : null, options, commitment, strategy };
}
export function cleanHistory(h) { return (Array.isArray(h) ? h : []).slice(-8).map(t => t && typeof t === "object" ? { role: t.role === "user" ? "user" : "warrior", text: s(t.text, 400) } : null).filter(t => t && t.text); }

/* ---- V44: what the person recorded, cleaned before it reaches the model ---- */
const STRATEGIES = ["SHRINK", "FACE", "PLAN", "MOVE", "REST", "REFRAME"];
const num = (v, lo, hi) => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : null; };
export function cleanWarriorContext(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null; const o = {};
  if (s(c.battle, 160)) o.battle = s(c.battle, 160);
  if (s(c.commitment, 120)) o.move = s(c.commitment, 120);
  if (c.vow && typeof c.vow === "object" && s(c.vow.text, 140)) o.word = `${s(c.vow.text, 140)} (${["sworn", "kept", "broken"].includes(c.vow.status) ? (c.vow.status === "sworn" ? "given, not yet answered" : c.vow.status) : "given"})`;
  const wk = num(c.wordsKept, 0, 9999); if (wk) o.wordsKept = wk;
  if (c.training && typeof c.training === "object") { const t = c.training; const parts = [];
    if (s(t.goal, 20)) parts.push(`goal ${s(t.goal, 20)}`); if (s(t.level, 20)) parts.push(`level ${s(t.level, 20)}`);
    const sn = num(t.sessionNumber, 1, 9999); if (sn) parts.push(`next session ${sn}`); if (s(t.lastEffort, 12)) parts.push(`last one felt ${s(t.lastEffort, 12)}`);
    const ld = num(t.lastDaysAgo, 0, 9999); if (ld !== null) parts.push(`last trained ${ld} day${ld === 1 ? "" : "s"} ago`); if (parts.length) o.training = parts.join(", "); }
  if (c.today && typeof c.today === "object") { const d = c.today; o.today = `body ${d.body ? "done" : "not yet"}, nerve ${d.nerve ? "done" : "not yet"}, word ${d.word ? "done" : "not yet"}`; }
  if (c.test && typeof c.test === "object") { const t = c.test; const parts = [];
    const p = num(t.push, 0, 999); if (p !== null) parts.push(`${p} ${["wall", "incline", "knees", "full"].includes(t.pushKind) ? t.pushKind + " " : ""}push-ups`);
    const q = num(t.squats, 0, 999); if (q !== null) parts.push(`${q} squats in 60 s`); const pl = num(t.plank, 0, 9999); if (pl !== null) parts.push(`plank ${pl} s`);
    const da = num(t.daysAgo, 0, 9999); if (parts.length) o.test = parts.join(", ") + (da !== null ? ` (${da} days ago)` : ""); }
  const away = num(c.daysAway, 0, 9999); if (away && away >= 2) o.away = `${away} days away before this visit`;
  const hr = num(c.hour, 0, 23); if (hr !== null) o.hour = hr;
  if (Array.isArray(c.recentMoves)) { const st = c.recentMoves.slice(0, 2).map(m => s(m && m.subtype, 20)).filter(Boolean); if (st.length) o.recentStates = st.join(", "); }
  return Object.keys(o).length ? o : null;
}
function contextLines(o) {
  if (!o) return "";
  const L = { battle: "their battle", move: "their current move", word: "today's word", wordsKept: "words kept so far", training: "training", today: "today's seals", test: "last test", away: "absence", hour: "local hour", recentStates: "recent states they shifted" };
  return "CONTEXT (their own records — use at most one fact, lightly):\n" + Object.entries(o).map(([k, v]) => `- ${L[k] || k}: ${v}`).join("\n") + "\n";
}
function trainingLines(t) {
  if (!t || typeof t !== "object") return "";
  const out = [];
  if (s(t.goal, 20)) out.push(`GOAL: ${s(t.goal, 20)}`); if (s(t.level, 20)) out.push(`LEVEL: ${s(t.level, 20)}`);
  const sn = num(t.sessionNumber, 1, 9999); if (sn) out.push(`SESSION NUMBER: ${sn}`);
  if (s(t.identity, 16)) out.push(`SESSION IDENTITY: ${s(t.identity, 16).toUpperCase()}`);
  if (s(t.effort, 12)) out.push(`LAST SESSION FELT: ${s(t.effort, 12)}`);
  const recent = Array.isArray(t.recentSessions) ? t.recentSessions.slice(0, 3).flatMap(x => Array.isArray(x && x.exercises) ? x.exercises : []).map(e => s(e, 40)).filter(Boolean) : [];
  if (recent.length) out.push(`AVOID (used recently): ${[...new Set(recent)].slice(0, 12).join(", ")}`);
  return out.length ? out.join("\n") + "\n" : "";
}
