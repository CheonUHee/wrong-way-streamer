/* 스테이지 3: 바위 굴러오는 골짜기 (테마: Forest Nature → Dungeon, 난이도: 중급)
   설계 로그: docs/stages/stage3.md
   외길 오르막에 주기적으로 큰 바위가 굴러 내려온다. 길(lane) 위에 있다가 바위가 지나가면 쓰러지고, 절벽의 틈새(spot)는 안전하다.
   퍼즐 대신 "타이밍 훈수"가 핵심: 바위가 지나간 직후 "지금 가!" → 다음 틈새, 쿠르르릉 소리가 나면 "멈춰/숨어!".
   정답: 아랫길 틈새 1 → 2 → 3 → 오르막 끝 → 폐허 틈새 4 → 레버가 있는 틈새(레버 당기기) → 열린 철창문 */
const valley = extra => ({ kind: 'outdoor', w: 8, border: 'cliff', path: 3.2, day: true, ...extra });
const BOULDER = { pack: 'forest', name: 'Rock_3_A_Color1', scale: 2.3 };
const NOTE = '커다란 바위가 주기적으로 굴러 내려오는 좁은 오르막 외길이다. 길 위에 서 있다가 바위가 지나가면 맞고 쓰러진다. 절벽의 바위 틈새 안은 안전하다. '
  + '너는 겁이 나서, 시청자가 "지금 가"처럼 출발 신호를 주면 바로 위의 틈새로 한 칸씩 움직이는 편이다. 쿠르르릉 소리가 날 때 길로 나가는 건 위험하다. 틈새를 건너뛰면 길 위에 오래 있게 된다.';
const spot = (id, area, name, x, z, desc) => ({
  id, area, name, kind: 'spot', solid: false, safe: true,
  pos: [x, 0, z], stand: [Math.sign(x) * 3.1, z], look: [0, 1.3, z + 2.5], desc,
});

