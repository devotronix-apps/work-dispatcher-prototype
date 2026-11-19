/* CRM tab (people with the “CRM: leads and pipeline” permission): the lead pipeline with priorities, sorting, show/hide filters, jump links, sources and territories, follow-ups from templates,
   quotes and bids, referrals, leads by source, and customer feedback. Features switch on and off in Settings → CRM and leads.
   Registers WD.screens.crm. Builds on the lead helpers exported by customers.js and the settings and templates in company.js. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, CO = WD.co, K = WD.screens.customers.crm, ST = data.settings.crm, F = ST.features;
const today = D.today(), me = () => (S.me && S.me.name) || 'You', first = K.first, canEdit = () => WD.can('crm.edit');
const money = n => fmt.money(n), money2 = n => fmt.money(n, true), pbName = id => (data.priceBook.find(x => x.id === id) || { name: id }).name;
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

WD.css(`
.cr-head { padding: 14px 16px 2px; display: flex; align-items: center; gap: 8px; } .cr-head .headline { min-width: 0; overflow-wrap: anywhere; }
.cr-quiet { color: var(--orange); font-weight: 600; } .cr-hot { color: var(--green); font-weight: 600; }
.cr-src { display: inline-flex; align-items: center; gap: 4px; }
.cr-sit { color: var(--label); } .cr-t { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; } .cr-t .badge { flex: none; } .cr-tile { cursor: pointer; }
.cr-jump { display: flex; gap: 7px; overflow-x: auto; padding: 12px 16px 2px; scrollbar-width: none; -webkit-overflow-scrolling: touch; } .cr-jump::-webkit-scrollbar { display: none; }
.cr-jump button { flex: none; display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 15px; padding: 6px 11px; background: var(--cell); color: var(--label); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.cr-jump button i { font-style: normal; font-weight: 500; color: var(--label2); } .cr-jump button.hi { color: var(--red); } .cr-jump button.off { background: var(--fill3); color: var(--label3); font-weight: 500; } .cr-jump button.off i { color: var(--label3); }
.cr-sh { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; } .cr-sh .cu-link { flex: none; text-transform: none; font-size: 13px; font-weight: 600; letter-spacing: 0; }
.cr-need { display: flex; flex-wrap: wrap; align-items: center; gap: 0 8px; padding: 2px 16px 4px; font-size: 14px; letter-spacing: -.1px; color: var(--label); }
.cr-need-n { box-sizing: border-box; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: #D70015; color: #fff; font-size: 13px; font-weight: 700; display: inline-grid; place-items: center; letter-spacing: 0; }
.cr-need button { border: 0; background: none; font: inherit; font-weight: 600; color: var(--tint); min-height: 44px; padding: 0 4px; cursor: pointer; white-space: nowrap; text-decoration: underline; text-underline-offset: 3px; }
.cr-seg .segmented button { font-size: 12.5px; padding-left: 2px; padding-right: 2px; white-space: nowrap; }
.cr-try { display: flex; gap: 6px; flex-wrap: wrap; } .cr-try span { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: var(--label3); } .cr-try span.on { color: var(--green); font-weight: 600; }
.cr-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; color: var(--label2); padding: 10px 16px 0; } .cr-bar .cu-link { font-size: 13px; }
`);

/* ================= Sources, seed leads, quotes, referrals ================= */
const SRC = Object.fromEntries(CO.SOURCES.map(([k, title, ic]) => [k, { title, icon: ic }]));
/** How the lead arrived (phone, text, email, website form, Google Sheets, manual entry, referral). The channel says where they heard of us. */
const sourceOf = c => c.source || (c.referredBy || c.channel === 'Referral' ? 'referral' : c.channel === 'Yelp' ? 'yelp' : c.channel === 'Website' ? 'form' : data.interactions.some(i => i.customerId === c.id && i.type === 'sheet') ? 'sheet' : 'phone');
const srcLabel = c => (SRC[sourceOf(c)] || SRC.phone).title;
const P = (name, role, phone, email) => ({ name, role, phone, email });
[['c41', 'Pinecrest Family Law', 'email', 'Website', 'lead', 0, 540, 180, '18 Pinecrest Ave', P('Hannah Brandt', 'Office manager', '+17375550141', 'hannah@pinecrestlaw.example'), 'Emailed asking for a price on two consoles, every 4 weeks.', 1, 'u3'],
  ['c42', 'Oak Hollow HOA', 'text', 'Google Maps', 'contacted', -5, 300, 430, '900 Oak Hollow Dr', P('Dale Whitman', 'Board treasurer', '+15125550142', 'treasurer@oakhollowhoa.example'), 'Texted about a one-time clean-out of 25 boxes of old records.', 9, 'u2'],
  ['c43', 'Summit Tax Service', 'referral', 'Referral', 'quoted', 2, 760, 380, '45 Summit Plaza', P('Irene Kovac', 'Owner', '+15125550143', 'irene@summittax.example'), 'Referred by Harlow & Finch. Wants weekly service January through April.', 4, 'u3'],
  ['c44', 'Lakemont County Clerk', 'email', 'Other', 'quoted', 6, 480, 760, '1 Courthouse Sq', P('Procurement desk', 'Purchasing', '+15125550144', 'bids@lakemontcounty.example'), 'Invitation to bid: 14 consoles at three buildings, 3-year term. Bid due in two weeks.', 3, 'u3']]
  .forEach(([id, name, source, channel, lifecycle, next, x, y, address, contact, note, age, owner]) => { if (q.customer(id)) return;
    const c = K.mk({ id, name, channel, lifecycle, next, x, y, address, contacts: [contact], owner, cnotes: note, containers: id === 'c42' ? '25 boxes' : id === 'c44' ? '14 consoles' : '2 consoles', type: id === 'c42' ? 'purge' : 'regular', freq: id === 'c42' ? 'One time' : id === 'c43' ? 'Weekly' : 'Every 4 weeks' });
    Object.assign(c, { source, createdAt: +WD.now() - age * 864e5, changes: [] }); c.locations.forEach(l => { l.items = WD.parseItems(l.containers); });
    K.addI({ customerId: id, type: 'note', at: c.createdAt, text: note, by: source === 'referral' ? 'Colleen Abbott' : 'RouteClerk · ' + SRC[source].title.toLowerCase() });
    if (lifecycle !== 'lead') K.addI({ customerId: id, type: 'note', at: c.createdAt + 5 * 36e5, text: 'Follow-up sent (“New lead — first reply”, text).', by: (q.user(owner) || {}).name || 'Office' }); });
/* Priority (low, medium, high) is set by the office on each lead; new leads start at medium. */
const PRI = { high: ['High', 'var(--red)', 0], medium: ['Medium', 'var(--orange)', 1], low: ['Low', 'var(--gray)', 2] }, PRIS = ['high', 'medium', 'low'], priOf = c => PRI[c.priority] ? c.priority : 'medium';
const priBadge = c => ui.badge(PRI[priOf(c)][0], PRI[priOf(c)][1]);
Object.entries({ c43: 'high', c44: 'high', c25: 'high', c42: 'low' }).forEach(([id, p]) => { const c = q.customer(id); if (c) c.priority = p; });
[['c43', 'Comparing us with one other company. Irene decides by Friday.', 'Colleen Abbott', 1], ['c44', 'Bid is drafted. Waiting on the console count for the third building before it goes in.', 'Colleen Abbott', 2], ['c25', 'Wants a quote but has not sent the number of consoles. Two messages left.', 'Priya Raman', 3]]
  .forEach(([id, text, by, age]) => { const c = q.customer(id); if (c) Object.assign(c, { situation: text, situationBy: by, situationAt: +WD.now() - age * 864e5 }); });
{ const c = q.customer('c42'); if (c) c.tried = { call: true, text: true, email: true }; }
data.quotes = []; let qSeq = 300;
function addQuote(c, o = {}) {
  const loc = c.locations[0] || {}, src = (loc.items && loc.items.length ? loc.items : WD.parseItems(loc.containers)).filter(i => i.qty > 0);
  const qt = { id: 'qt' + (++qSeq), number: (o.kind === 'bid' ? 'B-' : 'Q-') + qSeq, kind: 'quote', customerId: c.id, items: src.length ? src.map(i => ({ name: pbName(i.id), qty: i.qty, rate: i.rate })) : [{ name: 'Console service', qty: 1, rate: 65 }], freq: c.freq, status: 'draft', at: +WD.now(), sentAt: null, validDays: 30, due: null, notes: '', by: me(), ...o };
  data.quotes.push(qt); return qt;
}
[['c23', { status: 'sent', sentAt: +WD.now() - 6 * 864e5, at: +WD.now() - 6 * 864e5, by: 'Priya Raman' }], ['c34', { status: 'sent', sentAt: +WD.now() - 2 * 864e5, at: +WD.now() - 3 * 864e5, by: 'Priya Raman' }], ['c43', { status: 'sent', sentAt: +WD.now() - 864e5, at: +WD.now() - 2 * 864e5, by: 'Colleen Abbott' }],
  ['c44', { kind: 'bid', status: 'draft', due: D.add(today, 13), at: +WD.now() - 2 * 864e5, by: 'Colleen Abbott', notes: 'Three buildings. Price per console per service, 3-year term with a fixed rate.' }], ['c25', { status: 'draft', at: +WD.now() - 864e5, by: 'Colleen Abbott' }]]
  .forEach(([cid, o]) => { const c = q.customer(cid); if (c) addQuote(c, o); });
