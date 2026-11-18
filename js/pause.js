/* 일시정지: 튜토리얼 창이 떠 있는 동안 3D 화면·스트리머 턴·채팅·시청자·방송 시간을 모두 멈춘다. */
let paused = false, waiters = [], resumeFns = [];
export const onResume = fn => resumeFns.push(fn);
export const isPaused = () => paused;
export function setPaused(on) {
  paused = on;
  document.body.classList.toggle('paused', on);
  if (!on) { const w = waiters; waiters = []; w.forEach(ok => ok()); resumeFns.forEach(fn => fn()); }
}
// 멈춰 있으면 풀릴 때까지 기다린다
export const whenResumed = () => paused ? new Promise(ok => waiters.push(ok)) : Promise.resolve();
