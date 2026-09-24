import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STATE,
  DEFAULT_CALIBRATION,
  validState,
  validCalibration,
  move,
  limits,
  gearCount,
  loadMass,
  createAssembly,
  point,
  properties,
  componentProperties,
  physicalModel,
  turningMoment,
  torque,
  potentialEnergy,
  initialDirection,
  advance,
  restore,
} from "../src/model.js";
const near = (a, b, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(a - b) < tolerance,
    `${a} ≠ ${b} (tolerance ${tolerance})`,
  );
test("every legal mounting arrangement preserves both sides and the two pivot columns", () => {
  let count = 0;
  for (let a = 1; a <= 20; a++)
    for (let pivot = 1; pivot <= 20; pivot++)
      for (let b = 1; b <= 20; b++) {
        const s = { ...DEFAULT_STATE, a, pivot, b };
        if (!validState(s)) continue;
        count++;
        for (const part of ["a", "pivot", "b"])
          for (const value of [-100, 0, 1, 10.4, 20, 100]) {
            const next = move(s, part, value);
            assert.ok(validState(next));
            assert.ok(next.a < next.pivot);
            assert.ok(next.b > next.pivot + 1);
            const [min, max] = limits(s, part);
            assert.equal(move(s, part, -100)[part], min);
            assert.equal(move(s, part, 100)[part], max);
          }
      }
  assert.equal(count, 969);
  assert.equal(validState({ ...DEFAULT_STATE, a: 10 }), false);
  assert.equal(validState({ ...DEFAULT_STATE, b: 11 }), false);
  assert.equal(validState({ ...DEFAULT_STATE, pivot: 10.5 }), false);
  assert.deepEqual(move(DEFAULT_STATE, "a", NaN), DEFAULT_STATE);
});
test("both offset connector CAD holes share the shaft axis at every pivot position", () => {
  for (let pivot = 2; pivot <= 18; pivot++) {
    const parts = createAssembly({ ...DEFAULT_STATE, pivot }),
      offsets = parts.filter((p) => p.name === "offset");
    assert.equal(offsets.length, 2);
    for (const part of offsets) {
      // Measured source hole: x=.5, z=-2, through the original Y thickness.
      const axis = point(part, [0.5, 0, -2]);
      near(axis[0], 0);
      near(axis[1], 0);
      for (const angle of [-0.3, 0, 0.3]) {
        near(axis[0] * Math.cos(angle) - axis[1] * Math.sin(angle), 0);
        near(axis[0] * Math.sin(angle) + axis[1] * Math.cos(angle), 0);
      }
      const pinColumns = [
        point(part, [0, 0, 0])[0],
        point(part, [1, 0, 0])[0],
      ].sort();
      assert.deepEqual(pinColumns, [-0.5, 0.5]);
    }
  }
});
test("each load step adds the declared gear and its three pins with no double-counted mass", () => {
  const expected = [6, 17, 22, 33, 38];
  for (let n = 0; n <= 4; n++) {
    const s = { ...DEFAULT_STATE, loadA: n, loadB: n },
      parts = createAssembly(s);
    for (const owner of ["a", "b"]) {
      const group = parts.filter((p) => p.owner === owner),
        g = gearCount(n);
      assert.equal(group.filter((p) => p.name === "pin").length, 5 + g.pins);
      assert.equal(group.filter((p) => p.name === "largeGear").length, g.large);
      assert.equal(group.filter((p) => p.name === "smallGear").length, g.small);
      near(
        group.reduce((total, p) => total + p.mass, 0),
        loadMass(n),
      );
      near(loadMass(n), expected[n]);
    }
  }
});
test("both load brackets seat face-to-face with their 1x1 pins centered in the joints", () => {
  for (const layout of [
    DEFAULT_STATE,
    { ...DEFAULT_STATE, a: 3, pivot: 8, b: 17 },
    { ...DEFAULT_STATE, a: 8, pivot: 9, b: 11 },
  ])
    for (let n = 0; n <= 4; n++) {
      const assembly = createAssembly({ ...layout, loadA: n, loadB: n });
      for (const owner of ["a", "b"]) {
        const sign = owner === "a" ? -1 : 1;
        const parts = assembly.filter((p) => p.owner === owner);
        const corner = parts.find((p) => p.name === "corner");
        const upright = parts.find((p) => p.name === "upright");
        const pins = parts.filter((p) => p.name === "pin");
        const half = properties.upright.bounds[1][2];
        // Source CAD: corner holes at (0/1, Y, -.5); upright's bottom
        // holes at (-1.5, +/-.5, Z). Check their actual mating surfaces.
        const cornerHoles = [0, 1]
          .map((x) => point(corner, [x, properties.corner.bounds[0][1], -0.5]))
          .sort((a, b) => a[2] - b[2]);
        for (const [i, z] of [-0.5, 0.5].entries()) {
          const inner = point(upright, [-1.5, z, -sign * half]);
          inner.forEach((v, axis) => near(v, cornerHoles[i][axis]));
          assert.ok(
            sign * (upright.position[0] - inner[0]) > 0,
            "upright is outside the flange, without intersecting it",
          );
          const pin = pins.find(
            (p) =>
              Math.abs(p.position[1] - inner[1]) < 1e-6 &&
              Math.abs(p.position[2] - inner[2]) < 1e-6,
          );
          assert.ok(pin, "one joining pin on each lower hole axis");
          pin.position.forEach((v, axis) => near(v, inner[axis]));
          const tips = properties.pin.bounds
            .map((b) => point(pin, [0, 0, b[2]])[0])
            .sort((a, b) => a - b);
          // The flange's other face is local Y=-.00984252 in the source CAD.
          const exposedFaces = [
            point(corner, [0, -0.00984252, -0.5])[0],
            point(upright, [-1.5, z, sign * half])[0],
          ].sort((a, b) => a - b);
          // Modeled snap-pin tips extend only about .04 mm past the faces.
          tips.forEach((v, j) => near(v, exposedFaces[j], 0.004));
        }
        const gear = parts.find((p) => p.name === "largeGear");
        for (const [height, z] of [
          [1.5, -0.5],
          [1.5, 0.5],
          [1, 0],
        ]) {
          const joint = point(upright, [height, z, sign * half]);
          const pin = pins.find((p) =>
            p.position.every((v, axis) => Math.abs(v - joint[axis]) < 1e-6),
          );
          assert.ok(
            pin,
            "upper pins are centered on the separate upright/gear interface",
          );
          if (gear) {
            const hole = point(gear, [
              -z,
              height - 2,
              -sign * properties.largeGear.bounds[1][2],
            ]);
            hole.forEach((v, axis) => near(v, joint[axis]));
          }
        }
      }
    }
});
test("CAD-based mass properties are finite and equal end loads balance at the central mounting pair", () => {
  for (let n = 0; n <= 4; n++) {
    const model = physicalModel({ ...DEFAULT_STATE, loadA: n, loadB: n });
    assert.ok(model.inertia > 0 && Number.isFinite(model.inertia));
    assert.ok(model.firstY > 0);
    near(model.firstX, 0, 1e-4);
    assert.equal(initialDirection(model), "balance");
    for (const part of model.parts) {
      const p = componentProperties(part);
      assert.ok(p.center.every(Number.isFinite));
      assert.ok(p.inertia >= 0);
    }
  }
});
test("more mass, more distance, and moving the fulcrum affect the correct side", () => {
  assert.equal(
    initialDirection(physicalModel({ ...DEFAULT_STATE, loadA: 1 })),
    "b",
  );
  assert.equal(
    initialDirection(physicalModel({ ...DEFAULT_STATE, loadB: 1 })),
    "a",
  );
  assert.equal(
    initialDirection(physicalModel({ ...DEFAULT_STATE, a: 4 })),
    "b",
  );
  assert.equal(
    initialDirection(physicalModel({ ...DEFAULT_STATE, b: 17 })),
    "a",
  );
  assert.equal(
    initialDirection(physicalModel({ ...DEFAULT_STATE, pivot: 8 })),
    "b",
  );
  assert.equal(
    initialDirection(physicalModel({ ...DEFAULT_STATE, pivot: 12 })),
    "a",
  );
  const s = { ...DEFAULT_STATE, pivot: 8 };
  const normal = turningMoment(physicalModel(s)),
    lightBeam = turningMoment(
      physicalModel(s, { ...DEFAULT_CALIBRATION, beam: 0.01 }),
    );
  assert.ok(
    normal < lightBeam,
    "the beam adds turning effect when its centre is beyond the shaft",
  );
});
test("torque equals negative potential-energy gradient including the elevated centre of mass", () => {
  const model = physicalModel({ ...DEFAULT_STATE, a: 3, pivot: 9, loadA: 3 });
  for (const angle of [-0.2, 0, 0.2]) {
    const d = 1e-6,
      numerical =
        -(
          potentialEnergy(model, angle + d) - potentialEnergy(model, angle - d)
        ) /
        (2 * d);
    near(torque(model, angle), numerical, 1e-9);
  }
  const centred = physicalModel(DEFAULT_STATE, {
    ...DEFAULT_CALIBRATION,
    friction: 0,
  });
  assert.ok(torque(centred, 0.05) > 0);
  assert.ok(
    torque(centred, -0.05) < 0,
    "loads above the shaft give unstable level equilibrium, not an artificial restoring spring",
  );
});
test("time integration is bounded by contact and consistent across frame rates", () => {
  const model = physicalModel({ ...DEFAULT_STATE, loadA: 1 });
  const simulate = (hz) => {
    let motion = { angle: 0, velocity: 0 };
    for (let i = 0; i < hz * 2; i++) {
      motion = advance(model, motion, 1 / hz);
      assert.ok(
        motion.angle >= model.negativeStop &&
          motion.angle <= model.positiveStop,
      );
    }
    return motion;
  };
  const at30 = simulate(30),
    at60 = simulate(60),
    at120 = simulate(120);
  near(at30.angle, model.negativeStop);
  near(at60.angle, at120.angle);
  near(at30.angle, at60.angle);
  const symmetric = physicalModel(DEFAULT_STATE);
  assert.deepEqual(advance(symmetric, { angle: 0, velocity: 0 }, 0.1), {
    angle: 0,
    velocity: 0,
  });
});
test("friction/damping dissipate energy and high resistance can hold a small imbalance", () => {
  const model = physicalModel({ ...DEFAULT_STATE, loadB: 1 }),
    energy = (m) =>
      potentialEnergy(model, m.angle) + 0.5 * model.inertia * m.velocity ** 2;
  let motion = { angle: 0, velocity: 0 },
    previous = energy(motion);
  for (let i = 0; i < 240; i++) {
    motion = advance(model, motion, 1 / 240);
    const current = energy(motion);
    assert.ok(current <= previous + 1e-8);
    previous = current;
  }
  const small = {
    ...physicalModel(DEFAULT_STATE),
    firstX: 0.1,
    calibration: { ...DEFAULT_CALIBRATION, friction: 0.3 },
  };
  assert.deepEqual(advance(small, { angle: 0, velocity: 0 }, 0.1), {
    angle: 0,
    velocity: 0,
  });
});
test("settings and saved arrangements reject corrupt or physically impossible values", () => {
  assert.ok(validCalibration(DEFAULT_CALIBRATION));
  assert.equal(validCalibration({ ...DEFAULT_CALIBRATION, pin: 4 }), false);
  assert.equal(
    validCalibration({ ...DEFAULT_CALIBRATION, damping: -1 }),
    false,
  );
  const fresh = restore(null);
  assert.deepEqual(restore("garbage"), fresh);
  assert.deepEqual(restore('{"version":1}'), fresh);
  const s = { ...DEFAULT_STATE, a: 3, pivot: 8, loadA: 4 },
    c = { ...DEFAULT_CALIBRATION, beam: 20 };
  assert.deepEqual(
    restore(
      JSON.stringify({
        version: 2,
        state: s,
        calibration: c,
        reducedMotion: true,
      }),
    ),
    { version: 2, state: s, calibration: c, reducedMotion: true },
  );
  assert.deepEqual(
    restore(
      JSON.stringify({
        version: 2,
        state: { ...s, a: 19 },
        calibration: { beam: NaN },
      }),
    ).state,
    DEFAULT_STATE,
  );
});
