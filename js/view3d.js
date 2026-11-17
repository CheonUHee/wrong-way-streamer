/* 3D 게임 화면(Three.js). 스트리머 한별의 1인칭 시점.
   stage.js가 쓰는 함수: reset(stage), render(G, objects), moveTo(obj) → Promise, act(type, obj) → Promise
   오브젝트는 지금은 단순한 도형이고, build* 함수만 무료 에셋(glTF) 로더로 바꾸면 된다. */
import * as THREE from 'three';
import { $ } from './ui.js';

const EYE = 1.45;          // 눈높이(m)
const WALK_SPEED = 2.2;    // 걷는 속도(m/s)
const ROOM = { w: 10, d: 10, h: 3.5 };

/* ── 기본 세팅 ── */
const host = $('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d2a);
scene.fog = new THREE.Fog(0x1a1d2a, 9, 18);
const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.01, 50);
scene.add(camera);

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);

scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a3328, 1.6));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.4);
sun.position.set(3, 6, 4); scene.add(sun);
const ceilingLamp = new THREE.PointLight(0xffd9a0, 12, 0, 1.6);
ceilingLamp.position.set(0, 3.2, 0); scene.add(ceilingLamp);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

/* ── 방(바닥 · 벽 · 천장) ── */
function checker() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5b5a63'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#4e4d56'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0xffffff, { map: checker() }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0x2b2e3a));
ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; scene.add(ceil);

const wallMat = mat(0x6d7489);
const T = 0.2, DOOR_W = 1.2, DOOR_H = 2.3;
const walls = [
  [ROOM.w, ROOM.h, T, 0, ROOM.h / 2, ROOM.d / 2],          // 뒤
  [T, ROOM.h, ROOM.d, -ROOM.w / 2, ROOM.h / 2, 0],         // 왼쪽
  [T, ROOM.h, ROOM.d, ROOM.w / 2, ROOM.h / 2, 0],          // 오른쪽
  // 정면 벽: 문 구멍을 남기고 세 조각
  [(ROOM.w - DOOR_W) / 2, ROOM.h, T, -(ROOM.w + DOOR_W) / 4, ROOM.h / 2, -ROOM.d / 2],
  [(ROOM.w - DOOR_W) / 2, ROOM.h, T, (ROOM.w + DOOR_W) / 4, ROOM.h / 2, -ROOM.d / 2],
  [DOOR_W, ROOM.h - DOOR_H, T, 0, (ROOM.h + DOOR_H) / 2, -ROOM.d / 2],
];
for (const [w, h, d, x, y, z] of walls) { const m = box(w, h, d, wallMat); m.position.set(x, y, z); scene.add(m); }
// 벽 아래 걸레받이 + 천장 파이프(창고 분위기용 장식. AI에게는 알리지 않는다)
const trim = mat(0x3c4152);
for (const [w, d, x, z] of [[ROOM.w, 0.05, 0, ROOM.d / 2 - 0.12], [0.05, ROOM.d, -ROOM.w / 2 + 0.12, 0], [0.05, ROOM.d, ROOM.w / 2 - 0.12, 0]]) {
  const m = box(w, 0.15, d, trim); m.position.set(x, 0.075, z); scene.add(m);
}
const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, ROOM.d, 12), mat(0x7a7f8c, { metalness: 0.6, roughness: 0.4 }));
pipe.rotation.x = Math.PI / 2; pipe.position.set(3.2, ROOM.h - 0.3, 0); scene.add(pipe);
// 문 밖에서 새어 드는 빛(문이 열리면 보인다)
const outside = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W * 4, DOOR_H * 2), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
outside.position.set(0, DOOR_H / 2, -ROOM.d / 2 - 1.6); scene.add(outside);

