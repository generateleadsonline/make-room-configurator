import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Box, DoorOpen, LayoutGrid, Minus, Plus, Moon, Sun, Ruler, RotateCcw, Maximize2, Minimize2, CircleHelp, Undo2, Redo2, Move3D } from "lucide-react";
import { area, fmtM } from "../catalog.js";

const VIEWS = [
  { id: "outside", label: "Outside", icon: <Box size={16} /> },
  { id: "inside", label: "Inside", icon: <DoorOpen size={16} /> },
  { id: "plan", label: "Plan", icon: <LayoutGrid size={16} /> },
];
const HINTS = {
  outside: "Drag to turn · scroll or pinch to zoom",
  inside: "Drag to look around · scroll or pinch to zoom",
  plan: "Drag to move · scroll or pinch to zoom",
};
const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 2 = WebGL 2, 1 = WebGL 1 only, 0 = no 3D graphics in this browser.
function webglSupport() {
  try {
    for (const [name, level] of [
      ["webgl2", 2],
      ["webgl", 1],
      ["experimental-webgl", 1],
    ]) {
      const gl = document.createElement("canvas").getContext(name);
      if (gl) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return level;
      }
    }
  } catch {
    /* treated as no WebGL */
  }
  return 0;
}
// Phones and tablets get the lighter tier; very low-memory devices the lightest.
function pickQuality() {
  const memory = navigator.deviceMemory;
  if (memory && memory <= 2) return "low";
  return coarse() || Math.min(window.innerWidth, window.innerHeight) < 900 ? "medium" : "high";
}
const FAILURES = {
  "no-webgl": {
    title: "3D graphics are switched off in this browser.",
    body: "Your choices still save as you go, and your PDF design pack shows every detail. To see your room in 3D, open this page in Safari or Chrome, turn off Lockdown Mode for this site on iPhone, or switch on graphics acceleration in your browser settings.",
    action: "Try again",
  },
  import: { title: "We couldn't load the 3D designer.", body: "Check your connection, then try again. Your design is saved on this device.", action: "Reload the 3D view", reload: true },
  lost: { title: "Your device paused the 3D view to save memory.", body: "Your design is safe. Tap below to bring it back.", action: "Show my room in 3D" },
  error: { title: "Something stopped the 3D view.", body: "Your design is saved on this device. Try again, or carry on: your PDF design pack shows every detail.", action: "Try again" },
};

