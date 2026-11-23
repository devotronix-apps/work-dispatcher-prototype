/* RouteClerk prototype — version 5.0, money. Registered on WD.money:
   suggested price changes (replaces Anniversaries) and the AI Premium annual pricing audit; repair records from shop emails (AI Premium);
   the Invoicing setting (built-in invoicing or a bookkeeping program); the customer email preview and the customer portal preview with
   Stripe test payments and autopay; the Invoices screen's tiles, aging bar, bulk actions and desktop table; the document designer
   (Forms and documents) with estimates and quotes; and Import (files, a previous service, AI evaluation). Everything is simulated. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc || {}, M = WD.money = {};
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You', money = n => fmt.money(n, true), plural = (n, w) => n + ' ' + (n === 1 ? w : w + 's');
const org = () => S.org || data.orgs[0], admin = () => WD.can('settings.manage'), aip = () => !!(WD.aip && WD.aip.on());
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'This needs the Company settings permission.' });
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const mdy = k => fmt.day(k, 'md') + ', ' + k.slice(0, 4), stampDay = t => mdy(D.key(new Date(t)));
const emailOf = c => (c && (c.billingEmail || (c.contacts[0] || {}).email)) || '';
const uid = p => RC.uid ? RC.uid(p) : p + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
const openSet = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
const r2 = n => Math.round(n * 100) / 100, num = t => parseFloat(String(t == null ? '' : t).replace(/[^0-9.\-]/g, '')) || 0;
const aiCard = o => WD.aip && WD.aip.card ? WD.aip.card(o) : h('div', o.text);
const R11 = () => WD.r11 || {}, cfg = () => (WD.r11 && WD.r11.cfg) || { letters: { days: 30, method: 'email' }, unpaid: {} };
/** A round checkbox with a full-size tap target. */
const check = (on, onTap, label) => h('button.mny-check', { 'aria-label': label || (on ? 'Selected' : 'Select'), 'aria-pressed': on ? 'true' : 'false', onclick: e => { e.stopPropagation(); onTap(); } }, icon(on ? 'checkmark.circle.fill' : 'circle', 24, on ? 'var(--tint)' : 'var(--label3)'));

WD.css(`
.mny-check { width: 44px; height: 44px; margin: -6px 0 -6px -10px; border: 0; background: none; display: grid; place-items: center; cursor: pointer; flex: none; padding: 0; }
.mny-bar { position: sticky; top: 0; z-index: 3; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 12px; margin: 0 0 10px; border-radius: 12px; background: var(--cell); box-shadow: 0 1px 6px rgba(0,0,0,.12); }
.mny-bar .n { font-size: 15px; font-weight: 600; margin-right: auto; } .mny-bar .btn { flex: none; }
.mny-chips { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 0 10px; }
.mny-chip { min-height: 44px; border: 0; border-radius: 22px; padding: 0 14px; background: var(--fill3); color: var(--label); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.mny-chip.on { background: var(--tint); color: #fff; }
.mny-kv { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 14px; } .mny-kv span:first-child { color: var(--label2); } .mny-kv b { font-weight: 600; }
.mny-why { margin: 4px 0 0; padding-left: 16px; font-size: 13px; line-height: 18px; color: var(--label2); } .mny-why li { margin: 1px 0; }
.mny-range { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--cell); } .mny-range input { flex: 1; min-width: 0; height: 44px; accent-color: var(--tint); } .mny-range b { min-width: 52px; text-align: right; font-size: 17px; }
.mny-in { width: 96px; flex: none; text-align: right; border: 0; border-radius: 8px; background: var(--fill3); color: var(--label); font: inherit; font-size: 16px; padding: 7px 9px; min-height: 44px; }
.mny-in.wide { width: 150px; text-align: left; } .mny-in.bad { color: var(--red); }
.mny-mail { margin: 0 0 12px; border-radius: 14px; background: var(--cell); overflow: hidden; }
.mny-mail .hd { padding: 12px 14px; border-bottom: .5px solid var(--sep); font-size: 14px; line-height: 19px; } .mny-mail .hd b { font-weight: 600; } .mny-mail .hd .s { color: var(--label2); font-size: 13px; }
.mny-mail .bd { padding: 12px 14px; }
.mny-acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; } .mny-acts .btn { flex: 1 1 auto; min-width: 0; }
.mny-att { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border-radius: 10px; border: .5px solid var(--sep); background: var(--fill3); color: var(--label); font: inherit; font-size: 14px; cursor: pointer; max-width: 100%; }
.mny-att small { color: var(--label2); font-size: 12px; white-space: nowrap; } .mny-att span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`);

/* ================= Unpaid invoice warnings: the switches reach the board strip, and both fee tables stay the same ================= */
/* round11b.js builds the Dispatch warning line from X.overLimit. It is not ours to edit, so the "On the board" switch mutes overLimit
   only while that strip is being built; the Unpaid invoices report and the customer's own page still use the real answer. */
if (WD.r11 && WD.r11.boardStrips && WD.r11.overLimit) { const X = WD.r11, strips = X.boardStrips, over = X.overLimit; let mute = false;
  X.overLimit = c => !mute && over(c);
  X.boardStrips = (inView, o) => { mute = !!X.warnOn && !X.warnOn('board'); try { return strips(inView, o); } finally { mute = false; } }; }
/* One fee table. Settings → Company → Pricing and Agreements edits WD.r11.cfg.portal; rc.js charges from data.pay. The portal fields
   read and write data.pay directly so the two can never disagree, and rc.js's fee now includes the fixed amount per payment. */
(() => { const P = cfg().portal; if (!P || !data.pay) return;
  ['cardPct', 'cardFixed', 'achPct', 'achFixed', 'achCap'].forEach(k => { let own = P[k] || 0; if (data.pay[k] == null) data.pay[k] = own;
    Object.defineProperty(P, k, { enumerable: true, configurable: true, get: () => data.pay && data.pay[k] != null ? data.pay[k] : own, set: v => { own = v; if (data.pay) data.pay[k] = v; } }); });
  if (RC.payFee) RC.payFee = (amount, method) => { const Y = data.pay; if (!Y || !Y.passFees || Y.via !== 'routeclerk' || !Y.stripe) return 0;
    if (method === 'card' && Y.card) return r2(amount * Y.cardPct / 100 + (Y.cardFixed || 0));
    if (method === 'ach' && Y.ach) return r2(Math.min(Y.achCap || Infinity, amount * Y.achPct / 100) + (Y.achFixed || 0)); return 0; };
})();

/* ================= Suggested price changes ================= */
/* A recurring-route customer is suggested when more than 11 months have passed since their setup or their last price change, whichever
   is later. Government customers are left out unless asked for. "Skip this year" records c.priceReviewed so they leave the list. */
const VISITS = { Weekly: 52, 'Every 2 weeks': 26, 'Every 4 weeks': 13, Monthly: 12, Quarterly: 4 };
const PX = () => (WD.x && WD.x.priceInt) || null;
const recurring = c => !!VISITS[c.freq] && ['customer', 'serviced'].includes(c.lifecycle) && !c.hidden && (c.locations || []).length > 0;
const skipped = c => !!c.priceReviewed && D.diff(today(), c.priceReviewed) < 335;
function priceInfo(c) {
  const P = PX(); P.promote(c); const items = (P.loc(c).items || []).filter(i => i.qty > 0), per = P.perVisit(items), lp = P.lastPrice(c), setup = (c.stats && c.stats.firstInvoice) || '', lpDay = lp ? (lp.effective || D.key(new Date(lp.at))) : '';
  const since = lpDay > setup ? lpDay : setup, months = since ? Math.max(0, D.diff(today(), since)) / 30.44 : 0;
  return { c, items, per, lp, setup, since, months, fromSetup: !(lpDay > setup), visits: VISITS[c.freq] || 0, annual: per * (VISITS[c.freq] || 0), qty: items.reduce((s, i) => s + i.qty, 0), lastAmt: lp ? r2(lp.to - lp.from) : null };
}
const priced = () => PX() ? data.customers.filter(recurring).map(priceInfo).filter(x => x.per > 0) : [];
/** Everyone due for a price review, longest overdue first. gov: include government customers. */
M.priceDue = gov => priced().filter(x => x.months > 11 && !x.c.upcoming && !skipped(x.c) && (gov || x.c.custType !== 'government')).sort((a, b) => b.months - a.months);
const monthsText = x => Math.floor(x.months) + ' months since ' + (x.fromSetup ? 'setup' : 'the last change');
const lastText = x => x.lastAmt != null ? 'last change ' + (x.lastAmt >= 0 ? '+' : '−') + money(Math.abs(x.lastAmt)) + ' on ' + x.lp.item : 'no price change on record';
const priceLines = x => [h('div', money(x.per) + ' per visit · ' + x.c.freq), h('div', monthsText(x) + ' · ' + lastText(x)), h('div', fmt.money(Math.round(x.annual)) + ' a year')];
/** Raise one customer's rates through the same machinery as X.changeService. how: {pct} or {amt: dollars per visit}. */
function raiseOne(c, how, o) {
  const P = PX(); P.promote(c); const base = WD.copyItems(P.loc(c).items), items = WD.copyItems(base), was = P.perVisit(base); if (!was) return null;
  const f = how.pct != null ? 1 + how.pct / 100 : (was + how.amt) / was;
  items.forEach(i => { if (i.qty > 0) i.rate = r2(i.rate * f); });
  if (how.amt != null) { const off = r2(was + how.amt - P.perVisit(items)), one = items.find(i => i.qty === 1); if (off && one) one.rate = r2(one.rate + off); }
  const t = today(), eff = o.effective || P.firstVisitFrom(c, D.add(t, o.days)), email = emailOf(c), send = !!o.letter;
  const added = P.recordChanges(c, base, items, c.freq, c.freq, eff, send && !!email); if (!added.length) return null;
  const doc = send ? { at: +WD.now(), effective: eff, sentTo: o.method === 'print' ? '' : email, changes: added.map(x => ({ ...x })) } : null; if (doc) added.forEach(x => { x.letterDoc = doc; });
  const live = items.filter(i => i.qty > 0);
  if (eff <= t) { P.loc(c).items = WD.copyItems(live); P.loc(c).containers = WD.itemsLabel(live); c.upcoming = null; } else c.upcoming = { items: WD.copyItems(live), freq: c.freq, effective: eff, letter: send && !!email };
  const n = P.applyToJobs(c, live, eff);
  if (doc) (c.documents = c.documents || []).push({ id: uid('doc-l'), kind: 'other', name: 'Price change letter ' + eff + '.pdf', size: '64 KB', at: +WD.now() });
  return { n, eff, to: P.perVisit(live), emailed: send && !!email && o.method !== 'print', printed: send && (o.method !== 'email' || !email) };
}
/** “Raise selected…”: a percent or a dollar amount per visit, the service date it starts, and the letters. fixed: Map(customerId → percent) for the AI audit. */
function raiseSheet(list, done, fixed) {
  const L = cfg().letters, f = { mode: 'pct', val: '5', when: 'notice', date: D.add(today(), L.days), letter: true, method: L.method };
  const how = x => fixed ? { pct: fixed.get(x.c.id) || 0 } : f.mode === 'pct' ? { pct: num(f.val) } : { amt: num(f.val) };
  const after = x => { const w = how(x); return w.pct != null ? r2(x.per * (1 + w.pct / 100)) : r2(x.per + w.amt); };
  const valid = () => fixed ? true : f.mode === 'pct' ? num(f.val) > 0 && num(f.val) <= 50 : num(f.val) > 0 && num(f.val) <= 500;
  const pv = h('div'), draw = () => { const add = list.reduce((s, x) => s + (after(x) - x.per) * x.visits, 0); pv.replaceChildren(
    h('div', { style: 'padding:10px 16px;background:var(--cell)' }, h('div.mny-kv', h('span', 'Customers'), h('b', String(list.length))), h('div.mny-kv', h('span', 'Added revenue a year'), h('b', valid() ? '+' + fmt.money(Math.round(add)) : '—'))),
    list.slice(0, 8).map(x => ui.row({ title: x.c.name, subtitle: x.c.freq + (emailOf(x.c) ? '' : ' · no email on file: the letter is printed'), detail: valid() ? h('span', money(x.per) + ' → ', h('b', { style: 'color:var(--label)' }, money(after(x)))) : money(x.per) })),
    list.length > 8 ? ui.row({ title: 'and ' + (list.length - 8) + ' more', disabled: true }) : null); };
  ui.sheet({ title: fixed ? 'Apply recommended prices' : 'Raise selected', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Raise ' + list.length, bold: true, onTap: async p => {
      if (!valid()) return ui.toast(f.mode === 'pct' ? 'Enter a percentage from 0.1 to 50' : 'Enter an amount from $0.01 to $500', 'exclamationmark.triangle', 2800);
      let done2 = 0, visits = 0, mailed = 0, printed = 0;
      if (!await ui.run(f.letter ? 'Saving and sending the letters…' : 'Saving…', () => { list.forEach(x => { const r = raiseOne(x.c, how(x), { effective: f.when === 'date' ? f.date : null, days: L.days, letter: f.letter, method: f.method }); if (r) { done2++; visits += r.n; if (r.emailed) mailed++; if (r.printed) printed++; } }); }, { done: 'Saved', min: 900, max: 1500 })) return;
      WD.changed(); p.dismiss(); done && done();
      ui.banner({ title: plural(done2, 'customer') + ' raised', text: (visits ? plural(visits, 'scheduled visit') + ' updated' : 'The new prices start with each customer’s first visit after the notice period') + (f.letter ? ' · ' + plural(mailed, 'letter') + ' emailed' + (printed ? ', ' + printed + ' on the print-and-mail list' : '') : ' · no letters sent') + '. Each change is in the customer’s price history.', icon: 'dollarsign.circle', color: 'var(--green)', duration: 7000 }); } }],
    render: p => { draw(); return ui.list(
      fixed ? note('Each customer gets the increase the audit recommended for them, within your cap.') : ui.section({ header: 'Raise every rate by', fold: false, showFooter: true, footer: f.mode === 'pct' ? 'Each container rate goes up by this percentage, rounded to the cent.' : 'The price of a visit goes up by this many dollars, spread across the customer’s containers.' },
        h('div', { style: 'padding:8px 16px;background:var(--cell)' }, ui.segmented([{ value: 'pct', label: 'Percent' }, { value: 'amt', label: 'Dollars per visit' }], f.mode, v => { f.mode = v; f.val = v === 'pct' ? '5' : '2.00'; p.refresh(); })),
        h('div.row', h('div.row-main', h('div.row-title', f.mode === 'pct' ? 'Percent' : 'Dollars per visit')), f.mode === 'amt' && h('span.secondary', { style: 'margin-right:4px' }, '$'),
          h('input.mny-in', { type: 'text', inputmode: 'decimal', 'aria-label': f.mode === 'pct' ? 'Percent' : 'Dollars per visit', value: f.val, oninput: e => { f.val = e.target.value; e.target.classList.toggle('bad', !valid()); draw(); } }), f.mode === 'pct' && h('span.secondary', { style: 'margin-left:4px' }, '%')),
        f.mode === 'pct' && h('div.x-pct', [3, 5, 8, 10].map(n => h('button' + (num(f.val) === n ? '.on' : ''), { onclick: () => { f.val = String(n); p.refresh(); } }, '+' + n + '%')))),
      ui.section({ header: 'Starts with service on', fold: false, showFooter: true, footer: f.when === 'notice' ? 'Each customer’s first scheduled visit on or after ' + mdy(D.add(today(), L.days)) + ' (' + L.days + ' days’ notice). Earlier visits keep the current price.' : 'Every visit on or after this date uses the new price.' },
        ui.pickerRow({ title: 'Effective', value: f.when, options: [{ value: 'notice', label: 'First visit after the notice period' }, { value: 'date', label: 'On a date I choose' }], onChange: v => { f.when = v; p.refresh(); } }),
        f.when === 'date' && ui.dateRow({ title: 'Service date', icon: 'calendar', iconColor: 'var(--red)', value: f.date, onChange: v => { f.date = v; p.refresh(); } })),
      ui.section({ header: 'Letters', fold: false, showFooter: true, footer: 'One letter per customer from the “Price or service change” template, kept with their documents. The notice period and how letters go out come from Settings → Company → Pricing and Agreements.' },
        ui.toggleRow({ title: 'Send each customer a letter', value: f.letter, onChange: v => { f.letter = v; p.refresh(); } }),
        f.letter && ui.pickerRow({ title: 'Send them by', value: f.method, options: [{ value: 'email', label: 'Email' }, { value: 'print', label: 'Print and mail' }, { value: 'both', label: 'Email, and print and mail' }], onChange: v => { f.method = v; p.refresh(); } })),
      ui.section({ header: 'What changes', fold: false }, pv)); } }, { detent: 'large' });
}
M.priceSpec = () => { const st = { gov: false, sel: new Set(), query: '' };
  return { title: 'Suggested price changes', render: page => {
    const P = PX(); if (!P || !P.canSeePricing()) return ui.empty({ icon: 'lock', title: 'Pricing is hidden', text: 'You need billing access to see prices.' });
    const can = P.canPrice(), all = M.priceDue(true), govN = all.filter(x => x.c.custType === 'government').length, list = all.filter(x => st.gov || x.c.custType !== 'government'), re = () => page.refresh();
    [...st.sel].forEach(id => { if (!list.some(x => x.c.id === id)) st.sel.delete(id); });
    const picked = list.filter(x => st.sel.has(x.c.id)), skip = async xs => { if (!await ui.actionSheet({ title: 'Skip ' + (xs.length === 1 ? xs[0].c.name : plural(xs.length, 'customer')) + ' this year?', message: 'They leave this list and come back in 11 months. Nothing about their price changes.', buttons: [{ label: 'Skip this year', value: true }] })) return;
      xs.forEach(x => { x.c.priceReviewed = today(); st.sel.delete(x.c.id); }); WD.changed(); re(); ui.toast(xs.length === 1 ? 'Skipped until next year' : xs.length + ' skipped until next year', 'checkmark'); };
    const open = (x, reason) => P.canPrice() ? WD.x.changeService(x.c, { effective: P.firstVisitFrom(x.c, D.add(today(), cfg().letters.days)), reason }) : WD.screens.customers.openDetail(x.c.id);
    const row = x => ui.row({ leading: can ? check(st.sel.has(x.c.id), () => { st.sel.has(x.c.id) ? st.sel.delete(x.c.id) : st.sel.add(x.c.id); re(); }, 'Select ' + x.c.name) : ui.avatar(x.c.name, { size: 36 }), title: h('span', x.c.name, x.c.custType === 'government' ? [' ', ui.badge('Government', 'var(--gray)')] : null), subtitle: priceLines(x),
      trailing: ui.iconBtn('ellipsis', 'More for ' + x.c.name, (e, el) => ui.menu(el, [can && { label: 'Change pricing…', icon: 'pencil', onTap: () => open(x, monthsText(x) + '.') }, { label: 'Skip this year', icon: 'clock', onTap: () => skip([x]) }, { label: 'Open customer', icon: 'person', onTap: () => WD.screens.customers.openDetail(x.c.id) }].filter(Boolean))),
      onTap: () => open(x, Math.floor(x.months) + ' months since ' + (x.fromSetup ? 'setup' : 'the last price change') + '. The change starts with the first visit after the notice period.') });
    /* Anyone not on the list: a search over every recurring customer, filled in place so typing keeps its focus. */
    const res = h('div'), find = () => { const s = st.query.trim().toLowerCase(), hits = s.length < 2 ? [] : priced().filter(x => x.c.name.toLowerCase().includes(s) && !list.some(y => y.c.id === x.c.id)).slice(0, 8);
      res.replaceChildren(s.length < 2 ? h('div.section-footer', 'Type two letters of a customer’s name. Anyone can be raised at any time, on the list or not.') : hits.length ? h('div', hits.map(x => ui.row({ leading: ui.avatar(x.c.name, { size: 36 }), title: x.c.name, subtitle: [h('div', money(x.per) + ' per visit · ' + x.c.freq), h('div', x.c.upcoming ? 'A change is already set for ' + mdy(x.c.upcoming.effective) : skipped(x.c) ? 'Skipped this year on ' + mdy(x.c.priceReviewed) : monthsText(x))], chevron: true, onTap: () => open(x) }))) : h('div.section-footer', 'No recurring customer matches “' + st.query.trim() + '”.')); };
    find();
    return ui.list(
      note('Recurring customers whose price has not changed in more than 11 months, counted from their setup or their last price change, whichever is later. The longest wait is first.'),
      WD.aip && WD.aip.block(() => aiCard({ title: 'AI Premium · annual pricing audit', text: 'A recommended new price for every recurring customer, with the reason: time since the last change, distance from the shop, containers against price for similar customers, payment history and contract terms.', action: ui.button('Open the pricing audit', { kind: 'tinted', small: true, icon: 'sparkles', onTap: () => page.push(M.auditSpec()) }) })),
      govN > 0 && h('div.mny-chips', h('button.mny-chip' + (st.gov ? '.on' : ''), { 'aria-pressed': st.gov ? 'true' : 'false', onclick: () => { st.gov = !st.gov; re(); } }, icon(st.gov ? 'checkmark.circle.fill' : 'building', 16), 'Show government (' + govN + ')')),
      can && picked.length > 0 && h('div.mny-bar', h('span.n', picked.length + ' selected'), ui.button('Raise selected…', { small: true, block: false, onTap: () => raiseSheet(picked, () => { st.sel.clear(); re(); }) }), ui.button('Skip this year', { kind: 'gray', small: true, block: false, onTap: () => skip(picked) })),
      list.length ? ui.section({ header: plural(list.length, 'customer') + ' · ' + fmt.money(Math.round(list.reduce((s, x) => s + x.annual, 0))) + ' a year', fold: false, showFooter: true, footer: (can ? 'Tick customers and choose Raise selected, or tap one to change their pricing alone. ' : 'Ask someone with billing management to change a price. ') + (govN && !st.gov ? plural(govN, 'government customer') + ' not shown: their price is usually set by contract or bid.' : '') },
          can && h('div.row.tappable', { onclick: () => { if (st.sel.size === list.length) st.sel.clear(); else list.forEach(x => st.sel.add(x.c.id)); re(); } }, h('div.row-main', h('div.row-title', { style: 'color:var(--tint)' }, st.sel.size === list.length ? 'Clear the selection' : 'Select all ' + list.length))),
          list.map(row))
        : ui.empty({ icon: 'checkmark.circle', title: 'Nobody is due', text: 'Every recurring customer has had a price change, or was skipped, in the last 11 months.' }),
      ui.section({ header: 'Raise pricing for anyone', fold: false }, h('div', { style: 'padding:8px 12px;background:var(--cell)' }, ui.searchField({ placeholder: 'Find a customer', value: st.query, onInput: v => { st.query = v; find(); } })), res));
  } }; };

