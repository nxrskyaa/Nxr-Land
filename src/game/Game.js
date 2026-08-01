import * as THREE from 'three';
import { World, WORLD_BOUNDS, WORLD_COLLIDERS } from './World.js';
import { Input } from './Input.js';
import { CameraController } from './Camera.js';
import { Player } from '../entities/Player.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { TimeSystem } from '../systems/TimeSystem.js';
import { FarmingSystem } from '../systems/FarmingSystem.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { ShopUI } from '../ui/ShopUI.js';
import { HotbarUI } from '../ui/HotbarUI.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { DialogueUI } from '../ui/DialogueUI.js';
import { QuestUI } from '../ui/QuestUI.js';
import { NPC } from '../entities/NPC.js';
import { NPCFactory } from '../visuals/NPCFactory.js';

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

export function findNearestPlot(position, plotPositions, radius = 1.65) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  let nearest = null;
  for (const [plotId, plotPosition] of Object.entries(plotPositions ?? {})) {
    const distance = Math.hypot(position.x - plotPosition.x, position.z - plotPosition.z);
    if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { plotId, position: plotPosition, distance };
  }
  return nearest;
}

export function chooseInteractionTarget(targets = [], { dialogueOpen = false } = {}) {
  if (dialogueOpen) return { type: 'dialogue' };
  const priority = { quest: 0, npc: 1, farm: 2 };
  return targets
    .filter((target) => Number.isFinite(target?.distance) && Object.hasOwn(priority, target.type))
    .sort((left, right) => priority[left.type] - priority[right.type] || left.distance - right.distance)[0] ?? null;
}

export function getEnteredLocation(position, previousLocation = null) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  const locations = [
    { id: 'town-plaza', inside: Math.abs(position.x) <= 3.2 && position.z >= -3.2 && position.z <= 3.2 },
    { id: 'river-garden', inside: position.x >= 5 && position.x <= 13 && position.z >= -11 && position.z <= -4 },
  ];
  const current = locations.find(({ inside }) => inside)?.id ?? null;
  return current && current !== previousLocation ? current : null;
}

export function choosePlotAction(plot, inventory = {}, selectedHotbarId = null) {
  const explicitSelection = typeof selectedHotbarId === 'string';
  if (plot?.state === 'empty') {
    if (explicitSelection && selectedHotbarId !== 'tool-hoe') {
      return { action: 'status', reason: 'select-hoe' };
    }
    return { action: 'till', tool: 'tool-hoe' };
  }
  if (plot?.state === 'tilled') {
    const selectedCropId = selectedHotbarId?.startsWith?.('seed-')
      ? selectedHotbarId.slice('seed-'.length)
      : null;
    if (selectedCropId && (inventory[selectedHotbarId] ?? 0) > 0) {
      return { action: 'plant', cropId: selectedCropId };
    }
    if (explicitSelection) return { action: 'status', reason: 'select-seed' };
    if ((inventory['seed-turnip'] ?? 0) > 0) return { action: 'plant', cropId: 'turnip' };
    return { action: 'status', reason: 'no-seeds' };
  }
  if (plot?.state === 'planted') {
    if (explicitSelection && selectedHotbarId !== 'tool-watering-can') {
      return { action: 'status', reason: 'select-watering-can' };
    }
    return { action: 'water', tool: 'tool-watering-can' };
  }
  if (plot?.state === 'harvestable') return { action: 'harvest' };
  return { action: 'status' };
}

export function actionSuccessMessage(result = {}) {
  if (result.action === 'till') return 'Soft soil, ready for a seed';
  if (result.action === 'plant') return 'Cloud Turnip planted';
  if (result.action === 'water') return 'Watered — this crop can grow now';
  if (result.action === 'harvest') {
    const item = typeof result.itemId === 'string'
      ? result.itemId.replace('produce-', '')
      : 'crop';
    return `Harvested ${item}`;
  }
  return 'Garden updated';
}

export function saveBeforeDispose(saveManager, state) {
  if (!saveManager?.save) return true;
  try {
    return saveManager.save(state) !== false;
  } catch {
    return false;
  }
}

