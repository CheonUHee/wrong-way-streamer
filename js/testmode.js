/* 테스트 모드: 스트리머(AI)에게 지시하지 않고 기획자가 맵을 직접 돌아다니며 확인한다.
   - 켜면 AI 턴·다른 시청자·튜토리얼 창이 멈춘다(API 호출 없음). 주소에 ?test 를 붙이면 켜진 채로 시작.
   - 화면 클릭 → 마우스로 시점, WASD 이동, Space/C 위·아래, Shift 빠르게, Esc 마우스 풀기. 벽은 통과한다.
   - E 키: 조준점이 가리키는 오브젝트(없으면 2.5m 안의 가장 가까운 것)와 상호작용한다.
   - 조준점이 가리키는 곳의 좌표·모델 이름이 보인다. P 키: 그 좌표를 decor 한 줄로 복사해 배치 메모에 쌓는다.
   - '보기'는 카메라만 그 앞으로 옮긴다. 나머지 버튼은 규칙을 직접 실행(다가가기·상호작용·줍기·아이템 쓰기)해 퍼즐을 확인한다. 결과는 채팅창에 나온다. */
import { $, esc, addLine } from './ui.js';
import { isTest, setTest } from './pause.js';
import * as view from './view3d.js';
import { state, current, perform, jumpArea, loadStage, stageIndex, visibleObjects, isBusy } from './stage.js';
import { STAGES } from './stages/index.js';
import { initEditor, editorOn, setOn as setEditor } from './editor.js';

const panel = document.createElement('div');
panel.className = 'testpanel'; panel.id = 'testPanel';
panel.innerHTML = `
  <div class="trow">
    <b>🧪 테스트 모드</b>
    <label>스테이지 <select id="tStage">${STAGES.map((s, i) => `<option value="${i}">${i + 1}. ${esc(s.title)}</option>`).join('')}</select></label>
    <label>구역 <select id="tArea"></select></label>
    <label><input type="checkbox" id="tHazard"> 굴러오는 위험 끄기</label>
    <span class="tkeys">화면 클릭 후 마우스 시점 · WASD 이동 · Space/C 위아래 · Shift 빠르게 · E 상호작용 · P 좌표 복사 · Esc 마우스 풀기</span>
  </div>
  <div class="trow"><span id="tState"></span></div>
  <div class="tobjs" id="tObjs"></div>
  <details><summary>배치 메모 (P로 복사한 줄)</summary><textarea id="tNotes" spellcheck="false" placeholder="P 키를 누르면 조준점 좌표가 decor 형식으로 여기에 쌓여요. 모델 이름만 바꿔 스테이지 파일의 decor 배열에 붙여 넣으세요."></textarea></details>`;
document.querySelector('.proto').after(panel);
initEditor(panel);
const probeHud = Object.assign(document.createElement('div'), { className: 'hud probe', id: 'tProbe' });
const cross = Object.assign(document.createElement('div'), { className: 'crosshair' });
$('stage').append(probeHud, cross);

const btn = Object.assign(document.createElement('button'), { className: 'pill-btn', id: 'testBtn', textContent: '🧪 테스트 모드' });
$('guideBtn').before(btn);
btn.onclick = () => toggle(!isTest());

function toggle(on) {
  setTest(on);
  document.body.classList.toggle('testing', on);
  btn.classList.toggle('on', on);
  view.setFreeCam(on);
  if (!on) { view.setHazardOff(false); $('tHazard').checked = false; if (editorOn()) setEditor(false); }
  addLine(on ? '🧪 테스트 모드 켜짐: AI·시청자·튜토리얼이 멈췄습니다. 화면을 클릭해 직접 움직여 보세요.' : '🧪 테스트 모드 꺼짐: 스트리머가 다시 움직입니다.', 'sys');
  refresh(true);
}

$('tStage').onchange = e => { loadStage(+e.target.value); refresh(true); };
$('tArea').onchange = e => { if (!jumpArea(e.target.value)) addLine('🧪 행동이 끝난 뒤에 다시 골라 주세요.', 'sys'); refresh(true); };
$('tHazard').onchange = e => view.setHazardOff(e.target.checked);

