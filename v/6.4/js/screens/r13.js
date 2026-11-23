/* RouteClerk prototype — round 13 (`WD.r13`, version 4.3): the Contracts section (service agreements, tied to the CRM), the AI assistants
   (lead assistant, phone agent add-on, route monitoring with how far a job may move, week-ahead suggestions), the purge check-in email,
   and the Google Sheets integration. Settings for each are reached from the Settings groups in settings.js and Client communications in rc.js. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD, X = WD.r13 = {}, RC = WD.rc || {}, EX = WD.x || {};
const admin = () => WD.can('settings.manage'), today = () => D.today(), me = () => (S.me || {}).name || 'You';
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Your role doesn’t include this. An owner or admin can grant it in Team and roles.' });
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));
const plural = (n, w) => n + ' ' + (n === 1 ? w : w + 's'), first = n => String(n || '').split(' ')[0];
const K = () => (WD.screens.customers || {}).crm || {};
const radio = (cur, v, title, sub, set) => ui.row({ icon: cur === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: cur === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, onTap: () => set(v) });
/** Next business day on or after `k` moved by `n` business days (n may be negative). */
const bizAdd = (k, n) => { let d = k, step = n < 0 ? -1 : 1, left = Math.abs(n); while (left > 0) { d = D.add(d, step); const w = D.parse(d).getDay(); if (w !== 0 && w !== 6 && !(WD.dayMark && (WD.dayMark(d) || {}).closed)) left--; } return d; };

WD.css(`
.r13-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 2px 0 6px; }
.r13-stat { appearance: none; border: 0; background: var(--cell); border-radius: 14px; padding: 10px 6px 9px; text-align: center; color: var(--label); cursor: pointer; min-height: 60px; }
.r13-stat b { display: block; font-size: 22px; font-weight: 700; letter-spacing: -.4px; color: var(--c, var(--label)); }
.r13-stat span { display: block; font-size: 12px; line-height: 15px; color: var(--label2); margin-top: 1px; }
.r13-stat.on { box-shadow: inset 0 0 0 2px var(--tint); }
.r13-chat { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--cell); }
.r13-chat .m { max-width: 82%; padding: 8px 12px; border-radius: 17px; font-size: 15px; line-height: 20px; letter-spacing: -.2px; white-space: pre-wrap; }
.r13-chat .in { align-self: flex-start; background: var(--fill3); color: var(--label); border-bottom-left-radius: 5px; }
.r13-chat .out { align-self: flex-end; background: var(--tint); color: #fff; border-bottom-right-radius: 5px; }
.r13-chat .who { font-size: 12px; color: var(--label2); margin: 4px 4px 0; } .r13-chat .who.r { align-self: flex-end; }
.r13-mail { background: var(--cell); padding: 14px 16px; font-size: 15px; line-height: 21px; letter-spacing: -.2px; white-space: pre-wrap; }
.r13-mail b { display: block; margin-bottom: 8px; font-weight: 600; }
.r13-move { display: flex; align-items: flex-start; gap: 10px; width: 100%; }
.r13-move .t { flex: 1; min-width: 0; } .r13-move .t b { display: block; font-weight: 600; font-size: 16px; letter-spacing: -.3px; } .r13-move .t span { display: block; font-size: 13px; line-height: 17px; color: var(--label2); margin-top: 2px; }
.r13-late { margin: 0 0 10px; border-radius: 14px; padding: 12px 14px; background: color-mix(in srgb, var(--orange) 14%, var(--cell)); font-size: 15px; line-height: 20px; }
.r13-late b { font-weight: 700; }
`);

/* =====================================================================================================================
   Contracts: every service agreement in one place, tied to the CRM (who still needs one, who is up for renewal)
   ===================================================================================================================== */
