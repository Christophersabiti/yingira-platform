# Yingira: commercial product research and proposed delivery plan

Research date: 23 September 2026. **Status: proposal only; implementation awaits owner approval.** No application, database, deployment or commercial subscription changes are authorized by this document.

## Recommendation

Position Yingira first as an event guest-management service for weddings, introductions and private celebrations: prepare the guest list, create attractive personalized invitations, collect responses, arrange tables, and welcome people reliably. Expand into the planner's complete event workspace after this journey works end to end.

The strongest immediate release is **bulk guest import + guided Invitation Studio + RSVP and communication**. Imports and card design remove the current setup bottlenecks; RSVP closes the loop between an attractive invitation and a usable attendance forecast. Budget, suppliers and timelines are necessary for the longer-term promise of managing the whole event.

Assumptions: Uganda/East Africa is the initial market; professional planners and hosts are the initial buyers; guests commonly receive shared links; weddings and introduction ceremonies lead, with configurable labels for other celebrations and corporate events. These are product hypotheses, not validated market findings.

## Research method and limits

Reviewed Yingira's implementation and phase documents, official vendor product pages, help articles, design catalogs, API documentation and pricing descriptions. Used the UI/UX Pro Max skill for interface guidance and the Adobe Express connector to retrieve three current invitation template references. Applied judgment where generic skill recommendations were inappropriate: romantic typography belongs on cards, not on guest-management tables or gate controls.

This is desk research, not a hands-on paid-account audit, performance comparison or customer-interview study. Vendor claims establish advertised capabilities, not proof of reliability or usability. Search did not establish a sufficiently verified local wedding-software comparison; Quicket's Uganda presence is a ticketing reference, not evidence that it provides the complete wedding-planning workflow. No market-share or local willingness-to-pay claims are made. Feature availability depends on vendor plan and may change.

## Competitive benchmark

