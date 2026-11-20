/* RouteClerk prototype — version 4.0 foundations (`WD.rc`): the service plan and AI features by tier, Settings → Display (appearance, text size,
   menu sections), the Company rows (business details, invoicing and payment options, integrations, plan), Settings → Client communications
   (every template plus the reminder and collection-notice schedule), and the Services and Products sections of the menu. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc = {};
const admin = () => WD.can('settings.manage'), owner = () => ['owner', 'admin'].includes((S.me || {}).role);
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Your role doesn’t include this. An owner or admin can grant it in Team and roles.' });
let seq = 0; const uid = RC.uid = p => p + (++seq) + Date.now().toString(36).slice(-4);
const ask = RC.ask = async (title, placeholder, value, message, type) => { const r = await ui.alert({ title, message, input: { placeholder, value: value == null ? '' : String(value), type }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); return r && r.value && r.text.trim() ? r.text.trim() : null; };
const num = RC.num = t => parseFloat(String(t == null ? '' : t).replace(/[^0-9.\-]/g, '')) || 0;
RC.plural = (n, w) => n + ' ' + (n === 1 ? w : w + 's');
S.prefs = S.prefs || {}; S.prefs.hidden = S.prefs.hidden || {}; if (S.prefs.showDrivers == null) S.prefs.showDrivers = true;

WD.css(`
.rc-ai { margin: 0 0 10px; border-radius: 14px; padding: 12px 14px; background: linear-gradient(135deg, color-mix(in srgb, var(--purple) 16%, var(--cell)), color-mix(in srgb, var(--blue) 12%, var(--cell))); font-size: 15px; line-height: 20px; letter-spacing: -.2px; }
.rc-ai .k { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: var(--purple); margin-bottom: 5px; }
.rc-ai ul { margin: 6px 0 0; padding-left: 18px; } .rc-ai li { margin: 3px 0; } .rc-ai b { font-weight: 600; }
.rc-ai .btn { margin-top: 10px; }
.rc-ai.lock { background: var(--cell); border: 1px dashed var(--sep); } .rc-ai.lock .k { color: var(--label2); }
.rc-size { display: flex; align-items: flex-end; gap: 4px; padding: 10px 16px 12px; background: var(--cell); }
.rc-size button { flex: 1; border: 0; background: var(--fill3); border-radius: 9px; height: 52px; display: grid; place-items: center; color: var(--label); cursor: pointer; font-weight: 600; }
.rc-size button.on { background: var(--tint); color: #fff; }
.rc-logo { width: 54px; height: 54px; border-radius: 10px; object-fit: contain; background: #fff; border: .5px solid var(--sep); }
.rc-tier { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .2px; padding: 2px 7px; border-radius: 6px; color: #fff; }
`);

/* ================= Service plan and AI features ================= */
const TIERS = RC.TIERS = [{ id: 'starter', name: 'Starter', color: 'var(--gray)' }, { id: 'pro', name: 'Pro', color: 'var(--blue)' }, { id: 'premium', name: 'Premium', color: 'var(--purple)' }];
const rank = id => TIERS.findIndex(t => t.id === id), tierOf = id => TIERS.find(t => t.id === id) || TIERS[0];
/** What the company pays for, a free preview of a higher tier (with an end date), and features an admin switched off. */
const PL = data.plan = { tier: 'pro', promo: null, off: {} };
/** AI features. `tier` is the lowest plan that includes it; `where` says where it shows up in the app. */
const AI = RC.AI = [
  { id: 'autoroute', tier: 'starter', name: 'AutoRoute', where: 'Dispatch', text: 'Orders each route’s stops, proposes arrival windows and a time to leave.' },
  { id: 'summaries', tier: 'starter', name: 'Call and message summaries', where: 'Customers', text: 'A short summary of earlier calls, texts and emails when a customer calls.' },
  { id: 'pricing', tier: 'pro', name: 'Pricing recommendations', where: 'Price Calc', text: 'Recommends a purge price from how far the job is off your routes, the area, and what you charge nearby.' },
  { id: 'collect', tier: 'pro', name: 'Collection message drafts', where: 'Statements', text: 'Writes the email that goes with a statement or past-due notice from the customer’s history, in the tone you pick.' },
  { id: 'invcheck', tier: 'pro', name: 'Invoice check', where: 'New and edited invoices', text: 'Flags a quantity or total that is unusual for the customer before the invoice goes out.' },
  { id: 'insights', tier: 'premium', name: 'Report insights', where: 'Reports', text: 'Plain-language findings from your numbers: what changed, who is slipping, where revenue comes from.' },
  { id: 'payrisk', tier: 'premium', name: 'Late-payment risk', where: 'Customers, statements, the driver’s past-due flag', text: 'Scores each customer’s chance of paying late from their payment history.' },
  { id: 'codes', tier: 'premium', name: 'Engine code help', where: 'Maintenance', text: 'Explains each engine code from the truck’s GPS unit, how urgent it is, and the repair it usually means.' },
  { id: 'traffic', tier: 'pro', name: 'Traffic-aware AutoRoute', where: 'Dispatch', text: 'Drive times use the usual traffic for that road at that time and day of the week, instead of one average speed.' },
  { id: 'leadbot', tier: 'premium', name: 'AI lead assistant', where: 'CRM', text: 'Answers a new lead by text or email within a minute, asks what they need, quotes from your price rules and offers days to schedule. Anything it isn’t sure of goes to a person.' },
  { id: 'routewatch', tier: 'premium', name: 'Route monitoring', where: 'Dispatch and Shift', text: 'Follows each driver through the day, re-orders the stops left when that helps, and warns the driver and dispatch when the route won’t finish, with the jobs to move or run late.' },
  { id: 'lookahead', tier: 'premium', name: 'Week-ahead suggestions', where: 'Dispatch', text: 'Looks at the next week or so of routes and recommends moving a purge job to a day when a truck is already nearby.' },
  { id: 'truckroute', tier: 'premium', name: 'Truck-legal routing', where: 'Dispatch, Shift directions', text: 'Plans around low bridges, weight limits and roads closed to trucks, using each truck’s height and weight from Maintenance. Truck road data costs more per route than ordinary maps, which is why it is on the top plan.' },
];
/** Paid add-ons, billed on top of any plan and switched on by an owner. */
const ADDONS = RC.ADDONS = [{ id: 'phone', name: 'AI phone agent', price: 'From $0.12 per minute answered', text: 'Answers the phone when nobody is free: takes the caller’s details, quotes and schedules simple jobs, and offers a call back for anything complex. Every call lands in the CRM with a summary; call-backs are flagged for immediate attention.' }];
PL.addons = { phone: false };
RC.addon = id => !!PL.addons[id];
const promoOn = () => !!(PL.promo && PL.promo.until >= D.today());
RC.tier = () => { const t = promoOn() && rank(PL.promo.tier) > rank(PL.tier) ? PL.promo.tier : PL.tier; return t === 'premium' ? 'pro' : t; };
/** Is this AI feature usable right now? Included in the plan (or a running free preview) and not switched off. */
/* 5.0: the top tier became AI Premium, a paid add-on with a free trial (WD.aip in r14.js). Its features are hidden, not locked, without it. */
const prem = f => f.tier === 'premium', aipOn = () => !!(WD.aip && WD.aip.on());
RC.ai = id => { const f = AI.find(x => x.id === id); return !!f && (prem(f) ? aipOn() : rank(RC.tier()) >= rank(f.tier)) && !PL.off[id]; };
RC.startPromo = (tier = 'premium', days = 14) => { if (tier === 'premium' && WD.aip) return WD.aip.startTrial(); PL.promo = { tier, until: D.add(D.today(), days), days }; WD.changed(); ui.banner({ title: tierOf(tier).name + ' features unlocked', text: 'Free until ' + fmt.day(PL.promo.until, 'long') + '. Nothing is charged, and they switch off by themselves if you don’t upgrade.', icon: 'sparkles', color: 'var(--purple)', duration: 6000 }); };
/** An AI result block: {title, lines: [string | node], action: node}. */
RC.aiCard = o => h('div.rc-ai', h('div.k', icon('sparkles', 15), o.title || 'AI suggestion'), o.text && h('div', o.text), o.lines && o.lines.length ? h('ul', o.lines.map(l => h('li', l))) : null, o.action);
/** Show `build()` when the feature is on; otherwise say which plan includes it and offer the free preview. Returns null when an admin switched it off. */
RC.aiBlock = (id, build) => {
  const f = AI.find(x => x.id === id); if (!f) return null; if (RC.ai(id)) return build(); if (prem(f)) return null;
  if (PL.off[id] && rank(RC.tier()) >= rank(f.tier)) return null;
  const t = tierOf(f.tier), used = PL.promo && !promoOn();
  return h('div.rc-ai.lock', h('div.k', icon('lock', 14), f.name + ' · ' + t.name + ' plan'), h('div', f.text),
    admin() ? ui.button(used ? 'See plans' : 'Try ' + t.name + ' free for 14 days', { kind: 'tinted', small: true, icon: 'sparkles', onTap: () => used ? WD.nav.push(RC.planSpec()) : RC.startPromo(t.id) }) : h('div.footnote.secondary', { style: 'margin-top:6px' }, 'Ask an owner or admin about the ' + t.name + ' plan.'));
};
const tierBadge = id => { const t = tierOf(id); return h('span.rc-tier', { style: { background: t.color } }, t.name); };
RC.planSpec = () => ({ title: 'Plan and AI features', render: page => {
  if (!WD.can('billing.view') && !admin()) return locked();
  const cur = RC.tier(), re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('Features are switched on by plan. From time to time a higher plan’s features are unlocked free for a couple of weeks, so you can see whether they are worth it before paying for them.'),
    ui.section({ header: 'Your plan', fold: false, footer: 'Prototype: choose a plan here (or in the panel beside the phone) to see what each one includes.' },
      ui.pickerRow({ title: 'Plan', icon: 'creditcard', iconColor: 'var(--green)', value: PL.tier, options: TIERS.filter(t => t.id !== 'premium').map(t => ({ value: t.id, label: t.name })), onChange: v => { PL.tier = v; re(); } }),
      WD.aip && WD.aip.planRow(page),
      promoOn() ? ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: tierOf(PL.promo.tier).name + ' free preview', subtitle: 'Ends ' + fmt.day(PL.promo.until, 'long') + ' · nothing is charged', trailing: ui.button('End', { kind: 'gray', small: true, block: false, onTap: () => { PL.promo.until = D.add(D.today(), -1); re(); } }) })
        : rank(PL.tier) < 1 && ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: PL.promo ? 'Free preview ended ' + fmt.day(PL.promo.until, 'md') : 'Try Pro free for 14 days', subtitle: PL.promo ? 'Upgrade to keep the features you tried' : 'Unlocks every feature below. Switches off by itself', tint: !PL.promo, onTap: PL.promo ? null : () => RC.startPromo('pro') })),
    TIERS.filter(t => t.id !== 'premium' || aipOn()).map(t => ui.section({ header: t.id === 'premium' ? 'AI Premium · ' + WD.aip.label() : t.name + (t.id === PL.tier ? ' · your plan' : rank(t.id) <= rank(cur) ? ' · included' : ''), fold: false }, AI.filter(f => f.tier === t.id).map(f => { const has = prem(f) ? aipOn() : rank(cur) >= rank(f.tier);
      return ui.row({ icon: has ? 'sparkles' : 'lock', iconColor: has ? t.color : 'var(--gray)', title: f.name, subtitle: f.text + ' Shows in: ' + f.where + '.', trailing: has ? ui.toggle(!PL.off[f.id], v => { PL.off[f.id] = !v; WD.changed(); }) : tierBadge(f.tier) }); }))),
    aipOn() && ui.section({ header: 'Paid add-ons', fold: false, showFooter: true, footer: 'Add-ons are billed by use on top of your plan, and can be switched off at any time.' }, ADDONS.map(a => ui.row({ icon: 'phone.fill', iconColor: 'var(--green)', title: a.name, subtitle: a.text + ' ' + a.price + '.',
      trailing: owner() ? ui.toggle(PL.addons[a.id], v => { PL.addons[a.id] = v; re(); ui.toast(a.name + (v ? ' switched on' : ' switched off'), 'checkmark'); }) : ui.badge(PL.addons[a.id] ? 'On' : 'Off', 'var(--gray)') }))));
} });

