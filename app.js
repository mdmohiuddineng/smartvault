/* SmartVault - Phase 2: documents saved on THIS device (IndexedDB). Google Drive comes in Phases 3-4. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const CATS = ['Electricity','Water','Internet','Shopping','Medical','Insurance','Credit Cards','Bank Statements','Vehicle Documents','Home Documents','Warranties','Personal Documents','Family Documents','Other'];
const MEM = ['Myself','Wife','Parents','Family'];
const NAV = [['home','Home','i-home'],['docs','Documents','i-folder'],['money','Expenses','i-chart'],['alerts','Reminders','i-bell'],['settings','Settings','i-gear']];
const PHASE = {money:'Phase 6',alerts:'Phase 7'};
const colorOf = c => `hsl(${(Math.max(0, CATS.indexOf(c)) * 47) % 360} 65% 50%)`;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const mkey = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
const state = {view:'home', theme:localStorage.getItem('sv-theme') || 'auto', docs:[], persisted:null};
let db, cur = {}, queue = [];

/* ---------- IndexedDB ---------- */
const openDB = () => new Promise((res, rej) => {
  const r = indexedDB.open('smartvault', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('docs', {keyPath:'id'}); r.result.createObjectStore('files', {keyPath:'id'}); };
  r.onsuccess = () => { db = r.result; res(); }; r.onerror = () => rej(r.error);
});
const tx = (st, mode, f) => new Promise((res, rej) => {
  const t = db.transaction(st, mode); const q = f(t.objectStore(st));
  t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
});
const load = async () => { state.docs = (await tx('docs','readonly',s => s.getAll())).sort((a,b) => b.created - a.created); };
async function sha(f){ const b = await crypto.subtle.digest('SHA-256', await f.arrayBuffer()); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }

/* ---------- helpers ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
function applyTheme(){ const dark = state.theme === 'dark' || (state.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }
function genName(d){ const dt = d.billDate ? new Date(d.billDate + 'T00:00:00') : new Date(); return [d.category.replace(/\s+/g,''), (d.vendor || '').replace(/[^\w]+/g,''), dt.toLocaleString('en',{month:'long'}), dt.getFullYear()].filter(Boolean).join('_'); }
const kind = d => d.mime === 'application/pdf' ? 'PDF' : d.mime?.startsWith('image/') ? 'IMG' : 'DOC';
const sum = a => a.reduce((t,d) => t + d.amount, 0);

/* ---------- views ---------- */
function renderNav(){ const h = NAV.map(([id,l,ic]) => `<button data-v="${id}" class="${state.view===id?'on':''}"><svg><use href="#${ic}"/></svg>${l}</button>`).join(''); $('#tabNav').innerHTML = h; $('#sideNav').innerHTML = h; }
const item = d => `<button class="li" data-open="${d.id}"><div class="ic" style="background:${colorOf(d.category)}">${kind(d)}</div><div class="m"><b>${esc(d.name)}</b><small>${esc(d.category)}${d.amount ? ' · ' + inr(d.amount) : ''}</small></div>${d.amount ? `<span class="tag ${d.status==='Paid'?'t-ok':'t-warn'}">${esc(d.status)}</span>` : ''}</button>`;

