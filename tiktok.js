// TikTok Studio uploader for the built-in browser. Pane VISIBLE, tab fronted, viewport ~1300 wide.
// TikTok's CSP blocks outside fetches, so files go through IndexedDB on the same origin:
//  1) On https://www.tiktok.com/robots.txt (no CSP): paste this file,  await cvTTStash(baseUrl, [names])
//  2) Per Short, on https://www.tiktok.com/tiktokstudio/upload?from=webapp: paste this file, then
//       await cvTTPrepare({ name, caption, day: 23 })      // upload, caption, Schedule, date, AI label
//     It returns `clicks`: two screen points (hour, minute). The time picker ignores JS events, so do two REAL
//     clicks: computer screenshot (to get the frame), then left_click each point, scaled by frame width / viewport.
//  3) await cvTTSubmit({ date: "2026-11-23", time: "15:00", captionStart: "Half of new" })  -> verifies, Schedule.
//  Verify the post shows in /tiktokstudio/content before the next one (a hidden pane made Schedule fail silently).
window.cvTTdb = () => new Promise((res, rej) => { const r = indexedDB.open('cvmedia', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.cvTTStash = async (base, names) => {
  const db = await cvTTdb(), out = {};
  for (const f of names) {
    const b = await (await fetch(base + f)).blob();
    await new Promise((res, rej) => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').put(b, f); t.oncomplete = res; t.onerror = () => rej(t.error); });
    out[f] = b.size;
  }
  return out;
};
window.cvTTClear = async () => { const db = await cvTTdb(); await new Promise(r => { const t = db.transaction('f', 'readwrite'); t.objectStore('f').clear(); t.oncomplete = r; }); return 'cleared'; };
window.cvTTPrepare = async (o) => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, n = 30, ms = 500) => { for (let i = 0; i < n; i++) { const v = f(); if (v) return v; await w(ms); } return null; };
  const db = await cvTTdb();
  const b = await new Promise((res, rej) => { const q = db.transaction('f').objectStore('f').get(o.name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  if (!b) return { error: 'not stashed: ' + o.name };
  const inp = await until(() => document.querySelector('input[type=file]'), 20);
  const dt = new DataTransfer(); dt.items.add(new File([b], o.name, { type: 'video/mp4' }));
  inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await until(() => document.querySelector('.public-DraftEditor-content') && /Uploaded/.test(document.body.innerText), 90);
  [...document.querySelectorAll('button')].filter(x => /^(Got it|Cancel|Not now)$/.test(x.innerText.trim())).forEach(x => x.click()); await w(800);
  // caption: Draft.js accepts a synthetic paste after selectAll (execCommand insertText crashes it)
  const ed = document.querySelector('.public-DraftEditor-content'); ed.scrollIntoView({ block: 'center' }); ed.focus(); await w(300);
  document.execCommand('selectAll'); await w(300);
  const cd = new DataTransfer(); cd.setData('text/plain', o.caption);
  ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: cd, bubbles: true, cancelable: true })); await w(1500);
  // Schedule + consent
  const sch = [...document.querySelectorAll('label,span,div')].find(e => e.children.length <= 2 && e.innerText?.trim() === 'Schedule' && e.closest('label, [class*=radio]'));
  (sch.closest('label') || sch).click(); await w(1200);
  [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Allow' && x.offsetParent)?.click(); await w(1000);
  // date: span.day.valid (current month view)
  [...document.querySelectorAll('input')].find(i => /^20\d\d-/.test(i.value)).click(); await w(1000);
  [...document.querySelectorAll('span.day.valid')].find(e => e.innerText.trim() === String(o.day))?.click(); await w(900);
  // AI-generated content label
  [...document.querySelectorAll('div,span,button')].find(e => e.children.length <= 1 && e.innerText?.trim() === 'Show more')?.click(); await w(1200);
  const lab = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText?.trim() === 'AI-generated content');
  let c = lab, sw = null; for (let i = 0; i < 6 && !sw; i++) { c = c.parentElement; sw = c.querySelector('[role=switch], input[type=checkbox]'); }
  if (!(sw.getAttribute('aria-checked') === 'true' || sw.checked)) { sw.click(); await w(1200); [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Turn on' && x.offsetParent)?.click(); await w(1000); }
  // time: open the picker and report where to click for real
  const ti = [...document.querySelectorAll('input')].find(i => /^\d\d:\d\d$/.test(i.value)); ti.scrollIntoView({ block: 'center' }); await w(400); ti.click(); await w(900);
  const [hh, mm] = (o.time || '15:00').split(':');
  const h = [...document.querySelectorAll('.tiktok-timepicker-left')].find(e => e.offsetParent && e.innerText.trim() === hh); h?.scrollIntoView({ block: 'nearest' });
  const m = [...document.querySelectorAll('.tiktok-timepicker-right')].find(e => e.offsetParent && e.innerText.trim() === mm); m?.scrollIntoView({ block: 'nearest' }); await w(300);
  const pt = e => { const r = e.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; };
  return { caption: document.querySelector('.public-DraftEditor-content').innerText.trim().slice(0, 60),
           date: [...document.querySelectorAll('input')].find(i => /^20\d\d-/.test(i.value))?.value,
           ai: sw.getAttribute('aria-checked') ?? sw.checked, clicks: h && m ? [pt(h), pt(m)] : null, viewport: innerWidth };
};
window.cvTTSubmit = async (o) => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  document.body.click(); await w(600);
  const vals = [...document.querySelectorAll('input')].map(i => i.value).filter(v => /^\d\d:\d\d$|^20\d\d-/.test(v));
  const cap = document.querySelector('.public-DraftEditor-content')?.innerText || '';
  if (!vals.includes(o.date) || !vals.includes(o.time) || !cap.startsWith(o.captionStart)) return { error: 'check failed', vals, cap: cap.slice(0, 60) };
  [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Schedule').click(); await w(8000);
  return { url: location.href, listed: document.body.innerText.includes(o.captionStart) };
};
'cvTT loaded';
