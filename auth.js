/* SmartVault - Phase 3: Google sign-in. The access token lives in memory only (never saved to disk). */
const CLIENT_ID = '822723977729-g19bktoa96cng3672p0pu9inrafhusi1.apps.googleusercontent.com';
const ALLOWED_EMAILS = ['md.mohiuddin.eng@gmail.com', 'queensyeda19@gmail.com'];
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
const auth = {token:null, user:null, exp:0, busy:false, err:'', client:null, timer:null};
const signedIn = () => !!auth.token && Date.now() < auth.exp;
const initial = () => ((auth.user && auth.user.name) || 'S')[0].toUpperCase();

const st = document.createElement('style');
st.textContent = `.gate{position:fixed;inset:0;z-index:80;background:linear-gradient(160deg,#0B1F4B,#1A3A8A);color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px calc(env(safe-area-inset-right) + 24px) calc(env(safe-area-inset-bottom) + 24px) 24px}
.gate.on{display:flex}.gate img{width:96px;height:96px;border-radius:24px;box-shadow:0 12px 30px rgba(0,0,0,.35);margin-bottom:22px}
.gate h1{margin:0 0 6px;font-size:28px}.gate p{margin:0 0 28px;opacity:.8}
.gbtn{display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;color:#1f2937;border-radius:14px;padding:14px 22px;font-weight:600;font-size:16px;width:100%;max-width:320px}
.gbtn[disabled]{opacity:.6}.gerr{color:#FFB4AB;font-size:14px;margin:14px 0 0;max-width:320px}
.gskip{margin-top:22px;opacity:.75;font-size:14px;text-decoration:underline;color:#fff}.gnote{margin-top:26px;font-size:12px;opacity:.6;max-width:300px}`;
document.head.appendChild(st);
const gate = document.createElement('div'); gate.className = 'gate'; document.body.appendChild(gate);

function paintGate(){
  const show = !signedIn() && !sessionStorage.getItem('sv-skip');
  gate.classList.toggle('on', show);
  if (!show) return;
  gate.innerHTML = `<img src="icons/icon-192.png" alt=""><h1>Welcome back</h1><p>Your Personal Digital Locker</p>
  <button class="gbtn" data-auth="in" ${auth.busy ? 'disabled' : ''}><svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>${auth.busy ? 'Connecting...' : 'Continue with Google'}</button>
  ${auth.err ? `<div class="gerr">${esc(auth.err)}</div>` : ''}
  <a href="#" class="gskip" data-auth="skip">Skip for now (Drive stays disconnected)</a>
  <div class="gnote">SmartVault can only access files it creates in your Google Drive. Your sign-in is not stored on this device.</div>`;
}
function refresh(){ if (typeof render === 'function') render(); paintGate(); }

function signIn(){
  if (!(window.google && google.accounts && google.accounts.oauth2)) { auth.err = 'Google sign-in is not loaded. Check your internet and try again.'; return paintGate(); }
  if (!auth.client) auth.client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPES, callback: onToken,
    error_callback: e => { auth.busy = false; auth.err = e && e.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Sign-in could not open. Allow pop-ups and try again.'; refresh(); }
  });
  auth.busy = true; auth.err = ''; paintGate();
  auth.client.requestAccessToken(localStorage.getItem('sv-hint') ? {login_hint: localStorage.getItem('sv-hint')} : {});
}

async function onToken(r){
  const revoke = t => { try { google.accounts.oauth2.revoke(t, () => {}); } catch (e) {} };
  try {
    if (!r || r.error || !r.access_token) throw 'cancel';
    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(r.access_token));
    if (!res.ok) throw 'verify';
    const ti = await res.json();
    if (ti.aud !== CLIENT_ID) { revoke(r.access_token); throw 'verify'; }
    if (!(ti.scope || '').includes('auth/drive.file')) { revoke(r.access_token); throw 'scope'; }
    if (!ALLOWED_EMAILS.includes(String(ti.email || '').toLowerCase()) || ti.email_verified === 'false') { revoke(r.access_token); throw 'email'; }
    let name = ti.email;
    try { const u = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers:{Authorization:'Bearer ' + r.access_token}})).json(); name = u.name || name; } catch (e) {}
    auth.token = r.access_token; auth.user = {email:ti.email, name}; localStorage.setItem('sv-hint', ti.email);
    auth.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000;
    clearTimeout(auth.timer);
    auth.timer = setTimeout(() => { auth.token = null; auth.err = 'Your Google session expired. Please sign in again.'; refresh(); }, Math.max(1000, auth.exp - Date.now()));
    auth.err = '';
  } catch (e) {
    auth.err = {cancel:'Google sign-in was not completed.', scope:'Please allow access to files created by SmartVault, then try again.', email:'This account is not approved for this app. Sign in with an approved Google account.', verify:'Could not verify your Google sign-in. Try again.'}[e] || 'Sign-in failed. Check your internet and try again.';
  }
  auth.busy = false; refresh();
  if (signedIn() && typeof syncAll === 'function') syncAll();
}

function signOut(){
  if (auth.token) { try { google.accounts.oauth2.revoke(auth.token, () => {}); } catch (e) {} }
  auth.token = null; auth.user = null; auth.err = ''; clearTimeout(auth.timer);
  sessionStorage.removeItem('sv-skip'); refresh();
}

const syncCard = () => { const ok = signedIn(); if (ok && typeof driveCard === 'function') return driveCard(); return `<div class="card sync"><div class="ic"><svg><use href="#i-cloud"/></svg></div><div><b>Google Drive</b><small>${ok ? 'Signed in as ' + esc(auth.user.email) + '. Folders and upload arrive in Phase 4.' : 'Not connected. Files are only on this device.'}</small></div>${ok ? '' : '<button class="btn ghost" data-auth="in">Connect</button>'}</div>`; };
const acctRows = () => signedIn()
  ? `<div class="set"><span>Google account</span><small style="color:var(--mut)">${esc(auth.user.email)}</small></div><div class="set"><span>Session</span><button class="btn red" data-auth="out" style="margin:0">Sign out</button></div>${typeof driveRows === 'function' ? driveRows() : ''}`
  : `<div class="set"><span>Google account</span><button class="btn ghost" data-auth="in" style="margin:0">${auth.busy ? 'Connecting...' : 'Connect'}</button></div>${auth.err ? `<div class="note">${esc(auth.err)}</div>` : ''}`;

document.addEventListener('click', e => {
  const b = e.target.closest('[data-auth]'); if (!b) return;
  e.preventDefault(); const a = b.dataset.auth;
  if (a === 'in') signIn(); else if (a === 'out') signOut(); else if (a === 'skip') { sessionStorage.setItem('sv-skip', '1'); refresh(); }
});
paintGate();
