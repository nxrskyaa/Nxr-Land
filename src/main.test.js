import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVISION } from 'three';
import { initializeApp, installPageLifecycle } from './main.js';

afterEach(() => vi.restoreAllMocks());

describe('app initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main id="app" aria-busy="true">
        <p data-loading-status>Preparing your village…</p>
      </main>
    `;
  });

  it('marks the loading shell ready with the active Three.js revision', () => {
    const app = document.querySelector('#app');
    const loadingStatus = document.querySelector('[data-loading-status]');

    expect(app.getAttribute('aria-busy')).toBe('true');
    expect(loadingStatus.textContent).toBe('Preparing your village…');

    initializeApp(document);

    expect(app.getAttribute('aria-busy')).toBe('false');
    expect(loadingStatus.textContent).toBe('Your village is ready.');
    expect(app.dataset.threeRevision).toBe(REVISION);
  });

  it('starts an injected game with loaded state and app dependencies', () => {
    let options;
    class FakeGame {
      constructor(value) { options = value; }
      start() { this.started = true; }
    }
    const storage = { getItem: () => null, setItem() {}, removeItem() {} };

    const game = initializeApp(document, { GameClass: FakeGame, storage, forceGame: true });

    expect(game.started).toBe(true);
    expect(options.container).toBe(document.querySelector('#app'));
    expect(options.state.schemaVersion).toBe(1);
    expect(options.eventBus).toBeDefined();
    expect(options.saveManager.storage).toBe(storage);
  });

  it('shows an attractive fatal fallback when WebGL initialization fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    class BrokenGame { constructor() { throw new Error('no webgl'); } }

    initializeApp(document, { GameClass: BrokenGame, forceGame: true });

    expect(document.querySelector('.fatal-panel')).not.toBeNull();
    expect(document.querySelector('.fatal-panel').textContent).toContain('village needs a little more sunlight');
    expect(document.querySelector('#app').getAttribute('aria-busy')).toBe('false');
  });

  it('disposes the actual game when start fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let game;
    class StartFailureGame {
      constructor() { game = this; }
      start() { throw new Error('start failed'); }
      dispose() { this.disposed = (this.disposed ?? 0) + 1; }
    }

    expect(initializeApp(document, { GameClass: StartFailureGame, forceGame: true })).toBeNull();
    expect(game.disposed).toBe(1);
    expect(document.querySelector('.fatal-panel')).not.toBeNull();
  });

  it('defers fatal teardown and disposes before showing fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let game;
    class ContextLossGame {
      constructor(options) { game = this; this.onFatal = options.onFatal; }
      start() {}
      dispose() {
        this.disposed = (this.disposed ?? 0) + 1;
        expect(document.querySelector('.fatal-panel')).toBeNull();
      }
    }

    initializeApp(document, { GameClass: ContextLossGame, forceGame: true });
    game.onFatal(new Error('context lost'));
    expect(game.disposed).toBeUndefined();
    await Promise.resolve();

    expect(game.disposed).toBe(1);
    expect(document.querySelector('.fatal-panel')).not.toBeNull();
  });

  it('preserves a game in BFCache and resumes it on pageshow', () => {
    const calls = [];
    const game = {
      stop: () => calls.push('stop'),
      start: () => calls.push('start'),
      dispose: () => calls.push('dispose'),
    };
    const cleanup = installPageLifecycle(game, window);

    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    cleanup();

    expect(calls).toEqual(['stop', 'start']);
  });

  it('disposes a game leaving without BFCache', () => {
    const calls = [];
    const game = {
      stop: () => calls.push('stop'),
      start: () => calls.push('start'),
      dispose: () => calls.push('dispose'),
    };
    installPageLifecycle(game, window);

    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));

    expect(calls).toEqual(['dispose']);
  });
});
