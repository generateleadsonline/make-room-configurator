# Cross-reference with Make Room's live configurator, 12 October 2026

Source: https://configurator.makeroomoutside.co.uk/en-gb/embed/products/69f84cd154cec73b40c157f1 (Salesqueze 12.183.12), read option by option on 12 October 2026 (research/live-2026-10-12/inventory.md), plus the product API dumps in research/source/. Nothing was submitted to Make Room.

## Options

| Live tool | This configurator | Match |
|---|---|---|
| Type: Garden room, Modular extension | Same two types | Yes |
| Width 1.47–10.77m (16 module sizes) | Same 16 sizes | Yes |
| Length filtered by width (e.g. 4m wide allows up to 8.3m) | Same compatibility table, 135 legal sizes, each built and measured by `tools/qa-options.mjs` | Yes |
| Standard height 2.5m, "Contact our team for custom heights" | Same height and wording | Yes |
| "Planning permission will be required if over 30 sqm" (garden room only); "might be required" (both) | Same notes, shown by type | Yes |
| Garden room cladding per wall: Wood (Cedar, Thermowood), Steel (Anthracite, Black), Composite Plank (21 Cedral Lap colours), Composite Slatted (7 colours) | Same 32 finishes, per wall or all walls | Yes |
| Extension cladding: one choice for the building; Brick Slip (Brickdale Blend default, Keswick Blend, Kingston Mild Stock), Wood, Composite Plank, Composite Slatted; no Steel | Same rules; extension opens in Brickdale Blend like the live tool | Yes |
| Overhang: Front/Back/Left/Right, 300–600mm, default 300 | Same walls, range and default (50mm steps). Extension: no back | Yes |
| Decking: Front/Back/Left/Right, 600–5000mm, default 600; Oak (default), Brown, Light Grey, Dark Grey, Black | Same walls, range, default and colours (100mm steps). Extension: no back | Yes |
| Doors, 2100mm high: Single 910; French 1150; French Large 1680; French w/ Sidelights 2300; 2 Panel Sliding 1680/2300/2830; 4 Panel Sliding 2830/3450; 3 Panel Bifold 2830; 3 Panel Large Bifold 3450; 4 Panel Bifold Traffic Door 3450 | Same 12 doors; aluminium and uPVC where offered, bifolds aluminium only | Yes |
| Windows: Fixed Light 450x2000, 450x1000, 900x2000, 900x1000; 50% TOV 450x2000, 900x2000; 100% TOV 450x1000, 1000x450, 900x1000; aluminium or uPVC | Same 9 windows, both materials | Yes |
| Opening position: "Left Offset (mm)", 100mm gap to edges | Left offset slider in mm, 100mm gap enforced between openings and edges | Yes |
| Frame colour: Black (default) or Anthracite | Same two colours per opening | Yes |
| Laminate flooring: Oak, Walnut, Light grey, Dark grey | Same | Yes |
| Electrical: Standard, Upgrade, Premium (none selected by default) | Same three packages with the live item lists, plus "No package" | Yes |
| Live tool opens as a blank 4 x 2.8m cedar box with no doors | Opens as 4 x 2.8m cedar with a 3 Panel Bifold, side vent window, 450mm porch overhang and 1.2m grey deck, modelled on Make Room's own case study (photo 01, Zoe's room) | Deliberate: a finished starting room |
| Make Room's catalogue also holds a "Timber Single (Secret)" door | Not offered, because the live door picker does not list it | Deliberate |

The live picker lists the 3 Panel Bifold as 2830mm wide while its product record holds 3000mm. This configurator uses 2830mm, as customers see it. Worth confirming with Make Room.

The live renderer's brick image files have swapped names (the "kingston-mild" file shows Brickdale Blend's red-brown colours). This configurator matches each brick to its swatch by colour, so the 3D finish matches what customers pick.

## Prices

The live tool shows no prices at all: its price list ("Within 30 miles radius", GBP) holds no rates, and the calculator returns `inquiryPrice: true` with null amounts. There is therefore no option price to copy or check.

This configurator's estimate uses only figures Make Room publishes:

- Size guide, "How much is a garden room?" (dated 9 January 2024, still live on 12 October 2026): 7.5m² £11,500; 9m² £13,500; 12m² £16,500; 15m² £20,000; 18m² £23,000; 20m² £23,500; 24m² £26,000, interpolated between those points.
- Below 7.5m²: the published range entry price, Garden Office from £9,980.
- Bi-fold doors: the published "from £3,500" allowance, once per bi-fold.
- Above 24m² and all modular extensions: a tailored quote, no figure.
- Every other option reads "Priced by your designer". No option prices were invented.

The default design (11.2m², one bi-fold) shows from £19,200: £15,700 size guide plus £3,500.

Make Room should supply a current rate card before this is used for binding quotes. The published figures are over 21 months old.
