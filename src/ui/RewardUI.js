import { ITEM_BY_ID, WARDROBE_BY_ID } from '../data/items.js';

function formatReward(reward = {}) {
  const parts = [];
  if (reward.coin) parts.push(`${reward.coin} coin`);
  for (const [itemId, quantity] of Object.entries(reward.items ?? {})) {
    parts.push(`${quantity}× ${ITEM_BY_ID[itemId]?.label ?? itemId}`);
  }
  for (const wardrobeId of reward.wardrobe ?? []) {
    parts.push(WARDROBE_BY_ID[wardrobeId]?.label ?? wardrobeId);
  }
  return parts.join(' · ') || 'Village surprise';
}

function formatActiveTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class RewardUI {
  constructor({ container, rewardSystem, eventBus } = {}) {
    if (!container || !rewardSystem) throw new Error('RewardUI requires container and reward system');
    this.container = container;
    this.rewardSystem = rewardSystem;
    this.eventBus = eventBus;
    this.disposed = false;
    this.root = container.ownerDocument.createElement('section');
    this.root.className = 'reward-ui game-panel';
    this.root.setAttribute('aria-label', 'Daily and playtime rewards');
    this.root.addEventListener('click', this.#handleClick);
    container.append(this.root);
    this.unsubscribers = ['reward:daily-claimed', 'reward:milestone-claimed', 'reward:playtime-updated']
      .map((type) => eventBus?.on?.(type, () => this.render()))
      .filter(Boolean);
    this.render();
  }

  #handleClick = (event) => {
    const dailyButton = event.target.closest?.('[data-claim-daily]');
    if (dailyButton && this.root?.contains(dailyButton)) {
      const result = this.rewardSystem.claimDaily();
      this.message = result.ok ? `Day ${result.day} claimed: ${result.label}` : result.message;
      this.render();
      return;
    }
    const milestoneButton = event.target.closest?.('[data-claim-milestone]');
    if (milestoneButton && this.root?.contains(milestoneButton)) {
      const result = this.rewardSystem.claimMilestone(Number(milestoneButton.dataset.claimMilestone));
      this.message = result.ok ? `${result.minutes}-minute reward claimed: ${result.label}` : result.message;
      this.render();
    }
  };

  render() {
    if (!this.root) return;
    const daily = this.rewardSystem.getDailyStatus();
    const track = this.rewardSystem.state.rewards.daily.track;
    const milestones = this.rewardSystem.getMilestones();
    const activeMs = this.rewardSystem.state.playtime.dailyActiveMs;
    const nextMilestone = milestones.find(({ claimed }) => !claimed);
    const progressMax = nextMilestone?.minutes * 60_000 || 60 * 60_000;
    const progress = Math.min(100, Math.round((activeMs / progressMax) * 100));

    this.root.innerHTML = `
      <header class="reward-header">
        <div><span class="reward-kicker">Garden gifts</span><h2>Daily glow</h2></div>
        <span class="reward-streak" aria-label="${daily.streak} day streak">${daily.streak || 0}🔥</span>
      </header>
      <div class="reward-calendar" aria-label="Seven day reward calendar">
        ${track.map((entry) => {
    const isToday = daily.available && entry.day === daily.nextDay;
    const isCurrent = !daily.available && entry.day === daily.streak;
    return `<div class="reward-day${isToday ? ' is-next' : ''}${isCurrent ? ' is-claimed' : ''}" data-reward-day="${entry.day}">
            <small>Day ${entry.day}</small><b>${formatReward(entry.reward)}</b>
          </div>`;
  }).join('')}
      </div>
      <button class="reward-daily-button" type="button" data-claim-daily ${daily.available ? '' : 'disabled'}>
        ${daily.available ? `Claim day ${daily.nextDay}` : 'Claimed today'}
      </button>
      <div class="reward-playtime-heading">
        <div><span class="reward-kicker">Foreground playtime</span><strong>${formatActiveTime(activeMs)} active today</strong></div>
        <span>${progress}%</span>
      </div>
      <div class="reward-time-progress" role="progressbar" aria-label="Progress to next playtime reward" aria-valuemin="0" aria-valuemax="${progressMax}" aria-valuenow="${Math.min(activeMs, progressMax)}"><i style="width:${progress}%"></i></div>
      <div class="reward-milestones" aria-label="Playtime milestone rewards">
        ${milestones.map((entry) => `<button type="button" class="reward-milestone${entry.claimable ? ' is-ready' : ''}" data-claim-milestone="${entry.minutes}" ${entry.claimable ? '' : 'disabled'}>
          <span>${entry.minutes}<small>min</small></span><b>${entry.claimed ? 'Claimed' : entry.claimable ? 'Claim' : formatReward(entry.reward)}</b>
        </button>`).join('')}
      </div>
      <p class="reward-status" data-reward-status role="status" aria-live="polite">${this.message ?? (daily.available ? `Day ${daily.nextDay} is ready to claim` : 'Daily gift claimed — playtime rewards keep growing')}</p>`;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.root?.removeEventListener('click', this.#handleClick);
    this.root?.remove();
    this.root = null;
  }
}
