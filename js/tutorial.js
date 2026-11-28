/* 플레이어에게만 보이는 튜토리얼 창(게임 속 게임의 튜토리얼이 아니다).
   화면 전체를 어둡게 하고 그림 + 1~2문장 카드를 보여 준다. 그림은 실제 게임 화면(assets/guide/*.webp, js/guideshots.js로 찍음) 위에 표시를 얹은 것. 닫을 때까지 게임 전체가 멈춘다(pause.js).

   스테이지 데이터:
   tutorial: [{ on: '@start' | '@ask' | '@gain' | '@dona' | '@death' | 조건, cards: [{ art, title, text }] }]
   - '@이벤트': 그 일이 처음 일어났을 때. 조건(예: 'area:hall', ['doorOpen'])은 행동이 끝난 뒤 처음 맞았을 때
   - 같은 항목은 스테이지를 한 번 진행하는 동안 한 번만 나온다 */
import { $, esc } from './ui.js';
import { setPaused, isTest, isIntro } from './pause.js';
import { all } from './core.js';
import { STAGES } from './stages/index.js';

/* ── 도식(SVG, 320×180) ── */
const C = { bg: '#1e2129', panel: '#16181f', line: '#3a3f4d', text: '#e8eaf0', dim: '#8b90a0', acc: '#ffe14a', me: '#6fd3ff', troll: '#ff7ab8', ok: '#7be08a', bad: '#ff6a6a' };
const svg = body => `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, 'Malgun Gothic', sans-serif">${body}</svg>`;
const screen = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#2a3350" stroke="${C.line}"/>`;
const face = (x, y, r = 16) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffe8d6" stroke="#d3e7a5" stroke-width="5"/><circle cx="${x - r * 0.35}" cy="${y}" r="2.2" fill="#3a2a4a"/><circle cx="${x + r * 0.35}" cy="${y}" r="2.2" fill="#3a2a4a"/>`;
const chatLine = (x, y, nick, color, text, w = 120) => `<rect x="${x}" y="${y}" width="${w}" height="20" rx="5" fill="${C.panel}" stroke="${C.line}"/><text x="${x + 6}" y="${y + 14}" font-size="10" fill="${color}" font-weight="700">${esc(nick)}</text><text x="${x + 12 + nick.length * 11}" y="${y + 14}" font-size="10" fill="${C.text}">${esc(text)}</text>`;
const dona = (x, y, nick, color, text, w = 130) => `<rect x="${x}" y="${y}" width="${w}" height="30" rx="6" fill="#2a2410" stroke="${color}" stroke-width="2"/><text x="${x + 8}" y="${y + 12}" font-size="9" fill="${C.acc}" font-weight="800">⚡ 후원 · ${esc(nick)}</text><text x="${x + 8}" y="${y + 25}" font-size="10" fill="${C.text}">${esc(text)}</text>`;
// 화살표: 머리를 삼각형으로 직접 그린다(marker는 id가 겹치거나 숨은 그림 안에 있으면 안 보여서)
const arrow = (x1, y1, x2, y2, color = C.acc) => {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 9, W = 5.5, bx = x2 - Math.cos(a) * L, by = y2 - Math.sin(a) * L;
  const p = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
  return `<path d="M${x1},${y1} L${p(bx, by)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`
    + `<polygon points="${p(x2, y2)} ${p(bx - Math.sin(a) * W, by + Math.cos(a) * W)} ${p(bx + Math.sin(a) * W, by - Math.cos(a) * W)}" fill="${color}"/>`;
};
const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10Z" fill="${C.acc}"/></marker></defs>`;
const bubble = (x, y, text, w = 110) => `<rect x="${x}" y="${y}" width="${w}" height="24" rx="12" fill="#fff"/><text x="${x + w / 2}" y="${y + 16}" font-size="11" fill="#14161c" font-weight="700" text-anchor="middle">${esc(text)}</text>`;

