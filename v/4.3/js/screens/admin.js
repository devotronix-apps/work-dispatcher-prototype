/* Company administration: sign-in policy, job types and the fields each one asks for, customer types (opened from Customers → gear), importing jobs from a calendar file (.ics)
   or a spreadsheet (Excel / CSV), and the "connect your tools" step for new companies. Registers WD.admin. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD;

WD.css(`
.ad-swatch { width: 14px; height: 14px; border-radius: 50%; flex: none; }
.ad-map { display: grid; grid-template-columns: 1fr auto; gap: 0; }
.ad-sample { font-size: 12px; color: var(--label2); }
.ad-int { display: flex; gap: 12px; align-items: center; }
.ad-steps { margin: 0; padding: 4px 16px 12px 34px; font-size: 14px; line-height: 20px; color: var(--label2); }
`);

/* ---------- Sign-in and security ---------- */
function signInSpec() {
  return { title: 'Sign-in and security', render: page => { const edit = WD.can('settings.manage');
    return ui.list(
      ui.section({ header: 'Require signing in again', footer: 'Applies to everyone at ' + (S.org || data.orgs[0]).name + '. Between sign-ins the app opens straight to the board. Signing out, removing someone from the team or deactivating them always ends their session.' },
        WD.signInPolicies.map(p => ui.row({ title: p.label, trailing: S.signInPolicy === p.value ? icon('checkmark', 20, 'var(--tint)') : null, disabled: !edit, onTap: edit ? () => { WD.setSignInPolicy(p.value); page.refresh(); ui.toast('Saved', 'checkmark'); } : null }))),
      ui.section({ footer: 'Asks for Face ID (or the iPhone passcode) when the app opens, without a full sign-in. Useful on shared trucks.' },
        ui.toggleRow({ title: 'Require Face ID to open', value: S.faceId, disabled: !edit, onChange: v => { WD.setSignInPolicy(null, v); } })),
      !edit && h('div', { style: 'margin-top:8px' }, ui.note('Only an owner or admin can change these.')));
  } };
}

