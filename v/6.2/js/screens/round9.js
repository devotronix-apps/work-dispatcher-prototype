/* Round 9 additions (prototype 2.8). Registers WD.r9:
   editing an invoice after it was created (lines, service date, PO, pounds, send-to; a reason is required and every change is kept),
   moving several selected jobs to another route, day or both (Dispatch menu → Select jobs to move), and sales tax
   (Business details → Apply tax to invoices; off by default; one or more taxes, each applied to chosen services and products).
   Also the shared tests for invoices that are no longer owed (WD.invClosed / WD.invOpen: bad debt and void). The 50-mile distance and address suggestions on the 45-day map are in round8.js. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You', admin = () => WD.can('settings.manage');
const plural = (n, w) => n + ' ' + (n === 1 ? w : w === 'box' ? 'boxes' : w + 's');
const B = () => WD.screens.billing, money = n => fmt.money(n, true);
const R9 = WD.r9 = {};

WD.addIcons({ percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="17" r="2.6"/>', briefcase: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M9 7.500V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.500M3 13h18"/>' });
WD.css(`
.bd-selbar { flex: none; display: flex; align-items: center; gap: 4px; padding: 7px 8px; background: var(--cell); border-top: .5px solid var(--sep); font-size: 15px; }
.bd-selbar button { border: 0; background: none; color: var(--tint); font: inherit; padding: 7px 8px; border-radius: 9px; cursor: pointer; white-space: nowrap; } .bd-selbar button:disabled { opacity: .4; }
.bd-selbar .n { flex: 1; text-align: center; font-weight: 600; font-size: 14px; color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bd-selbar .go { background: var(--tint); color: #fff; font-weight: 600; padding: 7px 14px; }
.bd-check { position: absolute; top: -4px; right: -3px; width: 19px; height: 19px; border-radius: 50%; background: var(--cell); box-shadow: inset 0 0 0 1.5px var(--label3), 0 1px 2px rgba(0,0,0,.25); display: grid; place-items: center; color: transparent; z-index: 2; pointer-events: none; }
.bd-job.sel .bd-check { background: var(--tint); box-shadow: 0 1px 2px rgba(0,0,0,.25); color: #fff; } .bd-job.sel .bd-job-in { outline: 2.5px solid var(--tint); outline-offset: 1px; }
.selecting .bd-job:not(.sel) .bd-job-in { opacity: .8; }
.r9-was { padding: 0 16px 10px; text-align: right; font-size: 13px; color: var(--label2); margin-top: -6px; }
.r9-chg { font-size: 13px; line-height: 18px; color: var(--label2); } .r9-chg b { color: var(--label); font-weight: 600; }
.r9-date { display: flex; align-items: center; gap: 8px; }
`);

/* ================= Invoices that are no longer owed ================= */
/** Written off as bad debt, or voided: neither counts as money owed anywhere (accounts receivable, past due, statements, warnings). */
WD.INV_BAD = 'Bad debt'; WD.INV_VOID = 'Void';
WD.invClosed = i => !!i && (i.status === WD.INV_BAD || i.status === WD.INV_VOID);
/** Sent and still owed: not paid, not a draft, not written off and not voided. */
WD.invOpen = i => !!i && i.status !== 'Paid' && i.status !== 'Draft' && !WD.invClosed(i);
/** The stamp printed across an invoice document that is no longer owed. */
WD.invStamp = i => !i ? null : i.status === WD.INV_VOID ? 'VOID' : i.status === WD.INV_BAD ? 'BAD DEBT' : null;

/* ================= Sales tax ================= */
/* One or more taxes. Each has its own rate and its own list of what it applies to, in two categories: services (the price book) and products.
   `svcOn` / `prodOn` switch a whole category; `off[id]` leaves one item out of a category that is on. Exemptions apply to every tax. */
