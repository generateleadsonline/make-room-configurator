import React, { useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X, Hand } from "lucide-react";

// A short, skippable walk-through shown on the first visit and from the help
// button. Each step spotlights a real control by its data-tour attribute.
const STEPS = [
  { target: "viewer", title: "This is your room, in 3D", body: "Drag to turn it round. Scroll, pinch or use the + and − buttons to zoom in and out." },
  { target: "views", title: "Outside, inside or plan", body: "Step inside to see the layout and light, or look down on the plan with its measurements." },
  { target: "steps", title: "Five simple steps", body: "Size, exterior, doors and windows, interior, then your price. Jump between them whenever you like." },
  { target: "panel", title: "Watch every change", body: "Each choice updates the model straight away, and the view turns to show you exactly what changed." },
  { target: "tools", title: "Handy tools", body: "Undo a change, see your room at dusk with the lights on, or show the measurements." },
  { target: "ctas", title: "Help whenever you want it", body: "Request a callback, plan a visit to our Halifax show village or ask for a brochure at any time." },
];

function rectOf(target) {
  const el = [...document.querySelectorAll(`[data-tour="${target}"]`)].find((x) => x.offsetParent !== null);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Welcome({ onStart, onSkip }) {
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <Hand size={26} />
        <h2 id="welcome-title">Design your Make Room in 3D</h2>
        <p>Choose your size, cladding, doors and windows, and see the price for exactly what you've designed. Want a 30-second tour first?</p>
        <div className="welcome-actions">
          <button type="button" className="button button--primary" onClick={onStart} autoFocus>
            Show me how <ArrowRight size={16} />
          </button>
          <button type="button" className="button button--ghost" onClick={onSkip}>
            I'll explore myself
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tour({ onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = STEPS[i];
  useLayoutEffect(() => {
    const el = [...document.querySelectorAll(`[data-tour="${step.target}"]`)].find((x) => x.offsetParent !== null);
    el?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    const update = () => setRect(rectOf(step.target));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step.target]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(STEPS.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const vw = window.innerWidth,
    vh = window.innerHeight,
    pad = 8;
  const hole = rect && { top: Math.max(4, rect.top - pad), left: Math.max(4, rect.left - pad), width: Math.min(vw - 8, rect.width + pad * 2), height: Math.min(vh - 8, rect.height + pad * 2) };
  // Put the card beside the spotlight, wherever there is most room.
  const card = { width: Math.min(340, vw - 32) };
  if (hole) {
    const below = vh - (hole.top + hole.height),
      above = hole.top,
      right = vw - (hole.left + hole.width);
    if (below > 210) Object.assign(card, { top: hole.top + hole.height + 12, left: Math.min(Math.max(16, hole.left), vw - card.width - 16) });
    else if (above > 210) Object.assign(card, { top: Math.max(16, hole.top - 12 - 190), left: Math.min(Math.max(16, hole.left), vw - card.width - 16) });
    else if (right > card.width + 24) Object.assign(card, { top: Math.min(Math.max(16, hole.top), vh - 230), left: hole.left + hole.width + 12 });
    else if (hole.left > card.width + 24) Object.assign(card, { top: Math.min(Math.max(16, hole.top + 40), vh - 230), left: hole.left - card.width - 12 });
    else Object.assign(card, { top: Math.max(16, Math.min(vh - 230, hole.top + hole.height / 2 - 100)), left: (vw - card.width) / 2 });
  } else Object.assign(card, { top: vh / 2 - 100, left: (vw - card.width) / 2 });
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {hole ? <div className="tour-hole" style={hole} /> : <div className="tour-dim" />}
      <div className="tour-card" style={card}>
        <div className="tour-progress" aria-hidden="true">
          {STEPS.map((_, n) => (
            <span key={n} className={n <= i ? "is-on" : ""} />
          ))}
        </div>
        <p className="tour-count">
          Step {i + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="link-button" onClick={onClose}>
            Skip tour
          </button>
          <span>
            {i > 0 && (
              <button type="button" className="button button--ghost button--sm" onClick={() => setI(i - 1)} aria-label="Previous tip">
                <ArrowLeft size={15} />
              </button>
            )}
            <button type="button" className="button button--primary button--sm" onClick={() => (i === STEPS.length - 1 ? onClose() : setI(i + 1))} autoFocus>
              {i === STEPS.length - 1 ? "Start designing" : "Next"} <ArrowRight size={15} />
            </button>
          </span>
        </div>
        <button type="button" className="icon-button tour-close" onClick={onClose} aria-label="Close the tour">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
