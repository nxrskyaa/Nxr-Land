import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/createState.js';
import { EventBus } from '../src/game/EventBus.js';
import { FarmingSystem } from '../src/systems/FarmingSystem.js';
import { EconomySystem } from '../src/systems/EconomySystem.js';
import { QuestSystem } from '../src/systems/QuestSystem.js';

function setup({ state = createInitialState(), save = true } = {}) {
  const eventBus = new EventBus();
  const saveManager = { save: vi.fn(() => save) };
  const quests = new QuestSystem({ state, eventBus, saveManager });
  return { state, eventBus, saveManager, quests };
}

function accept(context, npcId) {
  return context.quests.interactNpc(npcId);
}

function turnIn(context, npcId) {
  return context.quests.interactNpc(npcId);
}

function reachQuestThree(context) {
  expect(accept(context, 'mira')).toMatchObject({ ok: true, action: 'accept', phase: 'accepted' });
  expect(context.quests.record('location:entered', { locationId: 'town-plaza' })).toMatchObject({ ok: true, phase: 'ready' });
  expect(turnIn(context, 'mira')).toMatchObject({ ok: true, action: 'turn-in', nextId: 'chapter-1-clear-garden' });
  expect(accept(context, 'mira')).toMatchObject({ ok: true, action: 'accept', phase: 'accepted' });
  for (const id of ['garden-weed-1', 'garden-weed-2', 'garden-weed-3']) {
    expect(context.quests.interact(id).ok).toBe(true);
  }
  expect(context.state.quests.phase).toBe('ready');
  expect(turnIn(context, 'mira')).toMatchObject({ ok: true, action: 'turn-in', nextId: 'chapter-1-plant-crop' });
  expect(accept(context, 'mira')).toMatchObject({ ok: true, action: 'accept', phase: 'accepted' });
}

describe('strict Task 8 quest lifecycle', () => {
  it('requires the relevant NPC to accept and turn in every quest before rewards or the next offer', () => {
    const context = setup();
    const initialCoin = context.state.economy.coin;

    expect(context.state.quests).toMatchObject({ activeId: 'chapter-1-arrive', phase: 'offered' });
    expect(context.quests.record('location:entered', { locationId: 'town-plaza' }))
      .toMatchObject({ ok: false, code: 'quest-not-accepted' });
    expect(accept(context, 'tomo')).toMatchObject({ ok: false, code: 'npc-not-relevant' });
    expect(context.state.economy.coin).toBe(initialCoin);

    expect(accept(context, 'mira')).toMatchObject({
      ok: true, action: 'accept', questId: 'chapter-1-arrive', phase: 'accepted',
    });
    expect(context.state.economy.coin).toBe(initialCoin);
    expect(context.state.quests.completedIds).toEqual([]);
    expect(context.quests.record('location:entered', { locationId: 'town-plaza' }))
      .toMatchObject({ ok: true, phase: 'ready' });

    expect(turnIn(context, 'mira')).toMatchObject({
      ok: true, action: 'turn-in', completedId: 'chapter-1-arrive', nextId: 'chapter-1-clear-garden',
    });
    expect(context.state.economy.coin).toBe(initialCoin + 20);
    expect(context.state.quests).toMatchObject({ activeId: 'chapter-1-clear-garden', phase: 'offered' });
  });

  it('persists accepted and ready phases and grants a turn-in reward exactly once across reload', () => {
    const first = setup();
    accept(first, 'mira');
    first.quests.record('location:entered', { locationId: 'town-plaza' });
    const readyState = structuredClone(first.state);
    first.quests.dispose();

    const second = setup({ state: readyState });
    expect(second.state.quests.phase).toBe('ready');
    const beforeReward = second.state.economy.coin;
    expect(turnIn(second, 'mira')).toMatchObject({ ok: true, action: 'turn-in' });
    expect(second.state.economy.coin).toBe(beforeReward + 20);
    const afterTurnIn = structuredClone(second.state);
    second.quests.dispose();

    const third = setup({ state: structuredClone(afterTurnIn) });
    expect(turnIn(third, 'mira')).toMatchObject({ ok: true, action: 'accept', questId: 'chapter-1-clear-garden' });
    expect(third.state.economy.coin).toBe(afterTurnIn.economy.coin);
    expect(third.state.quests.completedIds).toEqual(['chapter-1-arrive']);
  });

  it('exposes visible NPC markers only for offers and turn-ins plus a beacon for every accepted objective', () => {
    const context = setup();
    expect(context.quests.getNpcMarkerState()).toEqual({ mira: true, tomo: false, lumi: false });
    expect(context.quests.getDestinationBeacon()).toBeNull();

    accept(context, 'mira');
    expect(context.quests.getNpcMarkerState()).toEqual({ mira: false, tomo: false, lumi: false });
    expect(context.quests.getDestinationBeacon()).toMatchObject({ questId: 'chapter-1-arrive' });
    context.quests.record('location:entered', { locationId: 'town-plaza' });
    expect(context.quests.getNpcMarkerState()).toEqual({ mira: true, tomo: false, lumi: false });
    turnIn(context, 'mira');
    accept(context, 'mira');
    expect(context.quests.getNpcMarkerState()).toEqual({ mira: false, tomo: false, lumi: false });
    expect(context.quests.getDestinationBeacon()).toMatchObject({ questId: 'chapter-1-clear-garden' });

    reachQuestThree(setup());
    const questThree = setup();
    reachQuestThree(questThree);
    expect(questThree.quests.getDestinationBeacon()).toMatchObject({
      questId: 'chapter-1-plant-crop', destination: 'Home Plot garden',
    });
  });
});

