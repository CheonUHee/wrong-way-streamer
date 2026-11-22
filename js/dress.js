/* 배경 소품 자동 배치(꾸미기). 스테이지의 구역 데이터(env·entries·objects·decor)를 읽어
   한별이 다니지 않는 곳(벽·울타리 가장자리, 경계 밖, 절벽 위)을 테마에 맞는 소품으로 빽빽하게 채운다.
   - 규칙·AI에는 아무 영향이 없다(보이기만 한다). 오브젝트·서는 자리·입구·통로 앞은 비워 둔다.
   - 같은 구역은 언제나 같은 모습(구역 id로 정한 난수).
   - env.dress: 'proto' | 'forest' | 'crossroad' | 'treeLane' | 'bushLane' | 'pumpkinLane' | 'valley' | 'ruins' | 'crypt' | 'graveyard' | false(끄기). 생략하면 env로 짐작한다.
   - env.dressDensity: 배치 밀도 배율(기본 1).
   결과: decor와 같은 형식 [pack, name, [x, y, z], rotY, scale] 의 배열. (node 검증 도구에서도 쓸 수 있게 three.js를 쓰지 않는다) */

export function themeOf(env) {
  if (env.dress === false) return null;
  if (typeof env.dress === 'string') return env.dress;
  if (env.grid) return 'proto';
  if (env.kind === 'outdoor') return env.border === 'cliff' ? 'valley' : env.border === 'bush' ? 'forest' : 'graveyard';
  if (env.floor?.pack === 'dungeon') return 'crypt';
  return null;
}

function rng(seed) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const SIDE_ROT = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };

export function dressArea(areaId, area, objects) {
  const env = area.env, theme = themeOf(env);
  if (!theme || !GEN[theme]) return [];
  const r = rng(hash(areaId + theme) + 1), out = [];
  const { w, d } = env, dens = env.dressDensity ?? 1;
  const pick = a => a[Math.floor(r() * a.length)];
  const between = (a, b) => a + r() * (b - a);

  // 비워 둘 자리: [x, z, 반지름]
  const keep = [];
  for (const o of objects) { keep.push([o.pos[0], o.pos[2], (o.r || 0.9) + 0.3]); if (o.stand) keep.push([o.stand[0], o.stand[1], 0.9]); }
  for (const e of Object.values(area.entries || {})) keep.push([e.pos[0], e.pos[1], 1.4]);
  for (const [, , p] of area.decor || []) keep.push([p[0], p[2], 0.6]);
  // 변의 한 점: u = 변을 따라간 좌표, off = 벽(경계)에서 안쪽으로 들어온 거리(음수면 바깥)
  const pt = (side, u, off) => side === 'north' ? [u, -d / 2 + off] : side === 'south' ? [u, d / 2 - off] : side === 'west' ? [-w / 2 + off, u] : [w / 2 - off, u];
  const sideLen = side => side === 'north' || side === 'south' ? w : d;
  // 개구부(문·통로·틈새) 앞뒤는 비운다
  const inOpening = (x, z, pad = 0.6, inD = 2.4, outD = 7) => Object.entries(env.openings || {}).some(([side, list]) => list.some(o => {
    const u = side === 'north' || side === 'south' ? x : z;
    const off = side === 'north' ? z + d / 2 : side === 'south' ? d / 2 - z : side === 'west' ? x + w / 2 : w / 2 - x;
    return Math.abs(u - o.x) < o.w / 2 + pad && off > -outD && off < inD;
  }));
  const placed = [];   // [x, z, r]: 소품끼리 너무 겹치지 않게
  const free = (x, z, rad, opt = {}) =>
    keep.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + rad * (opt.soft ? 0.3 : 1))
    && (opt.ignoreOpenings || !inOpening(x, z, rad + 0.3, opt.inD, opt.outD))
    && (opt.overlap || placed.every(([px, pz, pr]) => Math.hypot(x - px, z - pz) > (pr + rad) * 0.75));
  // 소품 하나: spec = [pack, name, 반지름(m, 배율 1일 때), 배율 최소, 배율 최대, 높이 y(m)]
  const put = (spec, x, z, rot, opt = {}) => {
    const [pack, name, rad = 0.4, s0 = 0.8, s1 = s0, y = 0] = spec, sc = between(s0, s1), rr = rad * sc;
    if (!free(x, z, rr, opt)) return false;
    out.push([pack, name, [x, y, z], rot ?? r() * 6.28, sc]);
    if (!opt.overlap) placed.push([x, z, rr]);
    return true;
  };
  // 변을 따라 일정 간격으로 놓기
  const along = (sides, step, offRange, specFn, opt = {}) => {
    for (const side of sides) {
      const ext = opt.ext ?? 0, L = sideLen(side) / 2 + ext;
      for (let u = -L + between(0, step); u < L; u += step * between(0.75, 1.25) / dens) {
        const off = between(...offRange), [x, z] = pt(side, u, off);
        put(specFn(side, off), x, z, opt.face ? SIDE_ROT[side] + between(-0.15, 0.15) : undefined, opt);
      }
    }
  };
  // 구역 안 아무 데나 흩뿌리기
  const scatter = (n, specFn, opt = {}) => {
    const m = opt.margin ?? 0.6, xr = opt.xr || [-w / 2 + m, w / 2 - m], zr = opt.zr || [-d / 2 + m, d / 2 - m];
    for (let i = 0, tries = 0; i < n * dens && tries < n * 12; tries++) {
      const x = between(...xr), z = between(...zr);
      if (opt.where && !opt.where(x, z)) continue;
      if (put(specFn(x, z), x, z, undefined, opt)) i++;
    }
  };
  GEN[theme]({ env, w, d, r, pick, between, put, along, scatter, out });
  return out;
}

