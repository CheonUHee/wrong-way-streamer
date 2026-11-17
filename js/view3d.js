/* 3D 게임 화면(Three.js). 스트리머 한별의 1인칭 시점.
   스테이지 데이터(js/stages/*.js)를 읽어 구역 하나씩 화면에 만든다. 규칙 판정은 core.js가 하고,
   여기서는 보이는 것만 담당한다.

   stage.js가 쓰는 함수
     loadArea(stage, state, areaId, entryId)   구역을 새로 만들고 입구에 선다
     render(stage, state)                      상태(플래그)에 맞춰 오브젝트 모습을 바꾼다
     moveTo(objSpec) / act(kind, objSpec)      걸어가기 / 손 동작        (Promise)
     transition(fn)                            화면을 어둡게 했다가 fn 실행 후 밝힌다 (Promise)
     enemy(enemySpec, objSpec) / fall()        적 등장·공격 / 쓰러지기   (Promise) */
import * as THREE from 'three';
import { $ } from './ui.js';
import { S, model, place, ownMaterials, clips } from './assets.js';
import { objectsIn, cond } from './core.js';

const EYE = 1.45;          // 눈높이(m)
const WALK_SPEED = 2.2;    // 걷는 속도(m/s)
const ROOM_COLOR = { wall: 0xf1dfcb, wainscot: 0xd9a98b, trim: 0xa8735a, ceil: 0xfaf3ea, frame: 0x8a5a44 };
const T = 0.2;             // 벽 두께

/* ── 기본 세팅 ── */
const host = $('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.01, 80);
scene.add(camera);
const envGroup = new THREE.Group(), objGroup = new THREE.Group(), enemyGroup = new THREE.Group();
scene.add(envGroup, objGroup, enemyGroup);

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);

const hemi = new THREE.HemisphereLight(0xfff4e8, 0x8a7060, 2.2);
const sun = new THREE.DirectionalLight(0xfff0dc, 1.6); sun.position.set(3, 6, 4);
const lamp = new THREE.PointLight(0xffd9a0, 5, 0, 1.4); lamp.position.set(0, 2.7, 0);
scene.add(hemi, sun, lamp);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wait = ms => new Promise(ok => setTimeout(ok, ms));
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

/* ── 환경: 방 / 야외 ──
   변(side): north(-z) south(+z) west(-x) east(+x). openings로 문·통로 자리를 비운다. */
const SIDES = {
  north: (w, d) => ({ along: 'x', len: w, fixed: -d / 2, rotY: 0 }),
  south: (w, d) => ({ along: 'x', len: w, fixed: d / 2, rotY: Math.PI }),
  west:  (w, d) => ({ along: 'z', len: d, fixed: -w / 2, rotY: Math.PI / 2 }),
  east:  (w, d) => ({ along: 'z', len: d, fixed: w / 2, rotY: -Math.PI / 2 }),
};
const at = (side, u, y, fixed) => side.along === 'x' ? v3(u, y, fixed) : v3(fixed, y, u);
// 한 변을 openings를 뺀 구간들로 나눈다 → [[시작, 끝]]
function segments(len, openings = []) {
  const holes = openings.map(o => [o.x - o.w / 2, o.x + o.w / 2]).sort((a, b) => a[0] - b[0]);
  const out = []; let cur = -len / 2;
  for (const [a, b] of holes) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); }
  if (cur < len / 2) out.push([cur, len / 2]);
  return out;
}

