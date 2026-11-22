/* 3D 게임 화면(Three.js). 스트리머 한별의 1인칭 시점.
   스테이지 데이터(js/stages/*.js)를 읽어 구역 하나씩 화면에 만든다. 규칙 판정은 core.js가 하고,
   여기서는 보이는 것만 담당한다.

   stage.js가 쓰는 함수
     loadArea(stage, state, areaId, entryId)   구역을 새로 만들고 입구에 선다
     render(stage, state)                      상태(플래그)에 맞춰 오브젝트 모습을 바꾼다
     moveTo(objSpec) / act(kind, objSpec)      걸어가기 / 손 동작        (Promise)
     transition(fn)                            화면을 어둡게 했다가 fn 실행 후 밝힌다 (Promise)
     enemy(enemySpec, objSpec) / fall()        적 등장·공격 / 쓰러지기   (Promise)
     puff(objSpec) / pop(objSpec)              촛불이 잠깐 붙었다 꺼짐 / 깜짝 장난감이 튀어나옴 (Promise) */
import * as THREE from 'three';
import { $ } from './ui.js';
import { S, model, place, ownMaterials, clips } from './assets.js';
import { objectsIn, cond } from './core.js';
import { isPaused } from './pause.js';
import { dressArea } from './dress.js';
import { hasFlag } from './env.js';

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
// 소품 편집기(테스트 모드) 전용: 편집 중인 소품과 놓기 전 미리보기. 구역을 새로 만들어도 지우지 않는다(편집기가 관리)
export const edGroup = new THREE.Group(), ghostGroup = new THREE.Group();
scene.add(envGroup, objGroup, enemyGroup, edGroup, ghostGroup);

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
// 오르막 구역(env.slope: 북쪽(-z)으로 1m 갈 때 올라가는 높이). 땅·소품·오브젝트·눈높이에 모두 더한다
let slope = 0;
const gy = z => -z * slope;
const lift = ([x, y, z]) => [x, y + gy(z), z];
// 격자 무늬 텍스처(프로토타입 테마): 밝은 바탕에 선, 1칸 = 1m
const gridTex = {};
function grid(color, line, rep = [1, 1]) {
  const k = color + line;
  if (!gridTex[k]) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = line; g.lineWidth = 4; g.strokeRect(0, 0, 128, 128);
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    gridTex[k] = t;
  }
  const t = gridTex[k].clone(); t.repeat.set(...rep); t.needsUpdate = true; return t;
}

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
  const under = new THREE.Mesh(new THREE.PlaneGeometry(w, d), env.grid && !env.floor
    ? new THREE.MeshStandardMaterial({ map: grid('#f08a3c', '#c2662a', [w / 2, d / 2]), roughness: 0.9 }) : mat(env.floorColor || 0x7a5a44));
  under.rotation.x = -Math.PI / 2; under.position.y = env.floor ? -0.05 : 0; envGroup.add(under);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(C.ceil));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h; envGroup.add(ceil);

  for (const [name, mk] of Object.entries(SIDES)) {
    const side = mk(w, d), opens = env.openings?.[name] || [];
    const piece = (u0, u1, y0, y1) => {
      const len = u1 - u0, hh = y1 - y0; if (len <= 0.01 || hh <= 0.01) return;
      const g = new THREE.Group(); g.position.copy(at(side, (u0 + u1) / 2, (y0 + y1) / 2, side.fixed + Math.sign(side.fixed) * T / 2));
      if (side.along === 'z') g.rotation.y = Math.PI / 2;
      g.add(box(len, hh, T, env.grid ? new THREE.MeshStandardMaterial({ map: grid('#e4e4e8', '#b9bcc6', [len / 2, hh / 2]), roughness: 0.9 }) : mat(C.wall)));
      const lowH = env.grid ? 0 : Math.min(1, y1) - y0;  // 아래 1m는 징두리 + 몰딩(격자 방은 없음)
      if (lowH > 0) {
        const low = box(len + 0.02, lowH, T + 0.02, mat(C.wainscot)); low.position.y = -hh / 2 + lowH / 2; g.add(low);
        const rail = box(len + 0.04, 0.06, T + 0.04, mat(C.trim)); rail.position.y = -hh / 2 + lowH; g.add(rail);
      }
      envGroup.add(g);
    };
    for (const [a, b] of segments(side.len, opens)) piece(a, b, 0, h);
    for (const o of opens) {
      piece(o.x - o.w / 2, o.x + o.w / 2, o.h || 2.3, h);          // 개구부 위 벽
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 3, (o.h || 2.3) * 2), new THREE.MeshBasicMaterial({ color: o.glow ?? env.glowColor ?? 0xfff6d8, side: THREE.DoubleSide }));   // o.glow: 이 개구부만 다른 색(어두운 벽감 등)
      glow.position.copy(at(side, o.x, (o.h || 2.3) / 2, side.fixed + Math.sign(side.fixed) * 1.6));
      glow.rotation.y = side.along === 'z' ? Math.PI / 2 : 0; envGroup.add(glow);
    }
  }
}

