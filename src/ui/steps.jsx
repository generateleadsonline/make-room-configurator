import React, { useMemo, useState } from "react";
import { BriefcaseBusiness, Dumbbell, Palette, Sofa, House, Trees, Info, ShieldCheck, Ruler, Plus, Trash2, ArrowLeftRight, Lightbulb, Moon, Sparkles, X, PhoneCall } from "lucide-react";
import {
  TYPES,
  USES,
  POPULAR_SIZES,
  WIDTHS,
  allowedDepths,
  area,
  fmtM,
  fmtMm,
  PLANNING_AREA,
  CLADDING,
  materialsFor,
  finishById,
  materialById,
  WALLS,
  WALL_LABELS,
  wallsFor,
  perWallCladding,
  wallLength,
  OVERHANG_RANGE,
  DECKING_RANGE,
  DECKING_COLOURS,
  OPENINGS,
  openingById,
  OPENING_MATERIALS,
  FRAME_COLOURS,
  findSlot,
  fitsAt,
  fitsWall,
  makeRoom,
  newOpeningId,
  EDGE_GAP,
  FLOORS,
  ELECTRICAL,
  TYPE_DEFAULT_FINISH,
  wallsOf,
  schedule,
} from "../catalog.js";
import { STEP_TIPS, usp } from "../content.js";
import { Section, Segmented, ChoiceCards, SwatchGrid, Stepper, rangeValues, Toggle, Tip } from "./controls.jsx";

const USE_ICONS = { office: <BriefcaseBusiness size={20} />, gym: <Dumbbell size={20} />, studio: <Palette size={20} />, multi: <Sofa size={20} /> };
const TYPE_ICONS = { garden: <Trees size={20} />, extension: <House size={20} /> };
const metres = (n) => `${Number(n).toFixed(2).replace(/0$/, "")}`;

