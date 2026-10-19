import * as THREE from "three";
import { aligned, pushPart } from "./mechanics.js";

// A cradle holds the phone in landscape orientation, charging edge to the right.
const BASE = new THREE.Vector3(2.08, 2.9, 0.22);
const AXIS = new THREE.Vector3(1, 0, 0);
// Shared installation constraints use x/y for transverse offsets and z for travel.
const pointAt = (p) => BASE.clone().add(new THREE.Vector3(p.z, p.y, p.x));
const PARK = { x: 0, y: -1.15, z: 0.95 };
const NEW = { x: 0.4, y: -0.75, z: 1.05 };

export function createPhoneRig({ scene, box, line, text, materials: m }) {
  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group();
  body.userData.part = "phonePort";
  root.add(body);
  const rounded = (w, h, radius, depth, z, mat) => {
    const x = -w / 2,
      y = -h / 2,
      r = radius;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      mat,
    );
    mesh.position.set(0, 2.9, z);
    mesh.castShadow = true;
    body.add(mesh);
  };
  rounded(4.1, 2.2, 0.24, 0.35, -0.175, m.silver);
  rounded(3.92, 2.02, 0.2, 0.025, 0.18, m.black);
  box(body, [0.06, 0.38, 0.04], [-1.78, 2.9, 0.23], m.chip);
  box(body, [0.65, 0.04, 0.12], [-0.8, 4.01, 0], m.dark);
  // A visible support keeps the device and loose parts above the work surface.
  box(root, [3.3, 0.13, 1.4], [0, 0.1, -0.4], m.frame);
  box(root, [0.28, 1.65, 0.3], [-1.1, 0.98, -0.48], m.frame);
  box(root, [0.28, 1.65, 0.3], [1.1, 0.98, -0.48], m.frame);
  box(root, [3.4, 0.14, 0.7], [0, 1.76, -0.08], m.frame);
  const port = new THREE.Group();
  port.position.copy(BASE);
  port.scale.setScalar(0.72);
  body.add(port);
  // Open socket: four frame edges and a central tongue, no solid plug-sized block.
  for (const y of [-0.23, 0.23])
    box(port, [0.22, 0.05, 0.24], [0, y, 0], m.silver);
  for (const z of [-0.12, 0.12])
    box(port, [0.22, 0.42, 0.025], [0, 0, z], m.silver);
  box(port, [0.21, 0.31, 0.025], [0, 0, 0], m.chip);
  for (let i = 0; i < 6; i++)
    box(port, [0.07, 0.025, 0.01], [0.07, -0.14 + i * 0.055, 0.02], m.gold);
  text(body, "PALM / 01", [0, 3.63, 0.24], 0.2, "#98aa9b");
  const screen = text(body, "POWER OFF", [0, 2.98, 0.25], 0.4, "#839788");
  const charging = new THREE.Group();
  body.add(charging);
  text(charging, "CHARGING", [0, 3.12, 0.26], 0.4, "#a6ce97");
  text(charging, "32% / 5 V", [0, 2.63, 0.26], 0.26, "#a6ce97");
  const cable = (old) => {
    const g = new THREE.Group();
    g.userData.part = "phoneCable";
    g.scale.setScalar(0.72);
    root.add(g);
    // Hollow male connector; its opening slides around the socket tongue.
    for (const y of [-0.19, 0.19])
      box(g, [0.3, 0.035, 0.17], [-0.03, y, 0], m.silver);
    for (const z of [-0.085, 0.085])
      box(g, [0.3, 0.35, 0.025], [-0.03, 0, z], m.silver);
    box(g, [0.44, 0.5, 0.24], [0.34, 0, 0], old ? m.frame : m.orange);
    box(g, [0.25, 0.25, 0.18], [0.66, 0, 0], old ? m.frame : m.orange);
    line(
      g,
      [
        [0.77, 0, 0],
        [1.08, -0.13, -0.08],
        [1.2, -0.62, -0.12],
      ],
      old ? m.dark : m.orange,
      0.045,
    );
    if (old) {
      for (const x of [0.61, 0.67, 0.73])
        box(g, [0.035, 0.26, 0.025], [x, 0, 0.102], m.black);
    }
    return g;
  };
  const oldCable = cable(true),
    newCable = cable(false);
  box(root, [1.6, 0.72, 0.07], [3.55, 1.61, -0.05], m.frame);
  text(root, "RETIRED", [3.48, 1.27, 0.02], 0.12, "#8a7a6b");
  text(root, "KNOWN GOOD / 5 V", [3.4, 2.02, 0.58], 0.1, "#87937e");
  text(root, "USB-C / EXTERNAL CHECK", [-0.2, 1.45, 0.2], 0.16, "#82917c");
  return { root, body, oldCable, newCable, screen, charging };
}

