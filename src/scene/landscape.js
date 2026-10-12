import * as THREE from "three";
import { plainMaterial } from "./textures.js";

// Garden setting: lawn, a path to the doors, a slatted boundary fence,
// planting, and for a modular extension the rear wall of the house it joins.

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const cache = {};
function mat(key, params) {
  if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial({ roughness: 0.9, ...params });
  return cache[key];
}
function box(g, w, h, d, x, y, z, m, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
// Safe mode draws planting as simple solid shapes instead of thousands of
// instanced leaves (instancing and alpha-tested leaves trip some mobile GPUs).
let foliage = true;
export function setFoliage(on) {
  foliage = on;
}
let leafMap;
function leafTexture() {
  if (leafMap) return leafMap;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(20, 10, 108, 118);
  grad.addColorStop(0, "#b4c39c");
  grad.addColorStop(1, "#465f3a");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(64, 4);
  ctx.bezierCurveTo(12, 42, 18, 90, 64, 124);
  ctx.bezierCurveTo(110, 90, 116, 42, 64, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(210,222,185,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 12);
  ctx.lineTo(64, 120);
  ctx.stroke();
  leafMap = new THREE.CanvasTexture(c);
  leafMap.colorSpace = THREE.SRGBColorSpace;
  return leafMap;
}
function leafCloud(parent, count, at, rnd, palette = ["#a9b993", "#8aa476", "#6e8b5e", "#5a744b"], size = 1) {
  if (!foliage) {
    // Bounds of the cloud, filled with one soft ellipsoid.
    const box = new THREE.Box3();
    for (let i = 0; i < Math.min(count, 200); i++) box.expandByPoint(new THREE.Vector3(...at(i)));
    const c = box.getCenter(new THREE.Vector3()),
      sz = box.getSize(new THREE.Vector3());
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), mat(`blob${palette[2]}`, { color: palette[2], roughness: 1, flatShading: true }));
    blob.position.copy(c);
    blob.scale.set(Math.max(sz.x, 0.2), Math.max(sz.y, 0.2), Math.max(sz.z, 0.2));
    parent.add(blob);
    return blob;
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.16 * size, 0.22 * size),
    mat(`leaf${size}`, { color: "#ffffff", map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }),
    count,
  );
  const dummy = new THREE.Object3D(),
    col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    dummy.position.set(...at(i));
    dummy.rotation.set(rnd() * Math.PI, rnd() * Math.PI * 2, rnd() * Math.PI);
    const s = 0.6 + rnd() * 0.8;
    dummy.scale.set(s, s, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, col.set(palette[i % palette.length]));
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function tree(parent, x, z, height, seed) {
  const g = new THREE.Group();
  g.userData.tall = true;
  g.position.set(x, 0, z);
  parent.add(g);
  const rnd = seeded(seed),
    bark = mat("bark", { color: "#7c7466" });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, height * 0.62, 10), bark);
  trunk.position.y = height * 0.31;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, height * 0.4, 6), bark);
    const a = i * 2.4;
    b.position.set(Math.cos(a) * 0.2, height * 0.62, Math.sin(a) * 0.2);
    b.rotation.z = Math.cos(a) * 0.6;
    b.rotation.x = Math.sin(a) * 0.6;
    g.add(b);
  }
  leafCloud(
    g,
    1500,
    () => {
      const a = rnd() * Math.PI * 2,
        y = 0.45 + rnd() * 0.55,
        crown = Math.sin((y - 0.38) * Math.PI * 0.98),
        r = Math.sqrt(rnd()) * 0.75 * crown * (height / 3);
      return [Math.cos(a) * r, height * y, Math.sin(a) * r];
    },
    rnd,
  );
}
function shrub(parent, x, z, r, seed) {
  const rnd = seeded(seed);
  const host = new THREE.Group();
  host.userData.tall = true;
  parent.add(host);
  parent = host;
  const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 14, 10), mat("shrubcore", { color: "#4c6440" }));
  core.position.set(x, r * 0.7, z);
  core.scale.y = 0.85;
  core.castShadow = true;
  parent.add(core);
  leafCloud(
    parent,
    Math.round(260 * r * r * 4),
    () => {
      const a = rnd() * Math.PI * 2,
        b = rnd() * Math.PI,
        rr = r * (0.75 + rnd() * 0.3);
      return [x + Math.cos(a) * Math.sin(b) * rr, r * 0.7 + Math.cos(b) * rr * 0.85, z + Math.sin(a) * Math.sin(b) * rr];
    },
    rnd,
    ["#7f9a69", "#6a8757", "#58734a", "#95ab7d"],
  );
}
// Potted olive standard, like the ones beside the doors in Make Room's photos.
function pottedOlive(parent, x, z, seed) {
  const rnd = seeded(seed);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.36, 24), mat("potstone", { color: "#cfcac0", roughness: 0.9 }));
  pot.position.set(x, 0.28, z);
  pot.castShadow = true;
  parent.add(pot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.7, 8), mat("bark", { color: "#7c7466" }));
  stem.position.set(x, 0.75, z);
  parent.add(stem);
  leafCloud(
    parent,
    320,
    () => {
      const a = rnd() * Math.PI * 2,
        b = rnd() * Math.PI,
        r = 0.24 * (0.6 + rnd() * 0.4);
      return [x + Math.cos(a) * Math.sin(b) * r, 1.2 + Math.cos(b) * r, z + Math.sin(a) * Math.sin(b) * r];
    },
    rnd,
    ["#9aa98b", "#87977a", "#a9b59a"],
    0.6,
  );
}
function fence(parent, x0, x1, z, h = 1.8) {
  const host = new THREE.Group();
  host.userData.tall = true;
  parent.add(host);
  parent = host;
  const slat = mat("fenceslat", { color: "#8a7b68", roughness: 0.95 }),
    post = mat("fencepost", { color: "#5d554b" });
  const len = x1 - x0;
  for (let y = 0.05; y < h; y += 0.115) box(parent, len, 0.09, 0.02, (x0 + x1) / 2, y + 0.045, z, slat);
  for (let x = x0; x <= x1 + 0.01; x += 1.8) box(parent, 0.07, h + 0.05, 0.07, x, (h + 0.05) / 2, z - 0.03, post);
}

