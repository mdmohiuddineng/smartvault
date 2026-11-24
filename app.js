/* SmartVault - Phase 1: UI shell + dashboard (SAMPLE DATA ONLY, no storage yet) */
const $ = (s, r = document) => r.querySelector(s);
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const NAV = [['home','Home','i-home'],['docs','Documents','i-folder'],['money','Expenses','i-chart'],['alerts','Reminders','i-bell'],['settings','Settings','i-gear']];
const PHASE = {docs:'Phase 2',money:'Phase 6',alerts:'Phase 7'};
const COL = {Electricity:'#F79009',Medical:'#F04438',Internet:'#3B6CFF',Shopping:'#7A5AF8',Insurance:'#12B76A'};

/* Sample data - replaced by IndexedDB in Phase 2 */
const S = {
  months:[['Jun',8200],['Jul',9100],['Aug',7600],['Sep',10400],['Oct',8900],['Nov',6400]],
  cats:[['Electricity',2100],['Internet',1200],['Medical',1850],['Shopping',900],['Insurance',350]],
  docs:[['Electricity_TSSPDCL_November_2026','Electricity',2100,'Pending'],['Internet_ACT_November_2026','Internet',1200,'Paid'],['Pharmacy_Apollo_2026-11-14','Medical',1850,'Paid']],
  rem:[['Credit card payment','25 Nov',12400],['Rent','1 Dec',18000],['Vehicle insurance','9 Dec',6200]],
  warr:[['Samsung Refrigerator','Expires in 24 days','warn'],['Dell Laptop','Expires in 11 months','ok']]
};
const state = {view:'home', theme:localStorage.getItem('sv-theme') || 'auto'};

function applyTheme(){
  const dark = state.theme === 'dark' || (state.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function renderNav(){
  const html = NAV.map(([id,l,ic]) => `<button data-v="${id}" class="${state.view===id?'on':''}"><svg><use href="#${ic}"/></svg>${l}</button>`).join('');
  $('#tabNav').innerHTML = html; $('#sideNav').innerHTML = html;
}

function chart(){
  const max = Math.max(...S.months.map(m => m[1]));
  return `<div class="chart">${S.months.map((m,i) => `<div class="bar ${i===S.months.length-1?'cur':''}"><i style="height:${m[1]/max*100}%"></i><span>${m[0]}</span></div>`).join('')}</div>`;
}

function donut(){
  const tot = S.cats.reduce((a,c) => a + c[1], 0); let off = 0; const R = 42, C = 2*Math.PI*R;
  const arcs = S.cats.map(c => { const l = c[1]/tot*C; const a = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${COL[c[0]]}" stroke-width="16" stroke-dasharray="${l} ${C-l}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += l; return a; }).join('');
  return `<div class="donutw"><svg viewBox="0 0 120 120">${arcs}</svg><div class="leg">${S.cats.map(c => `<div><i style="background:${COL[c[0]]}"></i>${c[0]}<em>${inr(c[1])}</em></div>`).join('')}</div></div>`;
}

function home(){
  const paid = 3250, pend = 2100;
  return `<div class="view">
  <div class="top"><div><h1>Welcome back</h1><p>Your Personal Digital Locker</p></div><div class="avatar">M</div></div>
  <div class="banner">Showing sample data. Your real documents appear after Phases 2 to 4.</div>
  <div class="hero"><small>Spent this month</small><div class="amt">${inr(S.months.at(-1)[1])}</div>
    <div class="row"><div class="pill">Paid<b>${inr(paid)}</b></div><div class="pill">Pending<b>${inr(pend)}</b></div></div></div>
  <div class="grid">
    <div class="card stat"><b>48</b><span>Total documents</span></div>
    <div class="card stat"><b>21</b><span>Bills uploaded</span></div>
    <div class="card stat"><b style="color:var(--warn)">3</b><span>Pending bills</span></div>
    <div class="card stat"><b style="color:var(--ok)">18</b><span>Paid bills</span></div></div>
  <div class="card sync"><div class="ic"><svg><use href="#i-cloud"/></svg></div><div><b>Google Drive</b><small>Not connected (Phase 3 and 4)</small></div><button class="btn ghost" disabled style="opacity:.5">Connect</button></div>
  <div class="card"><h2>Monthly spending</h2>${chart()}</div>
  <div class="card"><h2>By category</h2>${donut()}</div>
  <div class="card"><h2>Upcoming reminders</h2>${S.rem.map(r => `<div class="li"><div class="ic" style="background:var(--accent)"><svg width="20" height="20"><use href="#i-bell"/></svg></div><div class="m"><b>${r[0]}</b><small>${r[1]}</small></div><b>${inr(r[2])}</b></div>`).join('')}</div>
  <div class="card"><h2>Expiring warranties</h2>${S.warr.map(w => `<div class="li"><div class="m"><b>${w[0]}</b><small>${w[1]}</small></div><span class="tag t-${w[2]}">${w[2]==='warn'?'Soon':'Active'}</span></div>`).join('')}</div>
  <div class="card"><h2>Recently uploaded</h2>${S.docs.map(d => `<div class="li"><div class="ic" style="background:${COL[d[1]]}">PDF</div><div class="m"><b>${d[0]}</b><small>${d[1]} · ${inr(d[2])}</small></div><span class="tag ${d[3]==='Paid'?'t-ok':'t-warn'}">${d[3]}</span></div>`).join('')}</div>
  </div>`;
}

function settings(){
  const t = state.theme;
  return `<div class="view"><div class="top"><h1>Settings</h1></div>
  <div class="card"><div class="set"><span>Theme</span><div class="seg">${['auto','light','dark'].map(x => `<button data-theme="${x}" class="${t===x?'on':''}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div>
  <div class="set"><span>Google account</span><small style="color:var(--mut)">Phase 3</small></div>
  <div class="set"><span>PIN lock</span><small style="color:var(--mut)">Phase 8</small></div>
  <div class="set"><span>Backup and restore</span><small style="color:var(--mut)">Phase 8</small></div>
  <div class="set"><span>About</span><small style="color:var(--mut)">SmartVault 0.1 (Phase 1)</small></div></div></div>`;
}

function placeholder(id){
  const n = NAV.find(x => x[0] === id);
  return `<div class="view"><div class="top"><h1>${n[1]}</h1></div><div class="card empty"><div class="big"><svg><use href="#${n[2]}"/></svg></div><h3>Nothing here yet</h3><p>This section is built in ${PHASE[id]}.</p></div></div>`;
}

function render(){
  $('#view').innerHTML = state.view === 'home' ? home() : state.view === 'settings' ? settings() : placeholder(state.view);
  renderNav(); window.scrollTo(0,0);
}

function sheet(on){
  $('#sheet').classList.toggle('on', on); $('#scrim').classList.toggle('on', on);
  if (!on) $('#sheetNote').textContent = '';
}

document.addEventListener('click', e => {
  const v = e.target.closest('[data-v]'); if (v) { state.view = v.dataset.v; render(); }
  const t = e.target.closest('[data-theme]'); if (t) { state.theme = t.dataset.theme; localStorage.setItem('sv-theme', state.theme); applyTheme(); render(); }
  if (e.target.closest('#fab')) sheet(true);
  if (e.target.id === 'scrim') sheet(false);
  if (e.target.closest('[data-up]')) $('#sheetNote').textContent = 'Uploading is built in Phase 2. Nothing is saved yet.';
});

applyTheme(); render();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
