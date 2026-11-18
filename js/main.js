/* 진입점: 턴 진행(AI 호출 타이밍), 플레이어 입력, 프로토타입 컨트롤 */
import { $, esc, addLine, viewerLine, say, donate, setFace, drawBubble, chatNoise, markRead } from './ui.js';
import * as viewers from './viewers.js';
import { isPaused, whenResumed, onResume } from './pause.js';
import { state, isBusy, canInterrupt, perform, startFromUrl, restartStage, hazardNow } from './stage.js';
import { EMOS, SYSTEM, aiOn, buildPrompt, callGemini, mockBrain, setOnConfigChange } from './ai.js';

function applyTurn(out, msgs) {
  const emo = EMOS.includes(out.emotion) ? out.emotion : 'normal';
  const a = out.action && typeof out.action === 'object' ? out.action : {};
  const line = String(out.line || '...').slice(0, 80);
  say(line, emo);
  const st0 = state(), wasAsking = st0.asking && (msgs.length || Date.now() - (st0.askedAt || 0) >= 30000);
  const result = perform({ type: String(a.type || 'idle'), target: a.target, item: a.item });
  const S = state();
  S.last = result; S.noticed = null;                          // 눈에 띈 것은 한 번 전달하면 잊는다
  if (wasAsking && S.asking === st0.asking) S.asking = null;   // 대답을 들었거나 기다리다 지쳤다(이번 행동이 새로 물은 건 남긴다)
  msgs.forEach(m => S.history.push(`${m.nick}(${m.kind === 'dona' ? '후원' : '채팅'}): ${m.text}`));
  S.history.push(`한별(나): ${line}`, `결과: ${result}`);
  S.history = S.history.slice(-8);
  (Array.isArray(out.viewers) ? out.viewers : []).slice(0, 2)
    .forEach((v, i) => setTimeout(() => viewerLine(String(v).slice(0, 40)), 700 + i * 900));
}

/* 턴 진행: 시청자 메시지가 오면 곧바로, 조용하면 AUTO_DELAY마다 스트리머가 알아서 행동한다.
   비용 보호: 호출 간 최소 간격(MIN_GAP). 조용한 상태로 AUTO_LIMIT턴이 지나면 멈추지 않고
   IDLE_DELAY 간격으로 느려진다. 탭이 가려져 있으면 호출하지 않는다. */
