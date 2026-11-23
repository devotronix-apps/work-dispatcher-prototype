/* RouteClerk prototype — version 4.0 money (`WD.rc`, continued): date-range and status filters for invoices and service notes; creating,
   viewing, sending and deleting invoices and service notes from the Invoices section; customer statements (one customer or many, with the
   unpaid invoices in the same PDF, and the billing email reviewed first); the Reports section; and the two Price Calc calculators. Also: writing an invoice off as bad debt or voiding it (`RC.closeInvoice`,
   `WD.badDebt`, `WD.badDebtBanner`), and billing completed stops and open service notes from the Route performance report. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc, uid = RC.uid, plural = RC.plural, num = RC.num;
const today = () => D.today(), me = () => (S.me || {}).name || 'You', money = n => fmt.money(n, true), yr = k => +k.slice(0, 4), cents = n => Math.round(n * 100) / 100;
const BAD = WD.INV_BAD || 'Bad debt', VOID = WD.INV_VOID || 'Void', invClosed = i => !!i && (i.status === BAD || i.status === VOID), invOpen = i => !!i && i.status !== 'Paid' && i.status !== 'Draft' && !invClosed(i);
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
.rc-chart text { font-size: 12px; fill: var(--label2); letter-spacing: 0; } .rc-chart .grid { stroke: var(--sep); stroke-width: .5; } .rc-chart .hit { fill: transparent; cursor: pointer; } .rc-chart .hit.on { fill: var(--fill3); }
.rc-hbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; align-items: center; padding: 6px 0; font-size: 14px; letter-spacing: -.1px; } .rc-hbar .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-hbar .amt { font-weight: 600; text-align: right; } .rc-hbar .amt small { color: var(--label2); font-weight: 400; margin-left: 5px; font-size: 12px; }
.rc-hbar .bar { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: var(--fill3); } .rc-hbar .bar i { display: block; height: 100%; border-radius: 4px; background: var(--s1); min-width: 2px; }
.rc-tbl { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; } .rc-tbl td, .rc-tbl th { padding: 5px 2px; text-align: right; border-bottom: .5px solid var(--sep); font-variant-numeric: tabular-nums; } .rc-tbl td:first-child, .rc-tbl th:first-child { text-align: left; } .rc-tbl th { color: var(--label2); font-weight: 500; font-size: 12px; }
.rc-sum { border-radius: 12px; background: var(--cell); margin: 0 0 14px; overflow: hidden; } .rc-sum div { display: flex; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: .5px solid var(--sep); font-size: 15px; } .rc-sum div:last-child { border: 0; }
.rc-sum .big { font-weight: 700; font-size: 17px; } .rc-sum .muted span:first-child { color: var(--label2); }
.rc-sugs { background: var(--cell); border-radius: 0 0 10px 10px; } .rc-sugs button { display: block; width: 100%; text-align: left; border: 0; border-top: .5px solid var(--sep); background: none; padding: 8px 16px; font: inherit; font-size: 15px; color: var(--label); cursor: pointer; } .rc-sugs small { display: block; color: var(--label2); font-size: 12px; letter-spacing: 0; }
.rc-st h2 { color: #1E7B34; font: 23px/26px Georgia, 'Times New Roman', serif; margin: 0 0 4px; font-weight: 400; }
/* The date range stays at the top of the page while the report scrolls under it. */
.rc-sticky { position: sticky; top: 0; z-index: 6; background: var(--bg); padding-top: 8px; box-shadow: 0 7px 8px -8px rgba(0,0,0,.28); }
.rc-sticky .rc-fbar { padding-bottom: 8px; } .rc-sticky .rc-pill { height: 44px; border-radius: 22px; padding: 0 14px 0 16px; font-size: 15px; box-shadow: 0 1px 4px rgba(0,0,0,.16); background: var(--cell); } .rc-sticky .rc-pill.on { background: var(--tint); }
.rc-sum .tap { cursor: pointer; min-height: 44px; align-items: center; box-sizing: border-box; }
/* Bad debt flag: red, on the customer record, the incoming-call card and the job editor. */
.rc-bd { display: flex; align-items: flex-start; gap: 10px; margin: 8px 16px; padding: 10px 12px; border-radius: 12px; background: var(--cell); border: 1.5px solid var(--red); color: var(--label); font-size: 14px; line-height: 19px; letter-spacing: -.1px; text-align: left; }
.rc-bd > svg { flex: none; margin-top: 1px; } .rc-bd .t { flex: 1; min-width: 0; } .rc-bd b { color: var(--red); font-weight: 700; } .rc-bd small { display: block; font-size: 12px; color: var(--label2); letter-spacing: 0; margin-top: 2px; }
.rc-bd .a { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 2px; } .rc-bd .a button { border: 0; background: none; color: var(--tint); font: inherit; font-weight: 600; min-height: 44px; padding: 0 2px; cursor: pointer; }
.rc-bd.void { border-color: var(--sep); } .rc-bd.void b { color: var(--label); }
`);

/* ================= Date range and status filters ================= */
const RANGES = [['life', 'Lifetime'], ['year', 'This Year'], ['lastyear', 'Last Year'], ['month', 'This Month'], ['lastmonth', 'Last Month'], ['week', 'This Week'], ['yesterday', 'Yesterday'], ['today', 'Today'], ['custom', 'Custom']];
const STATUSES = [['all', 'All'], ['paid', 'Paid'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['baddebt', 'Bad debt'], ['void', 'Void']];
RC.invFilter = { range: 'life', status: 'all', from: '', to: '' };
/** [first day, last day] of a filter's range; null = open-ended. Weeks start on Sunday. */
RC.rangeOf = f => { const t = today(), d = D.parse(t), y = d.getFullYear(), m = d.getMonth(), k = (yy, mm, dd) => D.key(new Date(yy, mm, dd, 12));
  switch (f.range) { case 'year': return [k(y, 0, 1), k(y, 11, 31)]; case 'lastyear': return [k(y - 1, 0, 1), k(y - 1, 11, 31)]; case 'month': return [k(y, m, 1), k(y, m + 1, 0)]; case 'lastmonth': return [k(y, m - 1, 1), k(y, m, 0)];
    case 'week': { const s = D.add(t, -d.getDay()); return [s, D.add(s, 6)]; } case 'yesterday': return [D.add(t, -1), D.add(t, -1)]; case 'today': return [t, t]; case 'custom': return [f.from || null, f.to || null]; default: return [null, null]; } };
RC.inRange = (day, f) => { const [a, b] = RC.rangeOf(f); return (!a || day >= a) && (!b || day <= b); };
RC.rangeLabel = f => f.range === 'custom' && (f.from || f.to) ? (f.from ? mdy(f.from) : 'Start') + ' – ' + (f.to ? mdy(f.to) : 'Today') : (RANGES.find(r => r[0] === f.range) || RANGES[0])[1];
/** Paid, Draft, Bad debt (written off), Void, Overdue (unpaid longer than the past-due setting, 45 days unless changed) or Sent. */
RC.invStatus = r => r.status === 'Paid' || r.status === 'Draft' || invClosed(r) ? r.status : D.diff(today(), r.day) > overdueDays() ? 'Overdue' : 'Sent';
const statusOK = (st, f) => f.status === 'all' || (f.status === 'paid' ? st === 'Paid' : f.status === 'overdue' ? st === 'Overdue' : f.status === 'baddebt' ? st === BAD : f.status === 'void' ? st === VOID : st !== 'Paid' && st !== 'Draft' && st !== BAD && st !== VOID);
RC.invMatch = r => RC.inRange(r.day, RC.invFilter) && statusOK(RC.invStatus(r), RC.invFilter);
/** A service note is paid when its master invoice is; until then it is unpaid, and overdue once it (or its master invoice) passes the past-due setting. */
RC.noteStatus = n => { const mi = n.masterId && (data.invoices || []).find(i => i.masterId === n.masterId); return mi ? RC.invStatus(mi) : D.diff(today(), n.day) > overdueDays() ? 'Overdue' : 'Sent'; };
RC.noteMatch = n => RC.inRange(n.day, RC.invFilter) && statusOK(RC.noteStatus(n), RC.invFilter);
RC.invFilterOn = () => RC.invFilter.range !== 'life' || RC.invFilter.status !== 'all';
/** Two drop-downs: date range, and (o.status) All / Paid / Unpaid / Overdue / Bad debt / Void. Custom shows two date boxes. */
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
/* One numbering for every new invoice, wherever it is created: one more than the highest number in use. */
const numOf = s => +String(s || '').replace(/\D/g, '') || 0;
const nextNumber = WD.nextInvoiceNumber = () => 'INV-' + (Math.max(2600, ...(data.invoices || []).map(i => numOf(i.number)), ...data.jobs.map(j => j.invoice ? numOf(j.invoice.number) : 0)) + 1);
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
      data.invoices.push({ id: uid('inv-n'), number, customerId: c.id, jobId: null, day: f.day, amount, status: 'Sent', lines: lines.map(l => ({ ...l })), tax: tx.tax || 0, taxRate: tx.rate || 0, taxLabel: tx.label, taxes: tx.taxes || [], po: f.po.trim(), payments: [], at: +WD.now(), auto: false, sentAt: f.send ? +WD.now() : null, sentTo: f.send ? f.email.trim() : null, by: me() });
      if (c.stats) { c.stats.invoiced += amount; c.stats.balance += amount; } if (f.send) logMail(c, 'Invoice ' + number, 'Invoice ' + number + ' for ' + money(amount) + ' is attached.', f.email.trim());
    }, { done: f.send ? number + ' sent' : number + ' created' });
    if (ok) p.dismiss(); };
  ui.sheet({ title: 'New invoice', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Create', bold: true, onTap: create }],
    render: p => { const c = f.c, tx = c && WD.taxInfo ? WD.taxInfo(f.lines, c) : { tax: 0, rate: 0 }, sum = total(f.lines) + (tx.tax || 0);
      return ui.list(
        ui.section({ fold: false }, ui.row({ icon: 'person.crop.circle', iconPlain: true, title: c ? c.name : 'Choose a customer', subtitle: c ? (c.locations[0] || {}).address : null, tint: !c, chevron: true, onTap: () => custPicker(p, x => setC(x)) }),
          ui.dateRow({ title: 'Invoice date', value: f.day, onChange: v => { f.day = v; } })),
        c && linesSection(p, f, 'Lines · starts from their usual service'),
        c && h('div.rc-sum', tx.tax > 0 && ((tx.taxes || []).filter(t => t.amount > 0).length > 1 ? tx.taxes.filter(t => t.amount > 0).map(t => h('div.muted', h('span', t.label), h('span', money(t.amount)))) : h('div.muted', h('span', tx.label), h('span', money(tx.tax)))), h('div.big', h('span', 'Total'), h('span', money(sum)))),
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
  return B.standardInvoice({ number: rec.number, date: rec.day, terms: c && c.terms, billTo: billTo(c), lines: recLines(rec), tax: rec.tax, taxLabel: rec.taxLabel, taxes: rec.taxes, stamp: WD.invStamp ? WD.invStamp(rec) : null, paid: rec.status === 'Paid', payMethod: WD.cardPrice ? WD.cardPrice.methodOf(rec) : null, po: rec.po, sigs: [] }); };
RC.viewInvoice = rec => ui.sheet({ title: rec.number, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: () => WD.screens.billing.docWrap([invoiceNode(rec)]) }, { detent: 'large' });
RC.sendInvoice = async rec => { const c = q.customer(rec.customerId), r = await ui.alert({ title: 'Send ' + rec.number, message: 'Emailed as a PDF with a pay link.', input: { placeholder: 'Email address', value: rec.sentTo || emailOf(c), type: 'email' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Send', value: true, bold: true }] });
  if (!r || !r.value) return; if (!validEmail(r.text)) return ui.toast('That isn’t an email address', 'envelope');
  await ui.run('Sending…', () => { rec.sentAt = +WD.now(); rec.sentTo = r.text.trim(); if (c) logMail(c, 'Invoice ' + rec.number, 'Invoice ' + rec.number + ' for ' + money(rec.amount) + ' is attached.', rec.sentTo); }, { done: 'Sent to ' + r.text.trim() }); };
RC.deleteInvoice = async rec => { const c = q.customer(rec.customerId), paid = rec.status === 'Paid';
  const ok = await ui.actionSheet({ title: 'Delete ' + rec.number + '?', message: (paid ? 'This invoice is paid. Deleting it also removes its payment record. ' : '') + 'It comes off ' + (c ? c.name + '’s' : 'the customer’s') + ' account and can’t be brought back.' + (rec.jobId ? ' The job goes back to “not billed”.' : ''), buttons: [{ label: 'Delete invoice', role: 'destructive', value: true }] }); if (!ok) return;
  if (await ui.run('Deleting…', () => { data.invoices = data.invoices.filter(i => i !== rec); if (data.payments) data.payments = data.payments.filter(p => p.invoiceId !== rec.id);
    if (c && c.stats) { c.stats.invoiced = Math.max(0, c.stats.invoiced - (rec.status === VOID ? 0 : rec.amount)); if (paid) c.stats.paid = Math.max(0, c.stats.paid - rec.amount); else if (!invClosed(rec)) c.stats.balance = Math.max(0, c.stats.balance - rec.amount); }
    const j = rec.jobId && q.job(rec.jobId); if (j) { j.invoice = null; j.events.push({ at: +WD.now(), actor: me(), text: 'Invoice ' + rec.number + ' deleted' }); }
    if (rec.master && data.serviceNotes) data.serviceNotes.forEach(n => { if (n.masterId === rec.masterId) n.masterId = null; });
  }, { done: 'Deleted' })) closeTop(); };
/* Add View (for invoices with no job), Send and Delete to every invoice's actions. */
if (WD.workflow && WD.workflow.invoiceActionRows) { const base = WD.workflow.invoiceActionRows;
  WD.workflow.invoiceActionRows = (rec, job, o) => { const rows = base(rec, job, o) || [], field = WD.can('billing.field') || WD.can('billing.manage'), hasView = rec.master || (job && job.invoice);
    const mg = WD.can('billing.manage'), open = invOpen(rec), closed = invClosed(rec);
    return [!hasView && ui.row({ title: 'View invoice', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => RC.viewInvoice(rec) })].concat(rows, [
      mg && rec.status === BAD && ui.row({ title: 'Record payment and clear the flag…', subtitle: 'Collected after all: marks it paid', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => RC.collectBadDebt(rec) }),
      mg && closed && ui.row({ title: 'Reopen invoice', subtitle: 'Undo: back to unpaid, in accounts receivable', icon: 'arrow.uturn.left', iconPlain: true, tint: true, onTap: () => RC.reopenInvoice(rec) }),
      field && !closed && ui.row({ title: rec.sentAt ? 'Send again…' : 'Send to the customer…', subtitle: rec.sentAt ? 'Last sent ' + fmt.rel(new Date(rec.sentAt)).toLowerCase() + (rec.sentTo ? ' to ' + rec.sentTo : '') : null, icon: 'envelope', iconPlain: true, tint: true, onTap: () => RC.sendInvoice(rec) }),
      mg && open && ui.row({ title: 'Write off as bad debt…', subtitle: 'Off accounts receivable; flags the customer until collected', icon: 'exclamationmark.triangle', iconPlain: true, iconColor: 'var(--red)', destructive: true, onTap: () => RC.closeInvoice(rec, 'bad') }),
      mg && open && ui.row({ title: 'Void invoice…', subtitle: 'Cancels the debt; no flag on the customer', icon: 'xmark.circle.fill', iconPlain: true, iconColor: 'var(--gray)', destructive: true, onTap: () => RC.closeInvoice(rec, 'void') }),
      WD.can('billing.manage') && ui.row({ title: 'Delete invoice…', icon: 'trash', iconPlain: true, iconColor: 'var(--red)', destructive: true, onTap: () => RC.deleteInvoice(rec) })]); }; }

/* ================= Bad debt and void ================= */
/* Two ways an unpaid invoice stops being owed. Both need a reason, are saved with who and when on the invoice (`rec.closed`, `rec.log`),
   leave accounts receivable, past-due balances, statements and unpaid warnings, and can be undone with Reopen invoice.
   Bad debt flags the customer until it is collected; void leaves no flag and no penalty. */
const logClose = (rec, text) => { (rec.log = rec.log || []).unshift({ at: +WD.now(), by: me(), text }); };
const mirrorJob = (rec, text) => { const j = rec.jobId && q.job(rec.jobId); if (!j) return; if (j.invoice) j.invoice.status = rec.status; j.events.push({ at: +WD.now(), actor: me(), text }); };
const needManage = () => WD.can('billing.manage') ? false : (ui.toast('This needs the Manage billing permission', 'lock', 2600), true);
/** kind: 'bad' (write off as bad debt) or 'void'. Asks for a reason, confirms, then closes the invoice. */
RC.closeInvoice = async (rec, kind) => {
  if (needManage()) return false; if (!invOpen(rec)) { ui.toast(rec.number + ' isn’t an open invoice', 'info.circle'); return false; }
  const bad = kind === 'bad', c = q.customer(rec.customerId), who = c ? c.name : 'The customer';
  const r = await ui.alert({ title: bad ? 'Write off ' + rec.number + ' as bad debt' : 'Void ' + rec.number, message: money(rec.amount) + (bad ? ' comes off accounts receivable and past-due balances. ' + who + ' is flagged so nobody schedules them again without collecting.' : ' comes off accounts receivable and past-due balances. ' + who + ' can still be scheduled as usual, with no flag.') + ' Why?',
    input: { placeholder: bad ? 'e.g. No reply to three statements' : 'e.g. Billed twice' }, buttons: [{ label: 'Cancel', value: null }, { label: bad ? 'Write off' : 'Void', value: true, bold: true }] });
  if (!r || !r.value) return false; const reason = (r.text || '').trim(); if (!reason) { ui.toast('A reason is required', 'pencil', 2400); return false; }
  if (!await ui.actionSheet({ title: (bad ? 'Write off ' : 'Void ') + rec.number + ' · ' + money(rec.amount) + '?', message: 'Reason: ' + reason + '. Saved on the invoice with your name and the time. Undo it later with “Reopen invoice”.', buttons: [{ label: bad ? 'Write off as bad debt' : 'Void invoice', role: 'destructive', value: true }] })) return false;
  return ui.run(bad ? 'Writing off…' : 'Voiding…', () => { const was = rec.status;
    rec.closed = { kind: bad ? 'bad' : 'void', was, reason, by: me(), at: +WD.now(), day: today() }; rec.status = bad ? BAD : VOID;
    logClose(rec, (bad ? 'Written off as bad debt' : 'Voided') + ' · ' + money(rec.amount) + ' · ' + reason);
    if (c && c.stats) { if (was === 'Overdue') c.stats.balance = Math.max(0, c.stats.balance - rec.amount); if (!bad) c.stats.invoiced = Math.max(0, c.stats.invoiced - rec.amount); }
    mirrorJob(rec, 'Invoice ' + rec.number + (bad ? ' written off as bad debt' : ' voided') + ' · ' + reason);
  }, { done: bad ? 'Written off as bad debt' : 'Invoice voided' });
};
/** Undo a write-off or a void: the invoice is unpaid again and back in accounts receivable. */
RC.reopenInvoice = async rec => {
  if (needManage() || !invClosed(rec)) return false; const bad = rec.status === BAD, c = q.customer(rec.customerId);
  if (!await ui.actionSheet({ title: 'Reopen ' + rec.number + '?', message: money(rec.amount) + ' goes back into accounts receivable as an unpaid invoice.' + (bad ? ' The bad-debt flag comes off ' + (c ? c.name : 'the customer') + ' if no other invoice is written off.' : ''), buttons: [{ label: 'Reopen invoice', value: true }] })) return false;
  return ui.run('Reopening…', () => { const k = rec.closed || {}; rec.status = k.was && k.was !== BAD && k.was !== VOID ? k.was : 'Sent'; rec.closed = null;
    logClose(rec, 'Reopened · was ' + (bad ? 'bad debt' : 'void'));
    if (c && c.stats) { if (rec.status === 'Overdue') c.stats.balance += rec.amount; if (!bad) c.stats.invoiced += rec.amount; }
    mirrorJob(rec, 'Invoice ' + rec.number + ' reopened');
  }, { done: 'Invoice reopened' });
};
/** The customer paid after all: record the payment against the written-off invoice. It becomes Paid and stops flagging the customer. */
RC.collectBadDebt = async rec => {
  if (needManage() || rec.status !== BAD) return false; const wf = WD.workflow; if (!wf || !wf.markPaid) return false;
  if (!await wf.markPaid(rec)) return false;
  rec.recovered = Object.assign({}, rec.closed, { paidAt: +WD.now(), paidBy: me() }); rec.closed = null; logClose(rec, 'Bad debt collected · ' + money(rec.amount) + ' · marked paid');
  WD.changed(); if (!WD.badDebt(rec.customerId)) ui.toast('Paid · bad-debt flag cleared', 'checkmark', 2600); return true;
};
/** “Clear the flag”: choose the written-off invoice that was collected and record its payment. */
RC.clearBadDebt = async cid => {
  const b = WD.badDebt(cid), c = q.customer(cid); if (!b || needManage()) return false; let rec = b.invoices[0];
  if (b.invoices.length > 1) { const id = await ui.actionSheet({ title: 'Which invoice was collected?', message: 'Record the payment against the written-off invoice. The flag clears when none are left.', buttons: b.invoices.map(i => ({ label: i.number + ' · ' + money(i.amount), value: i.id })) }); if (!id) return false; rec = b.invoices.find(i => i.id === id); }
  else if (!await ui.actionSheet({ title: 'Clear the bad-debt flag?', message: 'Record the payment for ' + rec.number + ' (' + money(rec.amount) + '). It is marked paid and the flag comes off ' + (c ? c.name : 'the customer') + '.', buttons: [{ label: 'Record the payment…', value: true }] })) return false;
  return RC.collectBadDebt(rec);
};
/** A customer's written-off invoices → { amount, count, last (day of the latest write-off), invoices } or null. Voided invoices never count. */
WD.badDebt = cid => { const list = cid ? (data.invoices || []).filter(i => i.customerId === cid && i.status === BAD) : []; if (!list.length) return null;
  return { amount: cents(list.reduce((s, i) => s + i.amount, 0)), count: list.length, last: list.reduce((m, i) => { const d = (i.closed && i.closed.day) || i.day; return d > m ? d : m; }, ''), invoices: list }; };
/** The red flag for a customer with bad debt, or null. o.actions adds “See the invoices” and (Manage billing) “Clear the flag…”. */
WD.badDebtBanner = (cid, o = {}) => { const b = WD.badDebt(cid); if (!b) return null; const SC = WD.screens.customers;
  return h('div.rc-bd', { role: 'alert' }, icon('exclamationmark.triangle', 22, 'var(--red)'), h('div.t', h('b', 'Wrote off ' + money(b.amount) + ' as bad debt on ' + longDay(b.last)), ' — collect before scheduling.', b.count > 1 ? h('small', plural(b.count, 'invoice') + ' written off') : null,
    o.actions && (WD.can('billing.view') || WD.can('billing.manage')) ? h('div.a', SC && SC.custInvoices && h('button', { onclick: () => WD.nav.push(SC.custInvoices(cid, false)) }, 'See the invoices'), WD.can('billing.manage') && h('button', { onclick: () => RC.clearBadDebt(cid) }, 'Clear the flag…')) : null)); };
/** Asked before a new job is saved for a customer with bad debt → true to go ahead. Customers without bad debt (voided debt included) are never asked. */
WD.badDebtConfirm = async cid => { const b = WD.badDebt(cid); if (!b) return true; const c = q.customer(cid);
  return !!(await ui.actionSheet({ title: 'Schedule anyway?', message: (c ? c.name : 'This customer') + ': wrote off ' + money(b.amount) + ' as bad debt on ' + longDay(b.last) + '. Collect before scheduling.', buttons: [{ label: 'Schedule anyway', value: true }], cancel: 'Don’t schedule' })); };
/** Under an invoice's heading: why it was written off or voided, by whom and when. */
RC.closedNote = rec => { const k = invClosed(rec) && rec.closed; if (!invClosed(rec)) return null; const bad = rec.status === BAD;
  return h('div.rc-bd' + (bad ? '' : '.void'), icon(bad ? 'exclamationmark.triangle' : 'xmark.circle.fill', 22, bad ? 'var(--red)' : 'var(--gray)'), h('div.t', h('b', bad ? 'Written off as bad debt' : 'Voided'), k ? ' by ' + k.by + ' on ' + longDay(k.day) : '', k && k.reason ? h('small', 'Reason: ' + k.reason) : null,
    h('small', bad ? 'Not in accounts receivable or past-due balances. The customer is flagged until this is collected.' : 'Not in accounts receivable or past-due balances. No flag on the customer.'))); };
/** Every write-off, void, reopen and collection on an invoice, newest first. */
RC.closeLogSection = rec => rec && rec.log && rec.log.length ? ui.section({ header: 'Write-off and void history', fold: false }, rec.log.map(l => ui.row({ title: l.text, subtitle: l.by + ' · ' + fmt.rel(new Date(l.at)) }))) : null;
/* Demo: one customer with one invoice written off as bad debt and one voided (billed twice), so the flag and both badges are visible. */
(function seedClosed() { const c = q.customer('c22') || data.customers.find(x => x.lifecycle === 'serviced'); if (!c || !data.invoices || data.invoices.some(invClosed)) return;
  let n = 2180; const free = () => { do { n++; } while (data.invoices.some(i => i.number === 'INV-' + n)); return 'INV-' + n; }, day = D.add(today(), -118), at = +D.parse(day) + 10 * 36e5, by = ((data.users || []).find(u => u.role === 'office') || { name: 'Colleen Abbott' }).name;
  const lines = [{ id: 'box', name: 'Purge, per box', qty: 20, rate: 8 }, { id: 'trip', name: 'Trip charge', qty: 1, rate: 25 }], mk = (id, o) => ({ id, number: free(), customerId: c.id, jobId: null, day, amount: 185, lines: lines.map(l => ({ ...l })), payments: [], at, auto: false, sentAt: at, sentTo: emailOf(c), by, ...o });
  const stamp = ago => { const d = D.add(today(), -ago); return { day: d, at: +D.parse(d) + 14 * 36e5 }; }, w = stamp(24), v = stamp(110);
  const bad = mk('inv-bd1', { status: BAD, closed: { kind: 'bad', was: 'Overdue', reason: 'No reply to three statements and two calls', by, ...w } }); bad.log = [{ at: w.at, by, text: 'Written off as bad debt · ' + money(185) + ' · ' + bad.closed.reason }];
  const dup = mk('inv-vd1', { status: VOID, at: at + 6e5, sentAt: at + 6e5, closed: { kind: 'void', was: 'Sent', reason: 'Billed twice — duplicate of ' + bad.number, by, ...v } }); dup.log = [{ at: v.at, by, text: 'Voided · ' + money(185) + ' · ' + dup.closed.reason }];
  data.invoices.push(bad, dup);
  WD.panel.addAction('Incoming call (customer with bad debt)', () => WD.screens.customers && WD.screens.customers.simulateCall(c.id));
  WD.panel.addJump('Bad debt customer', () => { WD.nav.switchTab('customers'); WD.screens.customers.openDetail(c.id); });
})();

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
/* Bad debt and void invoices are not owed, so they never go on a statement. */
const unpaid = c => (data.invoices || []).filter(i => i.customerId === c.id && invOpen(i)).sort((a, b) => a.day.localeCompare(b.day));
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
/* ---------- Statement of all invoices: paid and unpaid, with the payments applied and a running balance (for hunting down a discrepancy) ---------- */
const ST_RANGES = [['year', 'This year'], ['12m', 'Last 12 months'], ['all', 'All time'], ['custom', 'Custom dates']];
const stSpan = f => f.range === 'year' ? [today().slice(0, 4) + '-01-01', today()] : f.range === '12m' ? [D.add(today(), -365), today()] : f.range === 'custom' ? (f.from <= f.to ? [f.from, f.to] : [f.to, f.from]) : ['0000-00-00', '9999-12-31'];
const stPeriod = f => f.range === 'all' ? 'All invoices' : (([a, b]) => mdy(a) + ' – ' + mdy(b))(stSpan(f));
const paysOf = i => (i.payments || []).map(p => p && typeof p === 'object' ? p : (data.payments || []).find(x => x.id === p)).filter(Boolean);
const dayOf = at => D.key(new Date(at)), creditOf = i => { const j = i.jobId && q.job(i.jobId); return +(i.credit || (j && j.invoice && j.invoice.credit) || 0) || 0; };
const stLabel = i => { const st = RC.invStatus(i); return st === 'Sent' ? 'Unpaid' : st === 'Overdue' ? 'Unpaid · past due' : st; };
/** Every invoice in the period as a ledger → {from, to, opening, rows: [{day, kind: 'inv'|'pay'|'off'|'credit', inv, text, sub, charge, pay, bal}], invs, charges, paid, written, credits, closing, unpaid}.
    opening is what was still owed from before the period; unpaid is every open invoice, whatever its date. */
function ledger(c, f) {
  const [from, to] = stSpan(f), all = (data.invoices || []).filter(i => i.customerId === c.id && i.status !== 'Draft').sort((a, b) => a.day.localeCompare(b.day) || String(a.number).localeCompare(String(b.number)));
  const invs = all.filter(i => i.day >= from && i.day <= to), opening = cents(all.filter(i => i.day < from && invOpen(i)).reduce((s, i) => s + i.amount, 0)), ev = [], later = (a, b) => a > b ? a : b;
  invs.forEach((i, n) => { const pays = paysOf(i), cr = creditOf(i);
    ev.push({ day: i.day, o: n * 10, kind: 'inv', inv: i, text: i.number, sub: stLabel(i), charge: i.amount });
    pays.forEach((p, k) => ev.push({ day: later(dayOf(p.at), i.day), o: n * 10 + 1 + Math.min(k, 6), kind: 'pay', inv: i, text: 'Payment · ' + i.number, sub: p.method || 'Payment', pay: +p.amount || 0 }));
    if (i.status === 'Paid' && !pays.length) ev.push({ day: i.day, o: n * 10 + 1, kind: 'pay', inv: i, text: 'Payment · ' + i.number, sub: 'Marked paid', pay: i.amount });
    if (invClosed(i)) ev.push({ day: i.closed && i.closed.at ? later(dayOf(i.closed.at), i.day) : i.day, o: n * 10 + 8, kind: 'off', inv: i, text: (i.status === BAD ? 'Written off · ' : 'Voided · ') + i.number, sub: i.status === BAD ? 'Bad debt, no longer owed' : 'Void, never owed', pay: i.amount });
    if (cr > 0) ev.push({ day: i.day, o: n * 10 + 9, kind: 'credit', inv: i, text: 'Credit · ' + i.number, sub: 'Owed to the customer after a correction', pay: cr }); });
  ev.sort((a, b) => a.day.localeCompare(b.day) || a.o - b.o); let bal = opening; ev.forEach(e => { bal = cents(bal + (e.charge || 0) - (e.pay || 0)); e.bal = bal; });
  const tot = k => cents(ev.filter(e => e.kind === k).reduce((s, e) => s + (e.pay || 0), 0));
  return { from, to, opening, rows: ev, invs, charges: cents(invs.reduce((s, i) => s + i.amount, 0)), paid: tot('pay'), written: tot('off'), credits: tot('credit'), closing: bal, unpaid: unpaid(c) };
}
/** The all-invoices statement page: date, item, charge, payment or credit, running balance; then the unpaid invoices summarized by age. */
function ledgerDoc(c, L, f) {
  const B = WD.screens.billing, org = S.org || data.orgs[0], due = L.unpaid.reduce((s, i) => s + i.amount, 0), ag = aging(L.unpaid), m = v => v ? money(v) : '';
  return h('div.bn-doc.rc-st', h('div.bn-top', B.logo(), h('div.bn-co', [org.name].concat((org.remit || []).slice(1), org.phone || [], org.email || [], data.tax && data.tax.on && data.tax.regNo ? 'Tax reg. # ' + data.tax.regNo : []).map(x => h('div', x)))),
    h('div.bn-mid', h('div.bn-to', billTo(c).map(x => h('div', x))), h('div', h('h2', 'Statement'), h('div.bn-meta', [['Statement Date', mdy(today())], ['Period', stPeriod(f)], ['Invoices', String(L.invs.length)], ['Total Due', money(due)]].map(([k, v]) => [h('span', k), h('span', v)])))),
    h('table.bn-tab', h('thead', h('tr', h('th', 'Date'), h('th', 'Item'), h('th.r', 'Charge'), h('th.r', 'Payment', h('br'), 'or Credit'), h('th.r', 'Balance'))),
      h('tbody', L.opening > 0 && h('tr', h('td.n', mdy(L.from)), h('td', 'Balance forward', h('br'), h('small', 'Unpaid from before this period')), h('td.r.n', ''), h('td.r.n', ''), h('td.r.n', money(L.opening))),
        L.rows.map(e => h('tr', h('td.n', mdy(e.day)), h('td', e.text, h('br'), h('small', e.sub)), h('td.r.n', m(e.charge)), h('td.r.n', m(e.pay)), h('td.r.n', money(e.bal)))),
        !L.rows.length && h('tr', h('td', { colspan: '5' }, 'No invoices in this period.')))),
    h('div.bn-bot', h('div.bn-sig'), h('div.bn-tot', h('div.x', h('span', 'Invoiced in the period'), h('span', money(L.charges))), h('div.x', h('span', 'Payments applied'), h('span', money(L.paid))), L.written > 0 && h('div.x', h('span', 'Written off or voided'), h('span', money(L.written))), L.credits > 0 && h('div.x', h('span', 'Credits'), h('span', money(L.credits))),
      ag.map((v, i) => v > 0 && h('div.x', h('span', AGE_LABELS[i]), h('span', money(v)))), h('div.due', h('span', 'Total Due'), h('span', money(due))))),
    h('div.bn-fill'), h('div.bn-cod', (L.unpaid.length ? 'Still unpaid: ' + L.unpaid.map(i => i.number + ' (' + mdy(i.day) + ', ' + money(i.amount) + ')').join('; ') + '. ' : 'Every invoice is paid. ') + 'If your records differ from this statement, reply with the invoice number and we will sort it out. Questions: ' + (org.phone || '') + (org.email ? ' · ' + org.email : '')));
}
/** f: the statement choices ({all, range, from, to}); without f.all it is the unpaid-only statement. */
RC.statementPages = (c, attach, f) => { if (f && f.all) { const L = ledger(c, f); return [ledgerDoc(c, L, f)].concat(attach ? L.invs.map(invoiceNode) : []); } const invs = unpaid(c); return [statementDoc(c, invs)].concat(attach ? invs.map(invoiceNode) : []); };
RC.statementLedger = ledger;
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
/** One customer's statement: choose unpaid invoices only or all invoices (o.all opens on All), review them and the billing email, choose whether
    to attach the invoices, preview, send. o.job (a driver at the stop) adds today's invoice to the top so it can be created before the statement goes out. */
RC.openStatement = (c, o = {}) => {
  if (!(WD.can('billing.view') || WD.can('billing.field'))) return ui.toast('Billing access is needed for statements', 'lock');
  const was = emailOf(c), tplBody = () => { const invs = unpaid(c); return WD.co && WD.co.tpl ? WD.co.fill(WD.co.tpl('statement').body, WD.co.ctxFor(c, { amount: money(invs.reduce((s, i) => s + i.amount, 0)) })) : 'Your statement is attached.'; };
  const f = { email: was, future: 'new', attach: data.comms ? data.comms.statement.attach : true, msg: tplBody(), tone: 'friendly', all: !!o.all, range: o.range || 'year', from: o.from || D.add(today(), -90), to: o.to || today() };
  const send = async p => { const L = f.all ? ledger(c, f) : null, invs = L ? L.invs : unpaid(c), to = f.email.trim(); if (!invs.length) return ui.toast(L ? 'No invoices in that period' : 'Nothing is unpaid', L ? 'calendar' : 'checkmark'); if (!validEmail(to)) return ui.toast('Enter the billing email address', 'envelope', 2600);
    const ok = await ui.run('Sending statement…', () => {
      if (to !== was) { if (f.future === 'new') c.billingEmail = to; else if (f.future === 'both') c.billingEmail = [was, to].filter(Boolean).join(', '); }
      c.lastStatement = { day: today(), to, by: me(), count: invs.length, all: !!L }; logMail(c, 'Statement from ' + (S.org || data.orgs[0]).name, (L ? 'Statement of all invoices (' + stPeriod(f) + '): ' + plural(invs.length, 'invoice') + ', ' + L.unpaid.length + ' unpaid' : 'Statement with ' + plural(invs.length, 'open invoice')) + (f.attach ? ', invoices attached' : '') + '.', to);
      if (o.job) o.job.events.push({ at: +WD.now(), actor: me(), text: 'Statement with ' + (L ? plural(invs.length, 'invoice') + ' (paid and unpaid)' : plural(invs.length, 'unpaid invoice')) + ' sent to ' + to });
    }, { done: 'Statement sent' }); if (ok) p.dismiss(); };
  ui.sheet({ title: 'Statement', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Send', bold: true, onTap: send }],
    render: p => { const invs = unpaid(c), sum = invs.reduce((s, i) => s + i.amount, 0), ag = aging(invs), changed = f.email.trim() !== was && validEmail(f.email), job = o.job && q.job(o.job.id), risk = RC.ai('payrisk') ? RC.payRisk(c) : null;
      const L = f.all ? ledger(c, f) : null, listed = L ? L.invs : invs, paidText = i => { const ps = paysOf(i); return ps.length ? 'Paid ' + fmt.day(dayOf(ps[ps.length - 1].at), 'md') + (ps[ps.length - 1].method ? ' · ' + ps[ps.length - 1].method : '') : i.status === 'Paid' ? 'Marked paid' : null; };
      const stColor = i => { const st = RC.invStatus(i); return st === 'Paid' ? 'var(--green)' : st === 'Overdue' ? 'var(--red)' : invClosed(i) ? 'var(--gray)' : 'var(--orange)'; };
      return ui.list(
        ui.section({ header: 'What to include', fold: false, showFooter: true, footer: f.all ? 'Every invoice in the period with its status, the payments applied and a running balance. Use it to find where your records and the customer’s differ. The unpaid ones are still totaled at the bottom.' : 'Only what is still owed, with its age.' },
          h('div', { style: 'padding:10px 16px;background:var(--cell)' }, ui.segmented([{ value: false, label: 'Unpaid invoices only' }, { value: true, label: 'All invoices' }], f.all, v => { f.all = v; p.refresh(); })),
          f.all && ui.pickerRow({ title: 'Period', value: f.range, options: ST_RANGES.map(([value, label]) => ({ value, label })), onChange: v => { f.range = v; p.refresh(); } }),
          f.all && f.range === 'custom' && ui.dateRow({ title: 'From', value: f.from, onChange: v => { f.from = v; p.refresh(); } }),
          f.all && f.range === 'custom' && ui.dateRow({ title: 'To', value: f.to, onChange: v => { f.to = v; p.refresh(); } })),
        job && ui.section({ header: 'Today’s visit', fold: false, footer: job.invoice ? 'Today’s invoice is on the statement below.' : 'Create it first and it goes on the statement with the others.' },
          job.invoice ? ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: job.invoice.number + ' created', detail: money(job.invoice.amount) })
            : ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'Create today’s invoice', subtitle: job.title, tint: true, chevron: true, onTap: () => WD.screens.billing.openEditor(job.id) })),
        L ? ui.section({ header: c.name + ' · ' + plural(L.invs.length, 'invoice') + ' · ' + stPeriod(f), fold: false },
          L.opening > 0 && ui.row({ title: 'Balance forward', subtitle: 'Unpaid from before ' + longDay(L.from), detail: money(L.opening) }),
          L.invs.slice(-40).reverse().map(i => { const e = L.rows.filter(x => x.inv === i).pop(); return ui.row({ title: longDay(i.day), subtitle: [i.number, paidText(i) || (invOpen(i) ? age(i) + ' days old' : null), creditOf(i) > 0 ? 'credit ' + money(creditOf(i)) : null, e ? 'balance after ' + money(e.bal) : null].filter(Boolean).join(' · '), badge: ui.badge(stLabel(i).replace('Unpaid · past due', 'Past due'), stColor(i)), detail: money(i.amount), chevron: true, onTap: () => RC.viewInvoice && RC.viewInvoice(i) }); }),
          L.invs.length > 40 && ui.row({ title: '+ ' + (L.invs.length - 40) + ' earlier invoices', subtitle: 'All of them are in the PDF' }),
          !L.invs.length && ui.row({ icon: 'calendar', iconPlain: true, iconColor: 'var(--label3)', title: 'No invoices in this period', subtitle: 'Choose a longer period above' }),
          L.invs.length > 0 && ui.row({ title: 'Invoiced', detail: money(L.charges), subtitle: 'Payments applied ' + money(L.paid) + (L.written ? ' · written off or voided ' + money(L.written) : '') + (L.credits ? ' · credits ' + money(L.credits) : '') }),
          ui.row({ title: h('b', 'Still unpaid'), detail: h('b', money(sum)), subtitle: invs.length ? plural(invs.length, 'invoice') + ': ' + invs.map(i => i.number).slice(0, 6).join(', ') + (invs.length > 6 ? '…' : '') : 'Nothing is owed' }))
        : ui.section({ header: c.name + ' · ' + plural(invs.length, 'unpaid invoice'), fold: false },
          invs.length ? invs.map(i => ui.row({ title: longDay(i.day), subtitle: i.number + ' · ' + age(i) + ' days old', badge: RC.invStatus(i) === 'Overdue' ? ui.badge('Past due', 'var(--red)') : null, detail: money(i.amount) })) : ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Nothing is unpaid' }),
          invs.length > 0 && ui.row({ title: h('b', 'Total due'), detail: h('b', money(sum)), subtitle: ag.map((v, i) => v > 0 ? AGE_LABELS[i].toLowerCase() + ' ' + fmt.money(v) : null).filter(Boolean).join(' · ') })),
        risk && h('div.rc-ai', h('div.k', icon('sparkles', 15), 'Late-payment risk'), h('div', h('b', { style: { color: risk.color } }, risk.level), ' — ' + risk.why + '.')),
        ui.section({ header: 'Send to', fold: false, footer: changed ? null : 'Check this is the person who pays the bills. Change it here if not.' },
          ui.inputRow({ label: 'Billing email', type: 'email', caps: 'off', value: f.email, onInput: v => { const before = f.email.trim() !== was && validEmail(f.email); f.email = v; if (before !== (v.trim() !== was && validEmail(v))) p.refresh(); } }),
          changed && ui.pickerRow({ title: 'Future invoices go to', value: f.future, options: [{ value: 'new', label: 'The new address' }, { value: 'old', label: 'The old address' + (was ? ' (' + was + ')' : '') }, { value: 'both', label: 'Both addresses' }], onChange: v => { f.future = v; p.refresh(); } }),
          changed && h('div.section-footer', { style: 'padding:6px 16px 10px;background:var(--cell)' }, 'This statement goes to ' + f.email.trim() + '. ' + ({ new: 'Later invoices will too.', old: 'Later invoices keep going to ' + (was || 'the old address') + '.', both: 'Later invoices go to both.' }[f.future]))),
        ui.section({ header: 'What’s in it', fold: false, footer: f.attach ? 'One PDF: the statement, then each ' + (L ? 'invoice listed, paid or not.' : 'unpaid invoice.') : 'One PDF with the statement page only.' },
          ui.toggleRow({ title: L ? 'Attach every invoice listed' : 'Attach the unpaid invoices', subtitle: plural(listed.length, 'invoice') + ', in the same PDF', value: f.attach, onChange: v => { f.attach = v; p.refresh(); } }),
          WD.money && WD.money.emailPreview && ui.row({ title: 'Preview the email', subtitle: 'What the customer receives: your logo, the PDF attached, a button to the portal', icon: 'envelope', iconPlain: true, tint: true, chevron: true, onTap: () => WD.money.emailPreview({ kind: 'statement', customer: c, rec: { invs: listed, all: !!f.all } }) }),
          ui.row({ title: 'Preview the PDF', subtitle: plural(1 + (f.attach ? listed.length : 0), 'page'), icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => p.push({ title: 'Statement PDF', render: () => WD.screens.billing.docWrap(RC.statementPages(c, f.attach, f)) }) })),
        ui.section({ header: 'Message', fold: false }, ui.inputRow({ multiline: true, value: f.msg, onInput: v => { f.msg = v; } })),
        RC.aiBlock('collect', () => h('div.rc-ai', h('div.k', icon('sparkles', 15), 'Draft the message'), h('div', 'Written from this customer’s open invoices and history. You can edit it afterwards.'),
          h('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' }, [['friendly', 'Friendly'], ['firm', 'Firm'], ['final', 'Final notice']].map(([v, label]) => ui.button(label, { kind: f.tone === v && f.drafted ? 'filled' : 'tinted', small: true, block: false, onTap: async () => { const hud = ui.hud('Writing…'); await WD.delay(700, 1100); hud.close(); f.tone = v; f.drafted = true; f.msg = draftMessage(c, unpaid(c), v); p.refresh(); } }))))),
        h('div', { style: 'padding:4px 0 8px' }, ui.button(L ? 'Send statement · ' + plural(L.invs.length, 'invoice') : 'Send statement' + (invs.length ? ' · ' + money(sum) : ''), { icon: 'envelope', disabled: !listed.length, onTap: () => send(p) }))); } }, { detent: 'large' });
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
/* A voided invoice was never a sale. A bad-debt invoice was: it stays in sales and is reported separately as written off. */
const liveInv = () => { history(); return (data.invoices || []).filter(i => i.day >= cut && i.status !== 'Draft' && i.status !== VOID); };
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
const CARDS = [['tiles', 'Invoice totals', 'Overdue, unpaid and paid this year'], ['monthly', 'Invoiced each month', 'This year, compared with last year'], ['years', 'Sales by year', 'Total for each year in the date range'], ['services', 'Revenue by service', 'Where the money comes from'], ['aging', 'What customers owe', 'Unpaid invoices by age'], ['top', 'Top customers', 'By amount invoiced in the date range'], ['writeoff', 'Written off and voided', 'Bad debt and void invoices in the date range'], ['insights', 'Insights', 'AI findings (Premium)']];
S.prefs.reportCards = S.prefs.reportCards || Object.fromEntries(CARDS.map(c => [c[0], true])); CARDS.forEach(c => { if (S.prefs.reportCards[c[0]] == null) S.prefs.reportCards[c[0]] = true; });
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
  const W = 340, H = 180, L = 40, B = 18, T = 8, max = Math.max(1, ...cur.map(v => v || 0), ...(RP.compare ? prev : [0])), step = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : max / Math.pow(10, Math.floor(Math.log10(max))) > 2 ? 1 : 0.5), top = Math.ceil(max / step) * step;
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
  const best = cur.indexOf(Math.max(...cur)), svc = Object.entries(A.by).sort((p, n) => n[1] - p[1]), all = (data.invoices || []).filter(invOpen), over = all.filter(i => RC.invStatus(i) === 'Overdue'), byCust = {};
  over.forEach(i => { byCust[i.customerId] = (byCust[i.customerId] || 0) + i.amount; }); const worst = Object.entries(byCust).sort((p, n) => n[1] - p[1])[0], overSum = over.reduce((s, i) => s + i.amount, 0);
  return [b ? h('span', h('b', 'Sales are ' + (a >= b ? 'up ' : 'down ') + Math.abs(Math.round((a - b) / b * 100)) + '%'), ' on the same months of ' + (y - 1) + ' (' + fmt.money(a) + ' against ' + fmt.money(b) + ').') : null,
    h('span', h('b', MON[best] + ' was the strongest month'), ' this year at ' + fmt.money(cur[best]) + '.'),
    svc.length > 1 && A.total ? h('span', h('b', svc[0][0] + ' brings in ' + Math.round(svc[0][1] / A.total * 100) + '%'), ' of revenue in this date range; ' + svc[1][0].toLowerCase() + ' is next at ' + Math.round(svc[1][1] / A.total * 100) + '%.') : null,
    worst ? h('span', h('b', (q.customer(worst[0]) || { name: 'One customer' }).name + ' holds ' + Math.round(worst[1] / overSum * 100) + '% of what is past due'), ' (' + fmt.money(worst[1]) + ' of ' + fmt.money(overSum) + '). A statement with the invoices attached is the quickest next step.') : h('span', 'Nothing is past due.')].filter(Boolean);
}
function reportsRoot() {
  return { title: 'Reports', large: true, trailing: page => [{ label: 'Edit', onTap: () => ui.sheet({ title: 'Reports shown', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: () => ui.list(ui.section({ fold: false, footer: 'Your choice of what shows on the Reports screen.' }, CARDS.map(([id, name, sub]) => ui.toggleRow({ title: name, subtitle: sub, value: S.prefs.reportCards[id], onChange: v => { S.prefs.reportCards[id] = v; WD.changed(); } })))) }, { detent: 'large' }).closed.then(() => page.refresh()) }],
    render: page => { if (!(WD.can('analytics.view') || WD.can('billing.view'))) return ui.empty({ icon: 'lock', title: 'Reports are hidden', text: 'You need Analytics or billing access to see reports.' });
      const on = S.prefs.reportCards, re = () => page.refresh(), money$ = WD.can('billing.view'), A = aggregate(RP.f), y = yr(today()), all = (data.invoices || []).filter(i => i.status !== 'Draft'), open = all.filter(invOpen), over = open.filter(i => RC.invStatus(i) === 'Overdue');
      /* Written off and voided in the date range, by the day it was done. Neither is in Overdue, Unpaid or What customers owe. */
      const shutIn = st => all.filter(i => i.status === st && RC.inRange((i.closed && i.closed.day) || i.day, RP.f)), bad = shutIn(BAD), voided = shutIn(VOID);
      const H = history(), paidHist = Object.keys(H).filter(k => +k.slice(0, 4) === y).reduce((s, k) => ({ n: s.n + H[k].count, v: s.v + H[k].paid }), { n: 0, v: 0 }), paidLive = liveInv().filter(i => i.status === 'Paid' && yr(i.day) === y);
      /* A tile opens the matching invoices ON TOP of Reports, so Back returns here. The Invoices section's own filters are put back on the way out. */
      const sum = l => l.reduce((s, i) => s + i.amount, 0), go = (range, status) => () => { const IS = WD.screens.invoices; if (!IS || !IS.root) return; const keep = { ...RC.invFilter }, spec = IS.root({ scope: 'all' }), was = spec.onClose;
        Object.assign(RC.invFilter, { range, status }); page.push({ ...spec, backLabel: 'Reports', onClose: p => { Object.assign(RC.invFilter, keep); was && was(p); } }); };
      const perfRow = (ic, col) => WD.biz && WD.biz.perfSpec && ui.row({ icon: ic, iconColor: col, title: 'Route performance', subtitle: 'Billed per stop, per hour and per mile · completed stops and service notes not billed', chevron: true, onTap: () => page.push(WD.biz.perfSpec()) });
      const tile = (label, color, n, v, tap) => h('div.rc-tile', { onclick: tap, role: 'button' }, h('div.l', h('i', { style: { background: color } }), label), h('div.v', fmt.money(v)), h('div.n', plural(n, 'invoice')));
      const ag = [0, 0, 0, 0]; open.forEach(i => { const a = D.diff(today(), i.day); ag[a <= 30 ? 0 : a <= 60 ? 1 : a <= 90 ? 2 : 3] += i.amount; });
      const years = Object.entries(A.years).sort((a, b) => b[0] - a[0]), svc = CATS.map(k => [k, A.by[k] || 0]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]), top = Object.entries(A.cust).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (!money$) return ui.list(note('Invoice and sales reports need billing access. Route performance is still available.'), ui.section(null, perfRow('chart.bar', 'var(--blue)')));
      return [h('div.rc-sticky', RC.filterBar(RP.f, re)), h('div', { style: 'padding:6px 16px 20px' },
        on.tiles && h('div.rc-tiles', tile('Overdue', 'var(--red)', over.length, sum(over), go('life', 'overdue')), tile('Unpaid', 'var(--orange)', open.length, sum(open), go('life', 'unpaid')), tile('Paid ' + y, 'var(--green)', paidHist.n + paidLive.length, paidHist.v + sum(paidLive), go('year', 'paid'))),
        ui.list(ui.section({ header: 'Routes and team', fold: false }, perfRow('route', 'var(--teal)'),
          WD.timeclock && WD.timeclock.timesheetsSpec && WD.can('hr.manage') && ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Hours and overtime', chevron: true, onTap: () => page.push(WD.timeclock.timesheetsSpec()) }))),
        on.monthly && monthlyCard(re),
        on.insights && RC.aiBlock('insights', () => RC.aiCard({ title: 'Insights', lines: insights(A) })),
        on.years && h('div.rc-card', h('h4', 'Sales by year'), h('div.sub', RC.rangeLabel(RP.f) + ' · ' + fmt.money(A.total) + ' in ' + plural(A.count, 'invoice')), years.length ? hbars(years.map(([k, v]) => [k + (+k === y ? ' so far' : ''), v])) : h('div.sub', 'No sales in this date range.')),
        on.services && h('div.rc-card', h('h4', 'Revenue by service'), h('div.sub', RC.rangeLabel(RP.f)), svc.length ? hbars(svc, A.total) : h('div.sub', 'No sales in this date range.')),
        on.aging && h('div.rc-card', h('h4', 'What customers owe'), h('div.sub', fmt.money(sum(open)) + ' unpaid, by the age of the invoice'), hbars([['30 days or less', ag[0]], ['31 to 60 days', ag[1]], ['61 to 90 days', ag[2]], ['Over 90 days', ag[3]]], sum(open) || 1)),
        on.writeoff && h('div.rc-card', { style: 'padding-bottom:4px' }, h('h4', 'Written off and voided'), h('div.sub', RC.rangeLabel(RP.f) + ' · by the day it was written off or voided · not counted in what customers owe'),
          h('div.rc-sum', { style: 'margin:8px -12px 0;border-radius:0;background:none' }, h('div.tap', { role: 'button', onclick: go('life', 'baddebt') }, h('span', 'Written off (bad debt)'), h('span', h('b', { style: { color: bad.length ? 'var(--red)' : null } }, fmt.money(sum(bad))), ' · ' + plural(bad.length, 'invoice'), icon('chevron.right', 12, 'var(--label3)'))),
            h('div.tap', { role: 'button', onclick: go('life', 'void') }, h('span', 'Voided'), h('span', h('b', fmt.money(sum(voided))), ' · ' + plural(voided.length, 'invoice'), icon('chevron.right', 12, 'var(--label3)'))))),
        on.top && top.length > 0 && h('div.rc-card', h('h4', 'Top customers'), h('div.sub', RC.rangeLabel(RP.f) + ' · from invoices on record'), hbars(top.map(([id, v]) => [(q.customer(id) || { name: 'Customer' }).name, v, () => WD.screens.customers.openDetail(id)]))),
        h('div.footnote.secondary', { style: 'padding:0 4px' }, 'Prototype: months before ' + fmt.day(cut, 'month') + ' use generated sales history; later months come from the invoices on record.'))]; } };
}
WD.screens.reports = { root: reportsRoot };

/* ================= Route performance: completed stops not billed, service notes not invoiced ================= */
const jobRev = j => j.billing ? +j.billing.amount || 0 : j.invoice && j.invoice.status !== 'Draft' ? +j.invoice.amount || 0 : 0;
/** Completed stops in the dates with nothing billed (same rule as the Route performance count). */
RC.unbilledJobs = (from, to, routeId) => data.jobs.filter(j => !j.allDay && j.status === 'completed' && j.day >= from && j.day <= to && (!routeId || j.routeId === routeId) && !jobRev(j) && j.type !== 'meet' && j.type !== 'creditCard').sort((a, b) => b.day.localeCompare(a.day) || String(a.routeId).localeCompare(String(b.routeId)) || (a.seq || 0) - (b.seq || 0));
const estLines = j => { const B = WD.screens.billing; return B && B.linesForJob ? B.linesForJob(j) : (j.items || []).filter(i => i.qty > 0).map(i => ({ id: i.id, name: i.id, qty: i.qty, rate: i.rate || 0 })); }, est = j => total(estLines(j));
/** Bill one completed stop as it stands: an invoice from its containers at the customer's rates (a service note for master-invoice customers). */
function billJob(job) {
  const c = job.customerId && q.customer(job.customerId), lines = estLines(job).map(l => ({ ...l })), at = +WD.now(), who = me(), wf = WD.workflow;
  WD.api.op({ kind: 'edit', title: job.title, scope: 'Billed from Route performance', jobIds: [job.id], apply() {
    if (c && c.billingMode === 'serviceNote' && wf && wf.addServiceNote) { const sn = wf.addServiceNote(job, { lines, po: job.po || '', day: job.day, by: who }), amount = total(lines);
      job.billing = { kind: 'serviceNote', number: sn.number, amount, at, by: who }; job.events.push({ at, actor: who, text: 'Service note ' + sn.number + ' created from Route performance · ' + money(amount) + ' · added to the master invoice' }); return; }
    const tx = WD.taxInfo ? WD.taxInfo(lines, c) : { tax: 0 }, amount = cents(total(lines) + (tx.tax || 0)), number = nextNumber(), to = emailOf(c), po = job.po || (c && c.po) || '';
    job.invoice = { number, status: 'Sent', amount, tax: tx.tax || 0, taxRate: tx.rate || 0, taxLabel: tx.label, taxes: tx.taxes || [], auto: false, lines, po, contract: job.contract || (c && c.contract) || '', billTo: to, includeDate: true, serviceDate: job.day, pounds: null, note: '', scans: [], scanNote: '', drives: [], driveScan: false, driveNote: '', custSig: null, custName: '', paid: null, sentAt: at };
    job.events.push({ at, actor: who, text: 'Invoice ' + number + ' created and sent to ' + (to || 'the customer') + ' · ' + money(amount) + ' · billed from Route performance' });
    if (c) { data.invoices.push({ id: 'inv-f' + number, number, customerId: c.id, jobId: job.id, day: job.day, amount, status: 'Sent', lines, tax: tx.tax || 0, taxLabel: tx.label, taxes: tx.taxes || [], po, payments: [], at, auto: false, sentAt: at, sentTo: to, by: who });
      if (c.stats) { c.stats.invoiced += amount; c.successful = true; if (!c.stats.firstInvoice) c.stats.firstInvoice = job.day; } }
  } });
}
/** The stops behind “completed stops not billed”: customer, route, date, what was serviced and the estimated amount, each with Bill, plus Bill all. o: {from, to, routeId}. */
RC.unbilledSpec = (o = {}) => ({ title: 'Completed, not billed', render: page => {
  const to = o.to || today(), from = o.from || D.add(to, -29), jobs = RC.unbilledJobs(from, to, o.routeId), can = WD.can('billing.manage') || WD.can('billing.field'), sum = cents(jobs.reduce((s, j) => s + est(j), 0)), B = WD.screens.billing, J = WD.screens.jobs;
  const scope = (o.routeId ? q.routeName(o.routeId) : 'All routes') + ' · ' + fmt.day(from, 'md') + ' – ' + fmt.day(to, 'md');
  if (!jobs.length) return ui.empty({ icon: 'checkmark.circle', title: 'Everything is billed', text: scope + ': every completed stop has an invoice, a service note or a payment.' });
  const notes = jobs.filter(j => (q.customer(j.customerId) || {}).billingMode === 'serviceNote').length;
  /* Stops for a customer with a written-off invoice: billing them is fine, but nobody should do it without knowing. */
  const bd = j => (WD.badDebt && j.customerId && WD.badDebt(j.customerId)) || null, flagged = jobs.filter(bd), flaggedNames = [...new Set(flagged.map(j => (q.customer(j.customerId) || {}).name))];
  const counts = list => { const n = list.filter(j => (q.customer(j.customerId) || {}).billingMode === 'serviceNote').length; return plural(list.length - n, 'invoice') + (n ? ' and ' + plural(n, 'service note') : ''); };
  return ui.list(
    h('div.rc-sum', h('div.big', h('span', plural(jobs.length, 'stop') + ' not billed'), h('span', money(sum))), h('div.muted', h('span', scope), h('span', 'estimated'))),
    can && h('div', { style: 'padding:0 0 14px' }, ui.button('Bill all ' + jobs.length + ' · ' + money(sum), { icon: 'doc.text', onTap: async () => {
      const rest = jobs.filter(j => !bd(j)), which = await ui.actionSheet({ title: 'Bill all ' + plural(jobs.length, 'stop') + '?', message: money(sum) + ' in total. Each invoice is created from the stop’s containers at the customer’s rates and emailed to their billing address.' + (notes ? ' ' + plural(notes, 'stop') + ' for master-invoice customers ' + (notes === 1 ? 'gets' : 'get') + ' a service note instead.' : '')
          + (flagged.length ? '\n\n' + plural(flagged.length, 'stop') + (flagged.length === 1 ? ' is' : ' are') + ' for ' + flaggedNames.join(' and ') + ', who ' + (flaggedNames.length === 1 ? 'has' : 'have') + ' an invoice written off as bad debt. Collect before sending more work on account.' : ''),
        buttons: [flagged.length && rest.length ? { label: 'Leave out bad debt · create ' + counts(rest), value: 'rest' } : null, { label: 'Create ' + counts(jobs) + (flagged.length ? ' anyway' : ''), value: 'all', role: flagged.length ? 'destructive' : null }].filter(Boolean) });
      if (!which) return; const list = which === 'rest' ? rest : jobs;
      await ui.run('Billing ' + plural(list.length, 'stop') + '…', () => list.forEach(billJob), { done: plural(list.length, 'stop') + ' billed', min: 1200, max: 2000 }); page.refresh(); } })),
    flagged.length > 0 && h('div.r13-late', { style: 'background:color-mix(in srgb, var(--red) 12%, var(--cell))' }, h('b', plural(flagged.length, 'stop') + ' for a customer with bad debt. '), flaggedNames.join(' and ') + ': ' + flaggedNames.map(n => { const j = flagged.find(x => (q.customer(x.customerId) || {}).name === n), b = bd(j); return money(b.amount) + ' written off'; }).join('; ') + '. Collect before billing more on account.'),
    ui.section({ header: 'Stops', fold: false, showFooter: true, footer: 'The amount is an estimate from each stop’s containers and the customer’s rates. Bill opens the invoice so you can check it before it goes out.' },
      jobs.map(j => { const c = q.customer(j.customerId), lines = estLines(j);
        return ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: c ? c.name : j.title, badge: bd(j) ? ui.badge('Bad debt ' + money(bd(j).amount).replace(/\.00$/, ''), 'var(--red)') : null, subtitle: [h('div', q.routeName(j.routeId) + ' · ' + fmt.day(j.day, 'md') + ', ' + j.day.slice(0, 4)), h('div', lines.map(l => (+l.qty || 0) + ' × ' + l.name).join(', ') + ' · ' + money(est(j)))],
          trailing: can && B && B.openEditor ? ui.button('Bill', { kind: 'tinted', small: true, block: false, onTap: e => { if (e && e.stopPropagation) e.stopPropagation(); B.openEditor(j.id); } }) : h('b', money(est(j))), onTap: () => J && J.openDetails && J.openDetails(j.id) }); })));
} });
const openNotesBy = () => { const m = new Map(); (data.serviceNotes || []).filter(n => !n.masterId).forEach(n => { const g = m.get(n.customerId) || { c: q.customer(n.customerId), notes: [], amount: 0 }; g.notes.push(n); g.amount += n.amount; m.set(n.customerId, g); }); return [...m.values()].filter(g => g.c).sort((a, b) => b.amount - a.amount); };
/** Service notes that are not on a master invoice yet, by customer, with the way to build each customer's master invoice from them. */
RC.openNotesSpec = () => ({ title: 'Service notes not invoiced', render: page => { const gs = openNotesBy(), wf = WD.workflow, all = gs.reduce((s, g) => s + g.notes.length, 0);
  if (!gs.length) return ui.empty({ icon: 'checkmark.circle', title: 'Nothing waiting', text: 'Every service note is on a master invoice.' });
  return ui.list(h('div.rc-sum', h('div.big', h('span', plural(all, 'service note') + ' not invoiced'), h('span', money(gs.reduce((s, g) => s + g.amount, 0)))), h('div.muted', h('span', plural(gs.length, 'master-invoice customer')), h('span', 'waiting'))),
    gs.map(g => { const list = g.notes.slice().sort((a, b) => b.day.localeCompare(a.day) || b.at - a.at);
      return ui.section({ header: g.c.name + ' · ' + plural(list.length, 'note') + ' · ' + money(g.amount), fold: false },
        list.slice(0, 4).map(n => ui.row({ icon: 'signature', iconColor: 'var(--brown)', title: fmt.day(n.day, 'md') + ' · ' + n.location, subtitle: n.number + ' · ' + n.lines.map(l => l.qty + ' × ' + l.name).join(', '), detail: money(n.amount) })),
        list.length > 4 && ui.row({ title: (list.length - 4) + ' more, back to ' + fmt.day(list[list.length - 1].day, 'md'), disabled: true }),
        wf && wf.masterSpec && ui.row({ icon: 'tray', iconPlain: true, iconColor: 'var(--tint)', title: 'Build the master invoice · ' + money(g.amount), subtitle: 'Review the notes and the preview, then create and send it', tint: true, chevron: true, onTap: () => page.push(wf.masterSpec(g.c.id)) })); }),
    note('A master invoice is built from every service note waiting for that customer. Creating it needs the Manage billing permission.'));
} });
/** For the Route performance report: what was done in the dates but not billed, and the service notes waiting for a master invoice. */
RC.perfBillingSection = (page, from, to) => { if (!(WD.can('billing.view') || WD.can('billing.field'))) return null;
  const jobs = RC.unbilledJobs(from, to || today()), gs = openNotesBy(), nN = gs.reduce((s, g) => s + g.notes.length, 0), aN = gs.reduce((s, g) => s + g.amount, 0), sum = cents(jobs.reduce((s, j) => s + est(j), 0));
  return ui.section({ header: 'Not billed yet', fold: false },
    ui.row({ icon: jobs.length ? 'exclamationmark.circle' : 'checkmark.circle.fill', iconPlain: true, iconColor: jobs.length ? 'var(--orange)' : 'var(--green)', title: jobs.length ? plural(jobs.length, 'completed stop') + ' not billed' : 'Every completed stop is billed', subtitle: jobs.length ? 'About ' + money(sum) + ' · see them and bill' : null, chevron: jobs.length > 0, onTap: jobs.length ? () => page.push(RC.unbilledSpec({ from, to })) : null }),
    ui.row({ icon: nN ? 'signature' : 'checkmark.circle.fill', iconPlain: true, iconColor: nN ? 'var(--orange)' : 'var(--green)', title: nN ? plural(nN, 'service note') + ' not yet invoiced' : 'No service notes waiting', subtitle: nN ? money(aN) + ' · ' + plural(gs.length, 'master-invoice customer') + ' · build the master invoice' : null, chevron: nN > 0, onTap: nN ? () => page.push(RC.openNotesSpec()) : null })); };

/* ================= Price Calc ================= */
/** Assumptions for both calculators; all editable on the screen. Area prices are the owner's base price for a standard purge in places off the regular routes. */
const CALC = data.calc = { perMile: 2, labor: 50, opp: 200, mph: 32, road: 1.3, base: 150, included: 14, extra: 8, zone: 6,
  /* 5.1: each area's base price is three numbers: a flat rate, how many boxes (or bins) it includes, and the price of each additional one. */
  areas: [{ id: 'ar1', name: 'Lakemont (on the regular routes)', flat: 150, included: 14, extra: 8 }, { id: 'ar2', name: 'North Lakemont', flat: 150, included: 14, extra: 8 }, { id: 'ar3', name: 'Ridgeview', flat: 185, included: 14, extra: 8 }, { id: 'ar4', name: 'Cedar Flats (rural)', flat: 225, included: 12, extra: 9 }, { id: 'ar5', name: 'Harlan County (rural)', flat: 275, included: 10, extra: 10 }] };
/** An area's price for a number of boxes or bins, and the same count at the standard base tier (extras from the price list are added to both alike). */
const areaPrice = (a, qty) => a.flat + Math.max(0, qty - a.included) * a.extra, tierPrice = (T, qty) => T.flat + Math.max(0, qty - T.included) * T.extra;
const areaText = (a, unit) => fmt.money(a.flat) + ' · includes ' + a.included + ' · ' + money(a.extra) + ' each additional ' + unit;
/* mode 'price' (the default view) or 'cost'. mods: extras chosen from the price list {lineId: quantity}; pick: the recommended route and day chosen ('routeId|day'). */
const PC = { mode: 'price', text: '', spot: null, addr: '', from: 'nearest', boxes: 14, bins: 2, sugs: [], name: '', phone: '', mods: {}, pick: null };
/** The base tier the calculator prices from: the purge price list (r14-price.js) when it is loaded, otherwise the numbers kept here. */
const tier = () => WD.price && WD.price.tier ? WD.price.tier() : { method: 'box', unit: 'box', flat: CALC.base, included: CALC.included, extra: CALC.extra };
const listName = () => WD.price && WD.price.name ? WD.price.name() : 'Standard purge rate';
const MILE = 25, hashSpot = a => { let n = 7; for (const ch of a.toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return { x: 120 + n % 760, y: 120 + (n >>> 9) % 760 }; };
const milesBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) / MILE * CALC.road;
/** The closest customer stop on the schedule in the next two weeks. */
const nearestJob = spot => { const end = D.add(today(), 14); let best = null; data.jobs.forEach(j => { if (j.allDay || j.x == null || j.day < today() || j.day > end || WD.closed[j.status]) return; const d = milesBetween(spot, j); if (!best || d < best.miles) best = { job: j, miles: d }; }); return best; };
/** How far a place is from the regular routes: the closest location of a recurring customer. */
const offRoute = spot => { let best = Infinity; data.customers.forEach(c => { if (!c.freq || c.freq === 'One time' || c.lifecycle !== 'customer') return; c.locations.forEach(l => { if (l.x != null) best = Math.min(best, milesBetween(spot, l)); }); }); return best; };
const r5 = v => Math.round(v / 5) * 5;
const calcField = (label, key, unit, o = CALC) => h('div.row', h('div.row-main', h('div.row-title', label)), h('span.secondary', { style: 'margin-right:4px' }, unit[0] === '$' ? '$' : ''), h('input.jb-rate', { style: 'width:70px', type: 'text', inputmode: 'decimal', 'aria-label': label, value: String(o[key]), onfocus: e => e.target.select(), onchange: e => { o[key] = Math.max(0, num(e.target.value)); WD.changed(); } }), h('span.secondary', { style: 'margin-left:5px;min-width:42px' }, unit.replace(/^\$/, '')));
/** Price Calc → gear: the assumptions behind both calculators. */
const UNIT = () => tier().unit === 'bin' ? 'bin' : 'box', UNITS = () => tier().unit === 'bin' ? 'bins' : 'boxes';
function calcSettingsSpec() {
  const field = calcField;
  return { title: 'Assumptions', render: page => { const re = () => page.refresh();
    return ui.list(
      ui.section({ header: 'Cost to serve', fold: false, footer: 'Miles are road miles: straight-line distance × the road factor. Lost revenue is what the truck would normally earn in an hour. These apply to both calculators.' }, field('Vehicle cost', 'perMile', '$per mile'), field('Labor', 'labor', '$per hour'), field('Lost revenue', 'opp', '$per hour'), field('Average speed', 'mph', 'mph'), field('Road factor', 'road', '× direct')),
      ui.section({ header: listName(), fold: false, footer: 'The standard rate applies anywhere within ' + CALC.zone + ' road miles of a regular customer.' }, WD.price && WD.price.listSpec ? ui.row({ icon: 'shippingbox', iconColor: 'var(--orange)', title: listName(), subtitle: WD.price.label() + ' · base price, each additional and the extra line items', chevron: true, onTap: () => page.push(WD.price.listSpec()) }) : [field('Show-up price', 'base', '$'), field('Boxes included', 'included', 'boxes'), field('Each additional box', 'extra', '$per box')], field('Regular-route range', 'zone', 'miles')),
      ui.section({ header: 'Base prices by area', fold: false, showFooter: true, footer: 'Each area has three numbers: the flat rate, how many ' + UNITS() + ' it includes, and the price of each additional ' + UNIT() + '. An address that mentions the area’s name is priced from them when that comes to more than the standard rate.' },
        CALC.areas.map(a => { const f = (label, key, pre) => h('label.pc-f', h('span', label), h('span.pc-in', pre && h('i', '$'), h('input', { type: 'text', inputmode: 'decimal', 'aria-label': label + ' for ' + a.name, value: String(a[key]), onfocus: e => e.target.select(), onchange: e => { a[key] = Math.max(0, num(e.target.value)); e.target.value = String(a[key]); WD.changed(); } })));
          return h('div.pc-area', h('div.pc-area-top', h('input.pc-name', { type: 'text', 'aria-label': 'Area name', value: a.name, onchange: e => { a.name = e.target.value.trim() || a.name; e.target.value = a.name; WD.changed(); } }),
              h('button', { 'aria-label': 'Remove ' + a.name, title: 'Remove', onclick: async () => { if (await ui.actionSheet({ title: 'Remove ' + a.name + '?', buttons: [{ label: 'Remove', value: true, role: 'destructive' }] })) { CALC.areas.splice(CALC.areas.indexOf(a), 1); WD.changed(); re(); } } }, icon('trash', 18))),
            h('div.pc-fields', f('Flat rate', 'flat', true), f('Includes (' + UNITS() + ')', 'included'), f('Each additional ' + UNIT(), 'extra', true))); }),
        ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an area', tint: true, onTap: async () => { const n = await RC.ask('Area or town', 'e.g. Pine Hollow'); if (!n) return; const T = tier(); CALC.areas.push({ id: uid('ar'), name: n, flat: T.flat, included: T.included, extra: T.extra }); WD.changed(); re(); ui.toast('Added with the standard numbers. Change them here.', 'checkmark', 2600); } }),
        h('label.row.tappable', { style: 'cursor:pointer' }, h('div.row-icon.plain', { style: { color: 'var(--tint)' } }, icon('doc', 24)), h('div.row-main', h('div.row-title.tint', 'Upload a price list'), h('div.row-sub', 'CSV: area, flat rate, boxes included, each additional')),
          h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', style: 'display:none', onchange: e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { let n = 0; String(r.result).split(/\r?\n/).forEach(line => { const m = /^\s*"?([^",]+?)"?\s*[,;\t]\s*\$?\s*([\d.]+)(?:\s*[,;\t]\s*([\d.]+))?(?:\s*[,;\t]\s*\$?\s*([\d.]+))?/.exec(line); if (!m || !+m[2]) return; const T = tier(), v = { flat: +m[2], included: m[3] ? +m[3] : T.included, extra: m[4] ? +m[4] : T.extra }, ex = CALC.areas.find(a => a.name.toLowerCase() === m[1].trim().toLowerCase()); if (ex) Object.assign(ex, v); else CALC.areas.push({ id: uid('ar'), name: m[1].trim(), ...v }); n++; }); WD.changed(); re(); ui.toast(n ? plural(n, 'area') + ' loaded' : 'No “area, flat rate, included, each additional” lines found', n ? 'checkmark' : 'exclamationmark.triangle', 2600); }; r.readAsText(file); } })))); } };
}
function calcRoot() {
  return { title: 'Price Calc', large: true,
    /* The gear at the top right: every assumption behind both calculators. */
    trailing: () => [{ icon: 'gearshape', label: 'Edit assumptions', onTap: p => p.push(calcSettingsSpec()) }],
    render: page => {
    const assume = text => ui.section({ fold: false }, ui.row({ icon: 'gearshape', iconPlain: true, title: 'Assumptions', subtitle: text, chevron: true, onTap: () => page.push(calcSettingsSpec()) }));
    const PR = WD.price && WD.price.findAt ? WD.price : null, re = () => page.refresh(), pick = s => { PC.addr = s.address; PC.text = s.address; PC.spot = s.l ? { x: s.l.x, y: s.l.y } : hashSpot(s.address); PC.sugs = []; PC.pick = null; re(); };
    /* The customer or lead already at this address, looked up as the address is typed. */
    const matchBox = h('div'), findMatch = () => PR ? PR.findAt(PC.addr || PC.text) : null, showMatch = () => { const m = findMatch(); matchBox.replaceChildren(...(m ? [PR.customerCard(m)] : [])); return m; };
    const sugBox = h('div.rc-sugs'), showSugs = () => { sugBox.replaceChildren(...PC.sugs.map(s => h('button', { onclick: () => pick(s) }, s.title, h('small', s.sub)))); };
    const addr = ui.section({ header: 'Address', fold: false }, ui.inputRow({ icon: 'mappin', placeholder: 'Street, city', value: PC.text, onInput: v => { PC.text = v; if (PC.addr && v !== PC.addr) PC.addr = ''; PC.sugs = WD.addressSuggestions ? WD.addressSuggestions(v).slice(0, 5) : []; showSugs(); showMatch(); }, onEnter: v => v.trim() && pick({ address: v.trim() }) }), sugBox,
      PC.spot && ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: PC.addr, trailing: h('button.cu-link', { style: 'border:0;background:none;color:var(--tint);font:inherit;cursor:pointer', onclick: () => { PC.spot = null; PC.addr = PC.text = ''; PC.pick = null; re(); } }, 'Clear') }));
    showSugs(); const match = showMatch();
    const seg = h('div', { style: 'padding:0 16px 10px' }, ui.segmented([{ value: 'price', label: 'Price calc' }, { value: 'cost', label: 'Cost to serve' }], PC.mode, v => { PC.mode = v; re(); }));
    const near = PC.spot && nearestJob(PC.spot);
    if (PC.mode === 'cost') {
      const froms = [{ value: 'nearest', label: 'Closest customer on the schedule' }].concat(data.places.map(p => ({ value: p.id, label: p.name })));
      const origin = PC.spot && (PC.from === 'nearest' ? (near ? near.job : null) : data.places.find(p => p.id === PC.from)), oneWay = origin ? milesBetween(PC.spot, origin) : 0, miles = oneWay * 2, hours = miles / CALC.mph;
      const veh = miles * CALC.perMile, lab = hours * CALC.labor, opp = hours * CALC.opp;
      return [seg, ui.list(addr, matchBox,
        ui.section({ header: 'Measured from', fold: false, footer: PC.from === 'nearest' ? 'The nearest customer with a job in the next two weeks, so the trip is priced as a detour from a route that is already running.' : 'A round trip from this place and back.' },
          ui.pickerRow({ title: 'From', value: PC.from, options: froms, onChange: v => { PC.from = v; re(); } }),
          PC.spot && PC.from === 'nearest' && (near ? ui.row({ icon: 'person.2', iconColor: q.routeColor(near.job.routeId), title: near.job.title, subtitle: fmt.day(near.job.day, 'short') + ' · ' + q.routeName(near.job.routeId) + ' · ' + fmt.dist(near.miles) + ' away' }) : ui.row({ title: 'No scheduled customers in the next two weeks', subtitle: 'Choose one of your places instead' }))),
        PC.spot && origin ? h('div', h('div.rc-sum', h('div', h('span', 'Round trip'), h('span', fmt.dist(miles))), h('div', h('span', 'Drive time'), h('span', fmt.dur(Math.max(1, hours * 60)))),
            h('div.muted', h('span', 'Vehicle · ' + fmt.dist(miles) + ' × ' + money(CALC.perMile)), h('span', money(veh))), h('div.muted', h('span', 'Labor · ' + hours.toFixed(2) + ' h × ' + money(CALC.labor)), h('span', money(lab))),
            h('div.big', h('span', 'Total cost'), h('span', money(veh + lab)))),
          h('div.rc-sum', h('div.muted', h('span', 'Opportunity cost · ' + hours.toFixed(2) + ' h × ' + money(CALC.opp)), h('span', money(opp))), h('div.big', h('span', 'Total with opportunity cost'), h('span', money(veh + lab + opp)))),
          h('div.footnote.secondary', { style: 'padding:0 6px 14px' }, 'Opportunity cost is the revenue the truck would normally earn in the time spent driving: about ' + fmt.money(CALC.opp) + ' an hour.'))
          : note('Enter an address to see the miles, drive time and cost of the round trip.'),
        assume(money(CALC.perMile) + ' a mile · ' + money(CALC.labor) + ' an hour labor · ' + fmt.money(CALC.opp) + ' an hour lost revenue · ' + CALC.mph + ' mph'))];
    }
    /* Price calc: the price list's base tier and extras, the address's distance from the regular routes, the customer already there, the days a truck is nearby, and a job made from all of it. */
    const T = tier(), bin = T.method === 'bin', qty = bin ? PC.bins : PC.boxes, total = items => cents(items.reduce((s2, x) => s2 + x.qty * x.rate, 0));
    const pd = PR ? PR.purgeFor(qty, PC.mods) : bin ? { bin65: qty, stairs: 'none', haul: false } : { std: qty, stairs: 'none', haul: false };
    const baseItems = PR ? PR.items(pd) : [{ id: 'box', qty, rate: 0 }], std = PR ? total(baseItems) : T.flat + Math.max(0, qty - T.included) * T.extra;
    const off = PC.spot ? offRoute(PC.spot) : 0, inZone = off <= CALC.zone, area = PC.spot && CALC.areas.find(a => PC.addr.toLowerCase().includes(a.name.replace(/\s*\(.*\)/, '').toLowerCase()));
    const extraMiles = Math.max(0, off - CALC.zone) * 2, extraH = extraMiles / CALC.mph, tripCost = extraMiles * CALC.perMile + extraH * CALC.labor, areaAdd = area ? Math.max(0, areaPrice(area, qty) - tierPrice(T, qty)) : 0;
    const tripAdd = r5(tripCost + extraH * CALC.opp * 0.5), pairPrice = near ? Math.max(std, r5(std + (near.miles * 2 * CALC.perMile + near.miles * 2 / CALC.mph * CALC.labor))) : Infinity;
    const add = !PC.spot ? 0 : inZone ? areaAdd : Math.max(areaAdd, tripAdd), low = std + (inZone ? areaAdd : Math.max(areaAdd, r5(tripCost))), high = std + (inZone ? areaAdd : Math.max(areaAdd, r5(tripCost + extraH * CALC.opp)));
    /* The out-of-area amount goes on the price list's trip-charge line when there is one, so the job and the invoice name it the same way. */
    const tl = PR && PR.tripLine(), jobPurge = add > 0 && tl ? { ...pd, mods: { ...pd.mods, [tl.id]: 1 }, modRate: { [tl.id]: add } } : pd;
    const items = !PR ? baseItems : add > 0 && !tl ? baseItems.concat({ id: 'trip', name: inZone ? 'Area price difference' : 'Out-of-area trip charge', qty: 1, rate: add }) : PR.items(jobPurge), rec = PR ? total(items) : std + add;
    const lines = () => [inZone ? h('span', h('b', 'On your regular routes.'), ' The nearest regular customer is ' + fmt.dist(off) + ' away, so the standard rate covers it.') : h('span', h('b', fmt.dist(off) + ' from your nearest regular customer.'), ' That is ' + fmt.dist(extraMiles) + ' and about ' + fmt.dur(Math.max(1, extraH * 60)) + ' of extra driving beyond your ' + CALC.zone + '-mile range, costing ' + money(tripCost) + ' in truck and labor.'),
      area ? h('span', h('b', 'Your base price for ' + area.name.replace(/\s*\(.*\)/, '') + ' is ' + areaText(area, UNIT()) + '.'), areaAdd ? ' For ' + qty + ' that is ' + fmt.money(areaPrice(area, qty)) + ', used as the floor.' : ' For ' + qty + ' that is no more than standard.') : !inZone && CALC.areas.some(a => a.flat > T.flat) ? h('span', 'No base price is saved for this area. Flat rates in your list for places off the routes run ' + fmt.money(Math.min(...CALC.areas.filter(a => a.flat > T.flat).map(a => a.flat))) + ' to ' + fmt.money(Math.max(...CALC.areas.map(a => a.flat))) + '.') : null,
      !inZone ? (areaAdd >= tripAdd ? h('span', h('b', 'Recommended ' + fmt.money(rec) + '.'), ' Your area price already covers the extra driving.') : h('span', h('b', 'Recommended ' + fmt.money(rec) + '.'), ' Covers the trip plus half of the revenue the truck gives up. Don’t go below ' + fmt.money(low) + '; ' + fmt.money(high) + ' recovers all of it.')) : areaAdd ? h('span', h('b', 'Recommended ' + fmt.money(rec) + '.'), ' It is on your routes, but your price list charges more in this area.') : null,
      near && !inZone && !area && pairPrice < rec ? h('span', h('b', 'Cheaper day: ' + fmt.day(near.job.day, 'long') + '.'), ' ' + q.routeName(near.job.routeId) + ' is already at ' + near.job.title + ', ' + fmt.dist(near.miles) + ' away. Offering that day could justify ' + fmt.money(pairPrice) + '.') : null].filter(Boolean);
    /* Extras from the price list: counts for the lines charged per unit, switches for the rest. */
    const COUNTED = ['legal', 'xl', 'xray', 'hdd', 'flight', 'count'], setMod = (id, v) => { if (v) PC.mods[id] = v; else delete PC.mods[id]; re(); };
    const extras = PR ? PR.activeLines().filter(l => l !== tl && !(bin && (l.appliesTo === 'legal' || l.appliesTo === 'xl'))).map(l => l.kind !== 'flat' && COUNTED.includes(l.appliesTo)
      ? ui.row({ title: l.name, subtitle: PR.lineSummary(l), trailing: ui.numField(PC.mods[l.id] || 0, 0, 999, v => setMod(l.id, v), l.name) })
      : ui.toggleRow({ title: l.name, subtitle: PR.lineSummary(l), value: !!PC.mods[l.id], onChange: v => setMod(l.id, v ? 1 : 0) })) : [];
    /* Days a truck is already near the address. Everyone sees the list; AI Premium adds the pick on top. */
    const dayText = d => fmt.day(d.day, 'weekday') + ' ' + fmt.day(d.day, 'md'), rd = PC.spot && PR ? PR.days(PC.spot) : null, fit = rd && WD.aip && WD.aip.on() ? PR.bestFit(rd.list, PC.spot) : null;
    const shown = rd ? rd.list.slice(0, 6) : [], chosen = rd ? rd.list.find(d => d.key === PC.pick) : null;
    [fit && fit.pick, chosen].forEach(d => { if (d && !shown.includes(d)) shown.push(d); }); shown.sort((a, b) => a.day.localeCompare(b.day) || a.closest - b.closest);
    const useDay = chosen || shown[0] || (near ? { routeId: near.job.routeId, day: near.job.day, fallback: true } : null);
    const dates = PC.spot && PR ? ui.section({ header: 'Recommended service dates', fold: false, showFooter: true, footer: shown.length ? 'Days a truck already has stops within ' + fmt.dist(rd.radius) + ' of this address in the next 45 days. Tap one to use it for the job; it can still be changed there.' : 'No truck has a stop within 25 miles in the next 45 days' + (near ? '. The closest is ' + near.job.title + ' on ' + fmt.day(near.job.day, 'long') + ' (' + q.routeName(near.job.routeId) + '), ' + fmt.dist(near.miles) + ' away.' : '.') },
      shown.map(d => { const on = useDay === d; return ui.row({ leading: ui.dot(q.routeColor(d.routeId)), title: fmt.day(d.day, 'long'), subtitle: [q.routeName(d.routeId) + ' · ' + plural(d.n, 'stop') + ' nearby' + (d.projected ? ' · from the recurring schedule' : ''), 'Nearest: ' + d.nearest + ', ' + fmt.dist(d.closest)].map(x => h('div', x)),
        badge: PR.capChip(d.cap), trailing: icon(on ? 'checkmark.circle.fill' : 'circle', 22, on ? 'var(--tint)' : 'var(--label3)'), onTap: () => { PC.pick = d.key; re(); } }); }),
      WD.r8 && WD.r8.openPlanMap && ui.row({ icon: 'map', iconPlain: true, title: 'See the planning map', subtitle: 'Every job near an address, and each customer’s service dates', tint: true, chevron: true, onTap: () => WD.r8.openPlanMap() })) : null;
    const best = fit && WD.aip.block(() => WD.aip.card({ title: 'Best fit · ' + q.routeName(fit.pick.routeId) + ' · ' + dayText(fit.pick), lines: fit.lines,
      action: h('div', { style: 'margin-top:10px' }, ui.button(useDay === fit.pick ? 'Selected' : 'Use this', { kind: useDay === fit.pick ? 'tinted' : 'filled', small: true, block: false, icon: useDay === fit.pick ? 'checkmark' : null, onTap: () => { PC.pick = fit.pick.key; re(); ui.toast(q.routeName(fit.pick.routeId) + ' · ' + dayText(fit.pick), 'checkmark'); } })) }));
    /* A job made from what was entered: purge, the address, the customer if one is there, the counts, the price as lines, and the route and day chosen. */
    const who = match ? match.customer.name : PC.name.trim(), createJob = () => { const J = WD.screens.jobs; if (!J || !J.openEditor) return;
      const o = { type: 'purge', address: PC.addr || PC.text.trim(), purge: { ...jobPurge, mods: { ...(jobPurge.mods || {}) } }, items: items.map(x2 => ({ ...x2 })), price: rec, notes: 'Quoted ' + money(rec) + ' in Price Calc' + (PR ? ': ' + PR.text(items) : '') + '.',
        banner: 'From Price Calc · ' + money(rec) + (useDay ? ' · ' + q.routeName(useDay.routeId) + ' · ' + dayText(useDay) : '') };
      if (useDay) { o.routeId = useDay.routeId; o.day = useDay.day; } if (match) o.customerId = match.customer.id; if (who) o.title = who; if (PC.name.trim()) o.contactName = PC.name.trim(); if (PC.phone) o.phone = PC.phone;
      J.openEditor(o); };
    const newLead = () => { const K = WD.screens.crm; if (K && K.newLead) K.newLead({ name: PC.name.trim(), contact: PC.name.trim(), contactName: PC.name.trim(), phone: PC.phone, address: PC.addr || PC.text.trim(), notes: 'Quoted ' + money(rec) + ' in Price Calc for ' + plural(qty, T.unit === 'bin' ? 'bin' : 'box').replace(/boxs$/, 'boxes') + '.' }); };
    /* 5.1: on a call, offer to fill in what is known about the caller (r15.js). */
    const callRow = WD.r15 && WD.r15.callFill ? WD.r15.callFill('calc', info => { if (info.name) PC.name = info.name; if (info.phone) PC.phone = info.phone; if (info.address) pick({ address: info.address, l: info.loc }); else re(); }) : null;
    return [seg, ui.list(callRow, addr, matchBox,
      !match && ui.section({ header: 'Who is asking', fold: false, footer: PC.spot ? 'Nobody in your customers or leads is at this address. The name and phone are optional; they carry over to the lead or the job.' : 'Optional. Carries over to the lead or the job.' },
        ui.inputRow({ label: 'Name', placeholder: 'Company or person', caps: 'words', value: PC.name, onInput: v => { PC.name = v; } }),
        ui.phoneRow ? ui.phoneRow({ value: PC.phone, onInput: v => { PC.phone = v; } }) : ui.inputRow({ label: 'Phone', type: 'tel', value: PC.phone, onInput: v => { PC.phone = v; } }),
        PC.spot && WD.can('crm.edit') && WD.screens.crm && WD.screens.crm.newLead && ui.row({ icon: 'person.badge.plus', iconPlain: true, iconColor: 'var(--green)', title: 'Create this customer in the CRM', subtitle: 'A new lead with this address' + (PC.name.trim() ? ', name' : '') + (PC.phone ? ' and phone' : ''), tint: true, chevron: true, onTap: newLead })),
      ui.section({ header: 'The job', fold: false, footer: listName() + ': ' + fmt.money(T.flat) + ' covers up to ' + T.included + (bin ? ' bins' : ' boxes') + ', then ' + money(T.extra) + ' each.' },
        bin ? ui.row({ icon: 'shippingbox', iconColor: 'var(--brown)', title: 'Bins', subtitle: '65-gallon bins', trailing: h('div.hstack', { style: 'gap:8px' }, ui.numField(PC.bins, 1, 500, v => { PC.bins = v; re(); }, 'Bins'), ui.stepper(PC.bins, 1, 500, v => { PC.bins = v; re(); })) })
          : ui.row({ icon: 'shippingbox', iconColor: 'var(--brown)', title: 'Boxes', subtitle: 'Standard banker boxes', trailing: h('div.hstack', { style: 'gap:8px' }, ui.numField(PC.boxes, 1, 2000, v => { PC.boxes = v; re(); }, 'Boxes'), ui.stepper(PC.boxes, 1, 2000, v => { PC.boxes = v; re(); })) })),
      extras.length > 0 && ui.section({ header: 'Extras', fold: false }, extras),
      h('div.rc-sum', PR ? PR.lines(items).map(l => h('div.muted', h('span', l.label), h('span', money(l.amount)))) : [h('div.muted', h('span', 'Show up and shred up to ' + T.included + ' boxes'), h('span', money(T.flat))), qty > T.included && h('div.muted', h('span', (qty - T.included) + ' more × ' + money(T.extra)), h('span', money((qty - T.included) * T.extra))), add > 0 && h('div.muted', h('span', inZone ? 'Area price difference' : 'Out-of-area charge'), h('span', '+ ' + money(add)))],
        add > 0 && h('div', h('span', 'Standard rate, before the ' + (inZone ? 'area price' : 'trip charge')), h('span', money(std))), h('div.big', h('span', add > 0 ? 'Recommended price' : 'Price'), h('span', money(rec)))),
      PC.spot ? RC.aiBlock('pricing', () => RC.aiCard({ title: 'Pricing recommendation', lines: lines() })) : note('Enter the address to check whether it is on your regular routes, see who is already there, and get the days a truck is nearby.'),
      PC.spot && !RC.ai('pricing') && !inZone && h('div.footnote.secondary', { style: 'padding:0 6px 12px' }, 'This address is ' + fmt.dist(off) + ' off your routes; the trip charge above is the cost of the extra driving.'),
      best, dates,
      WD.can('jobs.edit') && h('div', { style: 'padding:4px 0 14px' }, ui.button('Create job · ' + money(rec), { icon: 'plus', disabled: !(PC.addr || PC.text.trim()), onTap: createJob }),
        h('div.footnote.secondary', { style: 'padding:8px 6px 0;text-align:center' }, !(PC.addr || PC.text.trim()) ? 'Enter the address first.' : 'Opens a new purge job' + (who ? ' for ' + who : '') + (useDay ? ' on ' + q.routeName(useDay.routeId) + ', ' + dayText(useDay) : '') + '. Nothing is saved until you save the job.')),
      assume(listName() + ' · ' + fmt.money(T.flat) + ' with ' + T.included + (bin ? ' bins' : ' boxes') + ' · ' + money(T.extra) + ' each extra · ' + CALC.zone + '-mile range · ' + plural(CALC.areas.length, 'area price')))];
  } };
}
WD.screens.calc = { root: calcRoot };

WD.panel.addJump('Reports', () => WD.nav.switchTab('reports'));
WD.panel.addJump('Price Calc', () => WD.nav.switchTab('calc'));
WD.panel.addJump('New invoice', () => { WD.nav.switchTab('invoices'); RC.newInvoice(); });
WD.panel.addJump('Statement · all invoices', () => { const c = data.customers.find(x => (data.invoices || []).filter(i => i.customerId === x.id).length > 2); if (c) { WD.nav.switchTab('customers'); RC.openStatement(c, { all: true }); } });
WD.panel.addJump('Statement', () => { const c = data.customers.find(x => (data.invoices || []).filter(i => i.customerId === x.id && invOpen(i)).length > 1); if (c) { WD.nav.switchTab('customers'); RC.openStatement(c); } });
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('reports', RP); WD.app.uiState('calc', PC); WD.app.uiState('invFilter', RC.invFilter); }
})();
