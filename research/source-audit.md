# Make Room source audit — 11 October 2026

Research read public website markup, stylesheet files, live Salesqueze code and the anonymous showroom APIs. No enquiry, quote checkout, lead form or message was submitted to Make Room.

## Primary sources

- Current page: https://www.makeroomoutside.co.uk/design-your-room/
- Live embedded product: https://configurator.makeroomoutside.co.uk/en-gb/embed/products/69f84cd154cec73b40c157f1
- Anonymous product API: `GET /api-secondary/v3/catalog/product/cpq/documents/69f84cd154cec73b40c157f1?priceList=69fc237886244c4ffb9eade4`
- Anonymous attribute API: `POST /api-secondary/v3/catalog/attribute/cpq/list` with the product's attribute keys. This is a read-only catalogue query.
- Anonymous product calculator: `POST /api-secondary/v3/catalog/cpq/product-lines` with an empty document and selected product. This computes a preview; it does not save a quote.
- Official garden-room product examples: https://www.makeroomoutside.co.uk/products/garden-rooms/
- Official published cost examples: https://www.makeroomoutside.co.uk/news-media/how-much-is-a-garden-room/

## Exact current catalogue

The public API supplied the Garden room and Modular extension models. Both dimensional module menus have 16 sizes: 1.47, 2.1, 2.8, 3.4, 4, 4.6, 5.2, 5.9, 6.5, 7.1, 7.7, 8.3, 9, 9.6, 10.2 and 10.77 metres. A dimension compatibility table filters depth against frontage width. It is not correct to allow any arbitrary combination. Examples: width 4m allows depth up to 8.3m; width 5.2m allows up to 5.9m; width 10.77m allows up to 2.8m. The table is preserved in `src/catalog.js` and `research/catalogue.json`.

Wood choices are Cedar and Thermowood. Garden-room cladding includes Steel (Anthracite or Black), horizontal composite plank/Cedral Lap (21 named C-code finishes), and vertical composite slatted (Midnight, Argent, Silver Birch, Spiced Oak, Natural Oak, Light Oak and Havana). Brick Slip is an extension-only material; steel is garden-room-only. A universal generic Charcoal/Grey/Sand finish palette would not describe the real catalogue. Exact finish keys, product IDs, names and renderer colour values are exported in the cleaned catalogue.

The real configurator supports independent wall choices and openings on all four elevations. A simpler front-door/side-window preset workflow is valid provided the exact positioning is presented as an illustrative preference to be confirmed. Verified doorway dimensions: single glazed 910×2100mm; French 1150 or 1680×2100mm; French with sidelights 2300×2100mm; two-panel sliders 1680, 2300 or 2830×2100mm; four-panel sliders 2830 or 3450×2100mm; three-panel bifold 3000 or 3450×2100mm; four-panel bifold traffic door 3450×2100mm. Aluminium and uPVC records exist for the non-bifold styles. The `3-pane-bifolding-door-2.83-alu` product key is misleading: its authoritative width property is 3000mm.

Flooring product records match Oak, Walnut, Light Grey and Dark Grey. The three electrical package summaries are preserved exactly in substance: Standard has 4 downlights, 2 white double sockets, 2G switch, 2 external up/down lights and a 1kW heater; Upgrade has 6 downlights, 4 sockets, 3G switch, 2 up/down lights, 2 external downlights and a 2kW heater; Premium has 8 downlights, 6 sockets, 3G switch, 4 up/down lights, 4 external downlights and a 2kW heater. Mains connection is a separate option.

Overhang projection runs 300–600mm on each elevation; decking projection runs 600–5000mm. Decking colours are Oak, Brown, Light Grey, Dark Grey and Black. The simplified prototype uses optional side selections at standard preview projections; no unverified projection price is charged.

## Pricing conclusion

The current showroom expressly uses `priceDisplayMode: hide`; the public calculator returned `inquiryPrice: true`, `_withoutPrice: true`, and null monetary fields. There is no anonymous numerical catalogue rate card to recreate exactly. The company product page publishes a garden-office range starting price of £9,980 including VAT, installation and delivery. Its cost guide was published on 9 January 2024 (despite the current search title mentioning 2026) and publishes area examples and a bi-fold upgrade starting allowance of £3,500. These are illustrations, not a price matrix tied to every selected option.

The new server uses those published size examples only within their 7.5–24m² range and clearly labels interpolation as a planning estimate. Below 7.5m² it shows the published range entry price and explicitly says it is not a price for the particular design. Above 24m² and for extensions it requests specialist pricing. Cladding, glazing, electrical choices, decking, overhangs and site work show “Priced by specialist”; no option prices are invented. Numeric estimate calculations stay server-side and are returned only after validated details are durably saved. An environment override `MAKE_ROOM_PRICING_MODE=quote-only` disables all automatic numeric estimates.

## Brand assets

Official CSS uses Almarena Light for body, Almarena Display Light for headings, and Almarena Bold for emphasis. Primary green is #526F41; secondary green #637451; cream #BAB4A3; pale cream #E9E6E0; body grey #656565; burgundy #800020. Downloaded assets live in `public/assets`: brand logo, four WOFF2 font files and the brand's actual insulated office pod photograph. The photograph is also compressed as `real-room.webp`.

## Prototype caveats

The exact official price needs a supplied tariff or a Make Room specialist review. The illustrative room preview does not replace construction drawings. The prototype's storage captures enquiries in private Netlify Blobs; notification or CRM routing needs an explicitly configured destination. Existing public source downloads are kept as research evidence and are not required by the deployed app.
