/* RouteClerk prototype — Customers: quick lookup, customer record and timeline, leads pipeline, follow-ups,
   billing mirror (Invoice Ninja), merge suggestions and the incoming-call card. Registers WD.screens.customers. */
(function () {
'use strict';
const WD = window.WD, { h, ui, q, fmt } = WD, D = WD.date, data = WD.data, icon = WD.icon;
const today = D.today();
let seed = 4242; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

WD.addIcons({
  'line.3.horizontal.decrease.circle': '<circle cx="12" cy="12" r="9.5"/><path d="M7.5 9h9M9.5 12.5h5M11 16h2"/>',
  'arrow.up.circle.fill': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M12 16.5v-9M8 11l4-4 4 4" stroke="#fff"/>',
  'arrow.triangle.merge': '<path d="M6 3v5a6 6 0 0 0 6 6 6 6 0 0 1 6 6v1M18 3v5a6 6 0 0 1-3 5.2M3 6l3-3 3 3M15 6l3-3 3 3"/>',
});

/* ================= Reference data ================= */
const PIPE = ['lead', 'contacted', 'quoted', 'scheduled', 'lost'];
const LC = { lead: ['New lead', 'var(--blue)'], contacted: ['Contacted', 'var(--teal)'], quoted: ['Quoted', 'var(--orange)'], scheduled: ['Scheduled', 'var(--indigo)'], serviced: ['Serviced', 'var(--purple)'], customer: ['Customer', 'var(--green)'], lost: ['Lost', 'var(--red)'] };
const CHANNELS = ['Google Ads', 'Google Maps', 'Yelp', 'Bing Ads', 'Apple Maps', 'Website', 'Referral', 'Repeat', 'Other'];
const LINES = { 'Google Ads': '0310', 'Google Maps': '0311', Yelp: '0312', 'Bing Ads': '0313', 'Apple Maps': '0314', Website: '0315' }, MAIN = '+15125550300';
const lineFor = ch => LINES[ch] ? { number: '+1512555' + LINES[ch], channel: ch } : { number: MAIN, channel: 'Main' };
const CAMPAIGN = { 'Google Ads': ['Shredding — Lakemont (Search)', 'Document destruction — Brand', 'Residential purge — Search'], 'Bing Ads': ['Shred services — Bing Search'], 'Google Maps': ['Business Profile'], Yelp: ['Yelp listing'], 'Apple Maps': ['Apple Business Connect'], Website: ['Organic search', 'Direct'], Referral: ['Customer referral'], Repeat: ['Returning customer'], Other: ['How did you hear about us?'] };
const UTM = { 'Google Ads': ['google', 'cpc'], 'Bing Ads': ['bing', 'cpc'], 'Google Maps': ['google', 'gbp'], Yelp: ['yelp', 'listing'], 'Apple Maps': ['apple', 'maps'], Website: ['google', 'organic'] };
const WEB = ['Website', 'Google Ads', 'Bing Ads'], LANDING = ['/', '/mobile-shredding', '/purge-shredding', '/residential-shredding', '/pricing'];
const FREQS = ['Weekly', 'Every 2 weeks', 'Every 4 weeks', 'Monthly', 'Quarterly', 'One time', 'On call'];
const LOST = ['Price', 'Went with a competitor', 'Went with a drop-off service', 'No response', 'Not a fit'];
const PRICE_BOOK = data.priceBook;
const TYPES = { call: ['phone.fill', 'var(--green)'], voicemail: ['voicemail', 'var(--purple)'], text: ['message', 'var(--teal)'], email: ['envelope', 'var(--blue)'], form: ['doc.text', 'var(--orange)'],
  sheet: ['list.bullet', 'var(--mint)'], note: ['note', 'var(--yellow)'], job: ['truck', 'var(--indigo)'], invoice: ['doc.text', 'var(--brown)'], payment: ['dollarsign', 'var(--pink)'] };
const FILTERS = [['all', 'All', () => true], ['calls', 'Calls', i => i.type === 'call' || i.type === 'voicemail'], ['texts', 'Texts', i => i.type === 'text'], ['email', 'Email', i => i.type === 'email'],
  ['jobs', 'Jobs', i => i.type === 'job'], ['billing', 'Billing', i => i.type === 'invoice' || i.type === 'payment'], ['notes', 'Notes', i => i.type === 'note']];

/* ================= Helpers ================= */
const me = () => (WD.state.me && WD.state.me.name) || 'You';
const staff = id => (q.user(id) || {}).name || 'Office';
const first = n => String(n || '').replace(/^Dr\.\s*/, '').split(' ')[0];
const e164 = s => fmt.phoneValid(s) ? '+1' + fmt.phoneDigits(s) : '';
const blur = () => { const a = document.activeElement; if (a && a.blur) a.blur(); };
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const longDate = k => fmt.day(k, 'md') + ', ' + k.slice(0, 4);
const whenFull = t => { const d = new Date(t); return fmt.day(D.key(d), 'rel') + ', ' + fmt.clock(d); };
const stamp = (day, mins) => { const d = D.parse(day); d.setHours(0, mins, 0, 0); return Math.min(+d, +WD.now() - 60000); };
/** A timestamp `daysAgo` days back at `mins` past midnight, never later than a few minutes ago. */
const at = (daysAgo, mins) => { const d = D.parse(D.add(today, -daysAgo)); d.setHours(0, mins, 0, 0); return Math.min(+d, +WD.now() - (6 + ri(0, 50)) * 60000); };
const lcBadge = c => ui.badge(LC[c.lifecycle][0], LC[c.lifecycle][1]);
const avatar = (c, size = 36) => ui.avatar(c.name, { size, icon: c.kind === 'household' ? 'house' : null });
const check = (page, ok) => { const b = page.navbar.querySelector('.nav-trail .nav-btn'); if (b) b.disabled = !ok; };
const isUpcoming = j => j.day > today || (j.day === today && j.status !== 'completed' && j.status !== 'skipped');
const openJob = id => WD.screens.jobs && WD.screens.jobs.openDetails ? WD.screens.jobs.openDetails(id) : ui.toast('Job details aren’t in this build', 'info.circle');
const newJob = cid => WD.screens.jobs && WD.screens.jobs.openEditor ? WD.screens.jobs.openEditor({ customerId: cid }) : ui.toast('The job editor isn’t in this build', 'info.circle');
const owners = () => data.users.filter(u => u.role !== 'driver' && u.status === 'active');
const invoicesFor = cid => data.invoices.filter(i => i.customerId === cid).sort((a, b) => b.day.localeCompare(a.day));
const openTasks = cid => data.tasks.filter(t => !t.done && (!cid || t.customerId === cid)).sort((a, b) => a.due.localeCompare(b.due));

/* ================= Mock CRM data (deterministic) ================= */
const P = (name, role, phone, email) => ({ name, role, phone: '+1512555' + phone, email });
function mk(o) {
  const c = { id: o.id, name: o.name, kind: o.kind || 'company', route: null, lifecycle: o.lifecycle || 'lead', channel: o.channel || 'Website', type: o.type || 'regular', freq: o.freq || 'Every 4 weeks', contacts: o.contacts,
    locations: [{ id: o.id + 'l1', label: o.kind === 'household' ? 'Home' : 'Main office', address: o.address + ', Lakemont', x: o.x || 500, y: o.y || 500, containers: o.containers || '', bizOpen: '08:00', bizClose: '17:00', notes: '' }],
    owner: o.owner || 'u3', nextAction: o.next == null ? null : D.add(today, o.next), notes: o.cnotes || '', tags: o.tags || [], lostReason: o.lostReason || null, billingEmail: '', po: '', contract: '', signature: 'optional', billingMode: 'invoice', documents: [], poSchedule: [],
    stats: { jobs: 0, invoiced: 0, paid: 0, balance: 0, lastService: null, firstInvoice: null, rate: o.rate || 85 }, successful: false };
  data.customers.push(c); return c;
}
mk({ id: 'c31', name: 'Harlow and Finch', channel: 'Google Ads', contacts: [P('Front desk', '', '0143', '')], address: '210 Mercer St', x: 520, y: 300, cnotes: 'Created from an incoming call.' });
mk({ id: 'c32', name: 'Ridgeview Dental', channel: 'Google Maps', contacts: [P('Carmen O.', '', '0129', 'carmen.o@mail.example')], address: '1480 Ridgeview Dr', x: 540, y: 700 });
mk({ id: 'c33', name: 'Brookside Dental Lab', channel: 'Google Ads', next: 0, contacts: [P('Nora Fitch', 'Lab manager', '0274', 'nora@brooksidelab.example')], address: '62 Brookside Rd', x: 610, y: 120, containers: '2 consoles' });
mk({ id: 'c34', name: 'Linda Morgan', kind: 'household', lifecycle: 'quoted', channel: 'Yelp', type: 'purge', freq: 'One time', next: 3, owner: 'u2', rate: 190, contacts: [P('Linda Morgan', '', '0279', 'lmorgan@mail.example')], address: '219 Alder St', x: 380, y: 610, containers: '18 boxes', cnotes: 'Quoted $190 for 18 boxes, garage pickup.' });
mk({ id: 'c35', name: 'Alder Street Clinic', lifecycle: 'contacted', channel: 'Bing Ads', next: 0, owner: 'u2', contacts: [P('Dr. Wes Grant', 'Medical director', '0283', 'wgrant@alderclinic.example'), P('Maya Ellis', 'Office manager', '0284', 'maya@alderclinic.example')], address: '840 Alder St', x: 400, y: 590, containers: '3 consoles' });
mk({ id: 'c36', name: 'Raj Patel', kind: 'household', channel: 'Referral', type: 'purge', freq: 'One time', contacts: [P('Raj Patel', '', '0288', 'raj.patel@mail.example')], address: '5 Heron Ct', x: 880, y: 400, containers: '6 boxes' });
mk({ id: 'c37', name: 'Foster Insurance Group', lifecycle: 'lost', channel: 'Google Ads', lostReason: 'Price', contacts: [P('Gail Foster', 'Agency owner', '0292', 'gail@fosterins.example')], address: '77 Elm Plaza', x: 700, y: 600, cnotes: 'Chose a cheaper drop-off option.' });
const c26 = q.customer('c26'); if (c26) c26.lostReason = 'Went with a drop-off service';

data.interactions = []; data.tasks = []; data.invoices = []; data.payments = []; data.touches = [];
let iSeq = 0, tSeq = 0, invSeq = 0, paySeq = 0;
const addI = o => { const i = { id: 'i' + (++iSeq), ...o }; data.interactions.push(i); return i; };
const addTask = (cid, title, due, o = {}) => { const t = { id: 't' + (++tSeq), customerId: cid, title, due: typeof due === 'number' ? D.add(today, due) : due, done: false, doneAt: null, owner: o.owner || (q.customer(cid) || {}).owner || 'u3', lead: !!o.lead };
  if (o.done) { t.done = true; t.doneAt = at(o.done, 15 * 60); } data.tasks.push(t); return t; };

const TPL = {
  custIn: [
    { s: 'Asked to move next week’s pickup to Thursday because the office is closed Wednesday. Moved; the reminder text goes out the day before.', t: [['c', 'Hi, this is {first} at {co}. We’re closed next Wednesday. Could you come Thursday instead?'], ['s', 'Sure, I can move you to Thursday. Is the morning still best?'], ['c', 'Yes, before noon if possible.'], ['s', 'Done. You’ll get a text the day before.']] },
    { s: 'Needs the certificate of destruction from the last service for an audit. Resent it by email during the call.', t: [['c', 'Our auditor wants the certificate from your last visit. Can you send it again?'], ['s', 'Of course. Sending it to {email} now.'], ['c', 'Got it, thank you.']] },
    { s: 'Wants a second console for the break room. Quoted $15 more per visit; customer will confirm by email.', t: [['c', 'We keep finding paper in the regular recycling. Can we add a console in the break room?'], ['s', 'Yes, that adds $15 per visit. I can bring it on the next service.'], ['c', 'Let me check with {partner} and I’ll email you.']] },
    { s: 'Question about the trip charge on the latest invoice. Explained it; customer will pay this week.', t: [['c', 'I see a trip charge on the last invoice. What is that for?'], ['s', 'It covers the truck visit. The containers are billed separately.'], ['c', 'Okay, that makes sense. I’ll pay it this week.']] },
    { s: 'Year-end clean-out of about 20 boxes. Booked a one-time purge alongside the next regular visit.', t: [['c', 'We’re clearing old files before the new year, maybe 20 boxes.'], ['s', 'We can shred those on the same visit. Purges are $8 a box.'], ['c', 'Perfect, add it to the next one.']] },
  ],
  custOut: [
    { s: 'Called to confirm the new gate code for the rear entrance. Code saved to the location notes.', t: [['s', 'Hi {first}, it’s {staff} from Discount Shred. Did the gate code change?'], ['c', 'It did. It’s 4417 now.'], ['s', 'Thanks, I’ll update it for the driver.']] },
    { s: 'Followed up after a missed pickup. Rescheduled for Friday with no charge for the return trip.', t: [['s', 'Our driver found the office closed yesterday. Can we come back Friday?'], ['c', 'Sorry about that. Friday works.'], ['s', 'Great, no extra charge.']] },
  ],
  leadIn: { s: 'First call from the {channel} listing. Asked about pricing for {service} and wants a call back with a quote.', t: [['c', 'Hi, I found you on {channel}. How much do you charge for {service}?'], ['s', 'It depends on volume. Can I get your name and the best number to call you back with a quote?'], ['c', 'Sure, it’s {first}. This number is fine.']] },
  leadOut: [
    { s: 'First conversation. Needs {service}. Sent pricing by email; follow up in two days.', t: [['s', 'Hi {first}, it’s {staff} from Discount Shred, returning your request.'], ['c', 'Thanks. We need {service}.'], ['s', 'We can do that. I’ll email pricing in a few minutes.']] },
    { s: 'Reviewed the quote. Comparing with another provider; decision expected by the end of the week.', t: [['s', 'Did you get a chance to look at the quote?'], ['c', 'We did. We’re comparing it with one other company.'], ['s', 'Understood. Can I check back Friday?'], ['c', 'Friday is fine.']] },
  ],
  vm: ['Hi, this is {first} with {co}. Please call me back about pickup times next week. Thanks.', 'Hey, it’s {first}. Do you take binders with metal clips? Call me back when you can.', 'This is {first} from {co}. We have extra boxes this month. Can the driver take them?'],
  email: [
    { dir: 'out', subject: 'Certificate of destruction — {month}', snippet: 'Attached is your certificate of destruction for the service on {date}. Thank you for your business.' },
    { dir: 'in', subject: 'Re: Adding a console', snippet: 'Sounds good. Please add one for the break room starting with the next visit.' },
    { dir: 'in', subject: 'W-9 for our vendor file', snippet: 'Our accounting team needs a current W-9 before we can process the next payment.' },
    { dir: 'out', subject: 'Thanksgiving schedule', snippet: 'We’re closed Thanksgiving Day, so your pickup moves to Wednesday that week.' },
  ],
  notes: ['Prefers texts to calls for schedule changes.', 'Records retention review in January. Ask about a purge.', 'New office manager starts next month; update the contacts then.', 'Pays by check, usually within two weeks.', 'Very happy with the drivers. Asked about a referral discount.'],
};

function gen(c) {
  const p = c.contacts[0] || { name: c.name, role: '', phone: '', email: '' }, s = staff(c.owner), loc = c.locations[0], house = c.kind === 'household';
  const lead = PIPE.includes(c.lifecycle) && !c.successful, n = parseInt(loc.containers, 10) || ri(2, 4);
  const service = c.type === 'purge' ? 'a one-time purge of about ' + (loc.containers || ri(10, 30) + ' boxes') : 'regular service for about ' + n + ' consoles';
  const fill = str => str.replace(/\{first\}/g, first(p.name)).replace(/\{co\}/g, house ? 'on ' + loc.address.split(',')[0].replace(/^\d+\s*/, '') : c.name)
    .replace(/\{email\}/g, p.email || 'your email').replace(/\{partner\}/g, c.contacts[1] ? first(c.contacts[1].name) : 'the partners').replace(/\{staff\}/g, first(s))
    .replace(/\{service\}/g, service).replace(/\{channel\}/g, c.channel).replace(/\{price\}/g, fmt.money(c.stats.rate || 85)).replace(/\{month\}/g, fmt.day(D.add(today, -ri(5, 40)), 'month').split(' ')[0]).replace(/\{date\}/g, fmt.day(D.add(today, -ri(3, 20)), 'md'));
  const tr = tpl => tpl.t.map(([who, text]) => [who === 'c' ? p.name : s, fill(text)]);
  const call = (days, dir, tpl, o = {}) => addI({ customerId: c.id, type: 'call', dir, at: at(days, ri(8 * 60 + 10, 16 * 60 + 40)), duration: o.dur || ri(70, 380), contact: p.name, number: p.phone, line: o.line || lineFor(dir === 'in' && !lead ? 'Main' : c.channel), by: s, summary: fill(tpl.s), transcript: tr(tpl) });
  const text = (days, msgs) => { const base = at(days, ri(9 * 60, 15 * 60)); addI({ customerId: c.id, type: 'text', at: base + (msgs.length - 1) * 4 * 60000, contact: p.name, number: p.phone, line: lineFor('Main'), messages: msgs.map(([dir, t], k) => ({ dir, text: fill(t), at: base + k * 4 * 60000, by: dir === 'out' ? s : null, state: 'delivered' })) }); };
  const email = (days, e) => addI({ customerId: c.id, type: 'email', dir: e.dir, at: at(days, ri(8 * 60, 17 * 60)), subject: fill(e.subject), snippet: fill(e.snippet), from: e.dir === 'in' ? p.email || 'unknown' : first(s).toLowerCase() + '@discountshred.example', to: e.dir === 'in' ? 'office@discountshred.example' : p.email });
  const born = lead ? (c.lifecycle === 'lead' ? ri(0, 3) : c.lifecycle === 'lost' ? ri(25, 60) : ri(5, 14)) : (c.stats.firstInvoice ? D.diff(today, c.stats.firstInvoice) + ri(4, 15) : ri(30, 120));
  c.createdAt = at(born, ri(8 * 60, 11 * 60));
  /* Attribution: the first touch sets the acquisition channel; later touches are all kept. */
  const web = WEB.includes(c.channel), landing = pick(LANDING);
  data.touches.push({ customerId: c.id, at: c.createdAt, channel: c.channel, campaign: pick(CAMPAIGN[c.channel] || CAMPAIGN.Other), landing: web ? landing : '—', kind: web ? 'Form' : LINES[c.channel] ? 'Call' : 'Referral' });
  if (!lead) for (let k = ri(0, 2); k > 0; k--) { const ch = pick(['Website', 'Google Ads', 'Repeat']); data.touches.push({ customerId: c.id, at: at(ri(10, Math.max(11, born - 1)), ri(8 * 60, 18 * 60)), channel: ch, campaign: pick(CAMPAIGN[ch]), landing: ch === 'Repeat' ? '—' : pick(LANDING), kind: ch === 'Repeat' ? 'Call' : 'Visit' }); }
  /* Intake: website form (lead-intake), or a call on the channel's tracking number plus a row in the Google leads sheet. */
  const utm = UTM[c.channel] || ['(direct)', '(none)'], fields = [['Name', p.name], ['Company', house ? '' : c.name], ['Phone', fmt.phone(p.phone)], ['Email', p.email], ['Service', c.type === 'purge' ? 'One-time purge' : 'Recurring service']];
  if (web) addI({ customerId: c.id, type: 'form', at: c.createdAt, landing, fields: fields.concat([['Message', 'Looking for ' + service + '.']]),
    attribution: [['utm_source', utm[0]], ['utm_medium', utm[1]], ['utm_campaign', data.touches[data.touches.length - 1].campaign], c.channel === 'Google Ads' ? ['gclid', 'Cj0KCQiA' + c.id.toUpperCase() + 'x7Rk2'] : c.channel === 'Bing Ads' ? ['msclkid', '3f9a' + c.id + 'b21c'] : null, ['Landing page', 'discountshred.com' + landing], ['Referrer', c.channel === 'Website' ? 'google.com' : '—']].filter(Boolean) });
  else if (lead) { if (LINES[c.channel]) call(born, 'in', TPL.leadIn, { line: lineFor(c.channel), dur: ri(60, 150) });
    addI({ customerId: c.id, type: 'sheet', at: c.createdAt + 9 * 60000, row: 180 + ri(0, 60), fields: fields.concat([['Source', c.channel], ['Notes', c.channel === 'Referral' ? 'Referred by an existing customer.' : 'Called from the ' + c.channel + ' listing.']]) }); }
  if (lead) {
    addI({ customerId: c.id, type: 'note', at: c.createdAt + 15 * 60000, text: 'Assigned to ' + s + ' from the ' + c.channel + ' lead.', by: 'RouteClerk' });
    if (c.lifecycle === 'lead' && rnd() < 0.5) addI({ customerId: c.id, type: 'voicemail', at: at(Math.max(0, born - 1), ri(12 * 60, 16 * 60)), duration: ri(18, 45), contact: p.name, number: p.phone, line: lineFor(c.channel), summary: 'Caller asked for a call back.', transcript: [[p.name, fill(pick(TPL.vm))]] });
    if (c.lifecycle !== 'lead') { call(Math.max(0, born - 1), 'out', TPL.leadOut[0]); text(Math.max(0, born - 1), [['out', 'Hi {first}, this is {staff} with Discount Shred following up on your request. Is now a good time for a quick call?'], ['in', 'Yes, after 2 today works.']]); }
    if (c.lifecycle === 'quoted' || c.lifecycle === 'scheduled') { email(Math.max(0, born - 2), { dir: 'out', subject: 'Your shredding quote', snippet: house ? 'For about ' + (loc.containers || 'your boxes') + ' the price is {price}, picked up and shredded on site.' : 'Thanks for talking with us. For ' + n + ' consoles every 4 weeks the price is {price} per visit, no contract.' }); call(Math.max(0, born - 4), 'out', TPL.leadOut[1]); }
    if (c.lifecycle === 'lost') addI({ customerId: c.id, type: 'note', at: at(Math.max(0, born - 10), 14 * 60), text: 'Marked lost: ' + (c.lostReason || 'No response') + '. ' + (c.notes || ''), by: s });
    return;
  }
  const calls = c.id === 'c1' ? 4 : 2, pool = TPL.custIn.slice();
  for (let k = 0; k < calls; k++) call(ri(1, 45), 'in', pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  if (c.id === 'c1' || rnd() < 0.5) call(ri(2, 30), 'out', pick(TPL.custOut));
  if (c.id === 'c1' || rnd() < 0.4) addI({ customerId: c.id, type: 'voicemail', at: at(ri(3, 25), ri(12 * 60, 17 * 60)), duration: ri(15, 50), contact: p.name, number: p.phone, line: lineFor('Main'), summary: 'Caller asked for a call back.', transcript: [[p.name, fill(pick(TPL.vm))]] });
  const nextJob = q.jobsForCustomer(c.id).find(isUpcoming), dayTxt = nextJob ? fmt.day(nextJob.day, 'long') : 'Monday';
  text(nextJob && nextJob.day > today ? 0 : ri(1, 6), house ? [['in', 'Do you take binders and folders with clips?'], ['out', 'Yes, no need to remove clips or staples. Everything is shredded on site.'], ['in', 'Great, thank you!']]
    : [['out', 'Discount Shred: your service is scheduled for ' + dayTxt + '. Reply C to confirm or call (512) 555-0300.'], ['in', 'C'], ['in', 'Consoles are by the copier room this time.'], ['out', 'Thanks, I’ll let the driver know.']]);
  const ep = TPL.email.slice(); for (let k = c.id === 'c1' ? 3 : ri(1, 2); k > 0; k--) email(ri(2, 50), ep.splice(Math.floor(rnd() * ep.length), 1)[0]);
  addI({ customerId: c.id, type: 'note', at: at(ri(5, 60), ri(9 * 60, 16 * 60)), text: loc.notes && rnd() < 0.5 ? 'Driver reminder: ' + loc.notes : pick(TPL.notes), by: pick(['Colleen Abbott', 'Priya Raman', 'Dana Whitfield']) });
}
data.customers.forEach(c => c.locations.forEach(l => { if (!l.items) l.items = WD.parseItems(l.containers); }));
data.customers.forEach(gen);
/* Some inbound calls were answered by the AI phone agent (after hours, or while every line was busy), so the timeline shows who was a person and who was not. */
data.interactions.forEach((i, k) => { if (i.type === 'call' && i.dir === 'in' && k % 6 === 2) { i.by = 'AI phone agent'; i.summary = 'Answered by the AI phone agent. ' + i.summary; } });

/* Billing mirror: invoices from completed jobs, older paid history, and an overdue invoice for any balance due. */
const addInvoice = o => { const j = o.jobId && q.job(o.jobId), inv = { id: 'inv' + (++invSeq), payments: [], at: stamp(o.day, j ? (j.departedAt != null ? j.departedAt : 8 * 60 + (j.seq || 1) * 40) + 40 : 9 * 60), ...o }; data.invoices.push(inv); return inv; };
const addPayment = (inv, when, method) => { const pay = { id: 'pay' + (++paySeq), invoiceId: inv.id, customerId: inv.customerId, at: when, amount: inv.amount, method }; data.payments.push(pay); inv.payments.push(pay.id); return pay; };
const methodFor = c => c.type === 'creditCard' ? 'Card on file (Stripe)' : pick(['Check', 'ACH transfer', 'Card (Stripe)']);
data.jobs.forEach(j => { if (j.invoice && j.customerId) addInvoice({ number: j.invoice.number, customerId: j.customerId, jobId: j.id, day: j.day, amount: j.invoice.amount, status: j.invoice.status, auto: !!j.invoice.auto }); });
data.customers.forEach(c => {
  if (c.successful) [ri(14, 30), ri(40, 80)].forEach(d => addInvoice({ number: 'INV-' + (1900 + invSeq), customerId: c.id, jobId: null, day: D.add(today, -d), amount: c.stats.rate, status: 'Paid', auto: c.type === 'creditCard' }));
  if (c.stats.balance > 0) addInvoice({ number: 'INV-' + (2100 + invSeq), customerId: c.id, jobId: null, day: D.add(today, -ri(35, 70)), amount: c.stats.balance, status: 'Overdue', auto: false });
});
data.invoices.forEach(inv => { if (inv.status === 'Paid') addPayment(inv, inv.auto ? inv.at + 2 * 60000 : (t => t < +WD.now() ? t : Math.max(inv.at + 5 * 60000, Math.min(inv.at + ri(30, 300) * 60000, +WD.now() - 3 * 60000)))(inv.at + ri(2, 9) * 864e5), methodFor(q.customer(inv.customerId))); });
function linesFor(inv) {
  const fj = inv.jobId && q.job(inv.jobId); if (inv.lines) return inv.lines; if (fj && fj.invoice && fj.invoice.lines) return fj.invoice.lines;
  const c = q.customer(inv.customerId) || { type: 'regular', locations: [{}] }, cont = String(c.locations[0].containers || '');
  const svc = PRICE_BOOK.find(s => s.id === (c.type === 'purge' ? 'box' : /96/.test(cont) ? 'bin96' : /bin/.test(cont) ? 'bin64' : 'console'));
  const qty = Math.max(1, Math.floor((inv.amount - 10) / svc.rate)), rest = inv.amount - qty * svc.rate;
  const lines = rest >= 0 ? [{ name: svc.name, qty, rate: svc.rate }] : [{ name: svc.name, qty: 1, rate: inv.amount }];
  if (rest > 0) lines.push({ name: 'Trip charge', qty: 1, rate: rest });
  return lines.concat([{ name: 'Certificate of destruction', qty: 1, rate: 0 }]);
}

/* Follow-up tasks */
data.customers.forEach(c => { if (c.nextAction && c.lifecycle !== 'lost') addTask(c.id, { lead: 'Call back new lead', contacted: 'Send the quote', quoted: 'Follow up on the quote', scheduled: 'Confirm first service' }[c.lifecycle] || 'Follow up', c.nextAction, { lead: true }); });
[['c35', 'Call Dr. Grant back about pricing', 0], ['c36', 'Call back new lead', 0, { lead: true }], ['c16', 'Send updated certificate of insurance', -1], ['c5', 'Renew city vendor registration', 0], ['c9', 'Get PO number for the December invoice', 4],
  ['c1', 'Ask about adding a bin for the records room', 6], ['c3', 'Confirm weekly tax-season schedule', 12], ['c15', 'Bring 2 consoles on first visit', 0, { owner: 'u2' }],
  ['c12', 'Update card on file', -3, { done: 2 }], ['c7', 'Send W-9', -1, { done: 1 }], ['c4', 'Add security sign-in contact', -4, { done: 3 }]].forEach(([cid, t, due, o]) => q.customer(cid) && addTask(cid, t, due, o));

data.mergeSuggestions = [
  { id: 'm1', a: 'c1', b: 'c31', reason: 'Same phone number', detail: fmt.phone('+15125550143'), status: 'open' },
  { id: 'm2', a: 'c2', b: 'c32', reason: 'Similar name and same address', detail: '1480 Ridgeview Dr', status: 'open' },
];

/* ================= Timeline ================= */
/** Stored interactions plus live entries for the customer's jobs, invoices and payments, newest first. */
function timeline(cid) {
  const out = data.interactions.filter(i => i.customerId === cid);
  q.jobsForCustomer(cid).forEach(j => { if (j.status !== 'completed' && j.status !== 'skipped') return; const r = q.route(j.routeId), drv = q.driverFor(j.routeId);
    out.push({ id: 'job-' + j.id, type: 'job', customerId: cid, jobId: j.id, at: stamp(j.day, j.departedAt != null ? j.departedAt : 8 * 60 + (j.seq || 1) * 40), title: j.status === 'completed' ? 'Service completed' : 'Stop skipped', snippet: j.title + (j.containers ? ' · ' + j.containers : ''), who: q.routeName(r) + (drv ? ' · ' + drv.name : ''), by: drv ? drv.name : null }); });
  if (WD.can('billing.view')) {
    data.invoices.forEach(inv => { if (inv.customerId === cid) out.push({ id: 'inv-' + inv.id, type: 'invoice', customerId: cid, invoiceId: inv.id, at: inv.at, title: 'Invoice ' + inv.number + (inv.auto ? ' auto-charged' : ' sent'), snippet: fmt.money(inv.amount) + ' · ' + inv.status, who: 'Invoice Ninja', by: inv.auto ? 'Automatic' : inv.by || null }); });
    data.payments.forEach(pay => { if (pay.customerId !== cid) return; const inv = data.invoices.find(x => x.id === pay.invoiceId); out.push({ id: 'pay-' + pay.id, type: 'payment', customerId: cid, invoiceId: pay.invoiceId, at: pay.at, title: 'Payment received', snippet: fmt.money(pay.amount) + ' · ' + pay.method, who: inv ? inv.number : '' }); });
  }
  return out.sort((a, b) => b.at - a.at);
}
function describe(i) {
  const fv = k => ((i.fields || []).find(f => f[0] === k) || [])[1] || '';
  switch (i.type) {
    case 'call': return { title: (i.dir === 'in' ? 'Incoming call' : 'Outgoing call') + ' · ' + mmss(i.duration), snippet: i.summary, who: i.dir === 'in' ? i.contact + ' · ' + i.line.channel + ' line' : i.by + ' called ' + fmt.phone(i.number) };
    case 'voicemail': return { title: 'Voicemail · ' + mmss(i.duration), snippet: i.transcript[0][1], who: i.contact + ' · ' + fmt.phone(i.number) };
    case 'text': { const m = i.messages[i.messages.length - 1]; return { title: (m.dir === 'in' ? 'Text from ' : 'Text to ') + i.contact, snippet: m.text, who: i.messages.length + ' messages · ' + fmt.phone(i.number) }; }
    case 'email': return { title: i.subject, snippet: i.snippet, who: i.dir === 'in' ? 'From ' + i.from : 'To ' + i.to };
    case 'form': return { title: 'Website form', snippet: fv('Message'), who: 'discountshred.com' + i.landing };
    case 'sheet': return { title: 'Leads sheet row', snippet: fv('Notes'), who: 'Google Sheets · row ' + i.row };
    case 'note': return { title: 'Note', snippet: i.text, who: i.by };
    default: return { title: i.title, snippet: i.snippet, who: i.who };
  }
}
/* 5.3: who dealt with the customer, on every entry: the employee, the AI, an automatic message, or nobody. */
const handledBy = i => { switch (i.type) {
  case 'call': return i.by || null;
  case 'text': { const out = [...new Set((i.messages || []).filter(m => m.dir === 'out' && m.by).map(m => m.by))]; return out.length ? out : null; }
  case 'email': return i.dir === 'out' ? i.by || (/certificate|schedule|reminder|receipt/i.test(i.subject || '') ? 'Automatic' : staffFromEmail(i.from)) : null;
  case 'note': return i.by === 'RouteClerk' ? 'Automatic' : i.by || null;
  default: return i.by || null; } };
const staffFromEmail = from => { const n = String(from || '').split('@')[0], u = (data.users || []).find(x => x.name.split(' ')[0].toLowerCase() === n); return u ? u.name : null; };
const nobody = i => i.type === 'voicemail' || (i.type === 'call' && i.dir === 'in' && !i.by) ? 'Nobody answered' : i.type === 'text' || (i.type === 'email' && i.dir === 'in') || i.type === 'form' || i.type === 'sheet' ? 'No reply from us yet' : null;
const tlRow = i => { const d = describe(i), [ic, col] = TYPES[i.type];
  return ui.row({ class: 'cu-tl', icon: ic, iconColor: col, title: d.title, subtitle: [h('div.cu-1l', d.snippet), h('div.cu-who', d.who), h('div', { style: 'margin-top:4px' }, ui.who(handledBy(i), { none: nobody(i) }))], detail: fmt.rel(i.at), chevron: true, onTap: () => openEntry(i) }); };
function openEntry(i) {
  if (i.type === 'job') return openJob(i.jobId);
  if (i.type === 'invoice' || i.type === 'payment') return WD.nav.push(invoicePage(i.invoiceId));
  if (i.type === 'text') return WD.nav.push(threadPage(i.customerId, i));
  WD.nav.push(i.type === 'call' || i.type === 'voicemail' ? callPage(i) : i.type === 'email' ? emailPage(i) : i.type === 'note' ? notePage(i) : formPage(i));
}

/* ================= Customers tab root ================= */
const R = { min: 0, seg: 'customers', filter: 'all', query: '', results: null, loading: false, lostOpen: false, busy: null, justDone: null, page: null, taskOpen: { appr: true, overdue: true, today: true, upcoming: false, post: false, done: false } };
let searchToken = 0;
function root() {
  return { title: 'Customers', large: true,
    search: { placeholder: 'Name, phone, email or address', onInput(v, page) {
      R.query = v.trim(); const t = ++searchToken;
      if (!R.query) { R.results = null; R.loading = false; return page.refresh(); }
      R.loading = true; page.refresh();
      setTimeout(() => { if (t !== searchToken) return; R.loading = false; R.results = q.searchCustomers(R.query, 12); page.refresh(); }, 250);
    } },
    /* The gear at the top left: customer types and the other customer-level settings (Company settings permission). */
    leading: () => WD.can('settings.manage') ? [{ icon: 'gearshape', label: 'Customer settings', onTap: p => p.push(custSettingsSpec()) }] : [],
    trailing: () => [(R.seg === 'customers' || WD.can('leads.view')) && !R.query ? { icon: 'line.3.horizontal.decrease.circle', label: 'Filter', onTap: (p, el) => filterMenu(el, p) } : null,
      WD.can('crm.edit') ? { icon: 'plus', label: R.seg === 'tasks' && !WD.can('leads.view') ? 'New follow-up' : 'New customer', onTap: () => R.seg === 'tasks' && !WD.can('leads.view') ? newTask() : openNew() } : null],
    onAppear: page => { R.page = page; },
    render: page => R.query ? searchView() : [
      /* Tasks live on the CRM tab and invoices on the Invoices tab. People without the CRM tab keep Leads and Tasks here. */
      !WD.can('leads.view') && h('div.cu-seg', ui.segmented([{ value: 'customers', label: 'Customers' }, { value: 'leads', label: 'Leads' }, { value: 'tasks', label: 'Tasks' }], R.seg, v => { R.seg = v; page.refresh(); })),
      WD.can('leads.view') || R.seg === 'customers' ? customersView() : R.seg === 'leads' ? leadsView() : tasksView()] };
}
/** Customers → gear: customer types (add, rename, hide, delete, and the fields each type requires) and the other settings that apply to customers. */
function custSettingsSpec() {
  return { title: 'Customer settings', render: page => { if (!WD.can('settings.manage')) return ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'This needs the Company settings permission.' });
    const U = WD.r11 && WD.r11.cfg && WD.r11.cfg.unpaid;
    return ui.list(WD.admin && WD.admin.custTypesSection ? WD.admin.custTypesSection(page) : null,
      ui.section({ header: 'More for customers', fold: false },
        WD.biz && WD.biz.fieldsSpec && ui.row({ icon: 'square.and.pencil', iconColor: 'var(--blue)', title: 'Custom fields', subtitle: 'Your own fields on the customer record', chevron: true, onTap: () => page.push(WD.biz.fieldsSpec()) }),
        WD.r11 && WD.r11.unpaidSettingsSpec && ui.row({ icon: 'exclamationmark.circle', iconColor: 'var(--red)', title: 'Unpaid invoice warnings', subtitle: U ? (U.on === false ? 'Off' : 'Warn over ' + U.limit + ' unpaid · overdue after ' + U.overdueDays + ' days') : null, chevron: true, onTap: () => page.push(WD.r11.unpaidSettingsSpec()) }),
        WD.admin && WD.admin.importSpec && ui.row({ icon: 'list.bullet', iconColor: 'var(--green)', title: 'Import customers and jobs', subtitle: 'From a file or from the program you used before', chevron: true, onTap: () => page.push(WD.admin.importSpec()) }))); } };
}
/** Customer types offered in a picker: hidden ones are left out unless the record already has it. */
const custTypeOptions = cur => WD.custTypes.filter(t => !t.hidden || t.id === cur).map(t => ({ value: t.id, label: t.title }));
/** A red “Bad debt” badge for a customer with a written-off invoice (see WD.badDebt in rc-money.js). Voided invoices leave no mark. */
const badDebtBadge = c => { const b = WD.badDebt && WD.badDebt(c.id); return b ? ui.badge('Bad debt ' + fmt.money(b.amount), 'var(--red)') : null; };
const FILTER_TEXT = { balance: 'customers with a balance due', overdue: 'customers with overdue invoices', route: 'customers by route', household: 'residential customers', recurring: 'recurring customers', onetime: 'one-time customers', hidden: 'hidden customers' };
const isRecurring = c => !!c.freq && c.freq !== 'One time';
/** Unpaid and overdue amounts come from the invoices themselves (WD.r11); "overdue" uses the number of days in Settings → Unpaid invoices. */
const owedBy = c => WD.r11 ? WD.r11.owed(c) : c.stats.balance, overdueOf = c => WD.r11 ? WD.r11.overdue(c) : [];
const ownerView = () => ['owner', 'admin'].includes((WD.state.me || {}).role);
function filterMenu(el, page) {
  const bill = WD.can('billing.view');
  ui.menu(el, [{ header: 'Show' }, ...[['all', 'All customers', 'person.2'], bill && ['balance', 'Balance due', 'dollarsign.circle'], bill && ['overdue', 'Overdue invoices', 'exclamationmark.circle'], ['recurring', 'Recurring', 'repeat'], ['onetime', 'One time', 'circle'], ['route', 'By route', 'route'], ['household', 'Residential', 'house'], ['hidden', 'Hidden', 'eye.slash']].filter(Boolean)
    .map(([v, label, ic]) => ({ label, icon: ic, checked: R.filter === v && !R.min, onTap: () => { R.filter = v; R.min = 0; page.refresh(); } })),
    ...(bill ? ['divider', { header: 'Over an amount' }, ...[['balance', 'Balance due over…'], ['overdue', 'Overdue over…']].map(([v, label]) => ({ label: label + (R.filter === v && R.min ? ' ' + fmt.money(R.min) : ''), icon: 'dollarsign.circle', checked: R.filter === v && R.min > 0, onTap: async () => {
      const r = await ui.alert({ title: v === 'balance' ? 'Balance due over' : 'Overdue over', message: 'Show customers who owe more than this amount.', input: { placeholder: 'e.g. 250', value: R.min ? String(R.min) : '', type: 'number' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Show', value: true, bold: true }] });
      if (!r || !r.value) return; R.filter = v; R.min = Math.max(0, parseFloat(r.text) || 0); page.refresh(); } }))] : [])], { compact: true });
}
function searchView() {
  if (R.loading) return h('div.cu-loading', ui.spinner(18), 'Searching…');
  const res = (R.results || []).filter(r => !r.customer.hidden);   // hidden customers only show under the Hidden filter
  if (!res.length) return ui.empty({ icon: 'magnifyingglass', title: 'No matches', text: R.query.length < 2 ? 'Type at least two characters.' : 'No customer matches “' + R.query + '”.' });
  return ui.list(ui.section({ header: res.length === 1 ? '1 match' : res.length + ' matches', footer: 'Searches every customer: names, contacts, phone numbers, emails and addresses.' },
    res.map(r => ui.row({ class: 'cu-crow', leading: avatar(r.customer), title: h('span.cu-name-row', r.customer.name, badDebtBadge(r.customer)), subtitle: r.match, badge: lcBadge(r.customer), chevron: true, onTap: () => openDetail(r.customer.id) }))));
}
/* The markers at the right of a customer: the amount owed above "Balance due", and below it the overdue amount above "Overdue". Balance is dark blue on light blue; overdue is the red badge style. */
const mark = (amount, label, late) => h('span.cu-mark' + (late ? '.late' : ''), h('b', fmt.money(amount)), label);
const custRow = c => { const bill = WD.can('billing.view'), owed = bill ? owedBy(c) : 0, warn = !(WD.r11 && WD.r11.warnOn) || WD.r11.warnOn('customers'), late = bill && warn ? overdueOf(c).reduce((s, i) => s + i.amount, 0) : 0;   // the Overdue marker is one of the unpaid-invoice warnings (Settings → Company)
  return ui.row({ class: 'cu-crow', leading: avatar(c), title: h('span.cu-name-row', c.name, c.successful && icon('star.fill', 13, 'var(--yellow)'), c.hidden && ui.badge('Hidden', 'var(--gray)'), badDebtBadge(c)),
    subtitle: [h('div', c.locations[0] ? c.locations[0].address.replace(/, Lakemont$/, '') : ''), ownerView() && h('div.cu-totals', c.stats.jobs + (c.stats.jobs === 1 ? ' job' : ' jobs') + ' done · ' + fmt.money(c.stats.invoiced) + ' invoiced')],
    badge: owed > 0 || late > 0 ? h('span.cu-marks', owed > 0 && mark(owed, 'Balance due'), late > 0 && mark(late, 'Overdue', true)) : null, chevron: true, onTap: () => openDetail(c.id) }); };
function customersView() {
  let list = data.customers.filter(c => (!PIPE.includes(c.lifecycle) || c.lifecycle === 'scheduled') && (R.filter === 'hidden' ? c.hidden : !c.hidden)).sort((a, b) => a.name.localeCompare(b.name));
  const lateSum = c => overdueOf(c).reduce((s, i) => s + i.amount, 0);
  if (R.filter === 'balance') list = list.filter(c => owedBy(c) > R.min); if (R.filter === 'household') list = list.filter(c => c.kind === 'household');
  if (R.filter === 'overdue') list = list.filter(c => overdueOf(c).length > 0 && lateSum(c) > R.min); if (R.filter === 'recurring') list = list.filter(isRecurring); if (R.filter === 'onetime') list = list.filter(c => !isRecurring(c));
  const dupes = data.mergeSuggestions.filter(s => s.status === 'open').length, groups = new Map();
  list.forEach(c => { const k = R.filter === 'route' ? q.routeName(c.route) : (c.name[0] || '#').toUpperCase(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
  const keys = [...groups.keys()]; if (R.filter === 'route') keys.sort((a, b) => (q.routes().findIndex(r => q.routeName(r) === a) + 99) % 99 - (q.routes().findIndex(r => q.routeName(r) === b) + 99) % 99);
  return ui.list(
    ui.chipRow(R.filter === 'all' && WD.r11 && WD.can('billing.view') && WD.r11.unpaidSection(),
      R.filter === 'all' && WD.x.customerNotices(),
      dupes && WD.can('crm.edit') ? ui.section(null, ui.row({ icon: 'arrow.triangle.merge', iconColor: 'var(--orange)', title: dupes + (dupes === 1 ? ' possible duplicate' : ' possible duplicates'), subtitle: 'Review and merge matching records', chevron: true, onTap: () => WD.nav.push(mergesPage()) })) : null),
    R.filter !== 'all' ? h('div.cu-filter', 'Showing ' + FILTER_TEXT[R.filter] + (R.min && (R.filter === 'balance' || R.filter === 'overdue') ? ' over ' + fmt.money(R.min) : ''), h('button.cu-link', { onclick: () => { R.filter = 'all'; R.min = 0; R.page && R.page.refresh(); } }, 'Show all')) : null,
    (R.filter === 'balance' || R.filter === 'overdue') && list.length && WD.rc && WD.rc.batchStatements && WD.can('billing.view') ? ui.section(null, ui.row({ icon: 'envelope', iconColor: 'var(--teal)', title: 'Send statements to ' + (list.length === 1 ? 'this customer' : 'these ' + list.length + ' customers') + '…', subtitle: 'One statement each, with or without the unpaid invoices', chevron: true, onTap: () => WD.rc.batchStatements(list) })) : null,
    list.length ? keys.map(k => ui.section({ header: k, fold: R.filter === 'route' }, groups.get(k).map(custRow))) : ui.empty({ icon: 'person.2', title: 'No customers', text: 'Nothing matches this filter.' }),
    list.length ? h('div.cu-count', list.length + (list.length === 1 ? ' customer' : ' customers')) : null);
}

/* ---------- Leads pipeline ---------- */
const contactedYet = c => data.interactions.some(i => i.customerId === c.id && (i.dir === 'out' || (i.type === 'text' && i.messages.some(m => m.dir === 'out'))));
function nextLabel(c) {
  const job = c.lifecycle === 'scheduled' && q.jobsForCustomer(c.id).find(isUpcoming);
  if (job) return h('span', 'Job ' + fmt.day(job.day, 'rel'));
  if (!c.nextAction) return h('span.secondary', 'No date');
  const n = D.diff(c.nextAction, today);
  return h('span', { style: { color: n < 0 ? 'var(--red)' : null } }, n < 0 ? (n === -1 ? 'Yesterday' : fmt.day(c.nextAction, 'md')) : fmt.day(c.nextAction, 'rel'));
}
function leadsView() {
  const pipe = data.customers.filter(c => PIPE.includes(c.lifecycle)), g = { fresh: [], due: [], contacted: [], quoted: [], scheduled: [], lost: [] };
  pipe.forEach(c => { if (c.lifecycle === 'lost') g.lost.push(c); else if (c.lifecycle === 'lead' && !contactedYet(c)) g.fresh.push(c); else if (c.lifecycle !== 'scheduled' && c.nextAction && c.nextAction <= today) g.due.push(c);
    else if (c.lifecycle === 'quoted') g.quoted.push(c); else if (c.lifecycle === 'scheduled') g.scheduled.push(c); else g.contacted.push(c); });
  const byDate = a => a.sort((x, y) => (x.nextAction || '9').localeCompare(y.nextAction || '9'));
  const row = c => ui.row({ title: c.name, subtitle: (c.lifecycle === 'lost' ? 'Lost: ' + (c.lostReason || 'No reason') + ' · ' : '') + c.channel + ' · ' + first(staff(c.owner)), detail: c.lifecycle === 'lost' ? null : nextLabel(c), onTap: () => openDetail(c.id),
    trailing: WD.can('crm.edit') ? h('button.cu-more', { 'aria-label': 'More', onclick: e => { e.stopPropagation(); leadMenu(c, e.currentTarget); } }, icon('ellipsis.circle', 22)) : null });
  const sec = (title, list, footer) => list.length ? ui.section({ header: title + ' · ' + list.length, footer }, byDate(list).map(row)) : null;
  return ui.list(
    sec('New — never contacted', g.fresh, 'Leads from forms, calls and the leads sheet that nobody has called back yet.'), sec('Follow-up due', g.due), sec('Contacted', g.contacted), sec('Quoted — waiting', g.quoted), sec('Scheduled', g.scheduled),
    g.lost.length ? ui.section({ header: 'Lost · ' + g.lost.length }, ui.row({ title: R.lostOpen ? 'Hide lost leads' : 'Show lost leads', tint: true, trailing: icon(R.lostOpen ? 'chevron.up' : 'chevron.down', 16, 'var(--label3)'), onTap: () => { R.lostOpen = !R.lostOpen; R.page && R.page.refresh(); } }), R.lostOpen ? g.lost.map(row) : null) : null,
    !pipe.length ? ui.empty({ icon: 'person.badge.plus', title: 'No leads', text: 'New leads from calls, forms and the leads sheet appear here.' }) : null);
}
function leadMenu(c, el) {
  ui.menu(el, [{ label: 'Log a call', icon: 'phone', onTap: () => logCall(c) }, { label: 'Move to stage…', icon: 'arrow.right', onTap: () => moveStage(c) },
    { label: 'Set next action', icon: 'calendar', onTap: () => setNext(c) }, c.lifecycle !== 'lost' ? 'divider' : null, c.lifecycle !== 'lost' ? { label: 'Mark lost', icon: 'xmark', destructive: true, onTap: () => markLost(c) } : null]);
}
function logCall(c) {
  let outcome = 'talked', dir = 'out', notes = ''; const p = c.contacts[0] || { name: c.name, phone: '' };
  ui.sheet({ title: 'Log a call', leading: [{ label: 'Cancel', onTap: pg => pg.dismiss() }],
    trailing: [{ label: 'Save', bold: true, onTap: async pg => { if (await ui.run('Saving call…', () => {
      addI({ customerId: c.id, type: 'call', dir, at: +WD.now(), duration: outcome === 'talked' ? 240 : 35, contact: p.name, number: p.phone, line: lineFor('Main'), by: me(), summary: notes.trim() || { talked: 'Talked with ' + p.name + '.', voicemail: 'No answer. Left a voicemail.', none: 'No answer.' }[outcome], transcript: [] });
      if (c.lifecycle === 'lead') c.lifecycle = 'contacted';
    }, { done: 'Call logged' })) pg.dismiss(); } }],
    render: pg => ui.list(ui.section(null, ui.row({ title: c.name, subtitle: p.name + ' · ' + fmt.phone(p.phone) })),
      ui.section(null, ui.pickerRow({ title: 'Direction', options: [{ value: 'out', label: 'Outgoing' }, { value: 'in', label: 'Incoming' }], value: dir, onChange: v => { dir = v; pg.refresh(); } }),
        ui.pickerRow({ title: 'Outcome', options: [{ value: 'talked', label: 'Talked' }, { value: 'voicemail', label: 'Left a voicemail' }, { value: 'none', label: 'No answer' }], value: outcome, onChange: v => { outcome = v; pg.refresh(); } })),
      ui.section({ header: 'Notes', footer: c.lifecycle === 'lead' ? 'Logging a call moves this lead to Contacted.' : null }, ui.inputRow({ placeholder: 'What was discussed?', multiline: true, value: notes, onInput: v => { notes = v; } }))) }, { detent: 'large' });
}
async function moveStage(c) {
  const v = await ui.actionSheet({ title: 'Move ' + c.name + ' to', buttons: ['lead', 'contacted', 'quoted', 'scheduled', 'customer'].filter(s => s !== c.lifecycle).map(s => ({ label: LC[s][0], value: s })) });
  if (!v) return;
  await ui.run('Updating stage…', () => { c.lifecycle = v; c.lostReason = null; addI({ customerId: c.id, type: 'note', at: +WD.now(), text: 'Moved to ' + LC[v][0] + '.', by: me() }); }, { done: 'Moved to ' + LC[v][0] });
}
async function setNext(c) {
  const r = await ui.alert({ title: 'Next action', message: 'When should ' + c.name + ' be followed up?', input: { type: 'date', value: c.nextAction || today }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: 'save', bold: true }] });
  if (!r || r.value !== 'save' || !/^\d{4}-\d\d-\d\d$/.test(r.text)) return;
  await ui.run('Saving…', () => { c.nextAction = r.text; const t = data.tasks.find(x => x.customerId === c.id && x.lead && !x.done); if (t) t.due = r.text; else addTask(c.id, 'Follow up', r.text, { lead: true }); }, { done: 'Next action set', min: 400, max: 800 });
}
async function markLost(c) {
  const reason = await ui.actionSheet({ title: 'Why was this lead lost?', message: c.name, buttons: LOST.map(l => ({ label: l })) });
  if (!reason) return;
  await ui.run('Marking lost…', () => { c.lifecycle = 'lost'; c.lostReason = reason; c.nextAction = null; data.tasks.forEach(t => { if (t.customerId === c.id && t.lead && !t.done) { t.done = true; t.doneAt = +WD.now(); } }); addI({ customerId: c.id, type: 'note', at: +WD.now(), text: 'Marked lost: ' + reason + '.', by: me() }); }, { done: 'Marked lost' });
}

/* ---------- Tasks (follow-ups) ---------- */
function dueLabel(t) { const n = D.diff(t.due, today); return h('span', { style: { color: !t.done && n < 0 ? 'var(--red)' : null } }, n < 0 && n !== -1 ? fmt.day(t.due, 'md') : fmt.day(t.due, 'rel')); }
function taskRow(t, showCustomer = true) {
  const c = q.customer(t.customerId), done = t.done || R.justDone === t.id, edit = WD.can('crm.edit');
  const btn = h('button.cu-check', { 'aria-label': done ? 'Mark not done' : 'Complete', disabled: !edit, onclick: e => { e.stopPropagation(); toggleTask(t); } },
    R.busy === t.id ? ui.spinner(20) : icon(done ? 'checkmark.circle.fill' : 'circle', 24, done ? 'var(--green)' : 'var(--label3)'));
  return ui.row({ class: done ? 'cu-done' : null, leading: btn, title: t.title, subtitle: [showCustomer && c ? c.name : null, first(staff(t.owner))].filter(Boolean).join(' · '), detail: t.done ? 'Done ' + fmt.rel(t.doneAt) : dueLabel(t), onTap: c && showCustomer ? () => openDetail(c.id) : null });
}
async function toggleTask(t) {
  if (!WD.can('crm.edit') || R.busy) return;
  if (t.done) { t.done = false; t.doneAt = null; return WD.changed(); }
  if (WD.state.offline) return ui.run('', null);
  R.busy = t.id; WD.changed(); await WD.delay(450, 850);
  R.busy = null; t.done = true; t.doneAt = +WD.now(); R.justDone = t.id; WD.changed();
  await WD.delay(700); R.justDone = null; WD.changed();
}
/** A follow-up drawn like a lead on the Leads tab: what to do, who for, when it is due and whose it is. */
function taskCard(t) {
  const c = q.customer(t.customerId), done = t.done || R.justDone === t.id, edit = WD.can('crm.edit'), n = D.diff(t.due, today), late = !t.done && n < 0, who = staff(t.owner);
  const btn = h('button.cu-check', { 'aria-label': done ? 'Mark not done' : 'Complete', disabled: !edit, onclick: e => { e.stopPropagation(); toggleTask(t); } },
    R.busy === t.id ? ui.spinner(20) : icon(done ? 'checkmark.circle.fill' : 'circle', 24, done ? 'var(--green)' : 'var(--label3)'));
  return h('div.cr-lc.cu-tc' + (done ? '.cu-done' : ''), { role: c ? 'button' : null, tabindex: c ? '0' : null, 'aria-label': t.title, onclick: c ? () => openDetail(c.id) : null }, btn,
    h('div.cr-lc-m', h('div.cr-lc-t', h('b', t.title)), c && h('div.cr-lc-s', c.name),
      h('div.cr-lc-f', h('span.cr-chip' + (late ? '.late' : ''), icon('calendar', 12), t.done ? 'Done ' + fmt.rel(t.doneAt) : n < -1 ? 'Due ' + fmt.day(t.due, 'md') + ' · ' + (-n) + ' days late' : fmt.day(t.due, 'rel')), t.lead && ui.badge('Lead', 'var(--blue)'))),
    h('div.cr-lc-r', (a => { a.title = 'Assigned to ' + who; a.setAttribute('aria-label', 'Assigned to ' + who); return a; })(ui.avatar(who, { size: 28 }))));
}
/* The Tasks tab is built like the Leads tab: a bordered block per group in the group's color, with its count and its own Hide / Show.
   What needs a decision or is late comes first: price changes to approve (only when there are some), then Overdue, then Today.
   Postponed jobs and price approvals are in the same list, so nothing waiting on someone is kept in a separate place. */
function tasksView() {
  const open = data.tasks.filter(t => !t.done || R.justDone === t.id).sort((a, b) => a.due.localeCompare(b.due)), done = data.tasks.filter(t => t.done && R.justDone !== t.id).sort((a, b) => b.doneAt - a.doneAt).slice(0, 10);
  const X = WD.r11, post = X ? X.postponedRows() : [], appr = X ? X.approvalRows() : [], show = R.taskOpen;
  const block = (key, color, label, items, foot, rows) => h('div.cr-st', { style: { '--c': color } },
    h('div.cr-st-h', h('b', label), h('span.cr-st-n', String(items.length)), h('button.cu-link', { 'aria-label': (show[key] ? 'Hide ' : 'Show ') + label, onclick: e => { e.stopPropagation(); show[key] = !show[key]; WD.changed(); } }, show[key] ? 'Hide' : 'Show')),
    show[key] ? (items.length ? (rows ? h('div.cells', { style: 'border-radius:0' }, items) : items) : h('div.cr-st-f', { style: 'border-top:0' }, 'Nothing here.')) : null, show[key] && foot && items.length ? h('div.cr-st-f', foot) : null);
  const cards = list => list.map(taskCard);
  return h('div', { style: 'padding:0 0 24px' },
    appr.length > 0 && block('appr', 'var(--orange)', 'Price changes to approve', appr, 'A driver changed a standing price for this and all future visits. It applies once an owner or admin approves it.', true),
    block('overdue', 'var(--red)', 'Overdue', cards(open.filter(t => t.due < today))), block('today', 'var(--blue)', 'Today', cards(open.filter(t => t.due === today))), block('upcoming', 'var(--gray)', 'Upcoming', cards(open.filter(t => t.due > today))),
    X && block('post', 'var(--purple)', 'Postponed jobs', post, 'Jobs a customer postponed with no new date. Tap one to set a date, assign it to a route, edit it or cancel it.', true),
    block('done', 'var(--green)', 'Done', cards(done)));
}
function newTask(customerId) {
  let title = '', cid = customerId || null, due = D.add(today, 1); const ok = () => !!(title.trim() && cid);
  ui.sheet({ title: 'New follow-up', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Add', bold: true, disabled: !ok(), onTap: async p => { if (ok() && await ui.run('Adding follow-up…', () => { addTask(cid, title.trim(), due, { owner: WD.state.me && WD.state.me.id }); }, { done: 'Follow-up added' })) p.dismiss(); } }],
    render: p => ui.list(ui.section(null, ui.inputRow({ placeholder: 'Title', value: title, autofocus: true, onInput: v => { title = v; check(p, ok()); } })),
      ui.section(null, ui.row({ title: 'Customer', detail: cid ? q.customer(cid).name : 'Choose', chevron: !customerId, onTap: customerId ? null : () => pickCustomer(p, 'Customer', id => { cid = id; }) }),
        ui.dateRow({ title: 'Due', value: due, onChange: v => { due = v; } }))) }, { detent: 'medium' });
}
/** Push a searchable customer picker onto `page`'s stack; onPick(id) runs before it pops. */
function pickCustomer(page, title, onPick, exclude) {
  let term = '';
  page.push({ title, search: { placeholder: 'Search customers', onInput(v, pp) { term = v; pp.refresh(); } },
    render: pp => { const list = term.trim().length >= 2 ? q.searchCustomers(term, 20).map(r => r.customer) : data.customers.slice().sort((a, b) => a.name.localeCompare(b.name));
      const rows = list.filter(c => c.id !== exclude).map(c => ui.row({ class: 'cu-crow', leading: avatar(c, 30), title: c.name, subtitle: c.locations[0] && c.locations[0].address, onTap: () => { onPick(c.id); pp.pop(); } }));
      return rows.length ? ui.list(ui.section(null, rows)) : ui.empty({ icon: 'magnifyingglass', title: 'No matches' }); } });
}

/* ================= Customer detail ================= */
function openDetail(id) {
  if (!WD.can('crm.view')) return ui.toast('Customer records aren’t available for this role', 'lock');
  if (!q.customer(id)) return ui.toast('Customer not found', 'exclamationmark.circle');
  return WD.nav.push(detailSpec(id));
}
function detailSpec(id) {
  const st = { filter: 'all', showAll: false, tab: 'overview' };
  return { title: () => (q.customer(id) || {}).name || 'Customer',
    trailing: () => WD.can('crm.edit') && q.customer(id) ? [{ label: 'Edit', onTap: () => editCustomer(id) }] : [],
    render: page => {
      const c = q.customer(id); if (!c) return ui.empty({ icon: 'arrow.triangle.merge', title: 'Record merged', text: 'This customer was merged into another record.' });
      const edit = WD.can('crm.edit');
      /* The record is split across tabs so each one fits in a screen or two: who and where, what we do for them, money, and the conversation. */
      const bill = WD.can('billing.view'), tabs = [['overview', 'Overview'], ['service', 'Service'], bill && ['billing', 'Billing'], ['activity', 'Activity']].filter(Boolean);
      if (!tabs.some(t => t[0] === st.tab)) st.tab = 'overview';
      const body = { overview: () => [agreementRows(c), statsSection(c), contactsSection(c, edit), locationsSection(c), tasksSection(c, edit), detailsSection(c), attributionSection(c),
          edit && ui.section(null, ui.row({ title: 'Merge with another customer…', destructive: true, onTap: () => pickCustomer(WD.nav.current().top(), 'Merge with', other => setTimeout(() => WD.nav.push(comparePage(c.id, other, null)), 450), c.id) }))],
        service: () => [WD.x.pricingSection(c), jobsSections(c), WD.x.agreementSection(c), WD.biz && WD.biz.customerSections(c, edit), WD.x.historySection(c), !bill && WD.workflow && WD.workflow.customerSections(c)],
        billing: () => [billingSection(c), WD.workflow && WD.workflow.customerSections(c)],
        activity: () => [timelineSection(c, st, page, edit)] }[st.tab]();
      return [header(c), WD.badDebtBanner && WD.badDebtBanner(c.id, { actions: true }), h('div.cu-tabs', ui.segmented(tabs.map(([value, label]) => ({ value, label })), st.tab, v => { st.tab = v; page.refresh(); page.body.scrollTop = Math.min(page.body.scrollTop, (page.body.querySelector('.cu-tabs') || {}).offsetTop || 0); })), ui.list(body)];
    } };
}
function header(c) {
  const p = c.contacts[0], loc = c.locations[0];
  const qa = (ic, label, fn, disabled) => h('button.cu-qa', { disabled, onclick: fn }, icon(ic, 22), h('span', label));
  return h('div.cu-head.compact', h('div.cu-id', avatar(c, 52), h('div.cu-idt', h('div.cu-title', c.name), h('div.cu-meta', h('span', WD.custType(c.custType).title), lcBadge(c)),
      h('div.cu-sub', c.successful && [icon('star.fill', 12, 'var(--yellow)'), ' Since ' + longDate(c.stats.firstInvoice) + ' · '], 'From ' + c.channel))),
    h('div.cu-qas', qa('phone.fill', 'Call', () => startCall(c, p), !p || !p.phone), qa('message', 'Text', () => WD.nav.push(threadPage(c.id, latestThread(c.id))), !p || !p.phone),
      qa('envelope', 'Email', () => ui.toast('New email to ' + p.email + ' in Gmail', 'envelope'), !p || !p.email), qa('arrow.triangle.turn.up.right', 'Directions', () => WD.workflow.openDirections({ title: c.name }), !loc),
      qa('plus', 'New job', () => newJob(c.id), !WD.can('jobs.edit'))));
}
/** The customer's service agreement, at the top of the record: the one in force (signed) and any newer one still waiting. Opens the agreement document. */
function agreementRows(c) {
  const AX = WD.x; if (!AX || !AX.agreementsFor || !AX.agreementSpec) return null;
  const list = AX.agreementsFor(c.id), signed = list.find(a => a.status === 'signed'), waiting = list.find(a => a.status !== 'signed' && (!signed || a.createdAt > signed.createdAt)), manage = WD.can('contracts.manage'), on = t => longDate(D.key(new Date(t)));
  const st = a => a.status === 'signed' ? ['Signed ' + on(a.signedAt), 'var(--green)'] : a.status === 'draft' ? ['Draft · not sent', 'var(--gray)'] : [(a.status === 'viewed' ? 'Viewed' : 'Sent') + (a.sentAt ? ' ' + on(a.sentAt) : '') + ' · not signed', a.status === 'viewed' ? 'var(--orange)' : 'var(--blue)'];
  const row = a => { const [text, color] = st(a); return ui.row({ icon: 'signature', iconColor: color, title: 'Service agreement', subtitle: [h('div', { style: { color, fontWeight: 600 } }, text), h('div', a.number + ' · ' + (a.term ? a.term + ' months' : 'month to month') + (a.status === 'signed' && a.signer ? ' · signed by ' + a.signer : ''))], chevron: true, onTap: () => WD.nav.push(AX.agreementSpec(a)) }); };
  return ui.section({ fold: false }, signed && row(signed), waiting && row(waiting),
    !signed && !waiting && ui.row({ icon: 'signature', iconColor: 'var(--gray)', title: 'Service agreement', subtitle: 'None on file' }),
    !waiting && manage && AX.createAgreement && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: signed ? 'New agreement' : 'Create agreement', tint: true, onTap: () => WD.nav.push(AX.agreementSpec(AX.createAgreement(c))) }));
}
const tile = (label, value, color, onTap) => h('div.cu-stat' + (onTap ? '.tap' : ''), { onclick: onTap, role: onTap ? 'button' : null }, h('b', { style: { color } }, value), h('span', label, onTap && icon('chevron.right', 10)));
function statsSection(c) {
  const jobs = q.jobsForCustomer(c.id), next = jobs.find(isUpcoming), s = c.stats;
  /* Jobs and Invoiced open the customer's invoices; Balance opens only the unpaid ones. */
  const bill = WD.can('billing.view'), owed = owedBy(c), inv = unpaid => () => WD.nav.push(custInvoices(c.id, unpaid));
  return ui.section(null, h('div.cu-stats', tile('Jobs', String(s.jobs), null, bill ? inv(false) : null), tile('Last service', s.lastService ? fmt.day(s.lastService, 'rel') : '—'), tile('Next service', next ? fmt.day(next.day, 'rel') : '—'),
    bill && [tile('Invoiced', fmt.money(s.invoiced), null, inv(false)), tile('Paid', fmt.money(s.paid)), tile('Balance', fmt.money(owed), owed > 0 ? 'var(--red)' : null, inv(true))]));
}
function contactsSection(c, edit) {
  return ui.section('Contacts', c.contacts.map(p => ui.row({ icon: 'person.crop.circle', iconPlain: true, iconColor: 'var(--gray)', title: p.name, subtitle: [p.role, fmt.phone(p.phone, p.ext), p.email].filter(Boolean).join(' · '), onTap: () => contactActions(c, p, edit) })),
    !c.contacts.length && ui.row({ title: 'No contacts yet', subtitle: 'Add a phone number so calls and texts match this customer.' }),
    edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add contact', tint: true, onTap: () => editContact(c) }));
}
async function contactActions(c, p, edit) {
  const v = await ui.actionSheet({ title: p.name, message: [p.role, fmt.phone(p.phone, p.ext), p.email].filter(Boolean).join(' · '), buttons: [p.phone && { label: 'Call ' + fmt.phone(p.phone, p.ext), value: 'call' }, p.phone && { label: 'Text', value: 'text' },
    p.email && { label: 'Email', value: 'email' }, p.phone && { label: 'Copy phone number', value: 'copy' }, edit && { label: 'Edit contact', value: 'edit' }].filter(Boolean) });
  if (v === 'call') startCall(c, p); else if (v === 'text') WD.nav.push(threadPage(c.id, latestThread(c.id)));
  else if (v === 'email') ui.toast('New email to ' + p.email + ' in Gmail', 'envelope'); else if (v === 'copy') ui.toast('Copied', 'checkmark'); else if (v === 'edit') editContact(c, p);
}
function editContact(c, p) {
  /* A phone number must be complete (10 digits) or left empty; a contact needs a phone or an email. */
  const f = p ? { ...p, phone: p.phone ? fmt.phone(p.phone) : '', ext: p.ext || '' } : { name: '', role: '', phone: '', ext: '', email: '' }, ok = () => !!(f.name.trim() && (f.phone.trim() ? fmt.phoneValid(f.phone) : /@/.test(f.email)));
  ui.sheet({ title: p ? 'Edit contact' : 'New contact', leading: [{ label: 'Cancel', onTap: pg => pg.dismiss() }],
    trailing: () => [{ label: p ? 'Save' : 'Add', bold: true, disabled: !ok(), onTap: async pg => { if (ok() && await ui.run('Saving contact…', () => {
      const v = { name: f.name.trim(), role: f.role.trim(), phone: e164(f.phone), ext: e164(f.phone) ? f.ext : '', email: f.email.trim().toLowerCase() }; if (p) Object.assign(p, v); else c.contacts.push(v); }, { done: 'Saved' })) pg.dismiss(); } }],
    render: pg => ui.list(ui.section(null, ui.inputRow({ label: 'Name', placeholder: 'Full name', value: f.name, autofocus: !p, onInput: v => { f.name = v; check(pg, ok()); } }), ui.inputRow({ label: 'Role', placeholder: 'Office manager', value: f.role, onInput: v => { f.role = v; } })),
      ui.section({ footer: 'Phone numbers are 10 digits (559-968-4175), with an optional extension. They are matched to calls and texts from Quo; emails are matched to Gmail threads.' }, ui.phoneRow({ value: f.phone, ext: f.ext, onInput: (v, x) => { f.phone = v; f.ext = x; check(pg, ok()); } }),
        ui.inputRow({ label: 'Email', type: 'email', caps: 'off', placeholder: 'name@company.com', value: f.email, onInput: v => { f.email = v; check(pg, ok()); } }))) });
}
/** A master customer is billed once a month for all of its locations: each location's signed service note goes to that location's own email,
    and the combined invoice goes to the master customer's billing email. */
const isMaster = c => c.billingMode === 'serviceNote';
const noteEmailOf = (c, l) => (l && l.noteEmail) || (c.contacts[0] || {}).email || '';
function locationsSection(c) {
  const master = isMaster(c), many = c.locations.length > 1;
  return ui.section({ header: master ? 'Locations under this master customer · ' + c.locations.length : many ? 'Service locations · ' + c.locations.length : 'Service locations',
      footer: master ? 'Each location is serviced and signed for on its own, and its service note is emailed to that location. One combined invoice a month goes to ' + (c.billingEmail || 'the billing email (add one under Edit)') + '.' : many ? 'To send this customer one combined invoice a month, set Billing to “Service note, monthly master invoice” under Edit.' : null },
    c.locations.map(l => ui.row({ icon: 'mappin', iconColor: q.routeColor(c.route), title: l.label, subtitle: [l.address.replace(/, Lakemont$/, '') + (l.containers ? ' · ' + l.containers : ''), master && h('span', { style: l.noteEmail ? null : 'color:var(--orange)' }, l.noteEmail ? 'Service note to ' + l.noteEmail : 'No email for this location · note goes to ' + (noteEmailOf(c, l) || 'nobody'))].filter(Boolean).map(x => h('div', x)), chevron: true, onTap: () => WD.nav.push(locationPage(c.id, l.id)) })),
    WD.can('crm.edit') && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: master ? 'Add a location (sub-customer)' : 'Add a location', tint: true, onTap: () => editLocation(c.id, null) }));
}
function locationPage(cid, lid) {
  const find = () => { const c = q.customer(cid); return c && c.locations.find(l => l.id === lid); };
  return { title: () => (find() || {}).label || 'Location', trailing: () => WD.can('crm.edit') && find() ? [{ label: 'Edit', onTap: () => editLocation(cid, lid) }] : [],
    render: () => { const l = find(), c = q.customer(cid); if (!l) return ui.empty({ icon: 'mappin', title: 'Location removed' });
      return ui.list(ui.section('Address', ui.row({ title: l.address, subtitle: l.located === false ? 'Not located on the map yet' : 'Located', icon: 'mappin', iconColor: q.routeColor(c.route) }), ui.row({ title: 'Directions', tint: true, onTap: () => WD.workflow.openDirections({ title: l.label }) })),
        ui.section({ header: 'Service notes', footer: isMaster(c) ? 'After each visit the signed service note is emailed here. The monthly combined invoice goes to ' + (c.billingEmail || 'the master customer’s billing email') + ', not to this location.' : 'Used when this customer is billed by service note with one combined monthly invoice.' },
          ui.row({ title: 'Site contact', detail: l.contactName || '—' }), ui.row({ title: 'Service note email', detail: l.noteEmail || (noteEmailOf(c, l) ? noteEmailOf(c, l) + ' (main contact)' : '—') })),
        ui.section('Service', ui.row({ title: 'Containers', detail: l.containers || '—' }), ui.row({ title: 'Business hours', detail: l.bizOpen ? fmt.time(fmt.fromHHMM(l.bizOpen)) + ' – ' + fmt.time(fmt.fromHHMM(l.bizClose)) : '—' }), ui.row({ title: 'Route', detail: q.routeName(c.route) })),
        ui.section({ header: 'Access notes', footer: 'Drivers see these notes on every job at this location.' }, h('div.cu-block', l.notes || 'No access notes.'))); } };
}
function editLocation(cid, lid) {
  const c = q.customer(cid), first0 = c.locations[0] || {}, isNew = !lid, l = isNew ? { id: cid + 'l' + Date.now().toString(36), label: '', address: '', x: Math.max(60, Math.min(940, (first0.x || 500) + 40 + c.locations.length * 23)), y: Math.max(60, Math.min(940, (first0.y || 500) - 30 + c.locations.length * 17)), containers: '', items: [], bizOpen: first0.bizOpen || '08:00', bizClose: first0.bizClose || '17:00', notes: '', lunchFrom: '', lunchUntil: '', closedDays: [], callAhead: 0, contactName: '', noteEmail: '' } : c.locations.find(x => x.id === lid);
  const f = { contactName: '', noteEmail: '', ...l }, ok = () => !!(f.label.trim() && f.address.trim());
  ui.sheet({ title: isNew ? 'New location' : 'Edit location', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: isNew ? 'Add' : 'Save', bold: true, disabled: !ok(), onTap: async p => { if (ok() && await ui.run('Saving location…', () => { if (f.address !== l.address) f.located = true; if (f.containers !== l.containers) f.items = WD.parseItems(f.containers); f.noteEmail = (f.noteEmail || '').trim(); f.contactName = (f.contactName || '').trim(); if (isNew && !/,/.test(f.address)) f.address = f.address.trim() + ', Lakemont'; Object.assign(l, f); if (isNew) c.locations.push(l); }, { done: isNew ? 'Location added' : 'Saved' })) p.dismiss(); } }],
    render: p => ui.list(ui.section({ footer: isNew ? 'A location is a place you service under ' + c.name + ', with its own name, address, containers and contact.' : null }, ui.inputRow({ label: 'Label', placeholder: 'Location name, e.g. Site 104 - Fresno', value: f.label, onInput: v => { f.label = v; check(p, ok()); } }), ui.inputRow({ label: 'Address', value: f.address, onInput: v => { f.address = v; check(p, ok()); } }), ui.inputRow({ label: 'Containers', placeholder: '2 consoles', value: f.containers, onInput: v => { f.containers = v; } })),
      ui.section({ header: 'Service notes', footer: isMaster(c) ? 'The signed service note for each visit here is emailed to this address. The monthly combined invoice goes to ' + (c.billingEmail || 'the master customer’s billing email') + '.' : 'Used when the customer is billed by service note with one combined monthly invoice.' },
        ui.inputRow({ label: 'Site contact', placeholder: 'Who signs here', caps: 'words', value: f.contactName, onInput: v => { f.contactName = v; } }), ui.inputRow({ label: 'Note email', type: 'email', caps: 'off', placeholder: 'This location’s own email', value: f.noteEmail, onInput: v => { f.noteEmail = v; } })),
      ui.section('Business hours', ui.timeRow({ title: 'Opens', value: f.bizOpen, onChange: v => { f.bizOpen = v; } }), ui.timeRow({ title: 'Closes', value: f.bizClose, onChange: v => { f.bizClose = v; } })),
      ui.section('Access notes', ui.inputRow({ placeholder: 'Gate codes, where to park, who to ask for', multiline: true, value: f.notes, onInput: v => { f.notes = v; } }))) });
}
const statusBadge = j => { const s = WD.jobStatuses[j.status] || WD.jobStatuses.scheduled; return ui.badge(s.title, s.color); };
const jobRow = j => ui.row({ title: fmt.day(j.day, 'rel') + ' · ' + (j.allDay ? 'Note' : 'Stop ' + q.position(j).n), subtitle: h('span.cu-route', ui.dot(q.routeColor(j.routeId)), q.routeName(j.routeId) + ' · ' + q.jobType(j.type).title), badge: statusBadge(j), chevron: true, onTap: () => openJob(j.id) });
function jobsSections(c) {
  const jobs = q.jobsForCustomer(c.id), up = jobs.filter(isUpcoming), past = jobs.filter(j => !isUpcoming(j)).reverse();
  if (!jobs.length) return ui.section('Jobs', ui.row({ title: 'No jobs yet' }), WD.can('jobs.edit') && ui.row({ title: 'New job', tint: true, onTap: () => newJob(c.id) }));
  return [up.length ? ui.section('Upcoming jobs', up.slice(0, 3).map(jobRow)) : null,
    ui.section('Recent jobs', past.slice(0, 3).map(jobRow), !past.length && ui.row({ title: 'No completed jobs yet' }), ui.row({ title: 'All jobs', detail: String(jobs.length), chevron: true, onTap: () => WD.nav.push(allJobsPage(c.id)) })),
    WD.eta && WD.eta.custSection(c)];
}
const allJobsPage = cid => ({ title: 'All jobs', render: () => { const jobs = q.jobsForCustomer(cid);
  return ui.list(ui.section('Upcoming', jobs.filter(isUpcoming).map(jobRow)), ui.section({ header: 'Past', footer: 'Jobs loaded on this iPhone. Older history is on the server.' }, jobs.filter(j => !isUpcoming(j)).reverse().map(jobRow))); } });