const AGS = { draft: ['Draft', 'var(--gray)'], sent: ['Sent · not signed', 'var(--blue)'], viewed: ['Viewed · not signed', 'var(--orange)'], signed: ['Signed', 'var(--green)'] };
const canAg = () => WD.can('contracts.manage');
const agEnd = a => a.term ? D.add(a.start, Math.round(a.term * 30.44) - 1) : null;
const lcBadge = c => { const L = (K().LC || {})[c.lifecycle]; return L ? ui.badge(L[0], L[1]) : null; };
/** Leads the CRM says are close (quoted or scheduled) and recurring customers, with no agreement started. */
X.needsAgreement = () => data.customers.filter(c => !(data.agreements || []).some(a => a.customerId === c.id) && c.kind !== 'household' && c.type !== 'purge' && ['quoted', 'scheduled'].includes(c.lifecycle));
/** Signed agreements whose term ends within `days`. */
X.renewals = (days = 90) => (data.agreements || []).filter(a => a.status === 'signed' && agEnd(a) && D.diff(agEnd(a), today()) <= days).sort((a, b) => agEnd(a).localeCompare(agEnd(b)));
const openCRM = c => { const crm = WD.screens.crm; if (['lead', 'contacted', 'quoted', 'scheduled', 'lost'].includes(c.lifecycle) && crm && crm.openLead && WD.can('leads.view')) crm.openLead(c.id); else if (WD.screens.customers && WD.can('crm.view')) WD.screens.customers.openDetail(c.id); };
function pickCustomer(done) {
  let text = '';
  ui.sheet({ title: 'New agreement for', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], search: { placeholder: 'Customer or lead', onInput: (v, p) => { text = v.trim().toLowerCase(); p.refresh(); } },
    render: p => { const list = data.customers.filter(c => c.lifecycle !== 'lost' && (!text || c.name.toLowerCase().includes(text))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
      return ui.list(ui.section({ fold: false, footer: 'The agreement starts from the customer’s containers and rates. Leads from the CRM are listed too.' }, list.map(c => ui.row({ leading: ui.avatar(c.name, { size: 34 }), title: c.name, subtitle: (c.locations[0] || {}).address, badge: lcBadge(c), onTap: () => { p.dismiss(); done(c); } })), !list.length && ui.row({ title: 'Nobody matches' }))); } }, { detent: 'large' });
}
function contractsRoot() {
  const st = { filter: 'all', text: '' };
  return { title: 'Contracts', large: true, search: { placeholder: 'Search by customer or number', onInput: (v, p) => { st.text = v.trim().toLowerCase(); p.refresh(); } },
    trailing: page => canAg() ? [{ icon: 'plus', label: 'New agreement', onTap: () => pickCustomer(c => EX.createAgreement && page.push(EX.agreementSpec(EX.createAgreement(c)))) }] : [],
    render: page => {
      if (!canAg() && !WD.can('crm.view')) return locked();
      const all = (data.agreements || []).slice().sort((a, b) => (b.signedAt || b.sentAt || b.createdAt) - (a.signedAt || a.sentAt || a.createdAt)), wait = all.filter(a => a.status === 'sent' || a.status === 'viewed'), drafts = all.filter(a => a.status === 'draft'), signed = all.filter(a => a.status === 'signed'), ren = X.renewals(), need = X.needsAgreement();
      const match = a => { const c = q.customer(a.customerId); return !st.text || a.number.toLowerCase().includes(st.text) || (c && c.name.toLowerCase().includes(st.text)); };
      const when = t => fmt.rel(t).toLowerCase();
      const row = a => { const c = q.customer(a.customerId), end = agEnd(a);
        return ui.row({ leading: ui.avatar(c ? c.name : '?', { size: 36 }), title: c ? c.name : 'Customer removed', subtitle: [h('div', a.number + ' · ' + (a.term ? a.term / 12 + (a.term === 12 ? ' year' : ' years') : 'month to month') + (a.status === 'signed' && end ? ' · through ' + fmt.day(end, 'md') + ' ' + D.parse(end).getFullYear() : '')),
          h('div', a.status === 'signed' ? 'Signed by ' + a.signer + ' ' + when(a.signedAt) : a.sentAt ? 'Sent ' + when(a.sentAt) + ' by ' + String(a.sentVia).toLowerCase() + (a.viewedAt ? ' · opened' : ' · not opened yet') : 'Not sent yet')], badge: ui.badge(AGS[a.status][0], AGS[a.status][1]), chevron: true, onTap: () => page.push(EX.agreementSpec(a)) }); };
      const stat = (id, n, label, color) => h('button.r13-stat' + (st.filter === id ? '.on' : ''), { 'aria-label': n + ' ' + label, style: { '--c': n ? color : 'var(--label3)' }, onclick: () => { st.filter = st.filter === id ? 'all' : id; page.refresh(); } }, h('b', String(n)), h('span', label));
      const show = id => st.filter === 'all' || st.filter === id;
      return ui.list(
        h('div.r13-stats', stat('wait', wait.length, 'To sign', 'var(--orange)'), stat('draft', drafts.length, 'Drafts', 'var(--gray)'), stat('signed', signed.length, 'Signed', 'var(--green)'), stat('renew', ren.length, 'Renewals', 'var(--red)')),
        show('wait') && st.filter !== 'all' && !wait.length ? ui.section(null, ui.row({ title: 'Nothing is waiting for a signature' })) : null,
        /* New agreement requests (r14-crm.js): the tracker that replaces the new-contracts spreadsheet. */
        st.filter === 'all' && !st.text && WD.crm2 && WD.crm2.requestsSection ? WD.crm2.requestsSection(page) : null,
        show('wait') && wait.filter(match).length > 0 && ui.section({ header: 'Waiting for a signature', fold: false, showFooter: true, footer: 'Drivers see these on the customer’s next job and can collect the signature in person.' }, wait.filter(match).map(row)),
        st.filter === 'all' && !st.text && canAg() && need.length > 0 && ui.section({ header: 'From the CRM · no agreement yet', fold: false, showFooter: true, footer: 'Leads that have been quoted or scheduled for recurring service. Starting an agreement here shows on the lead in the CRM.' },
          need.slice(0, 6).map(c => ui.row({ leading: ui.avatar(c.name, { size: 36 }), title: c.name, subtitle: (c.containers || (c.locations[0] || {}).containers || 'Recurring service') + ' · ' + c.freq, badge: lcBadge(c),
            trailing: ui.button('Create', { kind: 'tinted', small: true, block: false, onTap: e => { e.stopPropagation(); page.push(EX.agreementSpec(EX.createAgreement(c))); } }), onTap: () => openCRM(c) }))),
        show('renew') && ren.filter(match).length > 0 && ui.section({ header: 'Up for renewal', fold: false, showFooter: true, footer: 'Signed agreements whose term ends in the next 90 days. Add a follow-up so it shows in the CRM’s tasks.' }, ren.filter(match).map(a => { const c = q.customer(a.customerId), end = agEnd(a), n = D.diff(end, today());
          return ui.row({ leading: ui.avatar(c ? c.name : '?', { size: 36 }), title: c ? c.name : a.number, subtitle: a.number + ' · ' + (n < 0 ? 'term ended ' + fmt.day(end, 'md') : 'term ends ' + fmt.day(end, 'md') + ' (' + plural(n, 'day') + ')'), badge: a.renewTask ? ui.badge('Follow-up set', 'var(--green)') : null,
            trailing: !a.renewTask && c && K().addTask ? ui.button('Follow up', { kind: 'tinted', small: true, block: false, onTap: e => { e.stopPropagation(); K().addTask(c.id, 'Renew service agreement ' + a.number, 0); a.renewTask = true; WD.changed(); page.refresh(); ui.toast('Added to CRM tasks', 'checkmark'); } }) : null, chevron: !!a.renewTask, onTap: () => page.push(EX.agreementSpec(a)) }); })),
        show('draft') && drafts.filter(match).length > 0 && ui.section({ header: 'Drafts', fold: false }, drafts.filter(match).map(row)),
        show('signed') && signed.filter(match).length > 0 && ui.section({ header: 'Signed', fold: st.filter === 'all', folded: st.filter === 'all' && signed.length > 6 }, signed.filter(match).map(row)),
        !all.filter(match).length && ui.empty({ icon: 'signature', title: st.text ? 'No agreement matches' : 'No agreements yet', text: st.text ? 'Try the customer’s name or the agreement number.' : 'Tap + to start one from a customer or a lead.' }),
        canAg() && ui.section({ header: 'Wording and terms', fold: false },
          WD.co && WD.co.editAgreementDoc && data.agreementTemplate && ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: 'Agreement wording', subtitle: 'What new agreements start from', chevron: true, onTap: () => WD.co.editAgreementDoc(data.agreementTemplate, { template: true }) }),
          WD.r11 && WD.r11.moneySpec && admin() && ui.row({ icon: 'calendar', iconColor: 'var(--teal)', title: 'Term, renewal and notice', subtitle: WD.r11.cfg.contract.term / 12 + '-year usual term · ' + WD.r11.cfg.contract.notice + ' days’ notice', chevron: true, onTap: () => page.push(WD.r11.moneySpec()) })));
    } };
}
WD.screens.contracts = { root: contractsRoot };
/* No badge: an agreement the customer has opened but not signed is worth a look, not something that has to be done today. It is listed at the top of Contracts. */
/* The CRM side of the link: signing an agreement moves a quoted lead on to Scheduled, and leaves a line on its timeline. */
if (EX.signAgreement) { const base = EX.signAgreement; EX.signAgreement = async (a, job) => { const ok = await base(a, job), c = q.customer(a.customerId);
  if (ok && c) { if (['lead', 'contacted', 'quoted'].includes(c.lifecycle)) c.lifecycle = 'scheduled'; if (K().addI) K().addI({ customerId: c.id, type: 'note', at: +WD.now(), by: me(), text: 'Service agreement ' + a.number + ' signed by ' + a.signer + '.' }); WD.changed(); } return ok; }; }
/** CRM lead page and customer record: the agreement, or a way to start one. */
X.agreementRow = c => { const list = EX.agreementsFor ? EX.agreementsFor(c.id) : [], a = list[0];
  if (!a && !canAg()) return null;
  return ui.row({ icon: 'signature', iconColor: a ? AGS[a.status][1] : 'var(--gray)', title: a ? 'Service agreement ' + a.number : 'Service agreement', subtitle: a ? (a.status === 'signed' ? 'Signed by ' + a.signer + ' · ' + fmt.rel(a.signedAt).toLowerCase() : AGS[a.status][0]) : 'None yet · create one from this customer’s pricing', badge: a ? ui.badge(AGS[a.status][0], AGS[a.status][1]) : null, chevron: true,
    onTap: () => WD.nav.push(EX.agreementSpec(a || EX.createAgreement(c))) }); };

/* =====================================================================================================================
   AI lead assistant (Premium): replies to a new lead, quotes and offers days. Hands off what it should not decide.
   ===================================================================================================================== */
