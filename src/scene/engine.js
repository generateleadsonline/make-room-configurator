import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildBuilding, focusTarget, wallPoint, wallFrame, openingRect, FLOOR_Y, FASCIA_BOTTOM, CEILING_Y, WALL_T, setGlassQuality } from "./building.js";
import { buildLandscape, contactShadow } from "./landscape.js";
import { setAnisotropy, setTextureScale, texturesReady } from "./textures.js";
import { HEIGHT, wallLength, WALLS } from "../catalog.js";

const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const SKIES = {
  day: { top: "#7fa8cf", horizon: "#e3eaec", ground: "#b9c2ad", sun: "#fff4e0", sunI: 2.7, hemiI: 0.95, hemiSky: "#e9f1f7", hemiGround: "#a39d90", env: 0.95, exposure: 1.0, fog: "#dfe6e6", sunDir: [-0.55, 0.78, 0.62] },
  evening: { top: "#1f2b45", horizon: "#e3a77f", ground: "#28302b", sun: "#ffb47a", sunI: 0.35, hemiI: 0.16, hemiSky: "#6c7ea8", hemiGround: "#2c2a26", env: 0.32, exposure: 1.25, fog: "#7c6d6c", sunDir: [-0.85, 0.12, 0.5] },
};

// Rendering budgets. Phones get smaller textures and shadow maps so the
// browser does not reclaim the GPU context under memory pressure; WebGL 1
// devices get the lightest settings.
export const TIERS = {
  high: { dpr: 2, shadow: 2048, aniso: 8, texScale: 1, glass: "high", spots: 99, captureShadow: 4096, capture: [2000, 1250], cover: [2400, 1148], elev: 1800 },
  medium: { dpr: 1.5, shadow: 1024, aniso: 4, texScale: 0.5, glass: "medium", spots: 4, captureShadow: 2048, capture: [1600, 1000], cover: [1920, 918], elev: 1400 },
  low: { dpr: 1, shadow: 1024, aniso: 2, texScale: 0.5, glass: "medium", spots: 2, captureShadow: 1024, capture: [1280, 800], cover: [1600, 765], elev: 1100 },
};

