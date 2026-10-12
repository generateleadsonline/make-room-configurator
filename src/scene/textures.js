import * as THREE from "three";
import { finishById, FLOORS, DECKING_COLOURS } from "../catalog.js";

// Every finish is drawn from Make Room's own catalogue photograph of it
// (public/textures/finish), rebuilt board by board into a seamless, full-height
// tile with a matching relief (normal) map. Geometry UVs are in metres; each
// material's maps repeat once per `tile` metres.

const imageCache = new Map();
const materialCache = new Map();
let anisotropy = 8;
export function setAnisotropy(n) {
  anisotropy = n;
}
export function loadImage(url) {
  if (!imageCache.has(url))
    imageCache.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      }),
    );
  return imageCache.get(url);
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function texture(canvas, { colour = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  return t;
}
// Sobel normal map from a greyscale height canvas (white = proud). Wraps at
// the edges so tiles stay seamless.
function normalFromHeight(height, strength = 2) {
  const w = height.width,
    h = height.height,
    src = height.getContext("2d").getImageData(0, 0, w, h).data,
    out = makeCanvas(w, h),
    ctx = out.getContext("2d"),
    img = ctx.createImageData(w, h),
    d = img.data,
    hv = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hv[i] = src[i * 4] / 255;
  const at = (x, y) => hv[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * strength;
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * strength;
      // Canvas y runs down; texture v runs up, so flip dy for the green channel.
      const nx = -dx,
        ny = dy,
        nz = 1,
        len = Math.hypot(nx, ny, nz),
        i = (y * w + x) * 4;
      d[i] = ((nx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return out;
}
// Adds the photo's own grain as fine relief on top of a structural height map.
function addLuminanceRelief(heightCanvas, colourCanvas, amount = 0.12) {
  const w = heightCanvas.width,
    h = heightCanvas.height,
    hc = heightCanvas.getContext("2d"),
    hd = hc.getImageData(0, 0, w, h),
    cd = colourCanvas.getContext("2d").getImageData(0, 0, w, h).data;
  let mean = 0;
  for (let i = 0; i < cd.length; i += 4) mean += cd[i] * 0.3 + cd[i + 1] * 0.59 + cd[i + 2] * 0.11;
  mean /= cd.length / 4;
  for (let i = 0; i < cd.length; i += 4) {
    const lum = cd[i] * 0.3 + cd[i + 1] * 0.59 + cd[i + 2] * 0.11;
    const v = hd.data[i] + (lum - mean) * amount;
    hd.data[i] = hd.data[i + 1] = hd.data[i + 2] = Math.max(0, Math.min(255, v));
  }
  hc.putImageData(hd, 0, 0);
}
function tone(ctx, x, y, w, h, factor) {
  if (Math.abs(factor - 1) < 0.005) return;
  ctx.save();
  ctx.globalCompositeOperation = factor > 1 ? "screen" : "multiply";
  const v = factor > 1 ? Math.round((factor - 1) * 255) : Math.round(factor * 255);
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Vertical boards (cedar, thermowood): the catalogue photo shows four boards.
function verticalBoards(img, seed, { boards = 6, boardM = 0.1667, heightM = 2.4, srcBoards = 4, w = 512, h = 2048, groove = 3 } = {}) {
  const rnd = seeded(seed),
    colour = makeCanvas(w, h),
    height = makeCanvas(w, h),
    c = colour.getContext("2d"),
    hc = height.getContext("2d"),
    bw = w / boards,
    sw = img.width / srcBoards;
  hc.fillStyle = "#d8d8d8";
  hc.fillRect(0, 0, w, h);
  for (let i = 0; i < boards; i++) {
    const j = Math.floor(rnd() * srcBoards),
      x = Math.round(i * bw),
      nx = Math.round((i + 1) * bw);
    c.save();
    c.beginPath();
    c.rect(x, 0, nx - x, h);
    c.clip();
    const flipX = rnd() > 0.5,
      flipY = rnd() > 0.5;
    c.translate(x + (flipX ? nx - x : 0), flipY ? h : 0);
    c.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    c.drawImage(img, j * sw + 6, 0, sw - 12, img.height, 0, 0, nx - x, h);
    c.restore();
    tone(c, x, 0, nx - x, h, 0.93 + rnd() * 0.12);
    // Groove and the slight chamfer either side of it.
    c.fillStyle = "rgba(28,16,8,.62)";
    c.fillRect(x, 0, groove, h);
    c.fillStyle = "rgba(255,240,220,.10)";
    c.fillRect(x + groove, 0, 1, h);
    hc.fillStyle = "#000";
    hc.fillRect(x, 0, groove, h);
    hc.fillStyle = "#777";
    hc.fillRect(x + groove, 0, 2, h);
    hc.fillRect(nx - 2, 0, 2, h);
  }
  addLuminanceRelief(height, colour, 0.1);
  return { colour, height, tile: [boards * boardM, heightM] };
}

// Horizontal lap boards (Cedral Lap): find the shadow lines in the photo,
// then lay each course as one long board with a staggered butt joint.
function lapBoards(img, seed, { courses = 6, courseM = 0.15, lengthM = 2.4, w = 2048, h = 768 } = {}) {
  const rnd = seeded(seed),
    probe = makeCanvas(img.width, img.height),
    pc = probe.getContext("2d");
  pc.drawImage(img, 0, 0);
  const data = pc.getImageData(0, 0, img.width, img.height).data,
    rows = [];
  for (let y = 0; y < img.height; y++) {
    let s = 0;
    for (let x = 0; x < img.width; x += 4) {
      const i = (y * img.width + x) * 4;
      s += data[i] + data[i + 1] + data[i + 2];
    }
    rows.push(s);
  }
  const mean = rows.reduce((a, b) => a + b, 0) / rows.length,
    lines = [];
  for (let y = 3; y < rows.length - 3; y++)
    if (rows[y] < mean * 0.82 && rows[y] <= rows[y - 1] && rows[y] <= rows[y + 1] && (!lines.length || y - lines.at(-1) > img.height / 12)) lines.push(y);
  const bands = [];
  for (let i = 1; i < lines.length; i++) if (lines[i] - lines[i - 1] > img.height / 10) bands.push([lines[i - 1] + 6, lines[i] - 4]);
  if (!bands.length) for (let i = 0; i < 4; i++) bands.push([(img.height / 4) * i + 8, (img.height / 4) * (i + 1) - 8]);
  const colour = makeCanvas(w, h),
    height = makeCanvas(w, h),
    c = colour.getContext("2d"),
    hc = height.getContext("2d"),
    ch = h / courses;
  for (let r = 0; r < courses; r++) {
    const [y0, y1] = bands[Math.floor(rnd() * bands.length)],
      y = Math.round(r * ch),
      ny = Math.round((r + 1) * ch),
      joint = Math.floor(rnd() * w),
      flip = rnd() > 0.5;
    for (const dx of [joint - w, joint]) {
      c.save();
      c.beginPath();
      c.rect(0, y, w, ny - y);
      c.clip();
      c.translate(dx + (flip ? w : 0), y);
      c.scale(flip ? -1 : 1, 1);
      c.drawImage(img, 4, y0, img.width - 8, y1 - y0, 0, 0, w, ny - y);
      c.restore();
    }
    tone(c, 0, y, w, ny - y, 0.96 + rnd() * 0.07);
    // Each board is thicker at its bottom edge: a ramp, then a drop.
    const g = hc.createLinearGradient(0, y, 0, ny);
    g.addColorStop(0, "#5a5a5a");
    g.addColorStop(0.92, "#e8e8e8");
    g.addColorStop(1, "#f2f2f2");
    hc.fillStyle = g;
    hc.fillRect(0, y, w, ny - y);
    const shade = c.createLinearGradient(0, y, 0, y + ch * 0.22);
    shade.addColorStop(0, "rgba(0,0,0,.42)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = shade;
    c.fillRect(0, y, w, ch * 0.22);
    c.fillStyle = "rgba(0,0,0,.55)";
    c.fillRect(0, y, w, 3);
    c.fillStyle = "rgba(0,0,0,.35)";
    c.fillRect(joint, y, 2, ny - y);
    hc.fillStyle = "#222";
    hc.fillRect(joint, y, 2, ny - y);
  }
  addLuminanceRelief(height, colour, 0.08);
  return { colour, height, tile: [lengthM, courses * courseM] };
}

// Photos that already repeat across (slats, steel profile): stretch to full
// wall height and derive the relief from the photo's shading.
function stretchVertical(img, { widthM, heightM = 2.4, w = 768, h = 2048, relief = 1, invert = false }) {
  const colour = makeCanvas(w, h),
    height = makeCanvas(w, h),
    c = colour.getContext("2d");
  c.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
  // Feather the left/right edges into each other so the repeat is invisible.
  const blend = Math.round(w * 0.03);
  c.save();
  c.globalAlpha = 0.5;
  c.drawImage(colour, 0, 0, blend, h, w - blend, 0, blend, h);
  c.drawImage(colour, w - blend, 0, blend, h, 0, 0, blend, h);
  c.restore();
  const hc = height.getContext("2d");
  hc.filter = `grayscale(1) contrast(${1 + relief})${invert ? " invert(1)" : ""} blur(1px)`;
  hc.drawImage(colour, 0, 0);
  hc.filter = "none";
  return { colour, height, tile: [widthM, heightM] };
}

// Plank flooring from the laminate photo: staggered 1.2m planks.
function planks(img, seed, { rows = 6, rowM = 0.19, lengthM = 2.4, w = 2048, h = 972 } = {}) {
  const rnd = seeded(seed),
    colour = makeCanvas(w, h),
    height = makeCanvas(w, h),
    c = colour.getContext("2d"),
    hc = height.getContext("2d"),
    rh = h / rows,
    pl = w / 2;
  hc.fillStyle = "#ddd";
  hc.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    const y = Math.round(r * rh),
      ny = Math.round((r + 1) * rh),
      shift = Math.floor(rnd() * pl);
    for (let k = -1; k < 2; k++) {
      const x = shift + k * pl,
        sy = rnd() * (img.height - img.height * 0.25),
        flip = rnd() > 0.5;
      c.save();
      c.beginPath();
      c.rect(x, y, pl, ny - y);
      c.clip();
      c.translate(x + (flip ? pl : 0), y);
      c.scale(flip ? -1 : 1, 1);
      c.drawImage(img, 0, sy, img.width, img.height * 0.25, 0, 0, pl, ny - y);
      c.restore();
      tone(c, x, y, pl, ny - y, 0.94 + rnd() * 0.1);
      c.fillStyle = "rgba(0,0,0,.28)";
      c.fillRect(x, y, 2, ny - y);
      hc.fillStyle = "#555";
      hc.fillRect(x, y, 2, ny - y);
    }
    c.fillStyle = "rgba(0,0,0,.3)";
    c.fillRect(0, y, w, 2);
    hc.fillStyle = "#555";
    hc.fillRect(0, y, w, 2);
  }
  addLuminanceRelief(height, colour, 0.05);
  return { colour, height, tile: [lengthM, rows * rowM] };
}

// Profiled steel sheet, drawn rather than photographed so the ribs are crisp.
function steelSheet(hex, seed) {
  const w = 1024,
    h = 256,
    rnd = seeded(seed),
    colour = makeCanvas(w, h),
    height = makeCanvas(w, h),
    c = colour.getContext("2d"),
    hc = height.getContext("2d"),
    base = new THREE.Color(hex),
    lift = base.clone().lerp(new THREE.Color("#5b6266"), 0.32);
  c.fillStyle = `#${lift.getHexString()}`;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.035)";
    c.fillRect(rnd() * w, rnd() * h, 1, 4 + rnd() * 30);
  }
  // Four profiles per metre: a 30mm crown rib, sloping webs and two stiffeners.
  hc.fillStyle = "#606060";
  hc.fillRect(0, 0, w, h);
  const period = w / 4;
  for (let p = 0; p < 4; p++) {
    const x = p * period,
      g = hc.createLinearGradient(x, 0, x + period * 0.32, 0);
    g.addColorStop(0, "#606060");
    g.addColorStop(0.55, "#ffffff");
    g.addColorStop(1, "#ffffff");
    hc.fillStyle = g;
    hc.fillRect(x, 0, period * 0.18, h);
    const g2 = hc.createLinearGradient(x + period * 0.12, 0, x + period * 0.3, 0);
    g2.addColorStop(0, "#ffffff");
    g2.addColorStop(1, "#606060");
    hc.fillStyle = g2;
    hc.fillRect(x + period * 0.12, 0, period * 0.18, h);
    hc.fillStyle = "#757575";
    hc.fillRect(x + period * 0.52, 0, 3, h);
    hc.fillRect(x + period * 0.74, 0, 3, h);
    c.fillStyle = "rgba(0,0,0,.18)";
    c.fillRect(x + period * 0.3, 0, 3, h);
  }
  return { colour, height, tile: [1, 0.25] };
}

function photoTiled(img, { tileM }) {
  const colour = makeCanvas(img.width, img.height);
  colour.getContext("2d").drawImage(img, 0, 0);
  return { colour, height: null, tile: tileM };
}

const TEXTURE_ROOT = "/textures";
const recipes = {
  wood: (f, img) => verticalBoards(img, hashString(f.id)),
  plank: (f, img) => lapBoards(img, hashString(f.id)),
  slatted: (f, img) => stretchVertical(img, { widthM: 0.9, relief: 1.3 }),
  steel: (f) => steelSheet(f.hex, hashString(f.id)),
};
// Make Room's renderer ships its brick maps under swapped names; matched to
// the swatches by colour (research/live-2026-10-12/inventory.md).
const BRICK_MAPS = {
  "brick-brickdale": "brick-brickdale",
  "brick-keswick": "brick-keswick",
  "brick-kingston": "brick-kingston",
};

function standard(params) {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params });
}

// A material for a cladding finish. Starts as the finish colour and gains its
// maps once the photograph has loaded; `onReady` asks the scene to redraw.
export function claddingMaterial(finishId, onReady) {
  const key = `clad:${finishId}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const f = finishById(finishId);
  const steel = f.material === "steel";
  const mat = standard({
    color: new THREE.Color(f.hex),
    roughness: steel ? 0.42 : f.material === "brick" ? 0.92 : 0.8,
    metalness: steel ? 0.45 : 0,
    envMapIntensity: steel ? 1.1 : 0.7,
  });
  mat.userData.tile = [1, 1];
  mat.userData.ready = (async () => {
    let built;
    if (f.material === "brick") {
      const map = BRICK_MAPS[f.id];
      const [colour, normal, rough] = await Promise.all([
        loadImage(`${TEXTURE_ROOT}/pbr/${map}-diffuse.jpg`),
        loadImage(`${TEXTURE_ROOT}/pbr/brick-normal.jpg`),
        loadImage(`${TEXTURE_ROOT}/pbr/brick-roughness.jpg`),
      ]);
      if (!colour) return mat;
      const tile = [1.1, 1.1];
      mat.map = texture(colour.width ? Object.assign(makeCanvas(colour.width, colour.height), {}) : colour);
      mat.map.image.getContext("2d").drawImage(colour, 0, 0);
      if (normal) mat.normalMap = imageTexture(normal, false);
      if (rough) mat.roughnessMap = imageTexture(rough, false);
      mat.normalScale.set(1.2, 1.2);
      built = { tile };
    } else {
      const img = steel ? null : await loadImage(`${TEXTURE_ROOT}/finish/${f.id}.jpg`);
      if (!steel && !img) return mat;
      const r = recipes[f.material](f, img);
      mat.map = texture(r.colour);
      if (r.height) mat.normalMap = texture(normalFromHeight(r.height, f.material === "plank" ? 3.2 : f.material === "steel" ? 4 : 2.4), { colour: false });
      built = r;
    }
    mat.color.set("#ffffff");
    if (steel) mat.color.set("#ffffff");
    mat.userData.tile = built.tile;
    for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) if (t) t.repeat.set(1 / built.tile[0], 1 / built.tile[1]);
    mat.needsUpdate = true;
    onReady?.();
    return mat;
  })();
  materialCache.set(key, mat);
  return mat;
}
function imageTexture(img, colour = true) {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

export function floorMaterial(floorId, onReady) {
  const key = `floor:${floorId}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const f = FLOORS.find((x) => x.id === floorId);
  const mat = standard({ color: new THREE.Color(f.hex), roughness: 0.55, envMapIntensity: 0.6 });
  mat.userData.tile = [1, 1];
  mat.userData.ready = (async () => {
    const img = await loadImage(`${TEXTURE_ROOT}/finish/floor-${f.id}.jpg`);
    if (!img) return mat;
    const r = planks(img, hashString(f.id));
    mat.map = texture(r.colour);
    mat.normalMap = texture(normalFromHeight(r.height, 1.6), { colour: false });
    mat.color.set("#ffffff");
    mat.userData.tile = r.tile;
    for (const t of [mat.map, mat.normalMap]) t.repeat.set(1 / r.tile[0], 1 / r.tile[1]);
    mat.needsUpdate = true;
    onReady?.();
    return mat;
  })();
  materialCache.set(key, mat);
  return mat;
}

// Composite decking: Make Room's renderer decking maps, tinted to the colour.
export function deckingMaterial(colourId, onReady) {
  const key = `deck:${colourId}`;
  if (materialCache.has(key)) return materialCache.get(key);
  const d = DECKING_COLOURS.find((x) => x.id === colourId);
  const tint = new THREE.Color(d.hex);
  // Very dark tints read as a void under daylight; keep some of the board detail.
  const hsl = {};
  tint.getHSL(hsl);
  if (hsl.l < 0.12) tint.setHSL(hsl.h, hsl.s, 0.12);
  const mat = standard({ color: tint, roughness: 0.75, envMapIntensity: 0.5 });
  // Live renderer: one tile per 1m x 0.8m, six boards across it.
  mat.userData.tile = [1, 0.8];
  mat.userData.ready = (async () => {
    const [diffuse, normal, ao] = await Promise.all([
      loadImage(`${TEXTURE_ROOT}/pbr/decking-diffuse.jpg`),
      loadImage(`${TEXTURE_ROOT}/pbr/decking-normal.jpg`),
      loadImage(`${TEXTURE_ROOT}/pbr/decking-ao.jpg`),
    ]);
    if (diffuse) mat.map = imageTexture(diffuse);
    if (normal) mat.normalMap = imageTexture(normal, false);
    if (ao) mat.aoMap = imageTexture(ao, false);
    for (const t of [mat.map, mat.normalMap, mat.aoMap]) t?.repeat.set(1, 1.25);
    mat.needsUpdate = true;
    onReady?.();
    return mat;
  })();
  materialCache.set(key, mat);
  return mat;
}

// Small procedural surfaces: plaster, EPDM, paving, lawn.
function noiseCanvas(size, base, specks, seed, alpha = 0.05) {
  const rnd = seeded(seed),
    c = makeCanvas(size, size),
    ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    const s = 1 + rnd() * 2;
    ctx.fillRect(rnd() * size, rnd() * size, s, s);
  }
  return c;
}
export function plainMaterial(name) {
  const key = `plain:${name}`;
  if (materialCache.has(key)) return materialCache.get(key);
  let mat;
  switch (name) {
    case "plaster":
      // Low environment light: the lawn's green bounce otherwise tints the walls.
      mat = standard({ color: "#f4f2ed", roughness: 0.95, envMapIntensity: 0.45, map: texture(noiseCanvas(256, "#ffffff", 5000, 3, 0.012), { repeat: [0.5, 0.5] }) });
      break;
    case "ceiling":
      // A touch of self-light keeps the ceiling reading white, not tinted.
      mat = standard({ color: "#fbfaf7", roughness: 0.97, envMapIntensity: 0.25, emissive: "#ffffff", emissiveIntensity: 0.12 });
      break;
    case "epdm":
      mat = standard({ color: "#2a2c2d", roughness: 0.9, map: texture(noiseCanvas(256, "#ffffff", 14000, 5, 0.05), { repeat: [1, 1] }) });
      break;
    case "fascia":
      // RAL 7016 anthracite, Make Room's default fascia colour.
      mat = standard({ color: "#323a3e", roughness: 0.5, metalness: 0.3, envMapIntensity: 0.8 });
      break;
    case "plinth":
      mat = standard({ color: "#1b1e20", roughness: 0.6, metalness: 0.2 });
      break;
    case "soffit":
      mat = standard({ color: "#2b2f32", roughness: 0.7 });
      break;
    case "skirting":
      mat = standard({ color: "#f7f6f2", roughness: 0.6 });
      break;
    case "paving": {
      const rnd = seeded(91),
        c = makeCanvas(512, 512),
        ctx = c.getContext("2d");
      ctx.fillStyle = "#b9b4a8";
      ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          const shade = 196 + Math.floor(rnd() * 26);
          ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 14})`;
          ctx.fillRect(x * 256 + 3, y * 256 + 3, 250, 250);
          for (let i = 0; i < 1600; i++) {
            ctx.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.07)" : "rgba(60,50,40,.07)";
            ctx.fillRect(x * 256 + 3 + rnd() * 250, y * 256 + 3 + rnd() * 250, 2, 2);
          }
        }
      mat = standard({ map: texture(c, { repeat: [1 / 1.2, 1 / 1.2] }), roughness: 0.92 });
      break;
    }
    case "lawn": {
      const rnd = seeded(17),
        c = makeCanvas(512, 512),
        ctx = c.getContext("2d");
      ctx.fillStyle = "#6f8a4c";
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 26000; i++) {
        const x = rnd() * 512,
          y = rnd() * 512,
          g = 90 + Math.floor(rnd() * 70);
        ctx.strokeStyle = `rgba(${g - 30},${g + 30},${g - 50},.35)`;
        ctx.lineWidth = 0.7 + rnd() * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rnd() * 2 - 1, y - 2 - rnd() * 5);
        ctx.stroke();
      }
      mat = standard({ map: texture(c, { repeat: [1 / 1.6, 1 / 1.6] }), roughness: 1, color: "#d4dac8" });
      break;
    }
    default:
      mat = standard({ color: "#cccccc" });
  }
  materialCache.set(key, mat);
  return mat;
}

// Resolves once every cached material has its maps (for PDF captures).
export function texturesReady() {
  return Promise.all([...materialCache.values()].map((m) => m.userData.ready).filter(Boolean));
}
