/* Round 8 additions (prototype 2.7). Registers WD.r8:
   purge pricing by the box or by the 65-gallon bin (Settings → Purge pricing), export and backup (Settings → Export and backup),
   postponed jobs that have no new date yet (Dispatch menu), and the 45-day planning map: every job in the next 45 days,
   the ones near a typed address, and each customer's service dates (Map → calendar button). */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD;
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You', admin = () => WD.can('settings.manage');
const plural = (n, w) => n + ' ' + (n === 1 ? w : w === 'box' ? 'boxes' : w + 's');
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'This needs the Company settings permission. An owner or admin can grant it in Team and roles.' });
const R8 = WD.r8 = {};

WD.css(`
.r8-ex { padding: 10px 16px 12px; font-size: 14px; line-height: 21px; color: var(--label2); } .r8-ex b { color: var(--label); }
.pm-wrap { padding: 6px 16px 0; } .pm-map { position: relative; } .pm-map .mm { border-radius: 14px; }
.pm-pin { position: absolute; transform: translate(-50%, -50%); width: 25px; height: 25px; border-radius: 50%; background: var(--c); border: 3px solid var(--ring, #fff); color: var(--fg, #fff); font-family: inherit; font-size: 9.5px; font-weight: 800; letter-spacing: 0; display: grid; place-items: center; box-shadow: 0 1px 3px rgba(0,0,0,.35); padding: 0; cursor: pointer; }
.pm-pin.faded { opacity: .38; width: 19px; height: 19px; font-size: 0; border-width: 2.5px; } .pm-pin.sel { outline: 3px solid var(--tint); outline-offset: 2px; z-index: 3; opacity: 1; }
.pm-target { position: absolute; width: 20px; height: 20px; transform: translate(-50%, -100%) rotate(-45deg); transform-origin: 50% 100%; margin-top: -3px; border-radius: 50% 50% 50% 0; background: #FF3B30; border: 2.5px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.45); z-index: 2; pointer-events: none; }
.pm-target::after { content: ''; position: absolute; inset: 4px; border-radius: 50%; background: #fff; }
.pm-stamp { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--label2); padding: 8px 2px 0; }
.pm-dates { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px 12px; } .pm-dates span { font-size: 12.5px; padding: 3px 8px; border-radius: 8px; background: var(--fill3); color: var(--label); white-space: nowrap; }
.pm-dates span.proj { background: transparent; box-shadow: inset 0 0 0 1px var(--label3); color: var(--label2); }
.pm-seg { padding: 10px 16px 0; }
`);

