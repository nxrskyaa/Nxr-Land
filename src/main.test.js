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
});
