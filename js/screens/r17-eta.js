/* RouteClerk prototype 5.3 — live ETAs and time on site (`WD.eta`).
   Every timed stop has an ETA, whether or not the customer asked for a time. The ETA is worked out again as the day goes on: stops already
   done use the real arrival and departure, the stop the truck is at uses the real arrival plus the time on site (or the driver's own estimate),
   and every later stop follows from there. A stop whose ETA falls outside the time the customer was given is flagged on the board, on the
   job, and in a banner to the office. A driver arriving at a purge job is asked how long it will really take.
   Also here: time on site per customer (average, typical, longest, on-time arrivals) and the report that compares customers.
   Everything is a mock: drive times come from the map positions, and the history is the generated one AutoRoute already plans from. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, E = WD.eta = {};
const mins = fmt.fromHHMM, first = n => String(n || '').replace(/^(Dr|Mr|Mrs|Ms)\.? /, '').split(' ')[0], me = () => (S.me && S.me.name) || 'You';
const hhmm = t => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.round(t) % 60).padStart(2, '0');
const tm = t => fmt.time(Math.round(t)), st = t => { t = Math.round(t); const hh = Math.floor(t / 60) % 24, mm = t % 60; return (hh % 12 || 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? 'a' : 'p'); }, sp = t => t < 60 ? t + 'm' : Math.floor(t / 60) + 'h' + (t % 60 ? ' ' + t % 60 + 'm' : ''), plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const span = t => t < 60 ? Math.round(t) + ' min' : Math.floor(t / 60) + ' h' + (Math.round(t % 60) ? ' ' + Math.round(t % 60) + ' min' : '');
const winText = w => w.exact ? 'exactly ' + tm(w.from) : (w.from > 0 ? tm(w.from) : 'any time') + ' – ' + (w.until < 1440 ? tm(w.until) : 'any time');
const drive = (a, b) => a && b && a.x != null && b.x != null ? Math.round((Math.hypot(a.x - b.x, a.y - b.y) * 0.05 + 3) * ((data.workflow || {}).speedPct || 100) / 100) : 12;

/* ================= The plan for a route's day ================= */
/** The time the customer was given: an exact time, or a window (asked for by them, or told by us). null when nobody was given a time. */
E.told = j => j.exactAt ? { from: mins(j.exactAt), until: mins(j.exactAt) + 15, exact: true } : j.custFrom || j.custUntil ? { from: j.custFrom ? mins(j.custFrom) : 0, until: j.custUntil ? mins(j.custUntil) : 1440, ours: j.windowBy === 'us' } : null;
/** Minutes on site: the driver's own estimate once they have given one, else what AutoRoute plans. */
E.onSite = j => j.onSiteEst > 0 ? j.onSiteEst : WD.siteMinutes(j).minutes;
function walk(routeId, day) {
  const today = D.today(), now = WD.nowMins(), live = day === today, past = day < today, out = [], rd = (data.routeDays || {})[routeId + '|' + day];
  let t = rd && rd.depart != null ? rd.depart : (data.workflow || {}).dayStartMin || 480, prev = (data.places || [])[0] || null;
  q.stopList(routeId, day).forEach(j => {
    if (WD.struck[j.status]) return void out.push({ job: j, state: 'off' });
    const svc = E.onSite(j), told = E.told(j); let eta, leave, state;
    if (j.status === 'completed') { eta = j.arrivedAt != null ? j.arrivedAt : t; leave = j.departedAt != null ? j.departedAt : eta + svc; state = 'done'; }
    else if (j.status === 'arrived') { eta = j.arrivedAt != null ? j.arrivedAt : live ? now : t; leave = eta + svc; if (live && leave < now + 3) leave = now + 3; state = 'here'; }
    else if (past) return void out.push({ job: j, state: 'off' });
    else { const open = mins(j.bizOpen); eta = (live ? Math.max(t, now) : t) + drive(prev, j); if (open != null && eta < open) eta = open; leave = eta + svc; state = j.status === 'enroute' ? 'driving' : 'planned'; }
    out.push({ job: j, state, eta, leave, svc, told, late: told ? Math.max(0, Math.round(eta - told.until)) : 0, early: told ? Math.max(0, Math.round(told.from - eta)) : 0 });
    t = leave; if (j.x != null) prev = j; });
  return out;
}
let memo = new Map(); WD.on('change', () => { memo = new Map(); });
/** Every timed stop of a route's day, in board order: { job, state: 'done' | 'here' | 'driving' | 'planned' | 'off', eta, leave, svc, told, late, early } (minutes since midnight). */
E.plan = (routeId, day) => { seed(); const k = routeId + '|' + day + '|' + WD.nowMins(); if (!memo.has(k)) memo.set(k, walk(routeId, day)); return memo.get(k); };
E.forJob = job => job && !job.allDay ? E.plan(job.routeId, job.day).find(e => e.job === job) || null : null;
const open = e => e && (e.state === 'planned' || e.state === 'driving');
/** A stop still ahead whose ETA is outside the time the customer was given. Early only counts past 20 minutes: a truck can wait, a customer cannot. */
E.outside = e => open(e) && !!e.told && (e.late > 0 || e.early > 20);
E.outsideText = e => e.late > 0 ? span(e.late) + ' late' : span(e.early) + ' early';
/** The stops on these routes and day that will miss the time given. cols: [{routeId, day}]. */
E.lateList = cols => cols.flatMap(c => E.plan(c.routeId, c.day)).filter(E.outside);

