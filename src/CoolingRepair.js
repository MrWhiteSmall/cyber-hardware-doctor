import * as THREE from "three";
import { FAN_HOLD_MS, validAirPuff } from "./mechanics.js";

// Repairs use the shared controller's pointer capture, projection and tool checks.
export function createCoolingRepair({
  scene,
  patches,
  target,
  planePoint,
  latest,
  jobId = "cooling",
  partId = "cooler",
  holdPoint = new THREE.Vector3(-0.35, 3.97, 0.74),
}) {
  let gesture = null,
    note = "",
    cleaned = new Set(),
    enabled = false;
  let pointer = null,
    phase = "";
  const hand = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: "#e6c49b",
    roughness: 0.9,
  });
  for (const x of [-0.09, 0.09]) {
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.22, 4, 8),
      skin,
    );
    finger.position.set(x, 0, 0);
    hand.add(finger);
  }
  hand.position.copy(holdPoint).add(new THREE.Vector3(0, 0, 0.02));
  scene.add(hand);
  const blower = new THREE.Group();
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 16, 12),
    new THREE.MeshStandardMaterial({ color: "#ce8052" }),
  );
  bulb.scale.set(1, 1.3, 1.4);
  bulb.position.z = 0.42;
  blower.add(bulb);
  const nozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: "#586c60" }),
  );
  nozzle.rotation.x = -Math.PI / 2;
  nozzle.position.z = 0.2;
  blower.add(nozzle);
  const jet = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.27, 16),
    new THREE.MeshBasicMaterial({
      color: "#cbe5df",
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  jet.rotation.x = Math.PI / 2;
  jet.position.z = -0.04;
  blower.add(jet);
  scene.add(blower);
  function ready() {
    const game = latest.current.game;
    return (
      enabled &&
      !game.fixed &&
      game.inspected.includes(partId) &&
      game.panelOpen
    );
  }
  return {
    targets(game) {
      if (game.repairStep === 0)
        return [target("fan-hold", holdPoint, "长按固定叶片")];
      return patches.map((patch, i) => ({
        ...target(
          `dust${i}`,
          patch.getWorldPosition(new THREE.Vector3()),
          cleaned.has(i)
            ? "此处已清洁"
            : `${patch.userData.zone || "积灰"}：对准这里，短按气吹`,
        ),
        guide: cleaned.has(i),
        cleared: cleaned.has(i),
      }));
    },
    begin(hit, point) {
      gesture = {
        id: hit.id,
        start: point,
        startTime: performance.now(),
        drift: 0,
      };
      pointer = point;
      note = "";
    },
    hover(point) {
      pointer = point;
    },
    move(point) {
      pointer = point;
      if (gesture)
        gesture.drift = Math.max(
          gesture.drift,
          Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y),
        );
    },
    finish(cancelled) {
      const g = gesture;
      gesture = null;
      if (!g || cancelled) return false;
      const duration = performance.now() - g.startTime;
      if (g.id === "fan-hold") {
        const held = duration >= FAN_HOLD_MS && g.drift <= 22;
        note = held
          ? "左手已稳住叶片，换气吹后仍会保持固定。"
          : "在叶片标记上按住约一秒再松开，手不要滑开。";
        return held;
      }
      if (!validAirPuff(duration, g.drift)) {
        note =
          duration > 900
            ? "这一口吹得太久了。用短促气流，按下约半秒就松开。"
            : "对准一处积灰，短按约半秒再松开；不要点一下就滑走。";
        return false;
      }
      cleaned.add(Number(g.id.slice(4)));
      note = `已清理 ${cleaned.size} / ${patches.length} 处积灰。移到下一处，再短按一次。`;
      return cleaned.size === patches.length;
    },
    update(game, direct) {
      const nextEnabled = direct && game.jobId === jobId;
      const nextPhase = `${nextEnabled}:${game.repairStep}:${game.fixed}`;
      if (phase !== nextPhase) {
        phase = nextPhase;
        note = "";
        gesture = null;
      }
      if (enabled !== nextEnabled || (!game.fixed && game.repairStep === 0)) {
        cleaned = new Set();
        if (enabled !== nextEnabled) {
          gesture = null;
          note = "";
        }
      }
      enabled = nextEnabled;
      const repairing = ready();
      hand.visible =
        repairing && (game.repairStep === 1 || gesture?.id === "fan-hold");
      blower.visible =
        repairing && game.repairStep === 1 && game.tool === "air";
      if (enabled)
        patches.forEach((patch, i) => {
          patch.visible = !game.fixed && !cleaned.has(i);
        });
      else
        patches.forEach((patch) => {
          patch.visible = game.jobId === jobId && !game.fixed;
        });
      if (blower.visible) {
        const aimedPatch =
          gesture?.id.startsWith("dust") &&
          patches[Number(gesture.id.slice(4))];
        const depth = aimedPatch
          ? aimedPatch.getWorldPosition(new THREE.Vector3()).z
          : holdPoint.z;
        const aim = pointer && planePoint(pointer, depth);
        blower.position.copy(
          aim ||
            patches
              .find((_, i) => !cleaned.has(i))
              ?.getWorldPosition(new THREE.Vector3()) ||
            holdPoint,
        );
        const puffing = gesture && performance.now() - gesture.startTime < 900;
        jet.visible = Boolean(puffing);
        bulb.scale.z = puffing ? 1.05 : 1.4;
      }
    },
    hud(game) {
      const holding = game.repairStep === 0;
      return {
        cleaning: true,
        cleaningKind: jobId === "fan-dust" ? "fan" : "pc",
        zones:
          jobId === "fan-dust"
            ? ["护网", "叶片"]
                .map(
                  (zone) =>
                    `${zone} ${patches.filter((p, i) => p.userData.zone === zone && cleaned.has(i)).length} / ${patches.filter((p) => p.userData.zone === zone).length}`,
                )
                .join(" · ")
            : "",
        cleaned: cleaned.size,
        total: patches.length,
        progress: holding
          ? gesture
            ? Math.min(1, (performance.now() - gesture.startTime) / FAN_HOLD_MS)
            : 0
          : cleaned.size / patches.length,
        instruction:
          note ||
          (holding
            ? "选择拆装工具，在叶片标记上按住约一秒再松开。固定后，左手会继续稳住风扇。"
            : "左手保持叶片固定。选择气吹，对准橙色积灰点，短按约半秒再松开；每处单独吹一次。"),
      };
    },
    dispose() {
      for (const group of [hand, blower])
        group.traverse((object) => {
          object.geometry?.dispose();
          object.material?.dispose();
        });
      scene.remove(hand, blower);
    },
  };
}
