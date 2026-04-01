import { WorkspaceRadarData } from '@worknest/client/types/radars';

export type RadarDataGetQueryInput = {
  type: 'radar.data.get';
};

export type RadarDataGetQueryOutput = Record<string, WorkspaceRadarData>;

declare module '@worknest/client/queries' {
  interface QueryMap {
    'radar.data.get': {
      input: RadarDataGetQueryInput;
      output: RadarDataGetQueryOutput;
    };
  }
}
