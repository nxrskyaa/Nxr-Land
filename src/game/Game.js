import * as THREE from 'three';
import { World } from './World.js';

const MAX_DELTA_SECONDS = 0.05;
const CAMERA_SIZE = 36;

export function clampDelta(delta) {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(delta, MAX_DELTA_SECONDS);
}

export function getRenderMetrics(rect = {}, devicePixelRatio = 1) {
  const width = Math.max(1, Math.round(Number(rect.width) || 1));
  const height = Math.max(1, Math.round(Number(rect.height) || 1));
  const pixelRatio = Math.min(2, Math.max(1, Number(devicePixelRatio) || 1));
  return { width, height, pixelRatio, aspect: width / height };
}

export class Game {
  constructor({ container, state, eventBus, saveManager, rendererFactory, onFatal } = {}) {
    if (!container) throw new Error('Game requires a container element');
    this.container = container;
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.onFatal = onFatal;
    this.running = false;
    this.frameId = null;
    this.elapsed = 0;
    this.lastTime = 0;
    this.clock = new THREE.Clock(false);

    try {
      const createRenderer = rendererFactory ?? ((options) => new THREE.WebGLRenderer(options));
      this.renderer = createRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setClearColor(0xbfe3dd, 1);
      this.renderer.shadowMap.enabled = state?.settings?.graphics?.shadows !== false;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.domElement.className = 'game-canvas';
      this.renderer.domElement.setAttribute('aria-label', 'Nxr Land village diorama');
      this.container.append(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xbfe3dd);
      this.scene.fog = new THREE.Fog(0xcde7dc, 42, 78);
      this.camera = new THREE.OrthographicCamera(-16, 16, 13, -13, 0.1, 100);
      this.camera.position.set(25, 27, 31);
      this.camera.lookAt(0, 0, 0);
      this.#addLighting();
      this.world = new World(this.scene, { state });
      this.#observeResize();
      this.resize();
      this.#handleContextLost = (event) => {
        event.preventDefault();
        this.stop();
        this.onFatal?.(new Error('The WebGL context was lost.'));
      };
      this.renderer.domElement.addEventListener('webglcontextlost', this.#handleContextLost);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  #handleContextLost;

  #addLighting() {
    const hemisphere = new THREE.HemisphereLight(0xfff4dc, 0x5c7969, 2.25);
    const key = new THREE.DirectionalLight(0xffd3a0, 3.65);
    key.position.set(-12, 24, 15);
    key.castShadow = this.renderer.shadowMap.enabled;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 22;
    key.shadow.camera.bottom = -22;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0008;
    const fill = new THREE.DirectionalLight(0x9cced0, 1.25);
    fill.position.set(18, 12, -20);
    const rim = new THREE.DirectionalLight(0xffb5ad, 0.9);
    rim.position.set(-15, 8, -18);
    this.scene.add(hemisphere, key, fill, rim);
  }

  #observeResize() {
    this.boundResize = () => this.resize();
    window.addEventListener('resize', this.boundResize, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.boundResize);
      this.resizeObserver.observe(this.container);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.lastTime = performance.now();
    this.update(0, 0);
    this.render();
    this.frameId = requestAnimationFrame((time) => this.#tick(time));
  }

  #tick(time) {
    if (!this.running) return;
    const delta = clampDelta((time - this.lastTime) / 1000);
    this.lastTime = time;
    this.elapsed += delta;
    this.update(delta, this.elapsed);
    this.render();
    this.frameId = requestAnimationFrame((nextTime) => this.#tick(nextTime));
  }

  update(delta, elapsed = this.elapsed) {
    this.world?.update(clampDelta(delta), elapsed);
  }

  render() {
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const metrics = getRenderMetrics(this.container.getBoundingClientRect(), window.devicePixelRatio);
    this.renderer.setPixelRatio(metrics.pixelRatio);
    this.renderer.setSize(metrics.width, metrics.height, false);
    const halfHeight = CAMERA_SIZE / 2;
    this.camera.left = -halfHeight * metrics.aspect;
    this.camera.right = halfHeight * metrics.aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    const lowPower = metrics.width < 700 || metrics.pixelRatio > 1.75;
    this.renderer.shadowMap.autoUpdate = !lowPower;
    if (lowPower) this.renderer.shadowMap.needsUpdate = true;
  }

  stop() {
    this.running = false;
    this.clock.stop();
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  dispose() {
    this.stop();
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined' && this.boundResize) window.removeEventListener('resize', this.boundResize);
    if (this.renderer?.domElement && this.#handleContextLost) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.#handleContextLost);
    }
    this.world?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
    this.world = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}
