/* Features for any route-based business, not only shredding (prototype 2.8). Registers WD.biz:
   business type and document wording (industry presets with starter items), service checklists and required photos by job type,
   custom fields on customers and jobs, pausing a customer's service, fleet and compliance (pre-trip inspections, maintenance by
   odometer, expiring vehicle and driver documents), the load sheet and truck capacity, mileage and expenses, and route performance.
   Everything is reached from Settings → Business type and wording; the pieces a driver uses also sit on the job, customer and Shift screens. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You', admin = () => WD.can('settings.manage'), money = n => fmt.money(n, true);
const plural = (n, w) => n + ' ' + (n === 1 ? w : w === 'box' ? 'boxes' : w + 's'), num = n => Math.round(n).toLocaleString('en-US');
const locked = () => ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'This needs the Company settings permission. An owner or admin can grant it in Team and roles.' });
const ask = async (title, placeholder, value, message) => { const r = await ui.alert({ title, message, input: { placeholder, value: value || '' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); return r && r.value && r.text.trim() ? r.text.trim() : null; };
let seq = 0; const uid = p => p + (++seq) + Date.now().toString(36).slice(-4);
const BZ = WD.biz = {};

WD.addIcons({ wrench: '<path d="M14.500 6.500a4 4 0 0 0 5 5L11 20a2.100 2.100 0 0 1-3-3l8.500-8.500"/><path d="M14.500 6.500l2-2a4.500 4.500 0 0 1 3 3l-2 2"/>', gauge: '<path d="M4 17a8.500 8.500 0 1 1 16 0"/><path d="M12 14l3.500-4.500"/><circle cx="12" cy="14.500" r="1.300" fill="currentColor"/>' });
WD.css(`
.bz-bar { padding: 2px 16px 12px; } .bz-bar .progress { height: 8px; } .bz-bar.over .progress i { background: var(--red); } .bz-bar small { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--label2); padding-top: 5px; }
.bz-kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--sep); } .bz-kpi div { background: var(--cell); padding: 10px 6px; text-align: center; } .bz-kpi b { display: block; font-size: 17px; font-variant-numeric: tabular-nums; } .bz-kpi span { font-size: 11.5px; color: var(--label2); }
.bz-insp { display: flex; gap: 6px; } .bz-insp button { border: 0; border-radius: 8px; padding: 5px 10px; font: inherit; font-size: 14px; background: var(--fill3); color: var(--label2); cursor: pointer; } .bz-insp button.ok.on { background: var(--green); color: #fff; } .bz-insp button.bad.on { background: var(--red); color: #fff; }
.bz-prev { margin: 8px 16px 12px; padding: 12px 14px; border-radius: 10px; background: #fff; color: #1c1c1e; box-shadow: inset 0 0 0 .5px var(--sep); font-size: 12.5px; line-height: 17px; } .bz-prev b { font-size: 13.5px; } .bz-prev i { display: block; text-align: center; margin-top: 4px; } .bz-prev .sl { border-top: 1px solid #1c1c1e; margin-top: 26px; padding-top: 3px; font-size: 11px; color: #3a3a3c; }
.bz-seg { padding: 10px 16px 0; }
`);

/* ================= Business type and wording ================= */
const SHRED = '{company} certifies that all materials related to services included on this invoice have been shredded per the terms of the service agreement. Additionally, 100% of the shredded materials were recycled.';
const DONE = '{company} certifies that the services on this invoice were completed as described at the service location shown.';
const PRESETS = [
  { id: 'shredding', name: 'Document shredding', ic: 'doc.text', rep: 'Shredding Service Representative', proofOn: true, proofTitle: 'CERTIFICATE OF DESTRUCTION', proofText: SHRED, items: [], checks: [], fields: [] },
  { id: 'pest', name: 'Pest control', ic: 'sparkles', rep: 'Service Technician', proofOn: true, proofTitle: 'SERVICE REPORT', proofText: '{company} certifies that the services on this invoice were performed as described and that every product was applied according to its label.', items: [['General pest treatment', 'visit', 95], ['Rodent station service', 'station', 15], ['Termite inspection', 'inspection', 125]], checks: ['Inspected inside and outside', 'Products and amounts written down', 'Photo of the treated area'], fields: ['Target pests', 'Pets or children on site'] },
  { id: 'lawn', name: 'Lawn and landscape', ic: 'house', rep: 'Crew Leader', proofOn: true, proofTitle: 'SERVICE SUMMARY', proofText: DONE, items: [['Mowing and edging', 'visit', 55], ['Fertilizer application', 'application', 80], ['Seasonal cleanup', 'hour', 65]], checks: ['Gates closed and latched', 'Clippings blown off walks and drive', 'Photo of the finished yard'], fields: ['Gate code', 'Dogs in the yard'] },
  { id: 'pool', name: 'Pool and spa service', ic: 'sparkles', rep: 'Pool Technician', proofOn: true, proofTitle: 'SERVICE REPORT', proofText: '{company} tested and balanced the water and completed the services on this invoice.', items: [['Weekly pool service', 'visit', 45], ['Filter cleaning', 'cleaning', 90], ['Chemicals', 'visit', 18]], checks: ['Chlorine and pH readings written down', 'Baskets emptied', 'Gate locked on the way out'], fields: ['Pool size (gallons)', 'Gate code'] },
  { id: 'delivery', name: 'Delivery and distribution', ic: 'shippingbox', rep: 'Delivery Driver', proofOn: true, proofTitle: 'PROOF OF DELIVERY', proofText: 'The items on this invoice were delivered in good condition and received by the person who signed above.', items: [['5-gallon water bottle', 'bottle', 8.5], ['Bottle deposit', 'bottle', 6], ['Delivery fee', 'delivery', 5]], checks: ['Counted with the customer', 'Empties picked up', 'Photo of where it was left'], fields: ['Where to leave deliveries', 'Receiving hours'] },
  { id: 'cleaning', name: 'Cleaning and janitorial', ic: 'building', rep: 'Cleaning Supervisor', proofOn: true, proofTitle: 'SERVICE SUMMARY', proofText: DONE, items: [['Office cleaning', 'visit', 120], ['Floor care', 'hour', 55], ['Supplies restocked', 'visit', 20]], checks: ['Trash and recycling emptied', 'Restrooms stocked', 'Alarm set and doors locked'], fields: ['Alarm code', 'Key or badge number'] },
  { id: 'waste', name: 'Waste, recycling and grease', ic: 'truck', rep: 'Route Driver', proofOn: true, proofTitle: 'SERVICE MANIFEST', proofText: '{company} collected the materials on this invoice and transported them to a permitted facility.', items: [['Container service', 'pickup', 40], ['Extra pickup', 'pickup', 60], ['Overfilled container', 'each', 25]], checks: ['Lids closed', 'Photo if the container was blocked or overfilled'], fields: ['Container location', 'Enclosure key'] },
  { id: 'sales', name: 'Field sales and merchandising', ic: 'briefcase', rep: 'Sales Representative', proofOn: false, proofTitle: 'ORDER CONFIRMATION', proofText: 'Thank you for your order. {company} will confirm the delivery date.', items: [['Product order', 'order', 0], ['Display setup', 'visit', 0], ['Samples left', 'each', 0]], checks: ['Shelf or display checked', 'Order reviewed with the buyer', 'Photo of the display'], fields: ['Buyer’s name', 'Best day to visit'] },
  { id: 'other', name: 'Another route business', ic: 'route', rep: 'Service Representative', proofOn: false, proofTitle: 'SERVICE SUMMARY', proofText: DONE, items: [], checks: [], fields: [] },
];
data.biz = { industry: 'shredding', repTitle: PRESETS[0].rep, proofOn: true, proofTitle: PRESETS[0].proofTitle, proofText: SHRED };
const preset = () => PRESETS.find(x => x.id === data.biz.industry) || PRESETS[0];
BZ.industryName = () => preset().name;
BZ.wordingSpec = () => ({ title: 'Business type and wording', render: page => { if (!admin()) return locked();
  const Z = data.biz, P = preset(), re = () => { WD.changed(); page.refresh(); }, org = (S.org || data.orgs[0]).name;
  const hasItem = n => data.priceBook.some(x => x.name === n), hasField = n => data.customFields.some(x => x.label === n), hasCheck = n => (data.checklists.regular || []).some(x => x.text === n);
  return ui.list(
    h('div', { style: 'padding:4px 4px 0' }, ui.note('The app was built for a shredding company, but routes, stops, invoices and customers work the same for any business that visits customers on a route. Choose yours to change the wording on documents and get starter items.')),
    ui.section({ header: 'What kind of business is this?' }, PRESETS.map(x => ui.row({ icon: x.ic, iconColor: Z.industry === x.id ? 'var(--tint)' : 'var(--gray)', title: x.name, trailing: Z.industry === x.id ? icon('checkmark', 20, 'var(--tint)') : null, onTap: () => { if (Z.industry === x.id) return; Object.assign(Z, { industry: x.id, repTitle: x.rep, proofOn: x.proofOn, proofTitle: x.proofTitle, proofText: x.proofText }); re(); ui.toast('Wording set for ' + x.name.toLowerCase(), 'checkmark', 2200); } }))),
    ui.section({ header: 'Wording on invoices', footer: 'The statement prints at the bottom of every invoice. {company} is replaced with your company name.' },
      ui.inputRow({ label: 'Signature line', value: Z.repTitle, placeholder: 'Service Representative', onInput: v => { Z.repTitle = v.trim() || P.rep; } }),
      ui.toggleRow({ title: 'Print a statement on invoices', subtitle: 'A certificate, service report or proof of delivery', value: Z.proofOn, onChange: v => { Z.proofOn = v; re(); } }),
      Z.proofOn && ui.inputRow({ label: 'Heading', value: Z.proofTitle, onInput: v => { Z.proofTitle = v.trim().toUpperCase() || P.proofTitle; } }),
      Z.proofOn && ui.inputRow({ multiline: true, value: Z.proofText, placeholder: 'Statement', onInput: v => { Z.proofText = v.trim() || P.proofText; } })),
    ui.section({ header: 'How it prints' }, h('div.bz-prev', h('div.sl', Z.repTitle + ' Signature'), Z.proofOn && h('div', { style: 'margin-top:12px' }, h('b', Z.proofTitle + ':'), h('i', Z.proofText.replace(/\{company\}/g, org)))),
      ui.row({ title: 'Refresh the preview', tint: true, onTap: () => page.refresh() })),
    P.items.length > 0 && ui.section({ header: 'Starter items for ' + P.name.toLowerCase(), footer: 'Added to Items, services and fees, where you can change the name and price.' },
      P.items.map(([name, unit, rate]) => ui.row({ title: name, subtitle: money(rate) + ' per ' + unit, trailing: hasItem(name) ? h('span.secondary', 'Added') : h('button.cu-link', { onclick: () => { data.priceBook.push({ id: uid('pb'), name, unit, rate }); re(); } }, 'Add') }))),
    P.checks.length > 0 && ui.section({ header: 'Suggested checklist', footer: 'Added to the checklist for route service stops. Change them in Service checklists.' },
      P.checks.map(t => ui.row({ title: t, trailing: hasCheck(t) ? h('span.secondary', 'Added') : h('button.cu-link', { onclick: () => { (data.checklists.regular = data.checklists.regular || []).push({ id: uid('k'), text: t, req: false, photo: /^Photo/.test(t) }); re(); } }, 'Add') }))),
    P.fields.length > 0 && ui.section({ header: 'Suggested custom fields', footer: 'Added to every customer. Change them in Custom fields.' },
      P.fields.map(t => ui.row({ title: t, trailing: hasField(t) ? h('span.secondary', 'Added') : h('button.cu-link', { onclick: () => { data.customFields.push({ id: uid('f'), on: 'customer', label: t, kind: 'text' }); re(); } }, 'Add') }))));
} });

