/* Pillars & Palaces page logic: form, year reading, luck timeline, Ask Claude chat, and the two charts. */
(function () {
  'use strict';
  const E = window.FateEngine;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EL_OF = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water', 子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth', 巳: 'fire', 午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water' };
  const elc = ch => `el-${EL_OF[ch] || 'metal'}`;
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2);
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!E || !window.Solar || !window.iztro) {
    $('#loading').outerHTML = '<p class="error">The calendar libraries did not load. Check your connection and reload the page.</p>';
    return;
  }
  $('#loading').remove();

  const state = { chart: null, chartKey: '', tl: null, r: null, form: null, decIdx: null, lineTopic: 'overall', turns: [], busy: false, ctl: null, sample: undefined };
  const TOPIC_LIST = ['overall', ...E.ALL_TOPICS];
  const tLabel = t => E.TOPICS[t].label;

  // ---------- Form ----------
  $('#topics').innerHTML = E.ALL_TOPICS.map(k => `<label class="chip"><input type="checkbox" id="t-${k}" value="${k}">${E.TOPICS[k].label} <span class="zh">${E.TOPICS[k].zh}</span></label>`).join('');
  $('#all').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('#topics input')];
    const allOn = boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = !allOn; });
    $('#all').textContent = allOn ? 'Select all topics' : 'Clear topics';
  });

  const EXAMPLE = { name: '', gender: 'male', date: '1990-05-15', time: '14:30', year: new Date().getFullYear(), topics: ['career', 'wealth', 'love', 'property'] };
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('pp-last') || 'null'); } catch (e) { saved = null; }
  const start = saved || EXAMPLE;
  $('#name').value = start.name || '';
  $(start.gender === 'female' ? '#g-f' : '#g-m').checked = true;
  $('#bdate').value = start.date; $('#btime').value = start.time; $('#tyear').value = start.year;
  start.topics.forEach(t => { const b = $('#t-' + t); if (b) b.checked = true; });

  $('#f').addEventListener('submit', ev => { ev.preventDefault(); run(false, 's-summary'); });

  function readForm() {
    const date = $('#bdate').value, time = $('#btime').value, year = parseInt($('#tyear').value, 10);
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const topics = [...document.querySelectorAll('#topics input:checked')].map(b => b.value);
    if (!date) return { error: 'Enter a birth date.' };
    if (!time) return { error: 'Enter a birth time. If you only know roughly, pick the middle of the two-hour period.' };
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    if (y < 1900 || y > 2100) return { error: 'Birth year must be between 1900 and 2100.' };
    if (!year || year < y || year > y + 110) return { error: `Year to read must be between ${y} and ${y + 110}.` };
    return { name: $('#name').value.trim(), gender, date, time, topics, input: { year: y, month: m, day: d, hour: hh, minute: mm, gender, targetYear: year, topics } };
  }

  function run(isExample, scrollTo) {
    $('#err').textContent = '';
    const f = readForm();
    if (f.error) { $('#err').textContent = f.error; return; }
    const key = `${f.date}|${f.time}|${f.gender}`;
    try {
      if (key !== state.chartKey) {
        state.chart = E.cast(f.input);
        state.chartKey = key;
        state.tl = null;
        state.decIdx = null;
        resetChat(state.turns.length ? 'New birth details loaded, so the conversation was cleared.' : '');
      }
      state.r = E.readYear(state.chart, f.input.targetYear, f.topics);
    } catch (e) {
      console.error(e);
      $('#err').textContent = 'That date could not be charted. Check the date and time and try again.';
      return;
    }
    state.form = f;
    state.isExample = isExample;
    if (!isExample) {
      try { localStorage.setItem('pp-last', JSON.stringify({ name: f.name, gender: f.gender, date: f.date, time: f.time, year: f.input.targetYear, topics: f.topics })); } catch (e) { /* storage unavailable */ }
    }
    $('#jump').hidden = false;
    $('#s-summary').innerHTML = renderSummary(state.r, f.name, isExample);
    $('#s-readings').innerHTML = renderReadings(state.r);
    $('#s-bazi').innerHTML = renderBazi(state.r);
    $('#s-ziwei').innerHTML = renderZiwei(state.r);
    if (!$('#s-method').innerHTML) $('#s-method').innerHTML = renderMethod();
    if (!$('#chat')) renderChatShell();
    renderSuggestions();
    if (state.tl) renderTimeline();
    else {
      $('#s-timeline').innerHTML = `<section>${timelineHead()}<p class="muted">Scoring every year of every luck pillar…</p></section>`;
      setTimeout(() => { state.tl = E.timeline(state.chart); renderTimeline(); }, 30);
    }
    if (scrollTo) document.getElementById(scrollTo).scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function setYear(y, scrollTo) {
    $('#tyear').value = y;
    state.decIdx = null; // follow the decade that contains the chosen year
    run(state.isExample, scrollTo);
  }

  // ---------- Summary ----------
  function renderSummary(r, name, isExample) {
    const bz = r.bz, a = r.ast;
    const fact = (k, v) => `<div class="fact"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    return `<section id="summary">
      <div class="sec-head"><div><div class="eyebrow">Chart of</div><h2>${name ? esc(name) : (r.input.gender === 'male' ? 'Male' : 'Female')}, born ${bz.solar.slice(0, 16)}</h2></div>
      ${isExample ? '<span class="example-flag">Example chart. Enter your own details above.</span>' : ''}</div>
      <div class="facts">
        ${fact('Lunar date 农历', `<span class="zh">${a.lunarDate}</span>`)}
        ${fact('Zodiac 生肖', `<span class="zh">${bz.zodiac}</span>`)}
        ${fact('Day Master 日主', `<span class="zh ${elc(bz.dm)}">${bz.dm}</span> ${E.EL_EN[bz.dmEl]}, ${bz.strength === 'balanced' ? 'balanced (leans ' + bz.lean + ')' : bz.strength}`)}
        ${fact('Useful element 用神', `<span class="zh el-${bz.useful}">${E.EL_ZH[bz.useful]}</span> ${E.EL_EN[bz.useful]}`)}
        ${fact(`Year ${r.Y} 流年`, `<span class="zh">${r.yp}</span> · age ${r.age} (虚岁)`)}
        ${fact('Luck pillar 大运', r.lp ? `<span class="zh">${r.lp.ganzhi}</span> · ${r.lp.startYear}–${r.lp.endYear}` : 'Not started yet')}
        ${fact('Zi Wei bureau 五行局', `<span class="zh">${a.fiveElementsClass}</span>`)}
        ${fact('Soul / Body star 命主/身主', `<span class="zh">${a.soul} / ${a.body}</span>`)}
      </div>
    </section>`;
  }

  // ---------- Year readings ----------
  const dots = level => `<span class="dots" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</span>`;
  const meter = v => `<div class="meter"><span class="${v >= 0 ? 'pos' : 'neg'}" style="width:${Math.min(Math.abs(v), 1) * 50}%"></span></div>`;
  function evItem(e) {
    const cls = e.pts > 0 ? 'p' : e.pts < 0 ? 'n' : 'z';
    return `<div class="ev"><span class="pts ${cls}">${sign(e.pts)}</span><div><b>${e.title}</b><p>${e.detail}</p></div></div>`;
  }
  function summaryText(t) {
    const lead = { 5: 'is an excellent area this year', 4: 'looks good this year', 3: 'is mixed this year', 2: 'is challenging this year', 1: 'is a difficult area this year' }[t.level];
    const sys = e => e.sys === 'bazi' ? 'BaZi' : 'Zi Wei';
    let s = `${t.label} ${lead}.`;
    if (t.pos.length) s += ` Main support: ${t.pos.map(e => `${e.title} (${sys(e)})`).join('; ')}.`;
    if (t.neg.length) s += ` Main risk: ${t.neg.map(e => `${e.title} (${sys(e)})`).join('; ')}.`;
    return s;
  }
  function renderReading(t, Y) {
    return `<article class="reading ${t.topic === 'overall' ? 'overall' : ''}">
      <div class="r-head">
        <div class="r-title"><h3>${t.label}</h3><span class="zh">${t.zh}</span></div>
        <div class="verdict lv${t.level}" style="background:none">${dots(t.level)}<span class="pill lv${t.level}">${t.verdict}</span></div>
      </div>
      <p class="r-summary">${summaryText(t)}</p>
      <p class="r-advice"><b>Advice.</b> ${t.advice}</p>
      <div class="meters">
        <span>BaZi 八字</span>${meter(t.nb)}<span class="num">${sign(t.nb)}</span>
        <span>Zi Wei 紫微</span>${meter(t.nz)}<span class="num">${sign(t.nz)}</span>
      </div>
      <p class="agree"><b>${t.agreement.kind === 'agree' ? 'Systems agree.' : t.agreement.kind === 'disagree' ? 'Systems disagree.' : 'Partly aligned.'}</b> ${t.agreement.text}</p>
      <button type="button" class="linkbtn askbtn" data-q="${esc(`Explain my ${t.label.toLowerCase()} reading for ${Y} in more depth. What drives it in each system, and what should I do about it?`)}">Ask Claude about this reading</button>
      <details class="derive">
        <summary>How this was derived (${t.bazi.length + t.zwds.length} rules)</summary>
        <div class="ev-cols">
          <div class="ev-col"><h4><span>BaZi 八字 evidence</span><span class="num">${sign(t.sb)}</span></h4>${t.bazi.map(evItem).join('')}</div>
          <div class="ev-col"><h4><span>Zi Wei 紫微 evidence</span><span class="num">${sign(t.sz)}</span></h4>${t.zwds.map(evItem).join('')}</div>
        </div>
        <div class="formula">
          <div><code>BaZi: sum ${sign(t.sb)} ÷ 4 → ${sign(t.nb)} (capped at ±1)</code></div>
          <div><code>Zi Wei: sum ${sign(t.sz)} ÷ 4 → ${sign(t.nz)} (capped at ±1)</code></div>
          <div><code>Combined = 0.5 × ${sign(t.nb)} + 0.5 × ${sign(t.nz)} = ${sign(t.combined)} → ${t.verdict} (${t.level}/5)</code></div>
        </div>
      </details>
    </article>`;
  }
  function renderReadings(r) {
    return `<section id="readings">
      <div class="sec-head"><div><div class="eyebrow">Year reading</div><h2>${r.Y} <span class="zh">${r.yp}</span> for this chart</h2></div>
      <span class="note">Bands: Excellent &gt; +0.45 · Good &gt; +0.15 · Mixed · Challenging &lt; −0.15 · Difficult &lt; −0.45</span></div>
      <div class="readings">${r.results.map(t => renderReading(t, r.Y)).join('')}</div>
    </section>`;
  }

  // ---------- Luck timeline ----------
  function timelineHead() {
    return `<div class="sec-head"><div><div class="eyebrow">Time series</div><h2>Luck through the decades <span class="zh">大运流年</span></h2></div>
      <span class="note">Every year is scored with the same rules as the year reading. Click any year to read it in full.</span></div>`;
  }
  function currentDecIdx() {
    if (state.decIdx !== null) return state.decIdx;
    const Y = state.r.Y;
    const i = state.tl.findIndex(d => d.startYear <= Y && Y <= d.endYear);
    return i < 0 ? 0 : i;
  }
  function heatStyle(c) {
    const pct = Math.round(Math.min(Math.abs(c) / 0.8, 1) * 80);
    const col = c >= 0 ? 'var(--pos)' : 'var(--neg)';
    return `background:color-mix(in oklab, ${col} ${pct}%, var(--surface));color:${pct > 45 ? 'var(--on-strong)' : 'var(--ink)'}`;
  }
  function renderTimeline() {
    const tl = state.tl, di = currentDecIdx(), d = tl[di], Y = state.r.Y;
    const selTopics = state.form.topics;
    const opts = TOPIC_LIST.map(t => `<option value="${t}" ${t === state.lineTopic ? 'selected' : ''}>${tLabel(t)} ${E.TOPICS[t].zh}</option>`).join('');
    const tabs = tl.map((x, i) => `<button type="button" role="tab" class="dec-tab" data-dec="${i}" aria-selected="${i === di}">
      <span class="zh">${x.pre ? '童限' : x.ganzhi}</span><small class="num">${x.startYear}–${x.endYear}</small><small>age ${x.startAge}–${x.endAge} · avg ${sign(x.avg[state.lineTopic])}</small></button>`).join('');

    const rows = ['overall', ...selTopics, ...E.ALL_TOPICS.filter(t => !selTopics.includes(t))];
    const head = d.years.map(y => `<th class="${y.year === Y ? 'cur' : ''}"><span class="num">${y.year}</span><br><span class="zh">${y.yp}</span><br>${y.age}</th>`).join('');
    const body = rows.map(t => `<tr><th class="tl-row" scope="row">${tLabel(t)}<span class="zh">${E.TOPICS[t].zh}</span></th>${d.years.map(y => {
      const s = y.scores[t];
      return `<td><button type="button" class="hc ${y.year === Y ? 'cur' : ''}" data-year="${y.year}" data-topic="${t}" style="${heatStyle(s.c)}" aria-label="${tLabel(t)} ${y.year}: ${s.verdict} ${sign(s.c)}">${sign(s.c)}</button></td>`;
    }).join('')}<td class="avgc">${sign(d.avg[t])}</td></tr>`).join('');

    const hlTopics = ['overall', ...selTopics];
    const yearOf = y => d.years.find(x => x.year === y);
    const hl = hlTopics.map(t => `<li><b>${tLabel(t)}</b><span>Best <button type="button" class="linkbtn" data-year="${d.best[t]}">${d.best[t]}</button> (${sign(yearOf(d.best[t]).scores[t].c)}), hardest <button type="button" class="linkbtn" data-year="${d.worst[t]}">${d.worst[t]}</button> (${sign(yearOf(d.worst[t]).scores[t].c)}), decade average ${sign(d.avg[t])}</span></li>`).join('');
    const theme = d.theme.map(n => `<li><span class="sys">${n.sys === 'bazi' ? 'BaZi' : 'Zi Wei'}</span><span>${n.text}</span></li>`).join('');

    $('#s-timeline').innerHTML = `<section id="timeline">
      ${timelineHead()}
      <div class="panel" style="display:grid;gap:10px">
        <div class="tl-controls">
          <h3>Lifetime curve</h3>
          <label for="tl-topic">Topic</label><select id="tl-topic">${opts}</select>
          <span class="note">Shaded columns are the 10-year luck pillars. The dashed line marks ${Y}.</span>
        </div>
        <div class="chart-wrap" id="tl-chart"></div>
      </div>
      <div class="dec-tabs" role="tablist" aria-label="Luck pillars">${tabs}</div>
      <div class="dec-grid">
        <div class="panel" style="display:grid;gap:10px">
          <h3>${d.pre ? 'Childhood 童限' : `Luck pillar ${d.ganzhi} 大运`} · ${d.startYear}–${d.endYear}</h3>
          <ul class="theme-list">${theme}</ul>
        </div>
        <div class="panel" style="display:grid;gap:10px">
          <h3>Decade highlights</h3>
          <ul class="hl-list">${hl}</ul>
          <button type="button" class="linkbtn askbtn" data-q="${esc(`Give me a year-by-year outlook for my ${d.pre ? 'childhood period' : d.ganzhi + ' luck pillar'} (${d.startYear}–${d.endYear}). Which years stand out for ${hlTopics.filter(t => t !== 'overall').map(t => tLabel(t).toLowerCase()).join(', ') || 'each area'}, and why?`)}">Ask Claude about this decade</button>
        </div>
      </div>
      <div class="panel" style="display:grid;gap:10px">
        <div class="tl-controls"><h3>Year by year, every topic</h3>
          <div class="heat-legend"><span>Unfavourable</span><span class="ramp"></span><span>Favourable</span><span>· numbers are combined scores (−1 to +1)</span></div></div>
        <div class="scroll"><table class="heat"><thead><tr><th></th>${head}<th>Avg</th></tr></thead><tbody>${body}</tbody></table></div>
      </div>
    </section>`;
    $('#tl-topic').addEventListener('change', e => { state.lineTopic = e.target.value; renderTimeline(); });
    drawLine();
  }

  function drawLine() {
    const wrap = $('#tl-chart');
    if (!wrap || !state.tl) return;
    const tl = state.tl, topic = state.lineTopic, di = currentDecIdx(), Y = state.r.Y;
    const W = Math.max(240, wrap.clientWidth), H = W < 520 ? 220 : 260;
    const m = { l: 34, r: 10, t: 26, b: 26 };
    const years = tl.flatMap(d => d.years);
    const x0 = years[0].year, x1 = years[years.length - 1].year;
    const X = y => m.l + (y - x0) / Math.max(1, x1 - x0) * (W - m.l - m.r);
    const Yv = v => m.t + (1 - (v + 1) / 2) * (H - m.t - m.b);
    const half = (W - m.l - m.r) / Math.max(1, x1 - x0) / 2;
    const bands = tl.map((d, i) => {
      const a = Math.max(m.l, X(d.startYear) - half), b = Math.min(W - m.r, X(d.endYear) + half);
      const lbl = (b - a) > 30 ? `<text class="band-lbl ${i === di ? 'sel' : ''}" x="${(a + b) / 2}" y="16" text-anchor="middle">${d.pre ? '童限' : d.ganzhi}</text>` : '';
      return `<rect class="band" data-dec="${i}" x="${a}" y="${m.t}" width="${b - a}" height="${H - m.t - m.b}" fill="${i === di ? 'var(--accent-soft)' : i % 2 ? 'var(--band)' : 'transparent'}"></rect>${lbl}`;
    }).join('');
    const grid = [-1, -0.5, 0, 0.5, 1].map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Yv(v)}" y2="${Yv(v)}" stroke="var(--line)" stroke-width="${v === 0 ? 1.5 : 1}" ${v === 0 ? '' : 'stroke-dasharray="2 4"'}></line><text x="${m.l - 6}" y="${Yv(v) + 4}" text-anchor="end">${v > 0 ? '+' + v : v}</text>`).join('');
    let lastX = -99;
    const ticks = tl.map(d => {
      const x = X(d.startYear);
      if (x - lastX < 36) return '';
      lastX = x;
      return `<text x="${x}" y="${H - 8}" text-anchor="middle">${d.startYear}</text>`;
    }).join('');
    const pts = years.map(y => [X(y.year), Yv(y.scores[topic].c)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${Yv(0)}L${pts[0][0].toFixed(1)},${Yv(0)}Z`;
    const cur = years.find(y => y.year === Y);
    const curMark = cur ? `<line x1="${X(Y)}" x2="${X(Y)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--accent)" stroke-dasharray="4 3"></line><circle cx="${X(Y)}" cy="${Yv(cur.scores[topic].c)}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"></circle>` : '';
    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${tLabel(topic)} score by year, ${x0} to ${x1}">
      <defs>
        <clipPath id="clip-up"><rect x="0" y="0" width="${W}" height="${Yv(0)}"></rect></clipPath>
        <clipPath id="clip-dn"><rect x="0" y="${Yv(0)}" width="${W}" height="${H - Yv(0)}"></rect></clipPath>
      </defs>
      ${bands}${grid}${ticks}
      <path d="${area}" fill="var(--pos)" fill-opacity=".22" clip-path="url(#clip-up)"></path>
      <path d="${area}" fill="var(--neg)" fill-opacity=".22" clip-path="url(#clip-dn)"></path>
      <path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"></path>
      ${curMark}
      <line id="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="var(--muted)" visibility="hidden"></line>
      <circle id="xd" r="5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2" visibility="hidden"></circle>
      <rect id="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" style="cursor:pointer"></rect>
    </svg><div class="tip" id="tip" hidden></div>`;

    const svg = wrap.querySelector('svg'), tip = $('#tip'), xh = $('#xh'), xd = $('#xd');
    const nearest = ev => {
      const rect = svg.getBoundingClientRect();
      const px = (ev.clientX - rect.left) * (W / rect.width);
      const yr = Math.round(x0 + (px - m.l) / (W - m.l - m.r) * (x1 - x0));
      return years.find(y => y.year === Math.max(x0, Math.min(x1, yr)));
    };
    const hit = $('#hit');
    hit.addEventListener('pointermove', ev => {
      const y = nearest(ev); if (!y) return;
      const s = y.scores[topic];
      const cx = X(y.year), cy = Yv(s.c);
      xh.setAttribute('x1', cx); xh.setAttribute('x2', cx); xh.setAttribute('visibility', 'visible');
      xd.setAttribute('cx', cx); xd.setAttribute('cy', cy); xd.setAttribute('visibility', 'visible');
      const dec = tl.find(d => d.startYear <= y.year && y.year <= d.endYear);
      tip.innerHTML = `<b>${y.year} ${y.yp} · age ${y.age}</b><span class="r">${dec.pre ? '童限' : dec.ganzhi + ' luck pillar'}</span><span>${tLabel(topic)}: <strong>${s.verdict}</strong> <span class="num">${sign(s.c)}</span></span>${s.top.slice(0, 2).map(e => `<span class="r">${e.sys === 'bazi' ? 'BaZi' : 'Zi Wei'} ${sign(e.pts)}: ${e.title}</span>`).join('')}<span class="r">Click to read this year</span>`;
      tip.hidden = false;
      const rect = svg.getBoundingClientRect(), scale = rect.width / W;
      let left = cx * scale + 12;
      if (left + 280 > rect.width) left = cx * scale - 292;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, cy * scale - 30) + 'px';
    });
    hit.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); xd.setAttribute('visibility', 'hidden'); });
    hit.addEventListener('click', ev => { const y = nearest(ev); if (y) setYear(y.year, 's-readings'); });
  }
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(drawLine, 150); });

  // ---------- Global clicks ----------
  document.addEventListener('click', ev => {
    const yb = ev.target.closest('[data-year]');
    if (yb) { setYear(Number(yb.dataset.year), 's-readings'); return; }
    const db = ev.target.closest('[data-dec]');
    if (db) { state.decIdx = Number(db.dataset.dec); renderTimeline(); return; }
    const qb = ev.target.closest('[data-q]');
    if (qb) { ask(qb.dataset.q); }
  });

  // ---------- Ask Claude ----------
  const INSTRUCTIONS = `You are an experienced practitioner of both BaZi (八字, Four Pillars) and Zi Wei Dou Shu (紫微斗数), helping someone interpret charts computed by the "Pillars & Palaces" app. The chart data, the app's rule-based year reading and its year-by-year luck timeline are below.

How to answer:
- Ground every claim in the chart data below. Cite the specific pillars, ten gods 十神, branch interactions, palaces, stars and 四化 behind each point, and say which system it comes from.
- The app's scores come from a rule-based engine: each system's points are summed, divided by 4 and capped to −1…+1, then averaged. Bands: Excellent > +0.45, Good > +0.15, Mixed, Challenging < −0.15, Difficult < −0.45. Use these scores, and when you add classical reasoning beyond the app's rules, label it as your own interpretation.
- For a year whose full rule breakdown you need, call the get_year_reading tool if it is available.
- Reply in the language the person writes in. Keep Chinese terms with a short English gloss when replying in English.
- Be balanced and practical, never fatalistic. For health, legal or financial decisions, say a professional should be consulted.
- Keep answers under about 350 words unless asked for more depth. Use short headings or bullet points where they help.`;

  function chartContext() {
    const r = state.r, bz = r.bz, a = r.ast, f = state.form;
    const L = [];
    L.push(`TODAY: ${new Date().toISOString().slice(0, 10)}`);
    L.push(`PERSON: ${f.gender}, born ${bz.solar} (local clock time), lunar ${a.lunarDate}, zodiac ${bz.zodiac}.`);
    L.push('\nBAZI 八字');
    bz.pillars.forEach(p => L.push(`${p.label} pillar ${p.stem}${p.branch}: stem ${p.stem} (${p.stemGod}), branch ${p.branch} hidden ${p.hidden.map(h => `${h.stem}=${h.god}`).join(' ')}; 纳音 ${p.nayin}; 长生 ${p.stage}; governs ${p.meaning}.`));
    L.push(`Element share: ${E.ELEMENTS.map(e => `${E.EL_EN[e]} ${Math.round(bz.dist[e] / bz.distTotal * 100)}%`).join(', ')}.`);
    bz.strengthNotes.forEach(n => L.push(`- ${n}`));
    L.push(`Luck pillars 大运 (start ${bz.luckStart.date}): ${bz.luck.filter(l => l.ganzhi).map(l => `${l.ganzhi} ${l.startYear}-${l.endYear} (age ${l.startAge}-${l.endAge})`).join('; ')}.`);
    L.push('\nZI WEI 紫微斗数');
    L.push(`Bureau ${a.fiveElementsClass}; 命主 ${a.soul}; 身主 ${a.body}; four pillars ${a.chineseDate}.`);
    a.palaces.forEach(p => L.push(`${p.name}${p.isBodyPalace ? '(身宫)' : ''} ${p.heavenlyStem}${p.earthlyBranch} ages ${p.decadal.range.join('-')}: main ${p.majorStars.map(s => s.name + (s.brightness || '') + (s.mutagen ? '化' + s.mutagen : '')).join(',') || 'none'}; minor ${p.minorStars.map(s => s.name + (s.mutagen ? '化' + s.mutagen : '')).join(',') || 'none'}; misc ${p.adjectiveStars.map(s => s.name).join(',')}.`));
    L.push(`\nYEAR READING ${r.Y} ${r.yp} (age ${r.age}; luck pillar ${r.lp ? r.lp.ganzhi : 'none yet'}; Zi Wei decade ${r.hz.decadal.heavenlyStem}${r.hz.decadal.earthlyBranch} 四化 ${r.hz.decadal.mutagen.join(',')}; year 四化 ${r.hz.yearly.mutagen.join(',')} for 禄权科忌)`);
    r.results.forEach(t => {
      L.push(`${t.label}: ${t.verdict} (combined ${t.combined}; BaZi ${t.nb}, Zi Wei ${t.nz}; ${t.agreement.kind})`);
      [...t.bazi, ...t.zwds].forEach(e => L.push(`  [${e.sys} ${e.pts}] ${e.title}`));
    });
    if (state.tl) {
      L.push('\nLUCK TIMELINE (combined scores per year; columns: ' + TOPIC_LIST.join(',') + ')');
      state.tl.forEach(d => {
        L.push(`== ${d.pre ? 'Childhood 童限' : 'Luck pillar ' + d.ganzhi} ${d.startYear}-${d.endYear}, age ${d.startAge}-${d.endAge}`);
        d.theme.forEach(n => L.push(`  theme (${n.sys}): ${n.text}`));
        d.years.forEach(y => L.push(`  ${y.year} ${y.yp} age${y.age}: ${TOPIC_LIST.map(t => y.scores[t].c).join(',')}`));
      });
    } else L.push('\n(Luck timeline still computing.)');
    return L.join('\n');
  }

  const yearTool = {
    name: 'get_year_reading',
    description: 'Returns the app\'s full rule breakdown for one calendar year: for every topic, the verdict, combined score and each BaZi and Zi Wei rule with its points. Use it when explaining why a specific year scores the way it does.',
    inputSchema: { type: 'object', properties: { year: { type: 'integer', description: 'Gregorian year, e.g. 2031' } }, required: ['year'] },
    execute(input) {
      const y = Math.round(Number(input.year));
      const by = state.chart.inp.year;
      if (!(y >= by && y <= by + 110)) throw new Error(`Year must be between ${by} and ${by + 110}.`);
      const r = E.readYear(state.chart, y, E.ALL_TOPICS);
      return {
        year: y, pillar: r.yp, age: r.age, luckPillar: r.lp ? r.lp.ganzhi : null,
        topics: r.results.map(t => ({ topic: t.topic, verdict: t.verdict, combined: t.combined, bazi: t.bazi.map(e => `${e.pts} ${e.title}`), ziwei: t.zwds.map(e => `${e.pts} ${e.title}`) }))
      };
    }
  };

  function md(src) {
    let html = '', list = null;
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    esc(src).split('\n').forEach(raw => {
      const l = raw.trimEnd();
      let m;
      if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; return; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; return; }
      close();
      if ((m = l.match(/^#{1,6}\s+(.*)/))) html += `<h4>${inline(m[1])}</h4>`;
      else if (l.trim() && !/^\s*-{3,}\s*$/.test(l)) html += `<p>${inline(l)}</p>`;
    });
    close();
    return html;
  }

  window.PPShared = { md, esc }; // shared with the Qimen tab

  function renderChatShell() {
    $('#s-chat').innerHTML = `<section id="chat-sec">
      <div class="sec-head"><div><div class="eyebrow">Ask Claude</div><h2>Questions about this chart <span class="zh">问命</span></h2></div>
      <span class="note">Claude reads both charts, the year reading and the full luck timeline before answering.</span></div>
      <div class="panel chat" id="chat">
        <div class="chat-log" id="chat-log" aria-live="polite"></div>
        <div class="chat-sugg" id="chat-sugg"></div>
        <form class="chat-form" id="chat-form">
          <label for="chat-input" class="note" style="grid-column:1/-1">Your question (any language)</label>
          <textarea id="chat-input" placeholder="e.g. Which year in the next decade is best to change jobs, and why?"></textarea>
          <div class="chat-btns">
            <button class="btn" type="submit" id="chat-send">Ask</button>
            <button class="btn ghost" type="button" id="chat-stop" hidden>Stop</button>
          </div>
        </form>
        <div class="actions"><span class="note" id="chat-status">Checking whether Claude is available here…</span><button type="button" class="linkbtn" id="chat-clear" hidden>Clear conversation</button></div>
      </div>
    </section>`;
    $('#chat-form').addEventListener('submit', ev => { ev.preventDefault(); ask($('#chat-input').value); });
    $('#chat-input').addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); ask($('#chat-input').value); } });
    $('#chat-stop').addEventListener('click', () => state.ctl && state.ctl.abort());
    $('#chat-clear').addEventListener('click', () => resetChat(''));
    initSample();
  }

  function renderSuggestions() {
    const box = $('#chat-sugg'); if (!box) return;
    const Y = state.r.Y, lp = state.r.lp;
    const qs = [
      `What are the most important things my chart says about ${Y}?`,
      lp ? `Within my current ${lp.ganzhi} luck pillar, which years are best for career moves and why?` : 'Which upcoming years are best for career moves and why?',
      `When in the next 10 years is a good time to buy property?`,
      `What does my Day Master and 命宫 say about my personality and strengths?`,
      `Compare my current luck pillar with the next one.`
    ];
    box.innerHTML = qs.map(q => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
  }

  async function initSample() {
    const status = $('#chat-status');
    const hasRuntime = !!(window.claude && window.claude.use);
    let sample = null;
    try { sample = hasRuntime ? await window.claude.use('sample') : null; } catch (e) { sample = null; }
    state.sample = sample;
    if (!sample) {
      status.textContent = hasRuntime
        ? 'Claude is not reachable in this view. Open the page from its claude.ai/artifact link inside claude.ai (not the standalone page tab), signed in, then reload.'
        : 'This copy of the page is not running inside claude.ai, so it cannot ask Claude. Open the claude.ai/artifact link while signed in to use the chat.';
      $('#chat-send').disabled = true;
      return;
    }
    let tools = false;
    try { tools = !!(await sample.limits()).tools; } catch (e) { tools = false; }
    state.tools = tools;
    status.textContent = 'Answers use your own Claude account. The first question asks for your permission.';
  }

  function resetChat(note) {
    if (state.ctl) state.ctl.abort();
    state.turns = [];
    const log = $('#chat-log');
    if (log) log.innerHTML = note ? `<p class="note">${esc(note)}</p>` : '';
    const c = $('#chat-clear'); if (c) c.hidden = true;
  }

  const ERR_COPY = {
    not_granted: 'Claude is not allowed for this page. You can allow it from the page\'s permissions menu.',
    sampling_disabled: 'Claude is not available for this account.',
    rate_limited: 'Too many questions in a short time, or a usage limit was reached. Try again in a little while.',
    session_expired: 'Your session expired. Sign in to claude.ai again, then ask again.',
    refused: 'Claude declined to answer that. Try rephrasing the question.',
    prompt_too_large: 'The conversation got too long. Clear it and ask again.',
    empty_completion: 'Claude returned an empty answer. Try asking more simply.'
  };

  async function ask(q) {
    q = (q || '').trim();
    if (!q || state.busy || !state.r || state.chatBlocked) return;
    document.getElementById('s-chat').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    const sample = state.sample;
    if (!sample) { $('#chat-status').textContent = state.sample === undefined ? 'Still connecting to Claude. Try again in a moment.' : 'Asking Claude works when this page is opened on claude.ai.'; return; }
    const log = $('#chat-log');
    log.querySelectorAll('p.note').forEach(n => n.remove());
    log.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(q)}</div><div class="msg bot"><span class="thinking">Thinking… reading both charts</span></div>`);
    const bubble = log.lastElementChild;
    log.scrollTop = log.scrollHeight;
    $('#chat-input').value = '';
    state.turns.push({ role: 'user', content: q });
    while (state.turns.length > 12) state.turns.splice(0, 2);
    const msgs = [{ role: 'user', content: `${INSTRUCTIONS}\n\n=== CHART DATA ===\n${chartContext()}\n=== END CHART DATA ===` }, ...state.turns];

    state.busy = true; state.ctl = new AbortController();
    $('#chat-send').disabled = true; $('#chat-stop').hidden = false;
    const opts = { signal: state.ctl.signal, cache: false, onText: ({ text }) => { bubble.innerHTML = md(text); log.scrollTop = log.scrollHeight; } };
    if (state.tools) {
      opts.tools = [{ ...yearTool, execute: input => { bubble.innerHTML = `<span class="thinking">Looking up the ${esc(String(input.year))} rule breakdown…</span>`; return yearTool.execute(input); } }];
    }
    try {
      const { text, truncated } = await sample(msgs, opts);
      bubble.innerHTML = md(text) + (truncated ? '<p class="err">The answer was cut short. Ask a narrower question for the rest.</p>' : '');
      state.turns.push({ role: 'assistant', content: text });
    } catch (e) {
      state.turns.pop();
      const code = e && e.code;
      if (code === 'cancelled') bubble.innerHTML = (e.text ? md(e.text) : '') + '<p class="err">Stopped.</p>';
      else if (code === 'tools_unavailable') { state.tools = false; bubble.innerHTML = '<p class="err">Year lookups are not available here. Ask again and Claude will answer from the timeline data.</p>'; }
      else {
        bubble.innerHTML = (e && e.text && code !== 'refused' ? md(e.text) : '') + `<p class="err">${esc(ERR_COPY[code] || 'Claude could not answer just now. Try again.')}</p>`;
        if (code === 'not_granted' || code === 'sampling_disabled') { state.chatBlocked = true; $('#chat-status').textContent = ERR_COPY[code]; }
      }
    } finally {
      state.busy = false;
      $('#chat-send').disabled = !!state.chatBlocked;
      $('#chat-stop').hidden = true;
      $('#chat-clear').hidden = state.turns.length === 0;
      log.scrollTop = log.scrollHeight;
    }
  }

  // ---------- BaZi chart ----------
  function renderBazi(r) {
    const bz = r.bz, cols = bz.pillars;
    const head = cols.map(p => `<th class="${p.key === 'day' ? 'dm-col' : ''}">${p.label} <span class="zh">${p.zh}</span></th>`).join('');
    const row = (label, fn) => `<tr><td class="rl">${label}</td>${cols.map(p => `<td class="${p.key === 'day' ? 'dm-col' : ''}">${fn(p)}</td>`).join('')}</tr>`;
    const godName = g => g === '日主' ? 'Day Master' : E.TEN_GOD_EN[g];
    const table = `<table class="pillars">
      <thead><tr><th></th>${head}</tr></thead>
      <tbody>
        ${row('Ten god 十神', p => `<span class="god">${p.stemGod}</span><br><span class="muted" style="font-size:.72rem">${godName(p.stemGod)}</span>`)}
        ${row('Stem 天干', p => `<div class="glyph ${elc(p.stem)}">${p.stem}<small>${E.EL_EN[p.stemEl]}</small></div>`)}
        ${row('Branch 地支', p => `<div class="glyph ${elc(p.branch)}">${p.branch}<small>${E.EL_EN[p.branchEl]}</small></div>`)}
        ${row('Hidden 藏干', p => `<div class="hid">${p.hidden.map(h => `<span><span class="zh ${elc(h.stem)}">${h.stem}</span> ${h.god}</span>`).join('')}</div>`)}
        ${row('Na Yin 纳音', p => `<span class="zh" style="font-size:.85rem">${p.nayin}</span>`)}
        ${row('Stage 十二长生', p => `<span class="zh" style="font-size:.85rem">${p.stage}</span>`)}
        ${row('Governs', p => `<span class="muted" style="font-size:.74rem">${p.meaning}</span>`)}
      </tbody></table>`;
    const max = Math.max(...E.ELEMENTS.map(e => bz.dist[e]));
    const bars = E.ELEMENTS.map(e => {
      const pct = bz.dist[e] / bz.distTotal * 100;
      const tag = bz.favEls.includes(e) ? `<span class="tag" style="color:var(--good)">FAVOURABLE</span>` : `<span class="tag" style="color:var(--bad)">UNFAVOURABLE</span>`;
      return `<div class="elbar"><span><span class="zh el-${e}">${E.EL_ZH[e]}</span> ${E.EL_EN[e]}</span><div><div class="track"><div class="fill" style="width:${bz.dist[e] / max * 100}%;background:var(--${e})"></div></div>${tag}</div><span class="num">${pct.toFixed(0)}%</span></div>`;
    }).join('');
    const luck = bz.luck.filter(l => l.ganzhi).map(l => {
      const now = r.lp && l.ganzhi === r.lp.ganzhi && l.startYear === r.lp.startYear;
      return `<div class="lk ${now ? 'now' : ''}"><div class="glyph"><span class="${elc(l.ganzhi[0])}">${l.ganzhi[0]}</span><span class="${elc(l.ganzhi[1])}">${l.ganzhi[1]}</span></div><span class="yrs num">${l.startYear}–${l.endYear}</span><span class="yrs">age ${l.startAge}–${l.endAge}</span></div>`;
    }).join('');
    return `<section id="bazi">
      <div class="sec-head"><div><div class="eyebrow">Chart one</div><h2>BaZi Four Pillars <span class="zh">八字</span></h2></div>
      <span class="note">Year pillar changes at 立春 (Start of Spring), months at solar terms.</span></div>
      <div class="bazi-grid">
        <div class="panel scroll">${table}</div>
        <div class="panel" style="display:grid;gap:14px">
          <h3>Element balance <span class="zh">五行</span></h3>
          <div class="elbars">${bars}</div>
          <p class="note" style="margin:0">Stems count 1 each; each branch's 1 point is split across its hidden stems.</p>
        </div>
      </div>
      <div class="panel" style="display:grid;gap:10px"><h3>Day Master strength and useful elements <span class="zh">身强身弱 · 喜用神</span></h3><ul class="notes">${bz.strengthNotes.map(n => `<li>${n}</li>`).join('')}</ul></div>
      <div class="panel" style="display:grid;gap:10px"><h3>10-year luck pillars <span class="zh">大运</span></h3>
        <p class="note" style="margin:0">Luck starts at about ${bz.luckStart.years} years ${bz.luckStart.months} months (${bz.luckStart.date}). The highlighted pillar covers ${r.Y}. See the luck timeline above for year-by-year scores.</p>
        <div class="luck">${luck}</div></div>
    </section>`;
  }

  // ---------- Zi Wei chart ----------
  const POS = { 3: [1, 1], 4: [1, 2], 5: [1, 3], 6: [1, 4], 2: [2, 1], 7: [2, 4], 1: [3, 1], 8: [3, 4], 0: [4, 1], 11: [4, 2], 10: [4, 3], 9: [4, 4] };
  const LUCKY = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马'];
  const MALEFIC = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
  const SHOW_ADJ = ['红鸾', '天喜', '天姚', '咸池', '孤辰', '寡宿'];
  function renderZiwei(r) {
    const a = r.ast, hz = r.hz;
    const yMut = {}; hz.yearly.mutagen.forEach((s, k) => { yMut[s] = '禄权科忌'[k]; });
    const targetIdx = new Set(r.results.filter(t => t.topic !== 'overall').map(t => hz.yearly.palaceNames.indexOf(E.TOPICS[t.topic].palace)));
    const yMing = hz.yearly.palaceNames.indexOf('命宫');
    const cells = a.palaces.map((p, i) => {
      const [row, col] = POS[i];
      const majors = p.majorStars.map(s => `<span class="major">${s.name}<span class="br">${s.brightness || ''}</span>${s.mutagen ? `<span class="mu ${s.mutagen}">${s.mutagen}</span>` : ''}${yMut[s.name] ? `<span class="mu yr ${yMut[s.name]}" title="${r.Y} yearly transformation">年${yMut[s.name]}</span>` : ''}</span>`).join('');
      const minors = p.minorStars.map(s => `<span class="minor ${LUCKY.includes(s.name) ? 'lucky' : MALEFIC.includes(s.name) ? 'malefic' : ''}">${s.name}${s.mutagen ? `<span class="mu ${s.mutagen}">${s.mutagen}</span>` : ''}${yMut[s.name] ? `<span class="mu yr ${yMut[s.name]}">年${yMut[s.name]}</span>` : ''}</span>`).join('');
      const adj = p.adjectiveStars.filter(s => SHOW_ADJ.includes(s.name)).map(s => `<span class="adj">${s.name}</span>`).join('');
      const flows = (hz.yearly.stars[i] || []).map(s => `<span class="adj">${s.name}</span>`).join('');
      const dName = hz.decadal.palaceNames[i], yName = hz.yearly.palaceNames[i];
      return `<div class="cell ${i === yMing ? 'ming' : ''} ${targetIdx.has(i) ? 'target' : ''}" style="grid-row:${row};grid-column:${col}">
        <div class="stars">${majors || '<span class="adj">(no main star)</span>'}</div>
        <div class="stars">${minors}${adj}${flows}</div>
        <div class="foot">
          <div><div class="pname">${p.name}<small>${E.PALACE_EN[p.name]}</small>${p.isBodyPalace ? '<small>· 身宫</small>' : ''}</div><span class="gz">${p.heavenlyStem}${p.earthlyBranch}</span> <span class="num muted" style="font-size:.7rem">${p.decadal.range.join('–')}</span></div>
          <div class="flow"><span title="Role in current 10-year period">限·${dName.replace('宫', '')}</span><span class="y" title="Role in ${r.Y}">年·${yName.replace('宫', '')}</span></div>
        </div>
      </div>`;
    }).join('');
    const center = `<div class="center">
      <div class="big">紫微斗数命盘</div>
      <dl>
        <dt>Solar</dt><dd>${a.solarDate} ${a.time}</dd>
        <dt>Lunar</dt><dd>${a.lunarDate}</dd>
        <dt>Pillars</dt><dd>${a.chineseDate}</dd>
        <dt>Bureau</dt><dd>${a.fiveElementsClass}</dd>
        <dt>命主 / 身主</dt><dd>${a.soul} / ${a.body}</dd>
        <dt>${r.Y} 流年</dt><dd>${hz.yearly.heavenlyStem}${hz.yearly.earthlyBranch} · 四化 ${hz.yearly.mutagen.map((s, k) => s + '禄权科忌'[k]).join(' ')}</dd>
        <dt>大限</dt><dd>${hz.decadal.heavenlyStem}${hz.decadal.earthlyBranch} · 四化 ${hz.decadal.mutagen.map((s, k) => s + '禄权科忌'[k]).join(' ')}</dd>
      </dl>
      <div class="legend"><span><span class="mu 禄">禄</span> natal transformation</span><span><span class="mu yr 忌">年忌</span> ${r.Y} transformation</span><span style="color:var(--good)">green: lucky star</span><span style="color:var(--bad)">red: malefic star</span><span>shaded: ${r.Y} 命宫</span><span>outlined: palaces you asked about</span></div>
    </div>`;
    return `<section id="ziwei">
      <div class="sec-head"><div><div class="eyebrow">Chart two</div><h2>Zi Wei Dou Shu <span class="zh">紫微斗数</span></h2></div>
      <span class="note">Each palace shows its natal name, its role this decade (限) and its role in ${r.Y} (年).</span></div>
      <div class="zw-scroll"><div class="zw">${cells}${center}</div></div>
    </section>`;
  }

  // ---------- Method ----------
  function renderMethod() {
    return `<section id="method">
      <div class="sec-head"><div><div class="eyebrow">Method</div><h2>How the two charts are combined</h2></div></div>
      <div class="method">
        <div class="panel"><h3>BaZi 八字</h3><ol>
          <li>Four pillars from the solar calendar; the year turns at 立春, months at solar terms.</li>
          <li>Day Master strength from weighted support (the month branch counts 2.5×), which decides the favourable elements 喜用神.</li>
          <li>The year pillar (full weight) and the 10-year luck pillar (half weight) are converted to ten gods 十神 relative to the Day Master.</li>
          <li>Each topic has its own stars: wealth 财 for money, officer 官杀 for career, resource 印 for property and study, and the spouse star by gender.</li>
          <li>Branch clashes 冲, combinations 合, punishments 刑 and harms 害 against the pillar that governs the topic add or subtract points.</li>
        </ol></div>
        <div class="panel"><h3>Zi Wei Dou Shu 紫微斗数</h3><ol>
          <li>The 12-palace chart is cast from the lunar birth date and two-hour period.</li>
          <li>Each topic maps to a palace: career 官禄, wealth 财帛, love 夫妻, property 田宅, parents 父母, children 子女, health 疾厄, travel 迁移, friends 仆役.</li>
          <li>Natal palace quality (star brightness, lucky and malefic stars) sets the baseline at half weight.</li>
          <li>The decade's 四化 transformations, then the year's 四化 and yearly flowing stars, are checked in the topic's decadal and yearly palace, its opposite palace and its trines.</li>
          <li>化禄 Prosperity and 化权 Power add points, 化科 Fame adds a little, 化忌 Obstacle subtracts the most.</li>
        </ol></div>
        <div class="panel"><h3>Combining and the timeline</h3><ul>
          <li>Each system's points are summed, divided by 4 and capped to −1…+1, then averaged with equal weight and banded into five verdicts.</li>
          <li>The luck timeline repeats this for every year of every 10-year pillar, so each decade shows which years rise and fall for each topic.</li>
          <li>Zi Wei decades 大限 start at different ages from BaZi luck pillars; each decade summary lists the Zi Wei decades it overlaps.</li>
          <li>Ask Claude sends both charts, the year reading and the timeline to Claude with your question. Its answers add interpretation on top of these rules and say when they do.</li>
        </ul></div>
      </div>
      <p class="disclaimer">Charts are calculated with the open-source lunar-javascript and iztro libraries. Birth time is taken as local clock time, without true-solar-time correction. Readings are for cultural interest and reflection, not for medical, financial or legal decisions.</p>
    </section>`;
  }

  run(!saved);
})();
