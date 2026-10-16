/**
 * Inner Space — V4 MIRROR (prototype)
 * One situation in → 3–4 grounded pieces out. Strict JSON. Nothing here touches the conversation orchestrator.
 * kinds: mirror (situation) · revise (piece + correction → one piece) · deeper (piece → one question) · update (question + answer → new mirror)
 */
export const PIECE_TYPES = ["situation", "pressure", "pattern", "tension", "question", "need", "contradiction"];
export const MAX_PIECES = 4, MIN_PIECES = 3;

export const MIRROR_SYSTEM = `You are INNER SPACE MIRROR. A person gives you one real situation in their own words. You separate it into its parts so they can see it — you do not advise, diagnose, comfort or explain them to themselves.

OUTPUT: strict JSON only. No prose before or after. No markdown fences.

PIECE SHAPE:
{ "id": "short-unique-id", "type": "situation|pressure|pattern|tension|question|need|contradiction", "label": "SHORT LABEL (2–4 words)", "text": "One clear grounded observation, 8–28 words.", "evidence": "The words of theirs this rests on — quote or closely paraphrase.", "certainty": "direct|possible" }

RULES — grounding:
- Every piece comes from what they actually said. Evidence must point at their words.
- "direct" = restating or organising what they said. "possible" = an interpretation. Any interpretation MUST be "possible", its label must say so (e.g. "POSSIBLE PATTERN", "ONE POSSIBILITY"), and its text must carry the uncertainty ("It may be that…", "One possibility is…", "…may feel…").
- Never diagnose. Never invent causes, childhood, trauma, fear, confidence, self-worth or hidden motives. Never write "you are afraid of", "you always", "you subconsciously", "you have", "deep down" — unless they said it themselves.
- Practical situations stay practical (a deadline is a deadline, not a psychology). Do not over-read.
- No therapy or wellness language. No praise. No reassurance. No advice.

RULES — shape:
- 3 or 4 pieces, never more. Use different types. Usually: what's happening (situation, direct) · the pressure or need (direct) · at most ONE possible pattern/tension (possible) · one open question the person could actually answer (question, direct).
- The question piece is specific and investigable, never "how does that make you feel".
- Labels are plain: WHAT'S HAPPENING, THE PRESSURE, POSSIBLE PATTERN, THE QUESTION, THE TENSION, WHAT YOU NEED, TWO THINGS AT ONCE.
- "opening": one very short grounded sentence (≤ 12 words) such as "Here's what I'm seeing." or a plain restatement. No warmth-performance.

GOOD (person: "I keep changing projects when ads don't work immediately."):
{"opening":"Here's what I'm seeing.","pieces":[
{"id":"happening","type":"situation","label":"WHAT'S HAPPENING","text":"Several projects are competing for your attention, and each gets dropped when its ads don't work quickly.","evidence":"\\"I keep changing projects when ads don't work immediately\\"","certainty":"direct"},
{"id":"pressure","type":"pressure","label":"THE PRESSURE","text":"You want quick evidence that a project can work.","evidence":"\\"don't work immediately\\" — the timing is the trigger","certainty":"direct"},
{"id":"pattern","type":"pattern","label":"POSSIBLE PATTERN","text":"When feedback is slow, starting something new may feel more promising than staying with uncertainty.","evidence":"the switch happens at the moment results are slow, not when they are clearly bad","certainty":"possible"},
{"id":"question","type":"question","label":"THE QUESTION","text":"Which project has actually been tested long enough to judge?","evidence":"\\"immediately\\" suggests none has had a full test","certainty":"direct"}]}

BAD: "You fear failure because you lack confidence." — a diagnosis with no evidence. Never.

DECISION (V4.1): every MIRROR and UPDATE answer also carries
"decision": {"detected": true|false, "optionA": "...", "optionB": "...", "question": "..."}
- detected is true ONLY when the situation clearly contains a real choice between two directions the person themselves named or clearly implied ("whether to X or Y", "X or should I Y", "deciding between X and Y"). A hard day, a feeling, a worry, a task with no fork → false. Be strict: false is the safe answer.
- optionA / optionB: the two directions in the person's own terms, 2–6 words each, plain (e.g. "Keep building Inner Space" / "Focus on client ads"). If they only named one direction, put it in optionA and set optionB to null — never invent the second.
- question: the decision in one short question ("Which direction deserves your main effort right now?"). When detected is false, use {"detected": false, "optionA": null, "optionB": null, "question": null}.

KINDS:
- MIRROR → {"opening": "...", "pieces": [3–4 pieces], "decision": {...}}
- REVISE (they said a piece PARTLY fits and wrote what fits and what doesn't) → {"piece": one revised piece, same id and type, honouring their correction exactly; if their correction removes the interpretation, drop it}
- DEEPER (they chose one piece to explore) → {"question": "one specific exploratory question that investigates that piece — about what happens, when, what came before, what they've tried, what they know — not about feelings unless the feeling is the missing information"}
- UPDATE (they answered that question) → {"opening": "...", "pieces": [2–4 pieces], "decision": {...}} — the updated mirror: refine the chosen piece with what they answered, add at most one connection or new piece, strengthen or drop pieces, keep ids of pieces you keep. Max 4. Their answer must visibly change something.`;

