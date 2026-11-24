/* Operations settings and what they drive, registered on WD.ops: time-on-site formulas (route service, new setups, purge jobs, each truck's pace),
   holidays and schedule changes (mark a holiday, review the suggested moves, one-time moves, days marked “do not schedule” or “large purge jobs only”),
   the confirmation sent when a new job is scheduled, which number and address messages to customers come from, the items / services / fees list,
   and scanning hard drive serial numbers. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD, CO = WD.co, ST = data.settings, W = data.workflow;
const OP = WD.ops = {};
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You', admin = () => WD.can('settings.manage');
const first = n => String(n || '').replace(/^Dr\.\s*/, '').split(' ')[0], plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's'), uid = p => p + Date.now().toString(36) + Math.floor(Math.random() * 99);
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Company settings need the Company settings permission. An owner or admin can grant it in Team and roles.' });
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const step = (title, sub, detail, value, min, max, fn) => ui.row({ title, subtitle: sub, detail, trailing: ui.stepper(value, min, max, fn) });

WD.css(`
.op-load { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px 12px; border-top: .5px solid var(--sep); }
.op-load span { font-size: 12.500px; line-height: 17px; border-radius: 8px; padding: 3px 8px; background: var(--fill3); color: var(--label2); font-variant-numeric: tabular-nums; } .op-load span b { color: var(--label); font-weight: 600; }
.op-load span.over { background: rgba(255,59,48,.14); color: var(--red); } .op-load span.over b { color: var(--red); } .op-load span.empty { opacity: .6; }
.op-ex { padding: 10px 16px 12px; font-size: 13.500px; line-height: 19px; color: var(--label2); border-top: .5px solid var(--sep); } .op-ex b { color: var(--label); font-weight: 600; }
`);

/* ================= Settings data ================= */
Object.assign(ST, {
  holidays: { suggest: true, fullHours: 8, notify: true, federal: true },   // suggest moves when a holiday is marked; what counts as a full route; offer to text customers their new day
  confirm: { mode: 'ask', channel: 'text', pricing: 'none', types: { regular: true, purge: true, government: false, creditCard: true, setup: true, meet: true } },   // off | ask | auto
  comms: { textFrom: 'match', callFrom: 'match', byUser: {}, emailFrom: 'office@discountshred.example', emailName: 'company',
    numbers: [{ id: 'n1', n: '+15125550100', label: 'Main line', areas: ['512'], zips: ['78644'], main: true }, { id: 'n2', n: '+17375550140', label: 'North county', areas: ['737'], zips: ['78641'] },
      { id: 'n3', n: '+18305550122', label: 'Hill Country', areas: ['830'], zips: ['78645'] }, { id: 'n4', n: '+12545550119', label: 'East side', areas: ['254'], zips: ['78642'] }, { id: 'n5', n: '+15125550177', label: 'Ads line', areas: [], zips: [] }] },
});
data.holidays = [];    // [{ day, name }] — the whole company is closed
data.dayMarks = {};    // routeId + '|' + day → { kind: 'closed' | 'purgeOnly', label }
/** What a route's day is marked as, if anything: a holiday, “Do not schedule jobs” or “Large purge jobs only”. */
WD.dayMark = (routeId, day) => { const hd = data.holidays.find(x => x.day === day); return hd ? { kind: 'holiday', label: hd.name } : data.dayMarks[routeId + '|' + day] || null; };
const MARKS = [{ value: '', label: 'No label' }, { value: 'closed', label: 'Do not schedule jobs' }, { value: 'purgeOnly', label: 'Large purge jobs only' }];
const markLabel = k => (MARKS.find(m => m.value === k) || MARKS[0]).label;

/* Templates this file adds (same shape as the built-in ones in company.js). */
const T = (id, group, name, channel, subject, body) => ({ id, group, name, channel, subject, body, builtin: true, def: { name, channel, subject, body } });
data.templates.splice(Math.max(0, data.templates.findIndex(t => t.id === 'aglink')), 0,
  T('confirm', 'Service messages', 'Job scheduled — confirmation text', 'text', '', 'Hi {first}, this is {company}. Your shredding service is scheduled for {date}. Thank you for being our customer! Please have your paper staged in a convenient location; additional service charges may apply if it isn’t. Paper clips, staples and file folders are fine, but no binders, x-rays or small plastic bags. Questions? Call or text {phone}.'),
  T('confirmEmail', 'Service messages', 'Job scheduled — confirmation email', 'email', 'Your shredding service is scheduled for {date}', 'Hi {first},\n\nYour shredding service with {company} is scheduled for {date}.\n\nThank you for being our customer. A few things that help the visit go smoothly:\n\n• Please have your paper staged in a convenient location. If it isn’t, additional service charges may apply.\n• Paper clips, staples and file folders are fine.\n• Please, no binders, x-rays, small plastic bags or anything that isn’t paper.\n\nIf the date doesn’t work or you have questions, reply to this email or call {phone}.\n\n{sender}\n{company}'),
  T('moved', 'Service messages', 'Service day changed', 'text', '', 'Hi {first}, this is {company}. Because of {reason}, your shredding service is moving from {olddate} to {date}. Reply to this text or call {phone} if that day doesn’t work for you.'));

/* ================= Time on site ================= */
const paceText = p => p === 100 ? 'Normal pace' : p > 100 ? 'Takes ' + (p - 100) + '% longer' : (100 - p) + '% quicker';
OP.siteSpec = () => ({ title: 'Time on site', render: page => { if (!admin()) return locked(); const SR = data.siteRules, R = SR.route, P = data.purgeRules, re = () => { WD.changed(); page.refresh(); };
  const ex = WD.routeFormula({ items: [{ id: 'console', qty: 2 }, { id: 'bin64', qty: 2 }] }).minutes, pe = n => WD.purgeEstimate({ std: n }).minutes;
  const mins = (obj, k, title, sub, min, max) => step(title, sub, obj[k] + ' min', obj[k], min, max, v => { obj[k] = v; re(); });
  return ui.list(note('How long AutoRoute and the board expect a stop to take when there is nothing better to go on. Once a customer has recorded visits, the median of those visits is used instead and these formulas step aside.'),
    ui.section({ header: 'Route service with no history', footer: 'The minimum stop time already includes one bin. A console adds a little, each extra console adds more, and each extra bin adds the most. Any one job can also be given its own time (open the job → Time on site).' },
      mins(R, 'min', 'Minimum stop time', 'Includes one bin: park, check in, walk in and out', 0, 60), mins(R, 'console1', 'A console adds', 'The first one', 0, 20), mins(R, 'console', 'Each extra console adds', null, 0, 20), mins(R, 'bin64', 'Each extra 64-gallon bin adds', 'After the one the minimum covers', 0, 30), mins(R, 'bin96', 'Each extra 96-gallon bin adds', null, 0, 30),
      h('div.op-ex', 'Example: 2 consoles and 2 bins (64 gal) → ', h('b', R.min + ' + ' + R.console1 + ' + ' + R.console + ' + ' + R.bin64 + ' = ' + ex + ' minutes'), '.')),
    ui.section({ footer: 'Used when a job has no history and no containers listed, such as a first visit entered with only a name.' },
      step('No containers listed', 'Minutes on site assumed', W.defaultStopMin + ' min', W.defaultStopMin / 5, 1, 24, v => { W.defaultStopMin = v * 5; re(); })),
    ui.section({ header: 'New setups', footer: 'Delivering and placing containers takes longer than a regular service stop, usually 5 to 15 minutes. Added to Setup / first service jobs and to any job with the “New setup” heads-up switched on.' },
      mins(SR, 'setupExtra', 'A new setup adds', 'On top of the stop’s usual time', 0, 45)),
    ui.section({ header: 'Purge jobs', footer: 'A minimum stop time covers the first boxes, then time per box. This is a different formula from route service because purges are priced and timed by the box.' },
      mins(P, 'minMin', 'Minimum stop time', null, 0, 60), step('The minimum covers up to', null, plural(P.minBoxes, 'box').replace('boxs', 'boxes'), P.minBoxes, 0, 60, v => { P.minBoxes = v; re(); }),
      step('After that, boxes per hour', (60 / P.perHour).toFixed(1).replace(/\.0$/, '') + ' minutes a box', String(P.perHour), P.perHour / 10, 2, 40, v => { P.perHour = v * 10; re(); }),
      step('Stairs add', 'Per box carried up or down · ' + Math.round(P.stairsMin * 10) + ' min for 10 boxes', P.stairsMin + ' min a box', P.stairsMin * 4, 0, 20, v => { P.stairsMin = v / 4; re(); }), step('Hauling away the empties adds', 'Per box', P.haulSec + ' sec a box', P.haulSec / 5, 0, 36, v => { P.haulSec = v * 5; re(); }),
      h('div.op-ex', 'Example: 10 boxes → ', h('b', pe(10) + ' min'), ', with haul-away ', h('b', WD.purgeEstimate({ std: 10, haul: true }).minutes + ' min'), ', with stairs and haul-away ', h('b', WD.purgeEstimate({ std: 10, haul: true, stairs: 'down' }).minutes + ' min'), '. A job with extra people or a second truck can be given its own time.'),
      h('div.op-ex', 'More examples: 10 boxes → ', h('b', pe(10) + ' min'), ' · 60 boxes → ', h('b', pe(60) + ' min'), ' · 150 boxes → ', h('b', fmt.dur(pe(150))), '.')),
    ui.section({ header: 'Counting what isn’t in boxes', footer: 'How many standard boxes each of these counts as on a purge.' },
      [['pallet', 'A pallet'], ['gaylord', 'A gaylord'], ['cabinet', 'A file cabinet'], ['bin65', 'A 65-gallon bin']].map(([k, title]) => step(title, null, P[k] + ' boxes', P[k], 1, 120, v => { P[k] = v; re(); }))),
    ui.section({ header: 'Truck pace', footer: 'Some trucks shred faster or slower than others. The overall pace applies to every truck; a truck with its own pace uses that instead. Pace stretches or shrinks purge estimates and formula stops on the route the truck is assigned to. Recorded visits already include the truck that did them.' },
      step('All trucks', 'Overall', paceText(SR.pace), SR.pace / 5, 12, 40, v => { SR.pace = v * 5; re(); }),
      data.vehicles.filter(v => v.active !== false).map(v => { const p = v.pace || SR.pace; return ui.row({ icon: 'truck', iconColor: v.pace ? 'var(--orange)' : 'var(--gray)', title: v.name, subtitle: v.pace ? h('button.cu-link', { style: 'padding:0', onclick: e => { e.stopPropagation(); v.pace = null; re(); } }, 'Use the overall pace') : 'Same as all trucks', detail: paceText(p), trailing: ui.stepper(p / 5, 12, 40, x => { v.pace = x * 5 === SR.pace ? null : x * 5; re(); }) }); })),
    ui.section(null, ui.row({ title: 'Routing assumptions', subtitle: 'Start time, time to get rolling, drive time', chevron: true, onTap: () => page.push(CO.routingSpec()) })));
} });

