/* RouteClerk prototype — the month plan (`WD.areas`).
   Dispatch → Month shows the plan for each day instead of every job: who has time off, weekend jobs such as shred events, and the areas
   each route will be in ("Marlow / Cedar Falls"). The areas are worked out from the towns of that day's stops; a day further out than
   the loaded jobs takes them from the route's repeating stops on the same weekday. Anyone who can change the schedule can rename an
   area, for one day or for that day and every later one it repeats on, and can add an area to a day that has none.
   An edit is a rule in `data.areaPlan`: {id, name, routeId, every (0 one time, 1, 2 or 4 weeks), day (first day), until (last day,
   optional), skip: [days]}. A rule replaces the automatic area of its route on the days it covers. Everything is a mock; nothing is saved. */
(function () {
'use strict';
const WD = window.WD, { h, ui, state: S, data, q, fmt, date: D } = WD, A = WD.areas = {};

WD.css(`
.ar-rep { font-size: 13px; color: var(--label2); padding: 0 16px 10px; }
.ar-auto { font-size: 12px; font-weight: 600; color: var(--label2); }
`);

const REPEATS = [{ value: 0, label: 'One time' }, { value: 1, label: 'Every week' }, { value: 2, label: 'Every 2 weeks' }, { value: 4, label: 'Every 4 weeks' }];
const WKL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const canEdit = () => WD.can('jobs.edit'), uid = () => 'ar' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
const wk = day => WKL[D.parse(day).getDay()], weekend = day => [0, 6].includes(D.parse(day).getDay());
const repeatText = r => r.every ? (REPEATS.find(x => x.value === r.every) || REPEATS[1]).label + ' on ' + wk(r.day) : 'One time';
const plan = () => data.areaPlan || (data.areaPlan = []);

/* ---------- Automatic areas, from the stops ---------- */
/** The town a job is in: the last part of its address that isn't a state or ZIP, else the city typed for a meet-the-truck job. */
A.townOf = j => { const parts = String(j.address || '').split(',').map(s => s.trim()).filter(Boolean); while (parts.length > 1 && /^([A-Za-z]{2})?\s*\d{5}(-\d{4})?$|^[A-Z]{2}$/.test(parts[parts.length - 1])) parts.pop();
  if (parts.length > 1) return parts[parts.length - 1]; const cz = String(j.cityZip || '').replace(/[\d-]+/g, '').replace(/,.*$/, '').trim(); return cz || null; };
const stops = (rid, day) => q.jobsFor(rid, day).filter(j => !j.allDay && !WD.calledOff(j));
let hz = { n: -1, day: '' };
/** The last day jobs are loaded for; later days are projected from the repeating stops. */
const horizon = () => { if (hz.n !== data.jobs.length || hz.of !== data.jobs) hz = { n: data.jobs.length, of: data.jobs, day: data.jobs.reduce((m, j) => j.day > m ? j.day : m, '') }; return hz.day; };
/** A route's area for a day, from its stops: up to three towns, the one with the most stops first. null when the route has nothing that day. */
A.auto = (rid, day) => { let list = stops(rid, day);
  if (!list.length && day > horizon()) for (let k = 1; k <= 8 && !list.length; k++) { const src = D.add(day, -7 * k); if (src <= horizon()) list = stops(rid, src).filter(j => j.recurring); }
  const n = {}; list.forEach(j => { const t = A.townOf(j); if (t) n[t] = (n[t] || 0) + 1; });
  const towns = Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b)); return towns.length ? towns.slice(0, 3).join(' / ') : null; };
/** How often a route comes back to the same area on this weekday: 1, 2 or 4 weeks, or 0 when it doesn't repeat. */
const cadence = (rid, day) => { const same = n => n && n.split(' / ').sort().join(), name = same(A.auto(rid, day)); if (!name) return 1; const hit = [1, 2, 4].find(n => same(A.auto(rid, D.add(day, 7 * n))) === name); return hit || (stops(rid, day).some(j => j.recurring) ? 1 : 0); };

/* ---------- The plan for a day ---------- */
const hits = (r, day) => day >= r.day && (!r.until || day <= r.until) && !(r.skip || []).includes(day) && (r.every ? D.diff(day, r.day) % (7 * r.every) === 0 : r.day === day);
/** The areas for a day on the given routes (every route when none are given), in route order:
    [{routeId, name, color, rule (the edit behind it) | auto: true}]. An edit replaces its route's automatic area. */
A.on = (day, routeIds) => { const out = [];
  q.routes().filter(r => !routeIds || routeIds.includes(r.id)).forEach(r => { const rules = plan().filter(x => x.routeId === r.id && hits(x, day)), color = q.routeColor(r.id);
    if (rules.length) rules.forEach(x => out.push({ routeId: r.id, name: x.name, color, rule: x })); else { const name = A.auto(r.id, day); if (name) out.push({ routeId: r.id, name, color, auto: true }); } });
  return out; };
