/* Work Dispatcher prototype — mock data (fictional company, people and customers) and query helpers on WD.q. */
(function () {
'use strict';
const WD = window.WD, D = WD.date, data = WD.data;
let seed = 20261113; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];

WD.jobTypes = [
  { id: 'regular', title: 'Route service (recurring)', color: '#616161' }, { id: 'purge', title: 'Purge (one time)', color: '#F6BF26' }, { id: 'government', title: 'Government', color: '#3F51B5' },
  { id: 'creditCard', title: 'Credit card on file', color: '#039BE5' }, { id: 'setup', title: 'Setup / first service', color: '#D50000' }, { id: 'meet', title: 'Meet the truck', color: '#E67C73' },
];
WD.jobStatuses = {
  scheduled: { title: 'Scheduled', color: 'var(--gray)', icon: 'circle' }, enroute: { title: 'En route', color: 'var(--blue)', icon: 'truck' },
  arrived: { title: 'On site', color: 'var(--orange)', icon: 'mappin' }, completed: { title: 'Completed', color: 'var(--green)', icon: 'checkmark.circle.fill' }, skipped: { title: 'Skipped', color: 'var(--red)', icon: 'xmark.circle.fill' },
  canceled: { title: 'Canceled', color: 'var(--red)', icon: 'xmark.circle.fill' }, rescheduled: { title: 'Rescheduled', color: 'var(--purple)', icon: 'calendar' }, postponed: { title: 'Postponed', color: 'var(--orange)', icon: 'clock' },
};
/** Jobs that are finished for the day: done, skipped, or called off by the customer. Struck-through statuses show a line through the title. */
WD.closed = { completed: 1, skipped: 1, canceled: 1, rescheduled: 1, postponed: 1 };
WD.struck = { skipped: 1, canceled: 1, rescheduled: 1, postponed: 1 };
/** Called off before anyone drove there (canceled, rescheduled to another day, postponed). These stay on the original day, struck through,
    but sink to the bottom of the list, carry no stop number, and are left off the map and out of AutoRoute. */
WD.calledOff = j => j.status === 'canceled' || j.status === 'rescheduled' || j.status === 'postponed';
/** Whether a called-off job drops to the bottom of its day's list (Settings → Routing assumptions). Off: it stays where it was, still without a stop number. */
WD.sinks = j => WD.calledOff(j) && data.workflow.sinkCalledOff !== false;
/** Customer type is separate from job type: who the customer is, not what the visit is. */
WD.custTypes = [{ id: 'business', title: 'Business' }, { id: 'government', title: 'Government' }, { id: 'residential', title: 'Residential' }];
WD.custType = id => WD.custTypes.find(t => t.id === id) || WD.custTypes[0];
/** Containers and pricing. A customer (and each job) holds items [{id, qty, rate}]; rates start from the price book and can be changed per customer and per job. */
data.priceBook = [
  { id: 'console', name: 'Console service', unit: 'console', rate: 30 }, { id: 'bin64', name: 'Bin service (64 gal)', unit: 'bin (64 gal)', rate: 45 }, { id: 'bin96', name: 'Bin service (96 gal)', unit: 'bin (96 gal)', rate: 60 },
  { id: 'box', name: 'Purge, per box', unit: 'box', rate: 8 }, { id: 'trip', name: 'Trip charge', unit: 'trip', rate: 25 }, { id: 'cod', name: 'Certificate of destruction', unit: 'certificate', rate: 0 },
  { id: 'stairsDown', name: 'Stairs — carried down, per box', unit: 'box', rate: 3 }, { id: 'stairsUp', name: 'Stairs — carried up, per box', unit: 'box', rate: 4 }, { id: 'haul', name: 'Haul away empty boxes, per box', unit: 'box', rate: 2 },
  { id: 'hdd', name: 'Hard drive destruction', unit: 'hard drive', rate: 10 },
  { id: 'binFlat', name: 'Purge, up to 2 bins (65 gal)', unit: 'flat fee', rate: 150 }, { id: 'binExtra', name: 'Purge, each additional bin (65 gal)', unit: 'bin (65 gal)', rate: 60 },
];
/** Purge estimating (Settings → Purge estimates). Box sizes count as standard banker boxes (10×12×15"); bins, pallets, gaylords and cabinets convert to boxes.
    Time on site: a 10-minute minimum covers up to 10 boxes, then 100 boxes an hour. Stairs take 2–3× as long; hauling the empties away doubles the time.
    pallet / gaylord / cabinet are starting guesses to be confirmed by the owner. learned: completed purges with recorded times, used to tune the estimate. */
data.purgeRules = { minMin: 10, minBoxes: 10, perHour: 100, legal: 1.65, xl: 2, bin65: 8, pallet: 40, gaylord: 35, cabinet: 6, stairsFactor: 2.5, haulFactor: 2, learned: 0 };
WD.PURGE_UNITS = [['std', 'Standard boxes', '10×12×15" bankers box', 1], ['legal', 'Legal boxes', '10×12×24" · counts 1.65', 'legal'], ['xl', 'Extra-large boxes', '10×15×24" · counts 2', 'xl'],
  ['bin65', '65-gallon bins', '8 boxes per bin', 'bin65'], ['pallet', 'Pallets', '≈ boxes per pallet', 'pallet'], ['gaylord', 'Gaylords', '≈ boxes per gaylord', 'gaylord'], ['cabinet', 'File cabinets', '≈ boxes per 4-drawer cabinet', 'cabinet']];
/** p: {std, legal, xl, bin65, pallet, gaylord, cabinet, stairs: 'none'|'down'|'up', haul} → {boxes (standard-box equivalents), minutes, low, high, guess, why}.
    Exact counts (62) are usually close; round numbers (20, 50, 100, 150…) and pallets, gaylords or cabinets are guesses, so those get a range. */
WD.purgeEstimate = p => {
  const P = data.purgeRules; p = p || {};
  const per = k => typeof k === 'number' ? k : P[k], boxes = WD.PURGE_UNITS.reduce((s, [id, , , k]) => s + (+p[id] || 0) * per(k), 0);
  const counts = WD.PURGE_UNITS.map(([id]) => +p[id] || 0).filter(n => n > 0), rough = ['pallet', 'gaylord', 'cabinet'].some(id => +p[id] > 0);
  const roundNum = counts.some(n => n >= 20 && n % 10 === 0), guess = rough || roundNum;
  const time = b => { let m = P.minMin + Math.max(0, b - P.minBoxes) / P.perHour * 60; if (p.stairs && p.stairs !== 'none') m *= P.stairsFactor; if (p.haul) m *= P.haulFactor; return Math.round(m); };
  const minutes = boxes > 0 ? time(boxes) : 0;
  return { boxes: Math.round(boxes * 10) / 10, billable: Math.ceil(boxes), minutes, low: guess ? time(boxes * 0.5) : minutes, high: guess ? time(boxes * 1.5) : minutes, guess, why: rough ? 'counted by pallets, gaylords or cabinets' : roundNum ? 'round numbers are usually guesses' : '' };
};
/** Extra charges a purge's details add to its billing lines: stairs per box (down or up) and hauling away the empty boxes. */
WD.purgeExtras = (p, boxes) => { const out = [], pb = id => data.priceBook.find(x => x.id === id);
  if (p && p.stairs === 'down') out.push({ id: 'stairsDown', qty: boxes, rate: pb('stairsDown').rate }); if (p && p.stairs === 'up') out.push({ id: 'stairsUp', qty: boxes, rate: pb('stairsUp').rate });
  if (p && p.haul) out.push({ id: 'haul', qty: boxes, rate: pb('haul').rate }); return out; };
/** How purge jobs are priced (Settings → Purge pricing). 'box': a rate per box. 'bin': by the 65-gallon bin, a flat fee that covers the first
    bins and a rate for each one after. Boxes turn into bins with data.purgeRules.bin65 (boxes that fit in a bin). */
data.purgePricing = { method: 'box', binFlat: 150, binIncluded: 2, binExtra: 60 };
WD.PURGE_IDS = ['box', 'binFlat', 'binExtra', 'stairsDown', 'stairsUp', 'haul'];
WD.purgeBins = boxes => boxes > 0 ? Math.max(1, Math.ceil(boxes / (data.purgeRules.bin65 || 8) - 1e-9)) : 0;
/** Keep the two bin items in the price book in step with the pricing settings. */
WD.syncPurgeBook = () => { const PP = data.purgePricing, f = data.priceBook.find(x => x.id === 'binFlat'), x = data.priceBook.find(x => x.id === 'binExtra');
  if (f) { f.rate = PP.binFlat; f.name = 'Purge, up to ' + PP.binIncluded + (PP.binIncluded === 1 ? ' bin' : ' bins') + ' (65 gal)'; } if (x) x.rate = PP.binExtra; };
/** Billing lines for a purge: p = what the customer has, e = WD.purgeEstimate(p), boxRate = this job's per-box rate (box pricing only). */
WD.purgeItems = (p, e, boxRate) => { const PP = data.purgePricing, extras = WD.purgeExtras(p, e.billable); if (!e.billable) return extras;
  if (PP.method === 'bin') { const bins = WD.purgeBins(e.boxes), more = Math.max(0, bins - PP.binIncluded); return [{ id: 'binFlat', qty: 1, rate: PP.binFlat, bins }].concat(more ? [{ id: 'binExtra', qty: more, rate: PP.binExtra }] : [], extras); }
  return [{ id: 'box', qty: e.billable, rate: boxRate != null ? boxRate : data.priceBook.find(x => x.id === 'box').rate }].concat(extras); };
/** The two bin lines for a count of bins (used when the driver changes the count on site). */
WD.binLines = bins => { const PP = data.purgePricing, more = Math.max(0, bins - PP.binIncluded); return [{ id: 'binFlat', qty: 1, rate: PP.binFlat, bins }].concat(more ? [{ id: 'binExtra', qty: more, rate: PP.binExtra }] : []); };
/** ETA windows given to customers who asked for one: 2 hours before 10 AM, 3 hours from 10 to 1, 4 hours after 1 PM. */
WD.etaWindow = eta => { const E = data.workflow.eta, len = eta < 10 * 60 ? E.early : eta < 13 * 60 ? E.mid : E.late, from = Math.max(6 * 60, Math.round((eta - len / 2) / 30) * 30); return { from, until: from + len }; };
/** Time on site for a stop with no recorded visits (Settings → Time on site). Route service: a minimum stop time plus minutes per container.
    A new setup adds setupExtra minutes to whatever the stop would otherwise take. pace is the time a truck takes as a percentage of normal
    (120 = 20% longer); a vehicle's own pace wins over the overall one. Purge jobs use data.purgeRules instead. */
data.siteRules = { route: { min: 10, console: 2, bin64: 3, bin96: 4 }, setupExtra: 10, pace: 100 };
WD.paceFor = routeId => { const r = WD.q.route(routeId), v = r && WD.q.vehicle(r.vehicleId); return ((v && v.pace) || data.siteRules.pace || 100) / 100; };
WD.routeFormula = job => { const R = data.siteRules.route, n = id => +(((job.items || []).find(i => i.id === id) || {}).qty) || 0, c = n('console'), b = n('bin64'), g = n('bin96');
  return c + b + g ? { minutes: R.min + c * R.console + b * R.bin64 + g * R.bin96, counted: true } : { minutes: data.workflow.defaultStopMin, counted: false }; };
/** Minutes on site AutoRoute plans for a job, and where the number came from: 'purge' (box estimate), 'history' (median of recorded visits) or 'formula'. */
WD.siteMinutes = job => {
  const pace = WD.paceFor(job.routeId), setup = job.type === 'setup' || (job.flags && job.flags.setup) ? data.siteRules.setupExtra : 0;
  if (job.type === 'purge' && job.purge) { const e = WD.purgeEstimate(job.purge); if (e.minutes) return { minutes: Math.round(e.minutes * pace), source: 'purge', est: e, pace, setup: 0 }; }
  const c = job.customerId && WD.q.customer(job.customerId);
  if (c && ['customer', 'serviced'].includes(c.lifecycle) && job.type !== 'setup') { const s = WD.q.visitStats(job); return { minutes: s.median + setup, source: 'history', n: s.n, pace: 1, setup }; }
  const f = WD.routeFormula(job); return { minutes: Math.round(f.minutes * pace) + setup, source: 'formula', counted: f.counted, pace, setup };
};
/** Planned departure per route and day: key routeId + '|' + day → { depart (minutes), manual }. */
data.routeDays = {};
WD.CONTAINERS = ['console', 'bin64', 'bin96', 'box'];
const plural = (n, w) => n + ' ' + (n === 1 ? w : w.replace(/^(\w+)/, m => m === 'box' ? 'boxes' : m + 's'));
WD.parseItems = str => { const out = []; String(str || '').split(',').forEach(part => { const m = /(\d+)\s*(.*)/.exec(part.trim()); if (!m) return; const n = +m[1], t = m[2].toLowerCase();
  const id = /box/.test(t) ? 'box' : /96/.test(t) ? 'bin96' : /bin/.test(t) ? 'bin64' : 'console'; const pb = data.priceBook.find(x => x.id === id); out.push({ id, qty: n, rate: pb.rate }); }); return out; };
/** "4 consoles, 1 bin (64 gal)" — or "≈40 boxes (estimate)" for purge jobs. */
WD.itemsLabel = (items, purge) => { const bf = (items || []).find(i => i.id === 'binFlat' && i.qty > 0), ex = (items || []).find(i => i.id === 'binExtra'), bins = bf ? bf.bins || data.purgePricing.binIncluded + (ex ? ex.qty : 0) : 0;
  return (bf ? ['≈' + bins + (bins === 1 ? ' bin' : ' bins') + ' (65 gal)'] : []).concat((items || []).filter(i => WD.CONTAINERS.includes(i.id) && i.qty > 0).map(i => (purge && i.id === 'box' ? '≈' : '') + plural(i.qty, data.priceBook.find(x => x.id === i.id).unit))).join(', '); };
WD.copyItems = items => (items || []).map(i => ({ ...i }));
WD.lifecycle = ['lead', 'contacted', 'quoted', 'scheduled', 'serviced', 'customer'];
/* Which fields the job editor and new-customer form ask for, per job type (Settings → Job types and fields). Name is always asked. */
WD.fieldDefs = [
  ['contact', 'Contact name'], ['phone', 'Phone'], ['email', 'Email'], ['billingEmail', 'Billing email (if different)'], ['address', 'Service address'], ['hours', 'Office hours'],
  ['items', 'Containers and quantities'], ['pricing', 'Pricing'], ['freq', 'Frequency of service'], ['po', 'PO number'], ['contract', 'Contract number'],
  ['window', 'Requested time window'], ['signature', 'Customer signature required'], ['notes', 'Notes'],
];
const ROUTE_FIELDS = ['contact', 'phone', 'email', 'billingEmail', 'address', 'hours', 'items', 'pricing', 'freq', 'po', 'contract', 'window', 'signature', 'notes'];
data.fieldConfig = { regular: ROUTE_FIELDS, setup: ROUTE_FIELDS, creditCard: ROUTE_FIELDS.filter(f => f !== 'po' && f !== 'contract'), government: ROUTE_FIELDS,
  purge: ['contact', 'phone', 'email', 'address', 'items', 'pricing', 'window', 'signature', 'notes'], meet: ['phone', 'notes'] };
WD.asks = (type, field) => (data.fieldConfig[type] || ROUTE_FIELDS).includes(field);
/* Required fields (Settings → Job types and fields). A field can be required for a job type, for a customer type, or both —
   e.g. email for government customers. Pricing and the signature policy always have a value, so they can't be required. */
WD.REQUIRABLE = WD.fieldDefs.map(x => x[0]).filter(k => k !== 'pricing' && k !== 'signature');
data.required = { job: { regular: ['phone'], setup: ['phone'], creditCard: ['phone'], government: ['phone'], purge: ['phone'], meet: ['phone'] }, cust: { business: [], government: ['email'], residential: [] } };
WD.requires = (jobType, custType, field) => ((data.required.job[jobType] || []).includes(field) && WD.asks(jobType, field)) || (data.required.cust[custType] || []).includes(field);
WD.fieldLabel = k => (WD.fieldDefs.find(x => x[0] === k) || [k, k])[1];
/* What each job type needs to know about where the job is: a street address, just a city or ZIP (meet-the-truck customers come to us), or nothing. */
data.addressRules = { regular: 'address', setup: 'address', creditCard: 'address', government: 'address', purge: 'address', meet: 'cityzip' };
WD.ADDRESS_RULES = [{ value: 'address', label: 'Street address' }, { value: 'cityzip', label: 'City or ZIP only' }, { value: 'none', label: 'Not needed' }];
/** null when the job has the location its type needs, else what's missing ('No address' / 'No city or ZIP'). Day notes never need one. */
WD.addressIssue = j => { if (!j || j.allDay) return null; const rule = data.addressRules[j.type] || 'address', has = String(j.address || '').trim();
  return rule === 'none' || has ? null : rule === 'cityzip' ? (String(j.cityZip || '').trim() ? null : 'No city or ZIP') : 'No address'; };
/** Upcoming jobs (today onward, still open) missing the location their type needs and not marked ignored. */
WD.missingAddresses = () => data.jobs.filter(j => j.day >= D.today() && !WD.closed[j.status] && !j.addrIgnored && WD.addressIssue(j)).sort((a, b) => a.day.localeCompare(b.day) || WD.q.order(a, b));
/* Time clock: overtime rules and location stays (Settings → Time clock and overtime). */
/* Field workflow (Settings → Field workflow): company-wide choices for how drivers move through a stop. */
data.workflow = {
  arrival: 'auto',          // 'auto' = infer arrival from GPS (near the stop for dwellMin), 'button' = driver taps I've arrived, 'both'
  dwellMin: 2,              // minutes within the geofence before arrival is recorded
  onComplete: 'billing',    // 'billing' = open the billing details, 'complete' = just mark it done, 'ask' = ask each time
  afterBilling: 'next',     // 'next' = show the next customer, 'navigate' = show it and start directions, 'stay'
  dimWhen: 'billed',        // completed jobs fade only once invoiced / paid–no invoice / service note ('billed'), or as soon as completed ('completed')
  missedCheck: true,        // warn about stops with no invoice, no paid–no invoice and no skip
  shiftCutoff: 16,          // hours after clock-in when tracking stops automatically
  titleDetails: { on: true, hours: true, lunch: true, closed: true, setup: true, extraBin: true, extraShred: true, early: true, window: true, callAhead: true },
  normalOpen: '08:00', normalClose: '17:00',
  pretripMin: 15,           // minutes for the pre-trip check and loading, added before the recommended departure
  dayStartMin: 7 * 60 + 30, // when a driver's day starts if AutoRoute has nothing better to go on
  eta: { early: 120, mid: 180, late: 240 }, // minutes of arrival window given to customers: before 10 AM, 10 to 1, after 1 PM
  defaultStopMin: 20,       // minutes on site assumed for a stop with no history
  sinkCalledOff: true,      // canceled, postponed and rescheduled jobs drop to the bottom of the day's list
  speedPct: 100,            // drive-time estimate, as a percentage of the map's normal estimate (110 = allow 10% longer)
};
WD.state.prefs = { mapsApp: 'apple' };
data.serviceNotes = [];
data.timeRules = { daily: { on: true, hours: 10, rate: 1.5 }, weekly: { on: true, hours: 40, rate: 1.5 }, double: { on: false, hours: 12, rate: 2 }, stayMinutes: 4, unpaidBreak: 30 };

data.orgs = [
  { id: 'o1', name: 'Discount Shred', role: 'owner', trucks: 4, plan: 'Internal', city: 'Lakemont' },
  { id: 'o2', name: 'Lakemont Hauling (demo)', role: 'dispatcher', trucks: 2, plan: 'Trial · 9 days left', city: 'Lakemont' },
];
/* Signatures on file are stored as SVG paths in a 300 × 90 box. */
const SIG = {
  u4: 'M14 62c10-30 18-44 24-40s-8 34-2 36 14-30 22-30-6 26 2 26 12-18 18-18 2 14 10 12 14-10 22-10M120 58c6-12 16-26 24-24s-10 24-2 24 18-16 26-16 4 12 12 10 20-14 30-14 8 8 16 6M218 50c14-4 30-6 52-8',
  u5: 'M18 56c6-24 22-42 30-38s-14 40-6 40 16-34 26-32-8 28 0 28 22-14 30-14M130 60c4-20 12-34 22-30s-6 26 4 24 14-18 20-16-2 14 6 14 26-8 40-10M236 46c12 0 28-4 40-8',
  u6: 'M16 60c14-36 30-44 34-36s-18 34-8 34 20-24 28-22-4 18 4 18 18-10 26-12M132 58c10-30 24-38 28-30s-10 26 0 26 22-22 30-20-4 16 6 16 22-8 34-10',
  u1: 'M20 58c8-28 20-40 28-36s-12 36-2 36 20-30 30-28-6 24 4 24 22-12 34-14M150 56c10-18 26-30 32-24s-12 22-2 22 28-14 44-16',
};
data.users = [
  { id: 'u1', name: 'Dana Whitfield', email: 'dana@discountshred.example', phone: '+15125550101', role: 'owner', status: 'active', lastSeen: 'Now' },
  { id: 'u2', name: 'Priya Raman', email: 'priya@discountshred.example', phone: '+15125550102', role: 'dispatcher', status: 'active', lastSeen: '6 min ago' },
  { id: 'u3', name: 'Colleen Abbott', email: 'colleen@discountshred.example', phone: '+15125550103', role: 'office', status: 'active', lastSeen: '1 hr ago' },
  { id: 'u4', name: 'Marcus Bell', email: 'marcus@discountshred.example', phone: '+15125550104', role: 'driver', status: 'active', lastSeen: 'On shift' },
  { id: 'u5', name: 'Tony Alvarez', email: 'tony@discountshred.example', phone: '+15125550105', role: 'driver', status: 'active', lastSeen: 'On shift' },
  { id: 'u6', name: 'Sam Okafor', email: 'sam@discountshred.example', phone: '+15125550106', role: 'driver', status: 'active', lastSeen: 'On shift' },
  { id: 'u7', name: 'Jess Lindqvist', email: 'jess@discountshred.example', phone: '', role: 'driver', status: 'invited', lastSeen: 'Invited 2 days ago' },
  { id: 'u8', name: 'Luis Ortega', email: 'luis@discountshred.example', phone: '+15125550108', role: 'staff', status: 'active', lastSeen: 'On shift' },
];
data.users.forEach(u => { if (SIG[u.id]) u.signature = SIG[u.id]; });
/* Places trucks start and end the day. Trucks are kept in different places and get switched around, so every vehicle has its own start and end. */
data.places = [
  { id: 'p1', name: 'Shop', address: '400 Industrial Way, Lakemont', x: 505, y: 520 }, { id: 'p2', name: 'North yard', address: '88 Ridge Rd, Lakemont', x: 560, y: 120 },
  { id: 'p3', name: 'Marcus’s house', address: '1290 Aspen Ct, Lakemont', x: 390, y: 250 }, { id: 'p4', name: 'West storage lot', address: '17 Depot Ln, Lakemont', x: 150, y: 520 },
];
data.vehicles = [
  { id: 'v1', name: 'Truck 12', plate: 'KSH-4127', kind: 'Shred truck', startId: 'p3', endId: 'p3', gps: 'OneStep · 862104' }, { id: 'v2', name: 'Truck 14', plate: 'KSH-5530', kind: 'Shred truck', startId: 'p1', endId: 'p1', gps: 'OneStep · 862117' },
  { id: 'v3', name: 'Truck 7', plate: 'JRT-9012', kind: 'Shred truck', startId: 'p4', endId: 'p4', gps: 'OneStep · 862133' }, { id: 'v4', name: 'Truck 9', plate: 'HLD-3368', kind: 'Box truck (purges)', startId: 'p1', endId: 'p2', gps: null },
];
/** Per-day overrides when a truck starts or ends somewhere else: key vehicleId + '|' + day → { startId, endId }. */
data.vehicleDays = {};
/* A route is a business route (never a person). nickname / colorOverride / visible / order are per-user preferences. */
data.routes = [
  { id: 'r1', name: 'North Route', color: '#039BE5', nickname: '', colorOverride: null, visible: true, order: 0, timeZone: 'America/Chicago', driverId: 'u4', vehicleId: 'v1', googleCalendar: 'north@discountshred.example', writable: true },
  { id: 'r2', name: 'South Route', color: '#33B679', nickname: '', colorOverride: null, visible: true, order: 1, timeZone: 'America/Chicago', driverId: 'u5', vehicleId: 'v2', googleCalendar: 'south@discountshred.example', writable: true },
  { id: 'r3', name: 'West Route', color: '#F4511E', nickname: '', colorOverride: null, visible: true, order: 2, timeZone: 'America/Chicago', driverId: 'u6', vehicleId: 'v3', googleCalendar: 'west@discountshred.example', writable: true },
  { id: 'r4', name: 'Purge Truck', color: '#8E24AA', nickname: '', colorOverride: null, visible: true, order: 3, timeZone: 'America/Chicago', driverId: null, vehicleId: 'v4', googleCalendar: 'purges@discountshred.example', writable: true },
];
/* Map space is 1000 × 1000 (x → east, y → south). The shop sits near the middle. */
data.depot = { name: 'Shop', address: '400 Industrial Way, Lakemont', x: 505, y: 520 };

const C = (id, name, route, x, y, address, o = {}) => ({ id, name, kind: o.kind || 'company', route, lifecycle: o.lifecycle || 'customer', channel: o.channel || 'Referral', type: o.type || 'regular', freq: o.freq || 'Every 2 weeks',
  contacts: o.contacts || [], locations: [{ id: id + 'l1', label: o.label || 'Main office', address: address + ', Lakemont', x, y, containers: o.containers || '2 consoles', bizOpen: o.open || '08:00', bizClose: o.close || '17:00', notes: o.notes || '',
    lunchFrom: o.lunch ? o.lunch[0] : '', lunchUntil: o.lunch ? o.lunch[1] : '', closedDays: o.closed || [], callAhead: o.call || 0 }],
  owner: o.owner || 'u3', nextAction: o.next || null, notes: o.cnotes || '', tags: o.tags || [], stats: null,
  custType: o.kind === 'household' ? 'residential' : o.type === 'government' ? 'government' : 'business', billingEmail: o.billing || '', po: o.po || '', contract: o.contract || '', signature: o.sig || (o.type === 'government' ? 'always' : 'optional'), billingMode: o.mode || 'invoice', documents: [], poSchedule: [] });
/** Customer signature policy: 'always' (required on every invoice), 'optional' (driver asks if needed) or 'never' (not asked). */
WD.sigPolicy = c => !c ? 'optional' : c.signature || (c.requiresSignature ? 'always' : 'optional');
WD.SIG_POLICIES = [{ value: 'always', label: 'Always required' }, { value: 'optional', label: 'Optional — driver decides' }, { value: 'never', label: 'Never needed' }];
const P = (name, role, phone, email) => ({ name, role, phone: '+1512555' + phone, email });
data.customers = [
  C('c1', 'Harlow & Finch Law', 'r1', 520, 300, '210 Mercer St, Suite 400', { contacts: [P('Renee Harlow', 'Office manager', '0142', 'renee@harlowfinch.example'), P('Front desk', '', '0143', 'frontdesk@harlowfinch.example')], containers: '4 consoles', notes: 'Check in at reception. Service elevator is around back.', channel: 'Google Ads', freq: 'Weekly' }),
  C('c4', 'Northgate Credit Union', 'r1', 640, 180, '900 Northgate Blvd', { contacts: [P('Derek Solis', 'Branch manager', '0151', 'dsolis@northgatecu.example')], containers: '3 consoles, 1 bin (64 gal)', open: '09:00', notes: 'Not before 9. Sign in with security.', channel: 'Referral', freq: 'Weekly' }),
  C('c6', 'Lakemont Pediatrics', 'r1', 420, 220, '55 Willow Creek Rd', { contacts: [P('Aisha Karim', 'Practice admin', '0160', 'aisha@lakemontpeds.example')], containers: '2 consoles', notes: 'Use the back entrance.', lunch: ['12:00', '13:00'], channel: 'Google Maps' }),
  C('c9', 'Lakemont Unified School District', 'r1', 700, 330, '1200 Scholar Way', { label: 'Site 101 - District Office', type: 'government', contacts: [P('Paul Nakamura', 'Records clerk', '0177', 'pnakamura@lusd.example')], containers: '4 bins (64 gal)', notes: 'PO number required on every invoice. Service ticket signed by the site contact.', channel: 'Referral', freq: 'Every 4 weeks', po: 'PO 26-04471', billing: 'ap@lusd.example', mode: 'serviceNote', contract: 'LUSD 5-yr contract 2024-0193' }),
  C('c12', 'Summit Physical Therapy', 'r1', 330, 330, '18 Summit Ave', { contacts: [P('Lena Brooks', 'Owner', '0188', 'lena@summitpt.example')], containers: '1 console', type: 'creditCard', channel: 'Yelp', freq: 'Every 4 weeks' }),
  C('c15', 'Marlowe Architects', 'r1', 560, 400, '330 Foundry Ln, 2nd floor', { contacts: [P('Theo Marlowe', 'Principal', '0195', 'theo@marlowearch.example')], containers: '2 consoles', type: 'setup', lifecycle: 'scheduled', notes: 'First service — deliver 2 consoles.', channel: 'Website', freq: 'Every 4 weeks' }),
  C('c18', 'Greenway Realty', 'r1', 780, 230, '2460 Greenway Dr', { contacts: [P('Monica Reyes', 'Broker', '0203', 'monica@greenwayrealty.example')], containers: '1 console', open: '08:00', close: '09:00', notes: 'Only open 8–9 AM for pickups.', channel: 'Google Ads' }),
  C('c19', 'Kessler Chiropractic', 'r1', 460, 140, '7 Orchard Park', { contacts: [P('Dr. Alan Kessler', 'Owner', '0211', 'office@kesslerchiro.example')], containers: '1 console', type: 'creditCard', channel: 'Bing Ads', freq: 'Every 4 weeks' }),

  C('c2', 'Ridgeview Family Dental', 'r2', 540, 700, '1480 Ridgeview Dr', { contacts: [P('Carmen Ortiz', 'Office manager', '0122', 'carmen@ridgeviewdental.example')], containers: '2 consoles', type: 'creditCard', notes: 'Use the side door, ring bell.', channel: 'Google Maps', sig: 'never' }),
  C('c3', 'Calloway CPA Group', 'r2', 430, 640, '77 Bank St, Suite 210', { contacts: [P('Greg Calloway', 'Partner', '0131', 'greg@callowaycpa.example'), P('Nina Voss', 'Admin', '0132', 'nina@callowaycpa.example')], containers: '5 consoles', notes: 'Tax season: weekly Jan–Apr.', channel: 'Referral', freq: 'Weekly' }),
  C('c7', 'Sterling Title & Escrow', 'r2', 660, 760, '615 Harbor Rd', { contacts: [P('Joan Sterling', 'Owner', '0166', 'joan@sterlingtitle.example')], containers: '3 consoles', channel: 'Google Ads' }),
  C('c8', 'Pinecrest Insurance Agency', 'r2', 800, 820, '3105 Pinecrest Pkwy', { contacts: [P('Marcus Pine', 'Agent', '0171', 'marcus@pinecrestins.example')], containers: '1 console', channel: 'Yelp', freq: 'Every 4 weeks', sig: 'never' }),
  C('c10', 'Oakline Property Management', 'r2', 350, 800, '48 Oakline Ct', { contacts: [P('Tessa Wright', 'Operations', '0180', 'tessa@oaklinepm.example')], containers: '2 bins (64 gal)', channel: 'Website' }),
  C('c13', 'Delgado Tax Services', 'r2', 600, 860, '912 Mission St', { contacts: [P('Rosa Delgado', 'Owner', '0190', 'rosa@delgadotax.example')], containers: '2 consoles', type: 'creditCard', channel: 'Google Maps', freq: 'Every 4 weeks', closed: ['Fri'] }),
  C('c16', 'First Harbor Bank', 'r2', 740, 650, '1 Harbor Plaza', { label: 'Main branch', contacts: [P('Ian Cho', 'Facilities', '0199', 'ian.cho@firstharbor.example')], containers: '8 consoles', open: '09:00', close: '16:00', notes: 'Loading dock B. Call Ian on arrival.', channel: 'Referral', freq: 'Weekly', sig: 'always', call: 15, billing: 'payables@firstharbor.example' }),
  C('c20', 'Bayside Accounting', 'r2', 480, 880, '260 Bayside Ave', { contacts: [P('Hannah Lowe', 'Bookkeeper', '0215', 'hannah@baysideacct.example')], containers: '1 console', channel: 'Google Ads', freq: 'Every 4 weeks' }),

  C('c5', 'City of Lakemont', 'r3', 300, 480, '1 Civic Plaza', { label: 'Clerk’s office', type: 'government', contacts: [P('Dolores Meyer', 'City clerk', '0146', 'dmeyer@lakemont.example')], containers: '4 bins (96 gal)', close: '16:30', notes: 'Badge required — pick up at front desk.', channel: 'Referral', freq: 'Every 2 weeks', contract: 'City contract C-1182' }),
  C('c11', 'Bright Smile Orthodontics', 'r3', 180, 420, '705 Larkspur Ln', { contacts: [P('Kim Tran', 'Office manager', '0184', 'kim@brightsmileortho.example')], containers: '1 console', type: 'creditCard', channel: 'Yelp', freq: 'Every 4 weeks', call: 30 }),
  C('c14', 'Westfield Veterinary Clinic', 'r3', 120, 560, '1890 Westfield Rd', { contacts: [P('Dr. Priya Shah', 'Owner', '0193', 'office@westfieldvet.example')], containers: '2 consoles', channel: 'Google Maps' }),
  C('c17', 'County Records Annex', 'r3', 240, 600, '22 Archive Row', { type: 'government', contacts: [P('Walt Brenner', 'Supervisor', '0201', 'wbrenner@county.example')], containers: '10 bins (96 gal)', notes: 'Dock access 7–11 only.', close: '11:00', open: '07:00', channel: 'Referral', freq: 'Weekly', po: 'PO 7731-B', contract: 'County RFP 24-019', billing: 'accountspayable@county.example', mode: 'serviceNote' }),
  C('c27', 'Larkspur Senior Living', 'r3', 90, 440, '4400 Larkspur Ln', { contacts: [P('Beth Collins', 'Administrator', '0221', 'bcollins@larkspursl.example')], containers: '3 consoles', channel: 'Website' }),
  C('c28', 'Mason & Pike Engineering', 'r3', 330, 560, 'New office by the mall', { contacts: [P('Cal Mason', 'Partner', '0226', 'cal@masonpike.example')], containers: '2 consoles', notes: 'They moved — confirm the new suite number.', channel: 'Google Ads', unlocated: true }),
  C('c29', 'Tri-County Hospice', 'r3', 200, 500, '610 Lantern St', { contacts: [P('Ruth Adeyemi', 'Compliance', '0233', 'ruth@tricountyhospice.example')], containers: '2 consoles', channel: 'Referral' }),
  C('c30', 'Beacon Mortgage', 'r3', 150, 640, '3300 Beacon Hill Rd', { contacts: [P('Scott Feld', 'Branch manager', '0238', 'sfeld@beaconmtg.example')], containers: '2 consoles', type: 'creditCard', channel: 'Bing Ads', freq: 'Every 4 weeks' }),

  C('c21', 'Ellen Park', 'r4', 850, 480, '1714 Juniper Ct', { kind: 'household', label: 'Home', type: 'purge', freq: 'One time', contacts: [P('Ellen Park', '', '0241', 'ellen.park@mail.example')], containers: '12 bankers boxes', notes: 'Boxes are in the garage. Dog is friendly.', channel: 'Google Ads', lifecycle: 'scheduled' }),
  C('c22', 'Robert Tanaka', 'r4', 900, 560, '88 Quail Hollow', { kind: 'household', label: 'Home', type: 'purge', freq: 'One time', contacts: [P('Robert Tanaka', '', '0247', 'rtanaka@mail.example')], containers: '30 boxes (estate clean-out)', channel: 'Yelp', lifecycle: 'serviced' }),
  C('c23', 'Vista Medical Billing', 'r4', 620, 540, '1550 Vista Pkwy, Suite 12', { type: 'purge', freq: 'One time', contacts: [P('Angela Ruiz', 'Operations', '0252', 'angela@vistamedbilling.example')], containers: '40 boxes', lifecycle: 'quoted', channel: 'Google Ads', next: 1, cnotes: 'Quoted $380 for 40 boxes + monthly console service.' }),
  C('c24', 'Hartman & Co. Staffing', null, 700, 470, '2 Commerce Sq', { contacts: [P('Lyle Hartman', 'Owner', '0258', 'lyle@hartmanstaffing.example')], lifecycle: 'lead', channel: 'Website', next: 0, containers: '' }),
  C('c25', 'Juniper Wealth Advisors', null, 590, 250, '4100 Juniper Blvd', { contacts: [P('Sofia Marin', 'Office manager', '0263', 'sofia@juniperwealth.example')], lifecycle: 'contacted', channel: 'Google Maps', next: -2, containers: '', cnotes: 'Wants a quote for 3 consoles, every 4 weeks.' }),
  C('c26', 'Cedar Park Storage', null, 260, 760, '975 Cedar Park Rd', { contacts: [P('Vic Dunn', 'Manager', '0269', 'vic@cedarparkstorage.example')], lifecycle: 'lost', channel: 'Yelp', containers: '', cnotes: 'Lost — went with a drop-off service.' }),
];
/* Invoice header details (Account, Attn, Terms, Agreement) for the two government accounts billed by master invoice. */
Object.assign(data.customers.find(c => c.id === 'c9'), { account: 'LUSD', attn: 'Paul Nakamura', billAddress: ['Accounts Payable', '1200 Scholar Way', 'Lakemont'], terms: 'Net 45', agreement: '24-0193', rate64: 87.75 });
Object.assign(data.customers.find(c => c.id === 'c17'), { account: 'COUNTY REC', attn: 'Walt Brenner', billAddress: ['County Auditor', '22 Archive Row', 'Lakemont'], terms: 'Net 30', agreement: 'RFP 24-019' });
data.orgs[0].remit = ['DISCOUNT SHRED', '400 Industrial Way', 'Lakemont']; data.orgs[0].phone = '(512) 555-0300';
data.customers.forEach(c => { if (c.id === 'c28') c.locations[0].located = false; c.locations.forEach(l => { l.items = WD.parseItems(l.containers); if (c.rate64) l.items.forEach(i => { if (i.id === 'bin64') i.rate = c.rate64; }); }); });

/* ---------- Jobs ---------- */
let jobSeq = 0; data.jobs = [];
const today = D.today(), nowM = 10 * 60 + 24;
const actor = id => (data.users.find(u => u.id === id) || {}).name || 'System';
/* Jobs have no scheduled time: each route's day is an ordered list, and seq (1, 2, 3…) is the job's place in it.
   allDay marks a note on the day (not a stop). dur is only the typical minutes on site, used by AutoRoute. */
const nextSeq = (routeId, day) => data.jobs.reduce((m, j) => j.routeId === routeId && j.day === day && !j.allDay ? Math.max(m, j.seq || 0) : m, 0) + 1;
function makeJob(o) {
  const c = o.customerId && data.customers.find(x => x.id === o.customerId), loc = c && c.locations[0];
  const j = Object.assign({ id: 'j' + (++jobSeq), routeId: 'r1', day: today, allDay: false, seq: null, dur: 30, title: c ? c.name : 'Job', customerId: null, locationId: loc ? loc.id : null,
    address: loc ? loc.address : '', located: loc ? loc.located !== false : false, x: loc ? loc.x : null, y: loc ? loc.y : null, notes: loc ? loc.notes : '', type: c ? c.type : 'regular', custType: c ? c.custType : 'business', cityZip: '', containers: loc ? loc.containers : '',
    bizOpen: loc ? loc.bizOpen : '', bizClose: loc ? loc.bizClose : '', custFrom: '', custUntil: '', custStrict: false, windowBy: 'customer', needsWindow: false, purge: null, lunchFrom: loc ? loc.lunchFrom : '', lunchUntil: loc ? loc.lunchUntil : '', closedDays: loc ? loc.closedDays.slice() : [], callAhead: loc ? loc.callAhead : 0, flags: {}, billing: null, items: loc ? WD.copyItems(loc.items) : [], po: c ? c.po : '', contract: c ? c.contract : '', status: 'scheduled', recurring: null, version: 1, pending: false, attachments: [], events: [], invoice: null, arrivedAt: null, departedAt: null }, o);
  if (j.purge && j.type === 'purge') j.dur = WD.purgeEstimate(j.purge).minutes || j.dur;
  delete j.start; if (j.seq == null) j.seq = j.allDay ? 0 : nextSeq(j.routeId, j.day);
  data.jobs.push(j); return j;
}
WD.makeJob = makeJob;
/** Renumber a route's day 1…n in its current order (after a move, insert or delete). */
WD.renumber = (routeId, day) => { q.stopList(routeId, day).forEach((j, i) => { j.seq = i + 1; }); };
/** Move a job to position index (0-based) of a route's day, renumbering both the old and new lists. */
WD.placeJob = (job, routeId, day, index) => {
  const from = { routeId: job.routeId, day: job.day }, list = q.stopList(routeId, day).filter(j => j !== job);
  job.routeId = routeId; job.day = day; list.splice(Math.max(0, Math.min(index, list.length)), 0, job); list.forEach((j, i) => { j.seq = i + 1; });
  if (from.routeId !== routeId || from.day !== day) WD.renumber(from.routeId, from.day);
};
function generate() {
  const pools = {}; data.routes.forEach(r => pools[r.id] = data.customers.filter(c => c.route === r.id && c.lifecycle !== 'lead' && c.lifecycle !== 'lost' && c.lifecycle !== 'contacted' && c.kind !== 'household' && c.id !== 'c23'));
  for (let n = -10; n <= 14; n++) {
    const day = D.add(today, n), dow = D.parse(day).getDay(); if (dow === 0) continue;
    ['r1', 'r2', 'r3'].forEach((rid, ri) => {
      const route = data.routes.find(r => r.id === rid), pool = pools[rid], picks = pool.filter((c, i) => (i + n + 400) % 4 !== 3 && (dow !== 6 || i % 3 === 0));
      let t = 7 * 60 + 45 + ri * 15;
      picks.forEach((c, i) => {
        const loc = c.locations[0], open = WD.fmt.fromHHMM(loc.bizOpen) || 0; if (t < open) t = open;
        const dur = c.type === 'government' ? 45 : c.type === 'setup' ? 45 : pick([20, 30, 30, 30, 40]);
        const j = makeJob({ routeId: rid, day, dur, customerId: c.id, recurring: c.type === 'setup' && n <= 0 ? null : { rule: c.freq + ' on ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow], seriesId: 's-' + c.id } });
        if (c.type === 'setup') { j.title = c.name + ' — setup'; if (n !== 0) { data.jobs.pop(); return; } }
        const end = t + dur;
        if (n < 0 || (n === 0 && end <= nowM - 4)) {
          const late = Math.round((rnd() - 0.4) * 14); j.status = (n < 0 && rnd() < 0.05) ? 'skipped' : 'completed'; j.arrivedAt = t + late; j.departedAt = t + late + dur + Math.round((rnd() - 0.5) * 10);
          const when = k => +new Date(D.parse(day).setHours(0, k, 0, 0));
          if (j.status === 'completed') { j.events.push({ at: when(j.arrivedAt), actor: actor(route.driverId), text: 'Arrived (geofence)' }, { at: when(j.departedAt), actor: actor(route.driverId), text: 'Completed' });
            const amt = pick([65, 85, 110, 140, 220]);
            if (c.billingMode === 'serviceNote') j.billing = { kind: 'serviceNote', number: 'SN-' + (1000 + jobSeq), amount: c.type === 'government' ? 180 : amt, at: when(j.departedAt), by: actor(route.driverId), signer: (c.contacts[0] || {}).name || '' };
            else if (c.type === 'creditCard') j.invoice = { number: 'INV-' + (2400 + jobSeq), status: 'Paid', amount: 65, auto: true };
            else if (n < 0 ? rnd() < 0.9 : rnd() < 0.5) j.invoice = { number: 'INV-' + (2400 + jobSeq), status: rnd() < 0.6 ? 'Paid' : 'Sent', amount: amt };
            else if (n < 0) j.billing = { kind: 'paidNoInvoice', method: pick(['Cash', 'Check']), amount: amt, at: when(j.departedAt), by: actor(route.driverId) }; }
          else j.events.push({ at: when(t + 5), actor: actor(route.driverId), text: 'Skipped — office closed' });
        } else if (n === 0 && t <= nowM) { j.status = 'arrived'; j.arrivedAt = t + 3; j.events.push({ at: +new Date(D.parse(day).setHours(0, t + 3, 0, 0)), actor: actor(route.driverId), text: 'Arrived (geofence)' }); }
        else if (n === 0 && !data.jobs.some(x => x.routeId === rid && x.day === day && (x.status === 'arrived' || x.status === 'enroute') && x !== j) && !data.jobs.some(x => x.routeId === rid && x.day === day && x.status === 'scheduled' && x !== j)) { j.status = 'enroute'; j.events.push({ at: +new Date(D.parse(day).setHours(10, 12, 0, 0)), actor: actor(route.driverId), text: 'En route' }); }
        j.events.unshift({ at: +new Date(D.parse(day).setHours(8, 0, 0, 0)) - 6 * 864e5, actor: 'Priya Raman', text: 'Scheduled' });
        t = end + pick([15, 15, 20, 25, 30]); t = Math.round(t / 5) * 5;
      });
    });
    /* Purge truck: one-time jobs */
    if (n === 0) { makeJob({ routeId: 'r4', day, dur: 60, customerId: 'c22', status: 'completed', arrivedAt: 9 * 60 + 4, departedAt: 10 * 60 + 2, invoice: { number: 'INV-2391', status: 'Sent', amount: 320 }, attachments: [{ id: 'a1', name: 'Before – garage.jpg', kind: 'photo', size: '2.1 MB' }, { id: 'a2', name: 'Certificate of destruction.pdf', kind: 'doc', size: '84 KB' }] });
      makeJob({ routeId: 'r4', day, dur: 13, customerId: 'c21', custFrom: '13:00', custUntil: '17:00', custStrict: false, callAhead: 30, purge: { std: 9, legal: 3 }, items: [{ id: 'box', qty: 14, rate: 8 }] });
      makeJob({ routeId: 'r4', day, allDay: true, title: 'Truck 9 — oil change after route', type: 'regular', notes: 'Drop at Lakemont Fleet Service by 4:30.' });
      makeJob({ routeId: 'r4', day, dur: 30, title: 'Meet the truck — Dr. Alvarez', type: 'meet', custType: 'residential', phone: '+15125550290', contactName: 'Dr. Alvarez', notes: 'Customer brings 3 boxes to the shop. Call when 10 minutes out: (512) 555-0290.', items: [{ id: 'box', qty: 3, rate: 8 }] }); }
    else if (n > 0 && n % 2 === 1) { const pd = { std: 40, stairs: 'down', haul: false }, e = WD.purgeEstimate(pd); makeJob({ routeId: 'r4', day, dur: e.minutes, customerId: 'c23', title: 'Vista Medical Billing — purge', purge: pd, needsWindow: true, items: [{ id: 'box', qty: e.billable, rate: 8 }, ...WD.purgeExtras(pd, e.billable)], notes: 'Boxes are in the upstairs storage room. Said “about 40” — confirm the count on site.' }); }
    else if (n < 0 && n % 3 === 0) { const j = makeJob({ routeId: 'r4', day, dur: 60, customerId: 'c22', status: 'completed', arrivedAt: 9 * 60 + 33, departedAt: 10 * 60 + 40 }); j.title = 'Tanaka — estate boxes'; }
    if (n === 1) { makeJob({ routeId: 'r2', day, allDay: true, title: 'Tony out — Sam covers South', notes: 'Route assignment override for the day.' });
      makeJob({ routeId: 'r4', day, dur: 10, title: 'Raj Patel — home purge', type: 'purge', custType: 'residential', phone: '+15125550281', contactName: 'Raj Patel', address: '5 Heron Ct, Lakemont', located: true, x: 880, y: 400, items: [{ id: 'box', qty: 6, rate: 8 }], purge: { std: 6 }, custFrom: '08:00', custUntil: '10:00', custStrict: true, windowBy: 'us', notes: 'Must be done before he leaves for work at 10.' }); }
    if (n === 2) makeJob({ routeId: 'r4', day, dur: 20, title: 'Dana Kim — garage purge', type: 'purge', custType: 'residential', phone: '+15125550274', contactName: 'Dana Kim', items: [{ id: 'box', qty: 15, rate: 8 }], purge: { std: 15 }, notes: 'Booked by phone. She will call back with the address.', events: [{ at: +new Date(D.parse(today).setHours(9, 41, 0, 0)), actor: 'Colleen Abbott', text: 'Created · saved without an address' }] });
    if (n === 2) { const j = data.jobs.find(x => x.day === day && x.routeId === 'r3' && !x.allDay); if (j) { j.status = 'canceled'; j.events.push({ at: +new Date(D.parse(today).setHours(9, 2, 0, 0)), actor: 'Colleen Abbott', text: 'Customer canceled — called the office' }); } }
    if (n === 3) { const j = data.jobs.filter(x => x.day === day && x.routeId === 'r2' && !x.allDay)[1]; if (j) { j.status = 'rescheduled'; j.rescheduledTo = D.add(day, 2); j.events.push({ at: +new Date(D.parse(today).setHours(8, 40, 0, 0)), actor: 'Colleen Abbott', text: 'Customer rescheduled to ' + WD.fmt.day(D.add(day, 2)) }); } }
  }
  /* Heads-up details shown after job titles: one-off flags on today's and upcoming visits. */
  const flag = (cid, f, days) => data.jobs.filter(j => j.customerId === cid && days.includes(D.diff(j.day, today))).forEach(j => Object.assign(j.flags, f));
  data.jobs.filter(j => j.customerId === 'c1' && [0, 1, 2].includes(D.diff(j.day, today))).forEach(j => j.events.push({ at: +new Date(D.parse(today).setHours(8, 12, 0, 0)), actor: 'Colleen Abbott', text: 'Edited', changes: [{ label: 'Heads-up', from: 'None', to: 'Bring an extra container' }, { label: 'Notes', from: 'Check in at reception.', to: 'Check in at reception. Service elevator is around back.' }] }));
  flag('c1', { extraBin: true }, [0, 1, 2]); flag('c3', { extraShred: true }, [0, 1]); flag('c12', { early: true }, [0, 1, 2, 3]); flag('c7', { extraShred: true }, [1, 2]);
  data.jobs.filter(j => ['c14', 'c27', 'c10'].includes(j.customerId) && D.diff(j.day, today) > 0 && D.diff(j.day, today) <= 3).forEach(j => { j.needsWindow = true; });
  const first = data.jobs.find(j => j.day === today && j.routeId === 'r1' && j.status === 'completed'); if (first) first.attachments.push({ id: 'a3', name: 'Console key tag.jpg', kind: 'photo', size: '1.4 MB' });
}
generate();

/* Customer rollups shown on CRM screens. */
data.customers.forEach(c => {
  const jobs = data.jobs.filter(j => j.customerId === c.id), done = jobs.filter(j => j.status === 'completed'), isCust = ['customer', 'serviced'].includes(c.lifecycle);
  const base = isCust ? 6 + Math.floor(rnd() * 40) : 0, per = { government: 180, creditCard: 65, purge: 320 }[c.type] || pick([65, 85, 110]);
  const invoiced = (base + done.length) * per, balance = isCust && rnd() < 0.3 ? per * (1 + Math.floor(rnd() * 2)) : 0;
  c.stats = { jobs: base + done.length, invoiced, paid: invoiced - balance, balance, lastService: done.length ? done[done.length - 1].day : null, firstInvoice: isCust ? D.add(today, -(60 + Math.floor(rnd() * 900))) : null, rate: per };
  c.successful = !!c.stats.firstInvoice; if (c.nextAction != null) c.nextAction = D.add(today, c.nextAction);
});

/* ---------- Pricing history, contract anniversaries, service agreements, time off (mock) ---------- */
(function () {
  const md = k => k.slice(5), nextMonth = (() => { const d = D.parse(today); d.setDate(1); d.setMonth(d.getMonth() + 1); return D.key(d); })();
  /* Three accounts started service in next month's calendar month, so the anniversary report has something to show. */
  [['c1', 2, 4], ['c4', 1, 12], ['c16', 3, 20]].forEach(([id, years, dom]) => { const c = data.customers.find(x => x.id === id), d = D.parse(nextMonth); d.setFullYear(d.getFullYear() - years); d.setDate(dom); c.stats.firstInvoice = D.key(d); c.successful = true; });
  /* Change history: every price, container-count and frequency change, with who made it and the service date it took effect. */
  data.customers.forEach(c => { c.changes = []; const since = c.stats.firstInvoice; if (!since) return;
    const it = c.locations[0].items[0]; if (!it) return; const pb = data.priceBook.find(x => x.id === it.id), yr = Math.floor(D.diff(today, since) / 365);
    c.changes.push({ at: +D.parse(since), by: 'Dana Whitfield', kind: 'start', text: 'Service started · ' + WD.itemsLabel(c.locations[0].items) + ' · ' + c.freq, effective: since });
    if (yr >= 1) { const day = D.add(since, 365); c.changes.push({ at: +D.parse(D.add(day, -31)), by: 'Dana Whitfield', kind: 'price', item: pb.name, from: Math.round(it.rate * 0.92 * 100) / 100, to: it.rate, effective: day, letter: true }); }
    if (c.id === 'c1') c.changes.push({ at: +D.parse(D.add(today, -140)), by: 'Colleen Abbott', kind: 'qty', item: pb.name, from: 3, to: 4, effective: D.add(today, -133) }, { at: +D.parse(D.add(today, -210)), by: 'Colleen Abbott', kind: 'freq', from: 'Every 2 weeks', to: 'Weekly', effective: D.add(today, -203) });
    if (c.id === 'c16') c.changes.push({ at: +D.parse(D.add(today, -64)), by: 'Priya Raman', kind: 'qty', item: pb.name, from: 6, to: 8, effective: D.add(today, -60) });
  });
  /* Service agreements. status: draft → sent → viewed → signed. method: how it was signed ('link' or 'inperson'). */
  let n = 0; const ag = (customerId, status, o = {}) => { const c = data.customers.find(x => x.id === customerId), p = c.contacts[0] || {};
    data.agreements.push(Object.assign({ id: 'ag' + (++n), number: 'SA-' + (1040 + n), customerId, status, term: 12, start: status === 'signed' ? c.stats.firstInvoice || today : today, createdBy: 'Colleen Abbott', createdAt: +D.parse(D.add(today, -6)), sentVia: null, sentAt: null, viewedAt: null, signedAt: null, signer: '', sig: null, method: null, to: p.email || '' }, o)); };
  data.agreements = [];
  ag('c1', 'signed', { term: 36, createdAt: +D.parse(D.add(today, -400)), sentVia: 'Email', sentAt: +D.parse(D.add(today, -400)), viewedAt: +D.parse(D.add(today, -399)), signedAt: +D.parse(D.add(today, -398)), signer: 'Renee Harlow', method: 'link' });
  ag('c16', 'signed', { term: 24, createdAt: +D.parse(D.add(today, -300)), sentVia: 'Email', sentAt: +D.parse(D.add(today, -300)), signedAt: +D.parse(D.add(today, -296)), signer: 'Ian Cho', method: 'inperson' });
  ag('c3', 'viewed', { sentVia: 'Email', sentAt: +D.parse(D.add(today, -3)), viewedAt: +D.parse(D.add(today, -2)) });
  ag('c7', 'sent', { sentVia: 'Text', sentAt: +D.parse(D.add(today, -1)) });
  ag('c15', 'sent', { start: today, sentVia: 'Email', sentAt: +D.parse(D.add(today, -2)), createdAt: +D.parse(D.add(today, -2)) });
  ag('c25', 'draft', { start: D.add(today, 14), createdAt: +D.parse(D.add(today, -1)) });
  /* Time off: requested from the Shift tab, approved by HR or whoever manages the team; approved days show on the dispatch board. */
  let tomorrow = D.add(today, 1); if (D.parse(tomorrow).getDay() === 0) tomorrow = D.add(tomorrow, 1);
  data.timeOff = [
    { id: 'to1', userId: 'u5', from: tomorrow, to: tomorrow, fromTime: '', untilTime: '', reason: 'Family appointment', status: 'approved', decidedBy: 'Dana Whitfield', at: +D.parse(D.add(today, -5)) },
    { id: 'to2', userId: 'u6', from: D.add(today, 8), to: D.add(today, 9), fromTime: '', untilTime: '', reason: 'Out of town', status: 'pending', decidedBy: null, at: +D.parse(D.add(today, -1)) },
    { id: 'to3', userId: 'u4', from: D.add(today, 4), to: D.add(today, 4), fromTime: '13:00', untilTime: '17:00', reason: 'Dentist', status: 'pending', decidedBy: null, at: +D.parse(today) },
  ];
})();
/** The approved time off covering a person's day, if any. */
WD.offOn = (userId, day) => userId ? (data.timeOff || []).find(t => t.userId === userId && t.status === 'approved' && t.from <= day && day <= t.to) || null : null;
WD.timeOffLabel = t => (t.from === t.to ? WD.fmt.day(t.from) : WD.fmt.day(t.from, 'md') + ' – ' + WD.fmt.day(t.to, 'md')) + (t.fromTime ? ' · ' + WD.fmt.time(WD.fmt.fromHHMM(t.fromTime)) + '–' + WD.fmt.time(WD.fmt.fromHHMM(t.untilTime || '17:00')) : ' · all day');

/* ---------- Time clock: this week's punches and today's location stays (mock) ---------- */
/* Hours per day this week (Mon → today) for each employee who clocks in. Drivers run long days, so daily and weekly overtime both show up. */
data.punches = []; data.stays = [];
(function () {
  /* This week's hours are fixed (so daily and weekly overtime show up); the eight weeks before vary a little around them, for pay-period and monthly reports. */
  const dow = D.parse(today).getDay(), monday = D.add(today, -((dow + 6) % 7)), hours = { u4: [10.6, 9.4, 11.2, 10.1, 9.8, 4], u5: [9.1, 10.4, 8.6, 9.9, 10.7, 0], u6: [8.4, 8.9, 9.2, 8.7, 9.5, 5.2], u3: [8, 8.2, 7.9, 8.1, 8.4, 0], u8: [6.5, 7, 0, 7.5, 8, 4.5], u2: [8.5, 9, 8.7, 9.1, 8.8, 0] };
  let n = 0;
  for (let w = 8; w >= 0; w--) { const mon = D.add(monday, -7 * w);
    Object.entries(hours).forEach(([uid, hs]) => hs.forEach((base, i) => { const day = D.add(mon, i); if (day > today) return;
      const hrs = w === 0 ? base : base ? Math.max(5, Math.round((base + (rnd() - 0.5) * 1.8) * 10) / 10) : (i === 5 && rnd() < 0.25 ? 4.5 : 0); if (!hrs) return;
      const start = (uid === 'u3' || uid === 'u2' ? 8 * 60 : 7 * 60 + 15) + (i % 3) * 5, live = day === today;
      data.punches.push({ id: 'pu' + (++n), userId: uid, day, start, end: live ? null : Math.round(start + hrs * 60 + 30), breakMin: live ? 0 : 30, edits: [] }); })); }
  /* Sam forgot to clock out yesterday, and Luis forgot to clock in one day last week (no punch at all) — HR fixes both. */
  const y = data.punches.find(p => p.userId === 'u6' && p.day === D.add(today, -1)); if (y) y.end = null;
  const miss = data.punches.findIndex(p => p.userId === 'u8' && p.day === D.add(monday, -6)); if (miss >= 0) data.punches.splice(miss, 1);
  /* Pay periods are two weeks, Monday through the second Sunday; the current one started last Monday. */
  data.timeRules.payDays = 14; data.timeRules.payAnchor = D.add(monday, -7);
})();
/* Places each clocked-in employee stayed today, from their phone's location. Short stops are kept too, so the "log stays over N minutes" setting can filter them. */
const stay = (userId, label, x, y, from, to, kind) => data.stays.push({ userId, label, x, y, from, to, kind: kind || 'stop' });
stay('u3', 'Shop office', 505, 520, 8 * 60, 9 * 60 + 2, 'base'); stay('u3', 'First Harbor Bank (deposit)', 740, 650, 9 * 60 + 14, 9 * 60 + 26); stay('u3', 'Red light, Mercer & 5th', 610, 560, 9 * 60 + 29, 9 * 60 + 31); stay('u3', 'Shop office', 505, 520, 9 * 60 + 40, null, 'base');
stay('u8', 'Shop', 505, 520, 7 * 60 + 15, 8 * 60 + 30, 'base'); stay('u8', 'Fuel — Harbor Gas', 640, 610, 8 * 60 + 41, 8 * 60 + 48); stay('u8', 'West storage lot', 150, 520, 9 * 60 + 5, 9 * 60 + 52); stay('u8', 'Coffee drive-thru', 300, 520, 10 * 60, 10 * 60 + 3); stay('u8', 'Shop', 505, 520, 10 * 60 + 14, null, 'base');
stay('u2', 'Shop office', 505, 520, 8 * 60, null, 'base');

/* ---------- Queries ---------- */
const norm = s => String(s || '').toLowerCase(), digits = s => String(s || '').replace(/\D/g, '');
const q = WD.q = {
  routes: () => data.routes.slice().sort((a, b) => a.order - b.order), visibleRoutes: () => q.routes().filter(r => r.visible),
  route: id => data.routes.find(r => r.id === id), routeName: r => (r = typeof r === 'string' ? q.route(r) : r) ? (r.nickname || r.name) : 'Unassigned',
  routeColor: r => (r = typeof r === 'string' ? q.route(r) : r) ? (r.colorOverride || r.color) : '#8E8E93',
  job: id => data.jobs.find(j => j.id === id), customer: id => data.customers.find(c => c.id === id), user: id => data.users.find(u => u.id === id), vehicle: id => data.vehicles.find(v => v.id === id),
  jobType: id => WD.jobTypes.find(t => t.id === id) || WD.jobTypes[0],
  /** Board order: day notes first, then the job list in order (seq) with called-off visits last, then stable id. */
  jobsFor: (routeId, day) => data.jobs.filter(j => j.routeId === routeId && j.day === day).sort(q.order),
  order: (a, b) => (b.allDay - a.allDay) || (WD.sinks(a) - WD.sinks(b)) || (a.seq - b.seq) || a.id.localeCompare(b.id, undefined, { numeric: true }),
  /** The ordered job list for a route's day (notes excluded). */
  stopList: (routeId, day) => q.jobsFor(routeId, day).filter(j => !j.allDay),
  /** A job's place in its day's list: { n, of }. */
  position: job => { const list = q.stopList(job.routeId, job.day).filter(j => !WD.calledOff(j) || j === job); return { n: list.indexOf(job) + 1, of: list.length - (WD.calledOff(job) ? 1 : 0) }; },
  jobsOn: day => data.jobs.filter(j => j.day === day),
  /** Located stops for the map, numbered from 1 per route (addressless jobs and all-day notes are excluded). */
  stops: (routeId, day) => q.jobsFor(routeId, day).filter(j => j.located && j.x != null && !WD.calledOff(j)).map((j, i) => ({ job: j, number: i + 1 })),
  jobsForCustomer: id => data.jobs.filter(j => j.customerId === id).sort((a, b) => a.day.localeCompare(b.day) || q.order(a, b)),
  driverFor: routeId => { const r = q.route(routeId); return r && r.driverId ? q.user(r.driverId) : null; },
  /** One search box: customer name, contact name, phone digits, email or address. Returns [{customer, match}] best first. */
  searchCustomers(text, limit = 8) {
    const s = norm(text).trim(), d = digits(text); if (s.length < 2) return [];
    const out = [];
    data.customers.forEach(c => {
      let score = 0, match = '';
      const n = norm(c.name); if (n.startsWith(s)) { score = 100; } else if (n.includes(s)) { score = 80; }
      c.contacts.forEach(p => { if (norm(p.name).includes(s) && score < 70) { score = 70; match = p.name + (p.role ? ' · ' + p.role : ''); } if (d.length >= 3 && digits(p.phone).includes(d) && score < 75) { score = 75; match = WD.fmt.phone(p.phone); } if (s.includes('@') || s.length >= 4) { if (norm(p.email).includes(s) && score < 60) { score = 60; match = p.email; } } });
      c.locations.forEach(l => { if (norm(l.address).includes(s) && score < 65) { score = 65; match = l.address; } });
      if (score) out.push({ customer: c, match: match || c.locations[0].address, score });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  },
  place: id => data.places.find(p => p.id === id) || data.depot,
  /** Where a vehicle starts and ends a given day (per-day override, else the vehicle's defaults). */
  vehicleEnds(vehicleId, day) { const v = q.vehicle(vehicleId), o = (v && data.vehicleDays[v.id + '|' + day]) || {}; return { start: q.place(o.startId || (v && v.startId)), end: q.place(o.endId || (v && v.endId)) }; },
  /** Start and end of a route's day: the truck on shift for it today, else the route's default vehicle. */
  routeEnds(routeId, day) { const sh = WD.state.shift, r = q.route(routeId), vid = sh && sh.routeId === routeId && day === D.today() ? sh.vehicleId : r && r.vehicleId; return q.vehicleEnds(vid, day); },
  /** Recorded on-site minutes for a customer's past visits: { median, mean, n, max }. The median ignores the odd visit that ran long. */
  visitStats(job) {
    let h = 7; for (const ch of String(job.customerId || job.title)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const base = job.dur || 30, n = 5 + h % 19, xs = [];
    for (let i = 0; i < n; i++) { h = (h * 1103515245 + 12345) >>> 0; const r = (h % 1000) / 1000; xs.push(Math.round(base * (0.8 + r * 0.4) + (i % 7 === 3 ? base * (1.5 + r * 2) : 0))); }
    const sorted = xs.slice().sort((a, b) => a - b), mid = Math.floor(n / 2);
    return { median: n % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2), mean: Math.round(xs.reduce((a, b) => a + b, 0) / n), n, max: sorted[n - 1] };
  },
  searchJobs(text, routeIds) {
    const s = norm(text).trim(); if (s.length < 2) return [];
    return data.jobs.filter(j => (!routeIds || routeIds.includes(j.routeId)) && [j.title, j.address, j.notes, q.routeName(j.routeId)].some(v => norm(v).includes(s))).sort((a, b) => Math.abs(D.diff(a.day, today)) - Math.abs(D.diff(b.day, today)) || q.order(a, b));
  },
};
})();