/* ---------- AI Premium: annual pricing audit ---------- */
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0; };
/** One row per recurring customer: the recommended percentage, why, and what stands in the way. cap: the most any customer is raised. */
function audit(cap) {
  const all = priced(), dep = data.depot || { x: 500, y: 500 }, unit = x => x.qty ? x.per / x.qty : x.per, med = {};
  all.forEach(x => { (med[x.c.custType] = med[x.c.custType] || []).push(unit(x)); }); Object.keys(med).forEach(k => { med[k] = median(med[k]); });
  return all.map(x => { const c = x.c, l = c.locations[0] || {}, why = [], flags = [], miles = l.x != null ? Math.round(Math.hypot(l.x - dep.x, l.y - dep.y) / 38 * 10) / 10 : null, u = unit(x), m = med[c.custType] || u;
    const invs = (data.invoices || []).filter(i => i.customerId === c.id), late = invs.filter(i => (RC.invStatus ? RC.invStatus(i) : i.status) === 'Overdue').length;
    const ag = (data.agreements || []).find(a => a.customerId === c.id && a.status === 'signed'), agDays = ag ? D.diff(today(), ag.start || D.key(new Date(ag.signedAt))) : 0;
    let out = null, limit = cap, capNote = null;
    if (c.custType === 'government') out = 'Government account: the price is set by contract or bid.';
    else if (c.upcoming) out = 'A price change is already set for ' + mdy(c.upcoming.effective) + '.';
    else if (ag && agDays < 365) out = 'Agreement ' + ag.number + ' holds the price for its first year, until ' + mdy(D.add(ag.start || today(), 365)) + '.';
    else if (x.months <= 11) out = 'Changed ' + Math.floor(x.months) + ' months ago. Leave it this year.';
    if (!out && (ag || c.agreement || c.contract)) { const pc = ag ? 5 : 3; if (pc < limit) { limit = pc; capNote = (ag ? 'Agreement ' + ag.number : 'The contract') + ' caps increases at ' + pc + '% a year'; } }
    let pct = 0;
    if (!out) { pct = x.months >= 30 ? 8 : x.months >= 20 ? 6 : 4; why.push((x.months >= 12 ? (x.months / 12).toFixed(1) + ' years' : Math.floor(x.months) + ' months') + ' since ' + (x.fromSetup ? 'setup, with no price change' : 'the last change'));
      if (miles != null && miles > 10) { pct += 1.5; why.push(miles + ' miles from the shop: it costs more to serve'); } else if (miles != null && miles < 3) why.push(miles + ' miles from the shop: cheap to serve');
      if (u < m * 0.9) { pct += 2; why.push(money(u) + ' per container; similar customers pay ' + money(m)); } else if (u > m * 1.15) { pct -= 2; why.push(money(u) + ' per container is already above similar customers (' + money(m) + ')'); flags.push('Already pays more than similar customers'); }
      else why.push(money(u) + ' per container, in line with similar customers (' + money(m) + ')');
      if (late >= 2) { pct += 1; why.push(late + ' of ' + invs.length + ' invoices past due: costs time to collect'); flags.push('Slow payer: a raise may start a dispute'); } else if (invs.length) why.push('Pays on time');
      if (x.months < 14 && x.fromSetup) flags.push('First year as a customer');
      pct = Math.max(0, Math.round(pct * 2) / 2); if (pct > limit) { pct = limit; why.push(capNote || 'Held to your cap of ' + cap + '%'); }
      if (pct >= 8) flags.push('A large increase in one step'); }
    return { ...x, pct, why, flags, out, miles, to: r2(x.per * (1 + pct / 100)), add: x.per * pct / 100 * x.visits }; });
}
M.auditSpec = () => { const st = { cap: 8, sel: null };
  return { title: 'Annual pricing audit', render: page => {
    if (!aip()) return ui.empty({ icon: 'sparkles', title: 'AI Premium is off', text: 'The pricing audit is part of AI Premium.' });
    const P = PX(); if (!P || !P.canSeePricing()) return ui.empty({ icon: 'lock', title: 'Pricing is hidden', text: 'You need billing access to see prices.' });
    const rows = audit(st.cap), rec = rows.filter(x => !x.out && x.pct > 0).sort((a, b) => b.add - a.add), out = rows.filter(x => x.out), re = () => page.refresh();
    if (!st.sel) st.sel = new Set(rec.filter(x => !x.flags.length).map(x => x.c.id));
    [...st.sel].forEach(id => { if (!rec.some(x => x.c.id === id)) st.sel.delete(id); });
    const picked = rec.filter(x => st.sel.has(x.c.id)), add = picked.reduce((s, x) => s + x.add, 0), total = rec.reduce((s, x) => s + x.add, 0), risky = rec.filter(x => x.flags.length), lab = h('b', st.cap + '%');
    return ui.list(
      aiCard({ title: 'AI Premium · annual pricing audit', text: plural(rows.length, 'recurring customer') + ' reviewed. A raise is recommended for ' + rec.length + ', adding ' + fmt.money(Math.round(total)) + ' a year.',
        lines: [plural(picked.length, 'customer') + ' selected: +' + fmt.money(Math.round(add)) + ' a year', risky.length ? plural(risky.length, 'customer') + ' with a churn risk flag, left unticked for you to decide' : 'No churn risk flags', plural(out.length, 'customer') + ' left out: government, locked by an agreement, or changed in the last 11 months'] }),
      ui.section({ header: 'The most any customer is raised', fold: false, showFooter: true, footer: 'A contract or agreement with a lower cap always wins.' },
        h('div.mny-range', h('input', { type: 'range', min: 0, max: 15, step: 0.5, value: st.cap, 'aria-label': 'Largest increase, percent', oninput: e => { lab.textContent = e.target.value + '%'; }, onchange: e => { st.cap = +e.target.value; st.sel = null; re(); } }), lab)),
      P.canPrice() && picked.length > 0 && h('div.mny-bar', h('span.n', picked.length + ' selected · +' + fmt.money(Math.round(add)) + ' a year'), ui.button('Apply recommended to selected…', { small: true, block: false, icon: 'sparkles', onTap: () => raiseSheet(picked, () => { st.sel = null; re(); }, new Map(picked.map(x => [x.c.id, x.pct]))) })),
      rec.length ? ui.section({ header: 'Recommended · ' + rec.length, fold: false, showFooter: true, footer: 'Largest added revenue first. Untick anyone you would rather leave. Nothing changes until you apply.' },
        rec.map(x => ui.row({ leading: check(st.sel.has(x.c.id), () => { st.sel.has(x.c.id) ? st.sel.delete(x.c.id) : st.sel.add(x.c.id); re(); }, 'Select ' + x.c.name),
          title: h('span', x.c.name, x.flags.length ? [' ', ui.badge('Churn risk', 'var(--orange)')] : null),
          subtitle: [h('div', { style: 'color:var(--label)' }, money(x.per) + ' → ', h('b', money(x.to)), ' per visit · +' + x.pct + '% · +' + fmt.money(Math.round(x.add)) + ' a year'), h('ul.mny-why', x.why.map(w => h('li', w)), x.flags.map(w => h('li', { style: 'color:var(--orange)' }, 'Risk: ' + w)))],
          onTap: () => WD.screens.customers.openDetail(x.c.id) })))
        : ui.empty({ icon: 'checkmark.circle', title: 'Nothing to recommend', text: 'With a cap of ' + st.cap + '% no customer is due a raise.' }),
      out.length > 0 && ui.section({ header: 'Left out · ' + out.length, fold: true, folded: true }, out.map(x => ui.row({ title: x.c.name, subtitle: [h('div', money(x.per) + ' per visit · ' + x.c.freq), h('div', x.out)], onTap: () => WD.screens.customers.openDetail(x.c.id) }))),
      note('The audit reads your own records: price history, the map position of each address, container counts, invoices and agreements. It suggests; you decide.'));
  } }; };
if (WD.aip) WD.aip.feature('Annual pricing audit', 'Customers → Suggested price changes', 'Recommends a new price for every recurring customer with the reason, totals the added revenue, flags churn risk and applies the ones you tick.');

/* ================= Maintenance: repair records from shop emails (AI Premium) ================= */
/* data.fleet.inbox: emails a shop sent (forwarded to the maintenance address, or found under a Gmail label). The AI has read each one and
   filled in a record: the truck from the plate or unit number, date, mileage, what was done, shop, cost and the attachment. */
const FL = () => data.fleet || (data.fleet = { repairs: [], odo: {} });
const SHOPS = [
  { fromName: 'Lakemont Truck & Diesel', from: 'service@lakemonttruck.example', subject: 'Invoice 48213 — unit 12, KSH-4127', body: 'Thanks for bringing in unit 12. Front brake pads and rotors replaced, brake fluid flushed. Odometer 86,412. Invoice attached, net 15.', att: 'LTD-Invoice-48213.pdf', size: '212 KB', v: 0, by: 'plate KSH-4127', ago: 1, odo: 86412, kind: 'repair', title: 'Front brake pads and rotors, brake fluid flush', cost: 1184.6 },
  { fromName: 'Summit Tire & Brake', from: 'billing@summittire.example', subject: 'Receipt: 2 steer tires, Truck 14', body: 'Receipt for two 11R22.5 steer tires mounted and balanced on Truck 14 (KSH-5530) at 61,208 miles. Paid by card on file.', att: 'Summit-Receipt-7719.pdf', size: '96 KB', v: 1, by: 'unit number “Truck 14” and plate KSH-5530', ago: 3, odo: 61208, kind: 'repair', title: 'Two steer tires mounted and balanced', cost: 962 },
  { fromName: 'Hill Country Fleet Service', from: 'office@hillcountryfleet.example', subject: 'PM service complete — JRT-9012', body: 'PM-A complete on JRT-9012: oil and filter, fuel filters, chassis lube, 42-point inspection. 124,930 mi. Next PM due at 139,930.', att: 'HCFS-WO-3306.pdf', size: '148 KB', v: 2, by: 'plate JRT-9012', ago: 6, odo: 124930, kind: 'service', title: 'PM-A: oil and filter, fuel filters, chassis lube', cost: 438.25 },
  { fromName: 'Lakemont Truck & Diesel', from: 'service@lakemonttruck.example', subject: 'Invoice 48377 — unit 9 liftgate', body: 'Liftgate hydraulic hose replaced and system bled on unit 9 (HLD-3368). Odometer 47,655. Invoice attached.', att: 'LTD-Invoice-48377.pdf', size: '188 KB', v: 3, by: 'plate HLD-3368', ago: 0, odo: 47655, kind: 'repair', title: 'Liftgate hydraulic hose replaced, system bled', cost: 312.4 }];
const mkMail = (s, i) => { const v = (data.vehicles || [])[s.v] || (data.vehicles || [])[0] || { id: 'v1' }; return { id: 'mx' + (i + 1) + Date.now().toString(36).slice(-3), from: s.from, fromName: s.fromName, subject: s.subject, body: s.body, at: +WD.now() - s.ago * 864e5 - 3 * 36e5, status: 'new',
  file: { name: s.att, kind: 'pdf', size: s.size, url: null }, read: { vehicleId: v.id, by: s.by, day: D.add(today(), -s.ago), odo: s.odo, kind: s.kind, title: s.title, vendor: s.fromName, cost: s.cost } }; };
(F => { if (!F.inbox) F.inbox = SHOPS.slice(0, 3).map(mkMail); if (!F.inboxCfg) F.inboxCfg = { mode: 'forward', address: 'maintenance@discountshred.routeclerk.example', label: 'Truck repairs', auto: 0 }; })(FL());
const inboxNew = () => (FL().inbox || []).filter(m => m.status === 'new');
const recordFrom = (m, by) => ({ id: uid('rp'), vehicleId: m.read.vehicleId, day: m.read.day, odo: m.read.odo, kind: m.read.kind, title: m.read.title, vendor: m.read.vendor, cost: m.read.cost, note: '', by, files: [{ ...m.file }], fromEmail: m.fromName + ' · ' + m.subject });
function approveMail(m, by) { const F = FL(); F.repairs.push(recordFrom(m, by || me())); m.status = 'approved'; if (F.odo && (F.odo[m.read.vehicleId] || 0) < m.read.odo) F.odo[m.read.vehicleId] = m.read.odo; }
M.inboxSpec = () => ({ title: 'From email', render: page => {
  if (!aip()) return ui.empty({ icon: 'sparkles', title: 'AI Premium is off', text: 'Adding repair records from emails is part of AI Premium.' });
  const F = FL(), list = inboxNew(), done = (F.inbox || []).filter(m => m.status !== 'new'), re = () => { WD.changed(); page.refresh(); }, Z = F.inboxCfg;
  const card = m => { const v = q.vehicle(m.read.vehicleId) || { name: 'Truck' }, r = m.read;
    return h('div.mny-mail', h('div.hd', h('div', h('b', m.fromName), ' ', h('span.s', '<' + m.from + '>')), h('div', m.subject), h('div.s', fmt.rel ? fmt.rel(new Date(m.at)) : stampDay(m.at)), h('div.s', { style: 'margin-top:6px' }, m.body)),
      h('div.bd', h('div', { style: 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--purple);text-transform:uppercase;margin-bottom:4px' }, icon('sparkles', 14), 'What the AI read'),
        h('div.mny-kv', h('span', 'Truck'), h('b', v.name + (v.plate ? ' · ' + v.plate : ''))), h('div.mny-kv', h('span', 'Matched by'), h('b', r.by)), h('div.mny-kv', h('span', 'Date'), h('b', mdy(r.day))), h('div.mny-kv', h('span', 'Mileage'), h('b', Math.round(r.odo).toLocaleString('en-US') + ' mi')),
        h('div.mny-kv', h('span', r.kind === 'service' ? 'Scheduled maintenance' : 'Repair'), h('b', { style: 'text-align:right' }, r.title)), h('div.mny-kv', h('span', 'Shop'), h('b', r.vendor)), h('div.mny-kv', h('span', 'Cost'), h('b', money(r.cost))),
        h('div', { style: 'margin-top:8px' }, h('button.mny-att', { 'aria-label': 'Preview ' + m.file.name, onclick: () => RC.fileSpec && page.push(RC.fileSpec(m.file, recordFrom(m, ''))) }, icon('doc', 18, 'var(--red)'), h('span.n', m.file.name), h('small', m.file.size))),
        h('div.mny-acts', ui.button('Approve', { small: true, icon: 'checkmark.circle', onTap: async () => { if (await ui.run('Adding the record…', () => approveMail(m), { done: 'Added to ' + v.name })) re(); } }),
          ui.button('Edit first', { kind: 'tinted', small: true, onTap: () => RC.repairSheet && RC.repairSheet(v, { day: r.day, kind: r.kind, title: r.title, vendor: r.vendor, cost: String(r.cost), odo: String(r.odo), files: [{ ...m.file }], fromEmail: m.fromName + ' · ' + m.subject }, () => { m.status = 'approved'; re(); }) }),
          ui.button('Not a maintenance email', { kind: 'gray', small: true, onTap: () => { m.status = 'dismissed'; re(); ui.toast('Left alone. Nothing was added.', 'checkmark'); } })))); };
  return ui.list(
    note(Z.mode === 'gmail' ? 'Emails under the Gmail label “' + Z.label + '” are read as they arrive.' : 'Forward a shop’s invoice or receipt to ' + Z.address + ', or have the shop send it there.'),
    list.length ? h('div', h('div.section-header', plural(list.length, 'email') + ' to review'), list.map(card)) : ui.empty({ icon: 'envelope', title: 'Nothing to review', text: 'New shop emails appear here with the record already filled in.' }),
    done.length > 0 && ui.section({ header: 'Handled · ' + done.length, fold: true, folded: true }, done.map(m => ui.row({ icon: m.status === 'approved' ? 'checkmark.circle.fill' : 'xmark.circle.fill', iconPlain: true, iconColor: m.status === 'approved' ? 'var(--green)' : 'var(--gray)', title: m.subject, subtitle: m.fromName + ' · ' + (m.status === 'approved' ? (m.auto ? 'Added automatically' : 'Added to the log') : 'Not a maintenance email'), trailing: m.status === 'dismissed' ? ui.button('Review', { kind: 'gray', small: true, block: false, onTap: () => { m.status = 'new'; re(); } }) : null }))),
    admin() && ui.section(null, ui.row({ icon: 'gearshape', iconPlain: true, title: 'Where emails come from and auto-approve', tint: true, chevron: true, onTap: () => page.push(M.inboxSettingsSpec()) })));
} });
/** The row at the top of Repairs and maintenance (rc-ops.js). Hidden without AI Premium. */
M.inboxSection = page => WD.aip && WD.aip.block(() => { const n = inboxNew().length;
  return ui.section({ fold: false }, ui.row({ icon: 'envelope', iconColor: 'var(--purple)', title: h('span', 'From email ', WD.aip.tag()), subtitle: n ? plural(n, 'shop email') + ' read and ready to approve' : 'Shop invoices and receipts are added for you', badge: n ? ui.badge(String(n), 'var(--red)', true) : null, chevron: true, onTap: () => page.push(M.inboxSpec()) })); });
M.inboxSettingsSpec = () => ({ title: 'Repairs from email', render: page => { if (!admin()) return locked(); const Z = FL().inboxCfg, re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('The AI reads repair invoices and receipts that shops email you and fills in the maintenance record: truck, date, mileage, what was done, shop, cost and the attachment.'),
    ui.section({ header: 'Where the emails come from', fold: false, showFooter: true, footer: Z.mode === 'forward' ? 'Give this address to your shops, or forward their emails to it. Only attachments and the message text are read.' : 'Every email that gets this label in the connected Gmail account is read. Other mail is never opened.' },
      h('div', { style: 'padding:8px 16px;background:var(--cell)' }, ui.segmented([{ value: 'forward', label: 'Forwarding address' }, { value: 'gmail', label: 'Gmail label' }], Z.mode, v => { Z.mode = v; re(); })),
      Z.mode === 'forward' ? ui.row({ icon: 'envelope', iconColor: 'var(--blue)', title: Z.address, subtitle: 'Your company’s maintenance address', trailing: ui.button('Copy', { kind: 'gray', small: true, block: false, onTap: () => ui.toast('Address copied', 'checkmark') }) })
        : ui.inputRow({ label: 'Gmail label', value: Z.label, onInput: v => { Z.label = v; } })),
    ui.section({ header: 'Auto-approve', fold: false, showFooter: true, footer: Z.auto ? 'A record under ' + fmt.money(Z.auto) + ' whose truck was matched by plate or unit number is added without waiting. Anything else waits in From email.' : 'Off: every email waits for someone to approve it.' },
      ui.pickerRow({ title: 'Add without asking when under', value: Z.auto, options: [{ value: 0, label: 'Never: always ask' }, ...[100, 250, 500, 1000, 2500].map(n => ({ value: n, label: fmt.money(n) }))], onChange: v => { Z.auto = v; re(); } })),
    ui.section(null, ui.row({ icon: 'tray', iconPlain: true, title: 'Open From email', detail: String(inboxNew().length), tint: true, chevron: true, onTap: () => page.push(M.inboxSpec()) })));
} });
if (WD.aip) WD.aip.feature('Repair records from shop emails', 'Maintenance → Repairs and maintenance log → From email', 'Reads the invoices and receipts shops email you and fills in the maintenance record with the attachment, ready to approve.');
if (WD.r14) WD.r14.addSetting('AI Premium', (push, gated) => WD.r14.link(push, gated, 'settings.manage', 'envelope', 'var(--purple)', 'Repairs from email', 'The address shops send to, or a Gmail label; auto-approve under an amount', M.inboxSettingsSpec, FL().inboxCfg.auto ? 'Auto under ' + fmt.money(FL().inboxCfg.auto) : 'Ask every time'));
let mailTurn = 3;
WD.panel.addAction('Shop emails a repair invoice', () => { const F = FL(), m = mkMail({ ...SHOPS[mailTurn % SHOPS.length], ago: 0 }, mailTurn++), v = q.vehicle(m.read.vehicleId) || { name: 'Truck' }, Z = F.inboxCfg; m.at = +WD.now();
  if (!aip()) return ui.toast('AI Premium is off, so the email stays in the mailbox and nothing is read', 'envelope', 3400);
  F.inbox.unshift(m); const go = () => { WD.nav.switchTab('maintenance'); setTimeout(() => WD.nav.push(M.inboxSpec()), 80); };
  if (Z.auto && m.read.cost < Z.auto) { approveMail(m, 'AI Premium · from email'); m.auto = true; WD.changed(); return ui.banner({ title: 'Repair record added from an email', text: v.name + ' · ' + m.read.title + ' · ' + money(m.read.cost) + ' · ' + m.fromName + '. Under your auto-approve amount.', icon: 'wrench', color: 'var(--purple)', duration: 8000, onTap: go }); }
  WD.changed(); ui.banner({ title: m.fromName + ' sent a repair invoice', text: 'Read for ' + v.name + ': ' + m.read.title + ', ' + money(m.read.cost) + '. Tap to review and approve.', icon: 'envelope', color: 'var(--purple)', duration: 8000, onTap: go }); });

/* ================= Invoicing: built in, or a bookkeeping program ================= */
/* data.pay.via (rc.js) says where invoices are created: 'routeclerk' = RouteClerk invoicing (built in); anything else is the bookkeeping
   program they sync with. data.settings.books.provider (company.js) is kept the same. data.invoicing holds the built-in numbering,
   default terms and late fee. */
const PAY = () => data.pay || (data.pay = { via: 'ninja' });
const SERVICES = [['routeclerk', 'RouteClerk invoicing (built in)', 'Invoices, statements, payments and the customer portal, all in this app'], ['ninja', 'Invoice Ninja', 'Invoices are copied there; payments recorded there come back'], ['qbo', 'QuickBooks Online', 'Invoices and payments sync with your QuickBooks company'],
  ['xero', 'Xero', 'Invoices and payments sync with Xero'], ['zoho', 'Zoho Books', 'Invoices and payments sync with Zoho Books'], ['freshbooks', 'FreshBooks', 'Invoices and payments sync with FreshBooks']];
