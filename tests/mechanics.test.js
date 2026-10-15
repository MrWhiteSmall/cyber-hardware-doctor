import test from "node:test";
import assert from "node:assert/strict";
import {
  angleDelta,
  turnScrew,
  aligned,
  pushPart,
  TAU,
} from "../src/mechanics.js";

test("螺丝跨越 ±π 时保持连续；错误方向不能卸下", () => {
  assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-9);
  assert.equal(turnScrew(0, 0.5, false), 0);
  assert.equal(turnScrew(0, -0.5, false), 0.5);
  assert.equal(turnScrew(0, -0.5, true), 0);
  assert.equal(turnScrew(0, 0.5, true), 0.5);
  assert.equal(turnScrew(TAU * 2 - 0.1, 0.5, true), TAU * 2);
});
test("位置对齐不会自动安装，必须另做轴向推入", () => {
  const p = { x: 0, y: 0, z: 1.8 };
  assert.equal(aligned(p, 0), true);
  const untouched = pushPart(p, 0, 0);
  assert.equal(untouched.seated, false);
  assert.equal(untouched.z, 1.8);
  assert.equal(pushPart(p, 0, 0.5).seated, false);
  const seated = pushPart(p, 0, 1.8);
  assert.equal(seated.seated, true);
  assert.equal(seated.z, 0);
  assert.equal(p.z, 1.8, "不修改原始位置");
});
test("方向或横向位置不对会阻挡插入；不能用反向拖动穿透", () => {
  for (const [p, a] of [
    [{ x: 0.3, y: 0, z: 1.8 }, 0],
    [{ x: 0, y: 0.3, z: 1.8 }, 0],
    [{ x: 0, y: 0, z: 1.8 }, Math.PI],
  ]) {
    const next = pushPart(p, a, 10);
    assert.equal(next.blocked, true);
    assert.equal(next.z, 1.8);
    assert.equal(next.seated, false);
  }
  assert.equal(pushPart({ x: 0, y: 0, z: 1.8 }, 0, -2).z, 1.8);
});
