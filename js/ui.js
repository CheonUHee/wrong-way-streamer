/* 방송 UI: 스트리머 표정, 말풍선, 도네이션, 채팅, 인벤토리, 방송 시간 */
export const $ = id => document.getElementById(id);
const stage = $('stage'), bubble = $('bubble'), bubbleSvg = $('bubbleSvg'), streamer = $('streamer');

/* ── 스트리머 표정 ── */
const FACES = {
  normal: '<circle cx="78" cy="116" r="8" fill="#3a2a4a"/><circle cx="122" cy="116" r="8" fill="#3a2a4a"/><path d="M90 142 Q100 150 110 142" fill="none" stroke="#b2455e" stroke-width="4" stroke-linecap="round"/>',
  happy:  '<path d="M68 118 Q78 106 88 118 M112 118 Q122 106 132 118" fill="none" stroke="#3a2a4a" stroke-width="5" stroke-linecap="round"/><path d="M86 138 Q100 160 114 138Z" fill="#b2455e"/>',
  shout:  '<circle cx="78" cy="114" r="11" fill="#fff" stroke="#3a2a4a" stroke-width="4"/><circle cx="122" cy="114" r="11" fill="#fff" stroke="#3a2a4a" stroke-width="4"/><ellipse cx="100" cy="148" rx="9" ry="12" fill="#b2455e"/>',
  angry:  '<path d="M64 102 L90 112 M136 102 L110 112" stroke="#3a2a4a" stroke-width="5" stroke-linecap="round"/><circle cx="78" cy="120" r="7" fill="#3a2a4a"/><circle cx="122" cy="120" r="7" fill="#3a2a4a"/><path d="M88 150 Q100 138 112 150" fill="none" stroke="#b2455e" stroke-width="5" stroke-linecap="round"/>',
  sad:    '<path d="M68 112 Q78 122 88 112 M112 112 Q122 122 132 112" fill="none" stroke="#3a2a4a" stroke-width="5" stroke-linecap="round"/><path d="M90 150 Q100 142 110 150" fill="none" stroke="#b2455e" stroke-width="4" stroke-linecap="round"/><circle cx="134" cy="128" r="4" fill="#6fd3ff"/>',
  think:  '<circle cx="80" cy="112" r="7" fill="#3a2a4a"/><circle cx="124" cy="112" r="7" fill="#3a2a4a"/><path d="M92 146 H110" stroke="#b2455e" stroke-width="4" stroke-linecap="round"/>',
};
/* ── 스트리머 연속 이미지(감정별 프레임 애니메이션) ──
   이미지 경로 규칙: assets/streamer/<감정>/1.png, 2.png, ...
   frames 의 숫자를 장수로 바꾸면 해당 감정은 플레이스홀더 대신 이미지가 재생된다.
   think = API 응답을 기다리는 동안의 '채팅 읽는 중' 표정(말풍선 없음). */
const SPRITES = {
  dir: 'assets/streamer', ext: 'png', fps: 8,
  frames: { normal: 0, happy: 0, shout: 0, angry: 0, sad: 0, think: 0 },
  once: [],                         // 반복하지 않고 마지막 장에서 멈출 감정 (예: ['shout'])
};
const MOUTH = { x: 0.2, y: 0.6 };   // 말풍선 꼬리가 향할 지점(스트리머 이미지 내 비율)
const spriteImgs = {};
for (const [emo, n] of Object.entries(SPRITES.frames)) {
  spriteImgs[emo] = Array.from({ length: n }, (_, i) => { const im = new Image(); im.src = `${SPRITES.dir}/${emo}/${i + 1}.${SPRITES.ext}`; return im; });
}
let spriteTimer;
export function setFace(emo) {
  clearInterval(spriteTimer);
  const frames = spriteImgs[emo]?.length ? spriteImgs[emo] : spriteImgs.normal;
  streamer.classList.toggle('has-sprite', frames.length > 0);
  $('sprite').hidden = !frames.length;
  if (!frames.length) { $('face').innerHTML = FACES[emo] || FACES.normal; return; }
  let i = 0; const once = SPRITES.once.includes(emo);
  $('sprite').src = frames[0].src;
  if (frames.length > 1) spriteTimer = setInterval(() => {
    i++; if (once && i >= frames.length) return clearInterval(spriteTimer);
    $('sprite').src = frames[i % frames.length].src;
  }, 1000 / SPRITES.fps);
}
setFace('normal');

/* ── 말풍선 형태 생성 ──
   모양은 두 가지만 쓴다: 일반(둥근 말풍선) / 놀람(뾰족한 폭발형, 소리치거나 화낼 때).
   나머지 감정(기쁨·슬픔 등)은 스트리머 표정이 맡는다.
   떠 있는 느낌: 위가 밝고 아래가 살짝 어두운 면 + 넓고 부드러운 그림자(CSS) + 천천히 둥실거림(CSS) */
