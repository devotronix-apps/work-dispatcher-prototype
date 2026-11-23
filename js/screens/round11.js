/* RouteClerk prototype — round 11 (owner feedback of 2026-11-16), part 1: the add-ons and their settings. Registers WD.r11.
   Skills, licenses and clearances matched to jobs (block or flag), truck capabilities (hard drives), non-paper materials, disposal sites and
   the unload stop in AutoRoute, truck and warehouse inventory, compliance reminders, country / currency / units, how trucks are tracked,
   exact-time jobs, window and time-on-site overrides, pickup-and-delivery pairs. Part 2 (round11b.js) holds the Admin tab, unpaid invoices,
   route notes, the Tasks pipeline rows and Change Route. Every one of these can be switched on, off or changed in Settings. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You', admin = () => WD.can('settings.manage');
const plural = (n, w) => n + ' ' + (n === 1 ? w : /(x|s|ch)$/.test(w) ? w + 'es' : w + 's');
const uid = p => p + Date.now().toString(36) + Math.floor(Math.random() * 1e3);
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'This needs the Company settings permission. An owner or admin can grant it in Team and roles.' });
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const ask = async (title, placeholder, value, message) => { const r = await ui.alert({ title, message, input: { placeholder, value: value || '' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); return r && r.value && r.text.trim() ? r.text.trim() : null; };
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const shortT = m => { const hh = Math.floor(m / 60) % 24, mm = m % 60; return (hh % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (hh < 12 ? 'a' : 'p'); };
const daysTo = k => D.diff(k, today());
const X = WD.r11 = {};

WD.css(`
.r1-sw { display: flex; flex-wrap: wrap; gap: 8px; }
.r1-sw button { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--sep); cursor: pointer; padding: 0; } .r1-sw button.on { border: 3px solid var(--label); }
.r1-num { width: 74px; flex: none; text-align: right; border: 0; border-radius: 8px; background: var(--fill3); color: var(--label); font: inherit; font-size: 16px; padding: 6px 8px; }
.r1-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 3px; } .r1-chips span { font-size: 12px; font-weight: 600; border-radius: 8px; padding: 1px 7px; background: var(--fill2); color: var(--label2); }
.r1-chips span.bad { background: color-mix(in srgb, var(--red) 16%, transparent); color: var(--red); } .r1-chips span.warn { background: color-mix(in srgb, var(--orange) 18%, transparent); color: var(--orange); } .r1-chips span.ok { background: color-mix(in srgb, var(--green) 16%, transparent); color: var(--green); }
.bd-job.hd .bd-job-in { box-shadow: inset 0 0 0 2px #FFD60A; }
.r1-banner { margin: 12px 16px 0; border-radius: 12px; background: #FFE066; color: #1C1C1E; border-left: 5px solid #E0A800; padding: 10px 12px; font-size: 15px; line-height: 20px; font-weight: 600; }
.r1-banner small { display: block; font-size: 12px; letter-spacing: .3px; text-transform: uppercase; opacity: .7; }
`);

/* ================= Settings data ================= */
const C = X.cfg = data.addons = {
  /* Inventory: off by default. Counted for the warehouse (the business location) and for each truck; completing a job uses up the truck's stock. */
  inventory: { on: false, items: [{ id: 'console', name: 'Consoles', unit: 'console', min: 2 }, { id: 'bin64', name: '64-gallon bins', unit: 'bin', min: 2 }, { id: 'bin96', name: '96-gallon bins', unit: 'bin', min: 1 }, { id: 'lock', name: 'Locks and keys', unit: 'lock', min: 4 }, { id: 'bag', name: 'Shred bags', unit: 'bag', min: 20 }],
    stock: { wh: { console: 24, bin64: 18, bin96: 6, lock: 40, bag: 300 }, v1: { console: 3, bin64: 2, bin96: 0, lock: 6, bag: 30 }, v2: { console: 2, bin64: 1, bin96: 1, lock: 3, bag: 24 }, v3: { console: 1, bin64: 2, bin96: 2, lock: 2, bag: 12 }, v4: { console: 0, bin64: 0, bin96: 0, lock: 0, bag: 60 } }, log: [] },
  /* Skills, licenses and clearances. mode: 'flag' marks a job assigned to someone who lacks what it needs; 'block' refuses the assignment. */
  skills: { on: true, mode: 'flag', list: [{ id: 'cdl', name: 'CDL (Class B)', kind: 'license' }, { id: 'hddskill', name: 'Hard drive destruction', kind: 'skill' }, { id: 'prison', name: 'Prison clearance', kind: 'clearance', scoped: true }, { id: 'forklift', name: 'Forklift', kind: 'skill' }] },
  /* What a truck can do. A job with hard drives needs a truck that can shred them, or a crusher sent with the driver. */
  caps: [{ id: 'hdd', name: 'Shreds hard drives' }, { id: 'nonpaper', name: 'Shreds non-paper (x-rays, textiles)' }, { id: 'liftgate', name: 'Lift gate' }],
  pairs: { on: false },
  tracking: { source: 'both' },                    // company default: 'phone' (the driver's phone), 'truck' (the truck's GPS unit) or 'both'; each vehicle can differ
  compliance: { noticeDays: 30, carb: true, carbMonths: 6 },
  disposal: { suggest: true, unloadMin: 25, nonPaper: 'offsite',
    sites: [{ id: 'd1', name: 'Lakemont Paper Recycling', kind: 'recycler', address: '2200 Mill Rd, Lakemont', x: 610, y: 470 }, { id: 'd2', name: 'Westside Fiber Recyclers', kind: 'recycler', address: '75 Depot Ln, Lakemont', x: 205, y: 395 }, { id: 'd3', name: 'Tri-County Landfill', kind: 'landfill', address: '1 Old Quarry Rd, Lakemont', x: 830, y: 690 }] },
  unpaid: { limit: 2, overdueDays: 30, on: true, board: true, customers: true, drivers: true },   // on: master switch for the warnings; board / customers / drivers: where they show
  exact: { on: true, color: '#00897B' },
  /* Purge sub-categories for anything that is not paper. They show in their own color so they are never mistaken for a regular purge. */
  materials: [{ id: 'xray', name: 'X-rays and film', color: '#EF6C00' }, { id: 'media', name: 'Hard drives and media', color: '#6D4C41' }, { id: 'textile', name: 'Textiles and uniforms', color: '#AD1457' }, { id: 'product', name: 'Products and other non-paper', color: '#5E35B1' }],
  approvals: { driverPrice: false, requests: [] },
  letters: { days: 30, method: 'email' },
  portal: { cardPct: 3.5, cardFixed: 0, achPct: 1, achFixed: 0, achCap: 10 },   // percent + fixed dollars per payment; achCap = the most an ACH fee can be (0 = no cap)
  contract: { term: 12, notice: 60, max: 60 },
};
const skill = id => C.skills.list.find(s => s.id === id), mat = id => C.materials.find(m => m.id === id);
const KIND = { skill: 'Skill', license: 'License', clearance: 'Clearance' };
data.routeNotes = data.routeNotes || {};

/* ---------- Demo data, so every add-on has something to show ---------- */
(function seed() {
  const U = id => q.user(id), V = id => q.vehicle(id), t = today();
  if (U('u4')) U('u4').creds = [{ id: 'cdl', expires: D.add(t, 410), number: 'B-4471902' }, { id: 'prison', covers: 'all', expires: D.add(t, 205) }, { id: 'hddskill' }];
  if (U('u5')) U('u5').creds = [{ id: 'cdl', expires: D.add(t, 19), number: 'B-3920117' }, { id: 'hddskill' }, { id: 'prison', covers: 'all', expires: D.add(t, -12) }];
  if (U('u6')) U('u6').creds = [{ id: 'prison', covers: 'Ridgeview State Prison', expires: D.add(t, 150) }];
  if (U('u8')) U('u8').creds = [{ id: 'forklift', expires: D.add(t, 300) }];
  if (V('v1')) { V('v1').caps = ['hdd', 'liftgate']; } if (V('v2')) { V('v2').caps = ['hdd']; V('v2').needs = 'cdl'; } if (V('v3')) V('v3').caps = ['liftgate']; if (V('v4')) { V('v4').caps = ['nonpaper', 'liftgate']; V('v4').needs = 'cdl'; }
  data.vehicles.forEach(v => { v.track = v.gps ? '' : 'phone'; });
  const prison = q.customer('c31'); if (prison) prison.needs = [{ id: 'prison', covers: 'Lakemont Correctional Facility' }];
  /* CARB Clean Truck Check (California): every 6 months per truck. */
  if (data.fleet) data.vehicles.forEach((v, i) => data.fleet.docs.push({ id: uid('d'), owner: v.id, name: 'CARB Clean Truck Check', expires: D.add(t, [48, 22, 131, -3][i % 4]), renewMonths: 6, carb: true }));
  /* A job with hard drives on a truck that can't shred them, an on-site x-ray purge, and an exact-time job. */
  const ellen = data.jobs.find(j => j.day === t && j.customerId === 'c21'); if (ellen) { ellen.items.push({ id: 'hdd', qty: 6, rate: 15 }); ellen.hddScan = false; }
  data.jobs.filter(j => j.customerId === 'c23' && j.day > t).slice(1, 3).forEach(j => { j.material = 'xray'; j.handling = 'onsite'; j.title = 'Vista Medical Billing — x-ray purge'; });
  const raj = data.jobs.find(j => /Raj Patel/.test(j.title)); if (raj) Object.assign(raj, { exactAt: '09:00', custFrom: '09:00', custUntil: '09:15', custStrict: true, notes: 'Meeting us at his storage unit at 9:00 sharp.' });
  let rd = t; if (D.parse(rd).getDay() === 0) rd = D.add(rd, 1);
  data.routeNotes['r1|' + rd] = { text: 'Northgate Credit Union has a new security desk. Sign in at the side entrance and ask for Derek.', to: 'driver', by: 'Priya Raman', at: +WD.now() - 2 * 36e5 };
  data.routeNotes['r3|' + rd] = { text: 'Truck 7 goes to Lakemont Fleet Service at 3:30. Be back at the lot by 3:15.', to: 'both', by: 'Dana Whitfield', at: +WD.now() - 3 * 36e5 };
})();

/* ================= Country, currency and units ================= */
const COUNTRIES = [['US', 'United States', 'USD', 'us'], ['CA', 'Canada', 'CAD', 'metric'], ['MX', 'Mexico', 'MXN', 'metric'], ['GB', 'United Kingdom', 'GBP', 'us'], ['IE', 'Ireland', 'EUR', 'metric'], ['NL', 'Netherlands', 'EUR', 'metric'], ['DE', 'Germany', 'EUR', 'metric'], ['FR', 'France', 'EUR', 'metric'],
  ['ES', 'Spain', 'EUR', 'metric'], ['IT', 'Italy', 'EUR', 'metric'], ['SE', 'Sweden', 'SEK', 'metric'], ['CH', 'Switzerland', 'CHF', 'metric'], ['AU', 'Australia', 'AUD', 'metric'], ['NZ', 'New Zealand', 'NZD', 'metric'], ['ZA', 'South Africa', 'ZAR', 'metric'], ['IN', 'India', 'INR', 'metric'], ['SG', 'Singapore', 'SGD', 'metric'], ['JP', 'Japan', 'JPY', 'metric'], ['BR', 'Brazil', 'BRL', 'metric']];
