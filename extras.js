/* SmartVault - Batch 2: photo shrinking, free OCR (Tesseract.js), bill parsing, expenses, CSV/PDF reports */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dt = s => new Date(s + 'T00:00:00');

/* ---------- photos ---------- */
async function shrink(f){
  if (!f.type.startsWith('image/') || f.size < 400000) return f;
  try {
    const b = await createImageBitmap(f), k = Math.min(1, 2000 / Math.max(b.width, b.height)), c = document.createElement('canvas');
    c.width = Math.round(b.width * k); c.height = Math.round(b.height * k); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return !blob || blob.size >= f.size ? f : new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', {type:'image/jpeg'});
  } catch (e) { return f; }
}

/* ---------- OCR (runs in the browser, free; first use downloads about 10 MB) ---------- */
const loadTess = () => window.Tesseract ? Promise.resolve() : new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s);
});
async function runOcr(file, on){
  await loadTess();
  const w = await Tesseract.createWorker('eng', 1, {logger:m => m.status === 'recognizing text' && on(Math.round(m.progress * 100))});
  try { return (await w.recognize(file)).data.text; } finally { await w.terminate(); }
}
const MON = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const DRE = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\s\-][A-Za-z]{3}[a-z]*[\s\-,]*\d{2,4}/;
function toISO(s){
  let m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/), d, mo, y;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else { m = s.match(/(\d{1,2})[\s\-]([A-Za-z]{3})[a-z]*[\s\-,]*(\d{2,4})/); if (!m || !MON[m[2].toLowerCase()]) return ''; d = +m[1]; mo = MON[m[2].toLowerCase()]; y = +m[3]; }
  if (y < 100) y += 2000;
  return (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) ? '' : y + '-' + pad(mo) + '-' + pad(d);
}
const KEYS = [['Electricity',/electric|tsspdcl|tgspdcl|bescom|discom|kwh|units consumed/],['Water',/water board|hmwssb|water bill|sewerage/],['Internet',/broadband|fiber|fibre|wifi|internet|airtel|jio|fibernet|bsnl/],['Medical',/pharmacy|hospital|clinic|diagnostic|medplus|apollo|doctor|medicine/],['Insurance',/insurance|premium|policy no/],['Credit Cards',/credit card|card statement|minimum amount due/],['Bank Statements',/account statement|bank statement|ifsc/],['Vehicle Documents',/vehicle|registration|rc book|puc|motor/],['Warranties',/warranty|serial no/],['Shopping',/amazon|flipkart|mart|supermarket|store|retail|invoice|mall/]];
function parseBill(t){
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean), low = t.toLowerCase(), out = {};
  const NUM = /(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*\.?[0-9]{0,2})/gi, num = s => { const v = parseFloat(String(s).replace(/,/g, '')); return isFinite(v) ? v : 0; };
  let best = 0;
  for (const l of lines) if (/total|amount\s*(due|payable)|net\s*pay|grand|payable|bill\s*amount/i.test(l) && !/sub\s*total|tax|gst/i.test(l)) for (const m of l.matchAll(NUM)) { const v = num(m[1]); if (v > best && v < 1e8) best = v; }
  if (!best) for (const m of t.matchAll(NUM)) { const v = num(m[1]); if (v > best && v < 1e6 && m[1].includes('.')) best = v; }
  if (best) out.amount = String(best);
  let tax = 0;
  for (const l of lines) if (/cgst|sgst|igst|vat|\bgst\b|\btax\b/i.test(l) && !/gstin|tax invoice/i.test(l)) { const a = [...l.matchAll(NUM)].map(m => m[1]).filter(s => s.includes('.')); if (a.length) tax += num(a[a.length - 1]); }
  if (tax && (!best || tax < best)) out.tax = String(Math.round(tax * 100) / 100);
  for (const l of lines) { const m = l.match(DRE); if (!m) continue; const iso = toISO(m[0]); if (!iso) continue; if (/due/i.test(l)) { if (!out.due) out.due = iso; } else if (!out.date || /bill|invoice|issue|date/i.test(l)) out.date = iso; }
  for (const l of lines) { if (/date|amount|total|due/i.test(l)) continue; const inv = l.match(/(?:invoice|bill|receipt|inv)\s*(?:no\.?|number|#)?\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\/-]*\d[A-Z0-9\/-]*)/i); if (inv) { out.invoice = inv[1].slice(0, 40); break; } }
  for (const l of lines.slice(0, 8)) { const letters = (l.match(/[A-Za-z]/g) || []).length; if (letters >= 4 && letters > l.length / 2 && !/invoice|receipt|bill|tax|gst|date|total|customer|phone|tel|original/i.test(l)) { out.vendor = l.replace(/[^\w &.\-]/g, '').trim().slice(0, 60); break; } }
  for (const [c, re] of KEYS) if (re.test(low)) { out.cat = c; break; }
  return out;
}
async function autoFill(q){
  const box = document.createElement('div'); box.className = 'fl'; box.textContent = 'Reading the bill... (first time downloads about 10 MB)';
  const body = $('.ovb'); if (!body) return; body.prepend(box); const rec = cur.r;
  try {
    const text = await runOcr(q.f, p => { box.textContent = 'Reading the bill... ' + p + '%'; });
    if (cur.r !== rec) return;
    const x = parseBill(text), set = (id, v) => { const e = $('#f-' + id); if (e && v && !e.value) { e.value = v; e.style.borderColor = 'var(--warn)'; } };
    cur.ocr = text.slice(0, 4000);
    set('vendor', x.vendor); set('invoice', x.invoice); set('amount', x.amount); set('tax', x.tax); set('dueDate', x.due);
    if (x.date) { $('#f-billDate').value = x.date; $('#f-billDate').style.borderColor = 'var(--warn)'; }
    if (x.cat) { $('#f-category').value = x.cat; $('#f-category').style.borderColor = 'var(--warn)'; }
    $('#f-category').dispatchEvent(new Event('input', {bubbles:true}));
    box.textContent = Object.keys(x).length ? 'Filled from the scan (orange boxes). Please check every field before saving.' : 'Could not read much from this photo. Please fill in the fields.';
  } catch (e) { box.textContent = 'Could not read the bill (internet is needed the first time). Please fill in the fields.'; }
}

/* ---------- expenses ---------- */
function ranges(){
  const x = state.exp || (state.exp = {p:'month'}), n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (x.p === 'month') return {from:ymd(new Date(y,m,1)), to:ymd(new Date(y,m+1,0)), pf:ymd(new Date(y,m-1,1)), pt:ymd(new Date(y,m,0)), label:'This month'};
  if (x.p === 'last') return {from:ymd(new Date(y,m-1,1)), to:ymd(new Date(y,m,0)), pf:ymd(new Date(y,m-2,1)), pt:ymd(new Date(y,m-1,0)), label:'Last month'};
  if (x.p === 'year') return {from:y + '-01-01', to:y + '-12-31', pf:(y-1) + '-01-01', pt:(y-1) + '-12-31', label:'This year'};
  const f = x.from || ymd(new Date(y,m,1)), t = x.to || ymd(n), days = Math.max(1, Math.round((dt(t) - dt(f)) / 864e5) + 1);
  const pt = new Date(dt(f).getTime() - 864e5), pf = new Date(pt.getTime() - (days - 1) * 864e5);
  return {from:f, to:t, pf:ymd(pf), pt:ymd(pt), label:'Custom'};
}
function expData(){
  const r = ranges(), all = state.docs.filter(d => d.amount > 0), cur = all.filter(d => d.billDate >= r.from && d.billDate <= r.to), prev = all.filter(d => d.billDate >= r.pf && d.billDate <= r.pt);
  return {r, all, cur, prev};
}
function moneyView(){
  const {r, all, cur, prev} = expData(), x = state.exp, T = sum(cur), P = sum(prev), paid = sum(cur.filter(d => d.status === 'Paid')), part = sum(cur.filter(d => d.status === 'Partial')), unp = T - paid - part;
  const cats = CATS.map(c => [c, sum(cur.filter(d => d.category === c))]).filter(c => c[1] > 0).sort((a,b) => b[1] - a[1]);
  const y = dt(r.from).getFullYear(), mon = [...Array(12)].map((_,i) => sum(all.filter(d => (d.billDate || '').startsWith(y + '-' + pad(i + 1))))), mx = Math.max(1, ...mon), ly = sum(all.filter(d => (d.billDate || '').startsWith((y - 1) + '-')));
  const chg = P ? Math.round((T - P) / P * 100) : null, cm = Math.max(1, ...cats.map(c => c[1]));
  return `<div class="view"><div class="top"><h1>Expenses</h1></div>
  <div class="seg" style="margin-bottom:12px;overflow:auto">${[['month','This month'],['last','Last month'],['year','This year'],['custom','Custom']].map(([k,l]) => `<button data-ep="${k}" class="${x.p === k ? 'on' : ''}" style="white-space:nowrap">${l}</button>`).join('')}</div>
  ${x.p === 'custom' ? `<div class="r2" style="margin-bottom:12px"><div class="fld"><label>From</label><input type="date" id="ef" value="${r.from}"></div><div class="fld"><label>To</label><input type="date" id="et" value="${r.to}"></div></div>` : ''}
  <div class="hero"><small>${r.label} · ${cur.length} bill(s)</small><div class="amt">${inr(T)}</div><div class="row"><div class="pill">Paid<b>${inr(paid)}</b></div><div class="pill">Unpaid<b>${inr(unp)}</b></div>${part ? `<div class="pill">Partly paid<b>${inr(part)}</b></div>` : ''}</div></div>
  <div class="grid"><div class="card stat"><b style="font-size:18px">${cats.length ? esc(cats[0][0]) : '-'}</b><span>Highest category</span></div><div class="card stat"><b style="font-size:18px;color:var(--${chg === null ? 'mut' : chg > 0 ? 'bad' : 'ok'})">${chg === null ? '-' : (chg > 0 ? '+' : '') + chg + '%'}</b><span>vs previous period (${inr(P)})</span></div></div>
  <div class="card"><h2>${y} by month<small style="color:var(--mut);font-weight:400">${y - 1}: ${inr(ly)}</small></h2><div class="chart">${mon.map((v,i) => `<div class="bar ${i === new Date().getMonth() && y === new Date().getFullYear() ? 'cur' : ''}"><i style="height:${v / mx * 100}%"></i><span>${'JFMAMJJASOND'[i]}</span></div>`).join('')}</div></div>
  <div class="card"><h2>By category</h2>${cats.length ? cats.map(c => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${esc(c[0])}</span><b>${inr(c[1])}</b></div><div style="height:8px;border-radius:9px;background:var(--bg);margin-top:5px"><div style="height:8px;border-radius:9px;width:${c[1] / cm * 100}%;background:${colorOf(c[0])}"></div></div></div>`).join('') : '<p style="color:var(--mut)">No bills with an amount in this period.</p>'}</div>
  <div class="card"><h2>Reports</h2><div class="acts" style="margin:0"><button class="btn ghost" data-rep="csv">Download CSV</button><button class="btn ghost" data-rep="pdf">Download PDF</button></div></div>
  <div class="card"><h2>Bills in this period</h2>${cur.length ? cur.sort((a,b) => b.billDate.localeCompare(a.billDate)).map(item).join('') : '<p style="color:var(--mut)">Nothing here yet.</p>'}</div></div>`;
}

/* ---------- reports ---------- */
const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
function saveBlob(b, name){ const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
function makePdf(lines){
  const per = 46, pages = []; for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
  let out = '%PDF-1.4\n'; const off = [], add = s => { off.push(out.length); out += off.length + ' 0 obj\n' + s + '\nendobj\n'; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [' + pages.map((_, i) => (4 + i * 2) + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((p, i) => {
    const t = 'BT /F1 10 Tf 40 800 Td 16 TL ' + p.map(l => '(' + l.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7E]/g, '?') + ') Tj T*').join(' ') + ' ET';
    add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ' + (5 + i * 2) + ' 0 R /Resources << /Font << /F1 3 0 R >> >> >>');
    add('<< /Length ' + t.length + ' >>\nstream\n' + t + '\nendstream');
  });
  const x = out.length; out += 'xref\n0 ' + (off.length + 1) + '\n0000000000 65535 f \n' + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (off.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF';
  return new Blob([out], {type:'application/pdf'});
}
function report(kind){
  const {r, cur} = expData(); if (!cur.length) return toast('No bills in this period');
  const rows = cur.slice().sort((a,b) => a.billDate.localeCompare(b.billDate)), tag = r.from + '_to_' + r.to;
  if (kind === 'csv') {
    const h = ['Bill date','Name','Vendor','Category','Invoice','Amount','Tax','Status','Member','Due date'];
    saveBlob(new Blob([[h.map(cell).join(',')].concat(rows.map(d => [d.billDate,d.name,d.vendor,d.category,d.invoice,d.amount,d.tax || 0,d.status,d.member,d.dueDate].map(cell).join(','))).join('\r\n')], {type:'text/csv'}), 'SmartVault_Expenses_' + tag + '.csv');
  } else {
    const p = n => 'Rs. ' + Math.round(n).toLocaleString('en-IN'), T = sum(rows), cats = CATS.map(c => [c, sum(rows.filter(d => d.category === c))]).filter(c => c[1] > 0);
    const L = ['SmartVault Expense Report', r.from + ' to ' + r.to, '', 'Total: ' + p(T), 'Paid: ' + p(sum(rows.filter(d => d.status === 'Paid'))), 'Partly paid: ' + p(sum(rows.filter(d => d.status === 'Partial'))), 'Unpaid: ' + p(sum(rows.filter(d => d.status === 'Unpaid'))), '', 'By category'].concat(cats.map(c => '  ' + c[0] + ': ' + p(c[1])), ['', 'Bills'], rows.map(d => (d.billDate + ' | ' + d.name.slice(0, 34) + ' | ' + d.category + ' | ' + p(d.amount) + ' | ' + d.status).slice(0, 95)));
    saveBlob(makePdf(L), 'SmartVault_Expenses_' + tag + '.pdf');
  }
  toast('Report ready. Check your Downloads or Files app.');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ep]'); if (b) { state.exp = {...(state.exp || {}), p:b.dataset.ep}; render(); }
  const r = e.target.closest('[data-rep]'); if (r) report(r.dataset.rep);
});
document.addEventListener('change', e => {
  if (e.target.id === 'ef' || e.target.id === 'et') { const x = ranges(); state.exp = {p:'custom', from:$('#ef').value || x.from, to:$('#et').value || x.to}; render(); }
});