/* ---------- Billing ---------- */
const INV_COLOR = { Paid: 'var(--green)', Sent: 'var(--blue)', Overdue: 'var(--red)', Draft: 'var(--gray)', 'Bad debt': 'var(--purple)', Void: 'var(--gray)' };
/** Still owed: not paid, and not written off as bad debt or voided. */
const stillOwed = i => i.status !== 'Paid' && !(WD.invClosed && WD.invClosed(i));
const invStatus = inv => WD.rc && WD.rc.invStatus ? WD.rc.invStatus(inv) : inv.status;
const invRow = inv => ui.row({ icon: 'doc.text', iconColor: 'var(--brown)', title: fmt.day(inv.day, 'md') + ', ' + inv.day.slice(0, 4), subtitle: inv.number + (inv.auto ? ' · Auto-charged' : ''), badge: ui.badge(invStatus(inv), INV_COLOR[invStatus(inv)] || 'var(--orange)'), detail: fmt.money(inv.amount), chevron: true, onTap: () => WD.nav.push(invoicePage(inv.id)) });
/** A customer's invoices, all of them or only the unpaid ones. */
function custInvoices(cid, unpaid) {
  const st = { unpaid: !!unpaid };
  return { title: 'Invoices', render: page => { const c = q.customer(cid), all = invoicesFor(cid), open = all.filter(stillOwed), list = st.unpaid ? open : all, sum = open.reduce((s, i) => s + i.amount, 0);
    return [h('div.cu-seg', ui.segmented([{ value: false, label: 'All · ' + all.length }, { value: true, label: 'Unpaid · ' + open.length }], st.unpaid, v => { st.unpaid = v; page.refresh(); })),
      ui.list(list.length ? ui.section({ header: (c ? c.name : '') + (sum ? ' · ' + fmt.money(sum) + ' unpaid' : ''), fold: false, footer: 'Newest first. Tap an invoice to open it, send a reminder or record a payment.' }, list.map(invRow))
        : ui.empty({ icon: 'doc.text', title: st.unpaid ? 'Nothing unpaid' : 'No invoices yet', text: st.unpaid ? 'Every invoice for this customer is paid.' : 'The first invoice marks this customer successful.' }))]; } };
}
function billingSection(c) {
  const invs = invoicesFor(c.id), open = invs.filter(stillOwed).reduce((s, i) => s + i.amount, 0), M = WD.money || {}, st = WD.rc && WD.rc.openStatement, ap = M.autopayText && M.autopayText(c);
  /* The footer names where invoices are created: built in, or the bookkeeping program chosen in Settings → Company → Invoicing. */
  return [ui.section({ header: 'Invoices', footer: (open ? fmt.money(open) + ' open · ' : '') + (M.sourceText ? M.sourceText() : 'Synced from Invoice Ninja') }, invs.length ? invs.slice(0, 4).map(invRow) : ui.row({ title: 'No invoices yet', subtitle: 'The first invoice marks this customer successful.' }),
    invs.length > 4 && ui.row({ title: 'All invoices', detail: String(invs.length), chevron: true, onTap: () => WD.nav.push(custInvoices(c.id, false)) }),
    WD.rc && WD.rc.newInvoice && WD.can('billing.manage') && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New invoice', tint: true, onTap: () => WD.rc.newInvoice(c.id) })),
    st && ui.section({ header: 'Statements', fold: false, footer: 'A statement of everything lists paid invoices too, with each payment, so the customer can compare it with their own records.' },
      ui.row({ icon: 'envelope', iconPlain: true, title: 'Send statement · unpaid invoices only', subtitle: open ? 'Every unpaid invoice on one page, with the invoices attached if you like' : 'Nothing is unpaid right now', tint: true, onTap: () => WD.rc.openStatement(c) }),
      ui.row({ icon: 'doc.text', iconPlain: true, title: 'Send statement · all invoices', subtitle: 'Paid and unpaid, to find a discrepancy', tint: true, onTap: () => WD.rc.openStatement(c, { all: true }) })),
    M.portalSpec && WD.can('billing.view') && ui.section({ header: 'Customer portal and autopay', fold: false, footer: 'The portal is where the customer sees invoices, pays, saves a card or bank account and turns on autopay. They open it from the button in every invoice email.' },
      ui.row({ icon: 'creditcard', iconColor: ap ? 'var(--green)' : 'var(--gray)', title: ap ? 'Autopay on · ' + ap : 'Autopay is off', subtitle: ap ? 'Each new invoice is charged automatically on its due date' : 'The customer turns it on in the portal' }),
      ui.row({ icon: 'arrow.up.right', iconPlain: true, title: 'Open the customer portal (preview)', subtitle: 'What ' + ((c.contacts[0] || {}).name || 'the customer') + ' sees', tint: true, chevron: true, onTap: () => WD.nav.push(M.portalSpec(c.id)) }))];
}
function pay(inv, method) {
  const c = q.customer(inv.customerId), j = inv.jobId && q.job(inv.jobId);
  if (inv.status === 'Overdue') c.stats.balance = Math.max(0, c.stats.balance - inv.amount);
  c.stats.paid += inv.amount; inv.status = 'Paid'; if (j && j.invoice) j.invoice.status = 'Paid';
  addPayment(inv, +WD.now(), method);
}
function invoicePage(invId) {
  return { title: 'Invoice',
    render: () => {
      const inv = data.invoices.find(x => x.id === invId); if (!inv || !(WD.can('billing.view') || WD.can('billing.field'))) return ui.empty({ icon: 'lock', title: 'Billing is hidden', text: 'You need billing access to see invoices.' });
      const c = q.customer(inv.customerId), lines = linesFor(inv), pays = data.payments.filter(p => p.invoiceId === inv.id);
      return [h('div.cu-head', c && h('div.title3', { style: 'font-weight:700' }, c.name), h('div.headline', { style: 'margin:2px 0 6px' }, longDate(inv.day)), h('div.cu-amount', fmt.money(inv.amount, true)), ui.badge(invStatus(inv), INV_COLOR[invStatus(inv)] || 'var(--orange)'), h('div.footnote', inv.number + (stillOwed(inv) ? ' · Due ' + fmt.day(D.add(inv.day, 30), 'md') : '')), stillOwed(inv) && inv.status !== 'Draft' && WD.money && WD.money.autopayNote && WD.money.autopayNote(inv)),
        WD.rc && WD.rc.closedNote && WD.rc.closedNote(inv),
        ui.list(ui.section({ header: 'Lines', footer: 'Prices from the price book.' }, lines.map(l => ui.row({ title: l.name, subtitle: l.qty + ' × ' + fmt.money(l.rate, true), detail: fmt.money(l.qty * l.rate, true) })), ui.row({ title: h('b', 'Total'), detail: h('b', fmt.money(inv.amount, true)) })),
          ui.section('Payments', pays.length ? pays.map(p => ui.row({ icon: 'creditcard', iconColor: 'var(--pink)', title: p.method, subtitle: whenFull(p.at), detail: fmt.money(p.amount, true) })) : ui.row({ title: 'No payments yet' })),
          WD.r9 && WD.r9.revisionSection(inv),
          WD.rc && WD.rc.closeLogSection && WD.rc.closeLogSection(inv),
          inv.jobId && q.job(inv.jobId) && ui.section('Job', jobRow(q.job(inv.jobId))),
          inv.master && ui.section(null, ui.row({ icon: 'tray', iconColor: 'var(--brown)', title: 'Master invoice', subtitle: 'Built from the service notes saved in the database' + (inv.po ? ' · ' + inv.po : '') })),
          ui.section(null, WD.workflow ? WD.workflow.invoiceActionRows(inv, inv.jobId && q.job(inv.jobId)) : null))];
    } };
}

/* ---------- Follow-ups, timeline, attribution, details ---------- */
function tasksSection(c, edit) {
  const list = openTasks(c.id).concat(data.tasks.filter(t => t.customerId === c.id && R.justDone === t.id && t.done));
  return ui.section('Follow-ups', list.map(t => taskRow(t, false)), !list.length && !edit && ui.row({ title: 'No open follow-ups' }),
    edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add follow-up', tint: true, onTap: () => newTask(c.id) }));
}
function timelineSection(c, st, page, edit) {
  const f = FILTERS.find(x => x[0] === st.filter), all = timeline(c.id).filter(f[2]), shown = st.showAll ? all : all.slice(0, 10);
  const head = h('div.cu-sechead', h('span', 'Timeline'), h('button.cu-link', { onclick: e => ui.menu(e.currentTarget, FILTERS.map(([v, label]) => ({ label, checked: st.filter === v, onTap: () => { st.filter = v; st.showAll = false; page.refresh(); } }))) }, f[1], icon('chevron.down', 13)));
  return [st.filter === 'all' && WD.x.contactSummary(c, timeline(c.id), describe) && h('div', { style: 'margin-top:22px' }, WD.x.contactSummary(c, timeline(c.id), describe)), ui.section({ header: head, footer: 'Calls, voicemails and texts from Quo, email from Gmail, forms and the leads sheet, jobs, invoices and notes.' },
    edit && ui.row({ icon: 'square.and.pencil', iconPlain: true, title: 'Add note', tint: true, onTap: () => addNote(c.id) }),
    shown.map(tlRow), !all.length && ui.row({ title: 'Nothing here yet' }),
    all.length > shown.length && ui.row({ title: 'Show all ' + all.length, tint: true, center: true, onTap: () => { st.showAll = true; page.refresh(); } }))];
}
function attributionSection(c) {
  const t = data.touches.filter(x => x.customerId === c.id).sort((a, b) => a.at - b.at); if (!t.length) return null;
  const row = (x, k) => ui.row({ icon: k ? 'arrow.right' : 'flag', iconColor: k ? 'var(--gray)' : 'var(--orange)', title: (k ? '' : 'First touch · ') + x.channel, subtitle: [x.kind, x.campaign, x.landing !== '—' ? x.landing : null].filter(Boolean).join(' · '), detail: fmt.day(D.key(new Date(x.at)), 'md') });
  return ui.section({ header: 'Attribution', footer: 'The first touch sets the acquisition channel. Later touches are kept for reporting.' }, t.map(row));
}
function detailsSection(c) {
  return ui.section('Details', ui.row({ title: 'Owner', detail: staff(c.owner) }), PIPE.includes(c.lifecycle) && c.lifecycle !== 'lost' && ui.row({ title: 'Next action', detail: nextLabel(c) }),
    c.lostReason && c.lifecycle === 'lost' && ui.row({ title: 'Lost reason', detail: c.lostReason }), ui.row({ title: 'Customer type', detail: WD.custType(c.custType).title }), ui.row({ title: 'Default job type', detail: q.jobType(c.type).title }), ui.row({ title: 'Frequency', detail: c.freq }),
    ui.row({ title: 'Route', detail: q.routeName(c.route) }),
    c.billingEmail && ui.row({ title: 'Billing email', detail: c.billingEmail }), c.po && ui.row({ title: 'PO number', detail: c.po }), c.contract && ui.row({ title: 'Contract', detail: c.contract }),
    ui.row({ title: 'Customer signature', detail: (WD.SIG_POLICIES.find(x => x.value === WD.sigPolicy(c)) || {}).label }), c.scanContainers && ui.row({ title: 'Container barcodes', detail: 'Scanned every visit' }), ui.row({ title: 'Billing', subtitle: c.billingMode === 'serviceNote' ? 'Master customer: one combined invoice a month to ' + (c.billingEmail || 'the billing email') + '; each location gets its own service note' : null, detail: c.billingMode === 'serviceNote' ? 'Monthly master invoice' : 'Invoice each visit' }), c.tags.length && h('div.row', h('div.cu-tags', c.tags.map(t => ui.badge(t, 'var(--indigo)')))), h('div.cu-block', c.notes || h('span.secondary', 'No notes')));
}
function addNote(cid) {
  let text = '';
  ui.sheet({ title: 'New note', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Save', bold: true, disabled: !text.trim(), onTap: async p => { if (text.trim() && await ui.run('Saving note…', () => { addI({ customerId: cid, type: 'note', at: +WD.now(), text: text.trim(), by: me() }); }, { done: 'Note saved' })) p.dismiss(); } }],
    render: p => ui.list(ui.section({ footer: 'Notes are visible to everyone with customer access.' }, ui.inputRow({ placeholder: 'What happened?', multiline: true, autofocus: true, value: text, onInput: v => { text = v; check(p, !!text.trim()); } }))) }, { detent: 'medium' });
}
function editCustomer(id) {
  const poSt = { multi: false }, c = q.customer(id), f = { name: c.name, custType: c.custType || 'business', lifecycle: c.lifecycle, owner: c.owner, type: c.type, freq: c.freq, notes: c.notes, tags: c.tags.join(', '), billingEmail: c.billingEmail || '', po: c.po || '', contract: c.contract || '', sig: WD.sigPolicy(c), mode: c.billingMode || 'invoice', scan: !!c.scanContainers }, ok = () => !!f.name.trim();
  const pickers = p => [['Customer type', 'custType', custTypeOptions(c.custType)], ['Stage', 'lifecycle', Object.keys(LC).map(k => ({ value: k, label: LC[k][0] }))],
    ['Owner', 'owner', owners().map(u => ({ value: u.id, label: u.name }))], ['Default job type', 'type', WD.jobTypes.map(t => ({ value: t.id, label: t.title }))], ['Frequency', 'freq', FREQS]]
    .map(([title, k, options]) => ui.pickerRow({ title, options, value: f[k], onChange: v => { f[k] = v; p.refresh(); } }));
  ui.sheet({ title: 'Edit customer', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Save', bold: true, disabled: !ok(), onTap: async p => { if (ok() && await ui.run('Saving…', () => {
      Object.assign(c, { name: f.name.trim(), custType: f.custType, kind: f.custType === 'residential' ? 'household' : 'company', lifecycle: f.lifecycle, owner: f.owner, type: f.type, freq: f.freq, notes: f.notes.trim(), tags: f.tags.split(',').map(t => t.trim()).filter(Boolean), billingEmail: f.billingEmail.trim(), po: f.po.trim(), contract: f.contract.trim(), signature: f.sig, billingMode: f.mode, scanContainers: f.scan });
      data.jobs.forEach(j => { if (j.customerId === c.id && j.status === 'scheduled' && !j.invoice) { j.po = c.po; j.contract = c.contract; } }); if (c.lifecycle !== 'lost') c.lostReason = null; }, { done: 'Saved' })) p.dismiss(); } }],
    render: p => ui.list(ui.section(null, ui.inputRow({ label: 'Name', value: f.name, onInput: v => { f.name = v; check(p, ok()); } })), ui.section(null, pickers(p)),
      ui.section({ header: 'Billing', footer: 'PO and contract numbers print on every invoice and copy to upcoming jobs, where they can be changed per job.' },
        ui.inputRow({ label: 'Billing email', type: 'email', caps: 'off', placeholder: 'If different from the contact', value: f.billingEmail, onInput: v => { f.billingEmail = v; } }),
        WD.x.poRows({ st: poSt, getPO: () => f.po, setPO: v => { f.po = v; }, schedule: c.poSchedule, docs: c.documents, refresh: () => { blur(); p.refresh(); } }), ui.inputRow({ label: 'Contract', placeholder: 'None', value: f.contract, onInput: v => { f.contract = v; } }),
        ui.pickerRow({ title: 'Customer signature', options: WD.SIG_POLICIES, value: f.sig, onChange: v => { f.sig = v; p.refresh(); } }),
        ui.pickerRow({ title: 'Billing', options: WD.workflow.BILLING_MODES, value: f.mode, onChange: v => { f.mode = v; if (v === 'serviceNote') f.sig = 'always'; p.refresh(); } }),
        f.mode === 'serviceNote' && h('div.row', h('div.row-main', h('div.row-title', 'Master customer'), h('div.row-sub', 'No invoice after each visit. Every location’s signed service note is emailed to that location’s own email (set on each location), and one combined invoice a month goes to the billing email above' + (f.billingEmail.trim() ? '' : ' — add one') + '. ' + c.locations.length + (c.locations.length === 1 ? ' location' : ' locations') + ' so far; add more from the customer’s page.'))),
        ui.row({ title: 'Documents and POs', detail: String(c.documents.length + c.poSchedule.length), chevron: true, onTap: () => { p.dismiss(); setTimeout(() => WD.nav.push(WD.workflow.poScheduleSpec(c)), 420); } })),
      ui.section({ header: 'At the job', footer: f.scan ? 'The driver scans the barcode on each of this customer’s containers at every visit, before the invoice or service note. Anything not scanned needs a reason.' : 'Switch on for a customer who requires proof that each container was serviced.' },
        ui.toggleRow({ icon: 'barcode', iconColor: 'var(--indigo)', title: 'Scan container barcodes', subtitle: 'Required by this customer', value: f.scan, onChange: v => { f.scan = v; p.refresh(); } })),
      ui.section({ header: 'Tags', footer: 'Separate tags with commas.' }, ui.inputRow({ placeholder: 'Medical, Tax season', value: f.tags, onInput: v => { f.tags = v; } })),
      ui.section('Notes', ui.inputRow({ placeholder: 'Notes about this customer', multiline: true, value: f.notes, onInput: v => { f.notes = v; } }))) });
}