data.tax = { on: false, exemptGov: true, exemptCustomers: [], types: [{ id: 'tx1', name: 'Sales tax', rate: 8.25, on: true, svcOn: true, prodOn: true, off: { cod: true } }] };
/* Older callers read data.tax.name / .rate / .exemptItems: they see the first tax. */
['name', 'rate'].forEach(k => Object.defineProperty(data.tax, k, { enumerable: true, get: () => (data.tax.types[0] || { name: 'Sales tax', rate: 0 })[k], set: v => { if (data.tax.types[0]) data.tax.types[0][k] = v; } }));
Object.defineProperty(data.tax, 'exemptItems', { enumerable: false, get: () => (data.tax.types[0] || { off: {} }).off });
const cents = n => Math.round(n * 100) / 100;
const isProduct = id => !!id && (data.products || []).some(x => x.id === id);
const taxedBy = (t, l) => (isProduct(l.id) ? t.prodOn : t.svcOn) && !(l.id && t.off[l.id]);
const taxableFor = (t, lines) => lines.reduce((s, l) => s + (taxedBy(t, l) ? (+l.qty || 0) * (+l.rate || 0) : 0), 0);
const taxLbl = t => t.name + ' (' + t.rate + '%)', activeTaxes = () => data.tax.types.filter(t => t.on);
const exempt = c => !!c && (data.tax.exemptCustomers.includes(c.id) || (data.tax.exemptGov && c.custType === 'government'));
/** Tax for a set of invoice lines and a customer → { tax, rate, label, taxes: [{id, name, rate, amount, label}] }. `tax` is the total of every tax that applies,
    `rate` the sum of their rates, `label` their names. Zero (and no `taxes`) when tax is off or the customer is exempt. */
WD.taxInfo = (lines, cust) => { const T = data.tax, act = activeTaxes(), list = T.on && !exempt(cust) ? act.map(t => ({ id: t.id, name: t.name, rate: t.rate, amount: cents(taxableFor(t, lines) * t.rate / 100), label: taxLbl(t) })) : [];
  return { rate: cents(list.reduce((s, t) => s + t.rate, 0)), tax: cents(list.reduce((s, t) => s + t.amount, 0)), label: act.length ? act.map(taxLbl).join(' + ') : 'Sales tax', taxes: list }; };