/* ================= Service checklists and required photos ================= */
data.checklists = { setup: [{ id: 'k1', text: 'Containers placed where the customer wants them', req: true }, { id: 'k2', text: 'Keys or lock codes given to the site contact', req: true }, { id: 'k3', text: 'Photo of each container in place', req: true, photo: true }] };
const checksFor = job => (!job.allDay && data.checklists[job.type]) || [], done = (job, k) => !!(job.checks && job.checks[k.id]);
const missing = job => checksFor(job).filter(k => k.req && !done(job, k));
function checkSection(job, refresh) {
  const list = checksFor(job); if (!list.length) return null; const left = missing(job).length, open = !WD.struck[job.status];
  return ui.section({ header: 'Checklist · ' + list.filter(k => done(job, k)).length + ' of ' + list.length, footer: left ? plural(left, 'required item') + ' left. They’re asked for before the stop can be completed.' : null },
    list.map(k => { const d = job.checks && job.checks[k.id];
      return ui.row({ icon: d ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: d ? 'var(--green)' : k.req ? 'var(--orange)' : 'var(--label3)', title: k.text, subtitle: d ? d.by + ' · ' + fmt.clock(new Date(d.at)) + (k.photo ? ' · photo attached' : '') : [k.req && 'Required', k.photo && 'Takes a photo'].filter(Boolean).join(' · ') || null,
        trailing: k.photo && !d ? icon('camera', 20, 'var(--tint)') : null, onTap: open ? () => { job.checks = job.checks || {};
          if (d) delete job.checks[k.id]; else { job.checks[k.id] = { at: +WD.now(), by: me() }; if (k.photo) { job.attachments.push({ id: uid('a'), name: k.text.replace(/^Photo of /i, '').replace(/^./, c => c.toUpperCase()) + '.jpg', kind: 'photo', size: (1.4 + Math.random() * 1.2).toFixed(1) + ' MB' }); ui.toast('Photo added to the job', 'camera'); } }
          WD.changed(); refresh && refresh(); } : null }); }));
}
/* Complete stop asks for unfinished required items first. */
if (WD.workflow && WD.workflow.completeStop) { const complete = WD.workflow.completeStop;
  WD.workflow.completeStop = async job => { const miss = job.status !== 'completed' ? missing(job) : [];
    if (miss.length) { const v = await ui.actionSheet({ title: plural(miss.length, 'checklist item') + ' left', message: miss.map(k => '• ' + k.text).join('\n'), buttons: [{ label: 'Complete anyway…', value: 'skip', role: 'destructive' }], cancel: 'Back to the checklist' }); if (v !== 'skip') return;
      const why = await ask('Why wasn’t it finished?', 'e.g. No one was there to take the keys'); if (!why) return; job.events.push({ at: +WD.now(), actor: me(), text: 'Completed with ' + plural(miss.length, 'checklist item') + ' unfinished — ' + why }); }
    return complete(job); }; }
