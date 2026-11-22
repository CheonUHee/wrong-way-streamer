/* 스테이지 2: 숲속 비밀 공터 (테마: Forest Nature, 난이도: 초급)
   설계 로그: docs/stages/stage2.md
   허브 앤 스포크: 가운데 갈림길 공터(허브)에서 오솔길 세 갈래(스포크)가 뻗고, 길마다 끝에 똑같이 생긴 돌 버튼이 하나씩 있다.
   - 서쪽 길 = 나무 길(큰 나무가 줄지어 선 가로수 길) · 동쪽 길 = 덤불 길(양옆이 덤불 벽) · 남쪽 길 = 호박밭(울타리 안에 호박이 가득)
   - 출구를 막은 큰 바위와 헷갈리지 않게, 세 번째 표식은 바위 대신 호박으로 했다
   순서 퍼즐: 이끼 낀 석판을 닦으면 그림(🌳 ➜ 🌿 ➜ 🎃)이 드러난다. 한별도 그림은 읽지만, 어느 길이 나무·덤불·호박 길인지는 모른다.
   한별(AI)에게는 길을 방향(서·동·남)으로만 알려 준다 → 플레이어가 "나무 길은 왼쪽 길이야"처럼 짚어 줘야 한다.
   정답: 석판 닦기 → 서쪽(나무) 길 버튼 → 동쪽(덤불) 길 버튼 → 남쪽(호박) 길 버튼 → 가라앉은 바위 길로 나가기 */
const STONE = 0x8f9a86, BASE = 0x6f7466;
const GROUND = 0x5f8a4a, SKY = 0x9fd3ff;
// 오솔길(스포크) 하나: 남쪽 끝이 공터로 이어지고, 북쪽 끝에 버튼이 있다
const lane = (border, dress, more = {}) => ({ kind: 'outdoor', w: 7, d: 14, ground: GROUND, sky: SKY, day: true, path: 1.4, border, dress, openings: { south: [{ x: 0, w: 2.4 }] }, ...more });
// 길의 생김새는 쓰지 않는다: 쓰면 버튼 순서를 AI가 혼자 맞힌다
const LANE_SCENERY = '양옆이 빽빽하게 막힌 좁은 오솔길. 햇살이 비치고 새소리가 들린다. 길 끝에 둥근 돌 버튼이 하나 있다.';

