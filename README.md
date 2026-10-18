# Jaku: AI Tutor for Borneo's Indigenous Languages

Jaku helps beginners learn everyday phrases in **Iban** (Sarawak) and **Kadazan-Dusun** (Sabah). These languages aren't on mainstream apps like Duolingo, and fewer young people are learning them at home.

Built for the **STEM2Connect AI Hackathon 2026**, Education / Community Impact track.

**Live demo:** _add your Vercel URL_ · **Demo video:** _add your YouTube link_

## Features

- **Flashcards:** each phrase with English and Malay translations and cultural notes, filterable by topic.
- **AI-planned quizzes:** an LLM plans each 5-question quiz around phrases you've missed before and picks plausible distractors.
- **Pronunciation check:** record yourself saying a phrase. Jaku transcribes it and scores how close you were, word by word.

## How AI is used (and kept safe)

Large language models are unreliable in low-resource languages like Iban, and they will happily invent words. So Jaku **never lets the AI write language content**.

1. **Quiz planning:** Claude (or GPT) receives only phrase **IDs, English meanings and categories**. It never sees the Iban or Kadazan-Dusun text. It returns a plan: which phrase IDs to ask, which IDs to use as distractors, and an optional English hint.
2. **Server-side validation** (`lib/quiz-core.js`): the plan is checked against the dataset. Unknown IDs, duplicates, invalid types and hints that reveal the answer are discarded, and anything missing is topped up by an offline planner. Every word the learner sees is looked up from `data/phrases.json`.
3. **Speech recognition:** OpenAI Whisper transcribes the recording. No speech model supports Iban or Kadazan-Dusun, so Jaku uses Malay mode (closest spelling) and treats the score as an approximation. The target phrase is deliberately *not* passed to Whisper, so the transcript isn't biased toward a "correct" answer.

Pronunciation score (normalized edit distance between transcript `t` and target phrase `p`):

```
score = 1 - Levenshtein(t, p) / max(|t|, |p|)
```

Tests in `test/` check that even a deliberately malicious AI plan can't put non-dataset text on screen.

## AI tools and APIs

| Tool | Used for | Required? |
|---|---|---|
| Anthropic Claude API | Quiz planning | Optional (falls back to OpenAI, then the offline planner) |
| OpenAI Whisper API | Speech-to-text | Optional (falls back to the browser's Web Speech API) |
| Web Speech API | Free speech recognition fallback (Chrome/Edge) | Built into the browser |

The app works fully **without any API keys**. It's just less adaptive.

## Run it locally

Requires Node.js 18+. There are no dependencies to install.

```bash
git clone https://github.com/<your-username>/jaku.git
cd jaku
cp .env.example .env   # optional: add API keys
node server.js
```

Open http://localhost:3000. Microphone access works on `localhost` and HTTPS only.

Run the tests:

```bash
npm test
```

## Deploy (free)

1. Push the repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new). No build settings are needed: `public/` is served as static files and `api/` as serverless functions.
3. Add `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` under **Project → Settings → Environment Variables**, then redeploy.

## Project structure

```
api/            Serverless endpoints (phrases, quiz, transcribe)
lib/quiz-core.js  Quiz validation: the "AI can't invent words" safeguard
data/phrases.json Phrase dataset
public/         Frontend (HTML, CSS, vanilla JS)
server.js       Zero-dependency local dev server
test/           Node built-in test runner
```

## Phrase data

`data/phrases.json` is a **starter set that still needs native-speaker review**. Every entry has `"verified": false`, which shows as an "unverified" badge in the app. To verify an entry, have a native speaker check it, set `verified` to `true` and fill in `source`.

Adding a language: add a new key under `languages` with `name`, `region` and `phrases`. The UI picks it up automatically.

## What's next

- Native-speaker audio recordings for every phrase
- More languages: Bidayuh, Melanau, Murut
- A community contribution flow, reviewed by native speakers before publishing

## License

MIT