if (!data.invoicing) data.invoicing = { prefix: 'INV-', next: (data.invoices || []).reduce((m, i) => Math.max(m, parseInt(String(i.number).replace(/\D/g, ''), 10) || 0), 1000) + 1, terms: 30, late: { on: false, pct: 1.5, grace: 10 } };
const IVC = () => data.invoicing;
M.via = () => PAY().via || 'ninja';
M.builtIn = () => M.via() === 'routeclerk';
M.viaName = () => (SERVICES.find(s => s[0] === M.via()) || SERVICES[1])[1].replace(/ \(.*/, '');
/** The line under a customer's invoices: where they are created and tracked. */
M.sourceText = () => M.builtIn() ? 'Created, sent and tracked in RouteClerk' : 'Synced from ' + M.viaName();
const setVia = v => { PAY().via = v; if (data.settings && data.settings.books) data.settings.books.provider = v === 'routeclerk' ? 'none' : v; };
const TERMS = [[0, 'Due on receipt'], [7, 'Net 7'], [10, 'Net 10'], [15, 'Net 15'], [30, 'Net 30'], [45, 'Net 45'], [60, 'Net 60']];
const termsDays = c => { const m = c && String(c.terms || '').match(/\d+/); return m ? +m[0] : c && /receipt/i.test(c.terms || '') ? 0 : IVC().terms; };
const dueOf = r => D.add(r.day, termsDays(q.customer(r.customerId)));
M.invoicingSpec = () => ({ title: 'Invoicing', render: page => { if (!admin()) return locked(); const Z = IVC(), built = M.builtIn(), re = () => { WD.changed(); page.refresh(); }, P = PAY();
  const txt = (title, sub, get, set, o = {}) => h('div.row', h('div.row-main', h('div.row-title', title), sub && h('div.row-sub', sub)), h('input.mny-in' + (o.wide ? '.wide' : ''), { type: 'text', inputmode: o.mode || 'text', 'aria-label': title, value: get(), onchange: e => { if (set(e.target.value.trim()) === false) { ui.toast(o.bad || 'That value can’t be used', 'exclamationmark.triangle', 2800); e.target.value = get(); } re(); } }), o.unit && h('span.secondary', { style: 'margin-left:4px' }, o.unit));
  return ui.list(
    ui.section({ header: 'Invoices are created in', fold: false, showFooter: true, footer: built ? 'RouteClerk numbers, sends and tracks every invoice itself and customers pay in its portal. Nothing is copied to another program.' : 'Invoices created here are sent to ' + M.viaName() + ', and payments recorded there are marked paid here.' },
      SERVICES.map(([v, title, sub]) => ui.row({ icon: M.via() === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: M.via() === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, onTap: () => { setVia(v); re(); ui.toast(v === 'routeclerk' ? 'RouteClerk now does the invoicing' : 'Invoices sync with ' + title, 'checkmark', 2400); } }))),
    built ? [
      ui.section({ header: 'Invoice numbers', fold: false, showFooter: true, footer: 'The next invoice is ' + Z.prefix + Z.next + '. Numbers only go up: a number is never reused, even for a voided invoice.' },
        txt('Prefix', 'Letters before the number', () => Z.prefix, v => { if (!/^[A-Za-z0-9-]{0,8}$/.test(v)) return false; Z.prefix = v.toUpperCase(); }, { bad: 'Up to 8 letters, digits or dashes' }),
        txt('Next number', null, () => String(Z.next), v => { const n = parseInt(v, 10); if (!(n > 0) || String(n) !== v.replace(/^0+/, '')) return false; Z.next = n; }, { mode: 'numeric', bad: 'Enter a whole number above zero' })),
      ui.section({ header: 'Terms', fold: false, showFooter: true, footer: 'Used when a customer has no terms of their own. The due date on each invoice and in the portal comes from this.' },
        ui.pickerRow({ title: 'Default terms', value: Z.terms, options: TERMS.map(([value, label]) => ({ value, label })), onChange: v => { Z.terms = v; re(); } })),
      ui.section({ header: 'Late fee', fold: false, showFooter: true, footer: Z.late.on ? 'An invoice still unpaid ' + plural(Z.late.grace, 'day') + ' after its due date gets a late-fee line of ' + Z.late.pct + '% of the unpaid amount, once a month. Example: ' + money(150) + ' unpaid adds ' + money(150 * Z.late.pct / 100) + '. Check your state’s limit on late fees.' : 'Off: no late fee is added.' },
        ui.toggleRow({ title: 'Add a late fee', value: Z.late.on, onChange: v => { Z.late.on = v; re(); } }),
        Z.late.on && txt('Percent a month', 'Of the unpaid amount', () => String(Z.late.pct), v => { const n = Number(v.replace('%', '')); if (!isFinite(n) || n <= 0 || n > 10 || v === '') return false; Z.late.pct = n; }, { mode: 'decimal', unit: '%', bad: 'Enter a percentage from 0.1 to 10' }),
        Z.late.on && ui.pickerRow({ title: 'Starts', value: Z.late.grace, options: [0, 5, 10, 15, 30].map(n => ({ value: n, label: n ? n + ' days after the due date' : 'The day after the due date' })), onChange: v => { Z.late.grace = v; re(); } })),
      ui.section({ header: 'Getting paid', fold: false },
        RC.paySpec && ui.row({ icon: 'creditcard', iconColor: '#635BFF', title: 'Card and bank payments (Stripe)', subtitle: P.stripe ? 'Connected' : 'Not connected: customers can’t pay online yet', badge: ui.badge(P.stripe ? 'Connected' : 'Not connected', P.stripe ? 'var(--green)' : 'var(--orange)'), chevron: true, onTap: () => page.push(RC.paySpec()) }),
        R11().moneySpec && ui.row({ icon: 'dollarsign.circle', iconColor: 'var(--green)', title: 'Fees for paying in the portal', subtitle: R11().feeText ? R11().feeText().replace('A transaction fee applies to payments made in the portal: ', '') : null, chevron: true, onTap: () => page.push(R11().moneySpec()) }),
        ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'Forms and documents', subtitle: 'The look and wording of invoices, statements, estimates and quotes', chevron: true, onTap: () => page.push(M.formsSpec()) }),
        ui.row({ icon: 'arrow.up.right', iconColor: 'var(--blue)', title: 'Customer portal (preview)', subtitle: 'What a customer sees after the button in the email', chevron: true, onTap: () => { const c = portalDemo(); if (c) page.push(M.portalSpec(c.id)); } }))]
    : ui.section({ header: M.viaName(), fold: false, showFooter: true, footer: 'Numbering, terms and late fees are set in ' + M.viaName() + ' while invoices are created there.' },
        WD.co && WD.co.booksSpec && ui.row({ icon: 'link', iconColor: 'var(--purple)', title: 'Connection and payment-status checks', chevron: true, onTap: () => page.push(WD.co.booksSpec()) })));
} });

/* ================= The email a customer receives ================= */
WD.css(`
.em-wrap { padding: 0 0 16px; }
.em-meta { margin: 0 0 10px; border-radius: 12px; background: var(--cell); padding: 10px 14px; font-size: 14px; line-height: 20px; } .em-meta span { color: var(--label2); display: inline-block; min-width: 62px; } .em-meta b { font-weight: 600; }
.em { background: #fff; color: #1c1c1e; border-radius: 12px; box-shadow: 0 1px 5px rgba(0,0,0,.14); overflow: hidden; font-size: 15px; line-height: 21px; }
.em-top { padding: 18px 20px 12px; border-bottom: 3px solid var(--em-accent, #1F5FBF); display: flex; align-items: center; gap: 12px; justify-content: space-between; flex-wrap: wrap; }
.em-top .co { font-size: 12.5px; line-height: 17px; color: #6b6b70; text-align: right; }
.em-body { padding: 18px 20px; } .em-body p { margin: 0 0 12px; }
.em-box { border: 1px solid #d8d8dc; border-radius: 10px; padding: 12px 14px; margin: 0 0 14px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.em-box small { display: block; color: #6b6b70; font-size: 12.5px; } .em-box b { font-size: 24px; line-height: 28px; letter-spacing: -.4px; } .em-box .d b { font-size: 16px; line-height: 22px; }
.em-btn { display: block; width: 100%; min-height: 48px; border: 0; border-radius: 10px; background: var(--em-accent, #1F5FBF); color: #fff; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; margin: 0 0 14px; }
.em-att { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 6px 12px; border: 1px solid #d8d8dc; border-radius: 10px; background: #f5f5f7; color: #1c1c1e; font: inherit; font-size: 14px; cursor: pointer; text-align: left; }
.em-att i { flex: none; width: 34px; height: 40px; border-radius: 5px; background: #D93025; color: #fff; font: 700 12px/40px -apple-system, Helvetica, sans-serif; text-align: center; font-style: normal; } .em-att small { display: block; color: #6b6b70; font-size: 12.5px; }
.em-foot { padding: 14px 20px 18px; border-top: 1px solid #e5e5ea; font-size: 12.5px; line-height: 18px; color: #6b6b70; }
.em-auto { background: #EAF7EE; color: #1E6B34; border-radius: 8px; padding: 9px 12px; font-size: 13.5px; line-height: 19px; margin: 0 0 14px; }
.mny-paperwrap { padding: 12px; }
`);
const KIND = { invoice: { name: 'Invoice', file: 'Invoice' }, note: { name: 'Service note', file: 'Service-note' }, statement: { name: 'Statement', file: 'Statement' }, estimate: { name: 'Estimate', file: 'Estimate' }, quote: { name: 'Quote', file: 'Quote' }, receipt: { name: 'Receipt', file: 'Receipt' }, cod: { name: 'Certificate of destruction', file: 'Certificate' } };
const shortNo = n => String(n || '').replace(/^[A-Za-z]+[- ]?/, '') || String(n || '');
const pdfSize = n => { let x = 0; for (const ch of String(n)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return 62 + x % 58 + ' KB'; };
const sumLines = lines => (lines || []).reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0);
/** The document behind the PDF attachment: the real invoice view when there is one, otherwise the layout from Forms and documents. */
function docSpecFor(kind, c, rec) {
  const B = WD.screens.billing || {}, job = rec.jobId && q.job(rec.jobId), mi = rec.masterId && (data.masterInvoices || []).find(m => m.id === rec.masterId);
  if (kind === 'invoice' && mi && B.masterDocSpec) return B.masterDocSpec(mi);
  if (kind === 'invoice' && job && job.invoice && B.invoiceDoc) return { title: rec.number, render: () => B.invoiceDoc(job.invoice, job) };
  return { title: rec.number || KIND[kind].name, trailing: [{ icon: 'share', label: 'Share', onTap: () => ui.toast('Share sheet: print, email or save as PDF', 'share', 2400) }], render: () => h('div.mny-paperwrap', renderDoc(kind, layoutFor(kind, c), ctxFor(kind, c, rec))) };
}
/** What a document shows, from a record. */
function ctxFor(kind, c, rec) {
  const C = WD.screens.customers, l = (c && c.locations && c.locations[0]) || {};
  const lines = kind === 'statement' ? (rec.invs || []).map(i => ({ item: i.number, desc: mdy(i.day) + ' · ' + (RC.invStatus ? RC.invStatus(i) : i.status), qty: 1, rate: i.amount, paid: i.status === 'Paid' }))
    : (rec.lines || (kind === 'invoice' && C && C.invLines ? C.invLines(rec) : [])).map(x => ({ item: x.name || x.item || 'Service', desc: x.desc || '', qty: +x.qty || 0, rate: +x.rate || 0 }));
  return { customer: c, number: rec.number || '', date: rec.day || today(), due: kind === 'invoice' ? dueOf(rec) : rec.validUntil || null, lines, po: rec.po || (c && c.po) || '', notes: rec.notes || '', paid: rec.status === 'Paid', address: rec.address || l.address || '', signer: rec.signer || '', values: rec.values || {} };
}
/** A faithful mock of the email. o: {kind: 'invoice' | 'note' | 'statement' | 'estimate' | 'quote', customer, rec}. Returns a page spec. */
M.emailSpec = o => { const kind = KIND[o.kind] ? o.kind : 'invoice', c = o.customer || q.customer((o.rec || {}).customerId) || { name: 'Customer', contacts: [] }, rec = o.rec || {};
  return { title: 'Email preview', render: page => { const O = org(), K = KIND[kind], p = (c.contacts || [])[0] || {}, to = emailOf(c), first = (p.name || '').split(' ')[0], dom = String(O.email || 'office@company.example').split('@')[1], acc = M.docAccent(kind) || '#1F5FBF';
    const amount = rec.amount != null ? rec.amount : kind === 'statement' ? (rec.invs || []).filter(i => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0) : sumLines(rec.lines), paid = rec.status === 'Paid', due = kind === 'invoice' && rec.day ? dueOf(rec) : null, ap = c.id && M.autopayText(c), apOK = ap && autopayCovers(c, amount);
    const subject = kind === 'invoice' ? 'Invoice ' + rec.number + ' from ' + O.name : kind === 'note' ? 'Service note ' + rec.number + ' from ' + O.name : kind === 'statement' ? 'Your statement from ' + O.name + (amount ? ' · ' + money(amount) + ' due' : '') : K.name + ' ' + rec.number + ' from ' + O.name;
    const file = K.file + '-' + (kind === 'statement' ? today() : shortNo(rec.number)) + '.pdf', btn = kind === 'invoice' || kind === 'statement' ? (paid || !amount ? 'View in the portal' : 'View and pay in the portal') : kind === 'note' ? 'View in the portal' : 'View and accept in the portal';
    const say = kind === 'invoice' ? ['Here is invoice ', h('b', rec.number), rec.day ? ' for your service on ' + mdy(rec.day) + '.' : '.', paid ? ' It is paid. Thank you.' : ' It is attached as a PDF, and you can see and pay it online with the button below.']
      : kind === 'note' ? ['Here is service note ', h('b', rec.number), ' for your visit on ' + mdy(rec.day || today()) + (rec.signer ? ', signed by ' + rec.signer : '') + '. It is not a bill: your monthly invoice will list this visit.']
      : kind === 'statement' ? ['Here is your statement as of ' + mdy(today()) + (rec.all ? ', listing every invoice and payment so you can compare it with your records.' : ', listing the invoices that are still open.')]
      : ['Here is ' + K.name.toLowerCase() + ' ', h('b', rec.number), ' for the work we discussed', rec.validUntil ? '. The price holds until ' + mdy(rec.validUntil) + '.' : '.', ' You can accept it online with the button below.'];
    return h('div.em-wrap', note('What ' + (p.name || c.name) + ' receives. The ' + K.name.toLowerCase() + ' is attached as a PDF and the button opens their portal.'),
      h('div.em-meta', h('div', h('span', 'From'), h('b', O.name), ' <billing@' + dom + '>'), h('div', h('span', 'To'), to || h('i', { style: 'color:var(--red)' }, 'No email on file for this customer')), h('div', h('span', 'Subject'), h('b', subject))),
      h('div.em', { style: { '--em-accent': acc } },
        h('div.em-top', (WD.screens.billing && WD.screens.billing.logo) ? WD.screens.billing.logo() : h('b', O.name), h('div.co', h('div', h('b', { style: 'color:#1c1c1e' }, O.name)), (O.remit || []).slice(1).map(x => h('div', x)), O.phone && h('div', O.phone))),
        h('div.em-body', h('p', 'Hello' + (first ? ' ' + first : '') + ','), h('p', say),
          kind !== 'note' && h('div.em-box', h('div', h('small', kind === 'invoice' || kind === 'statement' ? (paid ? 'Paid' : 'Amount due') : 'Total'), h('b', money(amount))),
            h('div.d', h('small', kind === 'invoice' ? 'Due date' : kind === 'statement' ? 'Open invoices' : 'Valid until'), h('b', kind === 'invoice' ? (due ? mdy(due) : '—') : kind === 'statement' ? String((rec.invs || []).filter(i => i.status !== 'Paid').length) : rec.validUntil ? mdy(rec.validUntil) : '—'))),
          kind === 'invoice' && !paid && ap && h('div.em-auto', apOK ? 'Autopay is on. ' + ap.split(' · ')[0] + ' will be charged automatically on ' + (due ? mdy(due) : 'the due date') + '. There is nothing you need to do.' : 'Autopay is on, but this invoice is over your autopay limit. Please pay it in the portal.'),
          h('button.em-btn', { onclick: () => c.id ? page.push(M.portalSpec(c.id, { tab: kind === 'estimate' ? 'estimates' : kind === 'quote' ? 'quotes' : kind === 'statement' ? 'statements' : 'invoices' })) : ui.toast('Open a customer to see their portal', 'info.circle') }, btn),
          h('button.em-att', { 'aria-label': 'Open the attachment ' + file, onclick: () => page.push(docSpecFor(kind, c, kind === 'statement' ? { ...rec, number: 'Statement' } : rec)) }, h('i', 'PDF'), h('div', h('div', { style: 'font-weight:600' }, file), h('small', pdfSize(file) + ' · tap to open'))),
          h('p', { style: 'margin:14px 0 0' }, 'Questions? Reply to this email or call ' + (O.phone || 'the office') + '.'), h('p', { style: 'margin:10px 0 0' }, 'Thank you,', h('br'), O.name)),
        h('div.em-foot', h('div', [O.name].concat((O.remit || []).slice(1)).join(' · ')), h('div', [O.phone, O.email, O.website].filter(Boolean).join(' · ')), h('div', { style: 'margin-top:6px' }, 'You are receiving this because you are a customer of ' + O.name + '. The portal link in this email is yours alone; please don’t forward it.'))),
      h('div', { style: 'padding:10px 4px 0' }, ui.note('The wording comes from Settings → Templates; the layout of the attached PDF from Settings → Company → Forms and documents.')));
  } }; };
M.emailPreview = o => WD.nav.push(M.emailSpec(o));

/* ================= Customer portal (preview), Stripe test payments and autopay ================= */
WD.css(`
.pt-frame { padding: 0 0 18px; }
.pt-note { display: flex; align-items: center; gap: 8px; padding: 9px 12px; margin: 0 0 8px; border-radius: 10px; background: color-mix(in srgb, var(--orange) 18%, var(--cell)); color: var(--label); font-size: 13.5px; line-height: 18px; font-weight: 600; }
.pt { background: #F4F6F9; color: #1B2430; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,.16); font-size: 15px; line-height: 20px; }
.pt-url { display: flex; align-items: center; gap: 6px; padding: 7px 12px; background: #E3E7ED; color: #55606E; font-size: 12.5px; }
.pt-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #DDE2E8; flex-wrap: wrap; } .pt-head .who { margin-left: auto; text-align: right; font-size: 13px; line-height: 17px; color: #55606E; } .pt-head .who b { display: block; color: #1B2430; font-size: 14px; }
.pt-head .bi-logo { zoom: .62; margin: 0; }
.pt-tabs { display: flex; gap: 4px; padding: 8px 10px; background: #fff; border-bottom: 1px solid #DDE2E8; overflow-x: auto; scrollbar-width: none; } .pt-tabs::-webkit-scrollbar { display: none; }
.pt-tabs button { flex: none; min-height: 44px; border: 0; border-radius: 8px; padding: 0 12px; background: none; color: #55606E; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; } .pt-tabs button.on { background: var(--pt-accent, #1F5FBF); color: #fff; }
.pt-body { padding: 14px 12px 18px; } .pt-body h5 { margin: 14px 4px 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .3px; color: #55606E; } .pt-body h5:first-child { margin-top: 0; }
.pt-card { background: #fff; border: 1px solid #DDE2E8; border-radius: 10px; overflow: hidden; }
.pt-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid #EDF0F3; min-height: 44px; } .pt-row:first-child { border-top: 0; } .pt-row .m { flex: 1; min-width: 0; } .pt-row .m b { display: block; font-weight: 600; } .pt-row .m small { display: block; color: #55606E; font-size: 13px; line-height: 17px; }
.pt-row .a { text-align: right; white-space: nowrap; font-weight: 600; } .pt-row .a small { display: block; font-weight: 400; color: #55606E; font-size: 12.5px; }
.pt-row.tap { cursor: pointer; }
.pt-btn { flex: none; min-height: 44px; border: 0; border-radius: 8px; padding: 0 14px; background: var(--pt-accent, #1F5FBF); color: #fff; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; } .pt-btn.ghost { background: #EDF0F3; color: #1B2430; } .pt-btn.wide { display: block; width: 100%; margin-top: 10px; }
.pt-tag { display: inline-block; border-radius: 6px; padding: 1px 7px; font-size: 12px; font-weight: 700; background: #EDF0F3; color: #55606E; } .pt-tag.g { background: #E2F4E7; color: #1E6B34; } .pt-tag.r { background: #FCE4E2; color: #A1271C; } .pt-tag.b { background: #E1ECFB; color: #1F4F9C; } .pt-tag.o { background: #FCEFD9; color: #8A5A00; }
.pt-sum { display: flex; gap: 10px; flex-wrap: wrap; margin: 0 0 10px; } .pt-sum > div { flex: 1 1 120px; background: #fff; border: 1px solid #DDE2E8; border-radius: 10px; padding: 10px 12px; } .pt-sum small { display: block; color: #55606E; font-size: 12.5px; } .pt-sum b { font-size: 21px; line-height: 26px; letter-spacing: -.3px; }
.pt-empty { padding: 18px 12px; text-align: center; color: #55606E; font-size: 14px; }
.pt-test { background: #FFF6D6; color: #6B5200; border-radius: 8px; padding: 9px 12px; font-size: 13.5px; line-height: 18px; margin: 0 0 10px; }
.pt-sw { flex: none; width: 51px; height: 44px; border: 0; background: none; padding: 6px 0; cursor: pointer; } .pt-sw i { display: block; width: 51px; height: 31px; border-radius: 16px; background: #C9CFD8; position: relative; transition: background .2s; } .pt-sw i::after { content: ''; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .2s; }
.pt-sw.on i { background: #2FA84F; } .pt-sw.on i::after { transform: translateX(20px); }
`);
const TEST_CARDS = [{ brand: 'Visa', number: '4242 4242 4242 4242', last4: '4242' }, { brand: 'Mastercard', number: '5555 5555 5555 4444', last4: '4444' }, { brand: 'American Express', number: '3782 822463 10005', last4: '0005' }];
const TEST_BANK = { bank: 'Stripe test bank', routing: '110000000', account: '000123456789', last4: '6789' };
/** What the customer has set up in the portal: saved payment methods (Stripe holds the details), autopay and credits. */
const pstate = c => c.portal || (c.portal = { methods: c.cardOnFile ? [{ id: 'pm1', type: 'card', brand: 'Visa', last4: '4242', exp: '12/34' }] : [], autopay: { on: false, methodId: null, max: 0 }, credits: [] });
const methodLabel = m => !m ? '' : m.type === 'card' ? (m.brand === 'American Express' ? 'Amex' : m.brand) + ' ·' + m.last4 : 'Bank ·' + m.last4;
const autoMethod = c => { const P = pstate(c); return P.autopay.on ? P.methods.find(m => m.id === P.autopay.methodId) || P.methods[0] || null : null; };
const autopayCovers = (c, amount) => { const P = pstate(c); return !!autoMethod(c) && (!P.autopay.max || amount <= P.autopay.max); };
/** '' when autopay is off; otherwise “Visa ·4242” (and the limit). Shown on the customer's Billing tab. */
M.autopayText = c => { if (!c || !c.id) return ''; const m = autoMethod(c), P = pstate(c); return m ? methodLabel(m) + (P.autopay.max ? ' · up to ' + fmt.money(P.autopay.max) + ' an invoice' : '') : ''; };
/** The line under an unpaid invoice of a customer with autopay. */
M.autopayNote = inv => { const c = q.customer(inv.customerId); if (!c || !autoMethod(c)) return null; const ok = autopayCovers(c, inv.amount);
  return h('div.footnote', { style: 'margin-top:6px;display:flex;gap:5px;align-items:center;justify-content:center;color:' + (ok ? 'var(--green)' : 'var(--orange)') }, icon(ok ? 'arrow.clockwise' : 'exclamationmark.triangle', 14), ok ? 'Will be charged automatically on the due date · ' + methodLabel(autoMethod(c)) : 'Over the autopay limit of ' + fmt.money(pstate(c).autopay.max) + ': the customer pays this one themselves'); };
