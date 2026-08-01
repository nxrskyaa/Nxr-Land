export class EventBus {
  #listeners = new Map();

  on(type, listener) {
    let listeners = this.#listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(type, listeners);
    }
    listeners.add(listener);

    return () => this.off(type, listener);
  }

  off(type, listener) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;

    listeners.delete(listener);
    if (listeners.size === 0) {
      this.#listeners.delete(type);
    }
  }

  emit(type, payload) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;

    for (const listener of [...listeners]) {
      listener(payload);
    }
  }
}
