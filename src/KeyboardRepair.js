import * as THREE from "three";
import { aligned, pushPart } from "./mechanics.js";
import { createCoolingRepair } from "./CoolingRepair.js";

const BASE = new THREE.Vector3(-1.458, 0.07, 0.34);
const LIFT = 0.68;
const TOLERANCE = 0.065;

export function createKeyboardRig({
  body,
  stockCap,
  box,
  line,
  text,
  materials: m,
}) {
  const root = new THREE.Group();
  body.add(root);
  const cap = new THREE.Group();
  root.add(cap);
  // Hollow keycap, with a real cross-shaped socket visible underneath.
  box(cap, [0.36, 0.35, 0.055], [0, 0, 0.085], m.orange);
  for (const x of [-0.165, 0.165])
    box(cap, [0.03, 0.35, 0.17], [x, 0, -0.025], m.orange);
  for (const y of [-0.16, 0.16])
    box(cap, [0.3, 0.03, 0.17], [0, y, -0.025], m.orange);
  for (const x of [-0.055, 0.055])
    for (const y of [-0.055, 0.055])
      box(cap, [0.055, 0.055, 0.13], [x, y, -0.02], m.dark);
  text(cap, "F", [0, 0, 0.116], 0.08, "#fff4da");
  const housing = box(root, [0.3, 0.3, 0.12], [-1.458, 0.07, 0.23], m.dark);
  const stem = new THREE.Group();
  root.add(stem);
  box(stem, [0.12, 0.045, 0.1], [0, 0, 0], m.gold);
  box(stem, [0.045, 0.12, 0.1], [0, 0, 0], m.gold);
  const puller = new THREE.Group();
  root.add(puller);
  for (const x of [-0.195, 0.195])
    line(
      puller,
      [
        [0, 0, 0.5],
        [x, 0, 0.28],
        [x, 0, -0.12],
        [x * 0.7, 0, -0.12],
      ],
      m.silver,
      0.012,
    );
  box(puller, [0.16, 0.09, 0.3], [0, 0, 0.59], m.dark);
  const tray = box(root, [0.55, 0.65, 0.07], [-2.35, 0.07, 0.87], m.frame);
  const patches = [];
  const crumbMat = new THREE.MeshStandardMaterial({
    color: "#b28d50",
    roughness: 0.95,
  });
  for (const [i, [x, y]] of [
    [-0.12, -0.12],
    [0.12, -0.12],
    [-0.12, 0.12],
    [0.12, 0.12],
  ].entries()) {
    const patch = new THREE.Group();
    patch.position.set(BASE.x + x, BASE.y + y, 0.325);
    patch.userData.zone = "碎屑";
    root.add(patch);
    for (let j = 0; j < 4; j++) {
      const crumb = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.025 + (j % 2) * 0.008, 0),
        crumbMat,
      );
      crumb.position.set(
        (j % 2) * 0.04 - 0.02,
        Math.floor(j / 2) * 0.04 - 0.02,
        0,
      );
      crumb.rotation.set(j, i, 0.4);
      patch.add(crumb);
    }
    patches.push(patch);
  }
  return { root, body, stockCap, cap, stem, housing, puller, tray, patches };
}

