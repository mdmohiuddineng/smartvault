/* SmartVault - Batch 3: reminders, warranties, PIN lock (+ optional Face ID), notifications, export */
const R = () => state.rem || [], W = () => state.war || [];
const RCATS = ['Electricity bill','Water bill','Internet bill','Credit card','Insurance premium','Rent','Loan payment','Vehicle insurance','Custom'];
const REC = ['Does not repeat','Weekly','Monthly','Every 3 months','Yearly'];
let b3 = {};
const loadExtra = async () => { state.rem = await tx('rem','readonly',s => s.getAll()); state.war = await tx('war','readonly',s => s.getAll()); };
function addMonths(s, n){ const d = dt(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return ymd(d); }
function addRec(s, r){ if (r === 'Weekly') return ymd(new Date(dt(s).getTime() + 7 * 864e5)); return addMonths(s, r === 'Monthly' ? 1 : r === 'Every 3 months' ? 3 : 12); }
const wstat = w => w.expiry < today() ? 'expired' : w.expiry <= ymd(new Date(Date.now() + 60 * 864e5)) ? 'soon' : 'active';
const kv2 = (a, b) => b ? `<div class="kv"><span>${a}</span><b>${esc(b)}</b></div>` : '';
const rItem = r => { const t = today(), s = r.done ? ['Done','t-ok'] : r.date < t ? ['Overdue','t-bad'] : r.date === t ? ['Today','t-warn'] : null; return `<button class="li" data-rem="${r.id}"><div class="ic" style="background:var(--accent)"><svg width="20" height="20"><use href="#i-bell"/></svg></div><div class="m"><b>${esc(r.title)}</b><small>${esc(r.date)}${r.amount ? ' · ' + inr(r.amount) : ''}${r.rec !== REC[0] ? ' · ' + esc(r.rec) : ''}</small></div>${s ? `<span class="tag ${s[1]}">${s[0]}</span>` : ''}</button>`; };
const wItem = w => `<button class="li" data-war="${w.id}"><div class="m"><b>${esc(w.product)}</b><small>Expires ${esc(w.expiry)}${w.shop ? ' · ' + esc(w.shop) : ''}</small></div><span class="tag ${{active:'t-ok',soon:'t-warn',expired:'t-bad'}[wstat(w)]}">${{active:'Active',soon:'Soon',expired:'Expired'}[wstat(w)]}</span></button>`;

function dueCards(){
  const t = today(), up = R().filter(r => !r.done).sort((a,b) => a.date.localeCompare(b.date)), over = up.filter(r => r.date < t), td = up.filter(r => r.date === t), soon = W().filter(w => wstat(w) === 'soon');
  let h = '';
  if (over.length || td.length) h += `<div class="banner" style="background:rgba(240,68,56,.12);color:var(--bad)">${over.length ? over.length + ' overdue' : ''}${over.length && td.length ? ' and ' : ''}${td.length ? td.length + ' due today' : ''}. <a href="#" data-v="alerts" style="color:inherit;font-weight:700">View</a></div>`;
  if (up.length) h += `<div class="card"><h2>Upcoming reminders<a href="#" data-v="alerts">See all</a></h2>${up.slice(0,3).map(rItem).join('')}</div>`;
  if (soon.length) h += `<div class="card"><h2>Expiring warranties</h2>${soon.slice(0,3).map(wItem).join('')}</div>`;
  return h;
}
function alertsView(){
  const tab = state.altab || 'rem', empty = (ic, h, p) => `<div class="card empty"><div class="big"><svg><use href="#${ic}"/></svg></div><h3>${h}</h3><p>${p}</p></div>`;
  let body;
  if (tab === 'rem') {
    const up = R().filter(r => !r.done).sort((a,b) => a.date.localeCompare(b.date)), dn = R().filter(r => r.done).sort((a,b) => b.updated - a.updated).slice(0,5);
    body = `<button class="btn" data-b3="add-rem" style="width:100%;margin:0 0 14px">+ Add reminder</button>${up.length ? `<div class="card">${up.map(rItem).join('')}</div>` : empty('i-bell','No reminders','Add bills, rent, premiums and EMIs.')}${dn.length ? `<div class="card"><h2>Completed</h2>${dn.map(rItem).join('')}</div>` : ''}<p class="note">Reminders appear on your Home screen. An iPhone Home Screen web app cannot send alerts while closed, so open SmartVault to see them.</p>`;
  } else {
    const g = (k, l) => { const a = W().filter(w => wstat(w) === k).sort((x,y) => x.expiry.localeCompare(y.expiry)); return a.length ? `<div class="card"><h2>${l}</h2>${a.map(wItem).join('')}</div>` : ''; };
    body = `<button class="btn" data-b3="add-war" style="width:100%;margin:0 0 14px">+ Add warranty</button>${W().length ? g('soon','Expiring soon') + g('active','Active') + g('expired','Expired') : empty('i-folder','No warranties','Track products, expiry dates and bills.')}`;
  }
  return `<div class="view"><div class="top"><h1>${tab === 'rem' ? 'Reminders' : 'Warranties'}</h1></div><div class="seg" style="margin-bottom:12px">${[['rem','Reminders'],['war','Warranties']].map(([k,l]) => `<button data-b3="tab-${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>${body}</div>`;
}
const hdr = (t, s) => `<div class="ovh"><button data-b3="close">Cancel</button><b>${t}</b><button data-b3="${s}">Save</button></div>`;
const num = (id, v) => inp(id, v || '', 'number', 'inputmode="decimal" min="0" step="0.01"');
function remForm(r){
  const x = r || {id:crypto.randomUUID(), title:'', category:RCATS[0], amount:0, date:today(), rec:REC[0], notes:'', done:false}; b3 = {r:x};
  ov(`${hdr((r ? 'Edit' : 'New') + ' reminder', 'rsave')}<div class="ovb">${fld('Title','rtitle',inp('rtitle',x.title,'text','maxlength="80"'))}${fld('Type','rcat',sel('rcat',RCATS,x.category))}<div class="r2">${fld('Amount (₹)','ramt',num('ramt',x.amount))}${fld('Date','rdate',inp('rdate',x.date,'date'))}</div>${fld('Repeats','rrec',sel('rrec',REC,x.rec))}${fld('Notes','rnotes',`<textarea id="f-rnotes" rows="3" maxlength="300">${esc(x.notes)}</textarea>`)}</div>`);
}
async function remSave(){
  const v = id => $('#f-' + id).value.trim(), amt = parseFloat(v('ramt') || '0');
  if (!v('rtitle')) return toast('Enter a title'); if (!v('rdate')) return toast('Choose a date'); if (!(amt >= 0 && amt < 1e9)) return toast('Enter a valid amount');
  await tx('rem','readwrite',s => s.put({...b3.r, title:v('rtitle'), category:v('rcat'), amount:amt, date:v('rdate'), rec:v('rrec'), notes:v('rnotes'), updated:Date.now()}));
  await loadExtra(); closeOv(); render(); syncSoon(); toast('Reminder saved');
}
function remDetail(id){
  const r = R().find(x => x.id === id); if (!r) return; b3 = {r};
  ov(`<div class="ovh"><button data-b3="close">Close</button><b>Reminder</b><span style="width:50px"></span></div><div class="ovb"><div class="card">${kv2('Title',r.title)}${kv2('Type',r.category)}${kv2('Amount',r.amount ? inr(r.amount) : '')}${kv2('Date',r.date)}${kv2('Repeats',r.rec)}${kv2('Notes',r.notes)}${kv2('Status',r.done ? 'Completed' : 'Pending')}</div><div class="acts">${r.done ? '' : `<button class="btn" data-b3="rdone">${r.rec !== REC[0] ? 'Done, next on ' + addRec(r.date, r.rec) : 'Mark done'}</button>`}<button class="btn ghost" data-b3="redit">Edit</button><button class="btn red" data-b3="rdel">Delete</button></div></div>`);
}
function warForm(w){
  const x = w || {id:crypto.randomUUID(), product:'', shop:'', purchaseDate:today(), amount:0, months:12, serial:'', billId:'', notes:''}; b3 = {w:x};
  const bills = state.docs.slice(0, 100).map(d => `<option value="${d.id}"${d.id === x.billId ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
  ov(`${hdr((w ? 'Edit' : 'New') + ' warranty', 'wsave')}<div class="ovb">${fld('Product name','wprod',inp('wprod',x.product,'text','maxlength="80"'))}${fld('Shop','wshop',inp('wshop',x.shop,'text','maxlength="80"'))}<div class="r2">${fld('Purchase date','wdate',inp('wdate',x.purchaseDate,'date'))}${fld('Price (₹)','wamt',num('wamt',x.amount))}</div><div class="r2">${fld('Warranty (months)','wmon',inp('wmon',x.months,'number','inputmode="numeric" min="1" max="240"'))}${fld('Serial number','wser',inp('wser',x.serial,'text','maxlength="60"'))}</div>${fld('Product bill','wbill',`<select id="f-wbill"><option value="">None</option>${bills}</select>`)}${fld('Notes','wnotes',`<textarea id="f-wnotes" rows="2" maxlength="300">${esc(x.notes)}</textarea>`)}</div>`);
}
async function warSave(){
  const v = id => $('#f-' + id).value.trim(), amt = parseFloat(v('wamt') || '0'), mon = parseInt(v('wmon'), 10);
  if (!v('wprod')) return toast('Enter the product name'); if (!v('wdate')) return toast('Choose the purchase date'); if (!(mon >= 1 && mon <= 240)) return toast('Warranty must be 1 to 240 months'); if (!(amt >= 0 && amt < 1e9)) return toast('Enter a valid price');
  await tx('war','readwrite',s => s.put({...b3.w, product:v('wprod'), shop:v('wshop'), purchaseDate:v('wdate'), amount:amt, months:mon, expiry:addMonths(v('wdate'), mon), serial:v('wser'), billId:v('wbill'), notes:v('wnotes'), updated:Date.now()}));
  await loadExtra(); closeOv(); render(); syncSoon(); toast('Warranty saved');
}
function warDetail(id){
  const w = W().find(x => x.id === id); if (!w) return; b3 = {w};
  ov(`<div class="ovh"><button data-b3="close">Close</button><b>Warranty</b><span style="width:50px"></span></div><div class="ovb"><div class="card">${kv2('Product',w.product)}${kv2('Shop',w.shop)}${kv2('Purchased',w.purchaseDate)}${kv2('Price',w.amount ? inr(w.amount) : '')}${kv2('Warranty',w.months + ' months')}${kv2('Expires',w.expiry + ' (' + wstat(w) + ')')}${kv2('Serial',w.serial)}${kv2('Notes',w.notes)}</div><div class="acts">${w.billId ? '<button class="btn" data-b3="wbillopen">Open bill</button>' : ''}<button class="btn ghost" data-b3="wedit">Edit</button><button class="btn red" data-b3="wdel">Delete</button></div></div>`);
}
async function b3Act(a){
  if (a === 'close') closeOv();
  else if (a.startsWith('tab-')) { state.altab = a.slice(4); render(); }
  else if (a === 'add-rem') remForm(); else if (a === 'add-war') warForm();
  else if (a === 'rsave') await remSave(); else if (a === 'wsave') await warSave();
  else if (a === 'redit') remForm(b3.r); else if (a === 'wedit') warForm(b3.w);
  else if (a === 'rdone') { const r = b3.r, rep = r.rec !== REC[0]; await tx('rem','readwrite',s => s.put({...r, date:rep ? addRec(r.date, r.rec) : r.date, done:!rep, updated:Date.now()})); await loadExtra(); closeOv(); render(); syncSoon(); toast(rep ? 'Done. Next reminder set.' : 'Marked done'); }
  else if (a === 'rdel' || a === 'wdel') { const isR = a === 'rdel', x = isR ? b3.r : b3.w; if (!confirm('Delete "' + (x.title || x.product) + '"?')) return; markGone(x.id); await tx(isR ? 'rem' : 'war','readwrite',s => s.delete(x.id)); await loadExtra(); closeOv(); render(); syncSoon(); }
  else if (a === 'wbillopen') { if (state.docs.find(d => d.id === b3.w.billId)) detail(b3.w.billId); else toast('That bill was deleted'); }
  else if (a === 'notif') { if (!('Notification' in window)) return toast('Not supported here'); const p = await Notification.requestPermission(); toast(p === 'granted' ? 'On. Alerts show when you open the app.' : 'Notifications not allowed'); notifyDue(); render(); }
  else if (a === 'export') { saveBlob(new Blob([JSON.stringify({app:'SmartVault', exported:new Date().toISOString(), docs:state.docs, reminders:R(), warranties:W()}, null, 1)], {type:'application/json'}), 'SmartVault_export_' + today() + '.json'); toast('Exported details. Files stay on Drive.'); }
}
async function pullExtra(b, gn){
  let n = 0;
  for (const [st, arr, rem] of [['rem', R(), b.rem || []], ['war', W(), b.war || []]]) {
    for (const r of rem) { if (gn[r.id] && gn[r.id] >= (r.updated || 0)) continue; const l = arr.find(x => x.id === r.id); if (!l || (r.updated || 0) > (l.updated || 0)) { await tx(st,'readwrite',s => s.put(r)); n++; } }
    for (const l of arr) if (gn[l.id] && gn[l.id] > (l.updated || 0)) { await tx(st,'readwrite',s => s.delete(l.id)); n++; }
  }
  return n;
}
function notifyDue(){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const k = 'sv-n-' + today(), t = today(), d = R().filter(r => !r.done && r.date <= t); if (localStorage.getItem(k) || !d.length) return; localStorage.setItem(k, '1');
  const body = d.length + ' reminder(s) due: ' + d.slice(0, 3).map(r => r.title).join(', ');
  try { navigator.serviceWorker.ready.then(r => r.showNotification('SmartVault', {body, icon:'icons/icon-192.png'})); } catch (e) { try { new Notification('SmartVault', {body}); } catch (x) {} }
}

/* ---------- PIN lock ---------- */
const lesc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hasPin = () => !!localStorage.getItem('sv-pin');
const b64 = u => btoa(String.fromCharCode(...u)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const sty = document.createElement('style');
sty.textContent = `.lock{position:fixed;inset:0;z-index:95;background:linear-gradient(160deg,#0B1F4B,#1A3A8A);color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px}.lock.on{display:flex}.lock h2{margin:0 0 6px}.lock p{margin:0 0 18px;opacity:.8;min-height:20px}.lock .dots{display:flex;gap:12px;margin-bottom:26px}.lock .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #fff}.lock .dots i.f{background:#fff}.lock .pad{display:grid;grid-template-columns:repeat(3,76px);gap:14px}.lock .pad button{height:76px;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:26px}.lock a{color:#fff;opacity:.8;margin-top:22px;text-decoration:underline}`;
document.head.appendChild(sty);
const lockEl = document.createElement('div'); lockEl.className = 'lock'; document.body.appendChild(lockEl);
const hideLock = () => { lockEl.onclick = null; lockEl.classList.remove('on'); lockEl.innerHTML = ''; };
function promptPin(title, sub, canCancel, bio){
  return new Promise(res => {
    let e = '';
    const draw = () => { lockEl.classList.add('on'); lockEl.innerHTML = `<h2>${lesc(title)}</h2><p>${lesc(sub || '')}</p><div class="dots">${[0,1,2,3,4,5].map(i => `<i class="${i < e.length ? 'f' : ''}"></i>`).join('')}</div><div class="pad">${[1,2,3,4,5,6,7,8,9,'⌫',0,'OK'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>${bio ? '<a href="#" data-k="bio">Use Face ID / Touch ID</a>' : ''}${canCancel ? '<a href="#" data-k="x">Cancel</a>' : ''}`; };
    lockEl.onclick = ev => {
      const b = ev.target.closest('[data-k]'); if (!b) return; ev.preventDefault(); const k = b.dataset.k;
      if (k === '⌫') e = e.slice(0, -1);
      else if (k === 'OK') { if (e.length < 4) return; lockEl.onclick = null; return res(e); }
      else if (k === 'x') { hideLock(); return res(null); }
      else if (k === 'bio') { lockEl.onclick = null; return res('bio'); }
      else if (e.length < 6) e += k;
      draw();
    };
    draw();
  });
}
async function pinHash(pin, salt){ const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']); return b64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:150000, hash:'SHA-256'}, k, 256))); }
async function pinOk(p){ const [s, h] = (localStorage.getItem('sv-pin') || ':').split(':'); return !!s && await pinHash(p, unb64(s)) === h; }
async function bioAuth(){ try { await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)), allowCredentials:[{type:'public-key', id:unb64(localStorage.getItem('sv-bio'))}], userVerification:'required', timeout:60000}}); return true; } catch (e) { return false; } }
let locking = false;
async function unlock(){
  if (locking) return; locking = true; let fails = +localStorage.getItem('sv-pf') || 0, msg = '';
  try { for (;;) {
    const w = (+localStorage.getItem('sv-pu') || 0) - Date.now();
    if (w > 0) { lockEl.classList.add('on'); lockEl.innerHTML = `<h2>Too many tries</h2><p>Wait ${Math.ceil(w / 1000)} seconds</p>`; await new Promise(r => setTimeout(r, w)); }
    const p = await promptPin('SmartVault is locked', msg, false, !!localStorage.getItem('sv-bio'));
    if (p === 'bio') { if (await bioAuth()) break; msg = 'Face ID failed. Enter your PIN.'; continue; }
    if (await pinOk(p)) { localStorage.setItem('sv-pf', '0'); break; }
    fails++; localStorage.setItem('sv-pf', fails); msg = 'Wrong PIN'; if (fails >= 5) localStorage.setItem('sv-pu', Date.now() + 30000 * (fails - 4));
  }
  hideLock(); }
  catch (e) { lockEl.classList.add('on'); lockEl.innerHTML = '<h2>Locked</h2><p>Please close and reopen SmartVault.</p>'; }
  finally { locking = false; }
}
async function pinFlow(a){
  if (a === 'bio') { try { const c = await navigator.credentials.create({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)), rp:{name:'SmartVault'}, user:{id:crypto.getRandomValues(new Uint8Array(16)), name:'smartvault', displayName:'SmartVault'}, pubKeyCredParams:[{type:'public-key', alg:-7}, {type:'public-key', alg:-257}], authenticatorSelection:{authenticatorAttachment:'platform', userVerification:'required'}, timeout:60000}}); localStorage.setItem('sv-bio', b64(new Uint8Array(c.rawId))); toast('Face ID / Touch ID turned on'); } catch (e) { toast('Could not turn on Face ID here'); } return render(); }
  if (a === 'biooff') { localStorage.removeItem('sv-bio'); return render(); }
  if (hasPin()) { const c = await promptPin('Enter current PIN', '', true); if (!c) return; if (!(await pinOk(c))) { hideLock(); return toast('Wrong PIN'); } }
  if (a === 'remove') { localStorage.removeItem('sv-pin'); localStorage.removeItem('sv-bio'); hideLock(); toast('PIN removed'); return render(); }
  const p1 = await promptPin('Choose a PIN', '4 to 6 digits', true); if (!p1) return;
  const p2 = await promptPin('Confirm PIN', '', true); if (!p2) return;
  if (p1 !== p2) { hideLock(); return toast('PINs did not match'); }
  const salt = crypto.getRandomValues(new Uint8Array(16)); localStorage.setItem('sv-pin', b64(salt) + ':' + await pinHash(p1, salt)); localStorage.setItem('sv-pf', '0');
  hideLock(); toast('PIN set'); render();
}
function b3Settings(){
  const pin = hasPin(), bio = !!localStorage.getItem('sv-bio'), np = 'Notification' in window ? Notification.permission : 'unsupported', m = 'style="margin:0"', mut = 'style="color:var(--mut)"';
  return `<div class="set"><span>PIN lock</span>${pin ? `<span><button class="btn ghost" data-pin="change" style="margin:0 4px 0 0">Change</button><button class="btn red" data-pin="remove" ${m}>Remove</button></span>` : `<button class="btn ghost" data-pin="set" ${m}>Set PIN</button>`}</div>
  ${pin && window.PublicKeyCredential ? `<div class="set"><span>Face ID / Touch ID</span><button class="btn ghost" data-pin="${bio ? 'biooff' : 'bio'}" ${m}>${bio ? 'Turn off' : 'Turn on'}</button></div>` : ''}
  <div class="set"><span>Reminder notifications</span>${np === 'granted' ? `<small ${mut}>On (when app opens)</small>` : np === 'unsupported' ? `<small ${mut}>Not supported</small>` : `<button class="btn ghost" data-b3="notif" ${m}>Enable</button>`}</div>
  <div class="set"><span>Export data (JSON)</span><button class="btn ghost" data-b3="export" ${m}>Export</button></div>
  <div class="note">PIN and Face ID only lock this app on this phone. Your Drive files are protected by your Google account.</div>`;
}
document.addEventListener('click', e => {
  const g = s => e.target.closest(s);
  if (g('[data-b3]')) b3Act(g('[data-b3]').dataset.b3);
  if (g('[data-rem]')) remDetail(g('[data-rem]').dataset.rem);
  if (g('[data-war]')) warDetail(g('[data-war]').dataset.war);
  if (g('[data-pin]')) pinFlow(g('[data-pin]').dataset.pin);
});
let hid = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) hid = Date.now(); else if (hasPin() && hid && Date.now() - hid > 60000) unlock(); });
if (hasPin()) unlock();
