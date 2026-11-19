/* RouteClerk prototype — round 11, part 2. Adds to WD.r11 and registers WD.screens.office.
   The Admin tab (CRM, Customers and Invoices behind one selector), unpaid-invoice warnings, hiding a customer and card on file,
   route notes for the driver or office, postponed jobs and price approvals in the Tasks pipeline, Change Route on the planning map,
   the driver's own-route default, and the driver's inventory and route note on the Shift tab. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD, X = WD.r11, C = X.cfg;
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You';
const plural = (n, w) => n + ' ' + (n === 1 ? w : /(x|s|ch)$/.test(w) ? w + 'es' : w + 's');

WD.css(`
.of-acc { display: flex; flex-direction: column; gap: 0; }
.r1-rank { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; color: #fff; background: var(--gray); }
.r1-rank.best { background: var(--green); }
`);

/* ================= Unpaid invoices ================= */
/** Invoices that are still owed. Bad debt (written off) and void invoices are never owed, so they are left out of owed / overdue / overLimit and every warning built on them. */
X.unpaidInv = c => c ? (data.invoices || []).filter(i => i.customerId === c.id && i.status !== 'Paid' && i.status !== 'Draft' && !(WD.invClosed && WD.invClosed(i))) : [];
X.owed = c => X.unpaidInv(c).reduce((s, i) => s + i.amount, 0);
/** Unpaid invoices older than the number of days in Settings → Unpaid invoices. */
X.overdue = c => X.unpaidInv(c).filter(i => D.diff(today(), i.day) > C.unpaid.overdueDays);
X.overLimit = c => !!c && X.unpaidInv(c).length > C.unpaid.limit;
const debtors = () => data.customers.map(c => ({ c, inv: X.unpaidInv(c) })).filter(x => x.inv.length).map(x => ({ ...x, owed: x.inv.reduce((s, i) => s + i.amount, 0), late: X.overdue(x.c), oldest: x.inv.reduce((m, i) => Math.max(m, D.diff(today(), i.day)), 0) })).sort((a, b) => b.owed - a.owed);
/* A few more unpaid invoices, so some customers are over the limit and some are overdue. */
(function seed() { let n = 0; const add = (cid, ago, amount) => { const c = q.customer(cid); if (!c || !data.invoices) return; const day = D.add(today(), -ago); data.invoices.push({ id: 'invu' + (++n), number: 'INV-' + (2250 + n), customerId: cid, jobId: null, day, amount, status: ago > 30 ? 'Overdue' : 'Sent', auto: false, payments: [], at: +D.parse(day) }); c.stats.balance += amount; c.stats.paid = Math.max(0, c.stats.paid - amount); };
  /* The generated history leaves many recent invoices unpaid; settle the older ones so only a few customers stand out. */
  let pn = 0; (data.invoices || []).forEach(i => { if (i.status !== 'Sent' || D.diff(today(), i.day) < 3) return; i.status = 'Paid'; const j = i.jobId && q.job(i.jobId); if (j && j.invoice) j.invoice.status = 'Paid'; const pay = { id: 'payu' + (++pn), invoiceId: i.id, customerId: i.customerId, at: Math.min(+WD.now() - 36e5, i.at + 2 * 864e5), amount: i.amount, method: 'Check' }; (data.payments || []).push(pay); i.payments.push(pay.id); });
  [['c3', 12, 150], ['c3', 41, 150], ['c3', 69, 150], ['c14', 9, 60], ['c14', 37, 60], ['c14', 52, 60], ['c7', 20, 90], ['c18', 48, 30]].forEach(a => add(...a)); })();
