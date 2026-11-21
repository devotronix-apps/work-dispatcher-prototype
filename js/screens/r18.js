/* RouteClerk prototype — the area plan (`WD.areas`).
   The overall scheduling plan: which areas are served on which days, without the jobs. It shows on Dispatch → Month when the calendar is
   switched from Jobs to Areas (the ellipsis menu, Month view only). An area belongs to a route and takes that route's color; it happens
   once, or repeats every 1, 2 or 4 weeks from its first day. Tapping a day lists its areas, where they can be added, changed or removed.
   Everything is a mock: the plan is seeded from the routes and nothing is saved. */
(function () {
'use strict';
const WD = window.WD, { h, ui, state: S, data, q, fmt, date: D } = WD, A = WD.areas = {};

WD.css(`
.ar-rep { font-size: 13px; color: var(--label2); padding: 0 16px 10px; }
`);

const REPEATS = [{ value: 0, label: 'One time' }, { value: 1, label: 'Every week' }, { value: 2, label: 'Every 2 weeks' }, { value: 4, label: 'Every 4 weeks' }];
const WKL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const canEdit = () => WD.can('jobs.edit'), uid = () => 'ar' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
const repeatText = r => r.every ? (REPEATS.find(x => x.value === r.every) || REPEATS[1]).label + ' on ' + WKL[D.parse(r.day).getDay()] : 'One time';

/** A plan that looks like a real one: a town or two per route on fixed weekdays, some weekly and some every 2 or 4 weeks. */
function seed() {
  const today = D.today(), sun = D.add(today, -D.parse(today).getDay()), R = q.routes(), rid = i => R.length ? R[i % R.length].id : null;
  const on = (dow, week) => D.add(sun, dow + 7 * week), mk = (name, route, every, day) => ({ id: uid() + name.length, name, routeId: rid(route), every, day, skip: [] });
  return [mk('Ridgeview / Pine Hollow', 0, 4, on(1, 0)), mk('Corliss', 1, 4, on(1, 1)), mk('Hartwell / Eastbrook', 2, 4, on(1, 1)), mk('Stockdale, Reed Valley', 2, 4, on(2, 3)),
    mk('Summit City', 1, 4, on(3, 0)), mk('Marlow, Cedar Falls', 0, 2, on(3, 1)), mk('Lakemont Day', 0, 1, on(4, 0)), mk('Purge runs', 3, 2, on(5, 1))];
}
const plan = () => data.areaPlan || (data.areaPlan = seed());

const hits = (r, day) => !(r.skip || []).includes(day) && (r.every ? (n => n % (7 * r.every) === 0)(D.diff(day, r.day)) : r.day === day);
/** The areas planned for a day on the given routes (all routes when none are given), in route order: [{rule, name, color}]. */
A.on = (day, routeIds) => { const order = q.routes().map(r => r.id);
  return plan().filter(r => hits(r, day) && (!routeIds || !r.routeId || routeIds.includes(r.routeId))).sort((a, b) => order.indexOf(a.routeId) - order.indexOf(b.routeId) || a.name.localeCompare(b.name))
    .map(r => ({ rule: r, name: r.name, color: r.routeId && q.route(r.routeId) ? q.routeColor(r.routeId) : '#8E8E93' })); };

/** Add an area, or change one. `day` is the day it was opened from: a repeating area keeps its weekday when only its name or route changes. */
function editor(rule, day, done) {
  const isNew = !rule, f = rule ? { name: rule.name, routeId: rule.routeId, every: rule.every } : { name: '', routeId: (q.visibleRoutes()[0] || q.routes()[0] || {}).id || null, every: 1 };
  const names = [...new Set(plan().map(r => r.name))].sort();
  const save = p => { const name = f.name.trim(); if (!name) return ui.toast('Enter the area', 'map');
    if (isNew) plan().push({ id: uid(), name, routeId: f.routeId, every: f.every, day, skip: [] });
    else { if (f.every !== rule.every) rule.day = day; Object.assign(rule, { name, routeId: f.routeId, every: f.every }); }
    WD.changed(); p.dismiss(); done && done(); ui.toast(isNew ? 'Area added' : 'Area changed', 'checkmark', 1400); };
  const remove = async p => { const one = rule.every ? await ui.actionSheet({ title: 'Remove ' + rule.name + '?', message: repeatText(rule), buttons: [{ label: 'This day only', value: 'day' }, { label: 'Every day it repeats', value: 'all', role: 'destructive' }] }) : 'all';
    if (!one) return; if (one === 'day') (rule.skip = rule.skip || []).push(day); else data.areaPlan = plan().filter(r => r !== rule);
    WD.changed(); p.dismiss(); done && done(); };
  ui.sheet({ title: isNew ? 'Add an area' : 'Area', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: save }],
    render: p => ui.list(
      ui.section({ header: fmt.day(day, 'long'), fold: false, showFooter: true, footer: 'A town, a group of towns, or a name your team uses, such as “Lakemont Day”.' },
        ui.inputRow({ label: 'Area', placeholder: 'e.g. Pine Hollow / Ridgeview', value: f.name, caps: 'words', autofocus: isNew, onInput: v => { f.name = v; } }),
        isNew && names.length > 0 && ui.pickerRow({ title: 'Or one already in the plan', placeholder: 'Choose', value: f.name, options: names, onChange: v => { f.name = v; p.refresh(); } })),
      ui.section({ header: 'Route', fold: false, showFooter: true, footer: 'The area shows in the route’s color.' },
        ui.pickerRow({ title: 'Route', value: f.routeId, options: q.routes().map(r => ({ value: r.id, label: q.routeName(r) })), onChange: v => { f.routeId = v; p.refresh(); } })),
      ui.section({ header: 'Repeats', fold: false }, h('div', { style: 'padding:8px 12px' }, ui.segmented([{ value: 0, label: 'One time' }, { value: 1, label: 'Weekly' }, { value: 2, label: '2 weeks' }, { value: 4, label: '4 weeks' }], f.every, v => { f.every = v; p.refresh(); })),
        h('div.ar-rep', f.every ? REPEATS.find(r => r.value === f.every).label + ' on ' + WKL[D.parse(day).getDay()] + ', counted from ' + fmt.day(!isNew && f.every === rule.every ? rule.day : day, 'md') : 'Only on ' + fmt.day(day, 'md'))),
      !isNew && ui.section(null, ui.row({ title: 'Remove this area', center: true, destructive: true, tint: true, onTap: () => remove(p) }))) }, { detent: 'large' });
}

