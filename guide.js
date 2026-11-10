/*
 * Pillars & Palaces: plain-language guidance.
 *  - What each ten god in each pillar means for the Day Master.
 *  - How to strengthen the useful element in daily life.
 *  - A "what to do next" guide: this year, ages to look out for, and a checklist.
 * Exposes window.Guide = { tenGods(bz), guide(r, tl, form) }.
 */
(function () {
  'use strict';
  const E = window.FateEngine;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2);
  const STEMS = '甲乙丙丁戊己庚辛壬癸';
  const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

  // ---------- The Day Master in everyday words ----------
  const DAY_MASTER = {
    甲: 'a tall tree: upright, principled and steady, a natural leader who grows by aiming high',
    乙: 'a flower or vine: gentle, adaptable and sociable, good at finding a way around obstacles',
    丙: 'the sun: warm, generous and outgoing, at your best when you can shine for others',
    丁: 'a candle flame: thoughtful, caring and focused, lighting the way quietly for people close to you',
    戊: 'a mountain: stable, reliable and protective, the person others lean on',
    己: 'fertile farmland: nurturing, practical and patient, good at helping things grow',
    庚: 'an axe or sword: decisive, direct and loyal, with a strong sense of right and wrong',
    辛: 'a polished jewel: refined, sensitive and detail-minded, with high standards',
    壬: 'a great river or ocean: bold, clever and restless, always moving towards new horizons',
    癸: 'rain or mist: gentle, intuitive and imaginative, quietly influential'
  };

  // ---------- Ten gods in plain words ----------
  const TEN_GOD_PLAIN = {
    比肩: { who: 'people on your level: siblings, friends, peers', gives: 'independence, confidence and a strong support network', watch: 'stubbornness, or competing with friends for the same thing' },
    劫财: { who: 'bold peers and rivals', gives: 'drive, courage and social energy', watch: 'impulsive spending and partnerships that cost you money' },
    食神: { who: 'your talents, creativity and enjoyment of life (for women, also children)', gives: 'ease, artistry, good taste and a relaxed charm', watch: 'complacency and over-indulgence' },
    伤官: { who: 'your brilliance and self-expression (for women, also children)', gives: 'original ideas, eloquence and a rebel streak that drives innovation', watch: 'clashing with bosses or rules, and sharp words you later regret' },
    偏财: { who: 'windfalls, business deals, investments and your father (for men, also romance)', gives: 'generosity, a nose for opportunity and an easy way with money', watch: 'speculation and money that comes and goes quickly' },
    正财: { who: 'steady income, savings and hard work (for men, also the wife)', gives: 'diligence, reliability and careful money management', watch: 'being overly cautious or too focused on material security' },
    七杀: { who: 'pressure, challenges and power (for women, also a boyfriend or partner)', gives: 'courage, toughness and leadership in a crisis', watch: 'stress, conflict and taking too many risks' },
    正官: { who: 'status, rules, your employer and reputation (for women, also the husband)', gives: 'responsibility, self-discipline and recognition', watch: 'rigidity and fear of making mistakes' },
    偏印: { who: 'unconventional knowledge, intuition and spirituality (also step-parents)', gives: 'insight, specialist skills and independent thinking', watch: 'isolation, overthinking and unfinished plans' },
    正印: { who: 'your mother, mentors, education, protection and property', gives: 'support, kindness, learning and a safety net', watch: 'depending on others too much and putting things off' }
  };
  const GOD_GROUP = { 比肩: 'companion', 劫财: 'companion', 食神: 'output', 伤官: 'output', 偏财: 'wealth', 正财: 'wealth', 七杀: 'officer', 正官: 'officer', 偏印: 'resource', 正印: 'resource' };

  // Classical age ranges for the four pillars
  const PILLAR_PLAIN = {
    year: { area: 'family background, grandparents and early childhood', ages: 'about ages 1–16' },
    month: { area: 'parents, siblings and your working environment', ages: 'about ages 17–32' },
    day: { area: 'yourself and your spouse or partner', ages: 'about ages 33–48' },
    hour: { area: 'children, your own projects and later life', ages: 'about age 49 onwards' }
  };

  // ---------- How to strengthen each element ----------
  const BOOST = {
    wood: {
      what: 'growth, kindness, planning and learning',
      colours: 'green and teal', direction: 'East', time: 'spring, and early morning (3–7 am)', numbers: '3 and 8',
      work: 'education, writing and publishing, design, fashion and textiles, plants, farming and the environment, wellness and herbal medicine',
      activities: 'walks in parks and forests, gardening, stretching or yoga, starting a new course, setting long-term goals',
      food: 'leafy greens, sprouts and fresh vegetables; a little sour flavour such as citrus or vinegar',
      home: 'live plants and fresh flowers, wooden furniture, tall or upright shapes',
      habit: 'be generous and patient with people (benevolence, 仁), and keep learning something new',
      tooMuch: 'stubbornness and spreading yourself too thin'
    },
    fire: {
      what: 'warmth, visibility, enthusiasm and social energy',
      colours: 'red, orange, pink and purple', direction: 'South', time: 'summer, and late morning to midday (9 am–1 pm)', numbers: '2 and 7',
      work: 'media, marketing and advertising, entertainment and performing, teaching and public speaking, technology and electronics, energy, restaurants and beauty',
      activities: 'time in the sun, cardio exercise, social events, presenting or performing, sharing your ideas online',
      food: 'warm cooked meals, red foods such as tomatoes and red dates; a little bitter flavour such as tea or dark chocolate',
      home: 'bright lighting, candles, warm colours, triangular or pointed shapes',
      habit: 'show warmth and courtesy (propriety, 礼), speak up, and let people see your work',
      tooMuch: 'impatience, burnout and saying things in the heat of the moment'
    },
    earth: {
      what: 'stability, trust, patience and practical structure',
      colours: 'yellow, beige, brown and terracotta', direction: 'Centre, North-east and South-west', time: 'the change of seasons, and early afternoon', numbers: '5 and 0',
      work: 'property and construction, agriculture, banking and insurance, human resources, project management, mediation and consulting, ceramics',
      activities: 'hiking in hills or mountains, pottery or working with soil, keeping a steady daily routine, budgeting and saving',
      food: 'root vegetables, sweet potatoes, pumpkin, whole grains and naturally sweet foods',
      home: 'ceramics, stone and clay, square shapes, an orderly, uncluttered space',
      habit: 'keep your promises (trustworthiness, 信), build routines, and save regularly',
      tooMuch: 'worrying, overthinking and resistance to change'
    },
    metal: {
      what: 'discipline, clarity, decisiveness and structure',
      colours: 'white, silver, gold and grey', direction: 'West and North-west', time: 'autumn, and late afternoon (3–7 pm)', numbers: '4 and 9',
      work: 'finance and banking, law, engineering, machinery and cars, IT hardware, jewellery, management and quality control',
      activities: 'structured training such as weights or martial arts, breathing exercises, decluttering, making clear decisions and sticking to them',
      food: 'white foods such as pears, radish, lotus root and tofu; a little pungent flavour such as ginger or garlic',
      home: 'metal objects, round shapes, a clean and minimal look',
      habit: 'act with integrity (righteousness, 义), set clear boundaries, and finish what you start',
      tooMuch: 'harshness, rigidity and being overly critical'
    },
    water: {
      what: 'wisdom, flexibility, communication and movement',
      colours: 'black, navy and blue', direction: 'North', time: 'winter, and late night (9 pm–1 am)', numbers: '1 and 6',
      work: 'trade and logistics, travel and shipping, communication and media, research and writing, software and IT, drinks, cleaning and consulting',
      activities: 'swimming, travel, reading and research, meditation, good sleep, networking',
      food: 'seafood, black beans, black sesame, seaweed and soups; a little salty flavour',
      home: 'a small water feature or aquarium, wavy or flowing shapes, dark blue accents',
      habit: 'stay curious and adaptable (wisdom, 智), listen more, and rest well',
      tooMuch: 'drifting, indecision and anxiety'
    }
  };

  // ---------- Ten gods per pillar ----------
  function tenGods(bz) {
    const favWord = el => bz.favEls.includes(el) ? '<b class="ok">helps you</b>' : '<b class="warn">is hard for you</b>';
    const favTip = el => bz.favEls.includes(el)
      ? 'lean into it: it works in your favour.'
      : 'handle it with care: its element is not one your chart needs, so the downside tends to show more.';
    const rows = bz.pillars.map(p => {
      const pp = PILLAR_PLAIN[p.key];
      const items = [];
      if (p.key === 'day') items.push(`<li><span class="tg">日主 You</span><span>The stem <b class="zh">${p.stem}</b> is <b>you</b>, the Day Master: like ${DAY_MASTER[p.stem]}.</span></li>`);
      else {
        const g = TEN_GOD_PLAIN[p.stemGod];
        items.push(`<li><span class="tg">${p.stemGod}</span><span>The stem <b class="zh">${p.stem}</b> is <b>${p.stemGod} ${E.TEN_GOD_EN[p.stemGod]}</b>: ${g.who}. It brings ${g.gives}; watch for ${g.watch}. Its element (${E.EL_EN[p.stemEl]}) ${favWord(p.stemEl)}, so ${favTip(p.stemEl)}</span></li>`);
      }
      const h = p.hidden[0], hg = TEN_GOD_PLAIN[h.god];
      items.push(`<li><span class="tg">${h.god}</span><span>The branch <b class="zh">${p.branch}</b> mainly holds <b class="zh">${h.stem}</b>, <b>${h.god} ${E.TEN_GOD_EN[h.god]}</b>: ${hg.who}. ${p.key === 'day' ? 'Because it sits in your spouse seat, it also describes the kind of partner and home life that suits you. ' : ''}Its element (${E.EL_EN[h.el]}) ${favWord(h.el)}.</span></li>`);
      return `<div class="tg-pillar"><h4>${p.label} pillar <span class="zh">${p.zh} ${p.stem}${p.branch}</span><small>${pp.area} · ${pp.ages}</small></h4><ul>${items.join('')}</ul></div>`;
    }).join('');
    return `<div class="panel" style="display:grid;gap:10px">
      <h3>What each pillar says about you <span class="zh">十神解读</span></h3>
      <p class="note" style="margin:0">Each character is a “ten god” 十神: its relationship to you, the Day Master. Each pillar covers one area of life and, traditionally, one stage of life.</p>
      <div class="tg-grid">${rows}</div>
    </div>`;
  }

  // ---------- Strengthening an element ----------
  function boostCard(el, primary) {
    const b = BOOST[el];
    return `<div class="boost ${primary ? 'primary' : ''}">
      <h4><span class="zh el-${el}">${E.EL_ZH[el]}</span> ${E.EL_EN[el]}${primary ? ' <small>your main useful element 用神</small>' : ''}</h4>
      <p>Brings ${b.what}.</p>
      <dl>
        <dt>Wear and use</dt><dd>${b.colours}</dd>
        <dt>Direction</dt><dd>${b.direction}: face it at your desk, or favour it when moving house or travelling</dd>
        <dt>Best times</dt><dd>${b.time}: schedule important things then</dd>
        <dt>Work that suits</dt><dd>${b.work}</dd>
        <dt>Do more of</dt><dd>${b.activities}</dd>
        <dt>Eat</dt><dd>${b.food}</dd>
        <dt>At home</dt><dd>${b.home}</dd>
        <dt>Mindset</dt><dd>${b.habit}</dd>
        <dt>Lucky numbers</dt><dd>${b.numbers}</dd>
      </dl>
    </div>`;
  }

  // ---------- Flags for a year ----------
  function flagsFor(bz, y, lpGz) {
    const d = bz.pillars[2];
    const si = s => STEMS.indexOf(s), bi = b => BRANCHES.indexOf(b);
    const f = [];
    if (Math.abs(si(y.yp[0]) - si(d.stem)) === 6 && Math.abs(bi(y.yp[1]) - bi(d.branch)) === 6) f.push('clash');
    else if (Math.abs(bi(y.yp[1]) - bi(d.branch)) === 6) f.push('dayclash');
    if (lpGz && lpGz === y.yp) f.push('double');
    if (y.yp === d.stem + d.branch) f.push('repeat');
    return f;
  }
  const FLAG_TEXT = {
    clash: { name: 'Full clash with your own pillar 天克地冲', how: 'a year of big change. Avoid risky moves, double-check contracts, drive carefully and get a health check-up; let changes come rather than forcing them.' },
    dayclash: { name: 'Clash with your day branch 冲日支', how: 'expect change at home or in your relationship, or a move. Talk things through calmly, avoid rash decisions about your partner, and take care with travel and sport.' },
    double: { name: 'Luck pillar and year are the same 岁运并临', how: 'everything is amplified, good and bad. Keep a steady routine and savings buffer, and avoid gambling on big bets.' },
    repeat: { name: 'Year repeats your day pillar 伏吟', how: 'things may feel stuck or repetitive. Use the year to finish old business rather than start big new ventures.' }
  };
  const TOPIC_HANDLE = {
    overall: 'keep plans conservative, protect your savings and health, and avoid big gambles',
    career: 'keep a low profile at work, document decisions, and avoid quitting on impulse',
    wealth: 'build a cash buffer, avoid lending money or guaranteeing loans, and skip speculative investments',
    love: 'make time to talk, avoid escalating arguments, and do not rush big relationship decisions',
    property: 'delay big property purchases, and read contracts closely for hidden costs',
    family: 'check in on elderly relatives and keep the peace at home',
    children: 'give children extra time and patience',
    health: 'book check-ups, sleep well, and avoid risky sports or driving tired',
    studies: 'set a strict study plan and start preparing early',
    travel: 'double-check travel documents and avoid unnecessary risky trips',
    social: 'be careful with new partnerships and money between friends'
  };

  // ---------- The guide ----------
  function guide(r, tl, form) {
    const bz = r.bz, Y = r.Y, age = r.age;
    const strengthPlain = bz.lean === 'strong'
      ? 'You have plenty of your own energy. Life goes best when you channel it into work, money, responsibility and helping others, rather than going it alone or stockpiling.'
      : 'Your own energy needs support. Life goes best with good mentors, learning, a reliable team and enough rest, rather than taking on everything yourself.';
    const others = bz.favEls.filter(e => e !== bz.useful);
    const avoid = bz.unfavEls.map(e => `<li><b>${E.EL_EN[e]} <span class="zh">${E.EL_ZH[e]}</span></b>: you don’t need more of it. Don’t overdo ${BOOST[e].colours.split(' and ')[0]} or its activities, and watch for ${BOOST[e].tooMuch}.</li>`).join('');

    // This year, from the timeline when ready
    const allYears = tl ? tl.flatMap(d => d.years.map(y => ({ ...y, dec: d }))) : [];
    const thisYear = allYears.find(y => y.year === Y);
    let yearHtml;
    if (thisYear) {
      const ranked = E.ALL_TOPICS.map(t => ({ t, s: thisYear.scores[t] })).sort((a, b) => b.s.c - a.s.c);
      const best = ranked.slice(0, 2), worst = ranked.slice(-2).reverse().filter(x => x.s.c < 0.15);
      yearHtml = `<p>Overall, ${Y} looks <b>${thisYear.scores.overall.verdict.toLowerCase()}</b> for you (${sign(thisYear.scores.overall.c)}).</p>
        <ul class="g-list">
          ${best.map(x => `<li class="up"><b>Make the most of ${E.TOPICS[x.t].label.toLowerCase()}</b> (${x.s.verdict}): ${E.ADVICE[x.t][x.s.level >= 4 ? 0 : 1]}</li>`).join('')}
          ${worst.map(x => `<li class="down"><b>Protect ${E.TOPICS[x.t].label.toLowerCase()}</b> (${x.s.verdict}): ${E.ADVICE[x.t][x.s.level <= 2 ? 2 : 1]}</li>`).join('')}
        </ul>`;
    } else yearHtml = '<p class="muted">Scoring the year…</p>';

    // Ages to look out for
    let agesHtml = '<p class="muted">Scoring every year of every luck pillar…</p>';
    let nextSteps = [];
    if (tl) {
      const real = tl.filter(d => !d.pre);
      const bestDec = real.slice().sort((a, b) => b.avg.overall - a.avg.overall)[0];
      const worstDec = real.slice().sort((a, b) => a.avg.overall - b.avg.overall)[0];
      const future = allYears.filter(y => y.year >= Y && y.year <= Y + 20); // the next 20 years: close enough to act on
      const top = future.slice().sort((a, b) => b.scores.overall.c - a.scores.overall.c).slice(0, 3).sort((a, b) => a.year - b.year);
      const low = future.slice().sort((a, b) => a.scores.overall.c - b.scores.overall.c).slice(0, 3).sort((a, b) => a.year - b.year);
      const weakTopic = y => E.ALL_TOPICS.map(t => ({ t, c: y.scores[t].c })).sort((a, b) => a.c - b.c)[0];
      const reason = y => { const e = (y.scores.overall.top || []).find(x => x.pts < 0); return e ? e.title : null; };
      const turns = real.filter(d => d.startYear > Y).slice(0, 3);
      const flagged = future.filter(y => y.year <= Y + 30).map(y => ({ y, f: flagsFor(bz, y, y.dec.ganzhi) })).filter(x => x.f.length).slice(0, 6);
      agesHtml = `
        <div class="g-cols">
          <div><h4>Strongest decade</h4><p><b>Ages ${bestDec.startAge}–${bestDec.endAge}</b> (${bestDec.startYear}–${bestDec.endYear}, luck pillar <span class="zh">${bestDec.ganzhi}</span>, average ${sign(bestDec.avg.overall)}). Plan your biggest moves, such as a career change, a business or buying property, for this period.</p></div>
          <div><h4>Most demanding decade</h4><p><b>Ages ${worstDec.startAge}–${worstDec.endAge}</b> (${worstDec.startYear}–${worstDec.endYear}, <span class="zh">${worstDec.ganzhi}</span>, average ${sign(worstDec.avg.overall)}). Go in with savings, good health habits and people you trust, and favour steady progress over big risks.</p></div>
        </div>
        <h4>Best years in the next 20 years</h4>
        <ul class="g-list">${top.map(y => `<li class="up"><b>Age ${y.age} (${y.year} <span class="zh">${y.yp}</span>)</b>: ${y.scores.overall.verdict}, ${sign(y.scores.overall.c)}. Use it to start something important. <button type="button" class="linkbtn" data-year="${y.year}">Read ${y.year}</button></li>`).join('')}</ul>
        <h4>Years to handle with care in the next 20 years</h4>
        <ul class="g-list">${low.map(y => { const w = weakTopic(y), rsn = reason(y); return `<li class="down"><b>Age ${y.age} (${y.year} <span class="zh">${y.yp}</span>)</b>: ${y.scores.overall.verdict}, ${sign(y.scores.overall.c)}${rsn ? `, mainly because of ${esc(rsn)}` : ''}. Weakest area: ${E.TOPICS[w.t].label.toLowerCase()}, so ${TOPIC_HANDLE[w.t]}. Start preparing the year before. <button type="button" class="linkbtn" data-year="${y.year}">Read ${y.year}</button></li>`; }).join('')}</ul>
        ${turns.length ? `<h4>Turning points</h4><ul class="g-list">${turns.map(d => `<li><b>Age ${d.startAge} (${d.startYear})</b>: your luck pillar changes to <span class="zh">${d.ganzhi}</span>, averaging ${sign(d.avg.overall)}. ${d.avg.overall > 0.15 ? 'Things open up: prepare to act.' : d.avg.overall < -0.05 ? 'A more demanding stretch: build reserves beforehand.' : 'A mixed decade: steady effort pays.'} Its best year is ${d.best.overall} and its hardest is ${d.worst.overall}.</li>`).join('')}</ul>` : ''}
        ${flagged.length ? `<h4>Years with special warning signs</h4><ul class="g-list">${flagged.map(({ y, f }) => `<li class="down"><b>Age ${y.age} (${y.year})</b>: ${f.map(k => `${FLAG_TEXT[k].name}: ${FLAG_TEXT[k].how}`).join(' ')}</li>`).join('')}</ul>` : ''}`;

      const nextBest = top[0], nextLow = low[0];
      nextSteps = [
        `Bring more <b>${E.EL_EN[bz.useful]}</b> into daily life this week: wear or decorate with ${BOOST[bz.useful].colours.split(' and ')[0]}, and ${BOOST[bz.useful].activities.split(',')[0]}.`,
        thisYear ? `This year, put your energy into <b>${E.TOPICS[E.ALL_TOPICS.slice().sort((a, b) => thisYear.scores[b].c - thisYear.scores[a].c)[0]].label.toLowerCase()}</b>, where your chart is strongest.` : null,
        nextLow ? `Mark <b>age ${nextLow.age} (${nextLow.year})</b> in your calendar as a careful year: from ${nextLow.year - 1}, build savings and keep health check-ups up to date.` : null,
        nextBest ? `Aim your next big move at <b>age ${nextBest.age} (${nextBest.year})</b>, one of your best years ahead.` : null,
        `When you face a specific decision, such as an offer, a contract or a trip, use the <b>Ask a question</b> tab to pick a good time and direction.`,
        `Ask the AI below for a personal plan: <button type="button" class="linkbtn" data-q="${esc(`Based on my charts, write me a practical, plain-language life plan for the next 3 years: what to focus on each year, what to avoid, which ages to watch out for, and simple daily habits to strengthen my useful element ${E.EL_EN[bz.useful]}.`)}">Make my 3-year plan</button>`
      ].filter(Boolean);
    }

    return `<section id="guide">
      <div class="sec-head"><div><div class="eyebrow">Your guide</div><h2>What this means for you, and what to do next <span class="zh">指南</span></h2></div>
      <span class="note">Plain-language summary of both charts. Details and the rules behind them are further down.</span></div>
      <div class="g-grid">
        <div class="panel g-panel">
          <h3>Who you are</h3>
          <p>Your Day Master is <b class="zh ${'el-' + bz.dmEl}">${bz.dm}</b> ${E.EL_EN[bz.dmEl]}: you are like ${DAY_MASTER[bz.dm]}.</p>
          <p>${strengthPlain}</p>
          <h3>What helps you most</h3>
          <p>Your <b>useful element</b> (用神) is the one your chart needs most to stay in balance. Bringing more of it into your life is believed to smooth things out. Yours is <b class="el-${bz.useful}">${E.EL_EN[bz.useful]} ${E.EL_ZH[bz.useful]}</b>${others.length ? `, helped by ${others.map(e => `${E.EL_EN[e]} ${E.EL_ZH[e]}`).join(' and ')}` : ''}.</p>
          <h4>Go easy on</h4>
          <ul class="g-list">${avoid}</ul>
        </div>
        <div class="panel g-panel">
          <h3>Right now: ${Y} <span class="zh">${r.yp}</span>, age ${age}</h3>
          ${r.lp ? `<p>You are in the <span class="zh">${r.lp.ganzhi}</span> luck pillar (${r.lp.startYear}–${r.lp.endYear}).</p>` : ''}
          ${yearHtml}
          ${nextSteps.length ? `<h3>Your next steps</h3><ol class="g-steps">${nextSteps.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}
        </div>
      </div>
      <div class="boost-grid">${boostCard(bz.useful, true)}${others.map(e => boostCard(e, false)).join('')}</div>
      <div class="panel g-panel"><h3>Ages to look out for</h3>${agesHtml}<p class="note" style="margin:0">Ages are Chinese nominal ages (虚岁), counted from 1 at birth and adding one each new year. Your everyday age is usually one less.</p></div>
    </section>`;
  }

  window.Guide = { tenGods, guide, BOOST };
})();
