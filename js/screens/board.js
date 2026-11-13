/* Dispatch board: routes side by side for one day, one route across days, and a month overview.
   Drag a job to change its time or reassign it; tap empty time to add a job. */
(function () {
'use strict';
const { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const START = 6 * 60, END = 19 * 60, GUTTER = 46, PAD = 10;
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
.bd-mode .segmented { width: 204px; flex: none; }
.bd-pill { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 10px; border-radius: 16px; border: 0; background: var(--fill3); color: var(--label); font-size: 14px; font-weight: 500; letter-spacing: -.15px; cursor: pointer; max-width: 150px; }
.bd-pill span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd-strip { flex: none; display: flex; align-items: center; gap: 6px; padding: 6px 14px; font-size: 13px; font-weight: 500; letter-spacing: -.08px; cursor: pointer; background: color-mix(in srgb, var(--c) 14%, var(--cell)); color: var(--c); border-top: .5px solid var(--sep); }
.bd-strip .spacer { flex: 1; }
.bd-scroll { flex: 1; min-height: 0; overflow: auto; position: relative; background: var(--cell); border-top: .5px solid var(--sep); scrollbar-width: none; overscroll-behavior: contain; }
.bd-scroll::-webkit-scrollbar { display: none; }
.bd-content { position: relative; min-width: 100%; }
.bd-head { position: sticky; top: 0; z-index: 4; background: var(--cell); border-bottom: .5px solid var(--sep); }
.bd-hrow { display: flex; }
.bd-corner { position: sticky; left: 0; z-index: 5; flex: none; background: var(--cell); font-size: 10px; color: var(--label2); text-align: right; padding: 3px 6px 0 0; letter-spacing: 0; }
.bd-colhead { flex: none; padding: 6px 6px 5px; font-size: 13px; line-height: 16px; font-weight: 600; letter-spacing: -.1px; display: flex; align-items: center; gap: 5px; border-left: .5px solid var(--sep); min-width: 0; }
.bd-colhead span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd-colhead.today span.n { color: var(--red); }
.bd-colhead .dot { width: 8px; height: 8px; }
.bd-allday { flex: none; padding: 0 1.500px 2px; border-left: .5px solid var(--sep); min-height: 3px; }
.bd-chip { margin-top: 2px; border-radius: 5px; background: color-mix(in srgb, var(--c) 22%, var(--cell)); color: var(--label); border-left: 3px solid var(--c); font-size: 11px; line-height: 14px; padding: 2px 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; letter-spacing: -.05px; }
.bd-body { display: flex; position: relative; }
.bd-gutter { position: sticky; left: 0; z-index: 3; flex: none; background: var(--cell); }
.bd-time { position: absolute; right: 6px; font-size: 11px; color: var(--label2); transform: translateY(-50%); white-space: nowrap; letter-spacing: 0; }
.bd-time.half { font-size: 10px; color: var(--label3); }
.bd-nowdot { position: absolute; right: -4px; width: 8px; height: 8px; margin-top: -3px; border-radius: 50%; background: var(--red); z-index: 4; }
.bd-col { flex: none; position: relative; border-left: .5px solid var(--sep); }
.bd-col.past { background: color-mix(in srgb, var(--fill3) 45%, transparent); }
.bd-line { position: absolute; left: 0; right: 0; height: .5px; background: var(--sep); pointer-events: none; }
.bd-line.half { opacity: .45; }
.bd-now { position: absolute; left: 0; right: 0; height: 1.500px; background: var(--red); z-index: 2; pointer-events: none; }
.bd-job { position: absolute; padding: 1px 1.500px; cursor: pointer; }
.bd-job-in { height: 100%; border-radius: 6px; background: var(--c); color: #fff; padding: 2px 4px 2px 8px; overflow: hidden; position: relative; font-size: 12px; line-height: 14px; letter-spacing: -.1px; box-shadow: inset 4px 0 0 var(--ring, rgba(255,255,255,.28)); transition: opacity .2s; }
.bd-job-title { font-weight: 600; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lines, 1); word-break: break-word; }
.bd-job-title .ic { margin: -2px 2px 0 0; }
.bd-job-sub { font-size: 10.500px; line-height: 13px; opacity: .92; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0; }
.bd-q { display: inline-block; background: #fff; color: #FF3B30; font-weight: 800; border-radius: 4px; padding: 0 4px; margin-right: 3px; font-size: 11px; line-height: 13px; }
.bd-job.completed .bd-job-in, .bd-job.skipped .bd-job-in { opacity: .5; }
.bd-job.skipped .bd-job-title { text-decoration: line-through; }
.bd-job.arrived .bd-job-in { outline: 2px solid var(--label); outline-offset: -2px; }
.bd-job.pending .bd-job-in { background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.2) 0 6px, transparent 6px 12px); }
.bd-job.dragging .bd-job-in { opacity: .3; }
.bd-job.flash .bd-job-in { animation: bd-flash 1.800s ease-out; }
@keyframes bd-flash { 0%, 40% { box-shadow: 0 0 0 4px var(--yellow), inset 4px 0 0 var(--ring, rgba(255,255,255,.28)); transform: scale(1.04); } 100% { transform: none; } }
.bd-ghost { z-index: 10; pointer-events: none; }
.bd-ghost .bd-job-in { box-shadow: 0 10px 26px rgba(0,0,0,.35), inset 4px 0 0 var(--ring, rgba(255,255,255,.28)); transform: scale(1.03); opacity: .95; }
.bd-month { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--cell); border-top: .5px solid var(--sep); }
.bd-mhead { display: grid; grid-template-columns: repeat(7, 1fr); font-size: 11px; color: var(--label2); text-align: center; padding: 4px 0; flex: none; letter-spacing: 0; }
.bd-week { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(7, 1fr); border-top: .5px solid var(--sep); }
.bd-mday { min-width: 0; padding: 2px 1px; cursor: pointer; overflow: hidden; }
.bd-mday.other { opacity: .35; }
.bd-mday.sel { background: var(--fill3); }
.bd-mnum { width: 22px; height: 22px; margin: 0 auto 1px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; letter-spacing: 0; }
.bd-mday.today .bd-mnum { background: var(--red); color: #fff; font-weight: 600; }
.bd-mev { font-size: 9px; line-height: 12px; letter-spacing: 0; white-space: nowrap; overflow: hidden; border-radius: 3px; padding: 0 2px; margin-top: 1px; background: color-mix(in srgb, var(--c) 24%, var(--cell)); border-left: 2px solid var(--c); }
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

let page = null, scroller = null, saved = { top: null, left: 0 }, layout = { cols: [], colW: 100 }, drag = null, flashId = null;
const Y = m => PAD + (m - START) / 60 * S.board.hourH;
const boardSort = (a, b) => (b.allDay - a.allDay) || (a.start - b.start) || a.id.localeCompare(b.id, undefined, { numeric: true });
const jobsScreen = () => WD.screens.jobs || {};

function columns() {
  const b = S.board;
  if (b.mode === 'days') return Array.from({ length: b.dayCount }, (_, i) => { const day = D.add(b.day, i); return { routeId: b.routeId, day, title: fmt.day(day, 'weekday') + ' ' + D.parse(day).getDate(), today: day === D.today() }; });
  return q.visibleRoutes().map(r => ({ routeId: r.id, day: b.day, title: q.routeName(r), color: q.routeColor(r), today: b.day === D.today() }));
}
function step(n) { const b = S.board; if (b.mode === 'month') { const d = D.parse(b.day); d.setDate(1); d.setMonth(d.getMonth() + n); b.day = D.key(d); } else b.day = D.add(b.day, n); keep(undefined, 0); refresh(); }
/** Choose the scroll position for the next render (undefined = stay where we are, null = jump to now). */
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
    btn('filter', 'Board menu', boardMenu),
    h('div.bd-date', btn('chevron.left', 'Previous', () => step(-1), icon('chevron.left', 20)),
      h('button.t', { 'aria-label': 'Go to date', onclick: pickDate }, h('b', title), sub && h('small' + (b.day === today ? '.today' : ''), sub)),
      btn('chevron.right', 'Next', () => step(1), icon('chevron.right', 20))),
    btn('magnifyingglass', 'Search', () => jobsScreen().openSearch && jobsScreen().openSearch()),
    btn(null, 'Today', () => { b.day = today; keep(null); refresh(); }, h('span.bd-today', D.parse(today).getDate())),
    WD.can('jobs.edit') && btn('plus', 'New job', () => jobsScreen().openEditor && jobsScreen().openEditor({ day: b.day, routeId: b.mode === 'days' ? b.routeId : (q.visibleRoutes()[0] || q.routes()[0]).id })));
}
function boardMenu(anchor) {
  const b = S.board, n = S.pending.length;
  ui.menu(anchor, [
    { header: S.org.name + ' · routes on the board' },
    ...q.routes().map(r => ({ label: q.routeName(r), checked: r.visible, onTap: () => { r.visible = !r.visible; WD.changed(); } })),
    'divider',
    WD.can('jobs.edit') && { label: 'AutoRoute a route…', icon: 'sparkles', onTap: () => jobsScreen().openAutoRoute && jobsScreen().openAutoRoute() },
    { label: 'Pending changes' + (n ? ' (' + n + ')' : ''), icon: 'sync', onTap: () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending() },
    { label: 'Refresh', icon: 'arrow.clockwise', onTap: async () => { if (S.offline) return ui.toast('Offline — showing saved jobs', 'wifi.slash'); ui.toast('Checking for changes…'); await WD.delay(900, 1400); ui.toast('Up to date', 'checkmark'); } },
    'divider',
    { label: 'Fit whole day', icon: 'arrow.up.right', onTap: () => { b.hourH = fitHeight(); keep(0); refresh(); } },
    { label: 'Zoom in', icon: 'plus', onTap: () => zoomTo(b.hourH * 1.35) }, { label: 'Zoom out', icon: 'minus', onTap: () => zoomTo(b.hourH / 1.35) },
  ]);
}
function modeRow() {
  const b = S.board, route = q.route(b.routeId);
  const pill = b.mode === 'days'
    ? h('button.bd-pill', { onclick: e => ui.menu(e.currentTarget, [{ header: 'Route' }, ...q.routes().map(r => ({ label: q.routeName(r), checked: r.id === b.routeId, onTap: () => { b.routeId = r.id; refresh(); } })), 'divider',
        { label: 'Show 1 day', checked: b.dayCount === 1, onTap: () => { b.dayCount = 1; refresh(); } }, { label: 'Show 3 days', checked: b.dayCount === 3, onTap: () => { b.dayCount = 3; refresh(); } }]) },
        ui.dot(q.routeColor(route)), h('span.n', q.routeName(route)), icon('chevron.down', 13))
    : h('button.bd-pill', { onclick: e => boardMenu(e.currentTarget) }, h('span.n', q.visibleRoutes().length + ' of ' + q.routes().length + ' routes'), icon('chevron.down', 13));
  return h('div.bd-mode', ui.segmented([{ value: 'routes', label: 'Routes' }, { value: 'days', label: 'Days' }, { value: 'month', label: 'Month' }], b.mode, v => { b.mode = v; keep(undefined, 0); refresh(); }), pill);
}
function statusStrip() {
  const conflicts = S.pending.filter(o => o.status === 'conflict').length, n = S.pending.length;
  if (!S.offline && !n) return null;
  const open = () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending();
  if (conflicts) return h('div.bd-strip', { style: { '--c': 'var(--red)' }, onclick: open }, icon('exclamationmark.triangle', 16), conflicts + (conflicts === 1 ? ' change needs' : ' changes need') + ' review', h('span.spacer'), 'Review', icon('chevron.right', 13));
  if (S.offline) return h('div.bd-strip', { style: { '--c': 'var(--orange)' }, onclick: open }, icon('wifi.slash', 16), n ? 'Offline · ' + n + (n === 1 ? ' change' : ' changes') + ' saved on this iPhone' : 'Offline · showing saved jobs', h('span.spacer'), n ? icon('chevron.right', 13) : null);
  return h('div.bd-strip', { style: { '--c': 'var(--gray)' }, onclick: open }, ui.spinner(14), 'Syncing ' + n + (n === 1 ? ' change…' : ' changes…'));
}

