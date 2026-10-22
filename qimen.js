/*
 * Qimen Dunjia 奇门遁甲 engine: hour-school, rotating-plate chart (时家转盘奇门) with the Chai Bu method (拆补法),
 * plus a rule-based reading of a question. Every rule that fires is recorded as evidence.
 * Requires the global Solar (lunar-javascript).
 */
(function (root) {
  'use strict';

  const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
  const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
  const GZ = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);
  const gzIndex = gz => GZ.indexOf(gz);
  const STEM_EL = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
  const isYang = s => STEMS.indexOf(s) % 2 === 0;
  const GEN = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
  const CTRL = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
  const EL_EN = { wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' };
  const EL_ZH = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

  // Luo Shu palaces 洛书九宫. Traditional boards put South at the top.
  const PALACE = {
    1: { gua: '坎', dir: 'N', dirZh: '北', el: 'water' },
    2: { gua: '坤', dir: 'SW', dirZh: '西南', el: 'earth' },
    3: { gua: '震', dir: 'E', dirZh: '东', el: 'wood' },
    4: { gua: '巽', dir: 'SE', dirZh: '东南', el: 'wood' },
    5: { gua: '中', dir: 'Centre', dirZh: '中', el: 'earth' },
    6: { gua: '乾', dir: 'NW', dirZh: '西北', el: 'metal' },
    7: { gua: '兑', dir: 'W', dirZh: '西', el: 'metal' },
    8: { gua: '艮', dir: 'NE', dirZh: '东北', el: 'earth' },
    9: { gua: '离', dir: 'S', dirZh: '南', el: 'fire' }
  };
  const RING = [1, 8, 3, 4, 9, 2, 7, 6]; // the eight outer palaces, clockwise on a South-up board
  const ri = p => RING.indexOf(p);
  const ringAt = i => RING[((i % 8) + 8) % 8];
  const step = (p, k) => ((((p - 1 + k) % 9) + 9) % 9) + 1; // move k places through Luo Shu numbers 1..9
  const QIYI = '戊己庚辛壬癸丁丙乙'.split(''); // Three Wonders and Six Instruments, in laying order
  const STAR_AT = { 1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英' };
  const DOOR_AT = { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' };
  const GODS = ['值符', '腾蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];
  const XUN_YI = { 甲子: '戊', 甲戌: '己', 甲申: '庚', 甲午: '辛', 甲辰: '壬', 甲寅: '癸' };
  const JU = {
    冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
    春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8], 立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
    夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
    秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1]
  };
  const YANG_TERMS = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种'];
  const TERM_ALIAS = { DONG_ZHI: '冬至', XIAO_HAN: '小寒', DA_HAN: '大寒', LI_CHUN: '立春', YU_SHUI: '雨水', JING_ZHE: '惊蛰', DA_XUE: '大雪' };
  const BRANCH_PALACE = { 子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4, 午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6 };
  const HORSE = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  const JIXING = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 }; // 六仪击刑
  const TOMB = { 乙: [2, 6], 丙: [6], 丁: [8] }; // 三奇入墓
  const DOOR_EL = { 休门: 'water', 生门: 'earth', 伤门: 'wood', 杜门: 'wood', 景门: 'fire', 死门: 'earth', 惊门: 'metal', 开门: 'metal' };

  // ---------- Glossary ----------
  const STAR_INFO = {
    天蓬: { en: 'Canopy', pts: -1.5, text: 'boldness, risk-taking and loss through theft or deceit (inauspicious)' },
    天芮: { en: 'Grain', pts: -1.5, text: 'illness, problems and learning through hardship (inauspicious)' },
    天冲: { en: 'Charge', pts: 0.5, text: 'quick, decisive action and drive (fairly auspicious)' },
    天辅: { en: 'Assistant', pts: 1.5, text: 'culture, education and help from mentors (auspicious)' },
    天禽: { en: 'Bird', pts: 1, text: 'balance and steady central authority (auspicious)' },
    天心: { en: 'Heart', pts: 1.5, text: 'planning, leadership and healing (auspicious)' },
    天柱: { en: 'Pillar', pts: -1, text: 'criticism, talk and damage (inauspicious)' },
    天任: { en: 'Burden', pts: 1, text: 'steadiness, patience and property (auspicious)' },
    天英: { en: 'Hero', pts: -0.5, text: 'visibility and fame but also impulsiveness (mixed)' }
  };
  const DOOR_INFO = {
    开门: { en: 'Open', pts: 2, text: 'openings, starting work, career and official matters (very auspicious)' },
    休门: { en: 'Rest', pts: 2, text: 'rest, recovery, good relations and help from others (very auspicious)' },
    生门: { en: 'Life', pts: 2, text: 'growth, profit, property and new life (very auspicious)' },
    景门: { en: 'View', pts: 0.5, text: 'documents, exams, publicity and appearances (mixed)' },
    杜门: { en: 'Block', pts: -0.5, text: 'blockage and hiding: good for keeping secrets, poor for progress' },
    伤门: { en: 'Harm', pts: -1.5, text: 'injury, conflict and competition (inauspicious)' },
    惊门: { en: 'Fear', pts: -1.5, text: 'shock, worry, disputes and lawsuits (inauspicious)' },
    死门: { en: 'Death', pts: -2, text: 'endings, stagnation and loss (very inauspicious)' }
  };
  const GOD_INFO = {
    值符: { en: 'Chief', pts: 1.5, text: 'authority, noble help and protection' },
    腾蛇: { en: 'Serpent', pts: -1, text: 'anxiety, deceit and strange twists' },
    太阴: { en: 'Moon', pts: 1, text: 'quiet help, discretion and hidden support' },
    六合: { en: 'Harmony', pts: 1, text: 'partnership, agreement, marriage and introductions' },
    白虎: { en: 'Tiger', pts: -1.5, text: 'force, injury, pressure and loss' },
    玄武: { en: 'Tortoise', pts: -1, text: 'theft, deception and hidden dealings' },
    九地: { en: 'Earth', pts: 0.5, text: 'stability, patience and keeping a low profile' },
    九天: { en: 'Heaven', pts: 0.5, text: 'boldness, expansion and acting in the open' }
  };
  const PAIRS = {
    戊丙: { name: '青龙返首 Green Dragon Returns', pts: 2.5, text: 'very auspicious for action, career moves and asking for help' },
    丙戊: { name: '飞鸟跌穴 Bird Falls into Nest', pts: 2.5, text: 'very auspicious: success arrives easily, act now' },
    乙辛: { name: '青龙逃走 Green Dragon Escapes', pts: -2.5, text: 'loss, betrayal, people or money slipping away' },
    辛乙: { name: '白虎猖狂 Rampant Tiger', pts: -2.5, text: 'conflict, injury and heavy loss' },
    丁癸: { name: '朱雀投江 Phoenix Plunges into River', pts: -2, text: 'documents, contracts or news go wrong' },
    癸丁: { name: '腾蛇夭矫 Writhing Serpent', pts: -2, text: 'worry, entanglement and deception' },
    庚丙: { name: '太白入荧 Metal Enters Fire', pts: -2, text: 'the opponent advances; guard against theft and attack' },
    丙庚: { name: '荧入太白 Fire Enters Metal', pts: -1, text: 'the opponent retreats, but conflict lingers' },
    庚戊: { name: '伏宫格 Hidden Palace', pts: -2, text: 'blocked: it is hard to move forward' },
    戊庚: { name: '飞宫格 Flying Palace', pts: -2, text: 'sudden changes of position and loss' },
    庚癸: { name: '大格 Great Obstruction', pts: -2, text: 'obstacles and delays on the way' },
    庚己: { name: '刑格 Punishment', pts: -2, text: 'legal trouble or injury' },
    庚壬: { name: '小格 Minor Obstruction', pts: -1.5, text: 'setbacks, especially in travel' },
    庚庚: { name: '战格 Battle', pts: -2, text: 'open confrontation' },
    癸癸: { name: '天网四张 Heaven’s Net', pts: -2, text: 'trapped: avoid acting' }
  };
  const MENPO = 'door 门迫: the door’s element controls the palace, which weakens a good door and worsens a bad one';

  // ---------- Question topics: which indicators 用神 to read ----------
  const QTOPICS = {
    general: { label: 'General question', zh: '综合', roles: [['hour', 1, 'the matter (hour stem 时干)'], ['zhiShi', 0.6, 'how events unfold (duty door 值使)']] },
    career: { label: 'Career or job', zh: '事业求职', roles: [['door:开门', 1, 'the job and work (Open door 开门)'], ['zhiFu', 0.6, 'bosses and authority (duty star 值符)']] },
    wealth: { label: 'Money or investment', zh: '求财投资', roles: [['door:生门', 1, 'profit (Life door 生门)'], ['stem:戊', 0.6, 'capital (stem 戊)']] },
    love: { label: 'Love or marriage', zh: '感情婚姻', roles: [['god:六合', 1, 'the union (Harmony spirit 六合)'], ['partner', 0.8, 'the partner']] },
    cooperation: { label: 'Deal or partnership', zh: '合作谈判', roles: [['god:六合', 1, 'the partnership (Harmony spirit 六合)'], ['door:生门', 0.8, 'mutual benefit (Life door 生门)']] },
    property: { label: 'Property or home', zh: '房产家宅', roles: [['door:生门', 1, 'the house or land (Life door 生门)'], ['god:九地', 0.6, 'foundations and land (Earth spirit 九地)']] },
    health: { label: 'Health', zh: '疾病健康', roles: [['star:天心', 1, 'the doctor and cure (Heart star 天心)'], ['stem:乙', 0.6, 'medicine (stem 乙)'], ['star:天芮', -0.6, 'the illness (Grain star 天芮); a strong illness palace counts against you']] },
    studies: { label: 'Exam or studies', zh: '考试学业', roles: [['door:景门', 1, 'the exam (View door 景门)'], ['stem:丁', 0.8, 'papers and scores (stem 丁)'], ['star:天辅', 0.6, 'learning (Assistant star 天辅)']] },
    travel: { label: 'Travel or relocation', zh: '出行迁移', roles: [['door:开门', 1, 'setting out (Open door 开门)'], ['horse', 0.6, 'movement (Travelling Horse 驿马)']] },
    legal: { label: 'Dispute or lawsuit', zh: '官司纠纷', roles: [['door:开门', 1, 'the judge or official (Open door 开门)'], ['door:惊门', 0.6, 'the dispute itself (Fear door 惊门)']] },
    lost: { label: 'Lost item or person', zh: '寻人寻物', roles: [['hour', 1, 'the lost item or person (hour stem 时干)'], ['door:杜门', 0.4, 'hiding places (Block door 杜门)']] }
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = v => Math.round(v * 100) / 100;
  const pTag = p => `palace ${p} ${PALACE[p].gua} (${PALACE[p].dir} ${PALACE[p].dirZh}, ${EL_EN[PALACE[p].el]} ${EL_ZH[PALACE[p].el]})`;

  // ---------- Casting ----------
  function cast(t) {
    const solar = root.Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute || 0, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    ec.setSect(1); // a 子 hour from 23:00 belongs to the next day
    const pillars = { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), hour: ec.getTime() };
    const jq = lunar.getPrevJieQi(false);
    const term = TERM_ALIAS[jq.getName()] || jq.getName();
    let yang = YANG_TERMS.includes(term);

    // Chai Bu 拆补: the yuan comes from the day's 符头 (the latest 甲 or 己 day).
    // Mao Shan 茅山: each yuan is five days counted from the moment the solar term began.
    const di = gzIndex(pillars.day);
    const fuTou = GZ[di - (di % 5)];
    const method = t.method === 'maoshan' ? 'maoshan' : 'chaibu';
    let yuanIdx;
    if (method === 'maoshan') {
      const js = s => new Date(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond());
      const days = (js(solar) - js(jq.getSolar())) / 864e5;
      yuanIdx = Math.min(2, Math.floor(days / 5));
    } else {
      yuanIdx = '子午卯酉'.includes(fuTou[1]) ? 0 : '寅申巳亥'.includes(fuTou[1]) ? 1 : 2;
    }
    let ju = JU[term][yuanIdx];
    if (t.ju) { ju = t.ju; yang = !!t.yang; } // explicit 局, for other schools of 定局

    // Earth plate 地盘
    const earth = {};
    QIYI.forEach((s, i) => { earth[step(ju, yang ? i : -i)] = s; });
    const earthPalace = s => Number(Object.keys(earth).find(p => earth[p] === s));

    // Hour xun, duty star 值符 and duty door 值使
    const hi = gzIndex(pillars.hour);
    const xunStart = hi - (hi % 10);
    const xun = GZ[xunStart];
    const xunYi = XUN_YI[xun];
    const P = earthPalace(xunYi);
    const Pe = P === 5 ? 2 : P;
    const zhiFuStar = P === 5 ? '天禽' : STAR_AT[P];
    const zhiShiDoor = P === 5 ? '死门' : DOOR_AT[P];

    // Heaven plate: the duty star travels to the palace of the hour stem; the ring turns as one
    const hourStem = pillars.hour[0];
    const hs = hourStem === '甲' ? xunYi : hourStem;
    const T = earthPalace(hs);
    const Te = T === 5 ? 2 : T;
    const off = ri(Te) - ri(Pe);

    // Doors: the duty door counts one palace per hour from the xun's palace
    const steps = hi - xunStart;
    const D = step(P, yang ? steps : -steps);
    const De = D === 5 ? 2 : D;
    const doorOff = ri(De) - ri(Pe);

    const palaces = {};
    for (let p = 1; p <= 9; p++) palaces[p] = { num: p, ...PALACE[p], earth: earth[p], heaven: [], stars: [], door: null, god: null, marks: [] };
    RING.forEach(X => {
      const home = ringAt(ri(X) - off);
      palaces[X].stars.push(STAR_AT[home]);
      palaces[X].heaven.push(earth[home]);
      if (home === 2) { palaces[X].stars.push('天禽'); palaces[X].heaven.push(earth[5]); } // 天禽 rides with 天芮
      palaces[X].door = DOOR_AT[ringAt(ri(X) - doorOff)];
    });
    GODS.forEach((g, k) => { palaces[ringAt(ri(Te) + (yang ? k : -k))].god = g; });

    // Markers
    const kong = [BRANCHES[(xunStart % 12 + 10) % 12], BRANCHES[(xunStart % 12 + 11) % 12]];
    const kongPalaces = [...new Set(kong.map(b => BRANCH_PALACE[b]))];
    const horse = HORSE[pillars.hour[1]];
    const horsePalace = BRANCH_PALACE[horse];
    RING.forEach(X => {
      const pal = palaces[X];
      if (kongPalaces.includes(X)) pal.marks.push('kong');
      if (horsePalace === X) pal.marks.push('horse');
      if (pal.heaven.some(s => JIXING[s] === X)) pal.marks.push('jixing');
      if (pal.heaven.some(s => TOMB[s] && TOMB[s].includes(X))) pal.marks.push('tomb');
      if (CTRL[DOOR_EL[pal.door]] === pal.el) pal.marks.push('menpo');
    });

    const dayStem = pillars.day[0], dayXunYi = XUN_YI[GZ[di - (di % 10)]];
    const wuBuYu = CTRL[STEM_EL[hourStem]] === STEM_EL[dayStem] && isYang(hourStem) === isYang(dayStem);

    return {
      time: { ...t }, solar: solar.toYmdHms().slice(0, 16), pillars, term, termAt: jq.getSolar().toYmdHms().slice(0, 16), yang, yuan: ['上元', '中元', '下元'][yuanIdx], fuTou, ju, method,
      xun, xunYi, zhiFuStar, zhiShiDoor, zhiFuPalace: Te, zhiShiPalace: De, starFuyin: off === 0, starFanyin: Math.abs(off) === 4,
      doorFuyin: doorOff === 0, doorFanyin: Math.abs(doorOff) === 4, kong, kongPalaces, horse, horsePalace, palaces, dayXunYi, wuBuYu
    };
  }

  // Where a stem sits on the heaven plate (甲 hides under its xun's instrument)
  function stemPalace(b, s, xunYi) {
    const target = s === '甲' ? xunYi : s;
    return RING.find(X => b.palaces[X].heaven.includes(target));
  }
  function findRole(b, role, ctx) {
    const [kind, name] = role.split(':');
    switch (kind) {
      case 'hour': return stemPalace(b, b.pillars.hour[0], b.xunYi);
      case 'day': return stemPalace(b, b.pillars.day[0], b.dayXunYi);
      case 'zhiFu': return b.zhiFuPalace;
      case 'zhiShi': return b.zhiShiPalace;
      case 'horse': return b.horsePalace;
      case 'door': return RING.find(X => b.palaces[X].door === name);
      case 'god': return RING.find(X => b.palaces[X].god === name);
      case 'star': return RING.find(X => b.palaces[X].stars.includes(name));
      case 'stem': return stemPalace(b, name, b.xunYi);
      case 'partner': return stemPalace(b, ctx.gender === 'female' ? '庚' : '乙', b.xunYi);
      case 'yearStem': return ctx.birthYearStem ? stemPalace(b, ctx.birthYearStem, b.xunYi) : null;
    }
    return null;
  }

  // ---------- Judging one palace ----------
  function judgePalace(b, X) {
    const pal = b.palaces[X], items = [];
    const add = (pts, title, detail) => items.push({ pts, title, detail });
    const d = DOOR_INFO[pal.door], g = GOD_INFO[pal.god];
    add(d.pts, `Door ${pal.door} ${d.en}`, `${pal.door} governs ${d.text}.`);
    pal.stars.forEach((s, i) => {
      const si = STAR_INFO[s];
      add(si.pts * (i ? 0.5 : 1), `Star ${s} ${si.en}${i ? ' (riding along)' : ''}`, `${s} stands for ${si.text}.`);
    });
    add(g.pts, `Spirit ${pal.god} ${g.en}`, `${pal.god} brings ${g.text}.`);
    pal.heaven.forEach(h => {
      const pr = PAIRS[h + pal.earth];
      if (pr) add(pr.pts, `Pattern ${pr.name} (${h} over ${pal.earth})`, `Heaven stem ${h} over earth stem ${pal.earth}: ${pr.text}.`);
    });
    const hasStem = s => pal.heaven.includes(s);
    if (hasStem('丙') && pal.earth === '丁' && pal.door === '生门') add(3, '天遁 Heaven Escape', '丙 over 丁 with the Life door: one of the three great escape patterns, excellent for any plan.');
    if (hasStem('乙') && pal.earth === '己' && pal.door === '开门') add(3, '地遁 Earth Escape', '乙 over 己 with the Open door: excellent for building, property and long-term plans.');
    if (hasStem('丁') && pal.god === '太阴' && pal.door === '休门') add(3, '人遁 Human Escape', '丁 with the Moon spirit and Rest door: excellent for negotiations, requests and meeting people.');
    if (['开门', '休门', '生门'].includes(pal.door) && pal.heaven.some(s => '乙丙丁'.includes(s))) {
      if (pal.god === '太阴') add(2, '真诈 True Ruse', 'A good door, a Wonder stem and the Moon spirit together: hidden help, good for discreet moves.');
      if (pal.god === '九地') add(2, '重诈 Double Ruse', 'A good door, a Wonder stem and the Earth spirit together: steady, quiet success.');
      if (pal.god === '六合') add(2, '休诈 Rest Ruse', 'A good door, a Wonder stem and the Harmony spirit together: agreements go smoothly.');
    }
    if (pal.marks.includes('kong')) add(-1.5, 'Empty 空亡', `This palace holds the hour’s empty branches (${b.kong.join('')}). Things here lack substance or are delayed until that branch arrives.`);
    if (pal.marks.includes('menpo')) add(d.pts > 0 ? -1 : -0.5, 'Door oppression 门迫', `${pal.door} (${EL_EN[DOOR_EL[pal.door]]}) controls this ${EL_EN[pal.el]} palace: ${MENPO}.`);
    if (pal.marks.includes('jixing')) add(-1.5, 'Instrument punished 击刑', 'An instrument stem sits in the palace that punishes it: friction, injury or legal trouble.');
    if (pal.marks.includes('tomb')) add(-1.5, 'Wonder in the tomb 入墓', 'A Wonder stem has entered its tomb palace: its help is buried and slow to appear.');
    return { pts: items.reduce((a, e) => a + e.pts, 0), items };
  }

  // ---------- Reading a question ----------
  function read(b, topic, ctx) {
    ctx = ctx || {};
    const cfg = QTOPICS[topic] || QTOPICS.general;
    const ev = [];
    const roles = [];
    const selfP = findRole(b, 'day', ctx);
    roles.push({ key: 'self', label: 'You (day stem 日干)', palace: selfP });
    if (ctx.birthYearStem) roles.push({ key: 'year', label: `Your birth-year stem 年命 (${ctx.birthYearStem})`, palace: findRole(b, 'yearStem', ctx) });

    cfg.roles.forEach(([role, w, desc], i) => {
      const X = findRole(b, role, ctx);
      if (!X) return;
      roles.push({ key: 'yong' + i, label: desc, palace: X, primary: i === 0 });
      const j = judgePalace(b, X);
      const pal = b.palaces[X];
      const sign = w < 0 ? -1 : 1;
      const weight = Math.abs(w);
      ev.push({
        pts: round(j.pts * w * 0.5),
        title: `${cap(desc)} sits in ${pTag(X)}`,
        detail: `${pal.god} · ${pal.stars.join('/')} · ${pal.door} · heaven ${pal.heaven.join('')} over earth ${pal.earth}. ${j.items.map(e => `${e.title} (${e.pts > 0 ? '+' : ''}${e.pts})`).join('; ')}. Palace total ${round(j.pts)} × weight ${sign < 0 ? '−' : ''}${weight} × 0.5.`,
        palace: X
      });
    });

    // You versus the matter: five-element relation between the palaces
    const mainP = roles.find(r => r.primary);
    if (selfP && mainP) {
      const se = b.palaces[selfP].el, me = b.palaces[mainP.palace].el;
      let pts, text;
      if (selfP === mainP.palace) { pts = 1; text = 'You and the matter share a palace: you are close to it and can grasp it directly.'; }
      else if (GEN[me] === se) { pts = 1.5; text = `The matter’s palace (${EL_EN[me]}) generates yours (${EL_EN[se]}): the matter comes to you and supports you.`; }
      else if (me === se) { pts = 0.5; text = `Both palaces are ${EL_EN[se]}: you and the matter are on equal terms.`; }
      else if (GEN[se] === me) { pts = -0.5; text = `Your palace (${EL_EN[se]}) generates the matter’s (${EL_EN[me]}): you put in effort and resources to get it.`; }
      else if (CTRL[se] === me) { pts = 0.8; text = `Your palace (${EL_EN[se]}) controls the matter’s (${EL_EN[me]}): you can manage it, though it takes work.`; }
      else { pts = -1.5; text = `The matter’s palace (${EL_EN[me]}) controls yours (${EL_EN[se]}): the matter puts you under pressure.`; }
      ev.push({ pts, title: `You (${pTag(selfP)}) and the matter (${pTag(mainP.palace)})`, detail: text });
    }
    if (b.wuBuYu) ev.push({ pts: -1.5, title: 'Five-Not-Meet hour 五不遇时', detail: `The hour stem ${b.pillars.hour[0]} controls the day stem ${b.pillars.day[0]} with the same polarity. Classical texts advise against starting important matters in this hour.` });
    if (b.starFuyin) ev.push({ pts: -0.5, title: 'Stars in their home palaces 星伏吟', detail: 'The board has not turned: things are stuck. Wait rather than force progress.' });
    if (b.starFanyin) ev.push({ pts: -0.5, title: 'Stars opposite their homes 星反吟', detail: 'The board is turned upside down: expect reversals and rapid back-and-forth.' });

    const total = ev.reduce((a, e) => a + e.pts, 0);
    const score = round(clamp(total / 6, -1, 1));
    const level = score > 0.45 ? 5 : score > 0.15 ? 4 : score > -0.15 ? 3 : score > -0.45 ? 2 : 1;
    const verdict = ['', 'Unfavourable', 'Difficult', 'Uncertain', 'Favourable', 'Very favourable'][level];
    return { topic, cfg, roles, ev, total: round(total), score, level, verdict };
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // How each outer palace's direction looks right now, regardless of the question
  function directions(b) {
    return RING.map(X => {
      const j = judgePalace(b, X);
      return { palace: X, dir: PALACE[X].dir, dirZh: PALACE[X].dirZh, gua: PALACE[X].gua, score: round(clamp(j.pts / 5, -1, 1)), items: j.items };
    });
  }

  // Score the same question for the next twelve two-hour periods
  function timing(t, topic, ctx) {
    const start = new Date(t.year, t.month - 1, t.day, t.hour, t.minute || 0);
    start.setMinutes(0);
    if (start.getHours() % 2 === 0) start.setHours(start.getHours() - 1); // align to the 时辰 that starts on an odd hour
    const out = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getTime() + i * 2 * 3600 * 1000 + 30 * 60 * 1000);
      const tt = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() };
      const b = cast(tt);
      const r = read(b, topic, ctx);
      const from = new Date(d.getTime() - 30 * 60 * 1000);
      out.push({ t: tt, from, branch: b.pillars.hour[1], hourGz: b.pillars.hour, day: b.pillars.day, score: r.score, level: r.level, verdict: r.verdict, ju: `${b.yang ? '阳' : '阴'}${b.ju}` });
    }
    return out;
  }

  root.Qimen = { cast, read, directions, timing, judgePalace, QTOPICS, PALACE, RING, STAR_INFO, DOOR_INFO, GOD_INFO, PAIRS, EL_EN, EL_ZH, STEMS };
})(typeof window !== 'undefined' ? window : globalThis);