/** One day of the plan: its areas, and the way into that day's jobs. */
A.openDay = (day, done) => {
  const sheet = ui.sheet({ title: fmt.day(day), leading: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
    render: p => { const list = A.on(day), again = () => { p.refresh(); done && done(); };
      return ui.list(
        ui.section({ header: 'Areas served', fold: false, showFooter: true, footer: canEdit() ? 'The plan says where each route goes on which days. It does not move any jobs.' : 'Only people who can change the schedule can change the plan.' },
          list.length ? list.map(a => ui.row({ leading: h('span', { style: 'margin-right:12px' }, ui.dot(a.color)), title: a.name, subtitle: (a.rule.routeId ? q.routeName(a.rule.routeId) + ' · ' : '') + repeatText(a.rule), chevron: canEdit(), onTap: canEdit() ? () => editor(a.rule, day, again) : null }))
            : ui.row({ title: 'No area planned', subtitle: 'Nothing is planned for this day yet.', disabled: true }),
          canEdit() && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an area', tint: true, onTap: () => editor(null, day, again) })),
        ui.section(null, ui.row({ icon: 'calendar', iconPlain: true, title: 'Open this day’s jobs', subtitle: (n => n + (n === 1 ? ' job' : ' jobs') + ' on the routes showing')(q.jobsOn(day).filter(j => q.visibleRoutes().some(r => r.id === j.routeId)).length), tint: true, chevron: true,
          onTap: () => { sheet.close(); WD.screens.board.show(day); } }))); } }, { detent: 'large' });
};
})();