/* ---------- Timeline grid ---------- */
function fitHeight() { const head = scroller ? scroller.querySelector('.bd-head') : null, avail = (scroller ? scroller.clientHeight : 560) - (head ? head.offsetHeight : 30) - PAD * 2 - 2; return Math.max(30, avail / ((END - START) / 60)); }
function zoomTo(v, anchorY) {
  const b = S.board, old = b.hourH, head = scroller.querySelector('.bd-head').offsetHeight, y = anchorY == null ? scroller.clientHeight / 2 : anchorY;
  const next = clamp(v, fitHeight(), 170); if (Math.abs(next - old) < .2) return;
  const t = (scroller.scrollTop + y - head - PAD) / old; b.hourH = next;
  saved = { top: Math.max(0, t * next + head + PAD - y), left: scroller.scrollLeft }; scroller = null; refresh();
}
function lanes(jobs) {
  const out = []; let group = [], groupEnd = -1;
  const flush = () => { const ends = [], lane = new Map(); group.forEach(j => { let i = ends.findIndex(e => e <= j.start); if (i < 0) { i = ends.length; ends.push(0); } ends[i] = j.start + Math.max(j.dur, 20); lane.set(j, i); }); group.forEach(j => out.push({ job: j, lane: lane.get(j), count: ends.length })); group = []; };
  jobs.forEach(j => { if (group.length && j.start >= groupEnd) flush(); group.push(j); groupEnd = Math.max(groupEnd, j.start + Math.max(j.dur, 20)); });
  if (group.length) flush(); return out;
}
function cell(job, lane, count) {
  const hH = S.board.hourH, type = q.jobType(job.type), height = Math.max(job.dur / 60 * hH, 19), lines = Math.max(1, Math.floor((height - 5 - (height > 44 ? 13 : 0)) / 14));
  const st = { enroute: 'truck', arrived: 'mappin', completed: 'checkmark', skipped: 'xmark' }[job.status];
  const sub = job.eta ? 'ETA ' + fmt.time(job.eta.from, true) + '–' + fmt.time(job.eta.to) : fmt.time(job.start, true) + '–' + fmt.time(job.start + job.dur);
  const el = h('div.bd-job.' + job.status + (job.pending ? '.pending' : '') + (drag && drag.job.id === job.id ? '.dragging' : '') + (flashId === job.id ? '.flash' : ''),
    { 'data-job': job.id, style: { top: Y(job.start) + 'px', height: height + 'px', left: lane / count * 100 + '%', width: 100 / count + '%', '--c': q.routeColor(job.routeId), '--ring': type.color } },
    h('div.bd-job-in', h('div.bd-job-title', { style: { '--lines': Math.min(lines, 3) } }, !job.located && job.address && job.type !== 'meet' ? h('span.bd-q', '?') : null, st && icon(st, 12), job.pending && icon('sync', 11), job.title, job.recurring && height > 30 ? h('span', { style: 'opacity:.8;font-weight:400' }, ' ↻') : null),
      height > 44 && h('div.bd-job-sub', sub), height > 76 && job.address && h('div.bd-job-sub', job.address.split(',')[0])));
  return el;
}
function grid() {
  const b = S.board, cols = columns(), W = page.body.clientWidth || 393, hH = b.hourH, total = (END - START) / 60 * hH + PAD * 2;
  if (!cols.length) return h('div', { style: 'flex:1;background:var(--cell);border-top:.5px solid var(--sep)' }, ui.empty({ icon: 'columns', title: 'No routes selected', text: 'Choose which routes appear on the board.', action: ui.button('Choose routes', { kind: 'tinted', block: false, small: true, onTap: (e, el) => boardMenu(el) }) }));
  const colW = Math.floor((W - GUTTER) / Math.min(cols.length, 3)), showHead = cols.length > 1, today = D.today(), now = WD.nowMins();
  layout = { cols, colW };
  const allDay = cols.map(c => q.jobsFor(c.routeId, c.day).filter(j => j.allDay));
  const head = h('div.bd-head',
    showHead && h('div.bd-hrow', h('div.bd-corner', { style: { width: GUTTER + 'px' } }), cols.map(c => h('div.bd-colhead' + (c.today && b.mode === 'days' ? '.today' : ''), { style: { width: colW + 'px' } }, c.color && ui.dot(c.color), h('span.n', c.title)))),
    h('div.bd-hrow', h('div.bd-corner', { style: { width: GUTTER + 'px' } }, allDay.some(a => a.length) ? 'all-day' : ''), cols.map((c, i) => h('div.bd-allday', { style: { width: colW + 'px' } },
      allDay[i].map(j => h('div.bd-chip', { style: { '--c': q.routeColor(j.routeId) }, onclick: () => jobsScreen().openDetails && jobsScreen().openDetails(j.id) }, j.title))))));
  const half = hH / 2 >= 21, gutter = h('div.bd-gutter', { style: { width: GUTTER + 'px', height: total + 'px' } });
  for (let m = START; m <= END; m += half ? 30 : 60) gutter.appendChild(h('div.bd-time' + (m % 60 ? '.half' : ''), { style: { top: Y(m) + 'px' } }, m % 60 ? ':30' : fmt.time(m).replace(':00', '')));
  if (cols.some(c => c.today) && now >= START && now <= END) gutter.appendChild(h('div.bd-nowdot', { style: { top: Y(now) + 'px' } }));
  const body = h('div.bd-body', { style: { height: total + 'px' } }, gutter, cols.map((c, i) => {
    const col = h('div.bd-col' + (c.day < today ? '.past' : ''), { 'data-i': i, style: { width: colW + 'px', height: total + 'px' } });
    for (let m = START; m <= END; m += half ? 30 : 60) col.appendChild(h('div.bd-line' + (m % 60 ? '.half' : ''), { style: { top: Y(m) + 'px' } }));
    if (c.today && now >= START && now <= END) col.appendChild(h('div.bd-now', { style: { top: Y(now) + 'px' } }));
    lanes(q.jobsFor(c.routeId, c.day).filter(j => !j.allDay)).forEach(x => col.appendChild(cell(x.job, x.lane, x.count)));
    return col;
  }));
  const el = scroller = h('div.bd-scroll', h('div.bd-content', { style: { width: GUTTER + colW * cols.length + 'px' } }, head, body));
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomTo(S.board.hourH * Math.exp(-e.deltaY * 0.012), ui.localPoint(e, el).y); }, { passive: false });
  let gestureBase = 0; el.addEventListener('gesturestart', e => { e.preventDefault(); gestureBase = S.board.hourH; });
  el.addEventListener('gesturechange', e => { e.preventDefault(); zoomTo(gestureBase * e.scale); });
  el.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
  const top = saved.top, left = saved.left;
  requestAnimationFrame(() => { if (!el.isConnected) return; el.scrollTop = top == null ? Math.max(0, Y(b.day === today ? now - 100 : 7 * 60 + 30)) : top; el.scrollLeft = left; if (drag) { el.querySelector('.bd-body').appendChild(drag.ghost); dragMove(drag.last); } });
  if (flashId) setTimeout(() => { flashId = null; }, 1900);
  return el;
}