R9.taxLabel = () => { const act = activeTaxes(); return !data.tax.on || !act.length ? 'Off' : act.length === 1 ? act[0].rate + '% · ' + act[0].name : act.length + ' taxes · ' + act.map(t => t.rate + '%').join(' + '); };
const pctInput = (t, re) => h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': 'Tax rate', value: t.rate + '%', onfocus: e => e.target.select(), onchange: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); if (!isNaN(v) && v <= 30) t.rate = v; re(); } });
const catSummary = (t, on, items, word) => { const n = items.filter(x => !t.off[x.id]).length; return !on ? 'no ' + word + 's' : n === items.length ? 'all ' + word + 's' : n + ' of ' + plural(items.length, word); };
const taxSummary = t => t.rate + '% · ' + catSummary(t, t.svcOn, data.priceBook, 'service') + ', ' + catSummary(t, t.prodOn, data.products || [], 'product');
/** One tax: its name and rate, and what it applies to in two categories, each with a switch for the whole category and one per item. */
const taxTypeSpec = t => ({ title: t.name, render: page => { const T = data.tax, re = () => { WD.changed(); page.refresh(); };
  const cat = (header, key, items, word) => { const n = items.filter(x => !t.off[x.id]).length;
    return ui.section({ header: header + ' · ' + (t[key] ? n + ' of ' + items.length + ' taxed' : 'not taxed'), fold: false, footer: t[key] ? 'Switch off any ' + word + ' this tax doesn’t apply to. ' + (word === 'service' ? 'Services' : 'Products') + ' you add later are taxed unless you switch them off here.' : 'No ' + word + ' is charged this tax.' },
      ui.toggleRow({ title: h('b', 'Tax all ' + word + 's'), subtitle: t[key] ? (n === items.length ? 'Every ' + word + ' is taxed' : plural(items.length - n, word) + ' left out below') : 'Off for the whole category', value: t[key], onChange: v => { t[key] = v; if (v) items.forEach(x => { delete t.off[x.id]; }); re(); } }),
      t[key] && items.map(x => ui.toggleRow({ title: x.name, subtitle: money(x.rate) + ' per ' + x.unit, value: !t.off[x.id], onChange: v => { if (v) delete t.off[x.id]; else t.off[x.id] = true; re(); } }))); };
  const sample = [{ id: 'console', qty: 2, rate: 30 }, { id: 'trip', qty: 1, rate: 25 }];
  return ui.list(
    ui.section({ header: 'Name and rate', fold: false, footer: 'For example 2 consoles at $30 and a $25 trip charge: ' + money(taxableFor(t, sample)) + ' taxable → ' + money(cents(taxableFor(t, sample) * t.rate / 100)) + ' of ' + t.name.toLowerCase() + '.' },
      ui.inputRow({ label: 'Name on the invoice', value: t.name, placeholder: 'Sales tax', onInput: v => { t.name = v.trim() || 'Sales tax'; page.setTitle(t.name); } }),
      h('div.row', h('div.row-main', h('div.row-title', 'Rate'), h('div.row-sub', 'Percent of the taxed lines')), pctInput(t, re)),
      ui.toggleRow({ title: 'Charge this tax', subtitle: t.on ? null : 'Off: kept here, not added to invoices', value: t.on, onChange: v => { t.on = v; re(); } })),
    cat('Services', 'svcOn', data.priceBook, 'service'), cat('Products', 'prodOn', data.products || [], 'product'),
    T.types.length > 1 && ui.section({ fold: false, footer: 'Invoices already created keep the tax they were created with.' }, ui.row({ title: 'Delete this tax', destructive: true, onTap: async () => {
      if (await ui.actionSheet({ title: 'Delete “' + t.name + '”?', message: 'It stops being added to new invoices.', buttons: [{ label: 'Delete tax', value: true, role: 'destructive' }] })) { T.types.splice(T.types.indexOf(t), 1); WD.changed(); page.pop(); } } })));
} });
R9.taxSpec = () => ({ title: 'Rate, what is taxed and exemptions', render: page => { if (!admin()) return ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'This needs the Company settings permission.' });
  const T = data.tax, re = () => { WD.changed(); page.refresh(); }, others = data.customers.filter(c => !T.exemptCustomers.includes(c.id) && !['lead', 'contacted', 'quoted', 'lost'].includes(c.lifecycle)).sort((a, b) => a.name.localeCompare(b.name));
  return ui.list(
    ui.section({ fold: false, footer: T.on ? 'Each tax is added to new invoices as its own line above the total, and prints on the invoice. Invoices already created keep the tax they were created with.' : 'Off: invoices have no tax line. Turn this on if what you sell or the services you perform are taxed where you work.' },
      ui.toggleRow({ icon: 'percent', iconColor: 'var(--red)', title: 'Apply tax to invoices', value: T.on, onChange: v => { T.on = v; re(); } })),
    T.on && ui.section({ header: 'Taxes · ' + T.types.length, fold: false, footer: 'Tap a tax for its rate and what it applies to: services and products each have a switch for the whole category and one for every item. Add another tax when a different rate applies to different services or products, such as a county tax on products only.' },
      T.types.map(t => ui.row({ icon: 'percent', iconColor: t.on ? 'var(--red)' : 'var(--gray)', title: t.name, subtitle: taxSummary(t), badge: t.on ? null : ui.badge('Off', 'var(--gray)'), chevron: true, onTap: () => page.push(taxTypeSpec(t)) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a tax', tint: true, onTap: async () => {
        const r = await ui.alert({ title: 'New tax', message: 'For example “County tax” or “Product sales tax”. You choose its rate and what it applies to next.', input: { placeholder: 'Name on the invoice' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] }); if (!r || !r.value || !r.text.trim()) return;
        const t = { id: 'tx' + Date.now().toString(36), name: r.text.trim(), rate: 1, on: true, svcOn: false, prodOn: true, off: {} }; T.types.push(t); WD.changed(); page.push(taxTypeSpec(t)); } })),
    T.on && ui.section({ header: 'Tax-exempt customers', footer: 'Exempt customers are never charged any tax. Keep their exemption certificate in the customer’s documents.' },
      ui.toggleRow({ title: 'Government customers are exempt', value: T.exemptGov, onChange: v => { T.exemptGov = v; re(); } }),
      T.exemptCustomers.map(id => q.customer(id)).filter(Boolean).map(c => ui.row({ title: c.name, trailing: h('button.cu-link', { onclick: () => { T.exemptCustomers = T.exemptCustomers.filter(x => x !== c.id); re(); } }, 'Remove') })),
      ui.pickerRow({ title: 'Add a customer', value: '', options: [{ value: '', label: 'Choose…' }].concat(others.map(c => ({ value: c.id, label: c.name }))), onChange: v => { if (v) { T.exemptCustomers.push(v); re(); } } })),
    T.on && h('div', { style: 'padding:10px 4px 0' }, ui.note('Prototype: tax isn’t added to the monthly master invoice yet.')));
} });

