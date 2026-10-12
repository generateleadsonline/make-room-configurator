// What the 3D view did on this device, for support and for the crash guard.
// No personal data: device, browser and GPU facts plus a timeline of stages.

const BOOT_KEY = "mr3d-boot";
const SAFE_KEY = "mr3d-safe";
const started = typeof performance !== "undefined" ? performance.now() : 0;
const events = [];
const sent = new Set();
let probeResult = null;
export const sessionId = makeId();

function makeId() {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
  } catch {
    return Math.random().toString(16).slice(2, 8).toUpperCase();
  }
}
const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage blocked: the guard simply works per page load */
  }
};

export function log(type, detail) {
  const entry = { t: Math.round((performance.now() - started) / 10) / 100, type };
  if (detail !== undefined) entry.detail = typeof detail === "string" ? detail.slice(0, 300) : detail;
  events.push(entry);
  if (events.length > 80) events.splice(1, events.length - 80);
}
export function errorDetail(err) {
  if (!err) return null;
  return { name: err.name, message: String(err.message || err).slice(0, 240), stage: err.stage, stack: String(err.stack || "").split("\n").slice(0, 4).join(" | ").slice(0, 400) };
}

// One short-lived context to read the GPU's capabilities, released at once.
export function probeWebGL() {
  if (probeResult) return probeResult;
  const result = { webgl2: false, webgl1: false };
  for (const type of ["webgl2", "webgl", "experimental-webgl"]) {
    let gl = null;
    try {
      gl = document.createElement("canvas").getContext(type, { failIfMajorPerformanceCaveat: false });
    } catch (err) {
      result.error = String(err?.message || err).slice(0, 120);
    }
    if (!gl) continue;
    if (type === "webgl2") result.webgl2 = true;
    else result.webgl1 = true;
    if (!result.renderer) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      result.vendor = info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      result.renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      result.version = gl.getParameter(gl.VERSION);
      result.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      result.maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      result.fragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      result.fragmentHighp = !!hp && hp.precision > 0;
      const ext = gl.getSupportedExtensions() || [];
      result.halfFloatTarget = ext.includes("EXT_color_buffer_half_float") || ext.includes("EXT_color_buffer_float");
      result.extensions = ext.length;
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (result.webgl2) break;
  }
  result.level = result.webgl2 ? 2 : result.webgl1 ? 1 : 0;
  // Only a working result is reused; a failed probe is retried next time.
  if (result.level) probeResult = result;
  log("probe", { level: result.level, renderer: result.renderer || null });
  return result;
}

export function device() {
  const n = navigator;
  return {
    ua: n.userAgent,
    platform: n.userAgentData?.platform || n.platform,
    mobile: n.userAgentData?.mobile,
    screen: [screen.width, screen.height],
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
    memory: n.deviceMemory,
    cores: n.hardwareConcurrency,
    touch: n.maxTouchPoints,
  };
}

export function report(extra = {}) {
  return { session: sessionId, at: new Date().toISOString(), page: location.pathname, device: device(), gpu: probeResult, events: events.slice(), ...extra };
}

// Failures are sent once per reason so the team can see which devices struggle.
export function send(reason, extra) {
  const key = `${reason}`;
  if (sent.has(key)) return;
  // Netlify's deploy screenshots and crawlers run headless with no GPU; their
  // "no-webgl" reports would bury the real devices.
  if (/HeadlessChrome|bot\b|crawler|spider/i.test(navigator.userAgent)) return;
  sent.add(key);
  const body = JSON.stringify({ reason, ...report(extra) }).slice(0, 7800);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/diag", new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through to fetch */
  }
  fetch("/api/diag", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

// Crash guard across page loads: a start marker that is only cleared once the
// 3D view has run cleanly. A marker left behind means the last attempt took
// the tab or GPU down, so the next load starts in safe mode.
export const boot = {
  previousCrash() {
    const raw = read(BOOT_KEY);
    if (!raw) return null;
    try {
      const m = JSON.parse(raw);
      return Date.now() - m.at < 1000 * 60 * 60 * 24 ? m : null;
    } catch {
      return null;
    }
  },
  begin(mode) {
    write(BOOT_KEY, JSON.stringify({ mode, at: Date.now(), session: sessionId }));
  },
  ok() {
    write(BOOT_KEY, null);
  },
  // A device that needed safe mode keeps it for a week, so it never crashes twice.
  rememberSafe() {
    write(SAFE_KEY, String(Date.now()));
  },
  safeRemembered() {
    const at = Number(read(SAFE_KEY));
    return at && Date.now() - at < 1000 * 60 * 60 * 24 * 7;
  },
  forget() {
    write(SAFE_KEY, null);
    write(BOOT_KEY, null);
  },
};
