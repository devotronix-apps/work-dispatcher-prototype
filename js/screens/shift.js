/* Shift tab: clock in/out on a route and vehicle, the next-stop status flow, GPS tracking state and past shifts (MIGRATION.md §8). */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, nav } = WD;
const MI = 0.03, DONE = { completed: 1, skipped: 1 }, CUTOFF_HRS = 14;
let inst = null, locationAuth = null, geofenceTimer = 0, uploading = 0, lastCompleted = null;
const mine = [];   // shifts finished in this session, newest first

WD.addIcons({ 'sh.cup': '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9zM16 10.500h1.500a2.500 2.500 0 0 1 0 5H16M8 3.500V6M11 3v3M14 3.500V6"/>' });

WD.css(`
.sh-card { background: var(--cell); border-radius: 12px; padding: 14px 16px; margin-top: 10px; }
.sh-card + .sh-card { margin-top: 12px; }
.sh-intro { display: flex; gap: 14px; align-items: flex-start; }
.sh-intro .ic { color: var(--tint); margin-top: 2px; }
.sh-cta { margin-top: 18px; }
.sh-head { border-left: 5px solid var(--c); }
.sh-head .sh-timer { font-size: 40px; line-height: 46px; font-weight: 300; letter-spacing: 0; font-variant-numeric: tabular-nums; margin: 4px 0 2px; }
.sh-head .sh-timer.paused { color: var(--orange); }
.sh-live { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--green); }
.sh-live i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 1.6s ease-in-out infinite; }
.sh-live.off { color: var(--label2); } .sh-live.off i { animation: none; }
.sh-live.brk { color: var(--orange); }
.sh-kicker { font-size: 13px; font-weight: 600; color: var(--label2); text-transform: uppercase; letter-spacing: -.08px; }
.sh-next .sh-top { display: flex; gap: 12px; align-items: flex-start; margin-top: 8px; }
.sh-next .sh-top > div { flex: 1; min-width: 0; }
.sh-num { width: 34px; height: 34px; border-radius: 50%; background: var(--c); border: 3px solid var(--ring); color: #fff; font-weight: 700; font-size: 15px; display: grid; place-items: center; flex: none; letter-spacing: 0; }
.sh-num.small { width: 26px; height: 26px; font-size: 11.5px; border-width: 2.5px; }
.sh-num.none { background: var(--fill); border-color: transparent; color: var(--label2); }
.sh-num.q { background: none; border: 2px solid var(--red); color: var(--red); font-weight: 900; }
.sh-lines { margin: 10px 0 2px; display: flex; flex-direction: column; gap: 6px; font-size: 15px; letter-spacing: -.24px; }
.sh-lines > div { display: flex; gap: 8px; align-items: flex-start; } .sh-lines .ic { color: var(--label2); margin-top: 1px; }
.sh-acts { display: flex; gap: 8px; margin-top: 14px; } .sh-acts .btn { flex: 1; min-height: 46px; padding: 0 8px; font-size: 16px; }
.sh-done { display: flex; gap: 12px; align-items: center; }
.sh-done > div { flex: 1; min-width: 0; }
.sh-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: var(--fill); margin: 4px 0 8px; }
.sh-bar i { display: block; height: 100%; }
.sh-legend { display: flex; gap: 14px; font-size: 13px; color: var(--label2); flex-wrap: wrap; }
.sh-legend span { display: inline-flex; align-items: center; gap: 5px; }
.sh-big { text-align: center; padding: 18px 16px 6px; }
.sh-big .v { font-size: 44px; font-weight: 700; letter-spacing: .3px; line-height: 50px; font-variant-numeric: tabular-nums; }
.sh-notice p { margin: 0 0 12px; font-size: 16px; line-height: 22px; letter-spacing: -.3px; }
.sh-notice b { font-weight: 600; }
.sh-pend { color: var(--orange); }
`);

