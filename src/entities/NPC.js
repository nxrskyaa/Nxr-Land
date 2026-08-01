export class NPC {
  constructor({ scene, factory, definition } = {}) {
    if (!scene || !factory || !definition?.id || !definition?.name) throw new Error('NPC requires scene, factory, and definition');
    this.scene = scene;
    this.factory = factory;
    this.id = definition.id;
    this.name = definition.name;
    this.role = definition.role ?? 'Villager';
    this.dialogue = [...(definition.dialogue ?? [])];
    this.interactionRadius = definition.interactionRadius ?? 1.9;
    this.disposed = false;
    this.root = factory.create(definition);
    this.root.position.set(definition.position?.x ?? 0, definition.position?.y ?? 0, definition.position?.z ?? 0);
    this.anchor = { x: this.root.position.x, y: this.root.position.y, z: this.root.position.z };
    this.idlePhase = this.id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0) * 0.07;
    this.root.userData.role = this.role;
    scene.add(this.root);
  }

  get position() {
    return this.root?.position;
  }

  distanceTo(position = {}) {
    if (!this.root || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return Infinity;
    return Math.hypot(this.root.position.x - position.x, this.root.position.z - position.z);
  }

  isInRange(position) {
    return this.distanceTo(position) <= this.interactionRadius;
  }

  update(_delta, elapsed) {
    const phase = Number.isFinite(elapsed) ? elapsed * 0.22 + this.idlePhase : this.idlePhase;
    this.root.position.x = this.anchor.x + Math.cos(phase) * 0.12;
    this.root.position.z = this.anchor.z + Math.sin(phase) * 0.12;
    this.factory?.update?.(this.root, elapsed);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root?.removeFromParent();
    this.root = null;
    this.scene = null;
    this.factory = null;
  }
}