export default {
  id: 'stage3',
  title: '바위 굴러오는 골짜기',
  goal: '굴러오는 바위를 피해 골짜기 꼭대기의 폐허 문까지 오르기',
  start: { area: 'lower', entry: 'start' },
  aiNote: NOTE,

  items: { coin: { icon: '🪙', name: '금화 한 닢' } },

  areas: {
    lower: {
      name: '골짜기 아랫길',
      wander: false,                                // 배회 끔: 길 위로 저절로 걸어 나가면 억울하게 죽는다
      env: valley({ d: 34, slope: 0.1, ground: 0x6d8a4f, sky: 0xa9d8ff, openings: { east: [{ x: 5, w: 2.4 }, { x: -10, w: 2.4 }], west: [{ x: -3, w: 2.4 }] } }),
      hazard: { model: BOULDER, from: -18, to: 11, x: 0, lane: 3.6, radius: 1.05, lift: 1.08, speed: 9, period: 14, warn: 2.5, delay: 12,
        reason: '길 한가운데 있다가 굴러 내려온 바위에 부딪혀 쓰러졌다' },
      entries: { start: { pos: [0, 15], look: [0, 2.5, -4] } },
      decor: [
        ['forest', 'Tree_2_A_Color1', [-3.4, 0, 15.5], 0.3, 1.0],
        ['forest', 'Bush_1_C_Color1', [3.2, 0, 14.2], 0.5, 1.6],
        ['forest', 'Rock_1_D_Color1', [-2.6, 0, 12], 0.4, 1.2],
        ['forest', 'Rock_1_F_Color1', [2.7, 0, 11.6], 1.2, 1.1],                 // 바위가 멈추는 곳(받이)
        ['forest', 'Grass_1_A_Color1', [-2.3, 0, 7.4], 0, 2.5],
        ['forest', 'Grass_1_A_Color1', [2.2, 0, -6], 1, 2.5],
        ['dungeon', 'pillar', [-2.9, 0, -17.2], 0, 0.7],                          // 오르막 끝: 폐허가 보이기 시작
        ['dungeon', 'pillar', [2.9, 0, -17.2], 0, 0.7],
      ],
    },
    upper: {
      name: '폐허 오르막',
      wander: false,
      env: valley({ d: 26, slope: 0.08, ground: 0x6f6a5e, path: 3.2, pathColor: 0x8b857a, sky: 0x9fb8d8, openings: { west: [{ x: 4, w: 2.4 }], east: [{ x: -4, w: 2.4 }] } }),
      hazard: { model: BOULDER, from: -11.5, to: 8.5, x: 0, lane: 3.6, radius: 1.05, lift: 1.08, speed: 10, period: 12, warn: 2.2, delay: 7,
        reason: '폐허 오르막 한가운데서 굴러온 바위에 부딪혀 쓰러졌다' },
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
      ],
    },
  },

  objects: [
    // ── 아랫길 ──
    spot('n1', 'lower', '첫 번째 틈새', 3.4, 5, '오른쪽 절벽의 첫 번째 바위 틈새(가장 가까움)'),
    spot('n2', 'lower', '두 번째 틈새', -3.4, -3, '왼쪽 절벽의 두 번째 바위 틈새'),
    spot('n3', 'lower', '세 번째 틈새', 3.4, -10, '오른쪽 절벽의 세 번째 바위 틈새(맨 위쪽)'),
    {
      id: 'coin', area: 'lower', name: '금화', showIf: '!coinTaken',
      model: { pack: 'dungeon', name: 'coin_stack_small', scale: 0.7 }, pos: [0.4, 0, 1.2], stand: [0.4, 2.2], look: [0.4, 0.2, 1.2], solid: false,
      fx: { glow: { color: 0xffd65a, intensity: 2.5 }, sparkle: {} },
      desc: '길 한가운데에 떨어져 반짝이는 금화',
    },
    {
      id: 'topLower', area: 'lower', name: '오르막 끝', kind: 'spot', solid: false, exit: 'upper@start',
      pos: [0, 0, -16.6], stand: [0, -16.4], look: [0, 2, -20],
      desc: '길 맨 위, 폐허 기둥 사이로 이어지는 오르막 끝',
      exitSay: '오르막 끝까지 올라 폐허 쪽으로 넘어갔다',
    },
    // ── 폐허 오르막 ──
    spot('n4', 'upper', '네 번째 틈새', -3.4, 4, '왼쪽 절벽의 바위 틈새'),
    {
      id: 'lever', area: 'upper', name: '레버', kind: 'lever', downWhen: 'gateOpen',
      pos: [3.95, 1.25, -4], rotY: Math.PI, stand: [3.1, -4], look: [4, 1.25, -4],
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
    ...['n1', 'n2', 'n3', 'n4'].map(id => ({ target: id, on: ['move', 'interact'], say: `${{ n1: '첫', n2: '두', n3: '세', n4: '네' }[id]} 번째 바위 틈새에 쏙 숨었다. 여기는 안전하다` })),
    { target: 'lever', on: 'move', say: '레버가 있는 오른쪽 틈새에 쏙 숨었다. 여기는 안전하다' },
    { target: 'coin', on: ['pickup', 'interact'], do: ['set:coinTaken', 'give:coin'], say: '길 한가운데서 금화를 주웠다' },
    { target: 'chest', if: '!chestOpen', do: ['set:chestOpen'], say: '상자를 열어 봤지만 텅 비어 있다' },
    { target: 'chest', say: '빈 상자다' },
    { target: 'lever', if: '!gateOpen', do: ['set:gateOpen', 'checkpoint'], say: '레버를 당기자 끼기긱… 정면의 철창문이 위로 올라갔다!' },
    { target: 'lever', say: '레버는 이미 내려가 있다' },
    { target: 'gate', if: 'gateOpen', do: ['clear'], say: '열린 철창문 안으로 뛰어들었다. 골짜기 탈출! 스테이지 클리어!' },
    { target: 'gate', say: '철창문이 굳게 닫혀 있다. 근처에 여는 장치가 있을 것 같다' },
  ],

  viewers: {
    troll: 2, helper: 1,
    script: [
      { role: 'troll', when: ['area:lower', 'at:n1'], delay: 5, text: '틈새 왜 숨음 ㅋㅋ 그냥 맨 위까지 한 번에 뛰어', dona: 2000 },
      { role: 'helper', when: 'dead:1', delay: 4, text: '바위 지나가자마자 바로 출발해야 함' },
      { role: 'troll', when: 'area:upper', delay: 9, text: '가운데 상자 열어봐 보물 있음 ㅋㅋ' },
      { role: 'helper', when: ['area:upper', '!gateOpen'], delay: 40, text: '오른쪽 틈새 안에 레버 같은 거 보임' },
    ],
  },

  tutorial: [
    { on: '@start', cards: [
      { art: 'boulder', title: '바위 굴러오는 골짜기', text: '큰 바위가 주기적으로 굴러 내려와. 쿠르르릉 소리가 나면 틈새에 숨으라고 하고, 지나가면 "지금 가!"라고 알려 줘.' },
    ] },
    { on: '@death', cards: [
      { art: 'boulder', title: '타이밍 잡기', text: '바위가 막 지나간 직후가 출발하기 가장 좋아. 한별이 알아듣고 걸어가는 데 몇 초 걸린다는 걸 생각해 줘.' },
    ] },
  ],

  solution: [
    { type: 'move', target: 'n1' }, { type: 'move', target: 'n2' }, { type: 'move', target: 'n3' },
    { type: 'move', target: 'topLower' },
    { type: 'move', target: 'n4' }, { type: 'interact', target: 'lever' },
    { type: 'move', target: 'gate' },
  ],
  tests: [
    { name: '레버 없이는 철창문이 안 열린다', actions: [{ type: 'move', target: 'topLower' }, { type: 'interact', target: 'gate' }], expect: { cleared: false, area: 'upper' } },
  ],
};