/* ================= Timeline entry pages ================= */
function callPage(i) {
  const st = { playing: false, pos: 0, timer: null, refs: null }, vm = i.type === 'voicemail';
  const sync = () => { const r = st.refs; if (!r) return; r.fill.style.width = (st.pos / i.duration * 100) + '%'; r.time.textContent = mmss(st.pos) + ' / ' + mmss(i.duration); r.btn.replaceChildren(icon(st.playing ? 'pause' : 'play.fill', 18)); };
  const stop = () => { st.playing = false; clearInterval(st.timer); };
  const toggle = () => { if (st.playing) stop(); else { if (st.pos >= i.duration) st.pos = 0; st.playing = true; st.timer = setInterval(() => { st.pos = Math.min(i.duration, st.pos + 0.2); if (st.pos >= i.duration) stop(); sync(); }, 200); } sync(); };
  return { title: vm ? 'Voicemail' : i.dir === 'in' ? 'Incoming call' : 'Outgoing call', onClose: stop,
    render: () => {
      const fillEl = h('i'), track = h('div.cu-track', { onclick: e => { st.pos = Math.max(0, Math.min(1, ui.localPoint(e, track).x / track.offsetWidth)) * i.duration; sync(); } }, fillEl);
      st.refs = { fill: fillEl, time: h('span.cu-ptime'), btn: h('button.cu-play', { 'aria-label': 'Play recording', onclick: toggle }) }; sync();
      return ui.list(ui.section({ header: vm ? 'Recording' : 'Call recording', footer: 'Recorded by Quo. Callers hear a recording notice.' }, h('div.cu-player', st.refs.btn, track, st.refs.time)),
        ui.section(null, ui.row({ title: vm ? 'From' : i.dir === 'in' ? 'Caller' : 'Called', detail: i.contact }), ui.row({ title: 'Number', detail: fmt.phone(i.number) }),
          ui.row({ title: 'Tracking line', subtitle: i.line.channel === 'Main' ? 'Main business number' : 'Attributes the call to ' + i.line.channel, detail: fmt.phone(i.line.number) }),
          ui.row({ title: 'When', detail: whenFull(i.at) }), ui.row({ title: 'Duration', detail: mmss(i.duration) }), !vm && ui.row({ title: i.dir === 'in' ? 'Answered by' : 'Called by', detail: i.by })),
        ui.section({ header: h('span.cu-ai', icon('sparkles', 14), ' Summary') }, h('div.cu-block', i.summary)),
        i.transcript.length ? ui.section('Transcript', h('div.cu-block.cu-transcript', i.transcript.map(([who, t]) => h('p', h('b', who), t)))) : null);
    } };
}
const latestThread = cid => data.interactions.filter(i => i.customerId === cid && i.type === 'text').sort((a, b) => b.at - a.at)[0] || null;
function threadPage(cid, thread) {
  const c = q.customer(cid), p = c.contacts.find(x => x.phone) || { name: c.name, phone: '' };
  let draft = ''; const input = h('input.cu-compose-in', { type: 'text', placeholder: 'Text message', oninput: e => { draft = e.target.value; send.disabled = !draft.trim(); }, onkeydown: e => { if (e.key === 'Enter') go(); } });
  const send = h('button.cu-send', { 'aria-label': 'Send', disabled: true, onclick: () => go() }, icon('arrow.up.circle.fill', 32));
  const composer = h('div.cu-composer', input, send);
  let page = null;
  const scrollEnd = () => { if (page) page.body.scrollTop = page.body.scrollHeight; };
  async function go() {
    const text = draft.trim(); if (!text) return;
    if (WD.state.offline) return ui.run('', null);
    if (!thread) thread = addI({ customerId: cid, type: 'text', at: +WD.now(), contact: p.name, number: p.phone, line: lineFor('Main'), messages: [] });
    const m = { dir: 'out', text, at: +WD.now(), by: me(), state: 'sending' }; thread.messages.push(m); thread.at = m.at;
    draft = ''; input.value = ''; send.disabled = true; page.refresh(); scrollEnd();
    await WD.delay(600, 1200); m.state = 'delivered'; page.refresh(); scrollEnd(); WD.changed();
  }
  return { title: p.name, live: false, toolbar: () => WD.can('crm.edit') ? composer : h('div.footnote', 'You can read this thread but not reply.'),
    onAppear: pg => { page = pg; scrollEnd(); },
    render: () => {
      const msgs = thread ? thread.messages : [], out = [];
      msgs.forEach((m, k) => { if (!k || m.at - msgs[k - 1].at > 3600e3) out.push(h('div.cu-stamp', whenFull(m.at))); out.push(h('div.cu-bub.' + m.dir, m.text)); });
      const last = msgs[msgs.length - 1];
      if (last && last.dir === 'out') out.push(h('div.cu-status', last.state === 'sending' ? 'Sending…' : 'Delivered'));
      return h('div.cu-thread', h('div.cu-thread-head', fmt.phone(p.phone) + ' · from the main line ' + fmt.phone(MAIN)), out.length ? out : h('div.cu-stamp', 'No messages yet'));
    } };
}
const emailPage = i => ({ title: 'Email', render: () => ui.list(ui.section(null, h('div.cu-block', h('div.headline', i.subject), h('div.footnote', whenFull(i.at)))),
  ui.section(null, ui.row({ title: 'From', detail: i.from }), ui.row({ title: 'To', detail: i.to || '—' })), ui.section({ header: 'Snippet', footer: 'Only the subject and snippet are stored. The full message stays in Gmail.' }, h('div.cu-block', i.snippet)),
  ui.section(null, ui.row({ title: 'Open thread in Gmail', tint: true, icon: 'arrow.up.right', iconPlain: true, onTap: () => ui.toast('Opening Gmail…', 'envelope') }))) });