X.unpaidSpec = () => ({ title: 'Unpaid invoices', render: page => { const list = debtors(), total = list.reduce((s, x) => s + x.owed, 0), over = list.filter(x => X.overLimit(x.c)).length;
  return ui.list(
    ui.section({ fold: false, footer: 'Unpaid is every invoice sent and not yet paid. Overdue is unpaid for more than ' + C.unpaid.overdueDays + ' days. A customer with more than ' + plural(C.unpaid.limit, 'unpaid invoice') + ' is flagged on the Dispatch tab.' },
      h('div.cu-stats', h('div.cu-stat', h('b', fmt.money(total)), h('span', 'Owed in all')), h('div.cu-stat', h('b', String(list.length)), h('span', list.length === 1 ? 'Customer' : 'Customers')), h('div.cu-stat', h('b', { style: { color: over ? 'var(--red)' : null } }, String(over)), h('span', 'Over the limit')))),
    list.length ? ui.section({ header: 'Customers who owe · ' + list.length, fold: false, footer: 'Most owed first. Tap a customer for their unpaid invoices, to send a reminder or record a payment.' },
      list.map(x => ui.row({ class: 'cu-crow', leading: ui.avatar(x.c.name, { size: 36, icon: x.c.kind === 'household' ? 'house' : null }), title: x.c.name,
        subtitle: [h('div', plural(x.inv.length, 'unpaid invoice') + ' · oldest ' + plural(x.oldest, 'day')), h('div', x.inv.slice().sort((a, b) => a.day.localeCompare(b.day)).map(i => i.number + ' ' + fmt.money(i.amount)).slice(0, 3).join(' · ') + (x.inv.length > 3 ? ' +' + (x.inv.length - 3) : '')),
          (X.overLimit(x.c) || x.late.length > 0) && h('div.r1-chips', X.overLimit(x.c) && h('span.bad', 'Over the limit'), x.late.length > 0 && h('span.warn', x.late.length + ' overdue · ' + fmt.money(x.late.reduce((s, i) => s + i.amount, 0))))],
        detail: h('b', { style: 'color:var(--label)' }, fmt.money(x.owed)), chevron: true, onTap: () => page.push(WD.screens.customers.custInvoices(x.c.id, true)) })))
      : ui.empty({ icon: 'checkmark.circle', title: 'Nobody owes anything', text: 'Every invoice is paid.' }),
    WD.can('settings.manage') && ui.section(null, ui.row({ icon: 'gearshape', iconPlain: true, title: 'When to warn', subtitle: 'More than ' + plural(C.unpaid.limit, 'unpaid invoice') + ' · overdue after ' + C.unpaid.overdueDays + ' days', tint: true, chevron: true, onTap: () => page.push(X.unpaidSettingsSpec()) })));
} });
/** The row at the top of the Customers list. */
X.unpaidSection = () => { const list = debtors(); if (!list.length) return null; const late = list.filter(x => x.late.length).length;
  return ui.section({ fold: false }, ui.row({ icon: 'dollarsign.circle', iconColor: 'var(--blue)', title: 'Unpaid invoices', subtitle: plural(list.length, 'customer') + ' owe ' + fmt.money(list.reduce((s, x) => s + x.owed, 0)) + (late ? ' · ' + late + ' overdue' : ''), chevron: true, onTap: () => WD.nav.push(X.unpaidSpec()) })); };
const openUnpaid = () => { if (WD.can('crm.view')) { WD.nav.switchTab('customers'); setTimeout(() => WD.nav.push(X.unpaidSpec()), 80); } else WD.nav.push(X.unpaidSpec()); };

/* ================= Warning lines on the Dispatch tab ================= */
X.boardStrips = inView => { const seen = j => !inView || inView(j), out = [], strip = (color, ic, text, fn) => out.push(h('div.bd-strip', { style: { '--c': color }, onclick: fn }, icon(ic, 16), text, h('span.spacer'), 'Review', icon('chevron.right', 13)));
  if (WD.can('billing.view') || WD.can('jobs.edit')) { const n = data.customers.filter(c => X.overLimit(c) && (!inView || data.jobs.some(j => j.customerId === c.id && !WD.closed[j.status] && inView(j)))).length; if (n) strip('var(--red)', 'dollarsign.circle', n + (n === 1 ? ' customer here has' : ' customers here have') + ' more than ' + plural(C.unpaid.limit, 'unpaid invoice'), WD.can('billing.view') ? openUnpaid : () => ui.toast('Ask the office: billing access is needed to see invoices', 'lock', 2800)); }
  if (WD.can('jobs.edit')) { const n = X.flagged().filter(x => seen(x.job)).length; if (n) strip('var(--orange)', 'person.2', n + (n === 1 ? ' job here needs' : ' jobs here need') + ' a qualified driver or truck', () => WD.nav.push(X.issuesSpec()));
  }
  return out; };

