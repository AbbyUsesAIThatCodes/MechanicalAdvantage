// Ideal, centered lever. Distances are along the beam, measured from the axle.
// A's signed coordinate is negative; B's is positive. Units stay in SI in torque().
export const GRAVITY = 9.81;
export const DEFAULT = Object.freeze({ a: 150, b: 150, massA: 100, massB: 100 });
export const BOUNDS = Object.freeze({ distance: [50, 300, 25], mass: [25, 1000, 25] });
export const PRESETS = Object.freeze({
  equal: { ...DEFAULT },
  double: { a: 200, b: 100, massA: 100, massB: 200 },
  triple: { a: 300, b: 100, massA: 100, massB: 300 },
});
export const massKey = p => p === 'a' ? 'massA' : 'massB';
export function adjust(state, field, value) {
  const [min, max, step] = BOUNDS[field.startsWith('mass') ? 'mass' : 'distance'];
  if (!Number.isFinite(Number(value))) return { ...state };
  return { ...state, [field]: Math.max(min, Math.min(max, Math.round(Number(value) / step) * step)) };
}
export function valid(state) {
  return !!state && Object.keys(DEFAULT).every(k => Number.isFinite(state[k]) && adjust(DEFAULT, k, state[k])[k] === state[k]);
}
export function measures(state, effort = 'a') {
  const load = effort === 'a' ? 'b' : 'a';
  const force = p => state[massKey(p)] / 1000 * GRAVITY;
  const momentA = state.massA * state.a, momentB = state.massB * state.b;
  return {
    effort, load, forceA: force('a'), forceB: force('b'), momentA, momentB,
    torqueA: force('a') * state.a / 1000,
    torqueB: force('b') * state.b / 1000,
    direction: momentA === momentB ? 'balance' : momentA > momentB ? 'a' : 'b',
    ima: state[effort] / state[load],
    neededMass: state[massKey(load)] * state[load] / state[effort],
    forceRatio: force(load) / force(effort),
  };
}
export function torque(state, angle = 0) {
  const m = measures(state);
  return (m.momentA - m.momentB) * GRAVITY / 1e6 * Math.cos(angle);
}
export const STOP = Math.PI / 15;
export function advance(state, motion, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return { ...motion };
  const count = Math.ceil(Math.min(seconds, .1) * 240), dt = Math.min(seconds, .1) / count;
  const inertia = state.massA / 1000 * (state.a / 1000) ** 2 + state.massB / 1000 * (state.b / 1000) ** 2;
  let {angle, velocity} = motion;
  for (let i = 0; i < count; i++) {
    // Damping is visual settling, not a static friction threshold.
    velocity = (velocity + torque(state, angle) / inertia * dt) * Math.exp(-4 * dt);
    angle += velocity * dt;
    if (Math.abs(angle) > STOP) { angle = Math.sign(angle) * STOP; velocity = 0; }
  }
  return {angle, velocity};
}