| Product               | Verified reference capabilities                                                                    | Lesson for Yingira                                                                        | Boundary                                                                                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Joy                   | Spreadsheet guest import, household/party grouping, tags and connected guest communication         | Keep people, invitation groups and responses connected; provide a flexible import preview | Its detailed import guide requires exact headers, despite broader marketing wording about mapping; Yingira should make mappings explicit. [Import guide](https://withjoy.com/help/en/articles/8309207-importing-and-exporting-your-guest-list)               |
| Zola                  | Guest-list guidance covers spreadsheet uploads, families, plus-ones, event invitations and exports | Support actual household structure and different event attendance                         | Reference for wedding guest organization, not a verified gate-operations comparison. [Guest-list help](https://www.zola.com/faq/category/115000345711-guest-list)                                                                                            |
| Paperless Post        | Uploaded artwork with RSVP, guest tracking, messaging and reminders                                | Allow externally designed cards to use Yingira's guest operations                         | Uploading finished artwork does not make every element editable. [Upload your own](https://www.paperlesspost.com/upload-your-own)                                                                                                                            |
| Greenvelope           | Personalized designs, custom artwork, RSVP questions, reminders, guest exports and seating         | Carry guest information through invitation, catering and seating                          | Review exact plan and export behavior before promising parity. [Official FAQ](https://www.greenvelope.com/faq)                                                                                                                                               |
| RSVPify               | CSV/Excel guest imports, group/plus-one handling, segmented communication, seating and QR check-in | Build a unified guest record and controlled invitation-only response flow                 | Enterprise support articles describe a particular product version; the general guest-management page is the broader reference. [Guest management](https://rsvpify.com/guest-list-management/)                                                                |
| Canva / Adobe Express | Template-based invitation creation with personal imagery and visual customization                  | Make names, photos, palette and layout easy to change                                     | Creative tools are references and optional integrations, not substitutes for admission logic. [Canva](https://www.canva.com/create/wedding-invitations/), [Adobe](https://www.adobe.com/express/create/invitation/wedding)                                   |
| Aisle Planner         | Timeline, checklist, budget, vendor contacts, design boards, guest management and seating          | Whole-event management needs planning and collaboration beyond invitations                | Broader professional-planner scope belongs after the guest journey. [Project management](https://aisleplanner.com/products/project-management/), [Plan structure](https://help.aisleplanner.com/en/articles/1899152-aisle-planner-subscription-plan-options) |
| Planning Pod          | Budgets, production tasks, suppliers, schedules, floorplans, files and client collaboration        | Give every task an owner and deadline; connect spending and suppliers                     | Avoid promising a full venue-management suite in the next release. [Production tools](https://planningpod.com/solutions/departments/production)                                                                                                              |
| Eventbrite            | Registration/ticketing, check-in, reserved seating, promotion and reporting                        | Useful reference for paid-event expansion and operational reporting                       | Public ticket sales are a different first business model from private wedding invitations. [Features](https://www.eventbrite.com/organizer/features/all-features/)                                                                                           |

## What Yingira has, and what is missing

Verified baseline: organization Admin access, staff event assignments and role routing, exclusive active staff sessions, individual invitations with group capacity, QR verification/admission, revocation/reissue, basic arrival metrics and audit. Table assignment is currently text. Guest invitation sharing and staff registration links are manual. The recent existing-invitation decryption failure is fixed, but it highlights the need for signed-in production release checks.

| Priority                  | Missing capability                                                                             | Why it matters commercially                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Next                      | Bulk guest upload, search, filters, editing and export                                         | A host cannot reasonably enter hundreds of guests one at a time  |
| Next                      | Invitation templates, couple photo, colour themes, saved designs                               | The invitation must represent the client's occasion and identity |
| Next                      | RSVP and invitation delivery workflow                                                          | Hosts need expected headcount and a way to follow up             |
| Before broad paid rollout | Assisted guest lookup, supervised exceptions, multi-gate readiness, recovery drills            | A beautiful invitation is insufficient when a guest cannot enter |
| Next commercial increment | Seating entities, capacity validation, meal and accessibility requests                         | Converts responses into usable venue and catering arrangements   |
| Whole-event expansion     | Timeline, tasks, suppliers, expenses, deposits and due dates                                   | Makes Yingira useful throughout planning, not only at the door   |
| Commercial operations     | Packages, billing, usage controls, onboarding, client permissions and support                  | Needed to sell and operate a repeatable service                  |
| Later differentiation     | Multi-function celebrations, offline strategy, reusable planner templates, white-label options | Useful once the core workflow is validated                       |

## Bulk guest import: proposed specification

**Admin journey:** Guests → Import guests → select CSV/XLSX or paste spreadsheet rows → select sheet → map columns → review → confirm → results. Downloadable templates remain available, but exact vendor-specific headings should not be mandatory.

Show a preview before any guest records are created. Suggest mappings such as Guest/Name/Full name, but make the Admin confirm ambiguous mappings. Show invitations and people separately: “180 invitations, up to 310 people”, not an ambiguous “310 guests imported”.

### Data rules

Start with one row per invitation group to match today's admission model. Required fields: invitation/display name and total people allowed. Optional contact fields: phone and email; at least one is needed for automated delivery, but a host should be able to prepare a list before collecting contacts. Add category/tags, table label and internal note. Optional stable external reference supports later safe updates.

A second advanced format supports one row per named person with a Group ID after household/member records are introduced. Do not silently interpret person rows as independent group invitations. Existing groups retain their QR, allowed count and admissions during migration. The plan must explicitly decide how unnamed guests become named household members without multiplying capacity.

Separate: invited capacity, RSVP attending count, admitted count and current presence. “Confirmed 2” must not silently overwrite a card allowing 4; the Admin decides whether to change the allowance. Existing admission totals cannot be lowered by import.

Phone numbers remain text, preserving leading zeros and plus signs. Country selection is explicit; offer Uganda as a user-confirmed default, then normalize and preview. No silent conversion of an unknown number to +256. Guests with shared phones are valid; never auto-merge them. Flag likely duplicates using normalized name/contact combinations and show existing record context. Choices: keep separate, skip, or review. Do not offer blind merge/update in the first importer.

### Failure and recovery behavior

Show row number, original value, error reason and suggested correction. Permit importing explicitly selected valid rows while retaining rejected rows for correction. Preview never sends invitations. Import uses a job ID and stable row keys; retrying the same job must not create additional guests. New uploads that resemble earlier imports must be flagged, not automatically replayed.

Provide progress, resume after disconnect, created/skipped/failed totals and a safe error-file export. Ignore spreadsheet formulas as executable content; reject macro-enabled and unsupported workbooks; protect exported text against spreadsheet formula execution. Proposed starting envelope: 5 MB and 5,000 invitation rows per job, subject to load-test confirmation rather than a promised capacity.

A reversible import action may archive newly created, unused rows. Once a record has been sent, answered or admitted, require record-level reconciliation rather than silently deleting history.

**Acceptance:** a 1,000-row sample can be mapped, checked and committed; an interrupted retry produces no duplicates; multiple households sharing a phone remain separate; invalid rows are explainable; counts agree between preview and results; another organization's file/job is inaccessible; no messages are sent by upload alone.

## Invitation Studio: proposed specification

### Three entry points

1. **Choose a Yingira template** — recommended default. Structured, editable designs with constrained layouts.
2. **Upload finished artwork** — use an image exported from Canva, Adobe or a designer. Yingira adds a separate personalized name/QR panel. Explain that embedded text in an image cannot be recoloured or rewritten as editable text.
3. **Recreate a style** — later assisted service: identify layout, palette, typography and photo placement from a client-authorized reference, then build an editable Yingira template. Do not promise automatic exact conversion or copy a vendor's proprietary artwork. A generic style can inspire an original design.

### Admin editing journey

Choose occasion → choose design → enter details → upload photo → adjust colours/fonts → preview a sample guest → save draft → approve/publish → download/share.

Use a desktop layout with controls at left and a large preview at right. On mobile, use clear Details / Photo / Style / Preview steps. Autosave with visible status, undo/redo, restore defaults and duplicate design. Template switching preserves content and photo; show a preview before discarding incompatible layout settings. Publishing shows which event and invitation audience is affected.

Editable content: bride and groom names with configurable labels; host/family names; optional welcome phrase or quotation; occasion title; date/time/timezone; ceremony and reception locations; RSVP deadline/contact; dress code; directions and optional programme. Support long names, accents and local-language wording without forced line truncation. Event changes should update shared details once, with a publish review rather than silently changing live cards.

Photo controls: upload JPEG/PNG/WebP, crop, pan, zoom, rotate and reset; choose full photograph, arch frame, circle or separate photo panel. One couple photograph first; two separate portraits can follow. Preserve the original privately, remove metadata from published derivatives, validate actual image content and dimensions, and generate efficient display sizes. Provide low-resolution warnings. Real uploaded faces must remain unchanged unless the host explicitly requests editing. HEIC conversion is a later compatibility option, with clear upload feedback initially.

### Original starter design collection

| Family                    | Composition                                           | Proposed palette                                     | Photo treatment                                  |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Classic ivory             | Formal centered type, generous space, fine border     | Ivory #F8F3E8, charcoal #252525, muted gold #A88443  | Optional portrait on reverse/details panel       |
| Botanical                 | Botanical corners, calm serif headings                | Cream #FAF8F1, forest #294A3C, sage #A9B8A0          | Soft arch frame                                  |
| Modern portrait           | Large couple photograph and clean information block   | Warm white #FAF7F2, ink #222222, clay #B77761        | Full-width photo with independent text panel     |
| Evening celebration       | Restrained geometric border and prominent names       | Navy #15243A, ivory #FFF8EC, gold #B79B62            | Framed portrait                                  |
| Floral romance            | Original floral ornaments with light background       | Blush #F4E5E4, burgundy #612C3E, cream #FFFAF2       | Oval or rectangular frame                        |
| Contemporary introduction | Strong host/family hierarchy with commissioned motifs | Terracotta #A55239, sand #F0E4D3, dark brown #33251E | Optional photo; motifs reviewed with local hosts |

These are proposals, not copied catalog templates or validated cultural preferences. Accent colours are not automatically suitable for body text. Use readable dark text, measured contrast and licensed fonts. Decorative script is limited to short names/headings. Keep the Yingira Admin interface's calm green/neutral styling independent of event themes.

Launch with six strong templates and several palettes, then expand based on purchases and usage. Provide no-photo variants and template filters for occasion, photo placement, tone and orientation. Saving a customized design as an organization template is valuable for repeat planners.

### Publishing and output

Keep artwork, event facts and guest credentials separate. QR codes must be generated from the actual invitation token, never invented by an image model or embedded by a generic template. Preserve a high-contrast quiet zone and verify scanning from common phones and printed output.

Support a mobile invitation page, per-guest PNG and print PDF. Use a print-size preset such as 5×7 inches, with configurable bleed only where the output/printer requires it. Export jobs need progress and retry; private bulk ZIP exports need expiry and Admin-only access. Generic promotional previews must not expose a guest QR or private contact details.

Drafts are private. Publishing creates a version with rollback. Online pages can use the new published design without replacing tokens or changing admissions. Already downloaded images and printed cards stay unchanged and must be regenerated if information changes. A published design failure must fall back to readable event information and QR rather than blocking guest access.

**Acceptance:** Admin personalizes names, photo and theme without coding; previews a long guest name; no guest token is altered by design publication; drafts stay private; PNG/PDF QR scans on real phones; existing invitations still render after deployment; reverting a design version does not reverse attendance.

## Design references and integration decision

Official catalogs for visual reference: [Paperless Post wedding collection](https://www.paperlesspost.com/cards/group/wedding-invitations), [full-page photo example](https://www.paperlesspost.com/card/full-page-photo-invitation), [Greenvelope wedding collection](https://www.greenvelope.com/wedding-invitations). These support the range of formal, photographic, modern and decorative directions; they are not a licence to redistribute their designs.

The Adobe connector returned these references; none was selected, edited, purchased or published:

1. **Green and White Wedding Invitation**
   [Edit in Adobe Express](https://to.adobe.com/kT7AUDhs) · [Preview](https://to.adobe.com/IAYFXtCS)

2. **Ivory Blue Green Neutral Pastel Vintage Minimal Simple Wedding Invitation** (Premium)
   [Edit in Adobe Express](https://to.adobe.com/J28RON9V) · [Preview](https://to.adobe.com/Y6hTHrS6)

3. **White And Green Minimal Wedding Invitation Card** (Premium)
   [Edit in Adobe Express](https://to.adobe.com/ggyniTkV) · [Preview](https://to.adobe.com/e3hPEiVL)

[Browse more templates](https://adobesparkpost.app.link/95w8AeONcYb?q=wedding+invitation&referrer=afc_openai_codex&intent=search_design&sdid=CMR41ZGB)

| Approach                        | Decision                   | Reason                                                                                                                                                                                                                                                  |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native guided Yingira templates | Build first after approval | Direct control over personalization, mobile usability, QR integrity and versioning                                                                                                                                                                      |
| Uploaded exported artwork       | Include next release       | Supports designers' existing tools with little integration dependency                                                                                                                                                                                   |
| Adobe Express embedded editor   | Optional later evaluation  | Official documentation now requires business access approval plus integration review; plugin availability in this chat does not grant Yingira embedding rights. [Adobe requirements](https://developer.adobe.com/express/embed-sdk/docs/guides/review/) |
| Canva automated designs         | Optional later evaluation  | Current Autofill documentation requires acting for a user with an eligible plan; confirm authentication, plans, review and licensing before committing. [Canva Autofill](https://www.canva.dev/docs/apps/rest-apis/reference/autofills/)                |
| AI design assistance            | Later, bounded             | Useful for draft wording, palettes and original decorative backgrounds; deterministic text, guest data and QR remain authoritative                                                                                                                      |

The Adobe chat connector's prompt-based image replacement is not the same as an in-product upload of the client's exact photograph. Yingira must own and test that photo-upload path. No guest lists or client photographs were transferred to a design service during this research.

## RSVP, messaging and seating

A guest should open the invitation without creating an account, see the allowed party size, respond yes/no for permitted people, supply optional meal choices and view directions. Save responses separately from gate admission. Admin can record a response received by phone with an audit trail. Support deadlines, reminders and response edits with clear rules. Public name-search directories are unnecessary for a private invitation.

Communication centre: select recipients by RSVP/category, preview personalization, show count and cost estimate, send a test, then confirm sending. Track provider-accepted, delivered, failed, response received and retries distinctly. Manual WhatsApp sharing is a useful first step but must be labeled “shared manually”; clicking Share is not proof of delivery or reading.

Automated WhatsApp is a separate provider integration. Recipient permission, approved templates and suppression of opted-out contacts are required design inputs; do not treat importing a phone number as consent. Meta's current policy requires approved templates for initiated conversations and outside the customer-service window. [WhatsApp policy](https://business.whatsapp.com/policy). Validate provider onboarding, recipient-country pricing and billing before implementing automated delivery.

Seating starts with named tables, capacity, unassigned guests and a printable table list. Add visual drag-and-drop later, with keyboard alternatives. Each seat represents a person; a household of four consumes four places. Check-in reads the current assignment. Caterer exports use meal counts and relevant notes without unnecessary contact details.

For multiple functions, introduce one celebration/project containing introduction, ceremony and reception sessions. Permissions, invitation eligibility, RSVP and admissions must be session-specific. One shared card can show only the functions that party is invited to. This needs a planned migration; today's event-scoped QR must not be casually reused to admit guests to every function.

## Whole-event planning and commercial operation

Add tasks with owners/deadlines/status, an event-day programme with start/end times and responsible suppliers, and a shared contact directory. Track planned, quoted, committed and paid amounts separately; deposits, balances, due dates, currency and attachments belong against suppliers. Recording a supplier payment is not processing it. Later provide a client approval portal for designs, guest counts and budgets with restricted access.

Commercial readiness also requires password recovery, automated staff invitations, clear organization ownership/transfer, account suspension rules, billing receipts, usage visibility, support channels, monitored failures and restore drills. Preserve audit and access controls for supervisor exceptions, exports and data retention. Device rehearsal must include real Android/iPhone cameras, poor venue connectivity and concurrent gates. Full offline admission is a distinct correctness project: two disconnected gates cannot both promise globally exact remaining capacity without a restrictive allocation/reconciliation strategy.

## Packaging recommendation

Use a **per-event package for occasional hosts**, a **subscription by active events for planners**, and paid optional services for custom designs and event-day assistance. Include transparent message credits; pass through additional delivery costs rather than promise unlimited messages. Do not charge differently for basic QR reliability or essential permission controls.

Reference patterns: Greenvelope offers single-mailing and annual structures; Aisle Planner describes active-project plans; RSVPify separates plan capabilities and usage limits. These support the packaging options, not a price for Uganda. [Greenvelope](https://www.greenvelope.com/faq), [Aisle Planner](https://help.aisleplanner.com/en/articles/1899152-aisle-planner-subscription-plan-options), [RSVPify pricing](https://rsvpify.com/pricing/).

Set UGX price points only after interviews and pilot cost measurement. Assess hosting/storage, image/PDF jobs, messages, provider fees, onboarding effort and on-site support. Confirm Uganda merchant eligibility, mobile-money/card settlement, refunds and reconciliation before choosing a payment provider. No payment provider or subscription has been selected or purchased.

## Proposed phases and approval gates

| Phase                           | Concrete deliverable                                                                                             | Exit evidence                                                                            | Relative effort              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------- |
| A — Guest foundation            | Import wizard, validated CSV/XLSX, duplicate review, search/filter/edit/export, contact rules                    | Retry/duplicate/isolation tests; large sample; host completes import without help        | Medium                       |
| B — Invitation Studio           | Six native designs, palettes, couple names/photo, artwork upload, draft/publish, individual PNG/PDF              | Host customizes unaided; mobile/print previews; real QR scans; old invitations unchanged | Large                        |
| C — Responses and communication | Household/member model, RSVP, email delivery/reminders, manual WhatsApp sharing, delivery ledger                 | Response/capacity consistency; send preview and retry tests; actual provider delivery    | Large                        |
| D — Event-day and seating       | Tables, capacity, seating exports, assisted lookup, scoped supervisor exceptions, exit/re-entry                  | Multi-gate rehearsal, concurrent last-slot tests, audit and presence reconciliation      | Large                        |
| E — Full planning workspace     | Programme, tasks, vendors, budget/deposits, client approvals, multiple functions                                 | Planner runs a full sample celebration without duplicate spreadsheets                    | Extra large                  |
| F — Commercial scale            | Packages/billing, organization onboarding, planner templates/branding, automated WhatsApp, selected integrations | Paid pilot, support readiness, unit economics and provider onboarding                    | Large; external dependencies |

Commercial reliability work and customer discovery run through every phase; they are not deferred until F. Begin with A then B; approve C's guest/household architecture during A's detailed design to prevent rework. Finish C and essential D operations before claiming a general commercial launch. Phases E/F remain a roadmap, not an included promise of the next increment. Effort labels are comparative, not calendar estimates; dates require approved scope, design assets and provider decisions.

Technical direction after approval: preserve existing organization/event authorization, admission ledger, tokens and account session policy. Add import jobs/rows, design versions/assets/export jobs, party members/responses and later messaging/table/planning records through incremental migrations. Large imports and exports run in durable jobs with bounded batches, tenant-scoped authorization and idempotent retry. Introduce narrower focused commands as needed; avoid indefinitely expanding a single unreviewable routine. No data reset or reseeding of production.

## Validation before fixing scope and prices

Conduct five planner/venue interviews and five host interviews, plus three observed pilot events of different sizes. This is proposed work, not completed research. Collect anonymized spreadsheet examples and client-owned design references. Observe import errors, family grouping, invitation delivery methods, late changes, gate queues and supplier handovers.

Proposed success targets to validate: import a clean 500-row file in under five minutes of host effort; personalize and publish a template within ten minutes; no duplicate imports on retries; no incorrect capacity from household conversion; all issued QRs scan in the agreed device rehearsal; no unresolved cross-tenant access failures. Track import completion, time to first published invitation, RSVP completion, delivery failures, scanner retries, manual exceptions, support minutes per event and repeat-planner usage. Set performance thresholds against a declared venue/network/device test profile, not an unsupported SLA.

## Approval requested

Approve **Phases A and B as the next implementation scope**, with the guided native editor, six original template families, real photo upload and exported-artwork support. Treat C–F as the proposed commercial roadmap. The starting assumptions are weddings/introduction events, Uganda-first defaults, a phone-friendly guest experience, and no requirement for guests to create accounts. Template references are for selection/inspiration only; no external designs are automatically licensed or copied.

This document is the research deliverable. Implementation, deployment and purchases remain on hold until the owner approves the scope.