function buildRoom(env) {
  const { w, d, h } = env, C = { ...ROOM_COLOR, ...(env.colors || {}) };
  if (env.floor) {
    const n = Math.max(1, Math.round(w / 3.3)), m = Math.max(1, Math.round(d / 3.3)), tw = w / n, td = d / m;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++)
      place(envGroup, env.floor.pack, env.floor.name, { pos: [-w / 2 + tw * (i + 0.5), 0, -d / 2 + td * (j + 0.5)], scale: Math.max(tw, td) / 4 });
  }
  const under = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(env.floorColor || 0x7a5a44));
  under.rotation.x = -Math.PI / 2; under.position.y = env.floor ? -0.05 : 0; envGroup.add(under);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(C.ceil));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h; envGroup.add(ceil);

  for (const [name, mk] of Object.entries(SIDES)) {
    const side = mk(w, d), opens = env.openings?.[name] || [];
    const piece = (u0, u1, y0, y1) => {
      const len = u1 - u0, hh = y1 - y0; if (len <= 0.01 || hh <= 0.01) return;
      const g = new THREE.Group(); g.position.copy(at(side, (u0 + u1) / 2, (y0 + y1) / 2, side.fixed + Math.sign(side.fixed) * T / 2));
      if (side.along === 'z') g.rotation.y = Math.PI / 2;
      g.add(box(len, hh, T, mat(C.wall)));
      const lowH = Math.min(1, y1) - y0;                // 아래 1m는 징두리 + 몰딩
      if (lowH > 0) {
        const low = box(len + 0.02, lowH, T + 0.02, mat(C.wainscot)); low.position.y = -hh / 2 + lowH / 2; g.add(low);
        const rail = box(len + 0.04, 0.06, T + 0.04, mat(C.trim)); rail.position.y = -hh / 2 + lowH; g.add(rail);
      }
      envGroup.add(g);
    };
    for (const [a, b] of segments(side.len, opens)) piece(a, b, 0, h);
    for (const o of opens) {
      piece(o.x - o.w / 2, o.x + o.w / 2, o.h || 2.3, h);          // 개구부 위 벽
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 3, (o.h || 2.3) * 2), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
      glow.position.copy(at(side, o.x, (o.h || 2.3) / 2, side.fixed + Math.sign(side.fixed) * 1.6));
      glow.rotation.y = side.along === 'z' ? Math.PI / 2 : 0; envGroup.add(glow);
    }
  }
}

function buildOutdoor(env) {
  const { w, d } = env, r = rng(w * 131 + d * 7 + (env.ground || 0) % 997);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, d + 40), mat(env.ground || 0x4f6b45));
  ground.rotation.x = -Math.PI / 2; envGroup.add(ground);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, d) * 0.45, 32), mat(new THREE.Color(env.ground || 0x4f6b45).offsetHSL(0, -0.05, 0.04)));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.005; envGroup.add(inner);
  // 경계 울타리(통로 자리는 비운다)
  const seg = 4 * S;
  for (const [name, mk] of Object.entries(SIDES)) {
    const side = mk(w, d);
    for (const [a, b] of segments(side.len, env.openings?.[name])) {
      const n = Math.max(1, Math.round((b - a) / seg)), sc = (b - a) / n / 4;
      for (let i = 0; i < n; i++) {
        const u = a + (b - a) * (i + 0.5) / n;
        place(envGroup, 'halloween', env.border === 'fence' && r() < 0.15 ? 'fence_broken' : 'fence',
          { pos: at(side, u, 0, side.fixed).toArray(), rotY: side.rotY, scale: sc });
      }
    }
    // 울타리 밖 나무(배경)
    for (let u = -side.len / 2 - 2; u <= side.len / 2 + 2; u += 2.6 + r() * 1.5) {
      const off = 1.6 + r() * 2.5;
      const tree = env.dim ? ['halloween', r() < 0.5 ? 'tree_dead_large' : 'tree_dead_medium'] : ['forest', r() < 0.5 ? 'Tree_1_A_Color1' : 'Tree_2_A_Color1'];
      place(envGroup, tree[0], tree[1], { pos: at(side, u, 0, side.fixed + Math.sign(side.fixed) * off).toArray(), rotY: r() * 6.28, scale: S * (0.8 + r() * 0.5) });
    }
  }
}

