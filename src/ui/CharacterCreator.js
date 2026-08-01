import { CHARACTER_OPTIONS, normalizeAppearance } from '../visuals/CharacterFactory.js';

export function sanitizePlayerName(value) {
  const clean = String(value ?? '')
    .replace(/[<>/\\\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(clean || 'New Gardener').slice(0, 20).join('');
}

function optionButtons(doc, group, selected) {
  const fragment = doc.createDocumentFragment();
  CHARACTER_OPTIONS[group].forEach(({ value, label }) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'creator-choice';
    button.dataset.value = value;
    button.dataset.group = group;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(value === selected));
    button.title = label;
    if (value.startsWith('#')) {
      const swatch = doc.createElement('span');
      swatch.className = 'choice-swatch';
      swatch.style.backgroundColor = value;
      button.append(swatch);
    }
    const text = doc.createElement('span');
    text.textContent = label;
    button.append(text);
    fragment.append(button);
  });
  return fragment;
}

export class CharacterCreator {
  constructor({ container, state, player, eventBus, saveManager, onComplete } = {}) {
    this.container = container;
    this.state = state;
    this.player = player;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.onComplete = onComplete;
    this.appearance = normalizeAppearance(state?.player?.appearance);
    this.originalPlayer = state?.player ? {
      name: state.player.name,
      appearance: { ...state.player.appearance },
      creatorComplete: state.player.creatorComplete,
    } : null;
    this.confirming = false;
    this.previousFocus = container?.ownerDocument?.activeElement;
    this.#render();
  }

  #listeners = [];

  #listen(target, type, handler) {
    target?.addEventListener?.(type, handler);
    this.#listeners.push(() => target?.removeEventListener?.(type, handler));
  }

  #render() {
    const doc = this.container?.ownerDocument;
    if (!doc) return;
    const overlay = doc.createElement('div');
    overlay.className = 'creator-overlay';
    overlay.innerHTML = `
      <section class="creator-card" role="dialog" aria-modal="true" aria-labelledby="creator-title" aria-describedby="creator-intro">
        <div class="creator-copy">
          <p class="eyebrow">Your little story begins</p>
          <h1 id="creator-title">Meet your gardener</h1>
          <p id="creator-intro">Choose a cozy look. You can see every change live in the village.</p>
        </div>
        <form class="creator-form">
          <label class="name-field">Gardener name<input name="playerName" maxlength="20" autocomplete="nickname" /></label>
          <fieldset><legend>Skin tone</legend><div class="choice-row choice-row--swatches" role="radiogroup" data-options="skinTones"></div></fieldset>
          <fieldset><legend>Hair style</legend><div class="choice-row" role="radiogroup" data-options="hairStyles"></div></fieldset>
          <fieldset><legend>Hair color</legend><div class="choice-row choice-row--swatches" role="radiogroup" data-options="hairColors"></div></fieldset>
          <fieldset><legend>Favorite top</legend><div class="choice-row choice-row--swatches" role="radiogroup" data-options="tops"></div></fieldset>
          <fieldset><legend>Bottoms</legend><div class="choice-row choice-row--swatches" role="radiogroup" data-options="bottoms"></div></fieldset>
          <button class="creator-confirm" type="submit">Step into Nxr Land <span aria-hidden="true">→</span></button>
          <p class="creator-status" role="status" aria-live="polite"></p>
        </form>
        <p class="creator-preview-note" aria-hidden="true"><span>Live village preview</span>Your gardener is waiting by the plaza</p>
      </section>
    `;
    this.container.append(overlay);
    this.element = overlay;
    const mappings = {
      skinTones: 'skinTone', hairStyles: 'hairStyle', hairColors: 'hairColor', tops: 'top', bottoms: 'bottom',
    };
    Object.entries(mappings).forEach(([group, appearanceKey]) => {
      const holder = overlay.querySelector(`[data-options="${group}"]`);
      holder.append(optionButtons(doc, group, this.appearance[appearanceKey]));
      this.#listen(holder, 'click', (event) => {
        const choice = event.target.closest('[data-value]');
        if (!choice) return;
        this.appearance[appearanceKey] = choice.dataset.value;
        holder.querySelectorAll('[role="radio"]').forEach((button) => button.setAttribute('aria-checked', String(button === choice)));
        this.player?.updateAppearance(this.appearance, { syncState: false });
      });
      this.#listen(holder, 'keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const choices = [...holder.querySelectorAll('[role="radio"]')];
        const active = choices.findIndex((choice) => choice.getAttribute('aria-checked') === 'true');
        const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
        const next = choices[(active + direction + choices.length) % choices.length];
        next.click();
        next.focus();
      });
    });
    this.nameInput = overlay.querySelector('[name="playerName"]');
    this.nameInput.value = sanitizePlayerName(this.state?.player?.name);
    this.#listen(overlay.querySelector('form'), 'submit', (event) => {
      event.preventDefault();
      this.confirm();
    });
    this.#listen(overlay, 'keydown', (event) => this.#trapFocus(event));
    queueMicrotask(() => this.nameInput?.focus());
  }

  #trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = [...this.element.querySelectorAll('input, button:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && this.element.ownerDocument.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.element.ownerDocument.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  confirm() {
    if (!this.state?.player || !this.element || this.confirming) return false;
    this.confirming = true;
    const button = this.element.querySelector('.creator-confirm');
    const status = this.element.querySelector('.creator-status');
    if (button) button.disabled = true;
    if (status) status.textContent = 'Saving your gardener…';
    const name = sanitizePlayerName(this.nameInput.value);
    const appearance = normalizeAppearance(this.appearance);
    this.state.player.name = name;
    this.state.player.appearance = { ...this.state.player.appearance, ...appearance };
    this.state.player.creatorComplete = true;
    this.player?.updateAppearance(appearance, { syncState: false });
    const saved = this.saveManager?.save?.(this.state) === true;
    if (!saved) {
      if (this.originalPlayer) {
        this.state.player.name = this.originalPlayer.name;
        this.state.player.appearance = { ...this.originalPlayer.appearance };
        this.state.player.creatorComplete = this.originalPlayer.creatorComplete;
      }
      this.confirming = false;
      if (button) button.disabled = false;
      if (status) status.textContent = 'We could not save yet. Please try again.';
      this.nameInput?.focus();
      return false;
    }
    this.eventBus?.emit?.('character:created', { name, appearance: { ...appearance } });
    const CustomEventClass = this.container?.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    if (CustomEventClass) {
      this.container?.dispatchEvent?.(new CustomEventClass('character:created', { bubbles: true, detail: { name, appearance } }));
    }
    this.dispose();
    this.onComplete?.();
    return true;
  }

  dispose() {
    if (!this.element) return;
    this.#listeners.splice(0).forEach((remove) => remove());
    this.element.remove();
    this.element = null;
    this.previousFocus?.focus?.();
  }
}
