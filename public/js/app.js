const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// localStorage can be blocked; never let that break the app.
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const state = { data: null, features: {}, lang: store.get('jaku.lang', 'iban'), cat: 'all', idx: 0, quiz: null };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const phrases = () => state.data[state.lang].phrases;
const filtered = () => (state.cat === 'all' ? phrases() : phrases().filter((p) => p.category === state.cat));
const weakKey = () => `jaku.weak.${state.lang}`;

async function init() {
  try {
    const r = await fetch('/api/phrases');
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    state.data = j.languages;
    state.features = j.features || {};
  } catch {
    $('#load-error').classList.remove('hidden');
    $$('.view').forEach((v) => v.classList.remove('active'));
    return;
  }
  if (!state.data[state.lang]) state.lang = Object.keys(state.data)[0];

  $('#lang').innerHTML = Object.entries(state.data)
    .map(([k, l]) => `<option value="${esc(k)}">${esc(l.name)} (${esc(l.region)})</option>`).join('');
  $('#lang').value = state.lang;
  $('#lang').onchange = (e) => {
    state.lang = e.target.value;
    store.set('jaku.lang', state.lang);
    state.cat = 'all';
    state.idx = 0;
    resetQuiz();
    renderAll();
  };
  $$('.tab').forEach((t) => (t.onclick = () => show(t.dataset.view)));

  bindLearn();
  bindQuiz();
  bindSpeak();
  renderAll();
}

function show(view) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach((s) => s.classList.toggle('active', s.id === `view-${view}`));
}

function renderAll() {
  renderCategories();
  renderCard();
  renderSpeakOptions();
}

/* ---------- Learn ---------- */
function renderCategories() {
  const cats = [...new Set(phrases().map((p) => p.category))];
  $('#category').innerHTML = '<option value="all">All topics</option>' +
    cats.map((c) => `<option value="${esc(c)}">${esc(c[0].toUpperCase() + c.slice(1))}</option>`).join('');
  $('#category').value = state.cat;
}

function renderCard() {
  const list = filtered();
  if (!list.length) return;
  state.idx = ((state.idx % list.length) + list.length) % list.length;
  const p = list[state.idx];
  $('#card').classList.remove('flipped');
  $('#card-native').textContent = p.native;
  $('#card-en').textContent = p.en;
  $('#card-ms').textContent = `Malay: ${p.ms}`;
  $('#card-notes').textContent = p.notes || '';
  const b = $('#card-badge');
  b.textContent = p.verified ? 'verified' : 'unverified';
  b.className = `badge ${p.verified ? 'ok' : 'warn'}`;
  $('#card-count').textContent = `${state.idx + 1} / ${list.length}`;
}

function bindLearn() {
  const card = $('#card');
  const flip = () => card.classList.toggle('flipped');
  card.onclick = flip;
  card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
  $('#prev').onclick = () => { state.idx--; renderCard(); };
  $('#next').onclick = () => { state.idx++; renderCard(); };
  $('#category').onchange = (e) => { state.cat = e.target.value; state.idx = 0; renderCard(); };
  $('#practise').onclick = () => {
    $('#speak-phrase').value = filtered()[state.idx].id;
    renderSpeakTarget();
    show('speak');
  };
  document.addEventListener('keydown', (e) => {
    if (!$('#view-learn').classList.contains('active') || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft') { state.idx--; renderCard(); }
    if (e.key === 'ArrowRight') { state.idx++; renderCard(); }
  });
}

/* ---------- Quiz ---------- */
function resetQuiz() {
  state.quiz = null;
  $('#quiz-run').classList.add('hidden');
  $('#quiz-done').classList.add('hidden');
  $('#quiz-start').classList.remove('hidden');
}

function bindQuiz() {
  $('#quiz-go').onclick = startQuiz;
  $('#quiz-again').onclick = startQuiz;
  $('#quiz-next').onclick = () => {
    state.quiz.i++;
    if (state.quiz.i < state.quiz.questions.length) renderQuestion(); else finishQuiz();
  };
}

async function startQuiz() {
  const buttons = [$('#quiz-go'), $('#quiz-again')];
  buttons.forEach((b) => { b.disabled = true; b.dataset.label = b.textContent; b.textContent = 'Planning your quiz…'; });
  try {
    const r = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: state.lang, weakIds: store.get(weakKey(), []) }),
    });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!j.questions?.length) throw new Error('empty');
    state.quiz = { questions: j.questions, i: 0, correct: 0, missed: [] };
    const src = $('#quiz-source');
    src.textContent = j.source === 'ai' ? 'AI-planned' : 'Offline planner';
    src.className = `badge ${j.source === 'ai' ? 'ok' : ''}`;
    $('#quiz-start').classList.add('hidden');
    $('#quiz-done').classList.add('hidden');
    $('#quiz-run').classList.remove('hidden');
    renderQuestion();
  } catch {
    alert('Could not load a quiz. Check that the server is running and try again.');
  } finally {
    buttons.forEach((b) => { b.disabled = false; b.textContent = b.dataset.label; });
  }
}