/* ================= Editing an invoice after it was created ================= */
const lineKey = l => (l.id || '') + '|' + (l.name || '');
const lineText = l => (+l.qty || 0) + ' × ' + money(+l.rate || 0);
/** What changed between two sets of lines, in words. */
function lineChanges(a, b) {
  const out = [], left = a.slice();
  b.forEach(l => { let i = left.findIndex(x => lineKey(x) === lineKey(l)); if (i < 0) i = left.findIndex(x => x.id && x.id === l.id); if (i < 0) return out.push('Added ' + l.name + ' · ' + lineText(l));
    const o = left.splice(i, 1)[0]; if (o.name !== l.name) out.push('“' + o.name + '” renamed “' + l.name + '”'); if ((+o.qty || 0) !== (+l.qty || 0) || (+o.rate || 0) !== (+l.rate || 0)) out.push(l.name + ': ' + lineText(o) + ' → ' + lineText(l)); });
  left.forEach(o => out.push('Removed ' + o.name + ' · ' + lineText(o)));
  return out;
}
/** The “Edit invoice…” row, shown wherever an invoice’s actions are. Master invoices are corrected through their service notes. */
R9.editRow = (rec, job) => { const inv = job && job.invoice, status = rec ? rec.status : inv && inv.status;
  if (WD.invClosed && WD.invClosed(rec || inv)) return null;   // a voided or written-off invoice is reopened before it can be changed
  if (!status || status === 'Draft' || (rec && rec.master) || !B().canInvoice()) return null;
  return ui.row({ title: 'Edit invoice…', subtitle: status === 'Paid' ? 'Fix a mistake · this invoice is already paid' : 'Fix a mistake: lines, quantities, prices, date, PO', icon: 'pencil', iconPlain: true, tint: true, onTap: () => R9.editInvoice(rec, job) }); };
