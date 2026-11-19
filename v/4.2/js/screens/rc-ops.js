/* RouteClerk prototype — version 4.0 operations (`WD.rc`, continued): the Maintenance section (trucks, flagged pre-trip reports, GPS readings,
   engine codes, repairs and service due, low-battery alerts), the driver's clock-in sequence (load warning → pre-trip inspection signed with the
   signature on file), the Checklist button that comes before Complete stop, the past-due flag at a stop, and assigning a driver and truck to a
   route for one day (press and hold the route's heading on Dispatch). */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc, F = data.fleet, uid = RC.uid, plural = RC.plural;
const me = () => (S.me || {}).name || 'You', today = () => D.today(), nfmt = n => Math.round(n).toLocaleString('en-US');
const canMaint = () => WD.can('maintenance.view'), sigView = s => WD.screens.billing && WD.screens.billing.sigView ? WD.screens.billing.sigView(s) : null;
const stamp = t => fmt.day(D.key(new Date(t)), 'md') + ', ' + new Date(t).getFullYear() + ' at ' + fmt.clock(new Date(t));
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));

WD.css(`
.bi-jump { display: flex; gap: 8px; margin: 0 0 10px; }
.rc-flag { margin: 10px 0 2px; border-radius: 12px; padding: 10px 12px; background: color-mix(in srgb, var(--red) 12%, var(--cell)); border-left: 4px solid var(--red); font-size: 14px; line-height: 19px; letter-spacing: -.15px; }
.rc-flag b { font-weight: 600; } .rc-flag .t { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--red); margin-bottom: 3px; }
.rc-flag .sh-acts { margin-top: 9px; }
.rc-drv { font-size: 11px; font-weight: 500; color: var(--label2); letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.rc-drv.ovr { color: var(--orange); font-weight: 600; }
.rc-gauge { height: 8px; width: 84px; border-radius: 4px; background: var(--fill2); overflow: hidden; } .rc-gauge i { display: block; height: 100%; border-radius: 4px; background: var(--green); }
.rc-gauge.low i { background: var(--red); } .rc-gauge.mid i { background: var(--orange); }
.rc-signed { padding: 12px 16px; background: var(--cell); } .rc-signed .ink { height: 70px; display: grid; place-items: center; border-bottom: 1px solid var(--label3); margin-bottom: 5px; } .rc-signed .ink svg, .rc-signed .ink img { max-height: 66px; max-width: 100%; }
.rc-signed .cap { font-size: 12px; color: var(--label2); letter-spacing: 0; }
.rc-load { text-align: left; margin-top: 8px; } .rc-load div { display: flex; gap: 8px; padding: 6px 0; border-top: .5px solid var(--sep); font-size: 14px; line-height: 18px; } .rc-load b { font-weight: 600; }
`);

/* ================= Data: GPS readings, engine codes, repairs, settings ================= */
/** Maintenance alert settings. voltMin: a truck battery reading below this raises a notification. */
const MT = data.maint = { voltMin: 12.0, lowFuel: 20 };
/** Latest readings from each truck's GPS unit (OneStep), keyed by vehicle id. Trucks without a unit have none. */
const TEL = data.telemetry = {};
const CODES = { P0420: 'Catalyst efficiency below threshold (bank 1)', P0171: 'Fuel system too lean (bank 1)', P20EE: 'SCR NOx catalyst efficiency below threshold', P0299: 'Turbocharger underboost', U0100: 'Lost communication with engine control module' };
(() => {
  const now = +WD.now(), seed = { v1: { fuel: 72, volts: 12.7, codes: [] }, v2: { fuel: 41, volts: 12.5, codes: [{ code: 'P0420', at: now - 2 * 864e5, active: true }, { code: 'P0171', at: now - 21 * 864e5, active: false, clearedAt: now - 19 * 864e5 }] },
    v3: { fuel: 18, volts: 12.2, codes: [{ code: 'P20EE', at: now - 6 * 36e5, active: true }] } };
  data.vehicles.forEach(v => { if (v.gps && seed[v.id]) TEL[v.id] = { ...seed[v.id], at: now - (3 + Math.round(Math.random() * 6)) * 60000, warned: {} }; });
  F.repairs = [
    { id: 'rp1', vehicleId: 'v2', day: D.add(today(), -34), odo: (F.odo.v2 || 0) - 1900, kind: 'service', title: 'Oil and filter', vendor: 'Lakemont Fleet Service', cost: 189, note: '' },
    { id: 'rp2', vehicleId: 'v3', day: D.add(today(), -61), odo: (F.odo.v3 || 0) - 4100, kind: 'repair', title: 'Replaced lift gate hydraulic hose', vendor: 'Lakemont Fleet Service', cost: 412.5, note: 'Hose was weeping at the fitting.' },
    { id: 'rp3', vehicleId: 'v1', day: D.add(today(), -12), odo: (F.odo.v1 || 0) - 640, kind: 'repair', title: 'Two front tires', vendor: 'Ridge Tire', cost: 838, note: '' }];
  /* A pre-trip from two days ago that found a problem, so one truck starts flagged. Everyone has already seen its alert. */
  F.inspections.push({ id: 'n-seed3', vehicleId: 'v3', by: (q.driverFor('r3') || { name: 'Sam Okafor' }).name, at: now - 2 * 864e5 - 3 * 36e5, odo: (F.odo.v3 || 0) - 86, defects: ['Lights and signals'], note: 'Right rear marker light is out. Bulb looks fine, may be the connector.', report: { open: true, seenAll: true } });
})();
const tel = vid => TEL[vid] || null;
const insOf = vid => F.inspections.filter(x => x.vehicleId === vid).sort((a, b) => b.at - a.at);
const openReports = vid => F.inspections.filter(x => x.report && x.report.open && (!vid || x.vehicleId === vid)).sort((a, b) => b.at - a.at);
const lowVolt = v => { const t = tel(v.id); return !!t && t.volts < MT.voltMin; };
const svcOf = vid => F.services.filter(s => s.owner === vid).map(s => ({ s, st: WD.biz && WD.biz.svc ? WD.biz.svc(s) : { text: '' } }));
const dueList = () => data.vehicles.filter(v => v.active !== false).flatMap(v => svcOf(v.id).filter(x => x.st.over || x.st.warn).map(x => ({ v, ...x })));
const sigOf = x => x.sig || (data.users.find(u => u.name === x.by) || {}).signature || null;
RC.maintBadge = () => canMaint() ? openReports().length + data.vehicles.filter(lowVolt).length + dueList().filter(x => x.st.over).length : 0;
(m => { if (m) m.badge = RC.maintBadge; })(WD.app.menu.find(m => m.id === 'maintenance'));

