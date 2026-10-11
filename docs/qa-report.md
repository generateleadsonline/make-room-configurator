# Make Room configurator QA

Checked 11 October 2026 against implementation commit `bbb96bec08bea9fa47f127001c8eda0637d580f8`, Netlify deploy `6acb6552213b7e00081c8608` (ready).

Live: https://make-room-configurator.netlify.app/configurator/
Repository: https://github.com/generateleadsonline/make-room-configurator

## Results

- Production build passes. Ten meaningful local tests pass: private enquiry/PDF behaviour and an independent comparison of every width/depth combination and 35 finish choices against the extracted live catalogue.
- All 32 live API checks pass, covering rejected or missing enquiries, durable receipt storage, session ownership, estimate revisions, idempotency, private PDF save/download, cross-origin protections and cache headers. See `live-api-qa.json` for individual outcomes. Earlier API test records were removed after verification.
- Live browser journey passes: purpose/dimension controls, front/plan/interior preview controls, day/evening state, blank-form validation, synthetic valid enquiry, £15,700 default published-guide estimate, PDF download, reload/session restoration and revision without re-entering contact details. A 4m × 4m revision is preserved and returns £21,000 from the same published guide model.
- Responsive live UI inspected at 375px mobile, 768px tablet and 1280px desktop. Width/depth buttons and keyboard slider input update the rendered design. Mobile fields, validation and submit button fit the frame. Measured mobile document width375px / scroll width367px and desktop viewport1280px / scroll width1272px: no horizontal overflow. Mobile/tablet widths use a local QA iframe loading the production URL because the browser viewport override did not alter the actual viewport.
- No live browser warning/error logs were reported during the verified journey.
- Actual live PDF downloaded, saved under `output/pdf/`, and all seven pages rendered with Poppler and visually inspected. 594,010bytes; A4; 22 working URI annotations. Verified amount, January2024 source caveat, room renders, front elevation, dimensioned plan, 1.68m French-door width, specification, electrical package, showroom details and config-only QR/reopen links. No name/email/contact details are included. No clipping or overlap observed.
- Desktop and mobile evidence saved under ignored `qa/screenshots/`. Synthetic UI receipt is marked explicitly as QA and excluded from any contact workflow.

## Scope and launch requirements

This is a review deployment under GLO with noindex headers. It does not replace the client's existing embedded configurator. The current source service hides numeric prices; the server therefore uses clearly dated January2024 public examples as planning guidance, with unpriced options referred to a specialist. Client approval of a current rate card is needed for commercial quotes.

Enquiries and owned PDFs are stored privately in Netlify Blobs. Client CRM routing, automated notifications and a retention policy are not configured. These need a client-approved destination before acquisition campaigns. No email was sent during QA.

Conversion improvement is a testable hypothesis, not an achieved uplift. `cro-plan.md` defines the funnel events, qualified-lead metrics and controlled-test approach. No new competitor quote attachment was available in this chat; research used the accessible local Noah example and recorded that limitation.