const notePage = i => ({ title: 'Note', render: () => ui.list(ui.section({ footer: i.by + ' · ' + whenFull(i.at) }, h('div.cu-block', i.text))) });
const formPage = i => ({ title: i.type === 'form' ? 'Website form' : 'Leads sheet row', render: () => ui.list(
  ui.section({ header: 'Submitted', footer: i.type === 'form' ? 'Received through lead-intake from discountshred.com.' : 'Synced from the Google leads sheet, row ' + i.row + '.' }, i.fields.filter(f => f[1]).map(([k, v]) => ui.row({ title: k, subtitle: k === 'Message' || k === 'Notes' ? v : null, detail: k === 'Message' || k === 'Notes' ? null : v }))),
  i.attribution ? ui.section({ header: 'Attribution', footer: 'Captured by the site snippet in a first-party cookie.' }, i.attribution.map(([k, v]) => ui.row({ title: k, detail: v }))) : null,
  ui.section(null, ui.row({ title: 'Received', detail: whenFull(i.at) }))) });

/* ================= Calling (Quo) ================= */
const CALL_SUMMARIES = { lead: 'Followed up on the request. They want to start next month; send the service agreement.', customer: 'Confirmed the next pickup and the container count. No changes.' };
function startCall(c, p) {
  if (!p || !p.phone) return;
  ui.toast('Calling ' + first(p.name) + ' via Quo…', 'phone');
  setTimeout(() => {
    const lead = PIPE.includes(c.lifecycle);
    addI({ customerId: c.id, type: 'call', dir: 'out', at: +WD.now(), duration: 60 + Math.floor(Math.random() * 200), contact: p.name, number: p.phone, line: lineFor('Main'), by: me(), summary: CALL_SUMMARIES[lead ? 'lead' : 'customer'],
      transcript: [[me(), 'Hi ' + first(p.name) + ', it’s ' + first(me()) + ' from Discount Shred.'], [p.name, lead ? 'Thanks for calling back. We’d like to get started next month.' : 'Hi! Yes, everything is still on for the next pickup.'], [me(), 'Great, I’ll send over the details.']] });
    if (c.lifecycle === 'lead') c.lifecycle = 'contacted';
    ui.toast('Call logged to the timeline', 'checkmark'); WD.changed();
  }, 3200);
}
function simulateCall(customerId) {
  if (!WD.can('crm.view')) return ui.toast('Caller cards need customer access', 'lock');
  const unknown = customerId === null, c = unknown ? null : q.customer(customerId || 'c1') || data.customers[0];
  const p = c && (c.contacts.find(x => x.phone) || c.contacts[0]), number = unknown ? '+15125550388' : p.phone;
  let opened = false; const open = () => { if (opened) return; opened = true; banner.close(); callerCard(c, p, number); };
  const banner = ui.banner({ title: 'Incoming call', text: (c ? c.name + ', ' : 'Unknown caller, ') + fmt.phone(number), icon: 'phone.fill', color: 'var(--green)', onTap: open, when: 'Quo' });
  setTimeout(open, 1500);
}
function callerCard(c, p, number) {
  const started = Date.now(), line = c ? lineFor('Main') : lineFor('Google Ads'); let timerEl = null, ended = false;
  const tick = setInterval(() => { if (timerEl) timerEl.textContent = 'On call · ' + mmss((Date.now() - started) / 1000); }, 500), R15 = WD.r15 || {};
  /* 5.1: whatever was open is set aside as a draft, and the rest of the app knows who is on the line (r15.js). */
  R15.stashForCall && R15.stashForCall(); R15.callBegin && R15.callBegin({ dir: 'in', number, line: { label: line.channel, number: line.number }, customerId: c ? c.id : null, contact: p ? p.name : null });
  const end = () => { if (ended) return; ended = true; clearInterval(tick); R15.callEnd && R15.callEnd(); if (!c || !q.customer(c.id)) return;
    const i = addI({ customerId: c.id, type: 'call', dir: 'in', at: started, duration: Math.max(20, Math.round((Date.now() - started) / 1000)), contact: p.name, number, line, by: me(), summary: 'Transcript and summary are processing…', transcript: [] });
    setTimeout(() => { i.summary = 'Asked to confirm the next pickup and whether the driver can take a few extra boxes. Told them yes, at the per-box rate.'; i.transcript = [[p.name, 'Hi, just checking you’re still coming on the next visit?'], [me(), 'Yes, you’re on the schedule.'], [p.name, 'Can the driver take a few extra boxes?'], [me(), 'Sure, those are $8 a box.']]; WD.changed(); }, 4000); WD.changed(); };
  const leave = (sheet, fn) => { sheet.close(); setTimeout(fn, 420); };
  const sheet = ui.sheet({ title: 'Incoming call', live: false, trailing: [{ label: 'Done', bold: true, onTap: pg => pg.dismiss() }], onClose: end,
    render: pg => {
      timerEl = h('span.cu-live', 'On call · ' + mmss((Date.now() - started) / 1000));
      const head = h('div.cu-caller', c ? avatar(c, 52) : ui.avatar('?', { size: 52, icon: 'person', color: '#8E8E93' }),
        h('div', h('div.title3', c ? c.name : fmt.phone(number)), h('div.footnote', c ? p.name + (p.role ? ' · ' + p.role : '') + ' · ' + fmt.phone(number, p.ext) : 'Unknown caller · ' + line.channel + ' line'), timerEl));
      if (!c) return [head, ui.list(ui.section({ footer: 'No customer, contact or lead matches this number. Calls on the ' + line.channel + ' line are attributed to that channel.' },
        ui.row({ icon: 'person.badge.plus', iconPlain: true, title: 'Create customer', tint: true, onTap: () => leave(sheet, () => openNew({ phone: fmt.phone(number), channel: line.channel })) }),
        ui.row({ icon: 'person.2', iconPlain: true, title: 'Add to existing customer', tint: true, onTap: () => pickCustomer(pg, 'Add to customer', id => setTimeout(async () => {
          const target = q.customer(id); if (await ui.run('Adding number…', () => { target.contacts.push({ name: 'Caller ' + fmt.phone(number), role: '', phone: number, email: '' }); }, { done: 'Number added' })) leave(sheet, () => { WD.nav.switchTab('customers'); openDetail(id); });
        }, 450)) })))];
      const up = q.jobsForCustomer(c.id).filter(isUpcoming).slice(0, 2);
      return [head, h('div.cu-btns', ui.button('Open customer', { kind: 'tinted', small: true, block: false, onTap: () => leave(sheet, () => { WD.nav.switchTab('customers'); openDetail(c.id); }) }),
          ui.button('New job', { kind: 'tinted', small: true, block: false, disabled: !WD.can('jobs.edit'), onTap: () => leave(sheet, () => newJob(c.id)) }), WD.can('crm.edit') && ui.button('Add note', { kind: 'tinted', small: true, block: false, onTap: () => addNote(c.id) })),
        WD.badDebtBanner && WD.badDebtBanner(c.id),
        R15.callBrief && R15.callBrief(c, { number, incoming: true }),
        WD.x.contactSummary(c, timeline(c.id), describe),
        ui.list(ui.section(null, ui.row({ title: 'Last service', detail: c.stats.lastService ? fmt.day(c.stats.lastService, 'rel') : 'Never' }), WD.can('billing.view') && ui.row({ title: 'Balance', detail: h('span', { style: { color: owedBy(c) > 0 ? 'var(--red)' : null } }, fmt.money(owedBy(c))) }), ui.row({ title: 'Stage', trailing: lcBadge(c) })),
          ui.section('Open and upcoming jobs', up.length ? up.map(jobRow) : ui.row({ title: 'Nothing scheduled' })), ui.section({ header: 'Recent history', footer: WD.can('comms.view') ? 'Tap a call to read its transcript and summary.' : null }, timeline(c.id).slice(0, 4).map(tlRow)))];
    } }, { detent: 'medium' });
}