function renderQuestion() {
  const { questions, i } = state.quiz;
  const q = questions[i];
  $('#quiz-progress').textContent = `Question ${i + 1} of ${questions.length}`;
  $('#quiz-label').textContent = q.promptLabel;
  $('#quiz-prompt').textContent = q.prompt;
  const h = $('#quiz-hint');
  h.textContent = q.hint ? `Hint: ${q.hint}` : '';
  h.classList.toggle('hidden', !q.hint);
  $('#quiz-next').classList.add('hidden');
  const box = $('#quiz-options');
  box.innerHTML = '';
  q.options.forEach((o) => {
    const b = document.createElement('button');
    b.className = 'option';
    b.textContent = o.text;
    b.dataset.id = o.id;
    b.onclick = () => answer(q, o.id, b);
    box.appendChild(b);
  });
}

function answer(q, id, btn) {
  const ok = id === q.answerId;
  const weak = new Set(store.get(weakKey(), []));
  if (ok) { state.quiz.correct++; weak.delete(q.id); } else { state.quiz.missed.push(q.id); weak.add(q.id); }
  store.set(weakKey(), [...weak]);

  $$('#quiz-options .option').forEach((b) => {
    b.disabled = true;
    if (b.dataset.id === q.answerId) b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong');
  });
  const last = state.quiz.i + 1 >= state.quiz.questions.length;
  $('#quiz-next').textContent = last ? 'See results' : 'Next';
  $('#quiz-next').classList.remove('hidden');
  $('#quiz-next').focus();
}

function finishQuiz() {
  const { correct, questions, missed } = state.quiz;
  $('#quiz-run').classList.add('hidden');
  $('#quiz-done').classList.remove('hidden');
  $('#quiz-score').textContent = `${correct} / ${questions.length}`;
  const map = new Map(phrases().map((p) => [p.id, p]));
  $('#quiz-summary').textContent = missed.length
    ? `Your next quiz will focus on: ${missed.map((id) => map.get(id).native).join(', ')}.`
    : 'Perfect score! Your next quiz will mix in new phrases.';
}

/* ---------- Speak ---------- */
let recorder = null;
let recognizer = null;

function renderSpeakOptions() {
  $('#speak-phrase').innerHTML = phrases()
    .map((p) => `<option value="${esc(p.id)}">${esc(p.native)} · ${esc(p.en)}</option>`).join('');
  renderSpeakTarget();
}

const currentTarget = () => phrases().find((p) => p.id === $('#speak-phrase').value) || phrases()[0];

function renderSpeakTarget() {
  const p = currentTarget();
  $('#speak-target').textContent = p.native;
  $('#speak-meaning').textContent = p.en;
  $('#speak-result').classList.add('hidden');
  status('');
}

function bindSpeak() {
  $('#speak-phrase').onchange = renderSpeakTarget;
  $('#record').onclick = toggleRecord;
}

const status = (t) => { $('#speak-status').textContent = t; };

function setRecording(on) {
  $('#record').classList.toggle('on', on);
  $('#record-label').textContent = on ? 'Recording… tap to stop' : 'Tap to record';
  if (on) status('Say the phrase now.');
}

async function toggleRecord() {
  if (recorder?.state === 'recording') { recorder.stop(); return; }
  if (recognizer) { recognizer.stop(); return; }

  const canRecord = navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  if (!state.features.whisper || !canRecord) return browserRecognize();

  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {
    return status('Microphone access was blocked. Allow it in your browser settings and try again.');
  }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = async () => {
    clearTimeout(recorder._timer);
    stream.getTracks().forEach((t) => t.stop());
    setRecording(false);
    await transcribe(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
  };
  recorder.start();
  setRecording(true);
  recorder._timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), 6000);
}

async function transcribe(blob) {
  status('Checking your pronunciation…');
  $('#record').disabled = true;
  try {
    const audio = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1]);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const r = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio, mime: blob.type }),
    });
    if (!r.ok) throw new Error(r.status);
    const { text } = await r.json();
    showResult(text, 'whisper');
  } catch {
    status('Transcription failed. Check your connection and try again.');
  } finally {
    $('#record').disabled = false;
  }
}

// Free fallback: the browser's built-in recogniser (best in Chrome).
function browserRecognize() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return status("This browser can't do speech recognition. Try Chrome or Edge.");
  recognizer = new SR();
  recognizer.lang = 'ms-MY';
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recognizer.onresult = (e) => showResult(e.results[0][0].transcript, 'browser');
  recognizer.onerror = (e) => status(e.error === 'no-speech' ? "Didn't catch that. Try again." : `Recognition error: ${e.error}`);
  recognizer.onend = () => { recognizer = null; setRecording(false); };
  recognizer.start();
  setRecording(true);
}

function showResult(text, engine) {
  const p = currentTarget();
  const s = JakuScore.score(text, p.native);
  const pct = Math.round(s * 100);
  $('#speak-result').classList.remove('hidden');
  const fill = $('#meter-fill');
  fill.style.width = `${pct}%`;
  fill.dataset.level = s >= 0.85 ? 'high' : s >= 0.6 ? 'mid' : 'low';
  $('#speak-score').textContent = `${pct}%`;
  $('#speak-verdict').textContent = JakuScore.verdict(s);
  $('#speak-heard').textContent = text || '(nothing heard)';
  $('#speak-words').innerHTML = JakuScore.wordMatches(text, p.native)
    .map((w) => `<span class="chip ${w.hit ? 'hit' : 'miss'}">${esc(w.word)}</span>`).join('');
  const via = engine === 'whisper' ? 'OpenAI Whisper' : 'your browser';
  status(`Transcribed by ${via}. Scores are approximate: no speech model is trained on ${state.data[state.lang].name} yet.`);
}

init();