const isOpen = r => r.status !== 'Paid' && r.status !== 'Draft' && !(WD.invClosed && WD.invClosed(r));
const statusOf = r => RC.invStatus ? RC.invStatus(r) : r.status;
/** Mark an invoice paid and add the payment record. via: shown as “Paid in …” on the invoice. */
function settle(rec, method, via, fee) {
  if (!rec || rec.status === 'Paid') return; const c = q.customer(rec.customerId), job = rec.jobId && q.job(rec.jobId), at = +WD.now();
  if (c && c.stats) { if (rec.status === 'Overdue') c.stats.balance = Math.max(0, c.stats.balance - rec.amount); c.stats.paid += rec.amount; }
  rec.status = 'Paid'; if (via) rec.paidVia = via; const pay = { id: uid('pay-p'), invoiceId: rec.id, customerId: rec.customerId, at, amount: rec.amount, method, fee: fee || 0 }; (data.payments = data.payments || []).push(pay); (rec.payments = rec.payments || []).push(pay.id);
  if (job && job.invoice) { job.invoice.status = 'Paid'; job.invoice.paid = { method, at }; if (job.events) job.events.push({ at, actor: via ? 'Customer' : me(), text: 'Paid · ' + method + ' · ' + money(rec.amount) }); }
}
const feeFor = (amount, m) => R11().portalFee ? R11().portalFee(amount, m.type === 'card' ? 'card' : 'ach') : 0;
/** The fake Stripe form. Only Stripe's published test numbers are offered and they can't be edited: the prototype never takes a real card or bank number. */
function addMethodSheet(c, done) { const f = { type: 'card', card: 0 };
  ui.sheet({ title: 'Add a payment method', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: async p => {
      const P = pstate(c), t = f.type === 'card' ? { type: 'card', brand: TEST_CARDS[f.card].brand, last4: TEST_CARDS[f.card].last4, exp: '12/34' } : { type: 'bank', bank: TEST_BANK.bank, last4: TEST_BANK.last4 };
      if (P.methods.some(m => m.type === t.type && m.last4 === t.last4)) return ui.toast('That one is already saved', 'info.circle');
      if (!await ui.run('Saving with Stripe (test mode)…', () => { P.methods.push({ id: uid('pm'), ...t }); }, { done: 'Saved' })) return; WD.changed(); p.dismiss(); done && done(); } }],
    render: p => ui.list(h('div', { style: 'padding:0 0 8px' }, h('div.pt-test', h('b', 'Stripe test mode. '), 'This preview only uses Stripe’s published test numbers. It never asks for, and can’t take, a real card or bank account number.')),
      ui.section({ fold: false }, h('div', { style: 'padding:8px 16px;background:var(--cell)' }, ui.segmented([{ value: 'card', label: 'Card' }, { value: 'bank', label: 'Bank account (ACH)' }], f.type, v => { f.type = v; p.refresh(); }))),
      f.type === 'card' ? ui.section({ header: 'Test card', fold: false, showFooter: true, footer: 'In the real portal these fields are Stripe’s own secure form. The card number goes to Stripe and is never stored in RouteClerk.' },
          ui.pickerRow({ title: 'Test card', value: f.card, options: TEST_CARDS.map((t, i) => ({ value: i, label: t.brand + ' (test)' })), onChange: v => { f.card = v; p.refresh(); } }),
          ui.row({ title: 'Card number', subtitle: 'Stripe test number', detail: TEST_CARDS[f.card].number }), ui.row({ title: 'Expires', detail: '12 / 34' }), ui.row({ title: 'Security code', detail: f.card === 2 ? '1234' : '123' }), ui.row({ title: 'ZIP code', detail: '78000' }))
        : ui.section({ header: 'Test bank account', fold: false, showFooter: true, footer: 'In the real portal the customer signs in to their bank through Stripe, or enters these and confirms two small deposits. Bank payments take 3 to 5 business days.' },
          ui.row({ title: 'Bank', detail: TEST_BANK.bank }), ui.row({ title: 'Routing number', subtitle: 'Stripe test number', detail: TEST_BANK.routing }), ui.row({ title: 'Account number', subtitle: 'Stripe test number', detail: TEST_BANK.account }))) }, { detent: 'large' });
}
/** Pay one invoice in the portal. */
function paySheet(c, rec, done) { const P = pstate(c), f = { id: (P.methods[0] || {}).id || null };
  ui.sheet({ title: 'Pay ' + rec.number, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    render: p => { const m = P.methods.find(x => x.id === f.id) || P.methods[0], fee = m ? feeFor(rec.amount, m) : 0;
      return ui.list(
        ui.section({ header: 'Pay with', fold: false }, P.methods.map(x => ui.row({ icon: f.id === x.id || (!f.id && x === m) ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: x === m ? 'var(--tint)' : 'var(--label3)', title: methodLabel(x), subtitle: x.type === 'card' ? 'Card · expires ' + x.exp : x.bank, onTap: () => { f.id = x.id; p.refresh(); } })),
          ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: P.methods.length ? 'Add another card or bank account' : 'Add a card or bank account', tint: true, onTap: () => addMethodSheet(c, () => { f.id = P.methods[P.methods.length - 1].id; p.refresh(); }) })),
        m && ui.section({ fold: false, showFooter: true, footer: fee ? 'The fee is the one in your service agreement for paying ' + (m.type === 'card' ? 'by card' : 'from a bank account') + '. Paying by check has no fee.' : null },
          ui.row({ title: 'Invoice ' + rec.number, detail: money(rec.amount) }), fee > 0 && ui.row({ title: m.type === 'card' ? 'Card fee' : 'Bank payment fee', detail: money(fee) }), ui.row({ title: h('b', 'Total'), detail: h('b', { style: 'color:var(--label)' }, money(rec.amount + fee)) })),
        h('div', { style: 'padding:12px 0 0' }, ui.button(m ? 'Pay ' + money(rec.amount + fee) : 'Add a payment method first', { disabled: !m, onTap: async () => {
          if (!await ui.run('Paying through Stripe (test mode)…', () => settle(rec, methodLabel(m) + ' · portal', 'the customer portal', fee), { done: 'Paid', min: 900, max: 1500 })) return; WD.changed(); p.dismiss(); done && done(); } })),
        h('div', { style: 'padding:10px 4px 0' }, ui.note('Test mode: no money moves.'))); } }, { detent: 'large' });
}
const PTABS = [['invoices', 'Invoices'], ['payments', 'Payments'], ['quotes', 'Quotes'], ['estimates', 'Estimates'], ['statements', 'Statements'], ['credits', 'Credits'], ['methods', 'Payment methods'], ['autopay', 'Autopay'], ['documents', 'Documents'], ['subs', 'Subscriptions']];
const portalDemo = () => data.customers.find(c => recurring(c) && (data.invoices || []).some(i => i.customerId === c.id && isOpen(i))) || data.customers.find(recurring) || data.customers[0];
/** What the customer sees after pressing the button in the email. o: {tab}. */
M.portalSpec = (customerId, o = {}) => { const st = { tab: o.tab || 'invoices' };
  return { title: 'Customer portal preview', render: page => { const c = q.customer(customerId); if (!c) return ui.empty({ icon: 'person', title: 'Customer not found' });
    const O = org(), P = pstate(c), p = (c.contacts || [])[0] || {}, re = () => page.refresh(), dom = String(O.website || 'company.example').replace(/^https?:\/\//, ''), acc = M.docAccent('invoice') || '#1F5FBF';
    const invs = (data.invoices || []).filter(i => i.customerId === c.id && i.status !== 'Draft' && !(WD.invClosed && WD.invClosed(i))).sort((a, b) => b.day.localeCompare(a.day)), open = invs.filter(isOpen), paid = invs.filter(i => i.status === 'Paid'), bal = open.reduce((s, i) => s + i.amount, 0);
    const row = (main, sub, right, rsub, act, tap) => h('div.pt-row' + (tap ? '.tap' : ''), { onclick: tap || null }, h('div.m', h('b', main), sub && h('small', sub)), (right || rsub) && h('div.a', right, rsub && h('small', rsub)), act);
    const card = (...rows) => h('div.pt-card', rows), empty = t => h('div.pt-card', h('div.pt-empty', t)), view = (kind, rec) => () => page.push(docSpecFor(kind, c, rec));
    const ests = kind => (data.estimates || []).filter(e => e.customerId === c.id && e.kind === kind && e.status !== 'draft');
    const estRows = list => list.map(e => row(e.number, mdy(e.day) + (e.validUntil ? ' · valid until ' + mdy(e.validUntil) : ''), money(sumLines(e.lines)), null,
      e.status === 'accepted' ? h('span.pt-tag.g', 'Accepted') : h('button.pt-btn', { onclick: async ev => { ev.stopPropagation(); if (await ui.run('Accepting…', () => { e.status = 'accepted'; e.acceptedAt = +WD.now(); e.acceptedBy = p.name || c.name; }, { done: 'Accepted' })) { WD.changed(); re(); ui.banner({ title: KIND[e.kind].name + ' accepted', text: c.name + ' accepted ' + e.number + ' in the portal.', icon: 'checkmark.circle', color: 'var(--green)' }); } } }, 'Accept'), view(e.kind, e)));
    const body = {
      invoices: () => [h('div.pt-sum', h('div', h('small', 'Balance due'), h('b', money(bal))), h('div', h('small', 'Open invoices'), h('b', String(open.length))), h('div', h('small', 'Autopay'), h('b', { style: 'font-size:16px' }, autoMethod(c) ? 'On · ' + methodLabel(autoMethod(c)) : 'Off'))),
        h('h5', 'Open'), open.length ? card(open.map(i => { const auto = autopayCovers(c, i.amount), late = statusOf(i) === 'Overdue';
          return row(i.number, mdy(i.day) + ' · due ' + mdy(dueOf(i)) + (auto ? ' · autopay on the due date' : ''), money(i.amount), late ? h('span.pt-tag.r', 'Past due') : null, h('button.pt-btn', { 'aria-label': 'Pay ' + i.number, onclick: ev => { ev.stopPropagation(); paySheet(c, i, re); } }, 'Pay'), view('invoice', i)); })) : empty('Nothing to pay. Thank you.'),
        h('h5', 'Paid'), paid.length ? card(paid.slice(0, 6).map(i => row(i.number, mdy(i.day), money(i.amount), h('span.pt-tag.g', 'Paid'), null, view('invoice', i)))) : empty('No paid invoices yet.')],
      payments: () => { const list = (data.payments || []).filter(x => x.customerId === c.id).sort((a, b) => b.at - a.at); return [h('h5', 'Payments'), list.length ? card(list.slice(0, 12).map(x => { const inv = (data.invoices || []).find(i => i.id === x.invoiceId); return row(stampDay(x.at), x.method + (inv ? ' · ' + inv.number : ''), money(x.amount + (x.fee || 0)), x.fee ? 'includes ' + money(x.fee) + ' fee' : null); })) : empty('No payments yet.')]; },
      quotes: () => { const mine = (data.quotes || []).filter(x => x.customerId === c.id && x.status !== 'draft'), own = ests('quote');
        return [h('h5', 'Quotes'), mine.length || own.length ? card(estRows(own), mine.map(x => row(x.number || x.title || 'Quote', x.sentAt ? 'Sent ' + stampDay(x.sentAt) : '', money(x.total != null ? x.total : x.amount != null ? x.amount : sumLines(x.lines || x.items)), null, h('span.pt-tag.' + (x.status === 'accepted' || x.status === 'won' ? 'g' : 'b'), x.status === 'accepted' || x.status === 'won' ? 'Accepted' : 'Waiting for you')))) : empty('No quotes right now.')]; },
      estimates: () => { const list = ests('estimate'); return [h('h5', 'Estimates'), list.length ? card(estRows(list)) : empty('No estimates right now.')]; },
      statements: () => [h('h5', 'Statements'), card(row('Open invoices', 'Everything still unpaid, as of today', money(bal), null, h('button.pt-btn.ghost', { onclick: view('statement', { invs: open, day: today(), number: 'Statement' }) }, 'View')),
        row('All invoices and payments', 'Paid and unpaid, to compare with your records', plural(invs.length, 'invoice'), null, h('button.pt-btn.ghost', { onclick: view('statement', { invs, all: true, day: today(), number: 'Statement' }) }, 'View')))],
      credits: () => [h('h5', 'Credits'), P.credits.length ? card(P.credits.map(x => row(x.title, stampDay(x.at), money(x.amount), 'applied to your next invoice'))) : empty('No credits on your account. A credit appears here when we owe you money, and is taken off your next invoice.')],
      methods: () => [h('h5', 'Saved with Stripe'), P.methods.length ? card(P.methods.map(m => row(methodLabel(m), m.type === 'card' ? m.brand + ' · expires ' + m.exp : m.bank + ' · bank payments take 3 to 5 business days', autoMethod(c) === m ? h('span.pt-tag.g', 'Autopay') : null, null,
          h('button.pt-btn.ghost', { 'aria-label': 'Remove ' + methodLabel(m), onclick: async () => { if (!await ui.actionSheet({ title: 'Remove ' + methodLabel(m) + '?', message: autoMethod(c) === m ? 'Autopay uses this one, so autopay is switched off too.' : null, buttons: [{ label: 'Remove', value: true, role: 'destructive' }] })) return; if (autoMethod(c) === m) P.autopay.on = false; P.methods = P.methods.filter(x => x !== m); WD.changed(); re(); } }, 'Remove')))) : empty('No card or bank account saved yet.'),
        h('button.pt-btn.wide', { onclick: () => addMethodSheet(c, re) }, 'Set up Stripe payments: add a card or bank account'),
        h('div.pt-test', { style: 'margin-top:10px' }, 'Card and bank details are held by Stripe. ' + O.name + ' only sees the type and the last four digits.')],
      autopay: () => { const A = P.autopay, m = autoMethod(c);
        return [h('h5', 'Autopay'), card(h('div.pt-row', h('div.m', h('b', 'Pay each invoice automatically'), h('small', A.on && m ? 'On. Each new invoice is charged to ' + methodLabel(m) + ' on its due date.' : 'Off. You pay each invoice yourself.')),
            h('button.pt-sw' + (A.on ? '.on' : ''), { role: 'switch', 'aria-checked': A.on ? 'true' : 'false', 'aria-label': 'Autopay', onclick: () => { if (!A.on && !P.methods.length) return addMethodSheet(c, () => { A.on = true; A.methodId = P.methods[0].id; WD.changed(); re(); autoBanner(c); });
              A.on = !A.on; if (A.on && !P.methods.some(x => x.id === A.methodId)) A.methodId = P.methods[0].id; WD.changed(); re(); if (A.on) autoBanner(c); } }, h('i'))),
          A.on && P.methods.map(x => h('div.pt-row.tap', { onclick: () => { A.methodId = x.id; WD.changed(); re(); } }, h('div.m', h('b', methodLabel(x)), h('small', x.type === 'card' ? 'Card' : 'Bank account')), x === m ? h('span.pt-tag.g', 'Used for autopay') : h('span.pt-tag', 'Use this one'))),
          A.on && h('div.pt-row', h('div.m', h('b', 'Most to charge automatically'), h('small', A.max ? 'An invoice over ' + fmt.money(A.max) + ' waits for you to pay it.' : 'No limit: every invoice is paid automatically.')),
            h('button.pt-btn.ghost', { onclick: async e => { const el = e.currentTarget; ui.menu(el, [0, 250, 500, 1000, 2500].map(n => ({ label: n ? 'Up to ' + fmt.money(n) : 'No limit', checked: A.max === n, onTap: () => { A.max = n; WD.changed(); re(); } }))); } }, A.max ? fmt.money(A.max) : 'No limit'))),
          A.on && open.length > 0 && h('div.pt-test', { style: 'margin-top:10px;background:#E2F4E7;color:#1E6B34' }, plural(open.filter(i => autopayCovers(c, i.amount)).length, 'open invoice') + ' will be charged on the due date. You get a receipt by email each time.'),
          h('div.pt-test', { style: 'margin-top:10px' }, 'You can turn autopay off at any time. A charge already made is not affected.')]; },
      documents: () => { const ags = (data.agreements || []).filter(a => a.customerId === c.id && a.status !== 'draft'), dl = name => () => ui.toast('Downloads ' + name, 'doc', 2200);
        return [h('h5', 'Agreements'), ags.length ? card(ags.map(a => row('Service agreement ' + a.number, a.status === 'signed' ? 'Signed by ' + (a.signer || 'you') + (a.signedAt ? ' on ' + stampDay(a.signedAt) : '') : 'Waiting for your signature', h('span.pt-tag.' + (a.status === 'signed' ? 'g' : 'o'), a.status === 'signed' ? 'Signed' : 'To sign'), null, null, WD.x && WD.x.agreementSpec ? () => page.push(WD.x.agreementSpec(a)) : dl('Agreement-' + a.number + '.pdf')))) : empty('No service agreement on file.'),
          h('h5', 'Certificates of destruction'), invs.length ? card(invs.slice(0, 4).map(i => row('Certificate · ' + mdy(i.day), 'With invoice ' + i.number, null, null, h('button.pt-btn.ghost', { onclick: dl('Certificate-' + shortNo(i.number) + '.pdf') }, 'PDF')))) : empty('Certificates appear here after each service.'),
          h('h5', 'From ' + O.name), card(row('Certificate of insurance (COI)', 'General liability and auto · current policy year', null, null, h('button.pt-btn.ghost', { onclick: dl('COI-' + today().slice(0, 4) + '.pdf') }, 'PDF')), row('W-9', 'Our taxpayer information for your accounts payable', null, null, h('button.pt-btn.ghost', { onclick: dl('W-9.pdf') }, 'PDF')))]; },
      subs: () => { const P2 = PX(), items = P2 ? (P2.loc(c).items || []).filter(i => i.qty > 0) : [], per = P2 ? P2.perVisit(items) : 0, next = q.jobsForCustomer(c.id).find(j => j.status === 'scheduled' && j.day >= today());
        return [h('h5', 'Your recurring service'), items.length && recurring(c) ? card(row(c.freq, (c.locations[0] || {}).address || '', money(per), 'each visit'), items.map(i => row(i.qty + ' × ' + (P2.pb(i.id).name || i.id), null, money(i.rate), 'each')),
            next && row('Next visit', fmt.day(next.day, 'long'), null, null), c.upcoming && row('Price change', 'Starts with your service on ' + mdy(c.upcoming.effective), money(P2.perVisit(c.upcoming.items)), 'each visit')) : empty('No recurring service. One-time jobs show under Invoices.'),
          h('div.pt-test', { style: 'margin-top:10px' }, 'To change or pause your service, call ' + (O.phone || 'the office') + ' or reply to any invoice email.')]; } };
    if (!body[st.tab]) st.tab = 'invoices';
    return h('div.pt-frame', h('div.pt-note', icon('eye.slash', 16), 'Customer portal preview: this is what ' + (p.name || c.name) + ' sees. Staff never see card or bank numbers.'),
      h('div.pt', { style: { '--pt-accent': acc } }, h('div.pt-url', icon('lock', 13), 'portal.' + dom + ' · signed in with the link from the email'),
        h('div.pt-head', (WD.screens.billing && WD.screens.billing.logo) ? WD.screens.billing.logo() : h('b', O.name), h('div.who', h('b', c.name), p.name ? p.name + (emailOf(c) ? ' · ' + emailOf(c) : '') : emailOf(c))),
        h('div.pt-tabs', { role: 'tablist' }, PTABS.map(([id, label]) => h('button' + (st.tab === id ? '.on' : ''), { role: 'tab', 'aria-selected': st.tab === id ? 'true' : 'false', onclick: () => { st.tab = id; re(); } }, label))),
        h('div.pt-body', body[st.tab]())));
  } }; };
const autoBanner = c => ui.banner({ title: 'Autopay turned on', text: c.name + ' will be charged automatically on each due date · ' + M.autopayText(c) + '.', icon: 'arrow.clockwise', color: 'var(--green)', duration: 6000 });
/* Two customers already have autopay on, so the Billing tab and the Autopay tile have something to show. */
(() => { const owes = c => (data.invoices || []).some(i => i.customerId === c.id && isOpen(i)), rec = data.customers.filter(recurring);
  rec.filter(c => c.cardOnFile && owes(c)).concat(rec.filter(c => !c.cardOnFile && owes(c)), rec.filter(c => c.cardOnFile && !owes(c))).slice(0, 2).forEach((c, i) => { const P = pstate(c); if (!P.methods.length) P.methods.push({ id: 'pm1', type: 'card', brand: i ? 'Mastercard' : 'Visa', last4: i ? '4444' : '4242', exp: '12/34' }); P.autopay = { on: true, methodId: P.methods[0].id, max: 0 }; }); })();

/* ================= Invoices screen: tiles, aging, bulk actions, desktop table (workflow.js calls WD.money.inv) ================= */
WD.css(`
.iv-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 4px 16px 10px; }
.iv-tile { min-width: 0; min-height: 62px; border: 0; border-radius: 12px; background: var(--cell); color: var(--label); font: inherit; text-align: left; padding: 8px 10px; cursor: pointer; display: flex; flex-direction: column; justify-content: center; box-shadow: inset 0 0 0 0 var(--tint); }
.iv-tile small { font-size: 12px; line-height: 15px; color: var(--label2); } .iv-tile b { font-size: 17px; line-height: 22px; letter-spacing: -.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .iv-tile i { font-style: normal; font-size: 12px; line-height: 15px; color: var(--label2); }
.iv-tile.on { box-shadow: inset 0 0 0 2px var(--tint); background: color-mix(in srgb, var(--tint) 10%, var(--cell)); }
.iv-age { padding: 0 16px 10px; } .iv-age .bar { display: flex; gap: 2px; height: 44px; align-items: stretch; }
.iv-age button { min-width: 44px; border: 0; padding: 0; background: none; cursor: pointer; display: flex; flex-direction: column; justify-content: flex-end; font: inherit; color: var(--label2); }
.iv-age button span { display: block; height: 14px; border-radius: 4px; background: var(--c); opacity: .85; } .iv-age button.on span { opacity: 1; box-shadow: 0 0 0 2px var(--label); }
.iv-age button small { font-size: 12px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; } .iv-age button.on small { color: var(--label); font-weight: 700; }
.iv-ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 0 16px 10px; } .iv-ctl .sp { flex: 1; }
.iv-pill { min-height: 44px; border: 0; border-radius: 22px; padding: 0 13px; display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 14px; font-weight: 600; background: var(--fill3); color: var(--label); cursor: pointer; } .iv-pill.on { background: var(--tint); color: #fff; } .iv-pill:disabled { opacity: .45; cursor: default; }
.iv-bulk { position: sticky; top: 0; z-index: 3; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 0 16px 10px; padding: 8px 12px; border-radius: 12px; background: var(--cell); box-shadow: 0 1px 6px rgba(0,0,0,.14); } .iv-bulk b { font-size: 15px; margin-right: auto; }
.iv-tablewrap { margin: 0 16px 16px; border-radius: 12px; background: var(--cell); overflow-x: auto; }
.iv-table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 19px; }
.iv-table th { position: sticky; top: 0; background: var(--cell); text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .2px; color: var(--label2); padding: 0; border-bottom: 1px solid var(--sep); white-space: nowrap; }
.iv-table th button { width: 100%; min-height: 44px; border: 0; background: none; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; text-align: inherit; padding: 0 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; } .iv-table th.on button { color: var(--tint); }
.iv-table th.r button { justify-content: flex-end; }
.iv-table td { padding: 0 10px; height: 44px; border-top: .5px solid var(--sep); white-space: nowrap; } .iv-table td.r { text-align: right; font-variant-numeric: tabular-nums; } .iv-table td.c { max-width: 260px; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.iv-table tbody tr { cursor: pointer; } .iv-table tbody tr:hover { background: var(--fill3); } .iv-table td.k, .iv-table th.k { width: 44px; padding: 0 0 0 10px; }
.phone.desktop .mny-wide .iv-tiles { grid-template-columns: repeat(6, 1fr); }
.phone.desktop .page-body:not(.noscroll) > .mny-wide, .phone.desktop .page-body:not(.noscroll) > .list.wide { max-width: none; }
`);
const IS = { tile: null, age: null, sort: 'new', asc: false, sel: null };
const AGES = [['cur', 'Current', 'var(--green)', d => d <= 0], ['a30', '1–30', 'var(--yellow)', d => d > 0 && d <= 30], ['a60', '31–60', 'var(--orange)', d => d > 30 && d <= 60], ['a90', '61–90', 'var(--red)', d => d > 60 && d <= 90], ['a90p', '90+', 'var(--purple)', d => d > 90]];
const pastDue = r => D.diff(today(), dueOf(r)), custAuto = r => { const c = q.customer(r.customerId); return !!c && autopayCovers(c, r.amount); };
const paidAt = r => { const ids = r.payments || [], p = ids.length ? (data.payments || []).find(x => x.id === ids[ids.length - 1]) : null; return p ? p.at : r.at; };
const lastSent = r => r.status === 'Draft' ? null : r.lastSent || r.at;
const TILES = { out: r => isOpen(r), over: r => isOpen(r) && statusOf(r) === 'Overdue', week: r => isOpen(r) && pastDue(r) <= 0 && pastDue(r) >= -7, paid: r => r.status === 'Paid' && D.key(new Date(paidAt(r))).slice(0, 7) === today().slice(0, 7), draft: r => r.status === 'Draft', auto: r => isOpen(r) && custAuto(r) };
const SORTS = { new: ['Newest first', r => r.at, false], old: ['Oldest first', r => r.at, true], amount: ['Largest amount', r => r.amount, false], due: ['Due soonest', r => (isOpen(r) ? '' : '~') + dueOf(r), true], customer: ['Customer A to Z', r => ((q.customer(r.customerId) || {}).name || '').toLowerCase(), true] };
const COLS = [['number', 'Number', r => r.number], ['customer', 'Customer', r => ((q.customer(r.customerId) || {}).name || '').toLowerCase()], ['date', 'Date', r => r.day], ['due', 'Due', r => dueOf(r)], ['amount', 'Amount', r => r.amount, 'r'], ['balance', 'Balance', r => isOpen(r) ? r.amount : 0, 'r'], ['status', 'Status', r => statusOf(r)], ['sent', 'Last sent', r => lastSent(r) || 0], ['autopay', 'Autopay', r => custAuto(r) ? 1 : 0]];
const IC = { Paid: 'var(--green)', Sent: 'var(--blue)', Overdue: 'var(--red)', Draft: 'var(--gray)', 'Bad debt': 'var(--purple)', Void: 'var(--gray)' };
const bulk = async (page, what) => { const recs = (data.invoices || []).filter(r => IS.sel && IS.sel.has(r.id)); if (!recs.length) return ui.toast('Select at least one invoice', 'info.circle');
  const finish = msg => { IS.sel = null; WD.changed(); page.refresh(); ui.toast(msg, 'checkmark', 2800); };
  if (what === 'send') { if (await ui.run('Sending ' + plural(recs.length, 'invoice') + '…', () => recs.forEach(r => { r.lastSent = +WD.now(); if (r.status === 'Draft') { r.status = 'Sent'; const j = r.jobId && q.job(r.jobId); if (j && j.invoice && j.invoice.status === 'Draft') j.invoice.status = 'Sent'; } }), { done: 'Sent' })) finish(plural(recs.length, 'invoice') + ' emailed, each with its PDF and the portal button'); }
  else if (what === 'remind') { const due = recs.filter(isOpen); if (!due.length) return ui.toast('None of the selected invoices is unpaid', 'info.circle'); if (await ui.run('Sending ' + plural(due.length, 'reminder') + '…', () => due.forEach(r => { r.lastSent = +WD.now(); r.reminders = (r.reminders || 0) + 1; }), { done: 'Sent' })) finish(plural(due.length, 'reminder') + ' sent' + (due.length < recs.length ? ' · ' + (recs.length - due.length) + ' already paid or draft, skipped' : '')); }
  else if (what === 'paid') { const due = recs.filter(isOpen); if (!due.length) return ui.toast('None of the selected invoices is unpaid', 'info.circle');
    const m = await ui.actionSheet({ title: 'Mark ' + plural(due.length, 'invoice') + ' paid', message: money(due.reduce((s, r) => s + r.amount, 0)) + ' · how were they paid?', buttons: ['Check', 'Card', 'Cash', 'ACH', 'Other'].map(x => ({ label: x, value: x })) }); if (!m) return;
    if (await ui.run('Recording payments…', () => due.forEach(r => settle(r, m)), { done: 'Marked paid' })) finish(plural(due.length, 'invoice') + ' marked paid · ' + m); }
  else if (await ui.run('Preparing ' + plural(recs.length, 'PDF') + '…', null, { done: 'Ready', min: 900, max: 1500 })) finish('Invoices-' + today() + '.zip · ' + plural(recs.length, 'PDF') + ' saved to Files');
};
M.inv = {
  filtered: () => !!(IS.tile || IS.age), selecting: () => !!IS.sel, sortLabel: () => (SORTS[IS.sort] || [COLS.find(c => c[0] === IS.sort)[1] + (IS.asc ? ' · ascending' : ' · descending')])[0],
  toggle: r => { if (!IS.sel) IS.sel = new Set(); IS.sel.has(r.id) ? IS.sel.delete(r.id) : IS.sel.add(r.id); },
  check: r => check(!!IS.sel && IS.sel.has(r.id), () => { M.inv.toggle(r); WD.changed(); }, 'Select ' + r.number),
  filter: list => { let out = list; if (IS.tile && TILES[IS.tile]) out = out.filter(TILES[IS.tile]); if (IS.age) { const a = AGES.find(x => x[0] === IS.age); out = out.filter(r => isOpen(r) && a[3](pastDue(r))); } return out; },
  sort: list => { const s = SORTS[IS.sort], col = !s && COLS.find(c => c[0] === IS.sort), key = s ? s[1] : col ? col[2] : (r => r.at), asc = s ? s[2] : IS.asc; if (IS.sort === 'new') return list;
    return list.slice().sort((a, b) => { const x = key(a), y = key(b), n = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true }); return (asc ? n : -n) || b.at - a.at; }); },
  /** Tiles, the aging bar, sort and select. base: the list before a tile or aging segment narrowed it. */
  head: (page, base, list) => { const re = () => page.refresh(), sum = f => base.filter(f).reduce((s, r) => s + r.amount, 0), cnt = f => base.filter(f).length, open = base.filter(isOpen), tot = open.reduce((s, r) => s + r.amount, 0) || 1;
    const tile = (id, label, value, sub) => h('button.iv-tile' + (IS.tile === id ? '.on' : ''), { 'aria-pressed': IS.tile === id ? 'true' : 'false', onclick: () => { IS.tile = IS.tile === id ? null : id; IS.age = null; re(); } }, h('small', label), h('b', value), sub ? h('i', sub) : null);
    const sel = IS.sel, shown = list.map(r => r.id), allOn = sel && shown.length > 0 && shown.every(id => sel.has(id));
    return h('div', h('div.iv-tiles', tile('out', 'Outstanding', fmt.money(Math.round(sum(TILES.out))), plural(cnt(TILES.out), 'invoice')), tile('over', 'Overdue', fmt.money(Math.round(sum(TILES.over))), plural(cnt(TILES.over), 'invoice')), tile('week', 'Due this week', fmt.money(Math.round(sum(TILES.week))), plural(cnt(TILES.week), 'invoice')),
        tile('paid', 'Paid this month', fmt.money(Math.round(sum(TILES.paid))), plural(cnt(TILES.paid), 'invoice')), tile('draft', 'Drafts', String(cnt(TILES.draft)), 'not sent yet'), tile('auto', 'Autopay scheduled', fmt.money(Math.round(sum(TILES.auto))), plural(cnt(TILES.auto), 'invoice'))),
      open.length > 0 && h('div.iv-age', { role: 'group', 'aria-label': 'Open invoices by days past due' }, h('div.bar', AGES.map(([id, label, color, f]) => { const amt = open.filter(r => f(pastDue(r))).reduce((s, r) => s + r.amount, 0);
        return h('button' + (IS.age === id ? '.on' : ''), { style: { flex: Math.max(amt / tot, 0.08) + ' 1 0', '--c': color }, 'aria-pressed': IS.age === id ? 'true' : 'false', 'aria-label': label + ' days past due: ' + fmt.money(Math.round(amt)), title: label + ' · ' + fmt.money(Math.round(amt)), onclick: () => { IS.age = IS.age === id ? null : id; IS.tile = null; re(); } }, h('small', label + ' · ' + fmt.money(Math.round(amt))), h('span')); }))),
      h('div.iv-ctl', (b => { b.onclick = () => ui.menu(b, [{ header: 'Sort by' }, ...Object.entries(SORTS).map(([k, v]) => ({ label: v[0], checked: IS.sort === k, onTap: () => { IS.sort = k; re(); } }))], { compact: true }); return b; })(h('button.iv-pill', { 'aria-label': 'Sort' }, M.inv.sortLabel(), icon('chevron.up.chevron.down', 13))),
        (IS.tile || IS.age) && h('button.iv-pill.on', { onclick: () => { IS.tile = IS.age = null; re(); } }, 'Clear filter', icon('xmark.circle.fill', 15)), h('span.sp'),
        h('button.iv-pill' + (sel ? '.on' : ''), { onclick: () => { IS.sel = sel ? null : new Set(); re(); } }, sel ? 'Done' : 'Select')),
      sel && h('div.iv-bulk', h('b', sel.size + ' selected'), h('button.iv-pill', { onclick: () => { if (allOn) shown.forEach(id => sel.delete(id)); else shown.forEach(id => sel.add(id)); re(); } }, allOn ? 'Select none' : 'Select all ' + shown.length),
        [['send', 'Send'], ['remind', 'Send reminders'], ['paid', 'Mark paid'], ['pdf', 'Download PDFs']].map(([k, label]) => h('button.iv-pill', { disabled: !sel.size, onclick: () => bulk(page, k) }, label)))); },
  /** The desktop website's table: sortable columns, a tick box on every row. */
  table: (page, list, IV, open) => { const re = () => page.refresh(), sel = IS.sel, rows = list.slice(0, IV.limit), allOn = sel && rows.length > 0 && rows.every(r => sel.has(r.id));
    const th = ([id, label, , cls]) => h('th' + (cls ? '.' + cls : '') + (IS.sort === id ? '.on' : ''), { 'aria-sort': IS.sort === id ? (IS.asc ? 'ascending' : 'descending') : 'none' }, h('button', { onclick: () => { if (IS.sort === id) IS.asc = !IS.asc; else { IS.sort = id; IS.asc = id === 'customer' || id === 'number' || id === 'due'; } re(); } }, label, IS.sort === id ? (IS.asc ? ' ↑' : ' ↓') : ''));
    return h('div', h('div.iv-tablewrap', h('table.iv-table', h('thead', h('tr', h('th.k', check(!!allOn, () => { if (!IS.sel) IS.sel = new Set(); if (allOn) rows.forEach(r => IS.sel.delete(r.id)); else rows.forEach(r => IS.sel.add(r.id)); re(); }, 'Select every invoice shown')), COLS.map(th))),
      h('tbody', rows.map(r => { const c = q.customer(r.customerId), st = statusOf(r), op = isOpen(r), ls = lastSent(r), au = c && autoMethod(c);
        return h('tr', { onclick: () => open(r) }, h('td.k', check(!!sel && sel.has(r.id), () => { M.inv.toggle(r); re(); }, 'Select ' + r.number)), h('td', r.number), h('td.c', c ? c.name : '—'), h('td', mdy(r.day)), h('td', { style: op && pastDue(r) > 0 ? 'color:var(--red);font-weight:600' : null }, mdy(dueOf(r))), h('td.r', money(r.amount)), h('td.r', op ? h('b', money(r.amount)) : money(0)),
          h('td', ui.badge(st, IC[st] || 'var(--orange)')), h('td', ls ? stampDay(ls) + (r.reminders ? ' · ' + plural(r.reminders, 'reminder') : '') : '—'), h('td', au ? (autopayCovers(c, r.amount) ? methodLabel(au) : 'Over limit') : '—')); })))),
      list.length > IV.limit && h('div', { style: 'padding:0 16px 16px' }, ui.button('Show more · ' + (list.length - IV.limit) + ' left', { kind: 'gray', onTap: () => { IV.limit += 60; re(); } })),
      h('div.section-footer', { style: 'padding:0 20px 16px' }, plural(list.length, 'invoice') + ' · ' + money(list.filter(isOpen).reduce((s, r) => s + r.amount, 0)) + ' open. Click a column heading to sort; click a row to open the invoice.')); } };

