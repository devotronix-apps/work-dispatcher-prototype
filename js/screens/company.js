/* Company settings and what they drive, registered on WD.co: the Settings and assumptions hub (routing assumptions, time-off auto-approval,
   on-my-way notices, container barcodes, bookkeeping and payment status, reviews and feedback, CRM), editable templates for every text,
   email, letter and the service agreement, per-agreement editing, the on-my-way prompt, the barcode scanner, payment-status checks against
   the bookkeeping program, customer feedback and the review QR code. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD;
const CO = WD.co = {};
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You', org = () => S.org || data.orgs[0], admin = () => WD.can('settings.manage');
const first = n => String(n || '').replace(/^Dr\.\s*/, '').split(' ')[0];
const money = n => fmt.money(n, true), mdy = k => fmt.day(k, 'md') + ', ' + k.slice(0, 4), longDay = k => fmt.day(k, 'long') + ', ' + k.slice(0, 4);
const W = data.workflow, uid = p => p + Date.now().toString(36) + Math.floor(Math.random() * 99);
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Company settings need the Company settings permission. An owner or admin can grant it in Team and roles.' });
const note = t => h('div', { style: 'padding:4px 4px 0' }, ui.note(t));

WD.addIcons({
  funnel: '<path d="M3.500 5h17l-6.500 7.800V19l-4 1.500v-7.700z"/>',
  qrcode: '<rect x="3.500" y="3.500" width="6" height="6" rx="1"/><rect x="14.500" y="3.500" width="6" height="6" rx="1"/><rect x="3.500" y="14.500" width="6" height="6" rx="1"/><path d="M14.500 14.500h2.500v2.500M20.500 14.500v6h-3M14.500 20.500v-1"/>',
  barcode: '<path d="M4 6v12M7 6v12M10.500 6v12M13 6v12M16.500 6v12M20 6v12" /><path d="M8.800 6v12M18.300 6v12" stroke-width=".9"/>',
});
WD.css(`
.co-body textarea.field { min-height: 190px; font-size: 15px; line-height: 20px; }
.co-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px 12px; border-top: .5px solid var(--sep); }
.co-chips button { border: 0; border-radius: 13px; height: 26px; padding: 0 9px; background: var(--fill3); color: var(--tint); font-size: 12.500px; font-family: ui-monospace, Menlo, monospace; cursor: pointer; }
.co-prev { padding: 12px 16px; font-size: 14.500px; line-height: 20px; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
.co-bubble { margin: 10px 16px; padding: 9px 13px; border-radius: 18px; background: var(--blue); color: #fff; font-size: 15px; line-height: 20px; white-space: pre-wrap; overflow-wrap: anywhere; max-width: 86%; margin-left: auto; }
.co-bubble.in { background: var(--fill2); color: var(--label); margin-left: 16px; margin-right: auto; }
.co-eta { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 16px 6px; text-align: center; } .co-eta small { font-size: 13px; color: var(--label2); } .co-eta b { font-size: 40px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .2px; } .co-eta span { font-size: 15px; color: var(--label2); }
.co-acts { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 18px; }
.co-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: .5px; background: var(--sep); } .co-tiles > div { background: var(--cell); padding: 10px 6px; text-align: center; } .co-tiles b { display: block; font-size: 19px; font-weight: 600; font-variant-numeric: tabular-nums; } .co-tiles span { font-size: 11px; color: var(--label2); }
.co-stars { color: var(--orange); letter-spacing: 1px; font-size: 14px; white-space: nowrap; } .co-stars i { color: var(--label3); font-style: normal; }
.co-qr { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 22px 24px 8px; text-align: center; }
.co-qr .box { width: 250px; height: 250px; background: #fff; border-radius: 18px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,.14); display: grid; place-items: center; position: relative; } .co-qr .box img, .co-qr .box svg { width: 100%; height: 100%; object-fit: contain; }
.co-qr .sample { position: absolute; inset: auto 0 44%; text-align: center; } .co-qr .sample span { background: #fff; color: #d70015; font-weight: 700; font-size: 15px; padding: 3px 10px; border-radius: 6px; border: 2px solid #d70015; }
.co-qr h3 { margin: 4px 0 0; font-size: 22px; } .co-qr p { margin: 0; color: var(--label2); font-size: 14px; overflow-wrap: anywhere; }
.co-scan { margin: 12px 16px 0; height: 150px; border-radius: 14px; background: #111; position: relative; overflow: hidden; display: grid; place-items: center; color: rgba(255,255,255,.7); font-size: 13px; }
.co-scan::after { content: ''; position: absolute; left: 8%; right: 8%; top: 50%; height: 2px; background: #ff453a; box-shadow: 0 0 10px #ff453a; animation: co-sweep 1.6s ease-in-out infinite alternate; } @keyframes co-sweep { from { top: 22%; } to { top: 78%; } }
.co-file { position: relative; overflow: hidden; } .co-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
.co-clause { border-top: 6px solid var(--bg); }
.x-doc .cl { margin-top: 9px; } .x-doc .cl b { display: inline; }
.bi-scan { margin-top: 8px; font-size: 9.500px; line-height: 13px; } .bi-scan b { font-weight: 700; }
`);

/* ================= Settings data ================= */
Object.assign(W, { defaultStopMin: W.defaultStopMin || 30 });
const ST = data.settings = {
  timeOff: { auto: false, limitDays: 0 },                     // message lives in the “Time off — auto-approval” template
  onMyWay: { mode: 'off', byJob: {}, byCust: {} },            // off | text | call | ask | auto; overrides by job type and customer type
  barcodes: { on: false, require: false, onInvoice: true, hddDefault: false },
  books: { provider: 'ninja', autoPaid: true, everyMin: 15, lastCheck: +WD.now() - 11 * 60000 },
  reviews: { on: true, when: 'first', nth: 4, delayHours: 2, positiveFrom: 4,
    sites: [{ id: 'google', name: 'Google Maps', url: 'https://g.page/r/discount-shred/review', on: true }, { id: 'yelp', name: 'Yelp', url: 'https://www.yelp.com/writeareview/biz/discount-shred-lakemont', on: true },
      { id: 'apple', name: 'Apple Maps', url: 'https://maps.apple.com/place?id=discount-shred', on: false }, { id: 'chatgpt', name: 'ChatGPT business reviews', url: '', on: false }],
    qr: { url: 'https://g.page/r/discount-shred/review', caption: 'Scan to leave a review', image: null } },
  crm: { features: { followups: true, reminders: true, quotes: true, referrals: true, territories: true, sources: true, feedback: true },
    sources: { phone: true, text: true, email: true, form: true, yelp: true, sheet: false, manual: true, referral: true },
    remindDays: 3, referralReward: '$25 credit on their next invoice', territories: { u2: { mode: 'zip', values: ['78641', '78642'] } } },
};
const BOOKS = [{ value: 'ninja', label: 'Invoice Ninja' }, { value: 'qbo', label: 'QuickBooks Online' }, { value: 'zoho', label: 'Zoho Books' }, { value: 'xero', label: 'Xero' }, { value: 'freshbooks', label: 'FreshBooks' }, { value: 'none', label: 'None — track payments here' }];
CO.booksName = () => (BOOKS.find(b => b.value === ST.books.provider) || BOOKS[0]).label.replace(/ —.*/, '');
CO.hasBooks = () => ST.books.provider !== 'none';

/* ================= Templates ================= */
const CHANNELS = [{ value: 'text', label: 'Text message' }, { value: 'email', label: 'Email' }, { value: 'letter', label: 'Letter (PDF by email or print)' }, { value: 'app', label: 'Message in the app' }];
const CH_ICON = { text: ['message', 'var(--green)'], email: ['envelope', 'var(--blue)'], letter: ['doc.text', 'var(--indigo)'], app: ['bell', 'var(--orange)'] };
const FIELDS = [['{first}', 'Contact’s first name'], ['{contact}', 'Contact’s full name'], ['{customer}', 'Customer name'], ['{company}', 'Your company'], ['{phone}', 'Your phone number'], ['{sender}', 'Whoever sends it'], ['{owner}', 'The owner'],
  ['{driver}', 'The driver'], ['{date}', 'Service date'], ['{window}', 'Arrival window'], ['{eta}', 'Estimated arrival'], ['{invoice}', 'Invoice number'], ['{amount}', 'Amount'], ['{effective}', 'Date a change starts'], ['{changes}', 'Table of price or service changes'],
  ['{olddate}', 'The day a visit was moved from'], ['{reason}', 'Why a visit was moved'], ['{link}', 'Signing or quote link'], ['{portal}', 'Customer payment portal'], ['{review_links}', 'Links to your review sites'], ['{employee}', 'Employee’s first name']];
