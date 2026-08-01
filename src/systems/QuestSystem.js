import { QUESTS, QUEST_BY_ID } from '../data/quests.js';

const EVENT_TYPES = Object.freeze([...new Set(QUESTS.map((quest) => quest.event.type))]);
const NPC_QUESTS = Object.freeze({
  mira: new Set([1, 2, 3, 7, 8]),
  tomo: new Set([4]),
  lumi: new Set([5, 6]),
});

function failure(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function restoreState(target, snapshot) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, structuredClone(snapshot));
}

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function validTarget(quest, payload = {}) {
  switch (quest.event.target) {
    case 'town-plaza': return payload.locationId === 'town-plaza';
    case 'weed': return typeof payload.objectId === 'string' && payload.objectId.startsWith('garden-weed-');
    case 'any-crop': return typeof payload.cropId === 'string' && payload.cropId.length > 0;
    case 'produce-any': return typeof payload.itemId === 'string'
      && payload.itemId.startsWith('produce-')
      && payload.item?.type === 'produce'
      && Number.isSafeInteger(payload.quantity)
      && payload.quantity > 0;
    case 'spirit-seed': return payload.itemId === 'spirit-seed';
    case 'starter-pet': return payload.petId === 'pet-sproutling' || payload.petType === 'starter-pet';
    case 'building-village-planter': return payload.buildingId === 'building-village-planter';
    case 'first-light': return payload.lightId === 'first-light';
    default: return false;
  }
}

function formatReward(reward = {}) {
  const parts = [];
  if (reward.coin) parts.push(`${reward.coin} coin`);
  for (const [itemId, quantity] of Object.entries(reward.items ?? {})) {
    parts.push(`${quantity} ${itemId.replaceAll('-', ' ')}`);
  }
  if (reward.unlock) parts.push(`Unlock ${reward.unlock.replaceAll('-', ' ')}`);
  if (reward.wardrobe?.length) parts.push('Heartroot jacket');
  return parts.join(' · ');
}

export class QuestSystem {
  constructor({ state, eventBus, saveManager } = {}) {
    if (!state?.quests || !state?.economy?.inventory || !state?.collection || !state?.world) {
      throw new Error('QuestSystem requires quest, economy, collection, and world state');
    }
    if (!Array.isArray(state.quests.interactedIds) || !Array.isArray(state.world.unlocks)) {
      throw new Error('QuestSystem requires migrated quests.interactedIds and world.unlocks');
    }
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.disposed = false;

    this.unsubscribers = EVENT_TYPES.map((type) => eventBus?.on?.(type, (payload) => this.record(type, payload))).filter(Boolean);
    const economyUnsubscribe = eventBus?.on?.('economy:sold', (payload) => this.record('economy:sold', payload));
    if (economyUnsubscribe) this.unsubscribers.push(economyUnsubscribe);
  }

  getActiveQuest() {
    return QUEST_BY_ID[this.state.quests.activeId] ?? null;
  }

  getProgress() {
    const quest = this.getActiveQuest();
    if (!quest) return null;
    return {
      current: this.state.quests.progress[quest.id] ?? 0,
      required: quest.progress.required,
      metric: quest.progress.metric,
    };
  }

  getRewardLabel(quest = this.getActiveQuest()) {
    return quest ? formatReward(quest.reward) : '';
  }