function setLighting(env) {
  if (env.kind === 'outdoor') {
    scene.background = new THREE.Color(env.sky || 0x1d1b33);
    scene.fog = new THREE.Fog(env.sky || 0x1d1b33, 10, 30);
    hemi.color.set(0xc4ccff); hemi.groundColor.set(0x2e3a26); hemi.intensity = env.dim ? 0.9 : 1.5;
    sun.color.set(0xcfd8ff); sun.intensity = env.dim ? 0.5 : 1.0; sun.position.set(-4, 8, 3);
    lamp.intensity = 0;
  } else {
    scene.background = new THREE.Color(0x2a2433); scene.fog = null;
    hemi.color.set(0xfff4e8); hemi.groundColor.set(0x8a7060); hemi.intensity = env.dim ? 1.2 : 2.2;
    sun.color.set(0xfff0dc); sun.intensity = 1.6; sun.position.set(3, 6, 4);
    lamp.intensity = env.dim ? 2 : 5; lamp.position.set(0, env.h - 0.8, 0);
  }
}

/* ── 오브젝트 ──
   spec.kind: door(문틀+경첩) · gate(양쪽 문짝) · lever(코드로 만든 레버) · chest(뚜껑) · sign(표지판+그림) · 생략(모델 하나)
   spec.fx: { glow: {color, intensity, offWhen}, sparkle: {offWhen}, anim: 'dance'|'bob'|'spin' } */
const OBJ = {};
function labelPlane(text, color = '#2a1a12', w = 0.8, h = 0.48) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 154;
  const g = c.getContext('2d');
  g.fillStyle = '#d9b98a'; g.fillRect(0, 0, 256, 154);
  g.fillStyle = color; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 82);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
}
function buildObject(o) {
  const root = new THREE.Group(), e = { spec: o, root, open: 0, down: 0, mats: [] };
  const m = o.model || {};
  const loadModel = (parent, extra = {}) => m.name ? place(parent, m.pack, m.name, { scale: m.scale ?? S, rotY: m.rotY || 0, pos: m.offset || [0, 0, 0], ...extra }) : Promise.resolve(null);
  const afterLoad = mod => {
    if (!mod) return;
    if (m.tint || o.fx?.glow) ownMaterials(mod);
    mod.traverse(x => {
      if (!x.isMesh) return;
      if (m.tint) x.material.color.set(m.tint);
      if (o.fx?.glow) { x.material.emissive = new THREE.Color(o.fx.glow.color).multiplyScalar(0.45); e.mats.push(x.material); }
    });
  };

  if (o.kind === 'door') {
    const W = 1.6 * (m.scale ?? S), H = 2.8 * (m.scale ?? S), fm = mat(ROOM_COLOR.frame);
    for (const [w, h, x, y] of [[0.12, H, -W / 2 - 0.06, H / 2], [0.12, H, W / 2 + 0.06, H / 2], [W + 0.24, 0.12, 0, H + 0.06]]) {
      const f = box(w, h, 0.34, fm); f.position.set(x, y, 0); root.add(f);
    }
    e.hinge = new THREE.Group(); e.hinge.position.set(-W / 2, 0, 0); root.add(e.hinge);
    loadModel(e.hinge).then(afterLoad);                     // door_modular: 원점이 경첩 쪽 모서리
  } else if (o.kind === 'lever') {
    root.add(box(0.06, 0.5, 0.34, mat(ROOM_COLOR.frame)));
    e.pivot = new THREE.Group(); e.pivot.position.x = 0.05; root.add(e.pivot);
    e.armMat = mat(0x9a6a48, { metalness: 0.3, roughness: 0.95 });
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10), e.armMat); arm.position.y = 0.22; e.pivot.add(arm);
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), mat(0xff6f6f)); grip.position.y = 0.46; e.pivot.add(grip);
  } else if (o.kind === 'sign') {
    const wood = mat(0x8a5a3c);
    const post = box(0.1, 1.5, 0.1, wood); post.position.y = 0.75; root.add(post);
    const board = box(0.9, 0.56, 0.06, wood); board.position.y = 1.38; root.add(board);
    if (o.label) { const p = labelPlane(o.label.text, o.label.color); p.position.set(0, 1.38, 0.035); root.add(p); }
  } else {
    loadModel(root).then(mod => {
      afterLoad(mod);
      if (!mod) return;
      if (o.kind === 'chest') mod.traverse(x => { if (/_lid$/.test(x.name)) e.lid = x; });
      if (o.kind === 'gate') { e.leaves = []; mod.traverse(x => { if (/_(left|right)$/.test(x.name)) e.leaves.push(x); }); }
    });
  }
  if (o.fx?.glow) { e.glow = new THREE.PointLight(o.fx.glow.color, o.fx.glow.intensity ?? 3, 4, 2); e.glow.position.y = 0.8; root.add(e.glow); }
  if (o.fx?.sparkle) {
    e.sparkles = new THREE.Group(); root.add(e.sparkles);
    const spMat = new THREE.MeshBasicMaterial({ color: 0xfff6b0 });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), spMat); s.userData.phase = i; e.sparkles.add(s); }
  }
  e.body = root;
  root.position.set(...o.pos); root.rotation.y = o.rotY || 0;
  objGroup.add(root);
  return e;
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

