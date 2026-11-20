/* RouteClerk prototype — version 5.0 foundations.
   `WD.aip`  AI Premium: a paid add-on with a free, time-limited trial. Its features are HIDDEN (not locked) without it; Settings shows the sign-up.
   `WD.orgs` Businesses: separate data for each business a person works for, and matching a caller to the right business.
   `WD.r14`  A registry other 5.0 files use to add rows to Settings groups, plus the scheduling-style setting. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc || {}, R = WD.r14 = {};
const admin = () => WD.can('settings.manage'), owner = () => ['owner', 'admin'].includes((S.me || {}).role);
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));

WD.css(`
.aip-hero { margin: 4px 0 14px; border-radius: 18px; padding: 18px 18px 16px; color: #fff; background: linear-gradient(135deg, #7B3FE4, #2F6BFF); }
.aip-hero .t { font-size: 24px; font-weight: 700; letter-spacing: -.5px; display: flex; align-items: center; gap: 8px; }
.aip-hero .s { font-size: 15px; line-height: 20px; opacity: .92; margin-top: 6px; letter-spacing: -.2px; }
.aip-hero .p { font-size: 13px; opacity: .85; margin-top: 10px; }
.aip-hero .btn { margin-top: 12px; background: #fff !important; color: #5B34C9 !important; }
.aip-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; letter-spacing: .2px; padding: 2px 7px; border-radius: 6px; color: #fff; background: linear-gradient(135deg, #7B3FE4, #2F6BFF); white-space: nowrap; }
`);

/* ================= Settings registry ================= */
/* R.addSetting('Company', (push, gated) => row | [rows]) — settings.js asks for R.rows(group, push, gated) inside each group.
   Groups: 'AI Premium' (shown only while AI Premium is on), 'Company', 'Routes and board', 'Jobs', 'CRM'. */
const REG = {};
R.addSetting = (group, fn) => { (REG[group] = REG[group] || []).push(fn); };
R.rows = (group, push, gated) => (REG[group] || []).map(fn => { try { return fn(push, gated); } catch (e) { console.error(e); return null; } }).flat(Infinity).filter(Boolean);
/** A settings row that opens a page; flag = permission that greys it out. */
R.link = (push, gated, flag, ic, color, title, subtitle, spec, detail) => { const o = { icon: ic, iconColor: color, title, subtitle, detail, chevron: true, onTap: () => push(spec()) }; return ui.row(flag && gated ? gated(flag, o) : o); };

/* ================= AI Premium ================= */
/* status: 'none' (never tried) | 'trial' | 'active' (subscribed) | 'ended' (trial ran out or subscription canceled).
   trialDays is set by RouteClerk for each company (the panel beside the phone stands in for our own admin console). */
const AP = data.aiPremium = { status: 'trial', trialDays: 14, trialEnds: D.add(D.today(), 9), price: 149, since: null };
const AIP = WD.aip = {};
AIP.on = () => AP.status === 'active' || (AP.status === 'trial' && AP.trialEnds >= D.today());
AIP.daysLeft = () => AP.status === 'trial' ? Math.max(0, D.diff(AP.trialEnds, D.today())) : 0;
AIP.label = () => AP.status === 'active' ? 'subscribed' : AIP.on() ? 'free trial · ' + RC.plural(AIP.daysLeft(), 'day') + ' left' : AP.status === 'ended' ? 'ended' : 'not subscribed';
/** Build the node only while AI Premium is on. Without it the feature is not shown at all. */
AIP.block = build => AIP.on() ? build() : null;
AIP.tag = () => h('span.aip-tag', icon('sparkles', 12), 'AI Premium');
/** A result card in the AI style: {title, text, lines: [string | node], action: node}. */
AIP.card = o => RC.aiCard ? RC.aiCard({ ...o, title: o.title || 'AI Premium' }) : h('div', o.text);
/** Everything AI Premium adds, for the sign-up page. Other files add to it with AIP.feature(). */
AIP.FEATURES = [];
AIP.feature = (name, where, text) => { if (!AIP.FEATURES.some(f => f.name === name)) AIP.FEATURES.push({ name, where, text }); };
(RC.AI || []).filter(f => f.tier === 'premium').forEach(f => AIP.feature(f.name, f.where, f.text));
AIP.startTrial = () => { if (AP.status === 'ended' || AP.status === 'active') return WD.nav.push(AIP.spec());
  AP.status = 'trial'; AP.trialEnds = D.add(D.today(), AP.trialDays); WD.changed();
  ui.banner({ title: 'AI Premium trial started', text: 'Every AI Premium feature is on, free, until ' + fmt.day(AP.trialEnds, 'long') + '. Nothing is charged unless you subscribe.', icon: 'sparkles', color: 'var(--purple)', duration: 6000 }); };