function buildOutdoor(env) {
  const { w, d } = env, r = rng(w * 131 + d * 7 + (env.ground || 0) % 997);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, (d + 40) * Math.hypot(1, slope)), mat(env.ground || 0x4f6b45));
  ground.rotation.x = -Math.PI / 2 + Math.atan(slope); envGroup.add(ground);
  if (env.path) {                                   // 길 한가운데 흙길(외길 표시)
    const p = new THREE.Mesh(new THREE.PlaneGeometry(env.path, d * Math.hypot(1, slope)), mat(env.pathColor || 0x8a7356));
    p.rotation.x = -Math.PI / 2 + Math.atan(slope); p.position.y = 0.01; envGroup.add(p);
  }
  // 흙길 여러 갈래(평지 전용): env.trails = [[x1, z1, x2, z2, 폭], …]. 갈림길 공터처럼 길이 어디로 나는지 보여 준다
  for (const [x1, z1, x2, z2, tw = 1.4] of env.trails || []) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(tw, len), mat(env.pathColor || 0x8a7356));
    p.rotation.set(-Math.PI / 2, Math.atan2(x2 - x1, z2 - z1), 0, 'YXZ');   // 눕힌 뒤 길 방향으로 돌린다
    p.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2); envGroup.add(p);
    const c = new THREE.Mesh(new THREE.CircleGeometry(tw / 2, 16), p.material);   // 끝을 둥글게(갈래가 만나는 곳이 자연스럽게)
    c.rotation.x = -Math.PI / 2; c.position.set(x1, 0.012, z1); envGroup.add(c);
  }
  if (env.border === 'cliff') return buildCliffs(env, r);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, d) * 0.45, 32), mat(new THREE.Color(env.ground || 0x4f6b45).offsetHSL(0, -0.05, 0.04)));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.005; envGroup.add(inner);
  // 경계 울타리(통로 자리는 비운다)
  const seg = 4 * S;
  for (const [name, mk] of Object.entries(SIDES)) {
    const side = mk(w, d);
    if (env.border !== 'none') for (const [a, b] of segments(side.len, env.openings?.[name])) {
      const n = Math.max(1, Math.round((b - a) / seg)), sc = (b - a) / n / 4;
      for (let i = 0; i < n; i++) {
        const u = a + (b - a) * (i + 0.5) / n;
        if (env.border === 'bush') {               // 숲: 덤불 울타리
          place(envGroup, 'forest', ['Bush_1_C_Color1', 'Bush_3_A_Color1', 'Bush_1_A_Color1'][i % 3], { pos: at(side, u, 0, side.fixed).toArray(), rotY: r() * 6.28, scale: 2.6 + r() * 0.8 });
          continue;
        }
        place(envGroup, 'halloween', env.border === 'fence' && r() < 0.15 ? 'fence_broken' : 'fence',
          { pos: at(side, u, 0, side.fixed).toArray(), rotY: side.rotY, scale: sc });
      }
    }
    // 울타리 밖 나무(배경). env.backdrop === false 면 두지 않는다(구역 꾸미기 dress가 대신 채운다)
    if (env.backdrop !== false) for (let u = -side.len / 2 - 2; u <= side.len / 2 + 2; u += 2.6 + r() * 1.5) {
      const off = 1.6 + r() * 2.5;
      if ((env.openings?.[name] || []).some(o => Math.abs(u - o.x) < o.w / 2 + 1.2)) continue;   // 통로 너머는 비워 둔다(다음 길이 보이게)
      const tree = env.dim ? ['halloween', r() < 0.5 ? 'tree_dead_large' : 'tree_dead_medium'] : ['forest', ['Tree_1_A_Color1', 'Tree_2_A_Color1', 'Tree_4_A_Color1', 'Tree_3_A_Color1'][Math.floor(r() * 4)]];
      place(envGroup, tree[0], tree[1], { pos: at(side, u, 0, side.fixed + Math.sign(side.fixed) * off).toArray(), rotY: r() * 6.28, scale: S * (0.8 + r() * 0.5) });
    }
  }
}

