/* Job details, job editor with customer matching, reassign, search and AutoRoute. */
(function () {
'use strict';
const { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const { SCOPES, seriesJobs } = WD.boardHelpers;
const guard = (mod, fn, ...args) => WD.screens[mod] && WD.screens[mod][fn] && WD.screens[mod][fn](...args);

WD.css(`
.jb-head { padding: 14px 16px 13px; }
.jb-head .title2 { display: flex; gap: 8px; align-items: baseline; }
.jb-q { color: var(--red); font-weight: 800; }
.jb-badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
.jb-line { display: flex; gap: 8px; align-items: center; font-size: 15px; line-height: 20px; letter-spacing: -.24px; margin-top: 7px; }
.jb-line .ic { color: var(--label2); }
.jb-steps { display: flex; gap: 8px; padding: 12px; }
.jb-steps .btn { flex: 1; min-height: 44px; border-radius: 11px; font-size: 16px; padding: 0 8px; }
.jb-done { padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 15px; letter-spacing: -.24px; }
.jb-done .spacer { flex: 1; }
.jb-done button { border: 0; background: none; color: var(--tint); font-size: 15px; cursor: pointer; padding: 0; }
.jb-notes { padding: 11px 16px; font-size: 16px; line-height: 21px; white-space: pre-wrap; user-select: text; -webkit-user-select: text; }
.jb-match { margin-top: 8px; }
.jb-match .section-header { padding-top: 8px; }
.jb-num { width: 26px; height: 26px; border-radius: 50%; background: var(--c); color: #fff; font-size: 13px; font-weight: 700; display: grid; place-items: center; flex: none; letter-spacing: 0; }
.jb-plan { padding: 14px 16px; }
.jb-plan .big { font-size: 28px; font-weight: 700; letter-spacing: .3px; line-height: 34px; }
.jb-plan .save { color: var(--green); font-weight: 600; }
.jb-stage { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 16px; }
.jb-stage.wait { color: var(--label3); }
.jb-seg { padding: 0 16px 10px; }
.jb-qty { font-weight: 400; color: var(--label2); font-size: 13px; margin-left: 6px; white-space: nowrap; }
.jb-win { font-size: 12.5px; margin-top: 2px; display: flex; gap: 4px; align-items: center; }
.jb-win.ok { color: var(--green); } .jb-win.soft { color: var(--orange); } .jb-win.bad { color: var(--red); font-weight: 600; }
.jb-grip { flex: none; width: 34px; height: 34px; margin-right: -8px; display: grid; place-items: center; color: var(--label3); cursor: grab; touch-action: none; }
.jb-ar.jb-dragging { opacity: .35; }
.jb-ins { position: absolute; left: 12px; right: 12px; height: 3px; border-radius: 2px; background: var(--tint); z-index: 5; pointer-events: none; }
.jb-pin { font-size: 11px; font-weight: 700; color: var(--tint); margin-left: 6px; }
.jb-maps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px 12px 12px; }
.jb-maps .cap { font-size: 12px; color: var(--label2); text-align: center; margin-top: 4px; letter-spacing: 0; }
.jb-depart { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--tint); }
.jb-est { background: color-mix(in srgb, var(--yellow) 12%, var(--cell)); }
.jb-ends { display: flex; gap: 8px; align-items: center; padding: 0 16px 12px; font-size: 13px; color: var(--label2); flex-wrap: wrap; }
.jb-ends button { border: 0; background: var(--fill3); color: var(--tint); border-radius: 14px; padding: 4px 10px; font-size: 13px; cursor: pointer; }
.row.jb-item { gap: 10px; }
.jb-item .row-main { flex: 1; }
.jb-rate { width: 78px; border: 0; background: var(--fill3); border-radius: 7px; padding: 6px 8px; font-size: 15px; text-align: right; color: var(--label); outline: 0; font-variant-numeric: tabular-nums; }
.jb-count { width: 54px; border: 0; background: var(--fill3); border-radius: 7px; padding: 6px 8px; font-size: 15px; text-align: right; color: var(--label); outline: 0; }
.jb-qn { min-width: 22px; text-align: right; font-variant-numeric: tabular-nums; font-size: 16px; }
.jb-rec .row-detail { color: var(--tint); }
.jb-day { border: 0; width: 30px; height: 28px; border-radius: 7px; background: var(--fill3); color: var(--label); font-size: 13px; cursor: pointer; padding: 0; }
.jb-day.on { background: var(--red); color: #fff; font-weight: 600; }
.jb-steps .btn { min-width: 0; }
`);
WD.addIcons({ 'line.3': '<path d="M5 8h14M5 12h14M5 16h14"/>' });

/* Card-on-file jobs are billed automatically once the stop is completed (MIGRATION.md §12). */
const baseSetStatus = api.setStatus;
api.setStatus = (jobId, status, note) => {
  const op = baseSetStatus(jobId, status, note), job = q.job(jobId);
  if (status === 'completed' && job && job.type === 'creditCard' && !job.invoice) setTimeout(() => {
    if (job.status !== 'completed' || job.invoice || S.offline) return;
    const c = q.customer(job.customerId), amount = c && c.stats ? c.stats.rate : 65;
    job.invoice = { number: 'INV-' + (2500 + Math.floor(Math.random() * 400)), status: 'Paid', amount, auto: true };
    job.events.push({ at: +WD.now(), actor: 'Billing', text: 'Card on file charged ' + fmt.money(amount) + ' · ' + job.invoice.number });
    WD.changed(); if (WD.can('billing.view')) ui.toast('Card on file charged · ' + fmt.money(amount), 'creditcard', 2600);
  }, 2800);
  return op;
};

/* ================= Job details ================= */
function openDetails(jobId) {
  ui.sheet({ title: 'Job details', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
    render(p) { const job = q.job(jobId); if (!job) { setTimeout(() => p.dismiss(), 0); return null; } return details(job, p); } });
}
function details(job, p) {
  const route = q.route(job.routeId), type = q.jobType(job.type), st = WD.jobStatuses[job.status], canEdit = WD.can('jobs.edit') && route && route.writable;
  const driver = q.driverFor(job.routeId), vehicle = route && q.vehicle(route.vehicleId), cust = q.customer(job.customerId), unresolved = !job.located && job.address && job.type !== 'meet';
  const line = (ic, ...kids) => h('div.jb-line', icon(ic, 18), h('span', kids)), wf = WD.workflow;
  const head = h('div.jb-head',
    h('div.title2', unresolved && h('span.jb-q', '?'), h('span', { style: WD.struck[job.status] ? { textDecoration: 'line-through' } : null }, job.title)),
    h('div.jb-badges', ui.badge(st.title, st.color), type.color && ui.badge(type.title, type.color), job.pending && ui.badge('Pending sync', 'var(--orange)'), job.status === 'completed' && !wf.billed(job) && ui.badge('Not billed', 'var(--orange)')),
    (d => d.length ? h('div.wf-chips', d.map(x => h('span.wf-chip', x))) : null)(wf.titleDetails(job)),
    h('div.jb-line', ui.dot(q.routeColor(route)), h('span', q.routeName(route) + (driver ? ' · ' + driver.name : '') + (vehicle ? ' · ' + vehicle.name : ''))),
    line('calendar', fmt.day(job.day, 'long')),
    line('list.bullet', job.allDay ? 'Note for the day (not a stop)' : (p => 'Stop ' + p.n + ' of ' + p.of + ' on the list')(q.position(job))),
    job.recurring && line('repeat', job.recurring.rule));

  const setStatus = (s, note) => api.setStatus(job.id, s, note);
  const skip = () => skipFlow(job);
  let steps = null;
  if (!job.allDay) {
    const b = (label, kind, fn, ic) => ui.button(label, { kind, icon: ic, block: false, onTap: fn }), complete = b('Complete', 'filled', () => wf.completeStop(job), 'checkmark'), arriveBtn = data.workflow.arrival !== 'auto';
    if (job.status === 'scheduled') steps = h('div.jb-steps', b('Start driving', 'tinted', () => setStatus('enroute'), 'truck'), complete, b('Skip…', 'gray', skip));
    else if (job.status === 'enroute') steps = h('div.jb-steps', arriveBtn && b('Arrived', 'tinted', () => setStatus('arrived'), 'mappin'), complete, b('Skip…', 'gray', skip));
    else if (job.status === 'arrived') steps = h('div.jb-steps', complete, b('Skip…', 'gray', skip));
    else steps = h('div.jb-done', icon(st.icon, 22, st.color), h('span', job.status === 'completed' && job.arrivedAt != null ? 'Arrived ' + fmt.time(job.arrivedAt) + ' · left ' + fmt.time(job.departedAt) + ' · ' + fmt.dur(Math.max(1, job.departedAt - job.arrivedAt)) + ' on site' : st.title + (job.rescheduledTo ? ' to ' + fmt.day(job.rescheduledTo) : '') + (job.skipNote ? ' · ' + job.skipNote : '')), h('span.spacer'), h('button', { onclick: () => setStatus('scheduled') }, 'Reopen'));
  }
  const contact = cust && cust.contacts[0];
  return ui.list(
    ui.section(null, head, steps),
    canEdit && ui.section({ footer: job.pending ? 'This job is waiting to sync. You can change it again once that finishes.' : null },
      ui.row({ title: 'Edit job', icon: 'pencil', iconPlain: true, tint: true, disabled: job.pending, onTap: () => openEditor({ jobId: job.id }) }),
      ui.row({ title: 'Reassign', icon: 'arrow.left.arrow.right', iconPlain: true, tint: true, disabled: job.pending, onTap: () => openReassign(job) }),
      !job.allDay && !WD.closed[job.status] && ui.row({ title: 'Customer canceled or rescheduled…', icon: 'phone', iconPlain: true, tint: true, disabled: job.pending, onTap: () => callOff(job) }),
      ui.row({ title: 'Delete job', icon: 'trash', iconPlain: true, iconColor: 'var(--red)', destructive: true, disabled: job.pending, onTap: () => deleteJob(job, p) })),
    cust && ui.section('Customer',
      ui.row({ leading: ui.avatar(cust.name, { size: 36, icon: cust.kind === 'household' ? 'house' : 'building' }), title: cust.name, subtitle: contact ? contact.name + (contact.role ? ' · ' + contact.role : '') : null, chevron: WD.can('crm.view'), onTap: WD.can('crm.view') ? () => guard('customers', 'openDetail', cust.id) : null }),
      contact && ui.row({ title: fmt.phone(contact.phone), icon: 'phone', iconPlain: true, tint: true, onTap: () => ui.toast('Calling ' + contact.name + ' via Quo…', 'phone') }),
      contact && ui.row({ title: 'Send a text', icon: 'message', iconPlain: true, tint: true, onTap: () => ui.toast('Opening a text to ' + contact.name + '…', 'message') })),
    !cust && job.phone && ui.section('Contact', ui.row({ title: fmt.phone(job.phone), subtitle: job.contactName || null, icon: 'phone', iconPlain: true, tint: true, onTap: () => ui.toast('Calling via Quo…', 'phone') })),
    job.address && ui.section({ header: 'Location', footer: unresolved ? 'Apple Maps could not find this address, so the stop has no pin and is left out of routing. Edit the job to fix it.' : null },
      ui.row({ title: job.address, icon: 'mappin', iconPlain: true, iconColor: unresolved ? 'var(--red)' : 'var(--label2)' }),
      ui.row({ title: 'Directions', subtitle: wf.mapsName(), icon: 'arrow.triangle.turn.up.right', iconPlain: true, tint: true, onTap: () => wf.openDirections(job) }),
      job.located && ui.row({ title: 'Show on map', icon: 'map', iconPlain: true, tint: true, onTap: () => { p.dismiss(); setTimeout(() => guard('map', 'focusJob', job.id), 350); } })),
    ui.section('Service',
      ui.row({ title: 'Job type', trailing: h('span.hstack.secondary', type.color && ui.dot(type.color), type.title) }),
      (job.items && job.items.length ? ui.row({ title: job.type === 'purge' ? 'Estimated boxes' : 'Containers', detail: WD.itemsLabel(job.items, job.type === 'purge') }) : job.containers && ui.row({ title: 'Containers', detail: job.containers })),
      job.bizOpen && ui.row({ title: 'Office hours', detail: fmt.time(fmt.fromHHMM(job.bizOpen)) + ' – ' + fmt.time(fmt.fromHHMM(job.bizClose)) }),
      job.lunchFrom && ui.row({ title: 'Closed for lunch', detail: fmt.time(fmt.fromHHMM(job.lunchFrom)) + ' – ' + fmt.time(fmt.fromHHMM(job.lunchUntil)) }),
      job.closedDays && job.closedDays.length > 0 && ui.row({ title: 'Closed', detail: job.closedDays.join(', ') }),
      (job.custFrom || job.custUntil) && ui.row({ title: job.windowBy === 'us' ? 'Window we gave them' : 'Window they asked for', subtitle: job.custStrict ? 'Required — must be done in this window' : 'Preferred — fit it in if possible', detail: windowText(job) }),
      job.needsWindow && !job.custFrom && ui.row({ title: 'Time window', subtitle: 'They want one but don’t mind when. AutoRoute gives them one when the route is finalized.', detail: h('span', { style: 'color:var(--orange);font-weight:600' }, 'Needs window') }),
      job.callAhead > 0 && ui.row({ title: 'Call ahead', detail: (job.callAhead === 60 ? '1 hour' : job.callAhead + ' min') + ' before arriving' }),
      job.type === 'purge' && job.purge && (e => e.boxes > 0 && ui.row({ title: 'Estimated time on site', subtitle: WD.PURGE_UNITS.filter(([id]) => job.purge[id]).map(([id, t]) => job.purge[id] + ' ' + t.toLowerCase()).join(', ') + (job.purge.stairs && job.purge.stairs !== 'none' ? ' · stairs ' + job.purge.stairs : '') + (job.purge.haul ? ' · haul away empties' : '') + (e.guess ? ' · rough count' : ''), detail: e.guess ? e.low + '–' + e.high + ' min' : e.minutes + ' min' }))(WD.purgeEstimate(job.purge)),
      (job.po || (cust && cust.poSchedule && cust.poSchedule.length)) && ui.row({ title: 'PO number', subtitle: cust && cust.poSchedule && cust.poSchedule.length ? 'From the PO schedule for ' + fmt.day(job.day, 'md') : null, detail: job.po || 'None' }),
      cust && wf.poAlert(cust, job.day) && wf.alertRow(wf.poAlert(cust, job.day)), job.contract && ui.row({ title: 'Contract', detail: job.contract })),
    job.notes && ui.section('Notes', h('div.jb-notes', job.notes)),
    ui.section('Attachments', job.attachments.map(a => attachmentRow(a)),
      ui.row({ title: 'Add photo or file', icon: 'paperclip', iconPlain: true, tint: true, onTap: () => addAttachment(job.attachments) })),
    (WD.can('billing.view') || WD.can('billing.field')) && !job.allDay && !WD.struck[job.status] && WD.screens.billing && ui.section({ header: 'Billing', footer: job.invoice || job.billing ? null : job.status === 'completed' ? 'This stop is completed but not billed. It stays bright on the board until it is.' : 'Nothing is sent until you review the charges.' }, WD.screens.billing.billingRows(job)),
    ui.section({ header: 'History', footer: (S.googleMirror.enabled && route ? 'Copied to the ' + route.name + ' Google calendar a few seconds after each change syncs. ' : '') + 'Version ' + job.version + '.' },
      job.events.slice().reverse().map(e => ui.row({ title: e.text, subtitle: e.actor + ' · ' + fmt.rel(e.at) }))));
}
const windowText = j => (j.custFrom ? fmt.time(fmt.fromHHMM(j.custFrom)) : 'Any') + ' – ' + (j.custUntil ? fmt.time(fmt.fromHHMM(j.custUntil)) : 'Any');
/** Copy a job onto another day (end of that route's list): used when a visit is rescheduled. */
function copyTo(job, day, routeId) {
  const { id, seq, status, events, invoice, arrivedAt, departedAt, pending, attachments, recurring, version, rescheduledTo, skipNote, ...rest } = job;
  return WD.makeJob({ ...rest, items: WD.copyItems(job.items), routeId: routeId || job.routeId, day, events: [{ at: +WD.now(), actor: S.me.name, text: 'Rescheduled from ' + fmt.day(job.day) }] });
}
async function pickDay(title, from) {
  let d = D.add(from, 1); while (D.parse(d).getDay() === 0) d = D.add(d, 1);
  const r = await ui.alert({ title, message: 'It goes to the end of that day’s list on the same route. Move it on the board afterwards if needed.', input: { type: 'date', value: d }, buttons: [{ label: 'Cancel', value: null }, { label: 'Reschedule', value: 'ok', bold: true }] });
  return r && r.value === 'ok' && /^\d{4}-\d\d-\d\d$/.test(r.text) ? r.text : null;
}
/** Driver skip: no charge, charge the customer (trip charge invoice), or reschedule to a date. Returns true when the stop was skipped. */
async function skipFlow(job) {
  const v = await ui.actionSheet({ title: 'Skip ' + job.title + '?', message: 'Skipped stops stay on the list with a line through them.',
    buttons: [{ label: 'Skip — no charge', value: 'free' }, { label: 'Skip — charge the customer', value: 'charge' }, { label: 'Skip — reschedule…', value: 'resched' }] });
  if (!v) return false;
  let why = await ui.actionSheet({ title: 'Why are you skipping?', message: 'Dispatch sees the reason on the job.', buttons: ['Office closed', 'No access', 'Customer asked to skip', 'Nothing to shred', 'Other'].map(label => ({ label })) });
  if (why === 'Other') { const r = await ui.alert({ title: 'Why are you skipping?', input: { placeholder: 'Reason' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Skip', value: true, bold: true }] }); why = r && r.value ? (r.text.trim() || 'Other') : null; }
  if (!why) return false;
  const me = S.me.name;
  if (v === 'resched') {
    const day = await pickDay('Reschedule ' + job.title, job.day); if (!day) return false;
    api.op({ kind: 'status', title: job.title, scope: 'Skipped · rescheduled to ' + fmt.day(day), jobIds: [job.id], apply() { job.status = 'skipped'; job.rescheduledTo = day; job.skipNote = why; job.events.push({ at: +WD.now(), actor: me, text: 'Skipped — ' + why + ' · rescheduled to ' + fmt.day(day) }); copyTo(job, day); } });
    ui.toast('Skipped · moved to ' + fmt.day(day), 'calendar'); return true;
  }
  api.op({ kind: 'status', title: job.title, scope: v === 'charge' ? 'Skipped · charge customer' : 'Skipped · no charge', jobIds: [job.id], apply() { job.status = 'skipped'; job.skipNote = v === 'charge' ? 'charge customer' : 'no charge'; job.events.push({ at: +WD.now(), actor: me, text: 'Skipped — ' + why + (v === 'charge' ? ' · customer charged' : ' · no charge') }); } });
  if (v === 'charge') {
    if (WD.screens.billing && WD.screens.billing.canInvoice()) setTimeout(() => WD.screens.billing.openEditor(job.id, { lines: [{ name: 'Trip charge — stop skipped (' + why.toLowerCase() + ')', qty: 1, rate: 25 }], note: 'Skipped stop. Adjust the trip charge or add lines before sending.' }), 450);
    else ui.toast('The office will invoice the trip charge', 'doc.text', 2400);
  } else ui.toast('Stop skipped · no charge', 'xmark.circle.fill');
  return true;
}
/** Office: the customer called to cancel, reschedule or postpone this visit. */
async function callOff(job) {
  const v = await ui.actionSheet({ title: 'Customer called about ' + job.title, message: fmt.day(job.day, 'long') + '. The job stays on the list, struck through.',
    buttons: [{ label: 'Canceled', value: 'canceled', role: 'destructive' }, { label: 'Rescheduled to another day…', value: 'rescheduled' }, { label: 'Postponed — no new date yet', value: 'postponed' }] });
  if (!v) return;
  const me = S.me.name; let day = null;
  if (v === 'rescheduled') { day = await pickDay('Reschedule ' + job.title, job.day); if (!day) return; }
  api.op({ kind: 'status', title: job.title, scope: { canceled: 'Customer canceled', rescheduled: 'Rescheduled to ' + (day && fmt.day(day)), postponed: 'Postponed' }[v], jobIds: [job.id], apply() {
    job.status = v; if (day) { job.rescheduledTo = day; copyTo(job, day); }
    job.events.push({ at: +WD.now(), actor: me, text: { canceled: 'Customer canceled', rescheduled: 'Customer rescheduled to ' + (day && fmt.day(day)), postponed: 'Customer postponed — new date to be set' }[v] });
    if (v === 'postponed' && data.tasks && job.customerId) data.tasks.push({ id: 'tp' + Date.now(), customerId: job.customerId, title: 'Set a new date for the postponed visit', due: D.add(D.today(), 3), done: false, doneAt: null, owner: S.me.id, lead: false });
  } });
  ui.toast({ canceled: 'Marked canceled', rescheduled: 'Moved to ' + (day && fmt.day(day)), postponed: 'Postponed · follow-up added' }[v], 'checkmark');
}
function attachmentRow(a) {
  const waiting = a.progress != null;
  return ui.row({ title: a.name, icon: a.kind === 'photo' ? 'photo' : 'doc.text', iconColor: a.kind === 'photo' ? 'var(--teal)' : 'var(--indigo)',
    subtitle: waiting ? h('div', S.offline ? 'Waiting for a connection' : 'Uploading… ' + Math.round(a.progress * 100) + '%', h('div', { style: 'margin-top:5px' }, ui.progress(a.progress))) : a.size,
    onTap: waiting ? null : () => ui.toast('Opening ' + a.name + '…') });
}
let attachSeq = 100;
async function addAttachment(list) {
  const pick = await ui.actionSheet({ buttons: [{ label: 'Take photo', value: 'photo' }, { label: 'Photo library', value: 'library' }, { label: 'Choose file', value: 'file' }] }); if (!pick) return;
  const a = pick === 'file' ? { name: 'Service agreement.pdf', kind: 'doc', size: '212 KB' } : { name: 'Photo ' + fmt.clock(WD.now()).replace(' ', '') + '.jpg', kind: 'photo', size: (1.2 + Math.random() * 2).toFixed(1) + ' MB' };
  a.id = 'att' + (++attachSeq); a.progress = 0; list.push(a); WD.changed();
  const tick = setInterval(() => { if (S.offline) return; a.progress += 0.08 + Math.random() * 0.12; if (a.progress >= 1) { delete a.progress; clearInterval(tick); } WD.changed(); }, 260);
}
async function deleteJob(job, p) {
  const scope = await ui.actionSheet({ title: 'Delete ' + (job.recurring ? 'recurring job' : 'job') + '?', message: job.title, buttons: job.recurring ? SCOPES.map(s => ({ label: s, role: 'destructive' })) : [{ label: 'Delete job', value: 'This job', role: 'destructive' }] });
  if (!scope) return;
  const ids = [job.id, ...seriesJobs(job, scope).map(j => j.id)];
  api.op({ kind: 'delete', title: job.title, scope, jobIds: ids, apply() { data.jobs = data.jobs.filter(j => !ids.includes(j.id)); } });
  p.dismiss();
}
function openReassign(job) {
  let dest = '', scope = 'This job';
  ui.sheet({ title: 'Reassign job', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Reassign', bold: true, disabled: !dest, onTap: async p => {
      const ok = await ui.actionSheet({ title: 'Reassign ' + job.title + '?', message: 'To ' + q.routeName(dest) + (job.recurring ? ' · ' + scope.toLowerCase() : ''), buttons: [{ label: 'Reassign' }] }); if (!ok) return;
      const series = seriesJobs(job, scope), to = dest;
      api.op({ kind: 'reassign', title: job.title, scope, jobIds: [job.id, ...series.map(j => j.id)], apply() { [job, ...series].forEach(j => { if (!j.allDay) WD.placeJob(j, to, j.day, Infinity); else j.routeId = to; }); job.events.push({ at: +WD.now(), actor: S.me.name, text: 'Reassigned to ' + q.routeName(to) }); } });
      p.dismiss();
    } }],
    render: p => ui.list(
      ui.section('Assign to', q.routes().filter(r => r.writable && r.id !== job.routeId).map(r => { const d = q.driverFor(r.id), n = q.jobsFor(r.id, job.day).filter(j => !j.allDay).length;
        return ui.row({ leading: ui.dot(q.routeColor(r)), title: q.routeName(r), subtitle: (d ? d.name : 'No driver assigned') + ' · ' + n + (n === 1 ? ' job' : ' jobs') + ' that day', trailing: dest === r.id ? icon('checkmark', 20, 'var(--tint)') : null, onTap: () => { dest = r.id; p.refresh(); } }); })),
      job.recurring && ui.section('Apply to', SCOPES.map(s => ui.row({ title: s, trailing: scope === s ? icon('checkmark', 20, 'var(--tint)') : null, onTap: () => { scope = s; p.refresh(); } }))),
      h('div', { style: 'margin-top:10px' }, ui.note('The job keeps its date and goes to the end of that route’s list.'))) }, { detent: job.recurring ? 'large' : 'medium' });
}

/* ================= Job editor ================= */
const REPEATS = [{ value: 'none', label: 'Never' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function parseRule(rule) { const m = /Every (\d+) (week|day|month)/.exec(rule || ''); if (m) return { repeat: m[2] === 'week' ? 'weekly' : m[2] === 'day' ? 'daily' : 'monthly', interval: +m[1] }; if (/^Weekly/.test(rule)) return { repeat: 'weekly', interval: 1 }; if (/^Daily/.test(rule)) return { repeat: 'daily', interval: 1 }; if (/^Monthly/.test(rule)) return { repeat: 'monthly', interval: 1 }; return { repeat: 'none', interval: 1 }; }
function ruleLabel(f) {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[f.repeat], base = f.interval === 1 ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[f.repeat] : 'Every ' + f.interval + ' ' + unit + 's';
  return base + (f.repeat === 'weekly' ? ' on ' + WEEKDAYS[D.parse(f.day).getDay()] : f.repeat === 'monthly' ? ' on day ' + D.parse(f.day).getDate() : '') + (f.ends === 'count' ? ', ' + f.count + ' times' : f.ends === 'until' ? ', until ' + fmt.day(f.until, 'md') : '');
}
const ITEM_LABEL = { console: 'Consoles', bin64: 'Bins (64 gal)', bin96: 'Bins (96 gal)', box: 'Boxes' };
const driveMin = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.05 + 3);
/** Best places to add a located job: the cheapest insertion into each route's day (purge jobs also look at the next working days). */
function recommend(f, job) {
  if (f.x == null || !f.located || f.allDay) return [];
  const days = [f.day]; if (f.type === 'purge') { let d = f.day; while (days.length < 6) { d = D.add(d, 1); if (D.parse(d).getDay() !== 0) days.push(d); } }
  const out = [];
  days.forEach(day => q.routes().filter(r => r.writable).forEach(r => {
    const list = q.stopList(r.id, day).filter(j => j !== job), ends = q.routeEnds(r.id, day), chain = [ends.start, ...list.filter(j => j.located && j.x != null), ends.end];
    const locked = list.reduce((n, j, k) => !['scheduled', 'enroute'].includes(j.status) ? k + 1 : n, 0);
    let best = null;
    for (let i = 0; i < chain.length - 1; i++) { const a = chain[i], b = chain[i + 1], add = driveMin(a, f) + driveMin(f, b) - driveMin(a, b); const after = i === 0 ? null : a, idx = after ? list.indexOf(after) + 1 : 0;
      if (idx < locked) continue; if (!best || add < best.add) best = { add: Math.max(1, add), idx, after, near: driveMin(a, f) < driveMin(f, b) ? (i ? a : null) : (i + 1 < chain.length - 1 ? b : null) }; }
    if (best) out.push({ route: r, day, ...best, count: list.length, score: best.add + list.length * 1.2 + (r.id === 'r4' && f.type === 'purge' ? -4 : 0) + D.diff(day, f.day) * 1.5 });
  }));
  return out.sort((a, b) => a.score - b.score).slice(0, f.type === 'purge' ? 4 : 3);
}
/** Simulated Apple Maps suggestions. Keeps whatever city was typed — the real app searches Apple Maps, which finds any address. */
const titleCase = t => t.replace(/\b\w/g, m => m.toUpperCase());
function addressSuggestions(text) {
  const t = text.trim(), s = t.toLowerCase(); if (s.length < 3) return [];
  const [street, ...rest] = t.split(','), city = rest.join(',').trim();
  const known = data.customers.flatMap(c => c.locations.map(l => ({ title: l.address.split(',')[0], sub: c.name + ' · ' + (l.address.split(',')[1] || '').trim(), address: l.address, l }))).filter(x => x.address.toLowerCase().includes(s.split(',')[0].trim()) || x.sub.toLowerCase().includes(s));
  let h1 = 7; for (const ch of s) h1 = (h1 * 31 + ch.charCodeAt(0)) >>> 0;
  const st = titleCase(street.trim()) + (/\b(st|street|ave|avenue|blvd|rd|road|dr|drive|ln|lane|way|ct|court|pkwy|hwy)\b/i.test(street) ? '' : ' St');
  const made = !/\d/.test(street) ? [] : city ? [{ title: st, sub: titleCase(city), address: st + ', ' + titleCase(city), l: { x: 80 + h1 % 840, y: 80 + (h1 >> 8) % 840 } }]
    : ['Lakemont', 'North Lakemont'].map((c, i) => ({ title: st, sub: c + (i ? '' : ' · near you'), address: st + ', ' + c, l: { x: 200 + ((h1 >> (i * 4)) % 600), y: 200 + ((h1 >> (i * 6 + 3)) % 600) } }));
  return [{ title: 'Use “' + t + '”', sub: 'Exactly as typed', address: t, typed: true }].concat(known.slice(0, 4), made).slice(0, 10);
}
function openEditor(o = {}) {
  const job = o.jobId ? q.job(o.jobId) : null, isNew = !job;
  const f = job ? { title: job.title, address: job.address, notes: job.notes, routeId: job.routeId, day: job.day, allDay: job.allDay, pos: (p => p.n < p.of ? p.n : 0)(q.position(job)), dur: job.dur, type: job.type, items: WD.copyItems(job.items), bizOpen: job.bizOpen, bizClose: job.bizClose, custFrom: job.custFrom, custUntil: job.custUntil, custStrict: !!job.custStrict, customerId: job.customerId, located: job.located, x: job.x, y: job.y, po: job.po || '', contract: job.contract || '', contact: job.contactName || '', phone: job.phone ? fmt.phone(job.phone) : '', email: '', billingEmail: '', sig: WD.sigPolicy(q.customer(job.customerId)), windowBy: job.windowBy || 'customer', lunchFrom: job.lunchFrom || '', lunchUntil: job.lunchUntil || '', closedDays: (job.closedDays || []).slice(), callAhead: job.callAhead || 0, needsWindow: !!job.needsWindow, purge: job.purge ? { ...job.purge } : null, flags: { ...(job.flags || {}) }, ...parseRule(job.recurring && job.recurring.rule) }
    : { title: '', address: '', notes: '', routeId: o.routeId || (q.visibleRoutes()[0] || q.routes()[0]).id, day: o.day || S.board.day, allDay: false, pos: o.pos || 0, dur: 30, type: o.type || 'purge', items: (o.type || 'purge') === 'purge' ? [{ id: 'box', qty: 0, rate: 8 }] : [], bizOpen: '', bizClose: '', custFrom: '', custUntil: '', custStrict: false, customerId: null, located: false, x: null, y: null, po: '', contract: '', contact: '', phone: '', email: '', billingEmail: '', sig: 'optional', windowBy: 'customer', lunchFrom: '', lunchUntil: '', closedDays: [], callAhead: 0, needsWindow: false, purge: null, flags: {}, repeat: 'none', interval: 1 };
  Object.assign(f, { ends: 'never', count: 10, until: D.add(f.day, 90), attachments: [] });
  if (f.type === 'purge' && !f.purge) { const b = (f.items.find(i => i.id === 'box') || {}).qty || 0; f.purge = { std: b, stairs: 'none', haul: false }; }
  let customCall = ![0, 15, 30, 60].includes(f.callAhead);
  const wasRecurring = f.repeat !== 'none';
  let page = null, matchBox = null, suggestBox = null, recBox = null, timer = null, dirty = false;
  const fill = c => { const l = c.locations[0], p = c.contacts[0] || {}; Object.assign(f, { customerId: c.id, title: c.name, address: l.address, notes: l.notes, type: c.type, items: WD.copyItems(l.items), bizOpen: l.bizOpen, bizClose: l.bizClose, located: l.located !== false, x: l.x, y: l.y, po: WD.workflow.poFor(c, f.day).po, contract: c.contract || '', sig: WD.sigPolicy(c), lunchFrom: l.lunchFrom || '', lunchUntil: l.lunchUntil || '', closedDays: (l.closedDays || []).slice(), callAhead: l.callAhead || 0, contact: p.name || '', phone: p.phone ? fmt.phone(p.phone) : '', email: p.email || '', billingEmail: c.billingEmail || '' }); dirty = true; };
  if (isNew && o.customerId && q.customer(o.customerId)) fill(q.customer(o.customerId));
  const blurAndRefresh = () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); page.refresh(); };
  const syncSave = () => { const b = page.navbar.querySelector('.nav-trail .nav-btn'); if (b) b.disabled = !f.title.trim(); };
  const asks = k => WD.asks(f.type, k);

  function lookup(text) {
    clearTimeout(timer); if (!matchBox) return;
    if (f.customerId || text.trim().length < 2) return matchBox.replaceChildren();
    matchBox.replaceChildren(h('div.section-header', 'Matching customers'), h('div.cells', h('div.row', ui.spinner(18), h('div.row-main.secondary', 'Looking up customers…'))));
    timer = setTimeout(() => {
      const found = q.searchCustomers(text, 4);
      matchBox.replaceChildren(h('div.section-header', found.length ? 'Matching customers' : 'No matching customer'),
        found.length ? h('div.cells', found.map(m => ui.row({ leading: ui.avatar(m.customer.name, { size: 34 }), title: m.customer.name, subtitle: m.match, trailing: h('span', { style: 'color:var(--tint);font-size:15px' }, 'Use'), onTap: () => { fill(m.customer); blurAndRefresh(); ui.toast('Filled from ' + m.customer.name, 'checkmark'); } })))
          : h('div.section-footer', { style: 'padding-top:0' }, f.type === 'meet' ? 'Meet-the-truck jobs only need a name and phone.' : 'Saving creates a new customer from this job. Likely duplicates are flagged for merging.'));
    }, 260 + Math.random() * 240);
  }
  function suggest(text) {
    if (!suggestBox) return; const items = addressSuggestions(text);
    suggestBox.replaceChildren(items.length ? h('div', h('div.cells', { style: 'margin-top:8px' }, items.map(x => ui.row({ icon: x.typed ? 'pencil' : 'mappin', iconPlain: true, iconColor: x.typed ? 'var(--label2)' : 'var(--red)', title: x.title, subtitle: x.sub,
      onTap: () => { f.address = x.address; if (x.typed) { f.located = /\d/.test(x.address); f.x = null; } else { f.located = true; f.x = x.l.x; f.y = x.l.y; } dirty = true; blurAndRefresh(); } }))),
      h('div.section-footer', 'Prototype: suggestions are simulated. The app searches Apple Maps (biased toward your location), so any real address — like one in another city — comes up.')) : '');
  }
  function drawRecs() {
    if (!recBox) return; const recs = recommend(f, job);
    if (!recs.length) return recBox.replaceChildren();
    recBox.replaceChildren(ui.section({ header: f.type === 'purge' ? 'Suggested days and routes' : 'Suggested routes', footer: 'Ranked by the extra driving it adds and how full each route is' + (f.type === 'purge' ? ', over the next working days.' : ' that day.') + ' Tap one to use it.' },
      recs.map(r => ui.row({ class: 'jb-rec', leading: ui.dot(q.routeColor(r.route)), title: q.routeName(r.route) + (f.type === 'purge' ? ' · ' + fmt.day(r.day) : ''),
        subtitle: 'Adds ~' + r.add + ' min driving · ' + (r.after ? 'after stop ' + r.idx + ' (' + r.after.title + ')' : 'first stop') + ' · ' + r.count + (r.count === 1 ? ' stop' : ' stops'),
        detail: f.routeId === r.route.id && f.day === r.day && f.pos === (r.idx >= r.count ? 0 : r.idx + 1) ? '✓' : 'Use',
        onTap: () => { f.routeId = r.route.id; f.day = r.day; f.pos = r.idx >= r.count ? 0 : r.idx + 1; dirty = true; page.refresh(); ui.toast(q.routeName(r.route) + ' · stop ' + (r.idx + 1), 'checkmark'); } }))));
  }
  async function save(p) {
    if (!f.title.trim()) return;
    if (isNew && !f.customerId && !f.allDay && asks('phone') && f.phone.replace(/\D/g, '').length < 10) return ui.toast('A phone number is required for a new customer', 'phone', 2400);
    if (f.type === 'purge' && f.purge) { const e = WD.purgeEstimate(f.purge); if (e.minutes) f.dur = e.minutes;
      const box = f.items.find(i => i.id === 'box'), rate = box ? box.rate : data.priceBook.find(x => x.id === 'box').rate;
      f.items = f.items.filter(i => !['box', 'stairsDown', 'stairsUp', 'haul'].includes(i.id)).concat(e.billable ? [{ id: 'box', qty: e.billable, rate }] : [], WD.purgeExtras(f.purge, e.billable)); }
    let scope = 'This job';
    if (job && job.recurring) { scope = await ui.actionSheet({ title: 'Save changes to a recurring job', message: 'Changing “this and following” ends the old series and starts a new one in a single step.', buttons: SCOPES.map(l => ({ label: l })) }); if (!scope) return; }
    if (!f.address.trim()) f.located = false; else if (f.x == null) { f.located = /\d/.test(f.address); if (f.located) { f.x = 150 + Math.random() * 700; f.y = 150 + Math.random() * 700; } }
    const purge = f.type === 'purge', containers = WD.itemsLabel(f.items, purge), phone = f.phone.replace(/\D/g, '').length >= 10 ? '+1' + f.phone.replace(/\D/g, '').slice(-10) : '';
    let newCustomer = null;
    if (isNew && !f.customerId && f.type !== 'meet' && (f.address.trim() || phone || f.email.trim())) {
      newCustomer = { id: 'c' + (900 + data.customers.length), name: f.title.trim(), kind: 'company', route: f.routeId, lifecycle: 'scheduled', channel: 'Other', type: f.type, freq: f.repeat === 'none' ? 'One time' : ruleLabel(f), contacts: (f.contact.trim() || phone || f.email.trim()) ? [{ name: f.contact.trim() || f.title.trim(), role: '', phone, email: f.email.trim().toLowerCase() }] : [], owner: S.me.id, nextAction: null, notes: '', tags: [], successful: false,
        billingEmail: f.billingEmail.trim(), po: f.po.trim(), contract: f.contract.trim(), signature: f.sig, billingMode: 'invoice', documents: [], poSchedule: [],
        locations: [{ id: 'l' + Date.now(), label: 'Main office', address: f.address, x: f.x, y: f.y, containers, items: WD.copyItems(f.items), bizOpen: f.bizOpen, bizClose: f.bizClose, notes: f.notes, located: f.located }], stats: { jobs: 0, invoiced: 0, paid: 0, balance: 0, lastService: null, firstInvoice: null, rate: 85 } };
      data.customers.push(newCustomer); f.customerId = newCustomer.id;
    } else if (f.customerId && q.customer(f.customerId) && asks('signature')) q.customer(f.customerId).signature = f.sig;
    if (f.customerId && q.customer(f.customerId)) { const l = q.customer(f.customerId).locations[0]; if (l) Object.assign(l, { lunchFrom: f.lunchFrom, lunchUntil: f.lunchUntil, closedDays: f.closedDays.slice(), callAhead: f.callAhead }); }
    const fields = { title: f.title.trim(), address: f.address.trim(), notes: f.notes, routeId: f.routeId, day: f.day, allDay: f.allDay, dur: f.dur, type: f.type, containers, items: WD.copyItems(f.items), bizOpen: f.bizOpen, bizClose: f.bizClose, custFrom: f.custFrom, custUntil: f.custUntil, custStrict: f.custStrict, customerId: f.customerId, locationId: null, located: f.located, x: f.x, y: f.y, po: f.po.trim(), contract: f.contract.trim(), phone: f.customerId ? '' : phone, contactName: f.customerId ? '' : f.contact.trim(), windowBy: f.windowBy, needsWindow: f.needsWindow && !(f.custFrom || f.custUntil), purge: f.type === 'purge' && f.purge ? { ...f.purge } : null, lunchFrom: f.lunchFrom, lunchUntil: f.lunchUntil, closedDays: f.closedDays.slice(), callAhead: f.callAhead, flags: { ...f.flags } };
    const series = job ? seriesJobs(job, scope) : [], me = S.me.name;
    api.op({ kind: isNew ? 'create' : 'edit', title: fields.title, scope: isNew ? (f.repeat === 'none' ? 'New job' : 'New recurring job') : scope, jobIds: job ? [job.id, ...series.map(j => j.id)] : [], apply() {
      const recurring = f.repeat === 'none' ? null : { rule: ruleLabel(f), seriesId: job && job.recurring && scope === 'All jobs' ? job.recurring.seriesId : 's-' + Date.now() };
      if (job) {
        const from = { routeId: job.routeId, day: job.day }; Object.assign(job, from, fields, { routeId: from.routeId, day: from.day, recurring: wasRecurring && scope === 'This job' ? job.recurring : recurring });
        if (fields.allDay) { job.routeId = fields.routeId; job.day = fields.day; job.seq = 0; WD.renumber(from.routeId, from.day); } else WD.placeJob(job, fields.routeId, fields.day, f.pos ? f.pos - 1 : Infinity); job.events.push({ at: +WD.now(), actor: me, text: 'Edited' + (scope !== 'This job' ? ' (' + scope.toLowerCase() + ')' : '') });
        series.forEach(j => Object.assign(j, { title: fields.title, address: fields.address, notes: fields.notes, dur: fields.dur, allDay: fields.allDay, type: fields.type, containers: fields.containers, items: WD.copyItems(fields.items), purge: fields.purge, needsWindow: fields.needsWindow, po: fields.po, contract: fields.contract, recurring: recurring || j.recurring })); series.forEach(j => { if (j.routeId !== fields.routeId) WD.placeJob(j, fields.routeId, j.day, Infinity); });
      } else {
        const make = (day, pos) => { const j = WD.makeJob({ ...fields, items: WD.copyItems(fields.items), day, recurring, seq: fields.allDay ? 0 : null, attachments: f.attachments.slice(), events: [{ at: +WD.now(), actor: me, text: 'Created' }] }); if (pos && !j.allDay) WD.placeJob(j, j.routeId, day, pos - 1); }; make(f.day, f.pos);
        if (recurring) { const stepDays = { daily: 1, weekly: 7, monthly: 28 }[f.repeat] * f.interval, max = f.ends === 'count' ? f.count : 60; for (let i = 1; i < max && i * stepDays <= 548; i++) { const day = D.add(f.day, i * stepDays); if (f.ends === 'until' && day > f.until) break; make(day); } }
      }
    } });
    p.dismiss();
    if (newCustomer) setTimeout(() => ui.toast('New customer created: ' + newCustomer.name, 'person.badge.plus', 2600), 500);
    guard('board', 'show', f.day, job ? job.id : (data.jobs[data.jobs.length - 1] || {}).id);
  }
  /** Container counts (and rates when pricing is asked for). Purge jobs ask for an estimated box count. */
  function itemsRows(p) {
    const purge = f.type === 'purge', ids = purge ? ['box'] : WD.CONTAINERS, pricing = asks('pricing');
    const get = id => f.items.find(i => i.id === id), setQty = (id, n) => { let it = get(id); if (!it) f.items.push(it = { id, qty: 0, rate: data.priceBook.find(x => x.id === id).rate }); it.qty = Math.max(0, n); f.items = f.items.filter(i => i.qty > 0 || !WD.CONTAINERS.includes(i.id)); dirty = true; };
    return ids.map(id => { const it = get(id), n = it ? it.qty : 0, pb = data.priceBook.find(x => x.id === id);
      const rate = pricing && n > 0 && h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': ITEM_LABEL[id] + ' rate', value: '$' + (it.rate != null ? it.rate : pb.rate), oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); it.rate = isNaN(v) ? 0 : v; dirty = true; } });
      if (purge) return purgeRows(p, it, rate);
      return h('div.row.jb-item', h('div.row-main', h('div.row-title', ITEM_LABEL[id]), pricing && n > 0 && h('div.row-sub', 'Rate each')), rate, h('span.jb-qn', String(n)), ui.stepper(n, 0, 40, v => { setQty(id, v); p.refresh(); }));
    });
  }
  /** Purge: what the customer has (any mix of box sizes, bins, pallets, gaylords, cabinets), stairs and haul-away, and the time and price estimate they add up to. */
  function purgeRows(p, it, rate) {
    const P = data.purgeRules, pd = f.purge = f.purge || { std: 0, stairs: 'none', haul: false }, e = WD.purgeEstimate(pd), pb = id => data.priceBook.find(x => x.id === id).rate;
    const count = ([id, title, sub, k]) => h('div.row.jb-item', h('div.row-main', h('div.row-title', title), h('div.row-sub', typeof k === 'string' && ['pallet', 'gaylord', 'cabinet'].includes(k) ? '≈ ' + P[k] + ' boxes each' : sub)),
      h('input.jb-count', { type: 'text', inputmode: 'numeric', 'aria-label': title, value: pd[id] ? String(pd[id]) : '', placeholder: '0', oninput: ev => { pd[id] = parseInt(ev.target.value.replace(/\D/g, ''), 10) || 0; dirty = true; }, onchange: () => p.refresh() }));
    const boxRate = it ? it.rate : pb('box'), extras = WD.purgeExtras(pd, e.billable), price = e.billable * boxRate + extras.reduce((s2, x) => s2 + x.qty * x.rate, 0);
    return [WD.PURGE_UNITS.map(count),
      h('div.row', h('div.row-main', h('div.row-title', 'Stairs'), h('div.row-sub', 'Takes 2–3× as long · +$' + pb('stairsDown') + '/box down, +$' + pb('stairsUp') + '/box up')), h('div', { style: 'width:170px;flex:none' }, ui.segmented([{ value: 'none', label: 'None' }, { value: 'down', label: 'Down' }, { value: 'up', label: 'Up' }], pd.stairs || 'none', v => { pd.stairs = v; dirty = true; p.refresh(); }))),
      ui.toggleRow({ title: 'Haul away the empty boxes', subtitle: '+$' + pb('haul') + '/box · about doubles the time', value: !!pd.haul, onChange: v => { pd.haul = v; dirty = true; p.refresh(); } }),
      h('div.row.jb-est', h('div.row-main', h('div.row-title', e.boxes ? '≈ ' + e.billable + ' boxes · ' + (e.guess ? e.low + '–' + e.high + ' min' : e.minutes + ' min') + ' on site' : 'Enter what they have'),
        e.boxes > 0 && h('div.row-sub', e.guess ? h('span', { style: 'color:var(--orange);font-weight:600' }, 'Rough count (' + e.why + '). Planned at ' + e.minutes + ' min; confirm the count on site.') : 'Exact counts are usually close. Planned at ' + e.minutes + ' min.'),
        e.boxes > 0 && asks('pricing') && h('div.row-sub', 'Estimated ' + fmt.money(price) + ' · ' + e.billable + ' × ' + fmt.money(boxRate) + (extras.length ? ' + ' + extras.map(x => ({ stairsDown: 'stairs down', stairsUp: 'stairs up', haul: 'haul-away' })[x.id]).join(' + ') : ''))), rate)];
  }
  /** Heads-up details the driver sees right after the job title (Settings → Field workflow chooses which show). */
  function headsUp(p) {
    const flag = (k, title) => ui.toggleRow({ title, value: !!f.flags[k], onChange: v => { f.flags[k] = v; dirty = true; } }), DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const preview = WD.workflow.titleDetails({ ...f, title: f.title, flags: f.flags });
    return ui.section({ header: 'Heads-up for the driver', footer: (preview.length ? 'Shows after the title: “' + preview.join(' · ') + '”. ' : '') + 'Lunch, closed days and call-ahead are saved with the customer’s location; the rest apply to this visit.' },
      ui.quarterRow({ title: 'Closed for lunch from', value: f.lunchFrom, onChange: v => { f.lunchFrom = v; dirty = true; p.refresh(); } }), f.lunchFrom && ui.quarterRow({ title: 'Lunch until', value: f.lunchUntil, onChange: v => { f.lunchUntil = v; dirty = true; p.refresh(); } }),
      ui.row({ title: 'Closed on', trailing: h('div.hstack', { style: 'gap:4px' }, DAYS.map(d => h('button.jb-day' + (f.closedDays.includes(d) ? '.on' : ''), { onclick: () => { f.closedDays = f.closedDays.includes(d) ? f.closedDays.filter(x => x !== d) : DAYS.filter(x => x === d || f.closedDays.includes(x)); dirty = true; p.refresh(); } }, d[0] + (d === 'Thu' || d === 'Sat' ? d[1] : '')))) }),
      ui.pickerRow({ title: 'Call ahead', value: customCall ? 'custom' : f.callAhead, options: [{ value: 0, label: 'No' }, { value: 15, label: '15 minutes' }, { value: 30, label: '30 minutes' }, { value: 60, label: '1 hour' }, { value: 'custom', label: 'Custom…' }],
        onChange: v => { customCall = v === 'custom'; if (!customCall) f.callAhead = v; else if ([0, 15, 30, 60].includes(f.callAhead)) f.callAhead = 0; dirty = true; p.refresh(); } }),
      customCall && ui.inputRow({ label: 'Minutes', type: 'text', inputmode: 'numeric', placeholder: 'How many minutes ahead they want a call', value: f.callAhead ? String(f.callAhead) : '', autofocus: !f.callAhead, onInput: v => { f.callAhead = Math.min(600, parseInt(v.replace(/\D/g, ''), 10) || 0); dirty = true; } }),
      f.type !== 'setup' && flag('setup', 'New setup'), flag('extraBin', 'Bring an extra container'), flag('extraShred', 'Has extra to shred'), flag('early', 'Called in for early service'));
  }
  const timeRows = () => [ui.quarterRow({ title: 'From', value: f.custFrom, onChange: v => { f.custFrom = v; dirty = true; } }), ui.quarterRow({ title: 'Until', value: f.custUntil, onChange: v => { f.custUntil = v; dirty = true; } })];

  ui.sheet({ title: isNew ? 'New job' : 'Edit job',
    leading: [{ label: 'Cancel', onTap: async p => { if (dirty && !(await ui.actionSheet({ buttons: [{ label: 'Discard changes', role: 'destructive' }], cancel: 'Keep editing' }))) return; p.dismiss(); } }],
    trailing: () => [{ label: isNew ? 'Add' : 'Save', bold: true, disabled: !f.title.trim(), onTap: save }],
    onClose: () => clearTimeout(timer),
    render(p) {
      page = p; matchBox = h('div.jb-match'); suggestBox = h('div'); recBox = h('div');
      const cust = q.customer(f.customerId), set = (k, v, re) => { f[k] = v; dirty = true; if (re) p.refresh(); };
      const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[f.repeat], type = q.jobType(f.type), showWindow = asks('window') || f.custFrom || f.custUntil || f.needsWindow;
      function positionRow() {
        const list = q.stopList(f.routeId, f.day).filter(j => j !== job); if (f.pos > list.length) f.pos = 0;
        const options = [{ value: 0, label: 'End of list (stop ' + (list.length + 1) + ')' }, ...list.map((j, i) => ({ value: i + 1, label: 'Stop ' + (i + 1) + ' · before ' + j.title }))];
        return ui.pickerRow({ title: 'Position', value: f.pos, options, onChange: v => set('pos', +v, true) });
      }
      const inp = (label, k, o2 = {}) => ui.inputRow({ label, value: f[k], onInput: v => { f[k] = v; dirty = true; }, ...o2 });
      setTimeout(drawRecs, 0);
      return ui.list(
        ui.section({ header: 'Job', footer: cust ? null : 'Type a name, phone, email or address to find an existing customer.' },
          ui.pickerRow({ title: 'Job type', value: f.type, icon: 'tag', iconColor: type.color, options: WD.jobTypes.map(t => ({ value: t.id, label: t.title })), onChange: v => { if (v === 'purge' && !f.items.some(i => i.id === 'box')) f.items = [{ id: 'box', qty: 0, rate: 8 }]; if (v === 'purge' && !f.purge) f.purge = { std: (f.items.find(i => i.id === 'box') || {}).qty || 0, stairs: 'none', haul: false }; set('type', v, true); } }),
          ui.inputRow({ placeholder: f.type === 'meet' ? 'Customer name' : 'Customer or job title', value: f.title, caps: 'words', autofocus: isNew && !f.title, onInput: v => { f.title = v; dirty = true; syncSave(); lookup(v); } }),
          cust && ui.row({ leading: ui.avatar(cust.name, { size: 34 }), title: cust.name, subtitle: 'Linked customer' + (cust.contacts[0] ? ' · ' + cust.contacts[0].name + ' · ' + fmt.phone(cust.contacts[0].phone) : ''), trailing: h('button', { style: 'border:0;background:none;color:var(--tint);font-size:15px;cursor:pointer', onclick: e => { e.stopPropagation(); f.customerId = null; dirty = true; p.refresh(); } }, 'Unlink') })),
        matchBox,
        !cust && (asks('contact') || asks('phone') || asks('email') || asks('billingEmail')) && ui.section({ header: f.type === 'meet' ? 'Contact' : 'New customer', footer: f.type === 'meet' ? 'Phone is required.' : isNew ? 'Saving creates the customer with these details. Phone is required; email is strongly recommended for invoices and receipts.' : null },
          asks('contact') && inp('Contact', 'contact', { placeholder: 'Name', caps: 'words' }), asks('phone') && inp('Phone', 'phone', { type: 'tel', inputmode: 'tel', placeholder: '(559) 555-0100', required: !f.allDay }),
          asks('email') && inp('Email', 'email', { type: 'email', caps: 'off', placeholder: 'Recommended', suggested: true }), asks('billingEmail') && inp('Billing', 'billingEmail', { type: 'email', caps: 'off', placeholder: 'Billing email, if different' })),
        asks('address') && ui.section({ header: 'Address', footer: f.located && f.x != null ? null : f.address ? 'Pick a suggestion to put the stop on the map, or keep the text as typed.' : null },
          ui.inputRow({ icon: 'mappin', iconColor: f.located && f.x != null ? 'var(--red)' : null, placeholder: 'Street address, city', value: f.address, onInput: v => { f.address = v; f.x = null; f.located = false; dirty = true; suggest(v); if (!f.title.trim()) lookup(v); } })),
        suggestBox, recBox,
        ui.section('Schedule',
          ui.pickerRow({ title: 'Route', value: f.routeId, options: q.routes().filter(r => r.writable).map(r => ({ value: r.id, label: q.routeName(r) })), onChange: v => { f.pos = 0; set('routeId', v, true); } }),
          ui.dateRow({ title: 'Date', value: f.day, onChange: v => { f.pos = 0; set('day', v, true); } }),
          ui.toggleRow({ title: 'Note only', subtitle: 'Shows at the top of the day, not as a stop', value: f.allDay, onChange: v => set('allDay', v, true) }),
          !f.allDay && positionRow()),
        (asks('freq') || f.repeat !== 'none') && ui.section({ header: 'Frequency of service', footer: f.repeat === 'none' ? null : ruleLabel(f) + '. Each visit is created ahead of time for the next 18 months.' },
          ui.pickerRow({ title: 'Repeat', value: f.repeat, options: REPEATS, onChange: v => set('repeat', v, true) }),
          f.repeat !== 'none' && ui.row({ title: 'Every', detail: f.interval + ' ' + unit + (f.interval > 1 ? 's' : ''), trailing: ui.stepper(f.interval, 1, 12, v => set('interval', v, true)) }),
          f.repeat !== 'none' && ui.pickerRow({ title: 'Ends', value: f.ends, options: [{ value: 'never', label: 'Never' }, { value: 'count', label: 'After a number of visits' }, { value: 'until', label: 'On a date' }], onChange: v => set('ends', v, true) }),
          f.repeat !== 'none' && f.ends === 'count' && ui.row({ title: 'Visits', detail: f.count, trailing: ui.stepper(f.count, 1, 60, v => set('count', v, true)) }),
          f.repeat !== 'none' && f.ends === 'until' && ui.dateRow({ title: 'Last visit by', value: f.until, onChange: v => set('until', v) })),
        asks('items') && ui.section({ header: f.type === 'purge' ? 'Boxes' : 'Containers', footer: f.type === 'creditCard' ? 'Card-on-file jobs are charged automatically when the stop is completed.' : asks('pricing') ? 'Rates start from ' + (cust ? cust.name + '’s pricing' : 'the price book') + ' and print on the invoice. Changes here apply to this job.' : null }, itemsRows(p)),
        asks('hours') && ui.section({ header: 'Office hours', footer: 'When the business is open. AutoRoute never plans a stop outside these hours.' },
          ui.quarterRow({ title: 'Opens', value: f.bizOpen, onChange: v => set('bizOpen', v) }), ui.quarterRow({ title: 'Closes', value: f.bizClose, onChange: v => set('bizClose', v) })),
        showWindow && ui.section({ header: 'Requested time window', footer: f.needsWindow ? 'They want a window but don’t mind when. When the route is finalized (usually the day before), AutoRoute gives them one around the planned arrival — 2 hours before 10 AM, 3 hours from 10 to 1, 4 hours after 1 — and reminds you to let them know.' : 'A time the customer asked for on this visit — for example a homeowner who is only home 1–3 PM. Preferred: AutoRoute fits it in when it can. Required: AutoRoute plans around it and warns if it can’t be met.' },
          ui.toggleRow({ title: 'Needs a window', subtitle: 'Time chosen when the route is finalized', value: f.needsWindow, onChange: v => { f.needsWindow = v; if (v) { f.custFrom = ''; f.custUntil = ''; } dirty = true; p.refresh(); } }),
          !f.needsWindow && [timeRows(), h('div.row', h('div.row-main', h('div.row-title', 'Who set it')), h('div', { style: 'width:190px;flex:none' }, ui.segmented([{ value: 'customer', label: 'They asked' }, { value: 'us', label: 'We told them' }], f.windowBy, v => { f.windowBy = v; dirty = true; }))),
          h('div.row', h('div.row-main', h('div.row-title', 'This window is')), h('div', { style: 'width:190px;flex:none' }, ui.segmented([{ value: false, label: 'Preferred' }, { value: true, label: 'Required' }], f.custStrict, v => { f.custStrict = v; dirty = true; })))]),
        (asks('po') || asks('contract') || asks('signature')) && ui.section({ header: 'Billing', footer: 'PO and contract numbers print on the invoice. ' + (cust ? 'They come from the customer; changes here apply to this job only.' : 'They’re saved to the new customer.') },
          asks('po') && inp('PO number', 'po', { placeholder: 'None' }), asks('contract') && inp('Contract', 'contract', { placeholder: 'None' }),
          asks('signature') && ui.pickerRow({ title: 'Customer signature', value: f.sig, options: WD.SIG_POLICIES, onChange: v => { f.sig = v; dirty = true; p.refresh(); } })),
        !f.allDay && f.type !== 'meet' && headsUp(p),
        asks('notes') && ui.section('Notes', ui.inputRow({ multiline: true, placeholder: 'Access notes, contact, what to bring', value: f.notes, onInput: v => set('notes', v) })),
        isNew && ui.section('Attachments', f.attachments.map(attachmentRow), ui.row({ title: 'Add photo or file', icon: 'paperclip', iconPlain: true, tint: true, onTap: () => addAttachment(f.attachments) })),
        h('div', { style: 'margin-top:14px' }, ui.note(type.title + ' jobs ask for these fields. ' + (WD.can('settings.manage') ? 'Change them in Settings → Job types and fields.' : 'An admin can change them in Settings.'))));
    } });
}

/* ================= Search ================= */
function openSearch() {
  let text = '', scope = 'jobs', loading = false, timer = null, box = null;
  const routeIds = () => q.visibleRoutes().map(r => r.id);
  function fill(p) {
    if (!box) return; const s = text.trim();
    if (s.length < 2) return box.replaceChildren(ui.list(ui.section({ header: 'Recent', footer: scope === 'jobs' ? 'Searches every job on your ' + routeIds().length + ' selected routes, past and future: title, address, notes and route name.' : 'Matches customer name, contact, phone, email or address.' },
      ['Harlow', '555-0131', 'Bank St'].map(r => ui.row({ title: r, icon: 'clock', iconPlain: true, iconColor: 'var(--label2)', onTap: () => { text = r; const i = p.navbar.querySelector('.search-box input'); if (i) { i.value = r; i.parentNode.classList.add('filled'); } run(p); } })))));
    if (loading) return box.replaceChildren(h('div', { style: 'text-align:center;padding:40px' }, ui.spinner(26)));
    if (scope === 'customers') { const found = q.searchCustomers(s, 20);
      return box.replaceChildren(found.length ? ui.list(ui.section(found.length + (found.length === 1 ? ' customer' : ' customers'), found.map(m => ui.row({ leading: ui.avatar(m.customer.name, { size: 36 }), title: m.customer.name, subtitle: m.match, chevron: true, onTap: () => guard('customers', 'openDetail', m.customer.id) }))))
        : ui.empty({ icon: 'magnifyingglass', title: 'No customers', text: 'Nothing matches “' + s + '”.' })); }
    const found = q.searchJobs(s, routeIds()).slice(0, 40), today = D.today(), groups = [['Today', j => j.day === today], ['Upcoming', j => j.day > today], ['Past', j => j.day < today]];
    box.replaceChildren(found.length ? ui.list(groups.map(([name, test]) => ui.section(name, found.filter(test).map(j => ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: fmt.day(j.day) + (j.allDay ? ' · note' : ' · stop ' + q.position(j).n) + ' · ' + q.routeName(j.routeId), trailing: icon(WD.jobStatuses[j.status].icon, 18, WD.jobStatuses[j.status].color), onTap: () => openDetails(j.id) })))))
      : ui.empty({ icon: 'magnifyingglass', title: 'No jobs', text: 'Nothing on your selected routes matches “' + s + '”.' }));
  }
  function run(p) { clearTimeout(timer); loading = text.trim().length >= 2; fill(p); if (loading) timer = setTimeout(() => { loading = false; fill(p); }, 300 + Math.random() * 350); }
  ui.sheet({ title: 'Search', live: false, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], onClose: () => clearTimeout(timer),
    search: { placeholder: 'Jobs, customers, phone, address', autofocus: true, onInput: (v, p) => { text = v; run(p); } },
    render(p) { box = h('div'); setTimeout(() => fill(p), 0);
      return [h('div.jb-seg', ui.segmented([{ value: 'jobs', label: 'Jobs' }, WD.can('crm.view') && { value: 'customers', label: 'Customers' }].filter(Boolean), scope, v => { scope = v; run(p); })), box]; } });
}

