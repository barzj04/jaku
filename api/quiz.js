const { getLanguage, localPlan, buildQuestions } = require('../lib/quiz-core');

const COUNT = 5;

function parseBody(body) {
  if (body && typeof body === 'object') return body;
  try { return JSON.parse(body || '{}'); } catch { return {}; }
}

function extractJson(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Asks an LLM to PLAN the quiz (choose IDs, distractors, hints).
// It is never sent the indigenous-language text, so it cannot echo or invent it.
async function aiPlan(lang, weakIds) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) return null;

  const system = `You plan multiple-choice quizzes for Jaku, an app for learning ${lang.name}.
Rules:
- Use ONLY phrase ids from the provided list. Never write any ${lang.name} words.
- Put the learner's weak phrases first, then fill with others.
- For each question choose 3 distractorIds that are plausible confusions (same category or similar meaning).
- "type" is "to_english" or "to_native".
- "hint" is optional, English only, under 15 words, and must not reveal the answer.
Reply with JSON only: {"questions":[{"phraseId":"","type":"","distractorIds":["","",""],"hint":""}]} containing exactly ${COUNT} questions.`;

  const user = JSON.stringify({
    weakPhraseIds: weakIds,
    phrases: lang.phrases.map(({ id, en, category }) => ({ id, en, category })),
  });

  let text;
  if (anthropicKey) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
    const j = await r.json();
    text = j.content?.find((c) => c.type === 'text')?.text;
  } else {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    text = j.choices?.[0]?.message?.content;
  }

  const parsed = extractJson(text);
  return Array.isArray(parsed?.questions) ? parsed.questions : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = parseBody(req.body);
  const lang = getLanguage(body.lang);
  if (!lang) return res.status(400).json({ error: 'unknown language' });
  const weakIds = Array.isArray(body.weakIds)
    ? body.weakIds.filter((x) => typeof x === 'string').slice(0, 50)
    : [];

  let plan = null;
  try {
    plan = await aiPlan(lang, weakIds);
  } catch (e) {
    console.error('AI plan failed, using local planner:', e.message);
  }

  // AI plan first; local plan tops up anything invalid or missing.
  const questions = buildQuestions(lang.phrases, [...(plan || []), ...localPlan(lang.phrases, weakIds, COUNT)], COUNT);
  res.status(200).json({ source: plan ? 'ai' : 'local', questions });
};
