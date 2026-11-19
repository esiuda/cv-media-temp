// YouTube Studio uploader for the built-in browser. Paste this file into javascript_tool, then call the functions.
// Page: https://studio.youtube.com/channel/UC1rGMU6Sh0u4hscvvatzYBA/videos/upload?d=ud&authuser=1
// - Wait ~3 s after navigating (Studio redirects once).
// - Keep the browser pane VISIBLE and the tab fronted (tabs_select). setBox falls back to textContent+input
//   events when execCommand fails in a hidden pane, but other widgets still misbehave when hidden.
// - Never call preview_start while an upload is running: it can reuse (and navigate) the uploading tab.
// - Calls must return within ~45 s: long jobs run in the background (cvYTBatch) and you poll window.__cvLog.
//
// Long-form (stops on Visibility for Eddie):
//   window.__longURL = URL.createObjectURL(await cvFetchParts([...partUrls]))   // prefetch first (>100 MB files are split)
//   cvYTBatch([{ url: __longURL, name, title, desc, day: 22, monthLabel: 'Nov 2026', time: '8:00 AM',
//               thumbs: [urlA, urlB, urlC], clickSchedule: false }])
// Shorts (scheduled fully):
//   cvYTBatch([{ url, name, title, desc, day, monthLabel, time, clickSchedule: true }, ...])
// Then poll:  await new Promise(r=>setTimeout(r,40000)); window.__cvLog
window.__cvLog = window.__cvLog || [];
(() => {
  const L = m => window.__cvLog.push(new Date().toTimeString().slice(0, 8) + ' ' + m);
  const w = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, n = 30, ms = 500) => { for (let i = 0; i < n; i++) { const v = f(); if (v) return v; await w(ms); } return null; };
  const DONE = /Video scheduled|Video processing|will be set to public/;
  const setBox = (d, sel, v) => {
    const b = d.querySelector(sel); b.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, v);
    if (b.innerText.trim() !== v.trim()) { b.textContent = v; b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v })); }
    b.blur();
  };
  const dismiss = () => [...document.querySelectorAll('button, ytcp-button')].filter(b => b.offsetParent && /^No thanks$/i.test(b.innerText.trim())).forEach(b => b.click());
  window.cvFetchParts = async (urls) => new Blob(await Promise.all(urls.map(async u => (await fetch(u)).blob())), { type: 'video/mp4' });
  const closeShare = async () => {
    const sh = [...document.querySelectorAll('ytcp-video-share-dialog, tp-yt-paper-dialog, ytcp-dialog')].find(e => e.offsetParent && DONE.test(e.innerText));
    if (sh) { [...sh.querySelectorAll('ytcp-button, button, ytcp-icon-button')].find(b => /^Close$/i.test(b.innerText.trim()) || b.id === 'close-button' || /close/i.test(b.getAttribute('aria-label') || ''))?.click(); await w(2000); }
  };
  window.cvOpen = async () => {
    await closeShare();
    if (document.querySelector('ytcp-uploads-file-picker input[type=file]')) return true;
    document.querySelector('button[aria-label=Create]')?.click(); await w(1500);
    [...document.querySelectorAll('tp-yt-paper-item, [role=menuitem]')].find(e => e.offsetParent && e.innerText.trim() === 'Upload videos')?.click(); await w(2500);
    return !!document.querySelector('ytcp-uploads-file-picker input[type=file]');
  };
  window.cvABThumbs = async (d, urls) => {   // Details step: A/B Testing -> Thumbnail only -> up to 3 -> Set test
    [...d.querySelectorAll('ytcp-button, button')].find(x => /A\/B Testing/i.test(x.innerText))?.click(); await w(2500);
    const dlg = [...document.querySelectorAll('tp-yt-paper-dialog, ytcp-dialog')].find(e => e.offsetParent && /A\/B Testing/.test(e.innerText) && e.querySelectorAll('input[type=file]').length);
    if (!dlg) return 'no A/B dialog (channel not eligible yet?)';
    [...dlg.querySelectorAll('button, ytcp-chip, [role=tab], ytcp-button, tp-yt-paper-tab')].find(x => x.innerText.trim() === 'Thumbnail only')?.click(); await w(1500);
    const ins = [...dlg.querySelectorAll('input[type=file]')];
    for (let i = 0; i < Math.min(3, ins.length, urls.length); i++) {
      const b = await (await fetch(urls[i])).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'thumb' + i + '.png', { type: 'image/png' }));
      ins[i].files = dt.files; ins[i].dispatchEvent(new Event('change', { bubbles: true })); await w(2500);
    }
    if (!/Thumbnails ready/.test(dlg.innerText)) return 'thumbnails not ready';
    [...dlg.querySelectorAll('ytcp-button, button')].find(x => x.innerText.trim() === 'Set test').click(); await w(2500);
    return 'A/B set';
  };
  const sched = async (d, o) => {
    d.querySelector('#datepicker-trigger').click();
    const dayEl = await until(() => [...(document.querySelector('ytcp-scrollable-calendar')?.querySelectorAll('span.calendar-day') || [])].find(e => e.innerText.trim() === String(o.day) && e.closest('[aria-label]')?.getAttribute('aria-label') === o.monthLabel));
    if (!dayEl) return null; dayEl.click(); await w(900);
    const tIn = d.querySelector('#time-of-day-container input'); tIn.click();
    const want = new RegExp('^\\s*' + o.time.replace(' ', '\\s*') + '\\s*$');
    const it = await until(() => [...document.querySelectorAll('tp-yt-paper-item')].filter(e => want.test(e.innerText.replace(/[  ]/g, ' '))).at(-1));
    if (!it) return null; it.scrollIntoView({ block: 'center' }); it.click(); await w(900);
    return d.querySelector('#datepicker-trigger').innerText.trim() + ' ' + tIn.value;
  };
  window.cvYTOne = async (o) => {
    if (!await cvOpen()) { L('STOP no upload input'); return false; }
    const inp = document.querySelector('ytcp-uploads-file-picker input[type=file]');
    const blob = await (await fetch(o.url)).blob();
    const dt = new DataTransfer(); dt.items.add(new File([blob], o.name, { type: 'video/mp4' })); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    const d = await until(() => { dismiss(); const x = document.querySelector('ytcp-uploads-dialog'); const t = x?.querySelector('#title-textarea #textbox'); return t?.offsetParent && t.innerText.trim() ? x : null; }, 120);
    if (!d) { L('STOP no dialog ' + o.name); return false; }
    let ok = false;
    for (let k = 0; k < 5 && !ok; k++) { await w(k ? 2500 : 5000); dismiss(); setBox(d, '#title-textarea #textbox', o.title); if (!d.querySelector('#description-textarea #textbox').innerText.includes(o.desc.slice(0, 15))) setBox(d, '#description-textarea #textbox', o.desc); await w(1500); ok = d.querySelector('#title-textarea #textbox').innerText.trim() === o.title; }
    if (!ok) { L('STOP title ' + o.name); return false; }
    if (o.thumbs?.length) L('thumbs ' + o.name + ': ' + await cvABThumbs(d, o.thumbs));
    d.querySelector('tp-yt-paper-radio-button[name=VIDEO_MADE_FOR_KIDS_NOT_MFK]').click();
    let a = d.querySelector('tp-yt-paper-radio-button[name=VIDEO_HAS_ALTERED_CONTENT_YES]');
    if (!a?.offsetParent) { d.querySelector('#toggle-button')?.click(); a = await until(() => { const x = d.querySelector('tp-yt-paper-radio-button[name=VIDEO_HAS_ALTERED_CONTENT_YES]'); return x?.offsetParent ? x : null; }, 10); }
    a.click(); d.querySelector('tp-yt-paper-radio-button[name=VIDEO_PAID_PRODUCT_PLACEMENT_NO]')?.click(); await w(800);
    [...d.querySelectorAll('[id^=step-badge]')].at(-1).click(); await w(2000);
    (await until(() => d.querySelector('#second-container-expand-button'), 10)).click(); await w(1200);
    const when = await sched(d, o);
    const link = d.innerText.match(/https:\/\/youtu\.be\/\S+|https:\/\/youtube\.com\/shorts\/\S+/)?.[0];
    if (!when || !when.includes(o.day + ',') || !when.includes(o.time.split(' ')[0])) { L('STOP when ' + o.name + ' ' + when); return false; }
    if (!o.clickSchedule) { L('READY ' + o.name + ' | ' + when + ' | ' + link + ' (dialog left open for Eddie)'); return true; }
    d.querySelector('#done-button').click();
    const g = await until(() => [...document.querySelectorAll('ytcp-dialog, tp-yt-paper-dialog, ytcp-confirmation-dialog, ytcp-video-share-dialog')].find(e => e.offsetParent && (/still checking/i.test(e.innerText) || DONE.test(e.innerText))), 30);
    if (g && /still checking/i.test(g.innerText)) [...g.querySelectorAll('ytcp-button, button')].find(b => b.innerText.trim() === 'Got it')?.click();
    const sh = await until(() => [...document.querySelectorAll('ytcp-video-share-dialog, tp-yt-paper-dialog, ytcp-dialog')].find(e => e.offsetParent && DONE.test(e.innerText)), 30);
    L((sh ? 'OK ' : '?? ') + o.name + ' | ' + when + ' | ' + (link || ''));
    return !!sh;
  };
  window.cvYTBatch = (jobs) => { window.__cvRun = (async () => { for (const o of jobs) { try { if (!await cvYTOne(o)) break; } catch (e) { L('ERR ' + o.name + ' ' + e.message); break; } } L('DONE'); })(); return 'started ' + jobs.length; };
  // Eddie approved by message: click Schedule in the long-form dialog that was left open.
  window.cvYTApprove = async () => {
    const d = document.querySelector('ytcp-uploads-dialog'); if (!d?.offsetParent) return 'no open dialog';
    d.querySelector('#done-button').click();
    const g = await until(() => [...document.querySelectorAll('ytcp-dialog, tp-yt-paper-dialog, ytcp-confirmation-dialog, ytcp-video-share-dialog')].find(e => e.offsetParent && (/still checking/i.test(e.innerText) || DONE.test(e.innerText))), 30);
    if (g && /still checking/i.test(g.innerText)) [...g.querySelectorAll('ytcp-button, button')].find(b => b.innerText.trim() === 'Got it')?.click();
    const sh = await until(() => [...document.querySelectorAll('ytcp-video-share-dialog, tp-yt-paper-dialog, ytcp-dialog')].find(e => e.offsetParent && DONE.test(e.innerText)), 30);
    if (sh) return sh.innerText.match(/public on [^\n]*/)?.[0] || 'scheduled';
    // In a hidden pane the share popup may never show (Nov 16): the button goes disabled instead.
    // Confirm in the content list: the row's visibility cell should read "Scheduled".
    return d.querySelector('#done-button')?.hasAttribute('disabled') ? 'submitted: confirm the row says Scheduled in the content list' : 'not confirmed';
  };
})();
'cvYT loaded';