/* ================= AutoRoute ================= */
/* Reorders the remaining (unstarted, located) stops on a route's day list. The board has no clock times, so the result is a new order;
   AutoRoute simulates the day to respect office hours and requested windows (required windows are hard limits, preferred ones are soft). */
const DAY_START = 7 * 60 + 30;
/** Hard and soft windows for a stop, in minutes since midnight. */
function windowsOf(j) {
  const open = fmt.fromHHMM(j.bizOpen), close = fmt.fromHHMM(j.bizClose), from = fmt.fromHHMM(j.custFrom), until = fmt.fromHHMM(j.custUntil);
  const hard = { from: open != null ? open : 0, until: close != null ? close : 24 * 60 }, soft = null;
  if (j.custStrict) { if (from != null) hard.from = Math.max(hard.from, from); if (until != null) hard.until = Math.min(hard.until, until); return { hard, soft, open, close }; }
  return { hard, soft: from != null || until != null ? { from: from != null ? from : 0, until: until != null ? until : 24 * 60 } : null, open, close };
}
/** Walk an order from a start point and time. Returns legs with ETAs and window checks, total drive, finish time and a cost (drive + waiting + window penalties). */
function simulate(order, from, end) {
  let at = from.at, t = from.t, drive = 0, cost = 0; const legs = [];
  order.forEach(j => {
    const d = driveMin(at, j), w = windowsOf(j), est = j.type === 'purge' && j.purge && WD.purgeEstimate(j.purge), svc = est && est.minutes ? est.minutes : q.visitStats(j).median, arrive = t + d;
    const start = Math.max(arrive, w.hard.from), latest = w.hard.until - Math.min(svc, 15);
    const hardLate = Math.max(0, start - latest); let softOff = 0;
    if (w.soft) softOff = start < w.soft.from ? w.soft.from - start : start > w.soft.until ? start - w.soft.until : 0;
    drive += d; cost += d + (start - arrive) * 0.35 + (hardLate ? 600 + hardLate * 20 : 0) + softOff * (start > (w.soft ? w.soft.until : 0) ? 1.4 : 0.6);
    legs.push({ job: j, drive: d, arrive, start, svc, w, hardLate, softOff, stats: q.visitStats(j), est: est && est.minutes ? est : null });
    t = start + svc; at = j;
  });
  const back = driveMin(at, end); drive += back; cost += back;
  return { legs, drive, finish: t + back, cost, last: { at, t } };
}
/** Best order for `list` starting from `from`: several seeds, then relocate and swap moves until nothing improves. */
function optimize(list, from, end) {
  if (list.length < 2) return list.slice();
  const nn = () => { const left = list.slice(), out = []; let at = from.at; while (left.length) { left.sort((a, b) => driveMin(at, a) - driveMin(at, b)); at = left.shift(); out.push(at); } return out; };
  const edf = list.slice().sort((a, b) => windowsOf(a).hard.until - windowsOf(b).hard.until || windowsOf(a).hard.from - windowsOf(b).hard.from || driveMin(from.at, a) - driveMin(from.at, b));
  let best = null;
  [list.slice(), nn(), edf].forEach(seed => {
    let cur = seed, c = simulate(cur, from, end).cost, improved = true, guard = 0;
    while (improved && guard++ < 60) { improved = false;
      for (let i = 0; i < cur.length; i++) for (let k = 0; k < cur.length; k++) { if (i === k) continue;
        const a = cur.slice(), [x] = a.splice(i, 1); a.splice(k, 0, x); const ca = simulate(a, from, end).cost; if (ca < c - 0.01) { cur = a; c = ca; improved = true; }
        const b = cur.slice(); [b[i], b[k]] = [b[k], b[i]]; const cb = simulate(b, from, end).cost; if (cb < c - 0.01) { cur = b; c = cb; improved = true; } }
    }
    if (!best || c < best.c) best = { order: cur, c };
  });
  return best.order;
}
const winLabel = w => fmt.time(w.from).replace(':00', '') + '–' + fmt.time(w.until).replace(':00', '');
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function windowNote(l) {
  const w = l.w, hasHard = w.hard.from > 0 || w.hard.until < 24 * 60;
  if (l.job.needsWindow && !l.job.custFrom && !l.job.custUntil) return h('div.jb-win.soft', icon('clock', 13), 'Needs a window → they’ll be told ' + winLabel(WD.etaWindow(l.start)));
  if (l.hardLate) return h('div.jb-win.bad', icon('exclamationmark.triangle', 13), (l.job.custStrict ? 'Required ' : 'Open ') + winLabel(w.hard) + ' — can’t make it (ETA ' + fmt.time(l.start) + ')');
  if (w.soft && l.softOff) return h('div.jb-win.soft', icon('clock', 13), 'Prefers ' + winLabel(w.soft) + ' — ETA ' + fmt.time(l.start) + (l.start < w.soft.from ? ', early' : ', late') + '. Preference, not a requirement');
  if (w.soft) return h('div.jb-win.ok', icon('checkmark', 13), 'Prefers ' + winLabel(w.soft) + ' ✓');
  if (hasHard) return h('div.jb-win.ok', icon('checkmark', 13), (l.job.custStrict ? 'Required ' : 'Open ') + winLabel(w.hard) + ' ✓' + (l.start > l.arrive + 2 ? ' · waits ' + (l.start - l.arrive) + ' min' : ''));
  return null;
}
/** o: {day, routes (ids to choose from), stay (don't jump to the board after accepting, e.g. from the map)} */
async function openAutoRoute(routeId, o = {}) {
  const day = o.day || S.board.day, choices = o.routes ? o.routes.map(q.route).filter(Boolean) : q.visibleRoutes();
  if (!routeId && choices.length === 1) routeId = choices[0].id;
  if (!routeId) { routeId = await ui.actionSheet({ title: 'AutoRoute which route?', message: fmt.day(day, 'long'), buttons: choices.map(r => ({ label: q.routeName(r), value: r.id })) }); if (!routeId) return; }
  const route = q.route(routeId), all = q.stopList(routeId, day), todo = all.filter(j => j.status === 'scheduled' && !j.pending);
  const stops = todo.filter(j => j.located && j.x != null), unrouted = todo.filter(j => !stops.includes(j)), done = all.filter(j => ['enroute', 'arrived', 'completed', 'skipped'].includes(j.status) && j.located).pop();   // canceled / rescheduled / postponed stops were never visited
  const isToday = day === D.today(), stages = ['Driving times from Apple Maps', 'Time on site: median of each customer’s recorded visits', 'Office hours and requested windows'];
  let stage = 0, plan = null, pinnedAt = -1, view = 'after';
  /* Start time: for a day that hasn't started, AutoRoute recommends when to leave where the truck is parked so it reaches the first stop as it opens.
     The dispatcher accepts it or picks their own time; either is saved with the route's day. */
  const dayKey = routeId + '|' + day, pretrip = data.workflow.pretripMin, plansDepart = !done && !isToday;
  let depart = plansDepart ? (data.routeDays[dayKey] ? { ...data.routeDays[dayKey] } : { depart: DAY_START, manual: false }) : null;
  const ends = () => q.routeEnds(routeId, day), from = () => ({ at: done || ends().start, t: isToday ? Math.max(WD.nowMins(), DAY_START) : depart ? depart.depart + pretrip : DAY_START });
  /** Latest departure that still reaches the first stop when it opens (or at the usual opening time when it has no hours), after the pre-trip time. */
  function recommendDepart(order) {
    if (!order.length) return DAY_START;
    const l = simulate(order, { at: ends().start, t: 3 * 60 }, ends().end).legs[0], opens = l.w.hard.from > 0 ? l.w.hard.from : fmt.fromHHMM(data.workflow.normalOpen);
    return { t: Math.max(3 * 60, Math.floor((opens - l.drive - pretrip) / 15) * 15), opens, drive: l.drive, job: l.job };
  }
  function build(order, pinned) {
    const e = ends(), f = from(), sim = simulate(order, f, e.end), cur = simulate(stops, f, e.end);
    plan = { order, sim, cur, pinned: pinned == null ? -1 : pinned, rec: plansDepart && order.length ? recommendDepart(order) : null }; pinnedAt = plan.pinned;
  }
  const optimizeAll = () => {
    if (plansDepart && !depart.manual) for (let k = 0; k < 3; k++) { const r = recommendDepart(optimize(stops, from(), ends().end)); if (!r.t || r.t === depart.depart) break; depart.depart = r.t; }
    build(optimize(stops, from(), ends().end));
  };
  function startSection(page) {
    if (!plansDepart || !plan.rec) return null;
    const r = plan.rec, e = ends(), late = depart.manual && depart.depart > r.t, early = depart.manual && depart.depart < r.t;
    return ui.section({ header: 'Start time', footer: 'Recommended: leave ' + e.start.name + ' in time to reach ' + r.job.title + ' when it opens at ' + fmt.time(r.opens) + ' — ' + fmt.dur(r.drive) + ' of driving plus ' + pretrip + ' minutes to get rolling. ' + (late ? 'Leaving later pushes every stop back; check the ETAs below.' : early ? 'Leaving earlier means waiting at the first stop until it opens.' : 'Choose your own time if the driver needs to leave earlier or later.') },
      h('div.row', h('div.row-main', h('div.row-title', 'Leave ' + e.start.name), h('div.row-sub', depart.manual ? 'Your time · recommended ' + fmt.time(r.t) : 'Recommended')), h('div.jb-depart', fmt.time(depart.manual ? depart.depart : r.t))),
      h('div.row', h('div', { style: 'flex:1' }, ui.segmented([{ value: 'rec', label: 'Use recommended' }, { value: 'manual', label: 'Choose my own' }], depart.manual ? 'manual' : 'rec', v => { depart.manual = v === 'manual'; if (!depart.manual) depart.depart = r.t; optimizeAll(); page.refresh(); }))),
      depart.manual && ui.quarterRow({ title: 'Leave at', optional: false, value: hhmm(depart.depart), onChange: v => { depart.depart = fmt.fromHHMM(v); optimizeAll(); page.refresh(); } }));
  }
  /** Drag result: keep everything up to the moved stop as placed, re-optimize the stops after it. */
  function moveStop(i, to) {
    const order = plan.order.slice(), [j] = order.splice(i, 1); order.splice(to, 0, j);
    const head = order.slice(0, to + 1), after = simulate(head, from(), ends().end).last, rest = optimize(order.slice(to + 1), after, ends().end);
    build(head.concat(rest), to); const n = to + 1 + all.length - todo.length; ui.toast((n === 1 ? 'Kept stop 1' : 'Kept stops 1–' + n) + ' as placed · re-optimized the rest', 'sparkles', 2200);
  }
  const newList = () => [...all.filter(j => !todo.includes(j)), ...plan.order, ...unrouted];
  function changeEnds(el, page) {
    const r = route, v = q.vehicle(r.vehicleId); if (!v) return ui.toast('This route has no vehicle', 'truck');
    const key = v.id + '|' + day, cur = data.vehicleDays[key] || {}, e = ends();
    ui.menu(el, [{ header: v.name + ' on ' + fmt.day(day) }, ...data.places.map(p => ({ label: 'Start at ' + p.name, checked: e.start === p, onTap: () => { data.vehicleDays[key] = { ...cur, startId: p.id, endId: (data.vehicleDays[key] || {}).endId || v.endId }; optimizeAll(); page.refresh(); } })), 'divider',
      ...data.places.map(p => ({ label: 'End at ' + p.name, checked: e.end === p, onTap: () => { data.vehicleDays[key] = { ...(data.vehicleDays[key] || {}), startId: (data.vehicleDays[key] || {}).startId || v.startId, endId: p.id }; optimizeAll(); page.refresh(); } }))]);
  }
  function maps() {
    const e = ends(), f = from(), color = q.routeColor(route), mk = order => ({ aspect: 1, pad: 30,
      points: [{ x: f.at.x, y: f.at.y, cls: 'sq', icon: done ? 'checkmark' : 'house', style: { '--c': '#636366' } }, ...order.map((j, i) => ({ x: j.x, y: j.y, n: i + 1, style: WD.pinStyle(j) })), e.end !== f.at && { x: e.end.x, y: e.end.y, cls: 'sq', icon: 'flag', style: { '--c': '#636366' } }].filter(Boolean),
      lines: [{ pts: [f.at, ...order, e.end], color, width: 2.5 }] });
    return h('div.jb-maps', h('div', WD.miniMap({ ...mk(stops), caption: 'Before' }), h('div.cap', fmt.dur(plan.cur.drive) + ' driving')), h('div', WD.miniMap({ ...mk(plan.order), caption: 'After' }), h('div.cap', fmt.dur(plan.sim.drive) + ' driving')));
  }
  function startDrag(e, i, page) {
    e.preventDefault(); e.stopPropagation();
    const cells = e.currentTarget.closest('.cells'), rows = [...cells.querySelectorAll('.jb-ar')], line = h('div.jb-ins'); cells.style.position = 'relative'; cells.appendChild(line); rows[i].classList.add('jb-dragging');
    let target = i;
    const move = ev => { const p = ui.localPoint(ev, cells); let t = rows.findIndex(r => p.y < r.offsetTop + r.offsetHeight / 2); if (t < 0) t = rows.length; target = t;
      const y = t < rows.length ? rows[t].offsetTop : rows[rows.length - 1].offsetTop + rows[rows.length - 1].offsetHeight; line.style.top = (y - 1.5) + 'px';
      const sc = page.body, r = sc.getBoundingClientRect(); if (ev.clientY > r.bottom - 40) sc.scrollTop += 8; else if (ev.clientY < r.top + 40) sc.scrollTop -= 8; };
    const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); line.remove(); };
    const up = () => { stop(); const to = target > i ? target - 1 : target; if (to !== i) moveStop(i, to); page.refresh(); };
    const cancel = () => { stop(); page.refresh(); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel); move(e);
  }
  const sheet = ui.sheet({ title: 'AutoRoute', live: false, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => plan && plan.order.length ? [{ label: 'Accept', bold: true, onTap: async p => {
      const bad = plan.sim.legs.filter(l => l.hardLate);
      if (bad.length && !(await ui.actionSheet({ title: bad.length + (bad.length === 1 ? ' stop misses' : ' stops miss') + ' a required time', message: bad.map(l => l.job.title).join(', ') + '. Accept anyway, or keep adjusting the order.', buttons: [{ label: 'Accept anyway', value: true, role: 'destructive' }], cancel: 'Keep adjusting' }))) return;
      const order = plan.order, give = plan.sim.legs.filter(l => l.job.needsWindow && !l.job.custFrom && !l.job.custUntil).map(l => ({ j: l.job, w: WD.etaWindow(l.start) })), dep = depart && { depart: depart.depart, manual: depart.manual }, me = S.me.name;
      api.op({ kind: 'batch', title: q.routeName(route) + ' · AutoRoute', scope: order.length + ' jobs · all or nothing', jobIds: order.map(j => j.id), apply() { newList().forEach((j, i) => { j.seq = i + 1; }); order.forEach(j => j.events.push({ at: +WD.now(), actor: me, text: 'AutoRoute: moved to stop ' + j.seq }));
        if (dep) data.routeDays[dayKey] = dep;
        give.forEach(({ j, w }) => { Object.assign(j, { custFrom: hhmm(w.from), custUntil: hhmm(w.until), windowBy: 'us', custStrict: false, needsWindow: false, windowToSend: true }); j.events.push({ at: +WD.now(), actor: me, text: 'Window set by AutoRoute: ' + winLabel(w) }); }); } });
      p.dismiss(); ui.toast('Route accepted' + (dep ? ' · leave ' + fmt.time(dep.depart) : ''), 'checkmark', 2200); if (!o.stay) guard('board', 'show', day);
      if (give.length) setTimeout(async () => { const v = await ui.actionSheet({ title: give.length + (give.length === 1 ? ' customer gets a window' : ' customers get a window'), message: give.map(x => x.j.title + ' · ' + winLabel(x.w)).join('\n'), buttons: [{ label: 'Text them their window now', value: true }], cancel: 'Later' });
        if (v) { give.forEach(x => { x.j.windowToSend = false; }); ui.toast('Texts sent · ' + give.length, 'message'); WD.changed(); } }, 700);
    } }] : [],
    render(page) {
      if (!plan) return ui.list(ui.section({ header: q.routeName(route) + ' · ' + fmt.day(day), footer: 'Planning ' + stops.length + ' remaining stops' + (done ? ' from ' + done.title : ' from ' + ends().start.name) + '.' },
        stages.map((s, i) => h('div.jb-stage' + (i > stage ? '.wait' : ''), i < stage ? icon('checkmark.circle.fill', 22, 'var(--green)') : i === stage ? ui.spinner(20) : icon('circle', 22), s))));
      if (!plan.order.length) return ui.empty({ icon: 'route', title: 'Nothing to route', text: 'There are no unstarted, located jobs left on this route for ' + fmt.day(day) + '.' });
      const saved = plan.cur.drive - plan.sim.drive, e = ends(), base = all.length - todo.length, misses = plan.sim.legs.filter(l => l.hardLate).length, curMiss = plan.cur.legs.filter(l => l.hardLate).length, onSite = plan.sim.legs.reduce((s, l) => s + l.svc, 0);
      return ui.list(
        ui.section(null, h('div.jb-plan', h('div.caption', q.routeName(route) + ' · ' + fmt.day(day, 'long')), h('div.big', fmt.dur(plan.sim.drive) + ' driving'),
          h('div.subhead', saved > 0 ? h('span.save', 'Saves ' + fmt.dur(saved)) : h('span.secondary', saved < 0 ? fmt.dur(-saved) + ' more driving, to meet time windows' : 'Same driving as now'), h('span.secondary', ' · ' + plan.order.length + ' stops · ~' + fmt.dur(onSite) + ' on site · back about ' + fmt.time(plan.sim.finish))),
          misses ? h('div.jb-win.bad', { style: 'margin-top:6px' }, icon('exclamationmark.triangle', 14), misses + (misses === 1 ? ' required time can’t be met' : ' required times can’t be met')) : curMiss ? h('div.jb-win.ok', { style: 'margin-top:6px' }, icon('checkmark', 14), 'Fixes ' + curMiss + (curMiss === 1 ? ' stop' : ' stops') + ' the current order would reach outside its hours') : null),
          h('div.jb-ends', icon('truck', 15), h('span', 'Starts ' + (done ? 'after ' + done.title : 'at ' + e.start.name + (depart ? ' · leaves ' + fmt.time(depart.depart) : '')) + ' · ends at ' + e.end.name), h('button', { onclick: ev => changeEnds(ev.currentTarget, page) }, 'Change')),
          maps()),
        startSection(page),
        ui.section({ header: h('div.cu-sechead', h('span', 'Proposed order'), pinnedAt >= 0 && h('button.cu-link', { onclick: () => { optimizeAll(); page.refresh(); } }, 'Re-optimize all')),
          footer: 'Drag ≡ to move a stop. Stops before it stay as you placed them and everything after it is re-optimized. Time on site is the median of recorded visits, so one unusually long visit doesn’t skew it. Office hours and required windows are never broken on purpose; preferred windows are met when possible. Accepting reorders every job together or none of them.' },
          plan.sim.legs.map((l, i) => { const j = l.job, n = base + i + 1, was = q.position(j).n, label = WD.itemsLabel(j.items, j.type === 'purge');
            const row = ui.row({ class: 'jb-ar', leading: h('div.jb-num', { style: WD.pinStyle(j) }, n),
              title: h('span', j.title, label && h('span.jb-qty', label), i <= pinnedAt && i === pinnedAt ? h('span.jb-pin', 'MOVED') : null),
              subtitle: h('div', h('div', ['ETA ' + fmt.time(l.start), n !== was ? 'was stop ' + was : 'same place', l.drive + ' min drive', l.est ? '~' + l.svc + ' min on site (' + l.est.billable + ' boxes' + (l.est.guess ? ', rough count' : '') + ')' : '~' + l.svc + ' min on site (median of ' + l.stats.n + ')'].join(' · ')), windowNote(l)),
              trailing: h('span.jb-grip', { 'aria-label': 'Reorder', onpointerdown: ev => startDrag(ev, i, page) }, icon('line.3', 20)) });
            return row; })),
        unrouted.length > 0 && ui.section({ header: 'Not routed', footer: 'These move to the end of the list. Stops without a confirmed address never get routing coordinates.' },
          unrouted.map(j => ui.row({ leading: h('span.jb-q', { style: 'font-size:20px;width:26px;text-align:center' }, j.address ? '?' : '–'), title: j.title, subtitle: j.address ? 'Address not found: ' + j.address : 'No address' }))));
    } });
  const page = sheet.stack.top();
  for (stage = 0; stage < stages.length; stage++) { page.refresh(); await WD.delay(550, 850); }
  optimizeAll(); if (page.el.isConnected) page.refresh();
}

WD.addressSuggestions = addressSuggestions;
WD.screens.jobs = { openDetails, openEditor, openReassign, openSearch, openAutoRoute, skipFlow, callOff };
const firstToday = pred => data.jobs.filter(j => j.day === D.today() && !j.allDay && pred(j)).sort(q.order)[0];
WD.panel.addJump('Job details', () => { WD.nav.switchTab('board'); const j = firstToday(x => x.status === 'arrived') || firstToday(() => true); if (j) openDetails(j.id); });
WD.panel.addJump('New job', () => { WD.nav.switchTab('board'); openEditor({ day: D.today(), routeId: 'r1' }); });
WD.panel.addJump('Search', () => { WD.nav.switchTab('board'); openSearch(); });
WD.panel.addJump('AutoRoute', () => { let day = D.add(D.today(), 1); while ([0, 6].includes(D.parse(day).getDay())) day = D.add(day, 1); guard('board', 'show', day); openAutoRoute('r1', { day }); });
})();
