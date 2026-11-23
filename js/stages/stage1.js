/* 스테이지 1: 튜토리얼 연습장 (테마: Prototype)
   설계 로그: docs/stages/stage1.md
   흐름: 연습장 1(버튼 → 문: 상호작용) → 연습장 2(열쇠 줍기 → 문에 쓰기: 아이템) → 연습장 3(갈림길: 한별이 묻는다 + 플레이어만 보는 안내판 + 방해꾼 후원)
   정답: 빨간 버튼 → 문 → 열쇠 줍기 → 열쇠를 문에 → 문 → 왼쪽 문 */
const room = (extra = {}) => ({ kind: 'room', w: 8, d: 8, h: 3.5, grid: true, ...extra });
const DOOR = { pack: 'proto', name: 'Door_A' };

export default {
  id: 'stage1',
  title: '튜토리얼 연습장',
  goal: '출구로 나가기',
  start: { area: 'room1', entry: 'start' },

  items: { key: { icon: '🗝️', name: '열쇠' } },

  areas: {
    room1: {
      name: '연습장 1',
      env: room({ openings: { north: [{ x: 0, w: 1.28, h: 2.24 }] } }),
      entries: { start: { pos: [0, 2.6], look: [0, 1.3, -4] } },
      decor: [
        ['proto', 'Dummy_Base', [-3, 0, 2.9], 0.6],
        ['proto', 'Box_A', [3.2, 0, 3.1], 0.3],
        ['proto', 'Box_B', [3.3, 0.41, 3.1], 1.1],
        ['proto', 'Pallet_Small', [-3.1, 0, -3.1], 0.2],
        ['proto', 'Cube_Prototype_Small', [3.3, 0, 0.4], 0, 0.45],
      ],
    },
    room2: {
      name: '연습장 2',
      env: room({ openings: { north: [{ x: 0, w: 1.28, h: 2.24 }] } }),
      entries: { start: { pos: [0, 2.6], look: [0, 1.3, -4] } },
      decor: [
        ['proto', 'Barrel_A', [3.3, 0.4, 3.2]],
        ['proto', 'Barrel_A', [2.4, 0.4, 3.3]],
        ['proto', 'target_stand_A', [-3.2, 0, 3], 0.8],
        ['proto', 'Box_A', [-3.3, 0, 0.6], 0.5],
      ],
    },
    room3: {
      name: '연습장 3',
      env: room({ w: 10, openings: { north: [{ x: -2.5, w: 1.28, h: 2.24, glow: 0xbdf0a0 }] } }),   // 진짜 출구 뒤는 풀빛(다음 스테이지: 숲)
      entries: { start: { pos: [0, 2.6], look: [0, 1.5, -4] } },
      // 들어서자마자 한별이 시청자에게 묻는다: 스트리머를 말로 움직일 수 있다는 걸 보여 주는 장면
      enter: { do: ['ask:문이 두 개네? 채팅창, 어느 쪽으로 갈까?'] },
      decor: [
        ['proto', 'Box_A', [-4.2, 0, 3.2], 0.2],
        ['proto', 'Box_A', [-3.7, 0, 3.4], 0.9],
        ['proto', 'Barrel_A', [4.2, 0.4, 3.2]],
        ['proto', 'Dummy_Base', [4, 0, -2.4], -0.9],
      ],
    },
  },

  objects: [
    // ── 연습장 1: 버튼과 문 ──
    {
      id: 'button', area: 'room1', name: '빨간 버튼', kind: 'button', color: 0xe8453c, downWhen: 'door1Open',
      pos: [-2.2, 0, -2.4], stand: [-2.2, -1.3], look: [-2.2, 0.85, -2.4],
      desc: [['door1Open', '왼쪽 앞의 빨간 버튼. 눌려 있다'], '왼쪽 앞 받침대 위의 커다란 빨간 버튼'],
    },
    {
      id: 'door1', area: 'room1', name: '문', kind: 'door', openWhen: 'door1Open', model: DOOR,
      pos: [0, 0, -4], stand: [0, -2.6], look: [0, 1.2, -4],
      desc: [['door1Open', '정면 벽의 문. 활짝 열려 있다'], '정면 벽의 닫힌 문'],
    },
    {
      id: 'duck', area: 'room1', name: '고무 오리',
      model: { pack: 'bath', name: 'ducky', scale: 1.8 }, rotY: -Math.PI * 0.7,
      pos: [2.4, 0, -2.6], stand: [1.7, -1.5], look: [2.4, 0.4, -2.6],
      fx: { anim: 'dance' },
      desc: '오른쪽 구석에서 혼자 뒤뚱뒤뚱 춤추는 커다란 노란 고무 오리',
    },
    // ── 연습장 2: 아이템 ──
    {
      id: 'table', area: 'room2', name: '책상', model: { pack: 'proto', name: 'table_medium' }, rotY: 0.2,
      pos: [2.4, 0, -2.2], stand: [2.2, -0.9], look: [2.4, 0.7, -2.2],
      desc: [['keyTaken', '오른쪽의 파란 책상. 위에는 아무것도 없다'], '오른쪽의 파란 책상'],
    },
    {
      id: 'key', area: 'room2', name: '열쇠', showIf: '!keyTaken',
      model: { pack: 'dungeon', name: 'key', scale: 0.7 }, rotY: 0.6,
      pos: [2.3, 0.66, -2.2], stand: [2.2, -0.9], look: [2.3, 0.7, -2.2], solid: false,
      fx: { sparkle: {} },
      desc: '오른쪽 책상 위에 놓인 작은 열쇠',
    },
    {
      id: 'crate', area: 'room2', name: '나무 상자', model: { pack: 'proto', name: 'Box_B', scale: 1.6 }, rotY: -0.4,
      pos: [-2.5, 0, -2.4], stand: [-2, -1.2], look: [-2.5, 0.4, -2.4],
      desc: '왼쪽의 커다란 나무 상자',
    },
    {
      id: 'door2', area: 'room2', name: '잠긴 문', kind: 'door', openWhen: 'door2Open', model: { pack: 'proto', name: 'Door_B' },
      pos: [0, 0, -4], stand: [0, -2.6], look: [0, 1.2, -4],
      desc: [['door2Open', '정면 벽의 빨간 문. 활짝 열려 있다'], '정면 벽의 빨간 문. 열쇠 구멍이 있는 자물쇠가 달려 있다'],
    },
    // ── 연습장 3: 갈림길 ──
    {
      id: 'leftDoor', area: 'room3', name: '왼쪽 문', kind: 'door', model: DOOR, openWhen: 'exitOpen',   // 열리면 문 너머 풀빛(다음 스테이지: 숲)이 보인다
      pos: [-2.5, 0, -4], stand: [-2.5, -2.6], look: [-2.5, 1.2, -4],
      desc: '정면 벽 왼쪽의 문',
    },
    {
      id: 'rightDoor', area: 'room3', name: '오른쪽 문', kind: 'door', model: { pack: 'proto', name: 'Door_A_Decorated' },
      pos: [2.5, 0, -4], stand: [2.5, -2.6], look: [2.5, 1.2, -4],
      desc: [['fakeKnown', '정면 벽 오른쪽의 문. 오리 인형이 튀어나온 가짜 장난감 문이다'], '정면 벽 오른쪽의 문. 과녁 그림이 붙어 있다'],
    },
    {
      id: 'sign', area: 'room3', name: '안내판', kind: 'sign',
      label: { text: '⬅ GOAL', wall: true, y: 2.1, w: 1.7, h: 0.62, bg: '#ffe14a', color: '#1a1500', board: 0x34363d },
      clue: '두 문 사이의 노란 안내판에 "⬅ GOAL"이 적혀 있다. 한별도 읽지만, 화살표가 어느 문을 가리키는지는 헷갈려 한다.',
      pos: [0, 0, -3.95], stand: [0, -2.4], look: [0, 1.9, -4],
      desc: '두 문 사이 벽에 붙은 노란 안내판. "GOAL"이라는 글씨와 화살표가 있다. 그런데 화살표가 두 문 중 어느 쪽을 가리키는지 헷갈린다(나는 왼쪽 오른쪽을 맨날 헷갈린다)',
      poke: '안내판에 "GOAL"이랑 화살표가 있다. 근데 이게 어느 문 말하는 거지? 왼쪽 오른쪽이 헷갈린다',
    },
  ],

  rules: [
    { target: 'button', if: '!door1Open', do: ['set:door1Open'], say: '빨간 버튼을 꾹 누르자 철컥 하고 정면 문이 열렸다' },
    { target: 'button', say: '버튼은 이미 눌려 있다' },
    { target: 'door1', if: 'door1Open', do: ['goto:room2@start'], say: '열린 문을 지나 연습장 2로 들어왔다' },
    { target: 'door1', say: '문이 잠겨 꿈쩍도 하지 않는다. 어딘가 여는 장치가 있을 것 같다' },
    { target: 'duck', say: '오리가 삑! 소리를 내며 더 신나게 춤춘다. 그것뿐이다' },

    { target: ['key', 'table'], on: ['pickup', 'interact'], if: '!keyTaken', do: ['set:keyTaken', 'give:key'], say: '책상 위의 열쇠를 주웠다' },
    // 열쇠를 주운 뒤 책상을 다시 만졌을 때(전에는 '위에 뭔가 놓여 있다'가 계속 나와서 한별이 책상에 집착했다)
    { target: 'table', on: ['interact', 'pickup'], say: '평범한 파란 책상이다. 열쇠는 이미 가방에 있고, 위에는 이제 아무것도 없다' },
    { target: 'door2', on: 'use', item: '열쇠', if: '!door2Open', do: ['set:door2Open', 'take:열쇠'], say: '열쇠를 꽂아 돌리자 자물쇠가 철컥 풀리며 문이 열렸다' },
    { target: 'door2', if: 'door2Open', do: ['goto:room3@start'], say: '열린 문을 지나 연습장 3으로 들어왔다' },
    // 열쇠를 들고 문을 밀기만 하면, 아이템을 '써야' 한다는 걸 결과 문장으로 알려 준다(Gemini 플레이테스트: 밀어 보고 상자를 뒤지러 감)
    { target: 'door2', if: 'has:열쇠', say: '문을 밀어 봤지만 자물쇠로 잠겨 있다. 가방에 있는 열쇠를 이 문에 써 봐야겠다' },
    { target: 'door2', say: '문을 밀어 봤지만 자물쇠로 잠겨 있다. 열쇠가 필요해 보인다' },
    { target: 'crate', say: '나무 상자를 열어 봤다. 안은 텅 비어 있다' },

    { target: 'leftDoor', do: ['set:exitOpen', 'clear'], say: '왼쪽 문을 열자 풀빛이 쏟아지고 풀 냄새가 났다. 출구다! 튜토리얼 클리어!' },
    // 가짜 문: 문 한가운데에서 용수철 오리 인형이 뿅 튀어나온다(pop은 화면 연출). 가짜라는 걸 확실히 보여 준다
    { target: 'rightDoor', if: '!fakeKnown', do: ['react:shout:으아악?! 깜짝이야!!|꺄악! 뭐, 뭐야 이거?!|왓?! 오리가 튀어나왔어!!', 'pop', 'set:fakeKnown'], say: '문고리를 당기자 문 한가운데가 덜컥 열리며 용수철 달린 오리 인형이 뿅! 튀어나왔다. 깜짝 장난감 문이다. 진짜 출구가 아니다!' },
    { target: 'rightDoor', do: ['react:angry:아 또 너야?! 알았다고!|으악, 또 속았어!!', 'pop'], say: '또 오리 인형이 뿅! 튀어나왔다. 이 문은 장난감이다. 출구는 다른 쪽이다' },
  ],

  // 다른 시청자: 연습장 3에서 방해꾼이 처음 후원으로 끼어든다(후원 튜토리얼이 이때 뜬다). 즉흥 대사는 끈다
  viewers: {
    troll: 0, helper: 0,
    script: [
      { role: 'helper', when: ['area:room1', '!door1Open'], delay: 35, text: '저 빨간 버튼 누르라고 해 봐' },
      // 한별이 물은 직후에 끼어든다: 플레이어가 대답하기 전에 후원이 오면 '후원은 반드시 읽힌다'를 바로 겪는다(Gemini 플레이테스트: 10초 뒤면 이미 클리어해서 후원을 못 봄)
      { role: 'troll', when: 'area:room3', delay: 2.5, text: '오른쪽 문 ㄱㄱ 과녁 붙은 게 출구임 ㅋㅋ', dona: 100 },
    ],
  },

  // 플레이어 전용 튜토리얼(뜨는 동안 게임이 멈춘다)
  tutorial: [
    { on: '@start', cards: [
      { art: 'role', title: '당신은 이 방송의 시청자입니다!', text: '채팅을 보내서 스트리머 한별이 게임을 클리어할 수 있도록 도와주세요.' },
      { art: 'describe', title: '채팅으로 지시하기', text: '오브젝트의 생김새를 채팅으로 전달해 플레이를 "훈수"하세요.(예시: "빨간 버튼 눌러") 한별이가 딴짓을 하면, 퍼즐 해결에 집중하도록 야단치세요.' },
    ] },
    { on: '@gain', cards: [
      { art: 'bag', title: '아이템 사용하기', text: '한별이가 획득한 아이템은 왼쪽 아래 가방에 들어갑니다. 아이템의 이름과 아이템을 사용할 장소를 함께 말해 한별이의 플레이를 도와주세요. (예시: "열쇠를 문에 써")' },
    ] },
    { on: '@ask', cards: [
      { art: 'ask', title: '한별이가 물어볼 때', text: '한별이는 다음에 할 행동을 채팅창에 물어볼 수도 있습니다. 대답해 주면 그대로 따라할 것입니다.' },
      { art: 'clue', title: '퍼즐 힌트', text: '퍼즐을 풀 수 있는 힌트가 맵에 배치되어 있습니다. 한별이도 힌트를 읽을 수 있지만, 힌트가 가리키는 위치는 모릅니다. 화면을 보고 위치를 알려 주세요. (예시: "왼쪽 문이야")' },
    ] },
    { on: '@dona', cards: [
      { art: 'dona', title: '채팅과 후원', text: '채팅 내용이 많아지면 당신이 보낸 채팅을 읽지 못할 수 있습니다. 후원을 보내면 한별이는 반드시 후원 내용을 읽지만, 후원 비용⚡를 소모해야 합니다. 여러 후원이 쌓이면 한별이는 가장 나중에 도착한 후원에 따라 행동합니다.' },
      { art: 'troll', title: '방해하는 시청자', text: '한별이에게 거짓말로 훈수하는 시청자도 있습니다. 방해하는 후원이 오면, 그 뒤에 후원을 보내 바로잡아 한별이가 게임을 헤매지 않도록 도와주세요.' },
    ] },
  ],

  solution: [
    { type: 'interact', target: 'button' },
    { type: 'move', target: 'door1' },
    { type: 'pickup', target: 'key' },
    { type: 'use', target: 'door2', item: '열쇠' },
    { type: 'interact', target: 'door2' },
    { type: 'interact', target: 'leftDoor' },
  ],
  tests: [
    { name: '버튼 없이는 문이 안 열린다', actions: [{ type: 'interact', target: 'door1' }], expect: { area: 'room1' } },
    { name: '열쇠 없이는 연습장 2 문이 안 열린다', actions: [{ type: 'interact', target: 'button' }, { type: 'interact', target: 'door1' }, { type: 'interact', target: 'door2' }], expect: { area: 'room2', flag: ['!door2Open'] } },
    { name: '오른쪽 문은 가짜(클리어 안 됨)', actions: [{ type: 'interact', target: 'button' }, { type: 'interact', target: 'door1' }, { type: 'pickup', target: 'key' }, { type: 'use', target: 'door2', item: '열쇠' }, { type: 'interact', target: 'door2' }, { type: 'interact', target: 'rightDoor' }], expect: { cleared: false, area: 'room3' } },
  ],
};
