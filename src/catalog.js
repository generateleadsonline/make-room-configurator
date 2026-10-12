// Make Room's configurator catalogue, taken from the live Salesqueze product
// (69f84cd154cec73b40c157f1) on 11-12 October 2026. See research/source-audit.md
// and research/live-2026-10-12/inventory.md. Keep ids stable: they live in
// shared design links and saved enquiries.

export const SIZES = [1.47, 2.1, 2.8, 3.4, 4, 4.6, 5.2, 5.9, 6.5, 7.1, 7.7, 8.3, 9, 9.6, 10.2, 10.77];
export const WIDTHS = SIZES;
export const DEPTHS = SIZES;
export const HEIGHT = 2.5;
export const EDGE_GAP = 0.1; // "A 100 mm gap is automatically set between wall elements and the edges"
export const PLANNING_AREA = 30; // "Planning permission will be required if over 30 sqm."

// Width -> lengths the live dimension table allows.
export const DEPTH_COMPATIBILITY = {
  1.47: SIZES,
  2.1: SIZES,
  2.8: SIZES,
  3.4: [1.47, 2.1, 2.8, 3.4, 4, 4.6, 5.2, 5.9, 6.5, 7.1, 7.7, 8.3, 9, 9.6],
  4: [1.47, 2.1, 2.8, 3.4, 4, 4.6, 5.2, 5.9, 6.5, 7.1, 7.7, 8.3],
  4.6: [1.47, 2.1, 2.8, 3.4, 4, 4.6, 5.2, 5.9, 6.5, 7.1],
  5.2: [1.47, 2.1, 2.8, 3.4, 4, 4.6, 5.2, 5.9],
  5.9: [1.47, 2.1, 2.8, 3.4, 4, 4.6, 5.2],
  6.5: [1.47, 2.1, 2.8, 3.4, 4, 4.6],
  7.1: [1.47, 2.1, 2.8, 3.4, 4, 4.6],
  7.7: [1.47, 2.1, 2.8, 3.4, 4],
  8.3: [1.47, 2.1, 2.8, 3.4, 4],
  9: [1.47, 2.1, 2.8, 3.4],
  9.6: [1.47, 2.1, 2.8, 3.4],
  10.2: [1.47, 2.1, 2.8],
  10.77: [1.47, 2.1, 2.8],
};
export function allowedDepths(width) {
  return DEPTH_COMPATIBILITY[String(Number(width))] || SIZES;
}

export const TYPES = [
  {
    id: "garden",
    label: "Garden room",
    detail: "A standalone room in your garden",
  },
  {
    id: "extension",
    label: "Modular extension",
    detail: "Joins your home, with brick slip available",
  },
];

export const USES = [
  { id: "office", label: "Work & focus", detail: "Your commute, across the garden" },
  { id: "gym", label: "Move & recharge", detail: "A gym or wellness space" },
  { id: "studio", label: "Create & escape", detail: "A studio, a snug, your own space" },
  { id: "multi", label: "A little of everything", detail: "A flexible room for family life" },
];

export const POPULAR_SIZES = [
  { width: 2.8, depth: 2.1, label: "Compact studio" },
  { width: 4, depth: 2.8, label: "Garden office" },
  { width: 4.6, depth: 3.4, label: "Office & lounge" },
  { width: 5.9, depth: 4, label: "Family room" },
];

export const WALLS = ["front", "back", "left", "right"];
// A modular extension's back wall is the house wall: no openings, overhang or
// decking there, and one cladding choice for the whole building.
export const wallsFor = (type) => (type === "extension" ? ["front", "left", "right"] : WALLS);
export const perWallCladding = (type) => type !== "extension";
export const WALL_LABELS = { front: "Front", back: "Back", left: "Left", right: "Right" };

