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
  const [full, setFull] = useState(false);
  viewRef.current = view;
  // The engine loads lazily; it must start from the latest state, not the first.
  latest.current = { config, lighting, dims };

  useImperativeHandle(ref, () => ({
    capturePack: (opts) => engine.current?.capturePack(opts) ?? Promise.resolve(null),
    ready: () => !!engine.current,
  }));

  useEffect(() => {
    let disposed = false;
    import("../scene/engine.js")
      .then(({ Engine }) => {
        if (disposed) return;
        try {
          const small = coarse() && Math.min(window.innerWidth, window.innerHeight) < 900;
          const e = new Engine(host.current, overlay.current, { quality: small ? "medium" : "high", onReady: () => setState("ready") });
          engine.current = e;
          window.__mr = e;
          e.setConfig(latest.current.config);
          e.setView(viewRef.current, { animate: false });
          e.setLighting(latest.current.lighting);
          e.setDims(latest.current.dims);
          e.renderer.domElement.addEventListener("webglcontextlost", (ev) => {
            ev.preventDefault();
            setState("failed");
          });
        } catch {
          setState("failed");
        }
      })
      .catch(() => setState("failed"));
    return () => {
      disposed = true;
      engine.current?.dispose();
      engine.current = null;
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
      {state === "failed" && (
        <div className="viewer-fallback" role="status">
          <img src="/assets/real-room.webp" alt="A finished Make Room garden room" />
          <p>
            <strong>3D isn't available on this device.</strong> Your choices still save as you go, and your design pack shows every detail.
          </p>
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