data.referrals = [];
[['c43', 'c1', 2, false], ['c36', 'c21', 3, false], ['c2', 'c1', 210, true]].forEach(([leadId, byId, age, thanked]) => { const c = q.customer(leadId), by = q.customer(byId); if (!c || !by) return; c.referredBy = byId; data.referrals.push({ id: 'rf' + leadId, leadId, byId, at: +WD.now() - age * 864e5, thanked }); });

/* ================= Lead helpers ================= */
const inPipe = c => K.PIPE.includes(c.lifecycle) && CO.inTerritory(c);
const pipe = () => data.customers.filter(c => inPipe(c) && !c.archived), archived = () => data.customers.filter(c => inPipe(c) && c.archived).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
/** The first round of contact: one call, one text, one email, in that order. Worked out from the timeline, or ticked by hand on the lead. */
const TRY = [['call', 'Called', 'phone'], ['text', 'Texted', 'message'], ['email', 'Emailed', 'envelope']];
function tried(c) {
  const t = { call: false, text: false, email: false, ...(c.tried || {}) };
  data.interactions.forEach(i => { if (i.customerId !== c.id) return;
    if (i.type === 'call' && i.dir !== 'in') t.call = true; else if (i.type === 'text' && (i.messages || []).some(m => m.dir === 'out')) t.text = true; else if (i.type === 'email' && i.dir === 'out') t.email = true;
    else if (i.type === 'note') { const m = /^Follow-up sent \(“[^”]*”, (text|email)/.exec(i.text || ''); if (m) t[m[1]] = true; } });
  return t;
}
const triedAll = c => { const t = tried(c); return t.call && t.text && t.email; };
/** A lead nobody needs to chase any more: low priority, called, texted and emailed once, still open. */
const stale = c => priOf(c) === 'low' && triedAll(c) && !['scheduled', 'lost'].includes(c.lifecycle);
const tryLine = c => { const t = tried(c); return h('span.cr-try', TRY.map(([k, label, ic]) => h('span' + (t[k] ? '.on' : ''), icon(t[k] ? 'checkmark' : ic, 12), label))); };
/** Archive: out of the inbox and the tab badge, nothing deleted. Any lead can be archived and brought back. */
function archive(list, why) { list.forEach(c => { c.archived = true; c.archivedAt = +WD.now(); c.archivedBy = me(); c.nextAction = null; data.tasks.forEach(t => { if (t.customerId === c.id && t.lead && !t.done) { t.done = true; t.doneAt = +WD.now(); } }); K.addI({ customerId: c.id, type: 'note', at: +WD.now(), text: 'Lead archived' + (why ? ' (' + why + ')' : '') + '.', by: me() }); }); WD.changed(); }
function unarchive(c) { c.archived = false; K.addI({ customerId: c.id, type: 'note', at: +WD.now(), text: 'Lead moved back to the inbox.', by: me() }); WD.changed(); }
function archivedSpec() { return { title: 'Archived leads', render: page => { const list = archived();
  return ui.list(ui.section({ footer: 'Archived leads are out of the inbox and the tab badge. Nothing is deleted: the record, timeline and quotes stay, and a call, text or email from them brings the lead back on its own.' },
    list.map(c => ui.row({ title: h('span.cr-t', h('span', c.name), priBadge(c)), subtitle: [h('span.cr-sit', situation(c)), 'Archived ' + (c.archivedAt ? fmt.rel(c.archivedAt).toLowerCase() : '') + (c.archivedBy ? ' by ' + first(c.archivedBy) : ''), tryLine(c)].map(x => h('div', x)),
      trailing: canEdit() ? ui.button('Restore', { kind: 'gray', small: true, block: false, onTap: e => { e.stopPropagation(); unarchive(c); page.refresh(); ui.toast(c.name + ' is back in the inbox', 'tray'); } }) : null, onTap: () => openLead(c.id) })),
    !list.length && ui.row({ title: 'Nothing archived' }))); } }; }
const lastTouch = c => Math.max(c.lastFollowAt || 0, c.createdAt || 0, ...data.interactions.filter(i => i.customerId === c.id).map(i => i.at));
const quiet = c => { const t = lastTouch(c); return t ? Math.max(0, Math.floor((+WD.now() - t) / 864e5)) : 0; };
const isDue = c => c.lifecycle !== 'scheduled' && c.lifecycle !== 'lost' && ((c.nextAction && c.nextAction <= today) || (F.reminders && c.lifecycle !== 'lead' && quiet(c) >= ST.remindDays && !(c.nextAction && c.nextAction > today)));
/** Who on the team last reached out (call, text, email, follow-up, quote, Yelp reply) and when. → {at, by, how} or null */
function lastContact(c) {
  let best = null; const take = (at, by, how) => { if (by && !/^RouteClerk/.test(by) && (!best || at > best.at)) best = { at, by, how }; };
  data.interactions.forEach(i => { if (i.customerId !== c.id) return;
    if (i.type === 'call') take(i.at, i.by, i.dir === 'in' ? 'took their call' : 'called');
    else if (i.type === 'text') (i.messages || []).forEach(m => { if (m.dir === 'out') take(m.at, m.by || K.staff(c.owner), 'texted'); });
    else if (i.type === 'email' && i.dir === 'out') { const u = data.users.find(x => first(x.name).toLowerCase() === String(i.from || '').split('@')[0]); take(i.at, u ? u.name : K.staff(c.owner), 'emailed'); }
    else if (i.type === 'note') { const m = /^(Follow-up sent|Replied to the Yelp|(?:Quote|Bid) \S+ sent)/.exec(i.text || ''); if (m) take(i.at, i.by, m[1][0] === 'F' ? 'sent a follow-up' : m[1][0] === 'R' ? 'replied in Yelp' : 'sent a ' + m[1].split(' ')[0].toLowerCase()); } });
  return best;
}
const ago = at => { const d = Math.max(0, Math.floor((+WD.now() - at) / 864e5)); return d ? plural(d, 'day') + ' ago' : 'today'; };
const contactText = c => { const l = lastContact(c); return l ? first(l.by) + ' ' + l.how + ' ' + ago(l.at) : 'Nobody has contacted them yet'; };
const contactLine = c => { const l = lastContact(c), d = quiet(c); return h('span' + (!l ? '.cr-hot' : d >= ST.remindDays && c.lifecycle !== 'scheduled' && c.lifecycle !== 'lost' ? '.cr-quiet' : ''), l ? 'Last contact: ' + contactText(c) : c.lifecycle === 'lead' ? 'New ' + ago(c.createdAt || +WD.now()) + ' · nobody has replied' : contactText(c)); };
/** Where the lead stands: what the office wrote, or a line worked out from the stage, quotes and follow-ups. */
function autoSituation(c) {
  const qs = data.quotes.filter(x => x.customerId === c.id), sent = qs.find(x => x.status === 'sent'), draft = qs.find(x => x.status === 'draft'), n = c.followUps || 0;
  if (c.lifecycle === 'lost') return 'Lost: ' + (c.lostReason || 'no reason given');
  if (c.lifecycle === 'scheduled') return 'Won. First job is on the schedule or being booked.';
  if (sent) return (sent.kind === 'bid' ? 'Bid ' : 'Quote ') + sent.number + ' (' + money(qTotal(sent)) + ') sent ' + ago(sent.sentAt) + ', waiting for an answer';
  if (draft) return (draft.kind === 'bid' ? 'Bid ' : 'Quote ') + draft.number + ' is a draft' + (draft.due ? ', due ' + fmt.day(draft.due, 'md') : ', not sent yet');
  if (c.lifecycle === 'lead' && !lastContact(c)) return 'New request, waiting for a first reply';
  return n ? plural(n, 'follow-up') + ' sent, no answer yet' : 'Contacted, waiting to hear back';
}
const situation = c => (c.situation || '').trim() || autoSituation(c);
/** The follow-up that fits: by stage, how many were already sent, and how long it has been quiet. → [template id, why] */
function suggest(c) {
  const d = quiet(c), n = c.followUps || 0;
  if (c.lifecycle === 'quoted') return ['quote1', 'Quote sent' + (d ? ', quiet for ' + plural(d, 'day') : '')];
  if (c.lifecycle === 'lead' && !K.contactedYet(c) && !n) return ['lead1', 'New lead, nobody has replied yet'];
  if (n >= 2 || d >= 14) return ['lead4', n >= 2 ? plural(n, 'follow-up') + ' sent with no reply' : 'No reply for ' + plural(d, 'day')];
  if (d >= 7) return ['lead3', 'No reply for ' + plural(d, 'day')];
  return ['lead2', d ? 'No reply for ' + plural(d, 'day') : 'Contacted, waiting to hear back'];
}
const quietText = c => { const d = quiet(c); return c.lifecycle === 'lead' && !K.contactedYet(c) && !c.followUps ? h('span.cr-hot', 'New ' + (d ? plural(d, 'day') + ' ago' : 'today')) : d >= ST.remindDays ? h('span.cr-quiet', 'Quiet for ' + plural(d, 'day')) : h('span', d ? 'Last contact ' + plural(d, 'day') + ' ago' : 'Contact today'); };
function sendFollowUp(c, startId, onDone) {
  const list = data.templates.filter(t => t.group === 'Leads and follow-ups' || !t.builtin), p = c.contacts[0] || {}; let id = startId || suggest(c)[0];
  const ctx = () => CO.ctxFor(c, { customer: c.name, link: 'https://go.discountshred.example/q/' + c.id }); let text = CO.fill(CO.tpl(id).body, ctx());
  ui.sheet({ title: 'Send a follow-up', leading: [{ label: 'Cancel', onTap: pg => pg.dismiss() }],
    trailing: [{ label: 'Send', bold: true, onTap: async pg => { const t = CO.tpl(id), to = t.channel === 'email' ? p.email : p.phone && fmt.phone(p.phone); if (!to) return ui.alert({ title: t.channel === 'email' ? 'No email on file' : 'No phone on file', message: 'Add one to the contact, or choose a template sent the other way.' });
      if (!await ui.run('Sending…', () => { K.addI({ customerId: c.id, type: 'note', at: +WD.now(), text: 'Follow-up sent (“' + t.name + '”, ' + (t.channel === 'email' ? 'email' : 'text') + ' to ' + to + '): ' + text.replace(/\s+/g, ' ').slice(0, 110) + (text.length > 110 ? '…' : ''), by: me() });
        c.followUps = (c.followUps || 0) + 1; c.lastFollowAt = +WD.now(); if (c.lifecycle === 'lead') c.lifecycle = 'contacted'; if (F.reminders) c.nextAction = D.add(today, ST.remindDays); }, { done: 'Sent' })) return;
      pg.dismiss(); ui.toast('Sent to ' + to + (F.reminders ? ' · comes back in ' + plural(ST.remindDays, 'day') + ' if there’s no reply' : ''), t.channel === 'email' ? 'envelope' : 'message', 3200); onDone && onDone(); } }],
    render: pg => { const t = CO.tpl(id), [sid, why] = suggest(c);
      return ui.list(ui.section({ header: c.name + ' · ' + (p.name || 'Contact'), footer: id === sid ? 'Suggested: ' + why.toLowerCase() + '.' : 'Suggested for this lead: “' + CO.tpl(sid).name + '” (' + why.toLowerCase() + ').' },
          ui.pickerRow({ title: 'Template', value: id, options: list.map(x => ({ value: x.id, label: x.name + (x.id === sid ? ' · suggested' : '') })), onChange: v => { id = v; text = CO.fill(CO.tpl(id).body, ctx()); pg.refresh(); } }),
          ui.row({ title: 'Sent as', detail: (t.channel === 'email' ? 'Email to ' + (p.email || 'no email') : 'Text to ' + (p.phone ? fmt.phone(p.phone) : 'no phone')) })),
        ui.section({ header: t.channel === 'email' ? 'Subject: ' + CO.fill(t.subject, ctx()) : 'Message', footer: 'Change the wording for this lead here. To change it for everyone, edit the template in Settings → Templates.' },
          (r => { r.classList.add('co-body'); return r; })(ui.inputRow({ multiline: true, value: text, onInput: v => { text = v; } })))); } }, { detent: 'large' });
}

/* ================= Lead page ================= */
function leadSpec(id) {
  return { title: 'Lead', render: page => { const c = q.customer(id); if (!c) return ui.empty({ icon: 'person', title: 'Lead not found' });
    const p = c.contacts[0] || {}, edit = canEdit(), [sid, why] = suggest(c), quotes = data.quotes.filter(x => x.customerId === id), ref = data.referrals.find(r => r.leadId === id), by = ref && q.customer(ref.byId), acts = K.timeline(id).slice(0, 4), src = SRC[sourceOf(c)] || SRC.phone;
    const stages = ['lead', 'contacted', 'quoted', 'scheduled', 'customer'].concat(c.lifecycle === 'lost' ? ['lost'] : []).map(s => ({ value: s, label: K.LC[s][0] }));
    const lc = lastContact(c);
    return [h('div.cr-head', h('span.headline', c.name), h('span.spacer'), priOf(c) === 'high' && ui.badge('High priority', 'var(--red)'), ui.badge(K.LC[c.lifecycle][0], K.LC[c.lifecycle][1])),
      h('div.footnote', { style: 'padding:0 16px 2px' }, [p.name, p.phone && fmt.phone(p.phone), p.email].filter(Boolean).join(' · ')),
      c.archived && h('div', { style: 'padding:8px 4px 0' }, ui.note('Archived' + (c.archivedAt ? ' ' + fmt.rel(c.archivedAt).toLowerCase() : '') + (c.archivedBy ? ' by ' + c.archivedBy : '') + '. It is out of the inbox; nothing was deleted.')),
      ui.list(
        c.archived && edit && ui.section(null, ui.row({ icon: 'tray', iconPlain: true, title: 'Move back to the inbox', tint: true, onTap: () => { unarchive(c); page.refresh(); ui.toast('Back in the inbox', 'tray'); } })),
        ui.section({ header: 'Status', footer: c.notes || null },
          ui.pickerRow({ title: 'Stage', disabled: !edit, value: c.lifecycle, options: stages, onChange: v => { if (v === c.lifecycle) return; c.lifecycle = v; c.lostReason = null; K.addI({ customerId: id, type: 'note', at: +WD.now(), text: 'Moved to ' + K.LC[v][0] + '.', by: me() }); WD.changed(); page.refresh(); ui.toast('Moved to ' + K.LC[v][0], 'checkmark'); } }),
          ui.pickerRow({ title: 'Priority', disabled: !edit, value: priOf(c), options: PRIS.map(k => ({ value: k, label: PRI[k][0] })), onChange: v => { if (v === priOf(c)) return; c.priority = v; K.addI({ customerId: id, type: 'note', at: +WD.now(), text: 'Priority set to ' + PRI[v][0].toLowerCase() + '.', by: me() }); WD.changed(); page.refresh(); ui.toast(PRI[v][0] + ' priority', 'flag'); } }),
          edit ? ui.dateRow({ title: 'Next follow-up', value: c.nextAction || '', onChange: v => { c.nextAction = v; WD.changed(); page.refresh(); } }) : ui.row({ title: 'Next follow-up', detail: K.nextLabel(c) }),
          ui.pickerRow({ title: 'Assigned to', disabled: !edit, value: c.owner, options: K.owners().map(u => ({ value: u.id, label: u.name })), onChange: v => { c.owner = v; WD.changed(); page.refresh(); } }),
          ui.row({ title: 'Last contact', subtitle: lc ? first(lc.by) === lc.by ? null : lc.by + ' ' + lc.how : null, detail: lc ? h('span' + (quiet(c) >= ST.remindDays && !['scheduled', 'lost'].includes(c.lifecycle) ? '.cr-quiet' : ''), ago(lc.at)[0].toUpperCase() + ago(lc.at).slice(1)) : h('span.cr-hot', 'Nobody yet') })),
        ui.section({ header: 'Current situation', footer: c.situation ? 'Written by ' + (c.situationBy || 'the office') + (c.situationAt ? ' · ' + fmt.rel(c.situationAt).toLowerCase() : '') + '. Shown on the pipeline under the lead’s name.' : 'Shown on the pipeline under the lead’s name. Until someone writes one, the app fills it in from the stage, quotes and follow-ups.' },
          edit ? ui.inputRow({ multiline: true, placeholder: autoSituation(c), value: c.situation || '', onInput: v => { c.situation = v; c.situationBy = me(); c.situationAt = +WD.now(); } }) : ui.row({ title: situation(c) })),
        WD.r13 && c.kind !== 'household' && (r => r && ui.section({ header: 'Contract', fold: false }, r))(WD.r13.agreementRow(c)),
        ui.section({ header: 'First contact: call, text, email', footer: triedAll(c) ? (c.archived ? 'Called, texted and emailed once.' : 'Called, texted and emailed once. If there is no answer, there is nothing more to do: archive the lead to clear it from the inbox.') : 'One call, one text and one email, in that order. They are ticked as you do them from here, or tap one to tick it by hand.' },
          (t => TRY.map(([k, label, ic]) => ui.row({ icon: t[k] ? 'checkmark.circle.fill' : ic, iconPlain: true, iconColor: t[k] ? 'var(--green)' : 'var(--label3)', title: label, detail: t[k] ? 'Done' : 'Not yet', onTap: edit && !t[k] ? () => { c.tried = { ...(c.tried || {}), [k]: true }; if (c.lifecycle === 'lead') c.lifecycle = 'contacted'; K.addI({ customerId: id, type: 'note', at: +WD.now(), text: label + ' once, no answer.', by: me() }); WD.changed(); page.refresh(); } : null })))(tried(c)),
          edit && !c.archived && triedAll(c) && ui.row({ icon: 'tray', iconPlain: true, title: 'Archive this lead', tint: true, onTap: () => { archive([c], 'called, texted and emailed with no answer'); page.pop(); ui.toast(c.name + ' archived', 'tray'); } })),
        ui.section('Where it came from',
          ui.row({ icon: src.icon, iconColor: 'var(--teal)', title: src.title, subtitle: by ? 'Referred by ' + by.name : 'Heard of us: ' + c.channel, detail: c.createdAt ? fmt.rel(c.createdAt) : null }),
          sourceOf(c) === 'yelp' && ui.row({ icon: 'arrow.up.right', iconPlain: true, title: c.yelpReplied ? 'Open the conversation in Yelp' : 'Reply in Yelp', subtitle: c.yelpReplied ? 'Replied ' + fmt.rel(c.yelpReplied).toLowerCase() : 'Yelp keeps messages on its side, so the reply is written there. Fast replies help your Yelp response time.', tint: true, badge: c.yelpReplied ? null : ui.badge('Waiting', 'var(--red)'),
            onTap: async () => { ui.toast('Opens Yelp for Business', 'globe', 1800); if (c.yelpReplied || !edit) return; await WD.delay(1900, 2100); if (await ui.actionSheet({ title: 'Did you reply in Yelp?', message: 'Marks this lead as contacted and logs it on the timeline.', buttons: [{ label: 'Yes, I replied', value: true }], cancel: 'Not yet' })) { c.yelpReplied = +WD.now(); if (c.lifecycle === 'lead') c.lifecycle = 'contacted'; K.addI({ customerId: id, type: 'note', at: +WD.now(), text: 'Replied to the Yelp request in Yelp.', by: me() }); WD.changed(); page.refresh(); } } }),
          F.territories && ui.row({ icon: 'mappin', iconColor: 'var(--red)', title: 'Territory', subtitle: (c.locations[0] || {}).address, detail: CO.regionOf(c) + ' · ' + CO.zipOf(c) + (CO.areaOf(c) ? ' · (' + CO.areaOf(c) + ')' : '') })),
        edit && c.lifecycle !== 'lost' && ui.section({ header: 'Follow up', footer: F.followups ? 'The suggestion changes with the stage, how many follow-ups went out and how long it has been quiet.' : null },
          F.followups && ui.row({ icon: (CO.tpl(sid).channel === 'email' ? 'envelope' : 'message'), iconColor: 'var(--green)', title: 'Send “' + CO.tpl(sid).name + '”', subtitle: why, chevron: true, onTap: () => sendFollowUp(c, sid, () => page.refresh()) }),
          F.followups && ui.row({ icon: 'doc.text', iconPlain: true, title: 'Choose another template…', tint: true, onTap: () => sendFollowUp(c, null, () => page.refresh()) }),
          ui.row({ icon: 'phone.fill', iconPlain: true, title: 'Call ' + (first(p.name) || 'them'), tint: true, disabled: !p.phone, onTap: () => K.startCall(c, p) }),
          ui.row({ icon: 'phone', iconPlain: true, title: 'Log a call', tint: true, onTap: () => K.logCall(c) })),
        F.quotes && ui.section({ header: 'Quotes and bids' },
          quotes.map(qt => quoteRow(qt, false)),
          edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New quote', tint: true, onTap: () => page.push(quoteSpec(addQuote(c))) }),
          edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New bid', subtitle: 'For an invitation to bid, with a due date', tint: true, onTap: () => page.push(quoteSpec(addQuote(c, { kind: 'bid', due: D.add(today, 14) }))) })),
        F.referrals && ref && ui.section({ header: 'Referral', footer: 'Thank-you: ' + ST.referralReward + '.' }, referralRow(ref, page)),
        ui.section('Recent activity', acts.map(i => { const d = K.describe(i); return ui.row({ title: d.title, subtitle: [d.snippet, (d.who ? d.who + ' · ' : '') + fmt.rel(i.at)].filter(Boolean).map(x => h('div', x)) }); }), !acts.length && ui.row({ title: 'Nothing yet' })),
        ui.section(null, WD.can('crm.view') && ui.row({ title: 'Open the full record', subtitle: 'Contacts, calls, texts, email, documents', chevron: true, onTap: () => WD.screens.customers.openDetail(id) }),
          edit && !c.archived && ui.row({ title: 'Archive lead', subtitle: 'Clears it from the inbox. Nothing is deleted.', tint: true, onTap: async () => { if (!await ui.actionSheet({ title: 'Archive ' + c.name + '?', message: 'It leaves the inbox and the tab badge. You can bring it back from Archived leads at any time.', buttons: [{ label: 'Archive', value: true }] })) return; archive([c]); page.pop(); ui.toast(c.name + ' archived', 'tray'); } }),
          edit && c.lifecycle !== 'lost' && ui.row({ title: 'Mark lost…', destructive: true, onTap: () => K.markLost(c) })))];
  } };
}
const openLead = id => WD.nav.push(leadSpec(id));

/* ================= Quotes and bids ================= */
const QS = { draft: ['Draft', 'var(--gray)'], sent: ['Sent · waiting', 'var(--blue)'], accepted: ['Accepted', 'var(--green)'], declined: ['Declined', 'var(--red)'] };
const qTotal = qt => qt.items.reduce((s, i) => s + (+i.qty || 0) * (+i.rate || 0), 0);
const quoteRow = (qt, withName = true) => { const c = q.customer(qt.customerId), age = qt.sentAt ? Math.floor((+WD.now() - qt.sentAt) / 864e5) : 0;
  return ui.row({ icon: qt.kind === 'bid' ? 'briefcase' : 'doc.text', iconColor: qt.kind === 'bid' ? 'var(--brown)' : 'var(--indigo)', title: withName ? (c ? c.name : 'Lead removed') : qt.number, subtitle: (withName ? qt.number + ' · ' : '') + (qt.kind === 'bid' ? 'Bid' + (qt.due ? ' due ' + fmt.day(qt.due, 'md') : '') : qt.freq) + (qt.status === 'sent' ? ' · sent ' + (age ? plural(age, 'day') + ' ago' : 'today') : ''),
    badge: ui.badge(QS[qt.status][0], QS[qt.status][1]), detail: money(qTotal(qt)), chevron: true, onTap: () => WD.nav.push(quoteSpec(qt)) }); };
function quoteDoc(qt) { const c = q.customer(qt.customerId) || { name: 'Customer', locations: [{}] }, o = S.org || data.orgs[0], bid = qt.kind === 'bid';
  return h('div.x-doc', h('h4', (bid ? 'Bid ' : 'Quote ') + qt.number), h('small', o.name + (o.phone ? ' · ' + o.phone : '')), h('p', 'Prepared for ', h('b', c.name), (c.locations[0] || {}).address ? ', ' + c.locations[0].address : '', '.'),
    h('table', qt.items.map(i => h('tr', h('td', i.qty + ' × ' + i.name), h('td', money2(i.rate) + ' each'))), h('tr', h('td', 'Service'), h('td', qt.freq)), h('tr', h('td', qt.freq === 'One time' ? 'Total' : 'Per visit'), h('td', h('b', money2(qTotal(qt))))),
      h('tr', h('td', bid ? 'Bid due' : 'Good for'), h('td', bid && qt.due ? fmt.day(qt.due, 'md') : qt.validDays + ' days'))),
    qt.notes && h('p', qt.notes), h('p', ((data.biz || {}).destroy === 'offsite' ? 'All material is collected in locked containers, shredded at our secure facility and recycled, with a certificate of destruction once destruction is confirmed.' : 'All material is shredded on site and recycled, with a certificate of destruction on every invoice.'))); }
function quoteSpec(qt) {
  const FREQS = ['Weekly', 'Every 2 weeks', 'Every 4 weeks', 'Monthly', 'Quarterly', 'One time', 'On call'];
  return { title: () => qt.number, render: page => { const c = q.customer(qt.customerId), edit = canEdit() && qt.status === 'draft', p = (c && c.contacts[0]) || {}, bid = qt.kind === 'bid';
    const setStatus = (st, fn, done) => ui.run('Saving…', () => { qt.status = st; fn && fn(); K.addI({ customerId: c.id, type: 'note', at: +WD.now(), text: (bid ? 'Bid ' : 'Quote ') + qt.number + ' ' + done + ' · ' + money(qTotal(qt)) + '.', by: me() }); }, { done: done[0].toUpperCase() + done.slice(1) });
    return [h('div.cr-head', h('span.headline', c ? c.name : 'Lead'), h('span.spacer'), ui.badge(QS[qt.status][0], QS[qt.status][1])), quoteDoc(qt),
      ui.list(
        edit && ui.section({ header: 'Lines', footer: 'Starts from the containers on the lead. Rates come from the price book and can be changed for this ' + (bid ? 'bid' : 'quote') + '.' },
          qt.items.map((it, i) => h('div.row.jb-item', h('div.row-main', h('input.field', { type: 'text', value: it.name, 'aria-label': 'Description', style: 'padding:0;width:100%', oninput: e => { it.name = e.target.value; }, onchange: () => page.refresh() }), h('div.row-sub', 'Rate each · quantity')),
            h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': 'Rate', value: '$' + it.rate, oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); it.rate = isNaN(v) ? 0 : v; }, onchange: () => page.refresh() }),
            ui.numField(it.qty, 0, 5000, v => { if (v === 0) qt.items.splice(i, 1); else it.qty = v; page.refresh(); }), ui.stepper(it.qty, 0, 5000, v => { if (v === 0) qt.items.splice(i, 1); else it.qty = v; page.refresh(); }))),
          ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a line', tint: true, onTap: (e, el) => ui.menu(el, data.priceBook.map(x => ({ label: x.name, onTap: () => { qt.items.push({ name: x.name, qty: 1, rate: x.rate }); page.refresh(); } }))) })),
        edit && ui.section('Terms', ui.pickerRow({ title: 'Service', value: qt.freq, options: FREQS.includes(qt.freq) ? FREQS : [qt.freq].concat(FREQS), onChange: v => { qt.freq = v; page.refresh(); } }),
          bid ? ui.dateRow({ title: 'Bid due', value: qt.due || today, onChange: v => { qt.due = v; page.refresh(); } }) : ui.row({ title: 'Good for', detail: qt.validDays + ' days', trailing: ui.stepper(qt.validDays / 15, 1, 6, v => { qt.validDays = v * 15; page.refresh(); }) }),
          ui.inputRow({ label: 'Note', placeholder: 'Shown on the ' + (bid ? 'bid' : 'quote'), value: qt.notes, onInput: v => { qt.notes = v; } })),
        canEdit() && ui.section({ footer: qt.status === 'sent' ? 'Sent to ' + (p.email || 'the contact') + ' ' + fmt.rel(qt.sentAt).toLowerCase() + '. The lead comes back as due if there is no answer.' : qt.status === 'accepted' ? 'The lead moved to Scheduled.' : null },
          qt.status === 'draft' && ui.row({ icon: 'envelope', iconPlain: true, title: 'Send by email', subtitle: p.email || 'No email on file', tint: true, disabled: !p.email, onTap: async () => { if (await setStatus('sent', () => { qt.sentAt = +WD.now(); if (c.lifecycle === 'lead' || c.lifecycle === 'contacted') c.lifecycle = 'quoted'; if (F.reminders) c.nextAction = D.add(today, ST.remindDays); }, 'sent')) page.refresh(); } }),
          qt.status === 'sent' && F.followups && ui.row({ icon: 'envelope', iconPlain: true, title: 'Send “' + CO.tpl('quote1').name + '”', tint: true, onTap: () => sendFollowUp(c, 'quote1', () => page.refresh()) }),
          (qt.status === 'sent' || qt.status === 'draft') && ui.row({ icon: 'checkmark.circle', iconPlain: true, title: bid ? 'Bid won' : 'Customer accepted', tint: true, onTap: async () => { if (!await setStatus('accepted', () => { c.lifecycle = 'scheduled'; c.nextAction = null; }, 'accepted')) return; page.refresh();
            if (WD.can('contracts.manage') && await ui.actionSheet({ title: 'Create the service agreement?', message: 'It starts from this customer’s containers and rates, and can be edited before it is sent.', buttons: [{ label: 'Create service agreement', value: true }], cancel: 'Not now' })) { const loc = c.locations[0]; loc.items = WD.parseItems(loc.containers).map((it, i) => ({ ...it, rate: (qt.items[i] || it).rate })); WD.nav.push(WD.x.agreementSpec(WD.x.createAgreement(c))); } } }),
          qt.status === 'sent' && ui.row({ title: bid ? 'Bid lost' : 'Customer declined', destructive: true, onTap: async () => { if (await setStatus('declined', null, 'declined')) page.refresh(); } }),
          qt.status === 'draft' && ui.row({ title: 'Delete draft', destructive: true, onTap: () => { data.quotes = data.quotes.filter(x => x !== qt); WD.changed(); page.pop(); } })),
        ui.section(null, c && ui.row({ title: 'Open the lead', chevron: true, onTap: () => openLead(c.id) })))];
  } };
}
function quotesView() {
  const mine = data.quotes.filter(x => { const c = q.customer(x.customerId); return c && CO.inTerritory(c); }).sort((a, b) => (b.sentAt || b.at) - (a.sentAt || a.at)), by = st => mine.filter(x => x.status === st), open = by('sent').reduce((s, x) => s + qTotal(x), 0);
  return ui.list(
    ui.section(null, h('div.co-tiles', h('div', h('b', String(by('draft').length)), h('span', 'Drafts')), h('div', h('b', String(by('sent').length)), h('span', 'Waiting')), h('div', h('b', money(open)), h('span', 'Open value')), h('div', h('b', String(by('accepted').length)), h('span', 'Accepted')))),
    ui.section({ header: 'Sent — waiting for an answer', footer: 'Start a quote or bid from a lead.' }, by('sent').map(x => quoteRow(x)), !by('sent').length && ui.row({ title: 'Nothing waiting' })),
    ui.section('Drafts', by('draft').map(x => quoteRow(x))), ui.section('Accepted', by('accepted').map(x => quoteRow(x))), ui.section('Declined', by('declined').map(x => quoteRow(x))));
}

/* ================= Referrals ================= */
function referralRow(r, page) { const c = q.customer(r.leadId), by = q.customer(r.byId), won = c && ['scheduled', 'serviced', 'customer'].includes(c.lifecycle);
  return ui.row({ leading: ui.avatar(c ? c.name : '?', { size: 34 }), title: c ? c.name : 'Lead removed', subtitle: ['Referred by ' + (by ? by.name : 'someone') + ' · ' + fmt.rel(r.at).toLowerCase(), r.thanked ? 'Thank-you sent' : won ? 'Signed up — thank-you not sent yet' : 'Thank-you goes out when they sign up'].map(x => h('div', x)),
    badge: c ? ui.badge(K.LC[c.lifecycle][0], K.LC[c.lifecycle][1]) : null, chevron: true, onTap: async () => {
      const v = await ui.actionSheet({ title: c.name, message: 'Referred by ' + (by ? by.name : 'someone'), buttons: [{ label: 'Open the lead', value: 'lead' }, by && { label: 'Open ' + by.name, value: 'by' }, by && !r.thanked && canEdit() && { label: 'Send the thank-you to ' + by.name, value: 'thanks' }].filter(Boolean) });
      if (v === 'lead') openLead(c.id); else if (v === 'by') WD.screens.customers.openDetail(by.id);
      else if (v === 'thanks' && await ui.run('Sending thank-you…', () => { r.thanked = true; K.addI({ customerId: by.id, type: 'note', at: +WD.now(), text: 'Referral thank-you sent for ' + c.name + ' (' + ST.referralReward + '): ' + CO.fill(CO.tpl('refthanks').body, CO.ctxFor(by, { customer: c.name })), by: me() }); }, { done: 'Thank-you sent' })) page && page.refresh(); } }); }
function referralsView(page) {
  const list = data.referrals.filter(r => { const c = q.customer(r.leadId); return c && CO.inTerritory(c); }).sort((a, b) => b.at - a.at), won = list.filter(r => ['scheduled', 'serviced', 'customer'].includes((q.customer(r.leadId) || {}).lifecycle));
  return ui.list(
    ui.section(null, h('div.co-tiles', { style: 'grid-template-columns:repeat(3,1fr)' }, h('div', h('b', String(list.length)), h('span', 'Referrals')), h('div', h('b', String(won.length)), h('span', 'Signed up')), h('div', h('b', String(won.filter(r => !r.thanked).length)), h('span', 'To thank')))),
    ui.section({ header: 'Referrals', footer: 'Thank-you for a referral that signs up: ' + ST.referralReward + '. Change it in Settings → CRM and leads.' }, list.map(r => referralRow(r, page)), !list.length && ui.row({ title: 'No referrals yet' })),
    canEdit() && ui.section(null, ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a referral', tint: true, onTap: () => newLead({ source: 'referral' }) })));
}

/* ================= New lead (manual entry) ================= */
function newLead(pre = {}) {
  const on = CO.SOURCES.filter(([k]) => ST.sources[k]), f = { name: '', contact: '', phone: '', email: '', address: '', zip: '', source: pre.source || (ST.sources.manual ? 'manual' : on[0] ? on[0][0] : 'manual'), channel: 'Other', referredBy: null, notes: '', owner: S.me.id, priority: 'medium' };
  const customers = data.customers.filter(c => ['customer', 'serviced'].includes(c.lifecycle)).sort((a, b) => a.name.localeCompare(b.name));
  ui.sheet({ title: 'New lead', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Add', bold: true, onTap: async p => { if (!f.name.trim()) return ui.toast('Add a name', 'note'); if (!fmt.phoneValid(f.phone) && !f.email.trim()) return ui.toast('Add a phone number or an email', 'phone');
      let c = null; const id = 'c' + Date.now().toString(36);
      if (!await ui.run('Adding lead…', () => { c = K.mk({ id, name: f.name.trim(), channel: f.source === 'referral' ? 'Referral' : f.channel, contacts: [{ name: f.contact.trim() || f.name.trim(), role: '', phone: fmt.phoneValid(f.phone) ? '+1' + fmt.phoneDigits(f.phone) : '', email: f.email.trim() }], address: f.address.trim() || 'Address to come', owner: f.owner, next: 0, cnotes: f.notes.trim() });
        Object.assign(c, { source: f.source, priority: f.priority, zip: f.zip.trim() || null, createdAt: +WD.now(), changes: [], referredBy: f.source === 'referral' ? f.referredBy : null }); c.locations.forEach(l => { l.items = []; });
        if (c.referredBy) data.referrals.push({ id: 'rf' + id, leadId: id, byId: c.referredBy, at: +WD.now(), thanked: false });
        K.addI({ customerId: id, type: 'note', at: +WD.now(), text: 'Lead added by hand' + (f.notes.trim() ? ': ' + f.notes.trim() : '.'), by: me() }); K.addTask(id, 'Call back new lead', 0, { lead: true }); }, { done: 'Lead added' })) return;
      p.dismiss(); setTimeout(() => openLead(id), 400); } }],
    render: p => ui.list(
      ui.section('Who', ui.inputRow({ label: 'Name', placeholder: 'Company or person', caps: 'words', value: f.name, required: true, autofocus: true, onInput: v => { f.name = v; } }), ui.inputRow({ label: 'Contact', placeholder: 'Who to ask for', caps: 'words', value: f.contact, onInput: v => { f.contact = v; } }),
        ui.phoneRow({ value: f.phone, onInput: v => { f.phone = v; } }), ui.inputRow({ label: 'Email', type: 'email', caps: 'off', placeholder: 'Optional', value: f.email, onInput: v => { f.email = v; } })),
      ui.section({ header: 'Where', footer: F.territories ? 'The ZIP code and the phone’s area code decide who sees this lead.' : null }, ui.inputRow({ label: 'Address', placeholder: 'Optional', value: f.address, onInput: v => { f.address = v; } }), ui.inputRow({ label: 'ZIP', inputmode: 'numeric', placeholder: 'Optional', value: f.zip, onInput: v => { f.zip = v.replace(/\D/g, '').slice(0, 5); } })),
      ui.section({ header: 'How it came in', footer: 'Sources are switched on and off in Settings → CRM and leads.' },
        ui.pickerRow({ title: 'Source', value: f.source, options: on.map(([k, title, ic]) => ({ value: k, label: title, icon: ic })), onChange: v => { f.source = v; p.refresh(); } }),
        f.source === 'referral' ? ui.pickerRow({ title: 'Referred by', placeholder: 'Choose a customer', value: f.referredBy, options: customers.map(c => ({ value: c.id, label: c.name })), onChange: v => { f.referredBy = v; p.refresh(); } })
          : ui.pickerRow({ title: 'Heard of us from', value: f.channel, options: K.CHANNELS.filter(x => x !== 'Referral'), onChange: v => { f.channel = v; p.refresh(); } }),
        ui.pickerRow({ title: 'Assigned to', value: f.owner, options: K.owners().map(u => ({ value: u.id, label: u.name })), onChange: v => { f.owner = v; p.refresh(); } }),
        ui.pickerRow({ title: 'Priority', value: f.priority, options: PRIS.map(k => ({ value: k, label: PRI[k][0] })), onChange: v => { f.priority = v; p.refresh(); } })),
      ui.section('Notes', ui.inputRow({ multiline: true, placeholder: 'What do they need?', value: f.notes, onInput: v => { f.notes = v; } }))) }, { detent: 'large' });
}

/* ================= Pipeline ================= */
const STAGES = [['fresh', 'New', 'New — nobody has replied'], ['due', 'Follow-up due', 'Follow-up due'], ['contacted', 'Contacted', 'Contacted'], ['quoted', 'Quoted', 'Quoted — waiting'], ['scheduled', 'Won', 'Won — scheduled'], ['lost', 'Lost', 'Lost']];
const SORTS = [['next', 'Follow-up date'], ['priority', 'Priority'], ['quiet', 'Longest without contact'], ['newest', 'Newest lead']];
const R = { seg: 'pipeline', source: 'all', sort: 'next', pri: { high: true, medium: true, low: true }, stages: { fresh: true, due: true, contacted: true, quoted: true, scheduled: true, lost: false }, important: true };
const stageOf = c => c.lifecycle === 'lost' ? 'lost' : c.lifecycle === 'lead' && !K.contactedYet(c) && !c.followUps ? 'fresh' : isDue(c) ? 'due' : c.lifecycle === 'quoted' ? 'quoted' : c.lifecycle === 'scheduled' ? 'scheduled' : 'contacted';
const byNext = (a, b) => (a.nextAction || '9').localeCompare(b.nextAction || '9') || a.name.localeCompare(b.name);
const sorters = { next: byNext, priority: (a, b) => PRI[priOf(a)][2] - PRI[priOf(b)][2] || byNext(a, b), quiet: (a, b) => ((lastContact(a) || {}).at || 0) - ((lastContact(b) || {}).at || 0) || byNext(a, b), newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) };
/** Scroll the pipeline to a section (the jump links and the tiles). */
function jumpTo(page, key) { const el = page.body.querySelector('[data-jump="' + key + '"]'); if (!el) return; const top = page.body.scrollTop + (el.getBoundingClientRect().top - page.body.getBoundingClientRect().top) / WD.scale() - 8; page.body.scrollTo ? page.body.scrollTo({ top, behavior: 'smooth' }) : (page.body.scrollTop = top); }
function showAndJump(page, key) { if (key !== 'important' && !R.stages[key]) { R.stages[key] = true; page.refresh(); } else if (key === 'important' && (!R.important || !R.pri.high)) { R.important = R.pri.high = true; page.refresh(); } setTimeout(() => jumpTo(page, key), 30); }
function filterSheet(page, counts) {
  const flip = (o, k) => v => { o[k] = v; page.refresh(); };
  ui.sheet({ title: 'Show and hide', leading: [{ label: 'Show all', onTap: pg => { PRIS.forEach(k => { R.pri[k] = true; }); STAGES.forEach(([k]) => { R.stages[k] = true; }); R.important = true; R.source = 'all'; page.refresh(); pg.refresh(); } }], trailing: [{ label: 'Done', bold: true, onTap: pg => pg.dismiss() }],
    render: () => ui.list(
      ui.section({ header: 'Priority', footer: 'Set the priority on the lead. New leads start at medium.' }, PRIS.map(k => ui.toggleRow({ icon: 'flag', iconColor: PRI[k][1], title: PRI[k][0], detail: String(counts.pri[k]), value: R.pri[k], onChange: flip(R.pri, k) }))),
      ui.section({ header: 'Stages of the pipeline', footer: 'A hidden stage stays in the jump links, grayed out. Tap it there to bring it back.' }, STAGES.map(([k, label]) => ui.toggleRow({ title: label, detail: String(counts.stage[k]), value: R.stages[k], onChange: flip(R.stages, k) }))),
      ui.section({ footer: 'Lists open high-priority leads first, above the stages.' }, ui.toggleRow({ icon: 'flag', iconColor: 'var(--red)', title: 'High priority section at the top', value: R.important, onChange: flip(R, 'important') }))) }, { detent: 'large' });
}
function pipelineView(page) {
  const all = pipe(), inSrc = R.source === 'all' ? all : all.filter(c => sourceOf(c) === R.source), list = inSrc.filter(c => R.pri[priOf(c)]), g = Object.fromEntries(STAGES.map(([k]) => [k, []]));
  list.forEach(c => g[stageOf(c)].push(c));
  const counts = { pri: Object.fromEntries(PRIS.map(k => [k, inSrc.filter(c => priOf(c) === k).length])), stage: Object.fromEntries(STAGES.map(([k]) => [k, inSrc.filter(c => stageOf(c) === k).length])) };
  const important = R.pri.high ? list.filter(c => priOf(c) === 'high' && !['lost', 'scheduled'].includes(c.lifecycle)) : [];
  /* Every section header carries its own Hide / Show on the right; a hidden section keeps its header and count. */
  const head = (title, on, flip, color) => h('span.cr-sh', h('span', { style: color ? 'color:' + color : null }, title), h('button.cu-link', { 'aria-label': (on ? 'Hide ' : 'Show ') + title, onclick: e => { e.stopPropagation(); flip(!on); page.refresh(); } }, on ? 'Hide' : 'Show'));
  const staleList = canEdit() ? list.filter(stale) : [], arch = archived();
  const quoted = data.quotes.filter(x => x.status === 'sent' && list.some(c => c.id === x.customerId)).reduce((s, x) => s + qTotal(x), 0), t = CO.territory(S.me), sort = sorters[R.sort] || byNext;
  const row = (c, top) => ui.row({ title: h('span.cr-t', h('span', c.name), top ? ui.badge(K.LC[c.lifecycle][0], K.LC[c.lifecycle][1]) : priBadge(c)),
    subtitle: [h('span.cr-sit', situation(c)), contactLine(c), priOf(c) === 'low' && tryLine(c), h('span.cr-src', icon((SRC[sourceOf(c)] || SRC.phone).icon, 13), srcLabel(c) + ' · ' + (c.referredBy && q.customer(c.referredBy) ? 'by ' + q.customer(c.referredBy).name : c.channel) + ' · assigned to ' + first(K.staff(c.owner)))].filter(Boolean).map(x => h('div', x)),
    detail: c.lifecycle === 'lost' ? null : K.nextLabel(c), chevron: true, onTap: () => openLead(c.id) });
  const mark = (el, key) => { el.dataset.jump = key; return el; };
  const FOOT = { fresh: 'From calls, texts, email, website forms, Yelp, the leads sheet and manual entry.', due: F.reminders ? 'Past their follow-up date, or quiet for ' + plural(ST.remindDays, 'day') + ' or more.' : null };
  const sec = ([k, , title]) => g[k].length ? mark(ui.section({ header: head(title + ' · ' + g[k].length, R.stages[k], v => { R.stages[k] = v; }), footer: R.stages[k] ? FOOT[k] : null, keepEmpty: true }, R.stages[k] ? g[k].sort(sort).map(c => row(c)) : []), k) : null;
  const srcRows = F.sources ? CO.SOURCES.map(([k, title, ic]) => { const xs = all.filter(c => sourceOf(c) === k), won = xs.filter(c => c.lifecycle === 'scheduled').length; return xs.length ? ui.row({ icon: ic, iconColor: 'var(--teal)', title, subtitle: ST.sources[k] ? null : 'Switched off — no new leads from here', detail: plural(xs.length, 'lead') + (won ? ' · ' + won + ' won' : ''), chevron: true, onTap: () => { R.source = k; page.refresh(); page.body.scrollTop = 0; } }) : null; }).filter(Boolean) : [];
  const tile = (key, n, label, color) => h('div.cr-tile', { onclick: () => showAndJump(page, key) }, h('b', { style: color ? 'color:' + color : null }, n), h('span', label));
  const hidden = PRIS.filter(k => !R.pri[k] && counts.pri[k]).map(k => PRI[k][0].toLowerCase() + ' priority').concat(STAGES.filter(([k]) => !R.stages[k] && counts.stage[k]).map(([, label]) => label));
  const shown = STAGES.reduce((n, [k]) => n + (R.stages[k] ? g[k].length : 0), 0);
  return ui.list(
    !CO.seesAll() && h('div', { style: 'padding:4px 4px 0' }, ui.note('You see leads assigned to you' + (t.values.length ? ', plus every lead in ' + CO.territoryText(S.me) : '') + '. An admin sets this in Settings → CRM and leads.')),
    ui.section(null, h('div.co-tiles', tile('fresh', String(g.fresh.length), 'New', g.fresh.length ? 'var(--blue)' : null), tile('due', String(g.due.length), 'Due', g.due.length ? 'var(--orange)' : null), tile('quoted', money(quoted), 'Quoted'), tile('scheduled', String(g.scheduled.length), 'Won'))),
    h('div.cr-jump', { role: 'navigation', 'aria-label': 'Jump to a stage' },
      important.length > 0 && h('button.hi', { onclick: () => showAndJump(page, 'important') }, icon('flag', 13), 'High priority', h('i', String(important.length))),
      STAGES.map(([k, label]) => (g[k].length > 0 || !R.stages[k]) && h('button' + (R.stages[k] ? '' : '.off'), { 'aria-label': (R.stages[k] ? 'Jump to ' : 'Show ') + label, onclick: () => showAndJump(page, k) }, !R.stages[k] && icon('eye.slash', 13), label, h('i', String(g[k].length))))),
    (R.openFilter = () => filterSheet(page, counts), null),   // Sort and Show-and-hide are in the bar’s filter menu
    hidden.length > 0 && h('div.cr-bar', h('span', 'Hidden: ' + hidden.join(', ')), h('button.cu-link', { style: 'flex:none', onclick: () => { PRIS.forEach(k => { R.pri[k] = true; }); STAGES.forEach(([k]) => { R.stages[k] = true; }); page.refresh(); } }, 'Show all')),
    R.source !== 'all' && h('div.cu-filter', 'Showing leads from ' + (SRC[R.source] || {}).title.toLowerCase(), h('button.cu-link', { onclick: () => { R.source = 'all'; page.refresh(); } }, 'Show all')),
    staleList.length > 0 && ui.section({ header: 'Ready to archive · ' + staleList.length, fold: true, folded: true, foldKey: 'Ready to archive', footer: 'Low-priority leads that were called, texted and emailed once with no answer. Archiving clears them from the inbox; nothing is deleted.' },
      staleList.map(c => ui.row({ title: c.name, subtitle: [h('span.cr-sit', situation(c)), tryLine(c)].map(x => h('div', x)), trailing: ui.button('Archive', { kind: 'gray', small: true, block: false, onTap: e => { e.stopPropagation(); archive([c], 'called, texted and emailed with no answer'); ui.toast(c.name + ' archived', 'tray'); } }), onTap: () => openLead(c.id) })),
      staleList.length > 1 && ui.row({ icon: 'tray', iconPlain: true, title: 'Archive all ' + staleList.length, tint: true, onTap: () => { const n = staleList.length; archive(staleList, 'called, texted and emailed with no answer'); ui.toast(plural(n, 'lead') + ' archived', 'tray'); } })),
    important.length > 0 && mark(ui.section({ header: head('High priority · ' + important.length, R.important, v => { R.important = v; }, 'var(--red)'), footer: R.important ? 'Open leads marked high priority. Each one is also listed under its stage below.' : null, keepEmpty: true }, R.important ? important.sort(sort).map(c => row(c, true)) : []), 'important'),
    STAGES.map(sec),
    !shown && ui.empty({ icon: 'funnel', title: list.length || hidden.length ? 'Everything here is hidden' : 'No leads', text: list.length || hidden.length ? 'Tap Show all to bring the hidden priorities and stages back.' : CO.seesAll() ? 'New leads appear here as they come in.' : 'No leads in your territory right now.' }),
    srcRows.length > 0 && R.source === 'all' && ui.section({ header: 'Leads by source', footer: 'Tap a source to see only its leads.' }, srcRows),
    ui.section({ footer: 'Any lead can be archived from its page to clean up the inbox, and brought back later.' }, ui.row({ icon: 'tray', iconColor: 'var(--gray)', title: 'Archived leads', detail: String(arch.length), chevron: true, onTap: () => page.push(archivedSpec()) })));
}
/** What needs attention: new leads nobody has answered, follow-ups due, and open feedback. The tab badge is `total`, and the line at the
    top of the CRM screen shows that same total with its parts, so the badge always matches a number on the screen. */
const attention = () => { const p = pipe(), fresh = p.filter(c => stageOf(c) === 'fresh').length, due = p.filter(c => stageOf(c) === 'due').length, fb = F.feedback ? CO.feedbackOpen() : 0; return { fresh, due, fb, total: fresh + due + fb }; };
function attentionLine(page) {
  const a = attention(); if (!a.total) return null;
  const go = (text, fn) => h('button', { onclick: fn }, text), stage = k => () => { R.seg = 'pipeline'; page.refresh(); setTimeout(() => showAndJump(page, k), 30); };
  return h('div.cr-need', { role: 'status', 'aria-label': a.total + (a.total === 1 ? ' needs' : ' need') + ' attention. This is the number on the CRM tab.' }, h('span.cr-need-n', String(a.total)), h('b', a.total === 1 ? 'needs attention' : 'need attention'),
    a.fresh > 0 && go(a.fresh + ' new', stage('fresh')), a.due > 0 && go(a.due + ' due', stage('due')), a.fb > 0 && go(a.fb + ' feedback', () => { R.seg = 'feedback'; page.refresh(); }));
}
function root() {
  return { title: 'CRM', large: true, trailing: page => [R.seg === 'pipeline' && { icon: 'line.3.horizontal.decrease', label: 'Sort and filter', onTap: (p, el) => ui.menu(el, [{ header: 'Sort by' }, ...SORTS.map(([v, label]) => ({ label, checked: R.sort === v, onTap: () => { R.sort = v; page.refresh(); } })), 'divider', { label: 'Show and hide…', icon: 'eye.slash', onTap: () => R.openFilter && R.openFilter() }], { compact: true }) },
      canEdit() && (R.seg === 'tasks' ? { icon: 'plus', label: 'New follow-up', onTap: () => K.newTask() } : { icon: 'plus', label: 'New lead', onTap: () => newLead() })].filter(Boolean),
    render: page => { const due = data.tasks.filter(t => !t.done && t.due <= today).length, segs = [{ value: 'pipeline', label: 'Pipeline' }, { value: 'tasks', label: 'Tasks' + (due ? ' · ' + due : '') }, F.quotes && { value: 'quotes', label: 'Quotes' }, F.referrals && { value: 'referrals', label: 'Referrals' }, F.feedback && { value: 'feedback', label: 'Feedback' + (CO.feedbackOpen() ? ' · ' + CO.feedbackOpen() : '') }].filter(Boolean);
      if (!segs.some(s => s.value === R.seg)) R.seg = 'pipeline';
      return [attentionLine(page), segs.length > 1 && h('div.cu-seg.cr-seg', ui.segmented(segs, R.seg, v => { R.seg = v; page.refresh(); })), R.seg === 'tasks' ? K.tasksView() : R.seg === 'quotes' ? quotesView() : R.seg === 'referrals' ? referralsView(page) : R.seg === 'feedback' ? CO.feedbackView(page) : pipelineView(page)]; } };
}

/* ================= Registration ================= */
WD.screens.crm = { root, openLead, newLead };
const tab = WD.app.tabs.find(t => t.id === 'crm');
/* The badge used to add every due lead (including ones already counted as new), so it read 11 beside "5 new, 3 due". Now each lead counts once, by its stage. */
if (tab) tab.badge = () => WD.can('leads.view') ? attention().total : 0;
const show = seg => { R.seg = seg; WD.nav.switchTab('crm'); };
WD.panel.addJump('CRM pipeline', () => show('pipeline'));
WD.panel.addJump('Quotes and bids', () => show('quotes'));
WD.panel.addJump('CRM tasks', () => show('tasks'));
WD.panel.addAction('New lead from Yelp', () => { const id = 'c' + Date.now().toString(36), names = [['Juniper Family Dental', 'Rosa Whitlock', '88 Juniper St', '“Looking for a quote to shred about 30 boxes of old patient charts.”'], ['Mesa Tax & Accounting', 'Gil Barrera', '412 Mesa Blvd', '“Do you offer a monthly console service? Two-person office.”']], n = names[data.customers.length % 2];
  if (!ST.sources.yelp) return ui.toast('Yelp leads are switched off in Settings → CRM and leads', 'info.circle', 3200);
  const c = K.mk({ id, name: n[0], channel: 'Yelp', contacts: [{ name: n[1], role: '', phone: '', email: '' }], address: n[2], x: 280 + (data.customers.length * 83) % 420, y: 220 + (data.customers.length * 61) % 480, next: 0, cnotes: 'Yelp request: ' + n[3] });
  Object.assign(c, { source: 'yelp', createdAt: +WD.now(), changes: [] }); c.locations.forEach(l => { l.items = []; }); K.addI({ customerId: id, type: 'note', at: +WD.now(), text: c.notes + ' Yelp does not share their phone or email until they reply, so answer in Yelp.', by: 'RouteClerk · Yelp' }); K.addTask(id, 'Reply to the Yelp request', 0, { lead: true }); WD.changed();
  ui.banner({ title: 'New lead · Yelp', text: n[0] + ' — ' + n[1] + ' sent a request. Reply in Yelp.', icon: 'star.fill', color: 'var(--red)', duration: 7000, onTap: () => { if (WD.can('leads.view')) { WD.nav.switchTab('crm'); openLead(id); } } }); });
WD.panel.addAction('New lead from the website form', () => { const id = 'c' + Date.now().toString(36), names = [['Birchwood Pediatrics', 'Nina Alvarado', 'nina@birchwoodpeds.example', '31 Birchwood Ln'], ['Keystone Title Co.', 'Owen Marsh', 'owen@keystonetitle.example', '500 Keystone Ave']], n = names[data.customers.length % 2];
  if (!ST.sources.form) return ui.toast('Website form leads are switched off in Settings → CRM and leads', 'info.circle', 3200);
  const c = K.mk({ id, name: n[0], channel: 'Website', contacts: [{ name: n[1], role: '', phone: '+1512555' + String(1000 + data.customers.length * 7).slice(-4), email: n[2] }], address: n[3], x: 300 + (data.customers.length * 97) % 400, y: 200 + (data.customers.length * 53) % 500, next: 0, cnotes: 'Website form: “We need a console for patient records. What does it cost?”' });
  Object.assign(c, { source: 'form', createdAt: +WD.now(), changes: [] }); c.locations.forEach(l => { l.items = []; }); K.addI({ customerId: id, type: 'note', at: +WD.now(), text: c.notes, by: 'RouteClerk · website form' }); WD.changed();
  ui.banner({ title: 'New lead · website form', text: n[0] + ' — ' + n[1] + ' asked for a price.', icon: 'funnel', color: 'var(--purple)', duration: 7000, onTap: () => { if (WD.can('leads.view')) { WD.nav.switchTab('crm'); openLead(id); } } }); });
})();