/* ================= Holidays and schedule changes ================= */
const wd = k => fmt.day(k, 'weekday'), md = k => fmt.day(k, 'md'), dow = k => D.parse(k).getDay(), cap = () => ST.holidays.fullHours * 60;
const isOff = (k, extra) => data.holidays.some(x => x.day === k) || (extra || []).includes(k);
/** Jobs that can still be moved off a route's day: not started, not called off, not waiting to sync. */
const movable = (routeId, day) => q.stopList(routeId, day).filter(j => j.status === 'scheduled' && !j.pending);
/** A rough length for a list of stops: time on site plus an allowance for the drive to each. */
const loadOf = list => list.reduce((s, j) => s + WD.siteMinutes(j).minutes + 12, 0);
const dayLoad = (routeId, day) => loadOf(q.stopList(routeId, day).filter(j => !WD.calledOff(j)));
/** Does this route work that day? Monday to Friday, plus a Saturday that already has stops; never a holiday or a day marked “do not schedule”. */
const works = (routeId, k, extra) => { const w = dow(k); if (w === 0 || isOff(k, extra)) return false; const m = data.dayMarks[routeId + '|' + k]; if (m && m.kind === 'closed') return false; return w !== 6 || q.stopList(routeId, k).length > 0; };
const weekStart = k => D.add(k, -((dow(k) + 6) % 7));
/* US federal holidays, worked out for any year. `date` is the holiday; `day` is when it is observed (Friday for a Saturday, Monday for a Sunday).
   They are shown on the calendars and warned about when scheduling; the company is only closed on the ones it marks (data.holidays). */
const nthDay = (y, m, wday, n) => { const d = new Date(y, m, 1); let c = 0; while (true) { if (d.getDay() === wday && ++c === n) return D.key(d); d.setDate(d.getDate() + 1); } };
const lastDay = (y, m, wday) => { const d = new Date(y, m + 1, 0); while (d.getDay() !== wday) d.setDate(d.getDate() - 1); return D.key(d); };
const fedCache = {};
WD.fedHolidays = y => fedCache[y] || (fedCache[y] = [['New Year’s Day', y + '-01-01'], ['Martin Luther King Jr. Day', nthDay(y, 0, 1, 3)], ['Presidents’ Day', nthDay(y, 1, 1, 3)], ['Memorial Day', lastDay(y, 4, 1)], ['Juneteenth', y + '-06-19'],
  ['Independence Day', y + '-07-04'], ['Labor Day', nthDay(y, 8, 1, 1)], ['Columbus Day', nthDay(y, 9, 1, 2)], ['Veterans Day', y + '-11-11'], ['Thanksgiving', nthDay(y, 10, 4, 4)], ['Christmas Day', y + '-12-25']]
  .map(([name, date]) => { const w = dow(date); return { name, date, day: w === 6 ? D.add(date, -1) : w === 0 ? D.add(date, 1) : date }; }));
WD.fedOn = () => ST.holidays.federal !== false;
/** The federal holiday on a day or observed on it, if they are shown: { name, label, day, date, observed }. */
WD.fedHoliday = k => { if (!WD.fedOn() || !k) return null; const y = +k.slice(0, 4);
  const x = [y - 1, y, y + 1].flatMap(WD.fedHolidays).find(f => f.day === k) || WD.fedHolidays(y).find(f => f.date === k); if (!x) return null;
  const observed = x.day === k && x.date !== k; return { ...x, observed, label: x.name + (observed ? ' (observed)' : '') }; };
/** Federal holidays observed in the next year, soonest first. */
const fedAhead = () => { const y = D.parse(today()).getFullYear(); return [y, y + 1].flatMap(WD.fedHolidays).filter(f => f.day >= today() && D.diff(f.day, today()) < 366).sort((a, b) => a.day.localeCompare(b.day)); };
/** Upcoming public holidays to offer when marking one: the federal ones on the day they are observed, and the two days companies often add. */
function upcoming() {
  const out = [];
  [0, 1].forEach(i => { const y = D.parse(today()).getFullYear() + i; WD.fedHolidays(y).forEach(f => out.push([f.name, f.day]));
    out.push(['Day after Thanksgiving', D.add(nthDay(y, 10, 4, 4), 1)], ['Christmas Eve', y + '-12-24']); });
  return out.filter(([, k]) => k > today() && D.diff(k, today()) < 366 && !data.holidays.some(x => x.day === k)).sort((a, b) => a[1].localeCompare(b[1]));
}

/** Recommend where the jobs on days off should go, route by route, the way a dispatcher would:
    first try pulling the week forward — the holiday's jobs go to the working day before, that day's go to the day before it, and so on back to a day
    with room to take two days of stops; that only works inside the same week, on days still to come. Otherwise push the jobs to the next working day with room.
    → [{ routeId, from, to, jobs, why }] */
function recommend(offDays) {
  const moves = [], C = cap();
  q.routes().forEach(r => {
    const virt = {}, load = k => virt[k] != null ? virt[k] : dayLoad(r.id, k), touched = new Set();
    offDays.slice().sort().forEach(hd => {
      const jobs = movable(r.id, hd); if (!jobs.length) return;
      const back = []; let taken = false; for (let k = D.add(hd, -1); k >= weekStart(hd) && k > today(); k = D.add(k, -1)) { if (!works(r.id, k, offDays)) continue; if (touched.has(k)) { taken = true; break; } back.push(k); }
      let incoming = loadOf(jobs), hit = -1;
      for (let i = 0; i < back.length; i++) { if (load(back[i]) + incoming <= C) { hit = i; break; } incoming = loadOf(movable(r.id, back[i])); }
      if (hit >= 0) {
        const chain = [hd].concat(back.slice(0, hit + 1));
        for (let i = 0; i < chain.length - 1; i++) { const from = chain[i], to = chain[i + 1], js = i === 0 ? jobs : movable(r.id, from), last = i === chain.length - 2;
          moves.push({ routeId: r.id, from, to, jobs: js, why: last ? wd(to) + ' isn’t a full route, so it can take ' + wd(from) + '’s stops too' : (i === 0 ? 'Closed ' + wd(from) : wd(from) + ' makes room for ' + wd(chain[i - 1])) + ' · ' + wd(to) + '’s own stops move a day earlier' });
          touched.add(from); touched.add(to); }
        const endDay = chain[chain.length - 1], endLoad = load(endDay) + loadOf(movable(r.id, chain[chain.length - 2])); chain.slice(1, -1).forEach((k, i) => { virt[k] = loadOf(movable(r.id, chain[i])); }); virt[endDay] = endLoad;
        return;
      }
      let to = D.add(hd, 1), tries = 0, firstOpen = null;
      const open = k => dow(k) !== 6 && works(r.id, k, offDays);   // a moved day goes to a weekday; Saturday can still be chosen by hand
      while (tries < 14) { if (open(to)) { firstOpen = firstOpen || to; if (load(to) + loadOf(jobs) <= C) break; tries++; } to = D.add(to, 1); if (D.diff(to, hd) > 21) break; }
      const fits = open(to) && load(to) + loadOf(jobs) <= C; if (!fits) to = firstOpen || D.add(hd, 1);
      moves.push({ routeId: r.id, from: hd, to, jobs, why: (back.length ? 'No earlier day this week has room' : taken ? 'The earlier days this week are already taking other stops' : 'No working day earlier in the week') + ' · ' + (fits ? wd(to) + ' ' + md(to) + ' has room' : 'the next working day; it will be a long one') });
      virt[to] = load(to) + loadOf(jobs); touched.add(hd); touched.add(to);
    });
  });
  return moves;
}
/** Day loads for a route after a set of moves: [{ day, mins, n, over }] for every day a move touches. */
function loadsAfter(routeId, moves) {
  const mine = moves.filter(m => m.routeId === routeId && m.to), days = [...new Set(mine.flatMap(m => [m.from, m.to]))].sort();
  return days.map(k => { const out = mine.filter(m => m.from === k).flatMap(m => m.jobs), stay = q.stopList(routeId, k).filter(j => !WD.calledOff(j) && !out.includes(j)), list = stay.concat(mine.filter(m => m.to === k).flatMap(m => m.jobs)); return { day: k, mins: loadOf(list), n: list.length, over: loadOf(list) > cap() }; });
}
const loadChips = (routeId, moves) => { const ls = loadsAfter(routeId, moves); return ls.length ? h('div.op-load', ls.map(l => h('span' + (l.over ? '.over' : l.n ? '' : '.empty'), wd(l.day).slice(0, 3) + ' ' + md(l.day).replace(/^\w+ /, ''), ' ', h('b', l.n ? plural(l.n, 'stop') + ' · ' + fmt.dur(l.mins) : 'empty')))) : null; };
/** Candidate days to move a route's jobs to, around a date. */
const targets = (routeId, from, offDays) => { const out = []; for (let i = -7; i <= 14; i++) { const k = D.add(from, i); if (k !== from && k > today() && works(routeId, k, offDays)) out.push({ value: k, label: fmt.day(k) + (q.stopList(routeId, k).length ? ' · ' + plural(q.stopList(routeId, k).filter(j => !WD.calledOff(j)).length, 'stop') : ' · empty') }); } return out; };

