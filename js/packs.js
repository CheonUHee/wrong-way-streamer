/* 에셋 팩 경로(브라우저와 node 검증 도구가 함께 쓴다) */
export const MODEL_ROOT = 'assets/models/';
export const PACK = {
  dungeon:   'KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/',
  forest:    'KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/',
  furniture: 'KayKit_Furniture_Bits_1.0_FREE/Assets/gltf/',
  halloween: 'KayKit_HalloweenBits_1.0_FREE/Assets/gltf/',
  proto:     'KayKit_Prototype_Bits_1.1_FREE/Assets/gltf/',
  bath:      'Tiny_Treats_Bubbly_Bathroom_1.1_FREE/Assets/gltf/',
  skeleton:  'KayKit_Skeletons_1.1_FREE/characters/gltf/',
  rig:       'KayKit_Skeletons_1.1_FREE/Animations/gltf/Rig_Medium/',
};
export const modelUrl = (pack, name) =>
  MODEL_ROOT + PACK[pack] + name + (pack === 'skeleton' || pack === 'rig' ? '.glb' : '.gltf');
