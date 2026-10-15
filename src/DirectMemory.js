import * as THREE from "three";
import { objective } from "./game.js";
import { TAU, angleDelta, turnScrew, aligned, pushPart } from "./mechanics.js";

export const isDirectAction = (game) =>
  game.jobId === "memory" &&
  ["unscrew", "screw", "open", "close", "repair"].includes(
    objective(game).action,
  );

export function createDirectMemory({
  host,
  renderer,
  camera,
  controls,
  scene,
  panel,
  screws,
  ram,
  latches,
  latest,
}) {
  let key = "",
    active = false,
    gesture = null,
    progress = 0,
    note = "",
    lastHud = 0;
  let pose = { x: 0, y: 0, z: 0 },
    cover = { x: 0, y: 0, z: 0 },
    angle = 0;
  let latchOpen = [false, false],
    currentTargets = [];
  const canvas = renderer.domElement;
  const projection = (vector) => {
    const p = vector.clone().project(camera);
    return {
      x: (p.x * 0.5 + 0.5) * host.clientWidth,
      y: (-p.y * 0.5 + 0.5) * host.clientHeight,
    };
  };
  const projectAxis = (world, axis) => {
    const start = projection(world),
      end = projection(world.clone().add(axis));
    return { x: end.x - start.x, y: end.y - start.y };
  };
  const local = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const planePoint = (point, z) => {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        (point.x / host.clientWidth) * 2 - 1,
        (-point.y / host.clientHeight) * 2 + 1,
      ),
      camera,
    );
    return ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -z),
      new THREE.Vector3(),
    );
  };
  const tool = new THREE.Group();
  scene.add(tool);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.65, 12),
    new THREE.MeshStandardMaterial({
      color: "#aab2ad",
      metalness: 0.8,
      roughness: 0.3,
    }),
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.34;
  tool.add(shaft);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.45, 12),
    new THREE.MeshStandardMaterial({ color: "#d87746" }),
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.88;
  tool.add(handle);
  const ghost = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.24, 1.7, 0.45)),
    new THREE.LineBasicMaterial({
      color: "#d48f5d",
      transparent: true,
      opacity: 0.7,
    }),
  );
  ghost.position.set(0.67, 3.65, -0.08);
  scene.add(ghost);
  const target = (id, world, label, axis = null) => ({
    id,
    ...projection(world),
    label,
    world,
    axis: axis ? projectAxis(world, axis) : null,
  });
  function targets(game, goal) {
    if (goal.action === "unscrew" || goal.action === "screw") {
      const index = goal.action === "unscrew" ? game.screws - 1 : game.screws;
      return [
        target(
          "screw",
          screws[index].getWorldPosition(new THREE.Vector3()),
          goal.action === "screw" ? "顺时针旋紧" : "逆时针旋松",
        ),
      ];
    }
    if (goal.action === "open" || goal.action === "close") {
      const result = [
        target(
          "cover",
          new THREE.Vector3(cover.x, 2.7 + cover.y, 1.25 + cover.z),
          goal.action === "open"
            ? "握住侧板，向左平移"
            : "平移对齐 → 按住 Shift 推入",
          new THREE.Vector3(
            goal.action === "open" ? -1 : 0,
            0,
            goal.action === "open" ? 0 : -1,
          ),
        ),
      ];
      if (goal.action === "close")
        result.push({
          ...target(
            "cover-guide",
            new THREE.Vector3(0, 2.7, 1.25 + cover.z),
            "对位参考",
          ),
          guide: true,
        });
      return result;
    }
    if (
      goal.action === "repair" &&
      (game.repairStep === 0 || game.repairStep === 3)
    )
      return latches.map((latch, i) =>
        target(
          `latch${i}`,
          latch.getWorldPosition(new THREE.Vector3()),
          latchOpen[i] ? "卡扣已打开" : "卡扣已锁住",
          new THREE.Vector3(
            0,
            (i === 0 ? -1 : 1) * (game.repairStep === 0 ? 1 : -1),
            0,
          ),
        ),
      );
    if (goal.action === "repair") {
      const result = [
        target(
          "ram",
          new THREE.Vector3(0.67 + pose.x, 3.65 + pose.y, 0.16 + pose.z),
          game.repairStep === 1
            ? "沿箭头平直取出"
            : "拖动对齐 · R 旋转 · Shift＋拖动推入",
          new THREE.Vector3(0, 0, game.repairStep === 1 ? 1 : -1),
        ),
      ];
      if (game.repairStep === 2)
        result.push({
          ...target(
            "ram-guide",
            new THREE.Vector3(0.67, 3.65, 0.16 + pose.z),
            "对位参考",
          ),
          guide: true,
        });
      return result;
    }
    return [];
  }
  function begin(e) {
    if (!active || e.button !== 0) return;
    const game = latest.current.game,
      goal = objective(game),
      point = local(e);
    const hit = currentTargets.find(
      (t) =>
        !t.guide &&
        Math.hypot(t.x - point.x, t.y - point.y) < (t.id === "screw" ? 37 : 32),
    );
    if (!hit) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (game.tool !== goal.tool) {
      note = `先选择「${goal.tool === "driver" ? "螺丝刀" : "拆装"}」工具，不能空手完成这一步。`;
      return;
    }
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    if (goal.action === "repair") latest.current.act("select", "ram");
    const objectPose = hit.id === "cover" ? cover : pose;
    gesture = {
      id: hit.id,
      start: point,
      previous: point,
      world: hit.world.clone(),
      axis: hit.axis,
      pose: { ...objectPose },
      angle: Math.atan2(point.y - hit.y, point.x - hit.x),
      center: { x: hit.x, y: hit.y },
      push: e.shiftKey || latest.current.pushMode,
      plane: planePoint(point, hit.world.z),
      done: false,
    };
    note = "";
  }
  function move(e) {
    if (!gesture) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const game = latest.current.game,
      goal = objective(game),
      point = local(e),
      g = gesture;
    if (g.id === "screw") {
      const next = Math.atan2(point.y - g.center.y, point.x - g.center.x);
      if (Math.hypot(point.x - g.center.x, point.y - g.center.y) > 12)
        progress = turnScrew(
          progress,
          angleDelta(g.angle, next),
          goal.action === "screw",
        );
      g.angle = next;
      g.done = progress >= TAU * 2 - 0.03;
      note = g.done ? "螺丝已完成旋拧，松开鼠标取下 / 确认。" : "";
    } else if (g.id.startsWith("latch")) {
      const i = Number(g.id.slice(-1)),
        axis = g.axis;
      const distance =
        ((point.x - g.start.x) * axis.x + (point.y - g.start.y) * axis.y) /
        (axis.x * axis.x + axis.y * axis.y);
      progress = Math.max(0, Math.min(1, distance / 0.25));
      if (progress >= 1) {
        latchOpen[i] = game.repairStep === 0;
        g.done = true;
      }
    } else if (g.id === "ram" && game.repairStep === 1) {
      const a = g.axis;
      const distance =
        ((point.x - g.start.x) * a.x + (point.y - g.start.y) * a.y) /
        (a.x * a.x + a.y * a.y);
      const side =
        Math.abs((point.x - g.start.x) * a.y - (point.y - g.start.y) * a.x) /
        Math.hypot(a.x, a.y);
      if (side > 35) {
        note = "偏离拔出方向了。沿箭头平直拉出，不要掰动金手指。";
        return;
      }
      pose.z = Math.max(0, Math.min(2.2, g.pose.z + distance));
      progress = Math.min(1, pose.z / 1.7);
      g.done = pose.z >= 1.7;
    } else if (g.id === "cover" && goal.action === "open") {
      const p = planePoint(point, g.world.z);
      if (!p || !g.plane) return;
      cover.x = Math.min(0, g.pose.x + p.x - g.plane.x);
      progress = Math.min(1, -cover.x / 1.6);
      g.done = cover.x <= -1.6;
    } else {
      const object = g.id === "cover" ? cover : pose;
      if (g.push) {
        const a = g.axis;
        if (!a || Math.hypot(a.x, a.y) < 8) {
          note = "视角与插入方向重合，请旋转一下视角，让轴线可见。";
          return;
        }
        const distance =
          ((point.x - g.previous.x) * a.x + (point.y - g.previous.y) * a.y) /
          (a.x * a.x + a.y * a.y);
        const next = pushPart(object, g.id === "ram" ? angle : 0, distance);
        if (next.blocked) {
          note =
            "对位不正确：先松开鼠标，平移对齐，再检查方向。不会自动吸附或硬压入。";
        } else {
          Object.assign(object, { x: next.x, y: next.y, z: next.z });
          note = next.seated
            ? "已压到安装深度，松开鼠标确认。"
            : "正在沿插槽轴线手动压入……";
          g.done = next.seated;
          progress = Math.max(0, 1 - object.z / 1.8);
        }
      } else {
        const p = planePoint(point, g.world.z);
        if (!p || !g.plane) return;
        object.x = g.pose.x + p.x - g.plane.x;
        object.y = g.pose.y + p.y - g.plane.y;
        progress = 0;
        note = aligned(object, g.id === "ram" ? angle : 0)
          ? "横向与角度已对齐，但还没连接。松开后，按住 Shift 再沿箭头推入。"
          : "保持零件平直，手动对齐插槽与缺口。";
      }
    }
    g.previous = point;
  }
  function finish(e) {
    if (!gesture) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const g = gesture,
      game = latest.current.game,
      goal = objective(game);
    gesture = null;
    controls.enabled = true;
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (!g.done) return;
    if (g.id.startsWith("latch")) {
      if (latchOpen.every((open) => open === (game.repairStep === 0)))
        latest.current.act("repair");
      else note = "这一端完成了。另一端卡扣也要单独操作。";
    } else latest.current.act(goal.action);
  }
  function rotate(e) {
    if (
      !active ||
      latest.current.game.repairStep !== 2 ||
      e.key.toLowerCase() !== "r" ||
      e.repeat
    )
      return;
    if (e.target.closest('input,textarea,[role="dialog"]')) return;
    e.preventDefault();
    angle += Math.PI / 2;
    note = "方向已旋转 90°。缺口方向不对时，插槽会阻挡压入。";
  }
  canvas.addEventListener("pointerdown", begin, true);
  canvas.addEventListener("pointermove", move, true);
  canvas.addEventListener("pointerup", finish, true);
  canvas.addEventListener("pointercancel", finish, true);
  window.addEventListener("keydown", rotate);
  return {
    update(time) {
      const game = latest.current.game,
        goal = objective(game),
        enabled = latest.current.direct && game.jobId === "memory";
      active = enabled && isDirectAction(game);
      tool.visible = false;
      ghost.visible = false;
      const nextKey = enabled
        ? `${game.jobId}:${game.repairStep}:${game.screws}:${game.panelOpen}:${game.fixed}:${goal.action}`
        : "off";
      if (key !== nextKey) {
        const previously = key;
        key = nextKey;
        progress = 0;
        note = "";
        gesture = null;
        controls.enabled = true;
        if (
          previously === "off" ||
          previously === "" ||
          !enabled ||
          goal.action === "open" ||
          goal.action === "close"
        )
          cover = {
            x: game.panelOpen ? -2.8 : 0,
            y: 0,
            z: game.panelOpen ? 1.5 : 0,
          };
        if (game.repairStep === 2 && previously.indexOf(":2:") < 0)
          pose = { x: 0, y: 0, z: 1.8 };
        else if (game.repairStep !== 2) pose = { x: 0, y: 0, z: 0 };
        latchOpen =
          game.repairStep >= 1 && game.repairStep <= 3 && !game.fixed
            ? [true, true]
            : [false, false];
        angle = 0;
      }
      if (enabled) {
        panel.position.set(cover.x, cover.y, cover.z);
        panel.rotation.y = 0;
        panel.visible = true;
        ram.position.set(
          pose.x + 0.67 - Math.cos(angle) * 0.67 + Math.sin(angle) * 3.65,
          pose.y + 3.65 - Math.sin(angle) * 0.67 - Math.cos(angle) * 3.65,
          pose.z,
        );
        ram.rotation.z = angle;
        latches.forEach((l, i) => {
          l.position.y =
            (i === 0 ? 2.78 : 4.51) +
            (latchOpen[i] ? (i === 0 ? -0.22 : 0.22) : 0);
          l.rotation.z = latchOpen[i] ? (i === 0 ? -0.6 : 0.6) : 0;
        });
        screws.forEach((s, i) => {
          s.visible =
            i < game.screws || (goal.action === "screw" && i === game.screws);
        });
        if (goal.action === "screw" || goal.action === "unscrew") {
          const index = goal.action === "screw" ? game.screws : game.screws - 1;
          screws[index].rotation.z = progress;
          screws[index].position.z =
            1.28 +
            (goal.action === "unscrew"
              ? progress / (TAU * 2)
              : 1 - progress / (TAU * 2)) *
              0.1;
          if (game.tool === "driver") {
            tool.position.copy(
              screws[index].getWorldPosition(new THREE.Vector3()),
            );
            tool.rotation.z = progress;
            tool.visible = true;
          }
        }
        ghost.visible = goal.action === "repair" && game.repairStep === 2;
      }
      panel.updateMatrixWorld(true);
      ram.updateMatrixWorld(true);
      latches.forEach((l) => l.updateMatrixWorld(true));
      currentTargets = active ? targets(game, goal) : [];
      if (time - lastHud > 70) {
        lastHud = time;
        latest.current.onHud?.(
          active
            ? {
                action: goal.action,
                step: game.repairStep,
                targets: currentTargets.map(({ world, ...rest }) => rest),
                progress:
                  goal.action === "screw" || goal.action === "unscrew"
                    ? progress / (TAU * 2)
                    : progress,
                instruction:
                  note ||
                  (goal.action === "unscrew"
                    ? "将刀头对准螺丝，按住圆环逆时针旋转两圈。"
                    : goal.action === "screw"
                      ? "对准螺纹，按住圆环顺时针旋紧两圈。"
                      : goal.action === "open"
                        ? "握住侧板标记，沿水平方向平移取下。"
                        : goal.action === "close"
                          ? "拖动侧板对齐原位，再按住 Shift 沿箭头推回。"
                          : game.repairStep === 0
                            ? "分别握住两个卡扣，沿箭头向外拨开。"
                            : game.repairStep === 1
                              ? "握住内存，沿箭头方向平直取出。"
                              : game.repairStep === 2
                                ? "拖动内存自由对位，R 旋转；对齐后按住 Shift 沿箭头推入。"
                                : "分别将两个卡扣向内拨回，逐个确认锁紧。"),
                aligned: aligned(pose, angle),
                angle: Math.round(((angle % TAU) / Math.PI) * 180),
                canPush:
                  goal.action === "close" ||
                  (goal.action === "repair" && game.repairStep === 2),
              }
            : null,
        );
      }
    },
    rotate: () => {
      angle += Math.PI / 2;
    },
    dispose: () => {
      canvas.removeEventListener("pointerdown", begin, true);
      canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", finish, true);
      canvas.removeEventListener("pointercancel", finish, true);
      window.removeEventListener("keydown", rotate);
      scene.remove(tool, ghost);
    },
  };
}
