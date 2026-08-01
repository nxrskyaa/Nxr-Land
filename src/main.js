import { REVISION } from 'three';
import './styles.css';

const app = document.querySelector('#app');
const loadingStatus = document.querySelector('[data-loading-status]');

if (app && loadingStatus) {
  app.dataset.threeRevision = REVISION;
  app.setAttribute('aria-busy', 'false');
  loadingStatus.textContent = 'Your village is ready.';
}
