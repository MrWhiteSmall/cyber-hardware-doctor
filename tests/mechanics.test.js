import test from "node:test";
import assert from "node:assert/strict";
import {
  angleDelta,
  turnScrew,
  aligned,
  pushPart,
  TAU,
  validAirPuff,
  pullConnector,
  bearingCoast,
  validOilDrop,
  cableContinuity,
} from "../src/mechanics.js";
import { isDirectAction, supportsDirectJob } from "../src/DirectPC.js";
import { createGame } from "../src/game.js";

test("前七关和手机首关的拆装必须在手动模式操作，键盘后两关仍为辅助教学", () => {
  for (const id of [
    "memory",
    "cooling",
    "storage",
    "fan-dust",
    "fan-bearing",
    "fan-cable",
    "keyboard-clean",
    "phone-charge",
  ]) {
    assert.equal(supportsDirectJob(id), true);
    const s = { ...createGame(id), unplugged: true, grounded: true };
    assert.equal(
      isDirectAction(s),
      !["keyboard-clean", "phone-charge"].includes(id),
      "单键先观察，其余关卡的螺丝不能点按钮跳过",
    );
    assert.equal(
      isDirectAction({
        ...s,
        screws: 0,
        panelOpen: true,
        inspected: [
          id === "memory"
            ? "ram"
            : id === "cooling"
              ? "cooler"
              : id === "storage"
                ? "storage"
                : id === "fan-dust"
                  ? "fanBlade"
                  : id === "fan-bearing"
                    ? "fanMotor"
                    : id === "fan-cable"
                      ? "fanCable"
                      : id === "keyboard-clean"
                        ? "keycap"
                        : "phonePort",
        ],
      }),
      true,
    );
    assert.equal(isDirectAction(createGame(id)), false, "安全准备保留界面操作");
  }
  assert.equal(supportsDirectJob("keyboard-switch"), false);
});

test("同样轻拨时润滑后的阻力更小，惯性计算不受帧率影响", () => {
  const dry = bearingCoast(3, 1.5, false),
    oiled = bearingCoast(3, 1.5, true);
  assert.ok(oiled.rotation > dry.rotation * 5);
  assert.ok(oiled.velocity > dry.velocity);
  let v = 3,
    rotation = 0;
  for (let i = 0; i < 150; i++) {
    const next = bearingCoast(v, 0.01, true);
    v = next.velocity;
    rotation += next.rotation;
  }
  assert.ok(Math.abs(rotation - oiled.rotation) < 1e-9);
  assert.equal(bearingCoast(3, 0, true).rotation, 0);
});
test("注油只接受稳定的短按，长挤、轻点即走和偏离孔位都不计入", () => {
  assert.equal(validOilDrop(250, 5), true);
  assert.equal(validOilDrop(40, 0), false);
  assert.equal(validOilDrop(900, 0), false);
  assert.equal(validOilDrop(250, 25), false);
});

test("带锁扣的数据接头要保持释放才能拔出，反向移动不能拔出", () => {
  const p = { x: 0, y: 0, z: 0.14 };
  assert.equal(pullConnector(p, 2, false).blocked, true);
  assert.equal(pullConnector(p, 2, false).z, 0.14);
  assert.equal(pullConnector(p, -2, true).extracted, false);
  assert.equal(pullConnector(p, 0.2, true).extracted, false);
  assert.equal(pullConnector(p, 1, true).extracted, true);
  assert.equal(p.z, 0.14);
});

test("气吹需要稳定瞄准与短促按压，连吹和滑离目标不能清灰", () => {
  assert.equal(validAirPuff(250, 3), true);
  assert.equal(validAirPuff(70, 0), false);
  assert.equal(validAirPuff(1100, 0), false);
  assert.equal(validAirPuff(250, 30), false);
});

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

test("通断证据区分档位、分离、自检、同端和跨导体，并能检出旧线断路", () => {
  const base = {
    mode: "continuity",
    isolated: true,
    red: { end: "a", net: "plus" },
    black: { end: "b", net: "plus" },
    replacement: false,
  };
  assert.equal(cableContinuity({ ...base, mode: "off" }).kind, "off");
  assert.equal(cableContinuity({ ...base, mode: "current" }).kind, "mode");
  assert.equal(cableContinuity({ ...base, isolated: false }).kind, "connected");
  assert.equal(cableContinuity({ ...base, red: null }).kind, "air");
  assert.equal(
    cableContinuity({ ...base, black: { end: "b", net: "minus" } }).kind,
    "cross",
  );
  assert.equal(cableContinuity({ ...base, black: base.red }).kind, "same");
  assert.equal(cableContinuity({ ...base, shorted: true }).beep, true);
  assert.equal(cableContinuity(base).kind, "open");
  assert.equal(cableContinuity({ ...base, replacement: true }).kind, "closed");
  assert.equal(
    cableContinuity({
      ...base,
      red: { end: "b", net: "minus" },
      black: { end: "a", net: "minus" },
    }).beep,
    true,
  );
  assert.equal(
    cableContinuity({ ...base, red: base.black, black: base.red }).kind,
    "open",
  );
});
