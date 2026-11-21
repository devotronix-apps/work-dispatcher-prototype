/* RouteClerk prototype — version 5.0 pricing (`WD.price`).
   The one-time shred (purge) price list: a base tier (a flat fee that covers the first boxes or bins), a price for each one after, and any
   number of extra line items the admin adds, renames, reorders and deletes. It replaces the math in WD.purgeItems (data.js) by wrapping it,
   so the job editor, repricing and the Price Calc all price a purge the same way. Also here: finding the customer at a typed address, the
   days a truck is already near an address, and the AI Premium “Best fit” pick. The editor page opens from Settings → Purge pricing
   (WD.r8.pricingSpec hands over to WD.price.listSpec). */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc || {}, P = WD.price = {};
const admin = () => WD.can('settings.manage'), r2 = n => Math.round(n * 100) / 100, cash = n => fmt.money(n, Math.abs(n % 1) > 0.001);
const plural = (n, w) => n + ' ' + (n === 1 ? w : w === 'box' ? 'boxes' : /x-rays$/.test(w) ? w.replace(/^box/, 'boxes') : w + 's');
const sum = items => r2(items.reduce((s, x) => s + x.qty * x.rate, 0));
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));

WD.css(`
.pl-tab { width: 100%; border-collapse: collapse; background: var(--cell); font-size: 15px; } .pl-tab td { padding: 10px 16px; border-bottom: .5px solid var(--sep); vertical-align: top; }
.pl-tab tr:last-child td { border-bottom: 0; } .pl-tab td.r { text-align: right; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; } .pl-tab small { display: block; font-size: 12.5px; line-height: 17px; color: var(--label2); letter-spacing: 0; }
.pl-in { width: 84px; min-height: 44px; border: 0; background: var(--fill3); border-radius: 7px; padding: 6px 8px; font: inherit; font-size: 15px; text-align: right; color: var(--label); outline: 0; font-variant-numeric: tabular-nums; }
.pl-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; padding: 12px 16px; background: var(--cell); border-bottom: .5px solid var(--sep); }
.pl-facts div { min-width: 0; font-size: 15px; line-height: 19px; } .pl-facts small { display: block; font-size: 12px; color: var(--label2); letter-spacing: 0; }
.pl-cap { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap; color: #fff; }
`);

/* ================= The price list ================= */
/* data.purgePricing keeps its old fields (method, binFlat, binIncluded, binExtra, legalMult, xlMult) and gains:
   name, boxFlat + boxIncluded (the box base tier; each box after is the price book's “Purge, per box” rate), and
   lines: [{id, name, kind: 'per unit' | 'flat' | 'percent', amount, appliesTo, note, active}].
   appliesTo: unit (every box or bin) · legal · xl · xray · hdd · flight · count · job (once) · total (percent of the job).
   Legal and extra-large lines are added by themselves from the job's box counts; the others are chosen on the quote or the job
   (purge.mods = {lineId: quantity}). Everything is read through PP() because the contents of `data` are swapped when the business changes;
   PP() only fills in what a business does not have yet. */
const APPLY = [['unit', 'Every box or bin on the job', 'unit'], ['legal', 'Legal-size boxes', 'legal box'], ['xl', 'Extra-large boxes', 'extra-large box'], ['xray', 'Boxes of x-rays', 'box of x-rays'], ['hdd', 'Hard drives', 'hard drive'], ['flight', 'Flights of stairs', 'flight'], ['count', 'A count entered on the quote', 'unit'], ['job', 'The whole job', 'job']];
const KINDS = [['per unit', 'Price per unit'], ['flat', 'Flat amount'], ['percent', 'Percent']];
const book = id => (data.priceBook || []).find(x => x.id === id), bookRate = (id, d) => (book(id) || { rate: d }).rate;
const seed = pp => [
  { id: 'pm_legal', name: 'Legal-size box ×' + (pp.legalMult || 1.65), kind: 'percent', amount: Math.round(((pp.legalMult || 1.65) - 1) * 100), appliesTo: 'legal', note: 'A legal box holds about two-thirds more paper', active: true },
  { id: 'pm_xl', name: 'Extra-large box ×' + (pp.xlMult || 2), kind: 'percent', amount: Math.round(((pp.xlMult || 2) - 1) * 100), appliesTo: 'xl', note: '', active: true },
  { id: 'pm_xray', name: 'X-rays (per box)', kind: 'per unit', amount: 12, appliesTo: 'xray', note: 'Film is heavier and is destroyed separately', active: true },
  { id: 'pm_hdd', name: 'Hard drives (each)', kind: 'per unit', amount: bookRate('hdd', 15), appliesTo: 'hdd', note: '', active: true },
  { id: 'pm_stairs', name: 'Stairs (per flight)', kind: 'per unit', amount: 20, appliesTo: 'flight', note: 'No elevator', active: true },
  { id: 'pm_haul', name: 'Haul-away of emptied boxes', kind: 'per unit', amount: bookRate('haul', 2), appliesTo: 'unit', link: 'haul', note: 'The same charge as “Haul away the empty boxes” on a job', active: true },
  { id: 'pm_trip', name: 'Out-of-area trip charge', kind: 'flat', amount: 45, appliesTo: 'job', auto: 'trip', note: 'The Price Calc works the amount out from the address', active: true },
  { id: 'pm_after', name: 'After-hours', kind: 'percent', amount: 25, appliesTo: 'total', note: 'Evenings and weekends', active: true }];