const ALL = ['north', 'south', 'west', 'east'];
const F = 'forest', D = 'dungeon', H = 'halloween', P = 'proto';
const TREES = ['Tree_1_A_Color1', 'Tree_1_B_Color1', 'Tree_1_C_Color1', 'Tree_2_A_Color1', 'Tree_2_B_Color1', 'Tree_2_C_Color1', 'Tree_2_D_Color1', 'Tree_2_E_Color1', 'Tree_3_A_Color1', 'Tree_3_B_Color1', 'Tree_3_C_Color1', 'Tree_4_A_Color1', 'Tree_4_B_Color1', 'Tree_4_C_Color1'];
const BARE = ['Tree_Bare_1_A_Color1', 'Tree_Bare_1_B_Color1', 'Tree_Bare_1_C_Color1', 'Tree_Bare_2_A_Color1', 'Tree_Bare_2_B_Color1', 'Tree_Bare_2_C_Color1'];
const BUSH_BIG = ['Bush_1_A_Color1', 'Bush_1_B_Color1', 'Bush_1_C_Color1', 'Bush_1_D_Color1', 'Bush_1_E_Color1', 'Bush_3_A_Color1', 'Bush_3_B_Color1', 'Bush_3_C_Color1'];
const BUSH_SMALL = ['Bush_2_A_Color1', 'Bush_2_B_Color1', 'Bush_2_C_Color1', 'Bush_2_D_Color1', 'Bush_4_A_Color1', 'Bush_4_B_Color1', 'Bush_4_C_Color1', 'Bush_4_D_Color1'];
const GRASS = ['Grass_1_A_Color1', 'Grass_1_B_Color1', 'Grass_1_C_Color1', 'Grass_1_D_Color1', 'Grass_2_A_Color1', 'Grass_2_B_Color1', 'Grass_2_C_Color1', 'Grass_2_D_Color1'];
const GRASS_LOW = GRASS.slice(0, 4);   // Grass_1: 낮은 풀(배율 1에서 0.5m)
const PEBBLE = ['Rock_1_A_Color1', 'Rock_1_B_Color1', 'Rock_1_C_Color1', 'Rock_1_D_Color1', 'Rock_2_A_Color1', 'Rock_2_B_Color1', 'Rock_2_C_Color1', 'Rock_2_D_Color1'];