  #save() {
    if (!this.saveManager?.save) return true;
    try {
      return this.saveManager.save(this.state) !== false;
    } catch {
      return false;
    }
  }

  #applyReward(quest) {
    const reward = quest.reward ?? {};
    const coin = reward.coin ?? 0;
    const currentCoin = this.state.economy.coin;
    if (!Number.isSafeInteger(coin) || coin < 0 || !Number.isSafeInteger(currentCoin)
      || !Number.isSafeInteger(currentCoin + coin)) throw new Error('Invalid quest coin reward');
    this.state.economy.coin = currentCoin + coin;
    for (const [itemId, quantity] of Object.entries(reward.items ?? {})) {
      const current = this.state.economy.inventory[itemId] ?? 0;
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(current)
        || !Number.isSafeInteger(current + quantity)) throw new Error('Invalid quest item reward');
      this.state.economy.inventory[itemId] = current + quantity;
    }
    for (const wardrobeId of reward.wardrobe ?? []) addUnique(this.state.collection.wardrobe, wardrobeId);
    if (reward.unlock) addUnique(this.state.world.unlocks, reward.unlock);
  }

  #normalizeEvent(type, payload) {
    if (type === 'economy:sold') return { type: 'item:sold', payload };
    return { type, payload };
  }

  record(type, payload = {}, mutate = null) {
    const quest = this.getActiveQuest();
    if (!quest) return failure('chapter-complete', 'Chapter 1 is complete');
    const normalized = this.#normalizeEvent(type, payload);
    if (normalized.type !== quest.event.type || !validTarget(quest, normalized.payload)) {
      return failure('event-mismatch', 'That action does not match the current objective', { questId: quest.id });
    }

    const snapshot = structuredClone(this.state);
    try {
      mutate?.();
      const previous = this.state.quests.progress[quest.id] ?? 0;
      const current = Math.min(quest.progress.required, previous + 1);
      this.state.quests.progress[quest.id] = current;
      let completedId = null;
      let nextQuest = quest;
      if (current >= quest.progress.required) {
        completedId = quest.id;
        addUnique(this.state.quests.completedIds, quest.id);
        this.#applyReward(quest);
        const nextIndex = QUESTS.findIndex(({ id }) => id === quest.id) + 1;
        nextQuest = QUESTS[nextIndex] ?? null;
        this.state.quests.activeId = nextQuest?.id ?? null;
      }
      if (!this.#save()) {
        restoreState(this.state, snapshot);
        return failure('save-failed', 'Could not save quest progress', { questId: quest.id });
      }
      const result = Object.freeze({
        ok: true, code: 'ok', questId: quest.id, current, required: quest.progress.required,
        completedId, nextId: nextQuest?.id ?? null,
      });
      this.eventBus?.emit?.('quest:progress', result);
      if (completedId) this.eventBus?.emit?.('quest:completed', Object.freeze({ ...result, quest, nextQuest }));
      if (completedId && nextQuest) this.eventBus?.emit?.('quest:started', Object.freeze({ quest: nextQuest }));
      return result;
    } catch {
      restoreState(this.state, snapshot);
      return failure('transaction-failed', 'Quest progress could not be applied', { questId: quest.id });
    }
  }

  interact(objectId) {
    if (this.state.quests.interactedIds.includes(objectId)) return failure('already-used', 'That has already been tended');
    const quest = this.getActiveQuest();
    if (!quest) return failure('chapter-complete', 'Chapter 1 is complete');
    const interactions = {
      'garden-weed-1': ['garden:cleared', { objectId }],
      'garden-weed-2': ['garden:cleared', { objectId }],
      'garden-weed-3': ['garden:cleared', { objectId }],
      'river-spirit-seed': ['item:collected', { itemId: 'spirit-seed', objectId }],
      'lumi-hatch-nook': ['pet:hatched', { petId: 'pet-sproutling', petType: 'starter-pet', objectId }],
      'village-planter-site': ['building:placed', { buildingId: 'building-village-planter', objectId }],
      'heartroot-first-light': ['heartroot:restored', { lightId: 'first-light', objectId }],
    };
    const event = interactions[objectId];
    if (!event) return failure('unknown-object', 'This cannot be interacted with');
    const [type, payload] = event;
    const mutate = () => {
      addUnique(this.state.quests.interactedIds, objectId);
      if (objectId === 'river-spirit-seed') this.state.economy.inventory['spirit-seed'] = (this.state.economy.inventory['spirit-seed'] ?? 0) + 1;
      if (objectId === 'lumi-hatch-nook') {
        const seeds = this.state.economy.inventory['spirit-seed'] ?? 0;
        if (seeds < 1) throw new Error('Spirit Seed required');
        this.state.economy.inventory['spirit-seed'] = seeds - 1;
        addUnique(this.state.collection.pets, 'pet-sproutling');
      }
      if (objectId === 'village-planter-site') {
        if (this.state.world.placedBuildings.some(({ id, buildingId }) => (buildingId ?? id) === 'building-village-planter')) {
          throw new Error('Village planter is already placed');
        }
        this.state.world.placedBuildings.push({ id: 'building-village-planter', x: 2.8, y: 0, z: -2.4, rotation: 0 });
      }
      if (objectId === 'heartroot-first-light') this.state.world.upgrades.heartrootFirstLight = true;
    };
    return this.record(type, payload, mutate);
  }

  getWorldObjects() {
    const definitions = [
      ['garden-weed-1', 'Clear weed', 4.5, 1.6, 'chapter-1-clear-garden'],
      ['garden-weed-2', 'Clear weed', 6.1, 1.45, 'chapter-1-clear-garden'],
      ['garden-weed-3', 'Clear weed', 7.8, 1.55, 'chapter-1-clear-garden'],
      ['river-spirit-seed', 'Collect Spirit Seed', 8.2, -4.8, 'chapter-1-find-spirit-seed'],
      ['lumi-hatch-nook', 'Hatch Sproutling with Lumi', 10.7, -4.3, 'chapter-1-hatch-first-pet'],
      ['village-planter-site', 'Place village planter', 2.8, -2.4, 'chapter-1-rebuild-planter'],
      ['heartroot-first-light', 'Restore Heartroot', -3.0, -6.8, 'chapter-1-restore-heartroot'],
    ];
    return definitions.map(([id, label, x, z, questId]) => ({
      id, label, position: { x, y: 0, z }, questId,
      active: this.state.quests.activeId === questId,
      used: this.state.quests.interactedIds.includes(id),
    }));
  }

  getDialogue(npcId) {
    const quest = this.getActiveQuest();
    if (!quest) return { speaker: npcId, lines: ['Heartroot glows with first light.', 'The village is ready for its next chapter.'] };
    const relevant = NPC_QUESTS[npcId]?.has(quest.order);
    const names = { mira: 'Mira', tomo: 'Tomo', lumi: 'Lumi' };
    const roles = { mira: 'Village Steward', tomo: 'Market Keeper', lumi: 'Spirit Researcher' };
    return {
      speaker: names[npcId] ?? npcId,
      role: roles[npcId] ?? 'Villager',
      lines: relevant
        ? [`${quest.title}: ${quest.objective}`, ...(quest.dialogue.start ?? [])]
        : ['The village changes with every kind action.', `Your current path leads to ${quest.destination}.`],
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }
}
