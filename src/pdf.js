import { jsPDF } from "jspdf";
import qrcode from "qrcode-generator";
import { summaryRows, schedule, compactCode, finishById, materialById, WALLS, WALL_LABELS, FLOORS, DECKING_COLOURS, electricalById, area, fmtM, fmtMm, openingById, OPENING_MATERIALS, FRAME_COLOURS, HEIGHT, TYPES, USES } from "./catalog.js";
import { CONTACT, SHOW_VILLAGE, PROCESS, USPS } from "./content.js";

// The personal design pack: A4 landscape, Make Room's own type and colours,
// the client's 3D renders at full resolution, and a true-scale plan and
// elevations with dimensions drawn as vectors over the renders.

const W = 297,
  H = 210,
  M = 14;
const C = {
  green: [82, 111, 65],
  deep: [47, 67, 39],
  ink: [35, 43, 33],
  body: [79, 87, 75],
  muted: [107, 114, 102],
  cream: [233, 230, 224],
  paper: [251, 250, 247],
  line: [222, 219, 211],
  wash: [238, 242, 233],
  sage: [182, 207, 143],
  white: [255, 255, 255],
};
const DESIGN_ORIGIN = typeof location !== "undefined" ? `${location.origin}/configurator/` : "https://make-room-configurator.netlify.app/configurator/";
const money = (n) => "£" + Math.round(n).toLocaleString("en-GB");
// The brand fonts are a web subset; swap the few characters they lack.
const clean = (s) =>
  String(s ?? "")
    .replace(/×/g, "x")
    .replace(/m²/g, "sq m")
    .replace(/²/g, "2")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/·/g, "|")
    .replace(/…/g, "...")
    .replace(/—/g, "–");