const shapeOf = emo => (emo === 'shout' || emo === 'angry') ? 'burst' : 'calm';
// 둥근 사각형 둘레 위의 점과 바깥 방향 법선
function perimeter(w, h, r) {
  const a = Math.PI * r / 2, segs = [w - 2*r, a, h - 2*r, a, w - 2*r, a, h - 2*r, a];
  const total = segs.reduce((s, v) => s + v, 0);
  const arc = (cx, cy, a0, t) => { const g = a0 + t / r; return { x: cx + r*Math.cos(g), y: cy + r*Math.sin(g), nx: Math.cos(g), ny: Math.sin(g) }; };
  const at = s => {
    s = ((s % total) + total) % total;
    let i = 0; while (s > segs[i]) { s -= segs[i]; i++; }
    switch (i) {
      case 0: return { x: r + s, y: 0, nx: 0, ny: -1 };
      case 1: return arc(w - r, r, -Math.PI/2, s);
      case 2: return { x: w, y: r + s, nx: 1, ny: 0 };
      case 3: return arc(w - r, h - r, 0, s);
      case 4: return { x: w - r - s, y: h, nx: 0, ny: 1 };
      case 5: return arc(r, h - r, Math.PI/2, s);
      case 6: return { x: 0, y: h - r - s, nx: -1, ny: 0 };
      default: return arc(r, r, Math.PI, s);
    }
  };
  return { total, at };
}
function bodyPath(shape, w, h, u) {
  const f = n => n.toFixed(1);
  if (shape === 'calm') {
    const r = Math.min(h / 2, 2.6 * u);
    return `M${r},0 H${w-r} A${r},${r} 0 0 1 ${w},${r} V${h-r} A${r},${r} 0 0 1 ${w-r},${h} H${r} A${r},${r} 0 0 1 0,${h-r} V${r} A${r},${r} 0 0 1 ${r},0Z`;
  }
  const P = perimeter(w, h, Math.min(h / 2, 2.5 * u));
  let n = Math.max(10, Math.round(P.total / (2.4 * u))); if (n % 2) n++;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p = P.at(P.total * i / n);
    const off = i % 2 ? (0.9 + rnd() * 1.0) * u : -0.25 * u;
    pts.push({ x: p.x + p.nx * off, y: p.y + p.ny * off });
  }
  return 'M' + pts.map(p => `${f(p.x)},${f(p.y)}`).join(' L') + 'Z';
}
export function drawBubble() {
  const emo = bubble.dataset.emo, shape = shapeOf(emo);
  bubble.dataset.shape = shape;
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  if (!w || !h) return;
  const u = stage.clientWidth / 100;
  // 꼬리 목표점: 스트리머 입 근처(말풍선 기준 좌표). 꼬리는 몸통 오른쪽에서 부드럽게 휘어 나간다
  const tx = streamer.offsetLeft + streamer.offsetWidth * MOUTH.x - bubble.offsetLeft;
  const ty = streamer.offsetTop + streamer.offsetHeight * MOUTH.y - bubble.offsetTop;
  const bx = w - 2 * u, by = Math.min(h - 1.6 * u, Math.max(1.6 * u, h * 0.6));
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len, hw = 1.6 * u;
  const mx = (bx + tx) / 2, my = (by + ty) / 2 - 0.8 * u;
  const t = shape === 'calm'
    ? `M${bx + px*hw},${by + py*hw} Q${mx},${my} ${tx},${ty} Q${mx - px*hw*0.3},${my - py*hw*0.3} ${bx - px*hw},${by - py*hw}Z`
    : `M${bx + px*hw},${by + py*hw} L${tx},${ty} L${bx - px*hw},${by - py*hw}Z`;
  const body = bodyPath(shape, w, h, u);
  const edge = shape === 'calm' ? '#14161c14' : '#ff5b5b';
  const sw = shape === 'calm' ? Math.max(1, 0.12 * u) : Math.max(2, 0.25 * u);
  bubbleSvg.innerHTML =
    `<defs><linearGradient id="bubFill" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${shape === 'calm' ? '#eef1f7' : '#fff1ec'}"/></linearGradient></defs>` +
    `<path d="${t}" fill="url(#bubFill)" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round"/>` +
    `<path d="${body}" fill="url(#bubFill)" stroke="${edge}" stroke-width="${sw}" stroke-linejoin="round"/>` +
    `<path d="${t}" fill="url(#bubFill)"/>` +
    // 위쪽 안쪽 하이라이트(빛이 위에서 비치는 느낌)
    (shape === 'calm' ? `<path d="M${2.6*u},${0.35*u} H${w-2.6*u}" stroke="#ffffff" stroke-width="${0.25*u}" stroke-linecap="round" opacity=".9"/>` : '');
}
new ResizeObserver(drawBubble).observe(stage);
new ResizeObserver(drawBubble).observe(bubble);

