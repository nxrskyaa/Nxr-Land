import { QUESTS, QUEST_BY_ID } from '../data/quests.js';

const EVENT_TYPES = Object.freeze([...new Set(QUESTS.map((quest) => quest.event.type))]);
const QUEST_NPC = Object.freeze({
  'chapter-1-arrive': 'mira',
  'chapter-1-clear-garden': 'mira',
  'chapter-1-plant-crop': 'mira',
  'chapter-1-reopen-market': 'tomo',
  'chapter-1-find-spirit-seed': 'lumi',
  'chapter-1-hatch-first-pet': 'lumi',
  'chapter-1-rebuild-planter': 'mira',
  'chapter-1-restore-heartroot': 'mira',
});
const DESTINATIONS = Object.freeze({
  'chapter-1-arrive': { x: 2.5, y: 0, z: 0 },
  'chapter-1-clear-garden': { x: 6.1, y: 0, z: 1.5 },
  'chapter-1-plant-crop': { x: 6.1, y: 0, z: 3 },
  'chapter-1-reopen-market': { x: -6.7, y: 0, z: 1.2 },
  'chapter-1-find-spirit-seed': { x: 8.2, y: 0, z: -4.8 },
  'chapter-1-hatch-first-pet': { x: 10.7, y: 0, z: -4.3 },
  'chapter-1-rebuild-planter': { x: 2.8, y: 0, z: -2.4 },
  'chapter-1-restore-heartroot': { x: -3, y: 0, z: -6.8 },
});
const QUEST_PHASES = new Set(['offered', 'accepted', 'ready', 'complete']);