/* A demo business starts with two customers who were given a time today: one the truck will make, one it will not. */
let seeding = false;
function seed() { const jobs = data.jobs; if (seeding || !jobs || jobs._eta) return; seeding = true; jobs._eta = true;
  try { const today = D.today(); let n = 0;
    q.routes().forEach(r => { if (n > 1) return; const ahead = walk(r.id, today).filter(e => e.state === 'planned' && !e.told && e.job.status === 'scheduled'); if (ahead.length < 2) return;
      const e = ahead[Math.min(ahead.length - 1, 1 + n)], late = n === 1, until = Math.max(6 * 60, Math.round(e.eta / 15) * 15 - (late ? 30 : -60)), from = Math.max(5 * 60, until - 120);
      Object.assign(e.job, { custFrom: hhmm(from), custUntil: hhmm(until), windowBy: 'us', custStrict: false, needsWindow: false });
      n++; });
    /* What is already outside when the app opens is on the board; banners are for what changes after that. */
    q.routes().forEach(r => walk(r.id, today).filter(E.outside).forEach(e => known.add(key(e.job, e.told))));
  } finally { seeding = false; } }

/* ================= On the board ================= */
/** The line on a job card: “ETA 10:45 AM”, in red with the delay when the stop will miss the time given. */
E.cardChip = job => { const e = E.forJob(job); if (!e || e.state === 'off' || e.state === 'done') return null;
  if (e.state === 'here') return h('div.d12', h('div.bd-eta', { title: 'On site. Should finish about ' + tm(e.leave) }, icon('timer', 11), ' Until ' + st(e.leave)));
  if (E.outside(e)) return h('div.bd-eta.out', { title: 'They were told ' + winText(e.told) }, icon('exclamationmark.triangle', 11), ' ETA ' + st(e.eta) + ' · ' + sp(e.late || e.early) + (e.late ? ' late' : ' early'));
  return h('div.d12', h('div.bd-eta', icon('clock', 11), ' ETA ' + st(e.eta))); };
/** The warning line under the date bar. cols: the board's columns. */
E.boardStrip = cols => { const list = E.lateList(cols.filter(c => c.day >= D.today())); if (!list.length) return null;
  return h('div.bd-strip', { style: { '--c': 'var(--red)' }, role: 'button', tabindex: '0', onclick: () => E.lateSheet(cols) }, icon('exclamationmark.triangle', 16),
    list.length === 1 ? list[0].job.title + ' · ETA ' + tm(list[0].eta) + ', ' + E.outsideText(list[0]) + ' for the time we gave' : plural(list.length, 'stop') + ' will arrive outside the time we gave', icon('chevron.right', 14)); };
const contactOf = job => { const c = job.customerId && q.customer(job.customerId), p = c && ((c.contacts || []).find(x => x.phone) || (c.contacts || [])[0]); return { c, p, phone: (p && p.phone) || job.phone || '' }; };
/** Text the customer the new ETA. */
E.textEta = (job, e) => { const { p, phone } = contactOf(job), X = WD.texts; if (!X || !X.compose) return ui.toast('Texts aren’t available', 'lock'); if (!phone) return ui.toast('No phone number for this customer', 'phone');
  return X.compose({ number: phone, text: 'Hi' + (p ? ' ' + first(p.name) : '') + ', this is ' + (S.org || {}).name + '. ' + (e.late ? 'We are running behind today' : 'We are running ahead today') + ' and now expect to reach you around ' + tm(e.eta) + '. ' + (e.late ? 'Sorry for the delay.' : 'Let us know if that is too early.'),
    onSent: () => { job.etaTextAt = +WD.now(); job.events.push({ at: +WD.now(), actor: me(), text: 'Texted the new ETA, ' + tm(e.eta) }); WD.changed(); } }); };
