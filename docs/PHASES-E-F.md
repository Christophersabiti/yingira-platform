# Phases E and F — planning, billing and integrations

## Where to start

Open an event as Admin and choose **Plan event & billing**. The planning workspace has Overview, Tasks, Programme, Suppliers, Budget & deposits, Client invoices, Client approvals and Business sections. Ushers and supervisors cannot access these private financial/client records.

- **Overview:** client contact, event currency and budget target. Uganda/UGX is the default. Currency is locked after the first financial record. Amounts are stored in integer minor units; UGX amounts have no decimal places.
- **Tasks:** owner, due date, status and notes. Edit existing tasks with revision checks, or remove obsolete ones.
- **Programme:** timed items, location, responsible person and linked supplier. End times must follow start times. Overlap notices are advisory because parallel activities may be intentional. Input uses the device timezone; the list displays the event timezone.
- **Suppliers:** event-scoped business contacts, service category and internal notes. Referenced suppliers cannot be deleted until their links are removed.
- **Budget & deposits:** keep planned, quoted and committed amounts separate. A required deposit is part of the committed amount, not additional spending. Record payments already made externally; the ledger does not transfer supplier money. Balances and deposit shortfalls update from recorded payments. Corrections append a reversal rather than changing payment history. Concurrent payments cannot exceed the outstanding balance.
- **Client invoices:** start from a reusable service package or individual line items. Issuing freezes the invoice contents and brand. Print/save as PDF, record manual receipts, or create a private Pesapal payment link. Invoice approval is separate from payment. Issued invoices cannot be edited; reverse eligible manual receipts and void/correct them. An open or uncertain online payment prevents conflicting manual receipts or voiding.
- **Client approvals:** share a frozen budget, programme, issued invoice or written proposal. A private link expires within 90 days; pending reviews can be revoked. The client records their name and either approves or requests changes. Supplier contacts, private notes and payment references are excluded from budget/programme snapshots. Later edits require a new review. Link possession is the access credential; this is not verified identity or an electronic-signature service.
- **Business:** organization-wide packages and branding, subscriptions and WhatsApp. Brand name, colour, logo and contact details appear on new client review snapshots; issued invoices retain the brand snapshot. The planner name/colour/contact information also appears on payment pages and printed invoices. This does not change the Yingira app favicon or platform navigation.

## Client billing and Yingira subscriptions

There are two separate Pesapal purposes:

1. **Client invoices:** payments settle to that planner organization's configured merchant account. No fallback sends client money to Yingira's platform merchant.
2. **Yingira subscriptions:** payments settle to the configured platform merchant. The approved initial platform owner, `sabiti.christopher@gmail.com`, can create draft/published subscription plans in the billing screen. No prices are seeded or published automatically.

Plans use UGX with 30-, 90- or 365-day prepaid terms and configurable active-event / invitations-per-event limits. Renewal is explicit; no saved-card charging or automatic renewal is enabled. Purchases snapshot the price and limits. A verified live completion grants its original time window exactly once. Refund/reversal invalidates only that order's term; later paid windows retain their dates. A future renewal starts on its original start date, so reversing a current term may leave a gap before the next valid term. New events, reopening closed events and guest creation/import enforce active entitlements. Billing expiry never blocks existing gate admission or access to historical records. Existing pilot organizations are not automatically charged or locked out.

Only the server calls Pesapal. Browser redirects and IPN payloads are **not** proof of payment: the adapter calls GetTransactionStatus and matches merchant reference, amount, currency and tracking ID against the saved order. Duplicate callbacks do not create duplicate receipts or terms. Reversed status cannot be undone by an older completion callback. The integration currently collects the whole outstanding invoice balance; manually recorded deposits reduce that balance before checkout.

An uncertain SubmitOrderRequest is not automatically repeated. The Admin can refresh a known tracking ID or reconcile an unknown request using the tracking UUID from the Pesapal merchant dashboard. That ID is still verified against the original reference and amount. A paid/uncertain checkout cannot be cleared merely by revoking its public invoice link. Refunds are initiated in the merchant/provider system; Yingira reflects verified reversals and does not expose a refund button that transfers funds.

### Pesapal activation

Configure server-only Vercel environment variables and redeploy. Never use `NEXT_PUBLIC_` for credentials. Keep sandbox and live merchant accounts/IPN IDs separate.

`PESAPAL_PLATFORM_CONFIG` is a JSON object for Yingira subscription receipts:

```json
{
  "consumerKey": "YOUR_PLATFORM_MERCHANT_KEY",
  "consumerSecret": "YOUR_PLATFORM_MERCHANT_SECRET",
  "notificationId": "REGISTERED_IPN_UUID",
  "mode": "sandbox"
}
```

`PESAPAL_MERCHANTS` maps each planner organization's UUID (shown in its billing screen) to its own configuration:

```json
{
  "ORGANIZATION_UUID": {
    "consumerKey": "YOUR_CLIENT_RECEIPTS_MERCHANT_KEY",
    "consumerSecret": "YOUR_CLIENT_RECEIPTS_MERCHANT_SECRET",
    "notificationId": "REGISTERED_IPN_UUID",
    "mode": "sandbox"
  }
}
```