/* ================= The pre-trip inspection ================= */
/** Every item OK or Defect, the mileage (filled in from the GPS unit when the truck has one), comments, and the driver's signature on file with the
    date and time. Any defect or comment sends the report to Maintenance. o.required: no Cancel; the route can't begin until it is submitted. */
RC.inspect = (v, after, o = {}) => {
  const t = tel(v.id), st = Object.fromEntries(F.checklist.map(x => [x, 'ok'])), f = { odo: String(F.odo[v.id] || ''), note: '' };
  const bad = () => F.checklist.filter(x => st[x] === 'bad');
  const submit = async p => {
    const odo = parseInt(f.odo.replace(/\D/g, ''), 10), defects = bad(), text = f.note.trim();
    if (!odo || odo < (F.odo[v.id] || 0)) return ui.toast('Enter the mileage: at least ' + nfmt(F.odo[v.id] || 0), 'gauge', 2600); if (defects.length && !text) return ui.toast('Describe what’s wrong', 'pencil', 2400);
    if (!S.me.signature) { const pad = WD.screens.billing && await WD.screens.billing.signaturePad({ title: 'Your signature', subtitle: 'Kept on file and added to every inspection you submit' }); if (!pad) return; S.me.signature = pad.image; }
    const x = { id: uid('n'), vehicleId: v.id, by: me(), byId: S.me.id, at: +WD.now(), odo, odoFrom: t && +f.odo === F.odo[v.id] ? 'gps' : 'typed', items: { ...st }, defects, note: text, sig: S.me.signature, signedAt: +WD.now() };
    if (defects.length || text) x.report = { open: true, seen: {} };
    F.odo[v.id] = odo; F.inspections.push(x); if (S.shift) S.shift.pretrip = true; p.dismiss(); WD.changed(); after && after(x);
    if (x.report) { ui.toast('Signed and sent to Maintenance', 'wrench', 2600); setTimeout(RC.maintCheck, 900); } else ui.toast('Inspection signed · no defects', 'checkmark', 2400);
  };
  ui.sheet({ title: 'Pre-trip · ' + v.name, leading: o.required ? [] : [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Submit', bold: true, onTap: submit }],
    render: p => ui.list(o.required && note('Finish the pre-trip inspection before starting the route.'),
      ui.section({ header: v.name + (v.plate ? ' · ' + v.plate : ''), fold: false, footer: 'Everything starts as OK. Tap Defect on anything that isn’t right.' },
        F.checklist.map(x => ui.row({ title: x, trailing: h('div.bz-insp', h('button.ok' + (st[x] === 'ok' ? '.on' : ''), { onclick: () => { st[x] = 'ok'; p.refresh(); } }, 'OK'), h('button.bad' + (st[x] === 'bad' ? '.on' : ''), { onclick: () => { st[x] = 'bad'; p.refresh(); } }, 'Defect')) }))),
      ui.section({ fold: false, footer: (t ? 'Mileage was filled in from the truck’s GPS unit. Correct it if the dash reads differently. ' : '') + 'Any defect or comment is sent to Maintenance.' },
        ui.inputRow({ label: 'Mileage', inputmode: 'numeric', value: f.odo, onInput: v2 => { f.odo = v2; } }),
        ui.inputRow({ multiline: true, placeholder: bad().length ? 'What’s wrong? (required)' : 'Comments (optional)', value: f.note, onInput: v2 => { f.note = v2; } })),
      ui.section({ header: 'Signature', fold: false, footer: 'Submitting adds your signature on file with the date and time.' },
        h('div.rc-signed', h('div.ink', S.me.signature ? sigView(S.me.signature) : h('span.secondary', 'You’ll be asked to sign when you submit')), h('div.cap', me() + ' · ' + stamp(+WD.now())))),
      h('div', { style: 'padding:6px 0 4px' }, ui.button('Sign and submit', { icon: 'signature', onTap: () => submit(p) }))) }, { detent: 'large', dismissable: !o.required });
};
if (WD.biz) WD.biz.inspect = RC.inspect;

/* ================= Maintenance alerts ================= */
/** Pop-ups for people with Maintenance privileges: a new pre-trip report (alert), a truck battery below the limit, and service coming due (banners). */
let dueTold = {};
RC.maintCheck = () => {
  if (!S.signedIn || !canMaint()) return; if (document.querySelector('.x-tour') || document.querySelector('#overlays .alert')) return setTimeout(RC.maintCheck, 1500);
  const id = S.me.id, fresh = openReports().filter(x => !x.report.seenAll && !(x.report.seen || {})[id] && x.byId !== id);
  if (fresh.length) { fresh.forEach(x => { x.report.seen = x.report.seen || {}; x.report.seen[id] = true; }); const x = fresh[0], v = q.vehicle(x.vehicleId) || { name: 'Truck' };
    ui.alert({ title: fresh.length > 1 ? fresh.length + ' pre-trip reports need a look' : v.name + ' · pre-trip report', message: h('div', h('div', x.by + ' · ' + fmt.rel(new Date(x.at))), x.defects.length ? h('div', { style: 'margin-top:6px;font-weight:600' }, 'Defects: ' + x.defects.join(', ')) : null, x.note && h('div', { style: 'margin-top:4px' }, '“' + x.note + '”'), fresh.length > 1 && h('div', { style: 'margin-top:6px' }, 'and ' + (fresh.length - 1) + ' more in Maintenance')),
      buttons: [{ label: 'Later', value: null }, { label: 'View', value: true, bold: true }] }).then(go => { if (go) { WD.nav.switchTab('maintenance'); WD.nav.push(truckSpec(v)); } });
  }
  data.vehicles.filter(lowVolt).forEach(v => { const t = tel(v.id); if (t.warned[id] === t.volts) return; t.warned[id] = t.volts;
    ui.banner({ title: v.name + ' battery is low', text: t.volts.toFixed(1) + ' V, below your ' + MT.voltMin.toFixed(1) + ' V limit. It may not start.', icon: 'battery', color: 'var(--red)', duration: 7000, onTap: () => { WD.nav.switchTab('maintenance'); WD.nav.push(truckSpec(v)); } }); });
  const due = dueList(); if (due.length && !dueTold[id] && !fresh.length) { dueTold[id] = true; const d = due[0];
    ui.banner({ title: due.length === 1 ? d.v.name + ' · ' + d.s.name : plural(due.length, 'service') + ' coming due', text: due.length === 1 ? d.st.text : due.slice(0, 3).map(x => x.v.name + ' ' + x.s.name).join(', '), icon: 'wrench', color: 'var(--orange)', duration: 6000, onTap: () => WD.nav.switchTab('maintenance') }); }
};
WD.on('role', () => setTimeout(RC.maintCheck, 900));
(base => { WD.app.signIn = () => { base(); setTimeout(RC.maintCheck, 1800); }; })(WD.app.signIn);

/* ================= Maintenance section ================= */
const gauge = pct => h('div.rc-gauge' + (pct < MT.lowFuel ? '.low' : pct < 35 ? '.mid' : ''), h('i', { style: { width: Math.max(3, pct) + '%' } }));
function repairSheet(v, preset, done) {
  const f = { day: today(), kind: 'repair', title: '', vendor: '', cost: '', note: '', odo: String(F.odo[v.id] || ''), svc: '', ...preset };
  ui.sheet({ title: 'Add a record · ' + v.name, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.title.trim()) return ui.toast('Say what was done', 'pencil');
      const odo = parseInt(String(f.odo).replace(/\D/g, ''), 10) || F.odo[v.id] || 0; F.repairs.push({ id: uid('rp'), vehicleId: v.id, day: f.day, odo, kind: f.kind, title: f.title.trim(), vendor: f.vendor.trim(), cost: RC.num(f.cost), note: f.note.trim(), by: me() });
      const s = f.svc && F.services.find(x => x.id === f.svc); if (s) { s.last = odo; s.lastDay = f.day; s.lastHours = (F.hours || {})[v.id] || 0; }
      WD.changed(); p.dismiss(); ui.toast('Saved to ' + v.name, 'checkmark'); done && done(); } }],
    render: p => ui.list(ui.section({ fold: false },
        h('div', { style: 'padding:8px 16px;background:var(--cell)' }, ui.segmented([{ value: 'repair', label: 'Repair' }, { value: 'service', label: 'Scheduled maintenance' }], f.kind, v2 => { f.kind = v2; p.refresh(); })),
        ui.inputRow({ label: 'What was done', required: true, placeholder: f.kind === 'repair' ? 'e.g. Replaced marker light' : 'e.g. Oil and filter', value: f.title, onInput: v2 => { f.title = v2; } }),
        ui.dateRow({ title: 'Date', value: f.day, onChange: v2 => { f.day = v2; } }), ui.inputRow({ label: 'Mileage', inputmode: 'numeric', value: f.odo, onInput: v2 => { f.odo = v2; } }),
        ui.inputRow({ label: 'Shop or person', placeholder: 'Optional', value: f.vendor, onInput: v2 => { f.vendor = v2; } }), ui.inputRow({ label: 'Cost', inputmode: 'decimal', placeholder: '0.00', value: f.cost, onInput: v2 => { f.cost = v2; } }),
        ui.inputRow({ multiline: true, placeholder: 'Notes (optional)', value: f.note, onInput: v2 => { f.note = v2; } })),
      f.kind === 'service' && ui.section({ fold: false, footer: 'Picking one restarts its countdown from this mileage and date.' }, ui.pickerRow({ title: 'Counts as', value: f.svc, options: [{ value: '', label: 'Nothing on the schedule' }].concat(F.services.filter(s => s.owner === v.id).map(s => ({ value: s.id, label: s.name }))), onChange: v2 => { f.svc = v2; p.refresh(); } }))) }, { detent: 'large' });
}
async function resolve(x, v, re) {
  const a = await ui.actionSheet({ title: 'Close this report?', message: (x.defects.join(', ') || 'Comment') + ' · ' + v.name, buttons: [{ label: 'Repaired: add a repair record', value: 'repair' }, { label: 'Checked: no repair needed', value: 'ok' }] }); if (!a) return;
  const close = () => { x.report.open = false; x.report.closedBy = me(); x.report.closedAt = +WD.now(); x.fixed = { by: me(), at: +WD.now() }; WD.changed(); re(); };
  if (a === 'repair') repairSheet(v, { title: x.defects.length ? 'Repaired: ' + x.defects.join(', ').toLowerCase() : '', note: x.note }, () => { close(); }); else { close(); ui.toast('Report closed', 'checkmark'); }
}
const insRow = (x, push, withTruck) => { const v = q.vehicle(x.vehicleId) || { name: 'Truck' }, flagged = x.report && x.report.open;
  return ui.row({ icon: flagged ? 'flag' : x.defects.length || x.note ? 'checkmark.circle' : 'checkmark.circle.fill', iconColor: flagged ? 'var(--red)' : x.defects.length || x.note ? 'var(--gray)' : 'var(--green)', title: (withTruck ? v.name + ' · ' : '') + fmt.day(D.key(new Date(x.at)), 'short'),
    subtitle: x.by + ' · ' + nfmt(x.odo) + ' mi · ' + (x.defects.length ? plural(x.defects.length, 'defect') + ': ' + x.defects.join(', ') : x.note ? 'Comment, no defects' : 'No defects'), badge: flagged ? ui.badge('Open', 'var(--red)') : x.report ? ui.badge('Closed', 'var(--gray)') : null, chevron: true, onTap: () => push(inspectionSpec(x)) }); };
