/* Field workflow: completing a stop (billing details → signature → invoice / paid–no invoice / service note → next customer),
   arrival from GPS, heads-up details after job titles, missed-billing check, the Invoices list, service notes that build a
   monthly master invoice in the database, customer documents and dated PO schedules, directions app, and the
   Settings → Field workflow page. Registers WD.workflow (and WD.screens.workflow). */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const W = data.workflow, today = D.today();
const guard = (mod, fn, ...args) => WD.screens[mod] && WD.screens[mod][fn] && WD.screens[mod][fn](...args);
const billing = () => WD.screens.billing || {};
const canInvoice = () => WD.can('billing.field') || WD.can('billing.manage');
const canSeeBilling = () => WD.can('billing.view') || WD.can('billing.field');
/** The bookkeeping program the company uses (Settings → Bookkeeping), or '' when there is none. */
const books = () => WD.co ? (WD.co.hasBooks() ? WD.co.booksName() : '') : 'Invoice Ninja';

WD.css(`
.wf-td { font-weight: 500; opacity: .92; }
.bd-job .wf-td { font-weight: 600; font-size: 12px; opacity: .95; }
.wf-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.wf-chip { font-size: 12px; line-height: 16px; padding: 2px 8px; border-radius: 10px; background: color-mix(in srgb, var(--orange) 16%, var(--cell)); color: var(--label); font-weight: 500; letter-spacing: 0; }
.wf-alert { display: flex; gap: 10px; align-items: flex-start; padding: 11px 16px; font-size: 15px; line-height: 20px; letter-spacing: -.2px; }
.wf-alert .ic { flex: none; margin-top: 1px; }
.wf-alert.bad .ic { color: var(--red); } .wf-alert.warn .ic { color: var(--orange); }
.wf-inv-seg { padding: 2px 16px 0; } .wf-inv-seg + .wf-inv-seg { padding-top: 8px; }
.wf-sum { display: flex; justify-content: space-between; padding: 12px 16px; font-size: 17px; font-weight: 600; }
.wf-dbnote { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--label2); padding: 0 16px 10px; }
`);

/* ================= Billing state of a job ================= */
/** Billed = an invoice was created (not a draft), it was paid with no invoice, or a service note was signed. */
const billed = j => !!(j.billing || (j.invoice && j.invoice.status !== 'Draft'));
/** Completed jobs fade on the board only once billed (or as soon as they're completed, if the company prefers). */
const dimmed = j => j.status === 'completed' && (W.dimWhen === 'completed' || billed(j));
/** Stops that still need something: not skipped/called off, and not completed-and-billed. */
const needsAction = j => !j.allDay && !WD.struck[j.status] && !(j.status === 'completed' && billed(j)) && j.type !== 'meet';
const missed = (routeId, day) => q.stopList(routeId, day).filter(needsAction);
const billingLabel = j => !j.billing ? null : j.billing.kind === 'serviceNote' ? 'Service note ' + j.billing.number : 'Paid — no invoice · ' + j.billing.method;

