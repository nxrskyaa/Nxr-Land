/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { QUESTS } from '../src/data/quests.js';
import { createInitialState } from '../src/game/createState.js';
import { EventBus } from '../src/game/EventBus.js';
import { QuestSystem } from '../src/systems/QuestSystem.js';
import { NPC } from '../src/entities/NPC.js';
import { NPCFactory } from '../src/visuals/NPCFactory.js';
import { DialogueUI } from '../src/ui/DialogueUI.js';
import { QuestUI } from '../src/ui/QuestUI.js';
import { chooseInteractionTarget, getEnteredLocation } from '../src/game/Game.js';

function setup({ state = createInitialState(), save = true } = {}) {
  const eventBus = new EventBus();
  const saveManager = { save: vi.fn(() => save) };
  const completed = [];
  eventBus.on('quest:completed', (payload) => completed.push(payload));
  const quests = new QuestSystem({ state, eventBus, saveManager });
  return { state, eventBus, saveManager, completed, quests };
}

function advanceToGarden(context) {
  expect(context.quests.interactNpc('mira')).toMatchObject({ ok: true, action: 'accept' });
  expect(context.quests.record('location:entered', { locationId: 'town-plaza' })).toMatchObject({ ok: true, phase: 'ready' });
  const result = context.quests.interactNpc('mira');
  expect(context.quests.interactNpc('mira')).toMatchObject({ ok: true, action: 'accept' });
  return result;
}

function completeGarden(context) {
  for (const objectId of ['garden-weed-1', 'garden-weed-2', 'garden-weed-3']) {
    expect(context.quests.interact(objectId).ok).toBe(true);
  }
}