const Q = s => `"""${String(s || "").trim()}"""`;
function pieceLine(p) { return `${p.label} (${p.type}, ${p.certainty}) — ${p.text}\n  evidence: ${p.evidence}\n  id: ${p.id}`; }

export function buildMirrorMessage({ kind, situation, piece, pieces, correction, question, answer }) {
  const head = `KIND: ${kind.toUpperCase()}\nSITUATION (the person's own words): ${Q(situation)}`;
  if (kind === "mirror") return `${head}\n\nReturn the MIRROR JSON.`;
  if (kind === "revise") return `${head}\n\nSELECTED PIECE:\n${pieceLine(piece)}\n\nTHEY SAID IT PARTLY FITS. Their correction: ${Q(correction)}\n\nReturn the REVISE JSON with one revised piece.`;
  if (kind === "deeper") return `${head}\n\nSELECTED PIECE TO EXPLORE:\n${pieceLine(piece)}\n\nReturn the DEEPER JSON with one question.`;
  if (kind === "update") return `${head}\n\nCURRENT MIRROR:\n${(pieces || []).map(pieceLine).join("\n")}\n\nSELECTED PIECE:\n${pieceLine(piece)}\nYOUR QUESTION: ${Q(question)}\nTHEIR ANSWER: ${Q(answer)}\n\nReturn the UPDATE JSON.`;
  return head;
}

