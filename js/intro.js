/* 인트로 화면(docs/specs/intro-guide-sound.md 1장)
   - 페이지를 열면 인트로가 먼저 뜨고, "게임 시작"을 누를 때까지 방송 전체(3D 시간·AI 턴·시청자 채팅·방송 시간)가 멈춘다.
   - 스테이지는 뒤에서 미리 불러 둔다(시작하자마자 화면이 바로 나오게). 튜토리얼 첫 카드는 시작한 뒤에 뜬다.
   - "게임 시작" 클릭이 브라우저의 첫 사용자 입력이라 소리도 이때 켜진다(js/sfx.js).
   - 개발 모드에서는 ?intro=off(또는 ?test, ?shot)로 건너뛴다. 배포 모드에서는 언제나 나온다. */
import { $ } from './ui.js';
import { hasFlag, flag, LOCAL } from './env.js';
import { setPaused, setIntro } from './pause.js';
import * as sfx from './sfx.js';

// "개발 문서 보기" 버튼이 여는 주소: 구글 드라이브 PDF 공유 링크("링크가 있는 모든 사용자")를 여기에 넣는다.
// 포트폴리오 파일은 저장소에 올리지 않으므로, 비어 있으면 내 컴퓨터에서는 로컬 portfolio.html을 열고 배포된 사이트에서는 버튼을 숨긴다.
const DOC_URL = '';
const doc = $('introDoc'), docUrl = DOC_URL || (LOCAL ? 'portfolio.html' : '');
if (doc && docUrl) { doc.href = docUrl; doc.hidden = false; }

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
