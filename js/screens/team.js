/* Time clock and team: overtime rules (daily and weekly), timesheets, and the team locations map for owners, dispatchers and office
   (where each clocked-in employee is, and every place they stayed longer than the company's threshold). Registers WD.timeclock. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD;
const R = data.timeRules, today = D.today();

WD.css(`
.tc-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5px; background: var(--sep); }
.tc-tile { background: var(--cell); padding: 10px 12px; } .tc-tile b { display: block; font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; } .tc-tile span { font-size: 12px; color: var(--label2); }
.tc-tile.ot b { color: var(--orange); } .tc-tile.dt b { color: var(--red); }
.tc-ot { color: var(--orange); font-weight: 600; } .tc-dt { color: var(--red); font-weight: 600; }
.tc-map { padding: 10px 12px 12px; }
.tc-me { box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 35%, transparent), 0 1px 3px rgba(0,0,0,.35); }
.tc-rule { display: flex; align-items: center; gap: 8px; }
.tc-num { min-width: 54px; text-align: right; font-variant-numeric: tabular-nums; }
.tc-short { color: var(--label3); }
`);

/* ---------- Hours and overtime ---------- */
const hrs = m => (Math.round(m / 6) / 10).toFixed(1) + ' h';
const workedMin = p => { const end = p.end != null ? p.end : p.day === today ? WD.nowMins() : p.start; return Math.max(0, end - p.start - (p.breakMin || 0)); };
/** This week's punches for a user, with the signed-in user's live shift standing in for today. */
function punches(userId) {
  const list = data.punches.filter(p => p.userId === userId).map(p => ({ ...p }));
  if (S.shift && S.me && S.me.id === userId) { const start = Math.round((S.shift.startedAt - +new Date(D.parse(today).setHours(0, 0, 0, 0))) / 60000); const i = list.findIndex(p => p.day === today); const live = { userId, day: today, start, end: null, breakMin: Math.round(S.shift.breakMs / 60000) }; if (i >= 0) list[i] = live; else list.push(live); }
  return list.sort((a, b) => a.day.localeCompare(b.day));
}
/** Daily overtime first (and double time past its limit), then weekly overtime on the regular hours that remain. Hours are never counted twice. */
function week(userId) {
  let cum = 0; const days = punches(userId).map(p => {
    const m = workedMin(p), dt = R.double.on ? Math.max(0, m - R.double.hours * 60) : 0, cap = R.double.on ? R.double.hours * 60 : Infinity;
    const daily = R.daily.on ? Math.max(0, Math.min(m, cap) - R.daily.hours * 60) : 0; let reg = m - dt - daily;
    const weekly = R.weekly.on ? Math.min(reg, Math.max(0, cum + reg - R.weekly.hours * 60)) : 0; reg -= weekly; cum += reg;
    return { ...p, m, reg, ot: daily + weekly, daily, weekly, dt };
  });
  const sum = k => days.reduce((s, d) => s + d[k], 0);
  return { days, total: sum('m'), reg: sum('reg'), ot: sum('ot'), dt: sum('dt'), daily: sum('daily'), weekly: sum('weekly') };
}
const clockedUsers = () => data.users.filter(u => u.status === 'active' && (data.punches.some(p => p.userId === u.id) || (S.shift && S.me && S.me.id === u.id)));
const ruleText = () => [R.daily.on && 'over ' + R.daily.hours + ' hours in a day', R.weekly.on && 'over ' + R.weekly.hours + ' hours in a week'].filter(Boolean).join(' or ') || 'no overtime rules';
function tiles(w) {
  return h('div.tc-tiles', h('div.tc-tile', h('b', hrs(w.reg)), h('span', 'Regular')), h('div.tc-tile.ot', h('b', hrs(w.ot)), h('span', 'Overtime · ' + R.daily.rate + '×')),
    R.double.on ? h('div.tc-tile.dt', h('b', hrs(w.dt)), h('span', 'Double · ' + R.double.rate + '×')) : h('div.tc-tile', h('b', hrs(w.total)), h('span', 'Total')));
}
function timesheetSpec(userId) {
  const u = q.user(userId) || S.me;
  return { title: u === S.me ? 'My timesheet' : u.name, render: () => { const w = week(u.id);
    return ui.list(ui.section({ header: 'This week', footer: 'Overtime is paid on hours ' + ruleText() + '. Daily overtime is counted first, then weekly overtime on the remaining regular hours, so no hour counts twice. ' + (R.unpaidBreak ? R.unpaidBreak + '-minute unpaid break taken out of shifts over 6 hours.' : '') }, tiles(w)),
      ui.section('Days', w.days.map(d => ui.row({ title: fmt.day(d.day, 'short') + (d.end == null ? ' · on shift' : ''), subtitle: fmt.time(d.start) + ' – ' + (d.end == null ? 'now' : fmt.time(d.end)) + (d.breakMin ? ' · ' + d.breakMin + ' min break' : ''),
        detail: h('span', hrs(d.m), d.ot ? h('span.tc-ot', ' · ' + hrs(d.ot) + ' OT' + (d.weekly && !d.daily ? ' (weekly)' : '')) : null, d.dt ? h('span.tc-dt', ' · ' + hrs(d.dt) + ' DT') : null) })),
        !w.days.length && ui.row({ title: 'No time this week' }))); } };
}
function timesheetsSpec() {
  return { title: 'Timesheets', render: page => ui.list(ui.section({ header: 'Week of ' + fmt.day(D.add(today, -((D.parse(today).getDay() + 6) % 7)), 'md'), footer: 'Drivers, office and shop staff all clock in on the Shift tab. Rules: overtime ' + ruleText() + '.' },
    clockedUsers().map(u => { const w = week(u.id); return ui.row({ leading: ui.avatar(u.name, { size: 34 }), title: u.name, subtitle: WD.roles[u.role].title + ' · ' + w.days.length + ' days', detail: h('span', hrs(w.total), w.ot ? h('span.tc-ot', ' · ' + hrs(w.ot) + ' OT') : null), chevron: true, onTap: () => page.push(timesheetSpec(u.id)) }); })),
    WD.can('settings.manage') && ui.section(ui.row({ title: 'Overtime rules', icon: 'clock', iconColor: 'var(--orange)', chevron: true, onTap: () => page.push(rulesSpec()) }))) };
}
function rulesSpec() {
  const rates = [1.25, 1.5, 2].map(v => ({ value: v, label: v + '×' }));
  return { title: 'Time clock and overtime', render: page => {
    const edit = WD.can('settings.manage'), u = q.user('u4'), w = week('u4');
    const rule = (key, title, unit, min, max) => [ui.toggleRow({ title, value: R[key].on, disabled: !edit, onChange: v => { R[key].on = v; page.refresh(); } }),
      R[key].on && ui.row({ title: 'After', detail: R[key].hours + ' hours ' + unit, trailing: edit ? ui.stepper(R[key].hours, min, max, v => { R[key].hours = v; page.refresh(); }) : null }),
      R[key].on && ui.pickerRow({ title: 'Pay rate', value: R[key].rate, disabled: !edit, options: rates, onChange: v => { R[key].rate = v; page.refresh(); } })];
    return ui.list(
      !edit && h('div', { style: 'margin-top:8px' }, ui.note('Ask an admin to change these rules.')),
      ui.section({ header: 'Daily overtime', footer: 'Hours past this in a single day.' }, rule('daily', 'Overtime after hours in a day', 'a day', 6, 14)),
      ui.section({ header: 'Weekly overtime', footer: 'Regular hours past this in a week (Monday–Sunday). Hours already paid as daily overtime don’t count again.' }, rule('weekly', 'Overtime after hours in a week', 'a week', 30, 60)),
      ui.section({ header: 'Double time', footer: 'Optional. Hours past this in a day are paid at the double-time rate instead.' }, rule('double', 'Double time after hours in a day', 'a day', 10, 16)),
      ui.section({ header: 'Breaks' }, ui.row({ title: 'Unpaid break', subtitle: 'Taken out of shifts over 6 hours', detail: R.unpaidBreak ? R.unpaidBreak + ' min' : 'None', trailing: edit ? ui.stepper(R.unpaidBreak / 15, 0, 4, v => { R.unpaidBreak = v * 15; page.refresh(); }) : null })),
      ui.section({ header: 'Location stays', footer: 'Owners, dispatchers and office see where clocked-in employees are on the Shift tab. A place is logged when someone stays there at least this long.' },
        ui.row({ title: 'Log stays longer than', detail: R.stayMinutes + ' min', trailing: edit ? ui.stepper(R.stayMinutes, 1, 30, v => { R.stayMinutes = v; page.refresh(); }) : null })),
      u && ui.section({ header: 'Example · ' + u.name + ' this week', footer: hrs(w.total) + ' worked: ' + hrs(w.reg) + ' regular, ' + hrs(w.ot) + ' overtime' + (w.dt ? ', ' + hrs(w.dt) + ' double time' : '') + '.' }, tiles(w)));
  } };
}

