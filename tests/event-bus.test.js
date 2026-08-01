import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/game/EventBus.js';

describe('EventBus', () => {
  it('emits synchronously in subscription order', () => {
    const bus = new EventBus();
    const calls = [];

    bus.on('crop:planted', (payload) => calls.push(`first:${payload.id}`));
    bus.on('crop:planted', (payload) => calls.push(`second:${payload.id}`));

    bus.emit('crop:planted', { id: 'turnip' });

    expect(calls).toEqual(['first:turnip', 'second:turnip']);
  });

  it('returns a safe idempotent unsubscribe function', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const unsubscribe = bus.on('day:started', listener);

    unsubscribe();
    unsubscribe();
    bus.off('day:started', listener);
    bus.emit('day:started');

    expect(listener).not.toHaveBeenCalled();
  });

  it('uses a listener snapshot so mutations affect only later emits', () => {
    const bus = new EventBus();
    const calls = [];
    const third = () => calls.push('third');
    let unsubscribeSecond;

    bus.on('tick', () => {
      calls.push('first');
      unsubscribeSecond();
      bus.on('tick', third);
    });
    unsubscribeSecond = bus.on('tick', () => calls.push('second'));

    bus.emit('tick');
    expect(calls).toEqual(['first', 'second']);

    calls.length = 0;
    bus.emit('tick');
    expect(calls).toEqual(['first', 'third']);
  });

  it('propagates listener errors and stops the current dispatch', () => {
    const bus = new EventBus();
    const afterError = vi.fn();
    const failure = new Error('listener failed');

    bus.on('save', () => { throw failure; });
    bus.on('save', afterError);

    expect(() => bus.emit('save')).toThrow(failure);
    expect(afterError).not.toHaveBeenCalled();
  });
});
