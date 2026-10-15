import * as THREE from "three";
import { aligned, pushPart } from "./mechanics.js";

// The guard moves on its locating posts first, then across the bench.
// It shares screw turning, pointer capture and cleaning with the PC lessons.
export function createFanRepair({ rig, target, planePoint, latest }) {
  let cover = { x: 0, y: 0, z: 0 },
    gesture = null,
    note = "",
    key = "";
  const center = () =>
    new THREE.Vector3(cover.x, 3.4 + cover.y, 1.02 + cover.z);
  const pulling = () => cover.z < 1;
  return {
    targets(game, goal) {
      const opening = goal.action === "open";
      const result = [
        target(
          "cover",
          center(),
          opening
            ? pulling()
              ? "沿箭头向外拉，脱离定位柱"
              : "定位柱已脱开，松手后向左移开护网"
            : "握住护网：先平移对孔，再沿箭头推回",
          new THREE.Vector3(
            opening && !pulling() ? -1 : 0,
            0,
            opening ? (pulling() ? 1 : 0) : -1,
          ),
        ),
      ];
      if (!opening)
        result.push({
          ...target(
            "cover-guide",
            new THREE.Vector3(0, 3.4, 1.02),
            "机身定位柱 · 固定",
          ),
          guide: true,
        });
      return result;
    },
    begin(hit, point) {
      gesture = {
        axis: hit.axis,
        start: point,
        previous: point,
        plane: planePoint(point, center().z),
        pose: { ...cover },
        pull: pulling(),
        done: false,
      };
      note = "";
    },
    move(point, shiftKey) {
      if (!gesture) return;
      const g = gesture,
        opening = !latest.current.game.panelOpen;
      if (
        (opening && !g.pull) ||
        (!opening && !shiftKey && !latest.current.pushMode)
      ) {
        const p = planePoint(point, 1.02 + g.pose.z);
        if (!p || !g.plane) return;
        cover.x = g.pose.x + p.x - g.plane.x;
        cover.y = opening ? 0 : g.pose.y + p.y - g.plane.y;
        if (opening) {
          cover.x = Math.max(-3.2, Math.min(0, cover.x));
          g.done = cover.x <= -3.2;
          note = "护网已脱开定位柱，向左移开，让叶片完全露出。";
        } else
          note = aligned(cover, 0)
            ? "螺孔已对齐，仍未装上。切换「沿槽推入」，沿箭头推回定位柱。"
            : "先平移护网，让四个螺孔与机身定位柱对正；方向键可微调。";
      } else {
        const a = g.axis;
        if (!a || Math.hypot(a.x, a.y) < 8) {
          note = "点「风扇全景」，让向外拉出的轴线可见。";
          return;
        }
        const side =
          Math.abs((point.x - g.start.x) * a.y - (point.y - g.start.y) * a.x) /
          Math.hypot(a.x, a.y);
        if (side > 30) {
          note = "定位柱还在约束护网，请沿箭头平直拉出或推入。";
          g.previous = point;
          return;
        }
        const distance =
          ((point.x - g.previous.x) * a.x + (point.y - g.previous.y) * a.y) /
          (a.x * a.x + a.y * a.y);
        if (opening) {
          cover.z = Math.max(0, Math.min(1, cover.z + distance));
          note =
            cover.z >= 1
              ? "护网已向外拉离定位柱。先松开，再握住标记向左移开。"
              : "先向外平直拉出护网，脱离定位柱后才能移到旁边。";
        } else {
          const next = pushPart(cover, 0, distance);
          if (next.blocked) note = "螺孔尚未对齐，不能推入；先切换平移对位。";
          else {
            cover = { x: next.x, y: next.y, z: next.z };
            g.done = next.seated;
            note = g.done
              ? "护网已就位，松手后用螺丝刀逐颗固定。"
              : "沿定位柱推入中，继续推到底。";
          }
        }
      }
      g.previous = point;
    },
    finish(cancelled) {
      const done = gesture?.done && !cancelled;
      gesture = null;
      return Boolean(done);
    },
    nudge(dx, dy) {
      if (
        gesture ||
        !latest.current.game.fixed ||
        !latest.current.game.panelOpen
      )
        return;
      if (latest.current.game.tool !== "hand") {
        note = "先选择拆装工具，再调整护网。";
        return;
      }
      const p = target("point", center(), ""),
        start = planePoint(p, center().z),
        end = planePoint({ x: p.x + dx, y: p.y + dy }, center().z);
      if (!start || !end) return;
      const delta = end.sub(start).setLength(0.04);
      cover.x += delta.x;
      cover.y += delta.y;
      note = aligned(cover, 0)
        ? "螺孔已对齐，仍需沿轴线主动推入。"
        : "小步调整护网螺孔，绿色表示横向对位正确。";
    },
    update(game, direct) {
      if (!direct || !["fan-dust", "fan-bearing"].includes(game.jobId)) {
        key = "";
        return;
      }
      const nextKey = `${game.jobId}:${game.panelOpen}`;
      if (key !== nextKey) {
        key = nextKey;
        cover = {
          x: game.panelOpen ? -3.2 : 0,
          y: 0,
          z: game.panelOpen ? 1 : 0,
        };
        gesture = null;
        note = "";
      }
      rig.cover.position.set(cover.x, cover.y, cover.z);
      rig.cover.visible = true;
      rig.cover.updateMatrixWorld(true);
    },
    hud(game, goal) {
      return {
        fanGuard: true,
        canPush: goal.action === "close",
        aligned: aligned(cover, 0),
        positionAligned: aligned(cover, 0),
        directionAligned: true,
        progress:
          goal.action === "open"
            ? cover.z < 1
              ? cover.z * 0.5
              : 0.5 + (-cover.x / 3.2) * 0.5
            : Math.max(0, 1 - cover.z),
        instruction:
          note ||
          (goal.action === "open"
            ? pulling()
              ? "四颗螺丝已拆下。握住护网标记，沿箭头向外拉离定位柱；先不要横掰。"
              : "定位柱已脱开。松开后重新握住标记，向左把护网移到旁边。"
            : "把旁边的护网平移回机身，先对齐四个螺孔，再切换「沿槽推入」沿箭头推到底。对齐不会自动安装。"),
      };
    },
  };
}
