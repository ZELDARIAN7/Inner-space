/**
 * Inner Space — TRANSLATE: computed sentences (Origin's reading, and anything else written by code)
 * into the app's language, through the model, cached on disk so each sentence is paid for once.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "cache", "translate");
const LANGS = { ar: "Arabic (Modern Standard, warm and natural, not bureaucratic)", es: "Spanish (neutral, warm)", hy: "Eastern Armenian (as spoken in Armenia)" };
export const TR_LANGS = Object.keys(LANGS);
const key = (lang, text) => crypto.createHash("sha1").update(lang + "|" + text).digest("hex");
function readCache(lang, text) { try { return fs.readFileSync(path.join(DIR, lang, key(lang, text) + ".txt"), "utf8"); } catch { return null; } }
function writeCache(lang, text, out) { try { fs.mkdirSync(path.join(DIR, lang), { recursive: true }); fs.writeFileSync(path.join(DIR, lang, key(lang, text) + ".txt"), out); } catch {} }
export function translateSystem(lang) {
  return `You translate short passages from an app about the inner life into ${LANGS[lang]}. Keep the meaning, the warmth and the second person. Keep numbers, proper names (people, places, angel names), zodiac sign names translated the usual way, and symbols like · exactly. Keep each passage about the same length. Never add, explain or comment. Return STRICT JSON: an array of strings, one per input, same order, same count.`;
}
export async function translateMany(lang, items, askModel) {
  const out = new Array(items.length); const todo = [];
  items.forEach((t, i) => { const c = readCache(lang, t); if (c != null) out[i] = c; else todo.push(i); });
  if (todo.length) {
    const r = await askModel({ system: translateSystem(lang), user: JSON.stringify(todo.map(i => items[i])), maxTokens: 6000 });
    if (r.error) return { error: r.reason, status: r.status };
    let arr = null; try { const m = String(r.text).match(/\[[\s\S]*\]/); arr = JSON.parse(m ? m[0] : r.text); } catch {}
    if (!Array.isArray(arr) || arr.length !== todo.length) return { error: "The model did not return the translations in shape." };
    todo.forEach((i, k) => { const v = typeof arr[k] === "string" ? arr[k].trim() : ""; out[i] = v || items[i]; if (v) writeCache(lang, items[i], v); });
  }
  return { items: out, fresh: todo.length };
}