/** Move the jobs (one all-or-nothing change), label emptied days, then offer to tell the customers. reason: words for the history and the text. */
function applyMoves(moves, o) {
  const live = moves.filter(m => m.to && m.jobs.length), n = live.reduce((s, m) => s + m.jobs.length, 0), who = me(); if (!n && !(o.marks || []).length) return false;
  const moved = [];
  if (n) api.op({ kind: 'batch', title: o.title, scope: plural(n, 'job') + ' · all or nothing', jobIds: live.flatMap(m => m.jobs.map(j => j.id)), apply() {
    live.forEach(m => m.jobs.forEach(j => { moved.push({ j, from: m.from, to: m.to, route: m.toRoute && m.toRoute !== j.routeId ? m.toRoute : null, was: j.routeId }); }));
    moved.forEach(({ j, from, to, route, was }) => { WD.placeJob(j, route || j.routeId, to, Infinity); if (to !== from) j.movedFrom = from; j.offWindow = null; j.version = (j.version || 0) + 1;
      j.events.push({ at: +WD.now(), actor: who, text: [to !== from && 'Moved from ' + fmt.day(from) + ' to ' + fmt.day(to), route && 'Reassigned from ' + q.routeName(was) + ' to ' + q.routeName(route), o.reason, j.recurring && 'this visit only'].filter(Boolean).join(' · ') }); }); } });
  (o.marks || []).forEach(m => { if (m.kind) data.dayMarks[m.routeId + '|' + m.day] = { kind: m.kind, label: markLabel(m.kind) }; });
  WD.changed();
  ui.toast(n ? 'Moved ' + plural(n, 'job') + ' · run AutoRoute on the new ' + (o.batch ? 'lists' : 'days') : 'Saved', 'checkmark', 2800);
  const tell = moved.filter(x => { if (x.to === x.from) return false; const c = q.customer(x.j.customerId); return c && c.contacts.some(p => p.phone); });
  if (n && ST.holidays.notify && tell.length) setTimeout(async () => { const x = tell[0], c = q.customer(x.j.customerId), sample = CO.fill(CO.tpl('moved').body, CO.ctxFor(c, { date: fmt.day(x.to, 'long'), olddate: fmt.day(x.from, 'long'), reason: o.reason }));
    const v = await ui.actionSheet({ title: 'Text ' + plural(tell.length, 'customer') + ' their new day?', message: 'From the “Service day changed” template, for example:\n\n' + sample, buttons: [{ label: 'Send the texts', value: true }], cancel: 'Not now' });
    if (v) { tell.forEach(t => t.j.events.push({ at: +WD.now(), actor: who, text: 'Customer texted the new service day' })); WD.changed(); ui.toast('Texts sent · ' + tell.length, 'message', 2400); } }, 900);
  return true;
}

/** Review the recommended moves for one or more days off. Every row can be changed before approving. */
function planSheet(offDays, title) {
  const moves = recommend(offDays), names = offDays.map(k => (data.holidays.find(x => x.day === k) || { name: 'Day off' }).name + ' · ' + fmt.day(k));
  if (!moves.length) return ui.toast('No jobs are scheduled on ' + (offDays.length === 1 ? 'that day' : 'those days'), 'checkmark', 2600);
  const total = () => moves.filter(m => m.to).reduce((s, m) => s + m.jobs.length, 0), routes = [...new Set(moves.map(m => m.routeId))];
  ui.sheet({ title: 'Suggested moves', leading: [{ label: 'Not now', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Approve', bold: true, disabled: !total(), onTap: async p => { const over = routes.flatMap(r => loadsAfter(r, moves).filter(l => l.over).map(l => q.routeName(r) + ' ' + wd(l.day)));
      if (over.length && !(await ui.actionSheet({ title: over.length === 1 ? 'One day will be longer than a full route' : over.length + ' days will be longer than a full route', message: over.join(', ') + '. A full route is set at ' + ST.holidays.fullHours + ' hours.', buttons: [{ label: 'Approve anyway', value: true }], cancel: 'Keep adjusting' }))) return;
      p.dismiss(); applyMoves(moves, { title: title + ' · schedule change', reason: title }); } }],
    render: p => ui.list(
      note(names.join(' and ') + '. ' + plural(moves.reduce((s, m) => s + m.jobs.length, 0), 'job') + ' on ' + plural(routes.length, 'route') + ' need a new day. These are suggestions: change any of them, or leave a day’s jobs where they are, then approve.'),
      routes.map(rid => ui.section({ header: q.routeName(rid), footer: 'After the moves. Red is longer than a full route (' + ST.holidays.fullHours + ' hours of stops and driving).' },
        moves.filter(m => m.routeId === rid).map(m => ui.pickerRow({ title: wd(m.from) + ' ' + md(m.from) + ' · ' + plural(m.jobs.length, 'job'), subtitle: m.to ? m.why : 'Left where they are', value: m.to || '', options: targets(rid, m.from, offDays).concat({ value: '', label: 'Leave them where they are' }), onChange: v => { m.to = v || null; m.why = 'Your choice'; p.refresh(); } })),
        loadChips(rid, moves))),
      ui.section({ footer: 'Recurring jobs move for this visit only; the rest of the series keeps its usual day. Moved jobs go to the end of the new day’s list, so run AutoRoute on those days afterward.' },
        ui.toggleRow({ title: 'Offer to text customers their new day', value: ST.holidays.notify, onChange: v => { ST.holidays.notify = v; } }))) }, { detent: 'large' });
}

/** Mark one or more days as a holiday, then (when suggestions are on) review where the jobs should go. */
function holidaySheet() {
  const f = { name: '', day: '', also: [] }, up = upcoming();
  const pick = (name, day) => { if (!f.day) { f.name = name; f.day = day; } else if (day !== f.day && !f.also.some(x => x.day === day)) f.also.push({ name, day }); };
  ui.sheet({ title: 'Mark a holiday', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Mark', bold: true, onTap: async p => { if (!f.day) return ui.toast('Choose the date', 'calendar'); if (f.day <= today()) return ui.toast('Choose a day after today', 'calendar');
      const days = [{ name: f.name.trim() || 'Holiday', day: f.day }].concat(f.also).filter(x => !data.holidays.some(y => y.day === x.day));
      if (!await ui.run('Marking…', () => { days.forEach(x => data.holidays.push(x)); data.holidays.sort((a, b) => a.day.localeCompare(b.day)); }, { done: 'Marked' })) return;
      p.dismiss(); if (ST.holidays.suggest) setTimeout(() => planSheet(days.map(x => x.day), days[0].name), 450); } }],
    render: p => ui.list(
      ui.section({ footer: 'The company is closed that day on every route. The board shows it, and scheduling a job on it asks first.' },
        ui.inputRow({ label: 'Name', placeholder: 'e.g. Thanksgiving', caps: 'words', value: f.name, onInput: v => { f.name = v; } }), ui.dateRow({ title: 'Date', value: f.day, onChange: v => { f.day = v; p.refresh(); } }),
        f.also.map((x, i) => ui.row({ title: 'Also closed ' + fmt.day(x.day), subtitle: x.name, trailing: h('button.bi-del', { 'aria-label': 'Remove', onclick: () => { f.also.splice(i, 1); p.refresh(); } }, icon('minus.circle.fill', 22, 'var(--red)')) }))),
      up.length > 0 && ui.section({ header: 'Coming up', footer: 'Tap one to fill it in. Tap a second to close both days, like Thanksgiving and the Friday after.' },
        up.slice(0, 6).map(([name, day]) => { const on = f.day === day || f.also.some(x => x.day === day); return ui.row({ title: name, detail: fmt.day(day), trailing: on ? icon('checkmark', 18, 'var(--tint)') : null, onTap: () => { if (!on) pick(name, day); p.refresh(); } }); }))) }, { detent: 'large' });
}

