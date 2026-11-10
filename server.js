/*
 * Pillars & Palaces local server.
 * Serves the app and lets its chat features use Claude Code (your signed-in Claude account) or an
 * OpenAI-compatible server such as LM Studio. Plain Node 18+, no dependencies: run `node server.js`.
 * It listens on 127.0.0.1 only and accepts browser requests only from this app's own pages.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const PORT = Number(process.env.PORT) || 8787;
const HOST = '127.0.0.1';
const ROOT = __dirname;
const ALLOWED_ORIGINS = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, 'https://ghsaint.github.io']);
const CHAT_TIMEOUT_MS = 15 * 60 * 1000;

// Claude Code has no command that lists models, so these are the documented aliases and full names.
// "Check access" in the app tries each one with your account.
const CLAUDE_CODE_MODELS = [
  { id: 'default', label: 'My Claude Code default' },
  { id: 'opus', label: 'Opus (latest alias) — recommended' },
  { id: 'fable', label: 'Fable (latest alias) — most capable, slowest' },
  { id: 'sonnet', label: 'Sonnet (latest alias) — faster' },
  { id: 'haiku', label: 'Haiku (latest alias) — fastest' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }
];
const SYSTEM_PROMPT = 'You are the assistant inside the Pillars & Palaces app. Follow the instructions and use the chart data given in the user message.';

// ---------- Claude Code ----------
function findClaude() {
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, 'claude' + ext);
      try { if (fs.statSync(p).isFile()) return p; } catch (e) { /* not here */ }
    }
  }
  const fallback = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  return fs.existsSync(fallback) ? fallback : null;
}
const CLAUDE = findClaude();

// Use the signed-in subscription, never an API key that happens to be in the environment.
function claudeEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function claudeStatus() {
  return new Promise(resolve => {
    if (!CLAUDE) return resolve({ available: false, problem: 'The claude command was not found. Install Claude Code, then restart this server.' });
    execFile(CLAUDE, ['auth', 'status'], { env: claudeEnv(), timeout: 20000, windowsHide: true }, (err, stdout) => {
      let s = null;
      try { s = JSON.parse(stdout); } catch (e) { s = null; }
      if (!s) return resolve({ available: true, loggedIn: false, problem: 'Could not read the Claude Code login. Run `claude` once in a terminal to sign in.' });
      resolve({
        available: true, loggedIn: !!s.loggedIn, authMethod: s.authMethod, plan: s.subscriptionType || null, org: s.orgName || null,
        problem: s.loggedIn ? null : 'Claude Code is not signed in. Run `claude` once in a terminal to sign in.'
      });
    });
  });
}

