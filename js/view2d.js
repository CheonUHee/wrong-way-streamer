/* 임시 2D 게임 화면. 3D 화면(view3d.js)으로 교체할 때 같은 함수 이름(render, moveTo)을 제공하면 된다. */
import { $ } from './ui.js';

export function render(G, objects) {
  const state = { door: G.doorOpen && 'open', lever: G.doorOpen && 'down', box: G.boxOpened && 'opened' };
  $('objs').innerHTML = objects.map(o =>
    `<div class="obj ${o.cls} ${state[o.id] || ''}" style="left:${o.x}%;top:${o.y}%;width:${o.w}%;height:${o.h}%">${o.icon}</div>`).join('');
  $('clear').classList.toggle('show', G.cleared);
}
// target: 오브젝트(그 앞으로 이동) 또는 시작 지점 {x, y}
export function moveTo(target) {
  const p = target.w ? { x: target.x + target.w / 2, y: Math.min(70, target.y + target.h + 5) } : target;
  $('pc').style.left = p.x + '%'; $('pc').style.top = p.y + '%';
}