AIP.subscribe = async () => { if (!owner()) return ui.alert({ title: 'Ask an owner', message: 'Only an owner or admin can subscribe to AI Premium.' });
  if (!await ui.alert({ title: 'Subscribe to AI Premium?', message: fmt.money(AP.price) + ' a month for the company, billed to the card on file. Cancel at any time; the features stay on until the end of the month you paid for.', buttons: [{ label: 'Not now', value: false }, { label: 'Subscribe', value: true, bold: true }] })) return;
  if (await ui.run('Subscribing…', () => { AP.status = 'active'; AP.since = D.today(); }, { done: 'AI Premium is on' })) WD.changed(); };
AIP.cancel = async () => { if (!await ui.actionSheet({ title: 'Cancel AI Premium?', message: 'The AI Premium features are hidden again. Nothing they created is deleted: summaries, recommendations already applied and call reviews stay.', buttons: [{ label: 'Cancel subscription', value: true, role: 'destructive' }] })) return; AP.status = 'ended'; WD.changed(); ui.toast('AI Premium canceled', 'checkmark'); };
AIP.spec = () => ({ title: 'AI Premium', render: page => {
  const on = AIP.on(), re = () => { WD.changed(); page.refresh(); };
  return ui.list(
    h('div.aip-hero', h('div.t', icon('sparkles', 24), 'AI Premium'),
      h('div.s', on ? (AP.status === 'active' ? 'Subscribed since ' + fmt.day(AP.since || D.today(), 'long') + '.' : 'Your free trial runs until ' + fmt.day(AP.trialEnds, 'long') + ' (' + RC.plural(AIP.daysLeft(), 'day') + ' left). Subscribe to keep these features when it ends.')
        : AP.status === 'ended' ? 'Your trial or subscription has ended, so the AI Premium features are hidden. Subscribe to bring them back.' : 'An assistant that reviews your leads, calls, routes and prices and does the routine work for you. Try everything free for ' + AP.trialDays + ' days.'),
      h('div.p', fmt.money(AP.price) + ' a month per company · cancel any time'),
      AP.status === 'none' ? ui.button('Start the free ' + AP.trialDays + '-day trial', { icon: 'sparkles', onTap: () => { AIP.startTrial(); page.refresh(); } }) : AP.status !== 'active' ? ui.button('Subscribe', { icon: 'sparkles', onTap: async () => { await AIP.subscribe(); page.refresh(); } }) : null),
    ui.section({ header: 'What it does', fold: false }, AIP.FEATURES.map(f => ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: f.name, subtitle: f.text + (f.where ? ' Shows in: ' + f.where + '.' : '') }))),
    AP.status === 'active' && owner() && ui.section(null, ui.row({ title: 'Cancel subscription', destructive: true, center: true, onTap: async () => { await AIP.cancel(); page.refresh(); } })),
    note('Without a trial or a subscription none of these appear in the app; the only trace is this sign-up page in Settings. The length of the free trial is set by RouteClerk for each company.'));
} });
/** Settings: the sign-up row when AI Premium is off; when it is on, the status row plus every AI Premium setting other files registered. */
AIP.settingsSection = (push, rows) => AIP.on()
  ? ui.section({ header: 'AI Premium' }, ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: 'AI Premium', subtitle: AP.status === 'active' ? 'Subscribed' : 'Free trial · ends ' + fmt.day(AP.trialEnds, 'md'), detail: AP.status === 'trial' ? RC.plural(AIP.daysLeft(), 'day') + ' left' : 'On', chevron: true, onTap: () => push(AIP.spec()) }), rows)
  : ui.section(null, ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: AP.status === 'none' ? 'Try AI Premium free for ' + AP.trialDays + ' days' : 'Subscribe to AI Premium', subtitle: 'Lead and call review, route planning, pricing audits and more', tint: true, chevron: true, onTap: () => push(AIP.spec()) }));