/* ================= Notes for the driver or office, at the top of a route's day ================= */
X.noteFor = (rid, day) => data.routeNotes[rid + '|' + day] || null;
X.editNote = (rid, day) => { const key = rid + '|' + day, cur = data.routeNotes[key], f = { text: cur ? cur.text : '', to: cur ? cur.to : 'driver' };
  ui.sheet({ title: 'Note · ' + q.routeName(rid), leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.text.trim()) return ui.toast('Write the note first', 'note'); data.routeNotes[key] = { text: f.text.trim(), to: f.to, by: me(), at: +WD.now() }; WD.changed(); p.dismiss(); ui.toast('Note is at the top of ' + q.routeName(rid), 'note', 2200); } }],
    render: p => ui.list(ui.section({ header: fmt.day(day, 'long'), fold: false, footer: 'Shows in a bright bar at the top of this route for that day, on the board and on the driver’s Shift tab, so it can’t be missed.' },
        ui.inputRow({ multiline: true, placeholder: 'e.g. Gate code changed to 4471. Call the office before the last stop.', value: f.text, autofocus: true, onInput: v => { f.text = v; } })),
      ui.section({ header: 'Who is it for', fold: false }, h('div.row', h('div', { style: 'flex:1' }, ui.segmented([{ value: 'driver', label: 'Driver' }, { value: 'office', label: 'Dispatch office' }, { value: 'both', label: 'Both' }], f.to, v => { f.to = v; })))),
      cur && ui.section({ footer: 'Written by ' + cur.by + ' · ' + fmt.rel(cur.at) }, ui.row({ title: 'Delete the note', destructive: true, onTap: () => { delete data.routeNotes[key]; WD.changed(); p.dismiss(); } }))) }, { detent: 'medium' }); };
X.pickNoteRoute = async (ids, day) => { if (!ids.length) return; const rid = ids.length === 1 ? ids[0] : await ui.actionSheet({ title: 'Note for which route?', message: fmt.day(day, 'long'), buttons: ids.map(id => ({ label: q.routeName(id) + (X.noteFor(id, day) ? ' · has a note' : ''), value: id })) }); if (rid) X.editNote(rid, day); };

/* ================= Tasks pipeline: postponed jobs and price changes to approve ================= */
X.postponedRows = () => (WD.r8 ? WD.r8.postponed() : []).map(j => { const p = WD.r8.postponedAt(j), c = q.customer(j.customerId), wait = Math.max(0, Math.floor((+WD.now() - p.at) / 864e5)), edit = WD.can('jobs.edit'), J = WD.screens.jobs;
  return ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: [h('div', 'Was ' + fmt.day(j.day) + ' · ' + q.routeName(j.routeId)), h('div', 'Postponed ' + (wait ? plural(wait, 'day') + ' ago' : 'today') + (p.text && / — /.test(p.text) ? ' · ' + p.text.split(' — ').slice(1).join(' — ') : ''))],
    badge: wait >= 14 ? ui.badge(wait + ' days', 'var(--red)') : null, chevron: true, onTap: async () => {
      const v = await ui.actionSheet({ title: j.title, message: 'Postponed from ' + fmt.day(j.day, 'long') + '.', buttons: [edit && { label: 'Set a new date…', value: 'date' }, edit && { label: 'Assign to another route…', value: 'route' }, edit && { label: 'Edit the job', value: 'edit' }, { label: 'Open the job', value: 'job' }, c && WD.can('crm.view') && { label: 'Open ' + c.name, value: 'cust' }, edit && { label: 'Cancel the visit', value: 'cancel', role: 'destructive' }].filter(Boolean) });
      if (v === 'date') WD.r8.setNewDate(j, null); else if (v === 'route') J.openReassign(j); else if (v === 'edit') J.openEditor({ jobId: j.id }); else if (v === 'job') J.openDetails(j.id); else if (v === 'cust') WD.screens.customers.openDetail(c.id);
      else if (v === 'cancel') { api.op({ kind: 'status', title: j.title, scope: 'Customer canceled', jobIds: [j.id], apply() { j.status = 'canceled'; j.events.push({ at: +WD.now(), actor: me(), text: 'Postponed visit canceled' }); } }); ui.toast('Marked canceled', 'checkmark'); } } }); });