const currencies = () => { try { return Intl.supportedValuesOf('currency'); } catch (e) { return ['USD', 'CAD', 'MXN', 'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'AUD', 'NZD', 'ZAR', 'INR', 'SGD', 'JPY', 'BRL']; } };
const curName = code => { try { return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code); } catch (e) { return code; } };
const countryName = () => (COUNTRIES.find(c => c[0] === WD.locale.country) || COUNTRIES[0])[1];
const currencySpec = () => { let term = ''; return { title: 'Currency', search: { placeholder: 'Search currencies', onInput: (v, p) => { term = v.trim().toLowerCase(); p.refresh(); } },
  render: page => { const list = currencies().map(c => ({ c, n: curName(c) })).filter(x => !term || x.c.toLowerCase().includes(term) || String(x.n).toLowerCase().includes(term));
    return ui.list(ui.section({ fold: false, footer: 'Every amount in the app, on invoices and in the customer portal uses this currency.' }, list.map(x => ui.row({ title: x.n, subtitle: x.c, trailing: x.c === WD.locale.currency ? icon('checkmark', 20, 'var(--tint)') : null, onTap: () => { WD.locale.currency = x.c; WD.changed(); page.pop(); } })))); } }; };
X.unitsSpec = () => ({ title: 'Country, currency and units', render: page => { if (!admin()) return locked(); const L = WD.locale, re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('For companies outside the United States. Choosing a country fills in its usual currency and units; each can then be changed on its own.'),
    ui.section({ header: 'Country', fold: false, footer: 'Sets how numbers and dates are written, and the address and phone formats to expect.' },
      ui.pickerRow({ title: 'Country', icon: 'globe', iconColor: 'var(--blue)', value: L.country, options: COUNTRIES.map(c => ({ value: c[0], label: c[1] })), onChange: v => { const c = COUNTRIES.find(x => x[0] === v); L.country = v; L.currency = c[2]; L.units = c[3]; L.tag = 'en-' + v; re(); } })),
    ui.section({ header: 'Currency and units', fold: false, footer: 'Example: ' + fmt.money(1234.5, true) + ' · ' + fmt.dist(12) + ' · ' + fmt.weight(6000) + '. Distances show on the planning map and mileage; weights on the load sheet and truck capacity.' },
      ui.row({ icon: 'dollarsign.circle', iconColor: 'var(--green)', title: 'Currency', detail: L.currency + ' · ' + curName(L.currency), chevron: true, onTap: () => page.push(currencySpec()) }),
      h('div.row', h('div.row-main', h('div.row-title', 'Units')), h('div', { style: 'width:210px;flex:none' }, ui.segmented([{ value: 'us', label: 'Miles, pounds' }, { value: 'metric', label: 'Kilometers, kg' }], L.units, v => { L.units = v; re(); })))),
    ui.section({ header: 'Language', fold: false, footer: 'The app is in English for now. Other languages are planned; the wording of every text, email, letter, invoice and agreement can already be rewritten in any language in Settings → Templates.' },
      ui.pickerRow({ title: 'Language', value: L.language, options: [{ value: 'en', label: 'English' }], onChange: () => {} })));
} });

/* ================= Skills, licenses and clearances; truck capability ================= */
const hddQty = job => (((job.items || []).find(i => i.id === 'hdd') || {}).qty) || 0;
const vehicleFor = (routeId, day) => { const r = q.route(routeId), sh = S.shift; if (!r) return null; if (sh && sh.routeId === routeId && sh.vehicleId && (!day || day === today())) return q.vehicle(sh.vehicleId);
  return day && WD.rc && WD.rc.vehicleOn ? WD.rc.vehicleOn(routeId, day) : q.vehicle(r.vehicleId); };
/** The driver of a route on a day: the day's assignment (rc-ops.js) when there is one, else the route's usual driver. */
const driverOf = (routeId, day) => day && WD.rc && WD.rc.driverOn ? WD.rc.driverOn(routeId, day) : q.driverFor(routeId);
/** What a job needs from whoever does it: its own requirements plus its customer's (for example a prison's clearance). [{id, covers}] */
X.needsOf = job => { const c = job.customerId && q.customer(job.customerId); return (job.needs || []).map(id => ({ id })).concat((c && c.needs) || []); };
/** Does this person hold the credential on that day? → 'ok', 'expired', 'scope' (a clearance for a different institution) or 'none'. */
const holds = (u, need, day) => { const mine = ((u && u.creds) || []).filter(c => c.id === need.id); if (!mine.length) return 'none';
  const scoped = mine.filter(c => !need.covers || !c.covers || c.covers === 'all' || c.covers === need.covers); if (!scoped.length) return 'scope';
  return scoped.some(c => !c.expires || c.expires >= day) ? 'ok' : 'expired'; };
const needText = n => { const s = skill(n.id); return s ? s.name + (n.covers ? ' · ' + n.covers : '') : ''; };
/** Everything wrong with a job on a route and day: [{level: 'bad' | 'warn', who: 'driver' | 'truck' (which of the two falls short), short (for the card), text}]. o.vehicle adds the truck's own license. */
X.issues = (job, routeId, day, o = {}) => {
  if (!job || job.allDay || job.type === 'dump') return []; routeId = routeId || job.routeId; day = day || job.day;
  const out = [], v = vehicleFor(routeId, day), d = driverOf(routeId, day), who = d ? d.name.split(' ')[0] : 'No driver';
  if (hddQty(job) > 0 && !job.crusher && !(v && (v.caps || []).includes('hdd'))) out.push({ level: 'bad', who: 'truck', short: 'Needs HD truck or crusher', text: (v ? v.name : 'This route’s truck') + ' can’t shred hard drives. Send a truck that can, or send a hard drive crusher with the driver.' });
  if (job.material && job.handling === 'onsite' && !(v && (v.caps || []).includes('nonpaper'))) out.push({ level: 'warn', who: 'truck', short: 'Non-paper truck', text: (v ? v.name : 'This route’s truck') + ' isn’t marked for non-paper materials. Pick the material up to shred offsite, or send a truck that can.' });
  if (C.skills.on) {
    X.needsOf(job).forEach(n => { const s = skill(n.id); if (!s) return; if (!d) return out.push({ level: 'warn', short: s.name + ': no driver', text: 'Needs ' + needText(n) + ', and this route has no driver assigned.' });
      const st = holds(d, n, day); if (st === 'ok') return;
      out.push({ level: 'bad', who: 'driver', short: st === 'expired' ? who + ': ' + s.name.toLowerCase() + ' expired' : st === 'scope' ? who + ': not cleared here' : who + ' lacks ' + s.name.toLowerCase(),
        text: st === 'expired' ? d.name + '’s ' + s.name.toLowerCase() + ' has expired.' : st === 'scope' ? d.name + '’s ' + s.name.toLowerCase() + ' does not cover ' + n.covers + '.' : d.name + ' does not have ' + needText(n) + ' on file.' }); });
    if (o.vehicle && v && v.needs && d) { const s = skill(v.needs), st = holds(d, { id: v.needs }, day); if (s && st !== 'ok') out.push({ level: 'bad', who: 'driver', short: who + ': ' + s.name + ' needed', text: v.name + ' takes a ' + s.name + ' to drive. ' + d.name + (st === 'expired' ? '’s has expired.' : ' does not have one on file.') }); }
  }
  return out;
};
/** Upcoming open jobs with a problem (today through the next 14 days). */
X.flagged = () => { const t = today(), end = D.add(t, 14); return data.jobs.filter(j => j.day >= t && j.day <= end && !WD.closed[j.status] && !j.allDay).map(j => ({ job: j, issues: X.issues(j).filter(i => i.level === 'bad') })).filter(x => x.issues.length).sort((a, b) => a.job.day.localeCompare(b.job.day) || q.order(a.job, b.job)); };
/** Before assigning jobs to a route: block it or flag it, as the company chose. Resolves true when the move may go ahead. */
X.checkAssign = async (jobs, routeId, day) => {
  const found = []; jobs.forEach(j => X.issues(j, routeId, day || j.day, { vehicle: true }).filter(i => i.level === 'bad').forEach(i => { if (!found.some(f => f.text === i.text)) found.push({ ...i, job: j }); }));
  if (!found.length) return true;
  const list = h('div', found.slice(0, 5).map(f => h('div', { style: 'margin-top:4px' }, '• ' + f.text)), found.length > 5 ? h('div', { style: 'margin-top:4px' }, 'and ' + (found.length - 5) + ' more') : null);
  if (C.skills.mode === 'block') { await ui.alert({ title: 'Can’t assign to ' + q.routeName(routeId), message: h('div', list, h('div', { style: 'margin-top:8px' }, 'Your company blocks assignments that don’t meet the job’s requirements (Settings → Skills, licenses and clearances).')) }); return false; }
  return !!(await ui.actionSheet({ title: 'This doesn’t meet the job’s requirements', message: h('div', list, h('div', { style: 'margin-top:8px' }, 'It can still be assigned. The job stays flagged on the board until it is fixed.')), buttons: [{ label: 'Assign anyway and flag it', value: true }] }));
};
/** Is the driver or the truck of a route unqualified for any open job that day? → {driver, truck, why: [text]}. The board shows that name in bold red. */
X.routeFault = (routeId, day) => { const out = { driver: false, truck: false, why: [] };
  q.jobsFor(routeId, day).filter(j => !j.allDay && !WD.closed[j.status]).forEach(j => X.issues(j, routeId, day, { vehicle: true }).forEach(i => { if (i.who === 'driver' && i.level === 'bad') out.driver = true; else if (i.who === 'truck') out.truck = true; else return; if (!out.why.includes(i.text)) out.why.push(i.text); }));
  return out; };
/** Flagged assignments still to review: the ones nobody has ignored (job.qualIgnored; cleared when the app is next opened, WD.reopenApp). */
X.toReview = () => X.flagged().filter(x => !x.job.qualIgnored);
/* Cards and pins: what makes a job stand out. */
const baseColor = WD.cardColor;
WD.cardColor = job => job.type === 'dump' ? baseColor(job) : C.exact.on && job.exactAt ? C.exact.color : job.type === 'purge' && job.material && mat(job.material) ? mat(job.material).color : baseColor(job);
/** Are the unpaid-invoice warnings showing? where: 'board' | 'customers' | 'drivers' (none = the master switch alone). Settings → Company → Unpaid invoice warnings. */
X.warnOn = where => C.unpaid.on !== false && (!where || C.unpaid[where] !== false);
WD.cardClass = job => (hddQty(job) > 0 ? '.hd' : '') + (X.warnOn('board') && X.overLimit && job.customerId && X.overLimit(q.customer(job.customerId)) && !WD.closed[job.status] ? '.unpaid' : '');
WD.cardTags = job => { const out = [], flag = (text, cls) => out.push(h('span.bd-flag' + (cls ? '.' + cls : ''), text)), bad = X.issues(job);
  if (hddQty(job) > 0) flag(hddQty(job) + ' hard drive' + (hddQty(job) === 1 ? '' : 's') + (job.crusher ? ' · crusher' : ''));
  if (job.type === 'purge' && job.material && mat(job.material)) flag(mat(job.material).name + (job.handling === 'onsite' ? ' · on site' : ' · pick up'));
  if (job.pair) flag(job.pair.role === 'pickup' ? 'Pickup ①' : 'Delivery ②');
  bad.forEach(i => flag(i.short, i.level));
  if (X.warnOn('board') && X.overLimit && job.customerId && X.overLimit(q.customer(job.customerId))) flag('Unpaid invoices', 'bad');
  return out; };

const credRow = (u, c, page, edit) => { const s = skill(c.id) || { name: c.id, kind: 'skill' }, n = c.expires ? daysTo(c.expires) : null;
  return ui.row({ title: s.name + (s.scoped ? ' · ' + (c.covers === 'all' || !c.covers ? 'all institutions' : c.covers) : ''), subtitle: [KIND[s.kind], c.number, n == null ? 'No expiry' : n < 0 ? h('span', { style: 'color:var(--red);font-weight:600' }, 'Expired ' + plural(-n, 'day') + ' ago') : n <= C.compliance.noticeDays ? h('span', { style: 'color:var(--orange);font-weight:600' }, 'Expires in ' + plural(n, 'day')) : 'Expires ' + fmt.day(c.expires, 'md') + ', ' + c.expires.slice(0, 4)].filter(Boolean).map((x, i) => [i ? ' · ' : '', x]),
    chevron: edit, onTap: edit ? async () => { const a = await ui.actionSheet({ title: s.name + ' · ' + u.name, buttons: [{ label: 'Renewed: set a new expiry date…', value: 'date' }, s.scoped && { label: 'Change what it covers…', value: 'covers' }, { label: 'No expiry', value: 'never' }, { label: 'Remove', value: 'del', role: 'destructive' }].filter(Boolean) });
      if (a === 'date') { const d = await WD.screens.jobs.pickDay('Expires on', c.expires && c.expires > today() ? c.expires : D.add(today(), 365)); if (d) c.expires = d; }
      else if (a === 'covers') c.covers = await coversPick(c.covers); else if (a === 'never') c.expires = null; else if (a === 'del') u.creds.splice(u.creds.indexOf(c), 1);
      if (a) { WD.changed(); page.refresh(); } } : null }); };
async function coversPick(cur) { const v = await ui.actionSheet({ title: 'What does this clearance cover?', message: 'Some clearances cover most institutions; others are good for one only.', buttons: [{ label: 'All institutions', value: 'all' }, { label: 'One institution…', value: 'one' }] }); if (!v) return cur || 'all'; if (v === 'all') return 'all'; return (await ask('Which institution?', 'e.g. Ridgeview State Prison', cur && cur !== 'all' ? cur : '')) || cur || 'all'; }
async function addCred(u, page) {
  const id = await ui.actionSheet({ title: 'Add for ' + u.name, buttons: C.skills.list.map(s => ({ label: s.name + ' · ' + KIND[s.kind].toLowerCase(), value: s.id })) }); if (!id) return; const s = skill(id), c = { id };
  if (s.scoped) c.covers = await coversPick('all');
  if (s.kind !== 'skill') { const d = await WD.screens.jobs.pickDay(s.name + ' expires on', D.add(today(), 365)); if (d) c.expires = d; }
  (u.creds = u.creds || []).push(c); WD.changed(); page.refresh();
}
/** On a team member's page (Settings → Team and roles). */
X.memberSection = (u, page) => !C.skills.on ? null : ui.section({ header: 'Skills, licenses and clearances', fold: false, footer: 'Matched against what each job, customer and truck needs. Expiry dates get a reminder ' + C.compliance.noticeDays + ' days ahead.' },
  (u.creds || []).map(c => credRow(u, c, page, WD.can('users.manage'))), !(u.creds || []).length && ui.row({ title: 'Nothing on file' }),
  WD.can('users.manage') && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a skill, license or clearance', tint: true, onTap: () => addCred(u, page) }));
const personSpec = u => ({ title: u.name, render: page => ui.list(X.memberSection(u, page)) });
function skillSheet(s, page) {
  const f = s ? { ...s } : { id: uid('sk'), name: '', kind: 'skill', scoped: false };
  ui.sheet({ title: s ? 'Edit' : 'New requirement', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.name.trim()) return ui.toast('Give it a name', 'pencil'); f.name = f.name.trim(); if (s) Object.assign(s, f); else C.skills.list.push(f); WD.changed(); p.dismiss(); page.refresh(); } }],
    render: p => ui.list(ui.section({ footer: 'A skill has no expiry. A license or clearance usually expires and gets a reminder.' }, ui.inputRow({ label: 'Name', placeholder: 'e.g. Backflow certification', value: f.name, autofocus: !s, onInput: v => { f.name = v; } })),
      ui.section({ fold: false, footer: f.kind === 'clearance' ? 'Switch on when a clearance can be limited to one site, like a background check that covers a single prison.' : null },
        ui.pickerRow({ title: 'Kind', value: f.kind, options: Object.entries(KIND).map(([value, label]) => ({ value, label })), onChange: v => { f.kind = v; p.refresh(); } }),
        f.kind === 'clearance' && ui.toggleRow({ title: 'Can be limited to one site', value: !!f.scoped, onChange: v => { f.scoped = v; } })),
      s && ui.section(null, ui.row({ title: 'Delete', destructive: true, onTap: async () => { if (await ui.actionSheet({ title: 'Delete “' + s.name + '”?', message: 'It is removed from people, jobs, customers and trucks.', buttons: [{ label: 'Delete', value: true, role: 'destructive' }] })) {
        C.skills.list.splice(C.skills.list.indexOf(s), 1); data.users.forEach(u => { u.creds = (u.creds || []).filter(c => c.id !== s.id); }); data.jobs.forEach(j => { if (j.needs) j.needs = j.needs.filter(x => x !== s.id); }); data.customers.forEach(c => { if (c.needs) c.needs = c.needs.filter(x => x.id !== s.id); }); data.vehicles.forEach(v => { if (v.needs === s.id) v.needs = ''; }); WD.changed(); p.dismiss(); page.refresh(); } } }))) }, { detent: 'medium' });
}
/** o: {inView(job), label} from the board: the jobs on the day (or days) showing come first, apart from the other days. */
X.issuesSpec = (o = {}) => ({ title: 'Flagged assignments', render: page => { const all = X.flagged(), list = all.filter(x => !x.job.qualIgnored), ignored = all.filter(x => x.job.qualIgnored), re = () => { WD.changed(); page.refresh(); };
  const here = o.inView ? list.filter(x => o.inView(x.job)) : [], rest = list.filter(x => !here.includes(x));
  const row = (x, ign) => h('div.row', { style: 'flex-wrap:wrap;gap:8px' }, h('div.row-main', { style: 'cursor:pointer', onclick: () => WD.screens.jobs.openDetails(x.job.id) }, h('div.row-title', x.job.title), h('div.row-sub', fmt.day(x.job.day, 'rel') + ' · ' + q.routeName(x.job.routeId)), x.issues.map(i => h('div.row-sub', { style: 'color:var(--red);font-weight:600' }, i.text))),
    h('div', { style: 'display:flex;gap:6px;flex:none' }, ui.button(ign ? 'Stop ignoring' : 'Ignore', { kind: 'gray', small: true, block: false, onTap: () => { x.job.qualIgnored = !ign; re(); } }), !ign && ui.button('Open', { kind: 'filled', small: true, block: false, onTap: () => WD.screens.jobs.openDetails(x.job.id) })));
  const all0 = (xs, text) => xs.length > 1 && ui.row({ title: text, tint: true, center: true, onTap: () => { xs.forEach(x => { x.job.qualIgnored = true; }); re(); } });
  return ui.list(
    o.inView && ui.section({ header: (o.label || 'Showing now') + ' · ' + here.length, fold: false }, here.map(x => row(x)), all0(here, 'Ignore all ' + here.length + ' for now'), !here.length && ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Nothing left to review here' })),
    (rest.length > 0 || !o.inView) && ui.section({ header: o.inView ? 'Other days · ' + rest.length : list.length ? plural(list.length, 'job') + ' in the next 2 weeks' : null, fold: false, showFooter: true, footer: 'Jobs assigned to a driver or truck that doesn’t have the skill, license, clearance or equipment the job needs. Reassign the job, update the person’s record, or (for hard drives) send a crusher. Ignoring only hides the line on the board: it comes back the next time the app is opened, until the job is fixed.' },
      rest.map(x => row(x)), !o.inView && all0(rest, 'Ignore all ' + rest.length + ' for now'), !rest.length && ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Every job has someone qualified' })),
    ignored.length > 0 && ui.section({ header: 'Ignored for now', fold: false }, ignored.map(x => row(x, true))));
} });
/** What one truck can do and the license it takes to drive it. */
function capSheet(v, page) { const f = { caps: (v.caps || []).slice(), needs: v.needs || '' };
  ui.sheet({ title: v.name, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { v.caps = f.caps.slice(); v.needs = f.needs; WD.changed(); p.dismiss(); page.refresh(); ui.toast('Saved', 'checkmark'); } }],
    render: p => ui.list(ui.section({ header: 'What it can do', fold: false, footer: 'A job with hard drives is flagged unless its truck can shred them or a crusher goes with the driver.', showFooter: true }, C.caps.map(c => ui.toggleRow({ title: c.name, value: f.caps.includes(c.id), onChange: on => { f.caps = on ? f.caps.concat(c.id) : f.caps.filter(i => i !== c.id); } }))),
      ui.section({ header: 'Driving it', fold: false }, ui.pickerRow({ title: 'License needed', value: f.needs, options: [{ value: '', label: 'None' }].concat(C.skills.list.filter(s => s.kind === 'license').map(s => ({ value: s.id, label: s.name }))), onChange: val => { f.needs = val; p.refresh(); } }))) }, { detent: 'medium' }); }
