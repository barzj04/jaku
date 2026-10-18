const test = require('node:test');
const assert = require('node:assert');
const { DATA, localPlan, buildQuestions } = require('../lib/quiz-core');
const S = require('../public/js/score.js');

const iban = DATA.languages.iban.phrases;
const allText = new Set(iban.flatMap((p) => [p.en, p.native]));

test('every phrase has the required fields and a unique id', () => {
  const ids = new Set();
  for (const lang of Object.values(DATA.languages)) {
    for (const p of lang.phrases) {
      for (const f of ['id', 'native', 'en', 'ms', 'category']) assert.ok(p[f], `${p.id} missing ${f}`);
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
      ids.add(p.id);
    }
  }
});

test('quiz options come only from the dataset, even with a hostile AI plan', () => {
  const hostilePlan = [
    { phraseId: 'made-up-id', type: 'to_english', distractorIds: [] },
    { phraseId: 'iban-002', type: 'to_native', distractorIds: ['iban-002', 'fake', 'iban-003'], hint: 'Kati berita nuan?' },
    { phraseId: 'iban-002', type: 'to_english' },
    { phraseId: 'iban-009', type: 'invented_type', distractorIds: ['iban-010'] },
  ];
  const qs = buildQuestions(iban, [...hostilePlan, ...localPlan(iban, [], 5)], 5);
  assert.strictEqual(qs.length, 5);
  assert.strictEqual(new Set(qs.map((q) => q.id)).size, 5, 'no repeated phrases');
  for (const q of qs) {
    assert.strictEqual(q.options.length, 4);
    assert.ok(q.options.some((o) => o.id === q.answerId));
    assert.strictEqual(new Set(q.options.map((o) => o.text.toLowerCase())).size, 4, 'options unique');
    for (const o of q.options) assert.ok(allText.has(o.text), `"${o.text}" not from dataset`);
    assert.ok(['to_english', 'to_native'].includes(q.type));
  }
  const q2 = qs.find((q) => q.id === 'iban-002');
  assert.strictEqual(q2.hint, '', 'hint revealing the answer is removed');
});

test('local planner puts weak phrases first', () => {
  const plan = localPlan(iban, ['iban-005', 'iban-007'], 5);
  assert.deepStrictEqual(new Set(plan.slice(0, 2).map((x) => x.phraseId)), new Set(['iban-005', 'iban-007']));
});

test('pronunciation score', () => {
  assert.strictEqual(S.score('Kati berita nuan?', 'kati berita nuan'), 1);
  assert.ok(S.score('kati brita nuan', 'Kati berita nuan?') > 0.9);
  assert.ok(S.score('apa khabar', 'Kati berita nuan?') < 0.5);
  assert.strictEqual(S.score('', 'Au'), 0);
  const words = S.wordMatches('kati brita', 'Kati berita nuan');
  assert.deepStrictEqual(words.map((w) => w.hit), [true, true, false]);
});