/** A driver's standing price change waiting for an owner or admin. */
X.requestPrice = (c, job, changes) => { C.approvals.requests.push({ id: 'pr' + Date.now().toString(36), customerId: c.id, jobId: job.id, day: job.day, by: me(), at: +WD.now(), changes, status: 'pending' }); WD.changed(); };
function decide(r, ok) { const c = q.customer(r.customerId); r.status = ok ? 'approved' : 'declined'; r.decidedBy = me();
  if (ok && c) { const l = c.locations[0]; r.changes.forEach(ch => { const it = (l.items || []).find(i => i.id === ch.id); if (it) it.rate = ch.to; (c.changes = c.changes || []).push({ at: +WD.now(), by: r.by + ' (approved by ' + me() + ')', kind: 'price', item: ch.name, from: ch.from, to: ch.to, effective: r.day, letter: false }); });
    data.jobs.forEach(j => { if (j.customerId === c.id && j.status === 'scheduled' && j.day > r.day) (j.items || []).forEach(i => { const ch = r.changes.find(x => x.id === i.id); if (ch) i.rate = ch.to; }); }); }
  WD.changed(); ui.toast(ok ? 'Approved · future visits use the new price' : 'Declined · future visits keep the old price', ok ? 'checkmark' : 'xmark', 2600); }
X.approvalRows = () => C.approvals.requests.filter(r => r.status === 'pending').map(r => { const c = q.customer(r.customerId), can = ['owner', 'admin'].includes((S.me || {}).role);
  return ui.row({ icon: 'dollarsign.circle', iconColor: 'var(--orange)', title: c ? c.name : 'Customer', subtitle: [r.changes.map(ch => h('div', ch.name + ': ' + fmt.money(ch.from, true) + ' → ' + fmt.money(ch.to, true))), h('div', r.by + ' · ' + fmt.rel(r.at) + ' · this and all future visits')], chevron: can, onTap: can ? async () => {
    const v = await ui.actionSheet({ title: 'Price change for ' + (c ? c.name : 'this customer'), message: r.changes.map(ch => ch.name + ': ' + fmt.money(ch.from, true) + ' → ' + fmt.money(ch.to, true)).join('\n') + '\nRequested by ' + r.by + '.', buttons: [{ label: 'Approve for all future visits', value: 'ok' }, { label: 'Decline', value: 'no', role: 'destructive' }] }); if (v) decide(r, v === 'ok'); } : () => ui.toast('An owner or admin approves price changes', 'lock') }); });
(function seed() { const c = q.customer('c1'), it = c && c.locations[0].items[0]; if (it) C.approvals.requests.push({ id: 'pr0', customerId: 'c1', jobId: null, day: today(), by: 'Marcus Bell', at: +WD.now() - 26 * 36e5, status: 'pending', changes: [{ id: it.id, name: (data.priceBook.find(x => x.id === it.id) || {}).name || it.id, from: it.rate, to: it.rate + 2 }] }); })();

