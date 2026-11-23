/* RouteClerk prototype — version 5.0, operations (`WD.ops2`).
   Hard drives and the crusher · capacity warnings (AI Premium) · calendar-time scheduling helpers for the board and the job editor ·
   Shift: the day at a glance, jobs left that aren't on the map, drivers helping another route (with approval) ·
   AI route review with a plan of implementation (AI Premium).
   jobs.js, board.js, map.js and shift.js load before this file and look these up when they draw (`WD.ops2 && WD.ops2.x`). */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD, RC = WD.rc || {}, R14 = WD.r14 || {}, AIP = WD.aip || { on: () => false, feature() {}, card: o => h('div', o.text), tag: () => null }, O = WD.ops2 = {};
const plural = (n, w) => n + ' ' + (n === 1 ? w : w + 's'), first = n => String(n || '').split(' ')[0], pad = n => String(n).padStart(2, '0'), hhmm = m => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
const hm = m => { m = Math.max(0, Math.round(m)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); };
const shortT = m => { const hh = Math.floor(m / 60) % 24, mm = m % 60; return (hh % 12 || 12) + (mm ? ':' + pad(mm) : '') + (hh < 12 ? 'a' : 'p'); };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dl = k => { const d = D.parse(k); return DOW[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate(); }, dowOf = k => D.parse(k).getDay();
const role = () => (S.me || {}).role || S.role || 'owner', meName = () => (S.me || {}).name || 'You';
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const MI = 0.03, ROAD = 1.35, miles = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * MI * ROAD;
const driveMin = (a, b) => Math.round((Math.hypot(a.x - b.x, a.y - b.y) * 0.05 + 3) * ((data.workflow || {}).speedPct || 100) / 100);
const mins = j => (WD.siteMinutes ? (WD.siteMinutes(j) || {}).minutes : 0) || j.dur || 30;
const hash = s => { let n = 7; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };
const openJob = id => WD.screens.jobs && WD.screens.jobs.openDetails && WD.screens.jobs.openDetails(id);
const calendar = () => !!(R14.calendar && R14.calendar());
const driverOn = (rid, day) => (WD.rc && WD.rc.driverOn ? WD.rc.driverOn(rid, day) : q.driverFor(rid)) || null;
/* Settings and records of this file, kept with each business's data. */
const cfg = () => data.ops2 || (data.ops2 = { cap: { near: 85, over: 100, limitMin: 510, override: 'dispatcher' }, help: { on: true, approval: 'office', exempt: ['u4'] }, requests: [], taken: [],
  guidance: [{ id: 'g1', on: true, text: 'Schedule stops far from the shop midweek (Tue–Thu): Mondays have more holidays and customers leave early on Fridays' }] });
cfg(); data.capacityNotes = data.capacityNotes || {}; data.routePlans = data.routePlans || [];

WD.css(`
.o2-capline { align-items: flex-start; gap: 10px; background: color-mix(in srgb, var(--orange) 13%, var(--cell)); } .o2-capline.over { background: color-mix(in srgb, var(--red) 12%, var(--cell)); }
.o2-capline .t { font-size: 15px; font-weight: 600; line-height: 20px; } .o2-capline .s { font-size: 13px; line-height: 17px; color: var(--label2); margin-top: 2px; }
.o2-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.o2-msg { text-align: left; font-size: 13px; line-height: 18px; } .o2-msg b { display: block; margin-top: 8px; } .o2-msg div { margin-top: 2px; }
.o2-days { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px; background: var(--cell); }
.o2-days button { min-width: 44px; min-height: 44px; padding: 0 10px; border: 0; border-radius: 10px; background: var(--fill3); color: var(--label); font-size: 15px; font-weight: 600; cursor: pointer; }
.o2-days button.on { background: var(--tint); color: #fff; }
.o2-chk { flex: none; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--label3); display: grid; place-items: center; color: #fff; box-sizing: border-box; } .o2-chk.on { background: var(--tint); border-color: var(--tint); }
.o2-card { background: var(--cell); border-radius: 12px; padding: 14px 16px; margin-top: 12px; }
.o2-card .hd { display: flex; align-items: center; gap: 10px; } .o2-card .hd > div { flex: 1; min-width: 0; }
.o2-card.warn { background: color-mix(in srgb, var(--orange) 14%, var(--cell)); } .o2-card.bad { background: color-mix(in srgb, var(--red) 12%, var(--cell)); }
.o2-step { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--fill); color: var(--label2); font-size: 13px; font-weight: 700; flex: none; } .o2-step.done { background: var(--green); color: #fff; }
.o2-warn { color: var(--orange); font-weight: 600; }
.o2-tgun { display: flex; border-bottom: .5px solid var(--sep); background: var(--cell); } .o2-tgun > div { flex: none; box-sizing: border-box; padding: 4px; border-left: .5px solid var(--sep); min-height: 6px; }
.o2-tgun small { display: block; font-size: 12px; font-weight: 700; color: var(--label2); text-transform: uppercase; letter-spacing: .3px; margin: 2px 2px 4px; }
.o2-tgbody { display: flex; position: relative; }
.o2-tghours { flex: none; position: relative; box-sizing: border-box; } .o2-tghours span { position: absolute; right: 6px; transform: translateY(-50%); font-size: 12px; color: var(--label2); white-space: nowrap; } .o2-tghours span:first-child { transform: none; }
.o2-tgcol { flex: none; position: relative; box-sizing: border-box; border-left: .5px solid var(--sep); background-image: linear-gradient(var(--sep) 1px, transparent 1px); }
.o2-tgcol.add { cursor: copy; }
.o2-ev { position: absolute; box-sizing: border-box; border-radius: 7px; background: var(--c); color: var(--fg, #fff); border: 2px solid var(--ring); padding: 1px 5px; font-size: 12px; line-height: 15px; overflow: hidden; cursor: pointer; }
.o2-ev b { display: block; font-size: 13px; line-height: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .o2-ev.struck b { text-decoration: line-through; } .o2-ev.done { opacity: .62; }
.o2-ev .ov { display: inline-block; background: #D70015; color: #fff; border-radius: 4px; padding: 0 4px; font-weight: 800; }
.o2-ev.un { position: relative; margin-bottom: 4px; }
.o2-now { position: absolute; left: 0; right: 0; height: 2px; background: var(--red); pointer-events: none; z-index: 2; }
`);

/* ================= Hard drives: truck, crusher, or destroyed at the plant ================= */
O.hddOffsite = () => !!(data.sched || {}).hddOffsite;
O.truckOn = (routeId, day) => { const sh = S.shift, r = q.route(routeId); if (sh && sh.routeId === routeId && sh.vehicleId && day === D.today()) return q.vehicle(sh.vehicleId); return WD.rc && WD.rc.vehicleOn ? WD.rc.vehicleOn(routeId, day) : r ? q.vehicle(r.vehicleId) : null; };
/** Does a job with hard drives on this route and day need a crusher sent along? → {need, offsite, truck, text} */
O.crusher = (routeId, day) => { const v = O.truckOn(routeId, day), truck = v ? v.name : 'This route’s truck';
  if (O.hddOffsite()) return { need: false, offsite: true, truck, text: 'Collected and destroyed at the plant' };
  return v && (v.caps || []).includes('hdd') ? { need: false, truck, text: truck + ' shreds hard drives on site — no crusher needed' } : { need: true, truck, text: 'Crusher added: ' + truck + ' can’t shred hard drives' }; };
O.hddSpec = () => ({ title: 'Hard drives', render: page => { const Z = data.sched = data.sched || {};
  return ui.list(note('Say where hard drives are destroyed. When they are destroyed on site, a job with hard drives needs a truck that can shred them or a crusher sent with the driver; the app adds the crusher by itself when the truck can’t.'),
    ui.section({ header: 'Hard drives are destroyed', fold: false, showFooter: true, footer: Z.hddOffsite ? 'Drivers collect the drives and they are destroyed at the plant. No job asks for a crusher, and no truck is flagged for not shredding hard drives.' : 'A job with hard drives switches on “Send a hard drive crusher with the driver” unless that day’s truck shreds hard drives (Maintenance → Trucks → What it can do).' },
      h('div', { style: 'padding:10px 16px;background:var(--cell)' }, ui.segmented([{ value: false, label: 'On site (truck or crusher)' }, { value: true, label: 'Off site at the plant' }], !!Z.hddOffsite, v => { Z.hddOffsite = v; WD.changed(); page.refresh(); ui.toast(v ? 'Hard drives are destroyed at the plant' : 'Hard drives are destroyed on site', 'checkmark'); })))); } });
R14.addSetting && R14.addSetting('Jobs', (push, gated) => R14.link(push, gated, 'settings.manage', 'shippingbox', 'var(--indigo)', 'Hard drives', 'Destroyed on site (truck or crusher) or off site at the plant', O.hddSpec, O.hddOffsite() ? 'Off site' : 'On site'));
/* When everything is destroyed at the plant, the “Needs HD truck or crusher” flag (round11.js) has nothing to say. */
if (WD.r11 && WD.r11.issues && !WD.r11.issues.o2) { const orig = WD.r11.issues; WD.r11.issues = function () { const out = orig.apply(this, arguments); return O.hddOffsite() && Array.isArray(out) ? out.filter(i => i.short !== 'Needs HD truck or crusher') : out; }; WD.r11.issues.o2 = true; }

/* ================= Capacity (AI Premium) ================= */
const ends = (rid, day) => { try { const e = q.routeEnds(rid, day); if (e && e.start && e.end && e.start.x != null) return e; } catch (x) { /* a route with no truck starts at the shop */ } return { start: data.depot, end: data.depot }; };
/** How full a route's day is: time on site plus the drive between stops, against the length of a shift.
    extra: {min, point: {x, y}, skip: job} adds a job that isn't on the list yet. → {pct, stops, minutes, limitMin, level, text} */
O.capacity = (routeId, day, extra) => {
  const C = cfg().cap, x = extra || {}, list = q.stopList(routeId, day).filter(j => !WD.calledOff(j) && j !== x.skip), e = ends(routeId, day);
  const pts = list.filter(j => j.located && j.x != null).map(j => ({ x: j.x, y: j.y })); if (x.point) pts.push(x.point);
  let drive = 0; if (pts.length) { const chain = [e.start, ...pts, e.end]; for (let i = 0; i < chain.length - 1; i++) drive += driveMin(chain[i], chain[i + 1]); }
  const stops = list.length + (x.min ? 1 : 0), minutes = list.reduce((t, j) => t + mins(j), 0) + (x.min || 0) + drive, limitMin = C.limitMin || 510, pct = Math.round(minutes / limitMin * 100);
  const level = pct >= C.over ? 'over' : pct >= C.near ? 'near' : 'ok';
  return { pct, stops, minutes, limitMin, level, text: plural(stops, 'stop') + ' · ' + hm(minutes) + ' of a ' + hm(limitMin) + ' day (' + pct + '%)' };
};
const OVERRIDE = { office: ['owner', 'admin', 'dispatcher', 'office'], dispatcher: ['owner', 'admin', 'dispatcher'], admin: ['owner', 'admin'], owner: ['owner'] };
const OVERRIDE_LABEL = { office: 'Dispatchers and office', dispatcher: 'Dispatchers', admin: 'Admins', owner: 'The owner only' };
const canOverride = () => (OVERRIDE[cfg().cap.override] || OVERRIDE.dispatcher).includes(role());
const levelWord = l => l === 'over' ? 'over capacity' : 'near capacity';
/** The capacity note for a route's day: created by itself when the day reaches the “near” threshold and removed when it drops back.
    → null, or the capacity numbers plus {note, active} (active = nobody has marked it OK). Only with AI Premium, and only for today onward. */
O.capNote = (routeId, day) => {
  if (!AIP.on() || !q.route(routeId) || day < D.today()) return null; const N = data.capacityNotes = data.capacityNotes || {}, k = routeId + '|' + day, c = O.capacity(routeId, day);
  if (c.level === 'ok') { delete N[k]; return null; }
  const n = N[k] = N[k] || { routeId, day, auto: true, at: +WD.now(), override: null }; n.level = c.level; n.pct = c.pct;
  return { ...c, note: n, active: !n.override };
};
/** Other routes and days with room, nearest first. o: {addMin, point, job, type} */
O.alternatives = (routeId, day, o = {}) => {
  const out = [], addMin = o.addMin || 30; let d = day < D.today() ? D.today() : day;
  for (let i = 0; i < 9; i++, d = D.add(d, 1)) { if (dowOf(d) === 0) continue;
    q.routes().filter(r => r.writable).forEach(r => { if (r.id === routeId && d === day) return; if (r.id !== routeId && !r.driverId && o.type !== 'purge') return; if (WD.dayMark && WD.dayMark(r.id, d)) return;
      const c = O.capacity(r.id, d, { min: addMin, point: o.point, skip: o.job }); if (c.level !== 'ok') return;
      const near = o.point ? Math.min(...q.stopList(r.id, d).filter(j => j.located && j.x != null).map(j => Math.hypot(j.x - o.point.x, j.y - o.point.y)).concat(Math.hypot(ends(r.id, d).start.x - o.point.x, ends(r.id, d).start.y - o.point.y))) : 0;
      out.push({ routeId: r.id, day: d, cap: c, label: dl(d) + ' · ' + q.routeName(r.id), score: D.diff(d, day) * 3 + (r.id === routeId ? 0 : 2) + near / 60 }); }); }
  return out.sort((a, b) => a.score - b.score).slice(0, 3);
};
const altLine = a => a.label + ': ' + a.cap.pct + '% full with this job' + (a.cap.stops ? ', ' + plural(a.cap.stops, 'stop') : '');
/** Small chip for a board column's heading. */
O.capChip = (routeId, day) => { const n = O.capNote(routeId, day); if (!n) return null;
  return h('button.bd-cap' + (n.level === 'over' ? '.over' : '') + (n.active ? '' : '.ok'), { title: n.text, 'aria-label': q.routeName(routeId) + ' is ' + levelWord(n.level) + ' on ' + fmt.day(day, 'long') + '. ' + n.text, onpointerdown: e => e.stopPropagation(), onclick: e => { e.stopPropagation(); O.capSheet(routeId, day); } }, (n.level === 'over' ? 'Over capacity' : 'Near capacity') + (n.active ? '' : ' · OK’d')); };
O.capSheet = (routeId, day) => ui.sheet({ title: 'Capacity', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: p => {
  const n = O.capNote(routeId, day), c = n || O.capacity(routeId, day), alts = O.alternatives(routeId, day, {}), ov = n && n.note.override;
  return ui.list(
    AIP.card({ title: dl(day) + ' · ' + q.routeName(routeId) + (n ? ' is ' + levelWord(n.level) : ' has room'), text: c.text + '. The day counts time on site plus the drive between stops.', lines: n && alts.length ? ['Days and routes with room for a 30-minute job:'].concat(alts.map(altLine)) : null }),
    n && ui.section({ header: 'This note', fold: false, footer: 'The note was added by AI Premium when the day reached ' + cfg().cap.near + '% of a ' + hm(cfg().cap.limitMin) + ' shift. While it stands, anyone who adds a job to this route and day is warned first. ' + OVERRIDE_LABEL[cfg().cap.override] + ' can mark it OK.' },
      ov ? ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Marked OK by ' + ov.by, subtitle: (ov.reason || 'No reason given') + ' · ' + fmt.day(D.key(new Date(ov.at)), 'md') })
        : ui.row({ icon: 'exclamationmark.triangle', iconColor: n.level === 'over' ? 'var(--red)' : 'var(--orange)', title: n.level === 'over' ? 'Over capacity' : 'Near capacity', subtitle: 'People are warned before adding a job here' }),
      ov ? canOverride() && ui.row({ title: 'Bring the warning back', tint: true, center: true, onTap: () => { n.note.override = null; WD.changed(); p.refresh(); } })
        : canOverride() ? ui.row({ title: 'Mark as OK with a reason…', tint: true, center: true, onTap: async () => { const r = await ui.alert({ title: 'Why is this OK?', message: 'For example: a helper is riding along, or two of the stops are next door to each other.', input: { placeholder: 'Reason' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Mark as OK', value: true, bold: true }] }); if (!r || !r.value) return; n.note.override = { by: meName(), reason: (r.text || '').trim(), at: +WD.now() }; WD.changed(); p.refresh(); ui.toast('Marked OK · no more warnings for this day', 'checkmark', 2400); } })
        : ui.row({ title: OVERRIDE_LABEL[cfg().cap.override] + ' can mark this OK', disabled: true })),
    ui.section(null, ui.row({ icon: 'calendar', iconColor: 'var(--blue)', title: 'Show this day on the board', chevron: true, onTap: () => { p.dismiss(); WD.screens.board && WD.screens.board.show(day); } }),
      WD.biz && WD.biz.loadSpec && ui.row({ icon: 'shippingbox', iconColor: 'var(--orange)', title: 'Load sheet and truck capacity', chevron: true, onTap: () => p.push(WD.biz.loadSpec(day)) })));
} }, { detent: 'medium' });
/** The line under Route and Date in the job editor. o: {addMin, point, job, onUse(routeId, day)} */
O.capInline = (routeId, day, o = {}) => { const n = O.capNote(routeId, day); if (!n) return null;
  if (!n.active) return h('div.row', h('div.row-main', h('div.row-sub', (n.level === 'over' ? 'Over capacity' : 'Near capacity') + ' · marked OK by ' + n.note.override.by + (n.note.override.reason ? ': ' + n.note.override.reason : ''))));
  const alts = O.alternatives(routeId, day, o);
  return h('div.row.o2-capline' + (n.level === 'over' ? '.over' : ''), icon('exclamationmark.triangle', 20, n.level === 'over' ? 'var(--red)' : 'var(--orange)'),
    h('div.row-main', h('div.t', dl(day) + ' · ' + q.routeName(routeId) + ' is ' + levelWord(n.level)), h('div.s', n.text + (alts.length ? '. These have room:' : '. No other day this week has room.')),
      alts.length > 0 && o.onUse && h('div.o2-acts', alts.map(a => ui.button(a.label, { kind: 'tinted', small: true, block: false, onTap: () => o.onUse(a.routeId, a.day) })))));
};
/** Asked before a job goes onto a route and day (new job, or a move). → true to go ahead, false to stop, or {routeId, day} to use instead.
    o: {routeId, day, title, addMin, point, job, moving} */
O.capacityGate = async o => {
  if (!AIP.on() || o.day < D.today()) return true; const n = O.capNote(o.routeId, o.day); if (n && !n.active) return true;
  const after = O.capacity(o.routeId, o.day, { min: o.addMin || 30, point: o.point, skip: o.job }); if (!n && after.level !== 'over') return true;
  const level = after.level === 'ok' ? n.level : after.level, alts = O.alternatives(o.routeId, o.day, { ...o, type: (o.job || {}).type }), may = canOverride(), now = n || O.capacity(o.routeId, o.day);
  const msg = h('div.o2-msg', h('div', 'Now: ' + now.text + '.'), h('div', 'With ' + (o.title ? '“' + o.title + '”' : 'this job') + ': ' + hm(after.minutes) + ' (' + after.pct + '%).'),
    alts.length ? [h('b', 'AI Premium suggests'), alts.map(a => h('div', altLine(a)))] : h('b', 'No other route or day this week has room.'), !may && h('div', { style: 'margin-top:8px' }, OVERRIDE_LABEL[cfg().cap.override] + ' can schedule past capacity.'));
  const v = await ui.alert({ title: dl(o.day) + ' · ' + q.routeName(o.routeId) + ' is ' + levelWord(level), message: msg,
    buttons: [...(o.moving ? [] : alts.slice(0, 2).map(a => ({ label: 'Use ' + a.label, value: a }))), may && { label: o.moving ? 'Move it anyway' : 'Schedule anyway', value: true }, { label: 'Cancel', value: false, bold: true }].filter(Boolean) });
  if (v && v !== true) { ui.toast('Scheduled on ' + v.label, 'checkmark', 2400); return { routeId: v.routeId, day: v.day }; }
  return v === true;
};
O.capSpec = () => ({ title: 'Capacity warnings', render: page => { const C = cfg().cap, re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('AI Premium adds up each route’s day (time on site plus the drive between stops) and marks the day when it gets close to a full shift. The mark shows on the board, in the job editor as soon as that route and day are picked, and pops up when anyone tries to add a job there.'),
    ui.section({ header: 'Thresholds', fold: false },
      ui.pickerRow({ title: 'A full shift is', value: C.limitMin, options: [450, 480, 510, 540, 600].map(v => ({ value: v, label: hm(v) })), onChange: v => { C.limitMin = +v; re(); } }),
      ui.pickerRow({ title: 'Near capacity at', value: C.near, options: [75, 80, 85, 90].map(v => ({ value: v, label: v + '%' })), onChange: v => { C.near = +v; if (C.over <= C.near) C.over = C.near + 10; re(); } }),
      ui.pickerRow({ title: 'Over capacity at', value: C.over, options: [95, 100, 105, 110].filter(v => v > C.near).map(v => ({ value: v, label: v + '%' })), onChange: v => { C.over = +v; re(); } })),
    ui.section({ header: 'Overrides', fold: false, footer: 'They can mark a full day as OK with a reason, and choose “Schedule anyway” when warned. Everyone else is offered the other days and routes with room.' },
      ui.pickerRow({ title: 'Who may override', value: C.override, options: Object.keys(OVERRIDE_LABEL).map(k => ({ value: k, label: OVERRIDE_LABEL[k] })), onChange: v => { C.override = v; re(); } })),
    (list => list.length ? ui.section({ header: 'Marked days', fold: false }, list.map(n => ui.row({ leading: ui.dot(q.routeColor(n.routeId)), title: dl(n.day) + ' · ' + q.routeName(n.routeId), subtitle: (n.level === 'over' ? 'Over capacity' : 'Near capacity') + ' · ' + n.pct + '%' + (n.override ? ' · OK’d by ' + n.override.by : ''), chevron: true, onTap: () => O.capSheet(n.routeId, n.day) }))) : null)(Object.values(data.capacityNotes || {}).filter(n => n.day >= D.today() && q.route(n.routeId)).sort((a, b) => a.day < b.day ? -1 : 1))); } });
/** Demo: fill a route's next working day past capacity with visits to real customers. → {routeId, day} */
function fillDemo() {
  const routes = q.visibleRoutes().filter(r => r.writable && r.driverId), r = routes[1] || routes[0] || q.routes()[0]; if (!r) return null;
  let day = D.add(D.today(), 1); while (dowOf(day) === 0 || dowOf(day) === 6 || (WD.dayMark && WD.dayMark(r.id, day))) day = D.add(day, 1);
  const on = new Set(q.jobsFor(r.id, day).map(j => j.customerId)), pool = data.customers.filter(c => !on.has(c.id) && c.locations && c.locations[0] && c.locations[0].x != null && !['lead', 'lost', 'contacted'].includes(c.lifecycle) && c.kind !== 'household').sort((a, b) => (a.route === r.id ? 0 : 1) - (b.route === r.id ? 0 : 1));
  let made = 0; while (O.capacity(r.id, day).pct < cfg().cap.over + 4 && pool.length && made < 30) { const c = pool.shift(); WD.makeJob({ routeId: r.id, day, dur: 45, customerId: c.id, events: [{ at: +WD.now(), actor: 'Priya Raman', text: 'Created' }] }); made++; }
  if (calendar()) O.sortByTime(r.id, day);
  return { routeId: r.id, day, made };
}

/* ================= Calendar scheduling: start times ================= */
const tm = j => j.startAt ? fmt.fromHHMM(j.startAt) : null;
/** The first time a business switches to calendar times, the jobs it already has get start times from their stop order, so the board isn't empty of times.
    Jobs that aren't on the map yet are left under “No time set”. */
O.ensureTimes = () => { const Z = data.sched; if (!Z || Z.mode !== 'calendar' || Z.seeded) return; Z.seeded = true; const slot = Z.slot || 30, seen = new Set();
  data.jobs.forEach(j => { if (!j.allDay && !WD.calledOff(j)) seen.add(j.routeId + '|' + j.day); });
  seen.forEach(k => { const i = k.indexOf('|'), rid = k.slice(0, i), day = k.slice(i + 1), dep = ((data.routeDays || {})[k] || {}).depart; let t = (dep != null ? dep : Z.dayStart || 420) + 15, prev = null;
    q.stopList(rid, day).filter(j => !WD.calledOff(j)).forEach(j => { if (!j.startAt && j.exactAt) j.startAt = j.exactAt; if (j.startAt) { t = tm(j) + mins(j); prev = j; return; } if (!(j.located && j.x != null)) return;
      t += prev ? driveMin(prev, j) : 15; const start = j.arrivedAt != null ? Math.round(j.arrivedAt / 15) * 15 : Math.ceil(t / slot) * slot; j.startAt = hhmm(start); t = start + mins(j); prev = j; }); O.sortByTime(rid, day); }); };
/** A day's stops in time order: timed jobs first, then the ones with no time, then called-off visits. */
O.byTime = list => { const live = list.filter(j => !WD.calledOff(j)), timed = live.filter(j => j.startAt), idx = new Map(list.map((j, i) => [j, i]));
  return timed.sort((a, b) => tm(a) - tm(b) || idx.get(a) - idx.get(b)).concat(live.filter(j => !j.startAt), list.filter(j => WD.calledOff(j))); };
O.sortByTime = (routeId, day) => { O.byTime(q.stopList(routeId, day)).forEach((j, i) => { j.seq = i + 1; }); };
const clash = (j, list) => { const a = tm(j); if (a == null) return null; const e = a + mins(j); return list.find(k => k !== j && k.startAt && !WD.calledOff(k) && tm(k) < e && a < tm(k) + mins(k)) || null; };
/** For a board card: {time: '9:30a' | '', overlap: 'Overlaps 10:30a job' | ''}. */
O.calInfo = (job, list) => { const k = clash(job, list); return { time: job.startAt ? fmt.time(tm(job)) : '', overlap: k ? 'Overlaps ' + shortT(tm(k)) + ' job' : '' }; };
/** Job editor: a red line when the chosen time runs into another job on that route. o: {routeId, day, startAt, dur, job} */
O.overlapRow = o => { const a = fmt.fromHHMM(o.startAt); if (a == null) return null; const e = a + (o.dur || 30), k = q.stopList(o.routeId, o.day).find(j => j !== o.job && j.startAt && !WD.calledOff(j) && tm(j) < e && a < tm(j) + mins(j)); if (!k) return null;
  return h('div.row', icon('exclamationmark.triangle', 18, 'var(--red)'), h('div.row-main', h('div.row-sub', { style: 'color:var(--red);font-weight:600;margin-left:8px' }, 'Overlaps the ' + fmt.time(tm(k)) + ' job · ' + k.title))); };
/** Ask for a job's new start time (the board, when a job is dragged within its own day). */
O.askTime = (job, done) => { let v = job.startAt || hhmm(Math.ceil(WD.nowMins() / 30) * 30);
  ui.sheet({ title: 'Start time', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!v) return ui.toast('Choose a time', 'clock'); const was = job.startAt; p.dismiss(); if (v === was) return;
      api.op({ kind: 'edit', title: job.title, scope: 'Start time · ' + (was ? fmt.time(fmt.fromHHMM(was)) + ' → ' : '') + fmt.time(fmt.fromHHMM(v)), jobIds: [job.id], apply() { job.startAt = v; if (job.exactAt) job.exactAt = v; O.sortByTime(job.routeId, job.day); job.events.push({ at: +WD.now(), actor: meName(), text: 'Start time ' + (was ? 'changed from ' + fmt.time(fmt.fromHHMM(was)) + ' to ' : 'set to ') + fmt.time(fmt.fromHHMM(v)) }); } }); done && done(); } }],
    render: p => ui.list(note('This business schedules by time, so a day is listed in time order. Choose when “' + job.title + '” starts.'),
      ui.section({ fold: false, footer: v ? 'Ends ' + fmt.time(fmt.fromHHMM(v) + mins(job)) + ' · ' + mins(job) + ' min on site.' : null }, ui.quarterRow({ title: 'Start time', optional: false, value: v, onChange: x => { v = x; p.refresh(); } }),
        v && O.overlapRow({ routeId: job.routeId, day: job.day, startAt: v, dur: mins(job), job }))) }, { detent: 'medium' }); };
/** The desktop calendar: hours down the side, one column per route or day, each job placed by its start time and as tall as it is long.
    o: {cols, colW, gutter, head, lists, style(job), open(id), add(col, 'HH:MM')} → {scroller, startTop} */
O.timeGrid = o => {
  const Z = data.sched || {}, PX = 1.3, all = o.lists.flatMap(l => l.stops).filter(j => j.startAt && !WD.calledOff(j));
  let from = Math.floor((Z.dayStart || 420) / 60) * 60, to = Math.ceil((Z.dayEnd || 1080) / 60) * 60;
  all.forEach(j => { from = Math.min(from, Math.floor(tm(j) / 60) * 60); to = Math.max(to, Math.ceil((tm(j) + mins(j)) / 60) * 60); }); from = Math.max(0, from); to = Math.min(1440, to);
  const H = (to - from) * PX, hours = []; for (let m = from; m <= to; m += 60) hours.push(m);
  const card = (j, extra) => h('div.o2-ev' + (WD.struck[j.status] ? '.struck' : '') + (WD.closed[j.status] ? '.done' : '') + (extra.un ? '.un' : ''), { 'data-job': j.id, role: 'button', tabindex: '0', title: j.title, style: { ...o.style(j), ...(extra.style || {}) }, onclick: e => { e.stopPropagation(); o.open(j.id); }, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.open(j.id); } } },
    h('b', (j.startAt ? shortT(tm(j)) + ' ' : '') + j.title), extra.overlap && h('span.ov', extra.overlap), h('div', [j.startAt && shortT(tm(j)) + '–' + shortT(tm(j) + mins(j)), WD.itemsLabel && WD.itemsLabel(j.items, j.type === 'purge'), q.jobType(j.type) && q.jobType(j.type).title].filter(Boolean).join(' · ')));
  const un = h('div.o2-tgun', h('div', { style: { width: o.gutter + 'px', borderLeft: '0' } }), o.cols.map((c, i) => { const l = o.lists[i], none = l.stops.filter(j => !j.startAt && !WD.calledOff(j));
    return h('div', { style: { width: o.colW + 'px' } }, l.notes.map(j => h('div.bd-chip', { style: { '--c': q.routeColor(j.routeId) }, role: 'button', tabindex: '0', onclick: () => o.open(j.id) }, icon('note', 11), j.title)), none.length > 0 && h('small', 'No time set'), none.map(j => card(j, { un: true }))); }));
  const cols = o.cols.map((c, i) => { const timed = o.lists[i].stops.filter(j => j.startAt && !WD.calledOff(j)).sort((a, b) => tm(a) - tm(b)), lanes = [], lane = new Map();
    timed.forEach(j => { let k = lanes.findIndex(e => e <= tm(j)); if (k < 0) k = lanes.length; lanes[k] = tm(j) + Math.max(mins(j), 20); lane.set(j, k); });
    const width = j => { const a = tm(j), e = a + Math.max(mins(j), 20); return 1 + Math.max(...timed.filter(k => tm(k) < e && a < tm(k) + Math.max(mins(k), 20)).map(k => lane.get(k))); };
    const col = h('div.o2-tgcol' + (o.add ? '.add' : ''), { style: { width: o.colW + 'px', height: H + 'px', backgroundSize: '100% ' + 60 * PX + 'px' }, 'aria-label': c.title,
      onclick: e => { if (!o.add || e.target !== col) return; const y = e.offsetY, slot = Z.slot || 30; o.add(c, hhmm(Math.min(1425, from + Math.floor(y / PX / slot) * slot))); } },
      c.day === D.today() && WD.nowMins() >= from && WD.nowMins() <= to && h('div.o2-now', { style: { top: (WD.nowMins() - from) * PX + 'px' } }),
      timed.map(j => { const n = width(j), k = clash(j, timed); return card(j, { overlap: k && !WD.closed[j.status] ? 'Overlaps ' + shortT(tm(k)) : '', style: { top: (tm(j) - from) * PX + 'px', height: Math.max(22, mins(j) * PX - 2) + 'px', left: 'calc(' + (lane.get(j) / n * 100) + '% + 2px)', width: 'calc(' + (100 / n) + '% - 4px)' } }); }));
    return col; });
  const scroller = h('div.bd-scroll.o2-tg', h('div.bd-content', { style: { width: o.gutter + o.colW * o.cols.length + 'px' } }, o.head, un,
    h('div.o2-tgbody', h('div.o2-tghours', { style: { width: o.gutter + 'px', height: H + 'px' } }, hours.map(m => h('span', { style: { top: (m - from) * PX + 'px' } }, (Math.floor(m / 60) % 12 || 12) + (m < 720 || m === 1440 ? ' AM' : ' PM')))), cols)));
  return { scroller, startTop: Math.max(0, ((Z.dayStart || 420) - from) * PX - 8) };
};

