import * as THREE from "three";
import {
  angleDelta,
  aligned,
  pushPart,
  bearingCoast,
  validOilDrop,
} from "./mechanics.js";

// This teaching motor has an accessible rear service window and a press-fit
// rubber oil plug. It does not represent sealed or inaccessible fan motors.
export function createBearingRig({
  parent,
  rotor,
  cylinder,
  box,
  materials: m,
}) {
  const root = new THREE.Group();
  parent.add(root);
  cylinder(root, 0.37, 0.07, [0, 3.4, -0.26], m.silver);
  cylinder(root, 0.19, 0.08, [0, 3.4, -0.32], m.gold);
  cylinder(root, 0.075, 0.09, [0, 3.4, -0.37], m.dark);
  const plug = new THREE.Group();
  root.add(plug);
  cylinder(plug, 0.23, 0.1, [0, 0, 0], m.black);
  box(plug, [0.24, 0.065, 0.08], [0, 0, -0.075], m.dark);
  const oil = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.025, 8, 32),
    new THREE.MeshStandardMaterial({
      color: "#c69a37",
      transparent: true,
      opacity: 0.8,
    }),
  );
  oil.position.set(0, 3.4, -0.4);
  root.add(oil);
  const bottle = new THREE.Group();
  root.add(bottle);
  cylinder(bottle, 0.115, 0.36, [0, 0, -0.7], m.orange);
  cylinder(bottle, 0.025, 0.32, [0, 0, -0.37], m.gold);
  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 12, 8),
    oil.material,
  );
  drop.position.set(0, 0, -0.18);
  bottle.add(drop);
  return { root, plug, oil, bottle, drop, rotor };
}

