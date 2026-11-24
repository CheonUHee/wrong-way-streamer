/* 인트로 화면(docs/specs/intro-guide-sound.md 1장)
   - 페이지를 열면 인트로가 먼저 뜨고, "게임 시작"을 누를 때까지 방송 전체(3D 시간·AI 턴·시청자 채팅·방송 시간)가 멈춘다.
   - 스테이지는 뒤에서 미리 불러 둔다(시작하자마자 화면이 바로 나오게). 튜토리얼 첫 카드는 시작한 뒤에 뜬다.
   - "게임 시작" 클릭이 브라우저의 첫 사용자 입력이라 소리도 이때 켜진다(js/sfx.js).
   - 개발 모드에서는 ?intro=off(또는 ?test, ?shot)로 건너뛴다. 배포 모드에서는 언제나 나온다. */
import { $ } from './ui.js';
import { hasFlag, flag } from './env.js';
import { setPaused, setIntro } from './pause.js';
import * as sfx from './sfx.js';

const skip = flag('intro') === 'off' || hasFlag('test') || hasFlag('shot');
let resolve;
export const started = new Promise(ok => { resolve = ok; });

if (skip) { $('intro').remove(); document.body.classList.remove('intro-on'); resolve(); }
else {
  setIntro(true); setPaused(true);
  const btn = $('introStart');
  setTimeout(() => btn.focus({ preventScroll: true }), 400);
  btn.onclick = () => {
    sfx.unlock(); sfx.play('chat.send');
    $('intro').classList.add('hide'); document.body.classList.remove('intro-on');
    setTimeout(() => $('intro').remove(), 600);
    setIntro(false); setPaused(false);
    resolve();
    $('input')?.focus({ preventScroll: true });
  };
}
