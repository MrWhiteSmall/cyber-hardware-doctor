import * as THREE from "three";
import { aligned, pushPart, cableContinuity } from "./mechanics.js";

const DEPTH = 0.8;
const Z = 1.35;
const TIP_Z = Z + DEPTH + 0.18;
const endpoint = (end, pose) =>
  new THREE.Vector3((end === "a" ? -1 : 1) + pose.x, 1.65 + pose.y, Z + pose.z);
const fresh = (y = 0) => ({
  a: { x: 0, y, z: DEPTH },
  b: { x: 0, y, z: DEPTH },
});

// A 5 V teaching harness: USB-A power contacts at A, keyed two-pin plug at B.
// Contact labels refer to this model's view, not a universal USB pin orientation.
export function createCableRig({
  parent,
  stock,
  box,
  cylinder,
  line,
  text,
  materials: m,
}) {
  const root = new THREE.Group();
  parent.add(root);
  box(root, [3.4, 1.9, 0.06], [0, 1.2, Z - 0.16], m.board);
  text(root, "A / USB                 B / 5V", [0, 1.98, Z - 0.1], 0.14);
  const source = box(root, [0.8, 0.42, 0.34], [-1, 1.65, Z - 0.22], m.dark);
  text(root, "USB / 5V", [-1, 2.2, Z], 0.12);
  const device = box(root, [0.75, 0.4, 0.22], [1, 1.65, Z - 0.15], m.frame);
  box(root, [0.55, 0.24, 0.03], [1, 1.65, Z - 0.02], m.black);
  box(root, [0.12, 0.07, 0.12], [0.78, 1.82, Z], m.gold);
  text(root, "FAN / 5V", [1, 2.2, Z], 0.12);
  line(
    root,
    [
      [1, 1.5, Z - 0.25],
      [0.5, 1.7, 0.9],
      [0, 2.1, 0.35],
    ],
    m.black,
    0.025,
  );
  const makeCable = (material) => {
    const plugs = {};
    for (const end of ["a", "b"]) {
      const plug = new THREE.Group();
      root.add(plug);
      box(plug, [0.72, 0.3, 0.24], [0, 0, 0], material);
      box(
        plug,
        [0.6, 0.18, 0.13],
        [0, 0, 0.15],
        end === "a" ? m.silver : m.dark,
      );
      for (const x of [-0.22, 0.22])
        box(plug, [0.09, 0.12, 0.02], [x, 0, 0.18], m.gold);
      if (end === "a")
        for (const x of [-0.07, 0.07])
          box(plug, [0.04, 0.12, 0.02], [x, 0, 0.18], m.black);
      else box(plug, [0.12, 0.06, 0.14], [-0.22, 0.17, 0], m.gold);
      text(plug, end === "a" ? "A+     A−" : "B+     B−", [0, 0.31, 0.2], 0.1);
      plugs[end] = plug;
    }
    const wire = line(
      root,
      [
        [-1, 1.5, 2],
        [0, 0.8, 2.2],
        [1, 1.5, 2],
      ],
      material,
      0.04,
    );
    return { plugs, wire, key: "" };
  };
  box(root, [2.4, 0.08, 1.35], [-2.5, 0.6, Z + 0.5], m.frame);
  text(root, "OLD / RECYCLE", [-2.5, 0.82, Z + 0.8], 0.12);
  const old = makeCable(m.black),
    replacement = makeCable(m.orange);
  const probes = {},
    leads = {};
  for (const [id, color] of [
    ["red", "#d45e45"],
    ["black", "#243637"],
  ]) {
    const mat = new THREE.MeshStandardMaterial({ color });
    const probe = new THREE.Group();
    root.add(probe);
    cylinder(probe, 0.023, 0.28, [0, 0, 0.14], m.silver);
    cylinder(probe, 0.055, 0.36, [0, -0.04, 0.45], mat);
    probes[id] = probe;
    const lead = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color }),
    );
    root.add(lead);
    leads[id] = lead;
  }
  return { root, stock, old, replacement, probes, leads, source, device };
}