// Swatch photographs are Make Room's own catalogue thumbnails (public/swatches);
// the 3D renderer combines them with its PBR maps (public/textures).
const sw = (name) => `/swatches/${name}.jpg`;
export const CLADDING = [
  {
    id: "wood",
    label: "Wood",
    detail: "Natural timber boards, laid vertically",
    types: ["garden", "extension"],
    finishes: [
      { id: "cedar", label: "Cedar", hex: "#E58F3D", swatch: sw("cedar"), code: "CEDAR", productId: "69f84cd154cec73b40c15a00", note: "Western red cedar. Warm, naturally durable." },
      { id: "thermowood", label: "Thermowood", hex: "#FFB247", swatch: sw("thermowood"), code: "LARCH", productId: "69f84cd154cec73b40c159f9", note: "Heat-treated timber. Stable and long-lasting." },
    ],
  },
  {
    id: "steel",
    label: "Steel",
    detail: "Profiled steel sheet, crisp and contemporary",
    types: ["garden"],
    finishes: [
      { id: "steel-anthracite", label: "Anthracite", hex: "#22272B", swatch: sw("steel-anthracite"), code: "STEEL-ANTHRACITE", productId: "69f88d596463fbfa551e0f20" },
      { id: "steel-black", label: "Black", hex: "#0A0A0A", swatch: sw("steel-black"), code: "STEEL-BLACK", productId: "69f88d366463fbfa551e0f1f" },
    ],
  },
  {
    id: "plank",
    label: "Composite Plank",
    detail: "Cedral Lap fibre cement boards, laid horizontally",
    types: ["garden", "extension"],
    finishes: [
      ["c74", "Basalt Grey C74", "#626365", "69f8787f6463fbfa551e0e8a"],
      ["c50", "Black C50", "#1E1A19", "69f8787f6463fbfa551e0e8b"],
      ["c72", "Brick Red C72", "#955440", "69f8787f6463fbfa551e0e8c"],
      ["c07", "Chalk White C07", "#F4ECD7", "69f8787f6463fbfa551e0e8d"],
      ["c03", "Clay Brown C03", "#AE9C84", "69f8787f6463fbfa551e0e8e"],
      ["c78", "Cocoa Brown C78", "#785744", "69f8787f6463fbfa551e0e8f"],
      ["c75", "Metal Green C75", "#4D5353", "69f8787f6463fbfa551e0e90"],
      ["c73", "Ocean Blue C73", "#71838F", "69f8787f6463fbfa551e0e91"],
      ["c52", "Pearl Grey C52", "#948B82", "69f8787f6463fbfa551e0e92"],
      ["c77", "Pebble Grey C77", "#A9978D", "69f8787f6463fbfa551e0e93"],
      ["c54", "Pewter Grey C54", "#676161", "69f8787f6463fbfa551e0e94"],
      ["c05", "Platinum Grey C05", "#BCB7B1", "69f8787f6463fbfa551e0e95"],
      ["c71", "Sand Yellow C71", "#C79D73", "69f8787f6463fbfa551e0e96"],
      ["c51", "Silver Grey C51", "#E4E3DF", "69f8787f6463fbfa551e0e97"],
      ["c10", "Sky Blue C10", "#93A2A3", "69f8787f6463fbfa551e0e98"],
      ["c18", "Slate Grey C18", "#555861", "69f8787f6463fbfa551e0e99"],
      ["c15", "Steel Grey C15", "#777A83", "69f8787f6463fbfa551e0e9a"],
      ["c76", "Tea Green C76", "#B9B6A3", "69f8787f6463fbfa551e0e9b"],
      ["c02", "Vanilla White C02", "#E8D5B5", "69f8787f6463fbfa551e0e9c"],
      ["c21", "Walnut Brown C21", "#4A382E", "69f8787f6463fbfa551e0e9d"],
      ["c01", "White C01", "#F8F8F6", "69f8787f6463fbfa551e0e9e"],
    ].map(([code, label, hex, productId]) => ({
      id: `plank-${code}`,
      label,
      hex,
      swatch: sw(`plank-${code}`),
      code: `CEDRAL-LAP-${code.toUpperCase()}`,
      productId,
    })),
  },
  {
    id: "slatted",
    label: "Composite Slatted",
    detail: "Vertical composite slats with deep shadow lines",
    types: ["garden", "extension"],
    finishes: [
      ["midnight", "Midnight", "#292927", "69f883776463fbfa551e0ee2"],
      ["argent", "Argent", "#655E5E", "69f883776463fbfa551e0ee4"],
      ["silver-birch", "Silver Birch", "#A49D8C", "69f883776463fbfa551e0ee6"],
      ["spiced-oak", "Spiced Oak", "#6D543E", "69f883776463fbfa551e0ee8"],
      ["natural-oak", "Natural Oak", "#C4AD86", "69f883776463fbfa551e0eea"],
      ["light-oak", "Light Oak", "#EAE5D7", "69f883776463fbfa551e0eec"],
      ["havana", "Havana", "#4F4233", "69f883776463fbfa551e0eee"],
    ].map(([key, label, hex, productId]) => ({
      id: `slatted-${key}`,
      label,
      hex,
      swatch: sw(`slatted-${key}`),
      code: `${key.replace("-", "").toUpperCase()}-VERTICAL-SLATTED`,
      productId,
    })),
  },
  {
    id: "brick",
    label: "Brick Slip",
    detail: "Real brick slips to match your home",
    types: ["extension"],
    finishes: [
      { id: "brick-brickdale", label: "Brickdale Blend", hex: "#9a5a3f", swatch: sw("brick-brickdale"), code: "BRICK-BIRKDALE", productId: "6a02e2366e2fd2a3df9ed1b9" },
      { id: "brick-keswick", label: "Keswick Blend", hex: "#b0583a", swatch: sw("brick-keswick"), code: "BRICK-KESWICK", productId: "6a02e3626e2fd2a3df9ed1ba" },
      { id: "brick-kingston", label: "Kingston Mild Stock", hex: "#c9a464", swatch: sw("brick-kingston"), code: "BRICK-KINGSTON-MILD", productId: "6a02e3666e2fd2a3df9ed1bb" },
    ],
  },
];
export const FINISHES = CLADDING.flatMap((m) => m.finishes.map((f) => ({ ...f, material: m.id })));
export const finishById = (id) => FINISHES.find((f) => f.id === id);
export const materialById = (id) => CLADDING.find((m) => m.id === id);
export const materialsFor = (type) => CLADDING.filter((m) => m.types.includes(type));

