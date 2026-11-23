/* 플레이 가이드 그림용 화면 캡처(개발 전용). ?shot 이 붙은 개발 모드에서만 불러온다(main.js).
   사용: 개발 서버(python tools/serve.py 8080)에서 ?ai=off&auto=off&viewers=off&shot&test 로 열고
        콘솔에서 await __guideShots() → assets/guide/<이름>.webp 로 저장된다(640×360).
   그림 위의 화살표·말풍선·채팅은 js/tutorial.js 의 ART 가 SVG로 얹는다. 장면을 바꾸면 그쪽 좌표도 맞춘다. */
import * as St from './stage.js';

// [이름, 스테이지 순번, 구역, 카메라 위치 [x, z], 바라볼 곳 [x, y, z], 눈높이 더하기, 기다릴 조건]
const SCENES = [
  ['room1', 0, 'room1', [0, 2.9], [0, 0.8, -4], 0.1],                 // 빨간 버튼(왼쪽) · 오리(오른쪽) · 문
  ['room2', 0, 'room2', [-0.4, 2.9], [0.8, 0.8, -4], 0.1],           // 책상 위 열쇠(오른쪽) · 잠긴 문
  ['room3', 0, 'room3', [0, 3.3], [0, 1.3, -4], 0.15],               // 두 문과 안내판
  ['glade', 1, 'glade', [0, 1.2], [0, -40, 0.6], 15],                // 갈림길 공터를 바로 위에서
  ['valley', 2, 'lower', [1.2, 24], [-1.0, 1.3, 6], 1.0, () => { const h = window.__hz(); return h.phase === 'roll' && h.mesh.position.z > 1 && h.mesh.position.z < 8; }, [-3.4, 0.9, 15]],   // 굴러오는 바위와 왼쪽 두 번째 틈새
];
const wait = ms => new Promise(r => setTimeout(r, ms));

async function save(name, dataUrl) {
  const im = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = dataUrl; });
  const W = 640, H = 360, cv = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = cv.getContext('2d');
  // 가운데를 16:9로 잘라 줄인다
  const r = Math.min(im.width / W, im.height / H), sw = W * r, sh = H * r;
  g.imageSmoothingQuality = 'high';
  g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, W, H);
  const blob = await new Promise(ok => cv.toBlob(ok, 'image/webp', 0.82));
  const res = await fetch('/__guide?name=' + name, { method: 'POST', body: blob });
  return `${name}: ${res.ok ? 'OK' : 'FAIL ' + res.status} ${(blob.size / 1024).toFixed(0)}KB`;
}

window.__guideShots = async (only) => {
  const out = [];
  for (const [name, idx, area, pos, look, h, until, mark] of SCENES) {
    if (only && !only.includes(name)) continue;
    if (St.stageIndex() !== idx) { St.loadStage(idx); await wait(4000); }
    if (St.state().area !== area) { St.jumpArea(area); await wait(3000); }
    window.__arms(false);   // 한별의 팔은 그림에서 뺀다
    window.__view(pos, look, h); await wait(900);
    if (until) for (let t = 0; t < 400 && !until(); t++) await wait(50);   // 최대 20초
    window.__view(pos, look, h); await wait(120);
    const shot = window.__shot();
    // mark: 그림 위 표시를 놓을 자리(월드 좌표) → 320×180 그림 좌표로 알려 준다(tutorial.js ART에 옮겨 적는다)
    if (mark) { const [nx, ny, cw, ch] = window.__project(...mark), r = Math.min(cw / 640, ch / 360), sw = 640 * r, sh = 360 * r;
      const px = ((nx + 1) / 2 * cw - (cw - sw) / 2) / sw * 320, py = ((1 - ny) / 2 * ch - (ch - sh) / 2) / sh * 180;
      out.push(`${name} 표시 자리: (${px.toFixed(0)}, ${py.toFixed(0)})`); }
    out.push(await save(name, shot));
  }
  window.__arms(true);
  return out;
};
