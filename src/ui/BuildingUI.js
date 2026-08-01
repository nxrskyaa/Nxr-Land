export class BuildingUI {
  constructor({ container, buildingSystem, eventBus } = {}) {
    this.buildingSystem = buildingSystem; this.eventBus = eventBus; this.disposed = false;
    this.root = document.createElement('section'); this.root.className = 'building-ui'; this.root.innerHTML = '<div data-building-preview data-valid="false" aria-live="polite"></div><button type="button" data-building-rotate>Rotate</button><button type="button" data-building-confirm>Confirm</button><button type="button" data-building-cancel>Cancel</button>';
    container?.append(this.root); this.preview = this.root.querySelector('[data-building-preview]'); this.rotation = 0; this.selected = null; this.position = null;
    this.root.querySelector('[data-building-rotate]').addEventListener('click', () => this.rotate()); this.root.querySelector('[data-building-confirm]').addEventListener('click', () => this.confirm()); this.root.querySelector('[data-building-cancel]').addEventListener('click', () => this.cancel());
  }
  selectBuilding(id) { this.selected = id; return this; }
  previewAt(x, z) { this.position = { x, z }; const result = this.buildingSystem.getPreview(this.selected, x, z, this.rotation); this.preview.dataset.valid = String(result.valid); this.preview.dataset.code = result.code; return result; }
  rotate() { this.rotation += Math.PI / 2; return this.position ? this.previewAt(this.position.x, this.position.z) : null; }
  confirm() { if (!this.position) return { ok: false, code: 'no-preview' }; const result = this.buildingSystem.place(this.selected, this.position.x, this.position.z, this.rotation); if (result.ok) this.cancel(); return result; }
  cancel() { this.selected = null; this.position = null; this.rotation = 0; this.preview.dataset.valid = 'false'; }
  dispose() { if (this.disposed) return; this.disposed = true; this.root.remove(); }
}