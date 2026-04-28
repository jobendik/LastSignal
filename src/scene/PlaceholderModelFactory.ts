import * as THREE from 'three';
import { boxWithEdges, cylinderKnob, ledIndicator, thinPanel } from '../three/Materials';

/**
 * PlaceholderModelFactory — builds all diegetic objects using Three.js
 * primitives. Each function returns a THREE.Group with named children so
 * downstream systems (animation, interaction) can find sub-meshes reliably.
 *
 * Every factory here has an obvious replacement point: swap the Group's
 * contents with a loaded GLTF scene that uses the same child names.
 */

// ---------- Room / environment ----------

export function buildRoom(): THREE.Group {
  const room = new THREE.Group();
  room.name = 'room';

  // Floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a1816, roughness: 0.95, metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  room.add(floor);

  // Back wall (behind desk)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x14110e, roughness: 1, metalness: 0.0,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMat);
  backWall.position.set(0, 2, -2);
  backWall.receiveShadow = true;
  room.add(backWall);

  // Side walls (slightly angled so corners feel closed)
  const left = backWall.clone() as THREE.Mesh;
  left.position.set(-3.2, 2, 0.8);
  left.rotation.y = Math.PI / 2;
  left.scale.set(0.9, 1, 1);
  room.add(left);

  const right = left.clone() as THREE.Mesh;
  right.position.set(3.2, 2, 0.8);
  right.rotation.y = -Math.PI / 2;
  room.add(right);

  // Small window behind the desk with painted "exterior"
  const frame = boxWithEdges(1.6, 0.9, 0.05, 0x1b1a18, 0x0a0a0a);
  frame.position.set(0, 2.1, -1.95);
  frame.name = 'window-frame';
  room.add(frame);

  const exteriorMat = new THREE.MeshBasicMaterial({ color: 0x0a2030 });
  const exterior = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.78), exteriorMat);
  exterior.position.set(0, 2.1, -1.93);
  room.add(exterior);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 1 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.2;
  ceil.receiveShadow = true;
  room.add(ceil);

  return room;
}

// ---------- Desk ----------

export function buildDesk(): THREE.Group {
  const desk = new THREE.Group();
  desk.name = 'desk';

  const topColor = 0x3a2c1e;
  const legColor = 0x251a10;

  const top = boxWithEdges(2.8, 0.08, 1.2, topColor, 0x120a05);
  top.position.set(0, 0.78, 0);
  top.name = 'desk-top';
  desk.add(top);

  const legGeom = boxWithEdges(0.1, 0.78, 0.1, legColor, 0x0a0603);
  const offsets: [number, number][] = [
    [-1.35, -0.55], [1.35, -0.55], [-1.35, 0.55], [1.35, 0.55],
  ];
  for (const [x, z] of offsets) {
    const leg = legGeom.clone();
    leg.position.set(x, 0.39, z);
    desk.add(leg);
  }

  // Drawer on the right side, closed — its own group so we can animate open
  const drawerGroup = new THREE.Group();
  drawerGroup.name = 'drawer';
  drawerGroup.position.set(1.0, 0.52, 0.4);

  const drawerFace = boxWithEdges(0.65, 0.3, 0.05, 0x30221a, 0x100807);
  drawerFace.name = 'drawer-face';
  drawerGroup.add(drawerFace);

  const lock = new THREE.Mesh(
    new THREE.CircleGeometry(0.02, 14),
    new THREE.MeshBasicMaterial({ color: 0xe04b4b })
  );
  lock.position.set(0, 0, 0.026);
  lock.name = 'drawer-lock-led';
  drawerGroup.add(lock);

  desk.add(drawerGroup);

  return desk;
}

// ---------- Tape deck ----------