export function createCableRepair({ rig, target, planePoint, latest }) {
  let old = fresh(),
    replacement = fresh(1.05),
    phase = "disconnect",
    key = "",
    note = "",
    gesture = null;
  let mode = "off",
    selfChecked = false,
    checks = {},
    reading = { display: "—", beep: false },
    stableKey = "",
    stableAt = 0;
  const tips = {
    red: new THREE.Vector3(-0.52, 0.5, TIP_Z),
    black: new THREE.Vector3(0.52, 0.5, TIP_Z),
  };
  let audioContext = null,
    oscillator = null,
    gain = null,
    sound = false,
    readingStable = false,
    activeProbe = "red";
  const measuring = () =>
    ["diagnose", "retest", "clear-old", "clear-new"].includes(phase);
  const returning = () => ["clear-old", "clear-new"].includes(phase);
  const rack = {
    red: new THREE.Vector3(-0.52, 0.5, TIP_Z),
    black: new THREE.Vector3(0.52, 0.5, TIP_Z),
  };
  const activeCable = () =>
    ["diagnose", "clear-old"].includes(phase) ? old : replacement;
  const contactPoints = () =>
    ["a", "b"].flatMap((end) =>
      ["plus", "minus"].map((net) => ({
        end,
        net,
        point: endpoint(end, activeCable()[end]).add(
          new THREE.Vector3(net === "plus" ? -0.22 : 0.22, 0, 0.18),
        ),
      })),
    );
  const touching = (tip) =>
    contactPoints().find((c) => tip.distanceTo(c.point) < 0.105);
  const currentEnd = () => (phase === "source" ? "a" : "b");
  const inserting = () => ["insert", "source"].includes(phase);
  const currentPose = () => replacement[currentEnd()];
  function beep(on) {
    if (gain && audioContext)
      gain.gain.setTargetAtTime(
        on && sound ? 0.025 : 0,
        audioContext.currentTime,
        0.015,
      );
  }
  function initAudio(force = false) {
    if (!sound && !force) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!audioContext && Audio) {
        audioContext = new Audio();
        oscillator = audioContext.createOscillator();
        gain = audioContext.createGain();
        oscillator.frequency.value = 880;
        gain.gain.value = 0;
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
      }
      if (audioContext?.state === "suspended")
        audioContext.resume().catch(() => {});
    } catch {
      /* The visual reading remains available without audio. */
    }
  }
  function resetMeter() {
    checks = {};
    stableKey = "";
    reading = { display: "OL", beep: false };
    tips.red.set(-0.52, 0.5, TIP_Z);
    tips.black.set(0.52, 0.5, TIP_Z);
    beep(false);
  }
  function connectionTargets() {
    const end = currentEnd();
    return [
      target(
        "wire-plug",
        endpoint(end, currentPose()),
        "握住接头：平移对位，再沿箭头主动推入",
        new THREE.Vector3(0, 0, -1),
      ),
      {
        ...target(
          "wire-socket",
          endpoint(end, { x: 0, y: 0, z: 0 }),
          end === "a"
            ? "已关闭输出的 USB 电源接口 · 固定"
            : "风扇两针插座 · 固定",
        ),
        guide: true,
      },
    ];
  }
  return {
    requiredTool: (game) =>
      measuring() ? "meter" : game.repairStep === 0 ? "hand" : "cable",
    targets() {
      if (phase === "disconnect")
        return [
          target(
            "wire-unplug",
            endpoint("b", old.b),
            "USB 端已断开；握住风扇端接头，沿箭头拔出",
            new THREE.Vector3(0, 0, 1),
          ),
        ];
      if (measuring())
        return [
          ...["red", "black"].map((id) => ({
            ...target(
              `probe-${id}`,
              tips[id].clone(),
              `${id === "red" ? "红" : "黑"}表笔：握住标记移到触点，松手保持`,
            ),
            radius: 22,
          })),
          ...(returning()
            ? ["red", "black"].map((id) => ({
                ...target(
                  `rack-${id}`,
                  rack[id].clone(),
                  `${id === "red" ? "红" : "黑"}表笔支架`,
                ),
                guide: true,
                contact: true,
                text: id === "red" ? "红架" : "黑架",
              }))
            : []),
          ...contactPoints().map((c) => ({
            ...target(
              `wire-${c.end}-${c.net}`,
              c.point,
              `${c.end.toUpperCase()}${c.net === "plus" ? "+" : "−"}`,
            ),
            guide: true,
            contact: true,
            text: `${c.end.toUpperCase()}${c.net === "plus" ? "+" : "−"}`,
          })),
        ];
      if (phase === "remove" || phase === "prepare") {
        const cable = phase === "remove" ? old : replacement;
        return [
          target(
            "wire-carry",
            new THREE.Vector3(cable.a.x, 0.88 + cable.a.y, Z + DEPTH),
            phase === "remove"
              ? "握住整条旧线，移到左侧回收盘"
              : "握住橙色新线，向下移到测量垫",
            phase === "remove"
              ? new THREE.Vector3(-1, 0, 0)
              : new THREE.Vector3(0, -1, 0),
          ),
        ];
      }
      if (inserting()) return connectionTargets();
      return [
        target(
          "wire-retain",
          endpoint("b", replacement.b),
          "沿箭头轻拉接头，确认连接固定",
          new THREE.Vector3(0, 0, 1),
        ),
      ];
    },
    begin(hit, point) {
      initAudio();
      if (hit.id.startsWith("probe-")) activeProbe = hit.id.slice(6);
      const planeZ = hit.id.startsWith("probe-") ? TIP_Z : hit.world.z;
      gesture = {
        id: hit.id,
        start: point,
        previous: point,
        plane: planePoint(point, planeZ),
        planeZ,
        axis: hit.axis,
        pose: { ...(phase === "disconnect" ? old.b : currentPose()) },
        a: { ...(phase === "remove" ? old : replacement).a },
        b: { ...(phase === "remove" ? old : replacement).b },
        tip: hit.id.startsWith("probe-") ? tips[hit.id.slice(6)].clone() : null,
        travel: 0,
        done: false,
      };
      note = "";
      stableKey = "";
      beep(false);
    },
    move(point, shiftKey) {
      if (!gesture) return;
      const g = gesture;
      if (g.id.startsWith("probe-")) {
        const p = planePoint(point, TIP_Z);
        if (p && g.plane)
          tips[g.id.slice(6)]
            .copy(g.tip)
            .add(p.sub(g.plane))
            .clamp(
              new THREE.Vector3(-1.65, 0.35, TIP_Z),
              new THREE.Vector3(1.65, 2.6, TIP_Z),
            );
        note =
          "表笔停在实际落点，不会吸附；两支表笔都碰到金属触点后松手，保持约半秒。";
      } else if (
        ["remove", "prepare"].includes(phase) ||
        (inserting() && !shiftKey && !latest.current.pushMode)
      ) {
        const p = planePoint(point, g.planeZ);
        if (!p || !g.plane) return;
        const delta = p.sub(g.plane);
        if (phase === "remove" || phase === "prepare") {
          const cable = phase === "remove" ? old : replacement;
          for (const end of ["a", "b"]) {
            cable[end].x = g[end].x + delta.x;
            cable[end].y = g[end].y + delta.y;
          }
          g.done =
            phase === "remove"
              ? cable.a.x < -1.5
              : Math.abs(cable.a.x) < 0.25 && Math.abs(cable.a.y) < 0.25;
          note =
            phase === "remove"
              ? "把已确认断路的旧线移到左侧，避免与新线混用。"
              : "新线移到垫上只是准备；还要在分离状态下逐根测通断。";
        } else {
          currentPose().x = g.pose.x + delta.x;
          currentPose().y = g.pose.y + delta.y;
          note = aligned(currentPose(), 0)
            ? "接头已对准，仍未连接。切到「沿槽推入」，沿箭头主动推到底。"
            : "先平移对准固定插座，方向键可微调。";
        }
      } else {
        const a = g.axis;
        if (!a || Math.hypot(a.x, a.y) < 8) {
          note = "点「线材近景」，让拔插轴线可见。";
          return;
        }
        const side =
          Math.abs((point.x - g.start.x) * a.y - (point.y - g.start.y) * a.x) /
          Math.hypot(a.x, a.y);
        if (side > 30) {
          note = "握住接头本体，沿箭头平直移动，不要横掰或拉线。";
          g.previous = point;
          return;
        }
        const distance =
          ((point.x - g.previous.x) * a.x + (point.y - g.previous.y) * a.y) /
          (a.x * a.x + a.y * a.y);
        if (phase === "disconnect") {
          old.b.z = Math.max(0, Math.min(DEPTH, old.b.z + distance));
          g.done = old.b.z >= DEPTH;
          note = g.done
            ? "两端已与设备分离。松手后再选万用表，检查整根线。"
            : "USB 电源端已在安全准备时拔开。现在沿轴线拔出风扇端接头。";
        } else if (inserting()) {
          const next = pushPart(currentPose(), 0, distance);
          if (next.blocked)
            note = "接头尚未对准，插座会阻挡。先平移对位，不能硬推。";
          else {
            Object.assign(currentPose(), { x: next.x, y: next.y, z: next.z });
            g.done = next.seated;
            note = g.done
              ? "已主动推到底，松手后继续下一处连接检查。"
              : "沿轴线继续推入，接头尚未到底。";
          }
        } else {
          g.travel = Math.max(0, g.travel + distance);
          g.done = g.travel >= 0.14;
          note = g.done
            ? "接头保持固定，轻拉检查通过。"
            : "沿箭头轻拉接头本体，确认不会松脱。";
        }
      }
      g.previous = point;
    },
    finish(cancelled) {
      const g = gesture;
      gesture = null;
      if (g?.id.startsWith("probe-")) note = "";
      if (!g || cancelled || !g.done) return false;
      if (phase === "disconnect") return true;
      if (phase === "remove") {
        phase = "prepare";
        note = "旧线已分开放置。握住上方橙色新线，向下移到测量垫。";
        return false;
      }
      if (phase === "prepare") return true;
      if (phase === "insert") {
        phase = "source";
        note = "风扇端已接好；USB 测试电源仍关闭。再把 USB 端对位并主动推入。";
        return false;
      }
      if (phase === "source") {
        phase = "retain";
        note = "两端接好，仍未通电。最后轻拉风扇端接头确认固定。";
        return false;
      }
      return phase === "retain";
    },
    setMode(value) {
      if (!["off", "voltage", "continuity", "current"].includes(value)) return;
      mode = value;
      stableKey = "";
      note = "";
      initAudio();
      beep(false);
    },
    toggleSound() {
      if (!latest.current.soundEnabled) initAudio(true);
      latest.current.toggleSound?.();
      beep(false);
    },
    selectProbe(id) {
      if (["red", "black"].includes(id)) activeProbe = id;
    },
    nudge(dx, dy) {
      if (measuring() && !gesture && latest.current.game.tool === "meter") {
        const t = target("probe", tips[activeProbe].clone(), ""),
          a = planePoint(t, TIP_Z),
          b = planePoint({ x: t.x + dx, y: t.y + dy }, TIP_Z);
        if (a && b)
          tips[activeProbe]
            .add(b.sub(a).setLength(0.025))
            .clamp(
              new THREE.Vector3(-1.65, 0.35, TIP_Z),
              new THREE.Vector3(1.65, 2.6, TIP_Z),
            );
        note = "";
        stableKey = "";
        beep(false);
        return;
      }
      if (!inserting() || gesture || latest.current.game.tool !== "cable")
        return;
      const p = connectionTargets()[0],
        a = planePoint(p, p.world.z),
        b = planePoint({ x: p.x + dx, y: p.y + dy }, p.world.z);
      if (!a || !b) return;
      const delta = b.sub(a).setLength(0.04);
      currentPose().x += delta.x;
      currentPose().y += delta.y;
      note = aligned(currentPose(), 0)
        ? "接头已对准，仍未连接。切到「沿槽推入」，沿箭头主动推到底。"
        : "小步调整中：把接头对准固定插座，保持凸键朝向。";
    },
    update(game, direct, time) {
      const enabled = direct && game.jobId === "fan-cable";
      sound = Boolean(latest.current.soundEnabled);
      rig.root.visible = game.jobId === "fan-cable";
      rig.stock.visible = game.jobId !== "fan-cable";
      const nextKey = `${enabled}:${game.jobId}:${game.repairStep}:${game.fixed}`;
      if (key !== nextKey) {
        const previousStep = key.split(":")[2];
        const sameSession = key.startsWith("true:fan-cable:") && enabled;
        key = nextKey;
        gesture = null;
        note = "";
        phase = ["disconnect", "diagnose", "remove", "retest"][
          Math.min(3, game.repairStep)
        ];
        if (!sameSession) {
          old = fresh();
          old.b.z = game.repairStep >= 1 ? DEPTH : 0;
          if (game.repairStep >= 3) {
            old.a.x = -2.5;
            old.b.x = -2.5;
          }
          replacement = fresh(game.repairStep >= 3 ? 0 : 1.05);
          selfChecked = false;
          mode = "off";
        }
        // A stored step has only durable repair meaning. A restored final step
        // begins with a new, disconnected harness and repeats measurement.
        if (!sameSession || previousStep !== String(game.repairStep))
          resetMeter();
        if (game.fixed) {
          replacement = fresh();
          replacement.a.z = 0;
          replacement.b.z = 0;
          phase = "done";
        }
      }
      const showMeter = enabled && measuring() && game.tool === "meter";
      if (showMeter) {
        const red = touching(tips.red),
          black = touching(tips.black);
        const shorted = tips.red.distanceTo(tips.black) < 0.1;
        reading = cableContinuity({
          mode,
          isolated: activeCable().a.z >= DEPTH && activeCable().b.z >= DEPTH,
          red,
          black,
          shorted,
          replacement: ["retest", "clear-new"].includes(phase),
        });
        const signature = `${phase}:${mode}:${reading.kind}:${red?.end}:${red?.net}:${black?.end}:${black?.net}:${Boolean(gesture)}`;
        if (signature !== stableKey) {
          stableKey = signature;
          stableAt = time;
        }
        const stable = !gesture && time - stableAt >= 550;
        readingStable = stable;
        beep(stable && reading.beep);
        if (stable && reading.kind === "self") selfChecked = true;
        if (stable && reading.net && selfChecked && !returning())
          checks[reading.net] = reading.display;
        if (checks.plus && checks.minus && !returning()) {
          beep(false);
          phase = phase === "diagnose" ? "clear-old" : "clear-new";
          note =
            "测量证据已记录。握住两支表笔，分别移回下方的红、黑支架，再继续拆装。";
        }
        if (
          returning() &&
          !gesture &&
          tips.red.distanceTo(rack.red) < 0.13 &&
          tips.black.distanceTo(rack.black) < 0.13
        ) {
          beep(false);
          if (phase === "clear-old") latest.current.act("repair");
          else {
            phase = "insert";
            note =
              "新线两根导体均导通，表笔已移开。换接线工具，将风扇端接头对位并沿轴线主动推入；USB 电源保持关闭。";
          }
        }
      } else {
        beep(false);
        stableKey = "";
        readingStable = false;
      }
      const drawCable = (model, state, visible) => {
        Object.values(model.plugs).forEach((p) => (p.visible = visible));
        model.wire.visible = visible;
        if (!visible) return;
        for (const end of ["a", "b"])
          model.plugs[end].position.copy(endpoint(end, state[end]));
        const geometryKey = JSON.stringify(state);
        if (model.key !== geometryKey) {
          model.key = geometryKey;
          const a = endpoint("a", state.a),
            b = endpoint("b", state.b);
          const curve = new THREE.CatmullRomCurve3([
            a,
            new THREE.Vector3(a.x + 0.15, a.y - 0.65, a.z + 0.05),
            new THREE.Vector3(
              (a.x + b.x) / 2,
              (a.y + b.y) / 2 - 0.85,
              Math.max(a.z, b.z) + 0.12,
            ),
            new THREE.Vector3(b.x - 0.15, b.y - 0.65, b.z + 0.05),
            b,
          ]);
          model.wire.geometry.dispose();
          model.wire.geometry = new THREE.TubeGeometry(
            curve,
            24,
            0.04,
            6,
            false,
          );
        }
      };
      const duringRepair = !game.fixed && game.panelOpen;
      drawCable(rig.old, old, !game.fixed);
      drawCable(
        rig.replacement,
        replacement,
        game.fixed || (game.repairStep >= 2 && phase !== "remove"),
      );
      for (const id of ["red", "black"]) {
        rig.probes[id].visible = showMeter;
        rig.leads[id].visible = showMeter;
        rig.probes[id].position.copy(tips[id]);
        if (showMeter)
          rig.leads[id].geometry.setFromPoints([
            new THREE.Vector3(id === "red" ? -0.25 : 0.25, 0.2, TIP_Z),
            tips[id].clone().add(new THREE.Vector3(0, -0.3, 0.5)),
          ]);
      }
      rig.source.visible = true;
      rig.device.visible = true;
      // Hidden while disassembling so the close-up does not obscure guard work.
      rig.root.visible =
        game.jobId === "fan-cable" && (duringRepair || game.fixed);
    },
    hud() {
      const errors = {
        off: "在仪表面板选择「Ω / 蜂鸣」通断档。",
        mode: "档位不对：本次检查线材通断，选择「Ω / 蜂鸣」。",
        air: "OL 也可能只是表笔悬空；确认两支表笔都接触金属。",
        cross:
          "当前测的是不同导体，OL 不能证明这根线断路。请测 A+ ↔ B+ 或 A− ↔ B−。",
        same: "两笔碰在同一端，只能证明局部接触，不能验证整根线。",
        self: "表笔短接有蜂鸣，万用表和表笔正常。现在逐根测线。",
        open: "A+ ↔ B+ 已接触但显示 OL：正极导体断路，无蜂鸣。",
        closed: "同根导体的两端呈低电阻并蜂鸣：这一根导体导通。",
        connected: "先断电并把线材两端分离后再测。",
      };
      return {
        cableRepair: true,
        cablePhase: phase,
        meter: measuring(),
        meterMode: mode,
        activeProbe,
        meterSound: sound,
        meterReading: reading.display,
        meterBeep: readingStable && reading.beep,
        selfChecked,
        cableChecks: { ...checks },
        canPush: inserting(),
        aligned: aligned(currentPose(), 0),
        positionAligned: aligned(currentPose(), 0),
        directionAligned: true,
        progress: measuring()
          ? Object.keys(checks).length / 2
          : phase === "disconnect"
            ? old.b.z / DEPTH
            : inserting()
              ? 1 - currentPose().z / DEPTH
              : 0,
        instruction:
          note ||
          (returning()
            ? "测量证据已记录。握住红、黑表笔，分别移回下方的红架和黑架；移开表笔后才继续拆装。"
            : measuring()
              ? !selfChecked
                ? "先选通断档，把红表笔尖移到黑表笔尖，松手短接约半秒，确认仪表会蜂鸣。"
                : errors[reading.kind]
              : {
                  disconnect:
                    "安全准备已拔开 USB 电源端。握住风扇端的两针接头，沿箭头平直拔出，使线材与设备完全分离。",
                  remove:
                    "已测得正极断路、负极正常。选接线工具，握住旧线移到左侧回收盘。",
                  prepare:
                    "握住上方橙色新线，向下移到测量垫；此时两端仍保持分离。",
                  insert:
                    "新线复测通过。握住风扇端接头，平移对准固定插座，再切换「沿槽推入」主动压入。",
                  source:
                    "风扇端已连接。将 USB 端对位并主动推入已关闭输出的测试电源；此时仍不通电。",
                  retain: "最后握住风扇端接头，沿箭头轻拉，确认不会松脱。",
                }[phase]),
      };
    },
    dispose() {
      beep(false);
      oscillator?.stop();
      audioContext?.close().catch(() => {});
    },
  };
}