let bubbleTimer, typeTimer;
export function say(text, emo = 'normal', hold = 3500) {
  clearTimeout(bubbleTimer); clearInterval(typeTimer);
  bubble.dataset.emo = emo; setFace(emo);
  $('bubbleText').textContent = '';
  bubble.classList.add('show'); drawBubble();
  let i = 0;
  typeTimer = setInterval(() => { $('bubbleText').textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typeTimer); }, 28);
  addLine(`<span class="nick">한별</span>${esc(text)}`, 'streamer-line');
  bubbleTimer = setTimeout(() => { bubble.classList.remove('show'); setFace('normal'); }, hold + text.length * 28);
}

/* ── 도네이션 알림 ── */
let donaTimer;
export function donate(nick, amount, msg, mine) {
  clearTimeout(donaTimer);
  const d = $('dona');
  d.classList.toggle('me', !!mine);
  $('donaImg').textContent = mine ? '📢' : '⚡';
  $('donaHead').innerHTML = `<em>${esc(nick)}</em>님이 <em>${amount.toLocaleString()}⚡</em> 후원!`;
  $('donaMsg').textContent = msg;
  d.classList.add('show');
  addLine(`<span class="amt">⚡ ${amount.toLocaleString()} 후원</span><span class="nick">${esc(nick)}</span>${esc(msg)}`, 'dona-line' + (mine ? ' me' : ''));
  donaTimer = setTimeout(() => d.classList.remove('show'), 4500);
}

/* ── 채팅 ── */
const log = $('log');
export const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chatTimes = [];
export function addLine(html, cls = '') {
  const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const p = document.createElement('p'); p.className = cls; p.innerHTML = html; log.appendChild(p);
  while (log.children.length > 120) log.firstChild.remove();
  if (stick) log.scrollTop = log.scrollHeight;
  if (cls === '' || cls === 'dona-line') { chatTimes.push(Date.now()); if (chatTimes.length > 50) chatTimes.shift(); }
  return p;
}
// 최근 ms 동안 다른 시청자가 올린 줄 수: 채팅창이 붐빌수록 스트리머가 내 채팅을 놓친다
export const chatNoise = (ms = 8000) => chatTimes.filter(t => Date.now() - t < ms).length;
// 내 채팅 옆에 스트리머가 읽었는지 표시
export function markRead(el, read) {
  if (!el?.isConnected) return;
  const tag = document.createElement('span');
  tag.className = 'readtag' + (read ? '' : ' missed'); tag.textContent = read ? '👀 읽음' : '💨 놓침';
  el.appendChild(tag);
}
export const NICKS = [['감자튀김', '#ff9e6b'], ['눈팅러', '#9bd0ff'], ['새벽반', '#c59bff'], ['치킨먹고싶다', '#ffb86b'], ['ㅇㅇ', '#7fd6c8'], ['고양이집사', '#ffd36b']];
const CHATS = ['ㅋㅋㅋㅋㅋ', '아니 거기 아닌데요...', '이게 방송이지', '오늘 안에 깨긴 하냐', '귀여우니까 봐준다', '또 딴 데 본다 ㅋㅋ', '집중 집중!!', 'ㄹㅇㅋㅋ', '답답해서 내가 한다'];
export const pick = a => a[Math.floor(Math.random() * a.length)];
export function viewerLine(text) { const [n, c] = pick(NICKS); addLine(`<span class="nick" style="color:${c}">${n}</span>${esc(text)}`); }
function fakeChat() { if (!document.body.classList.contains('paused')) viewerLine(pick(CHATS)); setTimeout(fakeChat, 2500 + Math.random() * 5000); }
addLine('지지직 채팅방에 입장했습니다.', 'sys');
fakeChat();

/* ── 인벤토리 · 획득 알림 ── */
const INV_SIZE = 9;                 // 칸 수 미정: 3열 기준으로 숫자만 바꾸면 된다
// items: [{ icon, name }] — 스테이지 상태의 인벤토리를 그대로 그린다
export function setInv(items, newIdx = -1) {
  $('inv').innerHTML = Array.from({ length: INV_SIZE }, (_, i) => {
    const it = items[i];
    return `<div class="slot${it ? ' filled' : ''}${i === newIdx ? ' new' : ''}"><div class="box">${it ? it.icon : ''}</div><div class="name">${it ? esc(it.name) : ''}</div></div>`;
  }).join('');
  $('invCount').textContent = `${Math.min(items.length, INV_SIZE)}/${INV_SIZE}`;
}
let toastTimer;
export function toast(html, ms = 3000) {
  clearTimeout(toastTimer);
  $('toast').innerHTML = html;
  $('toast').classList.add('show');
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), ms);
}
export const toastItem = it => toast(`${it.icon} <em>${esc(it.name)}</em> 획득!`);

/* ── 방송 시간(= 스테이지 경과 시간) ── */
let elapsed = 0;                     // 일시정지(튜토리얼) 중에는 멈춘다
setInterval(() => {
  if (!document.body.classList.contains('paused')) elapsed++;
  const s = elapsed;
  $('timer').textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, '0')).join(':');
}, 1000);
