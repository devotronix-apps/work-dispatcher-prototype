/* RouteClerk prototype — version 4.0 operations (`WD.rc`, continued): the Maintenance section (a dashboard of trucks, flagged pre-trip reports,
   GPS readings, engine codes, repairs and service due, low-battery alerts; each truck's size for truck-legal routing; the fuel price; and Fleet
   setup: trucks and capabilities, locations and disposal sites, tracking, load sheet, mileage, fleet compliance), the driver's clock-in sequence (load warning → pre-trip inspection signed with the
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
.rc-drv { font-size: 12px; font-weight: 500; color: var(--label2); letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.rc-drv.ovr { color: var(--orange); font-weight: 600; }
.rc-unq { color: var(--red); font-weight: 800; }
.rc-unq-why { display: block; color: var(--red); font-weight: 600; white-space: normal; }
.rc-gauge { height: 8px; width: 84px; border-radius: 4px; background: var(--fill2); overflow: hidden; } .rc-gauge i { display: block; height: 100%; border-radius: 4px; background: var(--green); }
.rc-gauge.low i { background: var(--red); } .rc-gauge.mid i { background: var(--orange); }
.rc-signed { padding: 12px 16px; background: var(--cell); } .rc-signed .ink { height: 70px; display: grid; place-items: center; border-bottom: 1px solid var(--label3); margin-bottom: 5px; } .rc-signed .ink svg, .rc-signed .ink img { max-height: 66px; max-width: 100%; }
.rc-signed .cap { font-size: 12px; color: var(--label2); letter-spacing: 0; }
.rc-load { text-align: left; margin-top: 8px; } .rc-load div { display: flex; gap: 8px; padding: 6px 0; border-top: .5px solid var(--sep); font-size: 14px; line-height: 18px; } .rc-load b { font-weight: 600; }
/* The Maintenance dashboard: stat tiles, one card per truck, then titled groups of rows. */
.mt-root .cells { border-radius: 14px; } .mt-root .section-header.plain { padding-left: 4px; }
.mt-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.mt-tile { display: flex; flex-direction: column; gap: 2px; min-width: 0; min-height: 88px; padding: 12px 14px; border: 0; border-radius: 14px; background: var(--cell); color: var(--label); font: inherit; text-align: left; letter-spacing: -.1px; }
button.mt-tile { cursor: pointer; } button.mt-tile:active, .mt-card:active { opacity: .65; }
.mt-tile .k, .mt-tile .s { font-size: 13px; line-height: 17px; color: var(--label2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.mt-tile .v { font-size: 26px; line-height: 31px; font-weight: 700; letter-spacing: -.5px; font-variant-numeric: tabular-nums; color: var(--c, var(--label)); }
.mt-tile .v.txt { font-size: 17px; line-height: 22px; font-weight: 600; letter-spacing: -.3px; margin: 5px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.mt-cards { display: grid; gap: 10px; }
.mt-card { background: var(--cell); border-radius: 14px; padding: 14px; cursor: pointer; min-width: 0; }
.mt-card .top { display: flex; align-items: center; gap: 10px; min-height: 44px; } .mt-card .tk { width: 38px; height: 38px; border-radius: 10px; background: var(--fill3); color: var(--label2); display: grid; place-items: center; flex: none; }
.mt-card .twho { flex: 1; min-width: 0; } .mt-card .nm { font-size: 17px; line-height: 22px; font-weight: 600; letter-spacing: -.3px; overflow-wrap: anywhere; }
.mt-card { border-left: 4px solid var(--c, transparent); } .mt-card .top .badge { flex: none; } .mt-card.sel { box-shadow: 0 0 0 2px var(--tint); }
.mt-card .tk { background: color-mix(in srgb, var(--c, var(--gray)) 14%, transparent); color: var(--c, var(--label2)); }
/* Wide column: the truck list on the left, the chosen truck on the right. */
.mt-split { display: grid; grid-template-columns: minmax(340px, 400px) minmax(0, 1fr); gap: 0 8px; align-items: start; }
.mt-split > .mt-side { position: sticky; top: 0; overflow-y: auto; scrollbar-width: thin; border-left: .5px solid var(--sep); }
.mt-dhead { display: flex; align-items: center; gap: 10px; padding: 12px 16px 0; } .mt-dhead .title2 { flex: 1; min-width: 0; overflow-wrap: anywhere; }
/* Report a problem (drivers) */
.mt-prob { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px 12px; background: var(--cell); }
.mt-prob button { appearance: none; border: 0; min-height: 44px; padding: 0 14px; border-radius: 22px; background: var(--fill3); color: var(--label); font: inherit; font-size: 15px; letter-spacing: -.2px; cursor: pointer; }
.mt-prob button.on { background: var(--red); color: #fff; font-weight: 600; }
.mt-card .sub, .mt-card .meta { font-size: 13px; line-height: 18px; color: var(--label2); letter-spacing: -.08px; } .mt-card .meta { margin-top: 8px; }
.mt-card .urg { display: flex; gap: 7px; align-items: flex-start; margin-top: 8px; font-size: 14px; line-height: 19px; letter-spacing: -.15px; } .mt-card .urg svg { flex: none; margin-top: 2px; }
.mt-bar { height: 4px; border-radius: 2px; background: var(--fill2); overflow: hidden; margin-top: 12px; } .mt-bar i { display: block; height: 100%; border-radius: 2px; background: var(--c, var(--green)); }
.mt-next { display: flex; justify-content: space-between; gap: 10px; margin-top: 6px; font-size: 13px; line-height: 17px; color: var(--label2); } .mt-next span:first-child { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .mt-next span:last-child { flex: none; color: var(--c2, var(--label2)); font-weight: 500; }
.mt-dim { display: flex; align-items: center; gap: 6px; flex: none; font-size: 15px; color: var(--label2); } .mt-dim input { width: 72px; min-height: 44px; font-size: 16px; }
`);

/* ================= Data: GPS readings, engine codes, repairs, settings ================= */
/** Maintenance alert settings. voltMin: a truck battery reading below this raises a notification. */
const MT = data.maint = { voltMin: 12.0, lowFuel: 20,
  /* The fuel price the company wants estimates to use, per US gallon in the company currency (shown per liter when units are metric).
     fuelSplit: diesel and gasoline are priced apart; fuelPrice is then diesel and fuelGas gasoline. */
  fuelPrice: 3.89, fuelSplit: false, fuelGas: 3.29, fuelAt: +WD.now() - 3 * 864e5, fuelBy: 'Dana Whitfield' };
/* Size, weight and fuel for each truck. v.dims {heightIn, lengthFt, widthIn, gvwLb, axles}; v.truckRoutes keeps directions on truck-legal roads.
   What it can carry (payload) stays in data.load.capacity, where the load sheet reads it. */
(() => { const seed = { v1: [150, 26, 102, 25999, 2, 8.5], v2: [154, 28, 102, 33000, 2, 7.5], v3: [140, 24, 96, 25500, 2, 8], v4: [158, 26, 102, 33000, 2, 9] };
  data.vehicles.forEach(v => { const s = seed[v.id]; if (!s || v.dims) return; v.dims = { heightIn: s[0], lengthFt: s[1], widthIn: s[2], gvwLb: s[3], axles: s[4] }; v.truckRoutes = true; v.hazmat = false; v.fuel = 'diesel'; v.mpg = s[5]; }); })();
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
const admin = () => WD.can('settings.manage'), metric = () => WD.locale.units === 'metric', ND = () => (WD.r11 ? WD.r11.cfg.compliance.noticeDays : 30), money = n => fmt.money(n, true);
/** How far a service is toward coming due: 0 just done, 1 due, above 1 overdue. Miles, engine hours and time; whichever is furthest along. */
const svcFrac = s => Math.max(0, s.every ? ((F.odo[s.owner] || 0) - s.last) / s.every : 0, s.everyHours ? (((F.hours || {})[s.owner] || 0) - (s.lastHours || 0)) / s.everyHours : 0, s.everyDays ? D.diff(today(), s.lastDay || today()) / s.everyDays : 0);
const nextSvc = vid => svcOf(vid).map(x => ({ ...x, frac: svcFrac(x.s) })).sort((a, b) => b.frac - a.frac)[0] || null;
const truckDocs = vid => F.docs.filter(d => d.owner === vid && !(d.carb && WD.r11 && !WD.r11.cfg.compliance.carb)).map(d => ({ d, n: D.diff(d.expires, today()) }));
/** Everything about one truck that wants attention, most urgent first: [{sev: 3 (red) | 2 (orange), kind: 'flag' | 'due' | 'code', icon, text}]. */
const truckItems = v => { const t = tel(v.id), out = [];
  openReports(v.id).forEach(x => out.push({ sev: 3, kind: 'flag', icon: 'flag', text: (x.problem ? 'Reported: ' : 'Pre-trip: ') + (x.defects.length ? x.defects.join(', ').toLowerCase() : 'driver’s comment') }));
  if (lowVolt(v)) out.push({ sev: 3, kind: 'flag', icon: 'battery', text: 'Battery ' + t.volts.toFixed(1) + ' V, below your ' + MT.voltMin.toFixed(1) + ' V limit' });
  svcOf(v.id).forEach(({ s, st }) => { if (st.over || st.warn) out.push({ sev: st.over ? 3 : 2, kind: 'due', icon: 'wrench', text: s.name + ' · ' + st.text }); });
  truckDocs(v.id).forEach(({ d, n }) => { if (n <= ND()) out.push({ sev: n < 0 ? 3 : 2, kind: 'due', icon: 'doc.text', text: d.name + (n < 0 ? ' expired ' + plural(-n, 'day') + ' ago' : n === 0 ? ' expires today' : ' expires in ' + plural(n, 'day')) }); });
  if (t) t.codes.filter(c => c.active).forEach(c => out.push({ sev: 2, kind: 'code', icon: 'exclamationmark.triangle', text: 'Engine code ' + c.code + ' · ' + (CODES[c.code] || 'manufacturer code') }));
  return out.sort((a, b) => b.sev - a.sev); };
/** The pill on a truck's card: In the shop, Flagged (an open pre-trip report or a low battery), Overdue, Due soon, or OK. */
const truckStatus = v => { const top = truckItems(v)[0];
  return v.shop ? { id: 'shop', label: 'In the shop', color: 'var(--gray)' } : !top ? { id: 'ok', label: 'OK', color: 'var(--green)' } : top.sev === 3 ? { id: top.kind === 'flag' ? 'flag' : 'over', label: top.kind === 'flag' ? 'Flagged' : 'Overdue', color: 'var(--red)' } : { id: 'soon', label: top.kind === 'code' ? 'Check engine' : 'Due soon', color: 'var(--orange)' }; };

/** Trucks with problems first: Overdue, Flagged, Due soon (or an engine code), In the shop, OK. */
const RANK = { over: 0, flag: 1, soon: 2, shop: 3, ok: 4 }, byUrgency = list => list.map((v, i) => ({ v, i, r: RANK[truckStatus(v).id] })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.v);
/** The route a truck runs today, for the other columns of the desktop workspace. */
const routeToday = v => q.routes().find(r => ((RC.vehicleOn ? RC.vehicleOn(r.id, today()) : q.vehicle(r.vehicleId)) || {}).id === v.id) || null;
const linkTruck = v => { const r = routeToday(v); if (WD.app.linkSelect) WD.app.linkSelect({ from: 'maintenance', vehicleId: v.id, routeId: r ? r.id : null, day: today() }); };
const MUI = { sel: null };   // the truck showing on the right of the wide layout

/* ---------- Truck size (for truck-legal routing) and the fuel price ---------- */
const feetIn = n => Math.floor(n / 12) + '′' + (n % 12 ? (n % 12) + '″' : ''), meters = (n, dp) => n.toFixed(dp) + ' m';
const fmtHigh = inches => metric() ? meters(inches * 0.0254, 2) : feetIn(Math.round(inches)), fmtLong = ft => metric() ? meters(ft * 0.3048, 1) : (+ft.toFixed(1)) + ' ft';
/** A truck's size for routing. Lengths are stored in US units whatever the company shows: height and width in inches, length in feet, weight
    (gross vehicle weight) and payload in pounds; heightM, lengthM, widthM and weightKg are the same in metric. text: “12′6″ high · 26 ft · 25,999 lb”.
    truckRoutes: keep this truck on truck-legal roads. null when there is no such vehicle; sizes not entered yet are null. */
WD.truckProfile = vehicleId => { const v = q.vehicle(vehicleId); if (!v) return null; const d = v.dims || {}, r = (n, k, dp) => n ? +(n * k).toFixed(dp) : null;
  return { vehicleId: v.id, name: v.name, height: d.heightIn || null, length: d.lengthFt || null, width: d.widthIn || null, weight: d.gvwLb || null, axles: d.axles || 2, payload: (data.load && data.load.capacity[v.id]) || null, hazmat: !!v.hazmat, truckRoutes: !!v.truckRoutes,
    heightM: r(d.heightIn, 0.0254, 2), lengthM: r(d.lengthFt, 0.3048, 1), widthM: r(d.widthIn, 0.0254, 2), weightKg: r(d.gvwLb, 0.4536, 0),
    text: [d.heightIn && fmtHigh(d.heightIn) + ' high', d.lengthFt && fmtLong(d.lengthFt), d.gvwLb && fmt.weight(d.gvwLb)].filter(Boolean).join(' · ') }; };
const GAL = 3.785, KMPL = 0.4251;   // liters in a US gallon; km per liter for one mile per gallon
/** The fuel price set in Maintenance, per US gallon in the company currency. kind 'diesel' | 'gasoline' matters only when the two are priced apart. */
WD.fuelPrice = kind => MT.fuelSplit && kind === 'gasoline' ? MT.fuelGas : MT.fuelPrice;
/** “$3.89 per gallon”, or per liter when the company uses metric units. */
WD.fuelPriceText = kind => metric() ? fmt.money(Math.round(WD.fuelPrice(kind) / GAL * 1000) / 1000, true) + ' per liter' : money(WD.fuelPrice(kind)) + ' per gallon';
/** Fuel cost for one mile in a truck, from the fuel price and the truck's fuel economy; 0 when the fuel economy isn't entered. */
WD.fuelCostPerMile = vehicleId => { const v = q.vehicle(vehicleId); return v && v.mpg > 0 ? WD.fuelPrice(v.fuel) / v.mpg : 0; };
const fuelLine = () => MT.fuelSplit ? 'Diesel ' + WD.fuelPriceText('diesel') + ' · gasoline ' + WD.fuelPriceText('gasoline').replace(/ per .*/, '') : WD.fuelPriceText();
function fuelSheet(done) { const m = metric(), unit = m ? 'per liter' : 'per gallon', show = p => (m ? p / GAL : p).toFixed(m ? 3 : 2), read = t => { const n = RC.num(t); return n > 0 ? +(m ? n * GAL : n).toFixed(3) : 0; };
  const f = { price: show(MT.fuelPrice), gas: show(MT.fuelGas), split: MT.fuelSplit };
  ui.sheet({ title: 'Fuel price', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { const a = read(f.price), b = read(f.gas); if (!a || (f.split && !b)) return ui.toast('Enter the price ' + unit, 'fuelpump', 2400);
      MT.fuelPrice = a; if (f.split) MT.fuelGas = b; MT.fuelSplit = f.split; MT.fuelAt = +WD.now(); MT.fuelBy = me(); WD.changed(); p.dismiss(); ui.toast('Fuel price updated', 'checkmark'); done && done(); } }],
    render: p => ui.list(ui.section({ header: 'Price ' + unit + ' · ' + WD.locale.currency, fold: false, showFooter: true, footer: 'The price you want estimates to use. It sets the fuel cost per mile on each truck and the fuel estimate under Mileage and expenses.' },
        ui.inputRow({ label: f.split ? 'Diesel' : 'Fuel', inputmode: 'decimal', placeholder: '0.00', value: f.price, onInput: v => { f.price = v; } }),
        f.split && ui.inputRow({ label: 'Gasoline', inputmode: 'decimal', placeholder: '0.00', value: f.gas, onInput: v => { f.gas = v; } }),
        ui.toggleRow({ title: 'Separate diesel and gasoline prices', value: f.split, onChange: v => { f.split = v; p.refresh(); } })),
      ui.section({ fold: false }, ui.row({ title: 'Last updated', detail: stamp(MT.fuelAt), subtitle: MT.fuelBy || null }))) }, { detent: 'medium' }); }
/** Height, length, width, weight, axles, what it carries, hazmat and fuel for one truck. */
function sizeSheet(v, done) { const m = metric(), d = v.dims || {}, cap = (data.load && data.load.capacity[v.id]) || 0, s = (x, k, dp) => x ? String(k ? +(x * k).toFixed(dp) : x) : '', n = RC.num;
  const f = { hf: d.heightIn ? String(Math.floor(d.heightIn / 12)) : '', hi: d.heightIn ? String(d.heightIn % 12) : '', h: s(d.heightIn, 0.0254, 2), l: m ? s(d.lengthFt, 0.3048, 1) : s(d.lengthFt), w: m ? s(d.widthIn, 0.0254, 2) : s(d.widthIn),
    gvw: m ? s(d.gvwLb, 0.4536, 0) : s(d.gvwLb), cap: m ? s(cap, 0.4536, 0) : s(cap), axles: d.axles || 2, hazmat: !!v.hazmat, fuel: v.fuel || 'diesel', mpg: m ? s(v.mpg, KMPL, 1) : s(v.mpg) };
  const was = { ...f }, same = (k, old) => f[k] === was[k] && old > 0;   // a figure left alone keeps its exact stored value, so showing it in metric doesn't drift it
  const inp = (k, label) => h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': label, value: f[k], oninput: e => { f[k] = e.target.value; } });
  const dim = (title, sub, ...parts) => h('div.row', h('div.row-main', h('div.row-title', title), sub && h('div.row-sub', sub)), h('div.mt-dim', parts.map(([k, unit]) => [inp(k, title + ' ' + unit), h('span', unit)])));
  const save = p => { if (!m && n(f.hi) >= 12) return ui.toast('Inches go up to 11', 'pencil', 2200);
    const lb = t => Math.round(m ? n(t) / 0.4536 : n(t)), inch = t => Math.round(m ? n(t) / 0.0254 : n(t)), heightIn = m ? (same('h', d.heightIn) ? d.heightIn : inch(f.h)) : Math.round(n(f.hf) * 12 + n(f.hi));
    if (!heightIn || !n(f.l) || !lb(f.gvw)) return ui.toast('Enter the height, length and gross weight', 'pencil', 2600);
    v.dims = { heightIn, lengthFt: same('l', d.lengthFt) ? d.lengthFt : +(m ? n(f.l) / 0.3048 : n(f.l)).toFixed(1), widthIn: same('w', d.widthIn) ? d.widthIn : inch(f.w), gvwLb: same('gvw', d.gvwLb) ? d.gvwLb : lb(f.gvw), axles: f.axles };
    v.hazmat = f.hazmat; v.fuel = f.fuel; v.mpg = same('mpg', v.mpg) ? v.mpg : +(m ? n(f.mpg) / KMPL : n(f.mpg)).toFixed(1) || 0;
    if (!same('cap', cap) && lb(f.cap) > 0 && data.load) data.load.capacity[v.id] = lb(f.cap); if (v.truckRoutes == null) v.truckRoutes = true;
    WD.changed(); p.dismiss(); ui.toast('Saved to ' + v.name, 'checkmark'); done && done(); };
  ui.sheet({ title: 'Size and capacity', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: save }],
    render: p => ui.list(
      ui.section({ header: v.name + ' · size', fold: false, showFooter: true, footer: 'Measure to the highest point, including the box and anything on the roof. Truck-legal routing compares these with bridge clearances and posted limits.' },
        m ? dim('Height', 'To the highest point', ['h', 'm']) : dim('Height', 'To the highest point', ['hf', 'ft'], ['hi', 'in']), dim('Length', 'Bumper to bumper', ['l', m ? 'm' : 'ft']), dim('Width', 'Without the mirrors', ['w', m ? 'm' : 'in'])),
      ui.section({ header: 'Weight and load', fold: false, showFooter: true, footer: 'Gross vehicle weight is the rating on the door plate: the truck and everything in it. What it carries feeds the load sheet and tells AutoRoute when to plan a trip to unload.' },
        dim('Gross vehicle weight', 'GVWR on the door plate', ['gvw', m ? 'kg' : 'lb']), dim('Carries up to', 'Paper on board', ['cap', m ? 'kg' : 'lb']),
        ui.row({ title: 'Axles', detail: String(f.axles), trailing: ui.stepper(f.axles, 2, 6, x => { f.axles = x; p.refresh(); }) }),
        ui.toggleRow({ title: 'Carries hazardous materials', subtitle: 'Keeps it off roads and tunnels closed to hazmat', value: f.hazmat, onChange: x => { f.hazmat = x; } })),
      ui.section({ header: 'Fuel', fold: false, footer: 'With the fuel price, this gives the fuel cost per mile.' },
        ui.pickerRow({ title: 'Runs on', value: f.fuel, options: [{ value: 'diesel', label: 'Diesel' }, { value: 'gasoline', label: 'Gasoline' }], onChange: x => { f.fuel = x; p.refresh(); } }), dim('Fuel economy', 'Optional', ['mpg', m ? 'km/L' : 'mpg']))) }, { detent: 'large' }); }
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
    ui.alert({ title: fresh.length > 1 ? fresh.length + ' truck reports need a look' : v.name + (x.problem ? ' · problem reported' : ' · pre-trip report'), message: h('div', h('div', x.by + ' · ' + fmt.rel(new Date(x.at))), x.defects.length ? h('div', { style: 'margin-top:6px;font-weight:600' }, 'Defects: ' + x.defects.join(', ')) : null, x.note && h('div', { style: 'margin-top:4px' }, '“' + x.note + '”'), fresh.length > 1 && h('div', { style: 'margin-top:6px' }, 'and ' + (fresh.length - 1) + ' more in Maintenance')),
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
/* Files on a repair or maintenance record: photos and PDFs (the shop's invoice, a receipt, a picture of the part). Kept on the record as
   files: [{name, kind: 'image' | 'pdf' | 'file', size, url}]. Chosen files are shown from an object URL; nothing is uploaded in the prototype. */
WD.css(`
.rp-files { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px; background: var(--cell); }
.rp-file { position: relative; width: 84px; height: 84px; border-radius: 10px; overflow: hidden; background: var(--fill3); border: 0; padding: 0; cursor: pointer; color: var(--label); font: inherit; display: grid; place-items: center; }
.rp-file img { width: 100%; height: 100%; object-fit: cover; display: block; }
.rp-file.chip { width: auto; max-width: 100%; height: 44px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; font-size: 14px; }
.rp-file.chip span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px; } .rp-file.chip small { color: var(--label2); font-size: 12px; white-space: nowrap; }
.rp-wrap { position: relative; display: inline-flex; max-width: 100%; }
.rp-x { position: absolute; top: -9px; right: -9px; width: 44px; height: 44px; border: 0; background: none; display: grid; place-items: center; cursor: pointer; padding: 0; z-index: 1; }
.rp-x i { width: 22px; height: 22px; border-radius: 50%; background: var(--label); color: var(--bg); display: grid; place-items: center; font-style: normal; font-size: 14px; font-weight: 700; line-height: 1; }
.rp-add { display: flex; gap: 8px; padding: 10px 16px; background: var(--cell); flex-wrap: wrap; } .rp-add label { cursor: pointer; }
.rp-view { padding: 16px; display: grid; place-items: center; } .rp-view img { max-width: 100%; border-radius: 10px; }
.rp-paper { width: 100%; max-width: 420px; background: #fff; color: #1c1c1e; border-radius: 10px; padding: 22px 20px; font-size: 13.5px; line-height: 19px; box-shadow: 0 1px 4px rgba(0,0,0,.14); }
.rp-paper h4 { margin: 0 0 2px; font-size: 16px; } .rp-paper small { color: #6b6b70; } .rp-paper table { width: 100%; border-collapse: collapse; margin-top: 12px; } .rp-paper td { padding: 5px 0; border-top: .5px solid #d8d8dc; } .rp-paper td:last-child { text-align: right; white-space: nowrap; }
`);
const fileSize = n => n == null ? '' : typeof n === 'string' ? n : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fileKind = file => /^image\//.test(file.type) || /\.(png|jpe?g|heic|gif|webp)$/i.test(file.name) ? 'image' : /pdf/i.test(file.type) || /\.pdf$/i.test(file.name) ? 'pdf' : 'file';
/** Tap-to-preview for one file. A picture shows itself; a PDF chosen on this device opens in the browser's own viewer; a mock PDF (no url) shows a drawn page. */
function fileSpec(x, r) {
  return { title: x.name, trailing: [{ icon: 'share', label: 'Share', onTap: () => ui.toast('Share sheet: save, print or email', 'share', 2200) }], render: () => {
    if (x.kind === 'image' && x.url) return h('div.rp-view', h('img', { src: x.url, alt: x.name }));
    if (x.url) return ui.list(ui.section({ fold: false, footer: 'Chosen on this device. It opens in the browser’s own viewer.' }, ui.row({ icon: 'doc', iconColor: 'var(--red)', title: x.name, subtitle: fileSize(x.size) }), h('div', { style: 'padding:10px 16px;background:var(--cell)' }, h('a.btn.tinted.block', { href: x.url, target: '_blank', rel: 'noopener' }, 'Open ' + (x.kind === 'pdf' ? 'the PDF' : 'the file')))));
    const v = r && q.vehicle(r.vehicleId);
    return h('div.rp-view', h('div.rp-paper', h('h4', (r && r.vendor) || 'Shop invoice'), h('small', x.name + (x.size ? ' · ' + fileSize(x.size) : '')),
      r && h('table', h('tr', h('td', 'Vehicle'), h('td', (v ? v.name : '') + (v && v.plate ? ' · ' + v.plate : ''))), h('tr', h('td', 'Date'), h('td', fmt.day(r.day, 'md') + ', ' + r.day.slice(0, 4))), r.odo ? h('tr', h('td', 'Mileage'), h('td', nfmt(r.odo))) : null, h('tr', h('td', r.title), h('td', r.cost ? fmt.money(r.cost, true) : '')), h('tr', h('td', h('b', 'Total')), h('td', h('b', r.cost ? fmt.money(r.cost, true) : '—')))),
      h('p', { style: 'margin:14px 0 0;color:#6b6b70' }, 'Sample page. In the app this is the PDF exactly as it was attached.'))); } };
}
/** Thumbnails for pictures, chips for other files; onRemove adds a remove button to each. */
function fileStrip(files, r, onRemove) {
  if (!files || !files.length) return null;
  return h('div.rp-files', files.map((x, i) => h('div.rp-wrap',
    x.kind === 'image' && x.url ? h('button.rp-file', { 'aria-label': 'Preview ' + x.name, onclick: e => { e.stopPropagation(); WD.nav.push(fileSpec(x, r)); } }, h('img', { src: x.url, alt: x.name }))
      : h('button.rp-file.chip', { 'aria-label': 'Preview ' + x.name, onclick: e => { e.stopPropagation(); WD.nav.push(fileSpec(x, r)); } }, icon(x.kind === 'image' ? 'photo' : 'doc', 18, x.kind === 'pdf' ? 'var(--red)' : 'var(--label2)'), h('span.n', x.name), x.size ? h('small', fileSize(x.size)) : null),
    onRemove && h('button.rp-x', { 'aria-label': 'Remove ' + x.name, onclick: e => { e.stopPropagation(); onRemove(i); } }, h('i', '×')))));
}
/** “Add photo” and “Add file (PDF, image)”: real file inputs. */
function fileButtons(files, refresh) {
  const take = e => { [...e.target.files].forEach(file => files.push({ name: file.name, kind: fileKind(file), size: file.size, url: URL.createObjectURL(file) })); e.target.value = ''; refresh(); };
  return h('div.rp-add', h('label.btn.tinted.small', icon('camera', 17), 'Add photo', h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, style: 'display:none', onchange: take })),
    h('label.btn.tinted.small', icon('paperclip', 17), 'Add file (PDF, image)', h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', multiple: true, style: 'display:none', onchange: take })));
}
function repairSheet(v, preset, done) {
  const f = { day: today(), kind: 'repair', title: '', vendor: '', cost: '', note: '', odo: String(F.odo[v.id] || ''), svc: '', ...preset, files: ((preset || {}).files || []).slice() };
  ui.sheet({ title: 'Add a record · ' + v.name, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.title.trim()) return ui.toast('Say what was done', 'pencil');
      const odo = parseInt(String(f.odo).replace(/\D/g, ''), 10) || F.odo[v.id] || 0; F.repairs.push({ id: uid('rp'), vehicleId: v.id, day: f.day, odo, kind: f.kind, title: f.title.trim(), vendor: f.vendor.trim(), cost: RC.num(f.cost), note: f.note.trim(), by: me(), files: f.files.slice(), fromEmail: f.fromEmail || null });
      const s = f.svc && F.services.find(x => x.id === f.svc); if (s) { s.last = odo; s.lastDay = f.day; s.lastHours = (F.hours || {})[v.id] || 0; }
      WD.changed(); p.dismiss(); ui.toast('Saved to ' + v.name, 'checkmark'); done && done(); } }],
    render: p => ui.list(ui.section({ fold: false },
        h('div', { style: 'padding:8px 16px;background:var(--cell)' }, ui.segmented([{ value: 'repair', label: 'Repair' }, { value: 'service', label: 'Scheduled maintenance' }], f.kind, v2 => { f.kind = v2; p.refresh(); })),
        ui.inputRow({ label: 'What was done', required: true, placeholder: f.kind === 'repair' ? 'e.g. Replaced marker light' : 'e.g. Oil and filter', value: f.title, onInput: v2 => { f.title = v2; } }),
        ui.dateRow({ title: 'Date', value: f.day, onChange: v2 => { f.day = v2; } }), ui.inputRow({ label: 'Mileage', inputmode: 'numeric', value: f.odo, onInput: v2 => { f.odo = v2; } }),
        ui.inputRow({ label: 'Shop or person', placeholder: 'Optional', value: f.vendor, onInput: v2 => { f.vendor = v2; } }), ui.inputRow({ label: 'Cost', inputmode: 'decimal', placeholder: '0.00', value: f.cost, onInput: v2 => { f.cost = v2; } }),
        ui.inputRow({ multiline: true, placeholder: 'Notes (optional)', value: f.note, onInput: v2 => { f.note = v2; } })),
      ui.section({ header: 'Files and photos' + (f.files.length ? ' · ' + f.files.length : ''), fold: false, showFooter: true, footer: 'The shop’s invoice, a receipt or pictures of the work. They stay with this record.' },
        fileStrip(f.files, null, i => { const x = f.files.splice(i, 1)[0]; if (x && x.url && x.url.startsWith('blob:')) URL.revokeObjectURL(x.url); p.refresh(); }), fileButtons(f.files, () => p.refresh())),
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
  return { title: x.problem ? 'Problem report' : 'Inspection', render: page => { const sig = sigOf(x), items = x.items || Object.fromEntries(F.checklist.map(k => [k, x.defects.includes(k) ? 'bad' : 'ok']));
    return ui.list(
      ui.section({ header: v.name + (v.plate ? ' · ' + v.plate : ''), fold: false }, ui.row({ title: 'Date and time', detail: stamp(x.at) }), ui.row({ title: 'Driver', detail: x.by }), ui.row({ title: 'Mileage', detail: nfmt(x.odo) + ' mi', subtitle: x.odoFrom === 'gps' ? 'From the GPS unit' : null })),
      x.report && ui.section({ header: 'Sent to Maintenance', fold: false, footer: x.report.open ? null : 'Closed by ' + (x.report.closedBy || '') + (x.report.closedAt ? ' · ' + stamp(x.report.closedAt) : '') },
        x.defects.length > 0 && ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--red)', title: plural(x.defects.length, 'defect'), subtitle: x.defects.join(', ') }), x.note && ui.row({ icon: 'note', iconColor: 'var(--orange)', title: 'Driver’s comments', subtitle: x.note }),
        x.report.open && canMaint() && ui.row({ title: 'Close this report…', tint: true, onTap: () => resolve(x, v, () => page.refresh()) })),
      !x.problem && ui.section({ header: 'Items checked', fold: false }, Object.keys(items).map(k => ui.row({ title: k, trailing: ui.badge(items[k] === 'bad' ? 'Defect' : 'OK', items[k] === 'bad' ? 'var(--red)' : 'var(--green)') }))),
      !x.problem && ui.section({ header: 'Signature', fold: false }, h('div.rc-signed', h('div.ink', sig ? sigView(sig) : h('span.secondary', 'Signed on paper')), h('div.cap', x.by + ' · ' + stamp(x.signedAt || x.at)))));
  } }; }
const historySpec = vid => ({ title: vid ? 'Inspections' : 'Inspection history', render: page => { const list = (vid ? insOf(vid) : F.inspections.slice().sort((a, b) => b.at - a.at));
  return ui.list(list.length ? ui.section({ header: plural(list.length, 'inspection') + ' · newest first', fold: false }, list.map(x => insRow(x, s => page.push(s), !vid))) : ui.empty({ icon: 'checklist', title: 'No inspections yet', text: 'Drivers do the pre-trip inspection when they clock in.' })); } });
const repRow = (r, withTruck) => ui.row({ icon: r.kind === 'service' ? 'repeat' : 'wrench', iconColor: r.kind === 'service' ? 'var(--teal)' : 'var(--orange)', title: r.title,
  subtitle: [h('div', (withTruck ? ((q.vehicle(r.vehicleId) || {}).name || 'Truck') + ' · ' : '') + fmt.day(r.day, 'md') + ', ' + r.day.slice(0, 4) + ' · ' + nfmt(r.odo) + ' mi' + (r.vendor ? ' · ' + r.vendor : '') + (r.note ? ' · ' + r.note : '')),
    (r.files || []).length > 0 && h('div', { style: 'display:flex;align-items:center;gap:4px' }, icon('paperclip', 13), plural(r.files.length, 'file') + (r.fromEmail ? ' · added from an email' : ''))],
  detail: r.cost ? fmt.money(r.cost, true) : '', chevron: true, onTap: () => WD.nav.push(repairSpec(r)) });
/** One repair or maintenance record, with its files. */
function repairSpec(r) { const v = q.vehicle(r.vehicleId) || { name: 'Truck' }, st = { adding: false };
  return { title: r.kind === 'service' ? 'Scheduled maintenance' : 'Repair', render: page => { r.files = r.files || [];
    return ui.list(ui.section({ header: v.name + (v.plate ? ' · ' + v.plate : ''), fold: false }, ui.row({ title: 'What was done', subtitle: r.title }), ui.row({ title: 'Date', detail: fmt.day(r.day, 'md') + ', ' + r.day.slice(0, 4) }), ui.row({ title: 'Mileage', detail: nfmt(r.odo) + ' mi' }),
        r.vendor && ui.row({ title: 'Shop or person', detail: r.vendor }), ui.row({ title: 'Cost', detail: r.cost ? fmt.money(r.cost, true) : '—' }), r.note && ui.row({ title: 'Notes', subtitle: r.note }), ui.row({ title: 'Added by', detail: r.by || '—', subtitle: r.fromEmail ? 'From an email: ' + r.fromEmail : null })),
      ui.section({ header: 'Files and photos' + (r.files.length ? ' · ' + r.files.length : ''), fold: false, showFooter: true, footer: r.files.length ? 'Tap a file to open it.' : 'Nothing attached yet.' },
        fileStrip(r.files, r, canMaint() ? i => { r.files.splice(i, 1); WD.changed(); page.refresh(); } : null), canMaint() && fileButtons(r.files, () => { WD.changed(); page.refresh(); }))); } }; }
RC.repairSheet = repairSheet; RC.repairSpec = repairSpec; RC.fileSpec = fileSpec; RC.fileStrip = fileStrip;
const repairsSpec = () => ({ title: 'Repairs and maintenance', render: page => { const list = F.repairs.slice().sort((a, b) => b.day.localeCompare(a.day)), yr = today().slice(0, 4), sum = list.filter(r => r.day.slice(0, 4) === yr).reduce((s, r) => s + (r.cost || 0), 0);
  return ui.list(WD.money && WD.money.inboxSection && canMaint() ? WD.money.inboxSection(page) : null,
    ui.section({ header: plural(list.length, 'record') + ' · ' + fmt.money(sum) + ' this year', fold: false, footer: 'Add a record from a truck’s page. Each record can hold photos and files.' }, list.map(r => repRow(r, true)))); } });
RC.repairsSpec = repairsSpec;
function truckSpec(v) {
  return { title: v.name, trailing: page => canMaint() ? [{ icon: 'plus', label: 'Add a record', onTap: () => repairSheet(v, {}, () => page.refresh()) }] : [],
    render: page => { const t = tel(v.id), re = () => page.refresh(), edit = canMaint(), P = WD.truckProfile(v.id) || { axles: 2 }, cpm = WD.fuelCostPerMile(v.id), open = openReports(v.id), svcs = svcOf(v.id), reps = F.repairs.filter(r => r.vehicleId === v.id).sort((a, b) => b.day.localeCompare(a.day)), ins = insOf(v.id), active = t ? t.codes.filter(c => c.active) : [];
      return ui.list(
        open.length > 0 && ui.section({ header: 'Flagged by the pre-trip inspection', fold: false }, open.map(x => [
          ui.row({ icon: 'flag', iconColor: 'var(--red)', title: x.defects.length ? x.defects.join(', ') : 'Driver’s comment', subtitle: (x.note ? '“' + x.note + '” · ' : '') + x.by + ' · ' + fmt.rel(new Date(x.at)), chevron: true, onTap: () => page.push(inspectionSpec(x)) }),
          ui.row({ title: 'Close this report…', tint: true, onTap: () => resolve(x, v, re) })])),
        (edit || v.shop) && ui.section({ fold: false }, ui.toggleRow({ icon: 'wrench', iconColor: v.shop ? 'var(--orange)' : 'var(--gray)', title: 'In the shop', subtitle: v.shop ? 'Out of service since ' + fmt.day(D.key(new Date(v.shop.since)), 'md') + (v.shop.by ? ' · ' + v.shop.by : '') : 'Switch on while it’s out of service for repairs', value: !!v.shop, disabled: !edit,
          onChange: on => { v.shop = on ? { since: +WD.now(), by: me() } : null; WD.changed(); re(); ui.toast(on ? v.name + ' marked in the shop' : v.name + ' is back in service', on ? 'wrench' : 'checkmark', 2400); } })),
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
        ui.section({ header: 'Size and capacity', fold: false, showFooter: true, footer: 'Truck-legal routing (avoiding low bridges, weight limits and roads closed to trucks) is part of the higher AutoRoute plan. Drivers can also navigate with a truck GPS app such as “Hammer: Truck GPS & Maps”, offered in Settings → Routes and board → Directions app.' },
          ui.row({ icon: 'truck', iconColor: 'var(--gray)', title: P.text || 'Height, length and weight not entered', subtitle: [P.width && fmtHigh(P.width) + ' wide', plural(P.axles, 'axle'), P.payload && 'carries ' + fmt.weight(P.payload), v.hazmat ? 'hazmat' : 'no hazmat'].filter(Boolean).join(' · '), detail: edit ? 'Edit' : null, chevron: edit, onTap: edit ? () => sizeSheet(v, re) : null }),
          ui.row({ icon: 'fuelpump', iconColor: 'var(--gray)', title: (v.fuel === 'gasoline' ? 'Gasoline' : 'Diesel') + (v.mpg ? ' · ' + (metric() ? (v.mpg * KMPL).toFixed(1) + ' km/L' : v.mpg + ' mpg') : ''), subtitle: cpm ? 'About ' + (metric() ? money(cpm / 1.609) + ' a km' : money(cpm) + ' a mile') + ' in fuel, at ' + WD.fuelPriceText(v.fuel) : 'Add the fuel economy to see the fuel cost per mile' }),
          ui.toggleRow({ title: 'Commercial truck — use truck-legal roads', subtitle: 'Directions and AutoRoute keep to roads this truck is allowed on and fits under', value: !!v.truckRoutes, disabled: !edit, onChange: on => { v.truckRoutes = on; WD.changed(); } })),
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
/** Everything that wants attention across the fleet, as rows: open pre-trip reports, low batteries, service due and active engine codes. */
const attnRows = push => { const trucks = data.vehicles.filter(v => v.active !== false);
  return [].concat(
    openReports().map(x => { const v = q.vehicle(x.vehicleId) || { name: 'Truck' }; return ui.row({ icon: 'flag', iconColor: 'var(--red)', title: v.name + ' · ' + (x.defects.length ? x.defects.join(', ') : 'driver’s comment'), subtitle: (x.problem ? 'Reported · ' : 'Pre-trip · ') + x.by + ' · ' + fmt.rel(new Date(x.at)) + (x.note ? ' · “' + x.note + '”' : ''), chevron: true, onTap: () => push(truckSpec(v)) }); }),
    trucks.filter(lowVolt).map(v => ui.row({ icon: 'battery', iconColor: 'var(--red)', title: v.name + ' · battery ' + tel(v.id).volts.toFixed(1) + ' V', subtitle: 'Below your ' + MT.voltMin.toFixed(1) + ' V limit', chevron: true, onTap: () => push(truckSpec(v)) })),
    dueList().map(x => ui.row({ icon: 'wrench', iconColor: x.st.over ? 'var(--red)' : 'var(--orange)', title: x.v.name + ' · ' + x.s.name, subtitle: x.st.text, chevron: true, onTap: () => push(truckSpec(x.v)) })),
    trucks.flatMap(v => (tel(v.id) ? tel(v.id).codes : []).filter(c => c.active).map(c => ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--orange)', title: v.name + ' · engine code ' + c.code, subtitle: CODES[c.code] || 'Manufacturer code', chevron: true, onTap: () => push(truckSpec(v)) })))); };
const attnSpec = () => ({ title: 'Needs attention', render: page => { const rows = attnRows(s => page.push(s));
  return rows.length ? ui.list(ui.section({ header: plural(rows.length, 'item') + ' · most urgent first', fold: false, footer: 'Open pre-trip reports, low batteries, service that is due and active engine codes. Tap one to open the truck.' }, rows)) : ui.empty({ icon: 'checkmark.circle', title: 'Nothing needs attention', text: 'Pre-trip reports, low batteries, service due and engine codes show here.' }); } });
/** Add, rename, re-address or delete a place where trucks start and end the day. A place in use asks where its trucks should go instead. */
function placeSheet(pl, done) { const f = { name: pl ? pl.name : '', address: pl ? pl.address : '' }, users = () => pl ? data.vehicles.filter(v => v.startId === pl.id || v.endId === pl.id) : [];
  const del = async p => { if (data.places.length < 2) return ui.alert({ title: 'Keep one location', message: 'Trucks need somewhere to start and end the day. Add another location first.' });
    const us = users(), others = data.places.filter(x => x !== pl); let to = others[0].id;
    if (us.length) { to = await ui.actionSheet({ title: 'Delete “' + pl.name + '”?', message: us.map(v => v.name).join(', ') + (us.length === 1 ? ' starts or ends' : ' start or end') + ' here. Where should ' + (us.length === 1 ? 'it' : 'they') + ' start and end instead?', buttons: others.map(x => ({ label: 'Move to ' + x.name, value: x.id })) }); if (!to) return; }
    else if (!(await ui.actionSheet({ title: 'Delete “' + pl.name + '”?', buttons: [{ label: 'Delete location', value: true, role: 'destructive' }] }))) return;
    data.vehicles.concat(Object.values(data.vehicleDays || {})).forEach(o => { if (o.startId === pl.id) o.startId = to; if (o.endId === pl.id) o.endId = to; });
    data.places.splice(data.places.indexOf(pl), 1); WD.changed(); p.dismiss(); ui.toast('Location deleted', 'checkmark'); done && done(); };
  ui.sheet({ title: pl ? 'Location' : 'New location', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: pl ? 'Save' : 'Add', bold: true, onTap: p => { const name = f.name.trim(), address = f.address.trim(); if (!name || !address) return ui.toast('Add a name and an address', 'mappin');
      if (pl) Object.assign(pl, { name, address }); else data.places.push({ id: uid('p'), name, address, x: 150 + Math.round(Math.random() * 700), y: 150 + Math.round(Math.random() * 700) }); WD.changed(); p.dismiss(); ui.toast(pl ? 'Saved' : 'Location added', 'checkmark'); done && done(); } }],
    render: p => ui.list(ui.section({ fold: false, footer: pl ? null : 'For example the yard, a storage lot or a driver’s house.' }, ui.inputRow({ label: 'Name', caps: 'words', placeholder: 'e.g. East yard', value: f.name, autofocus: !pl, onInput: v => { f.name = v; } }), ui.inputRow({ label: 'Address', placeholder: 'Street, city', value: f.address, onInput: v => { f.address = v; } })),
      pl && ui.section({ fold: false, showFooter: true, footer: users().length ? 'Used by ' + users().map(v => v.name).join(', ') + '. Deleting it asks where those trucks should start and end instead.' : 'No truck starts or ends here.' }, ui.row({ title: 'Delete location', destructive: true, onTap: () => del(p) }))) }, { detent: 'medium' }); }
/** Where trucks are kept (start and end of the day) and where they empty out. */
const locationsSpec = () => ({ title: 'Locations and disposal sites', render: page => { const edit = admin(), re = () => page.refresh(), X = WD.r11, sites = X ? X.cfg.disposal.sites : [], KIND = { recycler: 'Recycler', landfill: 'Landfill', transfer: 'Transfer station' };
  return ui.list(
    ui.section({ header: 'Where trucks start and end the day', fold: false, footer: 'Each truck has its own start and end, set on the truck. Drivers can change them for the day when they clock in.' + (edit ? '' : ' Ask an admin to change locations.') },
      data.places.map(pl => { const us = data.vehicles.filter(v => v.active !== false && (v.startId === pl.id || v.endId === pl.id)); return ui.row({ icon: pl.id === 'p1' ? 'building' : 'house', iconColor: 'var(--gray)', title: pl.name, subtitle: [h('div', pl.address), us.length > 0 && h('div', us.map(v => v.name).join(', '))], chevron: edit, onTap: edit ? () => placeSheet(pl, re) : null }); }),
      edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a location', tint: true, onTap: () => placeSheet(null, re) })),
    X && ui.section({ header: 'Recycling and disposal sites', fold: false, footer: 'Where trucks empty out. AutoRoute plans an unload stop at the nearest one when a truck fills up.' },
      sites.map(x => ui.row({ icon: x.kind === 'landfill' ? 'trash' : 'arrow.clockwise', iconColor: x.kind === 'landfill' ? 'var(--brown)' : 'var(--green)', title: x.name, subtitle: (KIND[x.kind] || 'Site') + ' · ' + x.address, chevron: edit, onTap: edit ? () => page.push(X.disposalSpec()) : null })),
      !sites.length && ui.row({ title: 'No sites yet' }),
      edit && ui.row({ icon: 'gearshape', iconPlain: true, title: 'Add or change sites, and the unload stop', tint: true, chevron: true, onTap: () => page.push(X.disposalSpec()) })));
} });
/** The Maintenance dashboard: four stat tiles, a card per truck, then Records, Fleet setup, and Costs and alerts. */
function maintRoot() {
  return { title: 'Maintenance', large: true, render: page => {
    if (!canMaint()) return ui.empty({ icon: 'lock', title: 'Maintenance is hidden', text: 'Owners, admins and people given Maintenance in Team and roles can see this section.' });
    const push = s => page.push(s), re = () => page.refresh(), edit = admin(), X = WD.r11, BZ = WD.biz, VS = WD.screens.settings && WD.screens.settings.vehiclesSpec;
    const trucks = data.vehicles.filter(v => v.active !== false), shop = trucks.filter(v => v.shop), reports = openReports(), low = trucks.filter(lowVolt), due = dueList(), codes = trucks.reduce((n, v) => n + (tel(v.id) ? tel(v.id).codes.filter(c => c.active).length : 0), 0), attn = reports.length + low.length + due.length + codes;
    const next = trucks.map(v => ({ v, n: nextSvc(v.id) })).filter(x => x.n).sort((a, b) => b.n.frac - a.n.frac)[0], tone = st => st.over ? 'var(--red)' : st.warn ? 'var(--orange)' : null;
    const tile = (k, v, s, o = {}) => h(o.onTap ? 'button.mt-tile' : 'div.mt-tile', { onclick: o.onTap || null, style: o.color ? { '--c': o.color } : null }, h('span.k', k), h('span.v' + (o.txt ? '.txt' : ''), v), h('span.s', s));
    const wide = (WD.app.paneW ? WD.app.paneW(page.el) : (S.desktop ? 1068 : 393)) >= 700, order = byUrgency(trucks);
    if (wide && !order.some(v => v.id === MUI.sel)) MUI.sel = order[0] ? order[0].id : null;
    const pick = v => { linkTruck(v); if (wide) { MUI.sel = v.id; re(); } else push(truckSpec(v)); };
    /* One color per truck: the worst thing wrong with it. The edge, the icon, the pill and the bar all use it. */
    const card = v => { const t = tel(v.id), st = truckStatus(v), items = truckItems(v), top = items[0], n = nextSvc(v.id), P = WD.truckProfile(v.id), c = n && tone(n.st);
      return h('div.mt-card' + (wide && MUI.sel === v.id ? '.sel' : ''), { role: 'button', tabindex: 0, 'aria-label': v.name + ', ' + st.label, style: { '--c': st.color }, onclick: () => pick(v) },
        h('div.top', h('div.tk', icon('truck', 21)), h('div.twho', h('div.nm', v.name), h('div.sub', [v.kind, v.plate].filter(Boolean).join(' · '))), ui.badge(st.label, st.color), !wide && icon('chevron.right', 14, 'var(--label3)')),
        h('div.meta', h('div', nfmt(F.odo[v.id] || 0) + ' mi' + (t ? ' · fuel ' + t.fuel + '% · ' + t.volts.toFixed(1) + ' V' : ' · no GPS unit')), P.text && h('div', P.text)),
        top && h('div.urg', icon(top.icon, 16, top.sev === 3 ? 'var(--red)' : 'var(--orange)'), h('span', top.text + (items.length > 1 ? ' · and ' + (items.length - 1) + ' more' : ''))),
        n && h('div.mt-bar', h('i', { style: { width: Math.max(2, Math.round(Math.min(1, n.frac) * 100)) + '%' } })),
        n && h('div.mt-next', { style: c ? { '--c2': c } : null }, h('span', 'Next service · ' + n.s.name), h('span', n.st.text))); };
    const go = (ic, title, spec, detail) => ui.row({ icon: ic, iconPlain: true, iconColor: 'var(--tint)', title, detail: detail || null, chevron: true, onTap: () => push(spec()) });
    const soon = X ? X.expiring(false, 'trucks').length : 0, track = X && { phone: 'Driver’s phone', truck: 'Truck GPS', both: 'Phone and GPS' }[X.cfg.tracking.source];
    const tiles = h('div.mt-tiles',
        tile('Trucks in service', String(trucks.length - shop.length), shop.length ? plural(shop.length, 'truck') + ' in the shop' : 'of ' + plural(trucks.length, 'truck')),
        tile('Need attention', String(attn), attn ? [reports.length && plural(reports.length, 'report'), low.length && low.length + ' low battery', due.length && due.length + ' due', codes && plural(codes, 'code')].filter(Boolean).join(' · ') : 'Nothing right now', { color: attn ? 'var(--red)' : null, onTap: () => push(attnSpec()) }),
        tile('Next service due', next ? next.n.s.name : 'None scheduled', next ? next.v.name + ' · ' + next.n.st.text : 'Add one on a truck’s page', { txt: true, color: next && tone(next.n.st), onTap: next ? () => push(truckSpec(next.v)) : null }),
        tile('Open repairs', String(reports.length + shop.length), reports.length + shop.length ? [reports.length && plural(reports.length, 'pre-trip report'), shop.length && shop.length + ' in the shop'].filter(Boolean).join(' · ') : 'Nothing open', { onTap: () => push(attnSpec()) })),
      list = h('div.section', h('div.section-header.plain', 'Trucks'), h('div.mt-cards', order.map(card)), !trucks.length && h('div.section-footer', 'No trucks yet. Add one under Fleet setup.'));
    const rest = [
      ui.section({ header: 'Records', plainHeader: true },
        go('checklist', 'Inspection history', () => historySpec(), String(F.inspections.length)),
        go('wrench', 'Repairs and maintenance log', repairsSpec, String(F.repairs.length))),
      ui.section({ header: 'Fleet setup', plainHeader: true, footer: edit ? null : 'An admin changes the fleet setup.' },
        edit && X ? go('truck', 'Trucks and capabilities', () => X.skillsSpec('trucks'), String(trucks.length)) : VS && go('truck', 'Trucks', VS, String(trucks.length)),
        go('mappin', 'Locations and disposal sites', locationsSpec, String(data.places.length + (X ? X.cfg.disposal.sites.length : 0))),
        edit && X && go('location', 'How trucks are tracked', X.trackingSpec, track),
        BZ && go('shippingbox', 'Load sheet and truck capacity', () => BZ.loadSpec()),
        BZ && go('gauge', 'Mileage and expenses', BZ.mileSpec),
        X && go('bell', 'Fleet compliance and reminders', () => X.complianceSpec('trucks'), soon ? soon + ' coming up' : null),
        BZ && go('doc.text', 'Documents and pre-trip checklist', () => BZ.fleetSpec('trucks'))),
      ui.section({ header: 'Costs and alerts', plainHeader: true, footer: 'A notification pops up for everyone with Maintenance when a truck’s battery reads below the limit, when a pre-trip inspection reports a problem, and when service is coming due. Who has Maintenance is set in Settings → Team and roles.' },
        ui.row({ icon: 'fuelpump', iconPlain: true, iconColor: 'var(--tint)', title: 'Fuel price', subtitle: (MT.fuelSplit ? fuelLine() : metric() ? 'Per liter' : 'Per gallon') + ' · updated ' + fmt.day(D.key(new Date(MT.fuelAt)), 'md'), detail: MT.fuelSplit ? null : fmt.money(metric() ? MT.fuelPrice / GAL : MT.fuelPrice, true), chevron: true, onTap: () => fuelSheet(re) }),
        ui.pickerRow({ icon: 'battery', iconPlain: true, iconColor: 'var(--tint)', title: 'Low battery alert below', value: MT.voltMin, options: [11.5, 11.8, 12.0, 12.2, 12.4].map(x => ({ value: x, label: x.toFixed(1) + ' V' })), onChange: v => { MT.voltMin = v; WD.changed(); page.refresh(); setTimeout(RC.maintCheck, 400); } }))];
    if (!wide) { const el = ui.list(tiles, list, rest); el.classList.add('mt-root'); return el; }
    /* Wide: the list stays put on the left and the chosen truck's page is drawn on the right. */
    const sel = q.vehicle(MUI.sel), left = ui.list(tiles, list, rest), spec = sel && truckSpec(sel), side = h('div.mt-side', { style: { maxHeight: Math.max(320, page.body.clientHeight || 700) + 'px' } },
      sel ? [h('div.mt-dhead', h('div.title2', sel.name), ui.badge(truckStatus(sel).label, truckStatus(sel).color), canMaint() && ui.button('Add a record', { kind: 'tinted', small: true, block: false, icon: 'plus', onTap: () => repairSheet(sel, {}, re) })), spec.render(page)]
        : ui.empty({ icon: 'truck', title: 'No trucks yet', text: 'Add one under Fleet setup.' }));
    left.classList.add('mt-root'); return h('div.wide.mt-split', left, side);
  } };
}
WD.screens.maintenance = { root: maintRoot, truckSpec, attentionSpec: attnSpec, locationsSpec, fuelSheet, sizeSheet, ui: MUI,
  /** Another column of the desktop workspace chose a truck or a route: show that truck here. */
  onLinked(sel) { const v = sel.vehicleId ? q.vehicle(sel.vehicleId) : sel.routeId && RC.vehicleOn ? RC.vehicleOn(sel.routeId, sel.day || today()) : null; if (!v || !canMaint()) return false; MUI.sel = v.id; WD.changed(); return true; } };
if (WD.app.uiState) WD.app.uiState('maintenance', MUI);

/* ================= Report a problem (drivers) ================= */
/** A driver reports something wrong with a truck at any time of day, without going through the Maintenance section (which drivers don't have).
    It is saved like a pre-trip report with a defect: Maintenance gets the alert, the truck shows Flagged, and someone closes it when it is fixed. */
RC.reportProblem = (v0, done) => {
  const trucks = data.vehicles.filter(x => x.active !== false), f = { vid: (v0 || trucks[0] || {}).id, picked: {}, note: '', drive: 'yes', files: [] };
  const submit = p => { const v = q.vehicle(f.vid), defects = F.checklist.filter(k => f.picked[k]), text = f.note.trim();
    if (!v) return ui.toast('Choose the truck', 'truck'); if (!defects.length && !text) return ui.toast('Say what’s wrong', 'pencil', 2400);
    const x = { id: uid('n'), vehicleId: v.id, by: me(), byId: S.me.id, at: +WD.now(), odo: F.odo[v.id] || 0, odoFrom: tel(v.id) ? 'gps' : 'typed', defects, note: (f.drive === 'no' ? 'Not safe to drive. ' : '') + text, problem: true, files: f.files.slice(), report: { open: true, seen: {} } };
    F.inspections.push(x); p.dismiss(); WD.changed(); ui.toast('Sent to Maintenance · ' + v.name, 'wrench', 2600); setTimeout(RC.maintCheck, 900); done && done(x); };
  ui.sheet({ title: 'Report a problem', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Send', bold: true, onTap: submit }],
    render: p => ui.list(
      ui.section({ fold: false }, ui.pickerRow({ title: 'Truck', icon: 'truck', iconColor: 'var(--gray)', value: f.vid, options: trucks.map(x => ({ value: x.id, label: x.name })), onChange: x => { f.vid = x; p.refresh(); } })),
      ui.section({ header: 'What’s wrong', fold: false },
        h('div.mt-prob', F.checklist.map(k => h('button' + (f.picked[k] ? '.on' : ''), { type: 'button', 'aria-pressed': f.picked[k] ? 'true' : 'false', onclick: () => { f.picked[k] = !f.picked[k]; p.refresh(); } }, k))),
        ui.inputRow({ multiline: true, placeholder: 'What happened? A warning light, a noise, a leak…', value: f.note, onInput: x => { f.note = x; } })),
      ui.section({ header: 'Can it still be driven?', fold: false }, h('div', { style: 'padding:8px 16px;background:var(--cell)' }, ui.segmented([{ value: 'yes', label: 'Yes, safe to drive' }, { value: 'no', label: 'No, not safe' }], f.drive, x => { f.drive = x; p.refresh(); }))),
      ui.section({ header: 'Photos' + (f.files.length ? ' · ' + f.files.length : ''), fold: false }, fileStrip(f.files, null, i => { f.files.splice(i, 1); p.refresh(); }), fileButtons(f.files, () => p.refresh())),
      h('div', { style: 'padding:6px 0 4px' }, ui.button('Send to Maintenance', { icon: 'wrench', onTap: () => submit(p) })),
      note('Everyone with Maintenance gets a notification now, and the truck shows as Flagged until someone closes the report.')) }, { detent: 'large' });
};

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
RC.pastDueFlag = job => { if (WD.r11 && WD.r11.warnOn && !WD.r11.warnOn('drivers')) return null;   // Settings → Company → Unpaid invoice warnings
  const c = job.customerId && q.customer(job.customerId), pd = RC.pastDue(c); if (pd.length < 2) return null;
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
RC.headTag = c => { const f = fault(c), show = S.prefs.showDrivers; if (!show && !f.driver && !f.truck) return null; const d = RC.driverOn(c.routeId, c.day), v = RC.vehicleOn(c.routeId, c.day);
  /* With “Show drivers on Dispatch” off, only the one that isn't qualified is named. */
  const parts = [(show || f.driver) && unq(first(d), f.driver && d), (show || f.truck) && v && unq(v.name, f.truck)].filter(Boolean);
  return h('span.bd-offrow', h('span.rc-drv' + (changed(c.routeId, c.day) ? '.ovr' : ''), { title: f.why.join(' ') || null }, parts.map((x, i) => [i ? ' · ' : null, x]))); };
/* A driver or truck that isn't qualified for a job on the route that day is named in bold red (WD.r11.routeFault). */
const fault = c => WD.r11 && WD.r11.routeFault ? WD.r11.routeFault(c.routeId, c.day) : { driver: false, truck: false, why: [] };
const unq = (text, bad) => bad ? h('b.rc-unq', { 'aria-label': text + ', not qualified' }, text) : text;
/** With one column there is no heading row, so the assignment shows as a line you can tap (or press and hold). */
RC.assignStrip = cols => { if (cols.length !== 1) return null; const c = cols[0], f = fault(c); if (!S.prefs.showDrivers && !f.driver && !f.truck) return null; const d = RC.driverOn(c.routeId, c.day), v = RC.vehicleOn(c.routeId, c.day), edit = WD.can('jobs.edit');
  return h('div.bd-strip', { style: { '--c': f.driver || f.truck ? 'var(--red)' : changed(c.routeId, c.day) ? 'var(--orange)' : 'var(--gray)', cursor: edit ? 'pointer' : 'default' }, title: f.why.join(' ') || null, onclick: () => edit && RC.assignSheet(c.routeId, c.day) }, icon('person', 16), h('span', d ? unq(d.name, f.driver) : 'No driver', v ? ' · ' : ' · no truck', v ? unq(v.name, f.truck) : null, changed(c.routeId, c.day) ? ' · this day only' : '', f.driver || f.truck ? ' · not qualified' : ''), h('span.spacer'), edit && 'Assign', edit && icon('chevron.right', 13)); };
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
      /* Everyone and every truck stays choosable. The ones that don't qualify for a job on this route that day are named in red with the reason (R20-2). */
      const fit = (u, v) => WD.r11 && WD.r11.fitFor ? WD.r11.fitFor(rid, day, u, v) : { driver: [], truck: [] }, selV = () => f.vehicleId ? q.vehicle(f.vehicleId) : null;
      const bad = (name, why) => why.length ? h('b.rc-unq', { 'aria-label': name + ', not qualified' }, name) : name, sub = (text, why) => why.length ? h('span', text, h('span.rc-unq-why', why[0] + (why.length > 1 ? ' (+' + (why.length - 1) + ' more)' : ''))) : text;
      const anyBad = drivers.some(u => fit(u, selV()).driver.length) || trucks.some(v => fit(null, v).truck.length);
      return ui.list(note(q.routeName(r) + ' · ' + fmt.day(day, 'long') + '. This changes that one day; the route’s usual driver and truck stay as they are.'),
        ui.section({ header: 'Driver', fold: false, footer: anyBad ? 'Red: not qualified for a job on this route that day. You can still choose them.' : null, showFooter: true }, drivers.map(u => { const on = RC.routeOf(u.id, day), off = WD.offOn && WD.offOn(u.id, day), why = fit(u, selV()).driver;
            return pickRow(f.driverId === u.id, bad(u.name, why), sub(on ? (on.id === rid ? 'On this route' : 'On ' + q.routeName(on)) : 'Not on a route that day', why), () => { f.driverId = u.id; }, off ? 'Time off' : null); }),
          pickRow(!f.driverId, 'No driver', 'Leave the route unassigned', () => { f.driverId = null; })),
        ui.section({ header: 'Truck', fold: false }, trucks.map(v => { const on = q.routes().find(x => (RC.vehicleOn(x.id, day) || {}).id === v.id);
          const why = fit(null, v).truck;
          return pickRow(f.vehicleId === v.id, bad(v.name, why), sub((v.kind || '') + (on ? ' · ' + (on.id === rid ? 'on this route' : 'on ' + q.routeName(on)) : ' · free that day'), why), () => { f.vehicleId = v.id; }, v.shop ? 'In the shop' : null); })),
        changed(rid, day) && ui.section(null, ui.row({ title: 'Back to the usual driver and truck', destructive: true, onTap: () => { delete RA[rid + '|' + day]; WD.changed(); p.dismiss(); ui.toast('Back to the usual assignment', 'checkmark'); } }))); } }, { detent: 'large' });
};

/* ================= Demo data for the driver's day, and panel shortcuts ================= */
(() => { const open = todays('r1'), a = open[1] || open[0], b2 = open[2] || open[0];
  if (a && !hddQty(a)) { a.items = (a.items || []).concat([{ id: 'hdd', qty: 4, rate: 15 }]); a.hddScan = false; }
  if (b2 && b2 !== a) { b2.deliver = '1 console and 1 bin (64 gal)'; b2.checklist = [{ id: 'dk1', text: 'New containers placed where the customer wants them', req: true }, { id: 'dk2', text: 'Keys handed to the site contact', req: true }, { id: 'dk3', text: 'Photo of each container in place', req: false, photo: true }]; }
  /* A customer on today's North Route with several invoices past due, so the flag shows at the stop. */
  const c = (open[0] && q.customer(open[0].customerId)) || null;
  if (c && data.invoices) [[82, 138], [58, 96], [51, 96], [17, 96]].forEach(([ago, amount], i) => data.invoices.push({ id: 'inv-pd' + i, number: (n => { while (data.invoices.some(x => x.number === 'INV-' + n)) n++; return 'INV-' + n; })(2231 + i * 7), customerId: c.id, jobId: null, day: D.add(today(), -ago), amount, status: ago > 45 ? 'Overdue' : 'Sent', auto: false, payments: [], at: +D.parse(D.add(today(), -ago)) }));
})();
WD.panel.addAction('Truck battery drops below the limit', () => { const v = q.vehicle('v3') || data.vehicles[0], t = tel(v.id); if (!t) return; t.volts = +(MT.voltMin - 0.3).toFixed(1); t.at = +WD.now(); WD.changed(); RC.maintCheck(); if (!canMaint()) ui.toast('Only people with Maintenance are notified', 'lock', 2600); });
WD.panel.addAction('Driver reports a pre-trip defect', () => { const v = q.vehicle('v1') || data.vehicles[0], d = q.user('u4') || { name: 'Marcus Bell', id: 'u4' };
  F.inspections.push({ id: uid('n'), vehicleId: v.id, by: d.name, byId: d.id === S.me.id ? 'someone-else' : d.id, at: +WD.now(), odo: F.odo[v.id], odoFrom: 'gps', defects: ['Brakes'], note: 'Soft pedal and a squeal from the front left.', sig: d.signature, signedAt: +WD.now(), report: { open: true, seen: {} } }); WD.changed(); RC.maintCheck(); if (!canMaint()) ui.toast('Only people with Maintenance are notified', 'lock', 2600); });
WD.panel.addJump('Maintenance', () => WD.nav.switchTab('maintenance'));
})();