const truckChips = v => h('div.r1-chips', (v.caps || []).map(id => (c => c && h('span.ok', c.name))(C.caps.find(x => x.id === id))), v.needs && skill(v.needs) && h('span.warn', 'Needs ' + skill(v.needs).name), !(v.caps || []).length && !v.needs && h('span', 'No special capability'));
const BUILTIN_CAPS = ['hdd', 'nonpaper', 'liftgate'];
/** Trucks and what they can do (Maintenance → Fleet setup). */
const truckCapsSpec = () => ({ title: 'Trucks and capabilities', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); }, trucks = data.vehicles.filter(v => v.active !== false), VS = WD.screens.settings && WD.screens.settings.vehiclesSpec;
  return ui.list(note('What each truck can do and the license it takes to drive it. Jobs are matched against this: hard drives need a truck that shreds them, non-paper material a truck marked for it.'),
    ui.section({ header: 'Trucks', fold: false, footer: 'Tap a truck to change what it can do. Height, weight and capacity are on the truck’s page in Maintenance.', showFooter: true }, trucks.map(v => ui.row({ icon: 'truck', iconColor: 'var(--orange)', title: v.name, subtitle: truckChips(v), chevron: true, onTap: () => capSheet(v, page) }))),
    ui.section({ header: 'Capabilities', fold: false, footer: 'Add your own, such as a pallet jack or a refrigerated box.' }, C.caps.map(c => ui.row({ title: c.name, detail: plural(trucks.filter(v => (v.caps || []).includes(c.id)).length, 'truck'), chevron: true, onTap: async () => {
        const a = await ui.actionSheet({ title: c.name, buttons: [{ label: 'Rename…', value: 'name' }, !BUILTIN_CAPS.includes(c.id) && { label: 'Delete', value: 'del', role: 'destructive' }].filter(Boolean) });
        if (a === 'name') { const n = await ask('Capability', 'Name', c.name); if (n) c.name = n; } else if (a === 'del') { C.caps.splice(C.caps.indexOf(c), 1); data.vehicles.forEach(v => { v.caps = (v.caps || []).filter(i => i !== c.id); }); } if (a) re(); } })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a capability', tint: true, onTap: async () => { const n = await ask('New capability', 'e.g. Pallet jack'); if (n) { C.caps.push({ id: uid('cap'), name: n }); re(); } } })),
    VS && ui.section(null, ui.row({ icon: 'truck', iconColor: 'var(--gray)', title: 'Add, rename or retire a truck', subtitle: 'Name, plate, where it starts and ends the day', chevron: true, onTap: () => page.push(VS()) })));
} });
/** scope: 'people' (skills, licenses and clearances people hold; HR), 'trucks' (what each truck can do; Maintenance), or nothing for both. */
X.skillsSpec = scope => scope === 'trucks' ? truckCapsSpec() : ({ title: 'Skills, licenses and clearances', render: page => { if (!admin()) return locked(); const K = C.skills, re = () => { WD.changed(); page.refresh(); }, people = data.users.filter(u => u.status === 'active'), n = X.flagged().length;
  return ui.list(note(scope === 'people' ? 'Match the right person to each job. A job can need a skill, a license or a clearance; a customer can need one for every visit (a prison’s background check); a truck can need a license to drive (CDL). What each truck can do is under Maintenance → Fleet setup.' : 'Match the right person and truck to each job. A job can need a skill, a license or a clearance; a customer can need one for every visit (a prison’s background check); a truck can need a license to drive (CDL) and can be marked for what it is able to do (shred hard drives).'),
    ui.section({ fold: false, footer: K.on ? null : 'Off: nothing is checked and nothing is flagged for skills. Truck capability for hard drives is still shown.' }, ui.toggleRow({ icon: 'person.2', iconColor: 'var(--indigo)', title: 'Match skills, licenses and clearances', value: K.on, onChange: v => { K.on = v; re(); } })),
    K.on && ui.section({ header: 'When a job is assigned to someone who doesn’t qualify', fold: false, footer: K.mode === 'block' ? 'The app refuses the assignment and says why. Jobs already on a route are flagged.' : 'The app warns, lets you go ahead, and flags the job in red on the board until it is fixed.' },
      h('div.row', h('div', { style: 'flex:1' }, ui.segmented([{ value: 'flag', label: 'Flag the job' }, { value: 'block', label: 'Don’t allow it' }], K.mode, v => { K.mode = v; re(); })))),
    K.on && ui.section(null, ui.row({ icon: 'exclamationmark.triangle', iconColor: n ? 'var(--red)' : 'var(--green)', title: 'Flagged assignments', detail: n ? String(n) : 'None', chevron: true, onTap: () => page.push(X.issuesSpec()) })),
    K.on && ui.section({ header: 'What can be required', fold: false, footer: 'Add your own: a pesticide applicator license, a gas-fitter ticket, an airport badge.' }, K.list.map(s => ui.row({ title: s.name, subtitle: KIND[s.kind] + (s.scoped ? ' · can be limited to one site' : ''), detail: plural(people.filter(u => (u.creds || []).some(c => c.id === s.id)).length, 'person').replace('persons', 'people'), chevron: true, onTap: () => skillSheet(s, page) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a skill, license or clearance', tint: true, onTap: () => skillSheet(null, page) })),
    K.on && ui.section({ header: 'People', footer: 'Tap a person to add what they hold and when it expires.' }, people.map(u => ui.row({ leading: ui.avatar(u.name, { size: 34 }), title: u.name, subtitle: h('div.r1-chips', (u.creds || []).map(c => { const s = skill(c.id), d = c.expires ? daysTo(c.expires) : 999; return s && h('span' + (d < 0 ? '.bad' : d <= C.compliance.noticeDays ? '.warn' : ''), s.name + (s.scoped && c.covers && c.covers !== 'all' ? ' · 1 site' : '')); }), !(u.creds || []).length && h('span', 'Nothing on file')), chevron: true, onTap: () => page.push(personSpec(u)) }))),
    scope !== 'people' && ui.section({ header: 'Trucks', footer: 'What each truck can do and the license it takes to drive it are set in Maintenance → Fleet setup → Trucks and capabilities.' }, data.vehicles.filter(v => v.active !== false).map(v => ui.row({ icon: 'truck', iconColor: 'var(--orange)', title: v.name, subtitle: truckChips(v) }))));
} });

/* ================= Vehicles: capacity, capability, license, tracking, registration ================= */
const TRACK = [{ value: '', label: 'Company default' }, { value: 'phone', label: 'Driver’s phone' }, { value: 'truck', label: 'Truck GPS unit' }, { value: 'both', label: 'Both' }];
const trackLabel = v => ({ phone: 'Driver’s phone', truck: 'Truck GPS unit', both: 'Phone and truck GPS' })[v];
const docOf = (vid, re) => data.fleet && data.fleet.docs.find(d => d.owner === vid && re.test(d.name));
X.vehicleDraft = v => ({ cap: (data.load && v && data.load.capacity[v.id]) || 6000, caps: ((v && v.caps) || []).slice(), needs: (v && v.needs) || '', track: (v && v.track) || '', reg: v ? (docOf(v.id, /^Registration/) || {}).expires || '' : D.add(today(), 365), carb: v ? (docOf(v.id, /CARB/) || {}).expires || '' : D.add(today(), 182) });
X.vehicleSections = (v, x, page) => { const metric = WD.locale.units === 'metric', shown = metric ? Math.round(x.cap * 0.4536) : x.cap;
  return [ui.section({ header: 'Capacity and what it can do', fold: false, footer: 'Capacity feeds the load sheet and tells AutoRoute when to plan a trip to unload. A job with hard drives is flagged unless its truck can shred them or a crusher goes with the driver.' },
      h('div.row', h('div.row-main', h('div.row-title', 'Carries up to'), h('div.row-sub', metric ? 'Kilograms' : 'Pounds')), h('input.r1-num', { type: 'text', inputmode: 'numeric', 'aria-label': 'Capacity', value: String(shown), onchange: e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0; x.cap = metric ? Math.round(n / 0.4536) : n; } })),
      C.caps.map(c => ui.toggleRow({ title: c.name, value: x.caps.includes(c.id), onChange: on => { x.caps = on ? x.caps.concat(c.id) : x.caps.filter(i => i !== c.id); } }))),
    ui.section({ header: 'Driving and tracking', fold: false, footer: 'Not every truck has a GPS unit, and some companies track only by the driver’s phone. “Company default” follows Maintenance → How trucks are tracked (' + trackLabel(C.tracking.source).toLowerCase() + ').' },
      ui.pickerRow({ title: 'License needed to drive it', value: x.needs, options: [{ value: '', label: 'None' }].concat(C.skills.list.filter(s => s.kind === 'license').map(s => ({ value: s.id, label: s.name }))), onChange: val => { x.needs = val; page.refresh(); } }),
      ui.pickerRow({ title: 'Tracked by', value: x.track, options: TRACK, onChange: val => { x.track = val; page.refresh(); } })),
    ui.section({ header: 'Registration and inspections', fold: false, footer: 'A reminder shows ' + C.compliance.noticeDays + ' days before each date. Maintenance by miles, engine hours or time, insurance and other documents are under Fleet and compliance.' },
      ui.dateRow({ title: 'Registration expires', icon: 'doc.text', iconColor: 'var(--blue)', value: x.reg, onChange: d => { x.reg = d; } }),
      C.compliance.carb && ui.dateRow({ title: 'CARB check due', icon: 'checkmark.circle', iconColor: 'var(--green)', value: x.carb, onChange: d => { x.carb = d; } }),
      v && WD.biz && ui.row({ icon: 'wrench', iconColor: 'var(--orange)', title: 'Maintenance and documents', subtitle: 'Odometer, engine hours, services, insurance', chevron: true, onTap: () => page.push(WD.biz.vehicleSpec(v)) }))]; };
X.vehicleSave = (v, x) => { if (data.load) data.load.capacity[v.id] = Math.max(500, x.cap || 6000); v.caps = x.caps.slice(); v.needs = x.needs; v.track = x.track;
  if (!data.fleet) return; const put = (re, name, day, extra) => { if (!day) return; const d = docOf(v.id, re); if (d) d.expires = day; else data.fleet.docs.push({ id: uid('d'), owner: v.id, name, expires: day, ...extra }); };
  put(/^Registration/, 'Registration', x.reg); if (C.compliance.carb) put(/CARB/, 'CARB Clean Truck Check', x.carb, { renewMonths: C.compliance.carbMonths, carb: true }); };
X.trackingSpec = () => ({ title: 'How trucks are tracked', render: page => { if (!admin()) return locked(); const T = C.tracking, re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('Where the live map, arrival times and the location history get a truck’s position from.'),
    ui.section({ header: 'Company default', fold: false, footer: T.source === 'phone' ? 'Only the driver’s phone, while clocked in. Right for a company with no GPS units, like an owner driving one truck.' : T.source === 'truck' ? 'Only the truck’s GPS unit. Drivers’ phones are not tracked; arrival still works from the truck.' : 'The truck’s GPS unit when it has one, with the driver’s phone filling in. The truck keeps reporting when the phone is off.' },
      h('div.row', h('div', { style: 'flex:1' }, ui.segmented([{ value: 'phone', label: 'Driver’s phone' }, { value: 'truck', label: 'Truck GPS' }, { value: 'both', label: 'Both' }], T.source, v => { T.source = v; re(); })))),
    ui.section({ header: 'Each truck', fold: false, footer: 'A truck can differ from the company default, for example a truck with no GPS unit.' }, data.vehicles.filter(v => v.active !== false).map(v => ui.pickerRow({ title: v.name, subtitle: v.gps ? 'GPS unit linked · ' + v.gps : 'No GPS unit', icon: 'truck', iconColor: v.gps ? 'var(--orange)' : 'var(--gray)', value: v.track || '', options: TRACK, onChange: val => { if ((val === 'truck') && !v.gps) ui.toast(v.name + ' has no GPS unit linked yet', 'info.circle', 2600); v.track = val; re(); } }))),
    ui.section({ footer: 'Employees agree to phone tracking before it starts, and it runs only while they are clocked in.' }, ui.row({ title: 'Location tracking consent', chevron: true, onTap: () => WD.screens.settings.openTracking && WD.screens.settings.openTracking() })));
} });

/* ================= Compliance and reminders ================= */
/** Everything with a date or an interval: vehicle documents (registration, CARB, insurance), people's licenses and clearances, maintenance.
    scope 'people' | 'trucks' keeps one side only. */
X.expiring = (all, scope) => { const N = C.compliance.noticeDays, name = id => (q.vehicle(id) || q.user(id) || { name: '' }).name; let out = [];
  ((data.fleet && data.fleet.docs) || []).forEach(d => { if (d.carb && !C.compliance.carb) return; const n = daysTo(d.expires); if (all || n <= N) out.push({ n, icon: 'doc.text', title: name(d.owner) + ' · ' + d.name, owner: d.owner }); });
  data.users.forEach(u => (u.creds || []).forEach(c => { if (!c.expires) return; const s = skill(c.id), n = daysTo(c.expires); if (s && (all || n <= N)) out.push({ n, icon: 'person', title: u.name + ' · ' + s.name + (s.scoped && c.covers && c.covers !== 'all' ? ' (' + c.covers + ')' : ''), user: u }); }));
  if (WD.biz && WD.biz.svc) data.fleet.services.forEach(s => { const st = WD.biz.svc(s); if (st.over || st.warn) out.push({ n: st.over ? -1 : 1, icon: 'wrench', title: name(s.owner) + ' · ' + s.name, text: st.text, owner: s.owner }); });
  if (scope) out = out.filter(x => (scope === 'people') === !!(x.user || (x.owner && !q.vehicle(x.owner))));   // people: what a person holds; trucks: everything owned by a vehicle
  return out.sort((a, b) => a.n - b.n); };
/** scope: 'trucks' (registrations, CARB checks, inspections, maintenance; lives in Maintenance), 'people' (licenses, medical cards, clearances; lives with HR), or nothing for both. */
X.complianceSpec = scope => ({ title: scope === 'trucks' ? 'Fleet compliance and reminders' : scope === 'people' ? 'License and clearance reminders' : 'Compliance and reminders', render: page => { const K = C.compliance, re = () => { WD.changed(); page.refresh(); }, list = X.expiring(false, scope), edit = admin(), T = scope !== 'people', P = scope !== 'trucks';
  const MS = WD.screens.maintenance, truckPage = v => MS && MS.truckSpec && WD.can('maintenance.view') ? MS.truckSpec(v) : WD.biz.vehicleSpec(v);
  const row = x => ui.row({ icon: x.icon, iconColor: x.n < 0 ? 'var(--red)' : 'var(--orange)', title: x.title, subtitle: x.text || (x.n < 0 ? 'Expired ' + plural(-x.n, 'day') + ' ago' : x.n === 0 ? 'Expires today' : 'Expires in ' + plural(x.n, 'day')), chevron: true,
    onTap: () => x.user ? page.push(personSpec(x.user)) : q.vehicle(x.owner) && WD.biz ? page.push(x.icon === 'wrench' ? truckPage(q.vehicle(x.owner)) : WD.biz.vehicleSpec(q.vehicle(x.owner))) : WD.biz && page.push(WD.biz.fleetSpec(scope || 'people')) });
  return ui.list(note(scope === 'trucks' ? 'Everything on a truck that expires or comes due: registrations, CARB checks, insurance, annual inspections and scheduled maintenance.' : scope === 'people' ? 'Everything a person holds that expires: drivers’ licenses, medical cards and clearances.' : 'One list of everything that expires or comes due: vehicle registrations, CARB checks, insurance, drivers’ licenses, medical cards, clearances and scheduled maintenance.'),
    ui.section({ header: 'Coming up · ' + list.length, fold: false }, list.map(row), !list.length && ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Nothing expires in the next ' + K.noticeDays + ' days' })),
    edit && ui.section({ header: 'Reminders', fold: false, footer: 'How far ahead a reminder shows, here and on the dispatch board. One setting for documents, licenses, clearances and time-based maintenance.' },
      ui.pickerRow({ title: 'Remind me', value: K.noticeDays, options: [14, 30, 45, 60, 90, 120].map(n => ({ value: n, label: n + ' days before' })), onChange: v => { K.noticeDays = v; re(); } })),
    T && edit && ui.section({ header: 'California', fold: false, footer: 'The CARB Clean Truck Check is due on a schedule for each diesel truck. Off for companies outside California.' },
      ui.toggleRow({ title: 'Track CARB compliance checks', value: K.carb, onChange: v => { K.carb = v; re(); } }),
      K.carb && ui.pickerRow({ title: 'Due every', value: K.carbMonths, options: [3, 6, 12].map(n => ({ value: n, label: n + ' months' })), onChange: v => { K.carbMonths = v; (data.fleet ? data.fleet.docs : []).forEach(d => { if (d.carb) d.renewMonths = v; }); re(); } })),
    ui.section({ header: 'Where each one is kept', fold: false },
      T && WD.biz && ui.row({ icon: 'truck', iconColor: 'var(--orange)', title: scope ? 'Truck documents and the pre-trip checklist' : 'Fleet and compliance', subtitle: 'Registration, CARB, insurance, inspections, maintenance by miles, engine hours or time', chevron: true, onTap: () => page.push(WD.biz.fleetSpec(scope)) }),
      scope === 'people' && WD.biz && ui.row({ icon: 'doc.text', iconColor: 'var(--teal)', title: 'Driver documents', subtitle: 'Driver’s licenses, DOT medical cards and certificates', chevron: true, onTap: () => page.push(WD.biz.fleetSpec('people')) }),
      P && edit && ui.row({ icon: 'person.2', iconColor: 'var(--indigo)', title: 'Skills, licenses and clearances', subtitle: 'Who holds what, what it covers and when it expires', chevron: true, onTap: () => page.push(X.skillsSpec(scope)) })));
} });

/* ================= Disposal sites and the unload stop ================= */
const KINDS = [{ value: 'recycler', label: 'Recycler' }, { value: 'landfill', label: 'Landfill' }, { value: 'transfer', label: 'Transfer station' }];
function siteSheet(s, page) {
  const f = s ? { ...s } : { id: uid('ds'), name: '', kind: 'recycler', address: '', x: 150 + Math.round(Math.random() * 700), y: 150 + Math.round(Math.random() * 700) };
  ui.sheet({ title: s ? 'Edit site' : 'New disposal site', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.name.trim() || !f.address.trim()) return ui.toast('Add a name and an address', 'mappin'); if (s) Object.assign(s, f); else C.disposal.sites.push(f); WD.changed(); p.dismiss(); page.refresh(); } }],
    render: p => ui.list(ui.section(null, ui.inputRow({ label: 'Name', caps: 'words', placeholder: 'e.g. Valley Paper Recycling', value: f.name, autofocus: !s, onInput: v => { f.name = v; } }), ui.inputRow({ label: 'Address', placeholder: 'Street, city', value: f.address, onInput: v => { f.address = v; } }), ui.pickerRow({ title: 'Kind', value: f.kind, options: KINDS, onChange: v => { f.kind = v; p.refresh(); } })),
      s && ui.section(null, ui.row({ title: 'Delete site', destructive: true, onTap: async () => { if (await ui.actionSheet({ title: 'Delete “' + s.name + '”?', buttons: [{ label: 'Delete site', value: true, role: 'destructive' }] })) { C.disposal.sites.splice(C.disposal.sites.indexOf(s), 1); WD.changed(); p.dismiss(); page.refresh(); } } }))) }, { detent: 'medium' });
}
X.disposalSpec = () => ({ title: 'Disposal sites', render: page => { if (!admin()) return locked(); const P = C.disposal, re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('Where trucks empty out: your recyclers and landfills. AutoRoute uses them to plan an unload stop when a truck fills up, or after non-paper material is shredded on site.'),
    ui.section({ header: 'Recyclers and landfills', fold: false }, P.sites.map(s => ui.row({ icon: s.kind === 'landfill' ? 'trash' : 'arrow.clockwise', iconColor: s.kind === 'landfill' ? 'var(--brown)' : 'var(--green)', title: s.name, subtitle: (KINDS.find(k => k.value === s.kind) || KINDS[0]).label + ' · ' + s.address, chevron: true, onTap: () => siteSheet(s, page) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a site', tint: true, onTap: () => siteSheet(null, page) })),
    ui.section({ header: 'AutoRoute', fold: false, footer: 'When a route carries more than its truck holds, AutoRoute proposes a stop at the nearest site before the truck is full. You accept it, pick a different site, or leave it out. On the day, “Unload now” sends a full truck to empty and re-plans the remaining stops from there.' },
      ui.toggleRow({ title: 'Suggest an unload stop', subtitle: 'When the truck fills up, or after an on-site non-paper job', value: P.suggest, onChange: v => { P.suggest = v; re(); } }),
      ui.row({ title: 'Time to unload', subtitle: 'Planned minutes at the site', detail: P.unloadMin + ' min', trailing: ui.stepper(P.unloadMin / 5, 1, 24, v => { P.unloadMin = v * 5; re(); }) })),
    ui.section({ header: 'Non-paper material (x-rays, hard drives, textiles)', fold: false, footer: P.nonPaper === 'offsite' ? 'New non-paper jobs start as a pickup: the material comes back to be shredded offsite, so the truck can carry on with paper customers.' : 'New non-paper jobs start as shred on site: the truck goes empty, shreds, unloads at a disposal site, and only then serves paper customers. AutoRoute plans it that way.' },
      h('div.row', h('div', { style: 'flex:1' }, ui.segmented([{ value: 'offsite', label: 'Pick up, shred offsite' }, { value: 'onsite', label: 'Shred on site' }], P.nonPaper, v => { P.nonPaper = v; re(); })))),
    ui.section(null, ui.row({ title: 'Truck capacity', subtitle: 'On each truck’s page in Maintenance, or the load sheet', chevron: true, onTap: () => WD.biz && page.push(WD.biz.loadSettingsSpec()) })));
} });
/** Purge sub-categories for non-paper material, listed with the job types (Settings → Job types and fields). */
X.materialsSection = page => ui.section({ header: 'Purge sub-categories (non-paper)', fold: false, footer: 'A purge that is not paper (x-rays, hard drives, textiles) is its own sub-category with its own color, so it is never mistaken for a regular purge. Tap one to rename it, change its color or delete it.' },
  C.materials.map(m => ui.row({ leading: h('span.ad-swatch', { style: { background: m.color } }), title: m.name, chevron: admin(), onTap: admin() ? async () => {
    const a = await ui.actionSheet({ title: m.name, buttons: [{ label: 'Rename…', value: 'name' }, { label: 'Next color', value: 'color' }, { label: 'Delete', value: 'del', role: 'destructive' }] }), COLORS = ['#EF6C00', '#6D4C41', '#AD1457', '#5E35B1', '#00838F', '#2E7D32', '#C62828'];
    if (a === 'name') { const n = await ask('Sub-category name', '', m.name); if (n) m.name = n; } else if (a === 'color') m.color = COLORS[(COLORS.indexOf(m.color) + 1) % COLORS.length]; else if (a === 'del') { C.materials.splice(C.materials.indexOf(m), 1); data.jobs.forEach(j => { if (j.material === m.id) j.material = ''; }); }
    if (a) { WD.changed(); page.refresh(); } } : null })),
  admin() && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a sub-category', tint: true, onTap: async () => { const n = await ask('New sub-category', 'e.g. Pill bottles'); if (n) { C.materials.push({ id: uid('m'), name: n, color: '#00838F' }); WD.changed(); page.refresh(); } } }));

/* ---------- AutoRoute hooks: unload stop, window overrides, pairs ---------- */
X._win = {};
/** The window a customer will be told for a planned stop: the dispatcher's own, if they changed it, else the one worked out from the ETA. */
X.winFor = l => X._win[l.job.id] || WD.etaWindow(l.start);
function winSheet(l, page) {
  const cur = X.winFor(l), f = { from: hhmm(cur.from), until: hhmm(cur.until) }, sug = WD.etaWindow(l.start);
  ui.sheet({ title: 'Window for ' + l.job.title, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Use', bold: true, onTap: p => { const a = fmt.fromHHMM(f.from), b = fmt.fromHHMM(f.until); if (a == null || b == null || b <= a) return ui.toast('The window must end after it starts', 'clock'); X._win[l.job.id] = { from: a, until: b }; p.dismiss(); page.refresh(); } }],
    render: p => ui.list(ui.section({ fold: false, footer: 'Expected arrival ' + fmt.time(l.start) + '. The app suggests ' + fmt.time(sug.from) + ' to ' + fmt.time(sug.until) + '. Change it when you know something the app doesn’t.' },
      ui.quarterRow({ title: 'From', optional: false, value: f.from, onChange: v => { f.from = v; } }), ui.quarterRow({ title: 'Until', optional: false, value: f.until, onChange: v => { f.until = v; } })),
      X._win[l.job.id] && ui.section(null, ui.row({ title: 'Go back to the suggested window', tint: true, onTap: () => { delete X._win[l.job.id]; p.dismiss(); page.refresh(); } }))) }, { detent: 'medium' });
}
X.autoRoute = ({ routeId, day, stops, all, isToday }) => {
  X._win = {};
  const P = C.disposal, sites = P.sites, v = vehicleFor(routeId), L = data.load, cap = (L && v && L.capacity[v.id]) || 6000, wt = j => (j.items || []).reduce((s, i) => s + (+i.qty || 0) * ((L && L.weights[i.id]) || 0), 0);
  const done = all.filter(j => j.status === 'completed'), lastDump = done.map(j => j.type).lastIndexOf('dump'), onBoard = done.slice(lastDump + 1).reduce((s, j) => s + wt(j), 0);
  const onsite = j => !!j.material && j.handling === 'onsite', hasOnsite = stops.some(onsite), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const fillAt = order => { let lb = onBoard; for (let i = 0; i < order.length; i++) { lb += wt(order[i]); if (lb > cap) return i; } return -1; };
  const st = { on: false, mode: hasOnsite ? 'np' : 'fill', siteId: null, cur: null, job: null, idx: -1, fill: fillAt(stops) };
  st.on = P.suggest && sites.length > 0 && (hasOnsite || st.fill >= 0);
  const nearest = (pt, kind) => sites.slice().sort((a, b) => (b.kind === kind) - (a.kind === kind) || dist(a, pt) - dist(b, pt))[0];
  const dumpJob = site => { if (!st.job) { st.job = WD.makeJob({ routeId, day, type: 'dump', title: 'Unload', custType: 'business', located: true, items: [], notes: 'Empty the truck, then carry on with the remaining stops.' }); data.jobs.splice(data.jobs.indexOf(st.job), 1); }
    Object.assign(st.job, { title: 'Unload · ' + site.name, address: site.address, x: site.x, y: site.y, dur: P.unloadMin, siteId: site.id }); return st.job; };
  const fixPairs = order => { const out = order.slice(); out.slice().forEach(j => { if (!j.pair || j.pair.role !== 'delivery') return; const a = out.findIndex(x => x.id === j.pair.with), b = out.indexOf(j); if (a > b && b >= 0) { out.splice(b, 1); out.splice(out.findIndex(x => x.id === j.pair.with) + 1, 0, j); } }); return out; };
  return {
    /** Put the unload stop where it belongs, re-plan the stops after it from the disposal site, and keep each pickup ahead of its delivery. */
    wrap(order, from, end, optimize, simulate) {
      let out = order.filter(j => j.type !== 'dump'); st.idx = -1;
      if (st.on && sites.length) { let idx;
        if (st.mode === 'np') { const first = optimize(out.filter(onsite), from, end); out = first.concat(out.filter(j => !onsite(j))); idx = first.length; }
        else if (st.mode === 'now') idx = 0;
        else { idx = fillAt(out); if (idx < 0) idx = out.length; if (idx === 0 && onBoard === 0) idx = Math.min(1, out.length); }
        const anchor = idx > 0 ? out[idx - 1] : from.at, site = sites.find(s => s.id === st.siteId) || nearest(anchor, st.mode === 'np' ? 'landfill' : 'recycler'); st.cur = site; st.idx = idx;
        const head = out.slice(0, idx).concat(dumpJob(site)), rest = optimize(out.slice(idx), simulate(head, from, end).last, end); out = head.concat(rest); }
      return C.pairs.on ? fixPairs(out) : out;
    },
    commit(order) { const j = order.find(x => x.type === 'dump'); if (j && !data.jobs.includes(j)) { j.events = [{ at: +WD.now(), actor: me(), text: 'Unload stop added by AutoRoute' }]; data.jobs.push(j); } },
    section(page, rebuild) {
      if (!sites.length) return hasOnsite || st.fill >= 0 ? ui.section({ header: 'Unload stop', fold: false, footer: 'Add your recyclers and landfills in Settings → Disposal sites and AutoRoute will plan the trip.' }, ui.row({ icon: 'exclamationmark.triangle', iconPlain: true, iconColor: 'var(--orange)', title: 'This route needs a trip to unload', subtitle: 'No disposal sites are set up yet' })) : null;
      const why = st.mode === 'np' ? 'Non-paper material is shredded on site: go with an empty truck, shred it, unload, then serve the paper customers.' : st.mode === 'now' ? 'The truck is full now. It unloads first and the remaining stops are re-planned from the disposal site.'
        : st.fill >= 0 ? (v ? v.name : 'The truck') + ' holds ' + fmt.weight(cap) + ' and fills up at stop ' + (st.fill + 1) + ' of the remaining stops' + (onBoard ? ' (' + fmt.weight(onBoard) + ' already on board)' : '') + '.' : (v ? v.name : 'The truck') + ' has room for every stop (' + fmt.weight(cap) + '). Add a stop anyway if you know it will fill up.';
      return ui.section({ header: 'Unload at a recycler or landfill', fold: false, footer: why + (st.on ? ' The stops after it are planned from ' + (st.cur ? st.cur.name : 'the site') + '. Switch it off to skip the trip, or pick a different site.' : '') },
        ui.toggleRow({ icon: 'arrow.clockwise', iconColor: 'var(--green)', title: 'Add an unload stop', subtitle: st.on && st.cur ? st.cur.name + ' · ' + P.unloadMin + ' min' : 'Accept the trip, or leave it out', value: st.on, onChange: on => { st.on = on; if (on && st.mode === 'fill' && st.fill < 0 && isToday) st.mode = 'now'; rebuild(); } }),
        st.on && ui.pickerRow({ title: 'When', value: st.mode, options: [{ value: 'fill', label: 'When the truck fills up' }, { value: 'now', label: isToday ? 'Now, before the next stop' : 'First thing' }, hasOnsite && { value: 'np', label: 'After the non-paper job' }].filter(Boolean), onChange: m => { st.mode = m; rebuild(); } }),
        st.on && ui.pickerRow({ title: 'Where', value: st.siteId || (st.cur && st.cur.id), options: sites.map(s => ({ value: s.id, label: s.name })), onChange: id => { st.siteId = id; rebuild(); } }));
    },
    /** Under a stop that needs a window: change the window the customer will be told. */
    rowExtra(l, page) { if (!(l.job.needsWindow && !l.job.custFrom && !l.job.custUntil)) return null;
      return h('button.cu-link', { style: 'margin-top:3px', onpointerdown: e => e.stopPropagation(), onclick: e => { e.stopPropagation(); winSheet(l, page); } }, X._win[l.job.id] ? 'Your window · change' : 'Change this window'); },
  };
};

/* ================= Truck and warehouse inventory ================= */
const INV = C.inventory;
const invItem = id => INV.items.find(i => i.id === id), stockOf = (loc, id) => ((INV.stock[loc] || {})[id]) || 0, setStock = (loc, id, n) => { (INV.stock[loc] = INV.stock[loc] || {})[id] = Math.max(0, Math.round(n)); };
const invLocs = () => [{ id: 'wh', name: 'Warehouse · ' + ((data.depot && data.depot.name) || 'Shop'), icon: 'building' }].concat(data.vehicles.filter(v => v.active !== false).map(v => ({ id: v.id, name: v.name, icon: 'truck' })));
const locName = id => (invLocs().find(l => l.id === id) || { name: id }).name;
/** What a job takes from the truck. Starts from the job: a setup delivers its containers (and a lock for each console); "bring an extra container" takes a bin. */
X.usesFor = job => { if (job.uses) return job.uses; const out = [], add = (id, qty) => { if (qty > 0 && invItem(id)) out.push({ id, qty }); };
  if (job.type === 'setup' || (job.flags && job.flags.setup)) { (job.items || []).forEach(i => { if (['console', 'bin64', 'bin96'].includes(i.id)) add(i.id, +i.qty || 0); }); add('lock', (((job.items || []).find(i => i.id === 'console') || {}).qty) || 0); }
  else if (job.flags && job.flags.extraBin) add('bin64', 1);
  return out; };
const useText = uses => uses.map(u => u.qty + ' × ' + ((invItem(u.id) || {}).name || u.id).toLowerCase()).join(', ');
function applyUse(job, back) {
  if (!INV.on) return; const v = vehicleFor(job.routeId); if (!v) return;
  if (back) { if (!job.invUsed) return; job.invUsed.uses.forEach(u => setStock(job.invUsed.loc, u.id, stockOf(job.invUsed.loc, u.id) + u.qty)); INV.log.unshift({ at: +WD.now(), by: me(), loc: job.invUsed.loc, text: 'Put back (job reopened): ' + useText(job.invUsed.uses) + ' · ' + job.title }); job.invUsed = null; return; }
  const uses = X.usesFor(job).filter(u => u.qty > 0); if (!uses.length || job.invUsed) return; const short = [];
  uses.forEach(u => { const have = stockOf(v.id, u.id); if (have < u.qty) short.push((invItem(u.id) || {}).name || u.id); setStock(v.id, u.id, have - u.qty); });
  job.invUsed = { loc: v.id, uses: uses.map(u => ({ ...u })) }; INV.log.unshift({ at: +WD.now(), by: me(), loc: v.id, text: 'Used on ' + job.title + ': ' + useText(uses) });
  const low = uses.map(u => invItem(u.id)).filter(i => i && stockOf(v.id, i.id) <= (i.min || 0));
  if (short.length) ui.banner({ title: v.name + ' is out of ' + short.join(', ').toLowerCase(), text: 'The job used more than the truck had on record. Count the truck or pick up more.', icon: 'shippingbox', color: 'var(--red)' });
  else if (low.length) setTimeout(() => ui.toast(v.name + ' is running low on ' + low.map(i => i.name.toLowerCase()).join(', '), 'shippingbox', 3000), 900);
}
/* Completing a job uses up the truck's stock; reopening it puts the stock back. */
const setStatus0 = api.setStatus;
api.setStatus = (jobId, status, noteText) => { const op = setStatus0(jobId, status, noteText), job = q.job(jobId); if (job && status === 'completed') applyUse(job, false); else if (job && status === 'scheduled') applyUse(job, true); return op; };
async function moveStock(loc, page, kind) {
  const others = invLocs().filter(l => l.id !== loc.id), from = kind === 'load' ? (loc.id === 'wh' ? null : 'wh') : null;
  const itemId = await ui.actionSheet({ title: kind === 'receive' ? 'What came in?' : kind === 'load' ? 'Load what onto ' + loc.name + '?' : 'Move what out of ' + loc.name + '?', buttons: INV.items.map(i => ({ label: i.name + ' · ' + stockOf(kind === 'load' && from ? from : loc.id, i.id) + (kind === 'load' && from ? ' in the warehouse' : ' here'), value: i.id })) }); if (!itemId) return;
  const r = await ui.alert({ title: 'How many?', input: { type: 'number', placeholder: 'Quantity', value: '1' }, buttons: [{ label: 'Cancel', value: null }, { label: 'OK', value: true, bold: true }] }); const n = r && r.value ? Math.max(0, parseInt(r.text, 10) || 0) : 0; if (!n) return;
  const it = invItem(itemId);
  if (kind === 'receive') { setStock(loc.id, itemId, stockOf(loc.id, itemId) + n); INV.log.unshift({ at: +WD.now(), by: me(), loc: loc.id, text: 'Received ' + n + ' × ' + it.name.toLowerCase() }); }
  else if (kind === 'load') { const src = from || 'wh', take = Math.min(n, stockOf(src, itemId)); if (!take) return ui.toast('None in the warehouse', 'shippingbox'); setStock(src, itemId, stockOf(src, itemId) - take); setStock(loc.id, itemId, stockOf(loc.id, itemId) + take); INV.log.unshift({ at: +WD.now(), by: me(), loc: loc.id, text: 'Loaded ' + take + ' × ' + it.name.toLowerCase() + ' from the warehouse' }); if (take < n) ui.toast('Only ' + take + ' were in the warehouse', 'info.circle', 2600); }
  else { const to = await ui.actionSheet({ title: 'Move to', buttons: others.map(l => ({ label: l.name, value: l.id })) }); if (!to) return; const take = Math.min(n, stockOf(loc.id, itemId)); setStock(loc.id, itemId, stockOf(loc.id, itemId) - take); setStock(to, itemId, stockOf(to, itemId) + take); INV.log.unshift({ at: +WD.now(), by: me(), loc: loc.id, text: 'Moved ' + take + ' × ' + it.name.toLowerCase() + ' to ' + locName(to) }); }
  WD.changed(); page.refresh();
}
X.stockSpec = loc => ({ title: loc.name, render: page => { const re = () => { WD.changed(); page.refresh(); }, truck = loc.id !== 'wh', log = INV.log.filter(x => x.loc === loc.id).slice(0, 8);
  return ui.list(ui.section({ header: 'On hand', fold: false, footer: truck ? 'Goes down as jobs are completed, and up when the driver loads more. Type a number after counting the truck.' : 'Stock kept at the business location. Trucks load from here.' },
      INV.items.map(i => { const n = stockOf(loc.id, i.id); return ui.row({ title: i.name, subtitle: n <= (i.min || 0) && truck ? h('span', { style: 'color:var(--orange);font-weight:600' }, 'Low · reorder point ' + (i.min || 0)) : null, trailing: h('span.hstack', ui.numField(n, 0, 9999, x => { setStock(loc.id, i.id, x); INV.log.unshift({ at: +WD.now(), by: me(), loc: loc.id, text: 'Counted: ' + x + ' × ' + i.name.toLowerCase() }); re(); }, i.name), ui.stepper(n, 0, 9999, x => { setStock(loc.id, i.id, x); re(); })) }); })),
    ui.section({ fold: false }, truck && ui.row({ icon: 'arrow.down', iconPlain: true, title: 'Picked up more: load from the warehouse', tint: true, onTap: () => moveStock(loc, page, 'load') }),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: truck ? 'Picked up more somewhere else' : 'Receive a delivery', tint: true, onTap: () => moveStock(loc, page, 'receive') }),
      ui.row({ icon: 'arrow.left.arrow.right', iconPlain: true, title: 'Move stock to another truck or the warehouse', tint: true, onTap: () => moveStock(loc, page, 'move') })),
    log.length > 0 && ui.section({ header: 'Recent changes' }, log.map(x => ui.row({ title: x.text, subtitle: x.by + ' · ' + fmt.rel(x.at) }))));
} });
X.inventorySpec = () => ({ title: 'Inventory', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('Count what each truck carries and what is in the warehouse. Off by default; switch it on if you deliver or install things (containers, parts, filters, product).'),
    ui.section({ fold: false, footer: INV.on ? 'Jobs show what they use. Completing a job takes it off that truck’s count; reopening the job puts it back.' : 'Off: nothing is counted and jobs do not ask about inventory.' }, ui.toggleRow({ icon: 'shippingbox', iconColor: 'var(--teal)', title: 'Track inventory', value: INV.on, onChange: v => { INV.on = v; re(); } })),
    INV.on && ui.section({ header: 'Where it is kept', fold: false }, invLocs().map(l => { const low = l.id === 'wh' ? 0 : INV.items.filter(i => stockOf(l.id, i.id) <= (i.min || 0)).length;
      return ui.row({ icon: l.icon, iconColor: l.id === 'wh' ? 'var(--indigo)' : 'var(--orange)', title: l.name, subtitle: INV.items.map(i => stockOf(l.id, i.id) + ' ' + i.name.toLowerCase()).slice(0, 3).join(' · '), badge: low ? ui.badge(low + ' low', 'var(--orange)') : null, chevron: true, onTap: () => page.push(X.stockSpec(l)) }); })),
    INV.on && ui.section({ header: 'Items', fold: false, footer: 'The reorder point is when a truck is flagged as running low. A setup job uses its containers and a lock for each console; any job can be changed.' }, INV.items.map(i => ui.row({ title: i.name, subtitle: 'Low at ' + (i.min || 0) + ' on a truck', chevron: true, onTap: async () => {
        const a = await ui.actionSheet({ title: i.name, buttons: [{ label: 'Rename…', value: 'name' }, { label: 'Change the reorder point…', value: 'min' }, { label: 'Delete', value: 'del', role: 'destructive' }] });
        if (a === 'name') { const n = await ask('Item name', '', i.name); if (n) i.name = n; } else if (a === 'min') { const n = await ask('Flag a truck as low at', 'e.g. 2', String(i.min || 0)); if (n != null) i.min = parseInt(n, 10) || 0; } else if (a === 'del') INV.items.splice(INV.items.indexOf(i), 1);
        if (a) re(); } })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an item', tint: true, onTap: async () => { const n = await ask('New inventory item', 'e.g. Replacement keys'); if (n) { INV.items.push({ id: uid('iv'), name: n, unit: 'each', min: 1 }); re(); } } })));
} });

/* ================= Pickup-and-delivery pairs ================= */
X.pairsSpec = () => ({ title: 'Pickup-and-delivery pairs', render: page => { if (!admin()) return locked();
  return ui.list(note('Two stops that belong together: something is picked up at one and dropped off at the other. For example, collecting x-rays from a clinic and taking them to the shop to shred, or a courier picking up a parcel and delivering it. The app keeps the two linked, shows which is which on the board, and AutoRoute never plans the delivery before its pickup.'),
    ui.section({ fold: false, footer: C.pairs.on ? 'Open a job and choose “Pair with another stop” to link a pickup with its delivery.' : 'Off. A shredding route rarely needs this; it is here for delivery and courier businesses.' }, ui.toggleRow({ icon: 'arrow.left.arrow.right', iconColor: 'var(--purple)', title: 'Pickup-and-delivery pairs', value: C.pairs.on, onChange: v => { C.pairs.on = v; WD.changed(); page.refresh(); } })));
} });

/* ================= Pricing, letters and agreements; unpaid invoices ================= */
/* Portal fees: any percentage plus a fixed amount per payment, for cards and for bank (ACH) payments; ACH can have a cap. */
const fee$ = n => fmt.money(n, true), feeOf = (pct, fixed) => [pct ? pct + '%' : null, fixed ? fee$(fixed) : null].filter(Boolean).join(' + ');
const feeText = () => { const P = C.portal, card = feeOf(P.cardPct, P.cardFixed), ach = feeOf(P.achPct, P.achFixed);
  return 'A transaction fee applies to payments made in the portal: ' + (card ? card + ' for credit or debit cards' : 'none for credit or debit cards') + ' and ' + (ach ? ach + (P.achCap && P.achPct ? ' (at most ' + fee$(P.achCap) + ')' : '') + ' for bank (ACH) payments.' : 'none for bank (ACH) payments.'); };
/** The fee added to a portal payment of `amount` by 'card' or 'ach'. */
X.portalFee = (amount, method) => { const P = C.portal, r = n => Math.round(n * 100) / 100; if (method === 'card') return r(amount * P.cardPct / 100 + (P.cardFixed || 0)); const f = r(amount * P.achPct / 100 + (P.achFixed || 0)); return P.achCap && P.achPct ? Math.min(f, r(P.achCap + (P.achFixed || 0))) : f; };
X.feeText = () => feeText();
const syncFees = () => { const T = data.agreementTemplate; if (T && T.payment) { const i = T.payment.indexOf('A transaction fee'), k = T.payment.indexOf('Card and bank details'); if (i >= 0 && k > i) T.payment = T.payment.slice(0, i) + feeText() + ' ' + T.payment.slice(k); }
  /* rc.js charges from data.pay: keep it the same as what the agreement says. */
  const P = data.pay; if (P) Object.assign(P, { cardPct: C.portal.cardPct, cardFixed: C.portal.cardFixed || 0, achPct: C.portal.achPct, achFixed: C.portal.achFixed || 0, achCap: C.portal.achCap || 0 }); };
X.syncFees = () => syncFees();
X.moneySpec = () => ({ title: 'Pricing and Agreements', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); }, PP = data.purgePricing, pb = id => data.priceBook.find(x => x.id === id), box = pb('box').rate;
  /* Fees are typed exactly (2.9, 3.49, 0.30). A value that is not a number, is negative or is over the limit is refused and the field turns red. */
  const P = C.portal, ex = 150, feeIn = (k, title, sub, unit, max) => { const inp = h('input.r1-num', { type: 'text', inputmode: 'decimal', 'aria-label': title, value: unit === '$' ? Number(P[k] || 0).toFixed(2) : String(P[k] || 0), style: 'width:76px',
      oninput: e => { const t = e.target.value.trim(), v = Number(t.replace(/[$%\s]/g, '')), bad = t === '' || !isFinite(v) || v < 0 || v > max || !/^[$]?\d*\.?\d{0,3}\s*%?$/.test(t); e.target.style.color = bad ? 'var(--red)' : ''; e.target.dataset.bad = bad ? '1' : ''; },
      onchange: e => { if (e.target.dataset.bad) { ui.toast(title + ': enter a number from 0 to ' + max + (unit === '%' ? ' (for example 2.9)' : ' (for example 0.30)'), 'exclamationmark.triangle', 3200); e.target.value = unit === '$' ? Number(P[k] || 0).toFixed(2) : String(P[k] || 0); e.target.style.color = ''; e.target.dataset.bad = ''; return; }
        P[k] = Math.round(Number(e.target.value.replace(/[$%\s]/g, '')) * 1000) / 1000; syncFees(); re(); } });
    return h('div.row', h('div.row-main', h('div.row-title', title), sub && h('div.row-sub', sub)), unit === '$' && h('span.secondary', { style: 'margin-right:4px' }, '$'), inp, unit === '%' && h('span.secondary', { style: 'margin-left:4px' }, '%')); };
  const worked = m => fmt.money(ex, true) + ' + ' + fmt.money(X.portalFee(ex, m), true) + ' = ' + fmt.money(ex + X.portalFee(ex, m), true);
  const rate = (id, title, sub) => h('div.row', h('div.row-main', h('div.row-title', title), sub && h('div.row-sub', sub)), h('input.r1-num', { type: 'text', inputmode: 'decimal', 'aria-label': title, value: String(pb(id).rate), onchange: e => { pb(id).rate = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0; re(); } }));
  return ui.list(
    ui.section({ header: 'Who can change standing prices', fold: false, footer: C.approvals.driverPrice ? 'A driver can change a price on the invoice in front of them. Applying it to all future visits waits for an owner or admin, in Admin → CRM → Tasks.' : 'Anyone who invoices in the field, drivers included, can change a price for this and all future visits. Every change is kept in the customer’s history.' },
      ui.toggleRow({ title: 'Owner or admin approves drivers’ price changes', value: C.approvals.driverPrice, onChange: v => { C.approvals.driverPrice = v; re(); } })),
    ui.section({ header: 'Price-change letters', fold: false, footer: 'How much notice a price change gives by default, and how the letter goes out. Either can be changed on the change itself.' },
      ui.pickerRow({ title: 'Notice', value: C.letters.days, options: [0, 15, 30, 45, 60, 90].map(n => ({ value: n, label: n ? n + ' days out' : 'Starts right away' })), onChange: v => { C.letters.days = v; re(); } }),
      ui.pickerRow({ title: 'Send letters by', value: C.letters.method, options: [{ value: 'email', label: 'Email' }, { value: 'print', label: 'Print and mail' }, { value: 'both', label: 'Email, and print and mail' }], onChange: v => { C.letters.method = v; re(); } })),
    ui.section({ header: 'Fees for paying in the portal · card', fold: false, showFooter: true, footer: 'On a ' + fmt.money(ex, true) + ' invoice the customer pays ' + fmt.money(ex + X.portalFee(ex, 'card'), true) + ' by card (' + worked('card') + ').' },
      feeIn('cardPct', 'Card fee, percent', 'Any percentage, for example 2.9 or 3.49', '%', 15), feeIn('cardFixed', 'Card fee, fixed', 'Added to every card payment, for example 0.30', '$', 25)),
    ui.section({ header: 'Fees for paying in the portal · bank (ACH)', fold: false, showFooter: true, footer: 'On a ' + fmt.money(ex, true) + ' invoice the customer pays ' + fmt.money(ex + X.portalFee(ex, 'ach'), true) + ' from a bank account (' + worked('ach') + ').' + (P.achCap && P.achPct ? ' The percentage part never goes over ' + fmt.money(P.achCap, true) + '.' : '') },
      feeIn('achPct', 'ACH fee, percent', 'For example 0.8 or 1', '%', 15), feeIn('achFixed', 'ACH fee, fixed', 'Added to every bank payment', '$', 25), feeIn('achCap', 'ACH fee, at most', 'The most the percentage can come to · 0 for no cap', '$', 500)),
    ui.section({ fold: false, showFooter: true, footer: 'Paid by check or cash the invoice stays ' + fmt.money(ex, true) + '. Check your state’s rules on card surcharges.' }, ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'What the agreement and the portal say', subtitle: feeText() })),
    ui.section({ header: 'Service agreements', fold: false, footer: 'New agreements start at this term. After the term either side can cancel with the notice below. Your staff can set a longer term when a customer asks, up to the longest allowed. The customer sees the term when signing and cannot change it.' },
      ui.pickerRow({ title: 'Usual term', value: C.contract.term, options: [12, 24, 36, 48, 60].map(n => ({ value: n, label: n / 12 + (n === 12 ? ' year' : ' years') })), onChange: v => { C.contract.term = v; if (C.contract.max < v) C.contract.max = v; re(); } }),
      ui.pickerRow({ title: 'Longest term allowed', value: C.contract.max, options: [12, 24, 36, 48, 60].filter(n => n >= C.contract.term).map(n => ({ value: n, label: n / 12 + (n === 12 ? ' year' : ' years') })), onChange: v => { C.contract.max = v; re(); } }),
      ui.pickerRow({ title: 'Cancellation notice', value: C.contract.notice, options: [30, 60, 90].map(n => ({ value: n, label: n + ' days' })), onChange: v => { C.contract.notice = v; re(); } })),
    ui.section({ header: 'Purge box sizes', fold: false, footer: 'Legal and extra-large boxes are billed as their own lines, at the standard box rate (' + fmt.money(box, true) + ') times these: ' + fmt.money(box * PP.legalMult, true) + ' and ' + fmt.money(box * PP.xlMult, true) + '. Stairs are charged per standard-box equivalent, so larger boxes cost more to carry.' },
      ui.row({ title: 'A legal box costs', detail: '× ' + PP.legalMult, trailing: ui.stepper(Math.round(PP.legalMult * 20), 20, 80, v => { PP.legalMult = v / 20; re(); }) }), ui.row({ title: 'An extra-large box costs', detail: '× ' + PP.xlMult, trailing: ui.stepper(Math.round(PP.xlMult * 20), 20, 100, v => { PP.xlMult = v / 20; re(); }) }),
      rate('stairsDown', 'Stairs, carried down', 'Per standard-box equivalent'), rate('stairsUp', 'Stairs, carried up', 'Per standard-box equivalent'), rate('haul', 'Haul away the empties', 'Per box')),
    ui.section({ header: 'More', fold: false }, WD.ops && ui.row({ title: 'Time on site formulas', subtitle: 'Minimum stop time, consoles, bins, stairs and haul-away', chevron: true, onTap: () => page.push(WD.ops.siteSpec()) }), WD.r8 && ui.row({ title: 'Purge pricing', subtitle: 'By the box or by the bin', chevron: true, onTap: () => page.push(WD.r8.pricingSpec()) }), WD.ops && ui.row({ title: 'Items, services and fees', chevron: true, onTap: () => page.push(WD.ops.itemsSpec()) })));
} });
X.approvalsOn = () => C.approvals.driverPrice;
X.unpaidSettingsSpec = () => ({ title: 'Unpaid invoice warnings', render: page => { if (!admin()) return locked(); const U = C.unpaid, re = () => { WD.changed(); page.refresh(); }, on = U.on !== false;
  return ui.list(note('Whether the app warns about a customer who hasn’t paid, where, and when it starts.'),
    ui.section({ header: 'Warnings', fold: false, showFooter: true, footer: on ? 'Switch a place off to keep the warning away from the people who use it. The Unpaid invoices report and the balance on each customer always stay.' : 'Off: no striped job cards, no warning line on Dispatch, no overdue marker on customers and no past-due flag for drivers. The Unpaid invoices report and each customer’s balance still show what is owed.' },
      ui.toggleRow({ icon: 'exclamationmark.triangle', iconColor: on ? 'var(--red)' : 'var(--gray)', title: 'Unpaid invoice warnings', subtitle: on ? 'On' : 'Off everywhere', value: on, onChange: v => { U.on = v; re(); ui.toast(v ? 'Unpaid invoice warnings are on' : 'Unpaid invoice warnings are off', 'checkmark'); } }),
      on && ui.toggleRow({ title: 'On the board', subtitle: 'Striped job cards and the warning line on Dispatch', value: U.board !== false, onChange: v => { U.board = v; re(); } }),
      on && ui.toggleRow({ title: 'On the customer list and record', subtitle: 'The Overdue marker beside a customer', value: U.customers !== false, onChange: v => { U.customers = v; re(); } }),
      on && ui.toggleRow({ title: 'For drivers at the stop', subtitle: 'The past-due flag and the unpaid line on the job', value: U.drivers !== false, onChange: v => { U.drivers = v; re(); } })),
    ui.section({ header: 'Warn about a customer', fold: false, footer: 'A customer with more than this many unpaid invoices gets a warning line on the Dispatch tab, and their jobs show red and yellow stripes so the driver and dispatcher see it before the visit.' },
      ui.row({ title: 'With more than', detail: plural(U.limit, 'unpaid invoice'), trailing: ui.stepper(U.limit, 0, 12, v => { U.limit = v; re(); }) })),
    ui.section({ header: 'Overdue', fold: false, footer: 'An unpaid invoice older than this is overdue. Used by the Overdue marker and the “Overdue invoices” filter on the Customers list.' },
      ui.pickerRow({ title: 'An invoice is overdue after', value: U.overdueDays, options: [7, 15, 30, 45, 60, 90].map(n => ({ value: n, label: n + ' days' })), onChange: v => { U.overdueDays = v; re(); } })));
} });
/** Exact-time jobs, shown with the arrival windows (Settings → Routing assumptions). */
X.exactRows = page => [ui.toggleRow({ title: 'Exact-time jobs', subtitle: 'A job can need an exact arrival time, to the nearest 15 minutes', value: C.exact.on, onChange: v => { C.exact.on = v; WD.changed(); page.refresh(); } }),
  C.exact.on && h('div.row', h('div.row-main', h('div.row-title', 'Exact-time color'), h('div.row-sub', 'So these jobs stand out on the board and map')), h('div.r1-sw', ['#00897B', '#C2185B', '#6A1B9A', '#1565C0', '#000000'].map(c => h('button' + (c === C.exact.color ? '.on' : ''), { 'aria-label': 'Color ' + c, style: { background: c }, onclick: () => { C.exact.color = c; WD.changed(); page.refresh(); } }))))];