/* ================= Purge pricing: by the box, or by the 65-gallon bin ================= */
const purgeTotal = boxes => { const pd = { std: boxes }, e = WD.purgeEstimate(pd); return WD.purgeItems(pd, e, null).reduce((s, x) => s + x.qty * x.rate, 0); };
/** Upcoming purge jobs still priced the other way (not started, not billed). */
const otherWay = () => { const bin = data.purgePricing.method === 'bin'; return data.jobs.filter(j => j.purge && j.status === 'scheduled' && !j.invoice && !j.billing && j.day >= today() && (j.items || []).some(i => i.id === (bin ? 'box' : 'binFlat'))); };
R8.pricingLabel = () => { const PP = data.purgePricing; return PP.method === 'bin' ? 'By the bin · ' + fmt.money(PP.binFlat) + ' up to ' + PP.binIncluded + ', then ' + fmt.money(PP.binExtra) : 'By the box · ' + fmt.money(data.priceBook.find(x => x.id === 'box').rate) + ' a box'; };
R8.pricingSpec = () => ({ title: 'Purge pricing', render: page => { if (!admin()) return locked();
  const PP = data.purgePricing, P = data.purgeRules, bin = PP.method === 'bin', box = data.priceBook.find(x => x.id === 'box'), re = () => { WD.syncPurgeBook(); WD.changed(); page.refresh(); };
  const amount = (title, sub, get, set) => h('div.row', h('div.row-main', h('div.row-title', title), sub && h('div.row-sub', sub)),
    h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': title, value: '$' + get(), onchange: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); if (!isNaN(v)) set(v); re(); } }));
  const choice = (v, title, sub) => ui.row({ icon: PP.method === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: PP.method === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, onTap: () => { if (PP.method === v) return; PP.method = v; re(); ui.toast(v === 'bin' ? 'Purge jobs are priced by the bin' : 'Purge jobs are priced by the box', 'checkmark', 2200); } });
  const ex = n => { const bins = WD.purgeBins(n); return h('div', plural(n, 'box'), bin ? ' → ' + plural(bins, 'bin') : '', ' → ', h('b', fmt.money(purgeTotal(n)))); };
  const old = otherWay();
  return ui.list(
    ui.section({ header: 'Primary pricing method for purge jobs', footer: 'New purge jobs are estimated this way, and the invoice is written the same way. An invoice keeps the lines the job has: nothing is converted to per-box pricing.' },
      choice('box', 'By the box', 'A price for each standard box'), choice('bin', 'By the 65-gallon bin', 'A flat fee that covers the first bins, then a price for each bin after')),
    bin ? ui.section({ header: 'Bin pricing', footer: 'For example ' + fmt.money(PP.binFlat) + ' flat for up to ' + plural(PP.binIncluded, 'bin') + ', then ' + fmt.money(PP.binExtra) + ' for each additional bin. Both lines can still be changed on a job or its invoice.' },
        amount('Flat fee', 'Covers the first bins', () => PP.binFlat, v => { PP.binFlat = v; }),
        ui.row({ title: 'The flat fee covers up to', detail: plural(PP.binIncluded, 'bin'), trailing: ui.stepper(PP.binIncluded, 1, 20, v => { PP.binIncluded = v; re(); }) }),
        amount('Each additional bin', null, () => PP.binExtra, v => { PP.binExtra = v; }))
      : ui.section({ header: 'Box pricing', footer: 'The same rate as “Purge, per box” in Items, services and fees. It can be changed per customer and per job.' }, amount('Price per box', 'Standard 10×12×15" box', () => box.rate, v => { box.rate = v; })),
    ui.section({ header: 'Boxes in a 65-gallon bin', footer: 'How many standard boxes fit in one bin. It turns a box count into bins for pricing, and bins into boxes for the time on site. Lower it if your drivers fit fewer: some only put 7 in a bin.' },
      ui.row({ title: 'Boxes per bin', detail: plural(P.bin65, 'box'), trailing: ui.stepper(P.bin65, 1, 20, v => { P.bin65 = v; re(); }) })),
    ui.section({ header: 'What that comes to' }, h('div.r8-ex', [P.bin65 * PP.binIncluded, P.bin65 * PP.binIncluded + 1, 40, 100].map(ex))),
    old.length > 0 && ui.section({ header: 'Jobs already scheduled', footer: 'These upcoming purge jobs were priced ' + (bin ? 'by the box' : 'by the bin') + ' before the method changed. Jobs that were started or billed are left alone.' },
      old.slice(0, 6).map(j => ui.row({ title: j.title, subtitle: fmt.day(j.day) + ' · ' + WD.itemsLabel(j.items, true), detail: fmt.money(j.items.reduce((s, i) => s + i.qty * i.rate, 0)) })),
      ui.row({ icon: 'arrow.clockwise', iconPlain: true, title: 'Reprice ' + plural(old.length, 'job') + (bin ? ' by the bin' : ' by the box'), tint: true, onTap: () => { const n = old.length;
        WD.api.op({ kind: 'batch', title: 'Purge pricing', scope: plural(n, 'job') + ' repriced', jobIds: old.map(j => j.id), apply() { old.forEach(j => { j.items = j.items.filter(i => !WD.PURGE_IDS.includes(i.id)).concat(WD.purgeItems(j.purge, WD.purgeEstimate(j.purge), null)); j.events.push({ at: +WD.now(), actor: me(), text: 'Repriced ' + (bin ? 'by the bin' : 'by the box') + ' · ' + fmt.money(j.items.reduce((s, i) => s + i.qty * i.rate, 0)) }); }); } });
        page.refresh(); ui.toast(plural(n, 'job') + ' repriced', 'checkmark'); } })));
} });

/* ================= Export and backup ================= */
data.backup = { auto: 'weekly', last: +WD.now() - 3 * 864e5, history: [] };
const ts = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? String(t) : d.toISOString().slice(0, 16).replace('T', ' '); };
const cname = id => (q.customer(id) || {}).name || '';
const lineText = ls => (ls || []).map(l => l.qty + ' × ' + (l.name || (data.priceBook.find(x => x.id === l.id) || {}).name || l.id) + ' @ ' + l.rate).join('; ');
/** What can be exported. Each set → one or more tables of flat rows. */
const SETS = [
  ['customers', 'Customers', 'Customers, their locations and contacts', 'person.2', 'var(--blue)', () => { const cs = data.customers.filter(c => !['lead', 'contacted', 'quoted', 'lost'].includes(c.lifecycle)); return {
    customers: cs.map(c => ({ id: c.id, name: c.name, customer_type: c.custType, job_type: c.type, frequency: c.freq, stage: c.lifecycle, route: q.routeName(c.route), billing: c.billingMode === 'serviceNote' ? 'Monthly master invoice' : 'Invoice each visit', billing_email: c.billingEmail, po: c.po, contract: c.contract, terms: c.terms, signature: c.signature, tags: (c.tags || []).join(', '), notes: c.notes })),
    locations: cs.flatMap(c => c.locations.map(l => ({ customer_id: c.id, customer: c.name, location_id: l.id, location: l.label, address: l.address, containers: l.containers, opens: l.bizOpen, closes: l.bizClose, site_contact: l.contactName, service_note_email: l.noteEmail, access_notes: l.notes }))),
    contacts: cs.flatMap(c => c.contacts.map(p => ({ customer_id: c.id, customer: c.name, name: p.name, role: p.role, phone: fmt.phone(p.phone), email: p.email }))) }; }],
  ['jobs', 'Jobs and schedule', 'Every job on this iPhone and the server, with status and stop order', 'calendar', 'var(--red)', () => ({
    jobs: data.jobs.map(j => ({ id: j.id, day: j.day, route: q.routeName(j.routeId), stop: j.allDay ? '' : j.seq, title: j.title, customer_id: j.customerId, address: j.address, status: j.status, job_type: j.type, containers: WD.itemsLabel(j.items, j.type === 'purge'), lines: lineText(j.items), po: j.po, repeats: j.recurring ? j.recurring.rule : '', rescheduled_to: j.rescheduledTo, notes: j.notes })) })],
  ['invoices', 'Invoices and payments', 'Invoices, payments, service notes and master invoices', 'doc.text', 'var(--green)', () => ({
    invoices: (data.invoices || []).map(i => ({ number: i.number, customer_id: i.customerId, customer: cname(i.customerId), date: i.day, amount: i.amount, status: i.status, paid: (i.payments || []).reduce((s, p) => s + (+p.amount || 0), 0), po: i.po, master_invoice: i.master ? 'yes' : '', lines: lineText(i.lines) })),
    payments: (data.invoices || []).flatMap(i => (i.payments || []).map(p => ({ invoice: i.number, customer: cname(i.customerId), date: p.day || ts(p.at), amount: p.amount, method: p.method, reference: p.ref || p.checkNo }))),
    service_notes: (data.serviceNotes || []).map(n => ({ number: n.number, customer: cname(n.customerId), location: n.location, date: n.day, amount: n.amount, pounds: n.pounds, po: n.po, signed_by: n.signer, emailed_to: n.emailedTo, master_invoice: ((data.masterInvoices || []).find(m => m.id === n.masterId) || {}).number, lines: lineText(n.lines) })) })],
  ['crm', 'CRM', 'Leads, quotes and bids, tasks, referrals, calls, texts and notes', 'funnel', 'var(--purple)', () => ({
    leads: data.customers.filter(c => ['lead', 'contacted', 'quoted', 'scheduled', 'lost'].includes(c.lifecycle)).map(c => ({ id: c.id, name: c.name, stage: c.lifecycle, priority: c.priority || 'medium', source: c.source, heard_from: c.channel, assigned_to: (q.user(c.owner) || {}).name, next_follow_up: c.nextAction, situation: c.situation, lost_reason: c.lostReason, archived: c.archived ? 'yes' : '', contact: (c.contacts[0] || {}).name, phone: fmt.phone((c.contacts[0] || {}).phone), email: (c.contacts[0] || {}).email, address: (c.locations[0] || {}).address, notes: c.notes })),
    quotes: (data.quotes || []).map(x => ({ number: x.number, kind: x.kind, customer: cname(x.customerId), status: x.status, total: x.items.reduce((s, i) => s + i.qty * i.rate, 0), service: x.freq, sent: ts(x.sentAt), bid_due: x.due, lines: lineText(x.items), notes: x.notes })),
    tasks: (data.tasks || []).map(t => ({ title: t.title, customer: cname(t.customerId), due: t.due, done: t.done ? 'yes' : '', assigned_to: (q.user(t.owner) || {}).name })),
    referrals: (data.referrals || []).map(r => ({ lead: cname(r.leadId), referred_by: cname(r.byId), date: ts(r.at), thanked: r.thanked ? 'yes' : '' })),
    activity: (data.interactions || []).map(i => ({ customer: cname(i.customerId), type: i.type, when: ts(i.at), by: i.by, direction: i.dir, text: i.text || i.summary || (i.messages || []).map(m => m.text).join(' / ') })) })],
  ['agreements', 'Service agreements', 'Agreements with their status, term and who signed', 'signature', 'var(--indigo)', () => ({
    agreements: (data.agreements || []).map(a => ({ number: a.number, customer: cname(a.customerId), status: a.status, term_months: a.term, start: a.start, sent: ts(a.sentAt), signed: ts(a.signedAt), signed_by: a.signer, method: a.method })) })],
  ['team', 'Team, routes and vehicles', 'People and roles, routes, vehicles and time off', 'person.2', 'var(--orange)', () => ({
    team: data.users.map(u => ({ name: u.name, email: u.email, role: u.role, status: u.status })),
    routes: data.routes.map(r => ({ name: r.name, nickname: r.nickname, color: r.colorOverride || r.color, driver: (q.user(r.driverId) || {}).name, vehicle: (q.vehicle(r.vehicleId) || {}).name, shown: r.visible ? 'yes' : '' })),
    vehicles: (data.vehicles || []).map(v => ({ name: v.name, plate: v.plate, active: v.active === false ? '' : 'yes' })),
    time_off: (data.timeOff || []).map(t => ({ person: (q.user(t.userId) || {}).name, from: t.from, to: t.to, status: t.status, note: t.note })) })],
  ['settings', 'Settings', 'Company settings, the price book, purge pricing, templates and holidays', 'gearshape', 'var(--gray)', () => ({
    price_book: data.priceBook.map(x => ({ id: x.id, name: x.name, unit: x.unit, rate: x.rate })),
    templates: (data.templates || []).map(t => ({ name: t.name, group: t.group, sent_as: t.channel, subject: t.subject, body: t.body })),
    holidays: (data.holidays || []).map(x => ({ day: x.day, name: x.name })),
    settings: [{ company: (S.org || {}).name, purge_pricing: data.purgePricing, purge_rules: data.purgeRules, time_on_site: data.siteRules, field_workflow: data.workflow, time_rules: data.timeRules, company_settings: data.settings }] })],
];
const cell = v => { if (v == null) return ''; if (typeof v === 'object') v = safeJSON(v); v = String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function safeJSON(v, space) { const seen = new WeakSet(); return JSON.stringify(v, (k, x) => { if (typeof x === 'function' || (typeof Node !== 'undefined' && x instanceof Node)) return undefined; if (x && typeof x === 'object') { if (seen.has(x)) return undefined; seen.add(x); } return x; }, space); }
const toCSV = rows => { const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]; return '﻿' + [cols.join(',')].concat(rows.map(r => cols.map(c => cell(r[c])).join(','))).join('\r\n') + '\r\n'; };
/** A plain .zip (stored, not compressed), so the CSV files download as one file with nothing but the browser. */
function zip(files) {
  const enc = new TextEncoder(), crc32 = u8 => { let crc = ~0; for (let i = 0; i < u8.length; i++) { let c = (crc ^ u8[i]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; };
  const d = WD.now(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), parts = [], central = []; let offset = 0;
  files.forEach(f => { const name = enc.encode(f.name), body = enc.encode(f.text), crc = crc32(body), head = new DataView(new ArrayBuffer(30)), cd = new DataView(new ArrayBuffer(46));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, body.length, 4], [22, body.length, 4], [26, name.length, 2], [28, 0, 2]].forEach(([o, v, n]) => n === 4 ? head.setUint32(o, v, true) : head.setUint16(o, v, true));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, body.length, 4], [24, body.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]].forEach(([o, v, n]) => n === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true));
    parts.push(head, name, body); central.push(cd, name); offset += 30 + name.length + body.length; });
  const size = central.reduce((s, x) => s + x.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, size, 4], [16, offset, 4], [20, 0, 2]].forEach(([o, v, n]) => n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
  return new Blob(parts.concat(central, [end]), { type: 'application/zip' });
}
function download(name, blob) { const a = h('a', { href: URL.createObjectURL(blob), download: name, style: 'display:none' }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000); }
const sizeText = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const EX = { sel: Object.fromEntries(SETS.map(s => [s[0], true])), format: 'csv' };
/** Build the file for the chosen sets. → {name, blob, tables, rows} */
function buildExport() {
  const tables = {}; SETS.filter(s => EX.sel[s[0]]).forEach(s => Object.assign(tables, s[5]()));
  const rows = Object.values(tables).reduce((n, t) => n + t.length, 0), org = ((S.org || {}).name || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), base = 'work-dispatcher-' + org + '-' + today();
  if (EX.format === 'json') return { name: base + '.json', rows, tables: Object.keys(tables).length, blob: new Blob([safeJSON({ app: 'Work Dispatcher', version: WD.version, exported: WD.now().toISOString(), exported_by: me(), company: (S.org || {}).name, ...tables }, 1)], { type: 'application/json' }) };
  const files = Object.entries(tables).map(([k, t]) => k === 'settings' ? { name: 'settings.json', text: safeJSON(t[0], 1) } : { name: k + '.csv', text: toCSV(t) });
  files.push({ name: 'README.txt', text: 'Work Dispatcher export\r\nCompany: ' + ((S.org || {}).name || '') + '\r\nExported: ' + ts(+WD.now()) + ' by ' + me() + '\r\n\r\nOne CSV file per kind of record (UTF-8, comma separated, first row is the column names). They open in Excel, Numbers and Google Sheets and import into other software. settings.json holds the company settings.\r\n\r\nFiles:\r\n' + files.map(f => '  ' + f.name).join('\r\n') + '\r\n' });
  return { name: base + '.zip', rows, tables: Object.keys(tables).length, blob: zip(files) };
}
R8.exportSpec = () => ({ title: 'Export and backup', render: page => { if (!admin()) return locked();
  const B = data.backup, any = SETS.some(s => EX.sel[s[0]]), count = s => Object.values(s[5]()).reduce((n, t) => n + t.length, 0), owner = data.users.find(u => u.role === 'owner') || S.me;
  const AUTO = [{ value: 'off', label: 'Off' }, { value: 'daily', label: 'Every night' }, { value: 'weekly', label: 'Every week' }, { value: 'monthly', label: 'Every month' }];
  return ui.list(
    h('div', { style: 'padding:4px 4px 0' }, ui.note('Your information is yours. Export it at any time to keep a backup of your own, or to import it into another program.')),
    ui.section({ header: 'What to export', footer: 'Each kind of record becomes its own table. Signatures, photos and attached documents are exported as links.' },
      SETS.map(s => ui.toggleRow({ icon: s[3], iconColor: s[4], title: s[1], subtitle: s[2], detail: count(s).toLocaleString('en-US'), value: EX.sel[s[0]], onChange: v => { EX.sel[s[0]] = v; page.refresh(); } }))),
    ui.section({ header: 'Format', footer: EX.format === 'csv' ? 'One .zip with a CSV file for each table. CSV opens in Excel, Numbers and Google Sheets, and is what most other software imports.' : 'One JSON file with everything in it: the most complete copy, best as a backup.' },
      [['csv', 'Spreadsheet files (CSV in a .zip)', 'To open in Excel or import into another program'], ['json', 'Full backup (one JSON file)', 'Everything in a single file']].map(([v, title, sub]) => ui.row({ icon: EX.format === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: EX.format === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, onTap: () => { EX.format = v; page.refresh(); } }))),
    h('div', { style: 'padding:16px 0 0' }, ui.button('Export now', { icon: 'share', disabled: !any, onTap: async () => { let out = null;
      if (!await ui.run('Preparing the export…', () => { out = buildExport(); }, { done: 'Export ready', min: 900, max: 1600 })) return;
      download(out.name, out.blob); B.history.unshift({ at: +WD.now(), by: me(), name: out.name, size: out.blob.size, rows: out.rows, tables: out.tables }); B.last = +WD.now(); WD.changed(); page.refresh();
      ui.toast(out.name + ' · ' + sizeText(out.blob.size), 'checkmark', 3200); } })),
    ui.section({ header: 'Automatic backups', footer: B.auto === 'off' ? 'Off. Nothing is backed up unless you export it here.' : 'A full backup is made ' + ({ daily: 'every night', weekly: 'every Sunday night', monthly: 'on the 1st of every month' })[B.auto] + ' and a download link is emailed to ' + owner.email + '. The last 12 are kept, so a server problem never leaves you without your information.' },
      ui.pickerRow({ icon: 'cloud', iconColor: 'var(--teal)', title: 'Back up automatically', value: B.auto, options: AUTO, onChange: v => { B.auto = v; WD.changed(); page.refresh(); } }),
      B.auto !== 'off' && ui.row({ title: 'Last automatic backup', detail: fmt.rel(B.last) })),
    B.history.length > 0 && ui.section('Exports from this iPhone', B.history.slice(0, 6).map(x => ui.row({ icon: 'doc', iconColor: 'var(--gray)', title: x.name, subtitle: plural(x.rows, 'row') + ' in ' + plural(x.tables, 'table') + ' · ' + sizeText(x.size) + ' · ' + x.by, detail: fmt.rel(x.at) }))));
} });

