/** The ritual opening: one click lights the lamp (and unlocks audio). */
export function showLampIntro(root: HTMLElement, title: string): Promise<void> {
  const layer = document.createElement('div');
  layer.className = 'over-stage intro';
  layer.innerHTML = `
    <button class="intro-button" type="button">
      <span class="intro-eyebrow">Bayang Eyang</span>
      <span class="flame" aria-hidden="true"></span>
      <span class="intro-title" lang="jv">Nyalakan blencong</span>
      <span class="intro-cta">Light the lamp</span>
    </button>`;
  root.appendChild(layer);
  const button = layer.querySelector('button')!;
  button.setAttribute('aria-label', `Light the lamp and begin: ${title}`);
  return new Promise((resolve) => {
    button.addEventListener(
      'click',
      () => {
        layer.dataset.state = 'lit';
        setTimeout(() => layer.remove(), 450);
        resolve();
      },
      { once: true },
    );
  });
}