/* ---------- Helpers ---------- */
const hm = mins => { mins = Math.max(0, Math.round(mins)); return mins < 60 ? mins + ' min' : Math.floor(mins / 60) + ' hr ' + (mins % 60) + ' min'; };
const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)), p = n => String(n).padStart(2, '0'); return Math.floor(s / 3600) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60); };
const routeOf = () => S.shift && q.route(S.shift.routeId);
const todayJobs = routeId => q.jobsFor(routeId, D.today()).filter(j => !j.allDay);
const remaining = routeId => todayJobs(routeId).filter(j => !DONE[j.status]);
const openDetails = id => { if (WD.screens.jobs && WD.screens.jobs.openDetails) WD.screens.jobs.openDetails(id); else ui.toast('Job details aren’t available', 'info.circle'); };
const numFor = (job, n, small) => n ? h('span.sh-num' + (small ? '.small' : ''), { style: { '--c': q.routeColor(job.routeId), '--ring': q.jobType(job.type).color || '#fff' } }, n)
  : h('span.sh-num.small' + (!job.located && job.address ? '.q' : '.none'), !job.located && job.address ? '?' : '–');
const defaultRoute = () => (q.routes().find(r => r.driverId === (S.me && S.me.id)) || q.routes()[0]);
/** What the truck is doing right now, from the route's job statuses (works with location off too). */
function activity(sh) { const js = todayJobs(sh.routeId); return js.some(j => j.status === 'arrived') ? 'service' : js.some(j => j.status === 'enroute') ? 'drive' : 'idle'; }
const lowPower = sh => sh.lowPower || sh.battery < 20;
function elapsed(sh) { const now = +WD.now(); return now - sh.startedAt - sh.breakMs - (sh.onBreak ? now - sh.breakStartedAt : 0); }
function sampling(sh) {
  if (sh.location === 'denied') return 'Off · location not allowed';
  if (lowPower(sh)) return 'Low Power · 2–5 min batches';
  return activity(sh) === 'drive' ? 'Moving · every 30 s' : 'Parked · GPS off, heartbeat 5 min';
}
function liveVals() {
  const sh = S.shift; if (!sh) return {};
  return { timer: sh.onBreak ? 'On break' : clock(elapsed(sh)), lastFix: sh.location === 'denied' ? 'None' : sh.lastFix ? fmt.rel(sh.lastFix).replace('Just now', Math.max(0, Math.round((+WD.now() - sh.lastFix) / 1000)) + ' s ago') : 'Waiting…',
    sent: String(sh.pointsSent), queued: String(sh.pointsQueued), sampling: sampling(sh), battery: sh.battery + '%', miles: sh.miles.toFixed(1) + ' mi', accuracy: sh.location === 'denied' ? '—' : activity(sh) === 'drive' ? '±8 m' : '±15 m' };
}

/* ---------- Background ticker: one for the whole module, so rebuilding tabs never duplicates it ---------- */
setInterval(() => {
  const sh = S.shift; if (!sh) return;
  const mode = activity(sh); sh.tick++;
  if (!sh.onBreak) sh[mode + 'Sec']++;
  if (sh.tick % 120 === 0 && sh.battery > 3) sh.battery--;
  if (sh.location !== 'denied') {
    const moving = mode === 'drive';
    if (moving ? sh.tick % 2 === 0 : sh.tick % 30 === 0) { sh.pointsQueued++; sh.lastFix = +WD.now(); }
    const t = (data.trucks || []).find(x => x.routeId === sh.routeId);
    if (t) { if (sh.lx != null) sh.miles += Math.hypot(t.x - sh.lx, t.y - sh.ly) * MI * 1.35; sh.lx = t.x; sh.ly = t.y; } else if (moving) sh.miles += 0.03;
    if (!S.offline && !uploading && sh.pointsQueued && sh.tick % (lowPower(sh) ? 20 : 5) === 0) { sh.pointsSent += sh.pointsQueued; sh.pointsQueued = 0; sh.lastUpload = +WD.now(); }
  }
  if (+WD.now() - sh.startedAt > CUTOFF_HRS * 36e5) { S.shift = null; ui.banner({ title: 'Tracking stopped', text: 'You were clocked out automatically 14 hours after clock-in.', icon: 'location', color: 'var(--gray)' }); WD.changed(); return; }
  if (inst) inst.paint();
}, 1000);
WD.on('network', online => {
  const sh = S.shift; if (!online || !sh || !sh.pointsQueued) return;
  uploading = sh.pointsQueued; WD.changed();
  setTimeout(() => { const s = S.shift; if (s) { s.pointsSent += s.pointsQueued; s.pointsQueued = 0; s.lastUpload = +WD.now(); } uploading = 0; WD.changed(); }, 1600);
});

