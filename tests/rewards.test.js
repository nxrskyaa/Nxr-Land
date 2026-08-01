/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/createState.js';
import { EventBus } from '../src/game/EventBus.js';
import { PRIMARY_SAVE_KEY, SaveManager } from '../src/game/SaveManager.js';
import { RewardSystem, localDayKey } from '../src/systems/RewardSystem.js';
import { RewardUI } from '../src/ui/RewardUI.js';

function fakeClock(initial = '2026-08-01T09:00:00') {
  let current = new Date(initial);
  return {
    now: () => new Date(current),
    advance(ms) { current = new Date(current.getTime() + ms); },
    set(value) { current = new Date(value); },
  };
}

function setup({ initial, save = true, state = createInitialState() } = {}) {
  const clock = fakeClock(initial);
  const presence = { visible: true, focused: true };
  const eventBus = new EventBus();
  const saveManager = { save: vi.fn(() => save) };
  const rewards = new RewardSystem({
    state,
    eventBus,
    saveManager,
    clock,
    presence: {
      isVisible: () => presence.visible,
      isFocused: () => presence.focused,
    },
  });
  return { clock, presence, eventBus, saveManager, rewards, state };
}

describe('RewardSystem daily check-in', () => {
  it('uses stable local calendar components rather than a UTC ISO date', () => {
    const local = new Date(2026, 0, 2, 0, 30);
    expect(localDayKey(local)).toBe('2026-01-02');
  });

  it('prevents a same-day duplicate and grants the next consecutive streak reward', () => {
    const context = setup();
    const first = context.rewards.claimDaily();
    const afterFirst = structuredClone(context.state);

    expect(first).toMatchObject({ ok: true, day: 1, date: '2026-08-01' });
    expect(context.state.economy.coin).toBe(80);
    expect(context.rewards.claimDaily()).toMatchObject({ ok: false, code: 'already-claimed' });
    expect(context.state).toEqual(afterFirst);

    context.clock.set('2026-08-02T08:00:00');
    expect(context.rewards.getDailyStatus()).toMatchObject({ available: true, nextDay: 2 });
    expect(context.rewards.claimDaily()).toMatchObject({ ok: true, day: 2, date: '2026-08-02' });
    expect(context.state.rewards.daily.streak).toBe(2);
    expect(context.state.economy.inventory['seed-pack']).toBe(1);
  });

  it('resets after a local-day gap and cycles from day seven back to day one', () => {
    const context = setup();
    context.state.rewards.daily.lastClaimDate = '2026-07-31';
    context.state.rewards.daily.streak = 7;

    expect(context.rewards.claimDaily()).toMatchObject({ ok: true, day: 1 });
    context.clock.set('2026-08-04T10:00:00');
    expect(context.rewards.claimDaily()).toMatchObject({ ok: true, day: 1 });
    expect(context.state.rewards.daily.streak).toBe(1);
  });

  it.each(['false', 'throw'])('rolls back failed %s persistence without a success event', (mode) => {
    const context = setup({ save: false });
    if (mode === 'throw') context.saveManager.save.mockImplementation(() => { throw new Error('quota'); });
    const events = [];
    context.eventBus.on('reward:daily-claimed', (payload) => events.push(payload));
    const before = structuredClone(context.state);

    expect(context.rewards.claimDaily()).toMatchObject({ ok: false, code: 'save-failed' });
    expect(context.state).toEqual(before);
    expect(events).toEqual([]);
  });

  it('commits once even when a success listener throws or attempts a reentrant claim', () => {
    const context = setup();
    const nested = [];
    context.eventBus.on('reward:daily-claimed', () => { throw new Error('observer'); });
    context.eventBus.on('reward:daily-claimed', () => nested.push(context.rewards.claimDaily()));

    expect(context.rewards.claimDaily()).toMatchObject({ ok: true, day: 1 });
    expect(context.saveManager.save).toHaveBeenCalledTimes(1);
    expect(context.state.economy.coin).toBe(80);
    expect(nested[0]).toMatchObject({ ok: false, code: 'claim-locked' });
  });
});

