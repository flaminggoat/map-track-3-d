import { PanelPlugin } from '@grafana/data';
import { MapTrack3DOptions } from './types';
import { MapTrack3D } from './MapTrack3D';

export const plugin = new PanelPlugin<MapTrack3DOptions>(MapTrack3D).setPanelOptions((builder) => {
  return builder
    .addTextInput({
      path: 'latitudeColumnName',
      name: 'Latitude column name',
      description: 'Name of the column which contains the latitude of the geo-coordinate',
      category: ['Data selection'],
      defaultValue: 'lat',
    })
    .addTextInput({
      path: 'longitudeColumnName',
      name: 'Longitude column name',
      description: 'Name of the column which contains the longitude of the geo-coordinate',
      category: ['Data selection'],
      defaultValue: 'lon',
    })
    .addTextInput({
      path: 'altitudeColumnName',
      name: 'Altitude column name',
      description: 'Name of the column which contains the altitude values of the series',
      category: ['Data selection'],
      defaultValue: 'alt',
    })
    .addTextInput({
      path: 'timeColumnName',
      name: 'Time column name',
      description: 'Name of the column which contains the time values of the series',
      category: ['Data selection'],
      defaultValue: 'time',
    })
    .addNumberInput({
      path: 'rotateSpeed',
      name: 'Rotation Speed',
      description: 'Speed of rotation when dragging',
      defaultValue: 0.4,
    })
    .addTextInput({
      path: 'customTextureURL',
      name: 'Custom Texture URL',
      description: 'URL of custom texture map image file that covers the full latitude and longitude range.',
      defaultValue: '',
    });
});
