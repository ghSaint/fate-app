/*
 * 命盘 engine: computes a BaZi (八字) chart with lunar-javascript and a Zi Wei Dou Shu (紫微斗数)
 * chart with iztro, then scores a chosen year for each life topic using rules from both systems.
 * Every rule that fires is recorded as evidence so the page can show how each answer was derived.
 * Requires globals: Solar (lunar-javascript) and iztro.
 */
(function (root) {
  'use strict';

  // ---------- BaZi reference data ----------
  const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
  const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
  const STEM_EL = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
  const EL_ZH = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
  const EL_EN = { wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' };
  const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'];
  const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
  const CTRL = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
  const ORGAN = { wood: 'liver, gallbladder, tendons and eyes', fire: 'heart, blood pressure and sleep', earth: 'stomach, spleen and digestion', metal: 'lungs, respiratory tract and skin', water: 'kidneys, bladder and hormonal balance' };
  const HIDDEN = { 子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'] };
  const HIDDEN_W = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
  const isYang = s => STEMS.indexOf(s) % 2 === 0;
  const branchEl = b => STEM_EL[HIDDEN[b][0]];

  const TEN_GOD_EN = {
    比肩: 'Friend', 劫财: 'Rob Wealth', 食神: 'Eating God', 伤官: 'Hurting Officer', 偏财: 'Indirect Wealth',
    正财: 'Direct Wealth', 七杀: 'Seven Killings', 正官: 'Direct Officer', 偏印: 'Indirect Resource', 正印: 'Direct Resource'
  };
  const GROUP = { 比肩: 'companion', 劫财: 'companion', 食神: 'output', 伤官: 'output', 偏财: 'wealth', 正财: 'wealth', 七杀: 'officer', 正官: 'officer', 偏印: 'resource', 正印: 'resource' };
  const GROUP_LABEL = {
    companion: 'Companion 比劫', output: 'Output 食伤', wealth: 'Wealth 财星', officer: 'Officer 官杀', resource: 'Resource 印星'
  };

  function tenGod(dm, s) {
    const a = STEM_EL[dm], b = STEM_EL[s], same = isYang(dm) === isYang(s);
    if (a === b) return same ? '比肩' : '劫财';
    if (GEN[a] === b) return same ? '食神' : '伤官';
    if (CTRL[a] === b) return same ? '偏财' : '正财';
    if (CTRL[b] === a) return same ? '七杀' : '正官';
    return same ? '偏印' : '正印';
  }
  function groupElement(dmEl, group) {
    switch (group) {
      case 'companion': return dmEl;
      case 'output': return GEN[dmEl];
      case 'wealth': return CTRL[dmEl];
      case 'officer': return ELEMENTS.find(e => CTRL[e] === dmEl);
      case 'resource': return ELEMENTS.find(e => GEN[e] === dmEl);
    }
  }

  const bi = b => BRANCHES.indexOf(b);
  const chong = (a, b) => Math.abs(bi(a) - bi(b)) === 6;
  const LIU_HE = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
  const liuHe = (a, b) => LIU_HE.some(p => p === a + b || p === b + a);
  const HAI = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
  const hai = (a, b) => HAI.some(p => p === a + b || p === b + a);
  const XING = ['寅巳', '巳申', '寅申', '丑戌', '戌未', '丑未', '子卯'];
  const xing = (a, b) => XING.some(p => p === a + b || p === b + a) || (a === b && '辰午酉亥'.includes(a));
  const stemHe = (a, b) => Math.abs(STEMS.indexOf(a) - STEMS.indexOf(b)) === 5;
  const stemClash = (a, b) => Math.abs(STEMS.indexOf(a) - STEMS.indexOf(b)) === 6;
  const FRAMES = { 申子辰: 'water', 亥卯未: 'wood', 寅午戌: 'fire', 巳酉丑: 'metal' };
  const frameOf = b => Object.keys(FRAMES).find(k => k.includes(b));
  const PEACH = { 申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子' };
  const HORSE = { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' };
  const NOBLE = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 辛: '寅午', 壬: '卯巳', 癸: '卯巳' };
  const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
  const STORAGE = { 辰: 'water', 戌: 'fire', 丑: 'metal', 未: 'wood' };

  function relationList(a, b) {
    const r = [];
    if (chong(a, b)) r.push('clash 冲');
    if (liuHe(a, b)) r.push('combine 合');
    if (xing(a, b)) r.push('punish 刑');
    if (hai(a, b)) r.push('harm 害');
    return r;
  }

  // ---------- Zi Wei reference data ----------
  const PALACE_EN = {
    命宫: 'Self', 兄弟: 'Siblings', 夫妻: 'Spouse', 子女: 'Children', 财帛: 'Wealth', 疾厄: 'Health',
    迁移: 'Travel', 仆役: 'Friends', 官禄: 'Career', 田宅: 'Property', 福德: 'Wellbeing', 父母: 'Parents'
  };
  const BRIGHT = { 庙: 1, 旺: 0.8, 得: 0.5, 利: 0.3, 平: 0, 不: -0.5, 陷: -0.8 };
  const BRIGHT_EN = { 庙: 'temple, strongest', 旺: 'prosperous', 得: 'favourable', 利: 'beneficial', 平: 'neutral', 不: 'weak', 陷: 'fallen, weakest' };
  const LUCKY = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马'];
  const MALEFIC = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
  const MUTAGEN = ['禄', '权', '科', '忌'];
  const MUTAGEN_EN = { 禄: 'Prosperity 化禄 (flow, gain)', 权: 'Power 化权 (control, drive)', 科: 'Fame 化科 (reputation, help)', 忌: 'Obstacle 化忌 (blockage, worry)' };
  const STAR_EN = {
    紫微: 'Emperor', 天机: 'Strategist', 太阳: 'Sun', 武曲: 'General (wealth)', 天同: 'Harmony', 廉贞: 'Integrity',
    天府: 'Treasury', 太阴: 'Moon', 贪狼: 'Desire', 巨门: 'Gate (words)', 天相: 'Minister', 天梁: 'Protector',
    七杀: 'Marshal', 破军: 'Pioneer', 左辅: 'Left Aide', 右弼: 'Right Aide', 文昌: 'Literary Talent', 文曲: 'Artistic Talent',
    天魁: 'Noble (day)', 天钺: 'Noble (night)', 禄存: 'Salary', 天马: 'Sky Horse', 擎羊: 'Sheep Blade', 陀罗: 'Spinning Top',
    火星: 'Fire Star', 铃星: 'Bell Star', 地空: 'Void', 地劫: 'Robbery', 红鸾: 'Red Phoenix (romance)', 天喜: 'Joy',
    天姚: 'Charm', 咸池: 'Peach Pool', 孤辰: 'Lonely', 寡宿: 'Widow'
  };
  const FLOW_STAR = {
    流禄: { pts: 1, text: 'yearly Salary star 流禄 brings income and resources' },
    流羊: { pts: -0.8, text: 'yearly Sheep Blade 流羊 brings conflict and sharp setbacks' },
    流陀: { pts: -0.6, text: 'yearly Spinning Top 流陀 brings delays and dragging problems' },
    流昌: { pts: 0.4, text: 'yearly Literary Talent 流昌 helps with documents and exams' },
    流曲: { pts: 0.4, text: 'yearly Artistic Talent 流曲 helps with communication and exams' },
    流魁: { pts: 0.6, text: 'yearly Noble 流魁 brings help from senior people' },
    流钺: { pts: 0.6, text: 'yearly Noble 流钺 brings help from senior people' },
    流鸾: { pts: 0.3, text: 'yearly Red Phoenix 流鸾 raises romance and celebration' },
    流喜: { pts: 0.3, text: 'yearly Joy 流喜 raises happy events' },
    流马: { pts: 0, text: 'yearly Sky Horse 流马 brings movement and travel' }
  };

  // ---------- Topics ----------
  const TOPICS = {
    overall: { label: 'Overall year', zh: '流年总论', palace: '命宫' },
    career: {
      label: 'Career', zh: '事业运', palace: '官禄',
      good: { 紫微: 0.5, 天府: 0.5, 太阳: 0.5, 武曲: 0.5, 天相: 0.3, 天魁: 0.6, 天钺: 0.6, 左辅: 0.5, 右弼: 0.5 },
      bad: { 地空: -0.5, 地劫: -0.5 }
    },
    wealth: {
      label: 'Wealth', zh: '财运', palace: '财帛',
      good: { 武曲: 0.6, 天府: 0.6, 太阴: 0.6, 禄存: 1, 天马: 0.3 },
      bad: { 地空: -1.2, 地劫: -1.2, 擎羊: -0.3 }
    },
    love: {
      label: 'Love & marriage', zh: '感情婚姻', palace: '夫妻',
      good: { 红鸾: 1, 天喜: 1, 天姚: 0.4, 咸池: 0.4, 左辅: 0.4, 右弼: 0.4, 太阴: 0.3, 天同: 0.3 },
      bad: { 擎羊: -0.6, 陀罗: -0.5, 火星: -0.5, 铃星: -0.5, 孤辰: -0.5, 寡宿: -0.5, 破军: -0.3 },
      flow: { 流鸾: 1.2, 流喜: 1.2 }
    },
    property: {
      label: 'Property & home', zh: '田宅运', palace: '田宅',
      good: { 天府: 0.8, 太阴: 0.8, 紫微: 0.5, 禄存: 0.8, 武曲: 0.4 },
      bad: { 地空: -1, 地劫: -1, 破军: -0.3 }
    },
    family: {
      label: 'Family & elders', zh: '家庭六亲', palace: '父母', secondary: ['兄弟'],
      good: { 天梁: 0.6, 天同: 0.4, 左辅: 0.4, 右弼: 0.4 },
      bad: { 擎羊: -0.5, 陀罗: -0.5, 火星: -0.4, 铃星: -0.4 }
    },
    children: {
      label: 'Children', zh: '子女运', palace: '子女',
      good: { 天喜: 0.5, 红鸾: 0.3, 左辅: 0.4, 右弼: 0.4, 天同: 0.4 },
      bad: { 擎羊: -0.5, 陀罗: -0.5 }
    },
    health: {
      label: 'Health', zh: '健康运', palace: '疾厄',
      good: { 天同: 0.5, 天梁: 0.6, 天魁: 0.3, 天钺: 0.3 },
      bad: { 擎羊: -0.8, 陀罗: -0.6, 火星: -0.6, 铃星: -0.6, 地空: -0.4, 地劫: -0.4 }
    },
    studies: {
      label: 'Studies & exams', zh: '学业运', palace: '官禄', secondary: ['父母'],
      good: { 文昌: 1, 文曲: 1, 天魁: 0.6, 天钺: 0.6, 天梁: 0.4, 天机: 0.4 },
      bad: { 地空: -0.3, 地劫: -0.3 },
      flow: { 流昌: 1, 流曲: 1 }
    },
    travel: {
      label: 'Travel & relocation', zh: '迁移出行', palace: '迁移',
      good: { 天马: 1, 左辅: 0.4, 右弼: 0.4, 天魁: 0.4, 天钺: 0.4 },
      bad: { 擎羊: -0.5, 陀罗: -0.5, 火星: -0.4, 铃星: -0.4 },
      flow: { 流马: 1 }
    },
    social: {
      label: 'Friends & helpers', zh: '人际贵人', palace: '仆役',
      good: { 左辅: 0.6, 右弼: 0.6, 天魁: 0.6, 天钺: 0.6 },
      bad: { 擎羊: -0.5, 陀罗: -0.5, 地空: -0.4, 地劫: -0.4 }
    }
  };

  const ADVICE = {
    overall: ['Use this year to push major plans; momentum is with you.', 'A year of mixed currents. Pick a few priorities and move steadily.', 'Keep plans conservative, protect what you have, and avoid big gambles.'],
    career: ['Good time to ask for promotion, change roles, or take on visible responsibility.', 'Progress comes through steady delivery. Avoid office politics and rash resignations.', 'Expect pressure or friction at work. Document decisions, keep a low profile, and avoid quitting impulsively.'],
    wealth: ['Income opportunities are strong. Invest in proven channels and negotiate pay or deals.', 'Money comes and goes. Budget carefully and diversify instead of chasing one big win.', 'Guard against losses, lending money, guarantees and speculative trades.'],
    love: ['Strong year for meeting someone, deepening commitment, or marriage.', 'Relationships need conscious effort. Talk things through and do not rush big decisions.', 'Expect tension or change in relationships. Practise patience and avoid escalating arguments.'],
    property: ['Favourable for buying, moving, renovating or signing property contracts.', 'Property matters move slowly. Do thorough checks before committing.', 'Hold off on major property moves. Read contracts closely and watch for hidden costs.'],
    family: ['Family harmony is good and elders are supportive. A good year for reunions.', 'Ordinary family ups and downs. Keep in regular contact with parents and siblings.', 'Pay attention to elders’ health and family disagreements. Be the calm voice at home.'],
    children: ['Good news around children: pregnancy, births or children’s achievements.', 'Children need steady attention. Stay involved without over-controlling.', 'Expect worries over children. Patience and communication matter more than discipline.'],
    health: ['Energy is good. A fine year to build new fitness habits.', 'Health is stable but watch stress and sleep. Keep regular check-ups.', 'Prioritise rest and check-ups, and take extra care with the organs noted below.'],
    studies: ['Excellent for exams, certifications and new learning.', 'Studies reward steady effort more than cramming.', 'Concentration is harder this year. Set a strict study plan and limit distractions.'],
    travel: ['Travel and relocation bring opportunity. Good year to go abroad or move.', 'Travel is ordinary. Plan carefully and keep buffers in your itinerary.', 'Take extra care when travelling and with relocation decisions. Double-check documents.'],
    social: ['Helpful people appear. Network actively and accept introductions.', 'Your social circle is neutral. Invest in a few trusted relationships.', 'Watch for rivals or unreliable people. Be careful with partnerships and money between friends.']
  };

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = v => Math.round(v * 100) / 100;
  const elTag = el => `${EL_EN[el]} ${EL_ZH[el]}`;

  function timeIndexFromHour(h) {
    if (h === 23) return 12; // late 子 hour
    return Math.floor((h + 1) / 2);
  }

  // ---------- BaZi chart ----------
  function computeBazi(inp) {
    const solar = root.Solar.fromYmdHms(inp.year, inp.month, inp.day, inp.hour, inp.minute, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    const dm = ec.getDayGan();
    const dmEl = STEM_EL[dm];

    const raw = [
      { key: 'year', label: 'Year', zh: '年柱', stem: ec.getYearGan(), branch: ec.getYearZhi(), nayin: ec.getYearNaYin(), stage: ec.getYearDiShi(), meaning: 'Ancestors, family background, early childhood' },
      { key: 'month', label: 'Month', zh: '月柱', stem: ec.getMonthGan(), branch: ec.getMonthZhi(), nayin: ec.getMonthNaYin(), stage: ec.getMonthDiShi(), meaning: 'Parents, siblings, career environment' },
      { key: 'day', label: 'Day', zh: '日柱', stem: dm, branch: ec.getDayZhi(), nayin: ec.getDayNaYin(), stage: ec.getDayDiShi(), meaning: 'You (stem) and your spouse (branch)' },
      { key: 'hour', label: 'Hour', zh: '时柱', stem: ec.getTimeGan(), branch: ec.getTimeZhi(), nayin: ec.getTimeNaYin(), stage: ec.getTimeDiShi(), meaning: 'Children, later life, ambitions' }
    ];
    const pillars = raw.map(p => ({
      ...p,
      stemEl: STEM_EL[p.stem],
      branchEl: branchEl(p.branch),
      stemGod: p.key === 'day' ? '日主' : tenGod(dm, p.stem),
      hidden: HIDDEN[p.branch].map((s, i) => ({ stem: s, el: STEM_EL[s], god: tenGod(dm, s), w: HIDDEN_W[HIDDEN[p.branch].length][i] }))
    }));

    // Element distribution (stems weight 1, branches split across hidden stems)
    const dist = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
    pillars.forEach(p => {
      dist[p.stemEl] += 1;
      p.hidden.forEach(h => { dist[h.el] += h.w; });
    });
    const distTotal = ELEMENTS.reduce((s, e) => s + dist[e], 0);

    // Day master strength: weighted support from same element (比劫) and resource (印)
    const resEl = groupElement(dmEl, 'resource');
    const supports = el => el === dmEl || el === resEl;
    const posW = { year: 1, month: 1, hour: 1 };
    const branchW = { year: 1, month: 2.5, day: 1.2, hour: 1 };
    let support = 0, total = 0;
    pillars.forEach(p => {
      if (p.key !== 'day') { total += posW[p.key]; if (supports(p.stemEl)) support += posW[p.key]; }
      p.hidden.forEach(h => { total += branchW[p.key] * h.w; if (supports(h.el)) support += branchW[p.key] * h.w; });
    });
    const ratio = support / total;
    const monthMain = pillars[1].hidden[0];
    const deLing = supports(monthMain.el);
    const roots = pillars.filter(p => p.hidden.some(h => h.el === dmEl)).map(p => `${p.label} branch ${p.branch}`);
    const helpingStems = pillars.filter(p => p.key !== 'day' && supports(p.stemEl)).map(p => `${p.stem} (${p.label})`);

    let strength, lean;
    if (ratio >= 0.5) { strength = 'strong'; lean = 'strong'; }
    else if (ratio <= 0.35) { strength = 'weak'; lean = 'weak'; }
    else { strength = 'balanced'; lean = ratio >= 0.42 ? 'strong' : 'weak'; }

    const favGroups = lean === 'strong' ? ['output', 'wealth', 'officer'] : ['resource', 'companion'];
    const unfavGroups = lean === 'strong' ? ['companion', 'resource'] : ['output', 'wealth', 'officer'];
    const favEls = favGroups.map(g => groupElement(dmEl, g));
    const unfavEls = unfavGroups.map(g => groupElement(dmEl, g));
    // Primary useful god: the favourable element the chart lacks most
    const useful = favEls.slice().sort((a, b) => dist[a] - dist[b])[0];

    const strengthNotes = [
      `Day Master 日主 is ${dm} (${isYang(dm) ? 'Yang' : 'Yin'} ${elTag(dmEl)}). Support comes from ${elTag(dmEl)} (companions) and ${elTag(resEl)} (resource, which generates ${EL_EN[dmEl]}).`,
      deLing
        ? `In season 得令: the month branch ${pillars[1].branch} holds ${monthMain.stem} (${elTag(monthMain.el)}), which supports the Day Master. The month branch carries the most weight (×2.5).`
        : `Out of season 失令: the month branch ${pillars[1].branch} holds ${monthMain.stem} (${elTag(monthMain.el)}), which does not support the Day Master. The month branch carries the most weight (×2.5).`,
      roots.length ? `Rooted 得地 in: ${roots.join(', ')}.` : 'No roots 不得地: no branch holds the Day Master’s own element.',
      helpingStems.length ? `Supporting stems 得势: ${helpingStems.join(', ')}.` : 'No supporting heavenly stems 不得势.',
      `Weighted support = ${Math.round(ratio * 100)}% (strong ≥ 50%, weak ≤ 35%). Verdict: ${strength === 'balanced' ? `balanced, leaning ${lean}` : strength}.`,
      lean === 'strong'
        ? `A strong Day Master benefits from being drained or controlled, so favourable elements 喜用神 are ${favEls.map(elTag).join(', ')} (output, wealth, officer). Unfavourable 忌神: ${unfavEls.map(elTag).join(', ')}.`
        : `A weak Day Master needs support, so favourable elements 喜用神 are ${favEls.map(elTag).join(', ')} (resource, companion). Unfavourable 忌神: ${unfavEls.map(elTag).join(', ')}.`,
      `Primary useful element 用神: ${elTag(useful)}, the favourable element the chart holds least of.`
    ];
    if (ratio < 0.15 || ratio > 0.85) {
      strengthNotes.push('The chart is extremely one-sided. Classical texts may read it as a special “follow” structure 从格, where the favourable elements reverse. Treat the readings below with extra caution.');
    }
    const summerFire = '巳午未'.includes(pillars[1].branch) && dist.fire / distTotal > 0.3;
    const winterCold = '亥子丑'.includes(pillars[1].branch) && (dist.water / distTotal > 0.3);
    if (summerFire) strengthNotes.push('Climate 调候: born in summer with heavy Fire. Water is valuable to cool the chart regardless of strength.');
    if (winterCold) strengthNotes.push('Climate 调候: born in winter with heavy Water. Fire is valuable to warm the chart regardless of strength.');

    // Luck pillars 大运
    const yun = ec.getYun(inp.gender === 'male' ? 1 : 0);
    const luck = yun.getDaYun(10).map(d => ({
      ganzhi: d.getGanZhi(), startYear: d.getStartYear(), endYear: d.getEndYear(), startAge: d.getStartAge(), endAge: d.getEndAge()
    }));
    const luckStart = { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(), date: yun.getStartSolar().toYmd() };

    return {
      solar: solar.toYmdHms(), lunar: lunar.toString(), zodiac: lunar.getYearShengXiaoByLiChun(),
      dm, dmEl, pillars, dist, distTotal, ratio, strength, lean, favEls, unfavEls, favGroups, useful, strengthNotes,
      luck, luckStart
    };
  }

  // ---------- Zi Wei chart ----------
  function computeZiwei(inp) {
    const ti = timeIndexFromHour(inp.hour);
    const ast = root.iztro.astro.bySolar(`${inp.year}-${inp.month}-${inp.day}`, ti, inp.gender === 'male' ? '男' : '女', true, 'zh-CN');
    return ast;
  }

  // ---------- Year analysis ----------
  function yearPillarOf(Y) {
    return root.Solar.fromYmd(Y, 7, 1).getLunar().getYearInGanZhiByLiChun();
  }

  // Cast both natal charts once; years are then read against them.
  function cast(inp) {
    return { inp, bz: computeBazi(inp), ast: computeZiwei(inp) };
  }

  function analyze(inp) {
    return readYear(cast(inp), inp.targetYear, inp.topics);
  }

  function readYear(chart, Y, topicList) {
    const { bz, ast } = chart;
    const inp = { ...chart.inp, targetYear: Y, topics: topicList || [] };
    const yp = yearPillarOf(Y);
    const ys = yp[0], yb = yp[1];
    const lp = bz.luck.find(l => l.startYear <= Y && Y <= l.endYear && l.ganzhi);
    const preLuck = !lp;
    const hz = ast.horoscope(`${Y}-7-1`);

    const dm = bz.dm;
    const P = Object.fromEntries(bz.pillars.map(p => [p.key, p]));
    const favOf = el => bz.favEls.includes(el) ? 1 : (bz.unfavEls.includes(el) ? -1 : 0);

    const factors = [
      { src: `Year stem 流年天干 ${ys}`, char: ys, el: STEM_EL[ys], w: 1, isYear: true },
      { src: `Year branch 流年地支 ${yb}`, char: yb, el: branchEl(yb), w: 1, isYear: true, branch: true }
    ];
    if (lp) {
      factors.push({ src: `Luck stem 大运天干 ${lp.ganzhi[0]}`, char: lp.ganzhi[0], el: STEM_EL[lp.ganzhi[0]], w: 0.5 });
      factors.push({ src: `Luck branch 大运地支 ${lp.ganzhi[1]}`, char: lp.ganzhi[1], el: branchEl(lp.ganzhi[1]), w: 0.5, branch: true });
    }
    factors.forEach(f => {
      const s = f.branch ? HIDDEN[f.char][0] : f.char;
      f.god = tenGod(dm, s);
      f.group = GROUP[f.god];
      f.fav = favOf(f.el);
    });
    const godTag = f => `${f.src} = ${f.god} ${TEN_GOD_EN[f.god]} (${elTag(f.el)}, ${f.fav > 0 ? 'favourable' : f.fav < 0 ? 'unfavourable' : 'neutral'})`;
    const byGroup = g => factors.filter(f => f.group === g);
    const groupFav = g => favOf(groupElement(bz.dmEl, g));
    const natalStemGods = bz.pillars.filter(p => p.key !== 'day').map(p => p.stemGod);
    const natalMainGods = bz.pillars.map(p => p.hidden[0].god);
    const natalHas = god => natalStemGods.includes(god) || natalMainGods.includes(god);
    const weak = bz.lean === 'weak';

    // Branch interactions between the year branch (and luck branch at half weight) and the natal branches
    const movers = [{ b: yb, w: 1, name: `year branch ${yb}` }];
    if (lp) movers.push({ b: lp.ganzhi[1], w: 0.5, name: `luck branch ${lp.ganzhi[1]}` });

    const ctx = { male: inp.gender === 'male', bz, ast, hz, Y, yp, ys, yb, lp, preLuck, factors, godTag, byGroup, groupFav, natalHas, weak, P, movers, favOf };

    const topics = (inp.topics || []).filter(t => TOPICS[t] && t !== 'overall');
    const results = ['overall', ...topics].map(t => {
      const bev = baziTopic(t, ctx);
      const zev = ziweiTopic(t, ctx);
      return combine(t, bev, zev);
    });

    return { input: inp, bz, ast, hz, Y, yp, lp, preLuck, factors, results, age: Y - inp.year + 1 };
  }

  // ---------- Luck timeline: every year of every 10-year pillar 大运 ----------
  const ALL_TOPICS = Object.keys(TOPICS).filter(t => t !== 'overall');

  function timeline(chart) {
    const { bz, inp } = chart;
    const pillars = bz.luck.filter(l => l.ganzhi);
    const decades = [];
    if (pillars.length && pillars[0].startYear > inp.year) {
      decades.push({ index: 0, ganzhi: '', pre: true, startYear: inp.year, endYear: pillars[0].startYear - 1, startAge: 1, endAge: pillars[0].startYear - inp.year });
    }
    pillars.forEach((l, i) => decades.push({ index: i + 1, ganzhi: l.ganzhi, pre: false, startYear: l.startYear, endYear: l.endYear, startAge: l.startAge, endAge: l.endAge }));

    decades.forEach(d => {
      d.years = [];
      for (let Y = d.startYear; Y <= d.endYear; Y++) {
        const r = readYear(chart, Y, ALL_TOPICS);
        const scores = {};
        r.results.forEach(t => {
          const all = [...t.bazi, ...t.zwds];
          const top = all.slice().sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)).slice(0, 3)
            .map(e => ({ sys: e.sys, pts: e.pts, title: e.title }));
          scores[t.topic] = { c: t.combined, level: t.level, verdict: t.verdict, nb: t.nb, nz: t.nz, top };
        });
        d.years.push({ year: Y, age: Y - inp.year + 1, yp: r.yp, scores });
      }
      d.avg = {}; d.best = {}; d.worst = {};
      ['overall', ...ALL_TOPICS].forEach(t => {
        const ys = d.years;
        d.avg[t] = round(ys.reduce((a, y) => a + y.scores[t].c, 0) / ys.length);
        d.best[t] = ys.reduce((a, y) => (y.scores[t].c > a.scores[t].c ? y : a)).year;
        d.worst[t] = ys.reduce((a, y) => (y.scores[t].c < a.scores[t].c ? y : a)).year;
      });
      d.theme = decadeTheme(chart, d);
    });
    return decades;
  }

  // What defines a decade: the luck pillar in BaZi and the decadal palace in Zi Wei.
  function decadeTheme(chart, d) {
    const { bz, ast } = chart;
    const notes = [];
    const favWord = el => bz.favEls.includes(el) ? 'favourable' : 'unfavourable';
    if (d.pre) {
      notes.push({ sys: 'bazi', text: `Childhood period 童限 before the first luck pillar starts. BaZi reads these years from the year pillars and the natal chart only.` });
    } else {
      const s = d.ganzhi[0], b = d.ganzhi[1];
      const gs = tenGod(bz.dm, s), gb = tenGod(bz.dm, HIDDEN[b][0]);
      notes.push({ sys: 'bazi', text: `Luck pillar ${d.ganzhi}: stem ${s} is ${gs} ${TEN_GOD_EN[gs]} (${elTag(STEM_EL[s])}, ${favWord(STEM_EL[s])}); branch ${b} is ${gb} ${TEN_GOD_EN[gb]} (${elTag(branchEl(b))}, ${favWord(branchEl(b))}). The stem colours roughly the first five years, the branch the last five.` });
      const themes = {
        companion: 'peers, competition and independence', output: 'creativity, expression and children', wealth: 'money, business and (for men) romance',
        officer: 'career, status, pressure and (for women) partnership', resource: 'learning, property, support and rest'
      };
      notes.push({ sys: 'bazi', text: `Decade focus: ${themes[GROUP[gs]]} (stem), ${themes[GROUP[gb]]} (branch).` });
      bz.pillars.forEach(p => {
        const rel = relationList(b, p.branch);
        if (rel.length) notes.push({ sys: 'bazi', text: `Luck branch ${b} vs natal ${p.label.toLowerCase()} branch ${p.branch}: ${rel.join(', ')}. The ${p.label.toLowerCase()} pillar governs ${p.meaning.toLowerCase()}.` });
      });
    }
    // Zi Wei decades 大限 start at different ages from BaZi luck pillars, so one luck pillar can overlap two.
    const spans = [];
    for (let Y = d.startYear; Y <= d.endYear; Y++) {
      const dec = ast.horoscope(`${Y}-7-1`).decadal;
      const key = dec.heavenlyStem + dec.earthlyBranch;
      const last = spans[spans.length - 1];
      if (last && last.key === key) last.to = Y; else spans.push({ key, dec, from: Y, to: Y });
    }
    if (spans.length > 1) notes.push({ sys: 'zwds', text: `Zi Wei decades run on their own schedule, so this luck pillar overlaps ${spans.length} Zi Wei decades: ${spans.map(s => `${s.key} (${s.from}–${s.to})`).join(', ')}.` });
    spans.forEach(({ dec, from, to }) => {
      const mp = ast.palaces[dec.palaceNames.indexOf('命宫')];
      const when = spans.length > 1 ? `${from}–${to}, ` : '';
      notes.push({ sys: 'zwds', text: `Zi Wei decade ${dec.heavenlyStem}${dec.earthlyBranch} (${when}ages ${mp.decadal.range.join('–')}): the decadal Self palace 大限命宫 sits on natal ${mp.name} ${PALACE_EN[mp.name]}, so ${PALACE_EN[mp.name].toLowerCase()} matters come to the fore. Main stars there: ${mp.majorStars.map(fmtStar).join(', ') || 'none (borrows from opposite)'}.` });
      dec.mutagen.forEach((star, k) => {
        const loc = findStar(ast, star);
        if (loc < 0) return;
        const role = dec.palaceNames[loc];
        notes.push({ sys: 'zwds', text: `${dec.heavenlyStem}${dec.earthlyBranch} decade ${MUTAGEN_EN[MUTAGEN[k]]}: ${star} sits in natal ${ast.palaces[loc].name}, which acts as the decade's ${role} ${PALACE_EN[role]} palace.` });
      });
    });
    return notes;
  }

  // ---------- BaZi topic rules ----------
  function baziTopic(t, c) {
    const ev = [];
    const add = (pts, title, detail) => ev.push({ sys: 'bazi', pts: round(pts), title, detail });
    const { bz, P, factors, byGroup, groupFav, natalHas, weak, movers, godTag, ys, yb, favOf } = c;
    const male = c.male;

    const climate = (scale) => factors.forEach(f => {
      if (!f.fav) return;
      add(f.fav * f.w * 0.8 * scale,
        f.fav > 0 ? `${f.src}: favourable element` : `${f.src}: unfavourable element`,
        `${godTag(f)}. ${f.fav > 0 ? `${EL_EN[f.el]} is one of your useful elements, so it strengthens the year.` : `${EL_EN[f.el]} is one of your unfavourable elements, so it adds friction.`}`);
    });
    const branchRel = (pillarKey, rules, what) => movers.forEach(m => {
      const nb = P[pillarKey].branch;
      if (chong(m.b, nb) && rules.chong) add(rules.chong * m.w, `${cap(m.name)} clashes ${pillarKey} branch ${nb} (${m.b}${nb}冲)`, `The ${pillarKey} branch represents ${what}. A clash 冲 shakes it up: ${rules.chongText}`);
      if (liuHe(m.b, nb) && rules.he) add(rules.he * m.w, `${cap(m.name)} combines ${pillarKey} branch ${nb} (${m.b}${nb}合)`, `The ${pillarKey} branch represents ${what}. A combination 六合 binds and harmonises it: ${rules.heText}`);
      if ((xing(m.b, nb) || hai(m.b, nb)) && !chong(m.b, nb) && rules.xing) add(rules.xing * m.w, `${cap(m.name)} punishes or harms ${pillarKey} branch ${nb} (${xing(m.b, nb) ? '刑' : '害'})`, `The ${pillarKey} branch represents ${what}. Punishment 刑 or harm 害 brings hidden friction: ${rules.xingText}`);
    });

    switch (t) {
      case 'overall': {
        climate(1);
        if (c.lp && c.lp.ganzhi === c.yp) add(-1, `Luck and year pillars are identical 岁运并临 (${c.yp})`, 'When the 10-year luck pillar and the year pillar are the same, their energy doubles. Classical texts treat this as an intense, eventful year that needs caution.');
        const d = P.day;
        if (stemClash(ys, d.stem) && chong(yb, d.branch)) add(-1.5, `Year pillar ${c.yp} fully clashes your day pillar ${d.stem}${d.branch} 天克地冲`, 'Both the stem and the branch of the year attack your own pillar. This signals major change, stress or upheaval in personal life.');
        else if (c.yp === d.stem + d.branch) add(-0.6, `Year pillar repeats your day pillar 伏吟 (${c.yp})`, 'A repeated pillar 伏吟 brings stagnation or repeated worries. Results come slowly.');
        if (c.preLuck) add(0, 'Before the first luck pillar 童限', 'The target year falls before the first 10-year luck pillar begins, so only the year pillar and the natal chart are used.');
        break;
      }
      case 'wealth': {
        byGroup('wealth').forEach(f => f.fav > 0
          ? add(2 * f.w, `Wealth star appears: ${f.god} ${TEN_GOD_EN[f.god]}`, `${godTag(f)}. Wealth is favourable for your chart, so this brings income, deals and money-making chances.`)
          : add(-0.5 * f.w, `Wealth star appears but is heavy for you 身弱财多`, `${godTag(f)}. Your Day Master is weak, so extra wealth energy brings opportunity mixed with strain: you may chase money you cannot hold.`));
        byGroup('output').forEach(f => groupFav('wealth') > 0
          ? add(1 * f.w, `Output generates wealth 食伤生财`, `${godTag(f)}. Output feeds the wealth element, so skills, products and ideas turn into money.`)
          : add(-0.4 * f.w, 'Output drains a weak Day Master', `${godTag(f)}. You work hard but returns lag effort.`));
        byGroup('companion').forEach(f => weak
          ? add(0.5 * f.w, 'Companions support you 比劫帮身', `${godTag(f)}. Peers and partners help a weak Day Master hold money.`)
          : add(-1.5 * f.w, 'Rob Wealth 比劫夺财', `${godTag(f)}. For a strong Day Master, companions compete for your wealth: spending, lending to friends, partnership splits.`));
        bz.pillars.forEach(p => {
          if (STORAGE[p.branch] === groupElement(bz.dmEl, 'wealth')) movers.forEach(m => {
            if (chong(m.b, p.branch)) add(groupFav('wealth') > 0 ? 1 * m.w : -0.6 * m.w, `Wealth vault opened 财库逢冲 (${m.b} clashes ${p.branch})`, `${p.branch} in your ${p.label.toLowerCase()} pillar stores your wealth element. The ${m.name} clashes it open: large sums move in or out. ${groupFav('wealth') > 0 ? 'Wealth is favourable, so this leans toward gains.' : 'Wealth is not favourable, so this leans toward big expenses.'}`);
          });
        });
        climate(0.4);
        break;
      }
      case 'career': {
        const resPresent = byGroup('resource').length > 0 || bz.dist[groupElement(bz.dmEl, 'resource')] >= 1.5;
        byGroup('officer').forEach(f => {
          if (f.fav > 0) add(2 * f.w, `Officer star appears: ${f.god} ${TEN_GOD_EN[f.god]}`, `${godTag(f)}. Officer represents rank, authority and employers. It is favourable, so expect recognition, promotion or new responsibility.`);
          else if (resPresent) add(1 * f.w, `Officer pressure converted by Resource 杀印相生`, `${godTag(f)}. Officer is heavy for you, but Resource in the chart turns pressure into authority and credentials.`);
          else add(-1.5 * f.w, `Officer pressure on a weak Day Master 官杀攻身`, `${godTag(f)}. Without Resource to buffer it, this means demanding bosses, heavy workload and stress.`);
        });
        byGroup('resource').forEach(f => f.fav > 0
          ? add(1 * f.w, `Resource star supports you: ${f.god}`, `${godTag(f)}. Resource is backing from superiors, credentials and good timing.`)
          : add(-0.5 * f.w, `Excess Resource: ${f.god}`, `${godTag(f)}. Too much Resource makes a strong Day Master complacent and slow to act.`));
        byGroup('output').forEach(f => {
          if (f.god === '伤官' && c.natalHas('正官')) add(-1.5 * f.w, 'Hurting Officer meets Direct Officer 伤官见官', `${godTag(f)}. Your chart holds 正官, and 伤官 attacks it: clashes with bosses, rule-breaking, reputation risk.`);
          else if (f.fav > 0) add(1 * f.w, `Output showcases your talent: ${f.god}`, `${godTag(f)}. Creativity and performance stand out at work.`);
          else add(-0.3 * f.w, `Output drains energy: ${f.god}`, `${godTag(f)}. You give a lot but recognition is limited.`);
        });
        byGroup('wealth').forEach(f => { if (f.fav > 0) add(0.5 * f.w, 'Wealth feeds Officer 财生官', `${godTag(f)}. Resources and budgets fuel career growth.`); });
        branchRel('month', { chong: -0.8, chongText: 'job change, reorganisation or a new working environment.', he: 0.8, heText: 'stable alliances and supportive colleagues.', xing: -0.5, xingText: 'office politics and hidden disputes.' }, 'your career environment and peers');
        break;
      }
      case 'love': {
        const spouseGroup = male ? 'wealth' : 'officer';
        const spouseText = male ? '正财 Direct Wealth = wife, 偏财 Indirect Wealth = girlfriend' : '正官 Direct Officer = husband, 七杀 Seven Killings = boyfriend or lover';
        byGroup(spouseGroup).forEach(f => f.fav > 0
          ? add(1.8 * f.w, `Spouse star appears: ${f.god}`, `${godTag(f)}. For a ${male ? 'man' : 'woman'}, ${spouseText}. A favourable spouse star brings romance, commitment or marriage.`)
          : add(0.6 * f.w, `Spouse star appears but is unfavourable: ${f.god}`, `${godTag(f)}. ${spouseText}. Relationship chances exist but come with stress or imbalance.`));
        if (male) byGroup('companion').forEach(f => add(-1 * f.w, 'Rivals compete for the spouse star 比劫争财', `${godTag(f)}. For a man, companions compete for the wealth (wife) star: rivals, jealousy, or friends interfering.`));
        else byGroup('output').forEach(f => { if (f.god === '伤官' && c.natalHas('正官')) add(-1.2 * f.w, 'Hurting Officer attacks the husband star 伤官见官', `${godTag(f)}. Sharp words and independence create friction with a partner.`); });
        branchRel('day', { chong: -1.5, chongText: 'arguments, separation risk, or for singles a sudden new encounter.', he: 2, heText: 'romance, commitment and marriage are strongly indicated.', xing: -0.8, xingText: 'misunderstanding and hurt feelings.' }, 'your spouse palace 夫妻宫');
        const peaches = new Set([PEACH[frameOf(P.day.branch)], PEACH[frameOf(P.year.branch)]]);
        if (peaches.has(yb)) add(1, `Peach Blossom year 桃花 (${yb})`, `${yb} is the Peach Blossom branch for your day or year branch. Attraction and social charm rise. If already committed, keep clear boundaries.`);
        if (stemHe(ys, bz.dm)) add(1, `Year stem combines your Day Master (${ys}${bz.dm}合)`, 'A stem combination with yourself signals attraction and being drawn into a partnership.');
        break;
      }
      case 'property': {
        byGroup('resource').forEach(f => f.fav > 0
          ? add(1.8 * f.w, `Resource star (house and deeds) appears: ${f.god}`, `${godTag(f)}. In BaZi, Resource 印 governs houses, title deeds and contracts. Favourable Resource supports buying or securing property.`)
          : add(0.3 * f.w, `Resource star appears but is heavy: ${f.god}`, `${godTag(f)}. Property matters arise but may bring burdens such as mortgages or paperwork.`));
        byGroup('wealth').forEach(f => {
          if (groupFav('resource') > 0 && weak) add(-1 * f.w, 'Wealth damages Resource 财坏印', `${godTag(f)}. Wealth controls Resource, your favourable element: overspending on property, contract or document trouble.`);
          else if (f.fav > 0) add(0.8 * f.w, 'Purchasing power from Wealth', `${godTag(f)}. Favourable wealth gives the funds to act on property plans.`);
        });
        bz.pillars.forEach(p => { if (STORAGE[p.branch] && chong(yb, p.branch)) add(0.4, `Earth vault ${p.branch} opened by ${yb}`, 'A storage branch clashed open often coincides with moving, renovation or buying and selling property.'); });
        branchRel('day', { chong: 0, chongText: 'often a house move or renovation (neutral).' }, 'your home and spouse');
        break;
      }
      case 'family': {
        branchRel('year', { chong: -1.2, chongText: 'family roots are disturbed: elders’ health, family disputes or moving away from home.', he: 0.8, heText: 'family gatherings and harmony.', xing: -0.6, xingText: 'friction among relatives.' }, 'your ancestors, grandparents and family roots');
        branchRel('month', { chong: -0.8, chongText: 'changes affecting parents or siblings.', he: 0.6, heText: 'support from parents and siblings.', xing: -0.5, xingText: 'tension with parents or siblings.' }, 'parents and siblings');
        byGroup('resource').forEach(f => { if (f.fav > 0) add(0.8 * f.w, 'Resource (mother, elders) is favourable', `${godTag(f)}. Resource 印 stands for mother and elders. Their support is strong this year.`); });
        byGroup('wealth').forEach(f => { if (groupFav('resource') > 0 && weak) add(-0.8 * f.w, 'Wealth damages Resource 财坏印', `${godTag(f)}. Resource is mother and elders; when Wealth attacks it, watch the health of older family members.`); });
        byGroup('companion').forEach(f => weak
          ? add(0.6 * f.w, 'Siblings help you', `${godTag(f)}. Companions are siblings; for a weak Day Master they are helpful.`)
          : add(-0.6 * f.w, 'Sibling rivalry', `${godTag(f)}. Companions are siblings; for a strong Day Master they compete for resources such as inheritance.`));
        climate(0.3);
        break;
      }
      case 'children': {
        const kid = male ? 'officer' : 'output';
        byGroup(kid).forEach(f => add((f.fav > 0 ? 1.2 : 0.4) * f.w, `Children star appears: ${f.god}`, `${godTag(f)}. For a ${male ? 'man, Officer 官杀' : 'woman, Output 食伤'} represents children. Expect child-related events (pregnancy, births, milestones)${f.fav > 0 ? ', mostly happy ones' : ', with some worry'}.`));
        if (!male) byGroup('resource').forEach(f => { if (f.god === '偏印' && c.natalHas('食神')) add(-1 * f.w, 'Indirect Resource seizes Eating God 枭神夺食', `${godTag(f)}. 偏印 attacks 食神 (a child star for women): concerns around pregnancy or children.`); });
        branchRel('hour', { chong: -1.2, chongText: 'worries or changes involving children.', he: 1, heText: 'closeness with children and good news.', xing: -0.5, xingText: 'misunderstandings with children.' }, 'children and later life');
        break;
      }
      case 'health': {
        climate(0.6);
        const resPresent = byGroup('resource').length > 0;
        if (weak) byGroup('officer').forEach(f => { if (!resPresent) add(-1.2 * f.w, `Officer attacks a weak Day Master 七杀攻身`, `${godTag(f)}. Stress-related illness, injuries or exhaustion. The ${EL_EN[bz.dmEl]} organs (${ORGAN[bz.dmEl]}) need care.`); });
        const d = P.day;
        if (chong(yb, d.branch)) add(-1.2, `Year branch clashes your day branch (${yb}${d.branch}冲)`, 'The day branch is your own seat and body. A clash raises the risk of accidents, surgery or sudden illness. Drive carefully and avoid risky sports.');
        const dom = ELEMENTS.slice().sort((a, b) => bz.dist[b] - bz.dist[a])[0];
        const low = ELEMENTS.slice().sort((a, b) => bz.dist[a] - bz.dist[b])[0];
        factors.filter(f => f.isYear).forEach(f => {
          if (f.el === dom && bz.dist[dom] / bz.distTotal > 0.3) add(-0.6, `Year adds to your excess ${EL_EN[dom]}`, `${godTag(f)}. ${EL_EN[dom]} is already your strongest element (${Math.round(bz.dist[dom] / bz.distTotal * 100)}%). Excess points to ${ORGAN[dom]}.`);
          if (CTRL[f.el] === low && bz.dist[low] / bz.distTotal < 0.12) add(-0.6, `Year controls your weakest element ${EL_EN[low]}`, `${godTag(f)}. ${EL_EN[low]} is scarce in your chart (${Math.round(bz.dist[low] / bz.distTotal * 100)}%) and ${EL_EN[f.el]} controls it. Watch ${ORGAN[low]}.`);
        });
        break;
      }
      case 'studies': {
        byGroup('resource').forEach(f => f.fav > 0
          ? add(1.8 * f.w, `Resource star (learning) appears: ${f.god}`, `${godTag(f)}. Resource 印 governs learning, certificates and teachers. Favourable here means good results.`)
          : add(0.5 * f.w, `Resource star appears but is heavy: ${f.god}`, `${godTag(f)}. Learning happens but feels slow or theoretical.`));
        if (WENCHANG[bz.dm] === yb) add(1.2, `Academic Star 文昌 arrives (${yb})`, `${yb} is the 文昌 Academic Star for a ${bz.dm} Day Master. Good for exams and writing.`);
        if (NOBLE[bz.dm].includes(yb)) add(0.6, `Noble Star 天乙贵人 (${yb})`, 'Mentors and teachers are more likely to help.');
        byGroup('output').forEach(f => { if (f.fav > 0) add(0.8 * f.w, `Output aids expression: ${f.god}`, `${godTag(f)}. Good for essays, presentations and creative work.`); });
        byGroup('wealth').forEach(f => { if (groupFav('resource') > 0) add(-1 * f.w, 'Wealth damages Resource 财坏印', `${godTag(f)}. Money matters and distractions pull you away from study.`); });
        break;
      }
      case 'travel': {
        const horses = new Set([HORSE[frameOf(P.day.branch)], HORSE[frameOf(P.year.branch)]]);
        if (horses.has(yb)) add(1.2, `Travelling Horse 驿马 arrives (${yb})`, `${yb} is the 驿马 Travelling Horse for your day or year branch. Travel, relocation or a job involving movement is likely.`);
        movers.forEach(m => ['day', 'month'].forEach(k => { if (chong(m.b, P[k].branch)) add(0.4 * m.w, `${cap(m.name)} clashes ${k} branch ${P[k].branch}`, 'A clash sets things in motion. Changes of place are more likely.'); }));
        climate(0.5);
        break;
      }
      case 'social': {
        byGroup('companion').forEach(f => weak
          ? add(1.2 * f.w, `Companions help you: ${f.god}`, `${godTag(f)}. Friends and peers support a weak Day Master.`)
          : add(-1.2 * f.w, `Companions compete with you: ${f.god}`, `${godTag(f)}. For a strong Day Master, peers become rivals. Be careful with partnerships.`));
        movers.forEach(m => { if (NOBLE[bz.dm].includes(m.b)) add(1.5 * m.w, `Noble Star 天乙贵人 on the ${m.name}`, `${m.b} is a 天乙贵人 Noble branch for a ${bz.dm} Day Master. Helpful people appear when needed.`); });
        byGroup('output').forEach(f => { if (f.fav > 0) add(0.6 * f.w, `Output gives charm: ${f.god}`, `${godTag(f)}. You communicate well and attract people.`); });
        byGroup('officer').forEach(f => { if (f.fav < 0) add(-0.5 * f.w, 'Unfavourable Officer: petty people 小人', `${godTag(f)}. People with power may cause trouble.`); });
        branchRel('month', { xing: -0.6, xingText: 'gossip and broken trust among peers.' }, 'your peers and social circle');
        break;
      }
    }
    if (!ev.length) add(0, 'No strong BaZi signals for this topic', `Neither the year pillar ${c.yp} nor the luck pillar strongly activates the stars or branches tied to this topic, so BaZi rates it neutral.`);
    return ev;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- Zi Wei topic rules ----------
  function ziweiTopic(t, c) {
    const cfg = TOPICS[t];
    const ev = [];
    ziweiPalace(cfg.palace, cfg, c, 1, ev);
    (cfg.secondary || []).forEach(p => ziweiPalace(p, cfg, c, 0.5, ev));
    return ev;
  }

  function starsIn(ast, i) {
    const p = ast.palaces[i];
    return { majors: p.majorStars, minors: p.minorStars, adj: p.adjectiveStars, all: [...p.majorStars, ...p.minorStars, ...p.adjectiveStars] };
  }
  function findStar(ast, name) {
    return ast.palaces.findIndex(p => [...p.majorStars, ...p.minorStars].some(s => s.name === name));
  }
  const opp = i => (i + 6) % 12;
  const fmtStar = s => `${s.name}${s.brightness ? `(${s.brightness})` : ''}${s.mutagen ? `[化${s.mutagen}]` : ''}`;
  const palaceTag = (ast, i) => `${ast.palaces[i].heavenlyStem}${ast.palaces[i].earthlyBranch} palace (natal ${ast.palaces[i].name} ${PALACE_EN[ast.palaces[i].name]})`;

  function palaceQuality(ast, i, cfg) {
    const s = starsIn(ast, i);
    let majors = s.majors, borrowed = false;
    if (!majors.length) { majors = starsIn(ast, opp(i)).majors; borrowed = true; }
    const bright = majors.length ? majors.reduce((a, st) => a + (BRIGHT[st.brightness] ?? 0), 0) / majors.length : 0;
    const lucky = s.minors.filter(x => LUCKY.includes(x.name));
    const malefic = s.minors.filter(x => MALEFIC.includes(x.name));
    let special = 0; const specials = [];
    s.all.forEach(st => {
      const g = cfg.good && cfg.good[st.name], b = cfg.bad && cfg.bad[st.name];
      if (g) { special += g; specials.push(`${st.name} +`); }
      if (b) { special += b; specials.push(`${st.name} −`); }
    });
    let mut = 0; const muts = [];
    [...s.majors, ...s.minors].forEach(st => {
      if (st.mutagen) { const v = { 禄: 0.8, 权: 0.5, 科: 0.4, 忌: -0.9 }[st.mutagen]; mut += v; muts.push(`${st.name}化${st.mutagen}`); }
    });
    const score = bright * (borrowed ? 0.7 : 1) + lucky.length * 0.3 - malefic.length * 0.4 + special * 0.6 + mut * 0.6;
    const desc = [
      majors.length ? `Main stars${borrowed ? ' (empty palace, borrowed from opposite 借星)' : ''}: ${majors.map(st => `${st.name} ${STAR_EN[st.name] || ''}${st.brightness ? ` (${st.brightness} ${BRIGHT_EN[st.brightness] || ''})` : ''}`).join(', ')}.` : 'No main stars.',
      lucky.length ? `Lucky stars: ${lucky.map(x => x.name).join(', ')}.` : '',
      malefic.length ? `Malefic stars: ${malefic.map(x => `${x.name} ${STAR_EN[x.name]}`).join(', ')}.` : '',
      muts.length ? `Natal transformations: ${muts.join(', ')}.` : '',
      specials.length ? `Topic-relevant stars: ${specials.join(', ')}.` : ''
    ].filter(Boolean).join(' ');
    return { score, desc };
  }

  function ziweiPalace(P, cfg, c, mult, ev) {
    const { ast, hz } = c;
    const en = `${P} ${PALACE_EN[P]}`;
    const add = (pts, title, detail) => ev.push({ sys: 'zwds', pts: round(pts * mult), title: mult < 1 ? `[secondary] ${title}` : title, detail });

    // 1. Natal baseline 本命
    const nIdx = ast.palaces.findIndex(p => p.name === P);
    const nq = palaceQuality(ast, nIdx, cfg);
    add(clamp(nq.score, -1.5, 1.5) * 0.5, `Natal ${en} palace: ${nq.score >= 0.5 ? 'strong foundation' : nq.score <= -0.3 ? 'weak foundation' : 'average foundation'}`, `Your birth chart places ${en} at ${palaceTag(ast, nIdx)}. ${nq.desc} This sets lifelong potential and counts for half weight.`);

    // 2. Decadal 大限
    const dec = hz.decadal;
    const dIdx = dec.palaceNames.indexOf(P);
    const dW = [1.2, 0.8, 0.6, -1.2];
    dec.mutagen.forEach((star, k) => {
      const loc = findStar(ast, star);
      if (loc === dIdx) add(dW[k], `10-year ${MUTAGEN_EN[MUTAGEN[k]].split(' (')[0]} lands in decadal ${P}`, `The decadal stem ${dec.heavenlyStem} transforms ${star} into ${MUTAGEN_EN[MUTAGEN[k]]}. ${star} sits in the decade’s ${en} palace (${palaceTag(ast, dIdx)}), colouring this topic for the whole 10 years.`);
      else if (k === 3 && loc === opp(dIdx)) add(-0.8, `10-year Obstacle 化忌 strikes decadal ${P} from opposite 忌冲`, `The decadal stem ${dec.heavenlyStem} turns ${star} into 化忌, sitting opposite the decade’s ${en} palace. Opposition carries obstruction across.`);
    });

    // 3. Yearly 流年
    const yr = hz.yearly;
    const yIdx = yr.palaceNames.indexOf(P);
    const yq = palaceQuality(ast, yIdx, cfg);
    add(clamp(yq.score, -1.5, 1.5) * 0.8, `${c.Y} yearly ${en} palace falls on ${ast.palaces[yIdx].earthlyBranch}`, `In ${c.Y} (${yr.heavenlyStem}${yr.earthlyBranch} year), the yearly ${en} palace moves to ${palaceTag(ast, yIdx)}. ${yq.desc}`);

    const yW = [2.2, 1.6, 1.2, -2.4];
    yr.mutagen.forEach((star, k) => {
      const loc = findStar(ast, star);
      const m = MUTAGEN[k];
      const label = MUTAGEN_EN[m];
      if (loc === yIdx) add(yW[k], `Year’s ${label.split(' (')[0]}: ${star} lands in yearly ${P}`, `The year stem ${yr.heavenlyStem} transforms ${star} into ${label}. It sits right in the yearly ${en} palace, which is the strongest yearly signal for this topic.`);
      else if (loc === opp(yIdx) && (m === '忌' || m === '禄')) add(m === '忌' ? -1.6 : 0.8, `Year’s ${label.split(' (')[0]} shines from opposite: ${star}`, `${star} 化${m} sits in the palace opposite yearly ${en} (${palaceTag(ast, loc)}). Opposite palaces project onto each other${m === '忌' ? ', so the obstacle 忌冲 strikes this topic' : ', bringing indirect gains'}.`);
      else if ((loc === (yIdx + 4) % 12 || loc === (yIdx + 8) % 12) && (m === '忌' || m === '禄')) add(m === '忌' ? -0.8 : 0.6, `Year’s ${label.split(' (')[0]} in a trine of yearly ${P}: ${star}`, `${star} 化${m} sits in a trine palace (三合) of yearly ${en}, giving a milder ${m === '忌' ? 'drag' : 'boost'}.`);
    });

    (yr.stars[yIdx] || []).forEach(s => {
      const f = FLOW_STAR[s.name]; if (!f) return;
      const pts = (cfg.flow && cfg.flow[s.name] !== undefined) ? cfg.flow[s.name] : f.pts;
      if (pts) add(pts, `Yearly star ${s.name} in yearly ${P}`, `The ${f.text}, and it falls inside the yearly ${en} palace.`);
    });
  }

  // ---------- Combination ----------
  function combine(t, bev, zev) {
    const sb = bev.reduce((a, e) => a + e.pts, 0);
    const sz = zev.reduce((a, e) => a + e.pts, 0);
    const nb = clamp(sb / 4, -1, 1), nz = clamp(sz / 4, -1, 1);
    const combined = 0.5 * nb + 0.5 * nz;
    const level = combined > 0.45 ? 5 : combined > 0.15 ? 4 : combined > -0.15 ? 3 : combined > -0.45 ? 2 : 1;
    const verdict = ['', 'Difficult', 'Challenging', 'Mixed', 'Good', 'Excellent'][level];
    const tone = s => s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral';
    let agreement;
    if (tone(nb) === tone(nz)) agreement = { kind: 'agree', text: `Both systems point the same way (${tone(nb)}), so confidence in this reading is higher.` };
    else if (tone(nb) === 'neutral' || tone(nz) === 'neutral') agreement = { kind: 'partial', text: `One system is ${tone(nb) === 'neutral' ? 'neutral' : tone(nb)} (BaZi) while the other is ${tone(nz)} (Zi Wei). The clearer signal dominates, with moderate confidence.` };
    else agreement = { kind: 'disagree', text: `BaZi reads ${tone(nb)} but Zi Wei reads ${tone(nz)}. Treat the year as genuinely mixed: the ${tone(nb) === 'positive' ? 'BaZi' : 'Zi Wei'} side shows where opportunity lies, the other side shows where to be careful.` };
    const all = [...bev, ...zev];
    const pos = all.filter(e => e.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 2);
    const neg = all.filter(e => e.pts < 0).sort((a, b) => a.pts - b.pts).slice(0, 2);
    const adv = ADVICE[t][level >= 4 ? 0 : level === 3 ? 1 : 2];
    return { topic: t, ...TOPICS[t], bazi: bev, zwds: zev, sb: round(sb), sz: round(sz), nb: round(nb), nz: round(nz), combined: round(combined), level, verdict, agreement, pos, neg, advice: adv };
  }

  root.FateEngine = {
    analyze, cast, readYear, timeline, ALL_TOPICS, computeBazi, TOPICS, PALACE_EN, STAR_EN, TEN_GOD_EN, GROUP_LABEL, EL_EN, EL_ZH, ELEMENTS, BRANCHES, yearPillarOf, timeIndexFromHour
  };
})(typeof window !== 'undefined' ? window : globalThis);