const unitWord = pp => pp.method === 'bin' ? 'bin' : 'box';
const baseName = pp => pp.method === 'bin' ? 'Purge: up to ' + plural(pp.binIncluded, 'bin') + ' (65 gal)' : 'Purge: up to ' + plural(pp.boxIncluded, 'box');
/** Keep the price book in step: one item for the box base tier and one for each line, so invoices and exports can name them. */
function syncBook(pp) {
  const B = data.priceBook; if (!B) return;
  const up = (id, name, unit, rate) => { let x = B.find(y => y.id === id); if (!x) B.push(x = { id }); Object.assign(x, { name, unit, rate }); if (WD.PURGE_IDS && !WD.PURGE_IDS.includes(id)) WD.PURGE_IDS.push(id); };
  up('boxBase', 'Purge: up to ' + plural(pp.boxIncluded, 'box'), 'flat fee', pp.boxFlat);
  pp.lines.forEach(l => up(l.id, l.name, l.kind === 'per unit' ? (APPLY.find(a => a[0] === l.appliesTo) || APPLY[0])[2] : l.kind === 'percent' ? 'percent' : 'flat fee', l.amount));
  const hl = pp.lines.find(l => l.link === 'haul'), hb = book('haul'); if (hl && hb) hb.rate = hl.amount;
  const lg = pp.lines.find(l => l.appliesTo === 'legal' && l.kind === 'percent'), xl = pp.lines.find(l => l.appliesTo === 'xl' && l.kind === 'percent');
  if (lg) pp.legalMult = r2(1 + lg.amount / 100); if (xl) pp.xlMult = r2(1 + xl.amount / 100);
}
function PP() {
  const pp = data.purgePricing || (data.purgePricing = { method: 'box', binFlat: 150, binIncluded: 2, binExtra: 60, legalMult: 1.65, xlMult: 2 }), c = data.calc || {};
  if (pp.name == null) pp.name = 'One-time shred pricing';
  if (pp.boxFlat == null) pp.boxFlat = c.base != null ? c.base : 150;
  if (pp.boxIncluded == null) pp.boxIncluded = c.included != null ? c.included : 14;
  if (!pp.lines) { pp.lines = seed(pp); syncBook(pp); } else if (!book('boxBase')) syncBook(pp);
  return pp;
}
P.get = PP; P.name = () => PP().name; P.APPLY = APPLY; P.KINDS = KINDS;
/** {method, unit, flat, included, extra}: the base tier of whichever method the business uses. */
P.tier = () => { const pp = PP(), bin = pp.method === 'bin'; return { method: pp.method, unit: unitWord(pp), flat: bin ? pp.binFlat : pp.boxFlat, included: bin ? pp.binIncluded : pp.boxIncluded, extra: bin ? pp.binExtra : bookRate('box', 8) }; };
P.label = () => { const t = P.tier(); return (t.method === 'bin' ? 'By the bin · ' : 'By the box · ') + cash(t.flat) + ' up to ' + t.included + ', then ' + cash(t.extra) + ' each'; };
P.activeLines = () => PP().lines.filter(l => l.active !== false);
P.tripLine = () => P.activeLines().find(l => l.auto === 'trip') || null;
/** How a line is worded in the list: “$12 per box of x-rays”, “+25% of the job”. */
P.lineSummary = l => { const a = (APPLY.find(x => x[0] === l.appliesTo) || APPLY[0]), pp = PP(), u = l.appliesTo === 'unit' ? unitWord(pp) : a[2];
  return l.kind === 'per unit' ? cash(l.amount) + ' per ' + u : l.kind === 'flat' ? cash(l.amount) + (l.appliesTo === 'job' || l.appliesTo === 'total' ? ' once per job' : ' when the job has ' + a[1].toLowerCase())
    : '+' + l.amount + '% ' + (l.appliesTo === 'legal' || l.appliesTo === 'xl' ? 'of the ' + unitWord(pp) + ' price, each ' + a[2] : 'of the job'); };