export default {
  id: 'stage2',
  title: '숲속 비밀 공터',
  goal: '북쪽 길을 막은 큰 바위를 치우고 숲을 빠져나가기',
  start: { area: 'glade', entry: 'start' },
  reward: 500,                                      // 클리어 보상(⚡). 다음 스테이지 후원에 쓴다
  // 이어지는 여정: 앞 스테이지를 깨고 넘어왔을 때 한별의 첫마디, AI에게 알려 주는 지난 일
  arrive: { say: '어? 연습장 문을 나왔더니 숲이잖아?! 뒤에 문만 덩그러니 서 있어 ㅋㅋ', history: '연습장 3의 진짜 출구 문을 열고 나왔더니 숲속 공터였다. 등 뒤에 방금 나온 문만 서 있다' },

  items: {},

  areas: {
    // ── 허브: 갈림길 공터 ──
    glade: {
      name: '숲속 갈림길 공터',
      env: { kind: 'outdoor', w: 14, d: 14, ground: GROUND, sky: SKY, day: true, border: 'none', dress: 'crossroad',
        trails: [[0, 0.5, -9, 0, 1.4], [0, 0.5, 9, 0, 1.4], [0, 0.5, 0, 9, 1.4], [0, 0.5, 0.4, -9, 1.6]],   // 가운데서 네 갈래로 뻗는 흙길
        openings: { north: [{ x: 0, w: 3.4 }], west: [{ x: 0, w: 2.6 }], east: [{ x: 0, w: 2.6 }], south: [{ x: 0, w: 2.6 }] } },
      // 한별이 감탄할 거리(만질 수 있는 오브젝트가 아니다). 길마다 무엇이 있는지는 쓰지 않는다
      scenery: '키 큰 나무에 둘러싸인 갈림길 공터. 낮은 나무 울타리 사이로 서·동·남쪽에 오솔길이 하나씩 나 있다. 햇살이 나뭇잎 사이로 쏟아지고, 새소리와 풀벌레 소리가 들린다. 북쪽 멀리 바위 절벽이 보인다.',
      entries: {
        start: { pos: [1.6, 4.2], look: [0, 1.2, -7] },
        fromWest: { pos: [-5.2, 0], look: [0, 1.2, 0] },
        fromEast: { pos: [5.2, 0], look: [0, 1.2, 0] },
        fromSouth: { pos: [0, 5.0], look: [0, 1.2, -3] },
      },
      decor: [
        // 이어지는 여정: 방금 나온 연습장 문이 공터 구석에 덩그러니 서 있다(스테이지 1)
        ['proto', 'Wall_Doorway', [3.8, 0, 6.3], Math.PI, 0.6],
        ['proto', 'Door_A', [4.28, 0, 6.15], Math.PI + 1.2, 0.6],
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
        // 오솔길 입구 너머 미리보기: 공터에서 봐도 길마다 무엇이 있는지 알 수 있게
        // 서쪽(나무 길): 큰 나무가 두 줄로 늘어선 가로수 길
        ['forest', 'Tree_1_A_Color1', [-8.6, 0, -1.7], 0.4, 1.2],
        ['forest', 'Tree_2_A_Color1', [-8.8, 0, 1.7], 1.9, 1.2],
        ['forest', 'Tree_4_A_Color1', [-11, 0, -1.8], 2.8, 1.3],
        ['forest', 'Tree_1_B_Color1', [-11.2, 0, 1.8], 0.9, 1.3],
        ['forest', 'Tree_3_A_Color1', [-13.6, 0, -1.6], 3.6, 1.4],
        ['forest', 'Tree_2_B_Color1', [-13.8, 0, 1.6], 5.1, 1.4],
        // 동쪽(덤불 길): 양옆을 막은 덤불 벽
        ['forest', 'Bush_1_C_Color1', [8.3, 0, -1.5], 0.2, 2.4],
        ['forest', 'Bush_3_A_Color1', [8.4, 0, 1.5], 1.4, 2.4],
        ['forest', 'Bush_1_A_Color1', [9.8, 0, -1.6], 2.1, 2.6],
        ['forest', 'Bush_1_B_Color1', [9.9, 0, 1.6], 3.3, 2.6],
        ['forest', 'Bush_3_B_Color1', [11.4, 0, -1.5], 4.0, 2.8],
        ['forest', 'Bush_1_C_Color1', [11.5, 0, 1.5], 5.2, 2.8],
        ['forest', 'Bush_1_D_Color1', [13, 0, 0], 0.7, 3.0],
        // 남쪽(호박밭): 울타리 너머 호박
        ['halloween', 'pumpkin_orange', [-1.7, 0, 8.4], 0.3, 1.15],
        ['halloween', 'pumpkin_yellow', [1.8, 0, 8.7], 1.2, 1.1],
        ['halloween', 'pumpkin_orange_small', [-2.4, 0, 9.6], 2.0, 1.15],
        ['halloween', 'pumpkin_orange', [2.3, 0, 10.1], 2.7, 1.2],
        ['halloween', 'pumpkin_yellow_small', [-1.5, 0, 11.2], 3.5, 1.2],
        ['halloween', 'pumpkin_orange', [1.6, 0, 11.8], 4.4, 1.25],
      ],
    },

    // ── 스포크: 오솔길 세 갈래 ──
    west: {
      name: '서쪽 오솔길',
      env: lane('none', 'treeLane'),                                   // 나무 길: 울타리 대신 큰 나무가 줄지어 선다
      scenery: LANE_SCENERY,
      entries: { fromHub: { pos: [0, 4.8], look: [0, 1.2, -6] } },
      decor: [
        ['forest', 'Tree_1_A_Color1', [-1.9, 0, -5.8], 0.4, 1.5],          // 버튼 옆 가장 큰 나무
        ['forest', 'Tree_4_A_Color1', [1.9, 0, -6.0], 2.2, 1.4],
      ],
    },
    east: {
      name: '동쪽 오솔길',
      env: lane('bush', 'bushLane', { backdrop: false }),               // 덤불 길: 나무 없이 덤불만
      scenery: LANE_SCENERY,
      entries: { fromHub: { pos: [0, 4.8], look: [0, 1.2, -6] } },
      decor: [
        ['forest', 'Bush_1_C_Color1', [-1.7, 0, -5.6], 0.2, 2.6],          // 버튼 옆 덤불 무더기
        ['forest', 'Bush_3_A_Color1', [1.8, 0, -5.8], 1.4, 2.4],
      ],
    },
    south: {
      name: '남쪽 오솔길',
      env: lane('none', 'pumpkinLane', { backdrop: false }),            // 호박밭: 밭에 호박이 가득, 바깥은 키 큰 풀
      scenery: LANE_SCENERY,
      entries: { fromHub: { pos: [0, 4.8], look: [0, 1.2, -6] } },
      decor: [
        ['halloween', 'pumpkin_orange', [-1.6, 0, -5.4], 0.5, 1.8],        // 버튼 옆 커다란 호박
        ['halloween', 'pumpkin_yellow', [1.7, 0, -5.6], 2.0, 1.5],
      ],
    },
  },

  objects: [
    // ── 갈림길 공터 ──
    {
      id: 'tablet', area: 'glade', name: '돌 석판', kind: 'sign',
      label: { text: '🌳 ➜ 🌿 ➜ 🎃', showIf: 'tabletClean', bg: '#d8d0bb', color: '#2a2a2a', board: 0x7d7a70, w: 1.3, h: 0.62, y: 1.15 },
      clue: '석판에 큰 나무 → 덤불 → 호박 그림이 화살표로 이어져 있다(버튼을 누를 순서). 닦기 전에는 이끼로 덮여 있다. 한별도 그림은 읽지만, 어느 길이 나무·덤불·호박 길인지는 모른다.',
      pos: [-2.8, 0, 2.0], rotY: 0.25, stand: [-2.5, 3.3], look: [-2.8, 1.15, 2.0],
      desc: [['tabletClean', '이끼를 닦아 낸 돌 석판. 큰 나무 → 덤불 → 호박 그림이 화살표로 이어져 있다(버튼을 누를 순서 같다). 그런데 세 오솔길 중 어느 길이 나무·덤불·호박 길인지는 모르겠다'], '왼쪽 앞, 이끼로 뒤덮인 낡은 돌 석판'],
      poke: '석판에는 큰 나무 → 덤불 → 호박 그림이 있다. 그런데 어느 길이 나무 길이고 어느 길이 호박 길인지 모르겠다',
    },
    // 오솔길 입구(위치로만 부른다. 나무 길: 서쪽, 덤불 길: 동쪽, 호박밭: 남쪽)
    { id: 'pathWest', area: 'glade', name: '서쪽 오솔길', kind: 'spot', solid: false, exit: 'west@fromHub', pos: [-6.6, 0, 0], stand: [-5.8, 0], look: [-8, 1.3, 0], desc: '왼쪽(서쪽) 울타리 사이로 난 오솔길 입구' },
    { id: 'pathEast', area: 'glade', name: '동쪽 오솔길', kind: 'spot', solid: false, exit: 'east@fromHub', pos: [6.6, 0, 0], stand: [5.8, 0], look: [8, 1.3, 0], desc: '오른쪽(동쪽) 울타리 사이로 난 오솔길 입구' },
    { id: 'pathSouth', area: 'glade', name: '남쪽 오솔길', kind: 'spot', solid: false, exit: 'south@fromHub', pos: [0, 0, 6.6], stand: [0, 5.8], look: [0, 1.3, 8], desc: '뒤쪽(남쪽) 울타리 사이로 난 오솔길 입구. 처음 서 있던 곳 바로 뒤' },
    {
      id: 'stoneGate', area: 'glade', name: '큰 바위', sinkWhen: 'gateOpen', sinkDepth: 4,
      model: { pack: 'forest', name: 'Rock_1_K_Color1', scale: 0.95 }, rotY: 0.3,
      pos: [0.6, 0, -6.9], stand: [0.4, -5.2], look: [0.4, 1.5, -6.9],
      desc: [['gateOpen', '북쪽 길. 막고 있던 바위가 가라앉아 길이 열려 있다'], '북쪽 길을 꽉 막고 있는 커다란 바위'],
    },

    // ── 오솔길 끝 버튼(모양이 똑같다) ──
    {
      id: 'btnWest', area: 'west', name: '서쪽 길 끝 버튼', kind: 'button', color: STONE, baseColor: BASE, downWhen: 'p1',
      pos: [0, 0, -4.6], stand: [0, -3.3], look: [0, 0.85, -4.6],
      desc: '서쪽 오솔길 끝에 있는 둥근 돌 버튼',              // 나무 길(AI에게는 알려 주지 않는다)
    },
    {
      id: 'btnEast', area: 'east', name: '동쪽 길 끝 버튼', kind: 'button', color: STONE, baseColor: BASE, downWhen: 'p2',
      pos: [0, 0, -4.6], stand: [0, -3.3], look: [0, 0.85, -4.6],
      desc: '동쪽 오솔길 끝에 있는 둥근 돌 버튼',              // 덤불 길
    },
    {
      id: 'btnSouth', area: 'south', name: '남쪽 길 끝 버튼', kind: 'button', color: STONE, baseColor: BASE, downWhen: 'gateOpen',
      pos: [0, 0, -4.6], stand: [0, -3.3], look: [0, 0.85, -4.6],
      desc: '남쪽 오솔길 끝에 있는 둥근 돌 버튼',              // 호박밭
    },
    // 공터로 돌아가는 길
    { id: 'backFromWest', area: 'west', name: '공터로 돌아가는 길', kind: 'spot', solid: false, lure: false, exit: 'glade@fromWest', pos: [0, 0, 6.6], stand: [0, 5.8], look: [0, 1.3, 8], desc: '뒤쪽, 갈림길 공터로 돌아가는 길' },
    { id: 'backFromEast', area: 'east', name: '공터로 돌아가는 길', kind: 'spot', solid: false, lure: false, exit: 'glade@fromEast', pos: [0, 0, 6.6], stand: [0, 5.8], look: [0, 1.3, 8], desc: '뒤쪽, 갈림길 공터로 돌아가는 길' },
    { id: 'backFromSouth', area: 'south', name: '공터로 돌아가는 길', kind: 'spot', solid: false, lure: false, exit: 'glade@fromSouth', pos: [0, 0, 6.6], stand: [0, 5.8], look: [0, 1.3, 8], desc: '뒤쪽, 갈림길 공터로 돌아가는 길' },
    // 오솔길에서 다른 오솔길로 바로 가기(공터를 지나간다). 오솔길 안에서 "서쪽 길로 가"라는 말을 들었을 때 고를 수 있게
    ...[['west', '서쪽'], ['east', '동쪽'], ['south', '남쪽']].flatMap(([from]) => [['west', '서쪽'], ['east', '동쪽'], ['south', '남쪽']]
      .filter(([to]) => to !== from)
      .map(([to, dir], i) => ({
        id: `${from}To${to[0].toUpperCase()}${to.slice(1)}`, area: from, name: `${dir} 오솔길(공터를 지나서)`, kind: 'spot', solid: false, lure: false,
        exit: `${to}@fromHub`, exitSay: `공터를 지나 ${dir} 오솔길로 들어갔다`,
        pos: [i ? 1.2 : -1.2, 0, 6.6], stand: [i ? 0.9 : -0.9, 5.8], look: [0, 1.3, 8],
        desc: `뒤쪽 길로 나가 갈림길 공터를 지나 ${dir} 오솔길로 가는 길`,
      }))),
  ],

  rules: [
    { target: 'tablet', if: '!tabletClean', do: ['set:tabletClean', 'ask:석판에 나무 → 덤불 → 호박 그림이 있어! 근데 어느 길이 나무 길이야? 채팅창, 알려 줘!'], say: '석판을 뒤덮은 이끼를 손으로 쓱쓱 닦아 냈다. 큰 나무 → 덤불 → 호박 그림이 화살표로 이어져 있다' },
    // 결과 문장도 방향으로만 말한다(나무·덤불·호박을 말하면 AI가 짝을 알아채 혼자 푼다)
    { target: 'btnWest', if: ['!p1', '!gateOpen'], do: ['set:p1'], say: '서쪽 길 끝 버튼이 딸깍 눌려 들어갔다' },
    { target: 'btnEast', if: ['p1', '!p2'], do: ['set:p2'], say: '동쪽 길 끝 버튼이 딸깍 눌려 들어갔다' },
    { target: 'btnSouth', if: ['p2', '!gateOpen'], do: ['set:gateOpen'], say: '남쪽 길 끝 버튼을 누르자 멀리 공터 쪽에서 쿠웅…! 북쪽 길을 막던 큰 바위가 가라앉는 소리가 났다!' },
    { target: ['btnWest', 'btnEast', 'btnSouth'], if: 'gateOpen', say: '버튼은 이미 눌려 있다. 공터 북쪽 길은 열렸다' },
    // 이미 눌린 버튼을 또 누르면 아무 일도 없다(전부 풀리게 하면 Gemini 플레이테스트에서 너무 가혹했다: 확인하러 다시 누르다 처음부터)
    { target: 'btnWest', if: 'p1', say: '서쪽 길 끝 버튼은 이미 눌려 들어가 있다' },
    { target: 'btnEast', if: 'p2', say: '동쪽 길 끝 버튼은 이미 눌려 들어가 있다' },
    { target: ['btnWest', 'btnEast', 'btnSouth'], do: ['unset:p1', 'unset:p2'], say: '버튼을 눌렀더니 덜컥! 숲 여기저기서 눌려 있던 버튼들이 튀어 오르는 소리가 났다. 순서가 틀렸나 보다' },
    { target: 'stoneGate', if: 'gateOpen', do: ['clear'], say: '바위가 가라앉은 길을 지나 숲 밖으로 빠져나갔다. 저 앞에 바위 절벽 골짜기가 보인다. 스테이지 클리어!' },
    { target: 'stoneGate', say: '커다란 바위가 길을 꽉 막고 있다. 밀어도 꿈쩍하지 않는다' },
  ],

  viewers: {
    troll: 1, helper: 1,
    script: [
      // 방해꾼은 석판이 드러나면 방향으로 오답(덤불 길 = 동쪽 = 2번)을 민다. 한별이 바로 따를 수 있게 방향으로 말한다
      { role: 'troll', when: ['tabletClean', '!p1', '!gateOpen'], delay: 6, text: '오른쪽 길 버튼부터 눌러 ㅋㅋ 딱 봐도 그게 1번', dona: 1000 },
      { role: 'helper', when: ['tabletClean', '!p1', '!gateOpen'], delay: 35, text: '석판 그림이랑 길마다 뭐가 있는지 비교해 보면 되는 거 아님?' },
      { role: 'helper', when: ['!tabletClean'], delay: 60, text: '왼쪽 이끼 낀 돌 뭔가 수상한데' },
    ],
  },

  tutorial: [
    { on: '@start', cards: [
      { art: 'order', title: '숲을 탈출하기', text: '어딘가에 숲을 탈출할 수 있는 장치가 있습니다. 단서를 보고 한별이가 숲을 탈출할 수 있도록 알려주세요.' },
    ] },
  ],

  solution: [
    { type: 'interact', target: 'tablet' },
    { type: 'move', target: 'pathWest' },
    { type: 'interact', target: 'btnWest' },
    { type: 'move', target: 'backFromWest' },
    { type: 'move', target: 'pathEast' },
    { type: 'interact', target: 'btnEast' },
    { type: 'move', target: 'backFromEast' },
    { type: 'move', target: 'pathSouth' },
    { type: 'interact', target: 'btnSouth' },
    { type: 'move', target: 'backFromSouth' },
    { type: 'move', target: 'stoneGate' },
  ],
  tests: [
    { name: '이미 눌린 버튼을 다시 눌러도 풀리지 않는다', actions: [{ type: 'move', target: 'pathWest' }, { type: 'interact', target: 'btnWest' }, { type: 'interact', target: 'btnWest' }], expect: { flag: ['p1'] } },
    { name: '순서가 틀리면 버튼이 모두 풀린다', actions: [{ type: 'move', target: 'pathWest' }, { type: 'interact', target: 'btnWest' }, { type: 'move', target: 'backFromWest' }, { type: 'move', target: 'pathSouth' }, { type: 'interact', target: 'btnSouth' }], expect: { flag: ['!p1', '!gateOpen'] } },
    { name: '호박(남쪽) 길 버튼부터 누르면 안 열린다', actions: [{ type: 'move', target: 'pathSouth' }, { type: 'interact', target: 'btnSouth' }, { type: 'move', target: 'backFromSouth' }, { type: 'move', target: 'pathWest' }, { type: 'interact', target: 'btnWest' }, { type: 'move', target: 'backFromWest' }, { type: 'move', target: 'pathEast' }, { type: 'interact', target: 'btnEast' }], expect: { flag: ['p2', '!gateOpen'] } },
    { name: '석판을 안 닦아도 순서만 맞으면 열린다(단서는 도움일 뿐)', actions: [{ type: 'move', target: 'pathWest' }, { type: 'interact', target: 'btnWest' }, { type: 'move', target: 'backFromWest' }, { type: 'move', target: 'pathEast' }, { type: 'interact', target: 'btnEast' }, { type: 'move', target: 'backFromEast' }, { type: 'move', target: 'pathSouth' }, { type: 'interact', target: 'btnSouth' }, { type: 'move', target: 'backFromSouth' }, { type: 'interact', target: 'stoneGate' }], expect: { cleared: true } },
  ],
};