export function createPhoneRepair({ rig, target, planePoint, latest }) {
  let key = "",
    phase = "extract",
    pose = { x: 0, y: 0, z: 0 };
  let gesture = null,
    note = "",
    evidence = new Set();
  const project = (p) => planePoint(p, BASE.x + pose.z, AXIS);
  const moving = () => pointAt(pose);
  const installed = () => aligned(pose, 0, 0.065);
  function alignmentNote() {
    note = installed()
      ? "位置已对准，仍未连接。切换「沿轴插入」，主动推到底。"
      : "先平移对准接口，方向键可微调；歪斜时不能硬压。";
  }
  return {
    targets(game) {
      if (game.repairStep === 1)
        return [
          {
            ...target(
              "phone-port-check",
              BASE.clone(),
              "按住观察舌片约 0.7 秒",
            ),
            cleared: evidence.has("phone-port-check"),
          },
          {
            ...target(
              "phone-cable-check",
              pointAt(PARK).add(new THREE.Vector3(0.49, 0, 0.08)),
              "按住观察旧线裂口约 0.7 秒",
            ),
            cleared: evidence.has("phone-cable-check"),
          },
        ];
      if (phase === "insert")
        return [
          target(
            "phone-plug",
            moving(),
            "替换线 · 握接头移动",
            AXIS.clone().negate(),
          ),
          {
            ...target("phone-socket", BASE.clone(), "手机接口 · 固定"),
            guide: true,
          },
        ];
      return [
        target(
          "phone-plug",
          moving(),
          phase === "extract"
            ? "握接头本体，平直拔出"
            : phase === "park"
              ? "已拔离，松手后移到下方回收盘"
              : "轻拉接头本体，检查固定",
          phase === "park" ? new THREE.Vector3(0, -1, 0) : AXIS,
        ),
      ];
    },
    begin(hit, p) {
      gesture = {
        id: hit.id,
        start: p,
        previous: p,
        axis: hit.axis,
        pose: { ...pose },
        plane: project(p),
        started: performance.now(),
        drift: 0,
        travel: 0,
        done: false,
      };
      note = "";
    },
    move(p, shift) {
      const g = gesture;
      if (!g) return;
      g.drift = Math.max(g.drift, Math.hypot(p.x - g.start.x, p.y - g.start.y));
      if (phase === "inspect") return;
      if (
        phase === "park" ||
        (phase === "insert" && !shift && !latest.current.pushMode)
      ) {
        const at = project(p);
        if (!at || !g.plane) return;
        const delta = at.sub(g.plane);
        pose.x = g.pose.x + delta.z;
        pose.y = g.pose.y + delta.y;
        if (phase === "park") {
          pose.x = 0;
          pose.y = Math.max(-1.15, Math.min(0, pose.y));
          g.done = pose.y <= -1.05;
          note = "把破损旧线移到下方回收盘，停止使用。";
        } else alignmentNote();
      } else {
        const a = g.axis,
          length = a && Math.hypot(a.x, a.y);
        if (!length || length < 8) {
          note = "点「手机近景」，让插拔方向可见。";
          return;
        }
        const side =
          Math.abs((p.x - g.start.x) * a.y - (p.y - g.start.y) * a.x) / length;
        if (side > 24) {
          note = "不要横掰接口；沿箭头平直操作接头本体。";
          g.previous = p;
          return;
        }
        const d =
          ((p.x - g.previous.x) * a.x + (p.y - g.previous.y) * a.y) /
          (length * length);
        if (phase === "extract") {
          pose.z = Math.max(0, Math.min(0.95, pose.z + d));
          g.done = pose.z >= 0.94;
          note = g.done
            ? "接头已拔离，松手后移到回收盘。"
            : "握住接头平直拔出，不拉线身。";
        } else if (phase === "insert") {
          if (!installed())
            note = "位置尚未对准，接口阻挡插入；先平移或用方向键微调。";
          else {
            const next = pushPart(pose, 0, d);
            pose = { x: next.x, y: next.y, z: next.z };
            g.done = next.seated;
            note = g.done
              ? "已插到安装深度。松手后还要轻拉检查固定。"
              : "沿轴线主动插入，不要用力侧掰。";
          }
        } else if (phase === "retain") {
          g.travel = Math.max(0, g.travel + d);
          g.done = g.travel >= 0.1;
          note = g.done
            ? "接头保持在位，固定检查通过，松手确认。"
            : "轻拉接头本体，连接保持在位；点击不能完成检查。";
        }
      }
      g.previous = p;
    },
    finish(cancelled) {
      const g = gesture;
      gesture = null;
      if (!g || cancelled) return false;
      if (phase === "inspect") {
        if (g.drift > 10 || performance.now() - g.started < 650) {
          note = "稳定按住标记约 0.7 秒观察，快速点击或滑走不记录证据。";
          return false;
        }
        evidence.add(g.id);
        note =
          g.id === "phone-port-check"
            ? "接口证据：舌片完整，未见异物堵塞。本关无需刮擦或拆手机。"
            : "线材证据：接头护套开裂，应停用旧线。不要折弯后带电试充。";
        return evidence.size === 2;
      }
      if (!g.done) return false;
      if (phase === "extract") {
        phase = "park";
        note = "先松手，再向下移开旧线。";
        return false;
      }
      return true;
    },
    nudge(dx, dy) {
      if (phase !== "insert" || gesture || latest.current.game.tool !== "cable")
        return;
      const t = target("p", moving(), ""),
        a = project(t),
        b = project({ x: t.x + dx, y: t.y + dy });
      if (!a || !b) return;
      const d = b.sub(a).setLength(0.025);
      pose.x += d.z;
      pose.y += d.y;
      alignmentNote();
    },
    update(game, direct) {
      const enabled = direct && game.jobId === "phone-charge";
      const next = `${enabled}:${game.jobId}:${game.repairStep}:${game.fixed}`;
      if (next !== key) {
        key = next;
        gesture = null;
        evidence = new Set();
        note = "";
        phase =
          ["extract", "inspect", "insert", "retain"][game.repairStep] || "done";
        pose =
          game.repairStep === 0
            ? { x: 0, y: 0, z: 0 }
            : game.repairStep === 2
              ? { ...NEW }
              : game.repairStep === 1
                ? { ...PARK }
                : { x: 0, y: 0, z: 0 };
      }
      rig.root.visible = game.jobId === "phone-charge";
      rig.oldCable.position.copy(pointAt(game.repairStep === 0 ? pose : PARK));
      rig.newCable.position.copy(
        pointAt(
          game.repairStep >= 3 || game.fixed
            ? { x: 0, y: 0, z: 0 }
            : game.repairStep === 2
              ? pose
              : NEW,
        ),
      );
      rig.screen.visible = !game.tested;
      rig.charging.visible = game.tested;
    },
    hud() {
      return {
        phoneRepair: true,
        phonePhase: phase,
        canPush: phase === "insert",
        aligned: installed(),
        positionAligned: installed(),
        directionAligned: true,
        progress:
          phase === "inspect"
            ? evidence.size / 2
            : phase === "extract"
              ? pose.z / 0.95
              : 0,
        instruction:
          note ||
          {
            extract:
              "充电器端已断开。选接线工具，握住旧线接头沿箭头平直拔出；本关不拆手机。",
            park: "接头已脱离手机，松手后移到下方回收盘。",
            inspect:
              "选观察工具，分别在接口和旧线裂口标记上稳定按住约 0.7 秒，记录两处证据。",
            insert:
              "橙色替换线已预先验证良好。先平移对准接口，再切换「沿轴插入」主动推到底；对齐不自动连接。",
            retain:
              "沿箭头轻拉接头本体，确认接头保持在位。最后再接电开机，验证充电状态。",
          }[phase],
      };
    },
  };
}
