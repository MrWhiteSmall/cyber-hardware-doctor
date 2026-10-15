import * as THREE from "three";
import {
  aligned,
  pushPart,
  pullConnector,
  CONNECTOR_RELEASE_MS,
  CONNECTOR_OUT_DEPTH,
  ALIGNMENT_TOLERANCE,
  TAU,
} from "./mechanics.js";

// The two connector faces share an X insertion axis. Their local X/Y plane
// maps to the real socket face, so orbiting never changes the physical axis.
export function createStorageRig({ storage, box, line, materials: m }) {
  const root = new THREE.Group();
  storage.add(root);
  const frame = (y) => {
    const f = new THREE.Group();
    f.position.set(-0.27, y, 0.02);
    f.rotation.y = Math.PI / 2;
    root.add(f);
    return f;
  };
  const powerFrame = frame(1.39),
    dataFrame = frame(1.06);
  const makePort = (f, width, count) => {
    box(f, [0.17, width + 0.07, 0.08], [0, 0, -0.035], m.dark);
    // A real keyed L cross-section, visible on both the socket and plug.
    box(f, [0.025, width, 0.025], [-0.045, 0, 0.015], m.gold);
    box(f, [0.09, 0.025, 0.025], [-0.01, -width / 2 + 0.012, 0.015], m.gold);
    for (let i = 0; i < count; i++)
      box(
        f,
        [0.025, (width / count) * 0.5, 0.015],
        [0.035, -width / 2 + ((i + 0.5) * width) / count, 0.015],
        m.silver,
      );
  };
  makePort(powerFrame, 0.32, 15);
  makePort(dataFrame, 0.16, 7);
  const makePlug = (f, width, material) => {
    const plug = new THREE.Group();
    f.add(plug);
    box(plug, [0.15, width + 0.045, 0.18], [0, 0, 0.13], material);
    box(plug, [0.025, width - 0.025, 0.06], [-0.035, 0.005, 0.025], m.gold);
    box(plug, [0.065, 0.02, 0.06], [-0.015, -width / 2 + 0.025, 0.025], m.gold);
    return plug;
  };
  const powerPlug = makePlug(powerFrame, 0.32, m.black);
  const dataPlug = makePlug(dataFrame, 0.16, m.orange);
  const clip = box(dataPlug, [0.02, 0.17, 0.18], [-0.095, 0, 0.11], m.silver);
  for (let i = 0; i < 3; i++)
    line(
      root,
      [
        [-0.04, 1.39, -0.12 + i * 0.07],
        [0.38, 1.3, -0.12 + i * 0.07],
        [0.72, 0.9, -0.12 + i * 0.07],
      ],
      i === 0 ? m.orange : m.black,
      0.024,
    );
  const cable = line(
    root,
    [
      [0, 1.06, 0.02],
      [0.45, 1.4, 0.45],
      [1.05, 2.5, -0.3],
    ],
    m.orange,
    0.035,
  );
  box(root, [0.14, 0.18, 0.12], [1.05, 2.5, -0.3], m.orange);
  return { root, powerFrame, dataFrame, powerPlug, dataPlug, clip, cable };
}