const G = { svc: 'Service messages', bill: 'Billing and price changes', rev: 'Reviews and feedback', lead: 'Leads and follow-ups', team: 'Team' };
const T = (id, group, name, channel, subject, body) => ({ id, group, name, channel, subject, body, builtin: true, def: { name, channel, subject, body } });
data.templates = [
  T('window', G.svc, 'Arrival window', 'text', '', 'Hi {first}, this is {company}. Your shredding service is {date}, and we expect to arrive between {window}. Reply to this text or call {phone} if that doesn’t work for you.'),
  T('omw', G.svc, 'On my way', 'text', '', 'Hi {first}, this is {driver} with {company}. I’m on my way and should be there around {eta}.'),
  T('remind', G.svc, 'Service reminder', 'text', '', '{company}: your service is scheduled for {date}. Reply C to confirm or call {phone}.'),
  T('aglink', G.svc, 'Service agreement — signing link', 'email', 'Your service agreement with {company}', 'Hi {first},\n\nYour service agreement with {company} is ready. You can read and sign it on your phone or computer here:\n{link}\n\nIf anything needs changing, reply to this email or call {phone}.\n\n{sender}\n{company}'),
  T('price', G.bill, 'Price or service change', 'letter', 'A change to your service', 'Dear {contact},\n\nThank you for trusting {company} with your document destruction. This letter is to let you know about a change to your service, beginning with your service on {effective}.\n\n{changes}\n\nServices before that date are billed at your current rate. Nothing else about your service changes, and there is nothing you need to do.\n\nIf you have any questions, call us at {phone} or reply to this email.\n\nSincerely,\n{owner}\n{company}'),
  T('payrem', G.bill, 'Payment reminder', 'email', 'Payment reminder — {invoice}', 'Hi {first},\n\nA friendly reminder that invoice {invoice} for {amount} is still open. You can pay online, or add a card or bank account for automatic payment, in your customer portal:\n{portal}\n\nThank you,\n{company}'),
  T('rvask', G.rev, 'Follow-up after service', 'text', '', 'Hi {first}, this is {company}. {driver} serviced your location today. How did {driver} and the service do? Reply with a number from 1 (poor) to 5 (great), and anything you’d like us to know.'),
  T('rvpos', G.rev, 'Positive reply — ask for a review', 'text', '', 'Thank you, {first}! We’ll pass that on to {driver}. If you have a minute, a public review really helps {driver} and our small team get found by new customers:\n{review_links}'),
  T('rvneg', G.rev, 'Negative reply — apology', 'text', '', '{first}, I’m sorry we let you down. Thank you for telling us. We appreciate your feedback and take it seriously, and {owner} will call you to make it right.'),
  T('lead1', G.lead, 'New lead — first reply', 'text', '', 'Hi {first}, this is {sender} with {company}. Thanks for reaching out about shredding. When is a good time for a quick call so I can get you a price?'),
  T('lead2', G.lead, 'No response — a few days', 'text', '', 'Hi {first}, {sender} at {company} again. I didn’t want your shredding request to slip through. Would you rather I email a quote?'),
  T('lead3', G.lead, 'No response — a week or more', 'email', 'Still need shredding?', 'Hi {first},\n\nI’m following up on your request for shredding service. If the timing isn’t right, no problem. Tell me when to check back and I will.\n\nIf you’d like a price, reply with roughly how much paper you have and how often you’d like service.\n\n{sender}\n{company} · {phone}'),
  T('quote1', G.lead, 'Quote follow-up', 'email', 'Your shredding quote', 'Hi {first},\n\nI wanted to make sure you received our quote: {link}\n\nHappy to adjust the container count or schedule if that would help. Would you like to get on the calendar?\n\n{sender}\n{company} · {phone}'),
  T('lead4', G.lead, 'Last check-in', 'text', '', 'Hi {first}, this is my last check-in about shredding for {customer}. If you still need it, reply any time and I’ll take care of you. {sender}, {company}'),
  T('refthanks', G.lead, 'Referral thank-you', 'text', '', 'Hi {first}, thank you for sending {customer} our way! As a thank-you you’ll see a credit on your next invoice. {sender}, {company}'),
  T('timeoff', G.team, 'Time off — auto-approval', 'app', '', 'Auto-approved, contingent upon a conversation with Spencer to verify.'),
];
const tpl = CO.tpl = id => data.templates.find(t => t.id === id) || { name: id, body: '', subject: '', channel: 'text' };
const fill = CO.fill = (text, ctx) => String(text || '').replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null ? ctx[k] : m);
const reviewLinks = () => ST.reviews.sites.filter(s => s.on && s.url).map(s => s.name + ': ' + s.url).join('\n') || '(turn on a review site in Settings)';
/** Values for the merge fields, for one customer plus whatever the caller knows (driver, eta, invoice…). */
const ctxFor = CO.ctxFor = (c, extra = {}) => { const p = (c && c.contacts[0]) || {}, o = org();
  return { first: first(p.name) || 'there', contact: p.name || 'Customer', customer: c ? c.name : 'your company', company: o.name, phone: o.phone || '', sender: first(me()), owner: (q.user('u1') || {}).name || o.name,
    portal: 'https://pay.discountshred.example/portal', link: 'https://go.discountshred.example/s/7Kq2', review_links: reviewLinks(), employee: first(me()), ...extra }; };
const sampleCtx = () => ctxFor(q.customer('c1') || data.customers[0], { driver: 'Marcus', date: fmt.day(D.add(today(), 1), 'long'), window: '9:00 – 11:00 AM', eta: '10:45 AM', invoice: 'INV-2417', amount: '$130.00', effective: longDay(D.add(today(), 30)), changes: '[table of changes]', employee: 'Sam' });
const edited = t => t.builtin && (t.body !== t.def.body || t.subject !== t.def.subject || t.channel !== t.def.channel || t.name !== t.def.name);

CO.editTemplate = (t, o = {}) => {
  const isNew = !t, f = t ? { name: t.name, channel: t.channel, subject: t.subject || '', body: t.body } : { name: '', channel: 'text', subject: '', body: '' };
  let ta = null, prev = null;
  const upd = () => { if (prev) prev.textContent = (f.channel !== 'text' && f.channel !== 'app' && f.subject ? 'Subject: ' + fill(f.subject, sampleCtx()) + '\n\n' : '') + fill(f.body, sampleCtx()); };
  const insert = k => { if (!ta) return; const s = ta.selectionStart != null ? ta.selectionStart : f.body.length, e = ta.selectionEnd != null ? ta.selectionEnd : s; f.body = f.body.slice(0, s) + k + f.body.slice(e); ta.value = f.body; ta.focus(); ta.setSelectionRange(s + k.length, s + k.length); upd(); };
  return ui.sheet({ title: isNew ? 'New template' : 'Edit template', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Save', bold: true, onTap: async p => { if (!f.name.trim() || !f.body.trim()) return ui.toast('Add a name and the wording', 'note');
      if (!await ui.run('Saving…', () => { if (isNew) data.templates.push({ id: uid('tp'), group: o.group || 'Your own templates', builtin: false, ...f, name: f.name.trim() }); else Object.assign(t, f, { name: f.name.trim(), editedBy: me(), editedAt: +WD.now() }); }, { done: 'Template saved' })) return;
      p.dismiss(); o.onSave && o.onSave(); } }],
    render: p => { const bodyRow = ui.inputRow({ multiline: true, placeholder: 'Write the message…', value: f.body, onInput: v => { f.body = v; upd(); } }); bodyRow.classList.add('co-body'); ta = bodyRow.querySelector('textarea'); prev = h('div.co-prev'); upd();
      const same = t && t.builtin && f.body === t.def.body && f.subject === t.def.subject && f.channel === t.def.channel && f.name === t.def.name;
      return ui.list(
        ui.section(null, ui.inputRow({ label: 'Name', placeholder: 'e.g. Holiday schedule', value: f.name, onInput: v => { f.name = v; } }), ui.pickerRow({ title: 'Sent as', value: f.channel, options: CHANNELS, onChange: v => { f.channel = v; p.refresh(); } }),
          (f.channel === 'email' || f.channel === 'letter') && ui.inputRow({ label: 'Subject', placeholder: 'Subject line', value: f.subject, onInput: v => { f.subject = v; upd(); } })),
        ui.section({ header: 'Wording', footer: 'Tap a field to drop it in where the cursor is. Fields like {first} are filled in for each customer when the message goes out.' }, bodyRow, h('div.co-chips', FIELDS.map(([k, label]) => h('button', { title: label, onclick: () => insert(k) }, k)))),
        ui.section({ header: 'Preview with sample details', footer: f.channel === 'text' ? 'Texts over 160 characters are sent as more than one message.' : null }, prev),
        t && t.builtin && ui.section({ footer: t.editedAt ? 'Last changed by ' + t.editedBy + ' ' + fmt.rel(t.editedAt).toLowerCase() + '.' : null }, ui.row({ title: 'Put back the original wording', tint: true, disabled: same, onTap: () => { Object.assign(f, t.def); p.refresh(); } })),
        t && !t.builtin && ui.section(null, ui.row({ title: 'Delete template', destructive: true, onTap: async () => { if (await ui.actionSheet({ title: 'Delete “' + t.name + '”?', buttons: [{ label: 'Delete template', role: 'destructive', value: true }] })) { data.templates = data.templates.filter(x => x !== t); WD.changed(); p.dismiss(); } } })));
    } }, { detent: 'large' });
};
CO.templatesSpec = () => ({ title: 'Templates', trailing: () => admin() ? [{ icon: 'plus', label: 'New template', onTap: () => CO.editTemplate(null) }] : [],
  render: page => { if (!admin()) return locked(); const groups = [...new Set(data.templates.map(t => t.group))];
    return ui.list(note('Everything the app sends for you starts from one of these. Change the wording any time; the next message uses it. Add your own for anything else you send often.'),
      ui.section({ header: 'Service agreement', footer: 'The default wording for new agreements. Each agreement can still be changed on its own before it is signed.' },
        ui.row({ icon: 'signature', iconColor: 'var(--indigo)', title: 'Service agreement', subtitle: AT.clauses.length + ' paragraphs, then the Agreement for Service details', chevron: true, onTap: () => CO.editAgreementDoc(AT, { template: true }) })),
      groups.map(g => ui.section(g, data.templates.filter(t => t.group === g).map(t => ui.row({ icon: (CH_ICON[t.channel] || CH_ICON.text)[0], iconColor: (CH_ICON[t.channel] || CH_ICON.text)[1], title: t.name, subtitle: t.body.replace(/\s+/g, ' ').slice(0, 78) + (t.body.length > 78 ? '…' : ''),
        badge: edited(t) ? ui.badge('Edited', 'var(--indigo)') : !t.builtin ? ui.badge('Yours', 'var(--teal)') : null, chevron: true, onTap: () => CO.editTemplate(t) })))),
      ui.section(null, ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'New template', tint: true, onTap: () => CO.editTemplate(null) })));
  } });
const tplRow = CO.tplRow = (id, page) => { const t = tpl(id); return ui.row({ icon: (CH_ICON[t.channel] || CH_ICON.text)[0], iconPlain: true, title: 'Wording: ' + t.name, subtitle: t.body.replace(/\s+/g, ' ').slice(0, 70) + '…', tint: true, chevron: true, onTap: () => CO.editTemplate(t, { onSave: () => page && page.refresh() }) }); };

/** The price or service change letter, laid out from the “Price or service change” template. A paragraph that is just {changes} becomes the table. */
CO.letterDoc = (c, changes, effective) => {
  const o = org(), t = tpl('price'), loc = c.locations[0] || {}, ctx = ctxFor(c, { effective: longDay(effective) }), lines = changes.filter(ch => ch.kind !== 'start');
  const table = () => h('table', lines.map(ch => h('tr', h('td', ch.kind === 'price' ? ch.item : ch.kind === 'qty' ? ch.item + ' — quantity' : 'Service interval'), h('td', ch.kind === 'price' ? money(ch.from) + ' → ' + money(ch.to) : ch.from + ' → ' + ch.to))));
  return h('div.x-doc', h('h4', o.name), h('small', (o.remit || []).slice(1).join(' · ') + (o.phone ? ' · ' + o.phone : '')), h('p', longDay(today())), h('p', c.name, h('br'), loc.address || ''),
    t.body.split(/\n\s*\n/).map(par => par.trim() === '{changes}' ? table() : h('p', fill(par, ctx).split('\n').flatMap((ln, i) => i ? [h('br'), ln] : [ln]))));
};