AIP.planRow = page => ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: 'AI Premium', subtitle: 'Paid add-on · ' + AIP.label(), chevron: true, onTap: () => page.push(AIP.spec()) });
WD.panel.addSeg('AI Premium (paid add-on)', () => [['none', 'Off'], ['trial', 'Trial'], ['active', 'Paid'], ['ended', 'Ended']], () => AP.status === 'trial' && !AIP.on() ? 'ended' : AP.status, v => { AP.status = v; if (v === 'trial') AP.trialEnds = D.add(D.today(), AP.trialDays); if (v === 'active') AP.since = D.today(); WD.changed(); });
WD.panel.addSeg('Trial length · set by RouteClerk', () => [[7, '7 days'], [14, '14'], [30, '30'], [60, '60']], () => AP.trialDays, v => { AP.trialDays = v; if (AP.status === 'trial') AP.trialEnds = D.add(D.today(), v); WD.changed(); });
WD.panel.addJump('AI Premium', () => { WD.nav.switchTab('settings'); WD.nav.push(AIP.spec()); });

/* ================= Businesses ================= */
/* Each business has its own customers, jobs, routes, invoices and settings. The prototype builds the second business from a copy of the
   first with its own names, city and phone numbers, and swaps WD.data's contents when the person switches (core.js app.switchOrg parks and
   restores the screens). data.orgs, the plan and AI Premium are shared by reference so they survive the swap. */
const O = WD.orgs = {}, SHARED = ['orgs', 'plan', 'aiPremium'];
Object.assign(data.orgs[0], { short: 'Discount', color: '#007AFF', state: 'CA', areaCodes: ['512', '559', '661', '209'], lines: [{ label: 'Main', number: '+15125550300' }, { label: 'Google Ads', number: '+15125550301' }, { label: 'Fresno', number: '+15595550320' }, { label: 'Bakersfield', number: '+16615550321' }, { label: 'Stockton', number: '+12095550322' }] });
data.orgs[1] = { id: 'o2', name: 'Buckeye Shred', short: 'Buckeye', role: 'office', trucks: 2, plan: 'Pro', city: 'Akron', color: '#C8102E', state: 'OH', areaCodes: ['330', '216', '440', '234'], lines: [{ label: 'Main', number: '+13305550140' }, { label: 'Website', number: '+12165550141' }], phone: '(330) 555-0140', remit: ['BUCKEYE SHRED', '88 Canal Park Dr', 'Akron'] };
/* 5.1: a third business, so switching shows the picker (with two there is only one place to go). */
data.orgs[2] = { id: 'o3', name: 'Peach State Shred', short: 'Peach State', role: 'admin', trucks: 3, plan: 'Pro', city: 'Marietta', color: '#E8590C', state: 'GA', areaCodes: ['404', '770', '678', '470'], lines: [{ label: 'Main', number: '+17705550160' }, { label: 'Atlanta', number: '+14045550161' }], phone: '(770) 555-0160', remit: ['PEACH STATE SHRED', '410 Roswell St', 'Marietta'] };
const DEMO = { o2: { words: null, city: 'Akron', area: '330', domain: 'buckeyeshred', routes: ['Akron', 'Cleveland', 'Canton', 'Medina', 'Kent'], purge: { method: 'bin', binFlat: 160, binIncluded: 2, binExtra: 60 } },
  o3: { words: ['Cobb', 'Fulton', 'Peachtree', 'Marietta', 'Kennesaw', 'Roswell', 'Decatur', 'Smyrna', 'Dunwoody', 'Vinings', 'Buckhead', 'Chattahoochee', 'Alpharetta', 'Piedmont', 'Druid Hills', 'Acworth', 'Woodstock', 'Sandy Springs', 'Midtown', 'Gwinnett'], city: 'Marietta', area: '770', domain: 'peachstateshred', routes: ['Marietta', 'Atlanta', 'Alpharetta', 'Decatur', 'Kennesaw'], purge: null } };
