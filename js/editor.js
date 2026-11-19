/* 소품 편집기(테스트 모드 안): 배경 소품(decor)을 화면에서 직접 놓고, 옮기고, 지운다.
   - 켜면 그 구역의 decor가 편집용 복제본으로 바뀐다. 조준점(화면 가운데) 자리에 고른 모델의 미리보기가 따라다닌다.
   - 마우스 포인터가 가리키는 자리에 미리보기가 따라다닌다. 왼쪽 클릭: 놓기 · 오른쪽 드래그: 시점 돌리기 · WASD: 이동
     R / Shift+R: 15° 회전 · 마우스 휠: 크기 · G: 가리킨 소품 집기(옮기기) · X: 지우기 · Z: 되돌리기 · Q: 가리킨 소품의 모델 고르기
   - 결과: '파일에 저장'(개발 서버 python tools/serve.py 에서만)이 스테이지 파일의 decor 배열을 고쳐 쓴다.
     원래 있던 줄은 주석까지 그대로 두고, 바뀐 줄만 새로 쓴다. 저장 뒤 새로고침하면 게임에 반영된다.
     서버 저장이 안 되면 '전체 decor 복사'로 배열을 복사해 직접 붙여 넣는다.
   - 자동 꾸미기(js/dress.js)가 놓은 소품은 편집 대상이 아니다(데이터가 아니라 규칙으로 만든다). */
import * as THREE from 'three';
import { $, esc, addLine } from './ui.js';
import { place, ownMaterials, S } from './assets.js';
import * as view from './view3d.js';
import { current, state } from './stage.js';
import MODELS from './models.js';

let on = false, items = [], undo = [], key = '', ghost = null, ghostSpec = null, rot = 0, scale = S, held = null;
const store = {};                                   // 구역별 편집 상태(편집기를 껐다 켜도 유지): { items, undo }
export const editorOn = () => on;

export function initEditor(panel) {
  const box = document.createElement('details');
  box.className = 'edbox'; box.id = 'edBox';
  box.innerHTML = `<summary>🧱 소품 편집기</summary>
    <div class="trow">
      <label><input type="checkbox" id="edOn"> 편집 켜기</label>
      <label>팩 <select id="edPack">${Object.keys(MODELS).map(p => `<option>${p}</option>`).join('')}</select></label>
      <input id="edFind" placeholder="모델 이름 찾기" spellcheck="false">
      <select id="edModel" size="1"></select>
      <span id="edInfo" class="tkeys"></span>
    </div>
    <div class="trow tkeys">왼쪽 클릭: 놓기 · 오른쪽 드래그: 시점 · WASD 이동 · R / Shift+R: 15° 회전 · 휠: 크기 · G: 가리킨 소품 옮기기 · X: 지우기 · Z: 되돌리기 · Q: 가리킨 소품 모델 고르기</div>
    <div class="trow">
      <button id="edSave">💾 파일에 저장</button>
      <button id="edCopyAll">전체 decor 복사</button>
      <button id="edCopyNew">새로 놓은 것만 복사</button>
      <button id="edReset">이 구역 처음 상태로</button>
      <span id="edCount" class="tkeys"></span>
    </div>`;
  panel.append(box);
  const fill = () => {
    const q = $('edFind').value.trim().toLowerCase();
    const list = MODELS[$('edPack').value].filter(n => !q || n.toLowerCase().includes(q));
    $('edModel').innerHTML = list.map(n => `<option>${esc(n)}</option>`).join('');
    pickModel();
  };
  $('edPack').onchange = fill; $('edFind').oninput = fill; $('edModel').onchange = pickModel;
  $('edOn').onchange = e => setOn(e.target.checked);
  $('edSave').onclick = save;
  $('edCopyAll').onclick = () => copy(items.map(lineOf).join('\n'), '전체 decor');
  $('edCopyNew').onclick = () => copy(items.filter(it => it.orig == null).map(lineOf).join('\n'), '새로 놓은 소품');
  $('edReset').onclick = () => { delete store[key]; load(); addLine('🧱 이 구역의 편집을 처음 상태로 되돌렸습니다.', 'sys'); };
  $('edPack').value = 'forest'; fill();
  view.onArea(() => { if (on) load(); });
}