// Flatten a chat into one prompt for `claude -p`: the first turn holds the instructions and chart data.
function transcript(messages) {
  if (messages.length === 1) return messages[0].content;
  const [first, ...rest] = messages;
  const lines = rest.map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`);
  return `${first.content}\n\n=== CONVERSATION SO FAR ===\n${lines.join('\n\n')}\n=== END ===\n\nReply to the last User message.`;
}

function runClaude(model, prompt, onEvent, signal) {
  return new Promise(resolve => {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--no-session-persistence', '--tools', '', '--system-prompt', SYSTEM_PROMPT];
    if (model && model !== 'default') args.push('--model', model);
    const child = spawn(CLAUDE, args, { env: claudeEnv(), cwd: os.tmpdir(), windowsHide: true });
    let buf = '', text = '', used = null, finished = false, stderr = '';
    const finish = r => { if (!finished) { finished = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { child.kill(); finish({ ok: false, error: 'Claude Code took too long to answer.' }); }, CHAT_TIMEOUT_MS);
    if (signal) signal.addEventListener('abort', () => { child.kill(); finish({ ok: false, error: 'cancelled' }); });
    child.stdout.on('data', d => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let o; try { o = JSON.parse(line); } catch (e) { continue; }
        if (o.type === 'system' && o.subtype === 'init' && o.model) { used = o.model; onEvent({ type: 'model', model: o.model }); }
        else if (o.type === 'stream_event' && o.event && o.event.delta && o.event.delta.type === 'text_delta') { text += o.event.delta.text; onEvent({ type: 'text', text: o.event.delta.text }); }
        else if (o.type === 'result') {
          if (o.is_error || o.subtype !== 'success') finish({ ok: false, error: o.result || 'Claude Code returned an error.', text });
          else {
            const usage = o.modelUsage || {};
            const main = Object.keys(usage).sort((a, b) => (usage[b].outputTokens || 0) - (usage[a].outputTokens || 0))[0] || used;
            finish({ ok: true, text: text || o.result || '', model: main });
          }
        }
      }
    });
    child.stderr.on('data', d => { stderr += d.toString('utf8'); });
    child.on('error', e => finish({ ok: false, error: `Could not start Claude Code: ${e.message}` }));
    child.on('close', code => finish(code === 0 && text ? { ok: true, text, model: used } : { ok: false, error: (stderr.trim().split('\n').pop() || `Claude Code exited with code ${code}.`) + ' If you are not signed in, run `claude` once in a terminal.', text }));
    child.stdin.end(prompt);
  });
}

// ---------- OpenAI-compatible (LM Studio, Ollama, OpenAI…) ----------
const cleanBase = u => String(u || 'http://localhost:1234/v1').trim().replace(/\/+$/, '');
const authHeaders = key => (key ? { Authorization: `Bearer ${key}` } : {});

async function openaiModels(baseUrl, apiKey) {
  const r = await fetch(`${cleanBase(baseUrl)}/models`, { headers: authHeaders(apiKey) });
  if (!r.ok) throw new Error(`The server answered ${r.status} ${r.statusText}.`);
  const j = await r.json();
  return (j.data || j.models || []).map(m => m.id || m.name).filter(Boolean);
}

async function runOpenAI({ baseUrl, apiKey, model, messages }, onEvent, signal) {
  let r;
  try {
    r = await fetch(`${cleanBase(baseUrl)}/chat/completions`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
      body: JSON.stringify({ model, messages, stream: true })
    });
  } catch (e) {
    if (signal && signal.aborted) return { ok: false, error: 'cancelled' };
    return { ok: false, error: `Could not reach ${cleanBase(baseUrl)}. Is the server running?` };
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    return { ok: false, error: `The server answered ${r.status}: ${body.slice(0, 300)}` };
  }
  let buf = '', text = '', used = model;
  const dec = new TextDecoder();
  try {
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let o; try { o = JSON.parse(data); } catch (e) { continue; }
        if (o.model) used = o.model;
        const delta = o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content;
        if (delta) { text += delta; onEvent({ type: 'text', text: delta }); }
      }
    }
  } catch (e) {
    if (signal && signal.aborted) return { ok: false, error: 'cancelled', text };
    return { ok: false, error: `The connection broke: ${e.message}`, text };
  }
  return text ? { ok: true, text, model: used } : { ok: false, error: 'The model returned an empty answer.' };
}

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
// index.html is written for the claude.ai artifact wrapper, which supplies the document head
const HEAD = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>';

function corsHeaders(req) {
  const o = req.headers.origin;
  if (!o || !ALLOWED_ORIGINS.has(o)) return {};
  return { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true' };
}
function sendJson(req, res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(req) });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 2e6) { reject(new Error('Request too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(new Error('Invalid JSON')); } });
  });
}
function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || rel.split('/').some(seg => seg.startsWith('.')) || /server\.js$/.test(file)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(ext === '.html' ? HEAD + data.toString('utf8') + '</body></html>' : data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const isApi = url.pathname.startsWith('/api/');
  // A browser on another site must not drive Claude Code on this computer.
  if (isApi && req.headers.origin && !ALLOWED_ORIGINS.has(req.headers.origin)) return sendJson(req, res, 403, { error: 'This origin is not allowed.' });
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
  try {
    if (url.pathname === '/api/health') return sendJson(req, res, 200, { ok: true, app: 'pillars-palaces', claudeCode: !!CLAUDE });
    if (url.pathname === '/api/claude-code/status') return sendJson(req, res, 200, { ...(await claudeStatus()), models: CLAUDE_CODE_MODELS });
    if (url.pathname === '/api/claude-code/check' && req.method === 'POST') {
      const { model } = await readBody(req);
      if (!CLAUDE) return sendJson(req, res, 200, { ok: false, error: 'Claude Code is not installed.' });
      let resolved = null;
      const r = await runClaude(String(model || 'default'), 'Reply with the single word OK.', ev => { if (ev.type === 'model') resolved = ev.model; });
      return sendJson(req, res, 200, { ok: r.ok, model: r.model || resolved, error: r.ok ? null : r.error });
    }
    if (url.pathname === '/api/openai/models' && req.method === 'POST') {
      const { baseUrl, apiKey } = await readBody(req);
      try { return sendJson(req, res, 200, { ok: true, models: await openaiModels(baseUrl, apiKey) }); }
      catch (e) { return sendJson(req, res, 200, { ok: false, error: `Could not list models at ${cleanBase(baseUrl)}: ${e.message}` }); }
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = await readBody(req);
      const messages = Array.isArray(body.messages) ? body.messages.filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')) : [];
      if (!messages.length) return sendJson(req, res, 400, { error: 'No messages.' });
      const ctl = new AbortController();
      res.on('close', () => { if (!res.writableFinished) ctl.abort(); });
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(req) });
      const emit = ev => res.write(JSON.stringify(ev) + '\n');
      let r;
      if (body.provider === 'claude_code') {
        r = CLAUDE ? await runClaude(String(body.model || 'default'), transcript(messages), emit, ctl.signal) : { ok: false, error: 'Claude Code is not installed.' };
      } else if (body.provider === 'openai') {
        if (!body.model) r = { ok: false, error: 'Choose a model first.' };
        else r = await runOpenAI({ baseUrl: body.baseUrl, apiKey: body.apiKey, model: String(body.model), messages }, emit, ctl.signal);
      } else r = { ok: false, error: 'Unknown provider.' };
      emit(r.ok ? { type: 'done', text: r.text, model: r.model } : { type: 'error', message: r.error, text: r.text });
      return res.end();
    }
    if (isApi) return sendJson(req, res, 404, { error: 'Not found' });
    serveStatic(req, res);
  } catch (e) {
    if (!res.headersSent) sendJson(req, res, 500, { error: e.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Pillars & Palaces is running at http://localhost:${PORT}`);
  console.log(CLAUDE ? `Claude Code found: ${CLAUDE}` : 'Claude Code not found: the Claude Code option will be unavailable.');
  console.log('Press Ctrl+C to stop.');
});
