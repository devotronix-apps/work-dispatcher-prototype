/* RouteClerk prototype 5.2 — how the product is packaged.
   WD.modules: the module registry. A module is a set of sections; an edition is a set of modules. The onboarding interview, the plan
               editor and the stand-alone app editions all read this one table, so a new stand-alone app is one more entry in M.editions.
   WD.plans:   the RouteClerk console (ours, not the customer's): which regular and AI features each plan includes, the free trial for
               new companies, and promotions that unlock features for a while with a pop-up when they start and when they end.
   WD.onboard: the AI interview a new company answers; it decides which sections show and which sit in the bottom bar.
   WD.files:   Company Files, the documents people ask for (W-9, license, COI, references…), which most employees can send.
   Loaded last, so it can wrap RC.ai, WD.aip.on and app.dests. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, app } = WD, RC = WD.rc || {}, PL = data.plan;
const plural = RC.plural || ((n, w) => n + ' ' + w + (n === 1 ? '' : 's')), now = () => +WD.now(), today = () => D.today(), me = () => (S.me && S.me.name) || 'You', first = n => String(n || '').split(' ')[0];
const admin = () => ['owner', 'admin'].includes((S.me || {}).role), officeRole = () => ['owner', 'admin', 'dispatcher', 'office'].includes((S.me || {}).role);
const ask = (title, ph, value, msg, type) => RC.ask ? RC.ask(title, ph, value, msg, type) : Promise.resolve(null), aiCard = o => RC.aiCard ? RC.aiCard(o) : h('div', o.text);
const org = () => S.org || (data.orgs || [])[0] || { id: 'o', name: 'RouteClerk' };

WD.css(`
.pl-mx { background: var(--cell); border-radius: 12px; overflow-x: auto; }
.pl-mx table { border-collapse: collapse; width: 100%; font-size: 14px; }
.pl-mx th, .pl-mx td { padding: 0 8px; height: 44px; border-top: 1px solid var(--sep); text-align: center; white-space: nowrap; }
.pl-mx thead th { border-top: 0; font-size: 13px; vertical-align: bottom; padding-bottom: 6px; height: 56px; cursor: pointer; } .pl-mx thead th small { display: block; font-weight: 400; color: var(--label2); font-size: 12px; }
.pl-mx th:first-child, .pl-mx td:first-child { text-align: left; position: sticky; left: 0; background: var(--cell); white-space: normal; min-width: 150px; }
.pl-mx tr.g td { background: var(--fill3); font-size: 12px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: var(--label2); height: 30px; }
.pl-ck { appearance: none; border: 0; background: none; width: 44px; height: 44px; cursor: pointer; color: var(--label3); } .pl-ck.on { color: var(--green); } .pl-ck:disabled { cursor: default; }
.ob { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px 24px; }
.ob-b { max-width: 86%; padding: 10px 14px; border-radius: 18px; font-size: 16px; line-height: 21px; background: var(--cell); align-self: flex-start; } .ob-b.me { align-self: flex-end; background: var(--tint); color: #fff; }
.ob-b.ai::before { content: 'RouteClerk AI'; display: block; font-size: 12px; font-weight: 700; color: var(--purple); letter-spacing: .3px; margin-bottom: 2px; }
.ob-ch { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 0; }
.ob-c { appearance: none; border: 1.5px solid var(--sep); background: var(--cell); color: var(--label); border-radius: 22px; min-height: 44px; padding: 0 16px; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-align: left; } .ob-c.on { border-color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, var(--cell)); color: var(--tint); font-weight: 600; }
.ob-plan { background: var(--cell); border-radius: 14px; padding: 12px 14px; } .ob-plan h4 { margin: 10px 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .3px; color: var(--label2); } .ob-plan h4:first-child { margin-top: 0; }
.ob-tabs { display: flex; gap: 6px; flex-wrap: wrap; } .ob-tab { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 12px; width: 68px; padding: 8px 2px; border-radius: 10px; background: var(--fill3); text-align: center; color: var(--tint); }
.cf-paper { background: #fff; color: #1c1c1e; border-radius: 6px; box-shadow: 0 1px 6px rgba(0,0,0,.18); padding: 22px 20px; margin: 4px 14px 14px; font-size: 13px; line-height: 18px; min-height: 190px; } .cf-paper h5 { margin: 0 0 2px; font-size: 16px; } .cf-paper hr { border: 0; border-top: 1px solid #d1d1d6; margin: 10px 0; } .cf-paper .l { height: 7px; background: #e5e5ea; border-radius: 4px; margin: 7px 0; }
`);

/* ================= Modules and editions ================= */
const M = WD.modules = {};
M.list = [
  { id: 'dispatch', name: 'Routes and dispatch', icon: 'calendar', sections: ['board', 'map', 'shift'], ask: 'Schedule jobs and plan routes for drivers' },
  { id: 'invoicing', name: 'Invoicing', icon: 'doc.text', sections: ['invoices', 'customers', 'services', 'products'], ask: 'Send invoices and get paid' },
  { id: 'phone', name: 'Phone and texts', icon: 'phone', sections: ['dialer'], ask: 'Calls and texts with customers, logged by person' },
  { id: 'crm', name: 'Leads and CRM', icon: 'filter', sections: ['office', 'customers'], ask: 'Track leads, follow-ups and customer requests' },
  { id: 'pricing', name: 'Quotes and pricing', icon: 'dollarsign.circle', sections: ['calc', 'services'], ask: 'Quote prices quickly and consistently' },
  { id: 'contracts', name: 'Contracts', icon: 'signature', sections: ['contracts'], ask: 'Service agreements and renewals' },
  { id: 'fleet', name: 'Trucks and maintenance', icon: 'truck', sections: ['maintenance'], ask: 'Keep trucks inspected and maintained' },
  { id: 'reports', name: 'Reports', icon: 'chart.bar', sections: ['reports'], ask: 'See revenue, routes and how the team is doing' },
  { id: 'files', name: 'Company files', icon: 'doc', sections: ['files'], ask: 'Keep the W-9, COI and other documents ready to send' },
  { id: 'bids', name: 'Bids and prospects', icon: 'flag', sections: ['bids'], ask: 'Find and win government and large contracts' },
];
/** A stand-alone app is an edition: a name and the modules it ships with. 'full' is RouteClerk itself. */
M.editions = [
  { id: 'full', name: 'RouteClerk', short: 'Full app', modules: null },
  { id: 'invoices', name: 'RouteClerk Invoices', short: 'Invoices', modules: ['invoicing', 'pricing', 'reports', 'files'] },
  { id: 'dispatch', name: 'RouteClerk Dispatch', short: 'Dispatch', modules: ['dispatch', 'fleet'] },
  { id: 'desk', name: 'RouteClerk Front Desk', short: 'Front Desk', modules: ['phone', 'crm', 'files'] },
  { id: 'bids', name: 'RouteClerk Bids', short: 'Bids', modules: ['bids', 'files'] },
];
M.module = id => M.list.find(m => m.id === id);
M.sectionsOf = ids => [...new Set(ids.flatMap(id => (M.module(id) || { sections: [] }).sections))];
M.edition = () => M.editions.find(e => e.id === (PL.edition || 'full')) || M.editions[0];
M.inEdition = id => { const e = M.edition(); return !e.modules || M.sectionsOf(e.modules).includes(id); };
let fullLayout = null;
M.setEdition = id => { const was = M.edition(), e = M.editions.find(x => x.id === id) || M.editions[0]; if (was === e) return; const P0 = S.prefs || {};
  if (!was.modules) fullLayout = { bar: P0.bar, order: P0.order, hidden: P0.hidden };
  PL.edition = e.id; app.setLayout(p => { if (!e.modules) Object.assign(p, fullLayout || { bar: null, order: null, hidden: {} }); else { const sec = M.sectionsOf(e.modules); p.bar = sec.slice(0, 4); p.order = sec.slice(4); p.hidden = {}; } });
  if (S.signedIn) app.showMain(); ui.toast(e.modules ? e.name + ': ' + e.modules.map(x => M.module(x).name.toLowerCase()).join(', ') : 'The full app', 'square.grid', 2600); };