/* ================= Forms and documents: the document designer ================= */
/* data.forms.layouts: [{id, type, name, def, forTypes: [customer type ids], blocks: [{id, on}] (in print order), cols: [{id, on, label}],
   labels: {title, number, date, due, …}, fields: [{id, label, type, source, from, place, options}], accent, paper, footer, prefix}].
   Every document type has one default layout; a custom layout can be the one used for a customer type. The preview below is drawn from
   the layout. The real invoice view (billing.js) takes the default invoice layout's title, column headings, totals wording, logo and
   company blocks, accent and footer through WD.money.docLabel / docShows / docAccent / docFooter. */
WD.css(`
.fd-pv { position: sticky; top: 0; z-index: 3; margin: 0 0 12px; padding: 10px; border-radius: 14px; background: var(--fill3); max-height: 46vh; overflow: auto; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
.fd-pv .cap { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: var(--label2); padding: 0 2px 6px; display: flex; justify-content: space-between; gap: 8px; }
.fd-doc { background: #fff; color: #1c1c1e; border-radius: 4px; box-shadow: 0 1px 5px rgba(0,0,0,.18); padding: 18px 16px; font: 12.5px/17px -apple-system, Helvetica, Arial, sans-serif; letter-spacing: 0; --fa: #1F5FBF; }
.fd-doc.a4 { padding: 20px 18px 26px; }
.fd-doc .two { display: flex; gap: 14px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; } .fd-doc .two > * { min-width: 0; flex: 1 1 130px; } .fd-doc .two > *:last-child { text-align: right; }
.fd-doc .blk { margin: 0 0 12px; } .fd-doc .lb { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: #6b6b70; }
.fd-doc .ttl { font-size: 22px; line-height: 26px; font-weight: 700; color: var(--fa); letter-spacing: -.2px; }
.fd-doc .meta { display: grid; grid-template-columns: auto auto; gap: 1px 10px; justify-content: end; margin-top: 4px; } .fd-doc .meta span:nth-child(odd) { color: #6b6b70; text-align: left; }
.fd-doc .bi-logo { zoom: .6; margin: 0; }
.fd-doc table { width: 100%; border-collapse: collapse; } .fd-doc th { text-align: left; font-size: 12px; background: var(--fa); color: #fff; padding: 5px 6px; font-weight: 600; } .fd-doc td { padding: 5px 6px; border-bottom: 1px solid #e5e5ea; vertical-align: top; } .fd-doc th.r, .fd-doc td.r { text-align: right; white-space: nowrap; }
.fd-doc .tot { margin-left: auto; width: min(100%, 230px); } .fd-doc .tot div { display: flex; justify-content: space-between; gap: 12px; padding: 3px 6px; } .fd-doc .tot .due { background: var(--fa); color: #fff; font-weight: 700; border-radius: 3px; margin-top: 3px; }
.fd-doc .sig { border-bottom: 1px solid #1c1c1e; height: 34px; max-width: 230px; } .fd-doc .pay { display: flex; align-items: center; gap: 12px; border: 1px solid #d8d8dc; border-radius: 6px; padding: 8px 10px; }
.fd-doc .pay b { display: inline-block; background: var(--fa); color: #fff; border-radius: 5px; padding: 6px 12px; } .fd-doc .qr { flex: none; width: 54px; height: 54px; display: grid; grid-template-columns: repeat(9, 1fr); gap: 0; background: #fff; } .fd-doc .qr i { background: #1c1c1e; } .fd-doc .qr i.o { background: #fff; }
.fd-doc .ft { border-top: 1px solid #d8d8dc; padding-top: 8px; color: #6b6b70; font-size: 12px; text-align: center; }
.fd-ord { display: flex; align-items: center; gap: 2px; } .fd-ord .row-act { width: 44px; height: 44px; }
.fd-sw { display: flex; gap: 10px; flex-wrap: wrap; padding: 10px 16px; background: var(--cell); } .fd-sw button { width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--cell); box-shadow: 0 0 0 1px var(--sep); cursor: pointer; padding: 0; } .fd-sw button.on { box-shadow: 0 0 0 3px var(--label); }
.fd-colin { width: 130px; flex: none; border: 0; border-radius: 8px; background: var(--fill3); color: var(--label); font: inherit; font-size: 15px; padding: 7px 9px; min-height: 44px; margin-right: 8px; }
.fd-line { display: flex; gap: 6px; align-items: center; padding: 8px 12px 8px 16px; background: var(--cell); border-top: .5px solid var(--sep); } .fd-line input { min-width: 0; border: 0; border-radius: 8px; background: var(--fill3); color: var(--label); font: inherit; font-size: 15px; padding: 7px 8px; min-height: 44px; }
.fd-line input.n { flex: 1; } .fd-line input.q { width: 52px; text-align: right; } .fd-line input.r { width: 78px; text-align: right; } .fd-line button { flex: none; width: 44px; height: 44px; border: 0; background: none; color: var(--red); cursor: pointer; display: grid; place-items: center; }
`);
const DOC_TYPES = [['invoice', 'Invoice', 'INV-'], ['note', 'Service note', 'SN-'], ['statement', 'Statement', 'ST-'], ['estimate', 'Estimate', 'EST-'], ['quote', 'Quote', 'QT-'], ['receipt', 'Receipt', 'RC-'], ['cod', 'Certificate of destruction', 'COD-']];
const BLOCKS = [['logo', 'Logo'], ['company', 'Company information'], ['dates', 'Title, number and dates'], ['billto', 'Bill to'], ['service', 'Service address'], ['po', 'PO number'], ['lines', 'Line-item table'], ['totals', 'Totals'], ['tax', 'Tax'], ['terms', 'Payment terms'], ['notes', 'Notes'], ['signature', 'Signature'], ['pay', 'Pay-online button and QR code'], ['footer', 'Footer']];
const COLDEF = [['item', 'Item'], ['desc', 'Description'], ['rate', 'Unit Cost'], ['qty', 'Quantity'], ['total', 'Line Total']];
const LABELS = [['title', 'Title'], ['number', 'Number'], ['date', 'Date'], ['due', 'Due date'], ['billto', 'Bill to'], ['service', 'Service address'], ['po', 'PO number'], ['subtotal', 'Subtotal'], ['tax', 'Tax'], ['total', 'Total'], ['paid', 'Paid so far'], ['balance', 'Balance'], ['terms', 'Terms'], ['notes', 'Notes'], ['signature', 'Signature'], ['pay', 'Pay button']];
const OFF = { note: ['pay', 'terms', 'tax'], statement: ['service', 'po', 'signature', 'tax'], estimate: ['pay', 'po'], quote: ['pay', 'po'], receipt: ['terms', 'signature', 'pay', 'po'], cod: ['totals', 'tax', 'terms', 'pay', 'po'], invoice: ['pay'] };
const ACCENTS = ['#1F5FBF', '#2F8F2F', '#B4231F', '#7A3FB8', '#B86A00', '#0E7C86', '#3A3A3C'], ACCENT0 = ACCENTS[0];
const FIELD_FROM = { customer: [['po', 'PO number'], ['contract', 'Contract'], ['account', 'Account number'], ['terms', 'Terms'], ['billingEmail', 'Billing email'], ['route', 'Route']], job: [['day', 'Service date'], ['driver', 'Driver'], ['pounds', 'Pounds shredded'], ['route', 'Route']] };
const typeName = t => (DOC_TYPES.find(x => x[0] === t) || DOC_TYPES[0])[1];
const mkLayout = (type, name, def) => ({ id: uid('ly'), type, name, def: !!def, forTypes: [], blocks: BLOCKS.map(([id]) => ({ id, on: !(OFF[type] || []).includes(id) })), cols: COLDEF.map(([id, label]) => ({ id, on: true, label })),
  labels: { title: typeName(type), number: typeName(type).split(' ')[0] + ' Number', date: typeName(type).split(' ')[0] + ' Date', due: type === 'estimate' || type === 'quote' ? 'Valid Until' : 'Due Date', billto: type === 'estimate' || type === 'quote' ? 'Prepared for' : 'Bill to', service: 'Service address', po: 'PO Number', subtotal: 'Subtotal', tax: 'Sales tax', total: 'Total', paid: 'Paid to Date', balance: type === 'receipt' ? 'Amount Paid' : 'Balance Due', terms: 'Terms', notes: 'Notes', signature: type === 'estimate' || type === 'quote' ? 'Accepted by' : 'Customer Signature', pay: 'Pay online' },
  fields: [], accent: ACCENT0, paper: 'letter', footer: '', prefix: (DOC_TYPES.find(x => x[0] === type) || [])[2] || '' });
if (!data.forms) { data.forms = { layouts: DOC_TYPES.map(([t]) => mkLayout(t, 'Standard', true)) };
  const g = mkLayout('invoice', 'Government (tax invoice)', false); g.forTypes = ['government']; g.labels.title = 'Tax invoice'; g.labels.balance = 'Amount Due'; g.accent = '#3A3A3C'; g.footer = 'Remit within the terms of the contract. Questions: accounts receivable.';
  g.fields = [{ id: 'f-contract', label: 'Contract Number', type: 'text', source: 'customer', from: 'contract', place: 'header' }, { id: 'f-dept', label: 'Department', type: 'text', source: 'typed', place: 'header' }]; data.forms.layouts.push(g); }
const layouts = type => data.forms.layouts.filter(l => !type || l.type === type);
const defaultLayout = type => layouts(type).find(l => l.def) || layouts(type)[0] || mkLayout(type, 'Standard', true);
/** The layout a document uses: the one set for the customer's type, otherwise the default. */
function layoutFor(type, c) { return (c && layouts(type).find(l => !l.def && (l.forTypes || []).includes(c.custType))) || defaultLayout(type); }
M.layoutFor = layoutFor;
M.docLabel = (type, key, d) => { const L = defaultLayout(type); if (key.startsWith('col.')) { const col = L.cols.find(x => x.id === key.slice(4)); return (col && col.label) || d; } return L.labels[key] || d; };
M.docShows = (type, block) => { const b = defaultLayout(type).blocks.find(x => x.id === block); return !b || b.on; };
M.docAccent = type => { const a = defaultLayout(DOC_TYPES.some(x => x[0] === type) ? type : 'invoice').accent; return a && a !== ACCENT0 ? a : null; };
M.docFooter = type => defaultLayout(type).footer || '';
const fieldValue = (fld, ctx) => { const c = ctx.customer || {}, v = (ctx.values || {})[fld.id];
  if (v != null && v !== '') return fld.type === 'checkbox' ? (v ? 'Yes' : 'No') : String(v);
  if (fld.source === 'customer') return fld.from === 'route' ? (c.route ? q.routeName(c.route) : '') : String(c[fld.from] || (fld.from === 'account' ? 'A-' + String(c.id || '').replace(/\D/g, '').padStart(4, '0') : fld.from === 'contract' ? 'C-2026-' + String(c.id || '').replace(/\D/g, '').padStart(3, '0') : '') || '');
  if (fld.source === 'job') return { day: mdy(ctx.date || today()), driver: ((data.users || []).find(u => u.role === 'driver') || {}).name || 'Driver', pounds: '186 lb', route: c.route ? q.routeName(c.route) : '' }[fld.from] || '';
  return fld.type === 'checkbox' ? '☐' : fld.type === 'date' ? '__ / __ / ____' : fld.type === 'dropdown' ? ((fld.options || [])[0] || '________') : '________'; };
