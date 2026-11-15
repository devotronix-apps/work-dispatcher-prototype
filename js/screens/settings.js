/* Work Dispatcher prototype — Settings tab: profile and company, personal route preferences, board options, pending changes,
   Google Calendar mirror, team and roles, vehicles, location-tracking consent, integrations, privacy and account.
   Rule for permissions: rows the signed-in role can't use stay visible but disabled with "Ask an admin";
   pages reached anyway (control-panel jumps) show the same message. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, api } = WD;

WD.css(`
.st-profile { min-height: 82px; }
.st-profile .row-title { font-size: 20px; font-weight: 600; letter-spacing: .3px; }
.st-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
.st-member { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 16px 0; text-align: center; overflow-wrap: anywhere; }
.st-big { width: 64px; height: 64px; border-radius: 15px; }
.row.st-op { flex-direction: column; align-items: stretch; gap: 3px; padding: 11px 16px; }
.st-op-head { display: flex; align-items: flex-start; gap: 10px; }
.st-op-head > div { flex: 1; min-width: 0; }
.st-op-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 7px; }
.st-order { display: flex; gap: 6px; flex: none; }
.st-arrow { border: 0; width: 30px; height: 30px; border-radius: 15px; display: grid; place-items: center; background: var(--fill3); color: var(--tint); cursor: pointer; padding: 0; }
.st-arrow:disabled { color: var(--label3); cursor: default; }
.row.st-colors { flex-wrap: wrap; gap: 11px; padding: 12px 16px; }
.st-swatch { width: 30px; height: 30px; border-radius: 50%; border: 0; padding: 0; cursor: pointer; box-shadow: inset 0 0 0 .5px var(--sep); }
.st-custom { position: relative; background: conic-gradient(#f44336, #ffeb3b, #4caf50, #00bcd4, #3f51b5, #e91e63, #f44336); overflow: hidden; display: inline-block; }
.st-custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; border: 0; padding: 0; }
.st-swatch.on { box-shadow: 0 0 0 2px var(--cell), 0 0 0 4px var(--label); }
.st-seg { width: 136px; flex: none; }
.st-stage { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 32px; text-align: center; }
.st-stage .progress { width: 100%; }
.st-foot { padding: 0 16px 24px; }
.st-tool { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
`);

/* ---------- Shared helpers ---------- */
const PRICE = 29, ADMIN = 'Ask an admin';
/* Google Calendar's colors first (they mirror cleanly), then more choices; any color can also be picked with Custom. */
const PALETTE = ['#D50000', '#E67C73', '#F4511E', '#F6BF26', '#33B679', '#0B8043', '#039BE5', '#3F51B5', '#7986CB', '#8E24AA', '#616161',
  '#AD1457', '#F09300', '#C0CA33', '#7CB342', '#009688', '#4285F4', '#B39DDB', '#795548', '#A79B8E', '#E4C441', '#00ACC1', '#5E35B1', '#D81B60', '#EF6C00', '#827717', '#1A237E', '#263238'];
const ZONES = [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific']].map(([value, label]) => ({ value, label }));
const ROLE_COLOR = { owner: 'var(--purple)', admin: 'var(--indigo)', dispatcher: 'var(--blue)', office: 'var(--teal)', driver: 'var(--orange)', staff: 'var(--brown)' };
const ROLE_INFO = { owner: 'Everything, including billing and the company itself.', admin: 'Everything except transferring ownership.', dispatcher: 'Edits jobs, sees live trucks, customers and reports.', office: 'Edits jobs and customers, handles invoices and payments.', driver: 'Sees their route, runs shifts, updates stop status and invoices on site.', staff: 'Clocks in and out for shop, office or helper work. No route.' };
const KIND = { create: 'New job', edit: 'Edit', delete: 'Delete', reassign: 'Reassign', status: 'Status', batch: 'Several jobs' };
const VEHICLE_KINDS = ['Shred truck', 'Box truck (purges)', 'Van'];
const roleBadge = r => ui.badge(WD.roles[r].title, ROLE_COLOR[r]);
const permsOf = u => u.perms || WD.roles[u.role].perms;
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);
const when = t => { const d = new Date(t), k = WD.date.key(d); return k === WD.date.today() ? 'today at ' + fmt.clock(d) : 'on ' + fmt.day(k, 'md'); };
const uid = p => p + Date.now().toString(36);
const blur = () => { const a = document.activeElement; if (a && a.blur) a.blur(); };
/** A row the current role may not use: disabled, "Ask an admin". */
const gated = (flag, o) => WD.can(flag) ? o : { ...o, disabled: true, subtitle: ADMIN, onTap: null, chevron: false, badge: null };
const locked = () => ui.empty({ icon: 'lock', title: ADMIN, text: 'Your role doesn’t include this. An owner or admin can grant it in Team and roles.' });
/** Nav-bar button kept as a node so forms can enable it while typing. */
const navBtn = (label, onTap, enabled) => h('button.nav-btn.bold', { disabled: !enabled, onclick: onTap }, label);
const confirm = async (title, message, label, cancel) => !!await ui.actionSheet({ title, message, buttons: [{ label, role: 'destructive', value: true }], cancel });
const online = () => { if (!S.offline) return true; ui.alert({ title: 'No Internet Connection', message: 'This needs a connection. Try again when you’re back online.' }); return false; };
const openIn = spec => { WD.nav.switchTab('settings'); WD.nav.push(spec); };
const org = () => S.org || data.orgs[0];

