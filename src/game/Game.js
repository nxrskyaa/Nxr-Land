import * as THREE from 'three';
import { World, WORLD_BOUNDS, WORLD_COLLIDERS } from './World.js';
import { Input } from './Input.js';
import { CameraController } from './Camera.js';
import { Player } from '../entities/Player.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';

const MAX_DELTA_SECONDS = 0.05;
const WORLD_WIDTH = 40;
const WORLD_HEIGHT = 30;
const CAMERA_MARGIN = 1.08;

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

export function getOrthographicBounds(aspect = 1, worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT, margin = CAMERA_MARGIN) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const halfHeight = Math.max(worldHeight * margin / 2, worldWidth * margin / (2 * safeAspect));
  const halfWidth = halfHeight * safeAspect;
  return { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight };
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
    this.disposed = false;
    this.frameId = null;
    this.elapsed = 0;
    this.lastTime = 0;

    try {
      const createRenderer = rendererFactory ?? ((options) => new THREE.WebGLRenderer(options));
      this.renderer = createRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setClearColor(0xbfe3dd, 1);
      this.renderer.shadowMap.enabled = state?.settings?.graphics?.shadows !== false;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.domElement.className = 'game-canvas';
      this.renderer.domElement.setAttribute('aria-label', 'Nxr Land village diorama');
      this.renderer.domElement.setAttribute('aria-describedby', 'landmark-description');
      this.container.append(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xbfe3dd);
      this.scene.fog = new THREE.Fog(0xcde7dc, 42, 78);
      this.camera = new THREE.OrthographicCamera(-16, 16, 13, -13, 0.1, 100);
      this.camera.position.set(25, 27, 31);
      this.camera.lookAt(0, 0, 0);
      this.#addLighting();
      this.world = new World(this.scene, { state });
      this.raycaster = new THREE.Raycaster();
      this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this.input = new Input({
        canvas: this.renderer.domElement,
        container: this.container,
        onAction: () => this.#handleAction(),
        screenToWorld: (x, y) => this.#screenToWorld(x, y),
      });
      this.player = new Player({
        scene: this.scene,
        state,
        input: this.input,
        bounds: WORLD_BOUNDS,
        colliders: WORLD_COLLIDERS,
        eventBus,
        saveManager,
      });
      this.cameraController = new CameraController(this.camera, {
        bounds: WORLD_BOUNDS,
        target: this.player.root.position,
        framing: { x: 11, z: 8 },
      });
      const enterGame = () => {
        this.input?.setEnabled(true);
        this.container.classList.add('character-ready');
      };
      if (state?.player?.creatorComplete) enterGame();
      else {
        this.creator = new CharacterCreator({
          container: this.container,
          state,
          player: this.player,
          eventBus,
          saveManager,
          onComplete: enterGame,
        });
      }
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
    this.keyLight = key;
    key.position.set(-12, 24, 15);
    key.castShadow = this.renderer.shadowMap.enabled;
    key.shadow.mapSize.set(1024, 1024);
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

  #screenToWorld(clientX, clientY) {
    if (!this.renderer?.domElement || !this.camera || !this.raycaster) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, point) ? { x: point.x, z: point.z } : null;
  }

  #handleAction() {
    this.eventBus?.emit?.('player:action', { position: { ...this.state.player.position } });
    const feedback = this.container.querySelector('.action-feedback');
    if (!feedback) return;
    feedback.textContent = 'Nothing nearby — keep exploring';
    feedback.classList.add('is-visible');
    clearTimeout(this.actionFeedbackTimer);
    this.actionFeedbackTimer = setTimeout(() => feedback.classList.remove('is-visible'), 1300);
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
    if (this.running || this.disposed) return;
    this.running = true;
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
    const safeDelta = clampDelta(delta);
    this.world?.update(safeDelta, elapsed);
    this.player?.update(safeDelta, elapsed);
    this.cameraController?.update(safeDelta);
  }

  render() {
    if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const metrics = getRenderMetrics(this.container.getBoundingClientRect(), window.devicePixelRatio);
    this.renderer.setPixelRatio(metrics.pixelRatio);
    this.renderer.setSize(metrics.width, metrics.height, false);
    const bounds = getOrthographicBounds(metrics.aspect);
    Object.assign(this.camera, bounds);
    const mobile = metrics.width < 700;
    this.camera.zoom = mobile ? 1.08 : 1.28;
    this.camera.updateProjectionMatrix();
    this.cameraController?.setFraming(mobile ? { x: 14, z: 10 } : { x: 11, z: 8 });

    const lowPower = mobile || metrics.pixelRatio > 1.75;
    const shadowSize = lowPower ? 512 : 1024;
    if (this.keyLight && this.keyLight.shadow.mapSize.width !== shadowSize) {
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
      this.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    }
    this.renderer.shadowMap.autoUpdate = !lowPower;
    if (lowPower) this.renderer.shadowMap.needsUpdate = true;
    const viewportHeight = bounds.top - bounds.bottom;
    this.world?.setLabelScale(Math.min(1.6, viewportHeight / (WORLD_HEIGHT * CAMERA_MARGIN)));
  }

  stop() {
    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined' && this.boundResize) window.removeEventListener('resize', this.boundResize);
    if (this.renderer?.domElement && this.#handleContextLost) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.#handleContextLost);
    }
    clearTimeout(this.actionFeedbackTimer);
    this.creator?.dispose();
    this.input?.dispose();
    this.cameraController?.dispose();
    this.player?.dispose();
    this.world?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
    this.world = null;
    this.player = null;
    this.input = null;
    this.creator = null;
    this.cameraController = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.keyLight = null;
  }
}
