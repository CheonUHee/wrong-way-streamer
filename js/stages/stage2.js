/* 스테이지 2: 숲속 비밀 공터 (테마: Forest Nature, 난이도: 초급)
   설계 로그: docs/stages/stage2.md
   순서 퍼즐: 이끼 낀 석판을 닦으면 그림(🌳 ➜ 🌿 ➜ 🪨)이 드러난다. 그림은 플레이어만 볼 수 있다.
   버튼 세 개는 모양이 똑같고, 옆에 있는 큰 나무·덤불·바위로만 구분된다 → 플레이어가 "나무 옆 버튼"처럼 말로 짚어 줘야 한다.
   정답: 석판 닦기 → 나무 옆 버튼 → 덤불 옆 버튼 → 바위 옆 버튼 → 가라앉은 바위 문으로 나가기 */
const STONE = 0x8f9a86, BASE = 0x6f7466;

export default {
  id: 'stage2',
  title: '숲속 비밀 공터',
  goal: '북쪽 길을 막은 큰 바위를 치우고 숲을 빠져나가기',
  start: { area: 'glade', entry: 'start' },
  // 이어지는 여정: 앞 스테이지를 깨고 넘어왔을 때 한별의 첫마디, AI에게 알려 주는 지난 일
  arrive: { say: '어? 연습장 문을 나왔더니 숲이잖아?! 뒤에 문만 덩그러니 서 있어 ㅋㅋ', history: '연습장 3의 진짜 출구 문을 열고 나왔더니 숲속 공터였다. 등 뒤 덤불 사이에 방금 나온 문만 서 있다' },

  items: { coin: { icon: '🪙', name: '반짝이 동전' } },

  areas: {
    glade: {
      name: '숲속 공터',
      env: { kind: 'outdoor', w: 14, d: 14, ground: 0x5f8a4a, sky: 0x9fd3ff, day: true, border: 'bush', openings: { north: [{ x: 0, w: 3.4 }], south: [{ x: 0, w: 2.6 }] } },
      entries: { start: { pos: [0, 5.6], look: [0, 1.2, -7] } },
      decor: [
        // 이어지는 여정: 등 뒤 덤불 사이에 방금 나온 연습장 문이 덩그러니 서 있다(스테이지 1)
        ['proto', 'Wall_Doorway', [0, 0, 7.4], Math.PI, 0.6],
        ['proto', 'Door_A', [0.48, 0, 7.25], Math.PI + 1.2, 0.6],
        // 북쪽 길 너머로 다음 스테이지(바위 골짜기)의 절벽 어귀가 보인다
        ['forest', 'Rock_1_N_Color1', [-3.4, 0, -13.5], 0.3, 1.5],
        ['forest', 'Rock_1_P_Color1', [3.6, 0, -14], 2.6, 1.6],
        ['forest', 'Rock_1_O_Color1', [-5.2, 0, -16.5], 1.1, 1.8],
        ['forest', 'Rock_1_Q_Color1', [5.4, 0, -17], 4.2, 1.8],
        ['forest', 'Rock_1_K_Color1', [-2.6, 0, -11], 0.7, 1.1],
        ['forest', 'Rock_1_J_Color1', [2.8, 0, -11.4], 2.2, 1.1],
        ['forest', 'Rock_1_N_Color1', [-4.2, 0, -20.5], 2.0, 1.9],
        ['forest', 'Rock_1_O_Color1', [4.4, 0, -21], 0.9, 2.0],
        ['forest', 'Rock_1_P_Color1', [-3.6, 0, -25], 3.3, 2.1],
        ['forest', 'Rock_1_Q_Color1', [3.8, 0, -25.5], 1.5, 2.1],
        ['forest', 'Rock_1_M_Color1', [0, 0, -30], 0.4, 2.6],                    // 골짜기 끝을 막는 높은 바위(굽은 길처럼 보인다)
        ['forest', 'Rock_3_A_Color1', [0.6, 0, -17], 0.3, 1.4],                   // 굴러 내려와 멈춘 둥근 바위(다음 스테이지 예고)
        ['forest', 'Tree_2_B_Color1', [-7, 0, -22], 0.5, 1.4],
        ['forest', 'Tree_4_B_Color1', [7.2, 0, -23], 1.5, 1.4],
        ['forest', 'Tree_1_A_Color1', [-6.1, 0, -2.2], 0.4, 1.25],          // 큰 나무(나무 버튼 옆)
        ['forest', 'Bush_1_C_Color1', [6.2, 0, 1.0], 0.2, 1.9],             // 덤불 무더기(덤불 버튼 옆)
        ['forest', 'Bush_1_C_Color1', [6.3, 0, 2.4], 1.4, 1.5],
        ['forest', 'Bush_3_A_Color1', [5.7, 0, -0.2], 2.1, 1.8],
        ['forest', 'Rock_1_I_Color1', [5.4, 0, -5.4], 0.6, 1.1],            // 둥근 바위(바위 버튼 옆). 길을 막은 큰 바위와 떨어뜨려 둔다
        ['forest', 'Grass_1_A_Color1', [-4.6, 0, 4.6], 0, 1.4],
        ['forest', 'Grass_1_A_Color1', [4.6, 0, 4.8], 1, 1.4],
        ['forest', 'Grass_1_A_Color1', [-1.6, 0, -3.2], 2, 1.4],
        ['forest', 'Rock_1_D_Color1', [4.9, 0, 5.2], 0.4, 0.9],
        ['forest', 'Tree_Bare_1_A_Color1', [-5.6, 0, 5.4], 0.8, 1.2],
      ],
    },
  },

  objects: [
    {
      id: 'tablet', area: 'glade', name: '돌 석판', kind: 'sign',
      label: { text: '🌳 ➜ 🌿 ➜ 🪨', showIf: 'tabletClean', bg: '#d8d0bb', color: '#2a2a2a', board: 0x7d7a70, w: 1.3, h: 0.62, y: 1.15 },
      clue: '석판에 큰 나무 → 덤불 → 바위 그림이 화살표로 이어져 있다(버튼을 누를 순서). 닦기 전에는 이끼로 덮여 있고, AI는 그림 내용을 모른다.',
      pos: [-2.8, 0, 2.0], rotY: 0.25, stand: [-2.5, 3.3], look: [-2.8, 1.15, 2.0],
      desc: [['tabletClean', '이끼를 닦아 낸 돌 석판. 그림 세 개가 화살표로 이어져 있는데 무슨 그림인지는 흐릿하다'], '왼쪽 앞, 이끼로 뒤덮인 낡은 돌 석판'],
      poke: '석판에 그림이 그려져 있는데, 무슨 뜻인지 잘 모르겠다',
    },
    {
      id: 'btnTree', area: 'glade', name: '나무 옆 버튼', kind: 'button', color: STONE, baseColor: BASE, downWhen: 'p1',
      pos: [-5, 0, -0.9], stand: [-3.8, -0.9], look: [-5, 0.85, -0.9],
      desc: '왼쪽 큰 나무 아래의 둥근 돌 버튼',
    },
    {
      id: 'btnBush', area: 'glade', name: '덤불 옆 버튼', kind: 'button', color: STONE, baseColor: BASE, downWhen: 'p2',
      pos: [5, 0, 1.3], stand: [3.8, 1.3], look: [5, 0.85, 1.3],
      desc: '오른쪽 앞, 덤불 무더기 옆의 둥근 돌 버튼',
    },
    {
      id: 'btnRock', area: 'glade', name: '바위 옆 버튼', kind: 'button', color: STONE, baseColor: BASE, downWhen: 'gateOpen',
      pos: [4.2, 0, -4.4], stand: [3.2, -3.4], look: [4.2, 0.85, -4.4],
      desc: '오른쪽 안쪽, 둥근 바위 앞의 둥근 돌 버튼',
    },
    {
      id: 'stoneGate', area: 'glade', name: '큰 바위', sinkWhen: 'gateOpen', sinkDepth: 4,
      model: { pack: 'forest', name: 'Rock_1_K_Color1', scale: 0.95 }, rotY: 0.3,
      pos: [0.6, 0, -6.9], stand: [0.4, -5.2], look: [0.4, 1.5, -6.9],
      desc: [['gateOpen', '북쪽 길. 막고 있던 바위가 가라앉아 길이 열려 있다'], '북쪽 길을 꽉 막고 있는 커다란 바위'],
    },
    {
      id: 'coin', area: 'glade', name: '반짝이는 것', showIf: '!coinTaken',
      model: { pack: 'proto', name: 'Coin_A', scale: 0.35 }, pos: [1.6, 0.35, 0.6], stand: [1.4, 1.8], look: [1.6, 0.3, 0.6], solid: false,
      fx: { anim: 'spin', glow: { color: 0xffd65a, intensity: 2 }, sparkle: {} },
      desc: '공터 한가운데 풀밭에서 반짝반짝 빛나는 무언가',
    },
  ],

  rules: [
    { target: 'tablet', if: '!tabletClean', do: ['set:tabletClean', 'ask:석판에 그림이 있는데 난 잘 모르겠어. 채팅창, 뭐가 그려져 있어?'], say: '석판을 뒤덮은 이끼를 손으로 쓱쓱 닦아 냈다. 그림 같은 게 그려져 있다' },
    { target: 'btnTree', if: ['!p1', '!gateOpen'], do: ['set:p1'], say: '큰 나무 옆 버튼이 딸깍 눌려 들어갔다' },
    { target: 'btnBush', if: ['p1', '!p2'], do: ['set:p2'], say: '덤불 옆 버튼이 딸깍 눌려 들어갔다' },
    { target: 'btnRock', if: ['p2', '!gateOpen'], do: ['set:gateOpen'], say: '바위 옆 버튼을 누르자 쿠웅… 북쪽 길을 막던 큰 바위가 땅속으로 가라앉았다!' },
    { target: ['btnTree', 'btnBush', 'btnRock'], if: 'gateOpen', say: '버튼은 모두 눌려 있다. 길은 이미 열렸다' },
    { target: ['btnTree', 'btnBush', 'btnRock'], do: ['unset:p1', 'unset:p2'], say: '버튼을 눌렀더니 덜컥! 눌려 있던 버튼이 모두 튀어 올랐다. 순서가 틀렸나 보다' },
    { target: 'stoneGate', if: 'gateOpen', do: ['clear'], say: '바위가 가라앉은 길을 지나 숲 밖으로 빠져나갔다. 저 앞에 바위 절벽 골짜기가 보인다. 스테이지 클리어!' },
    { target: 'stoneGate', say: '커다란 바위가 길을 꽉 막고 있다. 밀어도 꿈쩍하지 않는다' },
    { target: 'coin', on: ['pickup', 'interact'], do: ['set:coinTaken', 'give:coin'], say: '반짝이던 것을 주웠다. 그냥 동전이다' },
  ],

  viewers: {
    troll: 1, helper: 1,
    script: [
      { role: 'troll', when: '!coinTaken', delay: 18, text: '가운데 반짝이는 거 뭐임? 주워봐 ㅋㅋ', dona: 1000 },
      { role: 'troll', when: 'tabletClean', delay: 7, text: '바위 버튼부터 눌러 ㅋㅋ 딱 봐도 그게 1번' },
      { role: 'helper', when: ['tabletClean', '!p1', '!gateOpen'], delay: 35, text: '석판 그림 순서대로 버튼 누르는 거 아님?' },
      { role: 'helper', when: ['!tabletClean'], delay: 60, text: '왼쪽 이끼 낀 돌 뭔가 수상한데' },
    ],
  },

  tutorial: [
    { on: '@start', cards: [
      { art: 'order', title: '이번엔 직접 해 볼 차례', text: '숲 어딘가에 너만 읽을 수 있는 단서가 숨어 있어. 찾아서 한별에게 순서를 말로 알려 줘.' },
    ] },
  ],

  solution: [
    { type: 'interact', target: 'tablet' },
    { type: 'interact', target: 'btnTree' },
    { type: 'interact', target: 'btnBush' },
    { type: 'interact', target: 'btnRock' },
    { type: 'move', target: 'stoneGate' },
  ],
  tests: [
    { name: '순서가 틀리면 버튼이 모두 풀린다', actions: [{ type: 'interact', target: 'btnTree' }, { type: 'interact', target: 'btnRock' }], expect: { flag: ['!p1', '!gateOpen'] } },
    { name: '바위 버튼부터 누르면 안 열린다', actions: [{ type: 'interact', target: 'btnRock' }, { type: 'interact', target: 'btnTree' }, { type: 'interact', target: 'btnBush' }], expect: { flag: ['p2', '!gateOpen'] } },
    { name: '석판을 안 닦아도 순서만 맞으면 열린다(단서는 도움일 뿐)', actions: [{ type: 'interact', target: 'btnTree' }, { type: 'interact', target: 'btnBush' }, { type: 'interact', target: 'btnRock' }, { type: 'interact', target: 'stoneGate' }], expect: { cleared: true } },
  ],
};
