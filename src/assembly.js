import properties from "./part-properties.json" with { type: "json" };
export const PITCH = 0.0127; // metres, one VEX IQ hole spacing
export const SHAFT_HEIGHT = 1.49;
export const BEAM_HEIGHT = 2.24; // beam centre above shaft
export const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
export const BEAM_ROTATION = [
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
];
export const FAR_CONNECTOR_ROTATION = [
  [-1, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
];
export const FACE_ROTATION = [
  [0, 0, 1],
  [0, 1, 0],
  [-1, 0, 0],
];
export const UPRIGHT_ROTATION = [
  [0, 0, 1],
  [1, 0, 0],
  [0, 1, 0],
];
export const rotate = (r, v) =>
  r.map((row) => row.reduce((sum, x, i) => sum + x * v[i], 0));
export const point = (part, p) =>
  rotate(part.rotation, p).map((v, i) => v + part.position[i]);
const volume = (name) => properties[name].volumeCm3;
const estimatedDensity =
  6 / (volume("corner") + volume("upright") + 5 * volume("pin"));
export const DEFAULT_CALIBRATION = Object.freeze({
  beam: volume("beam") * estimatedDensity,
  bracket: 6,
  large: 11,
  small: 5,
  pin: volume("pin") * estimatedDensity,
  connector: volume("offset") * estimatedDensity,
  friction: 0.3,
  damping: 2.4,
});
export const DEFAULT_STATE = Object.freeze({
  a: 1,
  pivot: 10,
  b: 20,
  loadA: 2,
  loadB: 2,
});
export function masses(c = DEFAULT_CALIBRATION) {
  const structure = c.bracket - 5 * c.pin;
  return {
    beam: c.beam,
    pin: c.pin,
    largeGear: c.large - 3 * c.pin,
    smallGear: c.small - 3 * c.pin,
    offset: c.connector,
    corner:
      (structure * volume("corner")) / (volume("corner") + volume("upright")),
    upright:
      (structure * volume("upright")) / (volume("corner") + volume("upright")),
  };
}
export function validState(s) {
  return (
    ["a", "pivot", "b", "loadA", "loadB"].every((k) =>
      Number.isInteger(s[k]),
    ) &&
    s.a >= 1 &&
    s.b <= 20 &&
    s.a < s.pivot &&
    s.b > s.pivot + 1 &&
    s.loadA >= 0 &&
    s.loadA <= 4 &&
    s.loadB >= 0 &&
    s.loadB <= 4
  );
}
export function limits(s, part) {
  return part === "a"
    ? [1, s.pivot - 1]
    : part === "b"
      ? [s.pivot + 2, 20]
      : [s.a + 1, s.b - 2];
}
export function move(s, part, value) {
  if (!["a", "b", "pivot"].includes(part) || !Number.isFinite(value))
    return { ...s };
  const [min, max] = limits(s, part);
  return { ...s, [part]: Math.max(min, Math.min(max, Math.round(value))) };
}
export const pivotX = (s) => s.pivot - 10;
export const anchorX = (s, part) =>
  part === "pivot" ? pivotX(s) : s[part] - 10.5;
export const gearCount = (n) => ({
  large: Math.ceil(n / 2),
  small: Math.floor(n / 2),
  pins: 3 * n,
});
export function loadMass(n, c = DEFAULT_CALIBRATION) {
  const g = gearCount(n);
  return c.bracket + g.large * c.large + g.small * c.small;
}
export function validCalibration(c) {
  return (
    ["beam", "bracket", "large", "small", "pin", "connector"].every(
      (k) => Number.isFinite(c[k]) && c[k] > 0 && c[k] <= 100,
    ) &&
    c.bracket > 5 * c.pin &&
    c.large > 3 * c.pin &&
    c.small > 3 * c.pin &&
    Number.isFinite(c.friction) &&
    c.friction >= 0 &&
    c.friction <= 5 &&
    Number.isFinite(c.damping) &&
    c.damping >= 0 &&
    c.damping <= 12
  );
}
export function createAssembly(s, c = DEFAULT_CALIBRATION) {
  if (!validState(s) || !validCalibration(c))
    throw new RangeError("Invalid assembly or mass settings");
  const parts = [],
    mass = masses(c),
    px = pivotX(s);
  const add = (
    name,
    owner,
    position,
    rotation = IDENTITY,
    moving = true,
    material,
  ) => {
    parts.push({
      name,
      owner,
      position,
      rotation,
      moving,
      mass: mass[name] || 0,
      material:
        material ||
        {
          pin: "pin",
          offset: "connector",
          corner: "connector",
          largeGear: "gear",
          smallGear: "gear",
          shaft: "metal",
          collar: "connector",
          angle: "base",
          standoff: "pin",
        }[name] ||
        "beam",
    });
  };
  add("beam", "beam", [-px, BEAM_HEIGHT, 0], BEAM_ROTATION);
  const angle = (-5 * Math.PI) / 6,
    baseRotation = [
      [Math.cos(angle), -Math.sin(angle), 0],
      [Math.sin(angle), Math.cos(angle), 0],
      [0, 0, 1],
    ];
  for (const z of [-1.25, 1.25])
    add("angle", "pivot", [0, 0, z], baseRotation, false);
  for (const x of [-Math.sqrt(3), Math.sqrt(3)])
    add("standoff", "pivot", [x, -1, 1], IDENTITY, false);
  add("shaft", "pivot", [0, 0, -0.83], IDENTITY, false);
  add("collar", "pivot", [0, 0, 1.77], IDENTITY, false);
  // Both actual CAD shaft holes are at x=.5, z=-2. The pins are at x=0 and x=1.
  add("offset", "pivot", [-0.5, 2, 0.5], BEAM_ROTATION);
  add("offset", "pivot", [0.5, 2, -0.5], FAR_CONNECTOR_ROTATION);
  // Seat each upright against the corner's outer face. A 1x1 pin is
  // double-ended: its middle belongs at the interface between the two parts.
  const beamSurface = properties.beam.bounds[1][2];
  const cornerFace = -properties.corner.bounds[0][1];
  const uprightHalfThickness = properties.upright.bounds[1][2];
  const uprightOffset = cornerFace + uprightHalfThickness;
  const gearMountFace = uprightOffset + uprightHalfThickness;
  const firstGearOffset = gearMountFace + properties.largeGear.bounds[1][2];
  for (const owner of ["a", "b"]) {
    const sign = owner === "a" ? -1 : 1,
      anchor = anchorX(s, owner) - px,
      n = s[owner === "a" ? "loadA" : "loadB"];
    const local = (x, y, z) => [anchor + x, BEAM_HEIGHT + y, z];
    const cornerRotation = [
      [0, -sign, 0],
      [0, 0, -1],
      [sign, 0, 0],
    ];
    add("corner", owner, local(0, beamSurface, -sign * 0.5), cornerRotation);
    add(
      "upright",
      owner,
      local(sign * uprightOffset, beamSurface + 2, 0),
      UPRIGHT_ROTATION,
    );
    // The two lower pins bridge corner/upright; the three upper pins bridge
    // upright/first gear. These joints are on opposite faces of the upright.
    for (const z of [-0.5, 0.5])
      add(
        "pin",
        owner,
        local(sign * cornerFace, beamSurface + 0.5, z),
        FACE_ROTATION,
      );
    for (const [y, z] of [
      [3.5, -0.5],
      [3.5, 0.5],
      [3, 0],
    ])
      add(
        "pin",
        owner,
        local(sign * gearMountFace, beamSurface + y, z),
        FACE_ROTATION,
      );
    for (let i = 0; i < n; i++) {
      const large = i % 2 === 0,
        x = firstGearOffset + i * 0.51;
      add(
        large ? "largeGear" : "smallGear",
        owner,
        local(sign * x, beamSurface + 4, 0),
        FACE_ROTATION,
      );
      for (const [y, z] of large
        ? [
            [4.5, -0.5],
            [4.5, 0.5],
            [5, 0],
          ]
        : [
            [3.5, -0.5],
            [3.5, 0.5],
            [3, 0],
          ])
        add(
          "pin",
          owner,
          local(sign * (x + 0.25), beamSurface + y, z),
          FACE_ROTATION,
        );
    }
  }
  return parts;
}
export function componentProperties(part) {
  const raw = properties[part.name],
    center = point(part, raw.center),
    r = part.rotation;
  const localAxis = r[2]; // R^T times the world rotation axis Z
  let intrinsic = 0;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      intrinsic += localAxis[i] * raw.inertiaPerMass[i][j] * localAxis[j];
  return {
    mass: part.mass,
    center,
    inertia: part.mass * (intrinsic + center[0] ** 2 + center[1] ** 2),
  };
}
export { properties };