export function buildTapeDeck(): THREE.Group {
  const deck = new THREE.Group();
  deck.name = 'tapeDeck';

  // Chassis
  const chassis = boxWithEdges(0.6, 0.18, 0.36, 0x1b1e22, 0x000000);
  chassis.position.y = 0.09;
  chassis.name = 'chassis';
  deck.add(chassis);

  // Front panel (slightly darker)
  const panel = thinPanel(0.58, 0.15, 0x262a2f);
  panel.position.set(0, 0.09, 0.181);
  panel.name = 'panel';
  deck.add(panel);

  // Cassette viewing window
  const windowFrame = boxWithEdges(0.34, 0.08, 0.012, 0x0a0c0e);
  windowFrame.position.set(-0.05, 0.12, 0.187);
  windowFrame.name = 'window-frame';
  deck.add(windowFrame);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.07),
    new THREE.MeshPhysicalMaterial({
      color: 0x1a1d20, transparent: true, opacity: 0.6,
      transmission: 0.2, roughness: 0.1, metalness: 0, thickness: 0.01,
    }),
  );
  glass.position.set(-0.05, 0.12, 0.194);
  glass.name = 'window-glass';
  deck.add(glass);

  // Two reels (visible behind glass). Named so we can rotate them during play.
  for (let i = 0; i < 2; i++) {
    const reel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.005, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 }),
    );
    reel.rotation.x = Math.PI / 2;
    reel.position.set(-0.12 + i * 0.14, 0.12, 0.183);
    reel.name = i === 0 ? 'reel-L' : 'reel-R';
    deck.add(reel);
  }

  // LED (play indicator)
  const led = ledIndicator(0xe04b4b);
  led.position.set(0.22, 0.15, 0.186);
  led.name = 'play-led';
  deck.add(led);

  // Buttons (just boxy nubs — interaction is via the HUD)
  const btnMat = 0x2a2f35;
  for (let i = 0; i < 5; i++) {
    const btn = boxWithEdges(0.05, 0.02, 0.025, btnMat, 0x000000);
    btn.position.set(-0.22 + i * 0.06, 0.04, 0.19);
    btn.name = `btn-${i}`;
    deck.add(btn);
  }

  // Small display label beside the window
  const labelPlane = thinPanel(0.18, 0.02, 0x050607, 0x3be08a, 0.7);
  labelPlane.position.set(-0.05, 0.168, 0.188);
  labelPlane.name = 'label-display';
  deck.add(labelPlane);

  return deck;
}

// ---------- Oscilloscope ----------

export interface OscilloscopeBuild {
  group: THREE.Group;
  /** Mesh whose material.map is a CanvasTexture driven by the visualizer. */
  screen: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
}

export function buildOscilloscope(): OscilloscopeBuild {
  const group = new THREE.Group();
  group.name = 'oscilloscope';

  const chassis = boxWithEdges(0.5, 0.42, 0.35, 0x1b1e22, 0x000000);
  chassis.position.y = 0.21;
  chassis.name = 'chassis';
  group.add(chassis);

  // Bezel
  const bezel = boxWithEdges(0.42, 0.32, 0.03, 0x0a0c0e, 0x000000);
  bezel.position.set(0, 0.25, 0.181);
  group.add(bezel);

  // Screen — a canvas texture that the Oscilloscope device will render into
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 384;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;

  const screenMat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), screenMat);
  screen.position.set(0, 0.25, 0.197);
  screen.name = 'screen';
  group.add(screen);

  // Knobs along the bottom
  for (let i = 0; i < 3; i++) {
    const k = cylinderKnob(0.022, 0.015, 0x2b3139);
    k.rotation.x = Math.PI / 2;
    k.position.set(-0.14 + i * 0.14, 0.05, 0.182);
    k.name = `scope-knob-${i}`;
    group.add(k);
  }

  return { group, screen, canvas, texture };
}

// ---------- Audio processor (knob rack) ----------

export function buildAudioProcessor(): THREE.Group {
  const proc = new THREE.Group();
  proc.name = 'audioProcessor';

  const chassis = boxWithEdges(0.9, 0.12, 0.32, 0x1a1d20, 0x000000);
  chassis.position.y = 0.06;
  proc.add(chassis);

  // Five knobs for the five filter params
  const labels = ['LP', 'HP', 'BP', 'Q', 'G'];
  for (let i = 0; i < 5; i++) {
    const knob = cylinderKnob(0.032, 0.03, 0x303840);
    knob.position.set(-0.32 + i * 0.16, 0.12, 0);
    knob.name = `proc-knob-${labels[i]}`;
    proc.add(knob);

    const dot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.031, 8),
      new THREE.MeshBasicMaterial({ color: 0x3be08a }),
    );
    dot.position.set(0, 0, 0.025);
    knob.add(dot);
  }

  // Faceplate label strip
  const label = thinPanel(0.85, 0.03, 0x0b0d0f, 0x3be08a, 0.2);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.125, 0.12);
  proc.add(label);

  return proc;
}

