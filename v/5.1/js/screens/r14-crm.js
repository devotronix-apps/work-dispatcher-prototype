/* RouteClerk prototype — version 5.0, CRM (`WD.crm2`). Builds on crm.js (WD.screens.crm.x) and the lead helpers in customers.js.
   - Customer needs: requests from existing customers (COI, W-9, certificate copies, extra pickups…), company documents to send, request types.
   - Key accounts: the few leads worth far more than the rest (`c.vip`), their area at the top of Leads, and their own page.
   - AI Premium: the lead summary and next step, the review of the whole pipeline, the low-value auto-reply, request replies.
   - Desktop website: the Leads dashboard with clickable charts, the stage board and the spreadsheet (also for Customer needs).
   - New agreement requests (replaces the Google Sheet the office filled from a form); shown in Contracts (r13.js). */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc || {}, AIP = WD.aip || { on: () => false, feature: () => {}, card: o => h('div', o.text), tag: () => null }, C2 = WD.crm2 = {};
const K = () => (WD.screens.customers || {}).crm || {}, X = () => (WD.screens.crm || {}).x || {}, CO = WD.co || {};
const today = () => D.today(), now = () => +WD.now(), me = () => (S.me && S.me.name) || 'You', org = () => S.org || data.orgs[0];
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's'), first = n => String(n || '').split(' ')[0], money = n => fmt.money(n), md = k => fmt.day(k, 'md');
const canEdit = () => WD.can('crm.edit'), admin = () => WD.can('settings.manage'), aiOn = () => !!AIP.on();
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const staff = id => (q.user(id) || {}).name || 'Office', owners = () => data.users.filter(u => u.role !== 'driver' && u.status === 'active');
const ask = RC.ask || (async (title, placeholder, value, message) => { const r = await ui.alert({ title, message, input: { placeholder, value: value == null ? '' : String(value) }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); return r && r.value && r.text.trim() ? r.text.trim() : null; });
const say = (cid, text, by) => { const k = K(); if (cid && k.addI) k.addI({ customerId: cid, type: 'note', at: now(), text, by: by || me() }); };
const given = n => { const w = String(n || '').trim().split(/\s+/); return /^(dr|mr|mrs|ms|prof)\.?$/i.test(w[0]) && w.length > 1 ? w[0] + ' ' + w[w.length - 1] : w[0]; };
const AI_BY = 'AI Premium', daysAgo = at => Math.max(0, Math.floor((now() - at) / 864e5)), agoText = at => { const d = daysAgo(at); return d ? plural(d, 'day') + ' ago' : 'today'; };
const tr = (a, b) => h('tr', h('td', a), h('td', b));
const openLead = id => WD.screens.crm && WD.screens.crm.openLead(id);

WD.css(`
.c2-pad { padding: 10px 16px 0; } .c2-pad .rc-ai { margin: 0; }
.c2-key { margin: 12px 0 0; border: 3px solid var(--orange); border-radius: 16px; background: color-mix(in srgb, var(--orange) 12%, var(--cell)); overflow: hidden; }
.c2-key-h { display: flex; align-items: center; gap: 7px; min-height: 44px; padding: 2px 12px; color: var(--label); } .c2-key-h b { font-size: 16px; font-weight: 700; letter-spacing: -.3px; white-space: nowrap; } .c2-key-h svg { color: var(--orange); flex: none; }
.c2-key-h .v { font-size: 13px; color: var(--label2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; } .c2-key-h .cu-link { margin-left: auto; flex: none; min-height: 44px; padding-left: 10px; font-weight: 600; }
.c2-key-s { display: flex; gap: 10px; overflow-x: auto; padding: 0 10px 10px; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; } .c2-key-s::-webkit-scrollbar { display: none; }
.c2-vip { box-sizing: border-box; flex: 0 0 88%; max-width: 340px; min-width: 0; scroll-snap-align: start; background: var(--cell); border-radius: 12px; padding: 11px 12px; cursor: pointer; }
.c2-vip.full { max-width: none; margin-top: 10px; border: 3px solid var(--orange); border-radius: 16px; }
.c2-vip-t { display: flex; align-items: center; gap: 6px; } .c2-vip-t b { font-size: 16px; font-weight: 600; letter-spacing: -.3px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .c2-vip-t .badge { margin-left: auto; flex: none; } .c2-vip-t svg { color: var(--orange); flex: none; }
.c2-vip-v { font-size: 22px; font-weight: 700; letter-spacing: -.4px; margin: 2px 0 6px; font-variant-numeric: tabular-nums; } .c2-vip-v small { font-size: 13px; font-weight: 500; color: var(--label2); letter-spacing: 0; }
.c2-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; } .c2-facts div { min-width: 0; } .c2-facts small { display: block; font-size: 12px; line-height: 15px; color: var(--label2); }
.c2-facts span { display: block; font-size: 14px; line-height: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .c2-facts .w { grid-column: 1 / -1; } .c2-facts .w span { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.c2-facts .late span { color: var(--red); font-weight: 600; }
.c2-filters { display: flex; gap: 8px; padding: 10px 0 0; }
.c2-fb { flex: 1; min-width: 0; min-height: 44px; border: 0; border-radius: 12px; background: var(--cell); color: var(--label); font: inherit; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 0 12px; cursor: pointer; } .c2-fb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .c2-fb svg { flex: none; color: var(--label2); } .c2-fb.on { color: var(--tint); }
.row.c2-over { box-shadow: inset 4px 0 0 var(--red); background: color-mix(in srgb, var(--red) 8%, var(--cell)); }
.c2-ask { font-size: 15px; line-height: 20px; white-space: pre-wrap; }
.c2-res { color: var(--green); font-weight: 600; }
.c2-desk { padding: 0 20px 28px; } .c2-desk > .list { padding: 0; max-width: 860px; }
.c2-dash { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.c2-card { background: var(--cell); border-radius: 14px; padding: 12px 12px 10px; min-width: 0; } .c2-card h4 { margin: 0 2px 8px; font-size: 13px; font-weight: 700; color: var(--label2); text-transform: uppercase; letter-spacing: .3px; }
.c2-bar { display: grid; grid-template-columns: 108px minmax(0, 1fr) auto; align-items: center; gap: 8px; width: 100%; min-height: 34px; border: 0; border-radius: 8px; background: none; color: var(--label); font: inherit; font-size: 13px; padding: 3px 4px; cursor: pointer; text-align: left; }
.c2-bar:hover, .c2-col:hover, .c2-tile:hover { background: var(--fill3); } .c2-bar.on { background: color-mix(in srgb, var(--tint) 14%, transparent); }
.c2-bar .l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; } .c2-bar .t { display: flex; height: 16px; border-radius: 8px; background: var(--fill3); overflow: hidden; } .c2-bar.fun .t { justify-content: center; background: none; }
.c2-bar .t i { display: block; height: 100%; border-radius: 8px; background: var(--c, var(--tint)); min-width: 4px; } .c2-bar .n { font-variant-numeric: tabular-nums; color: var(--label2); white-space: nowrap; font-size: 12px; }
.c2-cols { display: flex; align-items: flex-end; gap: 4px; height: 150px; }
.c2-col { flex: 1; min-width: 0; height: 100%; border: 0; border-radius: 8px; background: none; color: var(--label); font: inherit; font-size: 12px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 3px; padding: 2px; cursor: pointer; }
.c2-col i { display: block; width: 68%; border-radius: 5px 5px 0 0; background: var(--blue); min-height: 2px; } .c2-col .l { color: var(--label2); white-space: nowrap; } .c2-col .n { font-weight: 600; font-variant-numeric: tabular-nums; }
.c2-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .c2-tile { border: 0; background: var(--bg); border-radius: 12px; padding: 9px 10px; text-align: left; color: var(--label); font: inherit; cursor: pointer; min-height: 60px; } .c2-tile b { display: block; font-size: 22px; font-weight: 700; letter-spacing: -.4px; font-variant-numeric: tabular-nums; } .c2-tile span { font-size: 12px; color: var(--label2); }
.c2-tool { display: flex; align-items: center; gap: 10px; margin: 16px 0 8px; flex-wrap: wrap; } .c2-tool .segmented { width: 250px; flex: none; } .c2-tool .btn { width: auto; }
.c2-find { font: inherit; font-size: 14px; color: var(--label); background: var(--cell); border: .5px solid var(--sep); border-radius: 9px; padding: 8px 10px; width: 230px; min-height: 36px; box-sizing: border-box; }
.c2-cnt { font-size: 13px; color: var(--label2); } .c2-grow { flex: 1; }
.c2-fchip { display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 14px; min-height: 28px; padding: 0 10px; background: color-mix(in srgb, var(--tint) 16%, transparent); color: var(--tint); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.c2-board { display: flex; gap: 12px; overflow-x: auto; align-items: flex-start; padding-bottom: 8px; } .c2-board .cr-st { flex: 0 0 288px; margin: 0; min-width: 0; }
.c2-scroll { overflow: auto; max-height: 580px; border-radius: 12px; background: var(--cell); border: .5px solid var(--sep); }
.c2-table { border-collapse: collapse; width: 100%; font-size: 13px; } .c2-table th { position: sticky; top: 0; z-index: 1; background: var(--cell); text-align: left; padding: 0; box-shadow: inset 0 -1px 0 var(--sep); white-space: nowrap; }
.c2-table th button { border: 0; background: none; font: inherit; font-size: 12px; font-weight: 700; color: var(--label2); padding: 10px; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; width: 100%; } .c2-table th button.on { color: var(--tint); }
.c2-table td { padding: 6px 10px; border-bottom: .5px solid var(--sep); white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; color: var(--label); } .c2-table td.late { color: var(--red); font-weight: 600; } .c2-table td.b { font-weight: 600; }
.c2-table tbody tr { cursor: pointer; } .c2-table tbody tr:hover { background: var(--fill3); } .c2-table tr.over td:first-child { box-shadow: inset 4px 0 0 var(--red); }
.c2-sel { font: inherit; font-size: 13px; color: var(--label); background: var(--fill3); border: 0; border-radius: 7px; padding: 5px 6px; max-width: 160px; cursor: pointer; }
`);

/* ================= Data: seeded once for each business ================= */
const TYPES0 = [['coi', 'Certificate of insurance (COI)', 'coi', 2, false, 'shield'], ['w9', 'Form W-9', 'w9', 2, false, 'doc.text'], ['cod', 'Certificate of destruction copy', 'cod', 2, false, 'doc'], ['invoice', 'Invoice copy or statement', 'statement', 2, false, 'dollarsign.circle'],
  ['pickup', 'Extra pickup', null, 3, true, 'truck'], ['container', 'Container swap or add', null, 5, true, 'shippingbox'], ['contact', 'Change of contact or address', null, 2, false, 'person'], ['complaint', 'Service complaint', null, 1, false, 'exclamationmark.triangle'],
  ['vendor', 'Vendor packet or onboarding form', 'vendor', 5, false, 'briefcase'], ['price', 'Price question', null, 2, false, 'tag']];
const IS = { new: ['New', 'var(--blue)'], progress: ['In progress', 'var(--orange)'], waiting: ['Waiting on customer', 'var(--purple)'], done: ['Done', 'var(--green)'] }, ISK = ['new', 'progress', 'waiting', 'done'];
const CH = { call: ['Call', 'phone.fill'], email: ['Email', 'envelope'], portal: ['Customer portal', 'globe'] };
const RS = { new: ['New', 'var(--blue)'], progress: ['In progress', 'var(--orange)'], sent: ['Sent', 'var(--purple)'], completed: ['Completed', 'var(--green)'], hold: ['Hold', 'var(--gray)'], cancelled: ['Cancelled', 'var(--red)'] }, RSK = ['new', 'progress', 'sent', 'hold', 'completed', 'cancelled'];
const FREQS = ['Weekly', 'Every 2 weeks', 'Every 4 weeks', 'Monthly', 'Quarterly', 'One time', 'On call'];
const bizDay = n => { let d = today(), left = n; while (left > 0) { d = D.add(d, 1); const w = D.parse(d).getDay(); if (w !== 0 && w !== 6) left--; } return d; };
function ensure() {
  if (data.inquiries) return;
  const t0 = today(), stamp = (days, hrs) => now() - days * 864e5 - (hrs || 0) * 36e5;
  data.inquiryTypes = TYPES0.map(([id, name, doc, days, job, ic]) => ({ id, name, doc, days, job, icon: ic }));
  data.companyDocs = [
    { id: 'coi', name: 'Certificate of insurance (COI)', short: 'COI', file: 'COI-2026.pdf', expires: D.add(t0, 24), detail: 'General liability $2,000,000 · Auto $1,000,000 · Workers’ compensation. The certificate holder is added for each request.' },
    { id: 'w9', name: 'Form W-9', short: 'W-9', file: 'W-9-signed.pdf', updated: 'January 2026', detail: 'Signed by the owner. Taxpayer ID as registered.' },
    { id: 'cod', name: 'Certificate of destruction', short: 'certificate of destruction', perCustomer: true, detail: 'Made from the customer’s completed visits.' },
    { id: 'statement', name: 'Invoice copy or statement', short: 'statement', perCustomer: true, detail: 'Made from the customer’s invoices.' },
    { id: 'vendor', name: 'Vendor packet', short: 'vendor packet', file: 'Vendor-packet.pdf', updated: 'March 2026', detail: 'W-9, COI, business license, bank letter and three references in one file.' }];
  data.inquiries = []; data.aiActions = []; data.agreementRequests = [];
  /* Customer requests, tied to real customers of this business. */
  let cs = data.customers.filter(c => ['customer', 'serviced'].includes(c.lifecycle) && c.kind !== 'household'); if (cs.length < 4) cs = data.customers.slice();
  [['coi', 'email', 1, 1, 'u3', 'new', 'Our building manager needs your certificate of insurance before the next visit. Certificate holder: Lakemont Medical Plaza LLC, 400 Plaza Way.', { holder: 'Lakemont Medical Plaza LLC' }],
    ['w9', 'email', 0, 2, 'u3', 'new', 'Accounts payable needs a current W-9 before they can pay the November invoice.'],
    ['cod', 'portal', 2, 0, 'u2', 'progress', 'Needs a copy of the certificate of destruction from last month’s visit for an audit.'],
    ['invoice', 'call', 4, -2, 'u3', 'progress', 'Asked for a statement of everything still open for their year-end close.'],
    ['pickup', 'call', 0, 1, 'u2', 'new', 'Consoles are full after a file-room clean-out. Wants an extra pickup this week.'],
    ['container', 'email', 6, -1, 'u2', 'waiting', 'Wants to swap one console for a 64-gallon bin. We asked which floor it goes on; no answer yet.'],
    ['contact', 'portal', 3, 1, 'u3', 'waiting', 'A new office manager starts on the 1st. We asked for the new name and email.'],
    ['complaint', 'call', 1, 0, 'u1', 'progress', 'The driver arrived after the office had closed on the last visit. Wants a call from a manager.'],
    ['vendor', 'email', 5, 3, 'u3', 'new', 'They moved to a new vendor system. Needs our onboarding form filled in, with the W-9 and COI attached.'],
    ['price', 'call', 9, -6, 'u2', 'done', 'Asked what a second console would cost.'],
    ['coi', 'email', 12, -10, 'u3', 'done', 'Yearly certificate of insurance for their vendor file.', { doc: 'coi' }]]
    .forEach(([type, channel, age, due, owner, status, text, extra], n) => { const c = cs[(n * 3 + 1) % cs.length]; if (!c) return; const p = c.contacts[n % c.contacts.length] || c.contacts[0] || {};
      data.inquiries.push({ id: 'iq' + (n + 1), customerId: c.id, type, who: p.name || 'Front desk', email: p.email || c.billingEmail || '', channel, at: stamp(age, n % 5), due: D.add(t0, due), owner: q.user(owner) ? owner : (owners()[0] || {}).id, status, text, holder: '', doc: null,
        doneAt: status === 'done' ? stamp(Math.max(0, age - 1)) : null, notes: status === 'waiting' ? [{ at: stamp(Math.max(0, age - 1)), by: staff(owner), text: 'Asked the customer for the missing detail by email.' }] : [], ...(extra || {}) }); });
  /* Key accounts. */
  [['c44', 21800, 'Purchasing committee · votes on the bid', 'Get the console count for the third building and file the bid', 'Win on service detail, not price. Bring a sample certificate and the route plan for all three buildings to the pre-bid meeting.'],
    ['c43', 6240, 'Irene Kovac, owner', 'Call Irene before Friday', 'She is comparing one other company. Offer the January start and a rate that stays fixed through tax season.'],
    ['c35', 4680, 'Dr. Wes Grant, medical director', 'Send the quote for 3 consoles', 'Maya runs the office but Dr. Grant signs. Send the privacy one-pager with the quote.']]
    .forEach(([id, value, decider, step, plan], n) => { const c = q.customer(id); if (c) Object.assign(c, { vip: true, vipAt: stamp(3 + n), estValue: value, decider, nextStep: step, plan, stageSince: stamp([5, 2, 8][n]) }); });
  /* A low-value lead the auto-reply already answered. */
  { const c = q.customer('c36'), L = LV(); if (c && c.lifecycle === 'lead') { const p = c.contacts[0] || {}, at = stamp(0, 2);
    c.lowValue = { rule: 'purge', at }; c.priority = 'low'; c.lifecycle = 'contacted'; c.followUps = (c.followUps || 0) + 1; c.lastFollowAt = at;
    if (K().addI) K().addI({ customerId: c.id, type: 'note', at, by: AI_BY, text: 'Follow-up sent (“Low-value auto-reply: small purge”, text to ' + (p.phone ? fmt.phone(p.phone) : 'their number') + '): ' + lvText('purge', c, L) }); } }
  /* What the review did before today. */
  [[1, 'Sent the follow-up text', 'Brookside Dental Lab', 'auto'], [1, 'Archived: no reply after 3 tries', 'Maple Court Apartments', 'auto'], [1, 'Call back about the bid questions', 'Lakemont County Clerk', 'task'], [3, 'Sent the W-9', 'Harlow and Finch', 'auto']]
    .forEach(([age, label, target, how]) => data.aiActions.push({ at: stamp(age, 3), by: 'Colleen Abbott', label, target, how }));
  /* New agreement requests (the sheet the office used to keep). */
  const o = org(), loc = (o.short || o.name) + (o.state ? ' · ' + o.state : '');
  [['new', 0, 'Juniper Ridge Dental', '77 Juniper Ridge Rd, Lakemont', 'Mon–Thu 8:00–5:00, Fri 8:00–12:00. Closed 12:00–1:00 for lunch.', 'Rosa Whitlock', '+15125550161', 'ap@juniperridgedental.example', 'rosa@juniperridgedental.example', 'Every 4 weeks', '2 consoles at $65 each', [['console', 2, 65]], false, 6, 'Front desk has the key. Park behind the building.', null, 'Colleen Abbott'],
    ['new', 1, 'Summit Tax Service', '45 Summit Plaza, Lakemont', 'Mon–Sat 8:00–7:00 from January to April. No lunch closure.', 'Irene Kovac', '+15125550143', 'irene@summittax.example', 'irene@summittax.example', 'Weekly', '3 consoles at $60 each', [['console', 3, 60]], false, 9, 'Weekly through April 15, then every 4 weeks.', 'c43', 'Colleen Abbott'],
    ['progress', 3, 'Harbor Point Credit Union', '1200 Harbor Point Blvd, Lakemont', 'Mon–Fri 9:00–5:00. Lobby stays open through lunch.', 'Vince Dalton', '+15125550164', 'payables@harborpointcu.example', 'vdalton@harborpointcu.example', 'Every 2 weeks', '4 consoles at $62 each, 1 64-gallon bin at $55', [['console', 4, 62], ['bin64', 1, 55]], true, 4, 'Drop-off shredding at setup: about 12 boxes from the old branch.', null, 'Priya Raman'],
    ['sent', 5, 'Copperfield Physical Therapy', '310 Copperfield Way, Lakemont', 'Mon–Fri 7:00–6:00. Closed 12:30–1:30 for lunch.', 'Dana Okoye', '+15125550167', 'billing@copperfieldpt.example', 'dana@copperfieldpt.example', 'Every 4 weeks', '1 console at $65', [['console', 1, 65]], false, 11, '', null, 'Colleen Abbott'],
    ['sent', 8, 'Lakemont Montessori School', '58 Larkspur Ln, Lakemont', 'Mon–Fri 7:30–4:00. Office closed 11:30–12:15.', 'Meredith Shaw', '+15125550169', 'office@lakemontmontessori.example', 'office@lakemontmontessori.example', 'Monthly', '2 consoles at $58 each', [['console', 2, 58]], false, 13, 'Come before 2:30 pickup traffic.', null, 'Priya Raman'],
    ['completed', 14, 'Redwood Title & Escrow', '900 Redwood Ave, Lakemont', 'Mon–Fri 8:30–5:00. No lunch closure.', 'Paul Iverson', '+15125550172', 'ap@redwoodtitle.example', 'paul@redwoodtitle.example', 'Every 2 weeks', '3 consoles at $62 each', [['console', 3, 62]], false, -3, 'Setup done. Signed copy filed.', null, 'Colleen Abbott'],
    ['completed', 21, 'Bellweather Animal Hospital', '2210 Bellweather Rd, Lakemont', 'Every day 8:00–8:00.', 'Tessa Monroe', '+15125550175', 'accounts@bellweathervet.example', 'tessa@bellweathervet.example', 'Every 4 weeks', '1 console at $65, 1 96-gallon bin at $70', [['console', 1, 65], ['bin96', 1, 70]], true, -9, '', null, 'Priya Raman'],
    ['hold', 10, 'Northgate Property Management', '14 Northgate Ctr, Lakemont', 'Mon–Fri 9:00–5:00. Closed 12:00–1:00 for lunch.', 'Ellis Byrne', '+15125550178', 'invoices@northgatepm.example', 'ellis@northgatepm.example', 'Quarterly', '6 consoles at $55 each', [['console', 6, 55]], false, 40, '', null, 'Colleen Abbott', 'Waiting for their board to approve the budget in January.'],
    ['cancelled', 17, 'Sunrise Bookkeeping', '6 Sunrise Ct, Lakemont', 'Mon–Fri 9:00–4:00.', 'Carla Nguyen', '+15125550181', 'carla@sunrisebooks.example', 'carla@sunrisebooks.example', 'On call', '1 console at $70', [['console', 1, 70]], false, 20, '', null, 'Priya Raman', 'Chose a mail-in service instead.']]
    .forEach(([status, age, company, address, hours, contact, phone, billingEmail, contractEmail, freq, containers, items, dropShred, setup, notes, customerId, by, reason], n) => data.agreementRequests.push({ id: 'ar' + (n + 1), status, at: stamp(age, n % 6), location: loc, company, address, hours, contact, phone, billingEmail, contractEmail, freq, containers,
      items: items.map(([id, qty, rate]) => ({ id, qty, rate })), dropShred, setupDate: D.add(t0, setup), notes, customerId: customerId && q.customer(customerId) ? customerId : null, by, reason: reason || '', agreementId: null, log: [] }));
}
const inq = () => { ensure(); return data.inquiries; }, types = () => { ensure(); return data.inquiryTypes; }, docs = () => { ensure(); return data.companyDocs; }, reqs = () => { ensure(); return data.agreementRequests; }, aiLog = () => { ensure(); return data.aiActions; };
const typeOf = i => types().find(t => t.id === i.type) || { id: i.type, name: 'Other request', days: 2, icon: 'tray', doc: null, job: false }, docOf = id => docs().find(d => d.id === id) || null;
const overdue = i => i.status !== 'done' && i.due < today(), custName = i => (q.customer(i.customerId) || { name: 'Customer removed' }).name;
const emailFor = i => { const c = q.customer(i.customerId), p = c && (c.contacts.find(x => x.name === i.who && x.email) || c.contacts.find(x => x.email)); return i.email || (p && p.email) || (c && c.billingEmail) || ''; };
const holderIn = text => ((/certificate holder:?\s*([^.\n,]+)/i.exec(text || '') || [])[1] || '').trim();
C2.openCount = () => inq().filter(i => i.status !== 'done').length;

/* ================= Low-value leads: rules and the automatic reply (AI Premium) ================= */
const LV = () => { const s = (data.settings || {}).crm || (data.settings.crm = {}); return s.lowValue || (s.lowValue = { on: true, boxes: 6, via: 'text', hoursOnly: true, handoff: true, purgePrice: 95, dropPrice: 8, dropHours: 'Monday to Friday, 8:00 to 4:30', link: 'https://go.discountshred.example/book',
  rules: { purge: { on: true, text: 'Hi {first}, thanks for contacting {company}. A pickup of up to {max} boxes is a flat {price}: shredded, recycled, with a certificate of destruction. Pick a day here: {link}' },
    dropoff: { on: true, text: 'Hi {first}, you can drop boxes off at {address}, {hours}. It is {price} a box, shredded while you wait. No appointment needed.' } } }); };
function lvText(rule, c, L = LV()) { const o = org(), p = (c.contacts || [])[0] || {}, r = L.rules[rule] || L.rules.purge;
  return String(r.text).replace(/\{(\w+)\}/g, (m, k) => ({ first: first(p.name) || 'there', company: o.name, max: L.boxes, price: rule === 'dropoff' ? money(L.dropPrice) : money(L.purgePrice), link: L.link, address: (o.remit || []).slice(1).join(', ') || 'our shop', hours: L.dropHours })[k] ?? m); }
const boxesOf = c => { const l = (c.locations || [])[0] || {}, m = /(\d+)\s*(?:bankers?\s*|file\s*)?box/i.exec([l.containers, c.containers, c.notes].filter(Boolean).join(' ')); return m ? +m[1] : null; };
/** Which low-value rule a lead matches, if any → 'purge' | 'dropoff' | null. Key accounts and high-priority leads never match. */
function lowMatch(c) { const L = LV(); if (!L.on || c.vip || c.priority === 'high') return null; const n = boxesOf(c);
  if (L.rules.dropoff.on && /drop(ping)?[\s-]?(them |it )?(off|by)|bring (them|it|a few|some)/i.test(c.notes || '')) return 'dropoff';
  if (L.rules.purge.on && n != null && n <= L.boxes && (c.type === 'purge' || c.freq === 'One time')) return 'purge'; return null; }
/** Send the low-value reply now (or queue it for opening time), badge the lead, and log it on the timeline. */
function autoReply(c, rule) { const L = LV(), p = (c.contacts || [])[0] || {}, viaEmail = L.via === 'email' || !p.phone, to = viaEmail ? p.email : fmt.phone(p.phone); if (!to) return false;
  const mins = WD.nowMins ? WD.nowMins() : 600, closed = L.hoursOnly && (mins < 480 || mins >= 1020), text = lvText(rule, c, L);
  c.lowValue = { rule, at: closed ? null : now(), queued: closed }; c.priority = 'low';
  if (closed) { say(c.id, 'Low-value lead (' + (rule === 'dropoff' ? 'drop-off' : plural(boxesOf(c) || L.boxes, 'box').replace('boxs', 'boxes')) + '). The auto-reply goes out at 8:00, when the office opens.', AI_BY); return true; }
  say(c.id, 'Follow-up sent (“Low-value auto-reply: ' + (rule === 'dropoff' ? 'drop-off' : 'small purge') + '”, ' + (viaEmail ? 'email' : 'text') + ' to ' + to + '): ' + text, AI_BY);
  c.followUps = (c.followUps || 0) + 1; c.lastFollowAt = now(); if (c.lifecycle === 'lead') c.lifecycle = 'contacted'; c.nextAction = null; return true; }
C2.lowSpec = () => ({ title: 'Low-value leads', render: page => { if (!admin()) return ui.empty({ icon: 'lock', title: 'Ask an admin' }); const L = LV(), re = () => { WD.changed(); page.refresh(); }, hit = X().pipe ? X().pipe().filter(c => c.lowValue) : [];
  const num = (label, key, pre) => ui.row({ title: label, detail: (pre || '') + L[key], trailing: ui.stepper(L[key], 1, 500, v => { L[key] = v; re(); }) });
  return ui.list(note('Small jobs are worth answering, but not worth a person’s time. A lead that matches a rule gets the reply below within a minute, a “Low value · auto-replied” badge, and low priority. Key accounts and high-priority leads never match.'),
    ui.section({ fold: false }, ui.toggleRow({ icon: 'sparkles', iconColor: 'var(--purple)', title: 'Answer low-value leads automatically', value: L.on, onChange: v => { L.on = v; re(); } })),
    L.on && ui.section({ header: 'Rule 1 · small purge', fold: false, showFooter: true, footer: 'Matches a one-time purge of ' + L.boxes + ' boxes or fewer. Words in braces are filled in for each lead: {first} {company} {max} {price} {link}.' },
      ui.toggleRow({ title: 'Purge of ' + L.boxes + ' boxes or fewer', value: L.rules.purge.on, onChange: v => { L.rules.purge.on = v; re(); } }),
      L.rules.purge.on && num('Boxes or fewer', 'boxes'), L.rules.purge.on && num('Flat price', 'purgePrice', '$'),
      L.rules.purge.on && ui.inputRow({ label: 'Booking link', caps: 'off', value: L.link, onInput: v => { L.link = v.trim(); } }),
      L.rules.purge.on && ui.inputRow({ multiline: true, value: L.rules.purge.text, onInput: v => { L.rules.purge.text = v; } })),
    L.on && ui.section({ header: 'Rule 2 · wants to drop off a few boxes', fold: false, showFooter: true, footer: 'Matches when the request says they want to drop boxes off or bring them in. {first} {company} {address} {hours} {price}.' },
      ui.toggleRow({ title: 'Wants to drop off', value: L.rules.dropoff.on, onChange: v => { L.rules.dropoff.on = v; re(); } }),
      L.rules.dropoff.on && num('Price a box', 'dropPrice', '$'), L.rules.dropoff.on && ui.inputRow({ label: 'Drop-off hours', value: L.dropHours, onInput: v => { L.dropHours = v; } }),
      L.rules.dropoff.on && ui.row({ title: 'Drop-off address', subtitle: (org().remit || []).slice(1).join(', ') || 'Set the company address in Settings → Company' }),
      L.rules.dropoff.on && ui.inputRow({ multiline: true, value: L.rules.dropoff.text, onInput: v => { L.rules.dropoff.text = v; } })),
    L.on && ui.section({ header: 'How it is sent', fold: false },
      ui.pickerRow({ title: 'Send by', value: L.via, options: [{ value: 'text', label: 'Text message' }, { value: 'email', label: 'Email' }], onChange: v => { L.via = v; re(); } }),
      ui.toggleRow({ title: 'Business hours only', subtitle: 'A lead that arrives after hours is answered at 8:00 the next morning', value: L.hoursOnly, onChange: v => { L.hoursOnly = v; re(); } }),
      ui.toggleRow({ title: 'Hand to a person if they reply with a question', subtitle: 'Their reply raises the priority to medium and adds a task for the lead’s owner', value: L.handoff, onChange: v => { L.handoff = v; re(); } })),
    L.on && ui.section({ header: 'Preview', fold: false }, ui.row({ title: 'Small purge', subtitle: lvText('purge', { contacts: [{ name: 'Raj Patel' }] }, L) }), ui.row({ title: 'Drop-off', subtitle: lvText('dropoff', { contacts: [{ name: 'Raj Patel' }] }, L) })),
    hit.length > 0 && ui.section({ header: 'Answered automatically · ' + hit.length, fold: false }, hit.map(c => ui.row({ title: c.name, subtitle: (c.lowValue.rule === 'dropoff' ? 'Drop-off' : 'Small purge') + ' · ' + (c.lowValue.at ? 'replied ' + agoText(c.lowValue.at) : 'reply waits for opening time'), chevron: true, onTap: () => openLead(c.id) })))); } });

/* ================= Customer needs: requests from existing customers ================= */
const N = { type: 'all', owner: 'all', view: 'list', sheet: { sort: 'due', dir: 1, text: '' } };
/** The reply AI Premium would send: wording, the document to attach, and anything a person should know first. */
function draft(i) {
  const c = q.customer(i.customerId) || { name: 'Customer', id: null }, t = typeOf(i), d = t.doc ? docOf(t.doc) : null, f = first(i.who) || 'there', flags = [], exp = d && d.expires ? D.diff(d.expires, today()) : null; let text;
  const kind = d ? d.id : i.type;
  if (kind === 'coi') { text = 'Hi ' + f + ', our certificate of insurance is attached' + (i.holder ? ', with ' + i.holder + ' listed as the certificate holder' : '') + '.' + (d.expires && exp >= 0 ? ' It is valid through ' + fmt.day(d.expires, 'long') + '.' : '') + ' Tell me if the building needs different wording.'; flags.push(i.holder ? 'Certificate holder: ' + i.holder : 'No certificate holder was named, so it goes out as a general certificate.'); }
  else if (kind === 'w9') text = 'Hi ' + f + ', our signed W-9 is attached for your accounts payable team. Tell me if they also need the vendor form filled in.';
  else if (kind === 'cod') { const j = c.id ? q.jobsForCustomer(c.id).filter(x => x.status === 'completed').sort((a, b) => b.day.localeCompare(a.day))[0] : null; text = 'Hi ' + f + ', attached is the certificate of destruction for ' + (j ? 'your visit on ' + fmt.day(j.day, 'long') : 'your last visit') + '. Every certificate is also in your customer portal under Documents.'; if (!j) flags.push('No completed visit found for this customer. Check which visit they mean.'); }
  else if (kind === 'statement') { const open = (data.invoices || []).filter(v => v.customerId === c.id && v.status !== 'Paid' && v.status !== 'Draft'), sum = open.reduce((s, v) => s + v.amount, 0); text = 'Hi ' + f + ', attached is your statement. ' + (open.length ? 'There ' + (open.length === 1 ? 'is 1 open invoice' : 'are ' + open.length + ' open invoices') + ' for a total of ' + money(sum) + '.' : 'Nothing is open: every invoice is paid.') + ' Copies of each invoice are in the same file.'; }
  else if (kind === 'vendor') { text = 'Hi ' + f + ', our vendor packet is attached: W-9, certificate of insurance, business license and references. If your system needs its own form, send it over and we will fill it in.'; const coi = docOf('coi'), e = coi && coi.expires ? D.diff(coi.expires, today()) : null; if (e != null && e <= 30) flags.push('The COI inside the packet expires in ' + plural(Math.max(0, e), 'day') + '.'); }
  else if (i.type === 'pickup') { const day = bizDay(2); text = 'Hi ' + f + ', we can add an extra pickup on ' + fmt.day(day, 'long') + '. It is billed at your usual rate for each container. Reply to confirm and it goes on the schedule.'; flags.push('Needs a job on the schedule once they confirm.'); }
  else if (i.type === 'container') text = 'Hi ' + f + ', we can make that change on your next visit. There is no charge for the swap; the new container is billed at its usual rate from then on. Which room should it go in?';
  else if (i.type === 'contact') text = 'Hi ' + f + ', thank you for letting us know. Send the new name, email and phone number and we will update your account and the visit reminders.';
  else if (i.type === 'complaint') { text = 'Hi ' + f + ', I am sorry about that. A manager will call you today to put it right.'; flags.push('A complaint: a person should call. The reply only says a call is coming.'); }
  else if (i.type === 'price') text = 'Hi ' + f + ', thank you for asking. An added container is billed at your current rate for that size on each visit, with no setup fee. I can add it to your next visit if you like.';
  else text = 'Hi ' + f + ', thank you for your message. We are on it and will get back to you by ' + fmt.day(i.due, 'long') + '.';
  if (kind === 'coi' && exp != null) { if (exp < 0) flags.push('The COI on file expired on ' + md(d.expires) + '. Get the renewal before sending.'); else if (exp <= 30) flags.push('The COI on file expires in ' + plural(exp, 'day') + ' (' + md(d.expires) + '). Ask your insurance agent for the renewal.'); }
  return { text: text + '\n\n' + first(me()) + '\n' + org().name, doc: d, flags, expired: kind === 'coi' && exp != null && exp < 0 };
}
function docPreview(d, i) { const o = org(), c = i && q.customer(i.customerId);
  return h('div.x-doc', h('h4', d.name), h('small', o.name + (o.phone ? ' · ' + o.phone : '')), d.detail && h('p', d.detail),
    h('table', d.file && tr('File', d.file), d.expires && tr('Valid through', fmt.day(d.expires, 'long')), d.updated && tr('Updated', d.updated), i && i.holder && d.id === 'coi' && tr('Certificate holder', i.holder), d.perCustomer && c && tr('Prepared for', c.name))); }
/** Send a document: the request is done and the customer's timeline says what went out. */
function sendDoc(i, d, o = {}) { const to = o.to || emailFor(i); if (!to || !d) return false;
  Object.assign(i, { status: 'done', doneAt: now(), doc: d.id, sentTo: to }); i.notes.push({ at: now(), by: o.by || me(), text: 'Sent ' + d.name + ' to ' + to + '.' });
  say(i.customerId, 'Customer request answered (' + typeOf(i).name + '): ' + d.name + ' emailed to ' + to + (d.id === 'coi' && i.holder ? ' · certificate holder: ' + i.holder : '') + '.', o.by); return true; }
function sendReply(i, text, o = {}) { const to = emailFor(i); if (!to) return false; i.notes.push({ at: now(), by: o.by || me(), text: 'Replied by email: ' + String(text).split('\n')[0] }); if (i.status === 'new') i.status = o.status || 'progress';
  say(i.customerId, 'Customer request (' + typeOf(i).name + '): reply emailed to ' + to + '.', o.by); return true; }
function sendDocSheet(i, done) {
  const dr = draft(i); let docId = (dr.doc || docs()[0] || {}).id, to = emailFor(i), text = dr.text;
  ui.sheet({ title: 'Send a document', leading: [{ label: 'Cancel', onTap: pg => pg.dismiss() }],
    trailing: [{ label: 'Send', bold: true, onTap: async pg => { const d = docOf(docId); if (!d) return; if (!/@/.test(to)) return ui.alert({ title: 'No email address', message: 'Add the address to send it to.' });
      if (!await ui.run('Sending the ' + (d.short || d.name) + '…', () => sendDoc(i, d, { to }), { done: 'Sent' })) return; pg.dismiss(); ui.toast((d.short || d.name) + ' sent to ' + to + ' · request done', 'envelope', 3000); done && done(); } }],
    render: pg => { const d = docOf(docId) || {}, exp = d.expires ? D.diff(d.expires, today()) : null;
      return ui.list(ui.section({ header: 'Document', fold: false, showFooter: true, footer: exp != null && exp <= 30 ? (exp < 0 ? 'This document has expired.' : 'This document expires in ' + plural(exp, 'day') + '.') + ' Replace it in Settings → CRM → Company documents.' : null },
          ui.pickerRow({ title: 'Send', value: docId, options: docs().map(x => ({ value: x.id, label: x.name })), onChange: v => { docId = v; pg.refresh(); } })),
        d.id ? docPreview(d, i) : null,
        ui.section({ header: 'To', fold: false }, ui.inputRow({ label: 'Email', type: 'email', caps: 'off', value: to, onInput: v => { to = v.trim(); } }),
          d.id === 'coi' && ui.inputRow({ label: 'Holder', placeholder: 'Certificate holder, if they named one', value: i.holder || '', onInput: v => { i.holder = v; } })),
        ui.section({ header: 'Message', fold: false, showFooter: true, footer: 'Sending marks the request done and logs it on the customer’s timeline.' }, ui.inputRow({ multiline: true, value: text, onInput: v => { text = v; } }))); } }, { detent: 'large' });
}
function pickCustomerSpec(done) { let text = '';
  return { title: 'Customer', search: { placeholder: 'Search customers', onInput: (v, p) => { text = v.trim().toLowerCase(); p.refresh(); } },
    render: p => { const list = data.customers.filter(c => (text ? c.name.toLowerCase().includes(text) : ['customer', 'serviced'].includes(c.lifecycle))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
      return ui.list(ui.section({ fold: false }, list.map(c => ui.row({ leading: ui.avatar(c.name, { size: 34 }), title: c.name, subtitle: (c.locations[0] || {}).address, onTap: () => { done(c); p.pop(); } })), !list.length && ui.row({ title: 'Nobody matches' }))); } }; }
C2.newInquiry = (pre = {}) => {
  const f = { customerId: pre.customerId || null, type: pre.type || 'coi', who: '', email: '', channel: 'call', owner: S.me.id, text: '', holder: '', due: null }, c0 = f.customerId && q.customer(f.customerId);
  if (c0) { f.who = (c0.contacts[0] || {}).name || ''; f.email = (c0.contacts[0] || {}).email || ''; }
  const dueFor = () => f.due || bizDay((types().find(t => t.id === f.type) || { days: 2 }).days);
  ui.sheet({ title: 'New customer request', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Add', bold: true, onTap: async p => { if (!f.customerId) return ui.toast('Choose the customer', 'person'); let i = null;
      if (!await ui.run('Adding request…', () => { i = { id: 'iq' + Date.now().toString(36), customerId: f.customerId, type: f.type, who: f.who.trim() || 'Front desk', email: f.email.trim(), channel: f.channel, at: now(), due: dueFor(), owner: f.owner, status: 'new', text: f.text.trim() || typeOf(f).name, holder: f.holder.trim() || (f.type === 'coi' ? holderIn(f.text) : ''), doc: null, doneAt: null, notes: [] }; inq().push(i); }, { done: 'Request added' })) return;
      p.dismiss(); setTimeout(() => WD.nav.push(C2.inquirySpec(i.id)), 400); } }],
    render: p => { const c = f.customerId && q.customer(f.customerId);
      return ui.list(
        ui.section({ header: 'Who is asking', fold: false }, ui.row({ icon: 'building', iconColor: 'var(--blue)', title: c ? c.name : 'Choose the customer', subtitle: c ? (c.locations[0] || {}).address : null, tint: !c, chevron: true, onTap: () => p.push(pickCustomerSpec(x => { f.customerId = x.id; f.who = (x.contacts[0] || {}).name || ''; f.email = (x.contacts[0] || {}).email || ''; })) }),
          ui.inputRow({ label: 'Asked by', placeholder: 'Name', caps: 'words', value: f.who, onInput: v => { f.who = v; } }), ui.inputRow({ label: 'Email', type: 'email', caps: 'off', placeholder: 'Where the answer goes', value: f.email, onInput: v => { f.email = v; } }),
          ui.pickerRow({ title: 'Came in by', value: f.channel, options: Object.keys(CH).map(k => ({ value: k, label: CH[k][0], icon: CH[k][1] })), onChange: v => { f.channel = v; p.refresh(); } })),
        ui.section({ header: 'What they need', fold: false },
          ui.pickerRow({ title: 'Type', value: f.type, options: types().map(t => ({ value: t.id, label: t.name })), onChange: v => { f.type = v; p.refresh(); } }),
          f.type === 'coi' && ui.inputRow({ label: 'Holder', placeholder: 'Certificate holder, if they named one', value: f.holder, onInput: v => { f.holder = v; } }),
          ui.inputRow({ multiline: true, placeholder: 'What did they ask for?', value: f.text, onInput: v => { f.text = v; } })),
        ui.section({ header: 'Who handles it', fold: false },
          ui.pickerRow({ title: 'Assigned to', value: f.owner, options: owners().map(u => ({ value: u.id, label: u.name })), onChange: v => { f.owner = v; p.refresh(); } }),
          ui.dateRow({ title: 'Due', value: dueFor(), onChange: v => { f.due = v; p.refresh(); } }))); } }, { detent: 'large' });
};
C2.inquirySpec = id => ({ title: 'Customer request', render: page => { const i = inq().find(x => x.id === id); if (!i) return ui.empty({ icon: 'tray', title: 'Request not found' });
  const c = q.customer(i.customerId), t = typeOf(i), d = t.doc ? docOf(t.doc) : null, edit = canEdit(), late = overdue(i), re = () => { WD.changed(); page.refresh(); }, p = c && (c.contacts.find(x => x.name === i.who) || c.contacts[0]) || {};
  const dr = aiOn() && i.status !== 'done' ? draft(i) : null;
  const aiSend = async () => { if (dr.expired) return ui.alert({ title: 'The COI has expired', message: 'Replace it in Settings → CRM → Company documents, then send it.' }); const to = emailFor(i); if (!to) return ui.alert({ title: 'No email address', message: 'Add the requester’s email to the customer, or send it yourself.' });
    if (!await ui.actionSheet({ title: dr.doc ? 'Send the ' + (dr.doc.short || dr.doc.name) + ' to ' + to + '?' : 'Send this reply to ' + to + '?', message: dr.doc ? 'The request is marked done and logged on the customer’s timeline.' : 'The request moves to In progress.', buttons: [{ label: 'Send', value: true }] })) return;
    if (await ui.run('Sending…', () => dr.doc ? sendDoc(i, dr.doc, { to }) : sendReply(i, dr.text), { done: 'Sent' })) { logAI(dr.doc ? 'Sent the ' + (dr.doc.short || dr.doc.name) : 'Sent the reply', custName(i), 'auto'); page.refresh(); } };
  return [h('div.cr-head', h('span.headline', c ? c.name : 'Customer removed'), h('span.spacer'), late && ui.badge('Overdue ' + plural(D.diff(today(), i.due), 'day'), 'var(--red)'), ui.badge(IS[i.status][0], IS[i.status][1])),
    h('div.footnote', { style: 'padding:0 16px 2px' }, t.name + ' · ' + i.who + ' by ' + CH[i.channel][0].toLowerCase() + ' · ' + fmt.rel(i.at).toLowerCase()),
    dr && h('div.c2-pad', AIP.card({ title: 'AI Premium · reply ready', text: h('div.c2-ask', dr.text), lines: (dr.doc ? ['Attached: ' + dr.doc.name + (dr.doc.file ? ' (' + dr.doc.file + ')' : '')] : []).concat(dr.flags),
      action: edit ? ui.button(dr.doc ? 'Send the ' + (dr.doc.short || dr.doc.name) + ' now' : 'Send this reply', { icon: 'envelope', kind: 'filled', onTap: aiSend }) : null })),
    ui.list(
      ui.section({ header: 'What they asked', fold: false }, ui.row({ title: h('div.c2-ask', i.text) }),
        i.type === 'coi' && (edit ? ui.inputRow({ label: 'Holder', placeholder: 'Certificate holder', value: i.holder || '', onInput: v => { i.holder = v; } }) : i.holder ? ui.row({ title: 'Certificate holder', detail: i.holder }) : null)),
      edit && i.status !== 'done' && ui.section({ header: 'Answer it', fold: false },
        d && ui.row({ icon: 'envelope', iconColor: 'var(--green)', title: 'Send the ' + (d.short || d.name), subtitle: (d.file || 'Made for this customer') + (d.expires ? ' · valid through ' + md(d.expires) : '') + ' · to ' + (emailFor(i) || 'no email on file'), chevron: true, onTap: () => sendDocSheet(i, () => page.refresh()) }),
        !d && ui.row({ icon: 'doc', iconPlain: true, title: 'Send a company document…', tint: true, onTap: () => sendDocSheet(i, () => page.refresh()) }),
        t.job && ui.row({ icon: 'truck', iconColor: 'var(--blue)', title: i.type === 'pickup' ? 'Create the extra pickup' : 'Create a job for this', subtitle: 'Opens a new job for ' + (c ? c.name : 'the customer'), chevron: true, disabled: !c, onTap: () => { if (!(WD.screens.jobs && WD.screens.jobs.openEditor)) return; if (i.status === 'new') i.status = 'progress'; i.notes.push({ at: now(), by: me(), text: 'Started a job from this request.' }); WD.changed(); WD.screens.jobs.openEditor({ customerId: c.id }); } }),
        ui.row({ icon: 'phone.fill', iconPlain: true, title: 'Call ' + (first(i.who) || 'them'), tint: true, disabled: !c || !p.phone, onTap: () => K().startCall && K().startCall(c, p) }),
        ui.row({ icon: 'checkmark.circle', iconPlain: true, title: 'Mark done', tint: true, onTap: async () => { if (await ui.run('Saving…', () => { i.status = 'done'; i.doneAt = now(); i.notes.push({ at: now(), by: me(), text: 'Marked done.' }); say(i.customerId, 'Customer request closed (' + t.name + ').'); }, { done: 'Done' })) page.refresh(); } })),
      ui.section({ header: 'Details', fold: false },
        ui.pickerRow({ title: 'Status', disabled: !edit, value: i.status, options: ISK.map(k => ({ value: k, label: IS[k][0] })), onChange: v => { i.status = v; i.doneAt = v === 'done' ? now() : null; re(); } }),
        ui.pickerRow({ title: 'Assigned to', disabled: !edit, value: i.owner, options: owners().map(u => ({ value: u.id, label: u.name })), onChange: v => { i.owner = v; i.notes.push({ at: now(), by: me(), text: 'Reassigned to ' + staff(v) + '.' }); re(); ui.toast('Assigned to ' + first(staff(v)), 'person'); } }),
        edit ? ui.dateRow({ title: 'Due', value: i.due, onChange: v => { i.due = v; re(); } }) : ui.row({ title: 'Due', detail: fmt.day(i.due, 'rel') || md(i.due) }),
        ui.pickerRow({ title: 'Type', disabled: !edit, value: i.type, options: types().map(x => ({ value: x.id, label: x.name })), onChange: v => { i.type = v; re(); } }),
        ui.row({ title: 'Received', detail: fmt.rel(i.at) + ' · ' + CH[i.channel][0].toLowerCase() }), i.sentTo && ui.row({ title: 'Sent', subtitle: (docOf(i.doc) || {}).name, detail: i.sentTo })),
      ui.section({ header: 'Notes', fold: false }, i.notes.slice().reverse().map(n => ui.row({ title: n.text, subtitle: n.by + ' · ' + fmt.rel(n.at) })),
        edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a note', tint: true, onTap: async () => { const v = await ask('Note', 'What happened?', '', custName(i)); if (v) { i.notes.push({ at: now(), by: me(), text: v }); re(); } } })),
      ui.section(null, c && WD.can('crm.view') && ui.row({ title: 'Open ' + c.name, subtitle: 'Contacts, timeline, documents', chevron: true, onTap: () => WD.screens.customers.openDetail(c.id) }),
        edit && ui.row({ title: 'Delete request', destructive: true, onTap: async () => { if (!await ui.actionSheet({ title: 'Delete this request?', message: 'It is removed from Customer needs. The customer’s timeline is not changed.', buttons: [{ label: 'Delete', value: true, role: 'destructive' }] })) return; data.inquiries = inq().filter(x => x !== i); WD.changed(); page.pop(); } })))];
} });
const inqFiltered = () => inq().filter(i => (N.type === 'all' || i.type === N.type) && (N.owner === 'all' || i.owner === N.owner));
function inqRow(i) { const t = typeOf(i), late = overdue(i), r = ui.row({ icon: t.icon || 'tray', iconColor: IS[i.status][1], title: custName(i), subtitle: [h('div', t.name + ' · ' + i.who + ' · ' + CH[i.channel][0].toLowerCase()), h('div.cr-sit', i.text.length > 90 ? i.text.slice(0, 88) + '…' : i.text), h('div', i.status === 'done' ? 'Done ' + (i.doneAt ? fmt.rel(i.doneAt).toLowerCase() : '') : 'Due ' + (fmt.day(i.due, 'rel') || md(i.due)).toLowerCase() + ' · ' + first(staff(i.owner)))],
    badge: late ? ui.badge('Overdue ' + plural(D.diff(today(), i.due), 'day'), 'var(--red)') : null, chevron: true, onTap: () => WD.nav.push(C2.inquirySpec(i.id)) }); if (late) r.classList.add('c2-over'); return r; }
const inqCols = () => [
  { k: 'customer', label: 'Customer', val: custName, cls: 'b' }, { k: 'type', label: 'Type', val: i => typeOf(i).name }, { k: 'who', label: 'Asked by', val: i => i.who }, { k: 'channel', label: 'Channel', val: i => CH[i.channel][0] },
  { k: 'at', label: 'Received', val: i => i.at, text: i => fmt.rel(i.at), csv: i => D.key(new Date(i.at)) }, { k: 'due', label: 'Due', val: i => i.due, text: i => md(i.due), cls: i => overdue(i) ? 'late' : '' },
  { k: 'owner', label: 'Assigned to', val: i => staff(i.owner), node: i => canEdit() ? sel(owners().map(u => [u.id, u.name]), i.owner, v => { i.owner = v; WD.changed(); }) : staff(i.owner) },
  { k: 'status', label: 'Status', val: i => ISK.indexOf(i.status), csv: i => IS[i.status][0], text: i => IS[i.status][0], node: i => canEdit() ? sel(ISK.map(k => [k, IS[k][0]]), i.status, v => { i.status = v; i.doneAt = v === 'done' ? now() : null; WD.changed(); }) : IS[i.status][0] },
  { k: 'text', label: 'Request', val: i => i.text }, { k: 'doc', label: 'Document sent', val: i => i.sentTo ? (docOf(i.doc) || {}).name || '' : '' }];
C2.needsView = page => {
  const all = inq(), list = inqFiltered(), open = list.filter(i => i.status !== 'done'), late = open.filter(overdue), dueToday = open.filter(i => i.due === today()), wk = list.filter(i => i.status === 'done' && i.doneAt && daysAgo(i.doneAt) < 7), edit = canEdit();
  const tiles = h('div.co-tiles', h('div', h('b', String(open.length)), h('span', 'Open')), h('div', h('b', { style: late.length ? 'color:var(--red)' : null }, String(late.length)), h('span', 'Overdue')), h('div', h('b', String(dueToday.length)), h('span', 'Due today')), h('div', h('b', String(wk.length)), h('span', 'Done this week')));
  const tName = N.type === 'all' ? 'All types' : (types().find(t => t.id === N.type) || { name: 'All types' }).name, oName = N.owner === 'all' ? 'Everyone' : staff(N.owner);
  const filters = h('div.c2-filters', h('button.c2-fb' + (N.type !== 'all' ? '.on' : ''), { 'aria-label': 'Filter by type: ' + tName, onclick: e => ui.menu(e.currentTarget, [{ label: 'All types', checked: N.type === 'all', onTap: () => { N.type = 'all'; page.refresh(); } }].concat(types().map(t => ({ label: t.name + ' · ' + all.filter(i => i.type === t.id && i.status !== 'done').length, checked: N.type === t.id, onTap: () => { N.type = t.id; page.refresh(); } })))) }, h('span', tName), icon('chevron.up.chevron.down', 14)),
    h('button.c2-fb' + (N.owner !== 'all' ? '.on' : ''), { 'aria-label': 'Filter by person: ' + oName, onclick: e => ui.menu(e.currentTarget, [{ label: 'Everyone', checked: N.owner === 'all', onTap: () => { N.owner = 'all'; page.refresh(); } }].concat(owners().map(u => ({ label: u.name + ' · ' + all.filter(i => i.owner === u.id && i.status !== 'done').length, checked: N.owner === u.id, onTap: () => { N.owner = u.id; page.refresh(); } })))) }, h('span', oName), icon('chevron.up.chevron.down', 14)));
  const can = aiOn() ? open.map(i => ({ i, r: recommendInq(i) })).filter(x => x.r && x.r.auto) : [];
  const aiCard = can.length ? AIP.card({ title: 'AI Premium', text: 'It can answer ' + plural(can.length, 'request') + ' now: ' + can.slice(0, 3).map(x => custName(x.i) + ' (' + x.r.label.toLowerCase() + ')').join(', ') + (can.length > 3 ? '…' : '.'), action: edit ? ui.button('Review and approve', { icon: 'sparkles', kind: 'filled', onTap: () => page.push(C2.reviewSpec()) }) : null }) : null;
  const sections = () => [ISK.map(k => { const xs = list.filter(i => i.status === k).sort((a, b) => k === 'done' ? (b.doneAt || 0) - (a.doneAt || 0) : a.due.localeCompare(b.due) || a.at - b.at);
      return xs.length ? ui.section({ header: IS[k][0] + ' · ' + xs.length, fold: true, folded: k === 'done', foldKey: 'needs-' + k }, xs.map(inqRow)) : null; }),
    !list.length && ui.empty({ icon: 'tray', title: all.length ? 'Nothing matches the filter' : 'No customer requests', text: all.length ? 'Choose All types and Everyone to see every request.' : 'Requests from customers land here: a COI, a W-9, an extra pickup.' }),
    admin() && ui.section({ fold: false }, ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'Company documents', subtitle: docs().filter(d => d.file).map(d => d.short || d.name).join(', '), chevron: true, onTap: () => page.push(C2.docsSpec()) }),
      ui.row({ icon: 'list.bullet', iconColor: 'var(--teal)', title: 'Request types', detail: String(types().length), chevron: true, onTap: () => page.push(C2.typesSpec()) }))];
  if (!S.desktop) return ui.list(ui.section(null, tiles), filters, aiCard && h('div', { style: 'padding-top:10px' }, aiCard), sections());
  return h('div.wide.c2-desk', h('div.c2-dash', { style: 'grid-template-columns:minmax(0,1fr) minmax(0,1fr)' }, h('div.c2-card', h('h4', 'Requests'), tiles), h('div.c2-card', h('h4', 'Open requests by type'), typeBars(t => { N.type = N.type === t ? 'all' : t; page.refresh(); }, N.type))),
    aiCard && h('div', { style: 'padding-top:12px;max-width:860px' }, aiCard),
    h('div.c2-tool', ui.segmented([{ value: 'list', label: 'List' }, { value: 'sheet', label: 'Spreadsheet' }], N.view, v => { N.view = v; page.refresh(); }), h('div', { style: 'width:420px' }, filters)),
    N.view === 'sheet' ? sheet({ st: N.sheet, cols: inqCols(), rows: inqFiltered, open: i => WD.nav.push(C2.inquirySpec(i.id)), file: 'customer-requests.csv', rowClass: i => overdue(i) ? 'over' : '' }) : ui.list(sections()));
};
const typeBars = (pick, cur) => { const open = inq().filter(i => i.status !== 'done'), rows = types().map(t => ({ t, n: open.filter(i => i.type === t.id).length, late: open.filter(i => i.type === t.id && overdue(i)).length })).filter(r => r.n), max = Math.max(1, ...rows.map(r => r.n));
  return rows.length ? h('div', rows.map(r => h('button.c2-bar' + (cur === r.t.id ? '.on' : ''), { 'aria-label': r.t.name + ': ' + r.n + ' open', onclick: () => pick(r.t.id) }, h('span.l', r.t.name), h('span.t', h('i', { style: { width: Math.round(r.n / max * 100) + '%', '--c': r.late ? 'var(--red)' : 'var(--teal)' } })), h('span.n', r.n + (r.late ? ' · ' + r.late + ' late' : ''))))) : h('div.c2-cnt', 'Nothing open'); };

