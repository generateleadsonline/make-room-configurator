import * as THREE from "three";
import {
  HEIGHT,
  WALLS,
  wallsFor,
  wallLength,
  openingById,
  sillHeight,
  electricalById,
  FRAME_COLOURS,
  finishById,
  schedule,
  fmtM,
} from "../catalog.js";
import { claddingMaterial, floorMaterial, deckingMaterial, plainMaterial } from "./textures.js";
import { buildFurniture } from "./furniture.js";

// Vertical build-up, metres above ground. Matches Make Room's renderer: 100mm
// floor and base curb, 216mm fascia, walls ~100mm plus cladding.
export const FLOOR_Y = 0.1;
export const FASCIA_H = 0.216;
export const FASCIA_BOTTOM = HEIGHT - FASCIA_H;
export const CEILING_Y = 2.25;
export const WALL_T = 0.12;
export const FASCIA_PROUD = 0.035;
const FRAME_DEPTH = 0.07;
const FRAME_SET_BACK = 0.035; // frame face sits just behind the cladding

export const roofFall = (c) => Math.min(0.07, Math.max(0.025, c.depth * 0.012));

// Each wall's local frame: u runs left to right as seen from outside, v is up,
// n points outwards. Origin is the wall's left end at ground level.
export function wallFrame(c, wall) {
  const w = c.width,
    d = c.depth;
  switch (wall) {
    case "front":
      return { origin: new THREE.Vector3(-w / 2, 0, d / 2), rotY: 0, length: w };
    case "back":
      return { origin: new THREE.Vector3(w / 2, 0, -d / 2), rotY: Math.PI, length: w };
    case "left":
      return { origin: new THREE.Vector3(-w / 2, 0, -d / 2), rotY: -Math.PI / 2, length: d };
    default:
      return { origin: new THREE.Vector3(w / 2, 0, d / 2), rotY: Math.PI / 2, length: d };
  }
}
export function wallPoint(c, wall, u, v, n = 0) {
  const f = wallFrame(c, wall);
  const local = new THREE.Vector3(u, v, n).applyAxisAngle(new THREE.Vector3(0, 1, 0), f.rotY);
  return local.add(f.origin);
}
export function wallNormal(wall) {
  return { front: new THREE.Vector3(0, 0, 1), back: new THREE.Vector3(0, 0, -1), left: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(1, 0, 0) }[wall];
}
// Overhang carried past each end of a wall (a front overhang extends the side
// walls forward into a porch).
function wallExtensions(c, wall) {
  const o = c.overhang;
  return {
    front: [o.left, o.right],
    back: [o.right, o.left],
    left: [o.back, o.front],
    right: [o.front, o.back],
  }[wall];
}

const mats = {};
function frameMaterial(colourId) {
  const key = `frame:${colourId}`;
  if (!mats[key]) {
    const hex = FRAME_COLOURS.find((f) => f.id === colourId)?.hex || "#0A0A0A";
    const col = new THREE.Color(hex).lerp(new THREE.Color("#3a3f44"), colourId === "black" ? 0.12 : 0.28);
    mats[key] = new THREE.MeshStandardMaterial({ color: col, roughness: 0.38, metalness: 0.55, envMapIntensity: 1 });
  }
  return mats[key];
}
let glassQuality = "high";
export function setGlassQuality(q) {
  glassQuality = q;
}
function glassMaterial() {
  const key = `glass:${glassQuality}`;
  if (!mats[key])
    mats[key] =
      glassQuality === "high"
        ? new THREE.MeshPhysicalMaterial({
            color: "#e8f1f2",
            metalness: 0,
            roughness: 0.03,
            transmission: 1,
            thickness: 0.012,
            ior: 1.5,
            envMapIntensity: 1.25,
            specularIntensity: 1,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshPhysicalMaterial({
            color: "#9fb3b8",
            metalness: 0.1,
            roughness: 0.04,
            transparent: true,
            opacity: 0.32,
            envMapIntensity: 1.4,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
  return mats[key];
}
function basic(key, params) {
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial(params);
  return mats[key];
}
const handleMat = () => basic("handle", { color: "#b8bcbe", metalness: 0.9, roughness: 0.28 });
const whiteFitting = () => basic("fitting", { color: "#f4f4f1", roughness: 0.45 });
// Each lamp gets its own material so the engine can switch it on at dusk.
const lampOff = () => ({
  clone() {
    const m = new THREE.MeshStandardMaterial({ color: "#d9d6cc", emissive: "#ffd79a", emissiveIntensity: 0, roughness: 0.3 });
    m.userData.disposable = true;
    return m;
  },
});

function box(parent, w, h, d, x, y, z, material, { cast = true, receive = true, name } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001)), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}
// Box whose UVs are in metres on every face, so tiled finishes keep their scale.
function metreBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position,
    nor = g.attributes.normal,
    uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i),
      nx = Math.abs(nor.getX(i)),
      ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, z, y);
    else if (ny > 0.5) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  return g;
}
function flipFaces(g) {
  const idx = g.index;
  if (idx) for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
function rectShape(u0, v0, u1, v1) {
  const s = new THREE.Shape();
  s.moveTo(u0, v0);
  s.lineTo(u1, v0);
  s.lineTo(u1, v1);
  s.lineTo(u0, v1);
  s.closePath();
  return s;
}
function holePath(u0, v0, u1, v1) {
  const p = new THREE.Path();
  p.moveTo(u0, v0);
  p.lineTo(u0, v1);
  p.lineTo(u1, v1);
  p.lineTo(u1, v0);
  p.closePath();
  return p;
}
function shiftUV(g, du, dv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
  return g;
}

// Rectangle of an opening in wall coordinates.
export function openingRect(o) {
  const p = openingById(o.product);
  const v0 = FLOOR_Y + sillHeight(p);
  return { u0: o.offset - p.width / 2, u1: o.offset + p.width / 2, v0, v1: v0 + p.height, p };
}

function frameProfile(material) {
  return material === "upvc" ? { outer: 0.068, sash: 0.075, depth: 0.075 } : { outer: 0.05, sash: 0.058, depth: FRAME_DEPTH };
}

// A glazed sash: four frame members around a pane.
function sash(parent, w, h, x, y, z, prof, frameMat, { member = prof.sash, depth = prof.depth * 0.8, glass = true } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  box(g, w, member, depth, 0, h / 2 - member / 2, 0, frameMat);
  box(g, w, member, depth, 0, -h / 2 + member / 2, 0, frameMat);
  box(g, member, h - member * 2, depth, -w / 2 + member / 2, 0, 0, frameMat);
  box(g, member, h - member * 2, depth, w / 2 - member / 2, 0, 0, frameMat);
  if (glass) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - member * 2 + 0.01, h - member * 2 + 0.01), glassMaterial());
    pane.renderOrder = 2;
    g.add(pane);
    // Glazing bead shadow line keeps panes readable from far away.
    const bead = basic("bead", { color: "#15181a", roughness: 0.6 });
    for (const [bw, bh, bx, by] of [
      [w - member * 2, 0.008, 0, h / 2 - member - 0.004],
      [w - member * 2, 0.008, 0, -h / 2 + member + 0.004],
      [0.008, h - member * 2, -w / 2 + member + 0.004, 0],
      [0.008, h - member * 2, w / 2 - member - 0.004, 0],
    ])
      box(g, bw, bh, 0.012, bx, by, depth / 2 - 0.004, bead, { cast: false });
  }
  return g;
}
function leverHandle(parent, x, y, z, side = 1) {
  const m = handleMat();
  box(parent, 0.028, 0.14, 0.012, x, y, z + 0.008, m, { cast: false });
  const lever = box(parent, 0.13, 0.018, 0.018, x - side * 0.055, y + 0.03, z + 0.05, m, { cast: false });
  box(parent, 0.016, 0.016, 0.045, x, y + 0.03, z + 0.03, m, { cast: false });
  return lever;
}
function pullHandle(parent, x, y, z) {
  const m = handleMat();
  box(parent, 0.022, 0.32, 0.022, x, y, z + 0.045, m, { cast: false });
  box(parent, 0.016, 0.016, 0.04, x, y + 0.15, z + 0.025, m, { cast: false });
  box(parent, 0.016, 0.016, 0.04, x, y - 0.15, z + 0.025, m, { cast: false });
}