// ---------- Lamp ----------

export function buildLamp(): THREE.Group {
  const lamp = new THREE.Group();
  lamp.name = 'lamp';

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.015, 20),
    new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.5, metalness: 0.6 }),
  );
  base.position.y = 0.008;
  lamp.add(base);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.35, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.7, roughness: 0.35 }),
  );
  pole.position.y = 0.18;
  lamp.add(pole);

  // Shade
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.11, 16, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x3a2c1a, side: THREE.DoubleSide, roughness: 0.85,
      emissive: new THREE.Color(0xf2a24a), emissiveIntensity: 0.12,
    }),
  );
  shade.rotation.x = Math.PI;
  shade.position.y = 0.34;
  lamp.add(shade);

  // Bulb (emissive)
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xffd292 }),
  );
  bulb.position.y = 0.32;
  bulb.name = 'lamp-bulb';
  lamp.add(bulb);

  // Point light attached so scene lighting comes from the lamp
  const pt = new THREE.PointLight(0xffb060, 2.2, 3.2, 2.0);
  pt.position.y = 0.32;
  pt.castShadow = true;
  pt.shadow.mapSize.set(512, 512);
  pt.shadow.radius = 4;
  pt.name = 'lamp-light';
  lamp.add(pt);

  return lamp;
}

// ---------- Cassette ----------

export function buildCassette(color: string, label: string): THREE.Group {
  const cass = new THREE.Group();
  cass.name = `cassette-${label}`;

  // Body
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 0.6, metalness: 0.05,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.065), bodyMat);
  body.castShadow = true; body.receiveShadow = true;
  cass.add(body);

  // White label area
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xe4dcc1, roughness: 0.9 });
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03), labelMat);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.y = 0.0095;
  labelMesh.position.z = -0.008;
  cass.add(labelMesh);

  // Label letter rendered via a tiny canvas texture
  const letterCanvas = document.createElement('canvas');
  letterCanvas.width = 128; letterCanvas.height = 64;
  const ctx = letterCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e4dcc1';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#2a2218';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 36);
    ctx.strokeStyle = '#2a2218';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 120, 56);
  }
  const letterTex = new THREE.CanvasTexture(letterCanvas);
  letterTex.colorSpace = THREE.SRGBColorSpace;
  const letterMat = new THREE.MeshBasicMaterial({ map: letterTex });
  const letterPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.024), letterMat);
  letterPlane.rotation.x = -Math.PI / 2;
  letterPlane.position.y = 0.011;
  letterPlane.position.z = -0.008;
  cass.add(letterPlane);

  // Reel windows
  for (let i = 0; i < 2; i++) {
    const r = new THREE.Mesh(
      new THREE.CircleGeometry(0.01, 16),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a }),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.set(-0.02 + i * 0.04, 0.0094, 0.012);
    cass.add(r);
  }

  return cass;
}

// ---------- Document (paper on desk) ----------

export function buildDocument(tone = 0xe4dcc1): THREE.Group {
  const doc = new THREE.Group();
  doc.name = 'document';
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.22),
    new THREE.MeshStandardMaterial({ color: tone, roughness: 1, side: THREE.DoubleSide }),
  );
  paper.rotation.x = -Math.PI / 2;
  paper.position.y = 0.002;
  paper.receiveShadow = true;
  doc.add(paper);
  return doc;
}

// ---------- Code panel (on the drawer face / near drawer) ----------

export function buildCodePanel(): THREE.Group {
  const panel = new THREE.Group();
  panel.name = 'codePanel';
  const body = boxWithEdges(0.14, 0.18, 0.02, 0x1b1e22, 0x000000);
  panel.add(body);
  const display = thinPanel(0.11, 0.035, 0x050607, 0xe04b4b, 0.55);
  display.position.set(0, 0.05, 0.011);
  panel.add(display);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const key = boxWithEdges(0.022, 0.022, 0.008, 0x2a3036, 0x000000);
      key.position.set(-0.028 + c * 0.028, -0.01 - r * 0.028, 0.012);
      panel.add(key);
    }
  }
  return panel;
}
