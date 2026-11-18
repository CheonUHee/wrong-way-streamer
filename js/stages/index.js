/* 스테이지 목록. 순서대로 진행하며, 클리어하면 다음 스테이지로 넘어간다.
   주소 뒤에 ?stage=2 (순번) 또는 ?stage=demo (id)를 붙이면 해당 스테이지부터 시작한다. */
import stage1 from './stage1.js';
import stage2 from './stage2.js';
import stage3 from './stage3.js';
import stage4 from './stage4.js';
import demo from './demo.js';
import cozy from './cozy.js';

export const STAGES = [stage1, stage2, stage3, stage4];
export const EXTRA = [demo, cozy];    // 목록에는 없지만 ?stage=id 로 열 수 있는 스테이지(엔진 예제)
