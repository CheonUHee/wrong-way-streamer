/* 다른 시청자들(API 호출 없음). 세 유형으로 나눈다.
   - 방해꾼(troll): 오답·함정·딴짓 쪽으로 유도한다. 플레이어가 훈수하면 반대로 받아치고, 레벨이 높으면 후원으로 끼어든다.
   - 조력자(helper): 정답 쪽 힌트를 주거나 플레이어 말에 맞장구친다. 가끔 틀린다.
   - 구경꾼(crowd): 반응만 한다. ui.js의 일반 채팅 + Gemini가 만드는 시청자 채팅(viewers).
   방해꾼·조력자의 말은 스트리머에게 실제로 전달되어(대기열) 플레이어의 훈수와 경쟁한다.

   스테이지 데이터:
   viewers: {
     troll: 0~3, helper: 0~3,                     // 즉흥 대사·후원의 빈도(난이도 손잡이). 기본 1
     script: [{ role, when, text, dona, delay }],  // 상황 대본. when 조건이 맞고 delay초 지나면 한 번 나온다
   } */
import { addLine, donate, esc, pick } from './ui.js';
import { all, objectsIn } from './core.js';
import { isPaused, isTest } from './pause.js';
import * as tutorial from './tutorial.js';
import { flag } from './env.js';

export const ROLES = {
  troll:  { nicks: ['훈수빌런', '방해꾼999', 'ㅋㅋ장인', '반대로가'], color: '#ff7ab8' },
  helper: { nicks: ['퍼즐장인', '길잡이', '정답요정'], color: '#9be36b' },
};
const TROLL_GAP = [0, 50, 30, 18], HELPER_GAP = [0, 60, 40, 25];   // 레벨별 즉흥 대사 간격(초)
const COUNTER = [0, 0.25, 0.45, 0.65];                             // 플레이어 훈수에 방해꾼이 받아칠 확률
const DONA_RATE = [0, 0.1, 0.3, 0.5];                              // 방해꾼이 채팅 대신 후원으로 말할 확률

let stage, getState, enqueue, fired = new Set(), armed = {}, nextTroll = 0, nextHelper = 0, lastCounter = -99;
let clockT = 0; setInterval(() => { if (!isPaused()) clockT += 0.25; }, 250);
const now = () => clockT;   // 일시정지를 뺀 시간(초)
const lv = role => stage?.viewers?.[role] ?? 1;

// main.js가 연결한다: 스트리머 대기열에 넣는 함수
export function connect(fn) { enqueue = fn; }
// 스테이지가 바뀌면 대본 진행을 처음부터
export function reset(st, stateFn) {
  stage = st; getState = stateFn; fired = new Set(); armed = {};
  nextTroll = now() + TROLL_GAP[lv('troll')] * (0.5 + Math.random() * 0.5);
  nextHelper = now() + HELPER_GAP[lv('helper')] * (0.6 + Math.random() * 0.6);
}

// 한 명의 시청자가 말한다(채팅 또는 후원). 스트리머에게도 전달된다.
// 개발용: 주소에 ?viewers=off 를 붙이면 방해꾼·조력자가 말하지 않는다(자동 테스트에서 행동이 끼어들지 않게)
const OFF = flag('viewers') === 'off';
// 방해꾼 후원 사이 최소 간격(초). 후원이 몰려 플레이어가 ⚡로 맞설 틈도 없이 밀리는 것을 막는다
const TROLL_DONA_GAP = 15;
let lastTrollDona = -99;
export function speak(role, text, amount = 0) {
  if (OFF || isTest()) return;
  if (role === 'troll' && amount) {
    if (now() - lastTrollDona < TROLL_DONA_GAP) amount = 0;      // 간격이 안 됐으면 채팅으로 낮춘다
    else lastTrollDona = now();
  }
  const nick = pick(ROLES[role].nicks);
  if (amount) { donate(nick, amount, text); setTimeout(() => tutorial.check('@dona'), 1800); }
  else addLine(`<span class="nick" style="color:${ROLES[role].color}">${esc(nick)}</span>${esc(text)}`);
  enqueue?.({ kind: amount ? 'dona' : 'chat', text, nick, role, amount });
}

