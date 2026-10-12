import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Box, DoorOpen, LayoutGrid, Minus, Plus, Moon, Sun, Ruler, RotateCcw, Maximize2, Minimize2, CircleHelp, Undo2, Redo2, Move3D } from "lucide-react";
import { area, fmtM } from "../catalog.js";
import * as diag from "../scene/diagnostics.js";
import { boot, log, errorDetail, probeWebGL } from "../scene/diagnostics.js";

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
const query = (k) => {
  try {
    return new URLSearchParams(location.search).get(k);
  } catch {
    return null;
  }
};
// Phones and tablets get the lighter tier; very low-memory devices the lightest.
function pickQuality(level) {
  if (level === 1) return "low";
  const memory = navigator.deviceMemory;
  if (memory && memory <= 2) return "low";
  return coarse() || Math.min(window.innerWidth, window.innerHeight) < 900 ? "medium" : "high";
}
const FAILURES = {
  "no-webgl": {
    title: "3D graphics are switched off in this browser.",
    body: "Your choices still save as you go, and your PDF design pack shows every detail. To see your room in 3D, open this page in Chrome or Safari, turn off Lockdown Mode for this site on iPhone, or switch on graphics acceleration in your browser settings.",
    action: "Try again",
  },
  import: { title: "We couldn't load the 3D designer.", body: "Check your connection, then try again. Your design is saved on this device.", action: "Reload the 3D view", reload: true },
  lost: { title: "Your device paused the 3D view to save memory.", body: "Your design is safe. Tap below to bring it back.", action: "Show my room in 3D" },
  crash: { title: "This device's graphics couldn't run the 3D view.", body: "Even the simplified 3D view stopped. Your design is saved, every option still works, and your PDF design pack shows every detail.", action: "Try again" },
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
  const [mode, setMode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const debug = query("debug3d") === "1";
  const [, setTick] = useState(0);
  const life = useRef({ disposed: false, timer: null, okTimer: null, rebuilds: 0, gen: 0, mode: null, quality: null, losses: [] });
  viewRef.current = view;
  // The engine loads lazily; it must start from the latest state, not the first.
  latest.current = { config, lighting, dims };

  useImperativeHandle(ref, () => ({
    capturePack: (opts) => engine.current?.capturePack(opts) ?? Promise.resolve(null),
    ready: () => !!engine.current && !engine.current.lost,
  }));

  const fail = (why, err) => {
    life.current.gen++;
    teardown();
    setReason(why);
    setState("failed");
    log(`fail:${why}`, errorDetail(err));
    if (err) console.warn("3D view unavailable:", why, err?.message || err);
    diag.send(why, { mode: life.current.mode, quality: life.current.quality });
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "make_room_3d_failed", reason: why, mode: life.current.mode });
  };
  const teardown = () => {
    clearTimeout(life.current.timer);
    clearTimeout(life.current.okTimer);
    const e = engine.current;
    engine.current = null;
    if (window.__mr === e) window.__mr = null;
    try {
      e?.dispose();
    } catch (err) {
      log("dispose:error", errorDetail(err));
    }
    // Belt and braces: no canvas from an earlier attempt may stay behind.
    for (const c of host.current?.querySelectorAll("canvas") || []) {
      try {
        (c.getContext("webgl2") || c.getContext("webgl"))?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        /* already released */
      }
      c.remove();
    }
  };
  // Full 3D first; safe mode after a crash (this visit or the last one); the
  // photograph only when even safe mode cannot run.
  const firstMode = () => {
    const forced = query("safe3d");
    if (forced === "0") boot.forget();
    if (forced === "1") return "safe";
    const crashed = boot.previousCrash();
    if (crashed) {
      log("guard:previous-crash", crashed.mode);
      diag.send("previous-crash", { previousMode: crashed.mode });
      // Safe mode itself took the page down last time: show the photo
      // rather than risk a crash loop. "Try again" still offers 3D.
      if (crashed.mode === "safe") return "none";
      boot.rememberSafe();
      return "safe";
    }
    return boot.safeRemembered() ? "safe" : "normal";
  };
  // A crash anywhere in the 3D view lands here: step down, then give up.
  const onCrash = (kind, err) => {
    log("guard:crash", kind);
    boot.ok();
    if (life.current.mode !== "safe") {
      boot.rememberSafe();
      diag.send(`crash-${kind}`, { mode: life.current.mode, quality: life.current.quality, error: errorDetail(err) });
      start("safe");
    } else fail("crash", err);
  };
  // Builds (or rebuilds) the engine on a fresh canvas. Every await is followed
  // by a generation check, so an older start can never install a second engine.
  const start = async (wanted) => {
    const gen = ++life.current.gen;
    teardown();
    setState("loading");
    life.current.mode = wanted || life.current.mode || firstMode();
    setMode(life.current.mode);
    log("start", life.current.mode);
    if (life.current.mode === "none") {
      boot.ok();
      return fail("crash", new Error("Previous visit crashed in safe mode"));
    }
    const gpu = probeWebGL();
    if (!gpu.level) return fail("no-webgl");
    let mod;
    for (let attempt = 0; !mod; attempt++) {
      try {
        mod = await import("../scene/engine.js");
      } catch (err) {
        if (attempt >= 1) return gen === life.current.gen && fail("import", err);
        await wait(1200);
      }
      if (gen !== life.current.gen || life.current.disposed) return;
    }
    const quality = life.current.mode === "safe" ? "safe" : (life.current.quality ||= pickQuality(gpu.level));
    boot.begin(life.current.mode);
    let e;
    try {
      e = new mod.Engine(host.current, overlay.current, {
        quality,
        onReady: () => {
          if (gen !== life.current.gen) return;
          setState("ready");
          log("first-frame");
          // Running cleanly for a few seconds clears the crash marker.
          life.current.okTimer = setTimeout(() => boot.ok(), 5000);
        },
        onLost: () => gen === life.current.gen && recover(),
        onRestored: () => {
          if (gen !== life.current.gen) return;
          clearTimeout(life.current.timer);
          setState("ready");
        },
        onCrash: (kind, err) => gen === life.current.gen && onCrash(kind, err),
      });
    } catch (err) {
      boot.ok();
      if (gen !== life.current.gen) return;
      // A context that was created (stage "init") proves WebGL works here: the
      // full renderer failed, so try safe mode. Only a context that could not be
      // made at all, in safe mode too, means 3D is unavailable.
      if (life.current.mode !== "safe") return onCrash(err.stage === "context" ? "context" : "init", err);
      return fail(err.stage === "context" ? "no-webgl" : "crash", err);
    }
    if (gen !== life.current.gen || life.current.disposed) return e.dispose();
    engine.current = e;
    window.__mr = e;
    try {
      e.setConfig(latest.current.config);
      e.setView(viewRef.current, { animate: false });
      e.setLighting(latest.current.lighting);
      e.setDims(latest.current.dims);
    } catch (err) {
      onCrash("scene", err);
    }
  };
  // The browser took the GPU back (tab hidden, screen locked, memory). Wait
  // for it to return the context; if it does not, rebuild on a new canvas.
  // Repeated losses in a short time are treated as a crash (safe mode).
  const recover = () => {
    const now = Date.now();
    life.current.losses = [...life.current.losses.filter((t) => now - t < 90000), now];
    if (life.current.losses.length > 2) return onCrash("context-loss", new Error(`${life.current.losses.length} context losses in 90s`));
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
        if (life.current.mode !== "safe") life.current.quality = life.current.rebuilds > 1 ? "low" : life.current.quality === "high" ? "medium" : life.current.quality;
        start();
      } else fail("lost");
    };
    life.current.timer = setTimeout(() => attempt(0), 1500);
  };
  const retry = () => {
    life.current.rebuilds = 0;
    life.current.losses = [];
    if (FAILURES[reason]?.reload) return location.reload();
    // After a crash, "Try again" gives full 3D one more chance.
    if (reason === "crash") {
      boot.forget();
      return start("normal");
    }
    start();
  };
  const fullAgain = () => {
    boot.forget();
    life.current.quality = null;
    start("normal");
  };
  const copyDetails = async () => {
    const text = JSON.stringify(diag.report({ state, reason, mode: life.current.mode, quality: life.current.quality, engine: engine.current?.debug?.() }), null, 1);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy these details", text);
    }
  };

  useEffect(() => {
    life.current.disposed = false;
    start();
    const refresh = debug ? setInterval(() => setTick((t) => t + 1), 1000) : null;
    // Leaving or hiding the page is not a crash: only a start that is killed
    // outright (tab or GPU process) leaves the marker behind.
    const clearMarker = () => boot.ok();
    const onVisibility = () => document.visibilityState === "hidden" && boot.ok();
    window.addEventListener("pagehide", clearMarker);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      life.current.disposed = true;
      life.current.gen++;
      clearInterval(refresh);
      window.removeEventListener("pagehide", clearMarker);
      document.removeEventListener("visibilitychange", onVisibility);
      teardown();
    };
    // The engine is created once; later changes flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Scene updates are guarded too: a device-specific throw falls back cleanly.
  const guarded = (fn) => {
    const e = engine.current;
    if (!e || e.crashed) return;
    try {
      fn(e);
    } catch (err) {
      onCrash("update", err);
    }
  };
  useEffect(() => guarded((e) => e.setConfig(config)), [config]);
  useEffect(() => guarded((e) => e.view !== view && e.setView(view)), [view]);
  useEffect(() => guarded((e) => e.setLighting(lighting)), [lighting]);
  useEffect(() => guarded((e) => e.setDims(dims)), [dims]);
  useEffect(() => {
    if (!focus?.spec) return;
    guarded((e) => {
      const v = e.focus(focus.spec);
      if (v !== viewRef.current) onView(v, { fromFocus: true });
    });
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
    if (ev.key !== "+" && ev.key !== "=" && ev.key !== "-") return;
    ev.preventDefault();
    guarded((e) => e.zoom(ev.key === "-" ? -1 : 1));
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
            <span className="viewer-fallback-actions">
              <button type="button" className="button button--primary button--sm" onClick={retry}>
                <RotateCcw size={15} /> {FAILURES[reason]?.action}
              </button>
              <button type="button" className="link-button" onClick={copyDetails}>
                {copied ? "Details copied" : "Copy details for our team"}
              </button>
            </span>
            <small>
              Code MR-3D-{String(reason).toUpperCase()}-{diag.sessionId}
            </small>
          </div>
        </div>
      )}
      {mode === "safe" && state === "ready" && (
        <p className="viewer-safe" role="status">
          Simplified 3D for this device.{" "}
          <button type="button" onClick={fullAgain}>
            Try full 3D
          </button>
        </p>
      )}
      {debug && (
        <pre className="viewer-debug" aria-hidden="true">
          {JSON.stringify(
            {
              state,
              reason,
              mode,
              quality: engine.current?.quality,
              webgl: engine.current?.webgl,
              gpu: probeWebGL().renderer,
              calls: engine.current?.renderer?.info?.render?.calls,
              code: diag.sessionId,
              events: diag.report().events.slice(-8).map((x) => `${x.t}s ${x.type}`),
            },
            null,
            1,
          )}
        </pre>
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
