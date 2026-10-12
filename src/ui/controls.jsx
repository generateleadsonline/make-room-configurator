import React, { useId } from "react";
import { Check, Minus, Plus } from "lucide-react";

// Small, deep controls shared by every step. Each takes a value and an
// onChange and handles its own keyboard and touch behaviour.

export function Section({ title, aside, children, id }) {
  return (
    <section className="cfg-section" aria-labelledby={id}>
      <div className="cfg-section-head">
        <h3 id={id}>{title}</h3>
        {aside && <span className="cfg-section-aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function Segmented({ label, options, value, onChange, size = "md" }) {
  return (
    <div className={`segmented segmented--${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "is-on" : ""} onClick={() => onChange(o.id)} disabled={o.disabled}>
          {o.icon}
          <span>{o.label}</span>
          {o.badge != null && <small className="segmented-badge">{o.badge}</small>}
        </button>
      ))}
    </div>
  );
}

export function ChoiceCards({ label, options, value, onChange, columns = 2, flash }) {
  return (
    <div className={`choice-cards cols-${columns}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={`choice-card ${on ? "is-on" : ""} ${flash === o.id ? "is-flash" : ""}`} onClick={() => onChange(o.id)}>
            {o.icon && <span className="choice-icon">{o.icon}</span>}
            <span className="choice-text">
              <strong>{o.label}</strong>
              {o.detail && <small>{o.detail}</small>}
            </span>
            <span className="choice-tick" aria-hidden="true">{on && <Check size={14} strokeWidth={2.5} />}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SwatchGrid({ label, options, value, onChange, flash, size = "md" }) {
  return (
    <div className={`swatches swatches--${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} title={o.label} className={`swatch ${on ? "is-on" : ""} ${flash === o.id ? "is-flash" : ""}`} onClick={() => onChange(o.id)}>
            <span className="swatch-chip" style={{ "--hex": o.hex }}>
              {o.swatch && <img src={o.swatch} alt="" loading="lazy" decoding="async" />}
              {on && (
                <span className="swatch-tick">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="swatch-name">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Slider over a fixed list of values (catalogue sizes) or a numeric range.
export function Stepper({ label, values, value, onChange, format, unit, hint }) {
  const id = useId();
  const index = Math.max(0, values.indexOf(value));
  const fill = values.length > 1 ? (index / (values.length - 1)) * 100 : 0;
  const shown = format ? format(value) : value;
  return (
    <div className="stepper">
      <div className="stepper-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {shown}
          {unit && <small>{unit}</small>}
        </output>
      </div>
      <div className="stepper-row">
        <button type="button" className="nudge" aria-label={`Decrease ${label.toLowerCase()}`} disabled={index <= 0} onClick={() => onChange(values[index - 1])}>
          <Minus size={16} />
        </button>
        <input
          id={id}
          type="range"
          min={0}
          max={values.length - 1}
          step={1}
          value={index}
          style={{ "--fill": `${fill}%` }}
          aria-valuetext={`${shown}${unit ? ` ${unit}` : ""}`}
          onChange={(e) => onChange(values[Number(e.target.value)])}
        />
        <button type="button" className="nudge" aria-label={`Increase ${label.toLowerCase()}`} disabled={index >= values.length - 1} onClick={() => onChange(values[index + 1])}>
          <Plus size={16} />
        </button>
      </div>
      <div className="stepper-scale">
        <span>{format ? format(values[0]) : values[0]}</span>
        {hint && <span className="stepper-hint">{hint}</span>}
        <span>{format ? format(values.at(-1)) : values.at(-1)}</span>
      </div>
    </div>
  );
}
export function rangeValues(min, max, step) {
  const out = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function Toggle({ label, checked, onChange, detail }) {
  const id = useId();
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-text">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </label>
  );
}

export function Tip({ icon, children }) {
  return (
    <p className="tip">
      {icon}
      <span>{children}</span>
    </p>
  );
}

export function Field({ id, label, error, hint, optional, children, valid }) {
  return (
    <div className={`field ${error ? "has-error" : ""} ${valid ? "is-valid" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional">Optional</span>}
      </label>
      {children}
      {error ? (
        <p className="field-msg field-error" id={`${id}-msg`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-msg" id={`${id}-msg`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