/* ================= Plans, trial and promotions ================= */
const P = WD.plans = {};
const REG = [['map', 'Map'], ['dialer', 'Dialer: calls and texts'], ['office', 'CRM and the Admin tab'], ['customers', 'Customers'], ['invoices', 'Invoices'], ['shift', 'Shift and time clock'], ['services', 'Services and Fees'], ['products', 'Products'], ['contracts', 'Contracts'], ['reports', 'Reports'], ['calc', 'Price Calc'], ['maintenance', 'Maintenance'], ['files', 'Company Files'], ['staffreports', 'Office staff reports']];
P.features = () => REG.map(([id, name]) => ({ id, name, kind: 'regular' })).concat((RC.AI || []).map(f => ({ id: f.id, name: f.name, kind: 'ai', where: f.where, addon: f.tier === 'premium' })), [{ id: 'aipremium', name: 'Everything else in AI Premium', kind: 'ai', addon: true, where: 'reviews, audits, coaching, staffing' }]);
const featName = id => (P.features().find(f => f.id === id) || { name: id }).name;
P.plans = () => (RC.TIERS || []).filter(t => t.id !== 'premium');
if (!PL.matrix) { const all = P.features(), base = t => Object.fromEntries(all.filter(f => f.kind === 'regular' ? t === 'pro' || !['contracts', 'maintenance', 'products', 'staffreports'].includes(f.id) : !f.addon && ((RC.AI.find(x => x.id === f.id) || {}).tier === 'starter' || t === 'pro')).map(f => [f.id, true]));
  PL.matrix = { starter: base('starter'), pro: base('pro') }; PL.prices = { starter: 49, pro: 129 };
  PL.trialCfg = { days: 14, feats: ['contracts', 'maintenance', 'products', 'staffreports', 'pricing', 'collect', 'invcheck', 'traffic', 'aipremium'], startTitle: 'Welcome to RouteClerk', startMsg: 'Everything is unlocked for your first {days} days, including the AI assistants. Nothing is charged during the trial.', endTitle: 'Your free trial has ended', endMsg: 'The extra features you were trying are switched off now. Your data is all still here. Pick a plan to bring them back.' };
  PL.promos = [{ id: 'pm1', name: 'Loyal customer week', days: 7, feats: ['contracts', 'maintenance', 'products', 'staffreports', 'pricing', 'collect', 'invcheck', 'traffic', 'aipremium'], startTitle: 'Congratulations, loyal customer!', startMsg: 'We have unlocked premium features for your account for free for the next week. We hope it makes your life easier and your business run smoother! Enjoy!', endTitle: 'Your free week has ended', endMsg: 'We hope the premium features helped. They are switched off again now; upgrade any time to keep them.' }];
  PL.grants = []; }
const live = () => (PL.grants || []).filter(g => !g.ended && g.until >= today());
P.has = id => !!(PL.matrix[PL.tier] || {})[id];
P.grantFor = id => live().find(g => g.feats.includes(id)) || null;
const known = id => P.features().some(f => f.id === id);
/** Is a feature on for this company: in its plan, or unlocked by a running trial or promotion. Unknown ids are never gated. */
P.allows = id => !known(id) || P.has(id) || !!P.grantFor(id);
const fill = (s, g) => String(s || '').replace('{days}', g.days).replace('{date}', fmt.day(g.until, 'long')).replace('{company}', org().name);
/** Unlock features for this company and put the message on everyone's screen. */
P.give = (def, kind) => { const g = { id: 'g' + Date.now().toString(36), kind, name: def.name || 'Free trial', feats: def.feats.slice(), days: def.days, until: D.add(today(), def.days), endTitle: def.endTitle, endMsg: def.endMsg, ended: false }; PL.grants.push(g); WD.changed();
  ui.alert({ title: fill(def.startTitle, g), message: fill(def.startMsg, g) + '\n\nUnlocked until ' + fmt.day(g.until, 'long') + ': ' + g.feats.map(featName).join(', ') + '.', buttons: [{ label: 'See my plan', value: 'plan' }, { label: 'Thanks!', value: null, bold: true }] }).then(v => { if (v === 'plan') { WD.nav.switchTab('settings'); WD.nav.push(RC.planSpec()); } }); return g; };
let showing = false;
/** A grant that ran out says so once, with the message we wrote for it. */
P.tick = () => { if (showing || !S.signedIn || !WD.nav.activeTab || !WD.nav.activeTab()) return; const g = (PL.grants || []).find(x => !x.ended && x.until < today()); if (!g) return; g.ended = true; showing = true; WD.changed();
  ui.alert({ title: fill(g.endTitle, g) || g.name + ' has ended', message: fill(g.endMsg, g) + '\n\nSwitched off: ' + g.feats.filter(id => !P.has(id)).map(featName).join(', ') + '.', buttons: [{ label: 'See plans', value: 'plan' }, { label: 'OK', value: null, bold: true }] }).then(v => { showing = false; if (v === 'plan') { WD.nav.switchTab('settings'); WD.nav.push(RC.planSpec()); } P.tick(); }); };