/* ---------- Tap, swipe and drag ---------- */
function onPointerDown(e) {
  if (e.button > 0 || e.target.closest('.bd-chip') || drag) return;
  const cellEl = e.target.closest('.bd-job'), colEl = e.target.closest('.bd-col'), sx = e.clientX, sy = e.clientY, touch = e.pointerType === 'touch', el = scroller;
  const job = cellEl && q.job(cellEl.dataset.job), canDrag = job && WD.can('jobs.edit') && !job.pending && (job.status === 'scheduled' || job.status === 'enroute');
  let moved = false, active = false, timer = null;
  const begin = ev => { active = true; startDrag(job, cellEl, ev); };
  if (canDrag && touch) timer = setTimeout(() => begin(e), 380);
  const move = ev => {
    if (!active && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) { moved = true; if (touch) clearTimeout(timer); else if (canDrag) begin(ev); }
    if (active) { ev.preventDefault(); dragMove(ev); }
  };
  const cleanup = () => { clearTimeout(timer); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); };
  const up = ev => {
    cleanup(); if (active) return dragEnd();
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moved) { if (job) jobsScreen().openDetails && jobsScreen().openDetails(job.id); else if (colEl && WD.can('jobs.edit')) tapEmpty(ev, colEl); }
    else if (!job && Math.abs(dx) > 70 && Math.abs(dy) < 45 && (dx < 0 ? el.scrollLeft >= el.scrollWidth - el.clientWidth - 2 : el.scrollLeft <= 2)) step(dx < 0 ? 1 : -1);
  };
  const cancel = () => { cleanup(); if (active) { drag.ghost.remove(); drag = null; refresh(); } };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
}
function tapEmpty(ev, colEl) {
  const c = layout.cols[+colEl.dataset.i], y = ui.localPoint(ev, colEl).y, m = clamp(Math.floor((START + (y - PAD) / S.board.hourH * 60) / 30) * 30, START, END - 30);
  jobsScreen().openEditor && jobsScreen().openEditor({ day: c.day, routeId: c.routeId, start: m });
}
function startDrag(job, cellEl, ev) {
  const type = q.jobType(job.type), when = h('div.bd-job-sub');
  const ghost = h('div.bd-job.bd-ghost', { style: { '--c': q.routeColor(job.routeId), '--ring': type.color } }, h('div.bd-job-in', h('div.bd-job-title', job.title), when));
  drag = { job, ghost, when, grabY: ui.localPoint(ev, cellEl).y, last: ev, target: null, edge: 0, edgeAt: 0 };
  cellEl.classList.add('dragging'); scroller.querySelector('.bd-body').appendChild(ghost); dragMove(ev); autoScroll();
}
function dragMove(ev) {
  if (!drag || !scroller) return; drag.last = ev;
  const body = scroller.querySelector('.bd-body'), { cols, colW } = layout, job = drag.job, p = ui.localPoint(ev, body);
  const i = clamp(Math.floor((p.x - GUTTER) / colW), 0, cols.length - 1), m = clamp(Math.round((START + (p.y - PAD - drag.grabY) / S.board.hourH * 60) / 15) * 15, START, END - job.dur);
  drag.target = { routeId: cols[i].routeId, day: cols[i].day, start: m };
  Object.assign(drag.ghost.style, { left: GUTTER + i * colW + 'px', width: colW + 'px', top: Y(m) + 'px', height: Math.max(job.dur / 60 * S.board.hourH, 30) + 'px' });
  drag.ghost.style.setProperty('--c', q.routeColor(cols[i].routeId));
  drag.when.textContent = fmt.time(m) + (cols[i].routeId !== job.routeId ? ' · ' + q.routeName(cols[i].routeId) : cols[i].day !== job.day ? ' · ' + fmt.day(cols[i].day) : '');
}
function autoScroll() {
  if (!drag) return;
  const el = scroller, ev = drag.last;
  if (el && ev) {
    const p = ui.localPoint(ev, el), headH = el.querySelector('.bd-head').offsetHeight, t = Date.now();
    if (p.y > el.clientHeight - 44) el.scrollTop += 9; else if (p.y < headH + 36) el.scrollTop -= 9;
    const side = p.x > el.clientWidth - 24 ? 1 : p.x < GUTTER + 14 ? -1 : 0, canScroll = side > 0 ? el.scrollLeft < el.scrollWidth - el.clientWidth - 1 : side < 0 ? el.scrollLeft > 0 : false;
    if (side && canScroll) { el.scrollLeft += side * 9; drag.edge = 0; }
    else if (side) { if (drag.edge !== side) { drag.edge = side; drag.edgeAt = t; } else if (t - drag.edgeAt > 850) { drag.edgeAt = t; S.board.day = D.add(S.board.day, side); saved = { top: el.scrollTop, left: el.scrollLeft }; scroller = null; refresh(); } }
    else drag.edge = 0;
    if (scroller) dragMove(ev);
  }
  requestAnimationFrame(autoScroll);
}
function dragEnd() { const { job, target, ghost } = drag; ghost.remove(); drag = null; refresh(); if (target) dropped(job, target); }

