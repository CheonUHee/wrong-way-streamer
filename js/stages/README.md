# 스테이지 데이터 형식

스테이지 하나는 이 폴더의 `.js` 파일 하나다. 코드를 고치지 않고 데이터만으로 맵·기믹·적·클리어 조건을 정한다.
새 스테이지는 `index.js`의 `STAGES` 배열에 넣으면 순서대로 진행된다.

- 예제: `stage1.js`(방 하나, 아이템 퍼즐), `demo.js`(여러 구역, 플레이어만 보는 단서, 스켈레톤·사망·재시작)
- 실행: `http://localhost:8080/?stage=2` (순번) · `?stage=demo` (id)
- 개발용 옵션: `?ai=off` (키가 있어도 더미 응답) · `?auto=off` (스트리머가 스스로 움직이지 않음)
- 검증: `node tools/validate.mjs [id] [--write]`

## 최상위

| 키 | 설명 |
|---|---|
| `id`, `title`, `goal` | 식별자, 방송 정보에 뜨는 이름, 화면 좌상단 목표 |
| `start` | `{ area, entry }` 시작 구역과 입구 |
| `items` | `{ 키: { icon, name } }` 아이템. 규칙에서 `give:키`로 주고, `take:이름`으로 가져간다 |
| `areas` | 구역들(아래) |
| `objects` | AI가 상호작용할 수 있는 오브젝트들(아래) |
| `enemies` | `{ id: { model, spawn: [x, z] } }` 규칙의 `enemy:id`로 등장 |
| `rules` | 상호작용 규칙(아래) |
| `flags` | 시작할 때 켜 둘 플래그(선택) |
| `viewers` | 다른 시청자(방해꾼·조력자) 설정(아래, 선택) |
| `solution`, `tests` | 검증용 정답 경로와 시나리오 |

## 구역(areas)

한 번에 구역 하나만 화면에 만든다. 통로로 넘어가면 화면이 어두워졌다가 다음 구역이 나타난다.
좌표는 구역 중심이 (0, 0)이고 단위는 m, 정면(북쪽)이 -z다.

```js
room: {
  name: '아늑한 방',
  checkpoint: false,              // 선택: 위험 구역. 여기서 죽으면 마지막으로 들른 안전한 구역에서 다시 시작
  env: {
    kind: 'room' | 'outdoor',
    w: 10, d: 10, h: 3.5,         // 크기(야외는 h 없음)
    floor: { pack, name },        // room: 바닥 타일 모델(선택)
    ground: 0x4f6b45, sky: 0x1d1b33, border: 'fence', dim: true,   // outdoor
    openings: { north: [{ x: 0, w: 1.28, h: 2.24 }] },            // 벽·울타리에 비울 자리(문·아치 위치)
  },
  entries: { start: { pos: [x, z], look: [x, y, z] } },           // 들어왔을 때 서는 곳과 보는 곳
  decor: [[pack, name, [x, y, z], rotY, scale]],                  // 배경 소품. AI에게 알리지 않는다
}
```

## 오브젝트(objects)

```js
{
  id: 'box', area: 'room', name: '상자',
  kind: 'door' | 'gate' | 'lever' | 'chest' | 'sign',   // 생략하면 모델 하나
  model: { pack, name, scale, tint, offset, rotY },
  pos: [x, y, z], rotY, stand: [x, z], look: [x, y, z],  // 위치, 설 자리, 바라보는 지점
  solid: false,                       // 걸어갈 때 피하지 않음(작은 물건·통로)
  desc: [['boxOpened', '열린 상자'], '반짝이는 상자'],     // AI가 받는 묘사. [조건, 문장] 중 처음 맞는 것
  showIf: '!oilTaken',                // 조건이 맞을 때만 존재(주우면 사라지는 물건)
  exit: 'area@entry',                 // 통로: 가거나 만지면 그 구역으로 이동
  openWhen / downWhen / shinyWhen,    // 문·상자·철문이 열림 / 레버 내려감 / 레버 기름칠
  label: { text: '☠ ➜' }, clue: '...',   // sign 그림(플레이어만 봄)과 그 의도 메모
  fx: { glow: { color, intensity, offWhen }, sparkle: { offWhen }, anim: 'dance' | 'bob' | 'spin' },
  poke: '만졌을 때 기본 반응 문장',
}
```

