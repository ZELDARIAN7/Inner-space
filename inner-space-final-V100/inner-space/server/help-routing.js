/**
 * Curated practice library index (V3.1).
 * The orchestrator may only ever choose one of these ids; it never writes exercises.
 * The step content lives in the page (PRACTICES); this file is what the model is allowed to pick from.
 */
export const NEEDS = ["calm","clarify","prioritize","next_step","boundary","confidence","release","prepare_conversation","understand_pattern","self_compassion","reflect","listen"];

export const PRACTICES = {
  one_thing_can_wait:       "Too much at once: choose one thing that can wait and the one thing that needs them today.",
  choose_one_next_step:     "Lost or stuck: identify one small concrete next step and when to do it.",
  separate_control:         "Circumstances they can't control: separate what's outside their control from what they can influence.",
  choose_one_no:            "Over-committed / saying yes to everyone: pick one thing that doesn't need their yes today.",
  name_the_real_decision:   "Unclear situation: state the actual decision in one sentence and what they'd need to feel 70% sure.",
  evidence_for_confidence:  "Self-doubt: put concrete evidence of past handling and real strengths next to the doubt.",
  release_one_expectation:  "Holding on / self-pressure: loosen one expectation from themselves or others.",
  prepare_one_sentence:     "A hard conversation is coming: prepare the one calm opening sentence.",
  notice_the_pattern:       "Wants to understand a pattern: notice when it shows up and what it might be protecting, without judgment.",
  pause_and_ground:         "Activated / racing / needs to slow down: a short breath with the Orb and one grounding observation.",
  just_listen:              "Mostly needs to be heard: no exercise, invite them to say more."
};

/** Which practices fit each need. First entry = default for that need. */
export const NEED_PRACTICES = {
  calm:                 ["pause_and_ground","separate_control"],
  clarify:              ["name_the_real_decision","separate_control"],
  prioritize:           ["one_thing_can_wait","choose_one_next_step"],
  next_step:            ["choose_one_next_step","one_thing_can_wait"],
  boundary:             ["choose_one_no"],
  confidence:           ["evidence_for_confidence"],
  release:              ["release_one_expectation"],
  prepare_conversation: ["prepare_one_sentence"],
  understand_pattern:   ["notice_the_pattern"],
  self_compassion:      ["release_one_expectation","pause_and_ground"],
  reflect:              ["notice_the_pattern","just_listen"],
  listen:               ["just_listen"]
};
