import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Phone, PhoneCall, MapPin, BookOpen, Menu, X, ShieldCheck, Check } from "lucide-react";
import { DEFAULT_CONFIG, normalizeConfig, readSharedDesign, compactCode, openingById, WALL_LABELS, wallsFor } from "./catalog.js";
import { CONTACT, USPS, BROCHURE_URL } from "./content.js";
import { normaliseUkPhone } from "./validation.js";
import Viewer from "./ui/Viewer.jsx";
import { SizeStep, ExteriorStep, OpeningsStep, InteriorStep } from "./ui/steps.jsx";
import { PriceStep, checkLead } from "./ui/PriceStep.jsx";
import EnquiryDrawer from "./ui/EnquiryDrawer.jsx";
import Tour, { Welcome } from "./ui/Tour.jsx";

const STEPS = [
  { id: "size", label: "Size", title: "Start with the space you need.", intro: "Pick a garden room or a modular extension, then find your size." },
  { id: "exterior", label: "Exterior", title: "Choose your look.", intro: "Real Make Room finishes. Watch them change on your room." },
  { id: "openings", label: "Doors & windows", title: "Let the light in.", intro: "Add doors and windows to any wall, then slide them into place." },
  { id: "interior", label: "Interior", title: "Make yourself at home.", intro: "Flooring and lighting, seen from inside your room." },
  { id: "price", label: "Your price", title: "Your design. Your price.", intro: "See the price for exactly what you've designed, with a PDF pack to keep." },
];
const STORE = "make-room-design-v2";
const TOUR_KEY = "make-room-tour-v2";
const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: designs still work for this visit */
  }
};
const uuid = () =>
  crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16));
const track = (event, details = {}) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: `make_room_${event}`, ...details });
};
const STEP_FOCUS = [{ type: "size" }, { type: "overview" }, null, { type: "furniture" }, { type: "overview" }];

function initialConfig() {
  const shared = readSharedDesign();
  if (shared) return shared;
  try {
    const saved = JSON.parse(read(STORE) || "null");
    if (saved) return normalizeConfig(saved);
  } catch {
    /* ignore a damaged save */
  }
  return normalizeConfig(DEFAULT_CONFIG);
}

function Header({ onRequest, menuOpen, setMenuOpen }) {
  const ctas = (
    <>
      <button type="button" className="hdr-cta hdr-cta--primary" onClick={() => onRequest("callback")}>
        <PhoneCall size={16} /> Request a callback
      </button>
      <button type="button" className="hdr-cta" onClick={() => onRequest("visit")}>
        <MapPin size={16} /> Visit our show village
      </button>
      {BROCHURE_URL ? (
        <a className="hdr-cta" href={BROCHURE_URL} download>
          <BookOpen size={16} /> Download brochure
        </a>
      ) : (
        <button type="button" className="hdr-cta" onClick={() => onRequest("brochure")}>
          <BookOpen size={16} /> Get a brochure
        </button>
      )}
    </>
  );
  return (
    <header className="hdr">
      <a href={CONTACT.site} className="hdr-logo" aria-label="Make Room Outside Living home">
        <img src="/assets/make-room-logo.svg" alt="Make Room Outside Living" width="94" height="65" />
      </a>
      <p className="hdr-title">
        <strong>Design your room</strong>
        <span>3D designer</span>
      </p>
      <nav className="hdr-ctas" aria-label="Talk to Make Room" data-tour="ctas">
        {ctas}
        <a className="hdr-phone" href={CONTACT.phoneHref}>
          <Phone size={16} />
          <span>{CONTACT.phone}</span>
        </a>
      </nav>
      <div className="hdr-mobile">
        <a className="icon-button" href={CONTACT.phoneHref} aria-label={`Call ${CONTACT.phone}`}>
          <Phone size={19} />
        </a>
        <button type="button" className="icon-button" aria-expanded={menuOpen} aria-controls="hdr-menu" aria-label={menuOpen ? "Close menu" : "Talk to Make Room"} onClick={() => setMenuOpen(!menuOpen)} data-tour="ctas">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <div className="hdr-menu" id="hdr-menu">
          {ctas}
          <a className="hdr-cta" href={CONTACT.phoneHref}>
            <Phone size={16} /> Call {CONTACT.phone}
          </a>
        </div>
      )}
    </header>
  );
}