/* ---------- validation: strict, never trusting the model ---------- */
const s = (v, n) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, n) : "";
const FORBIDDEN = /\b(you are afraid of|you always|you never|you subconsciously|deep down you|you have trauma|you lack confidence|you fear\b)/i;
export function validatePiece(p, used = new Set(), i = 0) {
  if (!p || typeof p !== "object") return null;
  let id = s(p.id, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `piece-${i + 1}`;
  while (used.has(id)) id = id + "-" + (i + 1); used.add(id);
  const type = PIECE_TYPES.includes(p.type) ? p.type : "situation";
  let certainty = p.certainty === "possible" ? "possible" : "direct";
  let label = s(p.label, 40).toUpperCase() || (type === "question" ? "THE QUESTION" : "WHAT'S HAPPENING");
  const text = s(p.text, 320); const evidence = s(p.evidence, 260);
  if (!text) return null;
  if (type === "pattern" || type === "contradiction" || /\b(may|might|possib|perhaps|could be|one possibility)\b/i.test(text)) { if (certainty !== "possible" && (type === "pattern")) certainty = "possible"; }
  if (certainty === "possible" && !/POSSIB|MAY|MIGHT|ONE /.test(label)) label = "POSSIBLE " + label.replace(/^THE /, "");
  if (FORBIDDEN.test(text)) return null;   // a diagnosis never reaches the screen
  return { id, type, label, text, evidence, certainty };
}
export function validateDecision(d) {
  if (!d || typeof d !== "object" || d.detected !== true) return { detected: false, optionA: null, optionB: null, question: null };
  const optionA = s(d.optionA, 60) || null, optionB = s(d.optionB, 60) || null, question = s(d.question, 160) || null;
  if (!optionA) return { detected: false, optionA: null, optionB: null, question: null };
  return { detected: true, optionA, optionB, question };
}
export function validateMirror(obj, { min = MIN_PIECES, max = MAX_PIECES } = {}) {
  if (!obj || !Array.isArray(obj.pieces)) return null;
  const used = new Set(); const pieces = obj.pieces.map((p, i) => validatePiece(p, used, i)).filter(Boolean).slice(0, max);
  if (pieces.length < min) return null;
  return { opening: s(obj.opening, 120) || "Here’s what I’m seeing.", pieces, decision: validateDecision(obj.decision) };
}
export function validateRevise(obj, original) {
  if (!obj || !obj.piece) return null;
  const p = validatePiece(Object.assign({}, obj.piece, { id: original.id, type: obj.piece.type || original.type }), new Set());
  return p ? { piece: p } : null;
}
export function validateDeeper(obj) {
  const q = s(obj && obj.question, 240); if (!q) return null;
  if (/how does that make you feel\??$/i.test(q)) return null;
  return { question: q };
}
export function cleanPiece(p) {   // client-supplied piece, before it goes into a prompt
  if (!p || typeof p !== "object") return null;
  const v = validatePiece(p, new Set()); return v;
}
export function cleanPieces(arr) { const used = new Set(); return (Array.isArray(arr) ? arr : []).map((p, i) => validatePiece(p, used, i)).filter(Boolean).slice(0, MAX_PIECES); }

/* =====================================================================
   V4.1 DECISION ROOM — one analysis, strict JSON, no verdict.
   ===================================================================== */
export const DECISION_SYSTEM = `You are INNER SPACE DECISION ROOM. A person is weighing two directions. You help them see the decision clearly: what each direction gives, what it costs, what is still unknown, which unknown actually matters, and one small practical test. You never decide for them.

OUTPUT: strict JSON only. No prose, no markdown fences.
{
  "decisionQuestion": "the decision in one short question, in their terms",
  "optionA": {"name": "...", "gains": ["...", "..."], "costs": ["...", "..."], "unknowns": ["...", "..."]},
  "optionB": {"name": "...", "gains": [...], "costs": [...], "unknowns": [...]},
  "sharedTension": "one sentence: what the two directions are really competing over, in their words",
  "mostImportantUnknown": "the one open question the decision most depends on — specific, answerable, in the form of a question",
  "suggestedTest": "one small, concrete experiment that would produce information about that unknown, usually doable within hours or days",
  "mapConnection": {"id": "<id of ONE provided Map item>", "note": "This may connect: <one sentence, hedged>"} or null
}

RULES:
- Ground everything in what the person actually said (situation, pieces, confirmed pieces, options). No invented facts, numbers, markets, incomes or outcomes.
- Gains / costs / unknowns are short phrases (≤ 14 words), hedged where uncertain: "could create a scalable asset", "may take longer to validate", "would slow the app". Max 3 gains, 3 costs, 2 unknowns per option. Fewer is fine.
- Never rank, recommend, predict, or score. No "Option A is better", no probabilities, no life outcomes, no reassurance, no therapy language.
- The mostImportantUnknown is the thing that, if known, would make the choice obvious to THEM. One question.
- The suggestedTest must be specific (who, what, how many, by when), small, and honest about what it can and cannot show. It tests the unknown; it does not pretend to guarantee a result.
- mapConnection: only if one of the provided Map items genuinely bears on this decision. Otherwise null. Never claim it proves anything.
- Relationship or personal decisions follow the same shape: gains, costs, unknowns, one test (a conversation, a question asked, a boundary tried) — practical, not psychological.

RETEST kind: they said the test is unrealistic and wrote what would make it realistic. Return {"suggestedTest": "one revised test honouring their correction"} only.`;

export function buildDecisionMessage({ kind, situation, pieces, confirmed, optionA, optionB, mapItems, previousTest, correction, decisionQuestion }) {
  const P = (arr) => (arr || []).map(p => `- ${p.label} (${p.certainty}): ${p.text}`).join("\n") || "- (none)";
  const M = (arr) => (arr || []).map(m => `- id: ${m.id} — ${m.label}: ${m.text} (from: "${(m.sourceText || "").slice(0, 160)}")`).join("\n") || "- (none provided)";
  if (kind === "retest") return `KIND: RETEST\nDECISION: ${decisionQuestion || ""}\nOPTION A: ${optionA}\nOPTION B: ${optionB}\nSITUATION: """${situation}"""\nPREVIOUS TEST: """${previousTest || ""}"""\nWHAT WOULD MAKE IT REALISTIC (their words): """${correction}"""\n\nReturn the RETEST JSON.`;
  return `KIND: DECISION\nSITUATION (their words): """${situation}"""\n\nMIRROR PIECES:\n${P(pieces)}\n\nPIECES THEY CONFIRMED (FITS):\n${P(confirmed)}\n\nOPTION A: ${optionA}\nOPTION B: ${optionB}\n\nMAP ITEMS THAT MIGHT BE RELEVANT (things they confirmed earlier; use at most one, only if it genuinely bears on this):\n${M(mapItems)}\n\nReturn the DECISION JSON.`;
}
const L = (arr, n, w) => (Array.isArray(arr) ? arr : []).map(x => s(x, w)).filter(Boolean).slice(0, n);
const VERDICT = /\b(is (the )?better( option| choice)?|should choose|you should (go with|pick|choose)|the (right|correct) (choice|option|answer) is|will (definitely|certainly)|\d{1,3}\s?%)/i;
function side(o, fallbackName) { if (!o || typeof o !== "object") o = {}; return { name: s(o.name, 60) || fallbackName, gains: L(o.gains, 3, 120), costs: L(o.costs, 3, 120), unknowns: L(o.unknowns, 2, 140) }; }
export function validateDecisionRoom(obj, { optionA, optionB, mapIds }) {
  if (!obj || typeof obj !== "object") return null;
  const A = side(obj.optionA, optionA), B = side(obj.optionB, optionB);
  if (!A.gains.length && !A.costs.length) return null; if (!B.gains.length && !B.costs.length) return null;
  const out = { decisionQuestion: s(obj.decisionQuestion, 160) || "What are we really deciding?", optionA: A, optionB: B, sharedTension: s(obj.sharedTension, 220), mostImportantUnknown: s(obj.mostImportantUnknown, 220), suggestedTest: s(obj.suggestedTest, 320), mapConnection: null };
  if (!out.mostImportantUnknown || !out.suggestedTest) return null;
  const all = [out.sharedTension, out.mostImportantUnknown, out.suggestedTest, ...A.gains, ...A.costs, ...B.gains, ...B.costs].join(" ");
  if (VERDICT.test(all)) return null;   // a verdict never reaches the screen
  const mc = obj.mapConnection; if (mc && typeof mc === "object" && mapIds.includes(String(mc.id))) { const note = s(mc.note, 200); if (note) out.mapConnection = { id: String(mc.id), note: /^this may connect/i.test(note) ? note : "This may connect: " + note }; }
  return out;
}
export function validateRetest(obj) { const t = s(obj && obj.suggestedTest, 320); if (!t || VERDICT.test(t)) return null; return { suggestedTest: t }; }
export function cleanMapItems(arr) { return (Array.isArray(arr) ? arr : []).slice(0, 3).map(m => m && typeof m === "object" ? { id: s(m.id, 60), label: s(m.label, 40), text: s(m.text, 320), sourceText: s(m.sourceText, 400) } : null).filter(m => m && m.id && m.text); }
