export class DialogueUI {
  constructor({ container, eventBus } = {}) {
    if (!container) throw new Error('DialogueUI requires a container');
    this.container = container;
    this.eventBus = eventBus;
    this.lines = [];
    this.index = 0;
    this.previousFocus = null;
    this.disposed = false;
    this.root = container.ownerDocument.createElement('div');
    this.root.className = 'dialogue-layer';
    this.root.innerHTML = `
      <p class="interaction-prompt" data-interaction-prompt role="status" aria-live="polite" hidden></p>
      <section class="dialogue-ui" role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker" aria-describedby="dialogue-line" hidden>
        <header><div><h2 id="dialogue-speaker"></h2><p data-dialogue-role></p></div><span aria-hidden="true">✦</span></header>
        <p id="dialogue-line" data-dialogue-line></p>
        <button type="button" data-dialogue-next aria-label="Continue dialogue">Continue <kbd>E</kbd></button>
      </section>`;
    container.append(this.root);
    this.dialog = this.root.querySelector('.dialogue-ui');
    this.nextButton = this.root.querySelector('[data-dialogue-next]');
    this.boundAdvance = () => this.advance();
    this.nextButton.addEventListener('click', this.boundAdvance);
    this.boundKeydown = (event) => {
      if (!this.isOpen()) return;
      if (['Enter', 'Space', 'KeyE', 'Escape'].includes(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.code === 'Escape') this.close();
        else this.advance();
      }
    };
    container.ownerDocument.defaultView?.addEventListener('keydown', this.boundKeydown);
  }

  open({ speaker = 'Villager', role = 'Villager', lines = [] } = {}) {
    if (!Array.isArray(lines) || lines.length === 0) return false;
    this.previousFocus = this.container.ownerDocument.activeElement;
    this.lines = lines.map(String);
    this.index = 0;
    this.dialog.querySelector('#dialogue-speaker').textContent = speaker;
    this.dialog.querySelector('[data-dialogue-role]').textContent = role;
    this.dialog.hidden = false;
    this.#renderLine();
    this.nextButton.focus();
    this.eventBus?.emit?.('dialogue:opened', { speaker, role, lineCount: this.lines.length });
    return true;
  }

  #renderLine() {
    this.dialog.querySelector('[data-dialogue-line]').textContent = this.lines[this.index] ?? '';
    this.nextButton.firstChild.textContent = this.index === this.lines.length - 1 ? 'Close ' : 'Continue ';
    this.nextButton.setAttribute('aria-label', this.index === this.lines.length - 1 ? 'Close dialogue' : 'Continue dialogue');
  }

  advance() {
    if (!this.isOpen()) return false;
    if (this.index < this.lines.length - 1) {
      this.index += 1;
      this.#renderLine();
      this.eventBus?.emit?.('dialogue:advanced', { index: this.index });
      return true;
    }
    this.close();
    return false;
  }

  close() {
    if (!this.isOpen()) return;
    this.dialog.hidden = true;
    this.lines = [];
    this.index = 0;
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
    this.eventBus?.emit?.('dialogue:closed');
  }

  isOpen() {
    return Boolean(this.dialog && !this.dialog.hidden);
  }

  setPrompt(message = '') {
    const prompt = this.root.querySelector('[data-interaction-prompt]');
    prompt.textContent = message ? `E / Action · ${message}` : '';
    prompt.hidden = !message || this.isOpen();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.container?.ownerDocument.defaultView?.removeEventListener('keydown', this.boundKeydown);
    this.nextButton?.removeEventListener('click', this.boundAdvance);
    this.root?.remove();
    this.root = null;
    this.dialog = null;
    this.nextButton = null;
  }
}