/* ── 켜기·끄기 ── */
export function setOn(v) {
  on = v; $('edOn').checked = v;
  view.setDecorHidden(v); view.setClickLock(!v);
  if (v) load(); else { view.edGroup.clear(); clearGhost(); held = null; }
  addLine(v ? '🧱 소품 편집기 켜짐: 마우스로 가리킨 자리에 클릭해서 놓으세요. 오른쪽 드래그로 시점을 돌립니다.' : '🧱 소품 편집기 꺼짐(저장하지 않은 편집은 이 창을 닫기 전까지 남아 있어요).', 'sys');
}

// 지금 구역의 편집 상태를 만들고(처음이면 스테이지 파일의 decor에서) 화면에 그린다
function load() {
  const st = current(), S2 = state(); if (!st || !S2) return;
  key = `${st.id}/${S2.area}`;
  if (!store[key]) store[key] = {
    items: (st.areas[S2.area].decor || []).map(([pack, name, pos, rotY = 0, sc = S], i) => ({ pack, name, pos: [...pos], rotY, scale: sc, orig: i, changed: false })),
    undo: [],
  };
  ({ items, undo } = store[key]);
  held = null; draw();
}
let gen = 0;                                        // 다시 그릴 때마다 늘어난다(늦게 불러온 이전 모델은 버린다)
function draw() {
  view.edGroup.clear();
  const g = ++gen;
  items.forEach((it, i) => place(view.edGroup, it.pack, it.name, { pos: view.liftPos(it.pos), rotY: it.rotY, scale: it.scale })
    .then(m => { if (m) { m.userData.edIdx = i; if (!on || g !== gen) view.edGroup.remove(m); } }));
  const added = items.filter(it => it.orig == null).length, changed = items.filter(it => it.changed).length;
  const removed = (current().areas[state().area].decor || []).length - items.filter(it => it.orig != null).length;
  $('edCount').textContent = `소품 ${items.length}개 · 새로 ${added} · 바뀜 ${changed} · 지움 ${removed}`;
}

/* ── 미리보기(고스트) ── */
function pickModel(spec) {
  const [pack, name] = spec || [$('edPack').value, $('edModel').value];
  if (!name) return clearGhost();
  ghostSpec = [pack, name]; clearGhost(true);
  place(view.ghostGroup, pack, name, { scale }).then(m => {
    if (!m || ghostSpec?.[1] !== name) return m && view.ghostGroup.remove(m);
    ownMaterials(m).traverse(x => { if (x.isMesh) { x.material.transparent = true; x.material.opacity = 0.55; x.material.depthWrite = false; } });
    ghost = m;
  });
  info();
}
function clearGhost(keepSpec) { view.ghostGroup.clear(); ghost = null; if (!keepSpec) ghostSpec = null; }
const info = () => { $('edInfo').textContent = ghostSpec ? `${ghostSpec[0]}/${ghostSpec[1]} · 회전 ${Math.round(rot * 180 / Math.PI)}° · 크기 ${scale.toFixed(2)}${held ? ' · ✋ 옮기는 중' : ''}` : ''; };
const snap = v => Math.round(v * 20) / 20;           // 5cm 단위
const ground = y => (y < 0.3 ? 0 : snap(y));         // 풀·바닥 타일 위면 땅(0)에, 상자·책상 위면 그 높이에 놓는다
let aim = null, mouse = null;                       // mouse: 캔버스 위 포인터의 화면 좌표(-1~1). 없으면 화면 가운데
setInterval(() => {
  if (!on) return;
  aim = view.probe(document.pointerLockElement ? null : mouse);
  view.ghostGroup.visible = !!(ghost && aim.hit);
  if (ghost && aim.hit) {
    ghost.position.set(...view.liftPos([snap(aim.hit[0]), ground(aim.hit[1]), snap(aim.hit[2])]));
    ghost.rotation.y = rot; ghost.scale.setScalar(scale);
  }
}, 40);

