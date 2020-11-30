import React from 'react';

import { PanelProps } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { SystemJS } from '@grafana/runtime';

import { css, cx } from 'emotion';
import { useRef, useEffect, useCallback } from 'react';

import { MapTrack3DOptions } from 'types';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import earthTexture from './img/earth.jpg';
import earthBumpMap from './img/earthBumpMap.jpg';

type TimeVec3 = { t: number; x: number; y: number; z: number };

interface Props extends PanelProps<MapTrack3DOptions> {}
interface ThreeJSObjectsI {
  pathGeometry: THREE.Geometry | null;
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

export const MapTrack3D: React.FC<Props> = ({ options, data, width, height }) => {
  const render = function() {
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
  const defaultPathAltitude = 10;

  // Updates the position of the line marker that points to the center of the globe
  const updateLineMarker = (scene: THREE.Scene, point: TimeVec3) => {
    const lineMarker = scene.getObjectByName('lineMarker');
    if (lineMarker !== undefined) {
      scene.remove(lineMarker);
    }
    const l = new THREE.Geometry();
    l.vertices.push(new THREE.Vector3(0, 0, 0));
    l.vertices.push(new THREE.Vector3(point.x, point.y, point.z));
    const newLineMarker = new THREE.Line(
      l,
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: options.lineWidth })
    );
    newLineMarker.name = 'lineMarker';
    scene.add(newLineMarker);
  };

  // Show marker on the panel when user hovers over other graphs
  SystemJS.load('app/core/app_events').then((appEvents: any) => {
    appEvents.on('graph-hover', (e: any) => {
      threeJsObjects.current.cartPath?.find(point => {
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
    //Add orbit path
    var orbit = new THREE.Geometry();
    threeJsObjects.current.pathGeometry = orbit;
    threeJsObjects.current.cartPath = [];

    if (data.series.length < 2) {
      return;
    }

    const lat_points = data.series[0].fields[1].values;
    const lon_points = data.series[1].fields[1].values;
    const timestamps = data.series[0].fields[0].values;

    var orbitLength = lat_points.length;

    var last_llz = { latitude: lat_points.get(0), longitude: lon_points.get(0), altitude: 0 };
    last_llz.altitude = data.series.length >= 3 ? data.series[2].fields[1].values.get(0) : defaultPathAltitude;

    for (var i = 0; i < orbitLength; i++) {
      var llz = { latitude: lat_points.get(i), longitude: lon_points.get(i), altitude: defaultPathAltitude };
      if (data.series.length >= 3) {
        llz.altitude =
          data.series[2].fields[1].values.length > i
            ? data.series[2].fields[1].values.get(i)
            : data.series[2].fields[1].values.get(0);
      }

      const φ1 = (last_llz.latitude * Math.PI) / 180,
        φ2 = (llz.latitude * Math.PI) / 180,
        Δλ = ((llz.longitude - last_llz.longitude) * Math.PI) / 180;
      const d = Math.acos(Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)) * earthRad;

      if (d > 100000) {
        const λ1 = (last_llz.longitude * Math.PI) / 180;
        const λ2 = (llz.longitude * Math.PI) / 180;

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
            latitude: φi / (Math.PI / 180),
            longitude: λi / (Math.PI / 180),
            altitude: last_llz.altitude + ((llz.altitude - last_llz.altitude) / (k + 1)) * (j + 1),
          };
          llzinterp.altitude = earthRad / scale + llzinterp.altitude / scale;
          var carti = llToCart(llzinterp.latitude, llzinterp.longitude, llzinterp.altitude);
          orbit.vertices.push(new THREE.Vector3(carti.x, carti.y, carti.z));
        }
      }
      last_llz = { ...llz };
      llz.altitude = earthRad / scale + llz.altitude / scale;
      var cart = llToCart(llz.latitude, llz.longitude, llz.altitude);
      threeJsObjects.current.cartPath.push({ t: timestamps.get(i) as number, ...cart });
      orbit.vertices.push(new THREE.Vector3(cart.x, cart.y, cart.z));
    }
  }, [data]);

  useEffect(() => {
    if (threeJsObjects.current.pathGeometry) {
      // Remove old path mesh
      const oldPathMesh = threeJsObjects.current.scene?.getObjectByName('path');
      if (oldPathMesh !== undefined) {
        threeJsObjects.current.scene?.remove(oldPathMesh);
      }

      if (threeJsObjects.current.pathGeometry.vertices.length > 1) {
        const l = new THREE.Line(
          threeJsObjects.current.pathGeometry,
          new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: options.lineWidth })
        );
        l.name = 'path';
        threeJsObjects.current.scene?.add(l);
      }
    }
  }, [options.lineWidth, data]);

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