/* ================= Settings → Display ================= */
/* Each person arranges the app for the job they do: four sections in the bottom bar to start with and up to six (app.BAR_MAX), everything else in the Menu, in their order. */
RC.sectionsSpec = () => ({ title: 'Tabs and menu', render: page => {
  const A = WD.app, bar = A.barIds(), inMenu = A.dests().filter(d => !bar.includes(d.id)), P = S.prefs, order = () => A.menuItems().map(d => d.id), set = fn => { A.setLayout(fn); page.refresh(); };
  const move = (list, i, by) => { const l = list.slice(), j = i + by; if (j < 0 || j >= l.length) return l; [l[i], l[j]] = [l[j], l[i]]; return l; };
  const arrows = (i, n, up, down) => h('div.st-order', h('button.st-arrow', { 'aria-label': 'Move up', disabled: i === 0, onclick: up }, icon('arrow.up', 16)), h('button.st-arrow', { 'aria-label': 'Move down', disabled: i === n - 1, onclick: down }, icon('arrow.down', 16)));
  const shown = A.menuItems(), hiddenOnes = inMenu.filter(d => !shown.includes(d));
  return ui.list(note('Put what you use most in the bottom bar. Someone who invoices all day can put Invoices there; someone who never uses the CRM can swap it for something else. This is your own arrangement: nobody else’s changes.'),
    ui.section({ header: 'Bottom bar · ' + bar.length + ' of ' + A.BAR_MAX, fold: false, showFooter: true, footer: 'The bar starts with ' + A.BAR_DEFAULT + ' shortcuts and holds up to ' + A.BAR_MAX + '. The last place is always the Menu.' + (S.desktop ? ' On the desktop website every section is in the sidebar, so this arrangement applies to the phone app.' : '') },
      bar.map((id, i) => { const d = A.dest(id); return ui.row({ icon: d.icon, iconColor: 'var(--tint)', title: d.title, trailing: h('div.hstack', { style: 'gap:8px' }, arrows(i, bar.length, () => set(p => { p.bar = move(bar, i, -1); }), () => set(p => { p.bar = move(bar, i, 1); })),
        bar.length > 1 && h('button.st-arrow', { 'aria-label': 'Move ' + d.title + ' to the menu', style: 'color:var(--red)', onclick: () => set(p => { p.bar = bar.filter(x => x !== id); }) }, icon('minus', 16))) }); })),
    ui.section({ header: 'Menu', fold: false, showFooter: true, footer: bar.length >= A.BAR_MAX ? 'The bar is full. Move something out of it to make room.' : 'Tap + to move a section into the bottom bar.' },
      shown.map((d, i) => ui.row({ icon: d.icon, iconColor: 'var(--indigo)', title: d.title, trailing: h('div.hstack', { style: 'gap:8px' }, arrows(i, shown.length, () => set(p => { p.order = move(order(), i, -1); }), () => set(p => { p.order = move(order(), i, 1); })),
        h('button.st-arrow', { 'aria-label': 'Put ' + d.title + ' in the bottom bar', disabled: bar.length >= A.BAR_MAX, style: bar.length >= A.BAR_MAX ? null : 'color:var(--green)', onclick: () => set(p => { p.bar = bar.concat(d.id); }) }, icon('plus', 16)),
        !d.fixed && h('button.st-arrow', { 'aria-label': 'Hide ' + d.title, onclick: () => set(p => { p.hidden = { ...(p.hidden || {}), [d.id]: true }; }) }, icon('eye.slash', 16))) }))),
    hiddenOnes.length > 0 && ui.section({ header: 'Hidden', fold: false, footer: 'Hidden sections leave your menu only. Settings always stays.' }, hiddenOnes.map(d => ui.row({ icon: d.icon, iconColor: 'var(--gray)', title: d.title, trailing: ui.button('Show', { kind: 'tinted', small: true, block: false, onTap: () => set(p => { p.hidden = { ...(p.hidden || {}), [d.id]: false }; }) }) }))),
    ui.section(null, ui.row({ title: 'Put everything back the way it came', tint: true, center: true, onTap: () => set(p => { p.bar = null; p.order = null; p.hidden = {}; }) })));
} });
RC.displaySection = push => ui.section({ header: 'Display', fold: false, footer: 'Text size changes every screen. These choices are yours and stay on this device.' },
  ui.row({ icon: S.theme === 'dark' ? 'moon' : 'sun', iconColor: 'var(--indigo)', title: 'Appearance', trailing: h('div', { style: 'width:128px' }, ui.segmented([{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], S.theme, v => WD.app.setTheme(v))) }),
  ui.row({ icon: 'textformat', iconColor: 'var(--blue)', title: 'Text size', detail: (WD.textSizes.find(t => t.value === S.textSize) || {}).label }),
  h('div.rc-size', WD.textSizes.map((t, i) => h('button' + (t.value === S.textSize ? '.on' : ''), { 'aria-label': 'Text size ' + t.label, style: { fontSize: 13 + i * 4 + 'px' }, onclick: () => WD.app.setTextSize(t.value) }, 'A'))),
  ui.row({ icon: 'square.grid', iconColor: 'var(--gray)', title: 'Tabs and menu', subtitle: 'Choose what sits in the bottom bar, and the order of the menu', detail: (n => n ? n + ' hidden' : '')(Object.values(S.prefs.hidden).filter(Boolean).length), chevron: true, onTap: () => push(RC.sectionsSpec()) }),
  WD.can('jobs.edit') && ui.toggleRow({ icon: 'person', iconColor: 'var(--teal)', title: 'Show drivers on Dispatch', subtitle: 'The driver and truck assigned to each route for the day', value: S.prefs.showDrivers, onChange: v => { S.prefs.showDrivers = v; WD.changed(); } }),
  WD.r15 && WD.r15.cardStyleRow && WD.r15.cardStyleRow(push));

/* ================= Company: business details, invoicing and payment options ================= */
const org = () => S.org || data.orgs[0];
(o => { o.street = o.street || (o.remit || [])[1] || ''; o.cityLine = o.cityLine || ((o.remit || [])[2] ? o.remit[2] + ', TX 78000' : ''); o.email = o.email || 'office@discountshred.example'; o.website = o.website || 'discountshred.example'; o.fax = o.fax || ''; })(data.orgs[0]);
if (data.tax && data.tax.regNo == null) data.tax.regNo = '';
/** Card and bank payments when invoicing from RouteClerk itself. Fees are percentages of the invoice total. */
const PAY = data.pay = { via: 'ninja', stripe: false, card: true, ach: true, passFees: false, cardPct: 3.5, achPct: 1, achCap: 10 };
RC.payFee = (amount, method) => !PAY.passFees || PAY.via !== 'routeclerk' || !PAY.stripe ? 0 : method === 'card' && PAY.card ? Math.round(amount * PAY.cardPct) / 100 : method === 'ach' && PAY.ach ? Math.min(PAY.achCap || Infinity, Math.round(amount * PAY.achPct) / 100) : 0;
RC.bizSpec = () => ({ title: 'Business details', render: page => {
  if (!admin()) return locked(); const o = org(), T = data.tax, re = () => { o.remit = [o.name.toUpperCase(), o.street, o.cityLine.replace(/,?\s*[A-Z]{2}\s*\d{5}.*$/, '') || o.cityLine].filter(Boolean); WD.changed(); };
  const f = (label, key, extra = {}) => ui.inputRow({ label, value: o[key] || '', placeholder: extra.placeholder || '', type: extra.type, inputmode: extra.inputmode, caps: extra.caps, onInput: v => { o[key] = v; re(); } });
  return ui.list(
    ui.section({ header: 'Company', fold: false, footer: 'Printed at the top of invoices, statements and service agreements, and used in emails and texts.' },
      f('Name', 'name'), f('Address', 'street', { placeholder: 'Street' }), f('City, state, ZIP', 'cityLine'),
      ui.phoneRow({ label: 'Phone', value: o.phone, onInput: v => { o.phone = v; re(); } }), ui.phoneRow({ label: 'Fax', value: o.fax, placeholder: 'Optional', onInput: v => { o.fax = v; re(); } }),
      f('Email', 'email', { type: 'email', caps: 'off' }), f('Website', 'website', { caps: 'off' })),
    ui.section({ header: 'Logo', fold: false, footer: 'PNG or JPEG. It replaces the drawn logo on invoices and statements.' },
      ui.row({ leading: o.logo ? h('img.rc-logo', { src: o.logo, alt: 'Company logo' }) : h('div.rc-logo', { style: 'display:grid;place-items:center;color:var(--gray)' }, icon('photo', 26)), title: o.logo ? 'Logo added' : 'No logo yet', subtitle: o.logo ? 'Shown on your documents' : 'Your company name is drawn instead',
        trailing: h('label.btn.tinted.small', { style: 'cursor:pointer' }, o.logo ? 'Replace' : 'Choose', h('input', { type: 'file', accept: 'image/png,image/jpeg', style: 'display:none', onchange: e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { o.logo = r.result; WD.changed(); page.refresh(); ui.toast('Logo added', 'checkmark'); }; r.readAsDataURL(file); } })) }),
      o.logo && ui.row({ title: 'Remove logo', destructive: true, onTap: () => { o.logo = null; WD.changed(); page.refresh(); } })),
    T && ui.section({ header: 'Tax', fold: false, footer: T.on ? 'The registration number prints under your address on invoices and statements.' : 'Off: invoices show no tax line.' },
      ui.toggleRow({ icon: 'dollarsign.circle', iconColor: 'var(--green)', title: 'Apply tax to invoices', subtitle: T.on ? T.rate + '% · ' + T.name : null, value: T.on, onChange: v => { T.on = v; WD.changed(); page.refresh(); if (v && WD.r9) page.push(WD.r9.taxSpec()); } }),
      T.on && ui.inputRow({ label: 'Tax registration #', placeholder: 'Optional', value: T.regNo, caps: 'characters', onInput: v => { T.regNo = v; WD.changed(); } }),
      T.on && WD.r9 && ui.row({ title: 'Rate, what is taxed and exemptions', chevron: true, onTap: () => page.push(WD.r9.taxSpec()) })));
} });
RC.paySpec = openIntegrations => ({ title: 'Invoicing and payments', render: page => {
  if (!admin()) return locked(); const re = () => { if (data.settings && data.settings.books) data.settings.books.provider = PAY.via === 'ninja' ? 'ninja' : 'none'; WD.changed(); page.refresh(); }, ex = 150;
  const pct = (label, key, sub) => h('div.row', h('div.row-main', h('div.row-title', label), sub && h('div.row-sub', sub)), h('input.jb-rate', { style: 'width:74px', type: 'text', inputmode: 'decimal', 'aria-label': label, value: String(PAY[key]), onchange: e => { PAY[key] = Math.max(0, Math.min(key === 'achCap' ? 500 : 10, num(e.target.value))); re(); } }), h('span.secondary', { style: 'margin-left:4px' }, key === 'achCap' ? '$' : '%'));
  return ui.list(
    ui.section({ header: 'Invoices are created in', fold: false, footer: PAY.via === 'routeclerk' ? 'RouteClerk numbers, sends and tracks the invoices itself. Nothing is copied to another system.' : 'Invoices created here are sent to Invoice Ninja, and payments recorded there are marked paid here.' },
      [['routeclerk', 'RouteClerk (standalone)', 'Invoices, statements and payments all in this app'], ['ninja', 'Invoice Ninja', 'Connected · invoices and payments sync both ways'], ['qbo', 'QuickBooks Online', 'Coming soon']].map(([v, title, sub]) =>
        ui.row({ icon: PAY.via === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: PAY.via === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, disabled: v === 'qbo', badge: v === 'qbo' ? ui.badge('Soon', 'var(--gray)') : null, onTap: () => { PAY.via = v; re(); } }))),
    PAY.via === 'routeclerk' ? [
      ui.section({ header: 'Card and bank payments', fold: false, footer: PAY.stripe ? 'Customers pay from the link on the invoice or in their portal. Card and bank details go to Stripe and are never stored in RouteClerk.' : 'Connect Stripe to take card and ACH bank payments on the invoices you send from RouteClerk.' },
        ui.row({ icon: 'creditcard', iconColor: '#635BFF', title: 'Stripe', subtitle: PAY.stripe ? 'Connected · Discount Shred' : 'Not connected', trailing: ui.button(PAY.stripe ? 'Disconnect' : 'Connect', { kind: PAY.stripe ? 'gray' : 'filled', small: true, block: false, onTap: async () => {
          if (PAY.stripe) { if (await ui.actionSheet({ title: 'Disconnect Stripe?', message: 'Customers can no longer pay invoices online. Payments already made are not affected.', buttons: [{ label: 'Disconnect', role: 'destructive', value: true }] })) { PAY.stripe = false; re(); } return; }
          if (await ui.run('Opening Stripe…', null, { done: 'Stripe connected' })) { PAY.stripe = true; re(); } } }) }),
        PAY.stripe && ui.toggleRow({ title: 'Accept cards', subtitle: 'Visa, Mastercard, American Express, Discover', value: PAY.card, onChange: v => { PAY.card = v; re(); } }),
        PAY.stripe && ui.toggleRow({ title: 'Accept ACH bank payments', subtitle: 'Paid from a checking account; takes 3 to 5 business days', value: PAY.ach, onChange: v => { PAY.ach = v; re(); } })),
      PAY.stripe && (PAY.card || PAY.ach) && ui.section({ header: 'Service fees', fold: false, footer: PAY.passFees ? 'Example: a ' + fmt.money(ex) + ' invoice' + (PAY.card ? ' paid by card is ' + fmt.money(ex + RC.payFee(ex, 'card'), true) : '') + (PAY.card && PAY.ach ? ';' : '') + (PAY.ach ? ' by ACH is ' + fmt.money(ex + RC.payFee(ex, 'ach'), true) : '') + '. Paid by check or cash it stays ' + fmt.money(ex, true) + '. The fee is its own line on the invoice. Check your state’s rules on card surcharges.' : 'Off: you absorb the processing fees.' },
        ui.toggleRow({ icon: 'plus.circle.fill', iconColor: 'var(--orange)', title: 'Add the service fee to the invoice', subtitle: 'Only when the customer chooses to pay by card or ACH', value: PAY.passFees, onChange: v => { PAY.passFees = v; re(); } }),
        PAY.passFees && PAY.card && pct('Card fee', 'cardPct', 'Percent of the invoice total'), PAY.passFees && PAY.ach && pct('ACH fee', 'achPct', 'Percent of the invoice total'), PAY.passFees && PAY.ach && pct('ACH fee, at most', 'achCap', 'Dollars per invoice'))]
    : ui.section({ header: 'Payments', fold: false, footer: 'Card and bank payments run through Invoice Ninja’s customer portal while invoices are created there.' }, ui.row({ icon: 'link', iconColor: 'var(--purple)', title: 'Invoice Ninja connection', chevron: true, onTap: () => openIntegrations && openIntegrations() }),
        WD.co && WD.co.booksSpec && ui.row({ title: 'Payment-status checks', subtitle: 'How often paid invoices are picked up', chevron: true, onTap: () => page.push(WD.co.booksSpec()) })));
} });
/** Rows added to Settings → Company. */
RC.companyRows = (push, gated, openIntegrations, connected) => [
  ui.row(gated('settings.manage', { icon: 'building', iconColor: 'var(--blue)', title: 'Business details', subtitle: 'Name, address, phone, email, website, fax, logo and tax', chevron: true, onTap: () => push(RC.bizSpec()) })),
  WD.biz && ui.row(gated('settings.manage', { icon: 'briefcase', iconColor: 'var(--indigo)', title: 'Business type and wording', subtitle: WD.biz.industryName() + ' · what things are called on invoices, starter items', chevron: true, onTap: () => push(WD.biz.wordingSpec()) })),
  WD.r11 && ui.row(gated('settings.manage', { icon: 'globe', iconColor: 'var(--blue)', title: 'Country, currency and units', subtitle: WD.locale.currency + ' · ' + (WD.locale.units === 'metric' ? 'metric' : 'miles and pounds'), chevron: true, onTap: () => push(WD.r11.unitsSpec()) })),
  ui.row(gated('settings.manage', { icon: 'creditcard', iconColor: 'var(--green)', title: 'Invoicing and payments', subtitle: PAY.via === 'routeclerk' ? 'RouteClerk' + (PAY.stripe ? ' · Stripe' + (PAY.passFees ? ' · fees passed on' : '') : ' · Stripe not connected') : 'Through Invoice Ninja', chevron: true, onTap: () => push(RC.paySpec(openIntegrations)) })),
  /* 5.0: Unpaid invoice warnings is registered by round11.js (on/off) through WD.r14.addSetting */
  WD.r11 && WD.r11.cfg && WD.r11.cfg.inventory && ui.toggleRow({ icon: 'shippingbox', iconColor: 'var(--teal)', title: 'Inventory management', subtitle: WD.r11.cfg.inventory.on ? 'On · counted in Products → Inventory' : 'Off · nothing is counted', value: WD.r11.cfg.inventory.on, disabled: !admin(), onChange: v => { WD.r11.cfg.inventory.on = v; WD.changed(); ui.toast(v ? 'Inventory is in the Products section' : 'Inventory off', 'shippingbox'); } }),
  ui.row(gated('settings.manage', { icon: 'link', iconColor: 'var(--purple)', title: 'Integrations', subtitle: 'Bookkeeping, GPS, phone, email, Google Sheets', detail: connected + ' connected', chevron: true, onTap: openIntegrations })),
  ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: 'Plan and AI features', detail: tierOf(PL.tier).name + (promoOn() ? ' · preview' : ''), chevron: true, onTap: () => push(RC.planSpec()) })];

