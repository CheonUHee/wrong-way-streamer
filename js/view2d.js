/* 임시 2D 게임 화면(3D 이전 버전). view3d.js와 같은 함수(reset, render, moveTo, act)를 제공한다. */
import { $ } from './ui.js';

$('scene').innerHTML = `<div class="scene2d"><div class="scene-label">2D 임시 화면</div><div class="floor"></div><div id="objs"></div><div class="pc" id="pc" title="게임 속 캐릭터">🙂</div></div>`;
const wait = ms => new Promise(ok => setTimeout(ok, ms));

export function reset(stage) { const s = stage.start; $('pc').style.left = s.x + '%'; $('pc').style.top = s.y + '%'; }
export function render(G, objects) {
  const state = { door: G.doorOpen && 'open', lever: G.doorOpen && 'down', box: G.boxOpened && 'opened' };
  $('objs').innerHTML = objects.map(o =>
    `<div class="obj ${o.cls} ${state[o.id] || ''}" style="left:${o.x}%;top:${o.y}%;width:${o.w}%;height:${o.h}%">${o.icon}</div>`).join('');
  $('clear').classList.toggle('show', G.cleared);
}
export function moveTo(o) {
  $('pc').style.left = (o.x + o.w / 2) + '%'; $('pc').style.top = Math.min(70, o.y + o.h + 5) + '%';
  return wait(1000);
}
export const act = () => Promise.resolve();
