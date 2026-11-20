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
.jb-steps .btn { flex: 1 1 0; min-width: 0; min-height: 46px; border-radius: 11px; font-size: 16px; padding: 0 6px; gap: 5px; white-space: nowrap; }
.jb-done { padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 15px; letter-spacing: -.24px; }
.jb-done .spacer { flex: 1; }
.jb-done button { border: 0; background: none; color: var(--tint); font-size: 15px; cursor: pointer; padding: 0 4px; min-width: 44px; min-height: 44px; margin: -8px -4px -8px 0; }.jb-notes { padding: 11px 16px; font-size: 16px; line-height: 21px; white-space: pre-wrap; user-select: text; -webkit-user-select: text; }
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
.jb-grip { flex: none; width: 44px; height: 44px; margin: -5px -12px -5px -4px; display: grid; place-items: center; color: var(--label3); cursor: grab; touch-action: none; }
.jb-ar.jb-dragging { opacity: .35; }
.jb-ins { position: absolute; left: 12px; right: 12px; height: 3px; border-radius: 2px; background: var(--tint); z-index: 5; pointer-events: none; }
.jb-pin { font-size: 12px; font-weight: 700; color: var(--tint); margin-left: 6px; }
.jb-maps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px 12px 12px; }
.jb-maps .cap { font-size: 12px; color: var(--label2); text-align: center; margin-top: 4px; letter-spacing: 0; }
.jb-depart { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--tint); }
.jb-est { background: color-mix(in srgb, var(--yellow) 12%, var(--cell)); }
.jb-ends { display: flex; gap: 8px; align-items: center; padding: 0 16px 12px; font-size: 13px; color: var(--label2); flex-wrap: wrap; }
.jb-ends button { border: 0; background: var(--fill3); color: var(--tint); border-radius: 14px; padding: 4px 10px; font-size: 13px; cursor: pointer; position: relative; }
.jb-ends button::after { content: ''; position: absolute; left: -6px; right: -6px; top: 50%; height: 44px; transform: translateY(-50%); }
.row.jb-item { gap: 10px; }
.jb-item .row-main { flex: 1; }
.jb-rate { width: 78px; min-height: 44px; border: 0; background: var(--fill3); border-radius: 7px; padding: 6px 8px; font-size: 15px; text-align: right; color: var(--label); outline: 0; font-variant-numeric: tabular-nums; }
.jb-count { width: 58px; min-height: 44px; border: 0; background: var(--fill3); border-radius: 7px; padding: 6px 8px; font-size: 15px; text-align: right; color: var(--label); outline: 0; }
.jb-qn { min-width: 22px; text-align: right; font-variant-numeric: tabular-nums; font-size: 16px; }
.jb-rec .row-detail { color: var(--tint); }
.row.jb-days { display: block; padding-top: 10px; padding-bottom: 10px; }
.jb-dayrow { display: flex; gap: 6px; margin-top: 8px; }
.jb-day { border: 0; flex: 1 1 0; min-width: 44px; height: 44px; border-radius: 9px; background: var(--fill3); color: var(--label); font-size: 15px; cursor: pointer; padding: 0; }
.jb-day.on { background: var(--red); color: #fff; font-weight: 600; }
`);
WD.addIcons({ 'line.3': '<path d="M5 8h14M5 12h14M5 16h14"/>' });

/* Card-on-file jobs are billed automatically once the stop is completed (MIGRATION.md §12). */
const baseSetStatus = api.setStatus;
api.setStatus = (jobId, status, note) => {
  const op = baseSetStatus(jobId, status, note), job = q.job(jobId);
  if (status === 'completed' && job && WD.cardJob(job) && !job.invoice) setTimeout(() => {
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
  /* Ordered for the driver: status and Complete, then where to go and who to call, then notes and the rest.
     Edit stays in the bar; Edit, Reassign and Canceled are rows near the bottom, and Delete is the very last row. */
  const acts = p => { const job = q.job(jobId), route = job && q.route(job.routeId); if (!job || !(WD.can('jobs.edit') && route && route.writable)) return [];
    return [{ label: 'Edit', disabled: job.pending, onTap: () => openEditor({ jobId: job.id }) }]; };
  ui.sheet({ title: 'Job details', leading: acts, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
    render(p) { const job = q.job(jobId); if (!job) { setTimeout(() => p.dismiss(), 0); return null; } return details(job, p); } });
}
function details(job, p) {
  const route = q.route(job.routeId), type = q.jobType(job.type), st = WD.jobStatuses[job.status], canEdit = WD.can('jobs.edit') && route && route.writable;
  const driver = q.driverFor(job.routeId), vehicle = route && q.vehicle(route.vehicleId), cust = q.customer(job.customerId), unresolved = !job.located && job.address && job.type !== 'meet';
  const line = (ic, ...kids) => h('div.jb-line', icon(ic, 18), h('span', kids)), wf = WD.workflow;
  const head = h('div.jb-head',
    h('div.title2', unresolved && h('span.jb-q', '?'), h('span', { style: WD.struck[job.status] ? { textDecoration: 'line-through' } : null }, job.title)),
    h('div.jb-badges', ui.badge(st.title, st.color), type.color && ui.badge(type.title, type.color), job.pending && ui.badge('Pending sync', 'var(--orange)'), !WD.closed[job.status] && WD.addressIssue(job) && ui.badge(WD.addressIssue(job), 'var(--red)'), job.status === 'completed' && !wf.billed(job) && ui.badge('Not billed', 'var(--orange)'), job.destruction && job.destruction.status === 'pending' && ui.badge('Destruction not yet confirmed', 'var(--orange)'), job.destruction && job.destruction.status === 'confirmed' && ui.badge('Destroyed ' + fmt.day(job.destruction.day, 'md'), 'var(--green)')),
    (d => d.length ? h('div.wf-chips', d.map(x => h('span.wf-chip', x))) : null)(wf.titleDetails(job)),
    h('div.jb-line', ui.dot(q.routeColor(route)), h('span', q.routeName(route) + (driver ? ' · ' + driver.name : '') + (vehicle ? ' · ' + vehicle.name : ''))),
    line('calendar', fmt.day(job.day, 'long')),
    line('list.bullet', job.allDay ? 'Note for the day (not a stop)' : WD.calledOff(job) ? 'Not on the stop list, the map or AutoRoute' + (job.rescheduledTo ? ' · moved to ' + fmt.day(job.rescheduledTo) : '') : (p => 'Stop ' + p.n + ' of ' + p.of + ' on the list')(q.position(job))),
    job.offWindow && !WD.closed[job.status] && line('exclamationmark.triangle', 'Outside its time window: ' + job.offWindow),
    job.recurring && line('repeat', job.recurring.rule),
    WD.staff && WD.staff.jobAudit && WD.staff.jobAudit(job));

  const setStatus = (s, note) => api.setStatus(job.id, s, note);
  const skip = () => skipFlow(job);
  let steps = null;
  if (!job.allDay) {
    const b = (label, kind, fn, ic) => ui.button(label, { kind, icon: ic, block: false, onTap: fn }), complete = b('Complete', 'filled', () => wf.completeStop(job), 'checkmark'), arriveBtn = data.workflow.arrival !== 'auto';
    /* Three equal buttons on one line each: “Start driving” is shortened to “Drive” so it never wraps beside Complete and Skip. */
    if (job.status === 'scheduled') steps = h('div.jb-steps', (d => { d.setAttribute('aria-label', 'Start driving'); return d; })(b('Drive', 'tinted', () => { setStatus('enroute'); WD.co && WD.co.onMyWay(job); }, 'truck')), complete, b('Skip…', 'gray', skip));
    else if (job.status === 'enroute') steps = h('div.jb-steps', arriveBtn && b('Arrived', 'tinted', () => setStatus('arrived'), 'mappin'), complete, b('Skip…', 'gray', skip));
    else if (job.status === 'arrived') steps = h('div.jb-steps', complete, b('Skip…', 'gray', skip));
    else steps = h('div.jb-done', icon(st.icon, 22, st.color), h('span', job.status === 'completed' && job.arrivedAt != null ? 'Arrived ' + fmt.time(job.arrivedAt) + ' · left ' + fmt.time(job.departedAt) + ' · ' + fmt.dur(Math.max(1, job.departedAt - job.arrivedAt)) + ' on site' : st.title + (job.rescheduledTo ? ' to ' + fmt.day(job.rescheduledTo) : '') + (job.skipNote ? ' · ' + job.skipNote : '')), h('span.spacer'), h('button', { onclick: () => setStatus('scheduled') }, 'Reopen'));
  }
  const contact = cust && cust.contacts[0], hasPO = !!job.po || !!(cust && cust.poSchedule && cust.poSchedule.length), idle = !job.pending;
  return ui.list(
    ui.section(null, head, steps),
    /* Where to go and who to call sit directly under the Complete buttons. */
    job.address && ui.section({ header: 'Location', footer: unresolved ? 'Apple Maps could not find this address, so the stop has no pin and is left out of routing. Edit the job to fix it.' : null },
      ui.row({ title: job.address, icon: 'mappin', iconPlain: true, iconColor: unresolved ? 'var(--red)' : 'var(--label2)',
        trailing: h('span.row-acts', ui.iconBtn('arrow.triangle.turn.up.right', 'Directions in ' + wf.mapsName(), () => wf.openDirections(job)), job.located && ui.iconBtn('map', 'Show on map', () => { p.dismiss(); setTimeout(() => guard('map', 'focusJob', job.id), 350); })) })),
    !job.address && !job.allDay && WD.addressIssue(job) && ui.section({ header: 'Location', footer: job.addrIgnored ? 'Marked as not needing an address for now.' : 'Saved without ' + (data.addressRules[job.type] === 'cityzip' ? 'a city or ZIP' : 'an address') + '. It can’t be mapped or routed until one is added.' },
      ui.row({ title: WD.addressIssue(job), icon: 'mappin', iconPlain: true, iconColor: 'var(--red)', detail: canEdit && !job.pending ? 'Add' : null, tint: false, onTap: canEdit && !job.pending ? () => openEditor({ jobId: job.id }) : null })),
    !job.address && job.cityZip && ui.section('Location', ui.row({ title: job.cityZip, subtitle: 'Where the customer is coming from', icon: 'mappin', iconPlain: true, iconColor: 'var(--label2)' })),
    cust && ui.section('Customer',
      ui.row({ leading: ui.avatar(cust.name, { size: 36, icon: cust.kind === 'household' ? 'house' : 'building' }), title: cust.name, subtitle: contact ? contact.name + (contact.role ? ' · ' + contact.role : '') + ' · ' + fmt.phone(contact.phone, contact.ext) : null, onTap: WD.can('crm.view') ? () => guard('customers', 'openDetail', cust.id) : null,
        trailing: contact && h('span.row-acts', ui.iconBtn('phone', 'Call ' + contact.name, () => ui.toast('Calling ' + contact.name + ' via Quo…', 'phone')), ui.iconBtn('message', 'Send a text', () => ui.toast('Opening a text to ' + contact.name + '…', 'message'))) })),
    !cust && job.phone && ui.section('Contact', ui.row({ title: fmt.phone(job.phone, job.ext), subtitle: job.contactName || null, icon: 'phone', iconPlain: true, tint: true, onTap: () => ui.toast('Calling via Quo…', 'phone') })),
    job.notes && ui.section('Notes', h('div.jb-notes', job.notes)),
    WD.co && WD.co.jobScanSection(job, () => p.refresh(), canEdit || WD.can('billing.field')),
    WD.x.jobAgreementSection(job, s => p.push(s)),
    ui.section('Service',
      ui.row({ title: 'Job type', trailing: h('span.hstack.secondary', type.color && ui.dot(type.color), type.title) }),
      !job.allDay && ui.row({ title: 'Customer type', detail: WD.custType(cust ? cust.custType : job.custType).title }),
      (job.items && job.items.length ? ui.row({ title: job.type === 'purge' ? 'Estimated boxes' : 'Containers', detail: WD.itemsLabel(job.items, job.type === 'purge') }) : job.containers && ui.row({ title: 'Containers', detail: job.containers })),
      job.bizOpen && ui.row({ title: 'Office hours', detail: fmt.time(fmt.fromHHMM(job.bizOpen)) + ' – ' + fmt.time(fmt.fromHHMM(job.bizClose)) }),
      job.lunchFrom && ui.row({ title: 'Closed for lunch', detail: fmt.time(fmt.fromHHMM(job.lunchFrom)) + ' – ' + fmt.time(fmt.fromHHMM(job.lunchUntil)) }),
      job.closedDays && job.closedDays.length > 0 && ui.row({ title: 'Closed', detail: job.closedDays.join(', ') }),
      (job.custFrom || job.custUntil) && ui.row({ title: job.windowBy === 'us' ? 'Window we gave them' : 'Window they asked for', subtitle: job.custStrict ? 'Required — must be done in this window' : 'Preferred — fit it in if possible', detail: windowText(job) }),
      job.needsWindow && !job.custFrom && ui.row({ title: 'Time window', subtitle: 'They want one but don’t mind when. AutoRoute gives them one when the route is finalized.', detail: h('span', { style: 'color:var(--orange);font-weight:600' }, 'Needs window') }),
      job.callAhead > 0 && ui.row({ title: 'Call ahead', detail: (job.callAhead === 60 ? '1 hour' : job.callAhead + ' min') + ' before arriving' }),
      job.type === 'purge' && job.purge && (e => e.boxes > 0 && ui.row({ title: 'Estimated time on site', subtitle: WD.PURGE_UNITS.filter(([id]) => job.purge[id]).map(([id, t]) => job.purge[id] + ' ' + t.toLowerCase()).join(', ') + (job.purge.stairs && job.purge.stairs !== 'none' ? ' · stairs ' + job.purge.stairs : '') + (job.purge.haul ? ' · haul away empties' : '') + (e.guess ? ' · rough count' : ''), detail: e.guess ? e.low + '–' + e.high + ' min' : e.minutes + ' min' }))(WD.purgeEstimate(job.purge)),
      /* hasPO is a real boolean: `job.po || schedule.length` used to come out as the number 0, which printed as a stray “0” row. */
      hasPO && ui.row({ title: 'PO number', subtitle: cust && cust.poSchedule && cust.poSchedule.length ? 'From the PO schedule for ' + fmt.day(job.day, 'md') : null, detail: job.po || 'None' }),
      cust && wf.poAlert(cust, job.day) && wf.alertRow(wf.poAlert(cust, job.day)), job.contract && ui.row({ title: 'Contract', detail: job.contract })),
    WD.biz && WD.biz.jobSections(job, () => p.refresh()),
    ui.section('Attachments', job.attachments.map(a => attachmentRow(a)),
      ui.row({ title: 'Add photo or file', icon: 'paperclip', iconPlain: true, tint: true, onTap: () => addAttachment(job.attachments) })),
    (WD.can('billing.view') || WD.can('billing.field')) && !job.allDay && !WD.struck[job.status] && WD.screens.billing && ui.section({ header: 'Billing', footer: job.invoice || job.billing ? null : job.status === 'completed' ? 'This stop is completed but not billed. It stays bright on the board until it is.' : 'Nothing is sent until you review the charges.' }, WD.screens.billing.billingRows(job)),
    ui.section({ header: 'History', fold: true, folded: true, footer: 'Shows who did what. Tap an edit to see exactly what changed. ' + (S.googleMirror.enabled && route ? 'Copied to the ' + route.name + ' Google calendar a few seconds after each change syncs. ' : '') + 'Version ' + job.version + '.' },
      job.events.slice().reverse().map(e => ui.row({ leading: ui.avatar(e.actor, { size: 28 }), title: e.text + (e.changes && e.changes.length ? ' · ' + e.changes.length + (e.changes.length === 1 ? ' change' : ' changes') : ''), subtitle: e.actor + ' · ' + fmt.rel(e.at) + (e.changes && e.changes.length ? ' · ' + e.changes.map(c => c.label).slice(0, 3).join(', ') : ''), chevron: !!(e.changes && e.changes.length), onTap: e.changes && e.changes.length ? () => WD.x.showChanges(e) : null }))),
    canEdit && ui.section({ header: 'Change this job', footer: job.pending ? 'This job is waiting to sync. You can change it again once that finishes.' : null, fold: false },
      ui.row({ title: 'Edit job', icon: 'pencil', iconPlain: true, tint: true, disabled: !idle, onTap: idle ? () => openEditor({ jobId: job.id }) : null }),
      ui.row({ title: 'Reassign', icon: 'arrow.left.arrow.right', iconPlain: true, tint: true, disabled: !idle, onTap: idle ? () => openReassign(job) : null }),
      !job.allDay && !WD.closed[job.status] && ui.row({ title: 'Customer canceled or rescheduled…', icon: 'phone', iconPlain: true, tint: true, disabled: !idle, onTap: idle ? () => callOff(job) : null })),
    canEdit && ui.section({ fold: false }, ui.row({ title: 'Delete job', icon: 'trash', iconPlain: true, iconColor: 'var(--red)', destructive: true, disabled: !idle, onTap: idle ? () => deleteJob(job, p) : null })));
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
      if (WD.r11 && !(await WD.r11.checkAssign([job], to, job.day))) return;
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
const driveMin = (a, b) => Math.round((Math.hypot(a.x - b.x, a.y - b.y) * 0.05 + 3) * (data.workflow.speedPct || 100) / 100);
/** Best places to add a located job: the cheapest insertion into each route's day (purge jobs also look at the next working days). */
function recommend(f, job) {
  if (f.x == null || !f.located || f.allDay) return [];
  const days = [f.day]; if (f.type === 'purge') { let d = f.day; while (days.length < 6) { d = D.add(d, 1); if (D.parse(d).getDay() !== 0) days.push(d); } }
  const out = [];
  days.forEach(day => q.routes().filter(r => r.writable).forEach(r => {
    const list = q.stopList(r.id, day).filter(j => j !== job && !WD.calledOff(j)), ends = q.routeEnds(r.id, day), chain = [ends.start, ...list.filter(j => j.located && j.x != null), ends.end];
    const locked = list.reduce((n, j, k) => !WD.calledOff(j) && !['scheduled', 'enroute'].includes(j.status) ? k + 1 : n, 0);
    let best = null;
    for (let i = 0; i < chain.length - 1; i++) { const a = chain[i], b = chain[i + 1], add = driveMin(a, f) + driveMin(f, b) - driveMin(a, b); const after = i === 0 ? null : a, idx = after ? list.indexOf(after) + 1 : 0;
      if (idx < locked) continue; if (!best || add < best.add) best = { add: Math.max(1, add), idx, after, near: driveMin(a, f) < driveMin(f, b) ? (i ? a : null) : (i + 1 < chain.length - 1 ? b : null) }; }
    if (best) out.push({ route: r, day, ...best, count: list.length, score: best.add + list.length * 1.2 + (r.id === 'r4' && f.type === 'purge' ? -4 : 0) + D.diff(day, f.day) * 1.5 });
  }));
  return out.sort((a, b) => a.score - b.score).slice(0, f.type === 'purge' ? 4 : 3);
}
/** Simulated Apple Maps suggestions. Keeps whatever city was typed — the real app searches Apple Maps, which finds any address. */
const titleCase = t => t.replace(/\b\w/g, m => m.toUpperCase());
const STREETS = ['Main St', 'Maple Ave', 'Market St', 'Madison Ave', 'Magnolia Dr', 'Mill Rd', 'Oak St', 'Oakwood Dr', 'Orchard Rd', 'Park Ave', 'Pine St', 'Pecan St', 'Elm St', 'Evergreen Ter', 'Cedar Ln', 'Congress Ave', 'Commerce St', 'Church St', 'Center St', 'Lake Shore Dr', 'Lamar Blvd', 'Lincoln Ave', 'Washington St', 'Walnut St', 'Willow Way', 'Highland Ave', 'Harbor Way', 'Hill Country Rd', 'Broadway', 'Burnet Rd', 'River Rd', 'Riverside Dr', 'Sunset Blvd', 'Spring St', 'State St', 'Industrial Blvd', 'First St', 'Second St', 'Third St', 'Fourth St', 'Fifth St', 'Franklin St', 'Jefferson St', 'Juniper Ct', 'Airport Blvd', 'Dogwood Ln', 'Grant St', 'Kings Hwy', 'North Loop', 'Quarry Rd', 'Technology Dr', 'Union St', 'Valley View Dr', 'Vine St', 'Young St', 'Zilker Rd'];
function addressSuggestions(text) {
  const t = text.trim(), s = t.toLowerCase(); if (s.length < 2) return [];
  const [street, ...rest] = t.split(','), city = rest.join(',').trim();
  const known = data.customers.flatMap(c => c.locations.map(l => ({ title: l.address.split(',')[0], sub: c.name + ' · ' + (l.address.split(',')[1] || '').trim(), address: l.address, l }))).filter(x => x.address.toLowerCase().includes(s.split(',')[0].trim()) || x.sub.toLowerCase().includes(s));
  const spot = a => { let n = 7; for (const ch of a.toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return { x: 120 + n % 760, y: 120 + (n >>> 9) % 760 }; };
  /* Complete what was typed, the way Apple Maps does: “123 ma” offers 123 Main St, 123 Maple Ave… */
  const m = /^(\d+[a-z]?)(?:\s+(.*))?$/i.exec(street.trim()), num = m ? m[1] + ' ' : '', name = (m ? m[2] || '' : street.trim()).toLowerCase(), cities = city ? [titleCase(city)] : ['Lakemont'];
  let made = STREETS.filter(x => x.toLowerCase().startsWith(name) || (name.length > 2 && x.toLowerCase().includes(name))).slice(0, 5).flatMap(x => cities.map(c => { const address = num + x + ', ' + c; return { title: num + x, sub: c + (city ? '' : ' · near you'), address, l: spot(address) }; }));
  if (!made.length && /\d/.test(street)) { const st = titleCase(street.trim()) + (/\b(st|street|ave|avenue|blvd|rd|road|dr|drive|ln|lane|way|ct|court|pkwy|hwy)\b/i.test(street) ? '' : ' St'); made = (city ? [titleCase(city)] : ['Lakemont', 'North Lakemont']).map((c, i) => ({ title: st, sub: c + (i || city ? '' : ' · near you'), address: st + ', ' + c, l: spot(st + ', ' + c) })); }
  return [{ title: 'Use “' + t + '”', sub: 'Exactly as typed', address: t, typed: true }].concat(known.slice(0, 4), made).slice(0, 10);
}
/* Hard drives: scanning each drive's barcode or serial number is decided job by job; the company default is in Settings → Barcode scanning. */
const hddDefault = () => !!(data.settings && data.settings.barcodes && data.settings.barcodes.hddDefault), hddRate = () => (data.priceBook.find(x => x.id === 'hdd') || { rate: 10 }).rate;
function openEditor(o = {}) {
  const job = o.jobId ? q.job(o.jobId) : null, isNew = !job;
  const f = job ? { title: job.title, address: job.address, notes: job.notes, routeId: job.routeId, day: job.day, allDay: job.allDay, pos: (p => p.n < p.of ? p.n : 0)(q.position(job)), dur: job.dur, type: job.type, items: WD.copyItems(job.items), bizOpen: job.bizOpen, bizClose: job.bizClose, custFrom: job.custFrom, custUntil: job.custUntil, custStrict: !!job.custStrict, customerId: job.customerId, located: job.located, x: job.x, y: job.y, po: job.po || '', contract: job.contract || '', contact: job.contactName || '', phone: job.phone ? fmt.phone(job.phone) : '', ext: job.ext || '', email: job.email || '', billingEmail: '', custType: job.custType || 'business', cityZip: job.cityZip || '', sig: WD.sigPolicy(q.customer(job.customerId)), windowBy: job.windowBy || 'customer', lunchFrom: job.lunchFrom || '', lunchUntil: job.lunchUntil || '', closedDays: (job.closedDays || []).slice(), callAhead: job.callAhead || 0, needsWindow: !!job.needsWindow, purge: job.purge ? { ...job.purge } : null, flags: { ...(job.flags || {}) }, hdd: ((job.items || []).find(i => i.id === 'hdd') || {}).qty || 0, hddScan: job.hddScan != null ? job.hddScan : hddDefault(), ...parseRule(job.recurring && job.recurring.rule) }
    : { title: '', address: '', notes: '', routeId: o.routeId || (q.visibleRoutes()[0] || q.routes()[0]).id, day: o.day || S.board.day, allDay: false, pos: o.pos || 0, dur: 30, type: o.type || 'purge', items: (o.type || 'purge') === 'purge' ? [{ id: 'box', qty: 0, rate: 8 }] : [], bizOpen: '', bizClose: '', custFrom: '', custUntil: '', custStrict: false, customerId: null, located: false, x: null, y: null, po: '', contract: '', contact: '', phone: '', ext: '', email: '', billingEmail: '', custType: (o.type || 'purge') === 'government' ? 'government' : 'business', cityZip: '', sig: 'optional', windowBy: 'customer', lunchFrom: '', lunchUntil: '', closedDays: [], callAhead: 0, needsWindow: false, purge: null, flags: {}, repeat: 'none', interval: 1 };
  Object.assign(f, { ends: 'never', count: 10, until: D.add(f.day, 90), attachments: [], poSchedule: [] }); if (f.hdd == null) Object.assign(f, { hdd: 0, hddScan: hddDefault() });
  if (WD.r11) WD.r11.editorInit(f, job);
  const poSt = { multi: false }, linked = () => q.customer(f.customerId), custTypeOf = () => (linked() ? linked().custType : f.custType) || 'business';
  /** The PO list being edited: the linked customer's schedule, or one kept in the form for a customer that doesn't exist yet. */
  const poList = () => linked() ? linked().poSchedule : f.poSchedule;
  if (f.type === 'purge' && !f.purge) { const b = (f.items.find(i => i.id === 'box') || {}).qty || 0; f.purge = { std: b, stairs: 'none', haul: false }; }
  let customCall = ![0, 15, 30, 60].includes(f.callAhead);
  const wasRecurring = f.repeat !== 'none';
  let page = null, matchBox = null, suggestBox = null, recBox = null, timer = null, dirty = false;
  const fill = c => { const l = c.locations[0], p = c.contacts[0] || {}; Object.assign(f, { customerId: c.id, title: c.name, address: l.address, notes: l.notes, type: WD.jobTypeFor(c), items: WD.copyItems(l.items), bizOpen: l.bizOpen, bizClose: l.bizClose, located: l.located !== false, x: l.x, y: l.y, po: WD.workflow.poFor(c, f.day).po, contract: c.contract || '', sig: WD.sigPolicy(c), lunchFrom: l.lunchFrom || '', lunchUntil: l.lunchUntil || '', closedDays: (l.closedDays || []).slice(), callAhead: l.callAhead || 0, contact: p.name || '', phone: p.phone ? fmt.phone(p.phone) : '', ext: p.ext || '', email: p.email || '', billingEmail: c.billingEmail || '', custType: c.custType || 'business' }); dirty = true; };
  if (isNew && o.customerId && q.customer(o.customerId)) fill(q.customer(o.customerId));
  /* Prefill for a new job from another screen (Price Calc, the planning map, a call): applied after the defaults and the customer, so it wins.
     o: {address, x, y, title, contactName, phone, email, notes, purge: {std: 20}, items: [...], price, banner, startAt}. Route and day stay editable. */
  if (isNew) {
    const pre = ['address', 'title', 'contactName', 'phone', 'email', 'notes', 'purge', 'items', 'price', 'banner'].some(k => o[k] != null && o[k] !== '');
    if (o.title) f.title = String(o.title);
    if (o.address) { f.address = String(o.address); const hit = addressSuggestions(f.address).find(x => !x.typed && x.address.toLowerCase() === f.address.trim().toLowerCase());
      if (o.x != null && o.y != null) Object.assign(f, { located: true, x: o.x, y: o.y }); else if (hit && hit.l && hit.l.x != null) Object.assign(f, { located: true, x: hit.l.x, y: hit.l.y }); else Object.assign(f, { located: /\d/.test(f.address), x: null, y: null }); }
    if (o.contactName) f.contact = String(o.contactName);
    if (o.phone) f.phone = fmt.phoneValid(o.phone) ? fmt.phone(o.phone) : String(o.phone);
    if (o.email) f.email = String(o.email);
    if (o.notes) f.notes = [f.notes, String(o.notes)].filter(Boolean).join('\n');
    if (o.purge) { if (!o.type) f.type = 'purge'; f.purge = { std: 0, stairs: 'none', haul: false, ...(f.purge || {}), ...o.purge }; if (f.type === 'purge' && !f.items.some(i => i.id === 'box')) f.items = f.items.concat({ id: 'box', qty: 0, rate: (data.priceBook.find(x => x.id === 'box') || { rate: 8 }).rate }); }
    if (Array.isArray(o.items)) f.items = WD.copyItems(o.items);
    if (o.price != null && o.price !== '') f.estTotal = o.price;
    if (o.banner) f.banner = String(o.banner);
    if (f.type === 'purge' && !f.purge) f.purge = { std: (f.items.find(i => i.id === 'box') || {}).qty || 0, stairs: 'none', haul: false };
    if (pre) dirty = true;
  }
  /* Calendar scheduling (Settings → Scheduling style): every job has a start time. An exact-time job starts at its exact time. */
  const cal = () => !!(WD.r14 && WD.r14.calendar && WD.r14.calendar()), ops2 = () => WD.ops2 || {};
  f.startAt = job ? job.startAt || job.exactAt || '' : o.startAt || '';
  const planMin = () => f.type === 'purge' && f.purge ? WD.purgeEstimate(f.purge).minutes || f.dur : f.durOverride || f.dur;
  /* Hard drive crusher: switched on by itself when drives are added and that day's truck can't shred them (WD.ops2.crusher). Once a person
     changes the switch, their choice is kept; an existing job that already has drives is treated as decided. */
  let crusherAuto = !!f.crusher, crusherManual = !!(job && f.hdd > 0);
  const crusherTouched = () => { if (!!f.crusher !== crusherAuto) crusherManual = true; };
  const syncCrusher = () => { crusherTouched(); const c = ops2().crusher ? ops2().crusher(f.routeId, f.day) : null; if (f.hdd <= 0) { f.crusher = crusherAuto = false; crusherManual = false; return c; }
    if (c && !crusherManual) f.crusher = crusherAuto = !!c.need; return c; };
  const crusherText = c => !c ? '' : c.offsite ? c.text : !!f.crusher === !!c.need ? c.text : c.need ? c.truck + ' can’t shred hard drives and no crusher is going' : 'A crusher is going anyway · ' + c.truck + ' shreds hard drives on site';
  /** Rebuild the page but keep the control that was tapped exactly where it is on screen, even when rows appear or go away above it. */
  const stay = key => { const sel = '[data-k="' + key + '"]', a = page.body.querySelector(sel), y = a && a.getBoundingClientRect().top; page.refresh(); const b = page.body.querySelector(sel); if (a && b) page.body.scrollTop += (b.getBoundingClientRect().top - y) / (WD.scale ? WD.scale() : 1); };
  /** A count with a field and − / + that updates itself in place: tapping several times in a row never rebuilds the page, so nothing pauses or moves.
      after(value, was) updates whatever depends on the count. Returns [field, stepper]. */
  const liveCount = (get, set, min, max, label, after) => {
    const put = v => { const was = get(); v = Math.min(max, Math.max(min, isNaN(v) ? min : v)); field.value = String(v); if (v === was) return; set(v); dirty = true; minus.disabled = v <= min; plus.disabled = v >= max; after && after(v, was); };
    const field = h('input.numfield', { type: 'text', inputmode: 'numeric', 'aria-label': label, value: String(get()), onfocus: e => e.target.select(), onkeydown: e => { if (e.key === 'Enter') e.target.blur(); }, onchange: e => put(parseInt(e.target.value.replace(/\D/g, ''), 10)) });
    const minus = h('button', { 'aria-label': 'One fewer: ' + label, disabled: get() <= min, onclick: () => put(get() - 1) }, '−'), plus = h('button', { 'aria-label': 'One more: ' + label, disabled: get() >= max, onclick: () => put(get() + 1) }, '+');
    return [field, h('div.stepper', minus, plus)];
  };
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
      onTap: () => { f.address = x.address; if (x.typed) { f.located = /\d/.test(x.address); f.x = null; } else { f.located = true; f.x = x.l.x; f.y = x.l.y; } dirty = true; suggestBox.replaceChildren(); blurAndRefresh(); } }))),
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
    /* A customer with an invoice written off as bad debt: “Schedule anyway?” before a new job is added (rc-money.js). Voided invoices never ask. */
    if (isNew && !f.allDay && f.customerId && WD.badDebtConfirm && !(await WD.badDebtConfirm(f.customerId))) return;
    if (!f.allDay && f.phone.trim() && !fmt.phoneValid(f.phone)) return ui.alert({ title: 'Check the phone number', message: 'Phone numbers need exactly 10 digits, like 559-968-4175. Put an extension in the Ext. box.' });
    const missing = f.allDay ? [] : missingRequired();
    /* New jobs can't be saved without their required fields. A job that already exists (perhaps from before the field became required) can, after a warning. */
    const reqMsg = { title: missing.length === 1 ? missing[0] + ' is required' : 'Required fields are missing', message: (missing.length > 1 ? missing.join(', ') + '. ' : '') + 'Required for ' + q.jobType(f.type).title + ' jobs or ' + WD.custType(custTypeOf()).title + ' customers.' + (linked() && missing.some(m => ['Contact name', 'Phone', 'Email', 'Billing email (if different)'].includes(m)) ? ' Add it on the customer’s record.' : '') + (WD.can('settings.manage') ? ' Change what’s required in Settings → Job types and fields.' : '') };
    if (missing.length && isNew) return ui.alert(reqMsg);
    if (missing.length && !(await ui.actionSheet({ title: reqMsg.title, message: reqMsg.message, buttons: [{ label: 'Save anyway', value: true }], cancel: 'Keep editing' }))) return;
    if (poList().length) f.po = WD.workflow.poFor({ poSchedule: poList() }, f.day).po;
    /* A job can be saved without an address (the customer may call back with it), but only after saying so. */
    const noAddr = WD.addressIssue({ type: f.type, allDay: f.allDay, address: f.address, cityZip: f.cityZip });
    if (noAddr && !(await ui.actionSheet({ title: noAddr === 'No address' ? 'This job has no address' : 'This job has no city or ZIP', message: 'It can’t be put on the map or routed until one is added. It will be marked on the board and listed under “missing an address” until it’s fixed.', buttons: [{ label: 'Save without it', value: true }], cancel: noAddr === 'No address' ? 'Add the address' : 'Add it now' }))) return;
    /* A day marked as a holiday, “do not schedule” or “large purge jobs only” (Holidays and schedule changes) warns before a job is put on it. */
    const mark = !f.allDay && (isNew || job.day !== f.day || job.routeId !== f.routeId) && WD.dayMark && WD.dayMark(f.routeId, f.day);
    if (mark && !(mark.kind === 'purgeOnly' && f.type === 'purge') && !(await ui.actionSheet({ title: fmt.day(f.day, 'long') + ' is marked “' + mark.label + '”', message: mark.kind === 'holiday' ? 'The company is closed that day.' : mark.kind === 'purgeOnly' ? q.routeName(f.routeId) + ' is being kept for large purge jobs that day.' : q.routeName(f.routeId) + ' is not taking jobs that day.', buttons: [{ label: 'Schedule it anyway', value: true }], cancel: 'Pick another day' }))) return;
    /* Calendar scheduling: a job needs its start time. */
    if (cal() && !f.allDay && !f.startAt) return ui.alert({ title: 'Start time is required', message: 'This business schedules by time. Choose when the job starts under Schedule.' });
    /* AI Premium: the route is near or over capacity that day. Offers other days and routes with room, or “Schedule anyway” (r14-ops.js). */
    if (!f.allDay && (isNew || job.day !== f.day || job.routeId !== f.routeId) && ops2().capacityGate) {
      const g = await ops2().capacityGate({ routeId: f.routeId, day: f.day, title: f.title.trim(), addMin: planMin(), point: f.located && f.x != null ? { x: f.x, y: f.y } : null, job });
      if (!g) return; if (g !== true) { f.routeId = g.routeId; f.day = g.day; f.pos = 0; syncCrusher(); }
    }
    f.items = f.items.filter(i => i.id !== 'hdd'); if (f.hdd > 0 && !f.allDay) f.items.push({ id: 'hdd', qty: f.hdd, rate: hddRate() });
    if (f.type === 'purge' && f.purge) { const e = WD.purgeEstimate(f.purge); if (e.minutes) f.dur = e.minutes;
      const box = f.items.find(i => i.id === 'box');
      f.items = f.items.filter(i => !WD.PURGE_IDS.includes(i.id)).concat(WD.purgeItems(f.purge, e, box ? box.rate : null)); }
    let scope = 'This job';
    if (job && job.recurring) { scope = await ui.actionSheet({ title: 'Save changes to a recurring job', message: 'Changing “this and following” ends the old series and starts a new one in a single step.', buttons: SCOPES.map(l => ({ label: l })) }); if (!scope) return; }
    if (!f.address.trim()) f.located = false; else if (f.x == null) { f.located = /\d/.test(f.address); if (f.located) { f.x = 150 + Math.random() * 700; f.y = 150 + Math.random() * 700; } }
    const purge = f.type === 'purge', containers = WD.itemsLabel(f.items, purge), phone = fmt.phoneValid(f.phone) ? '+1' + fmt.phoneDigits(f.phone) : '', ext = phone ? f.ext : '';
    let newCustomer = null;
    if (isNew && !f.customerId && f.type !== 'meet' && (f.address.trim() || phone || f.email.trim())) {
      newCustomer = { id: 'c' + (900 + data.customers.length), name: f.title.trim(), kind: f.custType === 'residential' ? 'household' : 'company', route: f.routeId, lifecycle: 'scheduled', channel: 'Other', type: f.type, freq: f.repeat === 'none' ? 'One time' : ruleLabel(f), custType: f.custType, cardOnFile: !!f.cardOnFile && f.custType === 'business', contacts: (f.contact.trim() || phone || f.email.trim()) ? [{ name: f.contact.trim() || f.title.trim(), role: '', phone, ext, email: f.email.trim().toLowerCase() }] : [], owner: S.me.id, nextAction: null, notes: '', tags: [], successful: false,
        billingEmail: f.billingEmail.trim(), po: f.po.trim(), contract: f.contract.trim(), signature: f.sig, billingMode: 'invoice', documents: [], poSchedule: f.poSchedule.slice(), changes: [],
        locations: [{ id: 'l' + Date.now(), label: 'Main office', address: f.address, x: f.x, y: f.y, containers, items: WD.copyItems(f.items), bizOpen: f.bizOpen, bizClose: f.bizClose, notes: f.notes, located: f.located }], stats: { jobs: 0, invoiced: 0, paid: 0, balance: 0, lastService: null, firstInvoice: null, rate: 85 } };
      data.customers.push(newCustomer); f.customerId = newCustomer.id;
    } else if (f.customerId && q.customer(f.customerId) && asks('signature')) q.customer(f.customerId).signature = f.sig;
    if (f.customerId && q.customer(f.customerId)) { const l = q.customer(f.customerId).locations[0]; if (l) Object.assign(l, { lunchFrom: f.lunchFrom, lunchUntil: f.lunchUntil, closedDays: f.closedDays.slice(), callAhead: f.callAhead }); }
    const fields = { title: f.title.trim(), address: f.address.trim(), notes: f.notes, routeId: f.routeId, day: f.day, allDay: f.allDay, dur: f.dur, type: f.type, containers, items: WD.copyItems(f.items), bizOpen: f.bizOpen, bizClose: f.bizClose, custFrom: f.custFrom, custUntil: f.custUntil, custStrict: f.custStrict, customerId: f.customerId, locationId: null, located: f.located, x: f.x, y: f.y, po: f.po.trim(), contract: f.contract.trim(), phone: f.customerId ? '' : phone, ext: f.customerId ? '' : ext, email: f.customerId ? '' : f.email.trim().toLowerCase(), contactName: f.customerId ? '' : f.contact.trim(), custType: custTypeOf(), cityZip: f.cityZip.trim(), windowBy: f.windowBy, needsWindow: f.needsWindow && !(f.custFrom || f.custUntil), purge: f.type === 'purge' && f.purge ? { ...f.purge } : null, lunchFrom: f.lunchFrom, lunchUntil: f.lunchUntil, closedDays: f.closedDays.slice(), callAhead: f.callAhead, flags: { ...f.flags }, hddScan: f.hdd > 0 ? !!f.hddScan : null, ...(WD.r11 ? WD.r11.editorFields(f) : {}), startAt: f.allDay ? '' : f.startAt || '', ...(f.estTotal != null ? { estTotal: f.estTotal } : {}) };
    if (f.hdd <= 0 || f.allDay) fields.crusher = false;
    const byTime = (rid, day) => { if (cal() && ops2().sortByTime) ops2().sortByTime(rid, day); };
    const series = job ? seriesJobs(job, scope) : [], me = S.me.name, changes = job ? WD.x.diffJob(job, fields) : [];
    if (job && !job.allDay && !fields.allDay && job.routeId === fields.routeId && job.day === fields.day) { const cur = q.position(job), to = f.pos || cur.of; if (to !== cur.n) changes.push({ label: 'Stop', from: String(cur.n), to: String(to) }); }
    let firstMade = null;
    api.op({ kind: isNew ? 'create' : 'edit', title: fields.title, scope: isNew ? (f.repeat === 'none' ? 'New job' : 'New recurring job') : scope, jobIds: job ? [job.id, ...series.map(j => j.id)] : [], apply() {
      const recurring = f.repeat === 'none' ? null : { rule: ruleLabel(f), seriesId: job && job.recurring && scope === 'All jobs' ? job.recurring.seriesId : 's-' + Date.now() };
      if (job) {
        const from = { routeId: job.routeId, day: job.day }; Object.assign(job, from, fields, { routeId: from.routeId, day: from.day, recurring: wasRecurring && scope === 'This job' ? job.recurring : recurring });
        if (fields.allDay) { job.routeId = fields.routeId; job.day = fields.day; job.seq = 0; WD.renumber(from.routeId, from.day); } else WD.placeJob(job, fields.routeId, fields.day, f.pos ? f.pos - 1 : Infinity); job.events.push({ at: +WD.now(), actor: me, text: 'Edited' + (scope !== 'This job' ? ' (' + scope.toLowerCase() + ')' : ''), changes }); if (fields.address || fields.cityZip) job.addrIgnored = false;
        byTime(from.routeId, from.day); byTime(job.routeId, job.day);
        series.forEach(j => Object.assign(j, { title: fields.title, address: fields.address, notes: fields.notes, dur: fields.dur, allDay: fields.allDay, type: fields.type, containers: fields.containers, items: WD.copyItems(fields.items), purge: fields.purge, needsWindow: fields.needsWindow, po: fields.po, contract: fields.contract, recurring: recurring || j.recurring })); series.forEach(j => { if (j.routeId !== fields.routeId) WD.placeJob(j, fields.routeId, j.day, Infinity); });
      } else {
        const make = (day, pos) => { const j = WD.makeJob({ ...fields, items: WD.copyItems(fields.items), day, recurring, seq: fields.allDay ? 0 : null, attachments: f.attachments.slice(), events: [{ at: +WD.now(), actor: me, text: 'Created' + (noAddr ? ' · saved without ' + (noAddr === 'No address' ? 'an address' : 'a city or ZIP') : '') }] }); firstMade = firstMade || j; if (pos && !j.allDay) WD.placeJob(j, j.routeId, day, pos - 1); byTime(j.routeId, day); }; make(f.day, f.pos);
        if (recurring) { const stepDays = { daily: 1, weekly: 7, monthly: 28 }[f.repeat] * f.interval, max = f.ends === 'count' ? f.count : 60; for (let i = 1; i < max && i * stepDays <= 548; i++) { const day = D.add(f.day, i * stepDays); if (f.ends === 'until' && day > f.until) break; make(day); } }
      }
    } });
    p.dismiss();
    if (newCustomer) setTimeout(() => ui.toast('New customer created: ' + newCustomer.name, 'person.badge.plus', 2600), 500);
    guard('board', 'show', f.day, job ? job.id : (firstMade || data.jobs[data.jobs.length - 1] || {}).id);
    /* A new job can confirm itself to the customer by text or email (Settings → Job confirmations). */
    if (isNew && firstMade && !firstMade.allDay && WD.ops) setTimeout(() => WD.ops.confirmJob(firstMade), newCustomer ? 3300 : 900);
  }
  /** Labels of required fields that are still empty. Required comes from the job type and the customer type (Settings → Job types and fields). */
  function missingRequired() {
    const c = linked(), p = c && c.contacts[0] || {}, ct = custTypeOf();
    const has = { contact: c ? !!p.name : !!f.contact.trim(), phone: c ? !!p.phone : fmt.phoneValid(f.phone), email: c ? !!p.email : /\S+@\S+\.\S+/.test(f.email), billingEmail: c ? !!c.billingEmail : !!f.billingEmail.trim(), address: !!f.address.trim(), hours: !!(f.bizOpen && f.bizClose),
      items: f.type === 'purge' ? WD.purgeEstimate(f.purge).boxes > 0 : f.items.some(i => i.qty > 0), freq: f.repeat !== 'none', po: !!f.po.trim() || poList().length > 0, contract: !!f.contract.trim(), window: !!(f.custFrom || f.custUntil || f.needsWindow), notes: !!f.notes.trim() };
    return WD.REQUIRABLE.filter(k => WD.requires(f.type, ct, k) && !has[k]).map(WD.fieldLabel);
  }
  const req = k => !f.allDay && WD.requires(f.type, custTypeOf(), k);
  /** Container counts (and rates when pricing is asked for). Purge jobs ask for an estimated box count. */
  function itemsRows(p) {
    const purge = f.type === 'purge', ids = purge ? ['box'] : WD.CONTAINERS, pricing = asks('pricing');
    const get = id => f.items.find(i => i.id === id), setQty = (id, n) => { let it = get(id); if (!it) f.items.push(it = { id, qty: 0, rate: data.priceBook.find(x => x.id === id).rate }); it.qty = Math.max(0, n); f.items = f.items.filter(i => i.qty > 0 || !WD.CONTAINERS.includes(i.id)); dirty = true; };
    return ids.map(id => { const it = get(id), n = it ? it.qty : 0, pb = data.priceBook.find(x => x.id === id);
      /* The rate field and its label are always built and only shown while the count is above zero, so − / + never has to rebuild the page. */
      const rate = pricing && (purge ? n > 0 : true) && h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': ITEM_LABEL[id] + ' rate', value: '$' + (it && it.rate != null ? it.rate : pb.rate), style: { display: n > 0 ? '' : 'none' }, oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')), cur = get(id); if (cur) cur.rate = isNaN(v) ? 0 : v; dirty = true; } });
      if (purge) return purgeRows(p, it, rate);
      const sub = pricing && h('div.row-sub', { style: { display: n > 0 ? '' : 'none' } }, 'Rate each');
      return h('div.row.jb-item', { 'data-k': 'item-' + id }, h('div.row-main', h('div.row-title', ITEM_LABEL[id]), sub), rate,
        liveCount(() => (get(id) || { qty: 0 }).qty, v => setQty(id, v), 0, 500, ITEM_LABEL[id], v => { if (!rate) return; const cur = get(id); rate.style.display = sub.style.display = v > 0 ? '' : 'none'; if (v > 0 && cur) rate.value = '$' + (cur.rate != null ? cur.rate : pb.rate); }));
    });
  }
  /** Purge: what the customer has (any mix of box sizes, bins, pallets, gaylords, cabinets), stairs and haul-away, and the time and price estimate they add up to. */
  function purgeRows(p, it, rate) {
    const P = data.purgeRules, pd = f.purge = f.purge || { std: 0, stairs: 'none', haul: false }, pb = id => data.priceBook.find(x => x.id === id).rate;
    const count = ([id, title, sub, k]) => h('div.row.jb-item', h('div.row-main', h('div.row-title', title), h('div.row-sub', typeof k === 'string' && ['pallet', 'gaylord', 'cabinet'].includes(k) ? '≈ ' + P[k] + ' boxes each' : sub)),
      h('input.jb-count', { type: 'text', inputmode: 'numeric', 'aria-label': title, value: pd[id] ? String(pd[id]) : '', placeholder: '0', oninput: ev => { pd[id] = parseInt(ev.target.value.replace(/\D/g, ''), 10) || 0; dirty = true; drawEst(); } }));
    const PP = data.purgePricing, byBin = PP.method === 'bin';
    /* The estimate line is redrawn by itself as counts, stairs and haul-away change: the rest of the page stays where it is. */
    const estRow = () => { const e = WD.purgeEstimate(pd), bins = WD.purgeBins(e.boxes), boxRate = it ? it.rate : pb('box'), extras = WD.purgeExtras(pd, e.billable), price = WD.purgeItems(pd, e, boxRate).reduce((s2, x) => s2 + x.qty * x.rate, 0);
      return h('div.row.jb-est', h('div.row-main', h('div.row-title', e.boxes ? '≈ ' + e.billable + ' boxes · ' + (byBin ? bins + (bins === 1 ? ' bin · ' : ' bins · ') : '') + (e.guess ? e.low + '–' + e.high + ' min' : e.minutes + ' min') + ' on site' : 'Enter what they have'),
        e.boxes > 0 && h('div.row-sub', e.guess ? h('span', { style: 'color:var(--orange);font-weight:600' }, 'Rough count (' + e.why + '). Planned at ' + e.minutes + ' min; confirm the count on site.') : 'Exact counts are usually close. Planned at ' + e.minutes + ' min.'),
        asks('pricing') && h('div.row-sub', (e.boxes > 0 ? 'Estimated ' : 'Starts at ') + fmt.money(price) + ' · ' + (byBin ? fmt.money(PP.binFlat) + ' for up to ' + PP.binIncluded + (PP.binIncluded === 1 ? ' bin' : ' bins') + (bins > PP.binIncluded ? ' + ' + (bins - PP.binIncluded) + ' × ' + fmt.money(PP.binExtra) : '') + ' · ' + data.purgeRules.bin65 + ' boxes to a bin' : WD.purgeItems(pd, e, boxRate).filter(x => /^box/.test(x.id)).map(x => x.qty + (x.id === 'boxLegal' ? ' legal' : x.id === 'boxXL' ? ' extra-large' : '') + ' × ' + fmt.money(x.rate, true)).join(' + ')) + (extras.length ? ' + ' + extras.map(x => ({ stairsDown: 'stairs down', stairsUp: 'stairs up', haul: 'haul-away' })[x.id]).join(' + ') : ''))), byBin ? null : rate); };
    let est = estRow(); const drawEst = () => { const n = estRow(); est.replaceWith(n); est = n; if (rate) rate.style.display = ''; };
    return [WD.PURGE_UNITS.map(count),
      h('div.row', h('div.row-main', h('div.row-title', 'Stairs'), h('div.row-sub', 'Adds about ' + Math.round(P.stairsMin * 10) + ' min per 10 boxes · +' + fmt.money(pb('stairsDown'), true) + '/box down, +' + fmt.money(pb('stairsUp'), true) + '/box up')), h('div', { style: 'width:170px;flex:none' }, ui.segmented([{ value: 'none', label: 'None' }, { value: 'down', label: 'Down' }, { value: 'up', label: 'Up' }], pd.stairs || 'none', v => { pd.stairs = v; dirty = true; drawEst(); }))),
      ui.toggleRow({ title: 'Haul away the empty boxes', subtitle: '+' + fmt.money(pb('haul'), true) + '/box · adds about ' + P.haulSec + ' seconds a box', value: !!pd.haul, onChange: v => { pd.haul = v; dirty = true; drawEst(); } }),
      est];
  }
  /** Heads-up details the driver sees right after the job title (Settings → Field workflow chooses which show). */
  function headsUp(p) {
    const flag = (k, title) => ui.toggleRow({ title, value: !!f.flags[k], onChange: v => { f.flags[k] = v; dirty = true; } }), DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const preview = WD.workflow.titleDetails({ ...f, title: f.title, flags: f.flags });
    return ui.section({ header: 'Heads-up for the driver', footer: (preview.length ? 'Shows after the title: “' + preview.join(' · ') + '”. ' : '') + 'Lunch, closed days and call-ahead are saved with the customer’s location; the rest apply to this visit.' },
      ui.quarterRow({ title: 'Closed for lunch from', value: f.lunchFrom, onChange: v => { f.lunchFrom = v; dirty = true; p.refresh(); } }), f.lunchFrom && ui.quarterRow({ title: 'Lunch until', value: f.lunchUntil, onChange: v => { f.lunchUntil = v; dirty = true; p.refresh(); } }),
      h('div.row.jb-days', h('div.row-title', 'Closed on'), h('div.jb-dayrow', DAYS.map(d => h('button.jb-day' + (f.closedDays.includes(d) ? '.on' : ''), { 'aria-label': 'Closed on ' + d, 'aria-pressed': f.closedDays.includes(d) ? 'true' : 'false', onclick: () => { f.closedDays = f.closedDays.includes(d) ? f.closedDays.filter(x => x !== d) : DAYS.filter(x => x === d || f.closedDays.includes(x)); dirty = true; p.refresh(); } }, d)))),
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
      /* The match and address-suggestion boxes are kept across rebuilds, and the route suggestions are drawn before the page is put back,
         so a rebuild never collapses a section and lets everything below it jump. */
      page = p; matchBox = matchBox || h('div.jb-match'); suggestBox = suggestBox || h('div'); recBox = h('div');
      if (f.customerId) matchBox.replaceChildren(); if (!f.address.trim()) suggestBox.replaceChildren();
      const crush = syncCrusher(), calOn = cal();
      const cust = q.customer(f.customerId), set = (k, v, re) => { f[k] = v; dirty = true; if (re) p.refresh(); };
      const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[f.repeat], type = q.jobType(f.type), showWindow = asks('window') || f.custFrom || f.custUntil || f.needsWindow;
      function positionRow() {
        const list = q.stopList(f.routeId, f.day).filter(j => j !== job && !WD.calledOff(j)); if (f.pos > list.length) f.pos = 0;
        const options = [{ value: 0, label: 'End of list (stop ' + (list.length + 1) + ')' }, ...list.map((j, i) => ({ value: i + 1, label: 'Stop ' + (i + 1) + ' · before ' + j.title }))];
        return ui.pickerRow({ title: 'Position', value: f.pos, options, onChange: v => set('pos', +v, true) });
      }
      const inp = (label, k, o2 = {}) => ui.inputRow({ label, value: f[k], onInput: v => { f[k] = v; dirty = true; }, ...o2 });
      drawRecs();
      return ui.list(
        f.banner && h('div', { style: 'padding:0 4px 10px' }, ui.note(f.banner + (f.estTotal != null && !String(f.banner).includes(String(f.estTotal)) ? ' · estimated total ' + (typeof f.estTotal === 'number' ? fmt.money(f.estTotal) : f.estTotal) : ''))),
        f.customerId && WD.badDebtBanner && WD.badDebtBanner(f.customerId),
        ui.section({ header: 'Job', footer: cust ? null : 'Type a name, phone, email or address to find an existing customer.' },
          ui.pickerRow({ title: 'Job type', value: f.type, icon: 'tag', iconColor: type.color, options: WD.shownJobTypes(f.type).map(t => ({ value: t.id, label: t.title })), onChange: v => { if (v === 'purge' && !f.items.some(i => i.id === 'box')) f.items = [{ id: 'box', qty: 0, rate: 8 }]; if (v === 'purge' && !f.purge) f.purge = { std: (f.items.find(i => i.id === 'box') || {}).qty || 0, stairs: 'none', haul: false }; set('type', v, true); } }),
          !f.allDay && ui.pickerRow({ title: 'Customer type', value: custTypeOf(), icon: 'building', iconColor: 'var(--indigo)', disabled: !!cust, subtitle: cust ? 'From the customer record' : null, options: WD.custTypes.map(t => ({ value: t.id, label: t.title })), onChange: v => set('custType', v, true) }),
          ui.inputRow({ placeholder: f.type === 'meet' ? 'Customer name' : 'Customer or job title', value: f.title, caps: 'words', autofocus: isNew && !f.title, onInput: v => { f.title = v; dirty = true; syncSave(); lookup(v); } }),
          cust && ui.row({ leading: ui.avatar(cust.name, { size: 34 }), title: cust.name, subtitle: 'Linked customer' + (cust.contacts[0] ? ' · ' + cust.contacts[0].name + ' · ' + fmt.phone(cust.contacts[0].phone, cust.contacts[0].ext) : ''), trailing: h('button', { style: 'border:0;background:none;color:var(--tint);font-size:15px;cursor:pointer', onclick: e => { e.stopPropagation(); f.customerId = null; dirty = true; p.refresh(); } }, 'Unlink') })),
        matchBox,
        !cust && (asks('contact') || asks('phone') || asks('email') || asks('billingEmail') || req('email') || req('contact')) && ui.section({ header: f.type === 'meet' ? 'Contact' : 'New customer', footer: 'Fields in red are required for ' + WD.custType(custTypeOf()).title.toLowerCase() + ' customers on ' + q.jobType(f.type).title.toLowerCase() + ' jobs.' + (isNew && f.type !== 'meet' ? ' Saving creates the customer with these details.' : '') },
          (asks('contact') || req('contact')) && inp('Contact', 'contact', { placeholder: 'Name', caps: 'words', required: req('contact') }),
          (asks('phone') || req('phone')) && ui.phoneRow({ value: f.phone, ext: f.ext, required: req('phone'), onInput: (v, x) => { f.phone = v; f.ext = x; dirty = true; } }),
          (asks('email') || req('email')) && inp('Email', 'email', { type: 'email', caps: 'off', placeholder: req('email') ? 'Required' : 'Recommended', required: req('email'), suggested: !req('email') }), (asks('billingEmail') || req('billingEmail')) && inp('Billing', 'billingEmail', { type: 'email', caps: 'off', placeholder: 'Billing email, if different', required: req('billingEmail') })),
        !asks('address') && data.addressRules[f.type] === 'cityzip' && !f.allDay && ui.section({ header: 'Where they’re coming from', footer: 'No street address is needed for ' + type.title.toLowerCase() + ' jobs, only the city or ZIP code.' },
          ui.inputRow({ icon: 'mappin', label: 'City or ZIP', placeholder: 'Fresno or 93721', value: f.cityZip, onInput: v => { f.cityZip = v; dirty = true; } })),
        asks('address') && ui.section({ header: 'Address', footer: f.located && f.x != null ? null : f.address ? 'Pick a suggestion to put the stop on the map, or keep the text as typed.' : null },
          ui.inputRow({ icon: 'mappin', iconColor: f.located && f.x != null ? 'var(--red)' : null, placeholder: 'Street address, city', value: f.address, onInput: v => { f.address = v; f.x = null; f.located = false; dirty = true; suggest(v); if (!f.title.trim()) lookup(v); } })),
        suggestBox, recBox,
        ui.section('Schedule',
          ui.pickerRow({ title: 'Route', value: f.routeId, options: q.routes().filter(r => r.writable).map(r => ({ value: r.id, label: q.routeName(r) })), onChange: v => { f.pos = 0; set('routeId', v, true); } }),
          ui.dateRow({ title: 'Date', value: f.day, onChange: v => { f.pos = 0; set('day', v, true); } }),
          /* AI Premium: says so as soon as a route and day that are near or over capacity are chosen, with other days and routes that have room. */
          !f.allDay && ops2().capInline && ops2().capInline(f.routeId, f.day, { addMin: planMin(), point: f.located && f.x != null ? { x: f.x, y: f.y } : null, job, onUse: (rid, day) => { f.routeId = rid; f.day = day; f.pos = 0; dirty = true; p.refresh(); } }),
          ui.toggleRow({ title: 'Note only', subtitle: 'Shows at the top of the day, not as a stop', value: f.allDay, onChange: v => set('allDay', v, true) }),
          /* Calendar scheduling asks for a start time and shows when the job ends; stop-order scheduling asks for the place in the list. */
          !f.allDay && calOn && (row => { if (!f.startAt) { const t = row.querySelector('.row-title'); if (t) Object.assign(t.style, { color: 'var(--red)', fontWeight: '600' }); } row.dataset.k = 'start'; return row; })(ui.quarterRow({ title: 'Start time', subtitle: f.startAt ? 'Ends ' + fmt.time(fmt.fromHHMM(f.startAt) + planMin()) + ' · ' + planMin() + ' min' : 'Required', value: f.startAt, onChange: v => { f.startAt = v; if (f.exactAt && v) f.exactAt = v; dirty = true; stay('start'); } })),
          !f.allDay && calOn && f.startAt && ops2().overlapRow && ops2().overlapRow({ routeId: f.routeId, day: f.day, startAt: f.startAt, dur: planMin(), job }),
          !f.allDay && !calOn && positionRow()),
        (asks('freq') || f.repeat !== 'none') && ui.section({ header: 'Frequency of service', footer: f.repeat === 'none' ? null : ruleLabel(f) + '. Each visit is created ahead of time for the next 18 months.' },
          ui.pickerRow({ title: 'Repeat', value: f.repeat, options: REPEATS, onChange: v => set('repeat', v, true) }),
          f.repeat !== 'none' && (row => { row.dataset.k = 'every'; return row; })(ui.row({ title: 'Every', detail: f.interval + ' ' + unit + (f.interval > 1 ? 's' : ''), trailing: ui.stepper(f.interval, 1, 12, v => { f.interval = v; dirty = true; stay('every'); }) })),
          f.repeat !== 'none' && ui.pickerRow({ title: 'Ends', value: f.ends, options: [{ value: 'never', label: 'Never' }, { value: 'count', label: 'After a number of visits' }, { value: 'until', label: 'On a date' }], onChange: v => set('ends', v, true) }),
          f.repeat !== 'none' && f.ends === 'count' && (row => { row.dataset.k = 'visits'; return row; })(ui.row({ title: 'Visits', detail: f.count, trailing: ui.stepper(f.count, 1, 60, v => { f.count = v; dirty = true; stay('visits'); }) })),
          f.repeat !== 'none' && f.ends === 'until' && ui.dateRow({ title: 'Last visit by', value: f.until, onChange: v => set('until', v) })),
        asks('items') && ui.section({ header: f.type === 'purge' ? 'Boxes' : 'Containers', footer: f.type === 'creditCard' || (cust && cust.cardOnFile) ? 'Card-on-file jobs are charged automatically when the stop is completed.' : asks('pricing') ? 'Rates start from ' + (cust ? cust.name + '’s pricing' : 'the price book') + ' and print on the invoice. Changes here apply to this job.' : null }, itemsRows(p)),
        WD.r11 && WD.r11.editorSections(f, p, () => { dirty = true; crusherTouched(); }, linked()),
        !f.allDay && f.type !== 'meet' && ui.section({ header: 'Hard drives', fold: true, folded: true, footer: f.hdd > 0 ? (f.hddScan ? 'The driver scans each drive’s barcode or serial number before it is destroyed, and the numbers print on the invoice.' : 'Drives are counted and destroyed without scanning. Some customers need the serial numbers recorded; switch scanning on for those.') + ' ' + fmt.money(hddRate(), true) + ' each to start; change the price on the invoice or the customer.' : 'Add a count if this job includes hard drives to destroy.' },
          /* The count updates in place. Only going from none to some (or back) rebuilds, because rows appear; the row stays where it was tapped. */
          (row => { row.dataset.k = 'hdd'; return row; })(ui.row({ icon: 'barcode', iconColor: 'var(--indigo)', title: 'Hard drives to destroy', subtitle: f.hdd > 0 && crush ? h('span', { style: { color: crush.offsite || !crush.need || f.crusher ? 'var(--label2)' : 'var(--red)', fontWeight: '500' } }, crusherText(crush)) : 'Type the number or use − / +',
            trailing: h('span.hstack', liveCount(() => f.hdd, v => { f.hdd = v; }, 0, 5000, 'Hard drives to destroy', (v, was) => { if ((v > 0) !== (was > 0)) { syncCrusher(); stay('hdd'); } })) })),
          f.hdd > 0 && crush && !crush.offsite && (row => { row.dataset.k = 'crusher'; return row; })(ui.toggleRow({ title: 'Send a hard drive crusher with the driver', value: !!f.crusher, onChange: v => { f.crusher = v; crusherManual = true; crusherAuto = v; dirty = true; stay('crusher'); } })),
          f.hdd > 0 && ui.toggleRow({ title: 'Scan each drive', subtitle: 'Barcode or serial number, for this job', value: !!f.hddScan, onChange: v => { f.hddScan = v; dirty = true; p.refresh(); } })),
        asks('hours') && ui.section({ header: 'Office hours', fold: true, folded: true, footer: 'When the business is open. AutoRoute never plans a stop outside these hours.' },
          ui.quarterRow({ title: 'Opens', value: f.bizOpen, onChange: v => set('bizOpen', v) }), ui.quarterRow({ title: 'Closes', value: f.bizClose, onChange: v => set('bizClose', v) })),
        showWindow && ui.section({ header: 'Requested time window', fold: true, folded: true, footer: f.needsWindow ? 'They want a window but don’t mind when. When the route is finalized (usually the day before), AutoRoute gives them one around the planned arrival — 2 hours before 10 AM, 3 hours from 10 to 1, 4 hours after 1 — and reminds you to let them know.' : 'A time the customer asked for on this visit — for example a homeowner who is only home 1–3 PM. Preferred: AutoRoute fits it in when it can. Required: AutoRoute plans around it and warns if it can’t be met.' },
          ui.toggleRow({ title: 'Needs a window', subtitle: 'Time chosen when the route is finalized', value: f.needsWindow, onChange: v => { f.needsWindow = v; if (v) { f.custFrom = ''; f.custUntil = ''; } dirty = true; p.refresh(); } }),
          !f.needsWindow && [timeRows(), h('div.row', h('div.row-main', h('div.row-title', 'Who set it')), h('div', { style: 'width:190px;flex:none' }, ui.segmented([{ value: 'customer', label: 'They asked' }, { value: 'us', label: 'We told them' }], f.windowBy, v => { f.windowBy = v; dirty = true; }))),
          h('div.row', h('div.row-main', h('div.row-title', 'This window is')), h('div', { style: 'width:190px;flex:none' }, ui.segmented([{ value: false, label: 'Preferred' }, { value: true, label: 'Required' }], f.custStrict, v => { f.custStrict = v; dirty = true; })))]),
        (asks('po') || asks('contract') || asks('signature')) && ui.section({ header: 'Billing', fold: true, folded: true, footer: poList().length ? 'This job uses the PO whose dates cover ' + fmt.day(f.day, 'md') + (WD.workflow.poFor({ poSchedule: poList() }, f.day).po ? ': ' + WD.workflow.poFor({ poSchedule: poList() }, f.day).po + '.' : ' (none does).') + ' The PO list is saved with the customer.' : 'PO and contract numbers print on the invoice. ' + (cust ? 'They come from the customer; changes here apply to this job only.' : 'They’re saved to the new customer.') },
          asks('po') && WD.x.poRows({ st: poSt, getPO: () => f.po, setPO: v => { f.po = v; dirty = true; }, schedule: poList(), docs: cust ? cust.documents : null, required: req('po'), refresh: () => { dirty = true; blurAndRefresh(); } }), asks('contract') && inp('Contract', 'contract', { placeholder: 'None', required: req('contract') }),
          asks('signature') && ui.pickerRow({ title: 'Customer signature', value: f.sig, options: WD.SIG_POLICIES, onChange: v => { f.sig = v; dirty = true; p.refresh(); } })),
        !f.allDay && f.type !== 'meet' && headsUp(p),
        asks('notes') && ui.section('Notes', ui.inputRow({ multiline: true, placeholder: 'Access notes, contact, what to bring', value: f.notes, onInput: v => set('notes', v) })),
        isNew && ui.section({ header: 'Attachments', fold: true, folded: !f.attachments.length }, f.attachments.map(attachmentRow), ui.row({ title: 'Add photo or file', icon: 'paperclip', iconPlain: true, tint: true, onTap: () => addAttachment(f.attachments) })),
        h('div', { style: 'margin-top:14px' }, ui.note(type.title + ' jobs ask for these fields. ' + (WD.can('settings.manage') ? 'Change them in Settings → Job types and fields.' : 'An admin can change them in Settings.'))));
    } });
}

/* ================= Search ================= */
function openSearch() {
  let text = '', scope = WD.can('crm.view') ? 'all' : 'jobs', when = 'all', loading = false, timer = null, box = null, server = null;   // server: null | 'loading' | {n} once the server was asked for this text
  const routeIds = () => q.visibleRoutes().map(r => r.id);
  const jobRow = j => ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: fmt.day(j.day) + (j.day.slice(0, 4) !== D.today().slice(0, 4) ? ', ' + j.day.slice(0, 4) : '') + (j.allDay ? ' · note' : WD.calledOff(j) ? '' : ' · stop ' + q.position(j).n) + ' · ' + q.routeName(j.routeId) + (j.fromServer ? ' · from the server' : ''), trailing: icon(WD.jobStatuses[j.status].icon, 18, WD.jobStatuses[j.status].color), onTap: () => openDetails(j.id) });
  async function askServer(p) {
    if (S.offline) return ui.toast('Offline — older history needs a connection', 'wifi.slash', 2600);
    const asked = text; server = 'loading'; fill(p); await WD.delay(900, 1500); if (asked !== text) return;
    server = { n: WD.x.fetchHistory(asked) }; when = when === 'upcoming' ? 'all' : when; fill(p);
  }
  function fill(p) {
    if (!box) return; const s = text.trim();
    if (s.length < 2) return box.replaceChildren(ui.list(ui.section({ header: 'Recent', footer: scope === 'all' ? 'Searches everything at once: customers (name, contact, phone, email, address) and jobs on your ' + routeIds().length + ' selected routes (title, address, notes, route name). Older job history is fetched from the server when you ask for it.' : scope === 'jobs' ? 'Searches jobs on your ' + routeIds().length + ' selected routes: title, address, notes and route name. This iPhone holds the last 10 days and everything upcoming; older history is fetched from the server when you ask for it.' : 'Matches customer name, contact, phone, email or address.' },
      ['Harlow', '555-0131', 'Bank St'].map(r => ui.row({ title: r, icon: 'clock', iconPlain: true, iconColor: 'var(--label2)', onTap: () => { text = r; const i = p.navbar.querySelector('.search-box input'); if (i) { i.value = r; i.parentNode.classList.add('filled'); } run(p); } })))));
    if (loading) return box.replaceChildren(h('div', { style: 'text-align:center;padding:40px' }, ui.spinner(26)));
    const custRow = m => ui.row({ leading: ui.avatar(m.customer.name, { size: 36 }), title: m.customer.name, subtitle: m.match, chevron: true, onTap: () => guard('customers', 'openDetail', m.customer.id) });
    const custs = scope === 'all' && WD.can('crm.view') ? q.searchCustomers(s, 20) : [];
    if (scope === 'customers') { const found = q.searchCustomers(s, 20);
      return box.replaceChildren(found.length ? ui.list(ui.section(found.length + (found.length === 1 ? ' customer' : ' customers'), found.map(custRow)))
        : ui.empty({ icon: 'magnifyingglass', title: 'No customers', text: 'Nothing matches “' + s + '”.' })); }
    const today = D.today(), all = q.searchJobs(s, routeIds()), past = all.filter(j => j.day < today).sort((a, b) => b.day.localeCompare(a.day) || q.order(a, b));
    const groups = [['Today', all.filter(j => j.day === today), when !== 'history'], ['Upcoming', all.filter(j => j.day > today).slice(0, 30), when !== 'history'], ['History · ' + past.length + (past.length === 1 ? ' past job' : ' past jobs'), past.slice(0, 80), when !== 'upcoming']].filter(g => g[2]);
    const serverRow = server === 'loading' ? h('div.row', ui.spinner(18), h('div.row-main.secondary', 'Asking the server for older jobs…'))
      : server ? ui.row({ icon: 'cloud', iconPlain: true, iconColor: 'var(--label2)', title: server.n ? server.n + ' older ' + (server.n === 1 ? 'job' : 'jobs') + ' loaded from the server' : 'The server has nothing older for “' + s + '”', subtitle: server.n ? 'Shown under History above' : null })
      : ui.row({ icon: 'cloud', iconPlain: true, title: 'Search older jobs on the server', subtitle: 'For history from before the jobs saved on this iPhone', tint: true, onTap: () => askServer(p) });
    box.replaceChildren(ui.list(custs.length > 0 && ui.section({ header: custs.length + (custs.length === 1 ? ' customer' : ' customers'), footer: custs.length > 5 ? 'Showing the first 5. Choose Customers above to see all ' + custs.length + '.' : null }, custs.slice(0, 5).map(custRow)),
      groups.map(([name, list]) => ui.section(name, list.map(jobRow))),
      !groups.some(g => g[1].length) && ui.empty({ icon: 'magnifyingglass', title: custs.length ? 'No jobs on this iPhone' : scope === 'all' ? 'Nothing found on this iPhone' : 'No jobs on this iPhone', text: 'Nothing on your selected routes matches “' + s + '”' + (when === 'upcoming' ? ' today or later.' : '. Older jobs may still be on the server.') }),
      when !== 'upcoming' && ui.section({ header: 'Older history', footer: 'Jobs from more than 10 days ago are kept on the server, not on this iPhone.' }, serverRow)));
  }
  function run(p) { clearTimeout(timer); server = null; loading = text.trim().length >= 2; fill(p); if (loading) timer = setTimeout(() => { loading = false; fill(p); }, 300 + Math.random() * 350); }
  ui.sheet({ title: 'Search', live: false, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], onClose: () => clearTimeout(timer),
    search: { placeholder: 'Jobs, customers, phone, address', autofocus: true, onInput: (v, p) => { text = v; run(p); } },
    render(p) { box = h('div'); setTimeout(() => fill(p), 0);
      return [h('div.jb-seg', ui.segmented([WD.can('crm.view') && { value: 'all', label: 'All' }, { value: 'jobs', label: 'Jobs' }, WD.can('crm.view') && { value: 'customers', label: 'Customers' }].filter(Boolean), scope, v => { scope = v; p.refresh(); })),
        scope !== 'customers' && h('div.jb-seg', ui.segmented([{ value: 'all', label: 'All dates' }, { value: 'upcoming', label: 'Today and upcoming' }, { value: 'history', label: 'History' }], when, v => { when = v; fill(p); })), box]; } });
}

/* ================= AutoRoute ================= */
/* Reorders the remaining (unstarted, located) stops on a route's day list. The board has no clock times, so the result is a new order;
   AutoRoute simulates the day to respect office hours and requested windows (required windows are hard limits, preferred ones are soft). */
const dayStart = () => data.workflow.dayStartMin;
/** Hard and soft windows for a stop, in minutes since midnight. */
function windowsOf(j) {
  const open = fmt.fromHHMM(j.bizOpen), close = fmt.fromHHMM(j.bizClose), from = fmt.fromHHMM(j.custFrom), until = fmt.fromHHMM(j.custUntil);
  const hard = { from: open != null ? open : 0, until: close != null ? close : 24 * 60 }, soft = null;
  if (j.custStrict) { if (from != null) hard.from = Math.max(hard.from, from); if (until != null) hard.until = Math.min(hard.until, until); return { hard, soft, open, close }; }
  return { hard, soft: from != null || until != null ? { from: from != null ? from : 0, until: until != null ? until : 24 * 60 } : null, open, close };
}
/** Walk an order from a start point and time. Returns legs with ETAs and window checks, total drive, finish time and a cost (drive + waiting + window penalties). */
/* Ignore time windows (a switch on the AutoRoute sheet): plan the shortest drive, never wait for a door to open, and flag every stop that lands outside its hours or requested window. */
let ignoreWin = false;
function simulate(order, from, end) {
  let at = from.at, t = from.t, drive = 0, cost = 0; const legs = [];
  order.forEach(j => {
    const d = driveMin(at, j), w = windowsOf(j), sm = WD.siteMinutes(j), svc = sm.minutes, arrive = t + d;
    const start = ignoreWin ? arrive : Math.max(arrive, w.hard.from), latest = w.hard.until - Math.min(svc, 15);
    const hardLate = Math.max(0, start - latest), early = Math.max(0, w.hard.from - start); let softOff = 0;
    if (w.soft) softOff = start < w.soft.from ? w.soft.from - start : start > w.soft.until ? start - w.soft.until : 0;
    drive += d; cost += ignoreWin ? d : d + (start - arrive) * 0.35 + (hardLate ? 600 + hardLate * 20 : 0) + softOff * (start > (w.soft ? w.soft.until : 0) ? 1.4 : 0.6);
    legs.push({ job: j, drive: d, arrive, start, svc, w, hardLate, early, softOff, out: ignoreWin && !!(hardLate || early || softOff), sm, est: sm.est || null });
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
/** Why a stop planned with windows ignored falls outside its window. */
const outText = l => (l.early ? 'opens ' + fmt.time(l.w.hard.from) : l.hardLate ? (l.job.custStrict ? 'required ' : 'open ') + winLabel(l.w.hard) : 'prefers ' + winLabel(l.w.soft)) + ', ETA ' + fmt.time(l.start);
function windowNote(l) {
  const w = l.w, hasHard = w.hard.from > 0 || w.hard.until < 24 * 60;
  if (l.job.needsWindow && !l.job.custFrom && !l.job.custUntil) return h('div.jb-win.soft', icon('clock', 13), 'Needs a window → they’ll be told ' + winLabel(WD.r11 ? WD.r11.winFor(l) : WD.etaWindow(l.start)));
  if (ignoreWin) return l.out ? h('div.jb-win.bad', icon('exclamationmark.triangle', 13), 'Outside its window — ' + outText(l)) : (hasHard || w.soft) ? h('div.jb-win.ok', icon('checkmark', 13), 'Inside its window ✓') : null;
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
  let stage = 0, plan = null, pinnedAt = -1, view = 'after'; ignoreWin = false;
  /* Add-ons: an unload stop at a recycler or landfill, window overrides, and pickup-before-delivery pairs. */
  const AR = WD.r11 ? WD.r11.autoRoute({ routeId, day, stops, all, isToday }) : null, tidy = order => AR ? AR.wrap(order, from(), ends().end, optimize, simulate) : order;
  /* Start time: for a day that hasn't started, AutoRoute recommends when to leave where the truck is parked so it reaches the first stop as it opens.
     The dispatcher accepts it or picks their own time; either is saved with the route's day. */
  const dayKey = routeId + '|' + day, pretrip = data.workflow.pretripMin, plansDepart = !done && !isToday;
  let depart = plansDepart ? (data.routeDays[dayKey] ? { ...data.routeDays[dayKey] } : { depart: dayStart(), manual: false }) : null;
  const ends = () => q.routeEnds(routeId, day), from = () => ({ at: done || ends().start, t: isToday ? Math.max(WD.nowMins(), dayStart()) : depart ? depart.depart + pretrip : dayStart() });
  /** Latest departure that still reaches the first stop when it opens (or at the usual opening time when it has no hours), after the pre-trip time. */
  function recommendDepart(order) {
    if (!order.length) return dayStart();
    const l = simulate(order, { at: ends().start, t: 3 * 60 }, ends().end).legs[0], opens = l.w.hard.from > 0 ? l.w.hard.from : fmt.fromHHMM(data.workflow.normalOpen);
    return { t: Math.max(3 * 60, Math.floor((opens - l.drive - pretrip) / 15) * 15), opens, drive: l.drive, job: l.job };
  }
  function build(order, pinned) {
    const e = ends(), f = from(), sim = simulate(order, f, e.end), cur = simulate(stops, f, e.end);
    plan = { order, sim, cur, pinned: pinned == null ? -1 : pinned, rec: plansDepart && order.length ? recommendDepart(order) : null }; pinnedAt = plan.pinned;
  }
  const optimizeAll = () => {
    if (plansDepart && !depart.manual) for (let k = 0; k < 3; k++) { const r = recommendDepart(optimize(stops, from(), ends().end)); if (!r.t || r.t === depart.depart) break; depart.depart = r.t; }
    build(tidy(optimize(stops, from(), ends().end)));
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
      const bad = ignoreWin ? [] : plan.sim.legs.filter(l => l.hardLate), outs = plan.sim.legs.filter(l => l.out).map(l => ({ j: l.job, text: outText(l) })), ign = ignoreWin;
      if (bad.length && !(await ui.actionSheet({ title: bad.length + (bad.length === 1 ? ' stop misses' : ' stops miss') + ' a required time', message: bad.map(l => l.job.title).join(', ') + '. Accept anyway, or keep adjusting the order.', buttons: [{ label: 'Accept anyway', value: true, role: 'destructive' }], cancel: 'Keep adjusting' }))) return;
      const order = plan.order, give = plan.sim.legs.filter(l => l.job.needsWindow && !l.job.custFrom && !l.job.custUntil).map(l => ({ j: l.job, w: WD.r11 ? WD.r11.winFor(l) : WD.etaWindow(l.start) })), dep = depart && { depart: depart.depart, manual: depart.manual }, me = S.me.name;
      api.op({ kind: 'batch', title: q.routeName(route) + ' · AutoRoute', scope: order.length + ' jobs · all or nothing', jobIds: order.map(j => j.id), apply() { if (AR) AR.commit(order); newList().forEach((j, i) => { j.seq = i + 1; }); order.forEach(j => { j.offWindow = null; j.events.push({ at: +WD.now(), actor: me, text: 'AutoRoute' + (ign ? ' (time windows ignored)' : '') + ': moved to stop ' + j.seq }); });
        outs.forEach(({ j, text }) => { j.offWindow = text; j.events.push({ at: +WD.now(), actor: me, text: 'Flagged: outside its time window (' + text + ')' }); });
        if (dep) data.routeDays[dayKey] = dep;
        give.forEach(({ j, w }) => { Object.assign(j, { custFrom: hhmm(w.from), custUntil: hhmm(w.until), windowBy: 'us', custStrict: false, needsWindow: false, windowToSend: true }); j.events.push({ at: +WD.now(), actor: me, text: 'Window set by AutoRoute: ' + winLabel(w) }); }); } });
      p.dismiss(); ui.toast('Route accepted' + (dep ? ' · leave ' + fmt.time(dep.depart) : '') + (outs.length ? ' · ' + outs.length + ' flagged outside their window' : ''), outs.length ? 'exclamationmark.triangle' : 'checkmark', outs.length ? 3400 : 2200); if (!o.stay) guard('board', 'show', day);
      if (give.length) setTimeout(async () => { const v = await ui.actionSheet({ title: give.length + (give.length === 1 ? ' customer gets a window' : ' customers get a window'), message: give.map(x => x.j.title + ' · ' + winLabel(x.w)).join('\n'), buttons: [{ label: 'Text them their window now', value: true }], cancel: 'Later' });
        if (v) { give.forEach(x => { x.j.windowToSend = false; }); ui.toast('Texts sent · ' + give.length, 'message'); WD.changed(); } }, 700);
    } }] : [],
    render(page) {
      if (!plan) return ui.list(ui.section({ header: q.routeName(route) + ' · ' + fmt.day(day), footer: 'Planning ' + stops.length + ' remaining stops' + (done ? ' from ' + done.title : ' from ' + ends().start.name) + '.' },
        stages.map((s, i) => h('div.jb-stage' + (i > stage ? '.wait' : ''), i < stage ? icon('checkmark.circle.fill', 22, 'var(--green)') : i === stage ? ui.spinner(20) : icon('circle', 22), s))));
      if (!plan.order.length) return ui.empty({ icon: 'route', title: 'Nothing to route', text: 'There are no unstarted, located jobs left on this route for ' + fmt.day(day) + '.' });
      const saved = plan.cur.drive - plan.sim.drive, e = ends(), base = all.length - todo.length, misses = ignoreWin ? 0 : plan.sim.legs.filter(l => l.hardLate).length, outN = plan.sim.legs.filter(l => l.out).length, curMiss = plan.cur.legs.filter(l => l.hardLate).length, onSite = plan.sim.legs.reduce((s, l) => s + l.svc, 0);
      return ui.list(
        ui.section(null, h('div.jb-plan', h('div.caption', q.routeName(route) + ' · ' + fmt.day(day, 'long')), h('div.big', fmt.dur(plan.sim.drive) + ' driving'),
          h('div.subhead', saved > 0 ? h('span.save', 'Saves ' + fmt.dur(saved)) : h('span.secondary', saved < 0 ? fmt.dur(-saved) + ' more driving' + (ignoreWin ? '' : ', to meet time windows') : 'Same driving as now'), h('span.secondary', ' · ' + plan.order.length + ' stops · ~' + fmt.dur(onSite) + ' on site · back about ' + fmt.time(plan.sim.finish))),
          ignoreWin ? h('div.jb-win.' + (outN ? 'bad' : 'ok'), { style: 'margin-top:6px' }, icon(outN ? 'exclamationmark.triangle' : 'checkmark', 14), outN ? (outN === 1 ? '1 stop falls outside its time window' : outN + ' stops fall outside their time windows') + ' — flagged below and on the board' : 'Every stop still lands inside its window') : misses ? h('div.jb-win.bad', { style: 'margin-top:6px' }, icon('exclamationmark.triangle', 14), misses + (misses === 1 ? ' required time can’t be met' : ' required times can’t be met')) : curMiss ? h('div.jb-win.ok', { style: 'margin-top:6px' }, icon('checkmark', 14), 'Fixes ' + curMiss + (curMiss === 1 ? ' stop' : ' stops') + ' the current order would reach outside its hours') : null),
          h('div.jb-ends', icon('truck', 15), h('span', 'Starts ' + (done ? 'after ' + done.title : 'at ' + e.start.name + (depart ? ' · leaves ' + fmt.time(depart.depart) : '')) + ' · ends at ' + e.end.name), h('button', { onclick: ev => changeEnds(ev.currentTarget, page) }, 'Change')),
          maps()),
        ui.section({ footer: ignoreWin ? 'Planned for the shortest drive. The truck does not wait for anyone to open, and every stop that lands outside its office hours or requested window is flagged here and on the board so you can call ahead or move it.' : 'Turn on to plan the shortest drive and see which stops would fall outside their office hours or requested window.' },
          ui.toggleRow({ icon: 'clock', iconColor: 'var(--orange)', title: 'Ignore time windows', subtitle: 'Then flag the stops that fall outside theirs', value: ignoreWin, onChange: v => { ignoreWin = v; optimizeAll(); page.refresh(); } })),
        startSection(page),
        AR && AR.section(page, () => { optimizeAll(); page.refresh(); }),
        ui.section({ header: h('div.cu-sechead', h('span', 'Proposed order'), pinnedAt >= 0 && h('button.cu-link', { onclick: () => { optimizeAll(); page.refresh(); } }, 'Re-optimize all')),
          footer: 'Drag ≡ to move a stop. Stops before it stay as you placed them and everything after it is re-optimized. Time on site is the median of recorded visits, so one unusually long visit doesn’t skew it; a stop with no history uses the formula in Settings → Time on site. Office hours and required windows are never broken on purpose; preferred windows are met when possible. Accepting reorders every job together or none of them.' },
          plan.sim.legs.map((l, i) => { const j = l.job, n = base + i + 1, was = q.position(j).n, label = WD.itemsLabel(j.items, j.type === 'purge');
            const row = ui.row({ class: 'jb-ar', leading: h('div.jb-num', { style: WD.pinStyle(j) }, n),
              title: h('span', j.title, label && h('span.jb-qty', label), i <= pinnedAt && i === pinnedAt ? h('span.jb-pin', 'MOVED') : null),
              subtitle: h('div', h('div', ['ETA ' + fmt.time(l.start), j.type === 'dump' ? 'added stop' : n !== was ? 'was stop ' + was : 'same place', l.drive + ' min drive', '~' + l.svc + ' min on site (' + (l.sm.source === 'override' ? (j.type === 'dump' ? 'unload time' : 'set on this job') : l.est ? l.est.billable + ' boxes' + (l.est.guess ? ', rough count' : '') : l.sm.source === 'history' ? 'median of ' + l.sm.n : l.sm.counted ? 'formula, no history yet' : 'default, no history yet') + (l.sm.setup ? ', +' + l.sm.setup + ' new setup' : '') + (l.sm.pace !== 1 ? ', truck pace ' + Math.round(l.sm.pace * 100) + '%' : '') + ')'].join(' · ')), windowNote(l), AR && AR.rowExtra(l, page)),
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
WD.screens.jobs = { recommend, openDetails, openEditor, openReassign, openSearch, openAutoRoute, skipFlow, callOff, copyTo, pickDay };
const firstToday = pred => data.jobs.filter(j => j.day === D.today() && !j.allDay && pred(j)).sort(q.order)[0];
WD.panel.addJump('Job details', () => { WD.nav.switchTab('board'); const j = firstToday(x => x.status === 'arrived') || firstToday(() => true); if (j) openDetails(j.id); });
WD.panel.addJump('New job', () => { WD.nav.switchTab('board'); openEditor({ day: D.today(), routeId: 'r1' }); });
WD.panel.addJump('Search', () => { WD.nav.switchTab('board'); openSearch(); });
WD.panel.addJump('AutoRoute', () => { let day = D.add(D.today(), 1); while ([0, 6].includes(D.parse(day).getDay())) day = D.add(day, 1); guard('board', 'show', day); openAutoRoute('r1', { day }); });
})();