/* ================= Job editor and job details ================= */
X.editorInit = (f, job) => Object.assign(f, { exactAt: (job && job.exactAt) || '', material: (job && job.material) || '', handling: (job && job.handling) || C.disposal.nonPaper, needs: ((job && job.needs) || []).slice(), durOverride: (job && job.durOverride) || 0, crusher: !!(job && job.crusher), cardOnFile: false });
X.editorFields = f => { const exact = C.exact.on && f.exactAt && !f.allDay ? f.exactAt : '';
  return Object.assign({ exactAt: exact, material: f.type === 'purge' ? f.material : '', handling: f.handling, needs: f.needs.slice(), durOverride: f.durOverride || 0, crusher: !!f.crusher },
    exact ? { custFrom: exact, custUntil: hhmm(fmt.fromHHMM(exact) + 15), custStrict: true, needsWindow: false } : {}, f.durOverride ? { dur: f.durOverride } : {}); };
X.editorSections = (f, p, dirty, cust) => { if (f.allDay) return null; const re = () => { dirty(); p.refresh(); };
  return [
    !cust && f.custType === 'business' && f.type !== 'meet' && ui.section({ fold: false, footer: f.cardOnFile ? 'The card is charged when each stop is completed. The customer adds the card themselves in the portal.' : null }, ui.toggleRow({ icon: 'creditcard', iconColor: 'var(--blue)', title: 'Credit card on file', subtitle: 'For business customers', value: !!f.cardOnFile, onChange: v => { f.cardOnFile = v; re(); } })),
    f.type === 'purge' && ui.section({ header: 'What is being destroyed', fold: false, footer: f.material ? (f.handling === 'onsite' ? 'Shredded on site: the truck must arrive empty, then unload at a disposal site before serving paper customers. AutoRoute plans the unload stop.' : 'Picked up and shredded offsite. Nothing changes for the rest of the route.') + ' It shows in its own color on the board.' : 'A regular paper purge.' },
      ui.pickerRow({ title: 'Material', icon: 'shippingbox', iconColor: f.material && mat(f.material) ? mat(f.material).color : 'var(--gray)', value: f.material, options: [{ value: '', label: 'Paper (regular purge)' }].concat(C.materials.map(m => ({ value: m.id, label: m.name }))), onChange: v => { f.material = v; re(); } }),
      f.material && h('div.row', h('div', { style: 'flex:1' }, ui.segmented([{ value: 'offsite', label: 'Pick up, shred offsite' }, { value: 'onsite', label: 'Shred on site' }], f.handling, v => { f.handling = v; re(); })))),
    C.exact.on && f.type !== 'meet' && ui.section({ header: 'Exact time', fold: true, folded: true, footer: f.exactAt ? 'AutoRoute plans the day around this time, and the job shows in its own color so nobody misses it.' : 'For a customer who needs an exact time, like meeting the truck at a storage unit.' },
      ui.toggleRow({ title: 'Needs an exact arrival time', value: !!f.exactAt, onChange: v => { f.exactAt = v ? (f.custFrom || '09:00') : ''; if (v) f.needsWindow = false; re(); } }),
      f.exactAt && ui.quarterRow({ title: 'Arrive at', optional: false, value: f.exactAt, onChange: v => { if (v) { f.exactAt = v; dirty(); } } })),
    ui.section({ header: 'Time on site', fold: true, folded: true, footer: f.durOverride ? 'AutoRoute plans ' + f.durOverride + ' minutes for this job instead of the estimate.' : 'Leave empty to use the estimate. Type your own when you know better: extra people or a second truck, stairs, a long walk.' },
      h('div.row', h('div.row-main', h('div.row-title', 'Minutes for this job'), h('div.row-sub', 'Overrides the estimate')), h('input.r1-num', { type: 'text', inputmode: 'numeric', placeholder: 'Auto', 'aria-label': 'Minutes on site for this job', value: f.durOverride ? String(f.durOverride) : '', oninput: e => { f.durOverride = Math.min(960, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0); dirty(); }, onchange: () => p.refresh() }))),
    (C.skills.on || f.hdd > 0) && ui.section({ header: 'What this job needs', fold: true, folded: true, footer: 'Checked against the driver and truck on its route. ' + (C.skills.mode === 'block' ? 'A route that doesn’t qualify is refused.' : 'A job on a route that doesn’t qualify is flagged in red.') + (cust && (cust.needs || []).length ? ' ' + cust.name + ' also requires: ' + cust.needs.map(needText).join(', ') + '.' : '') },
      C.skills.on && C.skills.list.map(s => ui.toggleRow({ title: s.name, subtitle: KIND[s.kind], value: f.needs.includes(s.id), onChange: v => { f.needs = v ? f.needs.concat(s.id) : f.needs.filter(x => x !== s.id); dirty(); } })),
      f.hdd > 0 && ui.toggleRow({ icon: 'barcode', iconColor: 'var(--indigo)', title: 'Send a hard drive crusher with the driver', subtitle: 'When the route’s truck can’t shred hard drives', value: !!f.crusher, onChange: v => { f.crusher = v; dirty(); } }))];
};
function windowSheet(job, refresh) {
  const f = { mode: job.exactAt ? 'exact' : job.needsWindow ? 'needs' : job.custFrom || job.custUntil ? 'window' : 'none', at: job.exactAt || job.custFrom || '09:00', from: job.custFrom || '', until: job.custUntil || '', strict: !!job.custStrict };
  const label = () => f.mode === 'exact' ? 'Exactly ' + fmt.time(fmt.fromHHMM(f.at)) : f.mode === 'window' ? (f.from ? fmt.time(fmt.fromHHMM(f.from)) : 'any') + ' – ' + (f.until ? fmt.time(fmt.fromHHMM(f.until)) : 'any') : f.mode === 'needs' ? 'Needs a window' : 'No window';
  ui.sheet({ title: 'Time window', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => {
      if (f.mode === 'window' && !f.from && !f.until) return ui.toast('Choose a start or an end time', 'clock'); const who = me(), text = label();
      api.op({ kind: 'edit', title: job.title, scope: 'Window: ' + text, jobIds: [job.id], apply() {
        Object.assign(job, f.mode === 'exact' ? { exactAt: f.at, custFrom: f.at, custUntil: hhmm(fmt.fromHHMM(f.at) + 15), custStrict: true, needsWindow: false } : f.mode === 'window' ? { exactAt: '', custFrom: f.from, custUntil: f.until, custStrict: f.strict, needsWindow: false, windowBy: 'us' } : { exactAt: '', custFrom: '', custUntil: '', custStrict: false, needsWindow: f.mode === 'needs' });
        job.offWindow = null; job.events.push({ at: +WD.now(), actor: who, text: 'Window changed: ' + text }); } });
      p.dismiss(); refresh && refresh(); } }],
    render: p => ui.list(ui.section({ fold: false, footer: f.mode === 'exact' ? 'The customer needs an exact time. AutoRoute plans around it and the job shows in its own color.' : f.mode === 'needs' ? 'AutoRoute gives them a window when the route is finalized.' : f.mode === 'window' ? 'Change it any time: the dispatcher or driver may know something the app doesn’t.' : null },
        ui.pickerRow({ title: 'This job has', value: f.mode, options: [{ value: 'none', label: 'No window' }, { value: 'window', label: 'A time window' }, C.exact.on && { value: 'exact', label: 'An exact time' }, { value: 'needs', label: 'Needs a window' }].filter(Boolean), onChange: v => { f.mode = v; p.refresh(); } }),
        f.mode === 'exact' && ui.quarterRow({ title: 'Arrive at', optional: false, value: f.at, onChange: v => { if (v) f.at = v; } }),
        f.mode === 'window' && [ui.quarterRow({ title: 'From', value: f.from, onChange: v => { f.from = v; } }), ui.quarterRow({ title: 'Until', value: f.until, onChange: v => { f.until = v; } }), ui.toggleRow({ title: 'Required', subtitle: 'Off: preferred, fit it in if possible', value: f.strict, onChange: v => { f.strict = v; } })])) }, { detent: 'medium' });
}
async function timeOverride(job, refresh) {
  const est = WD.siteMinutes({ ...job, durOverride: 0 }), r = await ui.alert({ title: 'Minutes on site', message: 'The estimate is ' + est.minutes + ' minutes. Type your own for this job, for example when extra people or a second truck are going.', input: { type: 'number', placeholder: 'Minutes', value: job.durOverride ? String(job.durOverride) : '' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Use the estimate', value: 'auto' }, { label: 'Save', value: true, bold: true }] });
  if (!r || !r.value) return; const n = r.value === 'auto' ? 0 : Math.min(960, parseInt(r.text, 10) || 0), who = me();
  api.op({ kind: 'edit', title: job.title, scope: n ? 'Time on site: ' + n + ' min' : 'Time on site: estimate', jobIds: [job.id], apply() { job.durOverride = n; job.events.push({ at: +WD.now(), actor: who, text: n ? 'Time on site set to ' + n + ' minutes' : 'Time on site back to the estimate' }); } }); refresh && refresh();
}
async function pairJob(job, refresh) {
  if (job.pair) { const other = q.job(job.pair.with), a = await ui.actionSheet({ title: job.pair.role === 'pickup' ? 'Pickup for ' + (other ? other.title : 'a removed job') : 'Delivery from ' + (other ? other.title : 'a removed job'), buttons: [other && { label: 'Open the other stop', value: 'open' }, { label: 'Unpair', value: 'un', role: 'destructive' }].filter(Boolean) });
    if (a === 'open') WD.screens.jobs.openDetails(other.id); else if (a === 'un') { if (other) other.pair = null; job.pair = null; WD.changed(); refresh && refresh(); } return; }
  const list = data.jobs.filter(j => j !== job && j.day === job.day && !j.allDay && !j.pair && !WD.closed[j.status] && j.type !== 'dump').sort(q.order); if (!list.length) return ui.toast('No other open stops that day', 'info.circle');
  const id = await ui.actionSheet({ title: 'Pair ' + job.title + ' with', message: 'Choose the other stop on ' + fmt.day(job.day) + '.', buttons: list.slice(0, 10).map(j => ({ label: j.title + ' · ' + q.routeName(j.routeId), value: j.id })) }); if (!id) return;
  const role = await ui.actionSheet({ title: 'Which one is ' + job.title + '?', buttons: [{ label: 'The pickup (done first)', value: 'pickup' }, { label: 'The delivery (done second)', value: 'delivery' }] }); if (!role) return;
  const other = q.job(id); job.pair = { with: other.id, role }; other.pair = { with: job.id, role: role === 'pickup' ? 'delivery' : 'pickup' }; WD.changed(); refresh && refresh(); ui.toast('Paired · AutoRoute keeps the pickup first', 'checkmark', 2400);
}
/** Extra sections on Job details: window and time on site, what the job needs, inventory used, pairing. */
X.jobSections = (job, refresh) => { if (job.allDay || job.type === 'dump') return null;
  const edit = WD.can('jobs.edit') && !job.pending, sm = WD.siteMinutes(job), issues = X.issues(job), needs = X.needsOf(job), d = q.driverFor(job.routeId), v = vehicleFor(job.routeId), c = job.customerId && q.customer(job.customerId), over = c && X.warnOn('drivers') && X.overLimit && X.overLimit(c);
  const win = job.exactAt ? 'Exactly ' + fmt.time(fmt.fromHHMM(job.exactAt)) : job.custFrom || job.custUntil ? (job.custFrom ? shortT(fmt.fromHHMM(job.custFrom)) : 'any') + '–' + (job.custUntil ? shortT(fmt.fromHHMM(job.custUntil)) : 'any') : job.needsWindow ? 'Needs a window' : 'None';
  const uses = INV.on ? X.usesFor(job) : [], closed = !!WD.closed[job.status];
  return [
    over && WD.can('billing.view') && ui.section({ fold: false }, ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--red)', title: plural(X.unpaidInv(c).length, 'unpaid invoice') + ' · ' + fmt.money(X.owed(c)), subtitle: c.name + ' is over your limit of ' + C.unpaid.limit, chevron: true, onTap: () => WD.nav.push(WD.screens.customers.custInvoices(c.id, true)) })),
    ui.section({ header: 'Window and time on site', fold: false, footer: edit ? 'Both can be changed here when you know something the app doesn’t.' : null },
      ui.row({ icon: 'clock', iconColor: job.exactAt ? C.exact.color : 'var(--orange)', title: job.exactAt ? 'Exact time' : 'Time window', detail: win, chevron: edit, onTap: edit ? () => windowSheet(job, refresh) : null }),
      ui.row({ icon: 'timer', iconColor: 'var(--teal)', title: 'Time on site', subtitle: sm.source === 'override' ? 'Set on this job' : sm.source === 'history' ? 'Median of ' + sm.n + ' visits' : sm.source === 'purge' ? 'From the box count' : 'From the formula', detail: sm.minutes + ' min', chevron: edit, onTap: edit ? () => timeOverride(job, refresh) : null })),
    (needs.length > 0 || hddQty(job) > 0 || job.material || issues.length > 0) && ui.section({ header: 'What this job needs', fold: false, footer: issues.length ? (C.skills.mode === 'block' ? 'New assignments that don’t qualify are refused.' : 'Flagged on the board until it is fixed.') + ' Reassign the job, or update the person or truck in Settings.' : 'The driver and truck on this route qualify.' },
      needs.map(n => { const st = d ? holds(d, n, job.day) : 'none'; return ui.row({ icon: st === 'ok' ? 'checkmark.circle.fill' : 'xmark.circle.fill', iconPlain: true, iconColor: st === 'ok' ? 'var(--green)' : 'var(--red)', title: needText(n), subtitle: !d ? 'No driver on this route' : st === 'ok' ? d.name + ' qualifies' : st === 'expired' ? d.name + '’s has expired' : st === 'scope' ? d.name + '’s clearance doesn’t cover this site' : d.name + ' doesn’t have it on file' }); }),
      hddQty(job) > 0 && ui.row({ icon: v && (v.caps || []).includes('hdd') || job.crusher ? 'checkmark.circle.fill' : 'xmark.circle.fill', iconPlain: true, iconColor: v && (v.caps || []).includes('hdd') || job.crusher ? 'var(--green)' : 'var(--red)', title: plural(hddQty(job), 'hard drive') + ' to destroy', subtitle: v && (v.caps || []).includes('hdd') ? v.name + ' can shred hard drives' : job.crusher ? 'A crusher goes with the driver' : (v ? v.name : 'This truck') + ' can’t shred hard drives' }),
      hddQty(job) > 0 && !(v && (v.caps || []).includes('hdd')) && edit && ui.toggleRow({ title: 'Send a crusher with the driver', value: !!job.crusher, onChange: on => { job.crusher = on; job.events.push({ at: +WD.now(), actor: me(), text: on ? 'Hard drive crusher goes with the driver' : 'No crusher with the driver' }); WD.changed(); refresh && refresh(); } }),
      job.material && mat(job.material) && ui.row({ leading: h('span.ad-swatch', { style: { background: mat(job.material).color, width: '14px', height: '14px', borderRadius: '50%' } }), title: mat(job.material).name, subtitle: job.handling === 'onsite' ? 'Shred on site: arrive empty, then unload at a disposal site before paper customers' : 'Pick up and shred offsite' }),
      issues.filter(i => !/hard drives|does not|expired|no driver/i.test(i.text)).map(i => ui.row({ icon: 'exclamationmark.triangle', iconPlain: true, iconColor: i.level === 'bad' ? 'var(--red)' : 'var(--orange)', title: i.text }))),
    INV.on && (uses.length > 0 || edit) && ui.section({ header: 'Inventory used', fold: false, footer: job.invUsed ? 'Taken off ' + locName(job.invUsed.loc) + ' when the job was completed.' : 'Comes off ' + (v ? v.name : 'the truck') + ' when the job is completed.' },
      uses.map(u => { const it = invItem(u.id) || { name: u.id }; return ui.row({ title: it.name, subtitle: v ? stockOf(v.id, u.id) + ' on ' + v.name : null, detail: closed ? String(u.qty) : null, trailing: !closed && edit ? ui.stepper(u.qty, 0, 99, n => { job.uses = X.usesFor(job).map(x => x.id === u.id ? { ...x, qty: n } : { ...x }).filter(x => x.qty > 0); WD.changed(); refresh && refresh(); }) : null }); }),
      !uses.length && ui.row({ title: 'Nothing from the truck' }),
      !closed && edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an item', tint: true, onTap: async () => { const id = await ui.actionSheet({ title: 'Used on this job', buttons: INV.items.filter(i => !uses.some(u => u.id === i.id)).map(i => ({ label: i.name, value: i.id })) }); if (id) { job.uses = X.usesFor(job).map(x => ({ ...x })).concat({ id, qty: 1 }); WD.changed(); refresh && refresh(); } } })),
    C.pairs.on && ui.section({ header: 'Pickup and delivery', fold: false }, ui.row({ icon: 'arrow.left.arrow.right', iconColor: 'var(--purple)', title: job.pair ? (job.pair.role === 'pickup' ? 'Pickup · delivered at ' : 'Delivery · picked up at ') + ((q.job(job.pair.with) || {}).title || 'a removed job') : 'Pair with another stop', subtitle: job.pair ? 'AutoRoute keeps the pickup first' : 'Link a pickup with its delivery', chevron: edit, onTap: edit ? () => pairJob(job, refresh) : null }))];
};
if (WD.biz) { const base = WD.biz.jobSections; WD.biz.jobSections = (job, refresh) => [base(job, refresh), X.jobSections(job, refresh)]; }

/* ================= Where it all lives in Settings ================= */
/* Disposal sites, How trucks are tracked, truck capabilities and truck compliance live in Maintenance → Fleet setup (rc-ops.js).
   omit: titles to leave out, for a caller that shows them somewhere else (for example an HR group). */
const ENTRIES = omit => [
  ['globe', 'var(--blue)', 'Country, currency and units', countryName() + ' · ' + WD.locale.currency + ' · ' + (WD.locale.units === 'metric' ? 'metric' : 'miles and pounds'), X.unitsSpec, 'For companies outside the United States'],
  ['tag', 'var(--pink)', 'Job types and fields', plural(WD.shownJobTypes().length, 'job type') + ' offered', () => WD.admin.typesSpec(), 'Add, rename, hide or delete; non-paper purge sub-categories. Customer types are in Customers → gear'],
  ['person.2', 'var(--indigo)', 'Skills, licenses and clearances', !C.skills.on ? 'Off' : C.skills.mode === 'block' ? 'Don’t allow a mismatch' : 'Flag a mismatch', () => X.skillsSpec('people'), 'Match people to jobs: CDL, prison clearances, hard drive destruction'],
  ['bell', 'var(--red)', 'Compliance and reminders', (n => n ? plural(n, 'item') + ' coming up' : 'Up to date')(X.expiring(false, 'people').length) + ' · ' + C.compliance.noticeDays + ' days’ notice', () => X.complianceSpec('people'), 'Drivers’ licenses, medical cards and clearances. Truck items are in Maintenance'],
  ['shippingbox', 'var(--teal)', 'Inventory', INV.on ? 'On · warehouse and ' + plural(data.vehicles.filter(v => v.active !== false).length, 'truck') : 'Off', X.inventorySpec, 'Stock on each truck and in the warehouse, used up as jobs are completed'],
  ['exclamationmark.circle', 'var(--red)', 'Unpaid invoice warnings', X.unpaidLabel(), X.unpaidSettingsSpec, 'Turn the warnings on or off, and when customers and their jobs are flagged'],
  ['dollarsign.circle', 'var(--green)', 'Pricing and Agreements', C.letters.days + ' days’ notice · ' + C.contract.term / 12 + '-year term', X.moneySpec, 'Driver price changes, price-change letters, portal fees, contract length, box sizes'],
  ['arrow.left.arrow.right', 'var(--purple)', 'Pickup-and-delivery pairs', C.pairs.on ? 'On' : 'Off', X.pairsSpec, 'Two linked stops: pick up at one, drop off at the other']].filter(e => !(omit || []).includes(e[2]));
X.unpaidLabel = () => C.unpaid.on === false ? 'Off' : 'Warn over ' + C.unpaid.limit + ' · overdue after ' + C.unpaid.overdueDays + ' days';
X.moneyLabel = () => C.letters.days + ' days’ notice · ' + C.contract.term / 12 + '-year term';
/* In Settings these two are under Company (registered by r14-money.js), so the Add-ons group there leaves them out. */
const IN_COMPANY = ['Unpaid invoice warnings', 'Pricing and Agreements'];
X.hubSection = (row, omit) => ui.section({ header: 'Add-ons', fold: false, footer: 'Switch on what your business uses. Everything here can be changed later.' }, ENTRIES(omit).map(e => row(...e)));
X.settingsSection = (push, gated, omit) => ui.section({ header: 'Add-ons', footer: 'Extras a company switches on or adjusts: international settings, custom job types, skills and clearances, license reminders, inventory and more. Trucks, disposal sites and fleet compliance are in Maintenance. Every other setting is under Settings and assumptions above.' },
  ENTRIES(omit).filter(e => !(WD.money && IN_COMPANY.includes(e[2]))).map(([ic, color, title, detail, spec, sub]) => ui.row(gated(title === 'Compliance and reminders' ? 'jobs.edit' : 'settings.manage', { icon: ic, iconColor: color, title, subtitle: [detail && h('div', { style: 'color:var(--label);font-weight:500' }, detail), h('div', sub)], chevron: true, onTap: () => push(spec()) }))));

const openSet = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
const openMaint = spec => { WD.nav.switchTab('maintenance'); WD.nav.push(spec); };
WD.panel.addJump('Skills and clearances', () => openSet(X.skillsSpec('people')));
WD.panel.addJump('Compliance', () => openSet(X.complianceSpec('people')));
WD.panel.addJump('Inventory', () => openSet(X.inventorySpec()));
WD.panel.addJump('Disposal sites', () => openMaint(X.disposalSpec()));
WD.panel.addJump('Country and units', () => openSet(X.unitsSpec()));
})();
