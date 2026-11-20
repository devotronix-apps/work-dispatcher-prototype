# RouteClerk — iPhone prototype

A clickable, web-based mock of RouteClerk, the standalone product described in `../MIGRATION.md`. There is no backend: every action pretends to succeed, with realistic waits where the real app would talk to the server. Nothing is saved; reload the page to reset.

What each screen must do is in `../Docs/FunctionalSpec.md`. Suggested additions and changes that have not been built or accepted yet are in `../Docs/PrototypeRecommendations.md`.

## Open it

Double-click `index.html` (any modern browser), or serve the folder:

```bash
python3 -m http.server 8765 --directory Prototype
```

Then open <http://localhost:8765>. Add `?skip` to the address to start past the sign-in screens. After you sign in once, the browser remembers it for the company's sign-in policy (Settings → Sign-in and security, default every 30 days), so reloading goes straight to the board. Signing out (Settings or the Sign-in jump) brings the sign-in screens back.

The panel beside the phone (a **Controls** button on narrower windows) drives the prototype:

- **Preview as** switches the signed-in role (owner, dispatcher, office, driver) so you can see what each permission set shows.
- **Device** switches between the iPhone app and the desktop website; **Business** switches between the three demo businesses.
- **Service plan** switches between Starter and Pro; **AI Premium** switches the paid AI add-on off, on trial, paid or ended, and sets the trial length.
- **Appearance** and **Network** switch light/dark and online/offline. Offline job changes queue up and sync when you go back online.
- **Next job change hits a conflict** makes the next saved change come back as a conflict to resolve under Settings → Pending changes.
- **Simulate** triggers things that would come from elsewhere: a dispatcher moving a job, an incoming call, a driver arriving at a stop.
- **Jump to** opens a specific screen directly.

Completing a stop: **Complete** works from any status (no need for Start driving or I’ve arrived — arrival is taken from GPS). By default it opens the billing details; from there **Get signature** and **Create invoice** (or **Paid — no invoice**, or a signed **service note** for master-invoice customers), then the next customer comes up. Completed jobs fade only once billed; unbilled ones show **Not billed** and are listed before clock-out. Settings → Field workflow changes all of this per company.

Board and map colors: the job type fills each card and pin (purge yellow, government indigo, card-on-file blue, setup red, meet-the-truck pink, route service graphite) and the route's calendar color rims it. Skipped, canceled, rescheduled and postponed jobs stay on the list with a line through the title and a label; canceled, rescheduled and postponed ones (`WD.calledOff`) sink to the bottom with no stop number and are left off the map and out of AutoRoute. Dropping to the bottom is a setting (`data.workflow.sinkCalledOff`, `WD.sinks`).

Jobs have no scheduled times: each route's day is an ordered list, and stop 1 is done first. Cards leave the address off and show the key facts (containers or boxes, window, time on site); pinch on the board (or ⌘/ctrl-scroll, or Card detail in the board’s ⋯ menu) to switch between less and more detail. Every card carries all three levels and the board’s `lvl0`–`lvl2` class picks one, so pinching never rebuilds the list. AutoRoute recommends when to leave the truck's parking place for a day that hasn't started, which you can accept or replace with your own time, and gives a window to each stop marked **Needs a window**. On the board, drag a job up or down to reorder it or into another column to reassign it, and tap a column's empty space (or **Add stop**) to add a job at the end. Notes for the day sit above the list. The prototype clock starts at 10:24 AM; other drivers' trucks move and complete their stops on their own, faster than real life, so the board and map change while you watch.

## What changed in 5.1