// Door or window assembly, built in wall-local space centred on the opening.
function buildOpening(o, cladMat) {
  const { p, u0, u1, v0, v1 } = openingRect(o);
  const g = new THREE.Group();
  g.name = `opening:${o.id}`;
  const W = u1 - u0,
    H = v1 - v0,
    prof = frameProfile(o.material),
    fm = frameMaterial(o.colour),
    zc = -FRAME_SET_BACK - prof.depth / 2;
  g.position.set((u0 + u1) / 2, (v0 + v1) / 2, 0);
  // Outer frame.
  const of = prof.outer;
  box(g, W, of, prof.depth, 0, H / 2 - of / 2, zc, fm);
  box(g, W, of, prof.depth, 0, -H / 2 + of / 2, zc, fm);
  box(g, of, H - of * 2, prof.depth, -W / 2 + of / 2, 0, zc, fm);
  box(g, of, H - of * 2, prof.depth, W / 2 - of / 2, 0, zc, fm);
  // Reveal flashing in the frame colour, as on Make Room's builds.
  const rev = FRAME_SET_BACK + 0.002;
  box(g, W + 0.02, 0.012, rev, 0, H / 2 + 0.006, -rev / 2, fm, { cast: false });
  box(g, 0.012, H, rev, -W / 2 - 0.006, 0, -rev / 2, fm, { cast: false });
  box(g, 0.012, H, rev, W / 2 + 0.006, 0, -rev / 2, fm, { cast: false });
  const iw = W - of * 2,
    ih = H - of * 2,
    zf = zc + 0.004;
  const fam = p.family;
  if (p.kind === "window") {
    // External sill.
    box(g, W + 0.06, 0.02, 0.07, 0, -H / 2 - 0.01, 0.0, fm);
    if (fam === "fixed") {
      sash(g, iw, ih, 0, 0, zf, prof, fm, { member: 0.012, depth: 0.03 });
    } else if (fam === "tov100") {
      sash(g, iw, ih, 0, 0, zf + 0.01, prof, fm);
      leverHandle(g, 0, -ih / 2 + 0.11, zf - 0.06, 0).rotation.z = Math.PI / 2;
    } else {
      const top = ih * 0.5;
      box(g, iw, of, prof.depth, 0, 0, zc, fm);
      sash(g, iw, top - of / 2, 0, top / 2 + of / 4, zf + 0.01, prof, fm);
      sash(g, iw, top - of / 2, 0, -top / 2 - of / 4, zf, prof, fm, { member: 0.012, depth: 0.03 });
      leverHandle(g, 0, of + 0.09, zf - 0.06, 0).rotation.z = Math.PI / 2;
    }
    return g;
  }
  // Doors: threshold first.
  box(g, W, 0.025, prof.depth + 0.03, 0, -H / 2 + 0.0125, zc + 0.015, fm);
  if (fam === "single") {
    sash(g, iw, ih, 0, 0, zf, prof, fm, { member: 0.085 });
    leverHandle(g, iw / 2 - 0.07, -0.05, zf + prof.depth * 0.4, 1);
  } else if (fam === "french" || fam === "french-sidelights") {
    let doorW = iw,
      x0 = 0;
    if (fam === "french-sidelights") {
      const side = (iw - 1.15) / 2;
      for (const s of [-1, 1]) {
        sash(g, side, ih, s * (iw / 2 - side / 2), 0, zf, prof, fm, { member: 0.012, depth: 0.03 });
        box(g, of, ih, prof.depth, s * (iw / 2 - side), 0, zc, fm);
      }
      doorW = 1.15 - of;
      x0 = 0;
    }
    for (const s of [-1, 1]) {
      sash(g, doorW / 2, ih, x0 + (s * doorW) / 4, 0, zf, prof, fm, { member: 0.08 });
      leverHandle(g, x0 + s * 0.06, -0.05, zf + prof.depth * 0.4, -s);
    }
  } else if (fam === "slider") {
    const n = p.panels,
      pw = iw / n + 0.04;
    for (let i = 0; i < n; i++) {
      const x = -iw / 2 + (iw / n) * (i + 0.5);
      const front = n === 2 ? i === 1 : i === 1 || i === 2;
      sash(g, pw, ih, x, 0, zf + (front ? 0.02 : -0.02), prof, fm, { member: 0.07 });
    }
    // Interlocks read as a heavier stile.
    if (n === 2) box(g, 0.05, ih, prof.depth + 0.02, 0, 0, zf, fm);
    else for (const x of [-iw / 4, 0, iw / 4]) box(g, x === 0 ? 0.03 : 0.05, ih, prof.depth + 0.02, x, 0, zf, fm);
    pullHandle(g, n === 2 ? 0.08 : iw / 4 - 0.08, -0.02, zf + 0.02);
  } else if (fam === "bifold") {
    const n = p.panels,
      pw = iw / n;
    for (let i = 0; i < n; i++) {
      const x = -iw / 2 + pw * (i + 0.5);
      sash(g, pw - 0.004, ih, x, 0, zf, prof, fm, { member: 0.065 });
      if (i) for (const y of [ih * 0.38, 0, -ih * 0.38]) box(g, 0.018, 0.06, 0.028, x - pw / 2, y, zf + prof.depth * 0.45, handleMat(), { cast: false });
    }
    leverHandle(g, iw / 2 - pw + 0.07, -0.05, zf + prof.depth * 0.4, -1);
  }
  return g;
}