BZ.checklistSpec = () => ({ title: 'Service checklists', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); };
  return ui.list(h('div', { style: 'padding:4px 4px 0' }, ui.note('A checklist shows on every job of that type. Required items are asked for before the stop can be completed, and a photo item opens the camera and attaches the picture to the job as proof of service.')),
    WD.jobTypes.map(t => { const list = data.checklists[t.id] = data.checklists[t.id] || [];
      return ui.section({ header: h('span.hstack', { style: 'gap:6px' }, ui.dot(t.color), t.title) },
        list.map(k => ui.row({ title: k.text, subtitle: [k.req ? 'Required' : 'Optional', k.photo && 'Takes a photo'].filter(Boolean).join(' · '), chevron: true, onTap: async () => {
          const v = await ui.actionSheet({ title: k.text, buttons: [{ label: k.req ? 'Make it optional' : 'Make it required', value: 'req' }, { label: k.photo ? 'No photo needed' : 'Ask for a photo', value: 'photo' }, { label: 'Rename…', value: 'name' }, { label: 'Delete', value: 'del', role: 'destructive' }] });
          if (v === 'req') k.req = !k.req; else if (v === 'photo') k.photo = !k.photo; else if (v === 'del') list.splice(list.indexOf(k), 1); else if (v === 'name') { const n = await ask('Checklist item', 'What to check', k.text); if (n) k.text = n; } if (v) re(); } })),
        ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an item', tint: true, onTap: async () => { const n = await ask('New checklist item', 'e.g. Gate locked on the way out', '', t.title); if (n) { list.push({ id: uid('k'), text: n, req: true, photo: /photo|picture/i.test(n) }); re(); } } })); }));
} });

/* ================= Custom fields on customers and jobs ================= */
data.customFields = [{ id: 'f1', on: 'customer', label: 'Gate or door code', kind: 'text' }, { id: 'f2', on: 'customer', label: 'Where to park', kind: 'choice', options: ['Front', 'Loading dock', 'Back alley', 'Street'] }, { id: 'f3', on: 'job', label: 'Paperwork left with', kind: 'text' }];
const KINDS = [{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'choice', label: 'A list of choices' }, { value: 'yesno', label: 'Yes or no' }];
(c => { if (c) c.custom = { f1: '4417#', f2: 'Loading dock' }; })(data.customers.find(c => c.lifecycle === 'customer'));
async function editField(fd, obj, refresh) {
  obj.custom = obj.custom || {}; let v;
  if (fd.kind === 'choice' || fd.kind === 'yesno') { v = await ui.actionSheet({ title: fd.label, buttons: (fd.kind === 'yesno' ? ['Yes', 'No'] : fd.options || []).map(x => ({ label: x, value: x })).concat(obj.custom[fd.id] ? [{ label: 'Clear', value: '', role: 'destructive' }] : []) }); if (v == null) return; }
  else { const r = await ui.alert({ title: fd.label, input: { placeholder: fd.kind === 'number' ? 'A number' : 'Type here', value: obj.custom[fd.id] || '' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (!r || !r.value) return; v = r.text.trim(); }
  if (v) obj.custom[fd.id] = v; else delete obj.custom[fd.id]; WD.changed(); refresh && refresh();
}
const fieldRow = (fd, obj, edit, refresh) => { const v = obj.custom && obj.custom[fd.id]; return ui.row({ title: fd.label, detail: v || (edit ? h('span', { style: 'color:var(--tint)' }, 'Add') : '—'), onTap: edit ? () => editField(fd, obj, refresh) : null }); };
const fieldsOn = on => data.customFields.filter(f => f.on === on);
BZ.fieldsSpec = () => ({ title: 'Custom fields', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); };
  const add = on => { const f = { label: '', kind: 'text', options: '' };
    ui.sheet({ title: 'New field', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Add', bold: true, onTap: p => { if (!f.label.trim()) return ui.toast('Give the field a name', 'pencil'); const opts = f.options.split(',').map(x => x.trim()).filter(Boolean); if (f.kind === 'choice' && opts.length < 2) return ui.toast('List at least two choices', 'list.bullet');
      data.customFields.push({ id: uid('f'), on, label: f.label.trim(), kind: f.kind, options: opts }); p.dismiss(); re(); } }],
      render: p => ui.list(ui.section({ footer: 'Shown on every ' + on + '. ' + (on === 'customer' ? 'Drivers see a customer’s fields on each of its jobs.' : 'Filled in on the job, by the office or the driver.') }, ui.inputRow({ label: 'Name', placeholder: on === 'customer' ? 'e.g. Gate code' : 'e.g. Meter reading', value: f.label, autofocus: true, onInput: v => { f.label = v; } }),
        ui.pickerRow({ title: 'Kind of answer', value: f.kind, options: KINDS, onChange: v => { f.kind = v; p.refresh(); } }),
        f.kind === 'choice' && ui.inputRow({ label: 'Choices', placeholder: 'Separated by commas', value: f.options, onInput: v => { f.options = v; } }))) }, { detent: 'medium' }); };
  const sec = (on, header, footer) => ui.section({ header, footer }, fieldsOn(on).map(fd => ui.row({ title: fd.label, subtitle: KINDS.find(k => k.value === fd.kind).label + (fd.kind === 'choice' ? ': ' + fd.options.join(', ') : ''), chevron: true, onTap: async () => {
      const v = await ui.actionSheet({ title: fd.label, buttons: [{ label: 'Rename…', value: 'name' }, { label: 'Delete the field', value: 'del', role: 'destructive' }] }); if (v === 'name') { const n = await ask('Field name', 'Name', fd.label); if (n) fd.label = n; } else if (v === 'del') data.customFields.splice(data.customFields.indexOf(fd), 1); if (v) re(); } })),
    ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a field', tint: true, onTap: () => add(on) }));
  return ui.list(h('div', { style: 'padding:4px 4px 0' }, ui.note('Keep track of anything your business needs that the app doesn’t already ask for: a gate code, a pool size, a meter reading, a buyer’s name.')),
    sec('customer', 'On customers', 'In the customer record under More details, and on each of the customer’s jobs.'), sec('job', 'On jobs', 'In the job details under More details.'));
} });

/* ================= Pausing a customer's service ================= */
function pauseSheet(c) {
  const f = { from: today(), to: D.add(today(), 14), reason: '' }, hit = () => data.jobs.filter(j => j.customerId === c.id && j.status === 'scheduled' && !j.pending && !j.allDay && j.day >= f.from && j.day <= f.to);
  ui.sheet({ title: 'Pause service', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Pause', bold: true, onTap: p => { if (f.to < f.from) return ui.toast('The last day is before the first', 'calendar'); const jobs = hit(), why = f.reason.trim();
      c.hold = { from: f.from, to: f.to, reason: why, by: me(), at: +WD.now() };
      if (jobs.length) api.op({ kind: 'batch', title: c.name, scope: 'Service paused · ' + plural(jobs.length, 'visit'), jobIds: jobs.map(j => j.id), apply() { jobs.forEach(j => { j.status = 'canceled'; j.held = true; j.events.push({ at: +WD.now(), actor: me(), text: 'Service paused through ' + fmt.day(f.to) + (why ? ' — ' + why : '') }); }); } });
      WD.changed(); p.dismiss(); ui.toast('Paused through ' + fmt.day(f.to, 'md') + (jobs.length ? ' · ' + plural(jobs.length, 'visit') + ' taken off the routes' : ''), 'pause', 2800); } }],
    render: p => ui.list(ui.section({ header: c.name, footer: plural(hit().length, 'scheduled visit') + ' in these dates will be taken off the routes. Service starts again by itself the day after, and nothing is billed while it’s paused.' },
        ui.dateRow({ title: 'First day off', icon: 'calendar', iconColor: 'var(--orange)', value: f.from, onChange: v => { f.from = v; p.refresh(); } }), ui.dateRow({ title: 'Last day off', icon: 'calendar', iconColor: 'var(--orange)', value: f.to, onChange: v => { f.to = v; p.refresh(); } }),
        ui.inputRow({ label: 'Reason', placeholder: 'e.g. Closed for the holidays', value: f.reason, onInput: v => { f.reason = v; } }))) }, { detent: 'medium' });
}
function holdSection(c, edit) {
  if (['lead', 'contacted', 'quoted', 'lost'].includes(c.lifecycle)) return null; const hd = c.hold && c.hold.to >= today() ? c.hold : null; if (!hd && !edit) return null;
  return ui.section({ header: 'Service pause', footer: hd ? null : 'For a vacation, a seasonal closing or a remodel. Visits in those dates come off the routes and return afterward.' },
    hd ? [ui.row({ icon: 'pause', iconColor: 'var(--orange)', title: 'Paused ' + fmt.day(hd.from, 'md') + ' – ' + fmt.day(hd.to, 'md'), subtitle: (hd.reason ? hd.reason + ' · ' : '') + hd.by }),
        edit && ui.row({ title: 'Resume service now', tint: true, onTap: () => { const jobs = data.jobs.filter(j => j.customerId === c.id && j.held && j.status === 'canceled' && j.day >= today()); c.hold = null;
          if (jobs.length) api.op({ kind: 'batch', title: c.name, scope: 'Service resumed · ' + plural(jobs.length, 'visit'), jobIds: jobs.map(j => j.id), apply() { jobs.forEach(j => { j.status = 'scheduled'; j.held = false; j.events.push({ at: +WD.now(), actor: me(), text: 'Service resumed' }); }); } });
          WD.changed(); ui.toast('Service resumed' + (jobs.length ? ' · ' + plural(jobs.length, 'visit') + ' back on the routes' : ''), 'checkmark', 2600); } })]
      : ui.row({ icon: 'pause', iconPlain: true, title: 'Pause service…', tint: true, onTap: () => pauseSheet(c) }));
}
BZ.customerSections = (c, edit) => [fieldsOn('customer').length > 0 && ui.section('More details', fieldsOn('customer').map(fd => fieldRow(fd, c, edit, null))), holdSection(c, edit)];
BZ.jobSections = (job, refresh) => { const c = q.customer(job.customerId), mine = fieldsOn('job'), theirs = c ? fieldsOn('customer').filter(fd => c.custom && c.custom[fd.id]) : [];
  return [checkSection(job, refresh), !job.allDay && mine.length + theirs.length > 0 && ui.section('More details', theirs.map(fd => ui.row({ title: fd.label, subtitle: 'From the customer record', detail: c.custom[fd.id] })), mine.map(fd => fieldRow(fd, job, true, refresh)))]; };