function house(parent, c) {
  // The rear elevation of a rendered house the extension is built against.
  const g = new THREE.Group();
  g.name = "house";
  const w = Math.max(c.width + 5, 9),
    h = 5.6,
    z = -c.depth / 2,
    render = mat("render", { color: "#ece8df", roughness: 0.95 }),
    tile = mat("rooftile", { color: "#4a4c4e", roughness: 0.85 }),
    upvc = mat("upvcwhite", { color: "#f4f4f2", roughness: 0.4 }),
    glass = mat("houseglass", { color: "#7e9299", roughness: 0.08, metalness: 0.3 });
  box(g, w, h, 0.3, 0, h / 2, z - 0.15, render);
  // Eaves and a hint of the roof slope.
  box(g, w + 0.4, 0.22, 0.45, 0, h + 0.05, z - 0.05, mat("fasciawhite", { color: "#f2f2ef" }));
  const roof = box(g, w + 0.4, 0.08, 3.2, 0, h + 0.75, z - 1.5, tile);
  roof.rotation.x = 0.55;
  // Upstairs windows over the extension, one ground-floor window beside it.
  const win = (x, y, ww, wh) => {
    box(g, ww + 0.1, wh + 0.1, 0.08, x, y, z + 0.02, upvc);
    box(g, ww - 0.04, wh - 0.04, 0.02, x, y, z + 0.065, glass, false);
    box(g, 0.05, wh, 0.03, x, y, z + 0.08, upvc, false);
    box(g, ww + 0.2, 0.06, 0.12, x, y - wh / 2 - 0.08, z + 0.06, mat("sill", { color: "#d9d4c8" }));
  };
  win(-c.width * 0.22, 4.2, 1.1, 1.15);
  win(c.width * 0.28, 4.2, 0.8, 1.15);
  win(c.width / 2 + 1.35, 1.5, 1.2, 1.2);
  // Downpipe.
  box(g, 0.07, h, 0.07, -c.width / 2 - 1.6, h / 2, z + 0.05, mat("pipe", { color: "#2c2f31" }));
  g.userData.tall = true;
  parent.add(g);
  return g;
}