// Doors and windows. Width/height are the catalogue sizes in metres. Glazed
// heights line up: doors 2.1m, tall windows sit 0.1m off the floor, short ones
// share the door head line.
export const OPENINGS = [
  { id: "single-door", kind: "door", family: "single", label: "Single Door", width: 0.91, height: 2.1, panels: 1, materials: ["alu", "upvc"], productKeys: { alu: "single-door-alu", upvc: "single-door-upvc" }, detail: "Fully glazed single door" },
  { id: "french-door", kind: "door", family: "french", label: "French Door", width: 1.15, height: 2.1, panels: 2, materials: ["alu", "upvc"], productKeys: { alu: "french-door-alu", upvc: "french-door-upvc" }, detail: "A pair of glazed doors opening outwards" },
  { id: "french-door-large", kind: "door", family: "french", label: "French Door Large", width: 1.68, height: 2.1, panels: 2, materials: ["alu", "upvc"], productKeys: { alu: "french-door-large-alu", upvc: "french-door-large-upvc" }, detail: "Wider French doors for more light" },
  { id: "french-sidelights", kind: "door", family: "french-sidelights", label: "French Door with Sidelights", width: 2.3, height: 2.1, panels: 4, materials: ["alu", "upvc"], productKeys: { alu: "french-door-sidelights-alu", upvc: "french-door-sidelights-upvc" }, detail: "French doors framed by two fixed glazed panels" },
  { id: "slider-2-small", kind: "door", family: "slider", label: "2 Panel Small Sliding", width: 1.68, height: 2.1, panels: 2, materials: ["alu", "upvc"], productKeys: { alu: "2-pane-slider-1.68-alu", upvc: "2-pane-slider-1.68-upvc" }, detail: "One sliding and one fixed panel" },
  { id: "slider-2-mid", kind: "door", family: "slider", label: "2 Panel Mid Sliding", width: 2.3, height: 2.1, panels: 2, materials: ["alu", "upvc"], productKeys: { alu: "2-pane-slider-2.3-alu", upvc: "2-pane-slider-2.3-upvc" }, detail: "Slim sightlines, big garden views" },
  { id: "slider-2-large", kind: "door", family: "slider", label: "2 Panel Large Sliding", width: 2.83, height: 2.1, panels: 2, materials: ["alu", "upvc"], productKeys: { alu: "2-pane-slider-2.83-alu", upvc: "2-pane-slider-2.83-upvc" }, detail: "Large glass panels that glide open" },
  { id: "slider-4-mid", kind: "door", family: "slider", label: "4 Panel Mid Sliding", width: 2.83, height: 2.1, panels: 4, materials: ["alu", "upvc"], productKeys: { alu: "4-pane-slider-2.83-alu", upvc: "4-pane-slider-2.83-upvc" }, detail: "Centre panels slide apart" },
  { id: "slider-4-large", kind: "door", family: "slider", label: "4 Panel Large Sliding", width: 3.45, height: 2.1, panels: 4, materials: ["alu", "upvc"], productKeys: { alu: "4-pane-slider-3.45-alu", upvc: "4-pane-slider-3.45-upvc" }, detail: "A wall of glass for wider rooms" },
  { id: "bifold-3", kind: "door", family: "bifold", label: "3 Panel Bifold", width: 2.83, height: 2.1, panels: 3, materials: ["alu"], productKeys: { alu: "3-pane-bifolding-door-2.83-alu" }, detail: "Folds right back to open the room to the garden" },
  { id: "bifold-3-large", kind: "door", family: "bifold", label: "3 Panel Large Bifold", width: 3.45, height: 2.1, panels: 3, materials: ["alu"], productKeys: { alu: "3-pane-bifolding-door-3.45-alu" }, detail: "Wide bifolds for a big opening" },
  { id: "bifold-4", kind: "door", family: "bifold", label: "4 Panel Bifold Traffic Door", width: 3.45, height: 2.1, panels: 4, materials: ["alu"], productKeys: { alu: "4-pane-bifolding-door-3.45-alu" }, detail: "Four panels with an everyday traffic door" },
  { id: "fixed-450x1000", kind: "window", family: "fixed", label: "Fixed Light Window", width: 0.45, height: 1.0, materials: ["alu", "upvc"], productKeys: { alu: "W2-fixed-light-alu-0.45x1", upvc: "W2-fixed-light-upvc-0.45x1" }, detail: "450 × 1000mm, non-opening" },
  { id: "fixed-900x1000", kind: "window", family: "fixed", label: "Fixed Light Window", width: 0.9, height: 1.0, materials: ["alu", "upvc"], productKeys: { alu: "W4-fixed-light-alu-0.9x1", upvc: "W4-fixed-light-upvc-0.9x1" }, detail: "900 × 1000mm, non-opening" },
  { id: "fixed-450x2000", kind: "window", family: "fixed", label: "Fixed Light Window", width: 0.45, height: 2.0, materials: ["alu", "upvc"], productKeys: { alu: "W1-fixed-light-alu-0.45x2", upvc: "W1-fixed-light-upvc-0.45x2" }, detail: "450 × 2000mm, floor-to-ceiling" },
  { id: "fixed-900x2000", kind: "window", family: "fixed", label: "Fixed Light Window", width: 0.9, height: 2.0, materials: ["alu", "upvc"], productKeys: { alu: "W3-fixed-light-alu-0.9x2", upvc: "W3-fixed-light-upvc-0.9x2" }, detail: "900 × 2000mm, floor-to-ceiling" },
  { id: "tov100-450x1000", kind: "window", family: "tov100", label: "100% TOV Window", width: 0.45, height: 1.0, materials: ["alu", "upvc"], productKeys: { alu: "W2-tov-alu-0.45x1", upvc: "W2-tov-upvc-0.45x1" }, detail: "450 × 1000mm, top-opening vent" },
  { id: "tov100-900x1000", kind: "window", family: "tov100", label: "100% TOV Window", width: 0.9, height: 1.0, materials: ["alu", "upvc"], productKeys: { alu: "W4-tov-alu-0.9x1", upvc: "W4-tov-upvc-0.9x1" }, detail: "900 × 1000mm, top-opening vent" },
  { id: "tov100-1000x450", kind: "window", family: "tov100", label: "100% TOV Window", width: 1.0, height: 0.45, materials: ["alu", "upvc"], productKeys: { alu: "W2-tov-alu-1x0.45", upvc: "W2-tov-upvc-1x0.45" }, detail: "1000 × 450mm, high-level vent" },
  { id: "tov50-450x2000", kind: "window", family: "tov50", label: "50% TOV Window", width: 0.45, height: 2.0, materials: ["alu", "upvc"], productKeys: { alu: "W1-tov-alu-0.45x2", upvc: "W1-tov-upvc-0.45x2" }, detail: "450 × 2000mm, opening top half" },
  { id: "tov50-900x2000", kind: "window", family: "tov50", label: "50% TOV Window", width: 0.9, height: 2.0, materials: ["alu", "upvc"], productKeys: { alu: "W3-tov-alu-0.9x2", upvc: "W3-tov-upvc-0.9x2" }, detail: "900 × 2000mm, opening top half" },
];
export const openingById = (id) => OPENINGS.find((o) => o.id === id);
export const OPENING_MATERIALS = { alu: "Aluminium", upvc: "uPVC" };
// The live tool offers Black (default) or Anthracite frames once an opening is placed.
export const FRAME_COLOURS = [
  { id: "black", label: "Black", hex: "#0A0A0A" },
  { id: "anthracite", label: "Anthracite", hex: "#17202B" },
];
export const DOOR_HEAD = 2.1;
// Bottom of the glazed opening above the internal floor.
export function sillHeight(o) {
  if (o.kind === "door") return 0;
  return o.height >= 1.9 ? 0.1 : DOOR_HEAD - o.height;
}