/* ---------- Past shifts ---------- */
function pastShift(routeId, day) {
  const jobs = q.jobsFor(routeId, day).filter(j => !j.allDay && (j.arrivedAt != null || j.status === 'skipped')), done = jobs.filter(j => j.status === 'completed');
  if (!done.length) return null;
  const start = done[0].arrivedAt - 25, end = done[done.length - 1].departedAt + 35, service = done.reduce((s, j) => s + (j.departedAt - j.arrivedAt), 0);
  let dist = 0, prev = data.depot; done.forEach(j => { dist += Math.hypot(j.x - prev.x, j.y - prev.y); prev = j; }); dist += Math.hypot(prev.x - data.depot.x, prev.y - data.depot.y);
  const miles = dist * MI * 1.35, total = end - start, drive = Math.min(total - service, miles / 24 * 60);
  const r = q.route(routeId);
  return { day, routeId, vehicleId: r.vehicleId, start, end, miles, drive, service, idle: Math.max(0, total - service - drive), completed: done.length, skipped: jobs.length - done.length, points: Math.round(drive * 2 + (total - drive) / 5), jobs };
}
function history() {
  const r = defaultRoute(), out = []; if (!r) return out;
  for (let n = 1; out.length < 5 && n < 12; n++) { const s = pastShift(r.id, D.add(D.today(), -n)); if (s) out.push(s); }
  return mine.concat(out).slice(0, 5 + mine.length);
}
function splitBar(s) {
  const tot = Math.max(1, s.drive + s.service + s.idle), seg = (v, c) => h('i', { style: { width: (v / tot * 100).toFixed(1) + '%', background: c } });
  return h('div', { style: { padding: '12px 16px' } }, h('div.sh-bar', seg(s.drive, 'var(--blue)'), seg(s.service, 'var(--orange)'), seg(s.idle, 'var(--gray)')),
    h('div.sh-legend', [['Driving', s.drive, 'var(--blue)'], ['On site', s.service, 'var(--orange)'], ['Idle', s.idle, 'var(--gray)']].map(([l, v, c]) => h('span', ui.dot(c), l + ' ' + hm(v)))));
}
function shiftDetail(s) {
  return { title: fmt.day(s.day, 'short'), render: () => ui.list(
    ui.section('Summary', ui.row({ title: 'Route', detail: q.routeName(s.routeId), leading: ui.dot(q.routeColor(s.routeId)) }), ui.row({ title: 'Vehicle', detail: (q.vehicle(s.vehicleId) || {}).name || '—' }),
      ui.row({ title: 'Clocked in', detail: fmt.time(s.start) }), ui.row({ title: 'Clocked out', detail: fmt.time(s.end) }), ui.row({ title: 'Hours', detail: hm(s.end - s.start) }),
      ui.row({ title: 'Stops', detail: s.completed + ' completed' + (s.skipped ? ' · ' + s.skipped + ' skipped' : '') }), ui.row({ title: 'Miles', detail: s.miles.toFixed(1) + ' mi' })),
    ui.section({ header: 'Time', footer: 'Driving and on-site time come from the GPS trail and geofence visits.' }, splitBar(s)),
    ui.section('Timeline', ui.row({ title: 'Clocked in', subtitle: fmt.time(s.start), icon: 'play.fill', iconColor: 'var(--green)' }),
      s.jobs.map((j, i) => ui.row({ leading: numFor(j, i + 1, true), title: j.title, subtitle: j.status === 'skipped' ? 'Skipped' : 'Arrived ' + fmt.time(j.arrivedAt) + ' · left ' + fmt.time(j.departedAt) + ' · ' + hm(j.departedAt - j.arrivedAt) + ' on site',
        trailing: icon(WD.jobStatuses[j.status].icon, 18, WD.jobStatuses[j.status].color), onTap: () => openDetails(j.id) })),
      ui.row({ title: 'Clocked out', subtitle: fmt.time(s.end), icon: 'stop.fill', iconColor: 'var(--red)' }))) };
}