const AI = data.aiAgents = {
  lead: { on: true, channels: { text: true, email: true, form: true }, hours: 'always', quote: true, schedule: 'offer', maxBoxes: 60, handoff: { government: true, complaint: true, recurring: false }, tone: 'friendly', name: 'Riley' },
  phone: { when: 'busy', rings: 4, greeting: 'Thanks for calling {company}. Everyone is helping other customers, so I’m the automated assistant. I can give you a price, get you on the schedule, or have someone call you right back.', quote: true, schedule: true, callbackMins: 30, flag: true },
  route: { reorder: 'suggest', alert: true, lateBy: 30, endOfDay: '17:00', flex: { regular: { early: 2, late: 3, tell: false }, weekly: { early: 1, late: 1, tell: false }, purge: { early: 0, late: 1, tell: true }, setup: { early: 0, late: 0, tell: true } }, lookahead: true, lookDays: 10, traffic: true, truck: true },
};
const aiOn = id => !!(RC.ai && RC.ai(id));
const gate = (id, build) => RC.aiBlock ? RC.aiBlock(id, build) : build();
X.leadAILabel = () => !aiOn('leadbot') ? 'Premium plan' : AI.lead.on ? 'On · ' + ['text', 'email', 'form'].filter(k => AI.lead.channels[k]).join(', ') : 'Off';
const SAMPLE_CHAT = () => [['in', 'Hi, do you do one-time shredding? I have about 15 boxes in my garage.'], ['out', 'Hi! This is ' + AI.lead.name + ', the assistant at ' + (S.org || {}).name + '. Yes, we shred on site at your home while you watch. Are they standard banker boxes, and is the garage at ground level?'],
  ['in', 'Yes standard boxes, ground level'], ['out', '15 standard boxes is about ' + fmt.money(15 * ((data.priceBook.find(x => x.id === 'box') || {}).rate || 8) + 45) + ', depending on the final count. It’s a rough estimate from what you told me; you pay for what we actually shred. We’re in your area ' + fmt.day(bizAdd(today(), 2), 'long') + ' or ' + fmt.day(bizAdd(today(), 5), 'long') + '. Would either work?'],
  ['in', fmt.day(bizAdd(today(), 2), 'weekday') + ' works'], ['out', 'You’re set for ' + fmt.day(bizAdd(today(), 2), 'long') + '. You’ll get a text that morning with a 2-hour arrival window. What’s the address?']];
const chat = (msgs, who) => h('div.r13-chat', msgs.map(([dir, t], i) => [dir === 'out' && (i === 0 || msgs[i - 1][0] !== 'out') ? h('div.who.r', who) : null, h('div.m.' + dir, t)]));
X.leadAISpec = () => ({ title: 'AI lead assistant', render: page => { if (!admin()) return locked(); const L = AI.lead, re = () => { WD.changed(); page.refresh(); };
  return ui.list(gate('leadbot', () => ui.list(
    ui.section({ fold: false, showFooter: true, footer: L.on ? 'A new lead gets an answer within a minute. The whole conversation is on the lead in the CRM, marked as written by the assistant, and anyone can take over by replying.' : 'Off: new leads wait for a person, as they do today.' },
      ui.toggleRow({ icon: 'sparkles', iconColor: 'var(--purple)', title: 'Answer new leads automatically', value: L.on, onChange: v => { L.on = v; re(); } }),
      L.on && ui.inputRow({ label: 'Introduces itself as', value: L.name, onInput: v => { L.name = v; } })),
    L.on && ui.section({ header: 'Where it answers', fold: false, footer: 'Yelp keeps its conversations on Yelp, so those leads still need a person.' },
      [['text', 'Text messages', 'To your business numbers'], ['email', 'Email', 'To the connected mailbox'], ['form', 'Website form', 'Replies by text or email, whichever the lead gave']].map(([k, title, sub]) => ui.toggleRow({ title, subtitle: sub, value: L.channels[k], onChange: v => { L.channels[k] = v; re(); } })),
      ui.pickerRow({ title: 'When', value: L.hours, options: [{ value: 'always', label: 'Any time' }, { value: 'after', label: 'Only outside business hours' }, { value: 'wait', label: 'Only if nobody replies in 10 minutes' }], onChange: v => { L.hours = v; re(); } })),
    L.on && ui.section({ header: 'What it may do', fold: false, showFooter: true, footer: 'Quotes come from Services and Fees and the Price Calc rules, and always say they are estimates from what the customer described.' },
      ui.toggleRow({ title: 'Give a price', subtitle: 'From your rates and purge pricing', value: L.quote, onChange: v => { L.quote = v; re(); } }),
      ui.pickerRow({ title: 'Scheduling', value: L.schedule, options: [{ value: 'none', label: 'Don’t schedule; hand to a person' }, { value: 'offer', label: 'Offer days, a person confirms' }, { value: 'book', label: 'Book it on the route' }], onChange: v => { L.schedule = v; re(); } }),
      ui.row({ title: 'Largest purge it may quote', detail: L.maxBoxes + ' boxes', trailing: ui.stepper(L.maxBoxes / 10, 1, 30, v => { L.maxBoxes = v * 10; re(); }) })),
    L.on && ui.section({ header: 'Always hand to a person', fold: false, footer: 'The lead is flagged in the CRM with what was said so far, and the assistant tells the customer someone will be in touch.' },
      [['government', 'Government and public agencies'], ['complaint', 'Complaints and billing disputes'], ['recurring', 'Recurring service (consoles and bins)']].map(([k, title]) => ui.toggleRow({ title, value: L.handoff[k], onChange: v => { L.handoff[k] = v; re(); } }))),
    L.on && ui.section({ header: 'Example conversation', fold: false }, chat(SAMPLE_CHAT(), L.name + ' · AI assistant')),
    L.on && ui.section(null, ui.row({ icon: 'play', iconPlain: true, title: 'Try it: a new lead texts in', tint: true, onTap: () => X.simLead() })))));
} });
/** Demo: a lead texts in, the assistant quotes and offers days; the lead and the thread land in the CRM. */
X.simLead = () => {
  if (!aiOn('leadbot')) return ui.banner({ title: 'AI lead assistant', text: 'Included in the Premium plan. Settings → CRM → AI lead assistant.', icon: 'sparkles', color: 'var(--purple)', onTap: () => { WD.nav.switchTab('settings'); WD.nav.push(X.leadAISpec()); } });
  const k = K(); if (!k.mk || !k.addI) return; const id = 'c' + Date.now().toString(36), msgs = SAMPLE_CHAT(), base = +WD.now() - msgs.length * 50000;
  const c = k.mk({ id, name: 'Dana Whitfield', kind: 'household', channel: 'Website', type: 'purge', freq: 'One time', lifecycle: AI.lead.schedule === 'book' ? 'scheduled' : 'quoted', contacts: [{ name: 'Dana Whitfield', role: '', phone: '5125550166', email: 'dana.w@mail.example' }], address: '412 Larkspur Ln', x: 640, y: 520, containers: '15 boxes', cnotes: 'Handled by the AI lead assistant: quoted 15 boxes and offered ' + fmt.day(bizAdd(today(), 2), 'long') + '.', next: 0 });
  c.aiHandled = true; c.priority = 'high';
  k.addI({ customerId: id, type: 'text', at: +WD.now(), contact: 'Dana Whitfield', number: '5125550166', line: 'Main', messages: msgs.map(([dir, text], i) => ({ dir, text, at: base + i * 50000, by: dir === 'out' ? AI.lead.name + ' (AI assistant)' : null, state: 'delivered' })) });
  if (k.addTask) k.addTask(id, AI.lead.schedule === 'book' ? 'Review the purge the AI assistant booked' : 'Confirm the day the AI assistant offered', 0, { lead: true });
  WD.changed();
  ui.banner({ title: 'AI assistant answered a new lead', text: 'Dana Whitfield · 15 boxes · quoted and offered ' + fmt.day(bizAdd(today(), 2), 'weekday') + '. Tap to review.', icon: 'sparkles', color: 'var(--purple)', onTap: () => { WD.nav.switchTab('crm'); WD.screens.crm && WD.screens.crm.openLead && WD.screens.crm.openLead(id); } });
};

