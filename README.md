# Make Room Outside Living: 3D garden room designer

A React and Three.js configurator built from Make Room's live catalogue. Visitors design a garden room or modular extension in five steps (size, exterior, doors and windows, interior, price), see it change in 3D as they go, then leave their details for a price and an eight-page PDF design pack.

Live: https://make-room-configurator.netlify.app/configurator/

## What it does

- **Catalogue parity** with Make Room's Salesqueze configurator: 16 module sizes and the width/length table, per-wall cladding (32 finishes, plus 3 brick slips on extensions), 12 doors and 9 windows in aluminium or uPVC with black or anthracite frames, left-offset positioning with the 100mm edge gap, overhang 300–600mm and decking 600–5000mm on any wall, 5 decking colours, 4 floors, 3 electrical packages. See `docs/cross-reference-2026-10-12.md`.
- **3D that looks like Make Room's buildings**: the porch overhang carries the side walls forward with a clad soffit, anthracite fascia with a fall to the back, up/down wall lights by the doors, soffit downlights, 100mm decking with black edge trim, and extensions built against a house wall. Cladding textures are rebuilt from Make Room's own catalogue photographs with relief maps from its renderer.
- **Outside, inside and plan views**, zoom (wheel, pinch, buttons, + and − keys), measurements, day or dusk lighting, undo/redo, full screen.
- **The view follows each change**: changing a wall, door, overhang, deck, floor or lighting turns the camera to it and pulses a highlight over it; the chosen option card flashes.
- **Sales actions everywhere**: request a callback, arrange a show village visit or request a brochure from the header, the price page and the PDF (`/api/request`). First and last names are separate, and the phone number is required and checked as a real UK number (Ofcom drama numbers and premium ranges refused).
- **First-visit tour** (six steps, replayable from the ? button).
- **PDF design pack**: cover, price, four exterior views, two interior views, dusk view, true-scale plan and four elevations with dimensions, specification with swatches, next steps with a QR code back to the design.

## Local work

`npm install`, then `npm test` (26 tests) and `npm run build`. For the full stack use `netlify dev --offline` (configured in `netlify.toml`: app on 4964, Vite on 4965); plain `npm run dev` serves the UI without the functions.

QA tools:

- `tools/qa-options.mjs`: open the dev server, then in the console `await (await import('/tools/qa-options.mjs')).run(window.__mr)`. It builds every option into the 3D engine and checks the right part changed (795 checks).
- `scene-test.html`: the 3D engine alone, e.g. `/scene-test.html?view=plan&light=evening&dims=1`.
- `window.__mr.debug()` reports the scene, camera and draw calls.

## Code map

- `src/catalog.js`: the catalogue, design schema (v2), placement rules, share codes. Every design passes through `normalizeConfig`.
- `src/scene/`: `textures.js` (finish materials), `building.js` (walls, openings, roof, decking, electrics, plan section, focus targets), `furniture.js`, `landscape.js`, `engine.js` (renderer, views, focus and highlight, PDF captures).
- `src/ui/`: viewer, steps, price step and lead form, enquiry drawer, tour. `src/App.jsx` holds state and history.
- `src/content.js`: every customer-facing claim (USPs, show village, process), each taken from Make Room's site on 12 October 2026.
- `src/validation.js`: name, email, postcode and UK phone rules shared by browser and server.
- `server/`, `netlify/functions/`: quote, design pack and request endpoints; Netlify Blobs storage.

## Pricing and launch status

Make Room's live tool hides all prices. Estimates here use only Make Room's published figures: the January 2024 size guide (7.5–24m²), the £9,980 range entry price, and the £3,500 bi-fold allowance. Everything else is "Priced by your designer". `MAKE_ROOM_PRICING_MODE=quote-only` turns numbers off. A current rate card from Make Room is needed before binding quotes.

Enquiries, callback requests and PDFs are stored privately in Netlify Blobs (`make-room-leads`). No email or CRM delivery is configured. Make Room publishes no downloadable brochure: brochure buttons collect a request; set `BROCHURE_URL` in `src/content.js` to switch them to a direct download.

This is a review deployment under GLO with noindex headers. It does not replace Make Room's site.
