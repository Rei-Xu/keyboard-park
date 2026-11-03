/* 鍵盤樂園 — 鍵位指法練習遊戲（靈感：Typing Land）
 * 純前端。學生用「班級＋座號」登入，星星存到老師的 Google 試算表（cloud.js），訪客只存這台電腦。
 * 判斷按鍵用 e.code（實體按鍵位置），所以中/英輸入法狀態都不影響。
 */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rand = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniq = a => Array.from(new Set(a));

  // ---------- 鍵盤配置 [code, 英文, 注音, 寬度] ----------
  const BS = String.fromCharCode(92);
  const ROWS = [
    [['Backquote', '`', ''], ['Digit1', '1', 'ㄅ'], ['Digit2', '2', 'ㄉ'], ['Digit3', '3', 'ˇ'], ['Digit4', '4', 'ˋ'],
     ['Digit5', '5', 'ㄓ'], ['Digit6', '6', 'ˊ'], ['Digit7', '7', '˙'], ['Digit8', '8', 'ㄚ'], ['Digit9', '9', 'ㄞ'],
     ['Digit0', '0', 'ㄢ'], ['Minus', '-', 'ㄦ'], ['Equal', '=', ''], ['Backspace', '⟵', '', 2]],
    [['Tab', 'Tab', '', 1.5], ['KeyQ', 'Q', 'ㄆ'], ['KeyW', 'W', 'ㄊ'], ['KeyE', 'E', 'ㄍ'], ['KeyR', 'R', 'ㄐ'],
     ['KeyT', 'T', 'ㄔ'], ['KeyY', 'Y', 'ㄗ'], ['KeyU', 'U', 'ㄧ'], ['KeyI', 'I', 'ㄛ'], ['KeyO', 'O', 'ㄟ'],
     ['KeyP', 'P', 'ㄣ'], ['BracketLeft', '[', ''], ['BracketRight', ']', ''], ['Backslash', BS, '', 1.5]],
    [['CapsLock', 'Caps', '', 1.75], ['KeyA', 'A', 'ㄇ'], ['KeyS', 'S', 'ㄋ'], ['KeyD', 'D', 'ㄎ'], ['KeyF', 'F', 'ㄑ'],
     ['KeyG', 'G', 'ㄕ'], ['KeyH', 'H', 'ㄘ'], ['KeyJ', 'J', 'ㄨ'], ['KeyK', 'K', 'ㄜ'], ['KeyL', 'L', 'ㄠ'],
     ['Semicolon', ';', 'ㄤ'], ['Quote', "'", ''], ['Enter', 'Enter', '', 2.25]],
    [['ShiftLeft', 'Shift', '', 2.25], ['KeyZ', 'Z', 'ㄈ'], ['KeyX', 'X', 'ㄌ'], ['KeyC', 'C', 'ㄏ'], ['KeyV', 'V', 'ㄒ'],
     ['KeyB', 'B', 'ㄖ'], ['KeyN', 'N', 'ㄙ'], ['KeyM', 'M', 'ㄩ'], ['Comma', ',', 'ㄝ'], ['Period', '.', 'ㄡ'],
     ['Slash', '/', 'ㄥ'], ['ShiftRight', 'Shift', '', 2.75]],
  ];
  const FN_KEYS = new Set(['Backspace', 'Tab', 'CapsLock', 'Enter', 'ShiftLeft', 'ShiftRight']);
  const INFO = {};
  ROWS.forEach(r => r.forEach(([c, en, zy]) => { INFO[c] = { en, zy }; }));
  INFO.Space = { en: '␣', zy: '空白' };
  const ZYKEY = {};   // 注音符號／聲調 → code
  Object.keys(INFO).forEach(c => { const z = INFO[c].zy; if (z && c !== 'Space') ZYKEY[z] = c; });
  const TONES = 'ˊˇˋ˙';

  // ---------- 手指分工 ----------
  const FINGER = {};
  const setF = (f, codes) => codes.split(' ').forEach(c => { FINGER[c] = f; });
  setF('Lp', 'Backquote Digit1 Tab KeyQ CapsLock KeyA ShiftLeft KeyZ');
  setF('Lr', 'Digit2 KeyW KeyS KeyX');
  setF('Lm', 'Digit3 KeyE KeyD KeyC');
  setF('Li', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB');
  setF('Ri', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM');
  setF('Rm', 'Digit8 KeyI KeyK Comma');
  setF('Rr', 'Digit9 KeyO KeyL Period');
  setF('Rp', 'Digit0 Minus Equal Backspace KeyP BracketLeft BracketRight Backslash Semicolon Quote Enter Slash ShiftRight');
  setF('Th', 'Space');
  const FINGER_NAME = { Lp: '左手小指', Lr: '左手無名指', Lm: '左手中指', Li: '左手食指', Ri: '右手食指', Rm: '右手中指', Rr: '右手無名指', Rp: '右手小指', Th: '大拇指' };

  // ---------- 存檔 ----------
  // v2（2026-11-02）：換新存檔名，讓舊版留下的星星與「全部解鎖」一次歸零
  const SAVE_KEY = 'kbpark-v2';
  let save = { mode: 'en', diff: 'easy', colors: true, sound: true, unlockAll: false, stars: { en: {}, zy: {} } };
  try {
    localStorage.removeItem('kbpark-v1');
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') { save = Object.assign(save, s); save.stars = Object.assign({ en: {}, zy: {} }, s.stars); }
  } catch (e) { /* 沒有存檔或無法存取，就用預設值 */ }
  save.unlockAll = false;   // 全部解鎖只在這次開著的網頁有效，重新整理或重開就鎖回去

  // 2026-11-03：星星改成「每位學生一份」。登入（班級＋座號）時從雲端載回，玩完一局上傳（cloud.js）。
  // 訪客（老師試玩）沿用 save.stars，只存這台電腦。
  const PLAYERS_KEY = 'kbpark-players';
  let player = null;          // { cls, seat } 或 { guest: true }
  let book = save.stars;      // 目前這位玩家的星星 { en:{}, zy:{} }
  const pKey = p => `${p.cls}#${p.seat}`;
  function loadPlayers() { try { return JSON.parse(localStorage.getItem(PLAYERS_KEY)) || {}; } catch (e) { return {}; } }
  function mergeStars(a, b) {
    const out = { en: Object.assign({}, a && a.en), zy: Object.assign({}, a && a.zy) };
    ['en', 'zy'].forEach(m => Object.entries((b && b[m]) || {}).forEach(([k, n]) => {
      n = Math.max(0, Math.min(3, Math.round(Number(n) || 0)));
      if (n > (out[m][k] || 0)) out[m][k] = n;
    }));
    return out;
  }

  function persist() {
    const { unlockAll, ...keep } = save;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(keep)); } catch (e) { /* 無痕模式等情況存不了，不影響遊戲 */ }
    if (player && !player.guest) {
      const all = loadPlayers();
      all[pKey(player)] = book;
      try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(all)); } catch (e) { /* 同上 */ }
    }
  }

  const label = c => (save.mode === 'zy' ? (INFO[c].zy || INFO[c].en) : INFO[c].en);
  const keyName = c => {
    if (c === 'Space') return '空白鍵';
    return save.mode === 'zy' && INFO[c].zy ? `${INFO[c].zy}（${INFO[c].en}）` : INFO[c].en;
  };

  // ---------- 難度 ----------
  const DIFF = {
    easy:   { name: '輕鬆', note: '輕鬆：地鼠、荷葉、蘋果都會一直等你，字母雲落地後會停住，鍵盤上會亮出下一個鍵。', cubeN: 16, moleN: 12, moleTime: 0,    mouthN: 12, fall: 0.07, maxClouds: 1, gap: 900,  wordN: 6,  wordTime: null, hint: true },
    normal: { name: '普通', note: '普通：地鼠會逃走、荷葉會下沉、蘋果會掉下來，要在時間內打完，鍵盤上會亮出下一個鍵。', cubeN: 24, moleN: 18, moleTime: 3200, mouthN: 18, fall: 0.10, maxClouds: 2, gap: 1500, wordN: 10, wordTime: { base: 3000, per: 900 }, hint: true },
    hard:   { name: '挑戰', note: '挑戰：速度更快、題目更多，而且鍵盤「不會」提示下一個鍵，要靠手指記憶！',             cubeN: 32, moleN: 24, moleTime: 1800, mouthN: 24, fall: 0.16, maxClouds: 3, gap: 1000, wordN: 14, wordTime: { base: 2000, per: 550 }, hint: false },
  };

  // ---------- 關卡 ----------
  const C = s => (s || '').split(' ').filter(Boolean).map(x => {
    if (/^[A-Z]$/.test(x)) return 'Key' + x;
    if (/^\d$/.test(x)) return 'Digit' + x;
    return { ';': 'Semicolon', ',': 'Comma', '.': 'Period', '/': 'Slash', '-': 'Minus' }[x];
  });
  const HOME = C('A S D F J K L ;');
  const LETTERS = 'Q W E R T Y U I O P A S D F G H J K L ; Z X C V B N M , . /';
  const WORLDS = [
    { name: '基準列', sub: '手指的家', color: '#22aef0', base: '', stages: ['F J', 'D K', 'S L', 'A ;', 'G H'] },
    { name: '上排', sub: '手指往上爬', color: '#ff8a2b', base: 'A S D F G H J K L ;', stages: ['R U', 'E I', 'W O', 'Q P', 'T Y'] },
    { name: '下排', sub: '手指往下走', color: '#2fbf63', base: 'A S D F G H J K L ;', stages: ['V M', 'C ,', 'X .', 'Z /', 'B N'] },
    { name: '數字列', sub: '把手指伸長', color: '#9b6cf0', base: 'F J', stages: ['4 7', '3 8', '2 9', '1 0', '5 6 -'] },
    { name: '大冒險', sub: '全部一起來', color: '#ff4f86', stages: [
      { title: '左手全部', keys: 'Q W E R T A S D F G Z X C V B', zyExtra: '1 2 3 4 5' },
      { title: '右手全部', keys: 'Y U I O P H J K L ; N M , . /', zyExtra: '6 7 8 9 0 -' },
      { title: '全部的鍵', keys: LETTERS, zyExtra: '1 2 3 4 5 6 7 8 9 0 -' },
      { title: '', keys: LETTERS, zyExtra: '1 2 3 4 5 6 7 8 9 0 -', words: true },
    ] },
    { name: '單字樂園', sub: '打出完整的字', color: '#0fa39a', games: ['frog', 'giraffe', 'cube'], stages: [
      { words: true, pool: 's', title: { en: '短單字（3 個字母）', zy: '一個字' } },
      { words: true, pool: 'm', title: { en: '中單字（4 個字母）', zy: '兩個字的詞' } },
      { words: true, pool: 'l', title: { en: '長單字（5 個字母以上）', zy: '三個字的詞' } },
    ] },
  ];
  const gamesOf = wi => WORLDS[wi].games || GAME_ORDER;

  function getStage(wi, si) {
    const w = WORLDS[wi], s = w.stages[si], id = `${wi + 1}-${si + 1}`;
    if (typeof s === 'string') {
      const keys = C(s);
      const review = uniq(C(w.base + ' ' + w.stages.slice(0, si).join(' '))).filter(c => !keys.includes(c));
      return { id, keys, review, title: keys.map(label).join('・') };
    }
    let keys = C(s.keys || LETTERS);
    if (save.mode === 'zy') keys = keys.concat(C(s.zyExtra || '1 2 3 4 5 6 7 8 9 0 -'));
    let title = s.title;
    if (title && typeof title === 'object') title = title[save.mode];
    if (!title && s.words) title = save.mode === 'zy' ? '注音詞語' : '英文單字';
    return { id, keys, review: [], title, words: !!s.words, pool: s.pool || '' };
  }

  // ---------- 詞庫（words.js 複製自 zhuyin-trainer，注音已核對過） ----------
  const BANK = window.WORD_BANK || {};
  const zyOk = w => Array.isArray(w.zhuyin) && w.zhuyin.length && w.zhuyin.every(syl => [...syl].every(ch => ZYKEY[ch]));
  function wordPool(stage) {
    if (save.mode === 'en') {
      const all = (BANK.english || []).filter(w => /^[a-z]+$/.test(w.text));
      const f = stage.pool === 's' ? all.filter(w => w.text.length <= 3)
        : stage.pool === 'm' ? all.filter(w => w.text.length === 4)
        : stage.pool === 'l' ? all.filter(w => w.text.length >= 5) : all;
      return f.length ? f : all;
    }
    const z = stage.pool === 's' ? BANK.chars : stage.pool === 'l' ? BANK.words3 : BANK.words;
    return (z || []).filter(zyOk);
  }
  // 一個詞 → 要按的鍵；注音每個字最後按聲調鍵（一聲按空白鍵）
  function wordItem(w) {
    if (save.mode === 'en') {
      const tiles = [...w.text].map(ch => ({ code: 'Key' + ch.toUpperCase(), label: ch }));
      return { text: w.text, sub: w.zh || '', tiles, groups: [tiles], show: `${w.text}　${w.zh || ''}` };
    }
    const groups = w.zhuyin.map(syl => {
      const g = [];
      let tone = null;
      for (const ch of syl) {
        if (TONES.includes(ch)) tone = ch;
        else g.push({ code: ZYKEY[ch], label: ch });
      }
      g.push(tone ? { code: ZYKEY[tone], label: tone } : { code: 'Space', label: '空白', small: true });
      return g;
    });
    return { text: w.text, sub: '', tiles: [].concat(...groups), groups, show: `${w.text}　${w.zhuyin.join(' ')}` };
  }
  const poolKey = stage => save.mode === 'en' ? 'en:' + (stage.pool || 'all')
    : 'zy:' + (stage.pool === 's' ? 'chars' : stage.pool === 'l' ? 'words3' : 'words');

  // ---------- 洗牌袋：整個題庫都輪過一遍才會重複 ----------
  // 每個題庫一個打亂的袋子，抽完才重洗；同一關的青蛙、長頸鹿、方塊共用袋子。存在 localStorage，被清掉就重新一輪。
  const BAG_KEY = 'kbpark-bags';
  let bags = {};
  try { bags = JSON.parse(localStorage.getItem(BAG_KEY)) || {}; } catch (e) { /* 存不了就只放記憶體 */ }
  function drawFrom(key, pool, n) {
    const byText = new Map(pool.map(w => [w.text, w]));
    let bag = (bags[key] || []).filter(t => byText.has(t));
    const last = (bags[key + '#last'] || []).filter(t => byText.has(t)), out = [];
    while (out.length < n && byText.size) {
      if (!bag.length) {
        // 新的一袋：剛抽過的字放到袋底（最後才抽到），接縫處不會馬上又遇到
        const avoid = new Set(last.slice(-Math.floor(byText.size / 3))), fresh = shuffle([...byText.keys()]);
        bag = fresh.filter(t => avoid.has(t)).concat(fresh.filter(t => !avoid.has(t)));
      }
      const t = bag.pop();
      out.push(byText.get(t)); last.push(t);
    }
    bags[key] = bag; bags[key + '#last'] = last.slice(-30);
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bags)); } catch (e) { /* 同上 */ }
    return out;
  }
  const pickWords = (stage, n) => drawFrom(poolKey(stage), wordPool(stage), n).map(wordItem);

  // 已學會的鍵剛好能拼出的英文真單字（給方塊遊戲偶爾穿插）
  function keyWords(stage) {
    if (save.mode !== 'en') return [];
    const ok = new Set(stage.keys.concat(stage.review));
    return (BANK.english || []).filter(w => /^[a-z]{2,6}$/.test(w.text) && [...w.text].every(ch => ok.has('Key' + ch.toUpperCase())));
  }

  // 單鍵題目：新鍵約 65%、複習鍵約 35%，不讓同一個鍵連續出現 3 次。
  // 為了每次都不一樣，會隨機穿插小節奏（例如 f j f、d d k）；withWords 時再偶爾插入能用已學鍵拼出的真單字。
  const PATTERNS = ['ab', 'aab', 'abb', 'aba', 'abab', 'abba'];
  function genKeys(stage, n, withWords) {
    const out = [], words = withWords ? keyWords(stage) : [];
    const pick = () => { const p = (!stage.review.length || Math.random() < 0.65) ? stage.keys : stage.review; return p[rand(p.length)]; };
    const push = c => {
      if (out.length >= 2 && out[out.length - 1].code === c && out[out.length - 2].code === c) return;
      out.push({ code: c, label: label(c) });
    };
    while (out.length < n) {
      const r = Math.random();
      const w = words.length >= 5 && r < 0.18 ? drawFrom('kw:' + stage.id, words, 1)[0] : null;
      if (w && w.text.length <= n - out.length) {
        // 真單字整個放進去，不套「不連續 3 次」的規則，免得字被拆壞
        const show = `${w.text}　${w.zh || ''}`;
        [...w.text].forEach(ch => out.push({ code: 'Key' + ch.toUpperCase(), label: ch, word: show }));
      } else if (r < 0.4) {
        const a = pick(); let b = pick();
        for (let i = 0; i < 4 && b === a; i++) b = pick();
        [...PATTERNS[rand(PATTERNS.length)]].forEach(x => push(x === 'a' ? a : b));
      } else push(pick());
    }
    return out.slice(0, n);
  }

  // 單字／詞語題目：英文字之間要按空白鍵；注音每個字最後按聲調鍵（一聲按空白鍵）
  function genWordTiles(stage, n) {
    const tiles = [];
    for (let guard = 0; tiles.length < n && guard < 200; guard++) {
      const w = pickWords(stage, 1)[0];
      if (!w) break;
      if (save.mode === 'en' && tiles.length) tiles.push({ code: 'Space', label: '␣', small: true, word: w.show });
      w.tiles.forEach(t => tiles.push(Object.assign({ word: w.show }, t)));
    }
    return tiles;
  }

  // ---------- 音效 ----------
  let actx = null;
  function sfx(type, combo) {
    if (!save.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const tone = (f, d, wave, vol, at) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = wave; o.frequency.setValueAtTime(f, t + at);
        g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.001, t + at + d);
        o.connect(g); g.connect(actx.destination); o.start(t + at); o.stop(t + at + d + 0.02);
      };
      if (type === 'hit') tone(523 * Math.pow(2, Math.min(combo || 0, 12) / 24), 0.12, 'triangle', 0.18, 0);
      else if (type === 'wrong') tone(150, 0.18, 'square', 0.07, 0);
      else if (type === 'miss') tone(240, 0.3, 'sawtooth', 0.05, 0);
      else if (type === 'win') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.16, i * 0.12));
    } catch (e) { /* 沒有音效也能玩 */ }
  }

  // ---------- 螢幕鍵盤與雙手 ----------
  const KEYEL = {};
  function buildKeyboard() {
    const kb = $('#kb');
    kb.innerHTML = '';
    kb.classList.toggle('colors', !!save.colors);
    kb.classList.toggle('zy', save.mode === 'zy');
    ROWS.forEach(r => {
      const row = h('div', 'kb-row');
      r.forEach(([c, en, zy, w]) => {
        const fn = FN_KEYS.has(c);
        const k = h('div', 'key' + (fn ? ' fn' : '') + (c === 'KeyF' || c === 'KeyJ' ? ' bump' : ''));
        k.style.flexGrow = w || 1;
        if (FINGER[c]) k.dataset.f = FINGER[c];
        if (fn) k.textContent = en;
        else if (save.mode === 'zy' && zy) k.innerHTML = `<b>${esc(zy)}</b><small>${esc(en)}</small>`;
        else k.innerHTML = `<b>${esc(en)}</b>`;
        row.appendChild(k); KEYEL[c] = k;
      });
      kb.appendChild(row);
    });
    const row = h('div', 'kb-row');
    const sp = h('div', 'key space'); sp.dataset.f = 'Th'; sp.innerHTML = save.mode === 'zy' ? '<small>空白鍵（一聲）</small>' : '';
    row.appendChild(h('div', 'gap4')); row.appendChild(sp); row.appendChild(h('div', 'gap4'));
    kb.appendChild(row); KEYEL.Space = sp;
  }

  function buildHands() {
    // 左手食指對準 F、小指對準 A；右手用鏡像再往左移，讓食指對準 J、小指對準 ;
    const fingers = [['p', 140, 80], ['r', 204, 48], ['m', 268, 34], ['i', 332, 52]];
    const hand = side => {
      let s = '<rect class="palm" x="136" y="150" width="256" height="90" rx="40"/>';
      fingers.forEach(([f, x, y]) => {
        s += `<g class="finger" id="f-${side}${f}"><rect x="${x}" y="${y}" width="56" height="200" rx="28"/><circle class="dot" cx="${x + 28}" cy="${y + 28}" r="13"/></g>`;
      });
      s += `<g class="finger" id="f-${side}t"><g transform="rotate(40 400 240)"><rect x="376" y="100" width="52" height="150" rx="26"/><circle class="dot" cx="402" cy="126" r="13"/></g></g>`;
      return s;
    };
    $('#hands').innerHTML = `<g>${hand('L')}</g><g transform="translate(910,0) scale(-1,1)">${hand('R')}</g>`;
  }

  let curTarget = null;
  function setTarget(code) {
    if (code && run && run.running && !DIFF[save.diff].hint) code = null;
    if (code === curTarget) return;
    if (curTarget && KEYEL[curTarget]) KEYEL[curTarget].classList.remove('target');
    $$('#hands .finger.on').forEach(e => e.classList.remove('on'));
    curTarget = code;
    if (!code) { $('#fingerHint').innerHTML = '&nbsp;'; return; }
    if (KEYEL[code]) KEYEL[code].classList.add('target');
    const f = FINGER[code];
    (f === 'Th' ? ['f-Lt', 'f-Rt'] : ['f-' + f]).forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('on'); });
    $('#fingerHint').innerHTML = `用 <b>${FINGER_NAME[f]}</b> 按 <b>${esc(keyName(code))}</b>`;
  }

  function flash(code, cls) {
    const k = KEYEL[code];
    if (!k) return;
    k.classList.remove('hit', 'miss'); void k.offsetWidth; k.classList.add(cls);
    setTimeout(() => k.classList.remove(cls), 220);
  }

  function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function sparkle(parent, n) {
    for (let i = 0; i < (n || 5); i++) {
      const s = h('span', 'spark', '✦');
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 40;
      s.style.setProperty('--dx', Math.cos(a) * d + 'px');
      s.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
      parent.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
  }

  // ---------- 小遊戲 1：滾滾方塊 ----------
  function CubeGame(run, play) {
    const d = DIFF[save.diff];
    const tiles = run.stage.words ? genWordTiles(run.stage, d.cubeN) : genKeys(run.stage, d.cubeN, true);
    play.innerHTML = '<div class="cube-word"></div><div class="cube-stage"><div class="track"></div>' +
      '<div class="hero"><i class="eye l"></i><i class="eye r"></i><i class="smile"></i></div></div>';
    const stageEl = $('.cube-stage', play), track = $('.track', play), hero = $('.hero', play), wordEl = $('.cube-word', play);
    const els = tiles.map(t => { const e = h('div', 'tile' + (t.small ? ' small' : ''), esc(t.label)); track.appendChild(e); return e; });
    const goal = h('div', 'tile goal', '<div class="friend"><i class="eye l"></i><i class="eye r"></i><i class="smile"></i></div>');
    track.appendChild(goal);
    let i = 0;

    function place(anim) {
      const tw = els[0].offsetWidth, step = tw + 8, x0 = Math.round(stageEl.clientWidth * 0.3);
      track.style.transition = anim ? 'transform .22s ease-out' : 'none';
      track.style.transform = `translateX(${x0 - i * step}px)`;
      hero.style.left = (x0 + (tw - hero.offsetWidth) / 2) + 'px';
      els.forEach((e, k) => e.classList.toggle('cur', k === i));
      wordEl.textContent = tiles[i] && tiles[i].word ? tiles[i].word : '';
    }
    requestAnimationFrame(() => place(false));

    return {
      relayout: () => place(false),
      begin() { place(false); run.progress(0, tiles.length); },
      target: () => (tiles[i] ? tiles[i].code : null),
      key(code) {
        if (i >= tiles.length) return null;
        if (code !== tiles[i].code) { retrigger(els[i], 'shake'); retrigger(hero, 'oops'); return false; }
        els[i].classList.add('pop');
        i++;
        retrigger(hero, 'roll');
        place(true);
        run.progress(i, tiles.length);
        if (i >= tiles.length) {
          goal.classList.add('party'); hero.classList.add('happy');
          sparkle(goal, 8);
          run.later(run.finish, 900);
        }
        return true;
      },
    };
  }

  // ---------- 小遊戲 2：打地鼠 ----------
  function MoleGame(run, play) {
    const d = DIFF[save.diff], N = d.moleN, seq = genKeys(run.stage, N), HOLES = 7;
    play.innerHTML = '<div class="mole-field"></div>';
    const field = $('.mole-field', play);
    const holes = [];
    for (let k = 0; k < HOLES; k++) {
      const el = h('div', 'hole', '<div class="pit"><div class="mole"><i class="ear l"></i><i class="ear r"></i><i class="eye l"></i><i class="eye r"></i><i class="nose"></i><div class="sign"></div></div></div>');
      field.appendChild(el); holes.push(el);
    }
    let n = 0, cur = null, curHole = -1, timer = 0;

    function spawn() {
      if (n >= N) { cur = null; run.later(run.finish, 400); return; }
      let hi;
      do { hi = rand(HOLES); } while (hi === curHole);
      curHole = hi; cur = seq[n++];
      const hole = holes[hi];
      $('.sign', hole).textContent = cur.label;
      hole.className = 'hole up';
      run.updateHint();
      if (d.moleTime) timer = run.later(escape, d.moleTime);
    }
    function escape() {
      if (!cur) return;
      run.miss(cur.code);
      const hole = holes[curHole];
      hole.className = 'hole up laugh';
      cur = null; run.updateHint(); run.progress(n, N);
      run.later(() => { hole.className = 'hole'; }, 500);
      run.later(spawn, 850);
    }
    return {
      begin() { run.progress(0, N); run.later(spawn, 300); },
      target: () => (cur ? cur.code : null),
      key(code) {
        if (!cur) return null;
        const hole = holes[curHole];
        if (code !== cur.code) { retrigger(hole, 'tease'); return false; }
        clearTimeout(timer);
        hole.className = 'hole up bonk';
        sparkle(hole, 6);
        cur = null; run.progress(n, N);
        run.later(() => { hole.className = 'hole'; }, 280);
        run.later(spawn, 450);
        return true;
      },
    };
  }

  // ---------- 小遊戲 3：大嘴怪 ----------
  const MOUTH_SVG = '<svg viewBox="0 0 160 110"><circle cx="52" cy="22" r="17" fill="#fff" stroke="#222" stroke-width="5"/><circle cx="108" cy="22" r="17" fill="#fff" stroke="#222" stroke-width="5"/>' +
    '<circle class="pupil" cx="56" cy="25" r="6" fill="#222"/><circle class="pupil" cx="104" cy="25" r="6" fill="#222"/>' +
    '<g class="jaw"><rect x="6" y="44" width="148" height="60" rx="30" fill="#c58af2" stroke="#222" stroke-width="5"/>' +
    '<rect x="26" y="58" width="108" height="32" rx="16" fill="#fff" stroke="#222" stroke-width="4"/>' +
    '<path d="M32 66 L44 80 L56 66 L68 80 L80 66 L92 80 L104 66 L116 80 L128 66" fill="none" stroke="#222" stroke-width="3.5" stroke-linejoin="round"/></g></svg>';

  function MouthGame(run, play) {
    const d = DIFF[save.diff], N = d.mouthN, seq = genKeys(run.stage, N), FLOOR = 0.56;
    play.innerHTML = `<div class="sky"></div><div class="ground"></div><div class="mouth">${MOUTH_SVG}</div>`;
    const sky = $('.sky', play), mouth = $('.mouth', play);
    let clouds = [], spawned = 0, handled = 0, last = -1e9, prev = 0, ending = false, lowest = null;

    function spawn(now) {
      const c = seq[spawned++];
      let x = 0;
      for (let t = 0; t < 12; t++) {
        x = 10 + Math.random() * 80;
        if (clouds.every(o => Math.abs(o.x - x) > 16 || o.y > 0.3)) break;
      }
      const el = h('div', 'cloud', `<span>${esc(c.label)}</span>`);
      el.style.left = x + '%'; el.style.top = '-15%';
      sky.appendChild(el);
      clouds.push({ code: c.code, el, x, y: -0.15 });
      last = now;
    }
    function remove(c) { clouds = clouds.filter(o => o !== c); handled++; run.progress(handled, N); }
    function frame(now) {
      if (!run.running) return;
      const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0;
      prev = now;
      if (spawned < N && clouds.length < d.maxClouds && now - last > d.gap) spawn(now);
      clouds.slice().forEach(c => {
        c.y += d.fall * dt;
        if (c.y >= FLOOR) {
          if (save.diff === 'easy') { c.y = FLOOR; c.el.classList.add('landed'); }
          else { run.miss(c.code); c.el.classList.add('rain'); setTimeout(() => c.el.remove(), 500); remove(c); return; }
        }
        c.el.style.top = (c.y * 100) + '%';
      });
      const low = clouds.reduce((a, c) => (!a || c.y > a.y ? c : a), null);
      if (low !== lowest) { lowest = low; $$('.cloud.low', sky).forEach(e => e.classList.remove('low')); if (low && d.hint) low.el.classList.add('low'); run.updateHint(); }
      if (!ending && spawned >= N && clouds.length === 0) { ending = true; run.later(run.finish, 500); return; }
      run.raf = requestAnimationFrame(frame);
    }
    return {
      begin() { run.progress(0, N); prev = 0; run.raf = requestAnimationFrame(frame); },
      target: () => (lowest ? lowest.code : null),
      key(code) {
        if (!clouds.length) return null;
        const m = clouds.filter(c => c.code === code).sort((a, b) => b.y - a.y)[0];
        if (!m) { retrigger(mouth, 'no'); return false; }
        mouth.style.left = m.x + '%';
        retrigger(mouth, 'chomp');
        m.el.classList.add('eaten');
        m.el.style.top = '78%';
        setTimeout(() => m.el.remove(), 300);
        remove(m);
        lowest = null;
        return true;
      },
    };
  }

  // ---------- 打完整單字的共用核心（青蛙、長頸鹿共用） ----------
  // 下方字條顯示整個字和要按的每個鍵；打完一整個字才算過關。普通／挑戰有時間限制。
  function WordCore(run, bar, words, cb) {
    const d = DIFF[save.diff];
    let w = -1, k = 0, cur = null, active = false, timer = 0, tEls = [], lockUntil = 0;
    function mark() { tEls.forEach((e, i) => { e.classList.toggle('done', i < k); e.classList.toggle('cur', active && i === k); }); }
    function render(limit) {
      const tilesHtml = cur.groups.map(g => `<span class="wgroup">${g.map(t => `<span class="wt${t.small ? ' small' : ''}">${esc(t.label)}</span>`).join('')}</span>`).join('');
      bar.className = 'wordbar';
      bar.innerHTML = `<div class="wb-text">${esc(cur.text)}${cur.sub ? `<small>${esc(cur.sub)}</small>` : ''}</div>` +
        `<div class="wb-tiles">${tilesHtml}</div>${limit ? '<div class="wtimer"><i></i></div>' : ''}`;
      tEls = $$('.wt', bar);
      mark();
      if (limit) {
        const t = $('.wtimer i', bar);
        requestAnimationFrame(() => { t.style.transition = `width ${limit}ms linear`; t.style.width = '0%'; });
      }
    }
    function stopTimer() {
      clearTimeout(timer);
      const t = $('.wtimer i', bar);
      if (t) { t.style.width = getComputedStyle(t).width; t.style.transition = 'none'; }
    }
    function fail() {
      if (!active) return;
      active = false; stopTimer();
      run.miss(cur.tiles[k].code);
      bar.classList.add('fail'); mark();
      run.updateHint();
      cb.onFail(w);
    }
    return {
      next() {
        w++;
        run.progress(w, words.length);
        if (w >= words.length) { active = false; cb.onAllDone(); return; }
        cur = words[w]; k = 0; active = true;
        const limit = d.wordTime ? d.wordTime.base + d.wordTime.per * cur.tiles.length : 0;
        render(limit);
        if (limit) timer = run.later(fail, limit);
        cb.onWord(w);
        run.updateHint();
      },
      key(code) {
        if (!active || Date.now() < lockUntil) return null;
        if (code !== cur.tiles[k].code) {
          retrigger(tEls[k], 'shake');
          if (cb.resetOnWrong) { k = 0; lockUntil = Date.now() + cb.resetOnWrong; run.later(() => { mark(); run.updateHint(); }, cb.resetOnWrong); }
          cb.onWrong();
          return false;
        }
        k++;
        if (k >= cur.tiles.length) { active = false; stopTimer(); bar.classList.add('ok'); mark(); cb.onDone(w); }
        else { mark(); if (cb.onKey) cb.onKey(k, cur.tiles.length); }
        return true;
      },
      target: () => (active ? cur.tiles[k].code : null),
    };
  }

  // ---------- 小遊戲 4：青蛙跳荷葉 ----------
  function FrogGame(run, play) {
    const d = DIFF[save.diff], words = pickWords(run.stage, d.wordN);
    play.innerHTML = '<div class="pond"><div class="ptrack"></div>' +
      '<div class="frog"><i class="eye l"></i><i class="eye r"></i><i class="fmouth"></i><i class="cheek l"></i><i class="cheek r"></i></div></div>' +
      '<div class="wordbar"></div>';
    const pond = $('.pond', play), track = $('.ptrack', play), frog = $('.frog', play);
    const pads = [h('div', 'pad start', '<div class="lily"></div>')].concat(
      words.map((w, i) => h('div', 'pad' + (i === words.length - 1 ? ' last' : ''), `<div class="ptag">${esc(w.text)}</div><div class="lily"></div>`)));
    pads.forEach(p => track.appendChild(p));
    let at = 0;

    function place(anim) {
      const step = pads[0].offsetWidth, x0 = Math.round(pond.clientWidth * 0.22);
      track.style.transition = anim ? 'transform .45s ease-in-out' : 'none';
      track.style.transform = `translateX(${x0 - at * step}px)`;
      frog.style.left = (x0 + (step - frog.offsetWidth) / 2) + 'px';
      pads.forEach((p, i) => { p.classList.toggle('next', i === at + 1); p.classList.toggle('past', i <= at); });
    }
    requestAnimationFrame(() => place(false));
    function hop() { at++; retrigger(frog, 'jump'); place(true); }

    const core = WordCore(run, $('.wordbar', play), words, {
      onWord() { place(false); },
      onWrong() { retrigger(frog, 'oops'); },
      onDone() { hop(); sfx('hit', 8); run.later(() => core.next(), 560); },
      onFail() {
        retrigger(frog, 'plop');
        run.later(() => { frog.classList.remove('plop'); hop(); }, 700);
        run.later(() => core.next(), 1300);
      },
      onAllDone() { frog.classList.add('happy'); sparkle(pond, 10); run.later(run.finish, 900); },
    });
    return {
      relayout: () => place(false),
      begin() { place(false); core.next(); },
      target: core.target,
      key: core.key,
    };
  }

  // ---------- 小遊戲 5：長頸鹿吃蘋果 ----------
  // 長頸鹿先把嘴巴湊到蘋果旁；每打對一個鍵嘴巴張大一點，打完整個字就咬下去；打錯會下巴脫臼，整個字重打。
  function GiraffeGame(run, play) {
    const d = DIFF[save.diff], words = pickWords(run.stage, d.wordN);
    const SLOTS = [[22, 30], [36, 12], [52, 28], [68, 10], [84, 30]];   // 蘋果在樹上的位置（x%, y%）
    play.innerHTML = '<div class="orchard"><div class="crown"></div><div class="trunk"></div><div class="grass"></div>' +
      '<div class="giraffe"><div class="g-head"><i class="horn l"></i><i class="horn r"></i><i class="ear"></i><i class="eye"></i><i class="nostril"></i>' +
      '<i class="maw"></i><i class="jaw"></i><i class="ouch">💫</i></div>' +
      '<div class="g-neck"></div><div class="g-body"><i class="leg a"></i><i class="leg b"></i><i class="leg c"></i><i class="leg d"></i></div></div></div>' +
      '<div class="wordbar"></div>';
    const orchard = $('.orchard', play), giraffe = $('.giraffe', play), neck = $('.g-neck', play), head = $('.g-head', play), jaw = $('.jaw', play);
    const NECK = 56, SNOUT = 58;   // SNOUT：長頸鹿中心到嘴巴前端要留的距離(px)，讓蘋果剛好在嘴前
    const openJaw = deg => { jaw.style.transform = `rotate(${deg}deg)`; };
    const slotEls = SLOTS.map(([x, y]) => {
      const e = h('div', 'apple-slot', '<div class="apple"><i class="leaf"></i></div><div class="atag"></div>');
      e.style.left = x + '%'; e.style.top = y + '%';
      orchard.appendChild(e);
      return e;
    });
    const slotWord = SLOTS.map(() => -1);
    let assigned = 0;

    function fill(s) {
      if (assigned >= words.length) { slotWord[s] = -1; slotEls[s].classList.add('empty'); return; }
      slotWord[s] = assigned++;
      $('.atag', slotEls[s]).textContent = words[slotWord[s]].text;
      slotEls[s].className = 'apple-slot grow';
    }
    shuffle(SLOTS.map((_, i) => i)).forEach(fill);
    const slotOf = wi => slotWord.indexOf(wi);

    let at = -1;   // 現在嘴巴湊著的蘋果
    // 走到蘋果左邊、伸長脖子，讓嘴巴和蘋果同高
    function reach(s) {
      at = s;
      giraffe.style.left = `calc(${SLOTS[s][0]}% - ${SNOUT}px)`;
      // 蘋果可能正在長出來（有縮放動畫），所以用不受動畫影響的 offsetTop 算位置
      const ap = $('.apple', slotEls[s]), hd = head.getBoundingClientRect();
      const mouthY = hd.top - orchard.getBoundingClientRect().top + hd.height * 0.8;
      const appleY = slotEls[s].offsetTop + ap.offsetTop + ap.offsetHeight / 2;
      neck.style.height = Math.max(6, neck.offsetHeight + (mouthY - appleY)) + 'px';
    }

    const core = WordCore(run, $('.wordbar', play), words, {
      resetOnWrong: 650,
      onWord(wi) {
        slotEls.forEach((e, i) => e.classList.toggle('target', slotWord[i] === wi));
        head.classList.remove('bite', 'sad');
        openJaw(6);
        reach(slotOf(wi));
      },
      onKey(k, n) { openJaw(6 + 46 * k / n); },
      onWrong() {
        jaw.style.transform = '';
        retrigger(head, 'dislocate');
        run.later(() => { head.classList.remove('dislocate'); openJaw(6); }, 650);
      },
      onDone(wi) {
        const s = slotOf(wi);
        openJaw(58);
        slotEls[s].classList.remove('target');
        run.later(() => {
          openJaw(0); retrigger(head, 'bite');
          slotEls[s].className = 'apple-slot eaten'; sfx('hit', 10);
        }, 160);
        run.later(() => fill(s), 1000);
        run.later(() => core.next(), 800);
      },
      onFail(wi) {
        const s = slotOf(wi);
        openJaw(0); head.classList.add('sad');
        slotEls[s].className = 'apple-slot fall';
        run.later(() => fill(s), 1000);
        run.later(() => core.next(), 1100);
      },
      onAllDone() { openJaw(0); neck.style.height = NECK + 'px'; retrigger(giraffe, 'happy'); sparkle(orchard, 10); run.later(run.finish, 900); },
    });
    return {
      relayout: () => { if (at >= 0) reach(at); },
      begin() { neck.style.height = NECK + 'px'; core.next(); },
      target: core.target,
      key: core.key,
    };
  }

  const GAMES = {
    frog:    { name: '青蛙跳荷葉', icon: '🐸', theme: 'theme-frog', make: FrogGame,
               how: '每片荷葉上都有一個字，把「整個字」打完，青蛙就會跳過去！' },
    giraffe: { name: '長頸鹿吃蘋果', icon: '🦒', theme: 'theme-giraffe', make: GiraffeGame,
               how: '每打對一個鍵，長頸鹿的嘴巴就張大一點，整個字打完就「咬」下蘋果！打錯會下巴脫臼，要從頭再打一次喔。' },
    cube:  { name: '滾滾方塊', icon: '🟨', theme: 'theme-cube',  make: CubeGame,
             how: '幫小方塊滾到終點找朋友！照順序按下方塊上的鍵。' },
    mole:  { name: '打地鼠',   icon: '🐹', theme: 'theme-mole',  make: MoleGame,
             how: '地鼠舉著牌子冒出來，按下牌子上的鍵把牠敲回洞裡！' },
    mouth: { name: '大嘴怪',   icon: '👄', theme: 'theme-mouth', make: MouthGame,
             how: '字母雲從天上飄下來，按對的鍵讓大嘴怪一口吃掉！' },
  };
  const GAME_ORDER = ['cube', 'mole', 'mouth'];

  // ---------- 畫面切換 ----------
  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    document.body.dataset.screen = id;
  }

  const getStars = (sid, gk) => book[save.mode][`${sid}:${gk}`] || 0;
  const maxStars = () => WORLDS.reduce((a, w, wi) => a + w.stages.length * gamesOf(wi).length * 3, 0);
  const stageStars = (wi, si) => gamesOf(wi).reduce((a, gk) => a + getStars(`${wi + 1}-${si + 1}`, gk), 0);
  const isOpen = (wi, si) => save.unlockAll || si === 0 || stageStars(wi, si - 1) > 0;
  const starStr = n => '★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span>';

  function renderMap() {
    $$('#segMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === save.mode));
    $$('#segDiff button').forEach(b => b.classList.toggle('on', b.dataset.diff === save.diff));
    $('#optColors').checked = !!save.colors;
    $('#optSound').checked = !!save.sound;
    $('#optUnlock').checked = !!save.unlockAll;
    $('#diffNote').textContent = DIFF[save.diff].note;
    const box = $('#worlds');
    box.innerHTML = '';
    let got = 0, max = 0;
    WORLDS.forEach((w, wi) => {
      const sec = h('section', 'world');
      sec.style.setProperty('--wc', w.color);
      sec.appendChild(h('h2', '', `<span class="wnum">世界 ${wi + 1}</span>${w.name}<small>${w.sub}</small>`));
      const grid = h('div', 'stages');
      w.stages.forEach((_, si) => {
        const st = getStage(wi, si), open = isOpen(wi, si);
        const card = h('div', 'stage' + (open ? '' : ' locked'));
        const chips = st.keys.length <= 3
          ? st.keys.map(c => `<span class="chip" data-f="${FINGER[c]}">${esc(label(c))}</span>`).join('')
          : `<span class="st-title">${esc(st.title)}</span>`;
        card.innerHTML = `<div class="st-head"><span class="st-id">${st.id}</span>${chips}</div>`;
        const games = h('div', 'st-games');
        gamesOf(wi).forEach(gk => {
          const n = getStars(st.id, gk);
          got += n; max += 3;
          const b = h('button', 'gbtn', `<span class="gi">${GAMES[gk].icon}</span><span class="gn">${GAMES[gk].name}</span><span class="gs">${starStr(n)}</span>`);
          b.disabled = !open;
          b.addEventListener('click', () => startGame(wi, si, gk));
          games.appendChild(b);
        });
        card.appendChild(games);
        if (!open) card.appendChild(h('div', 'lock', '🔒 上一關拿到星星就會打開'));
        grid.appendChild(card);
      });
      sec.appendChild(grid);
      box.appendChild(sec);
    });
    $('#totalStars').innerHTML = `★ ${got} / ${max}`;
    $('#mapWho').textContent = whoText();
    renderCloud();
  }

  // ---------- 雲端狀態 ----------
  const whoText = () => !player ? '' : player.guest ? '👤 訪客（不記成績）' : `👤 ${player.cls} ${player.seat} 號`;
  function cloudText() {
    if (!player || player.guest) return '';
    const c = window.KBCLOUD ? KBCLOUD.info() : { enabled: false };
    if (!c.enabled) return '💾 只存在這台電腦';
    if (c.status === 'busy') return '☁ 上傳中…';
    if (c.status === 'error') return `⚠ 連不上雲端，${c.pending} 局先存在這台電腦，會自動補傳`;
    if (c.pending) return `☁ ${c.pending} 局等待上傳`;
    return '☁ 星星已存到雲端';
  }
  function renderCloud() {
    const t = cloudText(), bad = /⚠/.test(t);
    $$('.cloud-stat').forEach(el => { el.textContent = t; el.classList.toggle('bad', bad); el.classList.toggle('hidden', !t); });
  }
  if (window.KBCLOUD) KBCLOUD.onChange(renderCloud);

  // ---------- 一局遊戲 ----------
  let run = null;

  function stopRun() {
    if (!run) return;
    run.running = false;
    run.timers.forEach(clearTimeout);
    cancelAnimationFrame(run.raf);
    run = null;
    setTarget(null);
    $$('.key.intro-key').forEach(k => k.classList.remove('intro-key'));
  }

  function startGame(wi, si, gk) {
    stopRun();
    if (document.activeElement) document.activeElement.blur();
    const stage = getStage(wi, si), G = GAMES[gk];
    showScreen('game');
    $('#game').className = 'screen active ' + G.theme;
    $('#result').className = 'overlay hidden';
    $('#hudTitle').innerHTML = `<b>${stage.id}</b> ${esc(stage.title)}　${G.icon} ${G.name}`;
    $('#hudBar').style.width = '0%';
    const play = $('#play');
    play.innerHTML = '';
    $$('#game .intro').forEach(e => e.remove());
    run = { wi, si, gk, stage, correct: 0, wrong: 0, missed: 0, combo: 0, wrongKeys: {}, t0: 0, running: false, done: false, timers: [], raf: 0 };
    const r = run;
    r.later = (fn, ms) => { const id = setTimeout(() => { if (run === r) fn(); }, ms); r.timers.push(id); return id; };
    r.progress = (a, b) => { $('#hudBar').style.width = (100 * a / b) + '%'; updateStat(); };
    r.miss = code => { r.missed++; r.combo = 0; r.wrongKeys[code] = (r.wrongKeys[code] || 0) + 1; sfx('miss'); updateStat(); };
    r.updateHint = () => { if (run === r) setTarget(r.running ? r.game.target() : null); };
    r.finish = () => finishRun(r);
    r.game = G.make(r, play);
    showIntro(play, stage, gk);
    updateStat();
  }

  function showIntro(play, stage, gk) {
    const G = GAMES[gk];
    const few = stage.keys.length <= 3 ? stage.keys : null;
    let how = G.how;
    if (stage.words && gk === 'cube') how = save.mode === 'zy'
      ? '照著詞語的注音打：每個字打完要按聲調鍵，一聲按空白鍵。'
      : '照著單字一個字母一個字母打，單字中間要按空白鍵。';
    else if (stage.words && save.mode === 'zy') how += '<br><span class="zy-tip">打注音：每個字打完要按聲調鍵，一聲按空白鍵。例：你好 ＝ ㄋㄧ ˇ ㄏㄠ ˇ</span>';
    const keyHtml = few
      ? `<div class="intro-keys">${few.map(c => `<div class="ik" data-f="${FINGER[c]}"><b>${esc(label(c))}</b><small>${FINGER_NAME[FINGER[c]]}</small></div>`).join('')}</div>`
      : `<p class="intro-big">${esc(stage.title)}</p>`;
    const fj = save.mode === 'zy' ? 'ㄑ(F)、ㄨ(J)' : 'F、J';
    const ov = h('div', 'intro', `<div class="intro-card">
      <div class="intro-icon">${G.icon}</div><h2>${G.name}</h2><p>${how}</p>${keyHtml}
      <p class="home-tip">👐 雙手放在基準列 <b>${HOME.map(label).join(' ')}</b>，兩根食指摸到 <b>${fj}</b> 上的小凸點</p>
      <button class="go">按 <kbd>空白鍵</kbd> 開始</button></div>`);
    $('.go', ov).addEventListener('click', beginRun);
    $('#game').appendChild(ov);   // 蓋住整個畫面、字放大，三年級也看得清楚，不用捲動
    if (few) few.forEach(c => KEYEL[c] && KEYEL[c].classList.add('intro-key'));
  }

  function beginRun() {
    if (!run || run.running || run.done) return;
    $$('#game .intro').forEach(e => e.remove());
    $$('.key.intro-key').forEach(k => k.classList.remove('intro-key'));
    if (document.activeElement) document.activeElement.blur();
    run.running = true;
    run.t0 = performance.now();
    run.game.begin();
    run.updateHint();
  }

  function updateStat() {
    if (!run) return;
    const total = run.correct + run.wrong + run.missed;
    const acc = total ? Math.round(100 * run.correct / total) : 100;
    $('#hudStat').innerHTML = `正確率 <b>${acc}%</b>　連擊 <b>${run.combo}</b>`;
  }

  function onGameKey(code) {
    const expected = run.game.target();
    const ok = run.game.key(code);
    if (ok === null || ok === undefined) return;
    if (ok) { run.correct++; run.combo++; sfx('hit', run.combo); flash(code, 'hit'); }
    else {
      run.wrong++; run.combo = 0; sfx('wrong'); flash(code, 'miss');
      if (expected) run.wrongKeys[expected] = (run.wrongKeys[expected] || 0) + 1;
    }
    updateStat();
    run.updateHint();
  }

  function finishRun(r) {
    if (r !== run || r.done) return;
    r.done = true; r.running = false;
    cancelAnimationFrame(r.raf);
    setTarget(null);
    const total = r.correct + r.wrong + r.missed;
    const acc = total ? r.correct / total : 0;
    const stars = acc >= 0.95 ? 3 : acc >= 0.85 ? 2 : 1;
    const secs = Math.max(1, (performance.now() - r.t0) / 1000);
    const kpm = Math.round(r.correct * 60 / secs);
    const k = `${r.stage.id}:${r.gk}`;
    const best = getStars(r.stage.id, r.gk);
    if (stars > best) { book[save.mode][k] = stars; persist(); }
    if (player && !player.guest && window.KBCLOUD) {
      KBCLOUD.push({ cls: player.cls, seat: player.seat, token: player.token, mode: save.mode, diff: save.diff, stage: r.stage.id, game: r.gk,
        stars, acc: Math.round(acc * 100), kpm, correct: r.correct, miss: r.wrong + r.missed, secs: Math.round(secs),
        snap: book[save.mode], maxStars: maxStars() });
    }
    const msg = stars === 3 ? '太厲害了！' : stars === 2 ? '很棒喔！' : '完成了！再練一次會更好';
    const weak = Object.entries(r.wrongKeys).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const weakHtml = weak.length
      ? `<div class="weak">要多練的鍵：${weak.map(([c, n]) => `<span class="chip" data-f="${FINGER[c]}">${esc(label(c))}</span><small>×${n}</small>`).join(' ')}</div>`
      : '<div class="weak">一個都沒錯，完美！</div>';
    const res = $('#result');
    res.innerHTML = `<div class="res-card">
      <div class="res-stars">${[1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.18}s">★</span>`).join('')}</div>
      <h2>${msg}</h2>
      <div class="res-nums"><div><b>${Math.round(acc * 100)}%</b><small>正確率</small></div><div><b>${kpm}</b><small>每分鐘按鍵</small></div><div><b>${r.correct}</b><small>按對</small></div><div><b>${r.wrong + r.missed}</b><small>失誤</small></div></div>
      ${weakHtml}
      <div class="cloud-stat"></div>
      <div class="res-btns"><button data-act="retry">↻ 再玩一次 <kbd>空白</kbd></button><button data-act="next" class="primary">下一個 ▶ <kbd>Enter</kbd></button><button data-act="map">地圖 <kbd>Esc</kbd></button></div>
    </div>`;
    res.className = 'overlay';
    renderCloud();
    $$('button', res).forEach(b => b.addEventListener('click', () => resultAction(b.dataset.act)));
    sfx('win');
  }

  function resultAction(act) {
    if (!run) return;
    const { wi, si, gk } = run;
    if (act === 'retry') startGame(wi, si, gk);
    else if (act === 'map') goMap();
    else {
      const order = gamesOf(wi), gi = order.indexOf(gk);
      if (gi < order.length - 1) startGame(wi, si, order[gi + 1]);
      else if (si + 1 < WORLDS[wi].stages.length) startGame(wi, si + 1, order[0]);
      else if (wi + 1 < WORLDS.length) startGame(wi + 1, 0, gamesOf(wi + 1)[0]);
      else goMap();
    }
  }

  function goMap() { stopRun(); renderMap(); showScreen('map'); }

  // ---------- 按鍵 ----------
  document.addEventListener('keydown', e => {
    if (document.body.dataset.screen !== 'game' || !run) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.code === 'Escape') { e.preventDefault(); goMap(); return; }
    if (!INFO[e.code]) return;   // F5、F11 等功能鍵照常
    e.preventDefault();
    if (e.repeat) return;
    if (run.done) {
      if (e.code === 'Space') resultAction('retry');
      else if (e.code === 'Enter') resultAction('next');
      return;
    }
    if (!run.running) { if (e.code === 'Space') beginRun(); return; }
    if (FN_KEYS.has(e.code)) return;   // Shift、Caps 等不算錯
    onGameKey(e.code);
  });

  window.addEventListener('resize', () => { if (run && run.game.relayout) run.game.relayout(); });

  // ---------- 首頁與地圖的按鈕 ----------
  function setMode(m) { save.mode = m; persist(); buildKeyboard(); }
  $$('.mode-btn').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); goMap(); }));
  $$('#segMode button').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); renderMap(); }));
  $$('#segDiff button').forEach(b => b.addEventListener('click', () => { save.diff = b.dataset.diff; persist(); renderMap(); }));
  $('#optColors').addEventListener('change', e => { save.colors = e.target.checked; persist(); buildKeyboard(); });
  $('#optSound').addEventListener('change', e => { save.sound = e.target.checked; persist(); });
  // 全部解鎖要老師密碼；取消勾選不用密碼
  const TEACHER_PW = 'naes5922023';
  function closePw() { $('#pwBox').classList.add('hidden'); renderMap(); }
  $('#optUnlock').addEventListener('change', e => {
    if (!e.target.checked) { save.unlockAll = false; persist(); renderMap(); return; }
    e.target.checked = false;
    $('#pwInput').value = ''; $('#pwErr').textContent = '';
    $('#pwBox').classList.remove('hidden');
    $('#pwInput').focus();
  });
  $('#pwForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#pwInput').value !== TEACHER_PW) { $('#pwErr').textContent = '密碼不對喔！'; $('#pwInput').select(); return; }
    save.unlockAll = true; persist(); closePw();
  });
  $('#pwCancel').addEventListener('click', closePw);
  $('#btnHome').addEventListener('click', () => showScreen('home'));
  $('#btnQuit').addEventListener('click', goMap);

  // ---------- 首頁：選班級 → 選座號 → 輸入密碼 → 雲端檢查並載回星星 → 選英文/注音 ----------
  const CLOUD = window.KBCLOUD || { CLASSES: [], CLASS_SIZE: {}, enabled: false };
  let pickCls = '', pickSeat = 0, pin = '', pinShow = false, loginSeq = 0;
  function homeStep(id) {
    $$('#home .step').forEach(s => s.classList.toggle('hidden', s.id !== id));
  }
  const onStep = id => document.body.dataset.screen === 'home' && !$('#' + id).classList.contains('hidden');
  function enterAs(p, cloudStars, msg) {
    player = p;
    if (p.guest) book = save.stars;
    else book = mergeStars(loadPlayers()[pKey(p)], cloudStars);
    persist();
    $('#whoHome').textContent = whoText();
    $('#loadMsg').textContent = msg || '';
    $('#loadMsg').classList.toggle('bad', /⚠/.test(msg || ''));
    homeStep('stepMode');
  }
  // 密碼輸入：跟遊戲一樣看實體按鍵（e.code），輸入法停在注音也打得出 st1234567
  function renderPin(msg, bad) {
    $('#pinBox').textContent = pin ? (pinShow ? pin : '●'.repeat(pin.length)) : '　';
    $('#pinBox').classList.toggle('empty', !pin);
    $('#btnPinEye').textContent = pinShow ? '🙈 藏起來' : '👁 看密碼';
    if (msg != null) { $('#pinMsg').textContent = msg; $('#pinMsg').classList.toggle('bad', !!bad); }
  }
  const PIN_TIP = '密碼就是你的學校帳號（st 開頭），打完按 Enter';
  function askPin(seat, msg, bad) {
    pickSeat = seat; pin = ''; pinShow = false;
    $('#pinWho').textContent = `${pickCls} ${seat} 號`;
    renderPin(msg || PIN_TIP, bad);
    homeStep('stepPin');
    if (document.activeElement) document.activeElement.blur();
  }
  function submitPin() {
    const cls = pickCls, seat = pickSeat;
    if (!CLOUD.enabled) { enterAs({ cls, seat }, null, '💾 雲端還沒設定，星星只會存在這台電腦'); return; }
    if (pin.replace(/^st/, '').length < 4) { renderPin('密碼還沒打完喔！', true); return; }
    const seq = ++loginSeq, typed = pin;
    $('#loadWho').textContent = `${cls} ${seat} 號`;
    homeStep('stepLoad');
    CLOUD.login(cls, seat, typed).then(res => {
      if (seq !== loginSeq) return;
      if (res.ok) enterAs({ cls, seat, token: res.token }, res.stars, '☁ 已經拿回你上次的星星！');
      else if (res.error === 'wrong') askPin(seat, '密碼不對喔！再試一次（忘記了請問老師）', true);
      else if (res.error === 'noseat') askPin(seat, '這個座號還沒有帳號，請問老師', true);
      else askPin(seat, '⚠ 雲端出了點問題，請再試一次', true);
    }, () => {
      if (seq === loginSeq) askPin(seat, '⚠ 連不上雲端，請再試一次；或請老師讓你先用「訪客」玩（不記成績）', true);
    });
  }
  document.addEventListener('keydown', e => {
    if (!onStep('stepPin') || e.ctrlKey || e.altKey || e.metaKey) return;
    const c = e.code;
    let ch = '';
    if (/^Key[A-Z]$/.test(c)) ch = c.slice(3).toLowerCase();
    else if (/^(Digit|Numpad)\d$/.test(c)) ch = c.slice(-1);
    if (ch) { e.preventDefault(); if (pin.length < 16) pin += ch; renderPin(); return; }
    if (c === 'Backspace') { e.preventDefault(); pin = pin.slice(0, -1); renderPin(); return; }
    if (c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); submitPin(); return; }
    if (c === 'Escape') { e.preventDefault(); homeStep('stepSeat'); }
  });
  function showSeats(c) {
    pickCls = c;
    $('#seatCls').textContent = c;
    const box = $('#seatPick');
    box.innerHTML = '';
    for (let i = 1; i <= (CLOUD.CLASS_SIZE[c] || 0); i++) {
      const b = h('button', 'seat-btn', String(i));
      b.addEventListener('click', () => askPin(i));
      box.appendChild(b);
    }
    homeStep('stepSeat');
  }
  CLOUD.CLASSES.forEach(c => {
    const b = h('button', 'cls-btn', esc(c));
    b.addEventListener('click', () => showSeats(c));
    $('#classPick').appendChild(b);
  });
  $('#btnBackClass').addEventListener('click', () => homeStep('stepClass'));
  $('#btnPinBack').addEventListener('click', () => homeStep('stepSeat'));
  $('#btnPinOk').addEventListener('click', submitPin);
  $('#btnPinEye').addEventListener('click', () => { pinShow = !pinShow; renderPin(); });
  $('#btnLoadCancel').addEventListener('click', () => { loginSeq++; askPin(pickSeat); });
  $('#btnGuest').addEventListener('click', () => enterAs({ guest: true }, null, '訪客的星星只存在這台電腦，不會記成績'));
  $('#btnSwitch').addEventListener('click', () => { player = null; book = save.stars; homeStep('stepClass'); });
  if (!CLOUD.CLASSES.length) enterAs({ guest: true }, null, '');   // cloud.js 沒載到時，照舊直接玩

  buildKeyboard();
  buildHands();
  showScreen('home');

  // 給自動測試用的小窗口（不影響遊戲）
  window.KBPARK = { getStage, genKeys, genWordTiles, ZYKEY, FINGER, WORLDS, get run() { return run; }, startGame, beginRun,
    get player() { return player; }, get book() { return book; }, maxStars };
})();