/** Time off on a day, approved or still waiting: [{t, name, pending}]. */
A.off = day => (data.timeOff || []).filter(t => t.status !== 'denied' && t.from <= day && day <= t.to).map(t => ({ t, name: ((q.user(t.userId) || {}).name || 'Someone').split(' ')[0], pending: t.status !== 'approved' }));
/** Weekend jobs that aren't a route's repeating stops: shred events, purges and other one-offs. */
A.specials = (day, routeIds) => !weekend(day) ? [] : q.jobsOn(day).filter(j => !j.allDay && !j.recurring && !WD.calledOff(j) && (!routeIds || routeIds.includes(j.routeId))).sort(q.order);

/* ---------- Editing ---------- */
/** Change the area of a route on a day, or add one. entry: one item of A.on(day), or null to add. */
function editor(entry, day, done) {
  const rule = entry && entry.rule, isAdd = !entry, was = entry ? entry.name : '';
  const f = { name: was, routeId: entry ? entry.routeId : (q.visibleRoutes()[0] || q.routes()[0] || {}).id || null, every: rule ? rule.every : entry ? cadence(entry.routeId, day) : 0, scope: 'future' };
  const split = !!rule && rule.every > 0;   // an edit that already repeats: change this day, or this day and the later ones
  const names = [...new Set(plan().map(r => r.name).concat(q.routes().map(r => A.auto(r.id, day)).filter(Boolean)))].sort();
  const save = p => { const name = f.name.trim(); if (!name) return ui.toast('Enter the area', 'map');
    if (split) {
      if (f.scope === 'day') { rule.skip = (rule.skip || []).concat(day); plan().push({ id: uid(), name, routeId: rule.routeId, every: 0, day, skip: [] }); }
      else if (day === rule.day) rule.name = name;
      else { rule.until = D.add(day, -1); plan().push({ id: uid(), name, routeId: rule.routeId, every: rule.every, day, until: null, skip: (rule.skip || []).filter(d => d > day) }); }
    } else if (rule) Object.assign(rule, { name, every: f.every });
    else plan().push({ id: uid(), name, routeId: f.routeId, every: f.every, day, skip: [] });
    WD.changed(); p.dismiss(); done && done();
    ui.toast(isAdd ? 'Area added' : (split ? f.scope === 'future' : f.every) ? 'Changed for this and future ' + wk(day) + 's' : 'Changed for ' + fmt.day(day, 'md'), 'checkmark', 2000); };
  /* Taking an edit away puts the automatic area back. */
  const remove = async p => { const one = split && day !== rule.day ? await ui.actionSheet({ title: 'Go back to the automatic area?', message: rule.name + ' · ' + repeatText(rule), buttons: [{ label: 'This day only', value: 'day' }, { label: 'This and future ' + wk(day) + 's', value: 'future' }] }) : 'all';
    if (!one) return; if (one === 'day') rule.skip = (rule.skip || []).concat(day); else if (one === 'future') rule.until = D.add(day, -1); else data.areaPlan = plan().filter(r => r !== rule);
    WD.changed(); p.dismiss(); done && done(); };
  const autoNow = entry && A.auto(entry.routeId, day);
  ui.sheet({ title: isAdd ? 'Add an area' : 'Area', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: save }],
    render: p => ui.list(
      ui.section({ header: fmt.day(day, 'long') + (entry ? ' · ' + q.routeName(entry.routeId) : ''), fold: false, showFooter: true, footer: entry && entry.auto ? 'Worked out from the towns of that day’s stops. Change it to the name your team uses, such as “Lakemont Day”.' : 'A town, a group of towns, or a name your team uses, such as “Lakemont Day”.' },
        ui.inputRow({ label: 'Area', placeholder: 'e.g. Marlow / Cedar Falls', value: f.name, caps: 'words', autofocus: isAdd, onInput: v => { f.name = v; } }),
        isAdd && names.length > 0 && ui.pickerRow({ title: 'Or one already in the plan', placeholder: 'Choose', value: f.name, options: names, onChange: v => { f.name = v; p.refresh(); } })),
      isAdd && ui.section({ header: 'Route', fold: false, showFooter: true, footer: 'The area shows in the route’s color.' },
        ui.pickerRow({ title: 'Route', value: f.routeId, options: q.routes().map(r => ({ value: r.id, label: q.routeName(r) })), onChange: v => { f.routeId = v; p.refresh(); } })),
      split ? ui.section({ header: 'Apply to', fold: false }, h('div', { style: 'padding:8px 12px' }, ui.segmented([{ value: 'day', label: 'This day only' }, { value: 'future', label: 'This and future' }], f.scope, v => { f.scope = v; p.refresh(); })),
          h('div.ar-rep', f.scope === 'future' ? repeatText(rule) + ', from ' + fmt.day(day, 'md') + ' on' : 'Only ' + fmt.day(day, 'md') + '. The other days keep “' + rule.name + '”.'))
        : ui.section({ header: 'Apply to', fold: false }, h('div', { style: 'padding:8px 12px' }, ui.segmented([{ value: 0, label: 'This day' }, { value: 1, label: 'Weekly' }, { value: 2, label: '2 weeks' }, { value: 4, label: '4 weeks' }], f.every, v => { f.every = v; p.refresh(); })),
          h('div.ar-rep', f.every ? 'This and every future ' + wk(day) + (f.every > 1 ? ', every ' + f.every + ' weeks' : '') + ', from ' + fmt.day(day, 'md') + ' on' : 'Only ' + fmt.day(day, 'md'))),
      rule && ui.section(null, ui.row({ title: autoNow ? 'Back to automatic · ' + autoNow : 'Remove this area', center: true, destructive: !autoNow, tint: true, onTap: () => remove(p) }))) }, { detent: 'large' });
}

