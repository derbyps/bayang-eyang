import { GUNUNGAN_INK } from './icons';

export interface EndCard {
  update(ended: boolean): void;
  destroy(): void;
}

export function createEndCard(root: HTMLElement, title: string, onReplay: () => void, onAnother?: () => void): EndCard {
  const card = document.createElement('div');
  card.className = 'over-stage end-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Bayang Eyang');
  card.hidden = true;
  card.innerHTML = `
    <div class="end-inner">
      <span class="end-mark">${GUNUNGAN_INK}</span>
      <h1 class="end-title">Bayang Eyang</h1>
      <p class="end-sub"></p>
      <div class="end-actions">
        <button class="end-replay" type="button">Watch again</button>
        <button class="end-another" type="button" hidden>Tell another story</button>
      </div>
      <p class="end-credit">@derbyps.dev</p>
    </div>`;
  card.querySelector('.end-sub')!.textContent = title;
  root.appendChild(card);
  card.querySelector('.end-replay')!.addEventListener('click', onReplay);
  const another = card.querySelector<HTMLButtonElement>('.end-another')!;
  if (onAnother) {
    another.hidden = false;
    another.addEventListener('click', onAnother);
  }

  let shown = false;
  return {
    destroy: () => card.remove(),
    update(ended) {
      if (ended === shown) return;
      shown = ended;
      if (ended) {
        card.hidden = false;
        card.dataset.state = 'enter';
        requestAnimationFrame(() => requestAnimationFrame(() => delete card.dataset.state));
      } else {
        card.hidden = true;
      }
    },
  };
}
