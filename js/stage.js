/* 스테이지 진행(브라우저용). 규칙 판정은 core.js, 화면 재생은 view3d.js에 맡기고
   둘을 이어 준다: 행동 → 규칙 판정 → 효과(걷기·손 동작·아이템·구역 이동·적·사망·클리어)를 순서대로 재생. */
import { $, esc, setInv, toastItem, toast, addLine, setFace } from './ui.js';
import * as core from './core.js';
import * as view from './view3d.js';
import { STAGES, EXTRA } from './stages/index.js';

let idx = 0, stage, S, playing = Promise.resolve(), busy = false;
export const state = () => S;
export const current = () => stage;
export const isBusy = () => busy;

function syncInv(newIdx = -1) {
  setInv(S.inv.map(name => Object.values(stage.items).find(it => it.name === name) || { icon: '❔', name }), newIdx);
}
function header() {
  $('goal').textContent = stage.goal;
  $('stageLabel').textContent = `Stage ${STAGES.includes(stage) ? idx + 1 : '★'} — ${stage.title}`;
}

export function loadStage(i) {
  idx = i; stage = STAGES[i];
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
export function perform(a) {
  if (busy) return '아직 앞의 행동이 끝나지 않았다';
  const { result, effects } = core.perform(stage, S, a);
  busy = true;
  const st = S;
  playing = play(effects, st).catch(e => console.error(e)).finally(() => { if (st === S) busy = false; });
  return result;
}

async function play(effects, st) {
  const spec = id => core.objectById(stage, id);
  for (const e of effects) {
    if (st !== S) return;                                      // 재생 중 스테이지가 바뀌었다
    if (e.type === 'moveTo') await view.moveTo(spec(e.obj));
    else if (e.type === 'act') await view.act(e.kind, spec(e.obj));
    else if (e.type === 'gain') { const it = stage.items[e.item]; syncInv(S.inv.lastIndexOf(it.name)); toastItem(it); }
    else if (e.type === 'lose') syncInv();
    else if (e.type === 'render') view.render(stage, S);
    else if (e.type === 'goto') await view.transition(() => view.loadArea(stage, S, e.area, e.entry));
    else if (e.type === 'enemy') await view.enemy(stage.enemies[e.enemy], spec(e.obj));
    else if (e.type === 'die') await dieAndRespawn(e.reason);
    else if (e.type === 'clear') await onClear();
  }
}

async function dieAndRespawn(reason) {
  setFace('sad');
  await view.fall();
  $('deadReason').textContent = reason;
  $('dead').classList.add('show');
  addLine(`💀 한별이 쓰러졌습니다 (${esc(String(S.deaths.length))}번째)`, 'sys');
  await new Promise(ok => setTimeout(ok, 2600));
  core.respawn(stage, S);
  syncInv();
  await view.transition(() => { $('dead').classList.remove('show'); view.loadArea(stage, S, S.area, S.entry); });
}

async function onClear() {
  view.render(stage, S);
  const last = idx < 0 || idx >= STAGES.length - 1;
  $('clearText').textContent = last ? '🎉 ALL CLEAR' : '🎉 STAGE CLEAR';
  $('clear').classList.add('show');
  addLine(`🎉 ${esc(stage.title)} 클리어!`, 'sys');
  if (last) return;
  await new Promise(ok => setTimeout(ok, 3500));
  toast(`다음 스테이지: <em>${esc(STAGES[idx + 1].title)}</em>`, 2500);
  await view.transition(() => loadStage(idx + 1));
}

/* AI용 정보 */
export const context = () => core.promptContext(stage, S);
export const visibleObjects = () => core.objectsIn(stage, S);