/** One day of the plan: time off, weekend jobs, each route's area, and the way into that day's jobs. */
A.openDay = (day, done) => {
  const sheet = ui.sheet({ title: fmt.day(day), leading: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
    render: p => { const list = A.on(day), off = A.off(day), sp = A.specials(day), again = () => { p.refresh(); done && done(); }, open = id => WD.screens.jobs && WD.screens.jobs.openDetails && WD.screens.jobs.openDetails(id);
      return ui.list(
        off.length > 0 && ui.section({ header: 'Time off', fold: false }, off.map(o => ui.row({ icon: 'person', iconColor: o.pending ? 'var(--orange)' : 'var(--gray)', title: (q.user(o.t.userId) || {}).name || o.name, subtitle: WD.timeOffLabel(o.t) + (o.t.reason ? ' · ' + o.t.reason : ''), badge: o.pending ? ui.badge('Requested', 'var(--orange)') : null }))),
        sp.length > 0 && ui.section({ header: 'Weekend jobs', fold: false }, sp.map(j => ui.row({ leading: h('span', { style: 'margin-right:12px' }, ui.dot(q.routeColor(j.routeId))), title: j.title, subtitle: q.routeName(j.routeId) + ' · ' + q.jobType(j.type).title, chevron: true, onTap: () => open(j.id) }))),
        ui.section({ header: 'Areas', fold: false, showFooter: true, footer: canEdit() ? 'Each route’s area comes from the towns of its stops that day. Tap one to rename it, for this day or for every time it repeats. Renaming moves no jobs.' : 'Only people who can change the schedule can change the plan.' },
          list.length ? list.map(a => ui.row({ leading: h('span', { style: 'margin-right:12px' }, ui.dot(a.color)), title: a.name, subtitle: q.routeName(a.routeId) + ' · ' + (a.auto ? 'Automatic' : 'Edited · ' + repeatText(a.rule)), chevron: canEdit(), onTap: canEdit() ? () => editor(a, day, again) : null }))
            : ui.row({ title: 'No route is out', subtitle: 'Nothing is scheduled for this day yet.', disabled: true }),
          canEdit() && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an area', tint: true, onTap: () => editor(null, day, again) })),
        ui.section(null, ui.row({ icon: 'calendar', iconPlain: true, title: 'Open this day’s jobs', subtitle: (n => n + (n === 1 ? ' job' : ' jobs') + ' on the routes showing')(q.jobsOn(day).filter(j => q.visibleRoutes().some(r => r.id === j.routeId)).length), tint: true, chevron: true,
          onTap: () => { sheet.close(); WD.screens.board.show(day); } }))); } }, { detent: 'large' });
};

/* ---------- Demo: two weekend shred events, so the month has weekend jobs to show ---------- */
(() => { if (!WD.makeJob || !q.route('r4') || (S.org && S.org.id && S.org.id !== 'o1')) return; const t = D.today(), dow = D.parse(t).getDay(), sat = D.add(t, ((6 - dow + 7) % 7) || 7);
  const ev = (day, title, address, x, y, notes) => WD.makeJob({ routeId: 'r4', day, dur: 180, title, type: 'meet', custType: 'business', address, cityZip: address.split(', ').pop(), located: true, x, y, notes, events: [{ at: +WD.now() - 9 * 864e5, actor: 'Colleen Abbott', text: 'Scheduled' }] });
  ev(sat, 'Shred event — Northgate Credit Union', '900 Northgate Blvd, Hartwell', 640, 180, 'Public shred day in the branch parking lot, 9 to noon. Bring the banner and the canopy.');
  ev(D.add(sat, 8), 'Shred event — Marlow Rotary Club', '615 Harbor Rd, Marlow', 660, 760, 'Community shred day, 10 to 1. Donations go to the Rotary scholarship fund.');
})();
})();
