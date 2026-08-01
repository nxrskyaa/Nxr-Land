export class QuestUI {
  constructor({ container, questSystem, eventBus } = {}) {
    if (!container || !questSystem) throw new Error('QuestUI requires container and quest system');
    this.container = container;
    this.questSystem = questSystem;
    this.disposed = false;
    this.root = container.ownerDocument.createElement('aside');
    this.root.className = 'quest-ui';
    this.root.setAttribute('aria-label', 'Current quest');
    this.root.setAttribute('aria-live', 'polite');
    container.append(this.root);
    this.unsubscribers = ['quest:progress', 'quest:completed', 'quest:started']
      .map((type) => eventBus?.on?.(type, () => this.render())).filter(Boolean);
    this.render();
  }

  render() {
    const quest = this.questSystem.getActiveQuest();
    if (!quest) {
      this.root.innerHTML = '<p class="quest-kicker">Chapter 1 complete</p><h2>Heartroot’s First Light</h2><p>The village remembers how to hope.</p>';
      this.root.classList.add('is-complete');
      return;
    }
    const progress = this.questSystem.getProgress();
    const percent = Math.round((progress.current / progress.required) * 100);
    this.root.classList.remove('is-complete');
    this.root.innerHTML = `
      <p class="quest-kicker">Chapter 1 · Quest ${quest.order} of 8</p>
      <h2>${quest.title}</h2>
      <p class="quest-objective">${quest.objective}</p>
      <div class="quest-meta"><span>📍 ${quest.destination}</span><strong>${progress.current} / ${progress.required}</strong></div>
      <div class="quest-progress" role="progressbar" aria-label="Quest progress" aria-valuemin="0" aria-valuemax="${progress.required}" aria-valuenow="${progress.current}"><i style="width:${percent}%"></i></div>
      <p class="quest-reward"><span>Reward</span> ${this.questSystem.getRewardLabel(quest)}</p>`;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.root?.remove();
    this.root = null;
  }
}
