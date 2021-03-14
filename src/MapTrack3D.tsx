import React, { useRef, useEffect, useCallback } from 'react';

import { PanelProps, DataFrame, LegacyGraphHoverEvent } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { SystemJS } from '@grafana/runtime';

import { css, cx } from 'emotion';

import { MapTrack3DOptions } from 'types';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import earthTexture from './img/earth.jpg';
import earthBumpMap from './img/earthBumpMap.jpg';

const DEFAULT_ALT = 10;

type TimeVec3 = { t: number; x: number; y: number; z: number };
type TimeLLZ = { t: number; lat: number; lon: number; z: number };

interface Props extends PanelProps<MapTrack3DOptions> {}
interface ThreeJSObjectsI {
  pathGeometry: THREE.BufferGeometry | null;
  scene: THREE.Scene | null;
  camera: any;
  renderer: any;
  animationRequestId: any;
  earthMaterial: THREE.MeshBasicMaterial | THREE.MeshPhysicalMaterial;
  earthMesh: THREE.Mesh | null;
  markerMesh: THREE.Mesh | null;
  cartPath: TimeVec3[];
}

function llToCart(lat: number, long: number, alt: number) {
  var cart = { x: 0, y: 0, z: 0 };
  lat = lat * (Math.PI / 180);
  long = long * (Math.PI / 180);
  cart.x = -alt * Math.cos(lat) * Math.cos(long);
  cart.y = alt * Math.sin(lat);
  cart.z = alt * Math.cos(lat) * Math.sin(long);
  return cart;
}

function readTimePosData(series: DataFrame, options: MapTrack3DOptions): TimeLLZ[] {
  const latitudeField = series.fields.find((field) => field.name === options.latitudeColumnName);
  const longitudeField = series.fields.find((field) => field.name === options.longitudeColumnName);
  const timeField = series.fields.find((field) => field.name === options.timeColumnName);
  const altitudeField = series.fields.find((field) => field.name === options.altitudeColumnName);

  if (!latitudeField || !longitudeField || !timeField) {
    return [];
  }

  const len = Math.min(timeField.values.length, latitudeField.values.length, longitudeField.values.length);

  var dataset: TimeLLZ[] = [];
  for (var i = 0; i < len; i++) {
    dataset.push({
      t: timeField.values.get(i) as number,
      lat: latitudeField.values.get(i),
      lon: longitudeField.values.get(i),
      z: !altitudeField || i >= altitudeField.values.length ? DEFAULT_ALT : altitudeField.values.get(i),
    });
  }

  return dataset;
}

