/* 스테이지 3: 바위 굴러오는 골짜기 (테마: Forest Nature → Dungeon, 난이도: 중급)
   설계 로그: docs/stages/stage3.md
   외길 오르막에 주기적으로 골짜기를 꽉 채우는 둥근 바위가 굴러 내려온다. 길(lane) 위에 있다가 바위가 지나가면 쓰러지고, 절벽의 틈새(spot)는 안전하다.
   퍼즐 대신 "타이밍 훈수"가 핵심: 바위가 지나간 직후 "지금 가!" → 다음 틈새, 쿠르르릉 소리가 나면 "멈춰/숨어!".
   아랫길은 72m에 틈새 6개(약 11m 간격). 주기 13초 안에 한 칸만 갈 수 있어서, 한 번에 뛰어 올라가거나 틈새를 건너뛰면 맞는다.
   정답: 아랫길 틈새 1 → 2 → 3 → 4 → 5 → 6 → 오르막 끝 → 폐허 틈새 → 레버가 있는 틈새(레버 당기기) → 열린 철창문 */
const valley = extra => ({ kind: 'outdoor', w: 8, border: 'cliff', path: 3.2, day: true, ...extra });
// 코드로 만드는 둥근 바위(지름 6m: 골짜기 폭 8m를 거의 채운다). 틈새 안(x ±3.7)과 레버 앞(3.4)은 바위 가장자리(±3) 밖이라 안전하다
const R = 3;
const BOULDER = { sphere: true, color: 0x8f877b };
const LESSON = '쿠르르릉 소리가 날 때 길 위에 있으면 바위에 맞는다. 소리가 나면 틈새에서 기다리고, 바위가 지나간 직후에 바로 위 틈새로 한 칸만 간다';
const NOTE = '커다란 바위가 주기적으로 굴러 내려오는 좁은 오르막 외길이다. 길 위에 서 있다가 바위가 지나가면 맞고 쓰러진다. 절벽의 바위 틈새 안은 안전하다. '
  + '너는 겁이 나서, 시청자가 "지금 가"처럼 출발 신호를 주면 바로 위의 틈새로 한 칸씩 움직이는 편이다. 쿠르르릉 소리가 날 때 길로 나가는 건 위험하다. 틈새를 건너뛰면 길 위에 오래 있게 된다.';
const spot = (id, area, name, x, z, desc) => ({
  id, area, name, kind: 'spot', solid: false, safe: true,
  pos: [x, 0, z], stand: [Math.sign(x) * 3.7, z], look: [0, 1.3, z + 2.5], desc,
});
const ORD = ['첫', '두', '세', '네', '다섯', '여섯'];
// 아랫길 틈새: 오른쪽(동)·왼쪽(서) 번갈아, 11m 간격. 절벽 구멍(openings)의 x는 그 변을 따라간 z 좌표다
const NICHES = [[3.4, 26], [-3.4, 15], [3.4, 4], [-3.4, -7], [3.4, -18], [-3.4, -28]];

