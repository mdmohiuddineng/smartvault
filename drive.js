/* SmartVault - Phase 4: Google Drive storage, sync, backup. An upload counts only after Drive confirms it. */
const GD = 'https://www.googleapis.com/drive/v3', GU = 'https://www.googleapis.com/upload/drive/v3';
const dv = {busy:false, again:false, msg:'', quota:null};
const folderNames = () => ['Bills', ...CATS];
const say = m => { dv.msg = m; document.querySelectorAll('.dvmsg').forEach(e => e.textContent = m); };
const J = h => ({'Content-Type':'application/json', ...(h || {})});
const extOf = d => ((d.fileName || '').match(/\.[a-z0-9]+$/i) || [''])[0];
const gone = () => JSON.parse(localStorage.getItem('sv-gone') || '{}');
const markGone = id => { const x = gone(); x[id] = Date.now(); localStorage.setItem('sv-gone', JSON.stringify(x)); };

async function g(url, o = {}){
  if (!signedIn()) throw new Error('signin');
  const r = await fetch(url, {...o, headers:{Authorization:'Bearer ' + auth.token, ...(o.headers || {})}});
  if (r.status === 401) { auth.token = null; refresh(); throw new Error('signin'); }
  if (!r.ok) { const e = new Error('drive ' + r.status); e.status = r.status; throw e; }
  return r;
}
async function ensureFolder(name, parent){
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parent ? ` and '${parent}' in parents` : '');
  const j = await (await g(GD + '/files?fields=files(id)&q=' + encodeURIComponent(q))).json();
  if (j.files.length) return j.files[0].id;
  const b = {name, mimeType:'application/vnd.google-apps.folder'}; if (parent) b.parents = [parent];
  return (await (await g(GD + '/files?fields=id', {method:'POST', headers:J(), body:JSON.stringify(b)})).json()).id;
}
async function structure(force){
  const k = 'sv-fold:' + auth.user.email; let s = !force && JSON.parse(localStorage.getItem(k) || 'null');
  if (s && s.root && Object.keys(s.cats).length >= folderNames().length) return s;
  say('Creating Drive folders...');
  const root = await ensureFolder('SmartVault'), cats = {};
  for (const n of folderNames()) cats[n] = await ensureFolder(n, root);
  s = {root, cats}; localStorage.setItem(k, JSON.stringify(s)); return s;
}
const putBlob = (url, blob, mime, on) => new Promise((res, rej) => {
  const x = new XMLHttpRequest(); x.open('PUT', url); x.setRequestHeader('Content-Type', mime || 'application/octet-stream');
  x.upload.onprogress = e => e.lengthComputable && on(Math.round(e.loaded / e.total * 100));
  x.onload = () => (x.status === 200 || x.status === 201) ? res(JSON.parse(x.responseText)) : rej(new Error('drive ' + x.status));
  x.onerror = () => rej(new Error('network')); x.send(blob);
});
async function uploadOne(d, on){
  const f = await tx('files', 'readonly', s => s.get(d.id)); if (!f || !f.blob) throw new Error('local file missing');
  let s = await structure();
  const start = () => g(GU + '/files?uploadType=resumable&fields=id', {method:'POST', headers:J({'X-Upload-Content-Type':d.mime || 'application/octet-stream'}), body:JSON.stringify({name:d.name + extOf(d), parents:[s.cats[d.category] || s.cats.Other], appProperties:{svId:d.id}})});
  let init; try { init = await start(); } catch (e) { if (e.status === 404) { s = await structure(true); init = await start(); } else throw e; }
  const r = await putBlob(init.headers.get('Location'), f.blob, d.mime, on);
  const v = await (await g(GD + '/files/' + r.id + '?fields=id,size')).json();
  if (Number(v.size) !== f.blob.size) throw new Error('Drive size check failed');
  return r.id;
}
async function pushMeta(d){
  const s = await structure(), cur = await (await g(GD + '/files/' + d.driveId + '?fields=parents')).json();
  const np = s.cats[d.category] || s.cats.Other, old = (cur.parents || []).filter(p => p !== np).join(',');
  await g(GD + '/files/' + d.driveId + '?fields=id&addParents=' + np + (old ? '&removeParents=' + old : ''), {method:'PATCH', headers:J(), body:JSON.stringify({name:d.name + extOf(d)})});
}
async function driveTrash(d){
  if (!d.driveId) return;
  try { await g(GD + '/files/' + d.driveId + '?fields=id', {method:'PATCH', headers:J(), body:JSON.stringify({trashed:true})}); } catch (e) { if (e.status !== 404) throw e; }
}
async function getFile(d){
  const f = await tx('files', 'readonly', s => s.get(d.id)); if (f && f.blob) return f;
  if (!d.driveId) return null;
  try { const r = await g(GD + '/files/' + d.driveId + '?alt=media'); return {blob:new Blob([await r.blob()], {type:d.mime})}; }
  catch (e) { toast(e.message === 'signin' ? 'Sign in to open files stored on Drive' : 'Could not download from Drive'); return null; }
}
const backupId = async root => (await (await g(GD + '/files?fields=files(id)&q=' + encodeURIComponent(`name='smartvault-db.json' and '${root}' in parents and trashed=false`))).json()).files[0]?.id;
async function saveBackup(){
  const s = await structure(), id = await backupId(s.root), body = JSON.stringify({v:1, saved:Date.now(), gone:gone(), docs:state.docs.filter(d => d.driveId), rem:state.rem || [], war:state.war || []});
  if (id) await g(GU + '/files/' + id + '?uploadType=media', {method:'PATCH', headers:J(), body});
  else { const b = 'svb'; await g(GU + '/files?uploadType=multipart', {method:'POST', headers:{'Content-Type':'multipart/related; boundary=' + b}, body:`--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({name:'smartvault-db.json', parents:[s.root]})}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`}); }
}
async function pull(){
  const s = await structure(), id = await backupId(s.root); if (!id) return 0;
  const b = await (await g(GD + '/files/' + id + '?alt=media')).json(), gn = {...(b.gone || {}), ...gone()}; localStorage.setItem('sv-gone', JSON.stringify(gn)); let n = 0;
  for (const r of b.docs || []) {
    const l = state.docs.find(x => x.id === r.id);
    if (!r.driveId || (gn[r.id] && gn[r.id] >= (r.updated || 0))) continue;
    if (!l || (r.updated || 0) > (l.updated || 0)) { await tx('docs', 'readwrite', s2 => s2.put({...r, dirty:false})); n++; }
  }
  for (const l of state.docs) if (gn[l.id] && gn[l.id] > (l.updated || 0)) { await tx('docs', 'readwrite', s2 => s2.delete(l.id)); await tx('files', 'readwrite', s2 => s2.delete(l.id)); n++; }
  n += await pullExtra(b, gn);
  return n;
}
async function syncAll(){
  if (!signedIn()) return; if (dv.busy) { dv.again = true; return; }
  dv.busy = true; let fail = 0;
  try {
    await structure();
    const todo = state.docs.filter(d => !d.driveId); let i = 0;
    for (const d of todo) {
      i++;
      try { const id = await uploadOne(d, p => say(`Uploading ${i} of ${todo.length}... ${p}%`)); await tx('docs', 'readwrite', s => s.put({...d, driveId:id, syncErr:'', syncedAt:Date.now()})); }
      catch (e) { if (e.message === 'signin') throw e; fail++; await tx('docs', 'readwrite', s => s.put({...d, syncErr:e.message})); }
    }
    await load();
    for (const d of state.docs.filter(d => d.driveId && d.dirty)) { try { await pushMeta(d); await tx('docs', 'readwrite', s => s.put({...d, dirty:false})); } catch (e) { if (e.message === 'signin') throw e; fail++; } }
    say('Checking Drive backup...'); await pull(); await load(); await loadExtra(); await saveBackup();
    try { dv.quota = (await (await g(GD + '/about?fields=storageQuota')).json()).storageQuota; } catch (e) {}
    localStorage.setItem('sv-last', Date.now());
    say(fail ? `${fail} item(s) failed. Tap Sync now to retry.` : 'Synced with Google Drive.');
  } catch (e) { say(e.message === 'signin' ? 'Please sign in again.' : e.message === 'network' ? 'No internet. Try again later.' : 'Sync problem (' + e.message + '). Tap Sync now to retry.'); }
  dv.busy = false; await load(); refresh();
  if (dv.again) { dv.again = false; syncAll(); }
}
const syncSoon = () => { if (signedIn()) syncAll(); };
async function freeSpace(){
  if (!signedIn()) return toast('Sign in first'); let n = 0;
  for (const d of state.docs.filter(d => d.driveId)) {
    const f = await tx('files', 'readonly', s => s.get(d.id)); if (!f || !f.blob) continue;
    try { const v = await (await g(GD + '/files/' + d.driveId + '?fields=size,trashed')).json(); if (!v.trashed && Number(v.size) === f.blob.size) { await tx('files', 'readwrite', s => s.delete(d.id)); n++; } } catch (e) {}
  }
  toast(n + ' file(s) removed from this phone. Still on Drive.');
}
const gb = n => (Number(n) / 1073741824).toFixed(1) + ' GB';
const pending = () => state.docs.filter(d => !d.driveId).length;
const driveCard = () => `<div class="card sync"><div class="ic"><svg><use href="#i-cloud"/></svg></div><div><b>Google Drive</b><small class="dvmsg">${esc(dv.msg || ('Connected as ' + auth.user.email + (pending() ? '. ' + pending() + ' waiting to upload.' : '. Everything is on Drive.')))}</small></div><button class="btn ghost" data-dv="sync">Sync now</button></div>`;
const driveRows = () => `<div class="set"><span>Drive storage</span><small style="color:var(--mut)">${dv.quota ? gb(dv.quota.usage) + ' used' + (dv.quota.limit ? ' of ' + gb(dv.quota.limit) : '') : 'Shown after sync'}</small></div>
<div class="set"><span>Sync</span><button class="btn ghost" data-dv="sync" style="margin:0">Sync now</button></div>
<div class="set"><span>Restore from Drive backup</span><button class="btn ghost" data-dv="restore" style="margin:0">Restore</button></div>
<div class="set"><span>Free up phone space</span><button class="btn ghost" data-dv="free" style="margin:0">Free up</button></div><div class="note dvmsg">${esc(dv.msg)}</div>`;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-dv]'); if (!b) return; const a = b.dataset.dv;
  if (a === 'sync') syncAll();
  else if (a === 'restore') { try { const n = await pull(); await load(); await loadExtra(); refresh(); toast(n ? n + ' item(s) restored' : 'Nothing new to restore'); } catch (x) { toast('Could not read the Drive backup'); } }
  else if (a === 'free') { await freeSpace(); refresh(); }
});