// 골짜기 절벽: 동·서 변에 큰 바위를 촘촘히 쌓는다. openings 자리는 비우고 그 뒤에 바위를 둬서 '틈새'(숨을 곳)를 만든다
function buildCliffs(env, r) {
  const { w, d } = env, low = ['Rock_1_J_Color1', 'Rock_1_K_Color1', 'Rock_1_L_Color1', 'Rock_1_M_Color1'], high = ['Rock_1_N_Color1', 'Rock_1_O_Color1', 'Rock_1_P_Color1', 'Rock_1_Q_Color1'];
  const pk = a => a[Math.floor(r() * a.length)];
  for (const name of ['west', 'east']) {
    const side = SIDES[name](w, d), sg = Math.sign(side.fixed);
    for (const [a, b] of segments(side.len + 8, env.openings?.[name])) {      // 길 양끝 너머까지 이어 붙인다
      for (let u = a + 1.1; u < b - 0.6; u += 2.2) {
        place(envGroup, 'forest', pk(low), { pos: lift(at(side, u, -0.2, side.fixed + sg * (0.9 + r() * 0.4)).toArray()), rotY: r() * 6.28, scale: 1 + r() * 0.3 });
        place(envGroup, 'forest', pk(high), { pos: lift(at(side, u + 1.1, 0, side.fixed + sg * (2.6 + r())).toArray()), rotY: r() * 6.28, scale: 1.2 + r() * 0.4 });
      }
    }
    for (const o of env.openings?.[name] || []) {      // 틈새: 벽에 난 구멍 + 안쪽을 막는 바위 + 그늘
      place(envGroup, 'forest', pk(low), { pos: lift(at(side, o.x, -0.2, side.fixed + sg * (o.depth || 3.2)).toArray()), rotY: r() * 6.28, scale: 1.1 });
      const shade = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), mat(0x2b3324)); shade.rotation.x = -Math.PI / 2;
      shade.position.set(...lift(at(side, o.x, 0.03, side.fixed + sg * 0.6).toArray())); envGroup.add(shade);
    }
  }
}