/* ================= Customers: card on file, requirements, hide ================= */
function custSections(c, edit) { const needs = c.needs || [], sk = id => C.skills.list.find(s => s.id === id);
  return [ui.section({ header: 'Billing and visits', fold: false, footer: c.hidden ? 'Hidden: left out of the customer list and search. Find it again with the filter menu → Hidden.' : null },
    c.custType === 'business' && ui.toggleRow({ icon: 'creditcard', iconColor: 'var(--blue)', title: 'Credit card on file', subtitle: 'Charged when each stop is completed', value: !!c.cardOnFile, disabled: !edit, onChange: v => { c.cardOnFile = v; WD.changed(); } }),
    C.skills.on && ui.row({ icon: 'shield', iconColor: 'var(--indigo)', title: 'Required for every visit', subtitle: needs.length ? needs.map(n => (sk(n.id) || { name: n.id }).name + (n.covers ? ' · ' + n.covers : '')).join(', ') : 'Nothing special', chevron: edit, onTap: edit ? async () => {
      const id = await ui.actionSheet({ title: 'Required to service ' + c.name, message: 'Whoever is sent must hold this, for example a prison’s background clearance.', buttons: C.skills.list.map(s => ({ label: (needs.some(n => n.id === s.id) ? '✓ ' : '') + s.name, value: s.id })).concat(needs.length ? [{ label: 'Clear all', value: '-', role: 'destructive' }] : []) }); if (!id) return;
      if (id === '-') c.needs = []; else if (needs.some(n => n.id === id)) c.needs = needs.filter(n => n.id !== id); else { const s = sk(id), n = { id }; if (s.scoped) { const r = await ui.alert({ title: 'Which institution?', message: 'A clearance limited to one site must match this name. Leave it empty if any clearance will do.', input: { placeholder: c.name, value: c.name }, buttons: [{ label: 'Skip', value: null }, { label: 'Save', value: true, bold: true }] }); if (r && r.value && r.text.trim()) n.covers = r.text.trim(); } c.needs = needs.concat(n); }
      WD.changed(); } : null }),
    edit && ui.row({ icon: 'eye.slash', iconColor: 'var(--gray)', title: c.hidden ? 'Show this customer again' : 'Hide this customer', subtitle: c.hidden ? null : 'Out of the list and search; nothing is deleted', onTap: async () => {
      if (c.hidden) { c.hidden = false; WD.changed(); return ui.toast(c.name + ' is back in the list', 'checkmark'); }
      const open = q.jobsForCustomer(c.id).filter(j => j.day >= today() && j.status === 'scheduled').length;
      if (await ui.actionSheet({ title: 'Hide ' + c.name + '?', message: 'It leaves the customer list and search. ' + (open ? plural(open, 'scheduled job') + ' stay on the board. ' : '') + 'To see hidden customers, open the filter menu and choose Hidden.', buttons: [{ label: 'Hide customer', value: true }] })) { c.hidden = true; WD.changed(); ui.toast('Hidden · filter menu → Hidden to find it', 'eye.slash', 2800); WD.nav.pop(); } } }))]; }
if (WD.biz) { const base = WD.biz.customerSections; WD.biz.customerSections = (c, edit) => [base(c, edit), custSections(c, edit)]; }

