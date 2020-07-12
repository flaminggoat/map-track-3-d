import React from 'react';
import ReactDOM from 'react-dom';
import { PanelProps } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';
import { useRef, useState } from 'react';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import earthTexture from './img/earth.jpg';

interface Props extends PanelProps<SimpleOptions> {}

export const MapTrack3D: React.FC<Props> = ({ options, data, width, height }) => {
  const canvasRef = React.useRef(null);
  const theme = useTheme();
  const styles = getStyles();

  console.log(data.series);

  function llToCart(lat: number, long: number, alt: number) {
    var cart = { x: 0, y: 0, z: 0 };
    lat = lat * (Math.PI / 180);
    long = long * (Math.PI / 180);
    cart.x = -alt * Math.cos(lat) * Math.cos(long);
    cart.y = alt * Math.sin(lat);
    cart.z = alt * Math.cos(lat) * Math.sin(long);
    return cart;
  }

  React.useEffect(() => {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });
    renderer.setSize(width, height);

    var earthRad = 6731000;
    var scale = 100000;
    const texture = new THREE.TextureLoader().load(earthTexture);
    var earthGeom = new THREE.SphereGeometry(earthRad / scale, 64, 64);
    var material = new THREE.MeshBasicMaterial({ map: texture });
    //var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    var earth = new THREE.Mesh(earthGeom, material);
    var controls = new OrbitControls(camera, renderer.domElement);

    earth.rotation.y += Math.PI; // align texture file

    camera.position.set(0, 20, (earthRad * 2) / scale);

    //Add orbit path
    if (data.series.length >= 2) {
      var orbit = new THREE.Geometry();
      const lat_points = data.series[0].fields[1].values;
      const lon_points = data.series[1].fields[1].values;

      var orbitLength = lat_points.length;

      var last_llz = { latitude: lat_points.get(i), longitude: lon_points.get(i), altitude: 0 };
      last_llz.altitude = data.series.length >= 3 ? data.series[2].fields[1].values.get(i) : 10;

      for (var i = 0; i < orbitLength; i++) {
        var llz = { latitude: lat_points.get(i), longitude: lon_points.get(i), altitude: 0 };
        llz.altitude = data.series.length >= 3 ? data.series[2].fields[1].values.get(i) : 10;
        console.log(llz);

        const lat_delta = llz.latitude - last_llz.latitude;
        const lon_delta = llz.longitude - last_llz.longitude;
        if (Math.abs(lat_delta) > 1 || Math.abs(lon_delta) > 1) {
          var k = 0;
          if (Math.abs(lat_delta) > Math.abs(lon_delta)) {
            k = Math.floor(Math.abs(lat_delta));
          } else {
            k = Math.floor(Math.abs(lon_delta));
          }
          for (var j = 0; j < k; ++j) {
            var llzinterp = {
              latitude: last_llz.latitude + (lat_delta / (k + 1)) * (j + 1),
              longitude: last_llz.longitude + (lon_delta / (k + 1)) * (j + 1),
              altitude: last_llz.altitude + ((llz.altitude - last_llz.altitude) / (k + 1)) * (j + 1),
            };
            console.log(llzinterp);
            llzinterp.altitude = earthRad / scale + llzinterp.altitude / scale;
            // llzinterp.latitude = llzinterp.latitude / (Math.PI / 180);
            // llzinterp.longitude = llzinterp.longitude / (Math.PI / 180);
            var carti = llToCart(llzinterp.latitude, llzinterp.longitude, llzinterp.altitude);
            orbit.vertices.push(new THREE.Vector3(carti.x, carti.y, carti.z));
          }
        }
        last_llz = { ...llz };
        llz.altitude = earthRad / scale + llz.altitude / scale;
        // llz.latitude = llz.latitude / (Math.PI / 180);
        // llz.longitude = llz.longitude / (Math.PI / 180);
        var cart = llToCart(llz.latitude, llz.longitude, llz.altitude);
        orbit.vertices.push(new THREE.Vector3(cart.x, cart.y, cart.z));
      }
      var orbitLine = new THREE.Line(
        orbit,
        new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: options.lineWidth })
      );
      scene.add(orbitLine);
    }

    scene.add(earth);

    var animate = function() {
      requestAnimationFrame(animate);
      //earth.rotation.x += 0.001;
      // earth.rotation.y += 0.001;
      renderer.render(scene, camera);
    };
    animate();
  });

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