const isAuto = l => l.appliesTo === 'legal' || l.appliesTo === 'xl';

/* ---------- The math ---------- */
const orig = { items: WD.purgeItems, sync: WD.syncPurgeBook, label: WD.itemsLabel };
/** Billing lines for a purge. p: what the customer has (plus p.mods = {lineId: quantity} and p.modRate = {lineId: amount for this job});
    e: WD.purgeEstimate(p); boxRate: this job's price for each additional box. A purge with nothing counted yet still gets the base tier,
    so a new purge job starts at the initial price. */
function quote(p, e, boxRate) {
  const pp = PP(), R = data.purgeRules || {}, bin = pp.method === 'bin', mods = p.mods || {}, over = p.modRate || {}, act = pp.lines.filter(l => l.active !== false), out = [];
  const lg = +p.legal || 0, xl = +p.xl || 0; let units, rate;
  if (bin) { units = WD.purgeBins(e.boxes); rate = pp.binExtra; const more = Math.max(0, units - pp.binIncluded);
    out.push({ id: 'binFlat', qty: 1, rate: pp.binFlat, bins: units }); if (more) out.push({ id: 'binExtra', qty: more, rate: pp.binExtra }); }
  else { units = Math.max(0, Math.ceil(e.boxes - lg * ((R.legal || 1.65) - 1) - xl * ((R.xl || 2) - 1) - 1e-9)); rate = boxRate != null ? boxRate : bookRate('box', 8); const more = Math.max(0, units - pp.boxIncluded);
    out.push({ id: 'boxBase', name: baseName(pp), qty: 1, rate: pp.boxFlat, boxes: units }); if (more) out.push({ id: 'box', name: 'Additional boxes', qty: more, rate });
    act.filter(isAuto).forEach(l => { const n = l.appliesTo === 'legal' ? lg : xl; if (n > 0) out.push({ id: l.id, name: l.name, qty: l.kind === 'flat' ? 1 : n, rate: l.kind === 'percent' ? r2(rate * l.amount / 100) : l.amount }); }); }
  /* Stairs by the box and haul-away come from the job's own switches, as before. The haul-away line sets that rate, or turns it off. */
  const hl = pp.lines.find(l => l.link === 'haul');
  (WD.purgeExtras ? WD.purgeExtras(p, e.billable) : []).forEach(x => { if (x.id === 'haul' && hl) { if (hl.active === false) return; x.rate = hl.amount; } if (x.qty > 0) out.push(x); });
  act.forEach(l => { if (isAuto(l) || l.link === 'haul' || l.kind === 'percent') return; const n = +mods[l.id] || 0; if (!n) return; const amt = over[l.id] != null ? over[l.id] : l.amount, qty = l.kind === 'flat' ? 1 : l.appliesTo === 'unit' ? units : n;
    if (qty > 0) out.push({ id: l.id, name: l.name, qty, rate: amt }); });
  act.forEach(l => { if (l.kind !== 'percent' || isAuto(l) || !+mods[l.id]) return; out.push({ id: l.id, name: l.name + ' (' + l.amount + '%)', qty: 1, rate: r2(sum(out) * l.amount / 100) }); });
  return out;
}
WD.purgeItems = (p, e, boxRate) => { try { p = p || {}; return quote(p, e || WD.purgeEstimate(p), boxRate); } catch (err) { console.error(err); return orig.items(p, e, boxRate); } };
WD.syncPurgeBook = () => { if (orig.sync) orig.sync(); try { syncBook(PP()); } catch (err) { console.error(err); } };
/* A job priced with the base tier keeps only the boxes past the tier on its “box” line, so the label counts them from the base line. */
WD.itemsLabel = (items, purge) => { const b = (items || []).find(i => i.id === 'boxBase'); if (!b) return orig.label(items, purge);
  const ex = items.find(i => i.id === 'box'), n = b.boxes != null ? b.boxes : PP().boxIncluded + (ex ? ex.qty : 0);
  return orig.label(items.filter(i => i.id !== 'boxBase' && i.id !== 'box').concat(n > 0 ? [{ id: 'box', qty: n, rate: 0 }] : []), purge); };
