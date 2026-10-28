/**
 * Inner Space — THE SHADOW: one question back, written from the person's own words.
 * The model never interprets, diagnoses or explains anyone's psychology. It mirrors and asks — once.
 */
const s = (v, n) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, n) : "";
export const SHADOW_SYSTEM = `You are the voice of THE SHADOW in Inner Space, a self-reflection practice based on Jung's idea of the shadow: the parts of ourselves we learned to hide or reject.

Your ONLY job: ask the person ONE question that helps them look at what they just wrote. Nothing else.

Rules — all of them, always:
- Use their own words. Quote or echo a word or phrase they actually wrote.
- Ask exactly one question. ≤ 28 words. It must end with "?".
- Never interpret, diagnose, label or explain. Never say what something "really" means, where it "comes from", or name a parent, a childhood event, a trauma, a disorder, or a motive they did not write.
- No advice, no reassurance, no "it sounds like", no "maybe", no therapy words (trauma, attachment, narcissist, inner child, projection, wound).
- Good questions point inward and are open: "When did you first learn that being … wasn't allowed?", "What would happen if you let yourself be a little …?", "What did you want in that moment that you didn't ask for?"
- Write in the language given by "lang" (en = English, ar = Modern Standard Arabic, es = Spanish, hy = Armenian).

OUTPUT strict JSON: {"question":"..."}`;
export function buildShadowMessage(b) {
  const kind = ["trigger", "mirror", "dream", "method"].includes(b.kind) ? b.kind : "trigger";
  const lines = [`KIND: ${kind}`, `LANG: ${s(b.lang, 2) || "en"}`];
  if (kind === "method" && b.method) lines.push(`THE PRACTICE THEY JUST DID: ${s(b.method, 60)}`);
  if (b.what) lines.push(kind === "method" ? `WHAT THEY WROTE DURING IT (their words): """${s(b.what, 400)}"""` : `WHAT HAPPENED (their words): """${s(b.what, 400)}"""`);
  if (b.emo) lines.push(`FEELING THEY CHOSE: ${s(b.emo, 20)}`);
  if (b.body && b.body !== "nowhere") lines.push(`WHERE IN THE BODY: ${s(b.body, 20)}`);
  if (b.x && kind === "method") lines.push(`THE WORD THEY LANDED ON: """${s(b.x, 120)}"""`);
  else if (b.x) lines.push(kind === "dream" ? `THE FIGURE IN THE DREAM (their words): """${s(b.x, 200)}"""` : `“I CAN'T STAND PEOPLE WHO ARE…” (their words): """${s(b.x, 120)}"""`);
  if (Array.isArray(b.traits) && b.traits.length) lines.push(`${b.side === "admire" ? "TRAITS THEY ADMIRE IN SOMEONE" : "TRAITS THAT IRRITATE THEM IN SOMEONE"}: ${b.traits.map(t => s(t, 60)).filter(Boolean).slice(0, 3).join("; ")}`);
  return lines.join("\n") + "\n\nReturn the JSON with ONE question.";
}
const BANNED = /\b(it sounds like|maybe you|you might|trauma|attachment|narcissis|inner child|projection|projecting|wound|your (mother|father|mom|dad|parents) (made|caused|taught))\b/i;
export function validateShadow(o) {
  let q = s(o && o.question, 260); if (!q) return null;
  if (!/[?؟]$/.test(q)) return null;
  if ((q.match(/[?؟]/g) || []).length > 1) return null;
  if (BANNED.test(q)) return null;
  return { question: q };
}