// 오브젝트 버튼: 규칙 엔진을 직접 실행한다(AI가 고르는 것과 똑같은 행동)
const ACTS = [['view', '보기'], ['move', '다가가기'], ['interact', '상호작용'], ['pickup', '줍기']];
$('tObjs').onclick = e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const row = b.closest('[data-id]'), item = row.querySelector('select')?.value;
  if (b.dataset.act === 'view') {                    // 실행하지 않고 카메라만 그 앞으로 옮긴다
    const o = visibleObjects().find(v => v.id === row.dataset.id);
    if (o) view.viewFrom(o.stand || [o.pos[0], o.pos[2] + 2], o.look || o.pos);
    return;
  }
  const a = { type: b.dataset.act, target: row.dataset.id, item: b.dataset.act === 'use' ? item : undefined };
  const result = perform(a);
  addLine(`🧪 ${esc(a.type)} → ${esc(a.target)}${a.item ? ` (${esc(a.item)})` : ''}: <b>${esc(result)}</b>`, 'sys');
  setTimeout(() => refresh(true), 300);
};

let lastKey = '';
function refresh(force) {
  if (!isTest()) return;
  const st = current(), S = state(); if (!st || !S) return;
  $('tStage').value = String(stageIndex());
  const areaOpts = Object.entries(st.areas).map(([id, a]) => `<option value="${id}"${id === S.area ? ' selected' : ''}>${esc(a.name || id)}</option>`).join('');
  if ($('tArea').innerHTML !== areaOpts) $('tArea').innerHTML = areaOpts;
  const flags = Object.entries(S.flags).filter(([, v]) => v).map(([k]) => k);
  $('tState').innerHTML = `📍 ${esc(st.areas[S.area]?.name || S.area)} · 🚩 ${flags.length ? esc(flags.join(', ')) : '플래그 없음'} · 🎒 ${S.inv.length ? esc(S.inv.join(', ')) : '빈 가방'}${S.dead ? ' · 💀 쓰러짐' : ''}${S.cleared ? ' · 🎉 클리어' : ''}${isBusy() ? ' · ⏳ 재생 중' : ''}`;
  const objs = visibleObjects(), key = S.area + objs.map(o => o.id).join() + S.inv.join();
  if (!force && key === lastKey) return;
  lastKey = key;
  const items = S.inv.map(n => `<option>${esc(n)}</option>`).join('');
  $('tObjs').innerHTML = objs.map(o => `<div class="tobj" data-id="${esc(o.id)}"><span title="${esc(o.id)}">${esc(o.name)} <small>${esc(o.id)}</small></span>`
    + ACTS.map(([t, l]) => `<button data-act="${t}">${l}</button>`).join('')
    + (items ? `<select>${items}</select><button data-act="use">쓰기</button>` : '') + '</div>').join('');
}

// 조준점 정보(초당 몇 번)
setInterval(() => {
  if (!isTest()) return;
  const p = view.probe();
  probeHud.innerHTML = `📷 카메라 x ${p.cam[0]}, z ${p.cam[2]} (높이 ${p.cam[1]})<br>🎯 ${p.hit ? `x ${p.hit[0]}, y ${p.hit[1]}, z ${p.hit[2]} · ${p.dist}m` : '하늘'}`
    + (p.obj ? `<br>🧩 오브젝트 <b>${esc(p.obj)}</b>` : p.model ? `<br>🪨 ${esc(p.model)}` : '');
  refresh(false);
}, 200);

addEventListener('keydown', e => {
  if (!isTest() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.repeat) return;
  if (e.code === 'KeyE') return aimInteract();
  if (e.code !== 'KeyP' || editorOn()) return;
  const p = view.probe(); if (!p.hit) return;
  const [pack, name] = (p.model || 'forest/Bush_1_A_Color1').split('/');
  const line = `['${pack}', '${name}', [${p.hit[0]}, 0, ${p.hit[2]}], ${p.yaw}],   // ${state().area}`;
  $('tNotes').value += line + '\n';
  navigator.clipboard?.writeText(line).catch(() => {});
  addLine(`🧪 좌표 복사: <code>${esc(line)}</code>`, 'sys');
});

// E 키: 조준점이 가리키는 오브젝트와 상호작용(가리킨 게 없으면 가장 가까운 오브젝트)
function aimInteract() {
  const p = view.probe(), objs = visibleObjects();
  let o = p.obj && objs.find(v => v.id === p.obj);
  if (!o) {
    const [cx, , cz] = p.cam;
    o = objs.map(v => [v, Math.hypot(v.pos[0] - cx, v.pos[2] - cz)]).filter(([, d]) => d < 2.5).sort((a, b) => a[1] - b[1])[0]?.[0];
  }
  if (!o) return addLine('🧪 조준점에 오브젝트가 없어요. 오브젝트를 가운데 점으로 가리키고 E를 누르세요.', 'sys');
  const result = perform({ type: 'interact', target: o.id });
  addLine(`🧪 interact → ${esc(o.id)}: <b>${esc(result)}</b>`, 'sys');
  setTimeout(() => refresh(true), 300);
}

if (new URLSearchParams(location.search).has('test')) setTimeout(() => toggle(true), 50);