/* ================= Service agreements: default wording and per-agreement documents ================= */
const AT = data.agreementTemplate = { title: '{company} Service Agreement', terms: 'Net 30',
  intro: 'This Confidential Document Destruction Service Agreement (“Services Agreement”) is made between {company} and {customer} (“Client”). In consideration of the mutual covenants contained herein, {company} and Client hereby agree as follows:',
  termNote: 'If less than a one year commitment, a non-refundable bin/console setup fee of $100 per container applies unless otherwise indicated.',
  payment: 'Invoices are emailed after each service. Client can pay online, and add a credit card or bank account (ACH) for payment, at any time in the customer portal: {portal}. A transaction fee (3.5%) applies to all credit or debit card transactions. Card and bank details are not collected on this agreement.',
  clauses: [
    { title: 'Section 1. The Services', text: '{company} will perform regular service and/or a one-time purge at a specific location agreed upon by both parties in accordance with the terms and conditions of this Agreement. Both parties will mutually establish a schedule or one time purge with {company}. {company} will securely collect all confidential material from the Client location. The confidential material will be shredded onsite with our secure mobile truck or will be securely transported to a {company} facility for destruction. Unless otherwise agreed upon, all services will be provided ON-SITE. All material will be shredded to comply with Federal and State regulations. Within a reasonable amount of time, {company} will produce a certificate of destruction as needed by Client. After material has been shredded, {company} will recycle such material.' },
    { title: '1.1 Storage Units', text: '{company} shall supply working, secure, locking units for the collection of documents to be destroyed. Locked containers will be provided free of charge to the Client for regular service lasting one year or longer. A fee may apply for purges or regular service lasting less than one year.' },
    { title: '1.2 Obligation of Client to {company}', text: 'Locked containers are to be used by Client for the sole purpose of keeping confidential documents and are not to be removed or used for any other purpose. If locked containers are lost or destroyed by Client, Client shall pay for all damages or loss of such containers. The locked containers furnished by {company} hereunder shall remain the property of {company} and Client shall not acquire any property interest in such containers. Client shall not deliver to {company} any material considered toxic or dangerous or which is regulated under any federal or state law or regulation relating to hazardous materials.' },
    { title: '1.3 Additional Work', text: 'It is understood that, from time to time during the term of this Agreement, Client may request {company} to perform services or provide materials which are not set forth in the Contract Duties but are related to the services encompassed within the Contract Duties (hereinafter “Additional Work”). {company} hereby agrees to perform such Additional Work so long as prior to the performance of such Additional Work, Client shall authorize the scope of such Additional Work and mutually agreed upon compensation payable to {company} for the full performance of said Additional Work.' },
    { title: 'Section 2. Term and Termination', text: 'This Services Agreement shall be effective the day {company} drops off security containers or the day the service is provided, whichever occurs first. The contract automatically renews for one additional year based upon the effective date. {company} reserves the right to terminate contract for any reason with a 30-day notice. {company} will perform the final service at the agreed upon service charge(s) and pick up the containers at the conclusion of the service. If the Client wants to end the service sooner than the annual renewal date, then six regular service charges or ninety days of service would apply whichever is greater.' },
    { title: '2.1 Termination for Cause', text: 'Client shall have the right to terminate its obligations pursuant to this Agreement if one of the following conditions exists and it has not been remedied or cured within thirty (30) days of {company}’s receipt of written notice of such condition: (i) A substantial breach of any material obligation under this Agreement; or (ii) If {company} is unable for any reason to perform its obligations pursuant to this Agreement in a safe, lawful, and professional manner. Upon termination, Client shall pay all actual expenses and charges up to the date of termination.' },
    { title: 'Section 3. Limitation of Liability', text: '{company} shall not be responsible or liable for the release or loss of any materials deposited in bins, cabinets, and/or totes or otherwise delivered to it for destruction unless the release or loss is due to {company}’s negligence or willful misconduct. {company} is responsible for secure destruction at the point the material is given/taken possession by a {company} employee. {company}’s maximum liability for all claims arising from the confidential destruction services performed hereunder shall not exceed the total of invoices submitted by {company} over the last six-month period.' },
    { title: 'Section 4. Force Majeure', text: 'Each party shall be excused from any delay or failure in performance under this Agreement for any period if and to the extent that such delay or failure is caused by acts of God, governmental actions, labor unrest, riots, unusual traffic delays, natural disasters, or other causes beyond its control.' },
    { title: 'Section 5. Exclusivity', text: 'Customer agrees to retain {company} on an exclusive basis covered by this agreement for the term of this agreement.' },
  ] };
const pbName = id => (data.priceBook.find(x => x.id === id) || { name: id }).name;
const perVisit = items => (items || []).reduce((s, i) => s + (+i.qty || 0) * (+i.rate || 0), 0);
/** Each agreement carries its own copy of the wording, items and rates, taken from the template and the customer when it is created, so it can be changed on its own. */
CO.agDoc = a => { if (a.doc) return a.doc; const c = q.customer(a.customerId) || { name: 'Customer', contacts: [], locations: [{}] }, loc = c.locations[0] || {}, ctx = ctxFor(c, { address: loc.address || 'the service address' });
  a.doc = { title: fill(AT.title, ctx), intro: fill(AT.intro, ctx), termNote: AT.termNote, payment: fill(AT.payment, ctx), special: loc.notes || '', terms: c.terms || AT.terms, freq: c.freq || 'Every 4 weeks', items: (loc.items || []).filter(i => i.qty > 0).map(i => ({ name: pbName(i.id), qty: i.qty, rate: i.rate })), clauses: AT.clauses.map(cl => ({ title: fill(cl.title, ctx), text: fill(cl.text, ctx) })) };
  return a.doc; };