describe('QuestSystem data-driven Chapter 1 flow', () => {
  it('starts from the catalog and ignores unrelated or malformed targets', () => {
    const context = setup();
    expect(context.quests.getActiveQuest()).toEqual(QUESTS[0]);
    expect(context.quests.interactNpc('mira')).toMatchObject({ ok: true, action: 'accept' });
    context.saveManager.save.mockClear();
    const before = structuredClone(context.state);

    expect(context.quests.record('location:entered', { locationId: 'river-garden' }))
      .toMatchObject({ ok: false, code: 'event-mismatch' });
    expect(context.quests.record('crop:watered', { cropId: 'turnip' }))
      .toMatchObject({ ok: false, code: 'event-mismatch' });
    expect(context.state).toEqual(before);
    expect(context.saveManager.save).not.toHaveBeenCalled();
  });

  it('executes all eight sequential quests and applies each reward and unlock exactly once', () => {
    const context = setup();
    const initialCoin = context.state.economy.coin;

    expect(advanceToGarden(context)).toMatchObject({ ok: true, completedId: QUESTS[0].id });
    completeGarden(context);
    expect(context.quests.interactNpc('mira').action).toBe('turn-in');
    expect(context.quests.interactNpc('mira').action).toBe('accept');
    expect(context.quests.record('crop:watered', { cropId: 'turnip', plotId: 'home-plot-1' }).ok).toBe(true);
    expect(context.quests.interactNpc('mira').action).toBe('turn-in');
    expect(context.quests.interactNpc('tomo').action).toBe('accept');
    expect(context.quests.record('economy:sold', {
      itemId: 'produce-turnip', item: { id: 'produce-turnip', type: 'produce' }, quantity: 1,
    }).ok).toBe(true);
    expect(context.quests.interactNpc('tomo').action).toBe('turn-in');
    expect(context.quests.interactNpc('lumi').action).toBe('accept');
    expect(context.quests.interact('river-spirit-seed').ok).toBe(true);
    expect(context.quests.interactNpc('lumi').action).toBe('turn-in');
    expect(context.quests.interactNpc('lumi').action).toBe('accept');
    expect(context.quests.interact('lumi-hatch-nook').ok).toBe(true);
    expect(context.quests.interactNpc('lumi').action).toBe('turn-in');
    expect(context.quests.interactNpc('mira').action).toBe('accept');
    expect(context.quests.interact('village-planter-site').ok).toBe(true);
    expect(context.quests.interactNpc('mira').action).toBe('turn-in');
    expect(context.quests.interactNpc('mira').action).toBe('accept');
    expect(context.quests.interact('heartroot-first-light').ok).toBe(true);
    expect(context.quests.interactNpc('mira').action).toBe('turn-in');

    expect(context.state.quests).toMatchObject({ activeId: null, completedIds: QUESTS.map(({ id }) => id) });
    expect(context.state.economy.coin).toBe(initialCoin + QUESTS.reduce((sum, quest) => sum + quest.reward.coin, 0));
    expect(context.state.economy.inventory).toMatchObject({
      'seed-turnip': 6, 'seed-carrot': 2, 'gacha-ticket': 1, 'spirit-seed': 0,
    });
    expect(context.state.collection.pets).toEqual(['pet-sproutling']);
    expect(context.state.collection.wardrobe).toContain('wardrobe-top-heartroot-jacket');
    expect(context.state.world.unlocks).toEqual(['market', 'pet-gacha', 'building-mode', 'land-expansions']);
    expect(context.state.world.placedBuildings).toContainEqual(expect.objectContaining({ id: 'building-village-planter' }));
    expect(context.state.world.upgrades.heartrootFirstLight).toBe(true);
    expect(context.completed).toHaveLength(8);

    const finished = structuredClone(context.state);
    expect(context.quests.record('heartroot:restored', { lightId: 'first-light' }))
      .toMatchObject({ ok: false, code: 'chapter-complete' });
    expect(context.quests.interact('heartroot-first-light'))
      .toMatchObject({ ok: false, code: 'already-used' });
    expect(context.state).toEqual(finished);
  });

  it('persists partial progress across reload and never duplicates progress from one-shot world objects', () => {
    const first = setup();
    advanceToGarden(first);
    expect(first.quests.interact('garden-weed-1').ok).toBe(true);
    const reloadedState = structuredClone(first.state);
    first.quests.dispose();

    const second = setup({ state: reloadedState });
    expect(second.quests.getProgress()).toMatchObject({ current: 1, required: 3 });
    expect(second.quests.interact('garden-weed-1')).toMatchObject({ ok: false, code: 'already-used' });
    expect(second.quests.interact('garden-weed-2').ok).toBe(true);
    expect(second.quests.interact('garden-weed-3').ok).toBe(true);
    expect(second.state.quests).toMatchObject({ activeId: 'chapter-1-clear-garden', phase: 'ready' });
  });

  it.each(['false', 'throw'])('rolls back progress, seam mutations, completion and rewards when save returns %s', (mode) => {
    const context = setup();
    expect(context.quests.interactNpc('mira').ok).toBe(true);
    context.saveManager.save.mockReturnValue(false);
    if (mode === 'throw') context.saveManager.save.mockImplementation(() => { throw new Error('quota'); });
    const before = structuredClone(context.state);

    expect(context.quests.record('location:entered', { locationId: 'town-plaza' }))
      .toMatchObject({ ok: false, code: 'save-failed' });
    expect(context.state).toEqual(before);
    expect(context.completed).toEqual([]);

    context.saveManager.save.mockReturnValue(true);
    expect(context.quests.record('location:entered', { locationId: 'town-plaza' }).ok).toBe(true);
    expect(context.quests.interactNpc('mira').action).toBe('turn-in');
    expect(context.quests.interactNpc('mira').action).toBe('accept');
    context.saveManager.save.mockReturnValue(false);
    const beforeWeed = structuredClone(context.state);
    expect(context.quests.interact('garden-weed-1')).toMatchObject({ ok: false, code: 'save-failed' });
    expect(context.state).toEqual(beforeWeed);
  });

  it('does not mutate migration defaults in its constructor and rejects unsafe reward totals atomically', () => {
    const state = createInitialState();
    delete state.quests.interactedIds;
    delete state.world.unlocks;
    const before = structuredClone(state);
    expect(() => new QuestSystem({ state, eventBus: new EventBus(), saveManager: { save: vi.fn() } }))
      .toThrow(/interactedIds.*unlocks/i);
    expect(state).toEqual(before);

    const context = setup();
    expect(context.quests.interactNpc('mira').ok).toBe(true);
    expect(context.quests.record('location:entered', { locationId: 'town-plaza' }).ok).toBe(true);
    context.state.economy.coin = Number.MAX_SAFE_INTEGER;
    const unsafeBefore = structuredClone(context.state);
    context.saveManager.save.mockClear();
    expect(context.quests.interactNpc('mira')).toMatchObject({ ok: false, code: 'transaction-failed' });
    expect(context.state).toEqual(unsafeBefore);
    expect(context.saveManager.save).not.toHaveBeenCalled();
  });

  it('does not place a duplicate quest building when restored state already contains it', () => {
    const context = setup();
    advanceToGarden(context);
    completeGarden(context);
    context.quests.interactNpc('mira'); context.quests.interactNpc('mira');
    context.quests.record('crop:watered', { cropId: 'turnip' });
    context.quests.interactNpc('mira'); context.quests.interactNpc('tomo');
    context.quests.record('economy:sold', {
      itemId: 'produce-turnip', item: { id: 'produce-turnip', type: 'produce' }, quantity: 1,
    });
    context.quests.interactNpc('tomo'); context.quests.interactNpc('lumi');
    context.quests.interact('river-spirit-seed');
    context.quests.interactNpc('lumi'); context.quests.interactNpc('lumi');
    context.quests.interact('lumi-hatch-nook');
    context.quests.interactNpc('lumi'); context.quests.interactNpc('mira');
    context.state.world.placedBuildings.push({
      id: 'building-village-planter', x: 2.8, y: 0, z: -2.4, rotation: 0,
    });
    const before = structuredClone(context.state);
    expect(context.quests.interact('village-planter-site')).toMatchObject({ ok: false, code: 'transaction-failed' });
    expect(context.state).toEqual(before);
  });

  it('listens to real farming and economy event shapes but validates their semantic target', () => {
    const context = setup();
    advanceToGarden(context);
    completeGarden(context);
    context.quests.interactNpc('mira'); context.quests.interactNpc('mira');
    context.quests.record('crop:watered', { cropId: null, plotId: 'home-plot-1' });
    expect(context.state.quests.activeId).toBe('chapter-1-plant-crop');
    context.quests.record('crop:watered', { cropId: 'carrot', plotId: 'home-plot-1' });
    expect(context.state.quests.phase).toBe('ready');
    context.quests.interactNpc('mira'); context.quests.interactNpc('tomo');
    context.quests.record('economy:sold', { itemId: 'seed-turnip', item: { type: 'seed' }, quantity: 1 });
    expect(context.state.quests.activeId).toBe('chapter-1-reopen-market');
    context.quests.record('economy:sold', { itemId: 'produce-carrot', item: { type: 'produce' }, quantity: 1 });
    expect(context.state.quests).toMatchObject({ activeId: 'chapter-1-reopen-market', phase: 'ready' });
  });
});