function inspectionSpec(x) { const v = q.vehicle(x.vehicleId) || { name: 'Truck' };
  return { title: 'Inspection', render: page => { const sig = sigOf(x), items = x.items || Object.fromEntries(F.checklist.map(k => [k, x.defects.includes(k) ? 'bad' : 'ok']));
    return ui.list(
      ui.section({ header: v.name + (v.plate ? ' · ' + v.plate : ''), fold: false }, ui.row({ title: 'Date and time', detail: stamp(x.at) }), ui.row({ title: 'Driver', detail: x.by }), ui.row({ title: 'Mileage', detail: nfmt(x.odo) + ' mi', subtitle: x.odoFrom === 'gps' ? 'From the GPS unit' : null })),
      x.report && ui.section({ header: 'Sent to Maintenance', fold: false, footer: x.report.open ? null : 'Closed by ' + (x.report.closedBy || '') + (x.report.closedAt ? ' · ' + stamp(x.report.closedAt) : '') },
        x.defects.length > 0 && ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--red)', title: plural(x.defects.length, 'defect'), subtitle: x.defects.join(', ') }), x.note && ui.row({ icon: 'note', iconColor: 'var(--orange)', title: 'Driver’s comments', subtitle: x.note }),
        x.report.open && canMaint() && ui.row({ title: 'Close this report…', tint: true, onTap: () => resolve(x, v, () => page.refresh()) })),
      ui.section({ header: 'Items checked', fold: false }, Object.keys(items).map(k => ui.row({ title: k, trailing: ui.badge(items[k] === 'bad' ? 'Defect' : 'OK', items[k] === 'bad' ? 'var(--red)' : 'var(--green)') }))),
      ui.section({ header: 'Signature', fold: false }, h('div.rc-signed', h('div.ink', sig ? sigView(sig) : h('span.secondary', 'Signed on paper')), h('div.cap', x.by + ' · ' + stamp(x.signedAt || x.at)))));
  } }; }