// 실제 화면 사진(16:9를 꽉 채움)과 표시 도우미
const photo = name => `<image href="assets/guide/${name}.webp" x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMid slice"/>`;
const ring = (x, y, r, color = C.acc) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="5 4"/>`;
const tag = (x, y, text) => { const w = text.length * 9 + 14; return `<rect x="${x - w / 2}" y="${y - 12}" width="${w}" height="18" rx="9" fill="#000b"/><text x="${x}" y="${y + 1}" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">${esc(text)}</text>`; };
const chatBox = (x, y, nick, text, w) => `<rect x="${x}" y="${y - 2}" width="${w}" height="24" rx="6" fill="${C.panel}ee" stroke="${C.me}" stroke-width="1.5"/><text x="${x + 8}" y="${y + 14}" font-size="11" fill="${C.me}" font-weight="800">${esc(nick)}</text><text x="${x + 12 + nick.length * 11}" y="${y + 14}" font-size="11" fill="${C.text}">${esc(text)}</text>`;
// 스트리머 웹캠(실제 표정 이미지)
const cam = (x, y, emo = 'normal1') => `<rect x="${x - 2}" y="${y - 2}" width="70" height="84" rx="8" fill="#000a"/><image href="assets/sprites/${emo}.webp" x="${x}" y="${y}" width="66" height="80" preserveAspectRatio="xMidYMax slice"/>`;
// 채팅창 그림: 실제 채팅 패널과 같은 마크업(.log p · .nick · .dona-line · .streamer-line · .me.missed)을 쓴다. rows: [[채팅 줄, 설명(선택)], …]
const chatArt = rows => `<div class="log tut-chatart">${rows.map(([line, n = '']) => `<div class="tc-line">${line}</div><div class="tc-note">${n}</div>`).join('')}</div>`;
const chat = (nick, color, text) => `<p><span class="nick" style="color:${color}">${esc(nick)}</span>${esc(text)}</p>`;
const donaLine = (nick, amount, text, mine) => `<p class="dona-line${mine ? ' me' : ''}"><span class="amt">⚡ ${amount} 후원</span><span class="nick">${esc(nick)}</span>${esc(text)}</p>`;
const streamerLine = text => `<p class="streamer-line"><span class="nick">한별</span>${esc(text)}</p>`;
const note = (html, color) => `<span style="color:${color}">${html}</span>`;
export const ART = {
  // 실제 게임 화면(assets/guide/*.webp, js/guideshots.js로 찍음) 위에 표시를 얹는다. 좌표는 320×180 기준
  // 플레이어 = 시청자: 채팅으로 훈수하면 스트리머가 읽고 움직인다
  role: svg(defs + photo('room1') + cam(246, 84)
    + chatBox(10, 132, '나', '문 열어 봐!', 120) + arrow(104, 130, 152, 96)
    + tag(160, 22, '채팅으로 스트리머를 움직이는 방송')),
  // 채팅으로 지시하기: 한별은 이름표 없이 생김새로 알아듣는다. 딴짓하면 다시 불러 준다
  describe: svg(defs + photo('room1')
    + ring(107, 95, 17) + chatBox(14, 140, '나', '빨간 버튼 눌러!', 132) + arrow(80, 138, 100, 114)
    + bubble(176, 70, '오리는 딴짓!', 72) + ring(212, 104, 13, C.bad)),
  // 아이템: 주운 아이템은 왼쪽 아래 가방에, "○○을 △△에 써"
  bag: svg(defs + photo('room2') + ring(207, 94, 13)
    + `<rect x="10" y="96" width="74" height="54" rx="7" fill="#000a" stroke="${C.line}"/><text x="17" y="110" font-size="9" fill="${C.text}" font-weight="800">🎒 가방</text>`
    + [0, 1].map(c => `<rect x="${18 + c * 30}" y="116" width="26" height="26" rx="5" fill="#ffffff14" stroke="${c ? '#ffffff30' : C.acc}" stroke-width="${c ? 1 : 2}"/>`).join('')
    + `<text x="31" y="135" font-size="14" text-anchor="middle">🗝️</text>` + arrow(46, 112, 132, 92)
    + chatBox(96, 152, '나', '열쇠를 문에 써', 124)),
  // 한별이 물어볼 때: 채팅으로 대답하면 그대로 따른다
  ask: svg(defs + photo('room3') + cam(246, 84) + bubble(150, 128, '어느 문으로 갈까?', 96)
    + chatBox(12, 150, '나', '왼쪽 문!', 92) + arrow(60, 148, 110, 112)),
  // 퍼즐 힌트: 한별도 안내판은 읽지만 그게 어느 문인지는 모른다 → 플레이어가 위치를 알려 준다
  clue: svg(defs + photo('room3')
    + `<rect x="138" y="66" width="44" height="20" rx="4" fill="none" stroke="${C.acc}" stroke-width="2.5"/>`
    + tag(160, 50, '한별: "GOAL… 어느 문?"') + ring(115, 96, 22, C.ok)
    + chatBox(12, 150, '나', '왼쪽 문이야!', 112) + arrow(70, 148, 106, 122)),
  // 채팅과 후원: 실제 채팅창과 같은 HTML·스타일(css .log)로 그린다. 채팅은 붐비면 놓치고, 후원은 반드시 읽힌다
  dona: chatArt([
    [chat('눈팅러', '#9bd0ff', 'ㅋㅋㅋㅋ')],
    [chat('감자튀김', '#ff9e6b', '귀엽다')],
    [`<p class="me missed"><span class="nick">나</span>왼쪽 문으로 가!<span class="readtag missed">💨 놓침</span></p>`, note('채팅이 많아지면<br>놓칠 수 있다', C.dim)],
    [chat('치킨먹고싶다', '#7be08a', '오늘 안에 깨긴 하냐')],
    [donaLine('나', '100', '왼쪽 문으로 가!', true), note('후원은 반드시 읽는다<br><small>대신 ⚡를 쓴다</small>', C.ok)],
    [streamerLine('오케이, 왼쪽 문이지? 바로 간다!')],
  ]),
  // 방해하는 시청자: 후원끼리는 가장 나중 것을 따른다 → 거짓 후원 뒤에 후원으로 바로잡기
  troll: chatArt([
    [donaLine('훈수빌런', '100', '오른쪽 문 ㄱㄱ ㅋㅋ'), note('방해꾼의<br>거짓 후원', C.troll)],
    [chat('새벽반', '#c9a0ff', '저거 낚시 아님?')],
    [donaLine('나', '100', '아니야! 왼쪽 문!', true), note('← 마지막 후원', C.ok)],
    [streamerLine('어? 알았어, 왼쪽 문으로 갈게!'), note('가장 나중에 온<br>후원을 따른다', C.text)],
  ]),
  // 바위 굴러오는 골짜기: 틈새에 숨었다가 지나가면 출발
  // 틈새 자리(113, 110)는 js/guideshots.js가 찍으면서 계산해 알려 준 값
  boulder: svg(defs + photo('valley') + arrow(170, 104, 170, 146, C.bad)
    + tag(160, 22, '⚠ 쿠르르릉… 바위가 굴러온다') + ring(113, 110, 20, C.ok) + tag(92, 146, '틈새 = 안전')),
  // 순서 퍼즐: 길마다 있는 버튼(석판 그림은 넣지 않는다: 단서는 플레이어가 직접 찾게)
  order: svg(defs + photo('glade')
    + ring(195, 134, 14) + tag(66, 70, '🌳 나무 길') + tag(254, 70, '🌿 덤불 길') + tag(122, 160, '🎃 호박밭')
    + tag(236, 22, '출구(큰 바위)')),
};
// 지금까지 배운 것 전부(작은 도식 다섯 개)
const inner = k => ART[k].replace(/^<svg[^>]*>|<\/svg>$/g, '');
ART.finale = svg(defs + ['role', 'describe', 'bag', 'clue', 'boulder', 'order'].map((k, i) => `<g transform="translate(${8 + (i % 3) * 104},${i < 3 ? 4 : 92}) scale(0.32)">${inner(k)}</g>`).join(''));