const MIN_GAP = 4000, AUTO_DELAY = 8000, AUTO_LIMIT = 6, IDLE_DELAY = 15000;
const MIN_GAP_PLAYER = 1500;   // 플레이어의 채팅·후원에는 더 빨리 반응한다("숨어!" 같은 타이밍 훈수가 늦지 않게)
let pending = [], inFlight = false, turnTimer, turnDue = 0, lastCall = 0, fails = 0, autoTurns = 0;
// 주소 뒤에 ?auto=off 를 붙이면 스트리머가 스스로 행동하지 않는다(채팅·후원이 올 때만 반응. 테스트용)
const AUTO_OFF = new URLSearchParams(location.search).get('auto') === 'off';
function schedule(delay) {
  clearTimeout(turnTimer);
  if (AUTO_OFF && !pending.length) return;
  const gap = pending.some(m => m.role === 'me') ? MIN_GAP_PLAYER : MIN_GAP;
  const wait = Math.max(delay, lastCall + gap - Date.now());
  turnDue = Date.now() + wait;
  turnTimer = setTimeout(turn, wait);
}
// 이미 더 이른 턴이 잡혀 있으면 그대로 둔다(다른 시청자 채팅이 내 훈수 반응을 늦추지 않게)
function scheduleBy(delay) { if (!turnDue || turnDue < Date.now() || Date.now() + delay < turnDue) schedule(delay); }
async function turn() {
  turnDue = 0;
  if (inFlight) return;
  // 걷기·사망·스테이지 전환 연출 중이거나 클리어 직후면 끝날 때까지 기다린다
  // 걷는 중이면 시청자 메시지가 왔을 때만 멈춰 세우고 새로 정한다(혼자서는 끊지 않는다)
  const walkStop = pending.length && canInterrupt();
  if (document.hidden || isPaused() || (isBusy() && !walkStop) || state().cleared) return schedule(pending.length ? 500 : 1500);
  // 한별이 시청자에게 물어본 뒤에는 대답(채팅·후원)이 올 때까지 스스로 움직이지 않는다(최대 30초)
  if (state().asking && !pending.length && Date.now() - (state().askedAt || 0) < 30000) return schedule(1500);
  // 위험이 다가오는 중(경고·굴러옴)에는 시청자 말 없이 스스로 길에 나서지 않는다(겁이 많은 한별). 말리는 건 시청자 몫
  if (!pending.length && (hazardNow() === 'warn' || hazardNow() === 'roll')) return schedule(1000);
  const raw = pending; pending = [];
  // 채팅은 채팅창이 붐빌수록 놓친다(후원은 반드시 읽는다). 놓친 메시지는 스트리머에게 전달되지 않는다
  // 최근 8초에 다른 시청자 줄이 2줄을 넘으면 1줄마다 7%씩 놓친다(최소 40%는 읽음)
  const readChance = Math.max(0.4, 1 - Math.max(0, chatNoise() - 2) * 0.07);
  const msgs = raw.filter(m => m.kind === 'dona' || Math.random() < readChance).slice(-5);
  raw.forEach(m => m.el && markRead(m.el, msgs.includes(m)));
  if (raw.length) { autoTurns = 0; if (msgs.length) setFace('think'); } else autoTurns++;
  inFlight = true; lastCall = Date.now();
  const S = state();
  try {
    const out = aiOn() ? await callGemini(SYSTEM, buildPrompt(msgs)) : await mockBrain();
    fails = 0;
    await whenResumed();                                       // 응답 도중 튜토리얼 창이 떴으면 닫힐 때까지 미룬다
    if (S === state() && (!isBusy() || canInterrupt())) applyTurn(out, msgs);   // 호출 도중 리셋·연출(걷기 제외)이 시작됐으면 버린다
  } catch (e) {
    fails++; setFace('normal');
    addLine('⚠ AI 응답 실패: ' + esc(String(e.message || e).slice(0, 140)), 'sys');
  }
  inFlight = false;
  if (fails >= 3) return addLine('연속 실패로 자동 진행을 멈췄습니다. 설정을 확인해 주세요.', 'sys');
  schedule(pending.length ? 800 : autoTurns >= AUTO_LIMIT ? IDLE_DELAY : AUTO_DELAY);
}

/* ── 플레이어 입력 ── */
// AI에게 전달할 때 쓰는 플레이어 닉네임. 화면에는 '나'로 보이지만, 프롬프트에서 '나'는 한별 자신과 헷갈리므로 따로 둔다.
// AI는 이 사람이 플레이어인지 모른다(다른 시청자와 똑같이 대한다).
const PLAYER_NICK = '별똥별';
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
    const m = { kind: 'dona', text: v, nick: PLAYER_NICK, role: 'me' };
    pending.push(m); schedule(1500);   // 알림이 뜨는 시간만큼 뒤에 반응
    viewers.onPlayerMessage(m);
  } else {
    const m = { kind: 'chat', text: v, nick: PLAYER_NICK, role: 'me', el: addLine(`<span class="nick">나</span>${esc(v)}`, 'me') };
    pending.push(m); schedule(1000);
    viewers.onPlayerMessage(m);
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
$('otherDona').onclick = () => viewers.trollNow();   // 방해꾼 후원을 바로 일으킨다(테스트용)

// 방해꾼·조력자의 말도 스트리머 대기열에 들어간다. 후원은 곧바로 반응, 채팅은 다음 턴에 함께 읽는다
viewers.connect(m => { pending.push(m); scheduleBy(m.kind === 'dona' ? 1500 : AUTO_DELAY); });
$('resetBtn').onclick = () => { pending = []; restartStage(); schedule(2000); };
$('guideBtn').onclick = e => { document.body.classList.toggle('guide'); e.target.classList.toggle('on'); drawBubble(); };


setOnConfigChange(() => { fails = 0; schedule(500); });
// 튜토리얼 창을 닫은 직후에는 플레이어가 상황을 볼 시간을 준다(바로 스스로 움직이지 않게)
onResume(() => { if (!pending.length) schedule(AUTO_DELAY); });
startFromUrl();
setTimeout(() => say('하이 하이~! 오늘은 진짜 한 번에 깬다, 레츠 고!', 'happy'), 600);
schedule(AUTO_DELAY);