/* =====================================================================================================================
   AI phone agent (paid add-on): answers when nobody can, handles simple calls, offers a call back for the rest
   ===================================================================================================================== */
const phoneOn = () => !!(RC.addon && RC.addon('phone'));
X.phoneAILabel = () => phoneOn() ? { busy: 'On · when nobody answers', after: 'On · after hours', always: 'On · every call' }[AI.phone.when] : 'Paid add-on · off';
X.phoneAISpec = () => ({ title: 'AI phone agent', render: page => { if (!admin()) return locked(); const P = AI.phone, re = () => { WD.changed(); page.refresh(); }, on = phoneOn();
  return ui.list(note('When nobody is free to pick up, the phone agent answers instead of voicemail. It handles what is simple and gets a person involved for everything else.'),
    ui.section({ fold: false, showFooter: true, footer: on ? 'Billed by the minute answered, on top of your plan. Switch it off any time in Plan and AI features.' : 'A paid add-on, billed by the minute answered. An owner switches it on in Plan and AI features.' },
      ui.row({ icon: 'phone.fill', iconColor: 'var(--green)', title: 'AI phone agent', subtitle: on ? 'Switched on' : 'Not switched on', trailing: ui.button(on ? 'Manage' : 'See the add-on', { kind: on ? 'gray' : 'filled', small: true, block: false, onTap: () => RC.planSpec && page.push(RC.planSpec()) }) })),
    on && ui.section({ header: 'When it answers', fold: false }, radio(P.when, 'busy', 'When nobody picks up', 'After ' + P.rings + ' rings, during business hours and after', v => { P.when = v; re(); }), radio(P.when, 'after', 'Only outside business hours', 'During the day, calls ring through as usual', v => { P.when = v; re(); }), radio(P.when, 'always', 'Every call', 'It answers first and passes callers to a person when asked', v => { P.when = v; re(); }),
      P.when === 'busy' && ui.row({ title: 'Rings before it answers', detail: String(P.rings), trailing: ui.stepper(P.rings, 2, 8, v => { P.rings = v; re(); }) })),
    on && ui.section({ header: 'Greeting', fold: false, footer: 'It always says it is an automated assistant.' }, ui.inputRow({ multiline: true, value: P.greeting, onInput: v => { P.greeting = v; } })),
    on && ui.section({ header: 'What it handles by itself', fold: false, showFooter: true, footer: 'Service days, arrival windows, “did you come today?”, prices from your rates, and one-time purges inside the limits set for the AI lead assistant.' },
      ui.toggleRow({ title: 'Give prices', value: P.quote, onChange: v => { P.quote = v; re(); } }), ui.toggleRow({ title: 'Schedule and reschedule', subtitle: 'Within how far each kind of job may move', value: P.schedule, onChange: v => { P.schedule = v; re(); } })),
    on && ui.section({ header: 'When the call is too complex', fold: false, showFooter: true, footer: 'The caller is told when to expect the call. The CRM gets the caller, what they need, everything they said, and a recording.' },
      ui.row({ icon: 'phone.fill', iconPlain: true, iconColor: 'var(--green)', title: 'It offers to have someone call back' }),
      ui.pickerRow({ title: 'Promise a call back within', value: P.callbackMins, options: [15, 30, 60, 120].map(n => ({ value: n, label: n < 60 ? n + ' minutes' : n / 60 + (n === 60 ? ' hour' : ' hours') })).concat({ value: 0, label: 'The next business day' }), onChange: v => { P.callbackMins = v; re(); } }),
      ui.toggleRow({ title: 'Flag it for immediate attention', subtitle: 'High priority in the CRM, a task due now, and a notification to the office', value: P.flag, onChange: v => { P.flag = v; re(); } })),
    on && ui.section(null, ui.row({ icon: 'play', iconPlain: true, title: 'Try it: a call nobody can take', tint: true, onTap: () => X.simCall() })));
} });
/** Demo: a caller with a request the agent should not decide. The agent takes the details and promises a call back. */
X.simCall = () => {
  if (!phoneOn()) return ui.banner({ title: 'AI phone agent', text: 'A paid add-on. Switch it on in Settings → Company → Plan and AI features.', icon: 'phone.fill', color: 'var(--green)', onTap: () => { WD.nav.switchTab('settings'); RC.planSpec && WD.nav.push(RC.planSpec()); } });
  const k = K(), c = q.customer('c7') || data.customers.find(x => x.lifecycle === 'customer') || data.customers[0], p = c.contacts[0] || { name: 'Caller', phone: '' }, P = AI.phone, by = P.callbackMins ? 'within ' + (P.callbackMins < 60 ? P.callbackMins + ' minutes' : P.callbackMins / 60 + ' hr') : 'the next business day';
  const summary = first(p.name) + ' is moving offices next month and wants to move ' + c.name + '’s consoles to the new address, add two more, and change to every two weeks. Asked whether the price changes and whether the agreement has to be redone. Too many changes for the assistant to decide: promised a call back ' + by + '.';
  const tr = [['Caller', 'Hi, this is ' + p.name + ' at ' + c.name + '. We’re moving next month and I need to change our service.'], ['Agent', 'I can help with that. What needs to change?'], ['Caller', 'New address, two more consoles, and we want pickup every two weeks instead of monthly. Does the price change? Do we need a new contract?'],
    ['Agent', 'Those are changes to your agreement and pricing, so I’d like someone from the office to go over them with you. I have all the details. Can they call you back at this number ' + by + '?'], ['Caller', 'Yes, that’s fine.'], ['Agent', 'Done. You’ll hear from us ' + by + '. Thank you, ' + first(p.name) + '.']];
  if (k.addI) k.addI({ customerId: c.id, type: 'call', dir: 'in', at: +WD.now(), duration: 96, contact: p.name, number: p.phone, line: 'Main', by: 'AI phone agent', summary: 'AI phone agent: ' + summary, transcript: [] });
  if (k.addTask) k.addTask(c.id, 'CALL BACK ' + by + ': ' + first(p.name) + ' — moving, 2 more consoles, every 2 weeks', 0);
  if (P.flag) { c.priority = 'high'; c.callback = { at: +WD.now(), by, summary }; }
  WD.changed();
  const open = () => ui.sheet({ title: 'Call answered by AI', trailing: [{ label: 'Done', bold: true, onTap: pg => pg.dismiss() }], render: pg => ui.list(
    h('div.r13-late', h('b', 'Call back ' + by + '. '), 'Flagged for immediate attention' + (P.flag ? ' and added to the CRM tasks.' : '.')),
    ui.section({ header: c.name + ' · ' + p.name, fold: false }, ui.row({ icon: 'sparkles', iconColor: 'var(--purple)', title: 'What they need', subtitle: summary }), ui.row({ icon: 'phone.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Call ' + first(p.name) + ' back', subtitle: fmt.phone(p.phone), tint: true, onTap: () => ui.toast('Calling ' + fmt.phone(p.phone), 'phone.fill') }),
      WD.can('crm.view') && ui.row({ title: 'Open customer', chevron: true, onTap: () => { pg.dismiss(); WD.screens.customers.openDetail(c.id); } })),
    ui.section({ header: 'Transcript · 1 min 36 s', fold: false }, h('div.r13-chat', tr.map(([who, t]) => [h('div.who' + (who === 'Agent' ? '.r' : ''), who === 'Agent' ? 'AI phone agent' : who), h('div.m.' + (who === 'Agent' ? 'out' : 'in'), t)])))) }, { detent: 'large' });
  ui.banner({ title: 'Call back needed · ' + c.name, text: 'The AI phone agent took a call it couldn’t finish. Tap for the details.', icon: 'phone.fill', color: 'var(--red)', duration: 9000, onTap: open });
};