/* ── 즉흥 대사 ── */
const ok = () => { const s = getState?.(); return s && !s.cleared && !s.dead; };
// 스트리머를 꾀어낼 대상: 함정(규칙에 die가 있는 것) > 눈길 끄는 것(빛·반짝임·움직임) > 아무거나
function lure() {
  const s = getState(), objs = objectsIn(stage, s);
  const trap = objs.filter(o => (stage.rules || []).some(r => [].concat(r.target).includes(o.id) && [].concat(r.do || []).some(d => d.startsWith('die') || d.startsWith('enemy')))
    || (o.exit && stage.areas[o.exit.split('@')[0]]?.checkpoint === false));
  const shiny = objs.filter(o => o.fx && (o.fx.glow || o.fx.sparkle || o.fx.anim));
  // 단서(석판·명판)를 "개꿀템"이라고 꾀는 건 어색하다(Gemini 플레이테스트). 단서와 안내판은 뺀다
  // lure: false 인 것(오솔길 사이 지름길·돌아가는 길 같은 길 안내용 오브젝트)도 뺀다. "~(공터를 지나서) 개꿀템"은 어색하다
  const plain = objs.filter(o => o.kind !== 'sign' && !o.clue && o.lure !== false);
  return pick(trap.length && Math.random() < 0.6 ? trap : shiny.length ? shiny : plain.length ? plain : objs);
}
const TROLL_LINES = [n => `${n} 개꿀템 같은데 ㅋㅋ 먼저 ㄱㄱ`, n => `${n} 한 번만 만져봐 제발 ㅋㅋㅋ`, n => `야 ${n} 안 보고 가면 후회함`, n => `정답 ${n}임 ㄹㅇ 믿어봐`];
const TROLL_COUNTER = ['ㄴㄴ 그거 함정임 ㅋㅋ 반대로 가', '저 사람 말 듣지 마 ㅋㅋㅋ', '그쪽 아님 ㅋㅋ 딴 데 먼저 봐'];
const HELPER_AGREE = ['ㄹㅇ 윗분 말 맞음', '그 말대로 해봐', '오 그거 맞는 듯'];
function helperLine() {
  const s = getState();
  if (s.deaths.length && Math.random() < 0.5) return `아까 ${s.deaths.at(-1).obj} 쪽에서 죽었잖아 거기 가지 마`;
  return pick(['목표부터 다시 읽어봐', '주변에 쓸 만한 거 없나 잘 봐', '방해꾼들 말 듣지 마 ㅋㅋ', '아까 그거 써볼 데 없나?']);
}
function trollRandom(forceDona = false) {
  const o = lure(); if (!o) return;
  const dona = forceDona || Math.random() < DONA_RATE[lv('troll')];
  speak('troll', pick(TROLL_LINES)(o.name), dona ? pick([1000, 3000, 5000, 10000]) : 0);
}
export const trollNow = () => ok() && trollRandom(true);   // 프로토타입 버튼용

// 플레이어가 훈수하면: 방해꾼이 받아치거나, 조력자가 맞장구친다
export function onPlayerMessage(m) {
  if (!ok()) return;
  const t = now();
  if (t - lastCounter > 20 && Math.random() < COUNTER[lv('troll')]) {
    lastCounter = t;
    // 플레이어 후원에는 후원으로 받아치되, 플레이어 지시가 먼저 실행된 뒤에 온다(가장 나중 후원이 이기므로 바로 오면 불공평)
    const dona = m.kind === 'dona' || Math.random() < DONA_RATE[lv('troll')];
    const delay = dona ? 6000 + Math.random() * 3000 : 1500 + Math.random() * 2500;
    setTimeout(() => ok() && speak('troll', pick(TROLL_COUNTER), dona ? pick([1000, 3000, 5000]) : 0), delay);
  } else if (Math.random() < 0.2 * lv('helper')) {
    setTimeout(() => ok() && speak('helper', pick(HELPER_AGREE)), 1200 + Math.random() * 2000);
  }
}

setInterval(() => {
  if (!stage || !ok() || document.hidden || isPaused()) return;
  const s = getState(), t = now();
  // 상황 대본
  (stage.viewers?.script || []).forEach((v, i) => {
    if (fired.has(i)) return;
    if (!all(s, v.when)) { delete armed[i]; return; }
    armed[i] ??= t + (v.delay ?? 3);
    if (t >= armed[i]) { fired.add(i); speak(v.role, v.text, v.dona || 0); }
  });
  // 즉흥 대사
  if (lv('troll') && t > nextTroll) { trollRandom(); nextTroll = t + TROLL_GAP[lv('troll')] * (0.7 + Math.random() * 0.6); }
  if (lv('helper') && t > nextHelper) { speak('helper', helperLine()); nextHelper = t + HELPER_GAP[lv('helper')] * (0.7 + Math.random() * 0.6); }
}, 1000);