/** Give the customer a new window around the ETA as it stands now. */
E.newWindow = (job, e) => { const w = WD.etaWindow(e.eta), was = winText(e.told); Object.assign(job, { exactAt: '', custFrom: hhmm(w.from), custUntil: hhmm(w.until), windowBy: 'us', custStrict: false, needsWindow: false, windowToSend: true });
  job.events.push({ at: +WD.now(), actor: me(), text: 'Time given changed from ' + was + ' to ' + tm(w.from) + ' – ' + tm(w.until) }); WD.changed(); ui.toast('New time: ' + tm(w.from) + ' – ' + tm(w.until) + '. Tell the customer.', 'clock', 2800); };
const lateActions = (job, e, after) => h('div.et-btns', ui.button('Text the new ETA', { kind: 'tinted', small: true, block: false, icon: 'message', onTap: () => E.textEta(job, e) }),
  WD.can('jobs.edit') && ui.button('Give a new time', { kind: 'gray', small: true, block: false, icon: 'clock', onTap: () => { E.newWindow(job, e); after && after(); } }));
E.lateSheet = cols => ui.sheet({ title: 'Outside the time we gave', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: page => { const list = E.lateList(cols.filter(c => c.day >= D.today()));
  return ui.list(list.length ? list.map(e => ui.section({ fold: false },
      ui.row({ leading: ui.dot(q.routeColor(e.job.routeId)), title: e.job.title, subtitle: [h('div', q.routeName(e.job.routeId) + ' · told ' + winText(e.told)), h('div.et-bad', 'ETA now ' + tm(e.eta) + ' · ' + E.outsideText(e))], chevron: true, onTap: () => { page.dismiss(); setTimeout(() => WD.screens.jobs && WD.screens.jobs.openDetails && WD.screens.jobs.openDetails(e.job.id), 450); } }),
      lateActions(e.job, e, () => page.refresh())))
    : ui.empty({ icon: 'checkmark.circle', title: 'Every stop is on time', text: 'Nobody who was given a time will be missed as the day stands now.' }),
    h('div', { style: 'padding:12px 4px 0' }, ui.note('ETAs move as the day goes on: each one follows from where the truck really is and how long each stop is taking.'))); } }, { detent: 'large' });

/* ================= On the job ================= */
E.detailSection = (job, page) => { const e = E.forJob(job); if (!e || e.state === 'off') return null; const sm = WD.siteMinutes(job), re = () => page && page.refresh();
  const planned = sm.minutes, src = { history: 'from past visits', purge: 'from the box estimate', formula: 'from the container formula', override: 'set on the job' }[sm.source] || '';
  if (e.state === 'done') { if (!e.told) return null; const off = e.eta > e.told.until ? span(e.eta - e.told.until) + ' late' : e.eta < e.told.from - 20 ? span(e.told.from - e.eta) + ' early' : 'on time';
    return ui.section({ header: 'Arrival', fold: false }, ui.row({ icon: 'clock', iconColor: off === 'on time' ? 'var(--green)' : 'var(--orange)', title: 'Arrived ' + tm(e.eta) + ' · ' + off, subtitle: 'They were told ' + winText(e.told) })); }
  const out = E.outside(e), here = e.state === 'here';
  return ui.section({ header: here ? 'On site' : 'Arrival', fold: false, footer: here ? 'Later stops on this route are timed from when this one should finish.' : 'Worked out again as the day goes on, from where the truck is and how long each stop takes.' },
    here ? ui.row({ icon: 'timer', iconColor: 'var(--orange)', title: 'Should finish about ' + tm(e.leave), subtitle: 'Arrived ' + tm(e.eta) + ' · ' + (job.onSiteEst ? 'driver’s estimate ' + span(job.onSiteEst) + ' (planned ' + span(planned) + ')' : span(planned) + ' planned ' + src) })
      : ui.row({ icon: out ? 'exclamationmark.triangle' : 'clock', iconColor: out ? 'var(--red)' : 'var(--blue)', title: 'ETA ' + tm(e.eta) + (e.state === 'driving' ? ' · on the way' : ''),
        subtitle: [e.told ? h('div' + (out ? '.et-bad' : ''), (e.told.ours ? 'We told them ' : e.told.exact ? 'Needs ' : 'They asked for ') + winText(e.told) + (out ? ' · ' + E.outsideText(e) : ' · on time')) : h('div', 'No time was given to the customer'), h('div', span(e.svc) + ' on site ' + (job.onSiteEst ? '(driver’s estimate)' : src))] }),
    out && lateActions(job, e, re),
    here && job.type === 'purge' && ui.row({ icon: 'pencil', iconPlain: true, title: job.onSiteEst ? 'Change how long this will take' : 'Bigger or smaller than expected?', subtitle: 'Say how long you will be here', tint: true, onTap: () => E.askOnSite(job, re) })); };
