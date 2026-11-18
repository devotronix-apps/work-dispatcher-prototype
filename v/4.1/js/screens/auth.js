/* RouteClerk prototype — signing in: welcome, email and password, magic link, Sign in with Apple, company picker,
   invitations (with the driver location-tracking notice) and self-serve company creation. Any input is accepted. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data } = WD;

WD.addIcons({ faceid: '<path d="M3.5 8V6A2.5 2.5 0 0 1 6 3.5h2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5h-2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2M9 9v1.5M15 9v1.5M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0"/>' });
WD.css(`
.au-welcome { min-height: 100%; display: flex; flex-direction: column; align-items: center; padding: 64px 28px 30px; text-align: center; }
.au-icon { width: 112px; height: 112px; border-radius: 25px; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.au-icon.sm { width: 76px; height: 76px; border-radius: 17px; }
.au-name { font-size: 34px; line-height: 41px; font-weight: 700; letter-spacing: .4px; margin: 22px 0 6px; }
.au-tag { font-size: 17px; line-height: 22px; color: var(--label2); max-width: 300px; }
.au-actions { width: 100%; margin-top: auto; padding-top: 30px; display: flex; flex-direction: column; gap: 10px; }
.au-links { display: flex; justify-content: center; gap: 24px; }
.au-link { border: 0; background: none; color: var(--tint); font-size: 15px; letter-spacing: -.24px; padding: 8px 0; cursor: pointer; }
.au-legal { font-size: 12px; line-height: 16px; color: var(--label2); text-align: center; letter-spacing: 0; }
.au-head { padding: 12px 32px 2px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.au-head h1 { font-size: 28px; line-height: 34px; font-weight: 700; letter-spacing: .36px; margin: 12px 0 6px; }
.au-head p { font-size: 15px; line-height: 20px; color: var(--label2); margin: 0; letter-spacing: -.24px; overflow-wrap: anywhere; }
.au-foot { padding: 0 16px 24px; display: flex; flex-direction: column; gap: 8px; }
.au-progress { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 0 48px 90px; text-align: center; }
.au-progress .progress { width: 100%; margin-top: 6px; }
.au-apple { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 40px 4px; text-align: center; }
.au-face { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; height: 70%; }
.au-face .ic { color: var(--blue); animation: au-scan 1s ease-in-out infinite; }
.au-face.done .ic { color: var(--green); animation: au-pop .35s ease-out; }
@keyframes au-scan { 50% { transform: scale(.86); opacity: .55; } }
@keyframes au-pop { from { transform: scale(.6); opacity: 0; } }
.au-invite { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 20px; text-align: center; }
`);

const validEmail = s => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s.trim());
const roleTitle = r => (WD.roles[r] || {}).title || r;
const article = w => (/^[AEIOU]/.test(w) ? 'an ' : 'a ') + w;
const head = (glyph, title, text) => h('div.au-head', glyph, h('h1', title), text && h('p', text));
const foot = (...kids) => h('div.au-foot', kids);
const link = (label, onTap) => h('button.au-link', { onclick: onTap }, label);
const check = on => ({ icon: on ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: on ? 'var(--tint)' : 'var(--label3)' });
/** Show a spinner in the button while fn runs (the button stays disabled meanwhile). */
async function busy(btn, fn) { const kids = [...btn.childNodes]; btn.disabled = true; btn.replaceChildren(ui.spinner(20, 'currentColor')); try { await fn(); } finally { btn.replaceChildren(...kids); btn.disabled = false; } }
const hudWait = async (text, then) => { const hud = ui.hud(text); await WD.delay(700, 1000); hud.close(); then(); };

/* ---------- Welcome ---------- */
let rootPage = null;
function show() {
  rootPage = WD.app.showRoot({ title: '', navbar: false, render: page => h('div.au-welcome',
    h('img.au-icon', { src: 'img/app-icon.png', alt: '' }), h('div.au-name', 'RouteClerk'),
    h('div.au-tag', 'Plan routes, dispatch trucks and keep every stop on time.'),
    h('div.au-actions',
      ui.button('Sign in with Apple', { kind: 'dark', icon: 'apple', onTap: () => appleSheet(page) }),
      ui.button('Continue with email', { kind: 'gray', icon: 'envelope', onTap: () => emailPage(page) }),
      h('div.au-links', link('I have an invitation', () => invitePage(page)), link('Create a company', () => createPage(page))),
      h('div.au-legal', 'By continuing you agree to the Terms of Service and acknowledge the Privacy Policy.'))) });
  return rootPage;
}

