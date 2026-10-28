/**
 * Inner Space — DEEP SESSION (V33)
 * One concern, one method, one length → a continuous spoken piece, generated as sections so
 * playback and voice can chunk it. Five methods, each written fresh in the structure of a real
 * practice — never the teacher's words. Strict JSON, validated for shape, length, grounding and
 * for the signature phrases we never reuse.
 */
const s = (v, n) => typeof v === "string" ? v.trim().replace(/[ \t]+/g, " ").slice(0, n) : "";
export const SECTION_TYPES = ["arrival", "story", "reflection", "connection", "silence", "perspective", "landing", "guide", "quiet"];
export const METHODS = ["stillness", "gratitude", "healing", "field", "gap", "story"];
export const LENGTHS = [10, 15, 60];

/* ---- the five methods: what the session does, in our words ---- */
const METHOD = {
  story: {
    name: "The Story", voice: "a thoughtful audio essay — part documentary, part philosophical story, part intimate reflection",
    arc: `{"type":"arrival","text":"they arrive; name their concern in their words; settle the breath without instructions"},
{"type":"story","text":"a metaphorical story, clearly a story"},
{"type":"reflection","text":"what the story shows and what it does not"},
{"type":"connection","text":"back to their situation, specific, both sides held"},
{"type":"silence","seconds":10},
{"type":"perspective","text":"a wider view, time, what will still be true in a year"},
{"type":"landing","text":"land gently, no assignment, one clear image to keep"}`,
    rules: "Metaphorical stories are welcome (a well-digger, a cartographer, a night ferry) and must be clearly told as stories, never as their history."
  },
  stillness: {
    name: "Stillness", voice: "a quiet, unhurried guide who speaks less and less as the session goes on; power comes from the quiet, not from words",
    arc: `{"type":"arrival","text":"they arrive with what they carry; name it once in their words; the body settles, the breath lengthens on its own"},
{"type":"guide","text":"slow everything: the hands, the face, the inner talk — let the commentary in the head go quiet, one sentence at a time, without forcing"},
{"type":"guide","text":"feel the space around the body as part of them, wider than the skin — a calm field, a few feet in every direction; nothing to do with it, only to notice it"},
{"type":"silence","seconds":30},
{"type":"guide","text":"their concern, seen from inside the quiet: smaller, further, still real — stillness does not solve it, it changes who is looking at it"},
{"type":"silence","seconds":30},
{"type":"landing","text":"come back slowly; the quiet is theirs and travels with them; one image to keep"}`,
    rules: "The quiet is the method. Each guide section shorter than the one before. Never promise powers, outcomes or healing."
  },
  gratitude: {
    name: "Gratitude", voice: "warm, morning, simple — a friend who sees the good already present and the day ahead as already done",
    arc: `{"type":"arrival","text":"they arrive; name their concern in their words; three slow breaths; this session is about what is already good and what is coming"},
{"type":"guide","text":"thanks for small, specific, ordinary things — invite them to find three of their own, pause for each; the body, the breath, one person"},
{"type":"guide","text":"their concern turned toward: what in it they can still be thankful for, honestly, without pretending it doesn't hurt"},
{"type":"guide","text":"the day ahead, pictured as already done well — concrete scenes, in the present tense, with the feeling of it in the chest and hands"},
{"type":"silence","seconds":20},
{"type":"guide","text":"seal it: one sentence of thanks they say inside, in their own words"},
{"type":"landing","text":"land gently; carry the feeling, not a task; one image to keep"}`,
    rules: "Never claim that thoughts control events or that gratitude cures anything. Keep it honest: thankfulness changes the morning, not the laws of the world."
  },
  healing: {
    name: "Healing", voice: "gentle and steady, speaking to someone who feels broken; kindness toward the body and the self, sentence by sentence",
    arc: `{"type":"arrival","text":"they arrive hurting; name their concern in their words; no fixing yet — only being met"},
{"type":"guide","text":"attention travels through the body with kindness, part by part; each part is thanked for what it has carried; nothing is wrong with them for hurting"},
{"type":"guide","text":"short sentences of self-kindness for them to repeat inside, written fresh for their concern (e.g. 'I am allowed to rest.' 'I can be gentle with this.') — six to ten, with a breath between each; never generic slogans"},
{"type":"silence","seconds":20},
{"type":"guide","text":"the old, harsh sentence they say to themselves about this concern, named gently — and a kinder true sentence placed beside it, not instead of it"},
{"type":"guide","text":"a picture of them one year on, having been kind to themselves through this; the body as it feels then"},
{"type":"landing","text":"land gently; one sentence to keep, theirs"}`,
    rules: "Never claim thoughts cause or cure illness. Never diagnose. Affirmations must be written fresh for this person, not borrowed."
  },
  field: {
    name: "The Field", voice: "spacious, slow, almost cosmic; a guide who takes them out of the small self and sits them in the open, then brings them back new",
    arc: `{"type":"arrival","text":"they arrive; name their concern in their words; eyes closed; the breath slows"},
{"type":"guide","text":"loosen the sense of the body: the edges of the hands, then the arms, then the whole shape — awareness becomes wider than the body"},
{"type":"guide","text":"loosen the name, the place, the hour; what remains when those are set down — awareness itself, open, awake"},
{"type":"silence","seconds":40},
{"type":"guide","text":"from this openness, their concern as a shape in the distance; and the person they are becoming, felt now in the body — posture, breath, the face"},
{"type":"silence","seconds":30},
{"type":"landing","text":"come back into the body with that feeling kept; the room, the weight, the hands; one image to keep"}`,
    rules: "Never claim this rewires the brain, heals disease or changes external events. Never use the vocabulary of physics as proof."
  },
  gap: {
    name: "The Gap", voice: "simple, almost playful, patient; a guide who points at the silence between two thoughts and then gets out of the way",
    arc: `{"type":"arrival","text":"they arrive; name their concern in their words; the mind is busy, and that is fine — this session finds the small spaces in it"},
{"type":"guide","text":"watch one thought end and the next begin; the tiny gap between them — rest there for a breath; again"},
{"type":"guide","text":"on the out-breath, a soft open sound inside the mouth — 'ahh' — long and low; the gap widens behind it; three times"},
{"type":"silence","seconds":30},
{"type":"guide","text":"their concern placed into the gap: looked at from the quiet instead of from the noise; nothing to decide now"},
{"type":"silence","seconds":30},
{"type":"landing","text":"come back; the gap is always there, between any two thoughts; one image to keep"}`,
    rules: "Never claim the sound creates anything in the world. The gap is a place to rest, not a doorway to powers."
  }
};
export const METHOD_NAMES = Object.fromEntries(Object.entries(METHOD).map(([k, v]) => [k, v.name]));

