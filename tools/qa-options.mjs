// Browser QA: builds every option into the live 3D engine and checks the right
// part of the building changed. Run on the dev server from the console:
//   const r = await (await import('/tools/qa-options.mjs')).run(window.__mr)
import * as m from "/src/catalog.js";
import * as tex from "/src/scene/textures.js";

export async function run(e, { log = () => {} } = {}) {
  const base = m.normalizeConfig(m.DEFAULT_CONFIG);
  const fails = [];
  let checks = 0;
  const ok = (cond, msg) => {
    checks++;
    if (!cond) fails.push(msg);
  };
  const find = (name) => {
    let r = null;
    e.building.traverse((o) => {
      if (!r && o.name === name) r = o;
    });
    return r;
  };
  const all = (prefix) => {
    const r = [];
    e.building.traverse((o) => o.name?.startsWith(prefix) && r.push(o));
    return r;
  };
  const size = (mesh) => {
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    return { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const saved = e.config;

  // 1. Every finish on every wall of every building type that offers it.
  for (const f of m.FINISHES) {
    for (const type of m.materialById(f.material).types) {
      e.setConfig(m.normalizeConfig({ ...base, type, cladding: m.wallsOf(f.id) }));
      for (const w of m.wallsFor(type)) ok(find(`cladding:${w}`)?.material === tex.claddingMaterial(f.id), `finish ${f.id} missing on ${type} ${w}`);
      if (type === "extension") ok(!find("cladding:back"), "extension back wall is clad (it is the house wall)");
    }
    await tick();
  }
  log("finishes");
  {
    const c = m.normalizeConfig({ ...base, cladding: { front: "slatted-midnight", back: "cedar", left: "plank-c74", right: "steel-black" } });
    e.setConfig(c);
    for (const w of m.WALLS) ok(find(`cladding:${w}`).material === tex.claddingMaterial(c.cladding[w]), `per-wall cladding ${w}`);
  }
  // Materials not offered on a type are refused.
  ok(m.normalizeConfig({ ...base, type: "extension", cladding: m.wallsOf("steel-black") }).cladding.front !== "steel-black", "steel allowed on an extension");
  ok(m.normalizeConfig({ ...base, type: "garden", cladding: m.wallsOf("brick-keswick") }).cladding.front !== "brick-keswick", "brick allowed on a garden room");

  // 2. Every door and window, in every frame material and colour, on every wall.
  for (const p of m.OPENINGS) {
    for (const material of p.materials)
      for (const col of m.FRAME_COLOURS) {
        const c = m.normalizeConfig({ ...base, width: 10.2, depth: 2.8, openings: [{ id: "q1", product: p.id, material, colour: col.id, wall: "front", offset: 5 }] });
        ok(c.openings.length === 1, `${p.id} would not fit a 10.2m wall`);
        if (!c.openings.length) continue;
        e.setConfig(c);
        const g = find("opening:q1");
        ok(!!g, `${p.id} ${material} ${col.id} not built`);
        if (!g) continue;
        // Frame width matches the catalogue width.
        let minX = Infinity,
          maxX = -Infinity;
        g.traverse((o) => {
          if (!o.isMesh || o.material?.transmission) return;
          o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          minX = Math.min(minX, o.position.x + bb.min.x);
          maxX = Math.max(maxX, o.position.x + bb.max.x);
        });
        ok(maxX - minX >= p.width - 0.001 && maxX - minX <= p.width + 0.08, `${p.id} frame ${(maxX - minX).toFixed(3)} vs ${p.width}`);
        let colourHit = false;
        g.traverse((o) => {
          if (o.isMesh && o.material?.metalness === 0.55) colourHit ||= o.material === g.children[0].material;
        });
        ok(colourHit, `${p.id} frame colour material missing`);
      }
    await tick();
  }
  // Colour actually differs between black and anthracite.
  {
    const mk = (colour) => {
      e.setConfig(m.normalizeConfig({ ...base, openings: [{ id: "q1", product: "single-door", material: "alu", colour, wall: "front", offset: 1 }] }));
      return find("opening:q1").children[0].material.color.getHexString();
    };
    ok(mk("black") !== mk("anthracite"), "black and anthracite frames look the same");
  }
  // Placement on each wall, and refusal where a wall is too short.
  for (const w of m.WALLS) {
    const c = m.normalizeConfig({ ...base, openings: [{ id: "q1", product: "french-door", material: "alu", colour: "black", wall: w, offset: 1 }] });
    e.setConfig(c);
    ok(!!find("opening:q1") && find(`wall:${w}`).children.includes(find("opening:q1")), `opening not on ${w} wall`);
  }
  ok(m.normalizeConfig({ ...base, width: 2.8, depth: 2.1, openings: [{ id: "q1", product: "bifold-4", material: "alu", wall: "front", offset: 1.4 }] }).openings.length === 0, "a 3.45m bifold accepted on a 2.8m wall");
  ok(m.normalizeConfig({ ...base, type: "extension", openings: [{ id: "q1", product: "single-door", material: "alu", wall: "back", offset: 1 }] }).openings.length === 0, "extension accepts a back-wall opening");
  log("openings");

  // 3. Overhang and decking on every wall at both ends of their ranges.
  for (const w of m.WALLS) {
    for (const v of [m.OVERHANG_RANGE.min, m.OVERHANG_RANGE.max]) {
      const c = m.normalizeConfig({ ...base, overhang: { front: 0, back: 0, left: 0, right: 0, [w]: v } });
      e.setConfig(c);
      ok(!!find(`soffit:${w}`), `no soffit under ${w} overhang`);
      ok(all("wing:").length === 2, `${w} overhang should carry two walls forward, got ${all("wing:").length}`);
      const b = e.building.userData.roofBounds;
      const ext = { front: b.z1 - c.depth / 2, back: -c.depth / 2 - b.z0, left: -c.width / 2 - b.x0, right: b.x1 - c.width / 2 }[w];
      ok(Math.abs(ext - (v + 0.035)) < 0.002, `${w} overhang ${v}m built as ${ext.toFixed(3)}m`);
    }
    for (const v of [m.DECKING_RANGE.min, m.DECKING_RANGE.max]) {
      const c = m.normalizeConfig({ ...base, decking: { front: 0, back: 0, left: 0, right: 0, [w]: v } });
      e.setConfig(c);
      const d = find(`deck:${w}`);
      ok(!!d, `no ${w} deck`);
      if (d) {
        const s = size(d);
        const proj = w === "front" || w === "back" ? s.z : s.x;
        ok(Math.abs(proj - v) < 0.002, `${w} deck ${v}m built as ${proj.toFixed(3)}m`);
        ok(Math.abs(s.y - 0.1) < 0.001, `${w} deck not 100mm thick`);
      }
    }
  }
  ok(m.normalizeConfig({ ...base, type: "extension", overhang: { front: 0, back: 0.4, left: 0, right: 0 } }).overhang.back === 0, "extension accepts a back overhang");
  for (const dc of m.DECKING_COLOURS) {
    e.setConfig(m.normalizeConfig({ ...base, deckingColour: dc.id }));
    ok(find("deck:front")?.material === tex.deckingMaterial(dc.id), `decking colour ${dc.id}`);
  }
  log("overhang/decking");

  // 4. Floors and electrical packages.
  for (const f of m.FLOORS) {
    e.setConfig(m.normalizeConfig({ ...base, floor: f.id }));
    ok(find("floor").material === tex.floorMaterial(f.id), `floor ${f.id}`);
  }
  for (const id of ["none", ...m.ELECTRICAL.map((x) => x.id)]) {
    e.setConfig(m.normalizeConfig({ ...base, electrical: id }));
    const L = e.building.userData.ctx.lights,
      exp = m.electricalById(id);
    const downs = L.lamps.filter((l) => l.geometry.type === "CylinderGeometry" && l.geometry.parameters.radiusTop === 0.045).length;
    const soffit = L.lamps.filter((l) => l.geometry.type === "CylinderGeometry" && l.geometry.parameters.radiusTop === 0.035).length;
    const wallLights = L.lamps.filter((l) => l.geometry.type === "CircleGeometry").length / 2;
    ok(downs === exp.downlights, `${id}: ${downs} downlights, expected ${exp.downlights}`);
    ok(soffit === exp.soffitLights, `${id}: ${soffit} external downlights, expected ${exp.soffitLights}`);
    ok(wallLights === exp.upDown, `${id}: ${wallLights} up/down lights, expected ${exp.upDown}`);
  }
  log("interior");

  // 5. Building type, use and every legal size.
  for (const u of m.USES) {
    e.setConfig(m.normalizeConfig({ ...base, use: u.id }));
    ok(find("furniture").children.length > 0, `no furniture for ${u.id}`);
  }
  e.setConfig(m.normalizeConfig({ ...base, type: "extension" }));
  let house = false;
  e.landscape.traverse((o) => (house ||= o.name === "house"));
  ok(house, "no house wall behind the extension");
  let sizes = 0;
  for (const w of m.WIDTHS)
    for (const d of m.allowedDepths(w)) {
      sizes++;
      e.setConfig(m.normalizeConfig({ ...base, width: w, depth: d }));
      const bw = size(find("cladding:front")).x,
        bd = size(find("cladding:left")).x;
      ok(Math.abs(bw - w) < 0.001 && Math.abs(bd - d) < 0.001, `size ${w} x ${d} built as ${bw.toFixed(3)} x ${bd.toFixed(3)}`);
      if (sizes % 20 === 0) await tick();
    }
  e.setConfig(saved);
  return { checks, sizes, failCount: fails.length, fails: fails.slice(0, 40) };
}