/* ── 상태 ── */
let walk = null, anim = null, glance = null, idleSince = 0, nextGlance = 4;
let focus = new THREE.Vector3(), objectsNow = [];
let foe = null, falling = null, shake = 0;
/* 자율 행동(API 호출 없음): AI 턴 사이의 빈 시간에 구역 안을 돌아다니고(배회),
   지나가다 반짝이거나 움직이는 물건이 가까우면 고개를 돌린다(시선 뺏기). */
let spots = [], autonomy = true, wanderAt = 0, lastNoticeCheck = 0;
const noticedAt = {};
const hooks = { notice: () => {}, wander: () => {} };
export const onNotice = fn => { hooks.notice = fn; };   // 시선을 뺏긴 오브젝트 id를 알려 준다
export const onWander = fn => { hooks.wander = fn; };   // 오브젝트 앞을 떠나 돌아다니기 시작했다
export const setAutonomy = on => { autonomy = on; };
const WANDER_DELAY = [7, 12];                          // 가만히 있은 지 이만큼(초) 지나면 돌아다닌다
const NOTICE_RANGE = 3.2, NOTICE_COOLDOWN = 25;         // 이 거리 안의 눈길 끄는 물건에 고개를 돌린다. 같은 물건은 한동안 다시 안 본다
const nextWander = t => t + WANDER_DELAY[0] + Math.random() * (WANDER_DELAY[1] - WANDER_DELAY[0]);
const catchy = o => !!(o.fx && (o.fx.glow || o.fx.sparkle || o.fx.anim));
const mixers = [];
const lookQ = new THREE.Quaternion(), tmp = new THREE.PerspectiveCamera();   // 카메라 기준 lookAt(-z가 정면)
function finishWalk() { if (walk) { const d = walk.done; walk = null; d(); } }
function finishAct() { if (anim) { const d = anim.done; anim = null; d(); } }

export function loadArea(stage, s, areaId, entryId) {
  finishWalk(); finishAct(); glance = null; foe = null; falling = null; shake = 0;
  for (const g of [envGroup, objGroup, enemyGroup]) g.clear();
  mixers.length = 0;
  for (const k in OBJ) delete OBJ[k];
  const area = stage.areas[areaId];
  setLighting(area.env);
  (area.env.kind === 'outdoor' ? buildOutdoor : buildRoom)(area.env);
  for (const [p, n, pos, rotY = 0, scale = S] of area.decor || []) place(envGroup, p, n, { pos, rotY, scale });
  for (const o of stage.objects.filter(o => o.area === areaId)) OBJ[o.id] = buildObject(o);
  const ent = area.entries[entryId] || Object.values(area.entries)[0];
  camera.position.set(ent.pos[0], EYE, ent.pos[1]);
  focus.set(...ent.look);
  tmp.position.copy(camera.position); tmp.lookAt(focus); camera.quaternion.copy(tmp.quaternion);
  arms.r.visible = arms.l.visible = true;
  render(stage, s); resize();
  spots = wanderSpots(area, stage.objects.filter(o => o.area === areaId));
  wanderAt = nextWander(clock.elapsedTime); autonomy = true;
}