/* ================= Settings → Client communications ================= */
/* New templates for statements and collection notices, in the same shape company.js uses. */
const T = (id, name, channel, subject, body) => { if (!data.templates || data.templates.some(t => t.id === id)) return; data.templates.push({ id, group: 'Billing and price changes', name, channel, subject, body, builtin: true, def: { name, channel, subject, body } }); };
T('statement', 'Statement', 'email', 'Statement from {company}', 'Hi {first},\n\nAttached is your statement from {company}. It lists every open invoice and the total due: {amount}.\n\nThe quickest way to pay is online in your customer portal. It takes a minute, you get a receipt right away, and you can save a card or bank account so future invoices are paid automatically:\n{portal}\n\nPrefer to mail a check? Make it payable to {company}, write the invoice number on it, and send it to:\n{remit}\n\nIf you have already sent payment, thank you, and please disregard this. If an invoice did not reach the right person, reply and tell us where to send them.\n\nThank you,\n{company}');
T('pastdue', 'Past-due notice', 'email', 'Past due — {invoice}', 'Hi {first},\n\nInvoice {invoice} for {amount} is now past due. Please send payment, or reply to let us know when to expect it.\n\nPay online in a minute in your customer portal:\n{portal}\n\nOr mail a check payable to {company}, with {invoice} written on it, to:\n{remit}\n\nThank you,\n{company}');
T('finalnotice', 'Final notice', 'letter', 'Final notice — {invoice}', 'Dear {contact},\n\nOur records show {amount} is still unpaid after several reminders. Service may be paused if we do not hear from you within 10 days.\n\nPlease call {phone} so we can sort this out.\n\n{company}');
/** When reminders and collection notices go out. `days` counts from the invoice date; repeatEvery 0 = once. */
const CM = data.comms = { rules: [
  { id: 'cr1', name: 'Reminder before the due date', on: false, days: 25, repeatEvery: 0, max: 1, tpl: 'payrem', channel: 'email' },
  { id: 'cr2', name: 'Reminder on the due date', on: true, days: 30, repeatEvery: 0, max: 1, tpl: 'payrem', channel: 'email' },
  { id: 'cr3', name: 'Past-due notice', on: true, days: 45, repeatEvery: 15, max: 3, tpl: 'pastdue', channel: 'email' },
  { id: 'cr4', name: 'Final notice', on: false, days: 90, repeatEvery: 0, max: 1, tpl: 'finalnotice', channel: 'letter' }],
  statement: { on: true, dom: 1, attach: true, minBalance: 0, who: 'open', overdueBy: 0 }, quiet: true };
