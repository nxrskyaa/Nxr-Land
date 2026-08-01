import { REVISION } from 'three';
import './styles.css';

export function initializeApp(root = document) {
  const app = root.querySelector('#app');
  const loadingStatus = root.querySelector('[data-loading-status]');

  if (app && loadingStatus) {
    app.dataset.threeRevision = REVISION;
    app.setAttribute('aria-busy', 'false');
    loadingStatus.textContent = 'Your village is ready.';
  }
}

initializeApp();