describe('NPCs and contextual interaction priority', () => {
  it('builds three generated chibi NPCs with distinct silhouettes, names, and roles', () => {
    const scene = new THREE.Scene();
    const factory = new NPCFactory();
    const definitions = [
      { id: 'mira', name: 'Mira', role: 'Village Steward', position: { x: 2, z: 1 } },
      { id: 'tomo', name: 'Tomo', role: 'Market Keeper', position: { x: -8, z: 1 } },
      { id: 'lumi', name: 'Lumi', role: 'Spirit Researcher', position: { x: 8, z: -5 } },
    ];
    const npcs = definitions.map((definition) => new NPC({ scene, factory, definition }));
    expect(npcs.map((npc) => npc.root.name)).toEqual(['NPC Mira', 'NPC Tomo', 'NPC Lumi']);
    expect(new Set(npcs.map((npc) => npc.root.userData.silhouette)).size).toBe(3);
    expect(npcs.map((npc) => npc.role)).toEqual(definitions.map(({ role }) => role));
    expect(npcs[0].distanceTo({ x: 2, z: 2 })).toBeCloseTo(1);
    npcs.forEach((npc) => npc.dispose());
    factory.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('detects location entry once inside the bounded plaza area', () => {
    expect(getEnteredLocation({ x: 2.9, z: 2.8 }, null)).toBe('town-plaza');
    expect(getEnteredLocation({ x: 2.9, z: 2.8 }, 'town-plaza')).toBeNull();
    expect(getEnteredLocation({ x: 8, z: -6 }, null)).toBe('river-garden');
    expect(getEnteredLocation({ x: 15, z: 11 }, null)).toBeNull();
  });

  it('prioritizes an open dialogue, then the nearest quest object or NPC, then farming', () => {
    const targets = [
      { type: 'farm', id: 'plot', distance: 0.4 },
      { type: 'npc', id: 'mira', distance: 1.1 },
      { type: 'quest', id: 'garden-weed-1', distance: 0.8 },
    ];
    expect(chooseInteractionTarget(targets)).toMatchObject({ type: 'quest', id: 'garden-weed-1' });
    expect(chooseInteractionTarget(targets, { dialogueOpen: true })).toEqual({ type: 'dialogue' });
    expect(chooseInteractionTarget(targets.filter(({ type }) => type !== 'quest'))).toMatchObject({ type: 'npc' });
    expect(chooseInteractionTarget(targets.filter(({ type }) => type === 'farm'))).toMatchObject({ type: 'farm' });
  });
});

describe('accessible quest and dialogue UI', () => {
  it('renders current objective, progress, destination, and reward and updates from quest events', () => {
    document.body.innerHTML = '<main id="game"></main>';
    const context = setup();
    const ui = new QuestUI({ container: document.querySelector('#game'), questSystem: context.quests, eventBus: context.eventBus });
    const panel = document.querySelector('.quest-ui');
    expect(panel.getAttribute('aria-label')).toBe('Current quest');
    expect(panel.textContent).toContain('A New Patch of Sky');
    expect(panel.textContent).toContain('Town Plaza');
    expect(panel.textContent).toContain('0 / 1');
    expect(panel.textContent).toContain('20 coin');
    advanceToGarden(context);
    expect(panel.textContent).toContain('Room to Grow');
    ui.dispose(); ui.dispose();
    expect(document.querySelector('.quest-ui')).toBeNull();
  });

  it('shows multi-line modal dialogue with keyboard/mobile Action parity, focus handling, and prompt status', () => {
    document.body.innerHTML = '<main id="game"><button id="before">Before</button></main>';
    const eventBus = new EventBus();
    const ui = new DialogueUI({ container: document.querySelector('#game'), eventBus });
    document.querySelector('#before').focus();
    ui.open({ speaker: 'Mira', role: 'Village Steward', lines: ['First line.', 'Second line.'] });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('First line.');
    expect(document.activeElement).toBe(document.querySelector('[data-dialogue-next]'));
    expect(ui.advance()).toBe(true);
    expect(dialog.textContent).toContain('Second line.');
    document.querySelector('[data-dialogue-next]').click();
    expect(ui.isOpen()).toBe(false);
    expect(document.activeElement.id).toBe('before');
    ui.setPrompt('Talk to Lumi');
    expect(document.querySelector('[data-interaction-prompt]').textContent).toContain('Talk to Lumi');
    ui.dispose(); ui.dispose();
  });
});