/* =====================================================================================================================
   AI route monitoring (Premium): follows the day, re-orders, warns when the route won't finish, suggests what to move
   ===================================================================================================================== */
const FLEX = [['regular', 'Route service', 'Every 2 to 12 weeks'], ['weekly', 'Weekly service', 'Serviced every week'], ['purge', 'Purge jobs', 'A one-time job on a day the customer was given'], ['setup', 'Setups and first service', 'New customers']];
const flexText = f => (f.early || f.late ? (f.early ? plural(f.early, 'business day') + ' early' : 'not early') + ' · ' + (f.late ? plural(f.late, 'business day') + ' late' : 'not late') : 'Stays on its day') + (f.tell ? ' · ask the customer first' : f.early || f.late ? ' · without notifying' : '');
/** How far this job may move without it being a problem: {early, late, tell} in business days. */
X.flexFor = job => { const F = AI.route.flex, c = job.customerId && q.customer(job.customerId); if (job.type === 'purge') return F.purge; if (job.type === 'setup') return F.setup; if (c && /^weekly$/i.test(c.freq || '')) return F.weekly; return F.regular; };
X.routeAILabel = () => !aiOn('routewatch') ? 'Premium plan' : AI.route.reorder === 'auto' ? 'Re-orders stops by itself' : AI.route.reorder === 'suggest' ? 'Suggests changes' : 'Alerts only';
X.routeAISpec = () => ({ title: 'AI route monitoring', render: page => { if (!admin()) return locked(); const R = AI.route, re = () => { WD.changed(); page.refresh(); };
  const flexRow = ([k, title, sub]) => ui.row({ icon: 'calendar', iconColor: 'var(--teal)', title, subtitle: [h('div', sub), h('div', { style: 'color:var(--label);font-weight:500' }, flexText(R.flex[k]))], chevron: true, onTap: () => { const f = R.flex[k];
    ui.sheet({ title, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], onClose: () => page.refresh(), render: p => ui.list(ui.section({ fold: false, showFooter: true, footer: 'Counted in business days from the day the job is on. The assistant only ever suggests a move inside these limits.' },
        ui.row({ title: 'May be done early by', detail: plural(f.early, 'day'), trailing: ui.stepper(f.early, 0, 5, v => { f.early = v; WD.changed(); p.refresh(); }) }), ui.row({ title: 'May be done late by', detail: plural(f.late, 'day'), trailing: ui.stepper(f.late, 0, 5, v => { f.late = v; WD.changed(); p.refresh(); }) }),
        ui.toggleRow({ title: 'Ask the customer first', subtitle: f.tell ? 'A move is suggested with a message to send; nothing changes until they agree' : 'The customer isn’t notified; the visit just happens a little early or late', value: f.tell, onChange: v => { f.tell = v; WD.changed(); p.refresh(); } }))) }, { detent: 'medium' }); } });
  return ui.list(gate('routewatch', () => ui.list(note('The assistant follows each truck against the plan: where it is, how long stops are taking, what is left. It keeps the rest of the day realistic and tells people early when it isn’t.'),
    ui.section({ header: 'During the day', fold: false },
      ui.pickerRow({ title: 'When the order should change', subtitle: 'For example the driver skipped ahead, or a stop opens late', value: R.reorder, options: [{ value: 'auto', label: 'Re-order the stops and tell the driver' }, { value: 'suggest', label: 'Suggest it; the driver or dispatch accepts' }, { value: 'off', label: 'Leave the order alone' }], onChange: v => { R.reorder = v; re(); } }),
      ui.toggleRow({ title: 'Warn when the route won’t finish', subtitle: 'The driver and dispatch are both told, with what to move', value: R.alert, onChange: v => { R.alert = v; re(); } }),
      R.alert && ui.pickerRow({ title: 'Warn when the last stop would be late by', value: R.lateBy, options: [15, 30, 45, 60].map(n => ({ value: n, label: n + ' minutes' })), onChange: v => { R.lateBy = v; re(); } }),
      R.alert && ui.quarterRow({ title: 'The day should end by', value: R.endOfDay, optional: false, onChange: v => { R.endOfDay = v; WD.changed(); } })),
    ui.section({ header: 'How far a job may move', fold: false, showFooter: true, footer: 'When a day won’t fit, the assistant recommends moving the jobs that mind least, and never further than this. Customers with a required window, exact-time jobs and anything marked “do not move” are left alone.' }, FLEX.map(flexRow)),
    ui.section({ header: 'Looking ahead', fold: false, showFooter: true, footer: 'Each morning it reads the coming days and recommends moving a purge job to a day when a truck is already nearby, with the miles saved. A person approves every move.' },
      gate('lookahead', () => [ui.toggleRow({ title: 'Recommend better days for purge jobs', value: R.lookahead, onChange: v => { R.lookahead = v; re(); } }), R.lookahead && ui.pickerRow({ title: 'Look ahead', value: R.lookDays, options: [5, 7, 10, 14].map(n => ({ value: n, label: n + ' days' })), onChange: v => { R.lookDays = v; re(); } })])),
    ui.section({ header: 'Roads and traffic', fold: false, showFooter: true, footer: 'Truck-legal routing uses each truck’s height, length and weight from Maintenance. It relies on commercial truck-road data, which costs more per route than ordinary maps, so it is part of the Premium plan. Drivers can also follow a truck GPS app (Settings → Routes and board → Directions app).' },
      gate('traffic', () => ui.toggleRow({ icon: 'clock', iconColor: 'var(--orange)', title: 'Use traffic for the time and day', subtitle: 'A stop at 8 AM on Monday is planned with Monday 8 AM traffic', value: R.traffic, onChange: v => { R.traffic = v; re(); } })),
      gate('truckroute', () => ui.toggleRow({ icon: 'truck', iconColor: 'var(--red)', title: 'Truck-legal roads only', subtitle: 'Avoids low bridges, weight limits and no-truck roads', value: R.truck, onChange: v => { R.truck = v; re(); } }))),
    ui.section(null, ui.row({ icon: 'play', iconPlain: true, title: 'Try it: a route falls behind', tint: true, onTap: () => X.simBehind() }), R.lookahead && ui.row({ icon: 'play', iconPlain: true, title: 'Try it: this week’s suggestions', tint: true, onTap: () => X.lookAhead() })))));
} });
const routeLate = () => { const day = today(); return q.visibleRoutes().map(r => ({ r, left: q.stopList(r.id, day).filter(j => j.status === 'scheduled' && !j.pending && j.type !== 'dump') })).sort((a, b) => b.left.length - a.left.length)[0]; };
/** The jobs to move when a day won't fit: the most flexible first, each with the day it could go to. */
X.moveSuggestions = (routeId, day, need) => { const left = q.stopList(routeId, day).filter(j => j.status === 'scheduled' && !j.pending && j.type !== 'dump' && !j.custStrict && !j.exact), out = []; let got = 0;
  left.map(j => ({ j, f: X.flexFor(j) })).filter(x => x.f.late > 0).sort((a, b) => (a.f.tell - b.f.tell) || (b.f.late - a.f.late) || (b.j.seq - a.j.seq)).forEach(x => { if (got >= need) return; const mins = (x.j.dur || 20) + 12; got += mins; out.push({ job: x.j, flex: x.f, to: bizAdd(day, 1), mins }); });
  return { list: out, saved: got }; };