/* ── 오브젝트 ── */
const OBJ = {};          // id → { root, ...애니메이션용 부품 }
const BUILD = {
  door(o) {
    const root = new THREE.Group();
    const frameMat = mat(0x3d2a19);
    for (const [w, h, x, y] of [[0.12, DOOR_H, -DOOR_W / 2 - 0.06, DOOR_H / 2], [0.12, DOOR_H, DOOR_W / 2 + 0.06, DOOR_H / 2], [DOOR_W + 0.24, 0.12, 0, DOOR_H + 0.06]]) {
      const f = box(w, h, 0.3, frameMat); f.position.set(x, y, 0); root.add(f);
    }
    const hinge = new THREE.Group(); hinge.position.set(-DOOR_W / 2, 0, 0.05); root.add(hinge);
    const panel = box(DOOR_W, DOOR_H, 0.08, mat(0x7a5232)); panel.position.set(DOOR_W / 2, DOOR_H / 2, 0); hinge.add(panel);
    for (const y of [0.6, 1.7]) { const p = box(DOOR_W * 0.75, 0.6, 0.02, mat(0x6b4728)); p.position.set(DOOR_W / 2, y, 0.05); hinge.add(p); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05), mat(0xd8b25a, { metalness: 0.8, roughness: 0.3 }));
    knob.position.set(DOOR_W - 0.12, 1.05, 0.08); hinge.add(knob);
    root.position.set(o.pos[0], 0, o.pos[2] + T / 2 + 0.01);
    return { root, hinge, open: 0 };
  },
  lever(o) {
    const root = new THREE.Group();
    root.add(box(0.06, 0.45, 0.3, mat(0x55596a, { metalness: 0.5 })));
    const pivot = new THREE.Group(); pivot.position.x = 0.05; root.add(pivot);
    const armMat = mat(0x8a5a3c, { metalness: 0.4, roughness: 0.9 });          // 녹슨 색 → 기름칠하면 은색
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10), armMat); arm.position.y = 0.21; pivot.add(arm);
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.06), mat(0xd8433a)); grip.position.y = 0.44; pivot.add(grip);
    root.position.set(o.pos[0] + T / 2, o.pos[1], o.pos[2]);
    return { root, pivot, armMat, down: 0 };
  },
  oil(o) {
    const root = new THREE.Group();
    const wood = mat(0x8b6a45);
    for (const y of [0.45, 0.95]) { const s = box(1.1, 0.05, 1.1, wood); s.position.y = y; root.add(s); }
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { const l = box(0.05, 0.98, 0.05, wood); l.position.set(x, 0.49, z); root.add(l); }
    const can = new THREE.Group(); can.position.y = 0.975; root.add(can);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 16), mat(0xd8433a, { roughness: 0.5 })); body.position.y = 0.13; can.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), mat(0x333333)); cap.position.set(0.05, 0.29, 0); can.add(cap);
    root.position.set(o.pos[0], 0, o.pos[2]);
    return { root, can };
  },
  box(o) {
    const root = new THREE.Group();
    const gold = mat(0xe0b02a, { metalness: 0.7, roughness: 0.35, emissive: 0x6b4a00, emissiveIntensity: 1 });
    const base = box(0.7, 0.35, 0.5, gold); base.position.y = 0.175; root.add(base);
    const lidHinge = new THREE.Group(); lidHinge.position.set(0, 0.35, -0.25); root.add(lidHinge);
    const lid = box(0.72, 0.12, 0.52, gold); lid.position.set(0, 0.06, 0.25); lidHinge.add(lid);
    const glow = new THREE.PointLight(0xffd65a, 3, 4, 2); glow.position.y = 0.7; root.add(glow);
    const sparkles = new THREE.Group(); root.add(sparkles);
    const spMat = new THREE.MeshBasicMaterial({ color: 0xfff6b0 });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), spMat); s.userData.phase = i; sparkles.add(s); }
    root.position.set(o.pos[0], 0, o.pos[2]);
    return { root, lidHinge, gold, glow, sparkles, open: 0 };
  },
  cat(o) {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const pink = mat(0xf2a7c8);
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), pink); torso.scale.set(1, 1.15, 0.9); torso.position.y = 0.23; body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), pink); head.position.y = 0.55; body.add(head);
    for (const x of [-0.09, 0.09]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), pink); ear.position.set(x, 0.72, 0); body.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022), mat(0x222222)); eye.position.set(x * 0.7, 0.58, 0.15); body.add(eye);
    }
    root.position.set(o.pos[0], 0, o.pos[2]); root.rotation.y = -0.6;      // 방 가운데 쪽을 본다
    return { root, body };
  },
};
function buildObjects(stage) {
  for (const k in OBJ) scene.remove(OBJ[k].root);
  for (const o of stage.objects) { OBJ[o.id] = (BUILD[o.id] || BUILD.box)(o); scene.add(OBJ[o.id].root); }
}