/** Read a typed request such as “move all jobs from Wednesday this week to Tuesday” → { from, to, routeId } (whatever it could find). */
function parseAsk(text) {
  const s = ' ' + text.toLowerCase() + ' ', names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], hits = [], base = weekStart(today());
  names.forEach((nm, i) => { const re = new RegExp('\\b(next\\s+)?(' + nm + '|' + nm.slice(0, 3) + ')\\b', 'g'); let m; while ((m = re.exec(s))) { let k = D.add(base, (i + 6) % 7 + (m[1] ? 7 : 0)); if (k < today()) k = D.add(k, 7); hits.push({ at: m.index, day: k }); } });
  [['tomorrow', 1], ['today', 0]].forEach(([w, n]) => { const i = s.indexOf(w); if (i >= 0) hits.push({ at: i, day: D.add(today(), n) }); });
  hits.sort((a, b) => a.at - b.at); const shift = /next week/.test(s) ? 7 : 0, r = q.routes().find(x => s.includes(q.routeName(x).toLowerCase()) || s.includes(x.name.toLowerCase()));
  return { from: hits[0] ? D.add(hits[0].day, shift) : null, to: hits[1] ? D.add(hits[1].day, shift) : null, routeId: r ? r.id : null };
}
/** One-time change: move a day's jobs (one route or all of them) to another day, and label the day they left. */
function moveSheet(pre = {}) {
  /* to: another day (blank keeps the day). toRoute: another route (blank keeps the route). Either or both; only jobs that haven't started move. */
  const f = { routeId: pre.routeId || 'all', from: pre.from || (S.board.day > today() ? S.board.day : D.add(today(), 1)), to: pre.to || '', toRoute: '', mark: '', ask: '', skip: new Set() };
  const day = () => f.to || f.from, dest = rid => f.toRoute && f.toRoute !== rid ? f.toRoute : null;
  const rids = () => f.routeId === 'all' ? q.routes().map(r => r.id) : [f.routeId];
  const moves = () => rids().map(rid => ({ routeId: rid, from: f.from, to: day(), toRoute: dest(rid), jobs: movable(rid, f.from).filter(j => !f.skip.has(j.id)) })).filter(m => m.jobs.length && (m.to !== m.from || m.toRoute));
  const count = () => rids().reduce((s, rid) => s + movable(rid, f.from).filter(j => !f.skip.has(j.id)).length, 0);
  ui.sheet({ title: pre.bulk ? 'Move a route’s jobs' : 'Move a day’s jobs', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Move', bold: true, onTap: async p => { if (!f.to && !f.toRoute) return ui.toast('Choose another day, another route, or both', 'calendar'); if (day() === f.from && !rids().some(dest)) return ui.toast('Choose a different day or a different route', 'calendar'); if (day() < today()) return ui.toast('That day has passed', 'calendar');
      const ms = moves(), marks = f.mark ? rids().map(rid => ({ routeId: rid, day: f.from, kind: f.mark })) : []; if (!ms.length && !marks.length) return ui.toast('No unfinished jobs to move on ' + fmt.day(f.from), 'info.circle');
      const hd = WD.dayMark(f.toRoute || rids()[0], day()); if (hd && hd.kind !== 'purgeOnly' && day() !== f.from && !(await ui.actionSheet({ title: fmt.day(day()) + ' is marked “' + hd.label + '”', buttons: [{ label: 'Move them there anyway', value: true }], cancel: 'Pick another day' }))) return;
      if (f.toRoute && WD.r11 && !(await WD.r11.checkAssign(ms.flatMap(m => m.jobs), f.toRoute, day()))) return;
      /* Say how far the jobs are moving from the day they were scheduled for, and ask. */
      const n = ms.reduce((s, m) => s + m.jobs.length, 0), shift = D.diff(day(), f.from), what = (f.routeId === 'all' ? 'these routes' : 'this route');
      if (!(await ui.actionSheet({ title: shift ? 'You are moving ' + what + ' ' + plural(Math.abs(shift), 'day') + (shift > 0 ? ' later' : ' earlier') + ' than it was originally scheduled for. Are you sure?' : 'Move ' + plural(n, 'unfinished job') + ' to ' + q.routeName(f.toRoute) + '?',
        message: plural(n, 'unfinished job') + ' · ' + fmt.day(f.from, 'long') + (shift ? ' → ' + fmt.day(day(), 'long') : '') + (f.toRoute ? ' · to ' + q.routeName(f.toRoute) : '') + '. Finished, skipped and in-progress stops stay where they are.', buttons: [{ label: shift ? 'Yes, move ' + plural(Math.abs(shift), 'day') + (shift > 0 ? ' later' : ' earlier') : 'Move them', value: true }] }))) return;
      p.dismiss(); applyMoves(ms, { title: (f.routeId === 'all' ? 'All routes' : q.routeName(f.routeId)) + ' · ' + wd(f.from) + (shift ? ' to ' + wd(day()) : '') + (f.toRoute ? ' → ' + q.routeName(f.toRoute) : ''), reason: 'a schedule change', marks, batch: !!f.toRoute }); } }],
    render: p => { const ms = moves(), n = count(), every = rids().flatMap(rid => movable(rid, f.from)), left = every.filter(j => f.skip.has(j.id)).length;
      const pick = ui.section({ header: 'What to move', footer: n ? plural(n, 'job') + ' not yet started on ' + fmt.day(f.from, 'long') + (left ? ' · ' + left + ' staying' : '') + '. Only unfinished jobs move; finished, skipped and in-progress stops stay. Choose another day, another route, or both. One time only: recurring jobs go back to their usual day and route next time.' : 'No unfinished jobs to move on ' + fmt.day(f.from, 'long') + '.' },
          ui.pickerRow({ title: 'Route', value: f.routeId, options: [{ value: 'all', label: 'All routes' }].concat(q.routes().map(r => ({ value: r.id, label: q.routeName(r) }))), onChange: v => { f.routeId = v; f.skip.clear(); p.refresh(); } }),
          ui.dateRow({ title: 'From', value: f.from, onChange: v => { f.from = v; f.skip.clear(); p.refresh(); } }), ui.dateRow({ title: 'To day', value: f.to, onChange: v => { f.to = v; p.refresh(); } }),
          !f.to && ui.row({ title: 'Same day', subtitle: 'Pick a date above to move them to another day', disabled: true }),
          ui.pickerRow({ title: 'To route', subtitle: 'Optional: hand the jobs to another route', value: f.toRoute, options: [{ value: '', label: 'Same route' }].concat(q.routes().filter(r => r.writable && r.id !== f.routeId).map(r => ({ value: r.id, label: q.routeName(r) }))), onChange: v => { f.toRoute = v; p.refresh(); } }));
      const jobsSec = every.length > 0 && ui.section({ header: 'Jobs on ' + fmt.day(f.from) + ' · ' + every.length, footer: 'All of them move together in one step. Switch one off to leave it on its day.' },
          every.map(j => ui.toggleRow({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: 'Stop ' + q.position(j).n + (f.routeId === 'all' ? ' · ' + q.routeName(j.routeId) : ''), value: !f.skip.has(j.id), onChange: v => { v ? f.skip.delete(j.id) : f.skip.add(j.id); p.refresh(); } })));
      return ui.list(
        pre.bulk && pick, pre.bulk && jobsSec,
        ui.section({ header: 'Tell it what to do', footer: 'For example “move all jobs from Wednesday this week to Tuesday”, or “East Route Friday to next Monday”. It fills in the choices below for you to check.' },
          ui.inputRow({ placeholder: 'Move Wednesday to Tuesday', value: f.ask, onInput: v => { f.ask = v; } }),
          ui.row({ icon: 'sparkles', iconPlain: true, title: 'Fill in from what I typed', tint: true, onTap: () => { const r = parseAsk(f.ask); if (r.toRoute) f.toRoute = r.toRoute; if (!r.from && !r.to && !r.toRoute) return ui.toast('Name the days, like “Wednesday to Tuesday”', 'info.circle', 2600); if (r.from) f.from = r.from; if (r.to) f.to = r.to; if (r.routeId) f.routeId = r.routeId; const a = document.activeElement; if (a && a.blur) a.blur(); p.refresh(); ui.toast(fmt.day(f.from) + (f.to ? ' → ' + fmt.day(f.to) : ''), 'checkmark', 2200); } })),
        !pre.bulk && pick, !pre.bulk && jobsSec,
        ms.length > 0 && ui.section({ header: 'After the move', footer: 'Red is longer than a full route (' + ST.holidays.fullHours + ' hours).' }, ms.map(m => [ui.row({ leading: ui.dot(q.routeColor(m.toRoute || m.routeId)), title: q.routeName(m.routeId) + (m.toRoute ? ' → ' + q.routeName(m.toRoute) : ''), subtitle: m.toRoute ? 'Added to the end of ' + q.routeName(m.toRoute) + ' on ' + fmt.day(m.to) + ' · run AutoRoute there' : null, detail: plural(m.jobs.length, 'job') }), !m.toRoute && loadChips(m.routeId, ms)])),
        ui.section({ header: 'Label ' + fmt.day(f.from) + ' on the board', footer: f.mark === 'closed' ? 'For a driver’s vacation or a truck in the shop. Scheduling a job on that route and day asks first.' : f.mark === 'purgeOnly' ? 'For a day kept free for a large purge. Purge jobs schedule normally; anything else asks first.' : 'The emptied day can be labeled so nobody fills it back up.' },
          ui.pickerRow({ title: 'Label the emptied day', value: f.mark, options: MARKS, onChange: v => { f.mark = v; p.refresh(); } }))); } }, { detent: 'large' });
}
OP.schedSpec = () => ({ title: 'Holidays and schedule changes', render: page => { const o = ST.holidays, can = WD.can('jobs.edit'), marks = Object.entries(data.dayMarks).map(([k, m]) => ({ k, routeId: k.split('|')[0], day: k.split('|')[1], ...m })).filter(m => m.day >= today()).sort((a, b) => a.day.localeCompare(b.day));
  const hol = data.holidays.filter(x => x.day >= today()), left = k => q.routes().reduce((s, r) => s + movable(r.id, k).length, 0);
  const closeFor = async f => { if (!await ui.actionSheet({ title: f.label || f.name, message: fmt.day(f.day, 'long') + '. Marking it closes the company that day on every route.' + (o.suggest ? ' You then review where its jobs go.' : ''), buttons: [{ label: 'Mark the company closed', value: true }] })) return;
    data.holidays.push({ day: f.day, name: f.name }); data.holidays.sort((a, b) => a.day.localeCompare(b.day)); WD.changed(); page.refresh(); if (o.suggest && left(f.day)) setTimeout(() => planSheet([f.day], f.name), 450); };
  return ui.list(
    ui.section({ header: 'Holidays', footer: o.suggest ? 'Marking a holiday looks at the week’s schedule and suggests where its jobs should go: pulling the week a day earlier when an earlier day has room, otherwise the next working day. Nothing moves until you approve.' : 'Suggestions are off. A holiday is only marked on the board; move its jobs yourself.' },
      hol.map(x => { const n = left(x.day); return ui.row({ icon: 'calendar', iconColor: 'var(--red)', title: x.name, subtitle: fmt.day(x.day, 'long') + ' · ' + (n ? plural(n, 'job') + ' still scheduled' : 'no jobs scheduled'), badge: n ? ui.badge('Plan', 'var(--orange)') : null, chevron: can,
        onTap: can ? async () => { const v = await ui.actionSheet({ title: x.name + ' · ' + fmt.day(x.day), buttons: [n && { label: 'Suggest where the jobs go', value: 'plan' }, { label: 'Remove the holiday', value: 'del', role: 'destructive' }].filter(Boolean) }); if (v === 'plan') planSheet(hol.filter(y => weekStart(y.day) === weekStart(x.day)).map(y => y.day), x.name); if (v === 'del') { data.holidays.splice(data.holidays.indexOf(x), 1); WD.changed(); page.refresh(); } } : null }); }),
      !hol.length && ui.row({ title: 'No holidays marked', subtitle: 'The next one is ' + (u => u ? u[0] + ', ' + fmt.day(u[1]) : 'a while off')(upcoming()[0]) }),
      can && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Mark a holiday', tint: true, onTap: holidaySheet })),
    WD.fedOn() && ui.section({ header: 'Federal holidays', fold: true, showFooter: true, footer: 'Shown on the calendars, and scheduling a job on one asks first. Government offices and banks are closed on these days. The company stays open unless you mark the day closed.' },
      fedAhead().map(f => { const closed = data.holidays.some(x => x.day === f.day), n = left(f.day), wk = [0, 6].includes(dow(f.day));
        return ui.row({ icon: 'flag', iconColor: closed ? 'var(--red)' : 'var(--gray)', title: f.name, subtitle: fmt.day(f.day, 'long') + (f.day !== f.date ? ' · observed' : '') + (closed || wk ? '' : ' · ' + (n ? plural(n, 'job') + ' scheduled' : 'no jobs scheduled')), detail: closed ? 'Closed' : wk ? 'Weekend' : 'Open', chevron: can && !closed, onTap: can && !closed ? () => closeFor(f) : null }); })),
    ui.section({ header: 'One-time changes', footer: 'For a driver’s vacation or a large job: move one day’s jobs to another day, on one route or all of them, this once. The emptied day can be labeled “Do not schedule jobs” or “Large purge jobs only”.' },
      marks.map(m => ui.row({ leading: ui.dot(q.routeColor(m.routeId)), title: q.routeName(m.routeId) + ' · ' + fmt.day(m.day), subtitle: m.label, trailing: can ? ui.button('Remove', { kind: 'gray', small: true, block: false, onTap: () => { delete data.dayMarks[m.k]; WD.changed(); page.refresh(); } }) : null })),
      can && ui.row({ icon: 'arrow.left.arrow.right', iconPlain: true, title: 'Move a route’s jobs to another day…', subtitle: 'All jobs on one route, or every route, in one step', tint: true, onTap: () => moveSheet({ bulk: true }) })),
    admin() && ui.section({ header: 'Settings', footer: 'Not every company wants suggestions, so they can be switched off. “A full route” is how the app judges whether a day has room for another day’s stops.' },
      ui.toggleRow({ title: 'Show federal holidays', subtitle: 'On the month and the board, and when scheduling a job', value: WD.fedOn(), onChange: v => { o.federal = v; WD.changed(); page.refresh(); } }),
      ui.toggleRow({ title: 'Suggest moves when a holiday is marked', value: o.suggest, onChange: v => { o.suggest = v; WD.changed(); page.refresh(); } }),
      step('A full route is about', 'Stops plus driving', o.fullHours + ' hours', o.fullHours, 4, 14, v => { o.fullHours = v; WD.changed(); page.refresh(); }),
      ui.toggleRow({ title: 'Offer to text customers their new day', value: o.notify, onChange: v => { o.notify = v; WD.changed(); } }), CO.tplRow('moved', page)));
} });
OP.openSchedule = () => WD.nav.push(OP.schedSpec());
/** Bulk move from the board: every job on a route (or all routes) to another day, in one all-or-nothing change. */
OP.moveSheet = pre => moveSheet({ bulk: true, ...pre });
OP.applyMoves = applyMoves; OP.loadChips = loadChips;

/* ================= Which number and address messages come from ================= */
const FROM = [{ value: 'match', label: 'The company number nearest the customer' }, { value: 'main', label: 'The main company number' }, { value: 'driver', label: 'The sender’s own cell phone' }];
const fromLabel = v => ({ match: 'Nearest company number', main: 'Main company number', driver: 'Own cell phone' })[v];
const CM = ST.comms, mainNo = () => CM.numbers.find(x => x.main) || CM.numbers[0];
OP.commsLabel = () => fromLabel(CM.textFrom);
/** The number a text or call to this customer goes out from, for this sender: { number, how, text }. */
OP.senderFor = (c, user, kind) => {
  const mode = (user && CM.byUser[user.id]) || (kind === 'call' ? CM.callFrom : CM.textFrom), fb = mainNo();
  if (mode === 'driver') { if (user && user.phone) return { number: user.phone, how: 'own', text: first(user.name) + '’s own cell, ' + fmt.phone(user.phone) }; return { number: fb.n, how: 'main', text: fmt.phone(fb.n) + ' (' + fb.label + '; no cell number on file for ' + first(user && user.name) + ')' }; }
  if (mode === 'match' && c) { const zip = CO.zipOf(c), area = CO.areaOf(c), x = CM.numbers.find(n => n.zips.includes(zip)) || CM.numbers.find(n => n.areas.includes(area)); if (x) return { number: x.n, how: 'match', text: fmt.phone(x.n) + ' (' + x.label + ')' }; }
  return { number: fb.n, how: 'main', text: fmt.phone(fb.n) + ' (' + fb.label + ')' };
};
OP.emailFrom = user => (CM.emailName === 'driver' && user ? first(user.name) + ' at ' + (S.org || data.orgs[0]).name : (S.org || data.orgs[0]).name) + ' <' + CM.emailFrom + '>';
function numberSheet(x, page) {
  const f = x ? { label: x.label, n: fmt.phone(x.n), areas: x.areas.join(', '), zips: x.zips.join(', '), main: !!x.main } : { label: '', n: '', areas: '', zips: '', main: false }, list = s => s.split(/[,\s]+/).map(v => v.trim()).filter(Boolean);
  ui.sheet({ title: x ? 'Company number' : 'Add a number', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Save', bold: true, onTap: p => { if (!fmt.phoneValid(f.n)) return ui.toast('Phone numbers need 10 digits', 'phone'); const rec = { label: f.label.trim() || 'Company number', n: '+1' + fmt.phoneDigits(f.n), areas: list(f.areas), zips: list(f.zips), main: f.main };
      if (rec.main) CM.numbers.forEach(y => { y.main = false; }); if (x) Object.assign(x, rec); else CM.numbers.push({ id: uid('n'), ...rec }); if (!CM.numbers.some(y => y.main)) CM.numbers[0].main = true; WD.changed(); p.dismiss(); page.refresh(); } }],
    render: p => ui.list(
      ui.section(ui.inputRow({ label: 'Label', placeholder: 'e.g. Fresno line', caps: 'words', value: f.label, onInput: v => { f.label = v; } }), ui.inputRow({ label: 'Number', type: 'tel', inputmode: 'tel', placeholder: '(555) 555-0100', value: f.n, onInput: v => { f.n = v; } })),
      ui.section({ header: 'Customers this number is for', footer: 'A customer is matched by the ZIP code of the service address first, then by the area code of their own phone. Leave both empty for a number that is never chosen automatically.' },
        ui.inputRow({ label: 'ZIP codes', placeholder: '93721, 93722', inputmode: 'numeric', value: f.zips, onInput: v => { f.zips = v; } }), ui.inputRow({ label: 'Area codes', placeholder: '559', inputmode: 'numeric', value: f.areas, onInput: v => { f.areas = v; } })),
      ui.section({ footer: 'The main number is used when no other number matches the customer.' }, ui.toggleRow({ title: 'Main number', value: f.main, onChange: v => { f.main = v; } })),
      x && CM.numbers.length > 1 && ui.section(null, ui.row({ title: 'Remove this number', destructive: true, onTap: () => { CM.numbers.splice(CM.numbers.indexOf(x), 1); if (!CM.numbers.some(y => y.main)) CM.numbers[0].main = true; WD.changed(); p.dismiss(); page.refresh(); } }))) }, { detent: 'large' });
}
OP.commsSpec = () => ({ title: 'Calls, texts and email', render: page => { if (!admin()) return locked(); const drivers = data.users.filter(u => u.status === 'active' && ['driver', 'dispatcher', 'office'].includes(u.role)), re = () => { WD.changed(); page.refresh(); };
  const foot = (v, what) => v === 'driver' ? what + ' from the person’s own phone and number. The customer can reply to them directly; those replies are not on the customer’s timeline.' : what + ' through your phone service (Quo) from a company number, so the customer never sees a personal cell number. Replies and call-backs come to the company line and show on the customer’s timeline.';
  const samples = data.customers.filter(c => c.lifecycle === 'customer' && c.contacts.some(p => p.phone)).filter((c, i, a) => a.findIndex(x => CO.zipOf(x) === CO.zipOf(c)) === i).slice(0, 4), drv = data.users.find(u => u.role === 'driver' && u.status === 'active');
  return ui.list(note('When a driver or the office texts, calls or emails a customer from the app (reminders, on-my-way notices, confirmations, invoices), this decides which number and address it comes from.'),
    ui.section({ header: 'Texts', footer: foot(CM.textFrom, 'Texts go out') }, ui.pickerRow({ title: 'Send from', icon: 'message', iconColor: 'var(--green)', value: CM.textFrom, options: FROM, onChange: v => { CM.textFrom = v; re(); } })),
    ui.section({ header: 'Calls', footer: CM.callFrom === 'driver' ? 'The call is placed from the person’s own phone and the customer sees their cell number.' : 'The app connects the call through Quo: the driver’s phone rings, then the customer’s, and the customer sees the company number.' }, ui.pickerRow({ title: 'Call from', icon: 'phone.fill', iconColor: 'var(--blue)', value: CM.callFrom, options: FROM, onChange: v => { CM.callFrom = v; re(); } })),
    ui.section({ header: 'Company numbers', footer: 'These come from Quo (Settings → Integrations). “Nearest” picks the number set for the ZIP code of the customer’s service address, then for the area code of their phone, and falls back to the main number.' },
      CM.numbers.map(x => ui.row({ icon: 'phone.fill', iconColor: x.main ? 'var(--blue)' : 'var(--gray)', title: fmt.phone(x.n), subtitle: x.label + ' · ' + ([x.zips.length && 'ZIP ' + x.zips.join(', '), x.areas.length && 'area code ' + x.areas.join(', ')].filter(Boolean).join(' · ') || 'never chosen automatically'), badge: x.main ? ui.badge('Main', 'var(--blue)') : null, chevron: true, onTap: () => numberSheet(x, page) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a number', tint: true, onTap: () => numberSheet(null, page) })),
    ui.section({ header: 'By person', footer: 'For someone who should always use something different from the company choice, such as a driver who texts from their own cell.' },
      drivers.map(u => ui.pickerRow({ title: u.name, subtitle: WD.roles[u.role].title + (u.phone ? ' · cell ' + fmt.phone(u.phone) : ' · no cell on file'), value: CM.byUser[u.id] || '', options: [{ value: '', label: 'Company choice' }].concat(FROM), onChange: v => { if (v) CM.byUser[u.id] = v; else delete CM.byUser[u.id]; re(); } }))),
    samples.length > 0 && ui.section({ header: 'How it works out', footer: 'A text from ' + (drv ? first(drv.name) : 'a driver') + ' to each of these customers, with the choices above.' },
      samples.map(c => { const s = OP.senderFor(c, drv, 'text'); return ui.row({ title: c.name, subtitle: 'ZIP ' + CO.zipOf(c) + ' · sent from ' + s.text }); })),
    ui.section({ header: 'Email', footer: 'Every email the app sends (confirmations, invoices, agreements, reminders) goes out from this company address, sent by the server through the connected mailbox. Drivers never sign in to that mailbox and cannot read it; they only tap Send. Replies come back to the company mailbox. Nothing needs to change in how your drivers are set up.' },
      ui.inputRow({ label: 'From', type: 'email', caps: 'off', value: CM.emailFrom, onInput: v => { CM.emailFrom = v.trim(); } }),
      ui.pickerRow({ title: 'Sender name shown', value: CM.emailName, options: [{ value: 'company', label: 'The company name' }, { value: 'driver', label: 'The driver’s first name at the company' }], onChange: v => { CM.emailName = v; re(); } }),
      ui.row({ title: 'Customers see', subtitle: OP.emailFrom(drv) }), ui.row({ title: 'Drivers can send from their own email', detail: 'Never' })));
} });

/* ================= Confirmation when a new job is scheduled ================= */
const CF = ST.confirm, CMODE = [{ value: 'off', label: 'Don’t send one' }, { value: 'ask', label: 'Show it first, then send' }, { value: 'auto', label: 'Send it automatically' }], CCHAN = [{ value: 'text', label: 'Text message' }, { value: 'email', label: 'Email' }, { value: 'both', label: 'Text and email' }];
OP.confirmLabel = () => CF.mode === 'off' ? 'Off' : (CF.mode === 'auto' ? 'Automatic' : 'Shown first') + ' · ' + ({ text: 'text', email: 'email', both: 'text and email' })[CF.channel];
/** Pricing a confirmation can include, from what the customer told us when the job was scheduled: 'rates' (the price of each thing), 'total' (the estimated cost) or 'both'.
    The company default is in Settings → Job confirmations; whoever schedules the job can choose differently for one message. */
const CPRICE = [{ value: 'none', label: 'No pricing' }, { value: 'rates', label: 'Rates only' }, { value: 'total', label: 'Estimated total only' }, { value: 'both', label: 'Rates and estimated total' }], cpLabel = v => (CPRICE.find(x => x.value === v) || CPRICE[0]).label;
/* The estimate is worked out from what the customer told us, so every message that carries one says how rough it is. */
const ROUGH = 'This is only a rough estimate based on the details you gave us. The final charge depends on what we actually service.';
OP.pricingOptions = CPRICE;
const UNIT = { console: ['console', 'consoles'], bin64: ['64-gallon bin', '64-gallon bins'], bin96: ['96-gallon bin', '96-gallon bins'], box: ['box', 'boxes'], hdd: ['hard drive', 'hard drives'], binExtra: ['additional 65-gallon bin', 'additional 65-gallon bins'], trip: ['trip charge', 'trip charges'],
  stairsDown: ['box carried down stairs', 'boxes carried down stairs'], stairsUp: ['box carried up stairs', 'boxes carried up stairs'], haul: ['empty box hauled away', 'empty boxes hauled away'] };
OP.pricingText = (job, kind) => {
  const items = (job.items || []).filter(i => i.qty > 0 && i.id !== 'cod'), m = n => fmt.money(n, true), PP = data.purgePricing, unit = (i, n) => (UNIT[i.id] || [(data.priceBook.find(x => x.id === i.id) || { unit: 'item' }).unit, (data.priceBook.find(x => x.id === i.id) || { unit: 'item' }).unit + 's'])[n === 1 ? 0 : 1];
  if (kind === 'none' || !kind || !items.length) return '';
  const flat = 'up to ' + PP.binIncluded + ' 65-gallon ' + (PP.binIncluded === 1 ? 'bin' : 'bins'), each = job.recurring ? ' each service' : '';
  const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
  const rates = (each ? 'Pricing for each service: ' : 'Pricing for this job: ') + and(items.map(i => i.id === 'binFlat' ? m(i.rate) + ' flat for ' + flat : m(i.rate) + ' per ' + unit(i, 1))) + '.';
  if (kind === 'rates') return rates + (each ? '' : ' You are billed for what we actually service.');
  const tot = items.reduce((s, i) => s + i.qty * i.rate, 0), rough = job.type === 'purge';
  const est = (job.recurring ? 'Estimated cost per service: ' : 'Estimated total: ') + m(tot) + ', based on ' + and(items.map(i => i.id === 'binFlat' ? flat : (rough && i.id === 'box' ? 'about ' : '') + i.qty + ' ' + unit(i, i.qty))) + '. ' + ROUGH;
  return kind === 'both' ? rates + '\n' + est : est;
};
/** After a new job is saved: send (or offer to send) the customer a confirmation with the date, by the company's settings. */
OP.confirmJob = job => {
  if (CF.mode === 'off' || !CF.types[job.type] || job.allDay) return;
  const c = job.customerId && q.customer(job.customerId), p = (c && (c.contacts.find(x => x.phone) || c.contacts[0])) || { name: job.contactName, phone: job.phone, email: job.email }, email = (c && c.contacts.map(x => x.email).find(Boolean)) || p.email;
  const can = { text: !!p.phone, email: !!email }, want = CF.channel === 'both' ? ['text', 'email'] : [CF.channel], use = want.filter(k => can[k]); if (!use.length) { const other = CF.channel === 'text' && can.email ? 'email' : CF.channel === 'email' && can.text ? 'text' : null; if (other) use.push(other); }
  if (!use.length) return ui.toast('No phone or email on file, so no confirmation was sent', 'info.circle', 3000);
  const ctx = CO.ctxFor(c, { date: fmt.day(job.day, 'long'), customer: c ? c.name : job.title }); if (!c && p.name) ctx.first = first(p.name);
  let pricing = OP.pricingText(job, 'rates') ? CF.pricing : 'none';
  const base = { text: CO.fill(CO.tpl('confirm').body, ctx), email: CO.fill(CO.tpl('confirmEmail').body, ctx) }, body = {}, build = () => { const t = OP.pricingText(job, pricing); body.text = base.text + (t ? '\n\n' + t : ''); body.email = base.email + (t ? '\n\n' + t : ''); }; build();
  const from = OP.senderFor(c, S.me, 'text'), who = first(p.name) || 'the customer';
  const send = () => { job.events.push({ at: +WD.now(), actor: CF.mode === 'auto' ? 'RouteClerk' : me(), text: 'Confirmation sent by ' + use.join(' and ') + ' to ' + (p.name || 'the customer') + (use.includes('text') ? ' · from ' + from.text : '') + (pricing === 'rates' ? ' · with pricing rates' : pricing === 'total' ? ' · with the estimated total (rough estimate)' : pricing === 'both' ? ' · with rates and the estimated total (rough estimate)' : '') + (pricing !== CF.pricing && OP.pricingText(job, 'rates') ? ' · pricing changed for this message from the company default (' + cpLabel(CF.pricing).toLowerCase() + ')' : '') }); WD.changed(); };
  if (CF.mode === 'auto') { send(); return ui.toast('Confirmation ' + use.join(' and ') + ' sent to ' + who, use[0] === 'email' ? 'envelope' : 'message', 3000); }
  let tab = use[0];
  ui.sheet({ title: 'Confirm the job', leading: [{ label: 'Skip', onTap: pg => pg.dismiss() }],
    trailing: [{ label: 'Send', bold: true, onTap: async pg => { if (await ui.run('Sending…', send, { done: 'Sent', offlineOK: true })) pg.dismiss(); } }],
    render: pg => ui.list(
      ui.section({ header: job.title + ' · ' + fmt.day(job.day, 'long'), footer: job.recurring ? 'A recurring job confirms its first service date.' : null },
        use.includes('text') && ui.row({ icon: 'message', iconColor: 'var(--green)', title: 'Text to ' + (p.name || 'the customer'), subtitle: fmt.phone(p.phone) + ' · from ' + from.text }),
        use.includes('email') && ui.row({ icon: 'envelope', iconColor: 'var(--blue)', title: 'Email to ' + email, subtitle: 'From ' + OP.emailFrom(S.me) })),
      OP.pricingText(job, 'rates') && ui.section({ header: 'Pricing in this message', showFooter: true, footer: (pricing === 'none' ? 'No pricing is included.' : pricing === 'rates' ? 'Adds the rate for each thing on this job.' : (pricing === 'both' ? 'Adds the rates and the estimated cost' : 'Adds the estimated cost') + ', worked out from what the customer told you: ' + fmt.money(job.items.filter(i => i.qty > 0).reduce((s, i) => s + i.qty * i.rate, 0), true) + '. The message says it is only a rough estimate and that the final charge depends on what is actually serviced.') + (pricing === CF.pricing ? ' This is the company default.' : ' The company default is “' + cpLabel(CF.pricing) + '”; this choice applies to this message only.') },
        ui.pickerRow({ title: 'Include', icon: 'dollarsign.circle', iconColor: 'var(--green)', value: pricing, options: CPRICE, onChange: v => { pricing = v; build(); pg.refresh(); } }),
        pricing !== CF.pricing && ui.row({ title: 'Use the company default', subtitle: cpLabel(CF.pricing), tint: true, onTap: () => { pricing = CF.pricing; build(); pg.refresh(); } })),
      use.length > 1 && h('div', { style: 'padding:12px 16px 0' }, ui.segmented([{ value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }], tab, v => { tab = v; pg.refresh(); })),
      ui.section({ header: tab === 'email' ? 'Subject: ' + CO.fill(CO.tpl('confirmEmail').subject, ctx) : 'Message', footer: 'Change the wording for this customer here. To change it for everyone, or to send these automatically, go to Settings → Job confirmations.' },
        (r => { r.classList.add('co-body'); return r; })(ui.inputRow({ multiline: true, value: body[tab], onInput: v => { body[tab] = v; } })))) }, { detent: 'large' });
};
OP.confirmSpec = () => ({ title: 'Job confirmations', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); };
  return ui.list(
    ui.section({ header: 'When a new job is scheduled', footer: { off: 'Nothing is sent.', ask: 'Whoever schedules the job sees the message and taps Send or Skip.', auto: 'The confirmation goes out by itself as soon as the job is saved, and is noted in the job’s history.' }[CF.mode] },
      ui.pickerRow({ title: 'Confirmation', icon: 'checkmark.circle', iconColor: 'var(--green)', value: CF.mode, options: CMODE, onChange: v => { CF.mode = v; re(); } }),
      CF.mode !== 'off' && ui.pickerRow({ title: 'Send by', value: CF.channel, options: CCHAN, onChange: v => { CF.channel = v; re(); } })),
    CF.mode !== 'off' && ui.section({ header: 'Pricing in the confirmation', showFooter: true, footer: (CF.pricing === 'none' ? 'Confirmations start with no pricing.' : CF.pricing === 'rates' ? 'Confirmations start with the rate for each thing on the job, such as the price per box.' : (CF.pricing === 'both' ? 'Confirmations start with the rates and the estimated total' : 'Confirmations start with the estimated total') + ', worked out from the quantities entered when the job was scheduled. Because that comes from what the customer told you, the message always says it is only a rough estimate and that the final charge depends on what is actually serviced.') + (CF.mode === 'ask' ? ' Whoever schedules the job can choose differently for each message before sending.' : ' With automatic sending, this is what goes out; switch to “Show it first” to choose for each message.') },
      ui.pickerRow({ title: 'Include', icon: 'dollarsign.circle', iconColor: 'var(--green)', value: CF.pricing, options: CPRICE, onChange: v => { CF.pricing = v; re(); } })),
    CF.mode !== 'off' && ui.section({ header: 'What it says', footer: 'It confirms the date, thanks them for being a customer, asks them to have the paper staged in a convenient location (additional service charges may apply otherwise), and gives your policy on what can be shredded: paper clips, staples and file folders are fine; no binders, x-rays or small plastic bags.' },
      CO.tplRow('confirm', page), CO.tplRow('confirmEmail', page)),
    CF.mode !== 'off' && ui.section({ header: 'For these job types', footer: 'If the customer has no cell number the email is used instead, and the other way around. A recurring job confirms its first service date.' },
      WD.jobTypes.map(t => ui.toggleRow({ title: t.title, value: !!CF.types[t.id], onChange: v => { CF.types[t.id] = v; WD.changed(); } }))),
    ui.section({ footer: 'Which number and email address these come from.' }, ui.row({ icon: 'phone.fill', iconColor: 'var(--blue)', title: 'Calls, texts and email', detail: OP.commsLabel(), chevron: true, onTap: () => page.push(OP.commsSpec()) })));
} });

/* ================= Items, services and fees ================= */
const KINDS = [['service', 'Services'], ['fee', 'Fees and surcharges'], ['product', 'Products and inventory']];
const CORE = WD.CONTAINERS.concat(['stairsDown', 'stairsUp', 'haul', 'hdd']);   // the job form and the purge estimate use these by name
data.priceBook.forEach(x => { x.kind = x.kind || (['trip', 'stairsDown', 'stairsUp', 'haul'].includes(x.id) ? 'fee' : 'service'); });
data.priceBook.push({ id: 'bags', name: 'Shred bags, pack of 5', unit: 'pack', rate: 15, kind: 'product', stock: 40 }, { id: 'console-sale', name: 'Locking console (sold)', unit: 'console', rate: 225, kind: 'product', stock: 6 });
function itemSheet(x, page) {
  const f = x ? { name: x.name, unit: x.unit, rate: String(x.rate), kind: x.kind, stock: x.stock != null ? String(x.stock) : '' } : { name: '', unit: '', rate: '', kind: 'service', stock: '' }, core = x && CORE.includes(x.id);
  ui.sheet({ title: x ? 'Edit item' : 'New item', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Save', bold: true, onTap: async p => { if (!f.name.trim()) return ui.toast('Add a name', 'note'); const rec = { name: f.name.trim(), unit: f.unit.trim() || 'each', rate: parseFloat(f.rate.replace(/[^0-9.]/g, '')) || 0, kind: f.kind, stock: f.kind === 'product' && f.stock.trim() !== '' ? parseInt(f.stock, 10) || 0 : null };
      if (!await ui.run('Saving…', () => { if (x) Object.assign(x, rec); else data.priceBook.push({ id: uid('pb'), ...rec }); }, { done: 'Saved' })) return; p.dismiss(); page.refresh(); } }],
    render: p => ui.list(
      ui.section({ footer: 'The name prints on invoices, quotes and agreements.' }, ui.inputRow({ label: 'Name', placeholder: 'e.g. After-hours service', value: f.name, autofocus: !x, onInput: v => { f.name = v; } }),
        ui.pickerRow({ title: 'Kind', value: f.kind, options: KINDS.map(([value, label]) => ({ value, label: label.replace(/s$/, '').replace('Fees and surcharge', 'Fee or surcharge').replace('Products and inventory', 'Product or inventory') })), onChange: v => { f.kind = v; p.refresh(); } })),
      ui.section({ header: 'Base price', footer: 'A starting price only. A customer’s own price (Customer → Pricing) wins over it, and the price can still be typed over on any job, quote or invoice.' },
        ui.inputRow({ label: 'Price', inputmode: 'decimal', placeholder: '0.00', value: f.rate, onInput: v => { f.rate = v; } }), ui.inputRow({ label: 'Per', placeholder: 'each, box, hour, trip…', caps: 'off', value: f.unit, onInput: v => { f.unit = v; } })),
      f.kind === 'product' && ui.section({ footer: 'Optional. Each one invoiced comes off the count.' }, ui.inputRow({ label: 'On hand', inputmode: 'numeric', placeholder: 'Not tracked', value: f.stock, onInput: v => { f.stock = v; } })),
      x && ui.section({ footer: core ? 'Built in: the job form and the estimates use this item, so it can be renamed and repriced but not deleted.' : 'Invoices already created keep the line as it was.' },
        ui.row({ title: 'Delete item', destructive: true, disabled: core, onTap: core ? null : async () => { if (!await ui.actionSheet({ title: 'Delete “' + x.name + '”?', message: 'It leaves the list of things to add to a job, quote or invoice.', buttons: [{ label: 'Delete item', role: 'destructive', value: true }] })) return; data.priceBook.splice(data.priceBook.indexOf(x), 1); WD.changed(); p.dismiss(); page.refresh(); ui.toast('Deleted', 'trash'); } }))) }, { detent: 'large' });
}
OP.itemsSpec = () => ({ title: 'Items, services and fees', trailing: () => admin() ? [{ icon: 'plus', label: 'New item', onTap: p => itemSheet(null, p) }] : [],
  render: page => { if (!admin()) return locked();
    return ui.list(note('Everything your company charges for. These are the choices offered when adding a line to a job, quote, agreement or invoice, each with its base price.'),
      KINDS.map(([k, title]) => { const xs = data.priceBook.filter(x => x.kind === k); return xs.length ? ui.section(title, xs.map(x => ui.row({ title: x.name, subtitle: 'per ' + x.unit + (x.stock != null ? ' · ' + x.stock + ' on hand' : ''), detail: fmt.money(x.rate, true), chevron: true, onTap: () => itemSheet(x, page) }))) : null; }),
      ui.section({ footer: 'The base price is a recommendation. Override it for one customer in Customer → Pricing, or for one visit on the job or the invoice.' },
        ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New item, service or fee', tint: true, onTap: () => itemSheet(null, page) })));
  } });

/* ================= Hard drives: serial numbers ================= */
const hash = s => { let n = 7; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; };
const MAKES = ['WD-WCC', 'ST', 'Z1D', 'HGST-PK', 'TOSH-Y'];
/** Scan each hard drive's barcode or serial number before it is destroyed. drives: [{code, at}] edited in place. */
OP.scanDrives = (job, drives, qty, onDone) => {
  const next = () => { const k = hash(job.id + '|' + drives.length + '|' + Date.now() % 9973); return MAKES[k % MAKES.length] + String(1000000 + k % 8999999); };
  ui.sheet({ title: 'Scan hard drives', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], onClose: () => onDone && onDone(),
    render: p => [h('div.co-scan', drives.length < qty ? 'Point the camera at the drive’s barcode or serial number' : 'All drives scanned'),
      ui.list(ui.section({ header: drives.length + ' of ' + qty + ' scanned', footer: 'Each serial number is recorded with the time and printed on the invoice with the certificate of destruction.' },
        drives.map((s, i) => ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: s.code, subtitle: (s.hand ? 'Entered by hand · ' : 'Scanned ') + fmt.clock(new Date(s.at)), trailing: h('button.bi-del', { 'aria-label': 'Remove', onclick: () => { drives.splice(i, 1); p.refresh(); } }, icon('bi.minus', 22)) })),
        !drives.length && ui.row({ title: 'Nothing scanned yet' }))),
      h('div.co-acts', ui.button('Scan next drive', { icon: 'barcode', onTap: async () => { const hud = ui.hud('Scanning…'); await WD.delay(450, 750); hud.close(); drives.push({ code: next(), at: +WD.now() }); p.refresh(); } }),
        ui.button('Enter a serial number by hand', { kind: 'gray', onTap: async () => { const r = await ui.alert({ title: 'Serial number', message: 'For a drive with no barcode.', input: { placeholder: 'e.g. WD-WCC4N1234567' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] }); if (r && r.value && r.text.trim()) { drives.push({ code: r.text.trim().toUpperCase(), at: +WD.now(), hand: true }); p.refresh(); } } }))] }, { detent: 'large' });
};