function UspNote({ id }) {
  const u = usp(id);
  return (
    <div className="usp-note">
      <ShieldCheck size={18} />
      <span>
        <strong>{u.title}.</strong> {u.detail}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- 1. Size
export function SizeStep({ config, change, flash, onCustom }) {
  const depths = allowedDepths(config.width);
  const a = area(config);
  const setType = (type) =>
    change(
      (d) => {
        d.type = type;
        // The live tool opens an extension in Brickdale Blend, a garden room in Cedar.
        const keep = Object.values(d.cladding).every((f) => materialById(finishById(f).material).types.includes(type));
        if (!keep || type === "extension") d.cladding = wallsOf(TYPE_DEFAULT_FINISH[type]);
        return d;
      },
      { type: "size" },
      `type:${type}`,
    );
  return (
    <>
      <Section title="What are you building?" id="s-type">
        <ChoiceCards label="Building type" options={TYPES.map((t) => ({ ...t, icon: TYPE_ICONS[t.id] }))} value={config.type} onChange={setType} flash={flash?.startsWith("type:") ? flash.slice(5) : null} />
      </Section>
      <Section title="How will you use it?" aside="Sets the furniture" id="s-use">
        <ChoiceCards
          label="Use"
          options={USES.map((u) => ({ ...u, icon: USE_ICONS[u.id] }))}
          value={config.use}
          onChange={(use) => change((d) => ((d.use = use), d), { type: "furniture" }, `use:${use}`)}
          flash={flash?.startsWith("use:") ? flash.slice(4) : null}
        />
      </Section>
      <Section title="Choose your size" aside="External dimensions" id="s-size">
        <div className="popular" role="group" aria-label="Popular sizes">
          {POPULAR_SIZES.filter((p) => allowedDepths(p.width).includes(p.depth)).map((p) => {
            const on = p.width === config.width && p.depth === config.depth;
            return (
              <button key={p.label} type="button" className={`chip ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => change((d) => ((d.width = p.width), (d.depth = p.depth), d), { type: "size" }, "size")}>
                <strong>
                  {fmtM(p.width)} × {fmtM(p.depth)}
                </strong>
                <small>{p.label}</small>
              </button>
            );
          })}
        </div>
        <Stepper label="Width (front)" values={WIDTHS} value={config.width} onChange={(w) => change((d) => ((d.width = w), d), { type: "size" }, "size")} format={metres} unit="m" />
        <Stepper label="Length (side)" values={depths} value={config.depth} onChange={(v) => change((d) => ((d.depth = v), d), { type: "size" }, "size")} format={metres} unit="m" hint={depths.length < WIDTHS.length ? `Up to ${fmtM(depths.at(-1))} at this width` : null} />
        <div className="size-readout">
          <Ruler size={18} />
          <div>
            <strong>{a.toFixed(1)} m² footprint</strong>
            <span>Standard height 2.5m. Contact our team for custom heights.</span>
          </div>
        </div>
        {config.type === "garden" && a > PLANNING_AREA && (
          <p className="notice notice--warn" role="status">
            <Info size={17} />
            <span>Planning permission will be required if over 30 m². Our team will guide you through it.</span>
          </p>
        )}
        {config.type === "extension" && (
          <p className="notice" role="status">
            <Info size={17} />
            <span>Your extension joins the back of your house. Planning permission might be required; our team will check for you.</span>
          </p>
        )}
        <button type="button" className="link-button" onClick={onCustom}>
          <PhoneCall size={15} /> Don't see the size you need? We can arrange custom dimensions.
        </button>
      </Section>
      <UspNote id="planning" />
    </>
  );
}

// ---------------------------------------------------------------- 2. Exterior
function SideSizer({ label, sides, range, walls, onToggle, onSize, unit = "mm", focusType }) {
  return (
    <div className="side-sizer">
      <div className="side-toggles" role="group" aria-label={label}>
        {walls.map((w) => {
          const on = sides[w] > 0;
          return (
            <button key={w} type="button" className={`chip chip--wall ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => onToggle(w, !on)}>
              {on ? <X size={14} /> : <Plus size={14} />}
              {WALL_LABELS[w]}
            </button>
          );
        })}
      </div>
      {walls
        .filter((w) => sides[w] > 0)
        .map((w) => (
          <Stepper
            key={`${focusType}-${w}`}
            label={`${WALL_LABELS[w]} ${focusType === "overhang" ? "overhang" : "decking"}`}
            values={rangeValues(range.min, range.max, range.step)}
            value={sides[w]}
            onChange={(v) => onSize(w, v)}
            format={(v) => (unit === "mm" ? Math.round(v * 1000) : metres(v))}
            unit={unit}
          />
        ))}
    </div>
  );
}

export function ExteriorStep({ config, change, flash }) {
  const perWall = perWallCladding(config.type);
  const [wallSel, setWallSel] = useState("all");
  const target = perWall ? wallSel : "all";
  const walls = wallsFor(config.type);
  const finishIds = WALLS.map((w) => config.cladding[w]);
  const mixed = new Set(finishIds).size > 1;
  const currentFinish = finishById(target === "all" ? config.cladding.front : config.cladding[target]);
  const [material, setMaterial] = useState(currentFinish.material);
  const mats = materialsFor(config.type);
  const activeMaterial = mats.some((m) => m.id === material) ? material : mats[0].id;
  const m = materialById(activeMaterial);
  const chooseFinish = (id) =>
    change(
      (d) => {
        for (const w of target === "all" ? WALLS : [target]) d.cladding[w] = id;
        return d;
      },
      target === "all" ? { type: "size" } : { type: "wall", wall: target },
      `finish:${id}`,
    );
  return (
    <>
      <Section title="Exterior cladding" aside={perWall ? "Mix finishes wall by wall" : "One finish for the whole building"} id="s-clad">
        {perWall && (
          <Segmented
            label="Wall"
            size="sm"
            value={wallSel}
            onChange={(w) => {
              setWallSel(w);
              if (w !== "all") {
                setMaterial(finishById(config.cladding[w]).material);
                change((d) => d, { type: "wall", wall: w }, null, { silent: true });
              }
            }}
            options={[{ id: "all", label: "All walls" }, ...WALLS.map((w) => ({ id: w, label: WALL_LABELS[w] }))]}
          />
        )}
        <div className="material-tabs" role="tablist" aria-label="Cladding material">
          {mats.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={activeMaterial === x.id} className={activeMaterial === x.id ? "is-on" : ""} onClick={() => setMaterial(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <p className="material-detail">{m.detail}.</p>
        <SwatchGrid label={`${m.label} finishes`} options={m.finishes} value={target === "all" && mixed ? null : currentFinish.id} onChange={chooseFinish} flash={flash?.startsWith("finish:") ? flash.slice(7) : null} size={m.finishes.length > 8 ? "sm" : "md"} />
        <div className="selection-line">
          {target === "all" && mixed ? (
            <span>Mixed finishes. Choose one to apply it to every wall.</span>
          ) : (
            <>
              <strong>{currentFinish.label}</strong>
              <span>
                {materialById(currentFinish.material).label}
                {target !== "all" ? ` · ${WALL_LABELS[target]} wall` : perWall ? " · all walls" : ""}
              </span>
            </>
          )}
        </div>
        {currentFinish.note && <Tip icon={<Sparkles size={15} />}>{currentFinish.note}</Tip>}
      </Section>
      <Section title="Roof overhang" aside="300–600mm" id="s-overhang">
        <p className="section-intro">A deeper roof shelters your doors. On Make Room rooms the side walls carry forward to frame it, with a clad soffit above.</p>
        <SideSizer
          label="Overhang walls"
          walls={walls}
          sides={config.overhang}
          range={OVERHANG_RANGE}
          focusType="overhang"
          onToggle={(w, on) => change((d) => ((d.overhang[w] = on ? OVERHANG_RANGE.initial : 0), d), { type: "overhang", side: w }, `overhang:${w}`)}
          onSize={(w, v) => change((d) => ((d.overhang[w] = v), d), { type: "overhang", side: w }, `overhang:${w}`)}
        />
      </Section>
      <Section title="Decking" aside="600mm – 5m" id="s-deck">
        <SideSizer
          label="Decking walls"
          walls={walls}
          sides={config.decking}
          range={DECKING_RANGE}
          unit="m"
          focusType="decking"
          onToggle={(w, on) => change((d) => ((d.decking[w] = on ? DECKING_RANGE.initial : 0), d), { type: "decking", side: w }, `decking:${w}`)}
          onSize={(w, v) => change((d) => ((d.decking[w] = v), d), { type: "decking", side: w }, `decking:${w}`)}
        />
        {WALLS.some((w) => config.decking[w] > 0) && (
          <>
            <h4 className="sub-head">Decking colour</h4>
            <SwatchGrid
              label="Decking colour"
              size="sm"
              options={DECKING_COLOURS}
              value={config.deckingColour}
              onChange={(id) => change((d) => ((d.deckingColour = id), d), { type: "decking", side: WALLS.find((w) => config.decking[w] > 0) }, `deck:${id}`)}
              flash={flash?.startsWith("deck:") ? flash.slice(5) : null}
            />
          </>
        )}
      </Section>
      <Tip icon={<Info size={15} />}>{STEP_TIPS.cladding}</Tip>
    </>
  );
}

// ---------------------------------------------------------------- 3. Doors & windows
function WallStrip({ config, wall, selected, onSelect }) {
  const L = wallLength(config, wall),
    H = 2.5,
    W = 320,
    scale = W / L,
    h = H * scale,
    tags = Object.fromEntries(schedule(config).map((s) => [s.id, s.tag]));
  return (
    <svg className="wall-strip" viewBox={`-6 -6 ${W + 12} ${h + 24}`} role="img" aria-label={`${WALL_LABELS[wall]} wall, ${fmtM(L)} long`}>
      <rect x="0" y="0" width={W} height={h} rx="2" className="wall-strip-wall" style={{ fill: finishById(config.cladding[wall]).hex }} />
      <rect x="-3" y="-4" width={W + 6} height={0.216 * scale + 4} className="wall-strip-fascia" />
      {config.openings
        .filter((o) => o.wall === wall)
        .map((o) => {
          const p = openingById(o.product);
          const sill = p.kind === "door" ? 0 : p.height >= 1.9 ? 0.1 : 2.1 - p.height;
          const x = (o.offset - p.width / 2) * scale,
            y = h - (0.1 + sill + p.height) * scale;
          return (
            <g key={o.id} className={`wall-strip-opening ${selected === o.id ? "is-on" : ""}`} onClick={() => onSelect(o.id)} role="button" tabIndex={-1}>
              <rect x={x} y={y} width={p.width * scale} height={p.height * scale} />
              <text x={x + (p.width * scale) / 2} y={y + (p.height * scale) / 2 + 4} textAnchor="middle">
                {tags[o.id]}
              </text>
            </g>
          );
        })}
      <text x="0" y={h + 16} className="wall-strip-dim">
        0
      </text>
      <text x={W} y={h + 16} textAnchor="end" className="wall-strip-dim">
        {fmtM(L)}
      </text>
    </svg>
  );
}

function OpeningCard({ config, o, tag, selected, onSelect, change, onMoved }) {
  const p = openingById(o.product);
  const L = wallLength(config, o.wall);
  const lo = EDGE_GAP + p.width / 2,
    hi = L - EDGE_GAP - p.width / 2;
  const leftMm = Math.round((o.offset - p.width / 2) * 1000);
  const update = (fn, key) =>
    change(
      (d) => {
        const x = d.openings.find((y) => y.id === o.id);
        fn(x, d);
        return d;
      },
      { type: "opening", id: o.id },
      key || `opening:${o.id}`,
    );
  // Move to the nearest free position in the direction of travel.
  const moveTo = (centre) => {
    const target = Math.min(hi, Math.max(lo, centre));
    if (fitsAt(config, o.wall, o.product, target, o.id)) return update((x) => (x.offset = Math.round(target * 1000) / 1000));
    const slot = findSlot(config, o.wall, o.product, target, o.id);
    if (slot !== null) update((x) => (x.offset = slot));
  };
  const productKey = p.productKeys[o.material] || Object.values(p.productKeys)[0];
  return (
    <article className={`opening-card ${selected ? "is-on" : ""}`} onFocusCapture={onSelect} onPointerDown={onSelect}>
      <header>
        <img src={`/products/${productKey}.jpg`} alt="" width="56" height="56" loading="lazy" />
        <div>
          <span className="tag">{tag}</span>
          <strong>{p.label}</strong>
          <small>
            {fmtMm(p.width)} × {fmtMm(p.height)}
          </small>
        </div>
        <button type="button" className="icon-button" aria-label={`Remove ${tag} ${p.label}`} onClick={() => change((d) => ((d.openings = d.openings.filter((x) => x.id !== o.id)), d), { type: "wall", wall: o.wall }, null)}>
          <Trash2 size={17} />
        </button>
      </header>
      <div className="opening-controls">
        {p.materials.length > 1 && (
          <Segmented label="Frame material" size="sm" value={o.material} onChange={(mat) => update((x) => (x.material = mat))} options={p.materials.map((id) => ({ id, label: OPENING_MATERIALS[id] }))} />
        )}
        <div className="frame-colours" role="radiogroup" aria-label="Frame colour">
          {FRAME_COLOURS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={o.colour === f.id} className={o.colour === f.id ? "is-on" : ""} onClick={() => update((x) => (x.colour = f.id))}>
              <span style={{ background: f.hex }} />
              {f.label}
            </button>
          ))}
        </div>
        <div className="position">
          <label htmlFor={`pos-${o.id}`}>
            <ArrowLeftRight size={14} /> Left offset
          </label>
          <input
            id={`pos-${o.id}`}
            type="range"
            min={Math.round(lo * 1000)}
            max={Math.max(Math.round(lo * 1000), Math.round(hi * 1000))}
            step={10}
            value={Math.round(o.offset * 1000)}
            style={{ "--fill": `${hi > lo ? ((o.offset - lo) / (hi - lo)) * 100 : 0}%` }}
            aria-valuetext={`${leftMm} millimetres from the left of the ${WALL_LABELS[o.wall].toLowerCase()} wall`}
            onChange={(e) => moveTo(Number(e.target.value) / 1000)}
          />
          <output>{leftMm}mm</output>
        </div>
        <label className="move-wall">
          <span>Wall</span>
          <select
            value={o.wall}
            onChange={(e) => {
              const wall = e.target.value;
              const slot = findSlot({ ...config, openings: config.openings.filter((x) => x.id !== o.id) }, wall, o.product, undefined);
              if (slot === null) return;
              change(
                (d) => {
                  const x = d.openings.find((y) => y.id === o.id);
                  x.wall = wall;
                  x.offset = slot;
                  return d;
                },
                { type: "opening", id: o.id },
                `opening:${o.id}`,
              );
              // Follow the opening to its new wall so its card stays in view.
              onMoved?.(wall, o.id);
            }}
          >
            {wallsFor(config.type).map((w) => (
              <option key={w} value={w} disabled={w !== o.wall && findSlot({ ...config, openings: config.openings.filter((x) => x.id !== o.id) }, w, o.product, undefined) === null}>
                {WALL_LABELS[w]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

function Picker({ config, wall, kind, onPick, onClose }) {
  const list = OPENINGS.filter((p) => p.kind === kind);
  const L = wallLength(config, wall);
  return (
    <div className="picker" role="dialog" aria-label={`Add a ${kind} to the ${WALL_LABELS[wall].toLowerCase()} wall`}>
      <div className="picker-head">
        <strong>
          Add a {kind} · {WALL_LABELS[wall]} wall
        </strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="picker-grid">
        {list.map((p) => {
          const free = fitsWall(config, wall, p.id);
          const ok = free || !!makeRoom(config, wall, p.id, "probe");
          const need = p.width + EDGE_GAP * 2;
          const key = p.productKeys.alu || Object.values(p.productKeys)[0];
          return (
            <button key={p.id} type="button" className="picker-item" disabled={!ok} onClick={() => onPick(p.id)}>
              <img src={`/products/${key}.jpg`} alt="" loading="lazy" width="72" height="72" />
              <strong>{p.label}</strong>
              <small>
                {fmtMm(p.width)} × {fmtMm(p.height)}
              </small>
              <small className="picker-mat">{p.materials.map((m) => OPENING_MATERIALS[m]).join(" or ")}</small>
              {!ok && <em>{need > L ? `Needs a ${fmtM(Math.ceil(need * 100) / 100)} wall` : "Not enough wall left. Remove or resize another opening."}</em>}
              {ok && !free && <em className="picker-note">We'll slide the others along to fit it</em>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OpeningsStep({ config, change, wall, setWall }) {
  const walls = wallsFor(config.type);
  const active = walls.includes(wall) ? wall : walls[0];
  const [picker, setPicker] = useState(null);
  const [selected, setSelected] = useState(null);
  const tags = useMemo(() => Object.fromEntries(schedule(config).map((s) => [s.id, s.tag])), [config]);
  const onWall = config.openings.filter((o) => o.wall === active).sort((a, b) => a.offset - b.offset);
  const add = (product) => {
    const id = newOpeningId(config);
    const slot = findSlot(config, active, product, undefined);
    const room = slot === null ? makeRoom(config, active, product, id) : null;
    if (slot === null && !room) return;
    change(
      (d) => {
        const p = openingById(product);
        if (room) d.openings = room.openings;
        d.openings.push({ id, product, material: p.materials[0], colour: "black", wall: active, offset: room ? room.offset : slot });
        return d;
      },
      { type: "opening", id },
      `opening:${id}`,
    );
    setSelected(id);
    setPicker(null);
  };
  return (
    <>
      <Section title="Choose a wall" aside="Seen from outside" id="s-walls">
        <Segmented
          label="Wall"
          value={active}
          onChange={(w) => {
            setWall(w);
            setPicker(null);
            change((d) => d, { type: "wall", wall: w }, null, { silent: true });
          }}
          options={walls.map((w) => ({ id: w, label: WALL_LABELS[w], badge: config.openings.filter((o) => o.wall === w).length || null }))}
        />
        <WallStrip config={config} wall={active} selected={selected} onSelect={(id) => (setSelected(id), change((d) => d, { type: "opening", id }, null, { silent: true }))} />
      </Section>
      <Section title={`${WALL_LABELS[active]} wall`} aside={`${fmtM(wallLength(config, active))} long`} id="s-openings">
        {onWall.length === 0 && <p className="empty">No doors or windows on this wall yet. Add one below, or leave it solid for privacy and wall space.</p>}
        <div className="opening-list">
          {onWall.map((o) => (
            <OpeningCard
              key={o.id}
              config={config}
              o={o}
              tag={tags[o.id]}
              selected={selected === o.id}
              onSelect={() => setSelected(o.id)}
              change={change}
              onMoved={(w, id) => {
                setWall(w);
                setSelected(id);
                requestAnimationFrame(() => document.getElementById(`pos-${id}`)?.focus());
              }}
            />
          ))}
        </div>
        <div className="add-row">
          <button type="button" className="button button--ghost" onClick={() => setPicker(picker === "door" ? null : "door")} aria-expanded={picker === "door"}>
            <Plus size={16} /> Add a door
          </button>
          <button type="button" className="button button--ghost" onClick={() => setPicker(picker === "window" ? null : "window")} aria-expanded={picker === "window"}>
            <Plus size={16} /> Add a window
          </button>
        </div>
        {picker && <Picker config={config} wall={active} kind={picker} onPick={add} onClose={() => setPicker(null)} />}
        <p className="fine">A 100mm gap is kept between every door or window and the wall edges.</p>
      </Section>
      <Tip icon={<Info size={15} />}>{STEP_TIPS.openings}</Tip>
    </>
  );
}

// ---------------------------------------------------------------- 4. Interior
export function InteriorStep({ config, change, flash, lighting, setLighting }) {
  return (
    <>
      <Section title="Laminate flooring" id="s-floor">
        <SwatchGrid label="Flooring" options={FLOORS} value={config.floor} onChange={(id) => change((d) => ((d.floor = id), d), { type: "floor" }, `floor:${id}`)} flash={flash?.startsWith("floor:") ? flash.slice(6) : null} />
      </Section>
      <Section title="Electrical package" aside="Mains connection quoted separately" id="s-elec">
        <div className="packages" role="radiogroup" aria-label="Electrical package">
          {[{ id: "none", label: "No package", items: ["Add electrics later, or talk it through with our team"] }, ...ELECTRICAL].map((e) => {
            const on = config.electrical === e.id;
            return (
              <button key={e.id} type="button" role="radio" aria-checked={on} className={`package ${on ? "is-on" : ""} ${flash === `elec:${e.id}` ? "is-flash" : ""}`} onClick={() => change((d) => ((d.electrical = e.id), d), { type: "electrics" }, `elec:${e.id}`)}>
                <span className="package-head">
                  <Lightbulb size={17} />
                  <strong>{e.label}</strong>
                </span>
                <ul>
                  {e.items.map((i) => (
                    <li key={i}>{i.replace(/ +$/, "")}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        <button type="button" className="link-button" onClick={() => setLighting(lighting === "evening" ? "day" : "evening")}>
          <Moon size={15} /> {lighting === "evening" ? "Back to daylight" : "See your lighting at dusk"}
        </button>
      </Section>
      <UspNote id="insulated" />
    </>
  );
}