/* ================= Shift: the day at a glance ================= */
const todayJobs = rid => q.jobsFor(rid, D.today()).filter(j => !j.allDay && !WD.calledOff(j));
const clockT = s => { const m = fmt.fromHHMM(s); return m == null ? '' : fmt.time(m, true); };
const winText = j => j.exactAt ? 'at ' + clockT(j.exactAt) + ' exactly' : (j.custFrom && j.custUntil ? shortT(fmt.fromHHMM(j.custFrom)).replace(/[ap]$/, '') + '–' + shortT(fmt.fromHHMM(j.custUntil)) : j.custUntil ? 'before ' + shortT(fmt.fromHHMM(j.custUntil)) : 'after ' + shortT(fmt.fromHHMM(j.custFrom))) + (j.custStrict ? ' required' : ' preferred');
const meetText = j => { const t = j.exactAt || j.custFrom || j.startAt, place = (j.address || '').split(',')[0].trim(); return (t ? clockT(t) + ' ' : '') + j.title.replace(/ — .*/, '') + (place ? ' at ' + place : ''); };
const phoneOf = j => { const c = j.customerId && q.customer(j.customerId), p = c && c.contacts && c.contacts[0]; return j.phone || (p && p.phone) || ''; };
const callBtn = j => phoneOf(j) ? ui.iconBtn('phone.fill', 'Call ' + j.title, () => WD.phone ? WD.phone.call(phoneOf(j), { customerId: j.customerId, contact: j.title }) : ui.toast('Calling ' + fmt.phone(phoneOf(j)) + '…', 'phone.fill')) : null;
function jobsSheet(title, jobs, sub) { ui.sheet({ title, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: () => ui.list(ui.section({ fold: false }, jobs.map(j => { const sx = WD.jobStatuses[j.status] || {};
  return ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: [sub(j), j.address, (sx.title || '')].filter(Boolean).join(' · '), trailing: callBtn(j), chevron: true, onTap: () => openJob(j.id) }); }))) }, { detent: 'medium' }); }