/* ================= Postponed jobs with no new date ================= */
R8.postponed = () => data.jobs.filter(j => j.status === 'postponed' && !j.rescheduledTo).sort((a, b) => a.day.localeCompare(b.day));
const postponedAt = j => { const e = (j.events || []).slice().reverse().find(x => /postponed/i.test(x.text)); return e || { at: +D.parse(j.day), actor: '' }; };
async function setNewDate(j, page) {
  const J = WD.screens.jobs, day = await J.pickDay('New date for ' + j.title, j.day > today() ? j.day : today()); if (!day) return;
  WD.api.op({ kind: 'status', title: j.title, scope: 'Rescheduled to ' + fmt.day(day), jobIds: [j.id], apply() { j.status = 'rescheduled'; j.rescheduledTo = day; J.copyTo(j, day);
    j.events.push({ at: +WD.now(), actor: me(), text: 'New date set: ' + fmt.day(day) }); (data.tasks || []).forEach(t => { if (t.customerId === j.customerId && !t.done && /postponed/i.test(t.title)) { t.done = true; t.doneAt = +WD.now(); } }); } });
  ui.toast('On the schedule for ' + fmt.day(day), 'calendar', 2400); page && page.refresh();
}
R8.postponedSpec = () => ({ title: 'Postponed', render: page => { const list = R8.postponed(), edit = WD.can('jobs.edit');
  return ui.list(
    ui.section({ header: list.length ? plural(list.length, 'job') + ' with no new date' : null, footer: 'Jobs a customer postponed without choosing a new day. They stay here until a date is set or the visit is canceled, so none are forgotten.' },
      list.map(j => { const p = postponedAt(j), c = q.customer(j.customerId), wait = Math.max(0, Math.floor((+WD.now() - p.at) / 864e5));
        return ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: ['Was ' + fmt.day(j.day) + ' · ' + q.routeName(j.routeId) + (WD.itemsLabel(j.items, j.type === 'purge') ? ' · ' + WD.itemsLabel(j.items, j.type === 'purge') : ''), 'Postponed ' + (wait ? plural(wait, 'day') + ' ago' : 'today') + (p.actor ? ' · ' + p.actor : '') + (p.text && / — /.test(p.text) ? ' · ' + p.text.split(' — ').slice(1).join(' — ') : '')].map(x => h('div', x)),
          badge: wait >= 14 ? ui.badge(wait + ' days', 'var(--red)') : null, chevron: true, onTap: async () => {
            const v = await ui.actionSheet({ title: j.title, message: 'Postponed from ' + fmt.day(j.day, 'long') + '.', buttons: [edit && { label: 'Set a new date…', value: 'date' }, { label: 'Open the job', value: 'job' }, c && WD.can('crm.view') && { label: 'Open ' + c.name, value: 'cust' }, edit && { label: 'Cancel the visit', value: 'cancel', role: 'destructive' }].filter(Boolean) });
            if (v === 'date') setNewDate(j, page); else if (v === 'job') WD.screens.jobs.openDetails(j.id); else if (v === 'cust') WD.screens.customers.openDetail(c.id);
            else if (v === 'cancel') { WD.api.op({ kind: 'status', title: j.title, scope: 'Customer canceled', jobIds: [j.id], apply() { j.status = 'canceled'; j.events.push({ at: +WD.now(), actor: me(), text: 'Postponed visit canceled' }); } }); page.refresh(); ui.toast('Marked canceled', 'checkmark'); } } }); }),
      !list.length && ui.row({ title: 'Nothing is waiting for a date', subtitle: 'To postpone a job, open it and choose Customer called → Postponed.' })));
} });
R8.openPostponed = () => WD.nav.push(R8.postponedSpec());
R8.setNewDate = setNewDate; R8.postponedAt = postponedAt;
/* Sample postponed jobs, so the list has something in it. */
[[1, 'r3', 1, 3, 'Customer is moving offices and will call with a date'], [2, 'r1', 2, 16, 'Office closed for remodeling'], [3, 'r2', 0, 6, 'Asked to skip this visit and reschedule later']].forEach(([n, rid, idx, ago, why]) => {
  let day = D.add(today(), n); if (D.parse(day).getDay() === 0) day = D.add(day, 1);
  const j = q.stopList(rid, day).filter(x => x.status === 'scheduled' && x.customerId && !x.pending)[idx]; if (!j) return;
  j.status = 'postponed'; j.events.push({ at: +WD.now() - ago * 864e5, actor: 'Priya Raman', text: 'Customer postponed — ' + why });
});