export const FLOORS = [
  { id: "oak", label: "Oak", hex: "#C59F6E", swatch: sw("floor-oak"), productId: "69f890ef4188b28a1725b6ac" },
  { id: "walnut", label: "Walnut", hex: "#553B2C", swatch: sw("floor-walnut"), productId: "69f88ef66463fbfa551e0f2a" },
  { id: "light-grey", label: "Light grey", hex: "#B4B4B4", swatch: sw("floor-light-grey") },
  { id: "dark-grey", label: "Dark grey", hex: "#2B2C32", swatch: sw("floor-dark-grey") },
];

export const DECKING_COLOURS = [
  { id: "oak", label: "Oak", hex: "#B58F50", swatch: sw("deck-oak"), code: "OAK-HORIZONTAL-COMPOSITE" },
  { id: "brown", label: "Brown", hex: "#492D12", swatch: sw("deck-brown"), code: "CHOCOLATE-HORIZONTAL-COMPOSITE" },
  { id: "light-grey", label: "Light Grey", hex: "#B6B3A0", swatch: sw("deck-light-grey"), code: "ASH-HORIZONTAL-COMPOSITE" },
  { id: "dark-grey", label: "Dark Grey", hex: "#555653", swatch: sw("deck-dark-grey"), code: "FEATHER-GREY-HORIZONTAL-COMPOSITE" },
  { id: "black", label: "Black", hex: "#0A0A0A", swatch: sw("deck-black"), code: "CHARCOAL-HORIZONTAL-COMPOSITE" },
];
// Live tool: number inputs, overhang 300-600mm (default 300), decking
// 600-5000mm (default 600). A front overhang carries the side walls forward
// into a recessed porch, as on Make Room's builds.
export const OVERHANG_RANGE = { min: 0.3, max: 0.6, step: 0.05, initial: 0.3 };
export const DECKING_RANGE = { min: 0.6, max: 5, step: 0.1, initial: 0.6 };

