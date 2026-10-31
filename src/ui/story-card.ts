import type { StoryInput } from '../dalang/storyboard';

const FIELDS = [
  { name: 'who', label: 'Who should the dalang perform tonight?', max: 60, required: true, hint: 'Eyang Putri, my grandmother' },
  { name: 'loved', label: 'What did they love?', max: 160, required: false, hint: 'her rice tin, kroncong on the radio, feeding the neighbours' },
  { name: 'hardship', label: 'What was the hardest thing they faced?', max: 240, required: true, hint: 'she moved to Jakarta alone in 1972' },
  { name: 'habit', label: 'One habit everyone laughs about', max: 160, required: false, hint: 'she hid money in the rice tin and called it her bank' },
] as const;

/** The offering card. Resolves with the story, or 'demo' if the visitor chooses the ready-made play. */
export function showStoryCard(root: HTMLElement): Promise<StoryInput | 'demo'> {
  const layer = document.createElement('div');
  layer.className = 'over-stage story-layer';
  const form = document.createElement('form');
  form.className = 'story-card';
  form.setAttribute('aria-label', 'Tell the dalang a story');
  form.noValidate = false;
  form.innerHTML = `
    <header class="story-head">
      <span class="story-eyebrow" lang="jv">Ceritakan</span>
      <h2 class="story-title">Tell the dalang a story</h2>
    </header>
    <div class="story-fields"></div>
    <fieldset class="story-lang">
      <legend>Play language</legend>
      <label><input type="radio" name="language" value="en" checked> English</label>
      <label><input type="radio" name="language" value="id"> Bahasa Indonesia</label>
    </fieldset>
    <div class="story-actions">
      <button class="story-begin" type="submit">Begin the play</button>
      <button class="story-demo" type="button">or watch “Eyang Putri and the Rice Tin” →</button>
    </div>
    <p class="story-note">Your words go to an open model to write the play. Nothing is saved.</p>`;
  const fields = form.querySelector('.story-fields')!;
  for (const f of FIELDS) {
    const wrap = document.createElement('label');
    wrap.className = 'story-field';
    const prompt = document.createElement('span');
    prompt.className = 'story-prompt';
    prompt.textContent = f.label;
    const input = document.createElement('input');
    input.name = f.name;
    input.maxLength = f.max;
    input.required = f.required;
    input.placeholder = f.hint;
    input.autocomplete = 'off';
    wrap.append(prompt, input);
    fields.appendChild(wrap);
  }
  layer.appendChild(form);
  root.appendChild(layer);
  requestAnimationFrame(() => requestAnimationFrame(() => (layer.dataset.state = 'open')));
  (form.querySelector('input[name="who"]') as HTMLInputElement).focus({ preventScroll: true });

  const close = () => {
    layer.dataset.state = 'closing';
    setTimeout(() => layer.remove(), 260);
  };

  return new Promise((resolve) => {
    let sent = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (sent || !form.reportValidity()) return;
      sent = true;
      form.querySelector<HTMLButtonElement>('.story-begin')!.disabled = true;
      const data = new FormData(form);
      const value = (k: string) => String(data.get(k) ?? '').trim();
      close();
      resolve({
        who: value('who'),
        loved: value('loved'),
        hardship: value('hardship'),
        habit: value('habit'),
        language: value('language') === 'id' ? 'id' : 'en',
      });
    });
    form.querySelector('.story-demo')!.addEventListener('click', () => {
      if (sent) return;
      sent = true;
      close();
      resolve('demo');
    });
  });
}