X.simBehind = () => {
  if (!aiOn('routewatch')) return ui.banner({ title: 'AI route monitoring', text: 'Included in the Premium plan. Settings → Routes and board → AI route monitoring.', icon: 'sparkles', color: 'var(--purple)', onTap: () => { WD.nav.switchTab('settings'); WD.nav.push(X.routeAISpec()); } });
  const hit = routeLate(); if (!hit || hit.left.length < 2) return ui.toast('No route has stops left today', 'info.circle');
  const { r, left } = hit, day = today(), behind = 55, end = fmt.fromHHMM(AI.route.endOfDay) || 1020, drv = q.driverFor(r.id), sug = X.moveSuggestions(r.id, day, behind), picked = new Set(sug.list.map(s => s.job.id));
  const open = () => ui.sheet({ title: r.name + ' won’t finish', leading: [{ label: 'Not now', onTap: p => p.dismiss() }],
    trailing: p => [{ label: 'Move ' + picked.size, bold: true, disabled: !picked.size, onTap: async () => { const moves = sug.list.filter(s => picked.has(s.job.id)); if (!moves.length) return;
      api.op({ kind: 'batch', title: plural(moves.length, 'job') + ' moved off ' + r.name, scope: 'AI suggestion accepted', jobIds: moves.map(m => m.job.id), apply() { moves.forEach(m => { WD.placeJob(m.job, r.id, m.to, 999); m.job.events.push({ at: +WD.now(), actor: me(), text: 'Moved from ' + fmt.day(day, 'md') + ' to ' + fmt.day(m.to, 'md') + ': the route was running ' + behind + ' min behind (AI suggestion)' }); }); } });
      p.dismiss(); ui.toast(plural(moves.length, 'job') + ' moved · ' + (drv ? first(drv.name) + ' was told' : 'driver told'), 'checkmark', 2600); } }],
    render: p => ui.list(h('div.r13-late', h('b', r.name + ' is ' + behind + ' minutes behind. '), plural(left.length, 'stop') + ' left; at this pace the last one finishes about ' + fmt.time(end + behind - 10) + ', past the ' + fmt.time(end) + ' end of the day. ' + (drv ? first(drv.name) : 'The driver') + ' and dispatch were both told.'),
      AI.route.reorder !== 'off' && ui.section({ header: 'Stop order', fold: false }, ui.row({ icon: 'arrow.left.arrow.right', iconColor: 'var(--blue)', title: AI.route.reorder === 'auto' ? 'The stops left were re-ordered' : 'A better order is ready', subtitle: 'Puts the stops that close earliest first and saves about 14 minutes of driving', trailing: AI.route.reorder === 'auto' ? ui.badge('Done', 'var(--green)') : ui.button('Use it', { kind: 'tinted', small: true, block: false, onTap: () => ui.toast('Stops re-ordered · driver told', 'checkmark') }) })),
      ui.section({ header: 'Suggested: move to ' + fmt.day(bizAdd(day, 1), 'long'), fold: false, showFooter: true, footer: sug.list.length ? 'Frees about ' + fmt.dur(sug.saved) + '. Chosen because these jobs can run late without anyone minding (Settings → Routes and board → AI route monitoring).' : 'Nothing left on this route may move under your settings. Consider sending help or calling the last customers.' },
        sug.list.map(s => { const c = s.job.customerId && q.customer(s.job.customerId); return ui.row({ onTap: () => { picked.has(s.job.id) ? picked.delete(s.job.id) : picked.add(s.job.id); p.refresh(); }, leading: icon(picked.has(s.job.id) ? 'checkmark.circle.fill' : 'circle', 24, picked.has(s.job.id) ? 'var(--tint)' : 'var(--label3)'),
          title: s.job.title, subtitle: [h('div', (WD.itemsLabel && s.job.items ? WD.itemsLabel(s.job.items, s.job.type === 'purge') + ' · ' : '') + 'about ' + fmt.dur(s.mins)), h('div', { style: 'color:var(--label)' }, s.flex.tell ? 'Ask first: ' + (c ? first((c.contacts[0] || {}).name) || 'the customer' : 'the customer') + ' was given this day' : (s.job.type === 'purge' ? 'Purge' : c && /^weekly$/i.test(c.freq || '') ? 'Weekly service' : 'Route service') + ': up to ' + plural(s.flex.late, 'day') + ' late is fine, no need to notify')] }); })),
      ui.section({ header: 'Or run late', fold: false }, ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Keep every stop and finish about ' + fmt.time(end + behind - 10), subtitle: 'Texts the last ' + Math.min(3, left.length) + ' customers a new arrival window', tint: true, onTap: () => { p.dismiss(); ui.toast('New windows sent to ' + Math.min(3, left.length) + ' customers', 'message', 2600); } }))) }, { detent: 'large' });
  ui.banner({ title: r.name + ' won’t finish today', text: behind + ' min behind with ' + plural(left.length, 'stop') + ' left. Tap for what to move.', icon: 'exclamationmark.triangle', color: 'var(--orange)', duration: 9000, onTap: open });
};
/** Week-ahead: purge jobs that would cost fewer miles on another day inside the window the customer accepts. */
X.lookAheadList = () => { const out = [], t = today();
  data.jobs.filter(j => j.type === 'purge' && j.status === 'scheduled' && j.day > t && D.diff(j.day, t) <= AI.route.lookDays && j.x != null).forEach(j => { const f = X.flexFor(j); let best = null;
    const near = (routeId, day) => { const stops = q.stopList(routeId, day).filter(s => s !== j && s.x != null); return stops.length ? Math.min(...stops.map(s => Math.hypot(s.x - j.x, s.y - j.y))) : 450; }, cur = near(j.routeId, j.day); if (out.some(o => o.job.title === j.title)) return;
    for (let n = -Math.max(f.early, 1); n <= Math.max(f.late, 2); n++) { if (!n) continue; const d = bizAdd(j.day, n); if (d <= t) continue; q.routes().forEach(r => { const dist = near(r.id, d); if (dist < cur * 0.55 && (!best || dist < best.dist)) best = { day: d, routeId: r.id, dist }; }); }
    if (best) out.push({ job: j, to: best.day, routeId: best.routeId, miles: Math.min(24, Math.max(3, Math.round((cur - best.dist) / 22))), ask: f.tell || Math.abs(D.diff(best.day, j.day)) > Math.max(f.early, f.late) }); });
  return out.sort((a, b) => b.miles - a.miles).slice(0, 5); };
X.lookAhead = () => {
  if (!aiOn('lookahead')) return ui.banner({ title: 'Week-ahead suggestions', text: 'Included in the Premium plan.', icon: 'sparkles', color: 'var(--purple)' });
  const list = X.lookAheadList(), done = new Set();
  ui.sheet({ title: 'Week-ahead suggestions', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: p => ui.list(note('Purge jobs in the next ' + AI.route.lookDays + ' days that would be cheaper to run on another day, because a truck is already close by.'),
    list.length ? ui.section({ fold: false, showFooter: true, footer: 'Most purge customers want the day they were given, so each move comes with a message asking them first. Nothing moves until you say so.' }, list.map(s => { const c = s.job.customerId && q.customer(s.job.customerId);
      return ui.row({ icon: 'calendar', iconColor: 'var(--yellow)', title: s.job.title, subtitle: [h('div', fmt.day(s.job.day, 'short') + ' → ' + fmt.day(s.to, 'short') + ' on ' + q.routeName(s.routeId)), h('div', { style: 'color:var(--label)' }, 'Saves about ' + s.miles + ' miles · ' + q.routeName(s.routeId) + ' is nearby that day')],
        trailing: done.has(s.job.id) ? ui.badge(s.ask ? 'Asked' : 'Moved', 'var(--green)') : ui.button(s.ask ? 'Ask customer' : 'Move', { kind: 'tinted', small: true, block: false, onTap: async () => {
          if (s.ask) { if (!await ui.run('Sending…', null, { done: 'Sent' })) return; s.job.events.push({ at: +WD.now(), actor: me(), text: 'Asked ' + (c ? c.name : 'the customer') + ' whether ' + fmt.day(s.to, 'long') + ' works instead (AI suggestion)' }); }
          else api.op({ kind: 'reassign', title: s.job.title, scope: 'Moved to ' + fmt.day(s.to, 'md'), jobIds: [s.job.id], apply() { WD.placeJob(s.job, s.routeId, s.to, 999); s.job.events.push({ at: +WD.now(), actor: me(), text: 'Moved to ' + fmt.day(s.to, 'md') + ' to save about ' + s.miles + ' miles (AI suggestion)' }); } });
          done.add(s.job.id); p.refresh(); } }) }); }))
      : ui.empty({ icon: 'checkmark.circle', title: 'Nothing to move', text: 'Every purge job in the next ' + AI.route.lookDays + ' days is already on a good day.' })) }, { detent: 'large' });
};

/* =====================================================================================================================
   Purge check-in: a note about ten months after a one-time purge, asking whether it's time for another
   ===================================================================================================================== */
const CK = data.purgeCheckin = { on: false, months: 10, channel: 'email', skipTypes: { government: true }, skipRecurring: true, once: true };
if (data.templates && !data.templates.some(t => t.id === 'purgecheck')) { const name = 'Purge check-in', channel = 'email', subject = 'It’s been almost a year since your shred',
  body = 'Hi {first},\n\nIt has been about {months} months since {company} shredded your stored documents on {date}. Paper has a way of piling back up over a year, so this is a quick check-in.\n\nIf you have boxes ready to go, just reply to this email or call {phone}. Tell us roughly how many boxes there are and we will give you a price and a day.\n\nIf you are all set for now, there is nothing you need to do. Thank you again for trusting us with your documents.\n\n{sender}\n{company}';
  data.templates.push({ id: 'purgecheck', group: 'Service messages', name, channel, subject, body, builtin: true, def: { name, channel, subject, body } }); }
X.checkinLabel = () => CK.on ? 'On · ' + CK.months + ' months' : 'Off';
/** Purge customers whose last purge was about CK.months ago and who haven't been asked, leaving out the customer types that are skipped. */
X.checkinDue = () => { const t = today(), lo = D.add(t, -Math.round((CK.months + 1) * 30.44)), hi = D.add(t, -Math.round(CK.months * 30.44));
  return data.customers.filter(c => { if (CK.skipTypes[c.type] || CK.skipTypes[c.custType] || c.lifecycle === 'lost' || (CK.once && c.purgeAsked)) return false; if (CK.skipRecurring && c.type !== 'purge' && c.freq !== 'One time') return false;
    const last = (c.stats || {}).lastService; return !!last && (c.type === 'purge' || c.freq === 'One time') && last >= lo && last <= hi; }); };
X.checkinSpec = () => ({ title: 'Purge check-in', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); }, co = WD.co || {}, t = co.tpl ? co.tpl('purgecheck') : null, c = data.customers.find(x => x.type === 'purge') || data.customers[0], due = X.checkinDue();
  const ctx = co.ctxFor ? co.ctxFor(c, { months: CK.months, date: fmt.day(D.add(today(), -Math.round(CK.months * 30.44)), 'long') }) : {};
  const types = (WD.custTypes || []).concat([{ id: 'household', title: 'Households' }].filter(x => !(WD.custTypes || []).some(y => y.id === x.id)));
  return ui.list(note('A customer who had a one-time purge often needs another about a year later, and forgets who did the last one. This sends a short reminder before the year is up.'),
    ui.section({ fold: false, showFooter: true, footer: CK.on ? 'Sent once, ' + CK.months + ' months after a purge job is completed. A reply comes back to the CRM as a lead from an existing customer.' : 'Off: nobody is reminded.' },
      ui.toggleRow({ icon: 'repeat', iconColor: 'var(--yellow)', title: 'Check in after a purge', value: CK.on, onChange: v => { CK.on = v; re(); } }),
      CK.on && ui.row({ title: 'How long after', detail: CK.months + ' months', trailing: ui.stepper(CK.months, 3, 24, v => { CK.months = v; re(); }) }),
      CK.on && ui.pickerRow({ title: 'Sent by', value: CK.channel, options: [{ value: 'email', label: 'Email' }, { value: 'text', label: 'Text' }, { value: 'both', label: 'Email and text' }], onChange: v => { CK.channel = v; re(); } })),
    CK.on && ui.section({ header: 'Who doesn’t get it', fold: false, showFooter: true, footer: 'Government customers are left out to start with: their purges are budgeted and ordered on their own schedule. A single customer can also be left out on their record.' },
      types.map(x => ui.toggleRow({ title: x.title, subtitle: CK.skipTypes[x.id] ? 'Never sent' : null, value: !!CK.skipTypes[x.id], onChange: v => { CK.skipTypes[x.id] = v; re(); } })),
      ui.toggleRow({ title: 'Customers who now have regular service', subtitle: 'They already see you on a schedule', value: CK.skipRecurring, onChange: v => { CK.skipRecurring = v; re(); } })),
    CK.on && t && ui.section({ header: 'The message', fold: false }, h('div.r13-mail', h('b', 'Subject: ' + (co.fill ? co.fill(t.subject, ctx) : t.subject)), co.fill ? co.fill(t.body, ctx) : t.body),
      ui.row({ icon: 'pencil', iconPlain: true, title: 'Change the wording', tint: true, onTap: () => co.editTemplate && co.editTemplate(t, { onSave: () => page.refresh() }) })),
    CK.on && ui.section({ header: 'Going out this month', fold: false }, due.map(x => ui.row({ leading: ui.avatar(x.name, { size: 32 }), title: x.name, subtitle: 'Last purge ' + fmt.day(x.stats.lastService, 'md') + ' ' + D.parse(x.stats.lastService).getFullYear(), trailing: ui.button('Skip', { kind: 'gray', small: true, block: false, onTap: () => { x.purgeAsked = true; re(); } }) })), !due.length && ui.row({ title: 'Nobody is due this month' })));
} });

/* =====================================================================================================================
   Google Sheets: for companies that keep customers, products, services, inventory or invoices in spreadsheets
   ===================================================================================================================== */
const GS = data.sheets = { connected: false, account: '', file: 'Discount Shred — master workbook', lastSync: null, every: 15, tabs: [
  { id: 'customers', name: 'Customers', tab: 'Customers', dir: 'both', on: true, cols: ['Name', 'Contact', 'Phone', 'Email', 'Address', 'Route', 'Service every', 'Containers'], count: () => data.customers.length },
  { id: 'services', name: 'Services and fees', tab: 'Price list', dir: 'in', on: true, cols: ['Service', 'Unit', 'Price', 'Taxable'], count: () => data.priceBook.length },
  { id: 'products', name: 'Products', tab: 'Products', dir: 'in', on: true, cols: ['Product', 'Unit', 'Price', 'SKU'], count: () => (data.products || []).length },
  { id: 'inventory', name: 'Inventory', tab: 'Stock', dir: 'both', on: false, cols: ['Product', 'Location', 'On hand', 'Reorder at'], count: () => (data.products || []).length },
  { id: 'invoices', name: 'Invoices', tab: 'Invoices', dir: 'out', on: true, cols: ['Invoice #', 'Date', 'Customer', 'Total', 'Paid', 'Balance', 'Status'], count: () => (data.invoices || []).length }] };
const DIR = { in: 'Sheet → RouteClerk', out: 'RouteClerk → sheet', both: 'Both ways' };
X.sheetsSpec = () => ({ title: 'Google Sheets', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); }, integ = (WD.integrations || []).find(x => x.id === 'gsheets');
  const mapSheet = t => ui.sheet({ title: t.name, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], onClose: () => page.refresh(), render: p => ui.list(
    ui.section({ fold: false }, ui.inputRow({ label: 'Tab in the workbook', value: t.tab, onInput: v => { t.tab = v; } }), ui.pickerRow({ title: 'Direction', value: t.dir, options: Object.entries(DIR).map(([value, label]) => ({ value, label })), onChange: v => { t.dir = v; WD.changed(); p.refresh(); } })),
    ui.section({ header: 'Columns', fold: false, showFooter: true, footer: 'The first row of the tab holds the column names. Columns are matched by name; a column RouteClerk doesn’t know is left alone. ' + (t.dir === 'both' ? 'When both sides changed the same row, the newer change wins and the other is kept in the row’s history.' : t.dir === 'in' ? 'The sheet is the source: change it there.' : 'RouteClerk is the source: rows are added and updated, never deleted.') },
      t.cols.map(col => ui.row({ title: col, detail: 'Matched', icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)' })))) }, { detent: 'large' });
  return ui.list(h('div.st-member', h('div.row-icon.st-big', { style: { background: '#0F9D58' } }, icon('square.grid', 34)), h('div.title2', 'Google Sheets'), ui.badge(GS.connected ? 'Connected' : 'Not connected', GS.connected ? 'var(--green)' : 'var(--gray)')),
    note('For companies that keep customers, products, services, inventory or invoices in a spreadsheet. Keep working in the sheet, in RouteClerk, or both: each tab stays in step with the matching list here.'),
    ui.section({ fold: false, showFooter: true, footer: GS.connected ? 'Signed in as ' + GS.account + '. RouteClerk can open only the workbook you picked.' : 'You sign in with Google and pick one workbook. RouteClerk never sees your other files.' },
      GS.connected ? [ui.row({ icon: 'doc.text', iconColor: '#0F9D58', title: GS.file, subtitle: GS.lastSync ? 'Synced ' + fmt.rel(GS.lastSync).toLowerCase() : 'Not synced yet', trailing: ui.button('Sync now', { kind: 'tinted', small: true, block: false, onTap: async () => { if (await ui.run('Syncing with Google Sheets…', () => { GS.lastSync = +WD.now(); if (integ) integ.lastSync = GS.lastSync; }, { done: 'Up to date' })) page.refresh(); } }) }),
        ui.pickerRow({ title: 'Sync', value: GS.every, options: [{ value: 5, label: 'Every 5 minutes' }, { value: 15, label: 'Every 15 minutes' }, { value: 60, label: 'Every hour' }, { value: 0, label: 'Only when I tap Sync now' }], onChange: v => { GS.every = v; re(); } })]
      : ui.row({ icon: 'link', iconPlain: true, title: 'Sign in with Google and pick a workbook', tint: true, onTap: async () => { if (await ui.run('Opening Google…', () => { GS.connected = true; GS.account = (S.me || {}).email || 'office@discountshred.example'; GS.lastSync = +WD.now(); if (integ) { integ.connected = true; integ.lastSync = GS.lastSync; } }, { done: 'Workbook connected' })) page.refresh(); } })),
    ui.section({ header: 'What stays in step', fold: false, showFooter: true, footer: 'Tap one to choose its tab, the direction, and to see how its columns are matched. Don’t have a workbook yet? “Create a starter workbook” makes one with these tabs and your current information.' },
      GS.tabs.map(t => ui.row({ title: t.name, subtitle: (t.on ? 'Tab “' + t.tab + '” · ' + DIR[t.dir] + ' · ' + plural(t.count(), 'row') : 'Not synced'), trailing: ui.toggle(t.on, v => { t.on = v; re(); }), onTap: () => mapSheet(t) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Create a starter workbook', tint: true, onTap: async () => { if (await ui.run('Creating the workbook…', () => { GS.connected = true; GS.account = GS.account || (S.me || {}).email || ''; GS.lastSync = +WD.now(); if (integ) integ.connected = true; }, { done: 'Workbook created' })) page.refresh(); } })),
    GS.connected && ui.section(null, ui.row({ title: 'Disconnect Google Sheets', destructive: true, onTap: async () => { if (await ui.actionSheet({ title: 'Disconnect Google Sheets?', message: 'Nothing is deleted on either side. The sheet and RouteClerk simply stop updating each other.', buttons: [{ label: 'Disconnect', role: 'destructive', value: true }] })) { GS.connected = false; if (integ) integ.connected = false; re(); } } })));
} });
if (WD.integrations && !WD.integrations.some(x => x.id === 'gsheets')) { const at = WD.integrations.findIndex(x => x.id === 'sheet');
  WD.integrations.splice(at < 0 ? WD.integrations.length : at, 0, { id: 'gsheets', name: 'Google Sheets', icon: 'square.grid', color: '#0F9D58', connected: false, pitch: 'Customers, products, services, inventory and invoices', fields: [], open: () => X.sheetsSpec(),
    about: 'Keeps tabs of a Google Sheets workbook in step with customers, services and fees, products, inventory and invoices.', off: 'The workbook and RouteClerk stop updating each other.' }); }

/* ================= Control panel ================= */
const openSet = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
WD.panel.addAction('AI: a new lead texts in', () => X.simLead());
WD.panel.addAction('AI: phone agent takes a call', () => X.simCall());
WD.panel.addAction('AI: a route falls behind', () => X.simBehind());
WD.panel.addAction('AI: week-ahead suggestions', () => X.lookAhead());
WD.panel.addJump('Contracts', () => WD.nav.switchTab('contracts'));
WD.panel.addJump('AI route monitoring', () => openSet(X.routeAISpec()));
WD.panel.addJump('Google Sheets', () => openSet(X.sheetsSpec()));
})();
