# Make Room configurator QA, v2 upgrade (12 October 2026)

Branch `upgrade-v2`, merged to `main`. The previous release's QA is in git history (commit 34237c7).

## Option coverage (3D)

`tools/qa-options.mjs` builds every option into the live engine in the browser and checks the right part of the building changed: **795 checks, 0 failures**.

- All 32 garden-room finishes on every wall, all extension finishes (including 3 brick slips) on the three extension walls, and a four-finish mixed building. Steel is refused on extensions and brick on garden rooms. An extension has no clad back wall.
- All 21 doors and windows, in every frame material (aluminium/uPVC) and colour (black/anthracite). The built frame width matches the catalogue width, and black and anthracite render differently. Openings sit on each of the four walls. A 3.45m bifold is refused on a 2.8m wall, and a back-wall opening on an extension.
- Overhang on each wall at 300mm and 600mm (the roof extends exactly, two porch wings, a soffit) and decking on each wall at 600mm and 5m (exact projection, 100mm thick). All 5 decking colours, all 4 floors.
- Electrical packages: downlights 0/4/6/8, external downlights 0/0/2/4 and up/down lights 0/2/2/4 match Make Room's package lists.
- All 4 uses furnish the room. An extension renders against a house wall. All 135 legal width × length combinations build at their exact size.

## Unit tests

`npm test`: 26 pass. They cover UK phone, name, email and postcode rules (Ofcom drama numbers and 08/09 refused), strict v2 config validation, pricing (12m² → £16,500, a bi-fold allowance per bi-fold, extensions and >24m² → tailored quote), the quote, PDF and request handlers, catalogue parity with `research/catalogue.json` (every finish and product id, every width/length pair), compact share links, old v1 link migration, making room on a full wall, and extension rules.

Fuzzing: 5,000 random designs normalise idempotently, and the server accepts 2,000 normalised random designs.

## Journeys (local `netlify dev`, headless Chrome with real WebGL)

- Price form: blank submit flags all five required fields. A sample drama number is refused. `+44 (0)7911 123456` is recognised as a UK mobile and tidied to `07911 123456`. A valid submit returns the saved reference and "from £19,200" for the default design.
- Callback request (phone layout): saved with an MR-REQ reference and the design attached.
- PDF design pack: 8 pages, 2.7MB, 12 renders (cover, hero, front, back, top, dusk, two interiors, plan, four elevations). Pages were rasterised and reviewed: dimensions on the plan and elevations, opening tags, swatches, schedule, QR to the compact design link. Fonts are Make Room's Almarena.
- Layout at 320, 375, 768, 1024, 1440 and 1920px wide: no horizontal overflow on any step, no console errors. The welcome card, tour, drawer and all five steps were captured at each size.
- Design gallery (cedar, black slatted, thermowood, Cedral lap, steel, brick extension, oak slatted extension, mixed gym) was compared with the photographs in `research/website-2026-10-12`.

## Known limits

- Prices come from Make Room's published January 2024 guide; the live tool has no rate card.
- The phone check confirms a valid UK number format and excludes reserved ranges. It does not ring the number or send an SMS.
- No email or CRM delivery is configured; enquiries, requests and PDFs are stored in Netlify Blobs.