R9.editInvoice = (rec, job) => {
  job = job || (rec && rec.jobId && q.job(rec.jobId)) || null; const inv = job && job.invoice; if (!rec && !inv) return;
  if (!rec && WD.workflow) rec = WD.workflow.invRecFor(job) || null;
  const cust = q.customer(rec ? rec.customerId : job.customerId), number = rec ? rec.number : inv.number, status = rec ? rec.status : inv.status, holder = rec || inv;
  if (status === 'Paid' && !WD.can('billing.manage')) return ui.alert({ title: number + ' is already paid', message: 'Changing a paid invoice needs the Manage billing permission. Ask the office to correct it.' });
  if (job && job.pending) return ui.toast('This job is still syncing. Try again in a moment.', 'sync');
  const src = (rec && rec.lines) || (inv && inv.lines) || (rec && WD.screens.customers.invLines ? WD.screens.customers.invLines(rec) : job ? B().linesForJob(job) : []);
  const was = { lines: src.map(l => ({ ...l })), amount: rec ? rec.amount : inv.amount, po: (inv && inv.po) || (rec && rec.po) || '', serviceDate: (inv && inv.serviceDate) || (job && job.day) || rec.day, pounds: (inv && inv.pounds) || '', billTo: (inv && inv.billTo) || (cust && (cust.billingEmail || (cust.contacts[0] || {}).email)) || '' };
  /* An invoice keeps the tax rate it was created with; one created without tax stays without. */
  const th = inv && inv.tax > 0 ? inv : holder, kept = th && th.tax > 0 ? (th.taxes && th.taxes.length ? th.taxes : [{ id: (data.tax.types[0] || {}).id, name: th.taxLabel || 'Sales tax', label: th.taxLabel || 'Sales tax', rate: th.taxRate || (was.amount > th.tax ? cents(th.tax / (was.amount - th.tax) * 100) : 0) }]) : [], taxDef = id => data.tax.types.find(t => t.id === id) || data.tax.types[0];
  const taxesOf = lines => kept.map(k => ({ ...k, amount: cents((taxDef(k.id) ? taxableFor(taxDef(k.id), lines) : lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0)) * k.rate / 100) })), taxOf = lines => cents(taxesOf(lines).reduce((s, t) => s + t.amount, 0)), rate = kept.length;
  const sum = lines => cents(lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0) + taxOf(lines));
  const f = { lines: was.lines.map(l => ({ ...l })), po: was.po, serviceDate: was.serviceDate, pounds: was.pounds, billTo: was.billTo, reason: '', resend: true };
  const changes = () => { const out = lineChanges(was.lines, f.lines);
    if (f.serviceDate !== was.serviceDate) out.push('Service date: ' + fmt.day(was.serviceDate, 'md') + ' → ' + fmt.day(f.serviceDate, 'md'));
    if (f.po.trim() !== was.po) out.push('PO: ' + (was.po || 'none') + ' → ' + (f.po.trim() || 'none'));
    if (String(f.pounds || '') !== String(was.pounds || '')) out.push('Pounds: ' + (was.pounds || 'none') + ' → ' + (f.pounds || 'none'));
    if (f.billTo.trim() !== was.billTo) out.push('Sent to: ' + (f.billTo.trim() || 'no one'));
    return out; };
  let totalEl = null, wasEl = null;
  const syncTotal = () => { const t = sum(f.lines); if (totalEl) totalEl.textContent = money(t); if (wasEl) { wasEl.textContent = t !== was.amount ? 'Was ' + money(was.amount) + ' · ' + (t > was.amount ? '+' : '−') + money(Math.abs(t - was.amount)) : ''; wasEl.style.display = t !== was.amount ? '' : 'none'; } };
  function lineRow(l, i, p) {
    const tot = h('span.bi-tot', money(l.qty * l.rate));
    const num = (k, cls) => h('input.n.' + cls, { type: 'text', inputmode: 'decimal', value: String(l[k]), 'aria-label': k === 'qty' ? 'Quantity' : 'Rate', oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); l[k] = isNaN(v) ? 0 : v; tot.textContent = money(l.qty * l.rate); syncTotal(); } });
    return h('div.bi-line', h('div.bi-name', h('input', { type: 'text', value: l.name, 'aria-label': 'Description', oninput: e => { l.name = e.target.value; } }),
      h('button.bi-del', { 'aria-label': 'Delete line', onclick: () => { f.lines.splice(i, 1); p.refresh(); } }, icon('bi.minus', 22))),
      h('div.bi-nums', h('span.bi-lab', 'Qty'), num('qty', 'q'), h('span.bi-lab', '× $'), num('rate', 'r'), tot));
  }
  const addLine = (el, p) => ui.menu(el, [{ header: 'Add a charge' }, ...data.priceBook.map(x => ({ label: x.name, subtitle: money(x.rate), onTap: () => { f.lines.push({ id: x.id, name: x.name, qty: 1, rate: x.rate }); p.refresh(); } })),
    'divider', { label: 'Custom charge or credit…', icon: 'plus', onTap: async () => { const r = await ui.alert({ title: 'Custom line', message: 'Use a negative rate for a credit.', input: { placeholder: 'Description, e.g. Billing correction' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] }); if (r && r.value && r.text.trim()) { f.lines.push({ name: r.text.trim(), qty: 1, rate: 0 }); p.refresh(); } } }]);
  async function save(p) {
    const ch = changes(), amount = sum(f.lines), delta = cents(amount - was.amount), reason = f.reason.trim();
    if (!ch.length) return ui.toast('Nothing was changed', 'info.circle');
    if (!f.lines.length) return ui.alert({ title: 'No charges', message: 'Keep at least one line, even if it’s $0.' });
    if (!reason) return ui.toast('Say why the invoice is being changed', 'pencil', 2400);
    if (status === 'Paid' && delta !== 0 && !(await ui.actionSheet({ title: number + ' is already paid', message: delta > 0 ? 'The total goes up by ' + money(delta) + '. The invoice reopens with that balance due.' : 'The total goes down by ' + money(-delta) + '. The customer is owed a credit or refund for that amount.', buttons: [{ label: 'Save the correction', value: true }] }))) return;
    const resent = f.resend && !!f.billTo.trim(), at = +WD.now(), who = me();
    const apply = () => {
      const lines = f.lines.map(l => ({ ...l })), c = cust;
      if (inv) { Object.assign(inv, { lines, amount, tax: taxOf(lines), taxes: kept.length ? taxesOf(lines) : inv.taxes, po: f.po.trim(), serviceDate: f.serviceDate, pounds: f.pounds || null, billTo: f.billTo.trim(), revisedAt: at }); job.po = f.po.trim(); }
      if (rec) Object.assign(rec, { lines, amount, po: f.po.trim(), revisedAt: at }, kept.length ? { tax: taxOf(lines), taxes: taxesOf(lines) } : null);
      (holder.revisions = holder.revisions || []).unshift({ at, by: who, reason, from: was.amount, to: amount, changes: ch, resent: resent ? f.billTo.trim() : null });
      if (c && c.stats) { c.stats.invoiced = Math.max(0, c.stats.invoiced + delta); if (status === 'Overdue') c.stats.balance = Math.max(0, c.stats.balance + delta); }
      if (status === 'Paid' && delta > 0) { holder.balanceDue = cents((holder.balanceDue || 0) + delta); holder.credit = 0; if (rec) rec.status = 'Sent'; if (inv) inv.status = 'Sent'; }
      if (status === 'Paid' && delta < 0) holder.credit = cents((holder.credit || 0) - delta);
      if (job) job.events.push({ at, actor: who, text: 'Invoice ' + number + ' corrected' + (delta ? ' · ' + money(was.amount) + ' → ' + money(amount) : '') + ' · ' + reason + (resent ? ' · corrected copy sent to ' + f.billTo.trim() : '') });
      if (resent && data.interactions && c) data.interactions.push({ id: 'i-fix' + at, customerId: c.id, type: 'email', dir: 'out', at, subject: 'Corrected invoice ' + number, snippet: 'Please use this corrected copy of invoice ' + number + ' in place of the earlier one. The total is ' + money(amount) + '.', from: 'billing@discountshred.example', to: f.billTo.trim() });
    };
    if (job) api.op({ kind: 'edit', title: job.title, scope: 'Invoice ' + number + ' corrected', jobIds: [job.id], apply });
    else if (!(await ui.run('Saving the correction…', apply, { done: 'Invoice updated' }))) return;
    WD.changed(); p.dismiss(); ui.toast(number + ' corrected' + (resent ? ' · sent to ' + f.billTo.trim() : ''), 'checkmark', 2800);
  }
  ui.sheet({ title: 'Edit ' + number, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: () => [{ label: 'Save', bold: true, onTap: p => save(p) }],
    render(p) { const books = WD.co && WD.co.booksName && WD.co.booksName(), t = sum(f.lines);
      return ui.list(
        h('div', { style: 'padding:4px 4px 0' }, ui.note(number + ' keeps its number. The change is saved with your name, the time and the reason, and the invoice shows the date it was revised.' + (status === 'Paid' ? ' This invoice is already paid, so changing the total leaves a balance due or a credit.' : ''))),
        ui.section({ header: (cust ? cust.name : job ? job.title : 'Invoice') + ' · issued ' + fmt.day(rec ? rec.day : job.day, 'md'), footer: 'Change a quantity or price, rename or delete a line, or add one.' },
          f.lines.map((l, i) => lineRow(l, i, p)),
          ui.row({ title: 'Add line', icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', tint: true, onTap: (e, el) => addLine(el, p) }),
          rate > 0 && taxesOf(f.lines).map(t => h('div.bi-total', { style: 'font-weight:400;font-size:15px;padding-bottom:0' }, h('span', t.label || t.name || 'Sales tax'), h('span', money(t.amount)))),
          h('div.bi-total', h('span', 'Total'), totalEl = h('span', money(t))),
          wasEl = h('div.r9-was', { style: { display: t !== was.amount ? '' : 'none' } }, t !== was.amount ? 'Was ' + money(was.amount) + ' · ' + (t > was.amount ? '+' : '−') + money(Math.abs(t - was.amount)) : '')),
        ui.section('Details',
          job && ui.dateRow({ title: 'Service date', icon: 'calendar', iconColor: 'var(--red)', value: f.serviceDate, onChange: v => { f.serviceDate = v; } }),
          job && ui.inputRow({ label: 'Pounds', placeholder: 'None', inputmode: 'numeric', value: String(f.pounds || ''), onInput: v => { f.pounds = parseInt(v.replace(/\D/g, ''), 10) || ''; } }),
          ui.inputRow({ label: 'PO number', placeholder: 'None', value: f.po, onInput: v => { f.po = v; } }),
          ui.inputRow({ label: 'Send to', type: 'email', caps: 'off', placeholder: 'Billing email', value: f.billTo, onInput: v => { f.billTo = v; } })),
        ui.section({ header: 'Why is it changing?', footer: 'Required. It’s kept with the invoice so anyone can see what was fixed and why.' },
          ui.inputRow({ placeholder: 'e.g. Billed 3 consoles, only 2 were serviced', value: f.reason, required: true, onInput: v => { f.reason = v; } }),
          h('div.hstack', { style: 'gap:6px;flex-wrap:wrap;padding:8px 16px 10px' }, ['Wrong quantity', 'Wrong price', 'Missing charge', 'Wrong PO', 'Wrong date'].map(x => h('button.cu-link', { style: 'background:var(--fill3);border-radius:8px;padding:4px 9px', onclick: () => { f.reason = x; p.refresh(); } }, x)))),
        ui.section({ footer: books ? 'The invoice is updated in ' + books + ' as well, so the two always match.' : null },
          ui.toggleRow({ title: 'Email the corrected invoice', subtitle: f.billTo.trim() ? 'To ' + f.billTo.trim() + ', marked as a corrected copy' : 'No billing email on this invoice', value: f.resend, onChange: v => { f.resend = v; } })),
        R9.revisionSection(holder));
    } }, { detent: 'large' });
};
/** Every correction made to an invoice, newest first, plus any balance or credit a correction left on a paid invoice. */
R9.revisionSection = holder => { const list = (holder && holder.revisions) || []; if (!list.length) return null;
  return ui.section({ header: 'Corrections · ' + list.length, footer: 'Changes made after the invoice was created. The invoice number never changes.' },
    holder.balanceDue > 0 && holder.status !== 'Paid' && ui.row({ icon: 'exclamationmark.circle', iconPlain: true, iconColor: 'var(--orange)', title: 'Balance due after a correction', detail: money(holder.balanceDue) }),
    holder.credit > 0 && ui.row({ icon: 'dollarsign.circle', iconPlain: true, iconColor: 'var(--green)', title: 'Credit owed to the customer', subtitle: 'Refund it or apply it to the next invoice', detail: money(holder.credit) }),
    list.map(r => h('div.row', h('div.row-main', h('div.row-title', r.from !== r.to ? money(r.from) + ' → ' + money(r.to) : 'Details corrected'),
      h('div.r9-chg', h('div', h('b', r.reason)), r.changes.map(x => h('div', x)), h('div', r.by + ' · ' + fmt.rel(new Date(r.at)) + (r.resent ? ' · corrected copy sent to ' + r.resent : '')))))));
};

/* ================= Moving several selected jobs to another route, day or both ================= */
R9.batchMove = (ids, done) => {
  const jobs = ids.map(id => q.job(id)).filter(j => j && j.status === 'scheduled' && !j.pending); if (!jobs.length) return ui.toast('Select at least one job', 'info.circle');
  const f = { routeId: '', day: '' }, n = jobs.length;
  const dest = j => ({ routeId: f.routeId || j.routeId, day: f.day || j.day }), stays = j => { const d = dest(j); return d.routeId === j.routeId && d.day === j.day; }, moving = () => jobs.filter(j => !stays(j));
  const groups = () => { const m = new Map(); moving().forEach(j => { const k = j.routeId + '|' + j.day, d = dest(j); (m.get(k) || m.set(k, { routeId: j.routeId, from: j.day, to: d.day, toRoute: d.routeId, jobs: [] }).get(k)).jobs.push(j); }); return [...m.values()]; };
  const fromRoutes = [...new Set(jobs.map(j => j.routeId))], fromDays = [...new Set(jobs.map(j => j.day))].sort();
  const live = (rid, day) => q.stopList(rid, day).filter(j => !WD.calledOff(j)).length;
  async function go(p) {
    const ms = groups(), k = moving().length; if (!k) return ui.toast('Choose a route or a day to move to', 'info.circle');
    const warn = [...new Set(ms.map(m => m.toRoute + '|' + m.to))].map(key => { const [rid, day] = key.split('|'), mark = WD.dayMark && WD.dayMark(rid, day), off = WD.offOn && WD.offOn((q.route(rid) || {}).driverId, day); return mark && mark.kind !== 'purgeOnly' ? fmt.day(day) + ' is marked “' + mark.label + '”' : off ? (q.user(off.userId) || { name: 'The driver' }).name + ' has time off on ' + fmt.day(day) : null; }).filter(Boolean);
    if (warn.length && !(await ui.actionSheet({ title: warn[0], message: warn.slice(1).join('\n') || null, buttons: [{ label: 'Move them there anyway', value: true }], cancel: 'Go back' }))) return;
    p.dismiss(); const where = [f.routeId && q.routeName(f.routeId), f.day && fmt.day(f.day)].filter(Boolean).join(' · ');
    WD.ops.applyMoves(ms, { title: plural(k, 'job') + ' → ' + where, reason: 'a schedule change', batch: true }); done && done();
  }
  ui.sheet({ title: 'Move ' + plural(n, 'job'), leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: () => [{ label: 'Move', bold: true, disabled: !moving().length, onTap: go }],
    render(p) { const k = moving().length, targets = [...new Set(moving().map(j => { const d = dest(j); return d.routeId + '|' + d.day; }))].sort();
      const dateIn = h('input.pill-input', { type: 'date', value: f.day, min: today(), 'aria-label': 'Day to move to', onchange: e => { const v = e.target.value; if (v && v < today()) return ui.toast('Pick today or a later day', 'calendar'); f.day = v || ''; p.refresh(); } });
      return ui.list(
        h('div', { style: 'padding:4px 4px 0' }, ui.note(plural(n, 'job') + ' selected, from ' + fromRoutes.map(r => q.routeName(r)).join(', ') + ' on ' + (fromDays.length > 3 ? plural(fromDays.length, 'day') : fromDays.map(d => fmt.day(d, 'md')).join(', ')) + '. Choose a route, a day, or both.')),
        ui.section({ header: 'Move to', footer: 'Leave one as it is to change only the other. All the jobs move together: if one can’t be saved, none are moved.' },
          ui.pickerRow({ icon: 'route', iconColor: f.routeId ? q.routeColor(f.routeId) : 'var(--gray)', title: 'Route', value: f.routeId, options: [{ value: '', label: 'Keep each job’s route' }].concat(q.routes().map(r => ({ value: r.id, label: q.routeName(r) }))), onChange: v => { f.routeId = v; p.refresh(); } }),
          ui.row({ icon: 'calendar', iconColor: 'var(--red)', title: 'Day', subtitle: f.day ? fmt.day(f.day, 'long') : 'Keep each job’s day', trailing: h('div.r9-date', f.day && h('button.cu-link', { onclick: () => { f.day = ''; p.refresh(); } }, 'Clear'), dateIn) })),
        k > 0 && ui.section({ header: 'After the move', footer: 'Moved jobs go to the end of each list, so run AutoRoute there afterward. A recurring job moves for this visit only.' },
          targets.map(key => { const [rid, day] = key.split('|'), add = moving().filter(j => { const d = dest(j); return d.routeId === rid && d.day === day; }).length, now = live(rid, day), drv = q.driverFor(rid);
            return ui.row({ leading: ui.dot(q.routeColor(rid)), title: q.routeName(rid) + ' · ' + fmt.day(day), subtitle: (drv ? drv.name + ' · ' : '') + plural(now, 'stop') + ' now', detail: '→ ' + plural(now + add, 'stop') }); })),
        ui.section({ header: k === n ? 'Jobs' : k + ' of ' + n + ' will move' },
          jobs.slice(0, p.all ? 500 : 8).map(j => { const d = dest(j), same = stays(j);
            return ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: q.routeName(j.routeId) + ' · ' + fmt.day(j.day, 'md') + (same ? '' : ' → ' + [d.routeId !== j.routeId && q.routeName(d.routeId), d.day !== j.day && fmt.day(d.day, 'md')].filter(Boolean).join(' · ')) + (j.recurring ? ' · ↻' : ''), detail: same && (f.routeId || f.day) ? 'Already there' : null }); }),
          n > 8 && !p.all && ui.row({ title: 'Show all ' + n, tint: true, onTap: () => { p.all = true; p.refresh(); } })));
    } }, { detent: 'large' });
};

/* ================= Control panel ================= */
WD.panel.addJump('Select jobs to move', () => { WD.nav.switchTab('board'); if (S.board.mode === 'month') S.board.mode = 'routes'; S.board.select = new Set(); WD.changed(); });
WD.panel.addJump('Edit an invoice', () => { WD.nav.switchTab('board'); const rec = (data.invoices || []).find(r => r.status === 'Sent' && r.jobId && !r.master && q.job(r.jobId)) || (data.invoices || []).find(r => !r.master && r.status !== 'Paid'); if (rec) R9.editInvoice(rec); else ui.toast('No open invoice to edit'); });
WD.panel.addJump('Sales tax', () => { WD.nav.switchTab('settings'); WD.nav.push(R9.taxSpec()); });
})();