// One wall: outer cladding skin with holes, inner plaster skin, reveals,
// openings, plinth curb and porch wings.
function buildWall(c, wall, ctx) {
  const f = wallFrame(c, wall),
    L = f.length,
    group = new THREE.Group();
  group.name = `wall:${wall}`;
  group.position.copy(f.origin);
  group.rotation.y = f.rotY;
  const extension = c.type === "extension" && wall === "back";
  const finish = c.cladding[wall];
  const clad = claddingMaterial(finish, ctx.redraw);
  const plaster = plainMaterial("plaster");
  const openings = c.openings.filter((o) => o.wall === wall);
  const rects = openings.map(openingRect);
  const uvShift = { front: 0, back: 0.37, left: 0.71, right: 0.19 }[wall];
  if (!extension) {
    const outer = rectShape(0, FLOOR_Y, L, FASCIA_BOTTOM);
    for (const r of rects) outer.holes.push(holePath(r.u0, r.v0, r.u1, r.v1));
    const og = shiftUV(new THREE.ShapeGeometry(outer), uvShift, 0);
    const outerMesh = new THREE.Mesh(og, clad);
    outerMesh.castShadow = outerMesh.receiveShadow = true;
    outerMesh.name = `cladding:${wall}`;
    group.add(outerMesh);
    // Base curb: the thin black trim Make Room's renderer draws at ground level.
    box(group, L + 0.01, FLOOR_Y, 0.012, L / 2, FLOOR_Y / 2, 0.006, plainMaterial("plinth"));
  }
  const inner = rectShape(0, FLOOR_Y, L, CEILING_Y);
  for (const r of rects) inner.holes.push(holePath(r.u0, r.v0, r.u1, r.v1));
  const ig = flipFaces(new THREE.ShapeGeometry(inner));
  const innerMesh = new THREE.Mesh(ig, plaster);
  innerMesh.position.z = -WALL_T;
  innerMesh.receiveShadow = true;
  innerMesh.name = `plaster:${wall}`;
  group.add(innerMesh);
  // Cladding returns into each opening, then plaster reveals inside.
  for (const r of rects) {
    const depthIn = WALL_T - FRAME_SET_BACK - FRAME_DEPTH;
    const zIn = -FRAME_SET_BACK - FRAME_DEPTH - depthIn / 2;
    const w = r.u1 - r.u0,
      h = r.v1 - r.v0;
    box(group, 0.004, h, depthIn, r.u0 + 0.002, (r.v0 + r.v1) / 2, zIn, plaster, { cast: false });
    box(group, 0.004, h, depthIn, r.u1 - 0.002, (r.v0 + r.v1) / 2, zIn, plaster, { cast: false });
    box(group, w, 0.004, depthIn, (r.u0 + r.u1) / 2, r.v1 - 0.002, zIn, plaster, { cast: false });
    if (r.p.kind === "window") box(group, w + 0.04, 0.025, depthIn + 0.03, (r.u0 + r.u1) / 2, r.v0 + 0.0125, zIn - 0.015, whiteFitting(), { cast: false });
  }
  for (const o of openings) {
    const og = buildOpening(o, clad);
    group.add(og);
    ctx.openings.set(o.id, og);
  }
  // Porch wings: the wall continues under a side's overhang.
  if (!extension) {
    const [startExt, endExt] = wallExtensions(c, wall);
    for (const [u0, len] of [
      [-startExt, startExt],
      [L, endExt],
    ]) {
      if (len <= 0) continue;
      const wing = new THREE.Mesh(metreBox(len, FASCIA_BOTTOM - FLOOR_Y, WALL_T), clad);
      wing.position.set(u0 + len / 2, (FASCIA_BOTTOM + FLOOR_Y) / 2, -WALL_T / 2);
      wing.castShadow = wing.receiveShadow = true;
      wing.name = `wing:${wall}`;
      group.add(wing);
      box(group, len, FLOOR_Y, WALL_T + 0.012, u0 + len / 2, FLOOR_Y / 2, -WALL_T / 2 + 0.006, plainMaterial("plinth"));
      // Slim trim on the exposed end of the wing.
      const endU = u0 < 0 ? u0 : u0 + len;
      box(group, 0.02, FASCIA_BOTTOM - FLOOR_Y, WALL_T + 0.01, endU, (FASCIA_BOTTOM + FLOOR_Y) / 2, -WALL_T / 2, plainMaterial("fascia"), { cast: false });
    }
  }
  ctx.walls[wall] = group;
  return group;
}