P.items = (p, boxRate) => WD.purgeItems(p || {}, WD.purgeEstimate(p || {}), boxRate == null ? null : boxRate);
P.total = (p, boxRate) => sum(P.items(p, boxRate));
/** What the customer has, from a count of boxes (or bins, when the business prices by the bin) and the extras chosen: {lineId: quantity}. */
P.purgeFor = (qty, mods = {}) => { const pp = PP(), p = { stairs: 'none', haul: false, mods: {} }; p[pp.method === 'bin' ? 'bin65' : 'std'] = Math.max(0, +qty || 0);
  pp.lines.forEach(l => { const n = +mods[l.id] || 0; if (!n || l.active === false) return; if (l.appliesTo === 'legal') p.legal = n; else if (l.appliesTo === 'xl') p.xl = n; else if (l.link === 'haul') p.haul = true; else p.mods[l.id] = n; });
  return p; };
/** One line of a price as words and an amount: “Purge: up to 14 boxes — $150”, “Additional boxes: 6 × $8”. */
P.lineLabel = x => { const pp = PP(), nm = x.name || (book(x.id) || {}).name || x.id;
  return x.id === 'boxBase' ? 'Purge: up to ' + plural(pp.boxIncluded, 'box') : x.id === 'binFlat' ? 'Purge: up to ' + plural(pp.binIncluded, 'bin') + ' (65 gal)' : x.id === 'box' ? 'Additional boxes: ' + x.qty + ' × ' + cash(x.rate) : x.id === 'binExtra' ? 'Additional bins: ' + x.qty + ' × ' + cash(x.rate) : nm + (x.qty !== 1 ? ': ' + x.qty + ' × ' + cash(x.rate) : ''); };
P.lines = items => items.map(x => ({ label: P.lineLabel(x), amount: r2(x.qty * x.rate) }));
P.text = items => items.map(x => x.id === 'boxBase' || x.id === 'binFlat' ? P.lineLabel(x) + ' — ' + cash(x.rate) : P.lineLabel(x) + (x.qty === 1 ? ' — ' + cash(x.rate) : '')).join(' + ');
/** The starting price of a new purge job: {purge, items, total, text}. n = boxes (or bins) already known, 0 for none. */
P.initialPurge = (n = 0) => { const purge = P.purgeFor(n), items = P.items(purge); return { purge, items, total: sum(items), text: P.text(items) }; };