export const ELECTRICAL = [
  {
    id: "standard",
    label: "Standard package",
    short: "Standard",
    downlights: 4,
    sockets: 2,
    switchGang: 2,
    upDown: 2,
    soffitLights: 0,
    heaterKw: 1,
    items: ["4x downlights", "2x double sockets - white", "1x 2G light switch", "2x external up/down lights", "1x 1kw panel heater - white"],
  },
  {
    id: "upgrade",
    label: "Upgrade package",
    short: "Upgrade",
    downlights: 6,
    sockets: 4,
    switchGang: 3,
    upDown: 2,
    soffitLights: 2,
    heaterKw: 2,
    items: ["6x downlights", "4x double sockets - white", "1x 3G light switch - white", "2x external up/down lights", "1x 2kw panel heater - white", "2x external downlights"],
  },
  {
    id: "premium",
    label: "Premium package",
    short: "Premium",
    downlights: 8,
    sockets: 6,
    switchGang: 3,
    upDown: 4,
    soffitLights: 4,
    heaterKw: 2,
    items: ["8x downlights", "6x double sockets - white", "1x 3G light switch", "1x 2kw panel heater - white", "4x external up/down lights", "4x external downlights"],
  },
];
export const NO_ELECTRICS = { id: "none", label: "No electrical package", short: "None", downlights: 0, sockets: 0, switchGang: 0, upDown: 0, soffitLights: 0, heaterKw: 0, items: [] };
export const electricalById = (id) => ELECTRICAL.find((e) => e.id === id) || NO_ELECTRICS;

export const wallsOf = (finish) => Object.fromEntries(WALLS.map((w) => [w, finish]));
// The live tool opens a garden room in Cedar and an extension in Brickdale Blend.
export const TYPE_DEFAULT_FINISH = { garden: "cedar", extension: "brick-brickdale" };
export const DEFAULT_CONFIG = {
  v: 2,
  type: "garden",
  use: "office",
  width: 4,
  depth: 2.8,
  cladding: wallsOf("cedar"),
  // Modelled on Make Room's own builds (research/website-2026-10-12, photo 01):
  // bifolds under a front porch overhang, a side vent window, a grey deck.
  openings: [
    { id: "o1", product: "bifold-3", material: "alu", colour: "anthracite", wall: "front", offset: 2 },
    { id: "o2", product: "tov100-900x1000", material: "alu", colour: "anthracite", wall: "right", offset: 1.4 },
  ],
  overhang: { front: 0.45, back: 0, left: 0, right: 0 },
  decking: { front: 1.2, back: 0, left: 0, right: 0 },
  deckingColour: "light-grey",
  floor: "oak",
  electrical: "standard",
};

export const nearest = (arr, n) => arr.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
const round3 = (n) => Math.round(n * 1000) / 1000;
export const wallLength = (c, wall) => (wall === "front" || wall === "back" ? c.width : c.depth);