/* ================= Fleet and compliance ================= */
const F = data.fleet = { checklist: ['Brakes', 'Tires and wheels', 'Lights and signals', 'Mirrors and glass', 'Fluid levels and leaks', 'Horn and wipers', 'Fire extinguisher and triangles', 'Lift gate and shredder'], odo: { v1: 84210, v2: 61877, v3: 112440, v4: 47120 }, services: [], docs: [], inspections: [] };
data.vehicles.forEach((v, i) => { const o = F.odo[v.id] = F.odo[v.id] || 50000 + i * 9000;
  F.services.push({ id: uid('s'), owner: v.id, name: 'Oil and filter', every: 5000, last: o - [4210, 1900, 5240, 3100][i % 4] }, { id: uid('s'), owner: v.id, name: 'Tire rotation', every: 10000, last: o - [6100, 9700, 2400, 7000][i % 4] });
  F.docs.push({ id: uid('d'), owner: v.id, name: 'Registration', expires: D.add(today(), [212, 12, 140, 301][i % 4]) }, { id: uid('d'), owner: v.id, name: 'Insurance card', expires: D.add(today(), 96) }, { id: uid('d'), owner: v.id, name: 'Annual DOT inspection', expires: D.add(today(), [75, 190, -4, 240][i % 4]) }); });
data.users.filter(u => u.role === 'driver').forEach((u, i) => F.docs.push({ id: uid('d'), owner: u.id, name: 'Driver’s license', expires: D.add(today(), 400 + i * 90) }, { id: uid('d'), owner: u.id, name: 'DOT medical card', expires: D.add(today(), [21, 260, 180, 330][i % 4]) }));
F.inspections.push({ id: uid('n'), vehicleId: 'v2', by: (q.driverFor('r2') || { name: 'Driver' }).name, at: +WD.now() - 3.4 * 36e5, odo: F.odo.v2, defects: [], note: '' });
/* How many days ahead a reminder shows (Settings → Compliance and reminders; 30 to start, some companies want 60). */
const ND = () => (WD.r11 ? WD.r11.cfg.compliance.noticeDays : 30);
F.hours = { v1: 6210, v2: 4480, v3: 8830, v4: 3120 };
data.vehicles.forEach((v, i) => { F.hours[v.id] = F.hours[v.id] || 2000 + i * 700; F.services.push({ id: uid('s'), owner: v.id, name: 'PM service (A)', every: 0, everyHours: 250, everyDays: 90, last: F.odo[v.id], lastHours: F.hours[v.id] - [235, 90, 262, 140][i % 4], lastDay: D.add(today(), -[40, 71, 85, 20][i % 4]) }); });
/** Where a service stands. It can be scheduled by miles, engine hours and time; whichever comes due first counts. */
const svc = s => { const parts = [], per = m => m % 30 === 0 ? plural(m / 30, 'month') : plural(m, 'day');
  if (s.every) { const d = s.last + s.every - (F.odo[s.owner] || 0); parts.push({ over: d <= 0, warn: d <= 500, text: d <= 0 ? 'Overdue ' + num(-d) + ' mi' : 'In ' + num(d) + ' mi' }); }
  if (s.everyHours) { const d = (s.lastHours || 0) + s.everyHours - (F.hours[s.owner] || 0); parts.push({ over: d <= 0, warn: d <= 25, text: d <= 0 ? 'Overdue ' + num(-d) + ' engine hr' : 'In ' + num(d) + ' engine hr' }); }
  if (s.everyDays) { const d = daysTo(D.add(s.lastDay || today(), s.everyDays)); parts.push({ over: d < 0, warn: d <= ND(), text: d < 0 ? 'Overdue ' + plural(-d, 'day') : d === 0 ? 'Due today' : 'In ' + plural(d, 'day') }); }
  const over = parts.some(p => p.over), warn = parts.some(p => p.warn), show = parts.filter(p => over ? p.over : warn ? p.warn : true);
  return { over, warn, text: show.map(p => p.text).join(' · ') || 'No schedule', every: [s.every && 'Every ' + num(s.every) + ' mi', s.everyHours && 'every ' + num(s.everyHours) + ' engine hr', s.everyDays && 'every ' + per(s.everyDays)].filter(Boolean).join(' or ').replace(/^e/, 'E') || 'No schedule set' }; };
/** Set how often a service comes due: any mix of miles, engine hours and months. */
function pmSheet(s, done) { const f = { mi: s.every ? String(s.every) : '', hr: s.everyHours ? String(s.everyHours) : '', mo: s.everyDays ? String(Math.round(s.everyDays / 30 * 10) / 10) : '' }, n = t => parseFloat(String(t).replace(/[^0-9.]/g, '')) || 0;
  ui.sheet({ title: s.name, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Save', bold: true, onTap: p => { if (!n(f.mi) && !n(f.hr) && !n(f.mo)) return ui.toast('Enter miles, engine hours or months', 'wrench', 2400); s.every = Math.round(n(f.mi)); s.everyHours = Math.round(n(f.hr)); s.everyDays = Math.round(n(f.mo) * 30); p.dismiss(); done(); } }],
    render: () => ui.list(ui.section({ header: 'Comes due every', fold: false, footer: 'Fill in one, two or all three. The service comes due at whichever is reached first. Leave a box empty to ignore it.' },
      ui.inputRow({ label: 'Miles', inputmode: 'numeric', placeholder: 'e.g. 5000', value: f.mi, onInput: v => { f.mi = v; } }), ui.inputRow({ label: 'Engine hours', inputmode: 'numeric', placeholder: 'e.g. 250', value: f.hr, onInput: v => { f.hr = v; } }), ui.inputRow({ label: 'Months', inputmode: 'decimal', placeholder: 'e.g. 6', value: f.mo, onInput: v => { f.mo = v; } }))) }, { detent: 'medium' }); }