/** Rows for the Shift screen's notice block: today's meet-the-truck jobs and the jobs with a time window. */
O.daySynopsis = r => { const jobs = todayJobs(r.id), order = (a, b) => (fmt.fromHHMM(a.exactAt || a.custFrom || a.custUntil || a.startAt) || 0) - (fmt.fromHHMM(b.exactAt || b.custFrom || b.custUntil || b.startAt) || 0);
  const meets = jobs.filter(j => j.type === 'meet').sort(order), wins = jobs.filter(j => j.type !== 'meet' && (j.exactAt || j.custFrom || j.custUntil)).sort(order), open = l => l.filter(j => !WD.closed[j.status]);
  return [meets.length > 0 && ui.row({ icon: 'person.2', iconColor: 'var(--purple)', title: plural(meets.length, 'meet-the-truck job') + (open(meets).length < meets.length ? ' · ' + open(meets).length + ' to go' : ''), subtitle: meets.map(meetText).join(' · '), chevron: true, onTap: () => jobsSheet('Meet the truck today', meets, j => (t => t ? clockT(t) : 'No time set')(j.exactAt || j.custFrom || j.startAt)) }),
    wins.length > 0 && ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: plural(wins.length, 'time window') + ' today' + (wins.some(j => j.custStrict || j.exactAt) ? ' · ' + wins.filter(j => j.custStrict || j.exactAt).length + ' required' : ''), subtitle: wins.map(j => j.title + ' ' + winText(j)).join(' · '), chevron: true, onTap: () => jobsSheet('Time windows today', wins, winText) })]; };

