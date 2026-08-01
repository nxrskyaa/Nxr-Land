/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/createState.js';
import { CharacterCreator, sanitizePlayerName } from '../src/ui/CharacterCreator.js';

describe('character creator name sanitation', () => {
  it('removes markup/control characters, collapses spaces, and limits length', () => {
    expect(sanitizePlayerName('  <b>Meadow\u0000   Friend</b>  ')).toBe('bMeadow Friendb');
    expect(sanitizePlayerName('A'.repeat(40))).toHaveLength(20);
    expect(sanitizePlayerName('   ')).toBe('New Gardener');
  });
});

function createCreator(saveResult) {
  document.body.innerHTML = '<button id="return-focus">Open creator</button><main id="app"></main>';
  const previousFocus = document.querySelector('#return-focus');
  previousFocus.focus();
  const state = createInitialState();
  const player = { updateAppearance: vi.fn() };
  const eventBus = { emit: vi.fn() };
  const saveManager = { save: vi.fn(() => saveResult), lastStatus: saveResult ? 'saved' : 'error' };
  const onComplete = vi.fn();
  const creator = new CharacterCreator({
    container: document.querySelector('#app'), state, player, eventBus, saveManager, onComplete,
  });
  return { creator, state, player, eventBus, saveManager, onComplete, previousFocus };
}

describe('CharacterCreator confirmation', () => {
  it('keeps the creator open and does not emit completion when persistence fails', () => {
    const { creator, state, eventBus, onComplete } = createCreator(false);
    creator.nameInput.value = 'Mira';

    expect(creator.confirm()).toBe(false);
    expect(state.player.creatorComplete).toBe(false);
    expect(document.querySelector('.creator-overlay')).not.toBeNull();
    expect(document.querySelector('.creator-status').textContent).toMatch(/save/i);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('persists before completing, emits once, removes the dialog, and restores focus', () => {
    const { creator, state, eventBus, saveManager, onComplete, previousFocus } = createCreator(true);
    creator.nameInput.value = 'Mira';

    expect(creator.confirm()).toBe(true);
    expect(creator.confirm()).toBe(false);
    expect(saveManager.save).toHaveBeenCalledTimes(1);
    expect(state.player).toEqual(expect.objectContaining({ name: 'Mira', creatorComplete: true }));
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.creator-overlay')).toBeNull();
    expect(document.activeElement).toBe(previousFocus);
  });
});