/* ---------- Settings → the price list ---------- */
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'This needs the Company settings permission. An owner or admin can grant it in Team and roles.' });
const numIn = (label, value, set, o = {}) => h('input.pl-in', { type: 'text', inputmode: o.whole ? 'numeric' : 'decimal', 'aria-label': label, value: (o.pre || '') + value + (o.post || ''), onfocus: e => e.target.select(), onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  onchange: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); if (!isNaN(v)) set(o.whole ? Math.max(o.min || 0, Math.round(v)) : Math.max(0, r2(v))); else e.target.value = (o.pre || '') + value + (o.post || ''); } });
const inRow = (title, sub, input) => h('div.row', h('div.row-main', h('div.row-title', title), sub && h('div.row-sub', sub)), input);
function editLine(line, done) {
  const pp = PP(), isNew = !line, f = line ? { ...line } : { id: 'pm_' + Date.now().toString(36), name: '', kind: 'per unit', amount: 0, appliesTo: 'count', note: '', active: true };
  const save = p => { if (!f.name.trim()) return ui.toast('Give the line a name', 'note'); f.name = f.name.trim(); if (f.kind === 'percent' && !['legal', 'xl'].includes(f.appliesTo)) f.appliesTo = 'total'; else if (f.kind !== 'percent' && f.appliesTo === 'total') f.appliesTo = 'job';
    if (isNew) pp.lines.push(f); else Object.assign(line, f); WD.syncPurgeBook(); WD.changed(); p.dismiss(); done && done(); ui.toast(isNew ? 'Line item added' : 'Saved', 'checkmark'); };
  const move = (p, d) => { const i = pp.lines.indexOf(line), j = i + d; if (j < 0 || j >= pp.lines.length) return; pp.lines.splice(i, 1); pp.lines.splice(j, 0, line); WD.changed(); done && done(); p.refresh(); };
  ui.sheet({ title: isNew ? 'New line item' : 'Line item', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: isNew ? 'Add' : 'Save', bold: true, onTap: save }],
    render: p => { const i = pp.lines.indexOf(line), applies = f.kind === 'percent' ? [['total', 'The whole job'], ['legal', 'Legal-size boxes'], ['xl', 'Extra-large boxes']] : APPLY.map(a => [a[0], a[1]]);
      if (!applies.some(a => a[0] === f.appliesTo)) f.appliesTo = applies[0][0];
      return ui.list(
        ui.section({ fold: false }, ui.inputRow({ label: 'Name', placeholder: 'e.g. Tapes and film (per box)', value: f.name, required: true, autofocus: isNew, onInput: v => { f.name = v; } }),
          ui.pickerRow({ title: 'Charged as', value: f.kind, options: KINDS.map(([value, label]) => ({ value, label })), onChange: v => { f.kind = v; p.refresh(); } }),
          inRow(f.kind === 'percent' ? 'Percent' : 'Amount', f.kind === 'percent' ? 'Added on top' : f.kind === 'flat' ? 'Once' : 'For each one', numIn('Amount', f.amount, v => { f.amount = v; }, f.kind === 'percent' ? { post: '%' } : { pre: '$' })),
          ui.pickerRow({ title: 'Applies to', value: f.appliesTo, options: applies.map(([value, label]) => ({ value, label })), onChange: v => { f.appliesTo = v; p.refresh(); } }),
          ui.inputRow({ label: 'Note', placeholder: 'Optional, for the office', value: f.note || '', onInput: v => { f.note = v; } }),
          ui.toggleRow({ title: 'In use', subtitle: 'Off keeps the line but leaves it out of quotes and jobs', value: f.active !== false, onChange: v => { f.active = v; } })),
        h('div', { style: 'padding:0 4px' }, ui.note(isAuto(f) ? 'Added by itself when a job counts ' + (f.appliesTo === 'legal' ? 'legal-size' : 'extra-large') + ' boxes.' : f.link === 'haul' ? 'Added when “Haul away the empty boxes” is on for the job.' : 'Chosen on the quote in Price Calc. It stays with the job that is created from the quote.')),
        !isNew && ui.section({ fold: false }, ui.row({ icon: 'arrow.up', iconPlain: true, title: 'Move up', tint: true, disabled: i <= 0, onTap: () => move(p, -1) }), ui.row({ icon: 'arrow.down', iconPlain: true, title: 'Move down', tint: true, disabled: i >= pp.lines.length - 1, onTap: () => move(p, 1) }),
          ui.row({ title: 'Delete line item', destructive: true, onTap: async () => { if (!await ui.actionSheet({ title: 'Delete “' + line.name + '”?', message: 'Jobs and invoices that already have it keep it.', buttons: [{ label: 'Delete', value: true, role: 'destructive' }] })) return; pp.lines.splice(pp.lines.indexOf(line), 1); WD.changed(); p.dismiss(); done && done(); } }))); } }, { detent: 'large' });
}
P.editLine = editLine;
/** “What that comes to”: rows of {label, total, how}. */
P.examples = () => { const pp = PP(), bin = pp.method === 'bin';
  const row = (p, label) => { const items = P.items(p); return { label, total: sum(items), how: P.lines(items).map(l => l.label + (/×/.test(l.label) || items.length === 1 ? '' : ' ' + cash(l.amount))).join(' + ') }; };
  return (bin ? [2, 3, 5].map(n => row({ bin65: n }, plural(n, 'bin'))) : []).concat([6, 14, 15, 20, 40].map(n => row({ std: n }, plural(n, 'box') + (bin ? ' → ' + plural(WD.purgeBins(n), 'bin') : ''))), bin ? [] : [row({ std: 12, legal: 4 }, '12 boxes + 4 legal')]); };