function cornerTrims(c, parent) {
  const w = c.width,
    d = c.depth,
    trim = plainMaterial("fascia"),
    h = FASCIA_BOTTOM - FLOOR_Y,
    s = 0.03;
  const corners = [
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ];
  if (c.type !== "extension")
    corners.push(
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
    );
  for (const [x, z] of corners) box(parent, s, h, s, x + Math.sign(x) * (s / 2 - 0.008), FLOOR_Y + h / 2, z + Math.sign(z) * (s / 2 - 0.008), trim, { cast: false });
}

// Flat EPDM roof falling slightly to the back, anthracite fascia round it, and
// clad soffits under any overhang.
function buildRoof(c, ctx) {
  const roof = new THREE.Group();
  roof.name = "roof";
  const o = c.overhang,
    lip = FASCIA_PROUD,
    ext = c.type === "extension",
    x0 = -c.width / 2 - o.left - lip,
    x1 = c.width / 2 + o.right + lip,
    z0 = -c.depth / 2 - (ext ? 0 : o.back + lip),
    z1 = c.depth / 2 + o.front + lip,
    fall = roofFall(c),
    topAt = (z) => HEIGHT - (fall * (z1 - z)) / (z1 - z0);
  const fasciaMat = plainMaterial("fascia");
  const t = 0.02;
  // Fascia boards: front and back are rectangles, the sides are wedges.
  const sideShape = (zA, zB) => {
    const s = new THREE.Shape();
    s.moveTo(zA, FASCIA_BOTTOM);
    s.lineTo(zB, FASCIA_BOTTOM);
    s.lineTo(zB, topAt(zB) + 0.015);
    s.lineTo(zA, topAt(zA) + 0.015);
    s.closePath();
    return s;
  };
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const front = box(roof, x1 - x0, HEIGHT + 0.015 - FASCIA_BOTTOM, t, (x0 + x1) / 2, (HEIGHT + 0.015 + FASCIA_BOTTOM) / 2, z1 - t / 2, fasciaMat);
  front.name = "fascia:front";
  if (!ext) {
    const back = box(roof, x1 - x0, topAt(z0) + 0.015 - FASCIA_BOTTOM, t, (x0 + x1) / 2, (topAt(z0) + 0.015 + FASCIA_BOTTOM) / 2, z0 + t / 2, fasciaMat);
    back.name = "fascia:back";
  }
  for (const x of [x0, x1 - t]) {
    const g = extrude(sideShape(z0, z1), t);
    g.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(g, fasciaMat);
    m.position.x = x + t;
    m.castShadow = m.receiveShadow = true;
    m.name = "fascia:side";
    roof.add(m);
  }
  // EPDM membrane, laid to the fall.
  const membrane = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - t * 2, Math.hypot(z1 - z0 - t * 2, fall)), plainMaterial("epdm"));
  membrane.rotation.x = -Math.PI / 2 - Math.atan2(fall, z1 - z0);
  membrane.position.set((x0 + x1) / 2, (topAt(z0) + topAt(z1)) / 2 - 0.004, (z0 + z1) / 2);
  membrane.receiveShadow = true;
  membrane.name = "membrane";
  roof.add(membrane);
  // Roof deck thickness behind the fascia (seen from below near the edge).
  const deck = box(roof, x1 - x0 - t * 2, 0.02, z1 - z0 - t, (x0 + x1) / 2, FASCIA_BOTTOM + 0.01, (z0 + z1) / 2, plainMaterial("soffit"), { cast: true });
  deck.name = "roofdeck";
  ctx.roof = roof;
  // Soffits: boards of that wall's cladding running out from the wall.
  const soffitY = FASCIA_BOTTOM + 0.0005;
  const strips = {
    front: o.front > 0 && [x0 + t, x1 - t, c.depth / 2, z1 - t],
    back: !ext && o.back > 0 && [x0 + t, x1 - t, z0 + t, -c.depth / 2],
    left: o.left > 0 && [x0 + t, -c.width / 2, z0 + (ext ? 0 : t), z1 - t],
    right: o.right > 0 && [c.width / 2, x1 - t, z0 + (ext ? 0 : t), z1 - t],
  };
  for (const [side, r] of Object.entries(strips)) {
    if (!r) continue;
    const [ax, bx, az, bz] = r;
    const finish = finishById(c.cladding[side]);
    const mat = finish.material === "brick" ? plainMaterial("soffit") : claddingMaterial(finish.id, ctx.redraw);
    const g = new THREE.PlaneGeometry(bx - ax, bz - az);
    // Boards run away from the wall: map u across the wall, v outwards.
    const uv = g.attributes.uv,
      pos = g.attributes.position;
    const across = side === "front" || side === "back";
    for (let i = 0; i < uv.count; i++) {
      const px = pos.getX(i) + (ax + bx) / 2,
        pz = pos.getY(i) + (az + bz) / 2;
      uv.setXY(i, across ? px : pz, across ? pz : px);
    }
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = Math.PI / 2;
    m.position.set((ax + bx) / 2, soffitY, (az + bz) / 2);
    m.receiveShadow = true;
    m.name = `soffit:${side}`;
    roof.add(m);
    ctx.soffits[side] = m;
  }
  return { roof, bounds: { x0, x1, z0, z1 } };
}

