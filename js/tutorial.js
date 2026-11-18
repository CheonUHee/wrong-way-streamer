/* 플레이어에게만 보이는 튜토리얼 창(게임 속 게임의 튜토리얼이 아니다).
   화면 전체를 어둡게 하고 도식 + 1~2문장 카드를 보여 준다. 닫을 때까지 게임 전체가 멈춘다(pause.js).

   스테이지 데이터:
   tutorial: [{ on: '@start' | '@ask' | '@gain' | '@dona' | '@death' | 조건, cards: [{ art, title, text }] }]
   - '@이벤트': 그 일이 처음 일어났을 때. 조건(예: 'area:hall', ['doorOpen'])은 행동이 끝난 뒤 처음 맞았을 때
   - 같은 항목은 스테이지를 한 번 진행하는 동안 한 번만 나온다 */
import { $, esc } from './ui.js';
import { setPaused } from './pause.js';
import { all } from './core.js';

/* ── 도식(SVG, 320×180) ── */
const C = { bg: '#1e2129', panel: '#16181f', line: '#3a3f4d', text: '#e8eaf0', dim: '#8b90a0', acc: '#ffe14a', me: '#6fd3ff', troll: '#ff7ab8', ok: '#7be08a', bad: '#ff6a6a' };
const svg = body => `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, 'Malgun Gothic', sans-serif">${body}</svg>`;
const screen = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#2a3350" stroke="${C.line}"/>`;
const face = (x, y, r = 16) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffe8d6" stroke="#d3e7a5" stroke-width="5"/><circle cx="${x - r * 0.35}" cy="${y}" r="2.2" fill="#3a2a4a"/><circle cx="${x + r * 0.35}" cy="${y}" r="2.2" fill="#3a2a4a"/>`;
const chatLine = (x, y, nick, color, text, w = 120) => `<rect x="${x}" y="${y}" width="${w}" height="20" rx="5" fill="${C.panel}" stroke="${C.line}"/><text x="${x + 6}" y="${y + 14}" font-size="10" fill="${color}" font-weight="700">${esc(nick)}</text><text x="${x + 8 + nick.length * 9}" y="${y + 14}" font-size="10" fill="${C.text}">${esc(text)}</text>`;
const dona = (x, y, nick, color, text, w = 130) => `<rect x="${x}" y="${y}" width="${w}" height="30" rx="6" fill="#2a2410" stroke="${color}" stroke-width="2"/><text x="${x + 8}" y="${y + 12}" font-size="9" fill="${C.acc}" font-weight="800">⚡ 후원 · ${esc(nick)}</text><text x="${x + 8}" y="${y + 25}" font-size="10" fill="${C.text}">${esc(text)}</text>`;
const arrow = (x1, y1, x2, y2, color = C.acc) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${color}" stroke-width="3" stroke-linecap="round" marker-end="url(#ah)"/>`;
const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10Z" fill="${C.acc}"/></marker></defs>`;
const bubble = (x, y, text, w = 110) => `<rect x="${x}" y="${y}" width="${w}" height="24" rx="12" fill="#fff"/><text x="${x + w / 2}" y="${y + 16}" font-size="11" fill="#14161c" font-weight="700" text-anchor="middle">${esc(text)}</text>`;

export const ART = {
  // 플레이어 = 시청자: 채팅으로 훈수하면 스트리머가 읽고 움직인다
  role: svg(defs + screen(10, 20, 190, 140) + face(170, 132) + `<rect x="20" y="70" width="40" height="60" rx="3" fill="#8a5a44"/><text x="40" y="145" font-size="9" fill="${C.dim}" text-anchor="middle">문</text>`
    + `<rect x="212" y="20" width="98" height="140" rx="8" fill="${C.panel}" stroke="${C.line}"/><text x="222" y="38" font-size="10" fill="${C.dim}">채팅</text>`
    + chatLine(218, 110, '나', C.me, '문 열어 봐!', 86) + arrow(216, 120, 192, 128)),
  // 말로 가리키기: 한별은 이름표 없이 생김새로 알아듣는다
  describe: svg(defs + screen(10, 20, 300, 110)
    + `<rect x="60" y="80" width="40" height="34" rx="4" fill="#d8433a"/><rect x="200" y="80" width="40" height="34" rx="4" fill="#4a7bd8"/>`
    + `<circle cx="80" cy="97" r="26" fill="none" stroke="${C.acc}" stroke-width="3" stroke-dasharray="5 4"/>`
    + chatLine(90, 140, '나', C.me, '빨간 상자 열어 줘', 150)),
  // 가방: 주운 아이템은 왼쪽 아래에, "○○을 △△에 써"
  bag: svg(defs + `<rect x="20" y="40" width="112" height="120" rx="10" fill="#0008" stroke="${C.line}"/><text x="30" y="58" font-size="11" fill="${C.text}" font-weight="800">🎒 가방</text>`
    + [0, 1, 2].flatMap(r => [0, 1, 2].map(c => `<rect x="${30 + c * 32}" y="${66 + r * 30}" width="28" height="26" rx="5" fill="#ffffff14" stroke="${r + c === 0 ? C.acc : '#ffffff30'}" stroke-width="${r + c === 0 ? 2 : 1}"/>`)).join('')
    + `<text x="44" y="85" font-size="14" text-anchor="middle">🗝️</text>` + arrow(140, 100, 190, 100)
    + `<rect x="196" y="60" width="44" height="80" rx="4" fill="#8a5a44"/><circle cx="232" cy="102" r="4" fill="${C.acc}"/>` + chatLine(160, 150, '나', C.me, '열쇠를 문에 써', 140)),
  // 너만 보이는 단서: 표지판·그림은 한별에게 흐릿하다
  clue: svg(defs + screen(10, 20, 140, 130) + `<rect x="40" y="50" width="80" height="44" rx="4" fill="#d9b98a"/><text x="80" y="79" font-size="18" text-anchor="middle" fill="#2a1a12" font-weight="900">GOAL ➜</text><text x="80" y="140" font-size="10" fill="${C.ok}" text-anchor="middle">👀 너의 화면</text>`
    + screen(170, 20, 140, 130) + `<rect x="200" y="50" width="80" height="44" rx="4" fill="#d9b98a" opacity=".6"/><text x="240" y="79" font-size="18" text-anchor="middle" fill="#2a1a12" opacity=".25" font-weight="900">? ? ?</text>` + face(240, 118, 13) + `<text x="240" y="146" font-size="10" fill="${C.dim}" text-anchor="middle">한별에게는 흐릿함</text>`),
  // 한별이 물어보면 대답하기
  ask: svg(defs + screen(10, 20, 190, 140) + face(170, 132) + bubble(30, 96, '어느 문으로 갈까?', 120)
    + `<rect x="212" y="20" width="98" height="140" rx="8" fill="${C.panel}" stroke="${C.line}"/>` + chatLine(218, 110, '나', C.me, '왼쪽 문!', 86) + arrow(216, 120, 154, 112)),
  // 채팅은 묻히고, 후원은 반드시 읽힌다
  dona: svg(defs + `<rect x="10" y="14" width="300" height="152" rx="8" fill="${C.panel}" stroke="${C.line}"/>`
    + chatLine(22, 28, '눈팅러', '#9bd0ff', 'ㅋㅋㅋㅋ', 130) + chatLine(22, 52, '나', C.me, '왼쪽 문 💨놓침', 130) + chatLine(22, 76, '감자튀김', '#ff9e6b', '귀엽다', 130)
    + `<text x="90" y="118" font-size="10" fill="${C.dim}" text-anchor="middle">채팅이 붐비면 묻힘</text>`
    + dona(170, 40, '나', C.me, '왼쪽 문으로 가!') + `<text x="235" y="96" font-size="10" fill="${C.ok}" text-anchor="middle" font-weight="700">✔ 반드시 읽음</text><text x="235" y="112" font-size="9" fill="${C.dim}" text-anchor="middle">대신 ⚡를 쓴다</text>`),
  // 후원끼리는 가장 나중 것을 따른다
  troll: svg(defs + dona(20, 30, '훈수빌런', C.troll, '오른쪽 문 ㄱㄱ ㅋㅋ', 150) + dona(60, 78, '나', C.me, '아니야! 왼쪽 문!', 150)
    + `<text x="248" y="98" font-size="11" fill="${C.ok}" font-weight="800">← 이걸 따름</text><text x="160" y="140" font-size="11" fill="${C.text}" text-anchor="middle">후원이 부딪치면 가장 나중 후원을 따른다</text>`),
  // 돌 굴러오는 골짜기: 숨었다가 지나가면 출발
  boulder: svg(defs + `<path d="M10,160 L310,60 L310,170 L10,170Z" fill="#5a6b40"/><circle cx="250" cy="66" r="18" fill="#8d8478" stroke="#5e574d" stroke-width="3"/>`
    + arrow(225, 82, 170, 102, C.bad) + `<rect x="120" y="96" width="26" height="30" rx="4" fill="#2a2a24"/>` + face(133, 112, 9)
    + `<text x="133" y="148" font-size="10" fill="${C.ok}" text-anchor="middle" font-weight="700">틈새 = 안전</text>`
    + bubble(18, 22, '"숨어!"', 70) + bubble(98, 22, '지나가면 "지금 가!"', 130)),
  // 순서 퍼즐: 단서의 순서대로 누르기
  order: svg(defs + `<rect x="100" y="16" width="120" height="44" rx="6" fill="#d9b98a"/><text x="160" y="45" font-size="16" text-anchor="middle">🌳 ➜ 🌿 ➜ 🪨</text>`
    + [['🪨', 60], ['🌳', 160], ['🌿', 260]].map(([ic, x]) => `<text x="${x}" y="110" font-size="22" text-anchor="middle">${ic}</text><rect x="${x - 16}" y="122" width="32" height="18" rx="4" fill="#9a9a9a"/><ellipse cx="${x}" cy="122" rx="12" ry="5" fill="#c9c9c9"/>`).join('')
    + `<text x="160" y="168" font-size="11" fill="${C.text}" text-anchor="middle">단서는 너만 볼 수 있다 — 순서를 말로 알려 주기</text>`),
};
// 지금까지 배운 것 전부(작은 도식 다섯 개)
const inner = k => ART[k].replace(/^<svg[^>]*>|<\/svg>$/g, '');
ART.finale = svg(defs + ['role', 'bag', 'clue', 'dona', 'boulder', 'order'].map((k, i) => `<g transform="translate(${8 + (i % 3) * 104},${i < 3 ? 4 : 92}) scale(0.32)">${inner(k)}</g>`).join(''));

/* ── 창 ── */
let queue = [], open = false;
function render(cards, i) {
  const c = cards[i];
  $('tutArt').innerHTML = ART[c.art] || '';
  $('tutTitle').textContent = c.title || '';
  $('tutText').textContent = c.text;
  $('tutPage').textContent = cards.length > 1 ? `${i + 1} / ${cards.length}` : '';
  $('tutNext').textContent = i < cards.length - 1 ? '다음 ▶' : '알겠어!';
  $('tutNext').onclick = () => i < cards.length - 1 ? render(cards, i + 1) : close();
}
function close() {
  $('tut').classList.remove('show');
  open = false;
  if (queue.length) return showNext();
  setPaused(false);
  $('input').focus();
}
function showNext() {
  open = true; setPaused(true);
  $('tut').classList.add('show');
  render(queue.shift(), 0);
  setTimeout(() => $('tutNext').focus(), 50);
}
export function show(cards) { if (!cards?.length) return; queue.push(cards); if (!open) showNext(); }
export const isOpen = () => open;

/* ── 스테이지 연결 ── */
let stage, getState, shown = new Set();
export function reset(st, stateFn) { stage = st; getState = stateFn; shown = new Set(); queue = []; }
// 이벤트('@start' 등) 또는 상태 변화 뒤 호출. 맞는 항목을 한 번씩 띄운다
export function check(event) {
  if (!stage?.tutorial) return;
  const s = getState();
  stage.tutorial.forEach((t, i) => {
    if (shown.has(i)) return;
    const hit = typeof t.on === 'string' && t.on.startsWith('@') ? t.on === event : !event && s && all(s, t.on);
    if (hit) { shown.add(i); show(t.cards); }
  });
}