/* ================= New customer ================= */
function openNew(prefill = {}) {
  if (!WD.can('crm.edit')) return ui.toast('You can’t add customers with this role', 'lock');
  const poSt = { multi: false }, f = { name: prefill.name || '', custType: 'business', agreement: false, ext: '', contact: '', phone: prefill.phone ? fmt.phone(prefill.phone) : '', email: prefill.email || '', billingEmail: '', po: '', contract: '', sig: 'optional', mode: 'invoice', documents: [], poSchedule: [], address: prefill.address || '', containers: '', type: 'regular', channel: prefill.channel || '' };
  /* Name and phone are always required (so calls and texts match). Anything else required comes from Settings → Job types and fields,
     by default job type and by customer type — for example email for government customers. */
  const req = k => k === 'phone' || WD.requires(f.type, f.custType, k);
  const filled = { contact: () => f.contact.trim(), phone: () => fmt.phoneValid(f.phone), email: () => /\S+@\S+\.\S+/.test(f.email), billingEmail: () => f.billingEmail.trim(), address: () => f.address.trim(), items: () => f.containers.trim(), po: () => f.po.trim() || f.poSchedule.length, contract: () => f.contract.trim() };
  const ok = () => !!(f.name.trim() && Object.keys(filled).every(k => !req(k) || filled[k]()));
  let dupBox = null, dupTimer = null;
  const dupes = () => { const out = new Map(), d = f.phone.replace(/\D/g, '');
    q.searchCustomers(f.name).filter(r => r.score >= 80).forEach(r => out.set(r.customer.id, { c: r.customer, why: 'Similar name' }));
    if (d.length >= 7) q.searchCustomers(d).filter(r => r.score === 75).forEach(r => out.set(r.customer.id, { c: r.customer, why: 'Same phone · ' + r.match }));
    if (/@/.test(f.email)) q.searchCustomers(f.email).filter(r => r.score === 60).forEach(r => out.set(r.customer.id, { c: r.customer, why: 'Same email' }));
    return [...out.values()].slice(0, 3); };
  const drawDupes = sheet => { if (!dupBox) return; const list = dupes();
    const sec = list.length ? ui.section({ header: 'Possible duplicates', footer: 'Open the existing record instead of creating a second one.' }, list.map(x => ui.row({ class: 'cu-crow', leading: avatar(x.c, 30), title: x.c.name, subtitle: x.why, trailing: ui.button('Open', { kind: 'gray', small: true, block: false, onTap: () => { sheet.close(); setTimeout(() => openDetail(x.c.id), 420); } }) }))) : null;
    dupBox.replaceChildren(...[sec].filter(Boolean)); };
  const changed = (page, sheet) => { check(page, ok()); clearTimeout(dupTimer); if (dupBox && (f.name.trim().length >= 2 || f.phone.replace(/\D/g, '').length >= 7)) { dupBox.replaceChildren(h('div.cu-loading.small', ui.spinner(14), 'Checking for duplicates…')); dupTimer = setTimeout(() => drawDupes(sheet), 300); } else if (dupBox) dupBox.replaceChildren(); };
  const sheet = ui.sheet({ title: 'New customer', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Save', bold: true, disabled: !ok(), onTap: async p => {
      if (!ok()) return; let id = null;
      if (!await ui.run('Creating customer…', () => { id = create(f); }, { done: 'Customer created' })) return;
      p.dismiss(); setTimeout(() => { openDetail(id); if (f.agreement && q.customer(id)) WD.nav.push(WD.x.agreementSpec(WD.x.createAgreement(q.customer(id)))); }, 420); } }],
    onClose: () => clearTimeout(dupTimer),
    render: p => { dupBox = h('div'); const sugBox = h('div'); const inp = (label, k, o = {}) => ui.inputRow({ label, value: f[k], onInput: v => { f[k] = v; changed(p, sheet); }, ...o });
      /* Service address suggestions from Apple Maps (simulated), same as the job editor. Typed text is kept if nothing matches. */
      const suggest = text => { const items = WD.addressSuggestions ? WD.addressSuggestions(text) : []; f.located = false;
        sugBox.replaceChildren(items.length ? h('div.cells', { style: 'margin:8px 16px 0;border-radius:10px;overflow:hidden' }, items.map(x => ui.row({ icon: x.typed ? 'pencil' : 'mappin', iconPlain: true, iconColor: x.typed ? 'var(--label2)' : 'var(--red)', title: x.title, subtitle: x.sub,
          onTap: () => { f.address = x.address; f.located = !x.typed; f.x = x.l && x.l.x; f.y = x.l && x.l.y; sugBox.replaceChildren(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); p.refresh(); check(p, ok()); } }))) : ''); };
      const out = ui.list(
        ui.section({ footer: 'Fields in red are required. What’s required depends on the customer type and job type.' }, inp('Name', 'name', { placeholder: 'Company or person', autofocus: !f.name, required: true }), ui.pickerRow({ title: 'Customer type', options: custTypeOptions(f.custType), value: f.custType, onChange: v => { f.custType = v; p.refresh(); check(p, ok()); } }),
          ui.pickerRow({ title: 'Default job type', options: WD.jobTypes.map(t => ({ value: t.id, label: t.title })), value: f.type, onChange: v => { f.type = v; p.refresh(); check(p, ok()); } })),
        ui.section({ header: 'Primary contact', footer: 'Phone is always required so calls and texts match this customer: 10 digits, with an extension if there is one.' + (req('email') ? ' Email is required for ' + WD.custType(f.custType).title.toLowerCase() + ' customers.' : ' Email is strongly recommended — invoices and receipts go there.') }, inp('Contact name', 'contact', { placeholder: 'Name', caps: 'words', required: req('contact') }), ui.phoneRow({ value: f.phone, ext: f.ext, required: true, onInput: (v, x) => { f.phone = v; f.ext = x; changed(p, sheet); } }), inp('Email', 'email', { type: 'email', caps: 'off', placeholder: req('email') ? 'Required' : 'Recommended', required: req('email'), suggested: !req('email') })),
        dupBox,
        ui.section({ header: 'Service address', footer: f.located ? 'Found on the map.' : 'Start typing and pick a suggestion, or keep the address as typed.' }, ui.inputRow({ label: 'Address', placeholder: 'Street, city', value: f.address, required: req('address'), icon: f.located ? 'mappin' : null, iconColor: 'var(--red)', onInput: v => { f.address = v; changed(p, sheet); suggest(v); } }), WD.asks(f.type, 'items') && inp('Containers', 'containers', { placeholder: '2 consoles, 1 bin (96 gal)' })),
        sugBox,
        (WD.asks(f.type, 'billingEmail') || WD.asks(f.type, 'po') || WD.asks(f.type, 'contract')) && ui.section({ header: 'Billing', footer: 'Printed on invoices. PO and contract numbers can be changed on each job.' },
          WD.asks(f.type, 'billingEmail') && inp('Billing email', 'billingEmail', { type: 'email', caps: 'off', placeholder: 'If different', required: req('billingEmail') }), WD.asks(f.type, 'po') && WD.x.poRows({ st: poSt, getPO: () => f.po, setPO: v => { f.po = v; changed(p, sheet); }, schedule: f.poSchedule, docs: f.documents, required: req('po'), refresh: () => { blur(); p.refresh(); check(p, ok()); } }), WD.asks(f.type, 'contract') && inp('Contract', 'contract', { placeholder: 'None', required: req('contract') }),
          WD.asks(f.type, 'signature') && ui.pickerRow({ title: 'Customer signature', options: WD.SIG_POLICIES, value: f.sig, onChange: v => { f.sig = v; p.refresh(); } }),
          ui.pickerRow({ title: 'Billing', options: WD.workflow.BILLING_MODES, value: f.mode, onChange: v => { f.mode = v; if (v === 'serviceNote') f.sig = 'always'; p.refresh(); } })),
        WD.workflow.docsEditor(f, p),
        WD.can('contracts.manage') && ui.section({ header: 'Service agreement', footer: 'Creates a draft agreement from this customer’s containers and pricing. After saving you can email or text a link to sign, or collect the signature in person.' }, ui.toggleRow({ title: 'Create a service agreement', value: f.agreement, onChange: v => { f.agreement = v; } })),
        ui.section(null, ui.pickerRow({ title: 'How did you hear about us?', options: CHANNELS, value: f.channel, placeholder: 'Choose', onChange: v => { f.channel = v; p.refresh(); } })));
      setTimeout(() => drawDupes(sheet), 0); return out; } });
}
function create(f) {
  const id = 'c' + (100 + data.customers.length + Math.floor(Math.random() * 900)), house = f.custType === 'residential', ch = f.channel || 'Other';
  const c = { id, name: f.name.trim(), kind: house ? 'household' : 'company', custType: f.custType, changes: [], route: null, lifecycle: 'lead', channel: ch, type: f.type, freq: f.type === 'purge' ? 'One time' : 'Every 4 weeks',
    contacts: [{ name: f.contact.trim() || f.name.trim(), role: '', phone: e164(f.phone), ext: f.ext, email: f.email.trim().toLowerCase() }],
    billingEmail: f.billingEmail.trim(), po: f.po.trim(), contract: f.contract.trim(), signature: f.sig, billingMode: f.mode, documents: f.documents.slice(), poSchedule: f.poSchedule.slice(),
    locations: [{ id: id + 'l1', items: WD.parseItems(f.containers), label: house ? 'Home' : 'Main office', address: f.address.trim() || 'Address not set', x: f.x != null ? f.x : 300 + Math.round(Math.random() * 400), y: f.y != null ? f.y : 300 + Math.round(Math.random() * 400), containers: f.containers.trim(), bizOpen: '08:00', bizClose: '17:00', notes: '', located: !!f.address.trim() }],
    owner: (WD.state.me && WD.state.me.id) || 'u3', nextAction: today, notes: '', tags: [], lostReason: null, createdAt: +WD.now(),
    stats: { jobs: 0, invoiced: 0, paid: 0, balance: 0, lastService: null, firstInvoice: null, rate: 85 }, successful: false };
  data.customers.push(c);
  data.touches.push({ customerId: id, at: +WD.now(), channel: ch, campaign: (CAMPAIGN[ch] || CAMPAIGN.Other)[0], landing: '—', kind: 'Entered by staff' });
  addI({ customerId: id, type: 'note', at: +WD.now(), text: 'Created by ' + me() + ' in RouteClerk.', by: me() });
  addTask(id, 'Call back new lead', today, { lead: true });
  return id;
}

