/* 鍵盤樂園 — 雲端進度（班級＋座號＋個人密碼，不存姓名）
 * 教室電腦關機會還原，所以星星進度存在老師的 Google 試算表（gas/Code.gs）。
 * 密碼只在登入時傳給雲端檢查一次；登入成功拿到「通行證」，之後上傳成績都用通行證。
 * 玩完一局就上傳；斷線時先排隊存在這台電腦，恢復連線自動補傳。
 */
(function () {
  'use strict';
  // ===== 老師設定區 =====
  // SYNC_URL＝Apps Script 網頁應用程式網址（gas/Code.gs 部署後貼上）。空字串＝只存在這台電腦
  const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyVhroF3rnJ8RtslfyHrkQpWR2iwJshNSws8D5Wcb98pTQGhVMudnAFY6Uup-WShuhMAQ/exec';
  // 班級與人數（座號按鈕 1～人數）。要和 gas/Code.gs 的 CLASSES／CLASS_SIZE 一致
  const CLASS_SIZE = { '三年乙班': 22, '三年丙班': 22, '三年丁班': 17 };
  // =====================

  const CLASSES = Object.keys(CLASS_SIZE);
  const QKEY = 'kbpark-queue';
  const DKEY = 'kbpark-dev';
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 存不了就算了 */ } };

  // 電腦代號：這個瀏覽器的隨機代號（教室電腦還原後會變），老師看紀錄時可分辨是不是同一台
  let dev = load(DKEY, '');
  if (!dev) { dev = Math.random().toString(36).slice(2, 6).toUpperCase(); store(DKEY, dev); }

  let status = SYNC_URL ? 'ok' : 'off';   // ok / busy / pending / error / off
  const listeners = [];
  const emit = () => listeners.forEach(fn => { try { fn(info()); } catch (e) { /* 忽略 */ } });
  const pending = () => load(QKEY, []).length;
  const info = () => ({ status, pending: pending(), enabled: !!SYNC_URL });

  function post(body, ms) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), ms);
    return fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(r => r.json())
      .then(res => { clearTimeout(timer); return res; }, err => { clearTimeout(timer); throw err; });
  }

  // 登入 → Promise<{ ok:true, token, stars:{en,zy} }> 或 { ok:false, error:'wrong'|'noseat'|... }；連不上會 reject
  function login(cls, seat, pin) {
    if (!SYNC_URL) return Promise.reject(new Error('off'));
    return post({ action: 'login', cls, seat, pin }, 15000).then(res => {
      if (res.ok) res.stars = { en: (res.stars && res.stars.en) || {}, zy: (res.stars && res.stars.zy) || {} };
      return res;
    });
  }

  // 把一局成績排進上傳佇列並立刻試著上傳（rec 要帶 token）
  function push(rec) {
    rec.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    rec.dev = dev;
    rec.ts = new Date().toLocaleString('zh-TW', { hour12: false });
    const q = load(QKEY, []);
    q.push(rec);
    store(QKEY, q.slice(-300));   // 最多留 300 筆，避免無限長
    if (!SYNC_URL) return;
    status = 'pending'; emit();
    flush();
  }

  let flushing = null;
  function flush() {
    if (!SYNC_URL) return Promise.resolve(info());
    if (flushing) return flushing;
    const todo = load(QKEY, []).slice(0, 50);
    if (!todo.length) { status = 'ok'; emit(); return Promise.resolve(info()); }
    status = 'busy'; emit();
    flushing = post({ records: todo }, 20000)   // 卡住 20 秒就放棄，等下一輪重傳
      .then(res => {
        if (!res.ok) throw new Error(res.error || '伺服器拒絕');
        const sent = new Set(todo.map(r => r.id));
        store(QKEY, load(QKEY, []).filter(r => !sent.has(r.id)));
        status = pending() ? 'pending' : 'ok';
      })
      .catch(() => { status = 'error'; })
      .then(() => {
        flushing = null; emit();
        if (status === 'pending') setTimeout(flush, 500);   // 超過 50 筆就接著傳
        return info();
      });
    return flushing;
  }

  if (SYNC_URL) {
    if (pending()) { status = 'pending'; setTimeout(flush, 2000); }
    window.addEventListener('online', () => flush());
    setInterval(() => { if (pending()) flush(); }, 30000);
  }

  window.KBCLOUD = {
    CLASSES, CLASS_SIZE, get enabled() { return !!SYNC_URL; },
    login, push, flush, info, onChange: fn => listeners.push(fn),
  };
})();