/* ---------- Email, password, magic link ---------- */
function emailPage(from) {
  let email = (S.me && S.me.email) || data.users[0].email, btn;
  const next = () => busy(btn, async () => { await WD.delay(600, 1000); passwordPage(from, email.trim().toLowerCase()); });
  from.push({ title: '', render: () => h('div',
    head(icon('envelope', 46, 'var(--tint)'), 'Sign in with email', 'Use the address your company has on file.'),
    ui.list(ui.section(ui.inputRow({ placeholder: 'name@company.com', type: 'email', inputmode: 'email', caps: 'off', value: email, autofocus: true,
      onInput: v => { email = v; btn.disabled = !validEmail(v); }, onEnter: () => validEmail(email) && next() }))),
    foot(btn = ui.button('Continue', { disabled: !validEmail(email), onTap: next }))) });
}
function passwordPage(from, email) {
  let pw = '', btn;
  const user = data.users.find(u => u.email === email);
  const go = () => busy(btn, async () => { await WD.delay(800, 1300); afterAuth(from); });
  from.push({ title: '', render: () => h('div',
    head(ui.avatar(user ? user.name : email, { size: 64 }), 'Enter your password', email),
    ui.list(ui.section(ui.inputRow({ placeholder: 'Password', type: 'password', caps: 'off', value: pw, autofocus: true,
      onInput: v => { pw = v; btn.disabled = !pw; }, onEnter: () => pw && go() }))),
    foot(btn = ui.button('Sign in', { disabled: !pw, onTap: go }),
      ui.button('Email me a sign-in link instead', { kind: 'plain', onTap: () => magicPage(from, email) }),
      link('Forgot password?', () => ui.alert({ title: 'Reset email sent', message: 'We sent a link to reset your password to ' + email + '. It expires in one hour.' })))) });
}
function magicPage(from, email) {
  let left = 0, timer = null, btn;
  const label = () => left ? 'Resend in ' + left + ' s' : 'Resend link';
  const sync = () => { if (btn) { btn.textContent = label(); btn.disabled = left > 0; } };
  const start = () => { left = 30; clearInterval(timer); timer = setInterval(() => { left = Math.max(0, left - 1); sync(); if (!left) clearInterval(timer); }, 1000); sync(); };
  from.push({ title: '', onAppear: start, onClose: () => clearInterval(timer), render: page => h('div',
    head(icon('envelope', 56, 'var(--tint)'), 'Check your email', 'We sent a sign-in link to ' + email + '. Open it on this iPhone to finish signing in.'),
    h('div', { style: { height: '24px' } }),
    foot(btn = ui.button(label(), { kind: 'gray', disabled: left > 0, onTap: async () => { btn.disabled = true; await WD.delay(500, 800); ui.toast('Link sent', 'envelope'); start(); } }),
      ui.button('Simulate tapping the link', { kind: 'plain', icon: 'link', onTap: () => { clearInterval(timer); hudWait('Signing in…', () => afterAuth(page)); } }),
      h('div.au-legal', 'Prototype only: stands in for opening the email on this iPhone.'))) });
}

/* ---------- Sign in with Apple ---------- */
function appleSheet(from) {
  const me = S.me || data.users[0]; let share = true, phase = 'choose', alive = true;
  const sheet = ui.sheet({ title: 'Apple ID', leading: () => phase === 'choose' ? { label: 'Cancel', onTap: p => p.dismiss() } : null,
    render: page => phase !== 'choose' ? h('div.au-face' + (phase === 'done' ? '.done' : ''), icon(phase === 'done' ? 'checkmark.circle.fill' : 'faceid', 66), h('div.headline', phase === 'done' ? 'Done' : 'Face ID')) : h('div',
      h('div.au-apple', icon('apple', 30), h('div.footnote', 'Create an account for RouteClerk using your Apple ID.')),
      ui.list(ui.section(
        ui.row({ icon: 'person.crop.circle', iconPlain: true, iconColor: 'var(--gray)', title: me.name }),
        ui.row({ ...check(share), title: 'Share my email', subtitle: me.email, onTap: () => { share = true; page.refresh(); } }),
        ui.row({ ...check(!share), title: 'Hide my email', subtitle: 'Forward to k7x2p9qd4m@privaterelay.appleid.com', onTap: () => { share = false; page.refresh(); } }))),
      foot(ui.button('Continue with Face ID', { icon: 'faceid', onTap: async () => {
        phase = 'scan'; page.refresh(); await WD.delay(1100); if (!alive) return;
        phase = 'done'; page.refresh(); await WD.delay(700); if (!alive) return;
        sheet.close(); afterAuth(from);
      } }))) }, { detent: 'medium' });
  sheet.closed.then(() => { alive = false; });
}