P.endNow = g => { g.until = D.add(today(), -1); WD.changed(); };

/* Gating. AI features: in the plan, or unlocked, or (AI Premium ones) covered by the add-on. Sections: in the edition and in the plan. */
if (WD.aip) { const on0 = WD.aip.on; WD.aip.on = () => on0() || P.has('aipremium') || !!P.grantFor('aipremium'); }
const prem = f => f.tier === 'premium';
RC.ai = id => { const f = (RC.AI || []).find(x => x.id === id); return !!f && !PL.off[id] && (P.has(id) || !!P.grantFor(id) || (prem(f) && !!WD.aip && WD.aip.on())); };
RC.aiBlock = (id, build) => { const f = (RC.AI || []).find(x => x.id === id); if (!f) return null; if (RC.ai(id)) return build(); if (prem(f) || PL.off[id]) return null;
  const up = P.plans().find(t => (PL.matrix[t.id] || {})[id]);
  return h('div.rc-ai.lock', h('div.k', icon('lock', 14), f.name + (up ? ' · ' + up.name + ' plan' : '')), h('div', f.text), WD.can('settings.manage') ? ui.button('See plans', { kind: 'tinted', small: true, icon: 'sparkles', onTap: () => WD.nav.push(RC.planSpec()) }) : h('div.footnote.secondary', { style: 'margin-top:6px' }, 'Ask an owner or admin about your plan.')); };
const dests0 = app.dests;
app.dests = () => dests0().filter(d => d.fixed || (M.inEdition(d.id) && (d.id === 'board' || P.allows(d.id))));
const bar0 = app.barIds;
app.barIds = () => S.desktop ? bar0().filter(id => !((S.prefs || {}).hidden || {})[id]) : bar0();   // 5.2: hidden sections stay hidden on the website too
let sig = null;
WD.on('change', () => { if (!S.signedIn) return; const s = app.dests().map(d => d.id).join(); if (sig != null && s !== sig) { sig = s; app.setLayout(() => {}); } sig = s; setTimeout(P.tick, 400); });
if (WD.staff) { const rep0 = WD.staff.reportSpec; WD.staff.reportSpec = () => P.allows('staffreports') ? rep0() : { title: 'Office staff reports', render: () => ui.empty({ icon: 'lock', title: 'Not in your plan', text: 'Office staff reports are part of a higher plan. An owner can change the plan in Settings.' }) }; }

const featPicker = (title, list, note) => ({ title, render: page => { const re = () => { WD.changed(); page.refresh(); }, row = f => ui.toggleRow({ title: f.name, subtitle: f.kind === 'ai' ? 'AI' + (f.where ? ' · ' + f.where : '') : null, value: list.includes(f.id), onChange: v => { const i = list.indexOf(f.id); if (v && i < 0) list.push(f.id); if (!v && i >= 0) list.splice(i, 1); re(); } }), fs = P.features();
  return ui.list(note && ui.note(note), ui.section({ header: 'Regular features', fold: false }, fs.filter(f => f.kind === 'regular').map(row)), ui.section({ header: 'AI features', fold: false }, fs.filter(f => f.kind === 'ai').map(row)),
    ui.section(null, ui.row({ title: 'Everything', tint: true, center: true, onTap: () => { list.splice(0, list.length, ...fs.map(f => f.id)); re(); } }), ui.row({ title: 'Nothing', center: true, onTap: () => { list.splice(0); re(); } }))); } });
const msgRows = (o, re) => [ui.inputRow({ label: 'Pop-up title', value: o.startTitle, onInput: v => { o.startTitle = v; } }), ui.inputRow({ label: 'Message', multiline: true, value: o.startMsg, onInput: v => { o.startMsg = v; } }),
  ui.inputRow({ label: 'When it ends: title', value: o.endTitle, onInput: v => { o.endTitle = v; } }), ui.inputRow({ label: 'When it ends: message', multiline: true, value: o.endMsg, onInput: v => { o.endMsg = v; } })];
const preview = (title, msg, g) => ui.alert({ title: fill(title, g), message: fill(msg, g), buttons: [{ label: 'Close preview', bold: true }] });
const promoSpec = pm => ({ title: 'Promotion', render: page => { const re = () => { WD.changed(); page.refresh(); }, g = { days: pm.days, until: D.add(today(), pm.days) };
  return ui.list(ui.section({ header: 'What it unlocks', fold: false },
      ui.inputRow({ label: 'Name (only we see it)', value: pm.name, onInput: v => { pm.name = v; } }),
      ui.pickerRow({ title: 'Lasts', value: pm.days, options: [3, 7, 14, 30, 60, 90].map(v => ({ value: v, label: plural(v, 'day') })), onChange: v => { pm.days = v; re(); } }),
      ui.row({ title: 'Features', detail: plural(pm.feats.length, 'feature'), subtitle: pm.feats.map(featName).join(', ') || 'None chosen', chevron: true, onTap: () => page.push(featPicker('Unlocked by this promotion', pm.feats, 'Features a company already has in its plan are not affected.')) })),
    ui.section({ header: 'What the customer sees', fold: false, showFooter: true, footer: 'The pop-up covers the screen of everyone in the company until they close it. {days}, {date} and {company} are filled in.' }, msgRows(pm, re),
      ui.row({ title: 'Preview the start pop-up', tint: true, onTap: () => preview(pm.startTitle, pm.startMsg, g) }), ui.row({ title: 'Preview the end pop-up', tint: true, onTap: () => preview(pm.endTitle, pm.endMsg, g) })),
    ui.section({ header: 'Send it', fold: false, footer: 'Sending to a group is not part of the prototype; it shows how many companies it would reach.' },
      ui.row({ icon: 'bolt', iconColor: 'var(--orange)', title: 'Send to ' + org().name + ' now', subtitle: 'The pop-up appears on this screen', onTap: () => { if (!pm.feats.length) return ui.toast('Choose at least one feature', 'exclamationmark.circle'); WD.nav.pop(); setTimeout(() => P.give(pm, 'promo'), 350); } }),
      P.plans().map(t => ui.row({ title: 'Send to every company on ' + t.name, detail: (t.id === 'starter' ? 212 : 388) + ' companies', onTap: async () => { if (await ui.alert({ title: 'Send to ' + (t.id === 'starter' ? 212 : 388) + ' companies?', message: 'Each one gets the pop-up the next time someone opens the app.', buttons: [{ label: 'Cancel', value: false }, { label: 'Send', value: true, bold: true }] })) ui.run('Scheduling…', () => {}, { done: 'Scheduled' }); } }))),
    ui.section(null, ui.row({ title: 'Delete this promotion', destructive: true, center: true, onTap: () => { PL.promos = PL.promos.filter(x => x !== pm); WD.changed(); page.pop(); } }))); } });