CO.agreementDoc = a => {
  const d = CO.agDoc(a), o = org(), c = q.customer(a.customerId) || { name: 'Client', contacts: [], locations: [{}] }, p = c.contacts[0] || {}, end = a.term ? D.add(a.start, Math.round(a.term * 30.44) - 1) : null, sv = WD.screens.billing && WD.screens.billing.sigView, when = t => mdy(D.key(new Date(t)));
  const tr = (k, v) => h('tr', h('td', k), h('td', { style: 'white-space:normal' }, v)), signed = a.status === 'signed';
  return h('div.x-doc', h('h4', d.title), h('small', a.number + ' · ' + o.name + ' · ' + (o.remit || []).slice(1).join(', ') + (o.phone ? ' · ' + o.phone : '')), h('p', d.intro),
    d.clauses.map(cl => /^Section/i.test(cl.title) ? [h('p.cl', h('b', { style: 'font-size:14.500px' }, cl.title)), h('p', { style: 'margin-top:2px' }, cl.text)] : h('p.cl', h('b', cl.title + (/[.:]$/.test(cl.title) ? ' ' : '. ')), cl.text)),
    h('h4', { style: 'margin-top:18px;text-align:center;letter-spacing:.3px' }, 'AGREEMENT FOR SERVICE'),
    h('table', tr('Client/Company name', c.name), tr('Email', c.billingEmail || p.email || '—'), tr('Address', (c.locations[0] || {}).address || '—'),
      tr('Quantity of security containers', d.items.length ? d.items.map(i => h('div', i.qty + ' × ' + i.name + ' · ' + money(i.rate) + ' each')) : '—'), tr('Minimum frequency of service', d.freq),
      d.special && tr('Special considerations', d.special), tr('Date of setup or first service', mdy(a.start)), tr('Cost of service', h('b', money(perVisit(d.items)) + ' per service')),
      tr('Service contract term', a.term ? a.term + ' months' + (end ? ', through ' + mdy(end) : '') : 'Month to month'), d.terms && tr('Payment terms', d.terms)),
    d.termNote && h('p', h('small', 'Note: ' + d.termNote)), d.payment && h('p', h('b', 'Payment. '), d.payment),
    h('div.sig', a.sig && sv ? sv(a.sig) : null), h('small', 'Signature, Client Authorized Representative' + (signed ? ' · ' + a.signer + ' · ' + when(a.signedAt) + (a.method === 'inperson' ? ' · in person' + (a.collectedBy ? ', collected by ' + a.collectedBy : '') : ' · from the emailed link') : ' · printed name · date')),
    h('div.sig', { style: 'min-height:30px;font-style:italic' }, a.createdBy || ''), h('small', 'Signature, ' + o.name + ' Authorized Representative · ' + when(a.sentAt || a.createdAt)));
};
/** Edit an agreement's own document (a = the agreement), or the default wording for new ones (o.template). Works on a copy until Save. */
CO.editAgreementDoc = (target, o = {}) => {
  const a = o.template ? null : target, src = o.template ? AT : CO.agDoc(a), f = JSON.parse(JSON.stringify(src)), g = a ? { term: a.term, start: a.start } : null;
  const FREQS = ['Weekly', 'Every 2 weeks', 'Every 4 weeks', 'Monthly', 'Quarterly', 'One time', 'On call'];
  return ui.sheet({ title: o.template ? 'Agreement wording' : 'Edit ' + a.number, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: [{ label: 'Save', bold: true, onTap: async p => {
      if (!await ui.run('Saving…', () => { f.clauses = f.clauses.filter(cl => cl.title.trim() || cl.text.trim()); if (o.template) Object.assign(AT, f); else { a.doc = f; Object.assign(a, g); if (a.status === 'sent' || a.status === 'viewed') a.revised = true; } }, { done: 'Saved' })) return;
      p.dismiss(); if (a && a.revised) ui.toast('Changed after it was sent. Send the link again so the customer sees the new version.', 'info.circle', 3600); o.onSave && o.onSave(); } }],
    render: p => ui.list(
      note(o.template ? 'New agreements start from this wording. Fields like {company}, {customer}, {address} and {portal} are filled in for each customer. Agreements already created keep the wording they have.' : 'Everything on this agreement can be changed: the wording, containers, rates, schedule and every section. Changes apply to this agreement only.'),
      ui.section('Heading', ui.inputRow({ label: 'Title', value: f.title, onInput: v => { f.title = v; } })),
      ui.section('Opening paragraph', ui.inputRow({ multiline: true, value: f.intro, onInput: v => { f.intro = v; } })),
      a && ui.section({ header: 'Containers and rates', footer: 'Per visit: ' + money(perVisit(f.items)) + '. Changing a rate here does not change the customer’s pricing; use Change pricing or service on the customer for that.' },
        f.items.map((it, i) => h('div.row.jb-item', h('div.row-main', h('input.field', { type: 'text', value: it.name, 'aria-label': 'Description', style: 'padding:0;width:100%', oninput: e => { it.name = e.target.value; } }), h('div.row-sub', 'Rate each · quantity')),
          h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': 'Rate', value: '$' + it.rate, oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); it.rate = isNaN(v) ? 0 : v; }, onchange: () => p.refresh() }),
          h('span.jb-qn', String(it.qty)), ui.stepper(it.qty, 0, 60, v => { if (v === 0) f.items.splice(i, 1); else it.qty = v; p.refresh(); }))),
        ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a line', tint: true, onTap: (e, el) => ui.menu(el, [...data.priceBook.map(x => ({ label: x.name, onTap: () => { f.items.push({ name: x.name, qty: 1, rate: x.rate }); p.refresh(); } })), 'divider', { label: 'Something else…', icon: 'plus', onTap: () => { f.items.push({ name: 'Additional service', qty: 1, rate: 0 }); p.refresh(); } }]) })),
      a && ui.section('Schedule and term',
        ui.pickerRow({ title: 'Service every', value: f.freq, options: FREQS.includes(f.freq) ? FREQS : [f.freq].concat(FREQS), onChange: v => { f.freq = v; p.refresh(); } }),
        ui.pickerRow({ title: 'Term', value: g.term, options: [{ value: 0, label: 'Month to month' }].concat([12, 24, 36, 60].map(n => ({ value: n, label: n + ' months' }))), onChange: v => { g.term = v; p.refresh(); } }),
        ui.dateRow({ title: 'Starts', value: g.start, onChange: v => { g.start = v; } })),
      a && ui.section('Special considerations or preferences', ui.inputRow({ multiline: true, placeholder: 'e.g. Consoles by the copier room; service before noon', value: f.special, onInput: v => { f.special = v; } })),
      ui.section({ header: 'Note under the contract term' }, ui.inputRow({ multiline: true, value: f.termNote, onInput: v => { f.termNote = v; } })),
      ui.section({ header: 'Payment', footer: 'This replaces the credit card authorization on the paper agreement: customers add a card or bank account (ACH) themselves in the ' + (CO.hasBooks() ? CO.booksName() + ' ' : '') + 'customer portal.' },
        ui.inputRow({ label: 'Terms', placeholder: 'Net 30', value: f.terms, onInput: v => { f.terms = v; } }), ui.inputRow({ multiline: true, value: f.payment, onInput: v => { f.payment = v; } })),
      f.clauses.map((cl, i) => ui.section({ header: 'Paragraph ' + (i + 1) },
        ui.inputRow({ label: 'Heading', value: cl.title, onInput: v => { cl.title = v; } }), ui.inputRow({ multiline: true, placeholder: 'Wording for this section', value: cl.text, onInput: v => { cl.text = v; } }),
        ui.row({ title: 'Remove this paragraph', destructive: true, onTap: () => { f.clauses.splice(i, 1); p.refresh(); } }))),
      ui.section({ footer: 'Start a heading with “Section” to print it as a section heading on its own line.' },
        ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a paragraph', tint: true, onTap: () => { f.clauses.push({ title: '', text: '' }); p.refresh(); } }))) }, { detent: 'large' });
};

/* ================= Routing and AutoRoute assumptions ================= */
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
CO.routingSpec = () => ({ title: 'Routing assumptions', render: page => { if (!admin()) return locked(); const set = (k, v) => { W[k] = v; WD.changed(); page.refresh(); }, R = data.timeRules;
  const step = (title, sub, detail, value, min, max, fn) => ui.row({ title, subtitle: sub, detail, trailing: ui.stepper(value, min, max, fn) });
  return ui.list(note('The numbers AutoRoute and the board work from. Change any of them and the next route plan uses the new value.'),
    ui.section({ header: 'Start of the day', footer: 'AutoRoute recommends leaving in time to reach the first stop when it opens: the drive, plus the time to get rolling. With nothing else to go on, the day starts at the time above.' },
      ui.quarterRow({ title: 'Drivers start at', optional: false, value: hhmm(W.dayStartMin), onChange: v => { if (v) set('dayStartMin', fmt.fromHHMM(v)); } }),
      step('Time to get rolling', 'Pre-trip check and loading before the truck leaves', W.pretripMin + ' min', W.pretripMin / 5, 0, 18, v => set('pretripMin', v * 5))),
    ui.section({ header: 'Driving and time on site', footer: 'Time on site comes from each customer’s recorded visits. Until a customer has history, a formula is used; purge jobs use the box estimate.' },
      step('Drive-time allowance', 'Added to or taken off the map’s estimate', (W.speedPct === 100 ? 'As estimated' : (W.speedPct > 100 ? '+' : '−') + Math.abs(W.speedPct - 100) + '%'), W.speedPct / 5, 16, 30, v => set('speedPct', v * 5)),
      ui.row({ icon: 'timer', iconColor: 'var(--orange)', title: 'Time on site formulas', subtitle: 'Stops with no history, new setups, purge jobs and each truck’s pace', chevron: true, onTap: () => page.push(WD.ops.siteSpec()) })),
    ui.section({ header: 'Called-off jobs', footer: W.sinkCalledOff !== false ? 'They stay on their day with a line through them, below the stops still to do.' : 'They stay where they were in the list, with a line through them and no stop number.' },
      ui.toggleRow({ title: 'Drop to the bottom of the list', subtitle: 'Canceled, postponed and rescheduled jobs', value: W.sinkCalledOff !== false, onChange: v => { W.sinkCalledOff = v; data.routes.forEach(r => [...new Set(data.jobs.filter(j => j.routeId === r.id).map(j => j.day))].forEach(d => WD.renumber(r.id, d))); WD.changed(); page.refresh(); } })),
    ui.section({ header: 'Ordinary business hours', footer: 'Assumed for a customer with no hours on file, and hours outside these show after the job title.' },
      ui.quarterRow({ title: 'Opens', optional: false, value: W.normalOpen, onChange: v => { if (v) set('normalOpen', v); } }), ui.quarterRow({ title: 'Closes', optional: false, value: W.normalClose, onChange: v => { if (v) set('normalClose', v); } })),
    ui.section({ header: 'Arrival windows given to customers', footer: 'The length of the window AutoRoute gives a customer who asked for one, by the time of day the truck is expected.' },
      [['early', 'Before 10 AM'], ['mid', '10 AM to 1 PM'], ['late', 'After 1 PM']].map(([k, title]) => step(title, null, (W.eta[k] / 60) + (W.eta[k] === 60 ? ' hour' : ' hours'), W.eta[k] / 30, 1, 12, v => { W.eta[k] = v * 30; WD.changed(); page.refresh(); }))),
    ui.section({ header: 'More assumptions', footer: 'These live with the screens they belong to.' },
      ui.row({ title: 'Arrival from GPS', detail: W.arrival === 'button' ? 'Driver taps' : W.dwellMin + ' min near the stop', chevron: true, onTap: () => page.push(WD.workflow.workflowSpec()) }),
      ui.row({ title: 'Stop tracking after', detail: W.shiftCutoff + ' hours on shift', chevron: true, onTap: () => page.push(WD.workflow.workflowSpec()) }),
      ui.row({ title: 'Unpaid break', detail: R.unpaidBreak ? R.unpaidBreak + ' min over 6 hours' : 'None', chevron: true, onTap: () => page.push(WD.timeclock.rulesSpec()) }),
      ui.row({ title: 'Log location stays over', detail: R.stayMinutes + ' min', chevron: true, onTap: () => page.push(WD.timeclock.rulesSpec()) }),
      ui.row({ title: 'Truck start and end places', detail: data.vehicles.length + ' vehicles', subtitle: 'Settings → Vehicles' })));
} });

/* ================= Time off: auto-approval ================= */
/** Called when a request is made. Auto-approves it when the setting is on (and the request is short enough), with the company's message. */
CO.autoApprove = t => { const o = ST.timeOff, days = D.diff(t.to, t.from) + 1; if (!o.auto || (o.limitDays && days > o.limitDays)) return false;
  Object.assign(t, { status: 'approved', decidedBy: 'Auto-approved', auto: true, note: fill(tpl('timeoff').body, { employee: first((q.user(t.userId) || {}).name) }) }); return true; };
CO.timeOffSpec = () => ({ title: 'Time off', render: page => { if (!admin()) return locked(); const o = ST.timeOff, t = tpl('timeoff'); let msg = t.body;
  return ui.list(
    ui.section({ header: 'Requests', footer: o.auto ? 'Requests are approved the moment they are sent and show on the dispatch board. The person sees your message with the approval, and whoever approves time off is still told about each one.' : 'Every request waits for someone with the HR or Manage team permission to approve it.' },
      ui.toggleRow({ title: 'Approve requests automatically', value: o.auto, onChange: v => { o.auto = v; WD.changed(); page.refresh(); } }),
      o.auto && ui.row({ title: 'Only requests up to', subtitle: 'Longer requests wait for approval', detail: o.limitDays ? o.limitDays + (o.limitDays === 1 ? ' day' : ' days') : 'Any length', trailing: ui.stepper(o.limitDays, 0, 14, v => { o.limitDays = v; page.refresh(); }) })),
    o.auto && ui.section({ header: 'Message shown with the approval', footer: 'Shown to the employee under their approved request. {employee} is replaced with their first name.' },
      ui.inputRow({ multiline: true, value: msg, onInput: v => { msg = v; t.body = v; t.editedBy = me(); t.editedAt = +WD.now(); } })),
    ui.section(null, ui.row({ title: 'Team time-off requests', icon: 'calendar', iconColor: 'var(--red)', chevron: true, onTap: () => page.push(WD.x.timeOffSpec()) })));
} });

/* ================= On-my-way notices ================= */
const OMW = [{ value: 'off', label: 'Off' }, { value: 'ask', label: 'Ask: text or call' }, { value: 'text', label: 'Offer to send a text' }, { value: 'call', label: 'Offer to call' }, { value: 'auto', label: 'Send the text automatically' }];
const omwLabel = v => (OMW.find(x => x.value === v) || OMW[0]).label;
const omwMode = job => { const o = ST.onMyWay, a = job.custType && o.byCust[job.custType], b = o.byJob[job.type]; return a || b || o.mode; };
/** After Start driving: show the ETA and offer to text or call the customer, by the company's setting for this job type and customer type. */
CO.onMyWay = job => {
  const mode = omwMode(job), c = job.customerId && q.customer(job.customerId); if (mode === 'off' || !c || job.allDay) return;
  const p = c.contacts.find(x => x.phone) || c.contacts[0]; if (!p || !p.phone) return ui.toast('No phone number on file for an on-my-way notice', 'info.circle', 2600);
  const prev = q.stopList(job.routeId, job.day).filter(j => j.departedAt != null && j.x != null).sort((a, b) => b.departedAt - a.departedAt)[0], from = prev || q.routeEnds(job.routeId, job.day).start;
  const mins = job.x != null && from ? Math.max(3, Math.round((Math.hypot(from.x - job.x, from.y - job.y) * 0.05 + 3) * W.speedPct / 100)) : 10, eta = WD.nowMins() + mins;
  let text = fill(tpl('omw').body, ctxFor(c, { driver: first(me()), eta: fmt.time(eta) }));
  const log = what => { job.events.push({ at: +WD.now(), actor: me(), text: what + ' · ETA ' + fmt.time(eta) }); WD.changed(); };
  if (mode === 'auto') { log('On-my-way text sent to ' + p.name); return ui.toast('On-my-way text sent to ' + first(p.name) + ' · ETA ' + fmt.time(eta), 'message', 2800); }
  setTimeout(() => ui.sheet({ title: 'On my way', leading: [{ label: 'Skip', onTap: pg => pg.dismiss() }],
    render: pg => [h('div.co-eta', h('small', 'Arriving at ' + job.title + ' about'), h('b', fmt.time(eta)), h('span', fmt.dur(mins) + ' drive from ' + (prev ? prev.title : from.name || 'the start'))),
      ui.list(mode !== 'call' && ui.section({ header: 'Text to ' + p.name + ' · ' + fmt.phone(p.phone), footer: 'From the “On my way” template. Change the wording here before sending if you need to.' + (WD.ops ? ' Sent from ' + WD.ops.senderFor(c, S.me, 'text').text + '.' : '') }, ui.inputRow({ multiline: true, value: text, onInput: v => { text = v; } }))),
      h('div.co-acts',
        mode !== 'call' && ui.button('Send text', { icon: 'message', onTap: async () => { if (await ui.run('Sending…', () => log('On-my-way text sent to ' + p.name), { done: 'Text sent', offlineOK: true })) pg.dismiss(); } }),
        mode !== 'text' && ui.button('Call ' + first(p.name), { kind: mode === 'call' ? 'filled' : 'gray', icon: 'phone.fill', onTap: () => { log('Called ' + p.name + ' on the way'); pg.dismiss(); ui.toast('Calling ' + first(p.name) + (WD.ops ? ' from ' + WD.ops.senderFor(c, S.me, 'call').text : ' · ' + fmt.phone(p.phone)), 'phone.fill', 3000); } }),
        ui.button('Not this time', { kind: 'plain', onTap: () => pg.dismiss() }))] }, { detent: 'medium' }), 450);
};
CO.omwSpec = () => ({ title: 'On-my-way notices', render: page => { if (!admin()) return locked(); const o = ST.onMyWay, any = [{ value: '', label: 'Same as above' }].concat(OMW);
  const over = (map, key, title, sub) => ui.pickerRow({ title, subtitle: sub, value: map[key] || '', options: any, onChange: v => { if (v) map[key] = v; else delete map[key]; WD.changed(); page.refresh(); } });
  return ui.list(
    ui.section({ header: 'When a driver taps Start driving', footer: { off: 'Nothing is sent and the driver isn’t asked.', ask: 'The driver sees the ETA and chooses to send the text, call, or skip.', text: 'The driver sees the ETA and the text, and taps Send or Skip.', call: 'The driver sees the ETA and a button to call the customer.', auto: 'The text goes out by itself with the ETA. The driver sees a confirmation.' }[o.mode] },
      ui.pickerRow({ title: 'For most jobs', icon: 'message', iconColor: 'var(--green)', value: o.mode, options: OMW, onChange: v => { o.mode = v; WD.changed(); page.refresh(); } }), tplRow('omw', page)),
    ui.section({ header: 'By job type', footer: 'For example: always text ahead of a purge, never for route service.' }, WD.jobTypes.map(t => over(o.byJob, t.id, t.title))),
    ui.section({ header: 'By customer type', footer: 'A customer type setting wins over the job type.' }, WD.custTypes.map(t => over(o.byCust, t.id, t.title))),
    ui.section({ footer: 'The ETA is the drive time from the last completed stop (or the truck’s start), with your drive-time allowance.' }, ui.row({ title: 'Routing assumptions', chevron: true, onTap: () => page.push(CO.routingSpec()) })));
} });

/* ================= Container barcodes ================= */
const hash = s => { let n = 7; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; };
/** The barcodes on the containers at a job's location (mock: stable codes per customer and container). */
CO.containers = job => { const out = []; (job.items || []).filter(i => WD.CONTAINERS.includes(i.id) && i.id !== 'box' && i.qty > 0).forEach(i => { for (let k = 0; k < i.qty; k++) out.push({ code: 'DS-' + String(10000 + hash((job.customerId || job.title) + i.id + k) % 89999), kind: pbName(i.id) }); }); return out; };
CO.barcodesOn = () => ST.barcodes.on;
/** Scan each container at the stop. scans: [{code, kind, at}] edited in place. */
CO.scanSheet = (job, scans, onDone) => {
  const all = CO.containers(job);
  ui.sheet({ title: 'Scan containers', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], onClose: () => onDone && onDone(),
    render: p => { const left = all.filter(x => !scans.some(s => s.code === x.code)), add = x => { scans.push({ ...x, at: +WD.now() }); p.refresh(); };
      return [h('div.co-scan', left.length ? 'Point the camera at a container’s barcode' : 'All containers scanned'),
        ui.list(ui.section({ header: scans.length + ' of ' + all.length + ' scanned', footer: 'Each scan records the container, the time and the place, and proves the service on the invoice.' },
          all.map(x => { const s = scans.find(y => y.code === x.code); return ui.row({ icon: s ? 'checkmark.circle.fill' : 'barcode', iconPlain: true, iconColor: s ? 'var(--green)' : 'var(--label3)', title: x.code, subtitle: x.kind + (s ? ' · scanned ' + fmt.clock(new Date(s.at)) : ' · not scanned'), trailing: s ? h('button.bi-del', { 'aria-label': 'Remove scan', onclick: () => { scans.splice(scans.indexOf(s), 1); p.refresh(); } }, icon('bi.minus', 22)) : null }); }),
          scans.filter(s => !all.some(x => x.code === s.code)).map(s => ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--orange)', title: s.code, subtitle: 'Entered by hand · not on this customer’s list' })))),
        h('div.co-acts', left.length > 0 && ui.button('Scan next container', { icon: 'barcode', onTap: async () => { const hud = ui.hud('Scanning…'); await WD.delay(500, 800); hud.close(); add(left[0]); } }),
          ui.button('Enter a code by hand', { kind: 'gray', onTap: async () => { const r = await ui.alert({ title: 'Barcode number', message: 'For a label that is worn or won’t scan.', input: { placeholder: 'e.g. DS-41872' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] });
            if (r && r.value && r.text.trim()) { const code = r.text.trim().toUpperCase(), x = all.find(y => y.code === code); add(x || { code, kind: 'Container' }); } } }))]; } }, { detent: 'large' });
};
CO.barcodeSpec = () => ({ title: 'Barcode scanning', render: page => { if (!admin()) return locked(); const o = ST.barcodes, sample = data.jobs.find(j => j.day === today() && CO.containers(j).length);
  return ui.list(
    ui.section({ header: 'Scanning', footer: o.on ? 'Billing details gets a Scan containers step. Each container’s barcode is scanned to prove it was serviced.' : 'For companies that put a barcode on every container. Off: drivers enter quantities as they do now.' },
      ui.toggleRow({ icon: 'barcode', iconColor: 'var(--indigo)', title: 'Scan container barcodes at each stop', value: o.on, onChange: v => { o.on = v; WD.changed(); page.refresh(); } }),
      o.on && ui.toggleRow({ title: 'Require every container to be scanned', subtitle: 'Or a reason, when a label is missing or damaged', value: o.require, onChange: v => { o.require = v; WD.changed(); } }),
      o.on && ui.toggleRow({ title: 'Print the scans on the invoice', subtitle: 'Container numbers and the time each was scanned', value: o.onInvoice, onChange: v => { o.onInvoice = v; WD.changed(); } })),
    ui.section({ header: 'Hard drives', footer: 'Some customers need every drive’s serial number recorded and some don’t, so each job with hard drives has its own “Scan each drive” switch, on the job and again in billing details. This sets how that switch starts on a new job.' },
      ui.toggleRow({ icon: 'barcode', iconColor: 'var(--gray)', title: 'New hard drive jobs start with scanning on', value: !!o.hddDefault, onChange: v => { o.hddDefault = v; WD.changed(); } })),
    o.on && sample && ui.section({ header: 'Example · ' + sample.title, footer: 'Barcodes are assigned to a customer’s containers when they are delivered, and stay on the customer’s record.' }, CO.containers(sample).slice(0, 4).map(x => ui.row({ icon: 'barcode', iconPlain: true, title: x.code, subtitle: x.kind }))));
} });

/* ================= Bookkeeping: payment status ================= */
const unpaidRecs = () => (data.invoices || []).filter(r => r.status !== 'Paid' && r.status !== 'Draft');
/** Ask the bookkeeping program which open invoices have been paid there, and mark them paid here. manual: show progress. Returns the invoices updated. */
CO.syncPayments = async manual => {
  if (!CO.hasBooks()) { if (manual) ui.toast('No bookkeeping program is connected', 'info.circle'); return []; }
  const name = CO.booksName(), apply = () => { const hit = unpaidRecs().filter(r => r.ext); hit.forEach(r => { const job = r.jobId && q.job(r.jobId); WD.workflow.applyPaid(r, job, r.ext.method + ' · recorded in ' + name, r.amount, r.ext.at); r.paidVia = name; }); ST.books.lastCheck = +WD.now(); return hit; };
  let hit = [];
  if (manual) { if (!await ui.run('Checking ' + unpaidRecs().length + ' open invoices with ' + name + '…', () => { hit = apply(); }, { done: 'Checked' })) return []; }
  else { if (S.offline) return []; hit = apply(); }
  if (hit.length) ui.banner({ title: hit.length === 1 ? hit[0].number + ' was paid' : hit.length + ' invoices were paid', text: (hit.length === 1 ? (q.customer(hit[0].customerId) || {}).name + ' paid ' + money(hit[0].amount) : hit.map(r => r.number).join(', ')) + ' in ' + name + '. Marked paid here.', icon: 'dollarsign.circle', color: 'var(--green)', duration: 6500, onTap: () => WD.nav.switchTab('invoices') });
  else if (manual) ui.toast('No new payments in ' + name, 'checkmark', 2400);
  WD.changed(); return hit;
};
/** Row at the top of the Invoices list: when payment status was last checked, and a way to check now. */
CO.booksSection = () => { if (!CO.hasBooks()) return null; const b = ST.books, n = unpaidRecs().length;
  return ui.section(null, ui.row({ icon: 'sync', iconColor: 'var(--green)', title: 'Payment status · ' + CO.booksName(), subtitle: n + ' open · checked ' + fmt.rel(b.lastCheck).toLowerCase() + (b.autoPaid ? ' · every ' + b.everyMin + ' min' : ' · automatic check is off'),
    trailing: ui.button('Check now', { kind: 'gray', small: true, block: false, onTap: () => CO.syncPayments(true) }) })); };
CO.booksSpec = () => ({ title: 'Invoicing and bookkeeping', render: page => { if (!admin()) return locked(); const b = ST.books, name = CO.booksName(), on = CO.hasBooks(), integ = on && (WD.integrations || []).find(x => x.id === b.provider);
  return ui.list(
    ui.section({ header: 'Invoicing and bookkeeping service', footer: on ? 'Invoices created here are sent to ' + name + ', and payments recorded there come back. ' + (integ && integ.connected ? '' : 'Connect the ' + name + ' account below to start. ') + 'Every service plugs in the same way, so another one can be added later without changing how invoices work here.' : 'Invoices and payments are kept only in Work Dispatcher.' },
      ui.pickerRow({ title: 'We use', icon: 'doc.text', iconColor: 'var(--green)', value: b.provider, options: BOOKS, onChange: v => { b.provider = v; WD.changed(); page.refresh(); } }),
      integ && ui.row({ icon: 'link', iconColor: integ.connected ? 'var(--green)' : 'var(--orange)', title: integ.connected ? name + ' is connected' : 'Connect ' + name, subtitle: integ.connected ? 'Tap to see the connection or disconnect' : 'Not connected yet — invoices stay here until it is', badge: ui.badge(integ.connected ? 'Connected' : 'Not connected', integ.connected ? 'var(--green)' : 'var(--orange)'), chevron: true, onTap: () => page.push(WD.screens.settings.integrationSpec(integ)) })),
    on && ui.section({ header: 'Unpaid invoices', footer: 'Every open invoice is checked against ' + name + '. When a customer has paid there (portal, card, ACH or a payment the office entered) the invoice is marked paid here with the method and date, and the job shows as paid. Last checked ' + fmt.rel(b.lastCheck).toLowerCase() + '.' },
      ui.toggleRow({ title: 'Mark invoices paid automatically', subtitle: 'When ' + name + ' shows them paid', value: b.autoPaid, onChange: v => { b.autoPaid = v; WD.changed(); page.refresh(); } }),
      b.autoPaid && ui.pickerRow({ title: 'Check', value: b.everyMin, options: [{ value: 5, label: 'Every 5 minutes' }, { value: 15, label: 'Every 15 minutes' }, { value: 60, label: 'Every hour' }, { value: 1440, label: 'Once a day' }], onChange: v => { b.everyMin = v; page.refresh(); } }),
      ui.row({ title: 'Check now', tint: true, subtitle: unpaidRecs().length + ' open invoices', onTap: async () => { await CO.syncPayments(true); page.refresh(); } })),
    on && ui.section({ header: 'Customer portal', footer: 'Customers add or change a credit card or bank account (ACH) themselves in the ' + name + ' portal. Card and bank details are never typed into Work Dispatcher or written on a service agreement.' },
      ui.row({ title: 'Portal link in emails and agreements', detail: '{portal}' })));
} });

/* ================= Reviews and customer feedback ================= */
const RV = ST.reviews, positive = fb => fb.rating >= RV.positiveFrom;
const stars = n => h('span.co-stars', '★'.repeat(n), h('i', '★'.repeat(5 - n)));
data.feedback = [];
/** Record a customer's answer to the follow-up text (or a rating given in person) and send the right reply. */
CO.addFeedback = o => { const c = q.customer(o.customerId), drv = o.driverName || 'the driver', pos = o.rating >= RV.positiveFrom, ctx = ctxFor(c, { driver: first(drv) });
  const fb = { id: uid('fb'), customerId: o.customerId, jobId: o.jobId || null, driverName: drv, at: o.at || +WD.now(), rating: o.rating, comment: o.comment || '', via: o.via || 'text', asked: fill(tpl('rvask').body, ctx),
    reply: fill(tpl(pos ? 'rvpos' : 'rvneg').body, ctx), sites: pos ? RV.sites.filter(s => s.on && s.url).map(s => s.name) : [], status: pos ? 'thanked' : 'open', handledBy: null, handledAt: null, handledNote: '' };
  data.feedback.push(fb); return fb; };
(function seed() {
  const done = data.jobs.filter(j => j.status === 'completed' && j.customerId && j.day <= today() && q.driverFor(j.routeId)).sort((a, b) => b.day.localeCompare(a.day) || b.seq - a.seq), seen = new Set();
  const picks = done.filter(j => !seen.has(j.customerId) && seen.add(j.customerId)).slice(0, 9);
  [[5, 'Marcus was great, in and out in ten minutes.'], [2, 'Driver came after we had closed for lunch and we had to wait until 2. Nobody called ahead.'], [5, ''], [4, 'Friendly and quick. Truck was a little loud in the lot.'], [5, 'Always on time. Thank you!'], [3, 'Fine, but the console was left unlocked.'], [5, 'Love that we get the certificate right away.']]
    .forEach(([rating, comment], i) => { const j = picks[i]; if (!j) return; const fb = CO.addFeedback({ customerId: j.customerId, jobId: j.id, driverName: q.driverFor(j.routeId).name, rating, comment: comment.replace('Marcus', first(q.driverFor(j.routeId).name)), at: +D.parse(j.day) + (15 + i) * 36e5 - (j.day === today() ? 12 * 36e5 : 0) });
      if (rating === 3) Object.assign(fb, { status: 'handled', handledBy: 'Colleen Abbott', handledAt: fb.at + 5 * 36e5, handledNote: 'Called and apologized. Reminded the driver to check the lock.' }); });
  data.feedback.forEach(fb => { if (fb.at > +WD.now()) fb.at = +WD.now() - 40 * 60000; });
})();
CO.feedbackOpen = () => data.feedback.filter(f => f.status === 'open').length;
const fbState = { filter: 'all' };
function feedbackDetail(fb) {
  return { title: 'Feedback', render: page => { const c = q.customer(fb.customerId), p = (c && c.contacts[0]) || {}, pos = positive(fb);
    return [h('div', { style: 'padding:14px 16px 0;display:flex;align-items:center;gap:10px' }, h('span.headline', c ? c.name : 'Customer'), h('span.spacer'), stars(fb.rating)),
      h('div.footnote', { style: 'padding:2px 16px 4px' }, (p.name || 'Customer') + ' · service by ' + fb.driverName + ' · ' + fmt.rel(fb.at).toLowerCase() + (fb.via === 'qr' ? ' · from the QR code' : ' · reply to the follow-up text')),
      fb.via !== 'qr' && h('div.co-bubble', fb.asked), h('div.co-bubble.in', fb.rating + (fb.comment ? ' — ' + fb.comment : '')), h('div.co-bubble', fb.reply),
      ui.list(
        ui.section({ header: pos ? 'Review request sent' : 'Needs a personal follow-up', footer: pos ? 'Sent automatically with links to: ' + (fb.sites.join(', ') || 'no review sites are switched on') + '.' : 'The apology above went out automatically. Call the customer, then mark this handled with a note about what was done.' },
          !pos && fb.status === 'open' && ui.row({ icon: 'phone.fill', iconPlain: true, title: 'Call ' + (p.name || 'the customer'), subtitle: p.phone ? fmt.phone(p.phone) : 'No phone on file', tint: true, onTap: () => ui.toast('Calling ' + first(p.name) + '…', 'phone.fill') }),
          !pos && fb.status === 'open' && ui.row({ icon: 'checkmark.circle', iconPlain: true, title: 'Mark handled…', tint: true, onTap: async () => { const r = await ui.alert({ title: 'What was done?', input: { placeholder: 'e.g. Called and credited the visit' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] });
            if (r && r.value) { Object.assign(fb, { status: 'handled', handledBy: me(), handledAt: +WD.now(), handledNote: r.text.trim() }); WD.changed(); page.refresh(); ui.toast('Marked handled', 'checkmark'); } } }),
          fb.status === 'handled' && ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Handled by ' + fb.handledBy, subtitle: (fb.handledNote || 'No note') + ' · ' + fmt.rel(fb.handledAt).toLowerCase() }),
          pos && ui.row({ icon: 'star.fill', iconPlain: true, iconColor: 'var(--orange)', title: 'Shared with ' + first(fb.driverName), subtitle: 'Drivers see their positive feedback on the Shift tab' })),
        ui.section(null, c && WD.can('crm.view') && ui.row({ title: 'Open customer', chevron: true, onTap: () => WD.screens.customers.openDetail(c.id) }), fb.jobId && q.job(fb.jobId) && ui.row({ title: 'Open the visit', chevron: true, onTap: () => WD.screens.jobs.openDetails(fb.jobId) })))];
  } };
}
/** The feedback list: used as a page and inside the CRM tab. */
CO.feedbackView = page => {
  const all = data.feedback.slice().sort((a, b) => b.at - a.at), n = all.length, avg = n ? all.reduce((s, f) => s + f.rating, 0) / n : 0, open = all.filter(f => f.status === 'open');
  const list = fbState.filter === 'open' ? open : fbState.filter === 'pos' ? all.filter(positive) : fbState.filter === 'neg' ? all.filter(f => !positive(f)) : all, by = {};
  all.forEach(f => { (by[f.driverName] = by[f.driverName] || []).push(f.rating); });
  return ui.list(
    ui.section(null, h('div.co-tiles', h('div', h('b', n ? avg.toFixed(1) : '—'), h('span', 'Average')), h('div', h('b', String(n)), h('span', 'Replies')), h('div', h('b', n ? Math.round(all.filter(positive).length / n * 100) + '%' : '—'), h('span', 'Positive')), h('div', h('b', { style: open.length ? 'color:var(--red)' : null }, String(open.length)), h('span', 'To follow up')))),
    h('div', { style: 'padding:14px 16px 0' }, ui.segmented([{ value: 'all', label: 'All' }, { value: 'open', label: 'To follow up' }, { value: 'pos', label: 'Positive' }, { value: 'neg', label: 'Negative' }], fbState.filter, v => { fbState.filter = v; page.refresh(); })),
    ui.section({ header: list.length + (list.length === 1 ? ' reply' : ' replies'), footer: RV.on ? 'Replies to the follow-up text sent after service, and ratings left from the QR code. ' + RV.positiveFrom + ' stars and up get the review request; anything lower gets the apology and waits here for a call.' : 'The follow-up text is switched off in Settings → Reviews and feedback.' },
      list.map(f => { const c = q.customer(f.customerId); return ui.row({ title: h('span', { style: 'display:flex;align-items:center;gap:8px' }, h('span', { style: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, c ? c.name : 'Customer'), stars(f.rating)),
        subtitle: [f.comment ? '“' + f.comment + '”' : 'No comment', first(f.driverName) + ' · ' + fmt.rel(f.at).toLowerCase()].map(x => h('div', x)), badge: f.status === 'open' ? ui.badge('Call', 'var(--red)') : f.status === 'handled' ? ui.badge('Handled', 'var(--green)') : null, chevron: true, onTap: () => WD.nav.push(feedbackDetail(f)) }); }),
      !list.length && ui.row({ title: 'Nothing here' })),
    Object.keys(by).length > 0 && ui.section('By driver', Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([name, rs]) => ui.row({ leading: ui.avatar(name, { size: 32 }), title: name, subtitle: rs.length + (rs.length === 1 ? ' reply' : ' replies'), detail: h('span', (rs.reduce((s, x) => s + x, 0) / rs.length).toFixed(1) + ' ', h('span.co-stars', '★')) }))),
    ui.section(null, ui.row({ icon: 'qrcode', iconColor: 'var(--indigo)', title: 'Show the review QR code', chevron: true, onTap: () => WD.nav.push(CO.qrSpec()) }),
      admin() && ui.row({ icon: 'gearshape', iconColor: 'var(--gray)', title: 'Reviews and feedback settings', chevron: true, onTap: () => WD.nav.push(CO.reviewsSpec()) })));
};
CO.feedbackSpec = () => ({ title: 'Customer feedback', render: page => WD.can('crm.view') || WD.can('leads.view') ? CO.feedbackView(page) : ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Feedback is for people with customer or CRM access.' }) });

/* ----- QR code for reviews in person ----- */
/** A stand-in pattern shown until the company attaches its own QR code image. It is not scannable and is labeled as a sample. */
function sampleQR() { const n = 25, cells = []; let s = hash(RV.qr.url || 'qr');
  const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7), fOn = (x, y) => { const fx = x < 7 ? x : x - (n - 7), fy = y < 7 ? y : y - (n - 7); return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { s = (s * 1103515245 + 12345) >>> 0; if (finder(x, y) ? fOn(x, y) : (s >> 16) % 2) cells.push('<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02"/>'); }
  return h('span', { style: 'display:block;width:100%;height:100%;opacity:.5', html: '<svg viewBox="0 0 ' + n + ' ' + n + '" fill="#1c1c1e" shape-rendering="crispEdges">' + cells.join('') + '</svg>' }); }
const qrBox = () => h('div.box', RV.qr.image ? h('img', { src: RV.qr.image, alt: 'Review QR code' }) : [sampleQR(), h('div.sample', h('span', 'SAMPLE'))]);
CO.qrSpec = () => ({ title: 'Leave a review', render: () => [h('div.co-qr', h('h3', RV.qr.caption || 'Scan to leave a review'), qrBox(), h('p', S.me && S.me.role === 'driver' ? 'Your review helps ' + first(me()) + ' and our team. Thank you!' : 'Reviews help our drivers and our small team. Thank you!'), h('p', RV.qr.url || 'No link set')),
  !RV.qr.image && h('div', { style: 'padding:6px 4px 0' }, ui.note('This is a sample pattern and will not scan. Attach your own QR code image in Settings → Reviews and feedback.')),
  h('div.co-acts', ui.button('Text the link instead', { kind: 'gray', icon: 'message', onTap: () => ui.toast('Opens a text with ' + (RV.qr.url || 'the review link'), 'message', 2400) }))] });
/** Shift tab: a quick way for a driver to show the QR code to a customer. */
CO.qrSection = () => RV.on ? ui.section({ header: 'Reviews', footer: 'Hold the iPhone out so a happy customer can scan it with their camera.' }, ui.row({ icon: 'qrcode', iconColor: 'var(--indigo)', title: 'Show the review QR code', chevron: true, onTap: () => WD.nav.push(CO.qrSpec()) })) : null;
function editSite(site, page) {
  const f = site ? { name: site.name, url: site.url } : { name: '', url: '' };
  ui.sheet({ title: site ? 'Review site' : 'Add a review site', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!f.name.trim()) return ui.toast('Add a name', 'note'); if (site) Object.assign(site, { name: f.name.trim(), url: f.url.trim() }); else RV.sites.push({ id: uid('rs'), name: f.name.trim(), url: f.url.trim(), on: !!f.url.trim() }); WD.changed(); p.dismiss(); page.refresh(); } }],
    render: p => ui.list(ui.section({ footer: 'Paste the link that opens your “write a review” page on that site. It is added to the text sent after a positive reply.' }, ui.inputRow({ label: 'Name', placeholder: 'e.g. Facebook, BBB, Nextdoor', value: f.name, onInput: v => { f.name = v; } }), ui.inputRow({ label: 'Link', type: 'url', caps: 'off', placeholder: 'https://…', value: f.url, onInput: v => { f.url = v; } })),
      site && ui.section(null, ui.row({ title: 'Remove this site', destructive: true, onTap: () => { RV.sites = ST.reviews.sites = RV.sites.filter(x => x !== site); WD.changed(); p.dismiss(); page.refresh(); } }))) }, { detent: 'medium' });
}
CO.reviewsSpec = () => ({ title: 'Reviews and feedback', render: page => { if (!admin()) return locked();
  const WHEN = [{ value: 'first', label: 'After a customer’s first service' }, { value: 'every', label: 'After every service' }, { value: 'nth', label: 'After every few services' }, { value: 'purge', label: 'After one-time and purge jobs only' }];
  return ui.list(
    ui.section({ header: 'Follow-up text after service', footer: RV.on ? 'Asks how the service and the driver were, and names the driver. Replies show up under Customer feedback.' : 'No follow-up text is sent.' },
      ui.toggleRow({ icon: 'message', iconColor: 'var(--green)', title: 'Send a follow-up text', value: RV.on, onChange: v => { RV.on = v; WD.changed(); page.refresh(); } }),
      RV.on && ui.pickerRow({ title: 'Send it', value: RV.when, options: WHEN, onChange: v => { RV.when = v; page.refresh(); } }),
      RV.on && RV.when === 'nth' && ui.row({ title: 'Every', detail: RV.nth + ' services', trailing: ui.stepper(RV.nth, 2, 26, v => { RV.nth = v; page.refresh(); }) }),
      RV.on && ui.row({ title: 'How long after the visit', detail: RV.delayHours ? RV.delayHours + (RV.delayHours === 1 ? ' hour' : ' hours') : 'Right away', trailing: ui.stepper(RV.delayHours, 0, 48, v => { RV.delayHours = v; page.refresh(); }) }),
      RV.on && tplRow('rvask', page)),
    RV.on && ui.section({ header: 'When the customer replies', footer: 'A reply of ' + RV.positiveFrom + ' or higher is positive: the customer is thanked and asked for a public review. Anything lower gets the apology, and the reply waits under Customer feedback for a call.' },
      ui.row({ title: 'Positive means', detail: RV.positiveFrom + ' stars or more', trailing: ui.stepper(RV.positiveFrom, 3, 5, v => { RV.positiveFrom = v; page.refresh(); }) }), tplRow('rvpos', page), tplRow('rvneg', page)),
    ui.section({ header: 'Review sites', footer: 'Sites that are switched on and have a link are included in the review request.' },
      RV.sites.map(s => ui.row({ title: s.name, subtitle: s.url || 'No link yet — tap to add', trailing: ui.toggle(s.on, v => { if (v && !s.url) { ui.toast('Add the link first', 'link'); editSite(s, page); return false; } s.on = v; WD.changed(); }), onTap: () => editSite(s, page) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a review site', tint: true, onTap: () => editSite(null, page) })),
    ui.section({ header: 'QR code for reviews in person', footer: 'Make the QR code in any free QR program, pointing at the link below, and attach the image here. Drivers show it from the Shift tab.' },
      ui.inputRow({ label: 'Link', type: 'url', caps: 'off', placeholder: 'https://…', value: RV.qr.url, onInput: v => { RV.qr.url = v.trim(); } }), ui.inputRow({ label: 'Heading', placeholder: 'Scan to leave a review', value: RV.qr.caption, onInput: v => { RV.qr.caption = v; } }),
      h('div.row.tappable.co-file', h('div.row-icon.plain', { style: { color: 'var(--tint)' } }, icon('photo', 24)), h('div.row-main', h('div.row-title.tint', RV.qr.image ? 'Replace the QR code image' : 'Attach a QR code image'), h('div.row-sub', RV.qr.image ? 'Attached · ' + (RV.qr.fileName || 'image') : 'PNG or JPEG from your QR program')),
        h('input', { type: 'file', accept: 'image/*', 'aria-label': 'QR code image', onchange: e => { const file = e.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { RV.qr.image = rd.result; RV.qr.fileName = file.name; WD.changed(); page.refresh(); ui.toast('QR code attached', 'checkmark'); }; rd.readAsDataURL(file); } })),
      RV.qr.image && ui.row({ title: 'Remove the image', destructive: true, onTap: () => { RV.qr.image = null; page.refresh(); } }),
      ui.row({ icon: 'qrcode', iconPlain: true, title: 'Preview what the customer sees', tint: true, chevron: true, onTap: () => page.push(CO.qrSpec()) })),
    ui.section(null, ui.row({ icon: 'star', iconColor: 'var(--orange)', title: 'Customer feedback', detail: (n => n ? n + ' to follow up' : String(data.feedback.length))(CO.feedbackOpen()), chevron: true, onTap: () => page.push(CO.feedbackSpec()) })));
} });

/* ================= CRM settings: features, lead sources, territories ================= */
const CRM = ST.crm;
const REGIONS = { North: '78641', East: '78642', South: '78644', West: '78645' };
CO.regionOf = c => { const l = (c.locations && c.locations[0]) || {}, dx = (l.x || 500) - 505, dy = (l.y || 500) - 520; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'East' : 'West') : (dy > 0 ? 'South' : 'North'); };
CO.zipOf = c => c.zip || REGIONS[CO.regionOf(c)];
CO.areaOf = c => { const p = (c.contacts || []).find(x => x.phone); return p ? fmt.phoneDigits(p.phone).slice(0, 3) : ''; };
/** Which leads a person may see: everything with CRM: all territories, otherwise their regions, ZIP codes or area codes (or just the leads they own). */
CO.territory = u => (u && CRM.territories[u.id]) || { mode: 'own', values: [] };
CO.seesAll = () => WD.can('leads.all') || !CRM.features.territories;
CO.inTerritory = c => { if (CO.seesAll()) return true; const t = CO.territory(S.me); if (c.owner === S.me.id) return true;
  return t.mode === 'zip' ? t.values.includes(CO.zipOf(c)) : t.mode === 'area' ? t.values.includes(CO.areaOf(c)) : t.mode === 'region' ? t.values.includes(CO.regionOf(c)) : false; };
CO.territoryText = u => { const t = CO.territory(u); return t.mode === 'own' || !t.values.length ? 'Only leads assigned to them' : ({ zip: 'ZIP ', area: 'Area code ', region: '' })[t.mode] + t.values.join(', '); };
const FEATURES = [['followups', 'Follow-up templates', 'Send a ready-made follow-up, suggested by stage and time since the last contact'], ['reminders', 'Follow-up reminders', 'A lead with no reply comes back as due after a set number of days'], ['quotes', 'Quotes and bids', 'Write, send and track quotes and bids from a lead'],
  ['referrals', 'Referral tracking', 'Who referred whom, and whether they were thanked'], ['territories', 'Territories', 'Limit some people to leads in certain regions, ZIP codes or area codes'], ['sources', 'Leads by source', 'Counts of leads and wins from each source'], ['feedback', 'Customer feedback in the CRM tab', 'Replies to the follow-up text after service']];
CO.SOURCES = [['phone', 'Phone calls', 'phone.fill', 'A call from an unknown number on a tracked line'], ['text', 'Text messages', 'message', 'A text from an unknown number'], ['email', 'Email', 'envelope', 'A new sender to the shared mailbox'], ['form', 'Website form', 'doc.text', 'Form fills on your website'], ['yelp', 'Yelp', 'star', 'A quote request or message on your Yelp page. You are told right away; the reply goes through Yelp'],
  ['sheet', 'Google Sheets', 'list.bullet', 'New rows in a leads spreadsheet'], ['manual', 'Manual entry', 'pencil', 'Typed in by your team'], ['referral', 'Referrals', 'person.2', 'Sent by a customer or partner']];
function territorySheet(u, page) {
  const t = { ...CO.territory(u), values: CO.territory(u).values.slice() }, opts = { zip: Object.values(REGIONS), area: ['512', '737'], region: Object.keys(REGIONS) }; let extra = '';
  ui.sheet({ title: u.name, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { extra.split(/[,\s]+/).map(x => x.trim()).filter(Boolean).forEach(x => { if (!t.values.includes(x)) t.values.push(x); }); CRM.territories[u.id] = t; WD.changed(); p.dismiss(); page.refresh(); } }],
    render: p => ui.list(ui.section({ footer: 'They always see leads assigned to them. This adds every lead in the places you choose.' }, ui.pickerRow({ title: 'Also sees leads by', value: t.mode, options: [{ value: 'own', label: 'Nothing more' }, { value: 'region', label: 'Region' }, { value: 'zip', label: 'ZIP code' }, { value: 'area', label: 'Phone area code' }], onChange: v => { t.mode = v; t.values = []; p.refresh(); } })),
      t.mode !== 'own' && ui.section({ header: { zip: 'ZIP codes', area: 'Area codes', region: 'Regions' }[t.mode] }, [...new Set(opts[t.mode].concat(t.values))].map(v => ui.toggleRow({ title: v + (t.mode === 'zip' && Object.keys(REGIONS).find(k => REGIONS[k] === v) ? ' · ' + Object.keys(REGIONS).find(k => REGIONS[k] === v) : ''), value: t.values.includes(v), onChange: on => { t.values = on ? t.values.concat(v) : t.values.filter(x => x !== v); } })),
        t.mode !== 'region' && ui.inputRow({ label: 'Add others', placeholder: t.mode === 'zip' ? '78650, 78651' : '830', inputmode: 'numeric', value: extra, onInput: v => { extra = v; } }))) }, { detent: 'large' });
}
CO.crmSpec = () => ({ title: 'CRM and leads', render: page => { if (!admin()) return locked(); const people = data.users.filter(u => u.status === 'active' && (u.perms || WD.roles[u.role].perms).includes('leads.view')), all = u => (u.perms || WD.roles[u.role].perms).includes('leads.all');
  return ui.list(note('Switch on the parts of the CRM your company uses. Anything switched off disappears from the CRM tab.'),
    ui.section('Features', FEATURES.map(([k, title, sub]) => ui.toggleRow({ title, subtitle: sub, value: CRM.features[k], onChange: v => { CRM.features[k] = v; WD.changed(); page.refresh(); } }))),
    CRM.features.reminders && ui.section({ footer: 'After a follow-up with no reply, the lead shows under Follow-up due again this many days later.' }, ui.row({ title: 'Remind again after', detail: CRM.remindDays + (CRM.remindDays === 1 ? ' day' : ' days'), trailing: ui.stepper(CRM.remindDays, 1, 30, v => { CRM.remindDays = v; page.refresh(); }) })),
    ui.section({ header: 'Where leads come from', footer: 'Each source that is on creates leads by itself and tags them, so referrals, quotes and wins can be counted by source. Phone, text, email, Yelp and Sheets need their connection in Settings → Integrations.' },
      CO.SOURCES.map(([k, title, ic, sub]) => ui.toggleRow({ icon: ic, iconColor: 'var(--teal)', title, subtitle: sub, value: CRM.sources[k], onChange: v => { CRM.sources[k] = v; WD.changed(); } }))),
    CRM.features.territories && ui.section({ header: 'Who sees which leads', footer: 'People with “CRM: all territories” see every lead. Give or take that permission, and the CRM tab itself, in Team and roles.' },
      people.map(u => ui.row({ leading: ui.avatar(u.name, { size: 34 }), title: u.name, subtitle: all(u) ? 'All leads' : CO.territoryText(u), badge: all(u) ? ui.badge('All', 'var(--green)') : ui.badge('Limited', 'var(--orange)'), chevron: !all(u), onTap: all(u) ? null : () => territorySheet(u, page) })),
      !people.length && ui.row({ title: 'Nobody has the CRM permission yet' })),
    CRM.features.referrals && ui.section({ header: 'Referral thank-you', footer: 'What a customer gets when someone they referred signs up. Shown on the referral and used in the thank-you text.' }, ui.inputRow({ value: CRM.referralReward, placeholder: 'e.g. $25 credit', onInput: v => { CRM.referralReward = v; } }), tplRow('refthanks', page)),
    CRM.features.followups && ui.section('Follow-up wording', ['lead1', 'lead2', 'lead3', 'quote1', 'lead4'].map(id => tplRow(id, page))));
} });

/* ================= The hub: Settings and assumptions ================= */
CO.hubSpec = () => ({ title: 'Settings and assumptions', render: page => { if (!admin()) return locked(); const push = s => page.push(s), R = data.timeRules, tc = WD.timeclock;
  const row = (ic, color, title, detail, spec, sub) => ui.row({ icon: ic, iconColor: color, title, subtitle: [detail && h('div', { style: 'color:var(--label);font-weight:500' }, detail), sub && h('div', sub)], chevron: true, onTap: () => push(spec()) });
  return ui.list(note('Every assumption the app makes for ' + org().name + ' can be changed here. Each page says what the setting does and where it shows up.'),
    ui.section('Routes and drivers',
      row('route', 'var(--blue)', 'Routing assumptions', fmt.time(W.dayStartMin) + ' · ' + W.pretripMin + ' min to roll', CO.routingSpec, 'Start time, time to get rolling, drive time, arrival windows, called-off jobs'),
      row('timer', 'var(--orange)', 'Time on site', data.siteRules.route.min + ' min minimum · new setup +' + data.siteRules.setupExtra, () => WD.ops.siteSpec(), 'Formulas for stops with no history, purge jobs, and each truck’s pace'),
      row('calendar', 'var(--red)', 'Holidays and schedule changes', ST.holidays.suggest ? 'Suggestions on' : 'Suggestions off', () => WD.ops.schedSpec(), 'Mark a holiday and approve where its jobs move; one-time moves'),
      row('message', 'var(--green)', 'On-my-way notices', omwLabel(ST.onMyWay.mode), CO.omwSpec, 'Text or call the customer with the ETA at Start driving'),
      row('barcode', 'var(--indigo)', 'Barcode scanning', ST.barcodes.on ? 'Containers on' : 'Containers off', CO.barcodeSpec, 'Containers at each stop; hard drive serial numbers by job'),
      row('checklist', 'var(--indigo)', 'Field workflow', '', () => WD.workflow.workflowSpec(), 'Arrival, Complete stop, invoices, job titles')),
    ui.section('Payroll and time off',
      row('dollarsign.circle', 'var(--green)', 'Pay period and payday', tc ? (p => fmt.day(p.from, 'md') + ' – ' + fmt.day(p.to, 'md'))(tc.payPeriod(0)) : '', () => tc.rulesSpec(), 'How often, the payday, overtime rules, breaks'),
      row('calendar', 'var(--red)', 'Time off', ST.timeOff.auto ? 'Auto-approve' : 'Needs approval', CO.timeOffSpec, 'Approve requests automatically, with your message')),
    ui.section('Customers and money',
      row('doc.text', 'var(--teal)', 'Templates', String(data.templates.length + 1), CO.templatesSpec, 'Every text, email, letter and the service agreement'),
      row('sync', 'var(--green)', 'Invoicing and bookkeeping', CO.booksName(), CO.booksSpec, 'Choose the service, connect it, and mark invoices paid from it'),
      WD.r8 && row('shippingbox', 'var(--orange)', 'Purge pricing', WD.r8.pricingLabel(), () => WD.r8.pricingSpec(), 'By the box or by the 65-gallon bin, and how many boxes fit in a bin'),
      WD.r9 && row('percent', 'var(--red)', 'Sales tax', WD.r9.taxLabel(), () => WD.r9.taxSpec(), 'A tax rate, which items are taxable and which customers are exempt'),
      row('tag', 'var(--teal)', 'Items, services and fees', data.priceBook.length + ' items', () => WD.ops.itemsSpec(), 'Add, edit and delete what you charge for, with base prices'),
      row('checkmark.circle', 'var(--green)', 'Job confirmations', WD.ops.confirmLabel(), () => WD.ops.confirmSpec(), 'Text or email the customer when a new job is scheduled'),
      row('phone.fill', 'var(--blue)', 'Calls, texts and email', WD.ops.commsLabel(), () => WD.ops.commsSpec(), 'Which number and address messages to customers come from'),
      row('star', 'var(--orange)', 'Reviews and feedback', ST.reviews.on ? 'On' : 'Off', CO.reviewsSpec, 'Follow-up text, review sites, QR code'),
      row('funnel', 'var(--purple)', 'CRM and leads', Object.values(CRM.features).filter(Boolean).length + ' features on', CO.crmSpec, 'Features, lead sources, territories'),
      row('tag', 'var(--pink)', 'Job types and fields', '', () => WD.admin.typesSpec(), 'Fields asked and required')),
    WD.biz && WD.biz.hubSection(row),
    ui.section('Company', row('lock', 'var(--gray)', 'Sign-in and security', '', () => WD.admin.signInSpec()), WD.r8 && row('share', 'var(--teal)', 'Export and backup', '', () => WD.r8.exportSpec(), 'Download your information, and automatic backups'), ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Location stays', subtitle: 'Logged after ' + R.stayMinutes + ' minutes in one place', chevron: true, onTap: () => push(tc.rulesSpec()) })));
} });

/* ================= Control panel ================= */
const openSet = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
WD.panel.addJump('Settings and assumptions', () => openSet(CO.hubSpec()));
WD.panel.addJump('Templates', () => openSet(CO.templatesSpec()));
WD.panel.addJump('Customer feedback', () => { WD.nav.switchTab(WD.can('leads.view') ? 'crm' : 'settings'); WD.nav.push(CO.feedbackSpec()); });
WD.panel.addJump('Review QR code', () => { WD.nav.switchTab('shift'); WD.nav.push(CO.qrSpec()); });
const lastVisit = () => data.jobs.filter(j => j.status === 'completed' && j.customerId && j.day === today() && q.driverFor(j.routeId)).sort((a, b) => (b.departedAt || 0) - (a.departedAt || 0)).find(j => !data.feedback.some(f => f.jobId === j.id)) || data.jobs.find(j => j.status === 'completed' && j.customerId && q.driverFor(j.routeId));
const reply = (rating, comment) => { const j = lastVisit(); if (!j) return ui.toast('No completed visit to reply about', 'info.circle'); const drv = q.driverFor(j.routeId).name, fb = CO.addFeedback({ customerId: j.customerId, jobId: j.id, driverName: drv, rating, comment: comment.replace('{driver}', first(drv)) }), c = q.customer(j.customerId); WD.changed();
  ui.banner({ title: (rating >= RV.positiveFrom ? 'Positive feedback · ' : 'Negative feedback · ') + rating + ' of 5', text: c.name + ': ' + (fb.comment || 'no comment') + (rating >= RV.positiveFrom ? ' Review request sent.' : ' Apology sent. Needs a call.'), icon: 'star.fill', color: rating >= RV.positiveFrom ? 'var(--green)' : 'var(--red)', duration: 7000, onTap: () => { WD.nav.switchTab(WD.can('leads.view') ? 'crm' : 'settings'); WD.nav.push(feedbackDetail(fb)); } }); };
WD.panel.addAction('Customer replies to the follow-up text: 5', () => reply(5, '{driver} was friendly and fast. Thank you!'));
WD.panel.addAction('Customer replies to the follow-up text: 2', () => reply(2, 'The truck blocked our loading dock for half an hour.'));
WD.panel.addAction('Customer pays in the bookkeeping program', () => { const r = unpaidRecs().find(x => !x.ext); if (!r) return ui.toast('No open invoices', 'info.circle'); if (!CO.hasBooks()) return ui.toast('No bookkeeping program is connected', 'info.circle');
  r.ext = { method: 'ACH (customer portal)', at: +WD.now() };
  if (ST.books.autoPaid) { ui.toast((q.customer(r.customerId) || {}).name + ' paid ' + r.number + ' in ' + CO.booksName() + '…', 'creditcard', 2200); setTimeout(() => CO.syncPayments(false), 2600); }
  else ui.toast(r.number + ' was paid in ' + CO.booksName() + '. Tap Check now on Invoices to pick it up.', 'creditcard', 3600); });
/* Two open invoices were already paid in the bookkeeping program, so the first check finds something. */
unpaidRecs().filter(r => r.jobId || r.status === 'Overdue').slice(0, 2).forEach((r, i) => { r.ext = { method: i ? 'Check #5521 (entered in the office)' : 'Card (customer portal)', at: +WD.now() - (3 + i) * 36e5 }; });
})();
