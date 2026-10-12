import * as THREE from "three";
import { openingById, WALLS, wallLength } from "../catalog.js";

// Illustrative furniture for the chosen use. Pieces are skipped rather than
// placed in front of a door, so every layout stays believable.

const cache = {};
function mat(key, params) {
  if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial({ roughness: 0.8, ...params });
  return cache[key];
}
function woodCanvas(base) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  let s = 77;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = r() > 0.5 ? "rgba(60,35,15,.12)" : "rgba(255,240,210,.08)";
    ctx.lineWidth = 0.5 + r();
    const y = r() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + r() * 6 - 3, 170, y + r() * 6 - 3, 256, y + r() * 4 - 2);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const M = {
  oak: () => mat("oak", { color: "#ffffff", map: woodCanvas("#c79f6c"), roughness: 0.6 }),
  black: () => mat("black", { color: "#26292b", roughness: 0.45, metalness: 0.4 }),
  white: () => mat("white", { color: "#f1f0ea", roughness: 0.5 }),
  fabric: () => mat("fabric", { color: "#7d8b76", roughness: 1 }),
  fabricLight: () => mat("fabricLight", { color: "#d8d2c3", roughness: 1 }),
  cushionA: () => mat("cushionA", { color: "#b3895f", roughness: 1 }),
  cushionB: () => mat("cushionB", { color: "#a7b39b", roughness: 1 }),
  rug: () => mat("rug", { color: "#d9d3c4", roughness: 1 }),
  screen: () => mat("screen", { color: "#1d2a30", roughness: 0.2, metalness: 0.3, emissive: "#22343c", emissiveIntensity: 0.25 }),
  pot: () => mat("pot", { color: "#c9c2b2", roughness: 0.85 }),
  leaf: () => mat("leaf", { color: "#58764a", roughness: 0.9 }),
  leaf2: () => mat("leaf2", { color: "#76925e", roughness: 0.9 }),
  rubber: () => mat("rubber", { color: "#33373a", roughness: 0.95 }),
  mirror: () => mat("mirror", { color: "#c9d3d3", roughness: 0.04, metalness: 1 }),
  books: ["#8e6c4a", "#526f41", "#c6b79a", "#3c4a52", "#a8553d"].map((c, i) => () => mat(`book${i}`, { color: c, roughness: 0.9 })),
};
function box(g, w, h, d, x, y, z, m, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function cyl(g, r, h, x, y, z, m, rTop = r, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function plant(g, x, y, z, size = 1) {
  cyl(g, 0.13 * size, 0.32 * size, x, y + 0.16 * size, z, M.pot(), 0.16 * size);
  let s = Math.floor((x + 9) * 97 + (z + 9) * 13);
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const leaf = new THREE.SphereGeometry(0.1 * size, 10, 6);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39,
      rad = (0.04 + r() * 0.17) * size,
      h = (0.45 + r() * 0.6) * size;
    const m = new THREE.Mesh(leaf, i % 2 ? M.leaf() : M.leaf2());
    m.position.set(x + Math.cos(a) * rad, y + 0.3 * size + h * 0.7, z + Math.sin(a) * rad);
    m.scale.set(1.5, 0.32, 0.7);
    m.rotation.set(r() * 0.8, a, r() * 0.6);
    m.castShadow = true;
    g.add(m);
  }
}
function artwork(g, w, h, x, y, z, rotY, colour) {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.rotation.y = rotY;
  box(f, w, h, 0.025, 0, 0, 0, M.black(), false);
  box(f, w - 0.05, h - 0.05, 0.005, 0, 0, 0.014, M.white(), false);
  box(f, w * 0.55, h * 0.5, 0.004, 0, 0.02, 0.018, mat(`art${colour}`, { color: colour, roughness: 1 }), false);
  g.add(f);
}

// Floor rectangles in front of every door that furniture must keep clear.
function blockedZones(c, ctx) {
  const zones = [];
  for (const o of c.openings) {
    const p = openingById(o.product);
    if (p.kind !== "door") continue;
    const r = ctx.openingRect(o);
    const a = ctx.wallPoint(c, o.wall, r.u0 - 0.1, 0, 0),
      b = ctx.wallPoint(c, o.wall, r.u1 + 0.1, 0, -ctx.WALL_T - 1.0);
    zones.push([Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z)]);
  }
  return zones;
}
const overlaps = (r, zones) => zones.some(([x0, x1, z0, z1]) => r[0] < x1 && r[1] > x0 && r[2] < z1 && r[3] > z0);
// Wall stretch (inside) that has no glazing below 1.2m: good for desks and art.
function solidWall(c, wall, from, to) {
  return !c.openings.some((o) => {
    if (o.wall !== wall) return false;
    const p = openingById(o.product);
    const a = o.offset - p.width / 2,
      b = o.offset + p.width / 2;
    return a < to && b > from;
  });
}