// WebGL 2 where available, otherwise WebGL 1 (three r162 supports both).
function createRenderer(tier) {
  const attempts = [
    { antialias: tier !== "low", powerPreference: "high-performance" },
    { antialias: false, powerPreference: "default" },
  ];
  let lastError;
  for (const opts of attempts) {
    try {
      return new THREE.WebGLRenderer({ ...opts, alpha: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("WebGL unavailable");
}

// `scale` stands in for Scene.environmentIntensity, which r162 lacks: the
// probe sky is simply rendered brighter or darker.
function skyDome(sky, scale = 1) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(sky.top).multiplyScalar(scale) },
      horizon: { value: new THREE.Color(sky.horizon).multiplyScalar(scale) },
      ground: { value: new THREE.Color(sky.ground).multiplyScalar(scale) },
      sunDir: { value: new THREE.Vector3(...sky.sunDir).normalize() },
      sunCol: { value: new THREE.Color(sky.sun).multiplyScalar(scale) },
    },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;" +
      "void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(min(h*1.6,1.0), 0.7)) : mix(horizon, ground, pow(min(-h*4.0,1.0),0.6));" +
      "float s = max(dot(normalize(vDir), sunDir), 0.0); c += sunCol * (pow(s, 600.0)*3.0 + pow(s, 12.0)*0.18);" +
      "gl_FragColor = vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), mat);
  mesh.name = "sky";
  return mesh;
}

export class Engine {
  constructor(host, overlay, { quality = "high", onReady, onLost, onRestored } = {}) {
    this.host = host;
    this.overlay = overlay;
    const renderer = createRenderer(quality);
    const gl = renderer.getContext();
    // Older phones and browsers: WebGL 1, or small texture limits.
    if (!renderer.capabilities.isWebGL2 || renderer.capabilities.maxTextureSize < 4096) quality = "low";
    this.quality = quality;
    this.tier = TIERS[quality];
    this.webgl = renderer.capabilities.isWebGL2 ? 2 : 1;
    setGlassQuality(this.tier.glass);
    setTextureScale(this.tier.texScale);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.tier.dpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "mr-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);
    setAnisotropy(Math.min(this.tier.aniso, renderer.capabilities.getMaxAnisotropy() || 1));
    this.renderer = renderer;
    // Phones reclaim the GPU when the tab is hidden or memory runs short.
    // Keep the scene and rebuild GPU-side resources when the context returns.
    this.lost = false;
    this.onLost = onLost;
    this.onRestored = onRestored;
    this.handleLost = (event) => {
      event.preventDefault();
      this.lost = true;
      this.onLost?.();
    };
    this.handleRestored = () => {
      this.lost = false;
      // Objects from the old context are simply dropped; disposing them would
      // address GL handles that no longer exist.
      this.pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = null;
      this.sky = null;
      this.scene.children.filter((o) => o.name === "sky").forEach((o) => this.scene.remove(o));
      this.applySky();
      this.applyViewVisibility();
      this.dirty = true;
      this.onRestored?.();
    };
    // Kept from the start: after a loss the extension can no longer be fetched.
    this.loseExtension = gl.getExtension("WEBGL_lose_context");
    renderer.domElement.addEventListener("webglcontextlost", this.handleLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", this.handleRestored, false);

    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
    this.planCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 60);
    this.active = this.camera;
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = !reduceMotion();
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.planControls = new OrbitControls(this.planCamera, renderer.domElement);
    this.planControls.enableRotate = false;
    this.planControls.screenSpacePanning = true;
    this.planControls.enabled = false;
    this.planControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.planControls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    for (const c of [this.controls, this.planControls]) c.addEventListener("change", () => this.onControlsChange());
    this.controls.addEventListener("start", () => {
      this.cancelAnimation();
      this.userMoved = true;
    });
    this.hemi = new THREE.HemisphereLight("#fff", "#888", 1);
    this.sun = new THREE.DirectionalLight("#fff", 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.tier.shadow, this.tier.shadow);
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.radius = 3;
    this.interiorFill = new THREE.PointLight("#fff4e6", 0, 8, 1.4);
    scene.add(this.hemi, this.sun, this.sun.target, this.interiorFill);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.view = "outside";
    this.lighting = "day";
    this.showDims = false;
    this.dirty = true;
    this.anim = null;
    this.highlights = [];
    this.labels = new Map();
    this.config = null;
    this.applySky();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
    this.onReady = onReady;
  }

  applySky() {
    const sky = SKIES[this.lighting];
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      this.sky.material.dispose();
    }
    this.sky = skyDome(sky);
    this.scene.add(this.sky);
    // Environment for reflections: the same sky plus a soft ground, at the
    // sky's environment strength.
    const envScene = new THREE.Scene();
    envScene.add(skyDome(sky, sky.env));
    const groundDisc = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(sky.ground).multiplyScalar(sky.env) }));
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = -0.5;
    envScene.add(groundDisc);
    const env = this.pmrem.fromScene(envScene, 0.02);
    envScene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.envRT?.dispose();
    this.envRT = env;
    this.scene.environment = env.texture;
    this.scene.fog = new THREE.Fog(sky.fog, 22, 70);
    this.hemi.color.set(sky.hemiSky);
    this.hemi.groundColor.set(sky.hemiGround);
    this.hemi.intensity = sky.hemiI;
    this.sun.color.set(sky.sun);
    this.sun.intensity = sky.sunI;
    this.sunDir = new THREE.Vector3(...sky.sunDir).normalize();
    this.renderer.toneMappingExposure = sky.exposure;
    this.applyLamps();
    this.placeSun();
    this.dirty = true;
  }
  placeSun() {
    const c = this.config;
    const span = c ? Math.max(c.width, c.depth) / 2 + 6 : 10;
    // A plan reads best lit from straight above: no long wall shadows.
    const dir = this.view === "plan" ? new THREE.Vector3(0.05, 1, 0.08).normalize() : this.sunDir;
    this.sun.position.copy(dir).multiplyScalar(20);
    this.sun.target.position.set(0, 0, 0);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -span;
    cam.right = cam.top = span;
    cam.near = 1;
    cam.far = 45;
    cam.updateProjectionMatrix();
  }
  applyLamps() {
    const lights = this.building?.userData.ctx.lights;
    if (!lights) return;
    const on = this.lighting === "evening";
    for (const l of lights.interior) {
      l.visible = on;
      l.intensity = on ? 2.2 : 0;
    }
    // Each spotlight costs every pixel; phones keep the first few.
    lights.exterior.forEach((l, i) => {
      l.visible = on && i < this.tier.spots;
      l.intensity = on ? 5.5 : 0;
    });
    for (const m of lights.lamps) m.material.emissiveIntensity = on ? 3 : 0.05;
    this.dirty = true;
  }

  setConfig(c) {
    const prev = this.config;
    this.config = c;
    if (this.building) this.disposeGroup(this.building, true);
    if (this.landscape) this.disposeGroup(this.landscape, true);
    if (this.shadowDecal) this.disposeGroup(this.shadowDecal, true);
    this.clearHighlights();
    this.building = buildBuilding(c, { redraw: () => (this.dirty = true) });
    this.landscape = buildLandscape(c);
    this.shadowDecal = contactShadow(c);
    this.scene.add(this.building, this.landscape, this.shadowDecal);
    this.applyLamps();
    this.placeSun();
    this.buildLabels();
    this.applyViewVisibility();
    const sizeChanged = !prev || prev.width !== c.width || prev.depth !== c.depth || prev.type !== c.type;
    if (sizeChanged && !this.anim) this.setView(this.view, { animate: !!prev, keepAngle: !!prev });
    this.dirty = true;
  }
  disposeGroup(g, remove) {
    if (remove) g.parent?.remove(g);
    g.traverse((o) => {
      o.geometry?.dispose();
      if (o.material && o.material.userData?.disposable) o.material.dispose();
      if (o.isMesh && o.material && !o.material.userData?.cached && o.material.map?.isCanvasTexture && o === this.shadowDecal) o.material.map.dispose();
    });
  }

  // Which parts are visible in each view.
  applyViewVisibility() {
    if (!this.building) return;
    const plan = this.view === "plan",
      inside = this.view === "inside",
      u = this.building.userData;
    u.roof.visible = !plan;
    u.plan.visible = plan;
    const ceiling = u.ctx.ceiling;
    if (ceiling) ceiling.visible = !plan;
    this.building.traverse((o) => {
      if (o.name === "interior") for (const ch of o.children) if (ch.isMesh && ch.geometry.type === "BoxGeometry" && ch.position.y > CEILING_Y) ch.visible = !plan;
    });
    this.landscape.traverse((o) => {
      if (o.userData.tall) o.visible = !plan;
    });
    this.sky.visible = !plan;
    this.placeSun();
    this.scene.background = plan ? new THREE.Color("#f3f2ee") : null;
    this.scene.fog = plan ? null : new THREE.Fog(SKIES[this.lighting].fog, 22, 70);
    this.interiorFill.intensity = inside && this.lighting === "day" ? 1.1 : 0;
    this.interiorFill.position.set(0, CEILING_Y - 0.3, 0);
    this.dirty = true;
  }

  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const before = this.camera.aspect;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.view === "plan") this.framePlan();
    // Until the visitor takes the camera, keep the room framed as the layout settles.
    else if (this.config && !this.userMoved && !this.anim && Math.abs(before - this.camera.aspect) > 0.01) this.setView(this.view, { animate: false });
    this.dirty = true;
  }

  // Camera placement that fits `box` from direction `dir`.
  fitDistance(box, dir, camera = this.camera, margin = 1.08) {
    const centre = box.getCenter(new THREE.Vector3());
    const d = dir.clone().normalize(),
      right = new THREE.Vector3().crossVectors(UP, d).normalize(),
      up = new THREE.Vector3().crossVectors(d, right).normalize(),
      tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let distance = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).sub(centre),
            toward = p.dot(d);
          distance = Math.max(distance, Math.abs(p.dot(up)) / tan + toward, Math.abs(p.dot(right)) / (tan * camera.aspect) + toward);
        }
    return { centre, distance: distance * margin };
  }
  footprintBox() {
    const c = this.config,
      o = c.overhang,
      dk = c.decking;
    return new THREE.Box3(new THREE.Vector3(-c.width / 2 - Math.max(o.left, dk.left) - 0.2, 0, -c.depth / 2 - Math.max(o.back, dk.back) - 0.2), new THREE.Vector3(c.width / 2 + Math.max(o.right, dk.right) + 0.2, HEIGHT + 0.05, c.depth / 2 + Math.max(o.front, dk.front) + 0.3));
  }
  innerBox(margin = 0.18) {
    const c = this.config;
    return new THREE.Box3(new THREE.Vector3(-c.width / 2 + WALL_T + margin, FLOOR_Y + 0.5, -c.depth / 2 + WALL_T + margin), new THREE.Vector3(c.width / 2 - WALL_T - margin, CEILING_Y - 0.25, c.depth / 2 - WALL_T - margin));
  }

  setView(view, { animate = true, keepAngle = false, target } = {}) {
    if (!this.config) return;
    const prevView = this.view;
    this.view = view;
    this.applyViewVisibility();
    this.controls.enabled = view !== "plan";
    this.planControls.enabled = view === "plan";
    if (view === "plan") {
      this.cancelAnimation();
      this.active = this.planCamera;
      this.framePlan();
      this.updateLabels();
      return;
    }
    this.active = this.camera;
    const ctl = this.controls;
    if (view === "inside") {
      const inner = this.innerBox(0);
      const c = this.config;
      ctl.minDistance = 0.3;
      ctl.maxDistance = Math.hypot(c.width, c.depth) / 2;
      ctl.minPolarAngle = Math.PI * 0.2;
      ctl.maxPolarAngle = Math.PI * 0.72;
      ctl.enablePan = false;
      this.camera.fov = 68;
      this.camera.updateProjectionMatrix();
      const goal = target || this.insidePose();
      this.flyTo(goal.position, goal.target, animate && prevView === "inside" ? 700 : 0);
      void inner;
    } else {
      ctl.minDistance = 2.2;
      ctl.maxDistance = 36;
      ctl.minPolarAngle = 0.12;
      ctl.maxPolarAngle = Math.PI / 2 + 0.22;
      ctl.enablePan = true;
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
      let dir = new THREE.Vector3(0.95, 0.42, 1.25);
      if (keepAngle && prevView === "outside") dir = this.camera.position.clone().sub(ctl.target);
      const box = target?.box || this.footprintBox();
      const d = target?.dir || dir;
      const { centre, distance } = this.fitDistance(box, d);
      this.flyTo(centre.clone().addScaledVector(d.clone().normalize(), distance), centre, animate && prevView === "outside" ? 750 : 0);
    }
    this.updateLabels();
  }
  insidePose(look = "level") {
    const c = this.config,
      inner = this.innerBox(0.25);
    // Stand by the front glazing looking back into the room, slightly off-centre.
    const pos = new THREE.Vector3(c.width * 0.18, 1.58, inner.max.z);
    pos.clamp(inner.min, inner.max);
    const target = new THREE.Vector3(-c.width * 0.08, look === "down" ? 0.6 : look === "up" ? 1.62 : 1.15, inner.min.z * 0.35);
    return { position: pos, target };
  }
  framePlan() {
    const c = this.config;
    if (!c) return;
    const box = this.footprintBox().expandByScalar(0.5),
      w = box.max.x - box.min.x,
      d = box.max.z - box.min.z,
      aspect = this.camera.aspect,
      span = Math.max(d, w / aspect) * 1.08;
    const cam = this.planCamera;
    cam.left = (-span * aspect) / 2;
    cam.right = (span * aspect) / 2;
    cam.top = span / 2;
    cam.bottom = -span / 2;
    cam.zoom = 1;
    const cx = (box.min.x + box.max.x) / 2,
      cz = (box.min.z + box.max.z) / 2;
    cam.position.set(cx, 30, cz + 0.0001);
    cam.up.set(0, 0, -1);
    this.planControls.target.set(cx, 0, cz);
    cam.lookAt(cx, 0, cz);
    cam.updateProjectionMatrix();
    this.planControls.minZoom = 0.6;
    this.planControls.maxZoom = 6;
    this.planControls.update();
    this.dirty = true;
  }

  flyTo(position, target, duration = 700) {
    this.cancelAnimation();
    const cam = this.camera,
      ctl = this.controls;
    if (!duration || reduceMotion()) {
      cam.position.copy(position);
      ctl.target.copy(target);
      ctl.update();
      this.dirty = true;
      return;
    }
    const fromT = ctl.target.clone(),
      fromOff = cam.position.clone().sub(fromT),
      toOff = position.clone().sub(target),
      fromLen = fromOff.length(),
      toLen = toOff.length(),
      fromDir = fromOff.clone().normalize(),
      toDir = toOff.clone().normalize(),
      q = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir),
      start = performance.now();
    this.anim = (now) => {
      const t = Math.min(1, (now - start) / duration),
        k = ease(t);
      const dir = fromDir.clone().applyQuaternion(new THREE.Quaternion().slerp(q, k));
      ctl.target.lerpVectors(fromT, target, k);
      cam.position.copy(ctl.target).addScaledVector(dir, fromLen + (toLen - fromLen) * k);
      cam.lookAt(ctl.target);
      this.dirty = true;
      if (t >= 1) {
        this.anim = null;
        ctl.update();
      }
    };
  }
  cancelAnimation() {
    this.anim = null;
  }
  onControlsChange() {
    if (this.view === "inside") {
      // Keep the camera inside the room.
      const inner = this.innerBox(0.12);
      inner.min.y = FLOOR_Y + 0.6;
      this.camera.position.clamp(inner.min, inner.max);
    } else if (this.view === "outside") {
      if (this.camera.position.y < 0.25) this.camera.position.y = 0.25;
      const fb = this.footprintBox().expandByScalar(3);
      this.controls.target.clamp(fb.min, fb.max);
    }
    this.dirty = true;
  }

  zoom(direction) {
    if (this.view === "plan") {
      const cam = this.planCamera;
      cam.zoom = THREE.MathUtils.clamp(cam.zoom * (direction > 0 ? 1.25 : 0.8), this.planControls.minZoom, this.planControls.maxZoom);
      cam.updateProjectionMatrix();
      this.dirty = true;
      return;
    }
    const ctl = this.controls,
      off = this.camera.position.clone().sub(ctl.target),
      len = THREE.MathUtils.clamp(off.length() * (direction > 0 ? 0.8 : 1.25), ctl.minDistance, ctl.maxDistance);
    const pos = ctl.target.clone().addScaledVector(off.normalize(), len);
    this.flyTo(pos, ctl.target.clone(), 260);
  }
  resetView() {
    this.setView(this.view, { animate: true });
  }

  // Turn to the part being changed and pulse a highlight over it. Returns the
  // view the target needs, so the UI can follow.
  focus(spec) {
    if (!this.config) return this.view;
    const f = focusTarget(this.config, spec);
    if (f.view === "inside") {
      const look = f.look || "level";
      if (this.view !== "inside") {
        this.view = "inside";
        this.setView("inside", { animate: false, target: this.insidePose(look) });
      } else {
        const pose = this.insidePose(look);
        this.flyTo(pose.position, pose.target, 650);
      }
    } else if (this.view === "plan" && spec.type !== "size") {
      // Plan stays put for layout changes; just highlight.
    } else {
      if (this.view !== "outside") {
        this.view = "outside";
        this.applyViewVisibility();
        this.controls.enabled = true;
        this.planControls.enabled = false;
        this.active = this.camera;
        this.setView("outside", { animate: false, target: f });
      } else {
        const { centre, distance } = this.fitDistance(f.box, f.dir, this.camera, 1.15);
        const current = this.camera.position.clone().sub(this.controls.target);
        // Only move if the part has left the picture or is seen edge-on.
        const pos = centre.clone().addScaledVector(f.dir.clone().normalize(), Math.max(distance, this.controls.minDistance));
        if (!this.inView(f.box) || current.normalize().dot(f.dir.clone().normalize()) < 0.93) this.flyTo(pos, centre, 750);
      }
    }
    if (f.highlight) this.highlight(f.highlight);
    this.updateLabels();
    return this.view;
  }
  inView(box) {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const shrink = box.clone();
    return [shrink.min, shrink.max].every((p) => frustum.containsPoint(p));
  }

  // Translucent brand-green wash plus a crisp outline, pulsed twice.
  highlight(h) {
    this.clearHighlights();
    const c = this.config,
      group = new THREE.Group();
    group.name = "highlight";
    const fill = new THREE.MeshBasicMaterial({ color: "#b9dc8a", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const edge = new THREE.LineBasicMaterial({ color: "#9fd36a", transparent: true, opacity: 0, depthTest: false });
    fill.userData.disposable = edge.userData.disposable = true;
    const quad = (pts) => {
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const m = new THREE.Mesh(g, fill);
      m.renderOrder = 10;
      group.add(m);
      const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), edge);
      l.renderOrder = 11;
      group.add(l);
    };
    const wallQuad = (wall, u0, v0, u1, v1, n = 0.03) => quad([wallPoint(c, wall, u0, v0, n), wallPoint(c, wall, u1, v0, n), wallPoint(c, wall, u1, v1, n), wallPoint(c, wall, u0, v1, n)]);
    const flat = (x0, z0, x1, z1, y) => quad([new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x0, y, z0)]);
    const w = c.width,
      d = c.depth;
    if (h.kind === "wall") wallQuad(h.wall, 0, FLOOR_Y, wallLength(c, h.wall), FASCIA_BOTTOM);
    else if (h.kind === "opening") {
      const o = c.openings.find((x) => x.id === h.id);
      if (o) {
        const r = openingRect(o);
        wallQuad(o.wall, r.u0 - 0.03, r.v0 - 0.03, r.u1 + 0.03, r.v1 + 0.03, 0.04);
      }
    } else if (h.kind === "overhang") {
      const s = h.side,
        p = Math.max(c.overhang[s], 0.05),
        L = wallLength(c, s);
      wallQuad(s, -0.03, FASCIA_BOTTOM - 0.01, L + 0.03, HEIGHT + 0.02, p + 0.06);
      const a = wallPoint(c, s, 0, FASCIA_BOTTOM - 0.01, 0),
        b = wallPoint(c, s, L, FASCIA_BOTTOM - 0.01, p);
      flat(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), FASCIA_BOTTOM - 0.01);
    } else if (h.kind === "decking") {
      const s = h.side,
        p = Math.max(c.decking[s], 0.3),
        L = wallLength(c, s);
      const a = wallPoint(c, s, 0, 0.11, 0),
        b = wallPoint(c, s, L, 0.11, p);
      flat(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), 0.112);
    } else if (h.kind === "floor") {
      flat(-w / 2 + WALL_T, -d / 2 + WALL_T, w / 2 - WALL_T, d / 2 - WALL_T, FLOOR_Y + 0.01);
    } else if (h.kind === "electrics") {
      flat(-w / 2 + WALL_T, -d / 2 + WALL_T, w / 2 - WALL_T, d / 2 - WALL_T, CEILING_Y - 0.01);
      this.flashLamps();
    } else if (h.kind === "roof") {
      const b = this.building.userData.roofBounds;
      flat(b.x0, b.z0, b.x1, b.z1, HEIGHT + 0.02);
    } else if (h.kind === "outline") {
      for (const wall of WALLS) if (!(c.type === "extension" && wall === "back")) wallQuad(wall, 0, FLOOR_Y, wallLength(c, wall), FASCIA_BOTTOM, 0.02);
    }
    this.scene.add(group);
    const start = performance.now();
    const item = { group, fill, edge, start, duration: 2000 };
    this.highlights.push(item);
    this.dirty = true;
  }
  flashLamps() {
    if (this.lighting === "evening") return;
    const lamps = this.building?.userData.ctx.lights?.lamps || [];
    const start = performance.now();
    this.lampFlash = { lamps, start };
  }
  clearHighlights() {
    for (const hl of this.highlights) {
      this.scene.remove(hl.group);
      hl.group.traverse((o) => o.geometry?.dispose());
      hl.fill.dispose();
      hl.edge.dispose();
    }
    this.highlights = [];
  }
  tickHighlights(now) {
    for (const hl of [...this.highlights]) {
      const t = (now - hl.start) / hl.duration;
      if (t >= 1) {
        this.scene.remove(hl.group);
        hl.group.traverse((o) => o.geometry?.dispose());
        hl.fill.dispose();
        hl.edge.dispose();
        this.highlights.splice(this.highlights.indexOf(hl), 1);
        continue;
      }
      const pulse = Math.pow(Math.sin(Math.PI * Math.min(1, t * 2.2) * 2), 2);
      hl.fill.opacity = 0.38 * pulse * (t < 0.9 ? 1 : (1 - t) * 10);
      hl.edge.opacity = t < 0.8 ? 1 : (1 - t) * 5;
      this.dirty = true;
    }
    if (this.lampFlash) {
      const t = (now - this.lampFlash.start) / 1600;
      const v = t >= 1 ? 0.05 : 0.05 + 2.4 * Math.sin(Math.PI * t);
      for (const m of this.lampFlash.lamps) m.material.emissiveIntensity = v;
      if (t >= 1) this.lampFlash = null;
      this.dirty = true;
    }
  }

  setLighting(mode) {
    if (this.lighting === mode) return;
    this.lighting = mode;
    this.applySky();
    this.applyViewVisibility();
  }
  setDims(on) {
    this.showDims = on;
    this.updateLabels();
    this.dirty = true;
  }

  // HTML labels (crisp text in the brand font), positioned every frame.
  buildLabels() {
    this.overlay.replaceChildren();
    this.labels.clear();
    if (this.dimLines) {
      this.scene.remove(this.dimLines);
      this.dimLines.traverse((o) => o.geometry?.dispose());
    }
    this.dimLines = new THREE.Group();
    const lineMat = (this.lineMat ||= new THREE.LineBasicMaterial({ color: "#2f4327", depthTest: false, transparent: true, opacity: 0.85 }));
    for (const l of this.building.userData.labels) {
      const el = document.createElement("span");
      el.className = `mr-label mr-label--${l.kind}`;
      el.textContent = l.text;
      this.overlay.appendChild(el);
      this.labels.set(l.id, { ...l, el });
      if (l.line) {
        const [a, b] = l.line;
        const dir = b.clone().sub(a).normalize(),
          tick = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize().multiplyScalar(0.1);
        const pts = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
        const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]]);
        const seg = new THREE.LineSegments(g, lineMat);
        seg.renderOrder = 20;
        seg.userData.labelId = l.id;
        this.dimLines.add(seg);
      }
    }
    this.scene.add(this.dimLines);
    this.updateLabels();
  }
  updateLabels() {
    if (!this.labels.size) return;
    const plan = this.view === "plan",
      inside = this.view === "inside",
      cam = this.active,
      w = this.host.clientWidth,
      h = this.host.clientHeight;
    cam.updateMatrixWorld();
    for (const seg of this.dimLines?.children || []) {
      const l = this.labels.get(seg.userData.labelId);
      seg.visible = !inside && (plan ? !l.outsideOnly : this.showDims);
    }
    for (const l of this.labels.values()) {
      const show = !inside && (l.kind === "dim" ? (plan ? !l.outsideOnly : this.showDims) : plan || this.showDims);
      if (!show) {
        l.el.hidden = true;
        continue;
      }
      const p = (plan && l.planPos ? l.planPos : l.pos).clone().project(cam);
      const visible = p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      l.el.hidden = !visible;
      if (visible) l.el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -50%)`;
    }
  }

  loop(now) {
    this.frame = requestAnimationFrame(this.loop);
    if (this.anim) this.anim(now);
    let changed = false;
    if (this.view === "plan") changed = this.planControls.update();
    else if (!this.anim) changed = this.controls.update();
    if (this.highlights.length || this.lampFlash) this.tickHighlights(now);
    if (changed || this.dirty) {
      this.renderer.render(this.scene, this.active);
      this.updateLabels();
      this.dirty = false;
      if (this.onReady) {
        this.onReady();
        this.onReady = null;
      }
    }
  }

  // ---- High-resolution captures for the PDF design pack ----
  async capturePack({ width = 2000, height = 1250 } = {}) {
    // Phones render the pack at their tier's size to avoid a memory spike.
    width = Math.min(width, this.tier.capture[0]);
    height = Math.min(height, this.tier.capture[1]);
    await texturesReady();
    const r = this.renderer,
      saved = {
        size: r.getSize(new THREE.Vector2()),
        ratio: r.getPixelRatio(),
        view: this.view,
        lighting: this.lighting,
        dims: this.showDims,
        pos: this.camera.position.clone(),
        target: this.controls.target.clone(),
        fov: this.camera.fov,
        aspect: this.camera.aspect,
        shadow: this.sun.shadow.mapSize.x,
      };
    this.cancelAnimation();
    this.clearHighlights();
    this.overlay.hidden = true;
    if (this.dimLines) this.dimLines.visible = false;
    r.setPixelRatio(1);
    this.sun.shadow.mapSize.set(this.tier.captureShadow, this.tier.captureShadow);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    const shots = {},
      meta = {};
    let ground = null;
    const shoot = (name, w, h, setup) => {
      r.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      const cam = setup() || this.camera;
      r.render(this.scene, cam);
      shots[name] = r.domElement.toDataURL("image/jpeg", 0.88);
    };
    const c = this.config;
    const perspective = (dir, margin = 1.06, box = this.footprintBox()) => () => {
      this.view = "outside";
      this.applyViewVisibility();
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
      const { centre, distance } = this.fitDistance(box, dir, this.camera, margin);
      this.camera.position.copy(centre).addScaledVector(dir.clone().normalize(), distance);
      this.camera.lookAt(centre);
      return this.camera;
    };
    try {
      if (this.lighting !== "day") this.setLighting("day");
      const tall = (on) => this.landscape.traverse((o) => o.userData.tall && (o.visible = on));
      shoot("hero", width, height, perspective(new THREE.Vector3(0.95, 0.4, 1.25)));
      // The PDF cover is a wide band (297 x 142mm).
      shoot("cover", this.tier.cover[0], this.tier.cover[1], perspective(new THREE.Vector3(0.95, 0.36, 1.25), 1.12));
      shoot("front", width, height, perspective(new THREE.Vector3(0.12, 0.22, 1), 1.12));
      shoot("rear", width, height, () => {
        const cam = perspective(c.type === "extension" ? new THREE.Vector3(-1.3, 0.55, 0.55) : new THREE.Vector3(-1, 0.45, -1.15))();
        // Fence and trees stand behind the room; lift them out for this view.
        tall(false);
        return cam;
      });
      tall(true);
      shoot("top", width, height, perspective(new THREE.Vector3(0.6, 1.5, 0.9), 1.05));
      shoot("inside", width, height, () => {
        this.view = "inside";
        this.applyViewVisibility();
        this.camera.fov = 72;
        this.camera.updateProjectionMatrix();
        const pose = this.insidePose();
        this.camera.position.copy(pose.position);
        this.camera.lookAt(pose.target);
        return this.camera;
      });
      shoot("insideOut", width, height, () => {
        const inner = this.innerBox(0.2);
        this.camera.position.set(0, 1.55, inner.min.z);
        this.camera.lookAt(0, 1.2, inner.max.z + 2);
        // Clip furniture right in front of the lens.
        this.camera.near = 0.6;
        this.camera.updateProjectionMatrix();
        return this.camera;
      });
      this.camera.near = 0.05;
      this.camera.updateProjectionMatrix();
      this.setLighting("evening");
      shoot("dusk", width, height, perspective(new THREE.Vector3(0.8, 0.3, 1.25)));
      this.setLighting("day");
      // Orthographic plan and elevations on a plain ground, with world bounds
      // so the PDF can draw true-scale dimensions over them.
      this.view = "plan";
      this.applyViewVisibility();
      // A clean architectural plan: building and decking only, on white.
      this.landscape.visible = false;
      this.shadowDecal.visible = false;
      this.scene.background = new THREE.Color("#ffffff");
      const ortho = new THREE.OrthographicCamera();
      const box = this.footprintBox().expandByScalar(0.45);
      {
        const w = box.max.x - box.min.x,
          d = box.max.z - box.min.z,
          px = Math.min(1600, this.tier.capture[0]),
          ph = Math.round((px * d) / w);
        const W = Math.min(px, Math.round((px * w) / d)),
          H = Math.round((W * d) / w);
        shoot("plan", W, H, () => {
          Object.assign(ortho, { left: box.min.x, right: box.max.x, top: -box.min.z, bottom: -box.max.z, near: 0.1, far: 60 });
          ortho.position.set(0, 30, 0);
          ortho.up.set(0, 0, -1);
          ortho.lookAt(0, 0, 0);
          ortho.updateProjectionMatrix();
          return ortho;
        });
        meta.plan = { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z };
        void ph;
      }
      this.landscape.visible = false;
      this.scene.background = new THREE.Color("#ffffff");
      ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: "#e9e7e1", roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.scene.add(ground);
      const u = this.building.userData;
      u.roof.visible = true;
      u.plan.visible = false;
      this.scene.fog = null;
      this.sky.visible = false;
      meta.elevations = {};
      for (const wall of WALLS) {
        if (c.type === "extension" && wall === "back") continue;
        const L = wallLength(c, wall),
          f = wallFrame(c, wall);
        const ext = Math.max(c.overhang.left, c.overhang.right, c.overhang.front, c.overhang.back, c.decking.left, c.decking.right, c.decking.front, c.decking.back) + 0.5;
        const u0 = -ext,
          u1 = L + ext,
          v0 = -0.25,
          v1 = HEIGHT + 0.35;
        const W = this.tier.elev,
          H = Math.round((W * (v1 - v0)) / (u1 - u0));
        shoot(`elev-${wall}`, W, H, () => {
          const mid = wallPoint(c, wall, (u0 + u1) / 2, (v0 + v1) / 2, 12);
          const look = wallPoint(c, wall, (u0 + u1) / 2, (v0 + v1) / 2, 0);
          Object.assign(ortho, { left: -(u1 - u0) / 2, right: (u1 - u0) / 2, top: (v1 - v0) / 2, bottom: -(v1 - v0) / 2, near: 0.1, far: 40 });
          ortho.up.set(0, 1, 0);
          ortho.position.copy(mid);
          ortho.lookAt(look);
          ortho.updateProjectionMatrix();
          return ortho;
        });
        meta.elevations[wall] = { u0, u1, v0, v1, length: L, rotY: f.rotY };
      }
    } finally {
      // Put the live scene back exactly as it was, even if a capture failed.
      if (ground) {
        this.scene.remove(ground);
        ground.geometry.dispose();
        ground.material.dispose();
      }
      this.landscape.visible = true;
      this.shadowDecal.visible = true;
      this.landscape.traverse((o) => o.userData.tall && (o.visible = true));
      if (this.dimLines) this.dimLines.visible = true;
      this.camera.near = 0.05;
      this.sun.shadow.mapSize.set(saved.shadow, saved.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      r.setPixelRatio(saved.ratio);
      r.setSize(saved.size.x, saved.size.y, false);
      this.camera.aspect = saved.aspect;
      this.camera.fov = saved.fov;
      this.camera.updateProjectionMatrix();
      this.lighting = saved.lighting === "day" ? "evening" : "day";
      this.setLighting(saved.lighting);
      this.view = saved.view;
      this.applyViewVisibility();
      this.camera.position.copy(saved.pos);
      this.controls.target.copy(saved.target);
      this.controls.update();
      if (saved.view === "plan") this.framePlan();
      this.overlay.hidden = false;
      this.setDims(saved.dims);
      this.dirty = true;
    }
    return { shots, meta };
  }

  debug() {
    const count = {};
    this.building?.traverse((o) => {
      if (o.name) count[o.name.split(":")[0]] = (count[o.name.split(":")[0]] || 0) + 1;
    });
    return { view: this.view, lighting: this.lighting, names: count, camera: this.camera.position.toArray().map((n) => +n.toFixed(2)), target: this.controls.target.toArray().map((n) => +n.toFixed(2)), info: this.renderer.info.render, programs: this.renderer.info.programs?.length };
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleLost, false);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.handleRestored, false);
    this.controls.dispose();
    this.planControls.dispose();
    if (this.building) this.disposeGroup(this.building, true);
    if (this.landscape) this.disposeGroup(this.landscape, true);
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    // Hand the GPU context back at once: phones cap how many a page may hold.
    try {
      if (!this.lost) this.renderer.forceContextLoss();
    } catch {
      /* already gone */
    }
    this.renderer.domElement.remove();
  }
}