export function createStorageRepair({ rig, target, planePoint, latest }) {
  const axis = new THREE.Vector3(1, 0, 0);
  let pose = { x: 0, y: 0, z: 0.14 },
    angle = 0,
    phase = "release",
    note = "",
    gesture = null,
    stateKey = "",
    cableKey = "";
  const world = (frame, x, y, z) =>
    frame.localToWorld(new THREE.Vector3(x, y, z));
  const grip = () => world(rig.dataFrame, pose.x, pose.y, pose.z + 0.14);
  const projectPlane = (point) => planePoint(point, grip().x, axis);
  function insertionTargets() {
    return [
      target(
        "sata-data",
        grip(),
        "握住接头，沿箭头推入",
        axis.clone().negate(),
      ),
      {
        ...target(
          "sata-guide",
          world(rig.dataFrame, 0, 0, pose.z + 0.14),
          "对齐参考",
        ),
        guide: true,
      },
    ];
  }
  function setNote() {
    note = aligned(pose, angle)
      ? "位置与缺口已对准，仍未连接；选择「沿槽推入」，再沿箭头拖动压到底。"
      : "将接头握持点移进绿色参考区，方向键可微调；R 旋转检查 L 形缺口。";
  }
  return {
    canInsert: () =>
      phase === "insert" &&
      latest.current.game.jobId === "storage" &&
      !latest.current.game.fixed,
    targets(game) {
      if (game.repairStep === 0)
        return [
          target(
            "sata-power",
            world(rig.powerFrame, 0, 0, 0.14),
            "轻推宽供电接头，确认就位",
            axis.clone().negate(),
          ),
        ];
      if (phase === "insert") return insertionTargets();
      const result = [
        target(
          "sata-data",
          grip(),
          phase === "verify" ? "轻拉接头，检查锁定" : "直接拉接头会被锁扣挡住",
          axis,
        ),
      ];
      if (phase === "release")
        result.unshift(
          target(
            "sata-clip",
            world(rig.dataFrame, pose.x - 0.22, pose.y, pose.z + 0.11),
            "按住金属锁扣，再保持按住沿箭头拔出",
            axis,
          ),
        );
      return result;
    },
    begin(hit, point) {
      gesture = {
        id: hit.id,
        startTime: performance.now(),
        start: point,
        previous: point,
        axis: hit.axis,
        plane: projectPlane(point),
        pose: { ...pose },
        travel: 0,
        done: false,
      };
      note = "";
    },
    move(point, shiftKey) {
      if (!gesture) return;
      const g = gesture,
        a = g.axis;
      if (
        phase === "insert" &&
        latest.current.game.repairStep === 1 &&
        !shiftKey &&
        !latest.current.pushMode
      ) {
        const p = projectPlane(point);
        if (p && g.plane) {
          const delta = rig.dataFrame
            .worldToLocal(p)
            .sub(rig.dataFrame.worldToLocal(g.plane.clone()));
          pose.x = g.pose.x + delta.x;
          pose.y = g.pose.y + delta.y;
          setNote();
        }
      } else if (!a || Math.hypot(a.x, a.y) < 8) {
        note = "轴线与视角重合，请点「硬盘近景」再操作。";
      } else {
        const travel =
          ((point.x - g.previous.x) * a.x + (point.y - g.previous.y) * a.y) /
          (a.x * a.x + a.y * a.y);
        const side =
          Math.abs((point.x - g.start.x) * a.y - (point.y - g.start.y) * a.x) /
          Math.hypot(a.x, a.y);
        if (side > 30) {
          note = "请沿箭头平直移动，握住接头本体，不要横掰或拉线。";
          g.previous = point;
          return;
        }
        if (g.id === "sata-power") {
          g.travel = Math.max(0, g.travel + travel);
          g.done = g.travel >= 0.12;
          note = g.done
            ? "供电接头已确认到位。松开后，继续检查较窄的数据接口。"
            : "握住较宽的供电接头，沿箭头轻推检查。";
        } else if (phase === "release") {
          const releaseHeld =
            g.id === "sata-clip" &&
            performance.now() - g.startTime >= CONNECTOR_RELEASE_MS;
          const next = pullConnector(pose, travel, releaseHeld);
          if (next.blocked)
            note =
              "锁扣仍在阻挡：在金属片标记上按住约半秒，再保持按住沿箭头拔出。";
          else {
            pose = { x: next.x, y: next.y, z: next.z };
            g.done = next.extracted;
            note = g.done
              ? "接头已拔出。松开后检查 L 形缺口，再主动推入。"
              : "锁扣已压下，保持按住，沿箭头平直拔出接头。";
          }
        } else if (phase === "insert") {
          const next = pushPart(pose, angle, travel);
          if (next.blocked)
            note =
              "对位不正确：先用平移或方向键微调位置，并检查 L 形缺口方向。";
          else {
            pose = { x: next.x, y: next.y, z: next.z };
            g.done = next.seated;
            note = g.done
              ? "已推到底，锁扣回弹。松开后还要轻拉检查固定。"
              : "沿接口轴线推入中，继续推到底。";
          }
        } else if (phase === "verify") {
          g.travel = Math.max(0, g.travel + travel);
          g.done = g.travel >= 0.12;
          note = g.done
            ? "接头被锁扣稳稳挡住，连接检查通过。松开完成维修。"
            : "不按锁扣，沿箭头轻拉接头，检查它是否被锁住。";
        }
      }
      g.previous = point;
    },
    finish(cancelled) {
      const g = gesture;
      gesture = null;
      if (!g || cancelled || !g.done) return false;
      if (g.id === "sata-power") return true;
      if (phase === "release") {
        phase = "insert";
        setNote();
        return false;
      }
      if (phase === "insert") {
        phase = "verify";
        note = "推到底后锁扣已回弹。握住接头，沿箭头轻拉，确认不会脱出。";
        return false;
      }
      return phase === "verify";
    },
    rotate() {
      if (phase === "insert") {
        angle += Math.PI / 2;
        setNote();
      }
    },
    nudge(dx, dy) {
      if (phase !== "insert" || gesture) return;
      if (latest.current.game.tool !== "cable") {
        note = "先选择「接线」工具，再调整数据接头。";
        return;
      }
      const t = insertionTargets()[0],
        p = projectPlane(t),
        q = projectPlane({ x: t.x + dx, y: t.y + dy });
      if (!p || !q) return;
      const delta = rig.dataFrame
        .worldToLocal(q)
        .sub(rig.dataFrame.worldToLocal(p))
        .setLength(0.04);
      pose.x += delta.x;
      pose.y += delta.y;
      setNote();
    },
    update(game, direct) {
      rig.root.visible = game.jobId === "storage";
      const nextKey = `${direct && game.jobId === "storage"}:${game.jobId}:${game.repairStep}:${game.fixed}`;
      if (stateKey !== nextKey) {
        stateKey = nextKey;
        pose = { x: 0, y: 0, z: game.fixed ? 0 : 0.14 };
        angle = 0;
        phase = "release";
        note = "";
        gesture = null;
      }
      rig.root.updateMatrixWorld(true);
      rig.dataPlug.position.set(pose.x, pose.y, pose.z);
      rig.dataPlug.rotation.z = angle;
      const pressed =
        gesture?.id === "sata-clip" &&
        performance.now() - gesture.startTime >= CONNECTOR_RELEASE_MS;
      rig.clip.position.x = pressed ? -0.077 : -0.095;
      rig.powerPlug.position.z =
        gesture?.id === "sata-power"
          ? -Math.min(0.015, gesture.travel / 10)
          : 0;
      const nextCable = `${pose.x}:${pose.y}:${pose.z}`;
      if (cableKey !== nextCable) {
        cableKey = nextCable;
        const start = world(rig.dataFrame, pose.x, pose.y, pose.z + 0.25);
        const curve = new THREE.CatmullRomCurve3([
          start,
          new THREE.Vector3(Math.max(start.x + 0.18, 0.5), 1.4, 0.45),
          new THREE.Vector3(1.05, 2.5, -0.3),
        ]);
        rig.cable.geometry.dispose();
        rig.cable.geometry = new THREE.TubeGeometry(curve, 24, 0.035, 6, false);
      }
    },
    hud(game) {
      const power = game.repairStep === 0,
        inserting = !power && phase === "insert";
      const zone = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]
        .map(([x, y]) => {
          const p = target(
            "zone",
            world(
              rig.dataFrame,
              x * ALIGNMENT_TOLERANCE,
              y * ALIGNMENT_TOLERANCE,
              pose.z + 0.14,
            ),
            "",
          );
          return `${p.x},${p.y}`;
        })
        .join(" ");
      return {
        storage: true,
        storagePhase: power ? "power" : phase,
        canPush: inserting,
        aligned: aligned(pose, angle),
        positionAligned: aligned(pose, 0),
        directionAligned: aligned({ x: 0, y: 0 }, angle),
        angle: Math.round(((angle % TAU) / Math.PI) * 180),
        alignmentZone: zone,
        progress:
          power || phase === "verify"
            ? Math.min(1, (gesture?.travel || 0) / 0.12)
            : phase === "insert"
              ? Math.max(0, 1 - pose.z / CONNECTOR_OUT_DEPTH)
              : Math.max(
                  pose.z / CONNECTOR_OUT_DEPTH,
                  gesture?.id === "sata-clip"
                    ? Math.min(
                        0.25,
                        ((performance.now() - gesture.startTime) /
                          CONNECTOR_RELEASE_MS) *
                          0.25,
                      )
                    : 0,
                ),
        instruction:
          note ||
          (power
            ? "先检查较宽的 15 针供电接头。选拆装工具，握住接头沿箭头轻推，确认已到位。"
            : phase === "release"
              ? "本线材带金属锁扣。选接线工具，在金属片标记上按住约半秒，再保持按住沿箭头拔出松动的接头。"
              : phase === "verify"
                ? "握住数据接头轻拉检查，确认锁扣已回弹固定。"
                : "沿箭头主动推入接头。需要对位时切换平移，方向键微调，R 检查 L 形缺口。"),
      };
    },
  };
}
