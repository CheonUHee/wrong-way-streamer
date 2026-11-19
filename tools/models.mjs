// 개발용: 소품 편집기가 쓰는 모델 목록(js/models.js)을 만든다. 에셋 폴더에 모델을 추가했으면 다시 실행한다.
// 실행: node tools/models.mjs
import fs from 'fs';
import path from 'path';
import { MODEL_ROOT, PACK } from '../js/packs.js';
const out = {};
for (const [pack, dir] of Object.entries(PACK)) {
  if (pack === 'skeleton' || pack === 'rig') continue;          // 캐릭터·애니메이션은 소품이 아니다
  out[pack] = fs.readdirSync(path.join(MODEL_ROOT, dir)).filter(f => f.endsWith('.gltf')).map(f => f.slice(0, -5)).sort();
}
fs.writeFileSync('js/models.js', `/* 소품 편집기용 모델 목록(자동 생성: node tools/models.mjs). 직접 고치지 마세요. */\nexport default ${JSON.stringify(out, null, 0).replace(/\],/g, '],\n ')};\n`);
console.log(Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', '));