/* ================= Change Route (planning map) ================= */
const MILE = 25, NEAR = 10;
X.changeRoute = (s, PM, done) => {
  const sites = PM.sites, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) / MILE, c = s.customerId && q.customer(s.customerId), recurring = !!c && c.freq && c.freq !== 'One time';
  /* Rank the other routes by the jobs they already have close to this one: nearest first, then how many. */
  const cands = q.routes().filter(r => r.writable && r.id !== s.routeId).map(r => { const rs = sites.filter(o => o !== s && o.dates.some(d => d.routeId === r.id)), near = rs.filter(o => dist(o, s) <= NEAR), closest = rs.length ? Math.min(...rs.map(o => dist(o, s))) : Infinity;
    const days = [...new Set(near.flatMap(o => o.dates.filter(d => d.routeId === r.id).map(d => d.day)))].sort();
    return { r, n: near.length, closest, days }; }).sort((a, b) => (b.n > 0) - (a.n > 0) || a.closest - b.closest || b.n - a.n);
  /* The day a visit lands on: the nearest day (within 3 days) the destination route already has jobs close by, else the same day. */
  const landing = (cand, day) => { if (cand.days.includes(day)) return day; let best = day, gap = 4; cand.days.forEach(k => { const g = Math.abs(D.diff(k, day)); if (g < gap && k >= today()) { gap = g; best = k; } }); return best; };
  const shiftText = n => n === 0 ? 'same day' : plural(Math.abs(n), 'day') + (n > 0 ? ' later' : ' earlier');
  const st = { cand: null, scope: recurring ? 'series' : 'days', picked: new Set(s.dates.map(d => d.day)) };
  const chosen = () => s.dates.filter(d => st.scope === 'series' || st.picked.has(d.day));
  async function apply(page) {
    const cand = st.cand, moves = chosen().map(d => ({ d, to: landing(cand, d.day), job: d.jobId && q.job(d.jobId) })); if (!moves.length) return ui.toast('Choose at least one day', 'calendar');
    const real = moves.filter(m => m.job && m.job.status === 'scheduled' && !m.job.pending), shifts = moves.map(m => D.diff(m.to, m.d.day)), big = shifts.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
    if (!(await X.checkAssign(real.map(m => m.job), cand.r.id))) return;
    const lines = h('div', moves.slice(0, 6).map(m => h('div', fmt.day(m.d.day) + (m.to !== m.d.day ? ' → ' + fmt.day(m.to) + ' (' + shiftText(D.diff(m.to, m.d.day)) + ')' : ' · same day'))), moves.length > 6 ? h('div', 'and ' + (moves.length - 6) + ' more') : null,
      h('div', { style: 'margin-top:6px' }, (st.scope === 'series' ? 'The whole series moves to ' : plural(moves.length, 'visit') + (moves.length === 1 ? ' moves to ' : ' move to ')) + q.routeName(cand.r) + '.'));
    const ok = await ui.actionSheet({ title: big ? 'You are moving this ' + (moves.length > 1 ? 'route' : 'visit') + ' ' + shiftText(big).replace(/^(\d+ days?) /, '$1 ') + ' than it was originally scheduled for. Are you sure?' : 'Move ' + s.name + ' to ' + q.routeName(cand.r) + '?', message: lines, buttons: [{ label: big ? 'Yes, move it' : 'Move to ' + q.routeName(cand.r), value: true }] }); if (!ok) return;
    const who = me(), from = s.routeId;
    if (real.length) api.op({ kind: 'batch', title: s.name + ' → ' + q.routeName(cand.r), scope: plural(real.length, 'visit') + (st.scope === 'series' ? ' · entire series' : ''), jobIds: real.map(m => m.job.id), apply() { real.forEach(m => { const j = m.job, was = j.day; WD.placeJob(j, cand.r.id, m.to, Infinity); if (m.to !== was) j.movedFrom = was; j.offWindow = null;
      j.events.push({ at: +WD.now(), actor: who, text: 'Route changed from ' + q.routeName(from) + ' to ' + q.routeName(cand.r) + (m.to !== was ? ' · moved from ' + fmt.day(was) + ' to ' + fmt.day(m.to) : '') }); }); } });
    if (st.scope === 'series' && c) { c.route = cand.r.id; data.jobs.forEach(j => { if (j.customerId === c.id && j.status === 'scheduled' && !j.pending && j.day >= today() && j.routeId === from && !real.some(m => m.job === j)) WD.placeJob(j, cand.r.id, j.day, Infinity); }); }
    WD.changed(); page.dismiss(); ui.toast(s.name + ' is on ' + q.routeName(cand.r) + ' · run AutoRoute there', 'checkmark', 2800); done && done();
  }
  const scopeSpec = () => ({ title: q.routeName(st.cand.r), render: page => { const cand = st.cand, list = chosen();
    return ui.list(
      ui.section({ header: 'What to move', fold: false, footer: st.scope === 'series' ? 'Every visit in the series goes to ' + q.routeName(cand.r) + ', including visits past the dates on this map.' : 'Only the days you switch on move. The rest stay on ' + q.routeName(s.routeId) + '.' },
        recurring && h('div.row', h('div', { style: 'flex:1' }, ui.segmented([{ value: 'series', label: 'Entire series' }, { value: 'days', label: 'Selected days' }], st.scope, v => { st.scope = v; page.refresh(); })))),
      st.scope === 'days' && ui.section({ header: 'Days in the ' + (PM.days <= 28 ? 'next ' + (PM.days / 7) + (PM.days === 7 ? ' week' : ' weeks') : 'next ' + PM.days + ' days') + ' · ' + s.dates.length, fold: false, footer: 'Outlined dates come from the recurring schedule and are not on the board yet.' },
        s.dates.map(d => { const to = landing(cand, d.day), n = D.diff(to, d.day); return ui.toggleRow({ title: fmt.day(d.day, 'long'), subtitle: (d.projected ? 'From the schedule · ' : '') + (n ? 'lands on ' + fmt.day(to) + ' · ' + shiftText(n) : 'stays on this day'), value: st.picked.has(d.day), onChange: v => { v ? st.picked.add(d.day) : st.picked.delete(d.day); page.refresh(); } }); })),
      st.scope === 'series' && ui.section({ header: 'Visits on this map · ' + s.dates.length, fold: true, folded: s.dates.length > 4 }, s.dates.map(d => { const to = landing(cand, d.day), n = D.diff(to, d.day); return ui.row({ title: fmt.day(d.day, 'long'), subtitle: n ? 'lands on ' + fmt.day(to) + ' · ' + shiftText(n) : 'stays on this day' }); })),
      h('div', { style: 'padding:18px 16px 0' }, ui.button('Move ' + (st.scope === 'series' ? 'the series' : plural(list.length, 'visit')) + ' to ' + q.routeName(cand.r), { kind: 'filled', disabled: !list.length, onTap: () => apply(page) })));
  } });
  ui.sheet({ title: 'Change Route', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    render: page => ui.list(
      ui.section({ fold: false }, ui.row({ leading: ui.dot(q.routeColor(s.routeId)), title: s.name, subtitle: 'Now on ' + q.routeName(s.routeId) + ' · ' + plural(s.dates.length, 'visit') + ' on this map' })),
      ui.section({ header: 'Suggested routes, best first', fold: false, footer: 'Ranked by the jobs each route already has close to this one (within ' + fmt.dist(NEAR) + '): the nearest first, then how many. Moving to a route that is in the area on a different day moves the visit to that day; you are told how far before anything changes.' },
        cands.map((x, i) => ui.row({ leading: h('span.r1-rank' + (i === 0 && x.n ? '.best' : ''), i + 1), title: h('span.hstack', { style: 'gap:6px' }, ui.dot(q.routeColor(x.r)), q.routeName(x.r), i === 0 && x.n ? ui.badge('Best', 'var(--green)') : null),
          subtitle: x.n ? plural(x.n, 'job') + ' within ' + fmt.dist(NEAR) + ' · closest ' + fmt.dist(x.closest) + (x.days.length ? ' · in the area ' + [...new Set(x.days.map(k => fmt.day(k, 'weekday')))].slice(0, 4).join(', ') : '') : x.closest < Infinity ? 'Nothing within ' + fmt.dist(NEAR) + ' · closest job ' + fmt.dist(x.closest) : 'No jobs on this map', chevron: true, onTap: () => { st.cand = x; page.push(scopeSpec()); } })),
        !cands.length && ui.row({ title: 'No other routes' }))) }, { detent: 'large' });
};