// The 3D stage and its tools. The engine loads lazily so the panel is usable
// at once; if WebGL fails the stage shows a real Make Room photograph.
const Viewer = forwardRef(function Viewer({ config, view, onView, lighting, onLighting, dims, onDims, focus, onHelp, canUndo, canRedo, onUndo, onRedo }, ref) {
  const host = useRef(null),
    overlay = useRef(null),
    stage = useRef(null),
    engine = useRef(null),
    viewRef = useRef(view),
    latest = useRef({ config, lighting, dims });
  const [state, setState] = useState("loading");
  const [reason, setReason] = useState(null);
  const [full, setFull] = useState(false);
  const life = useRef({ disposed: false, timer: null, rebuilds: 0, quality: null });
  viewRef.current = view;
  // The engine loads lazily; it must start from the latest state, not the first.
  latest.current = { config, lighting, dims };

  useImperativeHandle(ref, () => ({
    capturePack: (opts) => engine.current?.capturePack(opts) ?? Promise.resolve(null),
    ready: () => !!engine.current && !engine.current.lost,
  }));

  const fail = (why, err) => {
    setReason(why);
    setState("failed");
    if (err) console.warn("3D view unavailable:", why, err?.message || err);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "make_room_3d_failed", reason: why });
  };
  const teardown = () => {
    clearTimeout(life.current.timer);
    engine.current?.dispose();
    engine.current = null;
  };
  // Builds (or rebuilds) the engine on a fresh canvas.
  const start = async () => {
    teardown();
    setState("loading");
    const support = webglSupport();
    if (!support) return fail("no-webgl");
    let mod;
    for (let attempt = 0; !mod; attempt++) {
      try {
        mod = await import("../scene/engine.js");
      } catch (err) {
        if (attempt >= 1) return fail("import", err);
        await wait(1200);
      }
    }
    if (life.current.disposed) return;
    life.current.quality ||= support === 1 ? "low" : pickQuality();
    let e;
    try {
      e = new mod.Engine(host.current, overlay.current, {
        quality: life.current.quality,
        onReady: () => setState("ready"),
        onLost: () => recover(),
        onRestored: () => {
          clearTimeout(life.current.timer);
          setState("ready");
        },
      });
    } catch (err) {
      return fail(webglSupport() ? "error" : "no-webgl", err);
    }
    engine.current = e;
    window.__mr = e;
    try {
      e.setConfig(latest.current.config);
      e.setView(viewRef.current, { animate: false });
      e.setLighting(latest.current.lighting);
      e.setDims(latest.current.dims);
    } catch (err) {
      // A device that cannot build the full scene retries once at the lightest tier.
      teardown();
      if (life.current.quality !== "low") {
        life.current.quality = "low";
        return start();
      }
      return fail("error", err);
    }
  };
  // The browser took the GPU back (tab hidden, screen locked, memory). Wait
  // for it to return the context; if it does not, rebuild on a new canvas.
  const recover = () => {
    setState("restoring");
    clearTimeout(life.current.timer);
    const attempt = (stage) => {
      const e = engine.current;
      if (!e || !e.lost || life.current.disposed) return;
      if (document.visibilityState === "hidden") {
        life.current.timer = setTimeout(() => attempt(stage), 1000);
        return;
      }
      if (stage === 0) {
        try {
          e.loseExtension?.restoreContext();
        } catch {
          /* only possible for some losses; browsers restore the rest themselves */
        }
        life.current.timer = setTimeout(() => attempt(1), 2500);
      } else if (life.current.rebuilds < 3) {
        life.current.rebuilds++;
        // Memory pressure is the usual cause: step down a tier, and to the
        // lightest one if the device keeps reclaiming the context.
        life.current.quality = life.current.rebuilds > 1 ? "low" : life.current.quality === "high" ? "medium" : life.current.quality;
        start();
      } else fail("lost");
    };
    life.current.timer = setTimeout(() => attempt(0), 1500);
  };

  useEffect(() => {
    life.current.disposed = false;
    start();
    return () => {
      life.current.disposed = true;
      teardown();
    };
    // The engine is created once; later changes flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    engine.current?.setConfig(config);
  }, [config]);
  useEffect(() => {
    const e = engine.current;
    if (e && e.view !== view) e.setView(view);
  }, [view]);
  useEffect(() => {
    engine.current?.setLighting(lighting);
  }, [lighting]);
  useEffect(() => {
    engine.current?.setDims(dims);
  }, [dims]);
  useEffect(() => {
    const e = engine.current;
    if (!e || !focus?.spec) return;
    const v = e.focus(focus.spec);
    if (v !== viewRef.current) onView(v, { fromFocus: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (stage.current?.requestFullscreen) stage.current.requestFullscreen().catch(() => setFull((f) => !f));
    else setFull((f) => !f);
  };
  const onKey = (ev) => {
    const e = engine.current;
    if (!e) return;
    if (ev.key === "+" || ev.key === "=") e.zoom(1);
    else if (ev.key === "-") e.zoom(-1);
    else return;
    ev.preventDefault();
  };

  return (
    <div ref={stage} className={`viewer ${full ? "is-full" : ""} ${lighting === "evening" ? "is-evening" : ""}`} data-tour="viewer">
      <div
        ref={host}
        className="viewer-host"
        role="img"
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={`3D view of your ${fmtM(config.width)} by ${fmtM(config.depth)} ${config.type === "extension" ? "modular extension" : "garden room"}, ${view} view. Use plus and minus to zoom.`}
      />
      <div ref={overlay} className="viewer-labels" aria-hidden="true" />
      {state === "loading" && (
        <div className="viewer-loading" role="status">
          <span className="viewer-spinner" />
          Building your room in 3D…
        </div>
      )}
      {state === "restoring" && (
        <div className="viewer-loading viewer-loading--soft" role="status">
          <span className="viewer-spinner" />
          Reconnecting your 3D view…
        </div>
      )}
      {state === "failed" && (
        <div className="viewer-fallback" role="alert">
          <img src="/assets/real-room.webp" alt="A finished Make Room garden room" />
          <div className="viewer-fallback-card">
            <strong>{FAILURES[reason]?.title}</strong>
            <span>{FAILURES[reason]?.body}</span>
            <button
              type="button"
              className="button button--primary button--sm"
              onClick={() => {
                if (FAILURES[reason]?.reload) location.reload();
                else {
                  life.current.rebuilds = 0;
                  start();
                }
              }}
            >
              <RotateCcw size={15} /> {FAILURES[reason]?.action}
            </button>
            <small>Code MR-3D-{String(reason).toUpperCase()}</small>
          </div>
        </div>
      )}
      <div className="viewer-top">
        <div className="viewer-views" role="radiogroup" aria-label="View" data-tour="views">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={view === v.id} className={view === v.id ? "is-on" : ""} onClick={() => onView(v.id)}>
              {v.icon}
              <span>{v.label}</span>
            </button>
          ))}
        </div>
        <div className="viewer-tools" data-tour="tools">
          <button type="button" className="tool" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo">
            <Undo2 size={17} />
          </button>
          <button type="button" className="tool" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo">
            <Redo2 size={17} />
          </button>
          <button type="button" className={`tool ${lighting === "evening" ? "is-on" : ""}`} aria-pressed={lighting === "evening"} onClick={() => onLighting(lighting === "evening" ? "day" : "evening")} title={lighting === "evening" ? "Daylight" : "See it at dusk"} aria-label={lighting === "evening" ? "Show daylight" : "Show at dusk with lights on"}>
            {lighting === "evening" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button type="button" className={`tool ${dims ? "is-on" : ""}`} aria-pressed={dims} onClick={() => onDims(!dims)} title="Measurements" aria-label="Show measurements">
            <Ruler size={17} />
          </button>
          <button type="button" className="tool" onClick={onHelp} title="How it works" aria-label="How the designer works">
            <CircleHelp size={17} />
          </button>
          <button type="button" className="tool hide-coarse" onClick={toggleFull} title={full ? "Exit full screen" : "Full screen"} aria-label={full ? "Exit full screen" : "Full screen"}>
            {full ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      <div className="viewer-bottom">
        <div className="viewer-summary">
          <strong>
            {fmtM(config.width)} × {fmtM(config.depth)}
          </strong>
          <span>{area(config).toFixed(1)} m²</span>
          <span className="viewer-hint">
            <Move3D size={14} />
            {HINTS[view]}
          </span>
        </div>
        <div className="viewer-zoom" data-tour="zoom">
          <button type="button" className="tool" onClick={() => engine.current?.zoom(-1)} aria-label="Zoom out" title="Zoom out">
            <Minus size={18} />
          </button>
          <button type="button" className="tool" onClick={() => engine.current?.zoom(1)} aria-label="Zoom in" title="Zoom in">
            <Plus size={18} />
          </button>
          <button type="button" className="tool" onClick={() => engine.current?.resetView()} aria-label="Reset the view" title="Reset view">
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
      <p className="viewer-note">Illustration. Furniture and garden for inspiration.</p>
    </div>
  );
});
export default Viewer;