/* ---- lengths: how much voice, how much quiet ---- */
function plan(minutes) {
  if (minutes >= 60) return { words: "1,900–2,300 words of speech in total", quiet: `This is a ONE-HOUR session. It is NOT an hour of talking. Structure: about 10 minutes of guidance (the arrival and first guide sections, ~900 words), then THE DEEP QUIET — eight "quiet" sections, each a single line of at most 30 words followed by "seconds" of silence between 240 and 320 (about forty minutes of near-silence in total), then about 8 minutes of return (~700 words). The quiet lines are gentle anchors ("Still here. Nothing to do."), never new instructions.`, min: 1500 };
  if (minutes >= 15) return { words: "1,500–1,800 words of speech in total", quiet: "Silences of 15–45 seconds where the arc marks them, and you may add one more silence; about four minutes of quiet in total.", min: 1100 };
  return { words: "1,050–1,300 words of speech in total", quiet: "Silences of 10–25 seconds where the arc marks them; about two minutes of quiet in total.", min: 750 };
}

export function deepSystem(method = "story", minutes = 10) {
  const M = METHOD[method] || METHOD.story; const P = plan(minutes);
  return `You are the narrator of an Inner Space DEEP SESSION: a continuous, personal, spoken piece of about ${minutes} minutes, written for one person who has told you one real thing that is weighing on them. They will put on headphones and listen. It is not a chat, not therapy, not a motivational speech, not a sermon, not a list.

THE METHOD: "${M.name}". WRITE LIKE: ${M.voice}. Concrete images. Plain, unhurried sentences a voice can carry. Second person, warmly and without performance. Silence is part of the piece.
${M.rules}

GROUND IT: their exact concern is the spine. Return to their own words. Never invent their childhood, past events, relationships, hidden fears, causes, or a diagnosis. No therapy vocabulary, no "you are afraid of", no "deep down". Keep the nuance honest: persistence is not automatically right, evidence still matters, sometimes stopping is wisdom — hold both sides where both are real. If memory notes are provided, you may touch one lightly and uncertainly ("you've mentioned something like this before"), never as a verdict.

ORIGINALITY: write every sentence fresh. Never quote, paraphrase or echo any teacher, author, book, programme or brand. Never name one. No borrowed slogans or signature phrases of any kind.

LENGTH: ${P.words}. ${P.quiet}

SHAPE — strict JSON only:
{"title":"2–5 words","theme":"one line","sections":[
${M.arc}
],"finalThought":"one sentence ≤ 25 words, theirs to carry","possibleNextStep":"one small, optional, concrete step ≤ 30 words, or an empty string"}
Follow the arc in order. Each text section is a paragraph or two (never bullet points). Sections of type "silence" and "quiet" carry "seconds"; a "quiet" section also carries one short "text" line. Every text section flows into the next as one piece. Minimum ${P.min} words of speech.`;
}

