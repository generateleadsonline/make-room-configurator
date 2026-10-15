import React, { useState } from "react";
import { ArrowRight, CalendarDays, Download, PhoneCall, MapPin, BookOpen, Link2, CheckCheck, LockKeyhole, ShieldCheck, PenLine, ChevronDown, Check, CircleCheck } from "lucide-react";
import { summaryRows, area, fmtM } from "../catalog.js";
import { CONTACT, SHOW_VILLAGE, PROCESS, USPS } from "../content.js";
import { normaliseUkPhone, validateName, validateEmail, validatePostcode, INSTALL_TIMES, BUDGETS } from "../validation.js";
import { Field } from "./controls.jsx";

const money = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

export function checkLead(lead) {
  const errors = {};
  const first = validateName(lead.firstName, "first name");
  if (!first.ok) errors.firstName = first.error;
  const last = validateName(lead.lastName, "last name");
  if (!last.ok) errors.lastName = last.error;
  const email = validateEmail(lead.email);
  if (!email.ok) errors.email = email.error;
  const phone = normaliseUkPhone(lead.phone);
  if (!phone.ok) errors.phone = phone.error;
  const pc = validatePostcode(lead.postcode);
  if (!pc.ok) errors.postcode = pc.error;
  return errors;
}

// Live phone feedback: says what kind of UK number it recognised.
export function PhoneInput({ id, value, onChange, error, onBlur, required = true }) {
  const result = value ? normaliseUkPhone(value) : null;
  const kind = result?.ok ? { mobile: "UK mobile", landline: "UK landline", "non-geographic": "UK number" }[result.kind] : null;
  return (
    <Field id={id} label="Phone number" error={error} valid={!!kind} hint={kind ? `${kind} · ${result.national}` : "We'll only call about your room. UK numbers only."}>
      <div className="phone-input">
        <span className="phone-prefix" aria-hidden="true">
          UK
        </span>
        <input
          id={id}
          name="tel"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          maxLength={20}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (result?.ok) onChange(result.national);
            onBlur?.();
          }}
          aria-invalid={!!error}
          aria-describedby={`${id}-msg`}
          placeholder="07xxx xxxxxx"
        />
        {kind && <CircleCheck className="phone-ok" size={18} aria-hidden="true" />}
      </div>
    </Field>
  );
}