describe('RewardSystem foreground active playtime', () => {
  it('counts only visible focused intervals and never grants milestones automatically', () => {
    const context = setup();
    context.clock.advance(5 * 60_000);
    context.rewards.update();
    expect(context.state.playtime).toMatchObject({ totalMs: 300_000, dailyActiveMs: 300_000, lastActiveDate: '2026-08-01' });
    expect(context.rewards.getMilestones()[0]).toMatchObject({ claimable: true, claimed: false });
    expect(context.state.economy.coin).toBe(50);

    context.presence.visible = false;
    context.clock.advance(10 * 60_000);
    context.rewards.update();
    context.presence.visible = true;
    context.presence.focused = false;
    context.clock.advance(10 * 60_000);
    context.rewards.update();
    expect(context.state.playtime.totalMs).toBe(300_000);
  });

  it('resets daily active time on a local-day transition while keeping cumulative total', () => {
    const context = setup({ initial: '2026-08-01T23:58:00' });
    context.clock.advance(60_000);
    context.rewards.update();
    context.clock.advance(2 * 60_000);
    context.rewards.update();

    expect(context.state.playtime.totalMs).toBe(180_000);
    expect(context.state.playtime.dailyActiveMs).toBe(60_000);
    expect(context.state.playtime.lastActiveDate).toBe('2026-08-02');
  });

  it('manually claims an unlocked milestone exactly once across reload', () => {
    const context = setup();
    context.clock.advance(5 * 60_000);
    context.rewards.update();
    const first = context.rewards.claimMilestone(5);

    expect(first).toMatchObject({ ok: true, minutes: 5 });
    expect(context.state.economy.coin).toBe(70);
    expect(context.state.economy.inventory['seed-turnip']).toBe(5);
    expect(context.rewards.claimMilestone(5)).toMatchObject({ ok: false, code: 'already-claimed' });

    const reloaded = setup({ state: structuredClone(context.state), initial: '2026-08-01T09:05:00' });
    expect(reloaded.rewards.claimMilestone(5)).toMatchObject({ ok: false, code: 'already-claimed' });
    expect(reloaded.state.economy.coin).toBe(70);
  });

  it('rejects locked or unknown milestones without mutation or persistence', () => {
    const context = setup();
    const before = structuredClone(context.state);
    expect(context.rewards.claimMilestone(5)).toMatchObject({ ok: false, code: 'not-ready' });
    expect(context.rewards.claimMilestone(999)).toMatchObject({ ok: false, code: 'unknown-milestone' });
    expect(context.state).toEqual(before);
    expect(context.saveManager.save).not.toHaveBeenCalled();
  });
});

describe('RewardUI and schema-v1 compatibility', () => {
  it('renders a seven-day calendar and native milestone claim controls that refresh after claims', () => {
    document.body.innerHTML = '<main id="game"></main>';
    const context = setup();
    const container = document.querySelector('#game');
    const ui = new RewardUI({ container, rewardSystem: context.rewards, eventBus: context.eventBus });

    expect(container.querySelectorAll('[data-reward-day]')).toHaveLength(7);
    const daily = container.querySelector('[data-claim-daily]');
    expect(daily.tagName).toBe('BUTTON');
    daily.focus();
    daily.click();
    expect(container.querySelector('[data-claim-daily]').disabled).toBe(true);
    expect(container.querySelector('[data-reward-status]').textContent).toMatch(/claimed/i);

    context.clock.advance(5 * 60_000);
    context.rewards.update();
    const milestone = container.querySelector('[data-claim-milestone="5"]');
    expect(milestone.disabled).toBe(false);
    milestone.click();
    const claimedMilestone = container.querySelector('[data-claim-milestone="5"]');
    expect(claimedMilestone.disabled).toBe(true);
    expect(claimedMilestone.textContent).toMatch(/claimed/i);
    ui.dispose();
    expect(container.querySelector('.reward-ui')).toBeNull();
  });

  it('default-merges missing reward fields in an older schema-v1 save without losing progress', () => {
    const older = createInitialState();
    older.economy.coin = 321;
    delete older.rewards;
    delete older.playtime;
    const values = new Map([[PRIMARY_SAVE_KEY, JSON.stringify(older)]]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };

    const loaded = new SaveManager({ storage, createInitialState }).load();
    expect(loaded.economy.coin).toBe(321);
    expect(loaded.rewards.daily.track).toHaveLength(7);
    expect(loaded.rewards.playtime.milestones).toHaveLength(5);
    expect(loaded.playtime).toEqual({ totalMs: 0, dailyActiveMs: 0, lastActiveDate: null });
  });
});