// 배회 지점: 배경 소품 앞(소품을 구경)과 구역의 네 귀퉁이 쪽(벽·울타리를 구경). 물건과 겹치는 곳은 뺀다.
function wanderSpots(area, objs) {
  const hw = area.env.w / 2 - 1, hd = area.env.d / 2 - 1, out = [];
  const clampXZ = (x, z) => [THREE.MathUtils.clamp(x, -hw, hw), THREE.MathUtils.clamp(z, -hd, hd)];
  for (const [, , pos] of area.decor || []) {
    const [x, , z] = pos, len = Math.hypot(x, z) || 1;
    out.push({ pos: clampXZ(x - x / len * 1.4, z - z / len * 1.4), look: [x, Math.min(pos[1] + 0.7, 1.6), z] });
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    out.push({ pos: [sx * hw * 0.55, sz * hd * 0.55], look: [sx * (hw + 1), 1.3, sz * (hd + 1) * 0.4] });
  return out.filter(p => objs.every(o => o.solid === false || Math.hypot(o.pos[0] - p.pos[0], o.pos[2] - p.pos[1]) > 1.1));
}
// 배회 한 걸음: 지금 자리에서 너무 가깝지 않은 지점 하나로 걸어가 둘러본다
export function explore() {
  if (!spots.length) return Promise.resolve();
  const here = camera.position;
  const far = spots.filter(p => Math.hypot(p.pos[0] - here.x, p.pos[1] - here.z) > 2);
  const p = (far.length ? far : spots)[Math.floor(Math.random() * (far.length || spots.length))];
  finishWalk(); glance = null;
  focus.set(...p.look);
  hooks.wander();
  return new Promise(done => { walk = { path: planPath(here.clone(), v3(p.pos[0], EYE, p.pos[1]), null), wait: 0.2, done }; });
}

export function render(stage, s) {
  const vis = objectsIn(stage, s);
  objectsNow = vis.map(o => o);
  const ids = new Set(vis.map(o => o.id));
  for (const e of Object.values(OBJ)) {
    const o = e.spec, on = c => !!c && cond(s, c);
    e.root.visible = ids.has(o.id);
    e.target = on(o.openWhen) || on(o.downWhen) ? 1 : 0;
    if (e.armMat) { const shiny = on(o.shinyWhen); e.armMat.color.set(shiny ? 0xd5dbe6 : 0x9a6a48); e.armMat.metalness = shiny ? 0.9 : 0.3; }
    e.fxOff = { glow: on(o.fx?.glow?.offWhen), sparkle: on(o.fx?.sparkle?.offWhen) };
  }
}

// 대상 쪽으로 고개를 홱 돌린 뒤(호기심 연출), 대상 앞까지 걸어간다.
function planPath(from, to, targetId) {
  const path = [to];
  for (const o of objectsNow) {
    if (o.id === targetId || o.solid === false || o.pos[1] > 0.5) continue;
    const c = v3(o.pos[0], EYE, o.pos[2]), r = o.r || 0.9;
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
export function moveTo(o) {
  finishWalk(); glance = null;
  focus.set(...o.look);
  return new Promise(done => {
    walk = { path: planPath(camera.position.clone(), v3(o.stand[0], EYE, o.stand[1]), o.id), wait: 0.35, done, target: o.id };
  });
}
// 손 동작: interact/use = 앞으로 뻗기, pickup = 아래로 뻗어 집기
export function act(kind, o) {
  if (kind === 'move') return Promise.resolve();
  finishAct();
  return new Promise(done => { anim = { t: 0, dur: kind === 'pickup' ? 0.7 : 0.55, kind, obj: o.id, done }; });
}

export async function transition(fn) {
  const f = $('fade');
  f.classList.add('on'); await wait(380);
  await fn(); await wait(120);
  f.classList.remove('on'); await wait(380);
}

// 적 등장 → 달려와서 → 한 대 친다. 맞는 순간에 끝난다.
export async function enemy(spec, objSpec) {
  const [m, C] = await Promise.all([model(spec.model.pack, spec.model.name, spec.model.scale ?? S), clips()]);
  const root = new THREE.Group(); root.add(m); enemyGroup.add(root);
  const [sx, sz] = spec.spawn || [objSpec.pos[0] + 1.2, objSpec.pos[2]];
  root.position.set(sx, 0, sz);
  root.lookAt(camera.position.x, 0, camera.position.z);
  const mixer = new THREE.AnimationMixer(m); mixers.push(mixer);
  const play = (name, once) => {
    mixer.stopAllAction();
    const a = mixer.clipAction(C[name]); a.reset();
    if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    a.play(); return a;
  };
  foe = { root };
  play('Spawn_Ground', true); await wait(1150);
  play('Running_A');
  await new Promise(done => { foe.run = { speed: 3.2, stop: 1.1, done }; });
  play('Throw', true); await wait(520);
  shake = 0.5; $('hit').classList.add('on'); setTimeout(() => $('hit').classList.remove('on'), 450);
  await wait(250);
}
export function fall() {
  arms.r.visible = arms.l.visible = false;
  return new Promise(done => { falling = { t: 0, done }; });
}

/* ── 매 프레임 ── */
const clock = new THREE.Clock();
let bob = 0;
const rollQ = new THREE.Quaternion(), Z = v3(0, 0, 1);
let lastStep = 0;
function frame() { step(0.05); requestAnimationFrame(frame); }
// 화면이 가려져 requestAnimationFrame이 멈춰도 걷기·연출이 끝나도록 타이머로 대신 진행한다
setInterval(() => { if (performance.now() - lastStep > 250) step(0.3); }, 200);
function step(maxDt) {
  lastStep = performance.now();
  const dt = Math.min(clock.getDelta(), maxDt), t = clock.elapsedTime;
  mixers.forEach(m => m.update(dt));

  // 걷기
  let walking = false;
  if (walk) {
    if (walk.wait > 0) walk.wait -= dt;
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
  let eyeY = EYE + (walking ? Math.abs(Math.sin(bob)) * 0.04 : 0);

  // 적: 카메라 쪽으로 달려온다
  if (foe?.run) {
    const p = foe.root.position, d = v3(camera.position.x - p.x, 0, camera.position.z - p.z), dist = d.length();
    if (dist <= foe.run.stop) { const done = foe.run.done; foe.run = null; done(); }
    else p.addScaledVector(d.normalize(), Math.min(foe.run.speed * dt, dist - foe.run.stop));
    foe.root.lookAt(camera.position.x, 0, camera.position.z);
  }

  // 한눈팔기: 가만히 있으면 가끔 다른 물건 쪽을 힐끔 본다
  if (walking || anim || foe || falling) idleSince = t;
  if (!glance && !walk && !anim && !foe && !falling && t - idleSince > nextGlance && objectsNow.length > 1) {
    const o = objectsNow[Math.floor(Math.random() * objectsNow.length)];
    glance = { at: v3(...o.look), until: t + 1.3 };
    nextGlance = 4 + Math.random() * 4; idleSince = t;
  }
  if (glance && t > glance.until) glance = null;

  // 자율 배회: AI가 시킨 일 없이 한동안 서 있으면 구역 안을 돌아다닌다
  const free = autonomy && !walk && !anim && !foe && !falling;
  if (!free) wanderAt = Math.max(wanderAt, nextWander(t));   // 시킨 일을 마친 뒤에도 한동안은 그 자리에 머문다
  else if (t > wanderAt) { explore(); wanderAt = nextWander(t); }
  // 시선 뺏기: 가까이 있는 눈길 끄는 물건(빛·반짝임·움직임)에 고개를 홱 돌린다. 걷는 중에도 일어난다
  if (autonomy && !foe && !falling && !anim && t - lastNoticeCheck > 0.4) {
    lastNoticeCheck = t;
    const near = objectsNow.find(o => catchy(o) && o.id !== walk?.target && (t - (noticedAt[o.id] ?? -99)) > NOTICE_COOLDOWN
      && Math.hypot(o.pos[0] - camera.position.x, o.pos[2] - camera.position.z) < NOTICE_RANGE);
    if (near) { noticedAt[near.id] = t; glance = { at: v3(...near.look), until: t + 1.6 }; hooks.notice(near.id); }
  }

  // 시선
  const target = foe ? v3(foe.root.position.x, 1.2, foe.root.position.z) : glance ? glance.at : focus;
  tmp.position.copy(camera.position); tmp.lookAt(target);
  lookQ.copy(tmp.quaternion);
  if (falling) {
    falling.t += dt;
    const p = Math.min(falling.t / 0.9, 1), e = p * p;
    eyeY = THREE.MathUtils.lerp(EYE, 0.35, e);
    lookQ.multiply(rollQ.setFromAxisAngle(Z, 1.2 * e));
    if (p >= 1 && falling.done) { const d = falling.done; falling.done = null; d(); }
  }
  const k = falling ? 12 : foe ? 10 : walk && walk.wait > 0 ? 14 : glance ? 6 : 4;
  camera.quaternion.slerp(lookQ, 1 - Math.exp(-k * dt));
  camera.position.y = eyeY;
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake * 0.25; camera.position.y += (Math.random() - 0.5) * shake * 0.25;
  }

  // 손
  let reach = 0, down = 0;
  if (anim) {
    anim.t += dt;
    const p = Math.min(anim.t / anim.dur, 1), s = Math.sin(p * Math.PI);
    if (anim.kind === 'pickup') { reach = s * 0.18; down = s * 0.14; } else reach = s * 0.22;
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
  for (const e of Object.values(OBJ)) {
    const o = e.spec;
    e.open = ease(e.open, e.target || 0, o.kind === 'lever' ? 8 : 2.5);
    if (e.hinge) e.hinge.rotation.y = 1.45 * e.open;                      // 문은 바깥쪽으로 열린다
    if (e.pivot) e.pivot.rotation.z = -0.35 - 2.3 * e.open;
    if (e.lid) e.lid.rotation.x = -1.7 * e.open;
    if (e.leaves) e.leaves.forEach(l => { l.rotation.y = (/_left$/.test(l.name) ? 1 : -1) * 1.4 * e.open; });
    const glowOn = e.fxOff ? !e.fxOff.glow && !(o.kind === 'chest' && e.open > 0.5) : true;
    if (e.glow) e.glow.intensity = glowOn ? (o.fx.glow.intensity ?? 3) * (0.8 + Math.sin(t * 4) * 0.35) : 0;
    for (const m of e.mats) m.emissiveIntensity = glowOn ? 0.6 + Math.sin(t * 4) * 0.35 : 0;
    if (e.sparkles) {
      e.sparkles.visible = !e.fxOff?.sparkle && !(o.kind === 'chest' && e.open > 0.5);
      e.sparkles.children.forEach(sp => {
        const a = t * 1.4 + sp.userData.phase * 1.05;
        sp.position.set(Math.cos(a) * 0.45, 0.5 + Math.sin(a * 1.7) * 0.15, Math.sin(a) * 0.35); sp.rotation.y = t * 3;
      });
    }
    const body = e.root.children.find(c => c.isObject3D && c.type !== 'PointLight' && c !== e.sparkles) || e.root;
    if (o.fx?.anim === 'dance') { body.rotation.z = Math.sin(t * 6) * 0.22; body.rotation.y = Math.sin(t * 1.5) * 0.6; body.position.y = Math.abs(Math.sin(t * 6)) * 0.08; }
    if (o.fx?.anim === 'bob') { body.position.y = Math.abs(Math.sin(t * 3.5)) * 0.15; body.scale.y = (o.model?.scale ?? S) * (1 + Math.sin(t * 7) * 0.04); }
    if (o.fx?.anim === 'spin') body.rotation.y = t * 1.5;
  }

  renderer.render(scene, camera);
}
resize();
requestAnimationFrame(frame);
