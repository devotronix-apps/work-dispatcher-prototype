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
.tc-tile.fed b { color: var(--indigo); } .tc-edited { color: var(--indigo); }
.tc-card table.tc-tab { font-size: 12px; font-variant-numeric: tabular-nums; } .tc-card .tc-tab th { text-align: left; font-weight: 600; padding: 3px 0; color: #6b6b70; } .tc-card .tc-tab td { padding: 3px 0; text-align: left; white-space: nowrap; }
.tc-card .tc-tab td.r, .tc-card .tc-tab th.r { text-align: right; padding-left: 7px; } .tc-card .tc-tab tr.tot td { font-weight: 700; border-top: 1px solid #1c1c1e; } .tc-card .bad { color: #d70015; font-weight: 600; }
.tc-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 30px; font-size: 12px; color: #6b6b70; } .tc-sign div { border-top: 1px solid #1c1c1e; padding-top: 3px; }
`);

/* ---------- Hours and overtime ---------- */
const hrs = m => (Math.round(m / 6) / 10).toFixed(1) + ' h';
const hr = () => WD.can('hr.manage');
/** A punch with no clock-out on a past day was never closed: it counts no time until HR fixes it. */
const isOpen = p => p.end == null && p.day !== today;
const workedMin = p => { const end = p.end != null ? p.end : p.day === today ? WD.nowMins() : p.start; return Math.max(0, end - p.start - (p.breakMin || 0)); };
const mondayOf = day => D.add(day, -((D.parse(day).getDay() + 6) % 7));
/** Every punch for a user, with the signed-in user's live shift standing in for today. */
function punches(userId) {
  const list = data.punches.filter(p => p.userId === userId).map(p => ({ ...p, src: p }));
  if (S.shift && S.me && S.me.id === userId) { const start = Math.round((S.shift.startedAt - +new Date(D.parse(today).setHours(0, 0, 0, 0))) / 60000); const i = list.findIndex(p => p.day === today); const live = { userId, day: today, start, end: null, breakMin: Math.round(S.shift.breakMs / 60000), live: true, src: i >= 0 ? list[i].src : null }; if (i >= 0) list[i] = live; else list.push(live); }
  return list.sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start);
}
/** One Monday–Sunday workweek. Company rules: daily overtime first (and double time past its limit), then weekly overtime on the regular hours that remain — no hour counts twice.
    Federal (FLSA) overtime is separate: every hour worked past 40 in the workweek, whatever the daily hours. */
function workweek(userId, monday) {
  const end = D.add(monday, 6); let cum = 0, fcum = 0;
  return punches(userId).filter(p => p.day >= monday && p.day <= end).map(p => {
    const m = workedMin(p), dt = R.double.on ? Math.max(0, m - R.double.hours * 60) : 0, cap = R.double.on ? R.double.hours * 60 : Infinity;
    const daily = R.daily.on ? Math.max(0, Math.min(m, cap) - R.daily.hours * 60) : 0; let reg = m - dt - daily;
    const weekly = R.weekly.on ? Math.min(reg, Math.max(0, cum + reg - R.weekly.hours * 60)) : 0; reg -= weekly; cum += reg;
    const fed = Math.max(0, Math.min(m, fcum + m - 40 * 60)); fcum += m;
    return { ...p, m, reg, ot: daily + weekly, daily, weekly, dt, fed, open: isOpen(p) };
  });
}
/** Hours for any dates. Overtime is worked out on whole workweeks, then only the days inside the range are added up, so a range that starts mid-week still counts that week's earlier days toward 40. */
function range(userId, from, to) {
  const days = []; for (let mon = mondayOf(from); mon <= to; mon = D.add(mon, 7)) days.push(...workweek(userId, mon).filter(d => d.day >= from && d.day <= to));
  const sum = k => days.reduce((s, d) => s + d[k], 0);
  return { days, from, to, total: sum('m'), reg: sum('reg'), ot: sum('ot'), dt: sum('dt'), daily: sum('daily'), weekly: sum('weekly'), fed: sum('fed'), open: days.filter(d => d.open).length };
}
function week(userId) { const mon = mondayOf(today); return range(userId, mon, D.add(mon, 6)); }
const clockedUsers = () => data.users.filter(u => u.status === 'active' && (data.punches.some(p => p.userId === u.id) || (S.shift && S.me && S.me.id === u.id)));
const ruleText = () => [R.daily.on && 'over ' + R.daily.hours + ' hours in a day', R.weekly.on && 'over ' + R.weekly.hours + ' hours in a week'].filter(Boolean).join(' or ') || 'no overtime rules';
function tiles(w, o = {}) {
  const t = [h('div.tc-tile', h('b', hrs(w.reg)), h('span', 'Regular')), h('div.tc-tile.ot', h('b', hrs(w.ot)), h('span', 'Overtime · ' + R.daily.rate + '×')),
    R.double.on && h('div.tc-tile.dt', h('b', hrs(w.dt)), h('span', 'Double · ' + R.double.rate + '×')), h('div.tc-tile', h('b', hrs(w.total)), h('span', 'Total worked')),
    o.fed !== false && h('div.tc-tile.fed', h('b', hrs(w.fed)), h('span', 'Federal OT · over 40/wk'))].filter(Boolean);
  return h('div.tc-tiles', { style: { gridTemplateColumns: 'repeat(' + (t.length === 4 ? 2 : 3) + ', 1fr)' } }, t);
}

/* Date ranges for timesheets and reports: pay periods (two weeks by default), months, or any dates. */
const RANGES = [{ value: 'week', label: 'This week' }, { value: 'pp', label: 'This pay period' }, { value: 'lastpp', label: 'Last pay period' }, { value: 'month', label: 'This month' }, { value: 'lastmonth', label: 'Last month' }, { value: 'custom', label: 'Custom dates' }];
const RS = { kind: 'pp', from: D.add(today, -13), to: today };
/* Pay periods follow the pattern set in Settings → Pay period and payday: how often, a payday, and how many days after the period ends people are paid. */
if (!R.payKind) { R.payKind = R.payDays === 7 ? 'weekly' : 'biweekly'; R.payLag = 5; }
const PAY_KINDS = [{ value: 'weekly', label: 'Every week' }, { value: 'biweekly', label: 'Every 2 weeks' }, { value: 'semimonthly', label: 'Twice a month (1st–15th, 16th–end)' }, { value: 'monthly', label: 'Once a month' }];
const payLen = () => R.payKind === 'weekly' ? 7 : 14;
/** The pay period n periods away from the current one (0 = this one, -1 = last) → {from, to, payday}. */
function payPeriod(n = 0) {
  const k = R.payKind, mk = (from, to) => ({ from, to, payday: D.add(to, R.payLag || 0) });
  if (k === 'weekly' || k === 'biweekly') { const len = payLen(), from = D.add(R.payAnchor, (Math.floor(D.diff(today, R.payAnchor) / len) + n) * len); return mk(from, D.add(from, len - 1)); }
  const d = D.parse(today);
  if (k === 'monthly') { const a = new Date(d.getFullYear(), d.getMonth() + n, 1), b = new Date(d.getFullYear(), d.getMonth() + n + 1, 0); return mk(D.key(a), D.key(b)); }
  const half = (d.getFullYear() * 12 + d.getMonth()) * 2 + (d.getDate() > 15 ? 1 : 0) + n, y = Math.floor(half / 24), m = Math.floor((half % 24) / 2), second = half % 2 === 1;
  return mk(D.key(new Date(y, m, second ? 16 : 1)), D.key(second ? new Date(y, m + 1, 0) : new Date(y, m, 15)));
}
const payText = () => { const p = payPeriod(0); return 'This pay period is ' + fmt.day(p.from, 'md') + ' – ' + fmt.day(p.to, 'md') + ', paid ' + fmt.day(p.payday, 'short') + '.'; };
function rangeDates(rs) {
  const cur = payPeriod(0), last = payPeriod(-1);
  const month = n => { const d = D.parse(today); d.setDate(1); d.setMonth(d.getMonth() + n); const first = D.key(d); d.setMonth(d.getMonth() + 1); d.setDate(0); return [first, D.key(d)]; };
  const [from, to] = { week: [mondayOf(today), D.add(mondayOf(today), 6)], pp: [cur.from, cur.to], lastpp: [last.from, last.to], month: month(0), lastmonth: month(-1), custom: [rs.from, rs.to] }[rs.kind];
  return { from, to: to > today ? today : to, label: fmt.day(from, 'md') + ' – ' + fmt.day(to, 'md'), payday: rs.kind === 'pp' ? cur.payday : rs.kind === 'lastpp' ? last.payday : null };
}
function rangeSection(rs, page, footer) {
  const r = rangeDates(rs);
  return ui.section({ header: 'Dates · ' + r.label + (r.payday ? ' · paid ' + fmt.day(r.payday, 'md') : ''), footer },
    ui.pickerRow({ title: 'Period', icon: 'calendar', iconColor: 'var(--red)', value: rs.kind, options: RANGES, onChange: v => { if (v === 'custom') { const c = rangeDates(rs); rs.from = c.from; rs.to = c.to; } rs.kind = v; page.refresh(); } }),
    rs.kind === 'custom' && ui.dateRow({ title: 'From', value: rs.from, onChange: v => { rs.from = v; if (rs.to < v) rs.to = v; page.refresh(); } }),
    rs.kind === 'custom' && ui.dateRow({ title: 'Through', value: rs.to, onChange: v => { rs.to = v; if (rs.from > v) rs.from = v; page.refresh(); } }));
}

/* ---------- HR corrections ---------- */
const hhmm = m => m == null ? '' : String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
/** Edit a shift (or add one an employee forgot to clock in for). Every change needs a reason and is kept with the shift. */
function editPunch(userId, punch, day) {
  if (!hr()) return ui.toast('Only people with HR access can change hours', 'lock');
  const u = q.user(userId), isNew = !punch, f = { day: punch ? punch.day : day || D.add(today, -1), start: hhmm(punch ? punch.start : 7 * 60 + 30), end: hhmm(punch ? punch.end : 16 * 60), breakMin: punch ? punch.breakMin || 0 : R.unpaidBreak || 0, reason: '' };
  const live = punch && punch.day === today && punch.end == null;
  const timeInput = k => h('input.pill-input', { type: 'time', step: 60, value: f[k], onchange: e => { f[k] = e.target.value; } });
  ui.sheet({ title: isNew ? 'Add missed shift' : 'Edit shift', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Save', bold: true, onTap: async p => {
      const s = fmt.fromHHMM(f.start), e = fmt.fromHHMM(f.end);
      if (s == null) return ui.toast('Enter the clock-in time', 'clock');
      if (!live && e == null) return ui.toast('Enter the clock-out time', 'clock');
      if (e != null && e <= s) return ui.toast('Clock-out must be after clock-in', 'exclamationmark.triangle');
      if (!f.reason.trim()) return ui.toast('Add a reason for the change', 'note');
      if (isNew && data.punches.some(x => x.userId === userId && x.day === f.day)) { if (!await ui.actionSheet({ title: u.name + ' already has a shift on ' + fmt.day(f.day, 'md'), message: 'Add a second shift that day?', buttons: [{ label: 'Add another shift', value: true }] })) return; }
      const by = S.me.name, at = +WD.now();
      await ui.run('Saving…', () => {
        if (isNew) data.punches.push({ id: 'pu' + Date.now(), userId, day: f.day, start: s, end: e, breakMin: f.breakMin, edits: [{ at, by, text: 'Added missed shift ' + fmt.time(s) + ' – ' + fmt.time(e), reason: f.reason.trim() }] });
        else { const ch = []; if (s !== punch.start) ch.push('in ' + fmt.time(punch.start) + ' → ' + fmt.time(s)); if (e !== punch.end) ch.push('out ' + (punch.end == null ? 'missing' : fmt.time(punch.end)) + ' → ' + (e == null ? 'on shift' : fmt.time(e))); if (f.breakMin !== (punch.breakMin || 0)) ch.push('break ' + (punch.breakMin || 0) + ' → ' + f.breakMin + ' min');
          Object.assign(punch, { start: s, end: live && e == null ? null : e, breakMin: f.breakMin }); (punch.edits = punch.edits || []).push({ at, by, text: ch.join(' · ') || 'No time changes', reason: f.reason.trim() }); }
      }, { done: 'Hours updated' });
      p.dismiss(); WD.changed(); } }],
    render: p => ui.list(
      ui.section(null, ui.row({ leading: ui.avatar(u.name, { size: 36 }), title: u.name, subtitle: WD.roles[u.role].title })),
      ui.section({ header: 'Shift', footer: punch && isOpen(punch) ? 'No clock-out was recorded. Enter when they actually stopped working.' : isNew ? 'For a day they worked but forgot to clock in.' : live ? 'Still on shift — leave clock-out empty to keep the shift open.' : null },
        isNew ? ui.dateRow({ title: 'Date', value: f.day, onChange: v => { f.day = v; } }) : ui.row({ title: 'Date', detail: fmt.day(f.day, 'long') }),
        ui.row({ title: 'Clocked in', trailing: timeInput('start') }), ui.row({ title: 'Clocked out', subtitle: punch && isOpen(punch) ? h('span', { style: 'color:var(--red)' }, 'Missing') : null, trailing: timeInput('end') }),
        ui.row({ title: 'Unpaid break', detail: f.breakMin + ' min', trailing: ui.stepper(f.breakMin / 15, 0, 8, v => { f.breakMin = v * 15; p.refresh(); }) })),
      ui.section({ header: 'Reason', footer: 'Required. Saved with the shift along with your name and the time, shown on the timesheet, and the employee is notified.' },
        ui.inputRow({ multiline: true, placeholder: isNew ? 'e.g. Forgot to clock in — worked 7:30 to 4' : 'e.g. Forgot to clock out — left at 5:30', value: f.reason, onInput: v => { f.reason = v; } })),
      !isNew && !live && ui.section(null, ui.row({ title: 'Delete this shift', icon: 'trash', iconPlain: true, iconColor: 'var(--red)', destructive: true, onTap: async () => {
        const r = await ui.alert({ title: 'Delete this shift?', message: fmt.day(punch.day, 'long') + '. Give a reason — it’s kept in the change log.', input: { placeholder: 'Reason' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Delete', value: true, role: 'destructive' }] });
        if (!r || !r.value || !r.text.trim()) { if (r && r.value) ui.toast('A reason is required', 'note'); return; }
        data.punches = data.punches.filter(x => x !== punch); (data.punchLog = data.punchLog || []).push({ at: +WD.now(), by: S.me.name, userId, text: 'Deleted shift on ' + fmt.day(punch.day, 'md'), reason: r.text.trim() }); p.dismiss(); WD.changed(); ui.toast('Shift deleted', 'trash'); } })),
      punch && punch.edits && punch.edits.length > 0 && ui.section('Change history', punch.edits.slice().reverse().map(x => ui.row({ title: x.text, subtitle: x.reason + ' · ' + x.by + ' · ' + fmt.rel(x.at) }))))
  }, { detent: 'large' });
}

function timesheetSpec(userId, rs0) {
  const u = q.user(userId) || S.me, rs = { ...(rs0 || { kind: 'week', from: RS.from, to: RS.to }) }, mine = u === S.me;
  return { title: mine ? 'My timesheet' : u.name, render: page => { const r = rangeDates(rs), w = range(u.id, r.from, r.to), canFix = hr();
    const dayRow = d => { const src = d.src; return ui.row({ title: fmt.day(d.day, 'short') + (d.live || (d.end == null && d.day === today) ? ' · on shift' : ''),
      subtitle: h('span', fmt.time(d.start) + ' – ' + (d.end == null ? (d.open ? '' : 'now') : fmt.time(d.end)), d.open ? h('span', { style: 'color:var(--red);font-weight:600' }, 'missing clock-out') : null, d.breakMin ? ' · ' + d.breakMin + ' min break' : '', src && src.edits && src.edits.length ? h('span.tc-edited', ' · edited by ' + src.edits[src.edits.length - 1].by) : null),
      detail: d.open ? h('span', { style: 'color:var(--red)' }, 'Fix') : h('span', hrs(d.m), d.ot ? h('span.tc-ot', ' · ' + hrs(d.ot) + ' OT' + (d.weekly && !d.daily ? ' (weekly)' : '')) : null, d.dt ? h('span.tc-dt', ' · ' + hrs(d.dt) + ' DT') : null),
      chevron: canFix && !!src, onTap: canFix && src ? () => editPunch(u.id, src) : null }); };
    return ui.list(
      rangeSection(rs, page),
      ui.section({ footer: 'Company overtime is paid on hours ' + ruleText() + '. Daily overtime is counted first, then weekly overtime on the remaining regular hours, so no hour counts twice. Federal overtime (FLSA) is every hour over 40 in a Monday–Sunday workweek. ' + (R.unpaidBreak ? R.unpaidBreak + '-minute unpaid break taken out of shifts over 6 hours.' : '') }, tiles(w)),
      w.open > 0 && h('div', { style: 'margin-top:8px' }, ui.note(w.open + (w.open === 1 ? ' shift has' : ' shifts have') + ' no clock-out and count no time until ' + (canFix ? 'you fix ' + (w.open === 1 ? 'it' : 'them') + '.' : 'HR fixes ' + (w.open === 1 ? 'it' : 'them') + '.'))),
      ui.section({ header: 'Days', footer: canFix ? 'Tap a day to correct clock-in, clock-out or break. Every change asks for a reason and is kept with the shift.' : null }, w.days.map(dayRow), !w.days.length && ui.row({ title: 'No time in these dates' }),
        canFix && ui.row({ title: 'Add missed shift', icon: 'plus.circle.fill', iconPlain: true, tint: true, onTap: () => editPunch(u.id, null, r.to < today ? r.to : D.add(today, -1)) })),
      ui.section(null, ui.row({ icon: 'doc.text', iconPlain: true, title: 'Time card for these dates', tint: true, chevron: true, onTap: () => page.push({ title: 'Time card', trailing: [shareBtn], render: () => timeCard(u, rangeDates(rs)) }) })),
      mine && !canFix && ui.section({ footer: 'Forgot to clock in or out? Ask HR to fix it — they see your note with the day.' }, ui.row({ title: 'Ask HR for a correction', icon: 'envelope', iconPlain: true, tint: true, onTap: async () => {
        const a = await ui.alert({ title: 'Ask for a correction', message: 'Which day, and what should it say?', input: { placeholder: 'e.g. Fri — forgot to clock out, left at 5:15' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Send', value: true, bold: true }] });
        if (a && a.value && a.text.trim()) ui.toast('Sent to HR', 'checkmark'); } })));
  } };
}
/** Hours and overtime for everyone over a pay period, month or custom dates (HR). */
function timesheetsSpec() {
  return { title: 'Hours and overtime', render: page => {
    const r = rangeDates(RS), people = clockedUsers().map(u => ({ u, w: range(u.id, r.from, r.to) })).filter(x => x.w.days.length), canFix = hr();
    const tot = ['reg', 'ot', 'dt', 'total', 'fed', 'open'].reduce((o, k) => { o[k] = people.reduce((s, x) => s + x.w[k], 0); return o; }, {});
    const open = people.flatMap(x => x.w.days.filter(d => d.open).map(d => ({ u: x.u, d })));
    return ui.list(
      rangeSection(RS, page, payText() + ' Pick last pay period, a month or any dates for other reports. The pay period pattern is set in Settings → Time clock and overtime.'),
      ui.section({ header: 'Everyone · ' + people.length + (people.length === 1 ? ' person' : ' people'), footer: 'Federal overtime counts hours over 40 in each Monday–Sunday workweek, as the FLSA requires. Company overtime (' + ruleText() + ') can pay more than the federal minimum; payroll uses whichever the company rules say.' }, tiles(tot)),
      open.length > 0 && ui.section({ header: 'Needs fixing', footer: 'Shifts with no clock-out count no time until they’re fixed.' }, open.map(x => ui.row({ leading: ui.avatar(x.u.name, { size: 30 }), title: x.u.name + ' · ' + fmt.day(x.d.day, 'short'), subtitle: 'Clocked in ' + fmt.time(x.d.start) + ' · no clock-out', detail: canFix ? 'Fix' : null, chevron: canFix, onTap: canFix ? () => editPunch(x.u.id, x.d.src) : null }))),
      ui.section({ header: 'People', footer: 'Tap someone to see each day' + (canFix ? ', fix times or add a shift they forgot to clock in for.' : '.') },
        people.map(({ u, w }) => ui.row({ leading: ui.avatar(u.name, { size: 34 }), title: u.name, subtitle: h('span', 'Reg ' + hrs(w.reg) + (w.ot ? ' · ' : ''), w.ot ? h('span.tc-ot', 'OT ' + hrs(w.ot)) : null, w.dt ? h('span.tc-dt', ' · DT ' + hrs(w.dt)) : null, ' · Fed OT ' + hrs(w.fed), w.open ? h('span', { style: 'color:var(--red)' }, ' · ' + w.open + ' to fix') : null),
          detail: hrs(w.total), chevron: true, onTap: () => page.push(timesheetSpec(u.id, RS)) })),
        !people.length && ui.row({ title: 'No time in these dates' })),
      people.length > 0 && ui.section({ header: 'Time cards and reports', footer: 'Each uses the dates chosen above.' },
        ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'Time cards', subtitle: 'One card per person: every clock-in and clock-out, with totals', chevron: true, onTap: () => page.push(reportSpec('cards')) }),
        ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Overtime report', subtitle: 'Daily, weekly and double-time hours by person', chevron: true, onTap: () => page.push(reportSpec('ot')) }),
        ui.row({ icon: 'calendar', iconColor: 'var(--blue)', title: 'Federal overtime by workweek', subtitle: 'Hours over 40 in each Monday–Sunday week', chevron: true, onTap: () => page.push(reportSpec('weeks')) })),
      people.length > 0 && ui.section(null, ui.row({ title: 'Export for payroll (CSV)', icon: 'square.and.arrow.up', iconPlain: true, tint: true, onTap: () => ui.toast('Exported ' + people.length + ' people · ' + r.label, 'checkmark') })),
      WD.can('settings.manage') && ui.section(ui.row({ title: 'Overtime rules and pay period', icon: 'clock', iconColor: 'var(--orange)', chevron: true, onTap: () => page.push(rulesSpec()) })));
  } };
}
/* ---------- Time cards and reports (HR) ---------- */
const shareBtn = { icon: 'share', label: 'Share', onTap: () => ui.toast('Share sheet: print, email or save as PDF', 'share', 2400) };
const num = m => m ? (Math.round(m / 6) / 10).toFixed(1) : '';
function timeCard(u, r) {
  const w = range(u.id, r.from, r.to), org = S.org || data.orgs[0], fixed = w.days.filter(d => d.src && d.src.edits && d.src.edits.length).length, td = (t, cls) => h('td' + (cls || ''), t);
  return h('div.x-doc.tc-card', h('h4', 'Time card'), h('small', org.name + ' · ' + r.label + (r.payday ? ' · payday ' + fmt.day(r.payday, 'md') : '')),
    h('p', h('b', u.name), ' · ' + WD.roles[u.role].title),
    h('table.tc-tab', h('tr', ['Date', 'In', 'Out', 'Break'].map(t => h('th', t)), ['Reg', 'OT', 'DT', 'Total'].map(t => h('th.r', t))),
      w.days.map(d => h('tr', td(fmt.day(d.day, 'short')), td(fmt.time(d.start)), d.open ? td('missing', '.bad') : td(d.end == null ? 'on shift' : fmt.time(d.end)), td(d.breakMin ? d.breakMin + ' m' : ''), td(num(d.reg), '.r'), td(num(d.ot), '.r'), td(num(d.dt), '.r'), td(num(d.m) || '0.0', '.r'))),
      !w.days.length && h('tr', h('td', { colspan: 8 }, 'No time in these dates')),
      h('tr.tot', h('td', { colspan: 4 }, 'Totals (hours)'), td(num(w.reg) || '0.0', '.r'), td(num(w.ot) || '0.0', '.r'), td(num(w.dt) || '0.0', '.r'), td(num(w.total) || '0.0', '.r'))),
    h('p', 'Federal overtime (hours over 40 in a Monday–Sunday workweek): ', h('b', hrs(w.fed))),
    w.open > 0 && h('p.bad', w.open + (w.open === 1 ? ' shift has' : ' shifts have') + ' no clock-out and count no time until fixed.'),
    fixed > 0 && h('p', h('small', fixed + (fixed === 1 ? ' shift was' : ' shifts were') + ' corrected by HR. The reason and who changed it are kept with the shift.')),
    h('div.tc-sign', h('div', 'Employee signature · date'), h('div', 'Supervisor signature · date')));
}
/** Reports for everyone over the dates chosen in Hours and overtime: all time cards, overtime by person, federal overtime week by week. */
function reportSpec(kind) {
  const title = { cards: 'Time cards', ot: 'Overtime report', weeks: 'Federal overtime' }[kind];
  return { title, trailing: [shareBtn], render: () => {
    const r = rangeDates(RS), people = clockedUsers().map(u => ({ u, w: range(u.id, r.from, r.to) })).filter(x => x.w.days.length);
    if (kind === 'cards') return [h('div', { style: 'padding:10px 4px 0' }, ui.note(people.length + ' time cards · ' + r.label + '. Share prints or emails them as one PDF, one page per person.')), people.map(x => timeCard(x.u, r)), h('div', { style: 'height:16px' })];
    if (kind === 'ot') { const ot = people.filter(x => x.w.ot || x.w.dt);
      return ui.list(ui.section({ header: r.label + ' · ' + ot.length + ' of ' + people.length + ' with overtime', footer: 'Company rules: overtime on hours ' + ruleText() + '. Daily overtime is counted first, then weekly overtime on the regular hours left.' },
        people.sort((a, b) => (b.w.ot + b.w.dt) - (a.w.ot + a.w.dt)).map(({ u, w }) => ui.row({ leading: ui.avatar(u.name, { size: 34 }), title: u.name, subtitle: 'Daily ' + hrs(w.daily) + ' · weekly ' + hrs(w.weekly) + (R.double.on ? ' · double ' + hrs(w.dt) : '') + ' · regular ' + hrs(w.reg), detail: h('span' + (w.ot + w.dt ? '.tc-ot' : ''), hrs(w.ot + w.dt)) }))),
        ui.section(null, ui.row({ title: 'Total overtime', detail: hrs(people.reduce((s, x) => s + x.w.ot + x.w.dt, 0)) }), ui.row({ title: 'Total federal overtime', detail: hrs(people.reduce((s, x) => s + x.w.fed, 0)) }))); }
    const weeks = []; for (let mon = mondayOf(r.from); mon <= r.to; mon = D.add(mon, 7)) weeks.push(mon);
    return ui.list(h('div', { style: 'padding:4px 4px 0' }, ui.note('Federal overtime (FLSA) is every hour worked over 40 in a Monday–Sunday workweek, whatever the daily hours. A week only partly inside the dates still counts all of its days toward 40.')),
      weeks.map(mon => { const rows = clockedUsers().map(u => ({ u, w: range(u.id, mon, D.add(mon, 6)) })).filter(x => x.w.days.length);
        return ui.section('Week of ' + fmt.day(mon, 'md') + ' – ' + fmt.day(D.add(mon, 6), 'md'), rows.map(({ u, w }) => ui.row({ title: u.name, subtitle: hrs(w.total) + ' worked', detail: h('span' + (w.fed ? '.tc-ot' : ''), w.fed ? hrs(w.fed) + ' over 40' : 'None') })), !rows.length && ui.row({ title: 'No time this week' })); }));
  } };
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
      (() => { const fixedLen = R.payKind === 'weekly' || R.payKind === 'biweekly', cur = payPeriod(0), nxt = payPeriod(1), span = payLen() - 1 + (R.payLag || 0);
        return ui.section({ header: 'Pay period and payday', footer: payText() + ' The next is ' + fmt.day(nxt.from, 'md') + ' – ' + fmt.day(nxt.to, 'md') + ', paid ' + fmt.day(nxt.payday, 'short') + '. “This pay period” and “Last pay period” in the Shift tab and in every hours report follow this pattern.' },
          ui.pickerRow({ title: 'Paid', value: R.payKind, disabled: !edit, options: PAY_KINDS, onChange: v => { R.payKind = v; R.payDays = payLen(); page.refresh(); } }),
          fixedLen && (edit ? ui.dateRow({ title: 'A payday falls on', icon: 'dollarsign.circle', iconColor: 'var(--green)', value: cur.payday, onChange: v => { R.payAnchor = D.add(v, -span); page.refresh(); } }) : ui.row({ title: 'A payday falls on', detail: fmt.day(cur.payday, 'md') })),
          ui.row({ title: 'Payday is', subtitle: 'Days after the pay period ends', detail: (R.payLag || 0) + (R.payLag === 1 ? ' day after' : ' days after'), trailing: edit ? ui.stepper(R.payLag || 0, 0, 15, v => { if (fixedLen) R.payAnchor = D.add(R.payAnchor, (R.payLag || 0) - v); R.payLag = v; page.refresh(); }) : null }),
          ui.row({ title: 'Each period runs', detail: fixedLen ? fmt.day(cur.from, 'weekday') + ' – ' + fmt.day(cur.to, 'weekday') : R.payKind === 'monthly' ? '1st – end of month' : '1st–15th · 16th–end' })); })(),
      ui.section({ header: 'Daily overtime', footer: 'Hours past this in a single day.' }, rule('daily', 'Overtime after hours in a day', 'a day', 6, 14)),
      ui.section({ header: 'Weekly overtime', footer: 'Regular hours past this in a week (Monday–Sunday). Hours already paid as daily overtime don’t count again.' }, rule('weekly', 'Overtime after hours in a week', 'a week', 30, 60)),
      ui.section({ header: 'Double time', footer: 'Optional. Hours past this in a day are paid at the double-time rate instead.' }, rule('double', 'Double time after hours in a day', 'a day', 10, 16)),
      ui.section({ header: 'Federal overtime', footer: 'Always shown in HR reports: hours over 40 in a Monday–Sunday workweek (FLSA). It is a reference figure and doesn’t change the company rules above.' }, ui.row({ title: 'Over 40 hours in a workweek', detail: '1.5×' })),
      ui.section({ header: 'Breaks' }, ui.row({ title: 'Unpaid break', subtitle: 'Taken out of shifts over 6 hours', detail: R.unpaidBreak ? R.unpaidBreak + ' min' : 'None', trailing: edit ? ui.stepper(R.unpaidBreak / 15, 0, 4, v => { R.unpaidBreak = v * 15; page.refresh(); }) : null })),
      ui.section({ header: 'Location stays', footer: 'Owners, dispatchers and office see where clocked-in employees are on the Shift tab. A place is logged when someone stays there at least this long.' },
        ui.row({ title: 'Log stays longer than', detail: R.stayMinutes + ' min', trailing: edit ? ui.stepper(R.stayMinutes, 1, 30, v => { R.stayMinutes = v; page.refresh(); }) : null })),
      u && ui.section({ header: 'Example · ' + u.name + ' this week', footer: hrs(w.total) + ' worked: ' + hrs(w.reg) + ' regular, ' + hrs(w.ot) + ' overtime' + (w.dt ? ', ' + hrs(w.dt) + ' double time' : '') + '; ' + hrs(w.fed) + ' federal overtime.' }, tiles(w)));
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

/** The team for the Shift roster: everyone active except the signed-in person, clocked-in people first.
    → [{u, in, since (minutes), where (text or null), route, w: this week's totals}] */
function roster() {
  return data.users.filter(u => u.status === 'active' && u.id !== (S.me && S.me.id)).map(u => { const punch = data.punches.find(p => p.userId === u.id && p.day === today && p.end == null) || null, now = punch ? nowFor(u, staysFor(u)) : null;
    return { u, in: !!punch, since: punch ? punch.start : null, where: now ? now.text : null, route: data.routes.find(x => x.driverId === u.id) || null, w: week(u.id) }; }).sort((a, b) => (b.in - a.in) || a.u.name.localeCompare(b.u.name));
}
WD.timeclock = { roster, personSpec, week, range, rangeDates, editPunch, hrs, timesheetSpec, timesheetsSpec, rulesSpec, teamMapSpec, ruleText, payPeriod, payText, reportSpec };
WD.panel.addJump('Team locations', () => { WD.nav.switchTab('shift'); WD.nav.push(teamMapSpec()); });
WD.panel.addJump('Hours and overtime (HR)', () => { WD.nav.switchTab('shift'); WD.nav.push(timesheetsSpec()); });
WD.panel.addJump('Time cards (HR)', () => { WD.nav.switchTab('shift'); WD.nav.push(timesheetsSpec()); WD.nav.push(reportSpec('cards')); });
WD.panel.addJump('Overtime rules', () => { WD.nav.switchTab('settings'); WD.nav.push(rulesSpec()); });
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('timesheets', RS); }
})();
