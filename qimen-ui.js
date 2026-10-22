/* Pillars & Palaces: the "Ask a question" tab. Casts a Qimen Dunjia chart, reads it for the question,
   draws the board, a direction compass and a timing chart, and asks Claude for guidance. */
(function () {
  'use strict';
  const Q = window.Qimen;
  const $ = s => document.querySelector(s);
  const shared = window.PPShared || {};
  const esc = shared.esc || (s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const md = shared.md || (t => `<p>${esc(t)}</p>`);
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2);
  const STEM_EL = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
  const elc = s => `el-${STEM_EL[s] || 'metal'}`;
  const ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6]; // South-up board, read row by row
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!Q || !window.Solar) return;

  const state = { b: null, r: null, dirs: null, tm: null, q: '', topic: 'general', t: null, method: 'chaibu', ctx: {}, isExample: false, turns: [], busy: false, ctl: null, sample: undefined, blocked: false };

  // ---------- Tabs ----------
  function showTab(which, focus) {
    const qm = which === 'qimen';
    $('#tab-life').setAttribute('aria-selected', String(!qm));
    $('#tab-qm').setAttribute('aria-selected', String(qm));
    $('#tab-life').tabIndex = qm ? -1 : 0;
    $('#tab-qm').tabIndex = qm ? 0 : -1;
    $('#f').hidden = qm; $('#qf').hidden = !qm;
    $('#out').hidden = qm; $('#qm-out').hidden = !qm;
    $('#brand-life').hidden = qm; $('#brand-qm').hidden = !qm;
    if (focus) (qm ? $('#tab-qm') : $('#tab-life')).focus();
    if (qm && !state.b) castExample();
    try { localStorage.setItem('pp-tab', which); } catch (e) { /* storage unavailable */ }
  }
  $('#tab-life').addEventListener('click', () => showTab('life'));
  $('#tab-qm').addEventListener('click', () => showTab('qimen'));
  document.querySelector('.tabs').addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); showTab($('#tab-qm').getAttribute('aria-selected') === 'true' ? 'life' : 'qimen', true); }
  });

  // ---------- Form ----------
  $('#q-topic').innerHTML = Object.entries(Q.QTOPICS).map(([k, v]) => `<option value="${k}">${v.label} ${v.zh}</option>`).join('');
  const pad = n => String(n).padStart(2, '0');
  const toLocalInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  $('#q-when').value = toLocalInput(new Date());
  $('#q-now').addEventListener('click', () => { $('#q-when').value = toLocalInput(new Date()); });
  $('#qf').addEventListener('submit', ev => { ev.preventDefault(); submit(); });

  function parseWhen(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
    if (!m) return null;
    return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] };
  }
  function askerContext() {
    if (!$('#q-use-birth').checked) return {};
    const gender = (document.querySelector('input[name="gender"]:checked') || {}).value;
    const bd = $('#bdate').value, bt = $('#btime').value || '12:00';
    let birthYearStem = null;
    if (bd) {
      const [y, m, d] = bd.split('-').map(Number), [hh, mm] = bt.split(':').map(Number);
      try { birthYearStem = window.Solar.fromYmdHms(y, m, d, hh, mm, 0).getLunar().getYearGanByLiChun(); } catch (e) { birthYearStem = null; }
    }
    return { gender, birthYearStem };
  }

  function submit() {
    $('#q-err').textContent = '';
    const q = $('#q-text').value.trim();
    const t = parseWhen($('#q-when').value);
    if (!q) { $('#q-err').textContent = 'Type your question first.'; return; }
    if (!t || t.year < 1900 || t.year > 2100) { $('#q-err').textContent = 'Choose a valid date and time between 1900 and 2100.'; return; }
    cast(q, $('#q-topic').value, t, $('#q-method').value, false);
    $('#qm-out').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    askClaude(null); // the first answer to the question
  }

  function castExample() {
    const t = parseWhen($('#q-when').value) || parseWhen(toLocalInput(new Date()));
    cast('Is this a good time to start a new project?', 'general', t, $('#q-method').value, true);
  }

  function cast(q, topic, t, method, isExample) {
    try {
      state.ctx = askerContext();
      state.b = Q.cast({ ...t, method });
      state.r = Q.read(state.b, topic, state.ctx);
      state.dirs = Q.directions(state.b);
      state.tm = Q.timing({ ...t, method }, topic, state.ctx);
    } catch (e) {
      console.error(e);
      $('#q-err').textContent = 'That time could not be charted. Check the date and time.';
      return;
    }
    Object.assign(state, { q, topic, t, method, isExample });
    if (state.ctl) state.ctl.abort();
    state.turns = [];
    render();
  }

  // ---------- Render ----------
  function render() {
    const { b, r } = state;
    const main = r.roles.find(x => x.primary);
    const dirsSorted = state.dirs.slice().sort((a, c) => c.score - a.score);
    const best = state.tm.reduce((a, x) => (x.score > a.score ? x : a));
    const hhmm = d => `${pad(d.getHours())}:00`;
    const until = d => hhmm(new Date(d.getTime() + 2 * 3600e3));
    const mainPal = main ? b.palaces[main.palace] : null;
    const notes = [];
    if (main) notes.push(`<li><b>Main indicator 用神:</b> ${esc(main.label)} sits in palace ${main.palace} ${mainPal.gua} (${mainPal.dir} ${mainPal.dirZh}) with ${mainPal.door}, ${mainPal.stars.join('/')} and ${mainPal.god}.</li>`);
    if (main && mainPal.marks.includes('kong')) notes.push(`<li><b>Empty 空亡:</b> the main indicator is in an empty palace, so expect delay until a ${b.kong.join(' or ')} day or hour fills it.</li>`);
    notes.push(`<li><b>Most supportive direction now:</b> ${dirsSorted[0].dir} ${dirsSorted[0].dirZh} (palace ${dirsSorted[0].palace} ${dirsSorted[0].gua}, ${sign(dirsSorted[0].score)}). <b>Avoid:</b> ${dirsSorted[7].dir} ${dirsSorted[7].dirZh} (${sign(dirsSorted[7].score)}).</li>`);
    notes.push(`<li><b>Best two-hour window in the next day:</b> ${hhmm(best.from)}–${until(best.from)} ${best.branch}时 (${best.verdict}, ${sign(best.score)})${best === state.tm[0] ? ', which is now' : ''}.</li>`);

    $('#qm-out').innerHTML = `
      <section>
        <div class="sec-head"><div><div class="eyebrow">Qimen Dunjia reading · ${esc(r.cfg.label)} ${r.cfg.zh}</div><h2>${esc(state.q)}</h2></div>
        ${state.isExample ? '<span class="example-flag">Example question. Type your own above.</span>' : ''}</div>
        <div class="qm-top">
          <div style="display:grid;gap:16px;min-width:0">
            <article class="reading">
              <div class="r-head">
                <div class="r-title"><h3>Answer from the chart</h3><span class="zh">断局</span></div>
                <div class="verdict lv${r.level}" style="background:none">${dots(r.level)}<span class="pill lv${r.level}">${r.verdict}</span></div>
              </div>
              <div class="meters"><span>Score</span>${meter(r.score)}<span class="num">${sign(r.score)}</span></div>
              <ul class="notes">${notes.join('')}</ul>
              <details class="derive">
                <summary>How this was derived (${r.ev.length} rules)</summary>
                <div class="ev-col" style="margin-top:10px">${r.ev.map(evItem).join('')}</div>
                <div class="formula"><code>Sum ${sign(r.total)} ÷ 6 → ${sign(r.score)} (capped at ±1) → ${r.verdict}</code></div>
              </details>
            </article>
            ${guidePanel()}
          </div>
          <div class="panel" style="display:grid;gap:10px;min-width:0">
            <h3>The board <span class="zh">奇门盘</span></h3>
            <p class="note" style="margin:0">${b.solar} · ${b.pillars.year}年 ${b.pillars.month}月 ${b.pillars.day}日 ${b.pillars.hour}时 · ${b.term} ${b.yuan} · ${b.yang ? '阳' : '阴'}遁${b.ju}局 (${b.method === 'maoshan' ? 'Mao Shan 茅山' : 'Chai Bu 拆补'})</p>
            <div class="qm-board-wrap">${board()}</div>
            <p class="note" style="margin:0">South is at the top, as on traditional boards. Each palace shows its spirit, star with the heaven-plate stem, and door with the earth-plate stem. Shading shows how supportive the palace is; the thick outline is your main indicator and the dashed outline is you.</p>
          </div>
        </div>
      </section>
      <section>
        <div class="sec-head"><div><div class="eyebrow">Where and when</div><h2>Directions and timing <span class="zh">方位 · 时机</span></h2></div></div>
        <div class="dec-grid">
          <div class="panel" style="display:grid;gap:8px">
            <h3>Direction compass</h3>
            <div class="compass-wrap">${compass()}</div>
            <p class="note" style="margin:0">Wedge length and colour show how supportive each direction is right now, from the door, star, spirit and patterns in that palace. ★ marks the palace of your main indicator.</p>
          </div>
          <div class="panel" style="display:grid;gap:8px;min-width:0">
            <h3>Next 12 two-hour periods for this question</h3>
            <div class="scroll">${timingBars()}</div>
            <div class="heat-legend"><span>Unfavourable</span><span class="ramp"></span><span>Favourable</span><span>· click a period to cast its chart</span></div>
          </div>
        </div>
      </section>
      <section>
        <div class="sec-head"><div><div class="eyebrow">Method</div><h2>How the Qimen reading works</h2></div></div>
        <div class="method">
          <div class="panel"><h3>Casting the chart</h3><ol>
            <li>The four pillars of the moment come from the solar calendar; a 子 hour from 23:00 counts as the next day.</li>
            <li>The solar term sets Yang 阳遁 or Yin 阴遁 and, with the 上/中/下元, the 局 number 1–9. Chai Bu takes the 元 from the day's 符头; Mao Shan counts five-day blocks from the term.</li>
            <li>The Three Wonders and Six Instruments are laid on the earth plate; the duty star 值符 moves to the hour stem and the outer ring turns as one (rotating plate 转盘).</li>
            <li>The duty door 值使 counts one palace per hour from the xun's palace; the eight spirits start from the duty star.</li>
          </ol></div>
          <div class="panel"><h3>Reading the question</h3><ol>
            <li>Each topic has indicators 用神, for example the Life door 生门 for profit or the Open door 开门 for a job. You are the day stem 日干.</li>
            <li>Each indicator's palace is judged by its door, star and spirit, stem patterns such as 青龙返首, and markers: empty 空亡, oppressed door 门迫, punishment 击刑 and tomb 入墓.</li>
            <li>The five-element relation between your palace and the main indicator's palace shows whether the matter comes to you or pressures you.</li>
            <li>The total is divided by 6 and capped to −1…+1, then banded like the life readings. Claude then interprets the full board for your question.</li>
          </ol></div>
          <div class="panel"><h3>Verified</h3><ul>
            <li>The plates were checked against the independent qimen-dunjia package: 385 of 385 random moments matched palace by palace.</li>
            <li>The scoring rules and weights are this app's own synthesis of common classical techniques; schools differ.</li>
            <li>Qimen is for reflection and planning, not for medical, financial or legal decisions.</li>
          </ul></div>
        </div>
      </section>`;
    wireGuide();
  }

  const dots = level => `<span class="dots" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</span>`;
  const meter = v => `<div class="meter"><span class="${v >= 0 ? 'pos' : 'neg'}" style="width:${Math.min(Math.abs(v), 1) * 50}%"></span></div>`;
  function evItem(e) {
    const cls = e.pts > 0 ? 'p' : e.pts < 0 ? 'n' : 'z';
    return `<div class="ev"><span class="pts ${cls}">${sign(e.pts)}</span><div><b>${esc(e.title)}</b><p>${esc(e.detail)}</p></div></div>`;
  }
  function tint(score, maxPct) {
    const pct = Math.round(Math.min(Math.abs(score), 1) * maxPct);
    return `color-mix(in oklab, ${score >= 0 ? 'var(--pos)' : 'var(--neg)'} ${pct}%, var(--surface))`;
  }

  function board() {
    const { b, r } = state;
    const dirScore = Object.fromEntries(state.dirs.map(d => [d.palace, d.score]));
    const tagsAt = p => r.roles.filter(x => x.palace === p).map(x => {
      if (x.key === 'self') return '<span class="rt self">You 日干</span>';
      if (x.key === 'year') return '<span class="rt minor">年命</span>';
      const short = x.label.split(' (')[0];
      return `<span class="rt ${x.primary ? '' : 'minor'}">${esc(short.charAt(0).toUpperCase() + short.slice(1))}</span>`;
    }).join('');
    const MK = { kong: ['空 Empty', 'bad'], horse: ['马 Horse', 'good'], jixing: ['刑 Punished', 'bad'], tomb: ['墓 Tomb', 'bad'], menpo: ['迫 Oppressed', 'bad'] };
    const mainP = (r.roles.find(x => x.primary) || {}).palace;
    const selfP = (r.roles.find(x => x.key === 'self') || {}).palace;
    return `<div class="qm-board" role="img" aria-label="Qimen board for ${esc(b.solar)}">${ORDER.map(p => {
      const pal = b.palaces[p];
      if (p === 5) {
        return `<div class="qp qp-center"><div class="qp-stem earth ${elc(pal.earth)}" style="font-size:1.3rem">${pal.earth}</div><dl>
          <dt>旬首</dt><dd>${b.xun} (${b.xunYi})</dd><dt>值符</dt><dd>${b.zhiFuStar} → ${b.zhiFuPalace}</dd><dt>值使</dt><dd>${b.zhiShiDoor} → ${b.zhiShiPalace}</dd>
          <dt>空亡</dt><dd>${b.kong.join('')}</dd><dt>驿马</dt><dd>${b.horse} (${b.horsePalace})</dd></dl>
          ${b.wuBuYu ? '<span class="mk bad">五不遇时</span>' : ''}${b.starFuyin ? '<span class="mk bad">伏吟</span>' : ''}${b.starFanyin ? '<span class="mk bad">反吟</span>' : ''}</div>`;
      }
      const s0 = pal.stars[0];
      return `<div class="qp ${p === mainP ? 'role-main' : ''} ${p === selfP ? 'role-self' : ''}" style="background:${tint(dirScore[p], 30)}">
        <div class="qp-row"><span class="qp-god">${pal.god}<small>${Q.GOD_INFO[pal.god].en}</small></span><span class="marks">${pal.marks.map(m => `<span class="mk ${MK[m][1]}">${MK[m][0]}</span>`).join('')}</span></div>
        <div class="qp-row"><span class="qp-star">${pal.stars.join('/')}<small>${Q.STAR_INFO[s0].en}</small></span><span>${pal.heaven.map(h => `<span class="qp-stem ${elc(h)}">${h}</span>`).join(' ')}</span></div>
        <div class="qp-row"><span class="qp-door">${pal.door}<small>${Q.DOOR_INFO[pal.door].en}</small></span><span class="qp-stem earth ${elc(pal.earth)}">${pal.earth}</span></div>
        <div class="qp-foot"><span><b>${pal.gua}${p}</b> ${pal.dir} ${pal.dirZh}</span><span class="role-tags">${tagsAt(p)}</span></div>
      </div>`;
    }).join('')}</div>`;
  }

  function compass() {
    const ANG = { S: 0, SW: 45, W: 90, NW: 135, N: 180, NE: 225, E: 270, SE: 315 };
    const C = 190, R0 = 30, RMIN = 58, RMAX = 138;
    const pt = (a, r) => [C + r * Math.sin(a * Math.PI / 180), C - r * Math.cos(a * Math.PI / 180)];
    const mainP = (state.r.roles.find(x => x.primary) || {}).palace;
    const rings = [RMIN, (RMIN + RMAX) / 2, RMAX].map((r, i) => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="var(--line)" ${i === 1 ? '' : 'stroke-dasharray="3 4"'}></circle>`).join('');
    const wedges = state.dirs.map(d => {
      const a = ANG[d.dir], r = RMIN + (d.score + 1) / 2 * (RMAX - RMIN);
      const [x1, y1] = pt(a - 21, R0), [x2, y2] = pt(a - 21, r), [x3, y3] = pt(a + 21, r), [x4, y4] = pt(a + 21, R0);
      const [lx, ly] = pt(a, RMAX + 26);
      const main = d.palace === mainP;
      return `<path d="M${x1},${y1} L${x2},${y2} A${r},${r} 0 0 1 ${x3},${y3} L${x4},${y4} A${R0},${R0} 0 0 0 ${x1},${y1} Z" fill="${tint(d.score, 85)}" stroke="${main ? 'var(--accent)' : 'var(--surface)'}" stroke-width="${main ? 3 : 2}"><title>${d.dir} ${d.dirZh} (palace ${d.palace} ${d.gua}): ${sign(d.score)}</title></path>
        <text x="${lx}" y="${ly - 3}" text-anchor="middle" font-size="12" font-weight="700">${main ? '★ ' : ''}${d.dir} ${d.dirZh}</text>
        <text x="${lx}" y="${ly + 11}" text-anchor="middle" class="sub">${d.gua}${d.palace} · ${sign(d.score)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 380 380" role="img" aria-label="Direction compass, South at the top">${rings}${wedges}<circle cx="${C}" cy="${C}" r="${R0 - 4}" fill="var(--paper)" stroke="var(--line)"></circle><text x="${C}" y="${C + 4}" text-anchor="middle" font-size="11" class="sub">中</text></svg>`;
  }

  function timingBars() {
    const tm = state.tm;
    const best = tm.reduce((a, x) => (x.score > a.score ? x : a));
    const p2 = n => String(n).padStart(2, '0');
    return `<div class="tbars">${tm.map((x, i) => {
      const h = Math.min(Math.abs(x.score), 1) * 50;
      const valPos = x.score >= 0 ? `bottom:calc(50% + ${h}% + 2px)` : `top:calc(50% + ${h}% + 2px)`;
      const until = new Date(x.from.getTime() + 2 * 3600e3);
      return `<button type="button" class="tbar ${i === 0 ? 'cur' : ''} ${x === best ? 'best' : ''}" data-qt="${i}" aria-label="${x.branch} hour ${p2(x.from.getHours())}:00 to ${p2(until.getHours())}:00: ${x.verdict} ${sign(x.score)}">
        <span class="tb-track"><span class="tb-fill ${x.score >= 0 ? 'pos' : 'neg'}" style="height:${h}%"></span><span class="tb-val" style="${valPos}">${sign(x.score)}</span></span>
        <span class="tb-lbl"><b>${x.branch}</b>${p2(x.from.getHours())}–${p2(until.getHours())}${i === 0 ? '<br>now' : x === best ? '<br>best' : `<br>${x.from.getDate() !== tm[0].from.getDate() ? 'next day' : '&nbsp;'}`}</span>
      </button>`;
    }).join('')}</div>`;
  }

  // ---------- Claude's guidance ----------
  function guidePanel() {
    return `<div class="panel chat qm-guide" id="qm-guide">
      <h3>Claude's guidance <span class="zh">指点</span></h3>
      <div class="chat-log" id="qm-log" aria-live="polite">${state.isExample ? '<p class="note">Type your own question above and cast the chart, and Claude will read the board for it.</p>' : ''}</div>
      <form class="chat-form" id="qm-form">
        <label for="qm-input" class="note" style="grid-column:1/-1">Ask a follow-up about this chart</label>
        <textarea id="qm-input" placeholder="e.g. What should I say in the meeting? Which day is better?"></textarea>
        <div class="chat-btns"><button class="btn" type="submit" id="qm-send">Ask</button><button class="btn ghost" type="button" id="qm-stop" hidden>Stop</button></div>
      </form>
      <div class="actions"><span class="note" id="qm-status"></span><button type="button" class="linkbtn" id="qm-ask-now" ${state.isExample ? 'hidden' : ''}>Get Claude's guidance for this chart</button></div>
    </div>`;
  }
  function wireGuide() {
    $('#qm-form').addEventListener('submit', ev => { ev.preventDefault(); const v = $('#qm-input').value.trim(); if (v) askClaude(v); });
    $('#qm-input').addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); const v = $('#qm-input').value.trim(); if (v) askClaude(v); } });
    $('#qm-stop').addEventListener('click', () => state.ctl && state.ctl.abort());
    $('#qm-ask-now').addEventListener('click', () => askClaude(null));
    $('#qm-out').querySelectorAll('[data-qt]').forEach(btn => btn.addEventListener('click', () => {
      const x = state.tm[Number(btn.dataset.qt)];
      $('#q-when').value = toLocalInput(x.from);
      cast(state.q, state.topic, { ...x.t, minute: 0, hour: x.from.getHours(), day: x.from.getDate(), month: x.from.getMonth() + 1, year: x.from.getFullYear() }, state.method, state.isExample);
    }));
    initSample();
  }

  async function initSample() {
    if (state.sample === undefined) {
      const hasRuntime = !!(window.claude && window.claude.use);
      try { state.sample = hasRuntime ? await window.claude.use('sample') : null; } catch (e) { state.sample = null; }
      state.hasRuntime = hasRuntime;
      if (state.sample) { try { state.tools = !!(await state.sample.limits()).tools; } catch (e) { state.tools = false; } }
    }
    const st = $('#qm-status'); if (!st) return;
    if (!state.sample) {
      st.textContent = state.hasRuntime
        ? 'Claude is not reachable in this view. Open the page from its claude.ai/artifact link while signed in, then reload.'
        : 'This copy of the page is not running inside claude.ai, so Claude’s guidance is unavailable. The board and rule-based reading still work.';
      $('#qm-send').disabled = true;
      const b = $('#qm-ask-now'); if (b) b.hidden = true;
    } else if (state.blocked) {
      $('#qm-send').disabled = true;
    } else st.textContent = 'Guidance uses your own Claude account. The first request asks for your permission.';
  }

  const INSTRUCTIONS = `You are an experienced Qimen Dunjia (奇门遁甲) practitioner. Someone has asked a question, and the "Pillars & Palaces" app has cast an hour chart (时家奇门, rotating plate 转盘) for the moment of the question and made a rule-based reading. The chart and reading are below.

Answer in this order:
1. **Answer**: a direct, plain answer to the question (likely outcome and how confident the chart is).
2. **Why**: the key evidence. Cite palaces by number, trigram and direction, and the doors, stars, spirits, stem patterns and markers (空亡, 门迫, 击刑, 入墓) behind each point. Explain the relation between the asker (day stem 日干) and the main indicator 用神.
3. **Guidance**: concrete next steps. Include the best timing (use the timing table, and when the indicator is empty 空亡 say when it fills), favourable and unfavourable directions, and what to avoid.
4. **Caution**: one or two sentences on uncertainty. For health, legal or financial decisions, say a professional should be consulted.

Rules: ground every claim in the chart data. When you go beyond the app's rule-based scores with classical interpretation, say so. Reply in the language of the question, keeping Chinese terms with a short gloss when replying in English. Be practical and balanced, never fatalistic. Keep it under about 400 words; use short headings and bullets.`;

  function chartText() {
    const { b, r } = state;
    const L = [];
    L.push(`QUESTION: ${state.q}`);
    L.push(`TOPIC: ${r.cfg.label} ${r.cfg.zh}`);
    L.push(`MOMENT: ${b.solar} local clock; pillars ${b.pillars.year}年 ${b.pillars.month}月 ${b.pillars.day}日 ${b.pillars.hour}时; solar term ${b.term} (from ${b.termAt}) ${b.yuan}; ${b.yang ? '阳遁' : '阴遁'}${b.ju}局; method ${b.method === 'maoshan' ? 'Mao Shan 茅山' : 'Chai Bu 拆补'}.`);
    L.push(`XUN: ${b.xun} (符首 ${b.xunYi}); duty star 值符 ${b.zhiFuStar} now in palace ${b.zhiFuPalace}; duty door 值使 ${b.zhiShiDoor} now in palace ${b.zhiShiPalace}; empty 空亡 ${b.kong.join('')} (palace ${b.kongPalaces.join(',')}); horse 驿马 ${b.horse} (palace ${b.horsePalace}); 五不遇时 ${b.wuBuYu ? 'yes' : 'no'}; star 伏吟 ${b.starFuyin ? 'yes' : 'no'}; star 反吟 ${b.starFanyin ? 'yes' : 'no'}.`);
    L.push('BOARD (palace: trigram, direction, palace element; spirit; star(s); heaven stem(s) / earth stem; door; markers):');
    [1, 8, 3, 4, 9, 2, 7, 6].forEach(p => {
      const x = b.palaces[p];
      L.push(`  ${p} ${x.gua} ${x.dir} ${x.el}: ${x.god}; ${x.stars.join('/')}; ${x.heaven.join('')} / ${x.earth}; ${x.door}; ${x.marks.join(',') || 'none'}`);
    });
    L.push(`  5 centre: earth stem ${b.palaces[5].earth}`);
    L.push(`ASKER: ${state.ctx.gender || 'gender not given'}; birth-year stem ${state.ctx.birthYearStem || 'not given'}.`);
    L.push(`INDICATORS: ${r.roles.map(x => `${x.label} → palace ${x.palace}`).join('; ')}.`);
    L.push(`APP READING: ${r.verdict}, score ${r.score} (sum ${r.total} ÷ 6, capped ±1; bands >0.45 very favourable, >0.15 favourable, ±0.15 uncertain, <−0.15 difficult, <−0.45 unfavourable).`);
    r.ev.forEach(e => L.push(`  [${e.pts}] ${e.title}: ${e.detail}`));
    L.push(`DIRECTIONS (palace score −1..1): ${state.dirs.map(d => `${d.dir} ${d.dirZh} p${d.palace} ${d.score}`).join('; ')}.`);
    L.push(`TIMING (same question, next 12 two-hour periods): ${state.tm.map(x => `${pad(x.from.getMonth() + 1)}-${pad(x.from.getDate())} ${pad(x.from.getHours())}:00 ${x.branch}时 ${x.score}`).join('; ')}.`);
    return L.join('\n');
  }

  const ERR_COPY = {
    not_granted: 'Claude is not allowed for this page. You can allow it from the page\'s permissions menu.',
    sampling_disabled: 'Claude is not available for this account.',
    rate_limited: 'Too many requests in a short time, or a usage limit was reached. Try again in a little while.',
    session_expired: 'Your session expired. Sign in to claude.ai again, then try again.',
    refused: 'Claude declined to answer that. Try rephrasing the question.',
    prompt_too_large: 'The conversation got too long. Cast the chart again to start fresh.',
    empty_completion: 'Claude returned an empty answer. Try again.'
  };

  async function askClaude(followUp) {
    await initSample();
    if (!state.sample || state.blocked || state.busy || !state.b) return;
    const log = $('#qm-log');
    log.querySelectorAll('p.note').forEach(n => n.remove());
    const userText = followUp || `My question: ${state.q}\nPlease read the chart for it.`;
    if (followUp) log.insertAdjacentHTML('beforeend', `<div class="msg user">${esc(followUp)}</div>`);
    log.insertAdjacentHTML('beforeend', '<div class="msg bot"><span class="thinking">Thinking… reading the board</span></div>');
    const bubble = log.lastElementChild;
    $('#qm-input').value = '';
    $('#qm-ask-now').hidden = true;
    state.turns.push({ role: 'user', content: userText });
    while (state.turns.length > 12) state.turns.splice(0, 2);
    const msgs = [{ role: 'user', content: `${INSTRUCTIONS}\n\n=== CHART ===\n${chartText()}\n=== END CHART ===` }, ...state.turns];
    state.busy = true; state.ctl = new AbortController();
    $('#qm-send').disabled = true; $('#qm-stop').hidden = false;
    try {
      const { text, truncated } = await state.sample(msgs, { signal: state.ctl.signal, cache: false, onText: ({ text }) => { bubble.innerHTML = md(text); } });
      bubble.innerHTML = md(text) + (truncated ? '<p class="err">The answer was cut short. Ask a follow-up for the rest.</p>' : '');
      state.turns.push({ role: 'assistant', content: text });
    } catch (e) {
      state.turns.pop();
      const code = e && e.code;
      if (code === 'cancelled') bubble.innerHTML = (e.text ? md(e.text) : '') + '<p class="err">Stopped.</p>';
      else {
        bubble.innerHTML = (e && e.text && code !== 'refused' ? md(e.text) : '') + `<p class="err">${esc(ERR_COPY[code] || 'Claude could not answer just now. Try again.')}</p>`;
        if (code === 'not_granted' || code === 'sampling_disabled') { state.blocked = true; $('#qm-status').textContent = ERR_COPY[code]; }
      }
      if (!state.turns.length && !state.blocked) $('#qm-ask-now').hidden = false;
    } finally {
      state.busy = false;
      $('#qm-send').disabled = state.blocked;
      $('#qm-stop').hidden = true;
    }
  }

  // ---------- Start ----------
  let startTab = 'life';
  try { startTab = localStorage.getItem('pp-tab') || 'life'; } catch (e) { /* storage unavailable */ }
  if (location.hash === '#qimen') startTab = 'qimen';
  if (location.hash === '#life') startTab = 'life';
  showTab(startTab);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#qimen') showTab('qimen');
    else if (location.hash === '#life') showTab('life');
  });
})();
