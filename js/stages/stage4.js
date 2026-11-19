/* 스테이지 4: 해골 묘지의 지하 대전당 (테마: Dungeon + Halloween, 난이도: 최종)
   설계 로그: docs/stages/stage4.md
   스테이지 1~3의 기믹을 모두 심화해서 한 번에 쓴다.
   - 대전당(허브): 철창문은 [해골 열쇠로 자물쇠 풀기] + [기름칠한 레버 당기기] 두 가지가 모두 필요하다(아이템 2개를 각각 다른 방에서 구해 온다)
   - 촛불 회랑: 4단 순서 퍼즐. 단서(명판)는 다른 방(대전당)에 있다. 한별도 명판은 읽지만, 회랑의 어느 촛대가 해골·호박·관·뼈 옆인지는 모른다
     (AI에게는 촛대를 위치로만 알려 준다) → 플레이어가 "해골 옆 촛대는 오른쪽 안쪽"처럼 짚어 줘야 한다
   - 보물 창고(위험 구역): 필요한 기름통 바로 옆에 함정 황금 상자. 방해꾼이 큰 후원으로 상자를 민다
   - 탈출로: 굴러오는 통을 틈새(벽감)에 숨으며 지나간다(스테이지 3의 타이밍 훈수, 더 짧은 주기)
   정답: 서쪽 통로 → 촛불 4개(해골→호박→관→뼈) → 상자 속 열쇠 → 대전당 → 동쪽 통로 → 기름통 → 대전당 → 레버에 기름 → 철창에 열쇠 → 레버 → 철창 → 벽감 2개 → 출구 */
const STONE = { wall: 0x6b6560, wainscot: 0x4e4945, trim: 0x3b3734, ceil: 0x2a2725 };
const crypt = extra => ({ kind: 'room', h: 4.2, dim: true, colors: STONE, floorColor: 0x3d3935, glowColor: 0xffb46a, floor: { pack: 'dungeon', name: 'floor_tile_large' }, ...extra });
// flame.at: 촛대 모델(candle_triple) 심지 세 개의 위치(모델 배율 1 기준). 켜지면 물방울 불꽃이 커지고, 꺼지면 줄어들며 사라진다
const WICKS = [[0.237, 0.86, -0.048], [0.006, 0.69, 0], [0.185, 0.62, 0.132]];
const candle = (id, name, pos, stand, lit, desc) => ({
  id, area: 'candle', name, model: { pack: 'dungeon', name: 'candle_triple', scale: 1.5 },
  pos, stand, look: [pos[0], 0.8, pos[2]], desc,
  fx: { glow: { color: 0xffa040, intensity: 2.5, offWhen: `!${lit}` }, flame: { at: WICKS, offWhen: `!${lit}` } },
});
const CANDLES = ['candleFarRight', 'candleNearRight', 'candleFar', 'candleLeft'];
const BARREL = { pack: 'dungeon', name: 'barrel_large', scale: 1.2, lie: true, halfLen: 1 };

