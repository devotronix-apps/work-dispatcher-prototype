/* RouteClerk prototype — version 4.0 money (`WD.rc`, continued): date-range and status filters for invoices and service notes; creating,
   viewing, sending and deleting invoices and service notes from the Invoices section; customer statements (one customer or many, with the
   unpaid invoices in the same PDF, and the billing email reviewed first); the Reports section; and the two Price Calc calculators. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc, uid = RC.uid, plural = RC.plural, num = RC.num;
const today = () => D.today(), me = () => (S.me || {}).name || 'You', money = n => fmt.money(n, true), yr = k => +k.slice(0, 4);
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const overdueDays = () => ((WD.r11 && WD.r11.cfg && WD.r11.cfg.unpaid) || { overdueDays: 45 }).overdueDays;
const emailOf = c => (c && (c.billingEmail || ((c.contacts || [])[0] || {}).email)) || '', validEmail = s => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(String(s).trim());
const longDay = k => fmt.day(k, 'md') + ', ' + k.slice(0, 4), mdy = k => { const [y, m, d] = k.split('-'); return m + '/' + d + '/' + y; };
const logMail = (c, subject, snippet, to) => { if (data.interactions) data.interactions.push({ id: uid('i-rc'), customerId: c.id, type: 'email', dir: 'out', at: +WD.now(), subject, snippet, from: (S.org || {}).email || 'billing@discountshred.example', to }); };

WD.css(`
.rc-fbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 16px 10px; }
.rc-pill { border: 0; border-radius: 16px; height: 32px; padding: 0 10px 0 12px; display: inline-flex; align-items: center; gap: 4px; font: inherit; font-size: 14px; font-weight: 600; letter-spacing: -.1px; background: var(--fill3); color: var(--label); cursor: pointer; }
.rc-pill.on { background: var(--tint); color: #fff; }
.rc-custom { flex-basis: 100%; display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--label2); }
.rc-date { font-weight: 600; color: var(--label); } .rc-num { font-size: 12px; letter-spacing: 0; }
.rc-line { display: flex; align-items: center; gap: 8px; padding: 8px 12px 8px 16px; background: var(--cell); border-bottom: .5px solid var(--sep); }
.rc-line .nm { flex: 1; min-width: 0; font-size: 15px; line-height: 19px; } .rc-line .nm small { display: block; color: var(--label2); font-size: 12px; letter-spacing: 0; }
.rc-line input.rate { width: 70px; text-align: right; border: 0; border-radius: 8px; background: var(--fill3); color: var(--label); font: inherit; font-size: 15px; padding: 6px 8px; }
.rc-line button.x { border: 0; background: none; color: var(--label3); padding: 2px; cursor: pointer; }
.rc-tiles { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 0 0 14px; }
.rc-tile { border-radius: 12px; background: var(--cell); padding: 10px 10px 9px; cursor: pointer; min-width: 0; }
.rc-tile .l { font-size: 12px; color: var(--label2); letter-spacing: 0; display: flex; align-items: center; gap: 4px; } .rc-tile .l i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.rc-tile .v { font-size: 19px; font-weight: 700; letter-spacing: -.4px; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .rc-tile .n { font-size: 12px; color: var(--label2); letter-spacing: 0; }
.rc-card { border-radius: 12px; background: var(--cell); padding: 12px 12px 10px; margin: 0 0 14px; --s1: #2a78d6; --s0: #b4b3ad; }
.screen[data-theme="dark"] .rc-card { --s1: #3987e5; --s0: #6e6e73; }
.rc-card h4 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -.2px; } .rc-card .sub { font-size: 12px; color: var(--label2); letter-spacing: 0; margin-top: 1px; min-height: 16px; }
.rc-card .hd { display: flex; align-items: flex-start; gap: 8px; } .rc-card .hd > div { flex: 1; min-width: 0; }
.rc-card .mini { border: 0; background: var(--fill3); border-radius: 8px; font: inherit; font-size: 12px; font-weight: 600; letter-spacing: 0; padding: 4px 8px; color: var(--label); cursor: pointer; white-space: nowrap; }
.rc-legend { display: flex; gap: 12px; font-size: 12px; color: var(--label2); letter-spacing: 0; margin: 6px 0 2px; } .rc-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; }
.rc-chart text { font-size: 9.5px; fill: var(--label2); letter-spacing: 0; } .rc-chart .grid { stroke: var(--sep); stroke-width: .5; } .rc-chart .hit { fill: transparent; cursor: pointer; } .rc-chart .hit.on { fill: var(--fill3); }
.rc-hbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; align-items: center; padding: 6px 0; font-size: 14px; letter-spacing: -.1px; } .rc-hbar .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-hbar .amt { font-weight: 600; text-align: right; } .rc-hbar .amt small { color: var(--label2); font-weight: 400; margin-left: 5px; font-size: 12px; }
.rc-hbar .bar { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: var(--fill3); } .rc-hbar .bar i { display: block; height: 100%; border-radius: 4px; background: var(--s1); min-width: 2px; }
.rc-tbl { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; } .rc-tbl td, .rc-tbl th { padding: 5px 2px; text-align: right; border-bottom: .5px solid var(--sep); font-variant-numeric: tabular-nums; } .rc-tbl td:first-child, .rc-tbl th:first-child { text-align: left; } .rc-tbl th { color: var(--label2); font-weight: 500; font-size: 12px; }
.rc-sum { border-radius: 12px; background: var(--cell); margin: 0 0 14px; overflow: hidden; } .rc-sum div { display: flex; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: .5px solid var(--sep); font-size: 15px; } .rc-sum div:last-child { border: 0; }
.rc-sum .big { font-weight: 700; font-size: 17px; } .rc-sum .muted span:first-child { color: var(--label2); }
.rc-sugs { background: var(--cell); border-radius: 0 0 10px 10px; } .rc-sugs button { display: block; width: 100%; text-align: left; border: 0; border-top: .5px solid var(--sep); background: none; padding: 8px 16px; font: inherit; font-size: 15px; color: var(--label); cursor: pointer; } .rc-sugs small { display: block; color: var(--label2); font-size: 12px; letter-spacing: 0; }
.rc-st h2 { color: #1E7B34; font: 23px/26px Georgia, 'Times New Roman', serif; margin: 0 0 4px; font-weight: 400; }
`);

/* ================= Date range and status filters ================= */
const RANGES = [['life', 'Lifetime'], ['year', 'This Year'], ['lastyear', 'Last Year'], ['month', 'This Month'], ['lastmonth', 'Last Month'], ['week', 'This Week'], ['yesterday', 'Yesterday'], ['today', 'Today'], ['custom', 'Custom']];
const STATUSES = [['all', 'All'], ['paid', 'Paid'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue']];
RC.invFilter = { range: 'life', status: 'all', from: '', to: '' };
/** [first day, last day] of a filter's range; null = open-ended. Weeks start on Sunday. */
RC.rangeOf = f => { const t = today(), d = D.parse(t), y = d.getFullYear(), m = d.getMonth(), k = (yy, mm, dd) => D.key(new Date(yy, mm, dd, 12));
  switch (f.range) { case 'year': return [k(y, 0, 1), k(y, 11, 31)]; case 'lastyear': return [k(y - 1, 0, 1), k(y - 1, 11, 31)]; case 'month': return [k(y, m, 1), k(y, m + 1, 0)]; case 'lastmonth': return [k(y, m - 1, 1), k(y, m, 0)];
    case 'week': { const s = D.add(t, -d.getDay()); return [s, D.add(s, 6)]; } case 'yesterday': return [D.add(t, -1), D.add(t, -1)]; case 'today': return [t, t]; case 'custom': return [f.from || null, f.to || null]; default: return [null, null]; } };
RC.inRange = (day, f) => { const [a, b] = RC.rangeOf(f); return (!a || day >= a) && (!b || day <= b); };
RC.rangeLabel = f => f.range === 'custom' && (f.from || f.to) ? (f.from ? mdy(f.from) : 'Start') + ' – ' + (f.to ? mdy(f.to) : 'Today') : (RANGES.find(r => r[0] === f.range) || RANGES[0])[1];
/** Paid, Draft, Overdue (unpaid longer than the past-due setting, 45 days unless changed) or Sent. */
RC.invStatus = r => r.status === 'Paid' || r.status === 'Draft' ? r.status : D.diff(today(), r.day) > overdueDays() ? 'Overdue' : 'Sent';
const statusOK = (st, f) => f.status === 'all' || (f.status === 'paid' ? st === 'Paid' : f.status === 'overdue' ? st === 'Overdue' : st !== 'Paid' && st !== 'Draft');
RC.invMatch = r => RC.inRange(r.day, RC.invFilter) && statusOK(RC.invStatus(r), RC.invFilter);
/** A service note is paid when its master invoice is; until then it is unpaid, and overdue once it (or its master invoice) passes the past-due setting. */
RC.noteStatus = n => { const mi = n.masterId && (data.invoices || []).find(i => i.masterId === n.masterId); return mi ? RC.invStatus(mi) : D.diff(today(), n.day) > overdueDays() ? 'Overdue' : 'Sent'; };
RC.noteMatch = n => RC.inRange(n.day, RC.invFilter) && statusOK(RC.noteStatus(n), RC.invFilter);
RC.invFilterOn = () => RC.invFilter.range !== 'life' || RC.invFilter.status !== 'all';
/** Two drop-downs: date range, and (o.status) All / Paid / Unpaid / Overdue. Custom shows two date boxes. */
RC.filterBar = (f, re, o = {}) => { const pill = (label, on, items) => { const el = h('button.rc-pill' + (on ? '.on' : ''), { onclick: () => ui.menu(el, items, { compact: true }) }, label, icon('chevron.down', 13)); return el; };
  return h('div.rc-fbar', pill(RC.rangeLabel(f), f.range !== 'life', [{ header: 'Dates' }].concat(RANGES.map(([v, label]) => ({ label, checked: f.range === v, onTap: () => { f.range = v; re(); } })))),
    o.status && pill(f.status === 'all' ? 'All statuses' : STATUSES.find(s => s[0] === f.status)[1], f.status !== 'all', [{ header: 'Status' }].concat(STATUSES.map(([v, label]) => ({ label, checked: f.status === v, onTap: () => { f.status = v; re(); } })))),
    RC.invFilterOn() && o.status && h('button.rc-pill', { style: 'background:none;color:var(--tint);padding:0 4px', onclick: () => { f.range = 'life'; f.status = 'all'; re(); } }, 'Clear'),
    f.range === 'custom' && h('div.rc-custom', 'From', h('input.pill-input', { type: 'date', value: f.from, 'aria-label': 'From', onchange: e => { f.from = e.target.value; re(); } }), 'to', h('input.pill-input', { type: 'date', value: f.to, 'aria-label': 'To', onchange: e => { f.to = e.target.value; re(); } }))); };

/* ================= Shared: customer picker and line editor ================= */
const custPicker = (p, done) => { const st = { query: '' }; p.push({ title: 'Customer', search: { placeholder: 'Name or address', onInput: (v, pg) => { st.query = v.trim().toLowerCase(); pg.refresh(); } },
  render: pg => ui.list(ui.section({ fold: false }, data.customers.filter(c => !c.hidden && (!st.query || c.name.toLowerCase().includes(st.query) || (c.locations[0] || {}).address.toLowerCase().includes(st.query))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60)
    .map(c => ui.row({ title: c.name, subtitle: (c.locations[0] || {}).address, onTap: () => { done(c); pg.pop(); } })))) }); };
const usualLines = c => { const loc = c && c.locations[0], items = (loc && loc.items) || []; return items.filter(i => i.qty > 0).map(i => { const pb = data.priceBook.find(x => x.id === i.id) || { name: i.id, rate: 0 }; return { id: i.id, name: pb.name, qty: i.qty, rate: i.rate != null ? i.rate : pb.rate }; }); };
const total = lines => Math.round(lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0) * 100) / 100;
const addLine = (p, f) => p.push({ title: 'Add a line', render: pg => { const items = RC.lineItems(), pick = x => { f.lines.push({ id: x.id, name: x.name, qty: 1, rate: x.rate }); pg.pop(); };
  return ui.list(ui.section({ header: 'Services', fold: false }, items.filter(x => !x.product).map(x => ui.row({ title: x.name, detail: money(x.rate), onTap: () => pick(x) }))), ui.section({ header: 'Products', fold: false }, items.filter(x => x.product).map(x => ui.row({ title: x.name, detail: money(x.rate), onTap: () => pick(x) }))),
    ui.section(null, ui.row({ title: 'Something else…', tint: true, onTap: async () => { const n = await RC.ask('Line description', 'e.g. After-hours service'); if (n) { f.lines.push({ name: n, qty: 1, rate: 0 }); pg.pop(); } } }))); } });
const linesSection = (p, f, header) => ui.section({ header: header || 'Lines', fold: false },
  f.lines.map((l, i) => h('div.rc-line', h('div.nm', l.name, h('small', money((+l.qty || 0) * (+l.rate || 0)))), ui.numField(l.qty, 0, 9999, v => { l.qty = v; p.refresh(); }, l.name + ' quantity'), h('span.secondary', '×'),
    h('input.rate', { type: 'text', inputmode: 'decimal', 'aria-label': l.name + ' price', value: String(l.rate), onfocus: e => e.target.select(), onchange: e => { l.rate = num(e.target.value); p.refresh(); } }), h('button.x', { 'aria-label': 'Remove ' + l.name, onclick: () => { f.lines.splice(i, 1); p.refresh(); } }, icon('xmark.circle.fill', 20)))),
  ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a line', tint: true, onTap: () => addLine(p, f) }));
const closeTop = () => { const st = WD.nav.current(); if (st.sheet) st.sheet.close(); else st.pop(); };

/* ================= Invoices: create, view, send, delete ================= */
let invSeq = 2700; const nextNumber = () => { let n; do { n = 'INV-' + (++invSeq); } while ((data.invoices || []).some(i => i.number === n)); return n; };
/** What the Pro "Invoice check" says about a total, from what this customer is usually billed. */
function invoiceCheck(c, amount, lines) {
  const past = (data.invoices || []).filter(i => i.customerId === c.id && !i.master).map(i => i.amount).sort((a, b) => a - b), usual = past.length ? past[Math.floor(past.length / 2)] : (c.stats && c.stats.rate) || 0, out = [];
  if (usual && amount > usual * 1.6) out.push(h('span', h('b', money(amount) + ' is ' + (amount / usual).toFixed(1) + '× the usual'), ' for ' + c.name + ' (' + money(usual) + '). Check the quantities before sending.'));
  if (usual && amount > 0 && amount < usual * 0.5) out.push(h('span', h('b', 'Lower than usual: '), c.name + ' is normally billed about ' + money(usual) + '.'));
  lines.filter(l => WD.CONTAINERS.includes(l.id) && l.id !== 'box' && l.qty > 12).forEach(l => out.push(h('span', h('b', l.qty + ' × ' + l.name), ' is a lot of containers for one visit.')));
  lines.filter(l => !+l.rate && +l.qty && l.id !== 'cod').forEach(l => out.push(h('span', h('b', l.name), ' has no price.')));
  return out.length ? out : [h('span', 'In line with what ' + c.name + ' is usually billed' + (usual ? ' (' + money(usual) + ').' : '.'))];
}
RC.newInvoice = custId => {
  if (!(WD.can('billing.manage') || WD.can('billing.field'))) return ui.toast('Your role can’t create invoices', 'lock');
  const f = { c: custId ? q.customer(custId) : null, day: today(), lines: [], po: '', email: '', send: true };
  const setC = c => { f.c = c; f.lines = usualLines(c); f.po = c.po || ''; f.email = emailOf(c); };
  if (f.c) setC(f.c);
  const create = async p => { const c = f.c, lines = f.lines.filter(l => +l.qty && (l.rate || l.name)); if (!c) return ui.toast('Choose a customer', 'person'); if (!lines.length) return ui.toast('Add at least one line', 'plus');
    if (f.send && !validEmail(f.email)) return ui.toast('Enter the email address to send it to', 'envelope', 2600);
    const tx = WD.taxInfo ? WD.taxInfo(lines, c) : { tax: 0 }, amount = total(lines) + (tx.tax || 0), number = nextNumber();
    const ok = await ui.run(f.send ? 'Creating and sending…' : 'Creating invoice…', () => {
      data.invoices.push({ id: uid('inv-n'), number, customerId: c.id, jobId: null, day: f.day, amount, status: 'Sent', lines: lines.map(l => ({ ...l })), tax: tx.tax || 0, taxLabel: tx.label, po: f.po.trim(), payments: [], at: +WD.now(), auto: false, sentAt: f.send ? +WD.now() : null, sentTo: f.send ? f.email.trim() : null, by: me() });
      if (c.stats) { c.stats.invoiced += amount; c.stats.balance += amount; } if (f.send) logMail(c, 'Invoice ' + number, 'Invoice ' + number + ' for ' + money(amount) + ' is attached.', f.email.trim());
    }, { done: f.send ? number + ' sent' : number + ' created' });
    if (ok) p.dismiss(); };
  ui.sheet({ title: 'New invoice', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Create', bold: true, onTap: create }],
    render: p => { const c = f.c, tx = c && WD.taxInfo ? WD.taxInfo(f.lines, c) : { tax: 0, rate: 0 }, sum = total(f.lines) + (tx.tax || 0);
      return ui.list(
        ui.section({ fold: false }, ui.row({ icon: 'person.crop.circle', iconPlain: true, title: c ? c.name : 'Choose a customer', subtitle: c ? (c.locations[0] || {}).address : null, tint: !c, chevron: true, onTap: () => custPicker(p, x => setC(x)) }),
          ui.dateRow({ title: 'Invoice date', value: f.day, onChange: v => { f.day = v; } })),
        c && linesSection(p, f, 'Lines · starts from their usual service'),
        c && h('div.rc-sum', tx.tax > 0 && h('div.muted', h('span', tx.label), h('span', money(tx.tax))), h('div.big', h('span', 'Total'), h('span', money(sum)))),
        c && f.lines.length > 0 && RC.aiBlock('invcheck', () => RC.aiCard({ title: 'Invoice check', lines: invoiceCheck(c, sum, f.lines) })),
        c && ui.section({ header: 'Sending', fold: false, footer: f.send ? 'Emailed as a PDF with a pay link when you tap Create.' : 'Saved without emailing. Send it later from the invoice.' },
          ui.inputRow({ label: 'PO number', placeholder: 'Optional', value: f.po, onInput: v => { f.po = v; } }),
          ui.toggleRow({ title: 'Send to the customer now', value: f.send, onChange: v => { f.send = v; p.refresh(); } }),
          f.send && ui.inputRow({ label: 'Send to', type: 'email', caps: 'off', value: f.email, onInput: v => { f.email = v; } })),
        c && h('div', { style: 'padding:4px 0 8px' }, ui.button(f.send ? 'Create and send · ' + money(sum) : 'Create invoice · ' + money(sum), { icon: 'doc.text', onTap: () => create(p) }))); } }, { detent: 'large' });
};
const recLines = rec => rec.lines && rec.lines.length ? rec.lines : (WD.screens.customers && WD.screens.customers.invLines ? WD.screens.customers.invLines(rec) : [{ name: 'Service', qty: 1, rate: rec.amount }]);
const billTo = c => { const parts = (((c || {}).locations || [])[0] || { address: '' }).address.split(',').map(x => x.trim()).filter(Boolean); return c ? [c.name].concat(c.attn ? ['Attn: ' + c.attn] : [], c.billAddress || [parts[0], parts.slice(1).join(', ')].filter(Boolean)) : []; };
const invoiceNode = rec => { const B = WD.screens.billing, c = q.customer(rec.customerId), job = rec.jobId && q.job(rec.jobId);
  if (job && job.invoice && B.invoiceDoc) return B.invoiceDoc(job.invoice, job).firstChild;
  return B.standardInvoice({ number: rec.number, date: rec.day, terms: c && c.terms, billTo: billTo(c), lines: recLines(rec), tax: rec.tax, taxLabel: rec.taxLabel, paid: rec.status === 'Paid', po: rec.po, sigs: [] }); };
RC.viewInvoice = rec => ui.sheet({ title: rec.number, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: () => WD.screens.billing.docWrap([invoiceNode(rec)]) }, { detent: 'large' });
RC.sendInvoice = async rec => { const c = q.customer(rec.customerId), r = await ui.alert({ title: 'Send ' + rec.number, message: 'Emailed as a PDF with a pay link.', input: { placeholder: 'Email address', value: rec.sentTo || emailOf(c), type: 'email' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Send', value: true, bold: true }] });
  if (!r || !r.value) return; if (!validEmail(r.text)) return ui.toast('That isn’t an email address', 'envelope');
  await ui.run('Sending…', () => { rec.sentAt = +WD.now(); rec.sentTo = r.text.trim(); if (c) logMail(c, 'Invoice ' + rec.number, 'Invoice ' + rec.number + ' for ' + money(rec.amount) + ' is attached.', rec.sentTo); }, { done: 'Sent to ' + r.text.trim() }); };
RC.deleteInvoice = async rec => { const c = q.customer(rec.customerId), paid = rec.status === 'Paid';
  const ok = await ui.actionSheet({ title: 'Delete ' + rec.number + '?', message: (paid ? 'This invoice is paid. Deleting it also removes its payment record. ' : '') + 'It comes off ' + (c ? c.name + '’s' : 'the customer’s') + ' account and can’t be brought back.' + (rec.jobId ? ' The job goes back to “not billed”.' : ''), buttons: [{ label: 'Delete invoice', role: 'destructive', value: true }] }); if (!ok) return;
  if (await ui.run('Deleting…', () => { data.invoices = data.invoices.filter(i => i !== rec); if (data.payments) data.payments = data.payments.filter(p => p.invoiceId !== rec.id);
    if (c && c.stats) { c.stats.invoiced = Math.max(0, c.stats.invoiced - rec.amount); if (paid) c.stats.paid = Math.max(0, c.stats.paid - rec.amount); else c.stats.balance = Math.max(0, c.stats.balance - rec.amount); }
    const j = rec.jobId && q.job(rec.jobId); if (j) { j.invoice = null; j.events.push({ at: +WD.now(), actor: me(), text: 'Invoice ' + rec.number + ' deleted' }); }
    if (rec.master && data.serviceNotes) data.serviceNotes.forEach(n => { if (n.masterId === rec.masterId) n.masterId = null; });
  }, { done: 'Deleted' })) closeTop(); };
/* Add View (for invoices with no job), Send and Delete to every invoice's actions. */
if (WD.workflow && WD.workflow.invoiceActionRows) { const base = WD.workflow.invoiceActionRows;
  WD.workflow.invoiceActionRows = (rec, job, o) => { const rows = base(rec, job, o) || [], field = WD.can('billing.field') || WD.can('billing.manage'), hasView = rec.master || (job && job.invoice);
    return [!hasView && ui.row({ title: 'View invoice', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => RC.viewInvoice(rec) })].concat(rows, [
      field && ui.row({ title: rec.sentAt ? 'Send again…' : 'Send to the customer…', subtitle: rec.sentAt ? 'Last sent ' + fmt.rel(new Date(rec.sentAt)).toLowerCase() + (rec.sentTo ? ' to ' + rec.sentTo : '') : null, icon: 'envelope', iconPlain: true, tint: true, onTap: () => RC.sendInvoice(rec) }),
      WD.can('billing.manage') && ui.row({ title: 'Delete invoice…', icon: 'trash', iconPlain: true, iconColor: 'var(--red)', destructive: true, onTap: () => RC.deleteInvoice(rec) })]); }; }

/* ================= Service notes: create, edit, send, delete ================= */
let snSeq = 3300;
RC.editNote = n => {
  const c0 = n ? q.customer(n.customerId) : null, f = n ? { c: c0, day: n.day, loc: n.location, lines: n.lines.map(l => ({ ...l })), pounds: n.pounds ? String(n.pounds) : '', signer: n.signer || '', po: n.po || '' } : { c: null, day: today(), loc: '', lines: [], pounds: '', signer: '', po: '' };
  const setC = c => { f.c = c; f.loc = (c.locations[0] || {}).label || ''; f.lines = usualLines(c); f.po = c.po || ''; };
  const save = async p => { const c = f.c, lines = f.lines.filter(l => +l.qty); if (!c) return ui.toast('Choose a customer', 'person'); if (!lines.length) return ui.toast('Add at least one line', 'plus');
    const loc = c.locations.find(l => l.label === f.loc) || c.locations[0] || {}, v = { customerId: c.id, day: f.day, location: f.loc || loc.label || '', address: loc.address || '', lines, amount: total(lines), pounds: num(f.pounds) || null, signer: f.signer.trim(), po: f.po.trim() };
    if (await ui.run('Saving…', () => { if (n) Object.assign(n, v, { editedBy: me(), editedAt: +WD.now() }); else data.serviceNotes.push({ id: uid('sn-n'), number: 'SN-' + (++snSeq), jobId: null, scans: [], scanNote: '', drives: [], driveNote: '', sig: null, by: me(), at: +WD.now(), masterId: null, ...v }); }, { done: n ? 'Saved' : 'Service note created' })) p.dismiss(); };
  ui.sheet({ title: n ? 'Edit ' + n.number : 'New service note', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: save }],
    render: p => { const c = f.c; return ui.list(
      ui.section({ fold: false, footer: n ? null : 'A service note records one visit for a customer who gets a single master invoice each month.' }, ui.row({ icon: 'person.crop.circle', iconPlain: true, title: c ? c.name : 'Choose a customer', tint: !c, chevron: !n, onTap: n ? null : () => custPicker(p, x => setC(x)) }),
        c && c.locations.length > 1 && ui.pickerRow({ title: 'Location', value: f.loc, options: c.locations.map(l => ({ value: l.label, label: l.label })), onChange: v => { f.loc = v; p.refresh(); } }),
        ui.dateRow({ title: 'Service date', value: f.day, onChange: v => { f.day = v; } })),
      c && linesSection(p, f, 'Items'), c && h('div.rc-sum', h('div.big', h('span', 'Total'), h('span', money(total(f.lines))))),
      c && ui.section({ fold: false }, ui.inputRow({ label: 'Pounds', inputmode: 'numeric', placeholder: 'Optional', value: f.pounds, onInput: v => { f.pounds = v; } }), ui.inputRow({ label: 'PO number', placeholder: 'Optional', value: f.po, onInput: v => { f.po = v; } }),
        ui.inputRow({ label: 'Signed by', placeholder: 'Name on the paper note', value: f.signer, onInput: v => { f.signer = v; } }))); } }, { detent: 'large' });
};
RC.noteActions = n => { const c = q.customer(n.customerId), can = WD.can('billing.field') || WD.can('billing.manage'), locked = !!n.masterId; if (!can) return null;
  return ui.section({ fold: false, footer: locked ? 'This note is on a master invoice, so it can’t be changed or deleted. Correct the master invoice instead.' : null },
    ui.row({ title: 'Send to the customer…', icon: 'envelope', iconPlain: true, tint: true, onTap: async () => { const r = await ui.alert({ title: 'Send ' + n.number, message: 'Emailed as a PDF copy of the signed note.', input: { placeholder: 'Email address', value: n.emailedTo || emailOf(c), type: 'email' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Send', value: true, bold: true }] });
      if (!r || !r.value) return; if (!validEmail(r.text)) return ui.toast('That isn’t an email address', 'envelope'); await ui.run('Sending…', () => { n.emailedTo = r.text.trim(); if (c) logMail(c, 'Service note ' + n.number, 'Service note ' + n.number + ' from ' + longDay(n.day) + ' is attached.', n.emailedTo); }, { done: 'Sent' }); } }),
    !locked && ui.row({ title: 'Edit service note', icon: 'pencil', iconPlain: true, tint: true, onTap: () => RC.editNote(n) }),
    !locked && WD.can('billing.manage') && ui.row({ title: 'Delete service note…', icon: 'trash', iconPlain: true, iconColor: 'var(--red)', destructive: true, onTap: async () => {
      if (!await ui.actionSheet({ title: 'Delete ' + n.number + '?', message: 'It won’t be on the next master invoice. This can’t be undone.', buttons: [{ label: 'Delete service note', role: 'destructive', value: true }] })) return;
      if (await ui.run('Deleting…', () => { data.serviceNotes = data.serviceNotes.filter(x => x !== n); }, { done: 'Deleted' })) closeTop(); } })); };
RC.newMenu = (el, page, kind) => ui.menu(el, [{ label: 'New invoice', icon: 'doc.text', onTap: () => RC.newInvoice() }, { label: 'New service note', icon: 'signature', onTap: () => RC.editNote(null) }]);

/* ================= Statements ================= */
const unpaid = c => (data.invoices || []).filter(i => i.customerId === c.id && i.status !== 'Paid' && i.status !== 'Draft').sort((a, b) => a.day.localeCompare(b.day));
const age = i => D.diff(today(), i.day);
const aging = invs => { const b = [0, 0, 0, 0]; invs.forEach(i => { const a = age(i) - 30; b[a <= 0 ? 0 : a <= 30 ? 1 : a <= 60 ? 2 : 3] += i.amount; }); return b; };
const AGE_LABELS = ['Not yet due', '1–30 days past due', '31–60 days past due', 'Over 60 days past due'];
/** The statement page, drawn like the invoices: every unpaid invoice with its date, due date and age, an aging summary, and the total due. */
function statementDoc(c, invs) {
  const B = WD.screens.billing, org = S.org || data.orgs[0], sum = invs.reduce((s, i) => s + i.amount, 0), ag = aging(invs);
  return h('div.bn-doc.rc-st', h('div.bn-top', B.logo(), h('div.bn-co', [org.name].concat((org.remit || []).slice(1), org.phone || [], org.email || [], data.tax && data.tax.on && data.tax.regNo ? 'Tax reg. # ' + data.tax.regNo : []).map(x => h('div', x)))),
    h('div.bn-mid', h('div.bn-to', billTo(c).map(x => h('div', x))), h('div', h('h2', 'Statement'), h('div.bn-meta', [['Statement Date', mdy(today())], ['Open Invoices', String(invs.length)], ['Total Due', money(sum)]].map(([k, v]) => [h('span', k), h('span', v)])))),
    h('table.bn-tab', h('thead', h('tr', h('th', 'Invoice'), h('th', 'Date'), h('th', 'Due'), h('th', 'Days', h('br'), 'Old'), h('th.r', 'Amount', h('br'), 'Due'))),
      h('tbody', invs.map(i => h('tr', h('td', i.number), h('td.n', mdy(i.day)), h('td.n', mdy(D.add(i.day, 30))), h('td.n', String(age(i))), h('td.r.n', money(i.amount)))))),
    h('div.bn-bot', h('div.bn-sig'), h('div.bn-tot', ag.map((v, i) => v > 0 && h('div' + (i ? '.x' : ''), h('span', AGE_LABELS[i]), h('span', money(v)))), h('div.due', h('span', 'Total Due'), h('span', money(sum))))),
    h('div.bn-fill'), h('div.bn-cod', 'Thank you for your business. If you have already sent payment, please disregard this statement. Questions: ' + (org.phone || '') + (org.email ? ' · ' + org.email : '')));
}
RC.statementPages = (c, attach) => { const invs = unpaid(c); return [statementDoc(c, invs)].concat(attach ? invs.map(invoiceNode) : []); };
/** What Premium "Late-payment risk" says about a customer, from their invoices. */
RC.payRisk = c => { const all = (data.invoices || []).filter(i => i.customerId === c.id), late = all.filter(i => RC.invStatus(i) === 'Overdue').length, open = unpaid(c).length, score = all.length ? (late * 2 + open) / (all.length * 2) : 0;
  return { level: score > 0.45 ? 'High' : score > 0.18 ? 'Medium' : 'Low', color: score > 0.45 ? 'var(--red)' : score > 0.18 ? 'var(--orange)' : 'var(--green)', why: late + ' of their last ' + all.length + ' invoices went past due' + (open ? '; ' + open + ' still open' : '') }; };
/** What Pro "Collection message drafts" writes, by tone. */
function draftMessage(c, invs, tone) {
  const first = (((c.contacts || [])[0] || {}).name || '').split(' ')[0] || 'there', sum = money(invs.reduce((s, i) => s + i.amount, 0)), oldest = invs.length ? invs[0] : null, org = (S.org || data.orgs[0]).name, yrs = c.stats && c.stats.firstInvoice ? Math.max(1, Math.round(D.diff(today(), c.stats.firstInvoice) / 365)) : 0;
  const open = 'Hi ' + first + ',\n\n', list = invs.length > 1 ? invs.length + ' invoices are open, totaling ' + sum : 'invoice ' + (oldest || {}).number + ' for ' + sum + ' is open', since = oldest ? ' The oldest is from ' + longDay(oldest.day) + '.' : '';
  if (tone === 'firm') return open + 'Our records show ' + list + '.' + since + ' These are now past our 30-day terms.\n\nPlease send payment this week, or reply with the date we should expect it. The statement and each invoice are attached so nothing has to be looked up.\n\nIf they have been going to the wrong person, tell us who should get them and we will fix it today.\n\nThank you,\n' + org;
  if (tone === 'final') return open + 'This is our final reminder that ' + list + '.' + since + '\n\nWe would rather not interrupt your service. Please pay the balance or call us within 10 days so we can agree on a plan.\n\nThe statement and invoices are attached.\n\n' + org;
  return open + (yrs > 1 ? 'Thank you for ' + yrs + ' years with us. ' : '') + 'A quick note that ' + list + '.' + since + '\n\nWe suspect these may not be reaching the right inbox, so the statement and every open invoice are attached here in one PDF. If someone else handles payables, just reply with their address.\n\nThanks so much,\n' + org;
}
/** One customer's statement: review the unpaid invoices and the billing email, choose whether to attach the invoices, preview, send.
    o.job (a driver at the stop) adds today's invoice to the top so it can be created before the statement goes out. */
RC.openStatement = (c, o = {}) => {
  if (!(WD.can('billing.view') || WD.can('billing.field'))) return ui.toast('Billing access is needed for statements', 'lock');
  const was = emailOf(c), tplBody = () => { const invs = unpaid(c); return WD.co && WD.co.tpl ? WD.co.fill(WD.co.tpl('statement').body, WD.co.ctxFor(c, { amount: money(invs.reduce((s, i) => s + i.amount, 0)) })) : 'Your statement is attached.'; };
  const f = { email: was, future: 'new', attach: data.comms ? data.comms.statement.attach : true, msg: tplBody(), tone: 'friendly' };
  const send = async p => { const invs = unpaid(c), to = f.email.trim(); if (!invs.length) return ui.toast('Nothing is unpaid', 'checkmark'); if (!validEmail(to)) return ui.toast('Enter the billing email address', 'envelope', 2600);
    const ok = await ui.run('Sending statement…', () => {
      if (to !== was) { if (f.future === 'new') c.billingEmail = to; else if (f.future === 'both') c.billingEmail = [was, to].filter(Boolean).join(', '); }
      c.lastStatement = { day: today(), to, by: me(), count: invs.length }; logMail(c, 'Statement from ' + (S.org || data.orgs[0]).name, 'Statement with ' + plural(invs.length, 'open invoice') + (f.attach ? ', invoices attached' : '') + '.', to);
      if (o.job) o.job.events.push({ at: +WD.now(), actor: me(), text: 'Statement with ' + plural(invs.length, 'unpaid invoice') + ' sent to ' + to });
    }, { done: 'Statement sent' }); if (ok) p.dismiss(); };
  ui.sheet({ title: 'Statement', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Send', bold: true, onTap: send }],
    render: p => { const invs = unpaid(c), sum = invs.reduce((s, i) => s + i.amount, 0), ag = aging(invs), changed = f.email.trim() !== was && validEmail(f.email), job = o.job && q.job(o.job.id), risk = RC.ai('payrisk') ? RC.payRisk(c) : null;
      return ui.list(
        job && ui.section({ header: 'Today’s visit', fold: false, footer: job.invoice ? 'Today’s invoice is on the statement below.' : 'Create it first and it goes on the statement with the others.' },
          job.invoice ? ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: job.invoice.number + ' created', detail: money(job.invoice.amount) })
            : ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'Create today’s invoice', subtitle: job.title, tint: true, chevron: true, onTap: () => WD.screens.billing.openEditor(job.id) })),
        ui.section({ header: c.name + ' · ' + plural(invs.length, 'unpaid invoice'), fold: false },
          invs.length ? invs.map(i => ui.row({ title: longDay(i.day), subtitle: i.number + ' · ' + age(i) + ' days old', badge: RC.invStatus(i) === 'Overdue' ? ui.badge('Past due', 'var(--red)') : null, detail: money(i.amount) })) : ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Nothing is unpaid' }),
          invs.length > 0 && ui.row({ title: h('b', 'Total due'), detail: h('b', money(sum)), subtitle: ag.map((v, i) => v > 0 ? AGE_LABELS[i].toLowerCase() + ' ' + fmt.money(v) : null).filter(Boolean).join(' · ') })),
        risk && h('div.rc-ai', h('div.k', icon('sparkles', 15), 'Late-payment risk'), h('div', h('b', { style: { color: risk.color } }, risk.level), ' — ' + risk.why + '.')),
        ui.section({ header: 'Send to', fold: false, footer: changed ? null : 'Check this is the person who pays the bills. Change it here if not.' },
          ui.inputRow({ label: 'Billing email', type: 'email', caps: 'off', value: f.email, onInput: v => { const before = f.email.trim() !== was && validEmail(f.email); f.email = v; if (before !== (v.trim() !== was && validEmail(v))) p.refresh(); } }),
          changed && ui.pickerRow({ title: 'Future invoices go to', value: f.future, options: [{ value: 'new', label: 'The new address' }, { value: 'old', label: 'The old address' + (was ? ' (' + was + ')' : '') }, { value: 'both', label: 'Both addresses' }], onChange: v => { f.future = v; p.refresh(); } }),
          changed && h('div.section-footer', { style: 'padding:6px 16px 10px;background:var(--cell)' }, 'This statement goes to ' + f.email.trim() + '. ' + ({ new: 'Later invoices will too.', old: 'Later invoices keep going to ' + (was || 'the old address') + '.', both: 'Later invoices go to both.' }[f.future]))),
        ui.section({ header: 'What’s in it', fold: false, footer: f.attach ? 'One PDF: the statement, then each unpaid invoice.' : 'One PDF with the statement page only.' },
          ui.toggleRow({ title: 'Attach the unpaid invoices', subtitle: plural(invs.length, 'invoice') + ', in the same PDF', value: f.attach, onChange: v => { f.attach = v; p.refresh(); } }),
          ui.row({ title: 'Preview the PDF', subtitle: plural(1 + (f.attach ? invs.length : 0), 'page'), icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => p.push({ title: 'Statement PDF', render: () => WD.screens.billing.docWrap(RC.statementPages(c, f.attach)) }) })),
        ui.section({ header: 'Message', fold: false }, ui.inputRow({ multiline: true, value: f.msg, onInput: v => { f.msg = v; } })),
        RC.aiBlock('collect', () => h('div.rc-ai', h('div.k', icon('sparkles', 15), 'Draft the message'), h('div', 'Written from this customer’s open invoices and history. You can edit it afterwards.'),
          h('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' }, [['friendly', 'Friendly'], ['firm', 'Firm'], ['final', 'Final notice']].map(([v, label]) => ui.button(label, { kind: f.tone === v && f.drafted ? 'filled' : 'tinted', small: true, block: false, onTap: async () => { const hud = ui.hud('Writing…'); await WD.delay(700, 1100); hud.close(); f.tone = v; f.drafted = true; f.msg = draftMessage(c, unpaid(c), v); p.refresh(); } }))))),
        h('div', { style: 'padding:4px 0 8px' }, ui.button('Send statement' + (invs.length ? ' · ' + money(sum) : ''), { icon: 'envelope', disabled: !invs.length, onTap: () => send(p) }))); } }, { detent: 'large' });
};
/** Statements for a list of customers at once (from the Customers filters). */
RC.batchStatements = list => { const rows = list.filter(c => unpaid(c).length).map(c => ({ c, on: true })), f = { attach: data.comms ? data.comms.statement.attach : true };
  ui.sheet({ title: 'Send statements', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    render: p => { const pick = rows.filter(r => r.on), miss = pick.filter(r => !validEmail(emailOf(r.c).split(',')[0]));
      return ui.list(ui.section({ fold: false }, ui.toggleRow({ title: 'Attach the unpaid invoices', subtitle: 'In the same PDF as each statement', value: f.attach, onChange: v => { f.attach = v; } })),
        ui.section({ header: plural(pick.length, 'customer') + ' · ' + fmt.money(pick.reduce((s, r) => s + unpaid(r.c).reduce((t, i) => t + i.amount, 0), 0)), fold: false, footer: miss.length ? plural(miss.length, 'customer') + ' with no billing email will be skipped. Open the customer to add one.' : 'Each goes to the customer’s billing email.' },
          rows.map(r => { const invs = unpaid(r.c), em = emailOf(r.c); return ui.row({ title: r.c.name, subtitle: (em || 'No billing email') + ' · ' + plural(invs.length, 'invoice'), detail: fmt.money(invs.reduce((s, i) => s + i.amount, 0)), trailing: ui.toggle(r.on, v => { r.on = v; p.refresh(); }), onTap: () => p.push({ title: r.c.name, render: () => WD.screens.billing.docWrap(RC.statementPages(r.c, f.attach)) }) }); })),
        h('div', { style: 'padding:4px 0 8px' }, ui.button('Send ' + plural(pick.length - miss.length, 'statement'), { icon: 'envelope', disabled: pick.length - miss.length < 1, onTap: async () => {
          const go = pick.filter(r => !miss.includes(r)); if (await ui.run('Sending ' + plural(go.length, 'statement') + '…', () => go.forEach(r => { r.c.lastStatement = { day: today(), to: emailOf(r.c), by: me(), count: unpaid(r.c).length }; logMail(r.c, 'Statement from ' + (S.org || data.orgs[0]).name, 'Statement with ' + plural(unpaid(r.c).length, 'open invoice') + '.', emailOf(r.c)); }), { done: plural(go.length, 'statement') + ' sent', min: 1200, max: 2000 })) p.dismiss(); } }))); } }, { detent: 'large' });
};

/* ================= Reports ================= */
const CATS = ['Console service', 'Bin service (64 gal)', 'Bin service (96 gal)', 'Purges', 'Hard drive destruction', 'Products', 'Fees and other'];
const catOf = l => l.id === 'console' ? CATS[0] : l.id === 'bin64' ? CATS[1] : l.id === 'bin96' ? CATS[2] : /^(box|bin(Flat|Extra)|stairs|haul)/.test(l.id || '') ? CATS[3] : l.id === 'hdd' ? CATS[4] : /^pd/.test(l.id || '') ? CATS[5] : CATS[6];
const ym = k => k.slice(0, 7), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* The prototype's invoices only go back a few months, so earlier months come from a generated sales history (monthly totals by service, sized to
   match the recent invoices). `cut` is the first day covered by real invoice records. */
