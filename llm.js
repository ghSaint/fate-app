/*
 * Pillars & Palaces: choose which AI answers questions.
 *  - Claude on claude.ai: the page's `sample` capability (only inside the claude.ai viewer).
 *  - Claude Code: your signed-in Claude account, through the local server (node server.js).
 *  - OpenAI-compatible: LM Studio, Ollama, OpenAI…, through the local server or directly from the browser.
 * Exposes window.LLM: ready(), status(), label(), supportsTools(), ask(messages, opts), onChange(fn), open().
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PROVIDERS = {
    claudeai: 'Claude on claude.ai',
    claude_code: 'Claude Code (my Claude login)',
    openai: 'LM Studio / OpenAI-compatible'
  };
  const CLAUDEAI_MODELS = [
    { id: 'tier:default', label: 'Balanced (default)' },
    { id: 'tier:complex', label: 'Most capable tier' },
    { id: 'tier:quick', label: 'Fastest tier' },
    { id: 'model:claude-opus-5-5', label: 'Claude Opus 5.5' },
    { id: 'model:claude-fable-5-1', label: 'Claude Fable 5.1' },
    { id: 'model:claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
    { id: 'model:claude-haiku-5-5', label: 'Claude Haiku 5.5' }
  ];
  const DEFAULT_BASE = 'http://localhost:1234/v1';

  // ---------- Saved settings (per browser) ----------
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('pp-ai') || '{}') || {}; } catch (e) { saved = {}; }
  const cfg = {
    provider: saved.provider || null,
    models: Object.assign({ claudeai: 'tier:default', claude_code: 'opus', openai: '' }, saved.models || {}),
    baseUrl: saved.baseUrl || DEFAULT_BASE,
    checked: saved.checked || {}
  };
  let apiKey = ''; // kept in memory only
  const persist = () => { try { localStorage.setItem('pp-ai', JSON.stringify({ provider: cfg.provider, models: cfg.models, baseUrl: cfg.baseUrl, checked: cfg.checked })); } catch (e) { /* storage unavailable */ } };

  // ---------- Detection ----------
  const avail = { claudeai: null, server: null, cc: null, ccModels: [] }; // null = still checking
  let sampleFn = null, sampleTools = false;
  const listeners = [];
  const changed = () => { render(); listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); };

  const onLocalServer = /^https?:$/.test(location.protocol) && ['localhost', '127.0.0.1'].includes(location.hostname);
  const SERVER = onLocalServer ? location.origin : 'http://127.0.0.1:8787';
  const inClaudeViewer = !!(window.claude && window.claude.use);

  async function fetchJson(url, opts, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 4000);
    try {
      const r = await fetch(url, { ...opts, signal: ctl.signal });
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function detect() {
    if (inClaudeViewer) {
      window.claude.use('sample').then(async fn => {
        sampleFn = fn || null;
        avail.claudeai = !!fn;
        if (fn) { try { sampleTools = !!(await fn.limits()).tools; } catch (e) { sampleTools = false; } }
        pickDefault(); changed();
      }).catch(() => { avail.claudeai = false; pickDefault(); changed(); });
    } else avail.claudeai = false;

    if (inClaudeViewer && !onLocalServer) { avail.server = false; avail.cc = { available: false }; } // the artifact frame cannot reach this computer
    else {
      try {
        const h = await fetchJson(`${SERVER}/api/health`, {}, 2500);
        avail.server = !!(h && h.ok);
      } catch (e) { avail.server = false; }
      if (avail.server) {
        try {
          const s = await fetchJson(`${SERVER}/api/claude-code/status`, {}, 25000);
          avail.cc = s; avail.ccModels = s.models || [];
        } catch (e) { avail.cc = { available: false, problem: 'Could not read the Claude Code status from the local server.' }; }
      } else avail.cc = { available: false };
    }
    pickDefault(); changed();
  }

  function usable(p) {
    if (p === 'claudeai') return avail.claudeai === true;
    if (p === 'claude_code') return !!(avail.server && avail.cc && avail.cc.available && avail.cc.loggedIn);
    if (p === 'openai') return !inClaudeViewer || onLocalServer; // the claude.ai frame blocks other hosts
    return false;
  }
  function pickDefault() {
    if (cfg.provider && (usable(cfg.provider) || stillChecking(cfg.provider))) return;
    cfg.provider = ['claudeai', 'claude_code', 'openai'].find(usable) || cfg.provider || 'claudeai';
  }
  const stillChecking = p => (p === 'claudeai' && avail.claudeai === null) || (p === 'claude_code' && avail.server === null);

  // ---------- Public status ----------
  function modelLabel(p) {
    const m = cfg.models[p];
    if (p === 'claudeai') return (CLAUDEAI_MODELS.find(x => x.id === m) || CLAUDEAI_MODELS[0]).label;
    if (p === 'claude_code') return ((avail.ccModels.find(x => x.id === m) || {}).label || m || 'default').split(' — ')[0];
    return m || 'no model chosen';
  }
  function label() { return `${PROVIDERS[cfg.provider] || 'AI'} · ${modelLabel(cfg.provider)}`; }
  function ready() {
    if (!usable(cfg.provider)) return false;
    if (cfg.provider === 'openai' && !cfg.models.openai) return false;
    return true;
  }
  function status() {
    const p = cfg.provider;
    if (stillChecking(p)) return { ok: false, message: 'Checking which AI is available…' };
    if (ready()) {
      const extra = p === 'claudeai' ? ' Uses your claude.ai account; the first question asks for permission.'
        : p === 'claude_code' ? ' Uses your Claude Code login on this computer.'
        : ` Uses the server at ${cfg.baseUrl}.`;
      return { ok: true, message: `Answering with ${label()}.${extra}` };
    }
    if (p === 'claudeai') return { ok: false, message: inClaudeViewer ? 'Claude is not reachable in this view. Choose another AI model, or open the claude.ai/artifact link while signed in.' : 'Claude on claude.ai only works inside claude.ai. Choose Claude Code or LM Studio under AI model.' };
    if (p === 'claude_code') {
      if (!avail.server) return { ok: false, message: 'Claude Code needs the local server. Run `node server.js` in the app folder, then open http://localhost:8787.' };
      return { ok: false, message: (avail.cc && avail.cc.problem) || 'Claude Code is not available.' };
    }
    if (p === 'openai') return { ok: false, message: usable('openai') ? 'Choose a model under AI model (start LM Studio’s server and click Load models).' : 'LM Studio cannot be reached from inside claude.ai. Use the local server instead.' };
    return { ok: false, message: 'Choose an AI model.' };
  }
  const supportsTools = () => cfg.provider === 'claudeai' && sampleTools;

  // ---------- Asking ----------
  // Resolves {text, truncated, model}; rejects {code, message, text}. Codes from claude.ai pass through.
  async function ask(messages, opts) {
    opts = opts || {};
    if (!ready()) throw { code: 'not_ready', message: status().message };
    const p = cfg.provider;
    if (p === 'claudeai') {
      const m = cfg.models.claudeai || 'tier:default';
      const o = { signal: opts.signal, cache: false, onText: opts.onText };
      if (m.startsWith('model:')) { o.model = m.slice(6); o.modelTier = 'default'; } else o.modelTier = m.slice(5);
      if (opts.tools && sampleTools) o.tools = opts.tools;
      const r = await sampleFn(messages, o);
      return { text: r.text, truncated: r.truncated, model: r.modelApplied || `Claude (${r.modelTierApplied} tier)` };
    }
    let text = '';
    const emit = delta => { text += delta; if (opts.onText) opts.onText({ text, delta }); };
    if (p === 'openai' && !avail.server) return askOpenAIDirect(messages, opts, emit);
    let r;
    try {
      r = await fetch(`${SERVER}/api/chat`, {
        method: 'POST', signal: opts.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p, model: cfg.models[p], messages, baseUrl: cfg.baseUrl, apiKey: apiKey || undefined })
      });
    } catch (e) {
      if (opts.signal && opts.signal.aborted) throw { code: 'cancelled', text };
      throw { code: 'network', message: 'Could not reach the local server. Is `node server.js` still running?' };
    }
    if (!r.ok) throw { code: 'server', message: `The local server answered ${r.status}.` };
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '', model = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'model') model = ev.model;
          else if (ev.type === 'text') emit(ev.text);
          else if (ev.type === 'done') return { text: ev.text || text, truncated: false, model: ev.model || model || modelLabel(p) };
          else if (ev.type === 'error') throw { code: ev.message === 'cancelled' ? 'cancelled' : 'provider', message: ev.message, text: text || ev.text };
        }
      }
    } catch (e) {
      if (opts.signal && opts.signal.aborted) throw { code: 'cancelled', text };
      if (e && e.code) throw e;
      throw { code: 'network', message: 'The connection to the local server broke.', text };
    }
    if (!text) throw { code: 'provider', message: 'No answer came back.' };
    return { text, truncated: false, model: model || modelLabel(p) };
  }

  // Without the local server, talk to LM Studio straight from the browser (enable CORS in LM Studio).
  async function askOpenAIDirect(messages, opts, emit) {
    let r, text = '', model = cfg.models.openai;
    try {
      r = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST', signal: opts.signal,
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ model, messages, stream: true })
      });
    } catch (e) {
      if (opts.signal && opts.signal.aborted) throw { code: 'cancelled' };
      throw { code: 'network', message: `Could not reach ${cfg.baseUrl}. Start the LM Studio server and turn on its CORS setting, or run the app through node server.js.` };
    }
    if (!r.ok) throw { code: 'provider', message: `The server answered ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}` };
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let o; try { o = JSON.parse(data); } catch (e) { continue; }
          if (o.model) model = o.model;
          const d = o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content;
          if (d) { text += d; emit(d); }
        }
      }
    } catch (e) {
      if (opts.signal && opts.signal.aborted) throw { code: 'cancelled', text };
      throw { code: 'network', message: 'The connection broke.', text };
    }
    if (!text) throw { code: 'provider', message: 'The model returned an empty answer.' };
    return { text, truncated: false, model };
  }

  // ---------- Settings panel ----------
  const tabs = document.querySelector('.tabs');
  if (!tabs) return;
  tabs.insertAdjacentHTML('beforeend', '<button type="button" class="ai-chip" id="ai-toggle" aria-expanded="false" aria-controls="ai-panel">AI model: <b id="ai-chip-label">checking…</b></button>');
  tabs.insertAdjacentHTML('afterend', '<div class="panel ai-panel" id="ai-panel" hidden></div>');
  $('#ai-toggle').addEventListener('click', () => toggle());
  function toggle(force) {
    const p = $('#ai-panel');
    const show = force === undefined ? p.hidden : force;
    p.hidden = !show;
    $('#ai-toggle').setAttribute('aria-expanded', String(show));
    if (show) render();
  }

  function render() {
    const chip = $('#ai-chip-label');
    if (chip) chip.textContent = stillChecking(cfg.provider) ? 'checking…' : (ready() ? label() : 'not set up');
    const el = $('#ai-panel');
    if (!el || el.hidden) return;
    const p = cfg.provider;
    const radio = (id) => {
      const ok = usable(id);
      const note = id === 'claudeai' ? (avail.claudeai === null ? 'checking' : ok ? 'available' : 'only inside claude.ai')
        : id === 'claude_code' ? (avail.server === null ? 'checking' : !avail.server ? 'needs node server.js' : ok ? `signed in${avail.cc.plan ? ' · ' + avail.cc.plan + ' plan' : ''}` : 'not signed in')
        : (ok ? (avail.server ? 'via local server' : 'direct (enable CORS in LM Studio)') : 'not from inside claude.ai');
      return `<label class="ai-prov ${p === id ? 'on' : ''}"><input type="radio" name="ai-prov" value="${id}" ${p === id ? 'checked' : ''}><span><b>${PROVIDERS[id]}</b><small>${note}</small></span></label>`;
    };
    const opt = (list, cur) => list.map(m => `<option value="${esc(m.id)}" ${m.id === cur ? 'selected' : ''}>${esc(m.label)}${cfg.checked[m.id] ? ` ${cfg.checked[m.id].ok ? '✓' : '✗'}` : ''}</option>`).join('');
    let body = '';
    if (p === 'claudeai') {
      body = `<div class="field"><label for="ai-m-claudeai">Model</label><select id="ai-m-claudeai">${opt(CLAUDEAI_MODELS, cfg.models.claudeai)}</select></div>
        <p class="note">Tiers follow your plan. A named model answers if your claude.ai account can use it; otherwise the balanced tier answers, and the chat says which model replied.</p>`;
    } else if (p === 'claude_code') {
      const list = avail.ccModels.length ? avail.ccModels : [{ id: 'default', label: 'My Claude Code default' }, { id: 'opus', label: 'Opus' }, { id: 'sonnet', label: 'Sonnet' }, { id: 'haiku', label: 'Haiku' }];
      const checks = Object.entries(cfg.checked).filter(([id]) => list.some(m => m.id === id));
      body = `<div class="field"><label for="ai-m-cc">Model</label><select id="ai-m-cc">${opt(list, cfg.models.claude_code)}</select></div>
        <div class="actions"><button type="button" class="btn ghost" id="ai-cc-check" ${usable('claude_code') ? '' : 'disabled'}>Check access to all models</button><span class="note" id="ai-cc-note">Sends a one-word test to each model with your account (a few tokens each).</span></div>
        ${checks.length ? `<ul class="ai-checks">${checks.map(([id, r]) => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} <b>${esc(id)}</b> ${r.ok ? `→ ${esc(r.model || '')}` : esc(r.error || 'not available')}</li>`).join('')}</ul>` : ''}
        <p class="note">Claude Code has no command that lists models, so this shows its aliases (which always point to the newest version) and full model names. ${avail.server ? '' : 'Start the local server with <code>node server.js</code> in the app folder, then open <code>http://localhost:8787</code>.'}</p>`;
    } else {
      body = `<div class="fields">
          <div class="field"><label for="ai-base">Server address</label><input id="ai-base" type="url" value="${esc(cfg.baseUrl)}" placeholder="${DEFAULT_BASE}"></div>
          <div class="field"><label for="ai-key">API key (if the server needs one)</label><input id="ai-key" type="password" autocomplete="off" value="${esc(apiKey)}" placeholder="not needed for LM Studio"></div>
          <div class="field"><label for="ai-m-oa">Model</label><input id="ai-m-oa" list="ai-oa-list" value="${esc(cfg.models.openai)}" placeholder="click Load models"><datalist id="ai-oa-list"></datalist></div>
        </div>
        <div class="actions"><button type="button" class="btn ghost" id="ai-oa-load">Load models</button><span class="note" id="ai-oa-note">In LM Studio, open the Developer tab, load a model and start the server (port 1234).</span></div>
        <p class="note">Works with LM Studio, Ollama (<code>http://localhost:11434/v1</code>), OpenAI and other OpenAI-compatible servers. The API key stays in this page’s memory and is not saved. ${avail.server ? '' : 'Without the local server the browser connects directly, so turn on CORS in LM Studio’s server settings.'}</p>`;
    }
    const st = status();
    el.innerHTML = `<div class="ai-head"><h3>Which AI answers your questions</h3><button type="button" class="linkbtn" id="ai-close">Close</button></div>
      <div class="ai-provs" role="radiogroup" aria-label="AI provider">${radio('claudeai')}${radio('claude_code')}${radio('openai')}</div>
      ${body}
      <p class="ai-status ${st.ok ? 'ok' : 'bad'}">${esc(st.message)}</p>`;
    el.querySelectorAll('input[name="ai-prov"]').forEach(r => r.addEventListener('change', () => { cfg.provider = r.value; persist(); changed(); }));
    $('#ai-close').addEventListener('click', () => toggle(false));
    const bind = (sel, key, ev) => { const i = $(sel); if (i) i.addEventListener(ev || 'change', () => { cfg.models[key] = i.value.trim(); persist(); changed(); }); };
    bind('#ai-m-claudeai', 'claudeai'); bind('#ai-m-cc', 'claude_code'); bind('#ai-m-oa', 'openai');
    const base = $('#ai-base'); if (base) base.addEventListener('change', () => { cfg.baseUrl = base.value.trim() || DEFAULT_BASE; persist(); changed(); });
    const key = $('#ai-key'); if (key) key.addEventListener('input', () => { apiKey = key.value.trim(); });
    const load = $('#ai-oa-load'); if (load) load.addEventListener('click', loadOpenAIModels);
    const chk = $('#ai-cc-check'); if (chk) chk.addEventListener('click', checkClaudeModels);
  }

  async function loadOpenAIModels() {
    const note = $('#ai-oa-note');
    const base = $('#ai-base'); if (base) cfg.baseUrl = base.value.trim() || DEFAULT_BASE;
    note.textContent = 'Loading models…';
    let models = [];
    try {
      if (avail.server) {
        const r = await fetchJson(`${SERVER}/api/openai/models`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: cfg.baseUrl, apiKey: apiKey || undefined }) }, 15000);
        if (!r.ok) throw new Error(r.error);
        models = r.models;
      } else {
        const j = await fetchJson(`${cfg.baseUrl.replace(/\/+$/, '')}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }, 15000);
        models = (j.data || []).map(m => m.id);
      }
    } catch (e) {
      note.textContent = (e && e.message && !/Failed to fetch|abort/i.test(e.message)) ? e.message : `Could not reach ${cfg.baseUrl}. Is the server running${avail.server ? '' : ', with CORS turned on'}?`;
      return;
    }
    if (!models.length) { note.textContent = 'The server is running but lists no models. Load a model in LM Studio first.'; return; }
    $('#ai-oa-list').innerHTML = models.map(m => `<option value="${esc(m)}"></option>`).join('');
    if (!cfg.models.openai || !models.includes(cfg.models.openai)) { cfg.models.openai = models[0]; persist(); }
    const input = $('#ai-m-oa'); if (input) input.value = cfg.models.openai;
    note.textContent = `Found ${models.length} model${models.length > 1 ? 's' : ''}: ${models.slice(0, 6).join(', ')}${models.length > 6 ? '…' : ''}`;
    listeners.forEach(fn => fn());
    const chip = $('#ai-chip-label'); if (chip) chip.textContent = ready() ? label() : 'not set up';
    const st = document.querySelector('.ai-status'); if (st) { const s = status(); st.textContent = s.message; st.className = `ai-status ${s.ok ? 'ok' : 'bad'}`; }
  }

  let checking = false;
  async function checkClaudeModels() {
    if (checking) return;
    checking = true;
    const btn = $('#ai-cc-check'), note = $('#ai-cc-note');
    if (btn) btn.disabled = true;
    const list = avail.ccModels;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const n = $('#ai-cc-note'); if (n) n.textContent = `Checking ${m.id} (${i + 1} of ${list.length})…`;
      try {
        const r = await fetchJson(`${SERVER}/api/claude-code/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m.id }) }, 120000);
        cfg.checked[m.id] = { ok: !!r.ok, model: r.model || null, error: r.error ? String(r.error).slice(0, 160) : null };
      } catch (e) { cfg.checked[m.id] = { ok: false, error: 'No response' }; }
      persist();
    }
    checking = false;
    render();
    const n = $('#ai-cc-note'); if (n) n.textContent = `Checked ${list.length} models.`;
    if (note && btn) btn.disabled = false;
  }

  window.LLM = { ready, status, label, supportsTools, ask, onChange: fn => listeners.push(fn), open: () => toggle(true), provider: () => cfg.provider };
  detect();
})();