export default {
  id: 'stage4',
  title: '해골 묘지의 지하 대전당',
  goal: '철창문을 열고 지하 대전당을 탈출하기',
  start: { area: 'hall', entry: 'start' },
  // 이어지는 여정: 앞 스테이지를 깨고 넘어왔을 때 한별의 첫마디, AI에게 알려 주는 지난 일
  arrive: { say: '납골당 계단으로 내려왔더니… 여기 완전 지하 대전당인데?!', history: '골짜기 꼭대기 철창문 너머 묘지의 납골당 계단을 내려와 지하 대전당에 들어섰다' },

  items: {
    key: { icon: '💀', name: '해골 열쇠' },
    oil: { icon: '🛢️', name: '기름통' },
  },

  areas: {
    hall: {
      name: '지하 대전당',
      env: crypt({ w: 12, d: 12, openings: { north: [{ x: 0, w: 3.2, h: 3.2 }], west: [{ x: 0, w: 1.6, h: 2.6 }], east: [{ x: 0, w: 1.6, h: 2.6, glow: 0xffd66a }], south: [{ x: 0, w: 1.8, h: 2.6, glow: 0xa9c4e0 }] } }),   // 남쪽: 내려온 계단(골짜기의 하늘빛)
      scenery: '높은 돌기둥과 붉은 깃발이 늘어선 어둑한 지하 홀. 관과 촛불, 작은 호박과 웃는 호박등이 놓여 있고, 천장에서 물방울이 똑똑 떨어진다. 어디선가 서늘한 바람 소리가 난다.',
      entries: {
        start: { pos: [0, 4.8], look: [0, 1.6, -6] },
        fromCandle: { pos: [-4.4, 0], look: [0, 1.6, -6] },
        fromVault: { pos: [4.4, 0], look: [0, 1.6, -6] },
      },
      decor: [
        ['dungeon', 'stairs', [0, 0, 7.5], Math.PI, 0.36],                           // 이어지는 여정: 묘지(스테이지 3)에서 내려온 계단
        ['dungeon', 'pillar', [-4.6, 0, -4.6], 0, 0.6],
        ['dungeon', 'pillar', [4.6, 0, -4.6], 0, 0.6],
        ['dungeon', 'pillar', [-4.6, 0, 4.6], 0, 0.6],
        ['dungeon', 'pillar', [4.6, 0, 4.6], 0, 0.6],
        ['dungeon', 'banner_red', [-5.1, 0.4, -5.95], 0, 0.6],
        ['dungeon', 'banner_red', [5.1, 0.4, -5.95], 0, 0.6],
        ['halloween', 'coffin', [-3.6, 0, 2.6], Math.PI / 2, 0.7],
        ['halloween', 'candle_triple', [-2.4, 0, 3.6], 0, 1.4],
        ['halloween', 'pumpkin_orange_small', [3.4, 0, 3], 0.5, 1.2],
        ['dungeon', 'barrel_small_stack', [4.8, 0, 2.4], 0.3],
        ['halloween', 'pumpkin_orange_jackolantern', [2.6, 0, 1.4], -0.5, 0.7],     // 장식(전에는 한눈팔기 오브젝트였는데, 한별이 너무 집착해서 풍경으로 바꿈)
      ],
    },
    candle: {
      name: '촛불 회랑',
      env: crypt({ w: 8, d: 10, openings: { east: [{ x: 0, w: 1.6, h: 2.6 }] } }),
      // 해골·호박·관·뼈가 있다는 것만 말하고 위치는 쓰지 않는다(쓰면 촛대 순서를 AI가 혼자 맞힌다)
      scenery: '해골, 커다란 호박, 관, 뼈 무더기 같은 으스스한 장식이 여기저기 놓인 좁은 회랑. 촛농 냄새가 난다.',
      entries: { fromHall: { pos: [2.6, 0], look: [-4, 1.2, 0] } },
      decor: [
        ['halloween', 'skull', [-3.3, 0, -4.2], 0.5, 1.4],                        // 촛대 옆 표식: 해골
        ['halloween', 'pumpkin_orange', [2.4, 0, -4.3], -0.4, 1.4],              // 호박
        ['halloween', 'coffin', [-3.3, 0, 1.6], Math.PI / 2, 0.8],                // 관
        ['halloween', 'ribcage', [-1.3, 0.3, 4.2], 0.4, 1.3],                     // 뼈 무더기
        ['halloween', 'bone_A', [-0.4, 0.1, 4.4], 1.2, 1.5],
        ['halloween', 'bone_B', [-2, 0.1, 3.7], 0.3, 1.5],
        ['dungeon', 'pillar', [3.4, 0, -4.4], 0, 0.5],
        ['dungeon', 'pillar', [3.4, 0, 4.4], 0, 0.5],
      ],
    },
    vault: {
      name: '보물 창고',
      checkpoint: false,                            // 위험 구역: 죽으면 대전당 동쪽 입구에서 다시
      env: crypt({ w: 8, d: 8, openings: { west: [{ x: 0, w: 1.6, h: 2.6 }] } }),
      scenery: '동전 더미와 선반, 상자가 쌓인 창고. 금빛이 번쩍거린다.',
      entries: { fromHall: { pos: [-2.6, 0], look: [4, 0.6, 0] } },
      decor: [
        ['dungeon', 'coin_stack_large', [3.2, 0, -3], 0.4, 0.6],
        ['dungeon', 'coin_stack_medium', [3.3, 0, 0.6], 1.1, 0.7],
        ['dungeon', 'shelf_large', [0, 0, -3.8], 0, 0.7],
        ['dungeon', 'barrel_small', [-3.2, 0, 3.2]],
        ['dungeon', 'box_stacked', [-3.2, 0, -3.1], 0.3, 0.7],
        ['halloween', 'skull', [2.2, 0, 3.4], 2.4, 0.8],
      ],
    },
    escape: {
      name: '무너지는 탈출로',
      wander: false,
      env: crypt({ w: 7, d: 24, h: 3.6, openings: { north: [{ x: 0, w: 1.6, h: 2.6, glow: 0xfff3d0 }], west: [{ x: 2, w: 2.2, h: 2.6, glow: 0x2e2620 }], east: [{ x: -6, w: 2.2, h: 2.6, glow: 0x2e2620 }] } }),
      aiNote: '좁은 지하 통로에 커다란 통이 주기적으로 굴러 내려온다. 통로 가운데에 있다가 통이 지나가면 맞고 쓰러진다. 양쪽 벽의 움푹 들어간 벽감 안은 안전하다. 너는 무서워서 시청자가 출발 신호를 주면 한 칸씩 움직이는 편이다.',
      hazard: { model: BARREL, from: -11.5, to: 8, x: 0, lane: 4.6, radius: 1.1, lift: 1.08, speed: 10, period: 11, warn: 2, delay: 6,
        warnText: '⚠ 덜컹덜컹… 통이 굴러온다!', reason: '통로 한가운데서 굴러온 통에 부딪혀 쓰러졌다' },
      entries: { start: { pos: [0, 10.2], look: [0, 1.4, -12] } },
      decor: [
        ['dungeon', 'torch_mounted', [-3.4, 2, 6], Math.PI / 2],
        ['dungeon', 'torch_mounted', [3.4, 2, -2], -Math.PI / 2],
        ['dungeon', 'rubble_half', [2.4, 0, 9.6], -0.4, 0.4],
        ['dungeon', 'barrel_small', [-2.8, 0, 9.4]],
      ],
    },
  },

  objects: [
    // ── 대전당 ──
    {
      id: 'gate', area: 'hall', name: '철창문', sinkWhen: 'gateOpen', sinkDepth: -3.3,
      model: { pack: 'dungeon', name: 'wall_gated', scale: 0.8 },
      pos: [0, 0, -5.95], stand: [0, -4.4], look: [0, 1.6, -6],
      desc: [['gateOpen', '정면의 철창문. 위로 올라가 열려 있다'], ['unlocked', '정면의 커다란 철창문. 자물쇠는 풀렸지만 철창이 내려와 있다'], '정면의 커다란 철창문. 해골 모양 자물쇠가 달려 있다'],
    },
    {
      id: 'lever', area: 'hall', name: '레버', kind: 'lever', downWhen: 'gateOpen', shinyWhen: 'oiled',
      pos: [2.4, 1.25, -5.95], rotY: -Math.PI / 2, stand: [2.4, -4.6], look: [2.4, 1.3, -6],
      desc: [['gateOpen', '철창문 오른쪽 벽의 레버. 내려가 있다'], ['oiled', '철창문 오른쪽 벽의 레버. 기름칠이 되어 반들반들하다'], '철창문 오른쪽 벽에 붙은 녹슨 레버'],
    },
    {
      id: 'plaque', area: 'hall', name: '명판', kind: 'sign',
      label: { text: '💀 ➜ 🎃 ➜ ⚰️ ➜ 🦴', wall: true, y: 1.95, w: 2.3, h: 0.8, bg: '#2a2622', color: '#f3e3c3', board: 0x6d5a3a },
      clue: '촛불 회랑의 촛대를 켜는 순서(해골 → 호박 → 관 → 뼈). 대전당 북쪽 벽 왼쪽에 걸려 있어서, 회랑에서는 보이지 않는다. 한별도 읽지만, 회랑의 어느 촛대가 무엇 옆인지는 모른다.',
      pos: [-3.1, 0, -5.95], stand: [-3.1, -4.2], look: [-3.1, 2.0, -6],
      desc: '철창문 왼쪽 벽에 걸린 낡은 명판. 해골 → 호박 → 관 → 뼈 그림이 화살표로 이어져 있다(무언가의 순서 같다)',
      poke: '명판에 해골 → 호박 → 관 → 뼈 그림이 새겨져 있다. 무슨 순서일까?',
    },
    { id: 'westPass', area: 'hall', name: '서쪽 통로', kind: 'spot', solid: false, exit: 'candle@fromHall', pos: [-5.9, 0, 0], stand: [-5.2, 0], look: [-7, 1.3, 0], desc: '왼쪽 벽의 통로. 안쪽에서 촛불 냄새가 난다' },
    { id: 'eastPass', area: 'hall', name: '동쪽 통로', kind: 'spot', solid: false, exit: 'vault@fromHall', pos: [5.9, 0, 0], stand: [5.2, 0], look: [7, 1.3, 0], desc: '오른쪽 벽의 통로. 안쪽이 금빛으로 번쩍인다' },

    // ── 촛불 회랑 ──
    // 방향은 대전당에서 들어와 서쪽(-x)을 바라본 기준. 무엇 옆인지는 주석에만 적는다(AI에게는 위치만)
    candle('candleFarRight', '오른쪽 안쪽 촛대', [-2.5, 0, -3.6], [-2.1, -2.4], 'c1', '오른쪽 맨 안쪽 구석의 꺼진 촛대'),   // 해골 옆
    candle('candleNearRight', '오른쪽 앞 촛대', [1.6, 0, -3.7], [1.4, -2.5], 'c2', '들어와서 바로 오른쪽 벽 앞의 꺼진 촛대'),   // 호박 옆
    candle('candleFar', '정면 안쪽 촛대', [-2.4, 0, 0.4], [-1.4, 0.4], 'c3', '정면 맨 안쪽 벽 앞의 꺼진 촛대'),               // 관 옆
    candle('candleLeft', '왼쪽 촛대', [0.2, 0, 3.4], [0.4, 2.2], 'done', '왼쪽 벽 앞의 꺼진 촛대'),                           // 뼈 옆
    {
      id: 'chest', area: 'candle', name: '돌 상자', kind: 'chest', openWhen: 'done',
      model: { pack: 'dungeon', name: 'chest', scale: 0.55 }, rotY: Math.PI / 2,
      pos: [-0.6, 0, -1.2], stand: [0.6, -1.2], look: [-0.6, 0.4, -1.2],
      desc: [['done', '회랑 가운데의 열린 상자'], '회랑 가운데의 굳게 닫힌 상자'],
      poke: '상자 뚜껑이 꿈쩍도 하지 않는다. 촛불과 관계가 있을까?',   // 열리기 전에만 쓰인다(열린 뒤에는 아래 규칙)
    },
    {
      id: 'key', area: 'candle', name: '해골 열쇠', showIf: ['done', '!keyTaken'],
      model: { pack: 'dungeon', name: 'key', scale: 0.7 }, rotY: 0.4,
      pos: [-0.6, 0.45, -1.2], stand: [0.6, -1.2], look: [-0.6, 0.4, -1.2], solid: false,
      fx: { sparkle: {}, glow: { color: 0xe8e0ff, intensity: 1.5 } },
      desc: '열린 상자 안에 든 해골 장식 열쇠',
    },
    { id: 'backFromCandle', area: 'candle', name: '대전당으로 가는 통로', kind: 'spot', solid: false, exit: 'hall@fromCandle', pos: [3.9, 0, 0], stand: [3.3, 0], look: [5, 1.3, 0], desc: '오른쪽, 대전당으로 돌아가는 통로' },

    // ── 보물 창고(위험) ──
    {
      id: 'goldChest', area: 'vault', name: '황금 상자', kind: 'chest',
      model: { pack: 'dungeon', name: 'chest_gold', scale: 0.6 }, rotY: -Math.PI / 2,
      pos: [2.2, 0, -1], stand: [1, -1], look: [2.2, 0.4, -1],
      fx: { glow: { color: 0xffd65a, intensity: 3 }, sparkle: {} },
      desc: '안쪽에서 번쩍번쩍 빛나는 커다란 황금 보물 상자',
    },
    {
      id: 'oil', area: 'vault', name: '빨간 통', showIf: '!oilTaken',
      model: { pack: 'proto', name: 'Can_A', tint: 0xd8433a }, pos: [2.4, 0, 1.6], stand: [1.3, 1.6], look: [2.4, 0.3, 1.6], solid: false,
      desc: '황금 상자 옆 바닥에 놓인 작은 빨간 통',
    },
    { id: 'backFromVault', area: 'vault', name: '대전당으로 가는 통로', kind: 'spot', solid: false, exit: 'hall@fromVault', pos: [-3.9, 0, 0], stand: [-3.3, 0], look: [-5, 1.3, 0], desc: '왼쪽, 대전당으로 돌아가는 통로' },

    // ── 탈출로 ──
    { id: 'nook1', area: 'escape', name: '첫 번째 벽감', kind: 'spot', solid: false, pos: [-3.3, 0, 2], stand: [-3, 2], look: [0, 1.3, 4.5], desc: '왼쪽 벽의 움푹 들어간 벽감(가까운 쪽)' },
    { id: 'nook2', area: 'escape', name: '두 번째 벽감', kind: 'spot', solid: false, pos: [3.3, 0, -6], stand: [3, -6], look: [0, 1.3, -3.5], desc: '오른쪽 벽의 움푹 들어간 벽감(먼 쪽)' },
    { id: 'exitDoor', area: 'escape', name: '출구', kind: 'spot', solid: false, pos: [0, 0, -11.9], stand: [0, -11.2], look: [0, 1.3, -13], desc: '통로 맨 끝, 바깥 빛이 새어 들어오는 출구' },
  ],

  enemies: {
    guard: { model: { pack: 'skeleton', name: 'Skeleton_Warrior' }, spawn: [3.2, -3] },
  },

  rules: [
    // 대전당: 철창은 자물쇠(열쇠) + 레버(기름칠) 둘 다
    { target: 'gate', on: 'use', item: '해골 열쇠', if: '!unlocked', do: ['set:unlocked', 'take:해골 열쇠', 'checkpoint'], say: '해골 열쇠를 꽂아 돌리자 철창의 자물쇠가 철컥 풀렸다. 철창은 아직 내려와 있다' },
    { target: 'gate', if: 'gateOpen', do: ['goto:escape@start'], say: '올라간 철창 아래로 지나 어두운 통로로 들어섰다' },
    { target: 'gate', if: 'unlocked', say: '자물쇠는 풀렸지만 철창이 무거워서 손으로는 안 올라간다' },
    { target: 'gate', say: '철창문이 굳게 닫혀 있다. 해골 모양 자물쇠가 달려 있다' },
    { target: 'lever', on: 'use', item: '기름통', if: '!oiled', do: ['set:oiled', 'take:기름통', 'checkpoint'], say: '녹슨 레버에 기름을 듬뿍 발랐다. 이제 움직일 것 같다' },
    { target: 'lever', if: 'gateOpen', say: '레버는 이미 내려가 있다' },
    { target: 'lever', if: ['oiled', 'unlocked'], do: ['set:gateOpen', 'checkpoint'], say: '레버를 당기자 끼기기긱… 철창문이 천천히 위로 올라갔다!' },
    { target: 'lever', if: 'oiled', say: '레버가 반쯤 내려가다 덜컥 걸렸다. 철창의 해골 자물쇠가 아직 잠겨 있다' },
    { target: 'lever', say: '레버가 녹슬어서 꿈쩍도 하지 않는다' },

    // 촛불 회랑: 해골(오른쪽 안쪽) → 호박(오른쪽 앞) → 관(정면 안쪽) → 뼈(왼쪽). 틀리면 전부 꺼진다
    // 켜기: 만지기(interact)든 아이템 쓰기(use, 예: "기름으로 불 붙여")든 같은 결과. 아이템은 닳지 않는다
    // 결과 문장도 위치로만 말한다(해골·호박 같은 표식을 말하면 AI가 짝을 알아채 혼자 푼다)
    { target: 'candleFarRight', on: ['interact', 'use'], if: ['!c1', '!done'], do: ['set:c1'], say: '오른쪽 안쪽 촛대에 불을 붙였다. 화르륵' },
    { target: 'candleNearRight', on: ['interact', 'use'], if: ['c1', '!c2'], do: ['set:c2'], say: '오른쪽 앞 촛대에 불을 붙였다. 화르륵' },
    { target: 'candleFar', on: ['interact', 'use'], if: ['c2', '!c3'], do: ['set:c3'], say: '정면 안쪽 촛대에 불을 붙였다. 화르륵' },
    { target: 'candleLeft', on: ['interact', 'use'], if: ['c3', '!done'], do: ['set:done', 'checkpoint'], say: '마지막 촛대에 불을 붙이자 덜컹! 가운데 돌 상자의 뚜껑이 열렸다' },
    { target: CANDLES, on: ['interact', 'use'], if: 'done', say: '촛불이 모두 켜져 있다' },
    // puff: 고른 촛대에 불이 잠깐 붙었다가(화면 연출) 모두 함께 꺼진다. 오답이어도 "불은 붙었는데 꺼졌다"가 보인다
    { target: CANDLES, on: ['interact', 'use'], do: ['puff', 'unset:c1', 'unset:c2', 'unset:c3'], say: '불이 화르륵 붙자마자 휘잉~ 바람이 불어 촛불이 모두 꺼졌다. 순서가 틀렸나 보다' },
    { target: ['key', 'chest'], on: ['pickup', 'interact', 'use'], if: ['done', '!keyTaken'], do: ['set:keyTaken', 'give:key'], say: '상자 안의 해골 열쇠를 주웠다' },
    { target: 'chest', on: 'any', if: 'done', say: '열린 상자다. 안은 이제 비어 있다' },

    // 보물 창고: 기름통은 챙기고, 황금 상자는 함정
    { target: 'oil', on: ['pickup', 'interact'], do: ['set:oilTaken', 'give:oil'], say: '빨간 통을 주웠다. 기름통이다' },
    { target: 'goldChest', on: 'any', do: ['enemy:guard', 'die:황금 상자에 손을 대는 순간 해골 기사가 튀어나와 한 대 맞고 쓰러졌다'], say: '황금 상자를 건드리자 해골 기사가 튀어나왔다' },

    // 탈출로
    { target: ['nook1', 'nook2'], on: ['move', 'interact'], say: '벽감 안에 쏙 숨었다. 여기는 안전하다' },
    { target: 'exitDoor', on: ['move', 'interact'], do: ['clear'], say: '출구로 뛰쳐나왔다! 지하 대전당 탈출 성공!' },
  ],

  viewers: {
    troll: 2, helper: 1,
    script: [
      { role: 'troll', when: 'area:vault', delay: 5, text: '황금 상자 열어 ㅋㅋㅋ 무조건 보물임', dona: 5000 },
      { role: 'troll', when: 'area:candle', delay: 9, text: '왼쪽 촛대부터 켜는 거임 ㅋㅋ 딱 봐도 그게 1번' },
      { role: 'helper', when: ['area:hall', '!unlocked', 'oiled'], delay: 25, text: '철창에 자물쇠도 있던데 열쇠 필요한 듯' },
      { role: 'helper', when: ['area:hall', '!oiled', 'unlocked'], delay: 25, text: '레버가 녹슬었으면 기름 같은 거 없나?' },
      { role: 'troll', when: 'area:escape', delay: 7, text: '벽감 숨지 말고 그냥 끝까지 달려 ㅋㅋ', dona: 3000 },
    ],
  },

  tutorial: [
    { on: '@start', cards: [
      { art: 'finale', title: '마지막 스테이지', text: '지금까지 배운 걸 모두 써야 해. 단서는 다른 방에 있을 수도 있어. 한별은 단서를 읽어도 그게 어디인지 모르니, 위치는 네가 알려 줘!' },
    ] },
  ],

  solution: [
    { type: 'move', target: 'westPass' },
    { type: 'interact', target: 'candleFarRight' }, { type: 'interact', target: 'candleNearRight' }, { type: 'interact', target: 'candleFar' }, { type: 'interact', target: 'candleLeft' },
    { type: 'pickup', target: 'key' },
    { type: 'move', target: 'backFromCandle' },
    { type: 'move', target: 'eastPass' },
    { type: 'pickup', target: 'oil' },
    { type: 'move', target: 'backFromVault' },
    { type: 'use', target: 'lever', item: '기름통' },
    { type: 'use', target: 'gate', item: '해골 열쇠' },
    { type: 'interact', target: 'lever' },
    { type: 'move', target: 'gate' },
    { type: 'move', target: 'nook1' }, { type: 'move', target: 'nook2' },
    { type: 'move', target: 'exitDoor' },
  ],
  tests: [
    { name: '촛불 순서가 틀리면 다 꺼진다', actions: [{ type: 'move', target: 'westPass' }, { type: 'interact', target: 'candleFarRight' }, { type: 'interact', target: 'candleFar' }], expect: { flag: ['!c1', '!c3'] } },
    { name: '기름칠만 하고 자물쇠를 안 풀면 철창이 안 열린다', actions: [{ type: 'move', target: 'eastPass' }, { type: 'pickup', target: 'oil' }, { type: 'move', target: 'backFromVault' }, { type: 'use', target: 'lever', item: '기름통' }, { type: 'interact', target: 'lever' }], expect: { flag: ['oiled', '!gateOpen'] } },
    { name: '황금 상자는 먼저 다가가기만 한다', actions: [{ type: 'move', target: 'eastPass' }, { type: 'interact', target: 'goldChest' }], expect: { dead: false, area: 'vault' } },
    { name: '황금 상자 앞에서 손대면 죽고 대전당에서 다시', actions: [{ type: 'move', target: 'eastPass' }, { type: 'move', target: 'goldChest' }, { type: 'interact', target: 'goldChest' }], expect: { dead: true, area: 'hall' } },
  ],
};
