/**
 * Unit tests for the orchestrator's deterministic parts. Run: `npm test` (in /server).
 * No model, no network.
 */
import { normalizeText, safetyPrecheck, resolveSafety, classifyTurn, buildMeaningfulContext, validateDecision, cleanHistory } from "./orchestrator.js";
import { validateShift, RELEASE_QUESTIONS } from "./shift.js";
let pass = 0, fail = 0;
const eq = (name, got, exp) => { if (JSON.stringify(got) === JSON.stringify(exp)) pass++; else { fail++; console.log(`  FAIL ${name}: got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`); } };

console.log("1. smart-apostrophe safety");
eq("curly == straight", safetyPrecheck("I can’t breathe"), safetyPrecheck("I can't breathe"));
eq("curly is check", safetyPrecheck("I can’t breathe"), "check");
eq("normalize", normalizeText("I can’t\u00A0breathe…"), "I can't breathe...");
for (const t of ["my chest hurts", "My chest is hurting", "I’m having trouble breathing", "I feel like I’m going to faint", "pain in my chest"]) eq(`urgent-physical: ${t}`, safetyPrecheck(t), "check");
for (const t of ["I need room to breathe at work", "this view takes my breath away", "a faint hope", "everything is too much", "I can't breathe around him"]) eq(`not physical: ${t}`, safetyPrecheck(t), "none");
eq("crisis intact", safetyPrecheck("I want to kill myself"), "crisis");
eq("crisis curly", safetyPrecheck("I don’t want to be alive"), "crisis");

console.log("2. physical follow-up escalation");
eq("yes physically", resolveSafety("check", "yes physically"), "urgent");
eq("yes my chest hurts", resolveSafety("check", "yes my chest hurts"), "urgent");
eq("bare yes", resolveSafety("check", "Yes."), "urgent");
eq("denial → none", resolveSafety("check", "no, not physically, just overwhelmed"), "none");
eq("emotional → none", resolveSafety("check", "I mean emotionally"), "none");
eq("unclear stays check", resolveSafety("check", "idk"), "check");
eq("crisis overrides", resolveSafety("check", "I want to die"), "crisis");
eq("no prior state", resolveSafety("none", "hi"), "none");

console.log("3. short meaningful statements survive");
for (const t of ["I feel empty.", "My dad died.", "I'm lonely.", "I hate myself.", "I miss her.", "I'm scared.", "I don't care anymore."]) eq(`keeps: ${t}`, classifyTurn(t), "substantive");
for (const t of ["ok", "yeah", "sure", "lol", "thanks", "hi", "Hello!", "how are you?", "Yes", "Partly", "Not really", "[card:yes]"]) eq(`drops: ${t}`, classifyTurn(t) === "substantive", false);

console.log("4. correction supersedes old understanding");
const h = [{ role: "user", text: "hi" }, { role: "user", text: "I feel empty." }, { role: "user", text: "ok" }, { role: "user", text: "No, that's not what I meant." }, { role: "user", text: "My dad died." }];
eq("meaningfulContext", buildMeaningfulContext(h), [{ text: "I feel empty.", superseded: true }, { text: "My dad died.", superseded: false }]);
eq("clearUnderstanding validated", validateDecision({ action: "ask", reply: "What did you mean?", clearUnderstanding: true }, "none").clearUnderstanding, true);
eq("understanding kept when model gives one", validateDecision({ action: "conversation", reply: "Go on.", understanding: "Grieving dad" }, "none").understanding, "Grieving dad");
eq("understanding null when absent", validateDecision({ action: "conversation", reply: "Go on." }, "none").understanding, null);

console.log("4b. correction with content keeps the new content, supersedes the old");
const h2 = [{ role: "user", text: "I used to want things." }, { role: "user", text: "No, that's not exactly it. I still want things. I just don't believe I'll do them." }];
eq("correction+content", buildMeaningfulContext(h2), [{ text: "I used to want things.", superseded: true }, { text: "I still want things. I just don't believe I'll do them.", superseded: false }]);
eq("bare correction classified", classifyTurn("No, that's not what I meant."), "correction");

console.log("5. latest message reaches the model once");
eq("dup stripped", cleanHistory([{ role: "user", text: "hi" }], "hi"), []);
eq("non-dup kept", cleanHistory([{ role: "user", text: "hello" }], "hi"), [{ role: "user", text: "hello" }]);

console.log("6. validation guards");
eq("safety flag forces safety", validateDecision({ action: "conversation", reply: "x", safety: "none" }, "check").action, "safety");
eq("practice corrected to need default", validateDecision({ action: "practice", reply: "ok", practice: { id: "just_listen", need: "boundary" } }, "none").practice.id, "choose_one_no");
eq("long reply not truncated", validateDecision({ action: "conversation", reply: "w ".repeat(300) }, "none").reply.length > 400, true);


console.log("7. Shift validation");
eq("focus target valid", validateShift("focus_target", { options:["Finish the hero copy","Wire the main button","Check the mobile layout"] }), { options:["Finish the hero copy","Wire the main button","Check the mobile layout"] });
eq("focus target rejects short list", validateShift("focus_target", { options:["One","Two"] }), null);
eq("focus blocker whitelists", validateShift("focus_blocker", { choices:["MAKE THE STEP SMALLER","BOGUS","TALK IT THROUGH"], note:"Keep it small." }), { choices:["MAKE THE STEP SMALLER","TALK IT THROUGH"], note:"Keep it small." });
eq("release question exact bank", validateShift("release_question", { question: RELEASE_QUESTIONS.anger[1] }, { subtype:"anger" }), { question: RELEASE_QUESTIONS.anger[1] });
eq("release question rejects invented", validateShift("release_question", { question:"Why are you like this?" }, { subtype:"anger" }), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