/* ── 창 ── */
let queue = [], open = false;
// 본문 글: 문장마다 줄을 바꾸고, "(예시: …)"는 흐린 색으로 한 줄에 붙여 둔다(중간에서 갈리지 않게)
const fmt = text => esc(text)
  .replace(/\s*\(예시:[^)]*\)/g, m => ` <span class="tut-ex">${m.trim()}</span>`)
  .replace(/([.!?])\s+/g, '$1<br>')
  .replace(/<\/span>\s+/g, '</span><br>');
// 카드 크기 통일: 모든 스테이지의 가이드 중 제목+본문이 가장 긴 것에 맞춰 본문 칸 높이를 고정한다
const ALL_CARDS = STAGES.flatMap(s => (s.tutorial || []).flatMap(t => t.cards));
function fitBody() {
  const body = $('tutBody'), w = body.clientWidth;
  if (!w) return;
  const m = body.cloneNode(true);
  m.removeAttribute('id'); m.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  Object.assign(m.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: w + 'px', minHeight: '0' });
  body.parentNode.appendChild(m);
  const h = m.querySelector('h3'), p = m.querySelector('p');
  let max = 0;
  for (const c of ALL_CARDS) { h.textContent = c.title || ''; p.innerHTML = fmt(c.text); max = Math.max(max, m.offsetHeight); }
  m.remove();
  body.style.minHeight = max + 'px';
}
addEventListener('resize', () => { if (open) fitBody(); });
function render(cards, i) {
  const c = cards[i];
  $('tutArt').innerHTML = ART[c.art] || '';
  $('tutTitle').textContent = c.title || '';
  $('tutText').innerHTML = fmt(c.text);
  $('tutPage').textContent = cards.length > 1 ? `${i + 1} / ${cards.length}` : '';
  $('tutNext').textContent = i < cards.length - 1 ? '다음 ▶' : '확인';
  $('tutNext').onclick = () => i < cards.length - 1 ? render(cards, i + 1) : close();
  // 이전: 두 장 이상일 때만. 첫 장에서는 자리만 차지하고 보이지 않는다
  $('tutPrev').hidden = cards.length < 2;
  $('tutPrev').classList.toggle('off', i === 0);
  $('tutPrev').onclick = () => i > 0 && render(cards, i - 1);
}
function close() {
  $('tut').classList.remove('show');
  open = false;
  if (queue.length) return showNext();
  setPaused(false);
  $('input').focus();
}
function showNext(start = 0) {
  open = true; setPaused(true);
  $('tut').classList.add('show');
  fitBody();
  const cards = queue.shift();
  render(cards, Math.min(start, cards.length - 1));
  setTimeout(() => $('tutNext').focus(), 50);
}
export function show(cards) {
  if (!cards?.length) return;
  remember(cards);
  queue.push(cards); if (!open) showNext();
}
export const isOpen = () => open;