/* ---------- Company picker and loading ---------- */
function afterAuth(from) {
  if (data.orgs.length < 2) { S.org = data.orgs[0]; return loading(from); }
  from.push({ title: 'Choose a company', large: true, back: false, render: page => ui.list(
    ui.section({ footer: 'You can switch companies later in Settings.' }, data.orgs.map(o => ui.row({
      leading: ui.avatar(o.name, { size: 40, icon: 'building' }), title: o.name, subtitle: [roleTitle(o.role), o.trucks + ' trucks', o.plan].join(' · '),
      chevron: true, onTap: () => { S.org = o; loading(page); } })))) });
}
/** Staged progress screen. o: {title, glyph, stages, done(page)} */
function progressPage(from, o) {
  let label, bar;
  from.push({ title: '', navbar: false, live: false,
    render: () => h('div.au-progress', o.glyph || h('img.au-icon.sm', { src: 'img/app-icon.png', alt: '' }), h('div.title3', o.title || (S.org || data.orgs[0]).name), label = h('div.subhead.secondary', o.stages[0]), bar = ui.progress(0)),
    onAppear: async page => {
      for (let i = 0; i < o.stages.length; i++) { label.textContent = o.stages[i]; await WD.delay(380, 620); bar.firstChild.style.width = Math.round((i + 1) / o.stages.length * 100) + '%'; }
      await WD.delay(250); o.done(page);
    } });
}
const LOAD = ['Signing in…', 'Loading routes…', 'Syncing jobs (delta since last visit)…', 'Connecting live updates…'];
const loading = (from, done = () => WD.app.signIn()) => progressPage(from, { stages: LOAD, done });

/* ---------- Invitations ---------- */
function invitePage(from) {
  let code = '', btn;
  const ok = () => code.replace(/\W/g, '').length >= 6;
  from.push({ title: 'Invitation', render: page => h('div',
    head(icon('person.badge.plus', 50, 'var(--tint)'), 'Join your team', 'Enter the code from your invitation email, or open the link in it on this iPhone.'),
    ui.list(ui.section({ footer: 'Codes are 8 letters and numbers, like 7KQ2-M9XD.' }, ui.inputRow({ placeholder: 'Invitation code', caps: 'characters', value: code, autofocus: true,
      onInput: v => { code = v; btn.disabled = !ok(); } }))),
    foot(btn = ui.button('Continue', { disabled: !ok(), onTap: () => busy(btn, async () => { await WD.delay(700, 1100); acceptPage(page); }) }),
      ui.button('Simulate opening the invite link', { kind: 'plain', icon: 'link', onTap: () => hudWait('Opening invitation…', () => acceptPage(page)) }))) });
}
function acceptPage(from) {
  const org = data.orgs[0], inviter = data.users.find(u => u.id === 'u2') || { name: 'Priya Raman' };
  let u = data.users.find(x => x.status === 'invited' && x.role === 'driver');
  if (!u) data.users.push(u = { id: 'u' + Date.now().toString(36), name: 'Jess Lindqvist', email: 'jess@discountshred.example', phone: '', role: 'driver', status: 'invited', lastSeen: 'Invited today' });
  let name = u.name, pw = '', btn;
  const ok = () => !!name.trim() && pw.length >= 8, sync = () => { btn.disabled = !ok(); };
  const finish = () => { Object.assign(u, { name: name.trim(), status: 'active', lastSeen: 'Now' }); S.org = org; WD.app.setRole(u.role); S.me = u; WD.app.signIn(); };
  from.push({ title: 'Invitation', render: page => h('div', ui.list(
    ui.section(h('div.au-invite', ui.avatar(inviter.name, { size: 56 }), h('div.headline', inviter.name + ' invited you to ' + org.name + ' as ' + article(roleTitle(u.role))), h('div.footnote', u.email + ' · ' + u.lastSeen))),
    ui.section({ header: 'Your account', footer: 'Passwords need at least 8 characters.' },
      ui.inputRow({ label: 'Name', value: name, caps: 'words', onInput: v => { name = v; sync(); } }), ui.row({ title: 'Email', detail: u.email }),
      ui.inputRow({ label: 'Password', type: 'password', placeholder: 'Required', caps: 'off', value: pw, onInput: v => { pw = v; sync(); } }))),
    foot(btn = ui.button('Accept invitation', { disabled: !ok(), onTap: () => busy(btn, async () => { await WD.delay(700, 1200); u.role === 'driver' ? noticePage(page, finish) : loading(page, finish); }) }))) });
}
/** The written employee location-tracking notice (also shown from Settings → Location tracking). */
function trackingNotice() {
  const org = (S.org || data.orgs[0]).name, item = (ic, color, title, text) => ui.row({ icon: ic, iconColor: color, title, subtitle: text });
  return ui.list(ui.section({ header: 'Notice from ' + org, footer: 'A copy of this notice is emailed to you when you agree.' },
    item('clock', 'var(--blue)', 'Only during a shift', 'Your iPhone records location only while you’re clocked in. It stops at clock-out, or automatically if you forget.'),
    item('location.fill', 'var(--green)', 'What is collected', 'Precise location about every 30 seconds while driving and a check-in every 5 minutes while parked, with battery level.'),
    item('person.2', 'var(--orange)', 'Who sees it', 'Owners, dispatchers and office staff at ' + org + ' see where you are, when you arrive at and leave stops, and places you stayed longer than ' + data.timeRules.stayMinutes + ' minutes.'),
    item('calendar', 'var(--purple)', 'How long it’s kept', 'Location points are kept for 24 months, then thinned. Stop times and route summaries stay with job history.'),
    item('hand.raised', 'var(--red)', 'Your choice', 'You can withdraw consent in Settings at any time. You’ll need to agree again before your next clock-in.')));
}
function noticePage(from, finish) {
  let agreed = false;
  from.push({ title: 'Location tracking', render: page => h('div', trackingNotice(),
    ui.list(ui.section(ui.row({ ...check(agreed), title: 'I understand and agree', subtitle: 'Tracking starts at clock-in and stops at clock-out.', onTap: () => { agreed = !agreed; page.refresh(); } }))),
    foot(ui.button('Continue', { disabled: !agreed, onTap: () => { S.tracking = { consent: true, consentAt: +WD.now() }; loading(page, finish); } }))) });
}

