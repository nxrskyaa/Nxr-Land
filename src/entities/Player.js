import { CharacterFactory } from '../visuals/CharacterFactory.js';
import { moveWithCollisions, validateSpawn } from '../game/Collision.js';

const MAX_DELTA = 0.05;
const MAX_SPEED = 4.2;
const ACCELERATION = 16;
const FRICTION = 12;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function approach(value, target, amount) {
  if (value < target) return Math.min(target, value + amount);
  if (value > target) return Math.max(target, value - amount);
  return value;
}

export function stepMotion(motion, input, delta, options = {}) {
  if (!Number.isFinite(delta) || delta <= 0) return motion;
  const dt = Math.min(delta, MAX_DELTA);
  const maxSpeed = finite(options.maxSpeed, MAX_SPEED);
  const acceleration = finite(options.acceleration, ACCELERATION);
  const friction = finite(options.friction, FRICTION);
  const hasInput = Math.hypot(finite(input?.x), finite(input?.z)) > 0.001;
  const targetX = hasInput ? finite(input.x) * maxSpeed : 0;
  const targetZ = hasInput ? finite(input.z) * maxSpeed : 0;
  const amount = (hasInput ? acceleration : friction) * dt;
  const velocity = {
    x: approach(finite(motion?.velocity?.x), targetX, amount),
    z: approach(finite(motion?.velocity?.z), targetZ, amount),
  };
  return {
    position: {
      x: finite(motion?.position?.x) + velocity.x * dt,
      z: finite(motion?.position?.z) + velocity.z * dt,
    },
    velocity,
  };
}

export class Player {
  constructor({ scene, state, input, bounds, colliders, eventBus, saveManager, factory } = {}) {
    this.scene = scene;
    this.state = state;
    this.input = input;
    this.bounds = bounds;
    this.colliders = colliders ?? [];
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.factory = factory ?? new CharacterFactory();
    this.ownsFactory = !factory;
    this.radius = 0.36;
    const spawn = validateSpawn(state?.player?.position, this.radius, bounds, this.colliders);
    this.position = spawn;
    this.velocity = { x: 0, z: 0 };
    this.wasMoving = false;
    this.saveElapsed = 0;
    this.root = this.factory.create(state?.player?.appearance);
    this.root.position.set(spawn.x, 0.72, spawn.z);
    this.root.scale.setScalar(0.92);
    scene?.add(this.root);
    this.#syncState();
  }

  update(delta, elapsed) {
    const inputVector = this.input?.getVector(this.position) ?? { x: 0, z: 0 };
    const motion = stepMotion({ position: this.position, velocity: this.velocity }, inputVector, delta);
    const intended = {
      x: motion.position.x - this.position.x,
      z: motion.position.z - this.position.z,
    };
    const resolved = moveWithCollisions(this.position, intended, this.radius, this.bounds, this.colliders);
    if (resolved.collided) {
      if (Math.abs(resolved.x - this.position.x) < Math.abs(intended.x) * 0.3) motion.velocity.x = 0;
      if (Math.abs(resolved.z - this.position.z) < Math.abs(intended.z) * 0.3) motion.velocity.z = 0;
      this.input?.cancelTarget();
    }
    this.position = { x: resolved.x, z: resolved.z };
    this.velocity = motion.velocity;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = speed > 0.04;
    if (moving) {
      this.root.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
      this.saveElapsed += Math.min(Math.max(finite(delta), 0), MAX_DELTA);
    }
    this.root.position.set(this.position.x, 0.72, this.position.z);
    this.factory.animate(this.root, finite(elapsed), speed);
    this.#syncState();

    if (moving) {
      this.eventBus?.emit?.('player:moved', { position: { ...this.state.player.position }, velocity: { ...this.velocity } });
      if (this.saveElapsed >= 1.25) this.#save();
    } else if (this.wasMoving) {
      this.#save();
      this.eventBus?.emit?.('player:stopped', { position: { ...this.state.player.position } });
    }
    this.wasMoving = moving;
    return { moved: moving, collided: resolved.collided };
  }

  #syncState() {
    if (!this.state?.player) return;
    this.state.player.position.x = this.position.x;
    this.state.player.position.y = 0;
    this.state.player.position.z = this.position.z;
  }

  #save() {
    this.saveElapsed = 0;
    this.saveManager?.save?.(this.state);
  }

  updateAppearance(appearance, { syncState = true } = {}) {
    if (!this.state?.player) return;
    const nextAppearance = { ...this.state.player.appearance, ...appearance };
    if (syncState) this.state.player.appearance = nextAppearance;
    this.factory.updateAppearance(this.root, nextAppearance);
  }

  dispose() {
    if (this.wasMoving) this.#save();
    this.root?.removeFromParent();
    if (this.ownsFactory) this.factory.dispose();
    this.root = null;
    this.scene = null;
    this.input = null;
  }
}
