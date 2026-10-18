// Local dev server: serves /public and runs the same /api handlers Vercel uses.
// No dependencies. Run with: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const ROUTES = {
  '/api/phrases': require('./api/phrases'),
  '/api/quiz': require('./api/quiz'),
  '/api/transcribe': require('./api/transcribe'),
};
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

  if (ROUTES[url.pathname]) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 5_000_000) return res.status(413).json({ error: 'body too large' });
      chunks.push(c);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ error: 'invalid JSON' }); }
    try { await ROUTES[url.pathname](req, res); } catch (e) {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: 'server error' });
    }
    return;
  }

  const file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`Jaku running at http://localhost:${PORT}`);
  console.log(`AI quiz: ${process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ? 'on' : 'off (offline planner)'}`);
  console.log(`Whisper: ${process.env.OPENAI_API_KEY ? 'on' : 'off (browser speech recognition)'}`);
});