/* ---------- Create a company (self-serve onboarding) ---------- */
function createPage(from) {
  let company = '', name = (S.me && S.me.name) || '', trucks = 3, importNow = true, btn;
  const ok = () => company.trim().length > 1 && !!name.trim(), sync = () => { btn.disabled = !ok(); };
  from.push({ title: 'New company', render: page => h('div',
    head(icon('building', 48, 'var(--tint)'), 'Create a company', 'Set up dispatch for your team. You can change all of this later.'),
    ui.list(
      ui.section(ui.inputRow({ label: 'Company', placeholder: 'Lakemont Shredding', caps: 'words', value: company, autofocus: true, onInput: v => { company = v; sync(); } }),
        ui.inputRow({ label: 'Your name', placeholder: 'Full name', caps: 'words', value: name, onInput: v => { name = v; sync(); } })),
      ui.section({ footer: 'Plans are billed per truck after the free trial.' }, ui.row({ title: 'Trucks', detail: String(trucks), trailing: ui.stepper(trucks, 1, 50, n => { trucks = n; page.refresh(); }) })),
      ui.section({ header: 'Existing schedule', footer: importNow ? 'Reads each Google calendar once and shows a dry run before anything is saved. Google Calendar itself is not changed.' : 'Start with an empty board. You can import any time from the web dashboard.' },
        ui.row({ ...check(importNow), title: 'Import from Google Calendar now', onTap: () => { importNow = true; page.refresh(); } }),
        ui.row({ ...check(!importNow), title: 'Later', onTap: () => { importNow = false; page.refresh(); } }))),
    foot(btn = ui.button('Create company', { disabled: !ok(), onTap: () => create(page) }))) });
  function create(page) {
    const org = { id: 'o' + Date.now().toString(36), name: company.trim(), role: 'owner', trucks, plan: 'Trial · 14 days left', city: '' };
    progressPage(page, { title: org.name, glyph: icon('building', 60, 'var(--tint)'),
      stages: ['Creating your workspace…', 'Setting up ' + trucks + ' route' + (trucks === 1 ? '' : 's') + '…', importNow ? 'Importing Google calendars (dry run)…' : 'Preparing an empty board…', 'Starting your free trial…'],
      done: p => { data.orgs.push(org); S.org = org; WD.app.setRole('owner'); trialPage(p, org); } });
  }
  function trialPage(from2, org) {
    from2.push({ title: '', navbar: false, render: () => h('div.au-welcome', icon('checkmark.circle.fill', 76, 'var(--green)'),
      h('div.title2', { style: { marginTop: '20px' } }, 'Your 14-day trial has started'),
      h('div.au-tag', { style: { marginTop: '8px' } }, org.name + ' is ready. After the trial it’s $29 per truck per month — ' + trucks + (trucks === 1 ? ' truck' : ' trucks') + ' is $' + 29 * trucks + '. No card needed until then.'),
      h('div.au-actions', ui.button('Next: connect your tools', { onTap: p => WD.admin ? WD.admin.connectPage(from2, () => WD.app.signIn()) : WD.app.signIn() }),
        h('div.au-legal', importNow ? 'Your import report will be ready on the web dashboard in a few minutes.' : 'Add routes and invite your team from Settings.'))) });
  }
}

WD.screens.auth = { show, trackingNotice };
WD.panel.addJump('Invitation', () => { WD.app.signOut(); invitePage(rootPage); });
})();