Register `https://yingira-platform.vercel.app/api/payments/pesapal/ipn` with Pesapal using GET or POST and use the returned IPN UUID. The application sets its fixed return URL to `/payments/return`. Sandbox transactions are visibly marked and do **not** credit real invoice balances or subscription entitlements. Test the external sandbox redirect/IPN flow before switching the relevant merchant configuration to `live`. A controlled live transaction and reversal still require real merchant onboarding/credentials; mocked tests do not prove external settlement. No merchant account, purchase or payment was created during implementation.

References: [API 3.0 authentication](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication), [register IPN](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl), [submit order](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest), [verify transaction status](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus).

## Automated WhatsApp

The adapter targets **Twilio WhatsApp Business**. No WhatsApp provider account was supplied, so sending remains disabled until configured. Permission can be recorded beforehand: importing a phone number does not opt in a guest. The Admin records evidence of consent, selects recipients, previews a campaign, and confirms scheduling. Reminders exclude households that have already responded. Each recipient receives their own private invitation link through an approved template.

A protected Vercel cron checks every minute and dispatches up to 30 due messages within a 45-second processing budget. The existing hosting team is on Pro, which supports this frequency. Large queues span several runs; timing is not a delivery guarantee. A manual **Dispatch due messages now** button runs the same bounded worker. Each message is claimed atomically and is never blindly resent after a lost response. An interrupted claim becomes `unknown` for provider-log review. Signed callbacks distinguish accepted, sent, delivered, read and failed states and cannot downgrade a delivered/read receipt with an older acceptance event.

Before dispatch the worker rechecks consent, unchanged phone number, active invitation, active organization, event closure and reminder eligibility. Queued campaigns can be cancelled. STOP/UNSUBSCRIBE/CANCEL/END/QUIT replies suppress that phone across the organization and cancel queued sends. Messages already in flight cannot be recalled. Suppression is not silently cleared by the Admin's consent toggle; re-opt-in recovery requires explicit support review.

### WhatsApp activation

Set server-only `WHATSAPP_ACCOUNTS` to an organization-keyed JSON object:

```json
{
  "ORGANIZATION_UUID": {
    "accountSid": "AC...",
    "authToken": "YOUR_TWILIO_AUTH_TOKEN",
    "from": "whatsapp:+256...",
    "invitationTemplate": "HX...",
    "reminderTemplate": "HX..."
  }
}
```

Both Content SIDs must be approved WhatsApp templates with variables `1` = guest name, `2` = event title, `3` = the full private invitation URL. Include clear host identity and opt-out instructions in the approved template. Configure incoming messages for that sender to POST to `https://yingira-platform.vercel.app/api/whatsapp/webhook?organization=ORGANIZATION_UUID`. Per-message status callback URLs are set by the adapter. Callback validation uses the organization's Auth Token and exact canonical URL; configure `APP_ORIGIN` to the stable production domain.

The scheduler requires a random server-only `CRON_SECRET`; unauthenticated requests are rejected. No real campaign is seeded or sent. Complete sender onboarding, template approval, fee review and a controlled opted-in recipient test before live use. Configure at most one organization per Twilio sender/account unless the sender ownership and incoming opt-out routing are explicitly managed; ambiguous routing must not be assumed to work automatically.

References: [Twilio Message API](https://www.twilio.com/docs/messaging/api/message-resource), [secure callbacks](https://www.twilio.com/docs/usage/webhooks/webhooks-security), [WhatsApp template approval](https://www.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses), [Vercel cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Selected integrations and scope limits

Programme ICS export works with Google Calendar, Outlook and Apple Calendar. It preserves UTC times, stable event IDs and revisions, escapes user content and folds long Unicode lines. It contains programme title, timing, location and responsible person, not supplier contact details or internal notes. Calendar export is a snapshot; it does not create an OAuth connection or continuously sync accounts. Budget CSV and existing guest/seating CSV exports support spreadsheet workflows and neutralize spreadsheet formulas.

This release does not claim payroll, supplier payment initiation, tax filing/EFRIS, automatic card renewals, tax-compliant electronic signatures, custom domains, accounting-system synchronization, floorplan drawing, full offline operation or production-scale load certification. Issued invoices can include explicit tax/service lines entered by the planner, but no tax calculations or filing are invented. Supporting contracts/files beyond the existing image uploader, multi-function event hierarchies and a client login portal remain separate extensions.

## Verification and operational notes

Run `npm run test:commerce` against the local stack. It covers Admin/tenant isolation, stale edits, retry keys, linked suppliers, currency locking, concurrent financial limits, immutable payments/invoices/approvals, client snapshot privacy, owner-only plans, uncertain payment recovery, verified settlement/reversal, sandbox isolation, entitlement limits, WhatsApp consent, claim concurrency, ordered delivery statuses and STOP suppression. Unit tests cover exact money, safe ICS, payment verification mismatches, uncertain sends and callback signatures. Browser coverage exercises planning → supplier → programme → deposit → client approval → issued invoice → payment link, printing and mobile layout. Existing staff/admission/invitation-export tests remain in CI.

All new tables use forced RLS and no direct browser grants. Authenticated command functions run under the existing restricted executor with live-session, active-profile, organization and role checks. Public client/payment links and provider workers are fixed service-only adapters. No production guests, supplier records, financial records, packages, subscription prices or campaigns are seeded. The only owner bootstrap uses the previously approved, confirmed Admin email.

Supabase may flag the intentional [authenticated SECURITY DEFINER boundaries](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable); authorization is tested inside each boundary. The existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is unchanged. Real merchant settlement, WhatsApp delivery and event-day device/load rehearsals remain external release checks after account configuration.
