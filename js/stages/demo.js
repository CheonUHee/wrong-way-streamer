/* 엔진 확인용 예제: 갈림길 묘지 (?stage=demo 로 실행)
   여러 구역 이동, 플레이어만 보는 단서, 오답 루트의 스켈레톤과 사망·재시작을 한 번씩 보여 준다.
   정답: 왼쪽 호박 길 → 묘비 앞 열쇠 줍기 → 돌아와서 철문에 열쇠 사용 → 철문으로 나가기
   오답: 오른쪽 어두운 길 → 금화 더미에 다가가면 스켈레톤에게 맞아 쓰러짐 → 입구에서 다시 시작 */
const yard = (extra = {}) => ({ kind: 'outdoor', w: 12, d: 12, ground: 0x4f6b45, sky: 0x1d1b33, border: 'fence', ...extra });

export default {
  id: 'demo',
  title: '갈림길 묘지 (엔진 예제)',
  goal: '잠긴 철문을 열고 묘지에서 나가기',
  start: { area: 'gate', entry: 'start' },

  items: { key: { icon: '🗝️', name: '은빛 열쇠' } },

  areas: {
    gate: {
      name: '묘지 입구',
      env: yard({ openings: { north: [{ x: 0, w: 3.4 }], west: [{ x: 0, w: 3.4 }], east: [{ x: 0, w: 3.4 }] } }),
      entries: {
        start:     { pos: [0, 4.5], look: [0, 1.4, -6] },
        fromLeft:  { pos: [-4.3, 0], look: [0, 1.4, -6] },
        fromRight: { pos: [4.3, 0], look: [0, 1.4, -6] },
      },
      decor: [
        ['halloween', 'gravestone', [-3.5, 0, -3.8], 0.3],
        ['halloween', 'gravemarker_A', [3.2, 0, 3.6], -0.4],
        ['halloween', 'tree_dead_medium', [-4.6, 0, 4.4]],
        ['halloween', 'lantern_standing', [-5.2, 0, -1.6]],
        ['halloween', 'lantern_standing', [-5.2, 0, 1.6]],
      ],
    },
    pumpkin: {
      name: '호박 등불 길',
      env: yard({ ground: 0x5a6b40, openings: { south: [{ x: 0, w: 3.4 }] } }),
      entries: { fromGate: { pos: [0, 4.3], look: [0, 0.8, -4] } },
      decor: [
        ['halloween', 'pumpkin_orange', [-2.5, 0, 1.5]],
        ['halloween', 'pumpkin_yellow_small', [2.6, 0, 0.5]],
        ['halloween', 'lantern_standing', [-1.6, 0, -1]],
        ['halloween', 'lantern_standing', [1.6, 0, -1]],
        ['halloween', 'grave_A', [-3.6, 0, -4.2]],
        ['halloween', 'tree_pine_orange_medium', [4.3, 0, -4.3]],
      ],
    },
    dark: {
      name: '어두운 길',
      checkpoint: false,              // 위험 구역: 여기서 죽으면 마지막으로 들른 안전한 구역(묘지 입구)에서 다시 시작
      env: yard({ ground: 0x3a4436, sky: 0x100e1c, dim: true, openings: { south: [{ x: 0, w: 3.4 }] } }),
      entries: { fromGate: { pos: [0, 4.3], look: [0, 0.6, -3.5] } },
      decor: [
        ['halloween', 'fence_broken', [-3, 0, -1.5], Math.PI / 2],
        ['halloween', 'ribcage', [2.4, 0, 1.2], 0.6],
        ['halloween', 'bone_A', [-1.6, 0, 2.2]],
        ['halloween', 'tree_dead_large', [3.8, 0, -4]],
        ['halloween', 'coffin', [-3.8, 0, -4.2], 0.3],
      ],
    },
  },

  objects: [
    // ── 입구 ──
    {
      id: 'gate', area: 'gate', name: '철문', kind: 'gate', openWhen: 'gateOpen',
      model: { pack: 'halloween', name: 'fence_gate' },
      pos: [0, 0, -6], stand: [0, -4.4], look: [0, 1.3, -6],
      desc: [['gateOpen', '정면의 묘지 철문. 활짝 열려 있다'], '정면의 커다란 묘지 철문. 자물쇠로 잠겨 있다'],
    },
    {
      id: 'sign', area: 'gate', name: '표지판', kind: 'sign',
      label: { text: '☠ ➜', color: '#2a1a12' },          // 플레이어만 보는 단서: 오른쪽은 위험
      clue: '표지판에 해골 그림과 오른쪽 화살표가 그려져 있다. AI에게는 그림 내용을 알려 주지 않는다.',
      pos: [0, 0, -1.2], stand: [0, 0.4], look: [0, 1.4, -1.2],
      desc: '갈림길 한가운데 박힌 낡은 나무 표지판. 무언가 그려져 있지만 흐릿하다',
      poke: '표지판을 두드려 봤다. 그림이 그려져 있는데 잘 모르겠다',
    },
    {
      id: 'leftArch', area: 'gate', name: '왼쪽 아치', exit: 'pumpkin@fromGate',
      model: { pack: 'halloween', name: 'arch' }, rotY: Math.PI / 2,
      pos: [-6, 0, 0], stand: [-4.6, 0], look: [-6, 1.5, 0], solid: false,
      desc: '왼쪽, 호박 등불이 줄지어 늘어선 아치 길',
    },
    {
      id: 'rightArch', area: 'gate', name: '오른쪽 아치', exit: 'dark@fromGate',
      model: { pack: 'halloween', name: 'arch' }, rotY: Math.PI / 2,
      pos: [6, 0, 0], stand: [4.6, 0], look: [6, 1.5, 0], solid: false,
      desc: '오른쪽, 부서진 울타리 너머 어둑한 아치 길',
    },
    {
      id: 'jack', area: 'gate', name: '잭오랜턴',
      model: { pack: 'halloween', name: 'pumpkin_orange_jackolantern', scale: 0.6 }, rotY: -0.6,
      pos: [3.6, 0, -3.6], stand: [2.7, -2.4], look: [3.6, 0.5, -3.6],
      fx: { anim: 'bob', glow: { color: 0xff9a3c } },
      desc: '혼자 들썩들썩 움직이는 주황색 잭오랜턴 호박',
      poke: '호박이 히죽 웃으며 더 신나게 들썩인다. 그것뿐이다',
    },
    // ── 호박 길(정답) ──
    {
      id: 'key', area: 'pumpkin', name: '열쇠', showIf: '!keyTaken',
      model: { pack: 'dungeon', name: 'key', scale: 0.7 }, rotY: 0.4,
      pos: [0.4, 0.15, -3.2], stand: [0.4, -2], look: [0.4, 0.2, -3.2], solid: false,
      fx: { sparkle: {}, glow: { color: 0xcfe8ff, intensity: 1.5 } },
      desc: '맨 안쪽 묘비 앞에 떨어진 작은 은빛 열쇠',
    },
    {
      id: 'tomb', area: 'pumpkin', name: '묘비',
      model: { pack: 'halloween', name: 'gravestone' },
      pos: [0, 0, -4.2], stand: [0, -2.4], look: [0, 0.9, -4.2],
      desc: '맨 안쪽의 커다란 묘비',
      poke: '차가운 묘비다. 글씨가 닳아서 읽을 수 없다',
    },
    {
      id: 'backFromPumpkin', area: 'pumpkin', name: '돌아가는 아치', exit: 'gate@fromLeft',
      model: { pack: 'halloween', name: 'arch' },
      pos: [0, 0, 6], stand: [0, 4.6], look: [0, 1.5, 6], solid: false,
      desc: '뒤쪽, 묘지 입구로 돌아가는 아치',
    },
    // ── 어두운 길(오답) ──
    {
      id: 'coins', area: 'dark', name: '금화 더미',
      model: { pack: 'dungeon', name: 'coin_stack_large', scale: 0.6 },
      pos: [0, 0, -3.5], stand: [0, -2.2], look: [0, 0.4, -3.5],
      fx: { sparkle: {}, glow: { color: 0xffd65a, intensity: 3 } },
      desc: '어둠 속에서 번쩍번쩍 빛나는 금화 더미',
    },
    {
      id: 'backFromDark', area: 'dark', name: '돌아가는 아치', exit: 'gate@fromRight',
      model: { pack: 'halloween', name: 'arch' },
      pos: [0, 0, 6], stand: [0, 4.6], look: [0, 1.5, 6], solid: false,
      desc: '뒤쪽, 묘지 입구로 돌아가는 아치',
    },
  ],

  enemies: {
    skel: { model: { pack: 'skeleton', name: 'Skeleton_Minion' }, spawn: [1.4, -4.2] },
  },

  // 다른 시청자: 방해꾼은 후원으로 오른쪽(함정)을 밀고, 죽은 뒤에도 한 번 더 부추긴다. 조력자는 표지판을 가리킨다
  viewers: {
    troll: 1, helper: 1,
    script: [
      { role: 'troll', when: ['area:gate', '!keyTaken'], delay: 8, text: '오른쪽 길 금화 보임? 개꿀 ㅋㅋ', dona: 5000 },
      { role: 'helper', when: 'area:gate', delay: 16, text: '가운데 표지판 그림 잘 봐봐' },
      { role: 'troll', when: ['dead:1', 'area:gate'], delay: 4, text: '아까 운 나빴던 거임 한 번 더 ㄱㄱ', dona: 3000 },
    ],
  },

  rules: [
    { target: 'key', on: ['pickup', 'interact'], do: ['set:keyTaken', 'give:key'], say: '은빛 열쇠를 주웠다' },
    { target: 'gate', on: 'use', item: '은빛 열쇠', if: '!gateOpen', do: ['set:gateOpen', 'take:은빛 열쇠'], say: '열쇠를 꽂고 돌리자 철문 자물쇠가 철컥 풀렸다' },
    { target: 'gate', if: 'gateOpen', do: ['clear'], say: '열린 철문으로 묘지를 빠져나갔다. 스테이지 클리어!' },
    { target: 'gate', say: '철문을 흔들어 봤지만 자물쇠가 단단히 잠겨 있다' },
    { target: 'coins', on: 'any', do: ['enemy:skel', 'die:금화에 손을 뻗는 순간 땅속에서 해골이 튀어나와 한 대 맞고 쓰러졌다'], say: '금화에 손을 뻗는 순간 해골이 튀어나와 한 대 맞고 쓰러졌다' },
  ],

  solution: [
    { type: 'interact', target: 'leftArch' },
    { type: 'pickup', target: 'key' },
    { type: 'interact', target: 'backFromPumpkin' },
    { type: 'use', target: 'gate', item: '은빛 열쇠' },
    { type: 'interact', target: 'gate' },
  ],
  tests: [
    { name: '금화는 먼저 다가가기만 한다(말릴 수 있는 한 박자)', actions: [{ type: 'interact', target: 'rightArch' }, { type: 'interact', target: 'coins' }], expect: { dead: false, area: 'dark' } },
    { name: '금화 앞에서 손을 뻗으면 죽는다', actions: [{ type: 'interact', target: 'rightArch' }, { type: 'move', target: 'coins' }, { type: 'interact', target: 'coins' }], expect: { dead: true } },
    { name: '열쇠 없이는 철문이 안 열린다', actions: [{ type: 'interact', target: 'gate' }], expect: { cleared: false, flag: ['!gateOpen'] } },
  ],
};