/* ---------- Root ---------- */
function root() {
  return { title: 'Settings', large: true, render: page => {
    const me = S.me, o = org(), n = S.pending.length, issues = S.pending.filter(x => x.status === 'conflict' || x.status === 'failed').length, push = s => page.push(s);
    return ui.list(
      ui.section(ui.row({ class: 'st-profile', leading: ui.avatar(me.name, { size: 58 }), title: me.name, subtitle: h('span', me.email, h('span.st-meta', roleBadge(me.role), o.name)), chevron: true, onTap: () => push(accountSpec()) })),
      ui.section('Company',
        ui.row({ icon: 'building', iconColor: 'var(--indigo)', title: 'Company', detail: o.name, chevron: true, onTap: () => push(orgsSpec()) }),
        ui.row(gated('billing.view', { icon: 'creditcard', iconColor: 'var(--green)', title: 'Subscription', ...plan(o) })),
        ui.row({ icon: 'lock', iconColor: 'var(--gray)', title: 'Sign-in and security', detail: (WD.signInPolicies.find(x => x.value === S.signInPolicy) || {}).label, chevron: true, onTap: () => WD.admin && push(WD.admin.signInSpec()) }),
        ui.row({ icon: 'globe', iconColor: 'var(--blue)', title: 'Open web dashboard', trailing: icon('arrow.up.right', 17, 'var(--label3)'), onTap: () => ui.toast('Analytics, CRM and billing are on the web', 'globe', 2600) })),
      ui.section({ header: 'Routes and board', footer: 'Single-route portrait view shows 1 or 3 days from the active day. Landscape always shows 7.' },
        ui.row({ icon: 'route', iconColor: 'var(--blue)', title: 'Routes', detail: q.visibleRoutes().length + ' of ' + data.routes.length + ' shown', chevron: true, onTap: () => push(routesSpec()) }),
        ui.pickerRow({ icon: 'arrow.triangle.turn.up.right', iconColor: 'var(--green)', title: 'Directions app', subtitle: 'Opens for Navigate and Directions', value: S.prefs.mapsApp, options: WD.MAPS_APPS, onChange: v => { S.prefs.mapsApp = v; WD.changed(); ui.toast('Directions open in ' + WD.workflow.mapsName(), 'checkmark'); } }),
        ui.row({ icon: 'columns', iconColor: 'var(--teal)', title: 'Single route', trailing: h('div.st-seg', ui.segmented([{ value: 1, label: '1 day' }, { value: 3, label: '3 days' }], S.board.dayCount, v => { S.board.dayCount = v; WD.changed(); })) })),
      ui.section({ header: 'Sync', footer: S.offline ? 'You’re offline. Changes are saved on this iPhone and sync when the connection returns.' : null },
        ui.row({ icon: 'cloud', iconColor: 'var(--teal)', title: 'Offline data', subtitle: 'Jobs, customers, GPS coordinates and the map saved on this iPhone', chevron: true, onTap: () => push(WD.x.offlineSpec()) }),
        ui.row({ icon: 'sync', iconColor: issues ? 'var(--orange)' : 'var(--gray)', title: 'Pending changes', badge: issues ? ui.badge(issues + ' to review', 'var(--orange)') : null, detail: n ? String(n) : 'None', chevron: true, onTap: openPending })),
      ui.section('Administration',
        ui.row(gated('settings.manage', { icon: 'calendar', iconColor: 'var(--blue)', title: 'Google Calendar mirror', badge: S.googleMirror.errors ? ui.badge(String(S.googleMirror.errors), 'var(--red)', true) : null, detail: S.googleMirror.enabled ? 'On' : 'Off', chevron: true, onTap: () => push(mirrorSpec()) })),
        ui.row(gated('users.manage', { icon: 'person.2', iconColor: 'var(--green)', title: 'Team and roles', detail: String(data.users.filter(u => u.status === 'active').length), chevron: true, onTap: () => push(teamSpec()) })),
        ui.row(gated('contracts.manage', { icon: 'signature', iconColor: 'var(--indigo)', title: 'Service agreements', detail: (n => n ? n + ' unsigned' : '')(data.agreements.filter(a => a.status === 'sent' || a.status === 'viewed').length), chevron: true, onTap: () => push(WD.x.agreementsSpec()) })),
        (WD.can('hr.manage') || WD.can('users.manage')) && ui.row({ icon: 'calendar', iconColor: 'var(--red)', title: 'Time off', detail: (n => n ? n + ' to approve' : '')(data.timeOff.filter(t => t.status === 'pending').length), chevron: true, onTap: () => push(WD.x.timeOffSpec()) }),
        ui.row({ icon: 'truck', iconColor: 'var(--orange)', title: 'Vehicles', detail: String(data.vehicles.length), chevron: true, onTap: () => push(vehiclesSpec()) }),
        ui.row(gated('settings.manage', { icon: 'link', iconColor: 'var(--purple)', title: 'Integrations', detail: INTEG.filter(connected).length + ' connected', chevron: true, onTap: () => push(integrationsSpec()) })),
        ui.row({ icon: 'checklist', iconColor: 'var(--indigo)', title: 'Field workflow', subtitle: 'Arrival, Complete stop, invoices, job titles, shift limit', chevron: true, onTap: () => push(WD.workflow.workflowSpec()) }),
        ui.row({ icon: 'tag', iconColor: 'var(--pink)', title: 'Job types and fields', subtitle: 'Fields asked and required, by job type and customer type', chevron: true, onTap: () => WD.admin && push(WD.admin.typesSpec()) }),
        ui.row(gated('settings.manage', { icon: 'square.and.pencil', iconColor: 'var(--teal)', title: 'Import jobs', subtitle: 'Calendar file (.ics), Excel or CSV', chevron: true, onTap: () => WD.admin && push(WD.admin.importSpec()) })),
        ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Time clock and overtime', detail: WD.timeclock ? 'Over ' + data.timeRules.daily.hours + ' h/day · ' + data.timeRules.weekly.hours + ' h/wk' : '', chevron: true, onTap: () => WD.timeclock && push(WD.timeclock.rulesSpec()) })),
      ui.section('Privacy',
        ui.row({ icon: 'location.fill', iconColor: 'var(--blue)', title: 'Location tracking', detail: S.tracking.consent ? 'Agreed' : 'Not agreed', chevron: true, onTap: () => push(trackingSpec()) }),
        ui.row({ icon: 'hand.raised', iconColor: 'var(--indigo)', title: 'Privacy policy', trailing: icon('arrow.up.right', 17, 'var(--label3)'), onTap: safari }),
        ui.row({ icon: 'questionmark.circle', iconColor: 'var(--teal)', title: 'Support', trailing: icon('arrow.up.right', 17, 'var(--label3)'), onTap: safari }),
        ui.row({ icon: 'trash', iconColor: 'var(--red)', title: 'Request account deletion', onTap: requestDeletion })),
      ui.section(ui.row({ title: 'Sign out', destructive: true, center: true, onTap: signOut })),
      ui.section({ header: 'About', footer: 'The tutorial shows once after each update.' }, ui.row({ title: 'Version', detail: WD.version + ' (prototype)' }), ui.row({ icon: 'sparkles', iconPlain: true, title: 'Show the tutorial', subtitle: 'What’s new in version ' + WD.version, tint: true, onTap: () => WD.x.tutorial() }), ui.row({ title: 'Acknowledgements', chevron: true, onTap: () => push(ackSpec()) })));
  } };
}
function plan(o) {
  if (o.plan === 'Internal') return { detail: 'Internal', subtitle: 'Internal — not billed' };
  if (/^Trial/.test(o.plan)) return { detail: 'Trial', subtitle: o.plan.replace(/^Trial · /, '') + ', then ' + fmt.money(PRICE) + ' per truck per month' };
  const d = WD.now(); d.setMonth(d.getMonth() + 1, 1);
  return { detail: fmt.money(PRICE) + ' per truck', subtitle: plural(o.trucks, 'truck') + ' · Next bill ' + fmt.day(WD.date.key(d), 'md') + ': ' + fmt.money(PRICE * o.trucks) };
}

/* ---------- Account and company ---------- */
const NOTIFY = [['assigned', 'Jobs assigned to me', true], ['review', 'Changes that need review', true], ['summary', 'Tomorrow’s route summary', false], ['mirror', 'Google mirror errors', true]];
const notify = Object.fromEntries(NOTIFY.map(([k, , v]) => [k, v]));
const accountSpec = () => ({ title: 'Account', render: () => { const me = S.me; return ui.list(
  h('div.st-member', ui.avatar(me.name, { size: 76 }), h('div.title2', me.name), roleBadge(me.role)),
  ui.section('Profile',
    ui.inputRow({ label: 'Name', value: me.name, caps: 'words', onInput: v => { if (v.trim()) { me.name = v.trim(); WD.changed(); } } }),
    ui.inputRow({ label: 'Phone', type: 'tel', inputmode: 'tel', placeholder: 'Optional', value: fmt.phone(me.phone), onInput: v => { me.phone = v; } }),
    ui.row({ title: 'Email', detail: me.email })),
  ui.section({ header: 'Signature on file', footer: 'Printed on invoices you create, under “Shredding Service Representative Signature”.' },
    me.signature && WD.screens.billing ? h('div.bi-sig', h('div.bi-ink', WD.screens.billing.sigView(me.signature))) : null,
    ui.row({ icon: 'signature', iconPlain: true, title: me.signature ? 'Replace signature' : 'Add signature', tint: true, onTap: async () => { const r = WD.screens.billing && await WD.screens.billing.signaturePad({ title: 'Your signature', subtitle: 'Sign the way you sign invoices.' }); if (r) { me.signature = r.image; WD.changed(); ui.toast('Signature saved', 'checkmark'); } } })),
  ui.section({ footer: 'Sign in with Apple and email links work without a password.' }, ui.row({ icon: 'key', iconColor: 'var(--gray)', title: 'Change password', chevron: true, onTap: passwordSheet })),
  ui.section({ header: 'Notifications', footer: 'Sent to this iPhone only.' }, NOTIFY.map(([k, title]) => ui.toggleRow({ title, value: notify[k], onChange: v => { notify[k] = v; } })))); } });
function passwordSheet() {
  const f = { cur: '', next: '', again: '' }; let save;
  const ok = () => f.cur && f.next.length >= 8 && f.next === f.again, sync = () => { save.disabled = !ok(); };
  const field = (k, label, autofocus) => ui.inputRow({ label, type: 'password', caps: 'off', placeholder: 'Required', value: f[k], autofocus, onInput: v => { f[k] = v; sync(); } });
  const sheet = ui.sheet({ title: 'Change password', leading: { label: 'Cancel', onTap: p => p.dismiss() }, trailing: () => (save = navBtn('Save', submit, ok())),
    render: () => ui.list(ui.section({ footer: 'At least 8 characters. Other devices are signed out; this iPhone stays signed in.' }, field('cur', 'Current', true), field('next', 'New'), field('again', 'Confirm'))) }, { detent: 'medium' });
  async function submit() { if (await ui.run('Updating password…', null, { done: 'Password changed' })) sheet.close(); }
}
const orgsSpec = () => ({ title: 'Company', render: () => ui.list(ui.section({ footer: 'Routes, jobs and team are separate for each company.' },
  data.orgs.map(o => { const cur = o.id === org().id; return ui.row({ leading: ui.avatar(o.name, { size: 36, icon: 'building' }), title: o.name, subtitle: [WD.roles[o.role] ? WD.roles[o.role].title : o.role, plural(o.trucks, 'truck'), o.plan].join(' · '),
    trailing: cur ? icon('checkmark', 20, 'var(--tint)') : null, onTap: cur ? null : () => switchOrg(o) }); }))) });
async function switchOrg(o) { if (await ui.run('Switching to ' + o.name + '…', () => { S.org = o; }, { min: 1200, max: 1800 })) WD.app.showMain('settings'); }

/* ---------- Routes (personal preferences + admin defaults) ---------- */
function routesSpec() {
  const move = (rs, i, d) => { blur(); const a = rs[i], b = rs[i + d], t = a.order; a.order = b.order; b.order = t; WD.changed(); };
  const arrow = (name, disabled, fn) => h('button.st-arrow', { disabled, 'aria-label': name === 'chevron.up' ? 'Move up' : 'Move down', onclick: e => { e.stopPropagation(); fn(); } }, icon(name, 16));
  return { title: 'Routes', render: page => { const rs = q.routes(); return ui.list(
    ui.section({ header: 'Your routes', footer: 'Visibility, nicknames, colors and order are personal. They stay on this account and don’t change what others see.' },
      rs.map((r, i) => ui.row({ leading: ui.dot(q.routeColor(r)), title: q.routeName(r), subtitle: [r.nickname ? r.name : null, r.visible ? null : 'Hidden'].filter(Boolean).join(' · ') || null,
        trailing: h('div.st-order', arrow('chevron.up', i === 0, () => move(rs, i, -1)), arrow('chevron.down', i === rs.length - 1, () => move(rs, i, 1))), chevron: true, onTap: () => page.push(routeSpec(r)) }))),
    ui.section(ui.row(gated('settings.manage', { icon: 'plus.circle.fill', iconPlain: true, title: 'Add route', tint: true, onTap: addRouteSheet })))); } };
}
const swatches = (cur, pick) => h('div.row.st-colors', PALETTE.map(c => h('button.st-swatch' + (c.toLowerCase() === String(cur).toLowerCase() ? '.on' : ''), { style: { background: c }, 'aria-label': c, onclick: () => { blur(); pick(c); } })),
  h('label.st-swatch.st-custom' + (PALETTE.some(c => c.toLowerCase() === String(cur).toLowerCase()) ? '' : '.on'), { 'aria-label': 'Custom color', title: 'Custom color', style: PALETTE.some(c => c.toLowerCase() === String(cur).toLowerCase()) ? null : { background: cur } },
    h('input', { type: 'color', value: cur, onchange: e => pick(e.target.value.toUpperCase()) })));
function routeSpec(r) {
  return { title: () => q.routeName(r), render: () => { const admin = WD.can('settings.manage'), drivers = data.users.filter(u => u.role === 'driver' && u.status === 'active'); return ui.list(
    ui.section({ header: 'Just for you', footer: 'Only you see these choices, on any device signed in to this account.' },
      ui.toggleRow({ title: 'Show on board and map', value: r.visible, onChange: v => { r.visible = v; WD.changed(); } }),
      ui.inputRow({ label: 'Nickname', placeholder: r.name, value: r.nickname, onInput: v => { r.nickname = v.trim(); WD.changed(); } }),
      swatches(q.routeColor(r), c => { r.colorOverride = c === r.color ? null : c; WD.changed(); }),
      ui.row({ title: 'Use route color', tint: true, disabled: !r.colorOverride, trailing: ui.dot(r.color), onTap: () => { r.colorOverride = null; WD.changed(); } })),
    ui.section({ header: 'Company defaults', footer: admin ? 'Applies to everyone. Override a single day from the board.' : ADMIN + ' to change these.' },
      ui.pickerRow({ title: 'Default driver', disabled: !admin, value: r.driverId, options: [{ value: null, label: 'Unassigned' }, ...drivers.map(u => ({ value: u.id, label: u.name }))], onChange: v => { r.driverId = v; WD.changed(); } }),
      ui.pickerRow({ title: 'Default vehicle', disabled: !admin, value: r.vehicleId, options: [{ value: null, label: 'None' }, ...data.vehicles.map(v => ({ value: v.id, label: v.name }))], onChange: v => { r.vehicleId = v; WD.changed(); } }),
      ui.pickerRow({ title: 'Time zone', disabled: !admin, value: r.timeZone, options: ZONES, onChange: v => { r.timeZone = v; WD.changed(); } })),
    ui.section('Google Calendar mirror', ui.row({ title: 'Calendar', detail: r.googleCalendar || 'None' }))); } };
}
function addRouteSheet() {
  let name = '', color = PALETTE[9], zone = 'America/Chicago', save;
  const sheet = ui.sheet({ title: 'New route', leading: { label: 'Cancel', onTap: p => p.dismiss() }, trailing: () => (save = navBtn('Add', submit, !!name.trim())),
    render: page => ui.list(
      ui.section({ footer: 'A route is a business route, like “East Route”, not a person. Assign drivers and vehicles after adding it.' }, ui.inputRow({ label: 'Name', placeholder: 'East Route', caps: 'words', value: name, autofocus: true, onInput: v => { name = v; save.disabled = !v.trim(); } })),
      ui.section('Color', swatches(color, c => { color = c; page.refresh(); })),
      ui.section(ui.pickerRow({ title: 'Time zone', value: zone, options: ZONES, onChange: v => { zone = v; page.refresh(); } }))) });
  async function submit() {
    const ok = await ui.run('Adding route…', () => { data.routes.push({ id: uid('r'), name: name.trim(), color, nickname: '', colorOverride: null, visible: true, order: Math.max(-1, ...data.routes.map(r => r.order)) + 1, timeZone: zone, driverId: null, vehicleId: null, googleCalendar: null, writable: true }); }, { done: 'Route added' });
    if (ok) sheet.close();
  }
}

/* ---------- Pending changes (offline queue) ---------- */
const STATUS = { queued: ['Waiting', 'var(--gray)'], syncing: ['Sending', 'var(--blue)'], conflict: ['Needs review', 'var(--orange)'], failed: ['Failed', 'var(--red)'] };
function opCell(op) {
  const [label, color] = STATUS[op.status] || [op.status, 'var(--gray)'], btn = (text, onTap, kind = 'gray') => ui.button(text, { kind, small: true, block: false, onTap, disabled: op.status === 'syncing' });
  return h('div.row.st-op',
    h('div.st-op-head', h('div', h('div', op.title), h('div.footnote', (KIND[op.kind] || op.kind) + ' · ' + op.scope)), op.status === 'syncing' ? ui.spinner(18) : ui.badge(label, color)),
    h('div.footnote', op.message + ' · ' + fmt.rel(op.at)),
    h('div.st-op-actions',
      op.status === 'conflict' && [btn('Compare versions', () => WD.x.compareOp(op), 'filled'), btn('Keep server version', () => api.resolve(op.id, 'server')), btn('Keep my version', () => api.resolve(op.id, 'mine'))],
      op.status === 'failed' && btn('Retry', () => api.retry(op.id)),
      btn('Cancel change', () => cancelOp(op), 'destructive')));
}
async function cancelOp(op) {
  if (!await confirm('Cancel this change?', 'Work Dispatcher stops retrying “' + op.title + '”. Anything already saved on the server is not undone, and a record is kept under Abandoned changes.', 'Cancel change', 'Keep trying')) return;
  if (!S.pending.includes(op)) return ui.toast('Already synced', 'checkmark');
  if (op.status === 'syncing') return ui.alert({ title: 'Sync in progress', message: 'Wait for this attempt to finish, then try again.' });
  api.cancel(op.id); ui.toast('Change cancelled', 'xmark');
}
const pendingSpec = () => ({ title: 'Pending changes', trailing: { label: 'Done', bold: true, onTap: p => p.dismiss() },
  toolbar: () => h('div.st-tool', h('span.footnote', S.offline ? 'Offline' : api.busy ? 'Syncing…' : S.pending.length ? plural(S.pending.length, 'change') + ' waiting' : 'Up to date'),
    ui.button('Sync now', { kind: 'plain', block: false, disabled: !S.pending.length, onTap: () => { if (S.offline) ui.toast('Offline — changes send when you reconnect', 'wifi.slash', 2600); else api.retryAll(); } })),
  render: () => ui.list(
    S.offline && ui.section(ui.row({ icon: 'wifi.slash', iconColor: 'var(--gray)', title: 'You’re offline', subtitle: 'Changes are saved on this iPhone and sync automatically when the connection returns.' })),
    S.pending.length ? ui.section({ header: 'Waiting to sync', footer: 'Changes sync in order. A change that needs review waits for you; the rest keep going. Compare versions shows the server’s copy next to yours with the differences highlighted.' }, S.pending.map(opCell))
      : ui.empty({ icon: 'checkmark.circle', title: 'All changes synced', text: 'Changes you make without a connection wait here until they reach the server.' }),
    ui.section({ header: 'Abandoned changes', footer: 'Cancelled changes are kept as a record. Check the board to see what reached the server.' },
      S.abandoned.map(op => ui.row({ icon: 'xmark.circle.fill', iconPlain: true, iconColor: 'var(--gray)', title: op.title, subtitle: (KIND[op.kind] || op.kind) + ' · ' + op.scope + ' · Cancelled ' + lower(fmt.rel(op.cancelledAt)) })))) });
const openPending = () => ui.sheet(pendingSpec());

/* ---------- Google Calendar mirror ---------- */
S.googleMirror.lastSync = +WD.now() - 4 * 60000; // align with the prototype clock used by fmt.rel
const mirrorErrors = [
  { id: 'e1', routeId: 'r3', title: 'West Route calendar not shared', text: 'west@discountshred.example is no longer shared with the service account. 3 changes are waiting.', at: +WD.now() - 26 * 60000 },
  { id: 'e2', title: 'Event missing in Google', text: 'Harlow & Finch Law (Tuesday) was deleted in Google Calendar. Retry recreates it.', at: +WD.now() - 2.2 * 3600000 },
  { id: 'e3', title: 'Google rate limit', text: 'Google asked us to slow down while updating Purge Truck. Retry sends the remaining change.', at: +WD.now() - 5 * 3600000 },
].slice(0, S.googleMirror.errors);
S.googleMirror.errors = mirrorErrors.length;
const retrying = new Set();
async function retryError(e) {
  if (retrying.has(e.id) || !online()) return;
  retrying.add(e.id); WD.changed(); await WD.delay(900, 1600); retrying.delete(e.id);
  const i = mirrorErrors.indexOf(e); if (i >= 0) mirrorErrors.splice(i, 1);
  S.googleMirror.errors = mirrorErrors.length; S.googleMirror.lastSync = +WD.now(); WD.changed(); ui.toast('Sent to Google Calendar', 'checkmark');
}
/** Non-dismissable staged progress sheet; resolves when done. */
const staged = (title, stages) => new Promise(resolve => {
  let label, bar;
  const sheet = ui.sheet({ title, live: false, render: () => h('div.st-stage', ui.spinner(30), label = h('div.subhead', stages[0]), bar = ui.progress(0), h('div.footnote', 'This runs on the server. Nobody needs to wait for it.')),
    onAppear: async () => { for (let i = 0; i < stages.length; i++) { label.textContent = stages[i]; await WD.delay(650, 950); bar.firstChild.style.width = Math.round((i + 1) / stages.length * 100) + '%'; } await WD.delay(300); sheet.close(); resolve(); } }, { detent: 'small', dismissable: false });
});
async function toggleMirror(on) {
  if (on) {
    if (!online()) return false;
    await staged('Full reconcile', ['Reading jobs for ' + plural(data.routes.length, 'route') + '…', 'Comparing with Google Calendar…', 'Updating 23 events…', 'Checking recurring series…']);
    Object.assign(S.googleMirror, { enabled: true, lastSync: +WD.now() }); WD.changed(); ui.toast('Google Calendar is up to date', 'checkmark');
    return true;
  }
  if (!await confirm('Turn off the Google mirror?', 'Changes stop being queued for Google Calendar. Google keeps the events it already has, but they won’t be updated. Turning it back on runs a full reconcile.', 'Turn off')) return false;
  S.googleMirror.enabled = false; WD.changed();
}
function mirrorSpec() {
  return { title: 'Google Calendar', render: page => { if (!WD.can('settings.manage')) return locked(); const M = S.googleMirror; return ui.list(
    ui.section({ footer: 'One-way copy: changes made in Work Dispatcher are sent to Google Calendar. Nobody edits Google directly; edits made there are overwritten.' },
      ui.toggleRow({ icon: 'calendar', iconColor: 'var(--blue)', title: 'Mirror to Google Calendar', value: M.enabled, onChange: toggleMirror }),
      M.enabled && ui.row({ title: 'Last sync', detail: fmt.rel(M.lastSync) }),
      ui.row({ title: 'Errors', detail: String(M.errors), chevron: M.errors > 0, onTap: M.errors ? () => page.push(errorsSpec()) : null })),
    ui.section({ header: 'Route calendars', footer: 'Each calendar must be shared with the Work Dispatcher service account with “Make changes to events”.' },
      q.routes().map(r => ui.row({ leading: ui.dot(q.routeColor(r)), title: q.routeName(r), subtitle: r.googleCalendar || 'No calendar',
        trailing: !r.googleCalendar ? ui.badge('None', 'var(--gray)') : mirrorErrors.some(e => e.routeId === r.id) ? ui.badge('Not shared', 'var(--orange)') : ui.badge('Shared', 'var(--green)') })))); } };
}
const errorsSpec = () => ({ title: 'Mirror errors', trailing: () => mirrorErrors.length > 1 ? { label: 'Retry all', onTap: () => online() && mirrorErrors.slice().forEach(retryError) } : null,
  render: () => mirrorErrors.length ? ui.list(ui.section({ footer: 'Mirror errors never block anyone. Jobs are saved in Work Dispatcher; only the copy in Google is behind.' },
    mirrorErrors.map(e => ui.row({ icon: 'exclamationmark.triangle', iconColor: 'var(--orange)', title: e.title, subtitle: e.text + ' · ' + fmt.rel(e.at),
      trailing: retrying.has(e.id) ? ui.spinner() : ui.button('Retry', { kind: 'gray', small: true, block: false, onTap: () => retryError(e) }) }))))
    : ui.empty({ icon: 'checkmark.circle', title: 'No mirror errors', text: 'Google Calendar matches Work Dispatcher.' }) });

/* ---------- Team and roles ---------- */
/** Does this person's permission set differ from their role's defaults? */
const isCustom = u => { const base = WD.roles[u.role].perms, mine = permsOf(u); return base.length !== mine.length || base.some(p => !mine.includes(p)); };
function teamSpec() {
  return { title: 'Team and roles', trailing: () => WD.can('users.manage') ? { icon: 'person.badge.plus', label: 'Invite', onTap: inviteSheet } : null,
    render: page => !WD.can('users.manage') ? locked() : ui.list(
      h('div', { style: 'padding:4px 4px 0' }, ui.note('Roles give a starting set of permissions. Tap a person to turn individual permissions on or off just for them.')),
      [['active', 'Active'], ['invited', 'Invited'], ['deactivated', 'Deactivated']].map(([st, header]) => ui.section(header, data.users.filter(u => u.status === st).map(u => ui.row({
        leading: ui.avatar(u.name, { size: 36 }), title: u.name + (u === S.me ? ' (you)' : ''), subtitle: st === 'active' ? u.email : u.lastSeen,
        trailing: h('span.hstack', { style: 'gap:6px' }, isCustom(u) && ui.badge('Custom', 'var(--indigo)'), roleBadge(u.role)), chevron: true, onTap: () => page.push(memberSpec(u)) }))))) };
}
function memberSpec(u) {
  if (!u.perms) u.perms = WD.roles[u.role].perms.slice();
  const setPerm = (id, on) => { const p = new Set(permsOf(u)); on ? p.add(id) : p.delete(id); u.perms = WD.permissionList.map(x => x[0]).filter(x => p.has(x)); WD.changed(); };
  return { title: () => u.name, render: page => {
    if (!WD.can('users.manage')) return locked();
    const self = u === S.me, roleLocked = self || (u.role === 'owner' && S.me.role !== 'owner'), base = WD.roles[u.role].perms, custom = base.length !== permsOf(u).length || base.some(p => !permsOf(u).includes(p));
    const roles = Object.keys(WD.roles).filter(r => r !== 'owner' || S.me.role === 'owner').map(r => ({ value: r, label: WD.roles[r].title }));
    return ui.list(
      h('div.st-member', ui.avatar(u.name, { size: 72 }), h('div.title2', u.name), h('div.footnote', [u.email, u.phone && fmt.phone(u.phone, u.ext)].filter(Boolean).join(' · ')), custom && ui.badge('Custom permissions', 'var(--indigo)')),
      ui.section({ header: 'Role', footer: self ? (u.role === 'owner' ? 'You’re the owner. Transfer ownership from the web dashboard.' : 'You can’t change your own role.') : ROLE_INFO[u.role] + ' Changing the role resets permissions.' },
        ui.pickerRow({ title: 'Role', value: u.role, options: roles, disabled: roleLocked, onChange: r => { u.role = r; u.perms = WD.roles[r].perms.slice(); WD.changed(); } })),
      ui.section({ header: 'Permissions for ' + u.name.split(' ')[0], footer: 'Starts from the ' + WD.roles[u.role].title + ' role. Anything you turn on or off here applies to this person only.' },
        WD.permissionList.map(([id, title, sub]) => ui.toggleRow({ title, subtitle: sub, value: permsOf(u).includes(id), disabled: self || u.role === 'owner', onChange: v => setPerm(id, v) })),
        custom && !self && ui.row({ title: 'Reset to ' + WD.roles[u.role].title + ' defaults', tint: true, onTap: () => { u.perms = base.slice(); WD.changed(); } })),
      u.status === 'invited' ? ui.section('Invitation',
        ui.row({ title: 'Sent', detail: u.lastSeen.replace(/^Invited /, '') }),
        ui.row({ title: 'Resend invitation', tint: true, onTap: () => ui.run('Sending invitation…', () => { u.lastSeen = 'Invited just now'; }, { done: 'Invitation sent' }) }),
        ui.row({ title: 'Revoke invitation', destructive: true, onTap: async () => {
          if (await confirm('Revoke this invitation?', 'The link in the email stops working. You can invite ' + u.email + ' again later.', 'Revoke invitation') && await ui.run('Revoking…', () => { data.users = data.users.filter(x => x !== u); }, { done: 'Revoked' })) page.pop(); } }))
      : ui.section('Access',
        ui.row({ title: 'Last seen', detail: self ? 'Now' : u.status === 'active' ? u.lastSeen : 'Deactivated' }),
        !self && (u.status === 'active'
          ? ui.row({ title: 'Deactivate', destructive: true, onTap: async () => { if (await confirm('Deactivate ' + u.name + '?', 'They’re signed out on every device and can’t sign in. Their job history stays. You can reactivate them later.', 'Deactivate')) ui.run('Deactivating…', () => { u.status = 'deactivated'; u.lastSeen = 'Deactivated just now'; }, { done: 'Deactivated' }); } })
          : ui.row({ title: 'Reactivate', tint: true, onTap: () => ui.run('Reactivating…', () => { u.status = 'active'; u.lastSeen = 'Not signed in yet'; }, { done: 'Reactivated' }) }))));
  } };
}
function inviteSheet() {
  let email = '', name = '', role = 'driver', send;
  const ok = () => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim()) && !!name.trim(), sync = () => { send.disabled = !ok(); };
  const sheet = ui.sheet({ title: 'Invite', leading: { label: 'Cancel', onTap: p => p.dismiss() },
    render: page => h('div', ui.list(
      ui.section(ui.inputRow({ label: 'Email', type: 'email', inputmode: 'email', caps: 'off', placeholder: 'name@company.com', value: email, autofocus: true, onInput: v => { email = v; sync(); } }),
        ui.inputRow({ label: 'Name', caps: 'words', placeholder: 'Full name', value: name, onInput: v => { name = v; sync(); } })),
      ui.section({ footer: ROLE_INFO[role] + (role === 'driver' ? ' Drivers agree to location tracking before their first shift.' : '') },
        ui.pickerRow({ title: 'Role', value: role, options: Object.keys(WD.roles).filter(r => r !== 'owner').map(r => ({ value: r, label: WD.roles[r].title })), onChange: v => { role = v; page.refresh(); } }))),
      h('div.st-foot', send = ui.button('Send invitation', { disabled: !ok(), onTap: submit }))) });
  async function submit() {
    const done = await ui.run('Sending invitation…', () => { data.users.push({ id: uid('u'), name: name.trim(), email: email.trim().toLowerCase(), phone: '', role, status: 'invited', lastSeen: 'Invited just now', perms: WD.roles[role].perms.slice() }); }, { done: 'Invitation sent' });
    if (done) sheet.close();
  }
}

