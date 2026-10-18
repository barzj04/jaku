// Pronunciation scoring: normalized Levenshtein distance between the
// transcript and the target phrase. Shared by the browser and the tests.
(function (root) {
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // score = 1 - Levenshtein(t, p) / max(|t|, |p|)
  function score(transcript, target) {
    const t = normalize(transcript);
    const p = normalize(target);
    if (!t && !p) return 1;
    return Math.max(0, 1 - levenshtein(t, p) / Math.max(t.length, p.length));
  }

  // Which target words were heard (allowing one-letter slips on longer words).
  function wordMatches(transcript, target) {
    const heard = normalize(transcript).split(' ').filter(Boolean);
    return normalize(target).split(' ').filter(Boolean).map((w) => ({
      word: w,
      hit: heard.some((h) => h === w || (Math.max(h.length, w.length) > 3 && levenshtein(h, w) <= 1)),
    }));
  }

  function verdict(s) {
    if (s >= 0.85) return 'Excellent!';
    if (s >= 0.6) return 'Close, try once more';
    return 'Keep practising';
  }

  const api = { normalize, levenshtein, score, wordMatches, verdict };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JakuScore = api;
})(typeof self !== 'undefined' ? self : this);