function home(){
  const D = state.docs, bills = D.filter(d => d.amount > 0), k = mkey(new Date());
  const mon = bills.filter(d => (d.billDate||'').startsWith(k));
  const months = [...Array(6)].map((_,i) => { const t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - 5 + i); return [t.toLocaleString('en',{month:'short'}), sum(bills.filter(d => (d.billDate||'').startsWith(mkey(t))))]; });
  const max = Math.max(1, ...months.map(m => m[1]));
  const cats = CATS.map(c => [c, sum(bills.filter(d => d.category === c))]).filter(c => c[1] > 0);
  const tot = sum(bills) || 1; let off = 0; const R = 42, C = 2*Math.PI*R;
  const arcs = cats.map(c => { const l = c[1]/tot*C; const a = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${colorOf(c[0])}" stroke-width="16" stroke-dasharray="${l} ${C-l}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += l; return a; }).join('');
  const body = D.length ? `
   <div class="card"><h2>Monthly spending</h2><div class="chart">${months.map((m,i) => `<div class="bar ${i===5?'cur':''}"><i style="height:${m[1]/max*100}%"></i><span>${m[0]}</span></div>`).join('')}</div></div>
   ${cats.length ? `<div class="card"><h2>By category</h2><div class="donutw"><svg viewBox="0 0 120 120">${arcs}</svg><div class="leg">${cats.map(c => `<div><i style="background:${colorOf(c[0])}"></i>${esc(c[0])}<em>${inr(c[1])}</em></div>`).join('')}</div></div></div>` : ''}
   <div class="card"><h2>Recently added<a href="#" data-v="docs">See all</a></h2>${D.slice(0,5).map(item).join('')}</div>`
   : `<div class="card empty"><div class="big"><svg><use href="#i-folder"/></svg></div><h3>No documents yet</h3><p>Tap the + button to add your first bill or document.</p></div>`;
  return `<div class="view"><div class="top"><div><h1>Welcome back</h1><p>Your Personal Digital Locker</p></div><div class="avatar">${initial()}</div></div>
  <div class="hero"><small>Spent this month</small><div class="amt">${inr(sum(mon))}</div><div class="row"><div class="pill">Paid<b>${inr(sum(mon.filter(d => d.status==='Paid')))}</b></div><div class="pill">Pending<b>${inr(sum(mon.filter(d => d.status!=='Paid')))}</b></div></div></div>
  <div class="grid"><div class="card stat"><b>${D.length}</b><span>Total documents</span></div><div class="card stat"><b>${bills.length}</b><span>Bills added</span></div>
  <div class="card stat"><b style="color:var(--warn)">${bills.filter(d => d.status!=='Paid').length}</b><span>Pending bills</span></div><div class="card stat"><b style="color:var(--ok)">${bills.filter(d => d.status==='Paid').length}</b><span>Paid bills</span></div></div>
  ${syncCard()}${body}</div>`;
}

function docsView(){
  return `<div class="view"><div class="top"><h1>Documents</h1></div><div class="search"><input id="q" placeholder="Search name, vendor, tag, invoice" autocomplete="off"><select id="cf"><option value="">All</option>${CATS.map(c => `<option>${esc(c)}</option>`).join('')}</select></div><div class="card" id="list"></div></div>`;
}
function fillList(){
  const q = ($('#q')?.value || '').toLowerCase(), c = $('#cf')?.value || '';
  const r = state.docs.filter(d => (!c || d.category === c) && (!q || [d.name,d.vendor,d.invoice,d.notes,d.category,(d.tags||[]).join(' '),String(d.amount)].join(' ').toLowerCase().includes(q)));
  $('#list').innerHTML = r.length ? r.map(item).join('') : `<div class="empty"><div class="big"><svg><use href="#i-folder"/></svg></div><h3>${state.docs.length ? 'No matches' : 'No documents yet'}</h3><p>${state.docs.length ? 'Try a different search.' : 'Tap + to add one.'}</p></div>`;
}

