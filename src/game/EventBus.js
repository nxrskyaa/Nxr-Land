export class EventBus {
  #listeners = new Map();

  on(type, listener) {
    let listeners = this.#listeners.get(type);
    if (!listeners) {
      listeners = [];
      this.#listeners.set(type, listeners);
    }
    const subscription = { listener };
    listeners.push(subscription);

    return () => this.#remove(type, subscription);
  }

  off(type, listener) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;

    const subscription = listeners.find((entry) => entry.listener === listener);
    if (subscription) this.#remove(type, subscription);
  }

  #remove(type, subscription) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;

    const index = listeners.indexOf(subscription);
    if (index === -1) return;
    listeners.splice(index, 1);
    if (listeners.length === 0) {
      this.#listeners.delete(type);
    }
  }

  emit(type, payload) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;

    for (const { listener } of [...listeners]) {
      listener(payload);
    }
  }
}
