/* 스테이지 진행(브라우저용). 규칙 판정은 core.js, 화면 재생은 view3d.js에 맡기고
   둘을 이어 준다: 행동 → 규칙 판정 → 효과(걷기·손 동작·아이템·구역 이동·적·사망·클리어)를 순서대로 재생. */
import { $, esc, setInv, toastItem, toast, addLine, setFace, say } from './ui.js';
import * as tutorial from './tutorial.js';
import * as core from './core.js';
import * as view from './view3d.js';
import * as viewers from './viewers.js';
import { STAGES, EXTRA } from './stages/index.js';

let idx = 0, stage, S, playing = Promise.resolve(), busy = false;
export const state = () => S;
export const current = () => stage;
export const isBusy = () => busy;
export const hazardNow = () => view.hazardStatus();   // 주기 위험 상태: null | 'calm' | 'warn' | 'roll'

// 화면의 자율 행동(배회·시선 뺏기)을 상태에 반영해 다음 AI 호출 때 알린다
view.onWander(() => { if (S && !busy) { S.at = null; S.near = '구역 안을 돌아다니며 둘러보는 중'; } });
view.onNotice(id => { if (S) S.noticed = id; });
// 주기 위험(굴러온 바위)에 맞음: 재생 중인 행동을 끊고 쓰러진다
let playToken = 0, before = null;
const snapshot = s => structuredClone({ area: s.area, entry: s.entry, flags: s.flags, inv: s.inv, at: s.at, checkpoint: s.checkpoint, visited: s.visited, asking: s.asking });
view.onHazard(reason => {
  if (!S || S.dead || S.cleared) return;
  playToken++; view.interrupt();
  // 행동 도중(예: 출구로 걸어가는 중)에 맞았으면 그 행동은 일어나지 않은 것으로 되돌린다.
  // 규칙 판정은 행동을 시작할 때 이미 끝나 있어서, 되돌리지 않으면 죽었는데도 다음 구역으로 넘어간다.
  if (busy && before) { Object.assign(S, before); syncInv(); }
  before = null;
  core.kill(stage, S, reason, '굴러온 바위');
  busy = true;
  const st = S;
  playing = dieAndRespawn(reason).catch(e => console.error(e)).finally(() => { if (st === S) { busy = false; tutorial.check(); } });
});

function syncInv(newIdx = -1) {
  setInv(S.inv.map(name => Object.values(stage.items).find(it => it.name === name) || { icon: '❔', name }), newIdx);
}
function header() {
  viewers.reset(stage, state);
  tutorial.reset(stage, state);
  setTimeout(() => tutorial.check('@start'), 900);
  $('goal').textContent = stage.goal;
  $('stageLabel').textContent = `Stage ${STAGES.includes(stage) ? idx + 1 : '★'} — ${stage.title}`;
}

export function loadStage(i) {
  idx = i; stage = STAGES[i]; busy = false;   // 이전 스테이지의 재생(클리어 연출)이 끝나기를 기다리지 않는다
  S = core.createState(stage);
  $('clear').classList.remove('show'); $('dead').classList.remove('show');
  syncInv(); header();
  view.loadArea(stage, S, S.area, S.entry);
}
export function startFromUrl() {
  const q = new URLSearchParams(location.search).get('stage');
  const extra = EXTRA.find(s => s.id === q);
  if (extra) { stage = extra; idx = -1; S = core.createState(stage); syncInv(); header(); view.loadArea(stage, S, S.area, S.entry); return; }
  const n = Math.max(0, Math.min(STAGES.length - 1, (parseInt(q, 10) || 1) - 1));
  loadStage(n);
}
export function restartStage() {
  if (idx >= 0) loadStage(idx);
  else { S = core.createState(stage); syncInv(); header(); view.loadArea(stage, S, S.area, S.entry); }
}

// AI가 고른 행동을 실행하고, 결과 문장을 바로 돌려준다(다음 AI 호출 때 전달). 화면 재생은 뒤에서 이어진다.
// 걷는 중(아직 아무것도 건드리기 전)이면 시청자 말로 멈춰 세울 수 있다. "멈춰!", "숨어!"가 늦지 않게
let walking = false;
export const canInterrupt = () => busy && walking && before && !S.dead && !S.cleared;
function stopWalk() {
  playToken++; view.interrupt();
  Object.assign(S, before); S.at = null; S.near = '가던 길을 멈추고 길 중간에 서 있음';
  S.history.push('결과 정정: 방금 하려던 행동은 가는 도중에 멈춰서 하지 못했다');
  syncInv(); busy = false; walking = false; before = null;
}

