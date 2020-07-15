import { PanelPlugin } from '@grafana/data';
import { MapTrack3DOptions } from './types';
import { MapTrack3D } from './MapTrack3D';

export const plugin = new PanelPlugin<MapTrack3DOptions>(MapTrack3D).setPanelOptions(builder => {
  return builder
    .addNumberInput({
      path: 'lineWidth',
      name: 'Line Width',
      description: 'Width of the track line',
      defaultValue: 3,
    })
    .addBooleanSwitch({
      path: 'showTextureCopyright',
      name: 'Show Texture copyright notice',
      defaultValue: true,
    });
});