const trialSpec = () => ({ title: 'Free trial', render: page => { const c = PL.trialCfg, re = () => { WD.changed(); page.refresh(); }, g = { days: c.days, until: D.add(today(), c.days) };
  return ui.list(ui.note('What a new company gets on top of the plan it picked, and for how long. When it ends, the features that are not in its plan switch off and the end pop-up says so.'),
    ui.section({ header: 'Trial', fold: false }, ui.pickerRow({ title: 'Length', value: c.days, options: [7, 14, 21, 30, 45, 60].map(v => ({ value: v, label: plural(v, 'day') })), onChange: v => { c.days = v; re(); } }),
      ui.row({ title: 'Features in the trial', detail: plural(c.feats.length, 'feature'), subtitle: c.feats.map(featName).join(', ') || 'None', chevron: true, onTap: () => page.push(featPicker('Features in the trial', c.feats, 'Usually the features of the higher plans, so a new company sees what an upgrade would add.')) })),
    ui.section({ header: 'Messages', fold: false, showFooter: true, footer: '{days}, {date} and {company} are filled in.' }, msgRows(c, re), ui.row({ title: 'Preview the start pop-up', tint: true, onTap: () => preview(c.startTitle, c.startMsg, g) }), ui.row({ title: 'Preview the end pop-up', tint: true, onTap: () => preview(c.endTitle, c.endMsg, g) })),
    ui.section(null, ui.row({ icon: 'play', iconColor: 'var(--green)', title: 'Start a trial for ' + org().name, subtitle: 'As if the company had just signed up', onTap: () => { WD.nav.pop(); setTimeout(() => P.give(c, 'trial'), 350); } }))); } });
const editPlan = async (t, page) => { const v = await ui.actionSheet({ title: t.name + ' · ' + fmt.money(PL.prices[t.id] || 0) + ' a month', buttons: [{ label: 'Rename', value: 'name' }, { label: 'Change the price', value: 'price' }, { label: 'Copy as a new plan', value: 'copy' }].concat(P.plans().length > 1 ? [{ label: 'Delete this plan', value: 'del', role: 'destructive' }] : []) });
  if (v === 'name') { const n = await ask('Plan name', 'e.g. Growth', t.name); if (n) t.name = n; }
  if (v === 'price') { const n = await ask('Monthly price', '99', String(PL.prices[t.id] || 0), null, 'number'); if (n != null && !isNaN(+n)) PL.prices[t.id] = +n; }
  if (v === 'copy') P.addPlan(t.name + ' Plus', t.id);
  if (v === 'del') { const i = RC.TIERS.indexOf(t); RC.TIERS.splice(i, 1); delete PL.matrix[t.id]; if (PL.tier === t.id) PL.tier = P.plans()[0].id; }
  WD.changed(); page.refresh(); };
P.addPlan = (name, from) => { const id = 'p' + Date.now().toString(36), i = RC.TIERS.findIndex(t => t.id === 'premium'), colors = ['var(--teal)', 'var(--indigo)', 'var(--orange)', 'var(--pink)']; RC.TIERS.splice(i < 0 ? RC.TIERS.length : i, 0, { id, name, color: colors[P.plans().length % 4] });
  PL.matrix[id] = Object.assign({}, PL.matrix[from] || {}); PL.prices[id] = Math.round((PL.prices[from] || 99) * 1.5); return id; };