export function createBearingRepair({ rig, target, planePoint, latest }) {
  const base = new THREE.Vector3(0, 3.4, -0.43);
  let pose = { x: 0, y: 0, z: 0 },
    phase = "",
    key = "",
    note = "",
    gesture = null;
  let rotorAngle = 0,
    observation = null,
    lastTime = null,
    pointer = null;
  const plugPoint = () =>
    base.clone().add(new THREE.Vector3(pose.x, pose.y, -pose.z));
  const hub = () => new THREE.Vector3(0, 3.4, 0.74);
  const spinPoint = () => new THREE.Vector3(0.85, 3.4, 0.74);
  function spinAngle(point) {
    const p = planePoint(point, 0.74);
    return p ? Math.atan2(p.y - 3.4, p.x) : null;
  }
  const inserting = () =>
    latest.current.game.repairStep === 3 && phase === "plug";
  return {
    targets(game) {
      if (game.repairStep === 0 || (game.repairStep === 3 && phase === "spin"))
        return [
          target(
            "bearing-spin",
            spinPoint(),
            "握住叶片标记，绕转轴轻拨一小段后松手",
          ),
          { ...target("bearing-hub", hub(), "转轴中心"), guide: true },
        ];
      if (game.repairStep === 2)
        return [
          {
            ...target("bearing-oil", base.clone(), "注油孔：对准这里轻点一次"),
            radius: 16,
          },
        ];
      const result = [
        target(
          "bearing-plug",
          plugPoint(),
          game.repairStep === 1
            ? pose.z < 0.55
              ? "握住胶塞，沿箭头拔出"
              : "先松手，再沿箭头把胶塞移到旁边"
            : "握住胶塞：先对孔，再沿轴线压回",
          new THREE.Vector3(
            game.repairStep === 1 && pose.z >= 0.55 ? 1 : 0,
            0,
            game.repairStep === 1 ? (pose.z < 0.55 ? -1 : 0) : 1,
          ),
        ),
      ];
      if (inserting())
        result.push({
          ...target("bearing-port", base.clone(), "注油孔 · 固定"),
          guide: true,
        });
      return result;
    },
    begin(hit, point) {
      if (observation) {
        note = "先松手观察停转速度，暂时不要继续拨动。";
        return;
      }
      gesture = {
        id: hit.id,
        start: point,
        previous: point,
        started: performance.now(),
        axis: hit.axis,
        pose: { ...pose },
        plane: planePoint(point, plugPoint().z),
        pull: pose.z < 0.55,
        angle: spinAngle(point),
        travel: 0,
        direction: 1,
        drift: 0,
        done: false,
      };
      pointer = point;
      note = "";
    },
    hover(point) {
      pointer = point;
    },
    move(point, shiftKey) {
      pointer = point;
      if (!gesture) return;
      const g = gesture,
        game = latest.current.game;
      g.drift = Math.max(
        g.drift,
        Math.hypot(point.x - g.start.x, point.y - g.start.y),
      );
      if (g.id === "bearing-spin") {
        const a = spinAngle(point);
        if (a !== null && g.angle !== null) {
          const delta = angleDelta(g.angle, a);
          if (Math.abs(delta) > 0.0001) g.direction = Math.sign(delta);
          rotorAngle += delta;
          g.travel += Math.abs(delta);
          g.angle = a;
        }
        note = "轻拨约一小段后松手，观察叶片能继续转多久。";
      } else if (g.id === "bearing-oil") {
        note = "只需对准注油孔短按一次；不要持续挤压或把油滴到别处。";
      } else if (
        (game.repairStep === 1 && !g.pull) ||
        (inserting() && !shiftKey && !latest.current.pushMode)
      ) {
        const p = planePoint(point, base.z - g.pose.z);
        if (!p || !g.plane) return;
        pose.x = g.pose.x + p.x - g.plane.x;
        pose.y = g.pose.y + p.y - g.plane.y;
        if (game.repairStep === 1) {
          pose.x = Math.max(0, Math.min(0.7, pose.x));
          pose.y = 0;
          g.done = pose.x >= 0.7;
          note = "胶塞已拔出。沿箭头移开，让注油孔露出来。";
        } else
          note = aligned(pose, 0)
            ? "胶塞已对孔，仍未密封。切换「沿槽推入」，沿箭头压到底。"
            : "平移胶塞对准注油孔；方向键可小步微调。";
      } else {
        const a = g.axis;
        if (!a || Math.hypot(a.x, a.y) < 8) {
          note = "点「轴承背面」，让拔插方向可见。";
          return;
        }
        const side =
          Math.abs((point.x - g.start.x) * a.y - (point.y - g.start.y) * a.x) /
          Math.hypot(a.x, a.y);
        if (side > 30) {
          note = "先沿箭头平直拔出或压回胶塞，不要横掰。";
          g.previous = point;
          return;
        }
        const distance =
          ((point.x - g.previous.x) * a.x + (point.y - g.previous.y) * a.y) /
          (a.x * a.x + a.y * a.y);
        if (game.repairStep === 1) {
          pose.z = Math.max(0, Math.min(0.55, pose.z + distance));
          note =
            pose.z >= 0.55
              ? "胶塞已拔离注油孔。先松开，再重新握住标记移到旁边。"
              : "沿箭头拔出胶塞，让密封段完全离开注油孔。";
        } else {
          const next = pushPart(pose, 0, distance);
          if (next.blocked) note = "胶塞还没对孔，不能硬压。先切换平移对位。";
          else {
            pose = { x: next.x, y: next.y, z: next.z };
            g.done = next.seated;
            note = g.done
              ? "胶塞已压回密封，松手后还要到正面轻拨叶片复查。"
              : "正在沿轴线压回胶塞，继续推到底。";
          }
        }
      }
      g.previous = point;
    },
    finish(cancelled) {
      const g = gesture;
      gesture = null;
      if (!g || cancelled) return false;
      const game = latest.current.game;
      if (g.id === "bearing-spin") {
        if (g.travel < 0.4) {
          note = "点一下不会检查阻力；握住叶片，绕转轴轻拨一小段再松开。";
          return false;
        }
        observation = {
          elapsed: 0,
          velocity: 3 * g.direction,
          rotation: 0,
          lubricated: game.repairStep === 3,
        };
        note = "松手观察中：相同的轻拨强度，比较润滑前后的停转速度。";
        return false;
      }
      if (g.id === "bearing-oil") {
        const duration = performance.now() - g.started;
        if (!validOilDrop(duration, g.drift)) {
          note =
            duration > 600
              ? "挤压太久了，这次不计入。松手后重新对准，短按约四分之一秒；油不是越多越好。"
              : "还未点涂成功。对准注油孔短按约四分之一秒并松开，手不要滑开。";
          return false;
        }
        return true;
      }
      if (!g.done) return false;
      if (game.repairStep === 1) return true;
      phase = "spin";
      pose = { x: 0, y: 0, z: 0 };
      note =
        "胶塞已密封。回到正面轻拨叶片，松手比较阻力；仅装回胶塞还不能交付。";
      latest.current.focusFan?.();
      return false;
    },
    nudge(dx, dy) {
      if (!inserting() || gesture) return;
      if (latest.current.game.tool !== "hand") {
        note = "先选择拆装工具，再调整胶塞。";
        return;
      }
      const p = target("point", plugPoint(), ""),
        a = planePoint(p, plugPoint().z),
        b = planePoint({ x: p.x + dx, y: p.y + dy }, plugPoint().z);
      if (!a || !b) return;
      const delta = b.sub(a).setLength(0.04);
      pose.x += delta.x;
      pose.y += delta.y;
      note = aligned(pose, 0)
        ? "胶塞已对孔，仍需沿箭头主动压回。"
        : "小步调整中：胶塞要与注油孔同轴。";
    },
    update(game, direct, time) {
      rig.root.visible = game.jobId === "fan-bearing";
      const enabled = direct && game.jobId === "fan-bearing";
      const nextKey = `${enabled}:${game.jobId}:${game.repairStep}:${game.fixed}`;
      if (key !== nextKey) {
        key = nextKey;
        gesture = null;
        observation = null;
        note = "";
        phase = game.repairStep === 3 ? "plug" : "";
        pose = {
          x: game.repairStep >= 2 && !game.fixed ? 0.7 : 0,
          y: 0,
          z: game.repairStep >= 2 && !game.fixed ? 0.55 : 0,
        };
        rotorAngle = 0;
      }
      const dt =
        lastTime === null
          ? 0
          : Math.min(0.1, Math.max(0, (time - lastTime) / 1000));
      lastTime = time;
      if (enabled && observation) {
        const next = bearingCoast(
          observation.velocity,
          dt,
          observation.lubricated,
        );
        observation.velocity = next.velocity;
        observation.rotation += next.rotation;
        observation.elapsed += dt;
        rotorAngle += next.rotation;
        if (
          observation.elapsed >= 1.5 &&
          game.tool === "hand" &&
          game.selected === "fanMotor"
        ) {
          const lubricated = observation.lubricated;
          observation = null;
          note = lubricated
            ? "复查通过：相同轻拨后继续转动，阻力明显减小。"
            : "轻拨后很快停下，轴承阻力异常。接下来检查背面的维护结构。";
          latest.current.act("repair");
        }
      }
      if (enabled && game.unplugged) rig.rotor.rotation.z = rotorAngle;
      rig.plug.position.copy(plugPoint());
      rig.plug.visible = true;
      rig.oil.visible = game.repairStep >= 3 || game.fixed;
      rig.bottle.visible = enabled && game.repairStep === 2 && !game.fixed;
      if (rig.bottle.visible) {
        const p = pointer && planePoint(pointer, base.z);
        rig.bottle.position.copy(p || base);
        rig.drop.visible = Boolean(gesture?.id === "bearing-oil");
      }
    },
    hud(game) {
      const state =
        game.repairStep === 0
          ? "before"
          : game.repairStep === 1
            ? "open"
            : game.repairStep === 2
              ? "oil"
              : phase === "spin"
                ? "after"
                : "seal";
      return {
        bearing: true,
        bearingPhase: state,
        canPush: inserting(),
        aligned: aligned(pose, 0),
        positionAligned: aligned(pose, 0),
        directionAligned: true,
        progress: observation
          ? observation.elapsed / 1.5
          : gesture?.id === "bearing-oil"
            ? Math.min(1, (performance.now() - gesture.started) / 300)
            : state === "open"
              ? pose.z < 0.55
                ? pose.z / 1.1
                : 0.5 + pose.x / 1.4
              : 0,
        instruction:
          note ||
          {
            before:
              "选拆装工具，握住叶片标记，绕转轴轻拨一小段后松手，观察它很快停下。",
            open: "本机背面有可维护检修窗口。握住黑色胶塞，先沿箭头拔出，松手后再移到旁边。",
            oil: "已确认本机是可维护含油轴承。选润滑工具，对准注油孔短按约四分之一秒并松开，少量点涂一次即可。",
            seal: "先把胶塞平移对准原来的注油孔，再沿箭头主动压回；仅对齐不会密封。",
            after:
              "胶塞已密封。选拆装工具，再次轻拨叶片后松手，观察它比润滑前转得更久。",
          }[state],
      };
    },
  };
}
