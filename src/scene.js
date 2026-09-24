import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createAssembly,
  physicalModel,
  advance,
  initialDirection,
  pivotX,
  anchorX,
  move,
  BEAM_HEIGHT,
  SHAFT_HEIGHT,
} from "./model.js";
const PALETTE = {
  beam: 0xa9b6b6,
  base: 0x677777,
  connector: 0x354d4d,
  pin: 0x176bc2,
  gear: 0x92a6b1,
  metal: 0xaab7bb,
};
export class WorkshopScene {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.dirty = true;
    this.motion = { angle: 0, velocity: 0 };
    this.held = false;
    this.reduced = false;
    this.drag = null;
    this.selected = null;
    this.hovered = null;
    this.frameTime = null;
    this.active = true;
  }
  async init() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.host.replaceChildren(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute(
      "aria-label",
      "3D lever. Drag either load or the pivot. Drag the background to orbit. Use the selected-part position control as a keyboard alternative.",
    );
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.unavailable = true;
      this.active = false;
      this.callbacks.onUnavailable?.();
    });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe0e7d9);
    this.scene.fog = new THREE.Fog(0xe0e7d9, 65, 145);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 220);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 19;
    this.controls.maxDistance = 65;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.035;
    this.scene.add(new THREE.HemisphereLight(0xfff9e4, 0x788d78, 2.3));
    const sun = new THREE.DirectionalLight(0xfff4dd, 3);
    sun.position.set(-15, 24, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 20,
      bottom: -20,
      near: 1,
      far: 75,
    });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdcecec, 1.8);
    fill.position.set(16, 10, -10);
    this.scene.add(fill);
    this.materials = {};
    for (const [key, color] of Object.entries(PALETTE))
      this.materials[key] = new THREE.MeshStandardMaterial({
        color,
        roughness: key === "metal" ? 0.3 : 0.53,
        metalness: key === "metal" ? 0.7 : 0.08,
      });
    this.glowMaterials = {};
    for (const [key, mat] of Object.entries(this.materials)) {
      this.glowMaterials[key] = mat.clone();
      this.glowMaterials[key].emissive.set(0x31ae44);
      this.glowMaterials[key].emissiveIntensity = 0.42;
    }
    this.makeRoom();
    const [meta, bin] = await Promise.all([
      fetch("./assets/parts.json").then((r) => {
        if (!r.ok) throw Error("Part catalog unavailable");
        return r.json();
      }),
      fetch("./assets/parts.bin.gz").then((r) => {
        if (!r.ok) throw Error("Part meshes unavailable");
        return new Response(
          r.body.pipeThrough(new DecompressionStream("gzip")),
        ).arrayBuffer();
      }),
    ]);
    this.geometries = {};
    for (const [name, m] of Object.entries(meta)) {
      const g = new THREE.BufferGeometry(),
        data = new THREE.InterleavedBuffer(
          new Float32Array(bin, m.offset, m.count * 6),
          6,
        );
      g.setAttribute(
        "position",
        new THREE.InterleavedBufferAttribute(data, 3, 0),
      );
      g.setAttribute(
        "normal",
        new THREE.InterleavedBufferAttribute(data, 3, 3),
      );
      g.computeBoundingBox();
      g.computeBoundingSphere();
      this.geometries[name] = g;
    }
    this.geometries.collar = this.geometries.collar.clone();
    this.geometries.collar.center();
    this.moving = new THREE.Group();
    this.base = new THREE.Group();
    this.scene.add(this.moving, this.base);
    this.pickable = [];
    this.meshes = [];
    this.raycaster = new THREE.Raycaster();
    this.installPointers();
    this.resize(true);
    new ResizeObserver(() => this.resize()).observe(this.host);
    document.addEventListener("visibilitychange", () => {
      this.active = !document.hidden && !this.unavailable;
      this.frameTime = null;
    });
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }
  box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    this.scene.add(m);
    return m;
  }
  makeRoom() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xe0e7d9, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.3;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#bda684";
    ctx.fillRect(0, 0, 512, 512);
    let seed = 74;
    for (let i = 0; i < 250; i++) {
      seed = (seed * 16807) % 2147483647;
      const y = seed % 512;
      ctx.strokeStyle = `rgba(109,76,38,${0.025 + (i % 7) * 0.005})`;
      ctx.lineWidth = 0.4 + (i % 3) * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(120, y + 3, 330, y - 3, 512, y + 1);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 1);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(49, 0.8, 27),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
    );
    table.position.set(0, -0.52, -1.5);
    table.castShadow = true;
    table.receiveShadow = true;
    this.scene.add(table);
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(29, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x426663, roughness: 1 }),
    );
    mat.position.set(0, -0.07, 0);
    mat.receiveShadow = true;
    this.scene.add(mat);
    // Fine, quiet cutting-mat lines, beneath the lever.
    const points = [];
    for (let x = -14; x <= 14; x++)
      points.push(x, -0.022, -5.5, x, -0.022, 5.5);
    for (let z = -5; z <= 5; z++) points.push(-14, -0.022, z, 14, -0.022, z);
    const grid = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      ),
      new THREE.LineBasicMaterial({
        color: 0xa1bdb0,
        transparent: true,
        opacity: 0.13,
      }),
    );
    this.scene.add(grid);
    this.box(4, 0.13, 4.9, 0xece8d6, -18, 0.02, -3);
    this.box(3.8, 0.06, 4.7, 0xfffae9, -18, 0.13, -3);
    // Paper top is y = 0.16; the pencil rests on it and stays inside its edges.
    const pencil = this.box(0.17, 0.17, 4, 0xd4aa56, -18, 0.245, -3);
    pencil.rotation.y = 0.4;
    // A simple saguaro silhouette: a rounded stem and two upward arms.
    const cactus = new THREE.Group();
    cactus.position.set(-18, 0, -10);
    const terracotta = new THREE.MeshStandardMaterial({
      color: 0xc79069,
      roughness: 1,
    });
    const green = new THREE.MeshStandardMaterial({
      color: 0x527e58,
      roughness: 0.85,
    });
    const addProp = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cactus.add(mesh);
      return mesh;
    };
    // The pot bottom meets the tabletop at y = -0.12.
    addProp(
      new THREE.CylinderGeometry(1.1, 0.8, 1.6, 20, 1, true),
      terracotta, 0, 0.68, 0,
    );
    const rim = addProp(
      new THREE.TorusGeometry(1.04, 0.1, 8, 24),
      terracotta, 0, 1.45, 0,
    );
    rim.rotation.x = Math.PI / 2;
    addProp(
      new THREE.CylinderGeometry(0.98, 0.98, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: 0x554a37, roughness: 1 }),
      0, 1.425, 0,
    );
    addProp(new THREE.CapsuleGeometry(0.34, 1.65, 6, 12), green, 0, 2.5, 0);
    for (const [x, y, length, tipY, tipLength] of [
      [-0.77, 2.26, 0.58, 2.56, 0.63],
      [0.72, 2.6, 0.5, 2.97, 0.61],
    ]) {
      const elbow = addProp(
        new THREE.CapsuleGeometry(0.17, length, 5, 12),
        green, x / 2, y, 0,
      );
      elbow.rotation.z = Math.PI / 2;
      addProp(
        new THREE.CapsuleGeometry(0.18, tipLength, 5, 12),
        green, x, tipY, 0,
      );
    }
    const spines = [];
    for (let rib = 0; rib < 6; rib++) {
      const angle = (rib + 0.5) * Math.PI / 3;
      const nx = Math.cos(angle), nz = Math.sin(angle);
      for (const y of [1.85, 2.2, 2.55, 2.9, 3.2]) {
        const x = nx * 0.344, z = nz * 0.344;
        spines.push(
          x, y, z, x + nx * 0.12, y + 0.06, z + nz * 0.12,
          x, y, z, x + nx * 0.1, y - 0.05, z + nz * 0.1,
        );
      }
    }
    cactus.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position", new THREE.Float32BufferAttribute(spines, 3),
      ),
      new THREE.LineBasicMaterial({ color: 0xd6e0a6 }),
    ));
    this.scene.add(cactus);
  }
  setState(state, calibration) {
    this.state = { ...state };
    this.calibration = { ...calibration };
    this.model = physicalModel(state, calibration);
    this.motion = { angle: 0, velocity: 0 };
    this.moving.rotation.z = 0;
    this.moving.clear();
    this.base.clear();
    this.meshes = [];
    this.pickable = [];
    for (const part of createAssembly(state, calibration)) {
      const mesh = new THREE.Mesh(
        this.geometries[part.name],
        this.materials[part.material],
      );
      const r = part.rotation;
      mesh.setRotationFromMatrix(
        new THREE.Matrix4().set(...r[0], 0, ...r[1], 0, ...r[2], 0, 0, 0, 0, 1),
      );
      mesh.position.set(...part.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { part: part.owner, material: part.material };
      (part.moving ? this.moving : this.base).add(mesh);
      this.meshes.push(mesh);
      if (part.owner !== "beam") this.pickable.push(mesh);
    }
    this.moving.position.set(pivotX(state), SHAFT_HEIGHT, 0);
    this.base.position.copy(this.moving.position);
    this.highlight(this.hovered);
    this.dirty = true;
    this.draw();
  }
  setHeld(held) {
    this.held = held;
    if (held) this.motion = { angle: 0, velocity: 0 };
    this.dirty = true;
  }
  level() {
    this.motion = { angle: 0, velocity: 0 };
    this.dirty = true;
  }
  highlight(part) {
    this.hovered = part;
    for (const mesh of this.meshes || [])
      mesh.material =
        mesh.userData.part === (part || this.selected)
          ? this.glowMaterials[mesh.userData.material]
          : this.materials[mesh.userData.material];
    this.dirty = true;
  }
  select(part) {
    this.selected = part;
    this.highlight(this.hovered);
    this.callbacks.onSelect?.(part);
  }
  frame(time) {
    if (!this.active) {
      this.frameTime = null;
      return;
    }
    const dt =
      this.frameTime === null
        ? 0
        : Math.max(0, Math.min((time - this.frameTime) / 1000, 0.1));
    this.frameTime = time;
    const before = this.motion.angle;
    if (this.model) {
      if (this.held || this.drag) this.motion = { angle: 0, velocity: 0 };
      else if (this.reduced) {
        const direction = initialDirection(this.model);
        this.motion = {
          angle:
            direction === "a"
              ? this.model.positiveStop
              : direction === "b"
                ? this.model.negativeStop
                : 0,
          velocity: 0,
        };
      } else this.motion = advance(this.model, this.motion, dt);
      this.moving.rotation.z = this.motion.angle;
    }
    const changed = this.drag ? false : this.controls.update();
    if (changed || this.dirty || before !== this.motion.angle) this.draw();
  }
  draw() {
    if (!this.moving) return;
    // Portrait framing moves the camera back; keep atmosphere behind the model.
    this.scene.fog.near = Math.max(
      65,
      this.camera.position.distanceTo(this.controls.target) + 35,
    );
    this.scene.fog.far = this.scene.fog.near + 80;
    this.moving.rotation.z = this.motion.angle;
    this.scene.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
    this.callbacks.onFrame?.({
      angle: this.motion.angle,
      held: this.held || !!this.drag,
      positions: this.screenPositions(),
      direction: this.model ? initialDirection(this.model) : "balance",
    });
  }
  project(vector) {
    const p = vector.clone().project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.host.clientWidth,
      y: ((1 - p.y) / 2) * this.host.clientHeight,
      visible: p.z >= -1 && p.z <= 1,
    };
  }
  screenPositions() {
    if (!this.state) return {};
    const positions = {};
    for (const part of ["a", "b"]) {
      const p = new THREE.Vector3(
        anchorX(this.state, part) - pivotX(this.state),
        BEAM_HEIGHT + 7.05,
        0,
      );
      this.moving.localToWorld(p);
      positions[part] = this.project(p);
    }
    positions.pivot = this.project(
      new THREE.Vector3(pivotX(this.state), 0.45, 2.2),
    );
    return positions;
  }
  hit(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    return (
      this.raycaster.intersectObjects(this.pickable, false)[0]?.object.userData
        .part || null
    );
  }
  beginDrag(event, part) {
    if (event.button !== 0 || !event.isPrimary || !this.state) return false;
    const a = this.project(
        new THREE.Vector3(-10, SHAFT_HEIGHT + BEAM_HEIGHT, 0),
      ),
      b = this.project(new THREE.Vector3(10, SHAFT_HEIGHT + BEAM_HEIGHT, 0));
    const dx = b.x - a.x,
      dy = b.y - a.y,
      denom = dx * dx + dy * dy;
    this.select(part);
    if (denom < 3600) {
      this.callbacks.onNotice?.(
        "Turn the view a little to drag along the beam. The position slider also works.",
      );
      return false;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    this.drag = {
      part,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue: this.state[part],
      startState: { ...this.state },
      dx,
      dy,
      denom,
      target: event.currentTarget || this.canvas,
    };
    this.controls.enabled = false;
    this.drag.target.setPointerCapture?.(event.pointerId);
    this.motion = { angle: 0, velocity: 0 };
    this.highlight(part);
    this.canvas.style.cursor = "grabbing";
    this.dirty = true;
    return true;
  }
  finishDrag(cancel = false) {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.controls.enabled = true;
    try {
      drag.target.releasePointerCapture?.(drag.pointerId);
    } catch {}
    if (cancel) this.callbacks.onChange?.(drag.startState);
    this.canvas.style.cursor = "grab";
    this.highlight(null);
    this.callbacks.onRelease?.();
    this.dirty = true;
  }
  installPointers() {
    window.addEventListener("blur", () => this.finishDrag(true));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.drag) this.finishDrag(true);
    });
    this.canvas.addEventListener(
      "pointerdown",
      (event) => {
        const part = this.hit(event);
        if (part) this.beginDrag(event, part);
      },
      true,
    );
    this.canvas.addEventListener("pointermove", (event) => {
      if (this.drag) return;
      const part = this.hit(event);
      if (part !== this.hovered) this.highlight(part);
      this.canvas.style.cursor = part ? "grab" : "grab";
    });
    this.canvas.addEventListener("pointerleave", () => {
      if (!this.drag) this.highlight(null);
    });
    window.addEventListener(
      "pointermove",
      (event) => {
        const d = this.drag;
        if (!d || event.pointerId !== d.pointerId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const delta =
          (((event.clientX - d.startX) * d.dx +
            (event.clientY - d.startY) * d.dy) /
            d.denom) *
          20;
        const next = move(this.state, d.part, d.startValue + delta);
        if (next[d.part] !== this.state[d.part])
          this.callbacks.onChange?.(next);
      },
      { capture: true, passive: false },
    );
    window.addEventListener(
      "pointerup",
      (event) => {
        if (this.drag?.pointerId === event.pointerId) {
          event.stopImmediatePropagation();
          this.finishDrag();
        }
      },
      true,
    );
    window.addEventListener(
      "pointercancel",
      (event) => {
        if (this.drag?.pointerId === event.pointerId) this.finishDrag(true);
      },
      true,
    );
    this.canvas.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.finishDrag(true);
        return;
      }
      if (
        this.selected &&
        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      ) {
        event.preventDefault();
        const a = this.project(new THREE.Vector3(-10, 4, 0)),
          b = this.project(new THREE.Vector3(10, 4, 0)),
          sign = b.x >= a.x ? 1 : -1;
        const v =
          event.key === "Home"
            ? -100
            : event.key === "End"
              ? 100
              : this.state[this.selected] +
                (event.key === "ArrowRight" ? 1 : -1) * sign;
        this.callbacks.onChange?.(move(this.state, this.selected, v));
      }
    });
  }
  resize(reset = false) {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = Math.max(65, 55 * Math.max(1, 1.6 / (w / h)));
    if (reset || !this.lastSize) {
      this.resetCamera();
    } else if (
      Math.abs(w / this.lastSize.w - 1) > 0.25 ||
      Math.abs(h / this.lastSize.h - 1) > 0.25
    ) {
      const factor =
        Math.max(1, 1.6 / (w / h)) /
        Math.max(1, 1.6 / (this.lastSize.w / this.lastSize.h));
      this.camera.position
        .sub(this.controls.target)
        .multiplyScalar(factor)
        .add(this.controls.target);
    }
    this.lastSize = { w, h };
    this.dirty = true;
    this.draw();
  }
  resetCamera() {
    const fit = Math.max(
      1,
      1.6 / (this.host.clientWidth / this.host.clientHeight),
    );
    this.camera.position.set(9 * fit, 5 + 11 * fit, 30 * fit);
    this.controls.target.set(0, 5, 0);
    this.controls.maxDistance = Math.max(65, 55 * fit);
    this.controls.update();
    this.draw();
  }
  sideCamera() {
    const fit = Math.max(
      1,
      1.6 / (this.host.clientWidth / this.host.clientHeight),
    );
    this.camera.position.set(0, 5.1, 34 * fit);
    this.controls.target.set(0, 4.8, 0);
    this.controls.update();
    this.draw();
  }
  turn() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.draw();
  }
}
