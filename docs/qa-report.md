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

## Mobile and browser compatibility (13 October 2026)

Reported: phones showed "3D isn't available on this device". Reproduced on the live site. Once a browser reclaimed the WebGL context (app switch, screen lock or memory pressure, all routine on iPhones), the viewer switched permanently to the fallback. Devices with only WebGL 1 could not start Three.js r170 at all.

Fixes:
- **Context loss is recovered.** The view restores in place. If the browser does not hand the context back, it is rebuilt on a fresh canvas, stepping down a quality tier.
- **WebGL 1 works.** Three.js is pinned to r162, the last release with WebGL 1 support.
- **Device tiers.** Phones and tablets use half-resolution finish textures, 1024px shadows, a 1.5 pixel ratio and fewer night spotlights. WebGL 1 and low-memory devices use the lightest tier. PDF captures are sized per tier.
- **Older browsers.** The build is lowered to iOS 13 / Chrome 70 syntax, with polyfills and CSS fallbacks (`dvh`, `clamp`, `aspect-ratio`).
- **Landscape phones** get a side-by-side layout. Content scrolled into view lands below the pinned 3D stage.
- **Clear messages.** When 3D truly cannot run (WebGL switched off), the viewer says why and how to fix it, with Try again and a support code.

Tested on a Netlify draft of the production build:

| Engine | Devices and scenarios |
|---|---|
| WebKit 18.2 (Safari's engine) | iPhone 13, iPhone SE, iPhone 14 Pro Max and SE in landscape, iPad (gen 7), iPad Pro 11 landscape, iPhone with WebGL 1 only |
| Firefox 132 | Android profile |
| Chrome | WebGL 1 only, no WebGL, restorable and permanent context loss |

Every device loaded the 3D, completed the journey (cladding change, add a window, inside and plan views) and recovered from a forced context loss with no console errors. The iPhone price and PDF journey produced the full 8-page pack in 5 seconds. The 795 option checks pass on r162.

## Crash guard, safe mode and diagnostics (13 October 2026)

Reported: Chrome on a Pixel 10 showed the 2D photo fallback.

**Bug found and fixed:** the engine created the WebGL renderer, then ran the rest of its set-up inside the same constructor. A throw after the renderer existed reached the viewer with no engine object, so the context and canvas were never released. The viewer then created another probe context to label the failure, calling a working GPU "switched off" once contexts piled up. Every Try again added more. Reproduced on the live site: 18 retries left 16 orphan canvases and 48 created contexts. Now construction is two-phase and releases the context on failure. A generation token stops overlapping starts from installing two engines. Teardown removes any stray canvas. After 18 retries: 0 orphan canvases, 0 live contexts.

New behaviour:
- **Fallback chain:** full 3D, then safe mode, then the photo.
- **Safe mode:** no shadow maps, environment render targets, sky shader, instanced foliage or MSAA. It is remembered for a week, and a "Try full 3D" link turns it off.
- **Crash guard:** render-loop errors, shader compile/link errors, scene build and update throws, and three context losses in 90 seconds all enter safe mode.
- **Across page loads:** a start killed outright leaves a boot marker, so the next load starts safe. Leaving or hiding the page clears the marker, so a quick reload is not a crash. A kill in safe mode shows the photo, so there is no crash loop.
- **Diagnostics:** failures POST a report to `/api/diag`, stored in the private Blobs store `make-room-diagnostics` under `reports/<date>/<code>-<reason>-<id>`. The report holds the GPU name, device facts, the failing stage, the error and a timeline, with no personal data. The failure card shows the code (e.g. `MR-3D-CRASH-6D4120`) and a "Copy details" button. `?debug3d=1` shows a live panel, and `?safe3d=1|0` forces safe mode or full 3D.
- **Read a device's report:** `netlify blobs:list make-room-diagnostics`, then `netlify blobs:get make-room-diagnostics <key>`.

Verified on a draft of the production build, with a Pixel 10 profile in Chrome and fault injection (`?mr3dfault=`):

| Case | Result |
|---|---|
| Normal | Full 3D |
| init, render and shader faults on the full renderer | Safe mode |
| Fault in every mode | Photo, no leak |
| Previous crash in full mode | Starts in safe mode |
| Previous crash in safe mode | Photo |
| Three context losses | Safe mode |
| No WebGL | "Switched off" message |
| Debug panel | Shown |

The WebKit (iPhone, iPad, WebGL 1) and Firefox Android suites still pass with no console errors.

## Known limits

- Prices come from Make Room's published January 2024 guide; the live tool has no rate card.
- The phone check confirms a valid UK number format and excludes reserved ranges. It does not ring the number or send an SMS.
- No email or CRM delivery is configured; enquiries, requests and PDFs are stored in Netlify Blobs.
- A browser with WebGL disabled entirely (iPhone Lockdown Mode, graphics acceleration off) cannot show 3D. It gets the photo, an explanation and the rest of the designer.