describe('source action and quest progress share one durable transaction', () => {
  it.each(['false', 'throw'])('rolls farming and quest state back together when save returns %s', (mode) => {
    const context = setup();
    reachQuestThree(context);
    const plot = context.state.crops.plots[0];
    Object.assign(plot, {
      state: 'planted', cropId: 'turnip', plantedAt: 0, wateredAt: null, growthStartedAt: null,
    });
    context.state.world.elapsedMs = 10;
    context.saveManager.save.mockClear();
    if (mode === 'false') context.saveManager.save.mockReturnValue(false);
    else context.saveManager.save.mockImplementation(() => { throw new Error('quota'); });
    const before = structuredClone(context.state);
    const farming = new FarmingSystem({ state: context.state, eventBus: context.eventBus, saveManager: context.saveManager });

    expect(farming.water(plot.id)).toMatchObject({ ok: false, code: 'save-failed' });
    expect(context.state).toEqual(before);
    expect(context.saveManager.save).toHaveBeenCalledTimes(1);
  });

  it('persists an economy sale and matching quest progress in one save', () => {
    const context = setup();
    reachQuestThree(context);
    context.quests.record('crop:watered', { cropId: 'turnip', plotId: 'home-plot-1' });
    turnIn(context, 'mira');
    accept(context, 'tomo');
    context.state.economy.inventory['produce-turnip'] = 1;
    context.saveManager.save.mockClear();
    const economy = new EconomySystem({ state: context.state, eventBus: context.eventBus, saveManager: context.saveManager });

    expect(economy.sell('produce-turnip')).toMatchObject({ ok: true });
    expect(context.state.quests).toMatchObject({ activeId: 'chapter-1-reopen-market', phase: 'ready' });
    expect(context.saveManager.save).toHaveBeenCalledTimes(1);
  });

  it('returns source failure and restores all state when transaction preparation throws', () => {
    const context = setup();
    reachQuestThree(context);
    const plot = context.state.crops.plots[0];
    Object.assign(plot, { state: 'planted', cropId: 'turnip', plantedAt: 0, wateredAt: null, growthStartedAt: null });
    context.state.world.elapsedMs = 10;
    context.eventBus.onPrepare('crop:watered', () => { throw new Error('prepare failed'); });
    context.saveManager.save.mockClear();
    const before = structuredClone(context.state);
    const farming = new FarmingSystem({ state: context.state, eventBus: context.eventBus, saveManager: context.saveManager });

    expect(farming.water(plot.id)).toMatchObject({ ok: false, code: 'transaction-failed' });
    expect(context.state).toEqual(before);
    expect(context.saveManager.save).not.toHaveBeenCalled();
  });

  it('does not roll durable memory back or repeat success effects when a post-save listener throws', () => {
    const context = setup();
    reachQuestThree(context);
    const plot = context.state.crops.plots[0];
    Object.assign(plot, { state: 'planted', cropId: 'turnip', plantedAt: 0, wateredAt: null, growthStartedAt: null });
    context.state.world.elapsedMs = 10;
    context.eventBus.on('crop:watered', () => { throw new Error('UI failed'); });
    context.saveManager.save.mockClear();
    const farming = new FarmingSystem({ state: context.state, eventBus: context.eventBus, saveManager: context.saveManager });

    expect(farming.water(plot.id)).toMatchObject({ ok: true });
    expect(plot.state).toBe('watered');
    expect(context.state.quests).toMatchObject({ activeId: 'chapter-1-plant-crop', phase: 'ready' });
    expect(context.state.quests.progress['chapter-1-plant-crop']).toBe(1);
    expect(context.saveManager.save).toHaveBeenCalledTimes(1);
  });
});