function setLighting(env) {
  if (env.kind === 'outdoor') {
    scene.background = new THREE.Color(env.sky || 0x1d1b33);
    scene.fog = new THREE.Fog(env.sky || 0x1d1b33, 10, 30);
    hemi.color.set(0xc4ccff); hemi.groundColor.set(0x2e3a26); hemi.intensity = env.dim ? 0.9 : 1.5;
    sun.color.set(0xcfd8ff); sun.intensity = env.dim ? 0.5 : 1.0; sun.position.set(-4, 8, 3);
    if (env.day) {                                  // 낮(숲): 따뜻한 햇빛, 안개는 멀리
      hemi.color.set(0xfff6e0); hemi.groundColor.set(0x4a5a34); hemi.intensity = 2.0;
      sun.color.set(0xfff0d0); sun.intensity = 2.2; sun.position.set(-5, 10, 4);
      scene.fog = new THREE.Fog(env.sky, 18, 45);
    }
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
function labelPlane(text, color = '#2a1a12', w = 0.8, h = 0.48, bg = '#d9b98a') {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  // 글자 수에 맞춰 크기를 줄인다(그림 문자 여러 개를 화살표로 잇는 단서도 들어가게)
  let fs = c.height * 0.66;
  g.font = `900 ${fs}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  while (g.measureText(text).width > c.width * 0.92 && fs > 10) { fs *= 0.9; g.font = `900 ${fs}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`; }
  g.fillText(text, c.width / 2, c.height * 0.54);
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
    // 표지판·석판. label.showIf가 있으면 그 조건 전에는 이끼(흙)로 덮여 그림이 안 보인다
    const L = o.label || {}, bw = L.w || 0.9, bh = L.h || 0.56, py = L.y || 1.38;
    const wood = mat(L.board ?? 0x8a5a3c);
    if (!L.wall) { const post = box(0.1, py, 0.1, wood); post.position.set(0, py / 2, -0.09); root.add(post); }   // 기둥은 판 뒤에
    const board = box(bw + 0.08, bh + 0.08, 0.06, wood); board.position.y = py; root.add(board);
    if (o.label) {
      e.label = labelPlane(L.text, L.color, bw, bh, L.bg); e.label.position.set(0, py, 0.035); root.add(e.label);
      if (L.showIf) {
        e.cover = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat(L.coverColor ?? 0x4d6b2f, { roughness: 1 }));
        e.cover.position.set(0, py, 0.04); root.add(e.cover);
      }
    }
  } else if (o.kind === 'button') {
    // 돌 받침 위의 둥근 버튼. downWhen 조건이면 눌려 들어간다
    const base = box(0.5, 0.8, 0.5, mat(o.baseColor ?? 0x9a9a92, { roughness: 1 })); base.position.y = 0.4; root.add(base);
    e.cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 24), mat(o.color ?? 0xd8433a, { roughness: 0.5 }));
    e.cap.position.y = 0.86; root.add(e.cap);
  } else if (o.kind === 'spot') {
    // 보이지 않는 자리(틈새 같은 곳). 모습은 구역의 지형·소품이 만든다
  } else {
    loadModel(root).then(mod => {
      afterLoad(mod);
      if (!mod) return;
      if (o.kind === 'chest') mod.traverse(x => { if (/_lid$/.test(x.name)) e.lid = x; });
      if (o.kind === 'gate') { e.leaves = []; mod.traverse(x => { if (/_(left|right)$/.test(x.name)) e.leaves.push(x); }); }
    });
  }
  if (o.fx?.glow) { e.glow = new THREE.PointLight(o.fx.glow.color, o.fx.glow.intensity ?? 3, 4, 2); e.glow.position.y = 0.8; root.add(e.glow); }
  if (o.fx?.flame) {
    // 촛불: 심지마다 물방울 모양 불꽃(바깥 주황 + 안쪽 노랑). 크기(flameS)를 스프링처럼 키우고 줄인다
    const ms = m.scale ?? S;
    e.flames = (o.fx.flame.at || [[0, 0.9, 0]]).map(([x, y, z]) => {
      const f = new THREE.Group(); f.position.set(x * ms, y * ms, z * ms);
      // 안개·톤매핑을 받지 않아 어두운 방에서도 또렷하게 빛난다
      const outer = new THREE.Mesh(FLAME_GEO, new THREE.MeshBasicMaterial({ color: 0xff9a30, transparent: true, opacity: 0.9, fog: false, toneMapped: false }));
      const inner = new THREE.Mesh(FLAME_GEO, new THREE.MeshBasicMaterial({ color: 0xfff2b8, fog: false, toneMapped: false }));
      inner.scale.set(0.5, 0.6, 0.5); inner.position.y = 0.004; f.add(outer, inner);
      f.scale.setScalar(0); f.visible = false; root.add(f);
      return f;
    });
    e.flameS = 0; e.flameV = 0; e.flameSize = (o.fx.flame.size ?? 1.3) * ms;
  }
  if (o.fx?.sparkle) {
    e.sparkles = new THREE.Group(); root.add(e.sparkles);
    const spMat = new THREE.MeshBasicMaterial({ color: 0xfff6b0 });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), spMat); s.userData.phase = i; e.sparkles.add(s); }
  }
  e.body = root;
  root.position.set(...lift(o.pos)); root.rotation.y = o.rotY || 0;
  objGroup.add(root);
  return e;
}

// 물방울 모양 불꽃(아래가 둥글고 위가 뾰족). 높이 약 0.075m
const FLAME_GEO = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.022 * Math.sin(Math.PI * Math.pow(t, 0.7)) * Math.pow(1 - t, 0.35), t * 0.075)); }
  return new THREE.LatheGeometry(pts, 12);
})();

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
const hooks = { notice: () => {}, wander: () => {}, hazard: () => {}, area: () => {} };
export const onHazard = fn => { hooks.hazard = fn; };   // 주기 위험(굴러오는 바위)에 맞았다
export const interrupt = () => { finishWalk(); finishAct(); };
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
  finishWalk(); finishAct(); glance = null; foe = null; shake = 0;
  if (falling?.done) falling.done();                    // 쓰러지는 연출을 기다리는 쪽이 멈추지 않게 끝내 준다
  falling = null;
  for (const g of [envGroup, objGroup, enemyGroup]) g.clear();
  pops.length = 0;
  mixers.length = 0;
  for (const k in OBJ) delete OBJ[k];
  const area = stage.areas[areaId];
  slope = area.env.slope || 0; curArea = area;
  setHazard(area.hazard);
  setLighting(area.env);
  (area.env.kind === 'outdoor' ? buildOutdoor : buildRoom)(area.env);
  // 스테이지 파일의 decor: 소품 편집기가 숨기고 대신 편집용 복제본을 보여 줄 수 있게 표시해 둔다
  (area.decor || []).forEach(([p, n, pos, rotY = 0, scale = S], i) => place(envGroup, p, n, { pos: lift(pos), rotY, scale })
    .then(m => { if (m) { m.userData.decorIdx = i; m.visible = !decorHidden; } }));
  // 자동 꾸미기(js/dress.js): 한별이 다니지 않는 가장자리·경계 밖을 테마 소품으로 채운다
  for (const [p, n, pos, rotY, scale] of dressArea(areaId, area, stage.objects.filter(o => o.area === areaId))) place(envGroup, p, n, { pos: lift(pos), rotY, scale });
  for (const o of stage.objects.filter(o => o.area === areaId)) OBJ[o.id] = buildObject(o);
  const ent = area.entries[entryId] || Object.values(area.entries)[0];
  camera.position.set(ent.pos[0], EYE, ent.pos[1]);
  focus.set(...lift(ent.look));
  camera.position.y = EYE + gy(camera.position.z);
  tmp.position.copy(camera.position); tmp.lookAt(focus); camera.quaternion.copy(tmp.quaternion);
  syncLook();
  arms.r.visible = arms.l.visible = true;
  render(stage, s); resize();
  spots = wanderSpots(area, stage.objects.filter(o => o.area === areaId));
  wanderAt = nextWander(simT); autonomy = true;
  hooks.area(stage, areaId);
}
// 소품 편집기용
let decorHidden = false;
export function setDecorHidden(on) {
  decorHidden = on;
  envGroup.children.forEach(m => { if (m.userData.decorIdx != null) m.visible = !on; });
}
export const liftPos = p => lift(p);
export const onArea = fn => { hooks.area = fn; };   // 구역을 새로 만들 때마다 알린다
let curArea = null;

/* ── 주기 위험: 굴러오는 바위 ──
   area.hazard = { model, from, to, x, lane, radius, speed, period, warn, delay, reason, warnText }
   warn초 동안 경고(쿠르르릉) → 바위가 from(z)에서 to(z)로 굴러 내려온다 → 남은 시간은 잠잠.
   굴러가는 바위가 카메라 근처를 지날 때 카메라가 길(lane) 안에 있으면 맞는다. 틈새(길 밖)는 안전하다. */
let hz = null;
function setHazard(spec) {
  $('warn').classList.remove('show');
  hz = spec ? { spec, t: -(spec.delay ?? 5), phase: 'calm', hit: false, mesh: null } : null;
  if (!hz) return;
  // 모델을 그룹으로 감싸 그룹을 굴린다. lie: 세워진 모델(통)을 옆으로 눕혀 굴린다(원점이 바닥인 모델은 halfLen만큼 옮겨 가운데를 맞춘다)
  const g = new THREE.Group(); g.visible = false; envGroup.add(g); hz.mesh = g;
  if (spec.model.sphere) { g.add(rockBall(spec.radius || 1, spec.model.color)); return; }
  const sc = spec.model.scale ?? 2.4;
  place(g, spec.model.pack, spec.model.name, { scale: sc }).then(m => {
    if (!m || !spec.model.lie) return;
    m.rotation.z = Math.PI / 2; m.position.x = (spec.model.halfLen ?? 1) * sc;
  });
}
// 코드로 만드는 둥근 바위(구). 꼭짓점을 조금씩 흔들어 울퉁불퉁한 로우폴리 바위처럼 보이게 한다
function rockBall(r, color = 0x8f877b) {
  const geo = new THREE.IcosahedronGeometry(r, 3), p = geo.attributes.position, v = new THREE.Vector3();
  const seen = new Map();                                // 같은 자리 꼭짓점은 같은 만큼 흔든다(틈이 벌어지지 않게)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, 1 + (Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.3 - v.y) * 0.07) + (Math.random() - 0.5) * 0.05);
    v.multiplyScalar(seen.get(k)); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  // 굴러가는 게 보이도록 이끼 낀 띠를 하나 두른다
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.97, r * 0.09, 6, 24), new THREE.MeshStandardMaterial({ color: 0x5f7046, roughness: 1, flatShading: true }));
  band.rotation.y = Math.PI / 2; m.add(band);
  return m;
}
export const hazardStatus = () => hz?.phase || null;
function stepHazard(dt) {
  if (!hz) return;
  const H = hz.spec, roll = Math.abs(H.to - H.from) / (H.speed || 8), warn = H.warn ?? 2.5;
  if (!autonomy || falling || hazardOff) { $('warn').classList.remove('show'); if (hz.mesh) hz.mesh.visible = false; hz.phase = 'calm'; return; }
  hz.t += dt;
  if (hz.t >= H.period) { hz.t -= H.period; hz.hit = false; }
  const phase = hz.t < 0 ? 'calm' : hz.t < warn ? 'warn' : hz.t < warn + roll ? 'roll' : 'calm';
  hz.phase = phase;
  $('warn').textContent = H.warnText || '⚠ 쿠르르릉… 위에서 뭔가 굴러온다!';
  $('warn').classList.toggle('show', phase === 'warn' || phase === 'roll');
  if (phase === 'warn') shake = Math.max(shake, 0.06);
  if (!hz.mesh) return;
  hz.mesh.visible = phase === 'roll';
  if (phase !== 'roll') return;
  const p = (hz.t - warn) / roll, z = H.from + (H.to - H.from) * p, r = H.radius || 1;
  hz.mesh.position.set(H.x || 0, gy(z) + (H.lift ?? 0), z);
  // 구르는 방향: 앞(+z)으로 굴러올 때 윗면이 앞으로 넘어오도록 x축 기준 + 회전(카메라 쪽에서 보면 반시계)
  hz.mesh.rotation.x += ((H.speed || 8) * dt) / r * Math.sign(H.to - H.from);
  const c = camera.position;
  if (!hz.hit && Math.abs(z - c.z) < r + 0.3 && Math.abs(c.x - (H.x || 0)) < (H.lane || 3) / 2) {
    hz.hit = true; shake = 0.6;
    $('hit').classList.add('on'); setTimeout(() => $('hit').classList.remove('on'), 450);
    hooks.hazard(H.reason || '굴러온 바위에 부딪혀 쓰러졌다');
  }
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
  focus.set(...lift(p.look));
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
    e.sunk = on(o.sinkWhen); e.revealed = !o.label?.showIf || on(o.label.showIf);
    if (e.armMat) { const shiny = on(o.shinyWhen); e.armMat.color.set(shiny ? 0xd5dbe6 : 0x9a6a48); e.armMat.metalness = shiny ? 0.9 : 0.3; }
    e.fxOff = { glow: on(o.fx?.glow?.offWhen), sparkle: on(o.fx?.sparkle?.offWhen), flame: on(o.fx?.flame?.offWhen) };
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
  focus.set(...lift(o.look));
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
  root.position.set(sx, gy(sz), sz);
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
// 촛불이 잠깐 붙었다 꺼진다(순서가 틀렸을 때). 붙는 모습을 보여 준 뒤 끝나고, 꺼지는 건 이어지는 render가 한다
export function puff(o) {
  const e = OBJ[o?.id]; if (!e) return Promise.resolve();
  e.puffUntil = simT + 0.9;
  return wait(900);
}
// 가짜 문: 문 한가운데에서 용수철 달린 오리 인형이 뿅 튀어나왔다가 들어간다
const pops = [];
export async function pop(o) {
  const e = OBJ[o?.id]; if (!e) return;
  const g = new THREE.Group();
  g.position.set(...lift(o.pos)); g.position.y += o.popY ?? 1.25; g.rotation.y = o.rotY || 0;
  const arm = new THREE.Group(); g.add(arm);
  // 용수철(나선 관): 길이 1(z 방향)을 arm.scale.z로 늘였다 줄인다
  const helix = new THREE.Curve(); helix.getPoint = (t, out = new THREE.Vector3()) => out.set(Math.cos(t * 28) * 0.07, Math.sin(t * 28) * 0.07, t);
  arm.add(new THREE.Mesh(new THREE.TubeGeometry(helix, 160, 0.012, 6), mat(0xd8d8d8, { metalness: 0.7, roughness: 0.3 })));
  const head = new THREE.Group(); g.add(head);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20), mat(0xe8453c)); plate.rotation.x = Math.PI / 2; head.add(plate);
  place(head, 'bath', 'ducky', { scale: 1.9, pos: [0, -0.18, 0.05] });
  envGroup.add(g);
  const p = { g, arm, head, t: 0, len: o.popLen ?? 1.1 };
  pops.push(p); shake = Math.max(shake, 0.15);
  await wait(1800);
  envGroup.remove(g); const i = pops.indexOf(p); if (i >= 0) pops.splice(i, 1);
}
function stepPops(dt) {
  for (const p of pops) {
    p.t += dt;
    const t = p.t;
    // 0~0.15초: 뿅 튀어나옴(살짝 넘침) → 1.3초까지 흔들흔들 → 0.3초 동안 들어감
    const out = t < 0.15 ? (t / 0.15) * 1.15 : t < 0.3 ? 1.15 - (t - 0.15) / 0.15 * 0.15 : t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) / 0.3);
    const L = Math.max(0.001, out * p.len);
    p.arm.scale.z = L; p.head.position.z = L;
    const wob = t > 0.15 && t < 1.3 ? Math.sin(t * 22) * 0.35 * Math.exp(-(t - 0.15) * 2.2) : 0;
    p.head.rotation.z = wob; p.head.position.x = wob * 0.12;
  }
}
export function fall() {
  arms.r.visible = arms.l.visible = false;
  return new Promise(done => { falling = { t: 0, done }; });
}

/* ── 테스트 모드: 직접 조작 카메라 ──
   WASD 이동, 마우스(화면 클릭 후) 시점, Space/C 위·아래, Shift 빠르게. 벽은 통과한다(맵 확인용).
   화면 한가운데 조준점이 가리키는 곳의 좌표를 알려 준다(소품 배치용). */
let freeCam = false, hazardOff = false, yaw = 0, pitch = 0, fly = 0;
const keys = new Set(), euler = new THREE.Euler(0, 0, 0, 'YXZ');
export function setFreeCam(on) {
  freeCam = on; fly = 0; keys.clear();
  if (!on && document.pointerLockElement) document.exitPointerLock();
  if (on) { glance = null; wanderAt = Infinity; } else wanderAt = nextWander(simT);
}
export const setHazardOff = on => { hazardOff = on; };
// 테스트 모드 '보기': 카메라를 [x, z]로 옮겨 look([x, y, z])을 바라본다
export function viewFrom(pos, look) {
  finishWalk(); fly = 0;
  camera.position.set(pos[0], EYE + gy(pos[1]), pos[1]);
  tmp.position.copy(camera.position); tmp.lookAt(...lift(look)); camera.quaternion.copy(tmp.quaternion); syncLook();
}
function syncLook() { euler.setFromQuaternion(camera.quaternion, 'YXZ'); yaw = euler.y; pitch = euler.x; }
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
addEventListener('keydown', e => { if (freeCam && !typing(e)) { keys.add(e.code); if (/^(Space|KeyW|KeyA|KeyS|KeyD)$/.test(e.code)) e.preventDefault(); } });
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
export const canvas = renderer.domElement;
let clickLock = true;                               // 소품 편집기는 클릭을 '놓기'에 쓰므로 끈다
export const setClickLock = v => { clickLock = v; if (!v && document.pointerLockElement) document.exitPointerLock(); };
renderer.domElement.addEventListener('click', () => { if (freeCam && clickLock && !document.pointerLockElement) renderer.domElement.requestPointerLock?.(); });
// 마우스를 잠그지 않고 시점 돌리기(소품 편집기의 오른쪽 드래그)
export function turnView(dx, dy) { yaw -= dx * 0.0035; pitch = THREE.MathUtils.clamp(pitch - dy * 0.0035, -1.45, 1.45); }
addEventListener('mousemove', e => {
  if (!freeCam || document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0025; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0025, -1.45, 1.45);
});
function stepFree(dt) {
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7 : 3) * dt;
  const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  camera.position.x += (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
  camera.position.z += (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
  fly = THREE.MathUtils.clamp(fly + ((keys.has('Space') ? 1 : 0) - (keys.has('KeyC') ? 1 : 0)) * sp, -1.2, 20);
  if (keys.has('ArrowLeft')) yaw += dt * 1.8; if (keys.has('ArrowRight')) yaw -= dt * 1.8;
  if (keys.has('ArrowUp')) pitch = Math.min(1.45, pitch + dt * 1.2); if (keys.has('ArrowDown')) pitch = Math.max(-1.45, pitch - dt * 1.2);
  euler.set(pitch, yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(euler);
  return EYE + gy(camera.position.z) + fly;
}
// 조준점(화면 한가운데)이 가리키는 곳: 좌표와 맞은 것(오브젝트면 id)
const ray = new THREE.Raycaster(), center = new THREE.Vector2(0, 0);
const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };   // 부모까지 모두 보이는가
export function probe(ndc) {                         // ndc: 화면 좌표(-1~1). 없으면 화면 한가운데(조준점)
  ray.setFromCamera(ndc || center, camera);
  const hit = ray.intersectObjects([objGroup, envGroup, edGroup], true).find(h => h.object.type === 'Mesh' && shown(h.object));
  let edIdx = null;
  for (let o = hit?.object; o; o = o.parent) if (o.userData.edIdx != null) { edIdx = o.userData.edIdx; break; }
  const c = camera.position, r2 = n => Math.round(n * 100) / 100;
  let obj = null;
  if (hit) for (let o = hit.object; o && !obj; o = o.parent) for (const [id, e] of Object.entries(OBJ)) if (e.root === o) obj = id;
  // 오르막 구역은 땅 높이를 빼서 데이터 좌표(평지 기준)로 돌려준다
  const p = hit?.point;
  return {
    cam: [r2(c.x), r2(c.y - gy(c.z)), r2(c.z)], yaw: r2(yaw),
    hit: p ? [r2(p.x), r2(p.y - gy(p.z)), r2(p.z)] : null, obj, edIdx,
    model: (() => { for (let o = hit?.object; o; o = o.parent) if (o.userData.model) return o.userData.model; return ''; })(),
    dist: hit ? r2(hit.distance) : null,
  };
}

/* ── 매 프레임 ── */
const clock = new THREE.Clock();
let simT = 0;                       // 일시정지를 뺀 게임 시간(초)
let bob = 0;
const rollQ = new THREE.Quaternion(), Z = v3(0, 0, 1);
let lastStep = 0;
function frame() { step(0.05); requestAnimationFrame(frame); }
// 화면이 가려져 requestAnimationFrame이 멈춰도 걷기·연출이 끝나도록 타이머로 대신 진행한다
setInterval(() => { if (performance.now() - lastStep > 150) step(0.5); }, 100);   // 실제 시간과 같은 속도로
function step(maxDt) {
  lastStep = performance.now();
  const rawDt = clock.getDelta();
  if (isPaused()) { renderer.render(scene, camera); return; }   // 튜토리얼 창: 시간이 흐르지 않는다
  const dt = Math.min(rawDt, maxDt); simT += dt; const t = simT;
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
  let eyeY = EYE + gy(camera.position.z) + (walking ? Math.abs(Math.sin(bob)) * 0.04 : 0);

  // 적: 카메라 쪽으로 달려온다
  if (foe?.run) {
    const p = foe.root.position, d = v3(camera.position.x - p.x, 0, camera.position.z - p.z), dist = d.length();
    if (dist <= foe.run.stop) { const done = foe.run.done; foe.run = null; done(); }
    else p.addScaledVector(d.normalize(), Math.min(foe.run.speed * dt, dist - foe.run.stop));
    foe.root.lookAt(camera.position.x, 0, camera.position.z);
  }

  // 한눈팔기: 가만히 있으면 가끔 다른 물건 쪽을 힐끔 본다
  if (walking || anim || foe || falling) idleSince = t;
  if (!freeCam && !glance && !walk && !anim && !foe && !falling && t - idleSince > nextGlance && objectsNow.length > 1) {
    const o = objectsNow[Math.floor(Math.random() * objectsNow.length)];
    glance = { at: v3(...lift(o.look)), until: t + 1.3 };
    nextGlance = 4 + Math.random() * 4; idleSince = t;
  }
  if (glance && t > glance.until) glance = null;

  // 자율 배회: AI가 시킨 일 없이 한동안 서 있으면 구역 안을 돌아다닌다
  const free = autonomy && !freeCam && curArea?.wander !== false && !walk && !anim && !foe && !falling;
  if (!free) wanderAt = Math.max(wanderAt, nextWander(t));   // 시킨 일을 마친 뒤에도 한동안은 그 자리에 머문다
  else if (t > wanderAt) { explore(); wanderAt = nextWander(t); }
  // 시선 뺏기: 가까이 있는 눈길 끄는 물건(빛·반짝임·움직임)에 고개를 홱 돌린다. 걷는 중에도 일어난다
  if (autonomy && !freeCam && !foe && !falling && !anim && t - lastNoticeCheck > 0.4) {
    lastNoticeCheck = t;
    const near = objectsNow.find(o => catchy(o) && o.id !== walk?.target && (t - (noticedAt[o.id] ?? -99)) > NOTICE_COOLDOWN
      && Math.hypot(o.pos[0] - camera.position.x, o.pos[2] - camera.position.z) < NOTICE_RANGE);
    if (near) { noticedAt[near.id] = t; glance = { at: v3(...lift(near.look)), until: t + 1.6 }; hooks.notice(near.id); }
  }

  stepHazard(dt);
  stepPops(dt);

  // 시선
  const target = foe ? v3(foe.root.position.x, 1.2, foe.root.position.z) : glance ? glance.at : focus;
  tmp.position.copy(camera.position); tmp.lookAt(target);
  lookQ.copy(tmp.quaternion);
  if (falling) {
    falling.t += dt;
    const p = Math.min(falling.t / 0.9, 1), e = p * p;
    eyeY = THREE.MathUtils.lerp(EYE, 0.35, e) + gy(camera.position.z);
    lookQ.multiply(rollQ.setFromAxisAngle(Z, 1.2 * e));
    if (p >= 1 && falling.done) { const d = falling.done; falling.done = null; d(); }
  }
  const k = falling ? 12 : foe ? 10 : walk && walk.wait > 0 ? 14 : glance ? 6 : 4;
  if (freeCam && !walk && !falling && !foe) eyeY = stepFree(dt);   // 테스트 모드: 키보드·마우스로 직접 움직인다
  else { camera.quaternion.slerp(lookQ, 1 - Math.exp(-k * dt)); syncLook(); }
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
    if (e.cap) e.cap.position.y = 0.86 - 0.08 * e.open;
    if (o.sinkWhen) { e.sink = ease(e.sink || 0, e.sunk ? 1 : 0, 1.2); e.root.position.y = lift(o.pos)[1] - (o.sinkDepth || 3) * e.sink; }
    if (e.cover) e.cover.visible = !e.revealed;
    const puffing = e.puffUntil > t;
    const glowOn = puffing || (e.fxOff ? !e.fxOff.glow && !(o.kind === 'chest' && e.open > 0.5) : true);
    if (e.flames) {
      // 켜짐: 커지다가 살짝 넘친 뒤 멈춤 / 꺼짐: 줄어들며 사라짐(스프링)
      const want = puffing || !e.fxOff?.flame ? 1 : 0;
      for (let rem = dt; rem > 1e-6; rem -= 1 / 120) {          // 프레임 간격이 커도 튀지 않게 잘게 나눠 계산
        const h = Math.min(rem, 1 / 120);
        e.flameV += ((want - e.flameS) * 90 - e.flameV * 11) * h;
        e.flameS += e.flameV * h;
        if (e.flameS < 0) { e.flameS = 0; e.flameV = 0; }
      }
      e.flames.forEach((f, i) => {
        const fl = 1 + Math.sin(t * 13 + i * 2.1) * 0.08 + Math.sin(t * 7.3 + i) * 0.05;   // 일렁임
        f.visible = e.flameS > 0.01;
        f.scale.set(e.flameS * e.flameSize, e.flameS * e.flameSize * fl, e.flameS * e.flameSize);
        f.rotation.z = Math.sin(t * 5 + i) * 0.08;
      });
    }
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
// 개발용: 주소에 ?shot 이 있으면 지금 화면을 JPEG 데이터로 돌려주는 함수를 연다(화면 검증 자동화)
if (hasFlag('shot')) window.__shot = () => { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.85); };
if (hasFlag("shot")) { window.__obj = OBJ; window.__hz = () => hz; window.__pops = pops; window.__view = (pos, look, h = 0) => { viewFrom(pos, look); fly = h; }; }   // 개발용: 오브젝트·위험 상태 확인
