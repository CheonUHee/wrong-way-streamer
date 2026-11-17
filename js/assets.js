/* glTF 에셋 불러오기. 같은 파일은 한 번만 내려받고, 쓸 때마다 복제한다. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { modelUrl } from './packs.js';

// KayKit 단위(벽 높이 4, 문 높이 2.8)를 게임 단위(m, 눈높이 1.45)에 맞추는 기본 배율
export const S = 0.8;

const loader = new GLTFLoader();
const cache = new Map();
function load(pack, name) {
  const url = modelUrl(pack, name);
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

// 모델 하나를 복제해서 돌려준다. scale은 최종 배율(기본 S).
export async function model(pack, name, scale = S) {
  const gltf = await load(pack, name);
  const obj = pack === 'skeleton' ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
  obj.scale.setScalar(scale);
  return obj;
}

// parent 아래에 모델을 놓는다. 불러오기가 끝나기 전에도 parent는 바로 쓸 수 있다.
export function place(parent, pack, name, { pos = [0, 0, 0], rotY = 0, scale = S } = {}) {
  return model(pack, name, scale).then(m => {
    m.position.set(...pos); m.rotation.y = rotY;
    parent.add(m);
    return m;
  }).catch(err => { console.warn('에셋 불러오기 실패:', pack, name, err); return null; });
}

// 복제본끼리 재질을 공유하므로, 색을 바꿀 모델은 재질을 따로 복제한다.
export function ownMaterials(obj) {
  obj.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
  return obj;
}

// KayKit 캐릭터 공용 애니메이션(Rig_Medium). 이름 → AnimationClip
let clipsP;
export function clips() {
  clipsP ||= Promise.all([load('rig', 'Rig_Medium_General'), load('rig', 'Rig_Medium_MovementBasic')])
    .then(gs => Object.fromEntries(gs.flatMap(g => g.animations).map(c => [c.name, c])));
  return clipsP;
}