/** A driver arriving at a purge job says how long it will really take. The later stops and their ETAs follow at once. */
E.askOnSite = (job, after) => { const planned = WD.siteMinutes(job).minutes, cols = [{ routeId: job.routeId, day: job.day }], was = new Set(E.lateList(cols).map(x => x.job.id)); job.onSiteAsked = true;
  const choose = (n, sheet) => { job.onSiteEst = n; job.onSiteBy = me(); job.events.push({ at: +WD.now(), actor: me(), text: 'On-site estimate ' + span(n) + ' (planned ' + span(planned) + ')' }); WD.changed(); sheet.close();
    const now = E.lateList(cols), fresh = now.filter(x => !was.has(x.job.id)); now.forEach(x => known.add(key(x.job, x.told))); after && after();
    setTimeout(() => fresh.length ? ui.banner({ title: plural(fresh.length, 'later stop') + ' will now miss the time given', text: fresh.map(x => x.job.title + ' ETA ' + tm(x.eta)).join(' · ') + '. The office has been told.', icon: 'exclamationmark.triangle', color: 'var(--red)', duration: 7000, onTap: () => E.lateSheet(cols) })
      : ui.toast('Thanks. The office sees ' + span(n) + ' here.', 'checkmark', 2400), 500); };
  const opts = [15, 30, 45, 60, 90, 120, 180, 240].filter(n => Math.abs(n - planned) > 7);
  const sheet = ui.sheet({ title: 'How long will you be here?', leading: [{ label: 'Skip', onTap: p => p.dismiss() }], render: () => ui.list(
    h('div.et-ask', h('b', job.title), h('span', 'Planned ' + span(planned) + '. If the job is much bigger or smaller than expected, say so: the office sees the later stops move.')),
    h('div', { style: 'padding:0 0 10px' }, ui.button('About as planned · ' + span(planned), { kind: 'tinted', onTap: () => choose(planned, sheet) })),
    h('div.et-grid', opts.map(n => h('button' + (job.onSiteEst === n ? '.on' : ''), { onclick: () => choose(n, sheet) }, h('b', span(n)), h('small', n < planned ? 'smaller' : 'bigger'))))) }, { detent: 'medium' });
  return sheet; };
/* Asked once per job, of whoever marks the arrival and of the driver whose shift it is. */
{ const set0 = WD.api.setStatus; WD.api.setStatus = function (jobId, status) { const r = set0.apply(this, arguments), j = status === 'arrived' && q.job(jobId); if (j && j.type === 'purge' && !j.onSiteAsked) { j.onSiteAsked = true; setTimeout(() => E.askOnSite(j), 700); } return r; }; }

/* ================= Telling the office ================= */
const known = new Set(), key = (job, told) => job.id + '|' + (told ? told.until : '');
let checking = null;
function check() { checking = null; if (!S.signedIn || (S.me || {}).role === 'driver') return; let list; try { list = E.lateList(q.visibleRoutes().map(r => ({ routeId: r.id, day: D.today() }))); } catch (e) { return; }
  const fresh = list.filter(e => !known.has(key(e.job, e.told))); if (!fresh.length) return; fresh.forEach(e => known.add(key(e.job, e.told)));
  ui.banner({ title: fresh.length === 1 ? fresh[0].job.title + ' will be ' + E.outsideText(fresh[0]) : plural(fresh.length, 'stop') + ' will miss the time we gave', text: fresh.length === 1 ? 'ETA ' + tm(fresh[0].eta) + ' · told ' + winText(fresh[0].told) + ' · ' + q.routeName(fresh[0].job.routeId) : fresh.map(e => e.job.title).join(' · '), icon: 'exclamationmark.triangle', color: 'var(--red)', duration: 7000,
    onTap: () => E.lateSheet(q.visibleRoutes().map(r => ({ routeId: r.id, day: D.today() }))) }); }
