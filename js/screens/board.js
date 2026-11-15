/* Dispatch board: routes side by side for one day, one route across days, and a month overview.
   Jobs have no times — each column is an ordered list (stop 1 is done first). Drag a job to reorder or reassign it. */
(function () {
'use strict';
const { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const PAD = 6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

WD.css(`
.bd-top { height: 44px; display: flex; align-items: center; padding: 0 4px; flex: none; }
.bd-date { flex: 1; display: flex; align-items: center; justify-content: center; min-width: 0; }
.bd-date .t { border: 0; background: none; padding: 4px 2px; cursor: pointer; text-align: center; color: var(--label); min-width: 104px; }
.bd-date .t b { display: block; font-size: 17px; font-weight: 600; line-height: 20px; white-space: nowrap; }
.bd-date .t small { display: block; font-size: 11px; line-height: 13px; font-weight: 500; color: var(--label2); letter-spacing: 0; }
.bd-date .t small.today { color: var(--tint); }
.bd-date .nav-btn { min-width: 30px; padding: 0 2px; }
.bd-today { width: 24px; height: 24px; border: 1.7px solid currentColor; border-radius: 5px; font-size: 12px; font-weight: 700; display: grid; place-items: center; letter-spacing: 0; }
.bd-mode { display: flex; align-items: center; gap: 8px; padding: 0 12px 8px; flex: none; }
.bd-mode .segmented { width: 168px; flex: none; }
.bd-pill { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 10px; border-radius: 16px; border: 0; background: var(--fill3); color: var(--label); font-size: 14px; font-weight: 500; letter-spacing: -.15px; cursor: pointer; max-width: 150px; min-width: 0; }
.bd-pill span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd-strip { flex: none; display: flex; align-items: center; gap: 6px; padding: 6px 14px; font-size: 13px; font-weight: 500; letter-spacing: -.08px; cursor: pointer; background: color-mix(in srgb, var(--c) 14%, var(--cell)); color: var(--c); border-top: .5px solid var(--sep); }
.bd-strip .spacer { flex: 1; }
.bd-scroll { touch-action: pan-x pan-y; flex: 1; min-height: 0; overflow: auto; position: relative; background: var(--cell); border-top: .5px solid var(--sep); scrollbar-width: none; overscroll-behavior: contain; }
.bd-scroll::-webkit-scrollbar { display: none; }
.bd-content { position: relative; min-width: 100%; }
.bd-head { position: sticky; top: 0; z-index: 4; background: var(--cell); border-bottom: .5px solid var(--sep); }
.bd-hrow { display: flex; }
.bd-colhead { flex: none; padding: 6px 8px 5px; font-size: 13px; line-height: 16px; font-weight: 600; letter-spacing: -.1px; display: flex; align-items: center; gap: 5px; border-left: .5px solid var(--sep); min-width: 0; }
.bd-colhead:first-child { border-left: 0; }
.bd-colhead span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd-colhead span.c { margin-left: auto; font-weight: 500; color: var(--label2); font-size: 12px; }
.bd-colhead.today span.n { color: var(--red); }
.bd-colhead .dot { width: 8px; height: 8px; }
.bd-chip { margin: 0 0 4px; border-radius: 6px; background: color-mix(in srgb, var(--c) 18%, var(--cell)); color: var(--label); border: 1px dashed color-mix(in srgb, var(--c) 60%, transparent); font-size: 11.500px; line-height: 14px; padding: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; letter-spacing: -.05px; }
.bd-chip .ic { margin: -2px 3px 0 0; }
.bd-body { display: flex; position: relative; align-items: stretch; }
.bd-col { flex: none; position: relative; border-left: .5px solid var(--sep); padding: 6px 4px 24px; box-sizing: border-box; }
.bd-col:first-child { border-left: 0; }
.bd-col.past { background: color-mix(in srgb, var(--fill3) 45%, transparent); }
.bd-job { position: relative; margin-bottom: 5px; cursor: pointer; touch-action: pan-y; }
.bd-job-in { border-radius: 9px; background: var(--c); color: var(--fg, #fff); padding: 4px 4px 4px 4px; overflow: hidden; position: relative; display: flex; gap: 6px; align-items: flex-start; font-size: 12.500px; line-height: 15px; letter-spacing: -.1px; border: 3px solid var(--ring); transition: opacity .2s; }
.bd-num { flex: none; width: 20px; height: 20px; border-radius: 50%; background: var(--ring); color: #fff; font-size: 11.500px; font-weight: 800; display: grid; place-items: center; letter-spacing: 0; box-shadow: 0 0 0 1.5px rgba(255,255,255,.9); }
.bd-job-main { min-width: 0; flex: 1; }
.bd-job-title { font-weight: 600; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; word-break: break-word; }
.bd-job-title .ic { margin: -2px 2px 0 0; }
.bd-job-sub { font-size: 11px; line-height: 14px; opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0; margin-top: 1px; }
.lvl0 .bd-job-in { padding: 2px 4px; align-items: center; } .lvl0 .bd-job-title { -webkit-line-clamp: 1; } .lvl0 .bd-num { width: 17px; height: 17px; font-size: 10px; }
.lvl2 .bd-job-title { -webkit-line-clamp: 4; } .lvl2 .bd-job-sub { white-space: normal; }
/* Every card carries all three detail levels; the board's class picks one, so pinching never rebuilds the list. */
.lvl0 .d12, .lvl0 .d1, .lvl0 .d2, .lvl1 .d0, .lvl1 .d2, .lvl2 .d0, .lvl2 .d1 { display: none; }
.bd-tag.na { background: #fff; color: #D70015; }
.bd-job.calledoff .bd-num { background: rgba(0,0,0,.35); box-shadow: none; }
.bd-colhead { flex-wrap: wrap; row-gap: 2px; } .bd-offrow { flex-basis: 100%; order: 9; display: flex; }
.bd-off { flex: none; font-size: 10px; line-height: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: .2px; border-radius: 4px; padding: 0 4px; background: var(--red); color: #fff; }
.bd-zoombtns { margin-left: 2px; display: inline-flex; border-radius: 16px; background: var(--fill3); overflow: hidden; flex: none; }
.bd-zoombtns button { border: 0; background: none; width: 30px; height: 32px; color: var(--label); cursor: pointer; display: grid; place-items: center; padding: 0; } .bd-zoombtns button:disabled { opacity: .3; }
.bd-job-sub .ic { margin-top: -2px; }
.bd-job-note { font-size: 11px; line-height: 14px; opacity: .85; margin-top: 2px; font-style: italic; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; letter-spacing: 0; }
.bd-zoom { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); background: var(--material); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 12px; padding: 10px 16px; font-size: 15px; font-weight: 600; z-index: 30; pointer-events: none; box-shadow: 0 4px 18px rgba(0,0,0,.18); }
.bd-q { display: inline-block; background: #fff; color: #FF3B30; font-weight: 800; border-radius: 4px; padding: 0 4px; margin-right: 3px; font-size: 11px; line-height: 13px; }
.bd-job.faded .bd-job-in, .bd-job.struck .bd-job-in { opacity: .55; }
.bd-tag.nb { background: #fff; color: #C93400; }
.bd-slot { margin-bottom: 5px; border-radius: 9px; border: 2px dashed var(--tint); background: color-mix(in srgb, var(--tint) 12%, transparent); position: relative; box-sizing: border-box; transition: height .12s; }
.bd-slot .bd-job-in { opacity: .45; border-color: transparent; }
.bd-slot .bd-land { position: absolute; right: 6px; bottom: 4px; font-size: 10px; font-weight: 800; color: var(--tint); background: var(--cell); border-radius: 4px; padding: 0 4px; letter-spacing: .2px; text-transform: uppercase; }
.bd-job.struck .bd-job-title { text-decoration: line-through; text-decoration-thickness: 2px; }
.bd-tag { display: inline-block; font-size: 10px; line-height: 13px; font-weight: 800; letter-spacing: .2px; text-transform: uppercase; border-radius: 4px; padding: 0 4px; background: rgba(0,0,0,.28); color: #fff; margin-top: 2px; }
.bd-job.arrived .bd-job-in { outline: 2px solid var(--label); outline-offset: -2px; }
.bd-job.pending .bd-job-in { background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.2) 0 6px, transparent 6px 12px); }
.bd-job.dragging { display: none; }
.bd-job.flash .bd-job-in { animation: bd-flash 1.800s ease-out; }
@keyframes bd-flash { 0%, 40% { box-shadow: 0 0 0 4px var(--yellow); transform: scale(1.04); } 100% { transform: none; } }
.bd-add { display: flex; align-items: center; justify-content: center; gap: 4px; height: 34px; border-radius: 9px; border: 1px dashed var(--sep); color: var(--label3); font-size: 12px; cursor: pointer; letter-spacing: 0; }
.bd-empty { text-align: center; color: var(--label3); font-size: 12px; padding: 14px 4px 10px; letter-spacing: 0; }
.bd-ins { position: absolute; height: 3px; border-radius: 2px; background: var(--tint); z-index: 9; pointer-events: none; }
.bd-ins::before { content: ''; position: absolute; left: -3px; top: -3px; width: 9px; height: 9px; border-radius: 50%; background: var(--tint); }
.bd-ghost { position: absolute; z-index: 10; pointer-events: none; margin: 0; }
.bd-ghost .bd-job-in { box-shadow: 0 10px 26px rgba(0,0,0,.35); transform: scale(1.03); opacity: .95; }
.bd-month { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--cell); border-top: .5px solid var(--sep); }
.bd-mhead { display: grid; grid-template-columns: repeat(7, 1fr); font-size: 11px; color: var(--label2); text-align: center; padding: 4px 0; flex: none; letter-spacing: 0; }
.bd-week { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(7, 1fr); border-top: .5px solid var(--sep); }
.bd-mday { min-width: 0; padding: 2px 1px; cursor: pointer; overflow: hidden; }
.bd-mday.other { opacity: .35; }
.bd-mday.sel { background: var(--fill3); }
.bd-mnum { width: 22px; height: 22px; margin: 0 auto 1px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; letter-spacing: 0; }
.bd-mday.today .bd-mnum { background: var(--red); color: #fff; font-weight: 600; }
.bd-mev { font-size: 9px; line-height: 12px; letter-spacing: 0; white-space: nowrap; overflow: hidden; border-radius: 3px; padding: 0 2px; margin-top: 1px; background: color-mix(in srgb, var(--c) 30%, var(--cell)); border-left: 3px solid var(--ring); }
.bd-mev.struck { text-decoration: line-through; opacity: .6; }
.bd-more { font-size: 9px; line-height: 12px; color: var(--label2); padding-left: 3px; letter-spacing: 0; }
.bd-cal { padding: 0 14px 12px; }
.bd-cal-top { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 6px; font-weight: 600; }
.bd-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 2px; text-align: center; }
.bd-cal-grid span { font-size: 12px; color: var(--label3); padding-bottom: 4px; letter-spacing: 0; }
.bd-cal-grid button { border: 0; background: none; height: 40px; font-size: 19px; color: var(--label); cursor: pointer; border-radius: 50%; width: 40px; margin: 0 auto; letter-spacing: 0; }
.bd-cal-grid button.today { color: var(--tint); font-weight: 600; }
.bd-cal-grid button.sel { background: var(--tint); color: #fff; font-weight: 600; }
.bd-cal-grid button.other { color: var(--label3); }
`);

let page = null, scroller = null, saved = { top: null, left: 0 }, layout = { cols: [], colW: 100 }, drag = null, flashId = null, revealId = null;
const boardSort = q.order;
const jobsScreen = () => WD.screens.jobs || {};

function columns() {
  const b = S.board;
  if (b.mode === 'days') return Array.from({ length: b.dayCount }, (_, i) => { const day = D.add(b.day, i); return { routeId: b.routeId, day, title: fmt.day(day, 'weekday') + ' ' + D.parse(day).getDate(), today: day === D.today() }; });
  return q.visibleRoutes().map(r => ({ routeId: r.id, day: b.day, title: q.routeName(r), color: q.routeColor(r), today: b.day === D.today() }));
}
function step(n) { const b = S.board; if (b.mode === 'month') { const d = D.parse(b.day); d.setDate(1); d.setMonth(d.getMonth() + n); b.day = D.key(d); } else b.day = D.add(b.day, n); keep(undefined, 0); refresh(); }
/** Choose the scroll position for the next render (undefined = stay where we are, null = back to the top). */
function keep(top, left) { const live = scroller && scroller.isConnected; saved = { top: top === undefined ? (live ? scroller.scrollTop : saved.top) : top, left: left === undefined ? (live ? scroller.scrollLeft : saved.left) : left }; scroller = null; }
function refresh() { if (page && page.el.isConnected) page.refresh(); }

/* ---------- Header rows ---------- */
function topBar() {
  const b = S.board, today = D.today();
  let title = fmt.day(b.day), sub = fmt.day(b.day, 'rel');
  if (b.mode === 'month') { title = fmt.day(b.day, 'month'); sub = ''; }
  else if (b.mode === 'days' && b.dayCount > 1) { title = fmt.day(b.day, 'md') + ' – ' + fmt.day(D.add(b.day, b.dayCount - 1), 'md'); sub = ''; }
  else if (sub === title) sub = '';
  const btn = (ic, label, fn, extra) => h('button.nav-btn', { 'aria-label': label, onclick: e => fn(e.currentTarget) }, extra || icon(ic, 23));
  return h('div.bd-top',
    WD.can('jobs.edit') && b.mode !== 'month' ? btn('sparkles', 'AutoRoute', () => jobsScreen().openAutoRoute && jobsScreen().openAutoRoute(b.mode === 'days' ? b.routeId : null, { day: b.day })) : h('span', { style: 'width:38px' }),
    h('div.bd-date', btn('chevron.left', 'Previous', () => step(-1), icon('chevron.left', 20)),
      h('button.t', { 'aria-label': 'Go to date', onclick: pickDate }, h('b', title), sub && h('small' + (b.day === today ? '.today' : ''), sub)),
      btn('chevron.right', 'Next', () => step(1), icon('chevron.right', 20))),
    btn('magnifyingglass', 'Search', () => jobsScreen().openSearch && jobsScreen().openSearch()),
    btn(null, 'Today', () => { b.day = today; keep(null); refresh(); }, h('span.bd-today', D.parse(today).getDate())),
    WD.can('jobs.edit') && btn('plus', 'New job', () => jobsScreen().openEditor && jobsScreen().openEditor({ day: b.day, routeId: b.mode === 'days' ? b.routeId : (q.visibleRoutes()[0] || q.routes()[0]).id })));
}
const syncItems = () => [{ label: 'Pending changes' + (S.pending.length ? ' (' + S.pending.length + ')' : ''), icon: 'sync', onTap: () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending() },
  { label: 'Refresh', icon: 'arrow.clockwise', onTap: async () => { if (S.offline) return ui.toast('Offline — showing saved jobs', 'wifi.slash'); ui.toast('Checking for changes…'); await WD.delay(900, 1400); ui.toast('Up to date', 'checkmark'); } }];
function boardMenu(anchor) {
  const b = S.board, n = S.pending.length;
  ui.menu(anchor, [
    { header: S.org.name + ' · routes on the board' },
    ...q.routes().map(r => ({ label: q.routeName(r), checked: r.visible, onTap: () => { r.visible = !r.visible; WD.changed(); } })),
    'divider', { header: 'Card detail · or pinch the board' }, ...DETAIL.map((t, i) => ({ label: t, checked: b.detail === i, onTap: () => setDetail(i) })),
    'divider',
    { label: 'Pending changes' + (n ? ' (' + n + ')' : ''), icon: 'sync', onTap: () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending() },
    { label: 'Refresh', icon: 'arrow.clockwise', onTap: async () => { if (S.offline) return ui.toast('Offline — showing saved jobs', 'wifi.slash'); ui.toast('Checking for changes…'); await WD.delay(900, 1400); ui.toast('Up to date', 'checkmark'); } },
  ]);
}
function modeRow() {
  const b = S.board, route = q.route(b.routeId);
  const pill = b.mode === 'days'
    ? h('button.bd-pill', { onclick: e => ui.menu(e.currentTarget, [{ header: 'Route' }, ...q.routes().map(r => ({ label: q.routeName(r), checked: r.id === b.routeId, onTap: () => { b.routeId = r.id; refresh(); } })), 'divider',
        { label: 'Show 1 day', checked: b.dayCount === 1, onTap: () => { b.dayCount = 1; refresh(); } }, { label: 'Show 3 days', checked: b.dayCount === 3, onTap: () => { b.dayCount = 3; refresh(); } }, 'divider', { header: 'Card detail · or pinch the board' }, ...DETAIL.map((t, i) => ({ label: t, checked: b.detail === i, onTap: () => setDetail(i) })), 'divider', ...syncItems()]) },
        ui.dot(q.routeColor(route)), h('span.n', q.routeName(route)), icon('chevron.down', 13))
    : h('button.bd-pill', { onclick: e => boardMenu(e.currentTarget) }, h('span.n', q.visibleRoutes().length + ' of ' + q.routes().length + ' routes'), icon('chevron.down', 13));
  const zoom = b.mode !== 'month' && h('span.bd-zoombtns', h('button', { 'aria-label': 'Less detail', disabled: b.detail <= 0, onclick: () => setDetail(S.board.detail - 1, true) }, icon('minus', 16)), h('button', { 'aria-label': 'More detail', disabled: b.detail >= DETAIL.length - 1, onclick: () => setDetail(S.board.detail + 1, true) }, icon('plus', 16)));
  return h('div.bd-mode', ui.segmented([{ value: 'routes', label: 'Routes' }, { value: 'days', label: 'Days' }, { value: 'month', label: 'Month' }], b.mode, v => { b.mode = v; keep(undefined, 0); refresh(); }), pill, zoom);
}
function statusStrip() {
  const conflicts = S.pending.filter(o => o.status === 'conflict').length, n = S.pending.length;
  if (!S.offline && !n) return null;
  const open = () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending();
  if (conflicts) return h('div.bd-strip', { style: { '--c': 'var(--red)' }, onclick: open }, icon('exclamationmark.triangle', 16), conflicts + (conflicts === 1 ? ' change needs' : ' changes need') + ' review', h('span.spacer'), 'Review', icon('chevron.right', 13));
  if (S.offline) return h('div.bd-strip', { style: { '--c': 'var(--orange)' }, onclick: open }, icon('wifi.slash', 16), n ? 'Offline · ' + n + (n === 1 ? ' change' : ' changes') + ' saved on this iPhone' : 'Offline · showing saved jobs', h('span.spacer'), n ? icon('chevron.right', 13) : null);
  return h('div.bd-strip', { style: { '--c': 'var(--gray)' }, onclick: open }, ui.spinner(14), 'Syncing ' + n + (n === 1 ? ' change…' : ' changes…'));
}
/** Upcoming jobs saved without the address their type needs: review, fix or ignore them. */
function addressStrip() {
  const n = WD.missingAddresses().length; if (!n) return null;
  return h('div.bd-strip', { style: { '--c': 'var(--red)' }, onclick: () => WD.x.missingSheet() }, icon('mappin', 16), n + (n === 1 ? ' upcoming job is' : ' upcoming jobs are') + ' missing an address', h('span.spacer'), 'Review', icon('chevron.right', 13));
}
/** Approved time off for the driver of a column's route on its day. */
const offFor = c => WD.offOn((q.route(c.routeId) || {}).driverId, c.day);
const offText = (c, t) => (q.user(t.userId) || { name: 'Driver' }).name.split(' ')[0] + ' off' + (t.fromTime ? ' ' + shortT(fmt.fromHHMM(t.fromTime)) + '–' + shortT(fmt.fromHHMM(t.untilTime || '17:00')) : '');
/** With a single column there is no header row, so time off shows as a bar instead. */
function offStrip() {
  const cols = S.board.mode === 'month' ? [] : columns(); if (cols.length !== 1) return null; const t = offFor(cols[0]); if (!t) return null;
  return h('div.bd-strip', { style: { '--c': 'var(--red)', cursor: 'default' } }, icon('person', 16), (q.user(t.userId) || { name: 'The driver' }).name + ' has approved time off · ' + WD.timeOffLabel(t));
}

/* ---------- Ordered lists ---------- */
/* Colors: the job type fills the card and the route (calendar) color rims it. */
const cardStyle = job => { const c = q.jobType(job.type).color; return { '--c': c, '--ring': q.routeColor(job.routeId), '--fg': WD.textOn(c) }; };
/* Card detail: pinch vertically on the board (or ⌘/ctrl-scroll, or the routes menu) — 0 shows more jobs with just the name, 2 shows fewer jobs with everything a dispatcher needs. Addresses are left off; they're one tap away. */
const DETAIL = ['Less detail', 'Standard', 'More detail'];
if (S.board.detail == null) S.board.detail = 1;
const shortT = m => { const hh = Math.floor(m / 60), mm = m % 60; return (hh % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (hh < 12 ? 'a' : 'p'); };
function facts(job, full) {
  const out = [], items = WD.itemsLabel(job.items, job.type === 'purge'), est = job.type === 'purge' && job.purge && WD.purgeEstimate(job.purge), m = fmt.fromHHMM;
  if (items) out.push(['shippingbox', items]); else if (job.containers) out.push(['shippingbox', job.containers]);
  if (job.custFrom || job.custUntil) out.push(['clock', (job.windowBy === 'us' ? 'Told ' : 'Asked ') + (job.custFrom ? shortT(m(job.custFrom)) : 'any') + '–' + (job.custUntil ? shortT(m(job.custUntil)) : 'any') + (job.custStrict ? ' · required' : '')]);
  else if (job.needsWindow) out.push(['clock', 'Needs window']);
  if (est && est.minutes) out.push(['timer', (est.guess ? est.low + '–' + est.high : est.minutes) + ' min on site']); else if (job.dur && full) out.push(['timer', '~' + q.visitStats(job).median + ' min on site']);
  return out;
}
function details(job) {
  const c = job.customerId && q.customer(job.customerId), p = c && c.contacts[0], out = [];
  out.push(h('div.bd-job-sub', q.jobType(job.type).title));
  facts(job, true).forEach(([ic, t]) => out.push(h('div.bd-job-sub', icon(ic, 10), ' ', t)));
  if (job.callAhead) out.push(h('div.bd-job-sub', icon('phone', 10), ' Call ' + (job.callAhead === 60 ? '1 hr' : job.callAhead + ' min') + ' ahead'));
  if (p || job.phone) out.push(h('div.bd-job-sub', icon('person', 10), ' ', p ? p.name : job.contactName || fmt.phone(job.phone, job.ext)));
  if (job.po) out.push(h('div.bd-job-sub', 'PO ' + job.po));
  if (job.notes) out.push(h('div.bd-job-note', job.notes));
  return out;
}
function cell(job, number) {
  const type = q.jobType(job.type), st = { enroute: 'truck', arrived: 'mappin', completed: 'checkmark', skipped: 'xmark', canceled: 'xmark', rescheduled: 'calendar', postponed: 'clock' }[job.status], struck = WD.struck[job.status];
  const tag = { skipped: 'Skipped', canceled: 'Canceled', rescheduled: 'Rescheduled', postponed: 'Postponed' }[job.status];
  const wf = WD.workflow, notBilled = job.status === 'completed' && !wf.billed(job) && job.type !== 'meet', noAddr = !WD.closed[job.status] && WD.addressIssue(job);
  return h('div.bd-job.' + job.status + (struck ? '.struck' : '') + (WD.calledOff(job) ? '.calledoff' : '') + (wf.dimmed(job) ? '.faded' : '') + (job.pending ? '.pending' : '') + (drag && drag.job.id === job.id ? '.dragging' : '') + (flashId === job.id ? '.flash' : ''),
    { 'data-job': job.id, style: cardStyle(job) },
    h('div.bd-job-in', h('span.bd-num', number),
      h('div.bd-job-main', h('div.bd-job-title', !job.located && job.address && job.type !== 'meet' ? h('span.bd-q', '?') : null, st && icon(st, 12), job.pending && icon('sync', 11), h('span.d0', job.title), h('span.d12', wf.titleNode(job)), job.recurring ? h('span', { style: 'opacity:.8;font-weight:400' }, ' ↻') : null),
        tag ? h('div.bd-tag', tag + (job.rescheduledTo ? ' · ' + fmt.day(job.rescheduledTo, 'md') : '')) : notBilled ? h('div.bd-tag.nb', 'Not billed') : noAddr ? h('div.bd-tag.na', noAddr) : null,
        !tag && h('div.bd-job-sub.d1', facts(job).map(x => x[1]).join(' · ') || type.title),
        !tag && h('div.d2', details(job)))));
}
function grid() {
  const b = S.board, cols = columns(), W = page.body.clientWidth || 393;
  if (!cols.length) return h('div', { style: 'flex:1;background:var(--cell);border-top:.5px solid var(--sep)' }, ui.empty({ icon: 'columns', title: 'No routes selected', text: 'Choose which routes appear on the board.', action: ui.button('Choose routes', { kind: 'tinted', block: false, small: true, onTap: (e, el) => boardMenu(el) }) }));
  const colW = Math.floor(W / Math.min(cols.length, 3)), showHead = cols.length > 1, today = D.today(), canEdit = WD.can('jobs.edit');
  layout = { cols, colW };
  const lists = cols.map(c => ({ notes: q.jobsFor(c.routeId, c.day).filter(j => j.allDay), stops: q.stopList(c.routeId, c.day) }));
  const head = showHead && h('div.bd-head', h('div.bd-hrow', cols.map((c, i) => h('div.bd-colhead' + (c.today && b.mode === 'days' ? '.today' : ''), { style: { width: colW + 'px' } },
    c.color && ui.dot(c.color), h('span.n', c.title), (t => t && h('span.bd-offrow', h('span.bd-off', { title: WD.timeOffLabel(t) }, offText(c, t))))(offFor(c)), h('span.c', (d => d ? 'Leave ' + shortT(d.depart) + ' · ' : '')(data.routeDays[c.routeId + '|' + c.day]) + lists[i].stops.filter(j => !WD.calledOff(j)).length)))));
  const body = h('div.bd-body', cols.map((c, i) => {
    const { notes, stops } = lists[i];
    return h('div.bd-col' + (c.day < today ? '.past' : ''), { 'data-i': i, style: { width: colW + 'px' } },
      notes.map(j => h('div.bd-chip', { style: { '--c': q.routeColor(j.routeId) }, onclick: () => jobsScreen().openDetails && jobsScreen().openDetails(j.id) }, icon('note', 11), j.title)),
      stops.map((j, n) => cell(j, WD.calledOff(j) ? '–' : n + 1)),
      !stops.length && h('div.bd-empty', 'No stops'),
      canEdit && h('div.bd-add', { 'data-add': i }, icon('plus', 13), 'Add stop'));
  }));
  const el = scroller = h('div.bd-scroll.lvl' + S.board.detail, h('div.bd-content', { style: { width: colW * cols.length + 'px' } }, head, body));
  el.addEventListener('pointerdown', onPointerDown); el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('touchstart', touchStart, { passive: false }); el.addEventListener('touchmove', touchMove, { passive: false }); el.addEventListener('touchend', touchEnd); el.addEventListener('touchcancel', touchEnd);
  const top = saved.top, left = saved.left, reveal = revealId; revealId = null;
  requestAnimationFrame(() => {
    if (!el.isConnected) return; el.scrollTop = top == null ? 0 : top; el.scrollLeft = left;
    const target = reveal && el.querySelector('.bd-job[data-job="' + reveal + '"]');
    if (target) { const r = target.getBoundingClientRect(), box = el.getBoundingClientRect(); if (r.bottom > box.bottom - 10 || r.top < box.top + 30) el.scrollTop += r.top - box.top - box.height / 3; const cx = r.left - box.left; if (cx < 0 || cx + r.width > box.width) el.scrollLeft += cx - 4; }
    if (drag) { el.querySelector('.bd-body').append(drag.ghost); drag.target = null; dragMove(drag.last); }
  });
  if (flashId) setTimeout(() => { flashId = null; }, 1900);
  return el;
}

/* ---------- Pinch: changes how much each card shows ----------
   The level follows the size of the pinch from where it started (each 35% wider or narrower is one step), so the same motion always
   gives the same result and it can be reversed without lifting. It reads the live touch list, so a finger that lifted is never counted,
   and the board is not rebuilt while two fingers are down. */
let pinch = null, pinchAt = 0, staleWhilePinching = false, wheelAcc = 0, wheelAt = 0;
const PINCH_STEP = Math.log(1.35);
const spread = e => Math.max(40, Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY));
function setDetail(n, hud) {
  n = clamp(n, 0, DETAIL.length - 1); if (n === S.board.detail) return; S.board.detail = n;
  const el = scroller && scroller.isConnected ? scroller : null;
  if (el) { const at = el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0; el.classList.remove('lvl0', 'lvl1', 'lvl2'); el.classList.add('lvl' + n); el.scrollTop = at * Math.max(0, el.scrollHeight - el.clientHeight); } else refresh();
  if (page) page.body.querySelectorAll('.bd-zoombtns button').forEach((b, i) => { b.disabled = i ? n >= DETAIL.length - 1 : n <= 0; });
  if (hud && page) { const old = page.body.querySelector('.bd-zoom'); if (old) old.remove(); const z = h('div.bd-zoom', DETAIL[n]); page.body.style.position = 'relative'; page.body.appendChild(z); setTimeout(() => z.remove(), 700); }
}
function endPinch() { if (!pinch) return; pinch = null; pinchAt = Date.now(); if (staleWhilePinching) { staleWhilePinching = false; refresh(); } }
function touchStart(e) { if (e.touches.length === 2 && !drag) { pinch = { d0: spread(e), level: S.board.detail }; pinchAt = Date.now(); if (e.cancelable) e.preventDefault(); } else endPinch(); }
function touchMove(e) {
  if (drag) { if (e.cancelable) e.preventDefault(); return; } if (!pinch) return; if (e.touches.length !== 2) return endPinch();
  if (e.cancelable) e.preventDefault(); pinchAt = Date.now(); const steps = Math.log(spread(e) / pinch.d0) / PINCH_STEP;
  setDetail(pinch.level + (steps >= 0 ? Math.floor(steps) : Math.ceil(steps)), true);
}
function touchEnd(e) { if (e.touches.length < 2) endPinch(); }
/** Trackpad pinch (ctrl-wheel) does the same on a Mac. */
function onWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const t = Date.now(); if (t - wheelAt > 400) wheelAcc = 0; wheelAt = t; wheelAcc += e.deltaY;
  if (wheelAcc < -35) { wheelAcc = 0; setDetail(S.board.detail + 1, true); } else if (wheelAcc > 35) { wheelAcc = 0; setDetail(S.board.detail - 1, true); }
}

/* ---------- Tap, swipe and drag ---------- */
function onPointerDown(e) {
  if (e.button > 0 || e.target.closest('.bd-chip') || drag || pinch) return;
  const cellEl = e.target.closest('.bd-job'), colEl = e.target.closest('.bd-col'), addEl = e.target.closest('.bd-add'), sx = e.clientX, sy = e.clientY, touch = e.pointerType === 'touch', el = scroller;
  const job = cellEl && q.job(cellEl.dataset.job), canDrag = job && WD.can('jobs.edit') && !job.pending && (job.status === 'scheduled' || job.status === 'enroute');
  /* A stop that can't move says why when you try to drag it (hold on touch, drag with a mouse), instead of doing nothing. */
  const locked = job && WD.can('jobs.edit') && !canDrag && lockedReason(job);
  let moved = false, active = false, held = false, timer = null;
  const begin = ev => { active = true; startDrag(job, cellEl, ev); };
  if (touch && (canDrag || locked)) timer = setTimeout(() => { if (pinch || Date.now() - pinchAt < 400) return; if (canDrag) begin(e); else { held = true; ui.toast(locked, 'lock', 2400); } }, 380);
  const move = ev => {
    if (!active && !moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) { moved = true; if (touch) clearTimeout(timer); else if (canDrag) begin(ev); else if (locked) ui.toast(locked, 'lock', 2400); }
    if (active) { ev.preventDefault(); dragMove(ev); }
  };
  const cleanup = () => { clearTimeout(timer); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); };
  const up = ev => {
    cleanup(); if (active) return dragEnd(); if (pinch || Date.now() - pinchAt < 500) return;
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (held) return;
    if (!moved) { if (job) jobsScreen().openDetails && jobsScreen().openDetails(job.id); else if (colEl && WD.can('jobs.edit') && (addEl || !e.target.closest('.bd-empty'))) addStop(colEl); }
    else if (!job && Math.abs(dx) > 70 && Math.abs(dy) < 45 && (dx < 0 ? el.scrollLeft >= el.scrollWidth - el.clientWidth - 2 : el.scrollLeft <= 2)) step(dx < 0 ? 1 : -1);
  };
  const cancel = () => { cleanup(); if (active) { drag.ghost.remove(); drag.ins.remove(); drag.slot.remove(); drag = null; refresh(); } };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
}
function lockedReason(job) {
  if (job.pending) return 'This stop is still syncing. Try again in a moment.';
  if (job.status === 'rescheduled' && job.rescheduledTo) return 'Rescheduled to ' + fmt.day(job.rescheduledTo) + '. Move the new visit on that day instead.';
  return { completed: 'Completed stops can’t be moved', arrived: 'The driver is at this stop, so it can’t be moved', skipped: 'Skipped stops can’t be moved', canceled: 'Canceled stops can’t be moved', rescheduled: 'Rescheduled stops can’t be moved', postponed: 'Postponed stops can’t be moved' }[job.status] || 'This stop can’t be moved';
}
/** Tapping a column's empty space (or its Add stop button) adds a job at the end of that list. */
function addStop(colEl) { const c = layout.cols[+colEl.dataset.i]; jobsScreen().openEditor && jobsScreen().openEditor({ day: c.day, routeId: c.routeId }); }
function startDrag(job, cellEl, ev) {
  const r = cellEl.getBoundingClientRect(), ghost = cellEl.cloneNode(true); ghost.classList.remove('dragging', 'flash'); ghost.classList.add('bd-ghost');
  const slot = h('div.bd-slot', { style: { height: r.height + 'px', ...cardStyle(job) } }, cellEl.firstChild.cloneNode(true), h('span.bd-land', 'Lands here'));
  drag = { job, ghost, slot, ins: h('div.bd-ins'), grabY: ev.clientY - r.top, height: r.height, last: ev, target: null, edge: 0, edgeAt: 0 };
  cellEl.parentNode.insertBefore(slot, cellEl); cellEl.classList.add('dragging'); scroller.querySelector('.bd-body').append(ghost); dragMove(ev); autoScroll();
}
/** The list slot under the pointer: column i and 0-based index among that list's other jobs. Finished and in-progress stops stay ahead of it. */
function dragMove(ev) {
  if (!drag || !scroller) return; drag.last = ev;
  const body = scroller.querySelector('.bd-body'), { cols, colW } = layout, job = drag.job, p = ui.localPoint(ev, body);
  const i = clamp(Math.floor(p.x / colW), 0, cols.length - 1), colEl = body.children[i]; if (!colEl) return;
  const cards = [...colEl.querySelectorAll('.bd-job:not(.bd-ghost)')].filter(c => c.dataset.job !== job.id), list = cards.map(c => q.job(c.dataset.job)), slot = drag.slot;
  /* Compare with the cards where they are on screen; while the finger is over the landing slot it stays put, so it never jitters. */
  const inCol = slot.parentNode === colEl, onSlot = inCol && p.y >= slot.offsetTop - 2 && p.y <= slot.offsetTop + slot.offsetHeight + 2;
  let index = onSlot && drag.target && drag.target.routeId === cols[i].routeId && drag.target.day === cols[i].day ? drag.target.index : cards.findIndex(c => p.y < c.offsetTop + c.offsetHeight / 2); if (index < 0) index = cards.length;
  /* Called-off visits sit at the bottom: nothing lands below them, and they don't hold later stops in place. */
  const live = list.filter(j => j && !WD.calledOff(j)).length, locked = list.reduce((n, j, k) => j && !WD.calledOff(j) && !['scheduled', 'enroute'].includes(j.status) ? k + 1 : n, 0); index = clamp(index, locked, live);
  const prev = drag.target; drag.target = { routeId: cols[i].routeId, day: cols[i].day, index };
  if (!prev || prev.index !== index || prev.routeId !== drag.target.routeId || prev.day !== drag.target.day || slot.parentNode !== colEl) {
    /* The ghost of where the job will land: the list makes room and every stop shows its new number. */
    colEl.insertBefore(slot, cards[index] || colEl.querySelector('.bd-empty') || colEl.querySelector('.bd-add'));
    slot.style.setProperty('--ring', q.routeColor(cols[i].routeId));
    [...body.children].forEach(col => { let n = 0; [...col.children].forEach(el => { if (el.classList.contains('bd-slot') || (el.classList.contains('bd-job') && !el.classList.contains('dragging') && !el.classList.contains('bd-ghost') && !el.classList.contains('calledoff'))) { const num = el.querySelector('.bd-num'); if (num) num.textContent = ++n; } }); });
  }
  Object.assign(drag.ghost.style, { left: i * colW + 4 + 'px', width: colW - 8 + 'px', top: p.y - drag.grabY + 'px' });
  drag.ghost.style.setProperty('--ring', q.routeColor(cols[i].routeId));
  const num = drag.ghost.querySelector('.bd-num'); if (num) num.textContent = index + 1;
}
function autoScroll() {
  if (!drag) return;
  const el = scroller, ev = drag.last;
  if (el && ev) {
    const p = ui.localPoint(ev, el), headEl = el.querySelector('.bd-head'), headH = headEl ? headEl.offsetHeight : 0, t = Date.now();
    if (p.y > el.clientHeight - 44) el.scrollTop += 9; else if (p.y < headH + 36) el.scrollTop -= 9;
    const side = p.x > el.clientWidth - 24 ? 1 : p.x < 18 ? -1 : 0, canScroll = side > 0 ? el.scrollLeft < el.scrollWidth - el.clientWidth - 1 : side < 0 ? el.scrollLeft > 0 : false;
    if (side && canScroll) { el.scrollLeft += side * 9; drag.edge = 0; }
    else if (side) { if (drag.edge !== side) { drag.edge = side; drag.edgeAt = t; } else if (t - drag.edgeAt > 850) { drag.edgeAt = t; S.board.day = D.add(S.board.day, side); saved = { top: el.scrollTop, left: el.scrollLeft }; scroller = null; refresh(); } }
    else drag.edge = 0;
    if (scroller) dragMove(ev);
  }
  requestAnimationFrame(autoScroll);
}
function dragEnd() { const { job, target, ghost, ins, slot } = drag; ghost.remove(); ins.remove(); slot.remove(); drag = null; refresh(); if (target) dropped(job, target); }

const SCOPES = ['This job', 'This and following jobs', 'All jobs'];
/** Other occurrences of a recurring job covered by a scope (excluding the job itself). */
function seriesJobs(job, scope) {
  if (!job.recurring || scope === 'This job' || !scope) return [];
  return data.jobs.filter(j => j !== job && j.recurring && j.recurring.seriesId === job.recurring.seriesId && j.status === 'scheduled' && (scope === 'All jobs' || j.day > job.day));
}
WD.boardHelpers = { SCOPES, seriesJobs };
async function dropped(job, t) {
  const routeChanged = t.routeId !== job.routeId, dayChanged = t.day !== job.day, pos = q.position(job);
  if (!routeChanged && !dayChanged && t.index === pos.n - 1) return;
  const where = 'Stop ' + (t.index + 1) + ' on ' + (routeChanged ? q.routeName(t.routeId) : 'the list') + (dayChanged ? ' · ' + fmt.day(t.day) : ''), me = S.me.name;
  let scope = 'This job', kind = 'edit';
  if (routeChanged) { kind = 'reassign';
    scope = await ui.actionSheet({ title: 'Reassign ' + job.title + ' to ' + q.routeName(t.routeId) + '?', message: where + '.' + (job.recurring ? ' Other visits in the series go to the end of that route’s list.' : ''), buttons: job.recurring ? SCOPES.map(s => ({ label: s })) : [{ label: 'Reassign job', value: 'This job' }] });
    if (!scope) return;
  } else if (dayChanged) {
    scope = await ui.actionSheet({ title: 'Move ' + job.title + ' to ' + fmt.day(t.day) + '?', message: where + '. Only this visit changes.', buttons: [{ label: 'Move job', value: 'This job' }] });
    if (!scope) return;
  }
  const series = routeChanged ? seriesJobs(job, scope) : [];
  api.op({ kind, title: job.title, scope: routeChanged || dayChanged ? scope : 'Reordered · stop ' + pos.n + ' → ' + (t.index + 1), jobIds: [job.id, ...series.map(j => j.id)], apply() {
    WD.placeJob(job, t.routeId, t.day, t.index);
    job.events.push({ at: +WD.now(), actor: me, text: routeChanged ? 'Reassigned to ' + q.routeName(t.routeId) + ' · stop ' + job.seq : dayChanged ? 'Moved to ' + fmt.day(t.day) + ' · stop ' + job.seq : 'Moved to stop ' + job.seq });
    series.forEach(j => WD.placeJob(j, t.routeId, j.day, Infinity));
  } });
  flashId = job.id;
}

/* ---------- Month ---------- */
function monthWeeks(dayKey) {
  const first = D.parse(dayKey); first.setDate(1); const month = first.getMonth(); let k = D.add(D.key(first), -first.getDay()); const weeks = [];
  for (let w = 0; w < 6; w++) { const days = []; for (let d = 0; d < 7; d++) { days.push(k); k = D.add(k, 1); } if (w < 4 || D.parse(days[0]).getMonth() === month) weeks.push(days); }
  return { weeks, month };
}
function monthView() {
  const b = S.board, { weeks, month } = monthWeeks(b.day), routes = q.visibleRoutes().map(r => r.id), today = D.today();
  return h('div.bd-month', h('div.bd-mhead', ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => h('span', x))), weeks.map(days => h('div.bd-week', days.map(day => {
    const jobs = q.jobsOn(day).filter(j => routes.includes(j.routeId)).sort(boardSort);
    return h('div.bd-mday' + (D.parse(day).getMonth() !== month ? '.other' : '') + (day === today ? '.today' : ''), { onclick: () => { b.day = day; b.mode = 'routes'; keep(null, 0); refresh(); } },
      h('div.bd-mnum', D.parse(day).getDate()), jobs.slice(0, 4).map(j => h('div.bd-mev' + (WD.struck[j.status] ? '.struck' : ''), { style: { '--c': j.allDay ? q.routeColor(j.routeId) : q.jobType(j.type).color, '--ring': q.routeColor(j.routeId) } }, j.title)), jobs.length > 4 && h('div.bd-more', '+' + (jobs.length - 4) + ' more'));
  }))));
}
function pickDate() {
  let cursor = S.board.day;
  const sheet = ui.sheet({ title: 'Go to date', live: false,
    leading: [{ label: 'Today', onTap: () => { S.board.day = D.today(); keep(null); sheet.close(); } }], trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
    render(p) {
      const { weeks, month } = monthWeeks(cursor), today = D.today(), shift = n => { const d = D.parse(cursor); d.setDate(1); d.setMonth(d.getMonth() + n); cursor = D.key(d); p.refresh(); };
      return h('div.bd-cal', h('div.bd-cal-top', h('span', fmt.day(cursor, 'month')), h('span', h('button.nav-btn', { onclick: () => shift(-1) }, icon('chevron.left', 22)), h('button.nav-btn', { onclick: () => shift(1) }, icon('chevron.right', 22)))),
        h('div.bd-cal-grid', ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(x => h('span', x)), weeks.flat().map(day => h('button' + (day === S.board.day ? '.sel' : day === today ? '.today' : '') + (D.parse(day).getMonth() !== month ? '.other' : ''), { onclick: () => { S.board.day = day; keep(null); sheet.close(); } }, D.parse(day).getDate()))));
    } }, { detent: 'medium' });
}