let HIST = null, cut = null;
function history() {
  if (HIST) return HIST; const t = D.parse(today()), y = t.getFullYear(), m = t.getMonth(); cut = D.key(new Date(y, m, 1, 12));
  const lastMonth = ym(cut), since = D.add(today(), -30), live = (data.invoices || []).filter(i => i.day > since && i.status !== 'Draft').reduce((s, i) => s + i.amount, 0), base = Math.max(8000, live), season = [0.93, 0.9, 1.01, 1.05, 1.02, 0.98, 0.95, 0.97, 1.03, 1.07, 1.0, 0.94], mix = [0.37, 0.22, 0.11, 0.2, 0.04, 0.03, 0.03];
  let seed = 41; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; HIST = {};
  for (let yy = y - 2; yy <= y; yy++) for (let mm = 0; mm < 12; mm++) { const key = yy + '-' + String(mm + 1).padStart(2, '0'); if (key >= lastMonth) break;
    const monthsBack = (y - yy) * 12 + (m - mm), tot = Math.round(base * Math.pow(1.085, -monthsBack / 12) * season[mm] / season[m] * (0.95 + rnd() * 0.1)), by = {}; let left = tot;
    mix.forEach((s, i) => { const v = i === mix.length - 1 ? left : Math.round(tot * s * (0.88 + rnd() * 0.24)); by[CATS[i]] = Math.max(0, Math.min(left, v)); left -= by[CATS[i]]; });
    HIST[key] = { total: tot, count: Math.round(tot / 92), paid: tot, by }; }
  return HIST;
}
const liveInv = () => { history(); return (data.invoices || []).filter(i => i.day >= cut && i.status !== 'Draft'); };
const liveBy = i => { const by = {}, lines = i.lines && i.lines.length ? i.lines : null; if (!lines) { const c = q.customer(i.customerId), k = i.master ? CATS[1] : c && c.type === 'purge' ? CATS[3] : CATS[0]; by[k] = i.amount; return by; }
  lines.forEach(l => { const k = catOf(l); by[k] = (by[k] || 0) + (+l.qty || 0) * (+l.rate || 0); }); return by; };