// Slots taken on a wall, sorted by position. Each opening keeps the 100mm
// edge gap and the same gap from its neighbours.
function spans(openings, wall, skipId) {
  return openings
    .filter((o) => o.wall === wall && o.id !== skipId)
    .map((o) => {
      const p = openingById(o.product);
      return { start: o.offset - p.width / 2, end: o.offset + p.width / 2 };
    })
    .sort((a, b) => a.start - b.start);
}
export function fitsAt(c, wall, product, offset, skipId) {
  const p = openingById(product);
  if (!p) return false;
  const half = p.width / 2,
    len = wallLength(c, wall);
  if (offset - half < EDGE_GAP - 1e-6 || offset + half > len - EDGE_GAP + 1e-6) return false;
  return spans(c.openings || [], wall, skipId).every(
    (s) => offset + half <= s.start - EDGE_GAP + 1e-6 || offset - half >= s.end + EDGE_GAP - 1e-6,
  );
}
// Nearest valid centre to `preferred`, or null when the wall is full.
export function findSlot(c, wall, product, preferred, skipId) {
  const p = openingById(product);
  if (!p) return null;
  const len = wallLength(c, wall),
    half = p.width / 2,
    lo = EDGE_GAP + half,
    hi = len - EDGE_GAP - half;
  if (hi < lo - 1e-6) return null;
  const target = Math.min(hi, Math.max(lo, Number.isFinite(preferred) ? preferred : len / 2));
  const candidates = [target];
  for (const s of spans(c.openings || [], wall, skipId)) candidates.push(s.start - EDGE_GAP - half, s.end + EDGE_GAP + half);
  candidates.push(lo, hi);
  const ok = candidates
    .map(round3)
    .filter((x) => x >= lo - 1e-6 && x <= hi + 1e-6 && fitsAt(c, wall, product, x, skipId))
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  return ok.length ? ok[0] : null;
}
export function fitsWall(c, wall, product) {
  return findSlot(c, wall, product, undefined) !== null;
}
// Adds `product` to a wall that has enough total space but no free gap, by
// sliding the existing openings along (keeping their order). Returns the new
// openings list, or null if the wall is simply too full.
export function makeRoom(c, wall, product, id) {
  const p = openingById(product);
  if (!p) return null;
  const L = wallLength(c, wall);
  const others = (c.openings || []).filter((o) => o.wall === wall).sort((a, b) => a.offset - b.offset);
  const widths = others.reduce((s, o) => s + openingById(o.product).width, 0);
  if (widths + p.width + EDGE_GAP * (others.length + 2) > L + 1e-6) return null;
  let best = null;
  for (const atStart of [false, true]) {
    const fresh = { id, product, wall, offset: atStart ? 0 : L };
    const row = atStart ? [fresh, ...others] : [...others, fresh];
    const pos = row.map((o) => o.offset);
    const w = row.map((o) => openingById(o.product).width);
    // Push right from the left edge, then pull back from the right edge.
    for (let i = 0; i < row.length; i++) pos[i] = Math.max(pos[i], (i ? pos[i - 1] + w[i - 1] / 2 : 0) + EDGE_GAP + w[i] / 2);
    for (let i = row.length - 1; i >= 0; i--) pos[i] = Math.min(pos[i], (i < row.length - 1 ? pos[i + 1] - w[i + 1] / 2 : L) - EDGE_GAP - w[i] / 2);
    const moved = row.reduce((s, o, i) => s + (o === fresh ? 0 : Math.abs(pos[i] - o.offset)), 0);
    if (!best || moved < best.moved) best = { moved, offsets: new Map(row.map((o, i) => [o, round3(pos[i])])) , fresh };
  }
  const list = (c.openings || []).map((o) => (o.wall === wall ? { ...o, offset: best.offsets.get(others.find((x) => x.id === o.id)) } : o));
  return { openings: list, offset: best.offsets.get(best.fresh) };
}

function cleanSides(value, range) {
  const out = {};
  for (const w of WALLS) {
    const n = Number(value?.[w]) || 0;
    out[w] = n <= 0 ? 0 : round3(Math.min(range.max, Math.max(range.min, Math.round(n / range.step) * range.step)));
  }
  return out;
}