function buildDecking(c, ctx) {
  const decks = new THREE.Group();
  decks.name = "decking";
  const dk = c.decking,
    w = c.width,
    d = c.depth,
    mat = deckingMaterial(c.deckingColour, ctx.redraw),
    trim = basic("decktrim", { color: "#0d0e0f", roughness: 0.6 }),
    T = 0.1;
  // Front/back decks take the corners when a side deck meets them.
  const rects = {
    front: dk.front > 0 && [-w / 2 - dk.left, w / 2 + dk.right, d / 2, d / 2 + dk.front],
    back: dk.back > 0 && [-w / 2 - dk.left, w / 2 + dk.right, -d / 2 - dk.back, -d / 2],
    left: dk.left > 0 && [-w / 2 - dk.left, -w / 2, -d / 2, d / 2],
    right: dk.right > 0 && [w / 2, w / 2 + dk.right, -d / 2, d / 2],
  };
  for (const [side, r] of Object.entries(rects)) {
    if (!r) continue;
    const [x0, x1, z0, z1] = r;
    const g = new THREE.BoxGeometry(x1 - x0, T, z1 - z0);
    // Boards face outwards from the wall, as in the live renderer.
    const uv = g.attributes.uv,
      pos = g.attributes.position;
    const outward = side === "front" || side === "back";
    for (let i = 0; i < uv.count; i++) {
      const px = pos.getX(i) + (x0 + x1) / 2,
        pz = pos.getZ(i) + (z0 + z1) / 2,
        py = pos.getY(i);
      uv.setXY(i, outward ? pz : px, outward ? px : pz + py);
    }
    g.setAttribute("uv1", g.attributes.uv.clone());
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, T / 2, (z0 + z1) / 2);
    m.castShadow = m.receiveShadow = true;
    m.name = `deck:${side}`;
    decks.add(m);
    ctx.decks[side] = m;
    // 50 x 5mm black edge trim on the open edges.
    const e = 0.005,
      h = 0.05,
      y = T - h / 2;
    if (side === "front") box(decks, x1 - x0, h, e, (x0 + x1) / 2, y, z1 + e / 2, trim, { cast: false });
    if (side === "back") box(decks, x1 - x0, h, e, (x0 + x1) / 2, y, z0 - e / 2, trim, { cast: false });
    if (side === "left") box(decks, e, h, z1 - z0, x0 - e / 2, y, (z0 + z1) / 2, trim, { cast: false });
    if (side === "right") box(decks, e, h, z1 - z0, x1 + e / 2, y, (z0 + z1) / 2, trim, { cast: false });
    if (side === "front" || side === "back") {
      const zz = side === "front" ? (z0 + z1) / 2 : (z0 + z1) / 2;
      if (dk.left <= 0) box(decks, e, h, z1 - z0, x0 - e / 2, y, zz, trim, { cast: false });
      if (dk.right <= 0) box(decks, e, h, z1 - z0, x1 + e / 2, y, zz, trim, { cast: false });
    }
  }
  return decks;
}

// Interior shell: laminate floor, ceiling, skirting.
function buildInterior(c, ctx) {
  const g = new THREE.Group();
  g.name = "interior";
  const iw = c.width - WALL_T * 2,
    id = c.depth - WALL_T * 2,
    floorMat = floorMaterial(c.floor, ctx.redraw);
  const fg = new THREE.PlaneGeometry(iw, id);
  const uv = fg.attributes.uv,
    pos = fg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
  const floor = new THREE.Mesh(fg, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y + 0.001;
  floor.receiveShadow = true;
  floor.name = "floor";
  g.add(floor);
  ctx.floor = floor;
  // Floor slab edge under the walls.
  box(g, c.width - 0.02, FLOOR_Y, c.depth - 0.02, 0, FLOOR_Y / 2, 0, plainMaterial("plinth"), { cast: false });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(iw, id), plainMaterial("ceiling"));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  ceiling.name = "ceiling";
  g.add(ceiling);
  ctx.ceiling = ceiling;
  // Above the ceiling, a dark lid stops light leaking through the roof edge.
  box(g, c.width, 0.03, c.depth, 0, (CEILING_Y + FASCIA_BOTTOM) / 2, 0, plainMaterial("soffit"), { cast: true, receive: false });
  // Skirting, broken at door openings.
  const sk = plainMaterial("skirting");
  for (const wall of WALLS) {
    if (c.type === "extension" && wall === "back") continue;
    const L = wallLength(c, wall) - WALL_T * 2;
    const doors = c.openings
      .filter((o) => o.wall === wall && openingById(o.product).kind === "door")
      .map(openingRect)
      .map((r) => [r.u0 - WALL_T, r.u1 - WALL_T])
      .sort((a, b) => a[0] - b[0]);
    let start = 0;
    const segs = [];
    for (const [a, b] of doors) {
      if (a > start) segs.push([start, a]);
      start = Math.max(start, b);
    }
    if (start < L) segs.push([start, L]);
    for (const [a, b] of segs) {
      const p = wallPoint(c, wall, WALL_T + (a + b) / 2, FLOOR_Y + 0.035, -WALL_T - 0.008);
      const m = box(g, b - a, 0.07, 0.016, p.x, p.y, p.z, sk, { cast: false });
      m.rotation.y = wallFrame(c, wall).rotY;
    }
  }
  return g;
}