export function updateFarmingFrame({ timeSystem, farmingSystem, world } = {}, delta = 0) {
  timeSystem?.update?.(delta);
  const changes = farmingSystem?.updateGrowth?.() ?? [];
  world?.syncFarmingPlots?.(farmingSystem);
  return changes;
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
      this.timeSystem = new TimeSystem({ state, eventBus });
      this.farmingSystem = new FarmingSystem({
        state, eventBus, saveManager, plotPositions: this.world.getPlotPositions(),
      });
      this.economySystem = new EconomySystem({ state, eventBus, saveManager });
      this.questSystem = new QuestSystem({ state, eventBus, saveManager });
      this.dialogueUI = new DialogueUI({ container: this.container, eventBus });
      this.questUI = new QuestUI({ container: this.container, questSystem: this.questSystem, eventBus });
      this.npcFactory = new NPCFactory();
      this.npcs = [
        { id: 'mira', name: 'Mira', role: 'Village Steward', position: { x: 3.4, y: 0, z: -0.4 } },
        { id: 'tomo', name: 'Tomo', role: 'Market Keeper', position: { x: -6.7, y: 0, z: 1.2 } },
        { id: 'lumi', name: 'Lumi', role: 'Spirit Researcher', position: { x: 10.4, y: 0, z: -5.6 } },
      ].map((definition) => new NPC({ scene: this.scene, factory: this.npcFactory, definition }));
      this.#buildQuestObjects();
      this.currentLocation = null;
      this.inventoryUI = new InventoryUI({ container: this.container, state, eventBus });
      this.shopUI = new ShopUI({
        container: this.container, state, eventBus, economySystem: this.economySystem,
      });
      this.hotbarUI = new HotbarUI({
        container: this.container, state, eventBus, economySystem: this.economySystem,
      });
      this.world.syncFarmingPlots(this.farmingSystem);
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

  #buildQuestObjects() {
    this.questObjects = new Map();
    this.questObjectResources = { geometries: new Set(), materials: new Set() };
    const geometry = (value) => {
      this.questObjectResources.geometries.add(value);
      return value;
    };
    const material = (color, options = {}) => {
      const value = new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...options });
      this.questObjectResources.materials.add(value);
      return value;
    };
    const addMesh = (root, shape, surface, position = {}) => {
      const mesh = new THREE.Mesh(shape, surface);
      mesh.position.set(position.x ?? 0, position.y ?? 0, position.z ?? 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };

    for (const definition of this.questSystem.getWorldObjects()) {
      const root = new THREE.Group();
      root.name = `Quest object ${definition.id}`;
      root.position.set(definition.position.x, definition.position.y, definition.position.z);
      root.userData.baseY = definition.position.y;
      root.userData.questObjectId = definition.id;
      const leaf = material(0x5d9b58);
      const glow = material(0xf7d978, { emissive: 0xf1b84b, emissiveIntensity: 0.55 });
      const wood = material(0x9a6b49);
      const stone = material(0x91a99d);
      if (definition.id.startsWith('garden-weed-')) {
        for (const [x, z, rotation] of [[-0.2, 0, -0.25], [0.05, 0.05, 0.08], [0.22, -0.05, 0.3]]) {
          const blade = addMesh(root, geometry(new THREE.ConeGeometry(0.12, 0.72, 6)), leaf, { x, y: 0.36, z });
          blade.rotation.z = rotation;
        }
      } else if (definition.id === 'river-spirit-seed') {
        addMesh(root, geometry(new THREE.IcosahedronGeometry(0.38, 1)), glow, { y: 0.82 });
        const ring = addMesh(root, geometry(new THREE.TorusGeometry(0.58, 0.055, 8, 24)), glow, { y: 0.82 });
        ring.rotation.x = Math.PI / 2;
      } else if (definition.id === 'lumi-hatch-nook') {
        addMesh(root, geometry(new THREE.CylinderGeometry(0.72, 0.9, 0.28, 12)), stone, { y: 0.14 });
        const egg = addMesh(root, geometry(new THREE.SphereGeometry(0.42, 12, 9)), glow, { y: 0.76 });
        egg.scale.y = 1.28;
      } else if (definition.id === 'village-planter-site') {
        addMesh(root, geometry(new THREE.BoxGeometry(1.35, 0.58, 0.78)), wood, { y: 0.3 });
        for (const x of [-0.4, 0, 0.4]) {
          addMesh(root, geometry(new THREE.SphereGeometry(0.19, 8, 6)), leaf, { x, y: 0.76 });
        }
      } else {
        addMesh(root, geometry(new THREE.SphereGeometry(0.36, 12, 9)), glow, { y: 0.72 });
        const halo = addMesh(root, geometry(new THREE.TorusGeometry(0.58, 0.07, 8, 24)), glow, { y: 0.72 });
        halo.rotation.y = Math.PI / 2;
      }
      const marker = addMesh(root, geometry(new THREE.OctahedronGeometry(0.2, 0)), glow, { y: 1.7 });
      marker.name = 'Quest marker';
      this.scene.add(root);
      this.questObjects.set(definition.id, { ...definition, root, marker });
    }
    this.questUnsubscribers = ['quest:progress', 'quest:completed', 'quest:started']
      .map((type) => this.eventBus?.on?.(type, () => this.#syncQuestObjects()))
      .filter(Boolean);
    this.#syncQuestObjects();
  }

  #syncQuestObjects() {
    const current = new Map(this.questSystem?.getWorldObjects?.().map((entry) => [entry.id, entry]) ?? []);
    for (const [id, object] of this.questObjects ?? []) {
      const state = current.get(id);
      if (!state) continue;
      object.active = state.active;
      object.used = state.used;
      const persistent = id === 'village-planter-site' || id === 'heartroot-first-light';
      object.root.visible = (state.active && !state.used) || (persistent && state.used);
      object.marker.visible = state.active && !state.used;
      object.root.userData.active = state.active;
      object.root.userData.used = state.used;
    }
  }

  #getInteractionTargets() {
    const position = this.player?.position;
    if (!position) return [];
    const targets = [];
    for (const [id, object] of this.questObjects ?? []) {
      const distance = Math.hypot(position.x - object.position.x, position.z - object.position.z);
      if (object.active && !object.used && distance <= 1.75) {
        targets.push({ type: 'quest', id, label: object.label, distance });
      }
    }
    for (const npc of this.npcs ?? []) {
      const distance = npc.distanceTo(position);
      if (distance <= npc.interactionRadius) {
        targets.push({ type: 'npc', id: npc.id, npc, label: `Talk to ${npc.name}`, distance });
      }
    }
    const plot = findNearestPlot(position, this.world?.getPlotPositions());
    if (plot) targets.push({ type: 'farm', id: plot.plotId, plot, label: 'Tend garden bed', distance: plot.distance });
    return targets;
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
    if (this.dialogueUI?.isOpen()) {
      this.dialogueUI.advance();
      return;
    }
    this.eventBus?.emit?.('player:action', { position: { ...this.state.player.position } });
    const target = chooseInteractionTarget(this.#getInteractionTargets());
    if (target?.type === 'quest') {
      const result = this.questSystem.interact(target.id);
      this.#syncQuestObjects();
      this.#showActionFeedback(result.ok ? target.label : result.message);
      return;
    }
    if (target?.type === 'npc') {
      this.dialogueUI.open(this.questSystem.getDialogue(target.id));
      this.dialogueUI.setPrompt('');
      return;
    }
    const nearby = target?.type === 'farm' ? target.plot : null;
    let message = 'Nothing nearby — keep exploring';
    if (nearby) {
      const plot = this.state.crops.plots.find((entry) => entry.id === nearby.plotId);
      const choice = choosePlotAction(
        plot,
        this.state.economy.inventory,
        this.economySystem?.getSelectedHotbarItem(),
      );
      let result = null;
      if (choice.action === 'till') result = this.farmingSystem.till(plot.id);
      else if (choice.action === 'plant') result = this.farmingSystem.plant(plot.id, choice.cropId);
      else if (choice.action === 'water') result = this.farmingSystem.water(plot.id);
      else if (choice.action === 'harvest') {
        result = this.farmingSystem.harvest(plot.id);
        if (result.ok) this.world.burstHarvest(this.world.getPlotPositions()[plot.id]);
      } else if (choice.reason === 'no-seeds') {
        message = 'This bed is ready — find a seed to plant';
      } else if (choice.reason === 'select-hoe') {
        message = 'Select the Garden Hoe to till this bed';
      } else if (choice.reason === 'select-seed') {
        message = 'Select a seed from the hotbar to plant it';
      } else if (choice.reason === 'select-watering-can') {
        message = 'Select the Watering Can to water this crop';
      } else {
        const visual = this.farmingSystem.getVisualState(plot.id);
        message = visual?.state === 'watered'
          ? 'Water soaked in — growth begins now'
          : `${visual?.stage ?? 'Crop'} growing — ${Math.round((visual?.progress ?? 0) * 100)}%`;
      }
      if (result) {
        if (result.ok) {
          message = actionSuccessMessage(result);
          this.player?.playToolAction?.(result.action);
          this.world.syncFarmingPlots(this.farmingSystem);
        } else message = result.message;
      }
    }
    this.#showActionFeedback(message);
  }

  #showActionFeedback(message) {
    const feedback = this.container.querySelector('.action-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.add('is-visible');
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      feedback.classList.remove('is-visible');
      this.feedbackTimer = null;
    }, 1600);
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
    updateFarmingFrame(this, safeDelta);
    this.world?.update(safeDelta, elapsed);
    this.player?.update(safeDelta, elapsed);
    const location = getEnteredLocation(this.player?.position, null);
    if (location && location !== this.currentLocation) {
      this.eventBus?.emit?.('location:entered', {
        locationId: location,
        position: { ...this.state.player.position },
      });
    }
    this.currentLocation = location;
    for (const npc of this.npcs ?? []) npc.update(safeDelta, elapsed);
    for (const object of this.questObjects?.values?.() ?? []) {
      if (!object.root.visible) continue;
      object.root.position.y = object.root.userData.baseY
        + (object.active ? Math.sin(elapsed * 2.2 + object.id.length) * 0.045 : 0);
      if (object.marker.visible) object.marker.rotation.y += safeDelta * 1.8;
    }
    const promptTarget = chooseInteractionTarget(this.#getInteractionTargets(), {
      dialogueOpen: this.dialogueUI?.isOpen(),
    });
    this.dialogueUI?.setPrompt(promptTarget && promptTarget.type !== 'dialogue' ? promptTarget.label : '');
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
    saveBeforeDispose(this.saveManager, this.state);
    this.disposed = true;
    this.stop();
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined' && this.boundResize) window.removeEventListener('resize', this.boundResize);
    if (this.renderer?.domElement && this.#handleContextLost) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.#handleContextLost);
    }
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.creator?.dispose();
    this.questUnsubscribers?.splice(0).forEach((unsubscribe) => unsubscribe());
    this.dialogueUI?.dispose();
    this.questUI?.dispose();
    this.questSystem?.dispose();
    this.npcs?.forEach((npc) => npc.dispose());
    this.npcFactory?.dispose();
    this.questObjects?.forEach(({ root }) => root.removeFromParent());
    this.questObjectResources?.geometries.forEach((geometry) => geometry.dispose());
    this.questObjectResources?.materials.forEach((material) => material.dispose());
    this.questObjects?.clear();
    this.inventoryUI?.dispose();
    this.shopUI?.dispose();
    this.hotbarUI?.dispose();
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
    this.inventoryUI = null;
    this.shopUI = null;
    this.hotbarUI = null;
    this.dialogueUI = null;
    this.questUI = null;
    this.questSystem = null;
    this.npcs = null;
    this.npcFactory = null;
    this.questObjects = null;
    this.questObjectResources = null;
    this.economySystem = null;
    this.cameraController = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.keyLight = null;
  }
}