WD.on('change', () => { if (!checking) checking = setTimeout(check, 900); }); setInterval(() => { if (S.signedIn) { memo = new Map(); check(); } }, 60000);
WD.on('org', () => known.clear());

/* ================= Time on site, per customer ================= */
/** { n, mean, median, max, last: {day, mins} | null, told, onTime, perHour } for a customer, or null with no recorded visit. */
E.custStats = c => { const jobs = q.jobsForCustomer(c.id).filter(j => !j.allDay && j.type !== 'meet'), done = jobs.filter(j => j.status === 'completed' && j.arrivedAt != null && j.departedAt > j.arrivedAt);
  const ref = done[done.length - 1] || jobs[jobs.length - 1]; if (!ref || !['customer', 'serviced'].includes(c.lifecycle)) return null;
  const s = q.visitStats(ref), last = done.length ? done[done.length - 1] : null, timed = done.filter(j => E.told(j)), onTime = timed.filter(j => { const w = E.told(j); return j.arrivedAt <= w.until && j.arrivedAt >= w.from - 20; }).length;
  const inv = (data.invoices || []).filter(i => i.customerId === c.id && i.jobId && i.amount > 0), avgInv = inv.length ? inv.reduce((t, i) => t + i.amount, 0) / inv.length : 0;
  return { n: s.n, mean: s.mean, median: s.median, max: s.max, last: last && { day: last.day, mins: last.departedAt - last.arrivedAt }, told: timed.length, onTime, perHour: avgInv && s.mean ? avgInv / (s.mean / 60) : 0, hoursYear: Math.round(s.mean * s.n / 6) / 10 }; };
E.custSection = c => { const s = E.custStats(c); if (!s) return null; const money = WD.can('billing.view');
  return ui.section({ header: 'Time on site', fold: true, footer: 'From arrival to departure on ' + plural(s.n, 'recorded visit') + '. AutoRoute plans this customer’s stops from the typical time.' },
    h('div.et-kpi', h('div', h('b', span(s.mean)), h('small', 'Average')), h('div', h('b', span(s.median)), h('small', 'Typical')), h('div', h('b', span(s.max)), h('small', 'Longest'))),
    s.last && ui.row({ title: 'Last visit', detail: span(s.last.mins) + ' · ' + fmt.day(s.last.day, 'md') }),
    ui.row({ title: 'Total on site', detail: s.hoursYear + ' h over ' + plural(s.n, 'visit') }),
    s.told > 0 && ui.row({ title: 'Arrived in the time given', detail: s.onTime + ' of ' + s.told }),
    money && s.perHour > 0 && ui.row({ title: 'Billed per hour on site', detail: fmt.money(Math.round(s.perHour)) }),
    ui.row({ title: 'Compare all customers', chevron: true, tint: true, onTap: () => WD.nav.push(E.reportSpec()) })); };
/** Reports → Time on site: every customer with recorded visits, longest first. */
E.reportSpec = () => { let sort = 'mean', text = ''; return { title: 'Time on site', search: { placeholder: 'Search customers', onInput: (v, page) => { text = v; page.refresh(); } }, render: page => { const money = WD.can('billing.view'), t = text.trim().toLowerCase();
  const all = (data.customers || []).filter(c => !c.archived).map(c => ({ c, s: E.custStats(c) })).filter(x => x.s), rows = all.filter(x => !t || x.c.name.toLowerCase().includes(t));
  const val = { mean: x => x.s.mean, total: x => x.s.hoursYear, hour: x => x.s.perHour || 0, low: x => -(x.s.perHour || 1e9) }[sort]; rows.sort((a, b) => val(b) - val(a) || a.c.name.localeCompare(b.c.name));
  const visits = all.reduce((n, x) => n + x.s.n, 0), avg = visits ? all.reduce((n, x) => n + x.s.mean * x.s.n, 0) / visits : 0, told = all.reduce((n, x) => n + x.s.told, 0), onTime = all.reduce((n, x) => n + x.s.onTime, 0);
  return ui.list(h('div.et-kpi', { style: 'border-radius:12px;margin-bottom:12px' }, h('div', h('b', span(avg)), h('small', 'Average stop')), h('div', h('b', String(visits)), h('small', 'Visits')), h('div', h('b', told ? Math.round(onTime / told * 100) + '%' : '—'), h('small', 'In the time given'))),
    h('div', { style: 'padding-bottom:8px' }, ui.segmented([{ value: 'mean', label: 'Longest stops' }, { value: 'total', label: 'Most time' }].concat(money ? [{ value: 'low', label: 'Least $ / hour' }] : []), sort, v => { sort = v; page.refresh(); })),
    rows.length ? ui.section({ footer: 'Time from arrival to departure, from each customer’s recorded visits. Tap a customer to open it.' }, rows.slice(0, 80).map(({ c, s }) => ui.row({ title: c.name,
      subtitle: plural(s.n, 'visit') + ' · typical ' + span(s.median) + ' · longest ' + span(s.max) + (money && s.perHour ? ' · ' + fmt.money(Math.round(s.perHour)) + ' / h' : ''), detail: sort === 'total' ? s.hoursYear + ' h' : span(s.mean), chevron: true, onTap: () => WD.screens.customers && WD.screens.customers.openDetail && WD.screens.customers.openDetail(c.id) })))
      : ui.empty({ icon: 'timer', title: 'No recorded visits', text: 'Time on site shows once stops have been completed.' })); } }; };
