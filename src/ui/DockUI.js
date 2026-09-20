const TABS = Object.freeze([
  { id: 'market', icon: '🧺', label: 'Market', title: 'Village Market' },
  { id: 'rewards', icon: '🎁', label: 'Rewards', title: 'Daily Glow' },
  { id: 'wishes', icon: '✨', label: 'Wishes', title: 'Collection Wishes' },
  { id: 'wardrobe', icon: '👒', label: 'Wardrobe', title: 'Wardrobe' },
]);

/**
 * Bottom dock + modal drawer that hosts the menu-style panels (market,
 * rewards, wishes, wardrobe). Panels stay mounted in the DOM inside the
 * drawer body; the drawer only toggles which one is visible.
 */
export class DockUI {
  constructor({ container, onOpenChange } = {}) {
    this.container = container;
    this.onOpenChange = onOpenChange;
    this.open = false;
    this.activeTab = null;
    this.lastFocus = null;
    const doc = container?.ownerDocument;
    if (!doc) return;

    this.dock = doc.createElement('nav');
    this.dock.className = 'ui-dock';
    this.dock.setAttribute('aria-label', 'Village menus');
    for (const tab of TABS) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'dock-button';
      button.dataset.dockTab = tab.id;
      button.title = tab.title;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<span aria-hidden="true">${tab.icon}</span><small>${tab.label}</small>`;
      button.addEventListener('click', () => this.toggle(tab.id));
      this.dock.append(button);
    }

    this.layer = doc.createElement('div');
    this.layer.className = 'drawer-layer';
    this.layer.hidden = true;
    this.layer.innerHTML = `
      <div class="drawer-backdrop" data-drawer-close></div>
      <section class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header class="drawer-head">
          <h2 id="drawer-title" data-drawer-title>Menu</h2>
          <button type="button" class="drawer-close" data-drawer-close aria-label="Close menu">✕</button>
        </header>
        <div class="drawer-body" data-drawer-body></div>
      </section>`;
    this.panelHost = this.layer.querySelector('[data-drawer-body]');
    this.titleNode = this.layer.querySelector('[data-drawer-title]');
    this.layer.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-drawer-close]')) this.close();
    });
    this.onKeydown = (event) => {
      if (event.key === 'Escape' && this.open) this.close();
    };
    doc.addEventListener('keydown', this.onKeydown);

    container.append(this.dock, this.layer);
  }

  /** Tag an already-mounted panel so the drawer can host and toggle it per tab. */
  register(tabId, element) {
    if (!element || !this.panelHost) return;
    element.dataset.drawerTab = tabId;
    element.hidden = true;
    // Drawer-hosted panels are always expanded — the drawer chrome replaces
    // any per-panel open/close affordance.
    element.querySelectorAll?.('details').forEach((details) => { details.open = true; });
    this.panelHost.append(element);
  }

  toggle(tabId) {
    if (this.open && this.activeTab === tabId) this.close();
    else this.openTab(tabId);
  }

  openTab(tabId) {
    const tab = TABS.find((entry) => entry.id === tabId);
    if (!tab || !this.layer) return;
    if (!this.open) this.lastFocus = this.container?.ownerDocument?.activeElement ?? null;
    this.open = true;
    this.activeTab = tabId;
    this.layer.hidden = false;
    this.container?.classList?.add('drawer-open');
    if (this.titleNode) this.titleNode.textContent = tab.title;
    this.dock?.querySelectorAll('[data-dock-tab]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.dockTab === tabId));
    });
    for (const section of this.panelHost.children) {
      section.hidden = section.dataset.drawerTab !== tabId;
    }
    this.layer.querySelector('.drawer-close')?.focus?.();
    this.onOpenChange?.(true);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.activeTab = null;
    this.layer.hidden = true;
    this.container?.classList?.remove('drawer-open');
    this.dock?.querySelectorAll('[data-dock-tab]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    this.onOpenChange?.(false);
    if (this.lastFocus?.isConnected) this.lastFocus.focus?.();
    else this.dock?.querySelector('[data-dock-tab]')?.focus?.();
  }

  dispose() {
    this.container?.ownerDocument?.removeEventListener('keydown', this.onKeydown);
    this.dock?.remove();
    this.layer?.remove();
    this.dock = null;
    this.layer = null;
    this.panelHost = null;
  }
}