function Spec({ config, open, onEdit }) {
  return (
    <details className="spec" open={open}>
      <summary>
        Your design · {fmtM(config.width)} × {fmtM(config.depth)} · {area(config).toFixed(1)} m²
        <ChevronDown size={16} />
      </summary>
      <dl>
        {summaryRows(config).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="link-button" onClick={onEdit}>
        <PenLine size={14} /> Change something
      </button>
    </details>
  );
}

export function PriceStep({ config, quote, quoteCurrent, unlocked, lead, setLead, busy, error, fieldErrors, setFieldErrors, onSubmit, onUpdate, onPdf, pdfBusy, pdfError, onRequest, onShare, shared, onEdit }) {
  const [touched, setTouched] = useState({});
  const set = (k) => (v) => {
    setLead({ ...lead, [k]: v });
    if (fieldErrors[k]) setFieldErrors({ ...fieldErrors, [k]: undefined });
  };
  const blur = (k) => () => {
    setTouched({ ...touched, [k]: true });
    const errs = checkLead(lead);
    if (errs[k] && lead[k]) setFieldErrors({ ...fieldErrors, [k]: errs[k] });
  };
  if (quote && quoteCurrent)
    return (
      <div className="result">
        <p className="saved-line">
          <CheckCheck size={17} /> Saved. Reference {quote.reference}
        </p>
        <div className="price-card">
          <span className="price-label">{quote.priceLabel}</span>
          <strong className="price">{quote.total ? <>{quote.isStartingEstimate && <small>from </small>}{money(quote.total)}</> : "Tailored quote"}</strong>
          <span className="price-note">{quote.priceNote}</span>
          <p>{quote.explanation}</p>
          {quote.sourceUrl && (
            <a href={quote.sourceUrl} target="_blank" rel="noopener" className="source-link">
              Based on Make Room's published price guide <ArrowRight size={13} />
            </a>
          )}
        </div>
        {quote.items?.length > 0 && (
          <details className="breakdown">
            <summary>
              What's included in this figure
              <ChevronDown size={16} />
            </summary>
            <dl>
              {quote.items.map((x, i) => (
                <div key={i}>
                  <dt>{x.label}</dt>
                  <dd>{x.amount ? money(x.amount) : x.value || "Priced by your designer"}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        <div className="cta-stack" data-tour="ctas-result">
          <button type="button" className="button button--primary button--block" onClick={onPdf} disabled={pdfBusy}>
            <Download size={18} /> {pdfBusy ? "Preparing your design pack…" : "Download my PDF design pack"}
          </button>
          {pdfError && (
            <p className="form-error" role="alert">
              {pdfError}
            </p>
          )}
          <div className="cta-grid">
            <button type="button" className="cta cta--wide" data-cta="book-call" onClick={() => onRequest("book-call")}>
              <CalendarDays size={20} />
              <strong>Book a call</strong>
              <small>Pick a day and time to talk it through</small>
            </button>
            <button type="button" className="cta" onClick={() => onRequest("callback")}>
              <PhoneCall size={20} />
              <strong>Request a callback</strong>
              <small>A designer talks your room through with you</small>
            </button>
            <button type="button" className="cta" onClick={() => onRequest("visit")}>
              <MapPin size={20} />
              <strong>Visit the show village</strong>
              <small>Nine finished rooms in Halifax</small>
            </button>
            <button type="button" className="cta" onClick={() => onRequest("brochure")}>
              <BookOpen size={20} />
              <strong>Request a brochure</strong>
              <small>Finishes, specification and ideas</small>
            </button>
            <button type="button" className="cta" onClick={onShare}>
              {shared ? <Check size={20} /> : <Link2 size={20} />}
              <strong>{shared ? "Link copied" : "Share this design"}</strong>
              <small>Reopen it on any device</small>
            </button>
          </div>
        </div>
        <section className="next-steps" aria-labelledby="next-h">
          <h3 id="next-h">What happens next</h3>
          <ol>
            {PROCESS.map((p) => (
              <li key={p.title}>
                <strong>{p.title}</strong>
                <span>{p.detail}</span>
              </li>
            ))}
          </ol>
        </section>
        <ul className="usp-list">
          {USPS.filter((u) => ["warranty", "lead", "planning", "insulated"].includes(u.id)).map((u) => (
            <li key={u.id}>
              <ShieldCheck size={16} />
              <span>
                <strong>{u.title}.</strong> {u.detail}
              </span>
            </li>
          ))}
        </ul>
        <Spec config={config} onEdit={onEdit} />
      </div>
    );

  if (unlocked)
    return (
      <div className="result">
        <Spec config={config} open onEdit={onEdit} />
        <p className="lede">Your details are saved. Update your price for the design as it is now.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="button button--primary button--block" onClick={onUpdate} disabled={busy}>
          {busy ? "Updating your price…" : "Update my price"} <ArrowRight size={17} />
        </button>
      </div>
    );

  return (
    <form className="lead-form" onSubmit={onSubmit} noValidate>
      <div className="pack-promise">
        <div className="pack-cover" aria-hidden="true">
          <img src="/assets/make-room-logo.svg" alt="" />
          <span>Your room, designed by you</span>
        </div>
        <ul>
          <li>
            <Check size={15} /> Your price for this design
          </li>
          <li>
            <Check size={15} /> A PDF pack: 3D views, plan, elevations, full specification
          </li>
          <li>
            <Check size={15} /> A link to come back and keep designing
          </li>
        </ul>
      </div>
      <Spec config={config} onEdit={onEdit} />
      <fieldset>
        <legend>Where should we send it?</legend>
        <div className="field-row">
          <Field id="firstName" label="First name" error={fieldErrors.firstName}>
            <input id="firstName" name="given-name" autoComplete="given-name" required maxLength={50} value={lead.firstName} onChange={(e) => set("firstName")(e.target.value)} onBlur={blur("firstName")} aria-invalid={!!fieldErrors.firstName} aria-describedby="firstName-msg" />
          </Field>
          <Field id="lastName" label="Last name" error={fieldErrors.lastName}>
            <input id="lastName" name="family-name" autoComplete="family-name" required maxLength={50} value={lead.lastName} onChange={(e) => set("lastName")(e.target.value)} onBlur={blur("lastName")} aria-invalid={!!fieldErrors.lastName} aria-describedby="lastName-msg" />
          </Field>
        </div>
        <Field id="email" label="Email address" error={fieldErrors.email}>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={lead.email} onChange={(e) => set("email")(e.target.value)} onBlur={blur("email")} aria-invalid={!!fieldErrors.email} aria-describedby="email-msg" />
        </Field>
        <PhoneInput id="phone" value={lead.phone} onChange={set("phone")} error={fieldErrors.phone} onBlur={blur("phone")} />
        <Field id="postcode" label="Installation postcode" error={fieldErrors.postcode} hint="So we can check access and delivery to your home.">
          <input id="postcode" name="postal-code" autoComplete="postal-code" required maxLength={10} value={lead.postcode} onChange={(e) => set("postcode")(e.target.value.toUpperCase())} onBlur={blur("postcode")} aria-invalid={!!fieldErrors.postcode} aria-describedby="postcode-msg" />
        </Field>
        <div className="field-row">
          <Field id="timeline" label="When would you like it?" optional error={fieldErrors.timeline}>
            <select id="timeline" value={lead.timeline} onChange={(e) => set("timeline")(e.target.value)}>
              <option value="">Choose one</option>
              {INSTALL_TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field id="budget" label="Your budget" optional error={fieldErrors.budget}>
            <select id="budget" value={lead.budget} onChange={(e) => set("budget")(e.target.value)}>
              <option value="">Choose one</option>
              {BUDGETS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="honey" aria-hidden="true">
          <label>
            Leave this empty
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={lead.marketing} onChange={(e) => setLead({ ...lead, marketing: e.target.checked })} />
          <span>Send me occasional Make Room news and offers. You can unsubscribe at any time.</span>
        </label>
      </fieldset>
      {error && (
        <p className="form-error" role="alert" id="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="button button--primary button--block button--lg" disabled={busy}>
        {busy ? "Saving your design…" : "Show my price & design pack"} {!busy && <ArrowRight size={18} />}
      </button>
      <p className="assure">
        <LockKeyhole size={14} /> No payment, no obligation. We use your details to send your price and talk about your room. See our{" "}
        <a href={CONTACT.privacy} target="_blank" rel="noopener">
          privacy notice
        </a>
        .
      </p>
      <div className="cta-grid locked-ctas" aria-label="Other next steps">
        <button type="button" className="cta" data-cta="book-call" onClick={() => onRequest("book-call")}>
          <CalendarDays size={20} />
          <strong>Book a call</strong>
          <small>Pick a day and time to talk it through</small>
        </button>
        <button type="button" className="cta cta--locked" data-cta="download-pdf" onClick={() => { window.dataLayer?.push({ event: "make_room_pdf_locked" }); document.getElementById("firstName")?.focus(); }}>
          <LockKeyhole size={20} />
          <strong>Download PDF</strong>
          <small>Unlocks with your price, once you send the form</small>
        </button>
      </div>
      <p className="assure">
        Prefer to talk? Call <a href={CONTACT.phoneHref}>{CONTACT.phone}</a> or visit the {SHOW_VILLAGE.name}.
      </p>
    </form>
  );
}