// Free stretches of an inside wall (u in wall coordinates) for sockets etc.
function freeSpans(c, wall, margin = 0.25) {
  const L = wallLength(c, wall);
  const used = c.openings
    .filter((o) => o.wall === wall)
    .map(openingRect)
    .map((r) => [r.u0 - margin, r.u1 + margin])
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  let s = WALL_T + margin;
  for (const [a, b] of used) {
    if (a - s > 0.2) out.push([s, a]);
    s = Math.max(s, b);
  }
  if (L - WALL_T - margin - s > 0.2) out.push([s, L - WALL_T - margin]);
  return out;
}

function mainDoor(c) {
  const doors = c.openings.filter((o) => openingById(o.product).kind === "door");
  const pref = ["front", "left", "right", "back"];
  return doors.sort((a, b) => pref.indexOf(a.wall) - pref.indexOf(b.wall) || openingById(b.product).width - openingById(a.product).width)[0] || null;
}

// Package fittings: downlights, sockets, switch, heater, wall lights and
// soffit downlights. Returns the light objects the engine switches at dusk.
function buildElectrics(c, ctx) {
  const e = electricalById(c.electrical),
    g = new THREE.Group();
  g.name = "electrics";
  const lights = { interior: [], exterior: [], lamps: [] };
  const iw = c.width - WALL_T * 2,
    id = c.depth - WALL_T * 2;
  // Ceiling downlights on an even grid.
  if (e.downlights) {
    const cols = iw >= id ? Math.ceil(e.downlights / 2) : 2,
      rows = Math.ceil(e.downlights / cols);
    let n = 0;
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols && n < e.downlights; k++, n++) {
        const x = -iw / 2 + (iw / cols) * (k + 0.5),
          z = -id / 2 + (id / rows) * (r + 0.5);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20), lampOff().clone());
        lamp.position.set(x, CEILING_Y - 0.006, z);
        g.add(lamp);
        lights.lamps.push(lamp);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 24), whiteFitting());
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, CEILING_Y - 0.008, z);
        g.add(ring);
      }
    const count = Math.min(4, Math.max(1, Math.round(e.downlights / 2)));
    for (let i = 0; i < count; i++) {
      const pl = new THREE.PointLight("#ffd9a8", 0, Math.max(iw, id) * 1.6, 1.6);
      pl.position.set(-iw / 2 + (iw / count) * (i + 0.5), CEILING_Y - 0.25, 0);
      g.add(pl);
      lights.interior.push(pl);
    }
  }
  // Sockets low on the free wall stretches, switch beside the main door.
  const plate = whiteFitting();
  let placed = 0;
  const order = ["back", "left", "right", "front"].filter((w) => !(c.type === "extension" && w === "back"));
  for (let round = 0; placed < e.sockets && round < 3; round++)
    for (const wall of order) {
      if (placed >= e.sockets) break;
      const spans = freeSpans(c, wall);
      if (!spans.length) continue;
      const [a, b] = spans[(round + placed) % spans.length];
      const u = a + (b - a) * [0.2, 0.8, 0.5][round];
      const p = wallPoint(c, wall, u, FLOOR_Y + 0.3, -WALL_T - 0.006);
      const s = box(g, 0.146, 0.086, 0.01, p.x, p.y, p.z, plate, { cast: false });
      s.rotation.y = wallFrame(c, wall).rotY;
      placed++;
    }
  const door = mainDoor(c);
  if (e.switchGang && door) {
    const r = openingRect(door);
    const u = r.u1 + 0.15 < wallLength(c, door.wall) - WALL_T ? r.u1 + 0.15 : r.u0 - 0.15;
    const p = wallPoint(c, door.wall, u, FLOOR_Y + 1.2, -WALL_T - 0.006);
    box(g, 0.086, 0.086, 0.01, p.x, p.y, p.z, plate, { cast: false }).rotation.y = wallFrame(c, door.wall).rotY;
  }
  if (e.heaterKw) {
    const hw = e.heaterKw >= 2 ? 1.0 : 0.6;
    for (const wall of order) {
      const span = freeSpans(c, wall, 0.1).find(([a, b]) => b - a > hw + 0.1);
      if (!span) continue;
      const u = (span[0] + span[1]) / 2;
      const p = wallPoint(c, wall, u, FLOOR_Y + 0.4, -WALL_T - 0.03);
      const heater = new THREE.Group();
      heater.position.copy(p);
      heater.rotation.y = wallFrame(c, wall).rotY;
      box(heater, hw, 0.45, 0.05, 0, 0, 0, plate);
      for (let x = -hw / 2 + 0.06; x < hw / 2 - 0.05; x += 0.05) box(heater, 0.006, 0.3, 0.004, x, 0.02, -0.027, basic("heatergrille", { color: "#cfd0cb" }), { cast: false });
      g.add(heater);
      break;
    }
  }
  // Up/down wall lights either side of the main door (and the next door).
  const wallLight = (wall, u) => {
    const p = wallPoint(c, wall, u, 1.95, 0.045),
      n = wallNormal(wall);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 18), frameMaterial("black"));
    body.position.copy(p);
    body.castShadow = true;
    g.add(body);
    for (const dir of [1, -1]) {
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), lampOff().clone());
      glow.rotation.x = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      glow.position.copy(p).add(new THREE.Vector3(0, dir * 0.0905, 0));
      g.add(glow);
      lights.lamps.push(glow);
      const spot = new THREE.SpotLight("#ffcf8a", 0, 3.2, 0.42, 0.65, 1.4);
      spot.position.copy(p).addScaledVector(n, 0.02).add(new THREE.Vector3(0, dir * 0.08, 0));
      spot.target.position.copy(spot.position).add(new THREE.Vector3(0, dir * 2, 0)).addScaledVector(n, 0.12);
      g.add(spot, spot.target);
      lights.exterior.push(spot);
    }
  };
  if (e.upDown) {
    const doors = c.openings.filter((o) => openingById(o.product).kind === "door" && wallsFor(c.type).includes(o.wall));
    const list = door ? [door, ...doors.filter((d) => d !== door)] : [];
    const pairs = Math.max(1, e.upDown / 2);
    if (!list.length) {
      const L = wallLength(c, "front");
      wallLight("front", Math.min(0.5, L * 0.2));
      wallLight("front", L - Math.min(0.5, L * 0.2));
    }
    for (let i = 0; i < pairs; i++) {
      const d = list[i];
      if (!d) {
        // Spare pair: the front corners.
        const L = wallLength(c, "front");
        wallLight("front", 0.25);
        wallLight("front", L - 0.25);
        continue;
      }
      const r = openingRect(d),
        L = wallLength(c, d.wall);
      for (const u of [r.u0 - 0.2, r.u1 + 0.2]) if (u > 0.08 && u < L - 0.08 && !c.openings.some((o) => o.wall === d.wall && o !== d && Math.abs(o.offset - u) < openingById(o.product).width / 2 + 0.06)) wallLight(d.wall, u);
    }
  }
  // External downlights: in the soffit where there is an overhang, else under the fascia.
  if (e.soffitLights) {
    const sides = ["front", "left", "right", "back"].filter((s) => c.overhang[s] > 0);
    const side = sides[0] || "front";
    const L = wallLength(c, side);
    for (let i = 0; i < e.soffitLights; i++) {
      const u = (L / e.soffitLights) * (i + 0.5);
      const out = c.overhang[side] > 0 ? c.overhang[side] / 2 : 0.02;
      const p = wallPoint(c, side, u, FASCIA_BOTTOM - 0.004, out);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 18), lampOff().clone());
      lamp.position.copy(p);
      g.add(lamp);
      lights.lamps.push(lamp);
      const spot = new THREE.SpotLight("#ffd49a", 0, 3.4, 0.7, 0.8, 1.3);
      spot.position.copy(p).add(new THREE.Vector3(0, -0.02, 0));
      spot.target.position.copy(p).add(new THREE.Vector3(0, -2, 0)).addScaledVector(wallNormal(side), 0.3);
      g.add(spot, spot.target);
      lights.exterior.push(spot);
    }
  }
  ctx.electrics = g;
  ctx.lights = lights;
  return g;
}