export function buildLandscape(c) {
  const g = new THREE.Group();
  g.name = "landscape";
  const w = c.width,
    d = c.depth,
    dk = c.decking,
    rnd = seeded(Math.round(w * 100 + d * 7));
  // Lawn.
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(26, 64), plainMaterial("lawn"));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.002;
  lawn.receiveShadow = true;
  const uv = lawn.geometry.attributes.uv,
    pos = lawn.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
  g.add(lawn);
  // Stepping-stone path from the front (or the front deck) towards the viewer.
  const paving = plainMaterial("paving");
  const startZ = d / 2 + (dk.front > 0 ? dk.front : 0) + 0.25;
  for (let i = 0; i < 5; i++) {
    const slab = box(g, 0.9, 0.04, 0.55, Math.sin(i * 0.7) * 0.12, 0.02, startZ + i * 0.78, paving, false);
    slab.rotation.y = (rnd() - 0.5) * 0.05;
  }
  if (dk.front <= 0) box(g, Math.min(w - 0.2, 2.6), 0.06, 0.45, 0, 0.03, d / 2 + 0.24, paving, false);
  if (c.type === "extension") {
    house(g, c);
    // Patio along the house.
    const pw = Math.max(w + 5, 9);
    const patio = new THREE.Mesh(new THREE.PlaneGeometry(pw, 2.2), paving);
    patio.rotation.x = -Math.PI / 2;
    patio.position.set(0, 0.004, -d / 2 + 1.1);
    const puv = patio.geometry.attributes.uv,
      pp = patio.geometry.attributes.position;
    for (let i = 0; i < puv.count; i++) puv.setXY(i, pp.getX(i), pp.getY(i));
    patio.receiveShadow = true;
    g.add(patio);
    for (const s of [-1, 1]) {
      const fx = s * (pw / 2);
      const f = new THREE.Group();
      fence(f, -d / 2 - 0.2, d / 2 + 6, 0, 1.8);
      f.rotation.y = -Math.PI / 2;
      f.position.x = fx;
      f.userData.tall = true;
      g.add(f);
    }
    shrub(g, -w / 2 - 1.6, d / 2 + 0.6, 0.55, 11);
    shrub(g, w / 2 + 1.5, d / 2 + 1.4, 0.45, 12);
  } else {
    // Boundary fence and planting behind the room.
    const bz = -d / 2 - Math.max(dk.back, 0) - 1.4;
    fence(g, -w / 2 - 4, w / 2 + 4, bz);
    for (let i = 0; i < Math.ceil((w + 6) / 1.1); i++) shrub(g, -w / 2 - 3 + i * 1.1 + rnd() * 0.3, bz + 0.6, 0.38 + rnd() * 0.22, 40 + i);
    tree(g, -w / 2 - 2.2, -d / 2 - 0.4, 3.6, 7);
    tree(g, w / 2 + 2.6, -d / 2 - 1.1, 3.0, 9);
    shrub(g, -w / 2 - 1.1 - Math.max(dk.left, 0), d / 2 - 0.2, 0.5, 21);
  }
  // Potted olives either side of the main doors, as in the photographs.
  const potZ = d / 2 + (dk.front > 0 ? Math.min(dk.front - 0.3, 0.5) : 0.35) + 0.05;
  const potY = dk.front > 0 ? 0.1 : 0;
  const pots = new THREE.Group();
  pots.position.y = potY;
  pottedOlive(pots, -w / 2 + 0.35 + (c.overhang.front > 0 ? 0.15 : 0), potZ, 3);
  if (w > 2.4) pottedOlive(pots, w / 2 - 0.35 - (c.overhang.front > 0 ? 0.15 : 0), potZ, 5);
  g.add(pots);
  return g;
}

// Soft contact shadow under the building footprint.
export function contactShadow(c) {
  const size = 256,
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(0,0,0,.42)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  material.userData.disposable = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(c.width + 1.2, c.depth + 1.2), material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.003;
  m.renderOrder = 1;
  return m;
}
