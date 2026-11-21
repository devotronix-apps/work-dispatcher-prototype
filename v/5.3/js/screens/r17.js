/* RouteClerk prototype 5.3 — the default view of each tab (the Home button).
   The Home button itself is drawn by core.js (first in the trailing group of a tab's navigation bar) and by Dispatch and Map in their own
   top bars. This file only says, for the tabs that keep their view in a registered view-state object, which choices count as "the view":
   selectors, filters and sort orders do; what a person typed (a number, a search) and what a screen is in the middle of loading do not.
   A tab with no entry here has one view only, so it never shows a Home button. */
(function () {
'use strict';
const app = window.WD.app;

/* Dialer: the keypad, the Inbox side of Calls and Texts, every agent. The typed number and the line to call from are left alone. */
app.home('dialer', app.viewHome(['dialer', 'staff'], { skip: ['typed', 'from', 'to', 'win', 'heat', 'rAgent'] }));

/* The Admin tab is the CRM: its side, view, filters and sort order, and the lead and deal desks behind it. */
const crm = app.viewHome(['crm', 'needs', 'crmDesk']);
app.home('office', crm);
app.home('crm', crm);

/* Customers: the Customers side with every customer showing. */
app.home('customers', app.viewHome(['customers'], { skip: ['min', 'query', 'results', 'loading', 'busy', 'justDone', 'page'] }));

/* Invoices: whose invoices, which kind, the period, the status and the tracking tiles. */
app.home('invoices', app.viewHome(['invoices', 'invTrack', 'invFilter'], { skip: ['query', 'limit', 'sel', 'routeId'] }));

/* Reports: the period, the comparison and chart or table. */
app.home('reports', app.viewHome(['reports'], { skip: ['sel'] }));

/* Bids and Prospects: the Opportunities side with every stage. */
app.home('bids', app.viewHome(['bids']));
})();
