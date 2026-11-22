// Instagram Reel poster for the built-in browser (instagram.com, logged in as @the.clearerviewvids).
// Instagram's CSP blocks every outside fetch on every instagram.com path (robots.txt too), and the native
// file picker inside the Claude app can't be driven by computer use. So, until a Facebook Page is linked
// (then schedule through Meta instead), the flow is:
//   1. Front the tab, resize_window 1300x1000, open Create (the "+" in the left rail) -> "Create new post".
//   2. SendUserMessage: ask Eddie to click "Select from computer" and pick the file from
//      Videos\The Clearer View\<episode>\shorts\ (the link-in-bio version, not the _tiktok one). Wait for his reply.
//   3. Paste this file, then:  await cvIGFinish("caption text")   -> crop Original, Next x2, caption, AI label, Share.
//   4. Close with "Done", resize_window preset desktop.
window.cvIGFinish = async (cap) => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const dlg = () => document.querySelector('[role=dialog]');
  const btn = t => [...dlg().querySelectorAll('[role=button],button')].find(e => e.innerText.trim() === t);
  const c = dlg().querySelector('svg[aria-label="Select crop"]');
  if (c) { (c.closest('button,[role=button]') || c).click(); await w(1200);
    const o = [...dlg().querySelectorAll('span,div')].find(e => e.children.length === 0 && e.innerText.trim() === 'Original');
    (o?.closest('[role=button],button') || o)?.click(); await w(1000); }
  btn('Next').click(); await w(2500); btn('Next').click(); await w(3000);
  const ed = dlg().querySelector('[contenteditable=true]'); ed.focus(); await w(300);
  const dt = new DataTransfer(); dt.setData('text/plain', cap);
  ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await w(1200);
  if (ed.innerText.trim() !== cap) { document.execCommand('selectAll'); document.execCommand('insertText', false, cap); await w(800); }
  if (ed.innerText.trim() !== cap) return 'caption failed';
  const lab = [...dlg().querySelectorAll('*')].find(e => e.children.length === 0 && e.innerText?.trim() === 'Add AI label');
  let p = lab, sw = null; for (let i = 0; i < 6 && p && !sw; i++) { p = p.parentElement; sw = p.querySelector('input[type=checkbox],[role=switch]'); }
  if (sw && !(sw.checked || sw.getAttribute('aria-checked') === 'true')) { sw.click(); await w(800); }
  btn('Share').click();
  for (let i = 0; i < 80; i++) { await w(500); const s = dlg()?.innerText || ''; if (/has been shared/i.test(s)) return 'shared'; }
  return 'still sharing: poll for "Your reel has been shared."';
};
'cvIG loaded';