/* ---------- Vehicles ---------- */
const vehiclesSpec = () => ({ title: 'Vehicles', trailing: () => WD.can('settings.manage') ? { icon: 'plus', label: 'Add vehicle', onTap: () => vehicleSheet() } : null,
  render: () => { const edit = WD.can('settings.manage'); return ui.list(ui.section({ footer: edit ? 'Each route has a default vehicle. Drivers confirm the vehicle when they clock in.' : ADMIN + ' to add or change vehicles.' },
    data.vehicles.map(v => { const r = data.routes.find(x => x.vehicleId === v.id); return ui.row({ icon: 'truck', iconColor: 'var(--orange)', title: v.name, subtitle: [v.kind, r && q.routeName(r), 'Starts ' + q.place(v.startId).name + (v.endId !== v.startId ? ' · ends ' + q.place(v.endId).name : '')].filter(Boolean).join(' · '), chevron: edit, onTap: edit ? () => vehicleSheet(v) : null }); })),
    ui.section({ header: 'Places', footer: 'Where trucks are kept overnight. Each truck has its own start and end, and drivers can change them for the day when they clock in.' },
      data.places.map(p => ui.row({ icon: p.id === 'p1' ? 'building' : 'house', iconColor: 'var(--gray)', title: p.name, subtitle: p.address })),
      edit && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add place', tint: true, onTap: addPlace }))); } });
async function addPlace() {
  const r = await ui.alert({ title: 'New place', message: 'For example a driver’s house or a storage lot.', input: { placeholder: 'Name, e.g. East yard' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Next', value: true, bold: true }] }); if (!r || !r.value || !r.text.trim()) return;
  const a = await ui.alert({ title: 'Address', input: { placeholder: 'Street, city' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] }); if (!a || !a.value || !a.text.trim()) return;
  await ui.run('Adding place…', () => { data.places.push({ id: uid('p'), name: r.text.trim(), address: a.text.trim(), x: 150 + Math.round(Math.random() * 700), y: 150 + Math.round(Math.random() * 700) }); }, { done: 'Added' });
}
function vehicleSheet(v) {
  let name = v ? v.name : '', plate = v ? v.plate : '', kind = v ? v.kind : VEHICLE_KINDS[0], startId = v ? v.startId : 'p1', endId = v ? v.endId : 'p1', save;
  const places = data.places.map(p => ({ value: p.id, label: p.name })), gps = INTEG.find(x => x.id === 'onestep');
  const ok = () => !!(name.trim() && plate.trim()), sync = () => { save.disabled = !ok(); };
  const sheet = ui.sheet({ title: v ? 'Edit vehicle' : 'New vehicle', leading: { label: 'Cancel', onTap: p => p.dismiss() }, trailing: () => (save = navBtn(v ? 'Save' : 'Add', submit, ok())),
    render: page => ui.list(ui.section(
      ui.inputRow({ label: 'Name', placeholder: 'Truck 15', caps: 'words', value: name, autofocus: !v, onInput: x => { name = x; sync(); } }),
      ui.inputRow({ label: 'Plate', placeholder: 'ABC-1234', caps: 'characters', value: plate, onInput: x => { plate = x; sync(); } }),
      ui.pickerRow({ title: 'Kind', options: VEHICLE_KINDS.includes(kind) ? VEHICLE_KINDS : [kind, ...VEHICLE_KINDS], value: kind, onChange: x => { kind = x; page.refresh(); } })),
      ui.section({ header: 'Start and end of the day', footer: 'AutoRoute plans from the start and back to the end. Drivers can change them for one day when they clock in, if trucks get switched around.' },
        ui.pickerRow({ title: 'Starts at', icon: 'play.fill', iconColor: 'var(--green)', value: startId, options: places, onChange: x => { startId = x; page.refresh(); } }),
        ui.pickerRow({ title: 'Ends at', icon: 'flag', iconColor: 'var(--red)', value: endId, options: places, onChange: x => { endId = x; page.refresh(); } })),
      ui.section({ header: 'GPS tracker', footer: gps && gps.connected ? 'OneStep GPS reports this truck’s position even when the driver’s phone is off, and the spot it parked overnight can set its start automatically.' : 'Connect OneStep GPS in Settings → Integrations to link trackers.' },
        ui.row({ icon: 'location.fill', iconColor: 'var(--orange)', title: 'OneStep GPS device', detail: gps && gps.connected ? (v && v.gps) || 'Not linked' : 'Not connected' }))) }, { detent: 'large' });
  async function submit() {
    const rec = { name: name.trim(), plate: plate.trim().toUpperCase(), kind, startId, endId };
    if (await ui.run(v ? 'Saving…' : 'Adding vehicle…', () => { if (v) Object.assign(v, rec); else data.vehicles.push({ id: uid('v'), ...rec }); }, { done: v ? 'Saved' : 'Vehicle added' })) sheet.close();
  }
}

/* ---------- Location tracking consent ---------- */
const TEAM_CONSENT = { u4: 41, u5: 118, u6: 12 }; // days ago
function reviewSheet(readOnly) {
  const notice = WD.screens.auth && WD.screens.auth.trackingNotice ? WD.screens.auth.trackingNotice : () => ui.note('Location is recorded only while you’re clocked in.');
  const sheet = ui.sheet({ title: 'Tracking notice', leading: readOnly ? null : { label: 'Cancel', onTap: p => p.dismiss() }, trailing: readOnly ? { label: 'Done', bold: true, onTap: p => p.dismiss() } : null,
    render: () => h('div', notice(), !readOnly && h('div.st-foot', ui.button('I understand and agree', { onTap: () => { S.tracking = { consent: true, consentAt: +WD.now() }; sheet.close(); ui.toast('Consent recorded', 'checkmark'); } }))) });
}
async function withdraw() {
  if (!await confirm('Withdraw consent?', 'Location tracking won’t be allowed for your shifts. You’ll need to agree again before you can clock in.', 'Withdraw consent')) return;
  S.tracking = { consent: false, consentAt: null }; WD.changed(); ui.toast('Consent withdrawn', 'checkmark');
}
function trackingSpec() {
  const info = (ic, color, title, text) => ui.row({ icon: ic, iconColor: color, title, subtitle: text });
  return { title: 'Location tracking', render: () => { const t = S.tracking; return ui.list(
    ui.section('How it works',
      info('clock', 'var(--blue)', 'Only while clocked in', 'Tracking starts when a shift starts and stops at clock-out, or at a safety cutoff.'),
      info('location.fill', 'var(--green)', 'About every 30 seconds while driving', 'Parked trucks switch GPS off and check in every 5 minutes to save battery.'),
      info('calendar', 'var(--purple)', 'Kept for 24 months', 'Then thinned. Arrival times and route summaries stay with job history.')),
    ui.section({ header: 'Your consent', footer: t.consent ? 'If you withdraw consent, clock-in asks you to agree again.' : 'Drivers agree once before their first clock-in.' },
      ui.row({ icon: t.consent ? 'checkmark.circle.fill' : 'exclamationmark.circle', iconPlain: true, iconColor: t.consent ? 'var(--green)' : 'var(--orange)', title: t.consent ? 'Agreed ' + (t.consentAt ? when(t.consentAt) : '') : 'Not agreed yet' }),
      t.consent ? [ui.row({ title: 'Read the notice', chevron: true, onTap: () => reviewSheet(true) }), ui.row({ title: 'Withdraw consent', destructive: true, onTap: withdraw })]
        : ui.row({ title: 'Review and agree', tint: true, chevron: true, onTap: () => reviewSheet(false) })),
    WD.can('tracking.view_live') && ui.section({ header: 'Team consent', footer: 'Drivers without consent can’t clock in, so their trucks never appear on the live map.' },
      data.users.filter(u => u.role === 'driver' && u.status !== 'deactivated').map(u => {
        const at = u === S.me ? (t.consent && t.consentAt) : TEAM_CONSENT[u.id] != null ? +WD.now() - TEAM_CONSENT[u.id] * 864e5 : null;
        return ui.row({ leading: ui.avatar(u.name, { size: 32 }), title: u.name, subtitle: at ? 'Agreed ' + when(at) : u.status === 'invited' ? 'Hasn’t accepted the invitation' : 'Not agreed yet',
          trailing: icon(at ? 'checkmark.circle.fill' : 'exclamationmark.circle', 22, at ? 'var(--green)' : 'var(--orange)') });
      }))); } };
}

/* ---------- Integrations ---------- */
const INTEG = WD.integrations = [
  { id: 'onestep', name: 'OneStep GPS', icon: 'location.fill', color: 'var(--orange)', connected: true, lastSync: +WD.now() - 2 * 60000, fields: [['API key', '•••• •••• 7c21'], ['Trackers', '3 of 4 trucks linked']], pitch: 'Truck locations, mileage and idle time',
    about: 'Live positions, ignition, idle time and odometer from the OneStep trackers. Fills in the live map when a driver’s phone is off, sets each truck’s start from where it parked overnight, and feeds mileage reports.', off: 'Trucks only show on the map while a driver’s phone is tracking.',
    steps: ['In OneStep GPS, open Settings → API and create an API key.', 'Paste the key here and tap Connect.', 'Match each tracker to a vehicle in Settings → Vehicles.'] },
  { id: 'ninja', name: 'Invoice Ninja', icon: 'doc.text', color: 'var(--green)', connected: true, pitch: 'Invoices and payments', steps: ['In Invoice Ninja, open Settings → Account management → API tokens.', 'Create a token and copy your Invoice Ninja URL.', 'Paste both here and tap Connect.'], lastSync: +WD.now() - 18 * 60000, fields: [['URL', 'billing.discountshred.example'], ['API token', '•••• •••• 3f9a']],
    about: 'Customers sync to clients and completed jobs become invoices. A scheduled sync catches anything a webhook missed.', off: 'New invoices stop being created. Existing invoices stay in Invoice Ninja.' },
  { id: 'stripe', name: 'Stripe', icon: 'creditcard', color: 'var(--indigo)', via: 'Invoice Ninja', fields: [['Gateway', 'Set up in Invoice Ninja'], ['Auto-billing', 'Credit card on file jobs']],
    about: 'Stripe is the payment gateway inside Invoice Ninja. Cards on file are charged when those jobs are completed.' },
  { id: 'quo', name: 'Quo phone', icon: 'phone.fill', color: 'var(--blue)', connected: true, pitch: 'Calls and texts on customer timelines', steps: ['Sign in to Quo when asked.', 'Choose which numbers to connect.'], fields: [['Main line', '(512) 555-0100'], ['Ads line', '(512) 555-0177']],
    about: 'Calls and texts on these numbers appear on the customer timeline.', off: 'Calls and texts stop appearing on customer timelines.' },
  { id: 'gmail', name: 'Gmail', icon: 'envelope', color: 'var(--red)', connected: true, pitch: 'Customer email on timelines', steps: ['Sign in with the Google account for the shared mailbox.', 'Allow read-only access to mail.'], lastSync: +WD.now() - 6 * 60000, fields: [['Mailbox', 'office@discountshred.example']],
    about: 'Email with customers appears on their timeline. One mailbox is connected.', off: 'New email stops appearing on customer timelines. Past email stays.' },
  { id: 'sheet', name: 'Leads sheet', icon: 'list.bullet', color: 'var(--teal)', connected: false, pitch: 'New rows become leads', steps: ['Sign in with Google.', 'Pick the spreadsheet and the tab with leads.'], fields: [['Sheet', 'Website leads']],
    about: 'New rows in the sheet become leads in the pipeline, matched to existing customers when possible.', off: 'New rows stop becoming leads.' },
];
const connected = x => x.via ? INTEG[0].connected : x.connected;
const integBadge = x => x.via ? ui.badge(connected(x) ? 'Via ' + x.via : 'Off', connected(x) ? 'var(--indigo)' : 'var(--gray)') : ui.badge(x.connected ? 'Connected' : 'Not connected', x.connected ? 'var(--green)' : 'var(--gray)');
const integrationsSpec = () => ({ title: 'Integrations', render: page => !WD.can('settings.manage') ? locked() : ui.list(
  ui.section({ footer: 'Tokens are stored encrypted on the server. Only their last characters are shown.' }, INTEG.map(x => ui.row({ icon: x.icon, iconColor: x.color, title: x.name,
    subtitle: x.connected && x.lastSync ? 'Synced ' + lower(fmt.rel(x.lastSync)) : null, trailing: integBadge(x), chevron: true, onTap: () => page.push(integrationSpec(x)) })))) });
function integrationSpec(x) {
  return { title: x.name, render: page => ui.list(
    h('div.st-member', h('div.row-icon.st-big', { style: { background: x.color } }, icon(x.icon, 34)), h('div.title2', x.name), integBadge(x)),
    ui.section({ footer: x.about }, x.fields.map(([k, v]) => ui.row({ title: k, detail: v })), x.connected && x.lastSync && ui.row({ title: 'Last sync', detail: fmt.rel(x.lastSync) })),
    x.steps && ui.section({ header: 'How to connect' }, h('ol.ad-steps', x.steps.map(t => h('li', t)))),
    x.via ? ui.section(ui.row({ title: 'Open ' + x.via, tint: true, chevron: true, onTap: () => page.push(integrationSpec(INTEG[0])) }))
      : ui.section(
        x.connected && ui.row({ title: 'Sync now', tint: true, onTap: () => ui.run('Syncing ' + x.name + '…', () => { x.lastSync = +WD.now(); }, { done: 'Up to date' }) }),
        x.connected ? ui.row({ title: 'Disconnect', destructive: true, onTap: async () => { if (await confirm('Disconnect ' + x.name + '?', x.off, 'Disconnect')) ui.run('Disconnecting…', () => { x.connected = false; }, { done: 'Disconnected' }); } })
          : ui.row({ title: 'Connect', tint: true, onTap: () => ui.run('Connecting ' + x.name + '…', () => { x.connected = true; x.lastSync = +WD.now(); }, { done: 'Connected' }) }))) };
}

/* ---------- Privacy, account, about ---------- */
function safari() { ui.toast('Opens in Safari', 'globe'); }
async function requestDeletion() {
  if (!await confirm('Request account deletion?', 'Your profile and sign-in are deleted and you’re signed out everywhere. Jobs and history stay with ' + org().name + '. Google Calendar events are never deleted.', 'Request deletion')) return;
  if (await ui.run('Sending request…', null, { done: 'Request sent' })) ui.alert({ title: 'Request received', message: 'We’ll confirm by email at ' + S.me.email + '. Deletion is completed within 30 days.' });
}
async function signOut() {
  const n = S.pending.length;
  if (await confirm(n ? plural(n, 'unsynced change') : 'Sign out?', n ? 'They stay saved on this iPhone for ' + S.me.email + ' and sync the next time you sign in to this account.' : 'Your settings stay saved on this iPhone for this account.', 'Sign out')) WD.app.signOut();
}
const ACK = [['Supabase Swift', 'MIT License'], ['Google Sign-In for iOS', 'Apache License 2.0 · legacy accounts'], ['Swift Collections', 'Apache License 2.0']];
const ackSpec = () => ({ title: 'Acknowledgements', render: () => ui.list(ui.section({ footer: 'Maps and directions by Apple Maps.' }, ACK.map(([title, sub]) => ui.row({ title, subtitle: sub })))) });

/* ---------- Registration ---------- */
WD.screens.settings = { root, openPending, openTeam: () => openIn(teamSpec()), openMirror: () => openIn(mirrorSpec()), openTracking: () => openIn(trackingSpec()) };
const tab = WD.app.tabs.find(t => t.id === 'settings'); if (tab) tab.badge = () => S.pending.length;
WD.panel.addJump('Pending changes', openPending);
WD.panel.addJump('Team & roles', WD.screens.settings.openTeam);
WD.panel.addJump('Google mirror', WD.screens.settings.openMirror);
WD.panel.addJump('Tracking consent', WD.screens.settings.openTracking);
})();