// Plan-view section: dark wall poché, door swings and window lines, drawn just
// under the ceiling so the roof can be lifted off for the top view.
function buildPlanSection(c) {
  const g = new THREE.Group();
  g.name = "plansection";
  g.visible = false;
  const y = CEILING_Y + 0.05,
    poche = basic("poche", { color: "#2d3a2b", roughness: 1 }),
    glass = basic("planglass", { color: "#8fb3c0", roughness: 1 }),
    swing = (mats.swing ||= new THREE.LineBasicMaterial({ color: "#526f41" }));
  for (const wall of WALLS) {
    if (c.type === "extension" && wall === "back") continue;
    const L = wallLength(c, wall),
      rects = c.openings.filter((o) => o.wall === wall).map((o) => ({ ...openingRect(o), o }));
    let s = 0;
    const solid = [];
    for (const r of [...rects].sort((a, b) => a.u0 - b.u0)) {
      if (r.u0 > s) solid.push([s, r.u0]);
      s = r.u1;
    }
    if (s < L) solid.push([s, L]);
    for (const [a, b] of solid) {
      const p = wallPoint(c, wall, (a + b) / 2, y, -WALL_T / 2);
      box(g, b - a + (a === 0 || b === L ? 0.0 : 0), 0.02, WALL_T, p.x, p.y, p.z, poche, { cast: false }).rotation.y = wallFrame(c, wall).rotY;
    }
    for (const r of rects) {
      const p = wallPoint(c, wall, (r.u0 + r.u1) / 2, y, -WALL_T / 2);
      box(g, r.u1 - r.u0, 0.02, 0.025, p.x, p.y, p.z, r.p.kind === "door" ? basic("plandoor", { color: "#c9b48e" }) : glass, { cast: false }).rotation.y = wallFrame(c, wall).rotY;
      if (r.p.kind === "door" && (r.p.family === "single" || r.p.family === "french" || r.p.family === "french-sidelights")) {
        const leaves = r.p.family === "single" ? [[r.u0, r.u1 - r.u0, 1]] : (() => {
          const doorW = r.p.family === "french" ? r.u1 - r.u0 : 1.15;
          const mid = (r.u0 + r.u1) / 2;
          return [
            [mid - doorW / 2, doorW / 2, 1],
            [mid + doorW / 2, doorW / 2, -1],
          ];
        })();
        for (const [hinge, len, dir] of leaves) {
          const pts = [];
          for (let a = 0; a <= 16; a++) {
            const t = (a / 16) * (Math.PI / 2);
            pts.push(wallPoint(c, wall, hinge + dir * Math.cos(t) * len, y + 0.012, Math.sin(t) * len));
          }
          pts.push(wallPoint(c, wall, hinge, y + 0.012, 0));
          g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), swing));
        }
      }
    }
  }
  return g;
}