function failure(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
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
    if (!Array.isArray(state.quests.interactedIds) || !Array.isArray(state.world.unlocks)
      || !QUEST_PHASES.has(state.quests.phase)) {
      throw new Error('QuestSystem requires migrated quests.interactedIds, quests.phase, and world.unlocks');
    }
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.disposed = false;
    this.unsubscribers = [];

    for (const type of [...EVENT_TYPES, 'economy:sold']) {
      const unsubscribe = eventBus?.onPrepare?.(type, (payload) => this.#prepareSourceProgress(type, payload));
      if (unsubscribe) this.unsubscribers.push(unsubscribe);
    }
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

  getPhase() {
    return this.state.quests.phase;
  }

  getQuestNpcId(quest = this.getActiveQuest()) {
    return quest ? QUEST_NPC[quest.id] ?? null : null;
  }

  getRewardLabel(quest = this.getActiveQuest()) {
    return quest ? formatReward(quest.reward) : '';
  }

  getNpcMarkerState() {
    const markers = { mira: false, tomo: false, lumi: false };
    const quest = this.getActiveQuest();
    if (quest && ['offered', 'ready'].includes(this.state.quests.phase)) markers[QUEST_NPC[quest.id]] = true;
    return markers;
  }

  getDestinationBeacon() {
    const quest = this.getActiveQuest();
    if (!quest || this.state.quests.phase !== 'accepted') return null;
    return {
      questId: quest.id,
      destination: quest.destination,
      position: { ...DESTINATIONS[quest.id] },
    };
  }

  #save() {
    if (!this.saveManager?.save) return true;
    return this.saveManager.save(this.state) !== false;
  }

  #emit(type, payload) {
    this.eventBus?.emitSafe?.(type, payload);
  }

  #normalizeEvent(type, payload) {
    return type === 'economy:sold' ? { type: 'item:sold', payload } : { type, payload };
  }

  #matches(quest, type, payload) {
    const normalized = this.#normalizeEvent(type, payload);
    return normalized.type === quest.event.type && validTarget(quest, normalized.payload);
  }

  #prepareSourceProgress(type, payload) {
    const quest = this.getActiveQuest();
    if (!quest || this.state.quests.phase !== 'accepted' || !this.#matches(quest, type, payload)) return null;
    return this.#prepareProgress(quest);
  }

  #prepareProgress(quest) {
    const previous = this.state.quests.progress[quest.id] ?? 0;
    const current = Math.min(quest.progress.required, previous + 1);
    this.state.quests.progress[quest.id] = current;
    if (current >= quest.progress.required) this.state.quests.phase = 'ready';
    const result = Object.freeze({
      ok: true,
      code: 'ok',
      action: 'progress',
      questId: quest.id,
      current,
      required: quest.progress.required,
      phase: this.state.quests.phase,
    });
    return {
      result,
      commit: () => {
        this.#emit('quest:progress', result);
        if (result.phase === 'ready') this.#emit('quest:ready', Object.freeze({ ...result, quest }));
      },
    };
  }

  #transact(type, payload, mutate = null) {
    const transaction = this.eventBus?.transact?.(type, payload, {
      state: this.state,
      mutate,
      save: () => this.#save(),
    });
    if (!transaction?.ok) {
      const code = transaction?.code === 'transaction-failed' ? 'transaction-failed' : 'save-failed';
      return failure(code, code === 'save-failed' ? 'Could not save quest progress' : 'Quest progress could not be applied');
    }
    return transaction;
  }

  record(type, payload = {}) {
    const quest = this.getActiveQuest();
    if (!quest) return failure('chapter-complete', 'Chapter 1 is complete');
    if (this.state.quests.phase !== 'accepted') {
      return failure('quest-not-accepted', 'Accept this quest from its villager first', { questId: quest.id });
    }
    if (!this.#matches(quest, type, payload)) {
      return failure('event-mismatch', 'That action does not match the current objective', { questId: quest.id });
    }
    const transaction = this.#transact(type, payload);
    return transaction.ok ? transaction.prepared.find(Boolean) : transaction;
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

  interactNpc(npcId) {
    const quest = this.getActiveQuest();
    if (!quest) return failure('chapter-complete', 'Chapter 1 is complete');
    if (QUEST_NPC[quest.id] !== npcId) {
      return failure('npc-not-relevant', 'This villager is not handling the current quest', { questId: quest.id });
    }

    if (this.state.quests.phase === 'offered') {
      const result = Object.freeze({
        ok: true,
        code: 'ok',
        action: 'accept',
        questId: quest.id,
        phase: 'accepted',
      });
      const transaction = this.#transact('quest:accept', result, () => {
        this.state.quests.phase = 'accepted';
      });
      if (!transaction.ok) return transaction;
      this.#emit('quest:accepted', Object.freeze({ ...result, quest }));
      return result;
    }

    if (this.state.quests.phase === 'accepted') {
      return failure('quest-in-progress', 'Finish the current objective before returning', { questId: quest.id });
    }

    let result;
    let nextQuest = null;
    const transaction = this.#transact('quest:turn-in', () => result, () => {
      this.#applyReward(quest);
      addUnique(this.state.quests.completedIds, quest.id);
      const nextIndex = QUESTS.findIndex(({ id }) => id === quest.id) + 1;
      nextQuest = QUESTS[nextIndex] ?? null;
      this.state.quests.activeId = nextQuest?.id ?? null;
      this.state.quests.phase = nextQuest ? 'offered' : 'complete';
      result = Object.freeze({
        ok: true,
        code: 'ok',
        action: 'turn-in',
        questId: quest.id,
        completedId: quest.id,
        nextId: nextQuest?.id ?? null,
        phase: nextQuest ? 'offered' : 'complete',
      });
    });
    if (!transaction.ok) return transaction;
    this.#emit('quest:completed', Object.freeze({ ...result, quest, nextQuest }));
    if (nextQuest) this.#emit('quest:offered', Object.freeze({ quest: nextQuest }));
    return result;
  }

  interact(objectId) {
    if (this.state.quests.interactedIds.includes(objectId)) return failure('already-used', 'That has already been tended');
    const quest = this.getActiveQuest();
    if (!quest) return failure('chapter-complete', 'Chapter 1 is complete');
    if (this.state.quests.phase !== 'accepted') {
      return failure('quest-not-accepted', 'Accept this quest from its villager first', { questId: quest.id });
    }
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
    if (!this.#matches(quest, type, payload)) {
      return failure('event-mismatch', 'That action does not match the current objective', { questId: quest.id });
    }
    const transaction = this.#transact(type, payload, () => {
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
    });
    return transaction.ok ? transaction.prepared.find(Boolean) : transaction;
  }

  getWorldObjects() {
    const definitions = [
      ['garden-weed-1', 'Clear weed', 4.5, 1.6, 'chapter-1-clear-garden'],
      ['garden-weed-2', 'Clear weed', 6.1, 1.45, 'chapter-1-clear-garden'],
      ['garden-weed-3', 'Clear weed', 7.8, 1.55, 'chapter-1-clear-garden'],
      ['river-spirit-seed', 'Collect Spirit Seed', 8.2, -4.8, 'chapter-1-find-spirit-seed'],
      ['lumi-hatch-nook', 'Hatch Sproutling with Lumi', 10.7, -4.3, 'chapter-1-hatch-first-pet'],
      ['village-planter-site', 'Place village planter', 2.8, -2.4, 'chapter-1-rebuild-planter'],
      ['heartroot-first-light', 'Restore Heartroot', -3, -6.8, 'chapter-1-restore-heartroot'],
    ];
    return definitions.map(([id, label, x, z, questId]) => ({
      id,
      label,
      position: { x, y: 0, z },
      questId,
      active: this.state.quests.activeId === questId && this.state.quests.phase === 'accepted',
      used: this.state.quests.interactedIds.includes(id),
    }));
  }

  getDialogue(npcId, interaction = null) {
    const quest = this.getActiveQuest();
    const names = { mira: 'Mira', tomo: 'Tomo', lumi: 'Lumi' };
    const roles = { mira: 'Village Steward', tomo: 'Market Keeper', lumi: 'Spirit Researcher' };
    if (!quest) return { speaker: names[npcId] ?? npcId, role: roles[npcId] ?? 'Villager', lines: ['Heartroot glows with first light.', 'The village is ready for its next chapter.'] };
    const relevant = QUEST_NPC[quest.id] === npcId;
    let lines = ['The village changes with every kind action.', `Your current path leads to ${quest.destination}.`];
    if (relevant && interaction?.action === 'accept') lines = [`${quest.title}: ${quest.objective}`, ...(quest.dialogue.start ?? [])];
    else if (relevant && interaction?.action === 'turn-in') lines = [...(quest.dialogue.complete ?? []), interaction.nextId ? 'A new path is ready when you are.' : 'Heartroot’s first light shines again.'];
    else if (relevant && this.state.quests.phase === 'ready') lines = ['You did it. Let us finish this together.'];
    else if (relevant) lines = [`${quest.title}: ${quest.objective}`, `Continue toward ${quest.destination}.`];
    return { speaker: names[npcId] ?? npcId, role: roles[npcId] ?? 'Villager', lines };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }
}
