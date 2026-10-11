# Competitor configurator and quote audit

Researched 11 October 2026. Both named live tools were inspected in the browser. Local application sources, research and quote examples supplied additional detail. No competitor enquiries, emails or appointments were submitted. Conclusions about conversion are hypotheses; no funnel analytics or measured uplift was available.

## Confirmed live journeys

| Buyer need | Noah | SMART | Opportunity for Make Room |
|---|---|---|---|
| Start with a convincing room | Attractive fitted Signature room, 20 x 12ft, mixed cladding, bifolds | Fitted Key Studio, 4.4 x 3.1m, office furniture, double doors | A complete, realistic starting design with a clear intended use and editable choices |
| Make decisions | Six garden-room steps; nine for an annexe | Five steps: Room, Size, Style, Glazing, Quote | Four or five focused steps, named next actions, and direct access to the quote gate throughout |
| Set dimensions | Popular sizes, feet/metres, typed input and +/- controls; model resize handles | Use-led presets and width/depth dropdowns | Separate visible width/depth sliders, precise readout, keyboard support and +/- nudge controls |
| Understand space | Exterior, interior, plan, measurements; internal and external area | 3D, front, roof-off interior, floor plan, real range photo | Large credible model, coordinated dimensioned plan, purpose-specific furniture and simple view controls |
| Understand choices | Rich catalogue and per-wall materials/openings/electrics; priced deltas | Curated compatible finishes, entrances, glazing patterns and main window side | Choice cards with real materials and concise practical benefits; progressive disclosure for less common extras |
| Get price and PDF | Five required fields: first name, last name, email, phone, postcode. Current copy also asks the visitor to confirm email before seeing price | Name, email and postcode required; phone/timing/budget/notes optional. Gate promises a six-page guide | Three useful required fields, optional phone, obvious privacy/contact expectations, immediate reveal after accepted lead |
| Return or share | Local resume, design URL, share menu, email design | Local autosave/resume and share URL | Visible saved-state feedback, safe copy-link and local resume without requiring an enquiry |
| Recover | Undo/redo, model fallback/help, preserved contact/design after failure | Undo/redo, photo/plan fallback, short form retains values | Prevent experimental changes becoming costly; clear undo, compatible adjustments, preserved form and retry |

### Noah findings