/* ── 다시 보기(방송 정보 줄의 📖 플레이 가이드 버튼) ──
   지금 스테이지까지 오는 동안 본 카드만 본 순서대로 다시 보여 준다(예: 스테이지 2에서 누르면 1·2에서 본 카드).
   아직 못 본 카드는 보여 주지 않는다(스포일러 방지). 마지막으로 본 카드부터 열고 ◀ 이전으로 거슬러 본다 */
const seen = new Map();                                  // 스테이지 번호 → 본 카드(본 순서, 같은 카드는 한 번)
const stageNo = () => { const i = STAGES.indexOf(stage); return i < 0 ? 0 : i; };
function remember(cards) {
  const n = stageNo(), list = seen.get(n) || [];
  for (const c of cards) if (!list.includes(c)) list.push(c);
  seen.set(n, list);
}
export function replay() {
  if (open) return;
  const now = stageNo();
  const cards = [...seen.keys()].sort((a, b) => a - b).filter(n => n <= now).flatMap(n => seen.get(n));
  if (!cards.length) return;
  queue.unshift(cards); showNext(cards.length - 1);
}

/* ── 스테이지 연결 ── */
let stage, getState, shown = new Set();
export function reset(st, stateFn) { stage = st; getState = stateFn; shown = new Set(); queue = []; }
// 이벤트('@start' 등) 또는 상태 변화 뒤 호출. 맞는 항목을 한 번씩 띄운다
export function check(event) {
  if (!stage?.tutorial || isTest() || isIntro()) return;   // 인트로 화면 동안은 띄우지 않는다(시작 뒤 js/main.js가 다시 부른다)
  const s = getState();
  stage.tutorial.forEach((t, i) => {
    if (shown.has(i)) return;
    const hit = typeof t.on === 'string' && t.on.startsWith('@') ? t.on === event : !event && s && all(s, t.on);
    if (hit) { shown.add(i); show(t.cards); }
  });
}