/* ── 1인칭 손(한별: 흰 니트 가디건 + 초록 소맷단) ── */
function makeArm(side) {
  const g = new THREE.Group();
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 14), mat(0xece6d8, { roughness: 1 }));
  sleeve.rotation.x = Math.PI / 2; sleeve.position.z = 0.12; g.add(sleeve);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 14), mat(0x5e7f4e, { roughness: 1 }));
  cuff.rotation.x = Math.PI / 2; cuff.position.z = -0.1; g.add(cuff);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), mat(0xffe1cf, { roughness: 0.7 }));
  hand.scale.set(1, 0.65, 1.5); hand.position.z = -0.17; g.add(hand);
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat(0xffe1cf));
  thumb.position.set(-0.04 * side, 0.005, -0.15); g.add(thumb);
  g.userData.rest = new THREE.Vector3(0.24 * side, -0.27, -0.42);
  g.rotation.y = -0.15 * side;
  camera.add(g);
  return g;
}
const arms = { r: makeArm(1), l: makeArm(-1) };

/* ── 이동 · 시선 · 손 동작 ── */
let walk = null;            // { path: [Vector3...], done: resolve }
let anim = null;            // { t, dur, kind, done }
let focus = new THREE.Vector3();         // 지금 보고 있어야 할 지점
let glance = null;          // 한눈팔기 시선 { at, until }
let idleSince = 0, nextGlance = 4;
let objectsNow = [];
const lookQ = new THREE.Quaternion(), tmp = new THREE.PerspectiveCamera();   // 카메라 기준 lookAt(-z가 정면)

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function finishWalk() { if (walk) { const d = walk.done; walk = null; d(); } }
function finishAct() { if (anim) { const d = anim.done; anim = null; d(); } }

// 바닥에 놓인 오브젝트를 피해 가는 간단한 경유점 계산
function planPath(from, to, targetId) {
  const path = [to];
  for (const o of objectsNow) {
    if (o.id === targetId || o.pos[1] > 0.5) continue;               // 벽에 붙은 것은 무시
    const c = v3(o.pos[0], EYE, o.pos[2]), r = 0.9;
    const seg = to.clone().sub(from), len = seg.length(); if (len < 0.01) continue;
    const dir = seg.clone().divideScalar(len);
    const t = THREE.MathUtils.clamp(c.clone().sub(from).dot(dir), 0, len);
    const closest = from.clone().addScaledVector(dir, t);
    if (closest.distanceTo(c) < r) {
      const side = closest.clone().sub(c); side.y = 0;
      if (side.lengthSq() < 1e-4) side.set(-dir.z, 0, dir.x);
      path.unshift(c.clone().addScaledVector(side.normalize(), r + 0.25));
      break;
    }
  }
  return path;
}

export function reset(stage) {
  finishWalk(); finishAct(); glance = null;
  buildObjects(stage);
  camera.position.set(stage.start.pos[0], EYE, stage.start.pos[1]);
  focus.set(...stage.start.look);
  tmp.position.copy(camera.position); tmp.lookAt(focus); camera.quaternion.copy(tmp.quaternion);
  resize();
}

export function render(G, objects) {
  objectsNow = objects;
  if (OBJ.door) OBJ.door.target = G.doorOpen ? 1 : 0;
  if (OBJ.lever) { OBJ.lever.target = G.doorOpen ? 1 : 0; OBJ.lever.armMat.color.set(G.oiled ? 0xc7ccd6 : 0x8a5a3c); OBJ.lever.armMat.metalness = G.oiled ? 0.9 : 0.4; }
  if (OBJ.box) OBJ.box.target = G.boxOpened ? 1 : 0;
  if (OBJ.oil) OBJ.oil.can.visible = !G.oilTaken;
  $('clear').classList.toggle('show', G.cleared);
}

// 대상 쪽으로 고개를 홱 돌린 뒤(호기심 연출), 대상 앞까지 걸어간다.
export function moveTo(o) {
  finishWalk(); glance = null;
  focus.set(...o.look);
  return new Promise(done => {
    const to = v3(o.stand[0], EYE, o.stand[1]);
    walk = { path: planPath(camera.position.clone(), to, o.id), wait: 0.35, done };
  });
}

// 손 동작: interact/use = 앞으로 뻗기, pickup = 아래로 뻗어 집기, move = 없음
export function act(type, o) {
  if (type === 'move') return Promise.resolve();
  finishAct();
  return new Promise(done => { anim = { t: 0, dur: type === 'pickup' ? 0.7 : 0.55, kind: type, obj: o.id, done }; });
}

