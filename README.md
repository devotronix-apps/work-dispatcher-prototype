# Work Dispatcher — iPhone prototype

A clickable, web-based mock of the migrated app described in `../MIGRATION.md`. There is no backend: every action pretends to succeed, with realistic waits where the real app would talk to the server. Nothing is saved; reload the page to reset.

## Open it

Double-click `index.html` (any modern browser), or serve the folder:

```bash
python3 -m http.server 8765 --directory Prototype
```

Then open <http://localhost:8765>. Add `?skip` to the address to start past the sign-in screens.

The panel beside the phone (a **Controls** button on narrower windows) drives the prototype:

- **Preview as** switches the signed-in role (owner, dispatcher, office, driver) so you can see what each permission set shows.
- **Appearance** and **Network** switch light/dark and online/offline. Offline job changes queue up and sync when you go back online.
- **Next job change hits a conflict** makes the next saved change come back as a conflict to resolve under Settings → Pending changes.
- **Simulate** triggers things that would come from elsewhere: a dispatcher moving a job, an incoming call, a driver arriving at a stop.
- **Jump to** opens a specific screen directly.

Jobs have no scheduled times: each route's day is an ordered list, and stop 1 is done first. On the board, drag a job up or down to reorder it or into another column to reassign it, and tap a column's empty space (or **Add stop**) to add a job at the end. Notes for the day sit above the list. The prototype clock starts at 10:24 AM; other drivers' trucks move and complete their stops on their own, faster than real life, so the board and map change while you watch.

## Files

| File | Contents |
|---|---|
| `index.html` | Phone frame, status bar, script tags |
| `css/ios.css` | iOS look: colors, lists, bars, sheets, alerts, controls |
| `js/core.js` | `WD` global: DOM helper, icons, components, navigation, fake network and offline queue, control panel |
| `js/data.js` | Fictional company, team, routes, customers and jobs; `WD.q` queries |
| `js/screens/auth.js` | Sign-in, magic link, Sign in with Apple, invitations, company picker |
| `js/screens/board.js`, `jobs.js` | Dispatch board; job details, editor, reassign, search, AutoRoute |
| `js/screens/map.js` | Day map with stops and live trucks |
| `js/screens/customers.js` | Customer lookup, record and timeline, leads, tasks |
| `js/screens/shift.js` | Driver clock in/out, stop statuses, GPS tracking state |
| `js/screens/settings.js` | Routes, pending changes, Google mirror, team and roles, tracking consent, account |

## Screen-module contract

Plain scripts, no build step, no modules, no network requests, no external assets. Each screen file is an IIFE that reads the global `WD` and registers itself on `WD.screens.<name>`. Screen-specific CSS is injected with `WD.css(...)`; extra icons with `WD.addIcons({...})`. Use the CSS variables from `ios.css` (`--bg --cell --label --label2 --label3 --sep --fill --fill2 --fill3 --tint --blue --green --red --orange --yellow --teal --indigo --purple --pink --gray`) so light and dark both work.

### Building UI

```js
const { h, ui, icon, state: S, data, q, fmt, date, api, nav } = WD;
h('div.card.big', { style: { padding: '12px' }, onclick: fn }, 'text', childNode, [more]);  // element
icon('truck', 22, 'var(--blue)');                                                              // SF-style icon
```

Components (all return elements): `ui.list(...sections)`, `ui.section('Header' | {header, footer}, ...rows)`, `ui.row({title, subtitle, detail, icon, iconColor, iconPlain, leading, trailing, badge, chevron, onTap, tint, destructive, center, disabled})`, `ui.toggleRow({title, subtitle, value, onChange})`, `ui.inputRow({label, placeholder, value, onInput, type, multiline, autofocus})`, `ui.pickerRow({title, options, value, onChange})`, `ui.dateRow`, `ui.timeRow`, `ui.segmented(options, value, onChange)`, `ui.button(label, {kind, icon, onTap, small})`, `ui.searchField`, `ui.badge(text, color)`, `ui.avatar(name, {size})`, `ui.spinner()`, `ui.progress(0..1)`, `ui.empty({icon, title, text})`, `ui.note(text)`, `ui.stepper`. Text helper classes: `caption footnote subhead headline title2 title3 secondary hstack vstack spacer`.

### Pages and navigation

A page is a spec object:

```js
{ title: 'Team', large: true,                 // large iOS title that collapses on scroll
  leading: [btn], trailing: [btn] | page => [btn],   // btn: {label, icon, bold, destructive, disabled, onTap(page, el)}
  search: { placeholder, onInput(value, page) }, accessory: node | fn, toolbar: node | fn,
  render(page) { return ui.list(...); },      // called on appear, on page.refresh(), and after WD.changed()
  plain: true,      // white, ungrouped body
  noScroll: true,   // body manages its own scrolling (maps, boards)
  navbar: false,    // hide the bar (full-bleed screens)
  live: false,      // do not auto re-render on WD.changed(); spec.onChange(page) is called instead
  onAppear(page), onReappear(page), onClose(page) }
```