/* ---------- Consent, clock in, clock out ---------- */
function openNotice() {
  ui.sheet({ title: 'Location tracking', leading: [{ label: 'Not now', onTap: p => p.dismiss() }], render: p => ui.list(
    h('div.sh-card.sh-notice',
      h('p', h('b', 'When. '), 'Work Dispatcher records this iPhone’s location only while you’re clocked in to a shift. It stops when you clock out, or automatically 14 hours after clock-in.'),
      h('p', h('b', 'What. '), 'Position, speed and heading about every 30 seconds while moving, a check-in every 5 minutes while parked, stop arrival and departure times, and phone battery level.'),
      h('p', h('b', 'Who sees it. '), 'Owners, admins and dispatchers with the Live truck map permission. It is used for routing, customer arrival windows and service records.'),
      h('p', h('b', 'How long. '), 'Raw points are kept for 24 months and then thinned. Stop visits stay with the job history.'),
      h('p', { style: { marginBottom: 0 } }, 'You can review this notice any time in Settings.')),
    h('div.sh-cta', ui.button('I understand and agree', { onTap: () => { S.tracking = { consent: true, consentAt: +WD.now() }; WD.changed(); p.dismiss(); ui.toast('Notice accepted', 'checkmark'); } }))) });
}
async function askLocation() {
  if (locationAuth) return locationAuth;
  const v = await ui.alert({ title: 'Allow “Work Dispatcher” to use your location?', message: 'Your location is shared with dispatch only while you’re clocked in, so they can see your truck and record stop arrivals.',
    buttons: [{ label: 'Allow While Using App', value: 'whenInUse' }, { label: 'Allow Always', value: 'always' }, { label: 'Don’t Allow', value: 'denied' }] });
  return (locationAuth = v);
}
async function clockIn(routeId, vehicleId) {
  const loc = await askLocation();
  const ok = await ui.run('Clocking in…', () => {
    S.shift = { routeId, vehicleId, startedAt: +WD.now(), onBreak: false, breakStartedAt: null, breakMs: 0, pointsQueued: 0, pointsSent: 0, lastUpload: null, lastFix: null, miles: 0,
      location: loc, lowPower: false, battery: 78, driveSec: 0, serviceSec: 0, idleSec: 0, tick: 0, lx: null, ly: null };
  }, { offlineOK: true, done: 'On shift' });
  if (ok && S.offline) ui.toast('Clock-in syncs when you’re back online', 'wifi.slash', 2600);
}
async function clockOut() {
  const sh = S.shift, r = routeOf(), left = remaining(sh.routeId).length;
  const v = await ui.actionSheet({ title: 'Clock out?', message: left ? left + ' stop' + (left === 1 ? '' : 's') + ' on ' + q.routeName(r) + (left === 1 ? ' isn’t' : ' aren’t') + ' done yet. ' + (left === 1 ? 'It stays' : 'They stay') + ' on the route for dispatch.' : 'Tracking stops as soon as you clock out.',
    buttons: [{ label: 'Clock out', value: true, role: 'destructive' }] });
  if (!v || S.shift !== sh) return;
  await ui.run('Clocking out…', () => { if (!S.offline) { sh.pointsSent += sh.pointsQueued; sh.pointsQueued = 0; } }, { offlineOK: true, done: 'Clocked out' });
  const startM = Math.round((sh.startedAt - +new Date(D.parse(D.today()).setHours(0, 0, 0, 0))) / 60000), js = todayJobs(sh.routeId).filter(j => j.arrivedAt != null || j.status === 'skipped');
  const sum = { day: D.today(), routeId: sh.routeId, vehicleId: sh.vehicleId, start: startM, end: WD.nowMins(), miles: sh.miles, drive: sh.driveSec / 60, service: sh.serviceSec / 60, idle: sh.idleSec / 60,
    completed: js.filter(j => j.status === 'completed').length, skipped: js.filter(j => j.status === 'skipped').length, points: sh.pointsSent + sh.pointsQueued, queued: sh.pointsQueued, jobs: js };
  clearTimeout(geofenceTimer); lastCompleted = null; S.shift = null; mine.unshift(sum); WD.changed();
  ui.sheet({ title: 'Shift summary', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: () => ui.list(
    h('div.sh-big', h('div.v', hm(sum.end - sum.start)), h('div.footnote', q.routeName(sum.routeId) + ' · ' + fmt.time(sum.start) + ' – ' + fmt.time(sum.end))),
    ui.section(null, ui.row({ title: 'Stops completed', detail: String(sum.completed) }), ui.row({ title: 'Stops skipped', detail: String(sum.skipped) }), ui.row({ title: 'Miles', detail: sum.miles.toFixed(1) + ' mi' }),
      ui.row({ title: 'Location points', detail: String(sum.points) + (sum.queued ? ' · ' + sum.queued + ' waiting' : '') })),
    ui.section({ header: 'Time', footer: sum.queued ? 'Points still on this iPhone upload when you’re back online.' : 'Tracking has stopped.' }, splitBar(sum))) }, { detent: 'large' });
}