async function fetchBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function imageData(src, { max = 1600, format = "image/jpeg", quality = 0.86, background = "#ffffff" } = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale) || 400;
      c.height = Math.round(img.naturalHeight * scale) || 300;
      const ctx = c.getContext("2d");
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve({ data: c.toDataURL(format, quality), w: c.width, h: c.height });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function buildDesignPack({ quote, config: c, shots = {}, meta = {}, firstName = "" }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  let brand = true;
  try {
    const fonts = await Promise.all(["almarena-light", "almarena-regular", "almarena-bold", "almarena-display-light"].map((f) => fetchBase64(`/pdf-fonts/${f}.ttf`)));
    [
      ["almarena-light.ttf", "Almarena", "light"],
      ["almarena-regular.ttf", "Almarena", "normal"],
      ["almarena-bold.ttf", "Almarena", "bold"],
      ["almarena-display-light.ttf", "AlmarenaDisplay", "normal"],
    ].forEach(([file, family, style], i) => {
      doc.addFileToVFS(file, fonts[i]);
      doc.addFont(file, family, style);
    });
  } catch {
    brand = false;
  }
  const [logo, ...swatchImgs] = await Promise.all([
    imageData("/assets/make-room-logo.svg", { max: 900, format: "image/png", background: null }),
    ...[...new Set(WALLS.map((w) => c.cladding[w]))].map((id) => imageData(`/swatches/${id}.jpg`, { max: 240 })),
  ]);
  const swatch = Object.fromEntries([...new Set(WALLS.map((w) => c.cladding[w]))].map((id, i) => [id, swatchImgs[i]]));
  const extra = await Promise.all([imageData(`/swatches/floor-${c.floor}.jpg`, { max: 240 }), imageData(`/swatches/deck-${c.deckingColour}.jpg`, { max: 240 })]);
  const designUrl = `${DESIGN_ORIGIN}?d=${compactCode(c)}`;
  const date = new Date(quote.createdAt || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const type = TYPES.find((t) => t.id === c.type).label;
  doc.setProperties({ title: `Your Make Room ${type.toLowerCase()} | ${quote.reference}`, subject: "Personal design pack and price", author: "Make Room Outside Living", creator: "Make Room 3D designer" });

  // ---- drawing helpers
  const font = (style = "light", size = 10, colour = C.body, display = false) => {
    if (brand) doc.setFont(display ? "AlmarenaDisplay" : "Almarena", display ? "normal" : style);
    else doc.setFont("helvetica", style === "bold" ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...colour);
  };
  const text = (t, x, y, { size = 10, colour = C.body, style = "light", display = false, max, align, lineHeight = 1.32 } = {}) => {
    font(style, size, colour, display);
    const lines = max ? doc.splitTextToSize(clean(t), max) : [clean(t)];
    doc.text(lines, x, y, { align, lineHeightFactor: lineHeight });
    return y + lines.length * size * 0.3528 * lineHeight;
  };
  const rect = (x, y, w, h, colour, r = 0) => {
    doc.setFillColor(...colour);
    if (r) doc.roundedRect(x, y, w, h, r, r, "F");
    else doc.rect(x, y, w, h, "F");
  };
  const line = (x1, y1, x2, y2, colour = C.line, width = 0.3) => {
    doc.setDrawColor(...colour);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
  };
  const link = (t, x, y, url, opts = {}) => {
    const end = text(t, x, y, { style: "bold", colour: C.green, ...opts });
    font(opts.style || "bold", opts.size || 10);
    doc.link(x - (opts.align === "right" ? doc.getTextWidth(clean(t)) : 0), y - (opts.size || 10) * 0.3, doc.getTextWidth(clean(t)), (opts.size || 10) * 0.45, { url });
    return end;
  };
  // Place a render: cover crops to the frame, contain letterboxes it.
  const shot = (data, x, y, w, h, { fit = "cover", radius = 2, bg = C.cream } = {}) => {
    if (!data) {
      rect(x, y, w, h, bg, radius);
      text("Image unavailable on this device", x + w / 2, y + h / 2, { align: "center", size: 8, colour: C.muted });
      return null;
    }
    const p = doc.getImageProperties(data);
    const s = fit === "cover" ? Math.max(w / p.width, h / p.height) : Math.min(w / p.width, h / p.height);
    const iw = p.width * s,
      ih = p.height * s,
      ix = x + (w - iw) / 2,
      iy = y + (h - ih) / 2;
    doc.saveGraphicsState();
    if (radius) doc.roundedRect(x, y, w, h, radius, radius, null);
    else doc.rect(x, y, w, h, null);
    doc.clip();
    doc.discardPath();
    if (fit === "contain") rect(x, y, w, h, bg);
    doc.addImage(data, "JPEG", ix, iy, iw, ih, undefined, "SLOW");
    doc.restoreGraphicsState();
    return { ix, iy, iw, ih };
  };
  let page = 0;
  const TOTAL = 8;
  const chrome = (title, subtitle) => {
    if (page++) doc.addPage();
    rect(0, 0, W, H, C.paper);
    if (logo) doc.addImage(logo.data, "PNG", M, 9, 20, (20 * logo.h) / logo.w);
    text(title, M + 28, 19, { size: 21, colour: C.ink, display: true });
    if (subtitle) text(subtitle, M + 28, 25.5, { size: 9.5, colour: C.muted });
    text(`${type} | ${fmtM(c.width)} x ${fmtM(c.depth)} | ${quote.reference}`, W - M, 15, { size: 8, colour: C.muted, align: "right" });
    text(date, W - M, 20, { size: 8, colour: C.muted, align: "right" });
    line(M, 31, W - M, 31);
    line(M, H - 12, W - M, H - 12);
    text("MAKE ROOM OUTSIDE LIVING", M, H - 6.5, { size: 7, style: "bold", colour: C.green });
    text(`${CONTACT.phone}  |  ${CONTACT.email}  |  makeroomoutside.co.uk`, W / 2, H - 6.5, { size: 7, colour: C.muted, align: "center" });
    text(`${page} / ${TOTAL}`, W - M, H - 6.5, { size: 7, colour: C.muted, align: "right" });
  };
  const caption = (t, x, y, w) => text(t, x, y, { size: 7.5, colour: C.muted, max: w });

  // ---- 1. Cover
  page = 1;
  rect(0, 0, W, H, C.paper);
  shot(shots.cover || shots.hero, 0, 0, W, 142, { radius: 0 });
  rect(0, 142, W, 68, C.deep);
  if (logo) {
    rect(M, 12, 36, 27, C.white, 2);
    doc.addImage(logo.data, "PNG", M + 4, 14.5, 28, (28 * logo.h) / logo.w);
  }
  text(firstName ? `Designed by ${firstName}` : "Your design", M, 158, { size: 10, colour: C.sage });
  text(`Your Make Room ${type.toLowerCase()}`, M, 171, { size: 28, colour: C.white, display: true });
  text(`${fmtM(c.width)} x ${fmtM(c.depth)} | ${area(c).toFixed(1)} sq m | ${USES.find((u) => u.id === c.use).label}`, M, 181, { size: 11, colour: [231, 239, 224] });
  text(`Reference ${quote.reference}  |  ${date}`, M, 195, { size: 8.5, colour: C.sage });
  text(quote.priceLabel || "Your price", W - M, 160, { size: 9, colour: C.sage, align: "right" });
  text(quote.total ? `${quote.isStartingEstimate ? "from " : ""}${money(quote.total)}` : "Tailored quote", W - M, 176, { size: 30, colour: C.white, display: true, align: "right" });
  text("Including VAT | subject to site survey and final specification", W - M, 184, { size: 8, colour: C.sage, align: "right" });
  link("Reopen and keep designing", W - M, 196, designUrl, { size: 9, colour: C.white, align: "right" });

  // ---- 2. Price
  chrome("Your price", "What this figure covers, and what your designer will confirm with you.");
  rect(M, 38, 132, 54, C.deep, 3);
  text(quote.priceLabel || "Your price", M + 8, 49, { size: 9.5, colour: C.sage });
  text(quote.total ? `${quote.isStartingEstimate ? "from " : ""}${money(quote.total)}` : "Tailored quote", M + 8, 67, { size: 34, colour: C.white, display: true });
  text(quote.priceNote || "", M + 8, 78, { size: 8, colour: [216, 228, 203], max: 116 });
  let y = 100;
  y = text(quote.explanation || "", M, y, { size: 9, colour: C.body, max: 132 }) + 4;
  for (const item of (quote.items || []).slice(0, 12)) {
    const right = item.amount ? money(item.amount) : item.value || "Priced by your designer";
    const end = text(item.label, M, y, { size: 8.5, colour: C.ink, max: 92 });
    text(right, M + 132, y, { size: 8.5, colour: item.amount ? C.ink : C.muted, align: "right", style: item.amount ? "bold" : "light" });
    line(M, end - 1.2, M + 132, end - 1.2);
    y = end + 2.6;
  }
  if (quote.sourceUrl) link("Make Room's published price guide", M, Math.min(y + 4, 192), quote.sourceUrl, { size: 8 });
  shot(shots.dusk, 156, 38, W - M - 156, 92);
  caption("Your room at dusk with your chosen lighting. Furniture and garden are illustrative.", 156, 135, W - M - 156);
  text("Not included in this figure", 156, 147, { size: 11, colour: C.ink, style: "bold" });
  let ey = 153;
  for (const ex of (quote.exclusions || []).slice(0, 8)) {
    rect(156, ey - 1.6, 1.2, 1.2, C.green);
    ey = text(ex, 160, ey, { size: 8, colour: C.body, max: W - M - 162 }) + 1.2;
  }

  // ---- 3. Outside
  chrome("Your room, from every side", "High-resolution views of the design you created.");
  shot(shots.hero, M, 37, 176, 108);
  shot(shots.front, M + 180, 37, W - M * 2 - 180, 52);
  shot(shots.rear, M + 180, 93, W - M * 2 - 180, 52);
  shot(shots.top, M, 149, 86, 46);
  for (const [label, y] of [["Front", 86], ["Back", 142]]) {
    font("bold", 7.5);
    const tw = doc.getTextWidth(label) + 5;
    rect(M + 183, y - 4.6, tw, 6, C.white, 3);
    text(label, M + 185.5, y - 0.5, { size: 7.5, style: "bold", colour: C.ink });
  }
  const claddingNames = [...new Set(WALLS.map((w) => finishById(c.cladding[w]).label))].join(", ");
  let ty = 153;
  ty = text("At a glance", M + 92, ty, { size: 12, colour: C.ink, style: "bold" }) + 1;
  const glance = [
    ["Size", `${fmtM(c.width)} wide x ${fmtM(c.depth)} long x ${fmtM(HEIGHT)} high`],
    ["Cladding", claddingNames],
    ["Doors & windows", `${c.openings.length} ${c.openings.length === 1 ? "opening" : "openings"}: ${schedule(c).map((s) => s.tag).join(", ") || "none"}`],
    ["Overhang", WALLS.filter((w) => c.overhang[w] > 0).map((w) => `${WALL_LABELS[w]} ${Math.round(c.overhang[w] * 1000)}mm`).join(", ") || "None"],
    ["Decking", WALLS.filter((w) => c.decking[w] > 0).map((w) => `${WALL_LABELS[w]} ${fmtM(c.decking[w])}`).join(", ") || "None"],
  ];
  for (const [k, v] of glance) {
    text(k, M + 92, ty, { size: 8, colour: C.muted });
    ty = text(v, M + 125, ty, { size: 8.5, colour: C.ink, max: W - M - (M + 125) }) + 1.4;
  }

  // ---- 4. Inside
  chrome("Inside your room", `${FLOORS.find((f) => f.id === c.floor).label} laminate floor, ${electricalById(c.electrical).id === "none" ? "no electrical package selected" : electricalById(c.electrical).label.toLowerCase()}.`);
  shot(shots.inside, M, 37, 132, 100);
  shot(shots.insideOut, M + 137, 37, W - M * 2 - 137, 100);
  caption("Looking into the room", M, 142, 132);
  caption("Looking out to the garden", M + 137, 142, 120);
  const e = electricalById(c.electrical);
  text("Electrics", M, 154, { size: 12, colour: C.ink, style: "bold" });
  let ly = 160;
  for (const it of e.items.length ? e.items : ["No electrical package selected. Your designer can add one at any time."]) {
    rect(M, ly - 1.6, 1.2, 1.2, C.green);
    ly = text(it.trim(), M + 4, ly, { size: 8.5, colour: C.body, max: 110 }) + 0.8;
  }
  text("Flooring", M + 137, 154, { size: 12, colour: C.ink, style: "bold" });
  if (extra[0]) doc.addImage(extra[0].data, "JPEG", M + 137, 158, 16, 16);
  text(`${FLOORS.find((f) => f.id === c.floor).label} laminate`, M + 157, 164, { size: 9, colour: C.ink });
  text("Insulated as standard: 50mm rigid foam to the base and walls, 75mm to the roof.", M + 137, 182, { size: 8.5, colour: C.body, max: W - M * 2 - 137 });
  caption("Furniture is shown for inspiration and is not part of the specification.", M + 137, 192, W - M * 2 - 137);

  // ---- 5. Plan
  chrome("Your floor plan", "Drawn to scale from your design. External dimensions.");
  const planBox = { x: M, y: 36, w: 180, h: 158 };
  const placed = shot(shots.plan, planBox.x, planBox.y, planBox.w, planBox.h, { fit: "contain", bg: [243, 242, 238] });
  if (placed && meta.plan) {
    const P = meta.plan,
      sx = placed.iw / (P.x1 - P.x0),
      sz = placed.ih / (P.z1 - P.z0);
    const toX = (x) => placed.ix + (x - P.x0) * sx,
      toY = (z) => placed.iy + (z - P.z0) * sz;
    const wx0 = toX(-c.width / 2),
      wx1 = toX(c.width / 2),
      wz0 = toY(-c.depth / 2),
      wz1 = toY(c.depth / 2);
    const dimLine = (x1, y1, x2, y2, label, horizontal) => {
      line(x1, y1, x2, y2, C.deep, 0.35);
      const t = 1.6;
      if (horizontal) (line(x1, y1 - t, x1, y1 + t, C.deep, 0.35), line(x2, y2 - t, x2, y2 + t, C.deep, 0.35));
      else (line(x1 - t, y1, x1 + t, y1, C.deep, 0.35), line(x2 - t, y2, x2 + t, y2, C.deep, 0.35));
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2;
      font("bold", 8);
      const tw = doc.getTextWidth(label) + 4;
      rect(mx - tw / 2, my - 2.6, tw, 5.2, C.white, 2.6);
      text(label, mx, my + 1.1, { size: 8, style: "bold", colour: C.deep, align: "center" });
    };
    const top = Math.max(placed.iy + 4, wz0 - 6);
    dimLine(wx0, top, wx1, top, fmtM(c.width), true);
    const left = Math.max(placed.ix + 4, wx0 - 6);
    dimLine(left, wz0, left, wz1, fmtM(c.depth), false);
    // Opening tags just inside each wall.
    const inward = { front: [0, -1], back: [0, 1], left: [1, 0], right: [-1, 0] };
    for (const s of schedule(c)) {
      const L = s.wall === "front" || s.wall === "back" ? c.width : c.depth;
      const u = s.offset;
      const pt = { front: [-c.width / 2 + u, c.depth / 2], back: [c.width / 2 - u, -c.depth / 2], left: [-c.width / 2, -c.depth / 2 + u], right: [c.width / 2, c.depth / 2 - u] }[s.wall];
      void L;
      const [dx, dz] = inward[s.wall];
      const cx = toX(pt[0] + dx * 0.42),
        cy = toY(pt[1] + dz * 0.42);
      rect(cx - 4, cy - 2.6, 8, 5.2, C.deep, 2.6);
      text(s.tag, cx, cy + 1.1, { size: 7, style: "bold", colour: C.white, align: "center" });
    }
  }
  text("Openings", 202, 42, { size: 12, colour: C.ink, style: "bold" });
  let oy = 49;
  const sched = schedule(c);
  if (!sched.length) oy = text("No doors or windows selected.", 202, oy, { size: 8.5, colour: C.muted });
  for (const s of sched) {
    rect(202, oy - 3.4, 8, 5, C.deep, 2.5);
    text(s.tag, 206, oy + 0.2, { size: 7, style: "bold", colour: C.white, align: "center" });
    oy = text(`${s.p.label}`, 213, oy, { size: 8.5, colour: C.ink, style: "bold", max: W - M - 213 });
    oy = text(`${WALL_LABELS[s.wall]} wall | ${fmtMm(s.p.width)} x ${fmtMm(s.p.height)} | ${OPENING_MATERIALS[s.material]}, ${FRAME_COLOURS.find((f) => f.id === s.colour).label.toLowerCase()} | ${Math.round((s.offset - s.p.width / 2) * 1000)}mm from the left`, 213, oy, { size: 7.5, colour: C.muted, max: W - M - 213 }) + 2.5;
    if (oy > 185) break;
  }
  caption("Walls are seen from outside. Positions are your preference; your designer confirms them at survey.", 202, 194, W - M - 202);

  // ---- 6. Elevations
  chrome("Elevations", "Each wall as seen from the garden, with your doors, windows and cladding.");
  const elevWalls = WALLS.filter((w) => shots[`elev-${w}`]);
  const cell = { w: (W - M * 2 - 8) / 2, h: 74 };
  elevWalls.forEach((wall, i) => {
    const x = M + (i % 2) * (cell.w + 8),
      y0 = 37 + Math.floor(i / 2) * (cell.h + 7);
    const pl = shot(shots[`elev-${wall}`], x, y0, cell.w, cell.h - 7, { fit: "contain", bg: C.white });
    const m = meta.elevations?.[wall];
    text(`${WALL_LABELS[wall]} elevation`, x, y0 + cell.h - 1.5, { size: 9, style: "bold", colour: C.ink });
    text(`${finishById(c.cladding[wall]).label} | ${fmtM(m?.length || 0)} long`, x + cell.w, y0 + cell.h - 1.5, { size: 8, colour: C.muted, align: "right" });
    if (pl && m) {
      const sx = pl.iw / (m.u1 - m.u0),
        sy = pl.ih / (m.v1 - m.v0);
      const toX = (u) => pl.ix + (u - m.u0) * sx,
        toY = (v) => pl.iy + (m.v1 - v) * sy;
      const yy = toY(-0.12);
      line(toX(0), yy, toX(m.length), yy, C.deep, 0.3);
      line(toX(0), yy - 1.2, toX(0), yy + 1.2, C.deep, 0.3);
      line(toX(m.length), yy - 1.2, toX(m.length), yy + 1.2, C.deep, 0.3);
      text(fmtM(m.length), (toX(0) + toX(m.length)) / 2, yy + 3.2, { size: 7, style: "bold", colour: C.deep, align: "center" });
      // Height on the far side, clear of porch wings and decking.
      const xx = toX(m.u1) - 9;
      line(xx, toY(0), xx, toY(HEIGHT), C.deep, 0.3);
      line(xx - 1.2, toY(0), xx + 1.2, toY(0), C.deep, 0.3);
      line(xx - 1.2, toY(HEIGHT), xx + 1.2, toY(HEIGHT), C.deep, 0.3);
      text(fmtM(HEIGHT), xx + 1.6, (toY(0) + toY(HEIGHT)) / 2 + 1, { size: 7, style: "bold", colour: C.deep });
      for (const s of sched.filter((s) => s.wall === wall)) {
        const cx = toX(s.offset),
          cy = toY(0.1 + (s.p.kind === "door" ? 0 : s.p.height >= 1.9 ? 0.1 : 2.1 - s.p.height) + s.p.height + 0.12);
        rect(cx - 3.2, cy - 2.4, 6.4, 4.2, C.deep, 2);
        text(s.tag, cx, cy + 0.6, { size: 6, style: "bold", colour: C.white, align: "center" });
      }
    }
  });

  // ---- 7. Specification
  chrome("Your specification", "Every choice you made, ready for your design conversation.");
  let sy2 = 42;
  for (const [k, v] of summaryRows(c)) {
    text(k, M, sy2, { size: 8.5, colour: C.muted });
    const end = text(v, M + 38, sy2, { size: 9, colour: C.ink, max: 140 });
    line(M, end - 1, M + 178, end - 1);
    sy2 = end + 2.4;
  }
  // Doors and windows with their catalogue images.
  sy2 += 6;
  if (sched.length && sy2 < 150) {
    text("Doors and windows", M, sy2, { size: 12, colour: C.ink, style: "bold" });
    sy2 += 5;
    const thumbs = await Promise.all(sched.map((s) => imageData(`/products/${s.p.productKeys[s.material] || Object.values(s.p.productKeys)[0]}.jpg`, { max: 200 })));
    sched.slice(0, 6).forEach((s, i) => {
      const x = M + (i % 3) * 60,
        y = sy2 + Math.floor(i / 3) * 24;
      if (y > 176) return;
      if (thumbs[i]) doc.addImage(thumbs[i].data, "JPEG", x, y, 18, 18);
      text(`${s.tag}  ${s.p.label}`, x + 21, y + 5, { size: 8.5, colour: C.ink, style: "bold", max: 38 });
      text(`${fmtMm(s.p.width)} x ${fmtMm(s.p.height)} | ${WALL_LABELS[s.wall]}`, x + 21, y + 13, { size: 7.5, colour: C.muted, max: 38 });
    });
  }
  text("Your finishes", 206, 42, { size: 12, colour: C.ink, style: "bold" });
  let fy = 48;
  const finishes = [...new Set(WALLS.map((w) => c.cladding[w]))];
  for (const id of finishes) {
    const f = finishById(id);
    const walls = WALLS.filter((w) => c.cladding[w] === id).map((w) => WALL_LABELS[w]);
    if (swatch[id]) doc.addImage(swatch[id].data, "JPEG", 206, fy, 18, 18);
    text(f.label, 228, fy + 6, { size: 9.5, colour: C.ink, style: "bold" });
    text(`${materialById(f.material).label} | ${walls.length === 4 ? "all walls" : walls.join(", ")}`, 228, fy + 11.5, { size: 8, colour: C.muted, max: W - M - 228 });
    fy += 23;
  }
  if (WALLS.some((w) => c.decking[w] > 0)) {
    if (extra[1]) doc.addImage(extra[1].data, "JPEG", 206, fy, 18, 18);
    text(`${DECKING_COLOURS.find((d) => d.id === c.deckingColour).label} decking`, 228, fy + 6, { size: 9.5, colour: C.ink, style: "bold" });
    text("Composite boards", 228, fy + 11.5, { size: 8, colour: C.muted });
    fy += 23;
  }
  caption("Colours and natural timber vary from screen and print. Ask to see samples at the show village.", 206, Math.min(fy + 4, 190), W - M - 206);

  // ---- 8. Next steps
  chrome("Let's make room", "Five steps from here to your finished room.");
  PROCESS.forEach((p, i) => {
    const x = M + i * ((W - M * 2) / 5);
    rect(x, 40, 9, 9, C.green, 4.5);
    text(String(i + 1), x + 4.5, 46, { size: 9, style: "bold", colour: C.white, align: "center" });
    text(p.title, x, 58, { size: 10.5, colour: C.ink, style: "bold", max: 50 });
    text(p.detail, x, 64, { size: 8.5, colour: C.body, max: 50 });
  });
  rect(M, 88, 178, 96, C.deep, 3);
  text("Visit the Halifax Show Village", M + 8, 102, { size: 20, colour: C.white, display: true });
  text(SHOW_VILLAGE.claim, M + 8, 110, { size: 9, colour: [216, 228, 203], max: 110 });
  text(SHOW_VILLAGE.address.join(", "), M + 8, 122, { size: 9.5, colour: C.white });
  let hy = 131;
  for (const [d, h] of SHOW_VILLAGE.hours) {
    text(d, M + 8, hy, { size: 8.5, colour: C.sage });
    text(h, M + 48, hy, { size: 8.5, colour: C.white });
    hy += 5.5;
  }
  link(`Call ${CONTACT.phone}`, M + 8, 160, CONTACT.phoneHref, { size: 11, colour: C.white });
  link("Get directions", M + 8, 168, SHOW_VILLAGE.directions, { size: 9, colour: C.sage });
  link("Request a callback", M + 50, 168, `${designUrl}&request=callback`, { size: 9, colour: C.sage });
  link(CONTACT.email, M + 8, 176, `mailto:${CONTACT.email}`, { size: 9, colour: C.sage });
  // QR back to the saved design.
  const qr = qrcode(0, "L");
  qr.addData(designUrl);
  qr.make();
  const n = qr.getModuleCount(),
    size = 46,
    unit = size / (n + 8),
    qx = M + 124,
    qy = 112;
  rect(qx, qy, size, size, C.white, 2);
  doc.setFillColor(...C.ink);
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) doc.rect(qx + (col + 4) * unit, qy + (r + 4) * unit, unit + 0.01, unit + 0.01, "F");
  doc.link(qx, qy, size, size, { url: designUrl });
  text("Scan to reopen your design", qx + size / 2, qy + size + 5, { size: 7.5, colour: C.sage, align: "center" });
  text("Why Make Room", 202, 94, { size: 12, colour: C.ink, style: "bold" });
  let uy = 101;
  for (const u of USPS) {
    rect(202, uy - 1.8, 1.4, 1.4, C.green);
    uy = text(u.title, 206, uy, { size: 9, colour: C.ink, style: "bold" });
    uy = text(u.detail, 206, uy, { size: 8, colour: C.body, max: W - M - 206 }) + 2;
  }
  caption("This pack shows your design and a planning price. Your written quotation follows a site survey. Views are illustrations, not construction drawings.", 202, 186, W - M - 202);
  return doc.output("blob");
}
