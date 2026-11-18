// 개발용: 모델 크기(배율 1 기준, 노드 이동·배율 반영) 출력. node tools/bbox.mjs pack name...
import fs from 'fs';
import { modelUrl } from '../js/packs.js';
const [pack, ...names] = process.argv.slice(2);
for (const n of names) {
  const g = JSON.parse(fs.readFileSync(modelUrl(pack, n), 'utf8'));
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  const walk = (i, off, sc) => {
    const nd = g.nodes[i], t = nd.translation || [0, 0, 0], s = nd.scale || [1, 1, 1];
    const o = off.map((v, k) => v + t[k] * sc[k]), c = sc.map((v, k) => v * s[k]);
    if (nd.mesh != null) for (const p of g.meshes[nd.mesh].primitives) {
      const a = g.accessors[p.attributes.POSITION];
      for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], o[k] + a.min[k] * c[k]); mx[k] = Math.max(mx[k], o[k] + a.max[k] * c[k]); }
    }
    (nd.children || []).forEach(ch => walk(ch, o, c));
  };
  g.scenes[g.scene || 0].nodes.forEach(i => walk(i, [0, 0, 0], [1, 1, 1]));
  console.log(n.padEnd(28), 'x', mn[0].toFixed(2), mx[0].toFixed(2), ' y', mn[1].toFixed(2), mx[1].toFixed(2), ' z', mn[2].toFixed(2), mx[2].toFixed(2));
}