const ruleText = r => 'Day ' + r.days + (r.repeatEvery ? ', then every ' + r.repeatEvery + ' days, up to ' + r.max + ' times' : ', once') + ' · ' + ({ email: 'Email', text: 'Text', both: 'Email and text', letter: 'Letter' }[r.channel]);
function ruleSheet(r, done) {
  const f = { ...r }, n = (title, key, opts) => ui.pickerRow({ title, value: f[key], options: opts, onChange: v => { f[key] = v; sheet.stack.top().refresh(); } });
  const sheet = ui.sheet({ title: r.id ? r.name : 'New notice', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.name.trim()) return ui.toast('Give it a name', 'pencil'); if (!f.id) { f.id = uid('cr'); CM.rules.push(f); } else Object.assign(r, f); CM.rules.sort((a, b) => a.days - b.days); p.dismiss(); done(); } }],
    render: p => ui.list(ui.section(null, ui.inputRow({ label: 'Name', value: f.name, onInput: v => { f.name = v; } })),
      ui.section({ header: 'When', fold: false, footer: 'Counted from the invoice date. With Net 30 terms, day 30 is the due date. Nothing is sent once the invoice is paid.' },
        n('Send on day', 'days', [7, 14, 21, 25, 30, 35, 45, 60, 75, 90, 120].map(d => ({ value: d, label: 'Day ' + d }))),
        n('Repeat', 'repeatEvery', [{ value: 0, label: 'Don’t repeat' }].concat([7, 10, 14, 15, 30].map(d => ({ value: d, label: 'Every ' + d + ' days' })))),
        f.repeatEvery > 0 && n('How many times', 'max', [1, 2, 3, 4, 6, 12].map(d => ({ value: d, label: d + (d === 1 ? ' time' : ' times') })))),
      ui.section({ header: 'What', fold: false }, n('Template', 'tpl', (data.templates || []).filter(t => /Billing/.test(t.group) || !t.builtin).map(t => ({ value: t.id, label: t.name }))),
        n('Sent by', 'channel', [{ value: 'email', label: 'Email' }, { value: 'text', label: 'Text' }, { value: 'both', label: 'Email and text' }, { value: 'letter', label: 'Letter (printed)' }])),
      r.id && ui.section(null, ui.row({ title: 'Delete this notice', destructive: true, onTap: () => { CM.rules.splice(CM.rules.indexOf(r), 1); p.dismiss(); done(); } }))) }, { detent: 'large' });
}
/** Who gets the automatic monthly statement: everyone with an open balance, or only customers who are past due (by at least so many days). */
RC.statementWho = () => { const ST = CM.statement; return ST.who === 'overdue' ? 'Customers with an overdue balance' + (ST.overdueBy ? ', ' + ST.overdueBy + '+ days past due' : '') : 'Customers with an open balance'; };
const remindersSpec = () => ({ title: 'Reminders and collections', render: page => { const re = () => { WD.changed(); page.refresh(); }, U = (WD.r11 && WD.r11.cfg && WD.r11.cfg.unpaid) || {};
  return ui.list(ui.section({ header: 'Notices', fold: false, showFooter: true, footer: 'Each notice is sent on its day unless the invoice is paid first. Days count from the invoice date.' },
      CM.rules.map(r => ui.row({ title: r.name, subtitle: ruleText(r), trailing: ui.toggle(r.on, v => { r.on = v; WD.changed(); }), onTap: () => ruleSheet(r, re) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a notice', tint: true, onTap: () => ruleSheet({ name: '', on: true, days: 60, repeatEvery: 0, max: 1, tpl: 'pastdue', channel: 'email' }, re) }),
      ui.toggleRow({ title: 'Quiet on weekends and holidays', subtitle: 'A notice due then goes out the next business day', value: CM.quiet, onChange: v => { CM.quiet = v; WD.changed(); } })),
    ui.section({ header: 'Past due', fold: false, footer: 'An unpaid invoice counts as past due this many days after its invoice date. Reports, the Customers filters and the driver’s warning all use it.' },
      ui.pickerRow({ title: 'Past due after', value: U.overdueDays, options: [15, 30, 45, 60, 90].map(d => ({ value: d, label: d + ' days' })), onChange: v => { U.overdueDays = v; re(); } }),
      ui.inputRow({ label: 'Driver is told to', multiline: true, value: U.driverAction, onInput: v => { U.driverAction = v; } })));
} });
const statementsSpec = () => ({ title: 'Monthly statements', render: page => { const re = () => { WD.changed(); page.refresh(); }, ST = CM.statement, co = WD.co || {};
  return ui.list(ui.section({ fold: false, showFooter: true, footer: ST.on ? 'Sent on the ' + ST.dom + (ST.dom === 1 ? 'st' : 'th') + ' to: ' + RC.statementWho().toLowerCase() + (ST.minBalance ? ', owing ' + fmt.money(ST.minBalance) + ' or more' : '') + '. A statement can also be sent any time from the customer.' : 'Off: statements are only sent by hand, from the customer.' },
      ui.toggleRow({ title: 'Send statements automatically', value: ST.on, onChange: v => { ST.on = v; re(); } }),
      ST.on && ui.pickerRow({ title: 'Day of the month', value: ST.dom, options: [1, 5, 10, 15, 20, 25].map(d => ({ value: d, label: 'The ' + d + (d === 1 ? 'st' : 'th') })), onChange: v => { ST.dom = v; re(); } })),
    ST.on && ui.section({ header: 'Who gets one', fold: false, showFooter: true, footer: ST.who === 'overdue' ? 'Customers who are paying on time hear nothing. “Past due” starts ' + (((WD.r11 || {}).cfg || {}).unpaid || {}).overdueDays + ' days after the invoice date (Reminders and collections).' : 'Everyone who owes anything gets a statement, including invoices that are not due yet.' },
      [['open', 'Every customer with an open balance', 'Including invoices not yet due'], ['overdue', 'Only customers with an overdue balance', 'Nothing is sent while they are within terms']].map(([v, title, sub]) => ui.row({ icon: ST.who === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: ST.who === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, onTap: () => { ST.who = v; re(); } })),
      ST.who === 'overdue' && ui.pickerRow({ title: 'Overdue by at least', value: ST.overdueBy, options: [0, 15, 30, 45, 60, 90].map(d => ({ value: d, label: d ? d + ' days' : 'Any time past due' })), onChange: v => { ST.overdueBy = v; re(); } }),
      ui.pickerRow({ title: 'Only when they owe', value: ST.minBalance, options: [0, 25, 50, 100, 250].map(d => ({ value: d, label: d ? fmt.money(d) + ' or more' : 'Anything' })), onChange: v => { ST.minBalance = v; re(); } })),
    ui.section({ fold: false }, ui.toggleRow({ title: 'Attach the unpaid invoices', subtitle: 'In the same PDF, after the statement', value: ST.attach, onChange: v => { ST.attach = v; WD.changed(); } }),
      co.editTemplate && ui.row({ icon: 'envelope', iconColor: 'var(--blue)', title: 'The email it goes out with', subtitle: 'Points to the portal, and says where to mail a check', chevron: true, onTap: () => co.editTemplate(co.tpl('statement')) })));
} });
const wordingSpec = () => ({ title: 'Templates and wording', render: page => { const co = WD.co || {}, groups = [...new Set((data.templates || []).map(t => t.group))];
  return ui.list(ui.section({ header: 'Documents', fold: false },
      WD.biz && ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'Invoice and document wording', subtitle: 'What things are called, and the footer statement', chevron: true, onTap: () => page.push(WD.biz.wordingSpec()) }),
      co.editAgreementDoc && data.agreementTemplate && ui.row({ icon: 'signature', iconColor: 'var(--brown)', title: 'Service agreement', subtitle: 'The wording new agreements start from', chevron: true, onTap: () => co.editAgreementDoc(data.agreementTemplate, { template: true }) })),
    groups.map(g => ui.section({ header: g, folded: true, fold: true }, data.templates.filter(t => t.group === g).map(t => ui.row({ title: t.name, subtitle: t.body.replace(/\s+/g, ' ').slice(0, 70) + '…', badge: ui.badge({ text: 'Text', email: 'Email', letter: 'Letter', app: 'In app' }[t.channel] || t.channel, 'var(--gray)'), chevron: true, onTap: () => co.editTemplate && co.editTemplate(t, { onSave: () => page.refresh() }) })))),
    co.editTemplate && ui.section(null, ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New template', tint: true, onTap: () => co.editTemplate(null, { onSave: () => page.refresh() }) })));
} });
RC.commsSpec = () => ({ title: 'Client communications', render: page => {
  if (!admin()) return locked(); const co = WD.co || {}, ops = WD.ops || {}, r11 = WD.r11 || {}, x = WD.r13 || {}, on = CM.rules.filter(r => r.on).length;
  const row = (ic, color, title, subtitle, detail, spec) => ui.row({ icon: ic, iconColor: color, title, subtitle, detail, chevron: true, onTap: () => page.push(spec()) });
  return ui.list(
    ui.section({ header: 'Around a visit', fold: false, showFooter: true, footer: 'What a customer hears before, during and after a job.' },
      ops.confirmSpec && row('checkmark.circle', 'var(--green)', 'Job confirmations', 'When a job is scheduled, with rates or an estimate if you want', ops.confirmLabel && ops.confirmLabel(), ops.confirmSpec),
      co.omwSpec && row('message', 'var(--green)', 'On-my-way notices', 'A text or call with the ETA when the driver starts driving', null, co.omwSpec),
      co.reviewsSpec && row('star', 'var(--orange)', 'Reviews and feedback', 'Follow-up text after service, review sites, QR code', null, co.reviewsSpec),
      x.checkinSpec && row('repeat', 'var(--yellow)', 'Purge check-in', 'A reminder months after a one-time purge', x.checkinLabel(), x.checkinSpec)),
    ui.section({ header: 'Billing', fold: false, showFooter: true, footer: 'What goes out about money, and when.' },
      row('bell', 'var(--red)', 'Reminders and collections', 'Payment reminders, past-due and final notices', on + ' on', remindersSpec),
      row('tray', 'var(--teal)', 'Monthly statements', RC.statementWho(), CM.statement.on ? 'On' : 'Off', statementsSpec)),   /* 5.0: Pricing and Agreements moved to Settings → Company */
    ui.section({ header: 'Wording and sending', fold: false },
      row('doc.text', 'var(--indigo)', 'Templates and wording', 'Every text, email, letter and document', String((data.templates || []).length), wordingSpec),
      ops.commsSpec && row('phone.fill', 'var(--blue)', 'Calls, texts and email', 'Which number and address messages come from', ops.commsLabel && ops.commsLabel(), ops.commsSpec)));
} });
RC.commsSection = (push, gated) => ui.section({ header: 'Client communications', fold: false },
  ui.row(gated('settings.manage', { icon: 'envelope', iconColor: 'var(--teal)', title: 'Client communications', subtitle: 'Job confirmations, on-my-way notices, reviews, reminders, statements, letters, templates, and which number they come from', chevron: true, onTap: () => push(RC.commsSpec()) })));
/* Past due is 45 days unless the company changes it; drivers are given a recommended action. */
if (WD.r11 && WD.r11.cfg && WD.r11.cfg.unpaid) { WD.r11.cfg.unpaid.overdueDays = 45; WD.r11.cfg.unpaid.driverAction = 'Ask the office manager whether they are receiving our invoices.'; }

/* ================= Menu → Services and Products ================= */
/* Services are the price book (what you do and charge for). Products are things you sell or place: containers, boxes, bags. */
data.products = [
  { id: 'pd1', name: 'Executive console (locking)', unit: 'each', rate: 185, stock: 14, note: 'Placed at the customer; billed once at setup' },
  { id: 'pd2', name: '64-gallon security bin', unit: 'each', rate: 95, stock: 22, note: '' },
  { id: 'pd3', name: '96-gallon security bin', unit: 'each', rate: 120, stock: 9, note: '' },
  { id: 'pd4', name: 'Banker box (10 pack)', unit: 'pack', rate: 32, stock: 40, note: 'Sold to purge customers who need boxes' },
  { id: 'pd5', name: 'Replacement console key', unit: 'key', rate: 12, stock: 31, note: '' },
  { id: 'pd6', name: 'Security bag with tie', unit: 'bag', rate: 4, stock: 260, note: '' }];
function itemSheet(list, it, kind, done) {
  const f = it ? { ...it } : { name: '', unit: kind === 'product' ? 'each' : 'visit', rate: '', stock: '', note: '' };
  ui.sheet({ title: it ? it.name : 'New ' + kind, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!String(f.name).trim()) return ui.toast('Enter a name', 'pencil');
      const v = { ...f, name: f.name.trim(), rate: num(f.rate), stock: kind === 'product' ? Math.round(num(f.stock)) : undefined }; if (it) Object.assign(it, v); else list.push({ id: uid(kind === 'product' ? 'pd' : 'sv'), ...v }); WD.changed(); p.dismiss(); done(); } }],
    render: p => ui.list(ui.section({ fold: false, footer: kind === 'product' ? 'Products can be added as a line on any invoice.' : 'Services are the lines offered on jobs and invoices. The price here is the starting price; a customer can have their own.' },
        ui.inputRow({ label: 'Name', value: f.name, required: true, onInput: v => { f.name = v; } }), ui.inputRow({ label: 'Price', inputmode: 'decimal', placeholder: '0.00', value: f.rate === '' ? '' : String(f.rate), onInput: v => { f.rate = v; } }),
        ui.inputRow({ label: 'Sold per', placeholder: kind === 'product' ? 'each' : 'visit, box, bin…', value: f.unit, onInput: v => { f.unit = v; } }),
        kind === 'product' && ui.inputRow({ label: 'In stock', inputmode: 'numeric', value: f.stock === '' || f.stock == null ? '' : String(f.stock), onInput: v => { f.stock = v; } }),
        kind === 'product' && ui.inputRow({ multiline: true, placeholder: 'Notes (optional)', value: f.note || '', onInput: v => { f.note = v; } })),
      it && ui.section(null, ui.row({ title: 'Delete ' + kind, destructive: true, onTap: async () => { if (await ui.actionSheet({ title: 'Delete “' + it.name + '”?', message: 'Invoices already created keep their lines.', buttons: [{ label: 'Delete', role: 'destructive', value: true }] })) { list.splice(list.indexOf(it), 1); WD.changed(); p.dismiss(); done(); } } }))) }, { detent: 'medium' });
}
const catalog = (kind, title, list, empty) => () => { const st = { query: '' }; return { title, large: true, search: { placeholder: 'Search ' + title.toLowerCase().replace(' and fees', ' and fees'), onInput: (v, p) => { st.query = v.trim().toLowerCase(); p.refresh(); } },
  trailing: page => admin() || WD.can('billing.manage') ? [{ icon: 'plus', label: 'New ' + kind, onTap: () => itemSheet(list(), null, kind, () => page.refresh()) }] : [],
  render: page => { const edit = admin() || WD.can('billing.manage'), rows = list().filter(x => !st.query || x.name.toLowerCase().includes(st.query)).slice().sort((a, b) => a.name.localeCompare(b.name));
    return ui.list(rows.length ? ui.section({ header: RC.plural(rows.length, kind), fold: false, footer: edit ? empty : 'Ask an admin to change prices.' }, rows.map(x => ui.row({ icon: kind === 'product' ? 'shippingbox' : 'repeat', iconColor: kind === 'product' ? 'var(--brown)' : 'var(--teal)', title: x.name,
        subtitle: 'Per ' + (x.unit || 'each') + (kind === 'product' && x.stock != null ? ' · ' + x.stock + ' in stock' : ''), detail: fmt.money(x.rate, true), chevron: edit, onTap: edit ? () => itemSheet(list(), x, kind, () => page.refresh()) : null })))
      : ui.empty({ icon: kind === 'product' ? 'shippingbox' : 'repeat', title: 'Nothing matches', text: 'Try a different search.' }),
      kind === 'service' && edit && ui.section({ header: 'Fees and pricing rules', fold: false, showFooter: true, footer: 'Every service and fee is edited here; nothing about them is in Settings.' },
        WD.ops && WD.ops.itemsSpec && ui.row({ icon: 'tag', iconColor: 'var(--teal)', title: 'Items, services and fees', subtitle: 'Add, edit and delete what you charge for, with base prices', chevron: true, onTap: () => page.push(WD.ops.itemsSpec()) }),
        WD.r8 && WD.r8.pricingSpec && ui.row({ icon: 'shippingbox', iconColor: 'var(--orange)', title: 'Purge pricing', subtitle: WD.r8.pricingLabel(), chevron: true, onTap: () => page.push(WD.r8.pricingSpec()) }),
        WD.r11 && WD.r11.moneySpec && ui.row({ icon: 'dollarsign.circle', iconColor: 'var(--green)', title: 'Box sizes, stairs and haul-away', subtitle: 'With who may change standing prices', chevron: true, onTap: () => page.push(WD.r11.moneySpec()) }),
        data.tax && data.tax.on && WD.r9 && ui.row({ icon: 'percent', iconColor: 'var(--red)', title: 'What is taxed', subtitle: WD.r9.taxLabel ? WD.r9.taxLabel() : null, chevron: true, onTap: () => page.push(WD.r9.taxSpec()) })),
      kind === 'product' && WD.r11 && WD.r11.cfg && WD.r11.cfg.inventory && WD.r11.cfg.inventory.on && WD.r11.inventorySpec && ui.section({ header: 'Inventory', fold: false, showFooter: true, footer: 'Inventory management is switched on in Settings → Company.' },
        ui.row({ icon: 'shippingbox', iconColor: 'var(--teal)', title: 'Stock on trucks and in the warehouse', subtitle: 'Counts, reorder points, and what each job uses', chevron: true, onTap: () => page.push(WD.r11.inventorySpec()) }))); } }; };
WD.screens.services = { root: catalog('service', 'Services and Fees', () => data.priceBook, 'What you do and charge for. Tap one to change its name or price.') };
WD.screens.products = { root: catalog('product', 'Products', () => data.products, 'Things you sell or place with customers. Tap one to change its price or stock.') };
/** Everything that can be a line on an invoice: services first, then products. */
RC.lineItems = () => data.priceBook.map(x => ({ id: x.id, name: x.name, rate: x.rate })).concat(data.products.map(x => ({ id: x.id, name: x.name, rate: x.rate, product: true })));

/* ================= Panel ================= */
if (PL.tier === 'premium') PL.tier = 'pro';
WD.panel.addSeg('Service plan', () => TIERS.filter(t => t.id !== 'premium').map(t => [t.id, t.name]), () => PL.tier, v => { PL.tier = v; WD.changed(); });
WD.panel.addJump('Display', () => WD.nav.switchTab('settings'));
WD.panel.addJump('Plan and AI', () => { WD.nav.switchTab('settings'); WD.nav.push(RC.planSpec()); });
WD.panel.addJump('Client communications', () => { WD.nav.switchTab('settings'); WD.nav.push(RC.commsSpec()); });
})();
