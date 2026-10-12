// Small shims so older phones (iOS 13-15.3, older Android browsers) run the
// designer. Each one only installs when the browser lacks the feature.

if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, "at", {
    configurable: true,
    writable: true,
    value(n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      return n < 0 || n >= this.length ? undefined : this[n];
    },
  });
}

// Designs are plain JSON, so a JSON round trip is an exact clone here.
if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
}

if (typeof Element !== "undefined" && !Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function replaceChildren(...nodes) {
    while (this.lastChild) this.removeChild(this.lastChild);
    if (nodes.length) this.append(...nodes);
  };
}

// Size watching for the 3D stage: window resizes plus a light poll.
if (typeof globalThis.ResizeObserver !== "function") {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Map();
      this.check = () => {
        for (const [el, size] of this.targets) {
          const w = el.clientWidth,
            h = el.clientHeight;
          if (w !== size.w || h !== size.h) {
            this.targets.set(el, { w, h });
            this.callback([{ target: el, contentRect: { width: w, height: h } }], this);
          }
        }
      };
    }
    observe(el) {
      this.targets.set(el, { w: -1, h: -1 });
      if (!this.timer) {
        this.timer = setInterval(this.check, 400);
        window.addEventListener("resize", this.check);
        window.addEventListener("orientationchange", this.check);
      }
      this.check();
    }
    unobserve(el) {
      this.targets.delete(el);
    }
    disconnect() {
      this.targets.clear();
      clearInterval(this.timer);
      this.timer = null;
      window.removeEventListener("resize", this.check);
      window.removeEventListener("orientationchange", this.check);
    }
  };
}