// Turns any input (old v1 links, tampered JSON, a size change) into a buildable
// design. Openings that no longer fit are moved along their wall, then dropped.
export function normalizeConfig(input = {}) {
  const src = input && typeof input === "object" ? input : {};
  const legacy = src.v !== 2 && ("doors" in src || "windows" in src || typeof src.cladding === "string");
  const c = { ...DEFAULT_CONFIG };
  c.type = TYPES.some((t) => t.id === src.type) ? src.type : DEFAULT_CONFIG.type;
  c.use = USES.some((u) => u.id === src.use) ? src.use : DEFAULT_CONFIG.use;
  c.width = nearest(WIDTHS, Number(src.width) || DEFAULT_CONFIG.width);
  c.depth = nearest(allowedDepths(c.width), Number(src.depth) || DEFAULT_CONFIG.depth);
  const allowedFinish = (id) => {
    const f = finishById(id);
    return f && materialById(f.material).types.includes(c.type) ? id : null;
  };
  const fallback = TYPE_DEFAULT_FINISH[c.type];
  if (legacy) {
    const map = { cedar: "cedar", thermowood: "thermowood", steel: "steel-anthracite", plank: "plank-c74", slatted: "slatted-midnight" };
    c.cladding = wallsOf(allowedFinish(map[src.cladding]) || fallback);
  } else if (perWallCladding(c.type)) {
    c.cladding = Object.fromEntries(WALLS.map((w) => [w, allowedFinish(src.cladding?.[w]) || fallback]));
  } else {
    c.cladding = wallsOf(allowedFinish(src.cladding?.front) || fallback);
  }
  c.floor = FLOORS.some((f) => f.id === src.floor) ? src.floor : DEFAULT_CONFIG.floor;
  c.electrical = src.electrical === "none" || ELECTRICAL.some((e) => e.id === src.electrical) ? src.electrical : DEFAULT_CONFIG.electrical;
  c.deckingColour = DECKING_COLOURS.some((d) => d.id === src.deckingColour) ? src.deckingColour : DEFAULT_CONFIG.deckingColour;
  if (legacy) {
    const sides = (list, size) => Object.fromEntries(WALLS.map((w) => [w, Array.isArray(list) && list.includes(w) ? size : 0]));
    c.overhang = sides(src.overhang, OVERHANG_RANGE.initial);
    c.decking = sides(src.decking, DECKING_RANGE.initial);
  } else {
    c.overhang = cleanSides(src.overhang, OVERHANG_RANGE);
    c.decking = cleanSides(src.decking, DECKING_RANGE);
  }
  if (c.type === "extension") c.overhang.back = c.decking.back = 0;
  let wanted;
  if (legacy) {
    const door = { french: "french-door-large", sliding: "slider-2-mid", bifold: "bifold-3", single: "single-door" }[src.doors] || "french-door-large";
    wanted = [{ id: "o1", product: door, material: "alu", wall: "front", offset: c.width / 2 }];
    if (src.windows === "left" || src.windows === "both") wanted.push({ id: "o2", product: "tov100-900x1000", material: "alu", wall: "left", offset: c.depth / 2 });
    if (src.windows === "right" || src.windows === "both") wanted.push({ id: "o3", product: "tov100-900x1000", material: "alu", wall: "right", offset: c.depth / 2 });
  } else {
    wanted = Array.isArray(src.openings) ? src.openings.slice(0, 24) : DEFAULT_CONFIG.openings;
  }
  c.openings = [];
  const ids = new Set();
  for (const raw of wanted) {
    const p = openingById(raw?.product);
    if (!p || !wallsFor(c.type).includes(raw.wall)) continue;
    let id = typeof raw.id === "string" && /^[a-z0-9-]{1,16}$/i.test(raw.id) ? raw.id : `o${ids.size + 1}`;
    while (ids.has(id)) id = `${id}x`;
    const material = p.materials.includes(raw.material) ? raw.material : p.materials[0];
    const colour = FRAME_COLOURS.some((f) => f.id === raw.colour) ? raw.colour : "black";
    const offset = findSlot(c, raw.wall, p.id, Number(raw.offset));
    if (offset === null) continue;
    ids.add(id);
    c.openings.push({ id, product: p.id, material, colour, wall: raw.wall, offset });
  }
  return c;
}

export function newOpeningId(c) {
  let n = c.openings.length + 1;
  while (c.openings.some((o) => o.id === `o${n}`)) n++;
  return `o${n}`;
}

export function designCode(c) {
  const json = JSON.stringify(normalizeConfig(c));
  const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json).toString("base64");
  return b64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
