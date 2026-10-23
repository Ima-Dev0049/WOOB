import * as THREE from 'three';
import { SCENE3D_BUDGET } from '@/lib/creative/scene3d';

export type Scene3DRuntimeOptions = {
  preset: 'orbital' | 'prism';
  quality: 'low' | 'balanced';
  autoRotate: boolean;
  interactive: boolean;
  onContextLost: () => void;
};

export type Scene3DRuntime = {
  setActive: (active: boolean) => void;
  setAutoRotate: (autoRotate: boolean) => void;
  setInteractive: (interactive: boolean) => void;
  setPaused: (paused: boolean) => void;
  rotate: (direction: -1 | 1) => void;
  dispose: () => void;
};

function themeColor(host: HTMLElement, variable: string, fallback: string): THREE.Color {
  const value = getComputedStyle(host).getPropertyValue(variable).trim();
  try { return new THREE.Color(value || fallback); }
  catch { return new THREE.Color(fallback); }
}

/** Mounted only through a dynamic import from Scene3D. No assets or remote models. */
export function mountScene3D(host: HTMLElement, options: Scene3DRuntimeOptions): Scene3DRuntime {
  const quality = options.quality;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: quality === 'balanced',
    powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SCENE3D_BUDGET.maxPixelRatio[quality]));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'scene3d-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  host.dataset.sceneEngine = 'three';
  host.dataset.sceneRunning = 'false';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 6.2);
  const group = new THREE.Group();
  scene.add(group);

  const primary = themeColor(host, '--site-primary', '#6D4AFF');
  const accent = themeColor(host, '--site-accent', '#FF7A59');
  const detail = SCENE3D_BUDGET.geometryDetail[quality];
  const coreGeometry = options.preset === 'orbital'
    ? new THREE.IcosahedronGeometry(1.2, detail)
    : new THREE.OctahedronGeometry(1.45, detail);
  const coreMaterial = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.3, metalness: 0.58, flatShading: true });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);

  const cageGeometry = options.preset === 'orbital'
    ? new THREE.IcosahedronGeometry(1.65, 1)
    : new THREE.BoxGeometry(2.65, 2.65, 2.65);
  const cageMaterial = new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.34 });
  const cage = new THREE.Mesh(cageGeometry, cageMaterial);
  cage.rotation.set(0.35, 0.2, 0.15);
  group.add(cage);

  const orbitGeometry = new THREE.TorusGeometry(2.05, 0.012, 4, 80);
  const orbitMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.65 });
  const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbit.rotation.set(options.preset === 'orbital' ? 1.15 : 0.45, 0.2, 0.4);
  group.add(orbit);

  const particleCount = SCENE3D_BUDGET.particles[quality];
  const positions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    const y = 1 - (index / Math.max(1, particleCount - 1)) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * 2.399963229728653;
    const distance = 2.2 + ((index * 13) % 7) * 0.045;
    positions[index * 3] = Math.cos(angle) * ringRadius * distance;
    positions[index * 3 + 1] = y * 1.85;
    positions[index * 3 + 2] = Math.sin(angle) * ringRadius * distance;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particlesMaterial = new THREE.PointsMaterial({ color: accent, size: 0.035, transparent: true, opacity: 0.68 });
  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x11111c, 2.2);
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
  keyLight.position.set(3, 4, 5);
  const rimLight = new THREE.PointLight(accent, 18, 12, 2);
  rimLight.position.set(-3, -1, 3);
  scene.add(hemisphere, keyLight, rimLight);

  let disposed = false;
  let active = false;
  let paused = false;
  let autoRotate = options.autoRotate;
  let interactive = options.interactive;
  let frame = 0;
  let lastTime = 0;
  let automaticAngle = 0;
  let manualAngle = 0;
  let pointerX = 0;
  let pointerY = 0;

  const updateTransform = () => {
    group.rotation.x = 0.16 + pointerX;
    group.rotation.y = -0.35 + automaticAngle + manualAngle + pointerY;
    particles.rotation.y = -automaticAngle * 0.35 + manualAngle * 0.2;
  };
  const renderOnce = () => {
    if (!disposed && !document.hidden) renderer.render(scene, camera);
  };
  const setRunning = (running: boolean) => { host.dataset.sceneRunning = String(running); };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    setRunning(false);
  };
  const shouldAnimate = () => !disposed && active && !paused && autoRotate && !document.hidden;
  const tick = (time: number) => {
    frame = 0;
    if (!shouldAnimate()) { setRunning(false); return; }
    const delta = Math.min(40, Math.max(0, time - lastTime)) / 1000;
    lastTime = time;
    automaticAngle += delta * 0.24;
    orbit.rotation.z += delta * 0.08;
    updateTransform();
    renderer.render(scene, camera);
    setRunning(true);
    frame = requestAnimationFrame(tick);
  };
  const syncLoop = () => {
    if (shouldAnimate()) {
      if (!frame) {
        lastTime = performance.now();
        setRunning(true);
        frame = requestAnimationFrame(tick);
      }
    } else {
      stop();
      if (active) renderOnce();
    }
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderOnce();
  };
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  if (resizeObserver) resizeObserver.observe(host);
  else window.addEventListener('resize', resize);
  resize();

  const onPointerMove = (event: PointerEvent) => {
    if (!interactive || !active || document.hidden) return;
    const bounds = host.getBoundingClientRect();
    pointerY = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 0.5;
    pointerX = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 0.28;
    updateTransform();
    if (!shouldAnimate()) renderOnce();
  };
  const onPointerLeave = () => {
    pointerX = 0;
    pointerY = 0;
    updateTransform();
    if (!shouldAnimate()) renderOnce();
  };
  const onVisibilityChange = () => syncLoop();
  const onContextLost = (event: Event) => {
    event.preventDefault();
    if (!disposed) options.onContextLost();
  };
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibilityChange);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  updateTransform();
  renderOnce();

  return {
    setActive(value) { active = value; syncLoop(); },
    setAutoRotate(value) { autoRotate = value; syncLoop(); },
    setInteractive(value) { interactive = value; if (!value) onPointerLeave(); },
    setPaused(value) { paused = value; host.dataset.scenePaused = String(value); syncLoop(); },
    rotate(direction) {
      manualAngle += direction * Math.PI / 8;
      updateTransform();
      renderOnce();
      host.dataset.sceneRotation = manualAngle.toFixed(3);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.sceneEngine;
      delete host.dataset.sceneRotation;
    },
  };
}
