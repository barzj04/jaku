// Sends the learner's recording to OpenAI Whisper and returns the transcript.
// No model is trained on Iban or Kadazan-Dusun, so we use Malay ('ms'),
// whose spelling is closest. We deliberately do NOT pass the target phrase
// as a prompt, because that would bias the transcript toward a "correct" score.
const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(501).json({ error: 'no_key' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body.audio !== 'string') return res.status(400).json({ error: 'missing audio' });

  const buf = Buffer.from(body.audio, 'base64');
  if (!buf.length) return res.status(400).json({ error: 'empty audio' });
  if (buf.length > 3_000_000) return res.status(413).json({ error: 'recording too long' });

  const mime = typeof body.mime === 'string' && body.mime ? body.mime.split(';')[0] : 'audio/webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime }), `clip.${EXT[mime] || 'webm'}`);
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1');
  form.append('language', 'ms');

  try {
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      console.error('Whisper error:', r.status, await r.text());
      return res.status(502).json({ error: 'transcription_failed' });
    }
    const j = await r.json();
    res.status(200).json({ text: j.text || '' });
  } catch (e) {
    console.error('Whisper request failed:', e.message);
    res.status(502).json({ error: 'transcription_failed' });
  }
};