/* ================= Merge suggestions ================= */
function mergesPage() {
  return { title: 'Possible duplicates', render: () => {
    const open = data.mergeSuggestions.filter(s => s.status === 'open' && q.customer(s.a) && q.customer(s.b)), done = data.mergeSuggestions.filter(s => s.status !== 'open');
    const row = s => ui.row({ icon: 'arrow.triangle.merge', iconColor: s.status === 'open' ? 'var(--orange)' : 'var(--gray)', title: (q.customer(s.a) || { name: s.aName }).name + ' + ' + (q.customer(s.b) || { name: s.bName }).name, subtitle: s.reason + ' · ' + s.detail,
      detail: s.status === 'merged' ? 'Merged' : s.status === 'dismissed' ? 'Not the same' : null, chevron: s.status === 'open', onTap: s.status === 'open' ? () => WD.nav.push(comparePage(s.a, s.b, s)) : null });
    return ui.list(open.length ? ui.section({ header: 'To review', footer: 'Suggested when new calls, forms or jobs look like an existing customer.' }, open.map(row)) : ui.empty({ icon: 'checkmark.circle', title: 'No duplicates', text: 'Every suggestion has been reviewed.' }), ui.section('Reviewed', done.map(row)));
  } };
}
function comparePage(aId, bId, sugg) {
  const vals = c => [['Name', c.name], ['Kind', c.kind === 'household' ? 'Residential' : 'Company'], ['Stage', LC[c.lifecycle][0]], ['Contacts', c.contacts.map(p => p.name).join(', ') || '—'],
    ['Phone', c.contacts.map(p => fmt.phone(p.phone)).filter(Boolean).join(', ') || '—'], ['Email', c.contacts.map(p => p.email).filter(Boolean).join(', ') || '—'], ['Address', c.locations[0] ? c.locations[0].address.replace(/, Lakemont$/, '') : '—'],
    ['Channel', c.channel], ['Jobs', String(q.jobsForCustomer(c.id).length)], ['Timeline', timeline(c.id).length + ' entries'], ['Created', c.createdAt ? fmt.day(D.key(new Date(c.createdAt)), 'md') + ', ' + new Date(c.createdAt).getFullYear() : '—']];
  return { title: 'Compare', render: page => {
    const a = q.customer(aId), b = q.customer(bId); if (!a || !b) return ui.empty({ icon: 'checkmark.circle', title: 'Already merged' });
    const va = vals(a), vb = vals(b), norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const grid = h('div.cu-cmp', h('div.cu-cmp-h', a.name), h('div.cu-cmp-h', b.name), va.map(([k, v], n) => { const same = norm(v) && norm(v) === norm(vb[n][1]) || (k === 'Phone' && v.split(', ').some(x => vb[n][1].includes(x) && x !== '—'));
      return [h('div.cu-cmp-l', k), h('div' + (same ? '.same' : ''), v), h('div' + (same ? '.same' : ''), vb[n][1])]; }));
    return ui.list(sugg ? ui.section(null, ui.row({ icon: 'info.circle', iconPlain: true, iconColor: 'var(--orange)', title: sugg.reason, subtitle: sugg.detail })) : null,
      ui.section({ footer: 'Highlighted fields match. Contacts, locations, timeline, follow-ups, invoices and attribution from the removed record move to the one you keep.' }, grid),
      h('div.cu-actions', ui.button('Merge', { onTap: async () => {
        const keep = await ui.actionSheet({ title: 'Which record should be kept?', message: 'The other record is removed after its history moves over.', buttons: [{ label: 'Keep ' + a.name, value: 'a' }, { label: 'Keep ' + b.name, value: 'b' }] });
        if (!keep) return; const [k, d] = keep === 'a' ? [a, b] : [b, a];
        if (await ui.run('Merging records…', () => merge(k, d), { done: 'Merged' })) page.pop(); } }),
        sugg && ui.button('Not the same', { kind: 'gray', onTap: async () => { if (await ui.run('Saving…', () => { sugg.status = 'dismissed'; }, { done: 'Kept separate', min: 400, max: 800 })) page.pop(); } })));
  } };
}
function merge(keep, drop) {
  const order = Object.keys(LC).filter(k => k !== 'lost');
  drop.contacts.forEach(p => { if (!keep.contacts.some(x => (p.phone && x.phone === p.phone) || (p.email && x.email === p.email))) keep.contacts.push(p); });
  drop.locations.forEach(l => { if (!keep.locations.some(x => x.address.toLowerCase() === l.address.toLowerCase())) keep.locations.push(l); });
  [data.interactions, data.tasks, data.touches, data.invoices, data.payments, data.jobs].forEach(arr => arr.forEach(x => { if (x.customerId === drop.id) x.customerId = keep.id; }));
  if (order.indexOf(drop.lifecycle) > order.indexOf(keep.lifecycle)) keep.lifecycle = drop.lifecycle;
  ['jobs', 'invoiced', 'paid', 'balance'].forEach(k => { keep.stats[k] += drop.stats[k]; });
  data.mergeSuggestions.forEach(s => { if (s.a === drop.id || s.b === drop.id) { s.status = 'merged'; s.aName = q.customer(s.a).name; s.bName = q.customer(s.b).name; } });
  data.customers.splice(data.customers.indexOf(drop), 1);
  addI({ customerId: keep.id, type: 'note', at: +WD.now(), text: 'Merged ' + drop.name + ' into this record.', by: me() });
}