/* ---------- Page ---------- */
function render(p) {
  page = p; const b = S.board;
  if (scroller && scroller.isConnected) saved = { top: scroller.scrollTop, left: scroller.scrollLeft };
  if (!q.route(b.routeId)) { const mine = data.routes.find(r => r.driverId === S.me.id); b.routeId = (mine || q.visibleRoutes()[0] || q.routes()[0]).id; }
  return [topBar(), modeRow(), statusStrip(), addressStrip(), offStrip(), b.mode === 'month' ? monthView() : grid()];
}
WD.screens.board = {
  root: () => ({ title: 'Dispatch', navbar: false, noScroll: true, live: false, render, onChange: p => { if (pinch) staleWhilePinching = true; else if (!drag) p.refresh(); }, onReappear: p => p.refresh() }),
  /** Show a day (and optionally one job, highlighted) on the board. */
  show(day, jobId) { S.board.day = day; if (S.board.mode === 'month') S.board.mode = 'routes'; keep(null); flashId = jobId || null; const j = jobId && q.job(jobId); if (j) { const r = q.route(j.routeId); if (r && !r.visible) r.visible = true; revealId = j.id; } WD.nav.switchTab('board'); refresh(); },
};

WD.panel.addAction('Live update: dispatcher moves a job', () => {
  const j = data.jobs.filter(x => x.day === D.today() && x.status === 'scheduled' && !x.allDay && !x.pending && q.route(x.routeId).visible).sort(q.order).find(x => q.position(x).n < q.position(x).of); if (!j) return;
  WD.placeJob(j, j.routeId, j.day, q.position(j).n + 1); j.version++; j.events.push({ at: +WD.now(), actor: 'Priya Raman', text: 'Moved to stop ' + j.seq }); flashId = j.id; WD.changed();
  ui.banner({ title: 'Priya Raman', text: 'Moved ' + j.title + ' to stop ' + j.seq + ' on ' + q.routeName(j.routeId), icon: 'calendar', color: q.routeColor(j.routeId), onTap: () => jobsScreen().openDetails && jobsScreen().openDetails(j.id) });
});
const go = mode => () => { S.board.mode = mode; S.board.day = D.today(); keep(null, 0); WD.nav.switchTab('board'); refresh(); };
WD.panel.addJump('Board: routes', go('routes')); WD.panel.addJump('Board: one route', go('days')); WD.panel.addJump('Month', go('month'));
})();