/* ---------- Stop status flow ---------- */
const setStatus = (id, s, note) => WD.api.setStatus(id, s, note);
function armGeofence(job) {
  clearTimeout(geofenceTimer); if (!S.shift || S.shift.location === 'denied') return;
  geofenceTimer = setTimeout(() => { const j = q.job(job.id); if (!S.shift || !j || j.status !== 'enroute') return;
    setStatus(j.id, 'arrived', 'detected by geofence'); ui.banner({ title: 'Work Dispatcher', text: 'Arrived at ' + j.title + ' — detected by geofence', icon: 'mappin', color: 'var(--orange)' }); }, 6000);
}
async function skip(job) {
  let why = await ui.actionSheet({ title: 'Skip this stop?', message: 'Dispatch sees the reason on the job.', buttons: ['Office closed', 'No access', 'Customer asked to skip', 'Other'].map(label => ({ label })) });
  if (why === 'Other') { const r = await ui.alert({ title: 'Why are you skipping?', input: { placeholder: 'Reason' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Skip', value: true, bold: true }] }); why = r && r.value ? (r.text.trim() || 'Other') : null; }
  if (why) { clearTimeout(geofenceTimer); setStatus(job.id, 'skipped', why); ui.toast('Stop skipped', 'xmark.circle.fill'); }
}
function openCamera(job) {
  let shot = false, note = '', sending = false;
  ui.sheet({ title: 'Add photo or note', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], render(p) {
    const finder = h('div', { style: { height: '250px', borderRadius: '14px', background: shot ? 'linear-gradient(160deg,#8a8f98,#4a4f57)' : 'linear-gradient(160deg,#2b2f36,#0d0f12)', display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center', margin: '10px 0' } },
      shot ? h('div', icon('photo', 44, '#fff'), h('div.subhead', { style: { marginTop: '6px' } }, 'Photo ready'), h('button.btn.plain', { style: { color: '#fff' }, onclick: () => { shot = false; p.refresh(); } }, 'Retake'))
        : h('div', h('div.footnote', { style: { color: 'rgba(255,255,255,.75)', marginBottom: '16px' } }, 'Point at the console tag or certificate'),
          h('button', { 'aria-label': 'Take photo', style: { width: '66px', height: '66px', borderRadius: '50%', border: '4px solid #fff', background: 'rgba(255,255,255,.9)', boxShadow: '0 0 0 3px rgba(0,0,0,.4) inset', cursor: 'pointer' }, onclick: () => { shot = true; p.refresh(); } })));
    const attach = async () => {
      if (!shot && !note.trim()) return ui.toast('Take a photo or write a note', 'info.circle');
      sending = true; p.refresh(); const bar = p.body.querySelector('.progress > i');
      if (!S.offline) for (let i = 1; i <= 10; i++) { await WD.delay(110, 220); if (bar) bar.style.width = i * 10 + '%'; }
      WD.api.op({ kind: 'edit', title: job.title, scope: shot ? 'Photo added' : 'Note added', jobIds: [job.id], apply() {
        if (shot) job.attachments.push({ id: 'a' + Date.now(), name: 'Stop photo ' + fmt.clock(WD.now()) + '.jpg', kind: 'photo', size: '1.9 MB' });
        if (note.trim()) job.events.push({ at: +WD.now(), actor: S.me.name, text: 'Note — ' + note.trim() }); } });
      if (lastCompleted === job.id) lastCompleted = null; p.dismiss(); ui.toast(S.offline ? 'Saved · uploads when online' : 'Attached to the job', 'checkmark');
    };
    return ui.list(h('div.headline', { style: { padding: '4px 4px 0' } }, job.title), finder,
      ui.section(null, ui.inputRow({ placeholder: 'Note for the office (optional)', value: note, multiline: true, onInput: v => { note = v; } })),
      sending ? h('div', { style: { padding: '18px 4px' } }, h('div.footnote', { style: { marginBottom: '8px' } }, S.offline ? 'Saving on this iPhone…' : 'Uploading…'), ui.progress(0))
        : h('div.sh-cta', ui.button('Attach', { icon: 'paperclip', onTap: attach })));
  } });
}

/* ---------- Page ---------- */
function offShift(m) {
  const routes = q.routes(), r = q.route(m.routeId) || defaultRoute(), consent = S.tracking && S.tracking.consent;
  if (!r) return ui.empty({ icon: 'truck', title: 'No routes', text: 'Ask the office to add a route.' });
  const veh = m.vehicleId || r.vehicleId;
  return ui.list(
    h('div.sh-card.sh-intro', icon('location', 30), h('div', h('div.headline', 'Clock in to start your route'), h('div.footnote', { style: { marginTop: '3px' } }, 'Your location is shared with dispatch only while you’re on a shift. Tracking stops when you clock out.'))),
    ui.section('Route and vehicle',
      ui.pickerRow({ title: 'Route', icon: 'route', iconColor: q.routeColor(r), value: r.id, options: routes.map(x => ({ value: x.id, label: q.routeName(x) })), onChange: v => { m.routeId = v; m.vehicleId = null; inst.page && inst.page.refresh(); } }),
      ui.pickerRow({ title: 'Vehicle', icon: 'truck', iconColor: 'var(--gray)', value: veh, options: data.vehicles.map(v => ({ value: v.id, label: v.name })), onChange: v => { m.vehicleId = v; inst.page && inst.page.refresh(); } })),
    consent ? ui.section({ footer: 'You agreed to the location tracking notice on ' + fmt.day(D.key(new Date(S.tracking.consentAt || +WD.now())), 'md') + '.' }, ui.row({ title: 'Location tracking notice', icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', chevron: true, onTap: openNotice }))
      : ui.section({ footer: 'You need to agree before your first shift.' }, ui.row({ title: 'Location tracking notice', subtitle: 'Review and agree', icon: 'hand.raised', iconColor: 'var(--orange)', chevron: true, onTap: openNotice })),
    h('div.sh-cta', ui.button('Clock in', { icon: 'play.fill', disabled: !consent, onTap: () => clockIn(r.id, veh) })),
    locationAuth === 'denied' && h('div', { style: { marginTop: '10px' } }, ui.note('Location is off for Work Dispatcher. You can still clock in and report stops with the buttons; geofence arrivals and the live map won’t work.')),
    ui.section('Recent shifts', history().map(s => ui.row({ title: fmt.day(s.day, 'rel'), subtitle: q.routeName(s.routeId) + ' · ' + s.completed + ' stops · ' + s.miles.toFixed(1) + ' mi', detail: hm(s.end - s.start), chevron: true, onTap: () => nav.push(shiftDetail(s)) }))));
}
function nextCard(r) {
  const stop = q.stops(r.id, D.today()).find(s => !DONE[s.job.status]);
  if (!stop) return h('div.sh-card.sh-done', icon('checkmark.circle.fill', 34, 'var(--green)'), h('div', h('div.headline', remaining(r.id).length ? 'No more mapped stops' : 'All stops done'), h('div.footnote', remaining(r.id).length ? 'The jobs left need an address or are meet-the-truck jobs.' : 'Head back to the shop and clock out.')));
  const job = stop.job, sx = WD.jobStatuses[job.status], b = (label, kind, fn, ic) => ui.button(label, { kind, icon: ic, block: false, onTap: fn });
  const flow = { scheduled: [b('Start driving', 'filled', () => { setStatus(job.id, 'enroute'); armGeofence(job); }, 'truck')], enroute: [b('I’ve arrived', 'filled', () => { clearTimeout(geofenceTimer); setStatus(job.id, 'arrived'); }, 'mappin')],
    arrived: [b('Complete stop', 'filled', () => { setStatus(job.id, 'completed'); lastCompleted = job.id; ui.toast('Stop completed', 'checkmark'); }, 'checkmark')] }[job.status] || [];
  return h('div.sh-card.sh-next',
    h('div.hstack', h('span.sh-kicker', 'Next stop'), h('span.spacer'), ui.badge(sx.title, sx.color), job.pending && ui.badge('Pending sync', 'var(--orange)')),
    h('div.sh-top', numFor(job, stop.number), h('div', h('div.title3', job.title), h('div.subhead.secondary', job.address))),
    h('div.sh-lines', h('div', icon('clock', 17), h('span', fmt.range(job.start, job.dur) + (job.eta ? ' · window ' + fmt.time(job.eta.from) + ' – ' + fmt.time(job.eta.to) : ''))),
      job.containers && h('div', icon('shippingbox', 17), h('span', job.containers)), job.notes && h('div', icon('note', 17), h('span', job.notes))),
    h('div.sh-acts', flow, b('Navigate', 'gray', () => ui.toast('Opening Apple Maps…', 'map'), 'arrow.triangle.turn.up.right')),
    h('div.sh-acts', { style: { marginTop: '8px' } }, b('Details', 'plain', () => openDetails(job.id), 'info.circle'), b('Skip…', 'plain', () => skip(job), 'xmark.circle.fill')));
}
function onShift() {
  const sh = S.shift, r = routeOf(), v = liveVals(), denied = sh.location === 'denied', veh = q.vehicle(sh.vehicleId);
  if (!r) return ui.empty({ icon: 'truck', title: 'Route not found' });
  const span = k => h('span', { 'data-sh': k }, v[k]), numbers = new Map(q.stops(r.id, D.today()).map(s => [s.job.id, s.number])), done = lastCompleted && q.job(lastCompleted);
  return ui.list(
    h('div.sh-card.sh-head', { style: { '--c': q.routeColor(r) } },
      h('div.hstack', h('span.sh-kicker', 'On shift since ' + fmt.clock(new Date(sh.startedAt))), h('span.spacer'),
        sh.onBreak ? h('span.sh-live.brk', h('i'), 'On break') : denied ? h('span.sh-live.off', h('i'), 'Location off') : h('span.sh-live', h('i'), 'Tracking active')),
      h('div.sh-timer' + (sh.onBreak ? '.paused' : ''), { 'data-sh': 'timer' }, v.timer),
      h('div.subhead', ui.dot(q.routeColor(r)), ' ', q.routeName(r), h('span.secondary', ' · ' + (veh ? veh.name : 'No vehicle') + ' · ', span('miles')))),
    done && h('div.sh-card.sh-done', icon('checkmark.circle.fill', 30, 'var(--green)'), h('div', h('div.headline', done.title), h('div.footnote', 'Completed ' + (done.departedAt != null ? fmt.time(done.departedAt) : ''))),
      ui.button('Add photo or note', { kind: 'tinted', small: true, block: false, icon: 'camera', onTap: () => openCamera(done) })),
    nextCard(r),
    ui.section('Today · ' + q.routeName(r), q.jobsFor(r.id, D.today()).map(j => { const sx = WD.jobStatuses[j.status];
      return ui.row({ leading: numFor(j, numbers.get(j.id), true), title: j.title, subtitle: (j.allDay ? 'All day' : fmt.range(j.start, j.dur)) + (!j.located && j.address ? ' · address not found' : '') + (j.pending ? ' · waiting to sync' : ''),
        trailing: h('span.hstack', { style: { gap: '6px' } }, j.pending && icon('sync', 16, 'var(--orange)'), j.allDay ? null : icon(sx.icon, 18, sx.color)), onTap: () => openDetails(j.id) }); })),
    ui.section({ header: 'Tracking', footer: denied ? 'Location isn’t allowed, so nothing is recorded. Use the status buttons to report stops.' : 'Points are thinned to one every 30 seconds and upload in small batches. Without a connection they wait on this iPhone.' },
      ui.row({ title: 'Last location', detail: span('lastFix'), icon: 'location.fill', iconColor: 'var(--blue)' }), ui.row({ title: 'Accuracy', detail: span('accuracy'), icon: 'scope', iconColor: 'var(--teal)' }),
      ui.row({ title: 'Points sent today', detail: span('sent'), icon: 'arrow.up', iconColor: 'var(--green)' }),
      uploading ? ui.row({ title: 'Uploading ' + uploading + ' points…', icon: 'cloud', iconColor: 'var(--indigo)', trailing: ui.spinner(18) })
        : ui.row({ title: 'Waiting to upload', subtitle: S.offline && sh.pointsQueued ? 'No connection · uploads when you’re back online' : null, detail: span('queued'), icon: 'tray', iconColor: S.offline ? 'var(--orange)' : 'var(--gray)' }),
      ui.row({ title: 'Sampling', subtitle: span('sampling'), icon: 'gauge', iconColor: 'var(--purple)' }), ui.row({ title: 'Phone battery', detail: span('battery'), icon: 'battery', iconColor: sh.battery < 20 ? 'var(--red)' : 'var(--green)' }),
      ui.toggleRow({ title: 'Low Power Mode', icon: 'bolt.fill', iconColor: 'var(--yellow)', value: sh.lowPower, onChange: on => { sh.lowPower = on; WD.changed(); } })),
    ui.section(null, ui.toggleRow({ title: 'Take a break', subtitle: 'Pauses your shift time', icon: 'sh.cup', iconColor: 'var(--orange)', value: sh.onBreak, onChange: on => {
      const now = +WD.now(); if (on) sh.breakStartedAt = now; else { sh.breakMs += now - sh.breakStartedAt; sh.breakStartedAt = null; } sh.onBreak = on; WD.changed(); } })),
    h('div.sh-cta', ui.button('Clock out', { kind: 'destructive', icon: 'stop.fill', onTap: clockOut })),
    h('div', { style: { marginTop: '10px' } }, ui.note('Tracking stops automatically ' + CUTOFF_HRS + ' hours after clock-in.')));
}
function root() {
  const r = defaultRoute(), m = inst = { routeId: r && r.id, vehicleId: null, page: null };
  m.paint = () => {
    const p = m.page; if (!p || !p.el.isConnected || nav.activeTab() !== 'shift' || !S.shift) return;
    const v = liveVals(); p.body.querySelectorAll('[data-sh]').forEach(e => { const val = v[e.dataset.sh]; if (val != null && e.textContent !== val) e.textContent = val; });
  };
  return { title: 'Shift', large: true, render: page => { m.page = page; return S.shift ? onShift() : offShift(m); } };
}
WD.screens.shift = { root };

/* ---------- Control panel ---------- */
WD.panel.addJump('Shift', () => nav.switchTab('shift'));
WD.panel.addJump('Live map', () => nav.switchTab('map'));
WD.panel.addAction('Driver arrives at next stop (geofence)', () => {
  const r = q.visibleRoutes()[0]; if (!r) return ui.toast('No routes are shown', 'info.circle');
  const js = todayJobs(r.id).filter(j => !DONE[j.status] && (j.located || !j.address)), j = js.find(x => x.status === 'arrived' || x.status === 'enroute') || js[0];
  if (!j) return ui.toast('Every stop on ' + q.routeName(r) + ' is done', 'checkmark');
  const own = S.shift && S.shift.routeId === r.id, who = own ? S.me : q.driverFor(r.id), name = who ? who.name : q.routeName(r), next = { scheduled: 'enroute', enroute: 'arrived', arrived: 'completed' }[j.status], m = WD.nowMins();
  j.status = next; if (next === 'arrived') j.arrivedAt = m; if (next === 'completed') { j.departedAt = m; if (j.arrivedAt == null) j.arrivedAt = Math.max(j.start, m - j.dur); }
  j.events.push({ at: +WD.now(), actor: name, text: { enroute: 'En route', arrived: 'Arrived (geofence)', completed: 'Completed (left geofence)' }[next] });
  const t = next === 'arrived' && j.located && (data.trucks || []).find(x => x.routeId === r.id); if (t) { t.x = j.x; t.y = j.y; }
  if (own && next === 'completed') lastCompleted = j.id;
  ui.banner({ title: q.routeName(r), text: next === 'enroute' ? name + ' is on the way to ' + j.title : next === 'arrived' ? 'Arrived at ' + j.title + ' — detected by geofence' : name + ' completed ' + j.title, icon: WD.jobStatuses[next].icon === 'checkmark.circle.fill' ? 'checkmark' : WD.jobStatuses[next].icon, color: WD.jobStatuses[next].color });
  WD.changed();
});
})();