function settings(){
  const t = state.theme, p = state.persisted;
  return `<div class="view"><div class="top"><h1>Settings</h1></div><div class="card">
  <div class="set"><span>Theme</span><div class="seg">${['auto','light','dark'].map(x => `<button data-theme="${x}" class="${t===x?'on':''}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div>
  <div class="set"><span>Stored on this device</span><small style="color:var(--mut)">${state.docs.length} documents</small></div>
  <div class="set"><span>Storage protection</span><small style="color:var(--mut)">${p === null ? 'Unknown' : p ? 'Protected' : 'Not guaranteed. iOS can clear it.'}</small></div>
  ${acctRows()}
  <div class="set"><span>PIN lock and backup</span><small style="color:var(--mut)">Phase 8</small></div>
  <div class="set"><span>About</span><small style="color:var(--mut)">SmartVault 0.3 (Phase 3)</small></div></div></div>`;
}
const placeholder = id => { const n = NAV.find(x => x[0] === id); return `<div class="view"><div class="top"><h1>${n[1]}</h1></div><div class="card empty"><div class="big"><svg><use href="#${n[2]}"/></svg></div><h3>Nothing here yet</h3><p>This section is built in ${PHASE[id]}.</p></div></div>`; };

function render(){
  $('#view').innerHTML = state.view === 'home' ? home() : state.view === 'docs' ? docsView() : state.view === 'settings' ? settings() : placeholder(state.view);
  if (state.view === 'docs') fillList();
  renderNav(); window.scrollTo(0,0);
}

/* ---------- overlay: form + detail ---------- */
const ov = h => { $('#ov').innerHTML = h; $('#ov').classList.add('on'); $('#ov').scrollTop = 0; };
function closeOv(){ $('#ov').classList.remove('on'); $('#ov').innerHTML = ''; if (cur.url) URL.revokeObjectURL(cur.url); cur = {}; }
const fld = (l,id,h) => `<div class="fld"><label for="f-${id}">${l}</label>${h}</div>`;
const inp = (id,v,t='text',x='') => `<input id="f-${id}" type="${t}" value="${esc(v)}" ${x}>`;
const sel = (id,a,v) => `<select id="f-${id}">${a.map(x => `<option${x===v?' selected':''}>${esc(x)}</option>`).join('')}</select>`;

function form(d, q){
  const r = d || {id:crypto.randomUUID(), category:'Other', status:'Unpaid', member:'Myself', billDate:today(), created:Date.now(), amount:0, tags:[], vendor:'', invoice:'', dueDate:'', notes:''};
  const dup = q && state.docs.find(x => x.hash === q.hash);
  cur = {r, q, auto:!d};
  ov(`<div class="ovh"><button data-act="cancel">Cancel</button><b>${d ? 'Edit' : 'New'} document</b><button data-act="save">Save</button></div><div class="ovb">
  ${dup ? `<div class="banner">Looks like a duplicate of "${esc(dup.name)}". You can still save it.</div>` : ''}
  ${q ? `<div class="fl">${esc(q.f.name)} · ${Math.round(q.f.size/1024)} KB${queue.length ? ' · ' + queue.length + ' more waiting' : ''}</div>` : ''}
  ${fld('Document name','name',inp('name', r.name || genName(r), 'text', 'maxlength="120"'))}
  ${fld('Category','category',sel('category',CATS,r.category))}
  ${fld('Vendor','vendor',inp('vendor',r.vendor,'text','maxlength="80"'))}
  <div class="r2">${fld('Invoice number','invoice',inp('invoice',r.invoice,'text','maxlength="60"'))}${fld('Amount (₹)','amount',inp('amount',r.amount || '','number','inputmode="decimal" min="0" step="0.01"'))}</div>
  <div class="r2">${fld('Bill date','billDate',inp('billDate',r.billDate,'date'))}${fld('Due date','dueDate',inp('dueDate',r.dueDate,'date'))}</div>
  <div class="r2">${fld('Payment status','status',sel('status',['Unpaid','Paid','Partial'],r.status))}${fld('Family member','member',sel('member',MEM,r.member))}</div>
  ${fld('Tags (comma separated)','tags',inp('tags',(r.tags||[]).join(', ')))}
  ${fld('Notes','notes',`<textarea id="f-notes" rows="3" maxlength="500">${esc(r.notes)}</textarea>`)}</div>`);
}

async function save(){
  const v = id => $('#f-' + id).value.trim(), {r, q} = cur, amount = parseFloat(v('amount') || '0');
  if (!v('name')) return toast('Enter a document name');
  if (!(amount >= 0 && amount < 1e9)) return toast('Enter a valid amount');
  const rec = {...r, name:v('name').replace(/[\\/:*?"<>|]/g,'_'), category:v('category'), vendor:v('vendor'), invoice:v('invoice'), amount, billDate:v('billDate'), dueDate:v('dueDate'), status:v('status'), member:v('member'), tags:v('tags').split(',').map(t => t.trim()).filter(Boolean).slice(0,10), notes:v('notes'), updated:Date.now(), driveId:r.driveId || null};
  try {
    if (q) { await tx('files','readwrite',s => s.put({id:rec.id, blob:q.f})); Object.assign(rec, {hash:q.hash, mime:q.f.type, size:q.f.size, fileName:q.f.name}); }
    await tx('docs','readwrite',s => s.put(rec));
  } catch (e) { return toast('Could not save. Storage may be full.'); }
  if (navigator.storage?.persist) navigator.storage.persist().then(p => state.persisted = p);
  await load(); toast('Saved on this device');
  if (q) next(); else { closeOv(); render(); }
}
async function pick(files){ for (const f of files) queue.push({f, hash:await sha(f)}); next(); }
function next(){ const q = queue.shift(); if (q) form(null, q); else { closeOv(); render(); } }

async function detail(id){
  const d = state.docs.find(x => x.id === id); if (!d) return;
  const f = await tx('files','readonly',s => s.get(id)), url = f?.blob ? URL.createObjectURL(f.blob) : '';
  cur = {d, url};
  const pv = !url ? '' : d.mime?.startsWith('image/') ? `<img class="pv" src="${url}" alt="">` : `<div class="pv pdf">PDF file</div>`;
  const kv = (a,b) => b ? `<div class="kv"><span>${a}</span><b>${esc(b)}</b></div>` : '';
  ov(`<div class="ovh"><button data-act="close">Close</button><b>Details</b><span style="width:50px"></span></div><div class="ovb">${pv}<div class="card">
  ${kv('Name',d.name)}${kv('Category',d.category)}${kv('Vendor',d.vendor)}${kv('Invoice',d.invoice)}${kv('Amount',d.amount ? inr(d.amount) : '')}${kv('Bill date',d.billDate)}${kv('Due date',d.dueDate)}${kv('Status',d.amount ? d.status : '')}${kv('Member',d.member)}${kv('Tags',(d.tags||[]).join(', '))}${kv('Notes',d.notes)}${kv('Storage','This device only')}</div>
  <div class="acts">${url ? `<a class="btn" href="${url}" target="_blank" rel="noopener">Open</a><button class="btn ghost" data-act="dl">Download</button>` : ''}
  <button class="btn ghost" data-act="edit">Edit</button>${d.amount ? `<button class="btn ghost" data-act="paid">Mark ${d.status==='Paid' ? 'unpaid' : 'paid'}</button>` : ''}<button class="btn red" data-act="del">Delete</button></div></div>`);
}

async function act(a){
  const d = cur.d;
  if (a === 'close') { closeOv(); }
  else if (a === 'cancel') { if (queue.length && !confirm('Discard the remaining ' + queue.length + ' selected file(s) too?')) return next(); queue = []; closeOv(); }
  else if (a === 'save') await save();
  else if (a === 'edit') { const x = d; closeOv(); form(x, null); }
  else if (a === 'paid') { await tx('docs','readwrite',s => s.put({...d, status:d.status==='Paid' ? 'Unpaid' : 'Paid', updated:Date.now()})); await load(); closeOv(); render(); toast('Updated'); }
  else if (a === 'del') { if (!confirm('Delete "' + d.name + '" from this device? This cannot be undone.')) return; await tx('docs','readwrite',s => s.delete(d.id)); await tx('files','readwrite',s => s.delete(d.id)); await load(); closeOv(); render(); toast('Deleted'); }
  else if (a === 'dl') { const e = (d.fileName || '').match(/\.[a-z0-9]+$/i), l = document.createElement('a'); l.href = cur.url; l.download = d.name + (e ? e[0] : ''); document.body.appendChild(l); l.click(); l.remove(); }
}

/* ---------- events ---------- */
function sheet(on){ $('#sheet').classList.toggle('on', on); $('#scrim').classList.toggle('on', on); }
document.addEventListener('click', e => {
  const g = s => e.target.closest(s);
  if (g('[data-v]')) { e.preventDefault(); state.view = g('[data-v]').dataset.v; render(); }
  if (g('[data-theme]')) { state.theme = g('[data-theme]').dataset.theme; localStorage.setItem('sv-theme', state.theme); applyTheme(); render(); }
  if (g('#fab')) sheet(true);
  if (e.target.id === 'scrim') sheet(false);
  if (g('[data-up]')) { const t = g('[data-up]').dataset.up; sheet(false); if (t === 'manual') form(null, null); else $(t === 'gallery' ? '#inGal' : t === 'pdf' ? '#inPdf' : '#inCam').click(); }
  if (g('[data-open]')) detail(g('[data-open]').dataset.open);
  if (g('[data-act]')) act(g('[data-act]').dataset.act);
});
document.addEventListener('input', e => {
  if (e.target.id === 'q' || e.target.id === 'cf') fillList();
  if (e.target.id === 'f-name') cur.auto = false;
  if (cur.auto && ['f-category','f-vendor','f-billDate'].includes(e.target.id)) $('#f-name').value = genName({category:$('#f-category').value, vendor:$('#f-vendor').value.trim(), billDate:$('#f-billDate').value});
});
['inCam','inGal','inPdf'].forEach(id => $('#' + id).addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) pick(fs); }));

(async () => {
  applyTheme();
  try { await openDB(); await load(); if (navigator.storage?.persisted) state.persisted = await navigator.storage.persisted(); } catch (e) { toast('Local storage is unavailable in this browser mode.'); }
  render();
})();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
