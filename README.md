# Make Room Outside Living — garden room design studio

A branded React / Three.js configurator built from the live Make Room catalogue, with width/depth sliders, instant finish and opening previews, a short enquiry gate, private server-calculated planning estimates and a personalised seven-page PDF.

Live: https://make-room-configurator.netlify.app/configurator/

## Local work

`npm install`, `npm run dev`, `npm test`, `npm run build`. Use `netlify dev` for the quote and PDF functions; Vite alone renders the UI but does not emulate the backend. Node22 or later. Git pushes to `main` deploy automatically through the existing Netlify GitHub App.

## Pricing and launch status

The current Make Room CPQ service hides prices and supplies no numeric tariff. Planning estimates interpolate Make Room's published January2024 examples only within7.5–24m²; smaller rooms display the separately published range entry price and explicitly do not treat it as the selected room's quote. Bigger rooms and extensions request a specialist quote. Only the published £3,500+ bi-fold allowance is added; other selected options remain unpriced pending a specialist. Every estimate states its source and limits. `MAKE_ROOM_PRICING_MODE=quote-only` disables numbers. Replace the server pricing model with a client-approved current rate card before using this for binding quotes.

Requests are persisted as immutable private Netlify Blobs objects. A secure HttpOnly session cookie gates recalculation and owned PDF downloads. Contact details do not enter URLs, PDF files or analytics events. There is no automated email or client CRM delivery; project operators can inspect/export the `make-room-leads` store from Netlify Data & Storage. Configure a client-approved CRM destination, notification delivery and record-retention policy before acquisition campaigns.

The site is a review deployment under GLO, with noindex headers. It does not replace Make Room's existing website. All official logo/font/photo assets are preserved for this authorised client design preview.

## Evidence

- `research/source-audit.md`: current source and catalogue review
- `research/catalogue.json`: cleaned verified sizes, colours and opening choices
- `research/competitor-audit.md`: Noah, SMART and GLO benchmark observations
- `docs/cro-plan.md`: conversion hypotheses and event schema
- `docs/qa-report.md`: local and live checks
- `server/README.md`: quote/PDF data flow and operator guidance

No new competitor PDF attachment was visible in this chat. The benchmark uses the latest accessible local Noah quote PDF, explicitly recorded in the competitor audit.