const GEN = {
  // 숲속 공터: 덤불 울타리 밖은 나무 숲 여러 겹, 울타리 안쪽 가장자리는 작은 덤불·돌, 바닥은 풀
  forest({ along, scatter, pick }) {
    along(ALL, 2.4, [-2.2, -3.4], () => [F, pick(TREES), 1.2, 0.85, 1.2], { ext: 4, outD: 5 });
    along(ALL, 2.6, [-4.6, -6.4], () => [F, pick(TREES), 1.2, 1.0, 1.45], { ext: 7, outD: 7 });
    along(ALL, 3.0, [-7.5, -10], () => [F, pick(TREES), 1.2, 1.1, 1.6], { ext: 10, overlap: true, outD: 20 });   // 통로 너머 풍경(다음 스테이지)이 보이게 비운다
    along(ALL, 1.6, [-1.2, -2.6], () => [F, pick([...BUSH_BIG, ...PEBBLE]), 0.6, 1.2, 1.9], { ext: 3, outD: 5 });
    along(ALL, 1.0, [0.5, 1.5], () => [F, pick([...BUSH_SMALL, ...BUSH_SMALL, ...PEBBLE, ...GRASS_LOW]), 0.4, 1.0, 1.6]);
    scatter(45, () => [F, pick(GRASS_LOW), 0.25, 0.9, 1.5], { soft: true });
  },
  // 숲속 갈림길(스테이지 2 가운데 공터): 숲과 같지만 안쪽 가장자리에 덤불을 두지 않는다(덤불 길과 헷갈리지 않게)
  crossroad({ along, scatter, pick }) {
    along(ALL, 2.4, [-2.2, -3.4], () => [F, pick(TREES), 1.2, 0.85, 1.2], { ext: 4, outD: 5 });
    along(ALL, 2.6, [-4.6, -6.4], () => [F, pick(TREES), 1.2, 1.0, 1.45], { ext: 7, outD: 7 });
    along(ALL, 3.0, [-7.5, -10], () => [F, pick(TREES), 1.2, 1.1, 1.6], { ext: 10, overlap: true, outD: 20 });
    along(ALL, 1.2, [0.4, 1.4], () => [F, pick(GRASS_LOW), 0.3, 1.0, 1.5]);      // 돌은 두지 않는다(출구의 큰 바위만 눈에 띄게)
    scatter(40, () => [F, pick(GRASS_LOW), 0.25, 0.9, 1.5], { soft: true });
  },
  // 나무 길: 길 양옆에 큰 나무가 줄지어 선 가로수 길. 바깥도 나무만
  treeLane({ along, scatter, pick }) {
    along(['west', 'east', 'north'], 2.0, [0.5, 0.9], () => [F, pick(TREES.slice(0, 8)), 0.9, 1.15, 1.35]);
    along(ALL, 2.2, [-0.6, -1.8], () => [F, pick(TREES), 1.0, 1.1, 1.5], { ext: 3, outD: 4 });
    along(ALL, 2.6, [-3, -6], () => [F, pick(TREES), 1.2, 1.2, 1.6], { ext: 8, overlap: true, outD: 6 });
    scatter(25, () => [F, pick(GRASS_LOW), 0.25, 0.9, 1.4], { soft: true });
  },
  // 덤불 길: 길 양옆이 덤불 벽. 나무는 하나도 두지 않는다
  bushLane({ along, scatter, pick }) {
    along(['west', 'east', 'north'], 0.9, [0.3, 1.3], () => [F, pick(BUSH_BIG), 0.6, 1.6, 2.3]);
    along(ALL, 1.4, [-0.4, -2.4], () => [F, pick(BUSH_BIG), 0.8, 2.2, 3.0], { ext: 3, outD: 4 });
    along(ALL, 2.0, [-3, -7], () => [F, pick(BUSH_BIG), 1.0, 2.8, 3.8], { ext: 8, overlap: true, outD: 6 });
    scatter(18, () => [F, pick(BUSH_SMALL), 0.35, 0.9, 1.3], { where: (x) => Math.abs(x) > 1.1 });
  },
  // 호박밭: 울타리 안쪽 밭에 호박이 가득. 바깥은 키 큰 풀(나무·덤불 없이 탁 트인 밭)
  pumpkinLane({ along, scatter, pick }) {
    const PUMPKIN = ['pumpkin_orange', 'pumpkin_orange', 'pumpkin_yellow', 'pumpkin_orange_small', 'pumpkin_yellow_small'];
    scatter(34, () => [H, pick(PUMPKIN), 0.35, 0.8, 1.25], { where: (x) => Math.abs(x) > 1.1, margin: 0.4 });
    along(ALL, 1.0, [-0.5, -2.5], () => [F, pick(GRASS.slice(4)), 0.4, 1.4, 2.0], { ext: 3, outD: 4, overlap: true });
    along(ALL, 1.6, [-3, -8], () => [F, pick(GRASS.slice(4)), 0.5, 1.8, 2.6], { ext: 8, overlap: true, outD: 6 });
    scatter(20, () => [F, pick(GRASS_LOW), 0.25, 0.9, 1.3], { soft: true });
  },
  // 바위 골짜기: 절벽 위에 나무, 길 가장자리(어깨)에 풀·덤불·돌. 길 한가운데(바위가 굴러오는 길)는 거의 비운다
  valley(c) { valleyCommon(c, TREES, GRASS); },
  // 폐허 오르막: 골짜기와 같지만 마른 나무와 무너진 돌 조각을 섞는다
  ruins(c) {
    valleyCommon(c, [...BARE, ...TREES.slice(0, 4)], [...GRASS.slice(0, 4), ...PEBBLE]);
    const { along, pick } = c;
    along(['west', 'east'], 3.2, [0.5, 0.9], () => pick([[D, 'rubble_half', 1.6, 0.12, 0.18], [D, 'column', 0.35, 0.45, 0.6], [D, 'barrier_column', 0.4, 0.4, 0.5], [D, 'rubble_large', 1.8, 0.1, 0.14]]), { ext: 0 });
  },
  // 프로토타입 연습장: 벽을 따라 상자·통·팔레트 더미, 벽에 과녁
  proto({ along, pick, scatter }) {
    along(ALL, 1.05, [0.35, 0.6], () => pick([[P, 'Box_A', 0.25, 0.8, 1.1], [P, 'Box_B', 0.3, 0.8, 1.1], [P, 'Box_C', 0.4, 0.8, 1.0],
      [P, 'Barrel_A', 0.5, 0.7, 0.8, 0.38], [P, 'Barrel_B', 0.5, 0.7, 0.8, 0.38], [P, 'Can_A', 0.15, 1, 1.2], [P, 'Can_B', 0.15, 1, 1.2],
      [P, 'Cube_Prototype_Small', 1, 0.3, 0.4], [P, 'Pallet_Small', 1, 0.45, 0.55]]));
    along(ALL, 2.6, [0.02, 0.02], () => [P, 'target_wall_small', 0.2, 0.6, 0.8, 2.6], { face: true, overlap: true });
    scatter(4, () => pick([[P, 'Can_A', 0.15, 1, 1.2], [P, 'Box_A', 0.25, 0.7, 0.9]]), { margin: 1.0 });
  },
  // 지하 묘지·던전: 벽을 따라 통·상자·선반·관, 벽에 횃불·깃발, 바닥에 뼈·녹은 초·잔해
  crypt({ along, pick, scatter, d, w }) {
    const big = Math.min(w, d) >= 8;
    along(ALL, 1.15, [0.45, 0.75], () => pick([
      [D, 'barrel_small', 0.5, 0.5, 0.6], [D, 'barrel_small_stack', 0.95, 0.5, 0.55], [D, 'box_small', 0.55, 0.5, 0.6], [D, 'box_large', 0.8, 0.45, 0.5],
      [D, 'crates_stacked', 1.15, 0.45, 0.5], [D, 'keg', 1, 0.4, 0.45], [D, 'trunk_medium_A', 0.5, 0.7, 0.8], [D, 'trunk_small_A', 0.4, 0.7, 0.8],
      [H, 'candle_triple', 0.3, 0.8, 1.0], [H, 'skull', 0.45, 0.45, 0.6], [H, 'pumpkin_orange_small', 0.3, 0.8, 1.1], [H, 'ribcage', 0.45, 0.7, 0.9, 0.3],
      ...(big ? [[H, 'coffin', 1.5, 0.55, 0.6], [D, 'barrel_large', 0.9, 0.45, 0.5]] : []),
    ]));
    along(ALL, 2.8, [0.02, 0.02], (side, off) => pick([[D, 'torch_mounted', 0.3, 0.8, 0.8, 2.2], [D, 'shelf_small_candles', 0.5, 0.8, 0.9, 1.5], [D, 'sword_shield', 1.1, 0.5, 0.6, 1.9]]), { face: true, overlap: true });
    along(ALL, 3.4, [0.02, 0.02], () => [D, pick(['banner_thin_red', 'banner_patternA_red', 'banner_thin_brown', 'banner_shield_red']), 0.6, 0.55, 0.6], { face: true, overlap: true });
    scatter(Math.round(w * d / 16), () => pick([[H, 'bone_A', 0.3, 0.55, 0.75, 0.06], [H, 'bone_B', 0.3, 0.55, 0.75, 0.06], [H, 'bone_C', 0.3, 0.55, 0.75, 0.06],
      [H, 'candle_melted', 0.15, 0.5, 0.7], [H, 'skull', 0.45, 0.3, 0.4]]), { margin: 0.8, soft: true });
  },
  // 묘지(울타리 야외): 울타리 밖 마른 나무·묘비, 안쪽 가장자리 호박·묘비·초
  graveyard({ along, pick, scatter }) {
    along(ALL, 2.4, [-2.2, -3.6], () => [H, pick(['tree_dead_large', 'tree_dead_medium', 'tree_pine_orange_large', 'tree_dead_small']), 1, 0.8, 1.1], { ext: 4, outD: 5 });
    along(ALL, 2.8, [-5, -7.5], () => [H, pick(['tree_dead_large', 'tree_pine_orange_medium', 'tree_pine_yellow_large']), 1, 0.9, 1.2], { ext: 8, overlap: true });
    along(ALL, 1.4, [-0.8, -1.6], () => pick([[H, 'gravestone', 0.7, 0.6, 0.8], [H, 'grave_A', 1, 0.6, 0.7], [H, 'gravemarker_A', 0.4, 0.8, 1], [H, 'pumpkin_orange_small', 0.3, 1, 1.3]]), { ext: 2, outD: 4 });
    along(ALL, 1.3, [0.5, 1.2], () => pick([[H, 'pumpkin_orange_small', 0.3, 1, 1.3], [H, 'pumpkin_yellow_small', 0.3, 1, 1.3], [H, 'candle_melted', 0.15, 1.2, 1.5], [H, 'bone_A', 0.3, 0.6, 0.8, 0.06], [H, 'lantern_standing', 0.3, 0.9, 1.1]]));
    scatter(10, () => pick([[H, 'bone_B', 0.3, 0.6, 0.8, 0.06], [F, 'Grass_1_A_Color1', 0.2, 1.2, 1.8]]), { soft: true });
  },
};

