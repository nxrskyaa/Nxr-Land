function restoreState(target, snapshot) {
  if (Array.isArray(target)) {
    target.splice(0, target.length, ...structuredClone(snapshot));
    return;
  }
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, structuredClone(snapshot));
}

export class EventBus {
  #listeners = new Map();
  #prepareListeners = new Map();

  on(type, listener) {
    return this.#subscribe(this.#listeners, type, listener);
  }

  onPrepare(type, listener) {
    return this.#subscribe(this.#prepareListeners, type, listener);
  }

  #subscribe(registry, type, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('EventBus listener must be a function');
    }
    let listeners = registry.get(type);
    if (!listeners) {
      listeners = [];
      registry.set(type, listeners);
    }
    const subscription = { listener };
    listeners.push(subscription);
    return () => this.#remove(registry, type, subscription);
  }

  off(type, listener) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;
    const subscription = listeners.find((entry) => entry.listener === listener);
    if (subscription) this.#remove(this.#listeners, type, subscription);
  }

  #remove(registry, type, subscription) {
    const listeners = registry.get(type);
    if (!listeners) return;
    const index = listeners.indexOf(subscription);
    if (index === -1) return;
    listeners.splice(index, 1);
    if (listeners.length === 0) registry.delete(type);
  }

  emit(type, payload) {
    const listeners = this.#listeners.get(type);
    if (!listeners) return;
    for (const { listener } of [...listeners]) listener(payload);
  }

  emitSafe(type, payload) {
    const errors = [];
    for (const { listener } of [...(this.#listeners.get(type) ?? [])]) {
      try {
        listener(payload);
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }

  transact(type, payload, { state, mutate, save, snapshot: providedSnapshot } = {}) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('EventBus transaction requires mutable state');
    }
    const snapshot = providedSnapshot ?? structuredClone(state);
    const preparations = [];
    try {
      mutate?.();
      const resolvedPayload = typeof payload === 'function' ? payload() : payload;
      for (const { listener } of [...(this.#prepareListeners.get(type) ?? [])]) {
        preparations.push(listener(resolvedPayload));
      }
      let saved = true;
      try {
        saved = save?.() !== false;
      } catch {
        saved = false;
      }
      if (!saved) {
        restoreState(state, snapshot);
        return { ok: false, code: 'save-failed', message: 'Could not save transaction' };
      }

      for (const preparation of preparations) {
        if (typeof preparation?.commit === 'function') {
          try {
            preparation.commit();
          } catch {
            // Durable state is authoritative; post-commit observers cannot undo it.
          }
        }
      }
      this.emitSafe(type, resolvedPayload);
      return {
        ok: true,
        code: 'ok',
        payload: resolvedPayload,
        prepared: preparations.map((entry) => entry?.result).filter((entry) => entry !== undefined),
      };
    } catch {
      restoreState(state, snapshot);
      return { ok: false, code: 'transaction-failed', message: 'Transaction preparation failed' };
    }
  }
}