/** The RouteClerk console. In the product this is our own admin site; a customer never sees it. */
P.consoleSpec = () => ({ title: 'RouteClerk console', class: 'wide', render: page => { const plans = P.plans(), fs = P.features(), re = () => { WD.changed(); page.refresh(); };
  const body = kind => fs.filter(f => f.kind === kind).map(f => h('tr', h('td', f.name, f.addon && h('div.caption.secondary', 'also sold in the AI Premium add-on')), plans.map(t => h('td', h('button.pl-ck' + (PL.matrix[t.id][f.id] ? '.on' : ''), { 'aria-label': f.name + ' in ' + t.name, 'aria-pressed': String(!!PL.matrix[t.id][f.id]), onclick: () => { PL.matrix[t.id][f.id] = !PL.matrix[t.id][f.id]; re(); } }, icon(PL.matrix[t.id][f.id] ? 'checkmark.circle.fill' : 'circle', 24))))));
  return ui.list(ui.note('This screen is ours, not the customer’s: it stands in for RouteClerk’s admin site. Changes take effect at once for the demo company, so you can switch plans in the panel and see what each one shows.'),
    ui.section({ header: 'Plans and what they include', fold: false, showFooter: true, footer: 'Tap a check to add or remove a feature from a plan. Tap a plan’s name to rename it, price it, copy it or delete it. Dispatch and Settings are in every plan.' },
      h('div.pl-mx', h('table', h('thead', h('tr', h('th', 'Feature'), plans.map(t => h('th', { onclick: () => editPlan(t, page) }, t.name, h('small', fmt.money(PL.prices[t.id] || 0) + '/mo'), h('small', t.id === PL.tier ? 'demo company' : ' '))))),
        h('tbody', h('tr.g', h('td', { colSpan: plans.length + 1 }, 'Regular features')), body('regular'), h('tr.g', h('td', { colSpan: plans.length + 1 }, 'AI features')), body('ai')))),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a plan', tint: true, onTap: async () => { const n = await ask('New plan', 'e.g. Growth'); if (n) { P.addPlan(n, plans[plans.length - 1].id); re(); } } })),
    ui.section({ header: 'Free trial for new companies', fold: false }, ui.row({ icon: 'timer', iconColor: 'var(--green)', title: plural(PL.trialCfg.days, 'day') + ' · ' + plural(PL.trialCfg.feats.length, 'extra feature'), subtitle: PL.trialCfg.feats.map(featName).join(', '), chevron: true, onTap: () => page.push(trialSpec()) })),
    ui.section({ header: 'Promotions', fold: false, footer: 'A promotion unlocks features for a set time and puts your message on the customer’s screen when it starts and when it ends.' },
      PL.promos.map(pm => ui.row({ icon: 'star.fill', iconColor: 'var(--orange)', title: pm.name, subtitle: plural(pm.days, 'day') + ' · ' + plural(pm.feats.length, 'feature') + ' · “' + pm.startTitle + '”', chevron: true, onTap: () => page.push(promoSpec(pm)) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New promotion', tint: true, onTap: () => { const pm = { id: 'pm' + Date.now().toString(36), name: 'New promotion', days: 7, feats: [], startTitle: 'A gift from RouteClerk', startMsg: 'We have unlocked extra features for {company}, free until {date}. Enjoy!', endTitle: 'Your free features have ended', endMsg: 'We hope they helped. Upgrade any time to keep them.' }; PL.promos.push(pm); page.push(promoSpec(pm)); } })),
    ui.section({ header: 'Running for ' + org().name, fold: false }, live().length ? live().map(g => ui.row({ title: g.name, subtitle: 'Ends ' + fmt.day(g.until, 'long') + ' · ' + plural(g.feats.length, 'feature'), trailing: ui.button('End now', { small: true, kind: 'gray', block: false, onTap: () => P.endNow(g) }) })) : ui.row({ title: 'No trial or promotion is running' })),
    ui.section({ header: 'Stand-alone apps', fold: false, showFooter: true, footer: 'Each edition is a list of modules in one table (WD.modules). Choosing one here shows the app as that product would ship.' },
      M.editions.map(e => ui.row({ title: e.name, subtitle: e.modules ? e.modules.map(x => M.module(x).name).join(', ') : 'Every module', trailing: M.edition() === e ? icon('checkmark', 18, 'var(--tint)') : null, onTap: () => { M.setEdition(e.id); } })))); } });

/* The customer's own plan page, read from the same table. */
RC.planSpec = () => ({ title: 'Plan and AI features', render: page => { if (!WD.can('billing.view') && !WD.can('settings.manage')) return ui.empty({ icon: 'lock', title: 'Ask an admin' });
  const re = () => { WD.changed(); page.refresh(); }, fs = P.features(), cur = RC.TIERS.find(t => t.id === PL.tier) || P.plans()[0], inPlan = fs.filter(f => P.has(f.id)), extra = fs.filter(f => !P.has(f.id) && P.grantFor(f.id)), rest = fs.filter(f => !P.has(f.id) && !P.grantFor(f.id) && f.id !== 'aipremium');
  const ai = f => (RC.AI || []).find(x => x.id === f.id), row = (f, trailing) => ui.row({ title: f.name, subtitle: ai(f) ? ai(f).text + ' Shows in: ' + ai(f).where + '.' : null, trailing });
  return ui.list(ui.section({ header: 'Your plan', fold: false, footer: 'Prototype: choose a plan here or in the panel to see what each one includes.' },
      ui.pickerRow({ title: 'Plan', value: PL.tier, options: P.plans().map(t => ({ value: t.id, label: t.name + ' · ' + fmt.money(PL.prices[t.id] || 0) + '/mo' })), onChange: v => { PL.tier = v; re(); } }), WD.aip && WD.aip.planRow && WD.aip.planRow(page)),
    live().length ? ui.section({ header: 'Unlocked for free right now', fold: false }, live().map(g => ui.row({ icon: 'sparkles', iconPlain: true, iconColor: 'var(--purple)', title: g.name, subtitle: 'Until ' + fmt.day(g.until, 'long') + ' · nothing is charged, and it switches off by itself', detail: plural(Math.max(0, D.diff(g.until, today())), 'day') + ' left' })), extra.map(f => row(f, ui.badge('Free for now', 'var(--purple)')))) : null,
    ui.section({ header: 'In ' + cur.name, fold: false, footer: 'An admin can switch an AI feature off for the company.' }, inPlan.map(f => row(f, f.kind === 'ai' && ai(f) ? ui.toggle(!PL.off[f.id], v => { PL.off[f.id] = !v; WD.changed(); }) : icon('checkmark', 18, 'var(--green)')))),
    rest.length ? ui.section({ header: 'Not in your plan', count: rest.length }, rest.map(f => { const up = P.plans().find(t => PL.matrix[t.id][f.id]); return row(f, ui.badge(up ? up.name : f.addon ? 'AI Premium' : 'Not offered', 'var(--gray)')); })) : null,
    WD.aip && WD.aip.on() && RC.ADDONS ? ui.section({ header: 'Paid add-ons', fold: false }, RC.ADDONS.map(a => ui.row({ title: a.name, subtitle: a.text + ' ' + a.price + '.', trailing: admin() ? ui.toggle(PL.addons[a.id], v => { PL.addons[a.id] = v; WD.changed(); ui.toast(a.name + (v ? ' switched on' : ' switched off'), 'checkmark'); }) : ui.badge(PL.addons[a.id] ? 'On' : 'Off', 'var(--gray)') }))) : null); } });

/* ================= Onboarding interview ================= */
const O = WD.onboard = {};
const QS = [
  { key: 'kind', text: n => 'Welcome' + (n ? ', ' + n : '') + '! I’ll ask a few quick questions so the app opens with only what you need. What kind of business is it?', options: ['Shredding and records', 'Waste and hauling', 'Cleaning', 'Lawn, pool or pest', 'Delivery', 'Something else'] },
  { key: 'size', text: () => 'How many people will use it?', options: ['Just me', '2 to 5', '6 to 20', 'More than 20'] },
  { key: 'mods', multi: true, text: a => 'Got it, ' + String(a.kind || '').toLowerCase() + '. What do you want the app to do for you? Pick everything that applies; the rest stays out of your way.', options: () => M.list.map(m => ({ value: m.id, label: m.ask, icon: m.icon })) },
  { key: 'top', multi: true, max: 4, skip: a => (a.mods || []).length <= 3, text: () => 'Which of those will you use most days? Pick up to four for the bottom bar.', options: a => a.mods.map(id => ({ value: id, label: M.module(id).name, icon: M.module(id).icon })) },
  { key: 'where', text: () => 'Last one. Where do you mostly work?', options: ['In the office', 'In a truck', 'Both'] },
];
/** Turn the answers into a layout: what is in the bar, what is in the menu, what is hidden. */
O.plan = a => { const mods = a.mods && a.mods.length ? a.mods : ['invoicing'], top = (a.top && a.top.length ? a.top : mods).slice(), all = app.dests().filter(d => !d.fixed).map(d => d.id), wanted = M.sectionsOf(mods).filter(id => all.includes(id));
  if (a.where === 'In a truck' && wanted.includes('shift')) top.sort((x, y) => (y === 'dispatch') - (x === 'dispatch'));
  let bar = []; top.forEach(id => { const s = M.module(id).sections.find(x => wanted.includes(x) && !bar.includes(x)); if (s) bar.push(s); });
  if (a.where === 'In a truck' && wanted.includes('shift') && !bar.includes('shift')) bar.unshift('shift');
  mods.forEach(id => { const s = M.module(id).sections.find(x => wanted.includes(x)); if (s && bar.length < 4 && !bar.includes(s)) bar.push(s); });   // then one screen for each other thing they asked for
  wanted.forEach(s => { if (bar.length < 4 && !bar.includes(s)) bar.push(s); }); bar = bar.slice(0, 4);
  const menu = wanted.filter(s => !bar.includes(s)), hidden = all.filter(s => !wanted.includes(s)); return { bar, menu, hidden, mods }; };
O.apply = (a, pl) => { data.onboard = { at: now(), by: me(), answers: a }; app.setLayout(p => { p.bar = pl.bar.slice(); p.order = pl.menu.slice(); p.hidden = Object.fromEntries(pl.hidden.map(id => [id, true])); }); };
O.open = (o = {}) => { const a = {}, log = []; let step = -1, typing = false, pick = [], sheet = null;
  const title = id => { const d = app.dests().find(x => x.id === id) || app.menu.find(x => x.id === id) || app.tabs.find(x => x.id === id); return d ? d.title : id; }, ico = id => (app.tabs.concat(app.menu).find(x => x.id === id) || {}).icon || 'circle';
  const re = () => { const p = sheet && sheet.stack.top(); if (p) { p.refresh(); setTimeout(() => { p.body.scrollTop = p.body.scrollHeight; }, 30); } };
  const next = async () => { do step++; while (QS[step] && QS[step].skip && QS[step].skip(a)); typing = true; pick = []; re(); await WD.delay(650, 1000); typing = false; if (QS[step]) log.push({ ai: true, text: QS[step].text(step === 0 ? first(me()) : a) }); re(); };
  const answer = (qn, vals, labels) => { a[qn.key] = qn.multi ? vals : vals[0]; log.push({ text: labels.join(', ') }); next(); };
  sheet = ui.sheet({ title: 'Set up your app', leading: [{ label: 'Skip', onTap: p => p.dismiss() }], render: p => { const qn = QS[step], opts = qn && !typing ? (typeof qn.options === 'function' ? qn.options(a) : qn.options).map(x => typeof x === 'string' ? { value: x, label: x } : x) : [];
    const done = step >= QS.length && !typing, pl = done ? O.plan(a) : null;
    return h('div.ob', log.map(m => h('div.ob-b' + (m.ai ? '.ai' : '.me'), m.text)), typing && h('div.ob-b.ai', ui.spinner()),
      qn && !typing && h('div.ob-ch', opts.map(x => h('button.ob-c' + (pick.includes(x.value) ? '.on' : ''), { onclick: () => { if (!qn.multi) return answer(qn, [x.value], [x.label]); const i = pick.indexOf(x.value); if (i >= 0) pick.splice(i, 1); else if (!qn.max || pick.length < qn.max) pick.push(x.value); else return ui.toast('Up to ' + qn.max, 'info.circle'); p.refresh(); } }, x.icon && icon(x.icon, 16), x.label))),
      qn && !typing && qn.multi && ui.button(pick.length ? 'Continue with ' + pick.length : 'Pick at least one', { disabled: !pick.length, onTap: () => answer(qn, pick.slice(), opts.filter(x => pick.includes(x.value)).map(x => x.label)) }),
      done && [h('div.ob-b.ai', 'Here is your app. Everything you did not ask for is tucked away, not gone: Settings → Display → Tabs and menu brings any of it back, and you can run this interview again from Settings.'),
        h('div.ob-plan', h('h4', 'Bottom bar'), h('div.ob-tabs', pl.bar.map(id => h('div.ob-tab', icon(ico(id), 24), title(id))), h('div.ob-tab', { style: 'color:var(--label2)' }, icon('line.3.horizontal', 24), 'Menu')),
          h('h4', 'In the menu'), h('div', pl.menu.length ? pl.menu.map(title).join(' · ') + ' · Settings' : 'Settings'), h('h4', 'Hidden for now · ' + pl.hidden.length), h('div.secondary', pl.hidden.map(title).join(' · ') || 'Nothing')),
        a.size === 'Just me' && h('div.ob-b.ai', 'Since it is just you, I left team features out of the way and kept every screen to one person’s work.'),
        ui.button('Use this setup', { onTap: () => { O.apply(a, pl); p.dismiss(); ui.banner({ title: 'Your app is set up', text: pl.bar.map(title).join(', ') + ' are in the bottom bar. The rest is in the Menu.', icon: 'sparkles', color: 'var(--purple)', duration: 6000 }); o.done && o.done(); } }),
        ui.button('Start over', { kind: 'plain', onTap: () => { log.length = 0; step = -1; for (const k in a) delete a[k]; next(); } })]); } }, { detent: 'large' });
  next(); return sheet; };

/* ================= Company Files ================= */
const F = WD.files = {};
const CATS = [['legal', 'Tax and legal'], ['insurance', 'Insurance'], ['cert', 'Certifications'], ['about', 'About the company'], ['refs', 'References'], ['bids', 'Past bids'], ['other', 'Other']], ACCESS = [['all', 'Everyone'], ['office', 'Office staff'], ['admin', 'Owners and admins']];
const EXTRA = [   // id, name, short, file, category, access, days until expiry, detail
  ['license', 'Business license', 'business license', 'Business-license-2026.pdf', 'legal', 'all', 210, 'City business license, current year.'],
  ['bg', 'Business background', 'business background', 'About-us.pdf', 'about', 'all', null, 'One page: who we are, how long we have operated, service area, what we do.'],
  ['cap', 'Capabilities statement', 'capabilities statement', 'Capabilities-statement.pdf', 'about', 'all', null, 'For purchasing departments: services, equipment, differentiators, NAICS codes, contact.'],
  ['refs', 'Customer references', 'references', 'Customer-references.pdf', 'refs', 'all', null, 'Five customers who agreed to be contacted, with names and phone numbers.'],
  ['naid', 'NAID AAA certificate', 'NAID certificate', 'NAID-AAA-certificate.pdf', 'cert', 'all', 204, 'i-SIGMA certification for mobile and plant-based destruction.'],
  ['wc', 'Workers’ compensation certificate', 'workers’ comp certificate', 'Workers-comp-2026.pdf', 'insurance', 'all', 150, 'Proof of coverage from the carrier.'],
  ['ach', 'Bank letter and ACH form', 'ACH form', 'ACH-form.pdf', 'legal', 'office', null, 'For customers who pay by bank transfer. Holds account details, so office staff only.'],
  ['bid24', 'County records destruction bid (won)', 'county bid', 'County-RFP-2024-response.pdf', 'bids', 'office', null, 'The full response: technical approach, pricing sheet, references. The AI reuses its answers.'],
  ['bid23', 'School district shredding bid (lost)', 'school district bid', 'School-district-IFB-2023.pdf', 'bids', 'office', null, 'Lost on price. Kept for the wording and the forms.'],
];
const KNOWN = { coi: ['insurance', 'all'], w9: ['legal', 'all'], vendor: ['about', 'all'] };
function docs() { if (WD.crm2 && WD.crm2.inquiries) { try { WD.crm2.inquiries(); } catch (e) { /* not seeded yet */ } } if (!data.companyDocs) data.companyDocs = [];
  if (data.filesOrg !== org().id) { data.filesOrg = org().id; data.fileLog = [];
    EXTRA.forEach(([id, name, short, file, cat, access, exp, detail]) => { if (!data.companyDocs.some(d => d.id === id)) data.companyDocs.push({ id, name, short, file, cat, access, expires: exp ? D.add(today(), exp) : undefined, updated: 'January 2026', detail }); }); }
  data.companyDocs.forEach(d => { if (!d.cat) { d.cat = (KNOWN[d.id] || ['other'])[0]; d.access = (KNOWN[d.id] || [0, 'all'])[1]; } });
  return data.companyDocs.filter(d => d.file); }
const canSee = d => d.access === 'all' || (d.access === 'office' ? officeRole() : admin());
F.list = () => docs().filter(canSee);
const expBadge = d => d.expires ? (D.diff(d.expires, today()) < 0 ? ui.badge('Expired', 'var(--red)') : D.diff(d.expires, today()) <= 30 ? ui.badge('Expires soon', 'var(--orange)') : null) : null;
const emailOf = c => c ? c.billingEmail || ((c.contacts || []).find(p => p.email) || {}).email || '' : '';
/** Send one or more files to a customer, a lead or any address. */
F.send = (o = {}) => { let picked = (o.docIds || []).slice(), cust = o.customerId ? q.customer(o.customerId) : null, to = o.to || emailOf(cust), find = '', msg = '';
  const text = () => 'Hello' + (cust && (cust.contacts || [])[0] ? ' ' + first(cust.contacts[0].name) : '') + ',\n\nHere ' + (picked.length === 1 ? 'is the ' + (F.list().find(d => d.id === picked[0]) || {}).short : 'are the documents you asked for') + '. Let us know if you need anything else.\n\n' + first(me()) + '\n' + org().name;
  return ui.sheet({ title: 'Send files', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Send', bold: true, onTap: async p => { const ds = F.list().filter(d => picked.includes(d.id)); if (!ds.length) return ui.alert({ title: 'Choose a file', message: 'Tick at least one file to send.' }); if (!/@|\d{7}/.test(to)) return ui.alert({ title: 'Who is it for?', message: 'Pick a customer or type an email address or mobile number.' });
      if (!await ui.run('Sending ' + plural(ds.length, 'file') + '…', () => { data.fileLog.unshift({ at: now(), by: me(), docs: ds.map(d => d.id), to, customerId: cust ? cust.id : null }); ds.forEach(d => { d.sent = (d.sent || 0) + 1; });
        const k = (WD.screens.customers || {}).crm; if (cust && k && k.addI) k.addI({ customerId: cust.id, type: 'note', at: now(), by: me(), text: 'Sent ' + ds.map(d => d.name).join(', ') + ' to ' + to + '.' }); }, { done: 'Sent' })) return; p.dismiss(); ui.toast(plural(ds.length, 'file') + ' sent to ' + to, 'envelope', 2600); } }],
    render: p => { const hits = find.trim().length > 1 && q.searchCustomers ? q.searchCustomers(find).slice(0, 5) : [];
      return ui.list(ui.section({ header: 'To', fold: false, footer: cust ? 'It is added to ' + cust.name + '’s timeline.' : 'An address with @ is emailed; a mobile number gets a text with a link.' },
          cust ? ui.row({ leading: ui.avatar(cust.name, { size: 34 }), title: cust.name, subtitle: to || 'No email on file', trailing: ui.iconBtn('xmark.circle.fill', 'Remove', () => { cust = null; to = ''; p.refresh(); }) }) : ui.inputRow({ label: 'Find a customer or lead', placeholder: 'Name', value: find, onInput: v => { find = v; clearTimeout(F._t); F._t = setTimeout(() => p.refresh(), 500); } }),
          !cust && hits.map(c => ui.row({ leading: ui.avatar(c.name, { size: 30 }), title: c.name, subtitle: emailOf(c) || 'No email on file', onTap: () => { cust = c; to = emailOf(c); find = ''; p.refresh(); } })),
          ui.inputRow({ label: 'Email or mobile', placeholder: 'name@example.com', value: to, onInput: v => { to = v; } })),
        ui.section({ header: 'Files · ' + picked.length + ' chosen', fold: false }, F.list().map(d => ui.row({ leading: icon(picked.includes(d.id) ? 'checkmark.circle.fill' : 'circle', 24, picked.includes(d.id) ? 'var(--tint)' : 'var(--label3)'), title: d.name, subtitle: d.file, badge: expBadge(d), onTap: () => { const i = picked.indexOf(d.id); if (i >= 0) picked.splice(i, 1); else picked.push(d.id); p.refresh(); } }))),
        ui.section({ header: 'Message', fold: false }, ui.inputRow({ label: 'Message', multiline: true, value: msg || text(), onInput: v => { msg = v; } }))); } }, { detent: 'large' }); };
F.fileSpec = id => ({ title: 'File', render: page => { const d = docs().find(x => x.id === id); if (!d || !canSee(d)) return ui.empty({ icon: 'lock', title: 'Not available', text: 'This file is not shared with your role.' }); const re = () => { WD.changed(); page.refresh(); }, o = org();
  return ui.list(h('div.cf-paper', h('h5', o.name), h('div', { style: 'color:#636366' }, d.name), h('hr'), h('div', d.detail), h('div.l', { style: 'width:92%' }), h('div.l', { style: 'width:78%' }), h('div.l', { style: 'width:85%' }), h('div.l', { style: 'width:40%' })),
    h('div', { style: 'display:flex;gap:8px;padding:0 0 12px' }, ui.button('Send…', { icon: 'envelope', onTap: () => F.send({ docIds: [d.id] }) }), ui.button('Copy link', { kind: 'tinted', icon: 'link', onTap: () => ui.toast('Link copied · works for 14 days', 'link', 2400) })),
    ui.section({ header: 'Details', fold: false }, ui.row({ title: 'File', detail: d.file }), ui.row({ title: 'Updated', detail: d.updated || '—' }), d.expires && ui.row({ title: 'Valid through', detail: fmt.day(d.expires, 'long'), badge: expBadge(d) }), ui.row({ title: 'Sent', detail: plural(d.sent || 0, 'time') })),
    officeRole() ? ui.section({ header: 'Manage', fold: false, footer: 'Drivers and other staff see only files shared with everyone.' },
      ui.pickerRow({ title: 'Who can see it', value: d.access, disabled: !admin(), options: ACCESS.map(([value, label]) => ({ value, label })), onChange: v => { d.access = v; re(); } }),
      ui.pickerRow({ title: 'Folder', value: d.cat, options: CATS.map(([value, label]) => ({ value, label })), onChange: v => { d.cat = v; re(); } }),
      d.expires != null && ui.dateRow({ title: 'Valid through', value: d.expires, onChange: v => { d.expires = v; re(); } }),
      ui.row({ title: 'Replace the file', tint: true, onTap: async () => { if (await ui.run('Uploading…', () => { d.updated = fmt.day(today(), 'long'); if (d.expires && D.diff(d.expires, today()) <= 30) d.expires = D.add(today(), 365); }, { done: 'Replaced' })) page.refresh(); } }),
      admin() && !['coi', 'w9'].includes(d.id) && ui.row({ title: 'Remove', destructive: true, onTap: async () => { if (await ui.actionSheet({ title: 'Remove ' + d.name + '?', buttons: [{ label: 'Remove', value: true, role: 'destructive' }] })) { data.companyDocs = data.companyDocs.filter(x => x !== d); WD.changed(); page.pop(); } } })) : null); } });
const FU = { text: '' };
function filesRoot() { return { title: 'Company Files', large: true, search: { placeholder: 'W-9, insurance, license…', onInput: (v, page) => { FU.text = v; page.refresh(); } },
  trailing: () => officeRole() ? [{ icon: 'plus', label: 'Add a file', onTap: async page => { const n = await ask('New file', 'e.g. Safety policy'); if (!n) return; const cat = await ui.actionSheet({ title: 'Which folder?', buttons: CATS.map(([value, label]) => ({ label, value })) }); if (!cat) return;
    if (await ui.run('Uploading…', () => { docs(); data.companyDocs.push({ id: 'dc' + Date.now().toString(36), name: n, short: n.toLowerCase(), file: n.replace(/\s+/g, '-') + '.pdf', cat, access: 'all', updated: fmt.day(today(), 'long'), detail: 'Added by ' + me() + '.' }); }, { done: 'Added · shared with everyone' })) page.refresh(); } }] : [],
  render: page => { const t = FU.text.trim().toLowerCase(), list = F.list().filter(d => !t || (d.name + ' ' + d.short + ' ' + d.file).toLowerCase().includes(t)), log = data.fileLog || [];
    const row = d => ui.row({ icon: 'doc.text', iconColor: d.cat === 'bids' ? 'var(--indigo)' : 'var(--blue)', title: d.name, subtitle: d.file + (d.expires ? ' · valid through ' + fmt.day(d.expires, 'md') : d.updated ? ' · ' + d.updated : '') + (d.access !== 'all' ? ' · ' + ACCESS.find(a => a[0] === d.access)[1].toLowerCase() + ' only' : ''), badge: expBadge(d), trailing: ui.iconBtn('share', 'Send ' + d.name, () => F.send({ docIds: [d.id] })), onTap: () => page.push(F.fileSpec(d.id)) });
    return ui.list(!t && ui.note('The documents customers and leads ask for most. Open one to read it, or tap the arrow to send it.'),
      list.length ? CATS.map(([id, label]) => { const ds = list.filter(d => d.cat === id); return ds.length ? ui.section({ header: label, fold: false }, ds.map(row)) : null; }) : ui.empty({ icon: 'doc', title: 'No file matches', text: 'Try another word, or ask the office to add it.' }),
      !t && list.length > 1 && ui.section(null, ui.row({ icon: 'envelope', title: 'Send several at once', tint: true, onTap: () => F.send({}) })),
      !t && log.length ? ui.section({ header: 'Recently sent', count: log.length }, log.slice(0, 8).map(l => ui.row({ title: l.docs.map(id => (docs().find(d => d.id === id) || { name: id }).name).join(', '), subtitle: 'To ' + l.to + ' · ' + first(l.by) + ' · ' + fmt.rel(l.at) }))) : null); } }; }
WD.screens.files = { root: filesRoot };
{ const i = app.menu.findIndex(m => m.id === 'settings'); app.menu.splice(i < 0 ? app.menu.length : i, 0, { id: 'files', title: 'Company Files', icon: 'doc', can: () => true }); }

/* ================= Wiring ================= */
if (WD.r14 && WD.r14.addSetting) { WD.r14.addSetting('Company', (push, gated) => WD.r14.link(push, gated, 'settings.manage', 'sparkles', 'var(--purple)', 'Setup interview', 'Answer a few questions again and let the AI rearrange the app', () => ({ title: 'Setup interview', render: page => ui.list(ui.note(data.onboard ? 'Last answered by ' + data.onboard.by + ' ' + fmt.rel(data.onboard.at) + '.' : 'Not answered yet for this business.'), ui.button('Start the interview', { icon: 'sparkles', onTap: () => O.open() })) })));
  WD.r14.addSetting('Company', (push, gated) => WD.r14.link(push, gated, 'settings.manage', 'key', 'var(--gray)', 'RouteClerk console', 'Ours, not the customer’s: plans, trial, promotions, editions', P.consoleSpec)); }
WD.panel.addSeg('App edition (stand-alone builds)', () => M.editions.map(e => [e.id, e.short]), () => M.edition().id, v => M.setEdition(v));
WD.panel.addAction('Promotion: “Loyal customer week”', () => P.give(PL.promos[0] || PL.trialCfg, 'promo'));
WD.panel.addAction('New-company free trial starts', () => P.give(PL.trialCfg, 'trial'));
WD.panel.addAction('The running trial or promotion ends', () => { const g = live()[0]; if (!g) return ui.toast('Nothing is running. Start a promotion first', 'info.circle', 2600); P.endNow(g); });
WD.panel.addJump('RouteClerk console (plans, promotions)', () => { WD.nav.switchTab('settings'); WD.nav.push(P.consoleSpec()); });
WD.panel.addJump('Onboarding interview', () => O.open());
WD.panel.addJump('Company Files', () => WD.nav.switchTab('files'));
if (app.uiState) app.uiState('files', FU);
})();
