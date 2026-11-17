/* 진입점: 턴 진행(AI 호출 타이밍), 플레이어 입력, 프로토타입 컨트롤 */
import { $, esc, pick, addLine, viewerLine, say, donate, setFace, drawBubble, NICKS } from './ui.js';
import { G, resetStage, perform } from './stage.js';
import { EMOS, SYSTEM, aiOn, buildPrompt, callGemini, mockBrain, setOnConfigChange } from './ai.js';

function applyTurn(out, msgs) {
  const emo = EMOS.includes(out.emotion) ? out.emotion : 'normal';
  const a = out.action && typeof out.action === 'object' ? out.action : {};
  const line = String(out.line || '...').slice(0, 80);
  say(line, emo);
  const result = perform({ type: String(a.type || 'idle'), target: a.target, item: a.item });
  G.last = result;
  msgs.forEach(m => G.history.push(`시청자(${m.kind === 'dona' ? '후원' : '채팅'}): ${m.text}`));
  G.history.push(`나: ${line}`, `결과: ${result}`);
  G.history = G.history.slice(-8);
  (Array.isArray(out.viewers) ? out.viewers : []).slice(0, 2)
    .forEach((v, i) => setTimeout(() => viewerLine(String(v).slice(0, 40)), 700 + i * 900));
}

/* 턴 진행: 시청자 메시지가 오면 곧바로, 조용하면 AUTO_DELAY마다 스트리머가 알아서 행동한다.
   비용 보호: 호출 간 최소 간격(MIN_GAP). 조용한 상태로 AUTO_LIMIT턴이 지나면 멈추지 않고
   IDLE_DELAY 간격으로 느려진다. 탭이 가려져 있으면 호출하지 않는다. */
const MIN_GAP = 4000, AUTO_DELAY = 8000, AUTO_LIMIT = 6, IDLE_DELAY = 15000;
let pending = [], inFlight = false, turnTimer, lastCall = 0, fails = 0;
function schedule(delay) {
  clearTimeout(turnTimer);
  if (G.cleared) return;
  turnTimer = setTimeout(turn, Math.max(delay, lastCall + MIN_GAP - Date.now()));
}
async function turn() {
  if (inFlight || G.cleared) return;
  if (document.hidden) return schedule(AUTO_DELAY);
  const msgs = pending; pending = [];
  if (msgs.length) { G.autoTurns = 0; setFace('think'); } else G.autoTurns++;
  inFlight = true; lastCall = Date.now();
  const stage = G;
  try {
    const out = aiOn() ? await callGemini(SYSTEM, buildPrompt(msgs)) : await mockBrain();
    fails = 0;
    if (stage === G) applyTurn(out, msgs);            // 호출 도중 리셋됐으면 버린다
  } catch (e) {
    fails++; setFace('normal');
    addLine('⚠ AI 응답 실패: ' + esc(String(e.message || e).slice(0, 140)), 'sys');
  }
  inFlight = false;
  if (fails >= 3) return addLine('연속 실패로 자동 진행을 멈췄습니다. 설정을 확인해 주세요.', 'sys');
  schedule(pending.length ? 800 : G.autoTurns >= AUTO_LIMIT ? IDLE_DELAY : AUTO_DELAY);
}

/* ── 플레이어 입력 ── */
let mode = 'chat', wallet = 1000;
function setMode(m) {
  mode = m;
  $('modeChat').classList.toggle('on', m === 'chat'); $('modeDona').classList.toggle('on', m === 'dona');
  $('input').placeholder = m === 'chat' ? '채팅을 입력하세요' : '스트리머에게 보낼 지시를 입력하세요';
  $('hint').textContent = m === 'chat' ? '채팅은 무료지만 스트리머가 놓칠 수 있어요.' : '후원 지시는 화면에 크게 뜨고, 스트리머가 반드시 읽어요.';
}
$('modeChat').onclick = () => setMode('chat');
$('modeDona').onclick = () => setMode('dona');
function send() {
  const v = $('input').value.trim(); if (!v) return;
  if (mode === 'dona') {
    if (wallet < 100) { $('hint').textContent = '⚡이 부족해요. 채팅으로 지시해 보세요.'; return; }
    wallet -= 100; $('wallet').textContent = wallet.toLocaleString();
    donate('나', 100, v, true);
    pending.push({ kind: 'dona', text: v }); schedule(1500);   // 알림이 뜨는 시간만큼 뒤에 반응
  } else {
    addLine(`<span class="nick">나</span>${esc(v)}`, 'me');
    pending.push({ kind: 'chat', text: v }); schedule(1000);
  }
  $('input').value = '';
}
$('send').onclick = send;
$('input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) send(); });

/* ── 프로토타입 컨트롤 ── */
const SAMPLE = {
  normal: '음~ 일단 저 문부터 열어 볼까?', happy: '오케이, 오케이! 완전 알겠어, 레츠 고!',
  shout: '왓츠 댓?! 저거 방금 움직였지?!', angry: '아니 나도 안다고!! 훈수 그만!!',
  sad: '헬프 미... 여기 아까 왔던 데 같은데...',
};
document.querySelectorAll('.proto [data-emo]').forEach(b => b.onclick = () => say(SAMPLE[b.dataset.emo], b.dataset.emo));
$('otherDona').onclick = () => {                    // 다른 시청자의 후원도 스트리머가 읽는다(방해 요소)
  const msg = pick(['저 반짝이는 상자 열어보자 ㅋㅋ', '고양이 인형 한 번만 만져줘', '오늘도 방송 잘 보고 갑니다']);
  donate(pick(NICKS)[0], pick([1000, 5000, 10000]), msg);
  pending.push({ kind: 'dona', text: msg }); schedule(1500);
};
$('resetBtn').onclick = () => { pending = []; resetStage(); schedule(2000); };
$('guideBtn').onclick = e => { document.body.classList.toggle('guide'); e.target.classList.toggle('on'); drawBubble(); };


setOnConfigChange(() => { fails = 0; schedule(500); });
resetStage();
setTimeout(() => say('하이 하이~! 오늘은 진짜 한 번에 깬다, 레츠 고!', 'happy'), 600);
schedule(AUTO_DELAY);