[Live configurator](https://start.noahgardenrooms.co.uk/configurator/) currently shows five ranges. Range cards state both the from-price and the small size behind it. A new visitor nevertheless starts with a much larger premium 20 x 12ft Signature design. The final total is concealed, although upgrade deltas appear beside technical choices. Make Room should avoid relying on an unrelated starting price as an affordability anchor; the gate should state exactly what it unlocks for the selected room.

Noah's shape/size screen says dimensions are external and offers popular shortcuts, conventional +/- input and dragging model arrows. That is powerful but introduces several ways to perform one action. Simple metre sliders with an instantly visible result should be easier to understand on a phone.

The price step visibly explains VAT, delivery/install within 150 miles of Telford, exclusions, 30-day validity, standard inclusions, guarantee and review link. These are Noah-specific commercial facts and **must not be transferred to Make Room**. Its current price-step text reads: "Enter your details and confirm your email to see your price, with a PDF and a link to come back and edit in your inbox." This differs from older 9 October local research. Five mandatory contact fields plus verification introduce avoidable friction for an initial price request.

Source inspection confirms named Next actions, early Price it shortcuts, optional AR/sun tools, richer placement, share/local recovery and distinctions between saved/email/PDF/pending states. The broad finishing-touch stage and many preview tools add cognitive load. Prior source submits after generating PDF views, which can delay the buyer's enquiry; Make Room should persist the lead first and generate the guide lazily.

### SMART findings

[Live configurator](https://smart-modular-buildings-homepage.netlify.app/configurator/) now gates price and PDF despite earlier local documents describing an ungated variant. Current live copy promises the selected building price and a detailed six-page guide after a short enquiry. The form includes practical scope exclusions, an unticked optional marketing preference, privacy link and no-obligation copy. The lead-gated view does not promise an email was sent.

SMART's purpose-led sizing presets reduce uncertainty, but the dimensions remain dropdowns. The desktop shell is polished and the model remains visible; the relatively small room model and oversized choice headings use substantial space. Make Room can make the room itself more dominant and the options more compact while preserving useful guidance.

Its current source ties quote unlock to the accepted specification. Changing the design relocks the gate even though contact details are retained. Make Room can accept one enquiry, retain an authorised session, save immutable revisions and let the user compare/edit afterwards without repeated form friction. An updated estimate must always refer to the latest accepted design revision.

SMART's catalogue prices, heights, ranges, finishes, warranties and booking calendar are company-specific. None supplies evidence for Make Room's pricing or product scope.

## Quote PDF comparison

The particular newly referenced attachment is not visible in this chat. Downloads is empty and Desktop contains no PDF. Existing local research records a private user-supplied 11-page Noah annexe quote examined on 9 October. That original attachment was not rediscovered, so it cannot be described as newly reviewed here.

Accessible reference examples were inspected instead:

- `/Users/johnparnell/projects/noah-notification-redesign/output/pdf/noah-granny-annexe-proposal.pdf`: nine pages, 1 October sample.
- `/Users/johnparnell/projects/noah-notification-redesign/output/pdf/noah-garden-room-proposal.pdf`: nine pages, 1 October sample.
- `/Users/johnparnell/projects/noah-garden-configurator-qa/jay-feedback-oct10/pdf-qa/live-signature-verified.pdf`: ten pages, 10 October sample; all ten rendered and inspected.
- SMART's current six-page generator and the prior attached-quote audit: `/Users/johnparnell/projects/smart-modular-buildings-homepage/src/configurator-pdf.js` and `docs/noah-pdf-benchmark-2026-10-09.md`.

Noah's current ten-page example has a personalised cover, exterior views, interior/cutaway views, dimensioned elevations, a measured plan with opening tags/schedule, full specification, electrical preferences, itemised price and practical site-survey/order guidance. It has a coherent restrained brand treatment and a saved-design QR. Its first strong CTA is reopening the design; the sales conversation is less visually prominent. Several pages are sparse or highly technical for an early-stage garden-room buyer.

SMART's current six-page guide improves concision: cover and price; configured views; tagged plan; choices explained; investment/inclusions/exclusions; a clear Discovery Call. It uses exact brand typography/logos, embedded assets, vector text/plan/QR and repeated next-step links. It truthfully labels the guide indicative and handles unavailable model snapshots with a real range photograph plus configured diagrams.

### Superior Make Room design pack

Use six to eight purposeful pages rather than maximising page count:

1. **Your room, made for you:** dominant configured exterior, exact selected dimensions, design reference/date, indicative price and one clear Make Room next action.
2. **Picture your everyday:** configured exterior/interior views, intended-use benefits, selected material swatches; furniture and landscaping clearly illustrative.
3. **A plan that fits:** vector dimensioned floor plan, four elevations or two useful paired views, opening tags/schedule. Only source-confirmed dimensions; otherwise explicitly schematic.
4. **Every choice, explained:** complete exact selected specification with practical descriptions and requested extras.
5. **Your investment:** source-based itemised arithmetic, VAT treatment only if verified, included standard scope, separately confirmed extras/site work and estimate assumptions.
6. **From design to your garden:** clear conversation/survey/quotation steps, practical site checklist, real Make Room contact CTA, saved-design link/QR and verified reasons to choose the company.

Do not invent validity, payment terms, lead time, guarantees, planning eligibility or manufacturing measurements. A longer pack is only useful if real product complexity warrants it. The PDF must match the accepted quote snapshot, with useful diagrams when WebGL capture fails. Do not put customer's private contact data in a downloadable share pack by default.

## Other GLO GitHub and Netlify inspiration

These existing projects supply implementation patterns, not Make Room product facts:

- [Penthaus repository](https://github.com/generateleadsonline/penthaus-configurator) / [Netlify tool](https://penthaus-garden-room-configurator.netlify.app/): sliders, five focused stages, private server pricing, opaque quote receipt, immutable quote/PDF artifacts, config-only share links and six-page design pack. This is a stronger gate than merely concealing client-side prices.
- [Warwick repository](https://github.com/generateleadsonline/warwick-garden-configurator): purpose defaults, compatible openings, furnished/unfurnished preview and optional enrichment. Its session-only gate retains access during edits, but public client pricing does not enforce protected price access.
- [Tiger repository](https://github.com/glo-ltd/tiger-garden-room-configurator): one comparison design, use-based sizes, reversible choices, exact source grids and a nine-page guide. Useful patterns: compare two ideas and avoid forcing the enquiry just to save an idea.
- [HAUS Netlify tool](https://haus-garden-configurator.netlify.app): local source uses separate dimensions sliders, server-persisted enquiries, HttpOnly/SameSite session, server price recomputation, private immutable revisions, idempotency, private guide delivery, undo/autosave and safe sharing.
- Local CSL project: independent sliders preserve five supported width/depth pairs and visibly resolve incompatible bifold choices. A slider must respect real catalogue geometry rather than imply every combination has a verified price.

The source/readme review of these projects does not substitute for live QA of every external project.

## Priorities for Make Room

1. **Make the first interaction useful.** Open on a complete model, identify the desired use, show popular dimensions and let sliders react instantly. Use actual company assets/finishes and coherent branding.
2. **Make the gate an exchange of value.** State upfront that a short free enquiry unlocks the selected estimate and personal illustrated pack. Keep the quote shortcut visible, show a compact editable summary, require name/email/postcode and make phone optional.
3. **Reduce uncertainty at decisions.** Explain dimensions, standard scope and extras beside choices. Avoid all-price secrecy becoming scope secrecy. Never describe an unpriced upgrade as included.
4. **Keep the lead-to-result path dependable.** Validate and persist the lead/specification before returning a receipt and price. Generate PDF after success. Failed requests stay locked with preserved choices/contact draft and retry. Do not claim an email or CRM delivery without verifying that separate integration.
5. **Preserve revisits without leaking data.** Autosave design choices, undo/redo and config-only share links. Authorise recalculation through a private session; prevent share links unlocking other people's quotes or exposing contact details.
6. **Design mobile deliberately.** Compact/collapsible preview, clear Step X of Y, minimum 44px targets, a persistent next/reveal action, reachable fields while the keyboard is open and no horizontal overflow at 320px.
7. **Measure qualified outcomes.** Record design start, choices, step, gate intent, validation categories, accepted enquiry, price reveal, PDF, share and return. Keep identity/full postcode out of analytics. Track accepted enquiry per visitor, qualified enquiry/site survey and order value by source/device. Test gate copy, optional phone and defaults against the current funnel; no percentage uplift is assumed.

## Evidence handling

Raw competitor captures and the rendered quote contact sheet under `research/competitor-evidence/` are research intermediates, not Make Room assets. Exclude them from the public GitHub build. Only factual summaries and product sources belong in the public research document.