/* ── 매 프레임 ── */
const clock = new THREE.Clock();
let bob = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  // 걷기
  let walking = false;
  if (walk) {
    if (walk.wait > 0) walk.wait -= dt;                   // 고개 먼저 돌리는 시간
    else {
      const next = walk.path[0], step = WALK_SPEED * dt;
      const d = next.clone().sub(camera.position); d.y = 0;
      if (d.length() <= step) { camera.position.x = next.x; camera.position.z = next.z; walk.path.shift(); }
      else camera.position.addScaledVector(d.normalize(), step);
      walking = true;
      if (!walk.path.length) finishWalk();
    }
  }
  bob += dt * (walking ? 9 : 0);
  camera.position.y = EYE + (walking ? Math.abs(Math.sin(bob)) * 0.04 : 0);

  // 한눈팔기: 가만히 있으면 가끔 다른 물건 쪽을 힐끔 본다
  if (walking || anim) idleSince = t;
  if (!glance && !walk && !anim && t - idleSince > nextGlance && objectsNow.length > 1) {
    const o = objectsNow[Math.floor(Math.random() * objectsNow.length)];
    glance = { at: v3(...o.look), until: t + 1.3 };
    nextGlance = 4 + Math.random() * 4; idleSince = t;
  }
  if (glance && t > glance.until) glance = null;

  // 시선: 걷기 시작 전에는 빠르게(홱), 평소에는 부드럽게
  tmp.position.copy(camera.position); tmp.lookAt(glance ? glance.at : focus);
  lookQ.copy(tmp.quaternion);
  const k = walk && walk.wait > 0 ? 14 : glance ? 6 : 4;
  camera.quaternion.slerp(lookQ, 1 - Math.exp(-k * dt));

  // 손
  let reach = 0, down = 0;
  if (anim) {
    anim.t += dt;
    const p = Math.min(anim.t / anim.dur, 1);
    const s = Math.sin(p * Math.PI);
    if (anim.kind === 'pickup') { reach = s * 0.18; down = s * 0.14; if (p > 0.5 && anim.obj === 'oil' && OBJ.oil) OBJ.oil.can.visible = false; }
    else reach = s * 0.22;
    if (p >= 1) finishAct();
  }
  for (const [key, arm] of Object.entries(arms)) {
    const side = key === 'r' ? 1 : -1, rest = arm.userData.rest;
    const sway = walking ? Math.sin(bob + (side > 0 ? 0 : Math.PI)) * 0.025 : Math.sin(t * 1.6 + side) * 0.006;
    const r = key === 'r' ? reach : 0, dn = key === 'r' ? down : 0;
    arm.position.set(rest.x - r * 0.4, rest.y + sway + r * 0.25 - dn, rest.z - r + Math.abs(sway) * 0.5);
  }

  // 오브젝트 애니메이션
  const ease = (cur, tgt, sp) => cur + (tgt - cur) * (1 - Math.exp(-sp * dt));
  if (OBJ.door) { const d = OBJ.door; d.open = ease(d.open, d.target || 0, 2.5); d.hinge.rotation.y = 1.45 * d.open; outside.visible = d.open > 0.02; }   // 바깥쪽으로 열린다(방 안으로 열면 문짝이 시야를 가림)
  if (OBJ.lever) { const l = OBJ.lever; l.down = ease(l.down, l.target || 0, 8); l.pivot.rotation.z = -0.35 - 2.3 * l.down; }
  if (OBJ.box) {
    const b = OBJ.box; b.open = ease(b.open, b.target || 0, 4);
    b.lidHinge.rotation.x = -1.9 * b.open;
    b.glow.intensity = (1 - b.open) * (2.5 + Math.sin(t * 4) * 1.2);
    b.gold.emissiveIntensity = (1 - b.open) * (0.8 + Math.sin(t * 4) * 0.4);
    b.sparkles.visible = b.open < 0.5;
    b.sparkles.children.forEach(s => {
      const a = t * 1.4 + s.userData.phase * 1.05;
      s.position.set(Math.cos(a) * 0.45, 0.5 + Math.sin(a * 1.7) * 0.15, Math.sin(a) * 0.35);
      s.rotation.y = t * 3;
    });
  }
  if (OBJ.cat) { const c = OBJ.cat.body; c.rotation.z = Math.sin(t * 6) * 0.25; c.position.y = Math.abs(Math.sin(t * 6)) * 0.06; }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