BZ.svc = svc; BZ.daysTo = k => daysTo(k);
const dueIn = s => s.last + s.every - (F.odo[s.owner] || 0), daysTo = k => Math.round((D.parse(k) - D.parse(today())) / 864e5), ownerName = id => (q.vehicle(id) || q.user(id) || { name: '' }).name;
const lastInsp = vid => F.inspections.filter(x => x.vehicleId === vid).sort((a, b) => b.at - a.at)[0], inspectedToday = vid => { const x = lastInsp(vid); return !!x && D.key(new Date(x.at)) === today(); };
function attention() {
  const out = [];
  F.services.forEach(s => { const st = svc(s); if (st.over || st.warn) out.push({ color: st.over ? 'var(--red)' : 'var(--orange)', icon: 'wrench', title: ownerName(s.owner) + ' · ' + s.name, sub: st.text, owner: s.owner }); });
  F.docs.forEach(d => { const n = daysTo(d.expires); if (n <= ND()) out.push({ color: n < 0 ? 'var(--red)' : 'var(--orange)', icon: 'doc.text', title: ownerName(d.owner) + ' · ' + d.name, sub: n < 0 ? 'Expired ' + plural(-n, 'day') + ' ago' : n === 0 ? 'Expires today' : 'Expires in ' + plural(n, 'day') + ' · ' + fmt.day(d.expires, 'md'), owner: d.owner }); });
  data.vehicles.forEach(v => { const x = lastInsp(v.id); if (x && x.defects.length && !x.fixed) out.push({ color: 'var(--red)', icon: 'exclamationmark.triangle', title: v.name + ' · ' + plural(x.defects.length, 'defect') + ' reported', sub: x.defects.join(', ') + ' · ' + x.by, owner: v.id }); });
  return out;
}
BZ.fleetBadge = () => attention().length;
const docRows = (owner, re) => F.docs.filter(d => d.owner === owner).map(d => { const n = daysTo(d.expires); return ui.row({ title: d.name, subtitle: n < 0 ? h('span', { style: 'color:var(--red);font-weight:600' }, 'Expired') : n <= ND() ? h('span', { style: 'color:var(--orange);font-weight:600' }, 'Expires in ' + plural(n, 'day')) : 'Expires ' + fmt.day(d.expires, 'md') + ', ' + d.expires.slice(0, 4),
  trailing: h('input.pill-input', { type: 'date', value: d.expires, 'aria-label': d.name + ' expires', onchange: e => { if (e.target.value) { d.expires = e.target.value; re(); } } }) }); });
const addDoc = async (owner, re) => { const n = await ask('New document', 'e.g. Applicator license', '', 'It gets an expiry date and a reminder ' + ND() + ' days before.'); if (n) { F.docs.push({ id: uid('d'), owner, name: n, expires: D.add(today(), 365) }); re(); } };
/** The driver's pre-trip inspection: every item OK or a defect, the odometer, and a note. Defects go straight to dispatch. */
BZ.inspect = (v, after) => { const st = Object.fromEntries(F.checklist.map(x => [x, 'ok'])), f = { odo: String(F.odo[v.id] || ''), note: '' };
  ui.sheet({ title: 'Pre-trip · ' + v.name, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Submit', bold: true, onTap: p => { const odo = parseInt(f.odo.replace(/\D/g, ''), 10), bad = F.checklist.filter(x => st[x] === 'bad');
      if (!odo || odo < (F.odo[v.id] || 0)) return ui.toast('Enter the odometer: at least ' + num(F.odo[v.id] || 0), 'gauge', 2600); if (bad.length && !f.note.trim()) return ui.toast('Describe what’s wrong', 'pencil', 2400);
      F.odo[v.id] = odo; F.inspections.push({ id: uid('n'), vehicleId: v.id, by: me(), at: +WD.now(), odo, defects: bad, note: f.note.trim() }); WD.changed(); p.dismiss(); after && after();
      if (bad.length) ui.banner({ title: v.name + ' · ' + plural(bad.length, 'defect') + ' reported', text: bad.join(', ') + ' — sent to dispatch', icon: 'exclamationmark.triangle', color: 'var(--red)' }); else ui.toast('Inspection saved · no defects', 'checkmark', 2400); } }],
    render: p => ui.list(ui.section({ header: v.name + (v.plate ? ' · ' + v.plate : ''), footer: 'Everything starts as OK. Tap Defect on anything that isn’t right.' },
        F.checklist.map(x => ui.row({ title: x, trailing: h('div.bz-insp', h('button.ok' + (st[x] === 'ok' ? '.on' : ''), { onclick: () => { st[x] = 'ok'; p.refresh(); } }, 'OK'), h('button.bad' + (st[x] === 'bad' ? '.on' : ''), { onclick: () => { st[x] = 'bad'; p.refresh(); } }, 'Defect')) }))),
      ui.section({ footer: 'Submitting signs the inspection as ' + me() + ' at ' + fmt.clock(WD.now()) + '. Maintenance reminders use the odometer.' }, ui.inputRow({ label: 'Odometer', inputmode: 'numeric', value: f.odo, onInput: v2 => { f.odo = v2; } }),
        ui.inputRow({ multiline: true, placeholder: F.checklist.some(x => st[x] === 'bad') ? 'What’s wrong? (required)' : 'Notes (optional)', value: f.note, onInput: v2 => { f.note = v2; } }))) }, { detent: 'large' }); };