/* ---------- Job types and fields ---------- */
function typesSpec() {
  const reqN = list => (list || []).length;
  return { title: 'Job types and fields', render: page => ui.list(
    ui.section({ header: 'Job types', fold: false, footer: 'Each type has its own color on the board and map (the route color rims it), its own list of fields in the job editor, which of them are required, and whether it needs an address. Add your own, rename them, and choose which are offered when creating a job.' },
      WD.jobTypes.filter(t => !t.system).map(t => { const n = (data.fieldConfig[t.id] || []).length, r = reqN((data.required.job[t.id] || []).filter(k => WD.asks(t.id, k)));
        return ui.row({ leading: h('span.ad-swatch', { style: { background: t.color } }), title: t.title, badge: t.hidden ? ui.badge('Not offered', 'var(--gray)') : null, subtitle: n + ' of ' + WD.fieldDefs.length + ' fields · ' + r + ' required · ' + ({ address: 'street address', cityzip: 'city or ZIP', none: 'no address' })[data.addressRules[t.id] || 'address'], chevron: true, onTap: () => page.push(typeSpec(t)) }); }),
      WD.can('settings.manage') && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a job type', tint: true, onTap: async () => {
        const r = await ui.alert({ title: 'New job type', message: 'For example “Hard drive pickup”, “Estimate” or “Warranty visit”.', input: { placeholder: 'Name' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] }); if (!r || !r.value || !r.text.trim()) return;
        const id = 't' + Date.now().toString(36), colors = ['#00897B', '#8E24AA', '#EF6C00', '#5D4037', '#1E88E5', '#C0CA33', '#D81B60'], t = { id, title: r.text.trim(), color: colors[WD.jobTypes.length % colors.length], custom: true };
        WD.jobTypes.push(t); data.fieldConfig[id] = (data.fieldConfig.regular || []).slice(); data.required.job[id] = ['phone']; data.addressRules[id] = 'address'; WD.changed(); page.push(typeSpec(t)); } })),
    WD.r11 && WD.r11.materialsSection(page)) };
}
/* ---------- Customer types (opened from Customers → gear) ---------- */
function custTypesSection(page) {
  const reqN = list => (list || []).length, edit = WD.can('settings.manage');
  return ui.section({ header: 'Customer types', fold: false, footer: 'Customer type is separate from job type. Fields required here are required for every job and record of that kind of customer — for example email for government customers. A hidden type is no longer offered for new customers; customers that have it keep it.' },
    WD.custTypes.map(t => ui.row({ icon: t.id === 'residential' ? 'house' : 'building', iconColor: 'var(--indigo)', title: t.title, badge: t.hidden ? ui.badge('Hidden', 'var(--gray)') : null, subtitle: reqN(data.required.cust[t.id]) ? 'Requires ' + data.required.cust[t.id].map(WD.fieldLabel).join(', ').toLowerCase() : 'Nothing extra required', chevron: true, onTap: () => page.push(custTypeSpec(t)) })),
    edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a customer type', tint: true, onTap: async () => {
      const r = await ui.alert({ title: 'New customer type', message: 'For example “Medical”, “Property manager” or “Non-profit”.', input: { placeholder: 'Name' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] }); if (!r || !r.value || !r.text.trim()) return;
      const id = 'ct' + Date.now().toString(36); WD.custTypes.push({ id, title: r.text.trim(), custom: true }); data.required.cust[id] = []; WD.changed(); page.refresh(); } }));
}
function custTypesSpec() { return { title: 'Customer types', render: page => ui.list(custTypesSection(page)) }; }
const STATES = [{ value: 'off', label: 'Hide' }, { value: 'ask', label: 'Ask' }, { value: 'req', label: 'Require' }];
function typeSpec(t) {
  return { title: t.title, render: page => { const edit = WD.can('settings.manage'), on = new Set(data.fieldConfig[t.id] || []), req = new Set(data.required.job[t.id] || []);
    const set = (k, v) => { v === 'off' ? on.delete(k) : on.add(k); v === 'req' ? req.add(k) : req.delete(k);
      data.fieldConfig[t.id] = WD.fieldDefs.map(x => x[0]).filter(x => on.has(x)); data.required.job[t.id] = WD.REQUIRABLE.filter(x => req.has(x)); page.refresh(); };
    const state = k => !on.has(k) ? 'off' : req.has(k) ? 'req' : 'ask';
    const inUse = data.jobs.some(j => j.type === t.id) || data.customers.some(c => c.type === t.id), COLORS = ['#616161', '#F6BF26', '#D50000', '#E67C73', '#3F51B5', '#039BE5', '#00897B', '#8E24AA', '#EF6C00', '#5D4037', '#C0CA33', '#D81B60'];
    return ui.list(
      edit && ui.section({ header: 'Name and color', fold: false, footer: t.hidden ? 'Not offered when creating a job. Jobs that already have this type keep it.' : 'Offered in the job type list when creating a job.' },
        ui.row({ title: 'Name', detail: t.title, chevron: true, onTap: async () => { const r = await ui.alert({ title: 'Job type name', input: { value: t.title }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (r && r.value && r.text.trim()) { t.title = r.text.trim(); WD.changed(); page.setTitle(t.title); page.refresh(); } } }),
        h('div.row', { style: 'flex-wrap:wrap;gap:8px' }, COLORS.map(c => h('button', { 'aria-label': 'Color ' + c, style: { width: '28px', height: '28px', borderRadius: '50%', border: c === t.color ? '3px solid var(--label)' : '1px solid var(--sep)', background: c, cursor: 'pointer', padding: 0 }, onclick: () => { t.color = c; WD.changed(); page.refresh(); } }))),
        ui.toggleRow({ title: 'Offer when creating a job', value: !t.hidden, onChange: v => { if (!v && WD.shownJobTypes().length < 2) { ui.toast('Keep at least one job type', 'info.circle'); return false; } t.hidden = !v; WD.changed(); page.refresh(); } }),
        ui.row({ title: 'Delete this job type', destructive: true, onTap: async () => { if (inUse) return ui.alert({ title: 'This type is in use', message: 'Jobs or customers already use “' + t.title + '”. Switch off “Offer when creating a job” to retire it; their history keeps the type.' });
          if (WD.shownJobTypes().length < 2 && !t.hidden) return ui.toast('Keep at least one job type', 'info.circle');
          if (await ui.actionSheet({ title: 'Delete “' + t.title + '”?', buttons: [{ label: 'Delete job type', value: true, role: 'destructive' }] })) { WD.jobTypes.splice(WD.jobTypes.indexOf(t), 1); delete data.fieldConfig[t.id]; delete data.required.job[t.id]; delete data.addressRules[t.id]; WD.changed(); page.pop(); } } })),
      ui.section({ header: 'Fields', footer: 'Hide leaves a field out of the editor (information already saved stays on the customer). Ask shows it. Require shows it in red and the job can’t be saved without it.' + (t.id === 'meet' ? ' Meet-the-truck jobs usually only need a name and phone.' : '') },
        ui.row({ title: 'Customer name', detail: 'Always required' }),
        WD.fieldDefs.map(([k, label]) => { const can = WD.REQUIRABLE.includes(k), opts = can ? STATES : STATES.slice(0, 2);
          return h('div.row', h('div.row-main', h('div.row-title', label)), edit ? h('div', { style: 'width:' + (can ? 176 : 118) + 'px;flex:none' }, ui.segmented(opts, state(k), v => set(k, v))) : h('div.row-detail', STATES.find(s => s.value === state(k)).label)); })),
      ui.section({ header: 'Address', footer: 'A job missing what its type needs can still be saved after a warning, is marked on the board, and is listed in the missing-address notice until it’s fixed or ignored.' },
        ui.pickerRow({ title: 'This job type needs', value: data.addressRules[t.id] || 'address', options: WD.ADDRESS_RULES, disabled: !edit, onChange: v => { data.addressRules[t.id] = v; WD.changed(); page.refresh(); } })),
      edit && ui.section(ui.row({ title: 'Preview the job editor', tint: true, onTap: () => WD.screens.jobs && WD.screens.jobs.openEditor({ day: D.today(), routeId: 'r1', type: t.id }) })));
  } };
}
function custTypeSpec(t) {
  return { title: t.title + ' customers', render: page => { const edit = WD.can('settings.manage'), req = new Set(data.required.cust[t.id] || []);
    const used = data.customers.some(c => c.custType === t.id) || data.jobs.some(j => j.custType === t.id);
    return ui.list(edit && ui.section({ header: 'Name', fold: false, footer: t.id === 'business' ? 'Business customers can be marked “Credit card on file”, which charges the card when a stop is completed.' : null },
        ui.row({ title: 'Name', detail: t.title, chevron: true, onTap: async () => { const r = await ui.alert({ title: 'Customer type name', input: { value: t.title }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (r && r.value && r.text.trim()) { t.title = r.text.trim(); WD.changed(); page.setTitle(t.title + ' customers'); page.refresh(); } } }),
        ui.toggleRow({ title: 'Offer for new customers', subtitle: t.hidden ? 'Hidden: customers that already have this type keep it' : null, value: !t.hidden, onChange: v => { if (!v && WD.custTypes.filter(x => !x.hidden).length < 2) { ui.toast('Keep at least one customer type', 'info.circle'); return false; } t.hidden = !v; WD.changed(); page.refresh(); } }),
        WD.custTypes.length > 1 && ui.row({ title: 'Delete this customer type', destructive: true, onTap: async () => { if (used) return ui.alert({ title: 'This type is in use', message: 'Change the customers that are “' + t.title + '” to another type first.' });
          if (await ui.actionSheet({ title: 'Delete “' + t.title + '”?', buttons: [{ label: 'Delete customer type', value: true, role: 'destructive' }] })) { WD.custTypes.splice(WD.custTypes.indexOf(t), 1); delete data.required.cust[t.id]; WD.changed(); page.pop(); } } })),
      ui.section({ header: 'Required for ' + t.title.toLowerCase() + ' customers', footer: 'These are required on top of what the job type requires, on new customers and on their jobs.' },
      WD.REQUIRABLE.map(k => ui.toggleRow({ title: WD.fieldLabel(k), value: req.has(k), disabled: !edit, onChange: v => { v ? req.add(k) : req.delete(k); data.required.cust[t.id] = WD.REQUIRABLE.filter(x => req.has(x)); } }))));
  } };
}

/* ---------- Import jobs: calendar file (.ics) or spreadsheet ---------- */
const SOURCES = {
  ics: { title: 'Calendar file (.ics)', icon: 'calendar', color: 'var(--red)', about: 'Export from Outlook, Apple Calendar, Google Calendar or most scheduling programs.', files: ['Shred schedule.ics', 'Outlook — Routes calendar.ics'] },
  xlsx: { title: 'Spreadsheet (Excel or CSV)', icon: 'list.bullet', color: 'var(--green)', about: 'One row per job or per customer. You match the columns on the next step.', files: ['Customer route list.xlsx', 'Jobs export.csv'] },
};
const COLUMNS = [['Service date', 'day', 'Nov 17, 2026'], ['Customer', 'title', 'Harlow & Finch Law'], ['Address', 'address', '210 Mercer St, Suite 400'], ['Phone', 'phone', '(512) 555-0142'], ['Route', 'route', 'North'], ['Containers', 'items', '4 consoles'], ['Frequency', 'freq', 'Weekly'], ['Notes', 'notes', 'Check in at reception']];
const TARGETS = [['day', 'Date'], ['title', 'Customer / title'], ['address', 'Address'], ['phone', 'Phone'], ['email', 'Email'], ['route', 'Route'], ['items', 'Containers'], ['freq', 'Frequency'], ['po', 'PO number'], ['notes', 'Notes'], ['skip', 'Don’t import']];
function importSpec() {
  return { title: 'Import jobs', render: page => ui.list(
    ui.section({ header: 'Moving from another program?', footer: 'Nothing is saved until you review a dry run. Imported customers are matched to existing ones by name, phone and address.' },
      Object.entries(SOURCES).map(([k, s]) => ui.row({ icon: s.icon, iconColor: s.color, title: s.title, subtitle: s.about, chevron: true, onTap: () => pickFile(page, k) })),
      ui.row({ icon: 'calendar', iconColor: 'var(--blue)', title: 'Google Calendar', subtitle: 'Read each connected route calendar once', chevron: true, onTap: () => dryRun(page, 'google', 'Google Calendar · 4 calendars') })),
    ui.section({ header: 'Recent imports' }, ui.row({ title: 'Google Calendar', subtitle: '1,284 jobs · 212 customers', detail: 'Oct 2' }))) };
}
async function pickFile(page, kind) {
  const s = SOURCES[kind], file = await ui.actionSheet({ title: 'Choose a file', message: 'Files, iCloud Drive, OneDrive or email attachments', buttons: s.files.map(f => ({ label: f })) });
  if (!file) return;
  if (kind === 'xlsx') page.push(mappingSpec(file)); else dryRun(page, 'ics', file);
}
function mappingSpec(file) {
  const map = Object.fromEntries(COLUMNS.map(([c, t]) => [c, t]));
  return { title: 'Match columns', render: p => ui.list(
    ui.section({ header: file + ' · 318 rows', footer: 'Columns were matched by their headings. Change any that are wrong. Rows without a date become customers only.' },
      COLUMNS.map(([col, , sample]) => ui.pickerRow({ title: col, subtitle: 'e.g. ' + sample, value: map[col], options: TARGETS.map(([value, label]) => ({ value, label })), onChange: v => { map[col] = v; p.refresh(); } }))),
    h('div', { style: 'margin-top:16px' }, ui.button('Continue', { onTap: () => dryRun(p, 'xlsx', file) }))) };
}
async function dryRun(page, kind, file) {
  const ok = await ui.run('Reading ' + file + '…', null, { min: 1200, max: 1800 }); if (!ok) return;
  const r = kind === 'ics' ? { found: 214, jobs: 196, series: 38, cust: 61, newCust: 19, notes: 12, noAddr: 6, dupes: 3 } : kind === 'xlsx' ? { found: 318, jobs: 291, series: 44, cust: 88, newCust: 27, notes: 0, noAddr: 9, dupes: 5 } : { found: 402, jobs: 377, series: 52, cust: 94, newCust: 8, notes: 18, noAddr: 4, dupes: 2 };
  let route = 'auto', from = 'today';
  page.push({ title: 'Dry run', render: p => ui.list(
    ui.section({ header: file, footer: 'Recurring events are imported as recurring jobs. Events without an address become day notes; you can fix them later.' },
      ui.row({ title: 'Events found', detail: String(r.found) }), ui.row({ title: 'Jobs to create', detail: String(r.jobs) }), ui.row({ title: 'Recurring series', detail: String(r.series) }),
      ui.row({ title: 'Matched to existing customers', detail: String(r.cust) }), ui.row({ title: 'New customers', detail: String(r.newCust) }),
      r.notes ? ui.row({ title: 'All-day events → day notes', detail: String(r.notes) }) : null,
      ui.row({ title: 'Address not found', detail: String(r.noAddr), subtitle: 'Imported with a ? until fixed' }), ui.row({ title: 'Possible duplicates', detail: String(r.dupes), subtitle: 'Skipped — listed in the report' })),
    ui.section({ header: 'Options' },
      ui.pickerRow({ title: 'Put jobs on', value: route, options: [{ value: 'auto', label: kind === 'xlsx' ? 'Route column' : 'Calendar name → route' }, ...q.routes().map(x => ({ value: x.id, label: q.routeName(x) }))], onChange: v => { route = v; p.refresh(); } }),
      ui.pickerRow({ title: 'Import', value: from, options: [{ value: 'today', label: 'Today and later' }, { value: 'all', label: 'Everything, including past visits' }], onChange: v => { from = v; p.refresh(); } })),
    h('div', { style: 'margin-top:16px' }, ui.button('Import ' + r.jobs + ' jobs', { onTap: async () => { if (await ui.run('Importing…', null, { min: 1600, max: 2200, done: 'Imported' })) { p.pop(); setTimeout(() => ui.toast(r.jobs + ' jobs and ' + r.newCust + ' new customers added', 'checkmark', 2600), 450); } } }))) });
}

/* ---------- New company: connect your tools ---------- */
/** Pushed after a company is created. Every step can be skipped; Settings → Integrations has the same setup later. */
function connectPage(from, done) {
  const list = (WD.integrations || []).filter(x => !x.via).map(x => ({ ...x, connected: false }));   // a new company starts with nothing connected
  from.push({ title: 'Connect your tools', back: false, render: page => h('div',
    ui.list(
      ui.section({ header: 'Bring in your schedule', footer: 'Moving from another calendar program or a spreadsheet? Import it now or later.' },
        ui.row({ icon: 'calendar', iconColor: 'var(--red)', title: 'Import a calendar file (.ics)', chevron: true, onTap: () => pickFile(page, 'ics') }),
        ui.row({ icon: 'list.bullet', iconColor: 'var(--green)', title: 'Import from Excel or CSV', chevron: true, onTap: () => pickFile(page, 'xlsx') })),
      ui.section({ header: 'Integrations', footer: 'Connect the services you already use. Each one asks for its own sign-in or API key.' },
        list.map(x => ui.row({ icon: x.icon, iconColor: x.color, title: x.name, subtitle: x.pitch || x.about, trailing: x.connected ? ui.badge('Connected', 'var(--green)') : ui.button('Connect', { kind: 'tinted', small: true, block: false, onTap: async e => { e.stopPropagation(); if (await ui.run('Connecting ' + x.name + '…', () => { x.connected = true; x.lastSync = +WD.now(); }, { done: 'Connected' })) page.refresh(); } }) })))),
    h('div.au-foot', ui.button('Continue', { onTap: done }), ui.button('Skip for now', { kind: 'plain', onTap: async () => {
      await ui.alert({ title: 'Connect any time', message: 'Open Settings → Integrations to connect OneStep GPS, Invoice Ninja, Quo, Gmail or the leads sheet. Settings → Import jobs brings in a calendar file or spreadsheet. Each page has step-by-step instructions.' }); done(); } }))) });
}

WD.admin = { signInSpec, typesSpec, custTypesSpec, custTypesSection, importSpec, connectPage };
WD.panel.addJump('Import jobs', () => { WD.nav.switchTab('settings'); WD.nav.push(importSpec()); });
WD.panel.addJump('Job type fields', () => { WD.nav.switchTab('settings'); WD.nav.push(typesSpec()); });
})();
