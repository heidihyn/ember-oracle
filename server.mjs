// The Ember Oracle local server: serves the page and proxies the Arcade jewelry API so the key never reaches the browser.
// Without ARCADE_API_KEY the page runs in sample data mode.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArcade } from './lib/arcade.mjs';
import { wrapPage } from './scripts/build.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const arcade = createArcade(process.env);

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw new Error('Request too large'); }
  return raw ? JSON.parse(raw) : {};
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, wrapPage(await readFile(path.join(ROOT, 'public', 'app.html'), 'utf8')), 'text/html; charset=utf-8');
    }
    if (url.pathname.startsWith('/api/')) {
      const body = req.method === 'POST' ? await readJson(req) : null;
      const out = await arcade.handle(req.method, url.pathname.slice(5), body);
      return send(res, out.status, out.body);
    }
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'Server error' });
  }
}).listen(PORT, () => {
  console.log(`The Ember Oracle is listening on http://localhost:${PORT} (${process.env.ARCADE_API_KEY ? 'live Arcade mode' : 'sample data mode: set ARCADE_API_KEY for live designs and orders'})`);
});
