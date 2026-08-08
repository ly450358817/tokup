import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cleanupFn = null;
    const initRaf = requestAnimationFrame(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080F);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
    camera.position.set(0, 0.75, 6.2);

    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    /* ── Lights ── */
    const ambient = new THREE.AmbientLight(0x111133, 0.2);
    scene.add(ambient);
    const coreLight = new THREE.PointLight(0x10B981, 3, 30);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);
    const fillLight = new THREE.PointLight(0x3B82F6, 0.4, 25);
    fillLight.position.set(-4, 2, 3);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0x8B5CF6, 0.3, 20);
    rimLight.position.set(3, -2, -4);
    scene.add(rimLight);

    /* ════════════════════════════════════════
      Luminous Nebula Ring — the grand structure
    ════════════════════════════════════════ */

    // ── Dense particle ring (the main nebula disc) ──
    const discCount = 25000;
    const discPos = new Float32Array(discCount * 3);
    const discColors = new Float32Array(discCount * 3);
    const discSizes = new Float32Array(discCount);
    const discData: { angle: number; r: number; yOff: number; speed: number; phase: number }[] = [];

    for (let i = 0; i < discCount; i++) {
      // Bias toward inner edge for density
      const r = 0.8 + Math.pow(Math.random(), 1.8) * 4.5;
      const angle = Math.random() * Math.PI * 2;
      // Thin disc with slight thickness that increases with radius
      const thick = 0.02 + (r - 0.8) / 4.5 * 0.08;
      const yOff = (Math.random() - 0.5) * thick;
      // Density falloff at edges
      const density = 1 - (r - 0.8) / 4.5 * 0.8;

      discPos[i*3] = r * Math.cos(angle);
      discPos[i*3+1] = yOff;
      discPos[i*3+2] = r * Math.sin(angle);

      // Color: inner core bright green, outer fades to teal/blue
      const t = (r - 0.8) / 4.5;
      const green = 0.7 * (1 - t * 0.6);
      const blue = 0.3 + t * 0.4;
      const alpha = 0.1 + Math.random() * 0.5 * density;
      discColors[i*3] = 0.02 * alpha;
      discColors[i*3+1] = green * alpha;
      discColors[i*3+2] = blue * alpha;
      discSizes[i] = (0.006 + Math.random() * 0.02) * (1 - t * 0.3);

      discData.push({
        angle, r, yOff,
        speed: 0.0003 + (1 - t) * 0.001 + Math.random() * 0.0005,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const discBuf = new THREE.BufferGeometry();
    discBuf.setAttribute('position', new THREE.BufferAttribute(discPos, 3));
    discBuf.setAttribute('color', new THREE.BufferAttribute(discColors, 3));
    const discMat = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const disc = new THREE.Points(discBuf, discMat);
    disc.rotation.x = 0.15;
    group.add(disc);

    // ── Outer halo ring — much wider, fainter ──
    const haloCount = 8000;
    const haloPos = new Float32Array(haloCount * 3);
    const haloColors = new Float32Array(haloCount * 3);
    const haloData: { angle: number; r: number; speed: number }[] = [];

    for (let i = 0; i < haloCount; i++) {
      const r = 3.0 + Math.pow(Math.random(), 1.2) * 4.0;
      const angle = Math.random() * Math.PI * 2;
      const thick = 0.1 + (r - 3) / 4 * 0.3;
      const yOff = (Math.random() - 0.5) * thick;

      haloPos[i*3] = r * Math.cos(angle);
      haloPos[i*3+1] = yOff * 0.5;
      haloPos[i*3+2] = r * Math.sin(angle);

      const t = (r - 3) / 4;
      const alpha = 0.02 + Math.random() * 0.08 * (1 - t);
      haloColors[i*3] = 0.05 * alpha;
      haloColors[i*3+1] = 0.5 * alpha;
      haloColors[i*3+2] = 0.3 * alpha;

      haloData.push({ angle, r, speed: 0.0002 + Math.random() * 0.0005 });
    }
    const haloBuf = new THREE.BufferGeometry();
    haloBuf.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
    haloBuf.setAttribute('color', new THREE.BufferAttribute(haloColors, 3));
    const haloMat = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const haloDisc = new THREE.Points(haloBuf, haloMat);
    haloDisc.rotation.x = 0.1;
    group.add(haloDisc);

    // ── Nebula glow layers (sprite-like billboard clouds) ──
    function createGlowLayer(radius: number, color: number, opacity: number, y: number) {
      const gCount = 200;
      const gPos = new Float32Array(gCount * 3);
      for (let i = 0; i < gCount; i++) {
        const r = radius * (0.5 + Math.random() * 0.5);
        const angle = Math.random() * Math.PI * 2;
        gPos[i*3] = r * Math.cos(angle);
        gPos[i*3+1] = y + (Math.random() - 0.5) * 0.1;
        gPos[i*3+2] = r * Math.sin(angle);
      }
      const gBuf = new THREE.BufferGeometry();
      gBuf.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
      const gMat = new THREE.PointsMaterial({
        color,
        size: 0.3 + Math.random() * 0.5,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const gMesh = new THREE.Points(gBuf, gMat);
      gMesh.rotation.x = 0.15;
      return gMesh;
    }

    group.add(createGlowLayer(1.5, 0x10B981, 0.03, 0));
    group.add(createGlowLayer(2.5, 0x10B981, 0.02, 0.05));
    group.add(createGlowLayer(3.5, 0x34D399, 0.015, -0.03));
    group.add(createGlowLayer(4.5, 0x3B82F6, 0.01, 0.02));

    /* ════════════════════════════════════════
      Central Singularity — bright core
    ════════════════════════════════════════ */

    // Data core — dense cluster of tiny luminous points
    const corePointCount = 400;
    const corePos = new Float32Array(corePointCount * 3);
    const coreSizes = new Float32Array(corePointCount);
    const coreColors = new Float32Array(corePointCount * 3);
    const cpData: { theta: number; phi: number; r: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < corePointCount; i++) {
      const r = Math.pow(Math.random(), 1.5) * 0.35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      corePos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      corePos[i*3+1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      corePos[i*3+2] = r * Math.cos(phi);
      coreSizes[i] = 0.008 + Math.random() * 0.025;
      const bright = 0.3 + Math.random() * 0.7;
      coreColors[i*3] = 0.05 * bright;
      coreColors[i*3+1] = 0.72 * bright;
      coreColors[i*3+2] = 0.50 * bright;
      cpData.push({ theta, phi, r, phase: Math.random() * Math.PI * 2, speed: 0.0005 + Math.random() * 0.002 });
    }
    const coreBuf = new THREE.BufferGeometry();
    coreBuf.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
    coreBuf.setAttribute('color', new THREE.BufferAttribute(coreColors, 3));
    const coreMat2 = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const dataCore = new THREE.Points(coreBuf, coreMat2);
    dataCore.position.set(0, 0, 0);
    group.add(dataCore);

    // Second layer of even tinier points for depth
    const microCount = 800;
    const microPos = new Float32Array(microCount * 3);
    for (let i = 0; i < microCount; i++) {
      const r = Math.pow(Math.random(), 2) * 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      microPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      microPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      microPos[i*3+2] = r * Math.cos(phi);
    }
    const microBuf = new THREE.BufferGeometry();
    microBuf.setAttribute('position', new THREE.BufferAttribute(microPos, 3));
    const microMat = new THREE.PointsMaterial({
      color: '#10B981',
      size: 0.008,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const microCore = new THREE.Points(microBuf, microMat);
    microCore.position.set(0, 0, 0);
    group.add(microCore);

    /* ════════════════════════════════════════
      Energy streams — converging to center
    ════════════════════════════════════════ */
    const streamCount = 400;
    const streamPos = new Float32Array(streamCount * 3);
    const streamData2: { theta: number; phi: number; dist: number; speed: number }[] = [];
    for (let i = 0; i < streamCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      streamData2.push({ theta, phi, dist: 2 + Math.random() * 5, speed: 0.01 + Math.random() * 0.02 });
    }
    const streamBuf = new THREE.BufferGeometry();
    streamBuf.setAttribute('position', new THREE.BufferAttribute(streamPos, 3));
    const streamMat2 = new THREE.PointsMaterial({
      color: '#6EE7B7',
      size: 0.025,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const streamPoints = new THREE.Points(streamBuf, streamMat2);
    group.add(streamPoints);

    // Stream trails
    const trailCount = streamCount * 3;
    const trailPos = new Float32Array(trailCount * 3);
    const trailData: { parentIdx: number; offset: number }[] = [];
    for (let i = 0; i < trailCount; i++) {
      trailData.push({ parentIdx: i % streamCount, offset: 0.03 + Math.floor(i / streamCount) * 0.04 });
    }
    const trailBuf = new THREE.BufferGeometry();
    trailBuf.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trailMat2 = new THREE.PointsMaterial({
      color: '#10B981',
      size: 0.01,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const trailPoints = new THREE.Points(trailBuf, trailMat2);
    group.add(trailPoints);

    /* ── Background stars ── */
    const bgCount = 1200;
    const bgPos = new Float32Array(bgCount * 3);
    for (let i = 0; i < bgCount; i++) {
      const r = 12 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      bgPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      bgPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta) * 0.2;
      bgPos[i*3+2] = r * Math.cos(phi);
    }
    const bgBuf = new THREE.BufferGeometry();
    bgBuf.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    const bgStars = new THREE.Points(bgBuf, new THREE.PointsMaterial({
      color: '#ffffff', size: 0.025, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false,
    }));
    group.add(bgStars);

    /* ── Interaction ── */
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouse);
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    /* ── Animation ── */
    let time = 0;
    const animate = () => {
      time += 0.005;
      requestAnimationFrame(animate);

      const mx = mouseRef.current.x * 0.15;
      const my = mouseRef.current.y * 0.15;
      group.rotation.x += (my - group.rotation.x) * 0.006;
      group.rotation.y += (mx - group.rotation.y) * 0.006;

      // Disc rotation
      disc.rotation.y += 0.0008;
      haloDisc.rotation.y += 0.0005;

      // Individual particle motion in disc
      const dp = disc.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < discCount; i++) {
        const d = discData[i];
        d.angle += d.speed;
        dp[i*3] = d.r * Math.cos(d.angle);
        dp[i*3+2] = d.r * Math.sin(d.angle);
        // Subtle vertical wave
        dp[i*3+1] = d.yOff + Math.sin(time * 0.3 + d.phase) * 0.005;
      }
      disc.geometry.attributes.position.needsUpdate = true;

      // Halo particle motion
      const hp = haloDisc.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < haloCount; i++) {
        const d = haloData[i];
        d.angle += d.speed;
        hp[i*3] = d.r * Math.cos(d.angle);
        hp[i*3+2] = d.r * Math.sin(d.angle);
      }
      haloDisc.geometry.attributes.position.needsUpdate = true;

      // Data core — shimmering cluster of points
      dataCore.rotation.x += 0.001;
      dataCore.rotation.y += 0.002;
      microCore.rotation.x -= 0.0005;
      microCore.rotation.y += 0.001;
      // Slight breathing
      const cb = 0.5 + Math.sin(time * 0.8) * 0.25;
      dataCore.material.opacity = cb;
      microCore.material.opacity = 0.1 + Math.sin(time * 0.6 + 0.5) * 0.1;

      // Energy streams
      const sp = streamPoints.geometry.attributes.position.array as Float32Array;
      const tp = trailPoints.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < streamCount; i++) {
        const d = streamData2[i];
        d.dist -= d.speed;
        if (d.dist < 0.08) {
          d.dist = 2 + Math.random() * 5;
          d.theta = Math.random() * Math.PI * 2;
          d.phi = Math.acos(2 * Math.random() - 1);
        }
        sp[i*3] = d.dist * Math.sin(d.phi) * Math.cos(d.theta);
        sp[i*3+1] = d.dist * Math.sin(d.phi) * Math.sin(d.theta) * 0.3;
        sp[i*3+2] = d.dist * Math.cos(d.phi);
        for (let j = 0; j < 3; j++) {
          const tIdx = i + j * streamCount;
          const off = trailData[tIdx].offset;
          const td = d.dist + off;
          const useDist = td > 0.08 ? td : 0.08;
          tp[tIdx*3] = useDist * Math.sin(d.phi) * Math.cos(d.theta);
          tp[tIdx*3+1] = useDist * Math.sin(d.phi) * Math.sin(d.theta) * 0.3;
          tp[tIdx*3+2] = useDist * Math.cos(d.phi);
        }
      }
      streamPoints.geometry.attributes.position.needsUpdate = true;
      trailPoints.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

      container.style.transition = "opacity 1.5s ease";
      container.style.opacity = "0";
      requestAnimationFrame(() => { container.style.opacity = "1"; });

      cleanupFn = () => {        window.removeEventListener("mousemove", handleMouse);        window.removeEventListener("resize", handleResize);        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);        renderer.dispose();      };

    });

    return () => {
      cancelAnimationFrame(initRaf);
      if (cleanupFn) cleanupFn();
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, opacity: 0 }} />;
}
