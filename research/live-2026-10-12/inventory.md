# Make Room live configurator inventory, 12 October 2026

Source: https://configurator.makeroomoutside.co.uk/en-gb/embed/products/69f84cd154cec73b40c157f1 (Salesqueze app 12.183.12). Read-only session. Nothing was submitted. I opened the enquiry (checkout) page only to read its fields.

## Summary

**The renderer is procedural.** It does not load GLB models for the building, doors or windows. All geometry comes from one 133 KB Three.js script stored in the product's view-3d artifact (`api/garden-room-compiledRender.js`). The only GLBs are an environment tree and, in an unused template, door and window handles. Each texture tile covers **1 m x 1 m on every face** (`worldScaleBoxUVs`). A material's `repeatX`/`repeatY` values then scale that tile.

**Defaults on load.** Both types open at 4 m wide x 2.8 m long x 2.5 m high, with a flat EPDM roof and a black fascia. There is no overhang, no decking, no doors or windows and no electrical package.
- Garden room: Cedar on all four walls. The back-end default sets no flooring.
- Modular extension: Brick Slip in Brickdale Blend, with flooring set to Oak.

There was no confirmation dialog when switching type.

**Garden room and Modular extension compared:**

| | Garden room | Modular extension |
|---|---|---|
| Overhang, decking, openings: wall choices | Front, Back, Left, Right | Front, Left, Right (no Back, because the back is the house wall) |
| Cladding wall control | Per wall (Front/Back/Left/Right) | One choice for the whole building |
| Cladding materials | Wood, Steel, Composite Plank, Composite Slatted | Brick Slip, Wood, Composite Plank, Composite Slatted (no Steel) |
| Default cladding | Cedar | Brick Slip, Brickdale Blend |
| Planning note | "required if over 30 sqm" plus "might be required" | "might be required" only |
| How the back wall renders | Clad like the other walls | Flat off-white (#f8f8f8). No house is modelled. |

**Downloaded textures** are listed below. They are in `textures/`, with the tree model in `models/`. The diffuse maps are neutral greyscale, and the renderer tints them with each finish's hex.

**Contradictions with source-audit.md:**
1. The live door picker shows **3 Panel Bifold as 2830 mm**. The audit says its authoritative width is 3000 mm.
2. The brick names point at the wrong diffuse files:
   - Brickdale Blend uses `brick-35_diffuse_kingston-mild.jpg`.
   - Kingston Mild Stock uses `brick-35_diffuse_birkdale.jpg`.
   - Keswick is correct.
3. The price list has a name: **"Within 30 miles radius"**, in GBP. `_withoutPrice: true` and `inquiryPrice: true` are unchanged.
4. There are **18 window products** (Fixed Light, 50% TOV and 100% TOV). The audit has no window list.
5. The enquiry form wants a postcode plus four required dropdowns. Their options are listed below.

## 1. Textures and models

Every option material is a `MeshStandardMaterial` taken from the attribute's `3d-material-garden-room` property (full rows in `../source/attributes.json`). UVs are in metres: a repeat of 1 x 1 means one tile per metre.

| File (textures/) | Size | Used by | Material params |
|---|---|---|---|
| cladding-wood-cedar-thermowood-diffuse-neutral.jpg (+ .ktx2 512x512 BasisLZ) | 512x512 | Wood: Cedar `#E58F3D`, Thermowood `#FFB247` (cladding and decking-colour lists) | rough 1, metal 0, repeat 1x1, **rotation 90** (6 boards per tile, so about 167 mm boards running vertically on walls), normalScale 1 |
| cladding-wood-cedar-thermowood-normal.jpg / -ao.jpg | 512 | same | normal and AO from `tpl-templates.stage.salesqueze.com` |
| cladding-composite-plank-and-decking-diffuse-neutral.jpg / -normal / -ao | 512 | Composite Plank (Cedral). See the variants table after this one. Also decking colours Oak `#B58F50`, Brown `#492D12`, Light Grey `#B6B3A0`, Dark Grey `#555653`, Black `#0A0A0A` | rough 1, metal 0, repeat **1 x 1.25** (tile 1 m x 0.8 m, about 6 boards, so roughly 133 mm), normalScale 2 |
| cladding-composite-slatted-diffuse-neutral.jpg / -normal / -ao / -roughness | 1024 | Composite Slatted (Veneered MDF set): Midnight `#292927`, Argent `#655E5E`, Silver Birch `#A49D8C`, Spiced Oak `#6D543E`, Natural Oak `#C4AD86`, Light Oak `#EAE5D7`, Havana `#4F4233` | repeat **2.827 x 0.5** (tile about 354 mm x 2 m, 8 light slats with black gaps, roughly 44 mm pitch), normalScale 2. Two variants: rotation 0 (keys `SLATTED-HORIZONTAL-2.5-*`) and rotation 90 (vertical) |
| cladding-steel-normal.jpg / -ao.jpg | 1024 | Steel Anthracite `#22272B`, Black `#0A0A0A` (garden room only) | no diffuse, rough 0.4, metal 0.4, repeat 1x1, rotation 0. 4 vertical ribs per tile, so 250 mm rib spacing |
| cladding-brick-diffuse-kingston-mild-file-used-by-BrickdaleBlend.jpg | 1024 | Brickdale Blend (extension default) | colour #ffffff, rough 2, normalScale 1.5, repeat 1x1. Stretcher bond, red/orange/brown, cream mortar |
| cladding-brick-diffuse-keswick-file-used-by-KeswickBlend.jpg | 1024 | Keswick Blend | same |
| cladding-brick-diffuse-birkdale-file-used-by-KingstonMildStock.jpg | 1024 | Kingston Mild Stock | same |
| cladding-brick-normal.jpg / -roughness.jpg | 1024 | all brick | KTX2 versions exist (`brick-35_normal_inverted.ktx2` and others) in product.json |
| flooring-laminate-diffuse-neutral.jpg / -normal / -roughness | 512 | Laminate: Oak, Walnut, Light grey, Dark grey (`Linoleum` set, tinted per colour) | from the makeroomoutside.salesqueze.com imported-product path |
| flooring-herringbone-unused-*.jpg, flooring-vinyl-unused-basecolor.jpg | 1024 | Hidden flooring-type options (Wood, Vinyl). Not shown in the UI | |
| fascia-structure-beam-normal.jpg (512) / -roughness.jpg (1024) | | Fascia "Same as container construction" | rough 0.5, metal 0.2, repeat 0.5, normalScale 0.1 |
| renderer-default-decking-*.jpg (diffuse/normal/ao/roughness) | 512 | Renderer fallback decking material (`#A48055`), used before a decking colour is set | |
| models/environment-foliage-tree.glb | 217 KB | Background tree | glTF 2 |

Composite Plank variants (all 21 Cedral C-codes in each):
- `CEDRAL-LAP-*`: diffuse, rotation 0 (horizontal lap).
- `CEDRAL-CLICK-WOOD-*`: diffuse, rotation 90.
- `CEDRAL-CLICK-SMOOTH-*`: normal and AO only, no diffuse, rotation 90.

The 21 finishes are:
- Basalt Grey C74 `#626365`
- Black C50 `#1E1A19`
- Brick Red C72 `#955440`
- Chalk White C07 `#F4ECD7`
- Clay Brown C03 `#AE9C84`
- Cocoa Brown C78 `#785744`
- Metal Green C75 `#4D5353`
- Ocean Blue C73 `#71838F`
- Pearl Grey C52 `#948B82`
- Pebble Grey C77 `#A9978D`
- Pewter Grey C54 `#676161`
- Platinum Grey C05 `#BCB7B1`
- Sand Yellow C71 `#C79D73`
- Silver Grey C51 `#E4E3DF`
- Sky Blue C10 `#93A2A3`
- Slate Grey C18 `#555861`
- Steel Grey C15 `#777A83`
- Tea Green C76 `#B9B6A3`
- Vanilla White C02 `#E8D5B5`
- Walnut Brown C21 `#4A382E`
- White C01 `#F8F8F6`

Frame colours (`door-and-window-color-garden-room`): Black `#0A0A0A`, Anthracite `#17202b`, White (no hex). After I added an aluminium door, the UI offered only Black and Anthracite, with Black selected by default.

Interior walls: "Plaster with paint finish" (no texture). The renderer default interior texture is the slatted set. It is not used when plaster is selected.

The ground, sky and other environment come from the app's `/assets/view-3d/dynamic-sky/*` (KTX2 cubemaps, clouds, moon, stars) and `luts/cgc/Look LUTs/Punch.cube`. These are platform assets and were not downloaded.

## 2. Option inventory

**Dimensions.** WIDTH has 16 values, from 1.47 to 10.77 m. LENGTH is filtered by width: at 4 m it shows 1.47–8.3 m. Standard height is fixed at 2.5 m, with the note "Contact our team for custom heights". Custom sizes go through "Don't see the size you need?".

**Overhang.** Click a wall pill (multi-select) to add it. Each selected wall shows "FRONT OVERHANG — Range from 300mm - 600mm", with a number input that defaults to **300**. In the renderer:
- The roof slab extends forward by that projection.
- The side walls extend forward by the same amount (`wallExtendFrontLeft/Right` come from `overhang_projection_front`), so the overhang reads as a recessed porch.
- Each soffit uses the cladding of its wall.

**Decking.** Uses the same wall pills. "FRONT DECKING — Range from 600mm - 5000mm" with a number input defaulting to **600**. Colours are Oak (default), Brown, Light Grey, Dark Grey and Black. The deck is a 100 mm-thick slab, with boards rotated 90° to face outwards and a 50 mm x 5 mm black (`#0A0A0A`) edge trim.

**Exterior cladding.**
- Garden room: a Front/Back/Left/Right segmented control. Default is Wood > Cedar. Material tabs are Wood (Cedar, Thermowood), Steel, Composite Plank and Composite Slatted.
- Extension: one control for the whole building. Brick Slip (Brickdale Blend default, Keswick Blend, Kingston Mild Stock), Wood, Composite Plank and Composite Slatted.
- Orientation is not offered as a separate control. It is fixed by which material key is used (see section 1).

**Windows & doors.** A segmented control picks the wall (extension: Front/Left/Right). The note reads "A 100 mm gap is automatically set between wall elements and the edges of the structure." Clicking Add opens a "Select option" modal (Home > Doors / Windows).

Doors, all 2100 mm high, each in uPVC and Aluminium unless noted:
- Single Door 910 (fully glazed)
- French Door 1150
- French Door Large 1680
- French Door W/ Sidelights 2300
- 2 Panel Small Sliding 1680
- 2 Panel Mid Sliding 2300
- 2 Panel Large Sliding 2830
- 4 Panel Mid Sliding 2830
- 4 Panel Large Sliding 3450
- 3 Panel Bifold 2830 (Aluminium only)
- 3 Panel Large Bifold 3450 (Aluminium only)
- 4 Panel Bifold Traffic Door 3450 (Aluminium only)

Windows (W x H mm), each in uPVC and Aluminium:
- Fixed Light 450x2000, 450x1000, 900x2000, 900x1000
- 50% TOV 450x2000, 900x2000
- 100% TOV 450x1000, 1000x450, 900x1000

Once a door is placed, the wall card shows its name, size and material, a **"Left Offset (mm)"** input defaulting to 100, another "Add" button, and Color (Black or Anthracite for aluminium). Openings are positioned by left offset only. The back end computes overlap and available width for each wall (`available_width_front` = width − 0.2 m).

**Laminate flooring.** Oak, Walnut, Light grey, Dark grey.

**Electrical package.** Standard, Upgrade and Premium. The text is identical to the audit. None is selected by default.

**Hidden attributes** (exist in the back end, not shown in the UI): roof type (flat only), roof material EPDM Rubber, insulation (None), fascia Yes with RAL colours (default RAL7016 Anthracite), soffit, interior walls, heaters, underfloor heating, groundwork, services. Height, width and the fascia height of 216 mm are back-end defaults.

## 3. The 3D look

Everything is built by `api/garden-room-compiledRender.js`, with inputs from `api/view3d-artifact.json` (`elements[0].inputMapping`).

- **Body.** A box with 100 mm walls, a 100 mm floor slab and a flat roof (pitch 0).
- **Roof.** A black slab with a black fascia band (renderer default fascia 216 mm high, 20 mm deep, 10 mm thick, colour const `#0A0A0A`). The slab overhangs the walls slightly all round, by about 50 mm visually. The roof underside and soffit are black (`#22272B` composite-normal material).
- **Base.** A thin black curb/plinth: 100 mm high, 10 mm deep, 5 mm thick, `#0A0A0A`.
- **Corners.** Corner trim (`cornering`) is off. Cladding meets at the corners with no visible trim.
- **Cedar.** Warm orange-brown with vertical boards and a light grain. Thermowood is a brighter, more yellow tone.
- **Brick extension.** Strong multi-tone red-brown stretcher bond with pale mortar. The back (house) wall renders as a flat off-white plane. No host house is modelled.
- **Doors.** Thin black aluminium frames with large clear glazing panes. A French door on the front showed two tall glazed leaves.
- **Interior.** Dollying the camera in passes through the wall. Inside are pale off-white plaster walls, a grey ceiling and a grey-brown laminate floor with board joints.
- **Lighting.** Dynamic sky at about 08:40, sun intensity 3.2, PCF shadows, "Punch" LUT at 0.42, saturation −0.12, brightness +0.12, contrast −0.07, Cineon tone mapping and a vignette. The ground is a pale grey-white plane with soft ground shadows (0.2) and one background tree. Things fade between 30 and 41 m.
- **Camera.** Orbit with dolly. Initial distance 8.7, azimuth −47°, fov 60. Distance is limited to 1–20 m, with no polar limits. A "Top View" (top-down camera) exists in the views list but has no toolbar button.
- **Labels.** White rounded pill labels in bold 10–12 px dark text. They show width at the front base, length at the side base, height on a vertical dimension line, and decking projection (for example "0.6m").
- **Toolbar.** Top left: a sun button opens two sliders (Hours 00:00–24:00 and Degrees 0–360°), then a download (down-arrow) button. Top right: "View in AR" (floor placement, auto scale). I did not test the download button.
- **Send enquiry.** Clicking it re-frames the camera, presumably to capture a render, then routes to `/en-gb/embed/checkout`.

## 4. Enquiry form (`/en-gb/embed/checkout`, not submitted)

- **Summary:** type, Width, Length and Height, plus "Show more".
- **Quote type:** For myself / For my company.
- **Contact person:** First name, Last name, Email, Phone number. None are marked with \*.
- **Company info:** Company name, VAT ID.
- **Location:** "Select from map", Postal code \*.
- **Required dropdowns:**
  - Use \*: Home office, Gym, Relaxation / summerhouse, Guest accommodation, Other.
  - Budget \*: £10,000 – £20,000, £20,000 – £35,000, £35,000+.
  - Install \*: As soon as possible, 3–6 months, 6–12 months, Just exploring for now.
  - Heard \*: Google search, Social media, Friend recommendation, Saw a showroom, Other.
- **Consent \*:** "I agree with general terms & conditions and accept the privacy policy." followed by "By clicking here you indicate that you have read and agree with the Privacy Policy."
- **Button:** "Submit an enquiry", with "Someone from our team will be in contact within 48 hours."

## 5. Prices

No price appears anywhere in the UI. The cached product-lines response has `_withoutPrice: true`, `inquiry: true` and `inquiryPrice: true`, with null cart prices. The price list `69fc237886244c4ffb9eade4` is named "Within 30 miles radius" (GBP) and contains no rates.

## Files saved

- `api/view3d-artifact.json`: the live 3D scene. It covers camera, lighting, effects, toolbar, the 129 input mappings and the geometry script.
- `api/garden-room-compiledRender.js`: the procedural building script (walls, roof, fascia, soffit, decking, curb, wall-element holes, dimension labels).
- `api/scene-config.json`: the older "tpl-templates-house v1.4.22" HTML template config (material list includes handle GLBs). It is not the live renderer.
- `api/default-product-lines.json`, `api/product-cpq-doc.json`, `api/price-list.json`: current cached catalogue responses (2026-10-05 cache).