/* The report is one tap from the Reports screen. */
if (WD.screens.reports && WD.screens.reports.root) { const root0 = WD.screens.reports.root; WD.screens.reports.root = () => { const spec = root0(), render0 = spec.render;
  spec.render = page => { const out = render0(page); if (!(WD.can('analytics.view') || WD.can('billing.view'))) return out;
    const link = h('div.list', { style: 'padding-top:0' }, ui.section({ header: 'Operations', fold: false }, ui.row({ icon: 'timer', iconColor: 'var(--orange)', title: 'Time on site', subtitle: 'How long we are at each customer, on average', chevron: true, onTap: () => page.push(E.reportSpec()) })));
    return Array.isArray(out) ? out.concat(link) : out instanceof Element ? [out, link] : out; };
  return spec; }; }

/* ================= Products on jobs (a company setting) ================= */
if (WD.r14 && WD.r14.addSetting) WD.r14.addSetting('Jobs', () => ui.toggleRow({ icon: 'shippingbox', iconColor: 'var(--teal)', title: 'Products on jobs', subtitle: 'For companies that sell products: a Products group when creating a job', value: !!(data.workflow || {}).jobProducts, disabled: !WD.can('settings.manage'), onChange: v => { data.workflow.jobProducts = v; WD.changed(); } }));

WD.panel.addAction('Truck runs 45 min behind (ETAs move)', () => { const r = q.visibleRoutes().find(x => E.plan(x.id, D.today()).some(e => e.state === 'planned')); if (!r) return ui.toast('No stops left today', 'info.circle');
  const k = r.id + '|' + D.today(), rd = data.routeDays[k] || (data.routeDays[k] = {}), cur = E.plan(r.id, D.today()).find(e => e.state === 'here');
  if (cur) cur.job.onSiteEst = E.onSite(cur.job) + 45; else rd.depart = Math.max(WD.nowMins(), rd.depart || 0) + 45; WD.changed(); ui.toast(q.routeName(r) + ' is 45 min behind', 'clock', 2200); });

const css = document.createElement('style'); css.textContent = `
.bd-eta { font-size: 12px; line-height: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .95; }
.bd-eta.out { display: inline-block; white-space: normal; max-width: 100%; margin-top: 2px; padding: 1px 5px; border-radius: 5px; background: color-mix(in srgb, var(--red) 14%, transparent); color: color-mix(in srgb, var(--red) 78%, var(--label)); font-weight: 700; opacity: 1; vertical-align: top; }
.et-bad { color: var(--red); font-weight: 600; }
.et-btns { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px 12px; background: var(--cell); }
.et-ask { padding: 2px 4px 14px; } .et-ask b { display: block; font-size: 20px; letter-spacing: -.4px; } .et-ask span { display: block; margin-top: 4px; font-size: 15px; color: var(--label2); }
.et-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.et-grid button { appearance: none; border: 0; border-radius: 12px; min-height: 60px; background: var(--cell); color: var(--label); cursor: pointer; display: grid; place-items: center; align-content: center; gap: 1px; box-shadow: inset 0 0 0 1px var(--sep); }
.et-grid button b { font-size: 17px; } .et-grid button small { font-size: 11px; color: var(--label2); } .et-grid button.on { background: var(--tint); color: #fff; } .et-grid button.on small { color: #fff; }
.et-kpi { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--cell); padding: 14px 8px; text-align: center; }
.et-kpi b { display: block; font-size: 20px; letter-spacing: -.4px; } .et-kpi small { display: block; font-size: 12px; color: var(--label2); margin-top: 2px; }
`; document.head.appendChild(css);
})();