/* ================= Control panel ================= */
const openSet = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
WD.panel.addJump('Holidays and schedule changes', () => { WD.nav.switchTab('board'); WD.nav.push(OP.schedSpec()); });
WD.panel.addJump('Time on site formulas', () => openSet(OP.siteSpec()));
WD.panel.addJump('Calls, texts and email', () => openSet(OP.commsSpec()));
WD.panel.addJump('Items, services and fees', () => openSet(OP.itemsSpec()));
WD.panel.addJump('Job confirmations', () => openSet(OP.confirmSpec()));
/** A day with stops to demonstrate on: the next Thursday with jobs (the owner's Thanksgiving example). */
WD.panel.addAction('Mark the next holiday (or next Thursday)', () => { const tg = upcoming().find(([nm, d]) => nm === 'Thanksgiving' && D.diff(d, today()) <= 13); let k = tg ? tg[1] : D.add(today(), 1); while (!tg && (dow(k) !== 4 || k < D.add(today(), 3))) k = D.add(k, 1); const known = upcoming().find(([, d]) => d === k), name = known ? known[0] : 'Company holiday';
  if (!data.holidays.some(x => x.day === k)) data.holidays.push({ day: k, name }); const fri = D.add(k, 1), both = /Thanksgiving/.test(name); if (both && !data.holidays.some(x => x.day === fri)) data.holidays.push({ day: fri, name: 'Day after Thanksgiving' });
  data.holidays.sort((a, b) => a.day.localeCompare(b.day)); S.board.day = k; WD.changed(); WD.nav.switchTab('board'); if (ST.holidays.suggest) setTimeout(() => planSheet(both ? [k, fri] : [k], name), 400); else ui.toast(name + ' marked on ' + fmt.day(k), 'calendar', 2600); });
})();