const clone = (v, seen = new Map()) => { if (v === null || typeof v !== 'object') return v; if (seen.has(v)) return seen.get(v); if (v instanceof Date) return new Date(+v); if (v instanceof Set) return new Set(v); if (v instanceof Map) return new Map(v); if (v instanceof Node) return v;
  const out = Array.isArray(v) ? [] : Object.create(Object.getPrototypeOf(v)); seen.set(v, out);
  Object.keys(v).forEach(k => { const d = Object.getOwnPropertyDescriptor(v, k); if (d.get || d.set) Object.defineProperty(out, k, d); else out[k] = clone(v[k], seen); }); return out; };
let pristine = null; const stash = {}; O.dataOrg = 'o1';
/** Take the untouched copy the other business is built from. Called once, when the app starts. */
O.snapshot = () => { if (!pristine) { const src = {}; Object.keys(data).filter(k => !SHARED.includes(k)).forEach(k => { src[k] = data[k]; }); pristine = clone(src); } };
const OHIO0 = ['Summit', 'Cuyahoga', 'Portage', 'Medina', 'Tallmadge', 'Hudson', 'Stow', 'Canal', 'Erie', 'Buckeye', 'Wooster', 'Barberton', 'Fairlawn', 'Copley', 'Kent', 'Ravenna', 'Brecksville', 'Wadsworth', 'Massillon', 'Green'];
const CITY = ['Akron', 'Cuyahoga Falls', 'Kent', 'Stow', 'Hudson', 'Medina'];
function build(orgId) {
  const d = clone(pristine), org = data.orgs.find(o => o.id === orgId), names = {}, used = new Set(), Z = DEMO[orgId] || DEMO.o2, OHIO = Z.words || OHIO0;
  (d.customers || []).forEach((c, i) => { const w = String(c.name || '').split(' '); let n = w.length > 1 ? OHIO[i % OHIO.length] + ' ' + w.slice(1).join(' ') : c.name; let k = 1; while (used.has(n)) n = OHIO[(i + k++) % OHIO.length] + ' ' + w.slice(1).join(' '); used.add(n); if (n !== c.name) names[c.name] = n; });
  const keys = Object.keys(names).sort((a, b) => b.length - a.length), cities = {};
  const fix = s => { if (s.length < 3) return s; let t = s; keys.forEach(k => { if (t.includes(k)) t = t.split(k).join(names[k]); });
    return t.split('Discount Shred').join(org.name).split('DISCOUNT SHRED').join(org.name.toUpperCase()).split('discountshred').join(Z.domain).split('Lakemont').join(Z.city).replace(/\(512\)/g, '(' + Z.area + ')').replace(/\b512-555/g, Z.area + '-555').replace(/\+1512/g, '+1' + Z.area).replace(/\b512555/g, Z.area + '555'); };
  const walk = (v, seen = new Set()) => { if (!v || typeof v !== 'object' || seen.has(v) || v instanceof Date || v instanceof Node) return; seen.add(v);
    Object.keys(v).forEach(k => { const d2 = Object.getOwnPropertyDescriptor(v, k); if (d2.get || d2.set) return; const x = v[k]; if (typeof x === 'string') { const y = fix(x); if (y !== x) v[k] = y; } else walk(x, seen); }); };
  walk(d); void cities; void CITY;
  if (d.purgePricing && Z.purge) Object.assign(d.purgePricing, Z.purge);
  (d.routes || []).forEach((r, i) => { r.name = Z.routes[i] || r.name; if (r.nickname) r.nickname = r.name; });
  if (WD.syncPurgeBook) { const keep = data.purgePricing, kb = data.priceBook, kr = data.purgeRules; try { data.purgePricing = d.purgePricing; data.priceBook = d.priceBook; data.purgeRules = d.purgeRules; WD.syncPurgeBook(); } catch (e) { /* the copy keeps the first business's price list */ } data.purgePricing = keep; data.priceBook = kb; data.purgeRules = kr; }
  return d;
}
/** The data of a business that is not in front (built the first time it is needed). The business in front is WD.data itself. */
O.dataOf = id => { if (id === O.dataOrg) return data; O.snapshot(); return stash[id] || (stash[id] = build(id)); };
function swap(to) {
  if (to === O.dataOrg) return; O.snapshot(); const next = O.dataOf(to), cur = {};
  Object.keys(data).filter(k => !SHARED.includes(k)).forEach(k => { cur[k] = data[k]; delete data[k]; });
  stash[O.dataOrg] = cur; Object.assign(data, next); delete stash[to]; O.dataOrg = to;
}
WD.on('orgSwap', e => swap(e.to));
/** Sign-in company picker: start in this business. */
R.startIn = id => { const o = data.orgs.find(x => x.id === id) || data.orgs[0]; swap(o.id); S.org = o; S.me = (data.users || []).find(u => u.id === (S.me || {}).id) || S.me; };
const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
/** Which business is a call for? Looks for the caller in every business's customers and leads first (by = 'customer'); if nobody matches,
    or more than one business knows the number, the Quo line that rang decides (by = 'line'); with no line, the caller's area code (by = 'area').
    → {org, customer, contact, by, also: [other orgs that know the number]}. o: {to: the Quo number that was called}. */