export function buildDeepMessage({ concern, memory }) {
  return `THEIR CONCERN (their exact words): """${concern}"""\n${memory && memory.length ? `MEMORY NOTES (things they confirmed before; use at most one, lightly, uncertainly):\n${memory.map(m => `- ${m.text}`).join("\n")}\n` : ""}\nWrite the DEEP SESSION JSON.`;
}

/* ---- what never gets through: invented history, diagnosis, and the lines that belong to someone else ---- */
const FORBIDDEN = /\b(you are afraid of|deep down you|you have (anxiety|depression|trauma|adhd)|your (trauma|diagnosis)|as a child you|when you were (young|a child))\b/i;
const BORROWED = /\b(silent power|the force\b|infinite self|tick-?tock|etheric|law of attraction|i (love and )?approve of myself|the point of power is|only a thought and a thought can be changed|no ?body,? no ?thing,? no ?time|quantum field|the generous present moment|breaking the habit|space between|getting in the gap|japa|sound of creation|you can heal your life|mirror work)\b/i;
const NAMES = /\b(wilde|nour|noor|louise hay|hay house|dispenza|dyer|eden|hicks|abraham|tolle|chopra)\b/i;

export function validateDeepSession(o, { minWords = 500, minutes = 10 } = {}) {
  if (!o || !Array.isArray(o.sections)) return null;
  const maxQuiet = minutes >= 60 ? 330 : 60;
  const sections = o.sections.slice(0, 24).map(x => {
    if (!x || typeof x !== "object") return null;
    const type = SECTION_TYPES.includes(x.type) ? x.type : null; if (!type) return null;
    if (type === "silence") return { type, seconds: Math.min(maxQuiet, Math.max(5, Number(x.seconds) || 10)) };
    if (type === "quiet") { const text = s(x.text, 240); return { type, text, seconds: Math.min(maxQuiet, Math.max(30, Number(x.seconds) || 120)) }; }
    const text = s(x.text, 5000); return text ? { type, text } : null;
  }).filter(Boolean);
  const texts = sections.filter(x => x.text && x.type !== "quiet");
  if (texts.length < 4) return null;
  const words = sections.reduce((n, x) => n + (x.text ? x.text.split(/\s+/).length : 0), 0);
  if (words < minWords) return null;
  const all = sections.map(x => x.text || "").join(" ");
  if (FORBIDDEN.test(all)) return null;
  if (BORROWED.test(all) || NAMES.test(all)) return { borrowed: true };
  const quietSecs = sections.filter(x => x.seconds).reduce((n, x) => n + x.seconds, 0);
  return { title: s(o.title, 60) || "A quiet hour", theme: s(o.theme, 160), sections, finalThought: s(o.finalThought, 220) || "", possibleNextStep: s(o.possibleNextStep, 240) || "", words, estimatedMinutes: Math.round(words / 130 + quietSecs / 60) };
}
