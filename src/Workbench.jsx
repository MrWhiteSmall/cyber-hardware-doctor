import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RotateCcw, Maximize, MousePointer2 } from "lucide-react";
import { parts, jobs, chapterOf } from "./game.js";
import { createDirectPC } from "./DirectPC.js";
import { createStorageRig } from "./StorageRepair.js";

const anchors = {
  cooler: [-0.35, 3.65, 0.8],
  ram: [0.8, 3.65, 0.65],
  gpu: [-0.2, 2, 0.85],
  storage: [-0.9, 1.4, 0.6],
  psu: [0, 0.65, 0.7],
  motherboard: [-1.1, 2.9, -0.2],
  fanBlade: [-0.9, 3.9, 0.8],
  fanMotor: [0.5, 3.1, 0.7],
  fanCable: [1, 0.7, 0.9],
  keycap: [-1.4, 3.2, 1],
  keySwitch: [0, 2.8, 0.9],
  keyPcb: [1.8, 2.2, 0.4],
};

function makeScene(host, onSelect, latest, labels) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  host.prepend(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "可旋转、缩放、点选零件的电脑三维工作台",
  );
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const home = new THREE.Vector3(7.3, 6.4, 11.8);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.55, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 7;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.54;
  controls.minPolarAngle = Math.PI * 0.15;
  scene.add(new THREE.HemisphereLight("#f7f5e8", "#738883", 2.4));
  const sun = new THREE.DirectionalLight("#fff3dd", 4);
  sun.position.set(-5, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 9, bottom: -7 });
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#acd8ee", 2);
  fill.position.set(6, 5, -4);
  scene.add(fill);
  const material = (color, metalness = 0, roughness = 0.65) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const m = {
    frame: material("#d3d7d3", 0.6),
    dark: material("#252e35", 0.5),
    board: material("#294b42", 0.15),
    chip: material("#1b272a", 0.15),
    silver: material("#9ea8aa", 0.8, 0.35),
    gold: material("#c7a65d", 0.65),
    orange: material("#d47745", 0.25),
    black: material("#162027"),
    green: material("#40674f", 0.3),
  };
  const box = (parent, dims, pos, mat = m.dark) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dims), mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (parent, r, depth, pos, mat, segments = 40) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, depth, segments),
      mat,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(...pos);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const line = (parent, points, mat, radius = 0.025) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 30, radius, 6, false),
      mat,
    );
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const text = (parent, words, pos, size = 0.24, color = "#d8ded6") => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = "600 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(words, 256, 64);
    const texture = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 4, size),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.position.set(...pos);
    parent.add(mesh);
    return mesh;
  };
  // All geometry is generated locally. The model needs no external assets.
  const floor = box(scene, [200, 0.2, 200], [0, -0.18, 0], material("#cfd5ca"));
  floor.receiveShadow = true;
  box(scene, [7.8, 0.07, 5.3], [0.1, -0.035, 0.4], material("#758e7e"));
  const grid = new THREE.GridHelper(7.6, 30, "#a9bcaa", "#91a997");
  grid.position.set(0.1, 0.009, 0.4);
  grid.scale.z = 0.67;
  scene.add(grid);
  const computer = new THREE.Group();
  scene.add(computer);
  const chassis = new THREE.Group();
  computer.add(chassis);
  box(chassis, [3.35, 5.1, 0.12], [0, 2.65, -0.78], m.frame);
  for (const x of [-1.66, 1.66])
    box(chassis, [0.13, 5.25, 2.12], [x, 2.65, 0.16], m.frame);
  for (const y of [0.09, 5.22])
    box(chassis, [3.4, 0.15, 2.14], [0, y, 0.16], m.frame);
  box(chassis, [0.13, 5, 2.04], [1.49, 2.65, 0.14], m.dark);
  for (const x of [-1.3, 1.3])
    for (const z of [-0.5, 0.7])
      box(chassis, [0.38, 0.16, 0.42], [x, 0, z], m.black);
  for (let y = 0; y < 30; y++)
    for (let z = 0; z < 5; z++)
      box(
        chassis,
        [0.018, 0.055, 0.15],
        [1.737, 0.5 + y * 0.145, -0.43 + z * 0.29],
        m.chip,
      );
  const groups = {};
  const part = (id) => {
    const g = new THREE.Group();
    g.userData.part = id;
    groups[id] = g;
    computer.add(g);
    return g;
  };
  const board = part("motherboard");
  box(board, [2.65, 3.65, 0.09], [-0.13, 3.05, -0.6], m.board);
  const traces = material("#709483", 0.4);
  for (let i = 0; i < 32; i++) {
    const x = -1.32 + i * 0.076;
    box(
      board,
      [0.012, 0.45 + (i % 7) * 0.12, 0.012],
      [x, 2.45, -0.544],
      traces,
    );
    box(board, [0.32, 0.012, 0.012], [x, 2.9 - (i % 6) * 0.06, -0.537], traces);
  }
  for (let i = 0; i < 12; i++) {
    const x = -1.2 + (i % 4) * 0.21,
      y = 4.4 - Math.floor(i / 4) * 0.27;
    box(board, [0.14, 0.18, 0.11], [x, y, -0.48], m.chip);
    cylinder(board, 0.05, 0.12, [x, y - 0.13, -0.46], m.silver, 12);
  }
  for (const y of [2.25, 1.98, 1.7])
    box(board, [1.65, 0.07, 0.12], [-0.23, y, -0.45], m.black);
  box(board, [0.45, 0.8, 0.3], [-1.3, 3.5, -0.35], m.silver);
  box(board, [0.7, 0.42, 0.17], [0.65, 2.55, -0.44], m.dark);
  text(board, "LR / B450", [-0.1, 2.7, -0.52], 0.16);
  const fans = [];
  function fan(parent, x, y, z, radius, accent = m.silver) {
    box(parent, [radius * 2.2, radius * 2.2, 0.16], [x, y, z - 0.07], m.dark);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.88, radius * 0.07, 8, 48),
      accent,
    );
    ring.position.set(x, y, z + 0.05);
    parent.add(ring);
    const rotor = new THREE.Group();
    rotor.position.set(x, y, z + 0.07);
    parent.add(rotor);
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9;
      const blade = box(
        rotor,
        [radius * 0.42, radius * 0.72, 0.025],
        [Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45, 0],
        m.black,
      );
      blade.rotation.z = a - 0.65;
    }
    cylinder(rotor, radius * 0.24, 0.08, [0, 0, 0.04], accent);
    fans.push(rotor);
    return rotor;
  }
  const cooling = part("cooler");
  box(cooling, [1.25, 1.32, 0.55], [-0.35, 3.65, -0.11], m.silver);
  for (let i = 0; i < 17; i++)
    box(cooling, [1.3, 0.025, 0.62], [-0.35, 3.04 + i * 0.077, -0.1], m.silver);
  fan(cooling, -0.35, 3.65, 0.41, 0.59, m.silver);
  const ram = part("ram");
  const ramLatches = [];
  for (const x of [0.67, 0.98]) {
    const module = x === 0.67 ? ram : board;
    box(module, [0.15, 1.62, 0.42], [x, 3.65, -0.24], m.green);
    box(module, [0.17, 1.42, 0.12], [x, 3.65, 0.02], m.dark);
    for (const y of [2.78, 4.51]) {
      const latch = box(board, [0.21, 0.1, 0.2], [x, y, -0.25], m.frame);
      if (x === 0.67) ramLatches.push(latch);
    }
    for (let i = 0; i < 8; i++)
      box(module, [0.17, 0.08, 0.025], [x, 3.1 + i * 0.16, 0.09], m.silver);
  }
  text(ram, "DDR4", [0.67, 3.65, 0.12], 0.12).rotation.z = Math.PI / 2;
  const gpu = part("gpu");
  box(gpu, [2.45, 0.82, 0.9], [-0.12, 2.04, 0.19], m.dark);
  box(gpu, [2.5, 0.07, 0.98], [-0.12, 2.48, 0.19], m.silver);
  for (const x of [-0.72, 0.45]) fan(gpu, x, 2.03, 0.69, 0.34);
  text(gpu, "GEFORCE / 6G", [-0.15, 2.49, 0.7], 0.11);
  const storage = part("storage");
  box(storage, [1, 0.64, 0.18], [-0.82, 1.28, -0.03], m.dark);
  box(storage, [0.76, 0.4, 0.015], [-0.82, 1.28, 0.069], material("#d8dbcd"));
  text(storage, "SSD / 512", [-0.82, 1.28, 0.085], 0.13, "#344a48");
  const storageRig = createStorageRig({ storage, box, line, materials: m });
  const psu = part("psu");
  box(psu, [3.13, 0.81, 1.8], [0, 0.56, 0.1], m.dark);
  text(psu, "450 W", [-0.77, 0.58, 1.012], 0.22);
  for (let i = 0; i < 13; i++)
    box(psu, [0.035, 0.37, 0.018], [0.2 + i * 0.085, 0.56, 1.01], m.black);
  const casefans = new THREE.Group();
  chassis.add(casefans);
  fan(casefans, 0, 4.75, -0.48, 0.27);
  for (const y of [1.7, 3.05, 4.4]) {
    const f = new THREE.Group();
    f.position.set(1.44, y, 0.12);
    f.rotation.y = -Math.PI / 2;
    chassis.add(f);
    fan(f, 0, 0, 0.1, 0.54, m.frame);
  }
  const cableGroup = new THREE.Group();
  computer.add(cableGroup);
  for (let i = 0; i < 6; i++)
    line(
      cableGroup,
      [
        [1.13 + i * 0.025, 3.8, -0.3],
        [1.29, 3.15, 0.03 + i * 0.035],
        [1.1, 1.08, 0.25 + i * 0.04],
      ],
      i < 2 ? m.orange : m.black,
      0.025,
    );
  const sata = line(
    storage,
    [
      [-0.28, 1.23, 0.03],
      [0.15, 1.15, 0.18],
      [0.79, 1.5, 0.16],
      [1.05, 2.5, -0.3],
    ],
    m.orange,
    0.04,
  );
  const panel = new THREE.Group();
  computer.add(panel);
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#adc2b8",
    transparent: true,
    opacity: 0.17,
    metalness: 0.15,
    roughness: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  box(panel, [3.17, 4.98, 0.035], [0, 2.67, 1.22], glass);
  for (const x of [-1.61, 1.61])
    box(panel, [0.055, 5.01, 0.07], [x, 2.67, 1.22], m.dark);
  for (const y of [0.16, 5.18])
    box(panel, [3.25, 0.055, 0.07], [0, y, 1.22], m.dark);
  const screws = [];
  for (const x of [-1.58, 1.58])
    for (const y of [0.2, 5.13]) {
      const s = cylinder(panel, 0.065, 0.055, [x, y, 1.28], m.silver, 16);
      s.userData.screw = true;
      screws.push(s);
      const slot = box(s, [0.075, 0.005, 0.012], [0, 0.031, 0], m.dark);
      slot.rotation.x = -Math.PI / 2;
    }
  const dust = new THREE.Group();
  cooling.add(dust);
  const dustPatches = [];
  for (const y of [3.34, 3.96])
    for (const x of [-0.72, -0.35, 0.02]) {
      const patch = new THREE.Group();
      patch.position.set(x, y, 0.68);
      dust.add(patch);
      dustPatches.push(patch);
    }
  const dustMat = material("#b2a18b");
  for (let i = 0; i < 45; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + (i % 4) * 0.008, 5, 4),
      dustMat,
    );
    p.position.set(
      (((i * 17) % 43) / 43 - 0.5) * 0.22,
      (((i * 13) % 41) / 41 - 0.5) * 0.24,
      (i % 3) * 0.012,
    );
    dustPatches[i % dustPatches.length].add(p);
  }
  const fanDevice = new THREE.Group();
  scene.add(fanDevice);
  const sage = material("#a5b4a0", 0.35),
    ivory = material("#eee7d6", 0.2);
  const base = cylinder(fanDevice, 1.25, 0.18, [0, 0.15, 0], sage);
  base.rotation.x = 0;
  base.scale.z = 0.7;
  box(fanDevice, [0.33, 1.8, 0.25], [0, 1.1, -0.3], sage);
  cylinder(fanDevice, 1.6, 0.38, [0, 3.4, 0], sage, 64);
  cylinder(fanDevice, 1.48, 0.4, [0, 3.4, 0.1], m.dark, 64);
  const motor = new THREE.Group();
  motor.userData.part = "fanMotor";
  groups.fanMotor = motor;
  fanDevice.add(motor);
  cylinder(motor, 0.42, 0.7, [0, 3.4, 0.26], m.silver);
  cylinder(motor, 0.15, 0.85, [0, 3.4, 0.4], m.gold);
  const blade = new THREE.Group();
  blade.userData.part = "fanBlade";
  groups.fanBlade = blade;
  fanDevice.add(blade);
  const fanRotor = new THREE.Group();
  fanRotor.position.set(0, 3.4, 0.62);
  blade.add(fanRotor);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), ivory);
    leaf.scale.set(0.4, 0.88, 0.045);
    leaf.position.set(Math.sin(a) * 0.67, Math.cos(a) * 0.67, 0);
    leaf.rotation.z = -a + 0.28;
    fanRotor.add(leaf);
  }
  cylinder(fanRotor, 0.31, 0.13, [0, 0, 0.1], sage);
  const fanCover = new THREE.Group();
  fanDevice.add(fanCover);
  for (let i = 1; i <= 6; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(i * 0.25, 0.018, 5, 60),
      m.frame,
    );
    ring.position.set(0, 3.4, 0.92);
    fanCover.add(ring);
  }
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18;
    line(
      fanCover,
      [
        [0, 3.4, 1.02],
        [Math.sin(a) * 0.8, 3.4 + Math.cos(a) * 0.8, 1],
        [Math.sin(a) * 1.51, 3.4 + Math.cos(a) * 1.51, 0.91],
      ],
      m.frame,
      0.016,
    );
  }
  text(fanCover, "BREEZE / 05", [0, 3.4, 1.06], 0.17, "#e4e8d9");
  const fanWire = new THREE.Group();
  fanWire.userData.part = "fanCable";
  groups.fanCable = fanWire;
  fanDevice.add(fanWire);
  line(
    fanWire,
    [
      [0, 0.3, -0.3],
      [1, 0.2, 0],
      [1.7, 0.15, 0.6],
      [1.4, 0.15, 1.5],
      [0.6, 0.15, 1.5],
    ],
    m.black,
    0.045,
  );
  box(fanWire, [0.3, 0.15, 0.42], [0.48, 0.17, 1.5], m.dark);
  box(fanWire, [0.27, 0.13, 0.22], [0.48, 0.17, 1.8], m.silver);
  const fanDust = new THREE.Group();
  blade.add(fanDust);
  for (let i = 0; i < 35; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), dustMat);
    p.position.set(
      Math.sin(i * 2.4) * (i % 6) * 0.22,
      3.4 + Math.cos(i * 2.4) * (i % 6) * 0.22,
      0.99,
    );
    fanDust.add(p);
  }
  const keyboardDevice = new THREE.Group();
  scene.add(keyboardDevice);
  const keyboardBody = new THREE.Group();
  keyboardBody.position.set(0, 2.45, 0);
  keyboardBody.rotation.x = -0.35;
  keyboardDevice.add(keyboardBody);
  box(keyboardBody, [6.15, 2.55, 0.35], [0, 0, -0.2], sage);
  const keyBoard = new THREE.Group();
  keyBoard.userData.part = "keyPcb";
  groups.keyPcb = keyBoard;
  keyboardBody.add(keyBoard);
  box(keyBoard, [5.85, 2.28, 0.08], [0, 0, 0.025], m.board);
  for (let i = 0; i < 24; i++)
    box(keyBoard, [0.025, 1.8, 0.01], [-2.6 + i * 0.22, 0, 0.075], traces);
  box(keyBoard, [0.7, 0.4, 0.12], [2, -0.65, 0.13], m.dark);
  box(keyBoard, [0.55, 0.12, 0.15], [2, -0.36, 0.19], m.frame);
  line(
    keyBoard,
    [
      [2, -0.36, 0.25],
      [1.4, -0.2, 0.32],
      [1, -0.5, 0.25],
    ],
    ivory,
    0.1,
  );
  const keyCover = new THREE.Group();
  keyboardBody.add(keyCover);
  box(keyCover, [6, 2.45, 0.08], [0, 0, 0.15], ivory);
  const capGroup = new THREE.Group();
  capGroup.userData.part = "keycap";
  groups.keycap = capGroup;
  keyboardBody.add(capGroup);
  const switches = new THREE.Group();
  switches.userData.part = "keySwitch";
  groups.keySwitch = switches;
  keyboardBody.add(switches);
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 14; col++) {
      const x = -2.7 + col * 0.414,
        y = 0.93 - row * 0.43;
      if ((row === 2 && col === 3) || (row === 2 && col === 7)) continue;
      const key = box(
        keyCover,
        [0.36, 0.35, 0.22],
        [x, y, 0.32],
        col === 0 && row === 0
          ? m.orange
          : row === 4
            ? material("#abb4a1")
            : ivory,
      );
      if (row < 4)
        text(
          keyCover,
          row === 0
            ? String(col + 1)
            : "QWERTYUIOPASDFGHJKLZXCVBNM"[(row * 14 + col) % 26],
          [x, y, 0.439],
          0.065,
          "#7c8773",
        );
    }
  box(capGroup, [0.36, 0.35, 0.23], [-1.458, 0.07, 0.34], m.orange);
  text(capGroup, "F", [-1.458, 0.07, 0.465], 0.08, "#f8f0df");
  box(
    switches,
    [0.32, 0.32, 0.2],
    [0.198, 0.07, 0.3],
    material("#d6c7a4", 0.2),
  );
  box(switches, [0.13, 0.13, 0.13], [0.198, 0.07, 0.47], m.orange);
  line(
    keyboardDevice,
    [
      [0, 3.7, -0.4],
      [0.1, 4.4, -0.4],
      [1.6, 4.6, -0.6],
      [2.5, 4.2, -0.7],
    ],
    m.black,
    0.045,
  );
  text(keyboardDevice, "TYPE / AGAIN", [0, 1, 0.4], 0.21, "#80917b");
  // A screwdriver, spare screws and a parts tray make the bench feel lived in.
  const driver = new THREE.Group();
  driver.position.set(2.8, 0.12, 1.7);
  driver.rotation.set(-Math.PI / 2, 0, -0.3);
  scene.add(driver);
  cylinder(driver, 0.12, 0.78, [0, 0, 0], m.orange);
  cylinder(driver, 0.035, 1.1, [0, 0, 0.8], m.silver);
  box(scene, [1.15, 0.12, 0.7], [-2.55, 0.09, 0.4], material("#c2c6b8", 0.5));
  for (let i = 0; i < 4; i++) {
    const s = cylinder(
      scene,
      0.065,
      0.07,
      [-2.85 + (i % 2) * 0.4, 0.18, 0.2 + Math.floor(i / 2) * 0.35],
      m.silver,
    );
    s.rotation.x = 0;
  }
  const selection = new THREE.Box3Helper(new THREE.Box3(), "#f0a06f");
  selection.visible = false;
  scene.add(selection);
  const direct = createDirectPC({
    host,
    renderer,
    camera,
    controls,
    scene,
    panel,
    screws,
    ram,
    latches: ramLatches,
    dustPatches,
    storageRig,
    latest,
  });
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let down = null;
  const pointerDown = (e) => {
    down = [e.clientX, e.clientY];
  };
  const pointerUp = (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(mouse, camera);
    const activeDevice = chapterOf(
      jobs.find((j) => j.id === latest.current.game.jobId),
    ).id;
    const hits = ray.intersectObject(
      activeDevice === "pc"
        ? computer
        : activeDevice === "fan"
          ? fanDevice
          : keyboardDevice,
      true,
    );
    for (const hit of hits) {
      if (
        hit.object.userData.screw &&
        !latest.current.game.panelOpen &&
        !latest.current.direct
      ) {
        latest.current.act(latest.current.game.fixed ? "screw" : "unscrew");
        return;
      }
      let obj = hit.object;
      while (obj && !obj.userData.part) obj = obj.parent;
      if (obj) {
        onSelect(obj.userData.part);
        return;
      }
    }
  };
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const projected = new THREE.Vector3();
  renderer.setAnimationLoop((time) => {
    const { game, exploded } = latest.current;
    const device = chapterOf(jobs.find((j) => j.id === game.jobId)).id;
    computer.visible = device === "pc";
    fanDevice.visible = device === "fan";
    keyboardDevice.visible = device === "keyboard";
    const open = game.panelOpen;
    panel.position.x = THREE.MathUtils.lerp(
      panel.position.x,
      open ? -4.6 : 0,
      0.09,
    );
    panel.rotation.y = THREE.MathUtils.lerp(
      panel.rotation.y,
      open ? -0.28 : 0,
      0.09,
    );
    panel.visible = panel.position.x > -4.5;
    fanCover.position.x = THREE.MathUtils.lerp(
      fanCover.position.x,
      open ? -4.2 : 0,
      0.09,
    );
    fanCover.visible = fanCover.position.x > -4.1;
    keyCover.position.y = THREE.MathUtils.lerp(
      keyCover.position.y,
      open ? 3.5 : 0,
      0.09,
    );
    keyCover.visible = keyCover.position.y < 3.4;
    if (device === "fan" && !game.unplugged) fanRotor.rotation.z = time * 0.002;
    fanDust.visible = game.jobId === "fan-dust" && !game.fixed;
    capGroup.position.y = THREE.MathUtils.lerp(
      capGroup.position.y,
      device === "keyboard" && game.repairStep > 0 && !game.fixed ? 1 : 0,
      0.08,
    );
    screws.forEach((s, i) => {
      s.visible = i < game.screws;
    });
    for (const [id, group] of Object.entries(groups)) {
      const offset = exploded
        ? {
            motherboard: -0.3,
            cooler: 1.6,
            ram: 1.2,
            gpu: 1,
            storage: 0.9,
            psu: 0.4,
          }[id]
        : 0;
      group.position.z = THREE.MathUtils.lerp(group.position.z, offset, 0.08);
    }
    const ramOut = game.jobId === "memory" && game.repairStep === 1;
    ram.position.y = THREE.MathUtils.lerp(
      ram.position.y,
      ramOut ? 0.25 : 0,
      0.08,
    );
    ram.rotation.z = THREE.MathUtils.lerp(
      ram.rotation.z,
      game.jobId === "memory" && !game.fixed ? -0.045 : 0,
      0.08,
    );
    sata.visible = game.jobId !== "storage";
    dust.visible = game.jobId === "cooling" && !game.fixed;
    if (
      !game.unplugged &&
      !(game.jobId === "cooling" && game.repairStep === 1 && !game.fixed)
    )
      fans.forEach((f, i) => {
        f.rotation.z = time * 0.003 * (i % 2 ? -1 : 1);
      });
    if (game.selected && open) {
      selection.box.setFromObject(groups[game.selected]);
      selection.visible = true;
    } else selection.visible = false;
    controls.update();
    direct.update(time);
    for (const [id, el] of Object.entries(labels.current)) {
      if (!el) continue;
      projected.set(...anchors[id]);
      if (device === "pc" && id === "ram" && latest.current.direct)
        projected.set(0.67, 3.65, 0.16).applyMatrix4(ram.matrixWorld);
      else if (device === "pc") projected.add(groups[id].position);
      projected.project(camera);
      el.style.left = `${(projected.x * 0.5 + 0.5) * host.clientWidth}px`;
      el.style.top = `${(-projected.y * 0.5 + 0.5) * host.clientHeight}px`;
      el.style.visibility =
        projected.z > 1 || projected.x < -1 || projected.x > 1
          ? "hidden"
          : "visible";
    }
    renderer.render(scene, camera);
  });
  return {
    rotatePart: () => direct.rotate(),
    nudgePart: (dx, dy) => direct.nudge(dx, dy),
    focusMemory: () => {
      controls.minDistance = 7;
      controls.target.set(0.67, 3.65, 0.8);
      camera.position.copy(controls.target).add(new THREE.Vector3(3.2, 1.2, 7));
      controls.update();
    },
    focusCooler: () => {
      controls.minDistance = 7;
      controls.target.set(-0.35, 3.65, 0.5);
      camera.position.copy(controls.target).add(new THREE.Vector3(2.5, 0.8, 7));
      controls.update();
    },
    focusStorage: () => {
      controls.minDistance = 3;
      controls.target.set(-0.05, 1.35, 0.1);
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3(1.2, 0.55, 3));
      controls.update();
    },
    reset: () => {
      controls.minDistance = 7;
      camera.position.copy(home);
      controls.target.set(0, 2.55, 0);
      controls.update();
    },
    dispose: () => {
      direct.dispose();
      observer.disconnect();
      controls.dispose();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const mat of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            mat.map?.dispose();
            mat.dispose();
          }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export default function Workbench({
  game,
  act,
  exploded,
  setExploded,
  showLabels,
  setShowLabels,
  direct = false,
  onFallback,
}) {
  const host = useRef(null),
    api = useRef(null),
    labels = useRef({}),
    latest = useRef({ game, act, exploded });
  const [error, setError] = useState(false);
  const [hud, setHud] = useState(null),
    [pushMode, setPushMode] = useState(false);
  latest.current = { game, act, exploded, direct, pushMode, onHud: setHud };
  useEffect(() => {
    setPushMode(
      direct &&
        !game.fixed &&
        ((game.jobId === "memory" && game.repairStep === 2) ||
          (game.jobId === "storage" && game.repairStep === 1)),
    );
  }, [direct, game.jobId, game.repairStep, game.panelOpen, game.fixed]);
  useEffect(() => {
    // Return from a repair close-up so the removed side panel is reachable again.
    if (direct && game.fixed) api.current?.reset();
  }, [direct, game.fixed]);
  useEffect(() => {
    api.current?.reset();
  }, [game.jobId]);
  useEffect(() => {
    if (
      direct &&
      game.jobId === "cooling" &&
      game.inspected.includes("cooler") &&
      !game.fixed
    )
      api.current?.focusCooler();
  }, [direct, game.jobId, game.inspected.length, game.fixed]);
  useEffect(() => {
    if (
      direct &&
      game.jobId === "storage" &&
      game.inspected.includes("storage") &&
      !game.fixed
    )
      api.current?.focusStorage();
  }, [direct, game.jobId, game.inspected.length, game.fixed]);
  useEffect(() => {
    try {
      api.current = makeScene(
        host.current,
        (id) => latest.current.act("select", id),
        latest,
        labels,
      );
    } catch (e) {
      console.error(e);
      setError(true);
      onFallback?.();
    }
    return () => api.current?.dispose();
  }, []);
  return (
    <div className={`scene-shell ${direct && hud ? "direct-active" : ""}`}>
      <div className="scene-host" ref={host}>
        {error && (
          <div className="webgl-fallback">
            当前浏览器没有启用 3D 渲染。
            <br />
            仍可用下方零件按钮完成全部维修操作。
          </div>
        )}
        {direct && hud && (
          <>
            <div className="mechanic-targets">
              {hud.canPush && hud.targets.length === 2 && (
                <svg className="alignment-guide" aria-hidden="true">
                  <line
                    x1={hud.targets[0].x}
                    y1={hud.targets[0].y}
                    x2={hud.targets[1].x}
                    y2={hud.targets[1].y}
                  />
                  <polygon points={hud.alignmentZone} />
                </svg>
              )}
              {hud.targets.map((target) => (
                <div
                  key={target.id}
                  className={`mechanic-marker ${target.id === "screw" ? "screw-marker" : ""} ${target.id.startsWith("dust") ? "dust-marker" : ""} ${target.guide ? "guide-marker" : ""} ${hud.canPush && hud.aligned ? "aligned-marker" : ""}`}
                  title={target.label}
                  data-cleared={target.cleared || false}
                  data-kind={target.id}
                  data-axis-x={target.axis?.x || 0}
                  data-axis-y={target.axis?.y || 0}
                  style={{ left: target.x, top: target.y }}
                >
                  <span className="marker-center" />
                  <i>
                    {target.cleared
                      ? "✓"
                      : target.id.startsWith("dust")
                        ? "·"
                        : target.id === "fan-hold"
                          ? "☝"
                          : target.guide
                            ? "+"
                            : target.id === "screw"
                              ? hud.action === "unscrew"
                                ? "↺"
                                : "↻"
                              : target.id.startsWith("latch")
                                ? "↕"
                                : "✥"}
                  </i>
                  {target.axis && (
                    <span
                      className="mechanic-axis"
                      style={{
                        transform: `rotate(${Math.atan2(target.axis.y, target.axis.x)}rad)`,
                      }}
                    >
                      ➜
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {showLabels &&
          chapterOf(jobs.find((j) => j.id === game.jobId))
            .parts.filter((id) => id !== "motherboard")
            .map((id) => (
              <button
                ref={(el) => {
                  labels.current[id] = el;
                }}
                key={id}
                className={`scene-label ${game.selected === id ? "selected" : ""}`}
                onClick={() => act("select", id)}
              >
                <span />
                {parts[id].name}
              </button>
            ))}
      </div>
      {direct && hud && (
        <div className="mechanic-hud">
          <span>
            手动实操 /{" "}
            {hud.action === "screw" || hud.action === "unscrew"
              ? `${Math.round(hud.progress * 720)}° / 720°`
              : hud.cleaning
                ? hud.step === 0
                  ? "固定风扇叶片"
                  : `积灰清理 ${hud.cleaned} / ${hud.total}`
                : hud.storage
                  ? {
                      power: "检查供电接头",
                      release: "按锁扣并拔出数据接头",
                      insert: "对位并手动推入",
                      verify: "轻拉确认锁扣固定",
                    }[hud.storagePhase]
                  : hud.canPush
                    ? `${hud.aligned ? "位置与方向吻合" : "未对齐"} · ${hud.angle}°`
                    : "沿结构操作"}
          </span>
          <p>{hud.instruction}</p>
          <div className="mechanic-progress">
            <i style={{ width: `${Math.min(100, hud.progress * 100)}%` }} />
          </div>
          {hud.storage && (
            <div className="connector-lesson" data-phase={hud.storagePhase}>
              <div
                className={
                  hud.storagePhase === "power" ? "current" : "verified"
                }
              >
                <svg viewBox="0 0 110 30" aria-hidden="true">
                  <path d="M7 7H100V14H14V25H7Z" />
                </svg>
                <span>
                  15 针供电 <small>提供电力</small>
                </span>
              </div>
              <div className={hud.storagePhase === "power" ? "" : "current"}>
                <svg viewBox="0 0 110 30" aria-hidden="true">
                  <path d="M30 7H80V14H37V25H30Z" />
                </svg>
                <span>
                  7 针数据 <small>连接主板</small>
                </span>
              </div>
              <button onClick={() => api.current?.focusStorage()}>
                硬盘近景
              </button>
            </div>
          )}
          {hud.cleaning && (
            <div className="mechanic-buttons">
              <button onClick={() => api.current?.focusCooler()}>
                散热器近景
              </button>
              <small>在模型标记上操作，完成后松开鼠标</small>
            </div>
          )}
          {hud.canPush && (
            <>
              <div
                className={`alignment-status ${hud.aligned ? "ready" : ""}`}
                role="status"
              >
                <span>
                  {hud.positionAligned ? "✓ 位置对准" : "○ 位置需微调"}
                </span>
                <span>
                  {hud.directionAligned ? "✓ 缺口方向正确" : "○ 按 R 检查方向"}
                </span>
                <span>仍需手动推到底</span>
              </div>
              <div className="mechanic-buttons">
                <button
                  className={pushMode ? "active" : ""}
                  aria-pressed={pushMode}
                  onClick={() => setPushMode(true)}
                >
                  沿槽推入
                  <small>沿箭头拖动</small>
                </button>
                <button
                  className={!pushMode ? "active" : ""}
                  aria-pressed={!pushMode}
                  onClick={() => setPushMode(false)}
                >
                  平移对位
                </button>
                {hud.action === "repair" && (
                  <button onClick={() => api.current?.rotatePart()}>
                    旋转 90° <small>R</small>
                  </button>
                )}
              </div>
              <div
                className="mechanic-nudge"
                role="group"
                aria-label="位置微调"
              >
                <span>微调</span>
                {[
                  ["←", -1, 0, "向左微调"],
                  ["↑", 0, -1, "向上微调"],
                  ["↓", 0, 1, "向下微调"],
                  ["→", 1, 0, "向右微调"],
                ].map(([label, dx, dy, name]) => (
                  <button
                    key={name}
                    aria-label={name}
                    onClick={() => api.current?.nudgePart(dx, dy)}
                  >
                    {label}
                  </button>
                ))}
                <small>也可用键盘方向键</small>
                {hud.action === "repair" && (
                  <button
                    className="memory-focus"
                    onClick={() =>
                      hud.storage
                        ? api.current?.focusStorage()
                        : api.current?.focusMemory()
                    }
                  >
                    维修近景
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <div className="bench-caption">
        <span className="tiny-cross">+</span> WORKBENCH — 01{" "}
        <span className="tiny-cross">+</span>
      </div>
      <div className="view-controls">
        <button
          onClick={() => api.current?.reset()}
          title="重置视角"
          aria-label="重置视角"
        >
          <RotateCcw size={15} />
        </button>
        <button
          disabled={direct}
          className={exploded ? "active" : ""}
          onClick={() => setExploded(!exploded)}
          title="切换拆解视图"
          aria-label="切换拆解视图"
        >
          <Maximize size={15} />
        </button>
        <button
          className={showLabels ? "active" : ""}
          onClick={() => setShowLabels(!showLabels)}
        >
          零件标签
        </button>
      </div>
      <span className="orbit-hint">
        <MousePointer2 size={12} /> 拖动旋转 · 滚轮缩放 · 点击查看零件
      </span>
    </div>
  );
}
