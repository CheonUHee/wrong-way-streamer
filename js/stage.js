/* 스테이지 데이터와 게임 규칙. AI가 고른 행동을 실제로 실행하는 곳 */
import { $, inv, gain, removeItem, renderInv } from './ui.js';
import * as view from './view2d.js';

/* ── 미니 스테이지(3D 화면 대신 쓰는 임시 규칙) ──
   정답 순서: 빨간 통(기름통) 줍기 → 레버에 사용 → 레버 당기기 → 문으로 나가기.
   반짝이는 상자와 고양이 인형은 한눈팔기용이다. */
export const STAGE = {
  goal: '문을 열고 방에서 나가기',
  start: { x: 50, y: 66 },
  objects: [
    { id: 'door',  cls: 'door',  icon: '',    x: 44, y: 26, w: 9, h: 30 },
    { id: 'lever', cls: 'lever', icon: '🕹️', x: 24, y: 44, w: 5, h: 12 },
    { id: 'oil',   cls: 'oil',   icon: '🛢️', x: 10, y: 32, w: 5, h: 8 },
    { id: 'box',   cls: 'box',   icon: '✨',  x: 64, y: 46, w: 7, h: 11 },
    { id: 'cat',   cls: 'cat',   icon: '🐱',  x: 82, y: 30, w: 6, h: 10 },
  ],
};
export const NAME = { door: '문', lever: '레버', oil: '빨간 통', box: '상자', cat: '고양이 인형' };
export let G;
export const DESC = {                      // AI에게 전달되는 '화면에 보이는 모습'
  door:  () => G.doorOpen ? '정면 벽의 나무 문. 활짝 열려 있다' : '정면 벽의 커다란 나무 문. 닫혀 있다',
  lever: () => G.doorOpen ? '왼쪽 벽의 금속 레버. 아래로 내려가 있다' : '왼쪽 벽에 붙은 금속 레버',
  oil:   () => '왼쪽 구석 선반 위의 작은 빨간 통',
  box:   () => G.boxOpened ? '뚜껑이 열린 빈 상자' : '바닥에서 금빛으로 반짝반짝 빛나는 상자',
  cat:   () => '오른쪽 구석에서 혼자 흔들흔들 춤추는 고양이 인형',
};
export const visible = () => STAGE.objects.filter(o => !(o.id === 'oil' && G.oilTaken));
const renderScene = () => view.render(G, visible());
export function resetStage() {
  G = { doorOpen: false, oiled: false, boxOpened: false, oilTaken: false, cleared: false, at: null, seen: new Set(), last: '방송을 막 시작했다', history: [], autoTurns: 0 };
  inv.length = 0; renderInv(); renderScene(); view.moveTo(STAGE.start);
  $('goal').textContent = STAGE.goal;
}
// AI가 고른 행동을 게임 규칙에 따라 실행하고, 결과 문장을 돌려준다(다음 호출 때 AI에게 전달).
export function perform(a) {
  const o = visible().find(v => v.id === a.target);
  if (a.type === 'idle' || !o) return '제자리에 서 있다';
  view.moveTo(o); G.at = o.id; G.seen.add(o.id);
  const has = n => inv.some(i => i[1] === n);
  let r, fx = () => {};
  if (a.type === 'move') r = `${NAME[o.id]} 앞으로 갔다`;
  else if (a.type === 'use') {
    if (!a.item || !has(a.item)) r = '그런 아이템은 갖고 있지 않다';
    else if (a.item === '기름통' && o.id === 'lever' && !G.oiled) { G.oiled = true; fx = () => removeItem('기름통'); r = '레버에 기름을 발랐다. 이제 부드럽게 움직일 것 같다'; }
    else r = `${a.item}을(를) ${NAME[o.id]}에 써 봤지만 아무 일도 일어나지 않았다`;
  }
  else if (o.id === 'oil') { G.oilTaken = true; fx = () => gain('oil'); r = '빨간 통을 주웠다. 기름통이다'; }
  else if (a.type === 'pickup') r = `${NAME[o.id]}은(는) 주울 수 없다`;
  else if (o.id === 'door') {
    if (G.doorOpen) { G.cleared = true; r = '열린 문으로 나갔다. 스테이지 클리어!'; }
    else r = '문을 밀어 봤지만 잠겨 있어 꿈쩍도 하지 않는다';
  }
  else if (o.id === 'lever') {
    if (G.doorOpen) r = '레버는 이미 내려가 있다';
    else if (G.oiled) { G.doorOpen = true; r = '레버가 철컥 내려가고, 정면의 문이 열렸다'; }
    else r = '레버를 당겨 봤지만 녹슬어서 꿈쩍도 하지 않는다';
  }
  else if (o.id === 'box') {
    if (G.boxOpened) r = '빈 상자다';
    else { G.boxOpened = true; fx = () => gain('coin'); r = '상자를 열었더니 낡은 동전이 하나 들어 있었다'; }
  }
  else r = '인형이 야옹 소리를 내며 더 신나게 춤춘다. 그것뿐이다';
  setTimeout(() => { fx(); renderScene(); }, 1000);     // 캐릭터가 걸어간 뒤에 화면 반영
  return r;
}