/* ================= 45-day planning map: jobs near an address ================= */
const MILE = 25 /* map units to a mile */, RADII = [1, 3, 5, 10, 50], RANGES = [[7, '1 week'], [14, '2 weeks'], [28, '4 weeks'], [45, '45 days'], [90, '90 days']];
const PM = { text: '', target: null, radius: 3, sel: null, sites: null, at: null, manual: false, days: 45 };
/* How far ahead the map looks is chosen on the map (1 week to 90 days). Distances follow the company's units (miles or kilometers). */
const rangeText = () => (RANGES.find(r => r[0] === PM.days) || [0, PM.days + ' days'])[1], rangeLabel = () => 'Next ' + rangeText();
const metric = () => WD.locale.units === 'metric', rMi = () => metric() ? PM.radius / 1.609 : PM.radius, uLabel = () => metric() ? ' km' : ' mi', rText = () => PM.radius + (metric() ? ' km' : PM.radius === 1 ? ' mile' : ' miles');
const hash = s => { let n = 7; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };
/** Every place with a job from today through the chosen range (45 days to start), with its service dates. Jobs on the board come first; past the days already on
    the board, dates come from each customer's recurring schedule. */
function buildSites() {
  const t0 = today(), t1 = D.add(t0, PM.days), sites = new Map(), ok = j => !j.allDay && j.located !== false && j.x != null && !WD.calledOff(j) && j.status !== 'skipped';
  const put = (j, day, projected) => { const c = q.customer(j.customerId), key = c ? c.id + '|' + (j.locationId || '') : 'j|' + j.title + '|' + j.address, loc = c && (c.locations.find(l => l.id === j.locationId) || c.locations[0]);
    let s = sites.get(key); if (!s) sites.set(key, s = { key, customerId: c ? c.id : null, name: c ? c.name : j.title, place: c && c.locations.length > 1 && loc ? loc.label : '', address: j.address || (loc && loc.address) || '', x: j.x, y: j.y, routeId: j.routeId, type: j.type, freq: c ? c.freq : 'One time', containers: WD.itemsLabel(j.items, j.type === 'purge'), dates: [] });
    if (!s.dates.some(d => d.day === day)) s.dates.push({ day, routeId: j.routeId, projected, jobId: projected ? null : j.id }); };
  const real = data.jobs.filter(j => ok(j) && j.day >= t0 && j.day <= t1); real.forEach(j => put(j, j.day, false));
  const lastDay = data.jobs.reduce((m, j) => j.day > m ? j.day : m, t0);
  for (let k = D.add(lastDay, 1); k <= t1; k = D.add(k, 1)) { let src = D.add(k, -14); while (src > lastDay) src = D.add(src, -14); if (src < t0) continue;
    data.jobs.filter(j => j.day === src && ok(j) && j.recurring && j.customerId).forEach(j => put(j, k, true)); }
  sites.forEach(s => s.dates.sort((a, b) => a.day.localeCompare(b.day)));
  return [...sites.values()];
}
function loadSites(manual) { PM.sites = buildSites(); PM.manual = !!manual; PM.at = +WD.now(); }
const stamp = () => { const m = WD.nowMins(); return PM.manual ? 'Updated ' + fmt.rel(PM.at).toLowerCase() : 'Updated today at ' + (m >= 13 * 60 ? '1:00 PM' : '6:00 AM') + ' · next at ' + (m >= 13 * 60 ? '6:00 AM' : '1:00 PM'); };
/** Stand-in for Apple Maps address search: known addresses and customer names first, then the typed text placed on the map. */
function suggestions(text) {
  const t = text.trim(); if (t.length < 2) return [];
  const n = hash(t.toLowerCase()), typed = { label: t, sub: 'Use the address exactly as typed', x: 150 + n % 700, y: 150 + Math.floor(n / 700) % 700, typed: true };
  /* The same Apple Maps completions the job editor offers: customers' addresses first, then street addresses that complete what was typed. */
  const found = (WD.addressSuggestions ? WD.addressSuggestions(t) : []).filter(x => !x.typed && x.l && x.l.x != null).slice(0, 8).map(x => ({ label: x.address.replace(/, Lakemont$/, ''), sub: x.sub, x: x.l.x, y: x.l.y }));
  return found.concat(typed);
}
const miles = (s, t) => Math.hypot(s.x - t.x, s.y - t.y) / MILE, milesText = d => fmt.dist(d);
const dateChip = d => h('span' + (d.projected ? '.proj' : ''), fmt.day(d.day, 'weekday') + ' ' + fmt.day(d.day, 'md'));
function planMapEl(page, near) {
  const A = 1.25, t = PM.target, sites = PM.sites; let cx = 500, cy = 500, half = 520;
  if (t) { cx = t.x; cy = t.y; half = Math.max(60, rMi() * MILE * 1.3); }
  const x0 = cx - half, y0 = cy - half / A, w = half * 2, hh = w / A;
  const ring = t ? [{ pts: Array.from({ length: 49 }, (_, i) => ({ x: t.x + Math.cos(i / 48 * Math.PI * 2) * rMi() * MILE, y: t.y + Math.sin(i / 48 * Math.PI * 2) * rMi() * MILE })), color: '#FF3B30', dash: true, width: 2 }] : [];
  const mm = WD.miniMap({ points: [], lines: [{ pts: [{ x: x0, y: y0 }, { x: x0 + w, y: y0 + hh }], color: 'transparent', width: 0.01 }].concat(ring), aspect: A, pad: 0.01, caption: t ? 'Within ' + rText() : rangeLabel() });
  const pos = (x, y) => ({ left: ((x - x0) / w * 100).toFixed(2) + '%', top: ((y - y0) / hh * 100).toFixed(2) + '%' }), inBox = s => s.x > x0 && s.x < x0 + w && s.y > y0 && s.y < y0 + hh, isNear = s => !t || near.includes(s);
  sites.filter(inBox).sort((a, b) => isNear(a) - isNear(b)).forEach(s => mm.appendChild(h('button.pm-pin' + (isNear(s) ? '' : '.faded') + (PM.sel === s.key ? '.sel' : ''), { 'aria-label': s.name + ', ' + plural(s.dates.length, 'service date'), style: { ...pos(s.x, s.y), ...WD.pinStyle({ routeId: s.routeId, type: s.type, customerId: s.customerId }) }, onclick: () => { PM.sel = PM.sel === s.key ? null : s.key; page.refresh(); } }, s.dates.length)));
  if (t) mm.appendChild(h('div.pm-target', { style: pos(t.x, t.y) }));
  return h('div.pm-map', mm);
}
function siteCard(s, page) {
  const c = q.customer(s.customerId), t = PM.target, real = s.dates.filter(d => !d.projected).length;
  return ui.section({ header: 'Selected pin', footer: s.dates.some(d => d.projected) ? 'Outlined dates come from the recurring schedule and are not on the board yet.' : null },
    ui.row({ leading: h('span.mm-p', { style: { position: 'static', transform: 'none', flex: 'none', ...WD.pinStyle({ routeId: s.routeId, type: s.type, customerId: s.customerId }) } }), title: s.name, subtitle: [s.place, s.address.replace(/, Lakemont$/, ''), [q.routeName(s.routeId), s.freq, s.containers].filter(Boolean).join(' · ')].filter(Boolean).map(x => h('div', x)), detail: t ? milesText(miles(s, t)) : null }),
    h('div.row', h('div.row-main', h('div.row-title', plural(s.dates.length, 'service date') + ' in the ' + rangeLabel().toLowerCase()), h('div.row-sub', real + ' on the board' + (s.dates.length > real ? ' · ' + (s.dates.length - real) + ' from the recurring schedule' : '')))),
    h('div.pm-dates', s.dates.map(dateChip)),
    WD.r11 && WD.can('jobs.edit') && ui.row({ icon: 'arrow.left.arrow.right', iconPlain: true, title: 'Change Route', subtitle: 'Routes with jobs close to this one, best first', tint: true, chevron: true, onTap: () => WD.r11.changeRoute(s, PM, () => { loadSites(true); PM.sel = null; page.refresh(); }) }),
    c && WD.can('crm.view') && ui.row({ title: 'Open ' + c.name, tint: true, chevron: true, onTap: () => WD.screens.customers.openDetail(c.id) }),
    ui.row({ title: 'Close', tint: true, onTap: () => { PM.sel = null; page.refresh(); } }));
}
R8.planMapSpec = () => ({ title: () => rangeLabel(), backLabel: 'Map',
  search: { placeholder: 'Type an address to see jobs near it', value: PM.text, onInput: (v, page) => { PM.text = v; if (!v.trim() || (PM.target && PM.target.label !== v)) { PM.target = null; PM.sel = null; } page.refresh(); } },
  trailing: () => [{ icon: 'arrow.clockwise', label: 'Update now', onTap: async page => { if (await ui.run('Updating the map…', () => loadSites(true), { done: 'Up to date', min: 600, max: 1100 })) page.refresh(); } }],
  render: page => { if (!PM.sites) loadSites(false);
    const t = PM.target, sites = PM.sites, near = t ? sites.filter(s => miles(s, t) <= rMi()).sort((a, b) => miles(a, t) - miles(b, t)) : [], sel = sites.find(s => s.key === PM.sel);
    const sugg = !t && PM.text.trim().length >= 2 ? suggestions(PM.text) : [];
    const choose = sg => { PM.target = { label: sg.label, x: sg.x, y: sg.y, typed: sg.typed }; PM.text = sg.label; PM.sel = null; const i = page.navbar.querySelector('.search-box input'); if (i) { i.value = sg.label; i.blur(); i.parentNode.classList.add('filled'); } page.refresh(); page.body.scrollTop = 0; };
    /* Which days already have stops near the address: the answer to “when should we schedule this?” */
    const byDay = new Map(); near.forEach(s => s.dates.forEach(d => { const e = byDay.get(d.day) || byDay.set(d.day, { day: d.day, n: 0, routes: new Set(), closest: 99 }).get(d.day); e.n++; e.routes.add(d.routeId); e.closest = Math.min(e.closest, miles(s, t)); }));
    const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    const siteRow = s => ui.row({ leading: h('span.mm-p', { style: { position: 'static', transform: 'none', flex: 'none', ...WD.pinStyle({ routeId: s.routeId, type: s.type, customerId: s.customerId }) } }, s.dates.length), title: s.name + (s.place ? ' · ' + s.place : ''),
      subtitle: [s.address.replace(/, Lakemont$/, ''), 'Next: ' + s.dates.slice(0, 3).map(d => fmt.day(d.day, 'weekday') + ' ' + fmt.day(d.day, 'md')).join(', ') + (s.dates.length > 3 ? ' +' + (s.dates.length - 3) + ' more' : '')].map(x => h('div', x)), detail: t ? milesText(miles(s, t)) : null, chevron: true, onTap: () => { PM.sel = s.key; page.refresh(); page.body.scrollTop = 0; } });
    return [
      sugg.length > 0 && ui.list(ui.section({ header: 'Addresses', footer: 'Suggestions come from Apple Maps as you type. Tap one to center the map on it.' }, sugg.map(sg => ui.row({ icon: sg.typed ? 'magnifyingglass' : 'mappin', iconPlain: true, iconColor: sg.typed ? 'var(--label2)' : 'var(--red)', title: sg.label, subtitle: sg.sub, onTap: () => choose(sg) })))),
      /* How far ahead to look: tap to choose 1 week, 2 weeks, 4 weeks, 45 days or 90 days. */
      h('div.pm-range', h('button', { 'aria-label': 'Date range: ' + rangeLabel(), onclick: e => ui.menu(e.currentTarget, [{ header: 'Show jobs in the' }].concat(RANGES.map(([n, label]) => ({ label: 'Next ' + label, checked: PM.days === n, onTap: () => { PM.days = n; PM.sel = null; PM.allDays = PM.allSites = false; loadSites(PM.manual); page.refresh(); } }))), { compact: true }) }, icon('calendar', 15), h('span', rangeLabel()), icon('chevron.down', 12)), h('span', 'today to ' + fmt.day(D.add(today(), PM.days), 'md'))),
      h('div.pm-wrap', planMapEl(page, near), h('div.pm-stamp', h('span', plural(sites.length, 'place') + ' · today to ' + fmt.day(D.add(today(), PM.days), 'md')), h('span', stamp()))),
      t && h('div.pm-seg', ui.segmented(RADII.map(r => ({ value: r, label: r + uLabel() })), PM.radius, v => { PM.radius = v; page.refresh(); })),
      ui.list(
        sel && siteCard(sel, page),
        !t && !sel && h('div', { style: 'padding:10px 4px 0' }, ui.note('Type an address above. The map zooms to it and shows every job nearby in the ' + rangeLabel().toLowerCase() + ', so you can pick a day when a truck is already in the area. Tap a pin for the customer and all of its service dates.')),
        t && ui.section({ header: 'Days a truck is nearby · ' + days.length, footer: days.length ? 'Days with a stop within ' + rText() + ' of ' + t.label + '. Tap a day to see it on the board or put a job on it.' : 'Nothing within ' + rText() + '. Try a wider distance.' },
          days.slice(0, PM.allDays ? 60 : 8).map(d => ui.row({ leading: h('span.hstack', { style: { gap: '3px' } }, [...d.routes].map(r => ui.dot(q.routeColor(r)))), title: fmt.day(d.day, 'long'), subtitle: plural(d.n, 'stop') + ' nearby · closest ' + milesText(d.closest) + ' · ' + [...d.routes].map(r => q.routeName(r)).join(', '), chevron: true, onTap: async () => {
            const v = await ui.actionSheet({ title: fmt.day(d.day, 'long'), message: plural(d.n, 'stop') + ' within ' + rText() + ' of ' + t.label + '.', buttons: [WD.can('jobs.edit') && { label: 'New job on this day', value: 'new' }, { label: 'Show this day on the board', value: 'board' }].filter(Boolean) });
            if (v === 'board') WD.screens.board.show(d.day); else if (v === 'new') { S.board.day = d.day; WD.screens.jobs.openEditor({ day: d.day, routeId: [...d.routes][0] }); } } })),
          days.length > 8 && !PM.allDays && ui.row({ title: 'Show all ' + days.length + ' days', tint: true, onTap: () => { PM.allDays = true; page.refresh(); } })),
        t && near.length > 0 && ui.section({ header: 'Jobs near this address · ' + plural(near.length, 'customer') }, near.map(siteRow)),
        !t && ui.section({ header: 'Everything in the ' + rangeLabel().toLowerCase() + ' · ' + plural(sites.length, 'place'), footer: 'The map is refreshed twice a day, at 6 AM and 1 PM. Tap the arrows at the top to update it now.' }, sites.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, PM.allSites ? 500 : 12).map(siteRow),
          sites.length > 12 && !PM.allSites && ui.row({ title: 'Show all ' + sites.length, tint: true, onTap: () => { PM.allSites = true; page.refresh(); } })))];
  } });
R8.openPlanMap = () => { WD.nav.switchTab('map'); WD.nav.push(R8.planMapSpec()); };

/* ================= Control panel ================= */
const openSet = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
WD.panel.addJump('Planning map', () => R8.openPlanMap());
WD.css('.pm-range { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 16px 0; font-size: 12px; color: var(--label2); } .pm-range button { display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 15px; height: 30px; padding: 0 11px; background: var(--cell); color: var(--tint); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }');
WD.panel.addJump('Postponed jobs', () => { WD.nav.switchTab('board'); R8.openPostponed(); });
WD.panel.addJump('Purge pricing', () => openSet(R8.pricingSpec()));
WD.panel.addJump('Export and backup', () => openSet(R8.exportSpec()));
})();