export function perform(a) {
  if (canInterrupt()) stopWalk();
  if (busy) return '아직 앞의 행동이 끝나지 않았다';
  before = snapshot(S);
  const { result, effects } = core.perform(stage, S, a);
  busy = true;
  const st = S, token = ++playToken;
  playing = play(effects, st, token).catch(e => console.error(e)).finally(() => { if (st === S && token === playToken) { busy = false; before = null; tutorial.check(); } });
  return result;
}

async function play(effects, st, token) {
  const spec = id => core.objectById(stage, id);
  for (const e of effects) {
    if (st !== S || token !== playToken) return;               // 재생 중 스테이지가 바뀌었거나 바위에 맞아 끊겼다
    if (e.type === 'moveTo') { walking = true; await view.moveTo(spec(e.obj)); walking = false; }
    else if (e.type === 'act') await view.act(e.kind, spec(e.obj));
    else if (e.type === 'explore') await view.explore();
    else if (e.type === 'gain') { const it = stage.items[e.item]; syncInv(S.inv.lastIndexOf(it.name)); toastItem(it); tutorial.check('@gain'); }
    else if (e.type === 'ask') { S.askedAt = Date.now(); say(e.text, 'normal', 6000); tutorial.check('@ask'); }
    else if (e.type === 'lose') syncInv();
    else if (e.type === 'render') view.render(stage, S);
    else if (e.type === 'goto') {
      // 화면이 어두워지는 사이에 바위에 맞았으면(token이 바뀜) 구역을 옮기지 않는다
      await view.transition(() => { if (token === playToken) view.loadArea(stage, S, e.area, e.entry); });
      if (token === playToken) before = null;                 // 구역을 넘어간 뒤에는 되돌리지 않는다
    }
    else if (e.type === 'enemy') await view.enemy(stage.enemies[e.enemy], spec(e.obj));
    else if (e.type === 'puff') await view.puff(spec(e.obj));
    else if (e.type === 'pop') await view.pop(spec(e.obj));
    else if (e.type === 'die') await dieAndRespawn(e.reason);
    else if (e.type === 'clear') await onClear();
  }
}

async function dieAndRespawn(reason) {
  setFace('sad'); view.setAutonomy(false);
  await view.fall();
  $('deadReason').textContent = reason;
  $('dead').classList.add('show');
  addLine(`💀 한별이 쓰러졌습니다 (${esc(String(S.deaths.length))}번째)`, 'sys');
  await new Promise(ok => setTimeout(ok, 2600));
  core.respawn(stage, S);
  syncInv();
  setTimeout(() => tutorial.check('@death'), 1200);
  await view.transition(() => { $('dead').classList.remove('show'); view.loadArea(stage, S, S.area, S.entry); });
}

// 클리어 보상: 스테이지 데이터의 reward(⚡)를 지갑에 더한다(main.js가 지갑을 가진다)
let rewardHook = () => {};
export const onReward = fn => { rewardHook = fn; };

async function onClear() {
  view.render(stage, S); view.setAutonomy(false);
  if (stage.reward) rewardHook(stage.reward);
  const last = idx < 0 || idx >= STAGES.length - 1;
  $('clearText').textContent = last ? '🎉 ALL CLEAR' : '🎉 STAGE CLEAR';
  $('clear').classList.add('show');
  addLine(`🎉 ${esc(stage.title)} 클리어!`, 'sys');
  if (last) return;
  await new Promise(ok => setTimeout(ok, 3500));
  toast(`다음 스테이지: <em>${esc(STAGES[idx + 1].title)}</em>`, 2500);
  await view.transition(() => loadStage(idx + 1));
  // 이어지는 여정: 앞 스테이지에서 넘어왔다는 것을 한별의 말과 AI 기록으로 잇는다
  if (stage.arrive) {
    if (stage.arrive.history) S.history.push(`결과: ${stage.arrive.history}`);
    if (stage.arrive.say) setTimeout(() => say(stage.arrive.say, 'shout', 4500), 900);
  }
}

/* 테스트 모드용: 구역 바로 가기, 상태 보기 */
export function jumpArea(id) {
  if (!stage.areas[id] || busy) return false;
  const ent = Object.keys(stage.areas[id].entries)[0];
  Object.assign(S, { area: id, entry: ent, at: null, near: null, dead: false });
  if (!S.visited.includes(id)) S.visited.push(id);
  view.loadArea(stage, S, id, ent);
  return true;
}
export const stageIndex = () => idx;

/* AI용 정보 */
export const context = () => ({ ...core.promptContext(stage, S), hazard: view.hazardStatus() });
export const visibleObjects = () => core.objectsIn(stage, S);