/* ---------- Settings: request types and company documents ---------- */
C2.typesSpec = () => ({ title: 'Customer request types', render: page => { if (!admin()) return ui.empty({ icon: 'lock', title: 'Ask an admin' }); const re = () => { WD.changed(); page.refresh(); };
  const editSpec = t => ({ title: () => t.name, render: pg => { const r2 = () => { WD.changed(); pg.refresh(); }; return ui.list(
    ui.section({ fold: false }, ui.inputRow({ label: 'Name', value: t.name, onInput: v => { t.name = v; } }),
      ui.row({ title: 'Answer within', detail: plural(t.days, 'business day'), trailing: ui.stepper(t.days, 1, 30, v => { t.days = v; r2(); }) }),
      ui.pickerRow({ title: 'Document to send', value: t.doc || '', options: [{ value: '', label: 'None' }].concat(docs().map(d => ({ value: d.id, label: d.name }))), onChange: v => { t.doc = v || null; r2(); } }),
      ui.toggleRow({ title: 'Usually needs a job', subtitle: 'Shows “Create a job” on the request', value: !!t.job, onChange: v => { t.job = v; r2(); } })),
    ui.section(null, ui.row({ title: 'Delete type', destructive: true, disabled: inq().some(i => i.type === t.id && i.status !== 'done'), subtitle: inq().some(i => i.type === t.id && i.status !== 'done') ? 'Open requests still use it' : null, onTap: () => { data.inquiryTypes = types().filter(x => x !== t); WD.changed(); pg.pop(); } }))); } });
  return ui.list(note('The kinds of request a customer makes. Each has a time to answer within and, when it is a paperwork request, the company document that answers it.'),
    ui.section({ fold: false }, types().map(t => ui.row({ icon: t.icon || 'tray', iconColor: 'var(--teal)', title: t.name, subtitle: 'Within ' + plural(t.days, 'business day') + (t.doc && docOf(t.doc) ? ' · sends ' + (docOf(t.doc).short || docOf(t.doc).name) : '') + (t.job ? ' · needs a job' : ''), chevron: true, onTap: () => page.push(editSpec(t)) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a type', tint: true, onTap: async () => { const v = await ask('New request type', 'Proof of service letter'); if (v) { types().push({ id: 'ty' + Date.now().toString(36), name: v, doc: null, days: 2, job: false, icon: 'tray' }); re(); } } }))); } });
C2.docsSpec = () => ({ title: 'Company documents', render: page => { if (!admin()) return ui.empty({ icon: 'lock', title: 'Ask an admin' }); const re = () => { WD.changed(); page.refresh(); };
  return ui.list(note('The standing documents customers ask for. Keep them current here and they can be sent from a customer request with one tap.'),
    docs().map(d => { const exp = d.expires ? D.diff(d.expires, today()) : null; return ui.section({ header: d.name, fold: false, showFooter: true, footer: exp != null && exp <= 30 ? (exp < 0 ? 'Expired. ' : 'Expires in ' + plural(exp, 'day') + '. ') + 'Ask your insurance agent for the renewal and replace the file.' : null },
      ui.row({ icon: 'doc', iconColor: exp != null && exp <= 30 ? 'var(--red)' : 'var(--indigo)', title: d.file || 'Made for each customer', subtitle: d.detail, badge: exp != null && exp <= 30 ? ui.badge(exp < 0 ? 'Expired' : 'Expires soon', 'var(--red)') : null }),
      d.expires != null && ui.dateRow({ title: 'Valid through', value: d.expires, onChange: v => { d.expires = v; re(); } }),
      d.file && ui.row({ icon: 'arrow.clockwise', iconPlain: true, title: 'Replace the file', tint: true, onTap: async () => { if (await ui.run('Uploading…', () => { d.updated = fmt.day(today(), 'long'); if (d.expires && D.diff(d.expires, today()) <= 30) d.expires = D.add(today(), 365); }, { done: 'Replaced' })) page.refresh(); } }),
      d.file && !['coi', 'w9', 'vendor'].includes(d.id) && ui.row({ title: 'Remove', destructive: true, onTap: () => { data.companyDocs = docs().filter(x => x !== d); re(); } })); }),
    ui.section(null, ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a document', tint: true, onTap: async () => { const v = await ask('New document', 'Business license'); if (v && await ui.run('Uploading…', () => { docs().push({ id: 'dc' + Date.now().toString(36), name: v, short: v.toLowerCase(), file: v.replace(/\s+/g, '-') + '.pdf', updated: fmt.day(today(), 'long'), detail: 'Added by ' + me() + '.' }); }, { done: 'Added' })) page.refresh(); } }))); } });

/* ================= Key accounts ================= */
const vips = () => (X().pipe ? X().pipe() : []).filter(c => c.vip).sort((a, b) => (b.estValue || 0) - (a.estValue || 0));
const daysInStage = c => { const moved = data.interactions.filter(i => i.customerId === c.id && i.type === 'note' && /^Moved to /.test(i.text || '')).reduce((m, i) => Math.max(m, i.at), 0); return daysAgo(c.stageSince || moved || c.createdAt || now()); };
function vipCard(c, full) { const x = X(), lc = x.lastContact(c), late = c.nextAction && c.nextAction <= today() && !['scheduled', 'lost'].includes(c.lifecycle), val = c.estValue || x.quoteValue(c) * 12;
  const fact = (label, value, cls) => h('div' + (cls || ''), h('small', label), h('span', value));
  return h('div.c2-vip' + (full ? '.full' : ''), { role: 'button', tabindex: '0', 'aria-label': 'Key account ' + c.name, onclick: () => openLead(c.id) },
    h('div.c2-vip-t', icon('star.fill', 15), h('b', c.name), ui.badge(K().LC[c.lifecycle][0], K().LC[c.lifecycle][1])),
    h('div.c2-vip-v', val ? money(val) : 'Value not set', val ? h('small', ' a year, estimated') : null),
    h('div.c2-facts', fact('Decision maker', c.decider || (c.contacts[0] || {}).name || 'Not known yet'), fact('Assigned to', staff(c.owner)),
      fact('Next step', (c.nextAction ? md(c.nextAction) + ' · ' : '') + (c.nextStep || x.situation(c)), '.w' + (late ? '.late' : '')),
      fact('In this stage', plural(daysInStage(c), 'day')), fact('Last touch', lc ? first(lc.by) + ' ' + lc.how + ' ' + x.ago(lc.at) : 'Nobody yet'),
      c.plan ? fact('Plan', c.plan, '.w') : null));
}
/** Leads side, above everything: the AI review card and the key accounts. Not affected by the stage, priority or source filters. */
C2.leadsTop = page => { const v = vips(), total = v.reduce((s, c) => s + (c.estValue || 0), 0);
  return [aiOn() && canEdit() ? reviewCard(page) : null,
    v.length ? h('div.c2-key', h('div.c2-key-h', icon('star.fill', 16), h('b', 'Key accounts in play'), h('span.v', v.length + (total ? ' · ' + money(total) + ' a year' : '')), h('button.cu-link', { 'aria-label': 'See all key accounts', onclick: () => page.push(C2.vipSpec()) }, 'See all')), h('div.c2-key-s', v.map(c => vipCard(c)))) : null]; };
C2.vipSpec = () => ({ title: 'Key accounts', render: page => { const x = X(), v = vips(), total = v.reduce((s, c) => s + (c.estValue || 0), 0), quoted = v.reduce((s, c) => s + x.quoteValue(c), 0), due = v.filter(c => x.isDue(c)).length;
  return ui.list(ui.section(null, h('div.co-tiles', h('div', h('b', String(v.length)), h('span', 'In play')), h('div', h('b', money(total)), h('span', 'A year')), h('div', h('b', money(quoted)), h('span', 'Quoted')), h('div', h('b', { style: due ? 'color:var(--red)' : null }, String(due)), h('span', 'Due')))),
    v.map(c => vipCard(c, true)), !v.length && ui.empty({ icon: 'star', title: 'No key accounts', text: 'Flag a lead as a key account from its page or from the ••• menu on the pipeline.' }),
    v.length > 0 && note('A key account is a lead worth far more than the rest. The flag is separate from priority: it keeps the lead at the top of the Leads side whatever the filters say. Set it on the lead’s page (VIP) or from the ••• menu on the pipeline.')); } });
/** Lead page: the key-account fields. */
C2.vipSection = (c, page, edit) => ui.section({ header: 'Key account', fold: false, showFooter: true, footer: plural(daysInStage(c), 'day') + ' in this stage. These show on the key-account card at the top of Leads.' },
  edit ? ui.inputRow({ label: 'Worth a year', inputmode: 'numeric', placeholder: '$', value: c.estValue ? String(c.estValue) : '', onInput: v => { c.estValue = +String(v).replace(/[^0-9.]/g, '') || 0; } }) : ui.row({ title: 'Worth a year', detail: c.estValue ? money(c.estValue) : 'Not set' }),
  edit ? ui.inputRow({ label: 'Decides', placeholder: 'Who signs', caps: 'words', value: c.decider || '', onInput: v => { c.decider = v; } }) : ui.row({ title: 'Decision maker', detail: c.decider || 'Not known' }),
  edit ? ui.inputRow({ label: 'Next step', placeholder: 'What happens next', value: c.nextStep || '', onInput: v => { c.nextStep = v; } }) : ui.row({ title: 'Next step', subtitle: c.nextStep || 'Not set' }),
  edit ? ui.inputRow({ multiline: true, placeholder: 'The plan to win this account', value: c.plan || '', onInput: v => { c.plan = v; } }) : c.plan ? ui.row({ title: 'Plan', subtitle: c.plan }) : null);

/* ================= AI Premium: what to do next for a lead or a request ================= */
const logAI = (label, target, how, cid) => aiLog().unshift({ at: now(), by: me(), label, target, how, customerId: cid || null });
/** Send the follow-up that fits without opening the sheet (used when a person has approved it in the review). */
function silentFollow(c) { const x = X(), t = CO.tpl ? CO.tpl(x.suggest(c)[0]) : null, p = c.contacts[0] || {}, ST = data.settings.crm; if (!t || !t.body) return false;
  const email = t.channel === 'email', to = email ? p.email : p.phone && fmt.phone(p.phone); if (!to) return false;
  const text = CO.fill(t.body, CO.ctxFor(c, { customer: c.name, link: 'https://go.discountshred.example/q/' + c.id })).replace(/\s+/g, ' ');
  say(c.id, 'Follow-up sent (“' + t.name + '”, ' + (email ? 'email' : 'text') + ' to ' + to + '): ' + text.slice(0, 110) + (text.length > 110 ? '…' : '') + ' Sent by AI Premium after approval.');
  c.followUps = (c.followUps || 0) + 1; c.lastFollowAt = now(); if (c.lifecycle === 'lead') c.lifecycle = 'contacted'; if (ST.features.reminders) c.nextAction = D.add(today(), ST.remindDays); return true; }
function sendQuoteNow(c, qt) { const ST = data.settings.crm, p = c.contacts[0] || {}; if (!p.email) return false; qt.status = 'sent'; qt.sentAt = now(); if (c.lifecycle === 'lead' || c.lifecycle === 'contacted') { c.lifecycle = 'quoted'; c.stageSince = now(); } if (ST.features.reminders) c.nextAction = D.add(today(), ST.remindDays);
  say(c.id, 'Quote ' + qt.number + ' sent · ' + money(X().qTotal(qt)) + ' to ' + p.email + '.'); return true; }
function sendAgreementNow(c) { const EX = WD.x || {}, p = c.contacts[0] || {}, to = c.billingEmail || p.email; if (!EX.createAgreement || !to) return false; const a = EX.createAgreement(c); Object.assign(a, { status: 'sent', sentVia: 'Email', sentAt: now(), to });
  say(c.id, 'Service agreement ' + a.number + ' sent for signature to ' + to + '.'); return true; }
/** → {kind, label, reason, auto, apply() (runs it without asking), manual(page) (opens the screen where a person does it), task (the task to add)} or null. */
function recommend(c) {
  const x = X(), k = K(); if (!x.stageOf || !c || c.archived || c.lifecycle === 'lost' || !k.PIPE.includes(c.lifecycle)) return null;
  const st = x.stageOf(c), d = x.quiet(c), p = c.contacts[0] || {}, who = given(p.name) || 'them', qs = data.quotes.filter(v => v.customerId === c.id), sent = qs.find(v => v.status === 'sent'), draftQ = qs.find(v => v.status === 'draft' && v.kind !== 'bid'), bid = qs.find(v => v.kind === 'bid' && v.status === 'draft');
  const ags = (data.agreements || []).filter(a => a.customerId === c.id), call = () => k.startCall && k.startCall(c, p), followSheet = page => x.sendFollowUp(c, null, () => page && page.refresh());
  if (c.lifecycle === 'scheduled') {
    if (c.kind !== 'household' && c.type !== 'purge' && !ags.length && WD.x && WD.x.createAgreement) return { kind: 'agreement', label: 'Send the service agreement', reason: 'Won, but no service agreement has been started.', auto: !!(c.billingEmail || p.email), apply: () => sendAgreementNow(c), task: 'Send the service agreement' };
    if (!q.jobsForCustomer(c.id).some(j => j.day >= today() && !(WD.closed || {})[j.status])) { const day = bizDay(4); return { kind: 'setup', label: 'Schedule the setup for ' + fmt.day(day, 'weekday') + ' ' + md(day), reason: 'Won' + (ags.some(a => a.status === 'signed') ? ' and signed' : '') + ', but nothing is on the schedule yet.', auto: false, manual: () => WD.screens.jobs && WD.screens.jobs.openEditor && WD.screens.jobs.openEditor({ customerId: c.id, day, type: c.type === 'purge' ? 'purge' : 'setup' }), task: 'Schedule the setup job' }; }
    return null; }
  const low = !c.lowValue && lowMatch(c); if (low) return { kind: 'low', label: 'Send the low-value auto-reply', reason: low === 'dropoff' ? 'Wants to drop off a few boxes. The drop-off hours and price answer it.' : (boxesOf(c) || 'A few') + ' boxes, one time: under the low-value limit of ' + LV().boxes + '.', auto: true, apply: () => autoReply(c, low) };
  if (x.triedAll(c) && !c.vip && x.priOf(c) !== 'high' && !sent && d >= 2) return { kind: 'archive', label: 'Archive: no reply after 3 tries', reason: 'Called, texted and emailed once. Quiet for ' + plural(d, 'day') + '.', auto: true, apply: () => { x.archive([c], 'AI review: no reply after a call, a text and an email'); return true; } };
  if (c.vip && (st === 'due' || d >= 3)) return { kind: 'escalate', label: 'Call ' + who + ' today', reason: 'Key account' + (c.estValue ? ' worth ' + money(c.estValue) + ' a year' : '') + ', ' + (d ? 'quiet for ' + plural(d, 'day') : 'follow-up is due') + '. A call from ' + first(staff(c.owner)) + ' beats another message.', auto: false, manual: call, task: 'Key account: call ' + (p.name || c.name) + ' today' };
  if (bid) return { kind: 'bid', label: 'Finish bid ' + bid.number, reason: 'The bid is still a draft' + (bid.due ? ' and is due ' + md(bid.due) + ' (' + plural(Math.max(0, D.diff(bid.due, today())), 'day') + ')' : '') + '.', auto: false, manual: () => WD.nav.push(x.quoteSpec(bid)), task: 'Finish and send bid ' + bid.number };
  if (draftQ && !sent) return { kind: 'quote', label: 'Send quote ' + draftQ.number, reason: 'The quote is written (' + money(x.qTotal(draftQ)) + ') but has not gone out.', auto: !!p.email, apply: () => sendQuoteNow(c, draftQ), manual: () => WD.nav.push(x.quoteSpec(draftQ)), task: 'Send quote ' + draftQ.number };
  if (st === 'fresh') { const last = k.timeline(c.id)[0];
    if (last && (last.type === 'voicemail' || (last.type === 'call' && last.dir === 'in'))) return { kind: 'callback', label: 'Call ' + who + ' back', reason: 'They ' + (last.type === 'voicemail' ? 'left a voicemail' : 'called') + ' ' + agoText(last.at) + ' and nobody has called back.', auto: false, manual: call, task: 'Call back ' + (p.name || c.name) };
    return { kind: 'follow', label: 'Send the first reply now', reason: 'New ' + agoText(c.createdAt || now()) + ' and nobody has replied.', auto: !!(p.phone || p.email), apply: () => silentFollow(c), manual: followSheet, task: 'Reply to the new lead' }; }
  if (st === 'due' || (sent && d >= 2)) { const [sid, why] = x.suggest(c), t = CO.tpl ? CO.tpl(sid) : { channel: 'text' }; return { kind: 'follow', label: 'Send the follow-up ' + (t.channel === 'email' ? 'email' : 'text') + ' now', reason: why + '.', auto: !!(t.channel === 'email' ? p.email : p.phone), apply: () => silentFollow(c), manual: followSheet, task: 'Follow up' }; }
  return null;
}
function recommendInq(i) { if (i.status === 'done') return null; const t = typeOf(i), d = t.doc ? docOf(t.doc) : null, c = q.customer(i.customerId), late = overdue(i), age = daysAgo(i.at), to = emailFor(i);
  if (d) { const dr = draft(i); if (dr.expired) return { kind: 'renew', label: 'Renew the COI, then send it', reason: 'The COI on file has expired.', auto: false, task: 'Get the renewed COI and send it (' + (c ? c.name : '') + ')' };
    return { kind: 'doc', label: 'Send the ' + (d.short || d.name), reason: 'Asked ' + agoText(i.at) + (late ? ', now overdue' : ', due ' + md(i.due)) + '. ' + (d.file ? 'The file is on hand.' : 'Made from their records.') + (dr.flags.length ? ' ' + dr.flags[dr.flags.length - 1] : ''), auto: !!to, apply: () => sendDoc(i, d, { to }), task: 'Send the ' + (d.short || d.name) }; }
  if (i.type === 'complaint') return { kind: 'escalate', label: 'Call ' + (first(i.who) || 'them') + ' back today', reason: 'A service complaint: it needs a person, and it has waited ' + plural(age, 'day') + '.', auto: false, task: 'Call ' + i.who + ' about the complaint' };
  if (i.status === 'waiting' && age >= 3) return { kind: 'nudge', label: 'Remind the customer', reason: 'Waiting on the customer for ' + plural(age, 'day') + '. A short reminder usually gets the answer.', auto: !!to, apply: () => { i.notes.push({ at: now(), by: me(), text: 'Reminder emailed to ' + to + ' (AI Premium).' }); say(i.customerId, 'Reminder emailed to ' + to + ' about their request (' + t.name + ').'); i.due = bizDay(2); return true; }, task: 'Remind the customer' };
  if (t.job) return { kind: 'job', label: i.type === 'pickup' ? 'Book the extra pickup' : 'Book the visit for this', reason: 'Needs a job on the schedule; a person picks the day and route.', auto: false, task: (i.type === 'pickup' ? 'Book the extra pickup' : 'Book the ' + t.name.toLowerCase()) };
  if (late) return { kind: 'late', label: 'Answer it: ' + plural(D.diff(today(), i.due), 'day') + ' overdue', reason: t.name + ', assigned to ' + first(staff(i.owner)) + '.', auto: false, task: 'Answer the overdue request (' + t.name + ')' };
  return null; }
/** Lead page: the summary and the recommended action. */
C2.leadCard = (c, page) => { if (!aiOn()) return null; const x = X(), p = c.contacts[0] || {}, l = (c.locations || [])[0] || {}, t = x.tried(c), rec = canEdit() ? recommend(c) : null, qs = data.quotes.filter(v => v.customerId === c.id), src = (x.SRC[x.sourceOf(c)] || { title: 'Phone calls' }).title.toLowerCase();
  const want = [l.containers || c.containers, c.freq && c.freq.toLowerCase()].filter(Boolean).join(', '), triedText = x.TRY.filter(([k]) => t[k]).map(([, label]) => label.toLowerCase());
  if (c.followUps) triedText.push(plural(c.followUps, 'follow-up')); if (qs.length) triedText.push(plural(qs.length, 'quote') + ' (' + qs.map(v => v.number + ' ' + v.status).join(', ') + ')');
  const perform = async () => { if (!rec) return; if (rec.kind === 'follow' || !rec.auto || !rec.apply) return rec.manual ? rec.manual(page) : ui.toast('Added nothing: this one needs a person', 'person');
    if (!await ui.actionSheet({ title: rec.label + '?', message: rec.reason + ' ' + c.name + '.', buttons: [{ label: rec.label, value: true, role: rec.kind === 'archive' ? 'destructive' : undefined }] })) return;
    let ok = false; if (!await ui.run('Working…', () => { ok = rec.apply() !== false; if (ok) logAI(rec.label, c.name, 'auto', c.id); }, { done: 'Done' })) return;
    if (!ok) return ui.alert({ title: 'Could not do it', message: 'A phone number or email is missing on this lead.' }); if (rec.kind === 'archive') { page.pop(); ui.toast(c.name + ' archived', 'tray'); } else page.refresh(); };
  return h('div.c2-pad', AIP.card({ title: 'AI summary', text: [h('b', (p.name || c.name) + (p.role ? ' (' + p.role.toLowerCase() + ')' : '')), (p.name && p.name !== c.name ? ' at ' + c.name : '') + ' came in by ' + src + (c.createdAt ? ' ' + agoText(c.createdAt) : '') + '.' + (want ? ' Wants ' + want + '.' : '') + (c.vip && c.estValue ? ' Key account, about ' + money(c.estValue) + ' a year.' : '')],
    lines: ['Where it stands: ' + x.situation(c).replace(/\.$/, '') + '.', 'Tried so far: ' + (triedText.length ? triedText.join(', ') : 'nothing yet') + '.', rec ? [h('b', 'Recommended: '), rec.label + '. ' + rec.reason] : 'Nothing to do right now: it is waiting on them.'],
    action: rec ? ui.button(rec.label, { icon: 'sparkles', kind: 'filled', onTap: perform }) : null })); };
const reviewItems = () => { const out = []; (X().pipe ? X().pipe() : []).forEach(c => { const r = recommend(c); if (r) out.push({ id: 'l' + c.id, c, cid: c.id, name: c.name, owner: c.owner, lead: true, ...r }); });
  inq().forEach(i => { const r = recommendInq(i); if (r) out.push({ id: 'q' + i.id, inq: i, cid: i.customerId, name: custName(i), owner: i.owner, lead: false, ...r }); }); return out; };
function reviewCard(page) { const it = reviewItems(), a = it.filter(i => i.auto).length; if (!it.length) return null;
  return h('div', { style: 'padding-top:10px' }, AIP.card({ title: 'AI pipeline review', text: plural(it.length, 'recommended action') + ' across your leads and customer requests: it can do ' + a + ' itself, ' + (it.length - a) + (it.length - a === 1 ? ' needs' : ' need') + ' a person.', lines: it.slice(0, 2).map(i => i.name + ': ' + i.label.toLowerCase()),
    action: ui.button('Review and approve', { icon: 'sparkles', kind: 'filled', onTap: () => page.push(C2.reviewSpec()) }) })); }
/** Every lead and every customer request, with what to do about each. Approving runs what the AI can do and makes tasks of the rest. */
C2.reviewSpec = () => { const sel = {}; let result = null;
  return { title: 'AI pipeline review', trailing: page => aiOn() ? [{ icon: 'clock', label: 'Earlier approvals', onTap: () => page.push(C2.aiLogSpec()) }] : [],
    render: page => { if (!aiOn()) return ui.empty({ icon: 'lock', title: 'Not available' }); if (!canEdit()) return ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Your role can’t change leads.' });
      const items = reviewItems(); items.forEach(i => { if (!(i.id in sel)) sel[i.id] = true; }); const picked = items.filter(i => sel[i.id]), autos = items.filter(i => i.auto), people = items.filter(i => !i.auto);
      const row = i => ui.row({ icon: sel[i.id] ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: sel[i.id] ? 'var(--tint)' : 'var(--label3)', title: i.label,
        subtitle: [h('div', h('b', i.name), i.lead ? '' : ' · customer request'), h('div', i.reason), h('div', { style: 'margin-top:3px' }, i.auto ? ui.badge('Can do automatically', 'var(--purple)') : ui.badge('Needs a person · becomes a task for ' + first(staff(i.owner)), 'var(--orange)'))],
        trailing: ui.iconBtn ? ui.iconBtn('chevron.right', 'Open ' + i.name, e => { e && e.stopPropagation && e.stopPropagation(); i.lead ? openLead(i.cid) : page.push(C2.inquirySpec(i.inq.id)); }) : null, onTap: () => { sel[i.id] = !sel[i.id]; page.refresh(); } });
      const approve = async () => { const n = picked.length, a = picked.filter(i => i.auto).length; if (!n) return ui.toast('Tick at least one', 'checkmark');
        if (!await ui.alert({ title: 'Approve ' + plural(n, 'action') + '?', message: (a ? 'AI Premium does ' + a + ' now (messages go out to the leads and customers). ' : '') + (n - a ? plural(n - a, 'task') + ' ' + (n - a === 1 ? 'is' : 'are') + ' added for the people they are assigned to.' : ''), buttons: [{ label: 'Cancel', value: false }, { label: 'Approve', value: true, bold: true }] })) return;
        const done = [], tasks = [];
        if (!await ui.run('Working through ' + plural(n, 'action') + '…', () => { picked.forEach(i => { let ok = false; if (i.auto && i.apply) { try { ok = i.apply() !== false; } catch (e) { console.error(e); ok = false; } }
          if (ok) { done.push(i); logAI(i.label, i.name, 'auto', i.cid); } else { if (K().addTask && i.cid) K().addTask(i.cid, i.task || i.label, 0, { lead: i.lead, owner: i.owner }); say(i.cid, 'AI review: task added for ' + staff(i.owner) + ' — ' + (i.task || i.label) + '.'); tasks.push(i); logAI(i.task || i.label, i.name, 'task', i.cid); } delete sel[i.id]; }); }, { done: 'Done', min: 1300, max: 2300 })) return;
        result = { done: done.map(i => i.name + ': ' + i.label.toLowerCase()), tasks: tasks.map(i => i.name + ': ' + (i.task || i.label).toLowerCase() + ' (' + first(staff(i.owner)) + ')'), at: now() }; page.refresh(); page.body.scrollTop = 0; };
      return ui.list(
        result ? h('div', { style: 'padding-top:10px' }, AIP.card({ title: 'Done', text: [h('span.c2-res', plural(result.done.length, 'action') + ' done'), ' and ' + plural(result.tasks.length, 'task') + ' added. Each one is on the lead’s or customer’s timeline.'], lines: result.done.map(t => '✓ ' + t).concat(result.tasks.map(t => 'Task · ' + t)) }))
          : note('AI Premium read every open lead and customer request. Untick anything you do not want, then approve. Nothing is sent until you do.'),
        autos.length > 0 && ui.section({ header: 'Can do automatically · ' + autos.length, fold: false, showFooter: true, footer: 'Follow-ups, quotes, agreements, documents and archiving. Sent from the company’s number and mailbox, with your templates.' }, autos.map(row)),
        people.length > 0 && ui.section({ header: 'Needs a person · ' + people.length, fold: false, showFooter: true, footer: 'Approving these adds a task, due today, for the person the lead or request is assigned to.' }, people.map(row)),
        !items.length && ui.empty({ icon: 'checkmark.circle', title: result ? 'All caught up' : 'Nothing to recommend', text: 'Every lead and request is either waiting on the customer or already handled.' }),
        items.length > 0 && h('div', { style: 'padding:16px 0 0' }, ui.button('Approve selected (' + picked.length + ')', { icon: 'sparkles', kind: 'filled', disabled: !picked.length, onTap: approve })),
        items.length > 0 && h('div', { style: 'padding:8px 0 0' }, ui.button(picked.length === items.length ? 'Untick all' : 'Tick all', { kind: 'gray', onTap: () => { const v = picked.length !== items.length; items.forEach(i => { sel[i.id] = v; }); page.refresh(); } })),
        ui.section(null, ui.row({ icon: 'clock', iconColor: 'var(--gray)', title: 'Earlier approvals', detail: String(aiLog().length), chevron: true, onTap: () => page.push(C2.aiLogSpec()) }))); } }; };
C2.aiLogSpec = () => ({ title: 'AI action log', render: () => { const list = aiLog();
  return ui.list(note('Everything AI Premium did after someone approved it, and the tasks it handed to people.'), ui.section({ fold: false }, list.map(a => ui.row({ icon: a.how === 'auto' ? 'sparkles' : 'person', iconColor: a.how === 'auto' ? 'var(--purple)' : 'var(--orange)', title: a.label, subtitle: a.target + ' · ' + (a.how === 'auto' ? 'done by AI Premium' : 'task for a person') + ' · approved by ' + first(a.by) + ' · ' + fmt.rel(a.at).toLowerCase(), chevron: !!(a.customerId && q.customer(a.customerId)), onTap: a.customerId && q.customer(a.customerId) ? () => WD.screens.customers.openDetail(a.customerId) : null })), !list.length && ui.row({ title: 'Nothing yet' }))); } });

/* ================= Desktop website: dashboard, board, spreadsheet ================= */
const DV = { view: 'board', f: {}, sheet: { sort: 'next', dir: 1, text: '' } };
const sel = (options, value, onChange) => h('select.c2-sel', { onclick: e => e.stopPropagation(), onchange: e => onChange(e.target.value) }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
const cmp = (a, b) => { const na = a == null || a === '', nb = b == null || b === ''; if (na || nb) return na === nb ? 0 : na ? 1 : -1; return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true }); };
/** A dense table: click a header to sort, type to filter, pick from a cell to edit, click a row to open, export what is showing as CSV.
    o: {st: {sort, dir, text}, cols: [{k, label, val(row), text(row), node(row), csv(row), cls}], rows(), open(row), file, rowClass(row)} */
function sheet(o) {
  const st = o.st, tb = h('tbody'), hr = h('tr'), cnt = h('span.c2-cnt'); let cur = [];
  const txt = (c, r) => { const v = c.text ? c.text(r) : c.val(r); return v == null ? '' : String(v); };
  const draw = () => { let rows = o.rows().slice(); const t = (st.text || '').trim().toLowerCase(), col = o.cols.find(c => c.k === st.sort);
    if (t) rows = rows.filter(r => o.cols.some(c => txt(c, r).toLowerCase().includes(t) || String(c.csv ? c.csv(r) : '').toLowerCase().includes(t)));
    if (col) rows.sort((a, b) => cmp(col.val(a), col.val(b)) * st.dir); cur = rows;
    hr.replaceChildren(...o.cols.map(c => h('th', h('button' + (st.sort === c.k ? '.on' : ''), { 'aria-label': 'Sort by ' + c.label, onclick: () => { if (st.sort === c.k) st.dir = -st.dir; else { st.sort = c.k; st.dir = 1; } draw(); } }, c.label, st.sort === c.k ? icon(st.dir > 0 ? 'chevron.up' : 'chevron.down', 12) : null))));
    tb.replaceChildren(...rows.map(r => h('tr' + (o.rowClass && o.rowClass(r) ? '.' + o.rowClass(r) : ''), { onclick: () => o.open(r) }, o.cols.map(c => { const k = typeof c.cls === 'function' ? c.cls(r) : c.cls; return h('td' + (k ? '.' + k : ''), c.node ? c.node(r) : txt(c, r)); }))));
    if (!rows.length) tb.replaceChildren(h('tr', h('td', { colspan: String(o.cols.length), style: 'padding:22px;text-align:center;color:var(--label2)' }, 'Nothing matches')));
    cnt.textContent = plural(rows.length, 'row'); };
  const exportCsv = () => { const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', lines = [o.cols.map(c => esc(c.label)).join(',')].concat(cur.map(r => o.cols.map(c => esc(c.csv ? c.csv(r) : txt(c, r))).join(',')));
    try { const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' })), a = h('a', { href: url, download: o.file || 'export.csv', style: 'display:none' }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); ui.toast('Exported ' + plural(cur.length, 'row') + ' to ' + (o.file || 'export.csv'), 'checkmark'); } catch (e) { ui.toast('The export could not be made in this browser', 'exclamationmark.triangle'); } };
  draw();
  return h('div.c2-sheet', h('div.c2-tool', { style: 'margin-top:0' }, h('input.c2-find', { type: 'search', placeholder: 'Filter rows', 'aria-label': 'Filter rows', value: st.text || '', oninput: e => { st.text = e.target.value; draw(); } }), cnt, h('span.c2-grow'), ui.button('Export CSV', { kind: 'gray', small: true, block: false, icon: 'arrow.down', onTap: exportCsv })),
    h('div.c2-scroll', h('table.c2-table', h('thead', hr), tb)));
}
const created = c => c.createdAt || data.interactions.filter(i => i.customerId === c.id).reduce((m, i) => Math.min(m, i.at), Infinity);
const cityOf = c => { const a = String(((c.locations || [])[0] || {}).address || '').split(','); return a.length > 1 ? a[a.length - 1].trim() : ''; };
const weekStart = at => { const d = new Date(at); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return +d; };
const leadCols = () => { const x = X(), k = K(), edit = canEdit(), stIdx = c => x.STAGES.findIndex(s => s[0] === x.stageOf(c)), LCS = ['lead', 'contacted', 'quoted', 'scheduled', 'lost'];
  return [{ k: 'name', label: 'Name', val: c => c.name, cls: 'b' },
    { k: 'stage', label: 'Stage', val: stIdx, text: c => x.STAGES[stIdx(c)][1], csv: c => x.STAGES[stIdx(c)][1], node: c => edit ? sel(LCS.map(s => [s, k.LC[s][0] + (s === c.lifecycle && x.stageOf(c) === 'due' ? ' · due' : '')]), c.lifecycle, v => { if (v === c.lifecycle) return; c.lifecycle = v; c.lostReason = v === 'lost' ? 'Not given' : null; c.stageSince = now(); say(c.id, v === 'lost' ? 'Marked lost.' : 'Moved to ' + k.LC[v][0] + '.'); WD.changed(); }) : x.STAGES[stIdx(c)][1] },
    { k: 'priority', label: 'Priority', val: c => x.PRI[x.priOf(c)][2], text: c => x.PRI[x.priOf(c)][0], node: c => edit ? sel(x.PRIS.map(p => [p, x.PRI[p][0]]), x.priOf(c), v => { c.priority = v; WD.changed(); }) : x.PRI[x.priOf(c)][0] },
    { k: 'vip', label: 'VIP', val: c => c.vip ? 0 : 1, text: c => c.vip ? 'Key account' : '', node: c => c.vip ? h('span.cr-star', { 'aria-label': 'Key account' }, icon('star.fill', 14)) : '' },
    { k: 'value', label: 'Value', val: c => -(c.estValue || x.quoteValue(c) || 0), text: c => x.valText(c), csv: c => c.estValue || x.quoteValue(c) || '' },
    { k: 'source', label: 'Source', val: c => x.srcLabel(c) },
    { k: 'owner', label: 'Owner', val: c => staff(c.owner), node: c => edit ? sel(owners().map(u => [u.id, u.name]), c.owner, v => { c.owner = v; WD.changed(); }) : staff(c.owner) },
    { k: 'next', label: 'Next follow-up', val: c => c.nextAction || '', text: c => c.nextAction ? md(c.nextAction) : '', cls: c => c.nextAction && c.nextAction <= today() && !['scheduled', 'lost'].includes(c.lifecycle) ? 'late' : '' },
    { k: 'last', label: 'Last contact', val: c => { const l = x.lastContact(c); return l ? -l.at : null; }, text: c => { const l = x.lastContact(c); return l ? first(l.by) + ' ' + l.how + ' ' + x.ago(l.at) : 'Nobody yet'; } },
    { k: 'phone', label: 'Phone', val: c => { const p = c.contacts[0] || {}; return p.phone ? fmt.phone(p.phone) : ''; } }, { k: 'email', label: 'Email', val: c => (c.contacts[0] || {}).email || '' }, { k: 'city', label: 'City', val: cityOf }]; };
const leadRows = () => { const x = X(), f = DV.f; return x.pipe().filter(c => (!f.stage || x.stageOf(c) === f.stage) && (!f.source || x.sourceOf(c) === f.source) && (!f.owner || c.owner === f.owner) && (!f.due || ['fresh', 'due'].includes(x.stageOf(c))) && (!f.week || weekStart(created(c)) === f.week) && (!f.vip || c.vip)); };
/** The Leads side on the desktop website: charts that filter the list below them, then the stage board or the spreadsheet. */
C2.desktop = page => {
  const x = X(), k = K(), all = x.pipe(), f = DV.f, ST = data.settings.crm;
  const go = patch => { DV.f = { ...patch }; DV.view = 'sheet'; page.refresh(); setTimeout(() => { const el = page.body.querySelector('.c2-anchor'); el && el.scrollIntoView && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40); };
  const bar = (label, n, max, text, color, on, pick, fun) => h('button.c2-bar' + (fun ? '.fun' : '') + (on ? '.on' : ''), { 'aria-label': label + ': ' + text, onclick: pick }, h('span.l', label), h('span.t', h('i', { style: { width: Math.max(2, Math.round(n / Math.max(1, max) * 100)) + '%', '--c': color } })), h('span.n', text));
  const byStage = x.STAGES.map(([key, label]) => { const xs = all.filter(c => x.stageOf(c) === key); return { key, label, n: xs.length, v: xs.reduce((s, c) => s + x.quoteValue(c), 0) }; }), maxS = Math.max(1, ...byStage.map(s => s.n));
  const srcs = (CO.SOURCES || []).map(([key, title]) => ({ key, title, n: all.filter(c => x.sourceOf(c) === key).length, won: all.filter(c => x.sourceOf(c) === key && c.lifecycle === 'scheduled').length })).filter(s => s.n).sort((a, b) => b.n - a.n), maxSrc = Math.max(1, ...srcs.map(s => s.n));
  const w0 = weekStart(now()), weeks = Array.from({ length: 8 }, (_, i) => w0 - (7 - i) * 7 * 864e5).map(w => ({ w, n: all.concat(x.archived()).filter(c => { const t = created(c); return isFinite(t) && weekStart(t) === weekStart(w + 36e5 * 12); }).length })), maxW = Math.max(1, ...weeks.map(w => w.n));
  const won = all.filter(c => c.lifecycle === 'scheduled'), lost = all.filter(c => c.lifecycle === 'lost'), rate = won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : null;
  const closeDays = won.map(c => { const t = created(c); return isFinite(t) ? Math.max(1, Math.round((x.lastTouch(c) - t) / 864e5)) : null; }).filter(v => v != null), avg = closeDays.length ? Math.round(closeDays.reduce((s, v) => s + v, 0) / closeDays.length) : null;
  const openVal = all.filter(c => !['scheduled', 'lost'].includes(c.lifecycle)).reduce((s, c) => s + x.quoteValue(c), 0), keyVal = all.filter(c => c.vip).reduce((s, c) => s + (c.estValue || 0), 0);
  const dueBy = owners().map(u => ({ u, n: all.filter(c => c.owner === u.id && ['fresh', 'due'].includes(x.stageOf(c))).length })).filter(r => r.n).sort((a, b) => b.n - a.n), maxD = Math.max(1, ...dueBy.map(r => r.n));
  const tile = (value, label, pick) => h('button.c2-tile', { 'aria-label': label + ': ' + value, onclick: pick }, h('b', value), h('span', label));
  const chips = [f.stage && ['Stage: ' + (x.STAGES.find(s => s[0] === f.stage) || [])[1], 'stage'], f.source && ['Source: ' + ((x.SRC[f.source] || {}).title || f.source), 'source'], f.owner && ['Owner: ' + staff(f.owner), 'owner'], f.due && ['Needs a reply or follow-up', 'due'], f.week && ['New in the week of ' + md(D.key(new Date(f.week))), 'week'], f.vip && ['Key accounts', 'vip']].filter(Boolean);
  const shown = leadRows(), sort = x.sorters[x.R.sort] || x.sorters.next;
  return h('div.wide.c2-desk', h('div', { style: 'max-width:1100px' }, C2.leadsTop(page)), (cr => cr ? h('div', { style: 'max-width:860px' }, ui.list(cr)) : null)(x.callRow(page)),
    h('div.c2-dash',
      h('div.c2-card', h('h4', 'Pipeline by stage'), byStage.map(s => bar(s.label, s.n, maxS, s.n + (s.v ? ' · ' + money(s.v) : ''), x.SC[s.key], f.stage === s.key, () => go({ stage: s.key }), true))),
      h('div.c2-card', h('h4', 'Leads by source'), srcs.map(s => bar(s.title, s.n, maxSrc, s.n + (s.won ? ' · ' + s.won + ' won' : ''), 'var(--teal)', f.source === s.key, () => go({ source: s.key }))), !srcs.length && h('div.c2-cnt', 'No leads yet')),
      h('div.c2-card', h('h4', 'New leads a week'), h('div.c2-cols', weeks.map(w => h('button.c2-col', { 'aria-label': 'Week of ' + md(D.key(new Date(w.w))) + ': ' + plural(w.n, 'new lead'), onclick: () => go({ week: weekStart(w.w + 36e5 * 12) }) }, h('span.n', String(w.n)), h('i', { style: { height: Math.round(w.n / maxW * 96) + 'px', background: f.week === weekStart(w.w + 36e5 * 12) ? 'var(--tint)' : null } }), h('span.l', md(D.key(new Date(w.w)))))))),
      h('div.c2-card', h('h4', 'Results'), h('div.c2-tiles', tile(rate == null ? '—' : rate + '%', 'Win rate · ' + won.length + ' won, ' + lost.length + ' lost', () => go({ stage: 'scheduled' })), tile(avg == null ? '—' : plural(avg, 'day'), 'Average time to close', () => go({ stage: 'scheduled' })), tile(money(openVal), 'Open quotes and bids', () => go({ stage: 'quoted' })), tile(money(keyVal), 'Key accounts, a year', () => go({ vip: true })))),
      h('div.c2-card', h('h4', 'Follow-ups due, by owner'), dueBy.map(r => bar(first(r.u.name), r.n, maxD, String(r.n), 'var(--orange)', f.owner === r.u.id && f.due, () => go({ owner: r.u.id, due: true }))), !dueBy.length && h('div.c2-cnt', 'Nobody has a follow-up due')),
      h('div.c2-card', h('h4', 'Customer requests by type'), typeBars(t => { N.type = t; x.R.side = 'needs'; page.refresh(); page.body.scrollTop = 0; }))),
    h('div.c2-tool.c2-anchor', ui.segmented([{ value: 'board', label: 'Board' }, { value: 'sheet', label: 'Spreadsheet' }], DV.view, v => { DV.view = v; page.refresh(); }),
      chips.map(([label, key]) => h('button.c2-fchip', { 'aria-label': 'Remove filter ' + label, onclick: () => { delete DV.f[key]; page.refresh(); } }, label, icon('xmark', 12))), chips.length > 1 && h('button.cu-link', { onclick: () => { DV.f = {}; page.refresh(); } }, 'Clear all'),
      h('span.c2-grow'), h('span.c2-cnt', plural(shown.length, 'lead') + (chips.length ? ' of ' + all.length : ''))),
    DV.view === 'sheet' ? sheet({ st: DV.sheet, cols: leadCols(), rows: leadRows, open: c => openLead(c.id), file: 'leads.csv' })
      : h('div.c2-board', x.STAGES.map(([key, label]) => { const xs = shown.filter(c => x.stageOf(c) === key).sort(sort), v = xs.reduce((s, c) => s + x.quoteValue(c), 0);
        return h('div.cr-st', { style: { '--c': x.SC[key] } }, h('div.cr-st-h', h('b', label), h('span.cr-st-n', String(xs.length)), v ? h('span.cr-st-v', money(v) + ' quoted') : null), xs.map(c => x.leadCard(c)), !xs.length && h('div.cr-st-f', 'Nothing here')); })),
    h('div', { style: 'max-width:860px' }, ui.list(ui.section({ fold: false }, ui.row({ icon: 'tray', iconColor: 'var(--gray)', title: 'Archived leads', detail: String(x.archived().length), chevron: true, onTap: () => page.push(x.archivedSpec()) })))));
};

/* ================= New agreement requests (Contracts) ================= */
/* Replaces the sheet the office filled from a form: one row per new contract, with the same columns, a status, and the steps that follow
   (create the agreement, schedule the setup job). */
const canAg = () => WD.can('contracts.manage') || canEdit();
const reqOpen = r => ['new', 'progress', 'sent'].includes(r.status), reqLog = (r, text) => { (r.log = r.log || []).push({ at: now(), by: me(), text }); };
const itemsText = c => { const l = (c.locations || [])[0] || {}, items = (l.items || []).filter(i => i.qty > 0), pb = id => (data.priceBook.find(x => x.id === id) || { name: id }).name; return items.length ? items.map(i => i.qty + ' × ' + pb(i.id) + (i.rate ? ' at ' + money(i.rate) + ' each' : '')).join(', ') : l.containers || c.containers || ''; };
const locName = () => { const o = org(); return (o.short || o.name) + (o.state ? ' · ' + o.state : ''); };
function prefill(f, c) { const p = c.contacts[0] || {}, l = c.locations[0] || {};
  Object.assign(f, { customerId: c.id, company: c.name, address: l.address || '', hours: l.bizOpen && l.bizClose ? 'Mon–Fri ' + l.bizOpen + '–' + l.bizClose + (l.lunchFrom ? '. Closed ' + l.lunchFrom + '–' + l.lunchUntil + ' for lunch.' : '. No lunch closure on file.') : '', contact: p.name || '', phone: p.phone || '', billingEmail: c.billingEmail || p.email || '', contractEmail: p.email || '', freq: c.freq || 'Every 4 weeks', containers: itemsText(c), items: ((l.items || []).filter(i => i.qty > 0)).map(i => ({ ...i })) }); return f; }
const blankReq = () => ({ id: null, status: 'new', at: now(), location: locName(), company: '', address: '', hours: '', contact: '', phone: '', billingEmail: '', contractEmail: '', freq: 'Every 4 weeks', containers: '', items: null, dropShred: false, setupDate: bizDay(5), notes: '', customerId: null, by: me(), reason: '', agreementId: null, log: [] });
/** The request form: the same fields the sheet had. The office or a salesperson fills it in; choosing a customer or lead fills most of it. */
C2.requestForm = (r, done) => { const isNew = !r, f = isNew ? blankReq() : { ...r };
  ui.sheet({ title: isNew ? 'New agreement request' : 'Edit request', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: isNew ? 'Add' : 'Save', bold: true, onTap: async p => { if (!f.company.trim()) return ui.toast('Add the company name', 'building');
      if (!await ui.run('Saving…', () => { if (isNew) { f.id = 'ar' + Date.now().toString(36); f.at = now(); reqLog(f, 'Request added.'); reqs().unshift(f); r = f; } else { if (f.containers !== r.containers) f.items = null; Object.assign(r, f); reqLog(r, 'Request edited.'); } }, { done: 'Saved' })) return; p.dismiss(); done && done(r); } }],
    render: p => { const c = f.customerId && q.customer(f.customerId), re = () => p.refresh();
      return ui.list(
        ui.section({ fold: false, showFooter: true, footer: 'Choosing a customer or a lead fills in what is already known.' }, ui.row({ icon: 'person.crop.circle', iconColor: 'var(--blue)', title: c ? c.name : 'Fill in from a customer or lead', subtitle: c ? 'Linked to this record' : null, tint: !c, chevron: true, onTap: () => p.push(pickAnySpec(x => { prefill(f, x); })) })),
        ui.section({ header: 'Request', fold: false },
          ui.pickerRow({ title: 'Status', value: f.status, options: RSK.map(k => ({ value: k, label: RS[k][0] })), onChange: v => { f.status = v; re(); } }),
          ui.row({ title: 'Timestamp', detail: fmt.day(D.key(new Date(f.at)), 'md') + ' · ' + fmt.clock(new Date(f.at)) }),
          ui.pickerRow({ title: 'Location', value: f.location, options: [...new Set(data.orgs.map(o => (o.short || o.name) + (o.state ? ' · ' + o.state : '')).concat(f.location))], onChange: v => { f.location = v; re(); } })),
        ui.section({ header: 'Company', fold: false },
          ui.inputRow({ label: 'Company name', caps: 'words', required: true, value: f.company, onInput: v => { f.company = v; } }),
          ui.inputRow({ label: 'Service address', placeholder: 'Street, city', value: f.address, onInput: v => { f.address = v; } }),
          ui.inputRow({ label: 'Hours', placeholder: 'Hours of operation, and when they close for lunch', value: f.hours, onInput: v => { f.hours = v; } })),
        ui.section({ header: 'Contact', fold: false },
          ui.inputRow({ label: 'Contact person', caps: 'words', value: f.contact, onInput: v => { f.contact = v; } }),
          ui.inputRow({ label: 'Contact phone', type: 'tel', placeholder: '555-555-0100', value: f.phone ? fmt.phone(f.phone) : '', onInput: v => { f.phone = v; } }),
          ui.inputRow({ label: 'Billing email', type: 'email', caps: 'off', value: f.billingEmail, onInput: v => { f.billingEmail = v.trim(); } }),
          ui.inputRow({ label: 'Contract email', type: 'email', caps: 'off', placeholder: 'Where the agreement is sent to sign', value: f.contractEmail, onInput: v => { f.contractEmail = v.trim(); } })),
        ui.section({ header: 'Service', fold: false, showFooter: true, footer: 'Consoles or bins: how many of each, and the price for each.' },
          ui.pickerRow({ title: 'Service frequency', value: f.freq, options: FREQS.includes(f.freq) ? FREQS : [f.freq].concat(FREQS), onChange: v => { f.freq = v; re(); } }),
          ui.inputRow({ multiline: true, placeholder: 'Consoles or bins, amount and pricing. Example: 2 consoles at $65 each, 1 64-gallon bin at $55', value: f.containers, onInput: v => { f.containers = v; } }),
          ui.toggleRow({ title: 'Shredding needed at drop-off?', subtitle: f.dropShred ? 'Yes: the driver shreds what is waiting when the containers are delivered' : 'No', value: f.dropShred, onChange: v => { f.dropShred = v; re(); } }),
          ui.dateRow({ title: 'Preferred setup date', value: f.setupDate, onChange: v => { f.setupDate = v; re(); } })),
        ui.section({ header: 'Notes', fold: false }, ui.inputRow({ multiline: true, placeholder: 'Anything the office or the driver should know', value: f.notes, onInput: v => { f.notes = v; } }))); } }, { detent: 'large' }); };
function pickAnySpec(done) { let text = '';
  return { title: 'Customer or lead', search: { placeholder: 'Search customers and leads', onInput: (v, p) => { text = v.trim().toLowerCase(); p.refresh(); } },
    render: p => { const LC = K().LC || {}, list = data.customers.filter(c => c.lifecycle !== 'lost' && (!text || c.name.toLowerCase().includes(text))).sort((a, b) => (['scheduled', 'quoted'].includes(b.lifecycle) - ['scheduled', 'quoted'].includes(a.lifecycle)) || a.name.localeCompare(b.name)).slice(0, 50);
      return ui.list(ui.section({ fold: false }, list.map(c => ui.row({ leading: ui.avatar(c.name, { size: 34 }), title: c.name, subtitle: (c.locations[0] || {}).address, badge: LC[c.lifecycle] ? ui.badge(LC[c.lifecycle][0], LC[c.lifecycle][1]) : null, onTap: () => { done(c); p.pop(); } })), !list.length && ui.row({ title: 'Nobody matches' }))); } }; }
/** The customer record a request belongs to; made from the request when it is a brand-new company. */
function custFor(r) { let c = r.customerId && q.customer(r.customerId); if (c) return c; const k = K(); if (!k.mk) return null;
  const digits = String(r.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''), id = 'c' + Date.now().toString(36);
  c = k.mk({ id, name: r.company, lifecycle: 'scheduled', channel: 'Other', contacts: [{ name: r.contact || r.company, role: '', phone: digits.length === 10 ? '+1' + digits : '', email: r.contractEmail || r.billingEmail || '' }], address: r.address || 'Address to come', owner: S.me.id, containers: r.containers, freq: r.freq, cnotes: r.notes });
  Object.assign(c, { source: 'manual', createdAt: now(), changes: [], billingEmail: r.billingEmail || '' }); const l = c.locations[0]; if (r.address) l.address = r.address; l.notes = r.hours || '';
  try { l.items = r.items && r.items.length ? r.items.map(i => ({ ...i })) : WD.parseItems(r.containers); } catch (e) { l.items = []; }
  say(id, 'Customer record made from the new agreement request (' + r.location + ').'); r.customerId = id; return c; }
async function createAgreementFor(r, page) { const EX = WD.x || {}; if (!WD.can('contracts.manage')) return ui.alert({ title: 'Ask an admin', message: 'Your role can’t create service agreements.' });
  const c = custFor(r); if (!c) return;
  if (EX.createAgreement && EX.agreementSpec) { const l = c.locations[0]; if (r.items && r.items.length && !(l.items || []).some(i => i.qty > 0)) l.items = r.items.map(i => ({ ...i }));
    const a = EX.createAgreement(c); r.agreementId = a.id; if (r.status === 'new') r.status = 'progress'; reqLog(r, 'Service agreement ' + a.number + ' created.'); say(c.id, 'Service agreement ' + a.number + ' started from the agreement request.'); WD.changed(); page.push(EX.agreementSpec(a)); return; }
  if (await ui.run('Creating the agreement…', () => { r.agreementId = 'manual'; if (r.status === 'new') r.status = 'progress'; reqLog(r, 'Service agreement created.'); say(c.id, 'Service agreement created from the agreement request.'); }, { done: 'Created' })) page.refresh(); }
C2.requestSpec = id => ({ title: 'Agreement request', trailing: page => canAg() ? [{ label: 'Edit', onTap: () => { const r = reqs().find(x => x.id === id); r && C2.requestForm(r, () => page.refresh()); } }] : [],
  render: page => { const r = reqs().find(x => x.id === id); if (!r) return ui.empty({ icon: 'signature', title: 'Request not found' });
    const edit = canAg(), c = r.customerId && q.customer(r.customerId), a = r.agreementId && (data.agreements || []).find(x => x.id === r.agreementId), AG = { draft: 'Draft', sent: 'Sent · not signed', viewed: 'Viewed · not signed', signed: 'Signed' };
    const setStatus = async (st, text) => { if (await ui.run('Saving…', () => { r.status = st; reqLog(r, text); if (r.customerId) say(r.customerId, 'Agreement request: ' + text); }, { done: RS[st][0] })) page.refresh(); };
    const why = async (title, st, verb) => { const v = await ask(title, 'Reason', '', r.company); if (!v) return; r.reason = v; setStatus(st, verb + ': ' + v); };
    const line = (label, value) => value ? ui.row({ title: label, subtitle: String(value).length > 26 ? value : null, detail: String(value).length > 26 ? null : value }) : ui.row({ title: label, detail: h('span', { style: 'color:var(--label3)' }, 'Not given') });
    if (a && a.status === 'sent' && r.status === 'progress') r.status = 'sent'; if (a && a.status === 'signed' && reqOpen(r)) r.status = 'completed';
    return [h('div.cr-head', h('span.headline', r.company), h('span.spacer'), ui.badge(RS[r.status][0], RS[r.status][1])),
      h('div.footnote', { style: 'padding:0 16px 2px' }, r.location + ' · added ' + fmt.rel(r.at).toLowerCase() + ' by ' + r.by),
      (r.status === 'hold' || r.status === 'cancelled') && r.reason ? h('div', { style: 'padding:8px 4px 0' }, ui.note((r.status === 'hold' ? 'On hold: ' : 'Cancelled: ') + r.reason)) : null,
      ui.list(
        edit && ui.section({ header: 'Next steps', fold: false },
          a ? ui.row({ icon: 'signature', iconColor: a.status === 'signed' ? 'var(--green)' : 'var(--orange)', title: 'Service agreement ' + a.number, subtitle: AG[a.status] || a.status, chevron: true, onTap: () => WD.x && WD.x.agreementSpec && page.push(WD.x.agreementSpec(a)) })
            : r.agreementId ? ui.row({ icon: 'signature', iconColor: 'var(--green)', title: 'Service agreement created' })
            : reqOpen(r) ? ui.row({ icon: 'signature', iconColor: 'var(--blue)', title: 'Create the agreement', subtitle: 'Starts from the containers and prices here' + (c ? '' : '. Makes the customer record first.'), tint: true, chevron: true, onTap: () => createAgreementFor(r, page) }) : null,
          reqOpen(r) || r.status === 'completed' ? ui.row({ icon: 'truck', iconColor: 'var(--red)', title: 'Schedule the setup job', subtitle: 'Preferred date: ' + fmt.day(r.setupDate, 'long') + (r.dropShred ? ' · shredding at drop-off' : ''), chevron: true, onTap: () => { const cu = custFor(r); if (!cu || !(WD.screens.jobs && WD.screens.jobs.openEditor)) return; reqLog(r, 'Setup job started for ' + md(r.setupDate) + '.'); WD.changed(); WD.screens.jobs.openEditor({ customerId: cu.id, day: r.setupDate >= today() ? r.setupDate : today(), type: 'setup' }); } }) : null,
          r.status === 'new' && ui.row({ icon: 'play', iconPlain: true, title: 'Mark in progress', tint: true, onTap: () => setStatus('progress', 'In progress.') }),
          r.status === 'progress' && ui.row({ icon: 'envelope', iconPlain: true, title: 'Mark sent to the customer', tint: true, onTap: () => setStatus('sent', 'Agreement sent to ' + (r.contractEmail || 'the customer') + '.') }),
          (r.status === 'sent' || r.status === 'progress') && ui.row({ icon: 'checkmark.circle', iconPlain: true, title: 'Mark completed', tint: true, onTap: () => setStatus('completed', 'Completed.') }),
          reqOpen(r) && ui.row({ icon: 'pause', iconPlain: true, title: 'Put on hold…', tint: true, onTap: () => why('Why is it on hold?', 'hold', 'On hold') }),
          reqOpen(r) || r.status === 'hold' ? ui.row({ title: 'Cancel the request…', destructive: true, onTap: () => why('Why was it cancelled?', 'cancelled', 'Cancelled') }) : null,
          (r.status === 'hold' || r.status === 'cancelled') && ui.row({ icon: 'arrow.clockwise', iconPlain: true, title: 'Reopen', tint: true, onTap: () => { r.reason = ''; setStatus(r.agreementId ? 'progress' : 'new', 'Reopened.'); } })),
        ui.section({ header: 'Company', fold: false }, line('Company name', r.company), line('Service address', r.address), line('Hours of operation', r.hours)),
        ui.section({ header: 'Contact', fold: false }, line('Contact person', r.contact), line('Contact phone', r.phone ? fmt.phone(r.phone) : ''), line('Billing email', r.billingEmail), line('Contract email', r.contractEmail)),
        ui.section({ header: 'Service', fold: false }, line('Service frequency', r.freq), line('Consoles or bins', r.containers), line('Shredding needed at drop-off?', r.dropShred ? 'Yes' : 'No'), line('Preferred setup date', fmt.day(r.setupDate, 'long')), r.notes ? line('Notes', r.notes) : null),
        (r.log || []).length > 0 && ui.section({ header: 'History', fold: true, folded: true }, r.log.slice().reverse().map(n => ui.row({ title: n.text, subtitle: n.by + ' · ' + fmt.rel(n.at) }))),
        c && ui.section(null, ui.row({ title: 'Open ' + c.name, chevron: true, onTap: () => { const L = ['lead', 'contacted', 'quoted', 'scheduled', 'lost'].includes(c.lifecycle); L && WD.can('leads.view') ? openLead(c.id) : WD.screens.customers.openDetail(c.id); } })))]; } });
const reqRow = (r, page) => ui.row({ leading: ui.avatar(r.company, { size: 36 }), title: r.company, subtitle: [h('div', r.freq + ' · ' + r.containers), h('div', (r.status === 'hold' || r.status === 'cancelled') && r.reason ? r.reason : 'Setup ' + md(r.setupDate) + ' · ' + r.contact + ' · ' + r.location)], badge: ui.badge(RS[r.status][0], RS[r.status][1]), chevron: true, onTap: () => page.push(C2.requestSpec(r.id)) });
C2.requestsSpec = () => ({ title: 'Agreement requests', trailing: () => canAg() ? [{ icon: 'plus', label: 'New agreement request', onTap: () => C2.requestForm(null, r => WD.nav.push(C2.requestSpec(r.id))) }] : [],
  render: page => { const all = reqs().slice().sort((a, b) => b.at - a.at), by = st => all.filter(r => r.status === st);
    return ui.list(h('div.r13-stats', [['new', 'New', 'var(--blue)'], ['progress', 'In progress', 'var(--orange)'], ['sent', 'Sent', 'var(--purple)'], ['completed', 'Completed', 'var(--green)']].map(([k, label, color]) => h('div.r13-stat', { style: { '--c': by(k).length ? color : 'var(--label3)', cursor: 'default' } }, h('b', String(by(k).length)), h('span', label)))),
      RSK.map(k => by(k).length ? ui.section({ header: RS[k][0] + ' · ' + by(k).length, fold: true, folded: k === 'completed' || k === 'cancelled', foldKey: 'areq-' + k }, by(k).map(r => reqRow(r, page))) : null),
      !all.length && ui.empty({ icon: 'signature', title: 'No requests yet', text: 'Tap + when a new customer is ready for a service agreement.' }),
      note('This list replaces the new-contracts spreadsheet: the same columns, filled in from this form by the office or the salesperson, with the agreement and the setup job one tap away.')); } });
/** Contracts: the section that leads to the requests (r13.js adds it to the Contracts page). */
C2.requestsSection = page => { const all = reqs(), open = all.filter(reqOpen).sort((a, b) => b.at - a.at), fresh = open.filter(r => r.status === 'new'), hold = all.filter(r => r.status === 'hold').length;
  return ui.section({ header: 'New agreement requests', fold: false, showFooter: true, footer: 'New customers waiting for a service agreement: who they are, what they need and when to set them up.' },
    ui.row({ icon: 'tray', iconColor: 'var(--blue)', title: 'All requests', subtitle: plural(open.length, 'open request') + (hold ? ' · ' + hold + ' on hold' : ''), badge: fresh.length ? ui.badge(fresh.length + ' new', 'var(--blue)') : null, chevron: true, onTap: () => page.push(C2.requestsSpec()) }),
    fresh.slice(0, 3).map(r => reqRow(r, page)),
    canAg() && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New agreement request', tint: true, onTap: () => C2.requestForm(null, r => page.push(C2.requestSpec(r.id))) })); };
/** AI Premium, lead page: a won lead becomes a filled-in request. */
C2.requestRow = (c, page) => { if (!aiOn() || !canAg()) return null; const r = reqs().find(x => x.customerId === c.id && x.status !== 'cancelled');
  if (r) return ui.row({ icon: 'tray', iconColor: RS[r.status][1], title: 'Agreement request', subtitle: RS[r.status][0] + ' · setup ' + md(r.setupDate), chevron: true, onTap: () => page.push(C2.requestSpec(r.id)) });
  if (c.lifecycle !== 'scheduled') return null;
  return ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: 'Create agreement request from this lead', subtitle: 'AI Premium fills in the form from the lead, its quote and its notes', tint: true, chevron: true, onTap: async () => { let n = null;
    if (!await ui.run('Reading the lead…', () => { const x = X(), qt = x.leadQuote ? x.leadQuote(c) : null; n = prefill(blankReq(), c); n.id = 'ar' + Date.now().toString(36);
      if (qt) { n.containers = qt.items.map(i => i.qty + ' × ' + i.name + ' at ' + money(i.rate) + ' each').join(', '); n.freq = qt.freq || n.freq; const l = c.locations[0] || {}; n.items = (l.items || []).filter(i => i.qty > 0).map((it, j) => ({ ...it, rate: (qt.items[j] || it).rate })); }
      n.dropShred = /drop.?off|boxes at setup|backlog/i.test([c.notes, c.situation].join(' ')); n.notes = [c.situation, c.notes].filter(Boolean).join(' ').slice(0, 240); reqLog(n, 'Filled in by AI Premium from the won lead.'); reqs().unshift(n); logAI('Created the agreement request', c.name, 'auto', c.id); say(c.id, 'Agreement request created from this lead by AI Premium.'); }, { done: 'Request filled in', min: 1100, max: 1900 })) return;
    page.push(C2.requestSpec(n.id)); } }); };

/* ================= Settings, AI Premium features, control panel ================= */
const R14 = WD.r14;
if (R14 && R14.addSetting) {
  R14.addSetting('CRM', (push, gated) => R14.link(push, gated, 'settings.manage', 'tray', 'var(--teal)', 'Customer request types', 'COI, W-9, extra pickup… and how fast each is answered', C2.typesSpec, String(types().length)));
  R14.addSetting('CRM', (push, gated) => R14.link(push, gated, 'settings.manage', 'doc.text', 'var(--indigo)', 'Company documents', 'The COI, W-9 and vendor packet customers ask for', C2.docsSpec, (d => d && d.expires && D.diff(d.expires, today()) <= 30 ? 'COI expires soon' : null)(docOf('coi'))));
  R14.addSetting('AI Premium', (push, gated) => R14.link(push, gated, 'settings.manage', 'bolt', 'var(--orange)', 'Low-value leads', 'Answer small purges and drop-offs automatically', C2.lowSpec, LV().on ? LV().boxes + ' boxes or fewer' : 'Off'));
  R14.addSetting('AI Premium', (push, gated) => R14.link(push, gated, 'crm.edit', 'sparkles', 'var(--purple)', 'AI pipeline review', 'Recommended actions for every lead and customer request', C2.reviewSpec));
  R14.addSetting('AI Premium', (push, gated) => R14.link(push, gated, null, 'clock', 'var(--gray)', 'AI action log', 'What was approved, what it did, and the tasks it made', C2.aiLogSpec, String(aiLog().length)));
}
AIP.feature('Lead summary and next step', 'CRM → a lead', 'Sums up who the lead is, what they want and what has been tried, and offers to do the next step for you.');
AIP.feature('Pipeline review', 'CRM → Leads', 'Reads every lead and customer request, lists what to do about each, does what you approve and makes tasks of the rest.');
AIP.feature('Low-value auto-reply', 'CRM, Settings → AI Premium', 'Answers small purges and drop-off questions with your price and booking link, so nobody spends time on them.');
AIP.feature('Customer request replies', 'CRM → Customer needs', 'Drafts the reply to a COI, W-9 or certificate request, attaches the right document, fills in the certificate holder and warns when the COI is about to expire.');
AIP.feature('Agreement request from a won lead', 'CRM → a lead, Contracts', 'Turns a won lead into a filled-in new agreement request.');

const toCRM = side => { const x = X(); if (x.R) { x.R.side = side; if (side === 'leads') x.R.seg = 'pipeline'; } WD.nav.switchTab('crm'); WD.changed(); };
WD.panel.addJump('CRM: customer needs', () => toCRM('needs'));
WD.panel.addJump('VIP leads', () => { toCRM('leads'); WD.nav.push(C2.vipSpec()); });
WD.panel.addJump('AI pipeline review', () => { if (!aiOn()) return ui.toast('Turn AI Premium on in the panel first', 'sparkles', 2600); toCRM('leads'); WD.nav.push(C2.reviewSpec()); });
WD.panel.addJump('Agreement requests', () => { WD.nav.switchTab('contracts'); WD.nav.push(C2.requestsSpec()); });
WD.panel.addAction('Customer asks for a COI', () => { let cs = data.customers.filter(c => ['customer', 'serviced'].includes(c.lifecycle) && c.kind !== 'household' && (c.contacts[0] || {}).email); if (!cs.length) cs = data.customers.slice(); const c = cs[inq().length % cs.length], p = c.contacts[0] || {};
  const holders = ['Lakemont Medical Plaza LLC', 'Ridgeline Property Group', 'Canal Street Holdings LLC'], holder = holders[inq().length % holders.length];
  const i = { id: 'iq' + Date.now().toString(36), customerId: c.id, type: 'coi', who: p.name || 'Front desk', email: p.email || '', channel: 'email', at: now(), due: bizDay(2), owner: (owners().find(u => u.id === c.owner) || owners()[0] || {}).id, status: 'new', text: 'Our landlord needs proof of your insurance before your next visit. Certificate holder: ' + holder + '. Please send it to me today if you can.', holder: aiOn() ? holder : '', doc: null, doneAt: null, notes: [] };
  inq().push(i); WD.changed();
  ui.banner({ title: 'Customer request · certificate of insurance', text: c.name + ' — ' + i.who + ' asked for a COI' + (aiOn() ? '. AI Premium has the reply ready.' : '.'), icon: 'shield', color: 'var(--teal)', duration: 7000, onTap: () => { toCRM('needs'); WD.nav.push(C2.inquirySpec(i.id)); } }); });
WD.panel.addAction('New low-value lead (5 boxes)', () => { const k = K(); if (!k.mk) return; const id = 'c' + Date.now().toString(36), names = [['Marisol Vega', '+15125550187', 'marisol.vega@mail.example', '14 Wren Ct'], ['Theo Lindgren', '+15125550188', 'theo.lindgren@mail.example', '602 Poplar St']], n = names[data.customers.length % 2];
  const c = k.mk({ id, name: n[0], kind: 'household', channel: 'Website', type: 'purge', freq: 'One time', contacts: [{ name: n[0], role: '', phone: n[1], email: n[2] }], address: n[3], x: 320 + (data.customers.length * 71) % 380, y: 240 + (data.customers.length * 47) % 460, containers: '5 boxes', next: 0, cnotes: 'Website form: “I have 5 boxes of old tax papers. What would it cost to shred them?”' });
  Object.assign(c, { source: 'form', createdAt: now(), changes: [] }); c.locations.forEach(l => { try { l.items = WD.parseItems(l.containers); } catch (e) { l.items = []; } });
  k.addI({ customerId: id, type: 'note', at: now(), text: c.notes, by: 'RouteClerk · website form' }); WD.changed();
  const open = () => { if (WD.can('leads.view')) { toCRM('leads'); openLead(id); } };
  ui.banner({ title: 'New lead · website form', text: n[0] + ' — 5 boxes, one time.', icon: 'funnel', color: 'var(--purple)', duration: 3000, onTap: open });
  if (!aiOn()) return; const rule = lowMatch(c); if (!rule) return setTimeout(() => ui.toast('Low-value auto-reply is off in Settings → AI Premium', 'info.circle', 3200), 3200);
  setTimeout(() => { if (!q.customer(id) || c.lowValue) return; autoReply(c, rule); WD.changed(); const qd = c.lowValue && c.lowValue.queued;
    ui.banner({ title: 'AI Premium · low-value lead', text: n[0] + (qd ? ': the price and booking link go out at 8:00.' : ': price and booking link sent by ' + (LV().via === 'email' ? 'email' : 'text') + '. Nobody needs to do anything.'), icon: 'sparkles', color: 'var(--purple)', duration: 7000, onTap: open }); }, 3200); });

Object.assign(C2, { recommend, recommendInq, lowMatch, autoReply, vips, sheet, inquiries: inq, requests: reqs });
ensure();
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('needs', N); WD.app.uiState('crmDesk', DV); }
})();