const qrNode = seed => { let x = 7; for (const ch of String(seed)) x = (x * 33 + ch.charCodeAt(0)) >>> 0; const cells = []; for (let i = 0; i < 81; i++) { const r = Math.floor(i / 9), c = i % 9, eye = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3); x = (x * 1103515245 + 12345) >>> 0; cells.push(h('i' + (eye ? ((r % 6 === 1 && (c % 6 === 1)) ? '' : (r === 1 || c === 1 || r === 7 || c === 7) && !(r % 6 === 1 && c % 6 === 1) ? '.o' : '') : (x >> 16) % 2 ? '.o' : ''))); } return h('div.qr', { role: 'img', 'aria-label': 'QR code to the portal' }, cells); };
/** Draw a document from a layout. ctx: {customer, number, date, due, lines: [{item, desc, qty, rate}], po, notes, paid, address, values}. */
function renderDoc(type, L, ctx) {
  const O = org(), c = ctx.customer || { name: 'Customer' }, lb = k => L.labels[k] || '', on = L.blocks.filter(b => b.on).map(b => b.id), cols = L.cols.filter(x => x.on), hdr = L.fields.filter(f => f.place === 'header'), lineF = L.fields.filter(f => f.place === 'line'), foot = L.fields.filter(f => f.place === 'footer');
  const sub = sumLines(ctx.lines), taxOn = on.includes('tax') && data.tax && data.tax.on && type !== 'cod', tax = taxOn ? r2(sub * (+data.tax.rate || 0) / 100) : 0, tot = sub + tax, isStmt = type === 'statement', paidAmt = isStmt ? ctx.lines.filter(l => l.paid).reduce((s, l) => s + l.rate, 0) : ctx.paid ? tot : 0;
  const cell = (col, l) => col.id === 'item' ? l.item : col.id === 'desc' ? l.desc : col.id === 'rate' ? money(l.rate) : col.id === 'qty' ? String(l.qty) : money(l.qty * l.rate);
  const B = {
    logo: () => (WD.screens.billing && WD.screens.billing.logo) ? WD.screens.billing.logo() : h('b', { style: 'font-size:18px' }, O.name),
    company: () => h('div', h('b', O.name), (O.remit || []).slice(1).map(x => h('div', x)), O.phone && h('div', O.phone), O.email && h('div', O.email)),
    dates: () => h('div', h('div.ttl', lb('title')), h('div.meta', [[lb('number'), ctx.number], [lb('date'), mdy(ctx.date)], ctx.due && [lb('due'), mdy(ctx.due)]].concat(hdr.map(f => [f.label, fieldValue(f, ctx)])).filter(Boolean).map(([k, v]) => [h('span', k), h('span', v || '—')]))),
    billto: () => h('div', h('div.lb', lb('billto')), h('b', c.name), c.attn && h('div', 'Attn: ' + c.attn), (c.billAddress || String(ctx.address || '').split(',').map(x => x.trim()).filter(Boolean)).map(x => h('div', x))),
    service: () => h('div', h('div.lb', lb('service')), h('div', ctx.address || '—')),
    po: () => h('div', h('span.lb', lb('po') + ': '), ctx.po || '—'),
    lines: () => h('table', h('thead', h('tr', cols.map(col => h('th' + (['rate', 'qty', 'total'].includes(col.id) ? '.r' : ''), col.label)), lineF.map(f => h('th', f.label)))),
      h('tbody', ctx.lines.length ? ctx.lines.map(l => h('tr', cols.map(col => h('td' + (['rate', 'qty', 'total'].includes(col.id) ? '.r' : ''), cell(col, l))), lineF.map(f => h('td', fieldValue(f, ctx))))) : h('tr', h('td', { colspan: cols.length + lineF.length || 1, style: 'color:#6b6b70' }, 'No lines yet')))),
    totals: () => h('div.tot', taxOn && h('div', h('span', lb('subtotal')), h('span', money(sub))), taxOn && h('div', h('span', lb('tax')), h('span', money(tax))), h('div', h('span', lb('total')), h('span', money(tot))),
      !['estimate', 'quote'].includes(type) && h('div', h('span', lb('paid')), h('span', money(paidAmt))), h('div.due', h('span', ['estimate', 'quote'].includes(type) ? lb('total') : lb('balance')), h('span', money(type === 'receipt' ? paidAmt || tot : ['estimate', 'quote'].includes(type) ? tot : tot - paidAmt)))),
    tax: () => on.includes('totals') || !taxOn ? null : h('div', h('span.lb', lb('tax') + ': '), money(tax)),
    terms: () => h('div', h('span.lb', lb('terms') + ': '), (c.terms || (TERMS.find(t => t[0] === IVC().terms) || [])[1] || 'Net 30') + (IVC().late.on && type === 'invoice' ? ' · A late fee of ' + IVC().late.pct + '% a month applies after the due date.' : '')),
    notes: () => h('div', h('div.lb', lb('notes')), h('div', ctx.notes || (type === 'cod' ? 'The material listed above was destroyed and recycled in the normal course of business.' : 'Thank you for your business.')), foot.map(f => h('div', h('b', f.label + ': '), fieldValue(f, ctx)))),
    signature: () => h('div', h('div.sig'), h('div.lb', { style: 'margin-top:3px' }, lb('signature') + (ctx.signer ? ' · ' + ctx.signer : ''))),
    pay: () => h('div.pay', qrNode(ctx.number), h('div', h('b', lb('pay')), h('div', { style: 'margin-top:4px;color:#6b6b70' }, 'portal.' + String(O.website || 'company.example') + ' · scan or tap to pay by card or bank account'))),
    footer: () => h('div.ft', L.footer || [O.name, O.phone, O.website].filter(Boolean).join(' · ')) };
  const PAIR = { logo: 'company', company: 'logo', billto: 'service', service: 'billto', dates: 'billto' }, out = [];
  for (let i = 0; i < on.length; i++) { const a = on[i], b = on[i + 1], na = B[a] && B[a]();
    if (b && (PAIR[a] === b || PAIR[b] === a) && B[b]) { out.push(h('div.blk.two', na, B[b]())); i++; } else if (na) out.push(h('div.blk', na)); }
  return h('div.fd-doc' + (L.paper === 'a4' ? '.a4' : ''), { style: { '--fa': L.accent || ACCENT0 } }, out);
}
M.renderDoc = renderDoc;
const sampleCtx = type => { const c = portalDemo() || { name: 'Sample customer', locations: [{}] }, P = PX(), items = P ? (P.loc(c).items || []).filter(i => i.qty > 0) : [], L = defaultLayout(type);
  const lines = type === 'statement' ? (data.invoices || []).filter(i => i.customerId === c.id).slice(0, 4).map(i => ({ item: i.number, desc: mdy(i.day) + ' · ' + statusOf(i), qty: 1, rate: i.amount, paid: i.status === 'Paid' }))
    : items.length ? items.map(i => ({ item: P.pb(i.id).name, desc: 'On-site shredding · ' + c.freq, qty: i.qty, rate: i.rate })) : [{ item: 'Console', desc: 'On-site shredding', qty: 2, rate: 45 }];
  return { customer: c, number: (L.prefix || '') + '10482', date: today(), due: type === 'cod' || type === 'receipt' || type === 'note' ? null : D.add(today(), 30), lines, po: c.po || 'PO-4471', notes: '', paid: type === 'receipt', address: (c.locations[0] || {}).address || '', values: {} }; };