const SCOPES = ['This job', 'This and following jobs', 'All jobs'];
/** Other occurrences of a recurring job covered by a scope (excluding the job itself). */
function seriesJobs(job, scope) {
  if (!job.recurring || scope === 'This job' || !scope) return [];
  return data.jobs.filter(j => j !== job && j.recurring && j.recurring.seriesId === job.recurring.seriesId && j.status === 'scheduled' && (scope === 'All jobs' || j.day > job.day));
}
WD.boardHelpers = { SCOPES, seriesJobs };
async function dropped(job, t) {
  const routeChanged = t.routeId !== job.routeId, dayChanged = t.day !== job.day; if (!routeChanged && !dayChanged && t.start === job.start) return;
  const when = fmt.day(t.day) + ' at ' + fmt.time(t.start), me = S.me.name;
  const others = q.jobsFor(t.routeId, t.day).filter(j => j.id !== job.id && !j.allDay && j.status === 'scheduled'), shifts = [];
  if (S.board.pushDown) { let cursor = t.start + job.dur; others.filter(j => j.start + j.dur > t.start).forEach(j => { if (j.start < cursor) { shifts.push({ job: j, start: cursor }); cursor += j.dur; } else cursor = Math.max(cursor, j.start + j.dur); }); }
  let scope, kind = 'edit';
  if (routeChanged) { kind = 'reassign';
    scope = await ui.actionSheet({ title: 'Reassign ' + job.title + ' to ' + q.routeName(t.routeId) + '?', message: when + '. The job keeps its duration.' + (shifts.length ? ' ' + shifts.length + ' overlapping job(s) on that route will shift later.' : ''), buttons: job.recurring ? SCOPES.map(s => ({ label: s })) : [{ label: 'Reassign job', value: 'This job' }] });
  } else if (shifts.length) { kind = 'batch';
    scope = await ui.actionSheet({ title: 'Move job and shift overlapping jobs?', message: 'Move ' + job.title + ' to ' + when + ' and shift ' + shifts.length + ' job(s) later. Durations stay the same. Only these occurrences change.', buttons: [{ label: 'Move and shift jobs', value: 'This job' }] });
  } else scope = await ui.actionSheet({ title: 'Change job time?', message: when, buttons: job.recurring && !dayChanged ? [{ label: 'This job' }, { label: 'All jobs' }] : [{ label: 'Change time', value: 'This job' }] });
  if (!scope) return;
  const series = seriesJobs(job, scope);
  api.op({ kind, title: job.title, scope: shifts.length && !routeChanged ? 'Grouped schedule change · ' + (shifts.length + 1) + ' jobs' : scope, jobIds: [job.id, ...shifts.map(s => s.job.id), ...series.map(j => j.id)], apply() {
    const from = job.start; job.routeId = t.routeId; job.day = t.day; job.start = t.start; if (job.eta) job.eta = null;
    job.events.push({ at: +WD.now(), actor: me, text: routeChanged ? 'Reassigned to ' + q.routeName(t.routeId) + ' · ' + fmt.time(t.start) : 'Moved to ' + when });
    shifts.forEach(s => { s.job.start = s.start; s.job.events.push({ at: +WD.now(), actor: me, text: 'Shifted to ' + fmt.time(s.start) + ' (push down)' }); });
    series.forEach(j => { if (routeChanged) j.routeId = t.routeId; j.start += t.start - from; });
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
      h('div.bd-mnum', D.parse(day).getDate()), jobs.slice(0, 4).map(j => h('div.bd-mev', { style: { '--c': q.routeColor(j.routeId) } }, j.title)), jobs.length > 4 && h('div.bd-more', '+' + (jobs.length - 4) + ' more'));
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
  if (!b.hourH) b.hourH = 66;
  if (scroller && scroller.isConnected) saved = { top: scroller.scrollTop, left: scroller.scrollLeft };
  if (!q.route(b.routeId)) { const mine = data.routes.find(r => r.driverId === S.me.id); b.routeId = (mine || q.visibleRoutes()[0] || q.routes()[0]).id; }
  return [topBar(), modeRow(), statusStrip(), b.mode === 'month' ? monthView() : grid()];
}
WD.screens.board = {
  root: () => ({ title: 'Dispatch', navbar: false, noScroll: true, live: false, render, onChange: p => { if (!drag) p.refresh(); }, onReappear: p => p.refresh() }),
  /** Show a day (and optionally one job, highlighted) on the board. */
  show(day, jobId) { S.board.day = day; if (S.board.mode === 'month') S.board.mode = 'routes'; keep(null); flashId = jobId || null; const j = jobId && q.job(jobId); if (j) { const r = q.route(j.routeId); if (r && !r.visible) r.visible = true; if (!j.allDay) keep(Math.max(0, Y(j.start) - 120)); } WD.nav.switchTab('board'); refresh(); },
};
WD.on('minute', () => { if (!drag && WD.nav.activeTab() === 'board' && S.board.mode !== 'month') refresh(); });

WD.panel.addAction('Live update: dispatcher moves a job', () => {
  const j = data.jobs.filter(x => x.day === D.today() && x.status === 'scheduled' && !x.allDay && !x.pending && q.route(x.routeId).visible).sort((a, b) => a.start - b.start)[1]; if (!j) return;
  j.start += 30; j.version++; j.events.push({ at: +WD.now(), actor: 'Priya Raman', text: 'Moved to ' + fmt.time(j.start) }); flashId = j.id; WD.changed();
  ui.banner({ title: 'Priya Raman', text: 'Moved ' + j.title + ' to ' + fmt.time(j.start) + ' on ' + q.routeName(j.routeId), icon: 'calendar', color: q.routeColor(j.routeId), onTap: () => jobsScreen().openDetails && jobsScreen().openDetails(j.id) });
});
const go = mode => () => { S.board.mode = mode; S.board.day = D.today(); keep(null, 0); WD.nav.switchTab('board'); refresh(); };
WD.panel.addJump('Board: routes', go('routes')); WD.panel.addJump('Board: one route', go('days')); WD.panel.addJump('Month', go('month'));
})();