export const MapTrack3D: React.FC<Props> = ({ options, data, width, height }) => {
  const render = function () {
    if (threeJsObjects.current.renderer != null) {
      threeJsObjects.current.renderer.render(threeJsObjects.current.scene, threeJsObjects.current.camera);
    }
  };

  const texturePath = options.customTextureURL ? options.customTextureURL : earthTexture;

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const threeJsObjects = useRef<ThreeJSObjectsI>({
    pathGeometry: null,
    scene: null,
    camera: null,
    renderer: null,
    animationRequestId: null,
    earthMaterial: new THREE.MeshPhysicalMaterial({
      bumpMap: new THREE.TextureLoader().load(earthBumpMap, render),
    }),
    earthMesh: null,
    markerMesh: null,
    cartPath: [],
  });

  // const theme = useTheme();
  const styles = getStyles();

  const earthRad = 6731000;
  const markerRad = 200000;
  const scale = 100000;

  // Updates the position of the line marker that points to the center of the globe
  const updateLineMarker = (scene: THREE.Scene, point: TimeVec3) => {
    const lineMarker = scene.getObjectByName('lineMarker');
    if (lineMarker !== undefined) {
      scene.remove(lineMarker);
    }
    const points = [];
    points.push(new THREE.Vector3(0, 0, 0));
    points.push(new THREE.Vector3(point.x, point.y, point.z));
    const l = new THREE.BufferGeometry().setFromPoints(points);
    const newLineMarker = new THREE.Line(l, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 }));
    newLineMarker.name = 'lineMarker';
    scene.add(newLineMarker);
  };

  SystemJS.load('app/core/app_events').then((appEvents: any) => {
    console.log(appEvents);
    appEvents.subscribe(LegacyGraphHoverEvent, (ev: LegacyGraphHoverEvent) => {
      console.log(ev);
      const e = ev.payload;
      threeJsObjects.current.cartPath?.find((point) => {
        if (point.t >= e.pos.x && threeJsObjects.current.markerMesh !== null) {
          if (threeJsObjects.current.scene) {
            updateLineMarker(threeJsObjects.current.scene, point);
          }
          threeJsObjects.current.markerMesh.position.x = point.x;
          threeJsObjects.current.markerMesh.position.y = point.y;
          threeJsObjects.current.markerMesh.position.z = point.z;
          render();
          return true;
        }
        return false;
      });
    });
  });

  const loadNewTexture = useCallback(() => {
    const texture = new THREE.TextureLoader().load(texturePath, render);
    threeJsObjects.current.earthMaterial.map = texture;
  }, [texturePath]);

  useEffect(() => {
    const c = new THREE.Scene();
    const earthGeom = new THREE.SphereGeometry(earthRad / scale, 64, 64);
    const globe = new THREE.Mesh(earthGeom, threeJsObjects.current.earthMaterial);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(markerRad / scale, 10, 10));
    c.add(marker);
    c.add(globe);

    threeJsObjects.current.earthMesh = globe;
    threeJsObjects.current.scene = c;
    threeJsObjects.current.markerMesh = marker;
  }, []);

  useEffect(() => {
    var orbit: THREE.Vector3[] = [];
    threeJsObjects.current.cartPath = [];
    threeJsObjects.current.pathGeometry = new THREE.BufferGeometry();

    if (data.series.length < 1) {
      console.log('No data series provided');
      return;
    }

    const llzArray = readTimePosData(data.series[0], options);
    if (llzArray.length === 0) {
      console.log('Data series length is 0');
      return;
    }

    var last_llz = llzArray[0];

    for (var i = 0; i < llzArray.length; i++) {
      var llz = llzArray[i];

      const φ1 = (last_llz.lat * Math.PI) / 180,
        φ2 = (llz.lat * Math.PI) / 180,
        Δλ = ((llz.lon - last_llz.lon) * Math.PI) / 180;
      const d = Math.acos(Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * earthRad;

      if (d > 100000) {
        const λ1 = (last_llz.lon * Math.PI) / 180;
        const λ2 = (llz.lon * Math.PI) / 180;

        var k = Math.floor(Math.abs(d / 100000));
        for (var j = 0; j < k; ++j) {
          const ad = d / earthRad;
          const f = (1 / (k + 1)) * (j + 1);
          const a = Math.sin((1 - f) * ad) / Math.sin(ad);
          const b = Math.sin(f * ad) / Math.sin(ad);
          const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
          const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
          const z = a * Math.sin(φ1) + b * Math.sin(φ2);
          const φi = Math.atan2(z, Math.sqrt(x * x + y * y));
          const λi = Math.atan2(y, x);

          var llzinterp = {
            lat: φi / (Math.PI / 180),
            lon: λi / (Math.PI / 180),
            z: last_llz.z + ((llz.z - last_llz.z) / (k + 1)) * (j + 1),
          };
          llzinterp.z = earthRad / scale + llzinterp.z / scale;
          var carti = llToCart(llzinterp.lat, llzinterp.lon, llzinterp.z);
          orbit.push(new THREE.Vector3(carti.x, carti.y, carti.z));
        }
      }
      last_llz = { ...llz };
      llz.z = earthRad / scale + llz.z / scale;
      var cart = llToCart(llz.lat, llz.lon, llz.z);
      threeJsObjects.current.cartPath.push({ t: llz.t, ...cart });
      orbit.push(new THREE.Vector3(cart.x, cart.y, cart.z));
    }

    if (threeJsObjects.current.pathGeometry) {
      threeJsObjects.current.pathGeometry.setFromPoints(orbit);
    }
  }, [data, options]);

  useEffect(() => {
    if (threeJsObjects.current.pathGeometry) {
      // Remove old path mesh
      const oldPathMesh = threeJsObjects.current.scene?.getObjectByName('path');
      if (oldPathMesh !== undefined) {
        console.log('removing old line');
        threeJsObjects.current.scene?.remove(oldPathMesh);
      }

      console.log('generating new line');
      const l = new THREE.Line(
        threeJsObjects.current.pathGeometry,
        new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 1 })
      );
      l.name = 'path';
      threeJsObjects.current.scene?.add(l);
    }
  }, [data]);

  useEffect(() => {
    loadNewTexture();
  }, [options.customTextureURL, loadNewTexture]);

  // Camera configuration
  useEffect(() => {
    // Aspect is not import, as it is configured in a separate hook
    const c = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    c.position.set(0, 20, (earthRad * 2) / scale);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set((earthRad / scale) * 10, 0, (earthRad / scale) * 10);
    c.add(light);

    threeJsObjects.current.camera = c;
    threeJsObjects.current.scene?.add(c);
  }, []);

  // Renderer Configuration
  useEffect(() => {
    const r = new THREE.WebGLRenderer({ canvas: canvasRef.current as HTMLCanvasElement, alpha: true });
    r.setClearColor(0x000000, 0);
    const controls = new OrbitControls(threeJsObjects.current.camera, r.domElement);
    threeJsObjects.current.renderer = r;
    controls.addEventListener('change', render);
    render();
  }, []);

  // Window resize handling
  useEffect(() => {
    threeJsObjects.current.renderer.setSize(width, height);
    const c = threeJsObjects.current.renderer.domElement;
    threeJsObjects.current.camera.aspect = c.clientWidth / c.clientHeight;
    threeJsObjects.current.camera.updateProjectionMatrix();
    render();
  }, [width, height]);

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
};

const getStyles = stylesFactory(() => {
  return {
    wrapper: css`
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
  };
});