function fieldSheet(L, fld, done) { const isNew = !fld, f = fld ? { ...fld, options: (fld.options || []).join(', ') } : { id: uid('f'), label: '', type: 'text', source: 'typed', from: '', place: 'header', options: '' };
  ui.sheet({ title: isNew ? 'New custom field' : 'Custom field', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.label.trim()) return ui.toast('Give the field a name', 'pencil');
      const out = { id: f.id, label: f.label.trim(), type: f.type, source: f.source, from: f.source === 'typed' ? '' : f.from || FIELD_FROM[f.source][0][0], place: f.place, options: f.type === 'dropdown' ? f.options.split(',').map(x => x.trim()).filter(Boolean) : [] };
      if (isNew) L.fields.push(out); else Object.assign(fld, out); WD.changed(); p.dismiss(); done && done(); } }],
    render: p => ui.list(ui.section({ fold: false }, ui.inputRow({ label: 'Name', required: true, placeholder: 'e.g. Department, Cost center', value: f.label, autofocus: isNew, onInput: v => { f.label = v; } }),
        ui.pickerRow({ title: 'Kind', value: f.type, options: [['text', 'Text'], ['number', 'Number'], ['date', 'Date'], ['checkbox', 'Checkbox'], ['dropdown', 'Dropdown']].map(([value, label]) => ({ value, label })), onChange: v => { f.type = v; p.refresh(); } }),
        f.type === 'dropdown' && ui.inputRow({ label: 'Choices', placeholder: 'Separate with commas', value: f.options, onInput: v => { f.options = v; } })),
      ui.section({ header: 'Where the value comes from', fold: false, showFooter: true, footer: f.source === 'typed' ? 'Whoever creates the document fills it in.' : 'Filled in for you from the ' + f.source + ' record.' },
        ui.pickerRow({ title: 'Source', value: f.source, options: [{ value: 'typed', label: 'Typed on the document' }, { value: 'customer', label: 'From the customer' }, { value: 'job', label: 'From the job' }], onChange: v => { f.source = v; f.from = v === 'typed' ? '' : FIELD_FROM[v][0][0]; p.refresh(); } }),
        f.source !== 'typed' && ui.pickerRow({ title: 'Which field', value: f.from || FIELD_FROM[f.source][0][0], options: FIELD_FROM[f.source].map(([value, label]) => ({ value, label })), onChange: v => { f.from = v; p.refresh(); } })),
      ui.section({ header: 'Where it prints', fold: false }, ui.pickerRow({ title: 'Place', value: f.place, options: [{ value: 'header', label: 'In the header, with the number and dates' }, { value: 'line', label: 'In the line area, as a column' }, { value: 'footer', label: 'Under the notes' }], onChange: v => { f.place = v; p.refresh(); } })),
      !isNew && ui.section(null, ui.row({ title: 'Delete this field', destructive: true, center: true, onTap: () => { L.fields.splice(L.fields.indexOf(fld), 1); WD.changed(); p.dismiss(); done && done(); } }))) }, { detent: 'large' });
}
const layoutSpec = L => ({ title: typeName(L.type) + ' layout', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); }, ctx = sampleCtx(L.type);
  const paper = h('div'), draw = () => paper.replaceChildren(renderDoc(L.type, L, ctx)); draw();
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= L.blocks.length) return; const x = L.blocks.splice(i, 1)[0]; L.blocks.splice(j, 0, x); re(); };
  const others = layouts(L.type).filter(x => x !== L);
  return h('div', h('div.fd-pv', h('div.cap', h('span', 'Live preview'), h('span', (L.paper === 'a4' ? 'A4' : 'Letter') + ' · sample data')), paper),
    ui.list(
      ui.section({ header: 'Layout', fold: false, showFooter: true, footer: L.def ? 'The default ' + typeName(L.type).toLowerCase() + ' layout: used for every customer without a layout of their own.' : 'Used instead of the default for the customer types switched on here.' },
        ui.inputRow({ label: 'Name', value: L.name, onInput: v => { L.name = v || 'Layout'; } }),
        !L.def && WD.custTypes.map(t => ui.toggleRow({ title: 'Use for ' + t.title.toLowerCase() + ' customers', value: (L.forTypes || []).includes(t.id), onChange: v => { others.forEach(o => { o.forTypes = (o.forTypes || []).filter(x => x !== t.id); }); L.forTypes = (L.forTypes || []).filter(x => x !== t.id).concat(v ? [t.id] : []); re(); } })),
        !L.def && ui.row({ title: 'Make this the default', tint: true, onTap: () => { layouts(L.type).forEach(x => { x.def = x === L; }); L.forTypes = []; re(); ui.toast('Now the default ' + typeName(L.type).toLowerCase() + ' layout', 'checkmark'); } })),
      ui.section({ header: 'Blocks · show, hide and reorder', fold: false, showFooter: true, footer: 'Blocks print from top to bottom in this order. Logo and company information sit side by side when they are next to each other; so do Bill to and Service address.' },
        L.blocks.map((b, i) => ui.row({ title: (BLOCKS.find(x => x[0] === b.id) || [])[1] || b.id, trailing: h('div.fd-ord', ui.iconBtn('arrow.up', 'Move up', () => move(i, -1)), ui.iconBtn('arrow.down', 'Move down', () => move(i, 1)), ui.toggle(b.on, v => { b.on = v; re(); })) }))),
      L.blocks.some(b => b.id === 'lines' && b.on) && ui.section({ header: 'Line-item columns', fold: false, showFooter: true, footer: 'Switch a column off to hide it, and type over a heading to rename it.' },
        L.cols.map(col => h('div.row', h('div.row-main', h('div.row-title', (COLDEF.find(x => x[0] === col.id) || [])[1])), h('input.fd-colin', { type: 'text', 'aria-label': 'Heading for ' + col.id, value: col.label, oninput: e => { col.label = e.target.value; draw(); } }), ui.toggle(col.on, v => { col.on = v; re(); })))),
      ui.section({ header: 'Wording', fold: true, folded: false, showFooter: true, footer: 'Rename anything printed on the document: “Invoice” to “Tax invoice”, “Balance Due” to “Amount Due”.' },
        LABELS.map(([k, name]) => ui.inputRow({ label: name, value: L.labels[k] || '', onInput: v => { L.labels[k] = v; draw(); } }))),
      ui.section({ header: 'Custom fields' + (L.fields.length ? ' · ' + L.fields.length : ''), fold: false, showFooter: true, footer: 'Your own fields: text, number, date, checkbox or dropdown. Typed on the document, or filled in from the customer or the job.' },
        L.fields.map(f => ui.row({ icon: 'square.and.pencil', iconColor: 'var(--blue)', title: f.label, subtitle: ({ text: 'Text', number: 'Number', date: 'Date', checkbox: 'Checkbox', dropdown: 'Dropdown' })[f.type] + ' · ' + (f.source === 'typed' ? 'typed on the document' : 'from the ' + f.source) + ' · ' + ({ header: 'header', line: 'line column', footer: 'under the notes' })[f.place], chevron: true, onTap: () => fieldSheet(L, f, re) })),
        ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a custom field', tint: true, onTap: () => fieldSheet(L, null, re) })),
      ui.section({ header: 'Look and numbering', fold: false },
        h('div.fd-sw', { role: 'group', 'aria-label': 'Accent color' }, ACCENTS.map(a => h('button' + (L.accent === a ? '.on' : ''), { style: { background: a }, 'aria-label': 'Accent color ' + a, 'aria-pressed': L.accent === a ? 'true' : 'false', onclick: () => { L.accent = a; re(); } }))),
        ui.pickerRow({ title: 'Paper size', value: L.paper, options: [{ value: 'letter', label: 'Letter (8.5 × 11 in)' }, { value: 'a4', label: 'A4 (210 × 297 mm)' }], onChange: v => { L.paper = v; re(); } }),
        ui.inputRow({ label: 'Footer text', placeholder: 'Company name, phone and website', value: L.footer, onInput: v => { L.footer = v; draw(); } }),
        ui.inputRow({ label: 'Number prefix', value: L.prefix, caps: 'characters', onInput: v => { L.prefix = v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8); ctx.number = L.prefix + '10482'; draw(); } })),
      ui.section(null, ui.row({ icon: 'doc', iconPlain: true, title: 'Duplicate this layout', tint: true, onTap: () => { const n = JSON.parse(JSON.stringify(L)); Object.assign(n, { id: uid('ly'), name: L.name + ' copy', def: false, forTypes: [] }); n.fields.forEach(f => { f.id = uid('f'); }); data.forms.layouts.push(n); WD.changed(); page.pop(); setTimeout(() => WD.nav.push(layoutSpec(n)), 380); ui.toast('Copied. Editing the copy.', 'checkmark'); } }),
        L.def ? ui.row({ title: 'Reset to the standard layout', destructive: true, onTap: async () => { if (!await ui.actionSheet({ title: 'Reset this layout?', message: 'Blocks, wording, columns, custom fields and colors go back to the standard.', buttons: [{ label: 'Reset', value: true, role: 'destructive' }] })) return; const n = mkLayout(L.type, 'Standard', true); n.id = L.id; Object.keys(L).forEach(k => delete L[k]); Object.assign(L, n); re(); } })
          : ui.row({ title: 'Delete this layout', destructive: true, onTap: async () => { if (!await ui.actionSheet({ title: 'Delete “' + L.name + '”?', message: 'Documents that used it go back to the default layout.', buttons: [{ label: 'Delete layout', value: true, role: 'destructive' }] })) return; data.forms.layouts.splice(data.forms.layouts.indexOf(L), 1); WD.changed(); page.pop(); } }))));
} });
M.formsSpec = () => ({ title: 'Forms and documents', render: page => { if (!admin()) return locked(); const es = (data.estimates || []).slice().sort((a, b) => b.at - a.at);
  return ui.list(note('Design what your documents look like and say. Each kind has a default layout; add your own and use it for a customer type.'),
    DOC_TYPES.map(([t, name]) => ui.section({ header: name, fold: false }, layouts(t).sort((a, b) => (b.def ? 1 : 0) - (a.def ? 1 : 0)).map(L => ui.row({ icon: 'doc.text', iconColor: L.accent || ACCENT0, title: L.name, subtitle: [plural(L.blocks.filter(b => b.on).length, 'block'), L.fields.length ? plural(L.fields.length, 'custom field') : null, L.labels.title !== name ? 'titled “' + L.labels.title + '”' : null].filter(Boolean).join(' · '),
        badge: L.def ? ui.badge('Default', 'var(--green)') : (L.forTypes || []).length ? ui.badge(L.forTypes.map(id => WD.custType(id).title).join(', '), 'var(--indigo)') : ui.badge('Not in use', 'var(--gray)'), chevron: true, onTap: () => page.push(layoutSpec(L)) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New ' + name.toLowerCase() + ' layout', tint: true, onTap: () => { const n = JSON.parse(JSON.stringify(defaultLayout(t))); Object.assign(n, { id: uid('ly'), name: 'Custom', def: false, forTypes: [] }); data.forms.layouts.push(n); WD.changed(); page.push(layoutSpec(n)); } }))),
    ui.section({ header: 'Estimates and quotes', fold: false, showFooter: true, footer: 'Made from the Estimate and Quote layouts above, sent with the same email, and accepted by the customer in the portal.' },
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New estimate…', tint: true, onTap: () => M.newEstimate('estimate') }), ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New quote…', tint: true, onTap: () => M.newEstimate('quote') }),
      es.map(e => estRow(e, page))));
} });
/* ---------- Estimates and quotes ---------- */
const EST_BADGE = { draft: ['Draft', 'var(--gray)'], sent: ['Sent', 'var(--blue)'], accepted: ['Accepted', 'var(--green)'] };
if (!data.estimates) { data.estimates = []; (c => { if (!c) return; const P = PX(), pb = id => (P ? P.pb(id) : { name: id, rate: 0 });
  data.estimates.push({ id: 'es1', kind: 'estimate', number: 'EST-1001', customerId: c.id, day: D.add(today(), -4), validUntil: D.add(today(), 26), lines: [{ name: 'One-time purge', desc: '40 standard boxes, shredded on site', qty: 40, rate: pb('box').rate || 6 }, { name: 'Stairs', desc: 'Carried down one floor', qty: 40, rate: 1 }], notes: 'Price holds for 30 days.', status: 'sent', at: +WD.now() - 4 * 864e5, lastSent: +WD.now() - 4 * 864e5 },
    { id: 'es2', kind: 'quote', number: 'QT-1001', customerId: c.id, day: D.add(today(), -9), validUntil: D.add(today(), 21), lines: [{ name: pb('bin64').name || '64-gallon bin', desc: 'Two more bins, serviced on your usual schedule', qty: 2, rate: pb('bin64').rate || 55 }], notes: '', status: 'sent', at: +WD.now() - 9 * 864e5, lastSent: +WD.now() - 9 * 864e5 }); })(portalDemo()); }
const estRow = (e, page) => { const c = q.customer(e.customerId), b = EST_BADGE[e.status] || EST_BADGE.draft; return ui.row({ icon: 'doc.text', iconColor: 'var(--teal)', title: (c ? c.name : 'Customer') + ' · ' + e.number, subtitle: KIND[e.kind].name + ' · ' + mdy(e.day) + (e.validUntil ? ' · valid until ' + mdy(e.validUntil) : ''), badge: ui.badge(b[0], b[1]), detail: money(sumLines(e.lines)), chevron: true, onTap: () => page.push(M.estimateSpec(e)) }); };
M.estimateSpec = e => ({ title: e.number, render: page => { const c = q.customer(e.customerId), re = () => { WD.changed(); page.refresh(); }, K = KIND[e.kind], can = WD.can('billing.manage') || WD.can('billing.field') || admin();
  return h('div', h('div.mny-paperwrap', renderDoc(e.kind, layoutFor(e.kind, c), ctxFor(e.kind, c, e))),
    ui.list(ui.section({ fold: false, showFooter: true, footer: e.status === 'accepted' ? 'Accepted by ' + (e.acceptedBy || 'the customer') + ' on ' + stampDay(e.acceptedAt || +WD.now()) + '.' : e.status === 'sent' ? 'Sent ' + stampDay(e.lastSent || e.at) + ' to ' + (emailOf(c) || 'the customer') + '. They accept it in the portal.' : 'A draft: the customer has not seen it.' },
      can && e.status !== 'accepted' && ui.row({ icon: 'envelope', iconPlain: true, title: e.status === 'sent' ? 'Send again' : 'Send to the customer', subtitle: emailOf(c) || 'No email on file', tint: true, disabled: !emailOf(c), onTap: async () => { if (await ui.run('Sending the ' + K.name.toLowerCase() + '…', () => { e.status = 'sent'; e.lastSent = +WD.now(); }, { done: 'Sent' })) re(); } }),
      ui.row({ icon: 'envelope', iconPlain: true, title: 'Preview the email', subtitle: 'The ' + K.name.toLowerCase() + ' attached as a PDF and a button to the portal', tint: true, chevron: true, onTap: () => M.emailPreview({ kind: e.kind, customer: c, rec: e }) }),
      can && e.status !== 'accepted' && ui.row({ icon: 'pencil', iconPlain: true, title: 'Edit', tint: true, onTap: () => M.newEstimate(e.kind, e.customerId, e, re) }),
      can && e.status === 'sent' && ui.row({ icon: 'checkmark.circle', iconPlain: true, title: 'Mark accepted', subtitle: 'When the customer said yes by phone or email', tint: true, onTap: () => { e.status = 'accepted'; e.acceptedAt = +WD.now(); e.acceptedBy = (c && (c.contacts[0] || {}).name) || 'the customer'; re(); } }),
      e.status === 'accepted' && RC.newInvoice && can && ui.row({ icon: 'doc.text', iconPlain: true, title: 'Create the invoice', tint: true, onTap: () => RC.newInvoice(e.customerId) }),
      can && ui.row({ title: 'Delete', destructive: true, onTap: async () => { if (!await ui.actionSheet({ title: 'Delete ' + e.number + '?', buttons: [{ label: 'Delete', value: true, role: 'destructive' }] })) return; data.estimates = data.estimates.filter(x => x !== e); WD.changed(); page.pop(); } }))));
} });
/** A simple line editor → preview → send. kind: 'estimate' | 'quote'. */
M.newEstimate = (kind, customerId, edit, done) => { const P = PX(), cs = data.customers.filter(c => !c.hidden).sort((a, b) => a.name.localeCompare(b.name)), L0 = defaultLayout(kind);
  const f = edit ? { customerId: edit.customerId, lines: edit.lines.map(l => ({ ...l })), notes: edit.notes || '', valid: Math.max(1, D.diff(edit.validUntil || D.add(today(), 30), edit.day)) } : { customerId: customerId || (portalDemo() || cs[0] || {}).id, lines: [{ name: '', desc: '', qty: 1, rate: 0 }], notes: '', valid: 30 };
  ui.sheet({ title: (edit ? 'Edit ' : 'New ') + KIND[kind].name.toLowerCase(), leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: edit ? 'Save' : 'Preview', bold: true, onTap: p => { const lines = f.lines.filter(l => l.name.trim() && (+l.qty || 0) > 0).map(l => ({ name: l.name.trim(), desc: l.desc || '', qty: +l.qty || 0, rate: num(l.rate) }));
      if (!f.customerId) return ui.toast('Choose a customer', 'person'); if (!lines.length) return ui.toast('Add at least one line with a name and a quantity', 'pencil', 2800);
      let e = edit; if (e) Object.assign(e, { customerId: f.customerId, lines, notes: f.notes.trim(), validUntil: D.add(e.day, f.valid) });
      else { const n = 1001 + data.estimates.filter(x => x.kind === kind).length; e = { id: uid('es'), kind, number: (L0.prefix || '') + n, customerId: f.customerId, day: today(), validUntil: D.add(today(), f.valid), lines, notes: f.notes.trim(), status: 'draft', at: +WD.now() }; data.estimates.push(e); }
      WD.changed(); p.dismiss(); if (edit) done && done(); else setTimeout(() => WD.nav.push(M.estimateSpec(e)), 380); } }],
    render: p => { const tot = f.lines.reduce((s, l) => s + (+l.qty || 0) * num(l.rate), 0), totEl = h('b', { style: 'color:var(--label)' }, money(tot)), upd = () => { totEl.textContent = money(f.lines.reduce((s, l) => s + (+l.qty || 0) * num(l.rate), 0)); };
      return ui.list(
        ui.section({ fold: false }, ui.pickerRow({ title: 'Customer', value: f.customerId, options: cs.map(c => ({ value: c.id, label: c.name })), onChange: v => { f.customerId = v; p.refresh(); } }),
          ui.pickerRow({ title: 'Price holds for', value: f.valid, options: [7, 14, 30, 60, 90].includes(f.valid) ? [7, 14, 30, 60, 90].map(n => ({ value: n, label: n + ' days' })) : [f.valid, 7, 14, 30, 60, 90].map(n => ({ value: n, label: n + ' days' })), onChange: v => { f.valid = v; p.refresh(); } })),
        h('div.section', h('div.section-header', 'Lines'), h('div', { style: 'border-radius:12px;overflow:hidden' }, f.lines.map((l, i) => h('div.fd-line', h('input.n', { type: 'text', placeholder: 'Item or service', 'aria-label': 'Line ' + (i + 1) + ' name', value: l.name, oninput: e => { l.name = e.target.value; } }),
            h('input.q', { type: 'text', inputmode: 'numeric', 'aria-label': 'Line ' + (i + 1) + ' quantity', value: String(l.qty), oninput: e => { l.qty = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0; upd(); } }),
            h('input.r', { type: 'text', inputmode: 'decimal', 'aria-label': 'Line ' + (i + 1) + ' price each', value: l.rate ? String(l.rate) : '', placeholder: '0.00', oninput: e => { l.rate = e.target.value; upd(); } }),
            h('button', { 'aria-label': 'Remove line ' + (i + 1), onclick: () => { f.lines.splice(i, 1); if (!f.lines.length) f.lines.push({ name: '', desc: '', qty: 1, rate: 0 }); p.refresh(); } }, icon('minus.circle.fill', 22)))),
            (add => { add.onclick = () => ui.menu(add, [{ label: 'Blank line', icon: 'plus', onTap: () => { f.lines.push({ name: '', desc: '', qty: 1, rate: 0 }); p.refresh(); } }, { header: 'From your items' }, ...(data.priceBook || []).slice(0, 10).map(x => ({ label: x.name + ' · ' + money(x.rate), onTap: () => { const blank = f.lines.findIndex(l => !l.name.trim()); const row = { name: x.name, desc: '', qty: 1, rate: x.rate }; if (blank >= 0) f.lines[blank] = row; else f.lines.push(row); p.refresh(); } }))], { compact: true }); return add; })(h('div.row.tappable', { role: 'button' }, h('div.row-main', h('div.row-title', { style: 'color:var(--tint)' }, 'Add a line')))),
            h('div.row', h('div.row-main', h('div.row-title', 'Total')), totEl)),
          h('div.section-footer', 'Name, quantity and price each. Tax is added from your tax settings.')),
        ui.section({ fold: false }, ui.inputRow({ multiline: true, placeholder: 'Notes for the customer (optional)', value: f.notes, onInput: v => { f.notes = v; } }))); } }, { detent: 'large' });
  void P;
};

/* ================= Import: files, a previous service, AI evaluation ================= */
WD.css(`
.im-drop { display: block; border: 2px dashed var(--sep); border-radius: 14px; padding: 18px 14px; text-align: center; background: var(--cell); color: var(--label2); font-size: 14px; line-height: 19px; cursor: pointer; } .im-drop.over { border-color: var(--tint); background: color-mix(in srgb, var(--tint) 8%, var(--cell)); }
.im-drop b { display: block; color: var(--tint); font-size: 16px; margin: 6px 0 2px; }
.im-files { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 0 0; } .im-file { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 0 0 12px; border-radius: 22px; background: var(--fill3); font-size: 14px; max-width: 100%; } .im-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.im-file button { width: 44px; height: 44px; border: 0; background: none; color: var(--label2); cursor: pointer; display: grid; place-items: center; flex: none; }
.im-sample { overflow-x: auto; background: var(--cell); } .im-sample table { border-collapse: collapse; font-size: 13px; white-space: nowrap; } .im-sample th { text-align: left; color: var(--label2); font-size: 12px; padding: 7px 10px; border-bottom: .5px solid var(--sep); } .im-sample td { padding: 7px 10px; border-bottom: .5px solid var(--sep); }
.im-run { padding: 22px 16px; background: var(--cell); border-radius: 14px; margin: 0 0 12px; text-align: center; } .im-run .t { font-size: 17px; font-weight: 600; margin-bottom: 12px; } .im-run .n { font-size: 14px; color: var(--label2); margin-top: 10px; line-height: 20px; }
`);
const FILE_TYPES = [
  { id: 'csv', title: 'CSV file', sub: 'Comma-separated text from any program', accept: '.csv,text/csv', icon: 'list.bullet', color: 'var(--green)', sample: 'Customer route list.csv' },
  { id: 'xlsx', title: 'Excel workbook (.xlsx, .xls)', sub: 'One sheet per kind of record, or one sheet for everything', accept: '.xlsx,.xls', icon: 'columns', color: 'var(--green)', sample: 'Customers and schedule.xlsx' },
  { id: 'ics', title: 'Calendar file (.ics)', sub: 'Outlook, Apple Calendar, Google Calendar and most scheduling programs', accept: '.ics,text/calendar', icon: 'calendar', color: 'var(--red)', sample: 'Shred schedule.ics', what: 'jobs', nomap: true },
  { id: 'qb', title: 'QuickBooks export (IIF or CSV)', sub: 'Customer list, open invoices or the item list', accept: '.iif,.csv', icon: 'dollarsign.circle', color: 'var(--teal)', sample: 'QuickBooks customers.iif', what: 'invoices' },
  { id: 'vcf', title: 'vCard contacts (.vcf)', sub: 'Contacts from a phone, Outlook or Google Contacts', accept: '.vcf,text/vcard', icon: 'person.crop.circle', color: 'var(--blue)', sample: 'Contacts.vcf', what: 'contacts', nomap: true },
  { id: 'json', title: 'RouteClerk backup (JSON)', sub: 'The file from Export and backup: everything, exactly as it was', accept: '.json,.zip', icon: 'cloud', color: 'var(--indigo)', sample: 'routeclerk-export-' + today() + '.json', what: 'all', nomap: true },
  { id: 'pdf', title: 'PDF customer list', sub: 'A printed or scanned list: AI Premium reads it', accept: '.pdf,application/pdf', icon: 'doc', color: 'var(--purple)', sample: 'Customer list (scanned).pdf', what: 'customers', ai: true }];
const CONTENTS = [['customers', 'Customers'], ['contacts', 'Contacts'], ['jobs', 'Jobs and the recurring schedule'], ['routes', 'Routes'], ['invoices', 'Invoices and balances'], ['prices', 'Price list'], ['leads', 'Leads']];
const whatName = w => w === 'all' ? 'Everything in the backup' : (CONTENTS.find(x => x[0] === w) || CONTENTS[0])[1];
const TARGETS = { customers: [['name', 'Customer name'], ['address', 'Service address'], ['city', 'City'], ['phone', 'Phone'], ['email', 'Email'], ['contact', 'Contact name'], ['route', 'Route'], ['freq', 'Service frequency'], ['items', 'Containers'], ['rate', 'Price per visit'], ['po', 'PO number'], ['notes', 'Notes']],
  contacts: [['contact', 'Contact name'], ['name', 'Company'], ['phone', 'Phone'], ['email', 'Email'], ['role', 'Role or title'], ['notes', 'Notes']],
  jobs: [['day', 'Service date'], ['name', 'Customer'], ['address', 'Address'], ['route', 'Route'], ['freq', 'Repeats'], ['items', 'Containers'], ['notes', 'Notes']],
  routes: [['route', 'Route name'], ['driver', 'Driver'], ['truck', 'Truck'], ['days', 'Service days']],
  invoices: [['number', 'Invoice number'], ['name', 'Customer'], ['day', 'Invoice date'], ['due', 'Due date'], ['amount', 'Amount'], ['balance', 'Balance still owed'], ['po', 'PO number']],
  prices: [['item', 'Item or service'], ['rate', 'Price'], ['unit', 'Unit'], ['taxable', 'Taxable']],
  leads: [['name', 'Name or company'], ['contact', 'Contact name'], ['phone', 'Phone'], ['email', 'Email'], ['source', 'Where they came from'], ['notes', 'Notes']] };
const GUESS = [[/cust|company|client|^name|business/i, 'name'], [/contact|attn|first|last/i, 'contact'], [/addr|street|location/i, 'address'], [/city|town/i, 'city'], [/phone|tel|mobile|cell/i, 'phone'], [/e-?mail/i, 'email'], [/route/i, 'route'], [/freq|interval|schedule|repeat|every/i, 'freq'], [/contain|bin|console|qty|quant/i, 'items'], [/balance|owed|open/i, 'balance'], [/amount|total/i, 'amount'], [/rate|price|cost|charge/i, 'rate'],
  [/\bpo\b|purchase/i, 'po'], [/note|comment|memo|instruction/i, 'notes'], [/due/i, 'due'], [/date|day/i, 'day'], [/number|invoice|inv ?#|no\.?$/i, 'number'], [/item|service|product|descr/i, 'item'], [/unit/i, 'unit'], [/tax/i, 'taxable'], [/driver/i, 'driver'], [/truck|vehicle/i, 'truck'], [/source|referr|how/i, 'source'], [/role|title/i, 'role']];
const SAMPLES = { customers: [['Customer Name', 'Harlow & Finch Law', 'Bayside Dental Group', 'Northgate Credit Union'], ['Service Address', '210 Mercer St, Suite 400', '88 Harbor Ln', '1500 Northgate Blvd'], ['City', 'Lakemont', 'Lakemont', 'Lakemont'], ['Phone', '(512) 555-0142', '(512) 555-0177', '(512) 555-0109'], ['Email', 'office@harlowfinch.example', 'front@baysidedental.example', 'ops@northgatecu.example'], ['Route', 'North', 'East', 'North'], ['Schedule', 'By weekly', 'four weeks', 'Weekly'], ['Bins', '4 consoles', '1 console', '6 consoles, 2 bins'], ['Price', '$45.00', '$38.00', '$52.50'], ['Acct Rep', 'Colleen', 'Colleen', 'Dana']],
  contacts: [['Full Name', 'Renee Harlow', 'Tomás Rivera', 'Priya Shah'], ['Company', 'Harlow & Finch Law', 'Bayside Dental Group', 'Northgate Credit Union'], ['Mobile', '(512) 555-0142', '(512) 555-0177', '(512) 555-0109'], ['E-mail', 'renee@harlowfinch.example', 'tomas@baysidedental.example', 'priya@northgatecu.example'], ['Title', 'Office manager', 'Practice manager', 'Branch operations']],
  jobs: [['Date', '11/23/2026', '11/23/2026', '11/24/2026'], ['Customer', 'Harlow & Finch Law', 'Bayside Dental Group', 'Northgate Credit Union'], ['Address', '210 Mercer St, Suite 400', '88 Harbor Ln', '1500 Northgate Blvd'], ['Route', 'North', 'East', 'North'], ['Repeat', 'Every 2 weeks', 'Every 4 weeks', 'Weekly'], ['Notes', 'Check in at reception', '', 'Vault door, ask for Priya']],
  routes: [['Route', 'North', 'East', 'South'], ['Driver', 'Marcus Bell', 'Luis Ortega', 'Sam Whitaker'], ['Vehicle', 'Truck 12', 'Truck 14', 'Truck 7'], ['Days', 'Mon–Fri', 'Mon, Wed, Fri', 'Tue, Thu']],
  invoices: [['Invoice #', '10391', '10402', '10417'], ['Customer', 'Harlow & Finch Law', 'Bayside Dental Group', 'Northgate Credit Union'], ['Invoice Date', '10/12/2026', '10/19/2026', '10/26/2026'], ['Due Date', '11/11/2026', '11/18/2026', '11/25/2026'], ['Total', '$180.00', '$38.00', '$367.50'], ['Open Balance', '$180.00', '$0.00', '$367.50']],
  prices: [['Item', 'Console', '64-gallon bin', 'Standard box (purge)'], ['Price', '$45.00', '$55.00', '$6.00'], ['Unit', 'each', 'each', 'box'], ['Taxable', 'No', 'No', 'No']],
  leads: [['Name', 'Corbin Family Dentistry', 'Mesa Title Co.', 'Dana Kim'], ['Contact', 'Dr. Lee Corbin', 'Olivia Mesa', 'Dana Kim'], ['Phone', '(512) 555-0188', '(512) 555-0121', '(512) 555-0274'], ['Email', 'lee@corbindental.example', 'olivia@mesatitle.example', 'dana.kim@mail.example'], ['Source', 'Google Ads', 'Referral', 'Website form']] };
if (!data.imports) data.imports = { sources: {}, history: [
  { id: 'im2', at: +WD.now() - 12 * 864e5, name: 'Customer route list.xlsx', what: 'customers', added: 27, merged: 61, skipped: 9, by: 'Colleen Abbott' },
  { id: 'im1', at: +WD.now() - 48 * 864e5, name: 'Google Calendar · 4 calendars', what: 'jobs', added: 1284, merged: 212, skipped: 2, by: 'Colleen Abbott' }] };
const IM = () => data.imports;
const guess = (col, what) => { const ok = TARGETS[what] || TARGETS.customers, hit = GUESS.find(([re, t]) => re.test(col) && ok.some(x => x[0] === t)); return hit ? hit[1] : 'skip'; };
const splitCSV = line => { const out = []; let cur = '', inq = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (inq && line[i + 1] === '"') { cur += '"'; i++; } else inq = !inq; } else if ((ch === ',' || ch === '\t' || ch === ';') && !inq) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
const fsize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
/** The running page: a progress bar, then the result with Undo. o: {name, what, counts: [[label, n]], added, merged, skipped, sync}. */
function runImport(page, o) {
  if (S.offline) return ui.toast('You’re offline. Import needs a connection.', 'wifi.slash', 2800);
  const st = { done: false, rec: null }; let alive = true;
  page.push({ title: 'Importing', back: false, onClose: () => { alive = false; }, onAppear: async pg => { if (st.done || st.started) return; st.started = true;
      for (let i = 1; i <= 24 && alive; i++) { await WD.delay(70, 150); const bar = pg.body.querySelector('.progress i'), n = pg.body.querySelector('.im-run .n'); if (bar) bar.style.width = Math.round(i / 24 * 100) + '%'; if (n) n.replaceChildren(o.counts.map(([label, total]) => h('div', Math.round(total * i / 24).toLocaleString('en-US') + ' of ' + total.toLocaleString('en-US') + ' ' + label))); }
      if (!alive) return; st.rec = { id: uid('im'), at: +WD.now(), name: o.name, what: o.what, added: o.added, merged: o.merged, skipped: o.skipped, by: me(), sync: !!o.sync }; IM().history.unshift(st.rec); st.done = true; WD.changed(); pg.refresh(); },
    render: pg => st.done ? ui.list(h('div.im-run', icon('checkmark.circle.fill', 44, 'var(--green)'), h('div.t', { style: 'margin-top:8px' }, 'Import finished'), h('div.n', h('div', st.rec.added.toLocaleString('en-US') + ' added'), st.rec.merged ? h('div', st.rec.merged.toLocaleString('en-US') + ' merged into records you already had') : null, st.rec.skipped ? h('div', st.rec.skipped.toLocaleString('en-US') + ' left out') : null)),
        note('Prototype: the counts are simulated and no records were added to this demo company.'),
        ui.section({ fold: false, showFooter: true, footer: 'For 30 days you can undo this import: everything it added is removed and everything it merged goes back to how it was.' }, ui.row({ title: 'Undo this import', destructive: true, onTap: async () => { if (await undoImport(st.rec)) pg.pop(); } })),
        h('div', { style: 'padding:12px 0 0' }, ui.button('Done', { onTap: () => { let n = 0; const back = () => { const top = WD.nav.current && WD.nav.current().top && WD.nav.current().top(); if (top && top.spec && top.spec.title !== 'Import' && n++ < 6) { WD.nav.pop(); setTimeout(back, 60); } }; back(); } })))
      : ui.list(h('div.im-run', h('div.t', 'Importing ' + o.name + '…'), ui.progress(0), h('div.n', 'Starting…')), note('Keep this page open. Nothing is final until it finishes, and the whole import can be undone for 30 days.')) });
}
async function undoImport(r) { if (!await ui.actionSheet({ title: 'Undo this import?', message: r.name + ' · ' + r.added.toLocaleString('en-US') + ' added records are removed and ' + (r.merged || 0).toLocaleString('en-US') + ' merged records go back to how they were. Work done on them since is kept in their history.', buttons: [{ label: 'Undo the import', value: true, role: 'destructive' }] })) return false;
  if (!await ui.run('Undoing the import…', () => { r.undone = +WD.now(); }, { done: 'Import undone', min: 1000, max: 1600 })) return false; WD.changed(); return true; }
/** Validation: ready, duplicates (merge / skip / add as new), problems listed. */
function validateSpec(w) { const rows = w.rows, dup = Math.max(1, Math.round(rows * 0.045)), bad = w.nomap && w.type.id === 'json' ? 0 : Math.max(2, Math.round(rows * 0.028)), st = { dup: 'merge', bad: 'flag' }, noun = w.what === 'all' ? 'record' : whatName(w.what).toLowerCase().replace(/s? and the recurring schedule/, '').replace(/ and balances/, '').replace(/s$/, '');
  const PROBLEMS = { customers: ['no service address', 'phone number has 9 digits', 'address not found on the map', 'email is missing the @', 'route “Nrth” matches no route'], contacts: ['no phone or email', 'phone number has 9 digits', 'name is blank'], jobs: ['date is in 1900', 'no address: becomes a day note', 'customer not found', 'route matches no route'], routes: ['driver not found in Team'], invoices: ['customer not found', 'amount is not a number', 'date can’t be read', 'balance is more than the amount'], prices: ['price is blank', 'two rows for the same item'], leads: ['no phone or email', 'name is blank'], all: [] };
  const probs = Array.from({ length: Math.min(bad, 6) }, (_, i) => ({ row: 7 + i * Math.max(3, Math.floor(rows / 9)) + i, why: (PROBLEMS[w.what] || PROBLEMS.customers)[i % (PROBLEMS[w.what] || PROBLEMS.customers).length] }));
  return { title: 'Check before importing', render: page => { const re = () => page.refresh(), ready = rows - dup - bad, total = ready + (st.dup === 'skip' ? 0 : dup) + (st.bad === 'flag' ? bad : 0), added = ready + (st.dup === 'new' ? dup : 0) + (st.bad === 'flag' ? bad : 0), merged = st.dup === 'merge' ? dup : 0;
    return ui.list(
      ui.section({ header: w.file.name + ' · ' + plural(rows, 'row'), fold: false },
        ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: plural(ready, noun) + ' ready', subtitle: 'Nothing to fix' }),
        ui.row({ icon: 'person.2', iconColor: 'var(--orange)', title: plural(dup, 'duplicate'), subtitle: 'Already in RouteClerk: matched by name, phone and address' }),
        ui.pickerRow({ title: 'Duplicates', value: st.dup, options: [{ value: 'merge', label: 'Merge into the existing record' }, { value: 'skip', label: 'Skip them' }, { value: 'new', label: 'Add as new anyway' }], onChange: v => { st.dup = v; re(); } })),
      bad > 0 && ui.section({ header: plural(bad, 'row') + ' with a problem', fold: false, showFooter: true, footer: bad > probs.length ? 'Showing the first ' + probs.length + '. The full list is saved with the import.' : null },
        probs.map(x => ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--orange)', title: 'Row ' + x.row, subtitle: x.why })),
        ui.pickerRow({ title: 'Rows with a problem', value: st.bad, options: [{ value: 'flag', label: 'Import and flag them to fix' }, { value: 'skip', label: 'Leave them out' }], onChange: v => { st.bad = v; re(); } })),
      w.fixes && ui.section({ header: 'Tidied for you', fold: false }, w.fixes.map(t => ui.row({ icon: 'checkmark.circle', iconColor: 'var(--teal)', title: t }))),
      h('div', { style: 'padding:14px 0 0' }, ui.button('Import ' + plural(total, noun), { onTap: () => runImport(page, { name: w.file.name, what: w.what, counts: [[whatName(w.what).toLowerCase(), total]], added, merged, skipped: rows - total }) })),
      h('div', { style: 'padding:10px 4px 0' }, ui.note('Nothing has been saved yet. After the import you have 30 days to undo it.')));
  } }; }
function mappingSpec(w) { const T = TARGETS[w.what] || TARGETS.customers, opts = T.map(([value, label]) => ({ value, label })).concat([{ value: 'skip', label: 'Don’t import' }]);
  return { title: 'Match columns', render: page => { const auto = w.cols.filter(x => x.auto && x.target !== 'skip').length, used = {}; w.cols.forEach(x => { if (x.target !== 'skip') used[x.target] = (used[x.target] || 0) + 1; });
    const twice = Object.keys(used).filter(k => used[k] > 1).map(k => (T.find(t => t[0] === k) || [])[1]), need = T[0], missing = !used[need[0]];
    return ui.list(
      w.type.ai && WD.aip && WD.aip.block(() => aiCard({ title: 'AI Premium read the PDF', text: plural(w.rows, 'row') + ' found across the pages. The columns below are what it made of the list; check the samples.' })),
      ui.section({ header: w.file.name + ' · ' + plural(w.rows, 'row'), fold: false, showFooter: true, footer: auto + ' of ' + w.cols.length + ' columns were matched by their headings. Fix any that are wrong; a column set to “Don’t import” is ignored.' },
        w.cols.map(x => ui.pickerRow({ title: x.col, subtitle: x.samples[0] ? 'e.g. ' + x.samples[0] : 'Empty in the first rows', value: x.target, options: opts, onChange: v => { x.target = v; x.auto = false; page.refresh(); } }))),
      ui.section({ header: 'First rows', fold: false }, h('div.im-sample', h('table', h('thead', h('tr', w.cols.map(x => h('th', x.col)))), h('tbody', [0, 1, 2].filter(i => w.cols.some(x => x.samples[i])).map(i => h('tr', w.cols.map(x => h('td', x.samples[i] || '')))))))),
      twice.length > 0 && note('Two columns point at ' + twice.join(' and ') + '. The second one is added to the first.'),
      h('div', { style: 'padding:14px 0 0' }, ui.button('Continue', { disabled: missing, onTap: async () => { if (await ui.run('Checking ' + plural(w.rows, 'row') + '…', null, { min: 900, max: 1400 })) page.push(validateSpec(w)); } })),
      missing && h('div', { style: 'padding:8px 4px 0' }, ui.note('Choose which column is the ' + need[1].toLowerCase() + ' to continue.')));
  } }; }
/** Step 1 for a file: what it holds, and the file itself (a real picker; a sample file keeps the walkthrough going without one). */
function fileSpec2(t) { const w = { type: t, what: t.what || 'customers', file: null, cols: [], rows: 0, nomap: !!t.nomap, parsed: null };
  const build = () => { if (w.parsed && w.parsed.head.length > 1) { w.cols = w.parsed.head.map((col, i) => ({ col: col || 'Column ' + (i + 1), samples: w.parsed.rows.map(r => r[i] || ''), target: guess(col, w.what), auto: true })); w.rows = w.parsed.count; }
    else { const S2 = SAMPLES[w.what] || SAMPLES.customers; w.cols = S2.map(([col, ...samples]) => ({ col, samples, target: guess(col, w.what), auto: true })); w.rows = w.file ? Math.max(24, Math.min(4800, Math.round((w.file.size || 60000) / 190))) : 318; }
    w.fixes = ['customers', 'jobs'].includes(w.what) ? ['Frequency wording made the same: “By weekly” → Every 2 weeks, “four weeks” → Every 4 weeks', 'Phone numbers written the same way', 'Extra spaces and ALL CAPS names cleaned up'] : ['Dates read in month/day/year order', 'Dollar signs and commas removed from amounts']; };
  return { title: t.title.replace(/ \(.*/, ''), render: page => { const re = () => page.refresh();
    const take = file => { w.file = { name: file.name, size: file.size }; w.parsed = null;
      if (/\.(csv|txt|tsv)$/i.test(file.name) && file.size < 5e6 && window.FileReader) { const r = new FileReader(); r.onload = () => { const lines = String(r.result).split(/\r?\n/).filter(x => x.trim()); if (lines.length > 1) w.parsed = { head: splitCSV(lines[0]), rows: lines.slice(1, 4).map(splitCSV), count: lines.length - 1 }; re(); }; r.onerror = re; r.readAsText(file); } else re(); };
    const go = async () => { build(); if (t.ai && !await ui.run('AI Premium is reading the PDF…', null, { min: 1400, max: 2200, done: 'Read' })) return; if (w.nomap) { if (await ui.run('Reading ' + w.file.name + '…', null, { min: 900, max: 1400 })) page.push(validateSpec(w)); } else page.push(mappingSpec(w)); };
    return ui.list(
      !t.what || t.id === 'qb' ? ui.section({ header: 'What is in this file?', fold: false }, CONTENTS.map(([v, label]) => ui.row({ icon: w.what === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: w.what === v ? 'var(--tint)' : 'var(--label3)', title: label, onTap: () => { w.what = v; re(); } })))
        : ui.section({ header: 'This brings in', fold: false }, ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--tint)', title: whatName(w.what), subtitle: t.sub })),
      ui.section({ header: 'The file', fold: false, showFooter: true, footer: t.nomap ? 'This kind of file needs no column matching.' : 'On the next step you match its columns to RouteClerk’s fields.' },
        w.file ? ui.row({ icon: t.icon, iconColor: t.color, title: w.file.name, subtitle: (w.file.size ? fsize(w.file.size) : 'Sample file') + (w.parsed ? ' · ' + plural(w.parsed.count, 'row') + ', ' + plural(w.parsed.head.length, 'column') + ' read' : ''), trailing: ui.button('Remove', { kind: 'gray', small: true, block: false, onTap: () => { w.file = null; w.parsed = null; re(); } }) }) : null,
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;background:var(--cell)' }, h('label.btn.tinted.small', { style: 'cursor:pointer' }, icon('doc', 17), w.file ? 'Choose a different file' : 'Choose a file', h('input', { type: 'file', accept: t.accept, style: 'display:none', onchange: e => { const file = e.target.files[0]; if (file) take(file); } })),
          !w.file && ui.button('Use a sample file', { kind: 'gray', small: true, block: false, onTap: () => { w.file = { name: t.sample, size: 0 }; re(); } }))),
      h('div', { style: 'padding:14px 0 0' }, ui.button('Continue', { disabled: !w.file, onTap: go })),
      t.id === 'ics' && WD.admin && WD.admin.jobImportSpec && ui.section({ fold: false }, ui.row({ icon: 'calendar', iconPlain: true, title: 'Job import with a dry run', subtitle: 'The earlier importer: choose the route and whether to bring in past visits', tint: true, chevron: true, onTap: () => page.push(WD.admin.jobImportSpec()) })));
  } }; }
/* ---------- Connect your previous service ---------- */
const SOURCES = [
  { id: 'qbo', name: 'QuickBooks Online', icon: 'dollarsign.circle', color: '#2CA01C', auth: 'oauth', has: ['customers', 'contacts', 'invoices', 'prices'], n: { customers: 412, contacts: 530, invoices: 2864, prices: 38 } },
  { id: 'ninja', name: 'Invoice Ninja', icon: 'doc.text', color: '#3A3A3C', auth: 'key', has: ['customers', 'contacts', 'invoices', 'prices'], n: { customers: 388, contacts: 471, invoices: 3120, prices: 24 } },
  { id: 'jobber', name: 'Jobber', icon: 'briefcase', color: '#7DB00E', auth: 'oauth', has: ['customers', 'contacts', 'jobs', 'invoices', 'leads'], n: { customers: 356, contacts: 402, jobs: 1840, invoices: 2210, leads: 64 } },
  { id: 'servicetitan', name: 'ServiceTitan', icon: 'briefcase', color: '#0A66C2', auth: 'key', has: ['customers', 'contacts', 'jobs', 'invoices', 'prices'], n: { customers: 520, contacts: 688, jobs: 3320, invoices: 3105, prices: 112 } },
  { id: 'housecall', name: 'Housecall Pro', icon: 'house', color: '#1F73E8', auth: 'oauth', has: ['customers', 'contacts', 'jobs', 'invoices'], n: { customers: 298, contacts: 344, jobs: 1512, invoices: 1490 } },
  { id: 'gcal', name: 'Google Calendar', icon: 'calendar', color: '#4285F4', auth: 'oauth', has: ['jobs', 'routes'], n: { jobs: 1284, routes: 4 } },
  { id: 'gsheets', name: 'Google Sheets', icon: 'columns', color: '#0F9D58', auth: 'oauth', has: ['customers', 'jobs', 'prices', 'leads'], n: { customers: 318, jobs: 960, prices: 22, leads: 140 } },
  { id: 'quo', name: 'Quo contacts', icon: 'phone.fill', color: '#6E56CF', auth: 'key', has: ['contacts'], n: { contacts: 612 } }];
function connectSheet(src, done) { const cur = IM().sources[src.id] || {}, f = { step: cur.connected ? 'pick' : 'auth', key: '', pull: Object.fromEntries(src.has.map(k => [k, true])), sync: cur.sync !== false };
  const sheet = ui.sheet({ title: src.name, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], render: p => f.step === 'auth' ? ui.list(
      src.auth === 'oauth' ? [h('div.im-run', icon(src.icon, 40, src.color), h('div.t', { style: 'margin-top:8px' }, 'RouteClerk wants to read your ' + src.name + ' account'), h('div.n', src.has.map(k => h('div', 'See your ' + whatName(k).toLowerCase())), h('div', { style: 'margin-top:6px' }, 'It can’t change or delete anything there.'))),
          note('Prototype: this stands in for ' + src.name + '’s own sign-in page. No account is contacted.'),
          h('div', { style: 'padding:12px 0 0' }, ui.button('Allow access', { onTap: async () => { if (await ui.run('Connecting to ' + src.name + '…', () => { IM().sources[src.id] = { connected: true, sync: f.sync, at: +WD.now() }; }, { done: 'Connected' })) { f.step = 'pick'; WD.changed(); p.refresh(); } } }))]
        : [ui.section({ header: 'API key', fold: false, showFooter: true, footer: 'In ' + src.name + ': Settings → API or Integrations → create a read-only key. Prototype: type anything; don’t paste a real key here.' }, ui.inputRow({ label: 'Key', placeholder: 'demo-key-0000', value: f.key, caps: 'off', onInput: v => { f.key = v; } })),
          h('div', { style: 'padding:12px 0 0' }, ui.button('Connect', { onTap: async () => { if (await ui.run('Checking the key…', () => { IM().sources[src.id] = { connected: true, sync: f.sync, at: +WD.now() }; }, { done: 'Connected' })) { f.step = 'pick'; f.key = ''; WD.changed(); p.refresh(); } } }))])
    : ui.list(ui.section({ header: 'What to pull', fold: false }, src.has.map(k => ui.toggleRow({ title: whatName(k), subtitle: src.n[k].toLocaleString('en-US') + ' found', value: f.pull[k], onChange: v => { f.pull[k] = v; p.refresh(); } }))),
        ui.section({ fold: false, showFooter: true, footer: f.sync ? 'Every night RouteClerk checks ' + src.name + ' for new and changed records while you move over. Turn it off when you stop using ' + src.name + '.' : 'A one-time copy. Later changes in ' + src.name + ' are not picked up.' }, ui.toggleRow({ title: 'Keep in sync', value: f.sync, onChange: v => { f.sync = v; p.refresh(); } })),
        h('div', { style: 'padding:12px 0 0' }, ui.button('Start the import', { disabled: !src.has.some(k => f.pull[k]), onTap: () => { const ks = src.has.filter(k => f.pull[k]), tot = ks.reduce((s, k) => s + src.n[k], 0), merged = Math.round(tot * 0.12); IM().sources[src.id] = { connected: true, sync: f.sync, at: +WD.now() };
          sheet.close(); setTimeout(() => { done && done(); runImport(WD.nav.current().top(), { name: src.name, what: ks[0], counts: ks.map(k => [whatName(k).toLowerCase(), src.n[k]]), added: tot - merged, merged, skipped: Math.round(tot * 0.01), sync: f.sync }); }, 420); } })),
        cur.connected && ui.section(null, ui.row({ title: 'Disconnect ' + src.name, destructive: true, center: true, onTap: () => { delete IM().sources[src.id]; WD.changed(); sheet.close(); done && done(); } }))) }, { detent: 'large' });
}
/* ---------- AI Premium: let AI look at what you have ---------- */
M.aiImportSpec = () => { const st = { files: [], report: null };
  return { title: 'Let AI look at what you have', render: page => { if (!aip()) return ui.empty({ icon: 'sparkles', title: 'AI Premium is off', text: 'AI evaluation of your data is part of AI Premium.' });
    const re = () => page.refresh(), add = list => { [...list].forEach(f => { if (!st.files.some(x => x.name === f.name)) st.files.push({ name: f.name, size: f.size }); }); st.report = null; re(); }, conn = SOURCES.filter(s => (IM().sources[s.id] || {}).connected);
    const look = async () => { if (!st.files.length && !conn.length) st.files = [{ name: 'Customer list 2026.xlsx', size: 84200 }, { name: 'Route sheets (North, East).xlsx', size: 61800 }, { name: 'Price list OLD.xlsx', size: 18400 }, { name: 'Contacts.vcf', size: 40200 }];
      if (!await ui.run('Reading ' + plural(st.files.length + conn.length, 'source') + '…', null, { min: 1800, max: 2600, done: 'Read' })) return;
      const sheets = st.files.filter(f => /\.(xlsx?|csv|numbers|tsv)$/i.test(f.name)), size = st.files.reduce((s, f) => s + (f.size || 50000), 0), cust = Math.max(40, Math.min(2400, Math.round(size / 500) + conn.reduce((s, x) => s + (x.n.customers || 0), 0)));
      st.report = { cust, rec: Math.round(cust * 0.94), sheets: sheets.length, other: st.files.length - sheets.length, dupes: Math.max(3, Math.round(cust * 0.056)), geo: Math.max(2, Math.round(cust * 0.022)), bi: Math.max(4, Math.round(cust * 0.075)), four: Math.max(3, Math.round(cust * 0.044)), price: sheets.length > 1 ? Math.max(2, Math.round(cust * 0.034)) : 0, fix: { dupes: true, geo: true, freq: true, price: true } }; re(); };
    const R = st.report, drop = h('label.im-drop', icon('cloud', 30, 'var(--tint)'), h('b', st.files.length ? 'Add more files' : 'Choose files, or drop them here'), 'Any mix: spreadsheets, CSV, calendar files, QuickBooks exports, contacts, PDFs.', h('input', { type: 'file', multiple: true, style: 'display:none', onchange: e => { add(e.target.files); e.target.value = ''; } }));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); }); drop.addEventListener('dragleave', () => drop.classList.remove('over')); drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) add(e.dataTransfer.files); });
    return ui.list(note('Give the AI whatever you have. It tells you what it found, proposes where everything goes and what to clean up, and waits for your approval before anything is imported.'),
      h('div', { style: 'margin:0 0 12px' }, drop, st.files.length > 0 && h('div.im-files', st.files.map((f, i) => h('span.im-file', icon('doc', 15), h('span', f.name), h('button', { 'aria-label': 'Remove ' + f.name, onclick: () => { st.files.splice(i, 1); st.report = null; re(); } }, icon('xmark.circle.fill', 18))))),
        conn.length > 0 && h('div.section-footer', { style: 'padding:8px 4px 0' }, 'Also looking at: ' + conn.map(s => s.name).join(', ') + ' (connected).')),
      !R && h('div', ui.button(st.files.length || conn.length ? 'Let AI look at ' + plural(st.files.length + conn.length, 'source') : 'Try it with sample files', { icon: 'sparkles', onTap: look })),
      R && [aiCard({ title: 'AI Premium · what I found', text: [R.sheets ? plural(R.sheets, 'spreadsheet') : null, R.other ? plural(R.other, 'other file') : null, conn.length ? plural(conn.length, 'connected service') : null].filter(Boolean).join(', ') + ': ' + R.cust.toLocaleString('en-US') + ' customers, ' + R.rec.toLocaleString('en-US') + ' with a recurring schedule' + (R.price ? ', and 2 price lists that disagree on ' + plural(R.price, 'customer') : '') + '.',
          lines: [R.dupes + ' customers appear more than once (same phone or address, different spelling)', R.geo + ' addresses can’t be found on the map', (R.bi + R.four) + ' rows describe the schedule in words I can standardize'] }),
        ui.section({ header: 'Where everything goes', fold: false }, st.files.slice(0, 6).map(f => ui.row({ icon: 'doc', iconColor: 'var(--gray)', title: f.name, subtitle: /price/i.test(f.name) ? 'Price list → Items, services and fees, and each customer’s rate' : /route/i.test(f.name) ? 'Routes, stop order and the recurring schedule' : /\.vcf$/i.test(f.name) || /contact/i.test(f.name) ? 'Contacts, matched to customers by company and phone' : /\.ics$/i.test(f.name) ? 'Jobs and the recurring schedule' : /\.(iif|qbo)$/i.test(f.name) || /invoice|quickbooks/i.test(f.name) ? 'Open invoices and balances' : /\.pdf$/i.test(f.name) ? 'Customers (read from the pages)' : 'Customers, addresses, service frequency and containers' })),
          conn.map(s => ui.row({ icon: s.icon, iconColor: s.color, title: s.name, subtitle: s.has.map(k => whatName(k)).join(', ') }))),
        ui.section({ header: 'Cleanup I propose', fold: false, showFooter: true, footer: 'Switch off anything you would rather do by hand. Every change is listed in the import report.' },
          ui.toggleRow({ title: 'Merge ' + R.dupes + ' duplicate customers', subtitle: 'Keeps the newest phone, email and price; nothing is lost', value: R.fix.dupes, onChange: v => { R.fix.dupes = v; re(); } }),
          ui.toggleRow({ title: 'Import ' + R.geo + ' addresses that don’t geocode, flagged', subtitle: 'They show with a ? on the map until someone fixes them', value: R.fix.geo, onChange: v => { R.fix.geo = v; re(); } }),
          ui.toggleRow({ title: 'Standardize the frequency wording', subtitle: '“By weekly”, “bi-wkly” → Every 2 weeks (' + R.bi + ' rows) · “four weeks”, “4 wks” → Every 4 weeks (' + R.four + ' rows)', value: R.fix.freq, onChange: v => { R.fix.freq = v; re(); } }),
          R.price > 0 && ui.toggleRow({ title: 'Use the newer price list where the two disagree', subtitle: plural(R.price, 'customer') + ' · the older price is kept in their price history', value: R.fix.price, onChange: v => { R.fix.price = v; re(); } })),
        h('div', { style: 'padding:12px 0 0' }, ui.button('Approve and import', { icon: 'checkmark.circle', onTap: () => { const merged = R.fix.dupes ? R.dupes : 0; runImport(page, { name: 'AI import · ' + plural(st.files.length + conn.length, 'source'), what: 'customers', counts: [['customers', R.cust - merged], ['recurring schedules', R.rec], ['contacts', Math.round(R.cust * 1.2)]], added: R.cust - merged - (R.fix.geo ? 0 : R.geo), merged, skipped: R.fix.geo ? 0 : R.geo }); } })),
        h('div', { style: 'padding:8px 0 0' }, ui.button('Look again', { kind: 'gray', onTap: () => { st.report = null; re(); } })),
        h('div', { style: 'padding:10px 4px 0' }, ui.note('Nothing is imported until you approve, and the import can be undone for 30 days.'))]);
  } }; };
