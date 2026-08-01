import { REVISION } from 'three';
import './styles.css';
import { createInitialState } from './game/createState.js';
import { EventBus } from './game/EventBus.js';
import { SaveManager } from './game/SaveManager.js';
import { Game } from './game/Game.js';

export function showFatalFallback(app, error) {
  if (!app) return;
  app.setAttribute('aria-busy', 'false');
  app.classList.add('has-fatal-error');
  app.querySelector('.loading-shell')?.remove();
  const panel = app.ownerDocument.createElement('section');
  panel.className = 'fatal-panel';
  panel.setAttribute('role', 'alert');
  panel.innerHTML = `
    <span class="fatal-icon" aria-hidden="true">☁</span>
    <p class="eyebrow">Nxr Land is resting</p>
    <h1>This village needs a little more sunlight.</h1>
    <p>3D graphics could not start in this browser. Refresh the page or enable hardware acceleration to wander in.</p>
    <button type="button" data-retry>Try again</button>
  `;
  panel.querySelector('[data-retry]')?.addEventListener('click', () => app.ownerDocument.defaultView?.location.reload());
  app.append(panel);
  console.error('Nxr Land could not initialize WebGL.', error);
}

function addScenicOverlay(app) {
  if (app.querySelector('.scenic-overlay')) return;
  const overlay = app.ownerDocument.createElement('div');
  overlay.className = 'scenic-overlay';
  overlay.innerHTML = `
    <header class="village-brand"><span class="brand-mark">N</span><div><b>Nxr Land</b><small>A tiny world, growing softly</small></div></header>
    <div class="day-pill"><span aria-hidden="true">☀</span><div><small>Meadow Day</small><b>Morning glow</b></div></div>
    <p class="explore-note">A peaceful village is taking root</p>
  `;
  app.append(overlay);
}

export function initializeApp(root = document, options = {}) {
  const app = root.querySelector?.('#app');
  const loadingStatus = root.querySelector?.('[data-loading-status]');
  if (!app) return null;

  app.dataset.threeRevision = REVISION;
  if (!options.forceGame && import.meta.env.MODE === 'test') {
    app.setAttribute('aria-busy', 'false');
    if (loadingStatus) loadingStatus.textContent = 'Your village is ready.';
    return null;
  }

  const GameClass = options.GameClass ?? Game;
  const storage = options.storage ?? root.defaultView?.localStorage ?? globalThis.localStorage;

  try {
    const eventBus = options.eventBus ?? new EventBus();
    const saveManager = options.saveManager ?? new SaveManager({ storage, createInitialState });
    const state = options.state ?? saveManager.load();
    const game = new GameClass({
      container: app,
      state,
      eventBus,
      saveManager,
      onFatal: (error) => showFatalFallback(app, error),
    });
    game.start();
    app.setAttribute('aria-busy', 'false');
    app.classList.add('is-ready');
    if (loadingStatus) loadingStatus.textContent = 'Your village is ready.';
    addScenicOverlay(app);
    root.defaultView?.addEventListener('pagehide', () => game.dispose(), { once: true });
    return game;
  } catch (error) {
    showFatalFallback(app, error);
    return null;
  }
}

if (typeof document !== 'undefined') initializeApp(document);