P.listSpec = () => ({ title: () => PP().name, render: page => { if (!admin()) return locked();
  const pp = PP(), R = data.purgeRules, bin = pp.method === 'bin', box = book('box'), u = unitWord(pp), re = () => { WD.syncPurgeBook(); WD.changed(); page.refresh(); if (page.setTitle) page.setTitle(pp.name); };
  const choice = (v, title, sub) => ui.row({ icon: pp.method === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: pp.method === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, onTap: () => { if (pp.method === v) return; pp.method = v; re(); ui.toast(v === 'bin' ? 'Priced by the bin' : 'Priced by the box', 'checkmark', 2200); } });
  return ui.list(
    ui.section({ header: 'Name', fold: false, footer: 'Shown as the title of this list, in Settings and on the Price Calc.' },
      ui.row({ icon: 'pencil', iconPlain: true, title: pp.name, detail: 'Rename', chevron: true, onTap: async () => { const v = RC.ask ? await RC.ask('Name of this price list', 'One-time shred pricing', pp.name) : null; if (v) { pp.name = v; re(); } } })),
    ui.section({ header: 'Priced', fold: false, footer: 'New purge jobs start from this price, and the invoice is written the same way.' },
      choice('box', 'By the box', 'A flat fee covers the first boxes, then a price for each box after'), choice('bin', 'By the 65-gallon bin', 'A flat fee covers the first bins, then a price for each bin after')),
    ui.section({ header: 'Base price', fold: false, showFooter: true, footer: cash(bin ? pp.binFlat : pp.boxFlat) + ' for up to ' + plural(bin ? pp.binIncluded : pp.boxIncluded, u) + ', then ' + cash(bin ? pp.binExtra : box ? box.rate : 8) + ' for each additional ' + u + '. Regular paper; the line items below cover everything else.' },
      inRow('Flat fee', 'Charged on every job', numIn('Flat fee', bin ? pp.binFlat : pp.boxFlat, v => { if (bin) pp.binFlat = v; else pp.boxFlat = v; re(); }, { pre: '$' })),
      inRow('Covers the first', bin ? '65-gallon bins' : 'Standard 10×12×15" boxes', numIn('Units covered', bin ? pp.binIncluded : pp.boxIncluded, v => { if (bin) pp.binIncluded = v; else pp.boxIncluded = v; re(); }, { whole: true, min: 0 })),
      inRow('Each additional ' + u, bin ? null : 'The same rate as “Purge, per box” in Items, services and fees', numIn('Each additional ' + u, bin ? pp.binExtra : box ? box.rate : 8, v => { if (bin) pp.binExtra = v; else if (box) box.rate = v; re(); }, { pre: '$' }))),
    ui.section({ header: 'Line items · ' + pp.lines.length, fold: false, footer: 'Anything that changes the price: other materials, access, distance, timing. Tap a line to change, move or delete it.' },
      pp.lines.map(l => ui.row({ title: l.name, subtitle: [P.lineSummary(l), l.note].filter(Boolean).map(x => h('div', x)), badge: l.active === false ? ui.badge('Off', 'var(--gray)') : null, chevron: true, onTap: () => editLine(l, () => page.refresh()) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a line item', tint: true, onTap: () => editLine(null, () => page.refresh()) })),
    R && ui.section({ header: 'Boxes in a 65-gallon bin', footer: 'How many standard boxes fit in one bin. It turns a box count into bins for pricing, and bins into boxes for the time on site.' },
      inRow('Boxes per bin', null, numIn('Boxes per bin', R.bin65, v => { R.bin65 = v; re(); }, { whole: true, min: 1 }))),
    ui.section({ header: 'What that comes to', fold: false }, h('table.pl-tab', h('tbody', P.examples().map(r => h('tr', h('td', r.label, h('small', r.how)), h('td.r', cash(r.total))))))),
    WD.r8 && WD.r8.repriceSection ? WD.r8.repriceSection(page) : null);
} });

/* ================= The customer at an address ================= */
const ABBR = { street: 'st', avenue: 'ave', boulevard: 'blvd', road: 'rd', drive: 'dr', lane: 'ln', court: 'ct', highway: 'hwy', parkway: 'pkwy', place: 'pl', square: 'sq', terrace: 'ter', circle: 'cir', north: 'n', south: 's', east: 'e', west: 'w' };
/** “1200 Harbor Street, Suite 4, Lakemont” and “1200 harbor st.” both become “1200 harbor st”. */
P.normAddr = a => String(a || '').toLowerCase().split(',')[0].replace(/#\s*\w+/g, ' ').replace(/\b(suite|ste|unit|apt|rm|room|bldg|building|floor|fl)\.?\s+\w+/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map(w => ABBR[w] || w).join(' ');
const LEAD = ['lead', 'contacted', 'quoted', 'lost'];
/** The customer or lead whose location is at this address → {customer, location, exact, lead} or null. */
P.findAt = text => { const n = P.normAddr(text); if (n.length < 5 || !/\d/.test(n) || !/[a-z]{2}/.test(n)) return null; let best = null;
  (data.customers || []).forEach(c => (c.locations || []).forEach(l => { const m = P.normAddr(l.address); if (!m || m === 'address to come') return; const exact = m === n, part = !exact && (m.startsWith(n + ' ') || n.startsWith(m + ' ') || (n.length >= 8 && m.startsWith(n)));
    if ((exact || part) && (!best || (exact && !best.exact))) best = { customer: c, location: l, exact, lead: LEAD.includes(c.lifecycle) }; }));
  return best; };
const invOpen = i => WD.invOpen ? WD.invOpen(i) : i.status !== 'Paid' && i.status !== 'Draft';
/** The customer's history at a glance, so the person quoting stays consistent with what this customer has been told before. */
P.customerCard = m => { const c = m.customer, l = m.location, st = c.stats || {}, today = D.today();
  const open = (data.invoices || []).filter(i => i.customerId === c.id && invOpen(i)), bal = open.reduce((s, i) => s + (+i.amount || 0), 0);
  const past = q.jobsForCustomer(c.id).filter(j => j.day <= today && !j.allDay).reverse().slice(0, 3), pc = (c.changes || []).filter(x => x.kind === 'price').sort((a, b) => b.at - a.at)[0];
  const fact = (k, v, color) => h('div', h('small', k), h('span', color ? { style: { color, fontWeight: 600 } } : null, v || '—'));
  const amount = j => j.invoice && j.invoice.amount != null ? j.invoice.amount : (j.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
  return ui.section({ header: m.lead ? 'Lead at this address' : 'Current customer at this address', fold: false, footer: m.lead ? 'Already in the CRM. Quote from the same record so nothing is entered twice.' : 'Quote the way this customer has been quoted before.' },
    ui.row({ leading: ui.avatar(c.name, { size: 36 }), title: c.name, subtitle: [(c.locations || []).length > 1 ? l.label : null, l.address].filter(Boolean).join(' · '), badge: m.lead ? ui.badge('Lead', 'var(--purple)') : null }),
    h('div.pl-facts', fact('Customer since', st.firstInvoice ? fmt.day(st.firstInvoice, 'md') + ', ' + st.firstInvoice.slice(0, 4) : m.lead ? 'Not a customer yet' : null),
      fact('Service', [c.freq, WD.itemsLabel(l.items) || l.containers].filter(Boolean).join(' · ')),
      fact('Last service', st.lastService ? fmt.day(st.lastService, 'md') + ', ' + st.lastService.slice(0, 4) : 'None yet'),
      fact('Open balance', bal > 0 ? fmt.money(bal, true) + ' · ' + plural(open.length, 'invoice') : 'Nothing owed', bal > 0 ? 'var(--red)' : null),
      fact('Last price change', pc ? (pc.item ? pc.item + ' ' : '') + cash(pc.from) + ' → ' + cash(pc.to) + ' · ' + fmt.day(pc.effective, 'md') + ', ' + pc.effective.slice(0, 4) : 'None on record'),
      fact('Lifetime', st.jobs ? plural(st.jobs, 'visit') + (st.invoiced ? ' · ' + fmt.money(st.invoiced) : '') : '—')),
    past.map(j => ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: fmt.day(j.day, 'short') + ' · ' + ((WD.jobStatuses || {})[j.status] && (WD.jobStatuses[j.status].label || WD.jobStatuses[j.status][0]) || j.status), subtitle: [q.routeName(j.routeId), WD.itemsLabel(j.items, j.type === 'purge')].filter(Boolean).join(' · '), detail: amount(j) ? fmt.money(amount(j)) : null, chevron: true, onTap: () => WD.screens.jobs && WD.screens.jobs.openDetails && WD.screens.jobs.openDetails(j.id) })),
    !past.length && ui.row({ title: 'No past jobs', subtitle: 'Nothing has been serviced at this address yet' }),
    ui.row({ title: m.lead ? 'Open the lead' : 'Open customer', tint: true, chevron: true, onTap: () => { if (m.lead && WD.screens.crm && WD.screens.crm.openLead) WD.screens.crm.openLead(c.id); else if (WD.screens.customers && WD.screens.customers.openDetail) WD.screens.customers.openDetail(c.id); } })); };

/* ================= Days a truck is already nearby ================= */
const MILE = 25;
/** Route capacity for a day, from AI Premium's load planning when it is there → {pct, level, text} or null. */
P.capacity = (routeId, day) => { try { return WD.aip && WD.aip.on() && WD.ops2 && WD.ops2.capacity ? WD.ops2.capacity(routeId, day) || null : null; } catch (e) { return null; } };
P.capChip = cap => cap ? h('span.pl-cap', { style: { background: cap.level === 'over' ? 'var(--red)' : cap.level === 'near' ? 'var(--orange)' : 'var(--green)' } }, cap.pct != null ? Math.round(cap.pct) + '% full' : cap.level === 'over' ? 'Over' : cap.level === 'near' ? 'Nearly full' : 'Has room') : null;
/** Upcoming route-days with stops near a spot → {radius (miles), list: [{day, routeId, n, closest, nearest, cap}]}. Widens the search until it finds a few. */
P.days = (spot, o = {}) => { const R8 = WD.r8, out = { radius: 0, list: [] }; if (!spot || !R8 || !R8.nearbyDays) return out;
  for (const r of [3, 5, 10, 25]) { out.radius = r; out.list = R8.nearbyDays(spot, r, o.days || 45); if (out.list.length >= 3) break; }
  out.list.forEach(d => { d.cap = P.capacity(d.routeId, d.day); d.key = d.routeId + '|' + d.day; }); return out; };
/* Standing guidance for the AI pick. Stops far from the shop are kept for the middle of the week, when a late finish hurts least. */
const FIT = () => data.priceFit || (data.priceFit = { midweek: true, farMiles: 18 });
/** AI Premium “Best fit”: the route and day to offer, and why → {pick, lines} or null. */
P.bestFit = (list, spot) => { if (!list || !list.length || !spot) return null; const F = FIT(), dp = data.depot || { x: 500, y: 500 }, fromShop = Math.hypot(spot.x - dp.x, spot.y - dp.y) / MILE, far = F.midweek && fromShop > F.farMiles, today = D.today();
  const mid = d => [2, 3, 4].includes(D.parse(d.day).getDay()), lvl = d => d.cap ? d.cap.level : 'ok';
  const score = d => d.closest * 2 - Math.min(d.n, 4) * 0.5 + (lvl(d) === 'over' ? 60 : lvl(d) === 'near' ? 6 : 0) + (far && !mid(d) ? 4 : 0) + D.diff(d.day, today) * 0.06;
  const pick = list.slice().sort((a, b) => score(a) - score(b))[0], sooner = list.find(d => d.day < pick.day), full = list.filter(d => d !== pick && lvl(d) === 'over' && d.day < pick.day)[0];
  const lines = [h('span', h('b', 'Closest existing stop: ' + pick.nearest + '.'), ' ' + fmt.dist(pick.closest) + ' away, with ' + plural(pick.n, 'stop') + ' nearby that day.'),
    pick.cap ? h('span', h('b', q.routeName(pick.routeId) + (lvl(pick) === 'ok' ? ' has room.' : lvl(pick) === 'near' ? ' is nearly full.' : ' is over capacity.')), pick.cap.text ? ' ' + pick.cap.text : '') : null,
    far ? h('span', h('b', 'Far from the shop (' + fmt.dist(fromShop) + ').'), mid(pick) ? ' Your guidance keeps far stops midweek, and this is a ' + fmt.day(pick.day, 'weekday') + '.' : ' Your guidance prefers midweek for far stops, but no midweek day has a truck this close.') : null,
    full ? h('span', 'Skipped ' + fmt.day(full.day, 'weekday') + ' ' + fmt.day(full.day, 'md') + ': ' + q.routeName(full.routeId) + ' is over capacity.') : sooner && !full ? h('span', 'An earlier day (' + fmt.day(sooner.day, 'weekday') + ' ' + fmt.day(sooner.day, 'md') + ') is possible but means ' + fmt.dist(sooner.closest) + ' of extra driving each way.') : null].filter(Boolean);
  return { pick, lines }; };
P.fitSpec = () => ({ title: 'Best-fit dates', render: page => { const F = FIT(), re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('When the Price Calc suggests a route and a day for a new address, it follows this guidance.'),
    ui.section({ header: 'Standing guidance', fold: false, footer: F.midweek ? 'An address more than ' + F.farMiles + ' miles from the shop is offered Tuesday to Thursday when a truck is nearby on one of those days.' : 'The closest truck wins, whatever the day.' },
      ui.toggleRow({ title: 'Keep far-from-shop stops midweek', subtitle: 'Tuesday, Wednesday and Thursday', value: !!F.midweek, onChange: v => { F.midweek = v; re(); } }),
      F.midweek && inRow('Far means more than', 'Miles from the shop', numIn('Miles', F.farMiles, v => { F.farMiles = v; re(); }, { whole: true, min: 1 })))); } });

/* ================= Registration ================= */
try { PP(); } catch (e) { console.error(e); }
if (WD.aip && WD.aip.feature) WD.aip.feature('Best-fit service date', 'Price Calc, under the address', 'Picks the route and the day to offer for a new address: the closest existing stop, a route with room, and your standing guidance such as far stops midweek.');
if (WD.r14 && WD.r14.addSetting) {
  WD.r14.addSetting('AI Premium', (push, gated) => WD.r14.link(push, gated, 'settings.manage', 'calendar', 'var(--purple)', 'Best-fit dates', 'Guidance the Price Calc follows when it picks a route and day', P.fitSpec, FIT().midweek ? 'Far stops midweek' : 'Closest truck'));
  WD.r14.addSetting('Jobs', (push, gated) => WD.r14.link(push, gated, 'settings.manage', 'shippingbox', 'var(--orange)', PP().name, P.label() + ' · ' + plural(P.activeLines().length, 'line item'), P.listSpec));
}
if (WD.panel) WD.panel.addJump('Purge price list', () => { WD.nav.switchTab('settings'); WD.nav.push(P.listSpec()); });
})();