/* ================= The Admin tab: CRM, Customers and Invoices behind one selector ================= */
const AD = { page: null };
function officeRoot() {
  const subs = {}, get = id => subs[id] || (subs[id] = WD.screens[id] && WD.screens[id].root ? WD.screens[id].root() : { render: () => ui.empty({ icon: 'lock', title: 'Not available' }) });
  const seg = () => { const segs = WD.app.officeSegs(); if (!segs.includes(WD.app.officeSeg)) WD.app.officeSeg = segs[0]; return WD.app.officeSeg; };
  const tidy = page => { const nb = page.navbar, box = nb.querySelector('.nav-search'), acc = nb.querySelector('.nav-accessory'), sub = get(seg()); if (acc && box && acc.nextSibling !== box) nb.insertBefore(acc, box);
    if (!box) return; box.style.display = sub.search ? '' : 'none'; const inp = box.querySelector('input'); if (inp && sub.search) inp.placeholder = sub.search.placeholder || 'Search'; };
  const setSeg = (v, page) => { const old = get(seg()), box = page.navbar.querySelector('.nav-search'), inp = box && box.querySelector('input');
    if (inp && inp.value) { inp.value = ''; const sb = box.querySelector('.search-box'); if (sb) sb.classList.remove('filled'); old.search && old.search.onInput && old.search.onInput('', page); }
    WD.app.officeSeg = v; page.refresh(); page.body.scrollTop = 0; };
  return { title: () => { const segs = WD.app.officeSegs(); return segs.length === 1 ? WD.app.officeNames[segs[0]][0] : 'Admin'; },
    search: { placeholder: 'Search', onInput: (v, page) => { const sub = get(seg()); sub.search && sub.search.onInput && sub.search.onInput(v, page); } },
    accessory: page => { const segs = WD.app.officeSegs(); return segs.length > 1 ? ui.segmented(segs.map(id => ({ value: id, label: WD.app.officeNames[id][0] })), seg(), v => setSeg(v, page)) : null; },
    leading: page => { const sub = get(seg()), t = typeof sub.leading === 'function' ? sub.leading(page) : sub.leading; return t || []; },   /* e.g. the Customers gear (customer settings) */
    trailing: page => { const sub = get(seg()), t = typeof sub.trailing === 'function' ? sub.trailing(page) : sub.trailing; return t || []; },
    render: page => { AD.page = page; const sub = get(seg()); tidy(page); if (sub.onAppear && !sub.appeared) { sub.appeared = true; sub.onAppear(page); } return sub.render(page); } };
}
WD.screens.office = { root: officeRoot };
WD.on('officeSeg', () => setTimeout(() => { if (AD.page && AD.page.el.isConnected) { AD.page.refresh(); AD.page.body.scrollTop = 0; } }, 0));