export default {
  id: 'stage3',
  title: '바위 굴러오는 골짜기',
  goal: '굴러오는 바위를 피해 골짜기 꼭대기의 폐허 문까지 도달하기',
  start: { area: 'lower', entry: 'start' },
  reward: 500,                                      // 클리어 보상(⚡). 최종 스테이지 후원에 쓴다
  // 이어지는 여정: 앞 스테이지를 깨고 넘어왔을 때 한별의 첫마디, AI에게 알려 주는 지난 일
  arrive: { say: '숲을 빠져나왔더니 골짜기네… 저 위에서 뭐가 굴러오는 소리 안 나?', history: '숲속 공터의 바위 길을 지나 숲을 빠져나오자 바위 절벽 골짜기 아래에 도착했다' },
  aiNote: NOTE,

  items: {},

  areas: {
    lower: {
      name: '골짜기 아랫길',
      wander: false,                                // 배회 끔: 길 위로 저절로 걸어 나가면 억울하게 죽는다
      env: valley({ d: 72, slope: 0.07, ground: 0x6d8a4f, sky: 0xa9d8ff, openings: {
        east: NICHES.filter(([x]) => x > 0).map(([, z]) => ({ x: z, w: 2.4 })),
        west: NICHES.filter(([x]) => x < 0).map(([, z]) => ({ x: z, w: 2.4 })),
      } }),
      scenery: '양옆으로 높은 바위 절벽이 이어진 긴 오르막 골짜기. 절벽 틈에 풀과 덤불이 자라고, 위쪽 멀리 폐허 기둥이 보인다.',
      // 주기 13초: 바위가 지나간 직후 출발하면 한 칸(약 11m, 걸어서 6초)은 넉넉하고, 두 칸을 한 번에 가면 맞는다
      hazard: { model: BOULDER, from: -38, to: 29.5, x: 0, lane: 2 * R, radius: R, lift: R, speed: 10, period: 13, warn: 2.5, delay: 12,
        reason: '길 한가운데 있다가 굴러 내려온 커다란 바위에 부딪혀 쓰러졌다', lesson: LESSON },
      entries: { start: { pos: [0, 33.5], look: [0, 2.5, 20] } },
      decor: [
        // 이어지는 여정: 등 뒤(남쪽)는 방금 지나온 숲 공터의 덤불 출구(스테이지 2)
        ['forest', 'Bush_1_C_Color1', [-2.6, 0, 37.2], 0.4, 2.8],
        ['forest', 'Bush_3_A_Color1', [2.7, 0, 37.4], 1.9, 2.8],
        ['forest', 'Tree_1_B_Color1', [-3.6, 0, 38.6], 0.2, 1.2],
        ['forest', 'Tree_4_A_Color1', [3.8, 0, 38.8], 2.0, 1.2],
        ['forest', 'Rock_1_K_Color1', [0.4, -1.4, 39.5], 0.6, 1.0],               // 가라앉은 그 바위
        ['forest', 'Tree_3_A_Color1', [-1.2, 0, 41.5], 4.16, 1.2],
        ['forest', 'Tree_1_C_Color1', [1.8, 0, 42.4], 0.04, 1.2],
        ['forest', 'Tree_2_C_Color1', [-5.6, 0, 41], 4.76, 1.2],
        ['forest', 'Tree_3_B_Color1', [5.8, 0, 41.4], 2.92, 1.2],
        ['forest', 'Tree_4_C_Color1', [-2.8, 0, 44.5], 5.52, 1.4],
        ['forest', 'Tree_2_D_Color1', [3.4, 0, 45], 4.96, 1.4],
        ['forest', 'Tree_1_A_Color1', [0.2, 0, 46.5], 1.4, 1.4],
        ['forest', 'Tree_4_A_Color1', [-7.4, 0, 45], 4.72, 1.4],
        ['forest', 'Tree_1_B_Color1', [7.6, 0, 45.5], 2.96, 1.4],
        ['forest', 'Tree_2_A_Color1', [-3.4, 0, 34.5], 0.3, 1.0],
        ['forest', 'Bush_1_C_Color1', [3.2, 0, 33.2], 0.5, 1.6],
        ['forest', 'Rock_1_D_Color1', [-2.9, 0, 31], 0.4, 1.4],
        ['forest', 'Rock_1_F_Color1', [2.9, 0, 30.6], 1.2, 1.3],                 // 바위가 멈추는 곳(받이)
        ['forest', 'Grass_1_A_Color1', [-2.3, 0, 21], 0, 2.5],
        ['forest', 'Grass_1_A_Color1', [2.2, 0, 9], 1, 2.5],
        ['forest', 'Grass_1_A_Color1', [-2, 0, -2], 2, 2.5],
        ['forest', 'Grass_1_A_Color1', [2.1, 0, -13], 3, 2.5],
        ['forest', 'Grass_1_A_Color1', [-2.2, 0, -23], 4, 2.5],
        ['dungeon', 'pillar', [-2.9, 0, -36.2], 0, 0.7],                          // 오르막 끝: 폐허가 보이기 시작
        ['dungeon', 'pillar', [2.9, 0, -36.2], 0, 0.7],
      ],
    },
    upper: {
      name: '폐허 오르막',
      wander: false,
      env: valley({ d: 26, slope: 0.08, dress: 'ruins', ground: 0x6f6a5e, path: 3.2, pathColor: 0x8b857a, sky: 0x9fb8d8, openings: { west: [{ x: 4, w: 2.4 }], east: [{ x: -4, w: 2.4 }] } }),
      scenery: '무너진 돌기둥과 부서진 벽이 흩어진 폐허. 철창문 너머로 앙상한 나무와 묘비, 호박등이 보인다.',
      hazard: { model: BOULDER, from: -10, to: 8, x: 0, lane: 2 * R, radius: R, lift: R, speed: 10, period: 12, warn: 2.2, delay: 7,
        reason: '폐허 오르막 한가운데서 굴러온 커다란 바위에 부딪혀 쓰러졌다', lesson: LESSON },
      entries: { start: { pos: [0, 11.5], look: [0, 2.5, -6] } },
      decor: [
        ['dungeon', 'wall', [-3.2, 0, -13], 0, 0.8],                              // 철창문 양옆 벽
        ['dungeon', 'wall', [3.2, 0, -13], 0, 0.8],
        ['dungeon', 'torch_mounted', [-1.9, 2.2, -12.6], 0],
        ['dungeon', 'torch_mounted', [1.9, 2.2, -12.6], 0],
        ['dungeon', 'pillar', [4.6, 0, -4], 0, 0.8],                              // 레버가 붙은 기둥(오른쪽 틈새)
        ['dungeon', 'rubble_half', [-3.6, 0, 9], 0.4, 0.5],
        ['dungeon', 'column', [3.4, 0, 2.4], 0, 0.9],
        ['dungeon', 'wall_broken', [-4.3, 0, -8.5], Math.PI / 2, 0.8],
        ['dungeon', 'banner_red', [-3.2, 0.3, -12.5], 0, 0.6],
        // 철창문 너머: 다음 스테이지(지하 대전당)로 내려가는 묘지 납골당이 보인다
        ['halloween', 'crypt', [0, 0, -20], 0, 0.6],
        ['halloween', 'tree_dead_large', [-4, 0, -17.5], 0.6, 1.1],
        ['halloween', 'tree_dead_medium', [4.2, 0, -18], 2.4, 1.1],
        ['halloween', 'pumpkin_orange_jackolantern', [-1.6, 0, -16.2], 0.4, 0.6],
        ['halloween', 'pumpkin_orange_jackolantern', [1.8, 0, -16.6], -0.5, 0.55],
        ['halloween', 'gravestone', [-2.8, 0, -15.4], 0.2, 0.8],
        ['halloween', 'gravestone', [3, 0, -15.2], -0.3, 0.8],
        ['halloween', 'post_lantern', [-1.4, 0, -17.6], 0, 0.7],
      ],
    },
  },

  objects: [
    // ── 아랫길 ──
    ...NICHES.map(([x, z], i) => spot(`n${i + 1}`, 'lower', `${ORD[i]} 번째 틈새`, x, z,
      `${x > 0 ? '오른쪽' : '왼쪽'} 절벽의 ${ORD[i]} 번째 바위 틈새${i === 0 ? '(가장 가까움)' : i === NICHES.length - 1 ? '(맨 위쪽, 오르막 끝 바로 앞)' : ''}`)),
    // 금화는 뺐다(2026-11-23): 줍지도 않았는데 주웠다고 말하거나 바위 길로 꾀어 짜증만 났다
    {
      id: 'topLower', area: 'lower', name: '오르막 끝', kind: 'spot', solid: false, exit: 'upper@start',
      pos: [0, 0, -35.6], stand: [0, -35.4], look: [0, 2, -40],
      desc: '길 맨 위, 폐허 기둥 사이로 이어지는 오르막 끝',
      exitSay: '오르막 끝까지 올라 폐허 쪽으로 넘어갔다',
    },
    // ── 폐허 오르막 ──
    spot('u1', 'upper', '폐허 틈새', -3.4, 4, '왼쪽 절벽의 바위 틈새'),
    {
      id: 'lever', area: 'upper', name: '레버', kind: 'lever', downWhen: 'gateOpen',
      pos: [3.95, 1.25, -4], rotY: Math.PI, stand: [3.4, -4], look: [4, 1.25, -4],
      safe: true,                                   // 레버 앞 = 오른쪽 틈새(숨을 곳). 틈새와 레버를 따로 두면 AI가 둘을 헷갈린다
      desc: [['gateOpen', '오른쪽 절벽 틈새 안 돌기둥의 레버. 내려가 있다(틈새 안이라 안전)'], '오른쪽 절벽 틈새 안 돌기둥에 붙은 레버(틈새 안이라 바위를 피할 수 있다)'],
    },
    {
      id: 'chest', area: 'upper', name: '작은 상자', kind: 'chest', openWhen: 'chestOpen',
      model: { pack: 'dungeon', name: 'chest', scale: 0.45 }, rotY: 0.4,
      pos: [-0.6, 0, -0.5], stand: [-0.4, 0.7], look: [-0.6, 0.3, -0.5],
      desc: [['chestOpen', '길 한가운데의 열린 상자. 텅 비어 있다'], '길 한가운데 놓인 낡은 상자'],
    },
    {
      id: 'gate', area: 'upper', name: '철창문', sinkWhen: 'gateOpen', sinkDepth: -3.4,
      model: { pack: 'dungeon', name: 'wall_gated', scale: 0.8 },
      pos: [0, 0, -13], stand: [0, -11.6], look: [0, 1.6, -13],
      desc: [['gateOpen', '정면 끝의 철창문. 위로 올라가 열려 있다'], '정면 끝, 폐허 입구를 막은 철창문'],
    },
  ],

  rules: [
    ...NICHES.map((_, i) => ({ target: `n${i + 1}`, on: ['move', 'interact'], say: `${ORD[i]} 번째 바위 틈새에 쏙 숨었다. 여기는 안전하다` })),
    { target: 'u1', on: ['move', 'interact'], say: '폐허 왼쪽 바위 틈새에 쏙 숨었다. 여기는 안전하다' },
    { target: 'lever', on: 'move', say: '레버가 있는 오른쪽 틈새에 쏙 숨었다. 여기는 안전하다' },
    { target: 'chest', if: '!chestOpen', do: ['set:chestOpen'], say: '상자를 열어 봤지만 텅 비어 있다' },
    { target: 'chest', say: '빈 상자다' },
    { target: 'lever', if: '!gateOpen', sfx: 'gate', do: ['set:gateOpen', 'checkpoint'], say: '레버를 당기자 끼기긱… 정면의 철창문이 위로 올라갔다!' },
    { target: 'lever', say: '레버는 이미 내려가 있다' },
    { target: 'gate', if: 'gateOpen', do: ['clear'], say: '열린 철창문 안으로 뛰어들었다. 그 너머 묘지의 납골당 계단이 땅 밑으로 이어진다. 골짜기 탈출! 스테이지 클리어!' },
    { target: 'gate', say: '철창문이 굳게 닫혀 있다. 근처에 여는 장치가 있을 것 같다' },
  ],

  viewers: {
    troll: 2, helper: 1,
    script: [
      { role: 'troll', when: ['area:lower', 'at:n1'], delay: 5, text: '틈새 왜 숨음 ㅋㅋ 그냥 맨 위까지 한 번에 뛰어', dona: 100 },
      { role: 'helper', when: 'dead:1', delay: 4, text: '바위 지나가자마자 바로 출발해야 함' },
      { role: 'troll', when: 'area:upper', delay: 9, text: '가운데 상자 열어봐 보물 있음 ㅋㅋ' },
      { role: 'helper', when: ['area:upper', '!gateOpen'], delay: 40, text: '오른쪽 틈새 안에 레버 같은 거 보임' },
    ],
  },

  tutorial: [
    { on: '@start', cards: [
      { art: 'boulder', title: '바위 굴러오는 골짜기', text: '언덕에서 큰 바위가 주기적으로 굴러 내려옵니다. 쿠르르릉 소리가 나면 틈새에 숨으라고 지시하고, 바위가 지나가면 "지금 가!"라고 알려 주세요.' },
    ] },
    { on: '@death', cards: [
      { art: 'boulder', title: '타이밍 잡기', text: '바위가 굴러 간 직후에 이동하는 것이 좋습니다. 한별이가 채팅을 보고 이동하는 데 몇 초 걸린다는 것을 고려하여 플레이를 유도하세요.' },
    ] },
  ],

  solution: [
    ...NICHES.map((_, i) => ({ type: 'move', target: `n${i + 1}` })),
    { type: 'move', target: 'topLower' },
    { type: 'move', target: 'u1' }, { type: 'interact', target: 'lever' },
    { type: 'move', target: 'gate' },
  ],
  tests: [
    { name: '레버 없이는 철창문이 안 열린다', actions: [{ type: 'move', target: 'topLower' }, { type: 'interact', target: 'gate' }], expect: { cleared: false, area: 'upper' } },
  ],
};
