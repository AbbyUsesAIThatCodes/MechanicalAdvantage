import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
test("all CAD buffers are present, finite, and within their declared bounds", () => {
  const meta = JSON.parse(readFileSync("public/assets/parts.json", "utf8"));
  const bytes = gunzipSync(readFileSync("public/assets/parts.bin.gz"));
  assert.equal(Object.keys(meta).length, 11);
  for (const [name, m] of Object.entries(meta)) {
    assert.ok(m.offset + m.count * 24 <= bytes.length, name);
    assert.equal(m.count % 3, 0, name);
    for (let vertex = 0; vertex < m.count; vertex++)
      for (let axis = 0; axis < 6; axis++) {
        const value = bytes.readFloatLE(m.offset + vertex * 24 + axis * 4);
        assert.ok(Number.isFinite(value), name);
        if (axis < 3)
          assert.ok(
            value >= m.min[axis] - 0.0001 && value <= m.max[axis] + 0.0001,
            name,
          );
      }
  }
  assert.ok(meta.beam.max[0] - meta.beam.min[0] > 19.9);
  assert.ok(meta.shaft.max[2] - meta.shaft.min[2] > 5.8);
  assert.ok(meta.largeGear.max[0] > meta.smallGear.max[0]);
});

test("the actual offset mesh has its lower shaft-hole ring halfway between mounting pins", () => {
  const meta = JSON.parse(
    readFileSync("public/assets/parts.json", "utf8"),
  ).offset;
  const bytes = gunzipSync(readFileSync("public/assets/parts.bin.gz"));
  const ring = [];
  for (let i = 0; i < meta.count; i++) {
    const x = bytes.readFloatLE(meta.offset + i * 24);
    const z = bytes.readFloatLE(meta.offset + i * 24 + 8);
    if (Math.abs(Math.hypot(x - 0.5, z + 2) - 0.25) < 0.008) ring.push([x, z]);
  }
  assert.ok(
    ring.length > 200,
    "a complete shaft-hole ring, not a few incidental vertices",
  );
  const mean = (axis) =>
    ring.reduce((sum, p) => sum + p[axis], 0) / ring.length;
  assert.ok(Math.abs(mean(0) - 0.5) < 0.007);
  assert.ok(Math.abs(mean(1) + 2) < 0.007);
  assert.ok(Math.min(...ring.map((p) => p[0])) < 0.26);
  assert.ok(Math.max(...ring.map((p) => p[0])) > 0.74);
});