const monthTotal = key => { const H = history(); return H[key] ? H[key].total : liveInv().filter(i => ym(i.day) === key).reduce((s, i) => s + i.amount, 0); };
/** Totals for a date range: {total, count, paid, by: {category: $}, years: {year: $}, cust: {customerId: $}}. */
function aggregate(f) {
  const H = history(), [a, b] = RC.rangeOf(f), out = { total: 0, count: 0, by: {}, years: {}, cust: {} }, add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  Object.keys(H).forEach(key => { const d0 = key + '-01'; if ((a && d0 < ym(a) + '-01') || (b && d0 > b)) return; if (a && ym(a) === key && a > d0) return; const x = H[key]; out.total += x.total; out.count += x.count; add(out.years, key.slice(0, 4), x.total); Object.keys(x.by).forEach(k => add(out.by, k, x.by[k])); });
  liveInv().filter(i => RC.inRange(i.day, f)).forEach(i => { out.total += i.amount; out.count++; add(out.years, i.day.slice(0, 4), i.amount); add(out.cust, i.customerId, i.amount); const by = liveBy(i); Object.keys(by).forEach(k => add(out.by, k, by[k])); });
  return out;
}
const RP = { f: { range: 'year', from: '', to: '' }, compare: true, table: false, sel: null };
const CARDS = [['tiles', 'Invoice totals', 'Overdue, unpaid and paid this year'], ['monthly', 'Invoiced each month', 'This year, compared with last year'], ['years', 'Sales by year', 'Total for each year in the date range'], ['services', 'Revenue by service', 'Where the money comes from'], ['aging', 'What customers owe', 'Unpaid invoices by age'], ['top', 'Top customers', 'By amount invoiced in the date range'], ['insights', 'Insights', 'AI findings (Premium)']];
S.prefs.reportCards = S.prefs.reportCards || Object.fromEntries(CARDS.map(c => [c[0], true]));
const kfmt = v => v >= 1000 ? '$' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : '$' + Math.round(v);
function svg(tag, attrs, kids) { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs || {}).forEach(([k, v]) => v != null && el.setAttribute(k, v)); (kids || []).forEach(k => k && el.appendChild(k)); return el; }
const svgText = (x, y, s, anchor) => { const t = svg('text', { x, y, 'text-anchor': anchor || 'middle' }); t.textContent = s; return t; };
const barPath = (x, y, w, hh, base) => { const r = Math.min(4, w / 2, hh); return 'M' + x + ' ' + base + 'V' + (y + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + -r + 'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'V' + base + 'z'; };
/** Invoiced dollars per month this year, with last year beside it. Tap or point at a month for its numbers; Table shows them all. */
function monthlyCard(re) {
  const y = yr(today()), curM = D.parse(today()).getMonth(), cur = MON.map((_, i) => i <= curM ? monthTotal(y + '-' + String(i + 1).padStart(2, '0')) : null), prev = MON.map((_, i) => monthTotal((y - 1) + '-' + String(i + 1).padStart(2, '0')));
  const ytd = cur.reduce((s, v) => s + (v || 0), 0), pytd = prev.slice(0, curM + 1).reduce((s, v) => s + v, 0), pct = (a, b) => b ? (a >= b ? '+' : '−') + Math.abs(Math.round((a - b) / b * 100)) + '%' : '';
  const sub = h('div.sub'), say = i => { sub.textContent = i == null ? y + ' so far ' + fmt.money(ytd) + (RP.compare ? ' · ' + pct(ytd, pytd) + ' vs the same months of ' + (y - 1) : '') : MON[i] + ': ' + (cur[i] == null ? 'not yet' : fmt.money(cur[i])) + (RP.compare ? ' · ' + (y - 1) + ' ' + fmt.money(prev[i]) + (cur[i] != null ? ' (' + pct(cur[i], prev[i]) + ')' : '') : ''); };
  say(RP.sel);
  const W = 340, H = 176, L = 30, B = 16, T = 6, max = Math.max(1, ...cur.map(v => v || 0), ...(RP.compare ? prev : [0])), step = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : max / Math.pow(10, Math.floor(Math.log10(max))) > 2 ? 1 : 0.5), top = Math.ceil(max / step) * step;
  const yOf = v => T + (H - T - B) * (1 - v / top), gw = (W - L) / 12, bw = RP.compare ? 8.5 : 14, kids = [];
  for (let v = 0; v <= top + 1; v += step) { kids.push(svg('line', { class: 'grid', x1: L, x2: W, y1: yOf(v), y2: yOf(v) })); kids.push(svgText(L - 4, yOf(v) + 3, kfmt(v), 'end')); }
  const hits = [];
  MON.forEach((mName, i) => { const x0 = L + gw * i, mid = x0 + gw / 2, hit = svg('rect', { class: 'hit' + (RP.sel === i ? ' on' : ''), x: x0, y: T, width: gw, height: H - T - B, rx: 3 }); hits.push(hit);
    const pick = () => { RP.sel = RP.sel === i ? null : i; hits.forEach((r, j) => r.classList.toggle('on', RP.sel === j)); say(RP.sel); };
    hit.addEventListener('click', pick); hit.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') say(i); }); hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') say(RP.sel); });
    kids.push(hit);
    if (RP.compare) kids.push(svg('path', { d: barPath(mid - bw - 1, yOf(prev[i]), bw, H - B - yOf(prev[i]), H - B), fill: 'var(--s0)', 'pointer-events': 'none' }));
    if (cur[i] != null) kids.push(svg('path', { d: barPath(RP.compare ? mid + 1 : mid - bw / 2, yOf(cur[i]), bw, H - B - yOf(cur[i]), H - B), fill: 'var(--s1)', 'pointer-events': 'none' }));
    kids.push(svgText(mid, H - 4, mName[0])); });
  const table = () => h('table.rc-tbl', h('thead', h('tr', h('th', 'Month'), h('th', String(y)), RP.compare && h('th', String(y - 1)), RP.compare && h('th', 'Change'))),
    h('tbody', MON.map((mName, i) => h('tr', h('td', mName), h('td', cur[i] == null ? '—' : fmt.money(cur[i])), RP.compare && h('td', fmt.money(prev[i])), RP.compare && h('td', cur[i] == null ? '' : pct(cur[i], prev[i])))), h('tr', h('td', h('b', 'Total')), h('td', h('b', fmt.money(ytd))), RP.compare && h('td', h('b', fmt.money(prev.reduce((s, v) => s + v, 0)))), RP.compare && h('td', ''))));
  return h('div.rc-card', h('div.hd', h('div', h('h4', 'Invoiced each month'), sub), h('button.mini', { onclick: () => { RP.compare = !RP.compare; re(); } }, RP.compare ? 'Hide ' + (y - 1) : 'Compare ' + (y - 1)), h('button.mini', { onclick: () => { RP.table = !RP.table; re(); } }, RP.table ? 'Chart' : 'Table')),
    h('div.rc-legend', h('span', h('i', { style: 'background:var(--s1)' }), String(y)), RP.compare && h('span', h('i', { style: 'background:var(--s0)' }), String(y - 1))),
    RP.table ? table() : svg('svg', { class: 'rc-chart', viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Invoiced each month, ' + y + (RP.compare ? ' compared with ' + (y - 1) : '') }, kids));
}
const hbars = (rows, totalAll) => { const max = Math.max(1, ...rows.map(r => r[1])); return rows.map(([name, v, tap]) => h('div.rc-hbar', { onclick: tap, style: tap ? 'cursor:pointer' : null }, h('span.t', name), h('span.amt', fmt.money(v), totalAll ? h('small', Math.round(v / totalAll * 100) + '%') : null), h('div.bar', h('i', { style: { width: v / max * 100 + '%' } })))); };
function insights(A) {
  const y = yr(today()), curM = D.parse(today()).getMonth(), key = (yy, i) => yy + '-' + String(i + 1).padStart(2, '0'), cur = [...Array(curM + 1)].map((_, i) => monthTotal(key(y, i))), prev = cur.map((_, i) => monthTotal(key(y - 1, i))), a = cur.reduce((s, v) => s + v, 0), b = prev.reduce((s, v) => s + v, 0);
  const best = cur.indexOf(Math.max(...cur)), svc = Object.entries(A.by).sort((p, n) => n[1] - p[1]), all = (data.invoices || []).filter(i => i.status !== 'Paid' && i.status !== 'Draft'), over = all.filter(i => RC.invStatus(i) === 'Overdue'), byCust = {};
  over.forEach(i => { byCust[i.customerId] = (byCust[i.customerId] || 0) + i.amount; }); const worst = Object.entries(byCust).sort((p, n) => n[1] - p[1])[0], overSum = over.reduce((s, i) => s + i.amount, 0);
  return [b ? h('span', h('b', 'Sales are ' + (a >= b ? 'up ' : 'down ') + Math.abs(Math.round((a - b) / b * 100)) + '%'), ' on the same months of ' + (y - 1) + ' (' + fmt.money(a) + ' against ' + fmt.money(b) + ').') : null,
    h('span', h('b', MON[best] + ' was the strongest month'), ' this year at ' + fmt.money(cur[best]) + '.'),
    svc.length > 1 && A.total ? h('span', h('b', svc[0][0] + ' brings in ' + Math.round(svc[0][1] / A.total * 100) + '%'), ' of revenue in this date range; ' + svc[1][0].toLowerCase() + ' is next at ' + Math.round(svc[1][1] / A.total * 100) + '%.') : null,
    worst ? h('span', h('b', (q.customer(worst[0]) || { name: 'One customer' }).name + ' holds ' + Math.round(worst[1] / overSum * 100) + '% of what is past due'), ' (' + fmt.money(worst[1]) + ' of ' + fmt.money(overSum) + '). A statement with the invoices attached is the quickest next step.') : h('span', 'Nothing is past due.')].filter(Boolean);
}
function reportsRoot() {
  return { title: 'Reports', large: true, trailing: page => [{ label: 'Edit', onTap: () => ui.sheet({ title: 'Reports shown', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: () => ui.list(ui.section({ fold: false, footer: 'Your choice of what shows on the Reports screen.' }, CARDS.map(([id, name, sub]) => ui.toggleRow({ title: name, subtitle: sub, value: S.prefs.reportCards[id], onChange: v => { S.prefs.reportCards[id] = v; WD.changed(); } })))) }, { detent: 'large' }).closed.then(() => page.refresh()) }],
    render: page => { if (!(WD.can('analytics.view') || WD.can('billing.view'))) return ui.empty({ icon: 'lock', title: 'Reports are hidden', text: 'You need Analytics or billing access to see reports.' });
      const on = S.prefs.reportCards, re = () => page.refresh(), money$ = WD.can('billing.view'), A = aggregate(RP.f), y = yr(today()), all = (data.invoices || []).filter(i => i.status !== 'Draft'), open = all.filter(i => i.status !== 'Paid'), over = open.filter(i => RC.invStatus(i) === 'Overdue');
      const H = history(), paidHist = Object.keys(H).filter(k => +k.slice(0, 4) === y).reduce((s, k) => ({ n: s.n + H[k].count, v: s.v + H[k].paid }), { n: 0, v: 0 }), paidLive = liveInv().filter(i => i.status === 'Paid' && yr(i.day) === y);
      const sum = l => l.reduce((s, i) => s + i.amount, 0), go = (range, status) => () => { RC.invFilter.range = range; RC.invFilter.status = status; WD.nav.switchTab('invoices'); };
      const tile = (label, color, n, v, tap) => h('div.rc-tile', { onclick: tap, role: 'button' }, h('div.l', h('i', { style: { background: color } }), label), h('div.v', fmt.money(v)), h('div.n', plural(n, 'invoice')));
      const ag = [0, 0, 0, 0]; open.forEach(i => { const a = D.diff(today(), i.day); ag[a <= 30 ? 0 : a <= 60 ? 1 : a <= 90 ? 2 : 3] += i.amount; });
      const years = Object.entries(A.years).sort((a, b) => b[0] - a[0]), svc = CATS.map(k => [k, A.by[k] || 0]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]), top = Object.entries(A.cust).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (!money$) return ui.list(note('Invoice and sales reports need billing access. Route performance is still available.'), WD.biz && WD.biz.perfSpec && ui.section(null, ui.row({ icon: 'chart.bar', iconColor: 'var(--blue)', title: 'Route performance', chevron: true, onTap: () => page.push(WD.biz.perfSpec()) })));
      return [RC.filterBar(RP.f, re), h('div', { style: 'padding:0 16px 20px' },
        on.tiles && h('div.rc-tiles', tile('Overdue', 'var(--red)', over.length, sum(over), go('life', 'overdue')), tile('Unpaid', 'var(--orange)', open.length, sum(open), go('life', 'unpaid')), tile('Paid ' + y, 'var(--green)', paidHist.n + paidLive.length, paidHist.v + sum(paidLive), go('year', 'paid'))),
        on.monthly && monthlyCard(re),
        on.insights && RC.aiBlock('insights', () => RC.aiCard({ title: 'Insights', lines: insights(A) })),
        on.years && h('div.rc-card', h('h4', 'Sales by year'), h('div.sub', RC.rangeLabel(RP.f) + ' · ' + fmt.money(A.total) + ' in ' + plural(A.count, 'invoice')), years.length ? hbars(years.map(([k, v]) => [k + (+k === y ? ' so far' : ''), v])) : h('div.sub', 'No sales in this date range.')),
        on.services && h('div.rc-card', h('h4', 'Revenue by service'), h('div.sub', RC.rangeLabel(RP.f)), svc.length ? hbars(svc, A.total) : h('div.sub', 'No sales in this date range.')),
        on.aging && h('div.rc-card', h('h4', 'What customers owe'), h('div.sub', fmt.money(sum(open)) + ' unpaid, by the age of the invoice'), hbars([['30 days or less', ag[0]], ['31 to 60 days', ag[1]], ['61 to 90 days', ag[2]], ['Over 90 days', ag[3]]], sum(open) || 1)),
        on.top && top.length > 0 && h('div.rc-card', h('h4', 'Top customers'), h('div.sub', RC.rangeLabel(RP.f) + ' · from invoices on record'), hbars(top.map(([id, v]) => [(q.customer(id) || { name: 'Customer' }).name, v, () => WD.screens.customers.openDetail(id)]))),
        ui.list(ui.section({ header: 'More reports', fold: false }, WD.biz && WD.biz.perfSpec && ui.row({ icon: 'route', iconColor: 'var(--teal)', title: 'Route performance', subtitle: 'Billed per stop, per hour and per mile', chevron: true, onTap: () => page.push(WD.biz.perfSpec()) }),
          WD.timeclock && WD.timeclock.timesheetsSpec && WD.can('hr.manage') && ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Hours and overtime', chevron: true, onTap: () => page.push(WD.timeclock.timesheetsSpec()) }))),
        h('div.footnote.secondary', { style: 'padding:0 4px' }, 'Prototype: months before ' + fmt.day(cut, 'month') + ' use generated sales history; later months come from the invoices on record.'))]; } };
}
WD.screens.reports = { root: reportsRoot };

/* ================= Price Calc ================= */
/** Assumptions for both calculators; all editable on the screen. Area prices are the owner's base price for a standard purge in places off the regular routes. */
const CALC = data.calc = { perMile: 2, labor: 50, opp: 200, mph: 32, road: 1.3, base: 150, included: 14, extra: 8, zone: 6,
  areas: [{ id: 'ar1', name: 'Lakemont (on the regular routes)', price: 150 }, { id: 'ar2', name: 'North Lakemont', price: 150 }, { id: 'ar3', name: 'Ridgeview', price: 185 }, { id: 'ar4', name: 'Cedar Flats (rural)', price: 225 }, { id: 'ar5', name: 'Harlan County (rural)', price: 275 }] };
const PC = { mode: 'cost', text: '', spot: null, addr: '', from: 'nearest', boxes: 14, sugs: [] };
const MILE = 25, hashSpot = a => { let n = 7; for (const ch of a.toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return { x: 120 + n % 760, y: 120 + (n >>> 9) % 760 }; };
const milesBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) / MILE * CALC.road;
/** The closest customer stop on the schedule in the next two weeks. */
const nearestJob = spot => { const end = D.add(today(), 14); let best = null; data.jobs.forEach(j => { if (j.allDay || j.x == null || j.day < today() || j.day > end || WD.closed[j.status]) return; const d = milesBetween(spot, j); if (!best || d < best.miles) best = { job: j, miles: d }; }); return best; };
/** How far a place is from the regular routes: the closest location of a recurring customer. */
const offRoute = spot => { let best = Infinity; data.customers.forEach(c => { if (!c.freq || c.freq === 'One time' || c.lifecycle !== 'customer') return; c.locations.forEach(l => { if (l.x != null) best = Math.min(best, milesBetween(spot, l)); }); }); return best; };
const r5 = v => Math.round(v / 5) * 5;
function calcRoot() {
  const field = (label, key, unit, o = CALC) => h('div.row', h('div.row-main', h('div.row-title', label)), h('span.secondary', { style: 'margin-right:4px' }, unit[0] === '$' ? '$' : ''), h('input.jb-rate', { style: 'width:70px', type: 'text', inputmode: 'decimal', 'aria-label': label, value: String(o[key]), onfocus: e => e.target.select(), onchange: e => { o[key] = Math.max(0, num(e.target.value)); WD.changed(); } }), h('span.secondary', { style: 'margin-left:5px;min-width:42px' }, unit.replace(/^\$/, '')));
  return { title: 'Price Calc', large: true, render: page => {
    const re = () => page.refresh(), pick = s => { PC.addr = s.address; PC.text = s.address; PC.spot = s.l ? { x: s.l.x, y: s.l.y } : hashSpot(s.address); PC.sugs = []; re(); };
    const sugBox = h('div.rc-sugs'), showSugs = () => { sugBox.replaceChildren(...PC.sugs.map(s => h('button', { onclick: () => pick(s) }, s.title, h('small', s.sub)))); };
    const addr = ui.section({ header: 'Address', fold: false }, ui.inputRow({ icon: 'mappin', placeholder: 'Street, city', value: PC.text, onInput: v => { PC.text = v; PC.sugs = WD.addressSuggestions ? WD.addressSuggestions(v).slice(0, 5) : []; showSugs(); }, onEnter: v => v.trim() && pick({ address: v.trim() }) }), sugBox,
      PC.spot && ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: PC.addr, trailing: h('button.cu-link', { style: 'border:0;background:none;color:var(--tint);font:inherit;cursor:pointer', onclick: () => { PC.spot = null; PC.addr = PC.text = ''; re(); } }, 'Clear') }));
    showSugs();
    const seg = h('div', { style: 'padding:0 16px 10px' }, ui.segmented([{ value: 'cost', label: 'Cost to serve' }, { value: 'purge', label: 'Purge price' }], PC.mode, v => { PC.mode = v; re(); }));
    const near = PC.spot && nearestJob(PC.spot);
    if (PC.mode === 'cost') {
      const froms = [{ value: 'nearest', label: 'Closest customer on the schedule' }].concat(data.places.map(p => ({ value: p.id, label: p.name })));
      const origin = PC.spot && (PC.from === 'nearest' ? (near ? near.job : null) : data.places.find(p => p.id === PC.from)), oneWay = origin ? milesBetween(PC.spot, origin) : 0, miles = oneWay * 2, hours = miles / CALC.mph;
      const veh = miles * CALC.perMile, lab = hours * CALC.labor, opp = hours * CALC.opp;
      return [seg, ui.list(addr,
        ui.section({ header: 'Measured from', fold: false, footer: PC.from === 'nearest' ? 'The nearest customer with a job in the next two weeks, so the trip is priced as a detour from a route that is already running.' : 'A round trip from this place and back.' },
          ui.pickerRow({ title: 'From', value: PC.from, options: froms, onChange: v => { PC.from = v; re(); } }),
          PC.spot && PC.from === 'nearest' && (near ? ui.row({ icon: 'person.2', iconColor: q.routeColor(near.job.routeId), title: near.job.title, subtitle: fmt.day(near.job.day, 'short') + ' · ' + q.routeName(near.job.routeId) + ' · ' + fmt.dist(near.miles) + ' away' }) : ui.row({ title: 'No scheduled customers in the next two weeks', subtitle: 'Choose one of your places instead' }))),
        PC.spot && origin ? h('div', h('div.rc-sum', h('div', h('span', 'Round trip'), h('span', fmt.dist(miles))), h('div', h('span', 'Drive time'), h('span', fmt.dur(Math.max(1, hours * 60)))),
            h('div.muted', h('span', 'Vehicle · ' + fmt.dist(miles) + ' × ' + money(CALC.perMile)), h('span', money(veh))), h('div.muted', h('span', 'Labor · ' + hours.toFixed(2) + ' h × ' + money(CALC.labor)), h('span', money(lab))),
            h('div.big', h('span', 'Total cost'), h('span', money(veh + lab)))),
          h('div.rc-sum', h('div.muted', h('span', 'Opportunity cost · ' + hours.toFixed(2) + ' h × ' + money(CALC.opp)), h('span', money(opp))), h('div.big', h('span', 'Total with opportunity cost'), h('span', money(veh + lab + opp)))),
          h('div.footnote.secondary', { style: 'padding:0 6px 14px' }, 'Opportunity cost is the revenue the truck would normally earn in the time spent driving: about ' + fmt.money(CALC.opp) + ' an hour.'))
          : note('Enter an address to see the miles, drive time and cost of the round trip.'),
        ui.section({ header: 'Assumptions', fold: true, folded: !!PC.spot, footer: 'Miles are road miles (straight-line distance × ' + CALC.road + '). Changes apply to both calculators.' }, field('Vehicle cost', 'perMile', '$per mile'), field('Labor', 'labor', '$per hour'), field('Lost revenue', 'opp', '$per hour'), field('Average speed', 'mph', 'mph')))];
    }
    /* Purge price */
    const std = CALC.base + Math.max(0, PC.boxes - CALC.included) * CALC.extra, off = PC.spot ? offRoute(PC.spot) : 0, inZone = off <= CALC.zone, area = PC.spot && CALC.areas.find(a => PC.addr.toLowerCase().includes(a.name.replace(/\s*\(.*\)/, '').toLowerCase()));
    const extraMiles = Math.max(0, off - CALC.zone) * 2, extraH = extraMiles / CALC.mph, tripCost = extraMiles * CALC.perMile + extraH * CALC.labor, areaAdd = area ? Math.max(0, area.price - CALC.base) : 0;
    const tripAdd = r5(tripCost + extraH * CALC.opp * 0.5), pairPrice = near ? Math.max(std, r5(std + (near.miles * 2 * CALC.perMile + near.miles * 2 / CALC.mph * CALC.labor))) : Infinity;
    const add = inZone ? areaAdd : Math.max(areaAdd, tripAdd), rec = std + add, low = std + (inZone ? areaAdd : Math.max(areaAdd, r5(tripCost))), high = std + (inZone ? areaAdd : Math.max(areaAdd, r5(tripCost + extraH * CALC.opp)));
    const lines = () => [inZone ? h('span', h('b', 'On your regular routes.'), ' The nearest regular customer is ' + fmt.dist(off) + ' away, so the standard rate covers it.') : h('span', h('b', fmt.dist(off) + ' from your nearest regular customer.'), ' That is ' + fmt.dist(extraMiles) + ' and about ' + fmt.dur(Math.max(1, extraH * 60)) + ' of extra driving beyond your ' + CALC.zone + '-mile range, costing ' + money(tripCost) + ' in truck and labor.'),
      area ? h('span', h('b', 'Your base price for ' + area.name.replace(/\s*\(.*\)/, '') + ' is ' + fmt.money(area.price) + '.'), areaAdd ? ' Used as the floor.' : ' Same as standard.') : !inZone ? h('span', 'No base price is saved for this area. Similar distances in your list run ' + fmt.money(Math.min(...CALC.areas.filter(a => a.price > CALC.base).map(a => a.price))) + ' to ' + fmt.money(Math.max(...CALC.areas.map(a => a.price))) + '.') : null,
      !inZone ? (areaAdd >= tripAdd ? h('span', h('b', 'Recommended ' + fmt.money(rec) + '.'), ' Your area price already covers the extra driving.') : h('span', h('b', 'Recommended ' + fmt.money(rec) + '.'), ' Covers the trip plus half of the revenue the truck gives up. Don’t go below ' + fmt.money(low) + '; ' + fmt.money(high) + ' recovers all of it.')) : areaAdd ? h('span', h('b', 'Recommended ' + fmt.money(rec) + '.'), ' It is on your routes, but your price list charges more in this area.') : null,
      near && !inZone && !area && pairPrice < rec ? h('span', h('b', 'Cheaper day: ' + fmt.day(near.job.day, 'long') + '.'), ' ' + q.routeName(near.job.routeId) + ' is already at ' + near.job.title + ', ' + fmt.dist(near.miles) + ' away. Offering that day could justify ' + fmt.money(pairPrice) + '.') : null].filter(Boolean);
    return [seg, ui.list(addr,
      ui.section({ header: 'The job', fold: false }, ui.row({ icon: 'shippingbox', iconColor: 'var(--brown)', title: 'Boxes', subtitle: 'Standard banker boxes', trailing: h('div.hstack', { style: 'gap:8px' }, ui.numField(PC.boxes, 1, 2000, v => { PC.boxes = v; re(); }, 'Boxes'), ui.stepper(PC.boxes, 1, 2000, v => { PC.boxes = v; re(); })) })),
      h('div.rc-sum', h('div.muted', h('span', 'Show up and shred up to ' + CALC.included + ' boxes'), h('span', money(CALC.base))), PC.boxes > CALC.included && h('div.muted', h('span', (PC.boxes - CALC.included) + ' more × ' + money(CALC.extra)), h('span', money((PC.boxes - CALC.included) * CALC.extra))),
        h('div', h('span', 'Standard rate'), h('span', money(std))), PC.spot && add > 0 && h('div.muted', h('span', inZone ? 'Area price difference' : 'Out-of-area charge'), h('span', '+ ' + money(add))), PC.spot && h('div.big', h('span', inZone && !add ? 'Price' : 'Recommended price'), h('span', money(rec)))),
      PC.spot ? RC.aiBlock('pricing', () => RC.aiCard({ title: 'Pricing recommendation', lines: lines() })) : note('Enter the address to check whether it is on your regular routes and get a recommended price.'),
      PC.spot && !RC.ai('pricing') && !inZone && h('div.footnote.secondary', { style: 'padding:0 6px 12px' }, 'Without the recommendation: this address is ' + fmt.dist(off) + ' off your routes; the out-of-area charge above is the cost of the extra driving.'),
      ui.section({ header: 'Base prices by area', fold: true, folded: true, count: CALC.areas.length, footer: 'Your price for a standard purge in each place. An address that mentions the area’s name uses it as the floor.' },
        CALC.areas.map(a => ui.row({ title: a.name, detail: fmt.money(a.price), chevron: true, onTap: async () => { const v = await ui.actionSheet({ title: a.name, buttons: [{ label: 'Change the price…', value: 'p' }, { label: 'Rename…', value: 'n' }, { label: 'Remove', value: 'x', role: 'destructive' }] });
          if (v === 'p') { const t = await RC.ask('Base price for ' + a.name, 'e.g. 225', a.price, null, 'number'); if (t) a.price = num(t); } else if (v === 'n') { const t = await RC.ask('Area name', '', a.name); if (t) a.name = t; } else if (v === 'x') CALC.areas.splice(CALC.areas.indexOf(a), 1); WD.changed(); re(); } })),
        ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an area', tint: true, onTap: async () => { const n = await RC.ask('Area or town', 'e.g. Pine Hollow'); if (!n) return; const p = await RC.ask('Base price for ' + n, 'e.g. 200', '', null, 'number'); CALC.areas.push({ id: uid('ar'), name: n, price: num(p) || CALC.base }); WD.changed(); re(); } }),
        h('label.row.tappable', { style: 'cursor:pointer' }, h('div.row-icon.plain', { style: { color: 'var(--tint)' } }, icon('doc', 24)), h('div.row-main', h('div.row-title.tint', 'Upload a price list'), h('div.row-sub', 'CSV: one area and price per line')),
          h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', style: 'display:none', onchange: e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { let n = 0; String(r.result).split(/\r?\n/).forEach(line => { const m = /^\s*"?([^",]+?)"?\s*[,;\t]\s*\$?\s*([\d.]+)/.exec(line); if (!m || !+m[2]) return; const ex = CALC.areas.find(a => a.name.toLowerCase() === m[1].trim().toLowerCase()); if (ex) ex.price = +m[2]; else CALC.areas.push({ id: uid('ar'), name: m[1].trim(), price: +m[2] }); n++; }); WD.changed(); re(); ui.toast(n ? plural(n, 'area') + ' loaded' : 'No “area, price” lines found', n ? 'checkmark' : 'exclamationmark.triangle', 2600); }; r.readAsText(file); } }))),
      ui.section({ header: 'Standard purge rate', fold: true, folded: true, footer: 'The standard rate applies anywhere within ' + CALC.zone + ' road miles of a regular customer.' }, field('Show-up price', 'base', '$'), field('Boxes included', 'included', 'boxes'), field('Each additional box', 'extra', '$per box'), field('Regular-route range', 'zone', 'miles')))];
  } };
}
WD.screens.calc = { root: calcRoot };

WD.panel.addJump('Reports', () => WD.nav.switchTab('reports'));
WD.panel.addJump('Price Calc', () => WD.nav.switchTab('calc'));
WD.panel.addJump('New invoice', () => { WD.nav.switchTab('invoices'); RC.newInvoice(); });
WD.panel.addJump('Statement', () => { const c = data.customers.find(x => (data.invoices || []).filter(i => i.customerId === x.id && i.status !== 'Paid').length > 1); if (c) { WD.nav.switchTab('customers'); RC.openStatement(c); } });
})();
