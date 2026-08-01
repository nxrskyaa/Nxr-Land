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
  app.classList.remove('is-ready');
  app.querySelector('.loading-shell')?.remove();
  app.querySelector('.scenic-overlay')?.remove();
  app.querySelectorAll('.game-canvas').forEach((canvas) => canvas.remove());
  if (app.querySelector('.fatal-panel')) return;
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
    <p class="explore-note controls-hint"><span>Move</span> WASD / Arrow keys <i>•</i> <span>Action</span> Space / E <i>•</i> Click to walk</p>
    <p class="action-feedback" role="status" aria-live="polite"></p>
    <section id="landmark-description" class="visually-hidden">
      <h2>Village landmarks</h2>
      <ul><li>Town Plaza</li><li>Home Plot</li><li>Market Lane</li><li>River Garden</li><li>Mosswood Gate</li><li>Sunmeadow Gate</li><li>Heartroot</li></ul>
    </section>
  `;
  app.append(overlay);
}

export function installPageLifecycle(game, view) {
  if (!game || !view?.addEventListener) return () => {};
  let active = true;
  const onPageHide = (event) => {
    if (event.persisted) {
      game.stop?.();
      return;
    }
    cleanup();
    game.dispose?.();
  };
  const onPageShow = (event) => {
    if (event.persisted) game.start?.();
  };
  const cleanup = () => {
    if (!active) return;
    active = false;
    view.removeEventListener('pagehide', onPageHide);
    view.removeEventListener('pageshow', onPageShow);
  };
  view.addEventListener('pagehide', onPageHide);
  view.addEventListener('pageshow', onPageShow);
  return cleanup;
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
  let game = null;
  let cleanupLifecycle = () => {};
  let fatalScheduled = false;
  const handleFatal = (error) => {
    if (fatalScheduled) return;
    fatalScheduled = true;
    queueMicrotask(() => {
      cleanupLifecycle();
      game?.dispose?.();
      showFatalFallback(app, error);
    });
  };

  try {
    const eventBus = options.eventBus ?? new EventBus();
    const saveManager = options.saveManager ?? new SaveManager({ storage, createInitialState });
    const state = options.state ?? saveManager.load();
    game = new GameClass({
      container: app,
      state,
      eventBus,
      saveManager,
      onFatal: handleFatal,
    });
    game.start();
    app.setAttribute('aria-busy', 'false');
    app.classList.add('is-ready');
    if (loadingStatus) loadingStatus.textContent = 'Your village is ready.';
    addScenicOverlay(app);
    cleanupLifecycle = installPageLifecycle(game, root.defaultView);
    return game;
  } catch (error) {
    cleanupLifecycle();
    game?.dispose?.();
    showFatalFallback(app, error);
    return null;
  }
}

if (typeof document !== 'undefined') initializeApp(document);