/* ── 조작 ── */
function push() { undo.push(items.map(it => ({ ...it, pos: [...it.pos] }))); if (undo.length > 50) undo.shift(); }
function putHere() {
  if (!ghostSpec || !aim?.hit) return;
  push();
  const it = { pack: ghostSpec[0], name: ghostSpec[1], pos: [snap(aim.hit[0]), ground(aim.hit[1]), snap(aim.hit[2])], rotY: Math.round(rot * 100) / 100, scale: Math.round(scale * 100) / 100, orig: null, changed: false };
  if (held) { it.orig = held.orig; it.changed = held.orig != null; held = null; }
  items.push(it); draw(); info();
}
function grab() {
  if (aim?.edIdx == null) return addLine('🧱 조준점을 편집할 소품에 맞추세요.', 'sys');
  push();
  held = items.splice(aim.edIdx, 1)[0];
  rot = held.rotY; scale = held.scale; pickModel([held.pack, held.name]);
  draw(); info();
}
function remove() {
  if (aim?.edIdx == null) return addLine('🧱 조준점을 지울 소품에 맞추세요.', 'sys');
  push(); items.splice(aim.edIdx, 1); draw();
}
function back() {
  if (!undo.length) return;
  items.length = 0; items.push(...undo.pop()); held = null; draw(); info();
}
function eyedrop() {
  const m = aim?.edIdx != null ? items[aim.edIdx] : null;
  const [pack, name] = m ? [m.pack, m.name] : (aim?.model || '').split('/');
  if (!name || !MODELS[pack]) return;
  $('edPack').value = pack; $('edFind').value = ''; $('edModel').innerHTML = MODELS[pack].map(n => `<option>${esc(n)}</option>`).join(''); $('edModel').value = name;
  if (m) { rot = m.rotY; scale = m.scale; }
  pickModel([pack, name]);
}
addEventListener('keydown', e => {
  if (!on || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.code === 'KeyR') { rot += (e.shiftKey ? -1 : 1) * Math.PI / 12; info(); }
  else if (e.code === 'KeyG') grab();
  else if (e.code === 'KeyX') remove();
  else if (e.code === 'KeyZ') back();
  else if (e.code === 'KeyQ') eyedrop();
});
view.canvas.addEventListener('mousemove', e => {
  if (!on) return;
  const r = view.canvas.getBoundingClientRect();
  mouse = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  if (e.buttons & 2) view.turnView(e.movementX, e.movementY);      // 오른쪽 드래그: 시점
});
view.canvas.addEventListener('mouseleave', () => { mouse = null; });
view.canvas.addEventListener('contextmenu', e => { if (on) e.preventDefault(); });
view.canvas.addEventListener('mousedown', e => {
  if (!on || e.button !== 0) return;
  if (!document.pointerLockElement) {                               // 누른 자리를 바로 다시 재서 놓는다(미리보기가 늦게 따라와도 정확하게)
    const r = view.canvas.getBoundingClientRect();
    mouse = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    aim = view.probe(mouse);
  }
  putHere();
});
view.canvas.addEventListener('wheel', e => {
  if (!on) return; e.preventDefault();
  scale = Math.min(6, Math.max(0.1, scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); info();
}, { passive: false });

/* ── 내보내기 ── */
const n2 = v => String(Math.round(v * 100) / 100);
function lineOf(it) {
  const rotTxt = Math.abs(it.rotY - Math.PI) < 0.005 ? 'Math.PI' : n2(it.rotY);
  return `['${it.pack}', '${it.name}', [${it.pos.map(n2).join(', ')}], ${rotTxt}${Math.abs(it.scale - S) > 0.001 ? `, ${n2(it.scale)}` : ''}],`;
}
function copy(text, what) {
  navigator.clipboard?.writeText(text).then(() => addLine(`🧱 ${what}를 복사했습니다(${text ? text.split('\n').length : 0}줄). 스테이지 파일의 decor 배열에 붙여 넣으세요.`, 'sys'))
    .catch(() => addLine('🧱 복사하지 못했습니다(브라우저가 클립보드를 막음).', 'sys'));
}
// 개발 서버(tools/serve.py)에 보내 스테이지 파일의 decor 배열을 고쳐 쓴다. 바뀌지 않은 원래 줄은 주석까지 그대로 둔다
async function save() {
  const st = current(), area = state().area;
  const body = { stage: st.id, area, items: items.map(it => ({ orig: it.orig, line: it.orig != null && !it.changed ? null : lineOf(it).slice(0, -1) })) };
  try {
    const res = await fetch('/__decor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const msg = await res.text();
    if (!res.ok) throw new Error(msg);
    addLine(`🧱 저장했습니다: <b>${esc(msg)}</b> · 새로고침하면 게임에 반영됩니다.`, 'sys');
  } catch (err) {
    addLine(`🧱 파일에 저장하지 못했습니다(${esc(String(err.message || err).slice(0, 120))}). 개발 서버(python tools/serve.py)로 열었는지 확인하거나, '전체 decor 복사'로 붙여 넣으세요.`, 'sys');
  }
}