- `WD.nav.push(spec)` pushes onto the current stack (the top sheet if one is open, otherwise the active tab). `WD.nav.pop()`, `WD.nav.switchTab(id)`.
- `ui.sheet(spec, {detent: 'large'|'medium'|'small'})` presents a modal sheet with its own stack → `{close(result), push(spec), closed: Promise}`. Inside it, `page.dismiss(result)` closes the sheet; give sheets a `Cancel`/`Done` nav button.
- `page.refresh()`, `page.setTitle()`, `page.push(spec)`, `page.pop()`, `page.body`, `page.el`.
- After changing `WD.state` or `WD.data`, call `WD.changed()`; visible pages re-render (a page with a focused text field is skipped so typing is not interrupted — keep form values in closure variables, not in the DOM).
- Tabs are fixed in `WD.app.tabs` (`board map customers shift settings`); a module supplies `WD.screens.<id>.root()` returning the tab's root page spec. `tab.badge = () => number` adds a badge.

### Feedback and fake network

- `await ui.actionSheet({title, message, buttons: [{label, value, role: 'destructive'}]})` → value or `null`.
- `await ui.alert({title, message, buttons: [{label, value, role, bold}], input})`.
- `ui.menu(anchorEl, [{label, icon, checked, destructive, onTap} | 'divider' | {header}])`.
- `ui.toast('Copied', 'checkmark')`, `ui.banner({title, text, icon, color, onTap})`, `ui.hud(text)`.
- `await ui.run('Sending invitation…', () => { mutate data }, {done: 'Invitation sent'})` — blocking spinner, 0.7–1.5 s latency, success tick; explains and returns `false` when the panel is set to Offline.
- `await WD.delay(min, max)` for inline waits (row spinners, progress bars).
- Job changes go through the offline queue so they show as pending and survive Offline: `api.op({kind, title, scope, jobIds, apply() {...}})` and `api.setStatus(jobId, 'enroute'|'arrived'|'completed'|'skipped')`. Queue state is `S.pending` (`{id, kind, title, scope, status: 'queued'|'syncing'|'conflict'|'failed', message, at}`) and `S.abandoned`; `api.resolve(id, 'server'|'mine')`, `api.retry(id)`, `api.retryAll()`, `api.cancel(id)`.

### State, permissions, data

- `WD.state`: `me`, `role`, `org`, `offline`, `theme`, `pending`, `abandoned`, `board`, `shift`, `tracking {consent, consentAt}`, `googleMirror {enabled, lastSync, errors}`.
- `WD.can('jobs.edit' | 'tracking.view_live' | 'crm.view' | 'crm.edit' | 'analytics.view' | 'billing.view' | 'billing.manage' | 'users.manage' | 'settings.manage')`. `WD.roles`, `WD.permissionList`.
- `WD.now()` / `WD.nowMins()` — the prototype clock (today, starting 10:24 AM). `WD.date.today() / add(key, n) / key(Date) / parse(key)`; day keys are `YYYY-MM-DD`. Jobs carry no scheduled time: `job.seq` is the 1-based place in its route's day list (`allDay` marks a day note, not a stop), `dur` is typical minutes on site, and `arrivedAt`/`departedAt` are recorded minutes since midnight. Reorder with `WD.placeJob(job, routeId, day, index)`; `WD.renumber(routeId, day)` tidies a list.
- `WD.fmt.day(key, 'short'|'long'|'rel'|'md'|'weekday')`, `time(mins)`, `dur(mins)`, `rel(Date)`, `money(n)`, `phone(str)`, `clock(Date)`.
- `WD.data`: `orgs users vehicles routes customers jobs depot`. `WD.q`: `routes() visibleRoutes() route(id) routeName(id) routeColor(id) job(id) customer(id) user(id) vehicle(id) jobType(id) jobsFor(routeId, day) stopList(routeId, day) position(job) order(a, b) jobsOn(day) stops(routeId, day) jobsForCustomer(id) driverFor(routeId) searchCustomers(text) searchJobs(text, routeIds)`. `WD.jobTypes`, `WD.jobStatuses`, `WD.lifecycle`.
- Map space for `x`/`y` on jobs, locations and the depot is 1000 × 1000.

### Cross-screen entry points

| Call | Owner |
|---|---|
| `WD.screens.auth.show()` | auth.js |
| `WD.screens.jobs.openDetails(jobId)`, `WD.screens.jobs.openEditor({jobId} \| {day, routeId, pos, customerId})` | jobs.js |
| `WD.screens.customers.openDetail(customerId)` | customers.js |
| `WD.screens.settings.openPending()` | settings.js |
| `WD.screens.map.root()`, `WD.screens.shift.root()` | map.js, shift.js |

Always guard calls into another module (`WD.screens.jobs && WD.screens.jobs.openDetails && ...`).

### Control panel hooks

`WD.panel.addAction('Incoming call', fn)` adds a Simulate button; `WD.panel.addJump('Team', fn)` adds a shortcut. Both run with the tab interface showing and all sheets closed.