function valleyCommon({ along, scatter, pick, w }, trees, ground) {
  // 절벽 위 숲(절벽 바위 너머, 길 양끝 너머까지)
  along(['west', 'east'], 2.4, [-4.2, -5.6], () => [F, pick(trees), 1.2, 1.0, 1.4], { ext: 6, overlap: true, ignoreOpenings: true });
  along(['west', 'east'], 2.8, [-6.8, -9.5], () => [F, pick(trees), 1.2, 1.1, 1.6], { ext: 8, overlap: true, ignoreOpenings: true });
  along(['west', 'east'], 3.2, [-11, -14], () => [F, pick(trees), 1.2, 1.2, 1.7], { ext: 10, overlap: true, ignoreOpenings: true });
  // 길 어깨: 벽에서 0.2~1.4m 안쪽(바위가 굴러오는 한가운데 길은 피한다)
  along(['west', 'east'], 0.9, [0.2, 1.3], () => [F, pick([...ground, ...ground, ...BUSH_SMALL, ...PEBBLE]), 0.3, 1.0, 1.5], { inD: 4.2, outD: 1 });
  // 길 위에도 풀 몇 포기(낮아서 시야를 가리지 않는다)
  scatter(14, () => [F, pick(GRASS.slice(0, 4)), 0.2, 1.0, 1.4], { soft: true, xr: [-w / 2 + 0.6, w / 2 - 0.6], inD: 4.2, outD: 1 });
}