## 규칙(rules)

위에서부터 처음 맞는 규칙 하나가 실행된다. 맞는 규칙이 없으면 기본 문장("~ 앞으로 갔다", "~은 주울 수 없다")이 나온다.

```js
{ target: 'lever', on: 'use', item: '기름통', if: '!oiled',
  do: ['set:oiled', 'take:기름통'], say: '레버에 기름을 발랐다' }
```

- `on`: `interact`(기본. 단, `clear`·`goto`를 일으키는 규칙은 `move`에도 반응한다 — "나가"라고 하면 AI가 대개 이동을 고르므로) · `move` · `pickup` · `use` · `any`, 또는 배열
- `if`: `flag` · `!flag` · `has:아이템이름` · `at:오브젝트id` · `area:구역id` · `dead:N`(N번 이상 죽음), 또는 배열(모두 만족)
- `do`: `set:플래그` · `unset:플래그` · `give:아이템키` · `take:아이템이름` · `goto:구역@입구` · `enemy:적id` · `die:사유` · `clear`
- `say`: 결과 문장. 다음 턴에 AI에게 그대로 전달되므로, 무슨 일이 일어났는지 분명히 쓴다

## 다른 시청자(viewers)

방해꾼·조력자의 말은 화면에 뜨는 것에 그치지 않고 스트리머에게 실제로 전달되어 플레이어의 훈수와 경쟁한다(API 추가 호출 없음, `js/viewers.js`).

```js
viewers: {
  troll: 1,     // 0~3. 방해꾼 즉흥 대사 빈도, 플레이어 훈수를 받아칠 확률, 후원으로 끼어들 확률
  helper: 1,    // 0~3. 조력자 즉흥 대사 빈도, 플레이어 말에 맞장구칠 확률
  script: [     // 상황 대본: when 조건이 delay초 이어지면 한 번 나온다. dona가 있으면 후원으로
    { role: 'troll', when: ['area:gate', '!keyTaken'], delay: 8, text: '오른쪽 길 금화 보임?', dona: 5000 },
  ],
}
```

- 방해꾼 즉흥 대사는 함정(규칙에 `die`·`enemy`가 있거나 위험 구역으로 가는 통로) → 눈길 끄는 물건 순으로 대상을 고른다.
- 채팅은 채팅창이 붐빌수록 스트리머가 놓친다(최소 35%는 읽음). 후원은 반드시 읽고, 후원끼리 부딪치면 **가장 나중 후원**을 따른다.
- 플레이어 채팅 옆에 `👀 읽음` / `💨 놓침`이 표시된다.

## 스트리머의 자율 행동(API 추가 호출 없음)

- 배회: AI가 시킨 일 없이 7~12초 서 있으면 배경 소품 앞이나 구역 귀퉁이 쪽으로 걸어가 둘러본다. 배회 지점은 `decor`와 구역 크기로 자동 생성되므로 소품을 고르게 배치할수록 동선이 넓어진다.
- 시선 뺏기: 3.2m 안에 `fx`(glow·sparkle·anim)가 있는 오브젝트가 있으면 고개를 돌리고, 다음 AI 호출에 "방금 눈에 띈 것"으로 전달한다. 한눈팔기 오브젝트는 정답 동선 가까이에 두면 효과가 크다.
- AI 행동 `explore`: "둘러봐" 같은 지시를 받으면 배회 한 걸음을 한다.

## 검증(solution, tests)

```js
solution: [{ type: 'pickup', target: 'oil' }, ...],
tests: [{ name: '금화에 다가가면 죽는다', actions: [...], expect: { dead: true, cleared: false, area: 'gate', flag: ['!gateOpen'] } }],
```

검증 도구는 이것 외에도 모든 행동 조합을 따라가 보며 "클리어 불가능한 막다른 상태"와 "사망으로 이어지는 행동"을 찾아 준다.

## 에셋 팩 이름(pack)

`dungeon` · `forest` · `furniture` · `halloween` · `proto` · `bath` · `skeleton`
경로는 `js/packs.js`. KayKit 모델은 기본 0.8배(`S`)로 쓴다. Forest 팩의 덤불·풀은 크기가 작아 3배 정도 키워야 한다.