O.findCaller = (number, o = {}) => {
  const n = digits(number), hits = [];
  data.orgs.forEach(org => { const d = O.dataOf(org.id); for (const c of d.customers || []) { const p = (c.contacts || []).find(x => digits(x.phone) === n); if (p) { hits.push({ org, customer: c, contact: p }); break; } } });
  const line = o.to && data.orgs.find(org => (org.lines || []).some(l => digits(l.number) === digits(o.to)));
  if (hits.length === 1) return { ...hits[0], by: 'customer', also: [] };
  if (hits.length > 1) { const pick = hits.find(x => line && x.org === line) || hits.find(x => (x.org.areaCodes || []).includes(n.slice(0, 3))) || hits[0]; return { ...pick, by: line && pick.org === line ? 'line' : 'customer', also: hits.filter(x => x !== pick).map(x => x.org) }; }
  if (line) return { org: line, customer: null, contact: null, by: 'line', also: [] };
  const area = data.orgs.find(org => (org.areaCodes || []).includes(n.slice(0, 3)));
  return { org: area || S.org || data.orgs[0], customer: null, contact: null, by: area ? 'area' : 'none', also: [] };
};
O.current = () => S.org || data.orgs[0];
O.areaSpec = () => ({ title: 'Businesses and area codes', render: page => ui.list(
  note('When a call comes in from Quo, the app opens the business it is for. It looks the caller up in each business’s customers and leads first. If nobody matches, the Quo number they dialed decides; if that is shared, the caller’s area code does.'),
  data.orgs.map(o => ui.section({ header: o.name, fold: false, footer: 'Area codes are the fallback for callers nobody recognizes.' },
    ui.row({ icon: 'phone.fill', iconColor: 'var(--green)', title: 'Quo numbers', subtitle: (o.lines || []).map(l => l.label + ' ' + fmt.phone(l.number)).join(' · ') }),
    ui.row({ icon: 'map', iconColor: 'var(--blue)', title: 'Area codes', subtitle: (o.areaCodes || []).join(', ') || 'None', trailing: admin() ? ui.button('Edit', { kind: 'gray', small: true, block: false, onTap: async () => { const v = await RC.ask('Area codes for ' + o.name, '330, 216', (o.areaCodes || []).join(', '), 'Separate them with commas.'); if (v != null) { o.areaCodes = v.split(/[^0-9]+/).filter(x => x.length === 3); WD.changed(); page.refresh(); } } }) : null }))),
  ui.section({ header: 'When a call comes in', fold: false },
    ui.toggleRow({ title: 'Open the caller’s business automatically', subtitle: 'The business you were in is kept exactly as you left it and comes back when you switch', value: S.prefs.callSwitch !== false, onChange: v => { S.prefs.callSwitch = v; WD.changed(); } }),
    ui.toggleRow({ title: 'Ask first when I have unsaved work open', subtitle: 'A banner offers the switch instead of switching by itself', value: !!S.prefs.callAsk, onChange: v => { S.prefs.callAsk = v; WD.changed(); } }))) });