export function createKeyboardRepair({
  rig,
  scene,
  target,
  planePoint,
  latest,
}) {
  let pose = { x: 0, y: 0, z: 0 },
    phase = "engage",
    key = "",
    note = "",
    gesture = null;
  let toolEnd = "keycap",
    engaged = false,
    pressDepth = 0,
    returns = 0,
    returning = false,
    lastTime = null;
  const axis = () =>
    new THREE.Vector3(0, 0, 1).transformDirection(rig.body.matrixWorld);
  const world = (p) => rig.body.localToWorld(p.clone());
  const capPoint = () =>
    world(BASE.clone().add(new THREE.Vector3(pose.x, pose.y, pose.z)));
  const stemPoint = () => world(new THREE.Vector3(BASE.x, BASE.y, 0.34));
  const projectPlane = (point) => {
    const n = axis();
    return planePoint(point, capPoint().dot(n), n);
  };
  const cleaning = createCoolingRepair({
    scene,
    patches: rig.patches,
    target,
    planePoint,
    latest,
    jobId: "keyboard-clean",
    partId: "keycap",
    holdRequired: false,
  });
  const installing = () => phase === "seat";
  function status() {
    note = aligned(pose, 0, TOLERANCE)
      ? "十字轴已对准，仍未安装。切换「沿轴压入」，握住键帽沿箭头主动压到底。"
      : "平移键帽对准固定十字轴，方向键可微调；只对齐不会装上。";
  }
  return {
    targets(game) {
      if (game.repairStep === 1) return cleaning.targets(game);
      if (phase === "press")
        return [
          target(
            "key-press",
            capPoint(),
            `沿箭头按下键帽，松手观察回弹 · ${returns}/3`,
            axis().negate(),
          ),
        ];
      if (installing())
        return [
          target("key-cap", capPoint(), "键帽 · 握住移动", axis().negate()),
          { ...target("key-stem", stemPoint(), "十字轴 · 固定"), guide: true },
        ];
      return [
        target(
          phase === "engage" ? "key-puller" : "key-cap",
          phase === "engage"
            ? capPoint().add(axis().multiplyScalar(0.2))
            : capPoint(),
          phase === "engage"
            ? "拔键端：沿箭头下套，让两侧钢丝扣到键帽下沿"
            : phase === "lift"
              ? "两侧均匀，沿垂直于键盘的方向提起"
              : "已脱离轴心，松手后移到左侧零件盘",
          phase === "engage"
            ? axis().negate()
            : phase === "lift"
              ? axis()
              : new THREE.Vector3(-1, 0, 0),
        ),
      ];
    },
    begin(hit, point) {
      if (latest.current.game.repairStep === 1) {
        cleaning.begin(hit, point);
        return;
      }
      if (returning) {
        note = "先松手，观察键帽回到原高度，再按下一次。";
        return;
      }
      if (phase === "engage" && toolEnd !== "keycap") {
        note =
          "工作端不对：拔轴端会夹轴体卡扣。本关只取键帽，请切换「钢丝拔键端」。";
        return;
      }
      gesture = {
        id: hit.id,
        start: point,
        previous: point,
        axis: hit.axis,
        pose: { ...pose },
        plane: projectPlane(point),
        travel: 0,
        done: false,
      };
      note = "";
    },
    hover(point) {
      cleaning.hover(point);
    },
    move(point, shiftKey) {
      if (latest.current.game.repairStep === 1) {
        cleaning.move(point);
        return;
      }
      if (!gesture) return;
      const g = gesture;
      if (
        phase === "park" ||
        (installing() && !shiftKey && !latest.current.pushMode)
      ) {
        const p = projectPlane(point);
        if (!p || !g.plane) return;
        const delta = rig.body
          .worldToLocal(p)
          .sub(rig.body.worldToLocal(g.plane.clone()));
        pose.x = g.pose.x + delta.x;
        pose.y = g.pose.y + delta.y;
        if (phase === "park") {
          pose.x = Math.max(-0.9, Math.min(0, pose.x));
          pose.y = 0;
          g.done = pose.x <= -0.8;
          note = "键帽已脱离轴心。沿箭头移到左侧零件盘，露出键下区域。";
        } else status();
      } else {
        const a = g.axis;
        if (!a || Math.hypot(a.x, a.y) < 8) {
          note = "点「按键近景」，让上下操作方向可见。";
          return;
        }
        const side =
          Math.abs((point.x - g.start.x) * a.y - (point.y - g.start.y) * a.x) /
          Math.hypot(a.x, a.y);
        if (side > 24) {
          note = "偏离轴线了：两侧均匀施力，不要横掰键帽或撬轴体。";
          g.previous = point;
          return;
        }
        const distance =
          ((point.x - g.previous.x) * a.x + (point.y - g.previous.y) * a.y) /
          (a.x * a.x + a.y * a.y);
        if (phase === "engage") {
          g.travel = Math.max(0, g.travel + distance);
          g.done = g.travel >= 0.18;
          note = g.done
            ? "两侧钢丝已扣到键帽下沿。松手后沿向外箭头垂直提起。"
            : "让两侧钢丝均匀下套，扣住键帽下沿；点击不会完成。";
        } else if (phase === "lift") {
          pose.z = Math.max(0, Math.min(LIFT, pose.z + distance));
          g.done = pose.z >= LIFT;
          note = g.done
            ? "键帽已拔离十字轴。先松手，再握住标记移到旁边。"
            : "沿轴线平直提起，轴体留在定位板上。";
        } else if (installing()) {
          if (!aligned(pose, 0, TOLERANCE))
            note = "十字轴尚未对准，不能硬压。先平移或微调键帽位置。";
          else {
            const next = pushPart(pose, 0, distance);
            pose = { x: next.x, y: next.y, z: next.z };
            g.done = next.seated;
            note = g.done
              ? "键帽已压到安装深度。松手后还需按压三次检查回弹。"
              : "沿十字轴方向主动压回，继续压到底。";
          }
        } else if (phase === "press") {
          pressDepth = Math.max(0, Math.min(0.08, pressDepth + distance));
          g.done = pressDepth >= 0.065;
          note = g.done
            ? "已按到底，松手观察是否完整回弹。"
            : "握住键帽标记沿箭头按下；点击不算回弹检查。";
        }
      }
      g.previous = point;
    },
    finish(cancelled) {
      if (latest.current.game.repairStep === 1)
        return cleaning.finish(cancelled);
      const g = gesture;
      gesture = null;
      if (!g) return false;
      if (phase === "press" && pressDepth > 0) returning = { valid: false };
      if (cancelled || !g.done) return false;
      if (phase === "engage") {
        engaged = true;
        phase = "lift";
        note = "两侧钢丝已扣住，握住标记沿箭头垂直提起。";
      } else if (phase === "lift") {
        phase = "park";
        note = "先轴向拔开，再移到左侧；轴体保持安装。";
      } else if (phase === "park") {
        engaged = false;
        return true;
      } else if (installing()) {
        phase = "press";
        pose = { x: 0, y: 0, z: 0 };
        note = "安装完成，还要沿箭头按下并松手，观察回弹，连续检查三次。";
      } else if (phase === "press") {
        returning = { valid: true };
      }
      return false;
    },
    setEnd(value) {
      if (phase === "engage" && ["keycap", "switch"].includes(value)) {
        toolEnd = value;
        note = "";
      }
    },
    nudge(dx, dy) {
      if (!installing() || gesture || latest.current.game.tool !== "hand")
        return;
      const t = target("point", capPoint(), ""),
        p = projectPlane(t),
        q = projectPlane({ x: t.x + dx, y: t.y + dy });
      if (!p || !q) return;
      const delta = rig.body
        .worldToLocal(q)
        .sub(rig.body.worldToLocal(p))
        .setLength(0.025);
      pose.x += delta.x;
      pose.y += delta.y;
      status();
    },
    update(game, direct, time) {
      const enabled = direct && game.jobId === "keyboard-clean";
      const nextKey = `${enabled}:${game.jobId}:${game.repairStep}:${game.fixed}`;
      if (key !== nextKey) {
        key = nextKey;
        gesture = null;
        note = "";
        engaged = false;
        pressDepth = 0;
        returns = 0;
        returning = false;
        phase =
          game.repairStep === 0
            ? "engage"
            : game.repairStep === 1
              ? "clean"
              : "seat";
        pose =
          game.repairStep >= 1 && !game.fixed
            ? { x: -0.88, y: 0, z: LIFT }
            : { x: 0, y: 0, z: 0 };
      }
      const dt =
        lastTime === null ? 0 : Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;
      if (enabled && phase === "press" && returning) {
        pressDepth *= Math.exp(-18 * dt);
        if (pressDepth < 0.002) {
          pressDepth = 0;
          if (returning.valid) returns++;
          returning = false;
          note = `键帽已回到原高度，回弹检查 ${returns}/3。`;
        }
      }
      if (
        enabled &&
        phase === "press" &&
        returns >= 3 &&
        game.tool === "hand" &&
        game.selected === "keycap"
      )
        latest.current.act("repair");
      cleaning.update(game, direct);
      rig.root.visible = game.jobId === "keyboard-clean";
      rig.stockCap.visible = game.jobId !== "keyboard-clean";
      rig.cap.position
        .copy(BASE)
        .add(new THREE.Vector3(pose.x, pose.y, pose.z - pressDepth));
      rig.stem.position.set(BASE.x, BASE.y, 0.34 - pressDepth);
      rig.puller.visible =
        enabled && game.repairStep === 0 && game.tool === "puller";
      rig.puller.position
        .copy(rig.cap.position)
        .add(
          new THREE.Vector3(
            0,
            0,
            engaged ? 0 : 0.2 - Math.min(0.18, gesture?.travel || 0),
          ),
        );
      rig.patches.forEach((p) => {
        if (game.repairStep === 0 || game.fixed) p.visible = false;
      });
    },
    hud(game) {
      const clean = game.repairStep === 1;
      return {
        ...(clean ? cleaning.hud(game) : {}),
        keyboardRepair: true,
        keyPhase: phase,
        toolEnd,
        keyReturns: returns,
        canPush: installing(),
        aligned: aligned(pose, 0, TOLERANCE),
        positionAligned: aligned(pose, 0, TOLERANCE),
        directionAligned: true,
        progress: clean
          ? cleaning.hud(game).progress
          : phase === "press"
            ? returns / 3
            : phase === "lift"
              ? pose.z / LIFT
              : 0,
        instruction:
          note ||
          (clean
            ? cleaning.hud(game).instruction
            : {
                engage:
                  "选择拔取器的「钢丝拔键端」，握住标记沿箭头下套，扣住键帽两侧下沿；本关不拔轴体。",
                lift: "两侧已扣住。握住标记沿键盘法线垂直提起，不要横掰。",
                park: "键帽已拔离十字轴，先松手，再向左移到零件盘。",
                seat: "把键帽从左侧平移对准固定十字轴，再切换「沿轴压入」主动压回；对齐不会自动安装。",
                press:
                  "沿箭头按下键帽，松手观察弹回原高度。连续完成三次，验证碎屑不再阻挡回弹。",
              }[phase]),
      };
    },
    dispose() {
      cleaning.dispose();
    },
  };
}