/* ================= Heads-up details after the job title ================= */
const short = m => { const hh = Math.floor(m / 60), mm = m % 60; return (hh % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (hh < 12 ? 'a' : 'p'); };
const span = (a, b) => { const x = short(a), y = short(b); return (x.slice(-1) === y.slice(-1) ? x.slice(0, -1) : x) + '–' + y; };
const TD_OPTIONS = [['hours', 'Office hours, when out of the ordinary', 'Opens 9a · Closes 11a'], ['lunch', 'Closed for lunch', 'Lunch 12–1p'], ['closed', 'Days they’re closed', 'Closed Fri'],
  ['setup', 'New setup', 'New setup'], ['extraBin', 'Bring an extra container', 'Bring extra bin'], ['extraShred', 'Has extra to shred', 'Extra to shred'], ['early', 'Called in for early service', 'Early service'],
  ['window', 'Time window, and who set it', 'Asked 1–5p · Told 8–10a'], ['callAhead', 'Call ahead', 'Call 30m ahead']];
function titleDetails(j) {
  const t = W.titleDetails; if (!t.on || !j || j.allDay) return [];
  const out = [], m = fmt.fromHHMM, f = j.flags || {};
  if (t.hours) { const o = m(j.bizOpen), c = m(j.bizClose); if (o != null && c != null && c - o <= 120) out.push('Open ' + span(o, c)); else { if (o != null && o > m(W.normalOpen)) out.push('Opens ' + short(o)); if (c != null && c < m(W.normalClose)) out.push('Closes ' + short(c)); } }
  if (t.lunch && j.lunchFrom && j.lunchUntil) out.push('Lunch ' + span(m(j.lunchFrom), m(j.lunchUntil)));
  if (t.closed && j.closedDays && j.closedDays.length) out.push('Closed ' + j.closedDays.join('/'));
  if (t.setup && (j.type === 'setup' || f.setup)) out.push('New setup');
  if (t.extraBin && f.extraBin) out.push('Bring extra bin');
  if (t.extraShred && f.extraShred) out.push('Extra to shred');
  if (t.early && f.early) out.push('Early service');
  if (t.window && (j.custFrom || j.custUntil)) out.push((j.windowBy === 'us' ? 'Told ' : 'Asked ') + (j.custFrom && j.custUntil ? span(m(j.custFrom), m(j.custUntil)) : j.custFrom ? 'after ' + short(m(j.custFrom)) : 'by ' + short(m(j.custUntil))) + (j.custStrict ? '!' : ''));
  if (t.window && j.needsWindow && !j.custFrom && !j.custUntil) out.push('Needs window');
  if (t.callAhead && j.callAhead) out.push('Call ' + (j.callAhead === 60 ? '1h' : j.callAhead + 'm') + ' ahead');
  return out;
}
/** Title plus heads-up details, as nodes: "Harlow & Finch Law · Bring extra bin · Call 15m ahead". */
const titleNode = j => { const d = titleDetails(j); return [j.title, d.length ? h('span.wf-td', ' · ' + d.join(' · ')) : null]; };
const titleText = j => [j.title].concat(titleDetails(j)).join(' · ');

/* ================= Purchase orders by service date, documents ================= */
/** The PO that covers a service date: from the customer's PO schedule when it has one, else the customer's single PO. */
function poFor(c, day) {
  if (!c) return { po: '', entry: null };
  if (!c.poSchedule || !c.poSchedule.length) return { po: c.po || '', entry: null };
  const e = c.poSchedule.find(x => x.from <= day && day <= x.until); return { po: e ? e.po : '', entry: e || null, missing: !e };
}
/** Flags a PO schedule that has run out, or ends within 30 days with no next PO entered. */
function poAlert(c, day = today) {
  if (!c || !c.poSchedule || !c.poSchedule.length) return null;
  const cur = c.poSchedule.find(x => x.from <= day && day <= x.until), last = c.poSchedule.slice().sort((a, b) => a.until.localeCompare(b.until)).pop();
  if (!cur) return { level: 'bad', text: last.until < day ? 'No current PO — ' + last.po + ' ended ' + fmt.day(last.until, 'md') + '. Invoices go out without a PO until one is entered.' : 'No PO covers ' + fmt.day(day, 'md') + '.' };
  const left = D.diff(cur.until, day), next = c.poSchedule.find(x => x.from > cur.until);
  if (left <= 30 && !next) return { level: 'warn', text: cur.po + ' expires ' + fmt.day(cur.until, 'md') + ' (' + left + (left === 1 ? ' day' : ' days') + '). Enter the next PO so invoices after that date get it automatically.' };
  return null;
}
const poAlerts = () => data.customers.map(c => ({ c, a: poAlert(c) })).filter(x => x.a);
const alertRow = (a, onTap) => h('div.wf-alert.' + a.level + (onTap ? '.tappable' : ''), { onclick: onTap, style: onTap ? 'cursor:pointer' : null }, icon(a.level === 'bad' ? 'exclamationmark.triangle' : 'clock', 19), h('span', a.text));
const DOC_KINDS = { contract: ['Contract', 'doc.text', 'var(--indigo)'], po: ['Purchase order', 'doc.text', 'var(--teal)'], other: ['Document', 'paperclip', 'var(--gray)'] };
let docSeq = 0;
const docRow = (d, onDelete) => { const [label, ic, col] = DOC_KINDS[d.kind] || DOC_KINDS.other;
  return ui.row({ icon: ic, iconColor: col, title: d.name, subtitle: label + (d.po ? ' · ' + d.po : '') + ' · ' + d.size, chevron: !onDelete, trailing: onDelete ? h('button.bi-del', { 'aria-label': 'Remove', onclick: e => { e.stopPropagation(); onDelete(); } }, icon('bi.minus', 22)) : null, onTap: onDelete ? null : () => ui.toast('Opening ' + d.name + '…', 'doc.text') }); };
/** Add a document to a list (contract, PO or other). A PO can also be added to the PO schedule with its date range. */
async function addDocument(docs, schedule, refresh) {
  const kind = await ui.actionSheet({ title: 'Attach a document', message: 'Kept with the customer for quick review in the field and the office.', buttons: [{ label: 'Contract', value: 'contract' }, { label: 'Purchase order', value: 'po' }, { label: 'Other document', value: 'other' }] }); if (!kind) return;
  const src = await ui.actionSheet({ buttons: [{ label: 'Scan document', value: 'scan' }, { label: 'Choose file', value: 'file' }, { label: 'Photo library', value: 'photo' }] }); if (!src) return;
  if (kind === 'po') return editPO(schedule, null, refresh, docs);
  const name = kind === 'contract' ? 'Service contract.pdf' : src === 'photo' ? 'Photo ' + fmt.clock(WD.now()).replace(' ', '') + '.jpg' : 'Document.pdf';
  docs.push({ id: 'doc' + (++docSeq) + Date.now(), kind, name, size: (80 + Math.round(Math.random() * 600)) + ' KB', at: +WD.now() }); refresh && refresh(); ui.toast('Attached ' + name, 'paperclip');
}
/** Add or edit a PO on a schedule: number, the dates it covers, and its PDF. */
function editPO(schedule, entry, refresh, docs) {
  const last = schedule.slice().sort((a, b) => a.until.localeCompare(b.until)).pop();
  const f = entry ? { ...entry } : { po: '', from: last ? D.add(last.until, 1) : today, until: D.add(last ? D.add(last.until, 1) : today, 364), file: true };
  const ok = () => !!f.po.trim() && f.from <= f.until;
  ui.sheet({ title: entry ? 'Edit PO' : 'New purchase order', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Save', bold: true, disabled: !ok(), onTap: p => { if (!ok()) return;
      const v = { po: f.po.trim(), from: f.from, until: f.until }; if (entry) Object.assign(entry, v); else schedule.push(v); schedule.sort((a, b) => a.from.localeCompare(b.from));
      if (!entry && f.file && docs) docs.push({ id: 'doc' + (++docSeq) + Date.now(), kind: 'po', po: v.po, name: v.po.replace(/\s+/g, '-') + '.pdf', size: (90 + Math.round(Math.random() * 200)) + ' KB', at: +WD.now() });
      p.dismiss(); refresh && refresh(); WD.changed(); ui.toast('PO saved · used for services ' + fmt.day(v.from, 'md') + ' – ' + fmt.day(v.until, 'md'), 'checkmark', 2400); } }],
    render: p => ui.list(ui.section({ footer: 'Invoices and service notes pick the PO whose dates cover the service date, so the number changes on its own — on the contract anniversary or any other date.' },
        ui.inputRow({ label: 'PO number', placeholder: 'PO 27-00001', value: f.po, autofocus: !entry, onInput: v => { f.po = v; const b = p.navbar.querySelector('.nav-trail .nav-btn'); if (b) b.disabled = !ok(); } }),
        ui.dateRow({ title: 'Covers services from', value: f.from, onChange: v => { f.from = v; p.refresh(); } }), ui.dateRow({ title: 'Through', value: f.until, onChange: v => { f.until = v; p.refresh(); } })),
      !entry && docs && ui.section(null, ui.toggleRow({ title: 'Attach the PO document', subtitle: 'Scanned or chosen file', value: f.file, onChange: v => { f.file = v; } })),
      f.from > f.until && h('div', ui.note('The end date is before the start date.'))) }, { detent: 'large' });
}
/** Customer page: documents, the PO schedule and its alert. */
function poScheduleSpec(c) {
  return { title: 'Purchase orders', render: page => { const a = poAlert(c), edit = WD.can('crm.edit');
    return ui.list(a && ui.section(null, alertRow(a)),
      ui.section({ header: 'PO schedule', footer: 'Each invoice and service note uses the PO that covers its service date. You’re warned 30 days before the last PO runs out.' },
        c.poSchedule.map(e => { const cur = e.from <= today && today <= e.until, past = e.until < today;
          return ui.row({ title: e.po, subtitle: fmt.day(e.from, 'md') + ', ' + e.from.slice(0, 4) + ' – ' + fmt.day(e.until, 'md') + ', ' + e.until.slice(0, 4), badge: ui.badge(cur ? 'Current' : past ? 'Ended' : 'Upcoming', cur ? 'var(--green)' : past ? 'var(--gray)' : 'var(--blue)'), chevron: edit, onTap: edit ? () => editPO(c.poSchedule, e, () => page.refresh()) : null }); }),
        !c.poSchedule.length && ui.row({ title: 'No dated POs', subtitle: c.po ? 'Every invoice uses ' + c.po : 'Invoices go out without a PO' }),
        edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add PO', tint: true, onTap: () => editPO(c.poSchedule, null, () => page.refresh(), c.documents) }))); } };
}
function customerSections(c) {
  const edit = WD.can('crm.edit'), a = poAlert(c), refresh = () => WD.changed();
  return [a && ui.section(null, alertRow(a, () => WD.nav.push(poScheduleSpec(c)))),
    ui.section({ header: 'Documents', footer: 'Contracts, purchase orders and other paperwork for this customer.' },
      c.documents.map(d => docRow(d)), !c.documents.length && ui.row({ title: 'No documents yet' }),
      ui.row({ icon: 'doc.text', iconColor: 'var(--teal)', title: 'Purchase orders', detail: c.poSchedule.length ? (poFor(c, today).po || 'None current') : (c.po || 'None'), chevron: true, onTap: () => WD.nav.push(poScheduleSpec(c)) }),
      edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Attach document', tint: true, onTap: () => addDocument(c.documents, c.poSchedule, refresh) })),
    c.billingMode === 'serviceNote' && canSeeBilling() && masterSection(c)];
}
/** Editor rows for a new customer's documents and POs (kept in the form until saved). */
function docsEditor(f, p) {
  return ui.section({ header: 'Documents and POs', footer: 'Attach contracts and purchase orders. Dated POs switch automatically on the date you enter.' },
    f.documents.map((d, i) => docRow(d, () => { f.documents.splice(i, 1); p.refresh(); })),
    f.poSchedule.map((e, i) => ui.row({ icon: 'calendar', iconColor: 'var(--teal)', title: e.po, subtitle: fmt.day(e.from, 'md') + ' – ' + fmt.day(e.until, 'md') + ', ' + e.until.slice(0, 4), trailing: h('button.bi-del', { onclick: ev => { ev.stopPropagation(); f.poSchedule.splice(i, 1); p.refresh(); } }, icon('bi.minus', 22)) })),
    ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Attach contract, PO or document', tint: true, onTap: () => addDocument(f.documents, f.poSchedule, () => p.refresh()) }));
}
const BILLING_MODES = [{ value: 'invoice', label: 'Invoice each visit' }, { value: 'serviceNote', label: 'Service note, monthly master invoice' }];

/* ================= Service notes → master invoice (stored in the database) ================= */
data.masterInvoices = [];
let snSeq = 3100, miSeq = 40;
const monthKey = day => day.slice(0, 7), monthName = mk => fmt.day(mk + '-15', 'month');
const openNotes = cid => data.serviceNotes.filter(n => n.customerId === cid && !n.masterId).sort((a, b) => a.day.localeCompare(b.day) || a.at - b.at);
function addServiceNote(job, o) {
  const c = q.customer(job.customerId), loc = c && (c.locations.find(l => l.id === job.locationId) || c.locations[0]);
  const n = { id: 'sn' + (++snSeq), number: o.number || 'SN-' + snSeq, customerId: job.customerId, jobId: job.id, day: o.day || job.day, location: loc ? loc.label : job.title, address: job.address, lines: o.lines.map(l => ({ ...l })),
    amount: o.lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0), pounds: o.pounds || null, scans: o.scans || [], scanNote: o.scanNote || '', drives: o.drives || [], driveNote: o.driveNote || '', po: o.po || '', signer: o.signer || '', sig: o.sig || null, by: o.by || (S.me && S.me.name), at: o.at || +WD.now(), masterId: null,
    emailedTo: c ? (loc && loc.noteEmail) || (c.contacts[0] || {}).email || '' : '' };   /* each location's own email gets its service note; the combined invoice goes to the billing email */
  data.serviceNotes.push(n); return n;
}
/** Build the master invoice from every open service note for the customer: one line per visit, grouped by PO. */
function createMaster(c, notes) {
  const pos = [...new Set(notes.map(n => n.po || ''))], amount = notes.reduce((s, n) => s + n.amount, 0), number = 'INV-M' + (++miSeq + 2600);
  const lines = notes.map(n => ({ name: fmt.day(n.day, 'md') + ' · ' + n.location + ' · ' + n.number + (pos.length > 1 && n.po ? ' · ' + n.po : ''), qty: 1, rate: n.amount }));
  const mi = { id: 'mi' + miSeq, number, customerId: c.id, month: monthKey(notes[notes.length - 1].day), noteIds: notes.map(n => n.id), amount, status: 'Sent', at: +WD.now(), po: pos.filter(Boolean).join(', ') };
  data.masterInvoices.push(mi); notes.forEach(n => { n.masterId = mi.id; });
  if (data.invoices) data.invoices.push({ id: 'inv-' + mi.id, number, customerId: c.id, jobId: null, day: today, amount, status: 'Sent', payments: [], at: +WD.now(), auto: false, master: true, masterId: mi.id, lines, po: mi.po });
  if (c.stats) { c.stats.invoiced += amount; c.successful = true; }
  return mi;
}
function masterSection(c) {
  const notes = openNotes(c.id), total = notes.reduce((s, n) => s + n.amount, 0), sent = data.masterInvoices.filter(m => m.customerId === c.id).sort((a, b) => b.at - a.at);
  return ui.section({ header: 'Master invoice', footer: 'Each signed service note is saved to the RouteClerk database and added here. Create the master invoice when you’re ready to submit it; it’s built from these saved notes.' },
    ui.row({ icon: 'tray', iconColor: 'var(--brown)', title: 'Building · ' + notes.length + (notes.length === 1 ? ' service note' : ' service notes'), subtitle: notes.length ? 'Since ' + fmt.day(notes[0].day, 'md') : 'Nothing waiting', detail: fmt.money(total, true), chevron: true, onTap: () => WD.nav.push(masterSpec(c.id)) }),
    sent.slice(0, 2).map(m => ui.row({ icon: 'doc.text', iconColor: 'var(--green)', title: m.number + ' · ' + monthName(m.month), subtitle: m.noteIds.length + ' service notes', detail: fmt.money(m.amount), chevron: true, onTap: () => openInvoiceRec(data.invoices.find(x => x.id === 'inv-' + m.id)) })));
}
function masterSpec(cid) {
  return { title: 'Master invoice', render: page => {
    const c = q.customer(cid), notes = openNotes(cid), total = notes.reduce((s, n) => s + n.amount, 0), byPO = new Map();
    notes.forEach(n => byPO.set(n.po || 'No PO', (byPO.get(n.po || 'No PO') || 0) + n.amount));
    return ui.list(
      h('div.cu-head', h('div.cu-amount', fmt.money(total, true)), ui.badge('Building', 'var(--orange)'), h('div.footnote', c.name + ' · ' + notes.length + ' service notes waiting')),
      h('div.wf-dbnote', icon('cloud', 15), 'Saved in the database as each note is signed. Nothing is invoiced until you create it.'),
      ui.section({ footer: 'Each location’s service note goes to that location’s own email. Only this combined invoice goes to the billing email.' }, ui.row({ icon: 'envelope', iconColor: 'var(--blue)', title: 'Combined invoice goes to', subtitle: c.billingEmail ? null : 'No billing email yet. Add one under Edit on the customer.', detail: c.billingEmail || '—' }), ui.row({ icon: 'mappin', iconColor: 'var(--red)', title: 'Locations', detail: String(c.locations.length) })),
      notes.length > 0 && ui.section({ footer: 'What the master invoice will look like if you create it now.' }, ui.row({ title: 'Preview master invoice', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => WD.nav.push(billing().masterDocSpec({ id: 'preview', number: 'Draft', customerId: cid, noteIds: notes.map(n => n.id), at: +WD.now(), po: [...new Set(notes.map(n => n.po).filter(Boolean))].join(', ') })) })),
      byPO.size > 1 && ui.section({ header: 'By PO', footer: 'The PO changed during this period, so the master invoice lists the visits under each PO.' }, [...byPO].map(([po, amt]) => ui.row({ title: po, detail: fmt.money(amt, true) }))),
      ui.section({ header: 'Service notes', footer: notes.length ? null : 'New service notes appear here as drivers complete visits.' },
        notes.map(n => ui.row({ icon: 'signature', iconColor: 'var(--brown)', title: fmt.day(n.day, 'md') + ' · ' + n.location, subtitle: [n.number + (n.pounds ? ' · ' + n.pounds + ' lb' : '') + (n.po ? ' · ' + n.po : '') + (n.signer ? ' · signed by ' + n.signer : ''), n.emailedTo && 'Note emailed to ' + n.emailedTo].filter(Boolean).map(x => h('div', x)), detail: fmt.money(n.amount, true), chevron: true, onTap: () => WD.nav.push(noteSpec(n)) }))),
      notes.length > 0 && WD.can('billing.manage') && h('div', { style: 'padding:16px 0 0' }, ui.button('Create master invoice · ' + fmt.money(total, true), { icon: 'doc.text', onTap: async () => {
        const ok = await ui.actionSheet({ title: 'Create the master invoice?', message: notes.length + ' service notes, ' + fmt.money(total, true) + '. It’s sent to ' + (c.billingEmail || 'the billing contact') + ' through Invoice Ninja and the notes are marked invoiced.', buttons: [{ label: 'Create and send', value: true }] });
        if (!ok) return; let mi = null; if (await ui.run('Creating master invoice…', () => { mi = createMaster(c, notes); }, { done: 'Master invoice sent' })) { page.refresh(); if (mi) openInvoiceRec(data.invoices.find(x => x.id === 'inv-' + mi.id)); } } })),
      notes.length > 0 && !WD.can('billing.manage') && h('div', { style: 'margin-top:12px' }, ui.note('The office creates the master invoice when it’s due.')));
  } };
}
function noteSpec(n) {
  return { title: n.number, render: () => ui.list(
    ui.section(null, ui.row({ title: 'Service date', detail: fmt.day(n.day, 'long') }), ui.row({ title: 'Location', subtitle: n.address, detail: n.location }), n.pounds && ui.row({ title: 'Pounds', detail: n.pounds + ' lb' }), n.po && ui.row({ title: 'PO number', detail: n.po }), ui.row({ title: 'Driver', detail: n.by || '—' })),
    ui.section('Items', n.lines.map(l => ui.row({ title: l.name, subtitle: l.qty + ' × ' + fmt.money(l.rate, true), detail: fmt.money(l.qty * l.rate, true) })), ui.row({ title: h('b', 'Total'), detail: h('b', fmt.money(n.amount, true)) })),
    ui.section('Signature', n.sig && billing().sigView ? h('div.bi-sig', h('div.bi-ink', billing().sigView(n.sig)), h('div.bi-cap', 'Customer Signature · ' + n.signer)) : ui.row({ title: n.signer ? 'Signed by ' + n.signer : 'Signed on paper' })),
    ui.section(null, ui.row({ title: n.masterId ? 'On master invoice ' + (data.masterInvoices.find(m => m.id === n.masterId) || {}).number : 'Waiting for the master invoice', icon: 'tray', iconPlain: true }),
      n.jobId && q.job(n.jobId) && ui.row({ title: 'Open job', tint: true, onTap: () => guard('jobs', 'openDetails', n.jobId) })),
    WD.money && WD.money.emailPreview && ui.section(null, ui.row({ title: 'Preview the email', subtitle: 'What the customer receives: the service note attached as a PDF and a button to the portal', icon: 'envelope', iconPlain: true, tint: true, chevron: true, onTap: () => WD.money.emailPreview({ kind: 'note', customer: q.customer(n.customerId), rec: n }) })),
    WD.rc && WD.rc.noteActions && WD.rc.noteActions(n)) };
}

/* ================= Invoice actions (job view, customer record and the Invoices list) ================= */
const invRecFor = job => data.invoices && data.invoices.find(x => x.jobId === job.id);
function openInvoiceRec(rec) { if (!rec) return; const page = guard('customers', 'invoicePage', rec.id); if (page) WD.nav.push(page); }
/** Record a payment received another way: card, check, cash or other. */
async function markPaid(rec, job) {
  job = job || (rec && rec.jobId && q.job(rec.jobId)); const amount = rec ? rec.amount : job.invoice.amount, number = rec ? rec.number : job.invoice.number;
  const m = await ui.actionSheet({ title: 'Mark ' + number + ' paid', message: ((WD.cardPrice && WD.cardPrice.bothText(amount)) || fmt.money(amount, true)) + ' · how was it paid?', buttons: [{ label: 'Card', value: 'Card' }, { label: 'Check', value: 'Check' }, { label: 'Cash', value: 'Cash' }, { label: 'Other…', value: 'Other' }] });
  if (!m) return false; let method = m;
  if (m === 'Check') { const r = await ui.alert({ title: 'Check number', message: 'Optional — helps match the deposit.', input: { placeholder: 'e.g. 4417' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (!r || !r.value) return false; if (r.text.trim()) method = 'Check #' + r.text.trim(); }
  if (m === 'Other') { const r = await ui.alert({ title: 'Paid how?', input: { placeholder: 'e.g. ACH, Venmo, money order' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (!r || !r.value) return false; method = r.text.trim() || 'Other'; }
  applyPaid(rec, job, method, amount); ui.toast('Marked paid · ' + method, 'checkmark'); return true;
}
function applyPaid(rec, job, method, amount, when) {
  const me = when ? (WD.co ? WD.co.booksName() : 'Bookkeeping') : S.me.name, at = when || +WD.now();
  /* amount is our price. What was collected depends on how it was paid (R20-5): the card price or our price plus the card fee line by credit card, our price otherwise. */
  const cp = WD.cardPrice && !when ? WD.cardPrice.split(amount, method) : { base: amount, fee: 0, discount: 0, charged: amount };
  const apply = () => {
    if (rec && rec.status !== 'Paid') { const c = q.customer(rec.customerId); if (c && c.stats) { if (rec.status === 'Overdue') c.stats.balance = Math.max(0, c.stats.balance - amount); c.stats.paid += amount; }
      rec.status = 'Paid'; if (data.payments) { const pay = { id: 'pay-m' + Date.now(), invoiceId: rec.id, customerId: rec.customerId, at, amount: cp.base, method, ...(cp.fee ? { fee: cp.fee } : {}), ...(cp.discount ? { discount: cp.discount } : {}) }; data.payments.push(pay); rec.payments.push(pay.id); } }
    if (job && job.invoice) { job.invoice.status = 'Paid'; job.invoice.paid = { method, at }; job.events.push({ at, actor: me, text: 'Marked paid · ' + method + ' · ' + fmt.money(cp.charged, true) + (cp.fee ? ' (includes ' + fmt.money(cp.fee, true) + ' card fee)' : cp.discount ? ' (cash price)' : '') }); }
  };
  if (job) api.op({ kind: 'edit', title: job.title, scope: 'Payment · ' + method, jobIds: [job.id], apply }); else { apply(); WD.changed(); }
}
function sendReminder(rec) {
  const c = q.customer(rec.customerId);
  return ui.run('Sending reminder…', () => { if (data.interactions) data.interactions.push({ id: 'i-rem' + Date.now(), customerId: rec.customerId, type: 'email', dir: 'out', at: +WD.now(), subject: 'Payment reminder — ' + rec.number, snippet: WD.co ? WD.co.fill(WD.co.tpl('payrem').body, WD.co.ctxFor(c, { invoice: rec.number, amount: fmt.money(rec.amount, true) })).replace(/\s+/g, ' ') : 'A friendly reminder that invoice ' + rec.number + ' for ' + fmt.money(rec.amount, true) + ' is ' + (rec.status === 'Overdue' ? 'past due.' : 'due soon.'), from: 'billing@discountshred.example', to: (c && (c.billingEmail || (c.contacts[0] || {}).email)) || '' }); }, { done: 'Reminder sent' });
}
async function chargeCard(rec, job) {
  const ok = await ui.actionSheet({ title: 'Charge ' + fmt.money(rec.amount, true) + '?', message: 'Visa ending 4242 on file in Stripe' + (WD.money && WD.money.builtIn && WD.money.builtIn() ? '.' : books() ? ', through ' + books() + '.' : '.'), buttons: [{ label: 'Charge ' + fmt.money(rec.amount, true), value: true }] });
  if (ok && await ui.run('Charging card…', null, { done: 'Payment received' })) applyPaid(rec, job, 'Card on file (Stripe)', rec.amount);
}
/** Rows for an unpaid invoice: mark paid, send reminder, charge card on file, preview the customer’s email, open in the bookkeeping program. */
function invoiceActionRows(rec, job, o = {}) {
  if (!rec) return [];
  const unpaid = rec.status !== 'Paid' && !(WD.invClosed && WD.invClosed(rec)), field = canInvoice(), manage = WD.can('billing.manage'), mi = rec.masterId && data.masterInvoices.find(m => m.id === rec.masterId);
  const view = o.noView ? null : mi ? () => WD.nav.push(billing().masterDocSpec(mi)) : job && job.invoice ? () => billing().openInvoice(job.id) : null;
  return [view && ui.row({ title: 'View invoice', subtitle: mi ? mi.noteIds.length + ' service notes · as the customer receives it' : 'As the customer receives it', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: view }),
    WD.r9 && WD.r9.editRow(rec, job),
    unpaid && field && ui.row({ title: 'Mark paid…', subtitle: 'Card, check, cash or other', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => markPaid(rec, job) }),
    unpaid && field && ui.row({ title: 'Send reminder', icon: 'envelope', iconPlain: true, tint: true, onTap: async () => { if (await sendReminder(rec)) rec.lastSent = +WD.now(); } }),
    WD.money && WD.money.emailPreview && ui.row({ title: 'Preview the email', subtitle: 'What the customer receives: the invoice attached as a PDF and a button to the portal', icon: 'envelope', iconPlain: true, tint: true, chevron: true, onTap: () => WD.money.emailPreview({ kind: 'invoice', customer: q.customer(rec.customerId), rec }) }),
    unpaid && manage && ui.row({ title: 'Charge card on file', icon: 'creditcard', iconPlain: true, tint: true, onTap: () => chargeCard(rec, job) }),
    rec.paidVia && ui.row({ icon: 'sync', iconPlain: true, iconColor: 'var(--green)', title: 'Paid in ' + rec.paidVia, subtitle: 'Found when payment status was checked, and marked paid here' }),
    books() && !(WD.money && WD.money.builtIn && WD.money.builtIn()) && ui.row({ title: 'Open in ' + books(), icon: 'arrow.up.right', iconPlain: true, tint: true, onTap: () => ui.toast('Opening ' + rec.number + ' in ' + books() + '…', 'arrow.up.right') })];
}

/* ================= Invoices list ================= */
const INV_COLOR = { Paid: 'var(--green)', Sent: 'var(--blue)', Overdue: 'var(--red)', Draft: 'var(--gray)', 'Bad debt': 'var(--purple)', Void: 'var(--gray)' };
const IV = { scope: 'mine', routeId: null, query: '', limit: 40, kind: 'invoices' };
const myRoute = () => (S.shift && S.shift.routeId) || ((q.routes().find(r => r.driverId === (S.me && S.me.id)) || {}).id) || IV.routeId || (q.visibleRoutes()[0] || q.routes()[0]).id;
const recRoute = rec => { const j = rec.jobId && q.job(rec.jobId); if (j) return j.routeId; const c = q.customer(rec.customerId); return c && c.route; };
/** Service notes (signed per visit, for master-invoice customers), newest first, with the same route scope and search as invoices. */
function notesList(page, s) {
  const route = myRoute(); let list = data.serviceNotes.slice().sort((a, b) => b.at - a.at);
  if (IV.scope === 'mine') list = list.filter(n => recRoute(n) === route);
  if (WD.rc && WD.rc.noteMatch) list = list.filter(WD.rc.noteMatch);
  if (s) list = list.filter(n => { const c = q.customer(n.customerId); return n.number.toLowerCase().replace(/\s+/g, '').includes(s) || (c && c.name.toLowerCase().includes(IV.query.toLowerCase())) || (n.location || '').toLowerCase().includes(IV.query.toLowerCase()); });
  const waiting = list.filter(n => !n.masterId).length;
  return list.length ? ui.section({ header: (s ? list.length + (list.length === 1 ? ' match' : ' matches') : 'Newest first') + (waiting ? ' · ' + waiting + ' waiting for a master invoice' : ''), footer: 'Signed service notes from each visit. Each month they’re combined into the customer’s master invoice.' },
    list.slice(0, IV.limit).map(n => { const c = q.customer(n.customerId), mi = n.masterId && (data.masterInvoices || []).find(m => m.id === n.masterId);
      return ui.row({ icon: 'signature', iconColor: 'var(--brown)', title: (c ? c.name : n.number) + (n.location ? ' · ' + n.location : ''), subtitle: h('span', h('b.rc-date', fmt.day(n.day, 'md') + ', ' + n.day.slice(0, 4)), h('span.rc-num', ' · ' + n.number + (n.signer ? ' · signed by ' + n.signer : ''))), badge: ui.badge(mi ? mi.number : 'Waiting', mi ? 'var(--green)' : 'var(--orange)'), detail: fmt.money(n.amount), chevron: true, onTap: () => page.push(noteSpec(n)) }); }),
    list.length > IV.limit && ui.row({ title: 'Show more', tint: true, center: true, onTap: () => { IV.limit += 60; page.refresh(); } }))
    : ui.empty({ icon: 'signature', title: s ? 'No service notes match' : 'No service notes', text: IV.scope === 'mine' ? 'None on this route. Try All routes.' : 'Service notes appear here as drivers collect them.' });
}
function invoicesSpec(o) {
  IV.limit = 40; if (o && o.scope) IV.scope = o.scope;   /* Reports opens the list for every route */
  return { title: 'Invoices', large: true,
    trailing: page => WD.rc && WD.rc.newMenu && canInvoice() ? [{ icon: 'plus', label: 'New', onTap: (p, el) => WD.rc.newMenu(el, p, IV.kind) }] : [],
    search: { placeholder: 'Number, customer or location', onInput: (v, p) => { IV.query = v.trim(); IV.limit = 40; p.refresh(); } },
    render: page => {
      if (!canSeeBilling()) return ui.empty({ icon: 'lock', title: 'Billing is hidden', text: 'You need billing access to see invoices.' });
      const route = myRoute(), s = IV.query.toLowerCase().replace(/\s+/g, ''), digits = s.replace(/\D/g, '');
      let list = (data.invoices || []).slice().sort((a, b) => b.at - a.at);
      if (IV.scope === 'mine') list = list.filter(r => recRoute(r) === route);
      if (WD.rc && WD.rc.invMatch) list = list.filter(WD.rc.invMatch);
      if (s) list = list.filter(r => { const num = r.number.toLowerCase().replace(/\s+/g, ''), c = q.customer(r.customerId); return num.includes(s) || (digits.length >= 2 && num.replace(/\D/g, '').includes(digits)) || (c && c.name.toLowerCase().includes(IV.query.toLowerCase())); });
      /* 5.0 (r14-money.js): summary tiles and the aging bar filter the list, a sort order, bulk select, and a wide table on the desktop website. */
      const M = WD.money && WD.money.inv, inv5 = M && IV.kind === 'invoices', base = list; if (inv5) list = M.sort(M.filter(list));
      const open = list.filter(r => r.status !== 'Paid' && !(WD.invClosed && WD.invClosed(r))).reduce((t, r) => t + r.amount, 0), alerts = WD.can('billing.view') && !s ? poAlerts() : [];
      const ownRoute = S.shift || q.routes().some(r => r.driverId === (S.me && S.me.id));
      const out = [h('div.wf-inv-seg', ui.segmented([{ value: 'invoices', label: 'Invoices' }, { value: 'notes', label: 'Service notes' }], IV.kind, v => { IV.kind = v; IV.limit = 40; page.refresh(); })),
        /* One row of filters: route, dates, status, and the payment-status check. The route used to take a second selector and a row of its own. */
        (bar => { if (!bar) return null; const re = () => { IV.limit = 40; page.refresh(); };
          const rp = h('button.rc-pill' + (IV.scope === 'mine' ? '.on' : ''), { 'aria-label': 'Route', onclick: () => ui.menu(rp, [{ header: 'Route' }, { label: 'All routes', checked: IV.scope === 'all', onTap: () => { IV.scope = 'all'; re(); } },
            ...(ownRoute ? [{ label: 'My route · ' + q.routeName(route), checked: IV.scope === 'mine', onTap: () => { IV.scope = 'mine'; re(); } }] : q.routes().map(r => ({ label: q.routeName(r), checked: IV.scope === 'mine' && r.id === route, onTap: () => { IV.scope = 'mine'; IV.routeId = r.id; re(); } })))], { compact: true }) },
            IV.scope === 'mine' ? [ui.dot(q.routeColor(route)), ' ', q.routeName(route)] : 'All routes', icon('chevron.down', 13));
          bar.prepend(rp); bar.classList.add('scroll');
          if (IV.kind === 'invoices' && WD.co && WD.co.hasBooks && WD.co.hasBooks()) { const bk = h('button.rc-pill', { 'aria-label': 'Payment status', onclick: () => ui.menu(bk, [{ node: (WD.co.booksSection() || h('div')).querySelector('.row') || h('div') }]) }, icon('sync', 14), 'Payments'); bar.appendChild(bk); }
          return bar; })(WD.rc && WD.rc.filterBar && WD.rc.filterBar(WD.rc.invFilter, () => { IV.limit = 40; page.refresh(); }, { status: true })),
        inv5 && M.head(page, base, list),
        inv5 && S.desktop && list.length ? M.table(page, list, IV, r => openInvoiceRec(r)) : null,
        ui.list(
          /* Off-site destruction: a compact row while any load is waiting to be confirmed destroyed (billing.js). */
          !s && billing().destructionEntry && billing().destructionEntry(sp => page.push(sp)),
          IV.kind === 'notes' && notesList(page, s),
          IV.kind === 'invoices' && alerts.length > 0 && ui.section({ header: 'Purchase orders to fix', fold: true, folded: true }, alerts.map(x => h('div', h('div.footnote', { style: 'padding:10px 16px 0;font-weight:600' }, x.c.name), alertRow(x.a, () => guard('customers', 'openDetail', x.c.id))))),
          IV.kind !== 'invoices' || (inv5 && S.desktop && list.length) ? null : list.length ? ui.section({ header: (s || (inv5 && M.filtered()) ? list.length + (list.length === 1 ? ' match' : ' matches') : inv5 ? M.sortLabel() : 'Newest first') + (open ? ' · ' + fmt.money(open) + ' open' : ''), footer: 'Every invoice created' + (books() ? ', from ' + books() : '') + ', newest first. Invoices paid there are marked paid here automatically. Search by invoice number (“2417” finds INV-2417) or customer.' },
            list.slice(0, IV.limit).map(r => { const c = q.customer(r.customerId), rt = recRoute(r);
              return ui.row({ icon: inv5 && M.selecting() ? null : r.master ? 'tray' : 'doc.text', leading: inv5 && M.selecting() ? M.check(r) : null, iconColor: r.master ? 'var(--brown)' : 'var(--indigo)', title: c ? c.name : r.number, subtitle: h('span', h('b.rc-date', fmt.day(r.day, 'md') + ', ' + r.day.slice(0, 4)), h('span.rc-num', ' · ' + r.number + (IV.scope === 'all' && rt ? ' · ' : '')), IV.scope === 'all' && rt ? h('span.cu-route', ui.dot(q.routeColor(rt)), q.routeName(rt)) : null),
                badge: (st => ui.badge(st, INV_COLOR[st] || 'var(--orange)'))(WD.rc && WD.rc.invStatus ? WD.rc.invStatus(r) : r.status), detail: fmt.money(r.amount), chevron: true, onTap: () => { if (inv5 && M.selecting()) { M.toggle(r); page.refresh(); } else openInvoiceRec(r); } }); }),
            list.length > IV.limit && ui.row({ title: 'Show more', tint: true, center: true, onTap: () => { IV.limit += 60; page.refresh(); } }))
          : ui.empty({ icon: 'doc.text', title: s ? 'No invoices match' : 'No invoices', text: s ? 'Nothing matches “' + IV.query + '”' + (IV.scope === 'mine' ? ' on this route. Try All routes.' : '.') : WD.rc && WD.rc.invFilterOn && WD.rc.invFilterOn() ? 'Nothing matches the date and status filters' + (IV.scope === 'mine' ? ' on this route.' : '.') : inv5 && M.filtered() ? 'Nothing matches the tile you chose. Tap it again to see every invoice.' : 'Invoices appear here as they’re created.' }))];
      /* The desktop website uses the full width for the table; the root needs the class `wide`. */
      return inv5 && S.desktop ? h('div.wide.mny-wide', out) : out;
    } };
}

/* ================= Directions ================= */
WD.MAPS_APPS = [{ value: 'apple', label: 'Apple Maps' }, { value: 'google', label: 'Google Maps' }, { value: 'waze', label: 'Waze' }, { value: 'hammer', label: 'Hammer: Truck GPS & Maps' }];
const mapsName = () => (WD.MAPS_APPS.find(x => x.value === S.prefs.mapsApp) || WD.MAPS_APPS[0]).label;
function openDirections(job) { ui.toast('Opening ' + mapsName() + (job && job.title ? ' · ' + job.title : '') + '…', 'arrow.triangle.turn.up.right', 2200); }

/* ================= Completing a stop ================= */
const nextStop = job => q.stopList(job.routeId, job.day).find(j => j !== job && !WD.closed[j.status] && j.status !== 'completed');
/** Complete stop: works from any status — no need to tap Start driving or I've arrived first. Arrival time comes from GPS when it was never tapped. */
async function completeStop(job) {
  let mode = W.onComplete;
  if (mode === 'ask') { mode = await ui.actionSheet({ title: 'Complete ' + job.title + '?', buttons: [{ label: 'Complete and bill', value: 'billing' }, { label: 'Just complete', value: 'complete' }] }); if (!mode) return; }
  if (job.status !== 'completed') { const inferred = job.arrivedAt == null && W.arrival !== 'button'; api.setStatus(job.id, 'completed', inferred ? 'arrival time from GPS' : null); WD.emit('stopCompleted', job.id); }
  const auto = WD.cardJob(job);
  if (mode === 'complete' || !canInvoice() || auto || job.type === 'meet') { ui.toast(auto ? 'Completed · card on file is charged automatically' : 'Stop completed', 'checkmark', 2200); if (mode !== 'complete' || auto) afterBilling(job); else if (WD.co && WD.co.askReview && job.type !== 'meet') setTimeout(() => WD.co.askReview(job), 500); return; }
  /* Open the billing details from the job as it is now (looked up again by id), and say so if they can't be opened, rather than leaving the driver on the list. */
  setTimeout(() => { try { if (!q.job(job.id)) throw new Error('job'); billing().openEditor(job.id, { flow: true, onDone: () => afterBilling(job) }); } catch (e) { console.error(e); ui.alert({ title: 'Billing details didn’t open', message: 'The stop is marked complete. Open it from the “completed stop isn’t billed” line on the Shift tab to create the invoice.' }); } }, 250);
}
/** After billing: show the next customer, and optionally start directions there (not when it's at the same address). */
function afterBilling(job) { const ask = WD.co && WD.co.askReview ? WD.co.askReview(job) : null; return Promise.resolve(ask).catch(() => {}).then(() => showNext(job)); }   // the driver is asked about a Google review request first (R20-4)
function showNext(job) {
  if (W.afterBilling === 'stay') return;
  const next = nextStop(job);
  setTimeout(() => {
    if (!next) { const left = missed(job.routeId, job.day); if (W.missedCheck && left.length) ui.banner({ title: 'Last stop done', text: left.length + (left.length === 1 ? ' stop still needs' : ' stops still need') + ' an invoice, a paid–no invoice or a skip. Tap to fix.', icon: 'exclamationmark.triangle', color: 'var(--orange)', onTap: () => missedSheet(left) });
      else ui.toast('All stops done for the day', 'checkmark', 2400); return; }
    const same = next.address && next.address === job.address, onShift = S.shift && S.shift.routeId === job.routeId;
    ui.closeAllSheets();
    if (onShift) WD.nav.switchTab('shift'); else setTimeout(() => guard('jobs', 'openDetails', next.id), 450);
    if (W.afterBilling === 'navigate' && !same) { if (next.status === 'scheduled') api.setStatus(next.id, 'enroute'); setTimeout(() => openDirections(next), 700); }
    ui.banner({ title: 'Next stop', text: titleText(next) + (same ? ' — same address, no driving' : ''), icon: same ? 'building' : 'arrow.right', color: q.routeColor(next.routeId), duration: 3500 });
    WD.emit('nextStop', next.id);
  }, 420);
}
/** Paid on the spot, no invoice wanted: records the payment and fades the job like an invoiced one. */
async function paidNoInvoice(job, amount, onDone) {
  const m = await ui.actionSheet({ title: 'Paid — no invoice', message: job.title + (amount != null ? ' · ' + fmt.money(amount, true) : '') + '. No invoice is created or emailed.', buttons: [{ label: 'Cash', value: 'Cash' }, { label: 'Check', value: 'Check' }, { label: 'Card', value: 'Card' }, { label: 'Other', value: 'Other' }] });
  if (!m) return false;
  const me = S.me.name, amt = amount != null ? amount : (billing().linesForJob ? billing().linesForJob(job).reduce((s, l) => s + l.qty * l.rate, 0) : 0);
  api.op({ kind: 'edit', title: job.title, scope: 'Paid — no invoice · ' + m, jobIds: [job.id], apply() { job.billing = { kind: 'paidNoInvoice', method: m, amount: amt, at: +WD.now(), by: me }; job.events.push({ at: +WD.now(), actor: me, text: 'Paid on site, no invoice · ' + m + ' · ' + fmt.money(amt, true) }); } });
  ui.toast('Paid · no invoice', 'checkmark'); onDone && setTimeout(onDone, 300); return true;
}
/** Stops that weren't skipped, paid–no invoice, service-noted or invoiced. */
function missedSheet(list, o = {}) {
  return new Promise(resolve => {
    let cont = false;
    const sheet = ui.sheet({ title: 'Missed stops', leading: [{ label: o.continueLabel ? 'Cancel' : 'Close', onTap: p => p.dismiss() }], onClose: () => resolve(cont),
      render: p => { const left = list.map(j => q.job(j.id)).filter(j => j && needsAction(j));
        if (!left.length) setTimeout(() => { cont = true; p.dismiss(); ui.toast('Everything is billed', 'checkmark'); }, 600);
        return ui.list(h('div', { style: 'padding:4px 4px 0' }, ui.note(left.length ? left.length + (left.length === 1 ? ' stop has' : ' stops have') + ' no invoice, no paid–no invoice and no skip. Create what’s missing so nothing goes unbilled.' : 'All set.')),
          ui.section(null, left.map(j => ui.row({ title: titleNode(j), subtitle: j.status === 'completed' ? 'Completed · not billed' : 'Not completed, skipped or billed', icon: j.status === 'completed' ? 'dollarsign.circle' : 'exclamationmark.circle', iconColor: j.status === 'completed' ? 'var(--orange)' : 'var(--red)', chevron: true, onTap: () => fixMissed(j, p) }))),
          o.continueLabel && h('div', { style: 'padding:18px 0 0' }, ui.button(o.continueLabel, { kind: 'gray', onTap: () => { cont = true; p.dismiss(); } }))); } });
    sheet.closed.then(() => resolve(cont));
  });
}
async function fixMissed(j, p) {
  const c = q.customer(j.customerId), note = c && c.billingMode === 'serviceNote';
  const v = await ui.actionSheet({ title: j.title, message: j.status === 'completed' ? 'Completed but not billed.' : 'Not completed yet.', buttons: [{ label: note ? 'Create service note' : 'Create invoice', value: 'inv' }, !note && { label: 'Paid — no invoice', value: 'paid' }, j.status !== 'completed' && { label: 'Skip…', value: 'skip' }].filter(Boolean) });
  if (!v) return;
  if (v === 'skip') { await guard('jobs', 'skipFlow', j); p.refresh(); return; }
  if (j.status !== 'completed') api.setStatus(j.id, 'completed', 'marked from the missed-stop check');
  if (v === 'paid') { await paidNoInvoice(j); p.refresh(); return; }
  billing().openEditor && billing().openEditor(j.id, { onDone: () => p.refresh() });
}

/* ================= Settings → Field workflow ================= */
function workflowSpec() {
  const admin = WD.can('settings.manage'), set = (k, v) => { W[k] = v; WD.changed(); };
  const pick = (title, k, options, sub) => ui.pickerRow({ title, subtitle: sub, value: W[k], options, disabled: !admin, onChange: v => set(k, v) });
  return { title: 'Field workflow', render: () => ui.list(
    !admin && h('div', { style: 'padding:4px 4px 0' }, ui.note('These are company settings. Ask an owner or admin to change them.')),
    ui.section({ header: 'Arriving at a stop', footer: W.arrival === 'button' ? 'Drivers tap I’ve arrived at each stop.' : 'Arrival is recorded when the phone has stayed within the stop’s geofence for ' + W.dwellMin + ' min. Drivers never have to tap I’ve arrived' + (W.arrival === 'both' ? ', but the button stays available.' : '.') },
      pick('Record arrival', 'arrival', [{ value: 'auto', label: 'Automatically from GPS' }, { value: 'both', label: 'GPS, plus an I’ve arrived button' }, { value: 'button', label: 'Driver taps I’ve arrived' }]),
      W.arrival !== 'button' && ui.row({ title: 'Time near the stop', detail: W.dwellMin + ' min', trailing: admin ? ui.stepper(W.dwellMin, 1, 10, v => set('dwellMin', v)) : null })),
    ui.section({ header: 'Complete stop', footer: 'Drivers can complete a stop from any status — they don’t need Start driving or arrival first, for example when several customers share one address.' },
      pick('When Complete is tapped', 'onComplete', [{ value: 'billing', label: 'Open billing details' }, { value: 'complete', label: 'Just mark it complete' }, { value: 'ask', label: 'Ask each time' }],
        W.onComplete === 'billing' ? 'Line items, quantities, rates and service date, then Get signature or Create invoice' : null)),
    ui.section({ header: 'After the invoice', footer: W.afterBilling === 'navigate' ? 'Directions open in each driver’s chosen maps app. Not when the next customer is at the same address.' : null },
      pick('Then', 'afterBilling', [{ value: 'next', label: 'Show the next customer' }, { value: 'navigate', label: 'Show the next customer and start directions' }, { value: 'stay', label: 'Stay on this job' }])),
    ui.section({ header: 'Board', footer: W.dimWhen === 'billed' ? 'A completed job fades only after an invoice, paid–no invoice or service note. Completed-but-unbilled jobs stay bright with a Not billed tag.' : 'Jobs fade as soon as they’re completed.' },
      pick('Fade completed jobs', 'dimWhen', [{ value: 'billed', label: 'Once billed' }, { value: 'completed', label: 'As soon as completed' }])),
    ui.section({ header: 'Missed invoices', footer: 'Before clocking out, and after the last stop, drivers see every stop with no invoice, no paid–no invoice and no skip, and can fix each one.' },
      ui.toggleRow({ title: 'Check for missed invoices', value: W.missedCheck, disabled: !admin, onChange: v => { if (!admin) return false; set('missedCheck', v); } })),
    ui.section({ header: 'Details after the job title', footer: 'For drivers who know the way: important details show right after the customer’s name on the board, the shift list and the map. Turn off what your company doesn’t want in titles.' },
      ui.row({ title: 'Show details after titles', trailing: ui.toggle(W.titleDetails.on, v => { if (!admin) return false; W.titleDetails.on = v; WD.changed(); }) }),
      W.titleDetails.on && TD_OPTIONS.map(([k, title, ex]) => ui.row({ title, subtitle: ex, trailing: ui.toggle(W.titleDetails[k], v => { if (!admin) return false; W.titleDetails[k] = v; WD.changed(); }) })),
      W.titleDetails.on && W.titleDetails.hours && ui.row({ title: 'Ordinary hours', subtitle: 'Hours outside these show in the title', detail: short(fmt.fromHHMM(W.normalOpen)) + '–' + short(fmt.fromHHMM(W.normalClose)) })),
    ui.section({ header: 'Shift tracking', footer: 'Tracking stops and the driver is clocked out automatically this long after clock-in, in case someone forgets.' },
      ui.row({ title: 'Stop tracking after', detail: W.shiftCutoff + ' hours', trailing: admin ? ui.stepper(W.shiftCutoff, 8, 24, v => set('shiftCutoff', v)) : null }))) };
}

/* ================= Seed: service notes, POs and documents ================= */
(function seed() {
  const c9 = q.customer('c9'), c17 = q.customer('c17'), c5 = q.customer('c5'), doc = (c, kind, name, size, po) => c.documents.push({ id: 'doc' + (++docSeq), kind, name, size, po, at: +WD.now() - 864e5 * (30 + docSeq * 11) });
  if (c9) { c9.poSchedule.push({ po: 'PO 25-03318', from: D.add(today, -501), until: D.add(today, -137) }, { po: 'PO 26-04471', from: D.add(today, -136), until: D.add(today, 228) });
    doc(c9, 'contract', 'LUSD contract 2024-0193 (5 years).pdf', '1.2 MB'); doc(c9, 'po', 'PO-26-04471.pdf', '140 KB', 'PO 26-04471'); doc(c9, 'po', 'PO-25-03318.pdf', '132 KB', 'PO 25-03318'); }
  if (c17) { c17.poSchedule.push({ po: 'PO 7731-B', from: D.add(today, -349), until: D.add(today, 16) }); doc(c17, 'contract', 'County RFP 24-019 award.pdf', '2.4 MB'); doc(c17, 'po', 'PO-7731-B.pdf', '96 KB', 'PO 7731-B'); }
  if (c5) { c5.poSchedule.push({ po: 'PO C-1182-25', from: D.add(today, -385), until: D.add(today, -20) }); doc(c5, 'contract', 'City contract C-1182.pdf', '880 KB'); doc(c5, 'other', 'Vendor badge form.pdf', '64 KB'); }
  /* Jobs take the PO that covers their date. */
  data.jobs.forEach(j => { const c = q.customer(j.customerId); if (c && c.poSchedule.length) j.po = poFor(c, j.day).po; });
  /* Past service notes, from completed visits; last month's were already put on a master invoice. */
  const lines = j => billing().linesForJob ? billing().linesForJob(j) : [{ name: 'Service', qty: 1, rate: j.billing.amount }];
  let h1 = 11; const rnd = () => { h1 = (h1 * 1103515245 + 12345) >>> 0; return (h1 % 1000) / 1000; };
  const lbs = ls => ls.filter(l => WD.CONTAINERS.includes(l.id)).reduce((t, l) => t + l.qty * Math.round(18 + rnd() * 30), 0) || null;
  data.jobs.filter(j => j.billing && j.billing.kind === 'serviceNote').sort((a, b) => a.day.localeCompare(b.day)).forEach(j => { const ls = lines(j); addServiceNote(j, { number: j.billing.number, lines: ls, po: j.po, signer: j.billing.signer, by: j.billing.by, at: j.billing.at, pounds: lbs(ls) }); });
  /* The school district has many sites; each gets serviced on its own weekday, and every visit's signed note is saved toward the monthly master invoice. */
  if (c9) {
    const SITES = [['Site 104 - Lakemont High', 2, 760, 300, 1], ['Site 112 - Willow Creek Elem', 2, 440, 260, 2], ['Site 118 - Northgate Middle', 3, 650, 150, 3], ['Site 121 - Ridge Elementary', 2, 560, 110, 1], ['Site 130 - Harbor Elementary', 3, 720, 700, 4], ['Site 137 - Adult Ed Center', 4, 610, 420, 2], ['Site 142 - Transportation Yard', 2, 820, 520, 5]];
    SITES.forEach(([label, qty, x, y], i) => c9.locations.push({ id: 'c9s' + i, label, address: (300 + i * 117) + ' ' + ['Campus Dr', 'Willow Creek Rd', 'Northgate Blvd', 'Ridge Rd', 'Harbor Rd', 'Mercer St', 'Depot Ln'][i] + ', Lakemont', x, y, containers: qty + ' bins (64 gal)', items: [{ id: 'bin64', qty, rate: c9.rate64 }], bizOpen: '07:30', bizClose: '15:30', notes: 'Sign in at the front office; site contact signs the service ticket.', lunchFrom: '', lunchUntil: '', closedDays: [], callAhead: 0, contactName: ['M. Ortiz', 'J. Chen', 'R. Patel', 'S. King'][i % 4], noteEmail: i === 5 ? '' : 'site' + label.replace(/^Site (\d+).*/, '$1') + '@lusd.example' }));
    c9.billingEmail = c9.billingEmail || 'accountspayable@lusd.example'; c9.locations[0].noteEmail = c9.locations[0].noteEmail || 'site101@lusd.example';
    const start = D.add(today, -(D.parse(today).getDate() - 1) - 1), from = start.slice(0, 8) + '01';
    for (let d = from; d < today; d = D.add(d, 1)) { const dow = D.parse(d).getDay(); if (!dow || dow === 6) continue;
      SITES.forEach(([label, qty], i) => { if ((i % 5) + 1 !== dow || rnd() < 0.12) return; const loc = c9.locations.find(l => l.label === label), ls = [{ id: 'bin64', name: 'Bin service (64 gal)', qty, rate: c9.rate64 }];
        data.serviceNotes.push({ id: 'sn' + (++snSeq), number: 'SN-' + snSeq, customerId: 'c9', jobId: null, day: d, location: label, address: loc.address, lines: ls, amount: qty * c9.rate64, pounds: lbs(ls), po: poFor(c9, d).po, signer: ['M. Ortiz', 'J. Chen', 'R. Patel', 'S. King'][i % 4], sig: null, by: 'Marcus Bell', at: +D.parse(d) - 3 * 36e5 + i * 9e5, masterId: null }); }); }
  }
  [c9, c17].forEach(c => { if (!c) return; const prev = openNotes(c.id).filter(n => monthKey(n.day) < monthKey(today)); if (prev.length) { const mi = createMaster(c, prev); mi.at = +D.parse(D.add(today, -(D.parse(today).getDate() - 1))); const rec = data.invoices && data.invoices.find(x => x.id === 'inv-' + mi.id); if (rec) { rec.at = mi.at; rec.day = D.key(new Date(mi.at)); } } });
})();

const api2 = { billed, dimmed, needsAction, missed, billingLabel, titleDetails, titleNode, titleText, poFor, poAlert, poAlerts, alertRow, customerSections, docsEditor, poScheduleSpec, editPO, BILLING_MODES,
  addServiceNote, masterSpec, invoicesSpec, invoiceActionRows, markPaid, applyPaid, invRecFor, openInvoiceRec, openDirections, mapsName, completeStop, afterBilling, paidNoInvoice, missedSheet, workflowSpec, nextStop,
  /** “Awaiting destruction confirmation” page (off-site destruction); the list itself lives in billing.js. */
  destructionSpec: () => billing().destructionSpec ? billing().destructionSpec() : { title: 'Awaiting destruction', render: () => ui.empty({ icon: 'clock', title: 'Not available' }) },
  awaitingDestruction: () => billing().awaitingDestruction ? billing().awaitingDestruction().length : 0 };
WD.workflow = WD.screens.workflow = api2;

/** From another workspace column: list the selected customer's invoices here (every route), by putting the name in the search. */
function invLinked(sel) { const j = sel.jobId && q.job(sel.jobId), c = q.customer(sel.customerId || (j && j.customerId)); if (!c) return false; const st = WD.app.paneStack && WD.app.paneStack('invoices'); if (!st) return false;
  while (st.pages.length > 1) { const p = st.pages.pop(); p.el.remove(); p.spec.onClose && p.spec.onClose(p); } const page = st.top(); page.el.classList.remove('behind');
  IV.query = c.name; IV.scope = 'all'; IV.limit = 40; const box = page.el.querySelector('.search-box'), inp = box && box.querySelector('input'); if (inp) { inp.value = c.name; box.classList.add('filled'); } page.refresh(); return true; }
WD.screens.invoices = { root: invoicesSpec, onLinked: invLinked };
WD.panel.addJump('Invoices', () => WD.nav.switchTab('invoices'));
WD.panel.addJump('Field workflow', () => { WD.nav.switchTab('settings'); WD.nav.push(workflowSpec()); });
WD.panel.addJump('Master invoice', () => { WD.nav.switchTab(WD.can('crm.view') ? 'customers' : 'board'); WD.nav.push(masterSpec('c9')); });
WD.panel.addAction('Driver leaves a stop without billing', () => {
  const r = q.visibleRoutes()[0], j = r && q.stopList(r.id, today).find(x => !WD.closed[x.status]); if (!j) return ui.toast('No open stops', 'info.circle');
  api.setStatus(j.id, 'completed', 'left geofence'); ui.banner({ title: q.routeName(r), text: j.title + ' was completed but not billed — it stays bright on the board until it is.', icon: 'dollarsign.circle', color: 'var(--orange)' });
});
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('invoices', IV); }
})();