export function buildFurniture(c, ctx) {
  const g = new THREE.Group();
  g.name = "furniture";
  const F = ctx.FLOOR_Y + 0.002,
    iw = c.width - ctx.WALL_T * 2,
    id = c.depth - ctx.WALL_T * 2,
    zones = blockedZones(c, ctx);
  if (iw < 1.1 || id < 1.1) return g;
  const place = (rect, fn) => {
    if (overlaps(rect, zones)) return false;
    fn();
    zones.push(rect);
    return true;
  };
  const backZ = -id / 2,
    left = -iw / 2,
    right = iw / 2;
  const rugW = Math.min(2, iw * 0.6),
    rugD = Math.min(1.4, id * 0.5);
  if (c.use === "office") {
    const deskW = Math.min(1.5, iw * 0.55),
      deskD = 0.7,
      x = left + deskW / 2 + 0.15,
      z = backZ + deskD / 2 + 0.05;
    place([x - deskW / 2, x + deskW / 2, z - deskD / 2, z + deskD / 2 + 0.7], () => {
      box(g, deskW, 0.035, deskD, x, F + 0.74, z, M.oak());
      for (const dx of [-deskW / 2 + 0.04, deskW / 2 - 0.04]) {
        box(g, 0.03, 0.72, deskD - 0.06, x + dx, F + 0.36, z, M.black());
      }
      box(g, 0.62, 0.36, 0.025, x + 0.05, F + 1.0, z - 0.2, M.black());
      box(g, 0.59, 0.33, 0.004, x + 0.05, F + 1.0, z - 0.186, M.screen());
      box(g, 0.05, 0.16, 0.05, x + 0.05, F + 0.84, z - 0.22, M.black());
      box(g, 0.22, 0.012, 0.16, x + 0.05, F + 0.763, z - 0.22, M.black());
      box(g, 0.42, 0.015, 0.14, x + 0.05, F + 0.765, z + 0.08, M.white());
      cyl(g, 0.045, 0.1, x - deskW / 2 + 0.18, F + 0.81, z - 0.1, M.white(), 0.04);
      // Task chair.
      const cz = z + deskD / 2 + 0.28;
      cyl(g, 0.025, 0.42, x + 0.05, F + 0.25, cz, M.black(), 0.025, 10);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leg = box(g, 0.3, 0.025, 0.035, x + 0.05 + Math.cos(a) * 0.15, F + 0.05, cz + Math.sin(a) * 0.15, M.black());
        leg.rotation.y = -a;
      }
      box(g, 0.48, 0.07, 0.46, x + 0.05, F + 0.48, cz, M.fabric());
      box(g, 0.46, 0.52, 0.06, x + 0.05, F + 0.8, cz + 0.22, M.fabric()).rotation.x = -0.12;
    });
    if (iw > 2.6)
      place([right - 0.4, right, backZ, backZ + 1.0], () => {
        // Open shelving with books.
        const sx = right - 0.2,
          sz = backZ + 0.5;
        for (const y of [0.02, 0.42, 0.82, 1.22, 1.6]) box(g, 0.36, 0.025, 0.9, sx, F + y, sz, M.oak());
        for (const dz of [-0.44, 0.44]) box(g, 0.36, 1.62, 0.025, sx, F + 0.81, sz + dz, M.oak());
        for (let i = 0; i < 14; i++) {
          const shelf = [0.42, 0.82, 1.22][i % 3];
          box(g, 0.22, 0.24 + (i % 4) * 0.02, 0.04, sx - 0.02, F + shelf + 0.14, sz - 0.38 + Math.floor(i / 3) * 0.13, M.books[i % 5](), false);
        }
      });
    if (id > 2.2 && iw > 3)
      place([right - 0.95, right - 0.05, -0.2, 0.75], () => {
        const ax = right - 0.5,
          az = 0.3;
        box(g, 0.78, 0.4, 0.78, ax, F + 0.2, az, M.fabricLight());
        box(g, 0.78, 0.45, 0.14, ax, F + 0.55, az - 0.32, M.fabricLight());
        box(g, 0.12, 0.25, 0.78, ax - 0.33, F + 0.5, az, M.fabricLight());
        box(g, 0.12, 0.25, 0.78, ax + 0.33, F + 0.5, az, M.fabricLight());
        box(g, 0.34, 0.3, 0.1, ax, F + 0.52, az - 0.2, M.cushionA(), false);
      });
  } else if (c.use === "gym") {
    const matW = Math.min(1.9, iw * 0.55);
    box(g, matW, 0.012, Math.min(2.4, id * 0.75), -iw * 0.1, F + 0.006, 0.05, M.rubber(), false);
    if (iw > 2)
      place([left, left + 0.6, -0.5, 0.9], () => {
        // Bench.
        const bx = left + 0.55,
          bz = 0.15;
        box(g, 0.3, 0.07, 1.15, bx, F + 0.44, bz, M.fabric());
        for (const dz of [-0.45, 0.45]) box(g, 0.06, 0.42, 0.06, bx, F + 0.21, bz + dz, M.black());
      });
    place([right - 0.5, right, backZ, backZ + 1.1], () => {
      // Dumbbell rack.
      const rx = right - 0.25,
        rz = backZ + 0.55;
      box(g, 0.4, 0.04, 1.0, rx, F + 0.35, rz, M.black());
      box(g, 0.4, 0.04, 1.0, rx, F + 0.7, rz, M.black());
      for (const dz of [-0.48, 0.48]) box(g, 0.05, 0.78, 0.05, rx, F + 0.39, rz + dz, M.black());
      for (let i = 0; i < 5; i++)
        for (const y of [0.42, 0.77]) {
          const d = new THREE.Group();
          d.position.set(rx, F + y, rz - 0.38 + i * 0.19);
          cyl(d, 0.05 + i * 0.006, 0.05, 0, 0, -0.09, M.rubber()).rotation.x = Math.PI / 2;
          cyl(d, 0.05 + i * 0.006, 0.05, 0, 0, 0.09, M.rubber()).rotation.x = Math.PI / 2;
          cyl(d, 0.015, 0.2, 0, 0, 0, M.black()).rotation.x = Math.PI / 2;
          d.rotation.y = Math.PI / 2;
          g.add(d);
        }
    });
    if (solidWall(c, "back", 0.4, c.width - 0.4) && c.type !== "extension") {
      const mw = Math.min(1.4, iw * 0.45);
      box(g, mw, 1.6, 0.02, 0, F + 1.05, backZ + 0.012, M.mirror(), false);
    }
    plant(g, left + 0.3, F, backZ + 0.3, 0.95);
  } else {
    // Studio and family room: sofa, coffee table, rug, sideboard.
    const sofaW = Math.min(2.1, iw - 0.5),
      sofaD = 0.9,
      sz = backZ + sofaD / 2 + 0.06;
    box(g, rugW, 0.012, rugD, 0, F + 0.006, sz + sofaD / 2 + rugD / 2 - 0.25, M.rug(), false);
    place([-sofaW / 2, sofaW / 2, backZ, backZ + sofaD + 0.1], () => {
      const fab = c.use === "studio" ? M.fabric() : M.fabricLight();
      box(g, sofaW, 0.22, sofaD, 0, F + 0.2, sz, fab);
      box(g, sofaW - 0.24, 0.16, sofaD - 0.22, 0, F + 0.39, sz + 0.08, fab);
      box(g, sofaW, 0.46, 0.2, 0, F + 0.52, sz - sofaD / 2 + 0.1, fab);
      for (const s of [-1, 1]) box(g, 0.16, 0.36, sofaD, s * (sofaW / 2 - 0.08), F + 0.45, sz, fab);
      box(g, 0.4, 0.34, 0.12, -sofaW * 0.25, F + 0.6, sz - 0.24, M.cushionA(), false).rotation.x = -0.2;
      box(g, 0.4, 0.34, 0.12, sofaW * 0.22, F + 0.6, sz - 0.24, M.cushionB(), false).rotation.x = -0.2;
      for (const sx of [-1, 1]) for (const dz of [-1, 1]) box(g, 0.04, 0.09, 0.04, sx * (sofaW / 2 - 0.1), F + 0.045, sz + dz * (sofaD / 2 - 0.1), M.black());
    });
    if (id > 2.1)
      place([-0.5, 0.5, sz + sofaD / 2 + 0.25, sz + sofaD / 2 + 0.85], () => {
        const tz = sz + sofaD / 2 + 0.55;
        cyl(g, 0.38, 0.04, 0, F + 0.38, tz, M.oak(), 0.38, 40);
        cyl(g, 0.05, 0.36, 0, F + 0.18, tz, M.black(), 0.05);
        cyl(g, 0.2, 0.02, 0, F + 0.01, tz, M.black(), 0.2);
        cyl(g, 0.06, 0.12, 0.12, F + 0.46, tz, M.white(), 0.05);
      });
    if (c.use === "studio" && iw > 2.6)
      place([left, left + 0.9, -0.2, 0.7], () => {
        // Drawing table and stool.
        const x = left + 0.45,
          z = 0.25;
        box(g, 0.8, 0.03, 0.6, x, F + 0.9, z, M.oak()).rotation.z = 0.12;
        for (const dx of [-0.35, 0.35]) for (const dz of [-0.25, 0.25]) box(g, 0.03, 0.88, 0.03, x + dx, F + 0.44, z + dz, M.black());
        box(g, 0.5, 0.36, 0.01, x, F + 0.95, z - 0.05, mat("paper", { color: "#f4efe2" }), false).rotation.x = -Math.PI / 2 + 0.12;
        cyl(g, 0.17, 0.04, x + 0.1, F + 0.62, z + 0.5, M.oak());
        cyl(g, 0.02, 0.6, x + 0.1, F + 0.3, z + 0.5, M.black());
      });
    if (c.use === "multi" && iw > 2.8)
      place([right - 0.5, right, -0.75, 0.75], () => {
        // Sideboard with a screen.
        const x = right - 0.22;
        box(g, 0.42, 0.55, 1.5, x, F + 0.3, 0, M.oak());
        for (const dz of [-0.375, 0.375]) box(g, 0.002, 0.45, 0.7, x - 0.211, F + 0.3, dz, mat("seam", { color: "#7e6446" }), false);
        box(g, 0.05, 0.62, 1.1, x + 0.05, F + 0.95, 0, M.black());
        box(g, 0.012, 0.58, 1.06, x + 0.02, F + 0.95, 0, M.screen(), false);
      });
    plant(g, right - 0.3, F, backZ + 0.3, 1.05);
  }
  // A pair of prints on a solid stretch of the back wall.
  if (c.type !== "extension" && iw > 2.4 && solidWall(c, "back", c.width / 2 - 0.8, c.width / 2 + 0.8) && c.use !== "gym") {
    const y = c.use === "office" ? 1.55 : 1.45,
      x0 = c.use === "office" ? 0.45 : 0;
    artwork(g, 0.5, 0.65, x0 - 0.33, ctx.FLOOR_Y + y, backZ + 0.015, 0, "#a7b39b");
    artwork(g, 0.5, 0.65, x0 + 0.33, ctx.FLOOR_Y + y, backZ + 0.015, 0, "#c79f6c");
  }
  return g;
}