const historySpec = vid => ({ title: vid ? 'Inspections' : 'Inspection history', render: page => { const list = (vid ? insOf(vid) : F.inspections.slice().sort((a, b) => b.at - a.at));
  return ui.list(list.length ? ui.section({ header: plural(list.length, 'inspection') + ' · newest first', fold: false }, list.map(x => insRow(x, s => page.push(s), !vid))) : ui.empty({ icon: 'checklist', title: 'No inspections yet', text: 'Drivers do the pre-trip inspection when they clock in.' })); } });
const repRow = (r, withTruck) => ui.row({ icon: r.kind === 'service' ? 'repeat' : 'wrench', iconColor: r.kind === 'service' ? 'var(--teal)' : 'var(--orange)', title: r.title, subtitle: (withTruck ? (q.vehicle(r.vehicleId) || {}).name + ' · ' : '') + fmt.day(r.day, 'md') + ', ' + r.day.slice(0, 4) + ' · ' + nfmt(r.odo) + ' mi' + (r.vendor ? ' · ' + r.vendor : '') + (r.note ? ' · ' + r.note : ''), detail: r.cost ? fmt.money(r.cost, true) : '' });
const repairsSpec = () => ({ title: 'Repairs and maintenance', render: () => { const list = F.repairs.slice().sort((a, b) => b.day.localeCompare(a.day)), yr = today().slice(0, 4), sum = list.filter(r => r.day.slice(0, 4) === yr).reduce((s, r) => s + (r.cost || 0), 0);
  return ui.list(ui.section({ header: plural(list.length, 'record') + ' · ' + fmt.money(sum) + ' this year', fold: false, footer: 'Add a record from a truck’s page.' }, list.map(r => repRow(r, true)))); } });