export function readDesignCode(code) {
  try {
    if (!code || code.length > 4000) return null;
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString();
    return normalizeConfig(JSON.parse(json));
  } catch {
    return null;
  }
}
// Compact, human-safe design link (?d=...) for QR codes and sharing:
// type~use~width~depth~cladding~openings~overhang~decking~deck~floor~electrics
const ABBR = { type: { garden: "g", extension: "e" }, use: { office: "o", gym: "g", studio: "s", multi: "m" }, material: { alu: "a", upvc: "u" }, colour: { black: "b", anthracite: "a" }, wall: { front: "f", back: "b", left: "l", right: "r" } };
const unabbr = (table, v) => Object.keys(ABBR[table]).find((k) => ABBR[table][k] === v);
export function compactCode(input) {
  const c = normalizeConfig(input);
  const clad = WALLS.map((w) => c.cladding[w]);
  const mm = (n) => Math.round(n * 1000);
  return [
    "2",
    ABBR.type[c.type],
    ABBR.use[c.use],
    mm(c.width),
    mm(c.depth),
    clad.every((f) => f === clad[0]) ? clad[0] : clad.join("."),
    c.openings.map((o) => [o.product, ABBR.material[o.material], ABBR.colour[o.colour], ABBR.wall[o.wall], mm(o.offset)].join(".")).join("_"),
    WALLS.map((w) => mm(c.overhang[w])).join("."),
    WALLS.map((w) => mm(c.decking[w])).join("."),
    c.deckingColour,
    c.floor,
    c.electrical,
  ].join("~");
}
export function readCompactCode(code) {
  try {
    if (!code || code.length > 1500) return null;
    const [v, type, use, width, depth, clad, openings, overhang, decking, deckingColour, floor, electrical] = code.split("~");
    if (v !== "2") return null;
    const parts = clad.split(".");
    const sides = (str) => Object.fromEntries(WALLS.map((w, i) => [w, (Number(str.split(".")[i]) || 0) / 1000]));
    return normalizeConfig({
      v: 2,
      type: unabbr("type", type),
      use: unabbr("use", use),
      width: Number(width) / 1000,
      depth: Number(depth) / 1000,
      cladding: Object.fromEntries(WALLS.map((w, i) => [w, parts[parts.length === 1 ? 0 : i]])),
      openings: openings
        ? openings.split("_").map((o, i) => {
            const [product, m, col, wall, off] = o.split(".");
            return { id: `o${i + 1}`, product, material: unabbr("material", m), colour: unabbr("colour", col), wall: unabbr("wall", wall), offset: Number(off) / 1000 };
          })
        : [],
      overhang: sides(overhang),
      decking: sides(decking),
      deckingColour,
      floor,
      electrical,
    });
  } catch {
    return null;
  }
}
export function readSharedDesign() {
  try {
    const q = new URLSearchParams(location.search);
    return readCompactCode(q.get("d")) || readDesignCode(q.get("design"));
  } catch {
    return null;
  }
}

export const area = (c) => c.width * c.depth;
export const fmtM = (n) => `${Number(n).toFixed(2).replace(/\.?0+$/, "")}m`;
export const fmtMm = (n) => `${Math.round(n * 1000)}mm`;

export function claddingSummary(c) {
  const names = WALLS.map((w) => finishById(c.cladding[w]));
  if (names.every((f) => f.id === names[0].id)) return `${materialById(names[0].material).label}, ${names[0].label} (all walls)`;
  return WALLS.map((w, i) => `${WALL_LABELS[w]}: ${names[i].label}`).join(" · ");
}
export function openingLabel(o) {
  const p = openingById(o.product);
  const colour = FRAME_COLOURS.find((f) => f.id === o.colour)?.label || "Black";
  return `${p.label} ${fmtMm(p.width)} × ${fmtMm(p.height)}, ${OPENING_MATERIALS[o.material]}, ${colour.toLowerCase()} frame`;
}
// Distance from the wall's left end (seen from outside) to the opening, as the
// live tool's "Left Offset (mm)" input shows it.
export const leftOffset = (o) => o.offset - openingById(o.product).width / 2;
export function sidesSummary(sides, unit = "m") {
  const on = WALLS.filter((w) => sides[w] > 0);
  return on.length ? on.map((w) => `${WALL_LABELS[w]} ${sides[w].toFixed(2)}${unit}`).join(", ") : "None";
}

// Opening schedule: D1, D2 for doors, W1, W2 for windows, wall order.
export function schedule(c) {
  const order = (o) => WALLS.indexOf(o.wall) * 100 + o.offset;
  const sorted = [...c.openings].sort((a, b) => order(a) - order(b));
  let d = 0,
    w = 0;
  return sorted.map((o) => {
    const p = openingById(o.product);
    return { ...o, p, tag: p.kind === "door" ? `D${++d}` : `W${++w}` };
  });
}

export function summaryRows(c) {
  const e = electricalById(c.electrical);
  const deck = DECKING_COLOURS.find((d) => d.id === c.deckingColour);
  const hasDeck = WALLS.some((w) => c.decking[w] > 0);
  return [
    ["Building", TYPES.find((t) => t.id === c.type).label],
    ["Use", USES.find((u) => u.id === c.use).label],
    ["External size", `${fmtM(c.width)} wide × ${fmtM(c.depth)} long × ${fmtM(HEIGHT)} high`],
    ["Footprint", `${area(c).toFixed(1)} m²`],
    ["Cladding", claddingSummary(c)],
    ["Doors & windows", c.openings.length ? schedule(c).map((o) => `${o.tag} ${WALL_LABELS[o.wall]}: ${openingLabel(o)}`).join("; ") : "None selected"],
    ["Roof overhang", sidesSummary(c.overhang)],
    ["Decking", hasDeck ? `${sidesSummary(c.decking)} · ${deck.label} composite` : "None"],
    ["Flooring", `${FLOORS.find((f) => f.id === c.floor).label} laminate`],
    ["Electrics", e.id === "none" ? "Not selected" : e.label],
    ["Roof", "Flat EPDM rubber roof with fascia"],
  ];
}
