import React, { useEffect, useRef, useState } from "react";
import { X, PhoneCall, MapPin, BookOpen, Clock, Navigation, CheckCheck, ArrowRight } from "lucide-react";
import { CONTACT, SHOW_VILLAGE, BROCHURE_URL } from "../content.js";
import { normaliseUkPhone, validateName, validateEmail, validatePostcode, BEST_TIMES } from "../validation.js";
import { Field } from "./controls.jsx";
import { PhoneInput } from "./PriceStep.jsx";

const COPY = {
  callback: { icon: <PhoneCall size={22} />, title: "Request a callback", intro: "Leave your number and a Make Room designer will call you to talk your room through. Someone from our team will be in contact within 48 hours.", button: "Request my callback" },
  visit: { icon: <MapPin size={22} />, title: "Visit the show village", intro: SHOW_VILLAGE.claim, button: "Arrange my visit" },
  brochure: { icon: <BookOpen size={22} />, title: "Request a brochure", intro: "We'll send you the Make Room brochure, with finishes, specification and ideas for your space.", button: "Send me a brochure" },
};

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16));
}
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// One form for the three sales actions. Prefills from the price form when the
// visitor has already given their details, and attaches the current design.
export default function EnquiryDrawer({ topic, onClose, config, known, onTopic, onSent }) {
  const [form, setForm] = useState(() => ({ firstName: known?.firstName || "", lastName: known?.lastName || "", phone: known?.phone || "", email: known?.email || "", postcode: known?.postcode || "", bestTime: "", preferredDate: "", notes: topic === "custom" ? "I'd like to discuss a custom size." : "", marketing: false }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [failure, setFailure] = useState("");
  const panel = useRef(null);
  const requestId = useRef(uuid());
  const t = topic === "custom" ? "callback" : topic;
  const copy = COPY[t];
  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.querySelector("input, button")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll("button, input, select, textarea, a[href]")].filter((x) => !x.disabled && x.offsetParent);
        if (!items.length) return;
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) (last.focus(), e.preventDefault());
        else if (!e.shiftKey && document.activeElement === last) (first.focus(), e.preventDefault());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const fn = validateName(form.firstName, "first name");
    if (!fn.ok) errs.firstName = fn.error;
    const ln = validateName(form.lastName, "last name");
    if (!ln.ok) errs.lastName = ln.error;
    const ph = normaliseUkPhone(form.phone);
    if (!ph.ok) errs.phone = ph.error;
    if (t === "brochure" || form.email) {
      const em = validateEmail(form.email);
      if (!em.ok) errs.email = em.error;
    }
    if (form.postcode) {
      const pc = validatePostcode(form.postcode);
      if (!pc.ok) errs.postcode = pc.error;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      panel.current?.querySelector(`#rq-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setFailure("");
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, firstName: form.firstName, lastName: form.lastName, phone: ph.national, email: form.email, postcode: form.postcode, bestTime: form.bestTime, preferredDate: form.preferredDate, notes: form.notes, marketing: form.marketing, config, requestId: requestId.current, botField: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.saved) {
        if (data.field) setErrors({ [data.field]: data.error });
        throw new Error(data.error || "We couldn't send that just now.");
      }
      setSent({ reference: data.reference, phone: ph.national, first: fn.value });
      onSent?.(t, { firstName: fn.value, lastName: ln.value, phone: ph.national, email: form.email, postcode: form.postcode });
      window.dataLayer?.push({ event: `make_room_request_${t}` });
    } catch (err) {
      setFailure(`${err.message} Please try again, or call us on ${CONTACT.phone}.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-tabs" role="tablist" aria-label="How can we help?">
          {Object.entries(COPY).map(([id, c]) => (
            <button key={id} type="button" role="tab" aria-selected={t === id} className={t === id ? "is-on" : ""} onClick={() => (onTopic(id), setSent(null))}>
              {c.icon}
              <span>{c.title.replace("Request a ", "").replace("Visit the ", "")}</span>
            </button>
          ))}
          <button type="button" className="icon-button drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">
          <h2 id="drawer-title">{copy.title}</h2>
          <p className="drawer-intro">{copy.intro}</p>
          {t === "visit" && (
            <div className="village">
              <div>
                <strong>{SHOW_VILLAGE.name}</strong>
                <address>{SHOW_VILLAGE.address.join(", ")}</address>
                <a href={SHOW_VILLAGE.directions} target="_blank" rel="noopener" className="link-button">
                  <Navigation size={14} /> Get directions
                </a>
              </div>
              <dl>
                {SHOW_VILLAGE.hours.map(([d, h]) => (
                  <div key={d}>
                    <dt>
                      <Clock size={13} /> {d}
                    </dt>
                    <dd>{h}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {t === "brochure" && BROCHURE_URL && (
            <a className="button button--primary button--block" href={BROCHURE_URL} download>
              Download the brochure now <ArrowRight size={16} />
            </a>
          )}
          {sent ? (
            <div className="sent" role="status">
              <CheckCheck size={26} />
              <h3>Thank you, {sent.first}.</h3>
              <p>
                {t === "brochure"
                  ? "Your brochure request is with the team."
                  : t === "visit"
                    ? `We'll call you on ${sent.phone} to confirm your visit.`
                    : `A Make Room designer will call you on ${sent.phone}.`}{" "}
                Your design is attached, so we can talk about exactly what you've planned.
              </p>
              <p className="fine">Reference {sent.reference}</p>
              <button type="button" className="button button--ghost" onClick={onClose}>
                Back to my design
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="field-row">
                <Field id="rq-firstName" label="First name" error={errors.firstName}>
                  <input id="rq-firstName" autoComplete="given-name" required maxLength={50} value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} aria-invalid={!!errors.firstName} aria-describedby="rq-firstName-msg" />
                </Field>
                <Field id="rq-lastName" label="Last name" error={errors.lastName}>
                  <input id="rq-lastName" autoComplete="family-name" required maxLength={50} value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} aria-invalid={!!errors.lastName} aria-describedby="rq-lastName-msg" />
                </Field>
              </div>
              <PhoneInput id="rq-phone" value={form.phone} onChange={set("phone")} error={errors.phone} />
              <Field id="rq-email" label="Email address" optional={t !== "brochure"} error={errors.email}>
                <input id="rq-email" type="email" inputMode="email" autoComplete="email" maxLength={254} required={t === "brochure"} value={form.email} onChange={(e) => set("email")(e.target.value)} aria-invalid={!!errors.email} aria-describedby="rq-email-msg" />
              </Field>
              {t !== "brochure" && (
                <div className="field-row">
                  <Field id="rq-bestTime" label="Best time to call" optional>
                    <select id="rq-bestTime" value={form.bestTime} onChange={(e) => set("bestTime")(e.target.value)}>
                      <option value="">Any time</option>
                      {BEST_TIMES.filter((x) => x !== "Any time").map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  {t === "visit" ? (
                    <Field id="rq-preferredDate" label="Preferred day" optional>
                      <input id="rq-preferredDate" type="date" min={today()} max={inDays(120)} value={form.preferredDate} onChange={(e) => set("preferredDate")(e.target.value)} />
                    </Field>
                  ) : (
                    <Field id="rq-postcode" label="Postcode" optional error={errors.postcode}>
                      <input id="rq-postcode" autoComplete="postal-code" maxLength={10} value={form.postcode} onChange={(e) => set("postcode")(e.target.value.toUpperCase())} aria-invalid={!!errors.postcode} aria-describedby="rq-postcode-msg" />
                    </Field>
                  )}
                </div>
              )}
              {t === "brochure" && (
                <Field id="rq-postcode" label="Postcode" optional error={errors.postcode}>
                  <input id="rq-postcode" autoComplete="postal-code" maxLength={10} value={form.postcode} onChange={(e) => set("postcode")(e.target.value.toUpperCase())} aria-invalid={!!errors.postcode} aria-describedby="rq-postcode-msg" />
                </Field>
              )}
              <Field id="rq-notes" label="Anything we should know?" optional>
                <textarea id="rq-notes" rows={3} maxLength={1200} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
              </Field>
              <label className="check">
                <input type="checkbox" checked={form.marketing} onChange={(e) => set("marketing")(e.target.checked)} />
                <span>Send me occasional Make Room news and offers.</span>
              </label>
              {failure && (
                <p className="form-error" role="alert">
                  {failure}
                </p>
              )}
              <button type="submit" className="button button--primary button--block" disabled={busy}>
                {busy ? "Sending…" : copy.button} {!busy && <ArrowRight size={17} />}
              </button>
              <p className="assure">
                Your current design is attached. See our{" "}
                <a href={CONTACT.privacy} target="_blank" rel="noopener">
                  privacy notice
                </a>
                . Or call <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