/* ================= Shift: no more mapped stops, and helping another route ================= */
const APPROVERS = { office: ['owner', 'admin', 'dispatcher', 'office'], admin: ['owner', 'admin'], owner: ['owner'] }, APPROVER_LABEL = { none: 'Nobody', office: 'Office', admin: 'Admin', owner: 'Owner' }, approverWord = () => ({ office: 'the office', admin: 'an admin', owner: 'the owner' })[cfg().help.approval] || 'the office';
/** Does this person have to wait for approval before a stop moves to their route? Not when the company asks for none, and not when
    they are trusted to take stops on their own (help.exempt, a list of user ids: a lead driver, for example). */
O.needsApproval = userId => { const H = cfg().help; return H.approval !== 'none' && !(H.exempt || []).includes(userId); };
const mustAsk = () => O.needsApproval((S.me || {}).id);
const canApprove = () => (APPROVERS[cfg().help.approval] || APPROVERS.office).includes(role());
const pending = () => cfg().requests.filter(x => x.status === 'pending' && x.day === D.today());
/** Where the driver is: the last stop finished today, else where the truck started. */
const lastSpot = rid => { const done = q.jobsFor(rid, D.today()).filter(j => j.departedAt != null && j.x != null).sort((a, b) => b.departedAt - a.departedAt)[0]; return done ? { x: done.x, y: done.y, name: done.title } : { ...ends(rid, D.today()).start }; };
/** How far behind a route is running: the work still to do against the end of its shift. → minutes (0 = on time) */
O.behind = rid => { const left = todayJobs(rid).filter(j => !WD.closed[j.status]); if (!left.length) return 0; const pts = left.filter(j => j.located && j.x != null); let t = left.reduce((s, j) => s + mins(j), 0), cur = lastSpot(rid);
  pts.forEach(j => { t += driveMin(cur, j); cur = j; }); const dep = ((data.routeDays || {})[rid + '|' + D.today()] || {}).depart; return Math.max(0, Math.round(WD.nowMins() + t - ((dep != null ? dep : 450) + cfg().cap.limitMin))); };
/** Today's unfinished, not-yet-started stops on other routes, nearest first. */
function candidates(rid) { const at = lastSpot(rid), asked = new Set(pending().flatMap(x => x.jobIds));
  return q.routes().filter(r => r.id !== rid).flatMap(r => todayJobs(r.id).filter(j => j.status === 'scheduled' && !j.pending && j.located && j.x != null && !asked.has(j.id)))
    .map(j => ({ job: j, mi: miles(at, j), n: q.position(j).n, driver: driverOn(j.routeId, j.day) })).sort((a, b) => a.mi - b.mi); }