function truckSpec(v) {
  return { title: v.name, trailing: page => canMaint() ? [{ icon: 'plus', label: 'Add a record', onTap: () => repairSheet(v, {}, () => page.refresh()) }] : [],
    render: page => { const t = tel(v.id), re = () => page.refresh(), open = openReports(v.id), svcs = svcOf(v.id), reps = F.repairs.filter(r => r.vehicleId === v.id).sort((a, b) => b.day.localeCompare(a.day)), ins = insOf(v.id), active = t ? t.codes.filter(c => c.active) : [];
      return ui.list(
        open.length > 0 && ui.section({ header: 'Flagged by the pre-trip inspection', fold: false }, open.map(x => [
          ui.row({ icon: 'flag', iconColor: 'var(--red)', title: x.defects.length ? x.defects.join(', ') : 'Driver’s comment', subtitle: (x.note ? '“' + x.note + '” · ' : '') + x.by + ' · ' + fmt.rel(new Date(x.at)), chevron: true, onTap: () => page.push(inspectionSpec(x)) }),
          ui.row({ title: 'Close this report…', tint: true, onTap: () => resolve(x, v, re) })])),
        t ? ui.section({ header: 'From the GPS unit', fold: false, footer: v.gps + ' · updated ' + fmt.rel(new Date(t.at)).toLowerCase() },
            ui.row({ icon: 'fuelpump', iconColor: t.fuel < MT.lowFuel ? 'var(--red)' : 'var(--green)', title: 'Fuel level', detail: t.fuel + '%', trailing: gauge(t.fuel) }),
            ui.row({ icon: 'gauge', iconColor: 'var(--blue)', title: 'Mileage', subtitle: 'Also fills in the pre-trip inspection', detail: nfmt(F.odo[v.id] || 0) + ' mi' }),
            ui.row({ icon: 'battery', iconColor: t.volts < MT.voltMin ? 'var(--red)' : 'var(--green)', title: 'Battery voltage', subtitle: t.volts < MT.voltMin ? 'Below your ' + MT.voltMin.toFixed(1) + ' V limit' : null, detail: h('span', { style: t.volts < MT.voltMin ? 'color:var(--red);font-weight:600' : null }, t.volts.toFixed(1) + ' V') }),
            F.hours && ui.row({ icon: 'timer', iconColor: 'var(--teal)', title: 'Engine hours', detail: nfmt(F.hours[v.id] || 0) }))
          : ui.section({ header: 'GPS unit', fold: false, footer: 'With a GPS unit connected, fuel level, mileage, battery voltage and engine codes show here, and the mileage fills in the pre-trip inspection.' },
            ui.row({ icon: 'location', iconColor: 'var(--gray)', title: 'No GPS unit on this truck', subtitle: 'Mileage ' + nfmt(F.odo[v.id] || 0) + ' mi, from the last inspection', chevron: WD.can('settings.manage'), onTap: WD.can('settings.manage') ? () => page.push(WD.screens.settings.integrationsSpec()) : null })),
        t && ui.section({ header: 'Engine codes', fold: false, footer: t.codes.length ? 'Read from the truck’s computer by the GPS unit, newest first.' : null },
          t.codes.length ? t.codes.slice().sort((a, b) => b.at - a.at).map(c => ui.row({ icon: 'exclamationmark.triangle', iconColor: c.active ? 'var(--orange)' : 'var(--gray)', title: c.code + ' · ' + (CODES[c.code] || 'Manufacturer code'), subtitle: 'Set ' + stamp(c.at) + (c.clearedAt ? ' · cleared ' + fmt.day(D.key(new Date(c.clearedAt)), 'md') : ''), badge: ui.badge(c.active ? 'Active' : 'Cleared', c.active ? 'var(--orange)' : 'var(--gray)') }))
            : ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'No engine codes' })),
        active.length > 0 && h('div', { style: 'padding:0 0 2px' }, RC.aiBlock('codes', () => RC.aiCard({ title: 'Engine code help', lines: active.map(c => codeHelp(c.code)) }))),
        ui.section({ header: 'Upcoming maintenance', fold: false, footer: 'A notification shows when a service is coming due.' },
          svcs.length ? svcs.map(({ s, st }) => ui.row({ icon: 'wrench', iconColor: st.over ? 'var(--red)' : st.warn ? 'var(--orange)' : 'var(--gray)', title: s.name, subtitle: st.every, detail: st.text, onTap: canMaint() ? () => repairSheet(v, { kind: 'service', title: s.name, svc: s.id }, re) : null, chevron: canMaint() })) : ui.row({ title: 'Nothing scheduled' }),
          WD.biz && WD.biz.vehicleSpec && ui.row({ title: 'Change the schedule and documents', tint: true, chevron: true, onTap: () => page.push(WD.biz.vehicleSpec(v)) })),
        ui.section({ header: 'Repairs and maintenance', fold: false }, reps.slice(0, 6).map(r => repRow(r)), !reps.length && ui.row({ title: 'No records yet' }),
          canMaint() && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a repair or maintenance record', tint: true, onTap: () => repairSheet(v, {}, re) })),
        ui.section({ header: 'Pre-trip inspections', fold: false }, ins.slice(0, 3).map(x => insRow(x, s => page.push(s))), !ins.length && ui.row({ title: 'Never inspected' }),
          ins.length > 3 && ui.row({ title: 'All inspections', detail: String(ins.length), chevron: true, onTap: () => page.push(historySpec(v.id)) })));
    } };
}
/** What the Premium "Engine code help" feature says about a code. */
function codeHelp(code) {
  const K = { P0420: ['Not urgent today', 'the catalytic converter is working below par. Safe to finish the route; book a shop visit within two weeks. Often an oxygen sensor rather than the converter itself.'],
    P20EE: ['Deal with it this week', 'the exhaust after-treatment (DEF/SCR) isn’t cleaning as it should. Check the DEF level and quality first. Left alone, many trucks limit engine power after a set number of miles.'],
    P0171: ['Watch it', 'the engine is running lean. Usually a vacuum leak or a dirty air-flow sensor.'], P0299: ['Deal with it this week', 'low turbo boost. Check intake hoses and clamps for a leak before anything bigger.'], U0100: ['Stop and check', 'modules can’t talk to the engine computer. Check battery connections and voltage first.'] }[code] || ['Have it read', 'a manufacturer-specific code. A shop scan will say what it means.'];
  return h('span', h('b', code + ' — ' + K[0] + ': '), K[1]);
}
function maintRoot() {
  return { title: 'Maintenance', large: true, render: page => {
    if (!canMaint()) return ui.empty({ icon: 'lock', title: 'Maintenance is hidden', text: 'Owners, admins and people given Maintenance in Team and roles can see this section.' });
    const push = s => page.push(s), trucks = data.vehicles.filter(v => v.active !== false), reports = openReports(), low = trucks.filter(lowVolt), due = dueList(), codes = trucks.flatMap(v => (tel(v.id) ? tel(v.id).codes : []).filter(c => c.active).map(c => ({ v, c })));
    const attn = [].concat(
      reports.map(x => { const v = q.vehicle(x.vehicleId); return ui.row({ icon: 'flag', iconColor: 'var(--red)', title: v.name + ' · ' + (x.defects.length ? x.defects.join(', ') : 'driver’s comment'), subtitle: 'Pre-trip · ' + x.by + ' · ' + fmt.rel(new Date(x.at)) + (x.note ? ' · “' + x.note + '”' : ''), chevron: true, onTap: () => push(truckSpec(v)) }); }),
      low.map(v => ui.row({ icon: 'battery', iconColor: 'var(--red)', title: v.name + ' · battery ' + tel(v.id).volts.toFixed(1) + ' V', subtitle: 'Below your ' + MT.voltMin.toFixed(1) + ' V limit', chevron: true, onTap: () => push(truckSpec(v)) })),
      due.map(x => ui.row({ icon: 'wrench', iconColor: x.st.over ? 'var(--red)' : 'var(--orange)', title: x.v.name + ' · ' + x.s.name, subtitle: x.st.text, chevron: true, onTap: () => push(truckSpec(x.v)) })),
      codes.map(x => ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--orange)', title: x.v.name + ' · engine code ' + x.c.code, subtitle: CODES[x.c.code] || 'Manufacturer code', chevron: true, onTap: () => push(truckSpec(x.v)) })));
    return ui.list(
      ui.section({ header: attn.length ? 'Needs attention · ' + attn.length : 'Needs attention', fold: false }, attn.length ? attn : ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Nothing needs attention' })),
      ui.section({ header: 'Trucks', fold: false, footer: 'A flag means a pre-trip inspection found a problem or the driver left a comment that hasn’t been closed.' }, trucks.map(v => { const t = tel(v.id), n = openReports(v.id).length;
        return ui.row({ icon: n ? 'flag' : 'truck', iconColor: n ? 'var(--red)' : lowVolt(v) ? 'var(--orange)' : 'var(--green)', title: v.name, subtitle: nfmt(F.odo[v.id] || 0) + ' mi' + (t ? ' · fuel ' + t.fuel + '% · ' + t.volts.toFixed(1) + ' V' : ' · no GPS unit') + (n ? ' · ' + openReports(v.id)[0].defects.concat(openReports(v.id)[0].defects.length ? [] : ['comment']).join(', ') : ''),
          badge: n ? ui.badge('Flagged', 'var(--red)') : null, chevron: true, onTap: () => push(truckSpec(v)) }); })),
      ui.section({ header: 'Records', fold: false },
        ui.row({ icon: 'checklist', iconColor: 'var(--indigo)', title: 'Truck inspection history', detail: String(F.inspections.length), chevron: true, onTap: () => push(historySpec()) }),
        ui.row({ icon: 'wrench', iconColor: 'var(--orange)', title: 'Repairs and maintenance log', detail: String(F.repairs.length), chevron: true, onTap: () => push(repairsSpec()) }),
        WD.biz && WD.biz.fleetSpec && ui.row({ icon: 'doc.text', iconColor: 'var(--teal)', title: 'Documents and the inspection checklist', subtitle: 'Registrations, licenses, what the pre-trip checks', chevron: true, onTap: () => push(WD.biz.fleetSpec()) })),
      ui.section({ header: 'Alerts', fold: false, footer: 'A notification pops up for everyone with Maintenance when a truck’s battery reads below this, when a pre-trip inspection reports a problem, and when service is coming due. Who has Maintenance is set in Settings → Team and roles.' },
        ui.pickerRow({ icon: 'battery', iconColor: 'var(--red)', title: 'Low battery below', value: MT.voltMin, options: [11.5, 11.8, 12.0, 12.2, 12.4].map(x => ({ value: x, label: x.toFixed(1) + ' V' })), onChange: v => { MT.voltMin = v; WD.changed(); page.refresh(); setTimeout(RC.maintCheck, 400); } })));
  } };
}
WD.screens.maintenance = { root: maintRoot, truckSpec };

/* ================= Clock-in: load warning, then the pre-trip inspection ================= */
const hddQty = job => (((job.items || []).find(i => i.id === 'hdd') || {}).qty) || 0;
const todays = rid => q.stopList(rid, today()).filter(j => !j.allDay && !WD.closed[j.status]);
RC.loadFor = rid => { const jobs = todays(rid); return { drives: jobs.filter(j => hddQty(j) > 0).map(j => ({ job: j, n: hddQty(j) })), deliveries: jobs.filter(j => j.type === 'setup' || j.deliver).map(j => ({ job: j, what: j.deliver || j.containers || WD.itemsLabel(j.items) || 'Containers' })) }; };
RC.afterClockIn = async () => {
  const sh = S.shift; if (!sh || sh.kind !== 'route' || !sh.routeId) return; const v = q.vehicle(sh.vehicleId); sh.pretrip = !v;
  const L = RC.loadFor(sh.routeId); await WD.delay(350);
  if (L.drives.length || L.deliveries.length) await ui.alert({ title: 'Before you leave', message: h('div', 'Today’s route needs:', h('div.rc-load',
      L.drives.map(x => h('div', icon('shippingbox', 17, 'var(--brown)'), h('span', h('b', plural(x.n, 'hard drive') + ' to shred'), ' · ' + x.job.title))),
      L.deliveries.map(x => h('div', icon('truck', 17, 'var(--blue)'), h('span', h('b', 'Deliver ' + x.what), ' · ' + x.job.title))))), buttons: [{ label: 'I have what I need', bold: true }] });
  if (v && S.shift === sh) RC.inspect(v, null, { required: true });
};
/** Until the pre-trip is submitted the stop card offers only the inspection. */
RC.pretripGate = b => { const sh = S.shift; if (!sh || sh.pretrip !== false) return null; const v = q.vehicle(sh.vehicleId); return v ? [b('Pre-trip inspection', 'filled', () => RC.inspect(v, null, { required: true }), 'checklist')] : null; };

/* ================= Checklist before Complete stop ================= */
const checksFor = job => (!job.allDay && (job.checklist || (data.checklists || {})[job.type])) || [];
RC.checklistButton = (job, b) => { const items = checksFor(job); if (!items.length || job.checkSubmitted) return null; const n = items.filter(k => job.checks && job.checks[k.id]).length;
  return b('Checklist · ' + n + ' of ' + items.length, 'filled', () => RC.openChecklist(job), 'checklist'); };
RC.openChecklist = job => { const items = checksFor(job); job.checks = job.checks || {};
  const finish = (p, reason) => { job.checkSubmitted = { at: +WD.now(), by: me(), reason: reason || null }; const left = items.filter(k => !job.checks[k.id]).length;
    job.events.push({ at: +WD.now(), actor: me(), text: reason ? 'Checklist submitted with ' + plural(left, 'item') + ' unfinished — ' + reason : 'Checklist completed' }); p.dismiss(); WD.changed(); ui.toast(reason ? 'Checklist submitted' : 'Checklist complete', 'checkmark'); };
  ui.sheet({ title: 'Checklist', leading: [{ label: 'Close', onTap: p => p.dismiss() }],
    render: p => { const left = items.filter(k => !job.checks[k.id]), need = left.filter(k => k.req);
      return ui.list(ui.section({ header: job.title, fold: false, footer: need.length ? plural(need.length, 'required item') + ' left.' : left.length ? 'Everything required is done.' : 'All done.' }, items.map(k => { const on = !!job.checks[k.id];
          return ui.row({ icon: on ? 'checkmark.circle.fill' : k.photo ? 'camera' : 'circle', iconPlain: true, iconColor: on ? 'var(--green)' : 'var(--label3)', title: k.text, subtitle: on ? job.checks[k.id].by + ' · ' + fmt.clock(new Date(job.checks[k.id].at)) : k.req ? 'Required' : 'Optional',
            onTap: () => { if (on) delete job.checks[k.id]; else { job.checks[k.id] = { at: +WD.now(), by: me() }; if (k.photo) { job.attachments = job.attachments || []; job.attachments.push({ id: uid('a'), name: k.text + '.jpg', kind: 'photo', size: '1.8 MB' }); ui.toast('Photo added', 'camera'); } } WD.changed(); p.refresh(); } }); })),
        h('div', { style: 'display:flex;flex-direction:column;gap:10px;padding:8px 0' },
          ui.button('Checklist complete', { icon: 'checkmark', disabled: need.length > 0, onTap: () => finish(p) }),
          left.length > 0 && ui.button('Submit unfinished…', { kind: 'gray', onTap: async () => { const why = await RC.ask('Why wasn’t it finished?', 'e.g. No one was there to take the keys'); if (why) finish(p, why); } })),
        h('div.footnote.secondary', { style: 'padding:0 6px' }, 'Complete stop appears once the checklist is complete or submitted unfinished.')); } }, { detent: 'large' });
};

/* ================= Past-due flag at a stop ================= */
RC.pastDue = c => (WD.r11 && c ? WD.r11.overdue(c) : []);
RC.pastDueFlag = job => { const c = job.customerId && q.customer(job.customerId), pd = RC.pastDue(c); if (pd.length < 2) return null;
  const U = WD.r11.cfg.unpaid, sum = pd.reduce((s, i) => s + i.amount, 0), oldest = Math.max(...pd.map(i => D.diff(today(), i.day))), canBill = WD.screens.billing && WD.screens.billing.canInvoice();
  return h('div.rc-flag', h('div.t', icon('flag', 16), pd.length + ' invoices past due · ' + fmt.money(sum)), h('div', 'Unpaid more than ' + U.overdueDays + ' days; the oldest is ' + oldest + ' days old.'), h('div', h('b', 'Recommended: '), U.driverAction || 'Ask the office manager whether they are receiving our invoices.'),
    canBill && h('div.sh-acts', ui.button('Statement…', { kind: 'filled', small: true, block: false, icon: 'envelope', onTap: () => RC.openStatement && RC.openStatement(c, { job }) }),
      !job.invoice && ui.button('Create invoice', { kind: 'tinted', small: true, block: false, icon: 'doc.text', onTap: () => WD.screens.billing.openEditor(job.id) })));
};

/* ================= Dispatch: a driver and truck for a route on one day ================= */
/** Day assignments: key routeId + '|' + day → { driverId (null = nobody), vehicleId }. A missing key means the route's usual driver and truck. */
const RA = data.routeAssign = {};
const usual = rid => q.route(rid) || {}, asg = (rid, day) => RA[rid + '|' + day];
RC.driverOn = (rid, day) => { const a = asg(rid, day), id = a && 'driverId' in a ? a.driverId : usual(rid).driverId; return id ? q.user(id) : null; };
RC.vehicleOn = (rid, day) => { const a = asg(rid, day), id = a && a.vehicleId ? a.vehicleId : usual(rid).vehicleId; return id ? q.vehicle(id) : null; };
RC.routeOf = (userId, day) => q.routes().find(r => (RC.driverOn(r.id, day) || {}).id === userId) || null;
const changed = (rid, day) => { const a = asg(rid, day), r = usual(rid); return !!a && (('driverId' in a && a.driverId !== (r.driverId || null)) || (!!a.vehicleId && a.vehicleId !== r.vehicleId)); };
const setA = (rid, day, patch) => { RA[rid + '|' + day] = { ...(asg(rid, day) || {}), ...patch }; };
const first = u => u ? u.name.split(' ')[0] : 'Nobody';
RC.headTag = c => { if (!S.prefs.showDrivers) return null; const d = RC.driverOn(c.routeId, c.day), v = RC.vehicleOn(c.routeId, c.day);
  return h('span.bd-offrow', h('span.rc-drv' + (changed(c.routeId, c.day) ? '.ovr' : ''), first(d) + (v ? ' · ' + v.name : ''))); };
/** With one column there is no heading row, so the assignment shows as a line you can tap (or press and hold). */
RC.assignStrip = cols => { if (cols.length !== 1 || !S.prefs.showDrivers) return null; const c = cols[0], d = RC.driverOn(c.routeId, c.day), v = RC.vehicleOn(c.routeId, c.day), edit = WD.can('jobs.edit');
  return h('div.bd-strip', { style: { '--c': changed(c.routeId, c.day) ? 'var(--orange)' : 'var(--gray)', cursor: edit ? 'pointer' : 'default' }, onclick: () => edit && RC.assignSheet(c.routeId, c.day) }, icon('person', 16), (d ? d.name : 'No driver') + (v ? ' · ' + v.name : ' · no truck') + (changed(c.routeId, c.day) ? ' · this day only' : ''), h('span.spacer'), edit && 'Assign', edit && icon('chevron.right', 13)); };
RC.assignSheet = (rid, day) => {
  if (!WD.can('jobs.edit')) return ui.toast('Dispatch access is needed to assign drivers', 'lock');
  const r = q.route(rid), was = RC.driverOn(rid, day), wasV = RC.vehicleOn(rid, day), f = { driverId: was ? was.id : null, vehicleId: wasV ? wasV.id : null };
  const drivers = data.users.filter(u => u.role === 'driver' && u.status === 'active'), trucks = data.vehicles.filter(v => v.active !== false);
  const save = async p => {
    const nu = f.driverId ? q.user(f.driverId) : null, from = nu && RC.routeOf(nu.id, day);   // the route the chosen driver is leaving, if any
    let moveTo;                                                                                // where the driver who was here goes: a route id, or null for no route
    if (was && (!nu || nu.id !== was.id)) {
      const others = q.routes().filter(x => x.id !== rid), label = x => { const d = RC.driverOn(x.id, day); return q.routeName(x) + (from && x.id === from.id ? ' (swap with ' + first(nu) + ')' : d ? ' (replaces ' + first(d) + ')' : ' (no driver yet)'); };
      others.sort((a, b) => (from && b.id === from.id ? 1 : 0) - (from && a.id === from.id ? 1 : 0) || (RC.driverOn(a.id, day) ? 1 : 0) - (RC.driverOn(b.id, day) ? 1 : 0));
      const pick = await ui.actionSheet({ title: was.name + ' was on ' + q.routeName(r) + ' ' + fmt.day(day, 'rel').toLowerCase(), message: 'Which route should ' + first(was) + ' take that day?', buttons: others.map(x => ({ label: label(x), value: x.id })).concat([{ label: 'No route that day', value: 'none' }]) });
      if (!pick) return; moveTo = pick === 'none' ? null : pick;
    }
    if (from && from.id !== rid && from.id !== moveTo) setA(from.id, day, { driverId: null });
    if (moveTo) setA(moveTo, day, { driverId: was.id });
    setA(rid, day, { driverId: nu ? nu.id : null });
    if (f.vehicleId && (!wasV || wasV.id !== f.vehicleId)) { const other = q.routes().find(x => x.id !== rid && (RC.vehicleOn(x.id, day) || {}).id === f.vehicleId); if (other && wasV) setA(other.id, day, { vehicleId: wasV.id }); setA(rid, day, { vehicleId: f.vehicleId }); if (other && wasV) setTimeout(() => ui.toast(q.routeName(other) + ' takes ' + wasV.name + ' instead', 'truck', 2800), 900); }
    WD.changed(); p.dismiss(); ui.toast(q.routeName(r) + ': ' + (nu ? nu.name : 'no driver') + (f.vehicleId ? ' · ' + q.vehicle(f.vehicleId).name : ''), 'checkmark', 2600);
  };
  ui.sheet({ title: 'Driver and truck', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Assign', bold: true, onTap: save }],
    render: p => { const pickRow = (on, title, sub, tap, warn) => ui.row({ icon: on ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: on ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, badge: warn ? ui.badge(warn, 'var(--red)') : null, onTap: () => { tap(); p.refresh(); } });
      return ui.list(note(q.routeName(r) + ' · ' + fmt.day(day, 'long') + '. This changes that one day; the route’s usual driver and truck stay as they are.'),
        ui.section({ header: 'Driver', fold: false }, drivers.map(u => { const on = RC.routeOf(u.id, day), off = WD.offOn && WD.offOn(u.id, day);
            return pickRow(f.driverId === u.id, u.name, on ? (on.id === rid ? 'On this route' : 'On ' + q.routeName(on)) : 'Not on a route that day', () => { f.driverId = u.id; }, off ? 'Time off' : null); }),
          pickRow(!f.driverId, 'No driver', 'Leave the route unassigned', () => { f.driverId = null; })),
        ui.section({ header: 'Truck', fold: false }, trucks.map(v => { const on = q.routes().find(x => (RC.vehicleOn(x.id, day) || {}).id === v.id);
          return pickRow(f.vehicleId === v.id, v.name, (v.kind || '') + (on ? ' · ' + (on.id === rid ? 'on this route' : 'on ' + q.routeName(on)) : ' · free that day'), () => { f.vehicleId = v.id; }); })),
        changed(rid, day) && ui.section(null, ui.row({ title: 'Back to the usual driver and truck', destructive: true, onTap: () => { delete RA[rid + '|' + day]; WD.changed(); p.dismiss(); ui.toast('Back to the usual assignment', 'checkmark'); } }))); } }, { detent: 'large' });
};

/* ================= Demo data for the driver's day, and panel shortcuts ================= */
(() => { const open = todays('r1'), a = open[1] || open[0], b2 = open[2] || open[0];
  if (a && !hddQty(a)) { a.items = (a.items || []).concat([{ id: 'hdd', qty: 4, rate: 15 }]); a.hddScan = false; }
  if (b2 && b2 !== a) { b2.deliver = '1 console and 1 bin (64 gal)'; b2.checklist = [{ id: 'dk1', text: 'New containers placed where the customer wants them', req: true }, { id: 'dk2', text: 'Keys handed to the site contact', req: true }, { id: 'dk3', text: 'Photo of each container in place', req: false, photo: true }]; }
  /* A customer on today's North Route with several invoices past due, so the flag shows at the stop. */
  const c = (open[0] && q.customer(open[0].customerId)) || null;
  if (c && data.invoices) [[82, 138], [58, 96], [51, 96], [17, 96]].forEach(([ago, amount], i) => data.invoices.push({ id: 'inv-pd' + i, number: 'INV-' + (2231 + i * 7), customerId: c.id, jobId: null, day: D.add(today(), -ago), amount, status: ago > 45 ? 'Overdue' : 'Sent', auto: false, payments: [], at: +D.parse(D.add(today(), -ago)) }));
})();
WD.panel.addAction('Truck battery drops below the limit', () => { const v = q.vehicle('v3') || data.vehicles[0], t = tel(v.id); if (!t) return; t.volts = +(MT.voltMin - 0.3).toFixed(1); t.at = +WD.now(); WD.changed(); RC.maintCheck(); if (!canMaint()) ui.toast('Only people with Maintenance are notified', 'lock', 2600); });
WD.panel.addAction('Driver reports a pre-trip defect', () => { const v = q.vehicle('v1') || data.vehicles[0], d = q.user('u4') || { name: 'Marcus Bell', id: 'u4' };
  F.inspections.push({ id: uid('n'), vehicleId: v.id, by: d.name, byId: d.id === S.me.id ? 'someone-else' : d.id, at: +WD.now(), odo: F.odo[v.id], odoFrom: 'gps', defects: ['Brakes'], note: 'Soft pedal and a squeal from the front left.', sig: d.signature, signedAt: +WD.now(), report: { open: true, seen: {} } }); WD.changed(); RC.maintCheck(); if (!canMaint()) ui.toast('Only people with Maintenance are notified', 'lock', 2600); });
WD.panel.addJump('Maintenance', () => WD.nav.switchTab('maintenance'));
})();
