import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/game/EventBus.js';

describe('EventBus', () => {
  it.each([undefined, null, {}, 'listener'])('rejects non-function listeners: %j', (listener) => {
    const bus = new EventBus();

    expect(() => bus.on('tick', listener)).toThrow(TypeError);
  });

  it('emits synchronously in subscription order', () => {
    const bus = new EventBus();
    const calls = [];

    bus.on('crop:planted', (payload) => calls.push(`first:${payload.id}`));
    bus.on('crop:planted', (payload) => calls.push(`second:${payload.id}`));

    bus.emit('crop:planted', { id: 'turnip' });

    expect(calls).toEqual(['first:turnip', 'second:turnip']);
  });

  it('treats duplicate listener registrations as independent subscriptions', () => {
    const bus = new EventBus();
    const calls = [];
    const listener = () => calls.push('duplicate');
    const unsubscribeFirst = bus.on('tick', listener);
    bus.on('tick', () => calls.push('middle'));
    const unsubscribeSecond = bus.on('tick', listener);

    bus.emit('tick');
    expect(calls).toEqual(['duplicate', 'middle', 'duplicate']);

    calls.length = 0;
    unsubscribeFirst();
    bus.emit('tick');
    expect(calls).toEqual(['middle', 'duplicate']);

    calls.length = 0;
    unsubscribeSecond();
    bus.emit('tick');
    expect(calls).toEqual(['middle']);
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

  it('supports reentrant emission with an independent listener snapshot', () => {
    const bus = new EventBus();
    const calls = [];
    let nested = false;

    bus.on('tick', (payload) => {
      calls.push(`first:${payload}`);
      if (!nested) {
        nested = true;
        bus.emit('tick', 'nested');
      }
    });
    bus.on('tick', (payload) => calls.push(`second:${payload}`));

    bus.emit('tick', 'outer');

    expect(calls).toEqual([
      'first:outer',
      'first:nested',
      'second:nested',
      'second:outer',
    ]);
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
