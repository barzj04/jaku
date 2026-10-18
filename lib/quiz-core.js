// Builds quiz questions ONLY from the vetted phrase dataset.
// The AI (if used) may only choose phrase IDs; every word shown to the
// learner is looked up here, so the AI can never invent language content.
const DATA = require('../data/phrases.json');

const TYPES = ['to_english', 'to_native'];

function getLanguage(key) {
  return Object.prototype.hasOwnProperty.call(DATA.languages, key) ? DATA.languages[key] : null;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fallback planner used when no AI key is set or the AI call fails.
function localPlan(phrases, weakIds = [], count = 5) {
  const ids = new Set(phrases.map((p) => p.id));
  const weak = shuffle([...new Set(weakIds)].filter((id) => ids.has(id)));
  const rest = shuffle(phrases.map((p) => p.id).filter((id) => !weak.includes(id)));
  return [...weak, ...rest].slice(0, count).map((id) => ({
    phraseId: id,
    type: TYPES[Math.floor(Math.random() * TYPES.length)],
    distractorIds: [],
  }));
}

// Validates a plan (from the AI or local) and turns it into questions.
function buildQuestions(phrases, plan, count = 5) {
  const map = new Map(phrases.map((p) => [p.id, p]));
  const used = new Set();
  const out = [];

  for (const item of Array.isArray(plan) ? plan : []) {
    if (out.length >= count) break;
    const p = item && map.get(item.phraseId);
    if (!p || used.has(p.id)) continue;
    used.add(p.id);

    const type = TYPES.includes(item.type) ? item.type : 'to_english';
    const field = type === 'to_english' ? 'en' : 'native';
    const seen = new Set([p[field].toLowerCase()]);
    const pick = (id) => {
      if (id === p.id || !map.has(id)) return false;
      const t = map.get(id)[field].toLowerCase();
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    };

    const distractors = [];
    for (const id of Array.isArray(item.distractorIds) ? item.distractorIds : []) {
      if (distractors.length < 3 && !distractors.includes(id) && pick(id)) distractors.push(id);
    }
    for (const q of shuffle(phrases)) {
      if (distractors.length >= 3) break;
      if (!distractors.includes(q.id) && pick(q.id)) distractors.push(q.id);
    }

    let hint = typeof item.hint === 'string' ? item.hint.trim().slice(0, 140) : '';
    const lower = hint.toLowerCase();
    if (lower.includes(p.en.toLowerCase()) || lower.includes(p.native.toLowerCase())) hint = '';

    out.push({
      id: p.id,
      type,
      promptLabel: type === 'to_english' ? 'What does this mean?' : 'How do you say this?',
      prompt: type === 'to_english' ? p.native : p.en,
      options: shuffle([p.id, ...distractors]).map((id) => ({ id, text: map.get(id)[field] })),
      answerId: p.id,
      hint,
    });
  }
  return out;
}

module.exports = { DATA, TYPES, getLanguage, localPlan, buildQuestions, shuffle };