// Measurements shown as HTML labels by the engine.
function labelsFor(c) {
  const w = c.width,
    d = c.depth,
    out = [];
  const fz = d / 2 + Math.max(c.decking.front, c.overhang.front) + 0.5,
    rx = w / 2 + Math.max(c.decking.right, c.overhang.right) + 0.5;
  out.push({ id: "width", text: fmtM(w), pos: new THREE.Vector3(0, 0.02, fz), kind: "dim", line: [new THREE.Vector3(-w / 2, 0.02, fz), new THREE.Vector3(w / 2, 0.02, fz)] });
  out.push({ id: "depth", text: fmtM(d), pos: new THREE.Vector3(rx, 0.02, 0), kind: "dim", line: [new THREE.Vector3(rx, 0.02, -d / 2), new THREE.Vector3(rx, 0.02, d / 2)] });
  out.push({ id: "height", text: fmtM(HEIGHT), pos: new THREE.Vector3(w / 2 + 0.25, HEIGHT / 2, d / 2 + c.overhang.front + 0.05), kind: "dim", line: [new THREE.Vector3(w / 2 + 0.25, 0, d / 2 + c.overhang.front + 0.05), new THREE.Vector3(w / 2 + 0.25, HEIGHT, d / 2 + c.overhang.front + 0.05)], outsideOnly: true });
  for (const s of schedule(c)) {
    const r = openingRect(s);
    out.push({ id: `tag:${s.id}`, text: s.tag, pos: wallPoint(c, s.wall, (r.u0 + r.u1) / 2, r.v1 + 0.08, 0.05), kind: "tag", planPos: wallPoint(c, s.wall, (r.u0 + r.u1) / 2, CEILING_Y, -WALL_T - 0.32) });
  }
  return out;
}

// Builds the whole building for a normalised design. `redraw` is called when
// a texture arrives so the engine can repaint.
export function buildBuilding(c, { redraw } = {}) {
  const ctx = { redraw, walls: {}, openings: new Map(), soffits: {}, decks: {}, roof: null, floor: null, ceiling: null, electrics: null, lights: null };
  const root = new THREE.Group();
  root.name = "building";
  const shell = new THREE.Group();
  shell.name = "shell";
  root.add(shell);
  for (const wall of WALLS) shell.add(buildWall(c, wall, ctx));
  cornerTrims(c, shell);
  const { roof, bounds } = buildRoof(c, ctx);
  root.add(roof);
  root.add(buildInterior(c, ctx));
  root.add(buildElectrics(c, ctx));
  const decks = buildDecking(c, ctx);
  root.add(decks);
  const furniture = buildFurniture(c, { FLOOR_Y, WALL_T, CEILING_Y, openingRect, wallPoint, wallFrame });
  root.add(furniture);
  const plan = buildPlanSection(c);
  root.add(plan);
  root.userData = {
    c,
    ctx,
    roof,
    decks,
    furniture,
    plan,
    labels: labelsFor(c),
    roofBounds: bounds,
  };
  return root;
}

// Where to look, and from which side, for each part of the design. Used by the
// engine to turn the camera towards whatever is being changed.
export function focusTarget(c, spec) {
  const w = c.width,
    d = c.depth,
    o = c.overhang,
    dk = c.decking;
  const boxOf = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  const whole = boxOf(-w / 2 - o.left - dk.left, 0, -d / 2 - o.back - dk.back, w / 2 + o.right + dk.right, HEIGHT, d / 2 + o.front + dk.front);
  const tilt = (v, up = 0.38) => v.clone().setY(up).normalize();
  switch (spec?.type) {
    case "wall":
    case "cladding": {
      const n = wallNormal(spec.wall);
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).multiplyScalar(0.35);
      const L = wallLength(c, spec.wall);
      const a = wallPoint(c, spec.wall, 0, 0, 0),
        b = wallPoint(c, spec.wall, L, HEIGHT, 0);
      return { view: "outside", box: new THREE.Box3().setFromPoints([a, b]).expandByScalar(0.2), dir: tilt(n.clone().add(side), 0.3), highlight: { kind: "wall", wall: spec.wall } };
    }
    case "opening": {
      const op = c.openings.find((x) => x.id === spec.id);
      if (!op) return focusTarget(c, { type: "overview" });
      const r = openingRect(op);
      const n = wallNormal(op.wall);
      const a = wallPoint(c, op.wall, r.u0 - 0.5, 0, 0),
        b = wallPoint(c, op.wall, r.u1 + 0.5, Math.max(r.v1 + 0.3, 2.4), 0);
      return { view: "outside", box: new THREE.Box3().setFromPoints([a, b]), dir: tilt(n.clone().add(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).multiplyScalar(0.25)), 0.18), highlight: { kind: "opening", id: op.id } };
    }
    case "overhang": {
      const side = spec.side || "front";
      const n = wallNormal(side);
      const L = wallLength(c, side);
      // Stand below the soffit and look up into it.
      const a = wallPoint(c, side, -0.2, 1.3, 0),
        b = wallPoint(c, side, L + 0.2, HEIGHT + 0.05, Math.max(o[side], 0.3) + 0.1);
      const dir = n.clone().add(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).multiplyScalar(0.45)).setY(0).normalize().setY(-0.16).normalize();
      return { view: "outside", box: new THREE.Box3().setFromPoints([a, b]), dir, highlight: { kind: "overhang", side } };
    }
    case "decking": {
      const side = spec.side || "front";
      const n = wallNormal(side);
      const L = wallLength(c, side);
      const a = wallPoint(c, side, -0.3, 0, 0),
        b = wallPoint(c, side, L + 0.3, 1.6, Math.max(dk[side], 0.6) + 0.3);
      return { view: "outside", box: new THREE.Box3().setFromPoints([a, b]), dir: tilt(n.clone().add(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).multiplyScalar(0.4)), 0.75), highlight: { kind: "decking", side } };
    }
    case "floor":
      return { view: "inside", highlight: { kind: "floor" }, look: "down" };
    case "electrics":
      return { view: "inside", highlight: { kind: "electrics" }, look: "up" };
    case "furniture":
      return { view: "inside" };
    case "roof":
      return { view: "outside", box: whole.clone(), dir: new THREE.Vector3(0.8, 0.9, 1).normalize(), highlight: { kind: "roof" } };
    case "size":
      return { view: "outside", box: whole.clone(), dir: new THREE.Vector3(0.95, 0.55, 1.2).normalize(), highlight: { kind: "outline" } };
    default:
      return { view: "outside", box: whole.clone(), dir: new THREE.Vector3(0.95, 0.42, 1.25).normalize() };
  }
}
