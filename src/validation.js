// Contact-field rules shared by the configurator (browser) and the Netlify
// functions (server). Plain ES module, no dependencies. The server treats
// these as the source of truth; the browser uses them for instant feedback.

// Option lists mirror Make Room's own enquiry form.
export const INSTALL_TIMES = ["As soon as possible", "3–6 months", "6–12 months", "Just exploring for now"];
export const BUDGETS = ["£10,000 – £20,000", "£20,000 – £35,000", "£35,000+"];
export const BEST_TIMES = ["Morning (9am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–7pm)", "Any time"];
export const REQUEST_TOPICS = {
  callback: "Request a callback",
  visit: "Arrange a show village visit",
  brochure: "Request a brochure",
};

export const POSTCODE_PATTERN = /^(?:GIR\s?0AA|(?:[A-PR-UWYZ]\d(?:\d|[A-HJKPSTUW])?|[A-PR-UWYZ][A-HK-Y]\d(?:\d|[ABEHMNPRVWXY])?)\s?\d[ABD-HJLNP-UW-Z]{2})$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const CONTROL_OR_TAGS = /[\p{Cc}<>]/u;

const asText = (value) => (typeof value === "string" ? value : value === undefined || value === null ? "" : null);

// ---------------------------------------------------------------- phone

export const PHONE_HINT = "Please enter a UK mobile or landline number, e.g. 07xxx xxxxxx.";
const SAMPLE_NUMBER = "That looks like a sample number. Please enter your own UK phone number.";

// Ofcom's reserved TV, radio and drama numbers, as national digits.
const DRAMA_RANGES = [
  /^07700900\d{3}$/, // 07700 900000-900999
  /^01632960\d{3}$/, // 01632 960000-960999
  /^02079460\d{3}$/, // 020 7946 0000-0999
  /^01(?:1[3-8]|[2-6]1)4960\d{3}$/, // 0113-0118, 0121, 0131, 0141, 0151, 0161 496 0000-0999
  /^02896496\d{3}$/, // 028 9649 6000-6999
  /^02920180\d{3}$/, // 029 2018 0000-0999
  /^01914980\d{3}$/, // 0191 498 0000-0999
  /^03069990\d{3}$/, // 0306 999 0000-0999
  /^08081570\d{3}$/, // 0808 157 0000-0999
  /^09098790\d{3}$/, // 0909 879 0000-0999
];
const MOBILE = /^07(?:[1-57-9]\d{8}|624\d{6})$/; // 071-075, 077-079, Isle of Man 07624
const GEOGRAPHIC = [/^01\d{8,9}$/, /^02\d{9}$/];
const NON_GEOGRAPHIC = /^03\d{9}$/;

function formatNational(n) {
  if (n.startsWith("07")) return `${n.slice(0, 5)} ${n.slice(5)}`;
  if (n.startsWith("02")) return `${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`;
  if (n.startsWith("03")) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  // 011x and 01x1 cities use three-digit area codes after the 0: 0113 xxx xxxx, 0121 xxx xxxx.
  if (/^01(?:1\d|\d1)/.test(n) && n.length === 11) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  return `${n.slice(0, 5)} ${n.slice(5)}`;
}

const phoneFail = (error) => ({ ok: false, national: "", e164: "", kind: null, error });

/**
 * normaliseUkPhone("+44 (0)7700 900123") etc.
 * @returns {{ok:boolean, national:string, e164:string, kind:'mobile'|'landline'|'non-geographic'|null, error?:string}}
 */
export function normaliseUkPhone(input) {
  const raw = asText(typeof input === "number" ? String(input) : input);
  if (raw === null) return phoneFail(PHONE_HINT);
  const trimmed = raw.trim();
  if (!trimmed) return phoneFail("Please enter your phone number.");
  if (trimmed.length > 30 || !/^\+?[\d\s().-]+$/.test(trimmed)) return phoneFail(PHONE_HINT);
  // Drop separators and brackets. "+44 (0)7..." becomes "+4407...", whose
  // national part already starts with the 0 trunk prefix.
  const s = trimmed.replace(/[\s().-]/g, "");
  if (s.indexOf("+") > 0) return phoneFail(PHONE_HINT);
  let national;
  if (s.startsWith("+")) {
    if (!s.startsWith("+44")) return phoneFail(PHONE_HINT);
    national = s.slice(3);
  } else if (s.startsWith("0044")) {
    national = s.slice(4);
  } else if (s.startsWith("44")) {
    national = s.slice(2);
  } else if (s.startsWith("0")) {
    national = s;
  } else {
    return phoneFail(PHONE_HINT);
  }
  if (!national.startsWith("0")) national = `0${national}`;
  if (!/^0\d{9,10}$/.test(national)) return phoneFail(PHONE_HINT);
  if (DRAMA_RANGES.some((r) => r.test(national))) return phoneFail(SAMPLE_NUMBER);
  if (/^0(\d)\1+$/.test(national)) return phoneFail("Please enter your own UK phone number.");
  let kind = null;
  if (MOBILE.test(national)) kind = "mobile";
  else if (GEOGRAPHIC.some((r) => r.test(national))) kind = "landline";
  else if (NON_GEOGRAPHIC.test(national)) kind = "non-geographic";
  if (!kind) return phoneFail(PHONE_HINT);
  return { ok: true, national: formatNational(national), e164: `+44${national.slice(1)}`, kind };
}

// ---------------------------------------------------------------- name

/** validateName(value, "first name") -> {ok, value, error} */
export function validateName(value, label = "name") {
  const raw = asText(value);
  if (raw === null) return { ok: false, value: "", error: `Please check your ${label}.` };
  const clean = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, value: "", error: `Please enter your ${label}.` };
  if (clean.length > 50) return { ok: false, value: clean, error: `Please keep your ${label} to 50 characters or fewer.` };
  if (!/^[\p{L}\p{M} '’.-]+$/u.test(clean) || !/\p{L}/u.test(clean)) {
    return { ok: false, value: clean, error: `Please use letters, spaces, hyphens and apostrophes in your ${label}.` };
  }
  return { ok: true, value: clean };
}

// ---------------------------------------------------------------- email

/** validateEmail(value) -> {ok, value (lowercased), error} */
export function validateEmail(value) {
  const raw = asText(value);
  if (raw === null) return { ok: false, value: "", error: "Please enter a valid email address." };
  const clean = raw.trim().toLowerCase();
  if (!clean) return { ok: false, value: "", error: "Please enter your email address." };
  if (clean.length > 254 || CONTROL_OR_TAGS.test(clean) || !EMAIL_PATTERN.test(clean)) {
    return { ok: false, value: clean, error: "Please enter a valid email address." };
  }
  return { ok: true, value: clean };
}

// ---------------------------------------------------------------- postcode

/** validatePostcode(" hx30ua ") -> {ok:true, value:"HX3 0UA"} */
export function validatePostcode(value) {
  const raw = asText(value);
  if (raw === null) return { ok: false, value: "", error: "Please enter a valid UK postcode." };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, value: "", error: "Please enter your postcode." };
  const compact = trimmed.toUpperCase().replace(/\s+/g, "");
  if (compact.length > 8 || !POSTCODE_PATTERN.test(compact)) return { ok: false, value: trimmed, error: "Please enter a valid UK postcode." };
  return { ok: true, value: `${compact.slice(0, -3)} ${compact.slice(-3)}` };
}
