/* 예전 임시 스테이지: 아늑한 방 (?stage=cozy 로 실행. 엔진 예제)
   정답: 빨간 통 줍기 → 레버에 기름통 사용 → 레버 당기기 → 문 열고 나가기
   한눈팔기: 반짝이는 보물 상자, 춤추는 고무 오리
   데이터 형식 설명은 js/stages/README.md */
export default {
  id: 'cozy',
  title: '아늑한 방',
  goal: '문을 열고 방에서 나가기',
  start: { area: 'room', entry: 'start' },

  items: {
    oil:  { icon: '🛢️', name: '기름통' },
    coin: { icon: '🪙', name: '낡은 동전' },
  },

  areas: {
    room: {
      name: '아늑한 방',
      env: {
        kind: 'room', w: 10, d: 10, h: 3.5,
        floor: { pack: 'dungeon', name: 'floor_wood_large' },
        openings: { north: [{ x: 0, w: 1.28, h: 2.24 }] },
      },
      entries: { start: { pos: [0, 3.5], look: [0, 1.3, -5] } },
      decor: [
        ['furniture', 'rug_rectangle_stripes_A', [0, 0.01, 0.2], Math.PI / 2],
        ['furniture', 'armchair_pillows', [-3.9, 0, 3.9], Math.PI * 0.75],
        ['furniture', 'lamp_standing', [4.4, 0, 4.4]],
        ['furniture', 'couch_pillows', [1.2, 0, 4.35], Math.PI],
        ['furniture', 'pictureframe_large_A', [-4.8, 1.9, 1.6], Math.PI / 2],
        ['furniture', 'pictureframe_medium', [4.8, 1.8, -0.5], -Math.PI / 2],
        ['bath', 'plant', [1.5, 0, -4.4]],
        ['furniture', 'cactus_medium_A', [-1.5, 0, -4.5]],
        ['furniture', 'cabinet_small', [-4.3, 0, -4.3], Math.PI / 4],     // 빨간 통 받침
      ],
    },
  },

  objects: [
    {
      id: 'door', area: 'room', name: '문', kind: 'door', openWhen: 'doorOpen',
      model: { pack: 'bath', name: 'door_modular' },
      pos: [0, 0, -5], stand: [0, -3.5], look: [0, 1.3, -5],
      desc: [['doorOpen', '정면 벽의 나무 문. 활짝 열려 있다'], '정면 벽의 커다란 나무 문. 닫혀 있다'],
    },
    {
      id: 'lever', area: 'room', name: '레버', kind: 'lever', downWhen: 'doorOpen', shinyWhen: 'oiled',
      pos: [-4.9, 1.25, -1.5], rotY: 0, stand: [-3.8, -1.5], look: [-5, 1.3, -1.5],
      desc: [['doorOpen', '왼쪽 벽의 금속 레버. 아래로 내려가 있다'], '왼쪽 벽에 붙은 금속 레버'],
    },
    {
      id: 'oil', area: 'room', name: '빨간 통', showIf: '!oilTaken',
      model: { pack: 'proto', name: 'Can_A', tint: 0xff4a3d },
      pos: [-4.3, 0.8, -4.3], stand: [-3.2, -3.2], look: [-4.3, 0.9, -4.3], solid: false,
      desc: '왼쪽 구석 작은 수납장 위의 빨간 통',
    },
    {
      id: 'box', area: 'room', name: '상자', kind: 'chest', openWhen: 'boxOpened',
      model: { pack: 'dungeon', name: 'chest_gold', scale: 0.5 }, rotY: Math.PI * 0.15,
      pos: [2, 0, -1], stand: [2, 0.5], look: [2, 0.4, -1],
      fx: { glow: { color: 0xffd65a, offWhen: 'boxOpened' }, sparkle: { offWhen: 'boxOpened' } },
      desc: [['boxOpened', '뚜껑이 열린 빈 보물 상자'], '바닥에서 금빛으로 반짝반짝 빛나는 보물 상자'],
    },
    {
      id: 'duck', area: 'room', name: '고무 오리',
      model: { pack: 'bath', name: 'ducky', scale: 1.8 }, rotY: -Math.PI * 0.75,
      pos: [4, 0, -3.6], stand: [3, -2.5], look: [4, 0.4, -3.6],
      fx: { anim: 'dance' },
      desc: '오른쪽 구석에서 혼자 뒤뚱뒤뚱 춤추는 커다란 노란 고무 오리',
    },
  ],

  rules: [
    { target: 'oil', on: ['pickup', 'interact'], do: ['set:oilTaken', 'give:oil'], say: '빨간 통을 주웠다. 기름통이다' },
    { target: 'lever', on: 'use', item: '기름통', if: '!oiled', do: ['set:oiled', 'take:기름통'], say: '레버에 기름을 발랐다. 이제 부드럽게 움직일 것 같다' },
    { target: 'lever', if: 'doorOpen', say: '레버는 이미 내려가 있다' },
    { target: 'lever', if: 'oiled', do: ['set:doorOpen'], say: '레버가 철컥 내려가고, 정면의 문이 열렸다' },
    { target: 'lever', say: '레버를 당겨 봤지만 녹슬어서 꿈쩍도 하지 않는다' },
    { target: 'door', if: 'doorOpen', do: ['clear'], say: '열린 문으로 나갔다. 스테이지 클리어!' },
    { target: 'door', say: '문을 밀어 봤지만 잠겨 있어 꿈쩍도 하지 않는다' },
    { target: 'box', if: '!boxOpened', do: ['set:boxOpened', 'give:coin'], say: '상자를 열었더니 낡은 동전이 하나 들어 있었다' },
    { target: 'box', say: '빈 상자다' },
    { target: 'duck', say: '오리가 삑 소리를 내며 더 신나게 춤춘다. 그것뿐이다' },
  ],

  // 다른 시청자: 방해꾼은 반짝이는 상자로, 조력자는 빨간 통 쪽으로
  viewers: {
    troll: 1, helper: 1,
    script: [
      { role: 'troll', when: '!boxOpened', delay: 10, text: '상자 먼저 열어봐 ㅋㅋ 보물 들었을 듯' },
      { role: 'helper', when: '!oilTaken', delay: 30, text: '빨간 통 뭔가 쓸 데 있어 보이는데' },
    ],
  },

  // 검증: 정답 경로와 확인하고 싶은 시나리오
  solution: [
    { type: 'pickup', target: 'oil' },
    { type: 'use', target: 'lever', item: '기름통' },
    { type: 'interact', target: 'lever' },
    { type: 'interact', target: 'door' },
  ],
  tests: [
    { name: '기름칠 없이 레버를 당기면 문이 안 열린다', actions: [{ type: 'interact', target: 'lever' }, { type: 'interact', target: 'door' }], expect: { flag: ['!doorOpen'], cleared: false } },
    { name: '열린 문으로 "가기"만 해도 나간다', actions: [{ type: 'pickup', target: 'oil' }, { type: 'use', target: 'lever', item: '기름통' }, { type: 'interact', target: 'lever' }, { type: 'move', target: 'door' }], expect: { cleared: true } },
  ],
};