/** Settings → Company → Import: one page to bring data in. */
M.importSpec = () => ({ title: 'Import', render: page => { if (!admin()) return locked(); const re = () => page.refresh(), hist = IM().history;
  return ui.list(note('Bring your information in, from a file or straight from the program you used before. Nothing is saved until you have checked it, and an import can be undone for 30 days.'),
    WD.aip && WD.aip.block(() => aiCard({ title: 'AI Premium · let AI look at what you have', text: 'Drop in any mix of files and exports, or connect a service. The AI reports what it found, proposes the mapping and the cleanup, and asks before importing.', action: ui.button('Let AI look', { kind: 'tinted', small: true, icon: 'sparkles', onTap: () => page.push(M.aiImportSpec()) }) })),
    ui.section({ header: 'From a file', fold: false, showFooter: true, footer: 'Choose the file, match its columns, check the result, then import.' },
      FILE_TYPES.filter(t => !t.ai || aip()).map(t => ui.row({ icon: t.icon, iconColor: t.color, title: t.ai ? h('span', t.title + ' ', WD.aip.tag()) : t.title, subtitle: t.sub, chevron: true, onTap: () => page.push(fileSpec2(t)) }))),
    ui.section({ header: 'Connect your previous service', fold: false, showFooter: true, footer: 'Sign in or paste an API key, choose what to pull, and RouteClerk copies it over. It only reads; nothing is changed in the other program.' },
      SOURCES.map(s => { const c = IM().sources[s.id] || {}; return ui.row({ icon: s.icon, iconColor: s.color, title: s.name, subtitle: c.connected ? 'Connected' + (c.sync ? ' · kept in sync every night' : ' · one-time copy') : s.has.map(k => whatName(k).split(' ')[0]).join(', '), trailing: ui.button(c.connected ? 'Pull again' : 'Connect', { kind: c.connected ? 'gray' : 'tinted', small: true, block: false, onTap: e => { e.stopPropagation(); connectSheet(s, re); } }), onTap: () => connectSheet(s, re) }); })),
    ui.section({ header: 'Import history', fold: false, showFooter: true, footer: 'An import can be undone for 30 days.' }, hist.length ? hist.map(r => { const left = 30 - D.diff(today(), D.key(new Date(r.at)));
      return ui.row({ icon: r.undone ? 'xmark.circle.fill' : 'checkmark.circle.fill', iconPlain: true, iconColor: r.undone ? 'var(--gray)' : 'var(--green)', title: r.name, subtitle: [h('div', stampDay(r.at) + ' · ' + r.by + ' · ' + r.added.toLocaleString('en-US') + ' added' + (r.merged ? ', ' + r.merged.toLocaleString('en-US') + ' merged' : '') + (r.skipped ? ', ' + r.skipped + ' left out' : '')), h('div', r.undone ? 'Undone ' + stampDay(r.undone) : left > 0 ? 'Can be undone for ' + plural(left, 'more day') : 'The 30 days to undo have passed')],
        trailing: !r.undone && left > 0 ? ui.button('Undo', { kind: 'gray', small: true, block: false, onTap: async e => { e.stopPropagation(); if (await undoImport(r)) re(); } }) : null }); }) : ui.row({ title: 'Nothing imported yet' })));
} });
if (WD.aip) { WD.aip.feature('Import: AI looks at what you have', 'Settings → Company → Import', 'Reads any mix of spreadsheets, exports and connected services, reports what it found, proposes the mapping and cleanup, and imports after you approve.');
  WD.aip.feature('Import a PDF customer list', 'Settings → Company → Import → From a file', 'Reads a printed or scanned customer list into rows and columns you can check and import.'); }

/* ================= Settings rows and the control panel ================= */
if (WD.r14) { const A = WD.r14, add = fn => A.addSetting('Company', fn);
  add((push, gated) => A.link(push, gated, 'settings.manage', 'doc.text', 'var(--green)', 'Invoicing', 'RouteClerk invoicing (built in) or a bookkeeping program; numbering, terms and late fee', M.invoicingSpec, M.builtIn() ? 'Built in' : M.viaName()));
  add((push, gated) => A.link(push, gated, 'settings.manage', 'square.and.pencil', 'var(--indigo)', 'Forms and documents', 'Design invoices, statements, estimates, quotes and more: blocks, wording, custom fields', M.formsSpec, plural(data.forms.layouts.length, 'layout')));
  add((push, gated) => R11().moneySpec && A.link(push, gated, 'settings.manage', 'dollarsign.circle', 'var(--green)', 'Pricing and Agreements', 'Price-change letters and notice, exact portal fees, contract length, box sizes', R11().moneySpec, R11().moneyLabel ? R11().moneyLabel() : null));
  add((push, gated) => R11().unpaidSettingsSpec && A.link(push, gated, 'settings.manage', 'exclamationmark.circle', 'var(--red)', 'Unpaid invoice warnings', 'Turn the warnings on or off, where they show, and when a customer is flagged', R11().unpaidSettingsSpec, R11().unpaidLabel ? R11().unpaidLabel() : null));
  /* Registered last so it sits right beside Export and backup. */
  add((push, gated) => A.link(push, gated, 'settings.manage', 'tray', 'var(--teal)', 'Import', 'Customers, jobs, invoices and more from files or from the program you used before', M.importSpec, (n => n ? plural(n, 'import') : null)(IM().history.filter(r => !r.undone).length))); }
const custTab = spec => { WD.nav.switchTab(WD.can('crm.view') ? 'customers' : 'settings'); WD.nav.push(spec); };
WD.panel.addJump('Pricing and Agreements', () => R11().moneySpec && openSet(R11().moneySpec()));
WD.panel.addJump('Import', () => openSet(M.importSpec()));
WD.panel.addJump('Customer portal', () => { const c = portalDemo(); if (c) custTab(M.portalSpec(c.id)); });
WD.panel.addJump('Forms and documents', () => openSet(M.formsSpec()));
WD.panel.addJump('Invoicing settings', () => openSet(M.invoicingSpec()));
WD.panel.addJump('Unpaid invoice warnings', () => R11().unpaidSettingsSpec && openSet(R11().unpaidSettingsSpec()));
WD.panel.addJump('Email a customer receives', () => { const r = (data.invoices || []).find(i => isOpen(i) && q.customer(i.customerId)); if (r) { WD.nav.switchTab('invoices'); M.emailPreview({ kind: 'invoice', customer: q.customer(r.customerId), rec: r }); } });
WD.panel.addAction('Customer pays in the portal', () => { const r = (data.invoices || []).filter(i => isOpen(i) && q.customer(i.customerId)).sort((a, b) => a.day.localeCompare(b.day))[0]; if (!r) return ui.toast('No open invoices', 'info.circle');
  const c = q.customer(r.customerId), P = pstate(c); if (!P.methods.length) P.methods.push({ id: uid('pm'), type: 'card', brand: 'Visa', last4: '4242', exp: '12/34' }); const m = P.methods[0], fee = feeFor(r.amount, m);
  settle(r, methodLabel(m) + ' · portal', 'the customer portal', fee); WD.changed();
  ui.banner({ title: 'Payment received', text: c.name + ' paid ' + r.number + ' in the portal · ' + money(r.amount) + (fee ? ' + ' + money(fee) + ' fee' : '') + ' · ' + methodLabel(m) + '.', icon: 'creditcard', color: 'var(--green)', duration: 8000, onTap: () => { const pg = WD.screens.customers && WD.screens.customers.invoicePage && WD.screens.customers.invoicePage(r.id); if (pg) { WD.nav.switchTab('invoices'); WD.nav.push(pg); } } }); });
WD.panel.addAction('Customer turns on autopay', () => { const c = data.customers.find(x => recurring(x) && !autoMethod(x) && (data.invoices || []).some(i => i.customerId === x.id && isOpen(i))) || data.customers.find(x => recurring(x) && !autoMethod(x)); if (!c) return ui.toast('Every recurring customer already has autopay', 'info.circle');
  const P = pstate(c); if (!P.methods.length) P.methods.push({ id: uid('pm'), type: 'card', brand: 'Visa', last4: '4242', exp: '12/34' }); P.autopay = { on: true, methodId: P.methods[0].id, max: 0 }; WD.changed();
  ui.banner({ title: 'Autopay turned on', text: c.name + ' switched on autopay in the portal · ' + M.autopayText(c) + '. New invoices are charged on the due date.', icon: 'arrow.clockwise', color: 'var(--green)', duration: 8000, onTap: () => { WD.nav.switchTab(WD.can('crm.view') ? 'customers' : 'settings'); WD.screens.customers.openDetail(c.id); } }); });
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('invTrack', IS); }
})();
