/* 개발 모드 / 배포 모드
   - 내 컴퓨터(localhost·127.0.0.1·파일로 열기)에서는 개발 모드: 테스트 모드·영역 가이드·설정·프로토타입 컨트롤이 보이고, 주소 옵션(?ai=off 등)이 먹는다.
   - 그 밖의 주소(배포된 사이트)는 배포 모드: 개발용 화면을 모두 숨기고 주소 옵션을 무시한다. AI는 같은 사이트의 중계 서버(/api/gemini)로 부른다.
   - 배포된 사이트에서 개발 화면이 필요하면 주소 뒤에 ?dev, 내 컴퓨터에서 배포 화면을 미리 보려면 ?release */
const q = new URLSearchParams(location.search);
export const LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
export const DEV = q.has('release') ? false : LOCAL || q.has('dev');
// 주소 옵션은 개발 모드에서만 읽는다
export const flag = name => (DEV ? q.get(name) : null);
export const hasFlag = name => DEV && q.has(name);
// 배포된 사이트에서 Gemini를 부르는 중계 서버(api/gemini.js). 키는 중계 서버에만 있다
export const RELAY = LOCAL ? '' : '/api/gemini';

if (!DEV) document.documentElement.classList.add('release');
document.title = DEV ? '스트리머님, 거기 아닌데요! — 개발 모드' : '스트리머님, 거기 아닌데요!';