R.addSetting('Company', (push, gated) => data.orgs.length > 1 && R.link(push, gated, null, 'phone.fill', 'var(--green)', 'Businesses and area codes', 'Which business a call opens: customer match, the number dialed, then area code', O.areaSpec));

/* ================= Scheduling style ================= */
/* Some businesses run on stop order (a route's day is an ordered list); others run on a calendar (every job has a start time).
   data.sched.mode = 'order' | 'calendar'. Board, job editor and Shift read WD.r14.calendar(). */
data.sched = data.sched || { mode: 'order', slot: 30, dayStart: 7 * 60, dayEnd: 18 * 60 };
R.calendar = () => (data.sched || {}).mode === 'calendar';
R.schedSpec = () => ({ title: 'Scheduling style', render: page => { const Z = data.sched, re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('Choose how this business plans its days. Route businesses usually run on stop order: the day is a list and the driver works down it. Appointment businesses run on a calendar: every job has a start time and a length.'),
    ui.section({ header: 'This business runs on', fold: false, showFooter: true, footer: Z.mode === 'calendar' ? 'Every job asks for a start time. The board lists each route’s day by time and shows the time on each card; a job that overlaps another is flagged. AutoRoute keeps the times you set and only orders the jobs that have none.' : 'Jobs have no times: stop 1 is done first. A customer’s requested window and exact-time jobs still work.' },
      h('div', { style: 'padding:10px 16px;background:var(--cell)' }, ui.segmented([{ value: 'order', label: 'Stop order' }, { value: 'calendar', label: 'Calendar times' }], Z.mode, v => { Z.mode = v; re(); ui.toast(v === 'calendar' ? 'Jobs are scheduled by time' : 'Jobs are scheduled by stop order', 'checkmark'); }))),
    Z.mode === 'calendar' && ui.section({ header: 'Calendar', fold: false },
      ui.pickerRow({ title: 'Times snap to', value: Z.slot, options: [15, 30, 60].map(v => ({ value: v, label: v + ' minutes' })), onChange: v => { Z.slot = v; re(); } }),
      ui.quarterRow({ title: 'Day starts', value: fmt.hm ? fmt.hm(Z.dayStart) : String(Math.floor(Z.dayStart / 60)).padStart(2, '0') + ':' + String(Z.dayStart % 60).padStart(2, '0'), onChange: v => { if (v) { const [a, b] = v.split(':'); Z.dayStart = +a * 60 + +b; re(); } } }),
      ui.quarterRow({ title: 'Day ends', value: String(Math.floor(Z.dayEnd / 60)).padStart(2, '0') + ':' + String(Z.dayEnd % 60).padStart(2, '0'), onChange: v => { if (v) { const [a, b] = v.split(':'); Z.dayEnd = +a * 60 + +b; re(); } } }))); } });
R.addSetting('Company', (push, gated) => R.link(push, gated, 'settings.manage', 'calendar', 'var(--orange)', 'Scheduling style', 'Run on stop order or on a calendar with times', R.schedSpec, R.calendar() ? 'Calendar' : 'Stop order'));

WD.on('desktop', on => { if (on && S.board.cols !== 'all') S.board.cols = 'all'; });
WD.panel.addJump('Businesses', () => { WD.nav.switchTab('settings'); WD.nav.push(O.areaSpec()); });
})();
