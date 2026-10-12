import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, normalizeConfig, compactCode, readCompactCode, designCode, readDesignCode, makeRoom, fitsWall, findSlot, wallsOf, openingById } from "../src/catalog.js";

const base = normalizeConfig(DEFAULT_CONFIG);
const withoutIds = (c) => ({ ...c, openings: c.openings.map(({ id, ...o }) => o) });

test("compact design links round-trip every choice and stay short", () => {
  const busy = normalizeConfig({
    ...base,
    cladding: { front: "slatted-midnight", back: "cedar", left: "plank-c74", right: "steel-black" },
    electrical: "none",
    openings: [...base.openings, { id: "x", product: "fixed-450x2000", material: "upvc", colour: "black", wall: "left", offset: 1 }],
    decking: { front: 1.2, back: 0, left: 0.8, right: 0 },
  });
  for (const c of [base, busy]) {
    const code = compactCode(c);
    assert.ok(code.length < 200, `code is ${code.length} characters`);
    assert.deepEqual(withoutIds(readCompactCode(code)), withoutIds(c));
  }
  assert.equal(readCompactCode("1~g"), null);
  assert.deepEqual(readDesignCode(designCode(base)), base);
});

test("old v1 share links open as the nearest v2 design", () => {
  const v1 = { use: "gym", type: "garden", width: 4, depth: 2.8, cladding: "plank", claddingColor: "charcoal", floor: "walnut", doors: "sliding", windows: "both", electrical: "upgrade", overhang: ["front"], decking: ["front"] };
  const c = normalizeConfig(v1);
  assert.equal(c.v, 2);
  assert.equal(c.cladding.front, "plank-c74");
  assert.deepEqual(c.openings.map((o) => [o.product, o.wall]), [["slider-2-mid", "front"], ["tov100-900x1000", "left"], ["tov100-900x1000", "right"]]);
  assert.equal(c.overhang.front, 0.3);
  assert.equal(c.decking.front, 0.6);
});

test("a full wall makes room by sliding openings along, never overlapping", () => {
  assert.equal(fitsWall(base, "front", "fixed-450x2000"), false);
  const room = makeRoom(base, "front", "fixed-450x2000", "new");
  assert.ok(room);
  const next = normalizeConfig({ ...base, openings: [...room.openings, { id: "new", product: "fixed-450x2000", material: "alu", colour: "black", wall: "front", offset: room.offset }] });
  assert.equal(next.openings.length, 3);
  const front = next.openings.filter((o) => o.wall === "front").sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < front.length; i++) {
    const gap = front[i].offset - openingById(front[i].product).width / 2 - (front[i - 1].offset + openingById(front[i - 1].product).width / 2);
    assert.ok(gap >= 0.1 - 1e-9, `gap ${gap}`);
  }
  assert.equal(makeRoom(base, "front", "fixed-900x2000", "new"), null);
});

test("extensions follow the live tool: one cladding, no back wall options, brick allowed, steel not", () => {
  const c = normalizeConfig({ ...base, type: "extension", cladding: { front: "brick-keswick", back: "cedar", left: "cedar", right: "cedar" }, overhang: { front: 0.3, back: 0.5, left: 0, right: 0 }, openings: [{ id: "a", product: "single-door", material: "alu", wall: "back", offset: 1 }] });
  assert.deepEqual(c.cladding, wallsOf("brick-keswick"));
  assert.equal(c.overhang.back, 0);
  assert.equal(c.openings.length, 0);
  assert.notEqual(normalizeConfig({ ...base, type: "extension", cladding: wallsOf("steel-black") }).cladding.front, "steel-black");
  assert.notEqual(normalizeConfig({ ...base, cladding: wallsOf("brick-kingston") }).cladding.front, "brick-kingston");
});

test("shrinking the room keeps what still fits and drops what cannot", () => {
  const small = normalizeConfig({ ...base, width: 2.1, depth: 2.1 });
  assert.equal(small.openings.some((o) => o.product === "bifold-3"), false);
  assert.ok(findSlot(small, "front", "single-door") !== null);
});
