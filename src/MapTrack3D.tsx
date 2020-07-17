import React from 'react';
import { PanelProps } from '@grafana/data';
import { MapTrack3DOptions } from 'types';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { useRef, useEffect } from 'react';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import earthTexture from './img/earth.jpg';

interface Props extends PanelProps<MapTrack3DOptions> {}
interface ThreeJSObjectsI {
  pathGeometry: any;
  scene: any;
  pathLine: any;
  camera: any;
  renderer: any;
  animationRequestId: any;
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
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const threeJsObjects = useRef<ThreeJSObjectsI>({
    pathGeometry: null,
    scene: null,
    pathLine: null,
    camera: null,
    renderer: null,
    animationRequestId: null,
  });
  const theme = useTheme();
  const styles = getStyles();

  const earthRad = 6731000;
  const scale = 100000;

  var render = function() {
    if (threeJsObjects.current.renderer != null) {
      threeJsObjects.current.renderer.render(threeJsObjects.current.scene, threeJsObjects.current.camera);
    }
  };

  useEffect(() => {
    const c = new THREE.Scene();
    const texture = new THREE.TextureLoader().load(earthTexture, render);
    const earthGeom = new THREE.SphereGeometry(earthRad / scale, 64, 64);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const earth = new THREE.Mesh(earthGeom, material);
    c.add(earth);
    threeJsObjects.current.scene = c;
  }, []);

  useEffect(() => {
    //Add orbit path
    var orbit = new THREE.Geometry();
    threeJsObjects.current.pathGeometry = orbit;

    if (data.series.length < 2) {
      return;
    }

    const lat_points = data.series[0].fields[1].values;
    const lon_points = data.series[1].fields[1].values;

    var orbitLength = lat_points.length;

    var last_llz = { latitude: lat_points.get(0), longitude: lon_points.get(0), altitude: 0 };
    last_llz.altitude = data.series.length >= 3 ? data.series[2].fields[1].values.get(0) : 10;

    for (var i = 0; i < orbitLength; i++) {
      var llz = { latitude: lat_points.get(i), longitude: lon_points.get(i), altitude: 0 };
      llz.altitude = data.series.length >= 3 ? data.series[2].fields[1].values.get(i) : 10;

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
      orbit.vertices.push(new THREE.Vector3(cart.x, cart.y, cart.z));
    }
  }, [data]);

  useEffect(() => {
    const l = new THREE.Line(
      threeJsObjects.current.pathGeometry,
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: options.lineWidth })
    );
    threeJsObjects.current.scene.add(l);
    threeJsObjects.current.pathLine = l;
  }, []);

  useEffect(() => {
    threeJsObjects.current.pathLine.geometry = threeJsObjects.current.pathGeometry;
  }, [data]);

  useEffect(() => {
    threeJsObjects.current.pathLine.material.linewidth = options.lineWidth;
  }, [options]);

  useEffect(() => {
    const c = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    c.position.set(0, 20, (earthRad * 2) / scale);
    threeJsObjects.current.camera = c;
  }, []);

  useEffect(() => {
    const r = new THREE.WebGLRenderer({ canvas: canvasRef.current as HTMLCanvasElement, alpha: true });
    r.setClearColor( 0x000000, 0 )
    const controls = new OrbitControls(threeJsObjects.current.camera, r.domElement);
    threeJsObjects.current.renderer = r;
    controls.addEventListener('change', render);
    render();
  }, []);

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

      <div className={styles.textBox} hidden={!options.showTextureCopyright}>
        Map Texture Copyright (c) James Hastings-Trew
      </div>
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
