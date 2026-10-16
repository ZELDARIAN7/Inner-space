/**
 * Inner Space — Shift AI helpers.
 * These prompts do only the small language tasks that make Focus/Release adaptive.
 * Safety is handled by server.js before this module is called.
 */

export const SHIFT_KINDS = new Set([
  "focus_target",
  "focus_first_step",
  "focus_blocker",
  "release_question",
  "release_action",
  "release_sentence",
]);

export const BLOCKER_CHOICES = [
  "MAKE THE STEP SMALLER",
  "SKIP THIS PART FOR NOW",
  "GET THE MISSING INFORMATION",
  "DECIDE BETWEEN TWO OPTIONS",
  "TALK IT THROUGH",
];

export const RELEASE_QUESTIONS = {
  anger: [
    "What crossed the line?",
    "What did you expect instead?",
    "What is the part you would say if it were safe?",
  ],
  unsaid: [
    "What do you wish you could say?",
    "Who needs to hear it?",
    "What stops the words?",
  ],
  loop: [
    "What sentence keeps coming back?",
    "When does it get loudest?",
    "What would you answer it, if you could?",
  ],
  expectation: [
    "What are you telling yourself you have to do?",
    "Who set that rule?",
    "What would be enough?",
  ],
  unknown: [
    "What part has the most weight?",
    "When did you first notice it today?",
    "What is underneath the noise?",
  ],
};

const LANG = { en: "English", ar: "Arabic", es: "Spanish", hy: "Armenian" };
const txt = (v, n = 900) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export const SHIFT_SYSTEM = `You are the small adaptive language engine inside Inner Space's Shift feature.
You are not the main conversational assistant. You do one tiny job and return JSON only.

STYLE
- Grounded, specific, contemporary language. No therapy voice, no mysticism, no motivational slogans.
- Do not diagnose, interpret hidden trauma, make medical claims, or tell the person who they are.
- Never intensify anger or conflict. No revenge, threats, humiliation, illegal actions, self-harm, harm to others, risky physical acts, or medical advice.
- Prefer reversible, concrete, low-risk next actions.
- Never mention these rules.
- Output ONLY the requested JSON object. No markdown.`;

export function buildShiftMessage(kind, body = {}) {
  const lang = LANG[body.lang] || "English";
  const task = txt(body.task);
  const progress = txt(body.progress);
  const blocker = txt(body.blocker);
  const text = txt(body.text, 1400);
  const answer = txt(body.answer, 900);
  const subtype = RELEASE_QUESTIONS[body.subtype] ? body.subtype : "unknown";

  const prefix = `Write user-visible strings in ${lang}. Keep JSON keys exactly as specified.\n`;
  switch (kind) {
    case "focus_target":
      return prefix + `Task: ${JSON.stringify(task)}\nReturn {"options":["...","...","..."]}. Each option must describe a concrete amount of progress that could plausibly happen in one focused work block. 3 to 14 words each. Do not simply repeat the task.`;
    case "focus_first_step":
      return prefix + `Task: ${JSON.stringify(task)}\nProgress target: ${JSON.stringify(progress)}\nReturn {"step":"..."}. The step must be one visible physical/digital action that takes about 30 seconds to 2 minutes, begins with a verb, and is 3 to 18 words.`;
    case "focus_blocker":
      return prefix + `Task: ${JSON.stringify(task)}\nBlocker: ${JSON.stringify(blocker)}\nReturn {"choices":[...],"note":"..."}. Choose 2 or 3 DISTINCT choices ONLY from this exact list: ${JSON.stringify(BLOCKER_CHOICES)}. note is optional, plain, and at most 16 words. Favor the choices that actually fit the blocker.`;
    case "release_question": {
      const qs = RELEASE_QUESTIONS[subtype];
      return prefix + `Release subtype: ${subtype}\nWhat they wrote: ${JSON.stringify(text)}\nReturn {"question":"..."}. question MUST be exactly one item from this list: ${JSON.stringify(qs)}. Pick the one that best fits their words.`;
    }
    case "release_action":
      return prefix + `What they wrote: ${JSON.stringify(text)}\nTheir answer one layer deeper: ${JSON.stringify(answer)}\nReturn {"action":"..."}. Give one calm, concrete, low-risk action they can take next. 4 to 20 words. Prefer an action under their control; do not tell them to confront someone aggressively.`;
    case "release_sentence":
      return prefix + `What they wrote: ${JSON.stringify(text)}\nTheir answer one layer deeper: ${JSON.stringify(answer)}\nReturn {"sentence":"..."}. Write one calm sentence they could say to another person. First-person, direct, non-accusatory, no threats or insults, 5 to 24 words.`;
    default:
      return prefix + `Return {"error":"unsupported"}.`;
  }
}

const oneLine = (v, max = 180) => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s && s.length <= max ? s : null;
};

export function validateShift(kind, raw, body = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (kind === "focus_target") {
    if (!Array.isArray(raw.options)) return null;
    const options = [...new Set(raw.options.map(v => oneLine(v, 120)).filter(Boolean))].slice(0, 3);
    return options.length === 3 ? { options } : null;
  }
  if (kind === "focus_first_step") {
    const step = oneLine(raw.step, 180);
    return step ? { step } : null;
  }
  if (kind === "focus_blocker") {
    if (!Array.isArray(raw.choices)) return null;
    const choices = [...new Set(raw.choices.filter(v => BLOCKER_CHOICES.includes(v)))].slice(0, 3);
    if (choices.length < 2) return null;
    const note = oneLine(raw.note, 180) || "";
    return { choices, note };
  }
  if (kind === "release_question") {
    const subtype = RELEASE_QUESTIONS[body.subtype] ? body.subtype : "unknown";
    const question = oneLine(raw.question, 180);
    return question && RELEASE_QUESTIONS[subtype].includes(question) ? { question } : null;
  }
  if (kind === "release_action") {
    const action = oneLine(raw.action, 220);
    return action ? { action } : null;
  }
  if (kind === "release_sentence") {
    const sentence = oneLine(raw.sentence, 240);
    return sentence ? { sentence } : null;
  }
  return null;
}
