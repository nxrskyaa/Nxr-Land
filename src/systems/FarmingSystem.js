import { CROP_BY_ID } from '../data/crops.js';
import { ITEM_BY_ID } from '../data/items.js';

const VALID_STATES = new Set(['empty', 'tilled', 'planted', 'watered', 'growing', 'harvestable']);

function failure(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function success(action, plot, extra = {}) {
  return { ok: true, code: 'ok', action, plotId: plot.id, state: plot.state, ...extra };
}

function clonePosition(position = {}) {
  return Object.freeze({
    x: Number.isFinite(position.x) ? position.x : 0,
    y: Number.isFinite(position.y) ? position.y : 0,
    z: Number.isFinite(position.z) ? position.z : 0,
  });
}

export class FarmingSystem {
  constructor({ state, eventBus, saveManager, plotPositions = {} } = {}) {
    if (!state?.crops?.plots || !state?.economy?.inventory || !state?.world) {
      throw new Error('FarmingSystem requires crop, economy, and world state');
    }
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.plotPositions = plotPositions;
    this.lastStages = new Map();
    this.#normalizePlots();
  }

  #normalizePlots() {
    for (const plot of this.state.crops.plots) {
      if (!VALID_STATES.has(plot.state)) plot.state = 'empty';
      plot.cropId ??= null;
      plot.plantedAt ??= null;
      plot.wateredAt ??= null;
      plot.growthStartedAt ??= null;
      const visual = this.getVisualState(plot.id);
      if (visual?.cropId) this.lastStages.set(plot.id, visual.stageIndex);
    }
  }

  #plot(plotId) {
    return this.state.crops.plots.find((plot) => plot.id === plotId) ?? null;
  }

  #time() {
    return Number.isFinite(this.state.world.elapsedMs) && this.state.world.elapsedMs >= 0
      ? this.state.world.elapsedMs
      : null;
  }

  #payload(plot, extra = {}) {
    const crop = plot.cropId ? CROP_BY_ID[plot.cropId] : null;
    return Object.freeze({
      plotId: plot.id,
      cropId: plot.cropId,
      crop,
      state: plot.state,
      timestamp: this.#time(),
      position: clonePosition(this.plotPositions[plot.id]),
      ...extra,
    });
  }

  #save() {
    if (!this.saveManager?.save) return true;
    try {
      return this.saveManager.save(this.state) !== false;
    } catch {
      return false;
    }
  }

  #commit(eventType, plot, extra = {}, snapshot = null) {
    if (this.eventBus?.transact) {
      return this.eventBus.transact(eventType, () => this.#payload(plot, extra), {
        state: this.state,
        snapshot,
        save: () => this.#save(),
      });
    }
    if (!this.#save()) return { ok: false, code: 'save-failed' };
    this.eventBus?.emit?.(eventType, this.#payload(plot, extra));
    return { ok: true, code: 'ok' };
  }

  #saveFailure(plotId, code = 'save-failed') {
    const message = code === 'transaction-failed'
      ? 'Farming transaction could not be prepared'
      : 'Could not save farming progress';
    return failure(code, message, { plotId });
  }

  #validatePlot(plotId, expected) {
    const plot = this.#plot(plotId);
    if (!plot) return { error: failure('unknown-plot', `Unknown plot: ${plotId}`, { plotId }) };
    if (expected && !expected.includes(plot.state)) {
      return { error: failure('invalid-transition', `Cannot perform this action while plot is ${plot.state}`, { plotId, state: plot.state }) };
    }
    return { plot };
  }

  till(plotId) {
    const { plot, error } = this.#validatePlot(plotId, ['empty']);
    if (error) return error;
    const snapshot = structuredClone(this.state);
    plot.state = 'tilled';
    const transaction = this.#commit('plot:tilled', plot, {}, snapshot);
    if (!transaction.ok) {
      plot.state = 'empty';
      return this.#saveFailure(plotId, transaction.code);
    }
    return success('till', plot);
  }

  plant(plotId, cropId) {
    const { plot, error } = this.#validatePlot(plotId, ['tilled']);
    if (error) return error;
    const crop = CROP_BY_ID[cropId];
    if (!crop) return failure('unknown-crop', `Unknown crop: ${cropId}`, { plotId, cropId });
    const seedId = `seed-${cropId}`;
    const inventory = this.state.economy.inventory;
    if (!Number.isInteger(inventory[seedId]) || inventory[seedId] < 1) {
      return failure('insufficient-seed', `No ${crop.label} seeds available`, { plotId, cropId, seedId });
    }
    const timestamp = this.#time();
    if (timestamp === null) return failure('invalid-time', 'World time must be finite', { plotId, cropId });

    const snapshot = structuredClone(this.state);
    const previousPlot = { ...plot };
    const previousSeedCount = inventory[seedId];
    const previousStage = this.lastStages.get(plot.id);
    inventory[seedId] -= 1;
    Object.assign(plot, {
      state: 'planted', cropId, plantedAt: timestamp, wateredAt: null, growthStartedAt: null,
    });
    this.lastStages.set(plot.id, 0);
    const transaction = this.#commit('crop:planted', plot, {}, snapshot);
    if (!transaction.ok) {
      Object.assign(plot, previousPlot);
      inventory[seedId] = previousSeedCount;
      if (previousStage === undefined) this.lastStages.delete(plot.id);
      else this.lastStages.set(plot.id, previousStage);
      return this.#saveFailure(plotId, transaction.code);
    }
    return success('plant', plot, { cropId, seedId });
  }

  water(plotId) {
    const { plot, error } = this.#validatePlot(plotId, ['planted']);
    if (error) return error;
    const timestamp = this.#time();
    if (timestamp === null) return failure('invalid-time', 'World time must be finite', { plotId });
    const snapshot = structuredClone(this.state);
    const previousPlot = { ...plot };
    plot.state = 'watered';
    plot.wateredAt = timestamp;
    plot.growthStartedAt = timestamp;
    const transaction = this.#commit('crop:watered', plot, {}, snapshot);
    if (!transaction.ok) {
      Object.assign(plot, previousPlot);
      return this.#saveFailure(plotId, transaction.code);
    }
    return success('water', plot, { cropId: plot.cropId });
  }

  updateGrowth() {
    const timestamp = this.#time();
    if (timestamp === null) return [];
    const changes = [];
    const pendingEvents = [];
    const plotSnapshots = this.state.crops.plots.map((plot) => ({ ...plot }));
    const previousStages = new Map(this.lastStages);
    let persistentMutation = false;

    for (const plot of this.state.crops.plots) {
      const crop = CROP_BY_ID[plot.cropId];
      if (!crop || !['watered', 'growing'].includes(plot.state)) continue;
      if (!Number.isFinite(plot.growthStartedAt)) continue;

      if (plot.state === 'watered') {
        plot.state = 'growing';
        pendingEvents.push(['crop:growing', this.#payload(plot)]);
        changes.push(success('grow', plot, { cropId: plot.cropId }));
        persistentMutation = true;
      }

      const elapsed = Math.max(0, timestamp - plot.growthStartedAt);
      const visual = this.getVisualState(plot.id, timestamp);
      const previousStage = this.lastStages.get(plot.id);
      if (visual && visual.stageIndex !== previousStage) {
        this.lastStages.set(plot.id, visual.stageIndex);
        pendingEvents.push(['crop:stage', this.#payload(plot, {
          stageIndex: visual.stageIndex,
          stage: visual.stage,
          progress: visual.progress,
        })]);
      }
      if (elapsed >= crop.growthMs && plot.state !== 'harvestable') {
        plot.state = 'harvestable';
        const ripe = this.getVisualState(plot.id, timestamp);
        if (ripe && this.lastStages.get(plot.id) !== ripe.stageIndex) {
          this.lastStages.set(plot.id, ripe.stageIndex);
          pendingEvents.push(['crop:stage', this.#payload(plot, {
            stageIndex: ripe.stageIndex, stage: ripe.stage, progress: 1,
          })]);
        }
        pendingEvents.push(['crop:harvestable', this.#payload(plot)]);
        changes.push(success('ripen', plot, { cropId: plot.cropId }));
        persistentMutation = true;
      }
    }

    if (persistentMutation && !this.#save()) {
      this.state.crops.plots.forEach((plot, index) => Object.assign(plot, plotSnapshots[index]));
      this.lastStages = previousStages;
      return [this.#saveFailure(null)];
    }
    pendingEvents.forEach(([type, payload]) => this.eventBus?.emit?.(type, payload));
    return changes;
  }

  harvest(plotId) {
    const { plot, error } = this.#validatePlot(plotId, ['harvestable']);
    if (error) return error;
    const crop = CROP_BY_ID[plot.cropId];
    if (!crop) return failure('unknown-crop', `Unknown crop: ${plot.cropId}`, { plotId, cropId: plot.cropId });
    const timestamp = this.#time();
    if (timestamp === null) return failure('invalid-time', 'World time must be finite', { plotId });
    const cropId = crop.id;
    const itemId = `produce-${cropId}`;
    const item = ITEM_BY_ID[itemId];
    const inventory = this.state.economy.inventory;
    const current = inventory[itemId] ?? 0;
    if (!Number.isInteger(current) || current < 0 || !item) {
      return failure('invalid-inventory', 'Produce inventory is invalid', { plotId, cropId, itemId });
    }

    const hadProduce = Object.hasOwn(inventory, itemId);
    const previousPlot = { ...plot };
    const previousStage = this.lastStages.get(plot.id);
    inventory[itemId] = current + 1;
    const harvestedPayload = this.#payload(plot, { itemId, quantity: 1, value: item.sellPrice });
    Object.assign(plot, {
      state: 'empty', cropId: null, plantedAt: null, wateredAt: null, growthStartedAt: null,
    });
    this.lastStages.delete(plot.id);
    if (!this.#save()) {
      Object.assign(plot, previousPlot);
      if (hadProduce) inventory[itemId] = current;
      else delete inventory[itemId];
      if (previousStage !== undefined) this.lastStages.set(plot.id, previousStage);
      return this.#saveFailure(plotId);
    }
    this.eventBus?.emit?.('crop:harvested', harvestedPayload);
    return success('harvest', plot, { cropId, itemId, quantity: 1, value: item.sellPrice });
  }

  getVisualState(plotId, atTime = this.#time()) {
    const plot = this.#plot(plotId);
    if (!plot) return null;
    const crop = CROP_BY_ID[plot.cropId];
    if (!crop) return { plotId, cropId: null, state: plot.state, stageIndex: -1, stage: null, progress: 0, moist: false };
    let progress = 0;
    if (Number.isFinite(atTime) && Number.isFinite(plot.growthStartedAt)) {
      progress = Math.min(1, Math.max(0, (atTime - plot.growthStartedAt) / crop.growthMs));
    }
    const maxGrowingStage = Math.max(0, crop.stages.length - 2);
    const stageIndex = plot.state === 'harvestable'
      ? crop.stages.length - 1
      : Math.min(maxGrowingStage, Math.floor(progress * Math.max(1, crop.stages.length - 1)));
    return {
      plotId, cropId: crop.id, state: plot.state, stageIndex, stage: crop.stages[stageIndex], progress,
      moist: ['watered', 'growing', 'harvestable'].includes(plot.state),
    };
  }
}
