import {
  createAssembly,
  componentProperties,
  point,
  properties,
  SHAFT_HEIGHT,
  PITCH,
  DEFAULT_CALIBRATION,
  DEFAULT_STATE,
  validState,
  validCalibration,
} from "./assembly.js";
export * from "./assembly.js";
const GRAVITY = 9.80665;
export function physicalModel(state, calibration = DEFAULT_CALIBRATION) {
  const parts = createAssembly(state, calibration).filter((p) => p.moving),
    components = parts.map(componentProperties);
  const totalMass = components.reduce((sum, p) => sum + p.mass, 0);
  const firstX = components.reduce((sum, p) => sum + p.mass * p.center[0], 0),
    firstY = components.reduce((sum, p) => sum + p.mass * p.center[1], 0);
  const inertia =
    components.reduce((sum, p) => sum + p.inertia, 0) * 0.001 * PITCH ** 2;
  // Conservative table contact: the transformed CAD bounding boxes cannot pass below the mat.
  const corners = parts.flatMap((p) => {
    const [lo, hi] = properties[p.name].bounds;
    return [lo[0], hi[0]].flatMap((x) =>
      [lo[1], hi[1]].flatMap((y) =>
        [lo[2], hi[2]].map((z) => point(p, [x, y, z])),
      ),
    );
  });
  const clear = (angle) =>
    corners.every(
      ([x, y]) =>
        SHAFT_HEIGHT + x * Math.sin(angle) + y * Math.cos(angle) >= 0.03,
    );
  const stop = (sign) => {
    let lo = 0,
      hi = Math.PI / 3;
    for (let i = 0; i < 38; i++) {
      const mid = (lo + hi) / 2;
      if (clear(sign * mid)) lo = mid;
      else hi = mid;
    }
    return sign * lo;
  };
  return {
    parts,
    components,
    totalMass,
    firstX,
    firstY,
    inertia,
    negativeStop: stop(-1),
    positiveStop: stop(1),
    calibration,
  };
}
export function turningMoment(model, angle = 0) {
  return -(model.firstX * Math.cos(angle) - model.firstY * Math.sin(angle));
} // g × hole spacing
export function torque(model, angle = 0) {
  return turningMoment(model, angle) * 0.001 * PITCH * GRAVITY;
}
export function initialDirection(model) {
  const t = turningMoment(model);
  return Math.abs(t) <= model.calibration.friction + 1e-8
    ? "balance"
    : t > 0
      ? "a"
      : "b";
}
export function potentialEnergy(model, angle) {
  return (
    0.001 *
    PITCH *
    GRAVITY *
    (model.firstX * Math.sin(angle) + model.firstY * Math.cos(angle))
  );
}
export function advance(model, motion, seconds) {
  let { angle, velocity } = motion;
  if (!Number.isFinite(seconds) || seconds <= 0) return { ...motion };
  const n = Math.ceil(Math.min(seconds, 0.1) / (1 / 240)),
    dt = Math.min(seconds, 0.1) / n,
    friction = model.calibration.friction * 0.001 * PITCH * GRAVITY;
  for (let step = 0; step < n; step++) {
    const drive = torque(model, angle);
    if (Math.abs(velocity) < 0.003 && Math.abs(drive) <= friction) {
      velocity = 0;
      continue;
    }
    const resisting =
      friction * Math.sign(Math.abs(velocity) > 0.003 ? velocity : drive);
    let next = velocity + ((drive - resisting) / model.inertia) * dt;
    if (velocity * next < 0 && Math.abs(drive) <= friction) next = 0;
    velocity = next * Math.exp(-model.calibration.damping * dt);
    angle += velocity * dt;
    if (angle > model.positiveStop) {
      angle = model.positiveStop;
      if (velocity > 0) velocity = 0;
    }
    if (angle < model.negativeStop) {
      angle = model.negativeStop;
      if (velocity < 0) velocity = 0;
    }
  }
  return { angle, velocity };
}
export function restore(raw) {
  const fresh = {
    version: 2,
    state: { ...DEFAULT_STATE },
    calibration: { ...DEFAULT_CALIBRATION },
    reducedMotion: false,
  };
  try {
    const p = JSON.parse(raw);
    if (p.version !== 2) return fresh;
    return {
      version: 2,
      state: validState(p.state || {}) ? p.state : fresh.state,
      calibration: validCalibration(p.calibration || {})
        ? p.calibration
        : fresh.calibration,
      reducedMotion: p.reducedMotion === true,
    };
  } catch {
    return fresh;
  }
}
