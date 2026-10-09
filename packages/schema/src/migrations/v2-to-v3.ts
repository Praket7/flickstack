import type { FlickProjectV2 } from '../v2/project.ts';
import type { FlickProjectV3 } from '../v3/project.ts';

export function migrateV2ToV3(input:FlickProjectV2):FlickProjectV3 {
  const p=structuredClone(input);
  const {version:_version,...rest}=p;
  return {
    ...rest,
    version:3,
    motionCompositions:[],
    motionComponents:[],
    motionRigs:[],
    motionStyles:[],
  };
}