/* ================= Styles ================= */
WD.css(`
.cu-seg { padding: 2px 16px 0; }
.cu-filter { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--label2); padding: 14px 16px 0; }
.cu-marks { display: inline-flex; flex-direction: column; align-items: stretch; gap: 3px; flex: none; }
.cu-mark.late { background: color-mix(in srgb, var(--red) 16%, transparent); color: var(--red); }
.cu-mark { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; min-width: 58px; padding: 3px 6px; border-radius: 8px; background: #D6E9FF; color: #0A3D8F; font-size: 12px; line-height: 14px; font-weight: 600; letter-spacing: 0; white-space: nowrap; }
.cu-mark b { font-size: 13px; line-height: 15px; font-weight: 700; }
.cu-totals { color: var(--label2); font-size: 12px; margin-top: 1px; }
.cu-stat.tap { cursor: pointer; } .cu-stat.tap:active { background: var(--fill3); } .cu-stat.tap span .ic { margin: -1px 0 0 3px; color: var(--label3); }
.cu-count { text-align: center; font-size: 13px; color: var(--label2); padding: 18px 0 0; }
.cu-crow .avatar { margin-right: -2px; }
.cu-crow + .row::before { left: 64px !important; }
.cu-name-row { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; }
.cu-more { border: 0; background: none; color: var(--tint); padding: 6px; margin-right: -8px; cursor: pointer; line-height: 0; flex: none; }
.cu-check { border: 0; background: none; padding: 0; cursor: pointer; line-height: 0; width: 28px; height: 28px; display: grid; place-items: center; flex: none; }
.cu-check:disabled { cursor: default; }
.cu-tc { align-items: flex-start; padding-left: 8px; } .cu-tc .cu-check { width: 36px; height: 36px; margin-top: -2px; } .cu-tc.cu-done b { text-decoration: line-through; color: var(--label2); } .cu-tc:not([role]) { cursor: default; }
.cu-done .row-title { text-decoration: line-through; color: var(--label2); }
.cu-link { border: 0; background: none; color: var(--tint); text-transform: none; font-size: 13px; padding: 0; cursor: pointer; display: inline-flex; gap: 3px; align-items: center; letter-spacing: -.08px; }
.cu-sechead { display: flex; justify-content: space-between; align-items: center; }
.cu-loading { display: flex; gap: 8px; align-items: center; justify-content: center; padding: 28px 16px; color: var(--label2); font-size: 15px; }
.cu-loading.small { padding: 16px 16px 0; font-size: 13px; justify-content: flex-start; }
.cu-head { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 10px 16px 6px; gap: 6px; }
.cu-title { font-size: 24px; line-height: 30px; font-weight: 700; letter-spacing: .2px; margin-top: 4px; }
.cu-meta { display: flex; gap: 8px; align-items: center; color: var(--label2); font-size: 15px; }
.cu-success { display: flex; gap: 5px; align-items: center; font-size: 13px; color: var(--label2); }
.cu-chip { display: inline-flex; gap: 5px; align-items: center; padding: 3px 10px; border-radius: 12px; background: var(--fill3); font-size: 13px; color: var(--label2); }
.cu-qas { display: flex; gap: 8px; width: 100%; margin-top: 10px; }
.cu-qa { flex: 1; min-width: 0; border: 0; background: var(--cell); border-radius: 12px; padding: 9px 0 7px; display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--tint); font-size: 12px; cursor: pointer; letter-spacing: 0; }
.cu-qa:disabled { color: var(--label3); cursor: default; }
.cu-qa:not(:disabled):active { background: var(--fill3); }
.cu-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5px; background: var(--sep); }
.cu-stat { background: var(--cell); padding: 10px 12px; min-width: 0; }
.cu-stat b { display: block; font-size: 19px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cu-stat span { font-size: 12px; color: var(--label2); }
.cu-tl .row-title { white-space: nowrap; }
.cu-tl .row-detail { align-self: flex-start; padding-top: 12px; font-size: 15px; }
.cu-tl .row-icon { align-self: flex-start; margin-top: 11px; }
.cu-1l { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cu-who { font-size: 12px; color: var(--label2); opacity: .8; }
.cu-route { display: inline-flex; align-items: center; gap: 5px; }
.cu-route .dot { width: 8px; height: 8px; }
.cu-block { padding: 12px 16px; font-size: 15px; line-height: 21px; letter-spacing: -.2px; white-space: pre-wrap; }
.cu-transcript p { margin: 0 0 8px; } .cu-transcript p:last-child { margin: 0; }
.cu-transcript b { display: block; font-size: 12px; color: var(--label2); font-weight: 600; }
.cu-ai { display: inline-flex; align-items: center; gap: 2px; color: var(--purple); }
.cu-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0; }
.cu-player { display: flex; align-items: center; gap: 12px; padding: 12px 16px; }
.cu-play { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--tint); color: #fff; display: grid; place-items: center; cursor: pointer; flex: none; }
.cu-track { flex: 1; height: 5px; border-radius: 3px; background: var(--fill); position: relative; cursor: pointer; }
.cu-track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: var(--tint); }
.cu-ptime { font-size: 13px; color: var(--label2); font-variant-numeric: tabular-nums; min-width: 78px; text-align: right; }
.cu-thread { padding: 8px 12px 16px; display: flex; flex-direction: column; gap: 3px; min-height: 100%; background: var(--cell); }
.cu-thread-head { text-align: center; font-size: 12px; color: var(--label2); padding: 4px 0 6px; }
.cu-stamp { align-self: center; font-size: 12px; color: var(--label2); margin: 10px 0 4px; }
.cu-bub { max-width: 76%; padding: 7px 12px; border-radius: 18px; font-size: 16px; line-height: 21px; letter-spacing: -.3px; user-select: text; }
.cu-bub.in { align-self: flex-start; background: var(--fill2); color: var(--label); }
.cu-bub.out { align-self: flex-end; background: var(--blue); color: #fff; }
.cu-status { align-self: flex-end; font-size: 12px; color: var(--label2); margin: 1px 4px 0; }
.cu-composer { display: flex; align-items: center; gap: 6px; width: 100%; }
.cu-compose-in { flex: 1; min-width: 0; height: 34px; border-radius: 17px; border: .5px solid var(--sep); background: var(--cell); padding: 0 14px; font-size: 16px; outline: 0; color: var(--label); }
.cu-send { border: 0; background: none; padding: 0; color: var(--blue); cursor: pointer; line-height: 0; }
.cu-send:disabled { color: var(--label3); cursor: default; }
.cu-caller { display: flex; gap: 12px; align-items: center; padding: 4px 16px 0; }
.cu-live { display: block; color: var(--green); font-weight: 600; font-size: 13px; margin-top: 2px; font-variant-numeric: tabular-nums; }
.cu-btns { display: flex; gap: 8px; padding: 12px 16px 0; flex-wrap: wrap; }
.cu-amount { font-size: 34px; line-height: 40px; font-weight: 700; letter-spacing: .3px; }
.cu-cmp { display: grid; grid-template-columns: 1fr 1fr; font-size: 14px; line-height: 19px; }
.cu-cmp > div { padding: 2px 12px 9px; min-width: 0; overflow-wrap: anywhere; }
.cu-cmp > .cu-cmp-h { font-weight: 600; padding: 11px 12px; background: var(--fill3); }
.cu-cmp > .cu-cmp-l { grid-column: 1 / -1; font-size: 12px; color: var(--label2); padding: 8px 12px 0; border-top: .5px solid var(--sep); }
.cu-cmp > .same { color: var(--green); font-weight: 500; }
.cu-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
`);