/* ---------- Team locations ---------- */
/** Places a person stayed today, newest last. Drivers' come from their stops; office and shop staff from their phone's location. */
function staysFor(u) {
  const r = data.routes.find(x => x.driverId === u.id), out = data.stays.filter(s => s.userId === u.id).map(s => ({ ...s }));
  if (r && !out.length) {
    const ends = q.routeEnds(r.id, today), jobs = q.stopList(r.id, today).filter(j => j.arrivedAt != null), first = jobs[0];
    out.push({ label: ends.start.name + ' (start)', x: ends.start.x, y: ends.start.y, from: 7 * 60 + 5, to: first ? first.arrivedAt - 14 : 7 * 60 + 40, kind: 'base' });
    if (u.id === 'u5') out.push({ label: 'Fuel — Harbor Gas', x: 640, y: 610, from: 7 * 60 + 52, to: 7 * 60 + 55 });
    jobs.forEach(j => out.push({ label: j.title, x: j.x, y: j.y, from: j.arrivedAt, to: j.departedAt != null ? j.departedAt : null, kind: 'job' }));
  }
  return out.sort((a, b) => a.from - b.from);
}
function nowFor(u, stays) {
  const r = data.routes.find(x => x.driverId === u.id), t = r && WD.screens.map && WD.screens.map.trucks().find(x => x.routeId === r.id);
  if (t) { const at = stays.filter(s => s.to == null).pop(); return { x: t.x, y: t.y, text: t.state === 'driving' ? 'Driving · ' + t.speedMph + ' mph' : at ? 'At ' + at.label + ' since ' + fmt.time(at.from) : 'Parked' }; }
  const cur = stays[stays.length - 1]; return cur ? { x: cur.x, y: cur.y, text: cur.to == null ? 'At ' + cur.label + ' since ' + fmt.time(cur.from) : 'Last seen at ' + cur.label } : null;
}
const onShiftToday = () => data.users.filter(u => u.status === 'active' && u.id !== (S.me && S.me.id) && (data.punches.some(p => p.userId === u.id && p.day === today && p.end == null)));
const longEnough = s => (s.to == null ? WD.nowMins() : s.to) - s.from >= R.stayMinutes;
const personPin = (u, p, big) => ({ x: p.x, y: p.y, n: fmt.initials(u.name), cls: big ? 'big' : null, style: { '--c': ui.avatarColor ? ui.avatarColor(u.name) : 'var(--blue)', '--ring': '#fff' }, title: u.name });
function teamMapSpec() {
  return { title: 'Team locations', render: page => {
    if (!WD.can('team.locations')) return ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Team locations are for owners, dispatchers and office.' });
    const people = onShiftToday().map(u => { const st = staysFor(u), now = nowFor(u, st); return { u, st, now }; }).filter(x => x.now);
    const pts = []; people.forEach(x => { x.st.filter(longEnough).forEach(s => pts.push({ x: s.x, y: s.y, cls: 'faded', style: { '--c': '#8E8E93', '--ring': '#fff' } })); pts.push(personPin(x.u, x.now, true)); });
    return ui.list(
      ui.section({ header: 'Now · ' + people.length + ' clocked in', footer: 'Gray dots are places someone stayed at least ' + R.stayMinutes + ' minutes today. Only employees who are clocked in are shown, and only while they’re on shift.' },
        pts.length ? h('div.tc-map', WD.miniMap({ points: pts, aspect: 1.25, pad: 50 })) : ui.row({ title: 'Nobody is clocked in' })),
      ui.section({ header: 'Log stays longer than', footer: WD.can('settings.manage') ? 'Company setting. Shorter stops, like a red light, aren’t logged.' : 'Set by an admin.' },
        ui.row({ title: R.stayMinutes + ' minutes', trailing: WD.can('settings.manage') ? ui.stepper(R.stayMinutes, 1, 30, v => { R.stayMinutes = v; page.refresh(); }) : null })),
      ui.section('People', people.map(x => { const logged = x.st.filter(longEnough).length;
        return ui.row({ leading: ui.avatar(x.u.name, { size: 36 }), title: x.u.name, subtitle: WD.roles[x.u.role].title + ' · ' + x.now.text + ' · ' + logged + (logged === 1 ? ' stay' : ' stays') + ' logged', chevron: true, onTap: () => page.push(personSpec(x.u.id)) }); })));
  } };
}
function personSpec(userId) {
  const u = q.user(userId);
  return { title: u.name, render: () => {
    const st = staysFor(u), now = nowFor(u, st), shown = st.filter(longEnough), hidden = st.length - shown.length, punch = data.punches.find(p => p.userId === u.id && p.day === today);
    const pts = shown.map((s, i) => ({ x: s.x, y: s.y, n: i + 1, style: { '--c': s.kind === 'job' ? '#616161' : '#8E8E93', '--ring': '#fff' } })); if (now) pts.push(personPin(u, now, true));
    return ui.list(
      h('div.tc-map', WD.miniMap({ points: pts, lines: [{ pts: shown.concat(now ? [now] : []), color: 'var(--blue)', width: 2, dash: true, opacity: .7 }], aspect: 1.25, pad: 50 })),
      ui.section(null, ui.row({ title: 'Clocked in', detail: punch ? fmt.time(punch.start) : '—' }), now && ui.row({ title: 'Now', subtitle: now.text }), ui.row({ title: 'Hours today', detail: punch ? hrs(workedMin(punch)) : '—' })),
      ui.section({ header: 'Stays today', footer: (hidden ? hidden + (hidden === 1 ? ' shorter stop' : ' shorter stops') + ' under ' + R.stayMinutes + ' min not shown. ' : '') + 'Recorded only while clocked in, as described in the location tracking notice.' },
        shown.map((s, i) => ui.row({ leading: h('span.mp-mini', { style: { '--c': s.kind === 'job' ? '#616161' : '#8E8E93', '--ring': '#fff' } }, i + 1), title: s.label, subtitle: fmt.time(s.from) + ' – ' + (s.to == null ? 'now' : fmt.time(s.to)), detail: fmt.dur((s.to == null ? WD.nowMins() : s.to) - s.from) })),
        !shown.length && ui.row({ title: 'No stays logged yet' })));
  } };
}

WD.timeclock = { week, hrs, timesheetSpec, timesheetsSpec, rulesSpec, teamMapSpec, ruleText };
WD.panel.addJump('Team locations', () => { WD.nav.switchTab('shift'); WD.nav.push(teamMapSpec()); });
WD.panel.addJump('Overtime rules', () => { WD.nav.switchTab('settings'); WD.nav.push(rulesSpec()); });
})();