/* ================= A driver starts on their own route ================= */
/* The board opens on the driver's route alone (one day), and the map hides the other routes (map.js). Routes, the route menu and the map's
   chips still show the others whenever the driver wants them. */
let wasDriver = false;
function driverView() { const mine = S.me && S.me.role === 'driver' && data.routes.find(r => r.driverId === S.me.id);
  if (mine) { S.board.mode = 'days'; S.board.routeId = mine.id; S.board.dayCount = 1; } else if (wasDriver) { S.board.mode = 'routes'; S.board.dayCount = 3; }
  wasDriver = !!mine; WD.changed(); }
WD.on('role', driverView);

/* ================= Shift tab: the route's note, and the truck's inventory ================= */
if (WD.screens.shift && WD.screens.shift.root) { const root = WD.screens.shift.root;
  WD.screens.shift.root = () => { const spec = root(), render = spec.render;
    spec.render = page => { const r = (S.shift && S.shift.routeId && q.route(S.shift.routeId)) || q.routes().find(x => x.driverId === (S.me && S.me.id)) || null, n = r && X.noteFor(r.id, today()), v = r && q.vehicle((S.shift && S.shift.vehicleId) || r.vehicleId);
      return [n && n.to !== 'office' && h('div.r1-banner', h('small', 'Note for today · ' + q.routeName(r) + ' · from ' + n.by.split(' ')[0]), n.text)].concat(render(page),
        C.inventory.on && v ? ui.list(ui.section({ header: 'Truck inventory', fold: false }, ui.row({ icon: 'shippingbox', iconColor: 'var(--teal)', title: v.name, subtitle: C.inventory.items.map(i => (((C.inventory.stock[v.id] || {})[i.id]) || 0) + ' ' + i.name.toLowerCase()).slice(0, 3).join(' · '), detail: 'Count or load', chevron: true, onTap: () => page.push(X.stockSpec({ id: v.id, name: v.name, icon: 'truck' })) }))) : []); };
    return spec; }; }

WD.panel.addJump('Admin: CRM', () => WD.nav.switchTab('crm'));
WD.panel.addJump('Admin: Customers', () => WD.nav.switchTab('customers'));
WD.panel.addJump('Admin: Invoices', () => WD.nav.switchTab('invoices'));
WD.panel.addJump('Unpaid invoices', () => openUnpaid());
WD.panel.addJump('Flagged assignments', () => { WD.nav.switchTab('board'); WD.nav.push(X.issuesSpec()); });
})();