BZ.vehicleSpec = v => ({ title: v.name, render: page => { const re = () => { WD.changed(); page.refresh(); }, x = lastInsp(v.id), edit = admin();
  return ui.list(
    ui.section({ header: [v.kind, v.plate].filter(Boolean).join(' · ') }, h('div.row', h('div.row-icon', { style: { background: 'var(--blue)' } }, icon('gauge', 19)), h('div.row-main', h('div.row-title', 'Odometer'), h('div.row-sub', 'Updated at each inspection')), h('input.jb-rate', { style: 'width:96px', type: 'text', inputmode: 'numeric', 'aria-label': 'Odometer', value: num(F.odo[v.id] || 0), onchange: e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); if (n) F.odo[v.id] = n; re(); } })),
      h('div.row', h('div.row-icon', { style: { background: 'var(--teal)' } }, icon('timer', 19)), h('div.row-main', h('div.row-title', 'Engine hours'), h('div.row-sub', 'For services that come due by hours')), h('input.jb-rate', { style: 'width:96px', type: 'text', inputmode: 'numeric', 'aria-label': 'Engine hours', value: num(F.hours[v.id] || 0), onchange: e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); if (n) F.hours[v.id] = n; re(); } })),
      ui.row({ icon: 'checklist', iconColor: inspectedToday(v.id) ? 'var(--green)' : 'var(--orange)', title: 'Pre-trip inspection', subtitle: x ? (x.defects.length ? plural(x.defects.length, 'defect') + ': ' + x.defects.join(', ') : 'No defects') + ' · ' + x.by + ' · ' + fmt.rel(new Date(x.at)) : 'Never inspected', detail: inspectedToday(v.id) ? 'Done today' : 'Start', chevron: true, onTap: () => BZ.inspect(v, () => page.refresh()) }),
      x && x.defects.length > 0 && !x.fixed && edit && ui.row({ title: 'Mark the defects repaired', subtitle: x.note || null, tint: true, onTap: () => { x.fixed = { by: me(), at: +WD.now() }; re(); ui.toast('Marked repaired', 'checkmark'); } })),
    ui.section({ header: 'Preventive maintenance', fold: false, footer: 'A service can come due by miles, by engine hours, by time, or any mix of the three: whichever comes first. A reminder shows ' + ND() + ' days, 500 miles or 25 engine hours ahead.' },
      F.services.filter(s => s.owner === v.id).map(s => { const st = svc(s); return ui.row({ icon: 'wrench', iconColor: st.over ? 'var(--red)' : st.warn ? 'var(--orange)' : 'var(--gray)', title: s.name, subtitle: st.every, detail: st.text, chevron: edit, onTap: edit ? async () => {
        const a = await ui.actionSheet({ title: s.name + ' · ' + v.name, buttons: [{ label: 'Done today at ' + num(F.odo[v.id]) + ' mi', value: 'done' }, { label: 'Change the schedule…', value: 'every' }, { label: 'Delete', value: 'del', role: 'destructive' }] });
        if (a === 'done') { s.last = F.odo[v.id]; s.lastDay = today(); s.lastHours = F.hours[v.id] || 0; ui.toast(s.name + ' recorded', 'checkmark'); re(); } else if (a === 'del') { F.services.splice(F.services.indexOf(s), 1); re(); } else if (a === 'every') pmSheet(s, re); } : null }); }),
      edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a service', tint: true, onTap: async () => { const n = await ask('New service', 'e.g. Brake inspection'); if (!n) return; const s = { id: uid('s'), owner: v.id, name: n, every: 0, everyHours: 0, everyDays: 0, last: F.odo[v.id], lastDay: today(), lastHours: F.hours[v.id] || 0 }; pmSheet(s, () => { if (!F.services.includes(s)) F.services.push(s); re(); }); } })),
    ui.section({ header: 'Documents', fold: false, footer: 'Registration, insurance, inspections and (in California) the CARB Clean Truck Check every 6 months. A reminder shows ' + ND() + ' days before each one expires; change that in Settings → Compliance and reminders.' }, docRows(v.id, re), edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a document', tint: true, onTap: () => addDoc(v.id, re) })));
} });
BZ.fleetSpec = () => ({ title: 'Fleet and compliance', render: page => { const re = () => { WD.changed(); page.refresh(); }, att = attention(), drivers = data.users.filter(u => F.docs.some(d => d.owner === u.id)), edit = admin();
  return ui.list(
    ui.section({ header: att.length ? 'Needs attention · ' + att.length : 'Needs attention' }, att.length ? att.map(a => ui.row({ icon: a.icon, iconColor: a.color, title: a.title, subtitle: a.sub, chevron: !!q.vehicle(a.owner), onTap: q.vehicle(a.owner) ? () => page.push(BZ.vehicleSpec(q.vehicle(a.owner))) : null })) : ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Everything is up to date' })),
    ui.section({ header: 'Vehicles', footer: 'Drivers do the pre-trip inspection from the Shift tab before leaving.' }, data.vehicles.filter(v => v.active !== false).map(v => ui.row({ icon: 'truck', iconColor: inspectedToday(v.id) ? 'var(--green)' : 'var(--gray)', title: v.name, subtitle: num(F.odo[v.id] || 0) + ' mi · ' + (inspectedToday(v.id) ? 'inspected today' : 'not inspected today'), chevron: true, onTap: () => page.push(BZ.vehicleSpec(v)) }))),
    drivers.map(u => ui.section({ header: u.name + ' · documents' }, docRows(u.id, re), edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a license or certificate', tint: true, onTap: () => addDoc(u.id, re) }))),
    edit && ui.section({ header: 'What the pre-trip inspection checks', footer: 'Tap an item to remove it.' }, F.checklist.map(x => ui.row({ title: x, onTap: async () => { if (await ui.actionSheet({ title: x, buttons: [{ label: 'Remove from the inspection', value: true, role: 'destructive' }] })) { F.checklist.splice(F.checklist.indexOf(x), 1); re(); } } })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an item', tint: true, onTap: async () => { const n = await ask('Inspection item', 'e.g. Spill kit'); if (n) { F.checklist.push(n); re(); } } })));
} });
const myRoute = () => (S.shift && S.shift.routeId && q.route(S.shift.routeId)) || q.routes().find(r => r.driverId === (S.me && S.me.id)) || null;

/* ================= Load sheet and truck capacity ================= */
const L = data.load = { weights: { console: 60, bin64: 150, bin96: 230, box: 30, binFlat: 300, binExtra: 150 }, capacity: { v1: 6000, v2: 6000, v3: 5000, v4: 9000 } };
const capOf = rid => { const r = q.route(rid); return (r && L.capacity[r.vehicleId]) || 6000; };
const jobLoad = j => (j.items || []).reduce((s, i) => s + (+i.qty || 0) * (L.weights[i.id] || 0), 0);
/** What a route carries on a day: totals by item, the running weight, and the stop where the truck fills up. */
function loadFor(rid, day) {
  const stops = q.stopList(rid, day).filter(j => !WD.calledOff(j) && j.status !== 'skipped'), items = new Map(), cap = capOf(rid); let lb = 0, fullAt = null;
  stops.forEach((j, i) => { (j.items || []).forEach(x => { if (x.qty > 0) items.set(x.id, (items.get(x.id) || 0) + x.qty); }); lb += jobLoad(j); if (fullAt == null && lb > cap) fullAt = { n: i + 1, job: j }; });
  return { stops, lb, cap, fullAt, items: [...items].map(([id, qty]) => ({ id, qty, rate: 0 })) };
}
BZ.loadSettingsSpec = () => ({ title: 'Capacity and weights', render: page => { if (!admin()) return locked(); const re = () => { WD.changed(); page.refresh(); };
  return ui.list(ui.section({ header: 'What each truck can carry', footer: 'In pounds. A route that goes over shows where the truck fills up, so you can plan a trip to unload.' },
      data.vehicles.filter(v => v.active !== false).map(v => { const c = L.capacity[v.id] = L.capacity[v.id] || 6000; return ui.row({ icon: 'truck', iconColor: 'var(--gray)', title: v.name, subtitle: v.kind, detail: fmt.weight(c), trailing: ui.stepper(c / 500, 1, 80, n => { L.capacity[v.id] = n * 500; re(); }) }); })),
    ui.section({ header: 'What each item weighs', footer: 'A typical weight for one, full. For deliveries, use the weight of what goes on the truck.' },
      data.priceBook.filter(x => WD.CONTAINERS.includes(x.id) || L.weights[x.id] != null || !['trip', 'cod', 'stairsDown', 'stairsUp', 'haul', 'hdd'].includes(x.id)).map(x => h('div.row', h('div.row-main', h('div.row-title', x.name), h('div.row-sub', 'Pounds per ' + x.unit)), h('input.jb-rate', { type: 'text', inputmode: 'numeric', 'aria-label': x.name + ' weight', value: String(L.weights[x.id] || 0), onchange: e => { L.weights[x.id] = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0; re(); } })))));
} });
BZ.loadSpec = day0 => { let day = day0 || today();
  return { title: 'Load sheet', render: page => { const routes = q.visibleRoutes().length ? q.visibleRoutes() : q.routes();
    return ui.list(
      ui.section({ footer: 'What each truck will pick up or carry, added up from the items on its stops, against what the truck holds.' }, ui.dateRow({ title: 'Day', icon: 'calendar', iconColor: 'var(--red)', value: day, onChange: v => { day = v; page.refresh(); } })),
      routes.map(r => { const x = loadFor(r.id, day), v = q.vehicle(r.vehicleId), pct = x.cap ? x.lb / x.cap : 0;
        return ui.section({ header: h('span.hstack', { style: 'gap:6px' }, ui.dot(q.routeColor(r.id)), q.routeName(r) + (v ? ' · ' + v.name : '')) },
          ui.row({ title: plural(x.stops.length, 'stop'), subtitle: WD.itemsLabel(x.items, false) || 'Nothing to load', detail: fmt.weight(x.lb) }),
          x.stops.length > 0 && h('div.bz-bar' + (pct > 1 ? '.over' : ''), ui.progress(pct), h('small', h('span', Math.round(pct * 100) + '% of ' + fmt.weight(x.cap)), h('span', pct > 1 ? fmt.weight(x.lb - x.cap) + ' over' : fmt.weight(x.cap - x.lb) + ' to spare'))),
          x.fullAt && ui.row({ icon: 'exclamationmark.triangle', iconPlain: true, iconColor: 'var(--red)', title: 'Full at stop ' + x.fullAt.n, subtitle: x.fullAt.job.title + ' · plan a trip to unload before it, or move stops to another route', chevron: true, onTap: () => WD.screens.jobs.openDetails(x.fullAt.job.id) })); }),
      admin() && ui.section(null, ui.row({ icon: 'gearshape', iconPlain: true, title: 'Capacity and weights', tint: true, chevron: true, onTap: () => page.push(BZ.loadSettingsSpec()) })));
  } }; };

/* ================= Mileage and expenses ================= */
const M = data.mileage = { rate: 0.7, own: false }, EXP_KINDS = ['Fuel', 'Tolls', 'Parking', 'Meals', 'Supplies', 'Repairs', 'Other'];
data.expenses = [{ id: 'e1', userId: 'u4', day: D.add(today(), -1), kind: 'Fuel', amount: 86.4, note: 'Diesel · Truck 12', receipt: true, status: 'approved' }, { id: 'e2', userId: 'u5', day: D.add(today(), -2), kind: 'Tolls', amount: 7.5, note: 'Loop 1 toll', receipt: false, status: 'submitted' }, { id: 'e3', userId: 'u4', day: today(), kind: 'Supplies', amount: 23.18, note: 'Padlocks for consoles', receipt: true, status: 'submitted' }];
/** Miles for a route's day: shop → each located stop in order → shop, along roads (straight-line × 1.3). */
function milesFor(rid, day) { const pts = q.stopList(rid, day).filter(j => !WD.calledOff(j) && j.x != null && j.located !== false); if (!pts.length) return 0; const dep = data.depot || { x: 500, y: 500 }, path = [dep, ...pts, dep]; let d = 0; for (let i = 1; i < path.length; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); return d / 25 * 1.3; }
const ME = { tab: 'miles' }, canApprove = () => WD.can('hr.manage') || admin();
function addExpense(page) { const f = { kind: 'Fuel', amount: '', note: '', receipt: false, day: today() };
  ui.sheet({ title: 'New expense', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Submit', bold: true, onTap: p => { const a = parseFloat(f.amount.replace(/[^0-9.]/g, '')); if (!a) return ui.toast('Enter the amount', 'dollarsign.circle');
      data.expenses.unshift({ id: uid('e'), userId: S.me.id, day: f.day, kind: f.kind, amount: a, note: f.note.trim(), receipt: f.receipt, status: 'submitted' }); WD.changed(); p.dismiss(); page.refresh(); ui.toast('Expense submitted for approval', 'checkmark'); } }],
    render: p => ui.list(ui.section(null, ui.pickerRow({ title: 'What for', value: f.kind, options: EXP_KINDS, onChange: v => { f.kind = v; p.refresh(); } }), ui.inputRow({ label: 'Amount', placeholder: '$0.00', inputmode: 'decimal', value: f.amount, onInput: v => { f.amount = v; } }), ui.dateRow({ title: 'Date', value: f.day, onChange: v => { f.day = v; } }), ui.inputRow({ label: 'Note', placeholder: 'Optional', value: f.note, onInput: v => { f.note = v; } })),
      ui.section({ footer: 'The photo is kept with the expense for bookkeeping.' }, ui.row({ icon: f.receipt ? 'checkmark.circle.fill' : 'camera', iconPlain: true, iconColor: f.receipt ? 'var(--green)' : 'var(--tint)', title: f.receipt ? 'Receipt photo attached' : 'Take a photo of the receipt', tint: !f.receipt, onTap: () => { f.receipt = !f.receipt; p.refresh(); } }))) }, { detent: 'medium' }); }
BZ.mileSpec = () => ({ title: 'Mileage and expenses', trailing: () => ME.tab === 'exp' ? [{ icon: 'plus', label: 'New expense', onTap: p => addExpense(p) }] : [], render: page => {
  const all = canApprove(), mine = myRoute(), routes = all || !mine ? q.routes() : [mine], days = Array.from({ length: 7 }, (_, i) => D.add(today(), -i));
  const body = () => { if (ME.tab === 'miles') { const rows = days.map(d => ({ d, parts: routes.map(r => ({ r, mi: milesFor(r.id, d) })).filter(x => x.mi > 0) })).filter(x => x.parts.length), total = rows.reduce((s, x) => s + x.parts.reduce((a, b) => a + b.mi, 0), 0);
      return ui.list(ui.section({ header: 'Last 7 days · ' + (all || !mine ? 'all routes' : q.routeName(mine)), footer: 'Measured by GPS while location tracking is on, and estimated from the stop order when it isn’t.' },
          rows.map(x => ui.row({ title: fmt.day(x.d), subtitle: x.parts.map(p => h('div.hstack', { style: 'gap:5px' }, ui.dot(q.routeColor(p.r.id)), q.routeName(p.r) + ' · ' + p.mi.toFixed(1) + ' mi')), detail: x.parts.reduce((a, b) => a + b.mi, 0).toFixed(1) + ' mi' })),
          ui.row({ title: h('b', 'Total'), detail: h('b', total.toFixed(1) + ' mi') })),
        ui.section({ header: 'Reimbursement', footer: M.own ? 'For people who drive their own vehicle, such as sales reps. Paid with payroll.' : 'Switch on if anyone drives their own vehicle for work, such as a sales rep. Company trucks only need the miles.' },
          ui.toggleRow({ title: 'Pay mileage for personal vehicles', value: M.own, onChange: v => { if (!admin()) return ui.toast('Ask an admin to change this', 'lock'); M.own = v; WD.changed(); page.refresh(); } }),
          M.own && h('div.row', h('div.row-main', h('div.row-title', 'Rate per mile')), h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': 'Rate per mile', disabled: !admin(), value: '$' + M.rate.toFixed(2), onchange: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); if (!isNaN(v)) M.rate = v; WD.changed(); page.refresh(); } })),
          M.own && ui.row({ title: total.toFixed(1) + ' mi × $' + M.rate.toFixed(2), detail: h('b', money(total * M.rate)) }))); }
    const list = data.expenses.filter(e => all || e.userId === S.me.id).sort((a, b) => b.day.localeCompare(a.day)), open = list.filter(e => e.status === 'submitted');
    return ui.list(ui.section({ header: list.length ? plural(list.length, 'expense') + ' · ' + money(list.reduce((s, e) => s + e.amount, 0)) + (open.length ? ' · ' + open.length + ' to approve' : '') : null, footer: all ? 'Tap a submitted expense to approve it or send it back. Approved expenses are in the export for bookkeeping.' : 'Your expenses. The office approves them.' },
        list.map(e => ui.row({ icon: e.receipt ? 'camera' : 'doc', iconColor: 'var(--gray)', title: e.kind + ' · ' + money(e.amount), subtitle: [(q.user(e.userId) || { name: '' }).name, fmt.day(e.day, 'md'), e.note].filter(Boolean).join(' · '), badge: ui.badge(e.status === 'approved' ? 'Approved' : e.status === 'rejected' ? 'Sent back' : 'Submitted', e.status === 'approved' ? 'var(--green)' : e.status === 'rejected' ? 'var(--red)' : 'var(--orange)'),
          onTap: all && e.status === 'submitted' ? async () => { const v = await ui.actionSheet({ title: e.kind + ' · ' + money(e.amount), message: (q.user(e.userId) || { name: '' }).name + (e.receipt ? ' · receipt attached' : ' · no receipt'), buttons: [{ label: 'Approve', value: 'approved' }, { label: 'Send back', value: 'rejected', role: 'destructive' }] }); if (v) { e.status = v; WD.changed(); page.refresh(); } } : null })),
        !list.length && ui.row({ title: 'No expenses yet' }), ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add an expense', tint: true, onTap: () => addExpense(page) }))); };
  return [h('div.bz-seg', ui.segmented([{ value: 'miles', label: 'Mileage' }, { value: 'exp', label: 'Expenses' }], ME.tab, v => { ME.tab = v; page.refresh(); })), body()];
} });

/* ================= Route performance ================= */
const PF = { days: 30 };
BZ.perfSpec = () => ({ title: 'Route performance', render: page => { if (!(WD.can('analytics.view') || admin())) return ui.empty({ icon: 'lock', title: 'Reports are hidden', text: 'You need the Analytics permission to see route performance.' });
  const from = D.add(today(), -(PF.days - 1)), rev = j => j.billing ? +j.billing.amount || 0 : j.invoice && j.invoice.status !== 'Draft' ? +j.invoice.amount || 0 : 0;
  const stat = rid => { const js = data.jobs.filter(j => j.routeId === rid && !j.allDay && j.day >= from && j.day <= today()), doneJ = js.filter(j => j.status === 'completed'), dset = [...new Set(js.map(j => j.day))];
    const mins = doneJ.reduce((s, j) => s + (j.arrivedAt != null && j.departedAt != null ? Math.max(1, j.departedAt - j.arrivedAt) : j.dur || 0), 0), miles = dset.reduce((s, d) => s + milesFor(rid, d), 0);
    return { rid, done: doneJ.length, skipped: js.filter(j => j.status === 'skipped').length, off: js.filter(j => WD.calledOff(j)).length, revenue: doneJ.reduce((s, j) => s + rev(j), 0), unbilled: doneJ.filter(j => !rev(j) && j.type !== 'meet' && j.type !== 'creditCard').length, mins, miles, days: dset.length }; };
  const rows = q.routes().map(r => stat(r.id)), sum = k => rows.reduce((s, x) => s + x[k], 0), top = Math.max(1, ...rows.map(x => x.revenue)), per = (a, b, f) => b ? f(a / b) : '—';
  const kpi = (v, t) => h('div', h('b', v), h('span', t));
  return [h('div.bz-seg', ui.segmented([{ value: 7, label: 'Last 7 days' }, { value: 30, label: 'Last 30 days' }], PF.days, v => { PF.days = v; page.refresh(); })),
    ui.list(ui.section({ header: 'All routes · ' + fmt.day(from, 'md') + ' – ' + fmt.day(today(), 'md') }, h('div.bz-kpi', kpi(money(sum('revenue')).replace(/\.\d\d$/, ''), 'Billed'), kpi(String(sum('done')), 'Stops completed'), kpi(per(sum('revenue'), sum('done'), money), 'Per stop'), kpi(per(sum('revenue'), sum('mins') / 60, v => money(v).replace(/\.\d\d$/, '')), 'Per hour on site'), kpi(per(sum('revenue'), sum('miles'), money), 'Per mile'), kpi(String(sum('skipped') + sum('off')), 'Skipped or called off'))),
      rows.sort((a, b) => b.revenue - a.revenue).map(x => ui.section({ header: h('span.hstack', { style: 'gap:6px' }, ui.dot(q.routeColor(x.rid)), q.routeName(x.rid) + ' · ' + plural(x.days, 'day')) },
        ui.row({ title: money(x.revenue) + ' billed', subtitle: plural(x.done, 'stop') + ' completed' + (x.skipped ? ' · ' + x.skipped + ' skipped' : '') + (x.off ? ' · ' + x.off + ' called off' : ''), detail: per(x.revenue, x.done, money) + ' a stop' }),
        h('div.bz-bar', ui.progress(x.revenue / top), h('small', h('span', per(x.revenue, x.mins / 60, v => money(v).replace(/\.\d\d$/, '')) + ' per hour on site · ' + fmt.dur(Math.round(x.mins)) + ' on site'), h('span', per(x.revenue, x.miles, money) + ' per mile · ' + num(x.miles) + ' mi'))),
        x.unbilled > 0 && ui.row({ icon: 'exclamationmark.circle', iconPlain: true, iconColor: 'var(--orange)', title: plural(x.unbilled, 'completed stop') + ' not billed', subtitle: 'Money left on the route' }))),
      h('div', { style: 'padding:10px 4px 0' }, ui.note('Billed is what was invoiced or collected for stops completed in these dates. Time on site is from arrival to departure; miles are from the shop, through the stops, and back.')))];
} });

/* ================= Where it all lives ================= */
const ENTRIES = () => [
  ['briefcase', 'var(--indigo)', 'Business type and wording', BZ.industryName(), BZ.wordingSpec, 'Your industry, the wording on invoices, starter items'],
  ['checklist', 'var(--green)', 'Service checklists', plural(Object.values(data.checklists).reduce((s, l) => s + l.length, 0), 'item'), BZ.checklistSpec, 'Steps and required photos for each job type'],
  ['square.and.pencil', 'var(--blue)', 'Custom fields', plural(data.customFields.length, 'field'), BZ.fieldsSpec, 'Your own fields on customers and jobs'],
  ['truck', 'var(--orange)', 'Fleet and compliance', BZ.fleetBadge() ? plural(BZ.fleetBadge(), 'item') + ' need attention' : 'Up to date', BZ.fleetSpec, 'Pre-trip inspections, maintenance, expiring documents and licenses'],
  ['shippingbox', 'var(--teal)', 'Load sheet and truck capacity', '', () => BZ.loadSpec(), 'What each truck carries today and where it fills up'],
  ['gauge', 'var(--purple)', 'Mileage and expenses', '', BZ.mileSpec, 'Miles by route and day, expenses with receipts'],
  ['chart.bar', 'var(--red)', 'Route performance', '', BZ.perfSpec, 'Billed per stop, per hour and per mile, by route']];
BZ.hubSection = row => ui.section({ header: 'Your kind of business', footer: 'For any business that runs routes: service, delivery or sales.' }, ENTRIES().map(e => row(...e)));
BZ.homeSpec = () => ({ title: 'Your kind of business', render: page => ui.list(BZ.hubSection((ic, color, title, detail, spec, sub) => ui.row({ icon: ic, iconColor: color, title, subtitle: [detail && h('div', { style: 'color:var(--label);font-weight:500' }, detail), sub && h('div', sub)], chevron: true, onTap: () => page.push(spec()) }))) });

/* The Shift tab gets the driver's own pieces: today's inspection, and mileage and expenses. */
if (WD.screens.shift && WD.screens.shift.root) { const root = WD.screens.shift.root;
  WD.screens.shift.root = () => { const spec = root(), render = spec.render;
    spec.render = page => { const r = myRoute(), v = r && q.vehicle(r.vehicleId);
      return [].concat(render(page), ui.list(ui.section({ header: 'Vehicle and expenses' },
        !v && ui.row({ icon: 'checklist', iconColor: 'var(--orange)', title: 'Pre-trip inspection', subtitle: 'Choose the vehicle you’re taking', chevron: true, onTap: async () => { const id = await ui.actionSheet({ title: 'Which vehicle?', buttons: data.vehicles.filter(x => x.active !== false).map(x => ({ label: x.name + (inspectedToday(x.id) ? ' · done today' : ''), value: x.id })) }); if (id) BZ.inspect(q.vehicle(id), () => page.refresh()); } }),
        v && ui.row({ icon: 'checklist', iconColor: inspectedToday(v.id) ? 'var(--green)' : 'var(--orange)', title: 'Pre-trip inspection', subtitle: v.name + (inspectedToday(v.id) ? ' · done today' : ' · not done today'), detail: inspectedToday(v.id) ? null : 'Start', chevron: true, onTap: () => BZ.inspect(v, () => page.refresh()) }),
        ui.row({ icon: 'gauge', iconColor: 'var(--purple)', title: 'Mileage and expenses', subtitle: 'Your miles, and receipts to turn in', chevron: true, onTap: () => page.push(BZ.mileSpec()) })))); };
    return spec; }; }

const openSet = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
WD.panel.addJump('Business type and wording', () => openSet(BZ.wordingSpec()));
WD.panel.addJump('Fleet and compliance', () => openSet(BZ.fleetSpec()));
WD.panel.addJump('Load sheet', () => { WD.nav.switchTab('board'); WD.nav.push(BZ.loadSpec(S.board.day)); });
WD.panel.addJump('Route performance', () => openSet(BZ.perfSpec()));
})();
