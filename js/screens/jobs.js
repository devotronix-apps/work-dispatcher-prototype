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
`);

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
  const line = (ic, ...kids) => h('div.jb-line', icon(ic, 18), h('span', kids));
  const head = h('div.jb-head',
    h('div.title2', unresolved && h('span.jb-q', '?'), h('span', job.title)),
    h('div.jb-badges', ui.badge(st.title, st.color), type.color && ui.badge(type.title, type.color), job.pending && ui.badge('Pending sync', 'var(--orange)')),
    h('div.jb-line', ui.dot(q.routeColor(route)), h('span', q.routeName(route) + (driver ? ' · ' + driver.name : '') + (vehicle ? ' · ' + vehicle.name : ''))),
    line('clock', job.allDay ? 'All day · ' + fmt.day(job.day, 'long') : fmt.day(job.day, 'long') + ' · ' + fmt.range(job.start, job.dur)),
    job.eta && line('timer', 'Customer ETA ' + fmt.time(job.eta.from) + ' – ' + fmt.time(job.eta.to)),
    job.recurring && line('repeat', job.recurring.rule));

  const setStatus = (s, note) => api.setStatus(job.id, s, note);
  const skip = async () => { const why = await ui.actionSheet({ title: 'Skip this stop?', buttons: ['Office closed', 'No access', 'Customer asked to skip', 'Other'].map(l => ({ label: l })) }); if (why) setStatus('skipped', why); };
  let steps = null;
  if (!job.allDay) {
    const b = (label, kind, fn, ic) => ui.button(label, { kind, icon: ic, block: false, onTap: fn });
    if (job.status === 'scheduled') steps = h('div.jb-steps', b('Start driving', 'tinted', () => setStatus('enroute'), 'truck'), b('Skip…', 'gray', skip));
    else if (job.status === 'enroute') steps = h('div.jb-steps', b('Arrived', 'filled', () => setStatus('arrived'), 'mappin'), b('Skip…', 'gray', skip));
    else if (job.status === 'arrived') steps = h('div.jb-steps', b('Complete stop', 'filled', () => setStatus('completed'), 'checkmark'), b('Skip…', 'gray', skip));
    else steps = h('div.jb-done', icon(st.icon, 22, st.color), h('span', job.status === 'completed' && job.arrivedAt != null ? 'Arrived ' + fmt.time(job.arrivedAt) + ' · left ' + fmt.time(job.departedAt) + ' · ' + fmt.dur(Math.max(1, job.departedAt - job.arrivedAt)) + ' on site' : st.title), h('span.spacer'), h('button', { onclick: () => setStatus('scheduled') }, 'Reopen'));
  }
  const contact = cust && cust.contacts[0];
  return ui.list(
    ui.section(null, head, steps),
    canEdit && ui.section({ footer: job.pending ? 'This job is waiting to sync. You can change it again once that finishes.' : null },
      ui.row({ title: 'Edit job', icon: 'pencil', iconPlain: true, tint: true, disabled: job.pending, onTap: () => openEditor({ jobId: job.id }) }),
      ui.row({ title: 'Reassign', icon: 'arrow.left.arrow.right', iconPlain: true, tint: true, disabled: job.pending, onTap: () => openReassign(job) }),
      ui.row({ title: 'Delete job', icon: 'trash', iconPlain: true, iconColor: 'var(--red)', destructive: true, disabled: job.pending, onTap: () => deleteJob(job, p) })),
    cust && ui.section('Customer',
      ui.row({ leading: ui.avatar(cust.name, { size: 36, icon: cust.kind === 'household' ? 'house' : 'building' }), title: cust.name, subtitle: contact ? contact.name + (contact.role ? ' · ' + contact.role : '') : null, chevron: WD.can('crm.view'), onTap: WD.can('crm.view') ? () => guard('customers', 'openDetail', cust.id) : null }),
      contact && ui.row({ title: fmt.phone(contact.phone), icon: 'phone', iconPlain: true, tint: true, onTap: () => ui.toast('Calling ' + contact.name + ' via Quo…', 'phone') }),
      contact && ui.row({ title: 'Send a text', icon: 'message', iconPlain: true, tint: true, onTap: () => ui.toast('Opening a text to ' + contact.name + '…', 'message') })),
    job.address && ui.section({ header: 'Location', footer: unresolved ? 'Apple Maps could not find this address, so the stop has no pin and is left out of routing. Edit the job to fix it.' : null },
      ui.row({ title: job.address, icon: 'mappin', iconPlain: true, iconColor: unresolved ? 'var(--red)' : 'var(--label2)' }),
      ui.row({ title: 'Directions', icon: 'arrow.triangle.turn.up.right', iconPlain: true, tint: true, onTap: () => ui.toast('Opening Apple Maps…', 'map') }),
      job.located && ui.row({ title: 'Show on map', icon: 'map', iconPlain: true, tint: true, onTap: () => { p.dismiss(); setTimeout(() => guard('map', 'focusJob', job.id), 350); } })),
    ui.section('Service',
      ui.row({ title: 'Job type', trailing: h('span.hstack.secondary', type.color && ui.dot(type.color), type.title) }),
      job.containers && ui.row({ title: 'Containers', detail: job.containers }),
      job.bizOpen && ui.row({ title: 'Business hours', detail: fmt.time(fmt.fromHHMM(job.bizOpen)) + ' – ' + fmt.time(fmt.fromHHMM(job.bizClose)) }),
      (job.custFrom || job.custUntil) && ui.row({ title: 'Customer window', detail: (job.custFrom ? fmt.time(fmt.fromHHMM(job.custFrom)) : 'Any') + ' – ' + (job.custUntil ? fmt.time(fmt.fromHHMM(job.custUntil)) : 'Any') })),
    job.notes && ui.section('Notes', h('div.jb-notes', job.notes)),
    ui.section('Attachments', job.attachments.map(a => attachmentRow(a)),
      ui.row({ title: 'Add photo or file', icon: 'paperclip', iconPlain: true, tint: true, onTap: () => addAttachment(job.attachments) })),
    WD.can('billing.view') && (job.invoice || job.status === 'completed') && ui.section('Billing',
      job.invoice ? ui.row({ title: job.invoice.number + ' · ' + fmt.money(job.invoice.amount), subtitle: job.invoice.auto ? 'Card on file charged automatically' : 'Invoice Ninja', icon: 'dollarsign', iconColor: 'var(--green)', badge: ui.badge(job.invoice.status, job.invoice.status === 'Paid' ? 'var(--green)' : 'var(--orange)') })
        : WD.can('billing.manage') ? ui.row({ title: 'Create invoice', icon: 'plus', iconPlain: true, tint: true, onTap: () => ui.run('Creating invoice…', () => { const c = q.customer(job.customerId); job.invoice = { number: 'INV-' + (2500 + Math.floor(Math.random() * 400)), status: 'Sent', amount: c && c.stats ? c.stats.rate : 85 }; job.events.push({ at: +WD.now(), actor: S.me.name, text: 'Invoice ' + job.invoice.number + ' sent' }); }, { done: 'Invoice sent' }) })
        : ui.row({ title: 'Not invoiced yet', detail: '' })),
    ui.section({ header: 'History', footer: (S.googleMirror.enabled && route ? 'Copied to the ' + route.name + ' Google calendar a few seconds after each change syncs. ' : '') + 'Version ' + job.version + '.' },
      job.events.slice().reverse().map(e => ui.row({ title: e.text, subtitle: e.actor + ' · ' + fmt.rel(e.at) }))));
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
      api.op({ kind: 'reassign', title: job.title, scope, jobIds: [job.id, ...series.map(j => j.id)], apply() { [job, ...series].forEach(j => { j.routeId = to; }); job.events.push({ at: +WD.now(), actor: S.me.name, text: 'Reassigned to ' + q.routeName(to) }); } });
      p.dismiss();
    } }],
    render: p => ui.list(
      ui.section('Assign to', q.routes().filter(r => r.writable && r.id !== job.routeId).map(r => { const d = q.driverFor(r.id), n = q.jobsFor(r.id, job.day).filter(j => !j.allDay).length;
        return ui.row({ leading: ui.dot(q.routeColor(r)), title: q.routeName(r), subtitle: (d ? d.name : 'No driver assigned') + ' · ' + n + (n === 1 ? ' job' : ' jobs') + ' that day', trailing: dest === r.id ? icon('checkmark', 20, 'var(--tint)') : null, onTap: () => { dest = r.id; p.refresh(); } }); })),
      job.recurring && ui.section('Apply to', SCOPES.map(s => ui.row({ title: s, trailing: scope === s ? icon('checkmark', 20, 'var(--tint)') : null, onTap: () => { scope = s; p.refresh(); } }))),
      h('div', { style: 'margin-top:10px' }, ui.note('The job keeps its date, time, and duration.'))) }, { detent: job.recurring ? 'large' : 'medium' });
}

/* ================= Job editor ================= */
const REPEATS = [{ value: 'none', label: 'Never' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function parseRule(rule) { const m = /Every (\d+) (week|day|month)/.exec(rule || ''); if (m) return { repeat: m[2] === 'week' ? 'weekly' : m[2] === 'day' ? 'daily' : 'monthly', interval: +m[1] }; if (/^Weekly/.test(rule)) return { repeat: 'weekly', interval: 1 }; if (/^Daily/.test(rule)) return { repeat: 'daily', interval: 1 }; if (/^Monthly/.test(rule)) return { repeat: 'monthly', interval: 1 }; return { repeat: 'none', interval: 1 }; }
function ruleLabel(f) {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[f.repeat], base = f.interval === 1 ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[f.repeat] : 'Every ' + f.interval + ' ' + unit + 's';
  return base + (f.repeat === 'weekly' ? ' on ' + WEEKDAYS[D.parse(f.day).getDay()] : f.repeat === 'monthly' ? ' on day ' + D.parse(f.day).getDate() : '') + (f.ends === 'count' ? ', ' + f.count + ' times' : f.ends === 'until' ? ', until ' + fmt.day(f.until, 'md') : '');
}
function openEditor(o = {}) {
  const job = o.jobId ? q.job(o.jobId) : null, isNew = !job;
  const f = job ? { title: job.title, address: job.address, notes: job.notes, routeId: job.routeId, day: job.day, allDay: job.allDay, start: job.start, dur: job.dur, type: job.type, containers: job.containers, bizOpen: job.bizOpen, bizClose: job.bizClose, custFrom: job.custFrom, custUntil: job.custUntil, customerId: job.customerId, located: job.located, x: job.x, y: job.y, ...parseRule(job.recurring && job.recurring.rule) }
    : { title: '', address: '', notes: '', routeId: o.routeId || (q.visibleRoutes()[0] || q.routes()[0]).id, day: o.day || S.board.day, allDay: false, start: o.start == null ? 9 * 60 : o.start, dur: 30, type: 'purge', containers: '', bizOpen: '', bizClose: '', custFrom: '', custUntil: '', customerId: null, located: false, x: null, y: null, repeat: 'none', interval: 1 };
  Object.assign(f, { ends: 'never', count: 10, until: D.add(f.day, 90), attachments: [] });
  const wasRecurring = f.repeat !== 'none';
  let page = null, matchBox = null, suggestBox = null, timer = null, dirty = false;
  const fill = c => { const l = c.locations[0]; Object.assign(f, { customerId: c.id, title: c.name, address: l.address, notes: l.notes, type: c.type, containers: l.containers, bizOpen: l.bizOpen, bizClose: l.bizClose, located: l.located !== false, x: l.x, y: l.y }); dirty = true; };
  if (isNew && o.customerId && q.customer(o.customerId)) fill(q.customer(o.customerId));
  const blurAndRefresh = () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); page.refresh(); };
  const syncSave = () => { const b = page.navbar.querySelector('.nav-trail .nav-btn'); if (b) b.disabled = !f.title.trim(); };

  function lookup(text) {
    clearTimeout(timer); if (!matchBox) return;
    if (f.customerId || text.trim().length < 2) return matchBox.replaceChildren();
    matchBox.replaceChildren(h('div.section-header', 'Matching customers'), h('div.cells', h('div.row', ui.spinner(18), h('div.row-main.secondary', 'Looking up customers…'))));
    timer = setTimeout(() => {
      const found = q.searchCustomers(text, 4);
      matchBox.replaceChildren(h('div.section-header', found.length ? 'Matching customers' : 'No matching customer'),
        found.length ? h('div.cells', found.map(m => ui.row({ leading: ui.avatar(m.customer.name, { size: 34 }), title: m.customer.name, subtitle: m.match, trailing: h('span', { style: 'color:var(--tint);font-size:15px' }, 'Use'), onTap: () => { fill(m.customer); blurAndRefresh(); ui.toast('Filled from ' + m.customer.name, 'checkmark'); } })))
          : h('div.section-footer', { style: 'padding-top:0' }, 'Saving creates a new customer from this job. Likely duplicates are flagged for merging.'));
    }, 260 + Math.random() * 240);
  }
  function suggest(text) {
    if (!suggestBox) return; const s = text.trim().toLowerCase(); if (s.length < 3) return suggestBox.replaceChildren();
    const known = data.customers.flatMap(c => c.locations.map(l => ({ title: l.address.split(',')[0], sub: c.name + ' · Lakemont', l }))).filter(x => x.title.toLowerCase().includes(s) || x.sub.toLowerCase().includes(s));
    const made = ['St', 'Ave', 'Blvd'].map((suffix, i) => ({ title: text.trim().replace(/\b\w/g, m => m.toUpperCase()) + (/\b(st|ave|blvd|rd|dr|ln|way|ct)\b/i.test(s) ? '' : ' ' + suffix), sub: ['Lakemont', 'North Lakemont', 'Harbor District'][i], l: { x: 200 + i * 230, y: 300 + i * 150 } }));
    const items = known.concat(/\d/.test(s) ? made : []).slice(0, 10);
    suggestBox.replaceChildren(items.length ? h('div.cells', { style: 'margin-top:8px' }, items.map(x => ui.row({ icon: 'mappin', iconPlain: true, iconColor: 'var(--red)', title: x.title, subtitle: x.sub, onTap: () => { f.address = x.title + ', Lakemont'; f.located = true; f.x = x.l.x; f.y = x.l.y; dirty = true; blurAndRefresh(); } }))) : '');
  }
  async function save(p) {
    if (!f.title.trim()) return;
    let scope = 'This job';
    if (job && job.recurring) { scope = await ui.actionSheet({ title: 'Save changes to a recurring job', message: 'Changing “this and following” ends the old series and starts a new one in a single step.', buttons: SCOPES.map(l => ({ label: l })) }); if (!scope) return; }
    if (!f.address.trim()) f.located = false; else if (f.x == null) { f.located = /\d/.test(f.address); if (f.located) { f.x = 150 + Math.random() * 700; f.y = 150 + Math.random() * 700; } }
    let newCustomer = null;
    if (isNew && !f.customerId && f.type !== 'meet' && f.address.trim()) {
      newCustomer = { id: 'c' + (900 + data.customers.length), name: f.title.trim(), kind: 'company', route: f.routeId, lifecycle: 'scheduled', channel: 'Other', type: f.type, freq: f.repeat === 'none' ? 'One time' : ruleLabel(f), contacts: [], owner: S.me.id, nextAction: null, notes: '', tags: [], successful: false,
        locations: [{ id: 'l' + Date.now(), label: 'Main office', address: f.address, x: f.x, y: f.y, containers: f.containers, bizOpen: f.bizOpen, bizClose: f.bizClose, notes: f.notes, located: f.located }], stats: { jobs: 0, invoiced: 0, paid: 0, balance: 0, lastService: null, firstInvoice: null, rate: 85 } };
      data.customers.push(newCustomer); f.customerId = newCustomer.id;
    }
    const fields = { title: f.title.trim(), address: f.address.trim(), notes: f.notes, routeId: f.routeId, day: f.day, allDay: f.allDay, start: f.start, dur: f.dur, type: f.type, containers: f.containers, bizOpen: f.bizOpen, bizClose: f.bizClose, custFrom: f.custFrom, custUntil: f.custUntil, customerId: f.customerId, locationId: null, located: f.located, x: f.x, y: f.y };
    const series = job ? seriesJobs(job, scope) : [], me = S.me.name;
    api.op({ kind: isNew ? 'create' : 'edit', title: fields.title, scope: isNew ? (f.repeat === 'none' ? 'New job' : 'New recurring job') : scope, jobIds: job ? [job.id, ...series.map(j => j.id)] : [], apply() {
      const recurring = f.repeat === 'none' ? null : { rule: ruleLabel(f), seriesId: job && job.recurring && scope === 'All jobs' ? job.recurring.seriesId : 's-' + Date.now() };
      if (job) {
        Object.assign(job, fields, { recurring: wasRecurring && scope === 'This job' ? job.recurring : recurring }); job.events.push({ at: +WD.now(), actor: me, text: 'Edited' + (scope !== 'This job' ? ' (' + scope.toLowerCase() + ')' : '') });
        series.forEach(j => Object.assign(j, { title: fields.title, address: fields.address, notes: fields.notes, routeId: fields.routeId, start: fields.start, dur: fields.dur, allDay: fields.allDay, type: fields.type, containers: fields.containers, recurring: recurring || j.recurring }));
      } else {
        const make = day => WD.makeJob({ ...fields, day, recurring, attachments: f.attachments.slice(), events: [{ at: +WD.now(), actor: me, text: 'Created' }] }); make(f.day);
        if (recurring) { const stepDays = { daily: 1, weekly: 7, monthly: 28 }[f.repeat] * f.interval, max = f.ends === 'count' ? f.count : 60; for (let i = 1; i < max && i * stepDays <= 548; i++) { const day = D.add(f.day, i * stepDays); if (f.ends === 'until' && day > f.until) break; make(day); } }
      }
    } });
    p.dismiss();
    if (newCustomer) setTimeout(() => ui.toast('New customer created: ' + newCustomer.name, 'person.badge.plus', 2600), 500);
    guard('board', 'show', f.day, job ? job.id : (data.jobs[data.jobs.length - 1] || {}).id);
  }

  ui.sheet({ title: isNew ? 'New job' : 'Edit job',
    leading: [{ label: 'Cancel', onTap: async p => { if (dirty && !(await ui.actionSheet({ buttons: [{ label: 'Discard changes', role: 'destructive' }], cancel: 'Keep editing' }))) return; p.dismiss(); } }],
    trailing: () => [{ label: isNew ? 'Add' : 'Save', bold: true, disabled: !f.title.trim(), onTap: save }],
    onClose: () => clearTimeout(timer),
    render(p) {
      page = p; matchBox = h('div.jb-match'); suggestBox = h('div');
      const cust = q.customer(f.customerId), set = (k, v, re) => { f[k] = v; dirty = true; if (re) p.refresh(); };
      const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[f.repeat];
      return ui.list(
        ui.section({ header: 'Job', footer: cust ? null : 'Type a name, phone, email or address to find an existing customer.' },
          ui.inputRow({ placeholder: 'Customer or job title', value: f.title, caps: 'words', autofocus: isNew && !f.title, onInput: v => { f.title = v; dirty = true; syncSave(); lookup(v); } }),
          cust && ui.row({ leading: ui.avatar(cust.name, { size: 34 }), title: cust.name, subtitle: 'Linked customer', trailing: h('button', { style: 'border:0;background:none;color:var(--tint);font-size:15px;cursor:pointer', onclick: e => { e.stopPropagation(); f.customerId = null; dirty = true; p.refresh(); } }, 'Unlink') })),
        matchBox,
        ui.section({ header: 'Address', footer: f.address && !f.located && f.x == null ? null : null },
          ui.inputRow({ icon: 'mappin', placeholder: 'Street address or any text', value: f.address, onInput: v => { f.address = v; f.x = null; f.located = false; dirty = true; suggest(v); if (!f.title.trim()) lookup(v); } })),
        suggestBox,
        ui.section('Schedule',
          ui.pickerRow({ title: 'Route', value: f.routeId, options: q.routes().filter(r => r.writable).map(r => ({ value: r.id, label: q.routeName(r) })), onChange: v => set('routeId', v, true) }),
          ui.toggleRow({ title: 'All-day', value: f.allDay, onChange: v => set('allDay', v, true) }),
          ui.dateRow({ title: 'Date', value: f.day, onChange: v => set('day', v) }),
          !f.allDay && ui.timeRow({ title: 'Starts', value: fmt.hhmm(f.start), onChange: v => { const m = fmt.fromHHMM(v); if (m != null) set('start', m, true); } }),
          !f.allDay && ui.timeRow({ title: 'Ends', value: fmt.hhmm(f.start + f.dur), onChange: v => { const m = fmt.fromHHMM(v); if (m != null) set('dur', Math.max(5, m - f.start), true); } })),
        ui.section({ header: 'Repeat', footer: f.repeat === 'none' ? null : ruleLabel(f) + '. Each visit is created ahead of time for the next 18 months.' },
          ui.pickerRow({ title: 'Repeat', value: f.repeat, options: REPEATS, onChange: v => set('repeat', v, true) }),
          f.repeat !== 'none' && ui.row({ title: 'Every', detail: f.interval + ' ' + unit + (f.interval > 1 ? 's' : ''), trailing: ui.stepper(f.interval, 1, 12, v => set('interval', v, true)) }),
          f.repeat !== 'none' && ui.pickerRow({ title: 'Ends', value: f.ends, options: [{ value: 'never', label: 'Never' }, { value: 'count', label: 'After a number of visits' }, { value: 'until', label: 'On a date' }], onChange: v => set('ends', v, true) }),
          f.repeat !== 'none' && f.ends === 'count' && ui.row({ title: 'Visits', detail: f.count, trailing: ui.stepper(f.count, 1, 60, v => set('count', v, true)) }),
          f.repeat !== 'none' && f.ends === 'until' && ui.dateRow({ title: 'Last visit by', value: f.until, onChange: v => set('until', v) })),
        ui.section({ header: 'Service', footer: f.type === 'creditCard' ? 'Card-on-file jobs are charged automatically when the stop is completed.' : 'AutoRoute keeps arrivals inside these windows.' },
          ui.pickerRow({ title: 'Job type', value: f.type, options: WD.jobTypes.map(t => ({ value: t.id, label: t.title })), onChange: v => set('type', v, true) }),
          ui.inputRow({ label: 'Containers', placeholder: 'e.g. 2 consoles', value: f.containers, onInput: v => set('containers', v) }),
          ui.timeRow({ title: 'Business opens', value: f.bizOpen, onChange: v => set('bizOpen', v) }), ui.timeRow({ title: 'Business closes', value: f.bizClose, onChange: v => set('bizClose', v) }),
          ui.timeRow({ title: 'Customer from', value: f.custFrom, onChange: v => set('custFrom', v) }), ui.timeRow({ title: 'Customer until', value: f.custUntil, onChange: v => set('custUntil', v) })),
        ui.section('Notes', ui.inputRow({ multiline: true, placeholder: 'Access notes, contact, what to bring', value: f.notes, onInput: v => set('notes', v) })),
        isNew && ui.section('Attachments', f.attachments.map(attachmentRow), ui.row({ title: 'Add photo or file', icon: 'paperclip', iconPlain: true, tint: true, onTap: () => addAttachment(f.attachments) })));
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
    box.replaceChildren(found.length ? ui.list(groups.map(([name, test]) => ui.section(name, found.filter(test).map(j => ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: fmt.day(j.day) + (j.allDay ? ' · all day' : ' · ' + fmt.time(j.start)) + ' · ' + q.routeName(j.routeId), trailing: icon(WD.jobStatuses[j.status].icon, 18, WD.jobStatuses[j.status].color), onTap: () => openDetails(j.id) })))))
      : ui.empty({ icon: 'magnifyingglass', title: 'No jobs', text: 'Nothing on your selected routes matches “' + s + '”.' }));
  }
  function run(p) { clearTimeout(timer); loading = text.trim().length >= 2; fill(p); if (loading) timer = setTimeout(() => { loading = false; fill(p); }, 300 + Math.random() * 350); }
  ui.sheet({ title: 'Search', live: false, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], onClose: () => clearTimeout(timer),
    search: { placeholder: 'Jobs, customers, phone, address', autofocus: true, onInput: (v, p) => { text = v; run(p); } },
    render(p) { box = h('div'); setTimeout(() => fill(p), 0);
      return [h('div.jb-seg', ui.segmented([{ value: 'jobs', label: 'Jobs' }, WD.can('crm.view') && { value: 'customers', label: 'Customers' }].filter(Boolean), scope, v => { scope = v; run(p); })), box]; } });
}

/* ================= AutoRoute ================= */
const ETA = start => { const from = Math.floor(start / 60) * 60, w = start < 600 ? 120 : start < 780 ? 180 : 240; return { from, to: from + w }; };
async function openAutoRoute(routeId) {
  if (!routeId) { routeId = await ui.actionSheet({ title: 'AutoRoute which route?', message: fmt.day(S.board.day, 'long'), buttons: q.visibleRoutes().map(r => ({ label: q.routeName(r), value: r.id })) }); if (!routeId) return; }
  const day = S.board.day, route = q.route(routeId), color = q.routeColor(route), all = q.jobsFor(routeId, day).filter(j => !j.allDay), todo = all.filter(j => j.status === 'scheduled' && !j.pending);
  const stops = todo.filter(j => j.located && j.x != null), skipped = todo.filter(j => !stops.includes(j));
  const done = all.filter(j => j.status !== 'scheduled' && j.located).pop(), origin = done || data.depot, drive = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.05 + 3);
  const startAt = Math.max(day === D.today() ? WD.nowMins() + 5 : 0, done ? done.start + done.dur : 0, stops.length ? Math.min(...stops.map(j => j.start)) - 20 : 0);
  const stages = ['Driving times from Apple Maps', 'Service averages from the whole team’s visits', 'Business and customer windows'];
  let stage = 0, plan = null;
  function build() {
    const seq = list => { let at = origin, t = startAt, total = 0;
      const order = list.map(j => { const d = drive(at, j), arrive = Math.ceil(Math.max(t + d, fmt.fromHHMM(j.bizOpen) || 0, fmt.fromHHMM(j.custFrom) || 0) / 5) * 5; total += d; t = arrive + j.dur; at = j; return { job: j, drive: d, start: arrive, visits: 6 + (parseInt(j.id.slice(1), 10) * 7) % 23 }; });
      const home = drive(at, data.depot); return { order, drive: total + home, back: t + home }; };
    const left = stops.slice(), nearest = []; let at = origin;
    while (left.length) { left.sort((a, b) => drive(at, a) - drive(at, b)); at = left.shift(); nearest.push(at); }
    const current = seq(stops), best = seq(nearest), use = best.drive < current.drive ? best : current;
    plan = { order: use.order, driveNew: use.drive, driveOld: current.drive, back: use.back };
  }
  const sheet = ui.sheet({ title: 'AutoRoute', live: false, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => plan && plan.order.length ? [{ label: 'Accept', bold: true, onTap: p => {
      const order = plan.order;
      api.op({ kind: 'batch', title: q.routeName(route) + ' · AutoRoute', scope: order.length + ' jobs · all or nothing', jobIds: order.map(o => o.job.id), apply() { order.forEach(o => { o.job.start = o.start; if (!o.job.recurring) o.job.eta = ETA(o.start); o.job.events.push({ at: +WD.now(), actor: S.me.name, text: 'AutoRoute: arrive ' + fmt.time(o.start) }); }); } });
      p.dismiss(); ui.toast('Route accepted', 'checkmark'); guard('board', 'show', day);
    } }] : [],
    render() {
      if (!plan) return ui.list(ui.section({ header: q.routeName(route) + ' · ' + fmt.day(day), footer: 'Planning ' + stops.length + ' remaining stops' + (done ? ' from ' + done.title : ' from the shop') + '.' },
        stages.map((s, i) => h('div.jb-stage' + (i > stage ? '.wait' : ''), i < stage ? icon('checkmark.circle.fill', 22, 'var(--green)') : i === stage ? ui.spinner(20) : icon('circle', 22), s))));
      if (!plan.order.length) return ui.empty({ icon: 'route', title: 'Nothing to route', text: 'There are no unstarted, located jobs left on this route for ' + fmt.day(day) + '.' });
      const saved = plan.driveOld - plan.driveNew;
      return ui.list(
        ui.section(null, h('div.jb-plan', h('div.caption', q.routeName(route) + ' · ' + fmt.day(day, 'long')), h('div.big', fmt.dur(plan.driveNew) + ' driving'),
          h('div.subhead', saved > 0 ? h('span.save', 'Saves ' + fmt.dur(saved)) : h('span.secondary', 'Already the best order'), h('span.secondary', ' · ' + plan.order.length + ' stops · back at the shop about ' + fmt.time(plan.back))))),
        ui.section({ header: 'Proposed order', footer: 'Arrival times use driving time, the team’s recorded service averages, and the business and customer windows. One-time jobs also get a customer ETA window. Accepting changes every job together or none of them.' },
          plan.order.map((o, i) => ui.row({ leading: h('div.jb-num', { style: { '--c': color } }, i + 1), title: o.job.title,
            subtitle: [fmt.time(o.start) + (o.start !== o.job.start ? ' (was ' + fmt.time(o.job.start) + ')' : ''), o.drive + ' min drive', '~' + o.job.dur + ' min on site, ' + o.visits + ' visits'].join(' · ') + (o.job.recurring ? '' : ' · ETA ' + fmt.time(ETA(o.start).from) + '–' + fmt.time(ETA(o.start).to)) }))),
        skipped.length > 0 && ui.section({ header: 'Not routed', footer: 'These keep their current time. Stops without a confirmed address never get routing coordinates.' },
          skipped.map(j => ui.row({ leading: h('span.jb-q', { style: 'font-size:20px;width:26px;text-align:center' }, j.address ? '?' : '–'), title: j.title, subtitle: j.address ? 'Address not found: ' + j.address : 'No address' }))));
    } });
  const page = sheet.stack.top();
  for (stage = 0; stage < stages.length; stage++) { page.refresh(); await WD.delay(650, 1000); }
  build(); if (page.el.isConnected) page.refresh();
}

WD.screens.jobs = { openDetails, openEditor, openReassign, openSearch, openAutoRoute };
const firstToday = pred => data.jobs.filter(j => j.day === D.today() && !j.allDay && pred(j)).sort((a, b) => a.start - b.start)[0];
WD.panel.addJump('Job details', () => { WD.nav.switchTab('board'); const j = firstToday(x => x.status === 'arrived') || firstToday(() => true); if (j) openDetails(j.id); });
WD.panel.addJump('New job', () => { WD.nav.switchTab('board'); openEditor({ day: D.today(), routeId: 'r1', start: 14 * 60 }); });
WD.panel.addJump('Search', () => { WD.nav.switchTab('board'); openSearch(); });
WD.panel.addJump('AutoRoute', () => { let day = D.add(D.today(), 1); while ([0, 6].includes(D.parse(day).getDay())) day = D.add(day, 1); guard('board', 'show', day); openAutoRoute('r1'); });
})();