/* ================= Registration ================= */
const tab = WD.app.tabs.find(t => t.id === 'customers');
if (tab) tab.badge = () => WD.can('crm.view') ? data.tasks.filter(t => !t.done && t.due <= today).length : 0;
function showSeg(seg) {
  R.seg = seg; R.query = ''; R.results = null; R.loading = false; WD.nav.switchTab('customers');
  if (R.page) { const inp = R.page.navbar.querySelector('.nav-search input'), box = R.page.navbar.querySelector('.search-box'); if (inp) inp.value = ''; if (box) box.classList.remove('filled'); R.page.refresh(); }
}
/** From another workspace column (a call or text in the Inbox, a stop on the board or the map): show that customer's record in this column. */
function onLinked(sel) { const j = sel.jobId && q.job(sel.jobId), id = sel.customerId || (j && j.customerId); if (!id || !q.customer(id) || !WD.can('crm.view')) return false;
  const st = WD.app.paneStack && WD.app.paneStack('customers'); if (!st) return false; const top = st.top(); if (top && top.spec && top.spec.linkedId === id) return true;
  if (st.pages.length > 1 && top.spec.linkedId) { while (st.pages.length > 1) { const p = st.pages.pop(); p.el.remove(); p.spec.onClose && p.spec.onClose(p); } st.top().el.classList.remove('behind'); }
  const spec = detailSpec(id); spec.linkedId = id; st.push(spec, false); return true; }
WD.screens.customers = { root, openDetail, detailSpec, onLinked, openNew, simulateCall, invoicePage, invoicesFor, invRow, custInvoices, taskRow, invLines: linesFor, crm: { PIPE, LC, CHANNELS, LOST, mk, addI, addTask, logCall, moveStage, setNext, markLost, contactedYet, nextLabel, staff, first, startCall, timeline, describe, owners, tasksView, newTask }, noteEmailOf };
WD.panel.addAction('Incoming call (known customer)', () => simulateCall('c1'));
WD.panel.addAction('Incoming call (unknown number)', () => simulateCall(null));
WD.panel.addJump('Customer record', () => { WD.nav.switchTab('customers'); openDetail('c1'); });
WD.panel.addJump('Leads', () => WD.can('leads.view') ? WD.nav.switchTab('crm') : showSeg('leads'));
WD.panel.addJump('Tasks', () => showSeg('tasks'));
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('customers', R); }
})();