function doTake(req, approver) {
  const helper = first(req.byName), jobs = req.jobIds.map(id => q.job(id)).filter(j => j && !WD.closed[j.status] && j.routeId !== req.toRoute);
  if (!jobs.length) { ui.toast('Those stops are already done or moved', 'info.circle', 2600); return; }
  const info = jobs.map(j => ({ job: j, from: j.routeId, n: q.position(j).n, driver: driverOn(j.routeId, j.day) }));
  api.op({ kind: 'reassign', title: plural(jobs.length, 'stop') + ' → ' + q.routeName(req.toRoute), scope: 'Taken by ' + helper, jobIds: jobs.map(j => j.id), apply() {
    info.forEach(x => { WD.placeJob(x.job, req.toRoute, x.job.day, Infinity); if (calendar()) { O.sortByTime(req.toRoute, x.job.day); O.sortByTime(x.from, x.job.day); }
      x.job.takenBy = { name: req.byName, from: x.from, at: +WD.now() };
      x.job.events.push({ at: +WD.now(), actor: req.byName, text: 'Taken by ' + helper + ' from ' + q.routeName(x.from) + (approver ? ' · approved by ' + approver : '') });
      cfg().taken.push({ jobId: x.job.id, title: x.job.title, n: x.n, from: x.from, to: req.toRoute, by: helper, day: x.job.day, at: +WD.now(), seen: false }); }); } });
  /* What the other driver sees on their phone, so they don't drive to a stop somebody else is doing. */
  const one = info[0], who = [...new Set(info.filter(x => x.driver).map(x => first(x.driver.name)))];
  ui.banner({ title: info.length === 1 ? helper + ' is taking Stop ' + one.n + ' · ' + one.job.title : helper + ' is taking ' + plural(info.length, 'stop') + ' from ' + [...new Set(info.map(x => q.routeName(x.from)))].join(' and '),
    text: (who.length ? 'Sent to ' + who.map(n => n + '’s').join(' and ') + ' phone so they don’t go there. ' : 'Nobody is driving that route today, so the office is told. ') + 'The stop' + (info.length === 1 ? ' is' : 's are') + ' now on ' + q.routeName(req.toRoute) + '.', icon: 'person.2', color: q.routeColor(req.toRoute), duration: 8000 });
  WD.changed();
}
O.approveRequest = req => { if (!req || req.status !== 'pending') return; req.status = 'approved'; req.answeredBy = meName(); req.answeredAt = +WD.now(); doTake(req, canApprove() ? meName() : 'Colleen Abbott'); };
O.denyRequest = (req, reason) => { if (!req || req.status !== 'pending') return; Object.assign(req, { status: 'denied', reason: reason || '', answeredBy: canApprove() ? meName() : 'Colleen Abbott', answeredAt: +WD.now() }); WD.changed(); ui.toast('Request denied · ' + first(req.byName) + ' is told', 'xmark.circle.fill', 2600); };
const reqLine = req => { const jobs = req.jobIds.map(id => q.job(id)).filter(Boolean), from = [...new Set(jobs.map(j => q.routeName(j.routeId)))]; return first(req.byName) + ' asks to take ' + plural(jobs.length, 'stop') + (from.length ? ' from ' + from.join(' and ') : ''); };
O.requestSheet = req => ui.sheet({ title: 'Stop request', trailing: [{ label: 'Close', onTap: p => p.dismiss() }], render: p => { const jobs = req.jobIds.map(id => q.job(id)).filter(Boolean);
  return ui.list(h('div.o2-card', h('div.hd', ui.avatar(req.byName, { size: 40 }), h('div', h('div.headline', reqLine(req)), h('div.footnote', 'Has no more mapped stops on ' + q.routeName(req.toRoute) + ' · asked ' + fmt.clock(new Date(req.at)))))),
    ui.section({ header: 'Stops', fold: false }, jobs.map(j => { const d = driverOn(j.routeId, j.day), b = O.behind(j.routeId); return ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: q.routeName(j.routeId) + (d ? ' · ' + first(d.name) : '') + ' · stop ' + q.position(j).n + ' · ' + (b > 10 ? 'about ' + hm(b) + ' behind' : 'on time'), chevron: true, onTap: () => openJob(j.id) }); })),
    req.status === 'pending' ? (canApprove() ? [h('div', { style: 'margin-top:14px' }, ui.button('Approve · move the ' + (jobs.length === 1 ? 'stop' : 'stops'), { icon: 'checkmark', onTap: () => { p.dismiss(); O.approveRequest(req); } })),
      h('div', { style: 'margin-top:8px' }, ui.button('Deny', { kind: 'gray', onTap: async () => { const r = await ui.alert({ title: 'Deny the request?', message: first(req.byName) + ' sees your reason.', input: { placeholder: 'Reason (optional)' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Deny', value: true, role: 'destructive' }] }); if (!r || !r.value) return; p.dismiss(); O.denyRequest(req, (r.text || '').trim()); } })),
      note('When approved, the stops move to ' + q.routeName(req.toRoute) + ' and the driver who had them is told right away.')] : note('Waiting for ' + approverWord() + ' to answer.'))
      : note(req.status === 'approved' ? 'Approved by ' + req.answeredBy + '.' : 'Denied by ' + req.answeredBy + (req.reason ? ': ' + req.reason : '.')));
} }, { detent: 'medium' });
/** Pick stops to take from other routes: a map and a list sorted by distance from the driver's last stop. */
O.helpSpec = r => { const sel = new Set();
  const take = p => { const H = cfg().help, ids = [...sel]; if (!ids.length) return; p.dismiss();
    const req = { id: 'hr' + Date.now(), by: (S.me || {}).id, byName: meName(), toRoute: r.id, jobIds: ids, day: D.today(), at: +WD.now(), status: 'pending' }; cfg().requests.push(req);
    if (!mustAsk()) { req.status = 'approved'; if (H.approval !== 'none') req.answeredBy = 'No approval needed'; doTake(req, null); }
    else { WD.changed(); ui.banner({ title: 'Sent to ' + approverWord(), text: 'You’ll see the answer on your Shift screen. ' + plural(ids.length, 'stop') + ' stay where they are until it’s approved.', icon: 'person.2', color: 'var(--orange)', duration: 7000 }); } };
  return ui.sheet({ title: 'Help another route', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: () => [{ label: 'Take', bold: true, disabled: !sel.size, onTap: take }], render: p => {
    const list = candidates(r.id), at = lastSpot(r.id); [...sel].forEach(id => { if (!list.some(x => x.job.id === id)) sel.delete(id); });
    if (!list.length) return ui.empty({ icon: 'checkmark.circle', title: 'Nothing to take', text: 'Every stop on the other routes today is done, under way, or already asked for.' });
    const sub = x => { const j = x.job, b = O.behind(j.routeId), items = WD.itemsLabel && WD.itemsLabel(j.items, j.type === 'purge'); return [x.mi.toFixed(1) + ' mi', items || j.containers, (j.exactAt || j.custFrom || j.custUntil) && 'window ' + winText(j), (x.driver ? first(x.driver.name) + ' · ' : '') + q.routeName(j.routeId) + ' stop ' + x.n, b > 10 ? 'about ' + hm(b) + ' behind' : 'on time'].filter(Boolean).join(' · '); };
    return ui.list(
      WD.miniMap && h('div', { style: 'margin:0 0 10px' }, WD.miniMap({ aspect: 1.5, points: [{ x: at.x, y: at.y, icon: 'truck', cls: 'big', style: { '--c': q.routeColor(r), '--ring': '#fff', '--fg': '#fff' }, title: 'You' }].concat(list.slice(0, 20).map((x, i) => ({ x: x.job.x, y: x.job.y, n: i + 1, cls: sel.has(x.job.id) ? 'big' : '', style: WD.pinStyle ? WD.pinStyle(x.job) : { '--c': q.routeColor(x.job.routeId) }, title: x.job.title }))) })),
      ui.section({ header: 'Unfinished stops on other routes · nearest first', fold: false, footer: 'Distance is from ' + (at.name ? 'your last stop, ' + at.name : 'where you are') + '. ' + (!mustAsk() ? 'The stops move to your route right away and the other driver is told.' : 'The request goes to ' + approverWord() + ' first. Once approved, the stops move to your route and the other driver is told.') },
        list.slice(0, 20).map((x, i) => ui.row({ leading: h('span.o2-chk' + (sel.has(x.job.id) ? '.on' : ''), sel.has(x.job.id) && icon('checkmark', 14)), title: (i + 1) + ' · ' + x.job.title, subtitle: sub(x), onTap: () => { sel.has(x.job.id) ? sel.delete(x.job.id) : sel.add(x.job.id); p.refresh(); } }))),
      h('div', { style: 'margin-top:14px' }, ui.button(sel.size ? 'Take ' + (sel.size === 1 ? 'this stop' : 'these ' + sel.size + ' stops') : 'Take these stops', { icon: 'person.2', disabled: !sel.size, onTap: () => take(p) })));
  } }); };
/** Shift: cards above the next stop — my requests to help, and stops another driver took from this route. */
O.shiftNotices = r => { const me = (S.me || {}).id, mine = cfg().requests.filter(x => x.by === me && x.day === D.today() && x.toRoute === r.id), away = cfg().taken.filter(t => t.from === r.id && t.day === D.today() && !t.seen);
  return [away.map(t => h('div.o2-card.warn', h('div.hd', icon('person.2', 26, 'var(--orange)'), h('div', h('div.headline', t.by + ' is taking Stop ' + t.n + ' · ' + t.title), h('div.footnote', 'Don’t go to this stop. It’s off your list.')), ui.button('OK', { kind: 'gray', small: true, block: false, onTap: () => { t.seen = true; WD.changed(); } })))),
    mine.filter(x => x.status === 'pending').map(x => h('div.o2-card', h('div.hd', ui.spinner(22), h('div', h('div.headline', 'Waiting for ' + approverWord() + ' to approve'), h('div.footnote', plural(x.jobIds.length, 'stop') + ' asked for: ' + x.jobIds.map(id => (q.job(id) || {}).title).filter(Boolean).join(', '))), ui.button('Cancel', { kind: 'gray', small: true, block: false, onTap: () => { x.status = 'canceled'; WD.changed(); } })))),
    mine.filter(x => x.status === 'denied' && !x.seen).map(x => h('div.o2-card.bad', h('div.hd', icon('xmark.circle.fill', 26, 'var(--red)'), h('div', h('div.headline', (x.answeredBy ? first(x.answeredBy) : 'The office') + ' said no'), h('div.footnote', x.reason || 'The stops stay on their route.')), ui.button('OK', { kind: 'gray', small: true, block: false, onTap: () => { x.seen = true; WD.changed(); } }))))];
};
/** Shift: under “No more mapped stops” — the jobs still open that aren't on the map, then the offer to help another route. */
O.shiftExtras = r => { const left = q.jobsFor(r.id, D.today()).filter(j => !j.allDay && !WD.closed[j.status] && !(j.located && j.x != null)), H = cfg().help, list = H.on ? candidates(r.id) : [], waiting = cfg().requests.some(x => x.by === (S.me || {}).id && x.status === 'pending' && x.day === D.today());
  const why = j => j.type === 'meet' ? 'Meets the truck' + ((t => t ? ' at ' + clockT(t) : '')(j.exactAt || j.custFrom || j.startAt)) : !j.address ? (j.cityZip ? 'No street address · ' + j.cityZip : 'No address yet') : 'Address not found on the map · ' + j.address;
  return [left.length > 0 && ui.section({ header: 'Still to do · not on the map', fold: false, footer: 'Open a job to complete it, call the customer, or add the address.' },
      left.map(j => ui.row({ leading: h('span.sh-num.small' + (j.type !== 'meet' && j.address ? '.q' : '.none'), j.type !== 'meet' && j.address ? '?' : '–'), title: j.title, subtitle: why(j), trailing: callBtn(j), chevron: true, onTap: () => openJob(j.id) }))),
    H.on && list.length > 0 && !waiting && h('div.o2-card', h('div.hd', icon('person.2', 28, 'var(--blue)'), h('div', h('div.headline', 'Help another route?'), h('div.footnote', plural(list.length, 'stop') + ' still open on other routes. The nearest is ' + list[0].mi.toFixed(1) + ' mi away' + ((b => b > 10 ? ', and ' + q.routeName(list[0].job.routeId) + ' is about ' + hm(b) + ' behind.' : '.')(O.behind(list[0].job.routeId)))))),
      h('div', { style: 'margin-top:10px' }, ui.button('See stops I can take', { kind: 'tinted', icon: 'map', onTap: () => O.helpSpec(r) })))];
};
/** Shift: stops taken off this route show struck in the day's list. */
O.takenRows = rid => cfg().taken.filter(t => t.from === rid && t.day === D.today()).map(t => ui.row({ class: 'sh-struck', leading: h('span.sh-num.small.none', '–'), title: t.title, subtitle: 'Was stop ' + t.n + ' · Taken by ' + t.by, trailing: icon('person.2', 18, 'var(--label2)'), onTap: () => openJob(t.jobId) }));
O.helpSettingsSpec = () => ({ title: 'Drivers helping other routes', render: page => { const H = cfg().help, re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('When a driver has no more mapped stops, the Shift screen offers the unfinished stops on other routes, nearest first. The driver who had a stop is told the moment it moves, so two trucks never go to the same place.'),
    ui.section({ fold: false }, ui.toggleRow({ title: 'Drivers can take stops from another route', subtitle: 'Offered on the Shift screen when their own mapped stops are done', value: !!H.on, onChange: v => { H.on = v; re(); } })),
    H.on && ui.section({ header: 'Approval needed from', fold: false, showFooter: true, footer: H.approval === 'none' ? 'The stops move as soon as the driver takes them.' : 'The driver sees “Waiting for ' + approverWord() + ' to approve”. ' + ({ office: 'Owners, admins, dispatchers and office staff', admin: 'Owners and admins', owner: 'The owner' })[H.approval] + ' get a banner and a line on the Dispatch board to approve or deny.' },
      h('div', { style: 'padding:10px 16px;background:var(--cell)' }, ui.segmented(Object.keys(APPROVER_LABEL).map(k => ({ value: k, label: APPROVER_LABEL[k] })), H.approval, v => { H.approval = v; re(); }))),
    H.on && H.approval !== 'none' && ui.section({ header: 'Who has to ask', fold: false, showFooter: true, footer: 'Switch approval off for the people you trust to take stops on their own, such as a lead driver. Their stops move at once; the driver who had the stop and the office are still told.' },
      people().map(u => { const free = (H.exempt || []).includes(u.id); return ui.toggleRow({ title: u.name, subtitle: free ? 'Takes stops without asking' : 'Waits for ' + approverWord(), value: !free, onChange: v => { H.exempt = (H.exempt || []).filter(id => id !== u.id).concat(v ? [] : [u.id]); re(); } }); }))); } });
/* The people who can be on a route: drivers, and anyone else who has a route of their own. */
const people = () => data.users.filter(u => u.status === 'active' && (u.role === 'driver' || data.routes.some(r => r.driverId === u.id)));
R14.addSetting && R14.addSetting('Routes and board', (push, gated) => R14.link(push, gated, 'settings.manage', 'person.2', 'var(--blue)', 'Drivers helping other routes', 'Take stops from another route when their own are done', O.helpSettingsSpec, cfg().help.on ? (cfg().help.approval === 'none' ? 'On' : APPROVER_LABEL[cfg().help.approval] + ' approves' + ((n => n ? ' · ' + n + ' exempt' : '')((cfg().help.exempt || []).filter(id => people().some(u => u.id === id)).length))) : 'Off'));

/* ================= Lines on the Dispatch board ================= */
const strip = (color, ic, text, act, fn) => h('div.bd-strip', { style: { '--c': color }, onclick: fn }, icon(ic, 16), text, h('span.spacer'), act, icon('chevron.right', 13));
O.boardStrips = cols => { const plan = O.activePlan();
  return [canApprove() && pending().map(req => strip('var(--orange)', 'person.2', reqLine(req), 'Review', () => O.requestSheet(req))),
    plan && WD.can('jobs.edit') && strip('var(--gray)', 'sparkles', 'Route plan · ' + O.planProgress(plan), 'Resume', () => WD.nav.push(O.planSpec(plan))),
    cols.length === 1 && (n => n && strip(n.active ? (n.level === 'over' ? 'var(--red)' : 'var(--orange)') : 'var(--gray)', 'gauge', (n.level === 'over' ? 'Over capacity' : 'Near capacity') + (n.active ? '' : ' · marked OK') + ' · ' + hm(n.minutes) + ' of ' + hm(n.limitMin), 'Details', () => O.capSheet(cols[0].routeId, cols[0].day)))(O.capNote(cols[0].routeId, cols[0].day))];
};

/* ================= AI route review (AI Premium) ================= */
const everyDays = f => { const m = /Every (\d+) (week|month|day)/i.exec(f || ''); return m ? +m[1] * ({ week: 7, month: 28, day: 1 })[m[2].toLowerCase()] : /month/i.test(f || '') ? 28 : /daily/i.test(f || '') ? 1 : 7; };
/** One row per customer with recurring visits ahead on these routes: the weekday and route they are usually on, and how far they are from the shop. */
function seriesOf(routeIds) { const today = D.today(), by = {};
  data.jobs.forEach(j => { if (!j.recurring || !j.customerId || j.allDay || j.day <= today || j.status !== 'scheduled' || !routeIds.includes(j.routeId)) return; (by[j.customerId] = by[j.customerId] || []).push(j); });
  const out = Object.keys(by).map(id => { const c = q.customer(id), l = c && c.locations && c.locations[0]; if (!c || !l || l.x == null) return null; const jobs = by[id].sort((a, b) => a.day < b.day ? -1 : 1), cnt = {};
    jobs.forEach(j => { const k = dowOf(j.day) + '|' + j.routeId; cnt[k] = (cnt[k] || 0) + 1; });
    const max = Math.max(...Object.values(cnt)), tied = Object.keys(cnt).filter(k => cnt[k] === max && k[0] !== '6').sort(), pool = tied.length ? tied : Object.keys(cnt).sort(), key = pool[hash(id) % pool.length], dow = +key.split('|')[0], routeId = key.split('|')[1];
    /* The first visit far enough ahead to give the customer a few days' notice. */
    const mine = jobs.filter(j => dowOf(j.day) === dow && j.routeId === routeId), sample = mine.find(j => j.day >= D.add(today, 3)) || mine[mine.length - 1] || jobs[0];
    return { id, name: c.name, x: l.x, y: l.y, dow, routeId, freq: c.freq || 'Every 2 weeks', dur: mins(sample), dist: miles(l, data.depot), next: sample.day, closed: l.closedDays || sample.closedDays || [], window: sample.exactAt || sample.custFrom || sample.custUntil ? winText(sample) : '', contract: c.contract || '' }; }).filter(Boolean);
  const ds = out.map(s => s.dist).sort((a, b) => a - b), cut = ds.length ? Math.max(ds[Math.floor(ds.length * 0.67)] || 0, 1) : 0; out.forEach(s => { s.far = s.dist >= cut; }); return out; }
const DAYRE = { 1: /\bmon(day)?s?\b/, 2: /\btue(s|sday)?s?\b/, 3: /\bwed(nesday)?s?\b/, 4: /\bthu(r|rs|rsday)?s?\b/, 5: /\bfri(day)?s?\b/, 6: /\bsat(urday)?s?\b/ };
/** Read the guidance: what the review can act on, restated in plain words. Anything it can't act on is kept and said so. */
function readGuidance(texts, S0) { const g = { midweekFar: false, avoid: new Set(), light: new Set(), balance: false, fewer: false, noRoute: false, keep: new Set(), keepDays: new Set(), notes: [] };
  texts.forEach(raw => { const s = String(raw).toLowerCase().replace(/[’`]/g, '\''), before = g.notes.length, days = Object.keys(DAYRE).map(Number).filter(d => DAYRE[d].test(s)), far = /\bfar\b|farthest|distan|long drive|out of town|outlying/.test(s);
    if (far && (/midweek|mid-week|middle of the week/.test(s) || days.some(d => [2, 3, 4].includes(d)) || days.some(d => [1, 5].includes(d)))) { g.midweekFar = true; g.notes.push('Stops far from the shop go midweek (Tue–Thu)'); }
    const keep = /(?:keep|leave|don't move|do not move|dont move)\s+(.+)/.exec(s);
    let kept = 0; if (keep) S0.forEach(c => { const n = c.name.toLowerCase(); if (keep[1].includes(n) || (n.split(' ')[0].length > 3 && keep[1].includes(n.split(' ')[0]))) { g.keep.add(c.id); kept++; g.notes.push(c.name + ' stays where it is'); } });
    /* “Leave Fridays alone”: nobody who is on that day now is moved off it. */
    if (keep && !kept && !far && days.length && /alone|as (it|they) (is|are)|untouched|the same|as is/.test(s)) days.forEach(d => { g.keepDays.add(d); g.notes.push('Customers on ' + DOWL[d] + 's stay on ' + DOWL[d] + 's'); });
    else if (!far && days.length && /\b(no|not|never|avoid|nothing|off|skip|free|closed|don't|dont)\b/.test(s) && !kept) days.forEach(d => { g.avoid.add(d); g.notes.push('Nothing on ' + DOWL[d] + 's'); });
    else if (!far && days.length && /light|lighter|short|fewer|less|easy/.test(s)) days.forEach(d => { g.light.add(d); g.notes.push(DOWL[d] + 's kept light'); });
    if (/balanc|\beven|\blevel|same number|spread/.test(s)) { g.balance = true; g.notes.push('Days evened out on each route'); }
    if (!days.length && /fewer|less|minim|as few|too many|not so many/.test(s)) { g.fewer = true; g.notes.push('As few customer moves as possible (3 at most)'); }
    if (/(same|own|their) route|don't change routes|no route change|keep.*routes?\b/.test(s) && !keep) { g.noRoute = true; g.notes.push('Customers stay on their own route'); }
    if (g.notes.length === before) g.notes.push('Noted: “' + String(raw).trim() + '” (no move was needed for it)'); });
  g.notes = [...new Set(g.notes)]; return g; }
/** Stops, miles, hours and far-from-the-shop stops for each route and weekday, driving each day's stops nearest-first from the shop. */
function lineup(S0, at) { const groups = {}, res = {}; S0.forEach(s => { const a = at(s), k = a.routeId + '|' + a.dow; (groups[k] = groups[k] || []).push(s); });
  Object.keys(groups).forEach(k => { const left = groups[k].slice(), order = []; let cur = data.depot, mi = 0; while (left.length) { left.sort((a, b) => Math.hypot(a.x - cur.x, a.y - cur.y) - Math.hypot(b.x - cur.x, b.y - cur.y)); const n = left.shift(); mi += miles(cur, n); cur = n; order.push(n); } mi += miles(cur, data.depot);
    res[k] = { stops: order.length, miles: mi, hours: (order.reduce((t, s) => t + s.dur, 0) + mi / 28 * 60) / 60, far: order.filter(s => s.far).length, order }; }); return res; }
const ZERO = { stops: 0, miles: 0, hours: 0, far: 0, order: [] };
/** The review itself. sc: {routes, days, guidance: [text], window} → {S0, g, moves, before} */
function review(sc) {
  const S0 = seriesOf(sc.routes), g = readGuidance(sc.guidance, S0), allowed = new Set(sc.days.filter(d => !g.avoid.has(d))), to = new Map(), moves = [], today = D.today();
  const at = s => to.get(s.id) || { routeId: s.routeId, dow: s.dow }, cnt = (rid, dow) => S0.filter(s => at(s).routeId === rid && at(s).dow === dow).length;
  const pick = (s, rid, days) => days.filter(d => allowed.has(d) && !g.light.has(d) && !s.closed.includes(DOW[d]) && !(d === s.dow && rid === s.routeId)).sort((a, b) => cnt(rid, a) - cnt(rid, b) || Math.abs(a - s.dow) - Math.abs(b - s.dow))[0];
  const propose = (s, t, reason) => { if (to.has(s.id) || g.keep.has(s.id) || g.keepDays.has(s.dow) || t.dow == null || (t.dow === s.dow && t.routeId === s.routeId)) return false; if (g.fewer && moves.length >= 3) return false; to.set(s.id, t);
    const every = everyDays(s.freq), effFrom = s.next; let effTo = D.add(s.next, t.dow - s.dow); if (effTo <= today) effTo = D.add(effTo, 7);
    const gap = every + D.diff(effTo, effFrom);
    moves.push({ id: s.id, customerId: s.id, name: s.name, from: { routeId: s.routeId, dow: s.dow }, to: t, freq: s.freq, every, nextFrom: effFrom, nextTo: effTo, reason, include: true, status: 'pending',
      bridge: every >= 14 && gap > every + 2 ? effFrom : null, gap,
      warn: [s.window && 'Has a time window (' + s.window + '): it moves with the visit', s.contract && 'Contract ' + s.contract + ': check it doesn’t name the service day'].filter(Boolean) }); return true; };
  const all6 = [1, 2, 3, 4, 5, 6];
  S0.forEach(s => { if (!allowed.has(s.dow)) propose(s, { routeId: s.routeId, dow: pick(s, s.routeId, all6) }, sc.days.includes(s.dow) ? 'Guidance: nothing on ' + DOWL[s.dow] + 's' : DOWL[s.dow] + ' isn’t one of the days allowed'); });
  g.light.forEach(d => sc.routes.forEach(rid => { S0.filter(s => at(s).routeId === rid && at(s).dow === d).sort((a, b) => b.dist - a.dist).slice(0, 2).forEach(s => propose(s, { routeId: rid, dow: pick(s, rid, all6) }, 'Guidance: ' + DOWL[d] + 's kept light')); }));
  if (g.midweekFar) S0.filter(s => s.far && ![2, 3, 4].includes(at(s).dow)).sort((a, b) => b.dist - a.dist).forEach(s => propose(s, { routeId: s.routeId, dow: pick(s, s.routeId, [2, 3, 4]) }, s.dist.toFixed(1) + ' mi from the shop: off ' + DOWL[s.dow] + ', onto a midweek day'));
  if (!g.noRoute) { const cent = {}; sc.routes.forEach(rid => { const l = S0.filter(s => s.routeId === rid); if (l.length > 1) cent[rid] = { x: l.reduce((t, s) => t + s.x, 0) / l.length, y: l.reduce((t, s) => t + s.y, 0) / l.length }; }); let n = 0;
    S0.map(s => { const own = cent[s.routeId] ? miles(s, cent[s.routeId]) : 0, best = Object.keys(cent).filter(r => r !== s.routeId && q.route(r) && q.route(r).driverId).map(r => ({ r, d: miles(s, cent[r]) })).sort((a, b) => a.d - b.d)[0]; return { s, own, best }; })
      .filter(x => x.best && x.best.d < x.own * 0.6 && x.own - x.best.d > 1.5).sort((a, b) => (b.own - b.best.d) - (a.own - a.best.d)).forEach(x => { if (n >= (g.fewer ? 1 : 3)) return;
        const cur = at(x.s).dow, dow = allowed.has(cur) && !x.s.closed.includes(DOW[cur]) ? cur : pick(x.s, x.best.r, all6); if (propose(x.s, { routeId: x.best.r, dow }, 'Sits among ' + q.routeName(x.best.r) + '’s stops: ' + (x.own - x.best.d).toFixed(1) + ' mi closer to them than to ' + q.routeName(x.s.routeId) + '’s')) n++; }); }
  sc.routes.forEach(rid => { const days = [1, 2, 3, 4, 5].filter(d => allowed.has(d) && !g.light.has(d)); if (days.length < 2) return;
    for (let i = 0; i < 4; i++) { const sorted = days.slice().sort((a, b) => cnt(rid, b) - cnt(rid, a)), hi = sorted[0], lo = sorted[sorted.length - 1], a = cnt(rid, hi), b = cnt(rid, lo); if (a - b < (g.balance ? 2 : 3)) break;
      const s = S0.filter(x => at(x).routeId === rid && at(x).dow === hi && !to.has(x.id) && !g.keep.has(x.id) && !g.keepDays.has(x.dow) && !x.closed.includes(DOW[lo]) && !(g.midweekFar && x.far && ![2, 3, 4].includes(lo))).sort((x, y) => x.dist - y.dist)[0];
      if (!s || !propose(s, { routeId: rid, dow: lo }, 'Evens out ' + q.routeName(rid) + ': ' + DOWL[hi] + ' has ' + plural(a, 'stop') + ', ' + DOWL[lo] + ' has ' + b)) break; } });
  return { S0, g, moves, before: lineup(S0, s => ({ routeId: s.routeId, dow: s.dow })) };
}
const afterOf = res => { const m = new Map(res.moves.filter(x => x.include).map(x => [x.id, x.to])); return lineup(res.S0, s => m.get(s.id) || { routeId: s.routeId, dow: s.dow }); };
const totals = L => Object.keys(L).reduce((t, k) => { const d = +k.split('|')[1]; t.miles += L[k].miles; t.hours += L[k].hours; t.max = Math.max(t.max, L[k].hours); if (![2, 3, 4].includes(d)) t.farEdge += L[k].far; return t; }, { miles: 0, hours: 0, farEdge: 0, max: 0 });
const moveTitle = m => m.name + ': ' + DOW[m.from.dow] + ' ' + q.routeName(m.from.routeId) + ' → ' + DOW[m.to.dow] + ' ' + q.routeName(m.to.routeId);
const mdy = k => { const d = D.parse(k); return (d.getMonth() + 1) + '/' + d.getDate(); };
const windowOf = sc => sc.what === 'all' ? { from: D.add(D.today(), 1), to: null, text: 'All recurring jobs' } : sc.weeks === 'custom' ? { from: sc.from, to: sc.to, text: fmt.day(sc.from, 'md') + ' – ' + fmt.day(sc.to, 'md') } : { from: D.add(D.today(), 1), to: D.add(D.today(), sc.weeks * 7), text: 'The next ' + sc.weeks + ' weeks' };
O.routeReviewSpec = () => {
  const routes0 = q.routes().filter(r => r.writable && r.driverId).map(r => r.id), sc = { what: 'all', weeks: 8, from: D.add(D.today(), 1), to: D.add(D.today(), 56), routes: routes0.slice(), days: [1, 2, 3, 4, 5], text: '', feedback: '', extra: [] };
  let res = null, rev = 0;
  const guidance = () => cfg().guidance.filter(x => x.on).map(x => x.text).concat(sc.text.trim() ? [sc.text.trim()] : [], sc.extra);
  const run = async (page, label) => { if (!sc.routes.length) return ui.toast('Choose at least one route', 'route'); if (!sc.days.length) return ui.toast('Allow at least one day of the week', 'calendar');
    const ok = await ui.run(label || 'Reviewing the recurring routes…', () => { res = review({ ...sc, guidance: guidance() }); rev++; }, { min: 1100, max: 1900 }); if (ok) page.refresh(); };
  return { title: 'AI route review', class: 'wide', render: page => {
    if (!AIP.on()) return ui.empty({ icon: 'sparkles', title: 'AI Premium is off', text: 'The route review is part of AI Premium.' });
    const G = cfg().guidance, re = () => page.refresh(), W = windowOf(sc);
    const top = [note('A full review of the recurring routes: which customers should be on which route and weekday, with a plan to get every customer moved. Nothing changes until you approve the plan and apply it.'),
      ui.section({ header: 'What to review', fold: false },
        h('div', { style: 'padding:10px 16px;background:var(--cell)' }, ui.segmented([{ value: 'all', label: 'All recurring jobs' }, { value: 'window', label: 'A window of time' }], sc.what, v => { sc.what = v; re(); })),
        sc.what === 'window' && ui.pickerRow({ title: 'Window', value: sc.weeks, options: [{ value: 4, label: 'Next 4 weeks' }, { value: 8, label: 'Next 8 weeks' }, { value: 12, label: 'Next 12 weeks' }, { value: 'custom', label: 'Dates…' }], onChange: v => { sc.weeks = v === 'custom' ? v : +v; re(); } }),
        sc.what === 'window' && sc.weeks === 'custom' && [ui.dateRow({ title: 'From', value: sc.from, onChange: v => { sc.from = v; if (sc.to < v) sc.to = D.add(v, 28); re(); } }), ui.dateRow({ title: 'To', value: sc.to, onChange: v => { sc.to = v < sc.from ? sc.from : v; re(); } })]),
      ui.section({ header: 'Routes', fold: false }, q.routes().filter(r => r.writable).map(r => ui.toggleRow({ leading: ui.dot(q.routeColor(r)), title: q.routeName(r), subtitle: r.driverId ? null : 'No regular driver', value: sc.routes.includes(r.id), onChange: v => { sc.routes = v ? sc.routes.concat(r.id) : sc.routes.filter(x => x !== r.id); } }))),
      ui.section({ header: 'Days of the week allowed', fold: false }, h('div.o2-days', [1, 2, 3, 4, 5, 6].map(d => h('button' + (sc.days.includes(d) ? '.on' : ''), { 'aria-pressed': String(sc.days.includes(d)), 'aria-label': DOWL[d], onclick: e => { sc.days = sc.days.includes(d) ? sc.days.filter(x => x !== d) : sc.days.concat(d).sort(); e.currentTarget.classList.toggle('on', sc.days.includes(d)); e.currentTarget.setAttribute('aria-pressed', String(sc.days.includes(d))); } }, DOW[d])))),
      ui.section({ header: 'Guidance for the AI', fold: false, showFooter: true, footer: 'Say what matters in your own words. Standing guidance is remembered and used in every review; switch one off to leave it out this time.' },
        ui.inputRow({ multiline: true, placeholder: 'For example: no stops on Fridays for the South Route. Keep Harlow & Finch where it is.', value: sc.text, onInput: v => { sc.text = v; } }),
        G.map(x => ui.row({ leading: h('span.o2-chk' + (x.on ? '.on' : ''), x.on && icon('checkmark', 14)), title: x.text, subtitle: 'Standing guidance', trailing: ui.iconBtn('xmark', 'Forget this guidance', async () => { if (!await ui.actionSheet({ title: 'Forget this guidance?', message: x.text, buttons: [{ label: 'Forget it', value: true, role: 'destructive' }] })) return; cfg().guidance = G.filter(y => y !== x); re(); }), onTap: () => { x.on = !x.on; re(); } })),
        ui.row({ title: 'Remember what I typed as standing guidance', icon: 'plus', iconPlain: true, tint: true, onTap: () => { const t = sc.text.trim(); if (!t) return ui.toast('Type the guidance first', 'pencil'); G.push({ id: 'g' + Date.now(), on: true, text: t }); sc.text = ''; re(); ui.toast('Remembered for every review', 'checkmark'); } })),
      h('div', { style: 'margin-top:14px' }, ui.button(res ? 'Review again' : 'Review the routes', { icon: 'sparkles', onTap: () => { sc.extra = []; run(page); } }))];
    if (!res) return ui.list(top);
    const before = res.before, after = afterOf(res), tb = totals(before), ta = totals(after), inc = res.moves.filter(m => m.include), dm = tb.miles - ta.miles, dh = tb.hours - ta.hours, limitH = cfg().cap.limitMin / 60;
    const warns = [].concat(...inc.map(m => m.warn.map(w => m.name + ' · ' + w)), Object.keys(after).filter(k => after[k].hours > limitH * cfg().cap.near / 100).map(k => { const [rid, d] = k.split('|'); return DOWL[+d] + ' · ' + q.routeName(rid) + ' would run ' + after[k].hours.toFixed(1) + ' h, ' + (after[k].hours > limitH ? 'over' : 'close to') + ' a full ' + hm(cfg().cap.limitMin) + ' shift'; }),
      inc.filter(m => m.bridge).map(m => m.name + ' · would go ' + m.gap + ' days between visits: the plan adds a one-time bridge visit on ' + dl(m.bridge)));
    const stat = (b, a, f) => f(b) === f(a) ? f(a) : f(b) + ' → ' + f(a);
    const lineupPage = (rid, d) => ({ title: DOWL[d] + ' · ' + q.routeName(rid), render: () => { const b = before[rid + '|' + d] || ZERO, a = after[rid + '|' + d] || ZERO, was = new Set(b.order.map(s => s.id));
      return ui.list(ui.section({ header: 'Proposed lineup · ' + plural(a.stops, 'stop') + ' · ' + a.miles.toFixed(0) + ' mi · ' + a.hours.toFixed(1) + ' h', fold: false, footer: 'In driving order from the shop, nearest stop first. AutoRoute still orders the real day.' }, a.order.length ? a.order.map((s, i) => ui.row({ leading: h('span.o2-step', i + 1), title: s.name, subtitle: s.dist.toFixed(1) + ' mi from the shop' + (s.far ? ' · far' : '') + ' · ' + s.freq, detail: was.has(s.id) ? null : 'New here' })) : ui.row({ title: 'No recurring stops', disabled: true })),
        b.order.some(s => !a.order.includes(s)) && ui.section({ header: 'Moving off this day', fold: false }, b.order.filter(s => !a.order.includes(s)).map(s => ui.row({ title: s.name, subtitle: (m => m ? 'To ' + DOWL[m.to.dow] + ' · ' + q.routeName(m.to.routeId) : '')(inc.find(m => m.id === s.id)) })))); } });
    return ui.list(top,
      AIP.card({ title: 'Recommendation' + (rev > 1 ? ' · revision ' + rev : ''), text: !res.S0.length ? 'No recurring customers with visits ahead on these routes.' : !res.moves.length ? 'The routes already fit this guidance: no customer needs to move.' : 'Move ' + plural(inc.length, 'customer') + ' of ' + res.S0.length + '. ' + [tb.farEdge !== ta.farEdge && 'Far stops on Mon, Fri and Sat: ' + tb.farEdge + ' → ' + ta.farEdge, Math.abs(dm) >= 1 && Math.abs(dm).toFixed(0) + ' mi ' + (dm > 0 ? 'less' : 'more') + ' driving in a typical week', Math.abs(dh) >= .1 && Math.abs(dh).toFixed(1) + ' h ' + (dh > 0 ? 'saved' : 'added'), 'longest day ' + tb.max.toFixed(1) + ' → ' + ta.max.toFixed(1) + ' h'].filter(Boolean).join(' · ') + '.',
        lines: ['Scope: ' + W.text + ' · ' + sc.routes.map(r => q.routeName(r)).join(', ') + ' · ' + sc.days.map(d => DOW[d]).join(' ')].concat(res.g.notes.map(n => 'Guidance applied: ' + n)) }),
      res.moves.length > 0 && ui.section({ header: 'Proposed customer moves', fold: false, footer: 'Switch a move off to leave that customer where they are; the lineups and savings update.' }, res.moves.map(m => ui.toggleRow({ title: moveTitle(m), subtitle: h('span', m.freq + ' · next visit moves ' + mdy(m.nextFrom) + ' → ' + mdy(m.nextTo) + ' · ' + m.reason, m.warn.map(w => h('div.o2-warn', w))), value: m.include, onChange: v => { m.include = v; re(); } }))),
      sc.routes.map(rid => ui.section({ header: q.routeName(rid) + ' · before → after', fold: true, folded: false }, [1, 2, 3, 4, 5, 6].map(d => { const b = before[rid + '|' + d] || ZERO, a = after[rid + '|' + d] || ZERO; if (!b.stops && !a.stops) return null; const same = b.stops === a.stops && Math.abs(b.miles - a.miles) < .5;
        return ui.row({ title: DOWL[d], subtitle: stat(b, a, x => plural(x.stops, 'stop')) + ' · ' + stat(b, a, x => x.miles.toFixed(0) + ' mi') + ' · ' + stat(b, a, x => x.hours.toFixed(1) + ' h') + ' · far from the shop ' + stat(b, a, x => String(x.far)), detail: same ? 'No change' : null, chevron: true, onTap: () => page.push(lineupPage(rid, d)) }); }))),
      warns.length > 0 && ui.section({ header: 'Check before approving', fold: false }, warns.map(w => ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--orange)', title: w }))),
      ui.section({ header: 'Not quite right?', fold: false, footer: 'Say what to change and the AI revises the plan. For example: “leave Fridays alone”, “balance the days”, “fewer moves”, “keep Northgate Credit Union on Monday”.' },
        ui.inputRow({ multiline: true, placeholder: 'Feedback on this recommendation', value: sc.feedback, onInput: v => { sc.feedback = v; } }),
        ui.row({ title: 'Revise', icon: 'sparkles', iconPlain: true, tint: true, onTap: async () => { const t = sc.feedback.trim(); if (!t) return ui.toast('Type your feedback first', 'pencil'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); const was = res.moves.length; sc.extra.push(t); sc.feedback = ''; await run(page, 'Revising the plan…'); ui.toast('Revised · ' + plural(res.moves.length, 'move') + (res.moves.length !== was ? ' (was ' + was + ')' : ''), 'sparkles', 2600); } })),
      inc.length > 0 && h('div', { style: 'margin-top:14px' }, ui.button('Approve plan · ' + plural(inc.length, 'customer move'), { icon: 'checkmark', onTap: async () => {
        if (!await ui.alert({ title: 'Approve this plan?', message: 'It creates a plan of implementation: notify the customers, move each one at their next cycle, brief the drivers, review after 4 weeks. No visit moves until you apply it there.', buttons: [{ label: 'Not yet', value: false }, { label: 'Approve', value: true, bold: true }] })) return;
        const plan = { id: 'rp' + Date.now(), at: +WD.now(), by: meName(), rev, scope: W.text, window: { from: W.from, to: W.to }, routes: sc.routes.slice(), guidance: res.g.notes.slice(), moves: inc.map(m => ({ ...m, from: { ...m.from }, to: { ...m.to }, warn: m.warn.slice(), bridgeMade: false })), steps: { notify: false, applied: false, brief: false, reviewed: false }, reviewOn: D.add(D.today(), 28), closed: false,
          summary: { miles: +(dm).toFixed(0), hours: +dh.toFixed(1), far: [tb.farEdge, ta.farEdge] } };
        (data.routePlans = data.routePlans || []).push(plan); WD.changed(); page.push(O.planSpec(plan)); ui.toast('Plan approved', 'checkmark'); } })),
      note('The review looks at each customer’s usual weekday and route, their distance from the shop, their windows, closed days and contracts. Miles and hours are for a typical week, driving each day’s stops nearest-first from the shop.'));
  } };
};
/* ---------- Plan of implementation ---------- */
O.activePlan = () => (data.routePlans || []).filter(p => !p.closed).slice(-1)[0] || null;
O.planProgress = plan => { const n = plan.moves.length, moved = plan.moves.filter(m => m.status === 'moved').length, told = plan.moves.filter(m => m.status !== 'pending').length; return moved ? moved + ' of ' + n + ' customers moved' : told ? told + ' of ' + n + ' customers notified' : plural(n, 'customer') + ' to notify'; };
const planJobs = (plan, m) => data.jobs.filter(j => j.customerId === m.customerId && j.recurring && j.status === 'scheduled' && !j.allDay && j.day >= m.nextFrom && (!plan.window.to || j.day <= plan.window.to) && dowOf(j.day) === m.from.dow && j.routeId === m.from.routeId);
const STATUS = { pending: ['Not told yet', 'var(--gray)'], notified: ['Notified', 'var(--orange)'], confirmed: ['Confirmed', 'var(--blue)'], moved: ['Moved', 'var(--green)'] };
function applyPlan(plan) {
  const todo = plan.moves.filter(m => m.status !== 'moved'), byRoute = {}; todo.forEach(m => { (byRoute[m.from.routeId] = byRoute[m.from.routeId] || []).push(m); }); let visits = 0;
  Object.keys(byRoute).forEach(rid => { const sets = byRoute[rid].map(m => ({ m, jobs: planJobs(plan, m).filter(j => !j.pending) })), n = sets.reduce((t, x) => t + x.jobs.length, 0); visits += n;
    api.op({ kind: 'batch', title: 'Route plan · ' + q.routeName(rid), scope: plural(sets.length, 'customer') + ' · ' + plural(n, 'visit'), jobIds: sets.flatMap(x => x.jobs.map(j => j.id)), apply() {
      sets.forEach(({ m, jobs }) => { jobs.forEach(j => { const was = j.day; WD.placeJob(j, m.to.routeId, D.add(j.day, m.to.dow - m.from.dow), Infinity); if (calendar()) O.sortByTime(j.routeId, j.day);
          j.recurring = { ...j.recurring, rule: String(j.recurring.rule || '').replace(/ on \w+day$/, '') + ' on ' + DOWL[m.to.dow] };
          j.events.push({ at: +WD.now(), actor: meName(), text: 'Route plan: moved from ' + dl(was) + ' · ' + q.routeName(m.from.routeId) + ' to ' + dl(j.day) + ' · ' + q.routeName(m.to.routeId) }); });
        const c = q.customer(m.customerId); if (c) c.route = m.to.routeId; m.status = 'moved'; m.visits = jobs.length; }); } }); });
  plan.steps.applied = true; return visits;
}
O.planSpec = plan => ({ title: 'Route plan', class: 'wide', render: page => {
  const M = plan.moves, n = M.length, re = () => { WD.changed(); page.refresh(); }, done = k => plan.steps[k], told = M.filter(m => m.status !== 'pending').length, moved = M.filter(m => m.status === 'moved').length, bridges = M.filter(m => m.bridge);
  const tpl = (data.templates || []).find(t => /schedule change|new (service )?day|day change/i.test(t.name || '')), tplName = tpl ? tpl.name : 'Schedule change', steps = [done('notify'), done('applied'), !bridges.length || bridges.every(m => m.bridgeMade), done('brief'), done('reviewed')], frac = (steps.filter(Boolean).length + moved / Math.max(1, n)) / (steps.length + 1);
  const head = (i, ok, text) => h('span.hstack', { style: { gap: '8px' } }, h('span.o2-step' + (ok ? '.done' : ''), ok ? icon('checkmark', 13) : i), text);
  const byDriver = {}; M.forEach(m => [m.from.routeId, m.to.routeId].forEach(r => { byDriver[r] = (byDriver[r] || 0) + 1; }));
  return ui.list(
    h('div.o2-card', h('div.hd', icon('sparkles', 26, 'var(--purple)'), h('div', h('div.headline', plan.closed ? 'Plan finished' : O.planProgress(plan)), h('div.footnote', 'Approved by ' + plan.by + ' on ' + fmt.day(D.key(new Date(plan.at)), 'md') + ' · ' + plan.scope + (plan.summary && plan.summary.miles ? ' · ' + Math.abs(plan.summary.miles) + ' mi ' + (plan.summary.miles > 0 ? 'less' : 'more') + ' a week' : '')))), h('div', { style: 'margin-top:10px' }, ui.progress(plan.closed ? 1 : frac))),
    plan.guidance.length > 0 && ui.section({ header: 'Guidance this plan follows', fold: true, folded: true }, plan.guidance.map(g => ui.row({ icon: 'sparkles', iconPlain: true, iconColor: 'var(--purple)', title: g }))),
    ui.section({ header: head(1, steps[0], 'Tell the customers'), fold: false, footer: 'Each customer gets the “' + tplName + '” message with their own old day, new day and first date. ' + (tpl ? 'Edit the wording in Settings → Message templates.' : 'The template is added to Message templates the first time it is sent.') },
      ui.row({ icon: 'message', iconColor: 'var(--green)', title: tplName + ' · ' + plural(n, 'customer'), subtitle: 'Example: “Starting ' + fmt.day(M[0].nextTo, 'long') + ', your service day moves from ' + DOWL[M[0].from.dow] + ' to ' + DOWL[M[0].to.dow] + '. Reply to this message or call us if that day doesn’t work.”', detail: told + ' of ' + n + ' sent' }),
      told < n && ui.row({ title: 'Send ' + plural(n - told, 'notice'), tint: true, center: true, onTap: async () => { if (!await ui.run('Sending ' + plural(n - told, 'notice') + '…', () => { M.forEach(m => { if (m.status === 'pending') m.status = 'notified'; }); plan.steps.notify = true; if (!tpl && data.templates) data.templates.push({ id: 'tp-sched-' + Date.now(), group: 'Your own templates', builtin: false, name: 'Schedule change', channel: 'text', subject: '', body: 'Hi {first}, this is {company}. Starting {date}, your service day moves from {old day} to {new day}. Reply to this message or call {phone} if that day doesn’t work for you.' }); }, { done: 'Notices sent' })) return; page.refresh(); } })),
    ui.section({ header: head(2, steps[1], 'Move each customer at their next cycle'), fold: false, footer: 'A visit inside the next 3 days stays where it is, so every customer has notice. Applying moves each customer’s recurring visits from the date shown' + (plan.window.to ? ' through ' + fmt.day(plan.window.to, 'md') : '') + ' and updates the series; each route’s changes sync as one batch.' },
      M.map(m => { const st = STATUS[m.status] || STATUS.pending; return ui.row({ leading: ui.dot(q.routeColor(m.to.routeId)), title: moveTitle(m), subtitle: h('span', m.freq + ' · first visit on the new day ' + dl(m.nextTo) + ' (was ' + dl(m.nextFrom) + ')' + (m.visits != null ? ' · ' + plural(m.visits, 'visit') + ' moved' : ''), m.warn.map(w => h('div.o2-warn', w))), trailing: ui.badge(st[0], st[1]),
        onTap: m.status === 'moved' ? null : async () => { const v = await ui.actionSheet({ title: m.name, message: 'Where this customer stands.', buttons: [{ label: 'Not told yet', value: 'pending' }, { label: 'Notified', value: 'notified' }, { label: 'Confirmed the new day', value: 'confirmed' }] }); if (v) { m.status = v; re(); } } }); }),
      moved < n && ui.row({ title: moved ? 'Move the remaining ' + plural(n - moved, 'customer') : 'Apply the moves to the schedule', tint: true, center: true, onTap: async () => {
        if (told < n && !await ui.alert({ title: plural(n - told, 'customer') + ' not told yet', message: 'Move their visits anyway? You can still send the notices afterwards.', buttons: [{ label: 'Cancel', value: false }, { label: 'Move anyway', value: true, bold: true }] })) return;
        const v = applyPlan(plan); re(); ui.toast(plural(v, 'visit') + ' moved · syncing', 'checkmark', 2600); } })),
    bridges.length > 0 && ui.section({ header: head(3, steps[2], 'Bridge visits'), fold: false, footer: 'Where the change would leave a customer too long between visits, one extra visit on their old day covers the gap. It is a one-time job and is billed like any other visit.' },
      bridges.map(m => ui.row({ title: m.name, subtitle: m.gap + ' days between visits without it · bridge visit ' + dl(m.bridge) + ' on ' + q.routeName(m.from.routeId), trailing: m.bridgeMade ? ui.badge('Scheduled', 'var(--green)') : ui.button('Add', { kind: 'tinted', small: true, block: false, onTap: () => {
        const have = data.jobs.find(j => j.customerId === m.customerId && j.day === m.bridge && !j.recurring && !WD.calledOff(j));
        if (!have) api.op({ kind: 'create', title: m.name, scope: 'Bridge visit · ' + dl(m.bridge), jobIds: [], apply() { const j = WD.makeJob({ routeId: m.from.routeId, day: m.bridge, customerId: m.customerId, events: [{ at: +WD.now(), actor: meName(), text: 'Created · one-time bridge visit (route plan)' }] }); if (calendar()) O.sortByTime(j.routeId, j.day); } });
        m.bridgeMade = true; re(); ui.toast('Bridge visit on ' + dl(m.bridge), 'checkmark'); } }) }))),
    ui.section({ header: head(bridges.length ? 4 : 3, steps[3], 'Brief the drivers'), fold: false },
      Object.keys(byDriver).map(rid => { const d = q.driverFor(rid); return ui.row({ leading: ui.dot(q.routeColor(rid)), title: q.routeName(rid) + (d ? ' · ' + d.name : ''), subtitle: plural(M.filter(m => m.to.routeId === rid && m.from.routeId !== rid).length, 'new customer') + ' · ' + plural(M.filter(m => m.from.routeId === rid && m.to.routeId !== rid).length, 'customer') + ' leaving · ' + plural(M.filter(m => m.from.routeId === rid && m.to.routeId === rid).length, 'day change') }); }),
      ui.toggleRow({ title: 'Drivers briefed', subtitle: 'Each driver gets the list of customers joining and leaving their route, with the first date', value: !!plan.steps.brief, onChange: v => { plan.steps.brief = v; if (v) ui.toast('Briefing sent to ' + plural(Object.keys(byDriver).length, 'route'), 'message'); re(); } })),
    ui.section({ header: head(bridges.length ? 5 : 4, steps[4], 'Review after 4 weeks'), fold: false, footer: 'On ' + fmt.day(plan.reviewOn, 'long') + ' the AI compares the miles, hours and late stops of the new routes with the old ones and reminds you here.' },
      ui.dateRow({ title: 'Review on', value: plan.reviewOn, onChange: v => { plan.reviewOn = v; re(); } }), ui.toggleRow({ title: 'Reviewed', value: !!plan.steps.reviewed, onChange: v => { plan.steps.reviewed = v; re(); } })),
    !plan.closed && ui.section(null, moved === n ? ui.row({ title: 'Finish the plan', tint: true, center: true, onTap: () => { plan.closed = true; re(); ui.toast('Plan finished', 'checkmark'); } })
      : ui.row({ title: moved ? 'Stop here · leave the rest where they are' : 'Cancel the plan', destructive: true, center: true, onTap: async () => { if (!await ui.actionSheet({ title: moved ? 'Stop the plan?' : 'Cancel the plan?', message: moved ? 'Customers already moved stay moved. The others stay on their current day.' : 'Nothing has been moved. Notices already sent are not taken back.', buttons: [{ label: moved ? 'Stop the plan' : 'Cancel the plan', value: true, role: 'destructive' }], cancel: 'Keep it' })) return; plan.closed = true; WD.changed(); page.pop(); } })),
    note('The plan stays on the Dispatch board (a line under the date, and in the ••• menu) until it is finished, so anyone can pick it up where it was left.'));
} });

/* ================= Settings, AI Premium features, control panel ================= */
R14.addSetting && R14.addSetting('AI Premium', (push, gated) => [
  R14.link(push, gated, 'settings.manage', 'gauge', 'var(--orange)', 'Capacity warnings', 'When a route’s day is near or over a full shift, and who may override', O.capSpec, cfg().cap.near + '% / ' + cfg().cap.over + '%'),
  R14.link(push, gated, 'jobs.edit', 'sparkles', 'var(--purple)', 'AI route review', 'How to schedule and run the recurring routes, with a plan to get there', O.routeReviewSpec, O.activePlan() ? 'Plan in progress' : null)]);
AIP.feature('Capacity warnings', 'Dispatch board, job editor', 'Marks a route’s day when it is near or over a full shift, warns anyone adding a job there and suggests other days and routes with room.');
AIP.feature('AI route review', 'Dispatch menu, Settings', 'Reviews the recurring routes against your guidance, proposes which customers to move to which route and weekday, and builds the plan to notify and move them.');
const toBoard = () => { WD.nav.switchTab('board'); };
WD.panel.addAction('Fill a route to capacity', () => { const r = fillDemo(); if (!r) return ui.toast('No route to fill', 'info.circle'); WD.changed(); WD.screens.board && WD.screens.board.show(r.day);
  ui.banner(AIP.on() ? { title: dl(r.day) + ' · ' + q.routeName(r.routeId) + ' is over capacity', text: O.capacity(r.routeId, r.day).text + '. Try adding a job to it from any screen.', icon: 'gauge', color: 'var(--red)', duration: 7000, onTap: () => O.capSheet(r.routeId, r.day) } : { title: q.routeName(r.routeId) + ' is full on ' + dl(r.day), text: 'Turn on AI Premium (control panel) to see the capacity warnings.', icon: 'gauge', color: 'var(--gray)' }); });
WD.panel.addAction('Office approves the stop request', () => { const req = pending()[0]; if (!req) return ui.toast('No stop request is waiting', 'info.circle', 2400); O.approveRequest(req); });
WD.panel.addAction('Office denies the stop request', () => { const req = pending()[0]; if (!req) return ui.toast('No stop request is waiting', 'info.circle', 2400); O.denyRequest(req, 'South Route is nearly done; stay on your own stops.'); });
WD.panel.addJump('AI route review', () => { if (!AIP.on()) return ui.toast('Turn on AI Premium in the control panel first', 'sparkles', 2600); toBoard(); WD.nav.push(O.activePlan() ? O.planSpec(O.activePlan()) : O.routeReviewSpec()); });
WD.panel.addJump('Help other routes', () => { const r = (S.shift && q.route(S.shift.routeId)) || q.routes().find(x => x.driverId === (S.me || {}).id) || q.routes().find(x => x.driverId) || q.routes()[0]; if (!r) return; WD.nav.switchTab('shift'); if (!cfg().help.on) cfg().help.on = true; O.helpSpec(r); });
WD.panel.addJump('Capacity demo', () => { if (!AIP.on()) return ui.toast('Turn on AI Premium in the control panel first', 'sparkles', 2600);
  let n = Object.values(data.capacityNotes || {}).filter(x => x.day >= D.today() && q.route(x.routeId) && O.capNote(x.routeId, x.day))[0]; if (!n) { const r = fillDemo(); if (!r) return; WD.changed(); n = r; }
  WD.screens.board && WD.screens.board.show(n.day); O.capSheet(n.routeId, n.day); });
})();
