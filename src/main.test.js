import { beforeEach, describe, expect, it } from 'vitest';
import { REVISION } from 'three';
import { initializeApp } from './main.js';

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
    class BrokenGame { constructor() { throw new Error('no webgl'); } }

    initializeApp(document, { GameClass: BrokenGame, forceGame: true });

    expect(document.querySelector('.fatal-panel')).not.toBeNull();
    expect(document.querySelector('.fatal-panel').textContent).toContain('village needs a little more sunlight');
    expect(document.querySelector('#app').getAttribute('aria-busy')).toBe('false');
  });
});
