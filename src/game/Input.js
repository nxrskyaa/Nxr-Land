const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'KeyE']);

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}

export function normalizeInputVector(x, z) {
  const safeX = finite(x);
  const safeZ = finite(z);
  const length = Math.hypot(safeX, safeZ);
  if (!length) return { x: 0, z: 0 };
  const scale = length > 1 ? 1 / length : 1;
  return { x: safeX * scale, z: safeZ * scale };
}

export function joystickVector(dx, dy, radius = 48, deadZone = 0.16) {
  const safeRadius = Math.max(1, finite(radius));
  const normalizedLength = Math.min(1, Math.hypot(finite(dx), finite(dy)) / safeRadius);
  const safeDeadZone = Math.min(0.9, Math.max(0, finite(deadZone)));
  if (normalizedLength <= safeDeadZone) return { x: 0, z: 0 };
  const direction = normalizeInputVector(dx, dy);
  const magnitude = (normalizedLength - safeDeadZone) / (1 - safeDeadZone);
  return { x: direction.x * magnitude, z: direction.z * magnitude };
}

function isEditable(target) {
  return Boolean(target?.closest?.('input, textarea, select, button, [contenteditable="true"], [role="dialog"]'));
}

export class Input {
  constructor({ canvas, container, onAction, screenToWorld } = {}) {
    this.canvas = canvas;
    this.container = container;
    this.onAction = onAction;
    this.screenToWorld = screenToWorld;
    this.keys = new Set();
    this.mobileVector = { x: 0, z: 0 };
    this.target = null;
    this.enabled = false;
    this.disposed = false;
    this.pointerId = null;
    this.canvasGesture = null;
    this.#buildMobileControls();
    this.#bind();
  }

  #listeners = [];

  #listen(target, type, handler, options) {
    target?.addEventListener?.(type, handler, options);
    this.#listeners.push(() => target?.removeEventListener?.(type, handler, options));
  }

  #bind() {
    const view = this.container?.ownerDocument?.defaultView ?? globalThis.window;
    const doc = this.container?.ownerDocument ?? globalThis.document;
    this.#listen(view, 'keydown', (event) => {
      if (!this.enabled || isEditable(event.target) || !GAME_KEYS.has(event.code)) return;
      event.preventDefault();
      if ((event.code === 'Space' || event.code === 'KeyE') && !event.repeat) this.triggerAction();
      else this.keys.add(event.code);
      this.target = null;
    });
    this.#listen(view, 'keyup', (event) => this.keys.delete(event.code));
    this.#listen(view, 'blur', () => this.reset());
    this.#listen(doc, 'visibilitychange', () => { if (doc.hidden) this.reset(); });
    this.#listen(this.canvas, 'pointerdown', (event) => {
      if (!this.enabled || event.target !== this.canvas || event.isPrimary === false || event.button !== 0) return;
      this.canvasGesture = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startedAt: event.timeStamp,
      };
      try { this.canvas.setPointerCapture?.(event.pointerId); } catch { /* Capture is optional. */ }
    });
    this.#listen(this.canvas, 'pointerup', (event) => {
      const gesture = this.canvasGesture;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const distance = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
      const duration = event.timeStamp - gesture.startedAt;
      this.#releasePointer(this.canvas, gesture.pointerId);
      this.canvasGesture = null;
      if (this.enabled && distance <= 8 && duration <= 500) this.setTargetFromScreen(event.clientX, event.clientY);
    });
    this.#listen(this.canvas, 'pointercancel', (event) => {
      if (event.pointerId !== this.canvasGesture?.pointerId) return;
      this.#releasePointer(this.canvas, event.pointerId);
      this.canvasGesture = null;
    });
  }

  #buildMobileControls() {
    const doc = this.container?.ownerDocument;
    if (!doc) return;
    const controls = doc.createElement('div');
    controls.className = 'mobile-controls';
    controls.setAttribute('aria-label', 'Touch controls');
    controls.innerHTML = `
      <div class="joystick" data-joystick aria-label="Movement joystick"><span class="joystick-knob"></span></div>
      <button class="action-button" type="button" aria-label="Interact">E<small>Action</small></button>
    `;
    this.container.append(controls);
    this.mobileControls = controls;
    this.joystick = controls.querySelector('[data-joystick]');
    this.knob = controls.querySelector('.joystick-knob');
    const update = (event) => {
      if (event.pointerId !== this.pointerId) return;
      const rect = this.joystick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      this.mobileVector = joystickVector(dx, dy, Math.max(1, rect.width / 2));
      const visual = normalizeInputVector(dx, dy);
      const distance = Math.min(Math.hypot(dx, dy), rect.width * 0.28);
      this.knob.style.transform = `translate(${visual.x * distance}px, ${visual.z * distance}px)`;
      if (Math.hypot(this.mobileVector.x, this.mobileVector.z) > 0) this.target = null;
    };
    this.#listen(this.joystick, 'pointerdown', (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.pointerId = event.pointerId;
      this.joystick.setPointerCapture?.(event.pointerId);
      update(event);
    });
    this.#listen(this.joystick, 'pointermove', update);
    const cancel = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.#releasePointer(this.joystick, event.pointerId);
      this.pointerId = null;
      this.mobileVector = { x: 0, z: 0 };
      this.knob.style.transform = '';
    };
    this.#listen(this.joystick, 'pointerup', cancel);
    this.#listen(this.joystick, 'pointercancel', cancel);
    this.#listen(controls.querySelector('.action-button'), 'pointerdown', (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.triggerAction();
    });
  }

  #releasePointer(element, pointerId) {
    if (pointerId === null || pointerId === undefined) return;
    try {
      if (!element?.hasPointerCapture || element.hasPointerCapture(pointerId)) {
        element?.releasePointerCapture?.(pointerId);
      }
    } catch {
      // Pointer capture may already have been released by the browser.
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.container?.classList.toggle('controls-enabled', this.enabled);
    if (!this.enabled) this.reset();
  }

  getVector(position) {
    const keyboard = normalizeInputVector(
      Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')),
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')),
    );
    if (keyboard.x || keyboard.z) {
      this.target = null;
      return keyboard;
    }
    if (this.mobileVector.x || this.mobileVector.z) return this.mobileVector;
    if (this.target && position) {
      const dx = this.target.x - position.x;
      const dz = this.target.z - position.z;
      if (Math.hypot(dx, dz) < 0.25) {
        this.target = null;
        return { x: 0, z: 0 };
      }
      return normalizeInputVector(dx, dz);
    }
    return { x: 0, z: 0 };
  }

  setTargetFromScreen(x, y) {
    const target = this.screenToWorld?.(x, y);
    if (target && Number.isFinite(target.x) && Number.isFinite(target.z)) this.target = { x: target.x, z: target.z };
  }

  cancelTarget() { this.target = null; }

  triggerAction() {
    this.onAction?.();
    this.container?.dispatchEvent?.(new CustomEvent('player:action', { bubbles: true }));
  }

  reset() {
    this.#releasePointer(this.canvas, this.canvasGesture?.pointerId);
    this.#releasePointer(this.joystick, this.pointerId);
    this.keys.clear();
    this.mobileVector = { x: 0, z: 0 };
    this.target = null;
    this.canvasGesture = null;
    this.pointerId = null;
    if (this.knob) this.knob.style.transform = '';
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
    this.#listeners.splice(0).forEach((remove) => remove());
    this.mobileControls?.remove();
  }
}