export default function App() {
  const [config, setConfig] = useState(initialConfig);
  const configRef = useRef(config);
  // Undo history lives in a ref so undo/redo read and write it synchronously;
  // `historyTick` re-renders the buttons.
  const undoStack = useRef({ past: [], future: [] });
  const [, setHistoryTick] = useState(0);
  const [step, setStep] = useState(0);
  const [view, setView] = useState("outside");
  const [lighting, setLighting] = useState("day");
  const [dims, setDims] = useState(false);
  const [focus, setFocus] = useState(null);
  const [flash, setFlash] = useState(null);
  const [openingWall, setOpeningWall] = useState("front");
  const [toast, setToast] = useState(null);
  // Links in the PDF can open a request form directly (?request=callback).
  const [drawer, setDrawer] = useState(() => {
    const r = new URLSearchParams(location.search).get("request");
    return ["callback", "book-call", "visit", "brochure"].includes(r) ? r : null;
  });
  const [tour, setTour] = useState(() => (read(TOUR_KEY) || new URLSearchParams(location.search).get("request") ? null : "welcome"));
  const [menuOpen, setMenuOpen] = useState(false);
  const [lead, setLead] = useState({ firstName: "", lastName: "", email: "", phone: "", postcode: "", timeline: "", budget: "", marketing: false });
  const [known, setKnown] = useState(null);
  const [quote, setQuote] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [shared, setShared] = useState(false);
  const viewer = useRef(null);
  const panel = useRef(null);
  const requestId = useRef(uuid());
  const toastTimer = useRef(null);
  const flashTimer = useRef(null);

  const say = useCallback((text, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 5200);
  }, []);
  const focusOn = useCallback((spec) => spec && setFocus((f) => ({ spec, n: (f?.n || 0) + 1 })), []);

  // Every design change goes through here: normalise, remember for undo,
  // turn the 3D view to the changed part and flash the chosen option.
  const change = useCallback(
    (mutator, spec, flashKey, opts = {}) => {
      if (opts.silent) return focusOn(spec);
      const prev = configRef.current;
      const draft = mutator(structuredClone(prev)) || structuredClone(prev);
      const next = normalizeConfig(draft);
      if (JSON.stringify(next) === JSON.stringify(prev)) return focusOn(spec);
      const lost = (draft.openings || []).filter((o) => !next.openings.some((n) => n.id === o.id));
      configRef.current = next;
      setConfig(next);
      undoStack.current = { past: [...undoStack.current.past.slice(-59), prev], future: [] };
      setHistoryTick((t) => t + 1);
      focusOn(spec);
      if (flashKey) {
        setFlash(flashKey);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 1400);
      }
      if (lost.length) {
        const names = lost.map((o) => `${openingById(o.product).label} (${WALL_LABELS[o.wall]})`).join(", ");
        const plural = lost.length > 1;
        if (next.type === "extension" && lost.every((o) => o.wall === "back")) say(`An extension's back wall joins your house, so we took out ${names}.`, true);
        else say(`${names} no longer ${plural ? "fit" : "fits"} at this size, so we took ${plural ? "them" : "it"} out.`, true);
      }
    },
    [focusOn, say],
  );
  const travel = useCallback(
    (direction) => {
      const { past, future } = undoStack.current;
      const current = configRef.current;
      if (direction < 0 && past.length) {
        configRef.current = past.at(-1);
        undoStack.current = { past: past.slice(0, -1), future: [current, ...future] };
      } else if (direction > 0 && future.length) {
        configRef.current = future[0];
        undoStack.current = { past: [...past, current], future: future.slice(1) };
      } else return;
      setConfig(configRef.current);
      setHistoryTick((t) => t + 1);
      focusOn({ type: "overview" });
    },
    [focusOn],
  );
  const undo = useCallback(() => travel(-1), [travel]);
  const redo = useCallback(() => travel(1), [travel]);

  useEffect(() => {
    write(STORE, JSON.stringify(config));
  }, [config]);
  // Share, QR and PDF links are read once; drop them so a reload keeps edits.
  useEffect(() => {
    const url = new URL(location.href);
    if (["d", "design", "request"].some((k) => url.searchParams.has(k))) {
      for (const k of ["d", "design", "request"]) url.searchParams.delete(k);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.target.closest?.("input, textarea, select")) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  // A returning visitor with a saved session sees their price straight away.
  useEffect(() => {
    track("started");
    fetch("/api/quote", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: configRef.current, requestId: uuid(), botField: "" }) })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        if (data.saved && data.quote) {
          setQuote(data.quote);
          setUnlocked(true);
        }
      })
      .catch(() => {});
  }, []);

  const go = (n) => {
    setStep(n);
    setError("");
    setMenuOpen(false);
    const spec = n === 2 ? { type: "wall", wall: wallsFor(config.type).includes(openingWall) ? openingWall : "front" } : STEP_FOCUS[n];
    if (n === 4 && view === "inside") setView("outside");
    focusOn(spec);
    track("step_viewed", { step: n + 1 });
    if (matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };

  const quoteCurrent = !!quote && JSON.stringify(quote.config) === JSON.stringify(config);
  const submit = async (e) => {
    e?.preventDefault();
    if (busy) return;
    if (!unlocked) {
      const errs = checkLead(lead);
      setFieldErrors(errs);
      if (Object.keys(errs).length) {
        setError("Please check the highlighted details.");
        requestAnimationFrame(() => document.getElementById(Object.keys(errs)[0])?.focus());
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const phone = normaliseUkPhone(lead.phone);
      const body = { config, botField: e?.target?.elements?.website?.value || "" };
      if (!unlocked) Object.assign(body, { lead: { ...lead, phone: phone.national, notes: "" }, requestId: requestId.current });
      const r = await fetch("/api/quote", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.saved || !data.quote) {
        const failure = new Error(data.session === false ? "Please add your details again to see your price." : data.error || "We couldn't save your design just now. Please try again.");
        failure.status = data.session === false ? 401 : r.status;
        failure.field = data.field;
        throw failure;
      }
      setQuote(data.quote);
      setUnlocked(true);
      if (!unlocked) setKnown({ ...lead, phone: phone.national });
      requestId.current = uuid();
      track("quote_unlocked");
    } catch (err) {
      if (err.status === 401 || err.status === 409) {
        if (err.status === 401) setUnlocked(false);
        requestId.current = uuid();
      }
      if (err.field) {
        setFieldErrors((f) => ({ ...f, [err.field]: err.message }));
        requestAnimationFrame(() => document.getElementById(err.field)?.focus());
      }
      setError(err.message || `We couldn't connect. Your design is saved on this device; please try again or call ${CONTACT.phone}.`);
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!quoteCurrent || pdfBusy) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const [{ buildDesignPack }, pack] = await Promise.all([import("./pdf.js"), viewer.current?.capturePack({ width: 2000, height: 1250 })]);
      const blob = await buildDesignPack({ quote, config, shots: pack?.shots || {}, meta: pack?.meta || {}, firstName: known?.firstName || lead.firstName });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Make-Room-${quote.reference}-design-pack.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      track("pdf_download");
      // Keep a copy with the saved enquiry for the sales team (best effort).
      if (blob.size < 4 * 1024 * 1024)
        fetch("/api/design-pack", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/pdf", "X-Design-Reference": quote.designReference }, body: blob }).catch(() => {});
    } catch (err) {
      console.warn("Design pack failed", err?.name, err?.message);
      setPdfError("We couldn't build your PDF just now. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  };
  const share = async () => {
    const url = `${location.origin}/configurator/?d=${compactCode(config)}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: "My Make Room design", url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
      track("design_shared");
    } catch {
      say("Sharing isn't available here. Your design is saved on this device.");
    }
  };
  const request = (topic) => {
    setMenuOpen(false);
    setDrawer(topic);
    track("request_open", { topic });
  };
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const onRequestSent = useCallback((t, who) => setKnown((k) => ({ ...(k || {}), ...who })), []);
  const endTour = () => {
    setTour(null);
    write(TOUR_KEY, "1");
  };

  const stepProps = { config, change, flash };
  const s = STEPS[step];
  return (
    <div className="app">
      <a className="skip" href="#panel">
        Skip to the design steps
      </a>
      <Header onRequest={request} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <ul className="usp-bar" aria-label="Why Make Room">
        {USPS.filter((u) => u.id !== "insulated").map((u) => (
          <li key={u.id} title={u.detail}>
            <Check size={14} strokeWidth={2.5} />
            {u.title}
          </li>
        ))}
      </ul>
      <main className="layout">
        <div className="stage">
          <Viewer
            ref={viewer}
            config={config}
            view={view}
            onView={(v) => setView(v)}
            lighting={lighting}
            onLighting={setLighting}
            dims={dims}
            onDims={setDims}
            focus={focus}
            onHelp={() => setTour("tour")}
            canUndo={undoStack.current.past.length > 0}
            canRedo={undoStack.current.future.length > 0}
            onUndo={undo}
            onRedo={redo}
          />
        </div>
        <section className="panel" id="panel" ref={panel} tabIndex={-1} aria-labelledby="step-title">
          <nav className="steps" aria-label="Design steps" data-tour="steps">
            {STEPS.map((x, i) => (
              <button key={x.id} type="button" className={`step-tab ${i === step ? "is-on" : ""} ${i < step ? "is-done" : ""}`} aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
                <span className="step-num">{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                <span className="step-label">{x.label}</span>
              </button>
            ))}
          </nav>
          <div className="panel-body" data-tour="panel">
            <header className="panel-head">
              <h2 id="step-title">{s.title}</h2>
              <p>{s.intro}</p>
            </header>
            {step === 0 && <SizeStep {...stepProps} onCustom={() => request("custom")} />}
            {step === 1 && <ExteriorStep {...stepProps} />}
            {step === 2 && <OpeningsStep {...stepProps} wall={openingWall} setWall={setOpeningWall} />}
            {step === 3 && <InteriorStep {...stepProps} lighting={lighting} setLighting={setLighting} />}
            {step === 4 && (
              <PriceStep
                config={config}
                quote={quote}
                quoteCurrent={quoteCurrent}
                unlocked={unlocked}
                lead={lead}
                setLead={setLead}
                busy={busy}
                error={error}
                fieldErrors={fieldErrors}
                setFieldErrors={setFieldErrors}
                onSubmit={submit}
                onUpdate={() => submit()}
                onPdf={downloadPdf}
                pdfBusy={pdfBusy}
                pdfError={pdfError}
                onRequest={request}
                onShare={share}
                shared={shared}
                onEdit={() => go(0)}
              />
            )}
          </div>
          <footer className="panel-foot">
            {step > 0 ? (
              <button type="button" className="button button--ghost" onClick={() => go(step - 1)}>
                <ArrowLeft size={17} /> <span className="hide-xs">Back</span>
              </button>
            ) : (
              <span className="autosave">
                <ShieldCheck size={15} /> Saved as you go
              </span>
            )}
            {step < 4 ? (
              <button type="button" className="button button--primary" onClick={() => go(step + 1)}>
                {step === 3 ? "See my price" : `Next: ${STEPS[step + 1].label}`} <ArrowRight size={17} />
              </button>
            ) : (
              <button type="button" className="button button--ghost" onClick={() => request("callback")}>
                <PhoneCall size={16} /> Request a callback
              </button>
            )}
          </footer>
        </section>
      </main>
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={() => (undo(), setToast(null))}>
              Undo
            </button>
          )}
        </div>
      )}
      {drawer && (
        <EnquiryDrawer
          topic={drawer}
          onTopic={setDrawer}
          onClose={closeDrawer}
          config={config}
          known={known || (lead.firstName ? lead : null)}
          onSent={onRequestSent}
        />
      )}
      {tour === "welcome" && <Welcome onStart={() => setTour("tour")} onSkip={endTour} />}
      {tour === "tour" && <Tour onClose={endTour} />}
    </div>
  );
}