- **Dispatch** (`board.js`): the Board ↔ Map switch is one labeled button (`viewBtn`): in the top bar on a computer, floating over the bottom of the board on an iPhone (`viewPill`). The ⋯ menu's tools are split into `mainItems` and `moreItems`; **More…** opens the second list as its own menu. A column at least 260 points wide (one route on an iPhone, most desktop layouts) gets the `roomy` header: a larger name with the day's notes beside it (`noteNodes`, `headCell`).
- **Job cards on Dispatch** (Settings → Display; `WD.r15.cardStyleSpec`, `S.prefs.card = {style: 'solid' | 'clear' | 'faint', tint}`, kept in this browser): the board holder gets `cs-clear` or `cs-faint`.
- **Businesses**: a third demo business (`data.orgs[2]`, built by `DEMO` in `r14.js`). `WD.app.pickOrg()` switches directly with two businesses and lists them with more; the Menu says **Switch business…**. `WD.app.leaveSwitcher()` runs before a switch made from Settings → Switch business, so the business left behind is parked on the screen used before Settings was opened and each one comes back where the person was working.
- **View state per business** (`WD.app.uiState(name, obj)` in `core.js`): a screen that keeps its choices in a module-level object (CRM side and segment, the Dialer's tab and typed number, invoice filters, Price Calc, reports, the planning map…) registers that object at the end of its file. `switchOrg` saves a copy for the business being left and puts back the copy of the one being opened, or the starting values the first time. **Register any new view-state object the same way**, or it will leak between businesses. The board also keeps its scroll position per business (`perOrg` in `board.js`). `switchOrg` parks `#root > .tabview:not(.parked)`; it used to take the first `.tabview`, which parked the wrong one once a second business had been opened.
- **Desktop workspace** (`core.js` `showMain`): up to three sections side by side. `state.open` lists them, `state.openBeside(id)`, `state.closePane(id)`, `state.focus(id)`; the split icon on a sidebar entry or **Workspace** at the bottom of the sidebar; kept in `wd.work`.
- **Dialer** (`r14-calls.js`): `WD.calls.pickLine(number)` → `{line, how, why}`: the number the person called us on, else our number with their area code, else the nearest by area code (`AC`), else the main number. **Call from** defaults to Automatic.
- **On a call** (`r15.js`): `WD.r15.callBegin(info)` / `callEnd()` / `onCall()`. `callBrief(customer)` is the card on the call screens (unpaid invoices, email trouble, latest contact, and with AI Premium a summary from `aiFacts`). `jobs.openEditor`, `customers.openNew` and `crm.newLead` are wrapped to offer filling in from the caller; a job started on a call keeps the number called on in its notes. `callFill(key, apply)` is the same offer as a row (Price Calc).
- **Drafts** (`r15.js`, `WD.app.stashSheets` / `restoreSheets`): when a call comes in, the open sheets are hidden whole and listed as a draft (`stashForCall`); `promptDrafts` asks to finish or delete them whenever no call is in progress; `openDrafts()` lists them.
- **CRM → Assignments** (`WD.r15.assignView`, `R.side = 'assign'` in `crm.js`): leads, follow-ups and customer requests by owner; a column per person with drag to reassign on a computer, a person list with a filter on an iPhone; **Hand off…** moves everything a person holds.
- **Price Calc**: each area in `data.calc.areas` is `{name, flat, included, extra}`, edited in place under the gear.
- **AI Premium: overdue invoices** (`WD.r15.collectSpec`, the card on Invoices): customers with something overdue and either `data.collect.high` dollars or two or more unpaid invoices; `data.emailHealth[customerId]` (`bounce`, `typo`, `spam`) flags customers our emails do not reach (`WD.r15.emailTrouble(c)`); `plan(item)` gives the recommendation and the steps the assistant offers to take.
- **Bids and Prospects** (`bids.js`, Menu; `WD.bids`): an add-on, off by default (`data.bidsModule.status`). `BID.host` is the only part that reads RouteClerk (company, service area, references, contracts, pricing, documents, sales, `createFromBid`); `BID.score(opportunity, profile, ctx)` and `BID.draft(opportunity, profile, host)` are plain functions. Screens: Find, Tracker, Prospects, Company, an opportunity, a bid, the AI draft, the won-bid import, the GSA Schedule steps, sources and settings. The panel has **Bids and Prospects (add-on)**.

| File | Contents |
|---|---|
| `js/screens/r15.js` | `WD.r15`: job-card style, who is on the phone, the call brief, fill-in from the caller, drafts, CRM Assignments, the AI overdue-invoice review and email-trouble flags, the Price Calc area styles |
| `js/screens/bids.js` | `WD.bids`: the Bids and Prospects add-on and its host adapter |

## What changed in 5.0

- **Device** (panel): *iPhone app* or *Desktop website* (`S.desktop`, `WD.app.setDesktop`). The desktop screen is 1280 × 800 with the sections in a sidebar; list pages are capped at 860px unless their root element has the class `wide`. Board, CRM, Invoices and the call log have desktop layouts.
- **Business** (panel, Menu, Settings → Business): two businesses, each with its own data. `WD.app.switchOrg(id)` parks the business in front (its tab view and open sheets are hidden, not rebuilt) and brings the other back exactly as it was; `WD.orgs` in `r14.js` swaps the contents of `WD.data` on the `orgSwap` event. Because `data`'s contents change, modules read `data.customers`, `data.jobs` and their own `data.*` collections at use time and seed them lazily.
- **AI Premium** (`WD.aip`, `data.aiPremium`): a paid add-on with a free trial whose length the panel sets ("set by RouteClerk"). `WD.aip.on()`; `WD.aip.block(build)` returns nothing when it is off, so AI Premium features are hidden, not locked. `WD.aip.feature(name, where, text)` lists a feature on the sign-up page. The old Premium tier's features are gated the same way (`RC.ai`).
- **Bottom bar**: four shortcuts by default, up to six (`app.BAR_DEFAULT`, `app.BAR_MAX`). Default `board office dialer shift`; the Map is in the Menu and inside Dispatch (`S.board.view = 'board' | 'map'`).
- **Settings rows from other files**: `WD.r14.addSetting(group, (push, gated) => row)`; groups `AI Premium`, `Company`, `Routes and board`, `Jobs`, `CRM`.
- **Scheduling style**: `data.sched.mode = 'order' | 'calendar'` (`WD.r14.calendar()`); in calendar mode jobs carry `startAt`.

| File | Contents |
|---|---|
| `js/screens/r14.js` | `WD.aip` (AI Premium), `WD.orgs` (businesses: `dataOf(id)`, `findCaller(number, {to})`, `areaSpec()`), `WD.r14` (settings registry, scheduling style) |
| `js/screens/r14-calls.js` | `WD.calls` and the Dialer tab (`WD.screens.dialer`): keypad and in-call sheet, the call log with filters, resolve and archive (`logSpec(preset)`), calls flagged for review (`reviewCount()`), AI call review (`reviewSpec()`), `incoming({number, to})` which opens the right business, Settings → Phone and calls. Data: `data.calls`, `data.callSettings` |
| `js/screens/r14-crm.js` | `WD.crm2`: Customer needs (`data.inquiries`, request types, company documents), key accounts (`c.vip`, `c.estValue`), AI pipeline review and its log (`data.aiActions`), low-value auto-reply rules, the desktop dashboard, board and spreadsheet, new agreement requests (`data.agreementRequests`) |
| `js/screens/r14-ops.js` | `WD.ops2`: route capacity (`capacity(routeId, day)`, the pop-up when a job is created on a full day), hard drive crusher rule and the off-site setting, calendar-mode helpers and the desktop time grid, Shift's day synopsis, jobs with no address and helping other routes (`data` stop requests, approval setting), the AI route review and its implementation plan (`data.routePlans`) |
| `js/screens/r14-price.js` | `WD.price`: the purge price list (base tier, per-unit rate, extra lines; wraps `WD.purgeItems`), `initialPurge(n)`, customer match by address, recommended days and best fit for Price Calc |
| `js/screens/r14-money.js` | `WD.money`: suggested price changes and the AI pricing audit, built-in invoicing settings, the customer email preview (`emailPreview`), the customer portal preview (`portalSpec(customerId)`, Stripe test payments, autopay), invoice tracking, forms and documents designer (`formsSpec()`), import (`importSpec`), maintenance files and the shop-email inbox |

New job prefill: `WD.screens.jobs.openEditor({customerId, routeId, day, type, address, title, contactName, phone, email, notes, purge, items, price, banner, startAt})`. `WD.screens.map.create()` returns an embeddable map. `WD.rc.openStatement(c, {all: true})` lists every invoice.

## Layout rules (4.3)

- No text under 12px at the default text size, and every control has a 44 × 44 tap area (`.segmented` and `.stepper` are 44 high; small round buttons grow their touch area with `::after`).
- Text on a colored fill takes its color from `WD.readableOn(hex)` (4.5:1; `WD.textOn` now calls it). Completed jobs get a muted fill and a check, never faded text.
- Board warnings are a striped ring outside the card (yellow/gray unpaid, red/light gray not cleared), two or more warning lines fold into one row that expands in place, the ⋯ menu sets how many routes fit on screen (`S.board.cols`, a number or `'all'`), and AutoRoute is in that menu.
- Settings groups: Display, Company, Client communications (`WD.rc.commsSpec`, a short list of pages), Routes and board, Jobs, CRM, HR, Sync, Privacy, About. There is no “Settings and assumptions” hub any more (`WD.co.hubSpec` is unused). Fleet settings live in Maintenance, services and fees in the Services and Fees section, customer types behind the gear on Customers, service agreements in Contracts, route performance in Reports.

## Version

Settings → About → Version shows the prototype version, `WD.version` in `js/core.js`. Increment it every time the prototype is republished to the public site. A short “what’s new” tutorial (the `TOUR` steps in `js/screens/extras.js`) shows once per version after sign-in; update its steps with each release. Add `?notour` to the address to suppress it, or replay it from Settings → About.

Earlier releases stay runnable: each one is kept on the published site under `v/<version>/` (it is not in this folder), and the **Older versions** link at the bottom of Settings lists `WD.olderVersions` from `js/core.js`. On every publish, copy the outgoing release into `v/<its version>/` in the public repo, add the “Back to latest” pill to that copy’s `index.html`, and add its number to `WD.olderVersions`. Leave `v/` alone when syncing this folder over the public repo.

A phone can hold on to an old version (the offline copy, plus the browser reusing files for about 10 minutes after a publish). The prototype reads the published version from `js/core.js` each time it opens or returns to the front (`WD.app.autoUpdateCheck`) and shows a banner when it is behind. Settings → About → **Check for updates** (`WD.app.checkForUpdates`) does the same on demand; `WD.app.update()` deletes the saved copies, refetches every file and reloads.

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
| `js/screens/settings.js` | Routes, pending changes, Google mirror, team and roles, vehicles and their start/end places, integrations (incl. OneStep GPS), signature on file, tracking consent, account |
| `js/screens/billing.js` | Billing details / invoice editor (lines, service date, pounds, PO by service date), signature per customer policy, paid on site, service-note mode, the invoice documents: the standard invoice for a route visit or purge job (`standardInvoice`: Item, Description, Unit Cost, Quantity, Line Total; Total, Paid to Date, Balance Due; PAID stamp) and the service-summary layout for master invoices (`invoicePages`: by location, page subtotals) |
| `js/screens/workflow.js` | Field workflow: Complete stop from any status → billing → next customer (optionally start directions), arrival from GPS, details after job titles, paid–no invoice, missed-invoice check, Invoices list (search by number, my route / all routes), invoice actions, service notes saved to the database and the monthly master invoice built from them, customer documents and dated PO schedules, directions app, Settings → Field workflow |
| `js/screens/team.js` | Overtime rules (daily, weekly, double time), pay period, federal overtime (over 40/workweek), hours and overtime reports for pay periods, months or custom dates, HR shift corrections and missed shifts (reason required, change history), team locations map with stays over N minutes |
| `js/screens/extras.js` | `WD.x`: customer pricing, change history and price-change letters, anniversaries report, service agreements, time off, side-by-side conflict review, missing-address list, dated POs in forms, older job history from the server, offline data page, call summary, the tutorial |
| `js/screens/company.js` | `WD.co`: Settings and assumptions hub (routing assumptions, time-off auto-approval, on-my-way notices, container barcodes, bookkeeping and payment-status checks, reviews, CRM features/sources/territories), editable templates (`data.templates`, `WD.co.tpl/fill/ctxFor`), service-agreement wording and per-agreement documents (`a.doc`), the on-my-way prompt, barcode scanner, scanning at the job before billing (`WD.jobScans(job)`, `WD.co.jobScanSection`; a customer can require container scans with `customer.scanContainers`), customer feedback (`data.feedback`) and the review QR code |
| `js/screens/crm.js` | CRM tab (`leads.view`): pipeline with priority (`c.priority`), sorting, show/hide of priorities and stages, jump links, a high-priority section, last contact and current situation (`c.situation`), sources and territories, follow-ups from templates, quotes and bids (`data.quotes`), referrals (`data.referrals`), leads by source, feedback |
| `js/screens/ops.js` | `WD.ops`: time-on-site formulas (route stops with no history, new setups, purge jobs, each truck’s pace; the math is `WD.siteMinutes` in `data.js`), holidays and schedule changes (`data.holidays`, `data.dayMarks`, `WD.dayMark`, suggested moves, one-time moves with a typed request), the new-job confirmation (`WD.ops.confirmJob`) with optional pricing rates or estimated total (`WD.ops.pricingText`, `data.settings.confirm.pricing`), which number and address messages come from (`WD.ops.senderFor`), the items / services / fees editor, hard drive serial-number scanning (`WD.ops.scanDrives`) |
| `js/screens/round8.js` | `WD.r8`: purge pricing by the box or by the 65-gallon bin (`data.purgePricing`, `WD.purgeItems` in `data.js`), export and backup (CSV in a .zip or JSON, built in the browser), postponed jobs with no new date, the 45-day planning map (jobs near a typed address out to 50 miles, address suggestions from `WD.addressSuggestions`, service dates per customer) |
| `js/screens/round9.js` | `WD.r9`: editing an invoice after it was created (`editInvoice(rec, job)`, `editRow`, `revisionSection`; corrections are kept in `revisions` on the invoice record), moving several selected jobs to another route, day or both (`batchMove(ids, done)`; the board’s select mode is `S.board.select` in `board.js`, and the move goes through `WD.ops.applyMoves`), sales tax (`data.tax`, `WD.taxInfo(lines, customer)`; off by default) |
| `js/screens/biz.js` | `WD.biz`: features for any route business. Business type and invoice wording (`data.biz`, industry presets with starter items), service checklists and required photos by job type (`data.checklists`, `job.checks`; Complete stop asks for unfinished required items), custom fields on customers and jobs (`data.customFields`, `obj.custom`), pausing a customer’s service (`customer.hold`), fleet and compliance (`data.fleet`: pre-trip inspections, maintenance by odometer, expiring documents), the load sheet and truck capacity (`data.load`), mileage and expenses (`data.mileage`, `data.expenses`), route performance |
| `js/screens/round11.js` | `WD.r11` add-ons and their settings (`data.addons`, `WD.r11.cfg`): skills, licenses and clearances matched to jobs (`issues(job)`, `checkAssign(jobs, routeId, day)`, flag or block), truck capabilities, non-paper purge sub-categories, disposal sites and the AutoRoute unload stop (`autoRoute(ctx)`), inventory, compliance reminders, country / currency / units (`WD.locale`, `fmt.money/dist/weight`), tracking source, exact-time jobs, window and time-on-site overrides, pickup-and-delivery pairs, and the job editor and job details hooks |
| `js/screens/round11b.js` | The Admin tab (`WD.screens.office`; CRM, Customers and Invoices behind one selector, `WD.app.officeSegs()`), unpaid invoices (`owed`, `overdue`, `overLimit`), board warning lines, route notes (`data.routeNotes`), postponed jobs and price approvals for the Tasks pipeline, Change Route on the planning map, the driver's own-route default |
| `js/screens/rc.js` | `WD.rc` (4.0): service plan and AI features by tier (`data.plan`, `RC.ai(id)`, `RC.aiBlock(id, build)`, `RC.startPromo`), Settings → Display (theme, text size via `WD.app.setTextSize`, menu sections in `S.prefs.hidden`), Company rows (business details, invoicing and payments in `data.pay`, plan), Settings → Client communications (templates and the reminder schedule in `data.comms`), the Services and Products menu sections (`data.priceBook`, `data.products`) |
| `js/screens/rc-ops.js` | Maintenance section (`WD.screens.maintenance`; GPS readings in `data.telemetry`, repairs in `data.fleet.repairs`, alert settings in `data.maint`, `RC.maintCheck()` pop-ups), the pre-trip inspection (`RC.inspect`, also `WD.biz.inspect`), the clock-in sequence (`RC.afterClockIn`), the Checklist button before Complete stop (`RC.checklistButton`, `job.checkSubmitted`), the past-due flag at a stop (`RC.pastDueFlag`), day assignments of driver and truck (`data.routeAssign`, `RC.driverOn/vehicleOn(routeId, day)`, `RC.assignSheet`) |
| `js/screens/rc-money.js` | Date and status filters (`RC.invFilter`, `RC.filterBar`, `RC.invStatus`), creating, viewing, sending and deleting invoices and service notes (`RC.newInvoice`, `RC.editNote`), statements (`RC.openStatement(customer, {job})`, `RC.batchStatements(list)`), the Reports section (`WD.screens.reports`; months before the current one come from a generated history), Price Calc (`WD.screens.calc`, assumptions in `data.calc`) |
| `js/screens/r13.js` | `WD.r13` (4.3): the Contracts section (`WD.screens.contracts`; agreements tied to the CRM: `needsAgreement()`, `renewals()`, `agreementRow(c)`), the AI assistants and their settings (`data.aiAgents`: lead assistant `leadAISpec`/`simLead`, phone agent add-on `phoneAISpec`/`simCall`, route monitoring `routeAISpec`/`simBehind` with how far each kind of job may move `flexFor(job)`, week-ahead `lookAhead`), the purge check-in (`data.purgeCheckin`, `checkinSpec`), Google Sheets (`data.sheets`, `sheetsSpec`) |
| `sw.js` | Service worker: keeps a copy of the prototype for offline use (network first, saved copy as fallback) |
| `js/screens/admin.js` | Sign-in policy, job types and the fields each asks for, import from .ics or Excel/CSV, new-company “connect your tools” step |

## Screen-module contract

Plain scripts, no build step, no modules, no network requests, no external assets. Each screen file is an IIFE that reads the global `WD` and registers itself on `WD.screens.<name>`. Screen-specific CSS is injected with `WD.css(...)`; extra icons with `WD.addIcons({...})`. Use the CSS variables from `ios.css` (`--bg --cell --label --label2 --label3 --sep --fill --fill2 --fill3 --tint --blue --green --red --orange --yellow --teal --indigo --purple --pink --gray`) so light and dark both work.

### Building UI

```js
const { h, ui, icon, state: S, data, q, fmt, date, api, nav } = WD;
h('div.card.big', { style: { padding: '12px' }, onclick: fn }, 'text', childNode, [more]);  // element
icon('truck', 22, 'var(--blue)');                                                              // SF-style icon
```

Components (all return elements): `ui.quarterRow({title, value, onChange, optional})` (15-minute time), `ui.inputRow({..., required, suggested})` (bold red label while empty / bold label), `ui.list(...sections)`, `ui.section('Header' | {header, footer, fold, folded, count}, ...rows)` (a section with a text header folds to its name and item count), `ui.row({title, subtitle, detail, icon, iconColor, iconPlain, leading, trailing, badge, chevron, onTap, tint, destructive, center, disabled})`, `ui.toggleRow({title, subtitle, value, onChange})`, `ui.inputRow({label, placeholder, value, onInput, type, multiline, autofocus})`, `ui.pickerRow({title, options, value, onChange})`, `ui.dateRow`, `ui.timeRow`, `ui.segmented(options, value, onChange)`, `ui.button(label, {kind, icon, onTap, small})`, `ui.searchField`, `ui.badge(text, color)`, `ui.avatar(name, {size})`, `ui.spinner()`, `ui.progress(0..1)`, `ui.empty({icon, title, text})`, `ui.note(text)`, `ui.stepper`. Text helper classes: `caption footnote subhead headline title2 title3 secondary hstack vstack spacer`.

Condensed-layout helpers (4.2): a string `footer` longer than 64 characters is tucked behind an ⓘ on the section header (`ui.popover`), or cut to one line that opens on tap when there is no header; pass `showFooter: true` to keep it visible. `folded: true` is ignored while the section holds a required field that is still empty. `ui.hub(page, build, {placeholder, icons})` shows a long page of sections as one row per section with a search over every row (Settings, Settings and assumptions); `build(page)` must return fresh sections each call. `ui.chipRow(...rowsOrSections)` turns rows into a sideways-scrolling strip of chips. `ui.iconBtn(icon, label, onTap)` is a round button for a row’s trailing edge. The board’s view, routes, card detail and tools are in one menu (`boardMenu` in `board.js`), and several warning strips fold into one (`strips`).

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
- Destinations are the screen tabs in `WD.app.tabs` (`board map office shift`; `office` is the CRM tab) plus the sections in `WD.app.menu` (`services contracts products customers invoices reports calc maintenance settings`). Each person chooses up to six for the bottom bar (`S.prefs.bar`, default the four `board office dialer shift`) and the order of the rest in the Menu (`S.prefs.order`, `S.prefs.hidden`) in Settings → Display → Tabs and menu (`WD.rc.sectionsSpec`, `WD.app.setLayout(fn)`, `app.barIds()`, `app.menuItems()`); the choice is kept in this browser. The last tab, `more`, is the menu: it opens the chosen section's `WD.screens.<id>.root()` in its own stack. `WD.nav.switchTab('<id>')` opens a destination from code wherever it lives (`'crm'` is the CRM tab). `can` is a permission flag or a function; `tab.badge` / `menuItem.badge = () => number` adds a badge.

### Feedback and fake network

- `await ui.actionSheet({title, message, buttons: [{label, value, role: 'destructive'}]})` → value or `null`.
- `await ui.alert({title, message, buttons: [{label, value, role, bold}], input})`.
- `ui.menu(anchorEl, [{label, icon, checked, destructive, onTap} | 'divider' | {header}])`.
- `ui.toast('Copied', 'checkmark')`, `ui.banner({title, text, icon, color, onTap, duration})`, `ui.hud(text)`. Toasts and banners appear above the tab bar so they never cover a title or a sheet's Done. A banner closes by itself (9 s at most, also for `duration: 0`), can be swiped away, has a close button, and replaces the one showing.
- `await ui.run('Sending invitation…', () => { mutate data }, {done: 'Invitation sent'})` — blocking spinner, 0.7–1.5 s latency, success tick; explains and returns `false` when the panel is set to Offline.
- `await WD.delay(min, max)` for inline waits (row spinners, progress bars).
- Job changes go through the offline queue so they show as pending and survive Offline: `api.op({kind, title, scope, jobIds, apply() {...}})` and `api.setStatus(jobId, 'enroute'|'arrived'|'completed'|'skipped')`. Queue state is `S.pending` (`{id, kind, title, scope, status: 'queued'|'syncing'|'conflict'|'failed', message, at}`) and `S.abandoned`; `api.resolve(id, 'server'|'mine')`, `api.retry(id)`, `api.retryAll()`, `api.cancel(id)`.

### State, permissions, data

- `WD.state`: `me`, `role`, `org`, `offline`, `theme`, `pending`, `abandoned`, `board`, `shift`, `tracking {consent, consentAt}`, `googleMirror {enabled, lastSync, errors}`.
- `WD.can('leads.view' | 'leads.all' | 'jobs.edit' | 'tracking.view_live' | 'crm.view' | 'crm.edit' | 'analytics.view' | 'billing.view' | 'billing.manage' | 'users.manage' | 'hr.manage' | 'settings.manage')`. `WD.roles`, `WD.permissionList`.
- `WD.now()` / `WD.nowMins()` — the prototype clock (today, starting 10:24 AM). `WD.date.today() / add(key, n) / key(Date) / parse(key)`; day keys are `YYYY-MM-DD`. Jobs carry no scheduled time: `job.seq` is the 1-based place in its route's day list (`allDay` marks a day note, not a stop), `dur` is typical minutes on site, and `arrivedAt`/`departedAt` are recorded minutes since midnight. Reorder with `WD.placeJob(job, routeId, day, index)`; `WD.renumber(routeId, day)` tidies a list.
- `WD.fmt.day(key, 'short'|'long'|'rel'|'md'|'weekday')`, `time(mins)`, `dur(mins)`, `rel(Date)`, `money(n)`, `phone(str)`, `clock(Date)`.
- `WD.data`: `orgs users vehicles routes customers jobs depot places vehicleDays priceBook fieldConfig timeRules punches stays`. Jobs and customer locations carry `items` (`[{id: 'console'|'bin64'|'bin96'|'box', qty, rate}]`); `WD.itemsLabel(items, purge)` formats them. Customers carry `billingEmail po contract requiresSignature`; jobs copy `po contract` and can change them. Requested windows are `custFrom`/`custUntil` with `custStrict` (true = required, false = preferred); `needsWindow` marks a job that wants a window not yet chosen (AutoRoute assigns `WD.etaWindow(eta)`). Purge jobs carry `purge` `{std, legal, xl, bin65, pallet, gaylord, cabinet, stairs, haul}`; `WD.purgeEstimate(purge)` → boxes, minutes, range and whether the count is a guess (rules in `data.purgeRules`), `WD.purgeExtras` → stairs/haul-away billing items. `data.routeDays[routeId|day]` holds the planned departure. `WD.asks(type, field)` says whether the editor shows a field for a job type. `WD.closed[status]` / `WD.struck[status]` cover completed/skipped/canceled/rescheduled/postponed.
- `q.routeEnds(routeId, day)` / `q.vehicleEnds(vehicleId, day)` → `{start, end}` places (per-day overrides in `data.vehicleDays`). `q.visitStats(job)` → `{median, mean, n}` minutes on site; AutoRoute uses the median. `WD.q`: `routes() visibleRoutes() route(id) routeName(id) routeColor(id) job(id) customer(id) user(id) vehicle(id) jobType(id) jobsFor(routeId, day) stopList(routeId, day) position(job) order(a, b) jobsOn(day) stops(routeId, day) jobsForCustomer(id) driverFor(routeId) searchCustomers(text) searchJobs(text, routeIds)`. `WD.jobTypes`, `WD.jobStatuses`, `WD.lifecycle`.
- Map space for `x`/`y` on jobs, locations and the depot is 1000 × 1000.

### Cross-screen entry points

| Call | Owner |
|---|---|
| `WD.screens.auth.show()` | auth.js |
| `WD.screens.jobs.openDetails(jobId)`, `WD.screens.jobs.openEditor({jobId} \| {day, routeId, pos, customerId})` | jobs.js |
| `WD.screens.customers.openDetail(customerId)` | customers.js |
| `WD.screens.settings.openPending()` | settings.js |
| `WD.screens.billing.openEditor(jobId, {pay, lines, note})`, `.openInvoice(jobId)`, `.signaturePad(o)` | billing.js |
| `WD.timeclock.week(userId)`, `.teamMapSpec()`, `.rulesSpec()`, `.timesheetsSpec()` | team.js |
| `WD.admin.signInSpec()`, `.typesSpec()`, `.importSpec()`, `.connectPage(from, done)` | admin.js |
| `WD.co.hubSpec()`, `.templatesSpec()`, `.editTemplate(t)`, `.agreementDoc(a)`, `.editAgreementDoc(a)`, `.onMyWay(job)`, `.scanSheet(job, scans, done)`, `.syncPayments(manual)`, `.feedbackSpec()`, `.qrSpec()`, `.autoApprove(timeOff)`, `.inTerritory(customer)` | company.js |
| `WD.screens.crm.openLead(id)`, `.newLead()` | crm.js |
| `WD.ops.siteSpec()`, `.schedSpec()`, `.openSchedule()`, `.commsSpec()`, `.confirmSpec()`, `.itemsSpec()`, `.confirmJob(job)`, `.senderFor(customer, user, 'text'\|'call')`, `.scanDrives(job, drives, qty, done)` | ops.js |
| `WD.x.poRows(o)`, `.pricingSection(c)`, `.historySection(c)`, `.agreementSection(c)`, `.jobAgreementSection(job, push)`, `.timeOffSection()`, `.compareOp(op)`, `.missingSheet()`, `.fetchHistory(text)`, `.diffJob(before, after)`, `.tutorial()` | extras.js |
| `WD.r9.editInvoice(rec, job)`, `.editRow(rec, job)`, `.revisionSection(holder)`, `.batchMove(ids, done)`, `.taxSpec()` | round9.js |
| `WD.biz.homeSpec()`, `.wordingSpec()`, `.checklistSpec()`, `.fieldsSpec()`, `.fleetSpec()`, `.inspect(vehicle, after)`, `.loadSpec(day)`, `.mileSpec()`, `.perfSpec()`, `.customerSections(c, edit)`, `.jobSections(job, refresh)`, `.hubSection(row)` | biz.js |
| `WD.miniMap({points, lines, aspect})`, `WD.pinStyle(job)` | map.js |
| `WD.screens.map.root()`, `WD.screens.shift.root()` | map.js, shift.js |
| `WD.readableOn(hex)`, `WD.contrast(a, b)` | board.js |
| `WD.INV_BAD`, `WD.INV_VOID`, `WD.invClosed(inv)`, `WD.invOpen(inv)`, `WD.invStamp(inv)`; `WD.taxInfo(lines, customer)` → `{rate, tax, label, taxes}` (`data.tax.types`) | round9.js |
| `WD.badDebt(customerId)`, `WD.badDebtBanner(customerId)`, `WD.badDebtConfirm(customerId)`; `WD.rc.closeInvoice(rec, 'bad'\|'void')`, `.reopenInvoice(rec)`, `.clearBadDebt(customerId)`, `.unbilledSpec({from, to, routeId})`, `.openNotesSpec()` | rc-money.js |
| `WD.admin.custTypesSpec()` (customer types; `typesSpec()` is job types only) | admin.js |
| `WD.workflow.destructionSpec()`, `.awaitingDestruction()`; `WD.screens.billing.confirmDestroyed(jobs)`, `.isFirstDelivery(job)` (`data.biz.destroy`, `job.destruction`, `job.invoice.first`) | billing.js, workflow.js |
| `WD.ops.pricingOptions` (`data.settings.confirm.pricing`: `none rates total both`) | ops.js |
| `WD.truckProfile(vehicleId)`, `WD.fuelPrice(kind)`, `WD.fuelCostPerMile(vehicleId)` (`v.dims`, `v.truckRoutes`, `v.shop`, `data.maint.fuelPrice`); `WD.screens.maintenance.locationsSpec()` | rc-ops.js |
| `WD.r11.skillsSpec(scope)`, `.complianceSpec(scope)`, `WD.biz.fleetSpec(scope)` with scope `'people'` (HR) or `'trucks'` (Maintenance) | round11.js, biz.js |
| `WD.r13.leadAISpec()`, `.phoneAISpec()`, `.routeAISpec()`, `.checkinSpec()`, `.sheetsSpec()`, `.agreementRow(customer)`, `.flexFor(job)` | r13.js |

Always guard calls into another module (`WD.screens.jobs && WD.screens.jobs.openDetails && ...`).

### Control panel hooks

`WD.panel.addAction('Incoming call', fn)` adds a Simulate button; `WD.panel.addJump('Team', fn)` adds a shortcut. Both run with the tab interface showing and all sheets closed.
